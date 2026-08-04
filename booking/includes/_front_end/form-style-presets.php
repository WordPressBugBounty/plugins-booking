<?php
/**
 * Booking form style presets.
 *
 * This file is the shared registry for the global form style model.
 *
 * @package Booking Calendar
 * @since   11.4.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Get default global form style key.
 *
 * @return string
 */
function wpbc_bfb_settings__get_default_form_style() {

	return 'light_bordered';
}

/**
 * Get default values for the optional global accent overlay.
 *
 * The overlay is disabled by default so upgrading does not change the visual
 * output of an existing booking form.
 *
 * @return array
 */
function wpbc_bfb_settings__get_default_form_accent_options() {

	return array(
		'booking_form_accent_enabled' => 'Off',
		'booking_form_accent_color'   => WPBC_DEFAULT_FORM_ACCENT_COLOR,
	);
}

/**
 * Get default values for the global custom form style.
 *
 * @return array
 */
function wpbc_bfb_settings__get_default_custom_form_style_options() {

	return array(
		'booking_form_custom_background_color'       => '#ffffff',
		'booking_form_custom_border_color'           => '#cccccc',
		'booking_form_custom_border_width'           => '1px',
		'booking_form_custom_border_radius'          => '2px',
		'booking_form_custom_padding_vertical'       => '10px',
		'booking_form_custom_padding_horizontal'     => '30px',
		'booking_form_custom_text_color'             => '#1d2327',
		'booking_form_custom_field_background_color' => '#ffffff',
		'booking_form_custom_field_text_color'       => '#3c434a',
		'booking_form_custom_field_border_color'     => '#cccccc',
		'booking_form_custom_button_background_color' => '#066aab',
		'booking_form_custom_button_text_color'       => '#ffffff',
		'booking_form_custom_button_border_color'     => '#066aab',
		'booking_form_custom_button_hover_background_color' => '#055589',
		'booking_form_custom_button_hover_text_color' => '#ffffff',
		'booking_form_custom_button_hover_border_color' => '#055589',
		'booking_form_custom_secondary_button_background_color' => '#fdfdfd',
		'booking_form_custom_secondary_button_text_color' => '#444444',
		'booking_form_custom_secondary_button_border_color' => '#eeeeee',
		'booking_form_custom_secondary_button_hover_background_color' => '#fdfdfd',
		'booking_form_custom_secondary_button_hover_text_color' => '#444444',
		'booking_form_custom_secondary_button_hover_border_color' => '#4d91cd',
		'booking_form_custom_button_border_width'      => '1px',
		'booking_form_custom_button_border_radius'     => '3px',
	);
}

/**
 * Get CSS variable names owned by the global Form Style feature.
 *
 * Keep this list synchronized with the preset arrays and live preview cleanup.
 *
 * @return array
 */
function wpbc_bfb_settings__get_form_style_css_var_names() {

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
		'--wpbc_form-field-menu-color',
		'--wpbc_form-field-text-color',
		'--wpbc_form-field-border-color',
		'--wpbc_form-field-border-color-spare',
		'--wpbc_form-field-focus-border-color',
		'--wpbc_form-field-focus-shadow-color',
		'--wpbc_form-field-disabled-color',
		'--wpbc_form-choice-checked-border-color',
		'--wpbc_form-choice-checked-color',
		'--wpbc_form-choice-focus-color',
		'--wpbc_form-button-border-radius',
		'--wpbc_form-button-border-style',
		'--wpbc_form-button-border-size',
		'--wpbc_form-button-background-color',
		'--wpbc_form-button-background-color-alt',
		'--wpbc_form-button-border-color',
		'--wpbc_form-button-primary-border-style',
		'--wpbc_form-button-text-color',
		'--wpbc_form-button-text-color-alt',
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
		'--wpbc-appointment-provider-avatar-background',
		'--wpbc-appointment-provider-avatar-border-color',
		'--wpbc-appointment-provider-avatar-text-color',
		'--wpbc_form-button-primary-hover-border-color',
		'--wpbc_form-page-break-color',
		'--wpbc_form-accent-color',
		'--wpbc_form-accent-hover-color',
		'--wpbc_form-accent-contrast-color',
		'--wpbc_timepicker-hover-border-color',
		'--wpbc_timepicker-selected-bg-color',
		'--wpbc_timepicker-selected-text-color',
		'--wpbc_timepicker-selected-border-color',
	);
}

/**
 * Get the global form style preset registry.
 *
 * Each preset owns its container, text, field, and button tokens so a new
 * Form Style can be added in one registry.
 *
 * @return array
 */
