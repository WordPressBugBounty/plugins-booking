<?php
/**
 * WPBC BFB Pack: Calendar Field (WP-template–driven with Inspector)
 *
 * Purpose
 * - Registers a "calendar" field pack with schema defaults and usage guard (once per form).
 * - Prints wp.template() blocks for Preview and Inspector.
 * - Enqueues the companion JS renderer and passes boot-time options via wp_localize_script().
 *
 * Contracts Used
 * - Filter:  wpbc_bfb_register_field_packs
 * - Action:  wpbc_enqueue_js_field_pack
 * - Action:  wpbc_bfb_palette_register_items
 *
 * Implementation Notes
 * - Label "for" now always targets the computed textarea ID (accessibility fix).
 * - Enqueue is limited to the Builder page slug.
 * - Calendar boot params keep legacy option keys (historic spellings) for compatibility.
 * - Minimal inline guard normalizes min_width to px/%/rem/em in the preview template.
 *
 * @package   Booking Calendar
 * @author    wpdevelop, oplugins
 * @since     11.0.0
 * @modified  2025-10-10
 * @version   1.2.3
 * @file      ../includes/page-form-builder/field-packs/calendar/calendar.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class-like wrapper with static methods for better modularity/extendability.
 * All names use snake_case per project convention.
 */
class WPBC_BFB_Field_Calendar_WPTPL_Pack {

	/**
	 * Bootstrap all hooks.
	 *
	 * @return void
	 */
	public static function init() {
		add_filter( 'wpbc_bfb_register_field_packs',   array( __CLASS__, 'register_field_packs' ) );
		add_action( 'wpbc_enqueue_js_field_pack',      array( __CLASS__, 'enqueue_js' ), 10, 1 );
		add_action( 'wpbc_bfb_palette_register_items', array( __CLASS__, 'palette_register_item' ), 10, 2 );
	}

	/**
	 * Register the "calendar" field pack and its schema.
	 *
	 * @param array $packs Accumulated packs from other modules.
	 *
	 * @return array Modified packs with "calendar".
	 */
	public static function register_field_packs( $packs ) {
		$packs['calendar'] = array(
			'kind'              => 'field',
			'type'              => 'calendar',
			'label'             => __( 'Calendar', 'booking' ),
			'icon'              => 'wpbc-bi-calendar3',
			'usage_key'         => 'calendar',                      // once-per-form guard lives on the client via data-usagenumber="1".
			'schema'            => array(
				'props' => array(
					'label'       => array( 'type' => 'string', 'default' => __( 'Date', 'booking' ) ),
					'name'        => array( 'type' => 'string', 'default' => '' ),
					'html_id'     => array( 'type' => 'string', 'default' => '' ),
					'cssclass'    => array( 'type' => 'string', 'default' => '' ),
					'help'        => array( 'type' => 'string', 'default' => '' ),
					'resource_id' => array( 'type' => 'number', 'default' => self::get_preview_resource_id(), 'min' => 1 ),
					'months'      => array( 'type' => 'number', 'default' => 1, 'min' => 1, 'max' => 12 ),
					'min_width'   => array( 'type' => 'string', 'default' => '250px' ),
				),
			),
			'templates_printer' => array( __CLASS__, 'print_templates' ),
		);

		return $packs;
	}

	/**
	 * Build a minimal, sanitized resources list for client templates.
	 *
	 * Each item: array( 'booking_type_id' => int, 'title' => string, 'parent' => string '0'|id )
	 * Titles are stripped of HTML. Only essential keys are exported to reduce payload size.
	 *
	 * @return array
	 */
	protected static function get_booking_resources_boot_data() {
		$resources_boot = array();

		// Booking plugin must be active. Keep hard guard, same as other toolbars.
		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			return $resources_boot;
		}

		if ( ! function_exists( 'wpbc_ajx_get_all_booking_resources_arr' ) || ! function_exists( 'wpbc_ajx_get_sorted_booking_resources_arr' ) ) {
			return $resources_boot;
		}

		$resources_arr        = wpbc_ajx_get_all_booking_resources_arr();
		$resources_arr_sorted = wpbc_ajx_get_sorted_booking_resources_arr( $resources_arr );

		foreach ( $resources_arr_sorted as $resource_item ) {
			$id = isset( $resource_item['booking_type_id'] ) ? intval( $resource_item['booking_type_id'] ) : 0;
			if ( $id <= 0 ) {
				continue;
			}

			$title_raw = isset( $resource_item['title'] ) ? $resource_item['title'] : '';
			$title     = wp_strip_all_tags( $title_raw, true );

			$parent = isset( $resource_item['parent'] ) ? (string) intval( $resource_item['parent'] ) : '0';

			$resources_boot[] = array(
				'booking_type_id' => $id,
				'title'           => $title,
				'parent'          => $parent,
			);
		}

