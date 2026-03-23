<?php
/**
 * WPBC BFB Pack: Divider (Horizontal / Vertical line) — Schema-driven, Factory Inspector
 *
 * Purpose:
 * - Adds a simple visual separator field that renders as a horizontal or vertical line.
 * - One pack type "divider" with an 'orientation' property: 'horizontal' | 'vertical'.
 * - Inspector is Factory-driven (no WP templates). Preview is rendered by a pure JS renderer class.
 * - Keep defaults in 'schema' synchronized with JS get_defaults() in _out/divider.js.
 *
 * Contracts Used:
 * - Filter:  wpbc_bfb_register_field_packs
 * - Action:  wpbc_enqueue_js_field_pack
 * - Action:  wpbc_bfb_palette_register_items (optional palette registration)
 *
 * File:  ../includes/page-form-builder/field-packs/divider/field-divider.php
 *
 * @package     Booking Calendar
 * @author      wpdevelop
 * @since       11.0.0
 * @modified    2025-09-22
 * @version     1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the "divider" field pack (Schema-driven Inspector).
 *
 * Props stored in schema (coercion/validation is handled by Inspector/Factory):
 * - orientation     : string  'horizontal' | 'vertical' (default 'horizontal')
 * - line_style      : string  'solid' | 'dashed' | 'dotted' (default 'solid')
 * - thickness_px    : int     1..20 (default 1)
 * - length          : string  CSS length/percent, e.g. '100%', '120px' (default '100%')
 * - align           : string  'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
 * - color           : string  CSS color (default '#e0e0e0')
 * - margin_top_px   : int     0..200 (default 8)
 * - margin_bottom_px: int     0..200 (default 8)
 * - margin_left_px  : int     0..200 (default 8)
 * - margin_right_px : int     0..200 (default 8)
 * - cssclass_extra  : string  optional extra CSS classes
 * - name            : string  optional internal name
 * - html_id         : string  optional HTML id
 * - help            : string  optional help text (Inspector-only)
 *
 * @param array $packs Accumulated packs.
 *
 * @return array Modified packs with "divider" field included.
 */
