<?php
/**
 * WPBC BFB Preset: Service Duration (prefilled Duration Time field)
 *
 * - Reuses the existing Duration Time pack (type = "durationtime").
 * - Adds a tiny JS enhancement that, on “Generate durations”, relabels options as:
 *     Service A (20 min), Service B (30 min), Service C (45 min), Service D (1 hour), ...
 *
 * File:
 *   /includes/page-form-builder/field-packs/time-duration-service/field-durationtime-service-preset.php
 *
 * @package   Booking Calendar
 * @author    wpdevelop
 * @since     11.0.0
 * @modified  2025-11-08
 * @version   1.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class-like wrapper (snake_case) for the “Service Duration” prefilled preset.
 *
 * Notes:
 * - Uses snake_case names and WordPress coding standards.
 * - Reuses existing Duration Time pack (type="durationtime"); name remains locked to "durationtime".
 */
class wpbc_bfb_preset_time_service_duration {

	/**
	 * Bootstrap — attach hooks.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'wpbc_bfb_palette_register_items', array( __CLASS__, 'palette_register_items' ), 10, 2 );
		add_action( 'wpbc_enqueue_js_field_pack', array( __CLASS__, 'enqueue_preset_js' ), 10, 1 );
	}

	/**
	 * Return the prefilled props for the Service Duration preset.
	 *
	 * Keys correspond to the Duration Time field pack properties.
	 * Filterable via 'wpbc_bfb_preset_time_service_duration_props'.
	 *
	 * @return array Prefilled properties for the field data object.
	 */
	public static function get_preset_props() {

		// Predefined options: labels for humans, values strict “HH:MM”.
		$default_options = array(
			/* translators: 1: minutes value */
			array( 'label' => sprintf( __( 'Service A (%s)', 'booking' ), __( '20 min', 'booking' ) ),  'value' => '00:20', 'selected' => false ),
			/* translators: 1: minutes value */
			array( 'label' => sprintf( __( 'Service B (%s)', 'booking' ), __( '30 min', 'booking' ) ),  'value' => '00:30', 'selected' => false ),
			/* translators: 1: minutes value */
			array( 'label' => sprintf( __( 'Service C (%s)', 'booking' ), __( '45 min', 'booking' ) ),  'value' => '00:45', 'selected' => false ),
			/* translators: 1: minutes value */
			array( 'label' => sprintf( __( 'Service D (%s)', 'booking' ), __( '1 hour', 'booking' ) ),  'value' => '01:00', 'selected' => false ),
		);

		$props = array(
			// Renderer/type contract.
			'type'             => 'durationtime',

			// Visual / UX.
			'min_width'        => '240px',
			'label'            => __( 'Service duration', 'booking' ),
			'placeholder'      => '--- ' . __( 'Select service duration', 'booking' ) . ' ---',
			'required'         => 1,
			'help'             => '',

			// Naming / CSS.
			// The Duration Time renderer locks “name” to 'durationtime' for exporter compatibility.
			'name'             => 'durationtime',
			'cssclass'         => 'wpbc_service_duration',

			// Options.
			'options'          => $default_options,

			// Generator defaults (kept for consistency; UI may hide some controls).
			'gen_label_fmt'    => '24h',
			'gen_start_24h'    => '00:20',
			'gen_end_24h'      => '02:00',
			'gen_start_ampm_t' => '00:20',
			'gen_end_ampm_t'   => '02:00',
			'gen_step_h'       => 0,
			'gen_step_m'       => 10,
		);

		return apply_filters( 'wpbc_bfb_preset_time_service_duration_props', $props );
	}

	/**
	 * Register the prefilled “Service duration” item in the Builder palette.
	 *
	 * Reuses the Duration Time field pack by setting data-type="durationtime" and passing all
	 * prefilled values via data-* attributes (merged by the Builder on drop).
	 *
	 * @param string $group    Palette group slug (e.g., 'times').
	 * @param string $position Palette position (e.g., 'top' or 'bottom').
	 *
	 * @return void
	 */
	public static function palette_register_items( $group, $position ) {
		if ( 'times' !== $group || 'bottom' !== $position ) {
			return;
		}

		$props = self::get_preset_props();

		// Safety escape for attributes (JSON for arrays/objects).
		$esc_attr_val = function ( $v ) {
			return is_scalar( $v ) ? $v : wp_json_encode( $v );
		};
		?>
		<li class="wpbc_bfb__field"
			data-id="durationtime"
			data-type="durationtime"
			data-usage_key="durationtime"
			data-usagenumber="1"

			<?php // Prefilled props merged into the new field’s data on drop. ?>
			data-label="<?php echo esc_attr( $esc_attr_val( $props['label'] ) ); ?>"
			data-name="<?php echo esc_attr( $esc_attr_val( $props['name'] ) ); ?>"
			data-placeholder="<?php echo esc_attr( $esc_attr_val( $props['placeholder'] ) ); ?>"
			data-required="<?php echo esc_attr( $esc_attr_val( $props['required'] ) ); ?>"
			data-help="<?php echo esc_attr( $esc_attr_val( $props['help'] ) ); ?>"
			data-cssclass="<?php echo esc_attr( $esc_attr_val( $props['cssclass'] ) ); ?>"
			data-min_width="<?php echo esc_attr( $esc_attr_val( $props['min_width'] ) ); ?>"

			<?php // Generator defaults (kept for completeness; reused by Duration pack logic). ?>
			data-gen_label_fmt="<?php echo esc_attr( $esc_attr_val( $props['gen_label_fmt'] ) ); ?>"
			data-gen_start_24h="<?php echo esc_attr( $esc_attr_val( $props['gen_start_24h'] ) ); ?>"
			data-gen_end_24h="<?php echo esc_attr( $esc_attr_val( $props['gen_end_24h'] ) ); ?>"
			data-gen_start_ampm_t="<?php echo esc_attr( $esc_attr_val( $props['gen_start_ampm_t'] ) ); ?>"
			data-gen_end_ampm_t="<?php echo esc_attr( $esc_attr_val( $props['gen_end_ampm_t'] ) ); ?>"
			data-gen_step_h="<?php echo esc_attr( $esc_attr_val( $props['gen_step_h'] ) ); ?>"
			data-gen_step_m="<?php echo esc_attr( $esc_attr_val( $props['gen_step_m'] ) ); ?>"

			<?php // Predefined options for services (labels + strict HH:MM values). ?>
			data-options="<?php echo esc_attr( wp_json_encode( $props['options'] ) ); ?>"

			<?php // Hints for the Builder (align with duration renderer expectations). ?>
			data-autoname="0"
			data-fresh="0"
			data-name_user_touched="1"
		>
			<i class="menu_icon icon-1x wpbc_icn_timelapse"></i>
			<span class="wpbc_bfb__field-label"><?php echo esc_html( $props['label'] ); ?></span>
			<span class="wpbc_bfb__field-type">service-duration | durationtime</span>
		</li>
		<?php
	}

	/**
	 * Enqueue the preset’s tiny enhancer JS (labels = "Service X (..)") after the base Duration pack.
	 *
	 * @param string $page
	 * @return void
	 */
	public static function enqueue_preset_js( $page ) {
		wp_enqueue_script(
			'wpbc-bfb_field_durationtime_service_preset',
			wpbc_plugin_url( '/includes/page-form-builder/field-packs/time-duration-service/_out/field-durationtime-service-preset.js' ),
			array( 'wpbc-bfb_field_durationtime_wptpl' ),
			WP_BK_VERSION_NUM,
			true
		);
	}
}

wpbc_bfb_preset_time_service_duration::init();
