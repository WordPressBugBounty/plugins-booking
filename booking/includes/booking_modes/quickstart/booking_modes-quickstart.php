<?php
/**
 * Shared, explicit QuickStart operations for Booking Calendar modes.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Map a stored minimum WordPress role to its hierarchical capability.
 *
 * Booking Calendar stores role names for its administration boundaries. Using
 * the matching primitive capability keeps higher roles authorized as expected.
 *
 * @param string $role_name Stored WordPress role name.
 *
 * @return string WordPress capability name.
 */
function wpbc_booking_modes_get_role_capability( $role_name ) {

	$role_capabilities = array(
		'administrator' => 'activate_plugins',
		'editor'        => 'publish_pages',
		'author'        => 'publish_posts',
		'contributor'   => 'edit_posts',
		'subscriber'    => 'read',
	);
	$role_name        = sanitize_key( (string) $role_name );

	return isset( $role_capabilities[ $role_name ] ) ? $role_capabilities[ $role_name ] : 'manage_options';
}

/**
 * Get the capability required to run a mode QuickStart operation.
 *
 * Page publishing remains a separate mandatory check because every QuickStart
 * creates a public test page. This filter can tighten the Booking Calendar
 * settings boundary but cannot bypass that WordPress page capability.
 *
 * @return string WordPress capability name.
 */
function wpbc_booking_modes_get_quickstart_capability() {

	$capability = wpbc_booking_modes_get_role_capability( get_bk_option( 'booking_user_role_settings' ) );

	/**
	 * Filter the capability required to run Booking Mode QuickStart operations.
	 *
	 * @param string $capability WordPress capability name.
	 */
	$capability = apply_filters( 'wpbc_booking_modes_quickstart_capability', $capability );

	return is_scalar( $capability ) ? sanitize_key( (string) $capability ) : 'manage_options';
}

/**
 * Check whether the active Booking Calendar owner may run QuickStart.
 *
 * @return bool True when the user can manage Booking Calendar settings and
 *              publish the required public test page.
 */
function wpbc_booking_modes_current_user_can_quickstart() {

	return wpbc_booking_modes_current_user_can_switch()
		&& current_user_can( wpbc_booking_modes_get_quickstart_capability() )
		&& current_user_can( 'publish_pages' );
}

/**
 * Validate a state-changing QuickStart request.
 *
 * @param string $mode_id Requested administration mode identifier.
 * @param string $nonce   Request nonce.
 *
 * @return true|WP_Error True when valid, otherwise a request error.
 */
function wpbc_booking_modes_validate_quickstart_request( $mode_id, $nonce ) {

	if ( ! wp_verify_nonce( $nonce, 'wpbc_booking_modes_quickstart_nonce' ) ) {
		return new WP_Error( 'wpbc_booking_modes_quickstart_invalid_nonce', __( 'The QuickStart request expired. Reload the page and try again.', 'booking' ) );
	}

	if ( ! wpbc_booking_modes_current_user_can_quickstart() ) {
		return new WP_Error( 'wpbc_booking_modes_quickstart_forbidden', __( 'You are not allowed to create Booking Calendar QuickStart content.', 'booking' ) );
	}

	if ( function_exists( 'wpbc_is_this_demo' ) && wpbc_is_this_demo() ) {
		return new WP_Error( 'wpbc_booking_modes_quickstart_demo', __( 'QuickStart content creation is disabled on live demo websites.', 'booking' ) );
	}

	$mode_id = sanitize_key( (string) $mode_id );
	$mode    = wpbc_booking_modes_get_mode( $mode_id );

	if (
		! is_array( $mode )
		|| ! in_array( $mode_id, wpbc_booking_modes_get_allowed_mode_ids(), true )
		|| empty( $mode['quickstart_id'] )
		|| $mode_id !== sanitize_key( (string) $mode['quickstart_id'] )
	) {
		return new WP_Error( 'wpbc_booking_modes_quickstart_invalid_mode', __( 'QuickStart is not available for the selected administration mode.', 'booking' ) );
	}

	if ( $mode_id !== wpbc_booking_modes_get_selected_mode_id() ) {
		return new WP_Error( 'wpbc_booking_modes_quickstart_mode_changed', __( 'The active administration mode changed. Reload the page before running QuickStart.', 'booking' ) );
	}

	return true;
}

/**
 * Get the owner-scoped user option name for one QuickStart mode.
 *
 * @param string $mode_id Appointment or Rental mode identifier.
 *
 * @return string User option name, or an empty string for an unsupported mode.
 */
function wpbc_booking_modes_get_quickstart_option_name( $mode_id ) {

	$mode_id = sanitize_key( (string) $mode_id );

	return in_array( $mode_id, array( 'appointment', 'rental' ), true )
		? 'booking_admin_quickstart_' . $mode_id
		: '';
}

