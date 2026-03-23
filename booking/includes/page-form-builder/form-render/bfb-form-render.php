<?php
/**
 * Universal Booking Form shortcode renderer.
 *
 * @package     Booking Calendar.
 * @author      wpdevelop, oplugins
 * @web-site    https://wpbookingcalendar.com/
 * @email       info@wpbookingcalendar.com
 *
 * @modified    2025-12-08
 * @version     1.0
 * @file: includes/page-form-builder/form-render/bfb-form-render.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Universal Booking Form shortcode renderer.
 *
 * - Safe to call from widgets, shortcodes, preview service, etc.
 *
 * @param string $form Raw booking form markup with shortcodes.
 * @param array  $args {
 *     Optional. Rendering context.
 *
 *     @type int|string $booking_type         Booking resource ID.
 *     @type array      $current_edit_booking Parsed booking data for "edit booking" mode.
 * }
 * @return string Parsed HTML of the booking form.
 */
function wpbc_render_booking_form_shortcodes( $form, $args = array(), $req = array() ) {

	if ( ! is_string( $form ) || $form === '' ) {
		return '';
	}

	$defaults = array(
		'booking_type'         => 1,
		'current_edit_booking' => array(),
	);

	$args = wp_parse_args( $args, $defaults );

	$req = wp_parse_args(
		$req,
		array(
			'resource_id'             => (int) $args['booking_type'],
			'current_resource_id'     => (int) $args['booking_type'],
			'form_slug'               => 'standard',
			'current_edit_booking'    => array(),
			'current_edit_booking_id' => false,
		)
	);

	// Graceful fallback if engine is not loaded for some reason.
	if ( ! class_exists( 'WPBC_BFB_FormShortcodeEngine' )  ) {
		return $form;
	}

	$engine = new WPBC_BFB_FormShortcodeEngine();

	// Info: Hook for addons. Filter the engine instance before assigning context. Allows 3rd-party add-ons to wrap / extend the engine.
	$engine = apply_filters( 'wpbc_booking_form_shortcode_engine', $engine, $form, $args );

	// === Pass runtime context regarding,  booking editing ===
	$engine->current_resource_id  = (string) $req['current_resource_id'];
	$engine->current_edit_booking = isset( $req['current_edit_booking'] ) ? (array) $req['current_edit_booking'] : array();

	// Info: Hook for addons. Filter raw form content just before shortcode parsing.
	$form = apply_filters( 'wpbc_booking_form_content__before_shortcodes', $form, $args );

	// === Engine render ===
	$html = $engine->render( $form );

	// Re-update HINT shortcodes: [cost_hint], ... add JS for Conditional sections: [condition name="weekday-condition" type="weekday" value="*"] ...  [/condition] .
	$html = apply_bk_filter( 'wpbc_update_bookingform_content__after_load', $html, $engine->current_resource_id, $req['form_slug'] );

	// Re-update other hints,  such  as availability times hint.
	// $html = apply_filters( 'wpbc_booking_form_content__after_load', $html, $engine->current_resource_id, $req['form_slug'] ); // FixIn: 2026-02-20 18:38  runed twice

	/**
	 *  Replace these shortcodes:
	 * 0 = "/\[bookingresource\s*show='id'\s*]/"
	 * 1 = "/\[bookingresource\s*show='title'\s*]/"
	 * 2 = "/\[bookingresource\s*show='cost'\s*]/"
	 * 3 = "/\[bookingresource\s*show='capacity'\s*]/"
	 * 4 = "/\[bookingresource\s*show='maxvisitors'\s*]/"
	 */
	$html = wpbc_replace_bookingresource_info_in_form( $html, $engine->current_resource_id );

	// Is this parameter used anywhere ?
	if ( false !== $req['current_edit_booking_id'] ) {
		$html .= '<input name="edit_booking_id"  id="edit_booking_id" type="hidden" value="' . esc_attr( $req['current_edit_booking_id'] ) . '">';
	}

	// This parameter used for update AJX cost hints and during creation  of booking.
	if ( 'standard' !== $req['form_slug'] ) {
		$html .= '<input name="booking_form_type' . intval( $req['resource_id'] ) . '"  id="booking_form_type' . intval( $req['resource_id'] ) . '" type="hidden" value="' . esc_attr( $req['form_slug'] ) . '">';
	}

	// -- Selecting Dates in Calendar ------------------------------------------------------------------
	if ( false !== $req['current_edit_booking_id'] ) {
		$html .= wpbc_get_dates_selection_js_code( $engine->current_edit_booking['dates'], $req['resource_id'] );    // FixIn: 9.2.3.4.
	}

	// -----------------------------------------------------------------------------------------------------------------
	// Prevent editing, if booked dates already in the past. (Front-end only).
	// -----------------------------------------------------------------------------------------------------------------
	$admin_uri = ltrim( str_replace( get_site_url( null, '', 'admin' ), '', admin_url( 'admin.php?' ) ), '/' );        // FixIn: 8.8.1.2.

	$server_request_uri = ( ( isset( $_SERVER['REQUEST_URI'] ) ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '' );

	if ( strpos( $server_request_uri, $admin_uri ) === false ) {            // Only in front-end side.
		if ( false !== $req['current_edit_booking_id'] ) {
			foreach ( $engine->current_edit_booking['dates'] as $b_date ) {
				if ( wpbc_is_date_in_past( $b_date ) ) {
					$html = '<div class="wpdevelop"><div class="alert alert-warning alert-danger">' .
							__( 'The booked dates already in the past', 'booking' ) .
							'</div></div>' .
							'<script type="text/javascript">setTimeout( function(){ jQuery( ".hasDatepick" ).hide(); }, 500 );</script>';
				}
			}
		}
	}

	$html = apply_filters( 'wpbc_replace_shortcodes_in_booking_form', $html, $engine->current_resource_id, $req['form_slug'] );            // FixIn: 9.4.3.6.

	// Info: Hook for addons. Filter parsed HTML right after shortcode parsing, but before  legacy filters like wpbc_update_bookingform_content__after_load.
	$html = apply_filters( 'wpbc_booking_form_content__after_shortcodes', $html, $args );

	return $html;
}
