<?php
/**
 * Booking Form Builder – Admin Page.
 *
 * Responsibilities:
 * - Register tab & page placement.
 * - Capability & MU checks.
 * - Render page scaffolding (containers only).
 * - Enqueue assets and localize boot data.
 *
 * @package     : Booking Calendar
 * @subpackage  : Admin Pages
 * @Plugin_URI  : https://wpbookingcalendar.com
 * @Author_URI  : https://wpbookingcalendar.com
 * @Author      : wpdevelop, oplugins
 * @Version     : 0.0.1
 * @since       : 10.14.x
 * @modified    : 2025-07-09
 */

// ---------------------------------------------------------------------------------------------------------------------
// == File  builder-form-page.php == Time point: 2025-08-29 12:25
// ---------------------------------------------------------------------------------------------------------------------
if ( ! defined( 'ABSPATH' ) ) {
	exit;  // Exit if accessed directly.
}


/** Show Content
 *  Update Content
 *  Define Slug
 *  Define where to show
 */
class WPBC_Page_Builder_Booking_Form extends WPBC_Page_Structure {

	// -- Tabs ---------------------------------------------------------------------------------------------------------

	/**
	 * == What Page ? ==
	 *
	 * @return string
	 */
	public function in_page() {
		return 'wpbc-settings';
	}

	/**
	 * == Tabs ==
	 *
	 * @return array
	 */
    public function tabs() {

		$tabs = array();
		$tabs['builder_booking_form'] = array(
			'is_default_full_screen'                    => true,                             // true | false.  By default value is: false.
			'is_show_top_path'                          => false,                             // true | false.  By default value is: false.
			'is_show_top_navigation'                    => false,                            // true | false.  By default value is: false.
			'right_vertical_sidebar__is_show'           => true,                             // true | false.  By default value is: false.
			'right_vertical_sidebar__default_view_mode' => '',                               // '' | 'min' | 'compact' | 'max' | 'none'.  By default value is: ''.
			'right_vertical_sidebar_compact__is_show'   => true,                             // true | false.  By default value is: false.
			'left_navigation__default_view_mode'        => 'compact',                        // '' | 'min' | 'compact' | 'max' | 'none'.  By default value is: ''.

			'title' 									=> __( 'Forms Builder', 'booking' ) .                            // Title of TAB.
														   '<span class="wpbc_new_label" style="margin-left: auto;">' . esc_html__( 'New', 'booking' ) . '</span>',
			'hint'                                      => '',                            //__( 'Define available and unavailable days for your calendar(s).', 'booking' ),     // Hint.
			'page_title'                                => __( 'Forms Builder', 'booking' ),                            // Title of Page.
			'link'                                      => '',                            // Can be skiped,  then generated link based on Page and Tab tags. Or can  be extenral link.
			'position'                                  => '',                            // 'left'  /  'right'  /  ''.
			'css_classes'                               => '',                            // CSS c l a s s(es).
			'icon'                                      => '',                            // Icon - link to the real PNG img.
			'font_icon'                                 => 'wpbc_icn_flip_x0 wpbc-bi-input-cursor-text  0layout-text-window-reverse',                            // 'wpbc_icn_free_cancellation' // CSS definition  of forn Icon.
			'font_icon_right'                           => '',                               // 'wpbc-bi-asterisk',
			'default'                                   => false,                            // Is this tab activated by default or not: true || false.
			'disabled'                                  => false,                            // Is this tab disbaled: true || false.
			'hided'                                     => false,                            // Is this tab hided: true || false.
			'subtabs'                                   => array(),
			'folder_style'                              => 'order:12;',
		);
        return $tabs;
    }

	// --  Right Sidebar -----------------------------------------------------------------------------------------------

