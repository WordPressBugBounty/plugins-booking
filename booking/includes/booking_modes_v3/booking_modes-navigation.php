<?php
/**
 * Focused Booking Modes V3 integration adapters.
 *
 * @package Booking Calendar
 * @since   11.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return the selected validated V3 definition with a safe Classic fallback.
 *
 * @return array<string,mixed> Selected definition.
 */
function wpbc_booking_modes_v3_get_selected_definition() {
	$registry   = WPBC_Booking_Modes_V3_Compatibility_Registry::get_instance();
	$definition = $registry->get_compiler_definition( wpbc_booking_modes_get_selected_mode_id() );

	return is_array( $definition ) ? $definition : $registry->get_compiler_definition( 'classic' );
}

/**
 * Capture original contributor metadata at the shared getter boundary.
 *
 * @param array $source_navigation Complete original navigation tree.
 *
 * @return array Unmodified source tree for callers that do not render a V3 surface.
 */
function wpbc_booking_modes_v3_capture_navigation_source( $source_navigation ) {
	WPBC_Booking_Modes_V3_Source_Index::get_instance()->capture( $source_navigation );

	return $source_navigation;
}

/**
 * Compile only the sidebar tree requested by the vertical renderer.
 *
 * @param array $source_navigation Complete original navigation tree.
 *
 * @return array Legacy-compatible V3 sidebar tree.
 */
function wpbc_booking_modes_v3_compile_sidebar_navigation( $source_navigation ) {
	WPBC_Booking_Modes_V3_Source_Index::get_instance()->capture( $source_navigation );
	$definition = wpbc_booking_modes_v3_get_selected_definition();

	return WPBC_Booking_Modes_V3_Compiler::get_instance()->compile_sidebar(
		$source_navigation,
		$definition,
		WPBC_Booking_Modes_V3_Compiler::get_current_edition_id()
	);
}

/**
 * Compile root section metadata for the current V3 sidebar.
 *
 * @param array $legacy_roots Legacy root metadata.
 * @param array $sidebar      Already compiled sidebar tree.
 *
 * @return array V3 root metadata.
 */
function wpbc_booking_modes_v3_compile_root_navigation( $legacy_roots, $sidebar ) {
	return WPBC_Booking_Modes_V3_Compiler::get_instance()->compile_roots(
		$legacy_roots,
		$sidebar,
		wpbc_booking_modes_v3_get_selected_definition()
	);
}

/**
 * Compile only the horizontal host currently being rendered.
 *
 * @param array  $source_navigation Source navigation tree.
 * @param string $active_page       Current page slug.
 * @param string $active_tab        Current tab slug.
 * @param string $active_subtab     Current subtab slug.
 *
 * @return array Navigation tree with the current horizontal host prepared.
 */
function wpbc_booking_modes_v3_compile_horizontal_navigation( $source_navigation, $active_page, $active_tab, $active_subtab ) {
	WPBC_Booking_Modes_V3_Source_Index::get_instance()->capture( $source_navigation );

	return WPBC_Booking_Modes_V3_Compiler::get_instance()->compile_horizontal(
		$source_navigation,
		wpbc_booking_modes_v3_get_selected_definition(),
		WPBC_Booking_Modes_V3_Compiler::get_current_edition_id(),
		$active_page,
		$active_tab,
		$active_subtab
	);
}

/**
 * Apply V3 page-heading and top-navigation options to the active controller.
 *
 * @param array  $current_page_params Original controller presentation data.
 * @param string $page_slug           Current registered page slug.
 * @param string $tab_slug            Current registered tab slug.
 * @param string $subtab_slug         Current registered subtab slug.
 *
 * @return array Updated presentation data with callbacks and save lifecycle intact.
 */
function wpbc_booking_modes_v3_apply_current_page_options( $current_page_params, $page_slug, $tab_slug, $subtab_slug ) {
	return WPBC_Booking_Modes_V3_Compiler::get_instance()->apply_page_options(
		$current_page_params,
		wpbc_booking_modes_v3_get_selected_definition(),
		$page_slug,
		$tab_slug,
		$subtab_slug
	);
}

/**
 * Return canonical IDs whose routes exist in captured source metadata.
 *
 * @return array<int,string> Available canonical IDs.
 */
