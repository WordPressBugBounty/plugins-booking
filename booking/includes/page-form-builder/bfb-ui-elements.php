<?php
/**
 * UI elements for settings page.
 *
 * @package     Booking Calendar.
 * @author      wpdevelop, oplugins
 * @web-site    https://wpbookingcalendar.com/
 * @email       info@wpbookingcalendar.com
 *
 * @modified    2025-11-26
 * @version     1.2
 * @file: ../includes/page-form-builder/bfb-ui-elements.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}


// ---------------------------------------------------------------------------------------------------------------------
// Top Toolbar - Dropdown Menu - Load / Import
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Render Form Builder "Load / Import" dropdown in top toolbar.
 *
 * This dropdown groups all actions that LOAD or IMPORT the booking form structure:
 *  - Reload last saved form from DB.
 *  - Import from previous "Simple" booking form configuration.
 *
 * @param array $config Optional configuration:
 *                      - ajax_action_load   : AJAX action for loading from DB.
 *                      - ajax_nonce_load    : Nonce for loading from DB.
 *                      - ajax_action_import : AJAX action for import from Simple Form.
 *                      - ajax_nonce_import  : Nonce for import from Simple Form.
 *                      - default_form_key   : Default form key to load.
 *                      - dropdown_title     : Dropdown label in toolbar.
 *
 * @return void
 */
