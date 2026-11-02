<?php
/**
 * Timeline per-Resource settings request validation.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validate the narrow read, save, and reset Resource-settings request shapes.
 */
final class WPBC_Timeline_Resource_Settings_Request_Validator {

	/**
	 * Validate one read or reset request.
	 *
	 * @param mixed $request_values Untrusted allow-listed request values.
	 *
	 * @return array<string,int>|WP_Error Validated Resource ID or a safe error.
	 */
	public function validate_read( $request_values ) {
		$request_values = is_array( $request_values ) ? $request_values : array();
		$resource_id    = $this->validate_resource_id( isset( $request_values['resource_id'] ) ? $request_values['resource_id'] : null );

		return is_wp_error( $resource_id ) ? $resource_id : array( 'resource_id' => $resource_id );
	}

	/**
	 * Validate one save request without collapsing missing and explicit values.
	 *
	 * The display-preference service remains authoritative for booking-title
	 * mode, template syntax, length, and normalization.
	 *
	 * @param mixed $request_values Untrusted allow-listed request values.
	 *
	 * @return array<string,mixed>|WP_Error Validated outer request or a safe error.
	 */
	public function validate_save( $request_values ) {
		$validated_read = $this->validate_read( $request_values );
		if ( is_wp_error( $validated_read ) ) {
			return $validated_read;
		}

		$request_values = is_array( $request_values ) ? $request_values : array();
		if ( ! array_key_exists( 'mode', $request_values ) || ! is_scalar( $request_values['mode'] ) ) {
			return $this->error( 'wpbc_timeline_resource_display_invalid', __( 'The Timeline Resource display preference is invalid.', 'booking' ) );
		}

		$booking_title = array( 'mode' => $request_values['mode'] );
		if ( array_key_exists( 'template', $request_values ) ) {
			$booking_title['template'] = $request_values['template'];
		}

		return array(
			'resource_id'   => $validated_read['resource_id'],
			'booking_title' => $booking_title,
		);
	}

	/**
	 * Validate one canonical positive Resource identifier.
	 *
	 * @param mixed $candidate Untrusted Resource identifier.
	 *
	 * @return int|WP_Error Positive Resource ID or a safe error.
	 */
	private function validate_resource_id( $candidate ) {
		if ( ! is_scalar( $candidate ) || ! preg_match( '/^[1-9]\d*$/', (string) $candidate ) ) {
			return $this->error( 'wpbc_timeline_resource_id_invalid', __( 'The booking Resource identifier is invalid.', 'booking' ) );
		}

		$resource_id = (int) $candidate;
		if ( (string) $resource_id !== (string) $candidate ) {
			return $this->error( 'wpbc_timeline_resource_id_invalid', __( 'The booking Resource identifier is invalid.', 'booking' ) );
		}

		return $resource_id;
	}

	/**
	 * Build one safe malformed-request error.
	 *
	 * @param string $code    Stable machine-readable code.
	 * @param string $message Safe translated message.
	 *
	 * @return WP_Error Request error.
	 */
	private function error( $code, $message ) {
		return new WP_Error( $code, $message, array( 'status' => 400 ) );
	}
}
