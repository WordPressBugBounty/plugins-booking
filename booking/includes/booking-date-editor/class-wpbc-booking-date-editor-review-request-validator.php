<?php
/**
 * Booking Date Editor review request validation.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once dirname( __DIR__ ) . '/booking-domain/class-wpbc-booking-schedule-proposal-normalizer.php';

/**
 * Normalize the explicit, data-only Date Editor review request contract.
 *
 * @since 12.0.0
 */
final class WPBC_Booking_Date_Editor_Review_Request_Validator {

	/** Maximum individual dates accepted in one review request. */
	const MAX_SELECTED_DATES = 1095;

	/** Maximum encoded proposal size accepted before JSON decoding. */
	const MAX_PROPOSAL_BYTES = 32768;

	/** @var WPBC_Booking_Inspector_Request_Validator Inspector request validator. */
	private $inspector_request_validator;

	/** @var WPBC_Booking_Schedule_Proposal_Normalizer Shared schedule syntax normalizer. */
	private $schedule_proposal_normalizer;

	/**
	 * Construct the validator with an optional Inspector request dependency.
	 *
	 * @param WPBC_Booking_Inspector_Request_Validator|null $inspector_request_validator Optional base validator.
	 * @param WPBC_Booking_Schedule_Proposal_Normalizer|null $schedule_proposal_normalizer Optional shared schedule normalizer.
	 */
	public function __construct( $inspector_request_validator = null, $schedule_proposal_normalizer = null ) {
		$this->inspector_request_validator = $inspector_request_validator ? $inspector_request_validator : new WPBC_Booking_Inspector_Request_Validator();
		$this->schedule_proposal_normalizer = $schedule_proposal_normalizer
			? $schedule_proposal_normalizer
			: new WPBC_Booking_Schedule_Proposal_Normalizer();
	}

	/**
	 * Normalize one untrusted review request.
	 *
	 * @param mixed $request_payload Untrusted request values.
	 *
	 * @return array<string,mixed>|WP_Error Normalized request or safe validation error.
	 */
	public function normalize( $request_payload ) {
		$request_payload = is_array( $request_payload ) ? $request_payload : array();
		$base_request    = $this->inspector_request_validator->normalize( $request_payload );
		if ( is_wp_error( $base_request ) ) {
			return $base_request;
		}

		$source_fingerprint = isset( $request_payload['source_fingerprint'] ) && is_scalar( $request_payload['source_fingerprint'] )
			? strtolower( trim( (string) $request_payload['source_fingerprint'] ) )
			: '';
		if ( ! preg_match( '/^[a-f0-9]{64}$/', $source_fingerprint ) ) {
			return $this->get_invalid_request_error();
		}

		$proposal = isset( $request_payload['proposal'] ) ? $request_payload['proposal'] : array();
		if ( is_string( $proposal ) ) {
			if ( strlen( $proposal ) > self::MAX_PROPOSAL_BYTES ) {
				return $this->get_invalid_request_error();
			}
			$proposal = json_decode( $proposal, true );
			if ( JSON_ERROR_NONE !== json_last_error() ) {
				return $this->get_invalid_request_error();
			}
		}
		$proposal = $this->normalize_proposal( $proposal );
		if ( is_wp_error( $proposal ) ) {
			return $proposal;
		}

		return array(
			'booking_id'        => $base_request['booking_id'],
			'source'            => $base_request['source'],
			'source_fingerprint' => $source_fingerprint,
			'proposal'          => $proposal,
		);
	}

	/**
	 * Normalize one proposal independently for signed-plan verification.
	 *
	 * @param mixed $proposal Untrusted proposal values.
	 *
	 * @return array<string,mixed>|WP_Error Normalized proposal or safe validation error.
	 */
	public function normalize_proposal( $proposal ) {
		$normalized_proposal = $this->schedule_proposal_normalizer->normalize(
			$proposal,
			self::MAX_SELECTED_DATES
		);
		if ( is_wp_error( $normalized_proposal ) ) {
			return $this->get_invalid_request_error();
		}

		return $normalized_proposal;
	}

	/**
	 * Return the uniform malformed-review error.
	 *
	 * @return WP_Error Safe request error.
	 */
	private function get_invalid_request_error() {
		return new WP_Error(
			'wpbc_booking_date_editor_review_invalid',
			__( 'The proposed booking dates are invalid. Review the selection and try again.', 'booking' ),
			array( 'status' => 400 )
		);
	}
}
