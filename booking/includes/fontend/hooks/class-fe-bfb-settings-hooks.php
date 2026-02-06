<?php
/**
 * BFB Settings -> Front-End Booking Form Post-Processing Hooks
 *
 * This file registers hook callbacks that apply **BFB form settings** (decoded JSON settings array) to the final booking form HTML that is rendered on the front-end.
 *
 * These hooks are executed inside `WPBC_FE_Form_Body_Renderer::render()` in this order:
 *
 * 1) `wpbc_booking_form__body_html__before_postprocess`        -->   raw **form body HTML only** (no injected calendar/captcha/extra calendars yet).
 *
 * 2) `wpbc_booking_form__html__before_wrapper`                 -->   composed **form HTML** where calendar/captcha/extra calendars already injected,
 *
 * 3) `wpbc_booking_form__wrapped_html__before_inline_scripts   -->   full **wrapped HTML** including the wrapper `<div class="wpbc_container wpbc_form ...">` and the `<form>` markup
 *
 * 4) `wpbc_booking_form__wrapped_html__after_inline_scripts`   -->   the final HTML after inline scripts are appended.
 *
 * Notes:
 * - `$bfb_settings` is expected to be an array like:
 *   [
 *     'options'       => [ 'booking_form_theme' => 'wpbc_theme_dark_1', ... ],
 *     'css_vars' => [ '--wpbc-bfb-form-max-width' => '430px', ... ]
 *   ]
 *
 * @package Booking Calendar
 * @since   11.0.x
 * @file    ../includes/fontend/hooks/class-fe-bfb-settings-hooks.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Inject per-form CSS variables into the BFB form root wrapper.   On Step 1.
 *
 * Purpose:
 * - If the form body contains the BFB root element (class `wpbc_bfb_form`),
 *   inject CSS Custom Properties (variables) into its `style` attribute.
 *
 * This hook must run **before** legacy post-processing inserts calendars/captcha, because it targets the BFB body root and should not depend on wrapper existence.
 *
 * Expected `$bfb_settings` format:  - `$bfb_settings['css_vars']` is an associative array: `--var-name` => `value`.
 *
 * @since  11.0.x
 *
 * @param string $form_html               Raw booking form body HTML (no calendar/captcha injected yet).
 * @param array  $bfb_settings            Decoded BFB settings array (may be empty).
 * @param int    $resource_id             Booking resource ID.
 * @param string $custom_booking_form_name Booking form slug/name (legacy: "standard").
 *
 * @return string Filtered body HTML.
 */
function wpbc_booking_form__body_html__before_postprocess__apply_css_vars( $form_html, $bfb_settings, $resource_id, $custom_booking_form_name ) {

	$form_html    = (string) $form_html;
	$bfb_settings = is_array( $bfb_settings ) ? $bfb_settings : array();

	// Nothing to apply.
	if ( empty( $bfb_settings['css_vars'] ) || ! is_array( $bfb_settings['css_vars'] ) ) {
		return $form_html;
	}

	// Injector not available.
	if ( ! class_exists( 'WPBC_FE_Form_Style_Injector' ) ) {
		return $form_html;
	}

	// Inject only if a BFB root exists inside the body.
	return WPBC_FE_Form_Style_Injector::inject_css_vars_into_bfb_root( $form_html, $bfb_settings['css_vars'] );
}
add_filter( 'wpbc_booking_form__body_html__before_postprocess', 'wpbc_booking_form__body_html__before_postprocess__apply_css_vars', 10, 4 );


/**
 * Apply a "theme" CSS class to the main booking form wrapper container.   On Step 3.
 *
 * Purpose:
 * - Add `$bfb_settings['options']['booking_form_theme']` as an extra class to the FIRST wrapper container:
 *   `<div class="... wpbc_container wpbc_form ...">`
 *
 * Why here:
 * - The wrapper container does not exist until `WPBC_FE_Form_Wrapper::wrap()` runs, therefore this must be executed on the wrapped HTML stage.
 *
 * Potential limitations:
 * - This implementation supports a **single** class value. If you plan to support multiple
 *   classes in one setting (space-separated), you should split and sanitize each class.
 *
 * @since  11.0.x
 *
 * @param string $wrapped_html            Fully wrapped booking form HTML (before inline scripts appended).
 * @param array  $bfb_settings            Decoded BFB settings array (may be empty).
 * @param int    $resource_id             Booking resource ID.
 * @param string $custom_booking_form_name Booking form slug/name (legacy: "standard").
 *
 * @return string Filtered wrapped HTML.
 */
function wpbc_booking_form__wrapped_html__before_inline_scripts__apply_theme_class( $wrapped_html, $bfb_settings, $resource_id, $custom_booking_form_name ) {

	$wrapped_html = (string) $wrapped_html;
	$bfb_settings = is_array( $bfb_settings ) ? $bfb_settings : array();

	if ( empty( $bfb_settings['options']['booking_form_theme'] ) ) {
		return $wrapped_html;
	}

	// Get theme class(es).
	$raw_theme     = trim( (string) $bfb_settings['options']['booking_form_theme'] );
	$theme_class_arr = array(); // token => true .
	$parts = preg_split( '/\s+/', $raw_theme, - 1, PREG_SPLIT_NO_EMPTY );
	foreach ( $parts as $part ) {
		$tok = sanitize_html_class( (string) $part );
		if ( '' === $tok ) { continue; }
		$theme_class_arr[ $tok ] = true;
	}
	$theme_class_arr = array_keys( $theme_class_arr );
	if ( empty( $theme_class_arr ) ) {
		return $wrapped_html;
	}


	/**
	 * Find the first wrapper container:
	 * <div class="... wpbc_container wpbc_form ...">
	 *
	 * BUG CHECK:
	 * - The pattern is "tempered" to find the class attribute containing both tokens.
	 * - It does not require order (wpbc_container can appear before/after wpbc_form).
	 * - It matches the opening <div ...> tag only.
	 */
	$pattern = '/<div\b[^>]*\bclass\s*=\s*(["\'])(?:(?!\1).)*\bwpbc_container\b(?:(?!\1).)*\bwpbc_form\b(?:(?!\1).)*\1[^>]*>/i';

	return preg_replace_callback( $pattern, function ( $m ) use ( $theme_class_arr ) {

		$tag = $m[0];

		if ( preg_match( '/\bclass\s*=\s*(["\'])(.*?)\1/i', $tag, $cm ) ) {

			$quote   = $cm[1];
			$classes = (string) $cm[2];

			// Optional but recommended: remove any existing wpbc_theme_* to avoid conflicts.
			$classes = preg_replace( '/\bwpbc_theme_[A-Za-z0-9_-]+\b/', '', $classes );
			$classes = trim( preg_replace( '/\s+/', ' ', $classes ) );

			// Add missing theme tokens.
			foreach ( $theme_class_arr as $tok ) {
				if ( false === strpos( ' ' . $classes . ' ', ' ' . $tok . ' ' ) ) {
					$classes = trim( $classes . ' ' . $tok );
				}
			}

			$tag = preg_replace( '/\bclass\s*=\s*(["\'])(.*?)\1/i', 'class=' . $quote . esc_attr( $classes ) . $quote, $tag, 1 );
		}

		return $tag;
	}, $wrapped_html, 1 );

}
add_filter( 'wpbc_booking_form__wrapped_html__before_inline_scripts', 'wpbc_booking_form__wrapped_html__before_inline_scripts__apply_theme_class', 10, 4 );
