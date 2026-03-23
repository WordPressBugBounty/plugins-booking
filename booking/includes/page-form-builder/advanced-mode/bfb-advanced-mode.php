<?php
/**
 * Description.
 *
 * @package     Booking Calendar.
 * @author      wpdevelop, oplugins
 * @web-site    https://wpbookingcalendar.com/
 * @email       info@wpbookingcalendar.com
 *
 * @since       11.0.x
 * @file        ../includes/page-form-builder/advanced-mode/bfb-advanced-mode.php
 *
 * @modified    2026-01-28 17:31
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}


/**
 * Render "Advanced Form" editor panel (CodeMirror textareas).
 *
 * Notes:
 * - This is an "edit mode" UI only (Stage 1).
 * - Values are filled by JS from exporter: WPBC_BFB_Exporter.export_all().
 * - Import back into Builder JSON can be added later (Stage 2).
 *
 * @return void
 */
function wpbc_bfb__adavanced_mode__render_advanced_form_editor_panel() {

	?>
	<div class="wpbc_bfb__advanced_editor">

		<div class="wpbc_bfb__advanced_editor__head">

			<div class="wpbc_bfb__advanced_editor__toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 14px;">
				<button type="button" class="button" id="wpbc_bfb__advanced_regenerate_btn">
					<?php esc_html_e( 'Regenerate from Builder', 'booking' ); ?>
				</button>

				<label style="display:inline-flex;gap:6px;align-items:center;">
					<input type="checkbox" id="wpbc_bfb__advanced_autosync" checked="checked"/>
					<?php esc_html_e( 'Auto-sync while Builder changes', 'booking' ); ?>
				</label>

				<span id="wpbc_bfb__advanced_dirty_hint" style="display:none;">
				<?php esc_html_e( 'Edited (auto-sync paused).', 'booking' ); ?>
			</span>
			</div>
		</div>

		<!-- Tabs -->
		<?php

		$tabs_config = array(
			'advanced_mode__booking_form' => array(
				'title'       => __( 'Booking Form', 'booking' ),
				'type'        => 'panel',
				'css_classes' => '',
			),
			'advanced_mode__booking_data' => array(
				'title'       => __( 'Booking fields data', 'booking' ),
				'type'        => 'panel',
				'css_classes' => '',
			),
		);

		WPBC_BFB_UI_Top_Tabs::render(
			array(
				'active_tab'       => 'advanced_mode__booking_form',
				'tabs'             => $tabs_config,
				'nav_container_id' => 'wpbc_bfb__top_horisontal__advanced_mode',
				'panels_root_id'   => 'wpbc_bfb__advanced_mode_panels',
			)
		);

		?>
		<div id="wpbc_bfb__advanced_mode_panels">
			<style type="text/css">
				#wpbc_bfb__advanced_mode_panels .CodeMirror{
					height: 450px;
				}
			</style>
			<div class="wpbc_bfb__tab_section wpbc_bfb__tab_section__advanced_mode__booking_form">
				<!-- Booking form -->
				<div class="wpbc_bfb__advanced_editor__block" style="flex: 1 1 auto;min-width:320px;">
					<textarea id="wpbc_bfb__advanced_form_editor" rows="25" style="width:100%;min-height:540px;font-family:monospace;font-size:12px;"></textarea>

					<div style="display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap;">
						<button type="button" class="button" id="wpbc_bfb__advanced_copy_form_btn">
							<?php esc_html_e( 'Copy Advanced Form', 'booking' ); ?>
						</button>
					</div>
				</div>

			</div>

			<div class="wpbc_bfb__tab_section wpbc_bfb__tab_section__advanced_mode__booking_data">
				<!-- "Content of booking fields data" -->
				<div class="wpbc_bfb__advanced_editor__block" style="flex: 1 1 auto;min-width:320px;">
					<textarea id="wpbc_bfb__content_form_editor" rows="25" style="width:100%;min-height:540px;font-family:monospace;font-size:12px;"></textarea>

					<div style="display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap;">
						<button type="button" class="button" id="wpbc_bfb__advanced_copy_content_btn">
							<?php esc_html_e( 'Copy Content Template', 'booking' ); ?>
						</button>
					</div>
				</div>

			</div>
		</div>
	</div>
	<?php
}


/**
 * Enqueue WordPress Code Editor (CodeMirror) and expose settings to JS.
 *
 * @return void
 */
function wpbc_bfb__adavanced_mode__enqueue_code_editor_for_advanced_tab() {

	// If user  desctivated the code highlighting ?
	if ( ! function_exists( 'wp_enqueue_code_editor' ) ) {

		if ( class_exists( 'wpdev_bk_personal' ) ) {
			wp_enqueue_script( 'wpbc-bfb-advanced-form-editor', wpbc_plugin_url( '/includes/page-form-builder/advanced-mode/_out/bfb-advanced-form-editor.js' ), array(), WP_BK_VERSION_NUM, true );
		} else {
			wp_enqueue_script( 'wpbc-bfb-advanced-form-editor', wpbc_plugin_url( '/includes/page-form-builder/advanced-mode/_out/bfb-advanced-free.js' ), array(), WP_BK_VERSION_NUM, true );
		}
		return;
	}

	$settings = wp_enqueue_code_editor( array( 'type' => 'text/html' ) );

	// Bail if user disabled CodeMirror.
	if ( false === $settings ) {
		return;
	}

	// Ensure core editor script is available. Enqueue only if registered and not yet enqueued.
	if ( wp_script_is( 'wp-theme-plugin-editor', 'registered' ) && ! wp_script_is( 'wp-theme-plugin-editor', 'enqueued' ) ) {
		wp_enqueue_script( 'wp-theme-plugin-editor' );
	}

	wp_enqueue_style( 'wp-codemirror' );

	/**
	 * IMPORTANT:
	 * Use a script handle that is guaranteed to exist on this page.
	 * If "wpbc_all" is always enqueued here, keep it.
	 * Otherwise localize into your builder main handle.
	 */
	wp_localize_script( 'wpbc_all', 'wpbc_bfb_code_editor_settings', $settings );

	if ( class_exists( 'wpdev_bk_personal' ) ) {
		wp_enqueue_script( 'wpbc-bfb-advanced-form-editor', wpbc_plugin_url( '/includes/page-form-builder/advanced-mode/_out/bfb-advanced-form-editor.js' ), array( 'wpbc_all', 'wpbc-bfb_exporter', 'code-editor', 'wp-theme-plugin-editor' ), WP_BK_VERSION_NUM, true );
	} else {
		wp_enqueue_script( 'wpbc-bfb-advanced-form-editor', wpbc_plugin_url( '/includes/page-form-builder/advanced-mode/_out/bfb-advanced-free.js' ), array( 'wpbc_all', 'wpbc-bfb_exporter', 'code-editor', 'wp-theme-plugin-editor' ), WP_BK_VERSION_NUM, true );
	}
}
