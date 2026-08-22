<?php
/**
 * Lazy read-only details endpoint for the independent Resources catalog.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Send a normalized lazy-details error response.
 *
 * @param int      $request_id Client details-request sequence.
 * @param WP_Error $error      Safe error without internal diagnostics.
 * @param int      $status     HTTP response status.
 * @param bool     $retryable  Whether retrying may succeed.
 *
 * @return void Terminates the AJAX request with JSON.
 */
function wpbc_catalog_booking_resource_send_details_error( $request_id, $error, $status, $retryable = false ) {
	wp_send_json(
		array(
			'success'        => false,
			'schema_version' => 1,
			'catalog_id'     => 'catalog_booking_resources',
			'request_id'     => max( 0, absint( $request_id ) ),
			'error'          => array(
				'code'      => sanitize_key( $error->get_error_code() ),
				'message'   => sanitize_text_field( $error->get_error_message() ),
				'retryable' => (bool) $retryable,
			),
		),
		absint( $status )
	);
}

/**
 * Return a positive scalar integer from the details payload.
 *
 * @param array  $request_values Untrusted request values.
 * @param string $request_key    Allow-listed request key.
 * @param bool   $allow_zero     Whether zero is valid.
 *
 * @return int|false Normalized integer or false for malformed input.
 */
function wpbc_catalog_booking_resource_get_details_integer( $request_values, $request_key, $allow_zero = false ) {
	if ( ! is_array( $request_values ) || ! isset( $request_values[ $request_key ] ) || ! is_scalar( $request_values[ $request_key ] ) ) {
		return false;
	}
	$raw_integer = (string) $request_values[ $request_key ];
	if ( ! preg_match( '/^\d+$/', $raw_integer ) ) {
		return false;
	}
	$integer = (int) $raw_integer;

	return $allow_zero || 0 < $integer ? $integer : false;
}

/**
 * Serve authorized normalized details for one Resource.
 *
 * Authorization is repeated at the transport and repository boundaries. The
 * endpoint performs no SQL and returns no HTML; the browser renders the DTO
 * through the registered Resource details WP template.
 *
 * @return void Terminates the AJAX request with JSON.
 */
function wpbc_catalog_booking_resource_ajax_details() {
	$configuration = WPBC_UI_Catalog_Registry::get_instance()->get_configuration( 'catalog_booking_resources' );
	if ( empty( $configuration ) ) {
		wpbc_catalog_booking_resource_send_details_error( 0, new WP_Error( 'wpbc_catalog_booking_resource_details_unavailable', __( 'The Booking Resource details are unavailable.', 'booking' ) ), 503, true );
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified immediately below using the registered nonce action.
	$request_values = is_array( $_POST ) ? wp_unslash( $_POST ) : array();
	$request_id     = wpbc_catalog_booking_resource_get_details_integer( $request_values, 'request_id', true );
	$request_id     = false === $request_id ? 0 : $request_id;
	if ( false === check_ajax_referer( $configuration['nonce_name'], 'nonce', false ) ) {
		wpbc_catalog_booking_resource_send_details_error( $request_id, new WP_Error( 'wpbc_catalog_booking_resource_details_invalid_nonce', __( 'Security check failed.', 'booking' ) ), 403 );
	}
	if ( ! current_user_can( wpbc_catalog_booking_resources_get_manage_capability() ) ) {
		wpbc_catalog_booking_resource_send_details_error( $request_id, new WP_Error( 'wpbc_catalog_booking_resource_details_forbidden', __( 'You do not have permission to view Booking Resource details.', 'booking' ) ), 403 );
	}

	$resource_id = wpbc_catalog_booking_resource_get_details_integer( $request_values, 'resource_id' );
	if ( false === $resource_id ) {
		wpbc_catalog_booking_resource_send_details_error( $request_id, new WP_Error( 'wpbc_catalog_booking_resource_details_invalid_request', __( 'The Booking Resource details request is invalid.', 'booking' ) ), 400 );
	}

	$repository = new WPBC_Catalog_Booking_Resources_Repository();
	$resource   = $repository->get_resource_details( $resource_id );
	if ( is_wp_error( $resource ) ) {
		wpbc_catalog_booking_resource_send_details_error( $request_id, $resource, 500, true );
	}
	if ( null === $resource ) {
		wpbc_catalog_booking_resource_send_details_error( $request_id, new WP_Error( 'wpbc_catalog_booking_resource_details_not_found', __( 'The Booking Resource is unavailable or you do not have permission to view it.', 'booking' ) ), 404 );
	}

	$details = ( new WPBC_Catalog_Booking_Resource_Details_DTO() )->create( $resource );
	if ( is_wp_error( $details ) ) {
		wpbc_catalog_booking_resource_send_details_error( $request_id, $details, 500 );
	}

	wp_send_json(
		array(
			'success'        => true,
			'schema_version' => 1,
			'catalog_id'     => 'catalog_booking_resources',
			'request_id'     => $request_id,
			'resource_id'    => $resource_id,
			'details'        => $details,
		),
		200
	);
}
add_action( 'wp_ajax_WPBC_AJX_CATALOG_BOOKING_RESOURCE_DETAILS', 'wpbc_catalog_booking_resource_ajax_details' );
