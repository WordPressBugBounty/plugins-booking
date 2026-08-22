<?php
/**
 * Public Booking Modes foundation API.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Get all registered Booking Calendar administration modes.
 *
 * @return array Normalized mode definitions keyed by mode identifier.
 */
function wpbc_booking_modes_get_registered_modes() {

	return WPBC_Booking_Mode_Registry::get_instance()->get_all();
}

/**
 * Get one registered Booking Calendar administration mode.
 *
 * @param string $mode_id Mode identifier.
 *
 * @return array|null Mode definition, or null when unknown.
 */
function wpbc_booking_modes_get_mode( $mode_id ) {

	return WPBC_Booking_Mode_Registry::get_instance()->get( $mode_id );
}

/**
 * Get mode identifiers allowed for the current owner context.
 *
 * @return array Allowed mode identifiers.
 */
function wpbc_booking_modes_get_allowed_mode_ids() {

	return WPBC_Booking_Mode_Registry::get_instance()->get_allowed_mode_ids();
}

/**
 * Get all canonical administration page references.
 *
 * @return array Canonical page definitions keyed by stable identifier.
 */
function wpbc_booking_modes_get_canonical_pages() {

	return WPBC_Booking_Mode_Page_Registry::get_instance()->get_all();
}

/**
 * Get one canonical administration page reference.
 *
 * @param string $page_id Canonical page identifier.
 *
 * @return array|null Page definition, or null when unknown.
 */
function wpbc_booking_modes_get_canonical_page( $page_id ) {

	return WPBC_Booking_Mode_Page_Registry::get_instance()->get( $page_id );
}

/**
 * Get an existing canonical administration page URL.
 *
 * @param string $page_id Canonical page identifier.
 *
 * @return string Administration URL, or an empty string when unknown.
 */
function wpbc_booking_modes_get_canonical_page_url( $page_id ) {

	return WPBC_Booking_Mode_Page_Registry::get_instance()->get_url( $page_id );
}

/**
 * Get cached request and owner context.
 *
 * @return array Normalized context values.
 */
function wpbc_booking_modes_get_context() {

	return WPBC_Booking_Mode_Context::get_instance()->get_context();
}

/**
 * Get the owner-scoped selected administration mode.
 *
 * Missing or invalid configuration resolves to Classic without writing data.
 *
 * @param int $owner_user_id Optional owner user ID. Zero uses current context.
 *
 * @return string Allowed mode identifier.
 */
function wpbc_booking_modes_get_selected_mode_id( $owner_user_id = 0 ) {

	return WPBC_Booking_Mode_Storage::get_instance()->get_selected_mode_id( $owner_user_id );
}

/**
 * Save an explicit owner-scoped administration mode selection.
 *
 * External handlers must verify nonce and capability before calling this API.
 *
 * @param string $mode_id       Requested registered mode identifier.
 * @param int    $owner_user_id Optional owner user ID. Zero uses context.
 *
 * @return bool|WP_Error True on success, otherwise an error.
 */
function wpbc_booking_modes_set_selected_mode_id( $mode_id, $owner_user_id = 0 ) {

	return WPBC_Booking_Mode_Storage::get_instance()->set_selected_mode_id( $mode_id, $owner_user_id );
}

/**
 * Check whether the shared navigation consumer boundary is activated.
 *
 * The released boundary loads unconditionally. Defining the dedicated constant
 * as strict false provides an emergency presentation-only
 * rollback without disabling the mode registry and stored preference.
 *
 * @return bool True when the internal navigation getter should use the resolver.
 */
function wpbc_booking_modes_is_navigation_boundary_enabled() {

	return ! defined( 'WPBC_ENABLE_BOOKING_MODES_NAVIGATION' ) || false !== WPBC_ENABLE_BOOKING_MODES_NAVIGATION;
}

/**
 * Resolve the legacy administration navigation for mode presentation.
 *
 * The result is built once per request. Existing page controllers continue to
 * use their original routes, capabilities, rendering, and save behavior.
 *
 * @param array $legacy_navigation Complete legacy page, tab, and subtab tree.
 *
 * @return array Cached presentation navigation tree.
 */
