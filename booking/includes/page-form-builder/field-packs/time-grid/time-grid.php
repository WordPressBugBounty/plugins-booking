<?php
/**
 * WPBC BFB Pack: Time Slots (WP-template–driven with grid editor & week-cycle profiles)
 *
 * Goal:
 * - Ultra-easy creation of time slots via a visual grid: weekdays on X-axis, time on Y-axis.
 * - Click or mouse-drag to add/remove slots.
 * - Supports repeating week cycles (e.g., Week A/Week B/Week C …) so different weeks can have different slots.
 *
 * Overview:
 * - Server (PHP) registers the pack, schema defaults, palette item, and prints wp.template() blocks.
 * - Client (JS) renders preview and powers the Inspector’s interactive grid editor.
 *
 * File:  ../includes/page-form-builder/field-packs/time-slots/field-time-slots-wptpl.php
 *
 * @package   Booking Calendar
 * @author    wpdevelop
 * @since     11.0.0
 * @modified  2025-09-28
 * @version   1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the "time_slots" field pack (WP-template–driven Inspector).
 *
 * Schema notes:
 * - start_time / end_time in 'HH:MM' 24h format.
 * - step_minutes granularity for grid rows.
 * - week_cycle number of distinct weekly profiles (1..6). Profiles repeat in cycle order.
 * - profiles: array of profile objects:
 *      array(
 *          array(
 *              'key'   => 'A',
 *              'label' => 'Week A',
 *              'slots' => array(
 *                  // 1..7 (Mon..Sun). Each is array of ranges: array( array( 'from' => '10:00', 'to' => '12:00' ), ... )
 *                  '1' => array( array( 'from' => '10:00', 'to' => '12:00' ) ),
 *                  '2' => array(),
 *                  ...
 *                  '7' => array()
 *              ),
 *          ),
 *          ...
 *      )
 *
 * @param array $packs Accumulated packs.
 *
 * @return array Modified packs with "time_slots" field included.
 */
