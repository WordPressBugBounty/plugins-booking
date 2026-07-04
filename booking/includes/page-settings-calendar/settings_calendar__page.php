<?php
/**
 * Calendar settings page.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Check whether the Calendar settings page is active.
 *
 * @return bool
 */
function wpbc_settings_calendar__is_page() {

	if ( ! is_admin() ) {
		return false;
	}

	if ( function_exists( 'wpbc_is_settings_calendar_page' ) ) {
		return wpbc_is_settings_calendar_page();
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$page = isset( $_REQUEST['page'] ) ? sanitize_key( wp_unslash( $_REQUEST['page'] ) ) : '';
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$tab = isset( $_REQUEST['tab'] ) ? sanitize_key( wp_unslash( $_REQUEST['tab'] ) ) : '';

	return ( 'wpbc-settings' === $page && 'calendar_settings' === $tab );
}

/**
 * Enqueue CSS for Calendar settings.
 *
 * @param string $where_to_load Where assets are loaded.
 *
 * @return void
 */
function wpbc_settings_calendar_enqueue_css_files( $where_to_load ) {

	if ( ( ! is_admin() ) || ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) ) ) {
		return;
	}

	if ( ! wpbc_settings_calendar__is_page() ) {
		return;
	}

	wp_enqueue_style(
		'wpbc-settings-calendar-page',
		trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/settings_calendar_page.css',
		array( 'wpbc-calendar', 'wpbc-all-admin' ),
		WP_BK_VERSION_NUM
	);
}
add_action( 'wpbc_enqueue_css_files', 'wpbc_settings_calendar_enqueue_css_files', 66 );

/**
 * Enqueue JS for Calendar settings.
 *
 * @param string $where_to_load Where assets are loaded.
 *
 * @return void
 */
function wpbc_settings_calendar_enqueue_js_files( $where_to_load ) {

	if ( ( ! is_admin() ) || ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) ) ) {
		return;
	}

	if ( ! wpbc_settings_calendar__is_page() ) {
		return;
	}

	wp_enqueue_script(
		'wpbc-settings-calendar-page',
		trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/settings_calendar_page.js',
		array( 'jquery', 'wpbc_all' ),
		WP_BK_VERSION_NUM,
		array( 'in_footer' => WPBC_JS_IN_FOOTER )
	);

	wp_localize_script(
		'wpbc-settings-calendar-page',
		'wpbc_settings_calendar_page',
		array(
			'ajax_url'       => admin_url( 'admin-ajax.php' ),
			'nonce'          => wp_create_nonce( 'wpbc_settings_calendar_ajax_nonce' ),
			'action'         => 'WPBC_AJX_SETTINGS_CALENDAR_SAVE',
			'preview_action' => 'WPBC_AJX_SETTINGS_CALENDAR_PREVIEW',
			'settings'       => wpbc_settings_calendar__get_settings_response(),
			'days_selection' => wpbc_settings_calendar__get_days_selection_response(),
			'open_section'   => wpbc_settings_calendar__get_open_section(),
			'section_groups' => wpbc_settings_calendar__get_section_group_map(),
			'section_menus'  => wpbc_settings_calendar__get_section_menu_slug_map(),
			'i18n'           => array(
				'saving'         => __( 'Saving', 'booking' ),
				'saved'          => __( 'Calendar settings updated.', 'booking' ),
				'save_failed'    => __( 'Unable to save calendar settings.', 'booking' ),
				'preview_failed' => __( 'Unable to refresh calendar preview.', 'booking' ),
				'loading'        => __( 'Loading', 'booking' ),
				'premium_notice' => __( 'Range days selection is available in Booking Calendar Business Small or higher. Open the live demo to test the real behavior.', 'booking' ),
				'premium_changeover_notice' => __( 'Changeover days are available in Booking Calendar Business Small or higher. Open the live demo to test the real behavior.', 'booking' ),
				'premium_option_notice' => __( 'This option is available in Booking Calendar Business Small or higher.', 'booking' ),
			),
			'is_range_supported' => wpbc_settings_calendar__is_range_supported() ? 1 : 0,
		)
	);
}
add_action( 'wpbc_enqueue_js_files', 'wpbc_settings_calendar_enqueue_js_files', 66 );

/**
 * Print tooltip initializer for Calendar settings.
 *
 * @return void
 */
function wpbc_settings_calendar_print_tooltip_js() {

	if ( ! wpbc_settings_calendar__is_page() ) {
		return;
	}

	if ( function_exists( 'wpbc_bs_javascript_tooltips' ) ) {
		wpbc_bs_javascript_tooltips();
	}
}
add_action( 'admin_footer', 'wpbc_settings_calendar_print_tooltip_js', 67 );

/**
 * Check whether current edition supports range/change-over calendar settings.
 *
 * @return bool
 */
function wpbc_settings_calendar__is_range_supported() {

	return class_exists( 'wpdev_bk_biz_s' );
}

/**
 * Calendar settings right-sidebar section navigation.
 *
 * @return array
 */
function wpbc_settings_calendar__get_section_navigation_items() {

	return array(
		'days_selection'   => array(
			'menu_slug' => 'calendar_days_selection',
			'group'     => 'settings-calendar-days-selection',
			'title'     => __( 'Days Selection', 'booking' ),
			'hint'      => __( 'Choose how users can select days: single day, multiple days, or date range.', 'booking' ),
			'font_icon' => 'wpbc-bi-calendar3-week',
		),
		'changeover_times' => array(
			'menu_slug' => 'calendar_changeover_times',
			'group'     => 'settings-calendar-time',
			'title'     => __( 'Changeover and Times', 'booking' ),
			'hint'      => __( 'Configure changeover days, recurrent time, and changeover exceptions.', 'booking' ),
			'font_icon' => 'wpbc_icn_flip',
		),
		'legend'           => array(
			'menu_slug' => 'calendar_legend',
			'group'     => 'settings-calendar-legend',
			'title'     => __( 'Calendar Legend', 'booking' ),
			'hint'      => __( 'Show or hide the calendar legend and configure each legend item.', 'booking' ),
			'font_icon' => 'wpbc-bi-list-check',
		),
		'tooltips'         => array(
			'menu_slug' => 'calendar_tooltips',
			'group'     => 'settings-calendar-tooltips',
			'title'     => __( 'Calendar Dates Tooltips', 'booking' ),
			'hint'      => __( 'Configure mouse-over tooltips for booked times, availability, cost, and booking details.', 'booking' ),
			'font_icon' => 'wpbc-bi-chat-square-dots',
		),
		'general'          => array(
			'menu_slug' => 'calendar_general',
			'group'     => 'settings-calendar-general',
			'title'     => __( 'Calendar General', 'booking' ),
			'hint'      => __( 'Configure month scrolling, week start day, and mobile month display.', 'booking' ),
			'font_icon' => 'wpbc-bi-calendar2-range',
		),
	);
}

/**
 * Get section key to left-menu slug map for scripts.
 *
 * @return array
 */
function wpbc_settings_calendar__get_section_menu_slug_map() {

	$section_menus = array();

	foreach ( wpbc_settings_calendar__get_section_navigation_items() as $section_key => $section ) {
		$section_menus[ $section_key ] = $section['menu_slug'];
	}

	return $section_menus;
}

/**
 * Get section key to collapsible group map for scripts.
 *
 * @return array
 */
function wpbc_settings_calendar__get_section_group_map() {

	$section_groups = array();

	foreach ( wpbc_settings_calendar__get_section_navigation_items() as $section_key => $section ) {
		$section_groups[ $section_key ] = $section['group'];
	}

	return $section_groups;
}

/**
 * Get URL to the Calendar settings page with a right-sidebar section selected.
 *
 * @param string $section Section key.
 * @return string
 */
function wpbc_settings_calendar__get_section_url( $section ) {

	$sections = wpbc_settings_calendar__get_section_navigation_items();
	$base_url = function_exists( 'wpbc_get_settings_calendar_url' )
		? wpbc_get_settings_calendar_url()
		: admin_url( 'admin.php?page=wpbc-settings&tab=calendar_settings' );

	if ( empty( $sections[ $section ] ) ) {
		return $base_url;
	}

	return add_query_arg(
		array(
			'wpbc_calendar_section' => $section,
		),
		$base_url
	);
}

/**
 * Get the Calendar settings section that should be opened on page load.
 *
 * @return string
 */
function wpbc_settings_calendar__get_open_section() {

	$sections = wpbc_settings_calendar__get_section_navigation_items();

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$open_section = isset( $_REQUEST['wpbc_calendar_section'] ) ? sanitize_key( wp_unslash( $_REQUEST['wpbc_calendar_section'] ) ) : '';

	if ( isset( $sections[ $open_section ] ) ) {
		return $open_section;
	}

	return '';
}

/**
 * Adjust the universal top path for Calendar section URLs.
 *
 * Calendar sections use wpbc_calendar_section instead of the reserved subtab
 * parameter, so we map the active section into the shared top path here.
 *
 * @param array               $items              Top path items.
 * @param WPBC_Page_Structure $page_structure_obj Page structure object.
 * @param array               $top_path_config    Top path config.
 *
 * @return array
 */
function wpbc_settings_calendar__top_path_items( $items, $page_structure_obj, $top_path_config ) {

	if ( ! is_object( $page_structure_obj ) || ! method_exists( $page_structure_obj, 'get_current_page_params' ) ) {
		return $items;
	}

	$current_page_params = $page_structure_obj->get_current_page_params();
	if ( empty( $current_page_params['tab']['tag'] ) || 'calendar_settings' !== $current_page_params['tab']['tag'] ) {
		return $items;
	}

	$sections    = wpbc_settings_calendar__get_section_navigation_items();
	$section_key = wpbc_settings_calendar__get_open_section();
	if ( empty( $section_key ) ) {
		$section_key = 'days_selection';
	}

	if ( empty( $sections[ $section_key ]['title'] ) ) {
		return $items;
	}

	foreach ( $items as $item_index => $item ) {
		$items[ $item_index ]['active'] = false;
	}

	if ( ! empty( $items ) ) {
		$last_item_index = count( $items ) - 1;
		$section_titles  = array_map( 'wp_strip_all_tags', wp_list_pluck( $sections, 'title' ) );
		$last_title      = isset( $items[ $last_item_index ]['title'] ) ? wp_strip_all_tags( $items[ $last_item_index ]['title'] ) : '';

		if ( in_array( $last_title, $section_titles, true ) ) {
			array_pop( $items );
		}
	}

	$items[] = array(
		'title'   => $sections[ $section_key ]['title'],
		'url'     => wpbc_settings_calendar__get_section_url( $section_key ),
		'onclick' => '',
		'active'  => true,
	);

	return $items;
}
add_filter( 'wpbc_ui_settings_top_path_items', 'wpbc_settings_calendar__top_path_items', 10, 3 );

/**
 * Manage capability.
 *
 * @return string
 */
function wpbc_settings_calendar__get_manage_cap() {

	$min_user_role = get_bk_option( 'booking_user_role_settings' );
	$capability    = array(
		'administrator' => 'activate_plugins',
		'editor'        => 'publish_pages',
		'author'        => 'publish_posts',
		'contributor'   => 'edit_posts',
		'subscriber'    => 'read',
	);

	return isset( $capability[ $min_user_role ] ) ? $capability[ $min_user_role ] : 'manage_options';
}

/**
 * Get booking resources for preview toolbar.
 *
 * @return array
 */
function wpbc_settings_calendar__get_resources() {

	if ( function_exists( 'wpbc_settings_themes__get_resources' ) ) {
		return wpbc_settings_themes__get_resources();
	}

	return array(
		array(
			'id'    => 1,
			'title' => __( 'Default booking resource', 'booking' ),
		),
	);
}

/**
 * Sanitize preview resource ID.
 *
 * @param int|string $resource_id Resource ID.
 *
 * @return int
 */
function wpbc_settings_calendar__sanitize_preview_resource_id( $resource_id ) {

	if ( function_exists( 'wpbc_settings_themes__sanitize_preview_resource_id' ) ) {
		return wpbc_settings_themes__sanitize_preview_resource_id( $resource_id );
	}

	return max( 1, absint( $resource_id ) );
}

/**
 * Sanitize preview months count.
 *
 * @param int|string $months_count Months count.
 *
 * @return int
 */
function wpbc_settings_calendar__sanitize_preview_months_count( $months_count ) {

	$months_count = absint( $months_count );
	$allowed      = array( 1, 2, 3, 4, 6, 12 );

	return in_array( $months_count, $allowed, true ) ? $months_count : 3;
}

/**
 * Get preview resource ID.
 *
 * @return int
 */
function wpbc_settings_calendar__get_preview_resource_id() {

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$resource_id = isset( $_GET['resource_id'] ) ? absint( wp_unslash( $_GET['resource_id'] ) ) : 1;

	return wpbc_settings_calendar__sanitize_preview_resource_id( $resource_id );
}

/**
 * Get preview months count.
 *
 * @return int
 */
function wpbc_settings_calendar__get_preview_months_count() {

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$months_count = isset( $_GET['months_count'] ) ? absint( wp_unslash( $_GET['months_count'] ) ) : 2;

	return wpbc_settings_calendar__sanitize_preview_months_count( $months_count );
}

/**
 * Get week day labels.
 *
 * @return array
 */
function wpbc_settings_calendar__get_weekday_options() {

	return array(
		'0' => __( 'Sunday', 'booking' ),
		'1' => __( 'Monday', 'booking' ),
		'2' => __( 'Tuesday', 'booking' ),
		'3' => __( 'Wednesday', 'booking' ),
		'4' => __( 'Thursday', 'booking' ),
		'5' => __( 'Friday', 'booking' ),
		'6' => __( 'Saturday', 'booking' ),
	);
}

/**
 * Get maximum scroll options.
 *
 * @return array
 */
