<?php
/**
 * Booking activity request validation.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize the data-only paginated activity request contract.
 */
final class WPBC_Booking_Activity_Request_Validator {

	/** @var array<int,string> Server-owned host identifiers allowed by the caller. */
	private $allowed_sources;

	/**
	 * Construct a host-neutral validator with a server-owned source allow list.
	 *
	 * @param array<int,string> $allowed_sources Host identifiers permitted by the adapter.
	 */
	public function __construct( $allowed_sources = array() ) {
		$this->allowed_sources = array_values( array_unique( array_filter( array_map( 'sanitize_key', $allowed_sources ) ) ) );
	}

	/**
	 * Validate a browser activity request.
	 *
	 * Authorization is intentionally performed by the Booking Inspector service;
	 * this validator only accepts the identifiers and bounds needed by the read.
	 *
	 * @param array<string,mixed> $request_payload Candidate request values.
	 *
	 * @return array<string,mixed>|WP_Error Normalized request or safe error.
	 */
	public function validate( $request_payload ) {
		$request_payload = is_array( $request_payload ) ? $request_payload : array();
		$booking_id      = isset( $request_payload['booking_id'] ) ? absint( $request_payload['booking_id'] ) : 0;
		$source          = isset( $request_payload['source'] ) && is_scalar( $request_payload['source'] )
			? sanitize_key( (string) $request_payload['source'] )
			: '';
		if ( ! $booking_id || ! in_array( $source, $this->allowed_sources, true ) ) {
			return new WP_Error(
				'wpbc_booking_activity_invalid_request',
				__( 'Booking activity could not be loaded. Try again.', 'booking' ),
				array( 'status' => 400 )
			);
		}

		return array(
			'booking_id' => $booking_id,
			'source'     => $source,
			'page'       => max( 1, isset( $request_payload['page'] ) ? absint( $request_payload['page'] ) : 1 ),
			'per_page'   => min( 50, max( 1, isset( $request_payload['per_page'] ) ? absint( $request_payload['per_page'] ) : 20 ) ),
		);
	}
}
