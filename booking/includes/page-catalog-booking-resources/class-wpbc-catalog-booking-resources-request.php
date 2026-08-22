<?php
/**
 * Booking Resources-specific catalog request validation.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validate filters that the domain-neutral shared request must not interpret.
 */
final class WPBC_Catalog_Booking_Resources_Request {

	/**
	 * Normalized Resource filter values.
	 *
	 * @var array
	 */
	private $values = array();

	/**
	 * Prevent direct construction; callers must use create().
	 *
	 * @param array $values Normalized Resource filter values.
	 */
	private function __construct( $values ) {
		$this->values = $values;
	}

	/**
	 * Create a validated Booking Resources request.
	 *
	 * Unknown keys are rejected so arbitrary endpoint input cannot cross into
	 * the repository. The default `all` view preserves hierarchy groups, while
	 * explicit type filters intentionally return flat matching Resources in
	 * Business Large and higher. Lower editions normalize every valid type to
	 * `all`, which prevents stale paid-edition preferences from hiding rows
	 * after an edition downgrade.
	 *
	 * @param mixed $request_values Untrusted Resource filter values.
	 *
	 * @return WPBC_Catalog_Booking_Resources_Request|WP_Error Valid request or safe error.
	 */
	public static function create( $request_values = array() ) {
		if ( ! is_array( $request_values ) ) {
			return self::get_error( 'malformed_request', __( 'The Booking Resources request is malformed.', 'booking' ) );
		}

		$allowed_keys = array( 'resource_type', 'hierarchy_state' );
		if ( array_diff( array_keys( $request_values ), $allowed_keys ) ) {
			return self::get_error( 'unsupported_filter', __( 'The Booking Resources request contains an unsupported filter.', 'booking' ) );
		}

		$resource_type = 'all';
		if ( array_key_exists( 'resource_type', $request_values ) ) {
			if ( ! is_scalar( $request_values['resource_type'] ) ) {
				return self::get_error( 'invalid_resource_type', __( 'The requested Booking Resource type is invalid.', 'booking' ) );
			}

			$resource_type = sanitize_key( (string) $request_values['resource_type'] );
			if ( ! in_array( $resource_type, array( 'all', 'single', 'parent', 'child' ), true ) ) {
				return self::get_error( 'invalid_resource_type', __( 'The requested Booking Resource type is invalid.', 'booking' ) );
			}
		}
		if ( ! class_exists( 'wpdev_bk_biz_l' ) ) {
			$resource_type = 'all';
		}

		$hierarchy_state = WPBC_UI_Catalog_Hierarchy::normalize_preference_state(
			array_key_exists( 'hierarchy_state', $request_values ) ? $request_values['hierarchy_state'] : ''
		);
		if ( is_wp_error( $hierarchy_state ) ) {
			return $hierarchy_state;
		}

		return new self(
			array(
				'resource_type'   => $resource_type,
				'hierarchy_state' => $hierarchy_state,
			)
		);
	}

	/**
	 * Return one normalized Resource filter.
	 *
	 * @param string $request_key Resource filter key.
	 * @param mixed  $default     Value returned when the key is unavailable.
	 *
	 * @return mixed Normalized value or the supplied default.
	 */
	public function get( $request_key, $default = null ) {
		$request_key = is_scalar( $request_key ) ? sanitize_key( (string) $request_key ) : '';

		return array_key_exists( $request_key, $this->values ) ? $this->values[ $request_key ] : $default;
	}

	/**
	 * Export normalized Resource filters.
	 *
	 * @return array<string,mixed> Normalized filter values.
	 */
	public function to_array() {
		return $this->values;
	}

	/**
	 * Return hierarchy state as a stable JSON preference scalar.
	 *
	 * @return string JSON-encoded normalized hierarchy state.
	 */
	public function get_hierarchy_state_json() {
		return (string) wp_json_encode( $this->get( 'hierarchy_state', array() ) );
	}

	/**
	 * Create a namespaced, non-sensitive domain request error.
	 *
	 * @param string $error_code    Short error code.
	 * @param string $error_message Safe localized message.
	 *
	 * @return WP_Error Request error.
	 */
	private static function get_error( $error_code, $error_message ) {
		return new WP_Error( 'wpbc_catalog_booking_resources_' . sanitize_key( $error_code ), $error_message );
	}
}
