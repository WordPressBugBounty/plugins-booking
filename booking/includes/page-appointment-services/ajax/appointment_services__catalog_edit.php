<?php
/**
 * AJAX endpoints for reviewed Appointment Service catalog edits.
 *
 * The endpoints expose only the Service-domain preview and apply contracts.
 * Selection and inspector presentation remain in the shared catalog client.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Decode one JSON request field into an associative array.
 *
 * @param string $field_name POST field name.
 *
 * @return array<string,mixed>|WP_Error Decoded values or a malformed-request error.
 */
function wpbc_appointment_services_catalog_decode_json_field( $field_name ) {
	// phpcs:ignore WordPress.Security.NonceVerification.Missing
	$raw_value = isset( $_POST[ $field_name ] ) && is_scalar( $_POST[ $field_name ] ) ? wp_unslash( $_POST[ $field_name ] ) : '';
	$decoded   = json_decode( (string) $raw_value, true );

	if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $decoded ) ) {
		return new WP_Error( 'wpbc_service_malformed_request', __( 'The Service editing request is malformed.', 'booking' ) );
	}

	return $decoded;
}

/**
 * Send one Service catalog editing error with a safe HTTP status.
 *
 * @param WP_Error $error Domain validation, conflict, or storage error.
 * @return void Terminates with a normalized JSON error.
 */
function wpbc_appointment_services_send_catalog_edit_error( $error ) {
	$error_code = $error->get_error_code();
	$status     = 400;

	if ( in_array( $error_code, array( 'wpbc_service_stale_review', 'wpbc_service_stale_delete_review', 'wpbc_service_stale_delete_apply' ), true ) ) {
		$status = 409;
	} elseif ( in_array( $error_code, array( 'service_not_found', 'invalid_service' ), true ) ) {
		$status = 404;
	} elseif ( in_array( $error_code, array( 'appointment_services_storage_unavailable', 'wpbc_service_delete_unsupported_storage' ), true ) ) {
		$status = 503;
	} elseif ( in_array( $error_code, array( 'wpbc_service_apply_failed', 'wpbc_service_delete_failed', 'wpbc_service_delete_compensation_failed' ), true ) ) {
		$status = 500;
	}

	wp_send_json_error(
		array(
			'code'    => sanitize_key( $error_code ),
			'message' => $error->get_error_message(),
		),
		$status
	);
}

/**
 * Return current row-specific inline field schemas for visible Services.
 *
 * @return void Terminates with a JSON response.
 */
function wpbc_appointment_services_ajax_catalog_inline_schema() {
	wpbc_appointment_services_ajax_authorize();
	$service_ids = wpbc_appointment_services_catalog_decode_json_field( 'ids' );
	if ( is_wp_error( $service_ids ) ) {
		wpbc_appointment_services_send_catalog_edit_error( $service_ids );
	}
	$result      = ( new WPBC_Appointment_Services_Catalog_Editor() )->get_inline_schema( $service_ids );
	if ( is_wp_error( $result ) ) {
		wpbc_appointment_services_send_catalog_edit_error( $result );
	}
	wp_send_json_success( array( 'schema' => $result ) );
}
add_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICES_INLINE_SCHEMA', 'wpbc_appointment_services_ajax_catalog_inline_schema' );

/**
 * Return the safe bulk-field intersection for selected Services.
 *
 * @return void Terminates with a JSON response.
 */
function wpbc_appointment_services_ajax_catalog_bulk_contract() {
	wpbc_appointment_services_ajax_authorize();
	$service_ids = wpbc_appointment_services_catalog_decode_json_field( 'ids' );
	if ( is_wp_error( $service_ids ) ) {
		wpbc_appointment_services_send_catalog_edit_error( $service_ids );
	}
	$result      = ( new WPBC_Appointment_Services_Catalog_Editor() )->get_bulk_contract( $service_ids );
	if ( is_wp_error( $result ) ) {
		wpbc_appointment_services_send_catalog_edit_error( $result );
	}
	wp_send_json_success( array( 'contract' => $result ) );
}
add_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICES_BULK_CONTRACT', 'wpbc_appointment_services_ajax_catalog_bulk_contract' );

/**
 * Return a signed, non-mutating Service edit review.
 *
 * @return void Terminates with a JSON response.
 */
function wpbc_appointment_services_ajax_catalog_preview() {
	wpbc_appointment_services_ajax_authorize();
	$editor  = new WPBC_Appointment_Services_Catalog_Editor();
	// phpcs:ignore WordPress.Security.NonceVerification.Missing
	$mode    = isset( $_POST['mode'] ) ? sanitize_key( wp_unslash( $_POST['mode'] ) ) : '';
	$ids     = wpbc_appointment_services_catalog_decode_json_field( 'ids' );
	$changes = wpbc_appointment_services_catalog_decode_json_field( 'changes' );
	if ( is_wp_error( $ids ) || is_wp_error( $changes ) ) {
		wpbc_appointment_services_send_catalog_edit_error( is_wp_error( $ids ) ? $ids : $changes );
	}
	$result  = $editor->preview( $mode, $ids, $changes );
	if ( is_wp_error( $result ) ) { wpbc_appointment_services_send_catalog_edit_error( $result ); }
	wp_send_json_success( $result );
}
add_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICES_CATALOG_PREVIEW', 'wpbc_appointment_services_ajax_catalog_preview' );

/**
 * Apply one signed Service edit plan after revalidation.
 *
 * @return void Terminates with a JSON response.
 */
function wpbc_appointment_services_ajax_catalog_apply() {
	wpbc_appointment_services_ajax_authorize();
	$editor = new WPBC_Appointment_Services_Catalog_Editor();
	$plan   = wpbc_appointment_services_catalog_decode_json_field( 'plan' );
	if ( is_wp_error( $plan ) ) {
		wpbc_appointment_services_send_catalog_edit_error( $plan );
	}
	// phpcs:ignore WordPress.Security.NonceVerification.Missing
	$token  = isset( $_POST['token'] ) && is_scalar( $_POST['token'] ) ? sanitize_text_field( wp_unslash( $_POST['token'] ) ) : '';
	$result = $editor->apply( $plan, $token );
	if ( is_wp_error( $result ) ) { wpbc_appointment_services_send_catalog_edit_error( $result ); }
	$result['message'] = __( 'Service changes applied.', 'booking' );
	wp_send_json_success( $result );
}
add_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICES_CATALOG_APPLY', 'wpbc_appointment_services_ajax_catalog_apply' );
