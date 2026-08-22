<?php
/**
 * Independent create and edit inspector endpoints.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return whether one mutation is intentionally available in public demos.
 *
 * Public demos permit catalog creation, editing, and reviewed deletion so
 * visitors can evaluate those workflows. The deletion service independently
 * protects activation fixtures and every mutation retains its normal edition,
 * capability, ownership, validation, and stale-state checks.
 *
 * @param string $mutation_action Mutation identifier.
 *
 * @return bool True for an allow-listed demo mutation.
 */
function wpbc_catalog_booking_resource_inspector_is_demo_mutation_allowed( $mutation_action ) {
	return in_array(
		sanitize_key( (string) $mutation_action ),
		array( 'create', 'update', 'bulk_update', 'inline_update', 'delete' ),
		true
	);
}

/**
 * Authorize one inspector request at the transport boundary.
 *
 * @param string $mutation_action Mutation identifier, or an empty string for a read-only request.
 *
 * @return true|WP_Error True when authorized or a safe error.
 */
function wpbc_catalog_booking_resource_inspector_authorize( $mutation_action = '' ) {
	$mutation_action = sanitize_key( (string) $mutation_action );

	if ( ! check_ajax_referer( 'wpbc_catalog_booking_resources_nonce', 'nonce', false ) ) {
		return new WP_Error( 'wpbc_catalog_resource_inspector_nonce', __( 'The Booking Resource request could not be verified.', 'booking' ) );
	}
	if ( ! current_user_can( wpbc_catalog_booking_resources_get_manage_capability() ) ) {
		return new WP_Error( 'wpbc_catalog_resource_inspector_forbidden', __( 'You are not allowed to manage Booking Resources.', 'booking' ) );
	}
	if (
		'' !== $mutation_action
		&& wpbc_is_this_demo()
		&& ! wpbc_catalog_booking_resource_inspector_is_demo_mutation_allowed( $mutation_action )
	) {
		return new WP_Error( 'wpbc_catalog_resource_inspector_demo', __( 'Resource changes are disabled in the public demo.', 'booking' ) );
	}

	return true;
}

/**
 * Decode a submitted inspector field map.
 *
 * @return array<string,mixed>|WP_Error Decoded fields or a safe error.
 */
function wpbc_catalog_booking_resource_inspector_get_fields() {
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce and capability are verified by each endpoint before this helper is called.
	if ( ! isset( $_POST['fields'] ) || ! is_scalar( $_POST['fields'] ) ) {
		return new WP_Error( 'wpbc_catalog_resource_inspector_fields_missing', __( 'The Booking Resource request is invalid.', 'booking' ) );
	}
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Authorized by the caller.
	$decoded_fields = json_decode( wp_unslash( (string) $_POST['fields'] ), true );

	return is_array( $decoded_fields ) ? $decoded_fields : new WP_Error( 'wpbc_catalog_resource_inspector_fields_invalid', __( 'The Booking Resource request is invalid.', 'booking' ) );
}

/**
 * Send one safe inspector error response.
 *
 * @param WP_Error $error  Safe error.
 * @param int      $status HTTP status.
 *
 * @return void
 */
function wpbc_catalog_booking_resource_inspector_send_error( $error, $status = 400 ) {
	wp_send_json_error(
		array(
			'code'    => sanitize_key( $error->get_error_code() ),
			'message' => sanitize_text_field( $error->get_error_message() ),
		),
		absint( $status )
	);
}

/**
 * Return the current create-inspector schema.
 *
 * @return void
 */
function wpbc_catalog_booking_resource_ajax_create_schema() {
	$authorized = wpbc_catalog_booking_resource_inspector_authorize();
	if ( is_wp_error( $authorized ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $authorized, 403 );
	}

	$schema = ( new WPBC_Catalog_Booking_Resource_Inspector_Schema() )->get_create_schema();
	wp_send_json_success( array( 'schema' => $schema ) );
}
add_action( 'wp_ajax_WPBC_AJX_CATALOG_BOOKING_RESOURCE_CREATE_SCHEMA', 'wpbc_catalog_booking_resource_ajax_create_schema' );

/**
 * Return one authorized Resource edit schema.
 *
 * @return void
 */
