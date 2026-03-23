<?php
/**
 * WPBC BFB Preset: First Name (prefilled Text field)
 *
 * Purpose:
 * - Adds a ready-to-use “First Name” field to the palette, prefilled with specific properties.
 * - Reuses the existing Text field pack renderer/templates (type = "text"); no extra JS required.
 *
 * How it works:
 * - The palette <li> carries data-* attributes mirroring field props.
 * - On drop, the Builder merges these attributes into the new field’s data object.
 *
 * The preset’s palette item declares data-type="text".
 * That means the exact same renderer class is used: WPBC_BFB_Field_Text from your Text pack (_out/field-text-wptpl.js).
 * It also uses the same wp.template() blocks the Text pack prints:
 * Preview: tmpl-wpbc-bfb-field-text
 * Inspector: tmpl-wpbc-bfb-inspector-text
 * Result: no new JS renderer, no duplicate templates—just reuse.
 *
 * On drop, the Builder takes the <li> dataset from the palette (your preset) and merges it into the new field’s data object.
 * That data object is normalized against the Text pack defaults (get_defaults() in WPBC_BFB_Field_Text) and the Text PHP schema in field-text-wptpl.php.
 * Your preset simply provides initial values for those same Text props:
 * label -> “First Name”
 * name -> firstname
 * placeholder -> Example: "John"
 * required -> 1
 * help -> Enter your first name.
 * minlength -> 5
 * maxlength -> 10
 * pattern -> aaa (passed straight into the input’s pattern attribute)
 * cssclass -> firstname myname
 * html_id -> my-name
 * min_width -> 8em (layout hint stored at wrapper; the Text pack happily ignores it, but the Builder UI uses it)
 *
 * File:
 * - /includes/page-form-builder/field-packs/text-firstname/field-text-firstname-preset.php
 *
 * @package   Booking Calendar
 * @author    wpdevelop, oplugins
 * @since     11.0.0
 * @modified  2025-10-19
 * @version   1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class-like wrapper (snake_case) for the “First Name” prefilled Text preset.
 *
 * Notes:
 * - Uses WordPress coding standards and snake_case for class, methods, functions, variables.
 * - Prefilled values match the user’s requested structure (where applicable in the Builder).
 */
class wpbc_bfb_preset_text_firstname {

	/**
	 * Bootstrap — attach hooks.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'wpbc_bfb_palette_register_items', array( __CLASS__, 'palette_register_items' ), 10, 2 );
	}

	/**
	 * Return the prefilled props for the First Name preset.
	 *
	 * Keys correspond to Text field pack properties (and optional field-level width).
	 * Filterable via 'wpbc_bfb_preset_text_firstname_props'.
	 *
	 * @return array Prefilled properties for the field data object.
	 */
	public static function get_preset_props() {
		$props = array(
			// Renderer/type contract.
			'type'       => 'text',

			// Visual / UX.
			'min_width'  => '8em',
			'label'      => __( 'First Name', 'booking' ),
			'placeholder'=> 'Example: "John"',
			'required'   => 1,
			'help'       => __( 'Enter your first name.', 'booking' ),

			// Validation
			//			'minlength'  => '',
			//			'maxlength'  => '',
			//			'pattern'    => '', // keep as provided; adjust pattern to your real needs later

			// Naming / CSS
			'name'       => 'firstname',
			'cssclass'   => 'firstname',
			// 'html_id'    => '',

			// Optional legacy/internal hints (not always used by all renderers)
			// 'default_value' => '',
			// 'id'            => 'input-text',  // internal field id is usually auto-managed; included here only if your core honors it
		);

		/**
		 * Filter: allow customizing preset props at runtime.
		 *
		 * @param array $props
		 */
		return apply_filters( 'wpbc_bfb_preset_text_firstname_props', $props );
	}

	/**
	 * Register the prefilled “First Name” item in the Builder palette.
	 *
	 * Reuses the Text field pack by setting data-type="text" and passing all prefilled values
	 * via data-* attributes (merged by the Builder on drop).
	 *
	 * @param string $group    Palette group slug (e.g., 'standard').
	 * @param string $position Palette position (e.g., 'top' or 'bottom').
	 *
	 * @return void
	 */
	public static function palette_register_items( $group, $position ) {
		// Adjust target zone as needed.
		if ( 'essentials' !== $group || 'top' !== $position ) {
			return;
		}

		$props = self::get_preset_props();

		// Safety esc for attributes.
		$esc = function ( $v ) {
			return is_scalar( $v ) ? $v : wp_json_encode( $v );
		};
		?>
		<li class="wpbc_bfb__field"
			data-id="text-firstname"
			data-type="text"
			data-usage_key="text"
			data-label="<?php echo esc_attr( $esc( $props['label'] ) ); ?>"

			<?php // Prefilled props (merged into the new field’s data on drop). ?>
			data-name="<?php echo esc_attr( $esc( $props['name'] ) ); ?>"
			data-placeholder="<?php echo esc_attr( $esc( $props['placeholder'] ) ); ?>"
			data-required="<?php echo esc_attr( $esc( $props['required'] ) ); ?>"
			data-help="<?php echo esc_attr( $esc( $props['help'] ) ); ?>"
			<?php /*
			data-minlength="<?php echo esc_attr( $esc( $props['minlength'] ) ); ?>"
			data-maxlength="<?php echo esc_attr(  $esc( $props['maxlength'] ) ); ?>"
			data-pattern="<?php echo esc_attr( $esc( $props['pattern'] ) ); ?>"
			data-html_id="<?php echo esc_attr( $esc( $props['html_id'] ) ); ?>"
 			*/ ?>
			data-cssclass="<?php echo esc_attr( $esc( $props['cssclass'] ) ); ?>"
			data-min_width="<?php echo esc_attr( $esc( $props['min_width'] ) ); ?>"
		>
			<i class="menu_icon icon-1x wpbc-bi-person"></i>
			<span class="wpbc_bfb__field-label"><?php echo esc_html( $props['label'] ); ?></span>
			<span class="wpbc_bfb__field-type">firstname | text</span>
		</li>
		<?php
	}
}

// Initialize preset.
wpbc_bfb_preset_text_firstname::init();
