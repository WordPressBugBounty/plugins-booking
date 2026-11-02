<?php
/**
 * Reusable read-only Booking Inspector domain bootstrap.
 *
 * Hosts include this boundary and call the public configuration helpers. The
 * shared Inspector remains responsible only for shell and focus mechanics.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Keep the complete Inspector runtime behind the 12.0 feature boundary so minor releases can include the code safely.
if ( ! defined( 'WPBC_ENABLE_12_0_TIMELINE' ) || true !== WPBC_ENABLE_12_0_TIMELINE ) {
	return;
}

require_once dirname( __DIR__ ) . '/_shared_ui/shared-ui.php';
require_once dirname( __DIR__ ) . '/booking-notes/booking-notes.php';
require_once dirname( __DIR__ ) . '/booking-modified-notification/booking-modified-notification.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-config.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-fingerprint.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-authorization.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-request-validator.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-update-request-validator.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-resource-repository.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-repository.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-date-repository.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-date-projection.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-resource-projection.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-cost-projection.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-form-definition-repository.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-structured-field-resolver.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-form-snapshot-builder.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-form-field-resolver.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-time-field-policy.php';
require_once dirname( __DIR__ ) . '/booking-date-editor/booking-date-editor.php';
require_once dirname( __DIR__ ) . '/booking-rescheduling/booking-rescheduling.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-notes-projection.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-activity-repository.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-dto-mapper.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-read-service.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-mutation-repository.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-mutation-service.php';
require_once __DIR__ . '/booking-inspector-ajax.php';
