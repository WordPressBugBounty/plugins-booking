<?php
/**
 * Bootstrap the independent Booking Resources catalog page.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/booking-resources-catalog-config.php';
require_once __DIR__ . '/class-wpbc-catalog-booking-resource-demo-policy.php';
require_once __DIR__ . '/class-wpbc-catalog-booking-resources-request.php';
require_once __DIR__ . '/class-wpbc-catalog-booking-resources-repository.php';
require_once __DIR__ . '/class-wpbc-catalog-booking-resource-dto.php';
require_once __DIR__ . '/class-wpbc-catalog-booking-resource-details-dto.php';
require_once __DIR__ . '/class-wpbc-catalog-booking-resource-availability.php';
require_once __DIR__ . '/class-wpbc-catalog-booking-resource-inspector-schema.php';
require_once __DIR__ . '/class-wpbc-catalog-inline-fields.php';
require_once __DIR__ . '/class-wpbc-catalog-booking-resources-provider.php';
require_once __DIR__ . '/mutations/class-wpbc-catalog-booking-resource-content-store.php';
require_once __DIR__ . '/mutations/class-wpbc-catalog-booking-resource-creator.php';
require_once __DIR__ . '/mutations/class-wpbc-catalog-booking-resource-updater.php';
require_once __DIR__ . '/mutations/class-wpbc-catalog-booking-resources-inline-editor.php';
require_once __DIR__ . '/mutations/class-wpbc-catalog-booking-resources-bulk-editor.php';
require_once __DIR__ . '/mutations/class-wpbc-catalog-booking-resources-deleter.php';
require_once __DIR__ . '/mutations/class-wpbc-catalog-booking-resource-capacity-service.php';
require_once __DIR__ . '/ajax/booking-resources-list.php';
require_once __DIR__ . '/ajax/booking-resource-details.php';
require_once __DIR__ . '/ajax/booking-resource-inspector.php';
require_once __DIR__ . '/ajax/booking-resources-bulk.php';
require_once __DIR__ . '/ajax/booking-resources-inline.php';
require_once __DIR__ . '/ajax/booking-resource-capacity.php';

// Resolve translated configuration only after WordPress permits just-in-time translation loading.
if ( did_action( 'init' ) ) {
	wpbc_catalog_booking_resources_register_catalog();
} else {
	add_action( 'init', 'wpbc_catalog_booking_resources_register_catalog', 20 );
}

require_once __DIR__ . '/booking-resources-catalog-page.php';
