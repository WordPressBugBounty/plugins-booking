<?php
/**
 * Authenticated endpoint facade for Add New Booking Inspector review.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Verifies the site-bound nonce before signed non-mutating Review.
 */
final class WPBC_Booking_New_Inspector_Review_Endpoint {

	/** @var object Review service. */
	private $review_service;

	/**
	 * Construct the endpoint facade.
	 *
	 * @param object|null $review_service Optional object exposing review().
	 */
	public function __construct( $review_service = null ) {
		$this->review_service = $review_service ? $review_service : new WPBC_Booking_New_Inspector_Review_Service();
	}

	/**
	 * Process one authenticated, non-mutating review request.
	 *
	 * @param mixed $request_values Untrusted request values.
	 * @param mixed $nonce          Untrusted nonce.
	 * @return array<string,mixed>|WP_Error Review response or safe error.
	 */
	public function process( $request_values, $nonce ) {
		$nonce = is_scalar( $nonce ) ? (string) $nonce : '';
		if ( '' === $nonce || ! function_exists( 'wp_verify_nonce' ) || ! wp_verify_nonce( $nonce, WPBC_Booking_New_Inspector_Config::get_site_nonce_action( 'review' ) ) ) {
			return new WP_Error( 'wpbc_booking_new_inspector_nonce_invalid', __( 'The security check failed. Reload the page and try again.', 'booking' ), array( 'status' => 403 ) );
		}

		return $this->review_service->review( $request_values );
	}

	/**
	 * Map one safe domain error to the common error DTO.
	 *
	 * @param WP_Error $error      Domain error.
	 * @param mixed    $request_id Untrusted correlation value.
	 * @return array<string,mixed> Data-only error DTO.
	 */
	public function get_error_dto( $error, $request_id = '' ) {
		$request_id = is_scalar( $request_id ) ? (string) $request_id : '';
		$request_id = preg_match( '/^[A-Za-z0-9._:-]{1,64}$/', $request_id ) ? $request_id : '';
		$error_data = $error->get_error_data();

		return array(
			'schema_version' => WPBC_Booking_New_Inspector_Config::SCHEMA_VERSION,
			'request_id'     => $request_id,
			'state'          => WPBC_Booking_New_Inspector_Contract::STATE_ERROR,
			'code'           => sanitize_key( $error->get_error_code() ),
			'message'        => sanitize_text_field( $error->get_error_message() ),
			'retry_state'    => WPBC_Booking_New_Inspector_Contract::STATE_EDITING,
			'field_errors'   => is_array( $error_data ) && isset( $error_data['field_errors'] ) ? array_slice( (array) $error_data['field_errors'], 0, WPBC_Booking_New_Inspector_Config::MAX_FIELD_ERRORS ) : array(),
			'fallback'       => is_array( $error_data ) && isset( $error_data['fallback'] ) && is_array( $error_data['fallback'] ) ? $error_data['fallback'] : null,
		);
	}
}
