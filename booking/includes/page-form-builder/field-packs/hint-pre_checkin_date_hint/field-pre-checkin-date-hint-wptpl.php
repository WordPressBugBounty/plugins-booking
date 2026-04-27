<?php
/**
 * WPBC BFB Pack: Pre Check-in Date Hint.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/_shared/hint-shortcode-wptpl.php';

function wpbc_bfb_field_pre_checkin_date_hint_wptpl_config() {
	return array(
		'token'             => 'pre_checkin_date_hint',
		'shortcode_display' => 'pre_checkin_date_hint',
		'prefix'            => __( 'Pre Check-in Date:', 'booking' ),
		'palette_label'     => __( 'Pre Check-in Date', 'booking' ),
		'inspector_title'   => __( 'Pre Check-in Date Hint', 'booking' ),
		'description'       => __( 'Shows the date before check-in based on the configured pre-check-in offset using the [pre_checkin_date_hint] shortcode.', 'booking' ),
		'folder'            => 'hint-pre_checkin_date_hint',
		'script_file'       => 'field-pre-checkin-date-hint-wptpl.js',
		'handle'            => 'wpbc-bfb_field_pre_checkin_date_hint_wptpl',
		'boot_var'          => 'WPBC_BFB_Pre_Checkin_Date_Hint_Boot',
		'preview_value'     => wpbc_bfb_hint_shortcode_preview_value( 'pre_checkin_date_hint', '04/04/2026' ),
		'icon'              => 'wpbc-bi-calendar-minus',
		'palette_icon'      => 'wpbc-bi-calendar-minus',
		'required_class'    => 'wpdev_bk_biz_m',
		'pro_label'         => 'Pro | BM+',
		'upgrade_text'      => __( 'This hint is available only in Booking Calendar Business Medium or higher versions.', 'booking' ),
		'templates_printer' => 'wpbc_bfb_field_pre_checkin_date_hint_wptpl_print_templates',
		'group'             => 'hints_dates',
	);
}
function wpbc_bfb_register_field_packs__field_pre_checkin_date_hint_wptpl( $packs ) { return wpbc_bfb_hint_shortcode_register_pack( $packs, wpbc_bfb_field_pre_checkin_date_hint_wptpl_config() ); }
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_pre_checkin_date_hint_wptpl' );
function wpbc_bfb_enqueue__field_pre_checkin_date_hint_wptpl_js( $page ) { wpbc_bfb_hint_shortcode_enqueue_js( $page, wpbc_bfb_field_pre_checkin_date_hint_wptpl_config() ); }
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_pre_checkin_date_hint_wptpl_js', 10, 1 );
function wpbc_bfb_field_pre_checkin_date_hint_wptpl_print_templates( $page ) { wpbc_bfb_hint_shortcode_print_templates( $page, wpbc_bfb_field_pre_checkin_date_hint_wptpl_config() ); }
function wpbc_bfb_palette_register_items__pre_checkin_date_hint_wptpl( $group, $position ) { wpbc_bfb_hint_shortcode_palette_item( $group, $position, wpbc_bfb_field_pre_checkin_date_hint_wptpl_config() ); }
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__pre_checkin_date_hint_wptpl', 10, 2 );
