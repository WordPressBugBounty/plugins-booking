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
					'key'     => 'booking_use_bfb_form',
					'scope'   => 'global',
					'save_ui' => 'when_changed', // always | when_changed.
					'default' => get_bk_option( 'booking_use_bfb_form', 'On' ),
					'label'   => __( 'Drag & Drop Form Builder', 'booking' ),
					'help'    =>  __( 'Enables the new drag & drop form builder. Disable this option to use the classic booking form. Reload the page, after saving.', 'booking' ),
					'attr'    => array(),
				)
			);

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

			// Color theme (LOCAL FORM SETTING).
			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'         => 'radio',
					'key'          => 'booking_form_theme',
					'scope'        => 'form',
					'default'      => '', // Applied from JS: 'wpbc:bfb:form_settings:apply' -- In 'settings_json' table field it's: { "options":{"booking_form_theme":"wpbc_theme_dark_1", ... } }.
					'label'        => __( 'Color theme', 'booking' ),
					'help'         => __( 'Select a color theme for your booking form that matches the look of your website.', 'booking' ),
					'attr'         => array(
						'id' => 'booking_form_theme',
					),
					'radio_layout' => 'inline', // inline | stack.
					'options'      => array(
						''                  => __( 'Light', 'booking' ),
						'wpbc_theme_dark_1' => __( 'Dark', 'booking' ),
					),
				)
			);

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

			?>
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
