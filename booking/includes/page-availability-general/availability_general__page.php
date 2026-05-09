<?php
/**
 * General availability admin page.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Check whether the General Availability page is active.
 *
 * @return bool
 */
function wpbc_availability_general__is_page() {

	if ( ! is_admin() ) {
		return false;
	}

	if ( ! function_exists( 'wpbc_is_availability_page' ) || ! wpbc_is_availability_page() ) {
		return false;
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$active_tab = isset( $_REQUEST['tab'] ) ? sanitize_key( wp_unslash( $_REQUEST['tab'] ) ) : '';

	return ( 'general_availability' === $active_tab );
}

/**
 * Enqueue CSS for General Availability.
 *
 * @param string $where_to_load Where assets are loaded.
 *
 * @return void
 */
function wpbc_availability_general_enqueue_css_files( $where_to_load ) {

	if ( ( ! is_admin() ) || ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) ) ) {
		return;
	}

	if ( ! wpbc_availability_general__is_page() ) {
		return;
	}

	wp_enqueue_style(
		'wpbc-availability-general-page',
		trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/availability_general_page.css',
		array( 'wpbc-calendar', 'wpbc-all-admin' ),
		WP_BK_VERSION_NUM
	);
}
add_action( 'wpbc_enqueue_css_files', 'wpbc_availability_general_enqueue_css_files', 66 );

/**
 * Enqueue JS for General Availability.
 *
 * @param string $where_to_load Where assets are loaded.
 *
 * @return void
 */
function wpbc_availability_general_enqueue_js_files( $where_to_load ) {

	if ( ( ! is_admin() ) || ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) ) ) {
		return;
	}

	if ( ! wpbc_availability_general__is_page() ) {
		return;
	}

	wp_enqueue_script(
		'wpbc-availability-general-page',
		trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/availability_general_page.js',
		array( 'jquery', 'wpbc_all' ),
		WP_BK_VERSION_NUM,
		array( 'in_footer' => WPBC_JS_IN_FOOTER )
	);

	wp_localize_script(
		'wpbc-availability-general-page',
		'wpbc_availability_general_page',
		array(
			'ajax_url'       => admin_url( 'admin-ajax.php' ),
			'nonce'          => wp_create_nonce( 'wpbc_availability_general_ajax_nonce' ),
			'action'         => 'WPBC_AJX_AVAILABILITY_GENERAL_SAVE',
			'preview_action' => 'WPBC_AJX_AVAILABILITY_GENERAL_PREVIEW',
			'default_settings' => wpbc_availability_general__get_default_settings(),
			'is_buffer_available' => class_exists( 'wpdev_bk_biz_m' ),
			'is_available_limit_available' => class_exists( 'wpdev_bk_biz_m' ),
			'i18n'           => array(
				'saving'         => __( 'Saving', 'booking' ),
				'saved'          => __( 'General availability settings updated.', 'booking' ),
				'reset_applied'  => __( 'Default availability settings are ready for preview. Click Save Changes to apply them.', 'booking' ),
				'save_failed'    => __( 'Unable to save general availability settings.', 'booking' ),
				'reset_confirm'  => __( 'Reset controls to default values? Saved settings will not change until you click Save Changes.', 'booking' ),
				'preview_failed' => __( 'Unable to refresh calendar preview.', 'booking' ),
				'security_error' => __( 'Security check failed.', 'booking' ),
				'loading'        => __( 'Loading', 'booking' ),
				'buffer_preview' => __( 'Buffer preview', 'booking' ),
				'before_booking' => __( 'Before booking', 'booking' ),
				'after_booking'  => __( 'After booking', 'booking' ),
				'no_buffer'      => __( 'No booking buffer is selected.', 'booking' ),
			),
		)
	);
}
add_action( 'wpbc_enqueue_js_files', 'wpbc_availability_general_enqueue_js_files', 66 );

/**
 * Print tooltip initializer for General Availability.
 *
 * @return void
 */
function wpbc_availability_general_print_tooltip_js() {

	if ( ! wpbc_availability_general__is_page() ) {
		return;
	}

	if ( function_exists( 'wpbc_bs_javascript_tooltips' ) ) {
		wpbc_bs_javascript_tooltips();
	}
}
add_action( 'admin_footer', 'wpbc_availability_general_print_tooltip_js', 67 );

/**
 * Get resource options.
 *
 * @return array
 */
function wpbc_availability_general__get_resources() {

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
			'id'    => function_exists( 'wpbc_get_default_resource' ) ? (int) wpbc_get_default_resource() : 1,
			'title' => __( 'Booking resource', 'booking' ),
		);
	}

	return $resources;
}

/**
 * Get capability required to manage General Availability.
 *
 * @return string
 */
