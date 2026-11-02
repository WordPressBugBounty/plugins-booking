<?php
/**
 * Booking Rescheduling review request validation.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize one bounded review envelope and its non-authoritative proposal.
 */
final class WPBC_Booking_Rescheduling_Review_Request_Validator {

	/** Maximum encoded signed base Review size. */
	const MAX_BASE_PLAN_BYTES = 131072;

	/** @var WPBC_Booking_Inspector_Request_Validator Inspector envelope validator. */
	private $inspector_validator;

	/** @var WPBC_Booking_Rescheduling_Proposal_Contract Proposal contract. */
	private $proposal_contract;

	/**
	 * Construct the validator with replaceable focused dependencies.
	 *
	 * @param WPBC_Booking_Inspector_Request_Validator|null      $inspector_validator Optional Inspector validator.
	 * @param WPBC_Booking_Rescheduling_Proposal_Contract|null   $proposal_contract   Optional proposal contract.
	 */
	public function __construct( $inspector_validator = null, $proposal_contract = null ) {
		$this->inspector_validator = $inspector_validator ? $inspector_validator : new WPBC_Booking_Inspector_Request_Validator();
		$this->proposal_contract   = $proposal_contract ? $proposal_contract : new WPBC_Booking_Rescheduling_Proposal_Contract();
	}

	/**
	 * Normalize untrusted endpoint values.
	 *
	 * @param mixed $request_values Untrusted request values.
	 *
	 * @return array<string,mixed>|WP_Error Normalized review request or safe error.
	 */
	public function normalize( $request_values ) {
		$request_values = is_array( $request_values ) ? $request_values : array();
		$base_request   = $this->inspector_validator->normalize( $request_values );
		if ( is_wp_error( $base_request ) ) {
			return $base_request;
		}

		$proposal = isset( $request_values['proposal'] ) ? $request_values['proposal'] : array();
		if ( is_string( $proposal ) ) {
			if ( strlen( $proposal ) > WPBC_Booking_Rescheduling_Proposal_Contract::MAX_PROPOSAL_BYTES ) {
				return $this->get_invalid_error();
			}
			$proposal = json_decode( $proposal, true );
			if ( JSON_ERROR_NONE !== json_last_error() ) {
				return $this->get_invalid_error();
			}
		}
		$proposal = $this->proposal_contract->normalize( $proposal );
		if ( is_wp_error( $proposal ) || absint( $proposal['booking_id'] ) !== absint( $base_request['booking_id'] ) ) {
			return $this->get_invalid_error();
		}

		$base_review = $this->normalize_base_review( $request_values );
		if ( is_wp_error( $base_review ) ) {
			return $base_review;
		}

		return array(
			'booking_id' => $base_request['booking_id'],
			'source'     => $base_request['source'],
			'proposal'   => $proposal,
			'base_plan'  => $base_review['plan'],
			'base_token' => $base_review['token'],
		);
	}

	/**
	 * Normalize an optional prior signed Review used for a cumulative resize.
	 *
	 * The plan remains untrusted here. The Review service verifies its signature,
	 * identity, expiry, and complete canonical replay before using it as a base.
	 * Both fields must be present together so an incomplete continuation cannot be
	 * interpreted as a fresh Review.
	 *
	 * @param array<string,mixed> $request_values Untrusted request values.
	 *
	 * @return array{plan:array<string,mixed>|null,token:string}|WP_Error Normalized optional base Review.
	 */
	private function normalize_base_review( $request_values ) {
		$has_plan  = isset( $request_values['base_plan'] ) && '' !== $request_values['base_plan'];
		$has_token = isset( $request_values['base_token'] ) && '' !== $request_values['base_token'];
		if ( $has_plan !== $has_token ) {
			return $this->get_invalid_error();
		}
		if ( ! $has_plan ) {
			return array(
				'plan'  => null,
				'token' => '',
			);
		}

		$token = is_scalar( $request_values['base_token'] )
			? strtolower( trim( (string) $request_values['base_token'] ) )
			: '';
		if ( ! preg_match( '/^[a-f0-9]{64}$/', $token ) ) {
			return $this->get_invalid_error();
		}

		$plan = $request_values['base_plan'];
		if ( is_string( $plan ) ) {
			if ( strlen( $plan ) > self::MAX_BASE_PLAN_BYTES ) {
				return $this->get_invalid_error();
			}
			$plan = json_decode( $plan, true );
			if ( JSON_ERROR_NONE !== json_last_error() ) {
				return $this->get_invalid_error();
			}
		}
		$encoded_plan = is_array( $plan ) ? wp_json_encode( $plan ) : false;
		if ( ! is_string( $encoded_plan ) || strlen( $encoded_plan ) > self::MAX_BASE_PLAN_BYTES ) {
			return $this->get_invalid_error();
		}

		return array(
			'plan'  => $plan,
			'token' => $token,
		);
	}

	/**
	 * Return the uniform malformed-review error.
	 *
	 * @return WP_Error Safe request error.
	 */
	private function get_invalid_error() {
		return new WP_Error(
			'wpbc_booking_rescheduling_review_invalid',
			__( 'The proposed booking schedule is invalid. Reload the booking and try again.', 'booking' ),
			array( 'status' => 400 )
		);
	}
}
