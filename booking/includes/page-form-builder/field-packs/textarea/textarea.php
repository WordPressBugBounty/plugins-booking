<?php
/**
 * WPBC BFB Pack: Textarea Field (Schema-driven)
 *
 * Purpose:
 * - Multi-line text input built on the Schema/Factory inspector (no WP templates).
 * - Preview is rendered via pure JS renderer class.
 * - Mirrors the "text" reference pack but adapted for <textarea>.
 *
 * Contracts Used:
 * - Filter:  wpbc_bfb_register_field_packs
 * - Action:  wpbc_enqueue_js_field_pack
 * - Action:  wpbc_bfb_palette_register_items (optional; used here to list Textarea in the palette)
 *
 * Notes:
 * - Keep schema defaults in sync with JS get_defaults().
 *
 * File:  ../includes/page-form-builder/field-packs/textarea/field-textarea.php
 *
 * @package     Booking Calendar
 * @author      wpdevelop, oplugins
 * @web-site    https://wpbookingcalendar.com/
 * @email       info@wpbookingcalendar.com
 *
 * @since       11.0.0
 * @modified    2025-09-09
 * @version     1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the "textarea" field pack (Schema-driven inspector).
 *
 * @param array $packs Accumulated packs.
 *
 * @return array Modified packs with "textarea" field included.
 */
function wpbc_bfb_register_field_packs__field_textarea_schema( $packs ) {

	$packs['textarea'] = array(
		'kind'         => 'field',
		'type'         => 'textarea',
		'label'        => __( 'Textarea', 'booking' ),
		'icon'         => 'wpbc_icn_notes',                                                                          // Reuse icon; adjust if you have a specific textarea icon.
		'usage_key'    => 'textarea',

		// === Schema: coercion/validation + defaults for Inspector/serialization ===.
		'schema'       => array(
			'props' => array(
				'label'         => array( 'type' => 'string',  'default' => __( 'Textarea', 'booking' ) ),
				'name'          => array( 'type' => 'string',  'default' => '' ),
				'html_id'       => array( 'type' => 'string',  'default' => '' ),
				'placeholder'   => array( 'type' => 'string',  'default' => '' ),
				'required'      => array( 'type' => 'boolean', 'default' => false ),
				//'minlength'     => array( 'type' => 'number',  'default' => null, 'min' => 0 ),
				//'maxlength'     => array( 'type' => 'number',  'default' => null, 'min' => 0 ),
				'rows'          => array( 'type' => 'number',  'default' => 4,    'min' => 1, 'max' => 50 ),
				'cssclass'      => array( 'type' => 'string',  'default' => '' ),
				'help'          => array( 'type' => 'string',  'default' => '' ),
				'default_value' => array( 'type' => 'string',  'default' => '' ),
				// Let the Min-Width guard keep columns usable
				'min_width'   => array( 'type' => 'string',  'default' => '260px' ),
			),
		),

		// === Inspector UI (Factory-driven; no WP templates here) ===.
		'inspector_ui' => array(
			'title'          => __( 'Textarea', 'booking' ),
			'description'    => __( 'Configure a multi-line text input.', 'booking' ),
			'header_variant' => 'toolbar',
			'header_actions' => array( 'deselect', 'scrollto', 'move-up', 'move-down', 'duplicate', 'delete' ),
			'groups'         => array(
				array(
					'key'      => 'basic',
					'label'    => __( 'Basic', 'booking' ),
					'open'     => true,
					'controls' => array(
						array( 'type' => 'text',     'key' => 'label',         'label' => __( 'Label', 'booking' ) ),
						array( 'type' => 'text',     'key' => 'name',          'label' => __( 'Name', 'booking' ) ),
						array( 'type' => 'text',     'key' => 'placeholder',   'label' => __( 'Placeholder', 'booking' ) ),
						array( 'type' => 'checkbox', 'key' => 'required',      'label' => __( 'Required', 'booking' ) ),
						array( 'type' => 'textarea', 'key' => 'default_value', 'label' => __( 'Default value', 'booking' ), 'rows' => 3 ),
						array( 'type' => 'textarea', 'key' => 'help',          'label' => __( 'Help text', 'booking' ),    'rows' => 3 ),
					),
				),

//				// Validation
//				array(
//					'key'      => 'validation',
//					'label'    => __( 'Validation', 'booking' ),
//					'controls' => array(
//						array( 'type' => 'number', 'key' => 'minlength', 'label' => __( 'Min length', 'booking' ) ),
//						array( 'type' => 'number', 'key' => 'maxlength', 'label' => __( 'Max length', 'booking' ) ),
//					),
//				),

				// Appearance
				array(
					'key'      => 'appearance',
					'label'    => __( 'Appearance', 'booking' ),
					'controls' => array(
						array( 'type' => 'text',   'key' => 'cssclass', 'label' => __( 'CSS class', 'booking' ) ),
						array( 'type' => 'text',   'key' => 'html_id',  'label' => __( 'HTML ID', 'booking' ) ),
						// array( 'type' => 'text', 'key' => 'min_width', 'label' => __( 'Min width (e.g. 260px / 20rem / 40%)', 'booking' ) ),
						array( 'type' => 'number', 'key' => 'rows',     'label' => __( 'Rows', 'booking' ), 'min' => 1, 'max' => 50 ),
					),
				),
			),
		),
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_textarea_schema' );

/**
 * Enqueue the Textarea field pack JS for the Builder page.
 *
 * @param string $page Current admin page slug.
 *
 * @return void
 */
function wpbc_bfb_enqueue__field_textarea_schema_js( $page ) {

	wp_enqueue_script( 'wpbc-bfb_field_textarea_schema', wpbc_plugin_url( '/includes/page-form-builder/field-packs/textarea/_out/textarea.js' ), array( 'wpbc-bfb' ), WP_BK_VERSION_NUM, true );
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_textarea_schema_js', 10, 1 );

/**
 * (Optional) Register the "Textarea" palette item in "general/bottom".
 *
 * @param string $group    Palette group: 'general' | 'advanced' | ...
 * @param string $position Position: 'top' | 'bottom'
 *
 * @return void
 */
function wpbc_bfb_palette_register_items__textarea_schema( $group, $position ) {

	if ( 'standard' !== $group || 'bottom' !== $position ) {
		return;
	}
	?>
	<li class="wpbc_bfb__field"
		data-id="textarea"
		data-type="textarea"
		data-usage_key="textarea"
		data-min_width="260px"
		data-label="<?php echo esc_attr( __( 'Textarea', 'booking' ) ); ?>">
			<i class="menu_icon icon-1x wpbc-bi-textarea-resize"></i>
			<span class="wpbc_bfb__field-label"><?php echo esc_html( __( 'Textarea', 'booking' ) ); ?></span>
			<span class="wpbc_bfb__field-type">textarea</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__textarea_schema', 10, 2 );
