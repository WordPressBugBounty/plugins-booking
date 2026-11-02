<?php
/**
 * Isolated Timeline booking-movement module bootstrap.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Filters whether the isolated Timeline booking-movement module is loaded.
 *
 * Returning false prevents registration of the module classes, authenticated
 * endpoint, templates, assets, and browser controller. The outer Timeline
 * feature gate remains the primary rollback boundary.
 *
 * @since 12.0.0
 *
 * @param bool $movement_enabled Whether to load Timeline booking movement.
 */
$wpbc_timeline_booking_movement_enabled = apply_filters( 'wpbc_timeline_booking_movement_enabled', true );
if ( ! $wpbc_timeline_booking_movement_enabled ) {
	return;
}

require_once __DIR__ . '/class-wpbc-timeline-booking-movement-config.php';
require_once __DIR__ . '/class-wpbc-timeline-booking-movement-request-validator.php';
require_once __DIR__ . '/class-wpbc-timeline-booking-movement-interaction-policy.php';
require_once __DIR__ . '/class-wpbc-timeline-booking-movement-context-service.php';
require_once __DIR__ . '/ajax/booking-movement-ajax.php';

WPBC_Timeline_Booking_Movement_Config::register_hooks();
