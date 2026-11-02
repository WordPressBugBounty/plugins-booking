<?php
/**
 * AJAX transport for Add New Booking Inspector Apply.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Apply one signed reviewed plan through the canonical lifecycle.
 *
 * @return void
 */
function wpbc_booking_new_inspector_ajax_apply() {
	$nonce          = isset( $_POST['nonce'] ) && is_scalar( $_POST['nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['nonce'] ) ) : '';
	$request_values = null;
	if ( isset( $_POST['request'] ) && is_scalar( $_POST['request'] ) ) {
		$encoded_request = wp_unslash( (string) $_POST['request'] );
		$request_limits  = WPBC_Booking_New_Inspector_Config::get_action_request_limits();
		if ( $request_limits[ WPBC_Booking_New_Inspector_Config::ACTION_APPLY ] >= strlen( $encoded_request ) ) {
			$decoded_request = json_decode( $encoded_request, true );
			$request_values  = is_array( $decoded_request ) ? $decoded_request : null;
		}
	}
	$endpoint = new WPBC_Booking_New_Inspector_Apply_Endpoint();
	$result   = $endpoint->process( $request_values, $nonce );
	if ( is_wp_error( $result ) ) {
		$error_data = $result->get_error_data();
		$status     = is_array( $error_data ) && ! empty( $error_data['status'] ) ? absint( $error_data['status'] ) : 400;
		$request_id = is_array( $request_values ) && isset( $request_values['request_id'] ) ? $request_values['request_id'] : '';
		wp_send_json_error( $endpoint->get_error_dto( $result, $request_id ), $status );
	}
	wp_send_json_success( $result );
}
