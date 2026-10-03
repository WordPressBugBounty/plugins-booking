<?php
/**
 * Read-only Appearance choices for the isolated Setup Wizard.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Adapt canonical Booking Calendar appearance registries to wizard DTOs.
 */
final class WPBC_Setup_Wizard_Appearance {

	/**
	 * Renderer used by every Appearance preview.
	 *
	 * Appearance compares visual settings against the selected Form Builder
	 * template itself. It must not inherit the Booking Form page's optional
	 * Service/Provider entry point because that would hide the form being styled.
	 *
	 * @var string
	 */
	const PREVIEW_BOOKING_FORM_USAGE = 'direct_booking_form';

	/**
	 * Return the exact starting styles exposed by the wizard.
	 *
	 * @return array<int,array{id:string,label:string,description:string}> Style DTOs.
	 */
	public function get_starting_styles() {
		$descriptions = array(
			'light_bordered' => __( 'A clean light form with clear field and container borders.', 'booking' ),
			'light_soft'     => __( 'A light form with a soft background and gentle contrast.', 'booking' ),
			'dark_bordered'  => __( 'A dark bordered form for high-contrast layouts.', 'booking' ),
		);
		$styles       = array();
		$presets      = function_exists( 'wpbc_bfb_settings__get_form_style_presets' )
			? wpbc_bfb_settings__get_form_style_presets()
			: array();

		foreach ( array( 'light_bordered', 'light_soft', 'dark_bordered' ) as $style_id ) {
			if ( empty( $presets[ $style_id ] ) || ! is_array( $presets[ $style_id ] ) ) {
				continue;
			}

			$styles[] = array(
				'id'          => $style_id,
				'label'       => isset( $presets[ $style_id ]['title'] ) ? sanitize_text_field( (string) $presets[ $style_id ]['title'] ) : $style_id,
				'description' => $descriptions[ $style_id ],
			);
		}

		return $styles;
	}

	/**
	 * Return the preset accent shortcuts displayed beside the custom picker.
	 *
	 * The first shortcut follows the canonical project default so activation,
	 * Form Builder, and Setup Wizard defaults cannot drift independently. Every
	 * value is still submitted through the same validated hexadecimal field;
	 * these records are presentation shortcuts, not an alternate save contract.
	 *
	 * @return array<int,array{value:string,label:string}> Accent shortcut DTOs.
	 */
	public function get_accent_colors() {
		return array(
			array(
				'value' => $this->get_default_accent_color(),
				'label' => __( 'Blue', 'booking' ),
			),
			array(
				'value' => '#0EA5E9',
				'label' => __( 'Sky blue', 'booking' ),
			),
			array(
				'value' => '#14B8A6',
				'label' => __( 'Teal', 'booking' ),
			),
			array(
				'value' => '#F59E0B',
				'label' => __( 'Amber', 'booking' ),
			),
			array(
				'value' => '#DB2777',
				'label' => __( 'Rose', 'booking' ),
			),
			array(
				'value' => '#7C3AED',
				'label' => __( 'Violet', 'booking' ),
			),
		);
	}

	/**
	 * Return grouped calendar skin choices from the canonical registry.
	 *
	 * @return array<int,array{label:string,options:array<int,array{value:string,label:string,url:string}>}> Skin groups.
	 */
	public function get_calendar_skin_groups() {
		if ( ! function_exists( 'wpbc_get_calendar_skin_options' ) ) {
			return array();
		}

		$groups        = array();
		$current_group = array(
			'label'   => __( 'Calendar Skins', 'booking' ),
			'options' => array(),
		);

		foreach ( wpbc_get_calendar_skin_options() as $skin_value => $skin_label ) {
			if ( is_array( $skin_label ) && ! empty( $skin_label['optgroup'] ) ) {
				if ( ! empty( $skin_label['close'] ) ) {
					if ( ! empty( $current_group['options'] ) ) {
						$groups[] = $current_group;
					}
					$current_group = array( 'label' => '', 'options' => array() );
					continue;
				}

				$current_group = array(
					'label'   => isset( $skin_label['title'] ) ? $this->normalize_label( $skin_label['title'] ) : __( 'Calendar Skins', 'booking' ),
					'options' => array(),
				);
				continue;
			}

			$normalized_skin = $this->normalize_calendar_skin( $skin_value );
			$label           = is_array( $skin_label ) && isset( $skin_label['title'] ) ? $skin_label['title'] : $skin_label;
			if ( '' === $normalized_skin || '' === $this->normalize_label( $label ) ) {
				continue;
			}

			$current_group['options'][] = array(
				'value' => $normalized_skin,
				'label' => $this->normalize_label( $label ),
				'url'   => esc_url_raw( $this->get_calendar_skin_url( $normalized_skin ) ),
			);
		}

		if ( ! empty( $current_group['options'] ) ) {
			$groups[] = $current_group;
		}

		return $groups;
	}

