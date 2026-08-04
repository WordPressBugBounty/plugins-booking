<?php
/**
 * Public AJAX endpoint for resolving Appointment selector stages.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve a Service/Provider selection and return the next complete stage.
 *
 * The endpoint never mutates data. It verifies the public nonce, validates the
 * signed shortcode configuration, rebuilds the active assignment catalogue,
 * and renders one complete native resource-bound form when selection is final.
 *
 * @return void Terminates with a JSON response.
 */
function wpbc_booking_appointment_ajax_resolve() {
	if ( false === check_ajax_referer( 'wpbc_booking_appointment_ajax', 'nonce', false ) ) {
		wp_send_json_error( array( 'message' => __( 'Security check failed. Reload the page and try again.', 'booking' ) ), 403 );
	}

	$config_token = isset( $_POST['config_token'] ) && ! is_array( $_POST['config_token'] ) ? sanitize_text_field( wp_unslash( $_POST['config_token'] ) ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$config       = wpbc_booking_appointment_decode_config( $config_token );
	if ( is_wp_error( $config ) ) {
		wp_send_json_error( array( 'message' => $config->get_error_message(), 'code' => $config->get_error_code() ), 400 );
	}

	$service_id  = isset( $_POST['service_id'] ) && ! is_array( $_POST['service_id'] ) ? absint( wp_unslash( $_POST['service_id'] ) ) : 0;
	$provider_id = isset( $_POST['provider_id'] ) && ! is_array( $_POST['provider_id'] ) ? absint( wp_unslash( $_POST['provider_id'] ) ) : 0;
	$result      = wpbc_booking_appointment_resolve_stage( $config, $service_id, $provider_id );
	if ( is_wp_error( $result ) ) {
		wp_send_json_error( wpbc_booking_appointment_get_error_response_data( $result ), 400 );
	}

	wp_send_json_success( $result );
}
add_action( 'wp_ajax_nopriv_WPBC_AJX_BOOKING_APPOINTMENT_RESOLVE', 'wpbc_booking_appointment_ajax_resolve' );
add_action( 'wp_ajax_WPBC_AJX_BOOKING_APPOINTMENT_RESOLVE', 'wpbc_booking_appointment_ajax_resolve' );
