<?php
/**
 * WPBC BFB Pack: Coupon Discount Hint.
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
function wpbc_bfb_field_coupon_discount_hint_wptpl_config() {

	return array(
		'token'             => 'coupon_discount_hint',
		'prefix'            => __( 'Coupon Discount:', 'booking' ),
		'palette_label'     => __( 'Coupon Discount', 'booking' ),
		'inspector_title'   => __( 'Coupon Discount Hint', 'booking' ),
		'description'       => __( 'Shows the coupon discount amount inside the form using the [coupon_discount_hint] shortcode.', 'booking' ),
		'folder'            => 'hint-coupon_discount_hint',
		'script_file'       => 'field-coupon-discount-hint-wptpl.js',
		'handle'            => 'wpbc-bfb_field_coupon_discount_hint_wptpl',
		'boot_var'          => 'WPBC_BFB_Coupon_Discount_Hint_Boot',
		'preview_cost'      => 10,
		'preview_fallback'  => '$ 10.00',
		'templates_printer' => 'wpbc_bfb_field_coupon_discount_hint_wptpl_print_templates',
	);
}

function wpbc_bfb_register_field_packs__field_coupon_discount_hint_wptpl( $packs ) {
	return wpbc_bfb_hint_cost_like_register_pack( $packs, wpbc_bfb_field_coupon_discount_hint_wptpl_config() );
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_coupon_discount_hint_wptpl' );

function wpbc_bfb_enqueue__field_coupon_discount_hint_wptpl_js( $page ) {
	wpbc_bfb_hint_cost_like_enqueue_js( $page, wpbc_bfb_field_coupon_discount_hint_wptpl_config() );
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_coupon_discount_hint_wptpl_js', 10, 1 );

function wpbc_bfb_field_coupon_discount_hint_wptpl_print_templates( $page ) {
	wpbc_bfb_hint_cost_like_print_templates( $page, wpbc_bfb_field_coupon_discount_hint_wptpl_config() );
}

function wpbc_bfb_palette_register_items__coupon_discount_hint_wptpl( $group, $position ) {
	wpbc_bfb_hint_cost_like_palette_item( $group, $position, wpbc_bfb_field_coupon_discount_hint_wptpl_config() );
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__coupon_discount_hint_wptpl', 10, 2 );