	/**
	 * Return current canonical values as safe initial wizard suggestions.
	 *
	 * @return array<string,string> Initial appearance values.
	 */
	public function get_initial_values() {
		$style_ids     = wp_list_pluck( $this->get_starting_styles(), 'id' );
		$current_style = function_exists( 'wpbc_bfb_settings__get_current_form_style' )
			? wpbc_bfb_settings__get_current_form_style()
			: 'light_bordered';
		$current_style = in_array( $current_style, $style_ids, true ) ? $current_style : 'light_bordered';
		$accent_color  = function_exists( 'wpbc_bfb_settings__get_form_accent_options' )
			? wpbc_bfb_settings__get_form_accent_options()
			: array();
		$accent_color  = isset( $accent_color['booking_form_accent_color'] ) ? $accent_color['booking_form_accent_color'] : $this->get_default_accent_color();
		$current_skin  = $this->validate_calendar_skin( $this->normalize_calendar_skin( get_bk_option( 'booking_skin' ) ), false );

		if ( is_wp_error( $current_skin ) || '' === $current_skin ) {
			$current_skin = $this->get_first_calendar_skin();
		}

		return array(
			'booking_form_style'        => $current_style,
			'booking_form_accent_color' => $this->sanitize_accent_color( $accent_color ),
			'booking_skin'              => $current_skin,
			'booking_timeslot_picker'    => 'On' === get_bk_option( 'booking_timeslot_picker' ) ? 'On' : 'Off',
		);
	}

	/**
	 * Validate one starting style against the wizard subset.
	 *
	 * @param mixed $raw_style   Candidate style identifier.
	 * @param bool  $is_required Whether an empty value is invalid.
	 *
	 * @return string|WP_Error Valid style identifier or an error.
	 */
	public function validate_style( $raw_style, $is_required ) {
		return $this->validate_exact_choice(
			$raw_style,
			wp_list_pluck( $this->get_starting_styles(), 'id' ),
			$is_required,
			'wpbc_setup_wizard_appearance_style_invalid',
			__( 'Choose one of the available starting styles.', 'booking' )
		);
	}

	/**
	 * Validate one six-digit hexadecimal accent color.
	 *
	 * @param mixed $raw_color   Candidate color.
	 * @param bool  $is_required Whether an empty value is invalid.
	 *
	 * @return string|WP_Error Canonical color or an error.
	 */
	public function validate_accent_color( $raw_color, $is_required ) {
		if ( ! is_scalar( $raw_color ) ) {
			return new WP_Error( 'wpbc_setup_wizard_appearance_color_invalid', __( 'Choose a valid accent color.', 'booking' ) );
		}

		$raw_color = trim( (string) $raw_color );
		if ( '' === $raw_color && ! $is_required ) {
			return '';
		}
		if ( ! preg_match( '/^#[0-9A-Fa-f]{6}$/', $raw_color ) ) {
			return new WP_Error( 'wpbc_setup_wizard_appearance_color_invalid', __( 'Choose a valid six-digit accent color.', 'booking' ) );
		}

		return strtoupper( $raw_color );
	}

