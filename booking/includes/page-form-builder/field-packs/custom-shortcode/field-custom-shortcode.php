<?php
/**
 * WPBC BFB Pack: Custom Shortcode.
 *
 * Adds one literal, bare shortcode token to the Advanced Booking Form. This is
 * intentionally domain-neutral: paid editions may later resolve a token such
 * as `[airport_transfer_hint]`, while Form Builder only stores and exports the
 * authorized form author's exact token.
 *
 * @package Booking Calendar
 * @since   11.8.2
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the Custom Shortcode field schema and Inspector control.
 *
 * The field stores one executable-free string. The browser pack validates that
 * it is one bare bracketed token before exporting it to the Advanced form.
 *
 * @param array $packs Registered Builder field packs.
 *
 * @return array Updated field packs.
 */
function wpbc_bfb_register_field_packs__custom_shortcode( $packs ) {
	$packs['custom_shortcode'] = array(
		'kind'      => 'field',
		'type'      => 'custom_shortcode',
		'label'     => __( 'Custom Shortcode', 'booking' ),
		'icon'      => 'wpbc-bi-code',
		'usage_key' => 'custom_shortcode',
		'schema'    => array(
			'props' => array(
				'shortcode' => array(
					'type'    => 'string',
					'default' => '[field_name_hint]',
				),
			),
		),
		'inspector_ui' => array(
			'title'          => __( 'Custom Shortcode', 'booking' ),
			'description'    => __( 'Add one supported shortcode to the booking form. For a Form Options Cost hint, use its form field name followed by _hint.', 'booking' ),
			'header_variant' => 'toolbar',
			'header_actions' => array( 'deselect', 'scrollto', 'move-up', 'move-down', 'duplicate', 'delete' ),
			'groups'         => array(
				array(
					'key'      => 'basic',
					'label'    => __( 'Shortcode', 'booking' ),
					'open'     => true,
					'controls' => array(
						array(
							'type'        => 'text',
							'key'         => 'shortcode',
							'label'       => __( 'Shortcode', 'booking' ),
							'placeholder' => '[field_name_hint]',
						),
					),
				),
			),
		),
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__custom_shortcode' );

/**
 * Enqueue the Custom Shortcode renderer and exporters in Form Builder.
 *
 * WordPress calls this hook only while loading the Builder page. The runtime
 * asset is deliberately loaded from `_out`, matching the project contract.
 *
 * @param string $page Current administration page slug.
 *
 * @return void
 */
function wpbc_bfb_enqueue__custom_shortcode_js( $page ) {
	wp_enqueue_script(
		'wpbc-bfb_field_custom_shortcode',
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/custom-shortcode/_out/custom-shortcode.js' ),
		array( 'wpbc-bfb' ),
		WP_BK_VERSION_NUM,
		true
	);

	wp_localize_script(
		'wpbc-bfb_field_custom_shortcode',
		'WPBC_BFB_Custom_Shortcode_Boot',
		array(
			'example_shortcode' => '[field_name_hint]',
			'invalid_message'   => __( 'Enter one shortcode in square brackets, for example [field_name_hint].', 'booking' ),
		)
	);
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__custom_shortcode_js', 10, 1 );

/**
 * Add Custom Shortcode to the Cost Hints palette group.
 *
 * The palette placement reflects the primary Form Options Costs use case, but
 * the field itself remains a generic literal-token exporter.
 *
 * @param string $group    Palette group.
 * @param string $position Position inside the group.
 *
 * @return void
 */
function wpbc_bfb_palette_register_items__custom_shortcode( $group, $position ) {
	if ( 'hints' !== $group || 'bottom' !== $position ) {
		return;
	}
	?>
	<li class="wpbc_bfb__field"
		data-id="custom_shortcode"
		data-type="custom_shortcode"
		data-usage_key="custom_shortcode"
		data-shortcode="[field_name_hint]">
		<i class="menu_icon icon-1x wpbc-bi-code"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html__( 'Custom Shortcode', 'booking' ); ?></span>
		<span class="wpbc_bfb__field-type">[field_name_hint]</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__custom_shortcode', 10, 2 );
