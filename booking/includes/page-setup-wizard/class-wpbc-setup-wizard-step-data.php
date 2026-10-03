<?php
/**
 * Read-only presentation data for the Setup Wizard module.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Provide source-backed initial values and allow-listed field choices.
 *
 * This service reads current WordPress and Booking Calendar configuration but
 * never writes it. Canonical-backed fields are refreshed whenever a step is
 * opened; saved checkpoint values remain authoritative only for wizard-owned
 * metadata that cannot be reconstructed safely from plugin state.
 */
final class WPBC_Setup_Wizard_Step_Data {

	/** @var WPBC_Setup_Wizard_Step_Module_Registry */
	private $module_registry;

	/**
	 * Build the read-only provider around the reusable module registry.
	 *
	 * @param WPBC_Setup_Wizard_Step_Module_Registry|null $module_registry Optional shared module registry.
	 */
	public function __construct( $module_registry = null ) {
		$this->module_registry = $module_registry instanceof WPBC_Setup_Wizard_Step_Module_Registry
			? $module_registry
			: new WPBC_Setup_Wizard_Step_Module_Registry();
	}

	/**
	 * Return the presentation contract for one registered step.
	 *
	 * @param string              $step_id      Registered step identifier.
	 * @param array<string,mixed> $draft_values Normalized draft values keyed by step.
	 * @param array<string,mixed> $step_results Verified progressive-save results keyed by step.
	 *
	 * @return array<string,mixed> Authorized template context for the step.
	 */
	public function get_step_context( $step_id, array $draft_values, array $step_results = array() ) {
		$step_values = $this->get_step_values( $step_id, $draft_values );
		$step_module = $this->module_registry->get_module( $step_id );

		if ( null !== $step_module ) {
			$consumer_context = array();
			foreach ( $step_module->get_context_dependencies() as $dependency_step_id ) {
				$consumer_context[ $dependency_step_id ] = $this->get_step_values( $dependency_step_id, $draft_values );
			}
			$consumer_context['_step_state'] = array(
				'has_saved_values' => isset( $draft_values[ $step_id ] )
					&& is_array( $draft_values[ $step_id ] )
					&& ! empty( $draft_values[ $step_id ] ),
			);
			if ( ! empty( $step_results ) ) {
				$consumer_context['_step_results'] = $step_results;
			}

			return $step_module->get_context( $step_values, $consumer_context );
		}

		switch ( $step_id ) {
			case 'business_details':
				return array(
					'values'          => $step_values,
					'business_stages' => $this->get_business_stages(),
					'industries'      => $this->get_industry_groups(),
				);

			case 'booking_experience':
				return array(
					'values'      => $step_values,
					'experiences' => $this->get_booking_experiences(),
				);

			case 'customer_journey':
				$selected_booking_mode_id = $this->get_selected_booking_mode_id( $draft_values );
				$journey_groups           = $this->get_customer_journey_groups( $selected_booking_mode_id );
				$ordered_journeys          = array();

				foreach ( $journey_groups as $journey_group ) {
					foreach ( $journey_group['journeys'] as $journey_id => $journey ) {
						$ordered_journeys[ $journey_id ] = $journey;
					}
				}

				return array(
					'values'                   => $step_values,
					'selected_booking_mode_id' => $selected_booking_mode_id,
					'journey_groups'           => $journey_groups,
					'journeys'                 => $ordered_journeys,
				);

			default:
				return array( 'values' => array() );
		}
	}

	/**
	 * Resolve current presentation values for one step.
	 *
	 * Checkpoint values normally preserve prior wizard choices. A module may mark
	 * allow-listed fields as current-value fields, in which case the latest
	 * server-side initial value is overlaid after the checkpoint merge. This
	 * prevents Back, rail navigation, and the review page from presenting stale
	 * copies of canonical settings changed outside the wizard.
	 *
	 * @param string              $step_id      Registered step identifier.
	 * @param array<string,mixed> $draft_values Normalized draft values keyed by step.
	 *
	 * @return array<string,mixed> Values ready for the step template.
	 */
	public function get_step_values( $step_id, array $draft_values ) {
		$initial_values = $this->get_initial_values( $step_id );
		$saved_values   = isset( $draft_values[ $step_id ] ) && is_array( $draft_values[ $step_id ] )
			? $draft_values[ $step_id ]
			: array();
		$step_values    = array_merge( $initial_values, array_intersect_key( $saved_values, $initial_values ) );
		$current_fields = array_intersect(
			$this->get_current_value_field_names( $step_id ),
			array_keys( $initial_values )
		);

		if ( empty( $current_fields ) ) {
			return $step_values;
		}

		return array_merge(
			$step_values,
			array_intersect_key( $initial_values, array_flip( $current_fields ) )
		);
	}