function wpbc_availability_general__get_manage_cap() {

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
 * Get selected resource ID for preview.
 *
 * @return int
 */
function wpbc_availability_general__get_preview_resource_id() {

	$resources        = wpbc_availability_general__get_resources();
	$default_resource = isset( $resources[0]['id'] ) ? (int) $resources[0]['id'] : 1;

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$resource_id = isset( $_REQUEST['resource_id'] ) ? absint( wp_unslash( $_REQUEST['resource_id'] ) ) : $default_resource;
	$resource_ids = wp_list_pluck( $resources, 'id' );

	return in_array( $resource_id, $resource_ids, true ) ? $resource_id : $default_resource;
}

/**
 * Get selected month count for preview.
 *
 * @return int
 */
function wpbc_availability_general__get_preview_months_count() {

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$months = isset( $_REQUEST['months_count'] ) ? absint( wp_unslash( $_REQUEST['months_count'] ) ) : 6;

	return in_array( $months, array( 1, 2, 3, 4, 6, 12 ), true ) ? $months : 6;
}

/**
 * Validate preview resource ID.
 *
 * @param int $resource_id Resource ID.
 *
 * @return int
 */
function wpbc_availability_general__sanitize_preview_resource_id( $resource_id ) {

	$resources        = wpbc_availability_general__get_resources();
	$default_resource = isset( $resources[0]['id'] ) ? (int) $resources[0]['id'] : 1;
	$resource_ids     = wp_list_pluck( $resources, 'id' );

	return in_array( (int) $resource_id, $resource_ids, true ) ? (int) $resource_id : $default_resource;
}

/**
 * Validate preview months count.
 *
 * @param int $months_count Number of months.
 *
 * @return int
 */
function wpbc_availability_general__sanitize_preview_months_count( $months_count ) {

	$months_count = absint( $months_count );

	return in_array( $months_count, array( 1, 2, 3, 4, 6, 12 ), true ) ? $months_count : 6;
}

/**
 * Get unavailable-from-today select options.
 *
 * @return array
 */
function wpbc_availability_general__get_unavailable_from_today_options() {

	$options = array( '0' => ' - ' );

	foreach ( range( 5, 55, 5 ) as $extra_num ) {
		$options[ $extra_num . 'm' ] = $extra_num . ' ' . __( 'minutes', 'booking' );
	}
	$options['60m'] = '1 ' . __( 'hour', 'booking' );
	foreach ( range( 65, 115, 5 ) as $extra_num ) {
		$options[ $extra_num . 'm' ] = '1 ' . __( 'hour', 'booking' ) . ' ' . ( $extra_num - 60 ) . ' ' . __( 'minutes', 'booking' );
	}
	foreach ( range( 120, 1380, 60 ) as $extra_num ) {
		$options[ $extra_num . 'm' ] = ( $extra_num / 60 ) . ' ' . __( 'hours', 'booking' );
	}

	$options['1'] = '1 ' . __( 'day', 'booking' );
	for ( $ii = 2; $ii < 92; $ii++ ) {
		$options[ (string) $ii ] = $ii . ' ' . __( 'days', 'booking' );
	}

	return $options;
}

/**
 * Get available-from-today select options.
 *
 * @return array
 */
function wpbc_availability_general__get_available_from_today_options() {

	$options = array( '' => ' - ' );

	foreach ( range( 1, 365 ) as $value ) {
		$options[ (string) $value ] = (string) $value;
	}

	return $options;
}

/**
 * Get minute buffer options.
 *
 * @return array
 */
function wpbc_availability_general__get_buffer_minutes_options() {

	$options = array( '' => ' - ' );

	foreach ( range( 5, 55, 5 ) as $extra_num ) {
		$options[ $extra_num . 'm' ] = $extra_num . ' ' . __( 'minutes', 'booking' );
	}
	$options['60m'] = '1 ' . __( 'hour', 'booking' );
	foreach ( range( 65, 115, 5 ) as $extra_num ) {
		$options[ $extra_num . 'm' ] = '1 ' . __( 'hour', 'booking' ) . ' ' . ( $extra_num - 60 ) . ' ' . __( 'minutes', 'booking' );
	}
	foreach ( range( 120, 1380, 60 ) as $extra_num ) {
		$options[ $extra_num . 'm' ] = ( $extra_num / 60 ) . ' ' . __( 'hours', 'booking' );
	}

	return $options;
}

/**
 * Get day buffer options.
 *
 * @return array
 */
function wpbc_availability_general__get_buffer_days_options() {

	$options = array( '' => ' - ' );

	foreach ( range( 1, 30 ) as $extra_num ) {
		$options[ $extra_num . 'd' ] = $extra_num . ' ' . __( 'day(s)', 'booking' );
	}

	return $options;
}

/**
 * Get time options for future working-time controls.
 *
 * @param string $selected Selected value.
 *
 * @return array
 */
function wpbc_availability_general__get_working_time_options( $selected = '' ) {

	$options = array();

	for ( $minutes = 0; $minutes <= 1440; $minutes += 30 ) {
		$hours = (int) floor( $minutes / 60 );
		$mins  = $minutes % 60;
		$value = sprintf( '%02d:%02d', $hours, $mins );
		$label = ( 1440 === $minutes ) ? '24:00' : $value;

		$options[ $value ] = $label;
	}

	if ( '' !== $selected && ! isset( $options[ $selected ] ) ) {
		$options[ $selected ] = $selected;
	}

	return $options;
}

/**
 * Render a select field.
 *
 * @param string $name     Field name.
 * @param array  $options  Options.
 * @param string $selected Selected value.
 * @param array  $args     Extra args.
 *
 * @return void
 */
function wpbc_availability_general__render_select( $name, $options, $selected, $args = array() ) {

	$args = wp_parse_args(
		$args,
		array(
			'id'       => $name,
			'class'    => 'wpbc_ag_field_control',
			'disabled' => false,
		)
	);
	?>
	<select id="<?php echo esc_attr( $args['id'] ); ?>" name="<?php echo esc_attr( $name ); ?>" class="<?php echo esc_attr( $args['class'] ); ?>" <?php disabled( $args['disabled'] ); ?>>
		<?php foreach ( $options as $value => $label ) : ?>
			<option value="<?php echo esc_attr( $value ); ?>" <?php selected( (string) $selected, (string) $value ); ?>><?php echo esc_html( $label ); ?></option>
		<?php endforeach; ?>
	</select>
	<?php
}

/**
 * Get default General Availability settings.
 *
 * @return array
 */
function wpbc_availability_general__get_default_settings() {

	return array(
		'weekdays'                                => array(),
		'booking_unavailable_days_num_from_today' => '0',
		'booking_available_days_num_from_today'   => '',
		'booking_unavailable_extra_in_out'        => '',
		'booking_unavailable_extra_minutes_in'    => '',
		'booking_unavailable_extra_minutes_out'   => '',
		'booking_unavailable_extra_days_in'       => '',
		'booking_unavailable_extra_days_out'      => '',
	);
}

/**
 * Validate posted settings.
 *
 * @param array $post_data Raw post data.
 *
 * @return array
 */
function wpbc_availability_general__validate_data( $post_data ) {

	$cleaned = wpbc_availability_general__get_default_settings();

	if ( isset( $post_data['booking_unavailable_days'] ) && is_array( $post_data['booking_unavailable_days'] ) ) {
		foreach ( $post_data['booking_unavailable_days'] as $day_num ) {
			$day_num = absint( $day_num );
			if ( $day_num >= 0 && $day_num <= 6 ) {
				$cleaned['weekdays'][] = $day_num;
			}
		}
	}

	if ( isset( $post_data['booking_unavailable_days_num_from_today'] ) ) {
		$value = sanitize_text_field( wp_unslash( $post_data['booking_unavailable_days_num_from_today'] ) );
		if ( preg_match( '/^\d+m$/', $value ) || preg_match( '/^\d+$/', $value ) ) {
			$cleaned['booking_unavailable_days_num_from_today'] = $value;
		}
	}

	if ( isset( $post_data['booking_available_days_num_from_today'] ) ) {
		$value = sanitize_text_field( wp_unslash( $post_data['booking_available_days_num_from_today'] ) );
		$cleaned['booking_available_days_num_from_today'] = ( '' === $value ) ? '' : (string) absint( $value );
	}

	if ( isset( $post_data['booking_unavailable_extra_in_out'] ) ) {
		$value = sanitize_text_field( wp_unslash( $post_data['booking_unavailable_extra_in_out'] ) );
		$cleaned['booking_unavailable_extra_in_out'] = in_array( $value, array( '', 'm', 'd' ), true ) ? $value : '';
	}

	foreach ( array( 'booking_unavailable_extra_minutes_in', 'booking_unavailable_extra_minutes_out' ) as $key ) {
		if ( isset( $post_data[ $key ] ) ) {
			$value = sanitize_text_field( wp_unslash( $post_data[ $key ] ) );
			$cleaned[ $key ] = preg_match( '/^\d+m$/', $value ) ? $value : '';
		}
	}

	foreach ( array( 'booking_unavailable_extra_days_in', 'booking_unavailable_extra_days_out' ) as $key ) {
		if ( isset( $post_data[ $key ] ) ) {
			$value = sanitize_text_field( wp_unslash( $post_data[ $key ] ) );
			$cleaned[ $key ] = preg_match( '/^\d+d$/', $value ) ? $value : '';
		}
	}

	return $cleaned;
}

/**
 * Update settings.
 *
 * @param array $cleaned_data Cleaned settings.
 *
 * @return void
 */
function wpbc_availability_general__update_settings( $cleaned_data ) {

	for ( $i = 0; $i < 7; $i++ ) {
		update_bk_option( 'booking_unavailable_day' . $i, in_array( $i, $cleaned_data['weekdays'], true ) ? 'On' : 'Off' );
	}

	update_bk_option( 'booking_unavailable_days_num_from_today', $cleaned_data['booking_unavailable_days_num_from_today'] );

	if ( class_exists( 'wpdev_bk_biz_m' ) ) {
		update_bk_option( 'booking_available_days_num_from_today', $cleaned_data['booking_available_days_num_from_today'] );
		update_bk_option( 'booking_unavailable_extra_in_out', $cleaned_data['booking_unavailable_extra_in_out'] );
		update_bk_option( 'booking_unavailable_extra_minutes_in', $cleaned_data['booking_unavailable_extra_minutes_in'] );
		update_bk_option( 'booking_unavailable_extra_minutes_out', $cleaned_data['booking_unavailable_extra_minutes_out'] );
		update_bk_option( 'booking_unavailable_extra_days_in', $cleaned_data['booking_unavailable_extra_days_in'] );
		update_bk_option( 'booking_unavailable_extra_days_out', $cleaned_data['booking_unavailable_extra_days_out'] );
	}
}

/**
 * Get current settings prepared for JavaScript and AJAX responses.
 *
 * @return array
 */
function wpbc_availability_general__get_settings_response() {

	$hints     = function_exists( 'wpbc_get_unavailable_from_today_hints_arr' ) ? wpbc_get_unavailable_from_today_hints_arr() : array();
	$weekdays  = array();

	for ( $i = 0; $i < 7; $i++ ) {
		if ( 'On' === get_bk_option( 'booking_unavailable_day' . $i ) ) {
			$weekdays[] = $i;
		}
	}

	return array(
		'weekdays'                                => $weekdays,
		'booking_unavailable_days_num_from_today' => get_bk_option( 'booking_unavailable_days_num_from_today' ),
		'booking_available_days_num_from_today'   => get_bk_option( 'booking_available_days_num_from_today' ),
		'booking_unavailable_extra_in_out'        => get_bk_option( 'booking_unavailable_extra_in_out' ),
		'booking_unavailable_extra_minutes_in'    => get_bk_option( 'booking_unavailable_extra_minutes_in' ),
		'booking_unavailable_extra_minutes_out'   => get_bk_option( 'booking_unavailable_extra_minutes_out' ),
		'booking_unavailable_extra_days_in'       => get_bk_option( 'booking_unavailable_extra_days_in' ),
		'booking_unavailable_extra_days_out'      => get_bk_option( 'booking_unavailable_extra_days_out' ),
		'hints'                                   => array(
			'booking_unavailable_days_num_from_today__hint' => isset( $hints['booking_unavailable_days_num_from_today__hint'] ) ? $hints['booking_unavailable_days_num_from_today__hint'] : '',
			'booking_available_days_num_from_today__hint'   => isset( $hints['booking_available_days_num_from_today__hint'] ) ? $hints['booking_available_days_num_from_today__hint'] : '',
		),
	);
}

/**
 * Render booking resource calendar preview.
 *
 * @param int $resource_id  Resource ID.
 * @param int $months_count Number of months.
 *
 * @return void
 */
function wpbc_availability_general__render_calendar_preview( $resource_id, $months_count ) {

	$resource_id   = wpbc_availability_general__sanitize_preview_resource_id( $resource_id );
	$months_count  = wpbc_availability_general__sanitize_preview_months_count( $months_count );
	$months_in_row = min( 3, max( 1, $months_count ) );
	$calendar_css_class_outer = 'wpbc_calendar_wraper';

	if ( 'Off' !== get_bk_option( 'booking_change_over_days_triangles' ) ) {
		$calendar_css_class_outer .= ' wpbc_change_over_triangle';
	}
	?>
	<div class="wpbc_ag_calendar_panel" data-wpbc-ag-calendar-panel="1" data-resource-id="<?php echo esc_attr( $resource_id ); ?>" data-months-count="<?php echo esc_attr( $months_count ); ?>">
		<div class="<?php echo esc_attr( $calendar_css_class_outer ); ?>">
			<div class="bk_calendar_frame months_num_in_row_<?php echo esc_attr( $months_in_row ); ?> cal_month_num_<?php echo esc_attr( $months_count ); ?>">
				<div id="calendar_booking<?php echo esc_attr( $resource_id ); ?>"><?php esc_html_e( 'Calendar is loading...', 'booking' ); ?></div>
			</div>
		</div>
		<textarea rows="3" cols="50" id="date_booking<?php echo esc_attr( $resource_id ); ?>" name="date_booking<?php echo esc_attr( $resource_id ); ?>" autocomplete="off" hidden></textarea>
		<?php
		if ( function_exists( 'wpbc__calendar__load' ) ) {
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
				)
			);
			echo $start_script_code; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		}
		?>
	</div>
	<?php
}

