<?php
/**
 * Full-administration landing boundary for Booking Modes V3 switches.
 *
 * @package Booking Calendar
 * @since   11.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Retain the latest contributor-built navigation tree for one landing request.
 *
 * The normal administration menu lifecycle invokes the source filter after
 * each contributor. Keeping only the latest snapshot avoids reconstructing
 * page controllers inside admin-ajax.php and gives the landing resolver the
 * same capability-, owner-, edition-, and module-scoped metadata as the page.
 */
final class WPBC_Booking_Modes_V3_Landing_Source_Capture {

	/** @var array<string,array<string,mixed>> */
	private static $navigation = array();

	/**
	 * Capture the current complete source snapshot without changing it.
	 *
	 * @param array  $navigation Contributor-built navigation tree.
	 * @param string $page_slug  Page whose contributor lifecycle is running.
	 *
	 * @return array Unmodified contributor navigation.
	 */
	public static function capture( $navigation, $page_slug ) {
		unset( $page_slug );
		self::$navigation = is_array( $navigation ) ? $navigation : array();

		return $navigation;
	}

	/**
	 * Return the latest contributor-built source snapshot.
	 *
	 * @return array<string,array<string,mixed>> Source navigation tree.
	 */
	public static function get_navigation() {
		return self::$navigation;
	}
}
add_filter( 'wpbc_plugin_menu_structure_arr', array( 'WPBC_Booking_Modes_V3_Landing_Source_Capture', 'capture' ), PHP_INT_MAX, 2 );

/**
 * Resolve a signed switch intent after the normal administration menu lifecycle.
 *
 * Invalid, expired, replayed-for-another-context, or unavailable destinations
 * fall back to the safe Bookings page. No page callback or mutation handler is
 * invoked while the destination is checked.
 *
 * @return void
 */
function wpbc_booking_modes_v3_handle_switch_landing() {
	$intent_token = isset( $_GET['wpbc_booking_mode_intent'] ) && is_scalar( $_GET['wpbc_booking_mode_intent'] )
		? sanitize_text_field( wp_unslash( $_GET['wpbc_booking_mode_intent'] ) ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Signed, read-only landing intent.
		: '';
	$signature    = isset( $_GET['wpbc_booking_mode_signature'] ) && is_scalar( $_GET['wpbc_booking_mode_signature'] )
		? sanitize_text_field( wp_unslash( $_GET['wpbc_booking_mode_signature'] ) ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Signed, read-only landing intent.
		: '';
	$intent       = WPBC_Booking_Modes_V3_Switch_Intent::validate( $intent_token, $signature );
	$fallback_url = admin_url( 'admin.php?page=wpbc' );

	if ( is_wp_error( $intent ) ) {
		wp_safe_redirect( $fallback_url );
		exit;
	}

	$source_navigation = WPBC_Booking_Modes_V3_Landing_Source_Capture::get_navigation();
	$redirect_url      = WPBC_Booking_Modes_V3_Switch_Intent::resolve_destination( $intent, $source_navigation );

	wp_safe_redirect( $redirect_url ? $redirect_url : $fallback_url );
	exit;
}
add_action( 'admin_init', 'wpbc_booking_modes_v3_handle_switch_landing', PHP_INT_MAX );
