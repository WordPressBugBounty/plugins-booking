<?php
/**
 * Ordered step registry for the Setup Wizard module.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Own the allow-listed Setup Wizard step order and open-ended rail presentation.
 */
final class WPBC_Setup_Wizard_Step_Registry {

	/** @var WPBC_Setup_Wizard_Step_Module_Registry */
	private $module_registry;

	/**
	 * Build the route registry around the reusable module registry.
	 *
	 * @param WPBC_Setup_Wizard_Step_Module_Registry|null $module_registry Optional shared module registry.
	 */
	public function __construct( $module_registry = null ) {
		$this->module_registry = $module_registry instanceof WPBC_Setup_Wizard_Step_Module_Registry
			? $module_registry
			: new WPBC_Setup_Wizard_Step_Module_Registry();
	}

	/**
	 * Return the ordered implemented step definitions.
	 *
	 * The complete allow-list includes branch-specific pages. Active-route
	 * methods expose only the pages selected by the validated draft, so the rail
	 * remains open ended and never advertises an unrelated branch.
	 *
	 * @return array<string,array<string,string>> Steps keyed by stable identifier.
	 */
	public function get_steps() {
		$core_steps = array(
			'welcome'            => array(
				'id'          => 'welcome',
				'label'       => __( 'Welcome', 'booking' ),
				'template'    => 'step-welcome',
				'footer_note' => __( 'Your changes are saved as you continue. Back only navigates and does not roll back completed steps.', 'booking' ),
			),
			'business_details'   => array(
				'id'          => 'business_details',
				'label'       => __( 'Business details', 'booking' ),
				'template'    => 'step-business-details',
				'footer_note' => __( 'Business details are saved for Setup Wizard guidance and do not change Booking Calendar settings.', 'booking' ),
			),
			'date_time_formats'  => array(
				'id'          => 'date_time_formats',
				'label'       => __( 'Dates & times', 'booking' ),
				'template'    => 'step-date-time-formats',
				'footer_note' => __( 'Save & continue updates these Date and time settings immediately.', 'booking' ),
			),
			'booking_experience' => array(
				'id'              => 'booking_experience',
				'label'           => __( 'Terminology', 'booking' ),
				'template'        => 'step-booking-experience',
				'header_template' => 'step-booking-experience-toolbar',
				'footer_note'     => __( 'Save & continue updates Booking Mode immediately.', 'booking' ),
			),
			'customer_journey'   => array(
				'id'          => 'customer_journey',
				'label'       => __( 'Customer journey', 'booking' ),
				'template'    => 'step-customer-journey',
				'footer_note' => __( 'Customer Journey and its required setup defaults are saved; changing it marks dependent steps for review.', 'booking' ),
			),
		);

		$module_steps = array_diff_key( $this->module_registry->get_step_definitions(), $core_steps );

		return array_merge( $core_steps, $module_steps );
	}