/**
 * Render select field with previous / next stepper buttons.
 *
 * @param string $name     Field name.
 * @param array  $options  Options.
 * @param string $selected Selected value.
 * @param array  $args     Extra args.
 *
 * @return void
 */
function wpbc_availability_general__render_select_with_stepper( $name, $options, $selected, $args = array() ) {

	$args = wp_parse_args(
		$args,
		array(
			'id'       => $name,
			'disabled' => false,
		)
	);
	?>
	<div class="wpbc_ag_stepper_control" data-wpbc-ag-stepper-wrap="<?php echo esc_attr( $name ); ?>">
		<button type="button" class="button button-secondary wpbc_button_no_background wpbc_ag_stepper_button" data-wpbc-ag-stepper="<?php echo esc_attr( $name ); ?>" data-step="-1" aria-label="<?php esc_attr_e( 'Decrease value', 'booking' ); ?>" <?php disabled( $args['disabled'] ); ?>>
			<i class="menu_icon icon-1x wpbc_icn_keyboard_arrow_left"></i>
		</button>
		<?php
		wpbc_availability_general__render_select(
			$name,
			$options,
			$selected,
			array(
				'id'       => $args['id'],
				'disabled' => $args['disabled'],
			)
		);
		?>
		<button type="button" class="button button-secondary wpbc_button_no_background wpbc_ag_stepper_button" data-wpbc-ag-stepper="<?php echo esc_attr( $name ); ?>" data-step="1" aria-label="<?php esc_attr_e( 'Increase value', 'booking' ); ?>" <?php disabled( $args['disabled'] ); ?>>
			<i class="menu_icon icon-1x wpbc_icn_keyboard_arrow_right"></i>
		</button>
	</div>
	<?php
}

