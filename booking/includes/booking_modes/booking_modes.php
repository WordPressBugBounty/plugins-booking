<?php
/**
 * Bootstrap the Booking Calendar administration modes foundation.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/class-wpbc-booking-mode-registry.php';
require_once __DIR__ . '/class-wpbc-booking-mode-page-registry.php';
require_once __DIR__ . '/booking_modes-context.php';
require_once __DIR__ . '/booking_modes-storage.php';
require_once __DIR__ . '/class-wpbc-booking-mode-navigation.php';
require_once __DIR__ . '/booking_modes-api.php';
require_once __DIR__ . '/booking_modes-setup.php';

if ( wpbc_booking_modes_is_navigation_boundary_enabled() ) {
	require_once __DIR__ . '/booking_modes-navigation.php';

	// Keep a partially updated installation usable without exposing a selector whose persistence handler is missing.
	if ( is_readable( __DIR__ . '/ajax/booking_mode_switch.php' ) ) {
		require_once __DIR__ . '/ajax/booking_mode_switch.php';

		if (
			is_readable( __DIR__ . '/quickstart/booking_modes-quickstart.php' )
			&& is_readable( __DIR__ . '/quickstart/appointment.php' )
			&& is_readable( __DIR__ . '/quickstart/rental.php' )
			&& is_readable( __DIR__ . '/ajax/booking_mode_quickstart.php' )
		) {
			require_once __DIR__ . '/quickstart/booking_modes-quickstart.php';
			require_once __DIR__ . '/quickstart/appointment.php';
			require_once __DIR__ . '/quickstart/rental.php';
			require_once __DIR__ . '/ajax/booking_mode_quickstart.php';
		}

		require_once __DIR__ . '/booking_modes-toolbar.php';
	}
}
