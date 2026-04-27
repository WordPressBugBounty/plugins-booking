<?php
/**
 * WPBC BFB Pack: Capacity Hint.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/_shared/hint-shortcode-wptpl.php';

/**
 * Get pack config.
 *
 * @return array
 */
function wpbc_bfb_field_capacity_hint_wptpl_config() {

	return array(
		'token'             => 'capacity_hint',
		'shortcode_display' => 'capacity_hint',
		'prefix'            => __( 'Availability:', 'booking' ),
		'palette_label'     => __( 'Availability', 'booking' ),
		'inspector_title'   => __( 'Availability Hint', 'booking' ),
		'description'       => __( 'Shows the available capacity for the selected booking resource inside the form using the [capacity_hint] shortcode.', 'booking' ),
		'folder'            => 'hint-capacity_hint',
		'script_file'       => 'field-capacity-hint-wptpl.js',
		'handle'            => 'wpbc-bfb_field_capacity_hint_wptpl',
		'boot_var'          => 'WPBC_BFB_Capacity_Hint_Boot',
		'preview_value'     => '4',
		'icon'              => 'wpbc-bi-people',
		'palette_icon'      => 'wpbc-bi-people',
		'required_class'    => 'wpdev_bk_biz_l',
		'pro_label'         => 'Pro | BL+',
		'upgrade_text'      => __( 'This hint is available only in Booking Calendar Business Large or higher versions.', 'booking' ),
		'templates_printer' => 'wpbc_bfb_field_capacity_hint_wptpl_print_templates',
		'group'             => 'hints_other',
	);
}

function wpbc_bfb_register_field_packs__field_capacity_hint_wptpl( $packs ) {
	return wpbc_bfb_hint_shortcode_register_pack( $packs, wpbc_bfb_field_capacity_hint_wptpl_config() );
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_capacity_hint_wptpl' );

function wpbc_bfb_enqueue__field_capacity_hint_wptpl_js( $page ) {
	wpbc_bfb_hint_shortcode_enqueue_js( $page, wpbc_bfb_field_capacity_hint_wptpl_config() );
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_capacity_hint_wptpl_js', 10, 1 );

function wpbc_bfb_field_capacity_hint_wptpl_print_templates( $page ) {
	wpbc_bfb_hint_shortcode_print_templates( $page, wpbc_bfb_field_capacity_hint_wptpl_config() );
}

function wpbc_bfb_palette_register_items__capacity_hint_wptpl( $group, $position ) {
	wpbc_bfb_hint_shortcode_palette_item( $group, $position, wpbc_bfb_field_capacity_hint_wptpl_config() );
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__capacity_hint_wptpl', 10, 2 );
