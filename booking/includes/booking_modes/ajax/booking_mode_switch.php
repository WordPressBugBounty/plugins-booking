<?php
/**
 * AJAX persistence for Booking Calendar administration modes.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validate and persist one owner-scoped mode change.
 *
 * The browser cannot choose the redirect target. It submits only the requested
 * mode; the server derives the current route from the validated WordPress
 * referer and selects a compatible administration URL after saving.
 *
 * @return void
 */
function wpbc_booking_modes_ajax_switch_mode() {

	$mode_id         = isset( $_POST['mode_id'] ) && is_scalar( $_POST['mode_id'] ) ? sanitize_key( wp_unslash( $_POST['mode_id'] ) ) : '';
	$nonce            = isset( $_POST['nonce'] ) && is_scalar( $_POST['nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['nonce'] ) ) : '';
	$validation       = wpbc_booking_modes_validate_switch_request( $mode_id, $nonce );

	if ( is_wp_error( $validation ) ) {
		wp_send_json_error(
			array(
				'code'    => $validation->get_error_code(),
				'message' => $validation->get_error_message(),
			),
			403
		);
	}

	$save_result = wpbc_booking_modes_set_selected_mode_id( $mode_id );

	if ( is_wp_error( $save_result ) ) {
		wp_send_json_error(
			array(
				'code'    => $save_result->get_error_code(),
				'message' => $save_result->get_error_message(),
			),
			500
		);
	}

	$mode            = wpbc_booking_modes_get_mode( $mode_id );
	$current_page_id = wpbc_booking_modes_get_canonical_page_id_from_url( wp_get_referer() );
	/* translators: %s: Activated Booking Calendar administration mode. */
	$success_message = sprintf( __( '%s mode activated.', 'booking' ), $mode['label'] );

	wp_send_json_success(
		array(
			'mode_id'      => $mode_id,
			'label'        => $mode['label'],
			'redirect_url' => wpbc_booking_modes_get_switch_redirect_url( $mode_id, $current_page_id ),
			'message'      => $success_message,
		)
	);
}
add_action( 'wp_ajax_WPBC_AJX_BOOKING_MODE_SWITCH', 'wpbc_booking_modes_ajax_switch_mode' );
