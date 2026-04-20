<?php
/**
 * WPBC BFB Pack: Additional Cost Hint.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/_shared/hint-cost-like-wptpl.php';

/**
 * Get pack config.
 *
 * @return array
 */
function wpbc_bfb_field_additional_cost_hint_wptpl_config() {

	return array(
		'token'             => 'additional_cost_hint',
		'prefix'            => __( 'Additional Cost:', 'booking' ),
		'palette_label'     => __( 'Additional Cost', 'booking' ),
		'inspector_title'   => __( 'Additional Cost Hint', 'booking' ),
		'description'       => __( 'Shows the additional booking cost inside the form using the [additional_cost_hint] shortcode.', 'booking' ),
		'folder'            => 'hint-additional_cost_hint',
		'script_file'       => 'field-additional-cost-hint-wptpl.js',
		'handle'            => 'wpbc-bfb_field_additional_cost_hint_wptpl',
		'boot_var'          => 'WPBC_BFB_Additional_Cost_Hint_Boot',
		'preview_cost'      => 20,
		'preview_fallback'  => '$ 20.00',
		'templates_printer' => 'wpbc_bfb_field_additional_cost_hint_wptpl_print_templates',
	);
}

function wpbc_bfb_register_field_packs__field_additional_cost_hint_wptpl( $packs ) {
	return wpbc_bfb_hint_cost_like_register_pack( $packs, wpbc_bfb_field_additional_cost_hint_wptpl_config() );
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_additional_cost_hint_wptpl' );

function wpbc_bfb_enqueue__field_additional_cost_hint_wptpl_js( $page ) {
	wpbc_bfb_hint_cost_like_enqueue_js( $page, wpbc_bfb_field_additional_cost_hint_wptpl_config() );
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_additional_cost_hint_wptpl_js', 10, 1 );

function wpbc_bfb_field_additional_cost_hint_wptpl_print_templates( $page ) {
	wpbc_bfb_hint_cost_like_print_templates( $page, wpbc_bfb_field_additional_cost_hint_wptpl_config() );
}

function wpbc_bfb_palette_register_items__additional_cost_hint_wptpl( $group, $position ) {
	wpbc_bfb_hint_cost_like_palette_item( $group, $position, wpbc_bfb_field_additional_cost_hint_wptpl_config() );
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__additional_cost_hint_wptpl', 10, 2 );
