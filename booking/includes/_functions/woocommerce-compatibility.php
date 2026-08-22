<?php
/**
 * WooCommerce compatibility helpers.
 *
 * @package Booking Calendar
 * @subpackage Compatibility
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Allow intentionally public Booking Calendar AJAX actions through WooCommerce's admin-access guard.
 *
 * WooCommerce normally excludes admin-ajax.php from its customer admin redirect. Some server configurations report
 * a different SCRIPT_FILENAME, which can make WooCommerce redirect a valid public AJAX request to the My Account page.
 * This compatibility layer changes that decision only for Booking Calendar actions that are explicitly registered
 * for logged-out visitors. It does not alter access to any WordPress administration screen or protected AJAX action.
 *
 * @param bool $prevent_access Whether WooCommerce should prevent access to the current administration request.
 * @return bool False for a registered public Booking Calendar AJAX action; otherwise the original decision.
 */
function wpbc_woocommerce_allow_public_ajax_access( $prevent_access ) {
	if ( ! $prevent_access || ! wp_doing_ajax() ) {
		return $prevent_access;
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- The destination AJAX callback verifies its own request.
	if ( ! isset( $_POST['action'] ) || ! is_string( $_POST['action'] ) ) {
		return $prevent_access;
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Used only to identify the destination AJAX callback.
	$ajax_action = sanitize_text_field( wp_unslash( $_POST['action'] ) );

	$public_ajax_actions = array(
		'WPBC_AJX_CALENDAR_LOAD',
		'WPBC_AJX_BOOKING__CREATE',
		'WPBC_AJX_BOOKING_APPOINTMENT_RESOLVE',
		'WPBC_AJX_BOOKING_APPOINTMENT_VALIDATE_TIME',
		'WPBC_AJX_BOOKING_RESOURCE_SELECTOR_RESOLVE',
		'WPBC_AJX_AVAILABILITY_TIMESLOTS_READ',
		'WPBC_FLEXTIMELINE_NAV',
		'CALCULATE_THE_COST',
		'DELETE_BY_VISITOR',
		'BOOKING_SEARCH',
		'WPBC_PAY_VIA_iDEAL',
	);

	if ( ! in_array( $ajax_action, $public_ajax_actions, true ) ) {
		return $prevent_access;
	}

	if ( false === has_action( 'wp_ajax_nopriv_' . $ajax_action ) ) {
		return $prevent_access;
	}

	return false;
}
add_filter( 'woocommerce_prevent_admin_access', 'wpbc_woocommerce_allow_public_ajax_access', PHP_INT_MAX );
