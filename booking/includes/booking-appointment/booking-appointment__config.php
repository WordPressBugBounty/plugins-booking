<?php
/**
 * Appointment shortcode configuration normalization and signing.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Convert a comma-separated value or array to unique positive IDs.
 *
 * @param mixed $value Raw ID collection.
 *
 * @return int[] Normalized IDs.
 */
function wpbc_booking_appointment_normalize_ids( $value ) {
	if ( is_string( $value ) ) {
		$value = preg_split( '/[;,\s]+/', $value, -1, PREG_SPLIT_NO_EMPTY );
	}

	return array_values( array_unique( array_filter( array_map( 'absint', (array) $value ) ) ) );
}

/**
 * Normalize shortcode attributes into the stable AJAX configuration contract.
 *
 * @param mixed $attributes Raw shortcode attributes or decoded configuration.
 *
 * @return array<string,mixed> Safe Appointment configuration.
 */
function wpbc_booking_appointment_normalize_config( $attributes ) {
	$attributes = is_array( $attributes ) ? $attributes : array();
	$defaults   = array(
		'service_id'              => 0,
		'provider_id'             => 0,
		'service_ids'             => array(),
		'provider_ids'            => array(),
		'cal_count'               => 1,
		'start_month_calendar'    => false,
		'calendar_dates_start'    => '',
		'calendar_dates_end'      => '',
		'options'                 => '',
		'form_type'               => '',
		'auto_select_provider'    => false,
		'show_progress'           => true,
		'progress_item_1_title'   => null,
		'progress_item_1_number'  => null,
		'progress_item_2_title'   => null,
		'progress_item_2_number'  => null,
		'progress_item_3_title'   => null,
		'progress_item_3_number'  => null,
		'screen_1_title'          => null,
		'screen_1_description'    => null,
		'screen_2_title'          => null,
		'screen_2_description'    => null,
		'allow_past'              => false,
		'return_url'              => '',
	);

	// Decode the public shortcode aliases only before values enter the signed token.
	if ( isset( $attributes['services'] ) && ! isset( $attributes['service_ids'] ) ) {
		$attributes['service_ids'] = $attributes['services'];
	}
	if ( isset( $attributes['providers'] ) && ! isset( $attributes['provider_ids'] ) ) {
		$attributes['provider_ids'] = $attributes['providers'];
	}
	if ( isset( $attributes['nummonths'] ) && ! isset( $attributes['cal_count'] ) ) {
		$attributes['cal_count'] = $attributes['nummonths'];
	}
	if ( isset( $attributes['startmonth'] ) && ! isset( $attributes['start_month_calendar'] ) ) {
		$attributes['start_month_calendar'] = $attributes['startmonth'];
	}

	// Normalize earlier descriptive names before signing one indexed contract.
	$progress_attribute_aliases = array(
		'progress_service_title'   => 'progress_item_1_title',
		'progress_service_number'  => 'progress_item_1_number',
		'progress_provider_title'  => 'progress_item_2_title',
		'progress_provider_number' => 'progress_item_2_number',
		'progress_details_title'   => 'progress_item_3_title',
		'progress_details_number'  => 'progress_item_3_number',
	);
	foreach ( $progress_attribute_aliases as $legacy_attribute => $normalized_attribute ) {
		if ( array_key_exists( $legacy_attribute, $attributes ) && ! array_key_exists( $normalized_attribute, $attributes ) ) {
			$attributes[ $normalized_attribute ] = $attributes[ $legacy_attribute ];
		}
		unset( $attributes[ $legacy_attribute ] );
	}

	$config = wp_parse_args( $attributes, $defaults );

	$config['service_id']   = absint( $config['service_id'] );
	$config['provider_id']  = absint( $config['provider_id'] );
	$config['service_ids']  = wpbc_booking_appointment_normalize_ids( $config['service_ids'] );
	$config['provider_ids'] = wpbc_booking_appointment_normalize_ids( $config['provider_ids'] );
	$config['cal_count']    = min( 24, max( 1, absint( $config['cal_count'] ) ) );

	if ( $config['service_id'] && ! in_array( $config['service_id'], $config['service_ids'], true ) ) {
		$config['service_ids'][] = $config['service_id'];
	}
	if ( $config['provider_id'] && ! in_array( $config['provider_id'], $config['provider_ids'], true ) ) {
		$config['provider_ids'][] = $config['provider_id'];
	}

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

	$config['options']    = sanitize_text_field( (string) $config['options'] );
	$config['form_type']  = sanitize_text_field( (string) $config['form_type'] );
	$config['return_url'] = esc_url_raw( (string) $config['return_url'] );
	$auto_select_provider = is_string( $config['auto_select_provider'] ) ? strtolower( trim( $config['auto_select_provider'] ) ) : $config['auto_select_provider'];
	$config['auto_select_provider'] = ! in_array( $auto_select_provider, array( false, 0, '0', 'false', 'off', 'no' ), true );
	$show_progress = is_string( $config['show_progress'] ) ? strtolower( trim( $config['show_progress'] ) ) : $config['show_progress'];
	$config['show_progress'] = ! in_array( $show_progress, array( false, 0, '0', 'false', 'off', 'no', '' ), true );
	$display_text_keys = array(
		'progress_item_1_title',
		'progress_item_1_number',
		'progress_item_2_title',
		'progress_item_2_number',
		'progress_item_3_title',
		'progress_item_3_number',
		'screen_1_title',
		'screen_1_description',
		'screen_2_title',
		'screen_2_description',
	);
	foreach ( $display_text_keys as $display_text_key ) {
		if ( null !== $config[ $display_text_key ] ) {
			$config[ $display_text_key ] = sanitize_text_field( (string) $config[ $display_text_key ] );
		}
	}
	$allow_past = is_string( $config['allow_past'] ) ? strtolower( trim( $config['allow_past'] ) ) : $config['allow_past'];
	$config['allow_past'] = ! in_array( $allow_past, array( false, 0, '0', 'false', 'off', 'no', '' ), true );

	return (array) apply_filters( 'wpbc_booking_appointment_normalized_config', $config, $attributes );
}