function wpbc_bfb_register_field_packs__field_divider_schema( $packs ) {

	$packs['divider'] = array(
		'kind'      => 'field',
		'type'      => 'divider',
		'label'     => __( 'Divider', 'booking' ),
		'icon'      => 'minus',
		'usage_key' => 'divider',

		// === Schema: coercion/validation + defaults for Inspector/serialization ===
		'schema'    => array(
			'props' => array(
				'orientation'      => array( 'type' => 'enum',   'values' => array( 'horizontal', 'vertical' ), 'default' => 'horizontal' ),
				'line_style'       => array( 'type' => 'enum',   'values' => array( 'solid', 'dashed', 'dotted' ), 'default' => 'solid' ),
				'thickness_px'     => array( 'type' => 'int',    'min' => 1, 'max' => 20, 'default' => 1 ),
				'length'           => array( 'type' => 'string', 'default' => '100%' ),
				'align'            => array( 'type' => 'enum',   'values' => array( 'left', 'center', 'right', 'top', 'middle', 'bottom' ), 'default' => 'center' ),
				'color'            => array( 'type' => 'string', 'default' => '#e0e0e0' ),
				'margin_top_px'    => array( 'type' => 'int',    'min' => 0, 'max' => 200, 'default' => 8 ),
				'margin_bottom_px' => array( 'type' => 'int',    'min' => 0, 'max' => 200, 'default' => 8 ),
				'margin_left_px'   => array( 'type' => 'int',    'min' => 0, 'max' => 200, 'default' => 8 ),
				'margin_right_px'  => array( 'type' => 'int',    'min' => 0, 'max' => 200, 'default' => 8 ),
				'cssclass_extra'   => array( 'type' => 'string', 'default' => '' ),
				'name'             => array( 'type' => 'string', 'default' => '' ),
				'html_id'          => array( 'type' => 'string', 'default' => '' ),
				'help'             => array( 'type' => 'string', 'default' => '' ),
			),
		),

		// === Inspector UI (Factory-driven; no WP templates here) ===
		'inspector_ui' => array(
			'title'          => __( 'Divider', 'booking' ),
			'description'    => __( 'Configure a horizontal or vertical separator line.', 'booking' ),
			'header_variant' => 'toolbar',
			'header_actions' => array( 'deselect', 'scrollto', 'move-up', 'move-down', 'duplicate', 'delete' ),
			'groups'         => array(
				array(
					'key'      => 'basic',
					'label'    => __( 'Basic', 'booking' ),
					'open'     => true,
					'controls' => array(
						array(
							'type'    => 'select',
							'key'     => 'orientation',
							'label'   => __( 'Orientation', 'booking' ),
							'options' => array(
								array( 'value' => 'horizontal', 'label' => __( 'Horizontal', 'booking' ) ),
								array( 'value' => 'vertical',   'label' => __( 'Vertical', 'booking' ) ),
							),
						),
						array(
							'type'    => 'select',
							'key'     => 'line_style',
							'label'   => __( 'Line Style', 'booking' ),
							'options' => array(
								array( 'value' => 'solid',  'label' => __( 'Solid', 'booking' ) ),
								array( 'value' => 'dashed', 'label' => __( 'Dashed', 'booking' ) ),
								array( 'value' => 'dotted', 'label' => __( 'Dotted', 'booking' ) ),
							),
						),
						array(
							'type'  => 'range_number',
							'key'   => 'thickness_px',
							'label' => __( 'Thickness (px)', 'booking' ),
							'min'   => 1,
							'max'   => 20,
							'step'  => 1,
						),
						array(
							'type'          => 'len',
							'key'           => 'length',
							'label'         => __( 'Length', 'booking' ),
							'units'         => array( '%', 'px', 'rem', 'em' ),
							'fallback_unit' => '%',
							// Optional per-unit slider bounds (defaults shown below; omit to use JS defaults).
							'slider'        => array(
								'%'   => array( 'min' => 0, 'max' => 100, 'step' => 1 ),
								'px'  => array( 'min' => 0, 'max' => 512, 'step' => 1 ),
								'rem' => array( 'min' => 0, 'max' => 10, 'step' => 0.1 ),
								'em'  => array( 'min' => 0, 'max' => 10, 'step' => 0.1 ),
							),
						),

						array(
							'type'    => 'select',
							'key'     => 'align',
							'label'   => __( 'Alignment', 'booking' ),
							'options' => array(
								array( 'value' => 'left',   'label' => __( 'Left', 'booking' ) ),
								array( 'value' => 'center', 'label' => __( 'Center', 'booking' ) ),
								array( 'value' => 'right',  'label' => __( 'Right', 'booking' ) ),
								// Extra options for vertical orientation; will be disabled for horizontal in JS.
								array( 'value' => 'top',    'label' => __( 'Top', 'booking' ) ),
								array( 'value' => 'middle', 'label' => __( 'Middle', 'booking' ) ),
								array( 'value' => 'bottom', 'label' => __( 'Bottom', 'booking' ) ),
							),
						),
                        array( 'type' => 'color', 'key' => 'color', 'label' => __( 'Color', 'booking' ), 'placeholder' => '#e0e0e0' ),
					),
				),
				array(
					'key'      => 'spacing',
					'label'    => __( 'Spacing', 'booking' ),
					'controls' => array(
						array( 'type' => 'range_number', 'key' => 'margin_top_px',    'label' => __( 'Margin Top (px)', 'booking' ),    'min' => 0, 'max' => 200, 'step' => 1 ),
						array( 'type' => 'range_number', 'key' => 'margin_bottom_px', 'label' => __( 'Margin Bottom (px)', 'booking' ), 'min' => 0, 'max' => 200, 'step' => 1 ),
						array( 'type' => 'range_number', 'key' => 'margin_left_px',   'label' => __( 'Margin Left (px)', 'booking' ),   'min' => 0, 'max' => 200, 'step' => 1 ),
						array( 'type' => 'range_number', 'key' => 'margin_right_px',  'label' => __( 'Margin Right (px)', 'booking' ),  'min' => 0, 'max' => 200, 'step' => 1 ),

					),
				),
				array(
					'key'      => 'advanced',
					'label'    => __( 'Advanced', 'booking' ),
					'controls' => array(
						array( 'type' => 'text',     'key' => 'cssclass_extra', 'label' => __( 'Extra CSS classes', 'booking' ) ),
						array( 'type' => 'text',     'key' => 'name',           'label' => __( 'Name', 'booking' ) ),
						array( 'type' => 'text',     'key' => 'html_id',        'label' => __( 'HTML ID', 'booking' ) ),
						array( 'type' => 'textarea', 'key' => 'help',           'label' => __( 'Help text', 'booking' ), 'rows' => 3 ),
					),
				),
			),
		),
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_divider_schema' );


/**
 * Enqueue the Divider field pack assets for the Builder page.
 *
 * Notes:
 * - The JS file must implement the 'divider' renderer and respect the schema defaults above.
 * - The CSS file can be minimal; most visuals are inline-styled by the renderer for simplicity.
 *
 * @param string $page Current admin page slug (unused, provided for parity with other packs).
 *
 * @return void
 */
function wpbc_bfb_enqueue__field_divider_schema_assets( $page ) {

	wp_enqueue_script( 'wpbc-bfb_field_divider_schema', wpbc_plugin_url( '/includes/page-form-builder/field-packs/divider/_out/divider.js' ), array( 'wpbc-bfb' ), WP_BK_VERSION_NUM, true );
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_divider_schema_assets', 10, 1 );


/**
 * (Optional) Register ready-to-use "Horizontal" and "Vertical" palette items in "general/bottom".
 *
 * If your palette auto-builds from packs, you can remove this action.
 * We provide flat data-* hints so the builder can initialize presets without templates:
 *   data-orientation="horizontal|vertical"
 *   data-line_style="solid|dashed|dotted"
 *   data-thickness_px="N"
 *   data-length="CSSLen"
 *   data-align="left|center|right"
 *   data-color="#hex"
 *
 * @param string $group    Palette group: 'general' | 'advanced' | ...
 * @param string $position Position: 'top' | 'bottom'
 *
 * @return void
 */
function wpbc_bfb_palette_register_items__divider_schema( $group, $position ) {

	if ( 'layout' !== $group || 'top' !== $position ) {
		return;
	}
	?>
	<li style="width:100%;margin: -5px 0;"><hr /></li>
	<li class="wpbc_bfb__field" data-id="divider_horizontal" data-type="divider" data-usage_key="divider" data-orientation="horizontal"
		data-line_style="solid" data-thickness_px="1" data-length="100%" data-align="center" data-color="#e0e0e0">
		<i class="menu_icon icon-1x wpbc-bi-border-center"></i> <span class="wpbc_bfb__field-label"><?php echo esc_html( __( 'Horizontal Line', 'booking' ) ); ?></span>
		<span class="wpbc_bfb__field-type">divider</span>
	</li>

	<li class="wpbc_bfb__field" data-id="divider_vertical" data-type="divider" data-usage_key="divider" data-orientation="vertical"
		data-line_style="solid" data-thickness_px="1" data-length="100%" data-align="middle" data-color="#e0e0e0">
		<i class="menu_icon icon-1x wpbc-bi-border-middle"></i> <span class="wpbc_bfb__field-label"><?php echo esc_html( __( 'Vertical Line', 'booking' ) ); ?></span>
		<span class="wpbc_bfb__field-type">divider</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__divider_schema', 10, 2 );
