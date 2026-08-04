<?php
/**
 * Scoped Booking Form Style integration for the Booking Resource selector.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return Form Style variables consumed by the resource selection interface.
 *
 * @return string[] CSS custom-property names.
 */
function wpbc_booking_resource_selector_get_theme_css_var_names() {
	return array(
		'--wpbc-bfb-form-background',
		'--wpbc-bfb-form-border-color',
		'--wpbc-bfb-form-border-width',
		'--wpbc-bfb-form-border-radius',
		'--wpbc-bfb-form-padding',
		'--wpbc-bfb-form-box-shadow',
		'--wpbc_form-label-color',
		'--wpbc_form-label-sublabel-color',
		'--wpbc_form-label-error-color',
		'--wpbc_form-field-background-color',
		'--wpbc_form-field-text-color',
		'--wpbc_form-field-border-color',
		'--wpbc_form-field-border-radius',
		'--wpbc_form-field-focus-border-color',
		'--wpbc_form-field-focus-shadow-color',
		'--wpbc_form-choice-checked-border-color',
		'--wpbc_form-choice-focus-color',
		'--wpbc_form-button-border-radius',
		'--wpbc_form-button-border-style',
		'--wpbc_form-button-border-size',
		'--wpbc_form-button-background-color',
		'--wpbc_form-button-background-color-alt',
		'--wpbc_form-button-border-color',
		'--wpbc_form-button-primary-border-style',
		'--wpbc_form-button-text-color',
		'--wpbc_form-button-hover-background-color',
		'--wpbc_form-button-hover-border-color',
		'--wpbc_form-button-hover-text-color',
		'--wpbc_form-button-light-background-color',
		'--wpbc_form-button-light-border-color',
		'--wpbc_form-button-light-border-style',
		'--wpbc_form-button-light-border-size',
		'--wpbc_form-button-light-text-color',
		'--wpbc_form-button-light-box-shadow',
		'--wpbc_form-button-light-hover-background-color',
		'--wpbc_form-button-light-hover-border-color',
		'--wpbc_form-button-light-hover-text-color',
		'--wpbc_form-button-light-hover-box-shadow',
		'--wpbc_form-button-primary-hover-border-color',
		'--wpbc_form-accent-contrast-color',
	);
}

/**
 * Resolve whitelisted selector variables from the active Booking Form Style.
 *
 * @return array<string,string> Theme values sanitized during serialization.
 */
function wpbc_booking_resource_selector_get_theme_css_vars() {
	if ( ! function_exists( 'wpbc_bfb_settings__get_current_form_style' ) || ! function_exists( 'wpbc_bfb_settings__get_form_style_css_vars' ) ) {
		return array();
	}

	$form_style = wpbc_bfb_settings__get_current_form_style();
	$form_vars  = wpbc_bfb_settings__get_form_style_css_vars( $form_style );
	$allowed    = array_fill_keys( wpbc_booking_resource_selector_get_theme_css_var_names(), true );
	$theme_vars = array_intersect_key( is_array( $form_vars ) ? $form_vars : array(), $allowed );
	$theme_vars = apply_filters( 'wpbc_booking_resource_selector_theme_css_vars', $theme_vars, $form_style );

	return array_intersect_key( is_array( $theme_vars ) ? $theme_vars : array(), $allowed );
}

/**
 * Sanitize one CSS custom-property value for generated inline CSS.
 *
 * @param mixed $css_value Candidate CSS value.
 *
 * @return string Safe CSS value or an empty string.
 */
function wpbc_booking_resource_selector_sanitize_theme_css_value( $css_value ) {
	$css_value = is_scalar( $css_value ) ? trim( (string) $css_value ) : '';
	if ( '' === $css_value ) {
		return '';
	}

	$css_value = str_replace( array( ';', '{', '}', '"', "'", '<', '>', "\n", "\r", "\0" ), '', $css_value );

	return trim( $css_value );
}

/**
 * Build one page-level CSS rule for selector theme scopes.
 *
 * @return string Safe scoped CSS, or an empty string when unavailable.
 */
function wpbc_booking_resource_selector_build_theme_css() {
	$declarations = '';
	foreach ( wpbc_booking_resource_selector_get_theme_css_vars() as $property_name => $property_value ) {
		$property_value = wpbc_booking_resource_selector_sanitize_theme_css_value( $property_value );
		if ( '' !== $property_value ) {
			$declarations .= $property_name . ':' . $property_value . ';';
		}
	}

	if ( '' === $declarations ) {
		return '';
	}

	return '.wpbc_booking_resource_selector .wpbc_booking_ui_theme_scope,.wpbc_booking_resource_selector__loading{' . $declarations . '}';
}
