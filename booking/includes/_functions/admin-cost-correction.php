<?php
/**
 * Shared administrator cost-correction control.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Render an optional exact-total control for an authorized administrator workflow.
 *
 * The control deliberately renders only when the Business Small cost engine is
 * available. It does not submit itself because both supported inspectors live
 * outside the native Booking Form. Their page adapters copy a non-empty value
 * into the dedicated booking-create request parameter, which is authorized and
 * validated again by the shared server save boundary.
 *
 * @param array $args {
 *     Control presentation arguments supplied by trusted plugin code.
 *
 *     @type string $input_id      Unique HTML input ID.
 *     @type int    $resource_id   Optional Booking resource used for its currency symbol.
 *     @type string $wrapper_class Wrapper CSS classes.
 *     @type string $label_class   Label CSS classes.
 *     @type string $control_class Control-container CSS classes.
 *     @type string $input_class   Number-input CSS classes.
 *     @type string $help_class    Help-paragraph CSS classes.
 *     @type string $label         Translated field label.
 *     @type string $placeholder   Translated empty-value placeholder.
 *     @type string $suffix        Translated suffix displayed after the number.
 *     @type string $help          Translated workflow explanation.
 * }
 *
 * @return void
 */
function wpbc_render_admin_cost_correction_control( $args = array() ) {

	if ( ! class_exists( 'wpdev_bk_biz_s' ) ) {
		return;
	}

	$args = wp_parse_args(
		$args,
		array(
			'input_id'      => 'wpbc_admin_cost_correction',
			'resource_id'   => 0,
			'wrapper_class' => '',
			'label_class'   => '',
			'control_class' => '',
			'input_class'   => 'inspector__input',
			'help_class'    => 'description',
			'label'         => __( 'Cost correction', 'booking' ),
			'placeholder'   => __( 'Calculated cost', 'booking' ),
			'suffix'        => __( 'total', 'booking' ),
			'help'          => __( 'Leave the number empty to use the calculated cost. Enter an exact total to replace the final cost.', 'booking' ),
		)
	);

	$input_id        = sanitize_key( $args['input_id'] );
	$resource_id     = absint( $args['resource_id'] );
	$currency_symbol = $resource_id > 0 && function_exists( 'wpbc_get_currency_symbol_for_user' )
		? wpbc_get_currency_symbol_for_user( $resource_id )
		: ( function_exists( 'wpbc_get_currency_symbol' ) ? wpbc_get_currency_symbol() : '' );
	$currency_symbol = html_entity_decode( wp_strip_all_tags( (string) $currency_symbol ), ENT_QUOTES, get_bloginfo( 'charset' ) );
	?>
	<div class="wpbc_admin_cost_correction <?php echo esc_attr( $args['wrapper_class'] ); ?>" data-wpbc-admin-cost-correction="1">
		<label for="<?php echo esc_attr( $input_id ); ?>" class="<?php echo esc_attr( $args['label_class'] ); ?>"><?php echo esc_html( $args['label'] ); ?></label>
		<div class="<?php echo esc_attr( $args['control_class'] ); ?>">
			<div class="wpbc_admin_cost_correction__number_control">
				<div class="wpbc_admin_cost_correction__number_input_row">
					<?php if ( '' !== $currency_symbol ) : ?>
						<span class="wpbc_admin_cost_correction__number_prefix"><?php echo esc_html( $currency_symbol ); ?></span>
					<?php endif; ?>
					<input id="<?php echo esc_attr( $input_id ); ?>"
						type="number"
						class="<?php echo esc_attr( $args['input_class'] ); ?>"
						value=""
						min="0"
						max="1000000000"
						step="0.01"
						inputmode="decimal"
						placeholder="<?php echo esc_attr( $args['placeholder'] ); ?>"
						data-wpbc-admin-cost-correction-value="1" />
					<span class="wpbc_admin_cost_correction__number_suffix"><?php echo esc_html( $args['suffix'] ); ?></span>
				</div>
				<input type="range"
					class="wpbc_admin_cost_correction__number_slider"
					min="0"
					max="1000"
					step="1"
					value="0"
					aria-label="<?php echo esc_attr( $args['label'] ); ?>"
					data-wpbc-admin-cost-correction-range="1" />
			</div>
			<p class="<?php echo esc_attr( $args['help_class'] ); ?>"><?php echo esc_html( $args['help'] ); ?></p>
		</div>
	</div>
	<?php
}
