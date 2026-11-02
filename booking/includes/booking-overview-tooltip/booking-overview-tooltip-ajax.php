<?php
/**
 * Authenticated Booking Overview lazy-details endpoint.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_ajax_' . WPBC_Booking_Overview_Tooltip_Config::AJAX_ACTION, 'wpbc_booking_overview_tooltip_ajax_read' );

/**
 * Validate the nonce and return one bounded authorized details DTO.
 *
 * @return void
 */
function wpbc_booking_overview_tooltip_ajax_read() {
	if ( false === check_ajax_referer( WPBC_Booking_Overview_Tooltip_Config::get_nonce_action(), 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_booking_overview_tooltip_nonce_invalid',
				'message' => __( 'The booking overview request expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}

	$result = ( new WPBC_Booking_Overview_Tooltip_Read_Service() )->read(
		array(
			'booking_id' => isset( $_POST['booking_id'] ) ? wp_unslash( $_POST['booking_id'] ) : 0, // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the domain validator.
			'source'     => isset( $_POST['source'] ) ? wp_unslash( $_POST['source'] ) : '', // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the domain validator.
		)
	);
	if ( is_wp_error( $result ) ) {
		$error_data = $result->get_error_data();
		$status     = is_array( $error_data ) && isset( $error_data['status'] ) ? absint( $error_data['status'] ) : 400;
		wp_send_json_error(
			array(
				'code'    => sanitize_key( $result->get_error_code() ),
				'message' => sanitize_text_field( $result->get_error_message() ),
			),
			$status
		);
	}

	wp_send_json_success( $result );
}
