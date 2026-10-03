<?php
/**
 * Date-selection policy data and validation for the isolated Setup Wizard.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Adapt canonical Booking Calendar day-selection options to a safe draft DTO.
 */
final class WPBC_Setup_Wizard_Date_Selection {

	/** Nonce action for request-local calendar preview data. */
	const PREVIEW_NONCE_ACTION = 'wpbc_setup_wizard_date_selection_preview';

	/** Maximum supported one-click fixed range length. */
	const MAX_FIXED_DAYS = 180;

	/** Maximum supported two-click flexible range length. */
	const MAX_DYNAMIC_DAYS = 1095;

	/**
	 * Authorize one request-local calendar data preview.
	 *
	 * The standard calendar-load endpoint is public because booking calendars
	 * must load for visitors. Setup Wizard option overrides are privileged, so
	 * this additional boundary requires the wizard capability and a page nonce
	 * before the canonical calendar calculations may consume draft settings.
	 *
	 * @param array<string,mixed> $request_params Sanitized calendar-load parameters.
	 *
	 * @return bool True when the current request may apply wizard preview overrides.
	 */
	public static function is_calendar_preview_request_allowed( array $request_params ) {
		if (
			empty( $request_params['wpbc_setup_wizard_date_selection_preview'] )
			|| empty( $request_params['wpbc_setup_wizard_date_selection_preview_nonce'] )
			|| ! class_exists( 'WPBC_Setup_Wizard_Access' )
			|| ! WPBC_Setup_Wizard_Access::current_user_can_access()
		) {
			return false;
		}

		$preview_nonce = (string) $request_params['wpbc_setup_wizard_date_selection_preview_nonce'];
		return (bool) wp_verify_nonce( $preview_nonce, self::PREVIEW_NONCE_ACTION );
	}

	/**
	 * Determine whether Business Small range and changeover rules are available.
	 *
	 * @return bool True for Business Small or a higher edition.
	 */
	public function supports_advanced_range_rules() {
		return WPBC_Setup_Wizard_Customer_Journey_Policy::supports_advanced_range_rules();
	}

	/**
	 * Return the Date Selection policy owned by one Customer Journey.
	 *
	 * A policy distinguishes the journey's best mode from safe secondary modes.
	 * All other cards remain visible for comparison but are locked. Related
	 * settings are expressed as explicit states so PHP validation and the browser
	 * adapter enforce the same behavior without inferring rules from card text.
	 *
	 * @param string $journey_id Stable Customer Journey identifier.
	 *
	 * @return array<string,mixed> Data-only journey policy.
	 */
	public function get_customer_journey_policy( $journey_id ) {
		$journey_id = sanitize_key( is_scalar( $journey_id ) ? (string) $journey_id : '' );
		$policies   = array(
			'guided_appointment_flow'      => array(
				'label'           => __( 'Guided appointment flow', 'booking' ),
				'best_mode'       => 'single',
				'supported_modes' => array( 'multiple' ),
			),
			'start_end_time'                 => array(
				'label'           => __( 'Start & end time', 'booking' ),
				'best_mode'       => 'single',
				'supported_modes' => array( 'multiple' ),
			),
			'start_time_duration'            => array(
				'label'           => __( 'Start time + duration', 'booking' ),
				'best_mode'       => 'single',
				'supported_modes' => array( 'multiple' ),
			),
			'fixed_time_slots'               => array(
				'label'           => __( 'Fixed time slots', 'booking' ),
				'best_mode'       => 'single',
				'supported_modes' => array( 'multiple' ),
			),
			'single_full_day'                => array(
				'label'           => __( 'Single full day', 'booking' ),
				'best_mode'       => 'single',
				'supported_modes' => array(),
			),
			'multiple_independent_days'      => array(
				'label'           => __( 'Multiple independent full days', 'booking' ),
				'best_mode'       => 'multiple',
				'supported_modes' => array(),
			),
			'flexible_date_range'            => array(
				'label'           => __( 'Flexible date range', 'booking' ),
				'best_mode'       => 'dynamic',
				'supported_modes' => array(),
			),
			'fixed_length_date_range'        => array(
				'label'           => __( 'Fixed-length date range', 'booking' ),
				'best_mode'       => 'fixed',
				'supported_modes' => array(),
			),
			'check_in_out_changeover'        => array(
				'label'           => __( 'Check-in & check-out changeover', 'booking' ),
				'best_mode'       => 'dynamic',
				'supported_modes' => array(),
			),
			'repeated_time_multiple_dates'   => array(
				'label'           => __( 'Repeat one time on multiple dates', 'booking' ),
				'best_mode'       => 'multiple',
				'supported_modes' => array( 'dynamic' ),
			),
			'first_start_last_end'           => array(
				'label'           => __( 'First-date start & last-date end', 'booking' ),
				'best_mode'       => 'dynamic',
				'supported_modes' => array( 'multiple' ),
			),
		);

		if ( ! isset( $policies[ $journey_id ] ) ) {
			$journey_id = 'guided_appointment_flow';
		}

		$policy                = $policies[ $journey_id ];
		$policy['journey_id']  = $journey_id;
		$policy['mode_policy'] = array();
		foreach ( array( 'single', 'multiple', 'dynamic', 'fixed' ) as $mode_id ) {
			$policy['mode_policy'][ $mode_id ] = $this->get_customer_journey_mode_policy( $journey_id, $mode_id, $policy );
		}

		return $policy;
	}