function wpbc_bfb_register_field_packs__field_time_slots_wptpl( $packs ) {

	$default_profile_slots = array(
		'1' => array(), '2' => array(), '3' => array(), '4' => array(), '5' => array(), '6' => array(), '7' => array(),
	);

	$packs['time_slots'] = array(
		'kind'      => 'field',
		'type'      => 'time_slots',
		'label'     => __( 'Time Slots', 'booking' ),
		'icon'      => 'wpbc_icn_schedule',
		'usage_key' => 'time_slots',

		// Schema drives coercion/defaults/serialization.
		'schema'    => array(
			'props' => array(
				'label'        => array( 'type' => 'string',  'default' => __( 'Time Slots', 'booking' ) ),
				'name'         => array( 'type' => 'string',  'default' => '' ),
				'html_id'      => array( 'type' => 'string',  'default' => '' ),
				'required'     => array( 'type' => 'boolean', 'default' => false ),
				'cssclass'     => array( 'type' => 'string',  'default' => '' ),
				'help'         => array( 'type' => 'string',  'default' => '' ),

				// Grid configuration.
				'start_time'   => array( 'type' => 'string',  'default' => '08:00' ),
				'end_time'     => array( 'type' => 'string',  'default' => '20:00' ),
				'step_minutes' => array( 'type' => 'number',  'default' => 30, 'min' => 5, 'max' => 180 ),

				// Week cycle (profiles).
				'week_cycle'   => array( 'type' => 'number',  'default' => 1, 'min' => 1, 'max' => 6 ),
				'profiles'     => array(
					'type'    => 'array',
					'default' => array(
						array(
							'key'   => 'A',
							'label' => 'Week A',
							'slots' => $default_profile_slots,
						),
					),
				),

				// Appearance.
				'min_width'    => array( 'type' => 'string',  'default' => '320px' ),
			),
		),

		'templates_printer' => 'wpbc_bfb_field_time_slots_wptpl_print_templates',
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_time_slots_wptpl' );

/**
 * Enqueue the Time Slots (WP-template) pack JS for the Builder page.
 *
 * @param string $page Current admin page slug (from core).
 *
 * @return void
 */
function wpbc_bfb_enqueue__field_time_slots_wptpl_js( $page ) {
	wp_enqueue_script(
		'wpbc-bfb_field_time_slots_wptpl',
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/time-grid/_out/time-grid-wptpl.js' ),
		array( 'wp-util', 'wpbc-bfb' ),
		WP_BK_VERSION_NUM,
		true
	);
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_time_slots_wptpl_js', 10, 1 );

/**
 * Print wp.template() blocks for the Time Slots field.
 *
 * Templates:
 * - Preview: compact visualization of defined slots per week profile.
 * - Inspector: full interactive grid editor (click/drag) + profile (week-cycle) control.
 *
 * @param string $page The current page slug (core passes the Builder slug here).
 *
 * @return void
 */
function wpbc_bfb_field_time_slots_wptpl_print_templates( $page ) {

	if ( WPBC_BFB_BUILDER_PAGE_SLUG !== $page ) {
		return;
	}
	?>
	<script type="text/html" id="tmpl-wpbc-bfb-field-time-slots">
		<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="" style="display:block; min-width: {{ data.min_width || '320px' }};">
			<# var is_req = ( true === data.required || 'true' === data.required || 1 === data.required || '1' === data.required ); #>
			<# if ( data.label && data.label !== '' ) { #>
				<label class="wpbc_bfb__field-label" <# if ( data.html_id ) { #> for="{{ data.html_id }}" <# } #>>
					{{ data.label }} <# if ( is_req ) { #><span aria-hidden="true">*</span><# } #>
				</label>
			<# } #>

			<div class="wpbc_bfb__time_preview {{ data.cssclass || '' }}" aria-disabled="true" tabindex="-1">
				<#
					var __profiles = Array.isArray( data.profiles ) ? data.profiles : [];
					if ( ! __profiles.length ) {
						__profiles = [ { key: 'A', label: 'Week A', slots: { '1':[], '2':[], '3':[], '4':[], '5':[], '6':[], '7':[] } } ];
					}
					var __days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
				#>
				<div class="wpbc_bfb__time_preview__weeks">
					<# __profiles.forEach( function( p, idx ){ #>
						<div class="wpbc_bfb__time_preview__week">
							<div class="wpbc_bfb__time_preview__week_title">
								<strong>{{ p && p.label ? p.label : ('Week ' + (idx+1)) }}</strong>
							</div>
							<div class="wpbc_bfb__time_preview__rows">
								<# for ( var d = 1; d <= 7; d++ ) {
									var day_lbl = __days[ d - 1 ];
									var day_ranges = ( p && p.slots && p.slots[ String( d ) ] ) ? p.slots[ String( d ) ] : [];
								#>
									<div class="wpbc_bfb__time_preview__row">
										<div class="wpbc_bfb__time_preview__day">{{ day_lbl }}</div>
										<div class="wpbc_bfb__time_preview__slots">
											<# if ( Array.isArray( day_ranges ) && day_ranges.length ) { #>
												<# day_ranges.forEach( function(r){ #>
													<span class="wpbc_bfb__time_badge">{{ (r.from || '') + ' – ' + (r.to || '') }}</span>
												<# }); #>
											<# } else { #>
												<span class="wpbc_bfb__time_badge wpbc_bfb__time_badge--empty"><?php echo esc_html__( 'No slots', 'booking' ); ?></span>
											<# } #>
										</div>
									</div>
								<# } #>
							</div>
						</div>
					<# }); #>
				</div>
				<# if ( data.help ) { #>
					<div class="wpbc_bfb__help">{{ data.help }}</div>
				<# } #>
			</div>
		</span>
	</script>



	<script type="text/html" id="tmpl-wpbc-bfb-timegrid-row">
		<div class="wpbc_bfb__timegrid_row" data-minute="{{ data.minute }}">
			<div class="wpbc_bfb__timegrid_cell wpbc_bfb__timegrid_cell--time">{{ data.label }}</div>
			<div class="wpbc_bfb__timegrid_cell wpbc_bfb__timegrid_cell--slot" data-day="1" data-minute="{{ data.minute }}"></div>
			<div class="wpbc_bfb__timegrid_cell wpbc_bfb__timegrid_cell--slot" data-day="2" data-minute="{{ data.minute }}"></div>
			<div class="wpbc_bfb__timegrid_cell wpbc_bfb__timegrid_cell--slot" data-day="3" data-minute="{{ data.minute }}"></div>
			<div class="wpbc_bfb__timegrid_cell wpbc_bfb__timegrid_cell--slot" data-day="4" data-minute="{{ data.minute }}"></div>
			<div class="wpbc_bfb__timegrid_cell wpbc_bfb__timegrid_cell--slot" data-day="5" data-minute="{{ data.minute }}"></div>
			<div class="wpbc_bfb__timegrid_cell wpbc_bfb__timegrid_cell--slot" data-day="6" data-minute="{{ data.minute }}"></div>
			<div class="wpbc_bfb__timegrid_cell wpbc_bfb__timegrid_cell--slot" data-day="7" data-minute="{{ data.minute }}"></div>
		</div>
	</script>

<?php
/**
 * FIX 1 — Correct Inspector template ID to match the field type key "time_slots".
 *
 * The Builder looks up templates by:  tmpl-wpbc-bfb-inspector-{type}
 * So for type "time_slots" the ID must be "tmpl-wpbc-bfb-inspector-time_slots" (underscore).
 *
 * Replace the old <script> tag ID:
 *    id="tmpl-wpbc-bfb-inspector-time-slots"
 * with the new one (underscore):
 *    id="tmpl-wpbc-bfb-inspector-time_slots"
 *
 * File: /includes/page-form-builder/field-packs/time-slots/field-time-slots-wptpl.php
 */
?>
<script type="text/html" id="tmpl-wpbc-bfb-inspector-time_slots">
	<div class="wpbc_bfb__inspector__head">
		<div class="header_container">
			<div class="header_title_content">
				<h3 class="title"><?php echo esc_html__( 'Time Slots', 'booking' ); ?></h3>
				<div class="desc"><?php echo esc_html__( 'Click or drag on the grid to add time ranges. Use week cycle to set different slots for different weeks.', 'booking' ); ?></div>
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
							<button data-action="duplicate" aria-label="<?php echo esc_attr__( 'Duplicate', 'booking' ); ?>" type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button">
								<i class="menu_icon icon-1x wpbc_icn_content_copy"></i>
							</button>
							<button data-action="delete" aria-label="<?php echo esc_attr__( 'Delete', 'booking' ); ?>" type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button wpbc_ui_button_danger button-link-delete">
								<span class="in-button-text"><?php echo esc_html__( 'Delete', 'booking' ); ?></span>&nbsp;&nbsp;<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i>
							</button>
						</div>
					</div><!-- .ui_group -->
				</div><!-- .ui_container -->
			</div><!-- .actions -->
		</div><!-- .header_container -->
	</div><!-- .wpbc_bfb__inspector__head -->

	<div class="wpbc_bfb__inspector__body">

		<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group is-open" data-group="basic">
			<button type="button" class="group__header">
				<h3><?php echo esc_html__( 'Basic', 'booking' ); ?></h3>
				<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
			</button>
			<div class="group__fields">
				<div class="inspector__row">
					<label class="inspector__label"><?php echo esc_html__( 'Label', 'booking' ); ?></label>
					<div class="inspector__control">
						<input type="text" class="inspector__input" data-inspector-key="label" value="{{ data.label || '<?php echo esc_js( __( 'Time Slots', 'booking' ) ); ?>' }}">
					</div>
				</div>

				<div class="inspector__row">
					<label class="inspector__label"><?php echo esc_html__( 'Name', 'booking' ); ?></label>
					<div class="inspector__control">
						<input type="text" class="inspector__input" data-inspector-key="name" placeholder="<?php esc_attr_e( 'auto — from label', 'booking' ); ?>" value="{{ data.name || '' }}">
					</div>
				</div>

				<div class="inspector__row">
					<label class="inspector__label"><?php echo esc_html__( 'Required', 'booking' ); ?></label>
					<div class="inspector__control">
						<input type="checkbox" class="inspector__checkbox" data-inspector-key="required"
						<# if ( true === data.required || 'true' === data.required || 1 === data.required || '1' === data.required ) { #> checked <# } #> >
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

		<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group is-open" data-group="grid">
			<button type="button" class="group__header">
				<h3><?php echo esc_html__( 'Time grid', 'booking' ); ?></h3>
				<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
			</button>

			<div class="group__fields">

				<div class="inspector__row">
					<label class="inspector__label"><?php echo esc_html__( 'From / To', 'booking' ); ?></label>
					<div class="inspector__control wpbc_inline_inputs">
						<input type="time" class="inspector__input inspector__w_45" data-inspector-key="start_time" value="{{ data.start_time || '08:00' }}">
						<input type="time" class="inspector__input inspector__w_45" data-inspector-key="end_time"   value="{{ data.end_time   || '20:00' }}">
					</div>
				</div>

				<div class="inspector__row">
					<label class="inspector__label"><?php echo esc_html__( 'Step (minutes)', 'booking' ); ?></label>
					<div class="inspector__control">
						<div class="wpbc_len_group wpbc_inline_inputs" data-len-group="time-step">
							<input data-len-range type="range"  class="inspector__input" min="5" max="180" step="5" value="{{ data.step_minutes || 30 }}">
							<input data-len-value type="number" class="inspector__input inspector__w_30" data-inspector-key="step_minutes" min="5" max="180" step="5" value="{{ data.step_minutes || 30 }}">
						</div>
					</div>
				</div>

				<div class="inspector__row">
					<label class="inspector__label"><?php echo esc_html__( 'Week cycle', 'booking' ); ?></label>
					<div class="inspector__control">
						<select class="inspector__input js-week-cycle" data-inspector-key="week_cycle">
							<# var wc = parseInt( data.week_cycle || 1, 10 ); if ( ! isFinite( wc ) || wc < 1 ) { wc = 1; } if ( wc > 6 ) { wc = 6; } #>
							<# for ( var i = 1; i <= 6; i++ ) { #>
								<option value="{{ i }}" <# if ( i === wc ) { #> selected <# } #> >
									{{ i === 1 ? '<?php echo esc_js( __( 'Every week (1)', 'booking' ) ); ?>' : ('<?php echo esc_js( __( 'Repeat', 'booking' ) ); ?> ' + i) }}
								</option>
							<# } #>
						</select>
						<p class="wpbc_bfb__help" style="margin-top:6px;"><?php echo esc_html__( 'Choose how many different weekly profiles rotate in sequence (e.g., 2 = Week A / Week B / Week A / …).', 'booking' ); ?></p>
					</div>
				</div>

				<div class="wpbc_bfb__timegrid_toolbar">
					<div class="wpbc_bfb__timegrid_profiles">
						<label><?php echo esc_html__( 'Profile', 'booking' ); ?>:</label>
						<select class="js-profile-select"></select>
						<button type="button" class="button button-secondary js-profile-rename"><?php echo esc_html__( 'Rename', 'booking' ); ?></button>
						<button type="button" class="button button-secondary js-profile-duplicate"><?php echo esc_html__( 'Duplicate', 'booking' ); ?></button>
						<button type="button" class="button js-profile-clear"><?php echo esc_html__( 'Clear all', 'booking' ); ?></button>
					</div>
					<div class="wpbc_bfb__timegrid_helpers">
						<button type="button" class="button button-secondary js-row-fill"><?php echo esc_html__( 'Fill row…', 'booking' ); ?></button>
						<button type="button" class="button button-secondary js-col-fill"><?php echo esc_html__( 'Fill column…', 'booking' ); ?></button>
						<button type="button" class="button button-secondary js-copy-prev-day"><?php echo esc_html__( 'Copy ← day', 'booking' ); ?></button>
						<button type="button" class="button button-secondary js-copy-prev-week"><?php echo esc_html__( 'Copy ← week', 'booking' ); ?></button>
					</div>
				</div>

				<div class="wpbc_bfb__timegrid_root" data-grid>
					<div class="wpbc_bfb__timegrid_head">
						<div class="wpbc_bfb__timegrid_cell wpbc_bfb__timegrid_cell--corner" aria-hidden="true"></div>
						<div class="wpbc_bfb__timegrid_cell wpbc_bfb__timegrid_cell--day" data-day="1"><?php echo esc_html__( 'Mon', 'booking' ); ?></div>
						<div class="wpbc_bfb__timegrid_cell wpbc_bfb__timegrid_cell--day" data-day="2"><?php echo esc_html__( 'Tue', 'booking' ); ?></div>
						<div class="wpbc_bfb__timegrid_cell wpbc_bfb__timegrid_cell--day" data-day="3"><?php echo esc_html__( 'Wed', 'booking' ); ?></div>
						<div class="wpbc_bfb__timegrid_cell wpbc_bfb__timegrid_cell--day" data-day="4"><?php echo esc_html__( 'Thu', 'booking' ); ?></div>
						<div class="wpbc_bfb__timegrid_cell wpbc_bfb__timegrid_cell--day" data-day="5"><?php echo esc_html__( 'Fri', 'booking' ); ?></div>
						<div class="wpbc_bfb__timegrid_cell wpbc_bfb__timegrid_cell--day" data-day="6"><?php echo esc_html__( 'Sat', 'booking' ); ?></div>
						<div class="wpbc_bfb__timegrid_cell wpbc_bfb__timegrid_cell--day" data-day="7"><?php echo esc_html__( 'Sun', 'booking' ); ?></div>
					</div>
					<div class="wpbc_bfb__timegrid_body"></div>
				</div>

				<#
					var __profiles_val = JSON.stringify( data.profiles || [] );
					__profiles_val = __profiles_val.replace(/<\/textarea/gi, '<\\/textarea');
				#>
				<textarea class="wpbc_bfb__options_state inspector__input js-profiles-json" data-inspector-key="profiles" hidden>{{ __profiles_val }}</textarea>
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
						<input type="text" class="inspector__input" data-inspector-key="min_width" placeholder="320px" value="{{ data.min_width || '320px' }}">
					</div>
				</div>
			</div>
		</section>

	</div><!-- .wpbc_bfb__inspector__body -->
</script>

	<?php
}

/**
 * (Optional) Register the "Time Slots" palette item in "general/bottom".
 *
 * @param string $group    Palette group: 'general' | 'advanced' | ...
 * @param string $position Position: 'top' | 'bottom'
 *
 * @return void
 */
function wpbc_bfb_palette_register_items__time_slots_wptpl( $group, $position ) {

	if ( 'times' !== $group || 'bottom' !== $position ) {
		return;
	}
	?>
	<li class="wpbc_bfb__field"
		data-id="time_slots"
		data-type="time_slots"
		data-usage_key="time_slots"
		data-label="<?php echo esc_attr( __( 'Time Slots', 'booking' ) ); ?>">
		<i class="menu_icon icon-1x wpbc_icn_access_time"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html( __( 'Time Slots', 'booking' ) ); ?> - Grid</span>
		<span class="wpbc_bfb__field-type">time-slots</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__time_slots_wptpl', 10, 2 );
