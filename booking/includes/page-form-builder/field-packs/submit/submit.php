<?php
/**
 * WPBC BFB Pack: Submit Button (Schema-driven, Factory Inspector)
 *
 * Purpose:
 * - Follow the same creation rules as the "Text Field (Schema-driven Reference)" pack.
 * - No WP templates for Inspector; preview is rendered by a pure JS renderer class.
 * - Keep schema defaults in sync with JS get_defaults().
 *
 * Contracts Used:
 * - Filter:  wpbc_bfb_register_field_packs
 * - Action:  wpbc_enqueue_js_field_pack
 * - Action:  wpbc_bfb_palette_register_items (optional palette registration)
 *
 * File:  ../includes/page-form-builder/field-packs/submit/field-submit.php
 *
 * @package     Booking Calendar
 * @author      wpdevelop, oplugins
 * @since       11.0.0
 * @modified    2025-09-13
 * @version     1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the "submit" field pack (Schema-driven Inspector).
 *
 * @param array $packs Accumulated packs.
 *
 * @return array Modified packs with "submit" field included.
 */
function wpbc_bfb_register_field_packs__field_submit_schema( $packs ) {

	$packs['submit'] = array(
		'kind'      => 'field',
		'type'      => 'submit',
		'label'     => __( 'Submit Button', 'booking' ),
		'icon'      => 'wpbc_icn_check_circle',
		'usage_key' => 'submit',

		// === Schema: coercion/validation + defaults for Inspector/serialization ===
		'schema'    => array(
			'props' => array(
				'label'       => array( 'type' => 'string',  'default' => __( 'Send', 'booking' ) ),
				'name'        => array( 'type' => 'string',  'default' => '' ),
				'html_id'     => array( 'type' => 'string',  'default' => '' ),
				'cssclass'    => array( 'type' => 'string',  'default' => 'wpbc_bfb__btn wpbc_bfb__btn--primary' ),
				'help'        => array( 'type' => 'string',  'default' => '' ),
			),
		),

		// === Inspector UI (Factory-driven; no WP templates here) ===
		'inspector_ui' => array(
			'title'          => __( 'Submit Button', 'booking' ),
			'description'    => __( 'Configure the submit button appearance and attributes.', 'booking' ),
			'header_variant' => 'toolbar',
			'header_actions' => array( 'deselect', 'scrollto', 'move-up', 'move-down', 'duplicate', 'delete' ),
			'groups'         => array(
				array(
					'key'      => 'basic',
					'label'    => __( 'Basic', 'booking' ),
					'open'     => true,
					'controls' => array(
						array( 'type' => 'text',     'key' => 'label',    'label' => __( 'Label', 'booking' ) ),
						// array( 'type' => 'text',     'key' => 'name',     'label' => __( 'Name', 'booking' ) ),
						array(
							'type'  => 'textarea',
							'key'   => 'help',
							'label' => __( 'Help text', 'booking' ),
							'rows'  => 3,
						),
					),
				),
				array(
					'key'      => 'appearance',
					'label'    => __( 'Advanced', 'booking' ),
					'controls' => array(
						array( 'type' => 'text', 'key' => 'cssclass', 'label' => __( 'CSS class', 'booking' ) ),
						array( 'type' => 'text', 'key' => 'html_id',  'label' => __( 'HTML ID', 'booking' ) ),
					),
				),
			),
		),

		// No templates_printer for Schema-driven variant.
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_submit_schema' );


/**
 * Enqueue the Submit field pack JS for the Builder page.
 *
 * This hook is fired only on the Builder page (gated by is_builder_by_request()).
 *
 * @param string $page Current admin page slug.
 *
 * @return void
 */
function wpbc_bfb_enqueue__field_submit_schema_js( $page ) {

	wp_enqueue_script( 'wpbc-bfb_field_submit_schema', wpbc_plugin_url( '/includes/page-form-builder/field-packs/submit/_out/submit.js' ), array( 'wpbc-bfb' ), WP_BK_VERSION_NUM, true );
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_submit_schema_js', 10, 1 );


/**
 * (Optional) Register the "Submit" palette item in "general/bottom".
 *
 * If your palette auto-builds from packs, you can remove this.
 *
 * @param string $group    Palette group: 'general' | 'advanced' | ...
 * @param string $position Position: 'top' | 'bottom'
 *
 * @return void
 */
function wpbc_bfb_palette_register_items__submit_schema( $group, $position ) {

	if ( 'essentials' !== $group || 'bottom' !== $position ) {
		return;
	}
	?>
	<li class="wpbc_bfb__field"
		data-id="submit"
		data-type="submit"
		data-usage_key="submit"
		data-usagenumber="1"
		data-label="<?php echo esc_attr( __( 'Send', 'booking' ) ); ?>">
		<i class="menu_icon icon-1x wpbc-bi-check2-circle"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html( __( 'Submit', 'booking' ) ); ?></span>
		<span class="wpbc_bfb__field-type">submit</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__submit_schema', 10, 2 );