function wpbc_bfb__top_toolbar__dropdown_menu__main_forms( $config = array() ) {

	$defaults = array(
		'ajax_action_load'   => 'WPBC_AJX_BFB_LOAD_FORM_CONFIG',
		'ajax_nonce_load'    => '',
		'ajax_action_import' => 'wpbc_bfb_import_simple_form',
		'ajax_nonce_import'  => '',
		'default_form_key'   => 'default_booking_form',
		'dropdown_title'     => __( 'Forms', 'booking' ),
		'dropdown_font_icon' => '', // 'wpbc-bi-download',
	);

	$config = wp_parse_args( $config, $defaults );

	$config['ajax_nonce_import_legacy_forms']  = wp_create_nonce( 'wpbc_bfb_import_legacy_forms' );
	$config['ajax_action_import_legacy_forms'] = 'WPBC_AJX_BFB_IMPORT_LEGACY_FORMS';

	// Build dropdown items: LOAD / IMPORT actions.
$items = array(
	array(
		'type'  => 'header',
		'title' => __( 'Restore or Replace Current Form', 'booking' ),
	),

	array(
		'type'  => 'link',
		'title' => __( 'Replace with Template', 'booking' ) . '...',
		'url'   => 'javascript:void(0);',
		'attr'  => array(
			'onclick'               => 'wpbc_bfb__menu_forms__apply_template(this);',
			'data-wpbc-u-busy-text' => __( 'Applying', 'booking' ) . '...',
			'title'                 => __( 'Replace the current form layout with a ready-made template.', 'booking' ),
			'style'                 => 'font-weight:600;',
		),
	),

		// Reload last saved form from DB.
	array(
		'type'  => 'link',
		'title' => __( 'Restore last saved version', 'booking' ),
		'url'   => 'javascript:void(0);',
		'attr'  => array(
			'onclick'                   => 'wpbc_bfb__ajax_load_current_form(this);',
			'data-wpbc-bfb-load-nonce'  => $config['ajax_nonce_load'],
			'data-wpbc-bfb-load-action' => $config['ajax_action_load'],
			'data-wpbc-bfb-form-key'    => $config['default_form_key'],
			'data-wpbc-u-busy-text'     => __( 'Loading', 'booking' ) . '...',
			'title'                     => __( 'Discard unsaved changes and restore the last saved version of this form.', 'booking' ),
		),
	),

	array( 'type' => 'divider' ),
	array(
		'type'  => 'header',
		'title' => __( 'Create, Open, and Save Forms', 'booking' ),
	),

	array(
		'type'  => 'link',
		'title' => __( 'Create New Form', 'booking' ) . '...',
		'url'   => 'javascript:void(0);',
		'attr'  => array(
			'onclick'                   => 'wpbc_bfb__menu_forms__new(this);',
			'data-wpbc-bfb-load-nonce'  => $config['ajax_nonce_load'],
			'data-wpbc-bfb-load-action' => $config['ajax_action_load'],
			'data-wpbc-bfb-form-key'    => $config['default_form_key'],
			'data-wpbc-u-busy-text'     => __( 'Loading', 'booking' ) . '...',
			'title'                     => __( 'Create a new booking form.', 'booking' ),
		),
	),

	array(
		'type'  => 'link',
			'title' => __( 'Open', 'booking' ) . ' ...',
		'url'   => 'javascript:void(0);',
		'attr'  => array(
			'onclick'                   => 'wpbc_bfb__menu_forms__load(this);',
			'data-wpbc-bfb-load-nonce'  => $config['ajax_nonce_load'],
			'data-wpbc-bfb-load-action' => $config['ajax_action_load'],
			'data-wpbc-bfb-form-key'    => $config['default_form_key'],
			'data-wpbc-u-busy-text'     => __( 'Loading', 'booking' ) . '...',
			'title'                     => __( 'Open an existing saved booking form.', 'booking' ),
		),
	),

	array(
		'type'  => 'link',
			'title' => __( 'Save', 'booking' ),
		'url'   => 'javascript:void(0);',
		'attr'  => array(
			'onclick'                   => 'wpbc_bfb__ajax_save_current_form(this);',
			'data-wpbc-bfb-load-nonce'  => $config['ajax_nonce_load'],
			'data-wpbc-bfb-load-action' => $config['ajax_action_load'],
			'data-wpbc-bfb-form-key'    => $config['default_form_key'],
			'data-wpbc-u-busy-text'     => __( 'Saving', 'booking' ) . '...',
			'title'                     => __( 'Save changes to the current booking form.', 'booking' ),
		),
	),

	array(
		'type'  => 'link',
			'title' => __( 'Save As', 'booking' ) . ' ...',
		'url'   => 'javascript:void(0);',
		'attr'  => array(
			'onclick'                   => 'wpbc_bfb__menu_forms__save_as(this);',
			'data-wpbc-bfb-load-nonce'  => $config['ajax_nonce_load'],
			'data-wpbc-bfb-load-action' => $config['ajax_action_load'],
			'data-wpbc-bfb-form-key'    => $config['default_form_key'],
			'data-wpbc-u-busy-text'     => __( 'Saving', 'booking' ) . '...',
			'title'                     => __( 'Save a copy of this form with a new name.', 'booking' ),
		),
	),

		// array( 'type' => 'divider' ),
		//
		// Reload last saved form from DB.
		// array(
		// 'type'  => 'link',
		// 'title' => __( 'Load Template Example', 'booking' ),
		// 'url'   => 'javascript:void(0);',
		// 'attr'  => array(
		// 'onclick'                   => 'var json_form_structure = wpbc_bfb__form_structure__get_example(); wpbc_bfb__on_structure_loaded( json_form_structure );',
		// 'data-wpbc-bfb-load-nonce'  => $config['ajax_nonce_load'],
		// 'data-wpbc-bfb-load-action' => $config['ajax_action_load'],
		// 'data-wpbc-bfb-form-key'    => $config['default_form_key'],
		// 'data-wpbc-u-busy-text'     => __( 'Loading', 'booking' ) . '...',
		// 'title'                     => __( 'Discard current changes and load the last saved form structure from database.', 'booking' ),
		// ),
		// ),
	);

	$items = wpbc_bfb__top_toolbar__dropdown_menu__main_forms__maybe_add_import_options( $items, $config );

	$el_arr = array(
		'title'     => $config['dropdown_title'],
		'font_icon' => $config['dropdown_font_icon'],
		'position'  => 'left',
		'items'     => $items,
	);

	wpbc_ui_el__dropdown_menu( $el_arr );
}

/**
 * Maybe Add Import Options to  the Main "Form"  menu  in the top  toolbar.
 *
 * @param array $items - already  existed itmes for drop  down  menu.
 *
 * @return array|mixed
 */
