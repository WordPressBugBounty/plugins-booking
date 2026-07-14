<?php
/**
 * Time slots availability admin page.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'WPBC_AVAILABILITY_TIMESLOTS_DEFAULT_DAYS_COUNT' ) ) {
	define( 'WPBC_AVAILABILITY_TIMESLOTS_DEFAULT_DAYS_COUNT', 30 );
}

/**
 * Check whether the reusable Time Slots Availability component is rendered on current admin page.
 *
 * @return bool
 */
function wpbc_availability_timeslots__is_component_page() {

	if ( ! is_admin() ) {
		return false;
	}

	if ( function_exists( 'wpbc_is_availability_page' ) && wpbc_is_availability_page() ) {
		return true;
	}

	if (
		function_exists( 'wpbc_is_bookings_page' )
		&& wpbc_is_bookings_page()
		&& function_exists( 'wpbc_get_default_saved_view_mode_for_wpbc_page' )
	) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		$requested_tab = isset( $_REQUEST['tab'] ) ? sanitize_key( wp_unslash( $_REQUEST['tab'] ) ) : '';
		if ( '' !== $requested_tab ) {
			return ( 'vm_booking_listing' === $requested_tab );
		}

		return ( 'vm_booking_listing' === wpbc_get_default_saved_view_mode_for_wpbc_page() );
	}

	return false;
}

/**
 * Enqueue CSS for Time Slots Availability.
 *
 * @param string $where_to_load Where assets are loaded.
 *
 * @return void
 */
function wpbc_availability_timeslots_enqueue_css_files( $where_to_load ) {

	if ( ( ! is_admin() ) || ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) ) ) {
		return;
	}

	if ( ! wpbc_availability_timeslots__is_component_page() ) {
		return;
	}

	wp_enqueue_style(
		'wpbc-availability-timeslots-page',
		trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/availability_timeslots_page.css',
		array( 'wpbc-calendar', 'wpbc-all-admin' ),
		WP_BK_VERSION_NUM
	);
}
add_action( 'wpbc_enqueue_css_files', 'wpbc_availability_timeslots_enqueue_css_files', 66 );

/**
 * Print the same datepicker support CSS that the Booking Listing filter uses.
 *
 * @return void
 */