function wpbc_settings_calendar__get_max_month_options() {

	$options = array();

	for ( $mm = 1; $mm < 12; $mm++ ) {
		$options[ $mm . 'm' ] = $mm . ' ' . __( 'month(s)', 'booking' );
	}
	$options['18m'] = '18 ' . __( 'month(s)', 'booking' );
	for ( $yy = 1; $yy < 11; $yy++ ) {
		$options[ $yy . 'y' ] = $yy . ' ' . __( 'year(s)', 'booking' );
	}

	return $options;
}

/**
 * Get time options in 15 minute steps while preserving saved values.
 *
 * @param string $current Current time.
 *
 * @return array
 */
function wpbc_settings_calendar__get_time_options( $current = '' ) {

	$options = array();

	for ( $hh = 0; $hh < 24; $hh++ ) {
		foreach ( array( 0, 15, 30, 45 ) as $mm ) {
			$time             = sprintf( '%02d:%02d', $hh, $mm );
			$options[ $time ] = function_exists( 'wpbc_time_localized' ) ? wpbc_time_localized( $time ) : $time;
		}
	}

	if ( '' !== $current && ! isset( $options[ $current ] ) && preg_match( '/^\d{2}:\d{2}$/', $current ) ) {
		$options[ $current ] = function_exists( 'wpbc_time_localized' ) ? wpbc_time_localized( $current ) : $current;
		ksort( $options );
	}

	return $options;
}

/**
 * Get configurable legend item options.
 *
 * @return array
 */
function wpbc_settings_calendar__get_legend_items_config() {

	return array(
		'available'   => array(
			'label'       => __( 'Available item', 'booking' ),
			'description' => sprintf( __( 'Activate and type your %1$stitle of available%2$s item in legend', 'booking' ), '<b>', '</b>' ),
			'placeholder' => __( 'Available', 'booking' ),
		),
		'pending'     => array(
			'label'       => __( 'Pending item', 'booking' ),
			'description' => sprintf( __( 'Activate and type your %1$stitle of pending%2$s item in legend', 'booking' ), '<b>', '</b>' ),
			'placeholder' => __( 'Pending', 'booking' ),
		),
		'approved'    => array(
			'label'       => __( 'Approved item', 'booking' ),
			'description' => sprintf( __( 'Activate and type your %1$stitle of approved%2$s item in legend', 'booking' ), '<b>', '</b>' ),
			'placeholder' => __( 'Booked', 'booking' ),
		),
		'partially'   => array(
			'label'       => __( 'Partially booked item', 'booking' ),
			'description' => sprintf( __( 'Activate and type your %1$stitle of partially booked%2$s item in legend', 'booking' ), '<b>', '</b>' ),
			'placeholder' => __( 'Partially booked', 'booking' ),
			'note'        => __( 'Partially booked item - day, which is booked for the specific time-slot(s).', 'booking' ),
		),
		'unavailable' => array(
			'label'       => __( 'Unavailable item', 'booking' ),
			'description' => sprintf( __( 'Activate and type your %1$stitle of unavailable%2$s item in legend', 'booking' ), '<b>', '</b>' ),
			'placeholder' => __( 'Unavailable', 'booking' ),
		),
	);
}

/**
 * Normalize week-day CSV.
 *
 * @param string|array $value Week days.
 *
 * @return string
 */
function wpbc_settings_calendar__normalize_week_days( $value ) {

	if ( is_array( $value ) ) {
		$items = $value;
	} else {
		$value = (string) $value;
		if ( '-1' === $value || '' === $value ) {
			return '-1';
		}
		$items = explode( ',', $value );
	}

	$cleaned = array();
	foreach ( $items as $item ) {
		$day = (string) absint( $item );
		if ( in_array( $day, array( '0', '1', '2', '3', '4', '5', '6' ), true ) ) {
			$cleaned[] = $day;
		}
	}

	$cleaned = array_values( array_unique( $cleaned ) );

	return empty( $cleaned ) ? '-1' : implode( ',', $cleaned );
}

/**
 * Get settings response.
 *
 * @return array
 */
function wpbc_settings_calendar__get_settings_response() {

	$settings = array(
		'booking_max_monthes_in_calendar'               => (string) get_bk_option( 'booking_max_monthes_in_calendar' ),
		'booking_start_day_weeek'                       => (string) get_bk_option( 'booking_start_day_weeek' ),
		'booking_calendar_allow_several_months_on_mobile' => (string) get_bk_option( 'booking_calendar_allow_several_months_on_mobile' ),
		'booking_type_of_day_selections'                => (string) get_bk_option( 'booking_type_of_day_selections' ),
		'booking_range_selection_type'                  => (string) get_bk_option( 'booking_range_selection_type' ),
		'booking_range_selection_days_count'            => (string) get_bk_option( 'booking_range_selection_days_count' ),
		'booking_range_start_day'                       => wpbc_settings_calendar__normalize_week_days( get_bk_option( 'booking_range_start_day' ) ),
		'booking_range_selection_days_count_dynamic'    => (string) get_bk_option( 'booking_range_selection_days_count_dynamic' ),
		'booking_range_selection_days_max_count_dynamic' => (string) get_bk_option( 'booking_range_selection_days_max_count_dynamic' ),
		'booking_range_selection_days_specific_num_dynamic' => (string) get_bk_option( 'booking_range_selection_days_specific_num_dynamic' ),
		'booking_range_start_day_dynamic'               => wpbc_settings_calendar__normalize_week_days( get_bk_option( 'booking_range_start_day_dynamic' ) ),
		'booking_recurrent_time'                        => (string) get_bk_option( 'booking_recurrent_time' ),
		'booking_last_checkout_day_available'           => (string) get_bk_option( 'booking_last_checkout_day_available' ),
		'booking_range_selection_time_is_active'        => (string) get_bk_option( 'booking_range_selection_time_is_active' ),
		'booking_range_selection_start_time'            => (string) get_bk_option( 'booking_range_selection_start_time' ),
		'booking_range_selection_end_time'              => (string) get_bk_option( 'booking_range_selection_end_time' ),
		'booking_change_over_days_triangles'            => (string) get_bk_option( 'booking_change_over_days_triangles' ),
		'booking_change_over__is_excerpt_on_pages'      => (string) get_bk_option( 'booking_change_over__is_excerpt_on_pages' ),
		'booking_change_over__excerpt_on_pages'         => (string) get_bk_option( 'booking_change_over__excerpt_on_pages' ),
		'booking_change_over__excerpt_bk_resources'     => (string) get_bk_option( 'booking_change_over__excerpt_bk_resources' ),
		'booking_is_show_legend'                        => (string) get_bk_option( 'booking_is_show_legend' ),
		'booking_legend_is_show_numbers'                => (string) get_bk_option( 'booking_legend_is_show_numbers' ),
		'booking_legend_is_vertical'                    => (string) get_bk_option( 'booking_legend_is_vertical' ),
		'booking_disable_timeslots_in_tooltip'          => (string) get_bk_option( 'booking_disable_timeslots_in_tooltip' ),
		'booking_highlight_timeslot_word'               => (string) get_bk_option( 'booking_highlight_timeslot_word' ),
	);

	foreach ( wpbc_settings_calendar__get_legend_items_config() as $legend_item => $legend_config ) {
		$settings[ 'booking_legend_is_show_item_' . $legend_item ]  = (string) get_bk_option( 'booking_legend_is_show_item_' . $legend_item );
		$settings[ 'booking_legend_text_for_item_' . $legend_item ] = (string) get_bk_option( 'booking_legend_text_for_item_' . $legend_item );
	}

	if ( class_exists( 'wpdev_bk_biz_l' ) ) {
		$settings['booking_is_show_availability_in_tooltips']          = (string) get_bk_option( 'booking_is_show_availability_in_tooltips' );
		$settings['booking_highlight_availability_word']               = (string) get_bk_option( 'booking_highlight_availability_word' );
		$settings['booking_is_show_availability_in_date_cell']         = (string) get_bk_option( 'booking_is_show_availability_in_date_cell' );
		$settings['booking_highlight_availability_word_in_date_cell']  = (string) get_bk_option( 'booking_highlight_availability_word_in_date_cell' );
	}

	if ( class_exists( 'wpdev_bk_biz_m' ) ) {
		$settings['booking_is_show_cost_in_tooltips']        = (string) get_bk_option( 'booking_is_show_cost_in_tooltips' );
		$settings['booking_highlight_cost_word']             = (string) get_bk_option( 'booking_highlight_cost_word' );
		$settings['booking_is_show_cost_in_date_cell']       = (string) get_bk_option( 'booking_is_show_cost_in_date_cell' );
		$settings['booking_cost_in_date_cell_currency']      = (string) get_bk_option( 'booking_cost_in_date_cell_currency' );
		$settings['booking_is_show_booked_data_in_tooltips'] = (string) get_bk_option( 'booking_is_show_booked_data_in_tooltips' );
		$settings['booking_booked_data_in_tooltips']         = (string) get_bk_option( 'booking_booked_data_in_tooltips' );
	}

	return $settings;
}

/**
 * Get normalized day-selection settings for the calendar JS.
 *
 * @param array $settings Optional settings.
 *
 * @return array
 */
function wpbc_settings_calendar__get_days_selection_response( $settings = array() ) {

	$current = wp_parse_args( $settings, wpbc_settings_calendar__get_settings_response() );

	$specific_days = ( function_exists( 'wpbc_get_specific_range_dates__as_comma_list' ) )
		? wpbc_get_specific_range_dates__as_comma_list( $current['booking_range_selection_days_specific_num_dynamic'] )
		: $current['booking_range_selection_days_specific_num_dynamic'];

	return array(
		'days_select_mode'         => ( 'range' === $current['booking_type_of_day_selections'] ) ? $current['booking_range_selection_type'] : $current['booking_type_of_day_selections'],
		'fixed__days_num'          => max( 1, absint( $current['booking_range_selection_days_count'] ) ),
		'fixed__week_days__start'  => wpbc_settings_calendar__normalize_week_days( $current['booking_range_start_day'] ),
		'dynamic__days_min'        => max( 1, absint( $current['booking_range_selection_days_count_dynamic'] ) ),
		'dynamic__days_max'        => max( 1, absint( $current['booking_range_selection_days_max_count_dynamic'] ) ),
		'dynamic__days_specific'   => (string) $specific_days,
		'dynamic__week_days__start' => wpbc_settings_calendar__normalize_week_days( $current['booking_range_start_day_dynamic'] ),
	);
}

/**
 * Check whether booked time slots should be shown in calendar tooltips.
 *
 * @param array $settings Calendar settings.
 *
 * @return bool
 */
function wpbc_settings_calendar__is_timeslots_tooltip_enabled( $settings ) {

	return ( 'On' !== (string) $settings['booking_disable_timeslots_in_tooltip'] );
}

/**
 * Override get_bk_option during preview rendering.
 *
 * @param mixed  $value   Current value.
 * @param string $option  Option name.
 * @param mixed  $default Default.
 *
 * @return mixed
 */
function wpbc_settings_calendar__preview_get_bk_option( $value, $option, $default ) {

	global $wpbc_settings_calendar__preview_options;

	if (
		is_array( $wpbc_settings_calendar__preview_options )
		&& array_key_exists( $option, $wpbc_settings_calendar__preview_options )
	) {
		return $wpbc_settings_calendar__preview_options[ $option ];
	}

	return $value;
}
add_bk_filter( 'wpdev_bk_get_option', 'wpbc_settings_calendar__preview_get_bk_option' );

/**
 * Override native WordPress options while Calendar Settings preview is active.
 *
 * This backs up the internal WPBC option filter for render paths that fall through
 * to get_option(), without saving preview values into the database.
 *
 * @param mixed  $pre_option Pre-option value.
 * @param string $option     Option name.
 * @param mixed  $default    Default option value.
 *
 * @return mixed
 */
function wpbc_settings_calendar__preview_get_wp_option( $pre_option, $option, $default ) {

	global $wpbc_settings_calendar__preview_options;

	if (
		is_array( $wpbc_settings_calendar__preview_options )
		&& array_key_exists( $option, $wpbc_settings_calendar__preview_options )
	) {
		return $wpbc_settings_calendar__preview_options[ $option ];
	}

	return $pre_option;
}

/**
 * Register native option preview filters for the current option set.
 *
 * @param array $preview_options Preview option overrides.
 *
 * @return void
 */
function wpbc_settings_calendar__preview_register_wp_option_filters( $preview_options ) {

	global $wpbc_settings_calendar__preview_wp_option_filters;

	if ( ! is_array( $preview_options ) ) {
		return;
	}

	if ( ! is_array( $wpbc_settings_calendar__preview_wp_option_filters ) ) {
		$wpbc_settings_calendar__preview_wp_option_filters = array();
	}

	foreach ( array_keys( $preview_options ) as $option_name ) {
		$option_name = (string) $option_name;
		if ( isset( $wpbc_settings_calendar__preview_wp_option_filters[ $option_name ] ) ) {
			continue;
		}
		add_filter( 'pre_option_' . $option_name, 'wpbc_settings_calendar__preview_get_wp_option', 10, 3 );
		$wpbc_settings_calendar__preview_wp_option_filters[ $option_name ] = true;
	}
}

/**
 * Activate Calendar Settings preview option overrides.
 *
 * @param array $preview_options Preview option overrides.
 *
 * @return array Previous preview context.
 */
function wpbc_settings_calendar__preview_options_push( $preview_options ) {

	global $wpbc_settings_calendar__preview_options;

	$previous_context = array(
		'is_set' => isset( $wpbc_settings_calendar__preview_options ),
		'value'  => isset( $wpbc_settings_calendar__preview_options ) ? $wpbc_settings_calendar__preview_options : null,
	);

	$wpbc_settings_calendar__preview_options = is_array( $preview_options ) ? $preview_options : array();

	// Re-append while preview is active so this override runs after edition/MU option filters.
	add_bk_filter( 'wpdev_bk_get_option', 'wpbc_settings_calendar__preview_get_bk_option' );

	wpbc_settings_calendar__preview_register_wp_option_filters( $wpbc_settings_calendar__preview_options );

	return $previous_context;
}