function wpbc_booking_modes_v3_get_available_canonical_page_ids() {
	$available = array();
	foreach ( wpbc_booking_modes_get_canonical_pages() as $page_id => $page ) {
		if ( null !== WPBC_Booking_Modes_V3_Source_Index::get_instance()->get_record( $page ) ) {
			$available[] = $page_id;
		}
	}

	return $available;
}

/**
 * Apply the selected mode to the already registered native WPBC submenu.
 *
 * @return void
 */
function wpbc_booking_modes_v3_filter_wordpress_submenu() {
	global $submenu;

	if ( ! isset( $submenu['wpbc'] ) || ! is_array( $submenu['wpbc'] ) ) {
		return;
	}

	$definition = wpbc_booking_modes_v3_get_selected_definition();
	$compiled   = WPBC_Booking_Modes_V3_Compiler::get_instance()->compile_native(
		$submenu['wpbc'],
		$definition,
		WPBC_Booking_Modes_V3_Compiler::get_current_edition_id()
	);

	/**
	 * Filter the resolved native submenu using the released hook signature.
	 *
	 * @param array  $compiled Native submenu rows.
	 * @param string $mode_id  Selected mode ID.
	 * @param array  $mode     Released-shape mode summary.
	 */
	$filtered = apply_filters( 'wpbc_booking_modes_resolved_wp_submenu', $compiled, $definition['id'], wpbc_booking_modes_get_mode( $definition['id'] ) );
	$authorized_submenu = WPBC_Booking_Modes_V3_Compiler::get_instance()->enforce_native_source_constraints(
		is_array( $filtered ) ? $filtered : $compiled,
		$compiled
	);
	$authorized_submenu = wpbc_booking_modes_v3_add_native_booking_forms_action( $authorized_submenu, $definition );
	$submenu['wpbc']     = wpbc_booking_modes_v3_add_native_upgrade_action( $authorized_submenu );
}
add_action( 'admin_menu', 'wpbc_booking_modes_v3_filter_wordpress_submenu', 9999 );

/**
 * Add the canonical Booking Forms route to an authorized native submenu.
 *
 * Booking Forms remains a Settings tab and does not register a duplicate page
 * controller. The alias copies the capability from the source-authorized
 * Settings row, so WordPress and the existing Settings controller retain the
 * complete access policy. The row is inserted immediately before Settings to
 * match the shared Booking Calendar navigation order.
 *
 * @since 12.0.0
 *
 * @param array $native_submenu Authorized native Booking Calendar submenu rows.
 * @param array $definition     Selected validated Booking Modes definition.
 *
 * @return array Native submenu rows with the Booking Forms alias when available.
 */
function wpbc_booking_modes_v3_add_native_booking_forms_action( $native_submenu, $definition ) {
	if ( ! is_array( $native_submenu ) || empty( $native_submenu ) || ! is_array( $definition ) ) {
		return is_array( $native_submenu ) ? $native_submenu : array();
	}

	$booking_form_route = isset( $definition['pages']['booking_form']['route'] ) && is_array( $definition['pages']['booking_form']['route'] )
		? $definition['pages']['booking_form']['route']
		: array();
	if (
		'wpbc-settings' !== ( isset( $booking_form_route['page'] ) ? $booking_form_route['page'] : '' )
		|| 'builder_booking_form' !== ( isset( $booking_form_route['tab'] ) ? $booking_form_route['tab'] : '' )
	) {
		return $native_submenu;
	}

	$booking_forms_url = wpbc_booking_modes_get_canonical_page_url( 'wpbc-settings__builder_booking_form' );
	if ( '' === $booking_forms_url ) {
		return $native_submenu;
	}

	$settings_row_index = null;
	$settings_capability = '';
	foreach ( $native_submenu as $row_index => $native_submenu_row ) {
		if ( ! is_array( $native_submenu_row ) || ! isset( $native_submenu_row[2] ) || ! is_scalar( $native_submenu_row[2] ) ) {
			continue;
		}

		if ( $booking_forms_url === (string) $native_submenu_row[2] ) {
			return $native_submenu;
		}

		if ( 'wpbc-settings' === sanitize_key( (string) $native_submenu_row[2] ) ) {
			$settings_row_index  = $row_index;
			$settings_capability = isset( $native_submenu_row[1] ) && is_string( $native_submenu_row[1] )
				? $native_submenu_row[1]
				: '';
			break;
		}
	}

	if ( null === $settings_row_index || '' === $settings_capability ) {
		return $native_submenu;
	}

	$booking_forms_row = array(
		esc_html__( 'Booking Forms', 'booking' ),
		$settings_capability,
		$booking_forms_url,
	);
	array_splice( $native_submenu, (int) $settings_row_index, 0, array( $booking_forms_row ) );

	return $native_submenu;
}