function wpbc_bfb__top_toolbar__dropdown_menu__main_forms__maybe_add_import_options( $items = array(), $config = array() ) {

	$items[] = array( 'type' => 'divider' );
	$items[] = array(
		'type'  => 'header',
		'title' => __( 'Import Legacy Forms', 'booking' ),
	);

	// -----------------------------------------------------------------------------------------------------------------
	// == Import ==
	// -----------------------------------------------------------------------------------------------------------------

	// == Free Simple ==  - Import from Simple Form - Usually  in - Free version.
	$items[] = array(
		'type'  => 'link',
		'title' => __( 'Import from Simple Form', 'booking' ),
		'url'   => 'javascript:void(0);',
		'attr'  => array(
			'onclick'                     => 'wpbc_bfb__import_from_simple_form(this);',
			'data-wpbc-bfb-import-nonce'  => $config['ajax_nonce_import'],
			'data-wpbc-bfb-import-action' => $config['ajax_action_import'],
			'data-wpbc-u-busy-text'       => __( 'Importing', 'booking' ) . '...',
			'title'                       => __( 'Import fields from the previous Simple Form into the Form Builder.', 'booking' ),
		),
	);


	// == Pro Advanced ==  - Import booking forms for == Super Booking Admin == user ( user_id = 0 ).
	if ( class_exists( 'wpdev_bk_personal' ) ) {

		$custom_forms_count = 0;
		if ( class_exists( 'wpdev_bk_biz_m' ) && ( ! empty( maybe_unserialize( get_bk_option( 'booking_forms_extended' ) ) ) ) ) {
			$custom_forms_count = maybe_unserialize( get_bk_option( 'booking_forms_extended' ) );
			$custom_forms_count = count( $custom_forms_count );
		}
		++$custom_forms_count;

		$items[] = array(
			'type'  => 'link',
			/* translators: 1: number of custom  booking forms. */
			'title' => sprintf( _n( 'Import %s Advanced Form', 'Import %s Advanced Forms', $custom_forms_count, 'booking' ), $custom_forms_count ),
			'url'   => 'javascript:void(0);',
			'attr'  => array(
				'onclick'                            => 'wpbc_bfb__import_legacy_forms(this);',
				'data-wpbc-bfb-import-nonce'         => $config['ajax_nonce_import_legacy_forms'],
				'data-wpbc-bfb-import-action'        => $config['ajax_action_import_legacy_forms'],
				'data-wpbc-bfb-import-mode'          => 'all_global',
				'data-wpbc-bfb-skip-if-exists'       => 'overwrite',           // 'skip' | 'overwrite'. Default - 'skip'.
				'data-wpbc-bfb-set-form-not-defined' => 'not_defined',         // 'not_defined' | ''.   Default - 'not_defined'.
				'data-wpbc-u-busy-text'              => __( 'Importing', 'booking' ) . '...',
				'title'                              => __( 'Import all global legacy booking forms into Form Builder storage.', 'booking' ),
			),
		);
	}

	// Import booking forms for == All Users ==.
	if ( class_exists( 'wpdev_bk_multiuser' ) ) {

		$is_user_super_admin = apply_bk_filter( 'is_user_super_admin', wpbc_get_current_user_id() );

		if ( ! $is_user_super_admin ) {

			// Import booking forms  only  for the == Current User == (usually - "Regular User").
			$items[] = array(
				'type'  => 'link',
				'title' => __( 'Import Advanced Forms for Current User', 'booking' ),
				'url'   => 'javascript:void(0);',
				'attr'  => array(
					'onclick'                            => 'wpbc_bfb__import_legacy_forms(this);',
					'data-wpbc-bfb-import-nonce'         => $config['ajax_nonce_import_legacy_forms'],
					'data-wpbc-bfb-import-action'        => $config['ajax_action_import_legacy_forms'],
					'data-wpbc-bfb-import-mode'          => 'current_context',
					'data-wpbc-u-busy-text'              => __( 'Importing', 'booking' ) . '...',
					'title'                              => __( 'Import all existing Advanced Forms for the current user into the Form Builder.', 'booking' ),
					'data-wpbc-bfb-skip-if-exists'       => 'overwrite',     // 'skip' | 'overwrite'. Default - 'skip'.
					'data-wpbc-bfb-set-form-not-defined' => 'not_defined',   // 'not_defined' | ''.   Default - 'not_defined'.
				),
			);
		}

		if ( $is_user_super_admin ) {

			$items[] = array(
				'type'  => 'link',
				'title' => __( 'Import Advanced Forms for All Users', 'booking' ),
				'url'   => 'javascript:void(0);',
				'attr'  => array(
					'onclick'                     => 'wpbc_bfb__import_legacy_forms(this);',
					'data-wpbc-bfb-import-nonce'  => $config['ajax_nonce_import_legacy_forms'],
					'data-wpbc-bfb-import-action' => $config['ajax_action_import_legacy_forms'],
					'data-wpbc-bfb-import-mode'   => 'all_users',
					'data-wpbc-u-busy-text'       => __( 'Importing', 'booking' ) . '...',
					'title'                       => __( 'Import all existing Advanced Forms for all users into the Form Builder.', 'booking' ),
					// 'data-wpbc-bfb-skip-if-exists'       => 'overwrite',     // 'skip' | 'overwrite'. Default - 'skip'.
					// 'data-wpbc-bfb-set-form-not-defined' => 'not_defined',   // 'not_defined' | ''.   Default - 'not_defined'.
				),
			);
		}
	}
	// -----------------------------------------------------------------------------------------------------------------

	return $items;
}


