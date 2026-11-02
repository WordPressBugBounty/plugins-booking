<?php
/**
 * Booking Inspector optimistic-lock fingerprint.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build a signed, user- and site-bound snapshot identifier for one booking.
 */
final class WPBC_Booking_Inspector_Fingerprint {

	/**
	 * Build a fingerprint without exposing raw storage values to the browser.
	 *
	 * @param array<string,mixed>                    $booking Authorized booking record.
	 * @param array<string,array<string,mixed>>|null $notes   Normalized notes contract.
	 *
	 * @return string Signed snapshot fingerprint.
	 */
	public static function build( $booking, $notes = null ) {
		$note_values = array();
		foreach ( array( 'public', 'private' ) as $note_type ) {
			$note_values[ $note_type ] = is_array( $notes ) && isset( $notes[ $note_type ] ) && is_array( $notes[ $note_type ] )
				? array(
					'state' => isset( $notes[ $note_type ]['state'] ) ? (string) $notes[ $note_type ]['state'] : '',
					'value' => array_key_exists( 'value', $notes[ $note_type ] ) ? $notes[ $note_type ]['value'] : null,
				)
				: null;
		}

		$fingerprint_payload = array(
			'site_id'           => function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0,
			'user_id'           => function_exists( 'get_current_user_id' ) ? absint( get_current_user_id() ) : 0,
			'booking_id'        => isset( $booking['booking_id'] ) ? absint( $booking['booking_id'] ) : 0,
			'modification_date' => isset( $booking['modification_date'] ) ? (string) $booking['modification_date'] : '',
			'form'              => isset( $booking['form'] ) ? (string) $booking['form'] : '',
			'cost'              => array_key_exists( 'cost', $booking ) ? $booking['cost'] : null,
			'pay_status'        => isset( $booking['pay_status'] ) ? (string) $booking['pay_status'] : '',
			'notes'             => $note_values,
		);
		$fingerprint_json = wp_json_encode( $fingerprint_payload );

		return hash_hmac( 'sha256', is_string( $fingerprint_json ) ? $fingerprint_json : '', wp_salt( 'nonce' ) );
	}
}
