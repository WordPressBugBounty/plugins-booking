<?php
/**
 * Reusable module adapter for the Setup Wizard Date Selection editor.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Expose canonical date-selection behavior through the setup-module contract.
 */
final class WPBC_Setup_Wizard_Date_Selection_Module implements WPBC_Setup_Wizard_Step_Module, WPBC_Setup_Wizard_Current_Values_Module, WPBC_Setup_Wizard_Step_Values_Validator, WPBC_Setup_Wizard_Contextual_Values_Validator {

	/** @var WPBC_Setup_Wizard_Date_Selection */
	private $date_selection;

	/**
	 * Build the module around the date-selection domain service.
	 *
	 * @param WPBC_Setup_Wizard_Date_Selection|null $date_selection Optional service for testing.
	 */
	public function __construct( $date_selection = null ) {
		$this->date_selection = $date_selection instanceof WPBC_Setup_Wizard_Date_Selection
			? $date_selection
			: new WPBC_Setup_Wizard_Date_Selection();
	}

	/**
	 * Return the stable step identifier.
	 *
	 * @return string Stable identifier.
	 */
	public function get_step_id() {
		return 'date_selection';
	}

	/**
	 * Return rail and template metadata.
	 *
	 * @return array<string,string> Step definition.
	 */
	public function get_step_definition() {
		return array(
			'id'          => $this->get_step_id(),
			'label'       => __( 'Date selection', 'booking' ),
			'template'    => 'step-date-selection',
			'footer_note' => __( 'Save & continue applies these Date Selection settings immediately.', 'booking' ),
		);
	}

	/**
	 * Return the domain-owned allow-listed template path.
	 *
	 * @return string Absolute template path.
	 */
	public function get_template_path() {
		return __DIR__ . '/template.php';
	}

	/**
	 * Return the ordered Date Selection draft contract.
	 *
	 * @return string[] Field allow-list.
	 */
	public function get_field_names() {
		$field_names = array(
			'date_selection_mode',
			'date_selection_fixed_days',
			'date_selection_fixed_weekdays',
			'date_selection_dynamic_min',
			'date_selection_dynamic_max',
			'date_selection_dynamic_weekdays',
			'date_selection_dynamic_specific',
			'date_selection_changeover_enabled',
			'date_selection_check_in_time',
			'date_selection_check_out_time',
			'date_selection_triangles',
			'date_selection_checkout_available',
			'date_selection_recurrent_time',
			'date_selection_legend_enabled',
			'date_selection_legend_show_numbers',
			'date_selection_legend_vertical',
		);

		foreach ( $this->date_selection->get_legend_items() as $legend_item ) {
			$field_names[] = 'date_selection_legend_item_' . $legend_item['id'];
			$field_names[] = 'date_selection_legend_text_' . $legend_item['id'];
		}

		return $field_names;
	}

	/**
	 * Require the complete policy so later apply logic never guesses values.
	 *
	 * @return string[] Required fields.
	 */
	public function get_required_fields() {
		return $this->get_field_names();
	}

	/**
	 * Return current canonical settings as safe draft suggestions.
	 *
	 * @return array<string,string> Initial values.
	 */
	public function get_initial_values() {
		return $this->date_selection->get_initial_values();
	}

	/**
	 * Refresh the complete Date Selection policy from canonical options.
	 *
	 * @return string[] Current-value field identifiers.
	 */
	public function get_current_value_field_names() {
		return $this->get_field_names();
	}

	/**
	 * Return the Customer Journey dependency that owns compatible modes.
	 *
	 * @return string[] Dependency step identifiers.
	 */
	public function get_context_dependencies() {
		return array( 'customer_journey' );
	}

