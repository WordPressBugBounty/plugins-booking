<?php
/**
 * WPBC BFB Pack: Wizard Navigation Button (Back / Next) — Schema-driven, Factory Inspector
 *
 * Purpose:
 * - Adds a field pack that renders a "Back" or "Next" button to move between booking form pages (wizard steps).
 * - Strictly keeps the required front-end classes so external scripts can handle navigation:
 *     <a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_{N}">Label</a>
 * - The trailing number in "wpbc_wizard_step_{N}" defines the destination page (1-based).
 * - No WP templates for Inspector; preview is rendered by a pure JS renderer class.
 * - Keep schema defaults in sync with JS get_defaults().
 *
 * Contracts Used:
 * - Filter:  wpbc_bfb_register_field_packs
 * - Action:  wpbc_enqueue_js_field_pack
 * - Action:  wpbc_bfb_palette_register_items (optional palette registration)
 *
 * File:  ../includes/page-form-builder/field-packs/wizard-nav/field-wizard-nav.php
 *
 * @package     Booking Calendar
 * @author      wpdevelop, oplugins
 * @since       11.0.0
 * @modified    2025-09-22
 * @version     1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the "wizard_nav" field pack (Schema-driven Inspector).
 *
 * Props stored in schema (coercion/validation handled by Inspector/Factory):
 * - direction      : string  'next' | 'back' (default 'next')
 * - label          : string  Visible text (default depends on direction)
 * - target_step    : int     Destination page number, >= 1 (default 2 for 'next', 1 for 'back')
 * - cssclass_extra : string  Optional extra CSS classes (required classes added by renderer)
 * - name           : string  Optional internal name
 * - html_id        : string  Optional HTML id
 * - help           : string  Optional help text (Inspector-only aid)
 *
 * @param array $packs Accumulated packs.
 *
 * @return array Modified packs with "wizard_nav" field included.
 */
function wpbc_bfb_register_field_packs__field_wizard_nav_schema( $packs ) {

	$packs['wizard_nav'] = array(
		'kind'      => 'field',
		'type'      => 'wizard_nav',
		'label'     => __( 'Wizard Button', 'booking' ),
		'icon'      => 'admin-links',
		'usage_key' => 'wizard_nav',

		// === Schema: coercion/validation + defaults for Inspector/serialization ===
		'schema'    => array(
			'props' => array(
				'direction'      => array( 'type' => 'enum',    'values' => array( 'next', 'back' ), 'default' => 'next' ),
				'label'          => array( 'type' => 'string',  'default' => __( 'Next', 'booking' ) ),
				'target_step'    => array( 'type' => 'int',     'min' => 1, 'default' => 2 ),
				'cssclass_extra' => array( 'type' => 'string',  'default' => '' ),
//				'name'           => array( 'type' => 'string',  'default' => '' ),
				'html_id'        => array( 'type' => 'string',  'default' => '' ),
				'help'           => array( 'type' => 'string',  'default' => '' ),
			),
		),

		// === Inspector UI (Factory-driven; no WP templates here) ===
		'inspector_ui' => array(
			'title'          => __( 'Wizard Button', 'booking' ),
			'description'    => __( 'Configure a Back/Next button that moves between wizard pages.', 'booking' ),
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
							'key'     => 'direction',
							'label'   => __( 'Direction', 'booking' ),
							'options' => array(
								array( 'value' => 'next', 'label' => __( 'Next', 'booking' ) ),
								array( 'value' => 'back', 'label' => __( 'Back', 'booking' ) ),
							),
							'help'    => __( 'Choose whether this button moves forward or backward.', 'booking' ),
						),
						array( 'type' => 'text',    'key' => 'label',       'label' => __( 'Label', 'booking' ) ),
						array( 'type' => 'number',  'key' => 'target_step', 'label' => __( 'Target Step (page #)', 'booking' ), 'min' => 1, 'step' => 1 ),
					),
				),
				array(
					'key'      => 'appearance',
					'label'    => __( 'Advanced', 'booking' ),
					'controls' => array(
						array( 'type' => 'text',     'key' => 'cssclass_extra', 'label' => __( 'Extra CSS classes', 'booking' ) ),
//						array( 'type' => 'text',     'key' => 'name',           'label' => __( 'Name', 'booking' ) ),
						array( 'type' => 'text',     'key' => 'html_id',        'label' => __( 'HTML ID', 'booking' ) ),
						array( 'type' => 'textarea', 'key' => 'help',           'label' => __( 'Help text', 'booking' ), 'rows' => 3 ),
					),
				),
			),
			/**
			 * Implementation notes for renderer:
			 * - Always include required classes:
			 *     "wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_{N}"
			 * - Append cssclass_extra after required classes.
			 * - Do not allow removing required classes via Inspector.
			 */
		),

		// No templates_printer for Schema-driven variant.
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_wizard_nav_schema' );


/**
 * Enqueue the Wizard Navigation field pack JS for the Builder page.
 *
 * This hook is fired only on the Builder page (gated by is_builder_by_request()).
 * The JS file must implement the 'wizard_nav' renderer and respect required classes:
 *   <a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_{N}">Label</a>
 *
 * @param string $page Current admin page slug.
 *
 * @return void
 */
function wpbc_bfb_enqueue__field_wizard_nav_schema_js( $page ) {

	wp_enqueue_script(
		'wpbc-bfb_field_wizard_nav_schema',
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/wizard-nav/_out/wizard-nav.js' ),
		array( 'wpbc-bfb' ),
		WP_BK_VERSION_NUM,
		true
	);
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_wizard_nav_schema_js', 10, 1 );


/**
 * (Optional) Register the "Next" and "Back" palette items in "general/bottom".
 *
 * If your palette auto-builds from packs, you can remove this.
 * Notes:
 * - We provide flat data-* hints so the builder can initialize presets without templates:
 *     data-direction="next|back"  data-target_step="N"  data-label="..."
 * - Required classes are added by the JS renderer; do not include them here.
 *
 * @param string $group    Palette group: 'general' | 'advanced' | ...
 * @param string $position Position: 'top' | 'bottom'
 *
 * @return void
 */
function wpbc_bfb_palette_register_items__wizard_nav_schema( $group, $position ) {

	if ( 'navigation' !== $group || 'top' !== $position ) {
		return;
	}
	?>
	<li class="wpbc_bfb__field"
		data-id="wizard_nav_back"
		data-type="wizard_nav"
		data-usage_key="wizard_nav"
		data-direction="back"
		data-target_step="1"
		data-label="<?php echo esc_attr( __( 'Back', 'booking' ) ); ?>">
		<i class="menu_icon icon-1x wpbc_icn_arrow_back"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html( __( 'Back Button', 'booking' ) ); ?></span>
		<span class="wpbc_bfb__field-type">Wizard Buttons</span>
	</li>
	<li class="wpbc_bfb__field"
		data-id="wizard_nav_next"
		data-type="wizard_nav"
		data-usage_key="wizard_nav"
		data-direction="next"
		data-target_step="2"
		data-label="<?php echo esc_attr( __( 'Next', 'booking' ) ); ?>">
		<i class="menu_icon icon-1x wpbc_icn_arrow_forward"></i>
		<span class="wpbc_bfb__field-label"><?php echo  esc_html( __( 'Next Button', 'booking' ) );; ?></span>
		<span class="wpbc_bfb__field-type">Wizard Buttons</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__wizard_nav_schema', 10, 2 );
