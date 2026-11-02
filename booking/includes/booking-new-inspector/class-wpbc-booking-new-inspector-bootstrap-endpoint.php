<?php
/**
 * Authenticated endpoint facade for Add New Booking Inspector bootstrap reads.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Verifies the site-bound nonce before delegating to the read-only service.
 */
final class WPBC_Booking_New_Inspector_Bootstrap_Endpoint {

	/** @var WPBC_Booking_New_Inspector_Bootstrap_Service Bootstrap service. */
	private $bootstrap_service;

	/**
	 * Construct the endpoint facade.
	 *
	 * @param WPBC_Booking_New_Inspector_Bootstrap_Service|null $bootstrap_service Optional service.
	 */
	public function __construct( $bootstrap_service = null ) {
		$this->bootstrap_service = $bootstrap_service ? $bootstrap_service : new WPBC_Booking_New_Inspector_Bootstrap_Service();
	}

	/**
	 * Process one authenticated bootstrap request.
	 *
	 * @param mixed $request_values Untrusted request values.
	 * @param mixed $nonce          Untrusted nonce.
	 * @return array<string,mixed>|WP_Error Bootstrap DTO or a safe error.
	 */
	public function process( $request_values, $nonce ) {
		$nonce = is_scalar( $nonce ) ? (string) $nonce : '';
		if (
			'' === $nonce
			|| ! function_exists( 'wp_verify_nonce' )
			|| ! wp_verify_nonce( $nonce, WPBC_Booking_New_Inspector_Config::get_site_nonce_action( 'bootstrap' ) )
		) {
			return new WP_Error(
				'wpbc_booking_new_inspector_nonce_invalid',
				__( 'The security check failed. Reload the page and try again.', 'booking' ),
				array( 'status' => 403 )
			);
		}

		return $this->bootstrap_service->get_bootstrap( $request_values );
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

		return array(
			'schema_version' => WPBC_Booking_New_Inspector_Config::SCHEMA_VERSION,
			'request_id'     => $request_id,
			'state'          => WPBC_Booking_New_Inspector_Contract::STATE_ERROR,
			'code'           => sanitize_key( $error->get_error_code() ),
			'message'        => sanitize_text_field( $error->get_error_message() ),
			'retry_state'    => WPBC_Booking_New_Inspector_Contract::STATE_LOADING,
			'field_errors'   => array(),
			'fallback'       => null,
		);
	}
}
