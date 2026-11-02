<?php
/**
 * Shared native Booking Calendar contract construction.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build executable-free initialization data for the canonical native calendar.
 *
 * Callers must authorize the Resource, form, booking hash, and selected dates
 * before invoking this builder. The builder owns no booking authorization,
 * availability decision, saved state, browser lifecycle, or mutation. Native
 * calendar AJAX remains authoritative for bookings, availability, capacity,
 * seasons, changeover, and Appointment restrictions.
 *
 * @since 12.0.0
 */
final class WPBC_Booking_Native_Calendar_Contract_Builder {

	/**
	 * Determine whether the authenticated native administration calendar permits past dates.
	 *
	 * This is a server-owned Add/Edit Booking policy. Browser requests may consume
	 * the result but cannot broaden it.
	 *
	 * @return bool True because the native administration calendar exposes its bounded past-date range.
	 */
	public static function permits_past_dates() {
		return true;
	}

	/**
	 * Build canonical markup and bounded native-calendar initialization values.
	 *
	 * @param int               $resource_id    Authorized primary Resource ID.
	 * @param string            $booking_hash   Authorized booking hash used to exclude an existing booking, or an empty string for creation.
	 * @param string            $custom_form    Exact authorized form key or `standard`.
	 * @param array<int,string> $selected_dates       Exact normalized selected dates.
	 * @param string            $calendar_anchor_date Optional presentation-only YYYY-MM-DD month anchor used when no dates are selected.
	 * @return array<string,mixed> Executable-free native calendar contract.
	 */
	public function build( $resource_id, $booking_hash, $custom_form, $selected_dates, $calendar_anchor_date = '' ) {
		$policy_parameters = $this->get_native_policy_parameters( $resource_id, $selected_dates, $calendar_anchor_date );
		$allow_past        = self::permits_past_dates() ? 1 : 0;
		$allow_past_args   = array(
			'allow_past'   => $allow_past,
			'booking_hash' => $booking_hash,
		);
		$allow_past_arr    = class_exists( 'WPBC_Add_Booking_Component' )
			? WPBC_Add_Booking_Component::get_allow_past_min_date_arr( $allow_past_args )
			: array();

		return array(
			'html'                => wpbc_pre_get_calendar_html( $resource_id, 1, array() ),
			'calendar_parameters' => $policy_parameters,
			'policy_parameters'   => $policy_parameters,
			'context_parameters'  => array(
				'this_page_booking_hash'   => $booking_hash,
				'this_page_allow_past'     => $allow_past,
				'this_page_allow_past_arr' => array_values( array_map( 'intval', (array) $allow_past_arr ) ),
			),
			'secure_parameters'   => array(
				'nonce'   => wp_create_nonce( 'wpbc_calendar_load_ajx_wpbcnonce' ),
				'user_id' => (string) ( function_exists( 'wpbc_get_current_user_id' ) ? wpbc_get_current_user_id() : get_current_user_id() ),
				'locale'  => (string) get_user_locale(),
			),
			'request_parameters'  => array(
				'resource_id'                  => $resource_id,
				'booking_hash'                 => $booking_hash,
				'request_uri'                  => '',
				'custom_form'                  => $custom_form,
				'allow_past'                   => $allow_past,
				'aggregate_resource_id_str'    => '',
				'aggregate_type'               => 'all',
				'skip_general_availability'    => 0,
				'classic_booking_context_token' => '',
			),
		);
	}