	/**
	 * Validate one calendar skin against the canonical current registry.
	 *
	 * @param mixed $raw_skin    Candidate relative skin path.
	 * @param bool  $is_required Whether an empty value is invalid.
	 *
	 * @return string|WP_Error Canonical relative path or an error.
	 */
	public function validate_calendar_skin( $raw_skin, $is_required ) {
		if ( ! is_scalar( $raw_skin ) ) {
			return new WP_Error( 'wpbc_setup_wizard_appearance_skin_invalid', __( 'Choose a valid calendar skin.', 'booking' ) );
		}

		$raw_skin        = trim( (string) $raw_skin );
		$normalized_skin = $this->normalize_calendar_skin( $raw_skin );
		if ( '' === $normalized_skin && ! $is_required ) {
			return '';
		}
		if ( $normalized_skin !== $raw_skin || ! in_array( $normalized_skin, $this->get_calendar_skin_values(), true ) ) {
			return new WP_Error( 'wpbc_setup_wizard_appearance_skin_invalid', __( 'Choose a calendar skin from the available list.', 'booking' ) );
		}

		return $normalized_skin;
	}

	/**
	 * Validate the canonical time-selection presentation value.
	 *
	 * @param mixed $raw_value   Candidate `On` or `Off` value.
	 * @param bool  $is_required Whether an empty value is invalid.
	 *
	 * @return string|WP_Error Canonical value or an error.
	 */
	public function validate_timeslot_picker( $raw_value, $is_required ) {
		return $this->validate_exact_choice(
			$raw_value,
			array( 'Off', 'On' ),
			$is_required,
			'wpbc_setup_wizard_appearance_time_invalid',
			__( 'Choose how time slots are displayed.', 'booking' )
		);
	}

	/**
	 * Build the exact preview style and global-option snapshot.
	 *
	 * @param array<string,mixed> $values Candidate appearance values.
	 *
	 * @return array<string,array<string,string>>|WP_Error Valid preview configuration or an error.
	 */
	public function get_preview_configuration( array $values ) {
		$style = $this->validate_style( isset( $values['booking_form_style'] ) ? $values['booking_form_style'] : '', true );
		$color = $this->validate_accent_color( isset( $values['booking_form_accent_color'] ) ? $values['booking_form_accent_color'] : '', true );
		$skin  = $this->validate_calendar_skin( isset( $values['booking_skin'] ) ? $values['booking_skin'] : '', true );
		$time  = $this->validate_timeslot_picker( isset( $values['booking_timeslot_picker'] ) ? $values['booking_timeslot_picker'] : '', true );

		foreach ( array( $style, $color, $skin, $time ) as $validated_value ) {
			if ( is_wp_error( $validated_value ) ) {
				return $validated_value;
			}
		}

		return array(
			'form_style'       => array(
				'booking_form_style'          => $style,
				'booking_form_accent_enabled' => 'On',
				'booking_form_accent_color'   => $color,
			),
			'option_overrides' => array(
				'booking_skin'           => $skin,
				'booking_timeslot_picker' => $time,
			),
		);
	}

	/**
	 * Normalize a label that may contain legacy HTML entities.
	 *
	 * @param mixed $label Candidate label.
	 *
	 * @return string Plain translated label.
	 */
	private function normalize_label( $label ) {
		$label = is_scalar( $label ) ? (string) $label : '';

		$charset = function_exists( 'get_bloginfo' ) ? get_bloginfo( 'charset' ) : 'UTF-8';

		return trim( sanitize_text_field( wp_strip_all_tags( html_entity_decode( $label, ENT_QUOTES, $charset ) ) ) );
	}

	/**
	 * Normalize a calendar skin URL or filesystem path to a relative path.
	 *
	 * @param mixed $skin_value Candidate path.
	 *
	 * @return string Relative path.
	 */
	private function normalize_calendar_skin( $skin_value ) {
		$skin_value = is_scalar( $skin_value ) ? sanitize_text_field( (string) $skin_value ) : '';
		$replace    = array( WPBC_PLUGIN_DIR, WPBC_PLUGIN_URL );
		$upload_dir = wp_upload_dir();

		if ( ! empty( $upload_dir['basedir'] ) ) {
			$replace[] = $upload_dir['basedir'];
		}
		if ( ! empty( $upload_dir['baseurl'] ) ) {
			$replace[] = $upload_dir['baseurl'];
		}

		return str_replace( $replace, '', $skin_value );
	}