function wpbc_bfb_settings__get_form_style_presets() {

	$default_button_geometry = array(
		'--wpbc_form-button-border-radius'       => '3px',
		'--wpbc_form-button-border-style'        => 'none',
		'--wpbc_form-button-border-size'         => '1px',
		'--wpbc_form-button-primary-border-style' => 'none',
		'--wpbc_form-button-light-border-style'  => 'solid',
		'--wpbc_form-button-light-border-size'   => '1px',
	);

	$presets = array(
		'light_bordered' => array(
			'title'           => __( 'Light bordered', 'booking' ),
			'theme_class'     => '',
			'container_style' => 'bordered',
			'custom'          => false,
			'css_vars'        => array(
				'--wpbc-bfb-form-background'                 => '#ffffff',
				'--wpbc-bfb-form-border-color'               => '#cccccc',
				'--wpbc-bfb-form-border-width'               => '1px',
				'--wpbc-bfb-form-border-radius'              => '2px',
				'--wpbc-bfb-form-padding'                    => '10px 30px',
				'--wpbc-bfb-form-box-shadow'                 => 'rgba(0, 0, 0, 0.05) 0px 2px 6px 0px',
				'--wpbc_form-label-color'                    => 'rgba(0, 0, 0, 0.85)',
				'--wpbc_form-label-sublabel-color'           => 'rgba(0, 0, 0, 0.55)',
				'--wpbc_form-label-error-color'              => '#d63637',
				'--wpbc_form-field-background-color'         => '#ffffff',
				'--wpbc_form-field-border-color'             => 'rgba(0, 0, 0, 0.25)',
				'--wpbc_form-field-border-color-spare'       => 'rgba(0, 0, 0, 0.25)',
				'--wpbc_form-field-focus-border-color'       => '#066aab',
				'--wpbc_form-field-focus-shadow-color'       => '#066aab',
				'--wpbc_form-field-text-color'               => 'rgba(0, 0, 0, 0.7)',
				'--wpbc_form-field-disabled-color'           => 'rgba(0, 0, 0, 0.2)',
				'--wpbc_form-field-menu-color'               => '#ffffff',
				'--wpbc_form-button-background-color'        => '#066aab',
				'--wpbc_form-button-background-color-alt'    => '#066aab',
				'--wpbc_form-button-border-color'            => '#066aab',
				'--wpbc_form-button-text-color'              => '#ffffff',
				'--wpbc_form-button-text-color-alt'          => '#ffffff',
				'--wpbc_form-choice-checked-border-color'    => '#066aab',
				'--wpbc_form-choice-checked-color'           => '#066aab',
				'--wpbc_form-choice-focus-color'             => '#066aab',
				'--wpbc_form-button-light-background-color'  => '#fdfdfd',
				'--wpbc_form-button-light-border-color'      => '#cacacab5',
				'--wpbc_form-button-light-text-color'        => '#444444e0',
				'--wpbc_form-button-light-box-shadow'        => '0 2px 10px 2px #ffffff54',
				'--wpbc_form-button-light-hover-background-color' => '#fdfdfd',
				'--wpbc_form-button-light-hover-border-color' => 'rgb(77, 145, 205)',
				'--wpbc_form-button-light-hover-text-color'  => '#444444e0',
				'--wpbc_form-button-light-hover-box-shadow'  => '0 2px 10px 2px #ffffff54',
				'--wpbc_form-button-primary-hover-border-color' => '#ffffff',
				'--wpbc_form-page-break-color'               => '#066aab',
			),
		),
		'light_none'     => array(
			'title'           => __( 'Light no border', 'booking' ),
			'theme_class'     => '',
			'container_style' => 'none',
			'custom'          => false,
			'css_vars'        => array(
				'--wpbc-bfb-form-background'                 => 'transparent',
				'--wpbc-bfb-form-border-color'               => 'transparent',
				'--wpbc-bfb-form-border-width'               => '0px',
				'--wpbc-bfb-form-border-radius'              => '0px',
				'--wpbc-bfb-form-padding'                    => '0px',
				'--wpbc-bfb-form-box-shadow'                 => 'none',
				'--wpbc_form-label-color'                    => 'rgba(0, 0, 0, 0.85)',
				'--wpbc_form-label-sublabel-color'           => 'rgba(0, 0, 0, 0.55)',
				'--wpbc_form-label-error-color'              => '#d63637',
				'--wpbc_form-field-background-color'         => '#ffffff',
				'--wpbc_form-field-border-color'             => 'rgba(0, 0, 0, 0.25)',
				'--wpbc_form-field-border-color-spare'       => 'rgba(0, 0, 0, 0.25)',
				'--wpbc_form-field-focus-border-color'       => '#066aab',
				'--wpbc_form-field-focus-shadow-color'       => '#066aab',
				'--wpbc_form-field-text-color'               => 'rgba(0, 0, 0, 0.7)',
				'--wpbc_form-field-disabled-color'           => 'rgba(0, 0, 0, 0.2)',
				'--wpbc_form-field-menu-color'               => '#ffffff',
				'--wpbc_form-button-background-color'        => '#066aab',
				'--wpbc_form-button-background-color-alt'    => '#066aab',
				'--wpbc_form-button-border-color'            => '#066aab',
				'--wpbc_form-button-text-color'              => '#ffffff',
				'--wpbc_form-button-text-color-alt'          => '#ffffff',
				'--wpbc_form-choice-checked-border-color'    => '#066aab',
				'--wpbc_form-choice-checked-color'           => '#066aab',
				'--wpbc_form-choice-focus-color'             => '#066aab',
				'--wpbc_form-button-light-background-color'  => '#fdfdfd',
				'--wpbc_form-button-light-border-color'      => '#cacacab5',
				'--wpbc_form-button-light-text-color'        => '#444444e0',
				'--wpbc_form-button-light-box-shadow'        => '0 2px 10px 2px #ffffff54',
				'--wpbc_form-button-light-hover-background-color' => '#fdfdfd',
				'--wpbc_form-button-light-hover-border-color' => 'rgb(77, 145, 205)',
				'--wpbc_form-button-light-hover-text-color'  => '#444444e0',
				'--wpbc_form-button-light-hover-box-shadow'  => '0 2px 10px 2px #ffffff54',
				'--wpbc_form-button-primary-hover-border-color' => '#ffffff',
				'--wpbc_form-page-break-color'               => '#066aab',
			),
		),
		'light_soft'     => array(
			'title'           => __( 'Light soft background', 'booking' ),
			'theme_class'     => '',
			'container_style' => 'soft',
			'custom'          => false,
			'css_vars'        => array(
				'--wpbc-bfb-form-background'                 => '#f9f9fa',
				'--wpbc-bfb-form-border-color'               => '#ffffff',
				'--wpbc-bfb-form-border-width'               => '3px',
				'--wpbc-bfb-form-border-radius'              => '8px',
				'--wpbc-bfb-form-padding'                    => '20px',
				'--wpbc-bfb-form-box-shadow'                 => 'rgba(15, 23, 42, 0.06) 0px 4px 16px 0px',
				'--wpbc_form-label-color'                    => 'rgba(0, 0, 0, 0.85)',
				'--wpbc_form-label-sublabel-color'           => 'rgba(0, 0, 0, 0.55)',
				'--wpbc_form-label-error-color'              => '#d63637',
				'--wpbc_form-field-background-color'         => '#ffffff',
				'--wpbc_form-field-border-color'             => 'rgba(0, 0, 0, 0.25)',
				'--wpbc_form-field-border-color-spare'       => 'rgba(0, 0, 0, 0.25)',
				'--wpbc_form-field-focus-border-color'       => '#066aab',
				'--wpbc_form-field-focus-shadow-color'       => '#066aab',
				'--wpbc_form-field-text-color'               => 'rgba(0, 0, 0, 0.7)',
				'--wpbc_form-field-disabled-color'           => 'rgba(0, 0, 0, 0.2)',
				'--wpbc_form-field-menu-color'               => '#ffffff',
				'--wpbc_form-button-background-color'        => '#066aab',
				'--wpbc_form-button-background-color-alt'    => '#066aab',
				'--wpbc_form-button-border-color'            => '#066aab',
				'--wpbc_form-button-text-color'              => '#ffffff',
				'--wpbc_form-button-text-color-alt'          => '#ffffff',
				'--wpbc_form-choice-checked-border-color'    => '#066aab',
				'--wpbc_form-choice-checked-color'           => '#066aab',
				'--wpbc_form-choice-focus-color'             => '#066aab',
				'--wpbc_form-button-light-background-color'  => '#fdfdfd',
				'--wpbc_form-button-light-border-color'      => '#cacacab5',
				'--wpbc_form-button-light-text-color'        => '#444444e0',
				'--wpbc_form-button-light-box-shadow'        => '0 2px 10px 2px #ffffff54',
				'--wpbc_form-button-light-hover-background-color' => '#fdfdfd',
				'--wpbc_form-button-light-hover-border-color' => 'rgb(77, 145, 205)',
				'--wpbc_form-button-light-hover-text-color'  => '#444444e0',
				'--wpbc_form-button-light-hover-box-shadow'  => '0 2px 10px 2px #ffffff54',
				'--wpbc_form-button-primary-hover-border-color' => '#ffffff',
				'--wpbc_form-page-break-color'               => '#066aab',
			),
		),
		'dark_bordered'  => array(
			'title'           => __( 'Dark bordered', 'booking' ),
			'theme_class'     => 'wpbc_theme_dark_1',
			'container_style' => 'bordered',
			'custom'          => false,
			'css_vars'        => array(
				'--wpbc-bfb-form-background'                 => '#383a3d',
				'--wpbc-bfb-form-border-color'               => '#000000',
				'--wpbc-bfb-form-border-width'               => '1px',
				'--wpbc-bfb-form-border-radius'              => '2px',
				'--wpbc-bfb-form-padding'                    => '10px 30px',
				'--wpbc-bfb-form-box-shadow'                 => '0 0px 3px #3b3b3b',
				'--wpbc_form-label-color'                    => '#f4f6f8',
				'--wpbc_form-label-sublabel-color'           => 'rgba(255, 255, 255, 0.72)',
				'--wpbc_form-label-error-color'              => '#ff8a8a',
				'--wpbc_form-field-background-color'         => '#3f454f',
				'--wpbc_form-field-border-color'             => 'rgba(255, 255, 255, 0.28)',
				'--wpbc_form-field-border-color-spare'       => 'rgba(255, 255, 255, 0.28)',
				'--wpbc_form-field-focus-border-color'       => '#5b8bff',
				'--wpbc_form-field-focus-shadow-color'       => '#5b8bff',
				'--wpbc_form-field-text-color'               => '#f4f6f8',
				'--wpbc_form-field-disabled-color'           => 'rgba(255, 255, 255, 0.35)',
				'--wpbc_form-field-menu-color'               => '#303640',
				'--wpbc_form-button-background-color'        => '#1b1d22',
				'--wpbc_form-button-background-color-alt'    => '#1b1d22',
				'--wpbc_form-button-border-color'            => '#5f5f5f',
				'--wpbc_form-button-primary-border-style'    => 'solid',
				'--wpbc_form-button-text-color'              => '#ffffff',
				'--wpbc_form-button-text-color-alt'          => '#ffffff',
				'--wpbc_form-button-hover-background-color'  => '#1b1d22',
				'--wpbc_form-button-hover-border-color'      => '#5b8bff',
				'--wpbc_form-button-hover-text-color'        => '#ffffff',
				'--wpbc_form-choice-checked-border-color'    => '#5b8bff',
				'--wpbc_form-choice-checked-color'           => '#f4f6f8',
				'--wpbc_form-choice-focus-color'             => '#5b8bff',
				'--wpbc_form-button-light-background-color'  => '#3f454f',
				'--wpbc_form-button-light-border-color'      => '#525252',
				'--wpbc_form-button-light-text-color'        => '#ffffff',
				'--wpbc_form-button-light-box-shadow'        => '0 0 0 #424242',
				'--wpbc_form-button-light-hover-background-color' => '#3f454f',
				'--wpbc_form-button-light-hover-border-color' => '#5b8bff',
				'--wpbc_form-button-light-hover-text-color'  => '#ffffff',
				'--wpbc_form-button-light-hover-box-shadow'  => '0 0 0 #424242',
				'--wpbc-appointment-provider-avatar-background' => '#2C2E2F',
				'--wpbc-appointment-provider-avatar-border-color' => '#525252',
				'--wpbc-appointment-provider-avatar-text-color' => '#ffffff',
				'--wpbc_form-button-primary-hover-border-color' => '#5b8bff',
				'--wpbc_form-page-break-color'               => '#5f9ee7',
			),
		),
		'dark_none'      => array(
			'title'           => __( 'Dark no border', 'booking' ),
			'theme_class'     => 'wpbc_theme_dark_1',
			'container_style' => 'none',
			'custom'          => false,
			'css_vars'        => array(
				'--wpbc-bfb-form-background'                 => 'transparent',
				'--wpbc-bfb-form-border-color'               => 'transparent',
				'--wpbc-bfb-form-border-width'               => '0px',
				'--wpbc-bfb-form-border-radius'              => '0px',
				'--wpbc-bfb-form-padding'                    => '0px',
				'--wpbc-bfb-form-box-shadow'                 => 'none',
				'--wpbc_form-label-color'                    => '#1d2327',
				'--wpbc_form-label-sublabel-color'           => 'rgba(29, 35, 39, 0.72)',
				'--wpbc_form-label-error-color'              => '#d63637',
				'--wpbc_form-field-background-color'         => '#3f454f',
				'--wpbc_form-field-border-color'             => 'rgba(255, 255, 255, 0.28)',
				'--wpbc_form-field-border-color-spare'       => 'rgba(255, 255, 255, 0.28)',
				'--wpbc_form-field-focus-border-color'       => '#5b8bff',
				'--wpbc_form-field-focus-shadow-color'       => '#5b8bff',
				'--wpbc_form-field-text-color'               => '#f4f6f8',
				'--wpbc_form-field-disabled-color'           => 'rgba(255, 255, 255, 0.35)',
				'--wpbc_form-field-menu-color'               => '#303640',
				'--wpbc_form-button-background-color'        => '#1b1d22',
				'--wpbc_form-button-background-color-alt'    => '#1b1d22',
				'--wpbc_form-button-border-color'            => '#5f5f5f',
				'--wpbc_form-button-primary-border-style'    => 'solid',
				'--wpbc_form-button-text-color'              => '#ffffff',
				'--wpbc_form-button-text-color-alt'          => '#ffffff',
				'--wpbc_form-button-hover-background-color'  => '#1b1d22',
				'--wpbc_form-button-hover-border-color'      => '#5b8bff',
				'--wpbc_form-button-hover-text-color'        => '#ffffff',
				'--wpbc_form-choice-checked-border-color'    => '#5b8bff',
				'--wpbc_form-choice-checked-color'           => '#f4f6f8',
				'--wpbc_form-choice-focus-color'             => '#5b8bff',
				'--wpbc_form-button-light-background-color'  => '#3f454f',
				'--wpbc_form-button-light-border-color'      => '#525252',
				'--wpbc_form-button-light-text-color'        => '#ffffff',
				'--wpbc_form-button-light-box-shadow'        => '0 0 0 #424242',
				'--wpbc_form-button-light-hover-background-color' => '#3f454f',
				'--wpbc_form-button-light-hover-border-color' => '#5b8bff',
				'--wpbc_form-button-light-hover-text-color'  => '#ffffff',
				'--wpbc_form-button-light-hover-box-shadow'  => '0 0 0 #424242',
				'--wpbc-appointment-provider-avatar-background' => '#2C2E2F',
				'--wpbc-appointment-provider-avatar-border-color' => '#525252',
				'--wpbc-appointment-provider-avatar-text-color' => '#ffffff',
				'--wpbc_form-button-primary-hover-border-color' => '#5b8bff',
				'--wpbc_form-page-break-color'               => '#5f9ee7',
			),
		),
		'dark_soft'      => array(
			'title'           => __( 'Dark soft background', 'booking' ),
			'theme_class'     => 'wpbc_theme_dark_1',
			'container_style' => 'soft',
			'custom'          => false,
			'css_vars'        => array(
				'--wpbc-bfb-form-background'                 => '#1f2937',
				'--wpbc-bfb-form-border-color'               => '#334155',
				'--wpbc-bfb-form-border-width'               => '3px',
				'--wpbc-bfb-form-border-radius'              => '8px',
				'--wpbc-bfb-form-padding'                    => '20px',
				'--wpbc-bfb-form-box-shadow'                 => 'rgba(0, 0, 0, 0.24) 0px 4px 16px 0px',
				'--wpbc_form-label-color'                    => '#f4f6f8',
				'--wpbc_form-label-sublabel-color'           => 'rgba(255, 255, 255, 0.72)',
				'--wpbc_form-label-error-color'              => '#ff8a8a',
				'--wpbc_form-field-background-color'         => '#3f454f',
				'--wpbc_form-field-border-color'             => 'rgba(255, 255, 255, 0.28)',
				'--wpbc_form-field-border-color-spare'       => 'rgba(255, 255, 255, 0.28)',
				'--wpbc_form-field-focus-border-color'       => '#5b8bff',
				'--wpbc_form-field-focus-shadow-color'       => '#5b8bff',
				'--wpbc_form-field-text-color'               => '#f4f6f8',
				'--wpbc_form-field-disabled-color'           => 'rgba(255, 255, 255, 0.35)',
				'--wpbc_form-field-menu-color'               => '#303640',
				'--wpbc_form-button-background-color'        => '#1b1d22',
				'--wpbc_form-button-background-color-alt'    => '#1b1d22',
				'--wpbc_form-button-border-color'            => '#5f5f5f',
				'--wpbc_form-button-primary-border-style'    => 'solid',
				'--wpbc_form-button-text-color'              => '#ffffff',
				'--wpbc_form-button-text-color-alt'          => '#ffffff',
				'--wpbc_form-button-hover-background-color'  => '#1b1d22',
				'--wpbc_form-button-hover-border-color'      => '#5b8bff',
				'--wpbc_form-button-hover-text-color'        => '#ffffff',
				'--wpbc_form-choice-checked-border-color'    => '#5b8bff',
				'--wpbc_form-choice-checked-color'           => '#f4f6f8',
				'--wpbc_form-choice-focus-color'             => '#5b8bff',
				'--wpbc_form-button-light-background-color'  => '#3f454f',
				'--wpbc_form-button-light-border-color'      => '#525252',
				'--wpbc_form-button-light-text-color'        => '#ffffff',
				'--wpbc_form-button-light-box-shadow'        => '0 0 0 #424242',
				'--wpbc_form-button-light-hover-background-color' => '#3f454f',
				'--wpbc_form-button-light-hover-border-color' => '#5b8bff',
				'--wpbc_form-button-light-hover-text-color'  => '#ffffff',
				'--wpbc_form-button-light-hover-box-shadow'  => '0 0 0 #424242',
				'--wpbc-appointment-provider-avatar-background' => '#2C2E2F',
				'--wpbc-appointment-provider-avatar-border-color' => '#525252',
				'--wpbc-appointment-provider-avatar-text-color' => '#ffffff',
				'--wpbc_form-button-primary-hover-border-color' => '#5b8bff',
				'--wpbc_form-page-break-color'               => '#5f9ee7',
			),
		),
		'custom'         => array(
			'title'           => __( 'Custom', 'booking' ),
			'theme_class'     => '',
			'container_style' => 'custom',
			'custom'          => true,
			'css_vars'        => array(),
		),
	);

	// Presets must explicitly reset geometry left by a previously selected
	// Custom style. This also keeps the live Builder canvas equal to a clean
	// front-end render, where the root defaults are 1px borders and 3px radius.
	foreach ( $presets as $preset_key => $preset ) {
		if ( 'custom' === $preset_key || empty( $preset['css_vars'] ) ) {
			continue;
		}

		$presets[ $preset_key ]['css_vars'] = array_merge( $default_button_geometry, $preset['css_vars'] );
	}

	return $presets;
}

