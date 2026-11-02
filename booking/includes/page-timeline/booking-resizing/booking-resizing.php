<?php
/**
 * Timeline booking-resizing server boundary bootstrap.
 *
 * Phase 4 connects the non-mutating pointer preview to the canonical signed
 * Review service. Apply remains outside this bootstrap phase.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/class-wpbc-timeline-booking-resizing-config.php';
require_once __DIR__ . '/class-wpbc-timeline-booking-resizing-request-validator.php';
require_once __DIR__ . '/class-wpbc-timeline-booking-resizing-context-service.php';
require_once __DIR__ . '/ajax/booking-resizing-ajax.php';
