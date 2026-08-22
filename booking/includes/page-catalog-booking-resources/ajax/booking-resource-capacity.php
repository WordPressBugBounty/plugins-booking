<?php
/**
 * Independent AJAX transport for reviewed Resource capacity operations.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Decode explicitly selected child IDs after catalog authorization.
 *
 * @return array<int,mixed>|WP_Error Decoded IDs or safe request error.
 */
function wpbc_catalog_booking_resource_capacity_get_detach_ids() {
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- The calling endpoint verifies the catalog nonce.
	if ( ! isset( $_POST['detach_resource_ids'] ) || ! is_scalar( $_POST['detach_resource_ids'] ) ) {
		return array();
	}
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Authorized by the caller and domain-validated by the service.
	$decoded_ids = json_decode( wp_unslash( (string) $_POST['detach_resource_ids'] ), true );
	if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $decoded_ids ) ) {
		return new WP_Error( 'wpbc_catalog_capacity_json_invalid', __( 'The selected resource units are invalid.', 'booking' ) );
	}

	return $decoded_ids;
}

/**
 * Return the requested capacity-decrease outcome.
 *
 * @return string Sanitized action; the domain service performs allow-list validation.
 */
function wpbc_catalog_booking_resource_capacity_get_decrease_action() {
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- The calling endpoint verifies the catalog nonce.
	return isset( $_POST['decrease_action'] ) && is_scalar( $_POST['decrease_action'] )
		? sanitize_key( wp_unslash( (string) $_POST['decrease_action'] ) )
		: 'detach';
}

/**
 * Return current capacity context for an authorized Resource row.
 *
 * @return void Terminates with normalized JSON.
 */
function wpbc_catalog_booking_resource_ajax_capacity_context() {
	$authorized = wpbc_catalog_booking_resource_inspector_authorize();
	if ( is_wp_error( $authorized ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $authorized, 403 );
	}
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$resource_id = isset( $_POST['resource_id'] ) ? absint( wp_unslash( $_POST['resource_id'] ) ) : 0;
	$context     = ( new WPBC_Catalog_Booking_Resource_Capacity_Service() )->get_context( $resource_id );
	if ( is_wp_error( $context ) ) {
		$status = in_array( $context->get_error_code(), array( 'wpbc_catalog_capacity_edition', 'wpbc_catalog_capacity_demo' ), true ) ? 403 : 400;
		wpbc_catalog_booking_resource_inspector_send_error( $context, $status );
	}

	wp_send_json_success( array( 'context' => $context ) );
}
add_action( 'wp_ajax_WPBC_AJX_CATALOG_BOOKING_RESOURCE_CAPACITY_CONTEXT', 'wpbc_catalog_booking_resource_ajax_capacity_context' );

/**
 * Return a signed, non-mutating structural capacity review.
 *
 * @return void Terminates with normalized JSON.
 */
function wpbc_catalog_booking_resource_ajax_capacity_preview() {
	$authorized = wpbc_catalog_booking_resource_inspector_authorize();
	if ( is_wp_error( $authorized ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $authorized, 403 );
	}
	$detach_resource_ids = wpbc_catalog_booking_resource_capacity_get_detach_ids();
	if ( is_wp_error( $detach_resource_ids ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $detach_resource_ids );
	}
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$resource_id = isset( $_POST['resource_id'] ) ? absint( wp_unslash( $_POST['resource_id'] ) ) : 0;
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Strictly validated by the capacity service.
	$target_capacity = isset( $_POST['target_capacity'] ) && is_scalar( $_POST['target_capacity'] ) ? wp_unslash( (string) $_POST['target_capacity'] ) : '';
	$decrease_action = wpbc_catalog_booking_resource_capacity_get_decrease_action();
	$preview         = ( new WPBC_Catalog_Booking_Resource_Capacity_Service() )->preview( $resource_id, $target_capacity, $detach_resource_ids, $decrease_action );
	if ( is_wp_error( $preview ) ) {
		$status = 'wpbc_catalog_capacity_edition' === $preview->get_error_code() ? 403 : 400;
		wpbc_catalog_booking_resource_inspector_send_error( $preview, $status );
	}

	wp_send_json_success( array( 'preview' => $preview ) );
}
add_action( 'wp_ajax_WPBC_AJX_CATALOG_BOOKING_RESOURCE_CAPACITY_PREVIEW', 'wpbc_catalog_booking_resource_ajax_capacity_preview' );

/**
 * Apply one signed capacity change after apply-time revalidation.
 *
 * @return void Terminates with normalized JSON.
 */
function wpbc_catalog_booking_resource_ajax_capacity_apply() {
	$authorized = wpbc_catalog_booking_resource_inspector_authorize( 'capacity' );
	if ( is_wp_error( $authorized ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $authorized, 403 );
	}
	$detach_resource_ids = wpbc_catalog_booking_resource_capacity_get_detach_ids();
	if ( is_wp_error( $detach_resource_ids ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $detach_resource_ids );
	}
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$resource_id = isset( $_POST['resource_id'] ) ? absint( wp_unslash( $_POST['resource_id'] ) ) : 0;
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Strictly validated by the capacity service.
	$target_capacity = isset( $_POST['target_capacity'] ) && is_scalar( $_POST['target_capacity'] ) ? wp_unslash( (string) $_POST['target_capacity'] ) : '';
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and compared with a request-bound signature.
	$review_token = isset( $_POST['review_token'] ) && is_scalar( $_POST['review_token'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['review_token'] ) ) : '';
	$decrease_action = wpbc_catalog_booking_resource_capacity_get_decrease_action();
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above and required again by the domain service for deletion.
	$acknowledged = isset( $_POST['acknowledged'] ) && '1' === (string) wp_unslash( $_POST['acknowledged'] );
	$result       = ( new WPBC_Catalog_Booking_Resource_Capacity_Service() )->apply( $resource_id, $target_capacity, $detach_resource_ids, $review_token, $decrease_action, $acknowledged );
	if ( is_wp_error( $result ) ) {
		$status = in_array( $result->get_error_code(), array( 'wpbc_catalog_capacity_review_stale', 'wpbc_catalog_delete_review_stale', 'wpbc_catalog_capacity_delete_structure_changed' ), true ) ? 409 : 400;
		if ( in_array( $result->get_error_code(), array( 'wpbc_catalog_capacity_edition', 'wpbc_catalog_capacity_demo' ), true ) ) {
			$status = 403;
		}
		wpbc_catalog_booking_resource_inspector_send_error( $result, $status );
	}

	wp_send_json_success(
		array(
			'message'      => sprintf(
				/* translators: %s: New Booking Resource capacity. */
				__( 'Resource capacity changed to %s.', 'booking' ),
				number_format_i18n( absint( $result['new_capacity'] ) )
			),
			'resource_id'  => absint( $result['resource_id'] ),
			'new_capacity' => absint( $result['new_capacity'] ),
			'created_ids'  => $result['created_ids'],
			'detached_ids' => $result['detached_ids'],
			'deleted_ids'  => $result['deleted_ids'],
			'affected_ids' => $result['affected_ids'],
		)
	);
}
add_action( 'wp_ajax_WPBC_AJX_CATALOG_BOOKING_RESOURCE_CAPACITY_APPLY', 'wpbc_catalog_booking_resource_ajax_capacity_apply' );
