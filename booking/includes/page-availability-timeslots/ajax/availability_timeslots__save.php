<?php
/**
 * AJAX save endpoint for time slots availability.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Parse posted intervals.
 *
 * @return array
 */
function wpbc_availability_timeslots__get_posted_intervals() {

	$posted_intervals = isset( $_POST['intervals'] ) ? wp_unslash( $_POST['intervals'] ) : array(); // phpcs:ignore WordPress.Security.NonceVerification.Missing

	if ( is_string( $posted_intervals ) ) {
		$decoded = json_decode( $posted_intervals, true );
		if ( is_array( $decoded ) ) {
			$posted_intervals = $decoded;
		}
	}

	if ( ! is_array( $posted_intervals ) ) {
		return array();
	}

	$intervals = array();

	foreach ( $posted_intervals as $interval ) {
		if ( ! is_array( $interval ) || empty( $interval['date'] ) ) {
			continue;
		}

		if ( isset( $interval['start_second'], $interval['end_second'] ) ) {
			$start_second = $interval['start_second'];
			$end_second   = $interval['end_second'];
		} else {
			$start_second = isset( $interval['start'] ) ? intval( $interval['start'] ) * MINUTE_IN_SECONDS : 0;
			$end_second   = isset( $interval['end'] ) ? intval( $interval['end'] ) * MINUTE_IN_SECONDS : 0;
		}

		$normalized_interval = wpbc_availability_timeslots__normalize_interval( $interval['date'], $start_second, $end_second );
		if ( null !== $normalized_interval ) {
			$intervals[] = $normalized_interval;
		}
	}

	return $intervals;
}

/**
 * Group intervals by date.
 *
 * @param array $intervals Intervals.
 *
 * @return array
 */
function wpbc_availability_timeslots__group_intervals_by_date( $intervals ) {

	$grouped = array();

	foreach ( $intervals as $interval ) {
		if ( ! isset( $grouped[ $interval['date'] ] ) ) {
			$grouped[ $interval['date'] ] = array();
		}
		$grouped[ $interval['date'] ][] = array(
			(int) $interval['start_second'],
			(int) $interval['end_second'],
		);
	}

	return $grouped;
}

/**
 * Subtract one interval from a list of intervals.
 *
 * @param array $intervals Intervals.
 * @param array $remove_interval Interval to remove.
 *
 * @return array
 */
function wpbc_availability_timeslots__subtract_interval( $intervals, $remove_interval ) {

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

	return wpbc_merge_intersected_intervals( $result );
}

/**
 * Get existing active intervals for one date/resource.
 *
 * @param int    $resource_id Resource ID.
 * @param string $date Date.
 *
 * @return array
 */
function wpbc_availability_timeslots__get_existing_intervals_for_date( $resource_id, $date ) {

	$rows      = wpbc_availability_timeslots__get_intervals_for_resources(
		array(
			'resource_id' => $resource_id,
			'date_start'  => $date,
			'date_end'    => $date,
			'use_cache'   => false,
		)
	);
	$intervals = array();

	if ( ! empty( $rows[ $date ][ $resource_id ] ) ) {
		foreach ( $rows[ $date ][ $resource_id ] as $row ) {
			$intervals[] = array(
				(int) $row['start_second'],
				(int) $row['end_second'],
			);
		}
	}

	return wpbc_merge_intersected_intervals( $intervals );
}

/**
 * Replace active intervals for one resource/date.
 *
 * @param int    $resource_id Resource ID.
 * @param string $date Date.
 * @param array  $intervals Intervals.
 * @param string $group_uid Group UID.
 *
 * @return void
 */
