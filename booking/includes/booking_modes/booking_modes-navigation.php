<?php
/**
 * Booking Modes navigation integrations.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve mode-specific internal root navigation.
 *
 * The supplied page tree has already passed through the shared presentation
 * boundary. A configured group is shown only when the current edition exposed
 * at least one route for it. Classic returns the exact legacy root collection.
 *
 * @param array $legacy_root_navigation Existing root-menu definitions.
 * @param array $page_navigation        Resolved page, tab, and subtab tree.
 *
 * @return array Root navigation for the selected presentation mode.
 */
function wpbc_booking_modes_resolve_root_navigation( $legacy_root_navigation, $page_navigation ) {

	$mode_id = wpbc_booking_modes_get_selected_mode_id();
	$mode    = wpbc_booking_modes_get_mode( $mode_id );

	if ( 'classic' === $mode_id || ! is_array( $mode ) || empty( $mode['groups'] ) ) {
		return $legacy_root_navigation;
	}

	$resolved_root_navigation = array();

	foreach ( $mode['groups'] as $page_slug => $group_definition ) {
		$page_slug = sanitize_key( $page_slug );

		if ( empty( $page_navigation[ $page_slug ] ) || ! is_array( $group_definition ) ) {
			continue;
		}

		$legacy_group = isset( $legacy_root_navigation[ $page_slug ] ) && is_array( $legacy_root_navigation[ $page_slug ] )
			? $legacy_root_navigation[ $page_slug ]
			: array(
				'type'      => 'menu',
				'font_icon' => 'wpbc-bi-grid',
			);

		if ( ! empty( $group_definition['title'] ) && is_scalar( $group_definition['title'] ) ) {
			$legacy_group['title'] = wp_strip_all_tags( (string) $group_definition['title'] );
		}

		if ( ! empty( $group_definition['font_icon'] ) && is_scalar( $group_definition['font_icon'] ) ) {
			$legacy_group['font_icon'] = sanitize_html_class( (string) $group_definition['font_icon'] );
		}

		$legacy_group['_wpbc_mode_position'] = isset( $group_definition['position'] ) ? absint( $group_definition['position'] ) : 1000;
		$resolved_root_navigation[ $page_slug ] = $legacy_group;
	}

	foreach ( $legacy_root_navigation as $page_slug => $legacy_group ) {
		if (
			! is_array( $legacy_group )
			|| isset( $resolved_root_navigation[ $page_slug ] )
			|| empty( $page_navigation[ $page_slug ] )
			|| ! isset( $legacy_group['type'] )
			|| 'menu' !== $legacy_group['type']
		) {
			continue;
		}

		$legacy_group['_wpbc_mode_position'] = 10000 + count( $resolved_root_navigation );
		$resolved_root_navigation[ $page_slug ] = $legacy_group;
	}

	uasort(
		$resolved_root_navigation,
		static function ( $first_group, $second_group ) {
			if ( $first_group['_wpbc_mode_position'] === $second_group['_wpbc_mode_position'] ) {
				return 0;
			}

			return $first_group['_wpbc_mode_position'] < $second_group['_wpbc_mode_position'] ? -1 : 1;
		}
	);

	foreach ( $resolved_root_navigation as $page_slug => $root_definition ) {
		unset( $root_definition['_wpbc_mode_position'] );
		$resolved_root_navigation[ $page_slug ] = $root_definition;
	}

	/**
	 * Filter the internal root navigation resolved for a presentation mode.
	 *
	 * @param array  $resolved_root_navigation Mode-specific root definitions.
	 * @param string $mode_id                  Selected mode identifier.
	 * @param array  $page_navigation           Resolved internal page tree.
	 */
	$filtered_navigation = apply_filters( 'wpbc_booking_modes_resolved_root_navigation', $resolved_root_navigation, $mode_id, $page_navigation );

	return is_array( $filtered_navigation ) ? $filtered_navigation : $resolved_root_navigation;
}

/**
 * Filter Booking Calendar's native WordPress submenu for the selected mode.
 *
 * Existing registered slugs and capability values are preserved. Definitions
 * can rename, order, or hide known presentation links; unrecognized extension
 * and MultiUser links remain in their original order.
 *
 * @return void
 */
