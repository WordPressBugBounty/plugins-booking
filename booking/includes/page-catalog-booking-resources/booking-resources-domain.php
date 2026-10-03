<?php
/**
 * Bootstrap reusable Booking Resources domain services without catalog UI.
 *
 * @package Booking Calendar
 * @since   11.9.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/booking-resources-domain-access.php';
require_once __DIR__ . '/class-wpbc-catalog-booking-resource-demo-policy.php';
require_once __DIR__ . '/class-wpbc-catalog-booking-resources-repository.php';
require_once __DIR__ . '/class-wpbc-catalog-booking-resource-availability.php';
require_once __DIR__ . '/class-wpbc-catalog-booking-resource-inspector-schema.php';
require_once __DIR__ . '/mutations/class-wpbc-catalog-booking-resource-content-store.php';
require_once __DIR__ . '/mutations/class-wpbc-catalog-booking-resource-creator.php';
require_once __DIR__ . '/mutations/class-wpbc-catalog-booking-resource-updater.php';
