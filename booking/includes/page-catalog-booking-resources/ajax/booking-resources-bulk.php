<?php
/**
 * Independent AJAX transport for reviewed Resource bulk operations.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Decode one JSON request property after inspector authorization.
 *
 * @param string $property_name POST property name.
 * @param string $error_message Safe translated message.
 * @return array<mixed>|WP_Error Decoded array or safe error.
 */
function wpbc_catalog_booking_resources_bulk_decode_json( $property_name, $error_message ) {
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Each endpoint verifies the catalog nonce before calling this helper.
	if ( ! isset( $_POST[ $property_name ] ) || ! is_scalar( $_POST[ $property_name ] ) ) {
		return new WP_Error( 'wpbc_catalog_bulk_json_missing', $error_message );
	}
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Authorized by the caller.
	$decoded = json_decode( wp_unslash( (string) $_POST[ $property_name ] ), true );

	return JSON_ERROR_NONE === json_last_error() && is_array( $decoded ) ? $decoded : new WP_Error( 'wpbc_catalog_bulk_json_invalid', $error_message );
}

/**
 * Return the common bulk-edit schema for an explicit selection.
 *
 * @return void
 */
function wpbc_catalog_booking_resources_ajax_bulk_schema() {
	$authorized = wpbc_catalog_booking_resource_inspector_authorize();
	if ( is_wp_error( $authorized ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $authorized, 403 );
	}
	$ids = wpbc_catalog_booking_resources_bulk_decode_json( 'resource_ids', __( 'The selected Booking Resources are invalid.', 'booking' ) );
	if ( is_wp_error( $ids ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $ids );
	}
	$schema = ( new WPBC_Catalog_Booking_Resources_Bulk_Editor() )->get_schema( $ids );
	if ( is_wp_error( $schema ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $schema, 'wpbc_catalog_bulk_edition' === $schema->get_error_code() ? 403 : 400 );
	}
	wp_send_json_success( array( 'schema' => $schema ) );
}
add_action( 'wp_ajax_WPBC_AJX_CATALOG_BOOKING_RESOURCES_BULK_SCHEMA', 'wpbc_catalog_booking_resources_ajax_bulk_schema' );

/**
 * Return a signed old-to-new bulk-edit preview.
 *
 * @return void
 */