/**
 * Show Form Builder LOAD / IMPORT dropdown + define JS helpers.
 *
 * Hooked into: wpbc_ui_el__top_nav__content_center
 *
 * @param string $page_tag           Current page tag.
 * @param string $active_page_tab    Current tab.
 * @param string $active_page_subtab Current subtab.
 *
 * @return void
 */
function wpbc_bfb__top_toolbar__dropdown_menu__main_forms__show( $page_tag, $active_page_tab, $active_page_subtab ) {

	if ( ! wpbc_is_builder_booking_form_page() ) {
		return;
	}

	// === Common config ================================================================================================
	$ajax_action_load = 'WPBC_AJX_BFB_LOAD_FORM_CONFIG';
	$ajax_nonce_load  = wp_create_nonce( 'wpbc_bfb_form_load' );

	$ajax_action_import = 'wpbc_bfb_import_simple_form';
	$ajax_nonce_import  = wp_create_nonce( $ajax_action_import );

	$default_form_key = 'default_booking_form';

	wpbc_ui_el__divider_vertical( array( 'style' => 'width: 0.75px;' ) );
	?>
	<div class="wpbc_ui_el__buttons_group wpbc_bfb_ui__elements_hide_in_preview0">
	<?php
		// Dropdown: all LOAD / IMPORT actions.
		wpbc_bfb__top_toolbar__dropdown_menu__main_forms(
			array(
				'ajax_action_load'   => $ajax_action_load,
				'ajax_nonce_load'    => $ajax_nonce_load,
				'ajax_action_import' => $ajax_action_import,
				'ajax_nonce_import'  => $ajax_nonce_import,
				'default_form_key'   => $default_form_key,
			)
		);
	?>
	</div>
	<?php
}
add_action( 'wpbc_ui_el__top_nav__content_start', 'wpbc_bfb__top_toolbar__dropdown_menu__main_forms__show', 10, 3 );
// add_action( 'wpbc_ui_el__top_nav__content_center', 'wpbc_bfb__top_toolbar__dropdown_menu__main_forms__show', 10, 3 );


/**
 * Show Form Builder save + preview controls in top toolbar.
 *
 * - Outputs a button group with:
 *      - "Open Builder" / "Preview" / "Refresh Preview".
 *      - "Save Form" button that calls wpbc_bfb__ajax_save_current_form() with busy state.
 *
 * Hooked into: wpbc_ui_el__top_nav__content_end
 *
 * @param string $page_tag           Current page tag.
 * @param string $active_page_tab    Current tab.
 * @param string $active_page_subtab Current subtab.
 *
 * @return void
 */
function wpbc_bfb__top_toolbar__show_save_buttons( $page_tag, $active_page_tab, $active_page_subtab ) {

	if ( ! wpbc_is_builder_booking_form_page() ) {
		return;
	}

	// Save to DB (same action as before, now via JS helper).
	$ajax_action_bfb = 'WPBC_AJX_BFB_SAVE_FORM_CONFIG';
	$ajax_nonce_bfb  = wp_create_nonce( 'wpbc_bfb_form_save' );

	$default_form_key   = 'default_booking_form';
	$default_form_title = 'Standard';
	?>
	<div class="wpbc_ui_el__buttons_group wpbc_bfb__top_toolbar_group">
		<button
			type="button"
			class="button button-primary wpbc_bfb_ui__elements_show_in_preview"
			data-wpbc-bfb-top-refresh-btn="1"
			data-wpbc-u-busy-text="<?php esc_attr_e( 'Loading preview', 'booking' ); ?>...">
			<?php esc_html_e( 'Refresh Preview', 'booking' ); ?>
		</button>

		<!-- data-wpbc-bfb-save-source="auto|builder|advanced"  -->
		<a  href="javascript:void(0);"
			class="button button-primary wpbc_bfb_ui__elements_hide_in_preview"
			onclick="wpbc_bfb__ajax_save_current_form(this);"
			data-wpbc-bfb-save-source="<?php echo esc_attr( class_exists( 'wpdev_bk_personal' ) ? 'auto' : 'builder' ); ?>"
			data-wpbc-bfb-save-nonce="<?php echo esc_attr( $ajax_nonce_bfb ); ?>"
			data-wpbc-bfb-save-action="<?php echo esc_attr( $ajax_action_bfb ); ?>"
			data-wpbc-bfb-form-key="<?php echo esc_attr( $default_form_key ); ?>"
			data-wpbc-bfb-form-title="<?php echo esc_attr( $default_form_title ); ?>"
			data-wpbc-u-busy-text="<?php esc_attr_e( 'Saving', 'booking' ); ?>...">
			<?php esc_html_e( 'Save Form', 'booking' ); ?>
		</a>
	</div>
	<?php
}
add_action( 'wpbc_ui_el__top_nav__content_end', 'wpbc_bfb__top_toolbar__show_save_buttons', 20, 3 );

