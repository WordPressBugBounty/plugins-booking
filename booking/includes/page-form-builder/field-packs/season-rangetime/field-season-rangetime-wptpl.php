<?php
/**
 * WPBC BFB Pack: Season time slots.
 *
 * Generates conditional season sections with the canonical "rangetime" field:
 * [condition name="season-condition" type="season" value="High season"]
 *     [selectbox* rangetime "10:00 - 12:00" "12:00 - 14:00"]
 * [/condition]
 *
 * @package Booking Calendar
 * @since   11.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Get season filters visible to the current builder user.
 *
 * @return array
 */
function wpbc_bfb_season_rangetime_get_season_filters() {

	if ( ! class_exists( 'wpdev_bk_biz_m' ) || ! function_exists( 'wpbc_sf_cache' ) ) {
		return array();
	}

	$wpbc_sf_cache     = wpbc_sf_cache();
	$season_filter_arr = $wpbc_sf_cache->get_data();
	$current_user_id   = function_exists( 'wpbc_get_current_user_id' ) ? (int) wpbc_get_current_user_id() : (int) get_current_user_id();
	$is_mu_regular     = false;

	if ( class_exists( 'wpdev_bk_multiuser' ) ) {
		$is_current_super = apply_bk_filter( 'is_user_super_admin', $current_user_id );
		$is_mu_regular    = ! $is_current_super;
	}

	$seasons = array();

	foreach ( (array) $season_filter_arr as $filter_id => $filter_arr ) {
		$id      = isset( $filter_arr['id'] ) ? (int) $filter_arr['id'] : (int) $filter_id;
		$title   = isset( $filter_arr['title'] ) ? wp_strip_all_tags( html_entity_decode( (string) $filter_arr['title'], ENT_QUOTES, get_bloginfo( 'charset' ) ) ) : '';
		$user_id = isset( $filter_arr['users'] ) ? (int) $filter_arr['users'] : 0;

		if ( $id <= 0 || '' === trim( $title ) ) {
			continue;
		}

		if ( $is_mu_regular && $user_id !== $current_user_id ) {
			continue;
		}

		$seasons[] = array(
			'id'      => (string) $id,
			'key'     => 's' . $id,
			'title'   => $title,
			'user_id' => $user_id,
		);
	}

	return $seasons;
}

/**
 * Register the "season_rangetime" field pack.
 *
 * @param array $packs Packs map.
 * @return array
 */
