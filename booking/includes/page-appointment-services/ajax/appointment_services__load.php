<?php
/** AJAX: load one Appointment Service. @package Booking Calendar */
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Load one Service for the AJAX settings inspector.
 *
 * @return void Terminates with a JSON success or error response.
 */
function wpbc_appointment_services_ajax_load() {
	wpbc_appointment_services_ajax_authorize(); $provider = wpbc_appointment_services_get_data_provider();
	if ( ! is_object( $provider ) || ! method_exists( $provider, 'find' ) ) { wpbc_appointment_services_send_provider_error( wpbc_appointment_services_storage_error(), __( 'Service storage is unavailable.', 'booking' ) ); }
	// phpcs:ignore WordPress.Security.NonceVerification.Missing
	$service_id = isset( $_POST['service_id'] ) ? absint( $_POST['service_id'] ) : 0;
	if ( ! $service_id ) { wp_send_json_error( array( 'message' => __( 'A valid Service ID is required.', 'booking' ) ), 400 ); }
	$result = $provider->find( $service_id );
	if ( is_wp_error( $result ) || empty( $result ) ) { wpbc_appointment_services_send_provider_error( $result, __( 'Service not found.', 'booking' ) ); }
	wp_send_json_success( array( 'service' => wpbc_appointment_services_normalize_item( $result ) ) );
}
add_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICE_LOAD', 'wpbc_appointment_services_ajax_load' );