/**
 * Restore Calendar Settings preview option overrides.
 *
 * @param array $previous_context Previous preview context from wpbc_settings_calendar__preview_options_push().
 *
 * @return void
 */
function wpbc_settings_calendar__preview_options_pop( $previous_context ) {

	global $wpbc_settings_calendar__preview_options;

	if ( ! empty( $previous_context['is_set'] ) ) {
		$wpbc_settings_calendar__preview_options = $previous_context['value'];
	} else {
		unset( $wpbc_settings_calendar__preview_options );
	}
}

/**
 * Check whether a calendar-load AJAX request may use Calendar Settings preview overrides.
 *
 * @param array $request_params Calendar-load request params.
 *
 * @return bool
 */
function wpbc_settings_calendar__is_calendar_load_preview_request_allowed( $request_params ) {

	return (
		! empty( $request_params['wpbc_settings_calendar_preview'] )
		&& function_exists( 'wpbc_is_mu_user_can_be_here' )
		&& wpbc_is_mu_user_can_be_here( 'only_super_admin' )
		&& current_user_can( wpbc_settings_calendar__get_manage_cap() )
	);
}

/**
 * Get option overrides from Calendar Settings calendar-load AJAX request.
 *
 * @param array $request_params Calendar-load request params.
 *
 * @return array
 */
function wpbc_settings_calendar__get_calendar_load_preview_options( $request_params ) {

	$preview_options = array(
		'booking_range_selection_time_is_active' => isset( $request_params['wpbc_settings_calendar_preview_changeover'] ) ? $request_params['wpbc_settings_calendar_preview_changeover'] : 'Off',
		'booking_change_over_days_triangles'     => isset( $request_params['wpbc_settings_calendar_preview_triangles'] ) ? $request_params['wpbc_settings_calendar_preview_triangles'] : 'On',
		'booking_recurrent_time'                 => isset( $request_params['wpbc_settings_calendar_preview_recurrent_time'] ) ? $request_params['wpbc_settings_calendar_preview_recurrent_time'] : 'Off',
		'booking_last_checkout_day_available'    => isset( $request_params['wpbc_settings_calendar_preview_last_checkout'] ) ? $request_params['wpbc_settings_calendar_preview_last_checkout'] : 'Off',
		'booking_change_over__is_excerpt_on_pages' => isset( $request_params['wpbc_settings_calendar_preview_excerpt_on_pages'] ) ? $request_params['wpbc_settings_calendar_preview_excerpt_on_pages'] : 'Off',
		'booking_change_over__excerpt_on_pages'  => isset( $request_params['wpbc_settings_calendar_preview_excerpt_pages'] ) ? $request_params['wpbc_settings_calendar_preview_excerpt_pages'] : '',
		'booking_change_over__excerpt_bk_resources' => isset( $request_params['wpbc_settings_calendar_preview_excerpt_resources'] ) ? $request_params['wpbc_settings_calendar_preview_excerpt_resources'] : '',
		'booking_is_show_legend'                 => isset( $request_params['wpbc_settings_calendar_preview_show_legend'] ) ? $request_params['wpbc_settings_calendar_preview_show_legend'] : 'Off',
		'booking_legend_is_show_numbers'         => isset( $request_params['wpbc_settings_calendar_preview_legend_show_numbers'] ) ? $request_params['wpbc_settings_calendar_preview_legend_show_numbers'] : 'Off',
		'booking_legend_is_vertical'             => isset( $request_params['wpbc_settings_calendar_preview_legend_vertical'] ) ? $request_params['wpbc_settings_calendar_preview_legend_vertical'] : 'Off',
		'booking_disable_timeslots_in_tooltip'   => isset( $request_params['wpbc_settings_calendar_preview_disable_timeslots_tooltip'] ) ? $request_params['wpbc_settings_calendar_preview_disable_timeslots_tooltip'] : 'Off',
		'booking_highlight_timeslot_word'        => isset( $request_params['wpbc_settings_calendar_preview_timeslot_word'] ) ? $request_params['wpbc_settings_calendar_preview_timeslot_word'] : '',
	);

	foreach ( wpbc_settings_calendar__get_legend_items_config() as $legend_item => $legend_config ) {
		$preview_options[ 'booking_legend_is_show_item_' . $legend_item ]  = isset( $request_params[ 'wpbc_settings_calendar_preview_legend_show_' . $legend_item ] ) ? $request_params[ 'wpbc_settings_calendar_preview_legend_show_' . $legend_item ] : 'Off';
		$preview_options[ 'booking_legend_text_for_item_' . $legend_item ] = isset( $request_params[ 'wpbc_settings_calendar_preview_legend_text_' . $legend_item ] ) ? $request_params[ 'wpbc_settings_calendar_preview_legend_text_' . $legend_item ] : '';
	}

	if ( class_exists( 'wpdev_bk_biz_l' ) ) {
		$preview_options['booking_is_show_availability_in_tooltips']         = isset( $request_params['wpbc_settings_calendar_preview_show_availability_tooltip'] ) ? $request_params['wpbc_settings_calendar_preview_show_availability_tooltip'] : 'Off';
		$preview_options['booking_highlight_availability_word']              = isset( $request_params['wpbc_settings_calendar_preview_availability_word'] ) ? $request_params['wpbc_settings_calendar_preview_availability_word'] : '';
		$preview_options['booking_is_show_availability_in_date_cell']        = isset( $request_params['wpbc_settings_calendar_preview_show_availability_cell'] ) ? $request_params['wpbc_settings_calendar_preview_show_availability_cell'] : 'Off';
		$preview_options['booking_highlight_availability_word_in_date_cell'] = isset( $request_params['wpbc_settings_calendar_preview_availability_cell_word'] ) ? $request_params['wpbc_settings_calendar_preview_availability_cell_word'] : '';
	}

	if ( class_exists( 'wpdev_bk_biz_m' ) ) {
		$preview_options['booking_is_show_cost_in_tooltips']        = isset( $request_params['wpbc_settings_calendar_preview_show_cost_tooltip'] ) ? $request_params['wpbc_settings_calendar_preview_show_cost_tooltip'] : 'Off';
		$preview_options['booking_highlight_cost_word']             = isset( $request_params['wpbc_settings_calendar_preview_cost_word'] ) ? $request_params['wpbc_settings_calendar_preview_cost_word'] : '';
		$preview_options['booking_is_show_cost_in_date_cell']       = isset( $request_params['wpbc_settings_calendar_preview_show_cost_cell'] ) ? $request_params['wpbc_settings_calendar_preview_show_cost_cell'] : 'Off';
		$preview_options['booking_cost_in_date_cell_currency']      = isset( $request_params['wpbc_settings_calendar_preview_cost_currency'] ) ? $request_params['wpbc_settings_calendar_preview_cost_currency'] : '';
		$preview_options['booking_is_show_booked_data_in_tooltips'] = isset( $request_params['wpbc_settings_calendar_preview_show_booked_details'] ) ? $request_params['wpbc_settings_calendar_preview_show_booked_details'] : 'Off';
		$preview_options['booking_booked_data_in_tooltips']         = isset( $request_params['wpbc_settings_calendar_preview_booked_details'] ) ? $request_params['wpbc_settings_calendar_preview_booked_details'] : '';
	}

	return $preview_options;
}

/**
 * Get request overrides for the calendar-load AJAX generated inside Calendar Settings preview.
 *
 * @param array $current_settings Current preview settings.
 *
 * @return array
 */
function wpbc_settings_calendar__get_calendar_load_preview_request_overrides( $current_settings ) {

	$request_overrides = array(
		'wpbc_settings_calendar_preview'                   => 1,
		'wpbc_settings_calendar_preview_changeover'        => ( 'On' === (string) $current_settings['booking_range_selection_time_is_active'] ) ? 'On' : 'Off',
		'wpbc_settings_calendar_preview_triangles'         => ( 'Off' === (string) $current_settings['booking_change_over_days_triangles'] ) ? 'Off' : 'On',
		'wpbc_settings_calendar_preview_recurrent_time'    => ( 'On' === (string) $current_settings['booking_recurrent_time'] ) ? 'On' : 'Off',
		'wpbc_settings_calendar_preview_last_checkout'     => ( 'On' === (string) $current_settings['booking_last_checkout_day_available'] ) ? 'On' : 'Off',
		'wpbc_settings_calendar_preview_excerpt_on_pages'  => ( 'On' === (string) $current_settings['booking_change_over__is_excerpt_on_pages'] ) ? 'On' : 'Off',
		'wpbc_settings_calendar_preview_excerpt_pages'     => (string) $current_settings['booking_change_over__excerpt_on_pages'],
		'wpbc_settings_calendar_preview_excerpt_resources' => (string) $current_settings['booking_change_over__excerpt_bk_resources'],
		'wpbc_settings_calendar_preview_show_legend'       => ( 'On' === (string) $current_settings['booking_is_show_legend'] ) ? 'On' : 'Off',
		'wpbc_settings_calendar_preview_legend_show_numbers' => ( 'On' === (string) $current_settings['booking_legend_is_show_numbers'] ) ? 'On' : 'Off',
		'wpbc_settings_calendar_preview_legend_vertical'   => ( 'On' === (string) $current_settings['booking_legend_is_vertical'] ) ? 'On' : 'Off',
		'wpbc_settings_calendar_preview_disable_timeslots_tooltip' => ( 'On' === (string) $current_settings['booking_disable_timeslots_in_tooltip'] ) ? 'On' : 'Off',
		'wpbc_settings_calendar_preview_timeslot_word'             => (string) $current_settings['booking_highlight_timeslot_word'],
	);

	foreach ( wpbc_settings_calendar__get_legend_items_config() as $legend_item => $legend_config ) {
		$is_show_key = 'booking_legend_is_show_item_' . $legend_item;
		$text_key    = 'booking_legend_text_for_item_' . $legend_item;
		if ( isset( $current_settings[ $is_show_key ] ) ) {
			$request_overrides[ 'wpbc_settings_calendar_preview_legend_show_' . $legend_item ] = ( 'On' === (string) $current_settings[ $is_show_key ] ) ? 'On' : 'Off';
		}
		if ( isset( $current_settings[ $text_key ] ) ) {
			$request_overrides[ 'wpbc_settings_calendar_preview_legend_text_' . $legend_item ] = (string) $current_settings[ $text_key ];
		}
	}

	if ( class_exists( 'wpdev_bk_biz_l' ) ) {
		$request_overrides['wpbc_settings_calendar_preview_show_availability_tooltip'] = ( 'On' === (string) $current_settings['booking_is_show_availability_in_tooltips'] ) ? 'On' : 'Off';
		$request_overrides['wpbc_settings_calendar_preview_availability_word']         = (string) $current_settings['booking_highlight_availability_word'];
		$request_overrides['wpbc_settings_calendar_preview_show_availability_cell']    = ( 'On' === (string) $current_settings['booking_is_show_availability_in_date_cell'] ) ? 'On' : 'Off';
		$request_overrides['wpbc_settings_calendar_preview_availability_cell_word']    = (string) $current_settings['booking_highlight_availability_word_in_date_cell'];
	}

	if ( class_exists( 'wpdev_bk_biz_m' ) ) {
		$request_overrides['wpbc_settings_calendar_preview_show_cost_tooltip']    = ( 'On' === (string) $current_settings['booking_is_show_cost_in_tooltips'] ) ? 'On' : 'Off';
		$request_overrides['wpbc_settings_calendar_preview_cost_word']            = (string) $current_settings['booking_highlight_cost_word'];
		$request_overrides['wpbc_settings_calendar_preview_show_cost_cell']       = ( 'On' === (string) $current_settings['booking_is_show_cost_in_date_cell'] ) ? 'On' : 'Off';
		$request_overrides['wpbc_settings_calendar_preview_cost_currency']        = (string) $current_settings['booking_cost_in_date_cell_currency'];
		$request_overrides['wpbc_settings_calendar_preview_show_booked_details']  = ( 'On' === (string) $current_settings['booking_is_show_booked_data_in_tooltips'] ) ? 'On' : 'Off';
		$request_overrides['wpbc_settings_calendar_preview_booked_details']       = (string) $current_settings['booking_booked_data_in_tooltips'];
	}

	return $request_overrides;
}

/**
 * Check change-over state while Calendar Settings preview option overrides are active.
 *
 * @param int|string   $resource_id Booking resource ID.
 * @param string|false $request_uri Request URI or false for current URI.
 *
 * @return bool|null Boolean when preview context is active, null otherwise.
 */
function wpbc_settings_calendar__preview_is_changeover_enabled( $resource_id = 0, $request_uri = false ) {

	global $wpbc_settings_calendar__preview_options;

	if ( ! is_array( $wpbc_settings_calendar__preview_options ) ) {
		return null;
	}

	if (
		! isset( $wpbc_settings_calendar__preview_options['booking_range_selection_time_is_active'] )
		|| 'On' !== (string) $wpbc_settings_calendar__preview_options['booking_range_selection_time_is_active']
	) {
		return false;
	}

	if ( function_exists( 'wpbc_is_booking_used_check_in_out_time' ) ) {
		return wpbc_is_booking_used_check_in_out_time( $request_uri, $resource_id );
	}

	return true;
}

/**
 * Validate page data.
 *
 * @param array $post_data Raw post data.
 *
 * @return array
 */