/**
 * Get one form style preset.
 *
 * @param string $style Form style key.
 * @return array
 */
function wpbc_bfb_settings__get_form_style_preset( $style ) {

	$presets = wpbc_bfb_settings__get_form_style_presets();
	$style   = sanitize_key( (string) $style );

	if ( isset( $presets[ $style ] ) ) {
		return $presets[ $style ];
	}

	return $presets[ wpbc_bfb_settings__get_default_form_style() ];
}

/**
 * Sanitize a form style key.
 *
 * @param string $style Form style key.
 * @return string
 */
function wpbc_bfb_settings__sanitize_form_style( $style ) {

	$presets = wpbc_bfb_settings__get_form_style_presets();
	$style   = sanitize_key( (string) $style );

	return isset( $presets[ $style ] ) ? $style : wpbc_bfb_settings__get_default_form_style();
}

/**
 * Get style titles for radio/select controls.
 *
 * @return array
 */
function wpbc_bfb_settings__get_form_style_options() {

	$options = array();

	foreach ( wpbc_bfb_settings__get_form_style_presets() as $style_key => $preset ) {
		$options[ $style_key ] = isset( $preset['title'] ) ? $preset['title'] : $style_key;
	}

	return $options;
}

/**
 * Get the currently selected global form style.
 *
 * @return string
 */