/**
 * Show Form Builder save + preview controls in top toolbar.
 *
 * - Outputs a button group with:
 *      - "Open Builder" / "Preview" / "Refresh Preview".
 *      - "Save Form" button that calls wpbc_bfb__ajax_save_current_form() with busy state.
 *
 * Hooked into: wpbc_ui_el__top_nav__content_end
 *
 * @param string $page_tag           Current page tag.
 * @param string $active_page_tab    Current tab.
 * @param string $active_page_subtab Current subtab.
 *
 * @return void
 */
function wpbc_bfb__top_toolbar__show_preview_buttons( $page_tag, $active_page_tab, $active_page_subtab ) {

	if ( ! wpbc_is_builder_booking_form_page() ) {
		return;
	}

	wpbc_bfb__top_toolbar__render_live_source_badge();

	// Save to DB (same action as before, now via JS helper).
	$ajax_action_bfb = 'WPBC_AJX_BFB_SAVE_FORM_CONFIG';
	$ajax_nonce_bfb  = wp_create_nonce( 'wpbc_bfb_form_save' );

	$default_form_key   = 'default_booking_form';
	$default_form_title = 'Standard';
	?>
	<div class="wpbc_ui_el__buttons_group wpbc_bfb__top_toolbar_group">
		<?php
		// --- Preview-mode buttons (visible only when body has .wpbc_bfb__mode_preview) ------------------------------
		?>
		<a  href="#" class="button button-secondary wpbc_bfb__top_btn_builder wpbc_bfb_ui__elements_show_in_preview" data-wpbc-bfb-top-builder-btn="1">
			<?php esc_html_e( 'Back to Form Builder', 'booking' ); ?>
		</a>
		<?php
		// --- Builder-mode buttons (default; hidden in preview mode) ---------------------------------------------------
		// Can be data-wpbc-bfb-preview-source = 'builder' | 'advanced' | 'auto'
		if (1) {
			?>
			<div class="wpbc_ajx_toolbar wpbc_no_borders ">
				<div class="ui_container ui_container_small">
					<div class="ui_group ui_group__publish_preview_buttons">
						<div class="ui_element">
							<a class="wpbc_ui_control wpbc_ui_button tooltip_top      wpbc_bfb__top_btn_preview wpbc_bfb_ui__elements_hide_in_preview"
								data-wpbc-bfb-top-preview-btn="1"
								data-wpbc-u-busy-text="<?php esc_attr_e( 'Loading preview', 'booking' ); ?>..."
								data-wpbc-bfb-preview-source="<?php echo esc_attr( class_exists( 'wpdev_bk_personal' ) ? 'auto' : 'builder' ); ?>"
								data-original-title="<?php esc_attr_e( 'Preview this booking form in your theme', 'booking' ); ?>">
									<i class="menu_icon icon-1x wpbc_icn_visibility"></i>
									<span class="in-button-text">&nbsp;&nbsp;<?php esc_html_e( 'Preview', 'booking' ); ?></span>
							</a>
							<a class="wpbc_ui_control wpbc_ui_button wpbc_ui_button_green tooltip_top wpbc_bfb__top_btn_publish wpbc_bfb_ui__elements_hide_in_preview"
								data-wpbc-bfb-top-publish-btn="1"
								data-wpbc-bfb-resource-id="<?php echo esc_attr( wpbc_get_default_resource() ); ?>"
								data-wpbc-bfb-shortcode-raw="<?php echo esc_attr( '[booking resource_id=' . absint( wpbc_get_default_resource() ) . ' form_type=\'standard\']' ); ?>"
								data-original-title="<?php esc_attr_e( 'Embed your booking form into the page', 'booking' ); ?>"
								href="#"
							>
								<i class="menu_icon icon-1x wpbc_icn_code"></i>
								<span class="in-button-text">&nbsp;&nbsp;<?php esc_html_e( 'Publish', 'booking' ); ?></span>
							</a>
<?php if(0){ ?>
							<a class="wpbc_ui_control wpbc_ui_button wpbc_ui_button_green tooltip_top      wpbc_bfb__top_btn_publish wpbc_bfb_ui__elements_hide_in_preview"
								data-wpbc-bfb-top-publish-btn="1"
								data-original-title="<?php esc_attr_e('Embed your booking form into the page', 'booking'); ?>"
							   href="<?php echo esc_url(  'admin.php?page=wpbc-resources' ); ?>"
							   <?php
							   /* href="javascript:void(0);" onclick="javascript: wpbc_modal_dialog__show__resource_publish( <?php echo esc_attr( wpbc_get_default_resource() ); ?> );" */
							   ?>
							>
									<i class="menu_icon icon-1x wpbc_icn_code"></i>
									<span class="in-button-text">&nbsp;&nbsp;<?php esc_html_e( 'Publish', 'booking' ); ?></span>
							</a>
							<!--input name="wpbc_text_put_in_shortcode" id="wpbc_text_put_in_shortcode" class="put-in" readonly="readonly" onfocus="this.select()" type="text" style="width: auto;flex: 1;" /-->
<?php } ?>
<?php if(0){ ?>
							<a class="wpbc_ui_control wpbc_ui_button wpbc_ui_button_green tooltip_top      wpbc_bfb__top_btn_publish wpbc_bfb_ui__elements_hide_in_preview"
								data-wpbc-bfb-top-publish-btn="1"
								data-original-title="<?php esc_attr_e('Embed your booking form into the page', 'booking'); ?>"
								href="javascript:void(0);" onclick="javascript: wpbc_resource_page_btn_click(<?php echo esc_attr( wpbc_get_default_resource() ); ?>);"
							>
									<i class="menu_icon icon-1x wpbc_icn_code"></i>
									<span class="in-button-text">&nbsp;&nbsp;<?php esc_html_e( 'Shortcode', 'booking' ); ?></span>
							</a>
							<input name="booking_resource_shortcode_<?php echo esc_attr( wpbc_get_default_resource() ); ?>"
								   id="booking_resource_shortcode_<?php echo esc_attr( wpbc_get_default_resource() ); ?>"
								   class="put-in" readonly="readonly" onfocus="this.select()" type="text" style="width: auto;flex: 1;border-radius: 0 2px 2px 0;font-size: 9px;" />
<?php } ?>
						</div>
					</div>
				</div>
			</div>
			<?php

		} else {
			?>
			<a  href="#" class="button button-secondary wpbc_bfb__top_btn_preview wpbc_bfb_ui__elements_hide_in_preview" data-wpbc-bfb-top-preview-btn="1"
				data-wpbc-u-busy-text="<?php esc_attr_e( 'Loading preview', 'booking' ); ?>..."
				data-wpbc-bfb-preview-source="<?php echo esc_attr( class_exists( 'wpdev_bk_personal' ) ? 'auto' : 'builder' ); ?>"
			>
				<?php esc_html_e( 'Preview', 'booking' ); ?>
			</a>
			<?php
		}

		?>
	</div>
	<?php
}
add_action( 'wpbc_ui_el__top_nav__content_end', 'wpbc_bfb__top_toolbar__show_preview_buttons', 10, 3 );



