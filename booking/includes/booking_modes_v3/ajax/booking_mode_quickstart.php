<?php
/**
 * AJAX boundary for explicit Booking Mode QuickStart operations.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validate and run one owner-scoped QuickStart operation.
 *
 * Unlike mode switching, this endpoint may create WordPress content and change
 * setup options. It therefore uses a separate action, nonce, capability check,
 * explicit browser confirmation, and live-demo mutation guard.
 *
 * @return void
 */
function wpbc_booking_modes_ajax_quickstart() {

	$mode_id    = isset( $_POST['mode_id'] ) && is_scalar( $_POST['mode_id'] ) ? sanitize_key( wp_unslash( $_POST['mode_id'] ) ) : '';
	$nonce      = isset( $_POST['nonce'] ) && is_scalar( $_POST['nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['nonce'] ) ) : '';
	$validation = wpbc_booking_modes_validate_quickstart_request( $mode_id, $nonce );

	if ( is_wp_error( $validation ) ) {
		wp_send_json_error(
			array(
				'code'    => $validation->get_error_code(),
				'message' => $validation->get_error_message(),
			),
			403
		);
	}

	$lock_name = wpbc_booking_modes_acquire_quickstart_lock( $mode_id );

	if ( is_wp_error( $lock_name ) ) {
		wp_send_json_error(
			array(
				'code'    => $lock_name->get_error_code(),
				'message' => $lock_name->get_error_message(),
			),
			409
		);
	}

	try {
		$result = wpbc_booking_modes_run_quickstart( $mode_id );
	} finally {
		wpbc_booking_modes_release_quickstart_lock( $lock_name );
	}

	if ( is_wp_error( $result ) ) {
		wp_send_json_error(
			array(
				'code'    => $result->get_error_code(),
				'message' => $result->get_error_message(),
			),
			400
		);
	}

	wp_send_json_success( $result );
}
add_action( 'wp_ajax_WPBC_AJX_BOOKING_MODE_QUICKSTART', 'wpbc_booking_modes_ajax_quickstart' );
