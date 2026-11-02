<?php
/**
 * Shared administration UI component bootstrap.
 *
 * Shared components own reusable interaction and presentation mechanics only.
 * Domain modules remain responsible for option data, authorization, business
 * rules, persistence, and reactions to component events.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/dropdown/class-wpbc-shared-ui-dropdown.php';
require_once __DIR__ . '/popover/class-wpbc-shared-ui-popover.php';
require_once __DIR__ . '/context-popover/class-wpbc-shared-ui-context-popover.php';
require_once __DIR__ . '/inspector/class-wpbc-shared-ui-inspector.php';
require_once __DIR__ . '/date-range-navigation/class-wpbc-shared-ui-date-range-navigation.php';
require_once __DIR__ . '/date-jump/class-wpbc-shared-ui-date-jump.php';
