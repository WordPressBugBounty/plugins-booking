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
 *     'options'       => [ 'booking_form_theme' => 'wpbc_theme_dark_1', ... ]
 *   ]
 *
 * @package Booking Calendar
 * @since   11.0.x
 * @file    ../includes/_front_end/hooks/class-fe-bfb-settings-hooks.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * ['options']['booking_form_layout_width'] and appearance options -> inject per-form CSS variables into the BFB form root wrapper. On Step 1.
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
function wpbc_booking_form__body_html__before_postprocess__apply_bfb_vars( $form_html, $bfb_settings, $resource_id, $custom_booking_form_name ) {

	$form_html    = (string) $form_html;
	$bfb_settings = is_array( $bfb_settings ) ? $bfb_settings : array();

	// If body has no BFB root, do nothing (fast path).
	if ( false === strpos( $form_html, 'wpbc_bfb_form' ) ) {
		return $form_html;
	}

	// Local helper (no global function redeclare risk).
	$sanitize_css_length = function( $v ) {
		$v = trim( (string) $v );
		if ( '' === $v ) {
			return '';
		}
		// Allow only: number + unit.
		return preg_match( '/^-?\d+(?:\.\d+)?(?:%|px|rem|em|vw|vh)$/', $v ) ? $v : '';
	};

	$width             = '';
	$appearance_style  = '';
	$appearance_values = array();
	if ( ! empty( $bfb_settings['options'] ) && is_array( $bfb_settings['options'] ) ) {
		$options = $bfb_settings['options'];

		$width = isset( $options['booking_form_layout_width'] )
			? $sanitize_css_length( $options['booking_form_layout_width'] )
			: '';

		$appearance_style = isset( $options['booking_form_container_style'] ) ? (string) $options['booking_form_container_style'] : '';
		$appearance_values = $options;
	}

	$css_vars = ( ! empty( $bfb_settings['css_vars'] ) && is_array( $bfb_settings['css_vars'] ) )
		? $bfb_settings['css_vars']
		: array();

	// Use a dedicated CSS var name.
	if ( '' !== $width ) {
		$css_vars['--wpbc-bfb-booking_form_layout_width'] = $width;
	}

	$appearance_vars = wpbc_bfb_settings__get_form_style_css_vars();
	if ( ! empty( $appearance_vars ) ) {
		$css_vars = array_merge( $css_vars, $appearance_vars );
	}

	if ( empty( $css_vars ) ) {
		return $form_html;
	}

	$form_html = WPBC_FE_Form_Style_Injector::inject_css_vars_into_bfb_root( $form_html, $css_vars );

	if ( wpbc_bfb_settings__is_custom_form_style( wpbc_bfb_settings__get_current_form_style() ) ) {
		$form_html = WPBC_FE_Form_Style_Injector::add_class_to_first_tag_with_classes( $form_html, array( 'wpbc_bfb_form' ), 'wpbc_bfb_form_appearance_custom' );
	}

	return $form_html;
}
add_filter( 'wpbc_booking_form__body_html__before_postprocess', 'wpbc_booking_form__body_html__before_postprocess__apply_bfb_vars', 10, 4 );

/**
 * Resolve form appearance settings into CSS variables.
 *
 * @param string $style  bordered|none|soft|custom.
 * @param array  $options Form settings options.
 *
 * @return array
 */
function wpbc_bfb_settings__get_form_appearance_presets() {

	return array(
		'bordered' => array(
			'background'   => '#ffffff',
			'border_color' => '#cccccc',
			'border_width' => '1px',
			'radius'       => '2px',
			'padding'      => '10px 30px',
			'shadow'       => 'rgba(0, 0, 0, 0.05) 0px 2px 6px 0px',
		),
		'none'     => array(
			'background'   => 'transparent',
			'border_color' => 'transparent',
			'border_width' => '0px',
			'radius'       => '0px',
			'padding'      => '0px',
			'shadow'       => 'none',
		),
		'soft'     => array(
			'background'   => '#f9f9fa',
			'border_color' => '#fff',
			'border_width' => '3px',
			'radius'       => '8px',
			'padding'      => '20px',
			'shadow'       => 'rgba(15, 23, 42, 0.06) 0px 4px 16px 0px',
		),
	);
}

function wpbc_bfb_settings__is_dark_form_theme( $options ) {

	$options = is_array( $options ) ? $options : array();

	return ( isset( $options['booking_form_theme'] ) && 'wpbc_theme_dark_1' === (string) $options['booking_form_theme'] );
}

