<?php
/**
 * Booking Overview Context Popover domain bootstrap.
 *
 * The popover paints already-authorized booking-card data immediately, then
 * may replace it with a bounded, independently authorized details projection.
 * It owns no persistence.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once dirname( __DIR__ ) . '/booking-inspector/booking-inspector.php';
require_once __DIR__ . '/class-wpbc-booking-overview-tooltip-config.php';
require_once __DIR__ . '/class-wpbc-booking-overview-tooltip-dto-mapper.php';
require_once __DIR__ . '/class-wpbc-booking-overview-tooltip-request-validator.php';
require_once __DIR__ . '/class-wpbc-booking-overview-tooltip-details-mapper.php';
require_once __DIR__ . '/class-wpbc-booking-overview-tooltip-read-service.php';
require_once __DIR__ . '/booking-overview-tooltip-ajax.php';