function wpbc_bfb_register_field_packs__field_season_rangetime_wptpl( $packs ) {

	$is_supported = class_exists( 'wpdev_bk_biz_m' );
	$upgrade_text = __( 'This field is available only in Booking Calendar Business Medium or higher versions.', 'booking' );

	$default_slots = array(
		array( 'from' => '10:00', 'to' => '11:00' ),
		array( 'from' => '11:00', 'to' => '12:00' ),
		array( 'from' => '12:00', 'to' => '13:00' ),
		array( 'from' => '13:00', 'to' => '14:00' ),
		array( 'from' => '14:00', 'to' => '15:00' ),
		array( 'from' => '15:00', 'to' => '16:00' ),
		array( 'from' => '16:00', 'to' => '17:00' ),
		array( 'from' => '17:00', 'to' => '18:00' ),
	);

	$season_filters = wpbc_bfb_season_rangetime_get_season_filters();
	$season_slots   = array(
		'default' => $default_slots,
	);

	foreach ( $season_filters as $season_filter ) {
		$season_slots[ $season_filter['key'] ] = $default_slots;
	}

	$packs['season_rangetime'] = array(
		'kind'      => 'field',
		'type'      => 'season_rangetime',
		'label'     => __( 'Season time slots', 'booking' ),
		'icon'      => 'wpbc_icn_date_range',
		'usage_key' => 'rangetime',
		'schema'    => array(
			'props' => array(
				'label'          => array( 'type' => 'string',  'default' => __( 'Time slots', 'booking' ) ),
				'name'           => array( 'type' => 'string',  'default' => 'rangetime' ),
				'html_id'        => array( 'type' => 'string',  'default' => '' ),
				'required'       => array( 'type' => 'boolean', 'default' => true ),
				'cssclass'       => array( 'type' => 'string',  'default' => '' ),
				'help'           => array( 'type' => 'string',  'default' => '' ),
				'condition_name' => array( 'type' => 'string',  'default' => 'season-condition' ),
				'is_supported'   => array( 'type' => 'boolean', 'default' => $is_supported ),
				'upgrade_text'   => array( 'type' => 'string',  'default' => $upgrade_text ),
				'seasons'        => array( 'type' => 'array',   'default' => $season_filters ),
				'start_time'     => array( 'type' => 'string',  'default' => '10:00' ),
				'end_time'       => array( 'type' => 'string',  'default' => '20:00' ),
				'step_minutes'   => array( 'type' => 'number',  'default' => 60, 'min' => 5, 'max' => 180 ),
				'slots'          => array( 'type' => 'array',   'default' => $season_slots ),
				'min_width'      => array( 'type' => 'string',  'default' => '320px' ),
			),
		),

		'templates_printer' => 'wpbc_bfb_field_season_rangetime_wptpl_print_templates',
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_season_rangetime_wptpl' );

/**
 * Enqueue the Season time slots pack JS.
 *
 * @param string $page Current admin page slug.
 * @return void
 */
function wpbc_bfb_enqueue__field_season_rangetime_wptpl_js( $page ) {
	wp_enqueue_script(
		'wpbc-bfb_field_season_rangetime_wptpl',
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/season-rangetime/_out/field-season-rangetime-wptpl.js' ),
		array( 'wp-util', 'wpbc-bfb' ),
		WP_BK_VERSION_NUM,
		true
	);

	wp_localize_script(
		'wpbc-bfb_field_season_rangetime_wptpl',
		'WPBC_BFB_season_rangetime_Boot',
		array(
			'is_supported' => class_exists( 'wpdev_bk_biz_m' ) ? 1 : 0,
			'upgrade_text' => __( 'This field is available only in Booking Calendar Business Medium or higher versions.', 'booking' ),
			'seasons'      => wpbc_bfb_season_rangetime_get_season_filters(),
			'no_seasons'   => __( 'No season filters are available for the current user.', 'booking' ),
		)
	);
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_season_rangetime_wptpl_js', 10, 1 );

/**
 * Palette item.
 *
 * @param string $group    Palette group.
 * @param string $position Palette position.
 * @return void
 */
function wpbc_bfb_palette_register_items__season_rangetime_wptpl( $group, $position ) {
	if ( 'times' !== $group || 'bottom' !== $position ) {
		return;
	}
	?>
	<li class="wpbc_bfb__field"
		data-id="season_rangetime"
		data-type="season_rangetime"
		data-usage_key="rangetime"
		data-usagenumber="1"
		data-label="<?php echo esc_attr( __( 'Season time slots', 'booking' ) ); ?>"
		data-name="rangetime"
		data-required="true"
		data-is_supported="<?php echo esc_attr( class_exists( 'wpdev_bk_biz_m' ) ? 'true' : 'false' ); ?>"
		data-upgrade_text="<?php echo esc_attr__( 'This field is available only in Booking Calendar Business Medium or higher versions.', 'booking' ); ?>"
		data-autoname="0"
		data-fresh="0"
		data-name_user_touched="1"
		data-min_width="320px">
		<i class="menu_icon icon-1x wpbc_icn_date_range"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html( __( 'Season time slots', 'booking' ) ); ?></span>
		<?php
		if ( ! class_exists( 'wpdev_bk_biz_m' ) ) {
			echo '<span class="wpbc_pro_label">Pro | BM+</span>';
		}
		?>
		<span class="wpbc_bfb__field-type">conditional-rangetime</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__season_rangetime_wptpl', 10, 2 );

/**
 * Print wp.template() blocks.
 *
 * @param string $page Builder page slug.
 * @return void
 */
function wpbc_bfb_field_season_rangetime_wptpl_print_templates( $page ) {
	if ( WPBC_BFB_BUILDER_PAGE_SLUG !== $page ) {
		return;
	}
	?>
	<script type="text/html" id="tmpl-wpbc-bfb-field-season_rangetime">
		<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="" style="display:block; min-width: {{ data.min_width || '320px' }};">
			<# var is_req = ( true === data.required || 'true' === data.required || 1 === data.required || '1' === data.required ); #>
			<# var seasons = Array.isArray( data.seasons ) ? data.seasons : []; #>
			<# var cols = [ { key:'default', title:'Default' } ].concat( seasons ); #>
			<# var slots = data.slots || {}; #>
			<# if ( data.label && data.label !== '' ) { #>
				<label class="wpbc_bfb__field-label" <# if ( data.html_id ) { #> for="{{ data.html_id }}" <# } #>>
					{{ data.label }} <# if ( is_req ) { #><span aria-hidden="true">*</span><# } #>
				</label>
			<# } #>
			<div class="wpbc_bfb__weekday_time_preview {{ data.cssclass || '' }}" aria-disabled="true" tabindex="-1">
				<# cols.forEach( function(col){ var ranges = Array.isArray( slots[ col.key ] ) ? slots[ col.key ] : []; #>
					<div class="wpbc_bfb__weekday_time_preview__row">
						<div class="wpbc_bfb__weekday_time_preview__day">{{ col.title }}</div>
						<div class="wpbc_bfb__weekday_time_preview__slots">
							<# if ( ranges.length ) { ranges.forEach( function(r){ #>
								<span class="wpbc_bfb__weekday_time_badge">{{ (r.from || '') + ' - ' + (r.to || '') }}</span>
							<# }); } else { #>
								<span class="wpbc_bfb__weekday_time_badge wpbc_bfb__weekday_time_badge--empty"><?php echo esc_html__( 'No slots', 'booking' ); ?></span>
							<# } #>
						</div>
					</div>
				<# }); #>
				<# if ( data.help ) { #><div class="wpbc_bfb__help">{{ data.help }}</div><# } #>
				<# var is_supported = ( true === data.is_supported || 'true' === data.is_supported || 1 === data.is_supported || '1' === data.is_supported ); #>
				<# if ( ! is_supported && data.upgrade_text ) { #>
					<div class="wpbc_bfb__help">{{ data.upgrade_text }}</div>
				<# } #>
				<# if ( is_supported && ! seasons.length && data.no_seasons ) { #>
					<div class="wpbc_bfb__help">{{ data.no_seasons }}</div>
				<# } #>
			</div>
		</span>
	</script>

	<script type="text/html" id="tmpl-wpbc-bfb-season-rangetime-row">
		<# var cols = Array.isArray( data.columns ) ? data.columns : [ { key:'default', title:'Default' } ]; #>
		<# var grid_style = 'grid-template-columns:76px repeat(' + cols.length + ', minmax(112px,1fr)); min-width:' + ( 76 + cols.length * 112 ) + 'px;'; #>
		<div class="wpbc_bfb__weekday_timegrid_row" data-minute="{{ data.minute }}" style="{{ grid_style }}">
			<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--time">{{ data.label }}</div>
			<# cols.forEach( function(col){ #>
				<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--slot" data-day="{{ col.key }}" data-minute="{{ data.minute }}" title="{{ col.title }}"></div>
			<# }); #>
		</div>
	</script>

	<script type="text/html" id="tmpl-wpbc-bfb-inspector-season_rangetime">
		<style type="text/css">
			.wpbc_admin .wpbc_ui_el__vert_right_bar__wrapper:has(.wpbc_bfb__inspector_timepicker) {
				--wpbc_ui_left_vert_nav__width_max: Min(648px, 100%);
			}
		</style>
		<div class="wpbc_bfb__inspector_season_rangetime wpbc_bfb__inspector_timepicker" data-type="season_rangetime">
			<div class="wpbc_bfb__inspector__head">
				<div class="header_container">
					<div class="header_title_content">
						<h3 class="title"><?php echo esc_html__( 'Season time slots', 'booking' ); ?></h3>
						<div class="desc"><?php echo esc_html__( 'Define different time slots for selected season filters.', 'booking' ); ?></div>
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
								<input type="text" class="inspector__input" data-inspector-key="label" value="{{ data.label || '<?php echo esc_js( __( 'Time slots', 'booking' ) ); ?>' }}">
							</div>
						</div>
						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Name', 'booking' ); ?></label>
							<div class="inspector__control">
								<input type="text" class="inspector__input" value="rangetime" disabled="disabled" aria-disabled="true">
								<input type="hidden" class="inspector__input js-locked-name" data-inspector-key="name" data-locked="1" value="rangetime">
								<input type="hidden" class="inspector__input js-locked-condition-name" data-inspector-key="condition_name" data-locked="1" value="season-condition">
								<p class="wpbc_bfb__help" style="margin-top:6px;"><?php echo esc_html__( 'This field exports conditional sections for the reserved "rangetime" field.', 'booking' ); ?></p>
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
						<h3><?php echo esc_html__( 'Season slots', 'booking' ); ?></h3>
						<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
					</button>
					<div class="group__fields">
						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'From / To', 'booking' ); ?></label>
							<div class="inspector__control wpbc_inline_inputs">
								<input type="time" class="inspector__input inspector__w_45" data-inspector-key="start_time" value="{{ data.start_time || '10:00' }}">
								<input type="time" class="inspector__input inspector__w_45" data-inspector-key="end_time" value="{{ data.end_time || '20:00' }}">
							</div>
						</div>
						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Step (minutes)', 'booking' ); ?></label>
							<div class="inspector__control">
								<div class="wpbc_len_group wpbc_inline_inputs" data-len-group="season-time-step">
									<input data-len-range type="range" class="inspector__input" min="5" max="180" step="5" value="{{ data.step_minutes || 60 }}">
									<input data-len-value type="number" class="inspector__input inspector__w_30" data-inspector-key="step_minutes" min="5" max="180" step="5" value="{{ data.step_minutes || 60 }}">
								</div>
							</div>
						</div>

						<div class="wpbc_bfb__weekday_timegrid_toolbar">
							<button type="button" class="button button-secondary js-copy-default"><?php echo esc_html__( 'Copy default to seasons', 'booking' ); ?></button>
							<button type="button" class="button button-secondary js-clear-weekdays"><?php echo esc_html__( 'Clear seasons', 'booking' ); ?></button>
						</div>

						<div class="wpbc_bfb__weekday_timegrid_root" data-grid>
							<#
								var __seasons = Array.isArray( data.seasons ) ? data.seasons : [];
								var __cols = [ { key:'default', title:'Default' } ].concat( __seasons );
								var __grid_style = 'grid-template-columns:76px repeat(' + __cols.length + ', minmax(112px,1fr)); min-width:' + ( 76 + __cols.length * 112 ) + 'px;';
							#>
							<div class="wpbc_bfb__weekday_timegrid_head" style="{{ __grid_style }}">
								<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--corner" aria-hidden="true"></div>
								<# __cols.forEach( function(col){ #>
									<div class="wpbc_bfb__weekday_timegrid_cell wpbc_bfb__weekday_timegrid_cell--day" data-day="{{ col.key }}" title="{{ col.title }}">{{ col.title }}</div>
								<# }); #>
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