function wpbc_settings_calendar__validate_data( $post_data, $is_preview = false ) {

	$current          = wpbc_settings_calendar__get_settings_response();
	$max_months      = wpbc_settings_calendar__get_max_month_options();
	$weekdays        = wpbc_settings_calendar__get_weekday_options();
	$range_supported = wpbc_settings_calendar__is_range_supported();
	$cleaned         = array();

	$max_monthes = isset( $post_data['booking_max_monthes_in_calendar'] ) ? sanitize_text_field( wp_unslash( $post_data['booking_max_monthes_in_calendar'] ) ) : $current['booking_max_monthes_in_calendar'];
	$cleaned['booking_max_monthes_in_calendar'] = isset( $max_months[ $max_monthes ] ) ? $max_monthes : '1y';

	$start_day = isset( $post_data['booking_start_day_weeek'] ) ? sanitize_key( wp_unslash( $post_data['booking_start_day_weeek'] ) ) : $current['booking_start_day_weeek'];
	$cleaned['booking_start_day_weeek'] = array_key_exists( $start_day, $weekdays ) ? $start_day : '0';

	$cleaned['booking_calendar_allow_several_months_on_mobile'] = ( isset( $post_data['booking_calendar_allow_several_months_on_mobile'] ) && 'On' === wp_unslash( $post_data['booking_calendar_allow_several_months_on_mobile'] ) ) ? 'On' : 'Off';

	$day_mode = isset( $post_data['booking_type_of_day_selections'] ) ? sanitize_key( wp_unslash( $post_data['booking_type_of_day_selections'] ) ) : $current['booking_type_of_day_selections'];
	if ( ! in_array( $day_mode, array( 'single', 'multiple', 'range' ), true ) ) {
		$day_mode = 'multiple';
	}
	$cleaned['booking_type_of_day_selections'] = $day_mode;

	$range_type = isset( $post_data['booking_range_selection_type'] ) ? sanitize_key( wp_unslash( $post_data['booking_range_selection_type'] ) ) : $current['booking_range_selection_type'];
	$cleaned['booking_range_selection_type'] = in_array( $range_type, array( 'fixed', 'dynamic' ), true ) ? $range_type : 'dynamic';

	$cleaned['booking_range_selection_days_count'] = (string) min( 180, max( 1, absint( isset( $post_data['booking_range_selection_days_count'] ) ? wp_unslash( $post_data['booking_range_selection_days_count'] ) : $current['booking_range_selection_days_count'] ) ) );
	$cleaned['booking_range_selection_days_count_dynamic'] = (string) min( 1095, max( 1, absint( isset( $post_data['booking_range_selection_days_count_dynamic'] ) ? wp_unslash( $post_data['booking_range_selection_days_count_dynamic'] ) : $current['booking_range_selection_days_count_dynamic'] ) ) );
	$cleaned['booking_range_selection_days_max_count_dynamic'] = (string) min( 1095, max( 1, absint( isset( $post_data['booking_range_selection_days_max_count_dynamic'] ) ? wp_unslash( $post_data['booking_range_selection_days_max_count_dynamic'] ) : $current['booking_range_selection_days_max_count_dynamic'] ) ) );
	if ( (int) $cleaned['booking_range_selection_days_max_count_dynamic'] < (int) $cleaned['booking_range_selection_days_count_dynamic'] ) {
		$cleaned['booking_range_selection_days_max_count_dynamic'] = $cleaned['booking_range_selection_days_count_dynamic'];
	}

	$cleaned['booking_range_selection_days_specific_num_dynamic'] = isset( $post_data['booking_range_selection_days_specific_num_dynamic'] )
		? preg_replace( '/[^0-9,\-\s]/', '', sanitize_text_field( wp_unslash( $post_data['booking_range_selection_days_specific_num_dynamic'] ) ) )
		: $current['booking_range_selection_days_specific_num_dynamic'];

	$fixed_start_mode = isset( $post_data['booking_range_start_day_mode'] ) ? sanitize_key( wp_unslash( $post_data['booking_range_start_day_mode'] ) ) : ( '-1' === $current['booking_range_start_day'] ? '-1' : 'specific' );
	$dynamic_start_mode = isset( $post_data['booking_range_start_day_dynamic_mode'] ) ? sanitize_key( wp_unslash( $post_data['booking_range_start_day_dynamic_mode'] ) ) : ( '-1' === $current['booking_range_start_day_dynamic'] ? '-1' : 'specific' );
	$cleaned['booking_range_start_day'] = ( '-1' === $fixed_start_mode )
		? '-1'
		: wpbc_settings_calendar__normalize_week_days( isset( $post_data['booking_range_start_day_weekdays'] ) ? wp_unslash( $post_data['booking_range_start_day_weekdays'] ) : $current['booking_range_start_day'] );
	$cleaned['booking_range_start_day_dynamic'] = ( '-1' === $dynamic_start_mode )
		? '-1'
		: wpbc_settings_calendar__normalize_week_days( isset( $post_data['booking_range_start_day_dynamic_weekdays'] ) ? wp_unslash( $post_data['booking_range_start_day_dynamic_weekdays'] ) : $current['booking_range_start_day_dynamic'] );

	$cleaned['booking_recurrent_time'] = ( isset( $post_data['booking_recurrent_time'] ) && 'On' === wp_unslash( $post_data['booking_recurrent_time'] ) ) ? 'On' : 'Off';
	$cleaned['booking_last_checkout_day_available'] = ( isset( $post_data['booking_last_checkout_day_available'] ) && 'On' === wp_unslash( $post_data['booking_last_checkout_day_available'] ) ) ? 'On' : 'Off';
	$cleaned['booking_range_selection_time_is_active'] = ( isset( $post_data['booking_range_selection_time_is_active'] ) && 'On' === wp_unslash( $post_data['booking_range_selection_time_is_active'] ) ) ? 'On' : 'Off';
	$cleaned['booking_change_over_days_triangles'] = ( isset( $post_data['booking_change_over_days_triangles'] ) && 'On' === wp_unslash( $post_data['booking_change_over_days_triangles'] ) ) ? 'On' : 'Off';
	$cleaned['booking_change_over__is_excerpt_on_pages'] = ( isset( $post_data['booking_change_over__is_excerpt_on_pages'] ) && 'On' === wp_unslash( $post_data['booking_change_over__is_excerpt_on_pages'] ) ) ? 'On' : 'Off';

	foreach ( array( 'booking_range_selection_start_time', 'booking_range_selection_end_time' ) as $time_key ) {
		$time_value = isset( $post_data[ $time_key ] ) ? sanitize_text_field( wp_unslash( $post_data[ $time_key ] ) ) : $current[ $time_key ];
		$cleaned[ $time_key ] = preg_match( '/^\d{2}:\d{2}$/', $time_value ) ? $time_value : $current[ $time_key ];
	}

	$cleaned['booking_change_over__excerpt_on_pages'] = isset( $post_data['booking_change_over__excerpt_on_pages'] ) ? sanitize_textarea_field( wp_unslash( $post_data['booking_change_over__excerpt_on_pages'] ) ) : $current['booking_change_over__excerpt_on_pages'];
	$cleaned['booking_change_over__excerpt_bk_resources'] = isset( $post_data['booking_change_over__excerpt_bk_resources'] ) ? sanitize_textarea_field( wp_unslash( $post_data['booking_change_over__excerpt_bk_resources'] ) ) : $current['booking_change_over__excerpt_bk_resources'];

	$cleaned['booking_is_show_legend'] = ( isset( $post_data['booking_is_show_legend'] ) && 'On' === wp_unslash( $post_data['booking_is_show_legend'] ) ) ? 'On' : 'Off';
	$cleaned['booking_legend_is_show_numbers'] = ( isset( $post_data['booking_legend_is_show_numbers'] ) && 'On' === wp_unslash( $post_data['booking_legend_is_show_numbers'] ) ) ? 'On' : 'Off';
	$cleaned['booking_legend_is_vertical'] = ( isset( $post_data['booking_legend_is_vertical'] ) && 'On' === wp_unslash( $post_data['booking_legend_is_vertical'] ) ) ? 'On' : 'Off';
	if ( isset( $post_data['booking_show_timeslots_in_tooltip'] ) ) {
		$cleaned['booking_disable_timeslots_in_tooltip'] = ( 'On' === wp_unslash( $post_data['booking_show_timeslots_in_tooltip'] ) ) ? 'Off' : 'On';
	} else {
		$cleaned['booking_disable_timeslots_in_tooltip'] = ( isset( $post_data['booking_disable_timeslots_in_tooltip'] ) && 'On' === wp_unslash( $post_data['booking_disable_timeslots_in_tooltip'] ) ) ? 'On' : 'Off';
	}
	$cleaned['booking_highlight_timeslot_word'] = isset( $post_data['booking_highlight_timeslot_word'] ) ? sanitize_text_field( wp_unslash( $post_data['booking_highlight_timeslot_word'] ) ) : $current['booking_highlight_timeslot_word'];

	foreach ( wpbc_settings_calendar__get_legend_items_config() as $legend_item => $legend_config ) {
		$is_show_key          = 'booking_legend_is_show_item_' . $legend_item;
		$text_key             = 'booking_legend_text_for_item_' . $legend_item;
		$cleaned[ $is_show_key ] = ( isset( $post_data[ $is_show_key ] ) && 'On' === wp_unslash( $post_data[ $is_show_key ] ) ) ? 'On' : 'Off';
		$cleaned[ $text_key ]    = isset( $post_data[ $text_key ] ) ? sanitize_text_field( wp_unslash( $post_data[ $text_key ] ) ) : $current[ $text_key ];
	}

	if ( class_exists( 'wpdev_bk_biz_l' ) ) {
		$cleaned['booking_is_show_availability_in_tooltips'] = ( isset( $post_data['booking_is_show_availability_in_tooltips'] ) && 'On' === wp_unslash( $post_data['booking_is_show_availability_in_tooltips'] ) ) ? 'On' : 'Off';
		$cleaned['booking_highlight_availability_word'] = isset( $post_data['booking_highlight_availability_word'] ) ? sanitize_text_field( wp_unslash( $post_data['booking_highlight_availability_word'] ) ) : $current['booking_highlight_availability_word'];
		$cleaned['booking_is_show_availability_in_date_cell'] = ( isset( $post_data['booking_is_show_availability_in_date_cell'] ) && 'On' === wp_unslash( $post_data['booking_is_show_availability_in_date_cell'] ) ) ? 'On' : 'Off';
		$cleaned['booking_highlight_availability_word_in_date_cell'] = isset( $post_data['booking_highlight_availability_word_in_date_cell'] ) ? sanitize_text_field( wp_unslash( $post_data['booking_highlight_availability_word_in_date_cell'] ) ) : $current['booking_highlight_availability_word_in_date_cell'];
	}

	if ( class_exists( 'wpdev_bk_biz_m' ) ) {
		$cleaned['booking_is_show_cost_in_tooltips'] = ( isset( $post_data['booking_is_show_cost_in_tooltips'] ) && 'On' === wp_unslash( $post_data['booking_is_show_cost_in_tooltips'] ) ) ? 'On' : 'Off';
		$cleaned['booking_highlight_cost_word'] = isset( $post_data['booking_highlight_cost_word'] ) ? sanitize_text_field( wp_unslash( $post_data['booking_highlight_cost_word'] ) ) : $current['booking_highlight_cost_word'];
		$cleaned['booking_is_show_cost_in_date_cell'] = ( isset( $post_data['booking_is_show_cost_in_date_cell'] ) && 'On' === wp_unslash( $post_data['booking_is_show_cost_in_date_cell'] ) ) ? 'On' : 'Off';
		$cleaned['booking_cost_in_date_cell_currency'] = isset( $post_data['booking_cost_in_date_cell_currency'] ) ? sanitize_text_field( wp_unslash( $post_data['booking_cost_in_date_cell_currency'] ) ) : $current['booking_cost_in_date_cell_currency'];
		$cleaned['booking_is_show_booked_data_in_tooltips'] = ( isset( $post_data['booking_is_show_booked_data_in_tooltips'] ) && 'On' === wp_unslash( $post_data['booking_is_show_booked_data_in_tooltips'] ) ) ? 'On' : 'Off';
		$cleaned['booking_booked_data_in_tooltips'] = isset( $post_data['booking_booked_data_in_tooltips'] ) ? sanitize_text_field( wp_unslash( $post_data['booking_booked_data_in_tooltips'] ) ) : $current['booking_booked_data_in_tooltips'];
	}

	if ( ! $is_preview && ! $range_supported ) {
		foreach ( array( 'booking_range_selection_time_is_active', 'booking_last_checkout_day_available', 'booking_change_over_days_triangles', 'booking_change_over__is_excerpt_on_pages' ) as $premium_key ) {
			$cleaned[ $premium_key ] = $current[ $premium_key ];
		}
	}

	return $cleaned;
}

/**
 * Update settings.
 *
 * @param array $cleaned_data Cleaned data.
 *
 * @return void
 */