	/**
	 * Return fields whose current server values override checkpoint snapshots.
	 *
	 * Booking Mode is the only core step backed directly by canonical plugin
	 * state. Reusable domain modules opt in through the companion current-values
	 * contract. Business Details and Customer Journey remain wizard metadata.
	 *
	 * @param string $step_id Registered step identifier.
	 *
	 * @return string[] Current-value field identifiers.
	 */
	public function get_current_value_field_names( $step_id ) {
		$step_module = $this->module_registry->get_module( $step_id );
		if ( $step_module instanceof WPBC_Setup_Wizard_Current_Values_Module ) {
			return array_values(
				array_intersect(
					$step_module->get_current_value_field_names(),
					$step_module->get_field_names()
				)
			);
		}

		return 'booking_experience' === $step_id ? array( 'booking_experience' ) : array();
	}

	/**
	 * Return current canonical values or source-supported suggestions for a step.
	 *
	 * No value returned here is persisted unless the user explicitly continues
	 * or goes back from the corresponding Setup Wizard step.
	 *
	 * @param string $step_id Registered step identifier.
	 *
	 * @return array<string,mixed> Read-only initial values.
	 */
	public function get_initial_values( $step_id ) {
		$step_module = $this->module_registry->get_module( $step_id );
		if ( null !== $step_module ) {
			return $step_module->get_initial_values();
		}

		switch ( $step_id ) {
			case 'business_details':
				return array(
					'business_name'            => sanitize_text_field( (string) get_option( 'blogname', '' ) ),
					'business_stage'           => 'starting',
					'industry'                 => 'other',
					'booking_email'            => sanitize_email( (string) get_option( 'admin_email', '' ) ),
					'personalization_consent' => true,
				);

			case 'booking_experience':
				$selected_mode_id = function_exists( 'wpbc_booking_modes_get_selected_mode_id' )
					? wpbc_booking_modes_get_selected_mode_id()
					: 'classic';
				$available_mode_ids = array_column( $this->get_booking_experiences(), 'id' );
				$fallback_mode_id   = in_array( 'classic', $available_mode_ids, true )
					? 'classic'
					: ( ! empty( $available_mode_ids ) ? (string) reset( $available_mode_ids ) : 'classic' );

				return array(
					'booking_experience' => in_array( $selected_mode_id, $available_mode_ids, true ) ? $selected_mode_id : $fallback_mode_id,
				);

			case 'customer_journey':
				return array(
					'customer_journey' => '',
				);

			default:
				return array();
		}
	}

	/**
	 * Return field names accepted for one step.
	 *
	 * @param string $step_id Registered step identifier.
	 *
	 * @return string[] Ordered allow-list of draft field names.
	 */
	public function get_field_names( $step_id ) {
		$step_module = $this->module_registry->get_module( $step_id );
		if ( null !== $step_module ) {
			return $step_module->get_field_names();
		}

		$field_names = array(
			'welcome'            => array(),
			'business_details'   => array( 'business_name', 'business_stage', 'industry', 'booking_email', 'personalization_consent' ),
			'booking_experience' => array( 'booking_experience' ),
			'customer_journey'   => array( 'customer_journey' ),
		);

		return isset( $field_names[ $step_id ] ) ? $field_names[ $step_id ] : array();
	}

	/**
	 * Return allowed scalar choices for one select, radio, or checkbox field.
	 *
	 * @param string $step_id  Registered step identifier.
	 * @param string $field_id Stable field identifier.
	 *
	 * @return array<int,string|bool> Allowed values, or an empty array for free text.
	 */
	public function get_allowed_values( $step_id, $field_id ) {
		$available_customer_journey_ids = array();
		foreach ( array_keys( self::get_customer_journeys() ) as $customer_journey_id ) {
			if ( WPBC_Setup_Wizard_Customer_Journey_Policy::is_journey_available( $customer_journey_id ) ) {
				$available_customer_journey_ids[] = $customer_journey_id;
			}
		}

		$field_choices = array(
			'business_details'   => array(
				'business_stage'           => array_keys( $this->get_business_stages() ),
				'industry'                 => array_keys( $this->get_industry_options() ),
				'personalization_consent' => array( false, true ),
			),
			'booking_experience' => array(
				'booking_experience' => array_column( $this->get_booking_experiences(), 'id' ),
			),
			'customer_journey'   => array(
				'customer_journey' => $available_customer_journey_ids,
			),
		);

		return isset( $field_choices[ $step_id ][ $field_id ] ) ? $field_choices[ $step_id ][ $field_id ] : array();
	}

	/**
	 * Return required fields for forward navigation from one step.
	 *
	 * @param string $step_id Registered step identifier.
	 *
	 * @return string[] Required field identifiers.
	 */
	public function get_required_fields( $step_id ) {
		$step_module = $this->module_registry->get_module( $step_id );
		if ( null !== $step_module ) {
			return $step_module->get_required_fields();
		}

		$required_fields = array(
			'business_details'   => array( 'business_name', 'business_stage', 'industry', 'booking_email' ),
			'booking_experience' => array( 'booking_experience' ),
			'customer_journey'   => array( 'customer_journey' ),
		);

		return isset( $required_fields[ $step_id ] ) ? $required_fields[ $step_id ] : array();
	}

	/**
	 * Determine whether a step delegates its complete field contract to a module.
	 *
	 * @param string $step_id Registered step identifier.
	 *
	 * @return bool True when a reusable module owns the step.
	 */
	public function is_module_step( $step_id ) {
		return null !== $this->module_registry->get_module( $step_id );
	}

