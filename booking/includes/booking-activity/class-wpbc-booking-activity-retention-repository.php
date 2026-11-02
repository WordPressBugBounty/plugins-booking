<?php
/**
 * Booking activity retention repository.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Own the bounded SQL used only by Activity retention cleanup.
 */
final class WPBC_Booking_Activity_Retention_Repository {

	/**
	 * Determine whether current-site Activity storage is available.
	 *
	 * @return bool True when cleanup may access the current site's table.
	 */
	public function table_exists() {
		return wpbc_booking_activity_table_exists();
	}

	/**
	 * Return the oldest event IDs beyond the age limit.
	 *
	 * @param string $cutoff_utc Exclusive UTC cutoff in MySQL format.
	 * @param int    $limit      Maximum IDs to return.
	 *
	 * @return array<int,int>|WP_Error Ordered IDs or a safe read error.
	 */
	public function get_expired_activity_ids( $cutoff_utc, $limit ) {
		global $wpdb;

		$sql = $wpdb->prepare(
			'SELECT activity_id FROM ' . wpbc_booking_activity_table_name() . ' WHERE occurred_at < %s ORDER BY occurred_at ASC, activity_id ASC LIMIT %d',
			(string) $cutoff_utc,
			max( 1, absint( $limit ) )
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared current-site retention read.
		$activity_ids = $wpdb->get_col( $sql );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $activity_ids ) ) {
			return $this->read_error();
		}

		return array_values( array_filter( array_map( 'absint', $activity_ids ) ) );
	}

	/**
	 * Count every current-site Activity row.
	 *
	 * @return int|WP_Error Row count or a safe read error.
	 */
	public function count_activity() {
		global $wpdb;

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Fixed current-site table count.
		$row_count = $wpdb->get_var( 'SELECT COUNT(*) FROM ' . wpbc_booking_activity_table_name() );
		if ( '' !== (string) $wpdb->last_error ) {
			return $this->read_error();
		}

		return absint( $row_count );
	}

	/**
	 * Return the oldest IDs eligible for row-cap cleanup.
	 *
	 * Events inside the retry-protection horizon are excluded even when the
	 * table temporarily exceeds the configured row cap.
	 *
	 * @param string $protected_cutoff_utc Exclusive UTC retry-protection cutoff.
	 * @param int    $limit                Maximum IDs to return.
	 *
	 * @return array<int,int>|WP_Error Ordered IDs or a safe read error.
	 */
	public function get_row_cap_activity_ids( $protected_cutoff_utc, $limit ) {
		global $wpdb;

		$sql = $wpdb->prepare(
			'SELECT activity_id FROM ' . wpbc_booking_activity_table_name() . ' WHERE occurred_at < %s ORDER BY occurred_at ASC, activity_id ASC LIMIT %d',
			(string) $protected_cutoff_utc,
			max( 1, absint( $limit ) )
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared current-site retention read.
		$activity_ids = $wpdb->get_col( $sql );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $activity_ids ) ) {
			return $this->read_error();
		}

		return array_values( array_filter( array_map( 'absint', $activity_ids ) ) );
	}

	/**
	 * Determine whether another bounded cleanup batch has eligible work.
	 *
	 * @param string $age_cutoff_utc       Exclusive UTC age cutoff.
	 * @param string $protected_cutoff_utc Exclusive UTC retry-protection cutoff.
	 * @param int    $max_rows             Maximum retained rows for the site.
	 *
	 * @return bool|WP_Error True when another eligible row remains, or a safe read error.
	 */
	public function has_more_eligible_activity( $age_cutoff_utc, $protected_cutoff_utc, $max_rows ) {
		global $wpdb;

		$expired_sql = $wpdb->prepare(
			'SELECT activity_id FROM ' . wpbc_booking_activity_table_name() . ' WHERE occurred_at < %s ORDER BY occurred_at ASC, activity_id ASC LIMIT 1',
			(string) $age_cutoff_utc
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared current-site retention probe.
		$expired_id = $wpdb->get_var( $expired_sql );
		if ( '' !== (string) $wpdb->last_error ) {
			return $this->read_error();
		}
		if ( $expired_id ) {
			return true;
		}

		$row_count = $this->count_activity();
		if ( is_wp_error( $row_count ) ) {
			return $row_count;
		}
		if ( absint( $row_count ) <= absint( $max_rows ) ) {
			return false;
		}

		$eligible_sql = $wpdb->prepare(
			'SELECT activity_id FROM ' . wpbc_booking_activity_table_name() . ' WHERE occurred_at < %s ORDER BY occurred_at ASC, activity_id ASC LIMIT 1',
			(string) $protected_cutoff_utc
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared current-site retention probe.
		$eligible_id = $wpdb->get_var( $eligible_sql );
		if ( '' !== (string) $wpdb->last_error ) {
			return $this->read_error();
		}

		return (bool) $eligible_id;
	}

	/**
	 * Delete only the explicitly selected bounded Activity IDs.
	 *
	 * @param array<int,int> $activity_ids Current-site Activity IDs.
	 *
	 * @return int|WP_Error Deleted count or a safe write error.
	 */
	public function delete_activity_ids( $activity_ids ) {
		global $wpdb;

		$activity_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $activity_ids ) ) ) );
		if ( empty( $activity_ids ) ) {
			return 0;
		}

		$placeholders = implode( ', ', array_fill( 0, count( $activity_ids ), '%d' ) );
		$query        = 'DELETE FROM ' . wpbc_booking_activity_table_name() . " WHERE activity_id IN ({$placeholders})";
		$sql          = call_user_func_array( array( $wpdb, 'prepare' ), array_merge( array( $query ), $activity_ids ) );
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared deletion of preselected bounded current-site IDs.
		$deleted_count = $wpdb->query( $sql );
		if ( false === $deleted_count ) {
			return new WP_Error(
				'wpbc_booking_activity_retention_delete_failed',
				__( 'Booking activity cleanup could not be completed.', 'booking' )
			);
		}

		return absint( $deleted_count );
	}

	/**
	 * Build a safe repository read error without exposing database details.
	 *
	 * @return WP_Error Safe read error.
	 */
	private function read_error() {
		return new WP_Error(
			'wpbc_booking_activity_retention_read_failed',
			__( 'Booking activity cleanup could not be completed.', 'booking' )
		);
	}
}