function wpbc_bfb_settings__get_current_form_style() {

	$style = function_exists( 'get_bk_option' ) ? get_bk_option( 'booking_form_style' ) : '';

	return wpbc_bfb_settings__sanitize_form_style( $style );
}

/**
 * Check whether a style key is the Custom style.
 *
 * @param string $style Form style key.
 * @return bool
 */
function wpbc_bfb_settings__is_custom_form_style( $style ) {

	return ( 'custom' === wpbc_bfb_settings__sanitize_form_style( $style ) );
}

/**
 * Sanitize CSS color values used by global form style options.
 *
 * @param string $value    Raw value.
 * @param string $fallback Fallback value.
 * @return string
 */
function wpbc_bfb_settings__sanitize_form_style_color( $value, $fallback ) {

	$value = trim( (string) $value );

	if ( preg_match( '/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i', $value ) || 'transparent' === $value ) {
		return $value;
	}

	return $fallback;
}

/**
 * Sanitize an opaque hexadecimal accent color.
 *
 * Unlike container colors, an accent cannot be transparent because it is
 * used to calculate hover and readable foreground colors.
 *
 * @param string $value    Raw value.
 * @param string $fallback Fallback value.
 * @return string
 */
function wpbc_bfb_settings__sanitize_form_accent_color( $value, $fallback = WPBC_DEFAULT_FORM_ACCENT_COLOR ) {

	$value = trim( (string) $value );

	return preg_match( '/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i', $value ) ? $value : $fallback;
}

