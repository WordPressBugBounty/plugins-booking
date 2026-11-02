<?php
/**
 * Canonical booking activity domain bootstrap.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/booking-activity__activate.php';
require_once __DIR__ . '/class-wpbc-booking-activity-repository.php';
require_once __DIR__ . '/class-wpbc-booking-activity-retention-policy.php';
require_once __DIR__ . '/class-wpbc-booking-activity-retention-repository.php';
require_once __DIR__ . '/class-wpbc-booking-activity-retention-state.php';
require_once __DIR__ . '/class-wpbc-booking-activity-retention-service.php';
require_once __DIR__ . '/booking-activity__retention.php';
require_once __DIR__ . '/class-wpbc-booking-activity-change-set.php';
require_once __DIR__ . '/class-wpbc-booking-activity-dto-mapper.php';
require_once __DIR__ . '/class-wpbc-booking-activity-append-service.php';
require_once __DIR__ . '/class-wpbc-booking-activity-read-service.php';
require_once __DIR__ . '/class-wpbc-booking-activity-request-validator.php';
require_once __DIR__ . '/booking-activity__hooks.php';
require_once __DIR__ . '/booking-activity__privacy.php';
