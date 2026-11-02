<?php
/**
 * Timeline Resource preference module bootstrap.
 *
 * The module isolates versioned Resource-view storage, per-Resource display
 * overrides, per-Resource booking-title policy, the authorized
 * Resource-selector read path, and the backward-compatible Timeline
 * preference facade behind one production loading boundary.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/class-wpbc-timeline-resource-view-preferences.php';
require_once __DIR__ . '/class-wpbc-timeline-resource-navigation-config.php';
require_once __DIR__ . '/class-wpbc-timeline-resource-settings-config.php';
require_once __DIR__ . '/class-wpbc-timeline-resource-view-context.php';
require_once __DIR__ . '/class-wpbc-timeline-resource-group-policy.php';
require_once __DIR__ . '/class-wpbc-timeline-resource-view-service.php';
require_once __DIR__ . '/class-wpbc-timeline-resource-display-preferences.php';
require_once __DIR__ . '/class-wpbc-timeline-booking-title-policy.php';
require_once __DIR__ . '/class-wpbc-timeline-resource-settings-request-validator.php';
require_once __DIR__ . '/class-wpbc-timeline-resource-settings-dto-mapper.php';
require_once __DIR__ . '/class-wpbc-timeline-resource-settings-service.php';
require_once __DIR__ . '/class-wpbc-timeline-preferences.php';
require_once __DIR__ . '/class-wpbc-timeline-resource-selector-request-validator.php';
require_once __DIR__ . '/class-wpbc-timeline-resource-selector-dto-mapper.php';
require_once __DIR__ . '/class-wpbc-timeline-resource-selector-read-service.php';
require_once __DIR__ . '/class-wpbc-timeline-resource-selection-read-service.php';
require_once __DIR__ . '/resource-preferences-ajax.php';
