<?php
/**
 * Appointment Services catalog bootstrap.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Resolve translated configuration only after WordPress permits just-in-time translation loading.
if ( class_exists( 'WPBC_UI_Catalog' ) ) {
	if ( did_action( 'init' ) ) {
		wpbc_appointment_services_register_catalog();
	} else {
		add_action( 'init', 'wpbc_appointment_services_register_catalog', 20 );
	}
}
