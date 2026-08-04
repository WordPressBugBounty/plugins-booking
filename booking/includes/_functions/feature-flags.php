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

/**
 * Check whether the unfinished Booking Calendar 11.5 feature set may load.
 *
 * The constant is deliberately a hard master gate. It is not filterable while
 * disabled, which prevents an extension from accidentally exposing unfinished
 * interfaces in an 11.4.x maintenance release.
 *
 * @return bool True when the 11.5 feature modules may bootstrap.
 */
function wpbc_is_11_5_features_enabled() {

	return defined( 'WPBC_ENABLE_11_5_FEATURES' ) && true === WPBC_ENABLE_11_5_FEATURES;
}
