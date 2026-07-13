<?php
/**
 * AJAX save handler for Form Messages settings.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** AJAX: save visitor-facing form messages. */
function wpbc_settings_messages_ajax_save() {

	if ( false === check_ajax_referer( 'wpbc_settings_messages_ajax_nonce', 'nonce', false ) ) {
		wp_send_json_error( array( 'message' => __( 'Security check failed.', 'booking' ) ), 403 );
	}
	if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_settings_messages__get_manage_cap() ) ) {
		wp_send_json_error( array( 'message' => __( 'You do not have permission to change form messages.', 'booking' ) ), 403 );
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Missing
	if ( isset( $_POST['reset_all'] ) && is_scalar( $_POST['reset_all'] ) && '1' === wp_unslash( $_POST['reset_all'] ) ) {
		update_bk_option( 'booking_frontend_messages', array( 'version' => 1, 'messages' => array(), 'enabled' => array() ) );
		wp_send_json_success( array( 'message' => __( 'All form messages were restored to plugin defaults.', 'booking' ) ) );
	}

	$settings = wpbc_settings_messages__validate_data( $_POST ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized, WordPress.Security.NonceVerification.Missing
	if ( is_wp_error( $settings ) ) {
		wp_send_json_error( array( 'message' => $settings->get_error_message() ), 400 );
	}

	update_bk_option( 'booking_frontend_messages', $settings );
	wp_send_json_success( array( 'message' => __( 'Form messages updated.', 'booking' ) ) );
}
add_action( 'wp_ajax_WPBC_AJX_SETTINGS_MESSAGES_SAVE', 'wpbc_settings_messages_ajax_save' );
