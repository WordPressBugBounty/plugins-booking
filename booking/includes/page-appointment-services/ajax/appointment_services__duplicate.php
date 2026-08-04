<?php
/** AJAX: duplicate an Appointment Service. @package Booking Calendar */
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Duplicate one Service through the configured data provider.
 *
 * @return void Terminates with a JSON success or error response.
 */
function wpbc_appointment_services_ajax_duplicate() {
	wpbc_appointment_services_ajax_authorize(); $provider = wpbc_appointment_services_get_data_provider();
	if ( ! is_object( $provider ) || ! method_exists( $provider, 'duplicate' ) ) { wpbc_appointment_services_send_provider_error( wpbc_appointment_services_storage_error(), __( 'Service storage is unavailable.', 'booking' ) ); }
	// phpcs:ignore WordPress.Security.NonceVerification.Missing
	$service_id = isset( $_POST['service_id'] ) ? absint( $_POST['service_id'] ) : 0;
	$result = $service_id ? $provider->duplicate( $service_id ) : new WP_Error( 'invalid_service_id', __( 'A valid Service ID is required.', 'booking' ) );
	if ( is_wp_error( $result ) || empty( $result ) ) { wpbc_appointment_services_send_provider_error( $result, __( 'The Service could not be duplicated.', 'booking' ) ); }
	wp_send_json_success( array( 'service' => wpbc_appointment_services_normalize_item( $result ), 'message' => __( 'Service duplicated.', 'booking' ) ) );
}
add_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICE_DUPLICATE', 'wpbc_appointment_services_ajax_duplicate' );