/**
 * Render "Live source" badge placeholder for Builder/Advanced sync state.
 *
 * JS will update:
 * - data-wpbc-bfb-live-source: builder|advanced
 * - data-wpbc-bfb-sync-mode  : on|off
 *
 * @param array $args Optional args.
 *
 * @return void
 */
function wpbc_bfb__top_toolbar__render_live_source_badge() {

	?>
	<div class="wpbc_bfb__live_status wpbc_bfb__live_status__builder"><?php echo esc_html__( 'Live: Builder (auto-sync ON)', 'booking' ); ?></div>
	<div class="wpbc_bfb__live_status wpbc_bfb__live_status__advanced"><?php echo esc_html__( 'Live: Advanced (manual)', 'booking' ); ?></div>
	<?php
}

function wpbc_bfb__top_toolbar__show_form_name( $page_tag, $active_page_tab, $active_page_subtab ) {

	if ( ! wpbc_is_builder_booking_form_page() ) {
		return;
	}
	/*
	?>
	<div class="wpbc_bfb__hint__form_name">
		<div class="wpbc_bfb__hint__form_name__label"><?php esc_html_e( 'Form Name', 'booking' ); ?>:</div>
		<div class="wpbc_bfb__hint__form_name__title"><?php esc_html_e( 'Loading', 'booking' ); ?>...</div>
	</div>
	<?php
	*/

	$picture_field_id = 'wpbc_bfb_setting__bfb_form_details__picture_url';
	?>
	<div class="wpbc_bfb__hint__form_name wpbc_bfb__hint__top_bar">
		<div class="wpbc_bfb__form_details_media__preview wpbc_media_upload_button"
					role="button"
					tabindex="0"
					aria-label="<?php echo esc_attr__( 'Selected image preview', 'booking' ); ?>"
					data-modal_title="<?php echo esc_attr__( 'Select Image', 'booking' ); ?>"
					data-btn_title="<?php echo esc_attr__( 'Use this image', 'booking' ); ?>"
					data-url_field="<?php echo esc_attr( $picture_field_id ); ?>"
		>
			<img src="" alt="" class="wpbc_bfb__form_details_media__img">
			<i class="wpbc_bfb__form_details_media__placeholder menu_icon icon-1x wpbc-bi-image-fill" aria-hidden="true"></i>
		</div>
		<div class="wpbc_bfb__hint__form_name__name">
			<div class="wpbc_bfb__hint__form_name__title">
				<!-- onclick="javascript:document.querySelector( '[aria-controls=\"wpbc_bfb__inspector_form_details\"]' ).click();" -->
				<a href="javascript:void(0);" class="value" ><?php esc_html_e( 'Loading', 'booking' ); ?>...</a>
			</div>
			<div class="wpbc_bfb__hint__form_name__label">
				<?php esc_html_e( 'Slug', 'booking' ); ?>:
				<div class="wpbc_bfb__hint__form_name__slug"><span class="value"></span></div>
				<i class="menu_icon icon-1x wpbc-bi-pencil0 wpbc-bi-question-circle" aria-hidden="true" title="<?php esc_attr_e( 'Unique identifier used by the system in shortcodes', 'booking' ); ?>"></i>
			</div>
		</div>
	</div>
	<?php
}
add_action( 'wpbc_ui_el__top_nav__content_center', 'wpbc_bfb__top_toolbar__show_form_name', 10, 3 );
// ---------------------------------------------------------------------------------------------------------------------
// In Page Content - Controls
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Render "Add columns" control template for the Form Builder toolbar.
 *
 * This control renders a dropdown that allows to add a new section
 * with 1–4 columns into the form builder canvas.
 *
 * The template is hidden by default and cloned/used by JS.
 *
 * @return void
 */
