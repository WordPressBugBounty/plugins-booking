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
 * The browser supplies its current same-site URL and fragment as destination
 * hints. The server signs those hints together with the real user, effective
 * owner, site, target mode, and expiry, then returns the intent only after the
 * preference saves. A full administration landing request revalidates the
 * route against normally contributed metadata.
 *
 * @return void
 */
function wpbc_booking_modes_ajax_switch_mode() {

	$mode_id         = isset( $_POST['mode_id'] ) && is_scalar( $_POST['mode_id'] ) ? sanitize_key( wp_unslash( $_POST['mode_id'] ) ) : '';
	$nonce           = isset( $_POST['nonce'] ) && is_scalar( $_POST['nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['nonce'] ) ) : '';
	$origin_url      = isset( $_POST['origin_url'] ) && is_scalar( $_POST['origin_url'] ) ? esc_url_raw( wp_unslash( $_POST['origin_url'] ) ) : '';
	$origin_fragment = isset( $_POST['fragment'] ) && is_scalar( $_POST['fragment'] ) ? sanitize_text_field( wp_unslash( $_POST['fragment'] ) ) : '';
	$validation      = wpbc_booking_modes_validate_switch_request( $mode_id, $nonce );

	if ( is_wp_error( $validation ) ) {
		wp_send_json_error(
			array(
				'code'    => $validation->get_error_code(),
				'message' => $validation->get_error_message(),
			),
			403
		);
	}

	if ( '' === $origin_url ) {
		$origin_url = wp_get_referer();
	}
	$landing_url = WPBC_Booking_Modes_V3_Switch_Intent::create_landing_url( $mode_id, $origin_url, $origin_fragment );
	if ( is_wp_error( $landing_url ) ) {
		wp_send_json_error(
			array(
				'code'    => $landing_url->get_error_code(),
				'message' => $landing_url->get_error_message(),
			),
			500
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

	$mode = wpbc_booking_modes_get_mode( $mode_id );
	/* translators: %s: Activated Booking Calendar administration mode. */
	$success_message = sprintf( __( '%s mode activated.', 'booking' ), $mode['label'] );

	wp_send_json_success(
		array(
			'mode_id'      => $mode_id,
			'label'        => $mode['label'],
			'redirect_url' => $landing_url,
			'message'      => $success_message,
		)
	);
}
add_action( 'wp_ajax_WPBC_AJX_BOOKING_MODE_SWITCH', 'wpbc_booking_modes_ajax_switch_mode' );
