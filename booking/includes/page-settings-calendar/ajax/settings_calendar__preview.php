<?php
/**
 * AJAX preview handler for Calendar settings.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * AJAX: refresh Calendar settings preview.
 *
 * @return void
 */
function wpbc_settings_calendar_ajax_preview() {

	$nonce_result = check_ajax_referer( 'wpbc_settings_calendar_ajax_nonce', 'nonce', false );
	if ( false === $nonce_result ) {
		wp_send_json_error( array( 'message' => __( 'Security check failed.', 'booking' ) ), 403 );
	}

	if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_settings_calendar__get_manage_cap() ) ) {
		wp_send_json_error( array( 'message' => __( 'You do not have permission to preview calendar settings.', 'booking' ) ), 403 );
	}

	$resource_id      = isset( $_POST['resource_id'] ) ? absint( wp_unslash( $_POST['resource_id'] ) ) : wpbc_settings_calendar__get_preview_resource_id(); // phpcs:ignore WordPress.Security.NonceVerification.Missing
	$months_count     = isset( $_POST['months_count'] ) ? absint( wp_unslash( $_POST['months_count'] ) ) : wpbc_settings_calendar__get_preview_months_count(); // phpcs:ignore WordPress.Security.NonceVerification.Missing
	$resource_id      = wpbc_settings_calendar__sanitize_preview_resource_id( $resource_id );
	$months_count     = wpbc_settings_calendar__sanitize_preview_months_count( $months_count );
	$preview_settings = wpbc_settings_calendar__validate_data( $_POST, true ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized, WordPress.Security.NonceVerification.Missing

	ob_start();
	wpbc_settings_calendar__render_calendar_preview( $resource_id, $months_count, $preview_settings );
	$html = ob_get_clean();

	wp_send_json_success(
		array(
			'html'           => $html,
			'resource_id'    => $resource_id,
			'months_count'   => $months_count,
			'days_selection' => wpbc_settings_calendar__get_days_selection_response( $preview_settings ),
		)
	);
}
add_action( 'wp_ajax_WPBC_AJX_SETTINGS_CALENDAR_PREVIEW', 'wpbc_settings_calendar_ajax_preview' );