function wpbc_bfb_settings__get_form_appearance_preset_for_options( $style, $options ) {

	$presets = wpbc_bfb_settings__get_form_appearance_presets();
	$style   = (string) $style;

	if ( ! wpbc_bfb_settings__is_dark_form_theme( $options ) ) {
		return isset( $presets[ $style ] ) ? $presets[ $style ] : $presets['bordered'];
	}

	if ( 'soft' === $style ) {
		return array(
			'background'   => '#1f2937',
			'border_color' => '#334155',
			'border_width' => '3px',
			'radius'       => '8px',
			'padding'      => '20px',
			'shadow'       => 'rgba(0, 0, 0, 0.24) 0px 4px 16px 0px',
		);
	}

	return isset( $presets[ $style ] ) ? $presets[ $style ] : $presets['bordered'];
}

function wpbc_bfb_settings__sanitize_form_appearance_values( $values ) {

	$values = is_array( $values ) ? $values : array();

	$sanitize_color = function ( $value, $fallback ) {
		$value = trim( (string) $value );
		if ( preg_match( '/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i', $value ) || 'transparent' === $value ) {
			return $value;
		}
		return $fallback;
	};

	$sanitize_length = function ( $value, $fallback ) {
		$value = trim( (string) $value );
		if ( preg_match( '/^-?\d+(?:\.\d+)?(?:px|rem|em|%)$/i', $value ) ) {
			return $value;
		}
		return $fallback;
	};

	$sanitize_spacing = function ( $value, $fallback ) {
		$value = preg_replace( '/\s+/', ' ', trim( (string) $value ) );
		if ( '' === $value ) {
			return $fallback;
		}
		$parts = explode( ' ', $value );
		if ( count( $parts ) < 1 || count( $parts ) > 4 ) {
			return $fallback;
		}
		foreach ( $parts as $part ) {
			if ( ! preg_match( '/^-?\d+(?:\.\d+)?(?:px|rem|em|%)$/i', $part ) ) {
				return $fallback;
			}
		}
		return implode( ' ', $parts );
	};

	return array(
		'background'   => $sanitize_color( isset( $values['background'] ) ? $values['background'] : '', '#ffffff' ),
		'border_color' => $sanitize_color( isset( $values['border_color'] ) ? $values['border_color'] : '', '#cccccc' ),
		'border_width' => $sanitize_length( isset( $values['border_width'] ) ? $values['border_width'] : '', '1px' ),
		'radius'       => $sanitize_length( isset( $values['radius'] ) ? $values['radius'] : '', '2px' ),
		'padding'      => $sanitize_spacing( isset( $values['padding'] ) ? $values['padding'] : '', '10px 30px' ),
		'shadow'       => isset( $values['shadow'] ) ? (string) $values['shadow'] : 'rgba(0, 0, 0, 0.05) 0px 2px 6px 0px',
	);
}

function wpbc_bfb_settings__sanitize_form_design_color_values( $values ) {

	$values = is_array( $values ) ? $values : array();

	$sanitize_color = function ( $value ) {
		$value = trim( (string) $value );
		if ( '' === $value ) {
			return '';
		}
		if ( preg_match( '/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i', $value ) ) {
			return $value;
		}
		return '';
	};

	return array(
		'text_color'             => $sanitize_color( isset( $values['booking_form_text_color'] ) ? $values['booking_form_text_color'] : '' ),
		'field_background_color' => $sanitize_color( isset( $values['booking_form_field_background_color'] ) ? $values['booking_form_field_background_color'] : '' ),
		'field_text_color'       => $sanitize_color( isset( $values['booking_form_field_text_color'] ) ? $values['booking_form_field_text_color'] : '' ),
		'field_border_color'     => $sanitize_color( isset( $values['booking_form_field_border_color'] ) ? $values['booking_form_field_border_color'] : '' ),
	);
}

function wpbc_bfb_settings__is_custom_form_appearance( $style, $options ) {

	$style   = (string) $style;
	$options = is_array( $options ) ? $options : array();

	if ( '' === $style && isset( $options['booking_form_container_style'] ) ) {
		$style = (string) $options['booking_form_container_style'];
	}

	return ( 'custom' === $style );
}