/**
 * Get sanitized global accent settings.
 *
 * @param array $options Optional raw override values.
 * @return array
 */
function wpbc_bfb_settings__get_form_accent_options( $options = array() ) {

	$defaults = wpbc_bfb_settings__get_default_form_accent_options();
	$options  = is_array( $options ) ? $options : array();
	$values   = array();

	foreach ( $defaults as $key => $fallback ) {
		if ( array_key_exists( $key, $options ) ) {
			$values[ $key ] = $options[ $key ];
		} elseif ( function_exists( 'get_bk_option' ) ) {
			$values[ $key ] = get_bk_option( $key );
		} else {
			$values[ $key ] = $fallback;
		}
	}

	return array(
		'booking_form_accent_enabled' => ( 'On' === (string) $values['booking_form_accent_enabled'] ) ? 'On' : 'Off',
		'booking_form_accent_color'   => wpbc_bfb_settings__sanitize_form_accent_color( $values['booking_form_accent_color'], $defaults['booking_form_accent_color'] ),
	);
}

/**
 * Mix a hexadecimal color with black or white.
 *
 * @param string $hex        Six-digit hexadecimal color.
 * @param string $mix_hex    Six-digit hexadecimal target color.
 * @param float  $percentage Mix amount from 0 through 1.
 * @return string
 */
function wpbc_bfb_settings__mix_form_style_colors( $hex, $mix_hex, $percentage ) {

	$hex        = ltrim( wpbc_bfb_settings__sanitize_form_accent_color( $hex, WPBC_DEFAULT_FORM_ACCENT_COLOR ), '#' );
	$mix_hex    = ltrim( wpbc_bfb_settings__sanitize_form_accent_color( $mix_hex, '#000000' ), '#' );
	$percentage = max( 0, min( 1, (float) $percentage ) );

	if ( 3 === strlen( $hex ) ) {
		$hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
	}
	if ( 3 === strlen( $mix_hex ) ) {
		$mix_hex = $mix_hex[0] . $mix_hex[0] . $mix_hex[1] . $mix_hex[1] . $mix_hex[2] . $mix_hex[2];
	}

	$channels = array();
	for ( $index = 0; $index < 3; $index++ ) {
		$source     = hexdec( substr( $hex, $index * 2, 2 ) );
		$target     = hexdec( substr( $mix_hex, $index * 2, 2 ) );
		$channels[] = (int) round( $source + ( ( $target - $source ) * $percentage ) );
	}

	return sprintf( '#%02x%02x%02x', $channels[0], $channels[1], $channels[2] );
}

/**
 * Calculate relative luminance for a hexadecimal color.
 *
 * @param string $hex Hexadecimal color.
 * @return float
 */
