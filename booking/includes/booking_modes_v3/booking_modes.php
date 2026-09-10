<?php
/**
 * Bootstrap the production Booking Modes V3 engine.
 *
 * Preflight has already verified every packaged component and all three mode
 * declarations before this entry point is included. Shared services are then
 * loaded only for the administration request that can use them.
 *
 * @package Booking Calendar
 * @since   11.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/class-wpbc-booking-modes-v3-definition-translator.php';
require_once __DIR__ . '/class-wpbc-booking-modes-v3-page-registry.php';
require_once __DIR__ . '/class-wpbc-booking-modes-v3-compatibility-registry.php';
require_once __DIR__ . '/class-wpbc-booking-modes-v3-context.php';
require_once __DIR__ . '/class-wpbc-booking-modes-v3-storage.php';
require_once __DIR__ . '/class-wpbc-booking-modes-v3-source-index.php';
require_once __DIR__ . '/class-wpbc-booking-modes-v3-compiler.php';
require_once __DIR__ . '/booking_modes-api.php';

if ( wpbc_booking_modes_is_navigation_boundary_enabled() ) {
	require_once __DIR__ . '/booking_modes-navigation.php';
}

require_once __DIR__ . '/booking_modes-services.php';
