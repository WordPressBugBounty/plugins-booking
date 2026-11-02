<?php
/**
 * Timeline booking-resizing context request validation.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize the bounded read-only request for direct-resize eligibility.
 */
final class WPBC_Timeline_Booking_Resizing_Request_Validator {

	/**
	 * Validate one untrusted resize-context request.
	 *
	 * Visible segment instants describe presentation clipping only. The context
	 * service compares them with server-derived canonical instants and never
	 * treats them as booking authority.
	 *
	 * @param mixed $request_values Untrusted endpoint values.
	 *
	 * @return array<string,mixed>|WP_Error Normalized request or safe error.
	 */
	public function normalize( $request_values ) {
		if ( ! is_array( $request_values ) ) {
			return $this->get_invalid_error();
		}

		$booking_id = isset( $request_values['booking_id'] ) && is_scalar( $request_values['booking_id'] )
			? trim( (string) $request_values['booking_id'] )
			: '';
		$source     = isset( $request_values['source'] ) && is_scalar( $request_values['source'] )
			? trim( (string) $request_values['source'] )
			: '';
		if ( ! preg_match( '/^[1-9]\d*$/', $booking_id ) || 'timeline' !== $source ) {
			return $this->get_invalid_error();
		}

		$base_request = ( new WPBC_Booking_Inspector_Request_Validator() )->normalize(
			array(
				'booking_id' => $booking_id,
				'source'     => $source,
			)
		);
		if ( is_wp_error( $base_request ) ) {
			return $this->get_invalid_error();
		}

		$visible_start = $this->normalize_exact_instant( isset( $request_values['visible_start_at'] ) ? $request_values['visible_start_at'] : '' );
		$visible_end   = $this->normalize_exact_instant( isset( $request_values['visible_end_at'] ) ? $request_values['visible_end_at'] : '' );
		if ( ! $visible_start || ! $visible_end || $visible_end['timestamp'] <= $visible_start['timestamp'] ) {
			return $this->get_invalid_error();
		}

		$source_context_token = isset( $request_values['source_context_token'] ) && is_scalar( $request_values['source_context_token'] )
			? trim( (string) $request_values['source_context_token'] )
			: '';
		if (
			'' !== $source_context_token
			&& (
				strlen( $source_context_token ) > WPBC_Booking_Rescheduling_Proposal_Contract::MAX_SOURCE_CONTEXT_TOKEN_BYTES
				|| ! preg_match( '/^v1\.[1-9]\d*\.[1-9]\d*\.[a-f0-9]{64}$/', $source_context_token )
			)
		) {
			return $this->get_invalid_error();
		}

		return array(
			'booking_id'           => absint( $base_request['booking_id'] ),
			'source'               => 'timeline',
			'visible_interval'     => array(
				'start' => $visible_start['value'],
				'end'   => $visible_end['value'],
			),
			'source_context_token' => $source_context_token,
		);
	}

	/**
	 * Normalize one strict RFC3339 exact-minute instant.
	 *
	 * @param mixed $instant Candidate timestamp.
	 *
	 * @return array{value:string,timestamp:int}|array{} Normalized instant or an empty record.
	 */
	private function normalize_exact_instant( $instant ) {
		if ( ! is_string( $instant ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:Z|[+-]\d{2}:\d{2})$/', $instant ) ) {
			return array();
		}
		$parse_value  = 'Z' === substr( $instant, -1 ) ? substr( $instant, 0, -1 ) . '+00:00' : $instant;
		$date_time    = DateTimeImmutable::createFromFormat( '!Y-m-d\TH:i:sP', $parse_value );
		$parse_errors = DateTimeImmutable::getLastErrors();
		if ( ! $date_time || ( is_array( $parse_errors ) && ( $parse_errors['warning_count'] || $parse_errors['error_count'] ) ) ) {
			return array();
		}
		$site_timezone = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		$site_instant  = $date_time->setTimezone( $site_timezone );
		$input_offset  = 'Z' === substr( $instant, -1 ) ? '+00:00' : substr( $instant, -6 );
		if ( $input_offset !== $site_instant->format( 'P' ) ) {
			return array();
		}

		return array(
			'value'     => $site_instant->format( 'Y-m-d\TH:i:sP' ),
			'timestamp' => $site_instant->getTimestamp(),
		);
	}

	/**
	 * Return a data-free invalid-request error.
	 *
	 * @return WP_Error Safe validation error.
	 */
	private function get_invalid_error() {
		return new WP_Error(
			'wpbc_timeline_booking_resizing_request_invalid',
			__( 'The booking resize request is invalid.', 'booking' ),
			array( 'status' => 400 )
		);
	}
}
