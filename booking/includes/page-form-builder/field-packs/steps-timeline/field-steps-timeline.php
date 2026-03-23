<?php
/**
 * WPBC BFB Pack: Steps Timeline (Wizard Progress Indicator) — Schema-driven, Factory Inspector
 *
 * Purpose:
 * - Adds a visual progress indicator for multi-step (wizard) forms.
 * - One pack type "steps_timeline" with props: steps_count, active_step, color, cssclass_extra/html_id/help.
 * - Inspector is Factory-driven (no WP templates). Preview is rendered by a pure JS renderer class.
 * - Optional exporter hook (JS) emits shortcode: [steps_timeline steps_count="N" active_step="X" color="#HEX"]
 *   Note: shortcode name intentionally matches legacy typo "steps_timeline" used in advanced form mode.
 *
 * Contracts Used:
 * - Filter:  wpbc_bfb_register_field_packs
 * - Action:  wpbc_enqueue_js_field_pack
 * - Action:  wpbc_bfb_palette_register_items (optional palette registration)
 *
 * Files:
 *   ../includes/page-form-builder/field-packs/steps-timeline/field-steps-timeline.php   (this file)
 *   ../includes/page-form-builder/field-packs/steps-timeline/_out/steps-timeline.js     (renderer + exporter glue)
 *
 * @package   Booking Calendar
 * @author    wpdevelop
 * @since     11.0.0
 * @modified  2025-11-07
 * @version   1.0.1
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the "steps_timeline" field pack (Schema-driven Inspector).
 *
 * Props stored in schema (coercion/validation is handled by Inspector/Factory):
 * - steps_count     : int    2..12 (default 3) — total number of steps (nodes)
 * - active_step     : int    1..steps_count (default 1) — currently active step (1-based)
 * - color           : string CSS color (default '#619d40') — line and active/completed dot color
 * - cssclass_extra  : string optional extra CSS classes
 * - html_id         : string optional HTML id
 * - help            : string optional help text (Inspector-only)
 *
 * Inspector UI notes:
 * - "name" control is intentionally hidden/omitted (not needed for this non-input visual element).
 *
 * @param array $packs Accumulated packs.
 * @return array Modified packs with "steps_timeline" field included.
 */
function wpbc_bfb_register_field_packs__field_steps_timeline_schema( $packs ) {

	$packs['steps_timeline'] = array(
		'kind'      => 'field',
		'type'      => 'steps_timeline',
		'label'     => __( 'Steps Timeline', 'booking' ),
		'icon'      => 'clock',
		'usage_key' => 'steps_timeline',

		// === Schema: coercion/validation + defaults for Inspector/serialization ===
		'schema'    => array(
			'props' => array(
				'steps_count'    => array( 'type' => 'int',    'min' => 2,  'max' => 12, 'default' => 3 ),
				'active_step'    => array( 'type' => 'int',    'min' => 1,  'max' => 12, 'default' => 1 ),
				'color'          => array( 'type' => 'string', 'default' => '#619d40' ),
				'cssclass_extra' => array( 'type' => 'string', 'default' => '' ),
				'html_id'        => array( 'type' => 'string', 'default' => '' ),
				'help'           => array( 'type' => 'string', 'default' => '' ),
				// "name" is supported in storage but hidden in Inspector to avoid confusion.
				'name'           => array( 'type' => 'string', 'default' => '' ),
			),
		),

		// === Inspector UI (Factory-driven; no WP templates here) ===
		'inspector_ui' => array(
			'title'          => __( 'Steps Timeline', 'booking' ),
			'description'    => __( 'Configure a multi-step progress indicator for wizard-style forms.', 'booking' ),
			'header_variant' => 'toolbar',
			'header_actions' => array( 'deselect', 'scrollto', 'move-up', 'move-down', 'duplicate', 'delete' ),
			'groups'         => array(
				array(
					'key'      => 'basic',
					'label'    => __( 'Basic', 'booking' ),
					'open'     => true,
					'controls' => array(
						array(
							'type'  => 'range_number',
							'key'   => 'steps_count',
							'label' => __( 'Steps Count', 'booking' ),
							'min'   => 2,
							'max'   => 12,
							'step'  => 1,
							'help'  => __( 'Total number of steps (2–12).', 'booking' ),
						),
						array(
							'type'  => 'range_number',
							'key'   => 'active_step',
							'label' => __( 'Active Step', 'booking' ),
							'min'   => 1,
							'max'   => 12,
							'step'  => 1,
							'help'  => __( 'Currently highlighted step (1-based). Will be clamped to Steps Count.', 'booking' ),
						),
						array(
							'type'        => 'color',
							'key'         => 'color',
							'label'       => __( 'Color', 'booking' ),
							'placeholder' => '#619d40',
						),
					),
				),
				array(
					'key'      => 'advanced',
					'label'    => __( 'Advanced', 'booking' ),
					'controls' => array(
						array( 'type' => 'text',     'key' => 'cssclass_extra', 'label' => __( 'Extra CSS classes', 'booking' ) ),
						// "name" intentionally omitted from Inspector
						array( 'type' => 'text',     'key' => 'html_id',        'label' => __( 'HTML ID', 'booking' ) ),
						array( 'type' => 'textarea', 'key' => 'help',           'label' => __( 'Help text', 'booking' ), 'rows' => 3 ),
					),
				),
			),
		),
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_steps_timeline_schema' );

/**
 * Enqueue the Steps Timeline field pack assets for the Builder page.
 *
 * Notes:
 * - The JS file implements the 'steps_timeline' renderer (and safe exporter glue).
 * - CSS file is optional — the JS injects a minimal fallback for preview if not present.
 *
 * @param string $page Current admin page slug (unused, provided for parity with other packs).
 * @return void
 */
function wpbc_bfb_enqueue__field_steps_timeline_assets( $page ) {

	wp_enqueue_script(
		'wpbc-bfb_field_steps_timeline',
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/steps-timeline/_out/steps-timeline.js' ),
		array( 'wpbc-bfb' ),
		WP_BK_VERSION_NUM,
		true
	);
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_steps_timeline_assets', 10, 1 );

/**
 * (Optional) Register a ready-to-use palette item in "structure/bottom".
 *
 * Data hints allow initializing defaults without templates:
 *   data-steps_count="3"
 *   data-active_step="1"
 *   data-color="#619d40"
 *   data-usagenumber="1"  (limit: one per page; requires UsageLimitService aggregation by usage_key)
 *
 * @param string $group    Palette group: 'general' | 'advanced' | 'structure' | ...
 * @param string $position Position: 'top' | 'bottom'
 * @return void
 */
function wpbc_bfb_palette_register_items__steps_timeline_schema( $group, $position ) {

	if ( 'navigation' !== $group || 'top' !== $position ) {
		return;
	}
	?>
	<li class="wpbc_bfb__field"
		data-id="steps_timeline"
		data-type="steps_timeline"
		data-usage_key="steps_timeline"
		data-steps_count="3"
		data-active_step="1"
		data-color="#619d40">
		<i class="menu_icon icon-1x wpbc-bi-segmented-nav"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html( __( 'Steps Timeline', 'booking' ) ); ?></span>
		<span class="wpbc_bfb__field-type">steps_timeline</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__steps_timeline_schema', 10, 2 );
