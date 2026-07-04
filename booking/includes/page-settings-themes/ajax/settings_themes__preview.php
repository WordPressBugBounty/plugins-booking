<?php
/**
 * AJAX preview handler for Appearance / Theme.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * AJAX: refresh Appearance / Theme calendar preview.
 *
 * @return void
 */
function wpbc_settings_themes_ajax_preview() {

	$nonce_result = check_ajax_referer( 'wpbc_settings_themes_ajax_nonce', 'nonce', false );
	if ( false === $nonce_result ) {
		wp_send_json_error( array( 'message' => __( 'Security check failed.', 'booking' ) ), 403 );
	}

	if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_settings_themes__get_manage_cap() ) ) {
		wp_send_json_error( array( 'message' => __( 'You do not have permission to preview appearance settings.', 'booking' ) ), 403 );
	}

	$resource_id  = isset( $_POST['resource_id'] ) ? absint( wp_unslash( $_POST['resource_id'] ) ) : wpbc_settings_themes__get_preview_resource_id(); // phpcs:ignore WordPress.Security.NonceVerification.Missing
	$months_count = isset( $_POST['months_count'] ) ? absint( wp_unslash( $_POST['months_count'] ) ) : wpbc_settings_themes__get_preview_months_count(); // phpcs:ignore WordPress.Security.NonceVerification.Missing
	$preview_mode = isset( $_POST['preview_mode'] ) ? sanitize_key( wp_unslash( $_POST['preview_mode'] ) ) : wpbc_settings_themes__get_preview_mode(); // phpcs:ignore WordPress.Security.NonceVerification.Missing
	$custom_booking_form = isset( $_POST['custom_booking_form'] ) ? sanitize_text_field( wp_unslash( $_POST['custom_booking_form'] ) ) : wpbc_settings_themes__get_custom_booking_form(); // phpcs:ignore WordPress.Security.NonceVerification.Missing

	$resource_id          = wpbc_settings_themes__sanitize_preview_resource_id( $resource_id );
	$months_count         = wpbc_settings_themes__sanitize_preview_months_count( $months_count );
	$preview_mode         = wpbc_settings_themes__sanitize_preview_mode( $preview_mode );
	$custom_booking_form  = wpbc_settings_themes__sanitize_custom_booking_form( $custom_booking_form );
	$preview_settings     = wpbc_settings_themes__validate_data( $_POST ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized, WordPress.Security.NonceVerification.Missing

	ob_start();
	wpbc_settings_themes__render_calendar_preview( $resource_id, $months_count, $preview_settings, $preview_mode, $custom_booking_form );
	$html = ob_get_clean();

	wp_send_json_success(
		array(
			'html'                => $html,
			'resource_id'         => $resource_id,
			'months_count'        => $months_count,
			'preview_mode'        => $preview_mode,
			'custom_booking_form' => $custom_booking_form,
			'days_selection'      => wpbc_settings_themes__get_days_selection_response(),
		)
	);
}
add_action( 'wp_ajax_WPBC_AJX_SETTINGS_THEMES_PREVIEW', 'wpbc_settings_themes_ajax_preview' );
