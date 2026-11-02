<?php
/**
 * Timeline time-row selection contracts and development interaction bootstrap.
 *
 * Phase 2 validation remains available independently. Development browser
 * hooks register only behind the parent time-rows feature gate. They reuse the
 * existing Timeline preview/apply boundaries and add no endpoint, domain
 * mutation service, or production setting.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/class-wpbc-timeline-time-rows-selection-config.php';
require_once __DIR__ . '/class-wpbc-timeline-time-rows-selection-request-validator.php';

/**
 * Determine whether the isolated time-row selection module may register.
 *
 * The parent time-row presentation remains required, while this module-specific
 * filter provides an independent rollback boundary that does not affect
 * movement or read-only projection.
 *
 * @return bool True when selection hooks may register.
 */
function wpbc_timeline_time_rows_selection_is_enabled() {
	if ( ! function_exists( 'wpbc_timeline_time_rows_is_enabled' ) || ! wpbc_timeline_time_rows_is_enabled() ) {
		return false;
	}

	/**
	 * Filters whether the isolated Timeline time-row selection module is enabled.
	 *
	 * @since 12.0.0
	 *
	 * @param bool $is_enabled Default enabled state beneath the parent time-row gate.
	 */
	return (bool) apply_filters( 'wpbc_timeline_time_rows_selection_is_enabled', true );
}

/**
 * Register the development-only selection/action adapter after textdomains load.
 *
 * @return void
 */
function wpbc_timeline_time_rows_selection_register_draft_module() {
	if ( ! wpbc_timeline_time_rows_selection_is_enabled() ) {
		return;
	}
	WPBC_Timeline_Time_Rows_Selection_Config::register_hooks();
}

if ( function_exists( 'did_action' ) && did_action( 'init' ) ) {
	wpbc_timeline_time_rows_selection_register_draft_module();
} elseif ( function_exists( 'add_action' ) ) {
	add_action( 'init', 'wpbc_timeline_time_rows_selection_register_draft_module', 21 );
}
