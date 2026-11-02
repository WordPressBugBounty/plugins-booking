<?php
/**
 * Booking Rescheduling domain contract bootstrap.
 *
 * Phase 5 loads the booking-owned contract, authoritative read/review/apply
 * services, fixed templates, authenticated AJAX boundaries, and the accessible
 * dialog. Future pointer adapters may reuse the domain contract, but no gesture
 * UI is enabled by this bootstrap.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/class-wpbc-booking-rescheduling-config.php';
require_once dirname( __DIR__ ) . '/booking-modified-notification/booking-modified-notification.php';
require_once __DIR__ . '/class-wpbc-booking-rescheduling-proposal-contract.php';
require_once __DIR__ . '/class-wpbc-booking-rescheduling-read-request-validator.php';
require_once __DIR__ . '/class-wpbc-booking-rescheduling-review-request-validator.php';
require_once __DIR__ . '/class-wpbc-booking-rescheduling-apply-request-validator.php';
require_once __DIR__ . '/class-wpbc-booking-rescheduling-authorization.php';
require_once __DIR__ . '/class-wpbc-booking-rescheduling-repository.php';
require_once __DIR__ . '/class-wpbc-booking-rescheduling-source-context.php';
require_once __DIR__ . '/class-wpbc-booking-rescheduling-shape-classifier.php';
require_once __DIR__ . '/class-wpbc-booking-rescheduling-interaction-policy.php';
require_once __DIR__ . '/class-wpbc-booking-rescheduling-read-service.php';
require_once __DIR__ . '/class-wpbc-booking-rescheduling-proposal-normalizer.php';
require_once __DIR__ . '/class-wpbc-booking-rescheduling-availability-resolver.php';
require_once __DIR__ . '/class-wpbc-booking-rescheduling-review-service.php';
require_once __DIR__ . '/class-wpbc-booking-rescheduling-mutation-service.php';
require_once __DIR__ . '/class-wpbc-booking-rescheduling-apply-service.php';
require_once __DIR__ . '/ajax/booking-rescheduling-ajax.php';
