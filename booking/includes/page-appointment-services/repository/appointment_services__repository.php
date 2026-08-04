<?php
/** Repository bootstrap. @package Booking Calendar */
if ( ! defined( 'ABSPATH' ) ) { exit; }
require_once __DIR__ . '/class-wpbc-appointment-services-repository.php';

/**
 * Return the shared native Appointment Services repository.
 *
 * @return WPBC_Appointment_Services_Repository Native repository instance.
 */
function wpbc_appointment_services_repository() {
	static $repository = null;
	if ( null === $repository ) { $repository = new WPBC_Appointment_Services_Repository(); }
	return $repository;
}

/**
 * Supply the native repository when an extension has not provided one.
 *
 * @param mixed $provider Provider selected by an earlier filter callback.
 *
 * @return object Existing provider or the native repository.
 */
function wpbc_appointment_services_use_native_repository( $provider ) {
	return $provider ? $provider : wpbc_appointment_services_repository();
}
add_filter( 'wpbc_appointment_services_data_provider', 'wpbc_appointment_services_use_native_repository', 10 );