	/**
	 * Validate one field through its registered reusable module.
	 *
	 * @param string $step_id     Registered step identifier.
	 * @param string $field_id    Stable field identifier.
	 * @param mixed  $raw_value   Untrusted submitted or stored value.
	 * @param bool   $is_required Whether an empty value is invalid.
	 *
	 * @return mixed|WP_Error Normalized field value or an error.
	 */
	public function validate_module_field( $step_id, $field_id, $raw_value, $is_required ) {
		$step_module = $this->module_registry->get_module( $step_id );

		if ( null === $step_module ) {
			return new WP_Error( 'wpbc_setup_wizard_step_module_missing', __( 'The requested setup editor is not registered.', 'booking' ) );
		}

		return $step_module->validate_field( $field_id, $raw_value, $is_required );
	}

	/**
	 * Validate relationships across a reusable module's normalized fields.
	 *
	 * Modules without the companion values-validator contract keep the existing
	 * field-only behavior. The consumer remains domain-neutral and does not know
	 * which field relationships a module owns.
	 *
	 * @param string              $step_id          Registered step identifier.
	 * @param array<string,mixed> $validated_values Values after individual field validation.
	 * @param array<string,mixed> $draft_values     Normalized draft values keyed by step.
	 *
	 * @return array<string,mixed>|WP_Error Validated values or a module-owned error.
	 */
	public function validate_module_values( $step_id, array $validated_values, array $draft_values = array() ) {
		$step_module = $this->module_registry->get_module( $step_id );

		if ( null === $step_module ) {
			return new WP_Error( 'wpbc_setup_wizard_step_module_missing', __( 'The requested setup editor is not registered.', 'booking' ) );
		}

		if ( $step_module instanceof WPBC_Setup_Wizard_Step_Values_Validator ) {
			$validated_values = $step_module->validate_values( $validated_values );
			if ( is_wp_error( $validated_values ) ) {
				return $validated_values;
			}
		}

		if ( ! $step_module instanceof WPBC_Setup_Wizard_Contextual_Values_Validator ) {
			return $validated_values;
		}

		$consumer_context = array();
		foreach ( $step_module->get_context_dependencies() as $dependency_step_id ) {
			$consumer_context[ $dependency_step_id ] = $this->get_step_values( $dependency_step_id, $draft_values );
		}

		return $step_module->validate_values_with_context( $validated_values, $consumer_context );
	}

	/**
	 * Return business maturity options retained from the released wizard.
	 *
	 * @return array<string,string> Labels keyed by stable draft value.
	 */
	public function get_business_stages() {
		return array(
			'starting'         => __( "I'm just starting my business", 'booking' ),
			'in_business'      => __( "I'm already in business", 'booking' ),
			'setup_for_client' => __( "I'm setting up a plugin for a client", 'booking' ),
		);
	}

