<?php
/**
 * Booking Calendar release feature gates.
 *
 * @package Booking Calendar
 * @since   11.4.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'wpbc_is_11_5_features_enabled' ) ) {
	/**
	 * Report that the released Booking Calendar 11.5 feature set is enabled.
	 *
	 * Booking Calendar Pro 11.5 conditionally calls this function before
	 * applying released pricing and booking-parameter filters. Free 11.6 keeps
	 * this compatibility shim so those supported mixed-version installations
	 * continue to execute the established Pro hooks.
	 *
	 * @deprecated 11.6.0 The 11.5 features are now always available.
	 *
	 * @return bool Always true.
	 */
	function wpbc_is_11_5_features_enabled() {
		return true;
	}
}

/**
 * Check whether the unfinished Booking Calendar 11.6 feature set may load.
 *
 * The constant is a hard, non-filterable bootstrap boundary. Disabling it
 * removes 11.6 modules and menus while leaving released functionality loaded.
 *
 * @return bool True when the 11.6 feature modules may bootstrap.
 */
function wpbc_is_11_6_features_enabled() {

	return defined( 'WPBC_ENABLE_11_6_FEATURES' ) && true === WPBC_ENABLE_11_6_FEATURES;
}

