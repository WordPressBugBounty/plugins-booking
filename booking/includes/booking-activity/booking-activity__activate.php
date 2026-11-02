<?php
/**
 * Booking activity schema activation and multisite upgrade routines.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'WPBC_BOOKING_ACTIVITY_DB_VERSION' ) ) {
	/** Current booking activity schema version. */
	define( 'WPBC_BOOKING_ACTIVITY_DB_VERSION', '1.0.0' );
}

/**
 * Return the current site's canonical activity table name.
 *
 * @return string Fully prefixed table name.
 */
function wpbc_booking_activity_table_name() {
	global $wpdb;

	return $wpdb->prefix . 'booking_activity';
}

/**
 * Determine whether the current site's activity table exists.
 *
 * @return bool True when the table is available.
 */
function wpbc_booking_activity_table_exists() {
	return function_exists( 'wpbc_is_table_exists' ) && wpbc_is_table_exists( 'booking_activity' );
}

/**
 * Create or upgrade booking activity storage for the current site.
 *
 * dbDelta makes this boundary idempotent. The version option is written only
 * after the table can be confirmed, so a failed migration is retried safely.
 *
 * @return bool True when the current site's schema is ready.
 */
function wpbc_activation__booking_activity() {
	global $wpdb;

	require_once ABSPATH . 'wp-admin/includes/upgrade.php';

	$table_name      = wpbc_booking_activity_table_name();
	$charset_collate = $wpdb->get_charset_collate();
	$sql             = "CREATE TABLE {$table_name} (
		activity_id bigint(20) unsigned NOT NULL auto_increment,
		booking_id bigint(20) unsigned NOT NULL,
		resource_id bigint(20) unsigned NOT NULL default 0,
		event_type varchar(64) NOT NULL,
		event_payload longtext NULL,
		actor_user_id bigint(20) unsigned NOT NULL default 0,
		event_source varchar(32) NOT NULL default 'system',
		subject_hash char(64) NOT NULL default '',
		idempotency_key char(64) NOT NULL,
		occurred_at datetime NOT NULL,
		created_at datetime NOT NULL,
		PRIMARY KEY  (activity_id),
		UNIQUE KEY idempotency_key (idempotency_key),
		KEY booking_activity (booking_id,activity_id),
		KEY subject_activity (subject_hash,activity_id),
		KEY occurred_at (occurred_at),
		KEY actor_user_id (actor_user_id)
	) {$charset_collate};";

	dbDelta( $sql );
	if ( ! wpbc_booking_activity_table_exists() ) {
		return false;
	}

	update_option( 'wpbc_booking_activity_db_version', WPBC_BOOKING_ACTIVITY_DB_VERSION, false );
	if ( function_exists( 'wpbc_booking_activity_retention_ensure_scheduled' ) ) {
		wpbc_booking_activity_retention_ensure_scheduled();
	}

	return true;
}
add_bk_action( 'wpbc_free_version_activation', 'wpbc_activation__booking_activity' );
add_bk_action( 'wpbc_other_versions_activation', 'wpbc_activation__booking_activity' );

/**
 * Repair an incomplete current-site activity schema from an authorized request.
 *
 * @return void
 */
function wpbc_activation__booking_activity__maybe_upgrade() {
	if ( ! is_admin() || ! current_user_can( 'activate_plugins' ) ) {
		return;
	}

	if (
		WPBC_BOOKING_ACTIVITY_DB_VERSION !== get_option( 'wpbc_booking_activity_db_version', '' )
		|| ! wpbc_booking_activity_table_exists()
	) {
		wpbc_activation__booking_activity();
	}
}
add_action( 'admin_init', 'wpbc_activation__booking_activity__maybe_upgrade' );

/**
 * Install booking activity storage when a site is added to an active network.
 *
 * @param WP_Site $new_site Newly initialized multisite site.
 *
 * @return void
 */
function wpbc_booking_activity_initialize_site( $new_site ) {
	if ( ! is_multisite() || ! $new_site instanceof WP_Site ) {
		return;
	}
	if ( ! function_exists( 'is_plugin_active_for_network' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}
	if ( ! is_plugin_active_for_network( plugin_basename( WPBC_FILE ) ) ) {
		return;
	}

	switch_to_blog( (int) $new_site->blog_id );
	wpbc_activation__booking_activity();
	restore_current_blog();
}
add_action( 'wp_initialize_site', 'wpbc_booking_activity_initialize_site', 20, 1 );

/**
 * Upgrade every site once after a network-active plugin schema change.
 *
 * Large networks are processed in bounded batches on network-admin requests.
 * The cursor is retained until all sites confirm the current schema version.
 *
 * @return void
 */
function wpbc_booking_activity_maybe_upgrade_network() {
	if ( ! is_multisite() || ! is_network_admin() || ! current_user_can( 'manage_network_plugins' ) ) {
		return;
	}
	if ( ! function_exists( 'is_plugin_active_for_network' ) ) {
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}
	if ( ! is_plugin_active_for_network( plugin_basename( WPBC_FILE ) ) ) {
		return;
	}
	if ( WPBC_BOOKING_ACTIVITY_DB_VERSION === get_site_option( 'wpbc_booking_activity_network_db_version' ) ) {
		return;
	}

	$offset   = absint( get_site_option( 'wpbc_booking_activity_network_upgrade_offset', 0 ) );
	$site_ids = get_sites(
		array(
			'fields' => 'ids',
			'number' => 50,
			'offset' => $offset,
		)
	);
	$batch_ready = true;
	foreach ( $site_ids as $site_id ) {
		switch_to_blog( absint( $site_id ) );
		$batch_ready = wpbc_activation__booking_activity() && $batch_ready;
		restore_current_blog();
	}
	if ( ! $batch_ready ) {
		return;
	}

	if ( count( $site_ids ) < 50 ) {
		delete_site_option( 'wpbc_booking_activity_network_upgrade_offset' );
		update_site_option( 'wpbc_booking_activity_network_db_version', WPBC_BOOKING_ACTIVITY_DB_VERSION );
	} else {
		update_site_option( 'wpbc_booking_activity_network_upgrade_offset', $offset + count( $site_ids ) );
	}
}
add_action( 'network_admin_init', 'wpbc_booking_activity_maybe_upgrade_network' );

/**
 * Remove current-site activity storage during an explicit full-data removal.
 *
 * @return void
 */
function wpbc_deactivation__booking_activity() {
	global $wpdb;

	if ( function_exists( 'wpbc_booking_activity_retention_unschedule_site' ) ) {
		wpbc_booking_activity_retention_unschedule_site( true );
	}
	$table_name = wpbc_booking_activity_table_name();
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Explicit plugin-data removal for a fixed current-site table.
	$wpdb->query( "DROP TABLE IF EXISTS {$table_name}" );
	delete_option( 'wpbc_booking_activity_db_version' );
}
add_bk_action( 'wpbc_free_version_deactivation', 'wpbc_deactivation__booking_activity' );
add_bk_action( 'wpbc_other_versions_deactivation', 'wpbc_deactivation__booking_activity' );