	/**
	 * Build the data-only Date Selection context and real calendar preview.
	 *
	 * @param array<string,mixed> $field_values     Validated module values.
	 * @param array<string,mixed> $consumer_context Read-only dependency values.
	 *
	 * @return array<string,mixed> Authorized template context.
	 */
	public function get_context( array $field_values, array $consumer_context = array() ) {
		$customer_journey_id = $this->get_customer_journey_id( $consumer_context );
		if ( '' === $customer_journey_id ) {
			$customer_journey_id = 'guided_appointment_flow';
		}
		$has_saved_values      = ! empty( $consumer_context['_step_state']['has_saved_values'] );
		$is_journey_transition = $this->has_pending_customer_journey_transition(
			isset( $consumer_context['_step_results'] ) && is_array( $consumer_context['_step_results'] )
				? $consumer_context['_step_results']
				: array()
		);
		$journey_policy         = $this->date_selection->get_customer_journey_policy( $customer_journey_id );
		$field_values           = $this->date_selection->apply_customer_journey_defaults( $field_values, $customer_journey_id, $has_saved_values, $is_journey_transition );

		$resource_id    = $this->get_preview_resource_id();
		$preview_result = $this->render_calendar_preview( $resource_id, $field_values, $customer_journey_id );
		$time_options   = $this->date_selection->get_time_options( $field_values['date_selection_check_in_time'] );
		$time_options   = array_replace(
			$time_options,
			$this->date_selection->get_time_options( $field_values['date_selection_check_out_time'] )
		);
		ksort( $time_options );

		return array(
			'values'                        => $field_values,
			'customer_journey_policy'       => $journey_policy,
			'weekdays'                      => $this->date_selection->get_weekdays(),
			'specific_day_presets'           => $this->date_selection->get_specific_day_presets(),
			'legend_items'                   => $this->date_selection->get_legend_items(),
			'legend_preview_items'           => $this->render_legend_preview_items( $field_values, $resource_id ),
			'time_options'                  => $time_options,
			'supports_advanced_range_rules' => $this->date_selection->supports_advanced_range_rules(),
			'preview_resource_id'           => $resource_id,
			'preview_html'                  => $preview_result['html'],
			'preview_error'                 => $preview_result['error'],
		);
	}

	/**
	 * Determine whether Customer Journey was saved after Date Selection.
	 *
	 * Every successful progressive save records the checkpoint revision observed
	 * by that operation. A newer Customer Journey result means the current Date
	 * Selection page was reached through that forward transition. Comparing
	 * existing server-owned metadata keeps the recommendation stable on refresh
	 * without adding a browser-controlled query flag or changing live settings.
	 *
	 * @param array<string,mixed> $step_results Normalized progressive-save results.
	 *
	 * @return bool True when the Customer Journey transition is pending.
	 */
	public function has_pending_customer_journey_transition( array $step_results ) {
		return WPBC_Setup_Wizard_Customer_Journey_Policy::has_pending_transition_for_step( $step_results, 'date_selection' );
	}

	/**
	 * Validate one module field through the domain service.
	 *
	 * @param string $field_id    Stable field identifier.
	 * @param mixed  $raw_value   Untrusted submitted or stored value.
	 * @param bool   $is_required Whether an empty value is invalid.
	 *
	 * @return string|WP_Error Normalized value or an error.
	 */
	public function validate_field( $field_id, $raw_value, $is_required ) {
		return $this->date_selection->validate_field( $field_id, $raw_value, $is_required );
	}

	/**
	 * Validate relationships between normalized Date Selection fields.
	 *
	 * @param array<string,mixed> $validated_values Individually validated field values.
	 *
	 * @return array<string,mixed>|WP_Error Validated values or a field-addressable error.
	 */
	public function validate_values( array $validated_values ) {
		if (
			isset( $validated_values['date_selection_dynamic_min'], $validated_values['date_selection_dynamic_max'] )
			&& (int) $validated_values['date_selection_dynamic_max'] < (int) $validated_values['date_selection_dynamic_min']
		) {
			$message = __( 'The maximum flexible range must be greater than or equal to the minimum range.', 'booking' );

			return new WP_Error(
				'wpbc_setup_wizard_date_selection_range_invalid',
				$message,
				array(
					'field_errors' => array(
						'date_selection_dynamic_max' => $message,
					),
				)
			);
		}

		if ( ! empty( $validated_values['date_selection_dynamic_specific'] ) ) {
			$specific_days = array_map( 'intval', explode( ',', $validated_values['date_selection_dynamic_specific'] ) );
			$minimum_days  = isset( $validated_values['date_selection_dynamic_min'] ) ? (int) $validated_values['date_selection_dynamic_min'] : 1;
			$maximum_days  = isset( $validated_values['date_selection_dynamic_max'] ) ? (int) $validated_values['date_selection_dynamic_max'] : WPBC_Setup_Wizard_Date_Selection::MAX_DYNAMIC_DAYS;

			foreach ( $specific_days as $specific_day ) {
				if ( $specific_day < $minimum_days || $specific_day > $maximum_days ) {
					$message = __( 'Every specific day length must be within the minimum and maximum flexible range.', 'booking' );

					return new WP_Error(
						'wpbc_setup_wizard_date_selection_specific_range_invalid',
						$message,
						array(
							'field_errors' => array(
								'date_selection_dynamic_specific' => $message,
							),
						)
					);
				}
			}
		}

		// A check-out date exists only for range selections. Normalize stale or
		// tampered values before the request-local preview consumes the draft.
		if (
			isset( $validated_values['date_selection_mode'] )
			&& in_array( $validated_values['date_selection_mode'], array( 'single', 'multiple' ), true )
		) {
			$validated_values['date_selection_checkout_available'] = 'Off';
		}

		// Match the canonical Calendar settings: changeover processing conflicts
		// with recurrent time and an independently available check-out date.
		if ( isset( $validated_values['date_selection_changeover_enabled'] ) && 'On' === $validated_values['date_selection_changeover_enabled'] ) {
			$validated_values['date_selection_checkout_available'] = 'Off';
			$validated_values['date_selection_recurrent_time']      = 'Off';
		}

		return $validated_values;
	}

