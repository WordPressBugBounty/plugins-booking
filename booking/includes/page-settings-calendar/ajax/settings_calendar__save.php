<?php
/**
 * AJAX save handler for Calendar settings.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * AJAX: save Calendar settings.
 *
 * @return void
 */
function wpbc_settings_calendar_ajax_save() {

	$nonce_result = check_ajax_referer( 'wpbc_settings_calendar_ajax_nonce', 'nonce', false );
	if ( false === $nonce_result ) {
		wp_send_json_error( array( 'message' => __( 'Security check failed.', 'booking' ) ), 403 );
	}

	if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_settings_calendar__get_manage_cap() ) ) {
		wp_send_json_error( array( 'message' => __( 'You do not have permission to change calendar settings.', 'booking' ) ), 403 );
	}

	$cleaned_data = wpbc_settings_calendar__validate_data( $_POST ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized, WordPress.Security.NonceVerification.Missing
	wpbc_settings_calendar__update_settings( $cleaned_data );

	$message = wpbc_settings_calendar__is_range_supported()
		? __( 'Calendar settings updated.', 'booking' )
		: __( 'Calendar settings updated. Premium-only options were previewed but not saved in this edition.', 'booking' );

	wp_send_json_success(
		array(
			'message'        => $message,
			'settings'       => wpbc_settings_calendar__get_settings_response(),
			'days_selection' => wpbc_settings_calendar__get_days_selection_response(),
		)
	);
}
add_action( 'wp_ajax_WPBC_AJX_SETTINGS_CALENDAR_SAVE', 'wpbc_settings_calendar_ajax_save' );