	/**
	 * Normalize dependent settings to the selected Customer Journey and mode.
	 *
	 * Incompatible stored modes fall back to the journey's best mode for display.
	 * Forced settings are always normalized so a hidden control cannot retain a
	 * stale value from a previously selected journey.
	 *
	 * @param array<string,mixed> $field_values Date Selection draft values.
	 * @param string              $journey_id   Stable Customer Journey identifier.
	 *
	 * @return array<string,mixed> Journey-compatible values.
	 */
	public function normalize_values_for_customer_journey( array $field_values, $journey_id ) {
		$policy        = $this->get_customer_journey_policy( $journey_id );
		$selected_mode = isset( $field_values['date_selection_mode'] ) ? sanitize_key( (string) $field_values['date_selection_mode'] ) : '';
		$mode_policy   = isset( $policy['mode_policy'][ $selected_mode ] ) ? $policy['mode_policy'][ $selected_mode ] : array();

		if ( empty( $mode_policy ) || 'locked' === $mode_policy['status'] ) {
			$selected_mode                         = $policy['best_mode'];
			$field_values['date_selection_mode']   = $selected_mode;
			$mode_policy                           = $policy['mode_policy'][ $selected_mode ];
		}

		$field_values['date_selection_changeover_enabled'] = $this->normalize_policy_toggle(
			isset( $field_values['date_selection_changeover_enabled'] ) ? $field_values['date_selection_changeover_enabled'] : 'Off',
			$mode_policy['changeover']
		);
		$field_values['date_selection_recurrent_time'] = $this->normalize_policy_toggle(
			isset( $field_values['date_selection_recurrent_time'] ) ? $field_values['date_selection_recurrent_time'] : 'Off',
			$mode_policy['recurrent_time']
		);
		$field_values['date_selection_checkout_available'] = $this->normalize_policy_toggle(
			isset( $field_values['date_selection_checkout_available'] ) ? $field_values['date_selection_checkout_available'] : 'Off',
			$mode_policy['checkout_available']
		);

		return $field_values;
	}

	/**
	 * Apply the Date Selection default owned by a scheduled-booking journey.
	 *
	 * Continuing directly from Customer Journey to Date Selection starts the two
	 * multi-date time journeys at their recommended modes. The other scheduled
	 * booking journeys retain their established Single day transition default.
	 * Outside that exact transition, existing Setup Wizard values remain
	 * authoritative. A new, unsaved time-configuration step also retains the
	 * established Single day fallback for compatibility with checkpoints created
	 * before transition evidence was recorded; policy normalization then replaces
	 * any locked mode with the journey's recommended mode.
	 *
	 * @param array<string,mixed> $field_values                  Current Date Selection values.
	 * @param string              $journey_id                    Stable Customer Journey identifier.
	 * @param bool                $has_saved_values              Whether this checkpoint already saved the step.
	 * @param bool                $is_customer_journey_transition Whether Customer Journey was saved after Date Selection.
	 *
	 * @return array<string,mixed> Journey-compatible presentation values.
	 */
	public function apply_customer_journey_defaults( array $field_values, $journey_id, $has_saved_values, $is_customer_journey_transition = false ) {
		if (
			$is_customer_journey_transition
			&& in_array( $journey_id, array( 'repeated_time_multiple_dates', 'first_start_last_end' ), true )
		) {
			$journey_policy                       = $this->get_customer_journey_policy( $journey_id );
			$field_values['date_selection_mode'] = $journey_policy['best_mode'];
		} elseif (
			(
				$is_customer_journey_transition
				&& WPBC_Setup_Wizard_Customer_Journey_Policy::uses_single_day_transition_default( $journey_id )
			)
			|| (
				! $has_saved_values
				&& WPBC_Setup_Wizard_Customer_Journey_Policy::uses_time_configuration( $journey_id )
			)
		) {
			$field_values['date_selection_mode'] = 'single';
		}

		return $this->normalize_values_for_customer_journey( $field_values, $journey_id );
	}

