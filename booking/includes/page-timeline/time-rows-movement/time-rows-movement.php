<?php
/**
 * Timeline expanded time-row movement eligibility bootstrap.
 *
 * This development-gated module reuses the existing authoritative movement
 * and resizing context endpoints. It adds no mutation route and remains
 * inactive when the parent expanded time-row presentation is disabled.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/class-wpbc-timeline-time-rows-movement-config.php';

/**
 * Determine whether the isolated time-row movement module may register.
 *
 * The parent time-row presentation remains required, while this module-specific
 * filter provides an independent rollback boundary that does not affect empty
 * selection or read-only projection.
 *
 * @return bool True when movement hooks may register.
 */
function wpbc_timeline_time_rows_movement_is_enabled() {
	if ( ! function_exists( 'wpbc_timeline_time_rows_is_enabled' ) || ! wpbc_timeline_time_rows_is_enabled() ) {
		return false;
	}

	/**
	 * Filters whether the isolated Timeline time-row movement module is enabled.
	 *
	 * @since 12.0.0
	 *
	 * @param bool $is_enabled Default enabled state beneath the parent time-row gate.
	 */
	return (bool) apply_filters( 'wpbc_timeline_time_rows_movement_is_enabled', true );
}

/**
 * Register the development-only projected-booking eligibility adapter.
 *
 * @return void
 */
function wpbc_timeline_time_rows_movement_register() {
	if ( ! wpbc_timeline_time_rows_movement_is_enabled() ) {
		return;
	}

	WPBC_Timeline_Time_Rows_Movement_Config::register_hooks();
}

if ( function_exists( 'did_action' ) && did_action( 'init' ) ) {
	wpbc_timeline_time_rows_movement_register();
} elseif ( function_exists( 'add_action' ) ) {
	add_action( 'init', 'wpbc_timeline_time_rows_movement_register', 22 );
}