	/**
	 * Return grouped industry choices retained from the released wizard.
	 *
	 * @return array<int,array{label:string,options:array<string,string>}> Industry groups.
	 */
	public function get_industry_groups() {
		return array(
			array(
				'label'   => __( 'Hospitality & Property', 'booking' ),
				'options' => $this->translate_options(
					array(
						'property_rentals'  => 'Property Rentals',
						'hotels'            => 'Hotels',
						'resorts'           => 'Resorts',
						'rentals'           => 'Vacation Rentals',
						'coworking_spaces'  => 'Coworking Spaces',
						'other_hospitality' => 'Other',
					)
				),
			),
			array(
				'label'   => __( 'Transportation & Activities', 'booking' ),
				'options' => $this->translate_options(
					array(
						'car_rentals'          => 'Car Rentals',
						'shuttles'             => 'Shuttle Services',
						'limousines'           => 'Limousines',
						'tour_operators'       => 'Tour Operators',
						'adventure_parks'      => 'Adventure Parks',
						'other_transportation' => 'Other',
					)
				),
			),
			array(
				'label'   => __( 'Events & Entertainment', 'booking' ),
				'options' => $this->translate_options(
					array(
						'event_venues'  => 'Event Venues',
						'meeting_rooms' => 'Meeting Rooms',
						'escape_rooms'  => 'Escape Rooms',
						'other_events'  => 'Other',
					)
				),
			),
			array(
				'label'   => __( 'Health & Wellness', 'booking' ),
				'options' => $this->translate_options(
					array(
						'spas'            => 'Spas',
						'salons'          => 'Salons',
						'clinics'         => 'Clinics',
						'massage_therapy' => 'Massage Therapy',
						'other_health'    => 'Other',
					)
				),
			),
			array(
				'label'   => __( 'Healthcare', 'booking' ),
				'options' => $this->translate_options(
					array(
						'doctors'          => 'Doctors',
						'dentists'         => 'Dentists',
						'therapists'       => 'Therapists',
						'chiropractors'    => 'Chiropractors',
						'acupuncturists'   => 'Acupuncturists',
						'other_healthcare' => 'Other',
					)
				),
			),
			array(
				'label'   => __( 'Professional Services', 'booking' ),
				'options' => $this->translate_options(
					array(
						'consultants'        => 'Consultants',
						'lawyers'            => 'Lawyers',
						'accountants'        => 'Accountants',
						'financial_advisors' => 'Financial Advisors',
						'other_professional' => 'Other',
					)
				),
			),
			array(
				'label'   => __( 'Retail & E-Commerce', 'booking' ),
				'options' => $this->translate_options(
					array(
						'product_demos'        => 'Product Demonstrations',
						'fitting_appointments' => 'Fitting Appointments',
						'equipment_rentals'    => 'Equipment Rentals',
						'other_retail'         => 'Other',
					)
				),
			),
			array(
				'label'   => __( 'Education & Training', 'booking' ),
				'options' => $this->translate_options(
					array(
						'tutors'          => 'Tutors',
						'classes'         => 'Classes',
						'schools'         => 'Schools',
						'workshops'       => 'Workshops',
						'other_education' => 'Other',
					)
				),
			),
			array(
				'label'   => __( 'Food & Restaurants', 'booking' ),
				'options' => $this->translate_options(
					array(
						'table_reservations' => 'Table Reservations',
						'catering'           => 'Catering',
						'banquet_halls'       => 'Banquet Halls',
						'other_food'          => 'Other',
					)
				),
			),
			array(
				'label'   => __( 'Creative & Technical Services', 'booking' ),
				'options' => $this->translate_options(
					array(
						'photographers'  => 'Photographers',
						'videographers'  => 'Videographers',
						'web_developers' => 'Web Developers',
						'it_support'     => 'IT Support',
						'art_studios'    => 'Art Studios',
						'music_lessons'  => 'Music Lessons',
						'other_creative' => 'Other',
					)
				),
			),
			array(
				'label'   => __( 'Legal Services', 'booking' ),
				'options' => $this->translate_options(
					array(
						'attorneys'         => 'Attorneys',
						'legal_consultants' => 'Legal Consultants',
						'other_legal'       => 'Other',
					)
				),
			),
			array(
				'label'   => __( 'Childcare & Home Services', 'booking' ),
				'options' => $this->translate_options(
					array(
						'daycares'        => 'Daycares',
						'babysitting'     => 'Babysitting',
						'nanny_services'  => 'Nanny Services',
						'cleaners'        => 'Cleaners',
						'repairs'         => 'Repair Services',
						'handyman'        => 'Handyman',
						'other_childcare' => 'Other',
					)
				),
			),
			array(
				'label'   => __( 'Sports & Fitness', 'booking' ),
				'options' => $this->translate_options(
					array(
						'gyms'                     => 'Gyms',
						'fitness_classes'          => 'Fitness Classes',
						'yoga_studios'             => 'Yoga Studios',
						'golf_lessons'             => 'Golf Lessons',
						'sports_equipment_rentals' => 'Sports Equipment Rentals',
						'other_sports'             => 'Other',
					)
				),
			),
			array(
				'label'   => __( 'Pet Services', 'booking' ),
				'options' => $this->translate_options(
					array(
						'veterinarians' => 'Veterinarians',
						'groomers'      => 'Pet Groomers',
						'pet_sitting'   => 'Pet Sitting',
						'other_pet'     => 'Other',
					)
				),
			),
			array(
				'label'   => __( 'Personal Services', 'booking' ),
				'options' => $this->translate_options(
					array(
						'coaching'           => 'Coaching',
						'counseling'         => 'Counseling',
						'spiritual_services' => 'Spiritual Services',
						'interior_design'    => 'Interior Design',
						'other_personal'     => 'Other',
					)
				),
			),
			array(
				'label'   => __( 'Other', 'booking' ),
				'options' => $this->translate_options( array( 'other' => 'Other' ) ),
			),
		);
	}

	/**
	 * Flatten grouped industries for validation.
	 *
	 * @return array<string,string> Industry labels keyed by stable identifier.
	 */
	private function get_industry_options() {
		$industry_options = array();

		foreach ( $this->get_industry_groups() as $industry_group ) {
			$industry_options = array_merge( $industry_options, $industry_group['options'] );
		}

		return $industry_options;
	}

