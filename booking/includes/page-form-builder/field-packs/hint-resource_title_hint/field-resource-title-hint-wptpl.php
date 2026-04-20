<?php
/**
 * WPBC BFB Pack: Resource Title Hint.
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
function wpbc_bfb_field_resource_title_hint_wptpl_config() {

	return array(
		'token'             => 'resource_title_hint',
		'shortcode_display' => 'resource_title_hint',
		'prefix'            => __( 'Selected Resource:', 'booking' ),
		'palette_label'     => __( 'Selected Resource Title', 'booking' ),
		'inspector_title'   => __( 'Selected Resource Title Hint', 'booking' ),
		'description'       => __( 'Shows the selected booking resource title inside the form using the [resource_title_hint] shortcode.', 'booking' ),
		'folder'            => 'hint-resource_title_hint',
		'script_file'       => 'field-resource-title-hint-wptpl.js',
		'handle'            => 'wpbc-bfb_field_resource_title_hint_wptpl',
		'boot_var'          => 'WPBC_BFB_Resource_Title_Hint_Boot',
		'preview_value'     => __( 'Standard Room', 'booking' ),
		'icon'              => 'wpbc-bi-house-door',
		'palette_icon'      => 'wpbc-bi-house-door',
		'required_class'    => 'wpdev_bk_personal',
		'pro_label'         => 'Pro',
		'upgrade_text'      => __( 'This hint is available only in Booking Calendar Pro versions.', 'booking' ),
		'templates_printer' => 'wpbc_bfb_field_resource_title_hint_wptpl_print_templates',
	);
}

function wpbc_bfb_register_field_packs__field_resource_title_hint_wptpl( $packs ) {
	return wpbc_bfb_hint_shortcode_register_pack( $packs, wpbc_bfb_field_resource_title_hint_wptpl_config() );
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_resource_title_hint_wptpl' );

function wpbc_bfb_enqueue__field_resource_title_hint_wptpl_js( $page ) {
	wpbc_bfb_hint_shortcode_enqueue_js( $page, wpbc_bfb_field_resource_title_hint_wptpl_config() );
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_resource_title_hint_wptpl_js', 10, 1 );

function wpbc_bfb_field_resource_title_hint_wptpl_print_templates( $page ) {
	wpbc_bfb_hint_shortcode_print_templates( $page, wpbc_bfb_field_resource_title_hint_wptpl_config() );
}

function wpbc_bfb_palette_register_items__resource_title_hint_wptpl( $group, $position ) {
	wpbc_bfb_hint_shortcode_palette_item( $group, $position, wpbc_bfb_field_resource_title_hint_wptpl_config() );
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__resource_title_hint_wptpl', 10, 2 );
