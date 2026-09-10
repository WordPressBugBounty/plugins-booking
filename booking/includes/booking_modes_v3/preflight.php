<?php
/**
 * Side-effect-free Booking Modes V3 preflight boundary.
 *
 * @package Booking Calendar
 * @since   11.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Verify the complete V3 production manifest and all declarations before bootstrap.
 *
 * Loading validator classes is intentionally allowed here; hooks, assets, and
 * public compatibility functions are registered only after this returns true.
 *
 * @return array<string,mixed> Result with ready and errors keys.
 */
function wpbc_booking_modes_v3_preflight() {
	static $result = null;

	if ( null !== $result ) {
		return $result;
	}

	$base_directory = __DIR__;
	$required_files = array(
		$base_directory . '/class-wpbc-booking-modes-v3-definition-validator.php',
		$base_directory . '/class-wpbc-booking-modes-v3-definition-registry.php',
		$base_directory . '/class-wpbc-booking-modes-v3-definition-translator.php',
		$base_directory . '/class-wpbc-booking-modes-v3-page-registry.php',
		$base_directory . '/class-wpbc-booking-modes-v3-compatibility-registry.php',
		$base_directory . '/class-wpbc-booking-modes-v3-context.php',
		$base_directory . '/class-wpbc-booking-modes-v3-storage.php',
		$base_directory . '/class-wpbc-booking-modes-v3-source-index.php',
		$base_directory . '/class-wpbc-booking-modes-v3-compiler.php',
		$base_directory . '/class-wpbc-booking-modes-v3-switch-intent.php',
		$base_directory . '/canonical-pages.php',
		$base_directory . '/booking_modes-api.php',
		$base_directory . '/booking_modes-navigation.php',
		$base_directory . '/booking_modes-services.php',
		$base_directory . '/booking_modes-setup.php',
		$base_directory . '/booking_modes-toolbar.php',
		$base_directory . '/booking_modes-landing.php',
		$base_directory . '/ajax/booking_mode_switch.php',
		$base_directory . '/ajax/booking_mode_quickstart.php',
		$base_directory . '/quickstart/booking_modes-quickstart.php',
		$base_directory . '/quickstart/appointment.php',
		$base_directory . '/quickstart/rental.php',
		$base_directory . '/_out/booking_modes.js',
		$base_directory . '/_out/booking_modes.css',
		$base_directory . '/_out/booking_modes-native-menu.css',
		$base_directory . '/booking_modes.php',
		$base_directory . '/modes/classic.php',
		$base_directory . '/modes/appointment.php',
		$base_directory . '/modes/rental.php',
	);

	$errors = array();
	foreach ( $required_files as $required_file ) {
		if ( ! is_readable( $required_file ) ) {
			$errors[] = 'Missing or unreadable V3 component: ' . basename( $required_file );
		}
	}

	if ( ! empty( $errors ) ) {
		$result = array( 'ready' => false, 'errors' => $errors );
		return $result;
	}

	require_once $base_directory . '/class-wpbc-booking-modes-v3-definition-validator.php';
	require_once $base_directory . '/class-wpbc-booking-modes-v3-definition-registry.php';

	$registry = WPBC_Booking_Modes_V3_Definition_Registry::get_instance();
	$is_valid = $registry->load( $base_directory );
	$result   = array(
		'ready'  => $is_valid,
		'errors' => $registry->get_errors(),
	);

	return $result;
}