/**
 * Render select field with an attached range slider.
 *
 * @param string $name     Field name.
 * @param array  $options  Options.
 * @param string $selected Selected value.
 * @param array  $args     Extra args.
 *
 * @return void
 */
function wpbc_availability_general__render_select_with_slider( $name, $options, $selected, $args = array() ) {

	$args = wp_parse_args(
		$args,
		array(
			'disabled'     => false,
			'slider_label' => __( 'Adjust value', 'booking' ),
		)
	);

	$option_values  = array_keys( $options );
	$selected_index = 0;

	foreach ( $option_values as $option_index => $option_value ) {
		if ( (string) $selected === (string) $option_value ) {
			$selected_index = (int) $option_index;
			break;
		}
	}

	wpbc_availability_general__render_select( $name, $options, $selected, $args );
	?>
	<div class="wpbc_ag_range_control" data-wpbc-ag-range-wrap="<?php echo esc_attr( $name ); ?>">
		<input type="range" min="0" max="<?php echo esc_attr( max( 0, count( $options ) - 1 ) ); ?>" step="1" value="<?php echo esc_attr( $selected_index ); ?>" data-wpbc-ag-range-for="<?php echo esc_attr( $name ); ?>" aria-label="<?php echo esc_attr( $args['slider_label'] ); ?>" <?php disabled( $args['disabled'] ); ?> />
		<span class="wpbc_ag_range_value" data-wpbc-ag-range-value-for="<?php echo esc_attr( $name ); ?>"><?php echo esc_html( isset( $options[ $option_values[ $selected_index ] ] ) ? $options[ $option_values[ $selected_index ] ] : '' ); ?></span>
	</div>
	<?php
}

