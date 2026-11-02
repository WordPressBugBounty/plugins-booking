<?php
/**
 * Authenticated endpoint facade for Add New Booking Inspector Apply.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Enforces nonce and capability before idempotent creation orchestration.
 */
final class WPBC_Booking_New_Inspector_Apply_Endpoint {

	/** @var object Apply service. */
	private $apply_service;

	/** @var object Canonical Add Booking authorization. */
	private $authorization;

	/**
	 * Construct the endpoint.
	 *
	 * @param object|null $apply_service  Optional object exposing apply().
	 * @param object|null $authorization Optional object exposing current_user_can_bootstrap().
	 */
	public function __construct( $apply_service = null, $authorization = null ) {
		$this->apply_service  = $apply_service ? $apply_service : new WPBC_Booking_New_Inspector_Apply_Service();
		$this->authorization = $authorization ? $authorization : new WPBC_Booking_New_Inspector_Authorization();
	}

	/**
	 * Process one authenticated Apply request.
	 *
	 * @param mixed $request_values Untrusted decoded request values.
	 * @param mixed $nonce          Untrusted nonce.
	 * @return array<string,mixed>|WP_Error Created response or safe error.
	 */
	public function process( $request_values, $nonce ) {
		$nonce = is_scalar( $nonce ) ? (string) $nonce : '';
		if ( '' === $nonce || ! wp_verify_nonce( $nonce, WPBC_Booking_New_Inspector_Config::get_site_nonce_action( 'apply' ) ) ) {
			return new WP_Error( 'wpbc_booking_new_inspector_nonce_invalid', __( 'The security check failed. Reload the page and try again.', 'booking' ), array( 'status' => 403 ) );
		}
		if ( ! $this->authorization->current_user_can_bootstrap() ) {
			return $this->authorization->get_forbidden_error();
		}
		return $this->apply_service->apply( $request_values );
	}

	/**
	 * Map a domain error to the common data-only error DTO.
	 *
	 * @param WP_Error $error      Domain error.
	 * @param mixed    $request_id Untrusted request correlation ID.
	 * @return array<string,mixed> Safe error DTO.
	 */
	public function get_error_dto( $error, $request_id = '' ) {
		$error_data = $error->get_error_data();
		$retry_state = is_array( $error_data ) && isset( $error_data['retry_state'] ) ? (string) $error_data['retry_state'] : WPBC_Booking_New_Inspector_Contract::STATE_REVIEW;
		$request_id = is_scalar( $request_id ) && preg_match( '/^[A-Za-z0-9._:-]{1,64}$/', (string) $request_id ) ? (string) $request_id : '';
		return array(
			'schema_version' => WPBC_Booking_New_Inspector_Config::SCHEMA_VERSION,
			'request_id'     => $request_id,
			'state'          => WPBC_Booking_New_Inspector_Contract::STATE_ERROR,
			'code'           => sanitize_key( $error->get_error_code() ),
			'message'        => sanitize_text_field( $error->get_error_message() ),
			'retry_state'    => $retry_state,
			'field_errors'   => array(),
			'fallback'       => null,
		);
	}
}
