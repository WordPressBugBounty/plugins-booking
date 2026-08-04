<?php
/**
 * Scoped Booking Form Style integration for the Appointment selector.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return Form Style variables consumed by the Appointment interface.
 *
 * Keeping a strict whitelist prevents unrelated Booking Form variables from
 * entering the Appointment scope. The native form keeps its existing complete
 * and independently injected Form Style configuration.
 *
 * @return array<int,string> CSS custom-property names.
 */
function wpbc_booking_appointment_get_theme_css_var_names() {
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
		'--wpbc_form-accent-contrast-color',
		'--wpbc-appointment-provider-avatar-background',
		'--wpbc-appointment-provider-avatar-border-color',
		'--wpbc-appointment-provider-avatar-text-color',
		'--wpbc_form-button-primary-hover-border-color',
	);
}

/**
 * Resolve the whitelisted Appointment theme variables from global Form Style.
 *
 * @return array<string,string> Values sanitized later during CSS serialization.
 */
function wpbc_booking_appointment_get_theme_css_vars() {
	if (
		! function_exists( 'wpbc_bfb_settings__get_current_form_style' )
		|| ! function_exists( 'wpbc_bfb_settings__get_form_style_css_vars' )
	) {
		return array();
	}

	$style      = wpbc_bfb_settings__get_current_form_style();
	$form_vars  = wpbc_bfb_settings__get_form_style_css_vars( $style );
	$allowed    = array_fill_keys( wpbc_booking_appointment_get_theme_css_var_names(), true );
	$theme_vars = array_intersect_key( is_array( $form_vars ) ? $form_vars : array(), $allowed );
	$theme_vars = apply_filters( 'wpbc_booking_appointment_theme_css_vars', $theme_vars, $style );

	return array_intersect_key( is_array( $theme_vars ) ? $theme_vars : array(), $allowed );
}

/**
 * Sanitize one CSS custom-property value for a generated declaration.
 *
 * @param mixed $value Candidate CSS value.
 *
 * @return string Safe value or an empty string.
 */
function wpbc_booking_appointment_sanitize_theme_css_value( $value ) {
	$value = is_scalar( $value ) ? trim( (string) $value ) : '';
	if ( '' === $value ) {
		return '';
	}

	$value = str_replace(
		array( ';', '{', '}', '"', "'", '<', '>', "\n", "\r", "\0" ),
		'',
		$value
	);

	return trim( $value );
}

/**
 * Build the single page-level CSS rule used by Appointment theme scopes.
 *
 * @return string Safe scoped CSS, or an empty string when styles are unavailable.
 */
function wpbc_booking_appointment_build_theme_css() {
	$declarations = '';
	foreach ( wpbc_booking_appointment_get_theme_css_vars() as $name => $value ) {
		$value = wpbc_booking_appointment_sanitize_theme_css_value( $value );
		if ( '' !== $value ) {
			$declarations .= $name . ':' . $value . ';';
		}
	}

	if ( '' === $declarations ) {
		return '';
	}

	return '.wpbc_booking_ui_theme_scope,.wpbc_booking_appointment__loading{' . $declarations . '}';
}