function wpbc_bfb__ui__add_columns_control() {
	?>
	<div id="wpbc_bfb__add_columns_template" class="add_columns_control_template" hidden>
		<?php
		$el_arr = array(
			'font_icon'       => 'wpbc_icn_add_circle',
			'title'           => '<span class="nav-tab-text hide_in_mobile">' . esc_html__( 'Add columns', 'booking' ) . ' </span><span class="selected_value"></span>',
			'hint'            => array(
				'title'    => __( 'Select to add columns', 'booking' ),
				'position' => 'top',
			),
			'position'        => 'left',
			'has_down_arrow'  => true,
			'has_border'      => true,
			'container_class' => 'ul_dropdown_menu__add_sections',
			'items'           => array(
				array(
					'type'  => 'header',
					'title' => __( 'Add section with', 'booking' ) . '...',
					'class' => 'hide_button_if_no_selection',
				),
				array( 'html' => wpbc_bfb__ui__add_columns__get_option( 1 ) ),
				array( 'html' => wpbc_bfb__ui__add_columns__get_option( 2 ) ),
				array( 'html' => wpbc_bfb__ui__add_columns__get_option( 3 ) ),
				array( 'html' => wpbc_bfb__ui__add_columns__get_option( 4 ) ),
			),
		);

		wpbc_ui_el__dropdown_menu( $el_arr );
		?>
	</div>
	<?php
}

/**
 * Get HTML for a single "Add columns" option.
 *
 * @param int $column_number Number of columns to add (1–4).
 *
 * @return string
 */
function wpbc_bfb__ui__add_columns__get_option( $column_number ) {
	$column_number = (int) $column_number;

	$css_class = 'ul_dropdown_menu_li_action ul_dropdown_menu_li_action_add_sections';

	// Prepare label: "1 Column" / "2 Columns".
	$label_single = __( 'Column', 'booking' );
	$label_plural = __( 'Columns', 'booking' );
	$label        = ( 1 === $column_number ) ? $label_single : $label_plural;

	// Build icon class depending on the number of columns.
	switch ( $column_number ) {
		case 1:
			$icon_class = 'wpbc-bi-square';
			break;
		case 2:
			$icon_class = 'wpbc-bi-layout-split';
			break;
		case 3:
			$icon_class = 'wpbc-bi-layout-three-columns';
			break;
		case 4:
			$icon_class = 'wpbc_icn_calendar_view_week';
			break;
		default:
			$icon_class = 'wpbc-bi-square';
			break;
	}

	$html  = '<a href="javascript:void(0)"';
	$html .= ' class="' . esc_attr( $css_class ) . '"';
	$html .= ' data-cols="' . esc_attr( $column_number ) . '"';
	$html .= ' title="' . esc_attr( __( 'Add columns', 'booking' ) ) . '"';
	$html .= '>';
	$html .= sprintf(
		'%d %s <i class="menu_icon icon-1x %s"></i>',
		absint( $column_number ),
		esc_html( $label ),
		esc_attr( $icon_class )
	);
	$html .= '</a>';

	return $html;
}