function wpbc_availability_timeslots_print_datepicker_css() {

	if ( ! wpbc_availability_timeslots__is_component_page() ) {
		return;
	}

	if ( function_exists( 'wpbc_is_availability_page' ) && wpbc_is_availability_page() ) {
		$active_tab = isset( $_GET['tab'] ) ? sanitize_key( wp_unslash( $_GET['tab'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( 'time_slots_availability' !== $active_tab ) {
			return;
		}
	}

	if ( function_exists( 'wpbc_datepicker_css' ) ) {
		wpbc_datepicker_css();
	}
}
add_action( 'admin_footer', 'wpbc_availability_timeslots_print_datepicker_css', 66 );

/**
 * Print tooltip initializer for Time Slots Availability.
 *
 * @return void
 */
function wpbc_availability_timeslots_print_tooltip_js() {

	if ( ! wpbc_availability_timeslots__is_component_page() ) {
		return;
	}

	if ( function_exists( 'wpbc_is_availability_page' ) && wpbc_is_availability_page() ) {
		$active_tab = isset( $_GET['tab'] ) ? sanitize_key( wp_unslash( $_GET['tab'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( 'time_slots_availability' !== $active_tab ) {
			return;
		}
	}

	if ( function_exists( 'wpbc_bs_javascript_tooltips' ) ) {
		wpbc_bs_javascript_tooltips();
	}
}
add_action( 'admin_footer', 'wpbc_availability_timeslots_print_tooltip_js', 67 );

/**
 * Enqueue JS for Time Slots Availability.
 *
 * @param string $where_to_load Where assets are loaded.
 *
 * @return void
 */
function wpbc_availability_timeslots_enqueue_js_files( $where_to_load ) {

	if ( ( ! is_admin() ) || ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) ) ) {
		return;
	}

	if ( ! wpbc_availability_timeslots__is_component_page() ) {
		return;
	}

	wp_enqueue_script(
		'wpbc-availability-timeslots-page',
		trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/availability_timeslots_page.js',
		array( 'jquery', 'wpbc_all', 'wpbc-datepick' ),
		WP_BK_VERSION_NUM,
		array( 'in_footer' => WPBC_JS_IN_FOOTER )
	);

	wp_localize_script(
		'wpbc-availability-timeslots-page',
		'wpbc_availability_timeslots_page',
		array(
			'ajax_url' => admin_url( 'admin-ajax.php' ),
			'nonce'    => wp_create_nonce( 'wpbc_availability_timeslots_ajax_nonce' ),
			'i18n'     => array(
				'select_slots_first' => __( 'Select one or more time ranges first.', 'booking' ),
				'block_success'      => __( 'Selected time ranges have been blocked.', 'booking' ),
				'unblock_success'    => __( 'Selected time ranges have been unblocked.', 'booking' ),
				'save_error'         => __( 'Unable to save time-slot availability.', 'booking' ),
				'loading'            => __( 'Loading', 'booking' ),
				'open_booking'       => __( 'Open booking in Booking Listing', 'booking' ),
				'open_availability_rule' => __( 'Open availability settings', 'booking' ),
				'select_one_slot_for_booking' => __( 'Select one time range on one date first.', 'booking' ),
				'add_booking_modal_missing' => __( 'Add Booking popup is not available on this page.', 'booking' ),
				'saving'             => __( 'Saving', 'booking' ),
			),
		)
	);
}
add_action( 'wpbc_enqueue_js_files', 'wpbc_availability_timeslots_enqueue_js_files', 66 );

/**
 * Get resource options for the Time Slots Availability component.
 *
 * @return array
 */
function wpbc_availability_timeslots__get_resources() {

	$resources = array();

	if ( function_exists( 'wpbc_ajx_get_sorted_booking_resources_arr' ) && function_exists( 'wpbc_ajx_get_all_booking_resources_arr' ) ) {
		$resource_rows = wpbc_ajx_get_sorted_booking_resources_arr( wpbc_ajx_get_all_booking_resources_arr() );
		foreach ( $resource_rows as $resource ) {
			$resources[] = array(
				'id'    => isset( $resource['booking_type_id'] ) ? (int) $resource['booking_type_id'] : 1,
				'title' => isset( $resource['title'] ) ? $resource['title'] : __( 'Booking resource', 'booking' ),
			);
		}
	}

	if ( empty( $resources ) ) {
		$resources[] = array(
			'id'    => wpbc_get_default_resource(),
			'title' => '---', //__( 'Default Resource', 'booking' ),
		);
	}

	return $resources;
}

/**
 * Get initial timeline rows. Real booked and blocked bars are loaded by AJAX.
 *
 * @param int $start_ts Start timestamp.
 * @param int $days_count Number of days.
 *
 * @return array
 */
function wpbc_availability_timeslots__get_initial_rows( $start_ts, $days_count = WPBC_AVAILABILITY_TIMESLOTS_DEFAULT_DAYS_COUNT ) {

	$rows       = array();
	$days_count = max( 1, intval( $days_count ) );

	for ( $i = 0; $i < $days_count; $i++ ) {
		$ts     = strtotime( '+' . $i . ' days', $start_ts );
		$rows[] = array(
			'date'  => wp_date( 'Y-m-d', $ts ),
			'label' => wp_date( 'D M j', $ts ),
		);
	}

	return $rows;
}

/**
 * Get selectable time options from 00:00 to 24:00.
 *
 * @param int $selected_minutes Selected minute value.
 *
 * @return string
 */
function wpbc_availability_timeslots__get_time_options( $selected_minutes ) {

	$html = '';
	for ( $minutes = 0; $minutes <= 1440; $minutes += 60 ) {
		$hours = (int) floor( $minutes / 60 );
		$mins  = $minutes % 60;
		$label = sprintf( '%02d:%02d', $hours, $mins );
		$html .= sprintf(
			'<option value="%1$d"%2$s>%3$s</option>',
			(int) $minutes,
			selected( $selected_minutes, $minutes, false ),
			esc_html( $label )
		);
	}

	return $html;
}

/**
 * Print slot step options.
 *
 * @param int $selected_step Selected step.
 *
 * @return void
 */
function wpbc_availability_timeslots__render_slot_step_options( $selected_step = 15 ) {

	$steps = array(
		5  => __( '5 min', 'booking' ),
		10 => __( '10 min', 'booking' ),
		15 => __( '15 min', 'booking' ),
		30 => __( '30 min', 'booking' ),
		60 => __( '1 hour', 'booking' ),
	);

	foreach ( $steps as $step => $label ) {
		?>
		<option value="<?php echo esc_attr( $step ); ?>" <?php selected( (int) $selected_step, (int) $step ); ?>><?php echo esc_html( $label ); ?></option>
		<?php
	}
}

/**
 * Render zoom control.
 *
 * @param string $control_id Control ID.
 * @param int    $selected_step Selected step.
 * @param string $control_name Control name for JS.
 *
 * @return void
 */
function wpbc_availability_timeslots__render_zoom_control( $control_id, $selected_step = 15, $control_name = 'zoom' ) {

	$zoom_steps = array( 60, 30, 15, 10, 5 );
	$zoom_index = array_search( (int) $selected_step, $zoom_steps, true );
	if ( false === $zoom_index ) {
		$zoom_index = 2;
	}
	?>
	<div class="wpbc_ts_zoom">
		<a href="javascript:void(0)" class="button button-secondary wpbc_ts_zoom_button" data-wpbc-ts-zoom="out" aria-label="<?php esc_attr_e( 'Zoom out', 'booking' ); ?>">-</a>
		<input id="<?php echo esc_attr( $control_id ); ?>" data-wpbc-ts-control="<?php echo esc_attr( $control_name ); ?>" type="range" min="0" max="<?php echo esc_attr( count( $zoom_steps ) - 1 ); ?>" value="<?php echo esc_attr( $zoom_index ); ?>" />
		<a href="javascript:void(0)" class="button button-secondary wpbc_ts_zoom_button" data-wpbc-ts-zoom="in" aria-label="<?php esc_attr_e( 'Zoom in', 'booking' ); ?>">+</a>
	</div>
	<?php
}

/**
 * Render Time Slots Availability action buttons.
 *
 * @param string $extra_class Additional wrapper CSS class.
 * @return void
 */
function wpbc_availability_timeslots__render_action_buttons( $extra_class = '' ) {

	$wrapper_class = trim( 'wpbc_ts_action_buttons ' . $extra_class );
	?>
	<div class="<?php echo esc_attr( $wrapper_class ); ?>">
		<a href="javascript:void(0)" class="button button-secondary wpbc_ts_button_danger wpbc_ts_action_button" data-wpbc-ts-command="block"><span class="wpbc_icn_do_not_disturb_on"></span> <?php esc_html_e( 'Block selected', 'booking' ); ?></a>
		<a href="javascript:void(0)" class="button button-secondary wpbc_ts_action_button wpbc_ts_unblock" data-wpbc-ts-command="unblock"><span class="wpbc_icn_blur_off"></span> <?php esc_html_e( 'Unblock selected', 'booking' ); ?></a>
		<a href="javascript:void(0)" class="button button-secondary wpbc_ts_clear_selection"><?php esc_html_e( 'Clear selection', 'booking' ); ?></a>
	</div>
	<?php
}

/**
 * Render the reusable Time Slots Availability timeline component.
 *
 * @param array $args Component arguments.
 *
 * @return void
 */
function wpbc_availability_timeslots__render_timeline_component( $args = array() ) {

	$defaults = array(
		'id_prefix'             => 'wpbc_ts',
		'wrap_class'            => 'wrap wpbc_ts_page wpdevelop',
		'resource_id'           => wpbc_get_default_resource(),
		'resources'             => null,
		'start_ts'              => strtotime( wp_date( 'Y-m-d 00:00:00' ) ),
		'days_count'            => WPBC_AVAILABILITY_TIMESLOTS_DEFAULT_DAYS_COUNT,
		'visible_start_minutes' => 360,
		'visible_end_minutes'   => 1320,
		'slot_step'             => 15,
		'show_toolbar'          => true,
		'show_toolbar_actions'  => true,
		'show_hint'             => true,
		'show_legend'           => true,
		'auto_init'             => true,
	);
	$args     = wp_parse_args( $args, $defaults );

	$id_prefix             = sanitize_key( $args['id_prefix'] );
	$resource_id           = (int) $args['resource_id'];
	$resources             = is_array( $args['resources'] ) ? $args['resources'] : wpbc_availability_timeslots__get_resources();
	$start_ts              = (int) $args['start_ts'];
	$days_count            = max( 1, intval( $args['days_count'] ) );
	$end_ts                = strtotime( '+' . ( $days_count - 1 ) . ' days', $start_ts );
	$rows                  = wpbc_availability_timeslots__get_initial_rows( $start_ts, $days_count );
	$visible_start_minutes = (int) $args['visible_start_minutes'];
	$visible_end_minutes   = (int) $args['visible_end_minutes'];
	$slot_step             = (int) $args['slot_step'];

	$ids = array(
		'resource'         => $id_prefix . '_resource',
		'date_range'       => $id_prefix . '_date_range',
		'slot_step'        => $id_prefix . '_slot_step',
		'zoom'             => $id_prefix . '_zoom',
		'day_start'        => $id_prefix . '_day_start',
		'day_end'          => $id_prefix . '_day_end',
		'day_start_slider' => $id_prefix . '_day_start_slider',
		'day_end_slider'   => $id_prefix . '_day_end_slider',
	);

	?>
	<div class="<?php echo esc_attr( $args['wrap_class'] ); ?>" data-wpbc-ts-component="1" data-wpbc-ts-auto-init="<?php echo esc_attr( $args['auto_init'] ? '1' : '0' ); ?>" data-wpbc-ts-id-prefix="<?php echo esc_attr( $id_prefix ); ?>">
		<?php if ( $args['show_toolbar'] ) : ?>
			<div class="wpbc_ts_toolbar">
				<div class="wpbc_ts_control wpbc_ts_control_resource">
					<label for="<?php echo esc_attr( $ids['resource'] ); ?>"><?php esc_html_e( 'Booking resource', 'booking' ); ?></label>
					<select id="<?php echo esc_attr( $ids['resource'] ); ?>" data-wpbc-ts-control="resource" class="wpbc_ui_control wpbc_ui_select">
						<?php foreach ( $resources as $resource ) : ?>
							<option value="<?php echo esc_attr( $resource['id'] ); ?>" <?php selected( (int) $resource['id'], (int) $resource_id ); ?>>
								<?php echo esc_html( $resource['title'] ); ?>
							</option>
						<?php endforeach; ?>
					</select>
				</div>

				<div class="wpbc_ts_control wpbc_ts_control_range">
					<label for="<?php echo esc_attr( $ids['date_range'] ); ?>"><?php esc_html_e( 'Date range', 'booking' ); ?></label>
					<div class="wpbc_ts_range_nav">
						<a href="javascript:void(0)"
							class="button tooltip_top button-secondary wpbc_button_no_background wpbc_ts_range_nav_button"
							data-wpbc-ts-range-shift="prev"
							aria-label="<?php esc_attr_e( 'Previous date range', 'booking' ); ?>"
							data-original-title="<?php esc_attr_e( 'Previous date range', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc_icn_keyboard_arrow_left"></i><span class="in-button-text"></span></a>
						<div class="wpbc_ts_input_icon">
							<span class="wpbc-bi-calendar3-range"></span>
							<input id="<?php echo esc_attr( $ids['date_range'] ); ?>"
								data-wpbc-ts-control="date_range"
								class="wpbc_ui_control wpbc_ui_text wpdevbk-filters-section-calendar"
								type="text"
								readonly="readonly"
								data-wpbc-ts-start="<?php echo esc_attr( wp_date( 'Y-m-d', $start_ts ) ); ?>"
								data-wpbc-ts-end="<?php echo esc_attr( wp_date( 'Y-m-d', $end_ts ) ); ?>"
								value="<?php echo esc_attr( wp_date( 'M j, Y', $start_ts ) . ' - ' . wp_date( 'M j, Y', $end_ts ) ); ?>" />
						</div>
						<a href="javascript:void(0)"
							class="button tooltip_top button-secondary wpbc_button_no_background wpbc_ts_range_nav_button"
							data-wpbc-ts-range-shift="next"
							aria-label="<?php esc_attr_e( 'Next date range', 'booking' ); ?>"
							data-original-title="<?php esc_attr_e( 'Next date range', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc_icn_keyboard_arrow_right"></i><span class="in-button-text"></span></a>
					</div>
				</div>

				<div class="wpbc_ts_control wpbc_ts_control_precision">
					<label for="<?php echo esc_attr( $ids['slot_step'] ); ?>"><?php esc_html_e( 'Slot step', 'booking' ); ?></label>
					<select id="<?php echo esc_attr( $ids['slot_step'] ); ?>" data-wpbc-ts-control="slot_step" class="wpbc_ui_control wpbc_ui_select">
						<?php wpbc_availability_timeslots__render_slot_step_options( $slot_step ); ?>
					</select>
					<?php wpbc_availability_timeslots__render_zoom_control( $ids['zoom'], $slot_step ); ?>
				</div>

				<div class="wpbc_ts_control wpbc_ts_control_time_range">
					<label><?php esc_html_e( 'Visible time', 'booking' ); ?></label>
					<div class="wpbc_ts_time_inputs">
						<select id="<?php echo esc_attr( $ids['day_start'] ); ?>" data-wpbc-ts-control="day_start" class="wpbc_ui_control wpbc_ui_select" aria-label="<?php esc_attr_e( 'Start time', 'booking' ); ?>">
							<?php echo wpbc_availability_timeslots__get_time_options( $visible_start_minutes ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
						</select>
						<select id="<?php echo esc_attr( $ids['day_end'] ); ?>" data-wpbc-ts-control="day_end" class="wpbc_ui_control wpbc_ui_select" aria-label="<?php esc_attr_e( 'End time', 'booking' ); ?>">
							<?php echo wpbc_availability_timeslots__get_time_options( $visible_end_minutes ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
						</select>
					</div>
					<div class="wpbc_ts_dual_slider">
						<input id="<?php echo esc_attr( $ids['day_start_slider'] ); ?>" data-wpbc-ts-control="day_start_slider" type="range" min="0" max="1440" step="60" value="<?php echo esc_attr( $visible_start_minutes ); ?>" aria-label="<?php esc_attr_e( 'Start time', 'booking' ); ?>" />
						<input id="<?php echo esc_attr( $ids['day_end_slider'] ); ?>" data-wpbc-ts-control="day_end_slider" type="range" min="0" max="1440" step="60" value="<?php echo esc_attr( $visible_end_minutes ); ?>" aria-label="<?php esc_attr_e( 'End time', 'booking' ); ?>" />
					</div>
				</div>

				<?php if ( $args['show_toolbar_actions'] ) : ?>
					<div class="wpbc_ts_toolbar_actions">
						<?php wpbc_availability_timeslots__render_action_buttons( 'wpbc_ts_action_buttons_inline' ); ?>
					</div>
				<?php endif; ?>
			</div>
		<?php endif; ?>

		<?php if ( $args['show_hint'] ) : ?>
			<div class="wpbc_ts_hint">
				<span class="wpbc_icn_info_outline"></span>
				<?php esc_html_e( 'Click and drag across the timeline to select slots. Drag selection ends to adjust the time range.', 'booking' ); ?>
			</div>
		<?php endif; ?>

		<div class="wpbc_ts_timeline_card">
			<div class="wpbc_ts_loading_overlay" aria-live="polite" aria-hidden="true">
				<div class="wpbc_spins_loading_container wpbc_bfb_spins_loading_container">
					<div class="wpbc_booking_form_spin_loader">
						<div class="wpbc_spins_loader_wrapper">
							<div class="wpbc_one_spin_loader_mini2"></div>
						</div>
					</div>
					<span><?php esc_html_e( 'Loading', 'booking' ); ?>...</span>
				</div>
			</div>
			<div class="wpbc_ts_grid"
				data-wpbc-ts-start="<?php echo esc_attr( $visible_start_minutes ); ?>"
				data-wpbc-ts-end="<?php echo esc_attr( $visible_end_minutes ); ?>"
				data-wpbc-ts-step="<?php echo esc_attr( $slot_step ); ?>">
				<div class="wpbc_ts_header">
					<div class="wpbc_ts_axis_corner">
						<div><?php esc_html_e( 'Time', 'booking' ); ?></div>
						<div><?php esc_html_e( 'Date', 'booking' ); ?></div>
					</div>
					<div class="wpbc_ts_time_axis" aria-hidden="true"></div>
				</div>

				<div class="wpbc_ts_rows">
					<?php foreach ( $rows as $row_index => $row ) : ?>
						<div class="wpbc_ts_row" data-wpbc-ts-row="<?php echo esc_attr( $row_index ); ?>" data-wpbc-ts-date="<?php echo esc_attr( $row['date'] ); ?>">
							<div class="wpbc_ts_row_label">
								<span class="wpbc_ts_row_label_text"><?php echo esc_html( $row['label'] ); ?></span>
								<?php // TODO: add later extended row actions menu! ?>
								<!--a href="javascript:void(0)" class="wpbc_ts_row_menu" aria-label="<?php esc_attr_e( 'Row actions', 'booking' ); ?>">...</a-->
							</div>
							<div class="wpbc_ts_lane" tabindex="0">
								<div class="wpbc_ts_available_rail"></div>
								<div class="wpbc_ts_selection wpbc_ts_selection_template" hidden="hidden">
									<span class="wpbc_ts_time_chip wpbc_ts_time_chip_start">00:00</span>
									<span class="wpbc_ts_time_chip wpbc_ts_time_chip_end">00:00</span>
									<span class="wpbc_ts_handle wpbc_ts_handle_start"></span>
									<span class="wpbc_ts_handle wpbc_ts_handle_end"></span>
								</div>
							</div>
						</div>
					<?php endforeach; ?>
				</div>
			</div>

			<?php if ( $args['show_legend'] ) : ?>
				<div class="wpbc_ts_legend">
					<span><i class="wpbc_ts_legend_available"></i><?php esc_html_e( 'Available', 'booking' ); ?></span>
					<span><i class="wpbc_ts_legend_booked"><span class="wpbc_icn_lock"></span></i><?php esc_html_e( 'Booked', 'booking' ); ?></span>
					<span><i class="wpbc_ts_legend_blocked"><span class="wpbc_icn_do_not_disturb_on"></span></i><?php esc_html_e( 'Blocked', 'booking' ); ?></span>
					<span><i class="wpbc_ts_legend_unavailable_day"><span class="wpbc_icn_event_busy"></span></i><?php esc_html_e( 'Unavailable day', 'booking' ); ?></span>
					<span><i class="wpbc_ts_legend_working_time"><span class="wpbc-bi-clock-history"></span></i><?php esc_html_e( 'Outside working time', 'booking' ); ?></span>
					<span><i class="wpbc_ts_legend_selected"></i><?php esc_html_e( 'Selected pending changes', 'booking' ); ?></span>
					<span class="wpbc_ts_legend_note"><span class="wpbc_icn_info_outline"></span><?php esc_html_e( 'Booked slots and availability rules cannot be changed here.', 'booking' ); ?></span>
				</div>
			<?php endif; ?>
		</div>
	</div>
	<?php
}

/**
 * Time Slots Availability tab.
 */
class WPBC_Page_TimeSlots_Availability extends WPBC_Page_Structure {

	/**
	 * Menu slug.
	 *
	 * @return string
	 */
	public function in_page() {
		return 'wpbc-availability';
	}

	/**
	 * Register tab.
	 *
	 * @return array
	 */
	public function tabs() {

		$tabs = array();
		$tabs['time_slots_availability'] = array(
			'is_show_top_path'                          => true,
			'right_vertical_sidebar__is_show'           => true,
			'right_vertical_sidebar__default_view_mode' => '',
			'right_vertical_sidebar_compact__is_show'   => true,
			'left_navigation__default_view_mode'        => 'compact',
			'top_path_title'                            => __( 'Time Slots Availability', 'booking' ),
			'title'                                     => __( 'Time Slots Availability', 'booking' ).                            // Title of TAB.
														   '<span class="wpbc_new_label" style="margin-left: auto;">' . esc_html__( 'New', 'booking' ) . '</span>',
			'hint'                                      => __( 'Flexible blocking time-slot ranges.', 'booking' ),
			'page_title'                                => __( 'Time Slots Availability', 'booking' ),
			'link'                                      => '',
			'position'                                  => '',
			'css_classes'                               => '',
			'icon'                                      => '',
			'font_icon'                                 => 'wpbc-bi-clock-history',
			// 'font_icon_right'                           => 'wpbc-bi-question-circle',  //.
			'font_icon_right'                           => '',
			'default'                                   => false,
			'disabled'                                  => false,
			'hided'                                     => false,
			'subtabs'                                   => array(),
			'folder_style'                              => 'order:92;',
			'is_show_top_navigation'             => true,
		);

		return $tabs;
	}

	/**
	 * Right compact sidebar tabs.
	 *
	 * @return void
	 */
	public function right_sidebar_compact_content() {

		WPBC_UI_Sidebar_Panels::render_rightbar_tabs(
			array(
				array(
					'id'       => 'wpbc_tab_ts_summary',
					'panel_id' => 'wpbc_ts__inspector_summary',
					'title'    => __( 'Selection', 'booking' ),
					'icon'     => 'wpbc-bi-check2-circle',
					'selected' => true,
				),
				array(
					'id'       => 'wpbc_tab_ts_settings',
					'panel_id' => 'wpbc_ts__inspector_settings',
					'title'    => __( 'Settings', 'booking' ),
					'icon'     => 'wpbc_icn_tune',
				),
			),
			array(
				'aria_label' => __( 'Time Slots Availability Panels', 'booking' ),
				'context'    => 'time_slots_availability',
				'class'      => 'wpbc_ts_rightbar_tabs',
			)
		);
	}

	/**
	 * Right sidebar panels.
	 *
	 * @return void
	 */
	public function right_sidebar_content() {
		?>
		<div class="wpbc_bfb__panel--library wpbc_rightbar_palette wpbc_ts_rightbar_panels">
			<?php
			WPBC_UI_Sidebar_Panels::render_panel(
				array(
					'id'         => 'wpbc_ts__inspector_summary',
					'labelledby' => 'wpbc_tab_ts_summary',
					'class'      => 'wpbc_ts__inspector_summary',
				),
				array( $this, 'right_panel_summary_content' )
			);

			WPBC_UI_Sidebar_Panels::render_panel(
				array(
					'id'         => 'wpbc_ts__inspector_settings',
					'labelledby' => 'wpbc_tab_ts_settings',
					'class'      => 'wpbc_ts__inspector_settings',
					'hidden'     => true,
				),
				array( $this, 'right_panel_settings_content' )
			);
			?>
		</div>
		<?php
	}

	/**
	 * Summary panel content.
	 *
	 * @return void
	 */
	public function right_panel_summary_content() {

		WPBC_UI_Sidebar_Panels::render_inspector_header( __( 'Selection', 'booking' ), __( 'Review selected time slots, then block or unblock them.', 'booking' ) );
		?>
		<div class="wpbc_bfb__inspector__body wpbc_ts_inspector_body">
			<?php
			WPBC_UI_Sidebar_Panels::render_collapsible_group(
				array(
					'id'    => 'wpbc_ts_action_group',
					'group' => 'time-slots-actions',
					'title' => __( 'Selected Time Slots', 'booking' ),
					'open'  => true,
				),
				function () {
					?>
					<?php wpbc_availability_timeslots__render_action_buttons(); ?>
					<div class="wpbc_ts_inspector_row row__bordered">
						<div class="wpbc_ts_inspector_label"><?php esc_html_e( 'Slots selected', 'booking' ); ?></div>
						<div class="wpbc_ts_inspector_value"><strong data-wpbc-ts-detail="slots">0</strong></div>
						<div class="wpbc_ts_inspector_row">
							<div class="wpbc_ts_inspector_label"><?php esc_html_e( 'Dates', 'booking' ); ?></div>
							<div class="wpbc_ts_inspector_value" data-wpbc-ts-detail="dates">-</div>
						</div>
						<div class="wpbc_ts_inspector_row">
							<div class="wpbc_ts_inspector_label"><?php esc_html_e( 'Time', 'booking' ); ?></div>
							<div class="wpbc_ts_inspector_value" data-wpbc-ts-detail="time">-</div>
						</div>
					</div>
					<div class="wpbc_ts_selection_details" data-wpbc-ts-detail="selection_list">
						<div class="wpbc_ts_selection_details_empty"><?php esc_html_e( 'No time slots selected.', 'booking' ); ?></div>
					</div>
					<?php
				}
			);
			?>
		</div>
		<?php
	}

	/**
	 * Settings panel content.
	 *
	 * @return void
	 */
	public function right_panel_settings_content() {
		$visible_start_minutes = 360;
		$visible_end_minutes   = 1320;

		WPBC_UI_Sidebar_Panels::render_inspector_header( __( 'Timeline Settings', 'booking' ), __( 'Control the visible time window and selection precision.', 'booking' ) );
		?>
		<div class="wpbc_bfb__inspector__body wpbc_ts_inspector_body">
			<?php
			WPBC_UI_Sidebar_Panels::render_collapsible_group(
				array(
					'id'    => 'wpbc_ts_date_range_group',
					'group' => 'time-slots-date-range',
					'title' => __( 'Date Range', 'booking' ),
					'open'  => true,
				),
				function () {
					?>
					<div class="wpbc_ts_inspector_row">
						<div class="wpbc_ts_inspector_label"><?php esc_html_e( 'Scroll range', 'booking' ); ?></div>
						<div class="wpbc_ts_inspector_value">
							<div class="wpbc_ts_range_nav wpbc_ts_range_nav_sidebar">
								<a href="javascript:void(0)"
									class="button tooltip_top button-secondary wpbc_button_no_background wpbc_ts_range_nav_button"
									data-wpbc-ts-range-shift="prev"
									aria-label="<?php esc_attr_e( 'Previous date range', 'booking' ); ?>"
									data-original-title="<?php esc_attr_e( 'Previous date range', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc_icn_keyboard_arrow_left"></i><span class="in-button-text"></span></a>
								<a href="javascript:void(0)"
									class="button tooltip_top button-secondary wpbc_button_no_background wpbc_ts_range_nav_button"
									data-wpbc-ts-range-shift="next"
									aria-label="<?php esc_attr_e( 'Next date range', 'booking' ); ?>"
									data-original-title="<?php esc_attr_e( 'Next date range', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc_icn_keyboard_arrow_right"></i><span class="in-button-text"></span></a>
							</div>
						</div>
					</div>
					<?php
				}
			);

			WPBC_UI_Sidebar_Panels::render_collapsible_group(
				array(
					'id'    => 'wpbc_ts_slot_precision_group',
					'group' => 'time-slots-precision',
					'title' => __( 'Time Step & Zoom', 'booking' ),
					'open'  => true,
				),
				function () {
					?>
					<div class="wpbc_ts_inspector_row">
						<label class="wpbc_ts_inspector_label" for="wpbc_ts_side_slot_step"><?php esc_html_e( 'Slot step', 'booking' ); ?></label>
						<div class="wpbc_ts_inspector_value">
							<select id="wpbc_ts_side_slot_step" class="wpbc_ts_inspector_select">
								<?php wpbc_availability_timeslots__render_slot_step_options( 15 ); ?>
							</select>
						</div>
					</div>
					<div class="wpbc_ts_inspector_row">
						<div class="wpbc_ts_inspector_label"><?php esc_html_e( 'Zoom', 'booking' ); ?></div>
						<div class="wpbc_ts_inspector_value">
							<?php wpbc_availability_timeslots__render_zoom_control( 'wpbc_ts_side_zoom', 15, 'side_zoom' ); ?>
						</div>
					</div>
					<?php
				}
			);

			WPBC_UI_Sidebar_Panels::render_collapsible_group(
				array(
					'id'    => 'wpbc_ts_time_window_group',
					'group' => 'time-slots-visible-window',
					'title' => __( 'Visible Time Range', 'booking' ),
					'open'  => true,
				),
				function () use ( $visible_start_minutes, $visible_end_minutes ) {
					?>
					<div class="wpbc_ts_inspector_row">
						<label class="wpbc_ts_inspector_label" for="wpbc_ts_side_start"><?php esc_html_e( 'Start time', 'booking' ); ?></label>
						<div class="wpbc_ts_inspector_value">
							<select id="wpbc_ts_side_start" class="wpbc_ts_inspector_select">
								<?php echo wpbc_availability_timeslots__get_time_options( $visible_start_minutes ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
							</select>
						</div>
					</div>
					<div class="wpbc_ts_inspector_row">
						<label class="wpbc_ts_inspector_label" for="wpbc_ts_side_end"><?php esc_html_e( 'End time', 'booking' ); ?></label>
						<div class="wpbc_ts_inspector_value">
							<select id="wpbc_ts_side_end" class="wpbc_ts_inspector_select">
								<?php echo wpbc_availability_timeslots__get_time_options( $visible_end_minutes ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
							</select>
						</div>
					</div>
					<div class="wpbc_ts_inspector_row">
						<div class="wpbc_ts_inspector_label"><?php esc_html_e( 'Visible range', 'booking' ); ?></div>
						<div class="wpbc_ts_inspector_value">
							<div class="wpbc_ts_dual_slider">
								<input id="wpbc_ts_side_start_slider" type="range" min="0" max="1440" step="60" value="<?php echo esc_attr( $visible_start_minutes ); ?>" aria-label="<?php esc_attr_e( 'Start time', 'booking' ); ?>" />
								<input id="wpbc_ts_side_end_slider" type="range" min="0" max="1440" step="60" value="<?php echo esc_attr( $visible_end_minutes ); ?>" aria-label="<?php esc_attr_e( 'End time', 'booking' ); ?>" />
							</div>
						</div>
					</div>
					<?php
				}
			);
			// TODO: add later Advanced Options.
			if ( 0 )
			WPBC_UI_Sidebar_Panels::render_collapsible_group(
				array(
					'id'    => 'wpbc_ts_future_group',
					'group' => 'time-slots-future-settings',
					'title' => __( 'Advanced Options', 'booking' ),
				),
				function () {
					?>
					<div class="wpbc_ts_inspector_row row__bordered">
						<div class="wpbc_ts_inspector_label"><?php esc_html_e( 'Extension area', 'booking' ); ?></div>
						<div class="wpbc_ts_inspector_value"><?php esc_html_e( 'Rules, copy tools, templates, and resource constraints can be added here later.', 'booking' ); ?></div>
					</div>
					<?php
				}
			);
			?>
		</div>
		<?php
	}

	/**
	 * Show page content.
	 *
	 * @return void|false
	 */
	public function content() {

		do_action( 'wpbc_hook_settings_page_header', 'page_booking_availability_timeslots' );

		if ( ! wpbc_is_mu_user_can_be_here( 'activated_user' ) ) {
			return false;
		}

		wpbc_availability_timeslots__render_timeline_component();

		do_action( 'wpbc_hook_settings_page_footer', 'page_booking_availability_timeslots' );
	}
}
add_action( 'wpbc_menu_created', array( new WPBC_Page_TimeSlots_Availability(), '__construct' ) );
