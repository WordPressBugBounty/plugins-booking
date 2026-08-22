<?php
/**
 * Appointment Services catalog domain request.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validate Service-only filters without adding domain knowledge to the shared catalog.
 *
 * Status and Provider filters are intentionally normalized beside the Service
 * endpoint because neither field is meaningful to another catalog domain.
 */
final class WPBC_Appointment_Services_Catalog_Request {

	/**
	 * Normalized Service filters.
	 *
	 * @var array<string,mixed>
	 */
	private $values = array();

	/**
	 * Create a validated Service request.
	 *
	 * @param mixed $request_values Untrusted Service filter values.
	 *
	 * @return WPBC_Appointment_Services_Catalog_Request|WP_Error Valid request or safe validation error.
	 */
	public static function create( $request_values = array() ) {
		$request_values = is_array( $request_values ) ? $request_values : array();
		$status         = 'all';
		if ( array_key_exists( 'status', $request_values ) ) {
			if ( ! is_scalar( $request_values['status'] ) ) {
				return new WP_Error( 'wpbc_appointment_services_invalid_status', __( 'The requested Service status is invalid.', 'booking' ) );
			}
			$status = sanitize_key( (string) $request_values['status'] );
		}
		if ( ! in_array( $status, array( 'all', 'active', 'inactive', 'archived' ), true ) ) {
			return new WP_Error( 'wpbc_appointment_services_invalid_status', __( 'The requested Service status is invalid.', 'booking' ) );
		}

		$resource_id = 0;
		if ( array_key_exists( 'resource_id', $request_values ) ) {
			if ( ! is_scalar( $request_values['resource_id'] ) || ! preg_match( '/^\d+$/', (string) $request_values['resource_id'] ) ) {
				return new WP_Error( 'wpbc_appointment_services_invalid_provider', __( 'The requested Provider is invalid.', 'booking' ) );
			}
			$resource_id = absint( $request_values['resource_id'] );
		}
		$provider_options = wpbc_appointment_services_get_provider_options();
		if ( $resource_id && ! isset( $provider_options[ $resource_id ] ) ) {
			return new WP_Error( 'wpbc_appointment_services_invalid_provider', __( 'The requested Provider is invalid.', 'booking' ) );
		}

		$request              = new self();
		$request->values       = array(
			'status'      => $status,
			'resource_id' => $resource_id,
		);

		return $request;
	}

	/**
	 * Return one normalized filter.
	 *
	 * @param string $key     Filter key.
	 * @param mixed  $default Fallback value.
	 *
	 * @return mixed Normalized value or fallback.
	 */
	public function get( $key, $default = null ) {
		return array_key_exists( $key, $this->values ) ? $this->values[ $key ] : $default;
	}
}