		/**
		 * Filter the resources list provided to the Calendar Inspector select.
		 *
		 * @param array $resources_boot List of arrays: booking_type_id, title, parent.
		 */
		return apply_filters( 'wpbc_bfb_calendar_resources_boot', $resources_boot );
	}

	/**
	 * Enqueue the field JS (calendar renderer) and pass calendar boot options.
	 *
	 * @param string $page Current admin page slug used by the Builder.
	 *
	 * @return void
	 */
	public static function enqueue_js( $page ) {

		// Ensure we load only on the Builder UI.
		if ( defined( 'WPBC_BFB_BUILDER_PAGE_SLUG' ) && WPBC_BFB_BUILDER_PAGE_SLUG !== $page ) {
			return;
		}

		wp_enqueue_script(
			'wpbc-bfb_field_calendar_wptpl',
			wpbc_plugin_url( '/includes/page-form-builder/field-packs/calendar/_out/calendar.js' ),
			array( 'wp-util', 'wpbc-bfb' ),
			WP_BK_VERSION_NUM,
			true
		);

		// Current request URI (used for AJAX routing/diagnostics).
		$request_uri = '';
		if ( isset( $_SERVER['REQUEST_URI'] ) ) {                                // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
			$request_uri = esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		}

		// Parallelism for calendar loader (defaults to 1).
		$balancer_max_threads = intval( get_bk_option( 'booking_load_balancer_max_threads' ) );
		$balancer_max_threads = ( empty( $balancer_max_threads ) ) ? 1 : $balancer_max_threads;

		// Day-selection defaults (allow override from core helper if present).
		$days_selection = array(
			'days_select_mode'          => 'multiple',
			'fixed__days_num'           => 0,
			'fixed__week_days__start'   => '-1',
			'dynamic__days_min'         => 0,
			'dynamic__days_max'         => 0,
			'dynamic__days_specific'    => '',
			'dynamic__week_days__start' => '-1',
		);
		if ( function_exists( 'wpbc__calendar__js_params__get_days_selection_arr' ) ) {
			$days_selection = wpbc__calendar__js_params__get_days_selection_arr();
		}

		/**
		 * Enterprise/business options — kept for compatibility.
		 * Note: We intentionally keep legacy option names (typos included) because related
		 * client code expects them. Do not rename without updating JS consumer logic.
		 */
		$is_parent_resource                   = 0; // Placeholder: 0 means "single resource mode" preview.
		$booking_capacity_field               = '';
		$booking_is_different_subres_disabled = '';
		if ( class_exists( 'wpdev_bk_biz_l' ) ) {
			$booking_capacity_field               = function_exists( 'wpbc_get__booking_capacity_field__name' ) ? wpbc_get__booking_capacity_field__name() : '';
			$booking_is_different_subres_disabled = get_bk_option( 'booking_is_dissbale_booking_for_different_sub_resources' );
		}

		$booking_recurrent_time = '';
		if ( class_exists( 'wpdev_bk_biz_s' ) ) {
			// No esc_js() — wp_localize_script() JSON-encodes safely.
			$booking_recurrent_time = (string) get_bk_option( 'booking_recurrent_time' );
		}

		// Boot payload for real booking resources (used by the Inspector select).
		$booking_resources = self::get_booking_resources_boot_data();
		$is_free_version   = ( class_exists( 'wpdev_bk_personal' ) ) ? 0 : 1;

		wp_localize_script(
			'wpbc-bfb_field_calendar_wptpl',
			'WPBC_BFB_CalendarBoot',
			array(
				'nonce'                                                   => wp_create_nonce( 'wpbc_calendar_load_ajx' . '_wpbcnonce' ),
				'user_id'                                                 => (int) wpbc_get_current_user_id(),
				'locale'                                                  => (string) get_user_locale(),
				'request_uri'                                             => (string) $request_uri,

				// Core calendar env.
				'balancer_max_threads'                                    => (int) $balancer_max_threads,
				'booking_max_monthes_in_calendar'                         => (string) get_bk_option( 'booking_max_monthes_in_calendar' ),
				'booking_start_day_weeek'                                 => (string) get_bk_option( 'booking_start_day_weeek' ),
				'booking_date_format'                                     => (string) get_bk_option( 'booking_date_format' ),
				'booking_time_format'                                     => (string) get_bk_option( 'booking_time_format' ),

				'default_preview_resource_id' => (int) self::get_preview_resource_id(),

				// Day-selection policy.
				'days_selection'                                          => array(
					'days_select_mode'          => (string) $days_selection['days_select_mode'],
					'fixed__days_num'           => (int) $days_selection['fixed__days_num'],
					'fixed__week_days__start'   => (string) $days_selection['fixed__week_days__start'],
					'dynamic__days_min'         => (int) $days_selection['dynamic__days_min'],
					'dynamic__days_max'         => (int) $days_selection['dynamic__days_max'],
					'dynamic__days_specific'    => (string) $days_selection['dynamic__days_specific'],
					'dynamic__week_days__start' => (string) $days_selection['dynamic__week_days__start'],
				),

				// Enterprise/business flags.
				'is_parent_resource'                                      => (int) $is_parent_resource,
				'booking_capacity_field'                                  => (string) $booking_capacity_field,
				'booking_is_dissbale_booking_for_different_sub_resources' => (string) $booking_is_different_subres_disabled,
				'booking_recurrent_time'                                  => (string) $booking_recurrent_time,

				// Real booking resources for Inspector select.
				'booking_resources'                                       => $booking_resources,
				'is_free_version' 										  => (int) $is_free_version,
			)
		);
	}

	/**
	 * Print Preview & Inspector templates (Underscore.js) on the Builder page.
	 *
	 * @param string $page Current admin page slug used by the Builder.
	 *
	 * @return void
	 */
	public static function print_templates( $page ) {

		if ( defined( 'WPBC_BFB_BUILDER_PAGE_SLUG' ) && WPBC_BFB_BUILDER_PAGE_SLUG !== $page ) {
			return;
		}

		// == CANVAS PREVIEW ==
		?>
		<script type="text/html" id="tmpl-wpbc-bfb-field-calendar">
			<#
			// Normalize booleans and numbers defensively.
			var __boot_resources = ( window.WPBC_BFB_CalendarBoot && Array.isArray( window.WPBC_BFB_CalendarBoot.booking_resources ) ) ? window.WPBC_BFB_CalendarBoot.booking_resources : [];
			var __configured_rid = Number( ( window.WPBC_BFB_CalendarBoot && window.WPBC_BFB_CalendarBoot.default_preview_resource_id ) || 1 );
			var __data_rid = Number( data.resource_id || 1 );

			function __resource_exists( id ) {
				id = Number( id || 1 );
				if ( ! isFinite( id ) || id <= 0 ) {
					return false;
				}
				for ( var i = 0; i < __boot_resources.length; i++ ) {
					if ( Number( __boot_resources[i].booking_type_id ) === id ) {
						return true;
					}
				}
				return false;
			}
			function __first_existing_resource_id() {
				for ( var i = 0; i < __boot_resources.length; i++ ) {
					var id = Number( __boot_resources[i].booking_type_id );
					if ( isFinite( id ) && id > 0 ) {
						return id;
					}
				}
				return 1;
			}
			var rid = __resource_exists( __configured_rid ) ? __configured_rid : ( __resource_exists( __data_rid ) ? __data_rid : __first_existing_resource_id() );


			var months  = Math.max(1, Math.min(12, Number(data.months || 1)));

			// Compute textarea ID/name: calendar requires 'date_booking{rid}' by convention.
			var input_id   = (data.html_id && String(data.html_id).trim()) ? data.html_id : ('date_booking' + rid);
			var input_name = (data.name    && String(data.name).trim())    ? data.name    : ('date_booking' + rid);

			// Guard CSS length: allow px, %, rem, em; fallback to 250px.
			var minw = (function(v){
				var s = String(v || '').trim();
				var m = s.match(/^(-?\d+(?:\.\d+)?)(px|%|rem|em)$/i);
				return m ? m[0] : '250px';
			})( data.min_width );
			#>

			<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone {{ data.cssclass || '' }}" inert=""
				  style="display:block; min-width: {{ minw }};">
				<# if ( data.label && data.label !== '' ) { #>
					<label class="wpbc_bfb__field-label" for="{{ input_id }}">
						{{ data.label }}
					</label>
				<# } #>

				<div class="wpbc_calendar_wraper wpbc_change_over_triangle">
					<div class="wpbc_cal_container bk_calendar_frame wpbc_no_custom_width months_num_in_row_ cal_month_num_{{ months }}">
						<div id="calendar_booking{{ rid }}"><?php esc_html_e( 'Calendar is loading', 'booking' ); ?>...</div>
					</div>
				</div>

				<textarea rows="3" cols="50" id="{{ input_id }}" name="{{ input_name }}" autocomplete="off" style="display:none;" tabindex="-1" aria-hidden="true"></textarea>
				<?php
					// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					echo wpbc_get_calendar_legend();
				?>
				<# if ( data.help ) { #>
					<div class="wpbc_bfb__help">{{ data.help }}</div>
				<# } #>
			</span>
		</script>
		<?php

		// == INSPECTOR ==
		?>
		<script type="text/html" id="tmpl-wpbc-bfb-inspector-calendar">
			<div class="wpbc_bfb__inspector__head">
				<div class="header_container">
					<div class="header_title_content">
						<h3 class="title"><?php echo esc_html__( 'Calendar', 'booking' ); ?></h3>
						<div class="desc"><?php echo esc_html__( 'Configure the date picker calendar. Some options affect only the preview.', 'booking' ); ?></div>
					</div>
					<div class="actions wpbc_ajx_toolbar wpbc_no_borders">
						<div class="ui_container ui_container_small">
							<div class="ui_group">
								<div class="ui_element">
									<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
											data-action="deselect" aria-label="<?php echo esc_attr__( 'Deselect', 'booking' ); ?>">
										<i class="menu_icon icon-1x wpbc_icn_remove_done"></i>
									</button>
									<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
											data-action="scrollto" aria-label="<?php echo esc_attr__( 'Scroll to field', 'booking' ); ?>">
										<i class="menu_icon icon-1x wpbc_icn_ads_click filter_center_focus"></i>
									</button>
								</div>
								<div class="ui_element">
									<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
											data-action="move-up" aria-label="<?php echo esc_attr__( 'Move up', 'booking' ); ?>">
										<i class="menu_icon icon-1x wpbc_icn_arrow_upward"></i>
									</button>
									<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
											data-action="move-down" aria-label="<?php echo esc_attr__( 'Move down', 'booking' ); ?>">
										<i class="menu_icon icon-1x wpbc_icn_arrow_downward"></i>
									</button>
								</div>
								<div class="ui_element">
									<button data-action="delete" aria-label="<?php echo esc_attr__( 'Delete', 'booking' ); ?>" type="button"
											class="button button-secondary wpbc_ui_control wpbc_ui_button wpbc_ui_button_danger button-link-delete">
										<span class="in-button-text"><?php echo esc_html__( 'Delete', 'booking' ); ?></span>&nbsp;&nbsp;<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i>
									</button>
								</div>
							</div>
						</div>
					</div><!-- .actions -->
				</div>
			</div>

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
								<input type="text" class="inspector__input" data-inspector-key="label"
									   value="{{ data.label || '<?php echo esc_js( __( 'Date', 'booking' ) ); ?>' }}">
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
<?php /* ?>
				<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group is-open" data-group="calendar">
					<button type="button" class="group__header">
						<h3><?php echo esc_html__( 'Calendar', 'booking' ); ?></h3>
						<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
					</button>
					<div class="group__fields">

						<!-- Resource selector with Free-version guard -->
						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Booking resource', 'booking' ); ?></label>
							<div class="inspector__control">
								<#
									var __boot       = window.WPBC_BFB_CalendarBoot || {};
									var __free       = (__boot.is_free_version==='1');
									var __res        = (__boot.booking_resources) ? __boot.booking_resources : [];
									var __has_list   = (__res && __res.length > 0);
									var __rid        = String( data.resource_id || '1' );

									// If Free -> enforce ID=1 and persist to data.
									if ( __free ) {
										__rid = '1';
										data.resource_id = __rid;
									}
								#>
								<# if ( __free ) { #>
									<input type="hidden" class="inspector__input" data-inspector-key="resource_id" value="1">
									<p class="wpbc_bfb__help">
										<?php
										echo esc_html__(
											'The Free version has one default booking resource. To have multiple resources, please upgrade to a premium version.',
											'booking'
										);
										?>
									</p>
								<# } else if ( __has_list ) { #>
									<select class="inspector__input" data-inspector-key="resource_id">
										<#
										// Coerce current value to an existing one if missing.
										var __exists = _.some( __res, function(r){ return String(r.booking_type_id) === __rid; } );
										if ( ! __exists ) { __rid = String( __res[0].booking_type_id ); data.resource_id = __rid; }

										_.each( __res, function( r ){
											var is_parent = ( String(r.parent||'0') === '0' );
											var selected  = ( __rid === String(r.booking_type_id) );
										#>
											<option value="{{ r.booking_type_id }}"
													<# if ( selected ) { #>selected="selected"<# } #>
													style="<# if ( is_parent ) { #>font-weight:600;<# } else { #>font-size:0.95em;padding-left:20px;<# } #>">
												<# if ( ! is_parent ) { #>&nbsp;&nbsp;&nbsp;<# } #>{{ r.title }}
											</option>
										<# }); #>
									</select>
									<p class="wpbc_bfb__help"><?php echo esc_html__( 'Choose booking resource for calendar preview ', 'booking' ); ?></p>
								<# } else { #>
									<input type="hidden" class="inspector__input inspector__w_30" data-inspector-key="resource_id" value="{{ data.resource_id || 1 }}">
									<p class="wpbc_bfb__help"><?php echo esc_html__( 'No resources available. Create booking resources on WP Booking Calendar > Resources > Resources page.', 'booking' ); ?></p>
								<# } #>
							</div>
						</div>

						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Months in row', 'booking' ); ?></label>
							<div class="inspector__control">
								<div class="wpbc_len_group wpbc_inline_inputs" data-len-group="calendar-months">
									<input data-len-range type="range" class="inspector__input" min="1" max="12"
										   step="1" data-inspector-key="months" value="{{ data.months || 1 }}">
									<input data-len-value type="number" class="inspector__input inspector__w_30"
										   data-inspector-key="months" min="1" max="12" value="{{ data.months || 1 }}">
								</div>
								<p class="wpbc_bfb__help"><?php echo esc_html__( 'Preview hint: multiple months may require full calendar init in preview.', 'booking' ); ?></p>
							</div>
						</div>

					</div>
				</section>

				<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="advanced">
					<button type="button" class="group__header">
						<h3><?php echo esc_html__( 'Advanced', 'booking' ); ?></h3>
						<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
					</button>
					<div class="group__fields">

						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'CSS class', 'booking' ); ?></label>
							<div class="inspector__control">
								<input type="text" class="inspector__input" data-inspector-key="cssclass"
									   value="{{ data.cssclass || '' }}">
							</div>
						</div>

						<?php
						// HTML ID must be 'date_booking{rid}' (rid = resource id) to bind with the textarea under the calendar.
						// This field is intentionally non-editable in Inspector to avoid breaking loader contracts.
						// If you must expose it, ensure builder-side enforcement keeps the 'date_booking{rid}' pattern.
						?>

					</div>
				</section>
<?php */ ?>
			</div>
		</script>
		<?php
	}

	/**
	 * Register the palette item (draggable field entry).
	 *
	 * @param string $group    Palette group slug.
	 * @param string $position Position within group.
	 *
	 * @return void
	 */
	public static function palette_register_item( $group, $position ) {
		if ( 'essentials' !== $group || 'top' !== $position ) {
			return;
		}
		?>
		<li class="wpbc_bfb__field"
			data-id="calendar"
			data-type="calendar"
			data-usage_key="calendar"
			data-usagenumber="1"
			data-resource_id="<?php echo intval( self::get_preview_resource_id() ); ?>"
			data-months="1"
			data-label="<?php echo esc_attr( __( 'Calendar', 'booking' ) ); ?>"
			data-min_width="250px">
			<i class="menu_icon icon-1x wpbc-bi-calendar3"></i>
			<span class="wpbc_bfb__field-label"><?php echo esc_html( __( 'Calendar', 'booking' ) ); ?></span>
			<span class="wpbc_bfb__field-type">calendar</span>
		</li>
		<?php
	}

	/**
	 * Get preview resource ID for Builder calendar field.
	 *
	 * Uses the configured default resource if it exists in available resources.
	 * Falls back to the first existing resource ID.
	 *
	 * @return int
	 */
	protected static function get_preview_resource_id() {
		$resources_boot = self::get_booking_resources_boot_data();
		$existing_ids   = array();

		foreach ( $resources_boot as $resource_item ) {
			if ( ! empty( $resource_item['booking_type_id'] ) ) {
				$existing_ids[] = intval( $resource_item['booking_type_id'] );
			}
		}

		$existing_ids = array_values( array_filter( array_unique( $existing_ids ) ) );

		$default_rid = intval( wpbc_get_default_resource() );

		if ( in_array( $default_rid, $existing_ids, true ) ) {
			return $default_rid;
		}

		if ( ! empty( $existing_ids ) ) {
			return intval( $existing_ids[0] );
		}

		return 1;
	}
}

// Bootstrap.
WPBC_BFB_Field_Calendar_WPTPL_Pack::init();
