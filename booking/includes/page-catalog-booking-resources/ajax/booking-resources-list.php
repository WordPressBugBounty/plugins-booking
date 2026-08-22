<?php
/**
 * Read-only list endpoint for the independent Booking Resources catalog.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Send a normalized catalog error without exposing internal diagnostics.
 *
 * @param int      $request_id Client request sequence when safely available.
 * @param WP_Error $error      Safe WordPress error.
 * @param int      $status     HTTP status code.
 * @param bool     $retryable  Whether the browser may retry the request.
 *
 * @return void Terminates the AJAX request with JSON.
 */
function wpbc_catalog_booking_resources_send_list_error( $request_id, $error, $status, $retryable = false ) {
	wp_send_json(
		WPBC_UI_Catalog_Response::from_wp_error(
			'catalog_booking_resources',
			$request_id,
			$error,
			$retryable
		),
		absint( $status )
	);
}

/**
 * Return the client request sequence without trusting any other request data.
 *
 * @param mixed $request_values Untrusted request payload.
 *
 * @return int Non-negative request sequence or zero.
 */
function wpbc_catalog_booking_resources_get_list_request_id( $request_values ) {
	if ( ! is_array( $request_values ) || ! isset( $request_values['request_id'] ) || ! is_scalar( $request_values['request_id'] ) ) {
		return 0;
	}

	return preg_match( '/^\d+$/', (string) $request_values['request_id'] ) ? (int) $request_values['request_id'] : 0;
}

/**
 * Serve an authorized normalized Booking Resources list response.
 *
 * The endpoint owns transport authorization only. Shared and domain request
 * objects validate input, the repository owns SQL/visibility, the DTO owns the
 * JSON item contract, and no layer produces row HTML.
 *
 * @return void Terminates the AJAX request with JSON.
 */