/**
 * Show General Availability save button in top toolbar.
 *
 * @param string $page_tag Current page tag.
 * @param string $active_page_tab Current tab.
 * @param string $active_page_subtab Current subtab.
 *
 * @return void
 */
function wpbc_availability_general__top_toolbar__show_save_button( $page_tag, $active_page_tab, $active_page_subtab ) {

	if ( ( 'wpbc-availability' !== $page_tag ) || ( 'general_availability' !== $active_page_tab ) ) {
		return;
	}

	if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_availability_general__get_manage_cap() ) ) {
		return;
	}
	?>
	<div class="wpbc_ui_el__buttons_group wpbc_ag__top_toolbar_group">
		<a  href="javascript:void(0);"
			class="button button-secondary wpbc_ag__top_btn_reset"
			data-wpbc-ag-reset="1">
			<i class="menu_icon icon-1x wpbc_icn_rotate_left"></i>
			<span class="in-button-text">&nbsp;&nbsp;<?php esc_html_e( 'Reset', 'booking' ); ?></span>
		</a>
		<a  href="javascript:void(0);"
			class="button button-primary wpbc_ag__top_btn_save"
			data-wpbc-ag-save="1"
			data-wpbc-u-busy-text="<?php esc_attr_e( 'Saving', 'booking' ); ?>...">
			<i class="menu_icon icon-1x wpbc-bi-check2-circle"></i>
			<span class="in-button-text">&nbsp;&nbsp;<?php esc_html_e( 'Save Changes', 'booking' ); ?></span>
		</a>
	</div>
	<?php
}
add_action( 'wpbc_ui_el__top_nav__content_end', 'wpbc_availability_general__top_toolbar__show_save_button', 20, 3 );

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
function wpbc_availability_general__check_showing_page( $is_show_this_page, $page_tag, $active_page_tab, $active_page_subtab ) {

	if ( ( 'wpbc-availability' === $page_tag ) && ( 'general_availability' === $active_page_tab ) && ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_availability_general__get_manage_cap() ) ) ) {
		return false;
	}

	return $is_show_this_page;
}
add_filter( 'wpbc_before_showing_settings_page_is_show_page', 'wpbc_availability_general__check_showing_page', 20, 4 );

/**
 * General Availability tab.
 */
class WPBC_Page_Availability_General_Dedicated extends WPBC_Page_Structure {

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

