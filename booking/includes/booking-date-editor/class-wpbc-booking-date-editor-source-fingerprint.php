<?php
/**
 * Booking Date Editor canonical source fingerprint.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build a signed identifier for the exact booking and booking-date rows read.
 *
 * The fingerprint lets a later review prove that its browser draft originated
 * from the same authorized canonical rows without returning those storage
 * values in the signed review plan.
 *
 * @since 12.0.0
 */
final class WPBC_Booking_Date_Editor_Source_Fingerprint {

	/**
	 * Build a user- and site-bound canonical source fingerprint.
	 *
	 * @param array<string,mixed>            $booking   Authorized booking record.
	 * @param array<int,array<string,mixed>> $date_rows Canonical booking-date rows.
	 *
	 * @return string Lowercase hexadecimal HMAC fingerprint.
	 */
	public static function build( $booking, $date_rows ) {
		$normalized_rows = array();
		foreach ( (array) $date_rows as $date_row ) {
			if ( ! is_array( $date_row ) ) {
				continue;
			}
			$normalized_rows[] = array(
				'booking_dates_id' => isset( $date_row['booking_dates_id'] ) ? absint( $date_row['booking_dates_id'] ) : 0,
				'booking_date'     => isset( $date_row['booking_date'] ) ? (string) $date_row['booking_date'] : '',
				'approved'         => ! empty( $date_row['approved'] ) ? 1 : 0,
				'resource_id'      => isset( $date_row['resource_id'] ) ? absint( $date_row['resource_id'] ) : 0,
			);
		}

		usort(
			$normalized_rows,
			static function ( $first_row, $second_row ) {
				$first_key  = sprintf( '%010d|%s|%d|%010d', $first_row['booking_dates_id'], $first_row['booking_date'], $first_row['approved'], $first_row['resource_id'] );
				$second_key = sprintf( '%010d|%s|%d|%010d', $second_row['booking_dates_id'], $second_row['booking_date'], $second_row['approved'], $second_row['resource_id'] );

				return strcmp( $first_key, $second_key );
			}
		);

		$fingerprint_payload = array(
			'version'           => 1,
			'site_id'           => function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0,
			'user_id'           => function_exists( 'get_current_user_id' ) ? absint( get_current_user_id() ) : 0,
			'effective_user_id' => function_exists( 'wpbc_get_current_user_id' ) ? absint( wpbc_get_current_user_id() ) : 0,
			'booking_id'        => isset( $booking['booking_id'] ) ? absint( $booking['booking_id'] ) : 0,
			'resource_id'       => isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0,
			'modification_date' => isset( $booking['modification_date'] ) ? (string) $booking['modification_date'] : '',
			'form'              => isset( $booking['form'] ) ? (string) $booking['form'] : '',
			'booking_options'   => isset( $booking['booking_options'] ) ? (string) $booking['booking_options'] : '',
			'status'            => isset( $booking['status'] ) ? (string) $booking['status'] : '',
			'date_rows'         => $normalized_rows,
		);
		$fingerprint_json = wp_json_encode( $fingerprint_payload );

		return hash_hmac(
			'sha256',
			'wpbc_booking_date_editor_source:v1:' . ( is_string( $fingerprint_json ) ? $fingerprint_json : '' ),
			wp_salt( 'nonce' )
		);
	}
}
