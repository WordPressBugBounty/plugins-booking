<?php
/**
 * Canonical booking-date repository for Booking Inspector.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Load the complete authorized date selection for one booking.
 */
final class WPBC_Booking_Inspector_Date_Repository {

	/**
	 * Return all canonical date rows for an already authorized booking.
	 *
	 * Business Large date allocations retain their effective Resource. Other
	 * editions use the booking's canonical Resource for every row.
	 *
	 * @param int $booking_id          Authorized booking ID.
	 * @param int $primary_resource_id Canonical booking Resource ID.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Ordered date rows or a safe error.
	 */
	public function get_booking_dates( $booking_id, $primary_resource_id ) {
		global $wpdb;

		$booking_id          = absint( $booking_id );
		$primary_resource_id = absint( $primary_resource_id );
		if ( ! $booking_id || ! $primary_resource_id ) {
			return array();
		}

		$effective_resource_sql = class_exists( 'wpdev_bk_biz_l' )
			? 'COALESCE( NULLIF( inspector_bd.type_id, 0 ), %d )'
			: '%d';
		$sql = $wpdb->prepare(
			"SELECT inspector_bd.booking_dates_id, inspector_bd.booking_date, inspector_bd.approved,
			 {$effective_resource_sql} AS resource_id
			 FROM {$wpdb->prefix}bookingdates AS inspector_bd
			 WHERE inspector_bd.booking_id = %d
			 ORDER BY resource_id ASC, inspector_bd.booking_date ASC, inspector_bd.booking_dates_id ASC",
			$primary_resource_id,
			$booking_id
		); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- The Resource expression is selected only from two repository-owned SQL fragments.

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared exact current-site booking-date lookup.
		$date_rows = $wpdb->get_results( $sql, ARRAY_A );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $date_rows ) ) {
			return new WP_Error(
				'wpbc_booking_inspector_dates_query_failed',
				__( 'Booking details could not be loaded. Try again.', 'booking' )
			);
		}

		return $date_rows;
	}
}