	/**
	 * Enforce the selected Customer Journey after normal field validation.
	 *
	 * @param array<string,mixed> $validated_values Date Selection values after module validation.
	 * @param array<string,mixed> $consumer_context Read-only Customer Journey values.
	 *
	 * @return array<string,mixed>|WP_Error Journey-compatible values or a field-addressable error.
	 */
	public function validate_values_with_context( array $validated_values, array $consumer_context ) {
		$customer_journey_id = $this->get_customer_journey_id( $consumer_context );
		if ( '' === $customer_journey_id ) {
			return $validated_values;
		}

		return $this->date_selection->validate_values_for_customer_journey(
			$validated_values,
			$customer_journey_id
		);
	}

	/**
	 * Enqueue compiled Date Selection assets and the real calendar runtime.
	 *
	 * @param string       $module_url           Setup Wizard module URL.
	 * @param string|false $asset_version        Plugin asset version.
	 * @param string       $shared_style_handle  Shared wizard style handle.
	 * @param string       $shared_script_handle Shared wizard script handle.
	 *
	 * @return void
	 */
	public function enqueue_assets( $module_url, $asset_version, $shared_style_handle, $shared_script_handle ) {
		$module_url = trailingslashit( $module_url );

		wp_enqueue_style( 'wpbc-calendar' );
		wp_enqueue_script( 'wpbc_all' );
		wp_enqueue_style( 'wpbc-setup-wizard-date-selection', $module_url . 'step-date-selection/_out/step-date-selection.css', array( $shared_style_handle, 'wpbc-calendar' ), $asset_version );
		wp_enqueue_script( 'wpbc-setup-wizard-date-selection', $module_url . 'step-date-selection/_out/step-date-selection.js', array( $shared_script_handle, 'wpbc_all' ), $asset_version, true );
		wp_localize_script(
			'wpbc-setup-wizard-date-selection',
			'wpbc_setup_wizard_date_selection',
			array(
				'max_fixed_days'   => WPBC_Setup_Wizard_Date_Selection::MAX_FIXED_DAYS,
				'max_dynamic_days' => WPBC_Setup_Wizard_Date_Selection::MAX_DYNAMIC_DAYS,
				'preview_nonce'     => wp_create_nonce( WPBC_Setup_Wizard_Date_Selection::PREVIEW_NONCE_ACTION ),
				'i18n'             => array(
					'mode_required'        => __( 'Choose how customers select dates.', 'booking' ),
					'fixed_days_invalid'   => __( 'Enter a fixed range between 1 and 180 days.', 'booking' ),
					'dynamic_days_invalid' => __( 'Enter a flexible range between 1 and 1095 days, with the maximum not less than the minimum.', 'booking' ),
					'specific_days_invalid' => __( 'Enter comma-separated day lengths within the flexible range, for example 7,14,21,28.', 'booking' ),
				),
			)
		);
	}

	/**
	 * Resolve the current default booking resource through the canonical helper.
	 *
	 * @return int Positive resource ID.
	 */
	private function get_preview_resource_id() {
		$resource_id = class_exists( 'WPBC_FE_Attr_Postprocessor' )
			? absint( WPBC_FE_Attr_Postprocessor::get_default_booking_resource_id() )
			: 1;

		return $resource_id > 0 ? $resource_id : 1;
	}

