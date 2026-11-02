<?php
/**
 * AJAX transport for Add New Booking Inspector bootstrap reads.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return one authorized, data-only Add New Booking Inspector bootstrap DTO.
 *
 * This endpoint is authenticated-only and read-only. It does not register a
 * public AJAX action and never calls booking persistence or mutation hooks.
 *
 * @return void
 */
function wpbc_booking_new_inspector_ajax_bootstrap() {
	$nonce = isset( $_POST['nonce'] ) && is_scalar( $_POST['nonce'] )
		? sanitize_text_field( wp_unslash( $_POST['nonce'] ) )
		: '';

	$request_values = array();
	if ( isset( $_POST['request'] ) && is_scalar( $_POST['request'] ) ) {
		$encoded_request = wp_unslash( (string) $_POST['request'] );
		if ( WPBC_Booking_New_Inspector_Config::get_action_request_limits()[ WPBC_Booking_New_Inspector_Config::ACTION_BOOTSTRAP ] < strlen( $encoded_request ) ) {
			$request_values = null;
		} else {
			$decoded_request = json_decode( $encoded_request, true );
			$request_values  = is_array( $decoded_request ) ? $decoded_request : null;
		}
	} else {
		foreach ( array( 'schema_version', 'request_id', 'selection_source', 'resource_id', 'form_id', 'source_context_token' ) as $field_name ) {
			if ( isset( $_POST[ $field_name ] ) && is_scalar( $_POST[ $field_name ] ) ) {
				$request_values[ $field_name ] = wp_unslash( $_POST[ $field_name ] );
			}
		}
	}

	$endpoint = new WPBC_Booking_New_Inspector_Bootstrap_Endpoint();
	$result   = $endpoint->process( $request_values, $nonce );
	if ( is_wp_error( $result ) ) {
		$error_data = $result->get_error_data();
		$status     = is_array( $error_data ) && ! empty( $error_data['status'] ) ? absint( $error_data['status'] ) : 400;
		$request_id = is_array( $request_values ) && isset( $request_values['request_id'] ) ? $request_values['request_id'] : '';
		wp_send_json_error( $endpoint->get_error_dto( $result, $request_id ), $status );
	}

	wp_send_json_success( $result );
}