	/**
	 * Resolve one normalized calendar skin to its browser-loadable URL.
	 *
	 * Custom skins are stored below the WordPress uploads directory, while
	 * bundled skins are stored below the plugin directory. Returning an explicit
	 * server-resolved URL prevents browser code from guessing either location.
	 *
	 * @param string $relative_skin Normalized relative calendar skin path.
	 *
	 * @return string Absolute skin URL.
	 */
	private function get_calendar_skin_url( $relative_skin ) {
		$relative_skin = $this->normalize_calendar_skin( $relative_skin );
		$upload_dir    = wp_upload_dir();
		$upload_url    = ! empty( $upload_dir['baseurl'] ) ? untrailingslashit( $upload_dir['baseurl'] ) : '';

		if ( 0 === strpos( $relative_skin, '/wpbc_skins/' ) && '' !== $upload_url ) {
			return $upload_url . $relative_skin;
		}

		return untrailingslashit( WPBC_PLUGIN_URL ) . '/' . ltrim( $relative_skin, '/' );
	}

	/**
	 * Return every normalized skin path exposed by the registry DTO.
	 *
	 * @return string[] Skin allow-list.
	 */
	private function get_calendar_skin_values() {
		$values = array();
		foreach ( $this->get_calendar_skin_groups() as $group ) {
			foreach ( $group['options'] as $option ) {
				$values[] = $option['value'];
			}
		}

		return array_values( array_unique( $values ) );
	}

	/**
	 * Return the first registered calendar skin as a safe fallback.
	 *
	 * @return string Relative skin path or an empty string.
	 */
	private function get_first_calendar_skin() {
		$values = $this->get_calendar_skin_values();

		return ! empty( $values ) ? (string) reset( $values ) : '';
	}

	/**
	 * Normalize a trusted initial accent color.
	 *
	 * @param mixed $accent_color Candidate accent color.
	 *
	 * @return string Canonical six-digit color.
	 */
	private function sanitize_accent_color( $accent_color ) {
		$validated = $this->validate_accent_color( $accent_color, true );

		return is_wp_error( $validated ) ? $this->get_default_accent_color() : $validated;
	}

	/**
	 * Return the project accent default without assuming the constant is loaded.
	 *
	 * @return string Canonical uppercase six-digit color.
	 */
	private function get_default_accent_color() {
		$default_color = defined( 'WPBC_DEFAULT_FORM_ACCENT_COLOR' ) ? strtoupper( (string) WPBC_DEFAULT_FORM_ACCENT_COLOR ) : '#315EFB';
		if ( ! preg_match( '/^#[0-9A-F]{6}$/', $default_color ) ) {
			return '#315EFB';
		}

		return $default_color;
	}

	/**
	 * Validate one scalar against an exact server-owned allow-list.
	 *
	 * @param mixed    $raw_value     Candidate value.
	 * @param string[] $allowed       Exact allowed values.
	 * @param bool     $is_required   Whether empty is invalid.
	 * @param string   $error_code    Stable error code.
	 * @param string   $error_message Translated error message.
	 *
	 * @return string|WP_Error Valid choice or an error.
	 */
	private function validate_exact_choice( $raw_value, array $allowed, $is_required, $error_code, $error_message ) {
		if ( ! is_scalar( $raw_value ) ) {
			return new WP_Error( $error_code, $error_message );
		}

		$raw_value = trim( (string) $raw_value );
		if ( '' === $raw_value && ! $is_required ) {
			return '';
		}
		if ( ! in_array( $raw_value, $allowed, true ) ) {
			return new WP_Error( $error_code, $error_message );
		}

		return $raw_value;
	}
}
