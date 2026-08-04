<?php
/**
 * WPBC BFB Pack: Weekday Start Time.
 *
 * Generates conditional weekday sections with the canonical "starttime" field:
 * [condition name="weekday-condition" type="weekday" value="1,2"]
 *     [selectbox* starttime "10:00" "10:30" "11:00"]
 * [/condition]
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the "weekday_starttime" field pack.
 *
 * @param array $packs Packs map.
 * @return array
 */
function wpbc_bfb_register_field_packs__field_weekday_starttime_wptpl( $packs ) {

	$is_supported = class_exists( 'wpdev_bk_biz_m' );
	$upgrade_text = __( 'This field is available only in Booking Calendar Business Medium or higher versions.', 'booking' );

	$default_slots = array(
		array( 'from' => '10:00', 'to' => '17:00' ),
	);

	$weekday_slots = array(
		'default' => $default_slots,
		'1'       => $default_slots,
		'2'       => $default_slots,
		'3'       => $default_slots,
		'4'       => $default_slots,
		'5'       => $default_slots,
		'6'       => $default_slots,
		'7'       => $default_slots,
	);

	$packs['weekday_starttime'] = array(
		'kind'      => 'field',
		'type'      => 'weekday_starttime',
		'label'     => __( 'Weekday start time', 'booking' ),
		'icon'      => 'wpbc_icn_schedule',
		'usage_key' => 'starttime',
		'schema'    => array(
			'props' => array(
				'label'          => array( 'type' => 'string',  'default' => __( 'Start time', 'booking' ) ),
				'name'           => array( 'type' => 'string',  'default' => 'starttime' ),
				'html_id'        => array( 'type' => 'string',  'default' => '' ),
				'required'       => array( 'type' => 'boolean', 'default' => true ),
				'cssclass'       => array( 'type' => 'string',  'default' => '' ),
				'help'           => array( 'type' => 'string',  'default' => '' ),
				'condition_name' => array( 'type' => 'string',  'default' => 'weekday-condition' ),
				'is_supported'   => array( 'type' => 'boolean', 'default' => $is_supported ),
				'upgrade_text'   => array( 'type' => 'string',  'default' => $upgrade_text ),
				'start_time'     => array( 'type' => 'string',  'default' => '10:00' ),
				'end_time'       => array( 'type' => 'string',  'default' => '17:00' ),
				'step_minutes'   => array( 'type' => 'number',  'default' => 30, 'min' => 5, 'max' => 180 ),
				'slots'          => array( 'type' => 'array',   'default' => $weekday_slots ),
				'min_width'      => array( 'type' => 'string',  'default' => '320px' ),
			),
		),

		'templates_printer' => 'wpbc_bfb_field_weekday_starttime_wptpl_print_templates',
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_weekday_starttime_wptpl' );

/**
 * Enqueue the Weekday Start Time pack JS.
 *
 * @param string $page Current admin page slug.
 * @return void
 */
function wpbc_bfb_enqueue__field_weekday_starttime_wptpl_js( $page ) {
	wp_enqueue_script(
		'wpbc-bfb_field_weekday_starttime_wptpl',
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/weekday-starttime/_out/field-weekday-starttime-wptpl.js' ),
		array( 'wp-util', 'wpbc-bfb' ),
		WP_BK_VERSION_NUM,
		true
	);

	wp_localize_script(
		'wpbc-bfb_field_weekday_starttime_wptpl',
		'WPBC_BFB_Weekday_Starttime_Boot',
		array(
			'is_supported' => class_exists( 'wpdev_bk_biz_m' ) ? 1 : 0,
			'upgrade_text' => __( 'This field is available only in Booking Calendar Business Medium or higher versions.', 'booking' ),
		)
	);
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_weekday_starttime_wptpl_js', 10, 1 );

/**
 * Palette item.
 *
 * @param string $group    Palette group.
 * @param string $position Palette position.
 * @return void
 */
function wpbc_bfb_palette_register_items__weekday_starttime_wptpl( $group, $position ) {
	if ( 'times' !== $group || 'bottom' !== $position ) {
		return;
	}
	?>
	<li class="wpbc_bfb__field"
		data-id="weekday_starttime"
		data-type="weekday_starttime"
		data-usage_key="starttime"
		data-usagenumber="1"
		data-label="<?php echo esc_attr( __( 'Weekday start time', 'booking' ) ); ?>"
		data-name="starttime"
		data-required="true"
		data-is_supported="<?php echo esc_attr( class_exists( 'wpdev_bk_biz_m' ) ? 'true' : 'false' ); ?>"
		data-upgrade_text="<?php echo esc_attr__( 'This field is available only in Booking Calendar Business Medium or higher versions.', 'booking' ); ?>"
		data-autoname="0"
		data-fresh="0"
		data-name_user_touched="1"
		data-min_width="320px">
		<i class="menu_icon icon-1x wpbc_icn_schedule"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html( __( 'Weekday start time', 'booking' ) ); ?></span>
		<?php
		if ( ! class_exists( 'wpdev_bk_biz_m' ) ) {
			echo '<span class="wpbc_pro_label">Pro | BM+</span>';
		}
		?>
		<span class="wpbc_bfb__field-type">conditional-starttime</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__weekday_starttime_wptpl', 10, 2 );

/**
 * Print wp.template() blocks.
 *
 * @param string $page Builder page slug.
 * @return void
 */
function wpbc_bfb_field_weekday_starttime_wptpl_print_templates( $page ) {
	if ( WPBC_BFB_BUILDER_PAGE_SLUG !== $page ) {
		return;
	}
	?>
	<script type="text/html" id="tmpl-wpbc-bfb-field-weekday_starttime">
		<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="" style="display:block; min-width: {{ data.min_width || '320px' }};">
			<# var is_req = ( true === data.required || 'true' === data.required || 1 === data.required || '1' === data.required ); #>
			<# var day_labels = { 'default':'Default', '1':'Mon', '2':'Tue', '3':'Wed', '4':'Thu', '5':'Fri', '6':'Sat', '7':'Sun' }; #>
			<# var order = ['default','1','2','3','4','5','6','7']; #>
			<# var slots = data.slots || {}; #>
			<# if ( data.label && data.label !== '' ) { #>
				<label class="wpbc_bfb__field-label" <# if ( data.html_id ) { #> for="{{ data.html_id }}" <# } #>>
					{{ data.label }} <# if ( is_req ) { #><span aria-hidden="true">*</span><# } #>
				</label>
			<# } #>
			<div class="wpbc_bfb__weekday_time_preview {{ data.cssclass || '' }}" aria-disabled="true" tabindex="-1">
				<# order.forEach( function(day_key){ var ranges = Array.isArray( slots[ day_key ] ) ? slots[ day_key ] : []; #>
					<div class="wpbc_bfb__weekday_time_preview__row">
						<div class="wpbc_bfb__weekday_time_preview__day">{{ day_labels[ day_key ] }}</div>
						<div class="wpbc_bfb__weekday_time_preview__slots">
							<# if ( ranges.length ) { ranges.forEach( function(r){ #>
								<span class="wpbc_bfb__weekday_time_badge">{{ r.from || '' }}</span>
							<# }); } else { #>
								<span class="wpbc_bfb__weekday_time_badge wpbc_bfb__weekday_time_badge--empty"><?php echo esc_html__( 'No start times', 'booking' ); ?></span>
							<# } #>
						</div>
					</div>
				<# }); #>
				<# if ( data.help ) { #><div class="wpbc_bfb__help">{{ data.help }}</div><# } #>
				<# var is_supported = ( true === data.is_supported || 'true' === data.is_supported || 1 === data.is_supported || '1' === data.is_supported ); #>
				<# if ( ! is_supported && data.upgrade_text ) { #>
					<div class="wpbc_bfb__help">{{ data.upgrade_text }}</div>
				<# } #>
			</div>
		</span>
	</script>

	<script type="text/html" id="tmpl-wpbc-bfb-weekday-starttime-row">
		<div class="wpbc_bfb__weekday_timegrid_row" data-minute="{{ data.minute }}">
			<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--time">{{ data.label }}</div>
			<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--slot" data-day="default" data-minute="{{ data.minute }}"></div>
			<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--slot" data-day="1" data-minute="{{ data.minute }}"></div>
			<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--slot" data-day="2" data-minute="{{ data.minute }}"></div>
			<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--slot" data-day="3" data-minute="{{ data.minute }}"></div>
			<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--slot" data-day="4" data-minute="{{ data.minute }}"></div>
			<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--slot" data-day="5" data-minute="{{ data.minute }}"></div>
			<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--slot" data-day="6" data-minute="{{ data.minute }}"></div>
			<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--slot" data-day="7" data-minute="{{ data.minute }}"></div>
		</div>
	</script>

	<script type="text/html" id="tmpl-wpbc-bfb-inspector-weekday_starttime">
		<style type="text/css">
			.wpbc_admin .wpbc_ui_el__vert_right_bar__wrapper:has(.wpbc_bfb__inspector_timepicker) {
				--wpbc_ui_left_vert_nav__width_max: Min(648px, 100%);
			}
		</style>
		<div class="wpbc_bfb__inspector_weekday_starttime wpbc_bfb__inspector_timepicker" data-type="weekday_starttime">
			<div class="wpbc_bfb__inspector__head">
				<div class="header_container">
					<div class="header_title_content">
						<h3 class="title"><?php echo esc_html__( 'Weekday start time', 'booking' ); ?></h3>
						<div class="desc"><?php echo esc_html__( 'Define the available appointment start times for each weekday.', 'booking' ); ?></div>
					</div>
					<div class="actions wpbc_ajx_toolbar wpbc_no_borders">
						<div class="ui_container ui_container_small">
							<div class="ui_group">
								<div class="ui_element">
									<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button" data-action="deselect" aria-label="<?php echo esc_attr__( 'Deselect', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc_icn_remove_done"></i></button>
									<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button" data-action="scrollto" aria-label="<?php echo esc_attr__( 'Scroll to field', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc_icn_ads_click filter_center_focus"></i></button>
								</div>
								<div class="ui_element">
									<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button" data-action="move-up" aria-label="<?php echo esc_attr__( 'Move up', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc_icn_arrow_upward"></i></button>
									<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button" data-action="move-down" aria-label="<?php echo esc_attr__( 'Move down', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc_icn_arrow_downward"></i></button>
								</div>
								<div class="ui_element">
									<button data-action="delete" aria-label="<?php echo esc_attr__( 'Delete', 'booking' ); ?>" type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button wpbc_ui_button_danger button-link-delete">
										<span class="in-button-text"><?php echo esc_html__( 'Delete', 'booking' ); ?></span>&nbsp;&nbsp;<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i>
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

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
								<input type="text" class="inspector__input" data-inspector-key="label" value="{{ data.label || '<?php echo esc_js( __( 'Start time', 'booking' ) ); ?>' }}">
							</div>
						</div>
						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Name', 'booking' ); ?></label>
							<div class="inspector__control">
								<input type="text" class="inspector__input" value="starttime" disabled="disabled" aria-disabled="true">
								<input type="hidden" class="inspector__input js-locked-name" data-inspector-key="name" data-locked="1" value="starttime">
								<input type="hidden" class="inspector__input js-locked-condition-name" data-inspector-key="condition_name" data-locked="1" value="weekday-condition">
								<p class="wpbc_bfb__help" style="margin-top:6px;"><?php echo esc_html__( 'This field exports conditional sections for the reserved "starttime" field.', 'booking' ); ?></p>
							</div>
						</div>
						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Required', 'booking' ); ?></label>
							<div class="inspector__control">
								<input type="checkbox" class="inspector__checkbox" data-inspector-key="required" <# if ( true === data.required || 'true' === data.required || 1 === data.required || '1' === data.required ) { #> checked <# } #>>
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
						<h3><?php echo esc_html__( 'Weekday start times', 'booking' ); ?></h3>
						<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
					</button>
					<div class="group__fields">
						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'From / To', 'booking' ); ?></label>
							<div class="inspector__control wpbc_inline_inputs">
								<input type="time" class="inspector__input inspector__w_45" data-inspector-key="start_time" value="{{ data.start_time || '10:00' }}">
								<input type="time" class="inspector__input inspector__w_45" data-inspector-key="end_time" value="{{ data.end_time || '17:00' }}">
							</div>
						</div>
						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Step (minutes)', 'booking' ); ?></label>
							<div class="inspector__control">
								<div class="wpbc_len_group wpbc_inline_inputs" data-len-group="weekday-time-step">
									<input data-len-range type="range" class="inspector__input" min="5" max="180" step="5" value="{{ data.step_minutes || 30 }}">
									<input data-len-value type="number" class="inspector__input inspector__w_30" data-inspector-key="step_minutes" min="5" max="180" step="5" value="{{ data.step_minutes || 30 }}">
								</div>
							</div>
						</div>

						<div class="wpbc_bfb__weekday_timegrid_toolbar">
							<button type="button" class="button button-secondary js-copy-default"><?php echo esc_html__( 'Copy default to weekdays', 'booking' ); ?></button>
							<button type="button" class="button button-secondary js-clear-weekdays"><?php echo esc_html__( 'Clear weekdays', 'booking' ); ?></button>
						</div>

						<div class="wpbc_bfb__weekday_timegrid_root" data-grid>
							<div class="wpbc_bfb__weekday_timegrid_head">
								<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--corner" aria-hidden="true"></div>
								<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--day" data-day="default"><?php echo esc_html__( 'Default', 'booking' ); ?></div>
								<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--day" data-day="1"><?php echo esc_html__( 'Mon', 'booking' ); ?></div>
								<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--day" data-day="2"><?php echo esc_html__( 'Tue', 'booking' ); ?></div>
								<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--day" data-day="3"><?php echo esc_html__( 'Wed', 'booking' ); ?></div>
								<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--day" data-day="4"><?php echo esc_html__( 'Thu', 'booking' ); ?></div>
								<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--day" data-day="5"><?php echo esc_html__( 'Fri', 'booking' ); ?></div>
								<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--day" data-day="6"><?php echo esc_html__( 'Sat', 'booking' ); ?></div>
								<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--day" data-day="7"><?php echo esc_html__( 'Sun', 'booking' ); ?></div>
							</div>
							<div class="wpbc_bfb__weekday_timegrid_body"></div>
						</div>

						<#
							var __slots_json = JSON.stringify( data.slots || {} );
							__slots_json = __slots_json.replace(/<\/textarea/gi, '<\\/textarea');
						#>
						<textarea class="wpbc_bfb__options_state inspector__input js-weekday-slots-json" data-inspector-key="slots" hidden>{{ __slots_json }}</textarea>
					</div>
				</section>

				<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="appearance">
					<button type="button" class="group__header">
						<h3><?php echo esc_html__( 'Appearance', 'booking' ); ?></h3>
						<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
					</button>
					<div class="group__fields">
						<?php wpbc_bfb_time_picker__print_inspector_group(); ?>
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
								<input type="text" class="inspector__input" data-inspector-key="min_width" value="{{ data.min_width || '320px' }}">
							</div>
						</div>
					</div>
				</section>
			</div>
		</div>
	</script>
	<?php
}
