<?php
/**
 * WPBC BFB Pack: Nights Number Hint.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/_shared/hint-shortcode-wptpl.php';

function wpbc_bfb_field_nights_number_hint_wptpl_config() {
	return array(
		'token'             => 'nights_number_hint',
		'shortcode_display' => 'nights_number_hint',
		'prefix'            => __( 'Nights:', 'booking' ),
		'palette_label'     => __( 'Number of Nights', 'booking' ),
		'inspector_title'   => __( 'Number of Nights Hint', 'booking' ),
		'description'       => __( 'Shows the number of selected booking nights using the [nights_number_hint] shortcode.', 'booking' ),
		'folder'            => 'hint-nights_number_hint',
		'script_file'       => 'field-nights-number-hint-wptpl.js',
		'handle'            => 'wpbc-bfb_field_nights_number_hint_wptpl',
		'boot_var'          => 'WPBC_BFB_Nights_Number_Hint_Boot',
		'preview_value'     => '2',
		'icon'              => 'wpbc-bi-moon',
		'palette_icon'      => 'wpbc-bi-moon',
		'required_class'    => 'wpdev_bk_biz_m',
		'pro_label'         => 'Pro | BM+',
		'upgrade_text'      => __( 'This hint is available only in Booking Calendar Business Medium or higher versions.', 'booking' ),
		'templates_printer' => 'wpbc_bfb_field_nights_number_hint_wptpl_print_templates',
	);
}
function wpbc_bfb_register_field_packs__field_nights_number_hint_wptpl( $packs ) { return wpbc_bfb_hint_shortcode_register_pack( $packs, wpbc_bfb_field_nights_number_hint_wptpl_config() ); }
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_nights_number_hint_wptpl' );
function wpbc_bfb_enqueue__field_nights_number_hint_wptpl_js( $page ) { wpbc_bfb_hint_shortcode_enqueue_js( $page, wpbc_bfb_field_nights_number_hint_wptpl_config() ); }
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_nights_number_hint_wptpl_js', 10, 1 );
function wpbc_bfb_field_nights_number_hint_wptpl_print_templates( $page ) { wpbc_bfb_hint_shortcode_print_templates( $page, wpbc_bfb_field_nights_number_hint_wptpl_config() ); }
function wpbc_bfb_palette_register_items__nights_number_hint_wptpl( $group, $position ) { wpbc_bfb_hint_shortcode_palette_item( $group, $position, wpbc_bfb_field_nights_number_hint_wptpl_config() ); }
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__nights_number_hint_wptpl', 10, 2 );