function wpbc_bfb_settings__get_form_style_color_luminance( $hex ) {

	$hex = ltrim( wpbc_bfb_settings__sanitize_form_accent_color( $hex, WPBC_DEFAULT_FORM_ACCENT_COLOR ), '#' );
	if ( 3 === strlen( $hex ) ) {
		$hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
	}

	$linear = array();
	for ( $index = 0; $index < 3; $index++ ) {
		$channel  = hexdec( substr( $hex, $index * 2, 2 ) ) / 255;
		$linear[] = ( $channel <= 0.03928 ) ? ( $channel / 12.92 ) : pow( ( $channel + 0.055 ) / 1.055, 2.4 );
	}

	return ( 0.2126 * $linear[0] ) + ( 0.7152 * $linear[1] ) + ( 0.0722 * $linear[2] );
}

/**
 * Apply the optional accent overlay to resolved Form Style CSS variables.
 *
 * @param array $css_vars                       CSS variables resolved from the selected preset.
 * @param array $options                        Optional raw accent settings.
 * @param bool  $preserve_custom_button_colors Keep explicit Custom-style button colors.
 * @return array
 */
function wpbc_bfb_settings__apply_form_accent_css_vars( $css_vars, $options = array(), $preserve_custom_button_colors = false ) {

	$accent_options = wpbc_bfb_settings__get_form_accent_options( $options );
	if ( 'On' !== $accent_options['booking_form_accent_enabled'] ) {
		return $css_vars;
	}

	$accent         = $accent_options['booking_form_accent_color'];
	$luminance      = wpbc_bfb_settings__get_form_style_color_luminance( $accent );
	$contrast       = ( $luminance > 0.18 ) ? '#000000' : '#ffffff';
	$hover_target   = ( '#ffffff' === $contrast ) ? '#000000' : '#ffffff';
	$hover          = wpbc_bfb_settings__mix_form_style_colors( $accent, $hover_target, 0.10 );
	$hover_contrast = $contrast;
	$accent_overlay = array(
		'--wpbc_form-accent-color'              => $accent,
		'--wpbc_form-accent-hover-color'        => $hover,
		'--wpbc_form-accent-contrast-color'     => $contrast,
		'--wpbc_form-field-focus-border-color'  => $accent,
		'--wpbc_form-field-focus-shadow-color'  => $accent,
		'--wpbc_form-choice-checked-border-color' => $accent,
		'--wpbc_form-choice-checked-color'      => $accent,
		'--wpbc_form-choice-focus-color'        => $accent,
		'--wpbc_form-button-background-color'   => $accent,
		'--wpbc_form-button-background-color-alt' => $accent,
		'--wpbc_form-button-border-color'       => $accent,
		'--wpbc_form-button-text-color'         => $contrast,
		'--wpbc_form-button-text-color-alt'     => $contrast,
		'--wpbc_form-button-hover-background-color' => $hover,
		'--wpbc_form-button-hover-border-color' => $hover,
		'--wpbc_form-button-hover-text-color'   => $hover_contrast,
		'--wpbc_form-button-light-hover-border-color' => $accent,
		'--wpbc_form-button-primary-hover-border-color' => $hover,
		'--wpbc_form-page-break-color'          => $accent,
	);

	if ( $preserve_custom_button_colors ) {
		$custom_button_css_vars = array(
			'--wpbc_form-button-background-color',
			'--wpbc_form-button-background-color-alt',
			'--wpbc_form-button-border-color',
			'--wpbc_form-button-text-color',
			'--wpbc_form-button-text-color-alt',
			'--wpbc_form-button-hover-background-color',
			'--wpbc_form-button-hover-border-color',
			'--wpbc_form-button-hover-text-color',
			'--wpbc_form-button-light-hover-border-color',
			'--wpbc_form-button-primary-hover-border-color',
		);
		foreach ( $custom_button_css_vars as $css_var_name ) {
			unset( $accent_overlay[ $css_var_name ] );
		}
	}

	/**
	 * Filter the CSS variables supplied by the global accent overlay.
	 *
	 * @param array $accent_overlay Accent CSS variables.
	 * @param array $accent_options Sanitized accent settings.
	 * @param array $css_vars                       Base Form Style CSS variables.
	 * @param bool  $preserve_custom_button_colors Whether Custom button controls take precedence.
	 */
	$accent_overlay = apply_filters( 'wpbc_bfb_form_style_accent_css_vars', $accent_overlay, $accent_options, $css_vars, $preserve_custom_button_colors );

	return array_merge( $css_vars, is_array( $accent_overlay ) ? $accent_overlay : array() );
}

/**
 * Sanitize CSS length values used by global form style options.
 *
 * @param string $value    Raw value.
 * @param string $fallback Fallback value.
 * @return string
 */
function wpbc_bfb_settings__sanitize_form_style_length( $value, $fallback ) {

	$value = trim( (string) $value );

	if ( preg_match( '/^\d+(?:\.\d+)?(?:px|rem|em|%)$/i', $value ) ) {
		return $value;
	}

	return $fallback;
}

/**
 * Get sanitized global custom form style options.
 *
 * @param array $options Optional raw override values.
 * @return array
 */
