<?php
/**
 * Signed context for Classic Booking Calendar shortcode AJAX requests.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize one YYYY-MM-DD value and reject impossible calendar dates.
 *
 * @param mixed $date_value Candidate date value.
 *
 * @return string Valid normalized date or an empty string.
 */
function wpbc_classic_booking_context_normalize_date( $date_value ) {
	$date_value = sanitize_text_field( (string) $date_value );
	if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_value ) ) {
		return '';
	}

	$date_object = DateTimeImmutable::createFromFormat( '!Y-m-d', $date_value, wp_timezone() );
	if ( false === $date_object || $date_object->format( 'Y-m-d' ) !== $date_value ) {
		return '';
	}

	return $date_value;
}

/**
 * Determine whether a Classic shortcode range intentionally starts in the past.
 *
 * The historical Booking Calendar contract treats a past calendar_dates_start
 * value as site-author permission to submit dates from that visible range.
 *
 * @param mixed  $calendar_dates_start Inclusive shortcode start date.
 * @param string $today_ymd            Optional YYYY-MM-DD comparison date for deterministic callers and tests.
 *
 * @return bool True when the valid range start is earlier than today.
 */
function wpbc_classic_booking_context_should_allow_past( $calendar_dates_start, $today_ymd = '' ) {
	$calendar_dates_start = wpbc_classic_booking_context_normalize_date( $calendar_dates_start );
	$today_ymd            = wpbc_classic_booking_context_normalize_date( $today_ymd );

	if ( '' === $today_ymd ) {
		$today_ymd = current_time( 'Y-m-d' );
	}

	return '' !== $calendar_dates_start && $calendar_dates_start < $today_ymd;
}

/**
 * Normalize the legacy default Booking Form representation.
 *
 * The standard form does not render a booking_form_type hidden field, so its
 * frontend submission uses an empty string even though the shortcode resolver
 * represents the same form as "standard".
 *
 * @param mixed $custom_form Candidate Booking Form slug.
 *
 * @return string Sanitized Booking Form slug, using "standard" for an omitted value.
 */
function wpbc_classic_booking_context_normalize_form( $custom_form ) {
	$custom_form = sanitize_text_field( (string) $custom_form );

	return '' === $custom_form ? 'standard' : $custom_form;
}

/**
 * Normalize Classic shortcode context before it is signed or consumed.
 *
 * @param mixed $context Raw context values.
 *
 * @return array<string,mixed> Stable context contract.
 */
function wpbc_classic_booking_context_normalize( $context ) {
	$context = is_array( $context ) ? $context : array();
	$context = wp_parse_args(
		$context,
		array(
			'resource_id'            => 0,
			'calendar_dates_start'   => '',
			'calendar_dates_end'     => '',
			'custom_form'            => 'standard',
			'aggregate_resource_ids' => array(),
			'allow_past'             => false,
		)
	);
	$calendar_dates_start = wpbc_classic_booking_context_normalize_date( $context['calendar_dates_start'] );

	$aggregate_resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $context['aggregate_resource_ids'] ) ) ) );
	sort( $aggregate_resource_ids, SORT_NUMERIC );

	// Derive permission from the site-authored date boundary; never trust a caller-supplied allow_past flag.
	return array(
		'resource_id'            => absint( $context['resource_id'] ),
		'calendar_dates_start'   => $calendar_dates_start,
		'calendar_dates_end'     => wpbc_classic_booking_context_normalize_date( $context['calendar_dates_end'] ),
		'custom_form'            => wpbc_classic_booking_context_normalize_form( $context['custom_form'] ),
		'aggregate_resource_ids' => $aggregate_resource_ids,
		'allow_past'             => wpbc_classic_booking_context_should_allow_past( $calendar_dates_start ),
	);
}

/**
 * Base64-url encode a context value without padding.
 *
 * @param string $context_value Value to encode.
 *
 * @return string URL-safe encoded value.
 */
