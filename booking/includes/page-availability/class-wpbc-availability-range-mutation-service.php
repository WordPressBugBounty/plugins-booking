<?php
/**
 * Canonical Availability range mutation service.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Apply explicit full-day or manual timed Availability changes.
 *
 * The Availability domain owns persistence and interval arithmetic. Callers
 * must authorize the Resource before invoking this service. The service never
 * modifies bookings and never removes timed restrictions owned by another
 * source.
 */
final class WPBC_Availability_Range_Mutation_Service {

	/**
	 * Apply one validated Availability range mutation atomically when supported.
	 *
	 * @param int               $resource_id Authorized Booking Resource ID.
	 * @param DateTimeImmutable $start       Inclusive site-local instant.
	 * @param DateTimeImmutable $end         Exclusive site-local instant.
	 * @param string            $mode        Either `block` or `unblock`.
	 * @param bool              $is_full_day Whether to use full-date semantics.
	 *
	 * @return array<string,mixed>|WP_Error Change counts or safe error.
	 */
	public function apply( $resource_id, $start, $end, $mode, $is_full_day ) {
		global $wpdb;

		$resource_id = absint( $resource_id );
		$mode        = sanitize_key( (string) $mode );
		if ( ! $resource_id || ! $start instanceof DateTimeImmutable || ! $end instanceof DateTimeImmutable || $start >= $end || ! in_array( $mode, array( 'block', 'unblock' ), true ) ) {
			return new WP_Error( 'wpbc_availability_range_invalid', __( 'The reviewed Availability range is invalid.', 'booking' ) );
		}

		// Keep a multi-date replacement atomic when the active database supports it.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query( 'START TRANSACTION' );
		$result = $is_full_day
			? $this->apply_full_day( $resource_id, $start, $end, $mode )
			: $this->apply_timed( $resource_id, $start, $end, $mode );
		if ( is_wp_error( $result ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$wpdb->query( 'ROLLBACK' );

			return $result;
		}
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query( 'COMMIT' );

		if ( function_exists( 'wpbc_cache__clear' ) ) {
			wpbc_cache__clear( 'wpbc_availability__get_dates_status__sql' );
			wpbc_cache__clear( 'wpbc_availability_timeslots__get_intervals_for_resources' );
		}

		return $result;
	}

	/**
	 * Apply canonical explicit full-date Availability semantics.
	 *
	 * @param int               $resource_id Authorized Booking Resource ID.
	 * @param DateTimeImmutable $start       Inclusive day start.
	 * @param DateTimeImmutable $end         Exclusive day end.
	 * @param string            $mode        Block or unblock.
	 *
	 * @return array<string,mixed>|WP_Error Change counts or safe error.
	 */
	private function apply_full_day( $resource_id, $start, $end, $mode ) {
		if ( ! function_exists( 'wpbc_availability__update_dates_status__sql' ) ) {
			return new WP_Error( 'wpbc_timeline_full_day_block_unavailable', __( 'Full-date Availability is not available.', 'booking' ) );
		}

		$dates   = array();
		$current = $start->setTime( 0, 0, 0 );
		while ( $current < $end ) {
			$dates[] = $current->format( 'Y-m-d' );
			$current = $current->modify( '+1 day' );
		}
		if ( empty( $dates ) ) {
			return new WP_Error( 'wpbc_timeline_full_day_block_empty', __( 'No full dates were selected.', 'booking' ) );
		}

		$result = wpbc_availability__update_dates_status__sql(
			array(
				'resource_id'     => $resource_id,
				'prop_name'       => 'date_status',
				'prop_value'      => 'block' === $mode ? 'unavailable' : 'available',
				'dates_selection' => implode( ', ', $dates ),
			)
		);
		if ( false === $result ) {
			return new WP_Error( 'wpbc_timeline_full_day_block_failed', __( 'The Availability dates could not be updated.', 'booking' ) );
		}

		return array( 'changed_dates' => count( $dates ), 'changed_intervals' => 0 );
	}

	/**
	 * Merge or subtract manual timed intervals per local date.
	 *
	 * @param int               $resource_id Authorized Booking Resource ID.
	 * @param DateTimeImmutable $start       Inclusive instant.
	 * @param DateTimeImmutable $end         Exclusive instant.
	 * @param string            $mode        Block or unblock.
	 *
	 * @return array<string,mixed>|WP_Error Change counts or safe error.
	 */
	private function apply_timed( $resource_id, $start, $end, $mode ) {
		if ( ! function_exists( 'wpbc_availability_timeslots__table_name' ) || ! function_exists( 'wpbc_is_table_exists' ) || ! wpbc_is_table_exists( 'booking_availability_timeslots' ) ) {
			return new WP_Error( 'wpbc_timeline_timed_block_unavailable', __( 'Timed Availability is not available.', 'booking' ) );
		}

		$intervals_by_date = $this->split_by_date( $start, $end );
		$group_uid        = wp_generate_uuid4();
		$changed          = 0;
		foreach ( $intervals_by_date as $date => $requested_intervals ) {
			$existing = $this->get_manual_intervals( $resource_id, $date );
			if ( is_wp_error( $existing ) ) {
				return $existing;
			}
			$next = $existing;
			foreach ( $requested_intervals as $requested_interval ) {
				$next = 'unblock' === $mode
					? $this->subtract_interval( $next, $requested_interval )
					: $this->merge_intervals( array_merge( $next, array( $requested_interval ) ) );
			}
			$replace_result = $this->replace_manual_intervals( $resource_id, $date, $next, $group_uid );
			if ( is_wp_error( $replace_result ) ) {
				return $replace_result;
			}
			$changed += count( $requested_intervals );
		}

		return array( 'changed_dates' => count( $intervals_by_date ), 'changed_intervals' => $changed );
	}

	/**
	 * Split an absolute range into local date and seconds-in-day intervals.
	 *
	 * @param DateTimeImmutable $start Inclusive instant.
	 * @param DateTimeImmutable $end   Exclusive instant.
	 *
	 * @return array<string,array<int,array<int,int>>> Intervals keyed by date.
	 */
	private function split_by_date( $start, $end ) {
		$intervals = array();
		$current   = $start;
		while ( $current < $end ) {
			$day_start   = $current->setTime( 0, 0, 0 );
			$day_end     = $day_start->modify( '+1 day' );
			$part_end    = $end < $day_end ? $end : $day_end;
			$start_second = ( (int) $current->format( 'H' ) * HOUR_IN_SECONDS ) + ( (int) $current->format( 'i' ) * MINUTE_IN_SECONDS ) + (int) $current->format( 's' );
			$end_second   = $part_end->getTimestamp() === $day_end->getTimestamp()
				? DAY_IN_SECONDS
				: ( (int) $part_end->format( 'H' ) * HOUR_IN_SECONDS ) + ( (int) $part_end->format( 'i' ) * MINUTE_IN_SECONDS ) + (int) $part_end->format( 's' );
			$intervals[ $day_start->format( 'Y-m-d' ) ][] = array( $start_second, $end_second );
			$current = $part_end;
		}

		return $intervals;
	}

	/**
	 * Load active intervals owned by the manual Availability source.
	 *
	 * @param int    $resource_id Booking Resource ID.
	 * @param string $date        SQL date.
	 *
	 * @return array<int,array<int,int>>|WP_Error Intervals or safe error.
	 */
	private function get_manual_intervals( $resource_id, $date ) {
		global $wpdb;

		$table = wpbc_availability_timeslots__table_name();
		$sql   = $wpdb->prepare(
			"SELECT start_second, end_second FROM {$table} WHERE resource_id = %d AND block_date = %s AND status = %s AND source = %s ORDER BY start_second, end_second",
			$resource_id,
			$date,
			'active',
			'manual'
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results( $sql, ARRAY_A );
		if ( '' !== (string) $wpdb->last_error ) {
			return new WP_Error( 'wpbc_timeline_timed_block_query_failed', __( 'Timed Availability could not be loaded.', 'booking' ) );
		}

		$intervals = array();
		foreach ( (array) $rows as $row ) {
			$intervals[] = array( absint( $row['start_second'] ), absint( $row['end_second'] ) );
		}

		return $this->merge_intervals( $intervals );
	}

	/**
	 * Replace only manual intervals for one date, preserving other sources.
	 *
	 * @param int                      $resource_id Booking Resource ID.
	 * @param string                   $date        SQL date.
	 * @param array<int,array<int,int>> $intervals  Normalized intervals.
	 * @param string                   $group_uid   Mutation group UUID.
	 *
	 * @return true|WP_Error Success or safe error.
	 */
	private function replace_manual_intervals( $resource_id, $date, $intervals, $group_uid ) {
		global $wpdb;

		$table = wpbc_availability_timeslots__table_name();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$deleted = $wpdb->delete( $table, array( 'resource_id' => $resource_id, 'block_date' => $date, 'status' => 'active', 'source' => 'manual' ), array( '%d', '%s', '%s', '%s' ) );
		if ( false === $deleted ) {
			return new WP_Error( 'wpbc_timeline_timed_block_update_failed', __( 'Timed Availability could not be updated.', 'booking' ) );
		}

		$now     = current_time( 'mysql' );
		$user_id = get_current_user_id();
		foreach ( $this->merge_intervals( $intervals ) as $interval ) {
			if ( $interval[0] >= $interval[1] ) {
				continue;
			}
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$inserted = $wpdb->insert(
				$table,
				array(
					'resource_id'       => $resource_id,
					'block_date'        => $date,
					'start_second'      => $interval[0],
					'end_second'        => $interval[1],
					'status'            => 'active',
					'group_uid'         => $group_uid,
					'source'            => 'manual',
					'note'              => '',
					'created_by'        => $user_id,
					'modified_by'       => $user_id,
					'creation_date'     => $now,
					'modification_date' => $now,
				),
				array( '%d', '%s', '%d', '%d', '%s', '%s', '%s', '%s', '%d', '%d', '%s', '%s' )
			);
			if ( false === $inserted ) {
				return new WP_Error( 'wpbc_timeline_timed_block_update_failed', __( 'Timed Availability could not be updated.', 'booking' ) );
			}
		}

		return true;
	}

	/**
	 * Merge intersecting seconds-in-day intervals.
	 *
	 * @param array<int,array<int,int>> $intervals Candidate intervals.
	 *
	 * @return array<int,array<int,int>> Merged intervals.
	 */
	private function merge_intervals( $intervals ) {
		if ( function_exists( 'wpbc_merge_intersected_intervals' ) ) {
			return wpbc_merge_intersected_intervals( $intervals );
		}
		usort( $intervals, static function ( $left, $right ) { return (int) $left[0] - (int) $right[0]; } );
		$merged = array();
		foreach ( $intervals as $interval ) {
			$start = max( 0, min( DAY_IN_SECONDS, (int) $interval[0] ) );
			$end   = max( 0, min( DAY_IN_SECONDS, (int) $interval[1] ) );
			if ( $start >= $end ) {
				continue;
			}
			$last_index = count( $merged ) - 1;
			if ( 0 <= $last_index && $start <= $merged[ $last_index ][1] ) {
				$merged[ $last_index ][1] = max( $merged[ $last_index ][1], $end );
			} else {
				$merged[] = array( $start, $end );
			}
		}

		return $merged;
	}

	/**
	 * Subtract one interval from a normalized interval list.
	 *
	 * @param array<int,array<int,int>> $intervals       Existing intervals.
	 * @param array<int,int>            $remove_interval Interval to remove.
	 *
	 * @return array<int,array<int,int>> Remaining intervals.
	 */
	private function subtract_interval( $intervals, $remove_interval ) {
		if ( function_exists( 'wpbc_availability_timeslots__subtract_interval' ) ) {
			return wpbc_availability_timeslots__subtract_interval( $intervals, $remove_interval );
		}
		$result       = array();
		$remove_start = (int) $remove_interval[0];
		$remove_end   = (int) $remove_interval[1];
		foreach ( $intervals as $interval ) {
			$start = (int) $interval[0];
			$end   = (int) $interval[1];
			if ( $remove_end <= $start || $remove_start >= $end ) {
				$result[] = array( $start, $end );
				continue;
			}
			if ( $start < $remove_start ) {
				$result[] = array( $start, min( $remove_start, $end ) );
			}
			if ( $end > $remove_end ) {
				$result[] = array( max( $remove_end, $start ), $end );
			}
		}

		return $this->merge_intervals( $result );
	}
}