function wpbc_bfb_settings__get_custom_form_style_options( $options = array() ) {

	$defaults = wpbc_bfb_settings__get_default_custom_form_style_options();
	$options  = is_array( $options ) ? $options : array();
	$values   = array();

	foreach ( $defaults as $key => $fallback ) {
		if ( array_key_exists( $key, $options ) ) {
			$values[ $key ] = $options[ $key ];
		} elseif ( function_exists( 'get_bk_option' ) ) {
			$values[ $key ] = get_bk_option( $key );
		} else {
			$values[ $key ] = $fallback;
		}
	}

	return array(
		'booking_form_custom_background_color'       => wpbc_bfb_settings__sanitize_form_style_color( $values['booking_form_custom_background_color'], $defaults['booking_form_custom_background_color'] ),
		'booking_form_custom_border_color'           => wpbc_bfb_settings__sanitize_form_style_color( $values['booking_form_custom_border_color'], $defaults['booking_form_custom_border_color'] ),
		'booking_form_custom_border_width'           => wpbc_bfb_settings__sanitize_form_style_length( $values['booking_form_custom_border_width'], $defaults['booking_form_custom_border_width'] ),
		'booking_form_custom_border_radius'          => wpbc_bfb_settings__sanitize_form_style_length( $values['booking_form_custom_border_radius'], $defaults['booking_form_custom_border_radius'] ),
		'booking_form_custom_padding_vertical'       => wpbc_bfb_settings__sanitize_form_style_length( $values['booking_form_custom_padding_vertical'], $defaults['booking_form_custom_padding_vertical'] ),
		'booking_form_custom_padding_horizontal'     => wpbc_bfb_settings__sanitize_form_style_length( $values['booking_form_custom_padding_horizontal'], $defaults['booking_form_custom_padding_horizontal'] ),
		'booking_form_custom_text_color'             => wpbc_bfb_settings__sanitize_form_style_color( $values['booking_form_custom_text_color'], $defaults['booking_form_custom_text_color'] ),
		'booking_form_custom_field_background_color' => wpbc_bfb_settings__sanitize_form_style_color( $values['booking_form_custom_field_background_color'], $defaults['booking_form_custom_field_background_color'] ),
		'booking_form_custom_field_text_color'       => wpbc_bfb_settings__sanitize_form_style_color( $values['booking_form_custom_field_text_color'], $defaults['booking_form_custom_field_text_color'] ),
		'booking_form_custom_field_border_color'     => wpbc_bfb_settings__sanitize_form_style_color( $values['booking_form_custom_field_border_color'], $defaults['booking_form_custom_field_border_color'] ),
		'booking_form_custom_button_background_color' => wpbc_bfb_settings__sanitize_form_style_color( $values['booking_form_custom_button_background_color'], $defaults['booking_form_custom_button_background_color'] ),
		'booking_form_custom_button_text_color'       => wpbc_bfb_settings__sanitize_form_style_color( $values['booking_form_custom_button_text_color'], $defaults['booking_form_custom_button_text_color'] ),
		'booking_form_custom_button_border_color'     => wpbc_bfb_settings__sanitize_form_style_color( $values['booking_form_custom_button_border_color'], $defaults['booking_form_custom_button_border_color'] ),
		'booking_form_custom_button_hover_background_color' => wpbc_bfb_settings__sanitize_form_style_color( $values['booking_form_custom_button_hover_background_color'], $defaults['booking_form_custom_button_hover_background_color'] ),
		'booking_form_custom_button_hover_text_color' => wpbc_bfb_settings__sanitize_form_style_color( $values['booking_form_custom_button_hover_text_color'], $defaults['booking_form_custom_button_hover_text_color'] ),
		'booking_form_custom_button_hover_border_color' => wpbc_bfb_settings__sanitize_form_style_color( $values['booking_form_custom_button_hover_border_color'], $defaults['booking_form_custom_button_hover_border_color'] ),
		'booking_form_custom_secondary_button_background_color' => wpbc_bfb_settings__sanitize_form_style_color( $values['booking_form_custom_secondary_button_background_color'], $defaults['booking_form_custom_secondary_button_background_color'] ),
		'booking_form_custom_secondary_button_text_color' => wpbc_bfb_settings__sanitize_form_style_color( $values['booking_form_custom_secondary_button_text_color'], $defaults['booking_form_custom_secondary_button_text_color'] ),
		'booking_form_custom_secondary_button_border_color' => wpbc_bfb_settings__sanitize_form_style_color( $values['booking_form_custom_secondary_button_border_color'], $defaults['booking_form_custom_secondary_button_border_color'] ),
		'booking_form_custom_secondary_button_hover_background_color' => wpbc_bfb_settings__sanitize_form_style_color( $values['booking_form_custom_secondary_button_hover_background_color'], $defaults['booking_form_custom_secondary_button_hover_background_color'] ),
		'booking_form_custom_secondary_button_hover_text_color' => wpbc_bfb_settings__sanitize_form_style_color( $values['booking_form_custom_secondary_button_hover_text_color'], $defaults['booking_form_custom_secondary_button_hover_text_color'] ),
		'booking_form_custom_secondary_button_hover_border_color' => wpbc_bfb_settings__sanitize_form_style_color( $values['booking_form_custom_secondary_button_hover_border_color'], $defaults['booking_form_custom_secondary_button_hover_border_color'] ),
		'booking_form_custom_button_border_width'      => wpbc_bfb_settings__sanitize_form_style_length( $values['booking_form_custom_button_border_width'], $defaults['booking_form_custom_button_border_width'] ),
		'booking_form_custom_button_border_radius'     => wpbc_bfb_settings__sanitize_form_style_length( $values['booking_form_custom_button_border_radius'], $defaults['booking_form_custom_button_border_radius'] ),
	);
}

/**
 * Resolve a global form style into CSS variables.
 *
 * @param string $style          Form style key.
 * @param array  $custom_options Optional custom style overrides.
 * @return array
 */