function wpbc_classic_booking_context_base64url_encode( $context_value ) {
	return rtrim( strtr( base64_encode( (string) $context_value ), '+/', '-_' ), '=' ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
}

/**
 * Decode one strict base64-url context value.
 *
 * @param string $encoded_value Encoded value.
 *
 * @return string|false Decoded value or false when malformed.
 */
function wpbc_classic_booking_context_base64url_decode( $encoded_value ) {
	$encoded_value = strtr( (string) $encoded_value, '-_', '+/' );
	$padding       = strlen( $encoded_value ) % 4;
	if ( $padding ) {
		$encoded_value .= str_repeat( '=', 4 - $padding );
	}

	return base64_decode( $encoded_value, true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
}

/**
 * Sign normalized Classic shortcode context for cache-safe AJAX round trips.
 *
 * The HMAC has no time component, so cached front-end pages remain usable until
 * WordPress authentication salts change. No secret or raw signature key is
 * exposed to the browser.
 *
 * @param mixed $context Raw or normalized context.
 *
 * @return string Signed opaque token, or an empty string for incomplete context.
 */
function wpbc_classic_booking_context_encode( $context ) {
	$context = wpbc_classic_booking_context_normalize( $context );
	if (
		0 === $context['resource_id']
		|| '' === $context['calendar_dates_start']
		|| '' === $context['calendar_dates_end']
		|| $context['calendar_dates_start'] > $context['calendar_dates_end']
	) {
		return '';
	}

	$payload   = wpbc_classic_booking_context_base64url_encode( wp_json_encode( $context ) );
	$signature = hash_hmac( 'sha256', $payload, wp_salt( 'auth' ), true );

	return $payload . '.' . wpbc_classic_booking_context_base64url_encode( $signature );
}

/**
 * Verify and decode a signed Classic shortcode context token.
 *
 * @param string $context_token Signed token received through AJAX.
 *
 * @return array<string,mixed>|WP_Error Normalized context or a safe validation error.
 */
function wpbc_classic_booking_context_decode( $context_token ) {
	$token_parts = explode( '.', (string) $context_token, 2 );
	if ( 2 !== count( $token_parts ) ) {
		return new WP_Error( 'classic_booking_context_invalid', __( 'The booking form context could not be verified. Please reload the page and try again.', 'booking' ) );
	}

	$expected_signature = hash_hmac( 'sha256', $token_parts[0], wp_salt( 'auth' ), true );
	$actual_signature   = wpbc_classic_booking_context_base64url_decode( $token_parts[1] );
	if ( false === $actual_signature || ! hash_equals( $expected_signature, $actual_signature ) ) {
		return new WP_Error( 'classic_booking_context_invalid', __( 'The booking form context could not be verified. Please reload the page and try again.', 'booking' ) );
	}

	$context_json = wpbc_classic_booking_context_base64url_decode( $token_parts[0] );
	$context      = false !== $context_json ? json_decode( $context_json, true ) : null;
	if ( ! is_array( $context ) ) {
		return new WP_Error( 'classic_booking_context_invalid', __( 'The booking form context could not be verified. Please reload the page and try again.', 'booking' ) );
	}

	$context = wpbc_classic_booking_context_normalize( $context );
	if (
		0 === $context['resource_id']
		|| '' === $context['calendar_dates_start']
		|| '' === $context['calendar_dates_end']
		|| $context['calendar_dates_start'] > $context['calendar_dates_end']
	) {
		return new WP_Error( 'classic_booking_context_invalid', __( 'The booking form context could not be verified. Please reload the page and try again.', 'booking' ) );
	}

	return $context;
}

/**
 * Validate a Classic AJAX request against its signed shortcode boundaries.
 *
 * @param string       $context_token         Signed Classic context token.
 * @param mixed        $resource_id           Submitted primary Booking Resource ID.
 * @param array|string $submitted_dates       Submitted YYYY-MM-DD dates.
 * @param string       $custom_form           Submitted Booking Form identifier.
 * @param array|string $aggregate_resource_ids Submitted aggregate Booking Resource IDs.
 *
 * @return array<string,mixed>|WP_Error Verified context or a validation error.
 */
function wpbc_classic_booking_context_validate_submission( $context_token, $resource_id, $submitted_dates, $custom_form = 'standard', $aggregate_resource_ids = array() ) {
	$context = wpbc_classic_booking_context_decode( $context_token );
	if ( is_wp_error( $context ) ) {
		return $context;
	}

	if ( absint( $resource_id ) !== $context['resource_id'] ) {
		return new WP_Error( 'classic_booking_context_resource_mismatch', __( 'The selected booking resource does not match this booking form. Please reload the page and try again.', 'booking' ) );
	}

	$custom_form = wpbc_classic_booking_context_normalize_form( $custom_form );
	if ( $custom_form !== $context['custom_form'] ) {
		return new WP_Error( 'classic_booking_context_form_mismatch', __( 'The selected Booking Form does not match this calendar. Please reload the page and try again.', 'booking' ) );
	}

	if ( is_string( $aggregate_resource_ids ) ) {
		$aggregate_resource_ids = preg_split( '/[;,\s]+/', $aggregate_resource_ids, -1, PREG_SPLIT_NO_EMPTY );
	}
	$aggregate_resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $aggregate_resource_ids ) ) ) );
	sort( $aggregate_resource_ids, SORT_NUMERIC );
	if ( $aggregate_resource_ids !== $context['aggregate_resource_ids'] ) {
		return new WP_Error( 'classic_booking_context_aggregate_mismatch', __( 'The booking resources do not match this calendar. Please reload the page and try again.', 'booking' ) );
	}

	if ( is_string( $submitted_dates ) ) {
		$submitted_dates = preg_split( '/\s*,\s*/', $submitted_dates, -1, PREG_SPLIT_NO_EMPTY );
	}
	$submitted_dates = array_values( (array) $submitted_dates );
	if ( empty( $submitted_dates ) ) {
		return new WP_Error( 'classic_booking_context_date_invalid', __( 'The selected booking date is invalid. Please select the date again.', 'booking' ) );
	}

	foreach ( $submitted_dates as $submitted_date ) {
		$submitted_date = wpbc_classic_booking_context_normalize_date( $submitted_date );
		if ( '' === $submitted_date ) {
			return new WP_Error( 'classic_booking_context_date_invalid', __( 'The selected booking date is invalid. Please select the date again.', 'booking' ) );
		}
		if ( $submitted_date < $context['calendar_dates_start'] || $submitted_date > $context['calendar_dates_end'] ) {
			return new WP_Error( 'classic_booking_context_date_outside_range', __( 'The selected booking date is outside this calendar range. Please select another date.', 'booking' ) );
		}
	}

	return $context;
}
