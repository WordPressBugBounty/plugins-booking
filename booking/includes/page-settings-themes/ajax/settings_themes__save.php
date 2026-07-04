<?php
/**
 * AJAX save handler for Appearance / Theme.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * AJAX: save Appearance / Theme settings.
 *
 * @return void
 */
function wpbc_settings_themes_ajax_save() {

	$nonce_result = check_ajax_referer( 'wpbc_settings_themes_ajax_nonce', 'nonce', false );
	if ( false === $nonce_result ) {
		wp_send_json_error( array( 'message' => __( 'Security check failed.', 'booking' ) ), 403 );
	}

	if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_settings_themes__get_manage_cap() ) ) {
		wp_send_json_error( array( 'message' => __( 'You do not have permission to change appearance settings.', 'booking' ) ), 403 );
	}

	$cleaned_data = wpbc_settings_themes__validate_data( $_POST ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized, WordPress.Security.NonceVerification.Missing
	wpbc_settings_themes__update_settings( $cleaned_data );

	wp_send_json_success(
		array(
			'message'  => __( 'Appearance settings updated.', 'booking' ),
			'settings' => wpbc_settings_themes__get_settings_response(),
		)
	);
}
add_action( 'wp_ajax_WPBC_AJX_SETTINGS_THEMES_SAVE', 'wpbc_settings_themes_ajax_save' );