/**
 * Show fullscreen warning for mobile / small-screen usage of the Form Builder.
 *
 * The builder is optimized for desktop. This fullscreen overlay warns users on
 * small screens and lets them continue or close the notice.
 *
 * @return void
 */
function wpbc_bfb__ui__show_warning__no_mobile_mode() {
	?>
	<div id="wpbc-builder-mobile-notice" class="wpbc-fullscreen-notice">
		<div class="wpbc-fullscreen-big-logo">
			<?php
			// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			echo wpbc_get_svg_logo_for_html(
				array(
					'svg_color'     => '#fff',
					'svg_color_alt' => '#bbb',
					'opacity'       => '0.35',
					'style_default' => 'background-repeat: no-repeat; background-position: center; display: inline-block; vertical-align: middle;',
					'style_adjust'  => 'background-size: 40px auto; width: 40px; height: 40px; margin-top: 0px;',  // This parameters, the adjust size of the logo and position.
					'css_class'     => '',
				)
			);
			?>
			<span class="wpbc-fullscreen-big-logo-title"><span class="wpbc-fullscreen-big-logo-title-wp">WP</span>Booking Calendar</span>
		</div>
		<h3><?php esc_html_e( 'Our booking form builder is optimized for desktop computers.', 'booking' ); ?></h3>
		<p><?php esc_html_e( 'We recommend that you edit your forms on a bigger screen. If you\'d like to proceed, please understand that some functionality might not behave as expected.', 'booking' ); ?></p>
		<div class=" ">
			<button type="button" class="button-secondary" onclick="javascript: jQuery( '.wpbc-fullscreen-notice').hide();"><?php esc_html_e( 'Continue', 'booking' ); ?></button>
			<button type="button" class="wpbc_bfb__button-close" onclick="javascript: jQuery( '.wpbc-fullscreen-notice').hide();" title="<?php esc_attr_e( 'Close', 'booking' ); ?>" aria-label="<?php esc_attr_e( 'Close', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc_icn_close"></i></button>
		</div>
	</div>
	<style type="text/css">
		@media (min-width: 1024px) {
			#wpbc-builder-mobile-notice {
				display: none;
			}
			.wpbc_settings_page_wrapper.max .wpbc_settings_page_content .wpbc_page {
				display: block;
			}
		}
		.wpbc-fullscreen-notice {
			background: #f5f6f7;
			cursor: default;
			height: 100%;
			min-width: 0;
			padding: 0 20px;
			overflow: scroll;
			position: fixed;
			z-index: 100110;
			text-align: center;
			top: 0;
			right: 0;
			bottom: 0;
			left: 0;
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			background: #374655;
			scrollbar-width: thin;
		}
		.wpbc-fullscreen-notice * {
			color: #fff;
		}
		.wpbc-fullscreen-big-logo {
			display: flex;
			flex-flow: row nowrap;
			align-items: center;
			justify-content: flex-start;
			gap: 10px;
			position: absolute;
			top: 20px;
			left: 20px;
		}
		.wpbc-fullscreen-big-logo-title {
			margin: -15px 0 0 0;
			font-size: 25px;
			padding: 0;
			font-weight: 600;
		}
		.wpbc-fullscreen-big-logo-title-wp {
			position: absolute;
			font-size: 10px;
			margin-top: 18px;
			margin-left: 1px;
			font-weight: 501;
		}
		.wpbc-fullscreen-notice h3{
			line-height: 1.74em;
			font-size: 24px;
		}
		.wpbc-fullscreen-notice .wpbc_bfb__button-close {
			position: absolute;
			top: 20px;
			right:20px;
			margin: 0;
			border: 0;
			padding: 0;
			vertical-align: middle;
			background: 0 0;
			height: auto;
			box-sizing: border-box;
			cursor: pointer;
		}
		.wpbc-fullscreen-notice .wpbc_bfb__button-close .wpbc_icn_close::before {
			font-size: 22px;
		}
	</style>
	<?php
}