function wpbc_booking_modes_resolve_navigation( $legacy_navigation ) {

	return WPBC_Booking_Mode_Navigation::get_instance()->resolve( $legacy_navigation );
}

/**
 * Get canonical page identifiers present in the resolved legacy tree.
 *
 * @return array Available canonical page identifiers, or an empty array before resolution.
 */
function wpbc_booking_modes_get_available_page_ids() {

	return WPBC_Booking_Mode_Navigation::get_instance()->get_available_page_ids();
}

/**
 * Resolve a request route to its stable canonical page identifier.
 *
 * @param string $page_tag   Existing WordPress admin page slug.
 * @param string $tab_tag    Existing Booking Calendar tab slug.
 * @param string $subtab_tag Existing Booking Calendar subtab slug.
 *
 * @return string Canonical page identifier, or an empty string when unknown.
 */
function wpbc_booking_modes_get_canonical_page_id_for_route( $page_tag, $tab_tag = '', $subtab_tag = '' ) {

	$page_tag   = sanitize_key( (string) $page_tag );
	$tab_tag    = sanitize_key( (string) $tab_tag );
	$subtab_tag = sanitize_key( (string) $subtab_tag );

	foreach ( wpbc_booking_modes_get_canonical_pages() as $page_id => $canonical_page ) {
		if ( $page_tag === $canonical_page['page'] && $tab_tag === $canonical_page['tab'] && $subtab_tag === $canonical_page['subtab'] ) {
			return $page_id;
		}
	}

	return '';
}

/**
 * Resolve the stable identifier for the current Booking Calendar admin route.
 *
 * @return string Canonical page identifier, or an empty string when unknown.
 */
function wpbc_booking_modes_get_current_canonical_page_id() {

	$context = wpbc_booking_modes_get_context();

	return wpbc_booking_modes_get_canonical_page_id_for_route( $context['page'], $context['tab'], $context['subtab'] );
}

/**
 * Resolve a canonical page identifier from a validated same-site URL.
 *
 * This is used by the AJAX switch handler so redirect selection is based on
 * the server-observed referer rather than a browser-submitted route value.
 *
 * @param string $admin_url Candidate Booking Calendar administration URL.
 *
 * @return string Canonical page identifier, or an empty string when invalid.
 */
function wpbc_booking_modes_get_canonical_page_id_from_url( $admin_url ) {

	$admin_url = is_scalar( $admin_url ) ? wp_validate_redirect( (string) $admin_url, '' ) : '';

	if ( '' === $admin_url ) {
		return '';
	}

	$query_string = wp_parse_url( $admin_url, PHP_URL_QUERY );
	$query_args   = array();

	if ( ! is_string( $query_string ) ) {
		return '';
	}

	wp_parse_str( $query_string, $query_args );

	$page_tag   = isset( $query_args['page'] ) && is_scalar( $query_args['page'] ) ? $query_args['page'] : '';
	$tab_tag    = isset( $query_args['tab'] ) && is_scalar( $query_args['tab'] ) ? $query_args['tab'] : '';
	$subtab_tag = isset( $query_args['subtab'] ) && is_scalar( $query_args['subtab'] ) ? $query_args['subtab'] : '';

	return wpbc_booking_modes_get_canonical_page_id_for_route( $page_tag, $tab_tag, $subtab_tag );
}

/**
 * Get the capability required to switch administration presentation modes.
 *
 * The default mirrors the configured capability for the main Booking Calendar
 * menu so every user who can reach that screen can retain a personal mode.
 *
 * @return string WordPress capability name.
 */
function wpbc_booking_modes_get_switch_capability() {

	$role_capabilities = array(
		'administrator' => 'activate_plugins',
		'editor'        => 'publish_pages',
		'author'        => 'publish_posts',
		'contributor'   => 'edit_posts',
		'subscriber'    => 'read',
	);
	$configured_role_option = get_bk_option( 'booking_user_role_booking' );
	$configured_role        = is_scalar( $configured_role_option ) ? sanitize_key( (string) $configured_role_option ) : 'subscriber';
	$capability             = isset( $role_capabilities[ $configured_role ] ) ? $role_capabilities[ $configured_role ] : 'read';

	/**
	 * Filter the capability required to switch Booking Calendar modes.
	 *
	 * @param string $capability WordPress capability name.
	 */
	$capability = apply_filters( 'wpbc_booking_modes_switch_capability', $capability );

	return is_scalar( $capability ) ? sanitize_key( (string) $capability ) : 'read';
}