function wpbc_bfb_settings__get_form_style_css_vars( $style = '', $custom_options = array() ) {

	$style  = ( '' === (string) $style ) ? wpbc_bfb_settings__get_current_form_style() : wpbc_bfb_settings__sanitize_form_style( $style );
	$preset = wpbc_bfb_settings__get_form_style_preset( $style );

	if ( empty( $preset['custom'] ) ) {
		$css_vars = isset( $preset['css_vars'] ) && is_array( $preset['css_vars'] ) ? $preset['css_vars'] : array();

		return wpbc_bfb_settings__apply_form_accent_css_vars( $css_vars, $custom_options );
	}

	$custom = wpbc_bfb_settings__get_custom_form_style_options( $custom_options );

	$css_vars = array(
		'--wpbc-bfb-form-background'           => $custom['booking_form_custom_background_color'],
		'--wpbc-bfb-form-border-color'         => $custom['booking_form_custom_border_color'],
		'--wpbc-bfb-form-border-width'         => $custom['booking_form_custom_border_width'],
		'--wpbc-bfb-form-border-radius'        => $custom['booking_form_custom_border_radius'],
		'--wpbc-bfb-form-padding'              => $custom['booking_form_custom_padding_vertical'] . ' ' . $custom['booking_form_custom_padding_horizontal'],
		'--wpbc-bfb-form-box-shadow'           => 'rgba(0, 0, 0, 0.05) 0px 2px 6px 0px',
		'--wpbc_form-label-color'              => $custom['booking_form_custom_text_color'],
		'--wpbc_form-label-sublabel-color'     => $custom['booking_form_custom_text_color'],
		'--wpbc_form-label-error-color'        => '#d63637',
		'--wpbc_form-field-background-color'   => $custom['booking_form_custom_field_background_color'],
		'--wpbc_form-field-menu-color'         => $custom['booking_form_custom_field_background_color'],
		'--wpbc_form-field-text-color'         => $custom['booking_form_custom_field_text_color'],
		'--wpbc_form-field-border-color'       => $custom['booking_form_custom_field_border_color'],
		'--wpbc_form-field-border-color-spare' => $custom['booking_form_custom_field_border_color'],
		'--wpbc_form-field-focus-border-color' => '#066aab',
		'--wpbc_form-field-focus-shadow-color' => '#066aab',
		'--wpbc_form-field-disabled-color'     => 'rgba(0, 0, 0, 0.2)',
		'--wpbc_form-button-border-radius'     => $custom['booking_form_custom_button_border_radius'],
		'--wpbc_form-button-border-style'      => 'solid',
		'--wpbc_form-button-border-size'       => $custom['booking_form_custom_button_border_width'],
		'--wpbc_form-button-background-color'  => $custom['booking_form_custom_button_background_color'],
		'--wpbc_form-button-background-color-alt' => $custom['booking_form_custom_button_background_color'],
		'--wpbc_form-button-border-color'      => $custom['booking_form_custom_button_border_color'],
		'--wpbc_form-button-text-color'        => $custom['booking_form_custom_button_text_color'],
		'--wpbc_form-button-text-color-alt'    => $custom['booking_form_custom_button_text_color'],
		'--wpbc_form-button-hover-background-color' => $custom['booking_form_custom_button_hover_background_color'],
		'--wpbc_form-button-hover-border-color' => $custom['booking_form_custom_button_hover_border_color'],
		'--wpbc_form-button-hover-text-color'  => $custom['booking_form_custom_button_hover_text_color'],
		'--wpbc_form-choice-checked-border-color' => '#066aab',
		'--wpbc_form-choice-checked-color'     => '#066aab',
		'--wpbc_form-choice-focus-color'       => '#066aab',
		'--wpbc_form-button-light-background-color' => $custom['booking_form_custom_secondary_button_background_color'],
		'--wpbc_form-button-light-border-color' => $custom['booking_form_custom_secondary_button_border_color'],
		'--wpbc_form-button-light-border-size' => $custom['booking_form_custom_button_border_width'],
		'--wpbc_form-button-light-text-color'  => $custom['booking_form_custom_secondary_button_text_color'],
		'--wpbc_form-button-light-box-shadow'  => '0 2px 10px 2px #ffffff54',
		'--wpbc_form-button-light-hover-background-color' => $custom['booking_form_custom_secondary_button_hover_background_color'],
		'--wpbc_form-button-light-hover-border-color' => $custom['booking_form_custom_secondary_button_hover_border_color'],
		'--wpbc_form-button-light-hover-text-color' => $custom['booking_form_custom_secondary_button_hover_text_color'],
		'--wpbc_form-button-light-hover-box-shadow' => '0 2px 10px 2px #ffffff54',
		'--wpbc_form-button-primary-hover-border-color' => $custom['booking_form_custom_button_hover_border_color'],
		'--wpbc_form-page-break-color'         => '#066aab',
	);

	return wpbc_bfb_settings__apply_form_accent_css_vars( $css_vars, $custom_options, true );
}

/**
 * Get form/settings JSON keys that belong to the global Form Style feature.
 *
 * These values are stored as global options. They must not be persisted inside
 * individual Builder form settings_json records.
 *
 * @return array
 */
function wpbc_bfb_settings__get_form_json_style_option_keys() {

	return array(
		// New global Form Style model.
		'booking_form_style',
		'booking_form_accent_enabled',
		'booking_form_accent_color',
		'booking_form_custom_background_color',
		'booking_form_custom_border_color',
		'booking_form_custom_border_width',
		'booking_form_custom_border_radius',
		'booking_form_custom_padding_vertical',
		'booking_form_custom_padding_horizontal',
		'booking_form_custom_text_color',
		'booking_form_custom_field_background_color',
		'booking_form_custom_field_text_color',
		'booking_form_custom_field_border_color',
		'booking_form_custom_button_background_color',
		'booking_form_custom_button_text_color',
		'booking_form_custom_button_border_color',
		'booking_form_custom_button_hover_background_color',
		'booking_form_custom_button_hover_text_color',
		'booking_form_custom_button_hover_border_color',
		'booking_form_custom_secondary_button_background_color',
		'booking_form_custom_secondary_button_text_color',
		'booking_form_custom_secondary_button_border_color',
		'booking_form_custom_secondary_button_hover_background_color',
		'booking_form_custom_secondary_button_hover_text_color',
		'booking_form_custom_secondary_button_hover_border_color',
		'booking_form_custom_button_border_width',
		'booking_form_custom_button_border_radius',

		// Retired per-form appearance model from the unreleased 11.4 work.
		'booking_form_theme',
		'booking_form_container_style',
		'booking_form_background_color',
		'booking_form_border_color',
		'booking_form_border_width',
		'booking_form_border_radius',
		'booking_form_padding',
		'booking_form_text_color',
		'booking_form_field_background_color',
		'booking_form_field_text_color',
		'booking_form_field_border_color',
	);
}

/**
 * Remove global/retired Form Style keys from a form settings pack.
 *
 * @param array $settings Settings pack.
 * @return array
 */
function wpbc_bfb_settings__strip_form_style_options_from_form_settings( $settings ) {

	if ( ! is_array( $settings ) ) {
		return array();
	}

	if ( empty( $settings['options'] ) || ! is_array( $settings['options'] ) ) {
		return $settings;
	}

	foreach ( wpbc_bfb_settings__get_form_json_style_option_keys() as $key ) {
		unset( $settings['options'][ $key ] );
	}

	return $settings;
}