	/**
	 * Return the ordered route selected by the current validated draft.
	 *
	 * Date Selection follows Customer Journey for every route so customer-facing
	 * calendar behavior is explicit before journey-specific configuration. Days
	 * Off is also common to every supported journey. In Guided appointment flow,
	 * Services and Working Hours are configured between Date Selection and Days
	 * Off for Guided appointments. Time-based journeys configure their reusable
	 * start/end, start/duration, or fixed-slot choices immediately after Date
	 * Selection.
	 * Guided and time-based routes then share Days Off, Booking Form, and
	 * Appearance; only Guided appointment flow includes Services. Working Hours
	 * is also shared except by First-date start and last-date end, whose boundary
	 * times must not be restricted by the weekly schedule.
	 * Full-day and date-range routes share Booking Resources, Days Off, Booking
	 * Form, and Appearance without adding the time-oriented Working Hours step.
	 * Business details is omitted on live-demo sites and WordPress Playground so
	 * shared or temporary visitors are not asked to enter site or contact
	 * information. Publish & integrate is appended to every non-demo route and
	 * records only a future integration plan.
	 * Review Setup closes every route and is the explicit revalidation boundary
	 * after earlier progressive saves and before later complex step handlers are
	 * introduced.
	 *
	 * @param array<string,mixed> $draft_values Normalized values keyed by step.
	 *
	 * @return string[] Ordered active step identifiers.
	 */
	public function get_active_step_ids( array $draft_values = array() ) {
		$step_ids = array( 'welcome' );
		if ( WPBC_Setup_Wizard_Environment_Policy::allows_business_details() ) {
			$step_ids[] = 'business_details';
		}
		$step_ids = array_merge( $step_ids, array( 'date_time_formats', 'booking_experience', 'customer_journey' ) );
		$journey  = isset( $draft_values['customer_journey']['customer_journey'] )
			? sanitize_key( (string) $draft_values['customer_journey']['customer_journey'] )
			: '';
		$step_ids[] = 'date_selection';
		if ( 'guided_appointment_flow' === $journey ) {
			$step_ids[] = 'services';
		} elseif ( WPBC_Setup_Wizard_Customer_Journey_Policy::uses_booking_resources_configuration( $journey ) ) {
			$step_ids[] = 'booking_resources';
		} elseif ( WPBC_Setup_Wizard_Customer_Journey_Policy::uses_start_duration_configuration( $journey ) ) {
			$step_ids[] = 'start_duration_times';
		} elseif ( WPBC_Setup_Wizard_Customer_Journey_Policy::uses_fixed_time_slots_configuration( $journey ) ) {
			$step_ids[] = 'fixed_time_slots';
		} elseif ( WPBC_Setup_Wizard_Customer_Journey_Policy::uses_start_end_configuration( $journey ) ) {
			$step_ids[] = 'start_end_times';
		}
		if ( WPBC_Setup_Wizard_Customer_Journey_Policy::uses_working_hours_configuration( $journey ) ) {
			$step_ids[] = 'working_hours';
		}
		$step_ids[] = 'days_off';
		if ( WPBC_Setup_Wizard_Customer_Journey_Policy::uses_booking_form_and_appearance_route( $journey ) ) {
			$step_ids[] = 'booking_form_template';
			$step_ids[] = 'appearance';
		}
		if ( $this->module_registry->is_module_available( 'publish_integration', $draft_values ) ) {
			$step_ids[] = 'publish_integration';
		}
		$step_ids[] = 'review_setup';

		return $step_ids;
	}

	/**
	 * Return one registered step.
	 *
	 * @param string $step_id Proposed step identifier.
	 *
	 * @return array<string,string>|null Registered step or null.
	 */
	public function get_step( $step_id ) {
		$steps = $this->get_steps();

		return isset( $steps[ $step_id ] ) ? $steps[ $step_id ] : null;
	}

	/**
	 * Return the first registered step identifier.
	 *
	 * @return string First stable step identifier.
	 */
	public function get_first_step_id() {
		$step_ids = array_keys( $this->get_steps() );

		return (string) reset( $step_ids );
	}

	/**
	 * Normalize a stored or requested step to an allow-listed identifier.
	 *
	 * @param mixed               $step_id      Untrusted or stored value.
	 * @param array<string,mixed> $draft_values Normalized values keyed by step.
	 *
	 * @return string Valid registered step identifier.
	 */
	public function normalize_step_id( $step_id, array $draft_values = array() ) {
		$normalized_step_id = sanitize_key( is_scalar( $step_id ) ? (string) $step_id : '' );
		$active_step_ids    = $this->get_active_step_ids( $draft_values );

		if ( in_array( $normalized_step_id, $active_step_ids, true ) ) {
			return $normalized_step_id;
		}

		/*
		 * A draft may have been saved on Business details before its site became a
		 * live demo. Continue at the next stable core step instead of moving that
		 * draft to the final journey-specific page.
		 */
		if ( 'business_details' === $normalized_step_id && in_array( 'date_time_formats', $active_step_ids, true ) ) {
			return 'date_time_formats';
		}

		return null !== $this->get_step( $normalized_step_id ) ? (string) end( $active_step_ids ) : $this->get_first_step_id();
	}

	/**
	 * Resolve an adjacent step without accepting a client-selected target.
	 *
	 * @param string              $current_step_id Current allow-listed step identifier.
	 * @param string              $direction       Either `next` or `back`.
	 * @param array<string,mixed> $draft_values    Normalized values keyed by step.
	 *
	 * @return string|null Adjacent step identifier, or null at a boundary.
	 */
	public function get_adjacent_step_id( $current_step_id, $direction, array $draft_values = array() ) {
		$step_ids          = $this->get_active_step_ids( $draft_values );
		$current_step_id   = $this->normalize_step_id( $current_step_id, $draft_values );
		$current_step_index = array_search( $current_step_id, $step_ids, true );
		$offset            = 'next' === $direction ? 1 : -1;
		$target_index      = $current_step_index + $offset;

		return isset( $step_ids[ $target_index ] ) ? $step_ids[ $target_index ] : null;
	}

