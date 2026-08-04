<?php
/**
 * Public AJAX endpoint for resolving Booking Resource selector stages.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve a Booking Resource selection and return the native form stage.
 *
 * The endpoint is read-only. It verifies the public nonce and signed shortcode
 * configuration, then rebuilds the current resource catalogue before render.
 *
 * @return void Terminates with a JSON response.
 */
function wpbc_booking_resource_selector_ajax_resolve() {
	if ( false === check_ajax_referer( 'wpbc_booking_resource_selector_ajax', 'nonce', false ) ) {
		wp_send_json_error( array( 'message' => __( 'Security check failed. Reload the page and try again.', 'booking' ) ), 403 );
	}

	$config_token = isset( $_POST['config_token'] ) && ! is_array( $_POST['config_token'] ) ? sanitize_text_field( wp_unslash( $_POST['config_token'] ) ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$config       = wpbc_booking_resource_selector_decode_config( $config_token );
	if ( is_wp_error( $config ) ) {
		wp_send_json_error(
			array(
				'message' => $config->get_error_message(),
				'code'    => $config->get_error_code(),
			),
			400
		);
	}

	$resource_id = isset( $_POST['resource_id'] ) && ! is_array( $_POST['resource_id'] ) ? absint( wp_unslash( $_POST['resource_id'] ) ) : 0;
	$result      = wpbc_booking_resource_selector_resolve_stage( $config, $resource_id, 0 < $resource_id );
	if ( is_wp_error( $result ) ) {
		wp_send_json_error(
			array(
				'message' => $result->get_error_message(),
				'code'    => $result->get_error_code(),
			),
			400
		);
	}

	wp_send_json_success( $result );
}
add_action( 'wp_ajax_nopriv_WPBC_AJX_BOOKING_RESOURCE_SELECTOR_RESOLVE', 'wpbc_booking_resource_selector_ajax_resolve' );
add_action( 'wp_ajax_WPBC_AJX_BOOKING_RESOURCE_SELECTOR_RESOLVE', 'wpbc_booking_resource_selector_ajax_resolve' );
