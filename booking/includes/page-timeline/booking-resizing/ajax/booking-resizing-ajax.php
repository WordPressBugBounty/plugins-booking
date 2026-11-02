<?php
/**
 * Authenticated Timeline booking-resizing read endpoint.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_ajax_' . WPBC_Timeline_Booking_Resizing_Config::READ_AJAX_ACTION, 'wpbc_timeline_booking_resizing_ajax_read' );

/**
 * Return one authorized, non-mutating direct-resize context DTO.
 *
 * @return void
 */
function wpbc_timeline_booking_resizing_ajax_read() {
	if ( false === check_ajax_referer( WPBC_Timeline_Booking_Resizing_Config::get_read_nonce_action(), 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_booking_resizing_nonce_invalid',
				'message' => __( 'The booking resize request expired. Reload the Timeline and try again.', 'booking' ),
			),
			403
		);
	}

	$request = array(
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the domain validator.
		'booking_id'           => isset( $_POST['booking_id'] ) ? wp_unslash( $_POST['booking_id'] ) : 0,
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and restricted to the Timeline host.
		'source'               => isset( $_POST['source'] ) ? wp_unslash( $_POST['source'] ) : '',
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Presentation-only segment clipping input, verified against canonical instants.
		'visible_start_at'     => isset( $_POST['visible_start_at'] ) ? wp_unslash( $_POST['visible_start_at'] ) : '',
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Presentation-only segment clipping input, verified against canonical instants.
		'visible_end_at'       => isset( $_POST['visible_end_at'] ) ? wp_unslash( $_POST['visible_end_at'] ) : '',
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Optional opaque token is cryptographically checked against freshly loaded state.
		'source_context_token' => isset( $_POST['source_context_token'] ) ? wp_unslash( $_POST['source_context_token'] ) : '',
	);
	$result = ( new WPBC_Timeline_Booking_Resizing_Context_Service() )->read( $request );
	if ( is_wp_error( $result ) ) {
		wpbc_timeline_booking_resizing_send_error( $result );
	}

	wp_send_json_success( $result );
}

/**
 * Send a normalized data-only endpoint error.
 *
 * @param WP_Error $error Safe domain error.
 *
 * @return void
 */
function wpbc_timeline_booking_resizing_send_error( $error ) {
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
