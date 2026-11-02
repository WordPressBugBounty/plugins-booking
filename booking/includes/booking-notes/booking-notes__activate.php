<?php
/**
 * Booking Notes schema activation and upgrade routines.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'WPBC_BOOKING_NOTES_DB_VERSION' ) ) {
	/** Current Booking Notes schema version for the active site's option record. */
	define( 'WPBC_BOOKING_NOTES_DB_VERSION', '1.0.0' );
}

/**
 * Determine whether a supported Booking Notes column exists.
 *
 * Results are cached for the current request and current site. A schema
 * migration may force a refresh after adding a column. Limiting the accepted
 * names prevents callers from turning this schema probe into arbitrary SQL.
 *
 * @param string $column_name Supported Booking Notes column name.
 * @param bool   $refresh     Whether to discard the request-local cached result.
 *
 * @return bool True when the column exists in the current site's booking table.
 */
function wpbc_booking_notes_column_exists( $column_name, $refresh = false ) {
	global $wpdb;

	static $column_exists = array();

	$column_name = sanitize_key( $column_name );
	if ( ! in_array( $column_name, array( 'public_note', 'remark' ), true ) ) {
		return false;
	}

	$cache_key = $wpdb->prefix . 'booking.' . $column_name;
	if ( $refresh ) {
		unset( $column_exists[ $cache_key ] );
	}

	if ( ! array_key_exists( $cache_key, $column_exists ) ) {
		$column_exists[ $cache_key ] = function_exists( 'wpbc_is_field_in_table_exists' )
			&& 1 === (int) wpbc_is_field_in_table_exists( 'booking', $column_name );
	}

	return $column_exists[ $cache_key ];
}

/**
 * Create or upgrade Booking Notes storage for the current site.
 *
 * The core booking-table activation remains authoritative for fresh installs.
 * This focused, idempotent migration repairs sites where plugin files changed
 * without the main activation routine completing. The version option is saved
 * only after the database confirms that the nullable column exists.
 *
 * @return bool True when the Booking Notes schema is ready; otherwise false.
 */
function wpbc_activation__booking_notes() {
	global $wpdb;

	if ( ! function_exists( 'wpbc_is_table_exists' ) || ! wpbc_is_table_exists( 'booking' ) ) {
		return false;
	}

	if ( ! wpbc_booking_notes_column_exists( 'public_note' ) ) {
		$table_name = $wpdb->prefix . 'booking';
		$sql        = "ALTER TABLE {$table_name} ADD COLUMN public_note TEXT NULL";

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.SchemaChange -- Fixed current-site table and repository-owned column.
		$wpdb->query( $sql );
	}

	if ( ! wpbc_booking_notes_column_exists( 'public_note', true ) ) {
		return false;
	}

	update_bk_option( 'booking_notes_db_version', WPBC_BOOKING_NOTES_DB_VERSION );

	return true;
}
add_bk_action( 'wpbc_free_version_activation', 'wpbc_activation__booking_notes' );
add_bk_action( 'wpbc_other_versions_activation', 'wpbc_activation__booking_notes' );

/**
 * Repair an incomplete Booking Notes schema from an authorized admin request.
 *
 * Read operations remain compatible while the column is absent, so this
 * migration never runs from a template or repository and never makes an
 * Inspector request responsible for changing schema.
 *
 * @return void
 */
function wpbc_activation__booking_notes__maybe_upgrade() {
	if ( ! is_admin() || ! current_user_can( 'activate_plugins' ) ) {
		return;
	}

	$stored_version = get_bk_option( 'booking_notes_db_version' );
	if (
		WPBC_BOOKING_NOTES_DB_VERSION !== $stored_version
		|| ! wpbc_booking_notes_column_exists( 'public_note' )
	) {
		wpbc_activation__booking_notes();
	}
}
add_action( 'admin_init', 'wpbc_activation__booking_notes__maybe_upgrade' );
