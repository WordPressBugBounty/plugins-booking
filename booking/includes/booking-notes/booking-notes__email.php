<?php
/**
 * Booking Notes email-shortcode integration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Add explicit Public and Private note replacements to an email DTO.
 *
 * Public notes are available only when an administrator deliberately adds the
 * `[public_note]` shortcode to an email template. Private notes are restricted
 * to the administrator email-template context; `[private_note]` is always an
 * empty string in customer/visitor templates even if legacy remark data exists.
 * Calling this after general replacement filters makes the privacy boundary
 * authoritative and prevents an extension from populating the reserved private
 * shortcode in a customer template.
 *
 * @param array<string,mixed> $replacements  Existing email replacements.
 * @param int                 $booking_id    Canonical booking ID.
 * @param string              $email_audience `administrator` or `customer`.
 *
 * @return array<string,mixed> Replacements with both note keys always defined.
 */
function wpbc_booking_notes_add_email_shortcodes( $replacements, $booking_id, $email_audience = 'customer' ) {
	$replacements   = is_array( $replacements ) ? $replacements : array();
	$booking_id     = absint( $booking_id );
	$email_audience = sanitize_key( (string) $email_audience );

	if ( ! $booking_id ) {
		return array_merge( $replacements, wpbc_booking_notes_project_email_shortcodes( array(), $email_audience ) );
	}

	$notes = wpbc_booking_notes_get_email_contract( $booking_id );

	return array_merge( $replacements, wpbc_booking_notes_project_email_shortcodes( $notes, $email_audience ) );
}

/**
 * Load and request-cache the complete notes contract used by email projections.
 *
 * The complete contract is loaded once so a customer email and its separately
 * rendered administrator copy do not execute duplicate queries. Exposure is
 * still controlled by `wpbc_booking_notes_project_email_shortcodes()`, which
 * always removes the private value from customer replacements.
 *
 * @param int $booking_id Canonical booking ID.
 *
 * @return array<string,array<string,mixed>> Normalized notes contract, or an empty array on failure.
 */
function wpbc_booking_notes_get_email_contract( $booking_id ) {
	static $notes_by_booking = array();

	$booking_id = absint( $booking_id );
	$site_id    = function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0;
	$cache_key  = $site_id . ':' . $booking_id;

	if ( isset( $notes_by_booking[ $cache_key ] ) ) {
		return $notes_by_booking[ $cache_key ];
	}

	$notes_service = new WPBC_Booking_Notes_Service();
	$notes         = $notes_service->get_booking_notes_for_email( $booking_id, true );
	if ( is_wp_error( $notes ) || ! is_array( $notes ) ) {
		$notes = array();
	}

	$notes_by_booking[ $cache_key ] = $notes;

	return $notes_by_booking[ $cache_key ];
}

/**
 * Project normalized notes into the two reserved email shortcode values.
 *
 * This data-only boundary keeps the privacy rule independently testable. Both
 * keys are always returned so unsupported, missing, never-set, and explicitly
 * cleared notes cannot remain as unresolved shortcode text.
 *
 * @param array<string,array<string,mixed>> $notes          Normalized Booking Notes contract.
 * @param string                            $email_audience `administrator` or `customer`.
 *
 * @return array{public_note:string,private_note:string} Safe email values.
 */
function wpbc_booking_notes_project_email_shortcodes( $notes, $email_audience = 'customer' ) {
	$notes                  = is_array( $notes ) ? $notes : array();
	$is_administrator_email = 'administrator' === sanitize_key( (string) $email_audience );
	$shortcode_values       = array(
		'public_note'  => '',
		'private_note' => '',
	);

	if ( ! empty( $notes['public']['supported'] ) && WPBC_Booking_Notes_Service::STATE_VALUE === $notes['public']['state'] ) {
		$shortcode_values['public_note'] = (string) $notes['public']['value'];
	}

	if ( $is_administrator_email && ! empty( $notes['private']['supported'] ) && WPBC_Booking_Notes_Service::STATE_VALUE === $notes['private']['state'] ) {
		$shortcode_values['private_note'] = (string) $notes['private']['value'];
	}

	return $shortcode_values;
}
