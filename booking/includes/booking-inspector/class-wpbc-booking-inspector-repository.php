<?php
/**
 * Canonical booking-record repository for Booking Inspector.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve one non-trash booking and its effective Resources server-side.
 */
final class WPBC_Booking_Inspector_Repository {

	/**
	 * Load one booking details record without producing HTML.
	 *
	 * @param int $booking_id Booking ID.
	 *
	 * @return array<string,mixed>|WP_Error|null Internal row, error, or null.
	 */
	public function get_booking( $booking_id ) {
		global $wpdb;

		$booking_id = absint( $booking_id );
		if ( ! $booking_id ) {
			return null;
		}

		$cost_columns     = class_exists( 'wpdev_bk_biz_s' )
			? 'detail_bk.cost, detail_bk.pay_status, detail_bk.pay_request'
			: "NULL AS cost, '' AS pay_status, 0 AS pay_request";
		$sql              = $wpdb->prepare(
			"SELECT detail_bk.booking_id, detail_bk.booking_type, detail_bk.form, detail_bk.booking_options, detail_bk.hash,
			 detail_bk.status, detail_bk.creation_date, detail_bk.modification_date,
			 {$cost_columns}
			 FROM {$wpdb->prefix}booking AS detail_bk
			 WHERE detail_bk.booking_id = %d AND detail_bk.trash = 0
			 LIMIT 1",
			$booking_id
		); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Optional columns are selected only from repository-owned edition fragments.

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared exact current-site booking lookup.
		$booking_row = $wpdb->get_row( $sql, ARRAY_A );
		if ( '' !== (string) $wpdb->last_error ) {
			return new WP_Error(
				'wpbc_booking_inspector_query_failed',
				__( 'Booking details could not be loaded. Try again.', 'booking' )
			);
		}

		if ( ! is_array( $booking_row ) ) {
			return null;
		}

		$effective_resource_ids = $this->get_effective_resource_ids( $booking_id, absint( $booking_row['booking_type'] ) );
		if ( is_wp_error( $effective_resource_ids ) ) {
			return $effective_resource_ids;
		}
		if ( empty( $effective_resource_ids ) ) {
			return null;
		}

		$booking_row['effective_resource_ids'] = $effective_resource_ids;
		$booking_row['supports_costs']         = class_exists( 'wpdev_bk_biz_s' );

		return $booking_row;
	}

	/**
	 * Resolve distinct effective Resources from canonical booking-date rows.
	 *
	 * Business Large may allocate individual dates to child Resources through
	 * `bookingdates.type_id`. Other editions use the booking's canonical
	 * `booking_type`. No Resource value from the browser participates.
	 *
	 * @param int $booking_id         Booking ID.
	 * @param int $primary_resource_id Booking's canonical Resource ID.
	 *
	 * @return array<int,int>|WP_Error Effective Resource IDs or a safe query error.
	 */
	private function get_effective_resource_ids( $booking_id, $primary_resource_id ) {
		global $wpdb;

		$booking_id          = absint( $booking_id );
		$primary_resource_id = absint( $primary_resource_id );
		if ( ! $booking_id || ! $primary_resource_id ) {
			return array();
		}

		$effective_resource_sql = class_exists( 'wpdev_bk_biz_l' )
			? 'COALESCE( NULLIF( detail_bd.type_id, 0 ), %d )'
			: '%d';
		$sql = $wpdb->prepare(
			"SELECT DISTINCT {$effective_resource_sql} AS resource_id
			 FROM {$wpdb->prefix}bookingdates AS detail_bd
			 WHERE detail_bd.booking_id = %d
			 ORDER BY resource_id ASC",
			$primary_resource_id,
			$booking_id
		); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- The expression is selected only from two repository-owned SQL fragments.

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared current-site effective-Resource lookup.
		$resource_ids = $wpdb->get_col( $sql );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $resource_ids ) ) {
			return new WP_Error(
				'wpbc_booking_inspector_resources_query_failed',
				__( 'Booking details could not be loaded. Try again.', 'booking' )
			);
		}

		return array_values( array_unique( array_filter( array_map( 'absint', $resource_ids ) ) ) );
	}
}