	/**
	 * Build the canonical Booking Calendar option values for Date Selection.
	 *
	 * Date Selection remains the single owner of the mapping between wizard
	 * field names and Booking Calendar's established option contract. The
	 * returned values are normalized data only; the progressive-save handler
	 * decides which edition-supported options may be persisted.
	 *
	 * @param array<string,mixed> $field_values Validated Date Selection values.
	 * @param string              $journey_id   Stable Customer Journey identifier.
	 *
	 * @return array<string,string> Canonical option values keyed by option name.
	 */
	public function get_canonical_option_values( array $field_values, $journey_id ) {
		$field_values = wp_parse_args( $field_values, $this->get_initial_values() );
		$field_values = $this->normalize_values_for_customer_journey( $field_values, $journey_id );
		$mode         = isset( $field_values['date_selection_mode'] ) ? sanitize_key( (string) $field_values['date_selection_mode'] ) : 'multiple';

		if ( 'fixed' === $mode && ! $this->supports_advanced_range_rules() ) {
			$mode = 'dynamic';
		}
		if ( ! in_array( $mode, array( 'single', 'multiple', 'dynamic', 'fixed' ), true ) ) {
			$mode = 'multiple';
		}

		$is_range_mode     = in_array( $mode, array( 'dynamic', 'fixed' ), true );
		$is_advanced       = $this->supports_advanced_range_rules();
		$changeover_active = $is_advanced && $is_range_mode && 'On' === (string) $field_values['date_selection_changeover_enabled'];
		$triangles_active  = $changeover_active && 'On' === (string) $field_values['date_selection_triangles'];
		$checkout_active   = $is_advanced && $is_range_mode && ! $changeover_active && 'On' === (string) $field_values['date_selection_checkout_available'];
		$recurrent_time    = ! $changeover_active && 'On' === (string) $field_values['date_selection_recurrent_time'];
		$dynamic_min       = $this->normalize_bounded_integer( $field_values['date_selection_dynamic_min'], 1, self::MAX_DYNAMIC_DAYS, 1 );
		$dynamic_max       = $this->normalize_bounded_integer( $field_values['date_selection_dynamic_max'], 1, self::MAX_DYNAMIC_DAYS, self::MAX_DYNAMIC_DAYS );
		$dynamic_max       = max( $dynamic_min, $dynamic_max );
		$day_selection     = in_array( $mode, array( 'single', 'multiple' ), true ) ? $mode : 'range';
		$range_type        = 'fixed' === $mode ? 'fixed' : 'dynamic';

		$canonical_options = array(
			'booking_type_of_day_selections'                    => $day_selection,
			'booking_range_selection_type'                      => $range_type,
			'booking_range_selection_days_count'                => (string) $this->normalize_bounded_integer( $field_values['date_selection_fixed_days'], 1, self::MAX_FIXED_DAYS, 3 ),
			'booking_range_start_day'                           => $this->normalize_weekdays( $field_values['date_selection_fixed_weekdays'] ),
			'booking_range_selection_days_count_dynamic'        => (string) $dynamic_min,
			'booking_range_selection_days_max_count_dynamic'    => (string) $dynamic_max,
			'booking_range_selection_days_specific_num_dynamic' => $this->normalize_specific_days( $field_values['date_selection_dynamic_specific'] ),
			'booking_range_start_day_dynamic'                   => $this->normalize_weekdays( $field_values['date_selection_dynamic_weekdays'] ),
			'booking_range_selection_time_is_active'            => $changeover_active ? 'On' : 'Off',
			'booking_range_selection_start_time'                => $this->normalize_time( $field_values['date_selection_check_in_time'], '15:00' ),
			'booking_range_selection_end_time'                  => $this->normalize_time( $field_values['date_selection_check_out_time'], '11:00' ),
			'booking_change_over_days_triangles'                => $triangles_active ? 'On' : 'Off',
			'booking_last_checkout_day_available'               => $checkout_active ? 'On' : 'Off',
			'booking_recurrent_time'                            => $recurrent_time ? 'On' : 'Off',
			'booking_is_show_legend'                            => 'On' === (string) $field_values['date_selection_legend_enabled'] ? 'On' : 'Off',
			'booking_legend_is_show_numbers'                    => 'On' === (string) $field_values['date_selection_legend_show_numbers'] ? 'On' : 'Off',
			'booking_legend_is_vertical'                        => 'On' === (string) $field_values['date_selection_legend_vertical'] ? 'On' : 'Off',
		);

		foreach ( $this->get_legend_items() as $legend_item ) {
			$legend_id = $legend_item['id'];
			$show_key  = 'date_selection_legend_item_' . $legend_id;
			$text_key  = 'date_selection_legend_text_' . $legend_id;

			$canonical_options[ 'booking_legend_is_show_item_' . $legend_id ] = 'On' === (string) $field_values[ $show_key ] ? 'On' : 'Off';
			$canonical_options[ 'booking_legend_text_for_item_' . $legend_id ] = $this->normalize_legend_text( $field_values[ $text_key ] );
		}

		return $canonical_options;
	}

	/**
	 * Build request-local overrides for the Date Selection editor only.
	 *
	 * Later Setup Wizard previews read the canonical options written when Date
	 * Selection advances. Keeping this override contract local to the editor
	 * prevents a checkpoint from becoming a second settings authority.
	 *
	 * @param array<string,mixed> $field_values Validated Date Selection editor values.
	 * @param string              $journey_id   Stable Customer Journey identifier.
	 *
	 * @return array<string,array<string,mixed>> Allow-listed editor preview overrides.
	 */
	public function get_preview_configuration( array $field_values, $journey_id ) {
		$option_overrides  = $this->get_canonical_option_values( $field_values, $journey_id );
		$day_selection     = $option_overrides['booking_type_of_day_selections'];
		$dynamic_min       = (int) $option_overrides['booking_range_selection_days_count_dynamic'];
		$dynamic_max       = (int) $option_overrides['booking_range_selection_days_max_count_dynamic'];
		$changeover_active = 'On' === $option_overrides['booking_range_selection_time_is_active'];
		$triangles_active  = 'On' === $option_overrides['booking_change_over_days_triangles'];
		$checkout_active   = 'On' === $option_overrides['booking_last_checkout_day_available'];
		$recurrent_time    = 'On' === $option_overrides['booking_recurrent_time'];

		$calendar_parameters = array(
			'is_enabled_change_over'   => $changeover_active,
			'days_select_mode'          => $day_selection,
			'fixed__days_num'           => (int) $option_overrides['booking_range_selection_days_count'],
			'fixed__week_days__start'   => $this->preview_integer_list( $option_overrides['booking_range_start_day'], array( -1 ) ),
			'dynamic__days_min'         => $dynamic_min,
			'dynamic__days_max'         => $dynamic_max,
			'dynamic__days_specific'    => $this->preview_integer_list( $option_overrides['booking_range_selection_days_specific_num_dynamic'], array() ),
			'dynamic__week_days__start' => $this->preview_integer_list( $option_overrides['booking_range_start_day_dynamic'], array( -1 ) ),
			'booking_recurrent_time'     => $recurrent_time ? 'On' : 'Off',
		);

		$calendar_request_overrides = array(
			'wpbc_settings_calendar_preview'                 => 1,
			'wpbc_setup_wizard_date_selection_preview'       => 1,
			'wpbc_setup_wizard_date_selection_preview_nonce' => wp_create_nonce( self::PREVIEW_NONCE_ACTION ),
			'wpbc_settings_calendar_preview_changeover'      => $changeover_active ? 'On' : 'Off',
			'wpbc_settings_calendar_preview_triangles'       => $triangles_active ? 'On' : 'Off',
			'wpbc_settings_calendar_preview_recurrent_time'  => $recurrent_time ? 'On' : 'Off',
			'wpbc_settings_calendar_preview_last_checkout'   => $checkout_active ? 'On' : 'Off',
			'wpbc_settings_calendar_preview_show_legend'     => $option_overrides['booking_is_show_legend'],
			'wpbc_settings_calendar_preview_legend_show_numbers' => $option_overrides['booking_legend_is_show_numbers'],
			'wpbc_settings_calendar_preview_legend_vertical' => $option_overrides['booking_legend_is_vertical'],
		);

		foreach ( $this->get_legend_items() as $legend_item ) {
			$legend_id = $legend_item['id'];
			$calendar_request_overrides[ 'wpbc_settings_calendar_preview_legend_show_' . $legend_id ] = $option_overrides[ 'booking_legend_is_show_item_' . $legend_id ];
			$calendar_request_overrides[ 'wpbc_settings_calendar_preview_legend_text_' . $legend_id ] = $option_overrides[ 'booking_legend_text_for_item_' . $legend_id ];
		}

		return array(
			'option_overrides'          => $option_overrides,
			'calendar_parameters'       => $calendar_parameters,
			'calendar_request_overrides' => $calendar_request_overrides,
		);
	}

