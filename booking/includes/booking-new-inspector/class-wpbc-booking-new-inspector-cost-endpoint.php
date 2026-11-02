<?php
/**
 * Authenticated endpoint facade for Add New Booking Inspector cost preview.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Verifies the site-bound nonce before delegating to the read-only cost service.
 */
final class WPBC_Booking_New_Inspector_Cost_Endpoint {

	/** @var object Cost service. */
	private $cost_service;

	/**
	 * Construct the endpoint facade.
	 *
	 * @param object|null $cost_service Optional object exposing preview().
	 */
	public function __construct( $cost_service = null ) {
		$this->cost_service = $cost_service ? $cost_service : new WPBC_Booking_New_Inspector_Cost_Service();
	}

	/**
	 * Process one authenticated, non-mutating cost request.
	 *
	 * @param mixed $request_values Untrusted request values.
	 * @param mixed $nonce          Untrusted nonce.
	 * @return array<string,mixed>|WP_Error Cost response or safe error.
	 */
	public function process( $request_values, $nonce ) {
		$nonce = is_scalar( $nonce ) ? (string) $nonce : '';
		if ( '' === $nonce || ! function_exists( 'wp_verify_nonce' ) || ! wp_verify_nonce( $nonce, WPBC_Booking_New_Inspector_Config::get_site_nonce_action( 'cost_preview' ) ) ) {
			return new WP_Error(
				'wpbc_booking_new_inspector_nonce_invalid',
				__( 'The security check failed. Reload the page and try again.', 'booking' ),
				array( 'status' => 403 )
			);
		}

		return $this->cost_service->preview( $request_values );
	}

	/**
	 * Map one safe domain error to the common error DTO.
	 *
	 * @param WP_Error $error      Domain error.
	 * @param mixed    $request_id Untrusted request correlation value.
	 * @return array<string,mixed> Data-only error DTO.
	 */
	public function get_error_dto( $error, $request_id = '' ) {
		$request_id = is_scalar( $request_id ) ? (string) $request_id : '';
		$request_id = preg_match( '/^[A-Za-z0-9._:-]{1,64}$/', $request_id ) ? $request_id : '';
		$error_data = $error->get_error_data();
		$field_errors = is_array( $error_data ) && isset( $error_data['field_errors'] ) && is_array( $error_data['field_errors'] )
			? array_slice( $error_data['field_errors'], 0, WPBC_Booking_New_Inspector_Config::MAX_FIELD_ERRORS )
			: array();

		return array(
			'schema_version' => WPBC_Booking_New_Inspector_Config::SCHEMA_VERSION,
			'request_id'     => $request_id,
			'state'          => WPBC_Booking_New_Inspector_Contract::STATE_ERROR,
			'code'           => sanitize_key( $error->get_error_code() ),
			'message'        => sanitize_text_field( $error->get_error_message() ),
			'retry_state'    => WPBC_Booking_New_Inspector_Contract::STATE_EDITING,
			'field_errors'   => $field_errors,
			'fallback'       => null,
		);
	}
}