function wpbc_settings_calendar__update_settings( $cleaned_data ) {

	$range_supported = wpbc_settings_calendar__is_range_supported();
	$free_keys       = array(
		'booking_max_monthes_in_calendar',
		'booking_start_day_weeek',
		'booking_calendar_allow_several_months_on_mobile',
		'booking_type_of_day_selections',
		'booking_recurrent_time',
		'booking_is_show_legend',
		'booking_legend_is_show_numbers',
		'booking_legend_is_vertical',
		'booking_disable_timeslots_in_tooltip',
		'booking_highlight_timeslot_word',
	);
	$premium_keys    = array(
		'booking_range_selection_type',
		'booking_range_selection_days_count',
		'booking_range_start_day',
		'booking_range_selection_days_count_dynamic',
		'booking_range_selection_days_max_count_dynamic',
		'booking_range_selection_days_specific_num_dynamic',
		'booking_range_start_day_dynamic',
		'booking_last_checkout_day_available',
		'booking_range_selection_time_is_active',
		'booking_range_selection_start_time',
		'booking_range_selection_end_time',
		'booking_change_over_days_triangles',
		'booking_change_over__is_excerpt_on_pages',
		'booking_change_over__excerpt_on_pages',
		'booking_change_over__excerpt_bk_resources',
	);
	$availability_tooltip_keys = array(
		'booking_is_show_availability_in_tooltips',
		'booking_highlight_availability_word',
		'booking_is_show_availability_in_date_cell',
		'booking_highlight_availability_word_in_date_cell',
	);
	$cost_tooltip_keys = array(
		'booking_is_show_cost_in_tooltips',
		'booking_highlight_cost_word',
		'booking_is_show_cost_in_date_cell',
		'booking_cost_in_date_cell_currency',
		'booking_is_show_booked_data_in_tooltips',
		'booking_booked_data_in_tooltips',
	);
	foreach ( wpbc_settings_calendar__get_legend_items_config() as $legend_item => $legend_config ) {
		$free_keys[] = 'booking_legend_is_show_item_' . $legend_item;
		$free_keys[] = 'booking_legend_text_for_item_' . $legend_item;
	}

	foreach ( $free_keys as $key ) {
		if ( 'booking_type_of_day_selections' === $key && ! $range_supported && 'range' === $cleaned_data[ $key ] ) {
			continue;
		}
		update_bk_option( $key, $cleaned_data[ $key ] );
	}

	if ( $range_supported ) {
		foreach ( $premium_keys as $key ) {
			update_bk_option( $key, $cleaned_data[ $key ] );
		}
	}

	if ( class_exists( 'wpdev_bk_biz_l' ) ) {
		foreach ( $availability_tooltip_keys as $key ) {
			update_bk_option( $key, $cleaned_data[ $key ] );
		}
	}

	if ( class_exists( 'wpdev_bk_biz_m' ) ) {
		foreach ( $cost_tooltip_keys as $key ) {
			update_bk_option( $key, $cleaned_data[ $key ] );
		}
	}
}

/**
 * Render select element.
 *
 * @param string $name     Name.
 * @param array  $options  Options.
 * @param string $selected Selected value.
 * @param array  $args     Arguments.
 *
 * @return void
 */
function wpbc_settings_calendar__render_select( $name, $options, $selected, $args = array() ) {

	$id    = isset( $args['id'] ) ? $args['id'] : $name;
	$class = isset( $args['class'] ) ? $args['class'] : '';
	?>
	<select id="<?php echo esc_attr( $id ); ?>" name="<?php echo esc_attr( $name ); ?>" class="<?php echo esc_attr( $class ); ?>">
		<?php foreach ( $options as $value => $label ) : ?>
			<option value="<?php echo esc_attr( $value ); ?>" <?php selected( (string) $selected, (string) $value ); ?>><?php echo esc_html( $label ); ?></option>
		<?php endforeach; ?>
	</select>
	<?php
}

/**
 * Get premium feature URL by required version label.
 *
 * @param string $label Premium label.
 * @param string $url   Optional explicit URL.
 *
 * @return string
 */
function wpbc_settings_calendar__get_premium_url( $label = 'Pro', $url = '' ) {

	$generic_features_url = 'https://wpbookingcalendar.com/features/';
	$url                  = trim( (string) $url );

	if ( ( '' !== $url ) && ( $generic_features_url !== $url ) ) {
		return $url;
	}

	$label = strtolower( (string) $label );

	if ( false !== strpos( $label, 'multiuser' ) ) {
		return 'https://wpbookingcalendar.com/features/#multiuser';
	}
	if ( false !== strpos( $label, 'business large' ) || false !== strpos( $label, 'bl+' ) ) {
		return 'https://wpbookingcalendar.com/features/#bl';
	}
	if ( false !== strpos( $label, 'business medium' ) || false !== strpos( $label, 'bm+' ) ) {
		return 'https://wpbookingcalendar.com/features/#bm';
	}
	if ( false !== strpos( $label, 'business small' ) || false !== strpos( $label, 'bs+' ) ) {
		return 'https://wpbookingcalendar.com/features/#bs';
	}

	return $generic_features_url;
}

/**
 * Render premium label.
 *
 * @return void
 */
function wpbc_settings_calendar__render_premium_label( $label = 'Business Small+', $url = 'https://wpbookingcalendar.com/features/', $dismiss_id = '' ) {

	$url = wpbc_settings_calendar__get_premium_url( $label, $url );
	?>
	<a class="wpbc_pro_label wpbc_calendar_pro_label" href="<?php echo esc_url( $url ); ?>" target="_blank"><?php echo esc_html( $label ); ?></a>
	<?php if ( '' !== $dismiss_id ) : ?>
		<?php wpbc_settings_calendar__render_dismiss_button( $dismiss_id ); ?>
	<?php endif; ?>
	<?php
}

/**
 * Check if a Calendar Settings upsell row is visible for current user.
 *
 * @param string $dismiss_id Dismiss ID.
 *
 * @return bool
 */
function wpbc_settings_calendar__is_dismissed_visible( $dismiss_id ) {

	if ( wpbc_is_this_demo() ) {
		return true;
	}

	return ! function_exists( 'wpbc_is_dismissed_panel_visible' ) || wpbc_is_dismissed_panel_visible( $dismiss_id );
}

/**
 * Get dismiss ID for a Calendar Settings premium option.
 *
 * @param string $option_name Option name.
 *
 * @return string
 */
function wpbc_settings_calendar__get_premium_option_dismiss_id( $option_name ) {

	return 'wpbc_is_dismissed__calendar_settings__' . sanitize_key( $option_name );
}

/**
 * Render small dismiss button for Calendar Settings premium hints.
 *
 * @param string $dismiss_id Dismiss ID.
 *
 * @return void
 */
function wpbc_settings_calendar__render_dismiss_button( $dismiss_id ) {

	if ( wpbc_is_this_demo() || ! function_exists( 'wpbc_is_dismissed' ) ) {
		return;
	}

	?>
	<span class="wpbc_calendar_premium_dismiss">
		<?php
		wpbc_is_dismissed(
			$dismiss_id,
			array(
				'title' => '&times;',
				'hint'  => __( 'Hide this option', 'booking' ),
				'css'   => 'float:none;margin-left:4px;',
			)
		);
		?>
	</span>
	<?php
}

/**
 * Render shared Business Small+ explanation for range/changeover locked controls.
 *
 * @return void
 */
function wpbc_settings_calendar__render_range_upgrade_note() {

	?>
	<div class="wpbc_calendar_premium_note" data-wpbc-calendar-range-upgrade-note="1">
		<div>
			<strong><?php esc_html_e( 'Range days selection', 'booking' ); ?></strong>
			<p><?php esc_html_e( 'Visitors select a start and end date, with optional minimum and maximum range length and allowed start weekdays. This feature is available in Booking Calendar Business Small or higher.', 'booking' ); ?></p>
		</div>
		<div class="wpbc_calendar_premium_note_actions">
			<a class="button button-secondary" href="<?php echo esc_url( 'https://bm.wpbookingcalendar.com/' ); ?>" target="_blank"><?php esc_html_e( 'View live demo', 'booking' ); ?></a>
			<a class="button button-primary" href="<?php echo esc_url( wpbc_settings_calendar__get_premium_url( 'Business Small+' ) ); ?>" target="_blank"><?php esc_html_e( 'Upgrade', 'booking' ); ?></a>
		</div>
	</div>
	<?php
}

/**
 * Render Business Small+ explanation for locked changeover controls.
 *
 * @return void
 */
function wpbc_settings_calendar__render_changeover_upgrade_note() {

	?>
	<div class="wpbc_calendar_premium_note" data-wpbc-calendar-changeover-upgrade-note="1">
		<div>
			<strong><?php esc_html_e( 'Changeover days', 'booking' ); ?></strong>
			<p><?php esc_html_e( 'Check-in and check-out days can be shown as half-day changeover dates with diagonal or vertical markings. This feature is available in Booking Calendar Business Small or higher.', 'booking' ); ?></p>
		</div>
		<div class="wpbc_calendar_premium_note_actions">
			<a class="button button-secondary" href="<?php echo esc_url( 'https://bm.wpbookingcalendar.com/' ); ?>" target="_blank"><?php esc_html_e( 'View live demo', 'booking' ); ?></a>
			<a class="button button-primary" href="<?php echo esc_url( wpbc_settings_calendar__get_premium_url( 'Business Small+' ) ); ?>" target="_blank"><?php esc_html_e( 'Upgrade', 'booking' ); ?></a>
		</div>
	</div>
	<?php
}

/**
 * Render disabled premium-only toggle row.
 *
 * @param string $name          Option name.
 * @param string $label         Label.
 * @param string $description   Description.
 * @param string $premium_label Premium label.
 *
 * @return void
 */
function wpbc_settings_calendar__render_locked_premium_checkbox( $name, $label, $description, $premium_label ) {

	$dismiss_id = wpbc_settings_calendar__get_premium_option_dismiss_id( $name );
	if ( ! wpbc_settings_calendar__is_dismissed_visible( $dismiss_id ) ) {
		return;
	}
	?>
	<div id="<?php echo esc_attr( $dismiss_id ); ?>" class="wpbc_calendar_field_row wpbc_calendar_locked_premium_field">
		<label class="wpbc_calendar_switch wpbc_calendar_switch_card is-premium" aria-disabled="true">
			<input type="checkbox" name="<?php echo esc_attr( $name ); ?>" value="On" disabled="disabled" data-wpbc-calendar-premium="1" />
			<span class="wpbc_calendar_switch_control" aria-hidden="true"><span class="wpbc_calendar_switch_knob"></span></span>
			<span class="wpbc_calendar_switch_label"><?php echo esc_html( $label ); ?></span>
			<?php wpbc_settings_calendar__render_premium_label( $premium_label, '', $dismiss_id ); ?>
		</label>
		<?php if ( '' !== $description ) : ?>
			<p class="wpbc_calendar_description"><?php echo wp_kses_post( $description ); ?></p>
		<?php endif; ?>
	</div>
	<?php
}

/**
 * Render checkbox field.
 *
 * @param string $name        Option name.
 * @param string $label       Label.
 * @param string $description Description.
 * @param array  $settings    Settings.
 * @param bool   $is_premium  Whether field is premium.
 *
 * @return bool
 */
function wpbc_settings_calendar__render_checkbox( $name, $label, $description, $settings, $is_premium = false ) {

	$premium_attr = $is_premium ? 'data-wpbc-calendar-premium="1"' : '';
	$dismiss_id   = $is_premium ? wpbc_settings_calendar__get_premium_option_dismiss_id( $name ) : '';
	if ( $is_premium && ! wpbc_settings_calendar__is_dismissed_visible( $dismiss_id ) ) {
		return false;
	}
	if ( $is_premium && 'booking_range_selection_time_is_active' === $name ) {
		$premium_attr .= ' data-wpbc-calendar-premium-changeover-info="1"';
	}
	?>
	<label class="wpbc_calendar_switch wpbc_calendar_switch_card <?php echo $is_premium ? 'is-premium' : ''; ?>">
		<input type="checkbox" name="<?php echo esc_attr( $name ); ?>" value="On" <?php checked( 'On', $settings[ $name ] ); ?> <?php echo $premium_attr; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> />
		<span class="wpbc_calendar_switch_control" aria-hidden="true"><span class="wpbc_calendar_switch_knob"></span></span>
		<span class="wpbc_calendar_switch_label"><?php echo esc_html( $label ); ?></span>
		<?php if ( $is_premium ) : ?>
			<?php wpbc_settings_calendar__render_premium_label( 'Business Small+', '', $dismiss_id ); ?>
		<?php endif; ?>
	</label>
	<?php if ( '' !== $description ) : ?>
		<p class="wpbc_calendar_description"><?php echo wp_kses_post( $description ); ?></p>
	<?php endif; ?>
	<?php
	return true;
}

/**
 * Render legend item toggle with title field.
 *
 * @param string $legend_item Legend item key.
 * @param array  $config      Legend item config.
 * @param array  $settings    Settings.
 *
 * @return void
 */
function wpbc_settings_calendar__render_legend_item_control( $legend_item, $config, $settings ) {

	$is_show_key = 'booking_legend_is_show_item_' . $legend_item;
	$text_key    = 'booking_legend_text_for_item_' . $legend_item;
	?>
	<div class="wpbc_calendar_legend_item_tile" data-wpbc-calendar-legend-item="<?php echo esc_attr( $legend_item ); ?>">
		<div class="wpbc_calendar_legend_item_header">
			<label class="wpbc_calendar_switch">
				<input type="checkbox" name="<?php echo esc_attr( $is_show_key ); ?>" value="On" <?php checked( 'On', $settings[ $is_show_key ] ); ?> />
				<span class="wpbc_calendar_switch_control" aria-hidden="true"><span class="wpbc_calendar_switch_knob"></span></span>
				<span class="wpbc_calendar_switch_label"><?php echo esc_html( $config['label'] ); ?></span>
			</label>
		</div>
		<div class="wpbc_calendar_legend_item_title">
			<label for="<?php echo esc_attr( $text_key ); ?>"><?php esc_html_e( 'Title', 'booking' ); ?></label>
			<input type="text" id="<?php echo esc_attr( $text_key ); ?>" name="<?php echo esc_attr( $text_key ); ?>" value="<?php echo esc_attr( $settings[ $text_key ] ); ?>" placeholder="<?php echo esc_attr( $config['placeholder'] ); ?>" />
		</div>
		<p class="wpbc_calendar_description"><?php echo wp_kses_post( $config['description'] ); ?></p>
		<?php if ( ! empty( $config['note'] ) ) : ?>
			<p class="wpbc_calendar_description"><strong><?php esc_html_e( 'Note', 'booking' ); ?>:</strong> <?php echo esc_html( $config['note'] ); ?></p>
		<?php endif; ?>
	</div>
	<?php
}