	/**
	 * Convert one validated comma list into JSON-safe preview integers.
	 *
	 * @param mixed $raw_list Candidate array or comma-separated list.
	 * @param int[] $fallback Fallback returned when no integers remain.
	 *
	 * @return int[] Normalized integer list.
	 */
	private function preview_integer_list( $raw_list, array $fallback ) {
		$raw_values = is_array( $raw_list ) ? $raw_list : explode( ',', (string) $raw_list );
		$integers   = array();

		foreach ( $raw_values as $raw_value ) {
			if ( is_scalar( $raw_value ) && preg_match( '/^-?\d+$/', trim( (string) $raw_value ) ) ) {
				$integers[] = (int) $raw_value;
			}
		}

		return empty( $integers ) ? $fallback : array_values( array_unique( $integers ) );
	}

	/**
	 * Validate that a submitted mode belongs to the selected Customer Journey.
	 *
	 * @param array<string,mixed> $field_values Date Selection values after field validation.
	 * @param string              $journey_id   Stable Customer Journey identifier.
	 *
	 * @return array<string,mixed>|WP_Error Journey-compatible values or a field error.
	 */
	public function validate_values_for_customer_journey( array $field_values, $journey_id ) {
		$policy        = $this->get_customer_journey_policy( $journey_id );
		$selected_mode = isset( $field_values['date_selection_mode'] ) ? sanitize_key( (string) $field_values['date_selection_mode'] ) : '';

		if ( ! isset( $policy['mode_policy'][ $selected_mode ] ) || 'locked' === $policy['mode_policy'][ $selected_mode ]['status'] ) {
			$message = __( 'Choose a date-selection mode that is compatible with the selected Customer Journey.', 'booking' );

			return new WP_Error(
				'wpbc_setup_wizard_date_selection_journey_mismatch',
				$message,
				array(
					'field_errors' => array(
						'date_selection_mode' => $message,
					),
				)
			);
		}

		return $this->normalize_values_for_customer_journey( $field_values, $journey_id );
	}

	/**
	 * Build one mode rule inside a Customer Journey policy.
	 *
	 * @param string              $journey_id Stable Customer Journey identifier.
	 * @param string              $mode_id    Stable Date Selection mode.
	 * @param array<string,mixed> $policy     Parent journey policy.
	 *
	 * @return array<string,string> Mode status, badge, reason, and dependent setting states.
	 */
	private function get_customer_journey_mode_policy( $journey_id, $mode_id, array $policy ) {
		$status = 'locked';
		if ( $policy['best_mode'] === $mode_id ) {
			$status = 'best';
		} elseif ( in_array( $mode_id, $policy['supported_modes'], true ) ) {
			$status = 'supported';
		}

		$mode_policy = array(
			'status'             => $status,
			'badge_label'        => 'best' === $status ? __( 'Best match', 'booking' ) : ( 'supported' === $status ? __( 'Also supported', 'booking' ) : '' ),
			'disabled_reason'     => '',
			'changeover'         => 'hidden_off',
			'recurrent_time'     => 'hidden_off',
			'checkout_available' => 'hidden_off',
		);

		if ( 'locked' === $status ) {
			$is_range_mode = in_array( $mode_id, array( 'dynamic', 'fixed' ), true );
			$mode_policy['badge_label'] = $is_range_mode
				? __( 'Requires range booking journey', 'booking' )
				: __( 'Requires a matching date journey', 'booking' );
			$mode_policy['disabled_reason'] = $is_range_mode
				? __( 'Choose a range-based Customer Journey before using this date behavior.', 'booking' )
				: __( 'Choose a Customer Journey designed for this date behavior.', 'booking' );

			return $mode_policy;
		}

		if (
			in_array( $journey_id, array( 'guided_appointment_flow', 'start_end_time', 'start_time_duration', 'fixed_time_slots' ), true )
			&& 'multiple' === $mode_id
		) {
			$mode_policy['recurrent_time'] = 'optional_default_on';
		}

		if ( 'flexible_date_range' === $journey_id || 'fixed_length_date_range' === $journey_id ) {
			$mode_policy['checkout_available'] = 'optional';
		}

		if ( 'check_in_out_changeover' === $journey_id ) {
			$mode_policy['changeover'] = 'required_on';
		}

		if ( 'repeated_time_multiple_dates' === $journey_id ) {
			$mode_policy['recurrent_time'] = 'required_on';
		}

		return $mode_policy;
	}

	/**
	 * Normalize one On/Off value according to a journey-owned control state.
	 *
	 * @param mixed  $current_value Current draft value.
	 * @param string $policy_state  Optional, default-on, forced-on, or forced-off state.
	 *
	 * @return string Normalized `On` or `Off` value.
	 */
	private function normalize_policy_toggle( $current_value, $policy_state ) {
		if ( in_array( $policy_state, array( 'hidden_on', 'required_on' ), true ) ) {
			return 'On';
		}

		if ( in_array( $policy_state, array( 'optional', 'optional_default_on' ), true ) ) {
			return 'On' === $current_value ? 'On' : 'Off';
		}

		return 'Off';
	}

