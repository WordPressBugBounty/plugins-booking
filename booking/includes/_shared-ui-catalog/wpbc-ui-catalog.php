<?php
/**
 * Bootstrap the independent shared catalog foundation.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/interface-wpbc-ui-catalog-provider.php';
require_once __DIR__ . '/interface-wpbc-ui-catalog-inline-fields.php';
require_once __DIR__ . '/class-wpbc-ui-catalog-inline-field-schema.php';
require_once __DIR__ . '/class-wpbc-ui-catalog-preferences.php';
require_once __DIR__ . '/class-wpbc-ui-catalog-request.php';
require_once __DIR__ . '/class-wpbc-ui-catalog-hierarchy.php';
require_once __DIR__ . '/class-wpbc-ui-catalog-response.php';
require_once __DIR__ . '/class-wpbc-ui-catalog-registry.php';
require_once __DIR__ . '/class-wpbc-ui-catalog-template-loader.php';
require_once __DIR__ . '/class-wpbc-ui-catalog.php';
