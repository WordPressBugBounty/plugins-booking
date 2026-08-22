<?php
/**
 * Reviewed permanent-deletion endpoints for Appointment Services.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return a signed, non-mutating deletion preview for selected Services.
 *
 * @return void Terminates with JSON.
 */
function wpbc_appointment_services_ajax_delete_preview() {
	wpbc_appointment_services_ajax_authorize();
	$service_ids = wpbc_appointment_services_catalog_decode_json_field( 'ids' );
	if ( is_wp_error( $service_ids ) ) {
		wpbc_appointment_services_send_catalog_edit_error( $service_ids );
	}

	$result = ( new WPBC_Appointment_Services_Catalog_Deleter() )->preview( $service_ids );
	if ( is_wp_error( $result ) ) {
		wpbc_appointment_services_send_catalog_edit_error( $result );
	}

	wp_send_json_success( $result );
}
add_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICES_DELETE_PREVIEW', 'wpbc_appointment_services_ajax_delete_preview' );

/**
 * Apply one acknowledged, signed Service deletion after revalidation.
 *
 * @return void Terminates with JSON.
 */
function wpbc_appointment_services_ajax_delete_apply() {
	wpbc_appointment_services_ajax_authorize();
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- The catalog nonce was verified above.
	$acknowledged = isset( $_POST['acknowledged'] ) && '1' === sanitize_text_field( wp_unslash( $_POST['acknowledged'] ) );
	if ( ! $acknowledged ) {
		wpbc_appointment_services_send_catalog_edit_error(
			new WP_Error(
				'wpbc_service_delete_not_acknowledged',
				__( 'Confirm that the selected Services will be permanently deleted before continuing.', 'booking' )
			)
		);
	}

	$plan = wpbc_appointment_services_catalog_decode_json_field( 'plan' );
	if ( is_wp_error( $plan ) ) {
		wpbc_appointment_services_send_catalog_edit_error( $plan );
	}
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- The catalog nonce was verified above.
	$token  = isset( $_POST['token'] ) && is_scalar( $_POST['token'] ) ? sanitize_text_field( wp_unslash( $_POST['token'] ) ) : '';
	$result = ( new WPBC_Appointment_Services_Catalog_Deleter() )->apply( $plan, $token );
	if ( is_wp_error( $result ) ) {
		wpbc_appointment_services_send_catalog_edit_error( $result );
	}

	$result['message'] = sprintf(
		/* translators: %s: Number of permanently deleted Services. */
		_n( '%s Service permanently deleted.', '%s Services permanently deleted.', absint( $result['deleted_count'] ), 'booking' ),
		number_format_i18n( absint( $result['deleted_count'] ) )
	);
	wp_send_json_success( $result );
}
add_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICES_DELETE_APPLY', 'wpbc_appointment_services_ajax_delete_apply' );
