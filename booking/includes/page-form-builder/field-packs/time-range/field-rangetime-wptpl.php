<?php
/**
 * WPBC BFB Pack: Range Time (time-slots).
 *
 * - Adds a "rangetime" field that renders dropdown options like: [selectbox rangetime "Label@@HH:MM - HH:MM" ...]
 * - Labels can be AM/PM or 24h; values are always strict 24h ranges.
 * - Inspector:
 *      - AM/PM </> 24H switch (radio)
 *      - Generator: Start/End + Duration: AM/PM uses native <input type="time">, 24H uses iMask.js
 *      - Options editor with rows that mirror the chosen format
 * - Requires iMask.js (already loaded on the Builder page).
 *
 * @package   Booking Calendar
 * @author    wpdevelop
 * @since     11.0.0
 * @modified  31.10.2025 13:54
 * @version   1.7.1
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the "rangetime" field pack.
 *
 * @param array $packs Packs map.
 *
 * @return array
 */
/**
 * Register the "rangetime" field pack.
 *
 * @param array $packs Packs map.
 * @return array
 */
function wpbc_bfb_register_field_packs__field_rangetime_wptpl( $packs ) {
	$packs['rangetime'] = array(
		'kind'      => 'field',
		'type'      => 'rangetime',
		'label'     => __( 'Time slots', 'booking' ),
		'icon'      => 'wpbc-bi-clock',
		'usage_key' => 'rangetime',

		// Schema defines defaults and coercion.
		'schema'    => array(
			'props' => array(
				'label'            => array( 'type' => 'string',  'default' => __( 'Time', 'booking' ) ),
				'name'             => array( 'type' => 'string',  'default' => 'rangetime' ),
				'html_id'          => array( 'type' => 'string',  'default' => '' ),
				'required'         => array( 'type' => 'boolean', 'default' => true ),
				'multiple'         => array( 'type' => 'boolean', 'default' => false ),
				'size'             => array( 'type' => 'number',  'default' => null, 'min' => 2, 'max' => 20 ),
				'cssclass'         => array( 'type' => 'string',  'default' => '' ),
				'help'             => array( 'type' => 'string',  'default' => '' ),
				'default_value'    => array( 'type' => 'string',  'default' => '' ),
				'placeholder'      => array( 'type' => 'string',  'default' => '--- ' . __( 'Select time', 'booking' ) . ' ---' ),
				'value_differs'    => array( 'type' => 'boolean', 'default' => true ),

				// Options: label (string), value (string "HH:MM - HH:MM"), selected (bool).
				'options'          => array(
					'type'    => 'array',
					'default' => array(
						array( 'label' => '10:00 AM - 12:00 PM', 'value' => '10:00 - 12:00', 'selected' => false ),
						array( 'label' => '12:00 PM - 02:00 PM', 'value' => '12:00 - 14:00', 'selected' => false ),
						array( 'label' => '02:00 PM - 04:00 PM', 'value' => '14:00 - 16:00', 'selected' => false ),
						array( 'label' => '04:00 PM - 06:00 PM', 'value' => '16:00 - 18:00', 'selected' => false ),
						array( 'label' => '06:00 PM - 08:00 PM', 'value' => '18:00 - 20:00', 'selected' => false ),
					),
				),

				// Generator controls:.
				'gen_label_fmt'    => array( 'type' => 'string', 'default' => 'ampm' ), // 'ampm' | '24h'
				'gen_start_24h'    => array( 'type' => 'string', 'default' => '09:00' ),
				'gen_end_24h'      => array( 'type' => 'string', 'default' => '18:00' ),
				'gen_start_ampm_t' => array( 'type' => 'string', 'default' => '09:00' ),
				// <input type=time> expects "HH:MM"
				'gen_end_ampm_t'   => array( 'type' => 'string', 'default' => '18:00' ),
				'gen_step_h'       => array( 'type' => 'number', 'default' => 0,  'min' => 0,  'max' => 12 ),
				'gen_step_m'       => array( 'type' => 'number', 'default' => 30, 'min' => 0,  'max' => 59 ),

				'min_width'        => array( 'type' => 'string', 'default' => '240px' ),
			),
		),

		'templates_printer' => 'wpbc_bfb_field_rangetime_wptpl_print_templates',
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_rangetime_wptpl' );


/**
 * Enqueue the Range Time pack JS.
 *
 * @param string $page Current admin page slug.
 * @return void
 */
function wpbc_bfb_enqueue__field_rangetime_wptpl_js( $page ) {

	// iMask.js is already enqueued on this page.
	wp_enqueue_script( 'wpbc-bfb_field_rangetime_wptpl', wpbc_plugin_url( '/includes/page-form-builder/field-packs/time-range/_out/field-rangetime-wptpl.js' ), array( 'wp-util', 'wpbc-bfb', 'wpbc-bfb-time-utils' ), WP_BK_VERSION_NUM, true );
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_rangetime_wptpl_js', 10, 1 );


/**
 * Palette item (optional).
 *
 * @param string $group    Group key.
 * @param string $position Position.
 * @return void
 */
function wpbc_bfb_palette_register_items__rangetime_wptpl( $group, $position ) {
	if ( 'times' !== $group || 'bottom' !== $position ) {
		return;
	}
	$default_options = array(
		array( 'label' => '10:00 AM - 12:00 PM', 'value' => '10:00 - 12:00', 'selected' => false ),
		array( 'label' => '12:00 PM - 02:00 PM', 'value' => '12:00 - 14:00', 'selected' => false ),
		array( 'label' => '02:00 PM - 04:00 PM', 'value' => '14:00 - 16:00', 'selected' => false ),
		array( 'label' => '04:00 PM - 06:00 PM', 'value' => '16:00 - 18:00', 'selected' => false ),
		array( 'label' => '06:00 PM - 08:00 PM', 'value' => '18:00 - 20:00', 'selected' => false ),
	);
	?>
	<li class="wpbc_bfb__field"
		data-id="rangetime"
		data-type="rangetime"
		data-usage_key="rangetime"
		data-usagenumber="1"
		data-min_width="240px"
		data-label="<?php echo esc_attr( __( 'Time slots', 'booking' ) ); ?>"
		data-name="rangetime"
		data-required="true"
		data-autoname="0"
		data-fresh="0"
		data-name_user_touched="1"
		data-options="<?php echo esc_attr( wp_json_encode( $default_options ) ); ?>">
		<i class="menu_icon icon-1x wpbc_icn_access_time"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html( __( 'Time slots', 'booking' ) ); ?></span>
		<span class="wpbc_bfb__field-type">rangetime</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__rangetime_wptpl', 10, 2 );



/**
 * Print wp.template() blocks (Preview + Inspector).
 *
 * @param string $page Builder page slug.
 * @return void
 */
function wpbc_bfb_field_rangetime_wptpl_print_templates( $page ) {

	if ( WPBC_BFB_BUILDER_PAGE_SLUG !== $page ) {
		return;
	}

	?>
	<script type="text/html" id="tmpl-wpbc-bfb-field-rangetime">
		<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="" style="min-width: {{ data.min_width || '240px' }}">
			<# var is_req = ( true === data.required || 'true' === data.required || 1 === data.required || '1' === data.required ); #>
			<# var is_mul = ( true === data.multiple || 'true' === data.multiple || 1 === data.multiple || '1' === data.multiple ); #>

			<# if ( data.label && data.label !== '' ) { #>
				<label class="wpbc_bfb__field-label" <# if ( data.html_id ) { #> for="{{ data.html_id }}" <# } #>>
					{{ data.label }} <# if ( is_req ) { #><span aria-hidden="true">*</span><# } #>
				</label>
			<# } #>

			<span class="wpbc_wrap_text wpdev-form-control-wrap">
				<select
					class="wpbc_bfb__preview-input wpbc_bfb__preview-select wpbc_bfb__preview-rangetime wpbc_bfb__preview-timepicker {{ data.cssclass || '' }}"
					name="{{ (data.name || data.id || 'rangetime') + ( is_mul ? '[]' : '' ) }}"
					tabindex="-1" aria-disabled="true"
					<# if ( data.html_id ) { #> id="{{ data.html_id }}" <# } #>
					<# if ( is_req ) { #> required aria-required="true" <# } #>
					<# if ( is_mul ) { #> multiple <# } #>
					<# if ( is_mul && data.size && isFinite( Number( data.size ) ) ) { #> size="{{ Number( data.size ) }}" <# } #>
				>
					<#
						var has_marked = Array.isArray( data.options ) && data.options.some( function(o){
							return !! o && ( true === o.selected || 'true' === o.selected || 1 === o.selected || '1' === o.selected );
						} );
						var has_text_default = ( ! is_mul ) && ( (data.default_value != null) && String( data.default_value ).trim() !== '' );
						var has_any_default = has_marked || has_text_default;

						var selected_set = {};
						if ( has_marked ) {
							( data.options || [] ).forEach( function(o){
								if ( o && ( true === o.selected || 'true' === o.selected || 1 === o.selected || '1' === o.selected ) ) {
									selected_set[ String( o.value || '' ) ] = true;
								}
							} );
						} else if ( is_mul ) {
							String( data.default_value || '' ).split( /\s*,\s*/ ).filter( function(s){ return s.length; } )
								.forEach( function(v){ selected_set[ v ] = true; } );
						} else if ( has_text_default ) {
							selected_set[ String( data.default_value ) ] = true;
						}
					#>

					<# if ( ! is_mul && data.placeholder && ! has_any_default ) { #>
						<option value="" selected="selected" disabled="disabled">{{ data.placeholder }}</option>
					<# } #>

					<#
						var _opts = Array.isArray( data.options ) ? data.options
							: ( function(o){ var a=[],k; for ( k in (o||{}) ){ if ( Object.prototype.hasOwnProperty.call(o,k) ){ a.push( o[k] ); } } return a; } )( data.options );
						_opts.forEach( function( opt ){
							if ( ! opt ) { return; }
							var _val = String( opt.value || '' );
							var _lbl = String( opt.label || '' );
							var _sel = !! selected_set[ _val ];
					#>
						<option value="{{ _val }}" <# if ( _sel ) { #> selected <# } #> >{{ _lbl }}</option>
					<# }); #>
				</select>
			</span>

			<# if ( data.help ) { #>
				<div class="wpbc_bfb__help">{{ data.help }}</div>
			<# } #>
		</span>
	</script>

	<script type="text/html" id="tmpl-wpbc-bfb-inspector-rangetime">
		<style type="text/css">
			.wpbc_admin .wpbc_ui_el__vert_right_bar__wrapper:has(.wpbc_bfb__inspector_timepicker) {
				--wpbc_ui_left_vert_nav__width_max: Min(580px, 100%);
			}
		</style>
		<div class="wpbc_bfb__inspector_rangetime wpbc_bfb__inspector_timepicker" data-type="rangetime"
			data-i18n-add="<?php echo esc_attr__( 'Add New', 'booking' ); ?>"
			data-i18n-duplicate="<?php echo esc_attr__( 'Duplicate', 'booking' ); ?>"
			data-i18n-remove="<?php echo esc_attr__( 'Remove', 'booking' ); ?>"
			data-i18n-default="<?php echo esc_attr__( 'Default', 'booking' ); ?>"
			data-i18n-reorder="<?php echo esc_attr__( 'Drag to reorder', 'booking' ); ?>"
			data-i18n-rowlabel="<?php echo esc_attr__( 'Label (e.g. 10:00 AM - 10:30 AM)', 'booking' ); ?>"
		>
			<div class="wpbc_bfb__inspector__head">
				<div class="header_container">
					<div class="header_title_content">
						<h3 class="title"><?php echo esc_html__( 'Time slots', 'booking' ); ?></h3>
						<div class="desc"><?php echo esc_html__( 'Use the "Generate time slots" form to quickly create a list of time slots.', 'booking' ); ?></div>
					</div>
					<div class="actions wpbc_ajx_toolbar wpbc_no_borders">
						<div class="ui_container ui_container_small">
							<div class="ui_group">
								<div class="ui_element">
									<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button" data-action="deselect" aria-label="<?php echo esc_attr__( 'Deselect', 'booking' ); ?>">
										<i class="menu_icon icon-1x wpbc_icn_remove_done"></i>
									</button>
									<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button" data-action="scrollto" aria-label="<?php echo esc_attr__( 'Scroll to field', 'booking' ); ?>">
										<i class="menu_icon icon-1x wpbc_icn_ads_click filter_center_focus"></i>
									</button>
								</div>
								<div class="ui_element">
									<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button" data-action="move-up" aria-label="<?php echo esc_attr__( 'Move up', 'booking' ); ?>">
										<i class="menu_icon icon-1x wpbc_icn_arrow_upward"></i>
									</button>
									<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button" data-action="move-down" aria-label="<?php echo esc_attr__( 'Move down', 'booking' ); ?>">
										<i class="menu_icon icon-1x wpbc_icn_arrow_downward"></i>
									</button>
								</div>
								<div class="ui_element">
									<?php /* ?>
									<button data-action="duplicate" aria-label="<?php echo esc_attr__( 'Duplicate', 'booking' ); ?>" type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button">
										<i class="menu_icon icon-1x wpbc_icn_content_copy"></i>
									</button>
 									<?php */ ?>
									<button data-action="delete" aria-label="<?php echo esc_attr__( 'Delete', 'booking' ); ?>" type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button wpbc_ui_button_danger button-link-delete">
										<span class="in-button-text"><?php echo esc_html__( 'Delete', 'booking' ); ?></span>&nbsp;&nbsp;<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i>
									</button>
								</div>
							</div><!-- .ui_group -->
						</div><!-- .ui_container -->
					</div><!-- .actions -->

					<div class="wpbc_ui__collapsible_group" style="width: 99%;">
						<div class="inspector__row row__bordered" style="background:#f8f8f8;border:0;justify-content: space-between;">
							<label class="inspector__label"><?php echo esc_html__( 'Show as time picker', 'booking' ); ?></label>
							<div class="inspector__control" style="flex: 0 1 auto;">
								<input type="checkbox" class="inspector__checkbox js-toggle-timeslot-picker">
								<p class="wpbc_bfb__help" style="margin-top:6px;">
									<?php echo esc_html__( 'Toggle between selectbox and clickable time slots.', 'booking' ); ?>
								</p>
							</div>
							<?php
							$opt_name     = 'booking_timeslot_picker';
							$nonce_action = 'wpbc_nonce_' . $opt_name;
							?>
							<a  href="javascript:void(0);"
								class="button button-secondary"
								onclick="(function(btn){var $=jQuery, $panel=$(btn).closest('.wpbc_bfb__inspector_timepicker'), $chk=$panel.find('.js-toggle-timeslot-picker').first(); btn.setAttribute('data-wpbc-u-save-value', $chk.is(':checked')?'On':'Off'); wpbc_save_option_from_element(btn); })(this)"
								data-wpbc-u-save-name="<?php echo esc_attr( $opt_name ); ?>"
								data-wpbc-u-save-nonce="<?php echo esc_attr( wp_create_nonce( $nonce_action ) ); ?>"
								data-wpbc-u-save-action="<?php echo esc_attr( $nonce_action ); ?>"
								data-wpbc-u-busy-text="<?php esc_attr_e( 'Saving', 'booking' ); ?>...">
								<?php esc_html_e( 'Save Toggle', 'booking' ); ?>
							</a>

						</div>
					</div>

				</div><!-- .header_container -->
			</div><!-- .wpbc_bfb__inspector__head -->

			<div class="wpbc_bfb__inspector__body">

				<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="basic">
					<button type="button" class="group__header">
						<h3><?php echo esc_html__( 'Basic', 'booking' ); ?></h3>
						<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
					</button>
					<div class="group__fields">
						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Label', 'booking' ); ?></label>
							<div class="inspector__control">
								<input type="text" class="inspector__input" data-inspector-key="label" value="{{ data.label || '<?php echo esc_js( __( 'Time', 'booking' ) ); ?>' }}">
							</div>
						</div>

						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Name', 'booking' ); ?></label>
							<div class="inspector__control">
								<?php
								// Visible (disabled) field so users see it's fixed.
								?>
								<input type="text"
									   class="inspector__input"
									   value="{{ (data.name && data.name !== '' ? data.name : 'rangetime') }}"
									   disabled="disabled"
									   aria-disabled="true">

								<?php
								// Hidden proxy that the Builder actually saves.
								// Keep data-inspector-key on a non-disabled control.
								?>
								<input type="hidden"
									   class="inspector__input js-locked-name"
									   data-inspector-key="name"
									   data-locked="1"
									   value="{{ (data.name && data.name !== '' ? data.name : 'rangetime') }}">

								<p class="wpbc_bfb__help" style="margin-top:6px;">
									<?php echo esc_html__( 'This field name is fixed for compatibility.', 'booking' ); ?>
								</p>
							</div>
						</div>

						<?php /* ?>
						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Required', 'booking' ); ?></label>
							<div class="inspector__control">
								<input type="checkbox" class="inspector__checkbox" data-inspector-key="required" <# if ( true === data.required || 'true' === data.required || 1 === data.required || '1' === data.required ) { #> checked <# } #> >
							</div>
						</div>
						<?php */ ?>

						<div class="inspector__row">
							<div class="inspector__control ">
								<span class="wpbc_ui__toggle">
									<!-- Visible indicator: checked + disabled (tell normalizer to skip) -->
									<# var input_id = window.WPBC_BFB_Core.UI.WPBC_BFB_Toggle_Normalizer.generate_unique_id( 'wpbc_ins_auto_' + 'toggle_required' + '_' ); #>
									<input type="checkbox" id="{{input_id}}" class="inspector__checkbox js-required-visible" checked disabled aria-disabled="true" data-wpbc-ui-no-toggle="1">
									<label class="wpbc_ui__toggle_icon"  	 for="{{input_id}}"></label>
									<label class="wpbc_ui__toggle_label" 	 for="{{input_id}}"><?php echo esc_html__( 'Required', 'booking' ); ?></label>
								</span>
								<!-- PROXY for data binding (already skipped via flags) -->
								<input type="checkbox" class="inspector__checkbox js-required-proxy" data-inspector-key="required" data-locked="1" checked data-wpbc-ui-no-toggle="1"
									   style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;">
								<p class="wpbc_bfb__help" style="margin-inline-start:1em;display: inline-block;"><?php echo esc_html__( 'This field is always required.', 'booking' ); ?></p>
							</div>
						</div>

						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Help text', 'booking' ); ?></label>
							<div class="inspector__control">
								<textarea class="inspector__textarea" rows="3" data-inspector-key="help">{{ data.help || '' }}</textarea>
							</div>
						</div>
					</div>
				</section>

				<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group is-open" data-group="options">
					<button type="button" class="group__header">
						<h3><?php echo esc_html__( 'Time slots', 'booking' ); ?></h3>
						<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
					</button>

					<div class="group__fields inspector__group__fields__times">

						<?php /* ===== Generator ===== */ ?>
						<div class="inspector__row">
							<div class="inspector__control inspector__control__generator_timeslots">

								<# var __fmt_name = 'rt_label_fmt_' + ( data.html_id ? data.html_id : ( 'id_' + String( Math.random() ).slice(2) ) ); #>
								<h2><?php echo esc_html__( 'Generate time slots', 'booking' ); ?></h2>
								<div class="wpbc_bfb__rt_gen_format wpbc_inline_inputs" role="radiogroup" aria-label="<?php echo esc_attr__( 'Time format', 'booking' ); ?>">
									<label class="inspector__label inspector__w_30"><?php echo esc_html__( 'Time format', 'booking' ); ?>:</label>
									<div class="wpbc_inline_inputs inspector__w_70">
										<?php /*
										 * PROXY input (single source-of-truth) so the core inspector serializer sees exactly one element
										 * with this key. Radios below are UI only and update this hidden value.
										 */ ?>
										<input type="hidden"
											   class="inspector__input js-rt-label-fmt-value"
											   data-inspector-key="gen_label_fmt"
											   value="{{ data.gen_label_fmt || 'ampm' }}">

										<# var __fmt_name = 'rt_label_fmt_' + ( data.html_id ? data.html_id : ( 'id_' + String( Math.random() ).slice(2) ) ); #>

										<label>
											<input type="radio"
												   name="{{ __fmt_name }}"
												   class="js-rt-label-fmt"
												   value="ampm"
												   <# if ( (data.gen_label_fmt||'ampm') === 'ampm' ) { #> checked <# } #> >
											<?php echo esc_html__( 'AM/PM', 'booking' ); ?>
										</label>
										&nbsp;&nbsp;
										<label>
											<input type="radio"
												   name="{{ __fmt_name }}"
												   class="js-rt-label-fmt"
												   value="24h"
												   <# if ( data.gen_label_fmt === '24h' ) { #> checked <# } #> >
											<?php echo esc_html__( '24H', 'booking' ); ?>
										</label>
									</div>
								</div>


								<div class="wpbc_bfb__rt_gen_times" style="margin-top:8px;">

									<!-- 24H group (masked text inputs) -->
									<div class="js-rt-24h wpbc_inline_inputs" <# if ( (data.gen_label_fmt||'ampm') === 'ampm' ) { #> style="display:none" hidden aria-hidden="true" <# } #>>
										<label class="inspector__label inspector__w_30"><?php echo esc_html__( 'From / To', 'booking' ); ?>:</label>
										<div class="wpbc_inline_inputs inspector__w_70">
											<div class="inspector__control inspector__w_45">
												<input type="text" class="inspector__input inspector__w_25 js-rt-mask js-gen-start-24h" data-mask-kind="24h" placeholder="HH:MM" data-inspector-key="gen_start_24h" value="{{ data.gen_start_24h || '09:00' }}">
											</div>
											<div class="inspector__control inspector__w_10" style="text-align: center;font-size: 18px;line-height: 2;font-weight: 700;">&ndash;</div>
											<div class="inspector__control inspector__w_45">
												<input type="text" class="inspector__input inspector__w_25 js-rt-mask js-gen-end-24h" data-mask-kind="24h" placeholder="HH:MM" data-inspector-key="gen_end_24h" value="{{ data.gen_end_24h || '18:00' }}">
											</div>
										</div>
									</div>

									<!-- AM/PM group (native time inputs) -->
									<div class="js-rt-ampm wpbc_inline_inputs" <# if ( (data.gen_label_fmt||'ampm') !== 'ampm' ) { #> style="display:none" hidden aria-hidden="true" <# } #>>
										<label class="inspector__label inspector__w_30"><?php echo esc_html__( 'From / To', 'booking' ); ?>:</label>
										<div class="wpbc_inline_inputs inspector__w_70">
											<div class="inspector__control inspector__w_45">
												<input type="time" class="inspector__input inspector__w_25 js-gen-start-ampm-time" step="300" data-inspector-key="gen_start_ampm_t" value="{{ data.gen_start_ampm_t || '09:00' }}">
											</div>
											<div class="inspector__control inspector__w_10" style="text-align: center;font-size: 18px;line-height: 2;font-weight: 700;">&ndash;</div>
											<div class="inspector__control inspector__w_45">
												<input type="time" class="inspector__input inspector__w_25 js-gen-end-ampm-time" step="300"  data-inspector-key="gen_end_ampm_t" value="{{ data.gen_end_ampm_t || '18:00' }}">
											</div>
										</div>
									</div>
								</div>

								<div class="wpbc_bfb__rt_gen_step wpbc_inline_inputs">
									<label class="inspector__label inspector__w_30"><?php echo esc_html__( 'Duration', 'booking' ); ?></label>
									<div class="wpbc_len_group wpbc_inline_inputs inspector__w_70" data-len-group="rt-step-hours">
										<div class="inspector__control inspector__w_10"><?php echo esc_html__( 'hours', 'booking' ); ?>:</div>
										<input data-len-range type="range"  class="inspector__input js-gen-step-h-range" min="0" max="12" step="1" value="{{ data.gen_step_h || 0 }}">
										<input data-len-value type="number" class="inspector__input inspector__w_30 js-gen-step-h" data-inspector-key="gen_step_h" min="0" max="12" step="1" value="{{ data.gen_step_h || 0 }}">
									</div>
								</div>

								<div class="wpbc_bfb__rt_gen_step wpbc_inline_inputs">
									<label class="inspector__label inspector__w_30"></label>
									<div class="wpbc_len_group wpbc_inline_inputs inspector__w_70" data-len-group="rt-step-minutes">
										<div class="inspector__control inspector__w_10"><?php echo esc_html__( 'minutes', 'booking' ); ?>:</div>
										<input data-len-range type="range"  class="inspector__input js-gen-step-m-range" min="0" max="59" step="5" value="{{ data.gen_step_m || 30 }}">
										<input data-len-value type="number" class="inspector__input inspector__w_30 js-gen-step-m" data-inspector-key="gen_step_m" min="0" max="59" step="5" value="{{ data.gen_step_m || 30 }}">
									</div>
								</div>

								<div class="wpbc_bfb__options_toolbar wpbc_inline_inputs">
									<div class="inspector__control inspector__w_100" style="text-align: center;">
										<button type="button" class="button button-primary js-rt-generate"><?php echo esc_html__( 'Generate time slots', 'booking' ); ?> <i class="menu_icon icon-1x wpbc_icn_arrow_downward" aria-hidden="true"></i></button>
									</div>
								</div>

							</div>
						</div>

						<?php /* ===== Options editor ===== */ ?>
						<div class="inspector__row  wpbc_bfb__options_editor">
							<div class="wpbc_bfb__options_list__header">
								<div class="wpbc_bfb__header_col__drag-handle"></div>
								<div class="wpbc_bfb__header_col__label"><?php echo esc_html__( 'Label', 'booking' ) . ' (' . esc_html__( 'any text', 'booking' ) . ')'; ?></div>
								<div class="wpbc_bfb__header_col__value" style="flex: 150px;"><?php echo esc_html__( 'Time slot', 'booking' ); ?></div>
								<div class="wpbc_bfb__header_col__action"></div>
							</div>
							<div class="wpbc_bfb__options_list">
								<#
								var _opts2 = Array.isArray( data.options ) ? data.options
									: ( function(o){ var a=[],k; for ( k in (o || {}) ) { if ( Object.prototype.hasOwnProperty.call( o, k ) ) { a.push( o[ k ] ); } } return a; } )( data.options );
								#>

								<# _opts2.forEach( function( opt, idx ){
									var _val   = String( opt && opt.value || '' );
									var _parts = _val.split( /\s*-\s*/ );
									var __start = _parts[0] || '';
									var __end   = _parts[1] || '';
									var __uid   = 'wpbc_ins_rt_' + Math.random().toString(36).slice(2,10);
									var __sel   = !!( opt && ( true === opt.selected || 'true' === opt.selected || 1 === opt.selected || '1' === opt.selected ) );
								#>
								<div class="wpbc_bfb__options_row" data-index="{{ idx }}">
									<span class="wpbc_bfb__drag-handle" title="<?php echo esc_attr__( 'Drag to reorder', 'booking' ); ?>"><span class="wpbc_icn_drag_indicator"></span></span>

									<input type="text" class="wpbc_bfb__opt-label" placeholder="<?php echo esc_attr__( 'Label (e.g. 10:00 AM - 10:30 AM)', 'booking' ); ?>" value="{{ opt && opt.label || '' }}">

									<# if ( (data.gen_label_fmt||'ampm') === '24h' ) { #>
										<input type="text" class="wpbc_bfb__opt-start js-rt-mask" data-mask-kind="24h" placeholder="HH:MM" value="{{ __start }}">
										<span class="wpbc_bfb__opt-sep" aria-hidden="true">-</span>
										<input type="text" class="wpbc_bfb__opt-end js-rt-mask" data-mask-kind="24h" placeholder="HH:MM" value="{{ __end }}">
									<# } else { #>
										<input type="time" class="wpbc_bfb__opt-start js-rt-start-time" step="300" value="{{ __start }}">
										<span class="wpbc_bfb__opt-sep" aria-hidden="true">-</span>
										<input type="time" class="wpbc_bfb__opt-end js-rt-end-time" step="300" value="{{ __end }}">
									<# } #>

									<input type="text" class="wpbc_bfb__opt-value" value="{{ _val }}" hidden>

									<div class="wpbc_bfb__opt-selected">
										<div class="inspector__control wpbc_ui__toggle">
											<input type="checkbox" class="wpbc_bfb__opt-selected-chk inspector__input" id="{{ __uid }}" role="switch" aria-checked="{{ __sel ? 'true' : 'false' }}" <# if ( __sel ) { #> checked <# } #> >
											<label class="wpbc_ui__toggle_icon_radio" for="{{ __uid }}"></label>
											<label class="wpbc_ui__toggle_label" for="{{ __uid ?>"><?php echo esc_js( __( 'Default', 'booking' ) ); ?></label>
										</div>
									</div>

									<div class="wpbc_ui_el wpbc_ui_el_container wpbc_ui_el__dropdown">
										<a href="javascript:void(0)" data-toggle="wpbc_dropdown" aria-expanded="false" class="ul_dropdown_menu_toggle">
											<i class="menu_icon icon-1x wpbc_icn_more_vert"></i>
										</a>
										<ul class="ul_dropdown_menu" role="menu" style="right:0px; left:auto;">
											<li><a class="ul_dropdown_menu_li_action rt_dropdown_action" data-rt-action="add_after" href="javascript:void(0)"><?php echo esc_html__( 'Add New', 'booking' ); ?><i class="menu_icon icon-1x wpbc_icn_add_circle"></i></a></li>
											<li><a class="ul_dropdown_menu_li_action rt_dropdown_action" data-rt-action="duplicate" href="javascript:void(0)"><?php echo esc_html__( 'Duplicate', 'booking' ); ?><i class="menu_icon icon-1x wpbc_icn_content_copy"></i></a></li>
											<li class="divider"></li>
											<li><a class="ul_dropdown_menu_li_action rt_dropdown_action" data-rt-action="remove" href="javascript:void(0)"><?php echo esc_html__( 'Remove', 'booking' ); ?><i class="menu_icon icon-1x wpbc_icn_delete_outline"></i></a></li>
										</ul>
									</div>
								</div>
								<# }); #>
							</div>

							<div class="wpbc_bfb__options_toolbar ">
								<small class="desc"><?php echo esc_html__( 'Drag by handle to reorder. For single-select, only one “Default” can be checked.', 'booking' ); ?></small>
								<div class="wpbc_bfb__options_toolbar wpbc_inline_inputs">
									<div class="inspector__control inspector__w_15">
										<button type="button" class="button js-rt-clear"><?php
											echo esc_html__( 'Clear all', 'booking' ); ?></button>
									</div>
									<div class="inspector__control inspector__w_85">
										<button type="button" class="button button-secondary js-rt-add-option">
											<i class="wpbc_ui_el__vert_nav_icon tooltip_right_offset menu_icon icon-1x wpbc_icn_add_circle" aria-hidden="true"></i>
											<?php echo esc_html__( 'Add time slot', 'booking' ); ?>
										</button>
									</div>
								</div>
							</div>

							<#
								var __json = JSON.stringify(_opts2 || []);
								__json = __json.replace(/<\/textarea/gi, '<\\/textarea');
							#>
							<textarea class="wpbc_bfb__options_state inspector__input" data-inspector-key="options" hidden>{{ __json }}</textarea>
						</div>


						<div class="inspector__row js-placeholder-row">
							<label class="inspector__label"><?php echo esc_html__( 'Placeholder (single only)', 'booking' ); ?></label>
							<div class="inspector__control">
								<input type="text" class="inspector__input js-placeholder" data-inspector-key="placeholder" value="{{ data.placeholder || '<?php echo '--- ' . esc_js( __( 'Select time', 'booking' ) ) . ' ---'; ?>' }}">
								<p class="wpbc_bfb__help js-placeholder-note" style="margin-top:6px; display:none;"><?php echo esc_html__( 'Placeholder is used only for single-select when no default is set.', 'booking' ); ?></p>
							</div>
						</div>
						<?php /* ?>
						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Allow multiple selection', 'booking' ); ?></label>
							<div class="inspector__control">
								<input type="checkbox" class="inspector__checkbox js-opt-multiple" data-inspector-key="multiple"
									<# if ( true === data.multiple || 'true' === data.multiple || 1 === data.multiple || '1' === data.multiple ) { #> checked <# } #> >
							</div>
						</div>

						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Size (rows, for multiple)', 'booking' ); ?></label>
							<div class="inspector__control">
								<div class="wpbc_len_group wpbc_inline_inputs" data-len-group="select-size-rows">
									<input data-len-range type="range" class="inspector__input" min="2" max="20" step="1" value="{{ data.size || '' }}">
									<input data-len-value type="number" class="inspector__input inspector__w_30" data-inspector-key="size" min="2" max="20" value="{{ data.size || '' }}">
								</div>
							</div>
						</div>
						<?php */ ?>



					</div>
				</section>

				<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="appearance">
					<button type="button" class="group__header">
						<h3><?php echo esc_html__( 'Appearance', 'booking' ); ?></h3>
						<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
					</button>
					<div class="group__fields">

						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'CSS class', 'booking' ); ?></label>
							<div class="inspector__control">
								<input type="text" class="inspector__input" data-inspector-key="cssclass" value="{{ data.cssclass || '' }}">
							</div>
						</div>

						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'HTML ID', 'booking' ); ?></label>
							<div class="inspector__control">
								<input type="text" class="inspector__input" data-inspector-key="html_id" value="{{ data.html_id || '' }}">
							</div>
						</div>

						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Min width', 'booking' ); ?></label>
							<div class="inspector__control">
								<input type="text" class="inspector__input" data-inspector-key="min_width" placeholder="240px" value="{{ data.min_width || '240px' }}">
							</div>
						</div>
					</div>
				</section>

				<?php /* ?>
				<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="advanced">
					<button type="button" class="group__header">
						<h3><?php echo esc_html__( 'Advanced', 'booking' ); ?></h3>
						<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
					</button>
					<div class="group__fields">
						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Default (value or CSV for multiple)', 'booking' ); ?></label>
							<div class="inspector__control">
								<input type="text" class="inspector__input js-default-value" data-inspector-key="default_value" value="{{ data.default_value || '' }}">
								<p class="wpbc_bfb__help js-default-value-note" style="margin-top:6px; display:none;"><?php echo esc_html__( 'Clear row defaults to use the text field.', 'booking' ); ?></p>
							</div>
						</div>
					</div>
				</section>
				<?php */ ?>

			</div><!-- .wpbc_bfb__inspector__body -->
		</div><!-- .wpbc_bfb__inspector_rangetime wpbc_bfb__inspector_timepicker-->
	</script>

	<?php
}
