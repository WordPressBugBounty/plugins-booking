<?php
/**
 * WPBC BFB Pack: Start Time Hint.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/_shared/hint-shortcode-wptpl.php';

function wpbc_bfb_field_start_time_hint_wptpl_config() {
	return array(
		'token'             => 'start_time_hint',
		'shortcode_display' => 'start_time_hint',
		'prefix'            => __( 'Start Time:', 'booking' ),
		'palette_label'     => __( 'Start Time', 'booking' ),
		'inspector_title'   => __( 'Start Time Hint', 'booking' ),
		'description'       => __( 'Shows the selected booking start time using the [start_time_hint] shortcode.', 'booking' ),
		'folder'            => 'hint-start_time_hint',
		'script_file'       => 'field-start-time-hint-wptpl.js',
		'handle'            => 'wpbc-bfb_field_start_time_hint_wptpl',
		'boot_var'          => 'WPBC_BFB_Start_Time_Hint_Boot',
		'preview_value'     => wpbc_bfb_hint_shortcode_preview_value( 'start_time_hint', '14:00' ),
		'icon'              => 'wpbc-bi-clock',
		'palette_icon'      => 'wpbc-bi-clock',
//		'required_class'    => 'wpdev_bk_biz_m',
//		'pro_label'         => 'Pro | BM+',
//		'upgrade_text'      => __( 'This hint is available only in Booking Calendar Business Medium or higher versions.', 'booking' ),
		'required_class'    => '',
		'pro_label'         => '',
		'upgrade_text'      => '',
		'templates_printer' => 'wpbc_bfb_field_start_time_hint_wptpl_print_templates',
		'group'             => 'hints_dates',
	);
}
function wpbc_bfb_register_field_packs__field_start_time_hint_wptpl( $packs ) { return wpbc_bfb_hint_shortcode_register_pack( $packs, wpbc_bfb_field_start_time_hint_wptpl_config() ); }
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_start_time_hint_wptpl' );
function wpbc_bfb_enqueue__field_start_time_hint_wptpl_js( $page ) { wpbc_bfb_hint_shortcode_enqueue_js( $page, wpbc_bfb_field_start_time_hint_wptpl_config() ); }
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_start_time_hint_wptpl_js', 10, 1 );
function wpbc_bfb_field_start_time_hint_wptpl_print_templates( $page ) { wpbc_bfb_hint_shortcode_print_templates( $page, wpbc_bfb_field_start_time_hint_wptpl_config() ); }
function wpbc_bfb_palette_register_items__start_time_hint_wptpl( $group, $position ) { wpbc_bfb_hint_shortcode_palette_item( $group, $position, wpbc_bfb_field_start_time_hint_wptpl_config() ); }
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__start_time_hint_wptpl', 10, 2 );
