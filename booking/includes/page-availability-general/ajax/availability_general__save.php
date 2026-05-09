<?php
/**
 * AJAX save handler for General Availability.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * AJAX: save General Availability settings.
 *
 * @return void
 */
function wpbc_availability_general_ajax_save() {

	$nonce_result = check_ajax_referer( 'wpbc_availability_general_ajax_nonce', 'nonce', false );
	if ( false === $nonce_result ) {
		wp_send_json_error( array( 'message' => __( 'Security check failed.', 'booking' ) ), 403 );
	}

	if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_availability_general__get_manage_cap() ) ) {
		wp_send_json_error( array( 'message' => __( 'You do not have permission to change general availability.', 'booking' ) ), 403 );
	}

	$cleaned_data = wpbc_availability_general__validate_data( $_POST ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized, WordPress.Security.NonceVerification.Missing
	wpbc_availability_general__update_settings( $cleaned_data );

	wp_send_json_success(
		array(
			'message'  => __( 'General availability settings updated.', 'booking' ),
			'settings' => wpbc_availability_general__get_settings_response(),
		)
	);
}
add_action( 'wp_ajax_WPBC_AJX_AVAILABILITY_GENERAL_SAVE', 'wpbc_availability_general_ajax_save' );