function wpbc_bfb_settings__get_global_form_appearance_options() {

	$preset = get_bk_option( 'booking_form_appearance_preset' );
	$preset = in_array( $preset, array( 'bordered', 'none', 'soft', 'custom' ), true ) ? $preset : 'bordered';
	if ( 'custom' === $preset ) {
		$preset = 'bordered';
	}

	return array(
		'booking_form_theme'            => get_bk_option( 'booking_form_theme' ),
		'booking_form_container_style'  => $preset,
		'booking_form_background_color' => get_bk_option( 'booking_form_appearance_background_color' ),
		'booking_form_border_color'     => get_bk_option( 'booking_form_appearance_border_color' ),
		'booking_form_border_width'     => get_bk_option( 'booking_form_appearance_border_width' ),
		'booking_form_border_radius'    => get_bk_option( 'booking_form_appearance_border_radius' ),
		'booking_form_padding'          => get_bk_option( 'booking_form_appearance_padding' ),
		'booking_form_text_color'       => '',
		'booking_form_field_background_color' => '',
		'booking_form_field_text_color'       => '',
		'booking_form_field_border_color'     => '',
	);
}

function wpbc_bfb_settings__get_form_appearance_css_vars( $style, $options ) {

	$style          = (string) $style;
	$options        = is_array( $options ) ? $options : array();
	$design_options = $options;
	$css_vars       = array();

	$presets = wpbc_bfb_settings__get_form_appearance_presets();

	if ( '' === $style || 'inherit' === $style ) {
		$options = wpbc_bfb_settings__get_global_form_appearance_options();
		$style   = isset( $options['booking_form_container_style'] ) ? (string) $options['booking_form_container_style'] : 'bordered';
	}

	if ( 'bordered' !== $style ) {
		if ( 'custom' === $style ) {
			$resolved = wpbc_bfb_settings__sanitize_form_appearance_values(
				array(
					'background'   => isset( $options['booking_form_background_color'] ) ? $options['booking_form_background_color'] : '',
					'border_color' => isset( $options['booking_form_border_color'] ) ? $options['booking_form_border_color'] : '',
					'border_width' => isset( $options['booking_form_border_width'] ) ? $options['booking_form_border_width'] : '',
					'radius'       => isset( $options['booking_form_border_radius'] ) ? $options['booking_form_border_radius'] : '',
					'padding'      => isset( $options['booking_form_padding'] ) ? $options['booking_form_padding'] : '',
					'shadow'       => 'rgba(0, 0, 0, 0.05) 0px 2px 6px 0px',
				)
			);
		} elseif ( isset( $presets[ $style ] ) ) {
			$resolved = wpbc_bfb_settings__get_form_appearance_preset_for_options( $style, $options );
		} else {
			$resolved = array();
		}

		if ( ! empty( $resolved ) ) {
			$css_vars['--wpbc-bfb-form-background']    = $resolved['background'];
			$css_vars['--wpbc-bfb-form-border-color']  = $resolved['border_color'];
			$css_vars['--wpbc-bfb-form-border-width']  = $resolved['border_width'];
			$css_vars['--wpbc-bfb-form-border-radius'] = $resolved['radius'];
			$css_vars['--wpbc-bfb-form-padding']       = $resolved['padding'];
			$css_vars['--wpbc-bfb-form-box-shadow']    = $resolved['shadow'];
		}
	}

	if ( ! wpbc_bfb_settings__is_custom_form_appearance( $style, $design_options ) && wpbc_bfb_settings__is_dark_form_theme( $options ) && 'none' === $style ) {
		$css_vars['--wpbc_form-label-color']          = '#1d2327';
		$css_vars['--wpbc_form-label-sublabel-color'] = '#1d2327';
	}

	if ( wpbc_bfb_settings__is_custom_form_appearance( $style, $design_options ) ) {
		$design_values = wpbc_bfb_settings__sanitize_form_design_color_values( $design_options );

		if ( '' !== $design_values['text_color'] ) {
			$css_vars['--wpbc_form-label-color']          = $design_values['text_color'];
			$css_vars['--wpbc_form-label-sublabel-color'] = $design_values['text_color'];
		}
		if ( '' !== $design_values['field_background_color'] ) {
			$css_vars['--wpbc_form-field-background-color'] = $design_values['field_background_color'];
			$css_vars['--wpbc_form-field-menu-color']       = $design_values['field_background_color'];
		}
		if ( '' !== $design_values['field_text_color'] ) {
			$css_vars['--wpbc_form-field-text-color'] = $design_values['field_text_color'];
		}
		if ( '' !== $design_values['field_border_color'] ) {
			$css_vars['--wpbc_form-field-border-color']       = $design_values['field_border_color'];
			$css_vars['--wpbc_form-field-border-color-spare'] = $design_values['field_border_color'];
		}
	}

	return $css_vars;
}

