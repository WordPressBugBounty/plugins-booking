<?php
/**
 * Booking activity retention scheduling and lifecycle hooks.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'WPBC_BOOKING_ACTIVITY_RETENTION_DAILY_HOOK' ) ) {
	/** Site-local daily Activity cleanup hook. */
	define( 'WPBC_BOOKING_ACTIVITY_RETENTION_DAILY_HOOK', 'wpbc_booking_activity_cleanup_daily' );
}
if ( ! defined( 'WPBC_BOOKING_ACTIVITY_RETENTION_BATCH_HOOK' ) ) {
	/** Site-local continuation hook for another bounded Activity cleanup batch. */
	define( 'WPBC_BOOKING_ACTIVITY_RETENTION_BATCH_HOOK', 'wpbc_booking_activity_cleanup_batch' );
}

/**
 * Ensure the current site owns one daily Activity cleanup event.
 *
 * This function schedules work only. It never performs cleanup in the booking
 * save or administration bootstrap request that calls it.
 *
 * @return bool True when a daily event exists or was scheduled.
 */
function wpbc_booking_activity_retention_ensure_scheduled() {
	if ( ! wpbc_booking_activity_table_exists() ) {
		return false;
	}
	if ( wp_next_scheduled( WPBC_BOOKING_ACTIVITY_RETENTION_DAILY_HOOK ) ) {
		return true;
	}

	return false !== wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', WPBC_BOOKING_ACTIVITY_RETENTION_DAILY_HOOK );
}

/**
 * Schedule one near-term continuation when a full cleanup batch was consumed.
 *
 * WordPress de-duplicates identical single events inside the same short window,
 * preventing several concurrent cron requests from building a continuation
 * backlog.
 *
 * @return bool True when a continuation exists or was scheduled.
 */
function wpbc_booking_activity_retention_schedule_continuation() {
	if ( wp_next_scheduled( WPBC_BOOKING_ACTIVITY_RETENTION_BATCH_HOOK ) ) {
		return true;
	}

	return false !== wp_schedule_single_event( time() + ( 5 * MINUTE_IN_SECONDS ), WPBC_BOOKING_ACTIVITY_RETENTION_BATCH_HOOK );
}

/**
 * Run one scheduled site-local cleanup batch.
 *
 * @return void
 */
function wpbc_booking_activity_retention_run_scheduled_cleanup() {
	$service = new WPBC_Booking_Activity_Retention_Service();
	$service->run_cleanup();
}
add_action( WPBC_BOOKING_ACTIVITY_RETENTION_DAILY_HOOK, 'wpbc_booking_activity_retention_run_scheduled_cleanup' );
add_action( WPBC_BOOKING_ACTIVITY_RETENTION_BATCH_HOOK, 'wpbc_booking_activity_retention_run_scheduled_cleanup' );

/**
 * Repair the current site's daily schedule from an authorized admin request.
 *
 * @return void
 */
function wpbc_booking_activity_retention_admin_bootstrap() {
	if ( ! is_admin() || ! current_user_can( 'activate_plugins' ) ) {
		return;
	}

	wpbc_booking_activity_retention_ensure_scheduled();
}
add_action( 'admin_init', 'wpbc_booking_activity_retention_admin_bootstrap', 20 );

/**
 * Remove current-site Activity cleanup events and operational state.
 *
 * @param bool $delete_status Whether the full-data-removal status option should also be deleted.
 *
 * @return void
 */
function wpbc_booking_activity_retention_unschedule_site( $delete_status = false ) {
	wp_clear_scheduled_hook( WPBC_BOOKING_ACTIVITY_RETENTION_DAILY_HOOK );
	wp_clear_scheduled_hook( WPBC_BOOKING_ACTIVITY_RETENTION_BATCH_HOOK );
	delete_option( WPBC_Booking_Activity_Retention_Service::LOCK_OPTION );
	if ( $delete_status ) {
		delete_option( WPBC_Booking_Activity_Retention_Service::STATUS_OPTION );
	}
}

/**
 * Unschedule Activity cleanup when the plugin is deactivated.
 *
 * Network deactivation visits each site only to clear its cron hooks. It does
 * not execute cleanup or delete Activity rows.
 *
 * @param bool $network_wide Whether WordPress is deactivating the network plugin.
 *
 * @return void
 */
function wpbc_booking_activity_retention_deactivate( $network_wide = false ) {
	if ( ! $network_wide || ! is_multisite() ) {
		wpbc_booking_activity_retention_unschedule_site();

		return;
	}

	$offset = 0;
	do {
		$site_ids = get_sites(
			array(
				'fields' => 'ids',
				'number' => 100,
				'offset' => $offset,
			)
		);
		foreach ( $site_ids as $site_id ) {
			switch_to_blog( absint( $site_id ) );
			wpbc_booking_activity_retention_unschedule_site();
			restore_current_blog();
		}
		$offset += count( $site_ids );
	} while ( 100 === count( $site_ids ) );
}
if ( function_exists( 'register_deactivation_hook' ) && defined( 'WPBC_FILE' ) ) {
	register_deactivation_hook( WPBC_FILE, 'wpbc_booking_activity_retention_deactivate' );
}