/**
 * Render week-day checkbox row.
 *
 * @param string $name  Field name.
 * @param string $value Current CSV value.
 *
 * @return void
 */
function wpbc_settings_calendar__render_weekday_checks( $name, $value ) {

	$selected = ( '-1' === $value || '' === $value ) ? array() : explode( ',', $value );
	?>
	<div class="wpbc_calendar_weekday_checks" data-wpbc-calendar-weekday-checks="<?php echo esc_attr( $name ); ?>">
		<?php foreach ( wpbc_settings_calendar__get_weekday_options() as $day_value => $day_label ) : ?>
			<label>
				<input type="checkbox" name="<?php echo esc_attr( $name ); ?>[]" value="<?php echo esc_attr( $day_value ); ?>" <?php checked( in_array( (string) $day_value, $selected, true ) ); ?> />
				<span><?php echo esc_html( $day_label ); ?></span>
			</label>
		<?php endforeach; ?>
	</div>
	<?php
}

/**
 * Render calendar preview.
 *
 * @param int   $resource_id      Resource ID.
 * @param int   $months_count     Number of months.
 * @param array $preview_settings Optional settings.
 *
 * @return void
 */
function wpbc_settings_calendar__render_calendar_preview( $resource_id, $months_count, $preview_settings = array() ) {

	$resource_id              = wpbc_settings_calendar__sanitize_preview_resource_id( $resource_id );
	$months_count             = wpbc_settings_calendar__sanitize_preview_months_count( $months_count );
	$current_settings         = wp_parse_args( $preview_settings, wpbc_settings_calendar__get_settings_response() );
	$is_change_over_preview   = ( 'On' === (string) $current_settings['booking_range_selection_time_is_active'] );
	$is_triangle_preview      = ( 'Off' !== (string) $current_settings['booking_change_over_days_triangles'] );
	$preview_css_classes      = 'wpbc_calendar_settings_preview';
	if ( $is_change_over_preview && $is_triangle_preview ) {
		$preview_css_classes .= ' wpbc_change_over_triangle';
	}
	$previous_preview_options = wpbc_settings_calendar__preview_options_push( $current_settings );
	?>
	<div class="<?php echo esc_attr( $preview_css_classes ); ?>" data-wpbc-admin-calendar-preview="1" data-wpbc-calendar-preview="1" data-resource-id="<?php echo esc_attr( $resource_id ); ?>" data-months-count="<?php echo esc_attr( $months_count ); ?>">
		<div class="wpbc_calendar_settings_real_preview" data-wpbc-calendar-panel="1">
			<?php
			if ( class_exists( 'WPBC_FE_Render' ) ) {
				WPBC_FE_Render::render_calendar_only(
					array(
						'resource_id'                => $resource_id,
						'cal_count'                  => $months_count,
						'is_echo'                    => 1,
						'calendar_request_overrides' => wpbc_settings_calendar__get_calendar_load_preview_request_overrides( $current_settings ),
					)
				);
			} elseif ( function_exists( 'wpbc__calendar__load' ) ) {
				$start_script_code = wpbc__calendar__load(
					array(
						'resource_id'                     => $resource_id,
						'aggregate_resource_id_arr'       => array(),
						'selected_dates_without_calendar' => '',
						'calendar_number_of_months'       => $months_count,
						'start_month_calendar'            => false,
						'shortcode_options'               => '',
						'custom_form'                     => 'standard',
						'skip_general_availability'       => 1,
						'calendar_request_overrides'      => wpbc_settings_calendar__get_calendar_load_preview_request_overrides( $current_settings ),
					)
				);
				if ( function_exists( 'wpbc_pre_get_calendar_html' ) ) {
					echo '<div style="clear:both;height:10px;"></div>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					echo wpbc_pre_get_calendar_html( $resource_id, $months_count, '' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					echo ' ' . $start_script_code; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				} else {
					echo $start_script_code; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				}
			}
			?>
		</div>
	</div>
	<?php

	wpbc_settings_calendar__preview_options_pop( $previous_preview_options );
}

/**
 * Show Calendar save button in top toolbar.
 *
 * @param string $page_tag Current page tag.
 * @param string $active_page_tab Current tab.
 * @param string $active_page_subtab Current subtab.
 *
 * @return void
 */
function wpbc_settings_calendar__top_toolbar__show_save_button( $page_tag, $active_page_tab, $active_page_subtab ) {

	if ( ( 'wpbc-settings' !== $page_tag ) || ( 'calendar_settings' !== $active_page_tab ) ) {
		return;
	}

	if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_settings_calendar__get_manage_cap() ) ) {
		return;
	}
	?>
	<div class="wpbc_ui_el__buttons_group wpbc_calendar__top_toolbar_group">
		<a href="javascript:void(0);"
			class="button button-primary wpbc_calendar__top_btn_save"
			data-wpbc-calendar-save="1"
			data-wpbc-u-busy-text="<?php esc_attr_e( 'Saving', 'booking' ); ?>...">
			<i class="menu_icon icon-1x wpbc-bi-check2-circle"></i>
			<span class="in-button-text">&nbsp;&nbsp;<?php esc_html_e( 'Save Changes', 'booking' ); ?></span>
		</a>
	</div>
	<?php
}
add_action( 'wpbc_ui_el__top_nav__content_end', 'wpbc_settings_calendar__top_toolbar__show_save_button', 20, 3 );

/**
 * Block direct access for regular users in MultiUser context.
 *
 * @param bool   $is_show_this_page Whether to show page.
 * @param string $page_tag Current page.
 * @param string $active_page_tab Active tab.
 * @param string $active_page_subtab Active subtab.
 *
 * @return bool
 */
function wpbc_settings_calendar__check_showing_page( $is_show_this_page, $page_tag, $active_page_tab, $active_page_subtab ) {

	if ( ( 'wpbc-settings' === $page_tag ) && ( 'calendar_settings' === $active_page_tab ) && ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_settings_calendar__get_manage_cap() ) ) ) {
		return false;
	}

	return $is_show_this_page;
}
add_filter( 'wpbc_before_showing_settings_page_is_show_page', 'wpbc_settings_calendar__check_showing_page', 20, 4 );

/**
 * Calendar settings tab.
 */
class WPBC_Page_Settings_Calendar extends WPBC_Page_Structure {

	/**
	 * Whether settings were saved during this request.
	 *
	 * @var bool
	 */
	private $is_updated = false;

