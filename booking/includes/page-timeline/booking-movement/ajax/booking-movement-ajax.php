<?php
/**
 * Authenticated Timeline booking-movement read endpoint.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_ajax_' . WPBC_Timeline_Booking_Movement_Config::READ_AJAX_ACTION, 'wpbc_timeline_booking_movement_ajax_read' );

/**
 * Return one authorized, non-mutating direct-movement context DTO.
 *
 * @return void
 */
function wpbc_timeline_booking_movement_ajax_read() {
	if ( false === check_ajax_referer( WPBC_Timeline_Booking_Movement_Config::get_read_nonce_action(), 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_booking_movement_nonce_invalid',
				'message' => __( 'The booking movement request expired. Reload the Timeline and try again.', 'booking' ),
			),
			403
		);
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above; every remaining field is allow-listed by the domain validator.
	$request = is_array( $_POST ) ? wp_unslash( $_POST ) : array();
	unset( $request['action'], $request['nonce'] );
	$result = ( new WPBC_Timeline_Booking_Movement_Context_Service() )->read( $request );
	if ( is_wp_error( $result ) ) {
		wpbc_timeline_booking_movement_send_error( $result );
	}

	wp_send_json_success( $result );
}

/**
 * Send a normalized data-only movement endpoint error.
 *
 * @param WP_Error $error Safe domain error.
 *
 * @return void
 */
function wpbc_timeline_booking_movement_send_error( $error ) {
	$error_data = $error->get_error_data();
	$status     = is_array( $error_data ) && isset( $error_data['status'] ) ? absint( $error_data['status'] ) : 400;

	wp_send_json_error(
		array(
			'code'    => sanitize_key( $error->get_error_code() ),
			'message' => sanitize_text_field( $error->get_error_message() ),
		),
		$status
	);
}