function wpbc_catalog_booking_resource_ajax_edit_schema() {
	$authorized = wpbc_catalog_booking_resource_inspector_authorize();
	if ( is_wp_error( $authorized ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $authorized, 403 );
	}
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$resource_id = isset( $_POST['resource_id'] ) && is_scalar( $_POST['resource_id'] ) ? absint( $_POST['resource_id'] ) : 0;
	if ( ! $resource_id ) {
		wpbc_catalog_booking_resource_inspector_send_error( new WP_Error( 'wpbc_catalog_resource_inspector_id', __( 'The Booking Resource is invalid.', 'booking' ) ) );
	}

	$resource = ( new WPBC_Catalog_Booking_Resources_Repository() )->get_resource_details( $resource_id );
	if ( is_wp_error( $resource ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $resource, 500 );
	}
	if ( null === $resource ) {
		wpbc_catalog_booking_resource_inspector_send_error( new WP_Error( 'wpbc_catalog_resource_inspector_not_found', __( 'The Booking Resource was not found or is not available to this account.', 'booking' ) ), 404 );
	}

	$schema = ( new WPBC_Catalog_Booking_Resource_Inspector_Schema() )->get_edit_schema( $resource );
	if ( is_wp_error( $schema ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $schema );
	}
	wp_send_json_success( array( 'schema' => $schema ) );
}
add_action( 'wp_ajax_WPBC_AJX_CATALOG_BOOKING_RESOURCE_EDIT_SCHEMA', 'wpbc_catalog_booking_resource_ajax_edit_schema' );

/**
 * Create one validated Resource batch.
 *
 * @return void
 */
function wpbc_catalog_booking_resource_ajax_create() {
	$authorized = wpbc_catalog_booking_resource_inspector_authorize( 'create' );
	if ( is_wp_error( $authorized ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $authorized, 403 );
	}
	$fields = wpbc_catalog_booking_resource_inspector_get_fields();
	if ( is_wp_error( $fields ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $fields );
	}
	$created = ( new WPBC_Catalog_Booking_Resource_Creator() )->create( $fields );
	if ( is_wp_error( $created ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $created );
	}

	$resource_count = count( $created['resource_ids'] );
	wp_send_json_success(
		array(
			'resource_ids' => array_map( 'absint', $created['resource_ids'] ),
			'message'      => sprintf(
				/* translators: %d: Number of created Booking Resources. */
				_n( '%d Booking Resource created.', '%d Booking Resources created.', $resource_count, 'booking' ),
				$resource_count
			),
		)
	);
}
add_action( 'wp_ajax_WPBC_AJX_CATALOG_BOOKING_RESOURCE_CREATE', 'wpbc_catalog_booking_resource_ajax_create' );

/**
 * Update one authorized Resource.
 *
 * @return void
 */
function wpbc_catalog_booking_resource_ajax_update() {
	$authorized = wpbc_catalog_booking_resource_inspector_authorize( 'update' );
	if ( is_wp_error( $authorized ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $authorized, 403 );
	}
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above.
	$resource_id = isset( $_POST['resource_id'] ) && is_scalar( $_POST['resource_id'] ) ? absint( $_POST['resource_id'] ) : 0;
	$fields      = wpbc_catalog_booking_resource_inspector_get_fields();
	if ( ! $resource_id ) {
		wpbc_catalog_booking_resource_inspector_send_error( new WP_Error( 'wpbc_catalog_resource_update_id', __( 'The Booking Resource is invalid.', 'booking' ) ) );
	}
	if ( is_wp_error( $fields ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $fields );
	}

	$updated = ( new WPBC_Catalog_Booking_Resource_Updater() )->update( $resource_id, $fields );
	if ( is_wp_error( $updated ) ) {
		wpbc_catalog_booking_resource_inspector_send_error( $updated );
	}
	$refreshed_resource = ( new WPBC_Catalog_Booking_Resources_Repository() )->get_resource_details( $resource_id );
	$refreshed_schema   = array();
	if ( is_array( $refreshed_resource ) ) {
		$refreshed_schema = ( new WPBC_Catalog_Booking_Resource_Inspector_Schema() )->get_edit_schema( $refreshed_resource );
		if ( is_wp_error( $refreshed_schema ) ) {
			$refreshed_schema = array();
		}
	}
	wp_send_json_success(
		array(
			'resource_ids' => array( $resource_id ),
			'message'      => __( 'Booking Resource saved.', 'booking' ),
			'schema'       => $refreshed_schema,
		)
	);
}
add_action( 'wp_ajax_WPBC_AJX_CATALOG_BOOKING_RESOURCE_UPDATE', 'wpbc_catalog_booking_resource_ajax_update' );
