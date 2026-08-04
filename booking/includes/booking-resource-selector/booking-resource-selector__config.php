<?php
/**
 * Booking Resource selector configuration normalization and signing.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Convert a delimited value or array to unique positive Booking Resource IDs.
 *
 * @param mixed $resource_ids Raw Booking Resource ID collection.
 *
 * @return int[] Normalized Booking Resource IDs.
 */
function wpbc_booking_resource_selector_normalize_ids( $resource_ids ) {
	if ( is_string( $resource_ids ) ) {
		$resource_ids = preg_split( '/[;,\s]+/', $resource_ids, -1, PREG_SPLIT_NO_EMPTY );
	}

	return array_values( array_unique( array_filter( array_map( 'absint', (array) $resource_ids ) ) ) );
}

/**
 * Convert a shortcode-style value to a strict Boolean.
 *
 * @param mixed $raw_value     Raw Boolean-like value.
 * @param bool  $default_value Value used when the raw value is null.
 *
 * @return bool Normalized Boolean.
 */
function wpbc_booking_resource_selector_normalize_boolean( $raw_value, $default_value = false ) {
	if ( null === $raw_value ) {
		return (bool) $default_value;
	}

	if ( is_string( $raw_value ) ) {
		$raw_value = strtolower( trim( $raw_value ) );
	}

	return ! in_array( $raw_value, array( false, 0, '0', 'false', 'off', 'no', '' ), true );
}

/**
 * Return the Booking Resource that should be checked on the selection screen.
 *
 * The public `resource_id` attribute is the primary default-selection
 * parameter. `selected_resource_id` remains as a compatibility fallback for
 * shortcodes created before `resource_id` adopted that behavior.
 *
 * @param array<string,mixed> $config Normalized selector configuration.
 *
 * @return int Default Booking Resource ID or zero.
 */
function wpbc_booking_resource_selector_get_default_resource_id( $config ) {
	if ( ! empty( $config['resource_id'] ) ) {
		return absint( $config['resource_id'] );
	}

	return ! empty( $config['selected_resource_id'] ) ? absint( $config['selected_resource_id'] ) : 0;
}

/**
 * Normalize public shortcode attributes into the signed AJAX contract.
 *
 * The legacy-compatible aliases are accepted only at this boundary. AJAX and
 * submission requests carry one stable normalized representation.
 *
 * @param mixed $attributes Raw shortcode attributes or decoded configuration.
 *
 * @return array<string,mixed> Safe Booking Resource selector configuration.
 */
