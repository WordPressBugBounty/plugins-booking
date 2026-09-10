<?php
/**
 * Request-scoped shared-service loader for Booking Modes V3.
 *
 * @package Booking Calendar
 * @since   11.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Read one scalar bootstrap request value without building cached mode context.
 *
 * The loader runs before paid page contributors attach their filters. Reading
 * raw routing keys here avoids freezing the public context or mode registries
 * before those contributors have loaded.
 *
 * @param string $request_key Request parameter name.
 *
 * @return string Sanitized request identifier, or an empty string.
 */
function wpbc_booking_modes_v3_get_bootstrap_request_key( $request_key ) {
	if ( ! isset( $_REQUEST[ $request_key ] ) || ! is_scalar( $_REQUEST[ $request_key ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only request routing.
		return '';
	}

	return sanitize_key( wp_unslash( $_REQUEST[ $request_key ] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only request routing.
}

if ( ! is_admin() ) {
	return;
}

$wpbc_booking_modes_v3_page               = wpbc_booking_modes_v3_get_bootstrap_request_key( 'page' );
$wpbc_booking_modes_v3_action             = wpbc_booking_modes_v3_get_bootstrap_request_key( 'action' );
$wpbc_booking_modes_v3_is_wpbc_page       = 0 === strpos( $wpbc_booking_modes_v3_page, 'wpbc' );
$wpbc_booking_modes_v3_is_setup_request   = 'wpbc_ajx_setup_wizard_page' === $wpbc_booking_modes_v3_action;
$wpbc_booking_modes_v3_is_switch_request  = 'wpbc_ajx_booking_mode_switch' === $wpbc_booking_modes_v3_action;
$wpbc_booking_modes_v3_is_quickstart      = 'wpbc_ajx_booking_mode_quickstart' === $wpbc_booking_modes_v3_action;
$wpbc_booking_modes_v3_is_landing_request = $wpbc_booking_modes_v3_is_wpbc_page
	&& '1' === wpbc_booking_modes_v3_get_bootstrap_request_key( 'wpbc_booking_mode_landing' );

// Setup remains available when the presentation boundary is disabled, matching V1.
if ( ( $wpbc_booking_modes_v3_is_wpbc_page && ! $wpbc_booking_modes_v3_is_landing_request ) || $wpbc_booking_modes_v3_is_setup_request ) {
	require_once __DIR__ . '/booking_modes-setup.php';
}

if ( ! wpbc_booking_modes_is_navigation_boundary_enabled() ) {
	return;
}

if ( ( $wpbc_booking_modes_v3_is_wpbc_page && ! $wpbc_booking_modes_v3_is_landing_request ) || $wpbc_booking_modes_v3_is_quickstart ) {
	require_once __DIR__ . '/quickstart/booking_modes-quickstart.php';
}

if ( $wpbc_booking_modes_v3_is_wpbc_page && ! $wpbc_booking_modes_v3_is_landing_request ) {
	require_once __DIR__ . '/booking_modes-toolbar.php';
}

if ( $wpbc_booking_modes_v3_is_switch_request || $wpbc_booking_modes_v3_is_landing_request ) {
	require_once __DIR__ . '/class-wpbc-booking-modes-v3-switch-intent.php';
}

if ( $wpbc_booking_modes_v3_is_switch_request ) {
	require_once __DIR__ . '/ajax/booking_mode_switch.php';
}

if ( $wpbc_booking_modes_v3_is_landing_request ) {
	require_once __DIR__ . '/booking_modes-landing.php';
}

if ( $wpbc_booking_modes_v3_is_quickstart ) {
	require_once __DIR__ . '/quickstart/appointment.php';
	require_once __DIR__ . '/quickstart/rental.php';
	require_once __DIR__ . '/ajax/booking_mode_quickstart.php';
}

unset(
	$wpbc_booking_modes_v3_page,
	$wpbc_booking_modes_v3_action,
	$wpbc_booking_modes_v3_is_wpbc_page,
	$wpbc_booking_modes_v3_is_setup_request,
	$wpbc_booking_modes_v3_is_switch_request,
	$wpbc_booking_modes_v3_is_quickstart,
	$wpbc_booking_modes_v3_is_landing_request
);
