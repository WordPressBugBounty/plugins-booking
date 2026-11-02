<?php
/**
 * Authenticated Booking Date Editor read, review, and apply endpoints.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_ajax_' . WPBC_Booking_Date_Editor_Config::READ_AJAX_ACTION, 'wpbc_booking_date_editor_ajax_read' );
add_action( 'wp_ajax_' . WPBC_Booking_Date_Editor_Config::REVIEW_AJAX_ACTION, 'wpbc_booking_date_editor_ajax_review' );
add_action( 'wp_ajax_' . WPBC_Booking_Date_Editor_Config::APPLY_AJAX_ACTION, 'wpbc_booking_date_editor_ajax_apply' );

/**
 * Return one authorized Date Editor initialization contract.
 *
 * @return void
 */
function wpbc_booking_date_editor_ajax_read() {
	if ( false === check_ajax_referer( WPBC_Booking_Date_Editor_Config::get_read_nonce_action(), 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_booking_date_editor_nonce_invalid',
				'message' => __( 'The booking dates request expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}

	$request_payload = array(
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the Inspector validator.
		'booking_id' => isset( $_POST['booking_id'] ) ? wp_unslash( $_POST['booking_id'] ) : 0,
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the Inspector validator.
		'source'     => isset( $_POST['source'] ) ? wp_unslash( $_POST['source'] ) : '',
	);
	$read_result = ( new WPBC_Booking_Date_Editor_Read_Service() )->read( $request_payload );
	if ( is_wp_error( $read_result ) ) {
		wpbc_booking_date_editor_send_error( $read_result );
	}

	wp_send_json_success( $read_result );
}

/**
 * Return one signed, non-mutating Date Editor review.
 *
 * @return void
 */
function wpbc_booking_date_editor_ajax_review() {
	if ( false === check_ajax_referer( WPBC_Booking_Date_Editor_Config::get_review_nonce_action(), 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_booking_date_editor_review_nonce_invalid',
				'message' => __( 'The booking date review expired. Reload the page and try again.', 'booking' ),
			),
			403
		);
	}

	$request_payload = array(
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the domain validator.
		'booking_id'         => isset( $_POST['booking_id'] ) ? wp_unslash( $_POST['booking_id'] ) : 0,
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the domain validator.
		'source'             => isset( $_POST['source'] ) ? wp_unslash( $_POST['source'] ) : '',
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the domain validator.
		'source_fingerprint' => isset( $_POST['source_fingerprint'] ) ? wp_unslash( $_POST['source_fingerprint'] ) : '',
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and decoded/allow-listed by the domain validator.
		'proposal'           => isset( $_POST['proposal'] ) ? wp_unslash( $_POST['proposal'] ) : '',
	);
	$review_result = ( new WPBC_Booking_Date_Editor_Review_Service() )->review( $request_payload );
	if ( is_wp_error( $review_result ) ) {
		wpbc_booking_date_editor_send_error( $review_result );
	}

	wp_send_json_success( $review_result );
}

/**
 * Revalidate, persist, and return canonical Date Editor data.
 *
 * The endpoint deliberately reads no proposal from the browser. The exact
 * proposal is recovered only from the verified signed review plan.
 *
 * @return void
 */
function wpbc_booking_date_editor_ajax_apply() {
	if ( false === check_ajax_referer( WPBC_Booking_Date_Editor_Config::get_apply_nonce_action(), 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'wpbc_booking_date_editor_apply_nonce_invalid',
				'message' => __( 'The booking date review expired. Review the dates again.', 'booking' ),
			),
			403
		);
	}

	$request_payload = array(
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the domain validator.
		'booking_id' => isset( $_POST['booking_id'] ) ? wp_unslash( $_POST['booking_id'] ) : 0,
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized by the domain validator.
		'source'     => isset( $_POST['source'] ) ? wp_unslash( $_POST['source'] ) : '',
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and decoded/verified by the bounded domain services.
		'plan'       => isset( $_POST['plan'] ) ? wp_unslash( $_POST['plan'] ) : '',
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and validated as a hexadecimal signature.
		'token'      => isset( $_POST['token'] ) ? wp_unslash( $_POST['token'] ) : '',
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and normalized to the exact optional 0/1 operation intent.
		'send_modified_email' => isset( $_POST['send_modified_email'] ) ? wp_unslash( $_POST['send_modified_email'] ) : 0,
	);
	$apply_result = ( new WPBC_Booking_Date_Editor_Apply_Service() )->apply( $request_payload );
	if ( is_wp_error( $apply_result ) ) {
		wpbc_booking_date_editor_send_error( $apply_result );
	}

	wp_send_json_success( $apply_result );
}

/**
 * Send one normalized Date Editor error without exposing authorized data.
 *
 * @param WP_Error $error Safe domain error.
 *
 * @return void
 */
function wpbc_booking_date_editor_send_error( $error ) {
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
