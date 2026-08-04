<?php
/** AJAX: create or update an Appointment Service. @package Booking Calendar */
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Create or update a Service from the AJAX settings inspector payload.
 *
 * @return void Terminates with a JSON success or error response.
 */
function wpbc_appointment_services_ajax_save() {
	wpbc_appointment_services_ajax_authorize(); $provider = wpbc_appointment_services_get_data_provider();
	if ( ! is_object( $provider ) || ! method_exists( $provider, 'save' ) ) { wpbc_appointment_services_send_provider_error( wpbc_appointment_services_storage_error(), __( 'Service storage is unavailable.', 'booking' ) ); }
	// phpcs:ignore WordPress.Security.NonceVerification.Missing
	$raw_payload = isset( $_POST['service'] ) ? wp_unslash( $_POST['service'] ) : array();
	$payload = wpbc_appointment_services_sanitize_payload( $raw_payload );
	if ( '' === $payload['title'] ) { wp_send_json_error( array( 'message' => __( 'Enter a Service title.', 'booking' ) ), 400 ); }
	$result = $provider->save( $payload );
	if ( is_wp_error( $result ) || empty( $result ) ) { wpbc_appointment_services_send_provider_error( $result, __( 'The Service could not be saved.', 'booking' ) ); }
	wp_send_json_success( array( 'service' => wpbc_appointment_services_normalize_item( $result ), 'message' => __( 'Service saved.', 'booking' ) ) );
}
add_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICE_SAVE', 'wpbc_appointment_services_ajax_save' );