/**
 * Read normalized owner-scoped QuickStart progress.
 *
 * @param string $mode_id Appointment or Rental mode identifier.
 *
 * @return array<string,mixed> Stored progress, or an empty array.
 */
function wpbc_booking_modes_get_quickstart_state( $mode_id ) {

	$option_name   = wpbc_booking_modes_get_quickstart_option_name( $mode_id );
	$context       = wpbc_booking_modes_get_context();
	$owner_user_id = absint( $context['owner_user_id'] );

	if ( '' === $option_name || ! $owner_user_id ) {
		return array();
	}

	$state = get_user_option( $option_name, $owner_user_id );

	return is_array( $state ) ? $state : array();
}

/**
 * Persist owner-scoped QuickStart progress for repeat-safe retries.
 *
 * Progress is saved after each durable stage. A later retry therefore resumes
 * without reapplying a configuration profile that the owner may have adjusted.
 *
 * @param string              $mode_id Appointment or Rental mode identifier.
 * @param array<string,mixed> $state   Complete normalized progress state.
 *
 * @return bool|WP_Error True on success, otherwise a storage error.
 */
function wpbc_booking_modes_set_quickstart_state( $mode_id, $state ) {

	$option_name   = wpbc_booking_modes_get_quickstart_option_name( $mode_id );
	$context       = wpbc_booking_modes_get_context();
	$owner_user_id = absint( $context['owner_user_id'] );

	if ( '' === $option_name || ! $owner_user_id ) {
		return new WP_Error( 'wpbc_booking_modes_quickstart_owner_required', __( 'A Booking Calendar owner is required to save QuickStart progress.', 'booking' ) );
	}

	$state                 = is_array( $state ) ? $state : array();
	$state['schema_version'] = 1;
	$is_updated            = update_user_option( $owner_user_id, $option_name, $state );

	if ( false === $is_updated && $state !== get_user_option( $option_name, $owner_user_id ) ) {
		return new WP_Error( 'wpbc_booking_modes_quickstart_state_not_saved', __( 'QuickStart progress could not be saved.', 'booking' ) );
	}

	return true;
}

/**
 * Build the site-scoped option name used as an atomic QuickStart lock.
 *
 * @param string $mode_id       Appointment or Rental mode identifier.
 * @param int    $owner_user_id Active Booking Calendar owner user ID.
 *
 * @return string Sanitized WordPress option name.
 */
function wpbc_booking_modes_get_quickstart_lock_name( $mode_id, $owner_user_id ) {

	return '_wpbc_booking_modes_quickstart_lock_' . absint( $owner_user_id ) . '_' . sanitize_key( (string) $mode_id );
}

/**
 * Acquire an atomic owner-and-mode QuickStart lock.
 *
 * WordPress option names are unique, so `add_option()` prevents simultaneous
 * browser tabs from creating the same page or Service twice. A stale lock is
 * recoverable after two minutes if a request terminates unexpectedly.
 *
 * @param string $mode_id Appointment or Rental mode identifier.
 *
 * @return string|WP_Error Lock option name, or an already-running error.
 */
function wpbc_booking_modes_acquire_quickstart_lock( $mode_id ) {

	$context       = wpbc_booking_modes_get_context();
	$owner_user_id = absint( $context['owner_user_id'] );
	$lock_name     = wpbc_booking_modes_get_quickstart_lock_name( $mode_id, $owner_user_id );
	$lock_time     = time();

	if ( add_option( $lock_name, $lock_time, '', false ) ) {
		return $lock_name;
	}

	$existing_lock_time = absint( get_option( $lock_name, 0 ) );
	if ( ! $existing_lock_time || $existing_lock_time < ( $lock_time - 120 ) ) {
		delete_option( $lock_name );
		if ( add_option( $lock_name, $lock_time, '', false ) ) {
			return $lock_name;
		}
	}

	return new WP_Error( 'wpbc_booking_modes_quickstart_in_progress', __( 'QuickStart is already running for this mode. Wait a moment and try again.', 'booking' ) );
}

/**
 * Release an acquired QuickStart lock.
 *
 * @param string $lock_name Exact lock option name returned by the acquire helper.
 *
 * @return void
 */
function wpbc_booking_modes_release_quickstart_lock( $lock_name ) {

	$lock_name = is_scalar( $lock_name ) ? sanitize_key( (string) $lock_name ) : '';

	if ( 0 === strpos( $lock_name, '_wpbc_booking_modes_quickstart_lock_' ) ) {
		delete_option( $lock_name );
	}
}

