<?php
/**
 * Development-gated Timeline time-rows module bootstrap.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'WPBC_ENABLE_TIMELINE_TIME_ROWS_DEV' ) ) {
	define( 'WPBC_ENABLE_TIMELINE_TIME_ROWS_DEV', false );
}

/**
 * Determine whether the development-only time-rows module is enabled.
 *
 * The constant is the deterministic development/package boundary. The filter
 * supports controlled tests and local development without creating a setting,
 * request value, stored option, or customer-facing switch.
 *
 * @return bool True when the isolated module should register.
 */
function wpbc_timeline_time_rows_is_enabled() {
	/**
	 * Filters whether the development-only Timeline time-rows module is loaded.
	 *
	 * @since 12.0.0
	 *
	 * @param bool $is_enabled Constant-defined development state.
	 */
	return (bool) apply_filters( 'wpbc_timeline_time_rows_enabled', true === WPBC_ENABLE_TIMELINE_TIME_ROWS_DEV );
}

if ( ! wpbc_timeline_time_rows_is_enabled() ) {
	return;
}

require_once __DIR__ . '/class-wpbc-timeline-time-rows-provider.php';
require_once __DIR__ . '/class-wpbc-timeline-time-rows-config.php';
require_once dirname( __DIR__ ) . '/resource-preferences/class-wpbc-timeline-resource-view-preferences.php';
require_once __DIR__ . '/class-wpbc-timeline-time-rows-preferences.php';
require_once __DIR__ . '/time-rows-ajax.php';

/**
 * Register the translated descriptor and module hooks after textdomains load.
 *
 * WordPress 6.7 and later reports just-in-time translation calls made while
 * plugin include files are still loading. Deferring the first translated
 * descriptor until `init` preserves the server allow-list boundary without
 * triggering an early `booking` textdomain load.
 *
 * @return void
 */
function wpbc_timeline_time_rows_register() {
	$wpbc_timeline_time_rows_registration_result = WPBC_Timeline_Time_Rows_Config::register_presentation();
	if ( true === $wpbc_timeline_time_rows_registration_result ) {
		WPBC_Timeline_Time_Rows_Config::register_hooks();
	}
}

if ( did_action( 'init' ) ) {
	wpbc_timeline_time_rows_register();
} else {
	add_action( 'init', 'wpbc_timeline_time_rows_register', 20 );
}