function wpbc_booking_resource_selector_normalize_config( $attributes ) {
	$attributes = is_array( $attributes ) ? $attributes : array();
	$defaults   = array(
		'resource_id'            => 0,
		'selected_resource_id'   => 0,
		'resource_ids'           => array(),
		'aggregate_resource_ids' => array(),
		'cal_count'              => 1,
		'start_month_calendar'   => false,
		'calendar_dates_start'   => '',
		'calendar_dates_end'     => '',
		'selected_dates'         => '',
		'options'                => '',
		'form_type'              => '',
		'auto_select_resource'   => false,
		'show_progress'          => true,
		'progress_item_1_title'  => null,
		'progress_item_1_number' => null,
		'progress_item_2_title'  => null,
		'progress_item_2_number' => null,
		'screen_1_title'         => null,
		'screen_1_description'   => null,
		'allow_past'             => false,
		'return_url'             => '',
	);

	$attribute_aliases = array(
		'resources'     => 'resource_ids',
		'type'          => 'resource_ids',
		'aggregate'     => 'aggregate_resource_ids',
		'nummonths'     => 'cal_count',
		'startmonth'    => 'start_month_calendar',
		'selected_type' => 'selected_resource_id',
		'label'         => 'screen_1_title',
	);
	foreach ( $attribute_aliases as $public_attribute => $normalized_attribute ) {
		if ( array_key_exists( $public_attribute, $attributes ) && ! array_key_exists( $normalized_attribute, $attributes ) ) {
			$attributes[ $normalized_attribute ] = $attributes[ $public_attribute ];
		}
		unset( $attributes[ $public_attribute ] );
	}

	$attributes                       = array_intersect_key( $attributes, $defaults );
	$config                           = wp_parse_args( $attributes, $defaults );
	$config['resource_id']            = absint( $config['resource_id'] );
	$config['selected_resource_id']   = absint( $config['selected_resource_id'] );
	$config['resource_ids']           = wpbc_booking_resource_selector_normalize_ids( $config['resource_ids'] );
	$config['aggregate_resource_ids'] = wpbc_booking_resource_selector_normalize_ids( $config['aggregate_resource_ids'] );
	$config['cal_count']              = min( 24, max( 1, absint( $config['cal_count'] ) ) );

	$start_month = $config['start_month_calendar'];
	if ( is_array( $start_month ) ) {
		$year        = isset( $start_month[0] ) ? absint( $start_month[0] ) : 0;
		$month       = isset( $start_month[1] ) ? absint( $start_month[1] ) : 0;
		$start_month = ( $year && $month >= 1 && $month <= 12 ) ? array( $year, $month ) : false;
	} elseif ( is_string( $start_month ) && preg_match( '/^(\d{4})[-\/]?(\d{1,2})$/', $start_month, $matches ) ) {
		$month       = absint( $matches[2] );
		$start_month = ( $month >= 1 && $month <= 12 ) ? array( absint( $matches[1] ), $month ) : false;
	} else {
		$start_month = false;
	}
	$config['start_month_calendar'] = $start_month;

	foreach ( array( 'calendar_dates_start', 'calendar_dates_end' ) as $date_key ) {
		$date_value          = sanitize_text_field( (string) $config[ $date_key ] );
		$config[ $date_key ] = preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_value ) ? $date_value : '';
	}

	$config['selected_dates']       = sanitize_text_field( (string) $config['selected_dates'] );
	$config['options']              = sanitize_text_field( (string) $config['options'] );
	$config['form_type']            = sanitize_text_field( (string) $config['form_type'] );
	$config['return_url']           = esc_url_raw( (string) $config['return_url'] );
	$config['auto_select_resource'] = wpbc_booking_resource_selector_normalize_boolean( $config['auto_select_resource'] );
	$config['show_progress']        = wpbc_booking_resource_selector_normalize_boolean( $config['show_progress'], true );
	$config['allow_past']           = wpbc_booking_resource_selector_normalize_boolean( $config['allow_past'] );

	$display_text_keys = array(
		'progress_item_1_title',
		'progress_item_1_number',
		'progress_item_2_title',
		'progress_item_2_number',
		'screen_1_title',
		'screen_1_description',
	);
	foreach ( $display_text_keys as $display_text_key ) {
		if ( null !== $config[ $display_text_key ] ) {
			$config[ $display_text_key ] = sanitize_text_field( (string) $config[ $display_text_key ] );
		}
	}

	return (array) apply_filters( 'wpbc_booking_resource_selector_normalized_config', $config, $attributes );
}

/**
 * Check whether signed selector configuration enables past bookings.
 *
 * @param array<string,mixed> $config Normalized or decoded configuration.
 *
 * @return bool True when the signed shortcode explicitly enables past bookings.
 */
function wpbc_booking_resource_selector_is_past_booking_enabled( $config ) {
	return ! empty( $config['allow_past'] );
}

/**
 * Base64-url encode a binary or text value without padding.
 *
 * @param string $raw_value Value to encode.
 *
 * @return string URL-safe encoded value.
 */