/**
 * Mark the native Booking Forms alias as active on the Forms Builder route.
 *
 * WordPress otherwise highlights the broader Settings row because both links
 * use the same controller. Returning the exact canonical alias URL keeps the
 * native menu's visual state aligned with the page being shown.
 *
 * @since 12.0.0
 *
 * @param string $submenu_file Current WordPress submenu file.
 * @param string $parent_file  Current WordPress parent menu file.
 *
 * @return string Booking Forms alias URL on its route, otherwise the original value.
 */
function wpbc_booking_modes_v3_filter_native_booking_forms_submenu_file( $submenu_file, $parent_file ) {
	$context = wpbc_booking_modes_get_context();
	if (
		'wpbc' !== $parent_file
		|| ! is_array( $context )
		|| 'wpbc-settings' !== ( isset( $context['page'] ) ? $context['page'] : '' )
		|| 'builder_booking_form' !== ( isset( $context['tab'] ) ? $context['tab'] : '' )
	) {
		return $submenu_file;
	}

	$booking_forms_url = wpbc_booking_modes_get_canonical_page_url( 'wpbc-settings__builder_booking_form' );

	return '' !== $booking_forms_url ? $booking_forms_url : $submenu_file;
}
add_filter( 'submenu_file', 'wpbc_booking_modes_v3_filter_native_booking_forms_submenu_file', 10, 2 );

/**
 * Check whether the native WordPress submenu should show the Free upgrade action.
 *
 * The existing Booking Calendar preference and edition checks remain authoritative,
 * so this additional navigation surface follows the same visibility contract as
 * the upgrade action in the Booking Calendar sidebar.
 *
 * @since 11.8.0
 *
 * @return bool True when the Free upgrade action may be rendered.
 */
function wpbc_booking_modes_v3_should_show_native_upgrade_action() {
	return function_exists( 'wpbc_is_show_free_upgrade' )
		&& function_exists( 'wpbc_up_link' )
		&& wpbc_is_show_free_upgrade();
}

/**
 * Append the WPBC-owned Free upgrade action to an authorized native submenu.
 *
 * The row is added after source-constraint enforcement because it is a deliberate
 * Booking Calendar action rather than a page contributed by a navigation source.
 * Existing registered routes and third-party menu rows cannot be forged through
 * this helper.
 *
 * @since 11.8.0
 *
 * @param array $native_submenu Authorized native Booking Calendar submenu rows.
 *
 * @return array Native submenu rows, optionally followed by the upgrade action.
 */
function wpbc_booking_modes_v3_add_native_upgrade_action( $native_submenu ) {
	if ( ! is_array( $native_submenu ) || empty( $native_submenu ) || ! wpbc_booking_modes_v3_should_show_native_upgrade_action() ) {
		return is_array( $native_submenu ) ? $native_submenu : array();
	}

	$upgrade_capability     = 'read';
	$has_source_capability = false;
	foreach ( $native_submenu as $native_submenu_row ) {
		if ( isset( $native_submenu_row[0] ) && false !== strpos( (string) $native_submenu_row[0], 'wpbc_native_upgrade_menu_label' ) ) {
			return $native_submenu;
		}
		if ( ! $has_source_capability && isset( $native_submenu_row[1] ) && is_string( $native_submenu_row[1] ) && '' !== $native_submenu_row[1] ) {
			$upgrade_capability = $native_submenu_row[1];
			$has_source_capability = true;
		}
	}

	$native_submenu[] = array(
		'<span class="wpbc_native_upgrade_menu_label">' . esc_html__( 'Upgrade to Pro', 'booking' ) . '</span>',
		$upgrade_capability,
		wpbc_up_link(),
	);

	return $native_submenu;
}

/**
 * Enqueue the scoped native-menu upgrade style wherever WordPress renders it.
 *
 * @since 11.8.0
 *
 * @return void
 */