function wpbc_catalog_booking_resources_ajax_bulk_preview() {
	$authorized = wpbc_catalog_booking_resource_inspector_authorize();
	if ( is_wp_error( $authorized ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $authorized, 403 );
	}
	$ids        = wpbc_catalog_booking_resources_bulk_decode_json( 'resource_ids', __( 'The selected Booking Resources are invalid.', 'booking' ) );
	$operations = wpbc_catalog_booking_resources_bulk_decode_json( 'operations', __( 'The bulk operations are invalid.', 'booking' ) );
	if ( is_wp_error( $ids ) || is_wp_error( $operations ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( is_wp_error( $ids ) ? $ids : $operations );
	}
	$preview = ( new WPBC_Catalog_Booking_Resources_Bulk_Editor() )->preview( $ids, $operations );
	if ( is_wp_error( $preview ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $preview, 'wpbc_catalog_bulk_edition' === $preview->get_error_code() ? 403 : 400 );
	}
	wp_send_json_success( array( 'preview' => $preview ) );
}
add_action( 'wp_ajax_WPBC_AJX_CATALOG_BOOKING_RESOURCES_BULK_PREVIEW', 'wpbc_catalog_booking_resources_ajax_bulk_preview' );

/**
 * Apply a reviewed bulk update after mutation authorization and revalidation.
 *
 * @return void
 */
function wpbc_catalog_booking_resources_ajax_bulk_apply() {
	$authorized = wpbc_catalog_booking_resource_inspector_authorize( 'bulk_update' );
	if ( is_wp_error( $authorized ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $authorized, 403 );
	}
	$ids        = wpbc_catalog_booking_resources_bulk_decode_json( 'resource_ids', __( 'The selected Booking Resources are invalid.', 'booking' ) );
	$operations = wpbc_catalog_booking_resources_bulk_decode_json( 'operations', __( 'The bulk operations are invalid.', 'booking' ) );
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$review_token = isset( $_POST['review_token'] ) && is_scalar( $_POST['review_token'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['review_token'] ) ) : '';
	if ( is_wp_error( $ids ) || is_wp_error( $operations ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( is_wp_error( $ids ) ? $ids : $operations );
	}
	$result = ( new WPBC_Catalog_Booking_Resources_Bulk_Editor() )->apply( $ids, $operations, $review_token );
	if ( is_wp_error( $result ) ) {
		$status = 'wpbc_catalog_bulk_review_stale' === $result->get_error_code() ? 409 : 400;
		if ( 'wpbc_catalog_bulk_edition' === $result->get_error_code() ) {
			$status = 403;
		}
		wpbc_catalog_booking_resource_inspector_send_error( $result, $status );
	}
	wp_send_json_success(
		array(
			'updated_ids' => array_map( 'absint', $result['updated_ids'] ),
			'message'     => sprintf( _n( '%s Booking Resource updated.', '%s Booking Resources updated.', $result['updated_count'], 'booking' ), number_format_i18n( $result['updated_count'] ) ),
		)
	);
}
add_action( 'wp_ajax_WPBC_AJX_CATALOG_BOOKING_RESOURCES_BULK_APPLY', 'wpbc_catalog_booking_resources_ajax_bulk_apply' );

/**
 * Return a signed permanent-deletion review.
 *
 * @return void
 */
function wpbc_catalog_booking_resources_ajax_delete_preview() {
	$authorized = wpbc_catalog_booking_resource_inspector_authorize();
	if ( is_wp_error( $authorized ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $authorized, 403 );
	}
	$ids = wpbc_catalog_booking_resources_bulk_decode_json( 'resource_ids', __( 'The selected Booking Resources are invalid.', 'booking' ) );
	if ( is_wp_error( $ids ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $ids );
	}
	$preview = ( new WPBC_Catalog_Booking_Resources_Deleter() )->preview( $ids );
	if ( is_wp_error( $preview ) ) {
		$status = in_array( $preview->get_error_code(), array( 'wpbc_catalog_delete_demo', 'wpbc_catalog_delete_demo_seed', 'wpbc_catalog_delete_edition' ), true ) ? 403 : 400;
		wpbc_catalog_booking_resource_inspector_send_error( $preview, $status );
	}
	wp_send_json_success( array( 'preview' => $preview ) );
}
add_action( 'wp_ajax_WPBC_AJX_CATALOG_BOOKING_RESOURCES_DELETE_PREVIEW', 'wpbc_catalog_booking_resources_ajax_delete_preview' );

/**
 * Permanently delete a reviewed Resource selection.
 *
 * @return void
 */
function wpbc_catalog_booking_resources_ajax_delete_apply() {
	$authorized = wpbc_catalog_booking_resource_inspector_authorize( 'delete' );
	if ( is_wp_error( $authorized ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $authorized, 403 );
	}
	$ids = wpbc_catalog_booking_resources_bulk_decode_json( 'resource_ids', __( 'The selected Booking Resources are invalid.', 'booking' ) );
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$review_token = isset( $_POST['review_token'] ) && is_scalar( $_POST['review_token'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['review_token'] ) ) : '';
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above; this is an explicit destructive-action confirmation.
	$acknowledged = isset( $_POST['acknowledged'] ) && is_scalar( $_POST['acknowledged'] ) && '1' === (string) wp_unslash( $_POST['acknowledged'] );
	if ( is_wp_error( $ids ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $ids );
	}
	if ( ! $acknowledged ) {
		wpbc_catalog_booking_resource_inspector_send_error( new WP_Error( 'wpbc_catalog_delete_acknowledgement_required', __( 'Confirm that the selected Booking Resources will be permanently deleted.', 'booking' ) ) );
	}
	$result = ( new WPBC_Catalog_Booking_Resources_Deleter() )->delete( $ids, $review_token );
	if ( is_wp_error( $result ) ) {
		$status = 'wpbc_catalog_delete_review_stale' === $result->get_error_code() ? 409 : 400;
		if ( in_array( $result->get_error_code(), array( 'wpbc_catalog_delete_demo', 'wpbc_catalog_delete_demo_seed', 'wpbc_catalog_delete_edition' ), true ) ) {
			$status = 403;
		}
		wpbc_catalog_booking_resource_inspector_send_error( $result, $status );
	}
	wp_send_json_success(
		array(
			'deleted_ids' => array_map( 'absint', $result['deleted_ids'] ),
			'message'     => sprintf( _n( '%s Booking Resource deleted.', '%s Booking Resources deleted.', $result['deleted_count'], 'booking' ), number_format_i18n( $result['deleted_count'] ) ),
		)
	);
}
add_action( 'wp_ajax_WPBC_AJX_CATALOG_BOOKING_RESOURCES_DELETE_APPLY', 'wpbc_catalog_booking_resources_ajax_delete_apply' );
