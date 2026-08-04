<?php
/**
 * AJAX Booking Resource selector module bootstrap.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/booking-resource-selector__config.php';
require_once __DIR__ . '/booking-resource-selector__catalog.php';
require_once __DIR__ . '/booking-resource-selector__theme.php';
require_once __DIR__ . '/booking-resource-selector__render.php';
require_once __DIR__ . '/booking-resource-selector__shortcode.php';
require_once __DIR__ . '/ajax/booking-resource-selector__resolve.php';
