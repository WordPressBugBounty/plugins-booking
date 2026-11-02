<?php
/**
 * Booking Date Editor domain bootstrap.
 *
 * The module is loaded by Booking Inspector, but it owns its templates,
 * presentation assets, browser contract, and authorized endpoints. The Step 4
 * interaction controller consumes the Step 3 read contract only after an
 * authorized user activates Change dates in a Booking Inspector host.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'WPBC_ENABLE_12_0_TIMELINE' ) || true !== WPBC_ENABLE_12_0_TIMELINE ) {
	return;
}

require_once __DIR__ . '/class-wpbc-booking-date-editor-config.php';
require_once dirname( __DIR__ ) . '/booking-modified-notification/booking-modified-notification.php';
require_once __DIR__ . '/class-wpbc-booking-date-editor-source-fingerprint.php';
require_once __DIR__ . '/class-wpbc-booking-date-editor-read-service.php';
require_once __DIR__ . '/class-wpbc-booking-date-editor-review-request-validator.php';
require_once __DIR__ . '/class-wpbc-booking-date-editor-review-service.php';
require_once __DIR__ . '/class-wpbc-booking-date-editor-apply-request-validator.php';
require_once __DIR__ . '/class-wpbc-booking-date-editor-form-time-synchronizer.php';
require_once __DIR__ . '/class-wpbc-booking-date-editor-mutation-repository.php';
require_once __DIR__ . '/class-wpbc-booking-date-editor-apply-service.php';
require_once __DIR__ . '/ajax/booking-date-editor-ajax.php';