	/**
	 * Translate a compact source-defined option map.
	 *
	 * @param array<string,string> $options English labels keyed by stable identifiers.
	 *
	 * @return array<string,string> Translated labels keyed by stable identifiers.
	 */
	private function translate_options( array $options ) {
		$translated_labels = array(
			'Property Rentals'         => __( 'Property Rentals', 'booking' ),
			'Hotels'                   => __( 'Hotels', 'booking' ),
			'Resorts'                  => __( 'Resorts', 'booking' ),
			'Vacation Rentals'         => __( 'Vacation Rentals', 'booking' ),
			'Coworking Spaces'         => __( 'Coworking Spaces', 'booking' ),
			'Other'                    => __( 'Other', 'booking' ),
			'Car Rentals'              => __( 'Car Rentals', 'booking' ),
			'Shuttle Services'         => __( 'Shuttle Services', 'booking' ),
			'Limousines'               => __( 'Limousines', 'booking' ),
			'Tour Operators'           => __( 'Tour Operators', 'booking' ),
			'Adventure Parks'          => __( 'Adventure Parks', 'booking' ),
			'Event Venues'             => __( 'Event Venues', 'booking' ),
			'Meeting Rooms'            => __( 'Meeting Rooms', 'booking' ),
			'Escape Rooms'             => __( 'Escape Rooms', 'booking' ),
			'Spas'                     => __( 'Spas', 'booking' ),
			'Salons'                   => __( 'Salons', 'booking' ),
			'Clinics'                  => __( 'Clinics', 'booking' ),
			'Massage Therapy'          => __( 'Massage Therapy', 'booking' ),
			'Doctors'                  => __( 'Doctors', 'booking' ),
			'Dentists'                 => __( 'Dentists', 'booking' ),
			'Therapists'               => __( 'Therapists', 'booking' ),
			'Chiropractors'            => __( 'Chiropractors', 'booking' ),
			'Acupuncturists'           => __( 'Acupuncturists', 'booking' ),
			'Consultants'              => __( 'Consultants', 'booking' ),
			'Lawyers'                  => __( 'Lawyers', 'booking' ),
			'Accountants'              => __( 'Accountants', 'booking' ),
			'Financial Advisors'       => __( 'Financial Advisors', 'booking' ),
			'Product Demonstrations'   => __( 'Product Demonstrations', 'booking' ),
			'Fitting Appointments'     => __( 'Fitting Appointments', 'booking' ),
			'Equipment Rentals'        => __( 'Equipment Rentals', 'booking' ),
			'Tutors'                   => __( 'Tutors', 'booking' ),
			'Classes'                  => __( 'Classes', 'booking' ),
			'Schools'                  => __( 'Schools', 'booking' ),
			'Workshops'                => __( 'Workshops', 'booking' ),
			'Table Reservations'       => __( 'Table Reservations', 'booking' ),
			'Catering'                 => __( 'Catering', 'booking' ),
			'Banquet Halls'            => __( 'Banquet Halls', 'booking' ),
			'Photographers'            => __( 'Photographers', 'booking' ),
			'Videographers'            => __( 'Videographers', 'booking' ),
			'Web Developers'           => __( 'Web Developers', 'booking' ),
			'IT Support'               => __( 'IT Support', 'booking' ),
			'Art Studios'              => __( 'Art Studios', 'booking' ),
			'Music Lessons'            => __( 'Music Lessons', 'booking' ),
			'Attorneys'                => __( 'Attorneys', 'booking' ),
			'Legal Consultants'        => __( 'Legal Consultants', 'booking' ),
			'Daycares'                 => __( 'Daycares', 'booking' ),
			'Babysitting'              => __( 'Babysitting', 'booking' ),
			'Nanny Services'           => __( 'Nanny Services', 'booking' ),
			'Cleaners'                 => __( 'Cleaners', 'booking' ),
			'Repair Services'          => __( 'Repair Services', 'booking' ),
			'Handyman'                 => __( 'Handyman', 'booking' ),
			'Gyms'                     => __( 'Gyms', 'booking' ),
			'Fitness Classes'          => __( 'Fitness Classes', 'booking' ),
			'Yoga Studios'             => __( 'Yoga Studios', 'booking' ),
			'Golf Lessons'             => __( 'Golf Lessons', 'booking' ),
			'Sports Equipment Rentals' => __( 'Sports Equipment Rentals', 'booking' ),
			'Veterinarians'            => __( 'Veterinarians', 'booking' ),
			'Pet Groomers'             => __( 'Pet Groomers', 'booking' ),
			'Pet Sitting'              => __( 'Pet Sitting', 'booking' ),
			'Coaching'                 => __( 'Coaching', 'booking' ),
			'Counseling'               => __( 'Counseling', 'booking' ),
			'Spiritual Services'       => __( 'Spiritual Services', 'booking' ),
			'Interior Design'          => __( 'Interior Design', 'booking' ),
		);

		foreach ( $options as $option_id => $option_label ) {
			$options[ $option_id ] = isset( $translated_labels[ $option_label ] ) ? $translated_labels[ $option_label ] : $option_label;
		}

		return $options;
	}