	/**
	 * Menu slug.
	 *
	 * @return string
	 */
	public function in_page() {

		if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_settings_calendar__get_manage_cap() ) ) {
			return (string) wp_rand( 100000, 1000000 );
		}

		return 'wpbc-settings';
	}

	/**
	 * Register tab.
	 *
	 * @return array
	 */
	public function tabs() {

		$subtabs        = array();
		$subtab_default = array(
			'type'            => 'subtab',
			'title'           => '',
			'page_title'      => __( 'Calendar Settings', 'booking' ),
			'hint'            => '',
			'link'            => '',
			'css_classes'     => '',
			'font_icon'       => 'wpbc-bi-calendar2-range',
			'font_icon_right' => 'wpbc-bi-question-circle',
			'default'         => false,
			'content'         => 'content',
		);

		foreach ( wpbc_settings_calendar__get_section_navigation_items() as $section_key => $section ) {
			$subtabs[ $section['menu_slug'] ] = array_merge(
				$subtab_default,
				array(
					'title'     => $section['title'],
					'hint'      => $section['hint'],
					'font_icon' => $section['font_icon'],
					'link'      => wpbc_settings_calendar__get_section_url( $section_key ),
					'default'   => ( 'days_selection' === $section_key ),
				)
			);
		}

		return array(
			'calendar_settings' => array(
				'is_show_top_path'                          => true,
				'right_vertical_sidebar__is_show'           => true,
				'right_vertical_sidebar__default_view_mode' => '',
				'right_vertical_sidebar_compact__is_show'   => true,
				'left_navigation__default_view_mode'        => 'compact',
				'top_path_title'                            => __( 'Calendar', 'booking' ),
				'title'                                     => __( 'Calendar', 'booking' ) . '<span class="wpbc_new_label" style="margin-left: auto;">' . esc_html__( 'New', 'booking' ) . '</span>&nbsp;&nbsp;',
				'hint'                                      => __( 'Preview and configure date selection, range selection, and change-over behavior.', 'booking' ),
				'page_title'                                => __( 'Calendar Settings', 'booking' ),
				'link'                                      => '',
				'position'                                  => '',
				'css_classes'                               => 'wpbc_top_tab__calendar_settings',
				'icon'                                      => '',
				'font_icon'                                 => 'wpbc-bi-calendar2-range',
				'font_icon_right'                           => '',
				'default'                                   => false,
				'disabled'                                  => false,
				'hided'                                     => false,
				'subtabs'                                   => $subtabs,
				'folder_style'                              => 'order:18;',
			),
		);
	}

	/**
	 * Save settings.
	 *
	 * @return void
	 */
	public function maybe_update() {

		$form_name = 'wpbc_settings_calendar_form';

		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		if ( ! isset( $_POST[ 'is_form_submitted_' . $form_name ] ) ) {
			return;
		}

		check_admin_referer( 'wpbc_settings_page_' . $form_name );

		if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_settings_calendar__get_manage_cap() ) ) {
			return;
		}

		$cleaned_data = wpbc_settings_calendar__validate_data( $_POST ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		wpbc_settings_calendar__update_settings( $cleaned_data );

		$this->is_updated = true;
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
					'id'       => 'wpbc_tab_calendar_settings',
					'panel_id' => 'wpbc_calendar__inspector_settings',
					'title'    => __( 'Settings', 'booking' ),
					'icon'     => 'wpbc_icn_tune',
					'selected' => true,
				),
				array(
					'id'       => 'wpbc_tab_calendar_notes',
					'panel_id' => 'wpbc_calendar__inspector_notes',
					'title'    => __( 'Notes', 'booking' ),
					'icon'     => 'wpbc-bi-info-circle',
				),
			),
			array(
				'aria_label' => __( 'Calendar Panels', 'booking' ),
				'context'    => 'settings_calendar',
				'class'      => 'wpbc_calendar_rightbar_tabs',
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
		<div class="wpbc_bfb__panel--library wpbc_rightbar_palette wpbc_calendar_rightbar_panels">
			<?php
			WPBC_UI_Sidebar_Panels::render_panel(
				array(
					'id'         => 'wpbc_calendar__inspector_settings',
					'labelledby' => 'wpbc_tab_calendar_settings',
					'class'      => 'wpbc_calendar__inspector_settings',
				),
				array( $this, 'right_panel_settings_content' )
			);

			WPBC_UI_Sidebar_Panels::render_panel(
				array(
					'id'         => 'wpbc_calendar__inspector_notes',
					'labelledby' => 'wpbc_tab_calendar_notes',
					'class'      => 'wpbc_calendar__inspector_notes',
					'hidden'     => true,
				),
				array( $this, 'right_panel_notes_content' )
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

		$form_name       = 'wpbc_settings_calendar_form';
		$settings        = wpbc_settings_calendar__get_settings_response();
		$is_premium_lock = ! wpbc_settings_calendar__is_range_supported();
		$open_section    = wpbc_settings_calendar__get_open_section();

		WPBC_UI_Sidebar_Panels::render_inspector_header( __( 'Calendar Settings', 'booking' ), __( 'Date selection and change-over behavior with live calendar preview.', 'booking' ) );
		?>
		<form method="post" id="<?php echo esc_attr( $form_name ); ?>" class="wpbc_calendar_settings_form" data-wpbc-calendar-settings-form="1">
			<?php wp_nonce_field( 'wpbc_settings_page_' . $form_name ); ?>
			<input type="hidden" name="is_form_submitted_<?php echo esc_attr( $form_name ); ?>" value="1" />
			<div class="wpbc_bfb__inspector__body wpbc_calendar_inspector_body">
				<?php
				WPBC_UI_Sidebar_Panels::render_collapsible_group(
					array(
						'id'    => 'wpbc_calendar_days_selection_group',
						'group' => 'settings-calendar-days-selection',
						'title' => __( 'Days Selection', 'booking' ),
						'open'  => ( '' === $open_section || 'days_selection' === $open_section ),
					),
					function () use ( $settings, $is_premium_lock ) {
						$selected_day_mode = ( $is_premium_lock && 'range' === $settings['booking_type_of_day_selections'] ) ? 'multiple' : $settings['booking_type_of_day_selections'];
						$range_dismiss_id  = wpbc_settings_calendar__get_premium_option_dismiss_id( 'booking_type_of_day_selections_range' );
						?>
						<div class="wpbc_calendar_radio_stack" data-wpbc-calendar-days-mode="1">
							<label><input type="radio" name="booking_type_of_day_selections" value="single" <?php checked( 'single', $selected_day_mode ); ?> /> <span><?php esc_html_e( 'Single day', 'booking' ); ?></span></label>
							<label><input type="radio" name="booking_type_of_day_selections" value="multiple" <?php checked( 'multiple', $selected_day_mode ); ?> /> <span><?php esc_html_e( 'Multiple days', 'booking' ); ?></span></label>
							<?php if ( ! $is_premium_lock || wpbc_settings_calendar__is_dismissed_visible( $range_dismiss_id ) ) : ?>
								<label id="<?php echo esc_attr( $is_premium_lock ? $range_dismiss_id : '' ); ?>" class="<?php echo $is_premium_lock ? 'is-premium' : ''; ?>"><input type="radio" name="booking_type_of_day_selections" value="range" <?php checked( 'range', $selected_day_mode ); ?> <?php echo $is_premium_lock ? 'data-wpbc-calendar-premium="1" data-wpbc-calendar-premium-range-info="1"' : ''; ?> /> <span><?php esc_html_e( 'Range days', 'booking' ); ?></span> <?php $is_premium_lock && wpbc_settings_calendar__render_premium_label( 'Business Small+', '', $range_dismiss_id ); ?></label>
							<?php endif; ?>
						</div>
						<?php if ( $is_premium_lock ) : ?>
							<?php wpbc_settings_calendar__render_range_upgrade_note(); ?>
						<?php endif; ?>
						<div class="wpbc_calendar_subsettings" data-wpbc-calendar-range-settings="1">
							<div class="wpbc_calendar_radio_stack">
								<label><input type="radio" name="booking_range_selection_type" value="fixed" <?php checked( 'fixed', $settings['booking_range_selection_type'] ); ?> /> <span><?php esc_html_e( 'Select a fixed number of days with 1 mouse click', 'booking' ); ?></span></label>
								<label><input type="radio" name="booking_range_selection_type" value="dynamic" <?php checked( 'dynamic', $settings['booking_range_selection_type'] ); ?> /> <span><?php esc_html_e( 'Select a dynamic range of days with 2 mouse clicks', 'booking' ); ?></span></label>
							</div>
							<div class="wpbc_calendar_range_block" data-wpbc-calendar-range-type="fixed">
								<div class="wpbc_calendar_field_row">
									<label for="booking_range_selection_days_count"><?php esc_html_e( 'Days selection number', 'booking' ); ?></label>
									<input type="number" id="booking_range_selection_days_count" name="booking_range_selection_days_count" min="1" max="180" value="<?php echo esc_attr( $settings['booking_range_selection_days_count'] ); ?>" />
								</div>
								<div class="wpbc_calendar_field_row">
									<label><?php esc_html_e( 'Start day of range', 'booking' ); ?></label>
									<label><input type="radio" name="booking_range_start_day_mode" value="-1" <?php checked( '-1', $settings['booking_range_start_day'] ); ?> /> <?php esc_html_e( 'Any day of week', 'booking' ); ?></label>
									<label><input type="radio" name="booking_range_start_day_mode" value="specific" <?php checked( '-1' !== $settings['booking_range_start_day'] ); ?> /> <?php esc_html_e( 'Specific day(s) of week', 'booking' ); ?></label>
									<?php wpbc_settings_calendar__render_weekday_checks( 'booking_range_start_day_weekdays', $settings['booking_range_start_day'] ); ?>
								</div>
							</div>
							<div class="wpbc_calendar_range_block" data-wpbc-calendar-range-type="dynamic">
								<div class="wpbc_calendar_inline_fields">
									<div class="wpbc_calendar_field_row">
										<label for="booking_range_selection_days_count_dynamic"><?php esc_html_e( 'Min', 'booking' ); ?></label>
										<input type="number" id="booking_range_selection_days_count_dynamic" name="booking_range_selection_days_count_dynamic" min="1" max="1095" value="<?php echo esc_attr( $settings['booking_range_selection_days_count_dynamic'] ); ?>" />
									</div>
									<div class="wpbc_calendar_field_row">
										<label for="booking_range_selection_days_max_count_dynamic"><?php esc_html_e( 'Max', 'booking' ); ?></label>
										<input type="number" id="booking_range_selection_days_max_count_dynamic" name="booking_range_selection_days_max_count_dynamic" min="1" max="1095" value="<?php echo esc_attr( $settings['booking_range_selection_days_max_count_dynamic'] ); ?>" />
									</div>
								</div>
								<div class="wpbc_calendar_field_row">
									<label for="booking_range_selection_days_specific_num_dynamic"><?php esc_html_e( 'Specific days selections', 'booking' ); ?></label>
									<input type="text" id="booking_range_selection_days_specific_num_dynamic" name="booking_range_selection_days_specific_num_dynamic" value="<?php echo esc_attr( $settings['booking_range_selection_days_specific_num_dynamic'] ); ?>" placeholder="<?php esc_attr_e( 'Example: 7,14,21,28', 'booking' ); ?>" />
								</div>
								<div class="wpbc_calendar_field_row">
									<label><?php esc_html_e( 'Start day of range', 'booking' ); ?></label>
									<label><input type="radio" name="booking_range_start_day_dynamic_mode" value="-1" <?php checked( '-1', $settings['booking_range_start_day_dynamic'] ); ?> /> <?php esc_html_e( 'Any day of week', 'booking' ); ?></label>
									<label><input type="radio" name="booking_range_start_day_dynamic_mode" value="specific" <?php checked( '-1' !== $settings['booking_range_start_day_dynamic'] ); ?> /> <?php esc_html_e( 'Specific day(s) of week', 'booking' ); ?></label>
									<?php wpbc_settings_calendar__render_weekday_checks( 'booking_range_start_day_dynamic_weekdays', $settings['booking_range_start_day_dynamic'] ); ?>
								</div>
							</div>
						</div>
						<?php
					}
				);

				WPBC_UI_Sidebar_Panels::render_collapsible_group(
					array(
						'id'    => 'wpbc_calendar_time_group',
						'group' => 'settings-calendar-time',
						'title' => __( 'Changeover and Times', 'booking' ),
						'open'  => ( 'changeover_times' === $open_section ),
					),
					function () use ( $settings, $is_premium_lock ) {
						$time_options = wpbc_settings_calendar__get_time_options( $settings['booking_range_selection_start_time'] );
						$time_options = array_merge( $time_options, wpbc_settings_calendar__get_time_options( $settings['booking_range_selection_end_time'] ) );
						ksort( $time_options );
						?>
						<div class="wpbc_calendar_field_row">
							<?php
							wpbc_settings_calendar__render_checkbox(
								'booking_recurrent_time',
								__( 'Use selected times for each booking date', 'booking' ),
								__( 'Use selected times as booked time slots on each selected date.', 'booking' ),
								$settings
							);
							?>
						</div>
						<?php if ( ! $is_premium_lock || wpbc_settings_calendar__is_dismissed_visible( wpbc_settings_calendar__get_premium_option_dismiss_id( 'booking_last_checkout_day_available' ) ) ) : ?>
							<div class="wpbc_calendar_field_row">
								<?php
								wpbc_settings_calendar__render_checkbox(
									'booking_last_checkout_day_available',
									__( 'Set check out date as available', 'booking' ),
									__( 'Remove the last selected day from saving to the booking.', 'booking' ),
									$settings,
									$is_premium_lock
								);
								?>
							</div>
						<?php endif; ?>
						<?php if ( ! $is_premium_lock || wpbc_settings_calendar__is_dismissed_visible( wpbc_settings_calendar__get_premium_option_dismiss_id( 'booking_range_selection_time_is_active' ) ) ) : ?>
							<div class="wpbc_calendar_field_row">
								<?php
								wpbc_settings_calendar__render_checkbox(
									'booking_range_selection_time_is_active',
									__( 'Use changeover days', 'booking' ),
									__( 'Check-in/out days will be marked with vertical or diagonal lines.', 'booking' ),
									$settings,
									$is_premium_lock
								);
								?>
								<?php if ( $is_premium_lock ) : ?>
									<?php wpbc_settings_calendar__render_changeover_upgrade_note(); ?>
								<?php endif; ?>
							</div>
						<?php endif; ?>
						<div class="wpbc_calendar_subsettings" data-wpbc-calendar-changeover-settings="1">
							<div class="wpbc_calendar_inline_fields">
								<div class="wpbc_calendar_field_row">
									<label for="booking_range_selection_start_time"><?php esc_html_e( 'Check-in time', 'booking' ); ?></label>
									<?php wpbc_settings_calendar__render_select( 'booking_range_selection_start_time', $time_options, $settings['booking_range_selection_start_time'] ); ?>
								</div>
								<div class="wpbc_calendar_field_row">
									<label for="booking_range_selection_end_time"><?php esc_html_e( 'Check-Out time', 'booking' ); ?></label>
									<?php wpbc_settings_calendar__render_select( 'booking_range_selection_end_time', $time_options, $settings['booking_range_selection_end_time'] ); ?>
								</div>
							</div>
							<?php if ( ! $is_premium_lock || wpbc_settings_calendar__is_dismissed_visible( wpbc_settings_calendar__get_premium_option_dismiss_id( 'booking_change_over_days_triangles' ) ) ) : ?>
								<div class="wpbc_calendar_field_row">
									<?php
									wpbc_settings_calendar__render_checkbox(
										'booking_change_over_days_triangles',
										__( 'Change over days as triangles', 'booking' ),
										'',
										$settings,
										$is_premium_lock
									);
									?>
								</div>
							<?php endif; ?>
							<?php if ( ! $is_premium_lock || wpbc_settings_calendar__is_dismissed_visible( wpbc_settings_calendar__get_premium_option_dismiss_id( 'booking_change_over__is_excerpt_on_pages' ) ) ) : ?>
								<div class="wpbc_calendar_field_row">
									<?php
									wpbc_settings_calendar__render_checkbox(
										'booking_change_over__is_excerpt_on_pages',
										__( 'Do not use change over days on certain pages', 'booking' ),
										__( 'Activate exceptions for pages that should not use change over days.', 'booking' ),
										$settings,
										$is_premium_lock
									);
									?>
								</div>
							<?php endif; ?>
							<div class="wpbc_calendar_field_row">
								<label for="booking_change_over__excerpt_on_pages"><?php esc_html_e( 'Relative URLs of pages', 'booking' ); ?></label>
								<textarea id="booking_change_over__excerpt_on_pages" name="booking_change_over__excerpt_on_pages" rows="4" placeholder="/page-no-change-over/"><?php echo esc_textarea( $settings['booking_change_over__excerpt_on_pages'] ); ?></textarea>
							</div>
							<div class="wpbc_calendar_field_row">
								<label for="booking_change_over__excerpt_bk_resources"><?php esc_html_e( 'Booking resource IDs', 'booking' ); ?></label>
								<textarea id="booking_change_over__excerpt_bk_resources" name="booking_change_over__excerpt_bk_resources" rows="3" placeholder="17, 21, 34"><?php echo esc_textarea( $settings['booking_change_over__excerpt_bk_resources'] ); ?></textarea>
							</div>
						</div>
					<?php
					}
				);

				WPBC_UI_Sidebar_Panels::render_collapsible_group(
					array(
						'id'    => 'wpbc_calendar_legend_group',
						'group' => 'settings-calendar-legend',
						'title' => __( 'Calendar Legend', 'booking' ),
						'open'  => ( 'legend' === $open_section ),
					),
					function () use ( $settings ) {
						?>
						<div class="wpbc_calendar_field_row">
							<?php
							wpbc_settings_calendar__render_checkbox(
								'booking_is_show_legend',
								__( 'Show legend below calendar', 'booking' ),
								__( 'Check this box to display a legend of dates below the booking calendar.', 'booking' ),
								$settings
							);
							?>
						</div>
						<div class="wpbc_calendar_subsettings" data-wpbc-calendar-legend-settings="1">
							<div class="wpbc_calendar_legend_items_grid">
								<?php
								foreach ( wpbc_settings_calendar__get_legend_items_config() as $legend_item => $legend_config ) {
									wpbc_settings_calendar__render_legend_item_control( $legend_item, $legend_config, $settings );
								}
								?>
							</div>
							<div class="wpbc_calendar_field_row">
								<?php
								wpbc_settings_calendar__render_checkbox(
									'booking_legend_is_show_numbers',
									__( 'Show date number in legend', 'booking' ),
									__( 'Check this box to display today date number in legend cells.', 'booking' ),
									$settings
								);
								?>
							</div>
							<div class="wpbc_calendar_field_row">
								<?php
								wpbc_settings_calendar__render_checkbox(
									'booking_legend_is_vertical',
									__( 'Show legend items in a column', 'booking' ),
									__( 'Check this box to display legend items vertically in a column.', 'booking' ),
									$settings
								);
								?>
							</div>
						</div>
						<?php
					}
				);

				$settings['booking_show_timeslots_in_tooltip'] = wpbc_settings_calendar__is_timeslots_tooltip_enabled( $settings ) ? 'On' : 'Off';

				WPBC_UI_Sidebar_Panels::render_collapsible_group(
					array(
						'id'    => 'wpbc_calendar_tooltips_group',
						'group' => 'settings-calendar-tooltips',
						'title' => __( 'Calendar Dates Tooltips', 'booking' ),
						'open'  => ( 'tooltips' === $open_section ),
					),
					function () use ( $settings ) {
						?>
						<div class="wpbc_calendar_field_row">
							<?php
							wpbc_settings_calendar__render_checkbox(
								'booking_show_timeslots_in_tooltip',
								__( 'Show time slots in tooltips', 'booking' ),
								__( 'Show booked time slots in the tooltip when the mouse hovers over a booked day in the calendar.', 'booking' ),
								$settings
							);
							?>
						</div>
						<div class="wpbc_calendar_field_row" data-wpbc-calendar-timeslot-tooltip-settings="1">
							<label for="booking_highlight_timeslot_word"><?php esc_html_e( 'Title of booked timeslot(s)', 'booking' ); ?></label>
							<input type="text" id="booking_highlight_timeslot_word" name="booking_highlight_timeslot_word" value="<?php echo esc_attr( $settings['booking_highlight_timeslot_word'] ); ?>" placeholder="<?php esc_attr_e( 'Booked Times:', 'booking' ); ?>" />
							<p class="wpbc_calendar_description"><?php echo wp_kses_post( sprintf( __( 'Type your %1$stitle%2$s, what will show in mouseover tooltip near booked timeslot(s)', 'booking' ), '<b>', '</b>' ) ); ?></p>
						</div>
						<?php if ( class_exists( 'wpdev_bk_biz_l' ) ) : ?>
							<div class="wpbc_calendar_field_row">
								<?php
								wpbc_settings_calendar__render_checkbox(
									'booking_is_show_availability_in_tooltips',
									__( 'Show availability in tooltip', 'booking' ),
									__( 'Check this box to display the available number of booking resources with a tooltip, when mouse hovers over each day on the calendar(s).', 'booking' ),
									$settings
								);
								?>
							</div>
							<div class="wpbc_calendar_field_row" data-wpbc-calendar-availability-tooltip-settings="1">
								<label for="booking_highlight_availability_word"><?php esc_html_e( 'Availability Title', 'booking' ); ?></label>
								<input type="text" id="booking_highlight_availability_word" name="booking_highlight_availability_word" value="<?php echo esc_attr( $settings['booking_highlight_availability_word'] ); ?>" placeholder="<?php esc_attr_e( 'Available: ', 'booking' ); ?>" />
								<p class="wpbc_calendar_description"><?php echo wp_kses_post( sprintf( __( 'Type your %1$savailability%2$s description', 'booking' ), '<b>', '</b>' ) ); ?></p>
							</div>
							<div class="wpbc_calendar_field_row">
								<?php
								wpbc_settings_calendar__render_checkbox(
									'booking_is_show_availability_in_date_cell',
									__( 'Show availability in date cell', 'booking' ),
									__( 'Check this box to display the available number of booking resources at the date cells in the calendar(s).', 'booking' ),
									$settings
								);
								?>
							</div>
							<div class="wpbc_calendar_field_row" data-wpbc-calendar-availability-cell-settings="1">
								<label for="booking_highlight_availability_word_in_date_cell"><?php esc_html_e( 'Availability Title', 'booking' ); ?></label>
								<input type="text" id="booking_highlight_availability_word_in_date_cell" name="booking_highlight_availability_word_in_date_cell" value="<?php echo esc_attr( $settings['booking_highlight_availability_word_in_date_cell'] ); ?>" placeholder="<?php echo esc_attr( __( 'available', 'booking' ) . ' / ' . __( 'slots', 'booking' ) . ' / ' . __( 'rooms', 'booking' ) ); ?>" />
								<p class="wpbc_calendar_description"><?php echo wp_kses_post( sprintf( __( 'Type your %1$savailability%2$s description', 'booking' ), '<b>', '</b>' ) ); ?></p>
							</div>
						<?php else : ?>
							<?php
							wpbc_settings_calendar__render_locked_premium_checkbox(
								'booking_is_show_availability_in_tooltips',
								__( 'Show availability in tooltip', 'booking' ),
								__( 'Display the available number of booking resources in the day tooltip.', 'booking' ),
								'Business Large+'
							);
							wpbc_settings_calendar__render_locked_premium_checkbox(
								'booking_is_show_availability_in_date_cell',
								__( 'Show availability in date cell', 'booking' ),
								__( 'Display the available number of booking resources directly inside calendar date cells.', 'booking' ),
								'Business Large+'
							);
							?>
						<?php endif; ?>
						<?php if ( class_exists( 'wpdev_bk_biz_m' ) ) : ?>
							<div class="wpbc_calendar_field_row">
								<?php
								wpbc_settings_calendar__render_checkbox(
									'booking_is_show_cost_in_tooltips',
									__( 'Showing cost in tooltip', 'booking' ),
									__( 'Check this box to display the daily cost with a tooltip when mouse hovers over each day on the calendar(s).', 'booking' ),
									$settings
								);
								?>
							</div>
							<div class="wpbc_calendar_field_row" data-wpbc-calendar-cost-tooltip-settings="1">
								<label for="booking_highlight_cost_word"><?php esc_html_e( 'Cost Title', 'booking' ); ?></label>
								<input type="text" id="booking_highlight_cost_word" name="booking_highlight_cost_word" value="<?php echo esc_attr( $settings['booking_highlight_cost_word'] ); ?>" placeholder="<?php esc_attr_e( 'Cost: ', 'booking' ); ?>" />
								<p class="wpbc_calendar_description"><?php echo wp_kses_post( sprintf( __( 'Type your %1$scost%2$s description', 'booking' ), '<b>', '</b>' ) ); ?></p>
							</div>
							<div class="wpbc_calendar_field_row">
								<?php
								wpbc_settings_calendar__render_checkbox(
									'booking_is_show_cost_in_date_cell',
									__( 'Showing cost in date cell', 'booking' ),
									sprintf( __( 'Check this box to display the %1$sdaily cost at the date cells%2$s in the calendar(s).', 'booking' ), '<b>', '</b>' ),
									$settings
								);
								?>
							</div>
							<div class="wpbc_calendar_field_row" data-wpbc-calendar-cost-cell-settings="1">
								<label for="booking_cost_in_date_cell_currency"><?php esc_html_e( 'Currency symbol', 'booking' ); ?></label>
								<input type="text" id="booking_cost_in_date_cell_currency" name="booking_cost_in_date_cell_currency" value="<?php echo esc_attr( $settings['booking_cost_in_date_cell_currency'] ); ?>" placeholder="&#36;" />
								<p class="wpbc_calendar_description"><?php echo wp_kses_post( sprintf( __( 'Type your %1$scurrency symbol%2$s to display near daily cost in date cells.', 'booking' ), '<b>', '</b>' ) ); ?></p>
							</div>
							<div class="wpbc_calendar_field_row">
								<?php
								wpbc_settings_calendar__render_checkbox(
									'booking_is_show_booked_data_in_tooltips',
									__( 'Show booking details in tooltip', 'booking' ),
									__( 'Check this box to display booking details with a tooltip, when mouse hovers over each day on the usual month calendar(s).', 'booking' ),
									$settings
								);
								?>
							</div>
							<div class="wpbc_calendar_field_row" data-wpbc-calendar-booked-tooltip-settings="1">
								<label for="booking_booked_data_in_tooltips"><?php esc_html_e( 'Booking details', 'booking' ); ?></label>
								<input type="text" id="booking_booked_data_in_tooltips" name="booking_booked_data_in_tooltips" value="<?php echo esc_attr( $settings['booking_booked_data_in_tooltips'] ); ?>" placeholder="[name] [secondname]" />
								<p class="wpbc_calendar_description"><?php esc_html_e( 'You can use the shortcodes from the bottom form of Settings Fields page.', 'booking' ); ?></p>
							</div>
						<?php else : ?>
							<?php
							wpbc_settings_calendar__render_locked_premium_checkbox(
								'booking_is_show_cost_in_tooltips',
								__( 'Showing cost in tooltip', 'booking' ),
								__( 'Display the daily cost in the tooltip when the mouse hovers over a calendar day.', 'booking' ),
								'Business Medium+'
							);
							wpbc_settings_calendar__render_locked_premium_checkbox(
								'booking_is_show_cost_in_date_cell',
								__( 'Showing cost in date cell', 'booking' ),
								__( 'Display the daily cost directly inside calendar date cells.', 'booking' ),
								'Business Medium+'
							);
							wpbc_settings_calendar__render_locked_premium_checkbox(
								'booking_is_show_booked_data_in_tooltips',
								__( 'Show booking details in tooltip', 'booking' ),
								__( 'Display selected booking details in the tooltip when the mouse hovers over booked days.', 'booking' ),
								'Business Medium+'
							);
							?>
						<?php endif; ?>
						<?php
					}
				);

				WPBC_UI_Sidebar_Panels::render_collapsible_group(
					array(
						'id'    => 'wpbc_calendar_general_group',
						'group' => 'settings-calendar-general',
						'title' => __( 'Calendar General', 'booking' ),
						'open'  => ( 'general' === $open_section ),
					),
					function () use ( $settings ) {
						?>
						<div class="wpbc_calendar_field_row">
							<label for="booking_max_monthes_in_calendar"><?php esc_html_e( 'Number of months to scroll', 'booking' ); ?></label>
							<?php wpbc_settings_calendar__render_select( 'booking_max_monthes_in_calendar', wpbc_settings_calendar__get_max_month_options(), $settings['booking_max_monthes_in_calendar'] ); ?>
						</div>
						<div class="wpbc_calendar_field_row">
							<label for="booking_start_day_weeek"><?php esc_html_e( 'Start Day of the week', 'booking' ); ?></label>
							<?php wpbc_settings_calendar__render_select( 'booking_start_day_weeek', wpbc_settings_calendar__get_weekday_options(), $settings['booking_start_day_weeek'] ); ?>
						</div>
						<div class="wpbc_calendar_field_row">
							<?php
							wpbc_settings_calendar__render_checkbox(
								'booking_calendar_allow_several_months_on_mobile',
								__( 'Allow multiple months to be shown on mobile', 'booking' ),
								__( 'Enable this option to allow multiple months to be shown in the calendar on mobile devices.', 'booking' ),
								$settings
							);
							?>
						</div>
						<?php
					}
				);
				?>
			</div>
		</form>
		<?php
	}

	/**
	 * Notes panel content.
	 *
	 * @return void
	 */
	public function right_panel_notes_content() {

		?>
		<div class="wpbc_calendar_notes_panel">
			<?php WPBC_UI_Sidebar_Panels::render_inspector_header( __( 'Notes', 'booking' ), __( 'The preview uses the real booking calendar and applies the selected settings before saving.', 'booking' ) ); ?>
			<div class="wpbc_ts_hint wpbc_calendar_hint_bar">
				<span class="wpbc_icn_info_outline"></span>
				<?php esc_html_e( 'Premium options can be tested in the preview, but they are saved only when the installed edition supports them.', 'booking' ); ?>
			</div>
		</div>
		<?php
	}

	/**
	 * Page content.
	 *
	 * @return void
	 */
	public function content() {

		do_action( 'wpbc_hook_settings_page_header', 'page_settings_calendar' );

		if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_settings_calendar__get_manage_cap() ) ) {
			return false;
		}

		if ( function_exists( 'wpbc_js_for_bookings_page' ) ) {
			wpbc_js_for_bookings_page();
		}

		if ( $this->is_updated ) {
			wpbc_show_changes_saved_message();
		}

		$resource_id     = wpbc_settings_calendar__get_preview_resource_id();
		$months_count    = wpbc_settings_calendar__get_preview_months_count();
		$resources       = wpbc_settings_calendar__get_resources();
		$is_free_version = ! class_exists( 'wpdev_bk_personal' );
		?>
		<div class="wpbc_calendar_settings_page wpdevelop" data-wpbc-calendar-page="1" data-wpbc-calendar-resource-id="<?php echo esc_attr( $resource_id ); ?>">
			<form method="get" class="wpbc_calendar_toolbar wpbc_ts_toolbar wpbc_calendar_preview_controls" data-wpbc-calendar-preview-toolbar="1">
				<input type="hidden" name="page" value="wpbc-settings" />
				<input type="hidden" name="tab" value="calendar_settings" />
				<div class="wpbc_ts_control wpbc_calendar_control_resource">
					<label for="wpbc_calendar_resource_id"><?php esc_html_e( 'Booking resource', 'booking' ); ?></label>
					<?php if ( $is_free_version ) : ?>
						<input type="hidden" id="wpbc_calendar_resource_id" name="resource_id" value="<?php echo esc_attr( $resource_id ); ?>" />
						<div class="wpbc_calendar_toolbar_value">
							<i class="menu_icon icon-1x wpbc-bi-calendar2-day"></i>
							<span><?php echo esc_html( ! empty( $resources[0]['title'] ) ? $resources[0]['title'] : __( 'Default booking resource', 'booking' ) ); ?></span>
						</div>
						<?php
						$resource_dismiss_id = wpbc_settings_calendar__get_premium_option_dismiss_id( 'booking_resources' );
						if ( wpbc_settings_calendar__is_dismissed_visible( $resource_dismiss_id ) ) :
							?>
							<div id="<?php echo esc_attr( $resource_dismiss_id ); ?>" class="wpbc_calendar_upgrade_hint">
								<?php wpbc_settings_calendar__render_premium_label( 'Pro', '', $resource_dismiss_id ); ?>
								<span><?php esc_html_e( 'The Free version has one default booking resource. To have multiple resources, please upgrade to a premium version.', 'booking' ); ?></span>
							</div>
						<?php endif; ?>
					<?php else : ?>
						<select id="wpbc_calendar_resource_id" name="resource_id">
							<?php foreach ( $resources as $resource ) : ?>
								<option value="<?php echo esc_attr( $resource['id'] ); ?>" <?php selected( $resource_id, (int) $resource['id'] ); ?>><?php echo esc_html( $resource['title'] ); ?></option>
							<?php endforeach; ?>
						</select>
					<?php endif; ?>
				</div>
				<div class="wpbc_ts_control wpbc_calendar_control_months">
					<label for="wpbc_calendar_months_count"><?php esc_html_e( 'Months', 'booking' ); ?></label>
					<select id="wpbc_calendar_months_count" name="months_count">
						<?php foreach ( array( 1, 2, 3, 4, 6, 12 ) as $month_option ) : ?>
							<option value="<?php echo esc_attr( $month_option ); ?>" <?php selected( $months_count, $month_option ); ?>><?php echo esc_html( $month_option ); ?></option>
						<?php endforeach; ?>
					</select>
				</div>
			</form>
			<?php wpbc_settings_calendar__render_calendar_preview( $resource_id, $months_count ); ?>
			<div class="wpbc_calendar_settings_notes" data-wpbc-calendar-notes="1">
				<div class="wpbc_ts_hint wpbc_calendar_hint_bar">
					<span class="wpbc_icn_info_outline"></span>
					<?php esc_html_e( 'Preview how date selection behaves before saving the calendar settings.', 'booking' ); ?>
				</div>
			</div>
		</div>
		<?php

		do_action( 'wpbc_hook_settings_page_footer', 'page_settings_calendar' );
	}
}
add_action( 'wpbc_menu_created', array( new WPBC_Page_Settings_Calendar(), '__construct' ) );
