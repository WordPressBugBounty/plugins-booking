<?php
/**
 * WPBC BFB Preset: Second Name (prefilled Text field)
 *
 * Purpose:
 * - Adds a ready-to-use “Second Name” item to the palette that reuses the Text field pack (type="text").
 * - Prefills ONLY these props: min_width, label, placeholder, required, help, name, cssclass.
 *
 * How it works:
 * - The palette <li> carries data-* attributes mirroring field props.
 * - On drop, the Builder merges these attributes into the new field’s data object and normalizes via the Text pack schema.
 *
 * File:
 * - /includes/page-form-builder/field-packs/text-secondname/field-text-secondname-preset.php
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
 * Class-like wrapper (snake_case) for the “Second Name” prefilled Text preset.
 */
class wpbc_bfb_preset_text_secondname {

	/**
	 * Bootstrap — attach hooks.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'wpbc_bfb_palette_register_items', array( __CLASS__, 'palette_register_items' ), 10, 2 );
	}

	/**
	 * Prefilled props for the Second Name preset.
	 *
	 * @return array Prefilled properties for the field data object.
	 */
	public static function get_preset_props() {
		$props = array(
			// Renderer/type contract.
			'type'        => 'text',

			// Visual / UX (prefilled).
			'min_width'   => '8em',
			'label'       => __( 'Last Name', 'booking' ),
			'placeholder' => __( 'Example: "Smith"', 'booking' ),
			'required'    => 1,
			'help'        => __( 'Enter your last name.', 'booking' ),

			// Naming / CSS (prefilled).
			'name'        => 'secondname',
			'cssclass'    => 'secondname lastname',
		);

		/**
		 * Filter: allow customizing preset props at runtime.
		 *
		 * @param array $props
		 */
		return apply_filters( 'wpbc_bfb_preset_text_secondname_props', $props );
	}

	/**
	 * Register the prefilled “Second Name” item in the Builder palette.
	 *
	 * @param string $group    Palette group slug (e.g., 'general').
	 * @param string $position Palette position (e.g., 'top' or 'bottom').
	 *
	 * @return void
	 */
	public static function palette_register_items( $group, $position ) {
		// User requested 'general' group.
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
			data-id="text-secondname"
			data-type="text"
			data-usage_key="text"
			data-label="<?php echo esc_attr( $esc( $props['label'] ) ); ?>"

			<?php // Prefilled props (merged into the new field’s data on drop). ?>
			data-name="<?php echo esc_attr( $esc( $props['name'] ) ); ?>"
			data-placeholder="<?php echo esc_attr( $esc( $props['placeholder'] ) ); ?>"
			data-required="<?php echo esc_attr( $esc( $props['required'] ) ); ?>"
			data-help="<?php echo esc_attr( $esc( $props['help'] ) ); ?>"
			data-cssclass="<?php echo esc_attr( $esc( $props['cssclass'] ) ); ?>"
			data-min_width="<?php echo esc_attr( $esc( $props['min_width'] ) ); ?>"
		>
			<i class="menu_icon icon-1x wpbc-bi-person"></i>
			<span class="wpbc_bfb__field-label"><?php echo esc_html( $props['label'] ); ?></span>
			<span class="wpbc_bfb__field-type">secondname | text</span>
		</li>
		<?php
	}
}

// Initialize preset.
wpbc_bfb_preset_text_secondname::init();
