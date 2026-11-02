<?php
/**
 * Authenticated Booking Inspector endpoint.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_ajax_' . WPBC_Booking_Inspector_Config::AJAX_ACTION, 'wpbc_booking_inspector_ajax_read' );
add_action( 'wp_ajax_' . WPBC_Booking_Inspector_Config::UPDATE_AJAX_ACTION, 'wpbc_booking_inspector_ajax_update' );
add_action( 'wp_ajax_' . WPBC_Booking_Inspector_Config::ACTIVITY_AJAX_ACTION, 'wpbc_booking_inspector_ajax_read_activity' );
add_action( 'wp_ajax_' . WPBC_Booking_Inspector_Config::LEGACY_AJAX_ACTION, 'wpbc_booking_inspector_ajax_read_legacy' );

/**
 * Return authorized booking details through the canonical domain action.
 *
 * @return void
 */
function wpbc_booking_inspector_ajax_read() {
	wpbc_booking_inspector_send_read_response( WPBC_Booking_Inspector_Config::get_nonce_action(), '' );
}

/**
 * Preserve the initial Timeline action for cached administration pages.
 *
 * @return void
 */
function wpbc_booking_inspector_ajax_read_legacy() {
	wpbc_booking_inspector_send_read_response( 'wpbc_timeline_booking_details', WPBC_Booking_Inspector_Config::SOURCE_TIMELINE );
}

/**
 * Validate, authorize, persist, and return the authoritative updated DTO.
 *
 * @return void
 */
function wpbc_booking_inspector_ajax_update() {
	if ( false === check_ajax_referer( WPBC_Booking_Inspector_Config::get_update_nonce_action(), 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_booking_inspector_nonce_invalid',
				'message' => __( 'The booking changes request expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}

	$request_payload = array(
		'booking_id'  => isset( $_POST['booking_id'] ) ? wp_unslash( $_POST['booking_id'] ) : 0, // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the domain validator.
		'source'      => isset( $_POST['source'] ) ? wp_unslash( $_POST['source'] ) : '', // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the domain validator.
		'fingerprint' => isset( $_POST['fingerprint'] ) ? wp_unslash( $_POST['fingerprint'] ) : '', // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the domain validator.
		'draft'       => isset( $_POST['draft'] ) ? wp_unslash( $_POST['draft'] ) : '', // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and decoded by the bounded domain validator.
		'send_modified_email' => isset( $_POST['send_modified_email'] ) ? wp_unslash( $_POST['send_modified_email'] ) : 0, // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized to the exact optional 0/1 operation intent.
	);
	$mutation_result = ( new WPBC_Booking_Inspector_Mutation_Service() )->update( $request_payload );
	if ( is_wp_error( $mutation_result ) ) {
		wpbc_booking_inspector_send_error( $mutation_result );
	}

	$read_result = ( new WPBC_Booking_Inspector_Read_Service() )->read(
		array(
			'booking_id' => $request_payload['booking_id'],
			'source'     => $request_payload['source'],
		)
	);
	if ( is_wp_error( $read_result ) ) {
		wpbc_booking_inspector_send_error( $read_result );
	}
	$read_result['changed'] = ! empty( $mutation_result['changed'] );
	$read_result['notifications_sent'] = ! empty( $mutation_result['notifications_sent'] );

	wp_send_json_success( $read_result );
}

/**
 * Return one authorized data-only activity page.
 *
 * @return void
 */
function wpbc_booking_inspector_ajax_read_activity() {
	if ( false === check_ajax_referer( WPBC_Booking_Inspector_Config::get_nonce_action(), 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_booking_inspector_nonce_invalid',
				'message' => __( 'The booking activity request expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}
	$request = ( new WPBC_Booking_Activity_Request_Validator( WPBC_Booking_Inspector_Config::get_allowed_sources() ) )->validate(
		array(
			'booking_id' => isset( $_POST['booking_id'] ) ? wp_unslash( $_POST['booking_id'] ) : 0, // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
			'source'     => isset( $_POST['source'] ) ? wp_unslash( $_POST['source'] ) : '', // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
			'page'       => isset( $_POST['page'] ) ? wp_unslash( $_POST['page'] ) : 1, // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
			'per_page'   => isset( $_POST['per_page'] ) ? wp_unslash( $_POST['per_page'] ) : 20, // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
		)
	);
	if ( is_wp_error( $request ) ) {
		wpbc_booking_inspector_send_error( $request );
	}
	$authorized = ( new WPBC_Booking_Inspector_Authorization() )->authorize_booking( $request['booking_id'], $request['source'] );
	if ( is_wp_error( $authorized ) ) {
		wpbc_booking_inspector_send_error( $authorized );
	}
	$activity = ( new WPBC_Booking_Activity_Read_Service() )->read( $request['booking_id'], $request['page'], $request['per_page'] );
	if ( is_wp_error( $activity ) ) {
		wpbc_booking_inspector_send_error( $activity );
	}

	wp_send_json_success( array( 'activity' => $activity ) );
}

/**
 * Verify the request and return the normalized data-only response.
 *
 * @param string $nonce_action      Expected nonce action.
 * @param string $source_identifier Optional server-owned compatibility host.
 *
 * @return void
 */
function wpbc_booking_inspector_send_read_response( $nonce_action, $source_identifier = '' ) {
	if ( false === check_ajax_referer( $nonce_action, 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_booking_inspector_nonce_invalid',
				'message' => __( 'The booking details request expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}

	$request_payload = array(
		'booking_id' => isset( $_POST['booking_id'] ) ? wp_unslash( $_POST['booking_id'] ) : 0, // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the domain validator.
		'source'     => '' !== $source_identifier
			? $source_identifier
			: ( isset( $_POST['source'] ) ? wp_unslash( $_POST['source'] ) : '' ), // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the domain validator.
	);
	$result          = ( new WPBC_Booking_Inspector_Read_Service() )->read( $request_payload );
	if ( is_wp_error( $result ) ) {
		wpbc_booking_inspector_send_error( $result );
	}

	wp_send_json_success( $result );
}

/**
 * Send one normalized Inspector error without exposing storage details.
 *
 * @param WP_Error $error Safe domain error.
 *
 * @return void
 */
function wpbc_booking_inspector_send_error( $error ) {
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
