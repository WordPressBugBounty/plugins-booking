<?php
/**
 * Request validation for Add New Booking Inspector review.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validates the exact Phase 8 draft envelope without granting authority.
 */
final class WPBC_Booking_New_Inspector_Review_Request_Validator {

	/** @var object Exact draft-envelope validator shared with cost preview. */
	private $draft_validator;

	/**
	 * Construct the review validator.
	 *
	 * @param object|null $draft_validator Optional object exposing validate().
	 */
	public function __construct( $draft_validator = null ) {
		$this->draft_validator = $draft_validator ? $draft_validator : new WPBC_Booking_New_Inspector_Cost_Request_Validator();
	}

	/**
	 * Validate one review request against the shared exact draft contract.
	 *
	 * Review intentionally accepts the same complete draft as cost preview. The
	 * service reloads and canonicalizes every value; a previous browser preview
	 * or fingerprint is never accepted as authority.
	 *
	 * @param mixed $request_values Candidate decoded request values.
	 * @return array<string,mixed>|WP_Error Normalized request or safe error.
	 */
	public function validate( $request_values ) {
		$request = $this->draft_validator->validate( $request_values );
		if ( ! is_wp_error( $request ) ) {
			return $request;
		}

		return new WP_Error(
			'wpbc_booking_new_inspector_review_request_invalid',
			__( 'The booking review request is invalid. Review the booking details and try again.', 'booking' ),
			array( 'status' => 400 )
		);
	}
}
