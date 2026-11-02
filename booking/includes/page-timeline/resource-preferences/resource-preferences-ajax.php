<?php
/**
 * Authenticated Timeline Resource-selector and Resource-view AJAX endpoints.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_ajax_wpbc_timeline_read_resources', 'wpbc_timeline_ajax_read_resources' );
add_action( 'wp_ajax_wpbc_timeline_read_resource_selection', 'wpbc_timeline_ajax_read_resource_selection' );
add_action( 'wp_ajax_wpbc_timeline_save_resource_view', 'wpbc_timeline_ajax_save_resource_view' );
add_action( 'wp_ajax_wpbc_timeline_reset_resource_view', 'wpbc_timeline_ajax_reset_resource_view' );
add_action( 'wp_ajax_wpbc_timeline_read_resource_settings', 'wpbc_timeline_ajax_read_resource_settings' );
add_action( 'wp_ajax_wpbc_timeline_save_resource_settings', 'wpbc_timeline_ajax_save_resource_settings' );
add_action( 'wp_ajax_wpbc_timeline_reset_resource_settings', 'wpbc_timeline_ajax_reset_resource_settings' );

/**
 * Return one authorized, independently paged Resource-selector response.
 *
 * @return void
 */
function wpbc_timeline_ajax_read_resources() {
	if ( false === check_ajax_referer( 'wpbc_timeline_read_resources', 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_resource_selector_nonce_invalid',
				'message' => __( 'The booking Resource request expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}

	$request_values = wpbc_timeline_resource_selector_get_ajax_request( wp_unslash( $_POST ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$result         = ( new WPBC_Timeline_Resource_Selector_Read_Service() )->read( $request_values );
	if ( is_wp_error( $result ) ) {
		wpbc_timeline_resource_selector_send_ajax_error( $result );
	}

	wp_send_json_success( $result );
}

/**
 * Return the bounded authorized IDs used to materialize an `all` draft.
 *
 * @return void
 */
function wpbc_timeline_ajax_read_resource_selection() {
	if ( false === check_ajax_referer( 'wpbc_timeline_read_resource_selection', 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_resource_selection_nonce_invalid',
				'message' => __( 'The booking Resource selection request expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}

	$result = ( new WPBC_Timeline_Resource_Selection_Read_Service() )->read();
	if ( is_wp_error( $result ) ) {
		wpbc_timeline_resource_selector_send_ajax_error( $result );
	}

	wp_send_json_success( $result );
}

/**
 * Save one complete, authorized current-user Resource-view subrecord.
 *
 * @return void
 */
function wpbc_timeline_ajax_save_resource_view() {
	if ( false === check_ajax_referer( 'wpbc_timeline_resource_view', 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_resource_view_nonce_invalid',
				'message' => __( 'The Timeline Resource preference request expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}

	$request_values = wpbc_timeline_resource_view_get_ajax_request( wp_unslash( $_POST ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$result         = ( new WPBC_Timeline_Resource_View_Service() )->save( $request_values );
	if ( is_wp_error( $result ) ) {
		wpbc_timeline_resource_selector_send_ajax_error( $result );
	}

	wp_send_json_success( wpbc_timeline_resource_view_get_ajax_response( $result ) );
}

/**
 * Reset only the current user's Resource-view subrecord.
 *
 * @return void
 */
function wpbc_timeline_ajax_reset_resource_view() {
	if ( false === check_ajax_referer( 'wpbc_timeline_resource_view', 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_resource_view_nonce_invalid',
				'message' => __( 'The Timeline Resource preference request expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}

	$result = ( new WPBC_Timeline_Resource_View_Service() )->reset();
	if ( is_wp_error( $result ) ) {
		wpbc_timeline_resource_selector_send_ajax_error( $result );
	}

	wp_send_json_success( wpbc_timeline_resource_view_get_ajax_response( $result ) );
}

/**
 * Return one exact authorized Resource-settings DTO.
 *
 * @return void
 */
function wpbc_timeline_ajax_read_resource_settings() {
	if ( false === check_ajax_referer( 'wpbc_timeline_read_resource_settings', 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_resource_settings_nonce_invalid',
				'message' => __( 'The Resource settings request expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}

	$request_values = wpbc_timeline_resource_settings_get_ajax_request( wp_unslash( $_POST ), false ); // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$result         = ( new WPBC_Timeline_Resource_Settings_Service() )->read( $request_values );
	if ( is_wp_error( $result ) ) {
		wpbc_timeline_resource_selector_send_ajax_error( $result );
	}

	wp_send_json_success( $result );
}

/**
 * Save one exact authorized Resource display-preference record.
 *
 * @return void
 */
function wpbc_timeline_ajax_save_resource_settings() {
	if ( false === check_ajax_referer( 'wpbc_timeline_resource_settings', 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_resource_settings_nonce_invalid',
				'message' => __( 'The Resource settings request expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}

	$request_values = wpbc_timeline_resource_settings_get_ajax_request( wp_unslash( $_POST ), true ); // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$result         = ( new WPBC_Timeline_Resource_Settings_Service() )->save( $request_values );
	if ( is_wp_error( $result ) ) {
		wpbc_timeline_resource_selector_send_ajax_error( $result );
	}

	wp_send_json_success( $result );
}

/**
 * Remove one exact authorized Resource display-preference record.
 *
 * @return void
 */
function wpbc_timeline_ajax_reset_resource_settings() {
	if ( false === check_ajax_referer( 'wpbc_timeline_resource_settings', 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_resource_settings_nonce_invalid',
				'message' => __( 'The Resource settings request expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}

	$request_values = wpbc_timeline_resource_settings_get_ajax_request( wp_unslash( $_POST ), false ); // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$result         = ( new WPBC_Timeline_Resource_Settings_Service() )->reset( $request_values );
	if ( is_wp_error( $result ) ) {
		wpbc_timeline_resource_selector_send_ajax_error( $result );
	}

	wp_send_json_success( $result );
}

/**
 * Copy only selector-owned request fields from an untrusted AJAX payload.
 *
 * Values remain unnormalized so the domain validator can distinguish missing
 * values from explicitly malformed arrays or objects.
 *
 * @param mixed $request_payload Untrusted request payload.
 *
 * @return array<string,mixed> Allow-listed selector request.
 */
function wpbc_timeline_resource_selector_get_ajax_request( $request_payload ) {
	$request_payload = is_array( $request_payload ) ? $request_payload : array();
	$request_values  = array();

	foreach ( array( 'page', 'per_page', 'search', 'sort_order' ) as $field_name ) {
		if ( array_key_exists( $field_name, $request_payload ) ) {
			$request_values[ $field_name ] = $request_payload[ $field_name ];
		}
	}

	return $request_values;
}

/**
 * Copy only Resource-view-owned values from an untrusted AJAX payload.
 *
 * Values intentionally remain unnormalized so the domain validator can reject
 * malformed scalar, list, size, and identifier representations precisely.
 *
 * @param mixed $request_payload Untrusted request payload.
 *
 * @return array<string,mixed> Allow-listed Resource-view draft.
 */
function wpbc_timeline_resource_view_get_ajax_request( $request_payload ) {
	$request_payload = is_array( $request_payload ) ? $request_payload : array();
	$request_values  = array();

	foreach ( array( 'selection_mode', 'sort_order', 'page', 'per_page' ) as $field_name ) {
		if ( array_key_exists( $field_name, $request_payload ) ) {
			$request_values[ $field_name ] = $request_payload[ $field_name ];
		}
	}
	foreach ( array( 'selected_resource_ids', 'expanded_resource_ids', 'expanded_parent_ids' ) as $field_name ) {
		if ( array_key_exists( $field_name, $request_payload ) ) {
			$request_values[ $field_name ] = $request_payload[ $field_name ];
		}
	}

	return $request_values;
}

/**
 * Copy only Resource-settings-owned fields from an untrusted AJAX payload.
 *
 * Values remain unnormalized so the domain validator can reject malformed
 * identifiers, modes, arrays, and templates precisely.
 *
 * @param mixed $request_payload Untrusted request payload.
 * @param bool  $include_draft   Whether save-owned mode/template fields are allowed.
 *
 * @return array<string,mixed> Allow-listed Resource-settings request.
 */
function wpbc_timeline_resource_settings_get_ajax_request( $request_payload, $include_draft ) {
	$request_payload = is_array( $request_payload ) ? $request_payload : array();
	$request_values  = array();
	$field_names     = $include_draft ? array( 'resource_id', 'mode', 'template' ) : array( 'resource_id' );

	foreach ( $field_names as $field_name ) {
		if ( array_key_exists( $field_name, $request_payload ) ) {
			$request_values[ $field_name ] = $request_payload[ $field_name ];
		}
	}

	return $request_values;
}

/**
 * Map an internal Resource-view result to the exact public AJAX allow-list.
 *
 * Repository Resource records remain internal to authorized window reads.
 * This boundary prevents owner IDs, raw costs, priorities, and other
 * repository-only values from entering save/reset JSON.
 *
 * @param mixed $service_result Internal Resource-view service result.
 *
 * @return array<string,mixed> Public canonical state and signed context.
 */
function wpbc_timeline_resource_view_get_ajax_response( $service_result ) {
	$service_result = is_array( $service_result ) ? $service_result : array();

	return array(
		'resource_view'         => isset( $service_result['resource_view'] ) && is_array( $service_result['resource_view'] )
			? $service_result['resource_view']
			: array(),
		'resource_pagination'   => isset( $service_result['resource_pagination'] ) && is_array( $service_result['resource_pagination'] )
			? $service_result['resource_pagination']
			: array(),
		'resource_view_context' => isset( $service_result['resource_view_context'] ) && is_scalar( $service_result['resource_view_context'] )
			? sanitize_text_field( (string) $service_result['resource_view_context'] )
			: '',
	);
}

/**
 * Send one normalized selector-domain error without exposing internals.
 *
 * @param WP_Error $error Selector-domain error.
 *
 * @return void
 */
function wpbc_timeline_resource_selector_send_ajax_error( $error ) {
	$error_data = $error->get_error_data();
	$status     = is_array( $error_data ) && isset( $error_data['status'] ) ? absint( $error_data['status'] ) : 400;

	wp_send_json_error(
		array(
			'code'    => sanitize_key( $error->get_error_code() ),
			'message' => sanitize_text_field( $error->get_error_message() ),
		),
		$status
	);
}