function wpbc_booking_resource_selector_base64url_encode( $raw_value ) {
	return rtrim( strtr( base64_encode( (string) $raw_value ), '+/', '-_' ), '=' ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
}

/**
 * Decode a base64-url value with strict validation.
 *
 * @param string $encoded_value Encoded value.
 *
 * @return string|false Decoded value or false.
 */
function wpbc_booking_resource_selector_base64url_decode( $encoded_value ) {
	$encoded_value = strtr( (string) $encoded_value, '-_', '+/' );
	$padding       = strlen( $encoded_value ) % 4;
	if ( $padding ) {
		$encoded_value .= str_repeat( '=', 4 - $padding );
	}

	return base64_decode( $encoded_value, true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
}

/**
 * Sign normalized shortcode configuration for public AJAX round trips.
 *
 * @param array<string,mixed> $config Normalized configuration.
 *
 * @return string Signed opaque configuration token.
 */
function wpbc_booking_resource_selector_encode_config( $config ) {
	$payload   = wpbc_booking_resource_selector_base64url_encode( wp_json_encode( wpbc_booking_resource_selector_normalize_config( $config ) ) );
	$signature = hash_hmac( 'sha256', $payload, wp_salt( 'auth' ), true );

	return $payload . '.' . wpbc_booking_resource_selector_base64url_encode( $signature );
}

/**
 * Verify and decode a public AJAX configuration token.
 *
 * @param string $config_token Signed token.
 *
 * @return array<string,mixed>|WP_Error Normalized configuration or validation error.
 */
function wpbc_booking_resource_selector_decode_config( $config_token ) {
	$parts = explode( '.', (string) $config_token, 2 );
	if ( 2 !== count( $parts ) ) {
		return new WP_Error( 'resource_selector_config_invalid', __( 'The Booking Resource selection configuration is invalid. Reload the page and try again.', 'booking' ) );
	}

	$expected_signature = hash_hmac( 'sha256', $parts[0], wp_salt( 'auth' ), true );
	$actual_signature   = wpbc_booking_resource_selector_base64url_decode( $parts[1] );
	if ( false === $actual_signature || ! hash_equals( $expected_signature, $actual_signature ) ) {
		return new WP_Error( 'resource_selector_config_invalid', __( 'The Booking Resource selection configuration is invalid. Reload the page and try again.', 'booking' ) );
	}

	$json_data   = wpbc_booking_resource_selector_base64url_decode( $parts[0] );
	$config_data = false !== $json_data ? json_decode( $json_data, true ) : null;
	if ( ! is_array( $config_data ) ) {
		return new WP_Error( 'resource_selector_config_invalid', __( 'The Booking Resource selection configuration is invalid. Reload the page and try again.', 'booking' ) );
	}

	return wpbc_booking_resource_selector_normalize_config( $config_data );
}

/**
 * Sign one server-validated Booking Resource for final booking submission.
 *
 * @param array<string,mixed> $config      Original normalized configuration.
 * @param int                 $resource_id Selected Booking Resource ID.
 *
 * @return string Signed selection token, or an empty string for an invalid ID.
 */
function wpbc_booking_resource_selector_encode_submission_context( $config, $resource_id ) {
	$resource_id = absint( $resource_id );
	if ( ! $resource_id ) {
		return '';
	}

	$context                         = wpbc_booking_resource_selector_normalize_config( $config );
	$context['resource_id']          = $resource_id;
	$context['resource_ids']         = array( $resource_id );
	$context['selected_resource_id'] = 0;

	return wpbc_booking_resource_selector_encode_config( $context );
}

/**
 * Verify that a signed selector submission context matches a resource.
 *
 * @param string $context_token Signed selector context token.
 * @param int    $resource_id   Submitted Booking Resource ID.
 *
 * @return array<string,mixed>|WP_Error Verified context or controlled error.
 */
function wpbc_booking_resource_selector_validate_submission_context( $context_token, $resource_id ) {
	$resource_id = absint( $resource_id );
	if ( '' === trim( (string) $context_token ) ) {
		return new WP_Error( 'resource_selector_context_required', __( 'The Booking Resource selection has expired. Please start over and try again.', 'booking' ) );
	}

	$context = wpbc_booking_resource_selector_decode_config( $context_token );
	if ( is_wp_error( $context ) ) {
		return new WP_Error( 'resource_selector_context_invalid', __( 'The Booking Resource selection is invalid. Please start over and try again.', 'booking' ) );
	}
	if ( absint( $context['resource_id'] ) !== $resource_id ) {
		return new WP_Error( 'resource_selector_context_mismatch', __( 'The selected Booking Resource does not match this booking form. Please start over and try again.', 'booking' ) );
	}

	return $context;
}
