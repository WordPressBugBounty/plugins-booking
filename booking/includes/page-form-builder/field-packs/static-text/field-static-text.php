<?php
/**
 * WPBC BFB Pack: Static Text (label / paragraph / heading) — Schema-driven, Factory Inspector
 *
 * Purpose:
 * - Non-interactive text block for headings, labels, paragraphs, etc.
 * - One pack type "static_text" with props: text, tag, align, bold, italic, html_allowed, nl2br, cssclass_extra, html_id, help.
 * - Inspector is Factory-driven (no WP templates). Preview is rendered by a pure JS renderer class.
 * - Exporter (JS) emits plain HTML (optionally wrapped with id/class) + optional help.
 *
 * Contracts Used:
 * - Filter:  wpbc_bfb_register_field_packs
 * - Action:  wpbc_enqueue_js_field_pack
 * - Action:  wpbc_bfb_palette_register_items (optional palette registration)
 *
 * Files:
 *   ../includes/page-form-builder/field-packs/static-text/field-static-text.php   (this file)
 *   ../includes/page-form-builder/field-packs/static-text/_out/static-text.js     (renderer + exporter glue)
 *
 * @package   Booking Calendar
 * @author    wpdevelop
 * @since     11.0.0
 * @modified  2025-11-08
 * @version   1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the "static_text" field pack (Schema-driven Inspector).
 *
 * Props stored in schema:
 * - text            : string — content to show
 * - tag             : string — allowed: p,label,span,small,div,h1,h2,h3,h4,h5,h6
 * - align           : string — left|center|right
 * - bold            : int|bool — 0|1
 * - italic          : int|bool — 0|1
 * - html_allowed    : int|bool — 0|1
 * - nl2br           : int|bool — 0|1 (applies only when html_allowed=0)
 * - cssclass_extra  : string — optional extra classes for wrapper element
 * - html_id         : string — optional id
 * - help            : string — optional help text (Inspector-only, exported below content)
 * - name            : string — hidden from Inspector, stored for consistency
 *
 * @param array $packs Accumulated packs.
 * @return array Modified packs with "static_text" field included.
 */