	/**
	 * Return current canonical settings as read-only wizard suggestions.
	 *
	 * Missing or invalid legacy values are normalized without changing the
	 * stored options. Free and Personal editions retain Range selection but use
	 * the supported unrestricted two-click behavior.
	 *
	 * @return array<string,string> Normalized date-selection draft values.
	 */
	public function get_initial_values() {
		$day_selection_type = sanitize_key( (string) get_bk_option( 'booking_type_of_day_selections' ) );
		$range_type         = sanitize_key( (string) get_bk_option( 'booking_range_selection_type' ) );
		if ( in_array( $day_selection_type, array( 'single', 'multiple' ), true ) ) {
			$selection_mode = $day_selection_type;
		} elseif ( 'range' === $day_selection_type ) {
			$selection_mode = $this->supports_advanced_range_rules() && 'fixed' === $range_type ? 'fixed' : 'dynamic';
		} else {
			$selection_mode = 'multiple';
		}
		$dynamic_min       = $this->normalize_bounded_integer( get_bk_option( 'booking_range_selection_days_count_dynamic' ), 1, self::MAX_DYNAMIC_DAYS, 1 );
		$dynamic_max       = $this->normalize_bounded_integer( get_bk_option( 'booking_range_selection_days_max_count_dynamic' ), 1, self::MAX_DYNAMIC_DAYS, self::MAX_DYNAMIC_DAYS );
		$dynamic_max       = max( $dynamic_min, $dynamic_max );
		$is_advanced       = $this->supports_advanced_range_rules();
		$dynamic_specific  = $is_advanced ? $this->normalize_specific_days( get_bk_option( 'booking_range_selection_days_specific_num_dynamic' ) ) : '';
		$changeover_active = $is_advanced && 'On' === get_bk_option( 'booking_range_selection_time_is_active' );

		$initial_values = array(
			'date_selection_mode'               => $selection_mode,
			'date_selection_fixed_days'         => (string) $this->normalize_bounded_integer( get_bk_option( 'booking_range_selection_days_count' ), 1, self::MAX_FIXED_DAYS, 3 ),
			'date_selection_fixed_weekdays'     => $this->normalize_weekdays( get_bk_option( 'booking_range_start_day' ) ),
			'date_selection_dynamic_min'         => (string) ( $is_advanced ? $dynamic_min : 1 ),
			'date_selection_dynamic_max'         => (string) $dynamic_max,
			'date_selection_dynamic_weekdays'    => $is_advanced ? $this->normalize_weekdays( get_bk_option( 'booking_range_start_day_dynamic' ) ) : '-1',
			'date_selection_dynamic_specific'    => $dynamic_specific,
			'date_selection_changeover_enabled'  => $changeover_active ? 'On' : 'Off',
			'date_selection_check_in_time'       => $this->normalize_time( get_bk_option( 'booking_range_selection_start_time' ), '15:00' ),
			'date_selection_check_out_time'      => $this->normalize_time( get_bk_option( 'booking_range_selection_end_time' ), '11:00' ),
			'date_selection_triangles'           => $is_advanced && 'Off' !== get_bk_option( 'booking_change_over_days_triangles' ) ? 'On' : 'Off',
			'date_selection_checkout_available'  => $is_advanced && in_array( $selection_mode, array( 'dynamic', 'fixed' ), true ) && ! $changeover_active && 'On' === get_bk_option( 'booking_last_checkout_day_available' ) ? 'On' : 'Off',
			'date_selection_recurrent_time'       => ! $changeover_active && 'On' === get_bk_option( 'booking_recurrent_time' ) ? 'On' : 'Off',
			'date_selection_legend_enabled'       => 'On' === get_bk_option( 'booking_is_show_legend' ) ? 'On' : 'Off',
			'date_selection_legend_show_numbers'  => 'On' === get_bk_option( 'booking_legend_is_show_numbers' ) ? 'On' : 'Off',
			'date_selection_legend_vertical'      => 'On' === get_bk_option( 'booking_legend_is_vertical' ) ? 'On' : 'Off',
		);

		foreach ( $this->get_legend_items() as $legend_item ) {
			$legend_id = $legend_item['id'];
			$initial_values[ 'date_selection_legend_item_' . $legend_id ] = 'On' === get_bk_option( 'booking_legend_is_show_item_' . $legend_id ) ? 'On' : 'Off';
			$initial_values[ 'date_selection_legend_text_' . $legend_id ] = $this->normalize_legend_text( get_bk_option( 'booking_legend_text_for_item_' . $legend_id ) );
		}

		return $initial_values;
	}

	/**
	 * Return the canonical configurable calendar-legend items.
	 *
	 * The wizard owns only presentation metadata and draft field identifiers;
	 * the released Calendar Legend renderer remains the authority for the
	 * customer-facing legend cells.
	 *
	 * @return array<int,array{id:string,label:string,placeholder:string}> Legend item DTOs.
	 */
	public function get_legend_items() {
		return array(
			array(
				'id'          => 'available',
				'label'       => __( 'Available item', 'booking' ),
				'placeholder' => __( 'Available', 'booking' ),
			),
			array(
				'id'          => 'pending',
				'label'       => __( 'Pending item', 'booking' ),
				'placeholder' => __( 'Pending', 'booking' ),
			),
			array(
				'id'          => 'approved',
				'label'       => __( 'Approved item', 'booking' ),
				'placeholder' => __( 'Booked', 'booking' ),
			),
			array(
				'id'          => 'partially',
				'label'       => __( 'Partially booked item', 'booking' ),
				'placeholder' => __( 'Partially booked', 'booking' ),
			),
			array(
				'id'          => 'unavailable',
				'label'       => __( 'Unavailable item', 'booking' ),
				'placeholder' => __( 'Unavailable', 'booking' ),
			),
		);
	}