	/**
	 * Return the bundled Booking Mode terminology choices allowed in this context.
	 *
	 * Stable identifiers come from the existing Booking Modes setup integration.
	 * The remaining records are presentation-only metadata for the approved
	 * administration-navigation mockup. They never authorize or apply a mode.
	 *
	 * @return array<int,array<string,mixed>> Card presentation records.
	 */
	private function get_booking_experiences() {
		$allowed_mode_ids = array( 'appointment', 'rental', 'classic' );
		if ( function_exists( 'wpbc_booking_modes_get_setup_mode_choices' ) ) {
			$allowed_mode_ids = array_keys( wpbc_booking_modes_get_setup_mode_choices() );
		} elseif ( function_exists( 'wpbc_booking_modes_get_allowed_mode_ids' ) ) {
			$allowed_mode_ids = wpbc_booking_modes_get_allowed_mode_ids();
		}

		$experience_definitions = array(
			'appointment' => array(
				'id'               => 'appointment',
				'title'            => __( 'Appointments & services', 'booking' ),
				'toolbar_label'    => __( 'Appointments', 'booking' ),
				'admin_navigation' => array(
					array( 'label' => __( 'Appointments', 'booking' ), 'icon' => 'wpbc_icn_event_available' ),
					array( 'label' => __( 'Services', 'booking' ), 'icon' => 'wpbc_icn_local_offer' ),
					array( 'label' => __( 'Providers', 'booking' ), 'icon' => 'wpbc_icn_groups' ),
					array( 'label' => __( 'Working hours', 'booking' ), 'icon' => 'wpbc_icn_access_time' ),
				),
				'dashboard_uses'   => __( 'Appointments, Services, Providers and Working hours.', 'booking' ),
				'best_for'         => __( 'Consultations, salons, classes and scheduled services.', 'booking' ),
			),
			'rental'      => array(
				'id'               => 'rental',
				'title'            => __( 'Properties & rentals', 'booking' ),
				'toolbar_label'    => __( 'Rentals', 'booking' ),
				'admin_navigation' => array(
					array( 'label' => __( 'Bookings', 'booking' ), 'icon' => 'wpbc_icn_event' ),
					array( 'label' => __( 'Properties', 'booking' ), 'icon' => 'wpbc_icn_home' ),
					array( 'label' => __( 'Availability', 'booking' ), 'icon' => 'wpbc_icn_date_range' ),
					array( 'label' => __( 'Guests', 'booking' ), 'icon' => 'wpbc_icn_groups' ),
				),
				'dashboard_uses'   => __( 'Bookings, Properties, Availability and Guests.', 'booking' ),
				'best_for'         => __( 'Rooms, equipment and holiday rentals.', 'booking' ),
			),
			'classic'     => array(
				'id'               => 'classic',
				'title'            => __( 'Classic Booking Calendar', 'booking' ),
				'toolbar_label'    => __( 'Classic', 'booking' ),
				'admin_navigation' => array(
					array( 'label' => __( 'Bookings', 'booking' ), 'icon' => 'wpbc_icn_event' ),
					array( 'label' => __( 'Booking resources', 'booking' ), 'icon' => 'wpbc_icn_dashboard' ),
					array( 'label' => __( 'Availability', 'booking' ), 'icon' => 'wpbc_icn_date_range' ),
					array( 'label' => __( 'Booking forms', 'booking' ), 'icon' => 'wpbc_icn_description' ),
				),
				'dashboard_uses'   => __( 'Bookings, Booking resources, Availability and Booking forms.', 'booking' ),
				'best_for'         => __( 'Traditional resource-first booking.', 'booking' ),
			),
		);

		$experiences = array();
		foreach ( array( 'appointment', 'rental', 'classic' ) as $mode_id ) {
			if ( in_array( $mode_id, $allowed_mode_ids, true ) ) {
				$experience = $experience_definitions[ $mode_id ];
				$mode       = function_exists( 'wpbc_booking_modes_get_mode' ) ? wpbc_booking_modes_get_mode( $mode_id ) : null;

				if ( is_array( $mode ) && ! empty( $mode['label'] ) && is_scalar( $mode['label'] ) ) {
					$experience['toolbar_label'] = sanitize_text_field( (string) $mode['label'] );
				}

				/* translators: %s: Booking Calendar administration mode. */
				$experience['toolbar_title'] = sprintf( __( 'Mode: %s', 'booking' ), $experience['toolbar_label'] );
				$experiences[]               = $experience;
			}
		}

		return $experiences;
	}

	/**
	 * Resolve the Page 4 Booking Mode proposal used to organize Page 5.
	 *
	 * The current owner-scoped Booking Mode always wins over an older checkpoint
	 * snapshot. This method never writes the canonical `booking_admin_mode` user
	 * option.
	 *
	 * @param array<string,mixed> $draft_values Normalized draft values by step.
	 *
	 * @return string One allowed bundled Booking Mode identifier.
	 */
	private function get_selected_booking_mode_id( array $draft_values ) {
		$experience_ids    = array_column( $this->get_booking_experiences(), 'id' );
		$experience_values = $this->get_step_values( 'booking_experience', $draft_values );
		$selected_mode_id  = isset( $experience_values['booking_experience'] )
			? sanitize_key( (string) $experience_values['booking_experience'] )
			: '';

		if ( in_array( $selected_mode_id, $experience_ids, true ) ) {
			return $selected_mode_id;
		}

		return ! empty( $experience_ids ) ? (string) reset( $experience_ids ) : 'classic';
	}

