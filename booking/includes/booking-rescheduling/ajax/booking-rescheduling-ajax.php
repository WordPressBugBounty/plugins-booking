<?php
/**
 * Authenticated Booking Rescheduling review and apply endpoints.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_ajax_' . WPBC_Booking_Rescheduling_Config::READ_AJAX_ACTION, 'wpbc_booking_rescheduling_ajax_read' );
add_action( 'wp_ajax_' . WPBC_Booking_Rescheduling_Config::REVIEW_AJAX_ACTION, 'wpbc_booking_rescheduling_ajax_review' );
add_action( 'wp_ajax_' . WPBC_Booking_Rescheduling_Config::APPLY_AJAX_ACTION, 'wpbc_booking_rescheduling_ajax_apply' );

/**
 * Return one authorized, non-mutating dialog initialization DTO.
 *
 * @return void
 */
function wpbc_booking_rescheduling_ajax_read() {
	if ( false === check_ajax_referer( WPBC_Booking_Rescheduling_Config::get_read_nonce_action(), 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_booking_rescheduling_read_nonce_invalid',
				'message' => __( 'The booking rescheduling request expired. Reload the booking and try again.', 'booking' ),
			),
			403
		);
	}

	$request = array(
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the domain validator.
		'booking_id'         => isset( $_POST['booking_id'] ) ? wp_unslash( $_POST['booking_id'] ) : 0,
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the Inspector validator.
		'source'             => isset( $_POST['source'] ) ? wp_unslash( $_POST['source'] ) : '',
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and treated only as an authorization-bound calendar target.
		'target_resource_id' => isset( $_POST['target_resource_id'] ) ? wp_unslash( $_POST['target_resource_id'] ) : 0,
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and cryptographically checked against freshly loaded canonical state.
		'source_context_token' => isset( $_POST['source_context_token'] ) ? wp_unslash( $_POST['source_context_token'] ) : '',
	);
	$result = ( new WPBC_Booking_Rescheduling_Read_Service() )->read( $request );
	if ( is_wp_error( $result ) ) {
		wpbc_booking_rescheduling_send_error( $result );
	}

	wp_send_json_success( $result );
}

/**
 * Return one signed, non-mutating rescheduling review.
 *
 * @return void
 */
function wpbc_booking_rescheduling_ajax_review() {
	if ( false === check_ajax_referer( WPBC_Booking_Rescheduling_Config::get_review_nonce_action(), 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_booking_rescheduling_review_nonce_invalid',
				'message' => __( 'The booking schedule review expired. Reload the booking and try again.', 'booking' ),
			),
			403
		);
	}

	$request = array(
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the domain validator.
		'booking_id' => isset( $_POST['booking_id'] ) ? wp_unslash( $_POST['booking_id'] ) : 0,
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the Inspector validator.
		'source'     => isset( $_POST['source'] ) ? wp_unslash( $_POST['source'] ) : '',
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and decoded through the bounded proposal contract.
		'proposal'   => isset( $_POST['proposal'] ) ? wp_unslash( $_POST['proposal'] ) : '',
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and decoded as an optional bounded signed Review plan.
		'base_plan'  => isset( $_POST['base_plan'] ) ? wp_unslash( $_POST['base_plan'] ) : '',
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and validated as the optional base-plan signature.
		'base_token' => isset( $_POST['base_token'] ) ? wp_unslash( $_POST['base_token'] ) : '',
	);
	$result = ( new WPBC_Booking_Rescheduling_Review_Service() )->review( $request );
	if ( is_wp_error( $result ) ) {
		wpbc_booking_rescheduling_send_error( $result );
	}

	wp_send_json_success( $result );
}

/**
 * Revalidate and apply one signed rescheduling plan.
 *
 * The browser cannot submit a replacement proposal at Apply. The exact
 * proposal is recovered only from the verified signed plan.
 *
 * @return void
 */
function wpbc_booking_rescheduling_ajax_apply() {
	if ( false === check_ajax_referer( WPBC_Booking_Rescheduling_Config::get_apply_nonce_action(), 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_booking_rescheduling_apply_nonce_invalid',
				'message' => __( 'The booking schedule review expired. Review the changes again.', 'booking' ),
			),
			403
		);
	}

	$request = array(
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the domain validator.
		'booking_id' => isset( $_POST['booking_id'] ) ? wp_unslash( $_POST['booking_id'] ) : 0,
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the Inspector validator.
		'source'     => isset( $_POST['source'] ) ? wp_unslash( $_POST['source'] ) : '',
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and decoded/verified by bounded plan services.
		'plan'       => isset( $_POST['plan'] ) ? wp_unslash( $_POST['plan'] ) : '',
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and validated as a signature.
		'token'      => isset( $_POST['token'] ) ? wp_unslash( $_POST['token'] ) : '',
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized to the exact optional 0/1 operation intent.
		'send_modified_email' => isset( $_POST['send_modified_email'] ) ? wp_unslash( $_POST['send_modified_email'] ) : 0,
	);
	$result = ( new WPBC_Booking_Rescheduling_Apply_Service() )->apply( $request );
	if ( is_wp_error( $result ) ) {
		wpbc_booking_rescheduling_send_error( $result );
	}

	wp_send_json_success( $result );
}

/**
 * Send one normalized error without exposing authority or storage values.
 *
 * @param WP_Error $error Safe domain error.
 *
 * @return void
 */
function wpbc_booking_rescheduling_send_error( $error ) {
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
