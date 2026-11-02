<?php
/**
 * Booking activity persistence repository.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Own all SQL for the append-only booking activity stream.
 */
final class WPBC_Booking_Activity_Repository {

	/** @var bool Whether the last insert call created a new immutable row. */
	private $last_insert_was_created = false;

	/**
	 * Insert one normalized event, returning the existing ID on a safe retry.
	 *
	 * @param array<string,mixed> $event Normalized persistence record.
	 *
	 * @return int|WP_Error Activity ID or a safe persistence error.
	 */
	public function insert_event( $event ) {
		global $wpdb;
		$this->last_insert_was_created = false;

		$table_name = wpbc_booking_activity_table_name();
		$existing_id = $this->get_event_id_by_idempotency_key( $event['idempotency_key'] );
		if ( $existing_id ) {
			return $existing_id;
		}
		$insert_sql = $wpdb->prepare(
			"INSERT INTO {$table_name}
				(booking_id, resource_id, event_type, event_payload, actor_user_id, event_source, subject_hash, idempotency_key, occurred_at, created_at)
			 VALUES (%d, %d, %s, %s, %d, %s, %s, %s, %s, %s)
			 ON DUPLICATE KEY UPDATE activity_id = LAST_INSERT_ID(activity_id)",
			absint( $event['booking_id'] ),
			absint( $event['resource_id'] ),
			sanitize_key( $event['event_type'] ),
			wp_json_encode( $event['event_payload'] ),
			absint( $event['actor_user_id'] ),
			sanitize_key( $event['event_source'] ),
			sanitize_text_field( $event['subject_hash'] ),
			sanitize_text_field( $event['idempotency_key'] ),
			sanitize_text_field( $event['occurred_at'] ),
			sanitize_text_field( $event['created_at'] )
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery -- Prepared append-only domain write with atomic retry recovery.
		$inserted = $wpdb->query( $insert_sql );

		if ( false !== $inserted ) {
			$this->last_insert_was_created = ( 1 === (int) $inserted );
			$activity_id = absint( $wpdb->insert_id );
			return $activity_id ? $activity_id : $this->get_event_id_by_idempotency_key( $event['idempotency_key'] );
		}

		$existing_id = $this->get_event_id_by_idempotency_key( $event['idempotency_key'] );
		if ( $existing_id ) {
			return $existing_id;
		}

		return new WP_Error(
			'wpbc_booking_activity_insert_failed',
			__( 'Booking activity could not be recorded.', 'booking' )
		);
	}

	/**
	 * Report whether the preceding insert created, rather than reused, an event.
	 *
	 * @return bool True only when a new immutable row was inserted.
	 */
	public function was_last_insert_created() {
		return $this->last_insert_was_created;
	}

	/**
	 * Return one event ID by its immutable idempotency key.
	 *
	 * @param string $idempotency_key SHA-256 operation key.
	 *
	 * @return int Existing activity ID or zero.
	 */
	public function get_event_id_by_idempotency_key( $idempotency_key ) {
		global $wpdb;

		$sql = $wpdb->prepare(
			'SELECT activity_id FROM ' . wpbc_booking_activity_table_name() . ' WHERE idempotency_key = %s LIMIT 1',
			(string) $idempotency_key
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared repository lookup.
		return absint( $wpdb->get_var( $sql ) );
	}

	/**
	 * Return the newest activity ID for a booking.
	 *
	 * The append service uses this immutable stream position when a canonical
	 * mutation cannot supply its own stable operation identifier. Concurrent
	 * retries therefore derive the same key, while a later real state
	 * transition follows a different stream position.
	 *
	 * @param int $booking_id Booking ID.
	 *
	 * @return int Latest activity ID or zero when the stream is empty.
	 */
	public function get_latest_event_id( $booking_id ) {
		$latest_event = $this->get_latest_event( $booking_id );

		return is_array( $latest_event ) && isset( $latest_event['activity_id'] )
			? absint( $latest_event['activity_id'] )
			: 0;
	}

	/**
	 * Return the newest normalized activity record for a booking.
	 *
	 * The append service compares this immutable record with a retry candidate
	 * before deriving the next stream-position key. This makes an immediate
	 * cross-request retry return the original event while still allowing the
	 * same event type after an intervening state transition.
	 *
	 * @param int $booking_id Booking ID.
	 *
	 * @return array<string,mixed>|null Latest normalized event or null.
	 */
	public function get_latest_event( $booking_id ) {
		global $wpdb;

		$sql = $wpdb->prepare(
			'SELECT activity_id, booking_id, resource_id, event_type, event_payload, actor_user_id, event_source FROM ' . wpbc_booking_activity_table_name() . ' WHERE booking_id = %d ORDER BY activity_id DESC LIMIT 1',
			absint( $booking_id )
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared immutable stream-position lookup.
		$latest_event = $wpdb->get_row( $sql, ARRAY_A );
		if ( ! is_array( $latest_event ) ) {
			return null;
		}

		$decoded_payload = json_decode( (string) $latest_event['event_payload'], true );
		$latest_event['event_payload'] = is_array( $decoded_payload ) ? $decoded_payload : array();

		return $latest_event;
	}

	/**
	 * Return one reverse-chronological page for an authorized booking.
	 *
	 * @param int $booking_id Booking ID.
	 * @param int $page       One-based page number.
	 * @param int $per_page   Bounded page size.
	 *
	 * @return array<string,mixed>|WP_Error Raw repository page or safe error.
	 */
	public function get_booking_activity( $booking_id, $page, $per_page ) {
		global $wpdb;

		$booking_id = absint( $booking_id );
		$page       = max( 1, absint( $page ) );
		$per_page   = min( 50, max( 1, absint( $per_page ) ) );
		$offset     = ( $page - 1 ) * $per_page;
		$table_name = wpbc_booking_activity_table_name();
		$count_sql  = $wpdb->prepare( "SELECT COUNT(*) FROM {$table_name} WHERE booking_id = %d", $booking_id );
		$events_sql = $wpdb->prepare(
			"SELECT activity_id, booking_id, resource_id, event_type, event_payload, actor_user_id, event_source, occurred_at
			 FROM {$table_name}
			 WHERE booking_id = %d
			 ORDER BY activity_id DESC
			 LIMIT %d OFFSET %d",
			$booking_id,
			$per_page,
			$offset
		);

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared domain count.
		$total_items = absint( $wpdb->get_var( $count_sql ) );
		if ( '' !== (string) $wpdb->last_error ) {
			return new WP_Error(
				'wpbc_booking_activity_read_failed',
				__( 'Booking activity could not be loaded. Try again.', 'booking' )
			);
		}
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared domain page read.
		$events = $wpdb->get_results( $events_sql, ARRAY_A );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $events ) ) {
			return new WP_Error(
				'wpbc_booking_activity_read_failed',
				__( 'Booking activity could not be loaded. Try again.', 'booking' )
			);
		}

		return array(
			'events'     => $events,
			'pagination' => array(
				'page'        => $page,
				'per_page'    => $per_page,
				'total_items' => $total_items,
				'total_pages' => $total_items ? (int) ceil( $total_items / $per_page ) : 0,
			),
		);
	}

	/**
	 * Load the minimum booking context needed for privacy and event metadata.
	 *
	 * @param int $booking_id Booking ID.
	 *
	 * @return array<string,mixed>|null Booking context or null.
	 */
	public function get_booking_context( $booking_id ) {
		global $wpdb;

		$sql = $wpdb->prepare(
			'SELECT booking_id, booking_type, form, modification_date FROM ' . $wpdb->prefix . 'booking WHERE booking_id = %d LIMIT 1',
			absint( $booking_id )
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared current-site booking context.
		$row = $wpdb->get_row( $sql, ARRAY_A );

		return is_array( $row ) ? $row : null;
	}

	/**
	 * Return activity rows associated with a privacy subject hash.
	 *
	 * @param string $subject_hash SHA-256 normalized email hash.
	 * @param int    $page         One-based exporter page.
	 * @param int    $per_page     Export batch size.
	 *
	 * @return array<int,array<string,mixed>> Raw privacy rows.
	 */
	public function get_subject_activity( $subject_hash, $page, $per_page ) {
		global $wpdb;

		$offset = ( max( 1, absint( $page ) ) - 1 ) * absint( $per_page );
		$sql    = $wpdb->prepare(
			'SELECT activity_id, booking_id, event_type, occurred_at FROM ' . wpbc_booking_activity_table_name() . ' WHERE subject_hash = %s ORDER BY activity_id ASC LIMIT %d OFFSET %d',
			(string) $subject_hash,
			absint( $per_page ),
			$offset
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared privacy export read.
		$rows = $wpdb->get_results( $sql, ARRAY_A );

		return is_array( $rows ) ? $rows : array();
	}

	/**
	 * Erase activity linked to one privacy subject hash.
	 *
	 * @param string $subject_hash SHA-256 normalized email hash.
	 *
	 * @return int|WP_Error Deleted row count or safe error.
	 */
	public function erase_subject_activity( $subject_hash ) {
		global $wpdb;

		$deleted = $wpdb->delete(
			wpbc_booking_activity_table_name(),
			array( 'subject_hash' => (string) $subject_hash ),
			array( '%s' )
		); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Privacy eraser owns this domain table.

		return false === $deleted
			? new WP_Error( 'wpbc_booking_activity_erase_failed', __( 'Booking activity could not be erased.', 'booking' ) )
			: absint( $deleted );
	}
}
