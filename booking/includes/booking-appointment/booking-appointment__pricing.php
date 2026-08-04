<?php
/**
 * Appointment integration with the established Booking Calendar cost engine.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Add a verified public Appointment selection to live cost-calculation params.
 *
 * The browser sends the same signed Service/Provider context used by final
 * submission. Invalid or unrelated requests remain normal resource bookings.
 *
 * @param array<string,mixed> $params Existing cost-calculation parameters.
 *
 * @return array<string,mixed> Filtered parameters.
 */
function wpbc_booking_appointment_filter_cost_params( $params ) {
	if ( ! wpbc_is_11_5_features_enabled() || ! wpbc_appointment_services_is_pricing_available() || ! is_array( $params ) || ! empty( $params['service_id'] ) ) {
		return $params;
	}

	// phpcs:disable WordPress.Security.NonceVerification.Missing, WordPress.Security.NonceVerification.Recommended
	$service_id    = isset( $_POST['appointment_service_id'] ) ? absint( $_POST['appointment_service_id'] ) : 0;
	$context_token = isset( $_POST['appointment_context_token'] ) ? sanitize_text_field( wp_unslash( $_POST['appointment_context_token'] ) ) : '';
	// phpcs:enable WordPress.Security.NonceVerification.Missing, WordPress.Security.NonceVerification.Recommended
	$resource_id = ! empty( $params['resource_id'] ) ? absint( $params['resource_id'] ) : 0;
	if ( ! $service_id || ! $resource_id || ! $context_token || ! function_exists( 'wpbc_booking_appointment_validate_submission_context' ) ) {
		return $params;
	}

	$context_check = wpbc_booking_appointment_validate_submission_context( $context_token, $service_id, $resource_id );
	if ( is_wp_error( $context_check ) ) {
		return $params;
	}

	$params['service_id'] = $service_id;

	return $params;
}
add_filter( 'wpbc_booking_cost_calculation_params', 'wpbc_booking_appointment_filter_cost_params', 10, 1 );

/**
 * Resolve the immutable or current effective Service for one cost calculation.
 *
 * A saved booking snapshot wins so later Service edits cannot rewrite a
 * historical payment. Before save, the active Service/Provider assignment is
 * resolved from the database and includes a nullable Provider cost override.
 *
 * @param array<string,mixed> $params Cost-calculation parameters.
 *
 * @return array<string,mixed>|null Effective Service data, or null.
 */
function wpbc_booking_appointment_get_cost_service( $params ) {
	static $cache = array();

	if ( ! wpbc_is_11_5_features_enabled() || ! wpbc_appointment_services_is_pricing_available() || ! function_exists( 'wpbc_appointment_services_repository' ) ) {
		return null;
	}

	$booking_id = ! empty( $params['booking_id'] ) ? absint( $params['booking_id'] ) : 0;
	if ( $booking_id ) {
		$cache_key = 'booking:' . $booking_id;
		if ( array_key_exists( $cache_key, $cache ) ) {
			return $cache[ $cache_key ];
		}
		$snapshot = wpbc_appointment_services_repository()->get_appointment_snapshot( $booking_id );
		if ( $snapshot && isset( $snapshot['base_cost'] ) && is_numeric( $snapshot['base_cost'] ) ) {
			$cache[ $cache_key ] = $snapshot;
			return $cache[ $cache_key ];
		}
	}

	$service_id  = ! empty( $params['service_id'] ) ? absint( $params['service_id'] ) : 0;
	$resource_id = ! empty( $params['resource_id'] ) ? absint( $params['resource_id'] ) : 0;
	if ( ! $service_id || ! $resource_id ) {
		return null;
	}

	$cache_key = 'selection:' . $service_id . ':' . $resource_id;
	if ( array_key_exists( $cache_key, $cache ) ) {
		return $cache[ $cache_key ];
	}
	$service = wpbc_appointment_services_repository()->find_active_for_resource( $service_id, $resource_id );
	$cache[ $cache_key ] = is_wp_error( $service ) ? null : $service;

	return $cache[ $cache_key ];
}

/**
 * Replace only the calculated resource base total with the effective Service.
 *
 * Existing advanced costs, coupons, deposits, taxes, and gateways continue
 * after this hook in their established order. Non-Appointment calculations
 * are returned byte-for-byte unchanged.
 *
 * @param float|int|string    $base_total Calculated resource base total.
 * @param array<string,mixed> $params     Cost-calculation parameters.
 *
 * @return float|int|string Effective Appointment base total or original value.
 */
function wpbc_booking_appointment_filter_base_cost_total( $base_total, $params ) {
	if ( ! wpbc_appointment_services_is_pricing_available() ) {
		return $base_total;
	}

	$service = wpbc_booking_appointment_get_cost_service( is_array( $params ) ? $params : array() );
	if ( ! $service || ! isset( $service['base_cost'] ) || ! is_numeric( $service['base_cost'] ) ) {
		return $base_total;
	}

	$service_cost = (float) $service['base_cost'];

	return apply_filters( 'wpbc_booking_appointment_base_cost', $service_cost, $service, $params, $base_total );
}
add_filter( 'wpbc_booking_cost_base_total', 'wpbc_booking_appointment_filter_base_cost_total', 10, 2 );

/**
 * Format a Service price using the active Booking Calendar currency settings.
 *
 * Editions below Business Small do not expose the required pricing engine, so
 * they do not present a price that cannot enter the cost/payment pipeline.
 *
 * @param float|int|string $cost        Numeric Service price.
 * @param int              $resource_id Provider resource ID.
 *
 * @return string Formatted price, or an empty string when pricing is absent.
 */
function wpbc_booking_appointment_format_service_cost( $cost, $resource_id = 0 ) {
	if ( ! wpbc_appointment_services_is_pricing_available() || ! function_exists( 'wpbc_get_cost_with_currency_for_user' ) || ! is_numeric( $cost ) ) {
		return '';
	}

	return (string) wpbc_get_cost_with_currency_for_user( (float) $cost, absint( $resource_id ) );
}

/**
 * Return the formatted Service price as plain text for escaped UI labels.
 *
 * @param float|int|string $cost        Numeric Service price.
 * @param int              $resource_id Provider resource ID.
 *
 * @return string Plain-text price.
 */
function wpbc_booking_appointment_format_service_cost_text( $cost, $resource_id = 0 ) {
	$formatted = wpbc_booking_appointment_format_service_cost( $cost, $resource_id );

	return trim( html_entity_decode( wp_strip_all_tags( $formatted ), ENT_QUOTES, get_bloginfo( 'charset' ) ) );
}
