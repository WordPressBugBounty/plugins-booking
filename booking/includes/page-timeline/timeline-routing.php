<?php
/**
 * Isolated administration route and Booking Modes navigation adapters.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Determine whether the current request targets the new Timeline page.
 *
 * The read-only route check sanitizes both query arguments immediately and is
 * used only to scope assets, templates, and presentation filters.
 *
 * @return bool True for `admin.php?page=wpbc&tab=timeline`.
 */
function wpbc_timeline_is_page() {
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only administration routing.
	$page = isset( $_GET['page'] ) && is_scalar( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only administration routing.
	$tab = isset( $_GET['tab'] ) && is_scalar( $_GET['tab'] ) ? sanitize_key( wp_unslash( $_GET['tab'] ) ) : '';

	return 'wpbc' === $page && 'timeline' === $tab;
}

/**
 * Add the new route to the Booking Modes canonical page registry.
 *
 * This domain-owned filter is registered only by the Timeline bootstrap. The
 * canonical reference therefore disappears together with the single module
 * include and does not change the legacy `wpbc__vm_calendar` contract.
 *
 * @param array $canonical_pages Existing canonical page definitions.
 *
 * @return array Canonical definitions including the new Timeline route.
 */
function wpbc_timeline_register_canonical_page( $canonical_pages ) {
	if ( ! is_array( $canonical_pages ) ) {
		$canonical_pages = array();
	}

	$canonical_pages['wpbc__timeline'] = array(
		'page'  => 'wpbc',
		'tab'   => 'timeline',
		'title' => __( 'Timeline', 'booking' ),
	);

	return $canonical_pages;
}

/**
 * Build one translated Timeline navigation title with its version label.
 *
 * The route remains the source of identity and authorization. This helper owns
 * presentation only, keeping HTML out of the Booking Modes declarations while
 * allowing the shared horizontal and sidebar renderers to show the same label.
 *
 * @param string $version Timeline version. Supported values are `new` and `legacy`.
 *
 * @return string Escaped, allow-listed navigation markup.
 */
function wpbc_timeline_get_versioned_navigation_title( $version ) {
	if ( 'new' === $version ) {
		$version_label = __( 'New', 'booking' );
	} elseif ( 'legacy' === $version ) {
		$version_label = __( 'Legacy', 'booking' );
	} else {
		return esc_html__( 'Timeline', 'booking' );
	}

	return sprintf(
		'%1$s <sup class="wpbc_navigation_version_label wpbc_navigation_version_label--%2$s">%3$s</sup>',
		esc_html__( 'Timeline', 'booking' ),
		esc_attr( $version ),
		esc_html( $version_label )
	);
}

/**
 * Adapt compiled V3 titles only inside the Timeline white navigation pack.
 *
 * Existing pages keep their translated labels and ordering. The new host uses
 * the approved `Bookings | Timeline | Add …` wording while preserving the
 * compiled item URLs, active state, icons, and start/item/end hook lifecycle.
 *
 * @param string $title         Compiled translated item title.
 * @param string $menu_slug     Source-backed tab identifier.
 * @param array  $menu_item_arr Complete compiled navigation item.
 *
 * @return string Timeline-pack title or the original title outside this route.
 */
function wpbc_timeline_filter_navigation_title( $title, $menu_slug, $menu_item_arr ) {
	unset( $menu_item_arr );

	if ( 'timeline' === $menu_slug ) {
		return wpbc_timeline_get_versioned_navigation_title( 'new' );
	}

	if ( 'vm_calendar' === $menu_slug ) {
		return wpbc_timeline_get_versioned_navigation_title( 'legacy' );
	}

	if ( ! wpbc_timeline_is_page() ) {
		return $title;
	}

	if ( 'vm_booking_listing' === $menu_slug ) {
		return __( 'Bookings', 'booking' );
	}

	if ( 'add-appointment' === $menu_slug ) {
		return __( 'Add Appointment', 'booking' );
	}

	if ( 'add-booking' === $menu_slug ) {
		return __( 'Add Booking', 'booking' );
	}

	return $title;
}

/**
 * Add matching version labels to the source-authorized Timeline sidebar peers.
 *
 * Booking Modes remains responsible for deciding whether each route exists in
 * the selected mode and edition. This filter changes only the titles of nodes
 * that the compiler has already authorized and positioned.
 *
 * @param array  $navigation          Source-authorized compiled sidebar tree.
 * @param string $mode_id             Selected Booking Mode identifier.
 * @param array  $placement_summary   Canonical placement summary.
 * @param array  $available_page_ids  Available local definition page IDs.
 * @param array  $context             Current Booking Modes context.
 *
 * @return array Compiled sidebar with versioned Timeline titles.
 */
function wpbc_timeline_filter_sidebar_navigation( $navigation, $mode_id, $placement_summary, $available_page_ids, $context ) {
	unset( $mode_id, $placement_summary, $available_page_ids, $context );

	if ( ! is_array( $navigation ) || empty( $navigation['wpbc'] ) || ! is_array( $navigation['wpbc'] ) ) {
		return is_array( $navigation ) ? $navigation : array();
	}

	if ( isset( $navigation['wpbc']['timeline'] ) && is_array( $navigation['wpbc']['timeline'] ) ) {
		$navigation['wpbc']['timeline']['title'] = wpbc_timeline_get_versioned_navigation_title( 'new' );
	}

	if ( isset( $navigation['wpbc']['calendar'] ) && is_array( $navigation['wpbc']['calendar'] ) ) {
		$navigation['wpbc']['calendar']['title'] = wpbc_timeline_get_versioned_navigation_title( 'legacy' );
	}

	return $navigation;
}

/**
 * Render the established email toggle at the horizontal navigation end hook.
 *
 * The helper delegates to the existing toggle renderer so its saved option,
 * label, tooltip, default value, and browser contract remain unchanged.
 *
 * @param string $active_page Current Booking Calendar page slug.
 * @param string $active_tab  Current Booking Calendar tab slug.
 *
 * @return void
 */
function wpbc_timeline_render_email_toggle( $active_page, $active_tab ) {
	if ( 'wpbc' !== $active_page || 'timeline' !== $active_tab || ! function_exists( 'wpbc_timeline__is_send_emails_toggle' ) ) {
		return;
	}
	?>
	<div class="wpbc_ajx_toolbar wpbc_no_borders wpbc_not_toolbar_is_send_emails wpbc_timeline__email_toggle">
		<div class="ui_container ui_container_micro">
			<div class="ui_group">
				<div class="ui_element">
					<?php wpbc_timeline__is_send_emails_toggle(); ?>
				</div>
			</div>
		</div>
	</div>
	<?php
}
