<?php
/**
 * Authenticated persistence endpoint for Timeline time-row preferences.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_ajax_wpbc_timeline_time_rows_save_preferences', 'wpbc_timeline_time_rows_ajax_save_preferences' );

/**
 * Save one current user's settings for one exactly authorized Resource.
 *
 * This endpoint is not used to expand or read a presentation. Initial values
 * arrive inside the already-authorized native Timeline Resource DTO.
 *
 * @return void
 */
function wpbc_timeline_time_rows_ajax_save_preferences() {
	if ( false === check_ajax_referer( 'wpbc_timeline_time_rows_preferences', 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_time_rows_preferences_nonce_invalid',
				'message' => __( 'The expanded schedule settings request expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}

	$authorization = new WPBC_Timeline_Authorization();
	if ( ! $authorization->current_user_can_view() ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_timeline_time_rows_preferences_forbidden',
				'message' => __( 'You are not allowed to save expanded schedule settings.', 'booking' ),
			),
			403
		);
	}

	$request_values = wpbc_timeline_time_rows_get_preferences_request( wp_unslash( $_POST ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$resource_id    = isset( $request_values['resource_id'] ) && preg_match( '/^\d+$/', (string) $request_values['resource_id'] )
		? absint( $request_values['resource_id'] )
		: 0;
	if ( ! $resource_id ) {
		wpbc_timeline_time_rows_send_preferences_error(
			new WP_Error( 'wpbc_timeline_time_rows_resource_invalid', __( 'The booking Resource is invalid.', 'booking' ), array( 'status' => 400 ) )
		);
	}

	$resources = ( new WPBC_Timeline_Resource_Repository() )->get_authorized_resources_by_ids( array( $resource_id ) );
	if ( is_wp_error( $resources ) ) {
		wpbc_timeline_time_rows_send_preferences_error( $resources );
	}
	if ( 1 !== count( $resources ) || $resource_id !== absint( $resources[0]['id'] ) ) {
		wpbc_timeline_time_rows_send_preferences_error(
			new WP_Error(
				'wpbc_timeline_time_rows_resource_unavailable',
				__( 'The booking Resource is not available.', 'booking' ),
				array( 'status' => 404 )
			)
		);
	}

	$result = WPBC_Timeline_Time_Rows_Config::get_preferences_service()->save_for_resource( $resource_id, $request_values );
	if ( is_wp_error( $result ) ) {
		wpbc_timeline_time_rows_send_preferences_error( $result );
	}

	wp_send_json_success(
		array(
			'resource_id' => $resource_id,
			'preferences' => $result,
		)
	);
}

/**
 * Extract only the fixed preference allow list from an AJAX request.
 *
 * @param mixed $request_values Untrusted request data.
 *
 * @return array<string,mixed> Allow-listed scalar candidates.
 */
function wpbc_timeline_time_rows_get_preferences_request( $request_values ) {
	$request_values = is_array( $request_values ) ? $request_values : array();
	$allowed_keys   = array( 'resource_id', 'range_mode', 'start_minute', 'end_minute', 'zoom_percent' );
	$normalized     = array();

	foreach ( $allowed_keys as $allowed_key ) {
		if ( isset( $request_values[ $allowed_key ] ) && is_scalar( $request_values[ $allowed_key ] ) ) {
			$normalized[ $allowed_key ] = sanitize_text_field( (string) $request_values[ $allowed_key ] );
		}
	}

	return $normalized;
}

/**
 * Return one normalized data-only AJAX error.
 *
 * @param WP_Error $error Safe domain or repository error.
 *
 * @return void
 */
function wpbc_timeline_time_rows_send_preferences_error( $error ) {
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