function wpbc_bfb_register_field_packs__field_static_text_schema( $packs ) {

	$tag_options = array(
		'p'     => __( 'Paragraph', 'booking' ),
		'label' => __( 'Label', 'booking' ),
		'span'  => __( 'Span', 'booking' ),
		'small' => __( 'Small', 'booking' ),
		'div'   => __( 'Div', 'booking' ),
		'h1'    => 'H1',
		'h2'    => 'H2',
		'h3'    => 'H3',
		'h4'    => 'H4',
		'h5'    => 'H5',
		'h6'    => 'H6',
	);

	$align_options = array(
		'left'   => __( 'Left', 'booking' ),
		'center' => __( 'Center', 'booking' ),
		'right'  => __( 'Right', 'booking' ),
	);

	$packs['static_text'] = array(
		'kind'      => 'field',
		'type'      => 'static_text',
		'label'     => __( 'Static Text', 'booking' ),
		'icon'      => 'text',
		'usage_key' => 'static_text',

		// === Schema: defaults + coercion handled by Inspector/Factory ===
		'schema'    => array(
			'props' => array(
				'text'            => array( 'type' => 'string', 'default' => __( 'Add your message here…', 'booking' ) ),
				'tag'             => array( 'type' => 'string', 'enum' => array_keys( $tag_options ), 'default' => 'p' ),
				'align'           => array( 'type' => 'string', 'enum' => array_keys( $align_options ), 'default' => 'left' ),
				'bold'            => array( 'type' => 'int',    'min'  => 0, 'max' => 1, 'default' => 0 ),
				'italic'          => array( 'type' => 'int',    'min'  => 0, 'max' => 1, 'default' => 0 ),
				'html_allowed'    => array( 'type' => 'int',    'min'  => 0, 'max' => 1, 'default' => 0 ),
				'nl2br'           => array( 'type' => 'int',    'min'  => 0, 'max' => 1, 'default' => 1 ),
				'cssclass_extra'  => array( 'type' => 'string', 'default' => '' ),
				'html_id'         => array( 'type' => 'string', 'default' => '' ),
				'help'            => array( 'type' => 'string', 'default' => '' ),
				// "name" is supported in storage but hidden in Inspector.
				'name'            => array( 'type' => 'string', 'default' => '' ),
			),
		),

		// === Inspector UI (Factory-driven) ===
		'inspector_ui' => array(
			'title'          => __( 'Static Text', 'booking' ),
			'description'    => __( 'Non-interactive text block (paragraph, label, or heading).', 'booking' ),
			'header_variant' => 'toolbar',
			'header_actions' => array( 'deselect', 'scrollto', 'move-up', 'move-down', 'duplicate', 'delete' ),
			'groups'         => array(
				array(
					'key'      => 'content',
					'label'    => __( 'Content', 'booking' ),
					'open'     => true,
					'controls' => array(
						array(
							'type'        => 'textarea',
							'key'         => 'text',
							'label'       => __( 'Text', 'booking' ),
							'rows'        => 3,
							'placeholder' => __( 'Enter text', 'booking' ) . '...',
						),
						array(
							'type'    => 'select',
							'key'     => 'tag',
							'label'   => __( 'HTML Tag', 'booking' ),
							'options' => $tag_options,
						),
						array(
							'type'    => 'select',
							'key'     => 'align',
							'label'   => __( 'Alignment', 'booking' ),
							'options' => $align_options,
						),
						array( 'type' => 'checkbox', 'key' => 'bold',         'label' => __( 'Bold', 'booking' ) ),
						array( 'type' => 'checkbox', 'key' => 'italic',       'label' => __( 'Italic', 'booking' ) ),
						// array( 'type' => 'checkbox', 'key' => 'html_allowed', 'label' => __( 'Allow basic HTML', 'booking' ) ),
						array( 'type' => 'checkbox', 'key' => 'nl2br',        'label' => __( 'Convert newlines to <br> tag', 'booking' ) ),
					),
				),
				array(
					'key'      => 'advanced',
					'label'    => __( 'Advanced', 'booking' ),
					'controls' => array(
						array( 'type' => 'text',     'key' => 'cssclass_extra', 'label' => __( 'Extra CSS classes', 'booking' ) ),
						// "name" intentionally omitted from Inspector
						array( 'type' => 'text',     'key' => 'html_id',        'label' => __( 'HTML ID', 'booking' ) ),
						// array( 'type' => 'textarea', 'key' => 'help',           'label' => __( 'Help text', 'booking' ), 'rows' => 3 ),
					),
				),
			),
		),
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_static_text_schema' );

/**
 * Enqueue the Static Text field pack assets for the Builder page.
 *
 * @param string $page Current admin page slug (unused, provided for parity with other packs).
 * @return void
 */
function wpbc_bfb_enqueue__field_static_text_assets( $page ) {

	wp_enqueue_script(
		'wpbc-bfb_field_static_text',
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/static-text/_out/static-text.js' ),
		array( 'wpbc-bfb' ),
		WP_BK_VERSION_NUM,
		true
	);
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_static_text_assets', 10, 1 );

/**
 * (Optional) Register a palette item.
 *
 * @param string $group    Palette group (e.g., 'general', 'structure').
 * @param string $position Position: 'top' | 'bottom'.
 * @return void
 */
function wpbc_bfb_palette_register_items__static_text_schema( $group, $position ) {

	if ( 'essentials' !== $group || 'top' !== $position ) {
		return;
	}
	?>
	<li class="wpbc_bfb__field"
		data-id="static_text"
		data-type="static_text"
		data-usage_key="static_text"
		data-text="<?php echo esc_attr( __( 'Add your message here…', 'booking' ) ); ?>"
		data-tag="p"
		data-align="left"
		data-bold="0"
		data-italic="0"
		data-html_allowed="0"
		data-nl2br="1">
		<i class="menu_icon icon-1x wpbc-bi-fonts"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html( __( 'Static Text', 'booking' ) ); ?></span>
		<span class="wpbc_bfb__field-type">static_text</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__static_text_schema', 10, 2 );
