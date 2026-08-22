<?php
/**
 * Independent AJAX transport for reviewed inline Resource operations.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Decode one bounded JSON payload for the inline endpoint family.
 *
 * @param string $request_key POST key containing JSON.
 * @param string $error_message Safe translated validation message.
 * @return array<int|string,mixed>|WP_Error Decoded array or validation error.
 */
function wpbc_catalog_booking_resources_inline_decode_json( $request_key, $error_message ) {
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- The endpoint verifies the shared nonce before calling this helper.
	$raw_value = isset( $_POST[ $request_key ] ) && is_scalar( $_POST[ $request_key ] ) ? wp_unslash( (string) $_POST[ $request_key ] ) : '';
	if ( '' === $raw_value || strlen( $raw_value ) > 250000 ) {
		return new WP_Error( 'wpbc_catalog_inline_json_invalid', $error_message );
	}
	$decoded_value = json_decode( $raw_value, true );

	return is_array( $decoded_value ) ? $decoded_value : new WP_Error( 'wpbc_catalog_inline_json_invalid', $error_message );
}

/**
 * Return current row-specific inline field schemas.
 *
 * @return void Terminates with a JSON response.
 */
function wpbc_catalog_booking_resources_ajax_inline_schema() {
	$authorized = wpbc_catalog_booking_resource_inspector_authorize();
	if ( is_wp_error( $authorized ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $authorized, 403 );
	}
	$resource_ids = wpbc_catalog_booking_resources_inline_decode_json( 'resource_ids', __( 'The inline Booking Resource selection is invalid.', 'booking' ) );
	if ( is_wp_error( $resource_ids ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $resource_ids );
	}
	$schema = ( new WPBC_Catalog_Booking_Resources_Inline_Editor() )->get_schema( $resource_ids );
	if ( is_wp_error( $schema ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $schema );
	}

	wp_send_json_success( array( 'schema' => $schema ) );
}
add_action( 'wp_ajax_WPBC_AJX_CATALOG_BOOKING_RESOURCES_INLINE_SCHEMA', 'wpbc_catalog_booking_resources_ajax_inline_schema' );

/**
 * Return a signed preview without mutating any Resource.
 *
 * @return void Terminates with a JSON response.
 */
function wpbc_catalog_booking_resources_ajax_inline_preview() {
	$authorized = wpbc_catalog_booking_resource_inspector_authorize();
	if ( is_wp_error( $authorized ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $authorized, 403 );
	}
	$rows = wpbc_catalog_booking_resources_inline_decode_json( 'rows', __( 'The inline Booking Resource changes are invalid.', 'booking' ) );
	if ( is_wp_error( $rows ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $rows );
	}
	$preview = ( new WPBC_Catalog_Booking_Resources_Inline_Editor() )->preview( $rows );
	if ( is_wp_error( $preview ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $preview );
	}

	wp_send_json_success( array( 'preview' => $preview ) );
}
add_action( 'wp_ajax_WPBC_AJX_CATALOG_BOOKING_RESOURCES_INLINE_PREVIEW', 'wpbc_catalog_booking_resources_ajax_inline_preview' );

/**
 * Apply a signed inline review after current-value revalidation.
 *
 * @return void Terminates with a JSON response.
 */
function wpbc_catalog_booking_resources_ajax_inline_apply() {
	$authorized = wpbc_catalog_booking_resource_inspector_authorize( 'inline_update' );
	if ( is_wp_error( $authorized ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $authorized, 403 );
	}
	$rows = wpbc_catalog_booking_resources_inline_decode_json( 'rows', __( 'The inline Booking Resource changes are invalid.', 'booking' ) );
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$review_token = isset( $_POST['review_token'] ) && is_scalar( $_POST['review_token'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['review_token'] ) ) : '';
	if ( is_wp_error( $rows ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $rows );
	}
	$result = ( new WPBC_Catalog_Booking_Resources_Inline_Editor() )->apply( $rows, $review_token );
	if ( is_wp_error( $result ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $result, 'wpbc_catalog_inline_review_stale' === $result->get_error_code() ? 409 : 400 );
	}

	wp_send_json_success(
		array(
			'updated_ids' => array_map( 'absint', $result['updated_ids'] ),
			'message'     => sprintf(
				/* translators: %s: Number of updated Booking Resources. */
				_n( '%s Booking Resource updated.', '%s Booking Resources updated.', $result['updated_count'], 'booking' ),
				number_format_i18n( $result['updated_count'] )
			),
		)
	);
}
add_action( 'wp_ajax_WPBC_AJX_CATALOG_BOOKING_RESOURCES_INLINE_APPLY', 'wpbc_catalog_booking_resources_ajax_inline_apply' );
