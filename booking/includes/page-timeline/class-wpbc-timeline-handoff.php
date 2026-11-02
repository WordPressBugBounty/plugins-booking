<?php
/**
 * Signed Timeline handoff and mutation-plan tokens.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Protect server-approved Timeline context while it crosses page boundaries.
 */
final class WPBC_Timeline_Handoff {

	/** Token lifetime in seconds. */
	const TOKEN_TTL = 1800;

	/**
	 * Sign an allow-listed payload for one purpose and current administrator.
	 *
	 * @param string              $purpose Stable token purpose.
	 * @param array<string,mixed> $payload Authorized payload.
	 *
	 * @return string URL-safe signed token.
	 */
	public function create_token( $purpose, $payload ) {
		$envelope = array(
			'version' => 1,
			'purpose' => sanitize_key( $purpose ),
			'user_id' => get_current_user_id(),
			'site_id' => get_current_blog_id(),
			'expires' => time() + self::TOKEN_TTL,
			'payload' => is_array( $payload ) ? $payload : array(),
		);
		$encoded  = $this->base64_url_encode( wp_json_encode( $envelope ) );
		$signature = hash_hmac( 'sha256', $encoded, wp_salt( 'nonce' ) );

		return $encoded . '.' . $signature;
	}

	/**
	 * Verify a token against its purpose, current user, site, and expiry.
	 *
	 * @param mixed  $token   Candidate token.
	 * @param string $purpose Expected purpose.
	 *
	 * @return array<string,mixed>|WP_Error Verified payload or safe error.
	 */
	public function verify_token( $token, $purpose ) {
		if ( ! is_scalar( $token ) || false === strpos( (string) $token, '.' ) ) {
			return $this->get_invalid_error();
		}

		list( $encoded, $signature ) = array_pad( explode( '.', (string) $token, 2 ), 2, '' );
		$expected_signature          = hash_hmac( 'sha256', $encoded, wp_salt( 'nonce' ) );
		if ( ! $signature || ! hash_equals( $expected_signature, $signature ) ) {
			return $this->get_invalid_error();
		}

		$decoded  = $this->base64_url_decode( $encoded );
		$envelope = $decoded ? json_decode( $decoded, true ) : null;
		if (
			! is_array( $envelope )
			|| 1 !== absint( isset( $envelope['version'] ) ? $envelope['version'] : 0 )
			|| sanitize_key( isset( $envelope['purpose'] ) ? $envelope['purpose'] : '' ) !== sanitize_key( $purpose )
			|| get_current_user_id() !== absint( isset( $envelope['user_id'] ) ? $envelope['user_id'] : 0 )
			|| get_current_blog_id() !== absint( isset( $envelope['site_id'] ) ? $envelope['site_id'] : 0 )
			|| time() > absint( isset( $envelope['expires'] ) ? $envelope['expires'] : 0 )
			|| ! isset( $envelope['payload'] )
			|| ! is_array( $envelope['payload'] )
		) {
			return $this->get_invalid_error();
		}

		return $envelope['payload'];
	}

	/**
	 * Build the canonical Add Booking URL for a verified selection context.
	 *
	 * @param array<string,mixed> $payload Authorized handoff payload.
	 *
	 * @return string Add Booking URL.
	 */
	public function get_add_booking_url( $payload ) {
		$query = array(
			'page'                  => 'wpbc',
			'tab'                   => 'add-booking',
			'booking_type'          => absint( $payload['resource_id'] ),
			'wpbc_timeline_handoff' => $this->create_token( 'booking_handoff', $payload ),
		);
		if ( ! empty( $payload['booking_form'] ) ) {
			$query['booking_form'] = sanitize_text_field( (string) $payload['booking_form'] );
		}

		return add_query_arg( $query, admin_url( 'admin.php' ) );
	}

	/**
	 * Build the canonical Add Appointment URL for a verified selection context.
	 *
	 * @param array<string,mixed> $payload Authorized handoff payload.
	 *
	 * @return string Add Appointment URL.
	 */
	public function get_add_appointment_url( $payload ) {
		$query = array(
			'page'                      => 'wpbc',
			'tab'                       => 'add-appointment',
			'wpbc_appointment_provider' => absint( $payload['resource_id'] ),
			'wpbc_timeline_handoff'     => $this->create_token( 'appointment_handoff', $payload ),
		);
		if ( ! empty( $payload['service_id'] ) ) {
			$query['wpbc_appointment_service'] = absint( $payload['service_id'] );
		}

		return add_query_arg( $query, admin_url( 'admin.php' ) );
	}

	/**
	 * Build a canonical Timeline return URL from signed handoff context.
	 *
	 * @param array<string,mixed> $payload Authorized handoff payload.
	 *
	 * @return string Timeline URL.
	 */
	public function get_timeline_return_url( $payload ) {
		return add_query_arg(
			array(
				'page'                 => 'wpbc',
				'tab'                  => 'timeline',
				'wpbc_timeline_return' => $this->create_token( 'timeline_return', $payload ),
			),
			admin_url( 'admin.php' )
		);
	}

	/**
	 * Encode bytes for a URL query without padding.
	 *
	 * @param string $value Bytes to encode.
	 *
	 * @return string URL-safe value.
	 */
	private function base64_url_encode( $value ) {
		return rtrim( strtr( base64_encode( (string) $value ), '+/', '-_' ), '=' ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- Encoding, not obfuscation.
	}

	/**
	 * Decode a URL-safe base64 value.
	 *
	 * @param string $value Encoded value.
	 *
	 * @return string|false Decoded bytes or false.
	 */
	private function base64_url_decode( $value ) {
		$padding = strlen( $value ) % 4;
		if ( $padding ) {
			$value .= str_repeat( '=', 4 - $padding );
		}

		return base64_decode( strtr( $value, '-_', '+/' ), true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- Decoding a signed transport token.
	}

	/**
	 * Return a non-sensitive token failure.
	 *
	 * @return WP_Error Invalid token error.
	 */
	private function get_invalid_error() {
		return new WP_Error(
			'wpbc_timeline_handoff_invalid',
			__( 'This Timeline selection expired or is invalid. Return to Timeline and select the range again.', 'booking' ),
			array( 'status' => 403 )
		);
	}
}