function wpbc_booking_form__wrapped_html__before_inline_scripts__apply_custom_appearance_class( $wrapped_html, $bfb_settings, $resource_id, $custom_booking_form_name ) {

	$wrapped_html = (string) $wrapped_html;
	$style        = wpbc_bfb_settings__get_current_form_style();
	$css_vars     = wpbc_bfb_settings__get_form_style_css_vars( $style );

	if ( ! empty( $css_vars ) ) {
		$wrapped_html = WPBC_FE_Form_Style_Injector::inject_css_vars_into_form_wrapper( $wrapped_html, $css_vars );
	}

	if ( wpbc_bfb_settings__is_custom_form_style( $style ) ) {
		$wrapped_html = WPBC_FE_Form_Style_Injector::add_class_to_first_tag_with_classes( $wrapped_html, array( 'wpbc_container', 'wpbc_form' ), 'wpbc_bfb_form_appearance_custom' );
	}

	return $wrapped_html;
}
add_filter( 'wpbc_booking_form__wrapped_html__before_inline_scripts', 'wpbc_booking_form__wrapped_html__before_inline_scripts__apply_custom_appearance_class', 12, 4 );


/**
 * ['options'][booking_form_theme] -> Apply a "theme" CSS class to the main booking form wrapper container.   On Step 3.
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
	$preset       = wpbc_bfb_settings__get_form_style_preset( wpbc_bfb_settings__get_current_form_style() );
	$raw_theme    = isset( $preset['theme_class'] ) ? trim( (string) $preset['theme_class'] ) : '';
	$theme_class_arr = array(); // token => true .
	$parts = preg_split( '/\s+/', $raw_theme, - 1, PREG_SPLIT_NO_EMPTY );
	foreach ( $parts as $part ) {
		$tok = sanitize_html_class( (string) $part );
		if ( '' === $tok ) { continue; }
		$theme_class_arr[ $tok ] = true;
	}
	$theme_class_arr = array_keys( $theme_class_arr );
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


/**
 * ['options']['booking_type_of_day_selections'] -> Set per-form day selection mode for calendar init.
 *
 * Uses shared calendar mode helpers for: single | multiple | range.
 *
 * @param string $wrapped_html
 * @param array  $bfb_settings
 * @param int    $resource_id
 * @param string $custom_booking_form_name
 *
 * @return string
 */
function wpbc_booking_form__wrapped_html__before_inline_scripts__apply_day_selection_mode( $wrapped_html, $bfb_settings, $resource_id, $custom_booking_form_name ) {

	$wrapped_html = (string) $wrapped_html;
	$bfb_settings = is_array( $bfb_settings ) ? $bfb_settings : array();

	$mode = '';
	if ( ! empty( $bfb_settings['options'] ) && is_array( $bfb_settings['options'] ) ) {
		if ( isset( $bfb_settings['options']['booking_type_of_day_selections'] ) ) {
			$mode = (string) $bfb_settings['options']['booking_type_of_day_selections'];
		}
	}

	if ( ! in_array( $mode, array( 'single', 'multiple', 'range' ), true ) ) {
		return $wrapped_html;
	}

	$rid = (int) $resource_id;
	$mode_functions = array(
		'single'   => 'wpbc_cal_ready_days_select__single',
		'multiple' => 'wpbc_cal_ready_days_select__multiple',
		'range'    => 'wpbc_cal_ready_days_select__range_mode',
	);
	$fn = $mode_functions[ $mode ];

	$js_body  = '(function(){';
	$js_body .= 'var rid=' . $rid . ';';
	$js_body .= 'var tries=0;';
	$js_body .= 'function run(){';
	$js_body .= '  if (typeof window.' . $fn . ' === "function") { window.' . $fn . '(rid); return; }';
	$js_body .= '  if (tries++ < 40) { setTimeout(run,50); }';
	$js_body .= '}';
	$js_body .= 'run();';
	$js_body .= '}());';

	$can_use_wp_inline = ( ! wp_doing_ajax() );

	// Elementor safe adding inline scripts after loaded of 'wpbc_all' script.
	if ( $can_use_wp_inline && class_exists( 'WPBC_FE_Assets' ) && function_exists( 'wp_script_is' ) ) {

		$assets_key = 'wpbc:day-select:' . $rid . ':' . md5( (string) $custom_booking_form_name . ':' . $mode );

		$added = WPBC_FE_Assets::add_jq_ready_js_to_wp_script( 'wpbc_all', $js_body, $assets_key );

		if ( $added ) {
			return $wrapped_html; // no <script> printed in content.
		}
	}

	// Fallback only if WP inline could not be attached.
	$wrapped_html .= "\n" . '<script type="text/javascript">' . "\n" . $js_body . "\n" . '</script>' . "\n";
	return $wrapped_html;
}
add_filter( 'wpbc_booking_form__wrapped_html__before_inline_scripts', 'wpbc_booking_form__wrapped_html__before_inline_scripts__apply_day_selection_mode', 9, 4 );