	/**
	 * Read the allow-listed Customer Journey identifier from consumer context.
	 *
	 * @param array<string,mixed> $consumer_context Read-only dependency values.
	 *
	 * @return string Stable Customer Journey identifier.
	 */
	private function get_customer_journey_id( array $consumer_context ) {
		if (
			isset( $consumer_context['customer_journey']['customer_journey'] )
			&& is_scalar( $consumer_context['customer_journey']['customer_journey'] )
		) {
			return sanitize_key( (string) $consumer_context['customer_journey']['customer_journey'] );
		}

		return '';
	}

	/**
	 * Render a real, selectable two-month Booking Calendar preview.
	 *
	 * The renderer loads actual availability and bookings for the authorized
	 * default resource. Browser code changes only request-local selection
	 * parameters and never submits a booking or writes canonical settings.
	 *
	 * @param int                  $resource_id        Authorized preview resource ID.
	 * @param array<string,string> $field_values       Validated Date Selection draft.
	 * @param string               $customer_journey_id Stable Customer Journey identifier.
	 *
	 * @return array{html:string,error:string} Preview result.
	 */
	private function render_calendar_preview( $resource_id, array $field_values, $customer_journey_id ) {
		if ( ! class_exists( 'WPBC_FE_Render' ) ) {
			return array(
				'html'  => '',
				'error' => __( 'The customer calendar preview is unavailable.', 'booking' ),
			);
		}

		$preview_configuration = $this->date_selection->get_preview_configuration( $field_values, $customer_journey_id );
		$request_overrides      = $preview_configuration['calendar_request_overrides'];
		// This page renders its configurable legend below the calendar, so suppress
		// only the calendar renderer's duplicate legend in this local preview.
		$request_overrides['wpbc_settings_calendar_preview_show_legend'] = 'Off';

		$preview_html = WPBC_FE_Render::render_calendar_only(
			array(
				'resource_id'                 => $resource_id,
				'cal_count'                   => 2,
				'is_echo'                     => 0,
				'shortcode_param__options'    => '{calendar months_num_in_row=2 width=1023px}',
				'calendar_request_overrides'  => $request_overrides,
			)
		);

		if ( ! is_string( $preview_html ) || '' === trim( $preview_html ) ) {
			return array(
				'html'  => '',
				'error' => __( 'The customer calendar preview could not be rendered.', 'booking' ),
			);
		}

		return array(
			'html'  => $preview_html,
			'error' => '',
		);
	}

	/**
	 * Render canonical calendar-legend samples for the request-local preview.
	 *
	 * Each item is rendered separately so browser code can show, hide, and
	 * relabel an existing safe node without constructing or evaluating HTML.
	 * The saved Booking Calendar options remain unchanged.
	 *
	 * @param array<string,string> $field_values Validated Date Selection draft.
	 * @param int                  $resource_id  Authorized preview resource ID.
	 *
	 * @return array<string,string> Canonical sample HTML keyed by legend item ID.
	 */
	private function render_legend_preview_items( array $field_values, $resource_id ) {
		$preview_items = array();
		if ( ! function_exists( 'wpbc_get_calendar_legend__content_html' ) ) {
			return $preview_items;
		}

		$show_numbers = isset( $field_values['date_selection_legend_show_numbers'] ) && 'On' === $field_values['date_selection_legend_show_numbers'];
		$day_number   = wp_date( 'd' );
		foreach ( $this->date_selection->get_legend_items() as $legend_item ) {
			$legend_id    = $legend_item['id'];
			$title_key    = 'date_selection_legend_text_' . $legend_id;
			$legend_title = isset( $field_values[ $title_key ] ) && '' !== $field_values[ $title_key ]
				? $field_values[ $title_key ]
				: $legend_item['placeholder'];

			$preview_items[ $legend_id ] = wpbc_get_calendar_legend__content_html(
				array(
					'is_vertical'       => false,
					'text_for_day_cell' => $show_numbers ? $day_number : '',
					'items'             => array( $legend_id ),
					'resource_id'       => absint( $resource_id ),
					'titles'            => array( $legend_id => $legend_title ),
				)
			);
		}

		return $preview_items;
	}
}