	/**
	 * Return all ordered step identifiers before the supplied current step.
	 *
	 * @param string              $current_step_id Current allow-listed step identifier.
	 * @param array<string,mixed> $draft_values    Normalized values keyed by step.
	 *
	 * @return string[] Ordered completed step identifiers.
	 */
	public function get_completed_step_ids( $current_step_id, array $draft_values = array() ) {
		$step_ids          = $this->get_active_step_ids( $draft_values );
		$current_step_id   = $this->normalize_step_id( $current_step_id, $draft_values );
		$current_step_index = array_search( $current_step_id, $step_ids, true );

		return array_slice( $step_ids, 0, $current_step_index );
	}

	/**
	 * Build visible rail records without revealing unchosen future branches.
	 *
	 * @param string              $current_step_id Current allow-listed step identifier.
	 * @param array<string,mixed> $draft_values    Normalized values keyed by step.
	 *
	 * @return array<int,array{id:string,label:string,state:string}> Visible rail items.
	 */
	public function get_rail_items( $current_step_id, array $draft_values = array() ) {
		$current_step_id = $this->normalize_step_id( $current_step_id, $draft_values );
		$completed_ids   = $this->get_completed_step_ids( $current_step_id, $draft_values );
		$visible_ids     = array_merge( $completed_ids, array( $current_step_id ) );
		$steps           = $this->get_steps();
		$rail_items      = array();

		foreach ( $visible_ids as $step_id ) {
			$rail_items[] = array(
				'id'    => $step_id,
				'label' => $steps[ $step_id ]['label'],
				'state' => $step_id === $current_step_id ? 'current' : 'complete',
			);
		}

		return $rail_items;
	}

	/**
	 * Determine whether at least one registered step follows the current step.
	 *
	 * The shell renders an open-ended neutral marker on the last implemented step
	 * because later branch steps are not yet registered.
	 *
	 * @param string              $current_step_id Current allow-listed step identifier.
	 * @param array<string,mixed> $draft_values    Normalized values keyed by step.
	 *
	 * @return bool True when a registered adjacent step exists.
	 */
	public function has_next_step( $current_step_id, array $draft_values = array() ) {
		return null !== $this->get_adjacent_step_id( $current_step_id, 'next', $draft_values );
	}

	/**
	 * Determine whether a previous registered step exists.
	 *
	 * @param string              $current_step_id Current allow-listed step identifier.
	 * @param array<string,mixed> $draft_values    Normalized values keyed by step.
	 *
	 * @return bool True when Back navigation is available.
	 */
	public function has_previous_step( $current_step_id, array $draft_values = array() ) {
		return null !== $this->get_adjacent_step_id( $current_step_id, 'back', $draft_values );
	}

	/**
	 * Return context-sensitive copy below the open-ended journey marker.
	 *
	 * @param string              $current_step_id Current allow-listed step identifier.
	 * @param array<string,mixed> $draft_values    Normalized values keyed by step.
	 *
	 * @return string Translated rail note.
	 */
	public function get_rail_note( $current_step_id, array $draft_values = array() ) {
		$current_step_id = $this->normalize_step_id( $current_step_id, $draft_values );
		if ( 'publish_integration' === $current_step_id ) {
			return __( 'Your setup is ready to review after you choose how customers will access booking.', 'booking' );
		}

		if ( 'review_setup' === $current_step_id ) {
			return __( 'Review every selection before approving your setup plan.', 'booking' );
		}

		if ( in_array( $current_step_id, array( 'customer_journey', 'date_selection', 'days_off', 'services', 'booking_resources', 'start_end_times', 'start_duration_times', 'fixed_time_slots', 'working_hours', 'booking_form_template', 'appearance' ), true ) ) {
			return __( 'Your next steps will follow the customer journey you choose.', 'booking' );
		}

		return __( 'Your next steps will appear as you continue.', 'booking' );
	}
}