function wpbc_availability_timeslots__replace_intervals_for_date( $resource_id, $date, $intervals, $group_uid ) {

	global $wpdb;

	$table           = wpbc_availability_timeslots__table_name();
	$current_user_id = wpbc_get_current_user_id();
	$now             = current_time( 'mysql' );
	$intervals       = wpbc_merge_intersected_intervals( $intervals );

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	$wpdb->delete(
		$table,
		array(
			'resource_id' => $resource_id,
			'block_date'  => $date,
			'status'      => 'active',
		),
		array( '%d', '%s', '%s' )
	);

	foreach ( $intervals as $interval ) {
		if ( (int) $interval[0] >= (int) $interval[1] ) {
			continue;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$wpdb->insert(
			$table,
			array(
				'resource_id'       => $resource_id,
				'block_date'        => $date,
				'start_second'      => (int) $interval[0],
				'end_second'        => (int) $interval[1],
				'status'            => 'active',
				'group_uid'         => $group_uid,
				'source'            => 'manual',
				'note'              => '',
				'created_by'        => $current_user_id,
				'modified_by'       => $current_user_id,
				'creation_date'     => $now,
				'modification_date' => $now,
			),
			array( '%d', '%s', '%d', '%d', '%s', '%s', '%s', '%s', '%d', '%d', '%s', '%s' )
		);
	}
}

/**
 * Delete intervals by IDs.
 *
 * @param array $ids IDs.
 *
 * @return int
 */
function wpbc_availability_timeslots__delete_by_ids( $ids ) {

	global $wpdb;

	$ids = array_values( array_filter( array_map( 'intval', $ids ) ) );
	if ( empty( $ids ) ) {
		return 0;
	}

	$table        = wpbc_availability_timeslots__table_name();
	$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
	$query_values = $ids;

	$sql = $wpdb->prepare(
		"DELETE FROM {$table}
		  WHERE timeslot_id IN ({$placeholders})",
		$query_values
	);

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.PreparedSQL.NotPrepared
	return (int) $wpdb->query( $sql );
}

/**
 * AJAX: save blocked/unblocked time slots.
 *
 * @return void
 */
function wpbc_availability_timeslots_ajax_save() {

	$nonce_result = check_ajax_referer( 'wpbc_availability_timeslots_ajax_nonce', 'nonce', false );
	if ( false === $nonce_result ) {
		wp_send_json_error( array( 'message' => __( 'Security check failed.', 'booking' ) ), 403 );
	}

	if ( ! current_user_can( wpbc_availability_timeslots__get_manage_cap() ) ) {
		wp_send_json_error( array( 'message' => __( 'You do not have permission to change availability.', 'booking' ) ), 403 );
	}

	$resource_id = isset( $_POST['resource_id'] ) ? intval( $_POST['resource_id'] ) : wpbc_get_default_resource(); // phpcs:ignore WordPress.Security.NonceVerification.Missing
	$mode        = isset( $_POST['mode'] ) ? sanitize_key( wp_unslash( $_POST['mode'] ) ) : 'block'; // phpcs:ignore WordPress.Security.NonceVerification.Missing
	$intervals   = wpbc_availability_timeslots__get_posted_intervals();
	$group_uid   = wp_generate_uuid4();

	if ( 'delete' === $mode ) {
		$ids     = isset( $_POST['ids'] ) ? wp_unslash( $_POST['ids'] ) : array(); // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$ids     = is_array( $ids ) ? $ids : json_decode( $ids, true );
		$changed = wpbc_availability_timeslots__delete_by_ids( is_array( $ids ) ? $ids : array() );
		wp_send_json_success(
			array(
				'changed' => $changed,
			)
		);
	}

	if ( empty( $intervals ) ) {
		wp_send_json_error( array( 'message' => __( 'No time slots selected.', 'booking' ) ), 400 );
	}

	$grouped_intervals = wpbc_availability_timeslots__group_intervals_by_date( $intervals );
	$changed_dates     = array();

	foreach ( $grouped_intervals as $date => $new_intervals ) {
		$existing_intervals = wpbc_availability_timeslots__get_existing_intervals_for_date( $resource_id, $date );

		if ( 'unblock' === $mode ) {
			$next_intervals = $existing_intervals;
			foreach ( wpbc_merge_intersected_intervals( $new_intervals ) as $remove_interval ) {
				$next_intervals = wpbc_availability_timeslots__subtract_interval( $next_intervals, $remove_interval );
			}
		} else {
			$next_intervals = wpbc_merge_intersected_intervals( array_merge( $existing_intervals, $new_intervals ) );
		}

		wpbc_availability_timeslots__replace_intervals_for_date( $resource_id, $date, $next_intervals, $group_uid );
		$changed_dates[] = $date;
	}

	sort( $changed_dates );

	$saved_intervals = wpbc_availability_timeslots__get_intervals_for_resources(
		array(
			'resource_id' => $resource_id,
			'date_start'  => $changed_dates[0],
			'date_end'    => $changed_dates[ count( $changed_dates ) - 1 ],
			'use_cache'   => false,
		)
	);

	wp_send_json_success(
		array(
			'resource_id' => $resource_id,
			'mode'        => $mode,
			'group_uid'   => $group_uid,
			'dates'       => $changed_dates,
			'intervals'   => $saved_intervals,
		)
	);
}
add_action( 'wp_ajax_WPBC_AJX_AVAILABILITY_TIMESLOTS_SAVE', 'wpbc_availability_timeslots_ajax_save' );