	/**
	 * Return the safe preset choices for specific flexible-range lengths.
	 *
	 * Each preset is an explicit draft profile for the canonical flexible-range
	 * options. The selected-date counts are inclusive, and weekday values use
	 * Booking Calendar's Sunday-zero convention. Clear deliberately changes only
	 * the specific-length expression so it cannot discard manually configured
	 * minimum, maximum, or start-weekday rules.
	 *
	 * @return array<int,array<string,string|null>> Preset DTOs.
	 */
	public function get_specific_day_presets() {
		return array(
			array(
				'id'             => 'weekly_days',
				'label'          => __( 'Weekly days', 'booking' ),
				'value'          => '7,14,21,28',
				'minimum_days'   => '7',
				'maximum_days'   => '28',
				'start_weekdays' => '-1',
			),
			array(
				'id'             => 'weekly_nights',
				'label'          => __( 'Weekly selection for nights', 'booking' ),
				'value'          => '8,15,22,29',
				'minimum_days'   => '8',
				'maximum_days'   => '29',
				'start_weekdays' => '-1',
			),
			array(
				'id'             => 'weekend_stay',
				'label'          => __( 'Weekend stays', 'booking' ),
				'value'          => '3,4',
				'minimum_days'   => '3',
				'maximum_days'   => '4',
				'start_weekdays' => '5',
			),
			array(
				'id'             => 'work_week',
				'label'          => __( 'Work week', 'booking' ),
				'value'          => '5',
				'minimum_days'   => '5',
				'maximum_days'   => '5',
				'start_weekdays' => '1',
			),
			array(
				'id'             => 'clear',
				'label'          => __( 'Clear', 'booking' ),
				'value'          => '',
				'minimum_days'   => null,
				'maximum_days'   => null,
				'start_weekdays' => null,
			),
		);
	}

	/**
	 * Return translated weekday records using the calendar's canonical 0-6 keys.
	 *
	 * @return array<int,array{value:string,label:string,short_label:string}> Weekday DTOs.
	 */
	public function get_weekdays() {
		$labels = array(
			'0' => __( 'Sunday', 'booking' ),
			'1' => __( 'Monday', 'booking' ),
			'2' => __( 'Tuesday', 'booking' ),
			'3' => __( 'Wednesday', 'booking' ),
			'4' => __( 'Thursday', 'booking' ),
			'5' => __( 'Friday', 'booking' ),
			'6' => __( 'Saturday', 'booking' ),
		);

		return array_map(
			static function ( $value, $label ) {
				return array(
					'value'       => (string) $value,
					'label'       => $label,
					'short_label' => function_exists( 'wpbc_get_weekday_short_name' ) ? wpbc_get_weekday_short_name( (int) $value ) : substr( $label, 0, 3 ),
				);
			},
			array_keys( $labels ),
			array_values( $labels )
		);
	}

	/**
	 * Return 15-minute time choices while retaining valid non-standard options.
	 *
	 * @param string $current_time Current normalized time.
	 *
	 * @return array<string,string> Labels keyed by canonical 24-hour time.
	 */
	public function get_time_options( $current_time = '' ) {
		$time_options = array();

		for ( $hour = 0; $hour < 24; $hour++ ) {
			foreach ( array( 0, 15, 30, 45 ) as $minute ) {
				$time                 = sprintf( '%02d:%02d', $hour, $minute );
				$time_options[ $time ] = function_exists( 'wpbc_time_localized' ) ? wpbc_time_localized( $time ) : $time;
			}
		}

		if ( '' !== $current_time && ! isset( $time_options[ $current_time ] ) && preg_match( '/^(?:[01]\d|2[0-3]):[0-5]\d$/', $current_time ) ) {
			$time_options[ $current_time ] = function_exists( 'wpbc_time_localized' ) ? wpbc_time_localized( $current_time ) : $current_time;
			ksort( $time_options );
		}

		return $time_options;
	}

