<?php
/**
 * AJAX list endpoint for the template-driven Appointment Services catalog.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return a safe request sequence from an untrusted payload.
 *
 * @param mixed $request_values Untrusted request values.
 *
 * @return int Non-negative request sequence or zero.
 */
function wpbc_appointment_services_get_catalog_request_id( $request_values ) {
	if ( ! is_array( $request_values ) || ! isset( $request_values['request_id'] ) || ! is_scalar( $request_values['request_id'] ) ) {
		return 0;
	}

	return preg_match( '/^\d+$/', (string) $request_values['request_id'] ) ? (int) $request_values['request_id'] : 0;
}

/**
 * Send a normalized Services catalog error.
 *
 * @param int      $request_id Client request sequence.
 * @param WP_Error $error      Safe error.
 * @param int      $status     HTTP status.
 * @param bool     $retryable  Whether the browser may retry.
 *
 * @return void Terminates the AJAX request.
 */
function wpbc_appointment_services_send_catalog_error( $request_id, $error, $status, $retryable = false ) {
	wp_send_json(
		WPBC_UI_Catalog_Response::from_wp_error( 'appointment_services_catalog', $request_id, $error, $retryable ),
		absint( $status )
	);
}

/**
 * Serve the authorized Service list through the shared catalog contract.
 *
 * Transport authorization and request normalization stay here. The Service
 * repository owns SQL and ownership, while the DTO owns the item contract.
 *
 * @return void Terminates the AJAX request.
 */
function wpbc_appointment_services_ajax_list() {
	$configuration = WPBC_UI_Catalog_Registry::get_instance()->get_configuration( 'appointment_services_catalog' );
	if ( empty( $configuration ) ) {
		wpbc_appointment_services_send_catalog_error( 0, new WP_Error( 'wpbc_appointment_services_unavailable', __( 'The Services catalog is unavailable.', 'booking' ) ), 503, true );
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified immediately below.
	$raw_request = is_array( $_POST ) ? wp_unslash( $_POST ) : array();
	$request_id  = wpbc_appointment_services_get_catalog_request_id( $raw_request );
	if ( false === check_ajax_referer( $configuration['nonce_name'], 'nonce', false ) ) {
		wpbc_appointment_services_send_catalog_error( $request_id, new WP_Error( 'wpbc_appointment_services_invalid_nonce', __( 'Security check failed.', 'booking' ) ), 403 );
	}
	if ( ! current_user_can( wpbc_appointment_services_get_manage_capability() ) ) {
		wpbc_appointment_services_send_catalog_error( $request_id, new WP_Error( 'wpbc_appointment_services_forbidden', __( 'You do not have permission to view Services.', 'booking' ) ), 403 );
	}

	$preference_action = isset( $raw_request['preference_action'] ) && is_scalar( $raw_request['preference_action'] ) ? sanitize_key( (string) $raw_request['preference_action'] ) : '';
	if ( ! in_array( $preference_action, array( '', 'save', 'reset' ), true ) ) {
		wpbc_appointment_services_send_catalog_error( $request_id, new WP_Error( 'wpbc_appointment_services_invalid_preferences', __( 'The catalog preference request is invalid.', 'booking' ) ), 400 );
	}
	$preference_revision = isset( $raw_request['preference_revision'] ) && is_scalar( $raw_request['preference_revision'] ) && preg_match( '/^\d+$/', (string) $raw_request['preference_revision'] )
		? (string) $raw_request['preference_revision']
		: '0';
	if ( isset( $raw_request['preferences_only'] ) && ( ! is_scalar( $raw_request['preferences_only'] ) || ! in_array( (string) $raw_request['preferences_only'], array( '0', '1' ), true ) ) ) {
		wpbc_appointment_services_send_catalog_error( $request_id, new WP_Error( 'wpbc_appointment_services_invalid_preferences', __( 'The catalog preference request is invalid.', 'booking' ) ), 400 );
	}
	$preferences_only = isset( $raw_request['preferences_only'] ) && '1' === (string) $raw_request['preferences_only'];
	if ( '' !== $preference_action && '0' === $preference_revision ) {
		wpbc_appointment_services_send_catalog_error( $request_id, new WP_Error( 'wpbc_appointment_services_invalid_preferences', __( 'The catalog preference revision is invalid.', 'booking' ) ), 400 );
	}
	if ( $preferences_only && 'save' !== $preference_action ) {
		wpbc_appointment_services_send_catalog_error( $request_id, new WP_Error( 'wpbc_appointment_services_invalid_preferences', __( 'The catalog preference request is invalid.', 'booking' ) ), 400 );
	}
	if ( 'reset' === $preference_action && ! WPBC_UI_Catalog_Preferences::reset( 'appointment_services_catalog', 0, $preference_revision ) ) {
		wpbc_appointment_services_send_catalog_error( $request_id, new WP_Error( 'wpbc_appointment_services_preference_reset_failed', __( 'The catalog preferences could not be reset.', 'booking' ) ), 500, true );
	}

	$stored_preferences = WPBC_UI_Catalog_Preferences::load( 'appointment_services_catalog' );
	$shared_keys        = array( 'request_id', 'page_number', 'items_per_page', 'sort_by', 'sort_order', 'search', 'visible_columns', 'column_order', 'template_pack' );
	$shared_request     = WPBC_UI_Catalog_Request::create(
		$configuration,
		array_intersect_key( $raw_request, array_fill_keys( $shared_keys, true ) ),
		$stored_preferences
	);
	if ( is_wp_error( $shared_request ) ) {
		wpbc_appointment_services_send_catalog_error( $request_id, $shared_request, 400 );
	}

	$service_values = array(
		'status'      => isset( $stored_preferences['status'] ) ? $stored_preferences['status'] : 'all',
		'resource_id' => isset( $stored_preferences['resource_id'] ) ? $stored_preferences['resource_id'] : 0,
	);
	foreach ( array( 'status', 'resource_id' ) as $service_key ) {
		if ( array_key_exists( $service_key, $raw_request ) ) {
			$service_values[ $service_key ] = $raw_request[ $service_key ];
		}
	}
	$service_request = WPBC_Appointment_Services_Catalog_Request::create( $service_values );
	if ( is_wp_error( $service_request ) ) {
		wpbc_appointment_services_send_catalog_error( $request_id, $service_request, 400 );
	}

	if ( 'save' === $preference_action ) {
		$preference_result = WPBC_UI_Catalog_Preferences::save(
			'appointment_services_catalog',
			$shared_request,
			array(
				'status'      => $service_request->get( 'status', 'all' ),
				'resource_id' => $service_request->get( 'resource_id', 0 ),
			),
			0,
			$preference_revision
		);
		if ( is_wp_error( $preference_result ) ) {
			wpbc_appointment_services_send_catalog_error( $request_id, $preference_result, 400 );
		}
	}
	if ( $preferences_only ) {
		wp_send_json( array( 'success' => true, 'request_id' => $request_id ), 200 );
	}

	$response = ( new WPBC_Appointment_Services_Catalog_Provider( wpbc_appointment_services_get_data_provider(), null, $service_request ) )->get_response( $shared_request );
	if ( is_wp_error( $response ) ) {
		wpbc_appointment_services_send_catalog_error( $request_id, $response, 500, true );
	}

	wp_send_json( $response->to_array(), 200 );
}
add_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICES_LIST', 'wpbc_appointment_services_ajax_list' );
