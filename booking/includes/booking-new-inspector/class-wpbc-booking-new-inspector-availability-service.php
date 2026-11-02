<?php
/**
 * Canonical creation availability for Add New Booking Inspector review.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolves current non-mutating allocation through the released create allocator.
 */
final class WPBC_Booking_New_Inspector_Availability_Service {

	/**
	 * Resolve current availability, capacity, and exact Resource allocation.
	 *
	 * @param array<string,mixed> $context Server-authoritative draft context.
	 * @return array<string,mixed>|WP_Error Normalized allocation and revision or safe error.
	 */
	public function resolve( $context ) {
		if (
			! is_array( $context )
			|| empty( $context['resource']['id'] )
			|| empty( $context['canonical_form_data'] )
			|| empty( $context['schedule'] )
			|| ! function_exists( 'wpbc__where_to_save_booking' )
			|| ! function_exists( 'wpbc_get_parsed_booking_data_arr' )
			|| ! function_exists( 'wpbc_get__how_many_items_to_book__in_booking_form' )
		) {
			return $this->get_unavailable_error();
		}

		$resource_id          = absint( $context['resource']['id'] );
		$schedule             = $context['schedule'];
		$structured_fields    = wpbc_get_parsed_booking_data_arr( $context['canonical_form_data'], $resource_id, array( 'get' => 'value' ) );
		$quantity             = max( 1, absint( wpbc_get__how_many_items_to_book__in_booking_form( $structured_fields, $resource_id ) ) );
		$time_override_source = WPBC_Booking_New_Inspector_Schedule_Policy::resolve_time_override_source(
			(string) $schedule['time_application']
		);
		$time_seconds         = 'full_day' === $schedule['time_application']
			? array( 0, 24 * 60 * 60 )
			: array( $this->time_to_seconds( $schedule['start_time'] ), $this->time_to_seconds( $schedule['end_time'] ) );

		$previous_owner_context = $this->activate_owner_context( isset( $context['resource']['owner_user_id'] ) ? $context['resource']['owner_user_id'] : 0 );
		try {
			$where_to_save = wpbc__where_to_save_booking(
				array(
					'resource_id'                   => $resource_id,
					'skip_booking_id'               => 0,
					'dates_only_sql_arr'            => array_values( $schedule['selected_dates'] ),
					'time_as_seconds_arr'           => $time_seconds,
					'how_many_items_to_book'        => $quantity,
					'request_uri'                   => '',
					'allow_past'                    => WPBC_Booking_New_Inspector_Schedule_Policy::permits_past_dates(),
					'is_use_booking_recurrent_time' => 'per_date' === $schedule['time_application'],
					'time_override_source'          => $time_override_source,
					'as_single_resource'            => false,
					'aggregate_resource_id_arr'     => array(),
					'aggregate_type'                => 'all',
					'custom_form'                   => (string) $context['form']['id'],
				)
			);
			$policy_snapshot = $this->get_current_policy_snapshot();
		} finally {
			$this->restore_owner_context( $previous_owner_context );
		}

		if ( ! is_array( $where_to_save ) || 'ok' !== ( isset( $where_to_save['result'] ) ? $where_to_save['result'] : '' ) ) {
			$message = is_array( $where_to_save ) && isset( $where_to_save['message'] )
				? wp_strip_all_tags( (string) $where_to_save['message'] )
				: __( 'The selected dates or times are unavailable. Choose another schedule and try again.', 'booking' );

			return new WP_Error( 'wpbc_booking_new_inspector_unavailable', $message, array( 'status' => 409 ) );
		}

		$resources_in_dates = array();
		foreach ( (array) $where_to_save['resources_in_dates'] as $booking_date => $allocated_resource_ids ) {
			$booking_date = sanitize_text_field( (string) $booking_date );
			$allocated_resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $allocated_resource_ids ) ) ) );
			sort( $allocated_resource_ids, SORT_NUMERIC );
			$resources_in_dates[ $booking_date ] = $allocated_resource_ids;
		}
		ksort( $resources_in_dates, SORT_STRING );
		$allocation = array(
			'main_resource_id'  => absint( $where_to_save['main__resource_id'] ),
			'resources_in_dates' => $resources_in_dates,
			'quantity'           => $quantity,
			'time_seconds'       => $time_seconds,
		);
		$revision_context = array(
			'allocation' => $allocation,
			'schedule'   => $schedule,
			'policy'     => $policy_snapshot,
		);

		return array(
			'allocation'            => $allocation,
			'availability_revision' => $this->fingerprint( 'availability', $revision_context ),
		);
	}

	/**
	 * Convert strict exact-minute time to seconds after midnight.
	 *
	 * @param string $time_value Strict HH:MM time.
	 * @return int Seconds after midnight.
	 */
	private function time_to_seconds( $time_value ) {
		$time_parts = array_map( 'intval', explode( ':', (string) $time_value ) );

		return ( $time_parts[0] * 60 * 60 ) + ( $time_parts[1] * 60 );
	}

	/**
	 * Return bounded current rule values that influence allocator behavior.
	 *
	 * @return array<string,mixed> JSON-safe policy snapshot.
	 */
	private function get_current_policy_snapshot() {
		$selection_policy = function_exists( 'wpbc__calendar__js_params__get_days_selection_arr' )
			? wpbc__calendar__js_params__get_days_selection_arr()
			: array();
		$option_names = array(
			'booking_recurrent_time',
			'booking_unavailable_days_num_from_today',
			'booking_available_days_num_from_today',
			'booking_check_out_available_for_parents',
		);
		$options = array();
		foreach ( $option_names as $option_name ) {
			$options[ $option_name ] = function_exists( 'get_bk_option' ) ? get_bk_option( $option_name ) : null;
		}

		return array(
			'selection'  => is_array( $selection_policy ) ? $selection_policy : array(),
			'options'    => $options,
			'allow_past' => WPBC_Booking_New_Inspector_Schedule_Policy::permits_past_dates(),
		);
	}

	/**
	 * Build a site-secret HMAC for one authoritative revision.
	 *
	 * @param string $purpose Stable fingerprint namespace.
	 * @param mixed  $context JSON-safe context values.
	 * @return string Lowercase hexadecimal HMAC.
	 */
	private function fingerprint( $purpose, $context ) {
		$encoded = wp_json_encode( $context );

		return hash_hmac( 'sha256', 'wpbc_booking_new_inspector_' . sanitize_key( $purpose ) . ':v1:' . ( is_string( $encoded ) ? $encoded : '' ), wp_salt( 'nonce' ) );
	}

	/**
	 * Activate one authorized MultiUser owner for canonical option lookups.
	 *
	 * @param int $owner_user_id Owner WordPress user ID.
	 * @return mixed Previous environment token.
	 */
	private function activate_owner_context( $owner_user_id ) {
		if ( ! class_exists( 'wpdev_bk_multiuser' ) || ! absint( $owner_user_id ) ) {
			return null;
		}
		$previous_owner_context = apply_bk_filter( 'get_client_side_active_params_of_user' );
		make_bk_action( 'check_multiuser_params_for_client_side_by_user_id', absint( $owner_user_id ) );

		return $previous_owner_context;
	}

	/**
	 * Restore the exact prior MultiUser environment.
	 *
	 * @param mixed $previous_owner_context Previous environment token.
	 * @return void
	 */
	private function restore_owner_context( $previous_owner_context ) {
		if ( class_exists( 'wpdev_bk_multiuser' ) && null !== $previous_owner_context ) {
			make_bk_action( 'wpbc_mu_set_environment_for_user', $previous_owner_context );
		}
	}

	/**
	 * Return a safe error when the canonical allocator is unavailable.
	 *
	 * @return WP_Error Safe availability error.
	 */
	private function get_unavailable_error() {
		return new WP_Error(
			'wpbc_booking_new_inspector_availability_unavailable',
			__( 'Current availability could not be verified. Open the full Add Booking page and try again.', 'booking' ),
			array( 'status' => 409 )
		);
	}
}
