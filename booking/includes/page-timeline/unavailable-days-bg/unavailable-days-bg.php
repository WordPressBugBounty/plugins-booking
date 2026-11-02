<?php
/**
 * Timeline unavailable-background read module.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/class-wpbc-timeline-unavailable-days-bg-projection.php';
require_once __DIR__ . '/class-wpbc-timeline-availability-provider.php';
require_once __DIR__ . '/unavailable-days-bg-ajax.php';

