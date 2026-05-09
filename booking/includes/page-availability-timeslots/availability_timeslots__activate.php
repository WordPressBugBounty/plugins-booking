<?php
/**
 * Activate DB table for time slots availability.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'WPBC_AVAILABILITY_TIMESLOTS_DB_VERSION' ) ) {
	define( 'WPBC_AVAILABILITY_TIMESLOTS_DB_VERSION', '1.0.0' );
}

/**
 * Create or update blocked time-slot intervals table.
 *
 * @return void
 */
function wpbc_activation__availability_timeslots() {

	global $wpdb;

	$charset_collate  = ( ! empty( $wpdb->charset ) ) ? "DEFAULT CHARACTER SET $wpdb->charset" : '';
	$charset_collate .= ( ! empty( $wpdb->collate ) ) ? " COLLATE $wpdb->collate" : '';
	$table            = wpbc_availability_timeslots__table_name();

	if ( ! wpbc_is_table_exists( 'booking_availability_timeslots' ) ) {
		$simple_sql = "CREATE TABLE {$table} (
			timeslot_id bigint(20) unsigned NOT NULL auto_increment,
			resource_id bigint(20) unsigned NOT NULL default 1,
			block_date date NOT NULL,
			start_second mediumint(8) unsigned NOT NULL default 0,
			end_second mediumint(8) unsigned NOT NULL default 0,
			status varchar(20) NOT NULL default 'active',
			group_uid varchar(64) NOT NULL default '',
			source varchar(30) NOT NULL default 'manual',
			note text,
			created_by bigint(20) unsigned NOT NULL default 0,
			modified_by bigint(20) unsigned NOT NULL default 0,
			creation_date datetime NOT NULL default '0000-00-00 00:00:00',
			modification_date datetime NOT NULL default '0000-00-00 00:00:00',
			PRIMARY KEY  (timeslot_id),
			KEY resource_date_start (resource_id, block_date, start_second),
			KEY date_resource (block_date, resource_id),
			KEY status_resource_date (status, resource_id, block_date),
			KEY group_uid (group_uid)
		) {$charset_collate}";

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->query( $simple_sql );
	}

	$fields = array(
		'status'            => "ALTER TABLE {$table} ADD status varchar(20) NOT NULL default 'active'",
		'group_uid'         => "ALTER TABLE {$table} ADD group_uid varchar(64) NOT NULL default ''",
		'source'            => "ALTER TABLE {$table} ADD source varchar(30) NOT NULL default 'manual'",
		'note'              => "ALTER TABLE {$table} ADD note text",
		'created_by'        => "ALTER TABLE {$table} ADD created_by bigint(20) unsigned NOT NULL default 0",
		'modified_by'       => "ALTER TABLE {$table} ADD modified_by bigint(20) unsigned NOT NULL default 0",
		'creation_date'     => "ALTER TABLE {$table} ADD creation_date datetime NOT NULL default '0000-00-00 00:00:00'",
		'modification_date' => "ALTER TABLE {$table} ADD modification_date datetime NOT NULL default '0000-00-00 00:00:00'",
	);

	foreach ( $fields as $field_name => $sql ) {
		if ( ! wpbc_is_field_in_table_exists( 'booking_availability_timeslots', $field_name ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$wpdb->query( $sql );
		}
	}

	$indexes = array(
		'resource_date_start'  => "ALTER TABLE {$table} ADD INDEX resource_date_start (resource_id, block_date, start_second)",
		'date_resource'        => "ALTER TABLE {$table} ADD INDEX date_resource (block_date, resource_id)",
		'status_resource_date' => "ALTER TABLE {$table} ADD INDEX status_resource_date (status, resource_id, block_date)",
		'group_uid'            => "ALTER TABLE {$table} ADD INDEX group_uid (group_uid)",
	);

	foreach ( $indexes as $index_name => $sql ) {
		if ( ! wpbc_is_index_in_table_exists( 'booking_availability_timeslots', $index_name ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$wpdb->query( $sql );
		}
	}

	// Older beta builds used a soft-delete status. Unblocking now removes rows physically to keep this table small.
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
	$wpdb->query( "DELETE FROM {$table} WHERE status = 'deleted'" );

	update_bk_option( 'booking_availability_timeslots_db_version', WPBC_AVAILABILITY_TIMESLOTS_DB_VERSION );
}
add_bk_action( 'wpbc_free_version_activation', 'wpbc_activation__availability_timeslots' );
add_bk_action( 'wpbc_other_versions_activation', 'wpbc_activation__availability_timeslots' );

/**
 * Run DB upgrade on plugin update from admin side.
 *
 * @return void
 */
function wpbc_activation__availability_timeslots__maybe_upgrade() {

	if ( ! is_admin() ) {
		return;
	}

	$db_version = get_bk_option( 'booking_availability_timeslots_db_version' );
	if ( ( WPBC_AVAILABILITY_TIMESLOTS_DB_VERSION !== $db_version ) || ! wpbc_is_table_exists( 'booking_availability_timeslots' ) ) {
		wpbc_activation__availability_timeslots();
		update_bk_option( 'booking_availability_timeslots_db_version', WPBC_AVAILABILITY_TIMESLOTS_DB_VERSION );
	}
}
add_action( 'admin_init', 'wpbc_activation__availability_timeslots__maybe_upgrade' );

/**
 * Deactivate: remove blocked time-slot table together with Booking Calendar data.
 *
 * @return void
 */
function wpbc_deactivation__availability_timeslots() {

	global $wpdb;
	$table = wpbc_availability_timeslots__table_name();

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.SchemaChange
	$wpdb->query( "DROP TABLE IF EXISTS {$table}" );
}
add_bk_action( 'wpbc_free_version_deactivation', 'wpbc_deactivation__availability_timeslots' );
add_bk_action( 'wpbc_other_versions_deactivation', 'wpbc_deactivation__availability_timeslots' );
