<?php
/**
 * Booking Overview lazy-details request validation.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize the bounded Booking Overview request contract.
 */
final class WPBC_Booking_Overview_Tooltip_Request_Validator {

	/**
	 * Validate untrusted request values without deriving authorization from them.
	 *
	 * @param mixed $request_payload Untrusted request payload.
	 *
	 * @return array<string,mixed>|WP_Error Normalized request or safe error.
	 */
	public function normalize( $request_payload ) {
		$request_payload = is_array( $request_payload ) ? $request_payload : array();
		$booking_id      = isset( $request_payload['booking_id'] ) && is_scalar( $request_payload['booking_id'] )
			? absint( $request_payload['booking_id'] )
			: 0;
		$source          = isset( $request_payload['source'] ) && is_scalar( $request_payload['source'] )
			? sanitize_key( (string) $request_payload['source'] )
			: '';

		if ( ! $booking_id || WPBC_Booking_Overview_Tooltip_Config::SOURCE_TIMELINE !== $source ) {
			return new WP_Error(
				'wpbc_booking_overview_tooltip_request_invalid',
				__( 'The booking overview request is invalid.', 'booking' ),
				array( 'status' => 400 )
			);
		}

		return array(
			'booking_id' => $booking_id,
			'source'     => $source,
		);
	}
}
