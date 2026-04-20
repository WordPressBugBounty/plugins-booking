<?php
/**
 * WPBC BFB Pack: Check-out Plus One Day Hint.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/_shared/hint-shortcode-wptpl.php';

function wpbc_bfb_field_check_out_plus1day_hint_wptpl_config() {
	return array(
		'token'             => 'check_out_plus1day_hint',
		'shortcode_display' => 'check_out_plus1day_hint',
		'prefix'            => __( 'Check-out +1 day:', 'booking' ),
		'palette_label'     => __( 'Check-out +1 Day', 'booking' ),
		'inspector_title'   => __( 'Check-out +1 Day Hint', 'booking' ),
		'description'       => __( 'Shows one day after the selected check-out date using the [check_out_plus1day_hint] shortcode.', 'booking' ),
		'folder'            => 'hint-check_out_plus1day_hint',
		'script_file'       => 'field-check-out-plus1day-hint-wptpl.js',
		'handle'            => 'wpbc-bfb_field_check_out_plus1day_hint_wptpl',
		'boot_var'          => 'WPBC_BFB_Check_Out_Plus1day_Hint_Boot',
		'preview_value'     => '04/21/2026 00:00',
		'icon'              => 'wpbc-bi-calendar-plus',
		'palette_icon'      => 'wpbc-bi-calendar-plus',
		'required_class'    => 'wpdev_bk_biz_m',
		'pro_label'         => 'Pro | BM+',
		'upgrade_text'      => __( 'This hint is available only in Booking Calendar Business Medium or higher versions.', 'booking' ),
		'templates_printer' => 'wpbc_bfb_field_check_out_plus1day_hint_wptpl_print_templates',
	);
}
function wpbc_bfb_register_field_packs__field_check_out_plus1day_hint_wptpl( $packs ) { return wpbc_bfb_hint_shortcode_register_pack( $packs, wpbc_bfb_field_check_out_plus1day_hint_wptpl_config() ); }
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_check_out_plus1day_hint_wptpl' );
function wpbc_bfb_enqueue__field_check_out_plus1day_hint_wptpl_js( $page ) { wpbc_bfb_hint_shortcode_enqueue_js( $page, wpbc_bfb_field_check_out_plus1day_hint_wptpl_config() ); }
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_check_out_plus1day_hint_wptpl_js', 10, 1 );
function wpbc_bfb_field_check_out_plus1day_hint_wptpl_print_templates( $page ) { wpbc_bfb_hint_shortcode_print_templates( $page, wpbc_bfb_field_check_out_plus1day_hint_wptpl_config() ); }
function wpbc_bfb_palette_register_items__check_out_plus1day_hint_wptpl( $group, $position ) { wpbc_bfb_hint_shortcode_palette_item( $group, $position, wpbc_bfb_field_check_out_plus1day_hint_wptpl_config() ); }
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__check_out_plus1day_hint_wptpl', 10, 2 );
