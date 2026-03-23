<?php
/**
 * BFB Settings Options: Simple option row printer.
 *
 * Conception (simple):
 * - scope=global  -> may show per-row Save UI (save_ui: always|when_changed)
 * - scope=form    -> saved only via "Save Form" (settings_json: {"options":{key:value}})
 * - scope=ui      -> UI-only (no DB save)
 *
 * Args shape:
 * array(
 *   'type'    => 'toggle'|'select'|'radio'|'length'|'range'|'input'|'textarea',
 *   'key'     => 'booking_timeslot_picker',
 *   'scope'   => 'global'|'form'|'ui',
 *   'save_ui' => 'always'|'when_changed',         // only for scope=global
 *   'default' => 'On',                            // initial value for control
 *   'label'   => __( '...', 'booking' ),
 *   'help'    => __( '...', 'booking' ),
 *   'attr'    => array( 'id' => '...', 'class' => '...' ),
 *
 *   // select/radio
 *   'options'      => array( 'value' => 'Label', ... ),
 *   'radio_layout' => 'inline'|'stack',
 *
 *   // input
 *   'input_type'   => 'text'|'number'|...,
 *   'input_attrs'  => array( 'placeholder' => '...', ... ),
 *
 *   // length
 *   'length' => array(
 *     'default_unit' => '%',
 *     'units'        => array( '%' => '%', 'px' => 'px', ... ),
 *     'bounds_map'   => array( '%' => array('min'=>30,'max'=>100,'step'=>1), ... ), // optional
 *   ),
 *
 *   // range (slider number)
 *   'range' => array(
 *     'min'  => 0,
 *     'max'  => 100,
 *     'step' => 1,
 *   ),
 * )
 *
 * @package Booking Calendar
 * @since   11.0.x
 * @file    ../includes/page-form-builder/form-settings/options-render.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPBC_BFB_Setting_Options {

	/**
	 * Print one option row.
	 *
	 * @param array $args
	 */
	public static function print_option( $args ) {

		if ( ! is_array( $args ) ) {
			return;
		}

		$type    = isset( $args['type'] ) ? (string) $args['type'] : 'input';
		$key     = isset( $args['key'] ) ? (string) $args['key'] : '';
		$scope   = isset( $args['scope'] ) ? (string) $args['scope'] : 'ui';
		$save_ui = isset( $args['save_ui'] ) ? (string) $args['save_ui'] : 'when_changed';

		if ( '' === $key ) {
			return;
		}

		$label = isset( $args['label'] ) ? (string) $args['label'] : '';
		$help  = isset( $args['help'] ) ? (string) $args['help'] : '';

		$attr = ( isset( $args['attr'] ) && is_array( $args['attr'] ) ) ? $args['attr'] : array();
		$id   = isset( $attr['id'] ) ? (string) $attr['id'] : 'wpbc_bfb_setting__' . sanitize_html_class( $key );

		$default_value = isset( $args['default'] ) ? $args['default'] : '';

		// Wrapper classes.
		$row_class = 'wpbc_bfb__form_setting wpbc-setting';
		?>
		<div class="<?php echo esc_attr( $row_class ); ?>"
		     data-scope="<?php echo esc_attr( $scope ); ?>"
		     data-key="<?php echo esc_attr( $key ); ?>"
		     data-type="<?php echo esc_attr( $type ); ?>">
			<div class="inspector__row" style="justify-content:space-between;">
				<div class="inspector__control" style="flex:1 1 auto;">

					<?php self::print_control( $args, $id, $key, $scope, $type, $default_value ); ?>

					<?php if ( '' !== $help ) : ?>
						<p class="wpbc_bfb__help" style="margin:6px 0 0 0;"><?php echo esc_html( $help ); ?></p>
					<?php endif; ?>

				</div>

				<?php
				// Global scope only: per-row Save UI.
				if ( 'global' === $scope ) {
					self::print_save_ui( $args, $id, $key, $type, $save_ui );
				}
				?>
			</div>
		</div>
		<?php
	}

	// =================================================================================================
	// Controls
	// =================================================================================================

	/**
	 * Print control (toggle/select/radio/length/input/textarea).
	 *
	 * @param array  $args
	 * @param string $id
	 * @param string $key
	 * @param string $scope
	 * @param string $type
	 * @param mixed  $value
	 */
	private static function print_control( $args, $id, $key, $scope, $type, $value ) {

		$label = isset( $args['label'] ) ? (string) $args['label'] : '';

		$attr = ( isset( $args['attr'] ) && is_array( $args['attr'] ) ) ? $args['attr'] : array();
		$attr['id'] = $id;

		// Extract/normalize class.
		$css_class = '';
		if ( isset( $attr['class'] ) ) {
			$css_class = trim( (string) $attr['class'] );
			unset( $attr['class'] );
		}
		$css_class = trim( 'wpbc-setting__control inspector__input ' . $css_class );

		// Toggle.
		if ( 'toggle' === $type ) {
			self::print_toggle( $id, $key, $scope, $label, $value, $attr, $css_class );
			return;
		}

		// Select.
		if ( 'select' === $type ) {
			$options = ( isset( $args['options'] ) && is_array( $args['options'] ) ) ? $args['options'] : array();
			self::print_select( $id, $key, $scope, $label, $value, $attr, $css_class, $options );
			return;
		}

		// Radio.
		if ( 'radio' === $type ) {
			$options     = ( isset( $args['options'] ) && is_array( $args['options'] ) ) ? $args['options'] : array();
			$radio_layout = ( isset( $args['radio_layout'] ) && 'inline' === $args['radio_layout'] ) ? 'inline' : 'stack';
			self::print_radio( $id, $key, $scope, $label, $value, $options, $radio_layout );
			return;
		}

		// Length.
		if ( 'length' === $type ) {
			$length = ( isset( $args['length'] ) && is_array( $args['length'] ) ) ? $args['length'] : array();
			self::print_length( $id, $key, $scope, $label, $value, $length );
			return;
		}

		// Range (slider number).
		if ( 'range' === $type ) {
			$range = ( isset( $args['range'] ) && is_array( $args['range'] ) ) ? $args['range'] : array();
			self::print_range( $id, $key, $scope, $label, $value, $range, $attr, $css_class );
			return;
		}

		// Textarea.
		if ( 'textarea' === $type ) {
			$input_attrs = ( isset( $args['input_attrs'] ) && is_array( $args['input_attrs'] ) ) ? $args['input_attrs'] : array();
			self::print_textarea( $id, $key, $scope, $label, $value, $attr, $css_class, $input_attrs );
			return;
		}

		// Input (default).
		$input_type  = isset( $args['input_type'] ) ? (string) $args['input_type'] : 'text';
		$input_attrs = ( isset( $args['input_attrs'] ) && is_array( $args['input_attrs'] ) ) ? $args['input_attrs'] : array();
		self::print_input( $id, $key, $scope, $label, $value, $attr, $css_class, $input_type, $input_attrs );
	}

	private static function print_toggle( $id, $key, $scope, $label, $value, $attr, $css_class ) {

		$is_on   = self::is_on( $value );
		$initial = $is_on ? 'On' : 'Off';

		$control_attr = self::with_common_fs_data( $attr, $key, $scope, 'toggle', $initial );
		$control_attr['data-wpbc-bfb-fs-type'] = 'toggle';

		$attr_str = self::build_attr_string( $control_attr );
		?>
		<div class="wpbc_ui__toggle">
			<input type="checkbox"
			       class="<?php echo esc_attr( $css_class ); ?>"
			       value="On"
			       aria-checked="<?php echo $is_on ? 'true' : 'false'; ?>"
			       <?php checked( $is_on ); ?>
			       <?php echo $attr_str; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
			/>
			<label class="wpbc_ui__toggle_icon" for="<?php echo esc_attr( $id ); ?>"></label>
			<label class="wpbc_ui__toggle_label" for="<?php echo esc_attr( $id ); ?>"><strong><?php echo esc_html( $label ); ?></strong></label>
		</div>
		<?php
	}

	private static function print_select( $id, $key, $scope, $label, $value, $attr, $css_class, $options ) {

		$v = is_scalar( $value ) ? (string) $value : '';

		$control_attr = self::with_common_fs_data( $attr, $key, $scope, 'select', $v );
		$control_attr['data-wpbc-bfb-fs-type'] = 'select';

		$attr_str = self::build_attr_string( $control_attr );
		?>
		<label style="display:block;">
			<div style="margin:0 0 6px 0;"><strong><?php echo esc_html( $label ); ?></strong></div>
			<select class="<?php echo esc_attr( $css_class ); ?>"
			        <?php echo $attr_str; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
				<?php foreach ( $options as $opt_value => $opt_label ) : ?>
					<option value="<?php echo esc_attr( (string) $opt_value ); ?>" <?php selected( (string) $opt_value, $v ); ?>>
						<?php echo esc_html( (string) $opt_label ); ?>
					</option>
				<?php endforeach; ?>
			</select>
		</label>
		<?php
	}

	private static function print_radio( $id, $key, $scope, $label, $value, $options, $radio_layout ) {

		$v = is_scalar( $value ) ? (string) $value : '';

		$wrapper_style = ( 'inline' === $radio_layout )
			? 'display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:0;'
			: 'margin:0;';
		$item_style = ( 'inline' === $radio_layout )
			? ''
			: 'display:flex;align-items:center;gap:8px;margin:4px 0;';

		// Put fs data on wrapper (JS reads control id from wrapper).
		$wrap_attr = array(
			'data-wpbc-bfb-fs-key'       => $key,
			'data-wpbc-bfb-fs-scope'     => $scope,
			'data-wpbc-bfb-fs-type'      => 'radio',
			'data-wpbc-bfb-fs-initial'   => $v,
			'data-wpbc-bfb-fs-controlid' => $id,
		);
		$wrap_attr_str = self::build_attr_string( $wrap_attr );
		?>
		<div class="wpbc_bfb__form_setting_radio"
		     <?php echo $wrap_attr_str; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
			<div style="margin:0 0 6px 0;"><strong><?php echo esc_html( $label ); ?></strong></div>

			<div style="<?php echo esc_attr( $wrapper_style ); ?>">
				<?php
				$i = 0;
				foreach ( $options as $opt_value => $opt_label ) :
					$i++;
					$rid = $id . '__' . $i;
					?>
					<label style="<?php echo esc_attr( $item_style ); ?>">
						<input type="radio"
						       name="<?php echo esc_attr( $id ); ?>"
						       id="<?php echo esc_attr( $rid ); ?>"
						       value="<?php echo esc_attr( (string) $opt_value ); ?>"
						       data-wpbc-bfb-fs-radio="1"
							<?php checked( (string) $opt_value, $v ); ?>
						/>
						<?php echo esc_html( (string) $opt_label ); ?>
					</label>
				<?php endforeach; ?>
			</div>
		</div>
		<?php
	}

	/**
	 * Print slider number control (range + number).
	 *
	 * IMPORTANT:
	 * - Uses only NEW wpbc_slider_* attributes (no back-compat).
	 * - Number input is the "writer" and carries FS markers + id (Save UI reads #id).
	 *
	 * Markup:
	 * <label for="ID" class="inspector__label">...</label>
	 * <div class="inspector__control">
	 *   <div class="wpbc_slider_range_group wpbc_inline_inputs">
	 *     <input type="range"  data-wpbc_slider_range_range ...>
	 *     <input type="number" data-wpbc_slider_range_value data-wpbc_slider_range_writer id="ID" ...>
	 *   </div>
	 * </div>
	 */
	private static function print_range( $id, $key, $scope, $label, $value, $range, $attr, $css_class ) {

		$min  = isset( $range['min'] ) ? (float) $range['min'] : 0;
		$max  = isset( $range['max'] ) ? (float) $range['max'] : 100;
		$step = isset( $range['step'] ) ? (float) $range['step'] : 1;

		$v = is_scalar( $value ) ? (string) $value : '';
		if ( '' === trim( $v ) ) {
			$v = (string) $min;
		}

		// Clamp numeric value.
		if ( is_numeric( $v ) ) {
			$n = (float) $v;
			if ( $n < $min ) { $n = $min; }
			if ( $n > $max ) { $n = $max; }
			// Keep formatting simple.
			$v = (string) $n;
		}

		// Number input = writer (id stays here, Save UI reads #id).
		// Keep FS type as "input" for compatibility with existing apply/collect code.
		$num_attr = self::with_common_fs_data( $attr, $key, $scope, 'input', $v );
		$num_attr['data-wpbc-bfb-fs-type']          = 'input';
		$num_attr['data-wpbc_slider_range_value']   = '1';
		$num_attr['data-wpbc_slider_range_writer']  = '1';

		// Ensure the number input keeps the $id.
		$num_attr['id'] = $id;

		$num_attr_str = self::build_attr_string( $num_attr );

		// Number input CSS (adds width helper).
		$num_class = trim( $css_class . ' inspector__w_30' );
		?>
		<label for="<?php echo esc_attr( $id ); ?>" class="inspector__label"><strong><?php echo esc_html( $label ); ?></strong></label>

		<div class="inspector__control">
			<div class="wpbc_slider_range_group wpbc_inline_inputs">
				<input type="range"
				       class="inspector__input"
				       data-wpbc_slider_range_range="1"
				       min="<?php echo esc_attr( (string) $min ); ?>"
				       max="<?php echo esc_attr( (string) $max ); ?>"
				       step="<?php echo esc_attr( (string) $step ); ?>"
				       value="<?php echo esc_attr( $v ); ?>"
				/>

				<input type="number"
				       class="<?php echo esc_attr( $num_class ); ?>"
				       autocomplete="off"
				       min="<?php echo esc_attr( (string) $min ); ?>"
				       max="<?php echo esc_attr( (string) $max ); ?>"
				       step="<?php echo esc_attr( (string) $step ); ?>"
				       value="<?php echo esc_attr( $v ); ?>"
					<?php
					echo $num_attr_str; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					?>
				/>
			</div>
		</div>
		<?php
	}

	private static function print_length( $id, $key, $scope, $label, $value, $length ) {

		$units        = ( isset( $length['units'] ) && is_array( $length['units'] ) ) ? $length['units'] : array( '%' => '%' );
		$default_unit = isset( $length['default_unit'] ) ? (string) $length['default_unit'] : '%';
		$bounds_map   = ( isset( $length['bounds_map'] ) && is_array( $length['bounds_map'] ) ) ? $length['bounds_map'] : array();

		$raw = is_scalar( $value ) ? trim( (string) $value ) : '';

		$num  = '';
		$unit = '';

		if ( preg_match( '/^\s*([\-]?\d+(?:\.\d+)?)\s*([a-z%]*)\s*$/i', $raw, $m ) ) {
			$num  = isset( $m[1] ) ? (string) $m[1] : '';
			$unit = isset( $m[2] ) ? (string) $m[2] : '';
		}

		if ( '' === $unit ) {
			$unit = $default_unit;
		}
		if ( '' === $num && '' !== $raw ) {
			$num = $raw;
		}

		// Ensure unit exists in list.
		if ( ! isset( $units[ $unit ] ) ) {
			$unit = $default_unit;
		}

		// Bounds for current unit.
		$bounds = array();
		if ( isset( $bounds_map[ $unit ] ) && is_array( $bounds_map[ $unit ] ) ) {
			$bounds = $bounds_map[ $unit ];
		} elseif ( isset( $bounds_map[ $default_unit ] ) && is_array( $bounds_map[ $default_unit ] ) ) {
			$bounds = $bounds_map[ $default_unit ];
		}

		$min  = isset( $bounds['min'] ) ? (float) $bounds['min'] : 0;
		$max  = isset( $bounds['max'] ) ? (float) $bounds['max'] : 128;
		$step = isset( $bounds['step'] ) ? (float) $bounds['step'] : 1;

		// Clamp numeric value to bounds when it is numeric.
		if ( '' !== $num && is_numeric( $num ) ) {
			$n = (float) $num;
			if ( $n < $min ) {
				$n = $min;
			}
			if ( $n > $max ) {
				$n = $max;
			}
			$num = (string) $n;
		}

		$combined = ( '' === $num ) ? '' : ( $num . $unit );

		// Writer input (main value) must have the FS markers + special type="length".
		// Add the new strict writer marker for wpbc_slider_len_groups.js
		$writer_attr                          = self::with_common_fs_data( array( 'id' => $id ), $key, $scope, 'length', $combined );
		$writer_attr['data-wpbc-bfb-fs-type'] = 'length';
		$writer_attr['data-wpbc_slider_len_writer'] = '1';

		$writer_attr_str = self::build_attr_string( $writer_attr );

		// Bounds JSON for JS.
		$bounds_json = ( ! empty( $bounds_map ) ) ? wp_json_encode( $bounds_map ) : '';

		?>
		<label class="inspector__label"><strong><?php echo esc_html( $label ); ?></strong></label>

		<div class="inspector__control">
			<div class="wpbc_slider_len_group inspector__w_100"
				 data-wpbc_slider_len_default_unit="<?php echo esc_attr( $default_unit ); ?>"
				<?php if ( '' !== $bounds_json ) : ?>
					data-wpbc_slider_len_bounds_map="<?php echo esc_attr( $bounds_json ); ?>"
				<?php endif; ?>
			>
				<div class="wpbc_inline_inputs">
					<input type="number"
						   class="inspector__input"
						   data-wpbc_slider_len_value
						   autocomplete="off"
						   min="<?php echo esc_attr( (string) $min ); ?>"
						   max="<?php echo esc_attr( (string) $max ); ?>"
						   step="<?php echo esc_attr( (string) $step ); ?>"
						   value="<?php echo esc_attr( $num ); ?>"
					/>
					<select class="inspector__input" data-wpbc_slider_len_unit>
						<?php foreach ( $units as $u_value => $u_label ) : ?>
							<option value="<?php echo esc_attr( (string) $u_value ); ?>" <?php selected( (string) $u_value, (string) $unit ); ?>>
								<?php echo esc_html( (string) $u_label ); ?>
							</option>
						<?php endforeach; ?>
					</select>
				</div>

				<input type="range"
					   class="inspector__input"
					   data-wpbc_slider_len_range
					   min="<?php echo esc_attr( (string) $min ); ?>"
					   max="<?php echo esc_attr( (string) $max ); ?>"
					   step="<?php echo esc_attr( (string) $step ); ?>"
					   value="<?php echo esc_attr( ( '' === $num ) ? (string) $min : $num ); ?>"
				/>

				<input type="text"
					   class="inspector__input"
					   style="display:none;"
					   value="<?php echo esc_attr( $combined ); ?>"
					<?php
					echo $writer_attr_str; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					?>
				/>
			</div>
		</div>
		<?php
	}

	private static function print_input( $id, $key, $scope, $label, $value, $attr, $css_class, $input_type, $input_attrs ) {

		$v = is_scalar( $value ) ? (string) $value : '';

		$control_attr = self::with_common_fs_data( $attr, $key, $scope, 'input', $v );
		$control_attr['data-wpbc-bfb-fs-type'] = 'input';

		$attr_str      = self::build_attr_string( $control_attr );
		$extra_attr_str = self::build_attr_string( $input_attrs );
		?>
		<label style="display:block;">
			<div style="margin:0 0 6px 0;"><strong><?php echo esc_html( $label ); ?></strong></div>
			<input type="<?php echo esc_attr( $input_type ); ?>"
			       class="<?php echo esc_attr( $css_class ); ?>"
			       value="<?php echo esc_attr( $v ); ?>"
			       <?php echo $attr_str; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
			       <?php echo $extra_attr_str; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
			/>
		</label>
		<?php
	}

	private static function print_textarea( $id, $key, $scope, $label, $value, $attr, $css_class, $input_attrs ) {

		$v = is_scalar( $value ) ? (string) $value : '';

		$control_attr = self::with_common_fs_data( $attr, $key, $scope, 'textarea', $v );
		$control_attr['data-wpbc-bfb-fs-type'] = 'textarea';

		$attr_str       = self::build_attr_string( $control_attr );
		$extra_attr_str = self::build_attr_string( $input_attrs );
		?>
		<label style="display:block;">
			<div style="margin:0 0 6px 0;"><strong><?php echo esc_html( $label ); ?></strong></div>
			<textarea class="<?php echo esc_attr( $css_class ); ?>"
			          <?php echo $attr_str; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
			          <?php echo $extra_attr_str; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
			><?php echo esc_textarea( $v ); ?></textarea>
		</label>
		<?php
	}

	// =================================================================================================
	// Save UI
	// =================================================================================================

	/**
	 * Print per-row Save UI (global only) using the STABLE wpbc_save_option_from_element() contract.
	 *
	 * @param array  $args
	 * @param string $id
	 * @param string $key
	 * @param string $type
	 * @param string $save_ui
	 */
	private static function print_save_ui( $args, $id, $key, $type, $save_ui ) {

		$save_ui = ( 'always' === $save_ui ) ? 'always' : 'when_changed';

		// Selector used by stable saver to read current value on click.
		if ( 'radio' === $type ) {
			$value_from = 'input[name="' . $id . '"]:checked';
		} else {
			$value_from = '#' . $id;
		}

		// Stable saver requires nonce + action.
		$opt_name     = $key; // option name == key
		$nonce_action = 'wpbc_nonce_' . $opt_name;
		$nonce_value  = wp_create_nonce( $nonce_action );

		$wrap_class = 'wpbc_bfb__form_setting_save';
		$btn_class  = 'button button-primary wpbc_bfb__form_setting_save_btn';

		if ( 'when_changed' === $save_ui ) {
			$wrap_class .= ' is-hidden';
		}
		?>
		<div class="<?php echo esc_attr( $wrap_class ); ?>">
			<button type="button"
					class="<?php echo esc_attr( $btn_class ); ?>"

					data-wpbc-u-save="1"
					data-wpbc-u-save-name="<?php echo esc_attr( $opt_name ); ?>"
					data-wpbc-u-save-nonce="<?php echo esc_attr( $nonce_value ); ?>"
					data-wpbc-u-save-action="<?php echo esc_attr( $nonce_action ); ?>"
					data-wpbc-u-busy-text="<?php echo esc_attr__( 'Saving…', 'booking' ); ?>"

					data-wpbc-u-save-ui="<?php echo esc_attr( $save_ui ); ?>"
					data-wpbc-u-save-scope="global"
					data-wpbc-u-save-value-from="<?php echo esc_attr( $value_from ); ?>"
			><?php echo esc_html__( 'Save', 'booking' ); ?></button>
		</div>
		<?php
	}


	// =================================================================================================
	// Helpers
	// =================================================================================================

	private static function is_on( $value ) {
		$v = strtolower( trim( (string) ( ( null === $value ) ? '' : $value ) ) );
		return ( 'on' === $v || '1' === $v || 'true' === $v || 'yes' === $v );
	}

	/**
	 * Add common fs-* markers for JS apply/collect bridge.
	 *
	 * @param array  $attr
	 * @param string $key
	 * @param string $scope
	 * @param string $type
	 * @param string $initial
	 *
	 * @return array
	 */
	private static function with_common_fs_data( $attr, $key, $scope, $type, $initial ) {

		if ( ! is_array( $attr ) ) {
			$attr = array();
		}

		$attr['data-wpbc-bfb-fs-key']     = $key;
		$attr['data-wpbc-bfb-fs-scope']   = $scope;
		$attr['data-wpbc-bfb-fs-type']    = $type;
		$attr['data-wpbc-bfb-fs-initial'] = (string) $initial;

		return $attr;
	}

	/**
	 * Build safe HTML attributes string.
	 *
	 * - blocks inline handlers (on*)
	 *
	 * @param array $attrs
	 *
	 * @return string
	 */
	private static function build_attr_string( $attrs ) {

		$out = '';
		if ( empty( $attrs ) || ! is_array( $attrs ) ) {
			return $out;
		}

		foreach ( $attrs as $k => $v ) {

			if ( ! is_scalar( $k ) || '' === trim( (string) $k ) ) {
				continue;
			}

			$attr_key = strtolower( trim( (string) $k ) );

			// Block inline handlers.
			if ( 0 === strpos( $attr_key, 'on' ) ) {
				continue;
			}

			if ( null === $v ) {
				continue;
			}

			$out .= ' ' . esc_attr( $attr_key ) . '="' . esc_attr( (string) $v ) . '"';
		}

		return $out;
	}
}