	/**
	 * Validate one allow-listed date-selection draft field.
	 *
	 * @param string $field_id    Stable draft field identifier.
	 * @param mixed  $raw_value   Untrusted submitted or stored value.
	 * @param bool   $is_required Whether an empty value is invalid.
	 *
	 * @return string|WP_Error Normalized value or a validation error.
	 */
	public function validate_field( $field_id, $raw_value, $is_required ) {
		if ( ! is_scalar( $raw_value ) ) {
			return new WP_Error( 'wpbc_setup_wizard_date_selection_invalid', __( 'Choose a valid date-selection setting.', 'booking' ) );
		}

		$raw_value = trim( (string) $raw_value );
		if ( '' === $raw_value && ! $is_required ) {
			return '';
		}

		switch ( $field_id ) {
			case 'date_selection_mode':
				if ( ! in_array( $raw_value, array( 'single', 'multiple', 'dynamic', 'fixed' ), true ) ) {
					return new WP_Error( 'wpbc_setup_wizard_date_selection_mode_invalid', __( 'Choose an available date-selection mode.', 'booking' ) );
				}
				if ( 'fixed' === $raw_value && ! $this->supports_advanced_range_rules() ) {
					return new WP_Error( 'wpbc_setup_wizard_date_selection_mode_unavailable', __( 'Fixed range selection requires Booking Calendar Business Small or higher.', 'booking' ) );
				}

				return $raw_value;

			case 'date_selection_fixed_days':
				$validated_fixed_days = $this->validate_integer( $raw_value, 1, self::MAX_FIXED_DAYS, __( 'Enter a fixed range between 1 and 180 days.', 'booking' ) );
				if ( is_wp_error( $validated_fixed_days ) ) {
					return $validated_fixed_days;
				}

				return $this->validate_advanced_field_value( $field_id, $validated_fixed_days );

			case 'date_selection_dynamic_min':
			case 'date_selection_dynamic_max':
				$validated_integer = $this->validate_integer( $raw_value, 1, self::MAX_DYNAMIC_DAYS, __( 'Enter a flexible range between 1 and 1095 days.', 'booking' ) );
				if ( is_wp_error( $validated_integer ) ) {
					return $validated_integer;
				}

				return $this->validate_advanced_field_value( $field_id, $validated_integer );

			case 'date_selection_fixed_weekdays':
				$validated_fixed_weekdays = $this->validate_weekdays( $raw_value );
				if ( is_wp_error( $validated_fixed_weekdays ) ) {
					return $validated_fixed_weekdays;
				}

				return $this->validate_advanced_field_value( $field_id, $validated_fixed_weekdays );

			case 'date_selection_dynamic_weekdays':
				$validated_weekdays = $this->validate_weekdays( $raw_value );
				if ( is_wp_error( $validated_weekdays ) ) {
					return $validated_weekdays;
				}

				return $this->validate_advanced_field_value( $field_id, $validated_weekdays );

			case 'date_selection_dynamic_specific':
				$validated_specific_days = $this->validate_specific_days( $raw_value );
				if ( is_wp_error( $validated_specific_days ) ) {
					return $validated_specific_days;
				}

				return $this->validate_advanced_field_value( $field_id, $validated_specific_days );

			case 'date_selection_changeover_enabled':
			case 'date_selection_triangles':
			case 'date_selection_checkout_available':
				if ( ! in_array( $raw_value, array( 'On', 'Off' ), true ) ) {
					return new WP_Error( 'wpbc_setup_wizard_date_selection_toggle_invalid', __( 'Choose a valid on or off setting.', 'booking' ) );
				}
				return $this->validate_advanced_field_value( $field_id, $raw_value );

			case 'date_selection_recurrent_time':
			case 'date_selection_legend_enabled':
			case 'date_selection_legend_show_numbers':
			case 'date_selection_legend_vertical':
			case 'date_selection_legend_item_available':
			case 'date_selection_legend_item_pending':
			case 'date_selection_legend_item_approved':
			case 'date_selection_legend_item_partially':
			case 'date_selection_legend_item_unavailable':
				if ( ! in_array( $raw_value, array( 'On', 'Off' ), true ) ) {
					return new WP_Error( 'wpbc_setup_wizard_date_selection_toggle_invalid', __( 'Choose a valid on or off setting.', 'booking' ) );
				}

				return $raw_value;

			case 'date_selection_legend_text_available':
			case 'date_selection_legend_text_pending':
			case 'date_selection_legend_text_approved':
			case 'date_selection_legend_text_partially':
			case 'date_selection_legend_text_unavailable':
				$legend_text        = sanitize_text_field( $raw_value );
				$legend_text_length = function_exists( 'mb_strlen' ) ? mb_strlen( $legend_text ) : strlen( $legend_text );
				if ( $legend_text_length > 255 ) {
					return new WP_Error( 'wpbc_setup_wizard_date_selection_legend_text_invalid', __( 'Enter a calendar legend title with no more than 255 characters.', 'booking' ) );
				}

				return $legend_text;

			case 'date_selection_check_in_time':
			case 'date_selection_check_out_time':
				if ( ! preg_match( '/^(?:[01]\d|2[0-3]):[0-5]\d$/', $raw_value ) ) {
					return new WP_Error( 'wpbc_setup_wizard_date_selection_time_invalid', __( 'Choose a valid check-in or check-out time.', 'booking' ) );
				}

				return $this->validate_advanced_field_value( $field_id, $raw_value );
		}

		return new WP_Error( 'wpbc_setup_wizard_date_selection_field_unknown', __( 'The Date Selection editor received an unsupported field.', 'booking' ) );
	}

	/**
	 * Prevent lower editions from changing Business Small range-rule fields.
	 *
	 * The controls are disabled in the interface, but the server remains the
	 * authority. Their canonical values are still accepted because the complete
	 * draft contract is submitted on every navigation request.
	 *
	 * @param string $field_id        Stable draft field identifier.
	 * @param string $validated_value Already normalized candidate value.
	 *
	 * @return string|WP_Error Unchanged canonical value or an edition error.
	 */
	private function validate_advanced_field_value( $field_id, $validated_value ) {
		if ( $this->supports_advanced_range_rules() ) {
			return $validated_value;
		}

		$initial_values = $this->get_initial_values();
		if ( isset( $initial_values[ $field_id ] ) && $initial_values[ $field_id ] === $validated_value ) {
			return $validated_value;
		}

		return new WP_Error( 'wpbc_setup_wizard_date_selection_rule_unavailable', __( 'Advanced flexible range rules require Booking Calendar Business Small or higher.', 'booking' ) );
	}

	/**
	 * Validate and normalize a comma-delimited weekday list.
	 *
	 * @param string $raw_weekdays Candidate weekday list.
	 *
	 * @return string|WP_Error Canonical list or an error.
	 */
	private function validate_weekdays( $raw_weekdays ) {
		$raw_values = array_filter( array_map( 'trim', explode( ',', $raw_weekdays ) ), 'strlen' );

		if ( in_array( '-1', $raw_values, true ) ) {
			return '-1';
		}

		$weekdays = array();
		foreach ( $raw_values as $raw_weekday ) {
			if ( ! preg_match( '/^[0-6]$/', $raw_weekday ) ) {
				return new WP_Error( 'wpbc_setup_wizard_date_selection_weekdays_invalid', __( 'Choose one or more valid starting weekdays.', 'booking' ) );
			}
			$weekdays[] = (int) $raw_weekday;
		}

		$weekdays = array_values( array_unique( $weekdays ) );
		sort( $weekdays );

		return empty( $weekdays ) ? '-1' : implode( ',', $weekdays );
	}

