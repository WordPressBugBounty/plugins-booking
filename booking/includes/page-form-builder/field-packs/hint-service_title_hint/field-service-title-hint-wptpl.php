<?php
/**
 * WPBC BFB Pack: Appointment Service Hint.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/_shared/hint-shortcode-wptpl.php';

/**
 * Get the Appointment Service Hint field-pack configuration.
 *
 * @return array<string,mixed> Field-pack configuration.
 */
function wpbc_bfb_field_service_title_hint_wptpl_config() {

	return array(
		'token'             => 'service_title_hint',
		'shortcode_display' => 'service_title_hint',
		'prefix'            => __( 'Service:', 'booking' ),
		'palette_label'     => __( 'Service Hint', 'booking' ),
		'inspector_title'   => __( 'Appointment Service Hint', 'booking' ),
		'description'       => __( 'Shows and stores the selected Appointment Service title. It remains empty when the form is not used in the Appointment flow.', 'booking' ),
		'folder'            => 'hint-service_title_hint',
		'script_file'       => 'field-service-title-hint-wptpl.js',
		'handle'            => 'wpbc-bfb_field_service_title_hint_wptpl',
		'boot_var'          => 'WPBC_BFB_Service_Title_Hint_Boot',
		'preview_value'     => __( 'Consultation', 'booking' ),
		'icon'              => 'wpbc-bi-grid',
		'palette_icon'      => 'wpbc-bi-grid',
		'required_class'    => '',
		'pro_label'         => '',
		'upgrade_text'      => '',
		'templates_printer' => 'wpbc_bfb_field_service_title_hint_wptpl_print_templates',
		'group'             => 'hints_other',
	);
}

/**
 * Register the Appointment Service Hint field pack.
 *
 * @param array<string,mixed> $packs Registered Form Builder packs.
 *
 * @return array<string,mixed> Packs including the Service Hint.
 */
function wpbc_bfb_register_field_packs__field_service_title_hint_wptpl( $packs ) {
	return wpbc_bfb_hint_shortcode_register_pack( $packs, wpbc_bfb_field_service_title_hint_wptpl_config() );
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_service_title_hint_wptpl' );

/**
 * Enqueue the Appointment Service Hint Builder script.
 *
 * @param string $page Current admin page slug.
 *
 * @return void
 */
function wpbc_bfb_enqueue__field_service_title_hint_wptpl_js( $page ) {
	wpbc_bfb_hint_shortcode_enqueue_js( $page, wpbc_bfb_field_service_title_hint_wptpl_config() );
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_service_title_hint_wptpl_js', 10, 1 );

/**
 * Print the Appointment Service Hint Builder templates.
 *
 * @param string $page Current admin page slug.
 *
 * @return void
 */
function wpbc_bfb_field_service_title_hint_wptpl_print_templates( $page ) {
	wpbc_bfb_hint_shortcode_print_templates( $page, wpbc_bfb_field_service_title_hint_wptpl_config() );
}

/**
 * Add the Appointment Service Hint to the Booking Info Hints palette.
 *
 * @param string $group    Palette group identifier.
 * @param string $position Palette insertion position.
 *
 * @return void
 */
function wpbc_bfb_palette_register_items__service_title_hint_wptpl( $group, $position ) {
	wpbc_bfb_hint_shortcode_palette_item( $group, $position, wpbc_bfb_field_service_title_hint_wptpl_config() );
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__service_title_hint_wptpl', 10, 2 );
