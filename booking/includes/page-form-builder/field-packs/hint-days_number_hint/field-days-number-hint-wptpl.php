<?php
/**
 * WPBC BFB Pack: Days Number Hint.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/_shared/hint-shortcode-wptpl.php';

function wpbc_bfb_field_days_number_hint_wptpl_config() {
	return array(
		'token'             => 'days_number_hint',
		'shortcode_display' => 'days_number_hint',
		'prefix'            => __( 'Days:', 'booking' ),
		'palette_label'     => __( 'Number of Days', 'booking' ),
		'inspector_title'   => __( 'Number of Days Hint', 'booking' ),
		'description'       => __( 'Shows the number of selected booking days using the [days_number_hint] shortcode.', 'booking' ),
		'folder'            => 'hint-days_number_hint',
		'script_file'       => 'field-days-number-hint-wptpl.js',
		'handle'            => 'wpbc-bfb_field_days_number_hint_wptpl',
		'boot_var'          => 'WPBC_BFB_Days_Number_Hint_Boot',
		'preview_value'     => '3',
		'icon'              => 'wpbc-bi-calendar2-range',
		'palette_icon'      => 'wpbc-bi-calendar2-range',
//		'required_class'    => 'wpdev_bk_biz_m',
//		'pro_label'         => 'Pro | BM+',
//		'upgrade_text'      => __( 'This hint is available only in Booking Calendar Business Medium or higher versions.', 'booking' ),
		'required_class'    => '',
		'pro_label'         => '',
		'upgrade_text'      => '',
		'templates_printer' => 'wpbc_bfb_field_days_number_hint_wptpl_print_templates',
		'group'             => 'hints_dates',
	);
}
function wpbc_bfb_register_field_packs__field_days_number_hint_wptpl( $packs ) { return wpbc_bfb_hint_shortcode_register_pack( $packs, wpbc_bfb_field_days_number_hint_wptpl_config() ); }
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_days_number_hint_wptpl' );
function wpbc_bfb_enqueue__field_days_number_hint_wptpl_js( $page ) { wpbc_bfb_hint_shortcode_enqueue_js( $page, wpbc_bfb_field_days_number_hint_wptpl_config() ); }
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_days_number_hint_wptpl_js', 10, 1 );
function wpbc_bfb_field_days_number_hint_wptpl_print_templates( $page ) { wpbc_bfb_hint_shortcode_print_templates( $page, wpbc_bfb_field_days_number_hint_wptpl_config() ); }
function wpbc_bfb_palette_register_items__days_number_hint_wptpl( $group, $position ) { wpbc_bfb_hint_shortcode_palette_item( $group, $position, wpbc_bfb_field_days_number_hint_wptpl_config() ); }
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__days_number_hint_wptpl', 10, 2 );