	/**
	 * Return native calendar policy values as an explicit allow-listed record.
	 *
	 * @param int               $resource_id    Authorized primary Resource ID.
	 * @param array<int,string> $selected_dates       Exact normalized selected dates.
	 * @param string            $calendar_anchor_date Optional presentation-only YYYY-MM-DD month anchor.
	 * @return array<string,mixed> Native values accepted by the private browser adapter.
	 */
	private function get_native_policy_parameters( $resource_id, $selected_dates, $calendar_anchor_date = '' ) {
		$days_selection = function_exists( 'wpbc__calendar__js_params__get_days_selection_arr' )
			? wpbc__calendar__js_params__get_days_selection_arr()
			: array();
		$days_select_mode = isset( $days_selection['days_select_mode'] )
			? sanitize_key( (string) $days_selection['days_select_mode'] )
			: 'multiple';
		if ( ! in_array( $days_select_mode, array( 'single', 'multiple', 'fixed', 'dynamic' ), true ) ) {
			$days_select_mode = 'multiple';
		}

		$calendar_anchor_date = is_scalar( $calendar_anchor_date ) ? trim( (string) $calendar_anchor_date ) : '';
		if ( ! preg_match( '/^(\d{4})-(\d{2})-(\d{2})$/', $calendar_anchor_date, $anchor_parts ) || ! checkdate( (int) $anchor_parts[2], (int) $anchor_parts[3], (int) $anchor_parts[1] ) ) {
			$calendar_anchor_date = '';
		}
		$first_date = ! empty( $selected_dates ) ? reset( $selected_dates ) : $calendar_anchor_date;
		$scroll_to  = preg_match( '/^(\d{4})-(\d{2})-\d{2}$/', (string) $first_date, $date_parts )
			? array( (int) $date_parts[1], (int) $date_parts[2] )
			: false;
		$fixed_week_days = isset( $days_selection['fixed__week_days__start'] )
			? $days_selection['fixed__week_days__start']
			: '-1';
		$dynamic_specific_days = isset( $days_selection['dynamic__days_specific'] )
			? $days_selection['dynamic__days_specific']
			: '';
		$dynamic_week_days = isset( $days_selection['dynamic__week_days__start'] )
			? $days_selection['dynamic__week_days__start']
			: '-1';
		$is_range_guidance_enabled = function_exists( 'wpbc_frontend_messages__is_enabled' )
			? (bool) wpbc_frontend_messages__is_enabled( 'message_range_selection_click_last_date' )
			: true;

		$parameters = array(
			'is_enabled_change_over'           => function_exists( 'wpbc_is_booking_used_check_in_out_time' )
				? (bool) wpbc_is_booking_used_check_in_out_time( false, $resource_id )
				: false,
			'calendar_scroll_to'                => $scroll_to,
			'calendar_dates_start'              => '',
			'calendar_dates_end'                => '',
			'booking_max_monthes_in_calendar'   => sanitize_text_field( (string) get_bk_option( 'booking_max_monthes_in_calendar' ) ),
			'booking_start_day_weeek'           => sanitize_text_field( (string) get_bk_option( 'booking_start_day_weeek' ) ),
			'calendar_number_of_months'         => '1',
			'days_select_mode'                  => $days_select_mode,
			'fixed__days_num'                   => isset( $days_selection['fixed__days_num'] )
				? max( 1, min( 180, absint( $days_selection['fixed__days_num'] ) ) )
				: 1,
			'fixed__week_days__start'           => $this->normalize_integer_list( $fixed_week_days, -1, 6 ),
			'dynamic__days_min'                 => isset( $days_selection['dynamic__days_min'] )
				? max( 1, absint( $days_selection['dynamic__days_min'] ) )
				: 1,
			'dynamic__days_max'                 => isset( $days_selection['dynamic__days_max'] )
				? absint( $days_selection['dynamic__days_max'] )
				: 0,
			'dynamic__days_specific'            => $this->normalize_integer_list( $dynamic_specific_days, 1, 180 ),
			'dynamic__week_days__start'         => $this->normalize_integer_list( $dynamic_week_days, -1, 6 ),
			'range_selection_guidance_is_enabled' => $is_range_guidance_enabled,
			'booking_date_format'               => sanitize_text_field( (string) get_bk_option( 'booking_date_format' ) ),
			'booking_time_format'               => sanitize_text_field( (string) get_bk_option( 'booking_time_format' ) ),
		);

		$parameters['range_selection_guidance_is_enabled'] = (bool) apply_filters(
			'wpbc_calendar_range_selection_guidance_is_enabled',
			$parameters['range_selection_guidance_is_enabled'],
			$resource_id,
			array(
				'resource_id'               => $resource_id,
				'calendar_number_of_months' => 1,
			)
		);

		if ( class_exists( 'wpdev_bk_biz_l' ) ) {
			$parameters['is_parent_resource'] = function_exists( 'wpbc_get_child_resources_number' )
				&& wpbc_get_child_resources_number( $resource_id ) ? 1 : 0;
			$parameters['booking_capacity_field'] = function_exists( 'wpbc_get__booking_capacity_field__name' )
				? sanitize_key( (string) wpbc_get__booking_capacity_field__name() )
				: '';
			$parameters['booking_is_dissbale_booking_for_different_sub_resources'] = sanitize_text_field(
				(string) get_bk_option( 'booking_is_dissbale_booking_for_different_sub_resources' )
			);
		}
		if ( class_exists( 'wpdev_bk_biz_s' ) ) {
			$parameters['booking_recurrent_time'] = sanitize_text_field( (string) get_bk_option( 'booking_recurrent_time' ) );
		}

		return $parameters;
	}

	/**
	 * Normalize one legacy comma-separated integer list for the native calendar.
	 *
	 * @param mixed $list_value Candidate comma-separated value or array.
	 * @param int   $minimum    Lowest accepted integer.
	 * @param int   $maximum    Highest accepted integer.
	 * @return array<int,int> Ordered unique bounded integers.
	 */
	private function normalize_integer_list( $list_value, $minimum, $maximum ) {
		$list_values = is_array( $list_value ) ? $list_value : explode( ',', (string) $list_value );
		$normalized  = array();
		foreach ( $list_values as $list_entry ) {
			if ( ! is_scalar( $list_entry ) || ! preg_match( '/^-?\d+$/', trim( (string) $list_entry ) ) ) {
				continue;
			}

			$list_entry = (int) $list_entry;
			if ( $list_entry >= $minimum && $list_entry <= $maximum ) {
				$normalized[ $list_entry ] = $list_entry;
			}
		}

		return array_values( $normalized );
	}
}
