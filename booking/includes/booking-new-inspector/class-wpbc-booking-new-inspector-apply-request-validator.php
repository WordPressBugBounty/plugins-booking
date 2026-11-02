<?php
/**
 * Request validation for Add New Booking Inspector Apply.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validates the bounded signed-plan envelope without granting authority.
 */
final class WPBC_Booking_New_Inspector_Apply_Request_Validator {

	/**
	 * Validate one Apply request.
	 *
	 * @param mixed $request_values Untrusted decoded request values.
	 * @return array<string,mixed>|WP_Error Normalized envelope or safe error.
	 */
	public function validate( $request_values ) {
		if ( ! is_array( $request_values ) ) {
			return $this->get_invalid_error();
		}
		$allowed_keys = array( 'schema_version', 'request_id', 'plan', 'token', 'idempotency_key' );
		if ( array_diff( array_keys( $request_values ), $allowed_keys ) ) {
			return $this->get_invalid_error();
		}
		$request_id      = isset( $request_values['request_id'] ) && is_scalar( $request_values['request_id'] ) ? trim( (string) $request_values['request_id'] ) : '';
		$token           = isset( $request_values['token'] ) && is_scalar( $request_values['token'] ) ? strtolower( trim( (string) $request_values['token'] ) ) : '';
		$idempotency_key = isset( $request_values['idempotency_key'] ) && is_scalar( $request_values['idempotency_key'] ) ? trim( (string) $request_values['idempotency_key'] ) : '';
		$plan            = isset( $request_values['plan'] ) && is_array( $request_values['plan'] ) ? $request_values['plan'] : null;
		$encoded_plan    = is_array( $plan ) ? wp_json_encode( $plan ) : false;
		if (
			WPBC_Booking_New_Inspector_Config::SCHEMA_VERSION !== absint( isset( $request_values['schema_version'] ) ? $request_values['schema_version'] : 0 )
			|| ! preg_match( '/^[A-Za-z0-9._:-]{1,64}$/', $request_id )
			|| ! is_array( $plan )
			|| ! is_string( $encoded_plan )
			|| WPBC_Booking_New_Inspector_Config::MAX_REVIEW_PLAN_BYTES < strlen( $encoded_plan )
			|| ! preg_match( '/^[a-f0-9]{64}$/', $token )
			|| ! preg_match( '/^[A-Za-z0-9._:-]{16,64}$/', $idempotency_key )
		) {
			return $this->get_invalid_error();
		}

		return array(
			'schema_version'  => WPBC_Booking_New_Inspector_Config::SCHEMA_VERSION,
			'request_id'      => $request_id,
			'plan'            => $plan,
			'token'           => $token,
			'idempotency_key' => $idempotency_key,
		);
	}

	/**
	 * Build the stable error returned for any malformed Apply envelope.
	 *
	 * @return WP_Error Safe invalid-request error without rejected values.
	 */
	private function get_invalid_error() {
		return new WP_Error( 'wpbc_booking_new_inspector_apply_request_invalid', __( 'The booking creation request is invalid. Review the booking again.', 'booking' ), array( 'status' => 400 ) );
	}
}
