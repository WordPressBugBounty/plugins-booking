<?php
/**
 * Request validator for Add New Booking Inspector bootstrap reads.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalizes the exact bounded bootstrap request without granting authority.
 */
final class WPBC_Booking_New_Inspector_Request_Validator {

	/**
	 * Validate one untrusted bootstrap request.
	 *
	 * @param mixed $request_values Untrusted request values without the AJAX action or nonce.
	 * @return array<string,mixed>|WP_Error Normalized request or a safe validation error.
	 */
	public function validate( $request_values ) {
		if ( ! is_array( $request_values ) ) {
			return $this->get_invalid_error();
		}

		$allowed_fields = array( 'schema_version', 'request_id', 'selection_source', 'resource_id', 'form_id', 'source_context_token' );
		if ( array_diff( array_keys( $request_values ), $allowed_fields ) ) {
			return $this->get_invalid_error();
		}

		$encoded_request = function_exists( 'wp_json_encode' ) ? wp_json_encode( $request_values ) : json_encode( $request_values );
		if ( ! is_string( $encoded_request ) || WPBC_Booking_New_Inspector_Config::get_action_request_limits()[ WPBC_Booking_New_Inspector_Config::ACTION_BOOTSTRAP ] < strlen( $encoded_request ) ) {
			return $this->get_invalid_error();
		}

		if (
			! isset( $request_values['schema_version'] )
			|| ! is_scalar( $request_values['schema_version'] )
			|| (string) WPBC_Booking_New_Inspector_Config::SCHEMA_VERSION !== trim( (string) $request_values['schema_version'] )
		) {
			return $this->get_invalid_error();
		}

		$request_id = isset( $request_values['request_id'] ) && is_scalar( $request_values['request_id'] )
			? trim( (string) $request_values['request_id'] )
			: '';
		if ( '' === $request_id || WPBC_Booking_New_Inspector_Config::MAX_REQUEST_ID_BYTES < strlen( $request_id ) || ! preg_match( '/^[A-Za-z0-9._:-]+$/', $request_id ) ) {
			return $this->get_invalid_error();
		}

		$selection_source = isset( $request_values['selection_source'] ) && is_scalar( $request_values['selection_source'] )
			? sanitize_key( (string) $request_values['selection_source'] )
			: '';
		if ( ! in_array( $selection_source, array( 'empty', 'timeline', 'booking_listing', 'add_booking' ), true ) ) {
			return $this->get_invalid_error();
		}

		$resource_id = 0;
		if ( array_key_exists( 'resource_id', $request_values ) ) {
			if ( ! is_scalar( $request_values['resource_id'] ) || ! preg_match( '/^[1-9][0-9]*$/', (string) $request_values['resource_id'] ) ) {
				return $this->get_invalid_error();
			}
			$resource_id = absint( $request_values['resource_id'] );
		}

		$form_id = '';
		if ( array_key_exists( 'form_id', $request_values ) ) {
			if ( ! is_scalar( $request_values['form_id'] ) ) {
				return $this->get_invalid_error();
			}
			$form_id = trim( sanitize_text_field( (string) $request_values['form_id'] ) );
			if ( '' === $form_id || 191 < strlen( $form_id ) ) {
				return $this->get_invalid_error();
			}
		}

		$source_context_token = '';
		if ( array_key_exists( 'source_context_token', $request_values ) ) {
			if ( ! is_scalar( $request_values['source_context_token'] ) ) {
				return $this->get_invalid_error();
			}
			$source_context_token = trim( (string) $request_values['source_context_token'] );
			if (
				'' === $source_context_token
				|| WPBC_Booking_New_Inspector_Config::MAX_CONTEXT_TOKEN_BYTES < strlen( $source_context_token )
				|| ! preg_match( '/^[A-Za-z0-9._-]+$/', $source_context_token )
			) {
				return $this->get_invalid_error();
			}
		}

		return array(
			'schema_version'       => WPBC_Booking_New_Inspector_Config::SCHEMA_VERSION,
			'request_id'           => $request_id,
			'selection_source'     => $selection_source,
			'resource_id'          => $resource_id,
			'form_id'              => $form_id,
			'source_context_token' => $source_context_token,
		);
	}

	/**
	 * Return one non-sensitive malformed-request error.
	 *
	 * @return WP_Error Safe validation error.
	 */
	private function get_invalid_error() {
		return new WP_Error(
			'wpbc_booking_new_inspector_request_invalid',
			__( 'The Add Booking request is invalid. Reload the page and try again.', 'booking' ),
			array( 'status' => 400 )
		);
	}
}
