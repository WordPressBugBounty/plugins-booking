<?php
/**
 * Authenticated lazy transport for Timeline unavailable-background data.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_ajax_wpbc_timeline_read_availability', 'wpbc_timeline_unavailable_days_bg_ajax_read' );

/**
 * Return one authorized, bounded Availability projection as data-only JSON.
 *
 * The endpoint accepts only presentation-window values and candidate Resource
 * IDs. It never accepts owner, user, blog, site, edition, template, or storage
 * authority. The Timeline read facade reloads every Resource through the
 * current-site authorized repository before any domain projection runs.
 *
 * @return void
 */
function wpbc_timeline_unavailable_days_bg_ajax_read() {
	if ( false === check_ajax_referer( 'wpbc_timeline_read', 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_availability_nonce_invalid',
				'message' => __( 'The Timeline Availability request expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}

	$authorization = new WPBC_Timeline_Authorization();
	if ( ! $authorization->current_user_can_view() ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_availability_forbidden',
				'message' => __( 'Timeline Availability access is unavailable for this account.', 'booking' ),
			),
			403
		);
	}

	$request_values = wpbc_timeline_unavailable_days_bg_get_ajax_request( wp_unslash( $_POST ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$result         = ( new WPBC_Timeline_Read_Operations( $authorization ) )->get_availability( $request_values );
	if ( is_wp_error( $result ) ) {
		wpbc_timeline_unavailable_days_bg_send_ajax_error( $result );
	}

	wp_send_json_success( $result );
}

/**
 * Copy the documented Availability read fields from an untrusted payload.
 *
 * Resource IDs remain untrusted candidate identifiers. The parser keeps at
 * most one more than the configured limit so the read facade can reject an
 * oversized request explicitly without processing an unbounded collection.
 *
 * @param mixed $request_payload Untrusted AJAX payload.
 *
 * @return array<string,mixed> Explicit Availability request values.
 */
function wpbc_timeline_unavailable_days_bg_get_ajax_request( $request_payload ) {
	$request_payload = is_array( $request_payload ) ? $request_payload : array();
	$request_values  = array();
	$scalar_fields   = array( 'anchor_date', 'anchor_at', 'anchor_ratio', 'window_days', 'window_months', 'window_position', 'view', 'request_generation' );

	foreach ( $scalar_fields as $field_name ) {
		if ( isset( $request_payload[ $field_name ] ) && is_scalar( $request_payload[ $field_name ] ) ) {
			$request_values[ $field_name ] = sanitize_text_field( (string) $request_payload[ $field_name ] );
		}
	}

	if ( array_key_exists( 'resource_ids', $request_payload ) ) {
		if ( ! is_array( $request_payload['resource_ids'] ) ) {
			$request_values['resource_ids'] = sanitize_text_field( (string) $request_payload['resource_ids'] );
			return $request_values;
		}

		$maximum_resources = absint( wpbc_timeline_get_configuration()['limits']['maximum_resources'] );
		$candidate_ids     = array_slice( $request_payload['resource_ids'], 0, $maximum_resources + 1 );
		$request_values['resource_ids'] = array_map(
			'absint',
			array_filter( $candidate_ids, 'is_scalar' )
		);
	}

	return $request_values;
}

/**
 * Send a safe Availability read error without exposing query or rule details.
 *
 * Only documented numeric budget hints are returned. SQL, paths, stored rules,
 * owner identifiers, and untrusted request values never cross this boundary.
 *
 * @param WP_Error $error Availability-domain error.
 *
 * @return void
 */
function wpbc_timeline_unavailable_days_bg_send_ajax_error( $error ) {
	$error_data       = $error->get_error_data();
	$status           = is_array( $error_data ) && isset( $error_data['status'] ) ? absint( $error_data['status'] ) : 400;
	$allowed_details  = array(
		'axis_buckets',
		'query_count',
		'segment_count',
		'interval_count',
		'raw_json_bytes',
		'maximum_window_days',
		'maximum_axis_buckets',
		'maximum_resources',
		'maximum_projection_booking_ids',
		'maximum_projection_date_rows',
		'maximum_segments',
		'maximum_intervals',
		'maximum_queries',
		'maximum_json_bytes',
		'suggested_window_days',
		'suggested_resources',
	);
	$response_details = array();

	if ( is_array( $error_data ) ) {
		foreach ( $allowed_details as $detail_key ) {
			if ( isset( $error_data[ $detail_key ] ) && is_numeric( $error_data[ $detail_key ] ) ) {
				$response_details[ $detail_key ] = absint( $error_data[ $detail_key ] );
			}
		}
	}

	wp_send_json_error(
		array(
			'code'    => sanitize_key( $error->get_error_code() ),
			'message' => sanitize_text_field( $error->get_error_message() ),
			'details' => $response_details,
		),
		$status
	);
}