	/**
	 * Build the Page 5 recommended and additional groups for one Booking Mode.
	 *
	 * All registered journeys remain visible. Branch-compatible journeys are
	 * ordered first, while the remaining choices are presented as visually muted
	 * additional options. Edition-owned availability is attached by the master
	 * registry and independently enforced by the field allow-list, so presentation
	 * state never becomes an authorization boundary.
	 *
	 * @param string $mode_id Validated Page 4 Booking Mode identifier.
	 *
	 * @return array<int,array<string,mixed>> Ordered presentation groups.
	 */
	public function get_customer_journey_groups( $mode_id ) {
		$mode_id          = sanitize_key( (string) $mode_id );
		$journeys         = self::get_customer_journeys();
		$recommended_order = array(
			'appointment' => array( 'guided_appointment_flow', 'start_end_time', 'start_time_duration', 'fixed_time_slots' ),
			'rental'      => array( 'single_full_day', 'multiple_independent_days', 'flexible_date_range', 'fixed_length_date_range', 'check_in_out_changeover' ),
			'classic'     => array( 'single_full_day', 'multiple_independent_days', 'flexible_date_range', 'fixed_length_date_range', 'check_in_out_changeover', 'fixed_time_slots', 'start_end_time', 'start_time_duration', 'repeated_time_multiple_dates', 'first_start_last_end' ),
		);

		if ( ! isset( $recommended_order[ $mode_id ] ) ) {
			$mode_id = 'classic';
		}

		$recommended_journeys = array();
		foreach ( $recommended_order[ $mode_id ] as $journey_id ) {
			if ( isset( $journeys[ $journey_id ] ) && in_array( $mode_id, $journeys[ $journey_id ]['branches'], true ) ) {
				$recommended_journeys[ $journey_id ] = $journeys[ $journey_id ];
			}
		}

		foreach ( $journeys as $journey_id => $journey ) {
			if ( in_array( $mode_id, $journey['branches'], true ) && ! isset( $recommended_journeys[ $journey_id ] ) ) {
				$recommended_journeys[ $journey_id ] = $journey;
			}
		}

		$additional_journeys = array_diff_key( $journeys, $recommended_journeys );
		$mode_titles         = array(
			'appointment' => __( 'Appointments & services', 'booking' ),
			'rental'      => __( 'Properties & rentals', 'booking' ),
			'classic'     => __( 'Classic Booking Calendar', 'booking' ),
		);

		$groups = array(
			array(
				'id'            => 'recommended',
				/* translators: %s: Selected Booking Mode title. */
				'label'         => sprintf( __( 'Recommended for %s', 'booking' ), $mode_titles[ $mode_id ] ),
				'description'   => __( 'These customer journeys best match the admin terminology selected in the previous step.', 'booking' ),
				'is_additional' => false,
				'journeys'      => $recommended_journeys,
			),
		);

		if ( ! empty( $additional_journeys ) ) {
			$groups[] = array(
				'id'            => 'additional',
				'label'         => __( 'Additional customer journeys', 'booking' ),
				'description'   => __( 'These alternatives remain available when your customer flow differs from the selected admin terminology.', 'booking' ),
				'is_additional' => true,
				'journeys'      => $additional_journeys,
			);
		}

		return $groups;
	}

