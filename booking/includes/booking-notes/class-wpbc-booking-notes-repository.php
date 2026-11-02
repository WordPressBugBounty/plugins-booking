<?php
/**
 * Canonical Booking Notes repository.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Read canonical public and legacy private note storage for one booking.
 */
final class WPBC_Booking_Notes_Repository {

	/**
	 * Load stored note values without collapsing NULL and empty strings.
	 *
	 * Authorization must be completed by the calling domain before this method
	 * is used. The optional legacy `remark` column exists only in paid editions.
	 *
	 * @param int  $booking_id                   Authorized booking ID.
	 * @param bool $include_legacy_private_note Whether the active edition owns the legacy remark column.
	 *
	 * @return array<string,mixed>|WP_Error|null Stored values, safe query error, or null when missing.
	 */
	public function get_booking_notes( $booking_id, $include_legacy_private_note ) {
		return $this->query_booking_notes( $booking_id, $include_legacy_private_note, false );
	}

	/**
	 * Load notes for an internal email composition workflow.
	 *
	 * Email notifications may be composed immediately after a booking is moved
	 * to Trash, so this trusted internal read does not apply the Inspector's
	 * active-booking restriction. The email integration remains responsible for
	 * suppressing private notes in customer templates.
	 *
	 * @param int  $booking_id                   Canonical booking ID.
	 * @param bool $include_legacy_private_note Whether legacy remark storage is needed.
	 *
	 * @return array<string,mixed>|WP_Error|null Stored values, safe query error, or null when missing.
	 */
	public function get_booking_notes_for_email( $booking_id, $include_legacy_private_note ) {
		return $this->query_booking_notes( $booking_id, $include_legacy_private_note, true );
	}

	/**
	 * Execute one schema-gated notes query.
	 *
	 * @param int  $booking_id                   Canonical booking ID.
	 * @param bool $include_legacy_private_note Whether legacy remark storage is needed.
	 * @param bool $include_trashed              Whether an internal email may read a trashed booking.
	 *
	 * @return array<string,mixed>|WP_Error|null Stored values, safe query error, or null when missing.
	 */
	private function query_booking_notes( $booking_id, $include_legacy_private_note, $include_trashed ) {
		global $wpdb;

		$booking_id = absint( $booking_id );
		if ( ! $booking_id ) {
			return null;
		}

		$public_note_supported  = wpbc_booking_notes_column_exists( 'public_note' );
		$private_note_supported = $include_legacy_private_note && wpbc_booking_notes_column_exists( 'remark' );
		$selected_columns       = array( 'notes_bk.booking_id' );

		if ( $public_note_supported ) {
			$selected_columns[] = 'notes_bk.public_note';
		}
		if ( $private_note_supported ) {
			$selected_columns[] = 'notes_bk.remark AS private_note';
		}

		$selected_columns_sql = implode( ', ', $selected_columns );
		$trash_condition      = $include_trashed ? '' : ' AND notes_bk.trash = 0';
		$sql                  = $wpdb->prepare(
			"SELECT {$selected_columns_sql}
			 FROM {$wpdb->prefix}booking AS notes_bk
			 WHERE notes_bk.booking_id = %d{$trash_condition}
			 LIMIT 1",
			$booking_id
		); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Every column and optional fixed trash clause is repository-owned and schema-gated.

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared exact current-site booking lookup.
		$stored_notes = $wpdb->get_row( $sql, ARRAY_A );
		if ( '' !== (string) $wpdb->last_error ) {
			return new WP_Error(
				'wpbc_booking_notes_query_failed',
				__( 'Booking notes could not be loaded. Try again.', 'booking' )
			);
		}

		if ( ! is_array( $stored_notes ) ) {
			return null;
		}

		$stored_notes['public_note_supported']  = $public_note_supported;
		$stored_notes['private_note_supported'] = $private_note_supported;

		return $stored_notes;
	}

	/**
	 * Persist one legacy private note for an authorized set of bookings.
	 *
	 * The calling service validates support and input. This repository owns the
	 * prepared database update so endpoints and templates never contain note SQL.
	 *
	 * @param array<int,int> $booking_ids Authorized booking IDs.
	 * @param string         $private_note Sanitized private note, including an explicit empty string.
	 *
	 * @return true|WP_Error True after persistence, or a safe database error.
	 */
	public function update_private_note( $booking_ids, $private_note ) {
		global $wpdb;

		$booking_ids = array_values( array_unique( array_filter( array_map( 'absint', $booking_ids ) ) ) );
		if ( empty( $booking_ids ) ) {
			return new WP_Error(
				'wpbc_booking_notes_invalid_booking',
				__( 'No bookings have been selected. Please select one or more bookings.', 'booking' )
			);
		}

		$id_placeholders = implode( ', ', array_fill( 0, count( $booking_ids ), '%d' ) );
		$query_values    = array_merge( array( $private_note ), $booking_ids );
		$prepared_sql    = $wpdb->prepare(
			"UPDATE {$wpdb->prefix}booking SET remark = %s WHERE booking_id IN ({$id_placeholders})",
			$query_values
		); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Placeholders are repository-created for normalized integer IDs.

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared canonical note mutation.
		$update_result = $wpdb->query( $prepared_sql );
		if ( false === $update_result ) {
			return new WP_Error(
				'wpbc_booking_notes_update_failed',
				__( 'The private note could not be saved. Try again.', 'booking' )
			);
		}

		return true;
	}
}
