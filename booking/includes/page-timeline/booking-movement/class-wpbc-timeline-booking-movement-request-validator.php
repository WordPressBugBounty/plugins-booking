<?php
/**
 * Timeline booking-movement context request validation.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize the bounded, non-mutating movement-context request.
 */
final class WPBC_Timeline_Booking_Movement_Request_Validator {

	/**
	 * Validate one untrusted movement-context request.
	 *
	 * The request identifies an interaction only. Resource targets, allocation,
	 * authorization, availability, pricing, ownership, and persistence values are
	 * deliberately absent and any additional field is rejected.
	 *
	 * @param mixed $request_values Untrusted endpoint values without transport keys.
	 *
	 * @return array<string,mixed>|WP_Error Normalized request or safe error.
	 */
	public function normalize( $request_values ) {
		if ( ! is_array( $request_values ) ) {
			return $this->get_invalid_error();
		}

		$allowed_keys = array(
			'booking_id',
			'source',
			'segment_id',
			'segment_resource_id',
			'visible_start_at',
			'visible_end_at',
			'proposal_revision',
		);
		if ( array_diff( array_keys( $request_values ), $allowed_keys ) ) {
			return $this->get_invalid_error();
		}

		$booking_id = isset( $request_values['booking_id'] ) && is_scalar( $request_values['booking_id'] )
			? trim( (string) $request_values['booking_id'] )
			: '';
		$source     = isset( $request_values['source'] ) && is_scalar( $request_values['source'] )
			? trim( (string) $request_values['source'] )
			: '';
		if ( strlen( $booking_id ) > 20 || ! preg_match( '/^[1-9]\d*$/', $booking_id ) || 'timeline' !== $source ) {
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

		$segment_id          = isset( $request_values['segment_id'] ) && is_scalar( $request_values['segment_id'] )
			? trim( (string) $request_values['segment_id'] )
			: '';
		$segment_resource_id = isset( $request_values['segment_resource_id'] ) && is_scalar( $request_values['segment_resource_id'] )
			? trim( (string) $request_values['segment_resource_id'] )
			: '';
		$segment_pattern     = '/^booking-' . preg_quote( $booking_id, '/' ) . '-resource-([1-9]\d*)-start-([1-9]\d*)$/';
		if (
			strlen( $segment_id ) > 160
			|| strlen( $segment_resource_id ) > 20
			|| ! preg_match( '/^[1-9]\d*$/', $segment_resource_id )
			|| ! preg_match( $segment_pattern, $segment_id, $segment_matches )
			|| $segment_resource_id !== $segment_matches[1]
		) {
			return $this->get_invalid_error();
		}

		$visible_start = $this->normalize_exact_instant( isset( $request_values['visible_start_at'] ) ? $request_values['visible_start_at'] : '' );
		$visible_end   = $this->normalize_exact_instant( isset( $request_values['visible_end_at'] ) ? $request_values['visible_end_at'] : '' );
		if ( ! $visible_start || ! $visible_end || $visible_end['timestamp'] <= $visible_start['timestamp'] ) {
			return $this->get_invalid_error();
		}

		$proposal_revision = isset( $request_values['proposal_revision'] ) && is_scalar( $request_values['proposal_revision'] )
			? trim( (string) $request_values['proposal_revision'] )
			: '';
		if (
			! preg_match( '/^[1-9]\d*$/', $proposal_revision )
			|| (int) $proposal_revision > WPBC_Booking_Rescheduling_Proposal_Contract::MAX_PROPOSAL_REVISION
		) {
			return $this->get_invalid_error();
		}

		return array(
			'booking_id'        => absint( $base_request['booking_id'] ),
			'source'            => 'timeline',
			'proposal_revision' => absint( $proposal_revision ),
			'segment'           => array(
				'id'                 => $segment_id,
				'resource_id'        => absint( $segment_resource_id ),
				'start_timestamp'    => absint( $segment_matches[2] ),
				'visible_start_at'   => $visible_start['value'],
				'visible_end_at'     => $visible_end['value'],
				'visible_start_time' => $visible_start['timestamp'],
				'visible_end_time'   => $visible_end['timestamp'],
			),
		);
	}

	/**
	 * Normalize one strict RFC3339 exact-minute instant in the site timezone.
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
			'wpbc_timeline_booking_movement_request_invalid',
			__( 'The booking movement request is invalid.', 'booking' ),
			array( 'status' => 400 )
		);
	}
}
