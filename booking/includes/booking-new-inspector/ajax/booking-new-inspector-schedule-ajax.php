<?php
/**
 * AJAX transport for Add New Booking Inspector schedule reads.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return one authorized creation schedule and native availability contract.
 *
 * This authenticated-only endpoint performs no booking persistence, review,
 * apply, email, Activity, or Date Editor endpoint call.
 *
 * @return void
 */
function wpbc_booking_new_inspector_ajax_schedule() {
	$nonce = isset( $_POST['nonce'] ) && is_scalar( $_POST['nonce'] )
		? sanitize_text_field( wp_unslash( $_POST['nonce'] ) )
		: '';

	$request_values = null;
	if ( isset( $_POST['request'] ) && is_scalar( $_POST['request'] ) ) {
		$encoded_request = wp_unslash( (string) $_POST['request'] );
		$request_limits  = WPBC_Booking_New_Inspector_Config::get_action_request_limits();
		if ( $request_limits[ WPBC_Booking_New_Inspector_Config::ACTION_SCHEDULE ] >= strlen( $encoded_request ) ) {
			$decoded_request = json_decode( $encoded_request, true );
			$request_values  = is_array( $decoded_request ) ? $decoded_request : null;
		}
	}

	$endpoint = new WPBC_Booking_New_Inspector_Schedule_Endpoint();
	$result   = $endpoint->process( $request_values, $nonce );
	if ( is_wp_error( $result ) ) {
		$error_data = $result->get_error_data();
		$status     = is_array( $error_data ) && ! empty( $error_data['status'] ) ? absint( $error_data['status'] ) : 400;
		$request_id = is_array( $request_values ) && isset( $request_values['request_id'] ) ? $request_values['request_id'] : '';
		wp_send_json_error( $endpoint->get_error_dto( $result, $request_id ), $status );
	}

	wp_send_json_success( $result );
}
