<?php
/**
 * BFB Settings Options UI.
 *
 * Settings Conception Rules must stay simple:
 *
 *   'scope' = 'global'   -  row Save UI depends on 'save_ui' => 'always' | 'when_changed'
 *   'scope' = 'form'     -  saved only via Save Form into settings_json field (e.g. { "options": { "key":"value" } }) in the  Table: wp_booking_form_structures
 *   'scope' = 'ui'       -  UI-only (no DB save)
 *
 *
 * @package     Booking Calendar.
 * @author      wpdevelop, oplugins
 * @web-site    https://wpbookingcalendar.com/
 * @email       info@wpbookingcalendar.com
 *
 * @since       11.0.x
 * @file        ../booking/includes/page-form-builder/form-settings/options-defs.php
 *
 * @modified    2026-01-24 20:12
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}



/**
 * Print Settings Options groups.
 */
function wpbc_bfb_ui__settings_options__print() {

	$wpbc_bfb_current_form_style  = function_exists( 'wpbc_bfb_settings__get_current_form_style' ) ? wpbc_bfb_settings__get_current_form_style() : 'light_bordered';
	$wpbc_bfb_custom_style_values = function_exists( 'wpbc_bfb_settings__get_custom_form_style_options' ) ? wpbc_bfb_settings__get_custom_form_style_options() : array();

	// ======================================================================
	// == Group: Basic
	// ======================================================================

	$panel_id_basic = 'wpbc_bfb_form_settings_panel_basic';
	?>
	<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group is-open" data-group="settings-basic">
		<button type="button" class="group__header" role="button" aria-expanded="true" aria-controls="<?php echo esc_attr( $panel_id_basic ); ?>">
			<h3><?php esc_html_e( 'Basic', 'booking' ); ?></h3>
			<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
		</button>

		<div class="group__fields" id="<?php echo esc_attr( $panel_id_basic ); ?>" aria-hidden="false">
			<?php

			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'    => 'toggle',
					'key'     => 'booking_timeslot_picker',
					'scope'   => 'global',
					'save_ui' => 'always', // always | when_changed.
					'default' => get_bk_option( 'booking_timeslot_picker', 'On' ),
					'label'   => __( 'Time picker for time slots', 'booking' ),
					'help'    => __( 'Show time slots as a time picker instead of a select box.', 'booking' ),
					'attr'    => array(
						'id'    => 'wpbc_bfb__toggle_booking_timeslot_picker',
						'class' => 'js-toggle-timeslot-picker',
					),
				)
			);

			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'    => 'toggle',
					'key'     => 'booking_is_use_autofill_4_logged_user',
					'scope'   => 'global',
					'save_ui' => 'when_changed', // always | when_changed.
					'default' => get_bk_option( 'booking_is_use_autofill_4_logged_user', 'Off' ),
					'label'   => __( 'Auto-fill fields', 'booking' ),
					'help'    => __( 'Prefill form fields with the current user’s details when the user is logged in.', 'booking' ) . ' ' .
					             __( 'Click Preview to see it in action.', 'booking' ),
					'attr'    => array(
						'id' => 'wpbc_bfb__checkbox_autofill_4_logged_user',
					),
				)
			);

			?>
		</div>
	</section>
	<?php

	// ======================================================================
	// == Group: Appearance
	// ======================================================================

	$panel_id_appearance = 'wpbc_bfb_form_settings_panel_appearance';
	?>
	<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="settings-appearance">
		<button type="button" class="group__header" role="button" aria-expanded="false" aria-controls="<?php echo esc_attr( $panel_id_appearance ); ?>">
			<h3><?php esc_html_e( 'Appearance', 'booking' ); ?></h3>
			<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
		</button>

		<div class="group__fields" id="<?php echo esc_attr( $panel_id_appearance ); ?>" aria-hidden="true">
			<?php

			// Form width (LOCAL FORM SETTING) stored as ONE combined value like "100%".
			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'    => 'length',
					'key'     => 'booking_form_layout_width',
					'scope'   => 'form',
					'default' => '100%', // Applied from JS too; this is a fallback.
					'label'   => __( 'Form width', 'booking' ),
					'help'    => __( 'Set the width of the booking form container.', 'booking' ),
					'attr'    => array(
						'id' => 'booking_form_layout_width',
					),
					'length'  => array(
						'default_unit' => '%',
						'units'        => array(
							'%'   => '%',
							'px'  => 'px',
							'rem' => 'rem',
							'em'  => 'em',
						),
						'bounds_map'   => array(
							'%'   => array( 'min' => 30,  'max' => 100,  'step' => 1 ),
							'px'  => array( 'min' => 300, 'max' => 2000, 'step' => 10 ),
							'rem' => array( 'min' => 10,  'max' => 200,  'step' => 0.5 ),
							'em'  => array( 'min' => 10,  'max' => 200,  'step' => 0.5 ),
						),
					),
				)
			);


			// Combined global style selector. It uses the same option as Settings > Theme.
			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'                  => 'radio',
					'key'                   => 'booking_form_style',
					'scope'                 => 'global',
					'save_ui'               => 'when_changed',
					'autosave_on_form_save' => true,
					'default'               => $wpbc_bfb_current_form_style,
					'label'                 => __( 'Form style', 'booking' ),
					'help'                  => __( 'Choose the global form style used by all booking forms.', 'booking' ),
					'attr'                  => array(
						'id' => 'booking_form_style',
					),
					'radio_layout' => 'choice_grid',
					'options'      => function_exists( 'wpbc_bfb_settings__get_form_style_options' ) ? wpbc_bfb_settings__get_form_style_options() : array(
						'light_bordered' => __( 'Light bordered', 'booking' ),
						'custom'         => __( 'Custom', 'booking' ),
					),
				)
			);

			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'        => 'color',
					'key'         => 'booking_form_custom_background_color',
					'scope'       => 'global',
					'save_ui'     => 'when_changed',
					'autosave_on_form_save' => true,
					'default'     => isset( $wpbc_bfb_custom_style_values['booking_form_custom_background_color'] ) ? $wpbc_bfb_custom_style_values['booking_form_custom_background_color'] : '#ffffff',
					'label'       => __( 'Background color', 'booking' ),
					'help'        => __( 'Used when Form style is Custom.', 'booking' ),
					'attr'        => array(
						'id' => 'booking_form_custom_background_color',
					),
					'row_class'   => 'wpbc_bfb__form_setting_global_custom_style',
					'row_hidden'  => true,
					'input_attrs' => array(
						'pattern' => '^#[0-9A-Fa-f]{6}$',
					),
				)
			);

			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'        => 'color',
					'key'         => 'booking_form_custom_border_color',
					'scope'       => 'global',
					'save_ui'     => 'when_changed',
					'autosave_on_form_save' => true,
					'default'     => isset( $wpbc_bfb_custom_style_values['booking_form_custom_border_color'] ) ? $wpbc_bfb_custom_style_values['booking_form_custom_border_color'] : '#cccccc',
					'label'       => __( 'Border color', 'booking' ),
					'help'        => __( 'Used when Form style is Custom.', 'booking' ),
					'attr'        => array(
						'id' => 'booking_form_custom_border_color',
					),
					'row_class'   => 'wpbc_bfb__form_setting_global_custom_style',
					'row_hidden'  => true,
					'input_attrs' => array(
						'pattern' => '^#[0-9A-Fa-f]{6}$',
					),
				)
			);

			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'    => 'length',
					'key'     => 'booking_form_custom_border_width',
					'scope'   => 'global',
					'save_ui' => 'when_changed',
					'autosave_on_form_save' => true,
					'default' => isset( $wpbc_bfb_custom_style_values['booking_form_custom_border_width'] ) ? $wpbc_bfb_custom_style_values['booking_form_custom_border_width'] : '1px',
					'label'   => __( 'Border width', 'booking' ),
					'help'    => __( 'Used when Form style is Custom.', 'booking' ),
					'attr'    => array(
						'id' => 'booking_form_custom_border_width',
					),
					'row_class' => 'wpbc_bfb__form_setting_global_custom_style',
					'row_hidden' => true,
					'length'  => array(
						'default_unit' => 'px',
						'units'        => array(
							'px'  => 'px',
							'rem' => 'rem',
							'em'  => 'em',
						),
						'bounds_map'   => array(
							'px'  => array( 'min' => 0, 'max' => 20, 'step' => 1 ),
							'rem' => array( 'min' => 0, 'max' => 5,  'step' => 0.1 ),
							'em'  => array( 'min' => 0, 'max' => 5,  'step' => 0.1 ),
						),
					),
				)
			);

			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'    => 'length',
					'key'     => 'booking_form_custom_border_radius',
					'scope'   => 'global',
					'save_ui' => 'when_changed',
					'autosave_on_form_save' => true,
					'default' => isset( $wpbc_bfb_custom_style_values['booking_form_custom_border_radius'] ) ? $wpbc_bfb_custom_style_values['booking_form_custom_border_radius'] : '2px',
					'label'   => __( 'Corner radius', 'booking' ),
					'help'    => __( 'Used when Form style is Custom.', 'booking' ),
					'attr'    => array(
						'id' => 'booking_form_custom_border_radius',
					),
					'row_class' => 'wpbc_bfb__form_setting_global_custom_style',
					'row_hidden' => true,
					'length'  => array(
						'default_unit' => 'px',
						'units'        => array(
							'px'  => 'px',
							'rem' => 'rem',
							'em'  => 'em',
						),
						'bounds_map'   => array(
							'px'  => array( 'min' => 0, 'max' => 40, 'step' => 1 ),
							'rem' => array( 'min' => 0, 'max' => 5,  'step' => 0.1 ),
							'em'  => array( 'min' => 0, 'max' => 5,  'step' => 0.1 ),
						),
					),
				)
			);

			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'                  => 'length',
					'key'                   => 'booking_form_custom_padding_vertical',
					'scope'                 => 'global',
					'save_ui'               => 'when_changed',
					'autosave_on_form_save' => true,
					'default'               => isset( $wpbc_bfb_custom_style_values['booking_form_custom_padding_vertical'] ) ? $wpbc_bfb_custom_style_values['booking_form_custom_padding_vertical'] : '10px',
					'label'                 => __( 'Inner spacing top / bottom', 'booking' ),
					'help'                  => __( 'Used when Form style is Custom.', 'booking' ),
					'attr'                  => array(
						'id' => 'booking_form_custom_padding_vertical',
					),
					'row_class'             => 'wpbc_bfb__form_setting_global_custom_style',
					'row_hidden'            => true,
					'length'                => array(
						'default_unit' => 'px',
						'units'        => array(
							'px'  => 'px',
							'rem' => 'rem',
							'em'  => 'em',
						),
						'bounds_map'   => array(
							'px'  => array( 'min' => 0, 'max' => 120, 'step' => 1 ),
							'rem' => array( 'min' => 0, 'max' => 10,  'step' => 0.1 ),
							'em'  => array( 'min' => 0, 'max' => 10,  'step' => 0.1 ),
						),
					),
				)
			);

			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'                  => 'length',
					'key'                   => 'booking_form_custom_padding_horizontal',
					'scope'                 => 'global',
					'save_ui'               => 'when_changed',
					'autosave_on_form_save' => true,
					'default'               => isset( $wpbc_bfb_custom_style_values['booking_form_custom_padding_horizontal'] ) ? $wpbc_bfb_custom_style_values['booking_form_custom_padding_horizontal'] : '30px',
					'label'                 => __( 'Inner spacing left / right', 'booking' ),
					'help'                  => __( 'Used when Form style is Custom.', 'booking' ),
					'attr'                  => array(
						'id' => 'booking_form_custom_padding_horizontal',
					),
					'row_class'             => 'wpbc_bfb__form_setting_global_custom_style',
					'row_hidden'            => true,
					'length'                => array(
						'default_unit' => 'px',
						'units'        => array(
							'px'  => 'px',
							'rem' => 'rem',
							'em'  => 'em',
						),
						'bounds_map'   => array(
							'px'  => array( 'min' => 0, 'max' => 120, 'step' => 1 ),
							'rem' => array( 'min' => 0, 'max' => 10,  'step' => 0.1 ),
							'em'  => array( 'min' => 0, 'max' => 10,  'step' => 0.1 ),
						),
					),
				)
			);

			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'        => 'color',
					'key'         => 'booking_form_custom_text_color',
					'scope'       => 'global',
					'save_ui'     => 'when_changed',
					'autosave_on_form_save' => true,
					'default'     => isset( $wpbc_bfb_custom_style_values['booking_form_custom_text_color'] ) ? $wpbc_bfb_custom_style_values['booking_form_custom_text_color'] : '#1d2327',
					'label'       => __( 'Text color', 'booking' ),
					'help'        => __( 'Used when Form style is Custom.', 'booking' ),
					'attr'        => array(
						'id' => 'booking_form_custom_text_color',
					),
					'row_class'   => 'wpbc_bfb__form_setting_global_custom_style',
					'row_hidden'  => true,
					'input_attrs' => array(
						'pattern' => '^#[0-9A-Fa-f]{6}$',
					),
				)
			);

			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'        => 'color',
					'key'         => 'booking_form_custom_field_background_color',
					'scope'       => 'global',
					'save_ui'     => 'when_changed',
					'autosave_on_form_save' => true,
					'default'     => isset( $wpbc_bfb_custom_style_values['booking_form_custom_field_background_color'] ) ? $wpbc_bfb_custom_style_values['booking_form_custom_field_background_color'] : '#ffffff',
					'label'       => __( 'Field background', 'booking' ),
					'help'        => __( 'Used when Form style is Custom.', 'booking' ),
					'attr'        => array(
						'id' => 'booking_form_custom_field_background_color',
					),
					'row_class'   => 'wpbc_bfb__form_setting_global_custom_style',
					'row_hidden'  => true,
					'input_attrs' => array(
						'pattern' => '^#[0-9A-Fa-f]{6}$',
					),
				)
			);

			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'        => 'color',
					'key'         => 'booking_form_custom_field_text_color',
					'scope'       => 'global',
					'save_ui'     => 'when_changed',
					'autosave_on_form_save' => true,
					'default'     => isset( $wpbc_bfb_custom_style_values['booking_form_custom_field_text_color'] ) ? $wpbc_bfb_custom_style_values['booking_form_custom_field_text_color'] : '#3c434a',
					'label'       => __( 'Field text color', 'booking' ),
					'help'        => __( 'Used when Form style is Custom.', 'booking' ),
					'attr'        => array(
						'id' => 'booking_form_custom_field_text_color',
					),
					'row_class'   => 'wpbc_bfb__form_setting_global_custom_style',
					'row_hidden'  => true,
					'input_attrs' => array(
						'pattern' => '^#[0-9A-Fa-f]{6}$',
					),
				)
			);

			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'        => 'color',
					'key'         => 'booking_form_custom_field_border_color',
					'scope'       => 'global',
					'save_ui'     => 'when_changed',
					'autosave_on_form_save' => true,
					'default'     => isset( $wpbc_bfb_custom_style_values['booking_form_custom_field_border_color'] ) ? $wpbc_bfb_custom_style_values['booking_form_custom_field_border_color'] : '#cccccc',
					'label'       => __( 'Field border color', 'booking' ),
					'help'        => __( 'Used when Form style is Custom.', 'booking' ),
					'attr'        => array(
						'id' => 'booking_form_custom_field_border_color',
					),
					'row_class'   => 'wpbc_bfb__form_setting_global_custom_style',
					'row_hidden'  => true,
					'input_attrs' => array(
						'pattern' => '^#[0-9A-Fa-f]{6}$',
					),
				)
			);

			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'                  => 'color',
					'key'                   => 'booking_form_custom_button_background_color',
					'scope'                 => 'global',
					'save_ui'               => 'when_changed',
					'autosave_on_form_save' => true,
					'default'               => isset( $wpbc_bfb_custom_style_values['booking_form_custom_button_background_color'] ) ? $wpbc_bfb_custom_style_values['booking_form_custom_button_background_color'] : '#066aab',
					'label'                 => __( 'Primary button background', 'booking' ),
					'help'                  => __( 'Used by submit and primary buttons when Form style is Custom.', 'booking' ),
					'attr'                  => array(
						'id' => 'booking_form_custom_button_background_color',
					),
					'row_class'             => 'wpbc_bfb__form_setting_global_custom_style',
					'row_hidden'            => true,
					'input_attrs'           => array(
						'pattern' => '^#[0-9A-Fa-f]{6}$',
					),
				)
			);

			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'                  => 'color',
					'key'                   => 'booking_form_custom_button_text_color',
					'scope'                 => 'global',
					'save_ui'               => 'when_changed',
					'autosave_on_form_save' => true,
					'default'               => isset( $wpbc_bfb_custom_style_values['booking_form_custom_button_text_color'] ) ? $wpbc_bfb_custom_style_values['booking_form_custom_button_text_color'] : '#ffffff',
					'label'                 => __( 'Primary button text', 'booking' ),
					'help'                  => __( 'Used by submit and primary buttons when Form style is Custom.', 'booking' ),
					'attr'                  => array(
						'id' => 'booking_form_custom_button_text_color',
					),
					'row_class'             => 'wpbc_bfb__form_setting_global_custom_style',
					'row_hidden'            => true,
					'input_attrs'           => array(
						'pattern' => '^#[0-9A-Fa-f]{6}$',
					),
				)
			);

			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'                  => 'color',
					'key'                   => 'booking_form_custom_button_border_color',
					'scope'                 => 'global',
					'save_ui'               => 'when_changed',
					'autosave_on_form_save' => true,
					'default'               => isset( $wpbc_bfb_custom_style_values['booking_form_custom_button_border_color'] ) ? $wpbc_bfb_custom_style_values['booking_form_custom_button_border_color'] : '#066aab',
					'label'                 => __( 'Primary button border', 'booking' ),
					'help'                  => __( 'Used by submit and primary buttons when Form style is Custom.', 'booking' ),
					'attr'                  => array(
						'id' => 'booking_form_custom_button_border_color',
					),
					'row_class'             => 'wpbc_bfb__form_setting_global_custom_style',
					'row_hidden'            => true,
					'input_attrs'           => array(
						'pattern' => '^#[0-9A-Fa-f]{6}$',
					),
				)
			);

			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'                  => 'color',
					'key'                   => 'booking_form_custom_button_hover_background_color',
					'scope'                 => 'global',
					'save_ui'               => 'when_changed',
					'autosave_on_form_save' => true,
					'default'               => isset( $wpbc_bfb_custom_style_values['booking_form_custom_button_hover_background_color'] ) ? $wpbc_bfb_custom_style_values['booking_form_custom_button_hover_background_color'] : '#055589',
					'label'                 => __( 'Primary hover background', 'booking' ),
					'help'                  => __( 'Used when a submit or primary button is hovered, focused, or active.', 'booking' ),
					'attr'                  => array(
						'id' => 'booking_form_custom_button_hover_background_color',
					),
					'row_class'             => 'wpbc_bfb__form_setting_global_custom_style',
					'row_hidden'            => true,
					'input_attrs'           => array(
						'pattern' => '^#[0-9A-Fa-f]{6}$',
					),
				)
			);

			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'                  => 'color',
					'key'                   => 'booking_form_custom_button_hover_text_color',
					'scope'                 => 'global',
					'save_ui'               => 'when_changed',
					'autosave_on_form_save' => true,
					'default'               => isset( $wpbc_bfb_custom_style_values['booking_form_custom_button_hover_text_color'] ) ? $wpbc_bfb_custom_style_values['booking_form_custom_button_hover_text_color'] : '#ffffff',
					'label'                 => __( 'Primary hover text', 'booking' ),
					'help'                  => __( 'Used when a submit or primary button is hovered, focused, or active.', 'booking' ),
					'attr'                  => array(
						'id' => 'booking_form_custom_button_hover_text_color',
					),
					'row_class'             => 'wpbc_bfb__form_setting_global_custom_style',
					'row_hidden'            => true,
					'input_attrs'           => array(
						'pattern' => '^#[0-9A-Fa-f]{6}$',
					),
				)
			);

			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'                  => 'color',
					'key'                   => 'booking_form_custom_button_hover_border_color',
					'scope'                 => 'global',
					'save_ui'               => 'when_changed',
					'autosave_on_form_save' => true,
					'default'               => isset( $wpbc_bfb_custom_style_values['booking_form_custom_button_hover_border_color'] ) ? $wpbc_bfb_custom_style_values['booking_form_custom_button_hover_border_color'] : '#055589',
					'label'                 => __( 'Primary hover border', 'booking' ),
					'help'                  => __( 'Used when a submit or primary button is hovered, focused, or active.', 'booking' ),
					'attr'                  => array(
						'id' => 'booking_form_custom_button_hover_border_color',
					),
					'row_class'             => 'wpbc_bfb__form_setting_global_custom_style',
					'row_hidden'            => true,
					'input_attrs'           => array(
						'pattern' => '^#[0-9A-Fa-f]{6}$',
					),
				)
			);

			$secondary_button_color_options = array(
				'booking_form_custom_secondary_button_background_color' => array( __( 'Secondary button background', 'booking' ), __( 'Used by Previous, Next, lightweight, and Stripe buttons.', 'booking' ), '#fdfdfd' ),
				'booking_form_custom_secondary_button_text_color' => array( __( 'Secondary button text', 'booking' ), __( 'Used by Previous, Next, lightweight, and Stripe buttons.', 'booking' ), '#444444' ),
				'booking_form_custom_secondary_button_border_color' => array( __( 'Secondary button border', 'booking' ), __( 'Used by Previous, Next, lightweight, and Stripe buttons.', 'booking' ), '#eeeeee' ),
				'booking_form_custom_secondary_button_hover_background_color' => array( __( 'Secondary hover background', 'booking' ), __( 'Used when a secondary button is hovered, focused, or active.', 'booking' ), '#fdfdfd' ),
				'booking_form_custom_secondary_button_hover_text_color' => array( __( 'Secondary hover text', 'booking' ), __( 'Used when a secondary button is hovered, focused, or active.', 'booking' ), '#444444' ),
				'booking_form_custom_secondary_button_hover_border_color' => array( __( 'Secondary hover border', 'booking' ), __( 'Used when a secondary button is hovered, focused, or active.', 'booking' ), '#4d91cd' ),
			);

			foreach ( $secondary_button_color_options as $option_key => $option_data ) {
				WPBC_BFB_Setting_Options::print_option(
					array(
						'type'                  => 'color',
						'key'                   => $option_key,
						'scope'                 => 'global',
						'save_ui'               => 'when_changed',
						'autosave_on_form_save' => true,
						'default'               => isset( $wpbc_bfb_custom_style_values[ $option_key ] ) ? $wpbc_bfb_custom_style_values[ $option_key ] : $option_data[2],
						'label'                 => $option_data[0],
						'help'                  => $option_data[1],
						'attr'                  => array(
							'id' => $option_key,
						),
						'row_class'             => 'wpbc_bfb__form_setting_global_custom_style',
						'row_hidden'            => true,
						'input_attrs'           => array(
							'pattern' => '^#[0-9A-Fa-f]{6}$',
						),
					)
				);
			}

			?>
			<div class="wpbc_bfb__form_setting wpbc_bfb__form_setting_custom_appearance_reset" data-wpbc-bfb-custom-appearance-reset-row="1" hidden aria-hidden="true" style="border: 1.5px dashed #dd4e4e;">
				<div class="inspector__row" style="justify-content:flex-start;">
					<div class="inspector__control" style="flex:1 1 auto;">
						<button type="button" class="button button-secondary" data-wpbc-bfb-reset-custom-appearance="1" style="margin: 10px auto;display: block;">
							<?php esc_html_e( 'Reset custom style', 'booking' ); ?>
						</button>
						<p class="wpbc_bfb__help" style="margin:6px 0 0 0;">
							<?php esc_html_e( 'Restore the default custom container, spacing, field, and button colors. Save Form also saves these style changes.', 'booking' ); ?>
						</p>
					</div>
				</div>
			</div>
		</div>
	</section>
	<?php

	// ======================================================================
	// == Group: Advanced
	// ======================================================================

	$panel_id_advanced = 'wpbc_bfb_form_settings_panel_advanced';
	?>
	<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="settings-advanced">
		<button type="button" class="group__header" role="button" aria-expanded="false" aria-controls="<?php echo esc_attr( $panel_id_advanced ); ?>">
			<h3><?php esc_html_e( 'Advanced', 'booking' ); ?></h3>
			<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
		</button>

		<div class="group__fields" id="<?php echo esc_attr( $panel_id_advanced ); ?>" aria-hidden="true">
			<?php

			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'    => 'toggle',
					'key'     => 'booking_is_use_phone_validation',
					'scope'   => 'global',
					'save_ui' => 'when_changed', // always | when_changed.
					'default' => get_bk_option( 'booking_is_use_phone_validation', 'Off' ),
					'label'   => __( 'Smart phone validation', 'booking' ),
					'help'    => __( 'Validate phone number fields according to the user’s selected country format (e.g., +1 000 000 0000).', 'booking' ),
					'attr'    => array(
						'id' => 'set_gen_booking_is_use_phone_validation',
					),
				)
			);

			if ( class_exists( 'wpdev_bk_biz_m' ) ) {
				WPBC_BFB_Setting_Options::print_option(
					array(
						'type'    => 'range',
						'key'     => 'booking_number_for_pre_checkin_date_hint',
						'scope'   => 'global',
						'save_ui' => 'when_changed', // always | when_changed.
						'default' => get_bk_option( 'booking_number_for_pre_checkin_date_hint', '14' ),
						'label'   => __( 'Pre-check-in display duration', 'booking' ),
						'help'    => __( 'Select the number of days used by the [pre_checkin_date_hint] shortcode (N days before the selected check-in date).', 'booking' ),
						'attr'    => array( 'id' => 'set_gen_booking_number_for_pre_checkin_date_hint' ),
						'range'   => array( 'min' => 1, 'max' => 91, 'step' => 1 ),
					)
				);
			}

			?>
		</div>
	</section>
	<?php

	// ======================================================================
	// == Group: Calendar
	// ======================================================================

	$panel_id_calendar = 'wpbc_bfb_form_settings_panel_calendar';
	?>
	<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="settings-calendar">
		<button type="button" class="group__header" role="button" aria-expanded="false" aria-controls="<?php echo esc_attr( $panel_id_calendar ); ?>">
			<h3><?php esc_html_e( 'Custom Days Selection', 'booking' ); ?></h3>
			<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
		</button>

		<div class="group__fields" id="<?php
		echo esc_attr( $panel_id_calendar ); ?>" aria-hidden="true">
			<?php

			// Days selection in calendar (LOCAL FORM SETTING).
			WPBC_BFB_Setting_Options::print_option( array(
				'type'         => 'radio',
				'key'          => 'booking_type_of_day_selections',
				'scope'        => 'form',
				'default'      => '',
				'label'        => __( 'Days selection mode', 'booking' ),
				'help'         => __( 'Choose how visitors can select dates in this form’s calendar.', 'booking' ) . ' ' .
									__( 'Default follows your global setting for the whole site.', 'booking' ) . ' ' .
									__( 'Click Preview to see it in action.', 'booking' ),
				'attr'         => array(
					'id' => 'booking_type_of_day_selections',
				),
				'radio_layout' => 'inline',
				'options'      => array(
					''         => __( 'Default', 'booking' ) . ' (' . __( 'calendar settings', 'booking' ) . ')',
					'single'   => __( 'Single day', 'booking' ),
					'multiple' => __( 'Multiple days', 'booking' ),
					'range'    => __( 'Range days - 2 mouse clicks', 'booking' ),
				),
			) );

			?>
		</div>
	</section>
	<?php


	if(0){
		// ======================================================================
		// == Group: Debug
		// ======================================================================

		$panel_id_debug = 'wpbc_bfb_form_settings_panel_debug';
		?>
		<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="settings-debug">
			<button type="button" class="group__header" role="button" aria-expanded="false" aria-controls="<?php echo esc_attr( $panel_id_debug ); ?>">
				<h3><?php esc_html_e( 'Debug', 'booking' ); ?></h3>
				<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
			</button>

			<div class="group__fields" id="<?php echo esc_attr( $panel_id_debug ); ?>" aria-hidden="true">
				<?php

				// UI-only: no save_ui; state comes from JS/UI or defaults.
				WPBC_BFB_Setting_Options::print_option(
					array(
						'type'    => 'toggle',
						'key'     => 'booking_bfb_preview_mode',
						'scope'   => 'ui',
						'default' => 'On',
						'label'   => __( 'Preview mode', 'booking' ),
						'help'    => __( 'Enable live preview rendering while building the form.', 'booking' ),
						'attr'    => array(
							'id' => 'wpbc_bfb__toggle_preview',
						),
					)
				);

				?>
			</div>
		</section>
		<?php
	}

}
