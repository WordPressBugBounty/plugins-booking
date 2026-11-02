<?php
/**
 * Booking Inspector request normalization.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize the explicit data-only Inspector request contract.
 */
final class WPBC_Booking_Inspector_Request_Validator {

	/**
	 * Copy and validate supported request values.
	 *
	 * @param mixed $request_payload Untrusted request payload.
	 *
	 * @return array<string,mixed>|WP_Error Normalized request or validation error.
	 */
	public function normalize( $request_payload ) {
		$request_payload = is_array( $request_payload ) ? $request_payload : array();
		$booking_id        = isset( $request_payload['booking_id'] ) && is_scalar( $request_payload['booking_id'] ) ? absint( $request_payload['booking_id'] ) : 0;
		$source_identifier = isset( $request_payload['source'] ) && is_scalar( $request_payload['source'] ) ? sanitize_key( (string) $request_payload['source'] ) : '';

		if ( ! $booking_id || ! WPBC_Booking_Inspector_Config::is_allowed_source( $source_identifier ) ) {
			return new WP_Error(
				'wpbc_booking_inspector_request_invalid',
				__( 'The booking details request is invalid.', 'booking' ),
				array( 'status' => 400 )
			);
		}

		return array(
			'booking_id' => $booking_id,
			'source'     => $source_identifier,
		);
	}
}
