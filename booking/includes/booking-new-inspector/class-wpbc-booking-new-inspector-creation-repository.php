<?php
/**
 * Authoritative creation readback and bounded compensation repository.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads only bookings carrying the server-persisted Apply marker.
 */
final class WPBC_Booking_New_Inspector_Creation_Repository {

	/**
	 * Resolve an Apply-created booking from its unguessable marker.
	 *
	 * @param string $marker Lowercase SHA-256 marker.
	 * @return array<string,mixed>|null Authoritative readback or null.
	 */
	public function find_by_marker( $marker ) {
		if ( ! preg_match( '/^[a-f0-9]{64}$/', (string) $marker ) ) {
			return null;
		}
		global $wpdb;
		$like_marker = '%' . $wpdb->esc_like( (string) $marker ) . '%';
		$like_key    = '%' . $wpdb->esc_like( 'wpbc_creation_idempotency' ) . '%';
		$selected_columns = array( 'booking_id', 'booking_type', 'form', 'booking_options', 'creation_date', 'modification_date' );
		if ( function_exists( 'wpbc_booking_notes_column_exists' ) && wpbc_booking_notes_column_exists( 'public_note' ) ) {
			$selected_columns[] = 'public_note';
		}
		if ( function_exists( 'wpbc_booking_notes_column_exists' ) && wpbc_booking_notes_column_exists( 'remark' ) ) {
			$selected_columns[] = 'remark AS private_note';
		}
		$selected_column_sql = implode( ', ', $selected_columns );
		$sql         = $wpdb->prepare(
			"SELECT {$selected_column_sql} FROM {$wpdb->prefix}booking WHERE booking_options LIKE %s AND booking_options LIKE %s ORDER BY booking_id DESC LIMIT 1",
			$like_key,
			$like_marker
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Marker readback must bypass stale caches after an ambiguous canonical save.
		$booking_row = $wpdb->get_row( $sql, ARRAY_A );
		if ( ! is_array( $booking_row ) || ! $this->row_has_marker( $booking_row, $marker ) ) {
			return null;
		}

		return $this->build_readback( $booking_row );
	}

	/**
	 * Remove a proven marker-owned orphan that has no date rows.
	 *
	 * This compensation is intentionally unavailable once even one date exists;
	 * a persisted booking must then be reported as created with warnings.
	 *
	 * @param string $marker Lowercase SHA-256 marker.
	 * @return bool True when no orphan remains.
	 */
	public function compensate_orphan_without_dates( $marker ) {
		$readback = $this->find_by_marker( $marker );
		if ( null === $readback ) {
			return true;
		}
		if ( ! empty( $readback['dates'] ) ) {
			return false;
		}
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Bounded compensation deletes only the exact marker-owned, date-less row.
		$deleted = $wpdb->delete( $wpdb->prefix . 'booking', array( 'booking_id' => absint( $readback['id'] ) ), array( '%d' ) );
		return false !== $deleted;
	}

	/**
	 * Confirm that the decoded booking-options value contains the exact marker.
	 *
	 * @param array<string,mixed> $booking_row Candidate database row.
	 * @param string              $marker      Expected marker.
	 * @return bool True only for the exact structured marker.
	 */
	private function row_has_marker( $booking_row, $marker ) {
		$options = maybe_unserialize( isset( $booking_row['booking_options'] ) ? $booking_row['booking_options'] : '' );
		return is_array( $options )
			&& isset( $options['wpbc_creation_idempotency']['marker'] )
			&& hash_equals( $marker, (string) $options['wpbc_creation_idempotency']['marker'] );
	}

	/**
	 * Build a JSON-safe booking DTO from one authorized internal row.
	 *
	 * @param array<string,mixed> $booking_row Marker-authorized database row.
	 * @return array<string,mixed> Created-booking DTO.
	 */
	private function build_readback( $booking_row ) {
		global $wpdb;
		$booking_id = absint( $booking_row['booking_id'] );
		$sql        = $wpdb->prepare(
			"SELECT booking_date, approved FROM {$wpdb->prefix}bookingdates WHERE booking_id = %d ORDER BY booking_date ASC",
			$booking_id
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Authoritative post-save readback.
		$date_rows = $wpdb->get_results( $sql, ARRAY_A );
		$dates     = array();
		$approved  = true;
		foreach ( is_array( $date_rows ) ? $date_rows : array() as $date_row ) {
			$dates[]  = sanitize_text_field( (string) $date_row['booking_date'] );
			$approved = $approved && 1 === absint( $date_row['approved'] );
		}
		$parsed_form = function_exists( 'wpbc_get_parsed_booking_data_arr' )
			? wpbc_get_parsed_booking_data_arr( (string) $booking_row['form'], absint( $booking_row['booking_type'] ), array( 'get' => 'value' ) )
			: array();
		$saved_cost  = isset( $parsed_form['total_bk_cost'] ) && is_scalar( $parsed_form['total_bk_cost'] ) ? (string) $parsed_form['total_bk_cost'] : '';
		$notes       = array();
		if ( array_key_exists( 'public_note', $booking_row ) ) {
			$notes['public'] = sanitize_textarea_field( (string) $booking_row['public_note'] );
		}
		if ( array_key_exists( 'private_note', $booking_row ) ) {
			$notes['private'] = sanitize_textarea_field( (string) $booking_row['private_note'] );
		}

		return array(
			'id'             => $booking_id,
			'resource_id'    => absint( $booking_row['booking_type'] ),
			'status'         => $dates && $approved ? 'approved' : 'pending',
			'dates'          => $dates,
			'creation_date'  => sanitize_text_field( (string) $booking_row['creation_date'] ),
			'modified_date'  => sanitize_text_field( (string) $booking_row['modification_date'] ),
			'saved_cost'     => sanitize_text_field( $saved_cost ),
			'notes'          => $notes,
		);
	}
}
