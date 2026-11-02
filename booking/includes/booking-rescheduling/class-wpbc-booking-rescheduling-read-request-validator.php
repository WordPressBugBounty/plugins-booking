<?php
/**
 * Booking Rescheduling dialog-read request validation.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize the bounded initialization request for the accessible dialog.
 */
final class WPBC_Booking_Rescheduling_Read_Request_Validator {

	/**
	 * Validate one untrusted read request.
	 *
	 * The target Resource is optional for the initial request. A zero value means
	 * that the service must use the booking's freshly loaded canonical Resource.
	 *
	 * @param mixed $request_values Untrusted endpoint values.
	 *
	 * @return array<string,mixed>|WP_Error Normalized request or safe error.
	 */
	public function normalize( $request_values ) {
		$request_values = is_array( $request_values ) ? $request_values : array();
		$base_request   = ( new WPBC_Booking_Inspector_Request_Validator() )->normalize( $request_values );
		if ( is_wp_error( $base_request ) ) {
			return new WP_Error(
				'wpbc_booking_rescheduling_read_invalid',
				__( 'The booking rescheduling request is invalid.', 'booking' ),
				array( 'status' => 400 )
			);
		}

		$target_resource_id = 0;
		if ( isset( $request_values['target_resource_id'] ) ) {
			$raw_target_resource_id = $request_values['target_resource_id'];
			if ( ! is_scalar( $raw_target_resource_id ) || ! preg_match( '/^\d+$/', (string) $raw_target_resource_id ) ) {
				return new WP_Error(
					'wpbc_booking_rescheduling_read_invalid',
					__( 'The booking rescheduling request is invalid.', 'booking' ),
					array( 'status' => 400 )
				);
			}
			$target_resource_id = absint( $raw_target_resource_id );
		}

		$base_request['target_resource_id'] = $target_resource_id;
		$source_context_token = isset( $request_values['source_context_token'] ) && is_scalar( $request_values['source_context_token'] )
			? trim( (string) $request_values['source_context_token'] )
			: '';
		if (
			'' !== $source_context_token &&
			(
				strlen( $source_context_token ) > WPBC_Booking_Rescheduling_Proposal_Contract::MAX_SOURCE_CONTEXT_TOKEN_BYTES ||
				! preg_match( '/^v1\.[1-9]\d*\.[1-9]\d*\.[a-f0-9]{64}$/', $source_context_token )
			)
		) {
			return new WP_Error(
				'wpbc_booking_rescheduling_read_invalid',
				__( 'The booking rescheduling request is invalid.', 'booking' ),
				array( 'status' => 400 )
			);
		}
		$base_request['source_context_token'] = $source_context_token;

		return $base_request;
	}
}
