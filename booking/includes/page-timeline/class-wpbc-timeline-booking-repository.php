<?php
/**
 * Canonical booking-window repository for the Timeline.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Batch-load bookings and their per-date Resource allocations.
 */
final class WPBC_Timeline_Booking_Repository {

	/**
	 * Load every non-trash booking intersecting an authorized bounded window.
	 *
	 * The result is an internal domain record. Raw form and option strings are
	 * retained only long enough for the mapper to extract allow-listed fields;
	 * they must never be returned directly to JavaScript or templates.
	 *
	 * @param array<int,int>      $resource_ids Authorized Resource IDs.
	 * @param array<string,mixed> $window       Validated half-open window.
	 *
	 * @return array<string,mixed>|WP_Error Batched booking rows and canonical date context.
	 */
	public function get_window_records( $resource_ids, $window ) {
		global $wpdb;

		$resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $resource_ids ) ) ) );
		if ( empty( $resource_ids ) ) {
			return array( 'bookings' => array(), 'dates' => array() );
		}

		$effective_resource_sql = $this->get_effective_resource_sql( 'bd', 'bk' );
		$resource_placeholders  = implode( ', ', array_fill( 0, count( $resource_ids ), '%d' ) );
		$configuration          = wpbc_timeline_get_configuration();
		$maximum_booking_ids    = max( 1, absint( $configuration['limits']['maximum_projection_date_rows'] ) );
		$query_booking_limit    = $maximum_booking_ids + 1;
		$query_parameters       = array_merge(
			array( $window['start_date'] . ' 00:00:00', $window['end_date'] . ' 00:00:00' ),
			$resource_ids,
			array( $query_booking_limit )
		);
		$sql = $wpdb->prepare(
			"SELECT DISTINCT bk.booking_id
			 FROM {$wpdb->prefix}booking AS bk
			 INNER JOIN {$wpdb->prefix}bookingdates AS bd ON bd.booking_id = bk.booking_id
			 WHERE bk.trash = 0
			 AND bd.booking_date >= %s
			 AND bd.booking_date < %s
			 AND {$effective_resource_sql} IN ( {$resource_placeholders} )
			 ORDER BY bk.booking_id ASC
			 LIMIT %d",
			$query_parameters
		); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Placeholder count and SQL structure are repository-owned.

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared bounded overlap query.
		$booking_ids = array_values( array_filter( array_map( 'absint', (array) $wpdb->get_col( $sql ) ) ) );
		if ( '' !== (string) $wpdb->last_error ) {
			return $this->get_query_error();
		}
		if ( count( $booking_ids ) > $maximum_booking_ids ) {
			return new WP_Error(
				'wpbc_timeline_projection_booking_ids_exceeded',
				__( 'This Timeline range contains too many bookings to project safely. Choose fewer Resources or another date range.', 'booking' ),
				array( 'maximum_projection_booking_ids' => $maximum_booking_ids )
			);
		}
		if ( empty( $booking_ids ) ) {
			return array( 'bookings' => array(), 'dates' => array() );
		}

		$bookings = $this->get_booking_rows( $booking_ids );
		if ( is_wp_error( $bookings ) ) {
			return $bookings;
		}

		$dates = $this->get_projection_date_rows( $booking_ids, $resource_ids );
		if ( is_wp_error( $dates ) ) {
			return $dates;
		}

		return array(
			'bookings' => $bookings,
			'dates'    => $dates,
		);
	}

	/**
	 * Load booking rows in one query.
	 *
	 * @param array<int,int> $booking_ids Booking IDs.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Rows keyed by booking ID.
	 */
	private function get_booking_rows( $booking_ids ) {
		global $wpdb;

		$placeholders = implode( ', ', array_fill( 0, count( $booking_ids ), '%d' ) );
		$sql          = $wpdb->prepare(
			"SELECT booking_id, booking_type, form, booking_options, status, creation_date, modification_date
			 FROM {$wpdb->prefix}booking WHERE trash = 0 AND booking_id IN ( {$placeholders} )",
			$booking_ids
		); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Placeholder count is repository-owned.

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared batch query.
		$rows = $wpdb->get_results( $sql, ARRAY_A );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $rows ) ) {
			return $this->get_query_error();
		}

		$bookings = array();
		foreach ( $rows as $row ) {
			$bookings[ absint( $row['booking_id'] ) ] = $row;
		}

		return $bookings;
	}

	/**
	 * Load complete authorized date-row context for intersecting bookings.
	 *
	 * The initial query already bounds the booking IDs to the requested Timeline
	 * window. Once a booking intersects that window, every authorized date row
	 * for that booking and Resource is required to reconstruct its canonical
	 * full-day, timed, recurrent, or discontinuous spans before clipping. Loading
	 * only a window-adjacent fragment changes full-day boundaries and segment
	 * identity when the same booking is read from a neighboring window.
	 *
	 * A central row budget keeps this batch read finite. The extra row detects an
	 * exceeded budget without silently returning a partial booking projection.
	 *
	 * @param array<int,int> $booking_ids  Booking IDs.
	 * @param array<int,int> $resource_ids Authorized Resource IDs.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Date rows or error.
	 */
	private function get_projection_date_rows( $booking_ids, $resource_ids ) {
		global $wpdb;

		$booking_placeholders  = implode( ', ', array_fill( 0, count( $booking_ids ), '%d' ) );
		$resource_placeholders = implode( ', ', array_fill( 0, count( $resource_ids ), '%d' ) );
		$effective_resource    = $this->get_effective_resource_sql( 'bd', 'bk' );
		$configuration         = wpbc_timeline_get_configuration();
		$maximum_date_rows     = max( 1, absint( $configuration['limits']['maximum_projection_date_rows'] ) );
		$query_row_limit       = $maximum_date_rows + 1;
		$query_parameters      = array_merge( $booking_ids, $resource_ids, array( $query_row_limit ) );
		$sql = $wpdb->prepare(
			"SELECT bd.booking_id, bd.booking_date, bd.approved, {$effective_resource} AS resource_id
			 FROM {$wpdb->prefix}bookingdates AS bd
			 INNER JOIN {$wpdb->prefix}booking AS bk ON bk.booking_id = bd.booking_id
			 WHERE bd.booking_id IN ( {$booking_placeholders} )
			 AND {$effective_resource} IN ( {$resource_placeholders} )
			 ORDER BY bd.booking_id ASC, resource_id ASC, bd.booking_date ASC
			 LIMIT %d",
			$query_parameters
		); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Placeholder counts are repository-owned.

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared, ID-bounded, row-limited canonical projection query.
		$rows = $wpdb->get_results( $sql, ARRAY_A );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $rows ) ) {
			return $this->get_query_error();
		}

		if ( count( $rows ) > $maximum_date_rows ) {
			return new WP_Error(
				'wpbc_timeline_projection_date_rows_exceeded',
				sprintf(
					/* translators: 1: required booking-date row count, 2: maximum supported booking-date row count. */
					__( 'This Timeline range contains %1$d booking-date rows, but the safe maximum is %2$d. Choose fewer Resources or another date range.', 'booking' ),
					count( $rows ),
					$maximum_date_rows
				),
				array(
					'maximum_projection_date_rows' => $maximum_date_rows,
				)
			);
		}

		return $rows;
	}

	/**
	 * Return the edition-aware effective per-date Resource expression.
	 *
	 * Business Large stores non-main allocations in `bookingdates.type_id`.
	 * Other editions have no such column and always use `booking.booking_type`.
	 *
	 * @param string $date_alias    Fixed bookingdates alias.
	 * @param string $booking_alias Fixed booking alias.
	 *
	 * @return string Static SQL expression.
	 */
	private function get_effective_resource_sql( $date_alias, $booking_alias ) {
		$date_alias    = in_array( $date_alias, array( 'bd', 'context_bd', 'nearer_bd' ), true ) ? $date_alias : 'bd';
		$booking_alias = in_array( $booking_alias, array( 'bk', 'context_bk' ), true ) ? $booking_alias : 'bk';

		return class_exists( 'wpdev_bk_biz_l' )
			? "COALESCE( NULLIF( {$date_alias}.type_id, 0 ), {$booking_alias}.booking_type )"
			: "{$booking_alias}.booking_type";
	}

	/**
	 * Create a non-sensitive booking query error.
	 *
	 * @return WP_Error Safe repository error.
	 */
	private function get_query_error() {
		return new WP_Error(
			'wpbc_timeline_bookings_query_failed',
			__( 'Bookings could not be loaded for this Timeline range. Reload the page and try again.', 'booking' )
		);
	}
}