/**
 * Resolve the first existing owner-visible Booking Resource.
 *
 * QuickStart deliberately reuses resources and never renames them. This keeps
 * existing bookings, availability, pricing, and MultiUser ownership intact.
 *
 * @return int|WP_Error Resource ID, or an error when no resource is available.
 */
function wpbc_booking_modes_quickstart_get_first_resource_id() {

	$resource_options = (array) apply_bk_filter( 'wpdebk_get_keyed_all_bk_resources', array() );

	if ( empty( $resource_options ) && function_exists( 'wpbc_appointment_services_get_provider_options' ) ) {
		$resource_options = wpbc_appointment_services_get_provider_options();
	}

	foreach ( (array) $resource_options as $resource_id => $resource ) {
		$resource_values = is_object( $resource ) ? get_object_vars( $resource ) : (array) $resource;
		$resolved_id     = ! empty( $resource_values['id'] ) ? absint( $resource_values['id'] ) : absint( $resource_id );

		if ( $resolved_id ) {
			return $resolved_id;
		}
	}

	$default_resource_id = function_exists( 'wpbc_get_default_resource' ) ? absint( wpbc_get_default_resource() ) : 0;

	if ( $default_resource_id ) {
		return $default_resource_id;
	}

	return new WP_Error( 'wpbc_booking_modes_quickstart_resource_missing', __( 'Create a Booking Resource before running QuickStart.', 'booking' ) );
}

/**
 * Find an existing page containing one stable QuickStart shortcode prefix.
 *
 * Marker lookup is owner-scoped. A published page created outside QuickStart is
 * also reused when its content already contains the prefix, preventing
 * duplicate public booking pages on upgraded sites. In MultiUser, this fallback
 * is restricted to pages authored by the active Booking Calendar owner.
 *
 * @param string $purpose   Stable page purpose marker.
 * @param string $shortcode_match Stable shortcode prefix expected in page content.
 *
 * @return WP_Post|null Existing page, or null when no reusable page exists.
 */
