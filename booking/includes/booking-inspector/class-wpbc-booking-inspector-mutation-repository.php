<?php
/**
 * Canonical Booking Inspector mutation repository.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Persist one allow-listed booking-row mutation with optimistic locking.
 */
final class WPBC_Booking_Inspector_Mutation_Repository {

	/**
	 * Persist an authorized Inspector update with optimistic locking.
	 *
	 * All editable Inspector values belong to the same canonical booking row.
	 * The previous modification timestamp is included in the WHERE clause so a
	 * concurrent editor cannot be silently overwritten.
	 *
	 * @param int                 $booking_id                 Authorized booking ID.
	 * @param string              $expected_modification_date Timestamp read by the editor.
	 * @param array<string,mixed> $column_values              Candidate canonical column values.
	 *
	 * @return true|WP_Error True after persistence, or a safe database/stale error.
	 */
	public function update_booking( $booking_id, $expected_modification_date, $column_values ) {
		global $wpdb;

		$allowed_columns = array( 'form', 'public_note', 'remark', 'cost', 'pay_status' );
		$update_values   = array();
		$update_formats  = array();
		foreach ( $allowed_columns as $allowed_column ) {
			if ( ! array_key_exists( $allowed_column, $column_values ) ) {
				continue;
			}
			$update_values[ $allowed_column ] = $column_values[ $allowed_column ];
			$update_formats[]                  = 'cost' === $allowed_column ? '%f' : '%s';
		}
		if ( empty( $update_values ) ) {
			return true;
		}

		$update_values['modification_date'] = current_time( 'mysql' );
		$update_formats[]                    = '%s';
		$where_values                       = array(
			'booking_id'        => absint( $booking_id ),
			'modification_date' => sanitize_text_field( (string) $expected_modification_date ),
			'trash'             => 0,
		);

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- This domain repository owns the canonical single-row mutation.
		$updated_rows = $wpdb->update(
			$wpdb->prefix . 'booking',
			$update_values,
			$where_values,
			$update_formats,
			array( '%d', '%s', '%d' )
		);
		if ( false === $updated_rows ) {
			return new WP_Error(
				'wpbc_booking_inspector_update_failed',
				__( 'Booking changes could not be saved. Try again.', 'booking' ),
				array( 'status' => 500 )
			);
		}
		if ( 0 === $updated_rows ) {
			return new WP_Error(
				'wpbc_booking_inspector_update_stale',
				__( 'This booking changed after it was opened. Reload it before saving.', 'booking' ),
				array( 'status' => 409 )
			);
		}

		return true;
	}
}
