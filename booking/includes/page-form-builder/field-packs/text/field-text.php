<?php
/**
 * WPBC BFB Pack: Text Field (Schema-driven Reference)
 *
 * Purpose:
 * - Minimal, crystal-clear example of a field pack using Schema/Factory for the Inspector.
 * - No WP templates; preview is rendered via pure JS renderer class.
 * - Reference implementation to clone for other simple fields.
 *
 * Contracts Used:
 * - Filter:  wpbc_bfb_register_field_packs
 * - Action:  wpbc_enqueue_js_field_pack
 * - Action:  wpbc_bfb_palette_register_items (optional; used here to list Text in the palette)
 *
 * Notes:
 * - Keep schema defaults in sync with JS get_defaults().
 *
 * File:  ../includes/page-form-builder/field-packs/text/field-text.php
 *
 * @package     Booking Calendar
 * @author      wpdevelop, oplugins
 * @web-site    https://wpbookingcalendar.com/
 * @email       info@wpbookingcalendar.com
 *
 * @since       11.0.0
 * @modified    2025-09-02
 * @version     1.0.1
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the "text" field pack (Schema-driven inspector).
 *
 * @param array $packs Accumulated packs.
 *
 * @return array Modified packs with "text" field included.
 */
function wpbc_bfb_register_field_packs__field_text_schema( $packs ) {

	$packs['text'] = array(
		'kind'         => 'field',
		'type'         => 'text',
		'label'        => __( 'Text', 'booking' ),
		'icon'         => 'wpbc_icn_text_fields',
		'usage_key'    => 'text',                                                                                       // Optional: used by UsageLimitService if you set limits elsewhere.
		// === Schema: coercion/validation + defaults for Inspector/serialization ===.
		'schema'       => array(
			'props' => array(
				'label'         => array( 'type' => 'string', 'default' => __( 'Text', 'booking' ) ),
				'name'          => array( 'type' => 'string', 'default' => '' ),
				'html_id'       => array( 'type' => 'string', 'default' => '' ),
				'placeholder'   => array( 'type' => 'string', 'default' => '' ),
				'required'      => array( 'type' => 'boolean', 'default' => false ),
				'minlength'     => array( 'type' => 'number', 'default' => null, 'min' => 0 ),
				'maxlength'     => array( 'type' => 'number', 'default' => null, 'min' => 0 ),
				'pattern'       => array( 'type' => 'string', 'default' => '' ),
				'cssclass'      => array( 'type' => 'string', 'default' => '' ),
				'help'          => array( 'type' => 'string', 'default' => '' ),
				'default_value' => array( 'type' => 'string', 'default' => '' ),
			),
		),
		// === Inspector UI (Factory-driven; no WP templates here) ===.
		'inspector_ui' => array(
			'title'          => __( 'Single Line Text', 'booking' ) . '',	// TODO remove it.
			'description'    => __( 'Configure a single-line text input.', 'booking' ),
			'header_variant' => 'toolbar',
			'header_actions' => array( 'deselect', 'scrollto', 'move-up', 'move-down', 'duplicate', 'delete' ),
			'groups'         => array(
				array(
					'key'      => 'basic',
					'label'    => __( 'Basic', 'booking' ),
					'open'     => true,
					'controls' => array(
						array( 'type' => 'text', 'key' => 'label', 'label' => __( 'Label', 'booking' ) ),
						array( 'type' => 'text', 'key' => 'name', 'label' => __( 'Name', 'booking' ) ),
						array( 'type' => 'text', 'key' => 'placeholder', 'label' => __( 'Placeholder', 'booking' ) ),
						array( 'type' => 'checkbox', 'key' => 'required', 'label' => __( 'Required', 'booking' ) ),
						array( 'type' => 'text', 'key' => 'default_value', 'label' => __( 'Default value', 'booking' ) ),
						array(
							'type'  => 'textarea',
							'key'   => 'help',
							'label' => __( 'Help text', 'booking' ),
							'rows'  => 3,
						),
					),
				),
				array(
					'key'      => 'validation',
					'label'    => __( 'Validation', 'booking' ),
					'controls' => array(
						array( 'type' => 'number', 'key' => 'minlength', 'label' => __( 'Min length', 'booking' ) ),
						array( 'type' => 'number', 'key' => 'maxlength', 'label' => __( 'Max length', 'booking' ) ),
						// array( 'type' => 'text', 'key' => 'pattern', 'label' => __( 'Pattern', 'booking' ) ),		// Temporary comment pattern, it can be enabled in future updates.
					),
				),
				array(
					'key'      => 'appearance',
					'label'    => __( 'Appearance', 'booking' ),
					'controls' => array(
						array( 'type' => 'text', 'key' => 'cssclass', 'label' => __( 'CSS class', 'booking' ) ),
						array( 'type' => 'text', 'key' => 'html_id', 'label' => __( 'HTML ID', 'booking' ) ),
					),
				),
			),
		),

		// No templates_printer for Schema-driven variant.
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_text_schema' );


/**
 * Enqueue the Text field pack JS for the Builder page.
 *
 * This hook is fired only on the Builder page (gated by is_builder_by_request()),
 * so we do not need an extra $page check here.
 *
 * @param string $page Current admin page slug.
 *
 * @return void
 */
function wpbc_bfb_enqueue__field_text_schema_js( $page ) {

	wp_enqueue_script( 'wpbc-bfb_field_text_schema', wpbc_plugin_url( '/includes/page-form-builder/field-packs/text/_out/field-text.js' ), array( 'wpbc-bfb' ), WP_BK_VERSION_NUM, true );
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_text_schema_js', 10, 1 );


/**
 * (Optional) Register the "Text" palette item in "general/bottom".
 *
 * If your palette auto-builds from packs, you can remove this.
 * Keeping it here makes the reference self-contained and explicit.
 *
 * @param string $group    Palette group: 'general' | 'advanced' | ...
 * @param string $position Position: 'top' | 'bottom'
 *
 * @return void
 */
function wpbc_bfb_palette_register_items__text_schema( $group, $position ) {

	if ( 'standard' !== $group || 'bottom' !== $position ) {
		return;
	}
	?>
	<li class="wpbc_bfb__field" data-id="text" data-type="text" data-usage_key="text" data-label="<?php echo esc_attr( __( 'Text', 'booking' ) ); ?>" >
		<i class="menu_icon icon-1x wpbc-bi-input-cursor"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html( __( 'Text', 'booking' ) ); ?></span>
		<span class="wpbc_bfb__field-type">text</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__text_schema', 10, 2 );
