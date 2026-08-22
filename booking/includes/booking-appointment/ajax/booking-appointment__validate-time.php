<?php
/**
 * Public read-only Appointment time preflight endpoint.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Read and validate selected SQL dates from an Appointment preflight request.
 *
 * @return array<int,string>|WP_Error Unique YYYY-MM-DD dates or an error.
 */
function wpbc_booking_appointment_get_preflight_dates() {
	$raw_dates = isset( $_POST['dates'] ) && is_array( $_POST['dates'] ) ? wp_unslash( $_POST['dates'] ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	if ( empty( $raw_dates ) || count( $raw_dates ) > 31 ) {
		return new WP_Error( 'appointment_dates_invalid', __( 'Select a valid appointment date and try again.', 'booking' ) );
	}

	$dates = array();
	foreach ( $raw_dates as $raw_date ) {
		if ( is_array( $raw_date ) ) {
			return new WP_Error( 'appointment_dates_invalid', __( 'Select a valid appointment date and try again.', 'booking' ) );
		}
		$date = sanitize_text_field( $raw_date );
		$date_parts = array_map( 'absint', explode( '-', $date ) );
		if ( $date !== wpbc_sanitize_date( $date ) || 3 !== count( $date_parts ) || ! checkdate( $date_parts[1], $date_parts[2], $date_parts[0] ) ) {
			return new WP_Error( 'appointment_dates_invalid', __( 'Select a valid appointment date and try again.', 'booking' ) );
		}
		$dates[] = $date;
	}

	$dates = array_values( array_unique( $dates ) );
	sort( $dates );
	$first_date = strtotime( reset( $dates ) . ' 00:00:00 UTC' );
	$last_date  = strtotime( end( $dates ) . ' 00:00:00 UTC' );
	if ( false === $first_date || false === $last_date || ( $last_date - $first_date ) > YEAR_IN_SECONDS ) {
		return new WP_Error( 'appointment_dates_invalid', __( 'Select appointment dates within one year and try again.', 'booking' ) );
	}

	return $dates;
}

/**
 * Convert one strict browser start-time value to seconds in the day.
 *
 * @return int|WP_Error Start time in seconds, including zero for midnight.
 */
function wpbc_booking_appointment_get_preflight_start_seconds( $start_time = null ) {
	if ( null === $start_time ) {
		$start_time = isset( $_POST['start_time'] ) && ! is_array( $_POST['start_time'] ) ? sanitize_text_field( wp_unslash( $_POST['start_time'] ) ) : '';
	} else {
		$start_time = is_scalar( $start_time ) ? sanitize_text_field( (string) $start_time ) : '';
	}
	if ( ! preg_match( '/^(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/', $start_time ) ) {
		return new WP_Error( 'appointment_start_time_invalid', __( 'Select a valid start time and try again.', 'booking' ) );
	}

	$parts = array_map( 'absint', explode( ':', $start_time ) );
	return ( $parts[0] * HOUR_IN_SECONDS ) + ( $parts[1] * MINUTE_IN_SECONDS ) + ( isset( $parts[2] ) ? $parts[2] : 0 );
}

/**
 * Read a bounded list of Start Time options for one bulk availability pass.
 *
 * @return string[]|WP_Error Unique strict browser time values or an error.
 */
function wpbc_booking_appointment_get_preflight_start_times() {
	$raw_times = isset( $_POST['start_times'] ) && is_array( $_POST['start_times'] ) ? wp_unslash( $_POST['start_times'] ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	if ( empty( $raw_times ) || count( $raw_times ) > 1440 ) {
		return new WP_Error( 'appointment_start_times_invalid', __( 'Available start times could not be checked. Reload the page and try again.', 'booking' ) );
	}

	$start_times = array();
	foreach ( $raw_times as $raw_time ) {
		$start_seconds = wpbc_booking_appointment_get_preflight_start_seconds( $raw_time );
		if ( is_wp_error( $start_seconds ) ) {
			return $start_seconds;
		}
		$start_times[] = sanitize_text_field( (string) $raw_time );
	}

	return array_values( array_unique( $start_times ) );
}

/**
 * Evaluate one start time against Service duration and preloaded intervals.
 *
 * @param array                    $service            Effective Service values.
 * @param string[]                 $dates              Selected SQL dates.
 * @param string                   $start_time         Strict browser time value.
 * @param int                      $maximum_duration   Maximum allowed duration in minutes.
 * @param array<int,array<string,int>> $existing_intervals Existing Provider intervals.
 *
 * @return array<string,mixed> Public, non-sensitive validation result.
 */
function wpbc_booking_appointment_validate_one_start_time( $service, $dates, $start_time, $maximum_duration, $existing_intervals ) {
	$start_seconds = wpbc_booking_appointment_get_preflight_start_seconds( $start_time );
	if ( is_wp_error( $start_seconds ) ) {
		return array( 'valid' => false, 'message' => $start_seconds->get_error_message(), 'code' => $start_seconds->get_error_code() );
	}

	$end_seconds = wpbc_appointment_services_resolve_end_seconds( $service, $start_seconds, $maximum_duration );
	if ( is_wp_error( $end_seconds ) ) {
		return array( 'valid' => false, 'message' => $end_seconds->get_error_message(), 'code' => $end_seconds->get_error_code() );
	}

	$buffer_check = wpbc_appointment_services_check_buffer_conflicts_in_intervals( $service, $dates, array( $start_seconds, $end_seconds ), $existing_intervals );
	if ( is_wp_error( $buffer_check ) ) {
		return array(
			'valid'      => false,
			'message'    => $buffer_check->get_error_message(),
			'code'       => $buffer_check->get_error_code(),
			'start_time' => sanitize_text_field( $start_time ),
			'end_time'   => wpbc_transform__seconds__in__24_hours_his( $end_seconds ),
		);
	}

	return array(
		'valid'    => true,
		'message'  => '',
		'code'     => '',
		'start_time' => sanitize_text_field( $start_time ),
		'end_time' => wpbc_transform__seconds__in__24_hours_his( $end_seconds ),
	);
}

/**
 * Validate a selected Appointment time with the same Service rules as save.
 *
 * Expected scheduling conflicts return HTTP 200 with `valid: false`; invalid
 * or tampered request context remains a controlled HTTP error.
 *
 * @return void Terminates with a JSON response.
 */
function wpbc_booking_appointment_ajax_validate_time() {
	if ( false === check_ajax_referer( 'wpbc_booking_appointment_ajax', 'nonce', false ) ) {
		wp_send_json_error( array( 'message' => __( 'Security check failed. Reload the page and try again.', 'booking' ) ), 403 );
	}

	$service_id    = isset( $_POST['service_id'] ) && ! is_array( $_POST['service_id'] ) ? absint( wp_unslash( $_POST['service_id'] ) ) : 0;
	$provider_id   = isset( $_POST['provider_id'] ) && ! is_array( $_POST['provider_id'] ) ? absint( wp_unslash( $_POST['provider_id'] ) ) : 0;
	$context_token = isset( $_POST['context_token'] ) && ! is_array( $_POST['context_token'] ) ? sanitize_text_field( wp_unslash( $_POST['context_token'] ) ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$context_check  = wpbc_booking_appointment_validate_submission_context( $context_token, $service_id, $provider_id );
	if ( is_wp_error( $context_check ) ) {
		wp_send_json_error( array( 'message' => $context_check->get_error_message(), 'code' => $context_check->get_error_code() ), 400 );
	}

	$dates = wpbc_booking_appointment_get_preflight_dates();
	if ( is_wp_error( $dates ) ) {
		$error = $dates;
		wp_send_json_error( array( 'message' => $error->get_error_message(), 'code' => $error->get_error_code() ), 400 );
	}

	$service = wpbc_appointment_services_repository()->find_active_for_resource( $service_id, $provider_id );
	if ( is_wp_error( $service ) ) {
		wp_send_json_error( array( 'message' => $service->get_error_message(), 'code' => $service->get_error_code() ), 400 );
	}

	$maximum_duration   = absint( apply_filters( 'wpbc_booking_appointment_maximum_duration_minutes', 24 * 60, $context_check ) );
	$existing_intervals = wpbc_appointment_services_get_existing_buffer_intervals( $provider_id, $dates );

	if ( isset( $_POST['start_times'] ) ) {
		$start_times = wpbc_booking_appointment_get_preflight_start_times();
		if ( is_wp_error( $start_times ) ) {
			wp_send_json_error( array( 'message' => $start_times->get_error_message(), 'code' => $start_times->get_error_code() ), 400 );
		}

		$slots = array();
		foreach ( $start_times as $start_time ) {
			$slots[ $start_time ] = wpbc_booking_appointment_validate_one_start_time( $service, $dates, $start_time, $maximum_duration, $existing_intervals );
		}
		wp_send_json_success(
			array(
				'valid'         => true,
				'slots'         => $slots,
				'duration'      => absint( $service['duration_minutes'] ),
				'buffer_before' => absint( $service['buffer_before_minutes'] ),
				'buffer_after'  => absint( $service['buffer_after_minutes'] ),
			)
		);
	}

	$start_time = isset( $_POST['start_time'] ) && ! is_array( $_POST['start_time'] ) ? sanitize_text_field( wp_unslash( $_POST['start_time'] ) ) : '';
	$result     = wpbc_booking_appointment_validate_one_start_time( $service, $dates, $start_time, $maximum_duration, $existing_intervals );
	if ( empty( $result['valid'] ) ) {
		wp_send_json_success( $result );
	}

	wp_send_json_success(
		array_merge(
			$result,
			array(
			'duration'      => absint( $service['duration_minutes'] ),
			'buffer_before' => absint( $service['buffer_before_minutes'] ),
			'buffer_after'  => absint( $service['buffer_after_minutes'] ),
			)
		)
	);
}
add_action( 'wp_ajax_nopriv_WPBC_AJX_BOOKING_APPOINTMENT_VALIDATE_TIME', 'wpbc_booking_appointment_ajax_validate_time' );
add_action( 'wp_ajax_WPBC_AJX_BOOKING_APPOINTMENT_VALIDATE_TIME', 'wpbc_booking_appointment_ajax_validate_time' );