function wpbc_booking_modes_filter_wordpress_submenu() {

	global $submenu;

	$mode_id = wpbc_booking_modes_get_selected_mode_id();
	$mode    = wpbc_booking_modes_get_mode( $mode_id );

	if ( ! isset( $submenu['wpbc'] ) || ! is_array( $mode ) || empty( $mode['native_menu'] ) ) {
		return;
	}

	$resolved_submenu = array();
	$unknown_position = 10000;

	foreach ( $submenu['wpbc'] as $submenu_item ) {
		$menu_slug       = isset( $submenu_item[2] ) && is_scalar( $submenu_item[2] ) ? sanitize_key( (string) $submenu_item[2] ) : '';
		$menu_placement  = isset( $mode['native_menu'][ $menu_slug ] ) && is_array( $mode['native_menu'][ $menu_slug ] ) ? $mode['native_menu'][ $menu_slug ] : null;

		if ( null !== $menu_placement && isset( $menu_placement['visible'] ) && false === (bool) $menu_placement['visible'] ) {
			continue;
		}

		if ( null !== $menu_placement && ! empty( $menu_placement['title'] ) && is_scalar( $menu_placement['title'] ) ) {
			$submenu_item[0] = wp_strip_all_tags( (string) $menu_placement['title'] );
		}

		$position = null !== $menu_placement && isset( $menu_placement['position'] ) ? absint( $menu_placement['position'] ) : $unknown_position++;
		$resolved_submenu[] = array(
			'position' => $position,
			'item'     => $submenu_item,
		);
	}

	usort(
		$resolved_submenu,
		static function ( $first_item, $second_item ) {
			if ( $first_item['position'] === $second_item['position'] ) {
				return 0;
			}

			return $first_item['position'] < $second_item['position'] ? -1 : 1;
		}
	);

	$resolved_submenu = wp_list_pluck( $resolved_submenu, 'item' );

	/**
	 * Filter the native WordPress submenu resolved for a presentation mode.
	 *
	 * @param array  $resolved_submenu Native submenu item arrays.
	 * @param string $mode_id         Selected mode identifier.
	 * @param array  $mode            Selected normalized mode definition.
	 */
	$filtered_submenu = apply_filters( 'wpbc_booking_modes_resolved_wp_submenu', $resolved_submenu, $mode_id, $mode );
	$submenu['wpbc']  = is_array( $filtered_submenu ) ? $filtered_submenu : $resolved_submenu;
}
add_action( 'admin_menu', 'wpbc_booking_modes_filter_wordpress_submenu', 9999 );


/**
 * Register mode-hidden native submenu pages as hidden WordPress plugin pages.
 *
 * Removing an already registered submenu item changes the parent resolved by
 * WordPress for a direct request. WordPress then computes a different page hook
 * and rejects the request before the Booking Calendar controller can run.
 * Registering the page with a false parent preserves its controller, screen
 * hook, capability check, and direct URL without rendering a submenu entry.
 *
 * @param string|false $parent_menu_slug Default parent menu slug.
 * @param string       $menu_slug        Booking Calendar admin page slug.
 *
 * @return string|false Original parent, or false when the selected mode hides the page.
 */
function wpbc_booking_modes_filter_admin_menu_parent_slug( $parent_menu_slug, $menu_slug ) {

	$menu_slug = is_scalar( $menu_slug ) ? sanitize_key( (string) $menu_slug ) : '';
	$mode      = wpbc_booking_modes_get_mode( wpbc_booking_modes_get_selected_mode_id() );

	if (
		'' === $menu_slug
		|| ! is_array( $mode )
		|| empty( $mode['native_menu'] )
		|| ! isset( $mode['native_menu'][ $menu_slug ] )
		|| ! is_array( $mode['native_menu'][ $menu_slug ] )
	) {
		return $parent_menu_slug;
	}

	$menu_placement = $mode['native_menu'][ $menu_slug ];

	if ( isset( $menu_placement['visible'] ) && false === (bool) $menu_placement['visible'] ) {
		return false;
	}

	return $parent_menu_slug;
}
add_filter( 'wpbc_admin_menu_parent_slug', 'wpbc_booking_modes_filter_admin_menu_parent_slug', 10, 2 );


/**
 * Redirect the legacy Add Booking native submenu before administration output.
 *
 * Appointment mode opens Add Appointment. Classic and Rental retain the
 * established Add Booking destination. Handling every mode on admin_init keeps
 * the legacy render-time redirect from attempting to modify sent headers.
 *
 * @return void
 */
function wpbc_booking_modes_redirect_native_add_page() {

	$context = wpbc_booking_modes_get_context();

	if ( 'wpbc-new' !== $context['page'] ) {
		return;
	}

	$redirect_page_id = 'appointment' === wpbc_booking_modes_get_selected_mode_id() ? 'wpbc__add-appointment' : 'wpbc__add-booking';
	$redirect_url     = wpbc_booking_modes_get_canonical_page_url( $redirect_page_id );

	if ( '' !== $redirect_url ) {
		wp_safe_redirect( $redirect_url );
		exit;
	}
}
add_action( 'admin_init', 'wpbc_booking_modes_redirect_native_add_page', 20 );

/**
 * Hide the Booking Listing availability-button text in Classic and Rental modes.
 *
 * The Booking Listing controller exposes a presentation filter and remains
 * independent from Booking Modes. Classic and Rental modes keep the compact
 * icon-only button without introducing mode conditions inside that controller.
 *
 * @param bool $show_button_text Whether the standard toolbar button shows text.
 *
 * @return bool False in Classic or Rental mode; otherwise the existing filtered value.
 */
function wpbc_booking_modes_filter_set_unavailable_times_button_text( $show_button_text ) {

	if ( in_array( wpbc_booking_modes_get_selected_mode_id(), array( 'classic', 'rental' ), true ) ) {
		return false;
	}

	return (bool) $show_button_text;
}
add_filter( 'wpbc_booking_listing_show_set_unavailable_times_button_text', 'wpbc_booking_modes_filter_set_unavailable_times_button_text' );
