<?php
/**
 * Authenticated Timeline read, preference, preview, and Availability orchestration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_ajax_wpbc_timeline_read_window', 'wpbc_timeline_ajax_read_window' );
add_action( 'wp_ajax_wpbc_timeline_save_preferences', 'wpbc_timeline_ajax_save_preferences' );
add_action( 'wp_ajax_wpbc_timeline_reset_preferences', 'wpbc_timeline_ajax_reset_preferences' );
add_action( 'wp_ajax_wpbc_timeline_preview_selection', 'wpbc_timeline_ajax_preview_selection' );
add_action( 'wp_ajax_wpbc_timeline_apply_block', 'wpbc_timeline_ajax_apply_block' );

/**
 * Return one authorized, bounded Timeline window as data-only JSON.
 *
 * The operation never accepts ownership or site identifiers and never mutates
 * canonical booking data. Authorization, Resource ownership, scale allow-list,
 * and window budgets are rechecked for every request.
 *
 * @return void
 */
function wpbc_timeline_ajax_read_window() {
	if ( false === check_ajax_referer( 'wpbc_timeline_read', 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_nonce_invalid',
				'message' => __( 'The Timeline request expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}

	$request_values = wpbc_timeline_get_ajax_window_request( wp_unslash( $_POST ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$result         = ( new WPBC_Timeline_Read_Operations() )->get_window( $request_values );
	if ( is_wp_error( $result ) ) {
		$error_data = $result->get_error_data();
		$status     = is_array( $error_data ) && isset( $error_data['status'] ) ? absint( $error_data['status'] ) : 400;
		wp_send_json_error(
			array(
				'code'    => sanitize_key( $result->get_error_code() ),
				'message' => sanitize_text_field( $result->get_error_message() ),
				'details' => is_array( $error_data ) ? array_map( 'absint', $error_data ) : array(),
			),
			$status
		);
	}

	wp_send_json_success( $result );
}

/**
 * Save one authorized per-user Timeline toolbar preference snapshot.
 *
 * The endpoint stores presentation state in site-scoped WordPress user meta.
 * It does not mutate bookings, Resources, Availability, or Pricing data.
 *
 * @return void
 */
function wpbc_timeline_ajax_save_preferences() {
	if ( false === check_ajax_referer( 'wpbc_timeline_preferences', 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_preferences_nonce_invalid',
				'message' => __( 'The Timeline preference request expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}

	$authorization = new WPBC_Timeline_Authorization();
	if ( ! $authorization->current_user_can_view() ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_preferences_forbidden',
				'message' => __( 'You are not allowed to save Timeline preferences.', 'booking' ),
			),
			403
		);
	}

	$request_values = wpbc_timeline_get_ajax_preferences_request( wp_unslash( $_POST ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$result         = ( new WPBC_Timeline_Preferences() )->save_toolbar_preferences( $request_values );
	if ( is_wp_error( $result ) ) {
		wpbc_timeline_send_ajax_error( $result );
	}

	wp_send_json_success( array( 'preferences' => $result ) );
}

/**
 * Reset authorized per-user Timeline display preferences to configuration.
 *
 * The endpoint resets toolbar and Resource-view fields stored in the same
 * site-scoped user option. It does not mutate booking-domain data.
 *
 * @return void
 */
function wpbc_timeline_ajax_reset_preferences() {
	if ( false === check_ajax_referer( 'wpbc_timeline_preferences', 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_preferences_nonce_invalid',
				'message' => __( 'The Timeline preference request expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}

	$authorization = new WPBC_Timeline_Authorization();
	if ( ! $authorization->current_user_can_view() ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_preferences_forbidden',
				'message' => __( 'You are not allowed to reset Timeline preferences.', 'booking' ),
			),
			403
		);
	}

	$result = ( new WPBC_Timeline_Preferences() )->reset_toolbar_preferences();
	if ( is_wp_error( $result ) ) {
		wpbc_timeline_send_ajax_error( $result );
	}
	$resource_result = ( new WPBC_Timeline_Resource_View_Service() )->resolve_initial();
	if ( is_wp_error( $resource_result ) ) {
		wpbc_timeline_send_ajax_error( $resource_result );
	}

	wp_send_json_success(
		array_merge(
			array( 'reset' => true ),
			wpbc_timeline_resource_view_get_ajax_response( $resource_result )
		)
	);
}

/**
 * Return one authorized, non-mutating selection preview as data-only JSON.
 *
 * @return void
 */
function wpbc_timeline_ajax_preview_selection() {
	if ( false === check_ajax_referer( 'wpbc_timeline_selection_preview', 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_selection_nonce_invalid',
				'message' => __( 'The selection preview expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}

	$request_values = wpbc_timeline_get_ajax_selection_request( wp_unslash( $_POST ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$result         = ( new WPBC_Timeline_Selection_Preview() )->get_preview( $request_values );
	if ( is_wp_error( $result ) ) {
		wpbc_timeline_send_ajax_error( $result );
	}

	wp_send_json_success( $result );
}

/**
 * Apply one separately authorized and signed Availability block operation.
 *
 * @return void
 */
function wpbc_timeline_ajax_apply_block() {
	if ( false === check_ajax_referer( 'wpbc_timeline_apply_block', 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_block_nonce_invalid',
				'message' => __( 'The Availability action expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}

	$token  = isset( $_POST['block_token'] ) && is_scalar( $_POST['block_token'] ) ? sanitize_text_field( wp_unslash( $_POST['block_token'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$mode   = isset( $_POST['mode'] ) && is_scalar( $_POST['mode'] ) ? sanitize_key( wp_unslash( $_POST['mode'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$result = ( new WPBC_Timeline_Block_Service() )->apply( $token, $mode );
	if ( is_wp_error( $result ) ) {
		wpbc_timeline_send_ajax_error( $result );
	}

	wp_send_json_success( $result );
}

/**
 * Copy only documented selection-preview fields from an untrusted payload.
 *
 * @param mixed $request_payload Untrusted request payload.
 *
 * @return array<string,mixed> Explicit selection request.
 */
function wpbc_timeline_get_ajax_selection_request( $request_payload ) {
	$request_payload      = is_array( $request_payload ) ? $request_payload : array();
	$request_values       = array();
	$selection_field_names = array(
		'resource_id',
		'selection_surface',
		'selection_kind',
		'selection_step_minutes',
		'view',
		'start_at',
		'end_at',
		'loaded_start_at',
		'loaded_end_at',
	);
	foreach ( $selection_field_names as $field_name ) {
		if ( isset( $request_payload[ $field_name ] ) && is_scalar( $request_payload[ $field_name ] ) ) {
			$request_values[ $field_name ] = sanitize_text_field( (string) $request_payload[ $field_name ] );
		}
	}
	if ( isset( $request_payload['return_context'] ) && is_array( $request_payload['return_context'] ) ) {
		$request_values['return_context'] = array();
		foreach ( array( 'window_days', 'window_months', 'view', 'anchor_at', 'anchor_ratio' ) as $context_key ) {
			if ( isset( $request_payload['return_context'][ $context_key ] ) && is_scalar( $request_payload['return_context'][ $context_key ] ) ) {
				$request_values['return_context'][ $context_key ] = sanitize_text_field( (string) $request_payload['return_context'][ $context_key ] );
			}
		}
	}
	if ( isset( $request_payload['loaded_context_tokens'] ) && is_array( $request_payload['loaded_context_tokens'] ) ) {
		$request_values['loaded_context_tokens'] = array_slice(
			array_map( 'sanitize_text_field', array_filter( $request_payload['loaded_context_tokens'], 'is_scalar' ) ),
			0,
			3
		);
	}

	return $request_values;
}

/**
 * Send a normalized Timeline domain error without exposing internals.
 *
 * @param WP_Error $error Domain error.
 *
 * @return void
 */
function wpbc_timeline_send_ajax_error( $error ) {
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

/**
 * Copy only documented Timeline read fields from an untrusted AJAX payload.
 *
 * @param mixed $request_payload Untrusted request payload.
 *
 * @return array<string,mixed> Explicit window-reader request.
 */
function wpbc_timeline_get_ajax_window_request( $request_payload ) {
	$request_payload = is_array( $request_payload ) ? $request_payload : array();
	$request_values  = array();
	$scalar_fields   = array( 'anchor_date', 'anchor_at', 'anchor_ratio', 'window_days', 'window_months', 'window_position', 'view', 'resource_view_context', 'request_generation' );
	foreach ( $scalar_fields as $field_name ) {
		if ( isset( $request_payload[ $field_name ] ) && is_scalar( $request_payload[ $field_name ] ) ) {
			$request_values[ $field_name ] = sanitize_text_field( (string) $request_payload[ $field_name ] );
		}
	}

	if ( isset( $request_payload['visible_statuses'] ) && is_array( $request_payload['visible_statuses'] ) ) {
		$request_values['visible_statuses'] = array_map( 'sanitize_key', array_filter( $request_payload['visible_statuses'], 'is_scalar' ) );
	}

	return $request_values;
}

/**
 * Copy only documented Timeline toolbar preference fields from a request.
 *
 * @param mixed $request_payload Untrusted AJAX payload.
 *
 * @return array<string,string> Explicit preference request.
 */
function wpbc_timeline_get_ajax_preferences_request( $request_payload ) {
	$request_payload = is_array( $request_payload ) ? $request_payload : array();
	$request_values  = array();
	$scalar_fields   = array( 'anchor_date', 'anchor_ratio', 'window_days', 'window_months', 'view', 'visual_zoom_percent' );

	foreach ( $scalar_fields as $field_name ) {
		if ( isset( $request_payload[ $field_name ] ) && is_scalar( $request_payload[ $field_name ] ) ) {
			$request_values[ $field_name ] = sanitize_text_field( (string) $request_payload[ $field_name ] );
		}
	}

	return $request_values;
}
