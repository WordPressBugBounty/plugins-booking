<?php
/**
 * AJAX Appointment booking module bootstrap.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/booking-appointment__config.php';
require_once __DIR__ . '/booking-appointment__catalog.php';
require_once __DIR__ . '/booking-appointment__theme.php';
require_once __DIR__ . '/booking-appointment__pricing.php';
require_once __DIR__ . '/booking-appointment__render.php';
require_once __DIR__ . '/booking-appointment__shortcode.php';
require_once __DIR__ . '/ajax/booking-appointment__resolve.php';
require_once __DIR__ . '/ajax/booking-appointment__validate-time.php';