/**
 * Check whether signed Appointment configuration enables past bookings.
 *
 * The site author explicitly opts in through the shortcode. The normalized
 * value is included in the signed Appointment context and verified again by
 * the save handler, so a visitor cannot enable it by modifying AJAX data.
 *
 * @param array<string,mixed> $config Normalized or decoded Appointment configuration.
 *
 * @return bool True when the signed configuration explicitly enables past bookings.
 */
function wpbc_booking_appointment_is_past_booking_enabled( $config ) {
	return ! empty( $config['allow_past'] );
}

/**
 * Base64-url encode a binary or text value without padding.
 *
 * @param string $value Value to encode.
 *
 * @return string URL-safe encoded value.
 */
function wpbc_booking_appointment_base64url_encode( $value ) {
	return rtrim( strtr( base64_encode( (string) $value ), '+/', '-_' ), '=' ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
}

/**
 * Decode a base64-url value with strict validation.
 *
 * @param string $value Encoded value.
 *
 * @return string|false Decoded value or false.
 */
function wpbc_booking_appointment_base64url_decode( $value ) {
	$value   = strtr( (string) $value, '-_', '+/' );
	$padding = strlen( $value ) % 4;
	if ( $padding ) {
		$value .= str_repeat( '=', 4 - $padding );
	}

	return base64_decode( $value, true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
}

/**
 * Sign normalized shortcode configuration for public AJAX round trips.
 *
 * @param array<string,mixed> $config Normalized configuration.
 *
 * @return string Signed opaque configuration token.
 */
function wpbc_booking_appointment_encode_config( $config ) {
	$payload   = wpbc_booking_appointment_base64url_encode( wp_json_encode( wpbc_booking_appointment_normalize_config( $config ) ) );
	$signature = hash_hmac( 'sha256', $payload, wp_salt( 'auth' ), true );

	return $payload . '.' . wpbc_booking_appointment_base64url_encode( $signature );
}

/**
 * Verify and decode a public AJAX configuration token.
 *
 * @param string $token Signed token.
 *
 * @return array<string,mixed>|WP_Error Normalized configuration or validation error.
 */
function wpbc_booking_appointment_decode_config( $token ) {
	$parts = explode( '.', (string) $token, 2 );
	if ( 2 !== count( $parts ) ) {
		return new WP_Error( 'appointment_config_invalid', __( 'The Appointment configuration is invalid. Reload the page and try again.', 'booking' ) );
	}

	$expected_signature = hash_hmac( 'sha256', $parts[0], wp_salt( 'auth' ), true );
	$actual_signature   = wpbc_booking_appointment_base64url_decode( $parts[1] );
	if ( false === $actual_signature || ! hash_equals( $expected_signature, $actual_signature ) ) {
		return new WP_Error( 'appointment_config_invalid', __( 'The Appointment configuration is invalid. Reload the page and try again.', 'booking' ) );
	}

	$json = wpbc_booking_appointment_base64url_decode( $parts[0] );
	$data = false !== $json ? json_decode( $json, true ) : null;
	if ( ! is_array( $data ) ) {
		return new WP_Error( 'appointment_config_invalid', __( 'The Appointment configuration is invalid. Reload the page and try again.', 'booking' ) );
	}

	return wpbc_booking_appointment_normalize_config( $data );
}

/**
 * Sign one server-validated Service/Provider selection for booking submission.
 *
 * The selection is narrowed to exactly one Service and Provider. The token is
 * attached to the rendered native form and verified again by the core booking
 * save path, preventing another Appointment block from supplying its context.
 *
 * @param array<string,mixed> $config      Original normalized shortcode configuration.
 * @param int                 $service_id  Selected Service ID.
 * @param int                 $provider_id Selected Provider resource ID.
 *
 * @return string Signed selection token, or an empty string for invalid IDs.
 */
function wpbc_booking_appointment_encode_submission_context( $config, $service_id, $provider_id ) {
	$service_id  = absint( $service_id );
	$provider_id = absint( $provider_id );
	if ( ! $service_id || ! $provider_id ) {
		return '';
	}

	$context                = wpbc_booking_appointment_normalize_config( $config );
	$context['service_id']  = $service_id;
	$context['provider_id'] = $provider_id;
	$context['service_ids'] = array( $service_id );
	$context['provider_ids'] = array( $provider_id );

	return wpbc_booking_appointment_encode_config( $context );
}

/**
 * Verify that a signed submission context matches the submitted booking pair.
 *
 * @param string $token       Signed Appointment selection token.
 * @param int    $service_id  Submitted Service ID.
 * @param int    $provider_id Submitted Provider resource ID.
 *
 * @return array<string,mixed>|WP_Error Verified context or controlled error.
 */
function wpbc_booking_appointment_validate_submission_context( $token, $service_id, $provider_id ) {
	$service_id  = absint( $service_id );
	$provider_id = absint( $provider_id );
	if ( '' === trim( (string) $token ) ) {
		return new WP_Error( 'appointment_context_required', __( 'The Appointment selection has expired. Please start over and try again.', 'booking' ) );
	}

	$context = wpbc_booking_appointment_decode_config( $token );
	if ( is_wp_error( $context ) ) {
		return new WP_Error( 'appointment_context_invalid', __( 'The Appointment selection is invalid. Please start over and try again.', 'booking' ) );
	}
	if ( $service_id !== absint( $context['service_id'] ) || $provider_id !== absint( $context['provider_id'] ) ) {
		return new WP_Error( 'appointment_context_mismatch', __( 'The selected Service and Provider do not match this Appointment form. Please start over and try again.', 'booking' ) );
	}

	return $context;
}