/**
 * Check whether the current active Booking Calendar user may switch modes.
 *
 * @return bool True for an active signed-in owner with menu access.
 */
function wpbc_booking_modes_current_user_can_switch() {

	$context = wpbc_booking_modes_get_context();

	return $context['owner_user_id'] > 0
		&& current_user_can( wpbc_booking_modes_get_switch_capability() )
		&& (bool) apply_bk_filter( 'multiuser_is_current_user_active', true );
}

/**
 * Validate a mode-switch request without writing the owner preference.
 *
 * @param string $mode_id Requested mode identifier.
 * @param string $nonce   Request nonce.
 *
 * @return true|WP_Error True when valid, otherwise a request error.
 */
function wpbc_booking_modes_validate_switch_request( $mode_id, $nonce ) {

	if ( ! wp_verify_nonce( $nonce, 'wpbc_booking_modes_switch_nonce' ) ) {
		return new WP_Error( 'wpbc_booking_modes_invalid_nonce', __( 'The mode change request expired. Reload the page and try again.', 'booking' ) );
	}

	if ( ! wpbc_booking_modes_current_user_can_switch() ) {
		return new WP_Error( 'wpbc_booking_modes_forbidden', __( 'You are not allowed to change the Booking Calendar administration mode.', 'booking' ) );
	}

	$mode_id = sanitize_key( (string) $mode_id );

	if ( ! in_array( $mode_id, wpbc_booking_modes_get_allowed_mode_ids(), true ) ) {
		return new WP_Error( 'wpbc_booking_modes_invalid_mode', __( 'The selected Booking Calendar administration mode is not available.', 'booking' ) );
	}

	return true;
}

/**
 * Build the safe server-selected redirect after a mode switch.
 *
 * The current route is retained only when the target mode presents it. A route
 * hidden by that mode falls back to its registered default, then to Bookings.
 *
 * @param string $mode_id         Target mode identifier.
 * @param string $current_page_id Current canonical page identifier.
 *
 * @return string Valid same-site administration URL.
 */
function wpbc_booking_modes_get_switch_redirect_url( $mode_id, $current_page_id = '' ) {

	$mode            = wpbc_booking_modes_get_mode( $mode_id );
	$current_page_id = sanitize_key( (string) $current_page_id );
	$redirect_page_id = '';

	if ( is_array( $mode ) && '' !== $current_page_id ) {
		$current_placement = isset( $mode['pages'][ $current_page_id ] ) && is_array( $mode['pages'][ $current_page_id ] )
			? $mode['pages'][ $current_page_id ]
			: null;

		if (
			( null === $current_placement && ! empty( $mode['preserve_unmapped_pages'] ) )
			|| ( null !== $current_placement && ( ! isset( $current_placement['visible'] ) || false !== (bool) $current_placement['visible'] ) )
		) {
			$redirect_page_id = $current_page_id;
		}
	}

	if ( '' === $redirect_page_id && is_array( $mode ) ) {
		$redirect_page_id = $mode['default_page'];
	}

	$redirect_url = wpbc_booking_modes_get_canonical_page_url( $redirect_page_id );

	if ( '' === $redirect_url ) {
		$redirect_url = admin_url( 'admin.php?page=wpbc' );
	}

	/**
	 * Filter the server-selected URL used after a successful mode switch.
	 *
	 * @param string $redirect_url   Proposed administration URL.
	 * @param string $mode_id        Target mode identifier.
	 * @param string $current_page_id Current canonical page identifier.
	 */
	$redirect_url = apply_filters( 'wpbc_booking_modes_switch_redirect_url', $redirect_url, $mode_id, $current_page_id );

	return wp_validate_redirect( $redirect_url, admin_url( 'admin.php?page=wpbc' ) );
}
