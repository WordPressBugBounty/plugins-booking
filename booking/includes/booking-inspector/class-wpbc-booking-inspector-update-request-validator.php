<?php
/**
 * Booking Inspector update-request normalization.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize the explicit data-only booking-details mutation contract.
 */
final class WPBC_Booking_Inspector_Update_Request_Validator {

	/** Maximum accepted JSON request size. */
	const MAX_PAYLOAD_BYTES = 262144;

	/**
	 * Validate identifiers and decode the bounded JSON draft.
	 *
	 * @param mixed $request_payload Untrusted request payload.
	 *
	 * @return array<string,mixed>|WP_Error Normalized request or safe validation error.
	 */
	public function normalize( $request_payload ) {
		$request_payload   = is_array( $request_payload ) ? $request_payload : array();
		$booking_id        = isset( $request_payload['booking_id'] ) && is_scalar( $request_payload['booking_id'] ) ? absint( $request_payload['booking_id'] ) : 0;
		$source_identifier = isset( $request_payload['source'] ) && is_scalar( $request_payload['source'] ) ? sanitize_key( (string) $request_payload['source'] ) : '';
		$fingerprint       = isset( $request_payload['fingerprint'] ) && is_scalar( $request_payload['fingerprint'] ) ? strtolower( trim( (string) $request_payload['fingerprint'] ) ) : '';
		$draft_json        = isset( $request_payload['draft'] ) && is_scalar( $request_payload['draft'] ) ? (string) $request_payload['draft'] : '';

		if ( ! $booking_id || ! WPBC_Booking_Inspector_Config::is_allowed_source( $source_identifier ) || ! preg_match( '/^[a-f0-9]{64}$/', $fingerprint ) ) {
			return $this->get_invalid_error();
		}
		if ( '' === $draft_json || self::MAX_PAYLOAD_BYTES < strlen( $draft_json ) ) {
			return $this->get_invalid_error();
		}

		$draft = json_decode( $draft_json, true );
		if ( ! is_array( $draft ) || JSON_ERROR_NONE !== json_last_error() ) {
			return $this->get_invalid_error();
		}

		return array(
			'booking_id'          => $booking_id,
			'source'              => $source_identifier,
			'fingerprint'         => $fingerprint,
			'draft'               => $draft,
			'send_modified_email' => isset( $request_payload['send_modified_email'] ) && '1' === (string) $request_payload['send_modified_email'],
		);
	}

	/**
	 * Return the uniform malformed-update response.
	 *
	 * @return WP_Error Safe validation error.
	 */
	private function get_invalid_error() {
		return new WP_Error(
			'wpbc_booking_inspector_update_invalid',
			__( 'The booking changes are invalid. Reload the booking and try again.', 'booking' ),
			array( 'status' => 400 )
		);
	}
}