function wpbc_booking_modes_v3_enqueue_native_upgrade_style() {
	if ( ! wpbc_booking_modes_v3_should_show_native_upgrade_action() ) {
		return;
	}

	wp_enqueue_style(
		'wpbc-booking-modes-native-menu',
		trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/booking_modes-native-menu.css',
		array(),
		WP_BK_VERSION_NUM
	);
}
add_action( 'admin_enqueue_scripts', 'wpbc_booking_modes_v3_enqueue_native_upgrade_style', 20 );

/**
 * Hide only a V3-configured native entry while retaining direct registration.
 *
 * @param string|false $parent_menu_slug Existing parent slug.
 * @param string       $menu_slug        Registered child slug.
 *
 * @return string|false Original parent or false for presentation-only hiding.
 */
function wpbc_booking_modes_v3_filter_admin_menu_parent_slug( $parent_menu_slug, $menu_slug ) {
	$menu_slug = is_scalar( $menu_slug ) ? sanitize_key( (string) $menu_slug ) : '';
	if ( '' === $menu_slug ) {
		return $parent_menu_slug;
	}

	$definition            = wpbc_booking_modes_v3_get_selected_definition();
	$options               = isset( $definition['wordpress_menu'][ $menu_slug ] ) ? $definition['wordpress_menu'][ $menu_slug ] : array();
	$compatibility_menu    = WPBC_Booking_Modes_V3_Compatibility_Registry::get_instance()->get_native_menu( $definition['id'] );
	$compatibility_options = isset( $compatibility_menu[ $menu_slug ] ) ? $compatibility_menu[ $menu_slug ] : array();
	if ( isset( $options['visible'] ) && false === $options['visible'] ) {
		return false;
	}
	if ( isset( $options['editions'] ) && ! in_array( WPBC_Booking_Modes_V3_Compiler::get_current_edition_id(), $options['editions'], true ) ) {
		return false;
	}
	if ( isset( $compatibility_options['visible'] ) && false === $compatibility_options['visible'] ) {
		return false;
	}

	return $parent_menu_slug;
}
add_filter( 'wpbc_admin_menu_parent_slug', 'wpbc_booking_modes_v3_filter_admin_menu_parent_slug', 10, 2 );

/**
 * Preserve the released wpbc-new alias for the selected workflow.
 *
 * @return void
 */
function wpbc_booking_modes_v3_redirect_native_add_page() {
	$context = wpbc_booking_modes_get_context();
	if ( empty( $context['is_admin'] ) || 'wpbc-new' !== $context['page'] ) {
		return;
	}

	$page_id      = 'appointment' === wpbc_booking_modes_get_selected_mode_id() ? 'wpbc__add-appointment' : 'wpbc__add-booking';
	$redirect_url = wpbc_booking_modes_get_canonical_page_url( $page_id );
	if ( '' !== $redirect_url ) {
		wp_safe_redirect( $redirect_url );
		exit;
	}
}
add_action( 'admin_init', 'wpbc_booking_modes_v3_redirect_native_add_page', 20 );

/**
 * Hide the context-free availability toolbar action in Rentals mode.
 *
 * Rental workflows manage availability from their dedicated navigation and do
 * not need the context-free Block Times shortcut in the booking-list toolbar.
 * The row action remains available because it has a concrete booking context.
 *
 * @since 11.8.0
 *
 * @param bool $show_button Existing button visibility.
 *
 * @return bool Updated button visibility.
 */
function wpbc_booking_modes_v3_filter_set_unavailable_times_button( $show_button ) {
	if ( ! $show_button ) {
		return false;
	}

	return 'rental' !== wpbc_booking_modes_get_selected_mode_id();
}
add_filter( 'wpbc_booking_listing_show_set_unavailable_times_button', 'wpbc_booking_modes_v3_filter_set_unavailable_times_button' );

/**
 * Preserve the compact listing action label outside Appointments mode.
 *
 * @param bool $show_button_text Existing label visibility.
 *
 * @return bool Updated label visibility.
 */
function wpbc_booking_modes_v3_filter_set_unavailable_times_button_text( $show_button_text ) {
	return 'appointment' === wpbc_booking_modes_get_selected_mode_id() ? $show_button_text : false;
}
add_filter( 'wpbc_booking_listing_show_set_unavailable_times_button_text', 'wpbc_booking_modes_v3_filter_set_unavailable_times_button_text' );
