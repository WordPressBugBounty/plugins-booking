<?php
/**
 * Booking Date Editor apply request validation.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize the bounded signed-plan apply request before authorization.
 *
 * @since 12.0.0
 */
final class WPBC_Booking_Date_Editor_Apply_Request_Validator {

	/** Maximum encoded signed-plan size accepted before JSON decoding. */
	const MAX_PLAN_BYTES = 65536;

	/** @var WPBC_Booking_Inspector_Request_Validator Inspector request validator. */
	private $inspector_request_validator;

	/**
	 * Construct the validator with an optional Inspector request dependency.
	 *
	 * @param WPBC_Booking_Inspector_Request_Validator|null $inspector_request_validator Optional base validator.
	 */
	public function __construct( $inspector_request_validator = null ) {
		$this->inspector_request_validator = $inspector_request_validator ? $inspector_request_validator : new WPBC_Booking_Inspector_Request_Validator();
	}

	/**
	 * Normalize one untrusted apply request.
	 *
	 * The signed plan remains untrusted until the review service verifies its
	 * HMAC, account, site, expiry, target, and normalized proposal.
	 *
	 * @param mixed $request_payload Untrusted request values.
	 *
	 * @return array<string,mixed>|WP_Error Normalized request or safe error.
	 */
	public function normalize( $request_payload ) {
		$request_payload = is_array( $request_payload ) ? $request_payload : array();
		$base_request    = $this->inspector_request_validator->normalize( $request_payload );
		if ( is_wp_error( $base_request ) ) {
			return $base_request;
		}

		$token = isset( $request_payload['token'] ) && is_scalar( $request_payload['token'] )
			? strtolower( trim( (string) $request_payload['token'] ) )
			: '';
		if ( ! preg_match( '/^[a-f0-9]{64}$/', $token ) ) {
			return $this->get_invalid_request_error();
		}

		$plan = isset( $request_payload['plan'] ) ? $request_payload['plan'] : array();
		if ( is_string( $plan ) ) {
			if ( strlen( $plan ) > self::MAX_PLAN_BYTES ) {
				return $this->get_invalid_request_error();
			}
			$plan = json_decode( $plan, true );
			if ( JSON_ERROR_NONE !== json_last_error() ) {
				return $this->get_invalid_request_error();
			}
		}
		if ( ! is_array( $plan ) ) {
			return $this->get_invalid_request_error();
		}
		$encoded_plan = wp_json_encode( $plan );
		if ( ! is_string( $encoded_plan ) || strlen( $encoded_plan ) > self::MAX_PLAN_BYTES ) {
			return $this->get_invalid_request_error();
		}

		return array(
			'booking_id'         => $base_request['booking_id'],
			'source'             => $base_request['source'],
			'plan'               => $plan,
			'token'              => $token,
			'send_modified_email' => isset( $request_payload['send_modified_email'] ) && '1' === (string) $request_payload['send_modified_email'],
		);
	}

	/**
	 * Return the uniform malformed-apply error.
	 *
	 * @return WP_Error Safe request error.
	 */
	private function get_invalid_request_error() {
		return new WP_Error(
			'wpbc_booking_date_editor_apply_invalid',
			__( 'The reviewed booking date changes are invalid. Review the dates again.', 'booking' ),
			array( 'status' => 400 )
		);
	}
}
