<?php
/**
 * Booking Rescheduling apply request validation.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize the bounded signed-plan apply envelope.
 */
final class WPBC_Booking_Rescheduling_Apply_Request_Validator {

	/** Maximum encoded plan size. */
	const MAX_PLAN_BYTES = 131072;

	/** @var WPBC_Booking_Inspector_Request_Validator Inspector envelope validator. */
	private $inspector_validator;

	/**
	 * Construct the validator.
	 *
	 * @param WPBC_Booking_Inspector_Request_Validator|null $inspector_validator Optional Inspector validator.
	 */
	public function __construct( $inspector_validator = null ) {
		$this->inspector_validator = $inspector_validator ? $inspector_validator : new WPBC_Booking_Inspector_Request_Validator();
	}

	/**
	 * Normalize untrusted apply values without trusting plan contents.
	 *
	 * @param mixed $request_values Untrusted request values.
	 *
	 * @return array<string,mixed>|WP_Error Normalized envelope or safe error.
	 */
	public function normalize( $request_values ) {
		$request_values = is_array( $request_values ) ? $request_values : array();
		$base_request   = $this->inspector_validator->normalize( $request_values );
		if ( is_wp_error( $base_request ) ) {
			return $base_request;
		}

		$token = isset( $request_values['token'] ) && is_scalar( $request_values['token'] )
			? strtolower( trim( (string) $request_values['token'] ) )
			: '';
		if ( ! preg_match( '/^[a-f0-9]{64}$/', $token ) ) {
			return $this->get_invalid_error();
		}

		$plan = isset( $request_values['plan'] ) ? $request_values['plan'] : array();
		if ( is_string( $plan ) ) {
			if ( strlen( $plan ) > self::MAX_PLAN_BYTES ) {
				return $this->get_invalid_error();
			}
			$plan = json_decode( $plan, true );
			if ( JSON_ERROR_NONE !== json_last_error() ) {
				return $this->get_invalid_error();
			}
		}
		$encoded_plan = is_array( $plan ) ? wp_json_encode( $plan ) : false;
		if ( ! is_string( $encoded_plan ) || strlen( $encoded_plan ) > self::MAX_PLAN_BYTES ) {
			return $this->get_invalid_error();
		}

		return array(
			'booking_id'         => $base_request['booking_id'],
			'source'             => $base_request['source'],
			'plan'               => $plan,
			'token'              => $token,
			'send_modified_email' => isset( $request_values['send_modified_email'] ) && '1' === (string) $request_values['send_modified_email'],
		);
	}

	/**
	 * Return the uniform malformed-plan error.
	 *
	 * @return WP_Error Safe request error.
	 */
	private function get_invalid_error() {
		return new WP_Error(
			'wpbc_booking_rescheduling_apply_invalid',
			__( 'The reviewed booking schedule is invalid. Review the changes again.', 'booking' ),
			array( 'status' => 400 )
		);
	}
}