	/**
	 * Normalize a stored weekday value without trusting its shape.
	 *
	 * @param mixed $raw_weekdays Stored weekday value.
	 *
	 * @return string Canonical list or unrestricted marker.
	 */
	private function normalize_weekdays( $raw_weekdays ) {
		$validated_weekdays = $this->validate_weekdays( is_scalar( $raw_weekdays ) ? (string) $raw_weekdays : '' );

		return is_wp_error( $validated_weekdays ) ? '-1' : $validated_weekdays;
	}

	/**
	 * Validate and expand a specific flexible-range length expression.
	 *
	 * The released setting accepts comma-separated values, ranges such as
	 * `3-5`, or a combination. The wizard stores the equivalent sorted comma
	 * list so the browser preview receives the same integer-list contract as
	 * the canonical calendar bootstrap without evaluating text as code.
	 *
	 * @param string $raw_specific_days Candidate comma/range expression.
	 *
	 * @return string|WP_Error Expanded comma list, an empty string, or an error.
	 */
	private function validate_specific_days( $raw_specific_days ) {
		$raw_specific_days = trim( sanitize_text_field( $raw_specific_days ) );
		if ( '' === $raw_specific_days ) {
			return '';
		}

		if ( strlen( $raw_specific_days ) > 500 || ! preg_match( '/^\d+(?:\s*-\s*\d+)?(?:\s*,\s*\d+(?:\s*-\s*\d+)?)*$/', $raw_specific_days ) ) {
			return new WP_Error( 'wpbc_setup_wizard_date_selection_specific_invalid', __( 'Enter specific day lengths as comma-separated numbers or ranges, for example 7,14,21,28 or 3-5.', 'booking' ) );
		}

		$specific_days = array();
		foreach ( explode( ',', $raw_specific_days ) as $specific_part ) {
			$range_bounds = array_map( 'intval', preg_split( '/\s*-\s*/', trim( $specific_part ) ) );
			$range_start  = min( $range_bounds );
			$range_end    = max( $range_bounds );

			if ( $range_start < 1 || $range_end > self::MAX_DYNAMIC_DAYS ) {
				return new WP_Error( 'wpbc_setup_wizard_date_selection_specific_invalid', __( 'Enter specific day lengths between 1 and 1095 days.', 'booking' ) );
			}

			for ( $specific_day = $range_start; $specific_day <= $range_end; $specific_day++ ) {
				$specific_days[] = $specific_day;
			}
		}

		$specific_days = array_values( array_unique( $specific_days ) );
		sort( $specific_days, SORT_NUMERIC );

		return implode( ',', $specific_days );
	}

	/**
	 * Normalize a stored specific-day expression without changing the option.
	 *
	 * @param mixed $raw_specific_days Stored candidate value.
	 *
	 * @return string Expanded safe comma list or an empty string.
	 */
	private function normalize_specific_days( $raw_specific_days ) {
		$validated_specific_days = $this->validate_specific_days( is_scalar( $raw_specific_days ) ? (string) $raw_specific_days : '' );

		return is_wp_error( $validated_specific_days ) ? '' : $validated_specific_days;
	}

	/**
	 * Validate one bounded integer and return its canonical string form.
	 *
	 * @param string $raw_value Candidate numeric value.
	 * @param int    $minimum   Inclusive lower bound.
	 * @param int    $maximum   Inclusive upper bound.
	 * @param string $message   Translated validation message.
	 *
	 * @return string|WP_Error Canonical integer string or an error.
	 */
	private function validate_integer( $raw_value, $minimum, $maximum, $message ) {
		if ( ! preg_match( '/^\d+$/', $raw_value ) ) {
			return new WP_Error( 'wpbc_setup_wizard_date_selection_number_invalid', $message );
		}

		$integer_value = (int) $raw_value;
		if ( $integer_value < $minimum || $integer_value > $maximum ) {
			return new WP_Error( 'wpbc_setup_wizard_date_selection_number_invalid', $message );
		}

		return (string) $integer_value;
	}

	/**
	 * Normalize a possibly missing bounded integer.
	 *
	 * @param mixed $raw_value Candidate numeric value.
	 * @param int   $minimum   Inclusive lower bound.
	 * @param int   $maximum   Inclusive upper bound.
	 * @param int   $fallback  Value used when the candidate is invalid.
	 *
	 * @return int Normalized integer.
	 */
	private function normalize_bounded_integer( $raw_value, $minimum, $maximum, $fallback ) {
		$integer_value = is_scalar( $raw_value ) && preg_match( '/^\d+$/', (string) $raw_value ) ? (int) $raw_value : $fallback;

		return min( $maximum, max( $minimum, $integer_value ) );
	}

	/**
	 * Normalize a stored 24-hour time without changing the option.
	 *
	 * @param mixed  $raw_time Candidate time.
	 * @param string $fallback Valid fallback time.
	 *
	 * @return string Canonical time.
	 */
	private function normalize_time( $raw_time, $fallback ) {
		$raw_time = is_scalar( $raw_time ) ? trim( (string) $raw_time ) : '';

		return preg_match( '/^(?:[01]\d|2[0-3]):[0-5]\d$/', $raw_time ) ? $raw_time : $fallback;
	}

	/**
	 * Normalize a stored calendar-legend title without changing the option.
	 *
	 * @param mixed $raw_text Stored legend title.
	 *
	 * @return string Safe draft legend title.
	 */
	private function normalize_legend_text( $raw_text ) {
		$legend_text = is_scalar( $raw_text ) ? sanitize_text_field( (string) $raw_text ) : '';

		return function_exists( 'mb_substr' ) ? mb_substr( $legend_text, 0, 255 ) : substr( $legend_text, 0, 255 );
	}
}