function wpbc_booking_modes_quickstart_find_page( $purpose, $shortcode_match ) {
	global $wpdb;

	$context       = wpbc_booking_modes_get_context();
	$owner_user_id = absint( $context['owner_user_id'] );
	$marked_pages  = get_posts(
		array(
			'post_type'      => 'page',
			'post_status'    => array( 'publish', 'draft', 'pending', 'private', 'future', 'trash' ),
			'posts_per_page' => 1,
			'orderby'        => 'ID',
			'order'          => 'ASC',
			'meta_query'     => array(
				'relation' => 'AND',
				array(
					'key'   => '_wpbc_booking_modes_quickstart_purpose',
					'value' => sanitize_key( (string) $purpose ),
				),
				array(
					'key'   => '_wpbc_booking_modes_quickstart_owner',
					'value' => $owner_user_id,
					'type'  => 'NUMERIC',
				),
			),
		)
	);

	if ( ! empty( $marked_pages[0] ) ) {
		return $marked_pages[0];
	}

	if ( ! empty( $context['is_multiuser'] ) ) {
		$published_page_query = $wpdb->prepare(
			"SELECT ID FROM {$wpdb->posts} WHERE post_type = %s AND post_status = %s AND post_author = %d AND post_content LIKE %s ORDER BY ID ASC LIMIT 1",
			'page',
			'publish',
			$owner_user_id,
			'%' . $wpdb->esc_like( $shortcode_match ) . '%'
		);
	} else {
		$published_page_query = $wpdb->prepare(
			"SELECT ID FROM {$wpdb->posts} WHERE post_type = %s AND post_status = %s AND post_content LIKE %s ORDER BY ID ASC LIMIT 1",
			'page',
			'publish',
			'%' . $wpdb->esc_like( $shortcode_match ) . '%'
		);
	}

	$published_page_id = $wpdb->get_var( $published_page_query ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared in the ownership-specific branches above.

	if ( $published_page_id ) {
		$published_page = get_post( absint( $published_page_id ) );
		if ( $published_page instanceof WP_Post ) {
			return $published_page;
		}
	}

	return null;
}

/**
 * Reuse or create one owner-marked QuickStart page.
 *
 * A previously marked non-published page is never duplicated or silently
 * republished. The owner receives an actionable error and can restore it.
 *
 * @param string $purpose   Stable page purpose marker.
 * @param string $page_slug Preferred page slug.
 * @param string $page_title Translatable page title.
 * @param string $shortcode       Exact Booking Calendar shortcode used for a new page.
 * @param string $shortcode_match Optional stable shortcode prefix used to find a reusable page.
 *
 * @return array<string,mixed>|WP_Error Page ID and public test URL, or an error.
 */
function wpbc_booking_modes_quickstart_ensure_page( $purpose, $page_slug, $page_title, $shortcode, $shortcode_match = '' ) {

	if ( function_exists( 'wpbc_is_this_demo' ) && wpbc_is_this_demo() ) {
		return new WP_Error( 'wpbc_booking_modes_quickstart_demo_page', __( 'QuickStart cannot create or modify pages on a live demo website.', 'booking' ) );
	}

	$shortcode_match = '' !== (string) $shortcode_match ? (string) $shortcode_match : (string) $shortcode;
	$existing_page   = wpbc_booking_modes_quickstart_find_page( $purpose, $shortcode_match );

	if ( $existing_page instanceof WP_Post ) {
		if ( 'publish' !== $existing_page->post_status ) {
			return new WP_Error( 'wpbc_booking_modes_quickstart_page_not_published', __( 'A previous QuickStart page exists but is not published. Restore or publish that page before trying again.', 'booking' ) );
		}
		if ( false === strpos( (string) $existing_page->post_content, $shortcode_match ) ) {
			return new WP_Error( 'wpbc_booking_modes_quickstart_page_changed', __( 'A previous QuickStart page no longer contains its Booking Calendar shortcode. Restore the shortcode before trying again.', 'booking' ) );
		}

		$test_url = get_permalink( $existing_page->ID );
		if ( ! $test_url ) {
			return new WP_Error( 'wpbc_booking_modes_quickstart_page_url_missing', __( 'The QuickStart booking page does not have a public URL.', 'booking' ) );
		}

		return array(
			'page_id'  => absint( $existing_page->ID ),
			'test_url' => $test_url,
			'created'  => false,
		);
	}

	if ( ! function_exists( 'wpbc_create_page' ) ) {
		return new WP_Error( 'wpbc_booking_modes_quickstart_page_api_missing', __( 'The Booking Calendar page creation API is not available.', 'booking' ) );
	}

	$context = wpbc_booking_modes_get_context();
	$page_id = wpbc_create_page(
		array(
			'post_name'    => sanitize_title( $page_slug ),
			'post_title'   => $page_title,
			'post_content' => $shortcode,
			'post_author'  => absint( $context['owner_user_id'] ),
		)
	);

	if ( ! $page_id ) {
		return new WP_Error( 'wpbc_booking_modes_quickstart_page_not_created', __( 'The QuickStart booking page could not be created.', 'booking' ) );
	}

	update_post_meta( $page_id, '_wpbc_booking_modes_quickstart_purpose', sanitize_key( (string) $purpose ) );
	update_post_meta( $page_id, '_wpbc_booking_modes_quickstart_owner', absint( $context['owner_user_id'] ) );

	$test_url = get_permalink( $page_id );
	if ( ! $test_url ) {
		return new WP_Error( 'wpbc_booking_modes_quickstart_page_url_missing', __( 'The QuickStart booking page does not have a public URL.', 'booking' ) );
	}

	return array(
		'page_id'  => absint( $page_id ),
		'test_url' => $test_url,
		'created'  => true,
	);
}

/**
 * Run the explicit QuickStart operation registered by one mode definition.
 *
 * Mode switching never calls this dispatcher. Only the protected QuickStart
 * AJAX endpoint invokes it after nonce, capability, owner, and demo checks.
 *
 * @param string $mode_id Appointment or Rental mode identifier.
 *
 * @return array<string,mixed>|WP_Error Operation result, or an error.
 */
function wpbc_booking_modes_run_quickstart( $mode_id ) {

	$mode_id = sanitize_key( (string) $mode_id );

	if ( 'appointment' === $mode_id && function_exists( 'wpbc_booking_modes_run_appointment_quickstart' ) ) {
		return wpbc_booking_modes_run_appointment_quickstart();
	}

	if ( 'rental' === $mode_id && function_exists( 'wpbc_booking_modes_run_rental_quickstart' ) ) {
		return wpbc_booking_modes_run_rental_quickstart();
	}

	return new WP_Error( 'wpbc_booking_modes_quickstart_not_registered', __( 'No QuickStart operation is registered for this mode.', 'booking' ) );
}

/**
 * Resolve the public test URL stored for a completed QuickStart operation.
 *
 * @param string $mode_id Appointment or Rental mode identifier.
 *
 * @return string Published same-site page URL, or an empty string.
 */
function wpbc_booking_modes_get_quickstart_test_url( $mode_id ) {

	$state   = wpbc_booking_modes_get_quickstart_state( $mode_id );
	$page_id = ! empty( $state['page_id'] ) ? absint( $state['page_id'] ) : 0;

	if ( ! $page_id || 'publish' !== get_post_status( $page_id ) ) {
		return '';
	}

	$test_url = get_permalink( $page_id );

	return $test_url ? wp_validate_redirect( $test_url, '' ) : '';
}