function wpbc_catalog_booking_resources_ajax_list() {
	$registry      = WPBC_UI_Catalog_Registry::get_instance();
	$configuration = $registry->get_configuration( 'catalog_booking_resources' );
	if ( empty( $configuration ) ) {
		wpbc_catalog_booking_resources_send_list_error(
			0,
			new WP_Error( 'wpbc_catalog_booking_resources_unavailable', __( 'The Booking Resources catalog is unavailable.', 'booking' ) ),
			503,
			true
		);
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified immediately below using the registered nonce action.
	$raw_request = is_array( $_POST ) ? wp_unslash( $_POST ) : array();
	$request_id  = wpbc_catalog_booking_resources_get_list_request_id( $raw_request );

	if ( false === check_ajax_referer( $configuration['nonce_name'], 'nonce', false ) ) {
		wpbc_catalog_booking_resources_send_list_error(
			$request_id,
			new WP_Error( 'wpbc_catalog_booking_resources_invalid_nonce', __( 'Security check failed.', 'booking' ) ),
			403
		);
	}

	if ( ! current_user_can( wpbc_catalog_booking_resources_get_manage_capability() ) ) {
		wpbc_catalog_booking_resources_send_list_error(
			$request_id,
			new WP_Error( 'wpbc_catalog_booking_resources_forbidden', __( 'You do not have permission to view Booking Resources.', 'booking' ) ),
			403
		);
	}

	$preference_action = isset( $raw_request['preference_action'] ) && is_scalar( $raw_request['preference_action'] )
		? sanitize_key( (string) $raw_request['preference_action'] )
		: '';
	if ( ! in_array( $preference_action, array( '', 'save', 'reset' ), true ) ) {
		wpbc_catalog_booking_resources_send_list_error(
			$request_id,
			new WP_Error( 'wpbc_catalog_booking_resources_invalid_preference_action', __( 'The catalog preference request is invalid.', 'booking' ) ),
			400
		);
	}
	$has_preference_revision = isset( $raw_request['preference_revision'] )
		&& is_scalar( $raw_request['preference_revision'] )
		&& preg_match( '/^\d+$/', (string) $raw_request['preference_revision'] );
	$preference_revision = $has_preference_revision
		? ltrim( (string) $raw_request['preference_revision'], '0' )
		: '0';
	$preference_revision = '' === $preference_revision ? '0' : $preference_revision;
	if ( '' !== $preference_action && '0' === $preference_revision ) {
		wpbc_catalog_booking_resources_send_list_error(
			$request_id,
			new WP_Error( 'wpbc_catalog_booking_resources_invalid_preference_revision', __( 'The catalog preference request is invalid.', 'booking' ) ),
			400
		);
	}
	if (
		isset( $raw_request['preferences_only'] )
		&& ( ! is_scalar( $raw_request['preferences_only'] ) || ! in_array( (string) $raw_request['preferences_only'], array( '0', '1' ), true ) )
	) {
		wpbc_catalog_booking_resources_send_list_error(
			$request_id,
			new WP_Error( 'wpbc_catalog_booking_resources_invalid_preference_request', __( 'The catalog preference request is invalid.', 'booking' ) ),
			400
		);
	}
	$preferences_only = isset( $raw_request['preferences_only'] ) && '1' === (string) $raw_request['preferences_only'];
	if ( $preferences_only && 'save' !== $preference_action ) {
		wpbc_catalog_booking_resources_send_list_error(
			$request_id,
			new WP_Error( 'wpbc_catalog_booking_resources_invalid_preference_request', __( 'The catalog preference request is invalid.', 'booking' ) ),
			400
		);
	}
	if ( 'reset' === $preference_action ) {
		$preference_reset = WPBC_UI_Catalog_Preferences::reset( 'catalog_booking_resources', 0, $preference_revision );
		if ( ! $preference_reset ) {
			wpbc_catalog_booking_resources_send_list_error(
				$request_id,
				new WP_Error( 'wpbc_catalog_booking_resources_preference_reset_failed', __( 'The catalog preferences could not be reset.', 'booking' ) ),
				500,
				true
			);
		}
	}
	$stored_preferences = WPBC_UI_Catalog_Preferences::load( 'catalog_booking_resources' );

	$shared_keys = array(
		'request_id',
		'page_number',
		'items_per_page',
		'sort_by',
		'sort_order',
		'search',
		'visible_columns',
		'column_order',
		'template_pack',
	);
	$shared_values = array_intersect_key( $raw_request, array_fill_keys( $shared_keys, true ) );
	$request       = WPBC_UI_Catalog_Request::create( $configuration, $shared_values, $stored_preferences );
	if ( is_wp_error( $request ) ) {
		wpbc_catalog_booking_resources_send_list_error( $request_id, $request, 400 );
	}

	$stored_resource_values  = array_intersect_key( $stored_preferences, array( 'resource_type' => true, 'hierarchy_state' => true ) );
	$stored_resource_request = WPBC_Catalog_Booking_Resources_Request::create( $stored_resource_values );
	if ( is_wp_error( $stored_resource_request ) ) {
		$stored_resource_request = WPBC_Catalog_Booking_Resources_Request::create();
	}
	$resource_values = array(
		'resource_type'   => $stored_resource_request->get( 'resource_type', 'all' ),
		'hierarchy_state' => $stored_resource_request->get( 'hierarchy_state', array() ),
	);
	foreach ( array( 'resource_type', 'hierarchy_state' ) as $resource_key ) {
		if ( array_key_exists( $resource_key, $raw_request ) ) {
			$resource_values[ $resource_key ] = $raw_request[ $resource_key ];
		}
	}
	$resource_request = WPBC_Catalog_Booking_Resources_Request::create( $resource_values );
	if ( is_wp_error( $resource_request ) ) {
		wpbc_catalog_booking_resources_send_list_error( $request_id, $resource_request, 400 );
	}
	if ( 'save' === $preference_action ) {
		$preference_result = WPBC_UI_Catalog_Preferences::save(
			'catalog_booking_resources',
			$request,
			array(
				'resource_type'   => $resource_request->get( 'resource_type', 'all' ),
				'hierarchy_state' => $resource_request->get_hierarchy_state_json(),
			),
			0,
			$preference_revision
		);
		if ( is_wp_error( $preference_result ) ) {
			wpbc_catalog_booking_resources_send_list_error( $request_id, $preference_result, 400 );
		}
	}
	if ( $preferences_only ) {
		wp_send_json(
			array(
				'success'    => true,
				'request_id' => $request_id,
			),
			200
		);
	}

	$repository = new WPBC_Catalog_Booking_Resources_Repository();
	$provider = new WPBC_Catalog_Booking_Resources_Provider( $repository, null, $resource_request );
	$response = $provider->get_response( $request );
	if ( is_wp_error( $response ) ) {
		$is_retryable = 'wpbc_catalog_booking_resources_query_failed' === $response->get_error_code();
		wpbc_catalog_booking_resources_send_list_error( $request_id, $response, $is_retryable ? 500 : 400, $is_retryable );
	}

	wp_send_json( $response->to_array(), 200 );
}
add_action( 'wp_ajax_WPBC_AJX_CATALOG_BOOKING_RESOURCES_LIST', 'wpbc_catalog_booking_resources_ajax_list' );
