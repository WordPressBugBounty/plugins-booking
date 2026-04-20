<?php
/**
 * WPBC BFB Pack: Selected Dates Hint.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/_shared/hint-shortcode-wptpl.php';

function wpbc_bfb_field_selected_dates_hint_wptpl_config() {
	return array(
		'token'             => 'selected_dates_hint',
		'shortcode_display' => 'selected_dates_hint',
		'prefix'            => __( 'Dates:', 'booking' ),
		'palette_label'     => __( 'Selected Dates', 'booking' ),
		'inspector_title'   => __( 'Selected Dates Hint', 'booking' ),
		'description'       => __( 'Shows the selected booking dates using the [selected_dates_hint] shortcode.', 'booking' ),
		'folder'            => 'hint-selected_dates_hint',
		'script_file'       => 'field-selected-dates-hint-wptpl.js',
		'handle'            => 'wpbc-bfb_field_selected_dates_hint_wptpl',
		'boot_var'          => 'WPBC_BFB_Selected_Dates_Hint_Boot',
		'preview_value'     => '04/18/2026, 04/19/2026, 04/20/2026',
		'icon'              => 'wpbc-bi-calendar3',
		'palette_icon'      => 'wpbc-bi-calendar4-week',
		'required_class'    => 'wpdev_bk_biz_m',
		'pro_label'         => 'Pro | BM+',
		'upgrade_text'      => __( 'This hint is available only in Booking Calendar Business Medium or higher versions.', 'booking' ),
		'templates_printer' => 'wpbc_bfb_field_selected_dates_hint_wptpl_print_templates',
	);
}
function wpbc_bfb_register_field_packs__field_selected_dates_hint_wptpl( $packs ) { return wpbc_bfb_hint_shortcode_register_pack( $packs, wpbc_bfb_field_selected_dates_hint_wptpl_config() ); }
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_selected_dates_hint_wptpl' );
function wpbc_bfb_enqueue__field_selected_dates_hint_wptpl_js( $page ) { wpbc_bfb_hint_shortcode_enqueue_js( $page, wpbc_bfb_field_selected_dates_hint_wptpl_config() ); }
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_selected_dates_hint_wptpl_js', 10, 1 );
function wpbc_bfb_field_selected_dates_hint_wptpl_print_templates( $page ) { wpbc_bfb_hint_shortcode_print_templates( $page, wpbc_bfb_field_selected_dates_hint_wptpl_config() ); }
function wpbc_bfb_palette_register_items__selected_dates_hint_wptpl( $group, $position ) { wpbc_bfb_hint_shortcode_palette_item( $group, $position, wpbc_bfb_field_selected_dates_hint_wptpl_config() ); }
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__selected_dates_hint_wptpl', 10, 2 );