		if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_availability_general__get_manage_cap() ) ) {
			return (string) wp_rand( 100000, 1000000 );
		}

		return 'wpbc-availability';
	}

	/**
	 * Register tab.
	 *
	 * @return array
	 */
	public function tabs() {

		$tabs = array();

		$tabs['general_availability'] = array(
			'is_show_top_path'                          => false,
			'right_vertical_sidebar__is_show'           => true,
			'right_vertical_sidebar__default_view_mode' => '',
			'right_vertical_sidebar_compact__is_show'   => true,
			'left_navigation__default_view_mode'        => 'compact',
			'title'                                     => __( 'General Availability', 'booking' ) .
														   '<span class="wpbc_new_label" style="margin-left: auto;">' . esc_html__( 'New', 'booking' ) . '</span>',
			'hint'                                      => __( 'Define global front-end availability rules for all calendars, including unavailable weekdays, booking buffers, and availability limits.', 'booking' ),
			'page_title'                                => __( 'General Availability', 'booking' ),
			'link'                                      => '',
			'position'                                  => '',
			'css_classes'                               => 'wpbc_top_tab__general_availability',
			'icon'                                      => '',
			'font_icon'                                 => 'wpbc-bi-calendar2-day',
			'font_icon_right'                           => '',
			'default'                                   => false,
			'disabled'                                  => false,
			'hided'                                     => false,
			'subtabs'                                   => array(),
			'folder_style'                              => 'order:93;',
		);

		return $tabs;
	}

	/**
	 * Save settings.
	 *
	 * @return void
	 */
	public function maybe_update() {

		$form_name = 'wpbc_availability_general_form';

		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		if ( ! isset( $_POST[ 'is_form_submitted_' . $form_name ] ) ) {
			return;
		}

		check_admin_referer( 'wpbc_settings_page_' . $form_name );

		if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_availability_general__get_manage_cap() ) ) {
			return;
		}

		$cleaned_data = wpbc_availability_general__validate_data( $_POST ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		wpbc_availability_general__update_settings( $cleaned_data );

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
					'id'       => 'wpbc_tab_ag_settings',
					'panel_id' => 'wpbc_ag__inspector_settings',
					'title'    => __( 'Settings', 'booking' ),
					'icon'     => 'wpbc_icn_tune',
					'selected' => true,
				),
				array(
					'id'       => 'wpbc_tab_ag_notes',
					'panel_id' => 'wpbc_ag__inspector_notes',
					'title'    => __( 'Notes', 'booking' ),
					'icon'     => 'wpbc-bi-info-circle',
				),
			),
			array(
				'aria_label' => __( 'General Availability Panels', 'booking' ),
				'context'    => 'general_availability',
				'class'      => 'wpbc_ag_rightbar_tabs',
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
		<div class="wpbc_bfb__panel--library wpbc_rightbar_palette wpbc_ag_rightbar_panels">
			<?php
			WPBC_UI_Sidebar_Panels::render_panel(
				array(
					'id'         => 'wpbc_ag__inspector_settings',
					'labelledby' => 'wpbc_tab_ag_settings',
					'class'      => 'wpbc_ag__inspector_settings',
				),
				array( $this, 'right_panel_settings_content' )
			);

			WPBC_UI_Sidebar_Panels::render_panel(
				array(
					'id'         => 'wpbc_ag__inspector_notes',
					'labelledby' => 'wpbc_tab_ag_notes',
					'class'      => 'wpbc_ag__inspector_notes',
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

		$form_name              = 'wpbc_availability_general_form';
		$hints                  = function_exists( 'wpbc_get_unavailable_from_today_hints_arr' ) ? wpbc_get_unavailable_from_today_hints_arr() : array();
		$buffer_type            = (string) get_bk_option( 'booking_unavailable_extra_in_out' );
		$is_buffer_available    = class_exists( 'wpdev_bk_biz_m' );
		$is_available_limit_available = class_exists( 'wpdev_bk_biz_m' );
		$unavailable_weekdays   = array();

		for ( $i = 0; $i < 7; $i++ ) {
			if ( 'On' === get_bk_option( 'booking_unavailable_day' . $i ) ) {
				$unavailable_weekdays[] = $i;
			}
		}

		WPBC_UI_Sidebar_Panels::render_inspector_header( __( 'General Availability', 'booking' ), __( 'Global front-end availability rules for all calendars.', 'booking' ) );
		?>
		<form method="post" id="<?php echo esc_attr( $form_name ); ?>" class="wpbc_ag_settings_form" data-wpbc-ag-settings-form="1">
			<?php wp_nonce_field( 'wpbc_settings_page_' . $form_name ); ?>
			<input type="hidden" name="is_form_submitted_<?php echo esc_attr( $form_name ); ?>" value="1" />
			<div class="wpbc_bfb__inspector__body wpbc_ag_inspector_body">
				<?php
				WPBC_UI_Sidebar_Panels::render_collapsible_group(
					array(
						'id'    => 'wpbc_ag_weekdays_group',
						'group' => 'general-availability-weekdays',
						'title' => __( 'Unavailable Weekdays', 'booking' ),
						'open'  => true,
					),
					function () use ( $unavailable_weekdays ) {
						$days           = array(
							0 => __( 'Sunday', 'booking' ),
							1 => __( 'Monday', 'booking' ),
							2 => __( 'Tuesday', 'booking' ),
							3 => __( 'Wednesday', 'booking' ),
							4 => __( 'Thursday', 'booking' ),
							5 => __( 'Friday', 'booking' ),
							6 => __( 'Saturday', 'booking' ),
						);
						$start_week_day = absint( get_bk_option( 'booking_start_day_weeek' ) );
						if ( $start_week_day > 6 ) {
							$start_week_day = 0;
						}
						$days_ordered = array_slice( $days, $start_week_day, null, true ) + array_slice( $days, 0, $start_week_day, true );
						?>
						<div class="wpbc_ag_weekday_grid">
							<?php foreach ( $days_ordered as $day_num => $day_title ) : ?>
								<label class="wpbc_ag_switch">
									<input type="checkbox" name="booking_unavailable_days[]" value="<?php echo esc_attr( $day_num ); ?>" <?php checked( in_array( $day_num, $unavailable_weekdays, true ) ); ?> />
									<span class="wpbc_ag_switch_control" aria-hidden="true"><span class="wpbc_ag_switch_knob"></span></span>
									<span class="wpbc_ag_switch_label"><?php echo esc_html( $day_title ); ?></span>
								</label>
							<?php endforeach; ?>
						</div>
						<p class="wpbc_ag_description"><?php esc_html_e( 'Selected weekdays will be unavailable in calendars and override other availability settings.', 'booking' ); ?></p>
						<?php
					}
				);

				WPBC_UI_Sidebar_Panels::render_collapsible_group(
					array(
						'id'    => 'wpbc_ag_today_group',
						'group' => 'general-availability-from-today',
						'title' => __( 'Availability From Today', 'booking' ),
						'open'  => true,
					),
					function () use ( $hints, $is_available_limit_available ) {
						?>
						<div class="wpbc_ag_field_row">
							<label class="wpbc_ag_field_label" for="booking_unavailable_days_num_from_today"><?php esc_html_e( 'Unavailable time from current time', 'booking' ); ?></label>
							<?php
							wpbc_availability_general__render_select_with_slider(
								'booking_unavailable_days_num_from_today',
								wpbc_availability_general__get_unavailable_from_today_options(),
								get_bk_option( 'booking_unavailable_days_num_from_today' ),
								array( 'slider_label' => __( 'Adjust unavailable time from current time', 'booking' ) )
							);
							?>
							<code class="wpbc_ag_hint" data-wpbc-ag-hint="booking_unavailable_days_num_from_today"><span class="wpbc_ag_hint_unavailable"><?php esc_html_e( 'Unavailable', 'booking' ); ?></span><?php echo wp_kses_post( isset( $hints['booking_unavailable_days_num_from_today__hint'] ) ? $hints['booking_unavailable_days_num_from_today__hint'] : '' ); ?></code>
						</div>
						<div class="wpbc_ag_field_row">
							<label class="wpbc_ag_field_label" for="booking_available_days_num_from_today"><?php esc_html_e( 'Limit available days from today', 'booking' ); ?></label>
							<?php if ( ! $is_available_limit_available ) : ?>
								<div class="wpbc_ag_upgrade_required">
									<a class="wpbc_pro_label" href="<?php echo esc_url( 'https://wpbookingcalendar.com/features/' ); ?>" target="_blank">Pro | BM+</a>
									<span><?php esc_html_e( 'Limit available days from today is available only in Booking Calendar Business Medium or higher versions.', 'booking' ); ?></span>
								</div>
							<?php endif; ?>
							<div class="<?php echo $is_available_limit_available ? '' : 'wpbc_ag_is_locked'; ?>">
							<?php
							wpbc_availability_general__render_select_with_slider(
								'booking_available_days_num_from_today',
								wpbc_availability_general__get_available_from_today_options(),
								get_bk_option( 'booking_available_days_num_from_today' ),
								array(
									'slider_label' => __( 'Adjust available days limit', 'booking' ),
									'disabled'     => ! $is_available_limit_available,
								)
							);
							?>
							</div>
							<code class="wpbc_ag_hint" data-wpbc-ag-hint="booking_available_days_num_from_today"><span class="wpbc_ag_hint_available"><?php esc_html_e( 'Available', 'booking' ); ?></span><?php echo wp_kses_post( isset( $hints['booking_available_days_num_from_today__hint'] ) ? $hints['booking_available_days_num_from_today__hint'] : '' ); ?></code>
						</div>
						<?php
					}
				);

				WPBC_UI_Sidebar_Panels::render_collapsible_group(
					array(
						'id'    => 'wpbc_ag_buffer_group',
						'group' => 'general-availability-buffer',
						'title' => __( 'Booking Buffer', 'booking' ),
						'open'  => true,
					),
					function () use ( $buffer_type, $is_buffer_available ) {
						?>
						<?php if ( ! $is_buffer_available ) : ?>
							<div class="wpbc_ag_upgrade_required">
								<a class="wpbc_pro_label" href="<?php echo esc_url( 'https://wpbookingcalendar.com/features/' ); ?>" target="_blank">Pro | BM+</a>
								<span><?php esc_html_e( 'Booking buffer is available only in Booking Calendar Business Medium or higher versions.', 'booking' ); ?></span>
							</div>
						<?php endif; ?>
						<div class="wpbc_ag_radio_stack <?php echo $is_buffer_available ? '' : 'wpbc_ag_is_locked'; ?>">
							<label><input type="radio" name="booking_unavailable_extra_in_out" value="" <?php checked( $buffer_type, '' ); ?> <?php disabled( ! $is_buffer_available ); ?> /> <?php echo esc_html( ucfirst( __( 'None', 'booking' ) ) ); ?></label>
							<label><input type="radio" name="booking_unavailable_extra_in_out" value="m" <?php checked( $buffer_type, 'm' ); ?> <?php disabled( ! $is_buffer_available ); ?> /> <?php echo esc_html( ucfirst( __( 'minutes', 'booking' ) ) . ' / ' . ucfirst( __( 'hours', 'booking' ) ) ); ?></label>
							<label><input type="radio" name="booking_unavailable_extra_in_out" value="d" <?php checked( $buffer_type, 'd' ); ?> <?php disabled( ! $is_buffer_available ); ?> /> <?php echo esc_html( ucfirst( __( 'day(s)', 'booking' ) ) ); ?></label>
						</div>
						<div class="wpbc_ag_buffer_fields" data-buffer-panel="m">
							<div class="wpbc_ag_field_row">
								<label class="wpbc_ag_field_label" for="booking_unavailable_extra_minutes_in"><?php esc_html_e( 'Before booking', 'booking' ); ?></label>
								<?php wpbc_availability_general__render_select_with_stepper( 'booking_unavailable_extra_minutes_in', wpbc_availability_general__get_buffer_minutes_options(), get_bk_option( 'booking_unavailable_extra_minutes_in' ), array( 'disabled' => ! $is_buffer_available ) ); ?>
							</div>
							<div class="wpbc_ag_field_row">
								<label class="wpbc_ag_field_label" for="booking_unavailable_extra_minutes_out"><?php esc_html_e( 'After booking', 'booking' ); ?></label>
								<?php wpbc_availability_general__render_select_with_stepper( 'booking_unavailable_extra_minutes_out', wpbc_availability_general__get_buffer_minutes_options(), get_bk_option( 'booking_unavailable_extra_minutes_out' ), array( 'disabled' => ! $is_buffer_available ) ); ?>
							</div>
						</div>
						<div class="wpbc_ag_buffer_fields" data-buffer-panel="d">
							<div class="wpbc_ag_field_row">
								<label class="wpbc_ag_field_label" for="booking_unavailable_extra_days_in"><?php esc_html_e( 'Before booking', 'booking' ); ?></label>
								<?php wpbc_availability_general__render_select_with_stepper( 'booking_unavailable_extra_days_in', wpbc_availability_general__get_buffer_days_options(), get_bk_option( 'booking_unavailable_extra_days_in' ), array( 'disabled' => ! $is_buffer_available ) ); ?>
							</div>
							<div class="wpbc_ag_field_row">
								<label class="wpbc_ag_field_label" for="booking_unavailable_extra_days_out"><?php esc_html_e( 'After booking', 'booking' ); ?></label>
								<?php wpbc_availability_general__render_select_with_stepper( 'booking_unavailable_extra_days_out', wpbc_availability_general__get_buffer_days_options(), get_bk_option( 'booking_unavailable_extra_days_out' ), array( 'disabled' => ! $is_buffer_available ) ); ?>
							</div>
						</div>
						<?php
					}
				);
/* //TODO: implement it later.
				WPBC_UI_Sidebar_Panels::render_collapsible_group(
					array(
						'id'    => 'wpbc_ag_working_time_group',
						'group' => 'general-availability-working-time',
						'title' => __( 'Working Time', 'booking' ),
					),
					function () {
						?>
						<div class="wpbc_ag_future_notice"><?php esc_html_e( 'Prepared for the future rule: time outside the working interval will become unavailable for booking resources.', 'booking' ); ?></div>
						<label class="wpbc_ag_toggle wpbc_ag_toggle_full">
							<input type="checkbox" disabled="disabled" />
							<span><?php esc_html_e( 'Enable working time rule', 'booking' ); ?></span>
						</label>
						<div class="wpbc_ag_field_row">
							<label class="wpbc_ag_field_label" for="wpbc_ag_working_time_start"><?php esc_html_e( 'Start time', 'booking' ); ?></label>
							<?php wpbc_availability_general__render_select( 'wpbc_ag_working_time_start', wpbc_availability_general__get_working_time_options(), '09:00', array( 'disabled' => true ) ); ?>
						</div>
						<div class="wpbc_ag_field_row">
							<label class="wpbc_ag_field_label" for="wpbc_ag_working_time_end"><?php esc_html_e( 'End time', 'booking' ); ?></label>
							<?php wpbc_availability_general__render_select( 'wpbc_ag_working_time_end', wpbc_availability_general__get_working_time_options(), '18:00', array( 'disabled' => true ) ); ?>
						</div>
						<?php
					}
				);
*/
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

		WPBC_UI_Sidebar_Panels::render_inspector_header( __( 'Notes', 'booking' ), __( 'How these rules are applied.', 'booking' ) );
		?>
		<div class="wpbc_bfb__inspector__body wpbc_ag_inspector_body" style="padding:10px;">
			<div class="wpbc_ag_notice">
				<strong><?php esc_html_e( 'Note', 'booking' ); ?>!</strong>
				<?php esc_html_e( 'These options do not apply in the admin panel. These options apply only on the front-end side.', 'booking' ); ?>
			</div>
			<div class="wpbc_ag_scope_card">
				<div class="wpbc_ag_scope_title"><?php esc_html_e( 'Scope', 'booking' ); ?></div>
				<p><?php esc_html_e( 'The calendar on this page previews one selected booking resource. The settings in the palette are general availability settings and affect front-end calendars globally.', 'booking' ); ?></p>
			</div>
		</div>
		<?php
	}

	/**
	 * Show page content.
	 *
	 * @return void|false
	 */
	public function content() {

		do_action( 'wpbc_hook_settings_page_header', 'page_booking_availability_general' );

		if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_availability_general__get_manage_cap() ) ) {
			return false;
		}

		if ( function_exists( 'wpbc_js_for_bookings_page' ) ) {
			wpbc_js_for_bookings_page();
		}

		$resource_id  = wpbc_availability_general__get_preview_resource_id();
		$months_count = wpbc_availability_general__get_preview_months_count();
		$resources    = wpbc_availability_general__get_resources();
		?>
		<div class="wpbc_ag_page wpdevelop" data-wpbc-ag-page="1" data-wpbc-ag-resource-id="<?php echo esc_attr( $resource_id ); ?>">
			<form method="get" class="wpbc_ag_toolbar wpbc_ts_toolbar wpbc_ag_preview_controls" data-wpbc-ag-preview-toolbar="1">
					<input type="hidden" name="page" value="wpbc-availability" />
					<input type="hidden" name="tab" value="general_availability" />
					<div class="wpbc_ts_control wpbc_ag_control_resource">
						<label for="wpbc_ag_resource_id"><?php esc_html_e( 'Booking resource', 'booking' ); ?></label>
						<select id="wpbc_ag_resource_id" name="resource_id">
							<?php foreach ( $resources as $resource ) : ?>
								<option value="<?php echo esc_attr( $resource['id'] ); ?>" <?php selected( $resource_id, (int) $resource['id'] ); ?>><?php echo esc_html( $resource['title'] ); ?></option>
							<?php endforeach; ?>
						</select>
					</div>
					<div class="wpbc_ts_control wpbc_ag_control_months">
						<label for="wpbc_ag_months_count"><?php esc_html_e( 'Months', 'booking' ); ?></label>
						<select id="wpbc_ag_months_count" name="months_count">
							<?php foreach ( array( 1, 2, 3, 4, 6, 12 ) as $month_option ) : ?>
								<option value="<?php echo esc_attr( $month_option ); ?>" <?php selected( $months_count, $month_option ); ?>><?php echo esc_html( $month_option ); ?></option>
							<?php endforeach; ?>
						</select>
					</div>
			</form>
			<?php wpbc_availability_general__render_calendar_preview( $resource_id, $months_count ); ?>
			<div class="wpbc_ag_calendar_notes" data-wpbc-ag-calendar-notes="1">
				<div class="wpbc_ts_hint wpbc_ag_hint_bar">
					<span class="wpbc_icn_info_outline"></span>
					<?php esc_html_e( 'Preview how the current general availability rules affect a front-end calendar.', 'booking' ); ?>
				</div>
			</div>
		</div>
		<?php

		do_action( 'wpbc_hook_settings_page_footer', 'page_booking_availability_general' );
	}

}
add_action( 'wpbc_menu_created', array( new WPBC_Page_Availability_General_Dedicated(), '__construct' ) );