	/**
	 * == Right | Sidebar Compact | Content ==
	 *
	 * @return void
	 */
	public function right_sidebar_compact_content() {
		?>
		<div class="wpbc_bfb__rightbar_tabs" role="tablist" aria-label="<?php esc_attr_e( 'Form Builder Panels', 'booking' ); ?>">
			<div class="wpbc_ui_el__level__folder">
				<div class="wpbc_ui_el__vert_nav_item wpbc_ui_el__vert_nav_item__builder_booking_form">
					<button type="button" id="wpbc_tab_library"
							class="wpbc_ui_el__vert_nav_item__a wpbc_ui_el__vert_nav_item__single"
							role="tab" aria-controls="wpbc_bfb__palette_add_new" aria-selected="true" >
						<i class="wpbc_ui_el__vert_nav_icon tooltip_right_offset menu_icon icon-1x wpbc_icn_add_circle" aria-hidden="true" data-original-title="<?php esc_attr_e( 'Add New Fields', 'booking' ); ?>"></i>
						<span><?php esc_html_e( 'Add Fields', 'booking' ); ?></span>
					</button>
				</div>
			</div>
			<div class="wpbc_ui_el__level__folder">
				<div class="wpbc_ui_el__vert_nav_item wpbc_ui_el__vert_nav_item__builder_booking_form">
					<button type="button" id="wpbc_tab_inspector"
							class="wpbc_ui_el__vert_nav_item__a wpbc_ui_el__vert_nav_item__single"
							role="tab" aria-controls="wpbc_bfb__inspector" aria-selected="false" >
						<i class="wpbc_ui_el__vert_nav_icon tooltip_right_offset menu_icon icon-1x wpbc-bi-input-cursor-text" aria-hidden="true" data-original-title="<?php esc_attr_e( 'Edit Field Options', 'booking' ); ?>"></i>
						<span><?php esc_html_e( 'Edit Field', 'booking' ); ?></span>
					</button>
				</div>
			</div>
			<div class="wpbc_ui_el__level__folder">
				<div class="wpbc_ui_el__vert_nav_item wpbc_ui_el__vert_nav_item__builder_booking_form">
					<button type="button" id="wpbc_tab_formdetails"
							class="wpbc_ui_el__vert_nav_item__a wpbc_ui_el__vert_nav_item__single"
							role="tab" aria-controls="wpbc_bfb__inspector_form_details" aria-selected="false" >
						<i class="wpbc_ui_el__vert_nav_icon tooltip_right_offset menu_icon icon-1x 0wpbc_icn_widgets 0wpbc_icn_rotate_90 wpbc-bi-postcard" aria-hidden="true" data-original-title="<?php esc_attr_e( 'Details', 'booking' ); ?>"></i>
						<span><?php esc_html_e( 'Details', 'booking' ); ?></span>
					</button>
				</div>
			</div>
			<div class="wpbc_ui_el__level__folder">
				<div class="wpbc_ui_el__vert_nav_item wpbc_ui_el__vert_nav_item__builder_booking_form">
					<button type="button" id="wpbc_tab_form"
							class="wpbc_ui_el__vert_nav_item__a wpbc_ui_el__vert_nav_item__single"
							role="tab" aria-controls="wpbc_bfb__inspector_form_settings" aria-selected="false" >
						<i class="wpbc_ui_el__vert_nav_icon tooltip_right_offset menu_icon icon-1x wpbc_icn_tune" aria-hidden="true" data-original-title="<?php esc_attr_e( 'Booking Form Settings', 'booking' ); ?>"></i>
						<span><?php esc_html_e( 'Settings', 'booking' ); ?></span>
					</button>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * == Right Sidebar Content ==
	 *
	 * @return void
	 */
	public function right_sidebar_content() {
		?>
		<!-- RIGHT SIDE: Panels container -->
		<div class="wpbc_bfb__panel--library">
			<!-- Add Fields (Library) — default visible -->
			<div id="wpbc_bfb__palette_add_new"
					class="wpbc_bfb__palette_add_new wpbc_bfb__palette_panel  wpbc_collapsible wpbc_collapsible--exclusive"
					role="tabpanel"
					aria-labelledby="wpbc_tab_library"
					aria-hidden="false">
					<?php
					$this->palette_add_new__content();
					?>
			</div>

			<!-- Edit Field (Inspector) — default hidden -->
			<div id="wpbc_bfb__inspector"
					class="wpbc_bfb__inspector wpbc_bfb__palette_panel  wpbc_collapsible wpbc_collapsible--exclusive"
					role="tabpanel"
					aria-labelledby="wpbc_tab_inspector"
					hidden
					aria-hidden="true">
				<div class="wpbc_bfb__inspector__body">
					<div class="wpbc_bfb__inspector__empty">
						<?php
						esc_html_e( 'Select a field to edit its options.', 'booking' );
						?>
					</div>
				</div>
			</div>

			<!-- Settings Options — default hidden -->
			<div id="wpbc_bfb__inspector_form_settings"
					class="wpbc_bfb__inspector_form_settings wpbc_bfb__palette_panel wpbc_collapsible wpbc_collapsible--exclusive"
					role="tabpanel"
					aria-labelledby="wpbc_tab_form"
					hidden
					aria-hidden="true">
				<div class="wpbc_bfb__inspector__head">
					<div class="header_container">
						<div class="header_title_content">
							<h3 class="title"><?php esc_html_e( 'Global Form Settings', 'booking' ); ?></h3>
							<div class="desc"><?php esc_html_e( 'Setup settings for entire form. These settings usually aplies globally to all forms.', 'booking' ); ?></div>
						</div>
					</div>
				</div>
				<div class="wpbc_bfb__inspector__body">
					<?php
				   	wpbc_bfb_ui__settings_options__print();
					?>
				</div>
			</div>

			<!-- Settings Options — default hidden -->
			<div id="wpbc_bfb__inspector_form_details"
					class="wpbc_bfb__inspector_form_details wpbc_bfb__palette_panel wpbc_collapsible wpbc_collapsible--exclusive"
					role="tabpanel"
					aria-labelledby="wpbc_tab_form"
					hidden
					aria-hidden="true">
				<div class="wpbc_bfb__inspector__head">
					<div class="header_container">
						<div class="header_title_content">
							<h3 class="title"><?php esc_html_e( 'Form Details', 'booking' ); ?></h3>
							<div class="desc"><?php esc_html_e( 'These details are saved together with the form when you click “Save Form”.', 'booking' ); ?></div>
						</div>
					</div>
				</div>
				<div class="wpbc_bfb__inspector__body">
					<?php
					wpbc_bfb_ui__current_form_details__print();
					?>
				</div>
			</div>

		</div>
		<?php
	}

	/**
	 * "Add New Fields" - "Palette" - Right Side.
	 *
	 * @return void
	 */
	private function palette_add_new__content() {
		?>
		<div class="wpbc_bfb__inspector__body">
			<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group is-open"  data-group="fields-essentials">
				<button type="button" class="group__header"><h3><?php esc_html_e( 'Booking Essentials', 'booking' ); ?></h3><i
						class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields">
					<ul class="wpbc_bfb__panel_field_types__ul">
						<?php
						/** Let packs target "general" if they want */
						do_action( 'wpbc_bfb_palette_register_items', 'essentials', 'top' );
						do_action( 'wpbc_bfb_palette_register_items', 'essentials', 'bottom' );
						?>
					</ul>
				</div>
			</section>

			<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group"  data-group="fields-standard">
				<button type="button" class="group__header"><h3><?php esc_html_e( 'Fields', 'booking' ); ?></h3><i
						class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields">
					<ul class="wpbc_bfb__panel_field_types__ul">
						<?php
						/** Let packs target "general" if they want */
						do_action( 'wpbc_bfb_palette_register_items', 'standard', 'top' );
						do_action( 'wpbc_bfb_palette_register_items', 'standard', 'bottom' );
						?>
					</ul>
				</div>
			</section>

			<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group"  data-group="fields-times">
				<button type="button" class="group__header"><h3><?php esc_html_e( 'Time & Services', 'booking' ); ?></h3><i
						class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields">
					<ul class="wpbc_bfb__panel_field_types__ul">
						<?php
						/** Let packs target "general" if they want */
						do_action( 'wpbc_bfb_palette_register_items', 'times', 'top' );
						do_action( 'wpbc_bfb_palette_register_items', 'times', 'bottom' );
						?>
					</ul>
				</div>
			</section>

			<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group"  data-group="fields-layout">
				<button type="button" class="group__header"><h3><?php esc_html_e( 'Layout', 'booking' ); ?></h3><i
						class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields">
					<ul class="wpbc_bfb__panel_field_types__ul">
						<?php
						/** Let packs target "structure" if they want */
						do_action( 'wpbc_bfb_palette_register_items', 'layout', 'top' );
						do_action( 'wpbc_bfb_palette_register_items', 'layout', 'bottom' );
						?>
					</ul>
				</div>
			</section>

			<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="fields-navigation">
				<button type="button" class="group__header"><h3><?php esc_html_e( 'Multi-Step & Navigation', 'booking' ); ?></h3><i
						class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields">

					<ul class="wpbc_bfb__panel_field_types__ul">
						<?php
						/** Let packs target "advanced" if they want */
						do_action( 'wpbc_bfb_palette_register_items', 'navigation', 'top' );
						do_action( 'wpbc_bfb_palette_register_items', 'navigation', 'bottom' );
						?>
					</ul>

				</div>
			</section>

		</div>
		<?php
	}

	// -- Content ------------------------------------------------------------------------------------------------------

	/**
	 * == Page Content ==
	 *
	 * @return false|void
	 */
	public function content() {

		do_action( 'wpbc_hook_settings_page_header', 'page_booking_builder_booking_form' );                             // Define Notices Section and show some static messages, if needed.

		if ( ! wpbc_is_mu_user_can_be_here( 'activated_user' ) ) { return false; }                                      // Check if MU user activated, otherwise show Warning message.
		// if ( ! wpbc_set_default_resource_to__get() ) return false;                  						            // Define default booking resources for $_GET  and  check if booking resource belong to user.
		wpbc_js_for_bookings_page();                                                                                    // JavaScript functions.

		wpbc_bfb__adavanced_mode__enqueue_code_editor_for_advanced_tab();

		wpbc_bfb__ui__show_warning__no_mobile_mode();

		echo '<div id="wpbc_log_screen" class="wpbc_log_screen"></div>';

		wpbc_bfb__ui__add_columns_control();

		// == Expose AJAX settings to JS on the Builder page ==
		wpbc_bfb_output_ajax_boot_config();

		// == Top Horizontal menu ==
		$tabs_config = array(
			'builder_tab'  => array(
				'title'       => __( 'Form Builder', 'booking' ) . ' (Visual)',
				'type'        => 'panel',
				'css_classes' => '',
				'data_attr'   => array(
					'data-wpbc-bfb-top-builder-btn' => '1',
				),
			),
			'advanced_tab' => array(
				'title'       => __( 'Advanced Mode', 'booking' ) . ' (Code)',
				'type'        => 'panel',
				'css_classes' => '',
				'data_attr'   => array(
					'data-wpbc-bfb-top-advanced-btn' => '1',
				),
			),
		);
		if ( WPBC_BFB_DEBUG ) {
			$tabs_config['debug_tab'] = array(
				'title'       => __( 'Debug', 'booking' ),
				'type'        => 'panel',
				'css_classes' => 'align_right small_debug_tab',
				'hint'        => array(
					'title'    => __( 'Show debug export outputs', 'booking' ),
					'position' => 'top',
				),
			);
		}
		$tabs_config = apply_filters( 'wpbc_bfb_ui__top_tabs', $tabs_config, array() );

		// $preferred_tab_id = ( 'On' === get_bk_option( 'booking_is_use_simple_booking_form' ) ) ? 'advanced_tab' : 'builder_tab';
		$preferred_tab_id = 'builder_tab'; //TODO: make selection  based on  "bfb_options":{"advanced_mode_source":"builder"}
		$active_tab_id    = WPBC_BFB_UI_Top_Tabs::resolve_active_tab_id( $tabs_config, $preferred_tab_id );

		WPBC_BFB_UI_Top_Tabs::render(
			array(
				'active_tab'       => $active_tab_id,
				'tabs'             => $tabs_config,
				'nav_container_id' => 'wpbc_bfb__top_horisontal_nav',
				'panels_root_id'   => 'wpbc_bfb__top_panels',
				'panel_base_class' => 'wpbc_bfb__top_tab_section',
			)
		);


		// == Content ==
		?>
		<div id="wpbc_bfb__top_panels">
			<!-- BFB Content. -->
			<div class="wpbc_bfb__tab_section wpbc_bfb__tab_section__builder_tab wpbc_bfb__top_tab_section wpbc_bfb__top_tab_section__builder_tab" <?php echo WPBC_BFB_UI_Top_Tabs::get_panel_hidden_attr( 'builder_tab', $active_tab_id );/* phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped */ ?>>
				<div class="wpbc_bfb__container">
				<!-- LEFT SIDE: Pages -->
					<div id="wpbc_bfb__theme_scope" class="wpbc_bfb__theme_scope">
						<div id="wpbc_bfb__pages_panel" class="wpbc_bfb__pages_panel">
							<!-- Events binded to this element! -->
							<div id="wpbc_bfb__pages_container">
								<!-- This is loader spin -->
								<div class="wpbc_bfb__panel wpbc_bfb__panel--preview  wpbc_bfb_form wpbc_container wpbc_form wpbc_container_booking_form">
									<div class="wpbc_bfb__form_preview_section_container wpbc_wizard__border_container" style="margin: 20px 0;box-sizing: border-box;width: auto;min-height: Min(50vh, 300px);display: flex;flex-flow: column nowrap;justify-content: center;" >
										<?php wpbc_bfb_spins_loading_container_mini(); ?>
									</div>
								</div>
							</div>
							<div style="display:flex;margin:20px;flex-flow: row wrap;align-items: center;justify-content: center;">
								<button class="button button-primary wpbc_ui_button wpbc_bs_button_green" id="wpbc_bfb__add_page_btn" aria-label="<?php esc_attr_e( 'Add Page', 'booking' ); ?>">+ <?php esc_html_e( 'Add Page', 'booking' ); ?></button>
							</div>
						</div>
					</div>
				</div>
			</div>
			<!-- Advanced Mode Content tab -->
			<div class="wpbc_bfb__tab_section wpbc_bfb__tab_section__advanced_tab wpbc_bfb__top_tab_section wpbc_bfb__top_tab_section__advanced_tab"
				<?php echo WPBC_BFB_UI_Top_Tabs::get_panel_hidden_attr( 'advanced_tab', $active_tab_id );  /* phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped */ ?>
			><?php

				//--------------------------------------------------------------------------------------------------------------
				// 'Upgrade to Pro' widget
				//--------------------------------------------------------------------------------------------------------------
				$upgrade_content_arr = wpbc_get_upgrade_widget(
					array(
						'id'                 => 'widget_wpbc_dismiss__booking_form_advanced_mode',
						'dismiss_css_class'  => '.wpbc_dismiss__booking_form_advanced_mode',
						'blured_in_versions' => array( 'free' ),
						'feature_link'       => array( 'title' => 'feature', 'relative_url' => 'overview/#booking-resources' ),
						'upgrade_link'       => array( 'title' => 'Upgrade to Pro', 'relative_url' => 'features/#bk_news_section' ),
						'versions'           => 'paid versions',
						'css'                => 'transform: translate(0) translateY(290px);',
						'no_dismiss'         => true
					)
				);
				echo $upgrade_content_arr['content'];  // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped

				?><div class="<?php echo esc_attr( $upgrade_content_arr['maybe_blur_css_class'] ); ?>"><?php

					wpbc_bfb__adavanced_mode__render_advanced_form_editor_panel();

				?></div><?php

			?>
			</div>
			<?php if ( WPBC_BFB_DEBUG ) { ?>
			<!-- Debug Mode tab -->
			<div class="wpbc_bfb__tab_section wpbc_bfb__tab_section__debug_tab wpbc_bfb__top_tab_section wpbc_bfb__top_tab_section__debug_tab"
					<?php echo WPBC_BFB_UI_Top_Tabs::get_panel_hidden_attr( 'debug_tab', $active_tab_id );  /* phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped */  ?>>

				<div id="wpbc_bfb__debug_export_panel" class="wpbc_bfb__debug_export_panel" aria-hidden="false">
					<!-- JS (builder-exporter.js) will inject three debug textareas here -->

					<!-- Tabs -->
					<?php

					$tabs_config_debug = array(
						'debug_mode__export' => array(
							'title'       => __( 'Export', 'booking' ),
							'type'        => 'panel',
							'css_classes' => '',
						),
						'debug_mode__import' => array(
							'title'       => __( 'Import', 'booking' ),
							'type'        => 'panel',
							'css_classes' => '',
						),
						'debug_mode__actual_bfb' => array(
							'title'       => __( 'Actual Builder Code', 'booking' ),
							'type'        => 'panel',
							'css_classes' => '',
						),
					);

					WPBC_BFB_UI_Top_Tabs::render(
						array(
							'active_tab'       => 'debug_mode__export',
							'tabs'             => $tabs_config_debug,
							'nav_container_id' => 'wpbc_bfb__top_horisontal__debug_mode',
							'panels_root_id'   => 'wpbc_bfb__debug_mode_panels',
						)
					);

					?>
					<div id="wpbc_bfb__debug_mode_panels">


						<div class="wpbc_bfb__tab_section wpbc_bfb__tab_section__debug_mode__export">
							<div class="wpbc_bfb__debug_block wpbc_bfb__debug_block--structure" style="margin-top: 14px;">
								<h4><?php
									esc_html_e( 'Form Structure', 'booking' ); echo ' — '; esc_html_e( 'Export', 'booking' ); echo ' (JSON)'; ?></h4>
								<textarea id="wpbc_bfb__structure_output" readonly="readonly"></textarea>
								<div style="margin-top: 8px;">
									<button type="button" class="button" data-wpbc-bfb-debug-action="copy" data-wpbc-bfb-debug-target="wpbc_bfb__structure_output"><?php esc_html_e( 'Copy to Clipboard', 'booking' ); ?></button>
								</div>
							</div>
							<div class="wpbc_bfb__debug_block wpbc_bfb__debug_block--settings" style="margin-top: 14px;">
								<h4><?php esc_html_e( 'Form Settings', 'booking' ); echo ' — '; esc_html_e( 'Export', 'booking' ); echo ' (JSON)'; ?></h4>
								<textarea id="wpbc_bfb__settings_output" readonly="readonly"></textarea>
								<div style="margin-top: 8px;">
									<button type="button" class="button" data-wpbc-bfb-debug-action="copy" data-wpbc-bfb-debug-target="wpbc_bfb__settings_output"><?php esc_html_e( 'Copy to Clipboard', 'booking' ); ?></button>
								</div>
							</div>
							<div style="flex:1 1 100%;"></div>
							<button type="button" class="button wpbc_bfb__debug_separate_button"
									onclick="var structure = window.wpbc_bfb && window.wpbc_bfb.get_structure ? window.wpbc_bfb.get_structure() : null; console.log(JSON.stringify(structure, null, 2));">
								<?php esc_html_e( 'Print JSON Structure in  Browser Console', 'booking' ); ?>
							</button>
						</div>

						<div class="wpbc_bfb__tab_section wpbc_bfb__tab_section__debug_mode__import">
							<div class="wpbc_bfb__debug_block wpbc_bfb__debug_block--structure-import" style="margin-top: 14px;">
								<h4><?php esc_html_e( 'Form Structure', 'booking' ); echo ' — '; esc_html_e( 'Import', 'booking' ); echo ' (JSON)'; ?></h4>
								<textarea id="wpbc_bfb__structure_import" ></textarea>
								<div style="margin-top: 8px;">
									<button type="button" class="button" data-wpbc-bfb-debug-action="copy" data-wpbc-bfb-debug-target="wpbc_bfb__structure_import"><?php esc_html_e( 'Copy to Clipboard', 'booking' ); ?></button>
									<button type="button" class="button button-primary" data-wpbc-bfb-debug-action="apply_structure"><?php esc_html_e( 'Apply Structure', 'booking' ); ?></button>
								</div>
							</div>
							<div class="wpbc_bfb__debug_block wpbc_bfb__debug_block--settings-import" style="margin-top: 14px;">
								<h4><?php esc_html_e( 'Form Settings', 'booking' ); echo ' — '; esc_html_e( 'Import', 'booking' ); echo ' (JSON)'; ?></h4>
								<textarea id="wpbc_bfb__settings_import" ></textarea>
								<div style="margin-top: 8px;">
									<button type="button" class="button" data-wpbc-bfb-debug-action="copy" data-wpbc-bfb-debug-target="wpbc_bfb__settings_import"><?php esc_html_e( 'Copy to Clipboard', 'booking' ); ?></button>
									<button type="button" class="button button-primary" data-wpbc-bfb-debug-action="apply_settings"><?php esc_html_e( 'Apply Settings', 'booking' ); ?></button>
								</div>
							</div>
							<div style="flex:1 1 100%;"></div>
							<button type="button" class="button wpbc_bfb__debug_separate_button" data-wpbc-bfb-debug-action="apply_both"><?php esc_html_e( 'Apply Both', 'booking' ); ?></button>
						</div>

						<div class="wpbc_bfb__tab_section wpbc_bfb__tab_section__debug_mode__actual_bfb">
							<div class="wpbc_bfb__debug_block wpbc_bfb__debug_block--advanced" style="margin-top: 14px;">
								<h4><?php esc_html_e( 'Advanced Form', 'booking' ); echo ' — '; esc_html_e( 'Export', 'booking' ); echo ' (CODE)'; ?></h4>
								<textarea id="wpbc_bfb__advanced_form_output"readonly="readonly"></textarea>
								<div style="margin-top: 8px;">
									<button type="button" class="button" data-wpbc-bfb-debug-action="copy" data-wpbc-bfb-debug-target="wpbc_bfb__advanced_form_output"><?php esc_html_e( 'Copy to Clipboard', 'booking' ); ?></button>
								</div>
							</div>
							<div class="wpbc_bfb__debug_block wpbc_bfb__debug_block--content" style="margin-top: 14px;">
								<h4><?php esc_html_e( 'Content of booking fields data', 'booking' ); echo ' — '; esc_html_e( 'Export', 'booking' ); echo ' (CODE)'; ?></h4>
								<textarea id="wpbc_bfb__content_form_output"readonly="readonly"></textarea>
								<div style="margin-top: 8px;">
									<button type="button" class="button" data-wpbc-bfb-debug-action="copy" data-wpbc-bfb-debug-target="wpbc_bfb__content_form_output"><?php esc_html_e( 'Copy to Clipboard', 'booking' ); ?></button>
								</div>
							</div>
						</div>

					</div>

				</div>
			</div>
			<?php } ?>

			<!-- Preview Section Content tab -->
			<div class="wpbc_bfb__tab_section wpbc_bfb__tab_section__preview_tab wpbc_bfb__top_tab_section wpbc_bfb__top_tab_section__preview_tab"
					<?php echo WPBC_BFB_UI_Top_Tabs::get_panel_hidden_attr( 'preview_tab', $active_tab_id );  /* phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped */ ?>>
						<?php wpbc_bfb_render_preview_panel(); ?>
			</div>
		</div>
		<?php

		// ==  Hidden Templates for - Booking Actions  ==
		do_action( 'wpbc_hook_bfb_template__hidden_templates' );

		do_action( 'wpbc_hook_settings_page_footer', 'wpbc-ajx_booking_builder_booking_form' );
	}
}

add_action( 'wpbc_menu_created', array( new WPBC_Page_Builder_Booking_Form(), '__construct' ) );                        // Executed after creation of Menu.


// == Temporary Migrate Functionality ==================================================================================

/**
 * Disable showing Legacy "WP Booking Calendar > Settings > Booking Form > Booking Form Fields page" if enabled BFB.
 *
 * @param bool   $is_show            - 'usually' - true.
 * @param string $page_tag           - can be 'wpbc-settings'.
 * @param string $active_page_tab    - can be 'form'.
 * @param string $active_page_subtab - can be 'booking_form_fields'.
 *
 * @return false|mixed
 */
function wpbc_form_fields__check__showing_page( $is_show, $page_tag, $active_page_tab, $active_page_subtab ) {

	if ( ( 'form' === $active_page_tab ) && ( 'wpbc-settings' === $page_tag ) && ( WPBC_Frontend_Settings::is_bfb_enabled( null ) ) ) {
		$is_show = false;
	}

	return $is_show;
}
// Important here to have priority 20 instead of 10, because it can be ovveriden by same hook in MU, where we check 'check_for_active_users'.
add_filter( 'wpbc_before_showing_settings_page_is_show_page', 'wpbc_form_fields__check__showing_page', 20, 4 );


/**
 * Unset Form Menu  in vertical left  menu widget.  - unset legacy  form builder,  if enabled BFB.
 *
 * @param array  $nav_tabs - array of menus.
 * @param string $this_page - current selected page.
 *
 * @return mixed
 */
function wpbc_form_fields__check__plugin_menu_structure( $nav_tabs, $this_page ) {

	if ( isset( $nav_tabs['wpbc-settings'] ) && isset( $nav_tabs['wpbc-settings']['form'] ) ) {
		if ( WPBC_Frontend_Settings::is_bfb_enabled( null ) ) {
			unset( $nav_tabs['wpbc-settings']['form'] );
		}
	}

	return $nav_tabs;
}
add_filter( 'wpbc_plugin_menu_structure_arr', 'wpbc_form_fields__check__plugin_menu_structure', 20, 2 );


/** Trick here to  overload default REQUST parameters before page is loading */
function wpbc_form_fields__check__define_page_redirect( $page_tag ) {

    // $page_tag - here can be all defined in plugin menu pages. So  we need to  check activated page. By default its inside of $_GET['page'].
    // Execute it only  for WP Booking Calendar > Settings > Booking Form > Booking Form Fields page.

	if ( wpbc_is_settings_form_page() ) {
		if ( WPBC_Frontend_Settings::is_bfb_enabled( null ) ) {
			// phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect
			wp_redirect( admin_url( "admin.php?page=wpbc-settings&tab=builder_booking_form" ) );
			//			$_REQUEST['tab'] = 'builder_booking_form';
			//			unset( $_REQUEST['subtab'] );
			//			$_SERVER[ 'REQUEST_URI' ] = str_replace( '&subtab=form_options', '', $_SERVER[ 'REQUEST_URI' ] );
			//			$_SERVER[ 'REQUEST_URI' ] = str_replace( 'tab=form', 'tab=builder_booking_form', $_SERVER[ 'REQUEST_URI' ] );
		}
	} elseif ( wpbc_is_settings_bfb_page() ) {
		if ( ! WPBC_Frontend_Settings::is_bfb_enabled( null ) ) {
			// phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect
			wp_redirect( admin_url( "admin.php?page=wpbc-settings&tab=form&subtab=form_options" ) );
			//			$_REQUEST['tab'] = 'form';
			//			$_SERVER[ 'REQUEST_URI' ] = str_replace( 'tab=builder_booking_form', 'tab=form', $_SERVER[ 'REQUEST_URI' ] );
		}
	}
}
// We are set  9  to  execute earlier than hook in WPBC_Admin_Menus.
add_action( 'wpbc_define_nav_tabs', 'wpbc_form_fields__check__define_page_redirect', 9 );             // This Hook fire in the class WPBC_Admin_Menus for showing page content of specific menu