	/**
	 * Return the complete Phase 3 customer-journey registry.
	 *
	 * The registry intentionally returns every unique source-backed journey.
	 * The `branches` metadata lets Page 5 recommend and order journeys for the
	 * Page 4 Booking Mode without removing alternatives. Stable identifiers are
	 * the draft contract; labels, descriptions, previews, and branch metadata
	 * are presentation information.
	 *
	 * @return array<string,array<string,mixed>> Journey records keyed by stable identifier.
	 */
	public static function get_customer_journeys() {
		$journeys = array(
			'guided_appointment_flow'              => array(
				'id'            => 'guided_appointment_flow',
				'title'         => __( 'Guided appointment flow', 'booking' ),
				'description'   => __( 'Customers choose a Service, Provider and available start time step by step.', 'booking' ),
				'journey'       => array( __( 'Service', 'booking' ), __( 'Provider', 'booking' ), __( 'Date', 'booking' ), __( 'Time', 'booking' ), __( 'Details', 'booking' ) ),
				'preview_types' => array( 'service', 'providers', 'calendar', 'times', 'details' ),
				'best_for'      => __( 'Businesses with several Services or Providers.', 'booking' ),
				'branches'      => array( 'appointment' ),
			),
			'start_end_time'                       => array(
				'id'            => 'start_end_time',
				'title'         => __( 'Start & end time', 'booking' ),
				'description'   => __( 'Customers choose both ends of a flexible appointment time range.', 'booking' ),
				'journey'       => array( __( 'Date', 'booking' ), __( 'Start time', 'booking' ), __( 'End time', 'booking' ), __( 'Details', 'booking' ) ),
				'preview_types' => array( 'calendar', 'times', 'times', 'details' ),
				'best_for'      => __( 'Flexible appointments, equipment use and variable-duration work.', 'booking' ),
				'branches'      => array( 'appointment', 'classic' ),
			),
			'start_time_duration'                  => array(
				'id'            => 'start_time_duration',
				'title'         => __( 'Start time + duration', 'booking' ),
				'description'   => __( 'Customers choose a start time and one of the available durations.', 'booking' ),
				'journey'       => array( __( 'Date', 'booking' ), __( 'Start time', 'booking' ), __( 'Duration', 'booking' ), __( 'Details', 'booking' ) ),
				'preview_types' => array( 'calendar', 'times', 'times', 'details' ),
				'best_for'      => __( 'Appointments offered in standard duration choices.', 'booking' ),
				'branches'      => array( 'appointment', 'classic' ),
			),
			'fixed_time_slots'                     => array(
				'id'            => 'fixed_time_slots',
				'title'         => __( 'Fixed time slots', 'booking' ),
				'description'   => __( 'Customers select one predefined available time slot.', 'booking' ),
				'journey'       => array( __( 'Date', 'booking' ), __( 'Available slot', 'booking' ), __( 'Details', 'booking' ) ),
				'preview_types' => array( 'calendar', 'times', 'details' ),
				'best_for'      => __( 'Classes, consultations and fixed timetables.', 'booking' ),
				'branches'      => array( 'appointment', 'classic' ),
			),
			'single_full_day'                     => array(
				'id'            => 'single_full_day',
				'title'         => __( 'Single full day', 'booking' ),
				'description'   => __( 'Customers reserve one complete date without choosing a time.', 'booking' ),
				'journey'       => array( __( 'Date', 'booking' ), __( 'Details', 'booking' ) ),
				'preview_types' => array( 'calendar', 'details' ),
				'best_for'      => __( 'One-day rentals, events and daily reservations.', 'booking' ),
				'branches'      => array( 'rental', 'classic' ),
			),
			'multiple_independent_days'            => array(
				'id'            => 'multiple_independent_days',
				'title'         => __( 'Multiple independent full days', 'booking' ),
				'description'   => __( 'Customers select several separate full dates in one booking.', 'booking' ),
				'journey'       => array( __( 'Dates', 'booking' ), __( 'Details', 'booking' ) ),
				'preview_types' => array( 'calendar-multiple', 'details' ),
				'best_for'      => __( 'Bookings that cover several non-consecutive days.', 'booking' ),
				'branches'      => array( 'rental', 'classic' ),
			),
			'flexible_date_range'                  => array(
				'id'            => 'flexible_date_range',
				'title'         => __( 'Flexible date range', 'booking' ),
				'description'   => __( 'Customers choose the first and last date of a variable-length booking.', 'booking' ),
				'journey'       => array( __( 'Start date', 'booking' ), __( 'End date', 'booking' ), __( 'Details', 'booking' ) ),
				'preview_types' => array( 'range-flexible-start', 'range-flexible-end', 'details' ),
				'best_for'      => __( 'Stays and rentals whose length varies by booking.', 'booking' ),
				'branches'      => array( 'rental', 'classic' ),
			),
			'fixed_length_date_range'              => array(
				'id'            => 'fixed_length_date_range',
				'title'         => __( 'Fixed-length date range', 'booking' ),
				'description'   => __( 'Customers choose a start date and the configured range is selected automatically.', 'booking' ),
				'journey'       => array( __( 'Start date', 'booking' ), __( 'Fixed stay', 'booking' ), __( 'Details', 'booking' ) ),
				'preview_types' => array( 'range-fixed-start', 'range-fixed-selected', 'details' ),
				'best_for'      => __( 'Weekend, multi-day and weekly packages.', 'booking' ),
				'branches'      => array( 'rental', 'classic' ),
			),
			'check_in_out_changeover'              => array(
				'id'            => 'check_in_out_changeover',
				'title'         => __( 'Check-in & check-out changeover', 'booking' ),
				'description'   => __( 'Customers choose arrival and departure dates with changeover boundaries.', 'booking' ),
				'journey'       => array( __( 'Check-in', 'booking' ), __( 'Check-out', 'booking' ), __( 'Guest details', 'booking' ) ),
				'preview_types' => array( 'range-check-in', 'range-check-out', 'guest-details' ),
				'best_for'      => __( 'Accommodation and rentals with arrival and departure times.', 'booking' ),
				'branches'      => array( 'rental', 'classic' ),
			),
			'repeated_time_multiple_dates'         => array(
				'id'            => 'repeated_time_multiple_dates',
				'title'         => __( 'Repeat one time on multiple dates', 'booking' ),
				'description'   => __( 'Customers select several dates and use the same time on every selected date.', 'booking' ),
				'journey'       => array( __( 'Dates', 'booking' ), __( 'Time', 'booking' ), __( 'Details', 'booking' ) ),
				'preview_types' => array( 'calendar-multiple', 'times', 'details' ),
				'best_for'      => __( 'Recurring sessions submitted together for the same daily time.', 'booking' ),
				'branches'      => array( 'classic' ),
			),
			'first_start_last_end'                 => array(
				'id'            => 'first_start_last_end',
				'title'         => __( 'First-date start & last-date end', 'booking' ),
				'description'   => __( 'Customers choose a start on the first date and an end on the last date.', 'booking' ),
				'journey'       => array( __( 'Start date & time', 'booking' ), __( 'End date & time', 'booking' ), __( 'Details', 'booking' ) ),
				'preview_types' => array( 'date-time-start', 'date-time-end', 'details' ),
				'best_for'      => __( 'Multi-day bookings with different arrival and departure times.', 'booking' ),
				'branches'      => array( 'classic' ),
			),
		);

		foreach ( $journeys as $journey_id => $journey ) {
			$journeys[ $journey_id ]['edition_requirement'] = WPBC_Setup_Wizard_Customer_Journey_Policy::get_journey_edition_requirement( $journey_id );
		}

		return $journeys;
	}

}
