<?php
/**
 * AJAX preview handler for General Availability.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * AJAX: refresh General Availability calendar preview.
 *
 * @return void
 */
function wpbc_availability_general_ajax_preview() {

	$nonce_result = check_ajax_referer( 'wpbc_availability_general_ajax_nonce', 'nonce', false );
	if ( false === $nonce_result ) {
		wp_send_json_error( array( 'message' => __( 'Security check failed.', 'booking' ) ), 403 );
	}

	if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_availability_general__get_manage_cap() ) ) {
		wp_send_json_error( array( 'message' => __( 'You do not have permission to preview general availability.', 'booking' ) ), 403 );
	}

	$resource_id  = isset( $_POST['resource_id'] ) ? absint( wp_unslash( $_POST['resource_id'] ) ) : wpbc_availability_general__get_preview_resource_id(); // phpcs:ignore WordPress.Security.NonceVerification.Missing
	$months_count = isset( $_POST['months_count'] ) ? absint( wp_unslash( $_POST['months_count'] ) ) : wpbc_availability_general__get_preview_months_count(); // phpcs:ignore WordPress.Security.NonceVerification.Missing

	$resource_id  = wpbc_availability_general__sanitize_preview_resource_id( $resource_id );
	$months_count = wpbc_availability_general__sanitize_preview_months_count( $months_count );

	ob_start();
	wpbc_availability_general__render_calendar_preview( $resource_id, $months_count );
	$html = ob_get_clean();

	wp_send_json_success(
		array(
			'html'         => $html,
			'resource_id'  => $resource_id,
			'months_count' => $months_count,
		)
	);
}
add_action( 'wp_ajax_WPBC_AJX_AVAILABILITY_GENERAL_PREVIEW', 'wpbc_availability_general_ajax_preview' );
