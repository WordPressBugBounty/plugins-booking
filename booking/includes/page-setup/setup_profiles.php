<?php /**
 * @version 1.0
 * @description Booking profile helpers for Setup Wizard.
 * @category    Setup Wizard
 */

if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly.

/**
 * Store the WPBC admin fullscreen preference for the current user.
 *
 * The top navigation fullscreen button stores this value through WPBC_User_Custom_Data_Saver as
 * "booking_custom_is_full_screen" => array( 'value' => 'On|Off' ). Setup routing happens before redirects, so the
 * wizard updates the same preference server-side when it moves between internal and external setup screens.
 *
 * @param bool $is_full_screen Whether WPBC admin pages should open in fullscreen mode.
 *
 * @return bool
 */
function wpbc_setup_wizard__set_full_screen_mode_for_current_user( $is_full_screen ) {

	$user_id = wpbc_get_current_user_id();

	if ( empty( $user_id ) ) {
		return false;
	}

	return update_user_option(
		$user_id,
		'booking_custom_is_full_screen',
		array( 'value' => $is_full_screen ? 'On' : 'Off' )
	);
}

/**
 * Get persisted wizard choices.
 *
 * @return array
 */
function wpbc_setup_wizard__get_booking_wizard_data() {

	$wizard_data = get_bk_option( 'booking_wizard_data' );

	return ( empty( $wizard_data ) || ( ! is_array( $wizard_data ) ) ) ? array() : $wizard_data;
}

/**
 * Get selected booking type from wizard history or current options.
 *
 * @param array|null $wizard_data Wizard data.
 *
 * @return string
 */
function wpbc_setup_wizard__get_selected_booking_type( $wizard_data = null ) {

	if ( null === $wizard_data ) {
		$wizard_data = wpbc_setup_wizard__get_booking_wizard_data();
	}

	if (
		isset( $wizard_data['save_and_continue__bookings_types']['wpbc_swp_booking_types'] )
		&& ( ! empty( $wizard_data['save_and_continue__bookings_types']['wpbc_swp_booking_types'] ) )
	) {
		return (string) $wizard_data['save_and_continue__bookings_types']['wpbc_swp_booking_types'];
	}

	if ( 'On' === get_bk_option( 'booking_range_selection_time_is_active' ) ) {
		return 'changeover_multi_dates_bookings';
	}

	if ( 'single' === get_bk_option( 'booking_type_of_day_selections' ) ) {
		return 'time_slots_appointments';
	}

	return 'full_days_bookings';
}

/**
 * Get selected appointment mode from wizard history or current options.
 *
 * @param array|null $wizard_data Wizard data.
 *
 * @return string
 */
function wpbc_setup_wizard__get_selected_appointments_type( $wizard_data = null ) {

	if ( null === $wizard_data ) {
		$wizard_data = wpbc_setup_wizard__get_booking_wizard_data();
	}

	if (
		isset( $wizard_data['save_and_continue__bookings_types']['wpbc_swp_booking_appointments_type'] )
		&& ( ! empty( $wizard_data['save_and_continue__bookings_types']['wpbc_swp_booking_appointments_type'] ) )
	) {
		return (string) $wizard_data['save_and_continue__bookings_types']['wpbc_swp_booking_appointments_type'];
	}

	return 'rangetime';
}

/**
 * Convert selected booking type to a setup profile.
 *
 * @param array|null $wizard_data Wizard data.
 *
 * @return string
 */
function wpbc_setup_wizard__get_selected_profile( $wizard_data = null ) {

	$booking_type = wpbc_setup_wizard__get_selected_booking_type( $wizard_data );

	if ( 'time_slots_appointments' === $booking_type ) {
		return ( 'durationtime' === wpbc_setup_wizard__get_selected_appointments_type( $wizard_data ) ) ? 'duration_appointments' : 'time_slots';
	}

	if ( 'changeover_multi_dates_bookings' === $booking_type ) {
		return 'changeover';
	}

	return 'full_day';
}

/**
 * Check whether profile uses booking times.
 *
 * @param string|null $profile Profile.
 *
 * @return bool
 */
function wpbc_setup_wizard__is_time_based_profile( $profile = null ) {

	$profile = ( null === $profile ) ? wpbc_setup_wizard__get_selected_profile() : $profile;

	return in_array( $profile, array( 'time_slots', 'duration_appointments' ), true );
}

/**
 * Check whether profile uses changeover mode.
 *
 * @param string|null $profile Profile.
 *
 * @return bool
 */
function wpbc_setup_wizard__is_changeover_profile( $profile = null ) {

	$profile = ( null === $profile ) ? wpbc_setup_wizard__get_selected_profile() : $profile;

	return ( 'changeover' === $profile );
}

/**
 * Get the internal setup wizard route before profile-specific external pages.
 *
 * @return array
 */
function wpbc_setup_wizard__get_intro_route() {

	$route = array( 'welcome' );
	if ( ! wpbc_is_this_demo() ) {
		$route[] = 'general_info';
	}
	$route[] = 'date_time_formats';
	$route[] = 'bookings_types';

	return $route;
}

/**
 * Get profile-specific setup route matrix after "Booking Type".
 *
 * Steps 1-4 stay inside the setup wizard. Every route below starts with the shared Booking Form and Date Selection
 * configuration, then branches only where the selected booking profile needs different existing WPBC admin pages.
 *
 * @return array
 */
function wpbc_setup_wizard__get_profile_route_map() {

	$full_day_route = array(
		'form_structure',
		'date_selection',
		'date_availability',
		'color_theme',
		'wizard_publish',
		'get_started',
	);

	$time_based_route = array(
		'form_structure',
		'date_selection',
		'working_time',
		'time_slots_availability',
		'date_availability',
		'color_theme',
		'wizard_publish',
		'get_started',
	);

	return array(
		'full_day'              => $full_day_route,
		'changeover'            => $full_day_route,
		'time_slots'            => $time_based_route,
		'duration_appointments' => $time_based_route,
	);
}

/**
 * Get profile-specific setup route after "Booking Type".
 *
 * @param string|null $profile        Profile.
 * @param bool|null   $is_bfb_enabled Deprecated. Kept for backward-compatible calls.
 *
 * @return array
 */
function wpbc_setup_wizard__get_profile_route( $profile = null, $is_bfb_enabled = null ) {

	$profile    = ( null === $profile ) ? wpbc_setup_wizard__get_selected_profile() : $profile;
	$route_map  = wpbc_setup_wizard__get_profile_route_map();
	$route      = isset( $route_map[ $profile ] ) ? $route_map[ $profile ] : $route_map['full_day'];

	if ( wpbc_is_this_demo() ) {
		$route = array_values( array_diff( $route, array( 'wizard_publish' ) ) );
	}

	return $route;
}

/**
 * Get the next setup step from the current profile route.
 *
 * @param string $current_step Current step name.
 *
 * @return string
 */
function wpbc_setup_wizard__get_next_step_name( $current_step ) {

	$route = array_merge( wpbc_setup_wizard__get_intro_route(), wpbc_setup_wizard__get_profile_route() );

	$current_step_index = array_search( $current_step, $route, true );

	if ( false === $current_step_index ) {
		return '';
	}

	return isset( $route[ $current_step_index + 1 ] ) ? $route[ $current_step_index + 1 ] : '';
}

/**
 * Check whether the step is rendered inside the setup wizard page.
 *
 * @param string $step_name Step name.
 *
 * @return bool
 */
function wpbc_setup_wizard__is_internal_step( $step_name ) {

	return in_array( $step_name, array( 'welcome', 'general_info', 'date_time_formats', 'bookings_types' ), true );
}

/**
 * Detect the external setup step from the current WPBC admin page request.
 *
 * @return string
 */
function wpbc_setup_wizard__detect_step_from_admin_request() {

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$tab = isset( $_GET['tab'] ) ? sanitize_key( wp_unslash( $_GET['tab'] ) ) : '';
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$scroll_to_section = isset( $_GET['scroll_to_section'] ) ? sanitize_key( wp_unslash( $_GET['scroll_to_section'] ) ) : '';
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$wpbc_ag_open = isset( $_GET['wpbc_ag_open'] ) ? sanitize_key( wp_unslash( $_GET['wpbc_ag_open'] ) ) : '';

	if ( 'wpbc-settings' === $page ) {
		if ( 'builder_booking_form' === $tab ) {
			return 'form_structure';
		}

		if ( 'form' === $tab ) {
			return 'form_structure';
		}

		if ( 'wpbc_general_settings_calendar_tab' === $scroll_to_section ) {
			return 'date_selection';
		}

		if ( 'color_themes' === $tab ) {
			return 'color_theme';
		}
	}

	if ( 'wpbc-availability' === $page ) {
		if ( 'time_slots_availability' === $tab ) {
			return 'time_slots_availability';
		}

		if ( 'working_time' === $wpbc_ag_open ) {
			return 'working_time';
		}

		return 'date_availability';
	}

	if ( 'wpbc-resources' === $page ) {
		return 'wizard_publish';
	}

	return '';
}

/**
 * Detect an external setup step from an admin URL.
 *
 * @param string $url URL.
 *
 * @return string
 */
function wpbc_setup_wizard__detect_step_from_admin_url( $url ) {

	if ( empty( $url ) ) {
		return '';
	}

	$url_parts = wp_parse_url( $url );
	if ( empty( $url_parts['query'] ) ) {
		return '';
	}

	$query_args = array();
	wp_parse_str( $url_parts['query'], $query_args );

	$page              = isset( $query_args['page'] ) ? sanitize_key( $query_args['page'] ) : '';
	$tab               = isset( $query_args['tab'] ) ? sanitize_key( $query_args['tab'] ) : '';
	$scroll_to_section = isset( $query_args['scroll_to_section'] ) ? sanitize_key( $query_args['scroll_to_section'] ) : '';
	$wpbc_ag_open      = isset( $query_args['wpbc_ag_open'] ) ? sanitize_key( $query_args['wpbc_ag_open'] ) : '';

	if ( 'wpbc-settings' === $page ) {
		if ( 'builder_booking_form' === $tab ) {
			return 'form_structure';
		}

		if ( 'form' === $tab ) {
			return 'form_structure';
		}

		if ( 'wpbc_general_settings_calendar_tab' === $scroll_to_section ) {
			return 'date_selection';
		}

		if ( 'color_themes' === $tab ) {
			return 'color_theme';
		}
	}

	if ( 'wpbc-availability' === $page ) {
		if ( 'time_slots_availability' === $tab ) {
			return 'time_slots_availability';
		}

		if ( 'working_time' === $wpbc_ag_open ) {
			return 'working_time';
		}

		return 'date_availability';
	}

	if ( 'wpbc-resources' === $page ) {
		return 'wizard_publish';
	}

	return '';
}

/**
 * Get human-readable setup step title.
 *
 * @param string $step_name Step name.
 *
 * @return string
 */
function wpbc_setup_wizard__get_step_title( $step_name ) {

	$step_titles = array(
		'welcome'                 => __( 'Welcome', 'booking' ),
		'general_info'            => __( 'General Info', 'booking' ),
		'date_time_formats'       => __( 'Dates and Times', 'booking' ),
		'bookings_types'          => __( 'Booking Type', 'booking' ),
		'date_selection'          => __( 'Date Selection', 'booking' ),
		'working_time'            => __( 'Working Time', 'booking' ),
		'time_slots_availability' => __( 'Time Slots', 'booking' ),
		'date_availability'       => __( 'Date Availability', 'booking' ),
		'form_structure'          => __( 'Booking Form', 'booking' ),
		'color_theme'             => __( 'Color Theme', 'booking' ),
		'wizard_publish'          => __( 'Publish', 'booking' ),
		'get_started'             => __( 'Get Started', 'booking' ),
	);

	return isset( $step_titles[ $step_name ] ) ? $step_titles[ $step_name ] : $step_name;
}

/**
 * Get action-oriented setup step heading shown in the floating setup bar.
 *
 * @param string $step_name Step name.
 *
 * @return string
 */
function wpbc_setup_wizard__get_step_heading( $step_name ) {

	$step_headings = array(
		'welcome'                 => __( 'Start the initial setup', 'booking' ),
		'general_info'            => __( 'Confirm your business details', 'booking' ),
		'date_time_formats'       => __( 'Choose date and time formats', 'booking' ),
		'bookings_types'          => __( 'Choose the main booking workflow', 'booking' ),
		'form_structure'          => __( 'Select and save the booking form template', 'booking' ),
		'date_selection'          => __( 'Set how visitors select dates', 'booking' ),
		'working_time'            => __( 'Define when bookings can start and end', 'booking' ),
		'time_slots_availability' => __( 'Review availability for appointment slots', 'booking' ),
		'date_availability'       => __( 'Set date availability rules', 'booking' ),
		'color_theme'             => __( 'Choose the calendar appearance', 'booking' ),
		'wizard_publish'          => __( 'Publish the booking form on your site', 'booking' ),
		'get_started'             => __( 'Complete setup and manage bookings', 'booking' ),
	);

	return isset( $step_headings[ $step_name ] ) ? $step_headings[ $step_name ] : wpbc_setup_wizard__get_step_title( $step_name );
}

/**
 * Get setup step guidance shown in the floating setup bar.
 *
 * @param string $step_name Step name.
 *
 * @return string
 */
function wpbc_setup_wizard__get_step_description( $step_name ) {

	$step_descriptions = array(
		'welcome'                 => __( 'Begin the guided setup. You can leave the wizard at any time and continue later from the setup bar.', 'booking' ),
		'general_info'            => __( 'Review the business name, contact details, and basic information used while preparing the booking configuration.', 'booking' ),
		'date_time_formats'       => __( 'Pick the date and time display formats that should be used in the admin panel, booking form, and customer-facing messages.', 'booking' ),
		'bookings_types'          => __( 'Select whether bookings use full days, appointment time slots, or changeover-style date ranges. This choice controls the next configuration steps.', 'booking' ),
		'form_structure'          => __( 'Open the form template chooser, select the template that matches your booking type, and save the Booking Form page before continuing.', 'booking' ),
		'date_selection'          => __( 'Choose whether visitors can select one day, multiple individual days, or an available date range in the calendar. Save the General Settings page after changing this option.', 'booking' ),
		'working_time'            => __( 'Set the daily working hours that should be available for bookings. These hours are used as the base schedule for time-based availability.', 'booking' ),
		'time_slots_availability' => __( 'Check the generated appointment slots and adjust any slot-specific availability rules before moving to broader date availability.', 'booking' ),
		'date_availability'       => __( 'Set which weekdays, dates, booking windows, and buffer rules should be available or unavailable for visitors.', 'booking' ),
		'color_theme'             => __( 'Choose the calendar skin and visual style so the booking form fits your site before you publish it.', 'booking' ),
		'wizard_publish'          => __( 'Use the Publish buttons for each booking resource to insert the booking form into an existing page, create a new page, or copy the shortcode.', 'booking' ),
		'get_started'             => __( 'Finish the setup wizard. After this, the setup bar will disappear and you can start managing bookings normally.', 'booking' ),
	);

	return isset( $step_descriptions[ $step_name ] ) ? $step_descriptions[ $step_name ] : '';
}

/**
 * Get external setup step UI integration matrix.
 *
 * Each entry describes how the floating setup bar should connect a wizard step
 * to an existing WPBC admin page: what to open, what to scroll/highlight, which
 * form/save control belongs to this step, and which JS events mean the external
 * page has saved successfully.
 *
 * @return array
 */
function wpbc_setup_wizard__get_step_ui_matrix() {

	return array(
		'form_structure'          => array(
			'save_behavior'      => 'manual_save_required',
			'target_selector'    => '.wpbc_admin_page__tab__builder_booking_form, #wpbc_form_field_free',
			'scroll_selector'    => '.wpbc_bfb_popup_modal__forms_loading_section:visible, #wpbc_form_field_free:visible, .wpbc_admin_page__tab__builder_booking_form:visible',
			'highlight_selector' => '.wpbc_bfb_popup_modal__forms_loading_section:visible, #wpbc_form_field_free:visible, .wpbc_admin_page__tab__builder_booking_form:visible',
			'form_selector'      => '#wpbc_form_field_free',
			'save_selector'      => '#wpbc_form_field_free .wpbc_submit_button_trigger, #wpbc_form_field_free .wpbc_submit_button, [onclick*="wpbc_bfb__ajax_save_current_form"], [data-wpbc-bfb-save-source]',
			'save_events'        => 'wpbc:bfb:form:ajax_saved,wpbc:bfb:form:saved,wpbc:bfb:save:done,wpbc:bfb:ajax_saved,wpbc:setup-wizard:step-saved',
		),
		'date_selection'          => array(
			'save_behavior'      => 'manual_save_required',
			'target_selector'    => '.wpbc_tr_set_gen_booking_type_of_day_selections, #wpbc_general_settings_calendar_metabox',
			'scroll_selector'    => '.wpbc_tr_set_gen_booking_type_of_day_selections:visible, #wpbc_general_settings_calendar_metabox:visible',
			'highlight_selector' => '.wpbc_tr_set_gen_booking_type_of_day_selections:visible, #wpbc_general_settings_calendar_metabox:visible',
			'form_selector'      => '#wpbc_general_settings_form',
			'save_selector'      => '#wpbc_general_settings_form .wpbc_submit_button_trigger, #wpbc_general_settings_form .wpbc_submit_button',
			'save_events'        => 'wpbc:setup-wizard:step-saved',
			'open_action'        => 'settings_section',
		),
		'working_time'            => array(
			'save_behavior'      => 'manual_save_required',
			'target_selector'    => '[data-group="general-availability-working-time"], .wpbc_ag_working_time_block, .wpbc_admin_page__tab__general_availability',
			'scroll_selector'    => '[data-group="general-availability-working-time"]:visible, .wpbc_ag_working_time_block:visible, [data-wpbc-ag-settings-form="1"]:visible',
			'highlight_selector' => '[data-group="general-availability-working-time"]:visible, .wpbc_ag_working_time_block:visible',
			'form_selector'      => '[data-wpbc-ag-settings-form="1"]',
			'save_selector'      => '[data-wpbc-ag-save="1"]',
			'save_events'        => 'wpbc:availability-general:settings-saved,wpbc:setup-wizard:step-saved',
			'open_action'        => 'availability_section',
		),
		'time_slots_availability' => array(
			'save_behavior'      => 'link_only',
			'target_selector'    => '.wpbc_admin_page__tab__time_slots_availability, .wpbc_ts_page',
			'scroll_selector'    => '.wpbc_admin_page__tab__time_slots_availability:visible, .wpbc_ts_page:visible',
			'highlight_selector' => '.wpbc_admin_page__tab__time_slots_availability:visible, .wpbc_ts_page:visible',
		),
		'date_availability'       => array(
			'save_behavior'      => 'manual_save_required',
			'target_selector'    => '[data-group="general-availability-weekdays"], .wpbc_admin_page__tab__general_availability, [data-wpbc-ag-settings-form="1"]',
			'scroll_selector'    => '[data-group="general-availability-weekdays"]:visible, [data-wpbc-ag-settings-form="1"]:visible',
			'highlight_selector' => '[data-group="general-availability-weekdays"]:visible, [data-wpbc-ag-settings-form="1"]:visible',
			'form_selector'      => '[data-wpbc-ag-settings-form="1"]',
			'save_selector'      => '[data-wpbc-ag-save="1"]',
			'save_events'        => 'wpbc:availability-general:settings-saved,wpbc:setup-wizard:step-saved',
			'open_action'        => 'availability_section',
		),
		'color_theme'             => array(
			'save_behavior'      => 'manual_save_required',
			'target_selector'    => '#wpbc_general_settings_form',
			'scroll_selector'    => '#wpbc_general_settings_form:visible',
			'highlight_selector' => '#wpbc_general_settings_form:visible',
			'form_selector'      => '#wpbc_general_settings_form',
			'save_selector'      => '#wpbc_general_settings_form .wpbc_submit_button_trigger, #wpbc_general_settings_form .wpbc_submit_button',
			'save_events'        => 'wpbc:setup-wizard:step-saved',
		),
		'wizard_publish'          => array(
			'save_behavior'      => 'link_only',
			'target_selector'    => '.ui_group__publish_btn, .wpbc_resource_field__publish, .wpbc_resource_publish, .wpbc_publish_resources, .wpbc_resource_shortcode, [data-wpbc-resource-publish], #wpbc_booking_resource_table, .wpbc_admin_page',
			'scroll_selector'    => '.ui_group__publish_btn:visible, .wpbc_resource_field__publish:visible, .wpbc_resource_publish:visible, .wpbc_publish_resources:visible, .wpbc_resource_shortcode:visible, [data-wpbc-resource-publish]:visible, #wpbc_booking_resource_table:visible',
			'highlight_selector' => '.ui_group__publish_btn:visible, .wpbc_resource_field__publish:visible, .wpbc_resource_publish:visible, .wpbc_publish_resources:visible, .wpbc_resource_shortcode:visible, [data-wpbc-resource-publish]:visible, #wpbc_booking_resource_table:visible',
			'open_action'        => 'publish_area',
		),
		'get_started'             => array(
			'save_behavior'      => 'complete',
			'target_selector'    => '.wpbc_admin_page',
			'scroll_selector'    => '.wpbc_admin_page:visible',
			'highlight_selector' => '.wpbc_admin_page:visible',
		),
	);
}

/**
 * Get one UI integration value from the external setup step matrix.
 *
 * @param string $step_name Step name.
 * @param string $key       Matrix key.
 *
 * @return string
 */
function wpbc_setup_wizard__get_step_ui_matrix_value( $step_name, $key ) {

	$ui_matrix = wpbc_setup_wizard__get_step_ui_matrix();

	return ( isset( $ui_matrix[ $step_name ][ $key ] ) ) ? (string) $ui_matrix[ $step_name ][ $key ] : '';
}

/**
 * Get save behavior for external setup step.
 *
 * @param string $step_name Step name.
 *
 * @return string
 */
function wpbc_setup_wizard__get_step_save_behavior( $step_name ) {

	$save_behavior = wpbc_setup_wizard__get_step_ui_matrix_value( $step_name, 'save_behavior' );

	return ( ! empty( $save_behavior ) ) ? $save_behavior : 'link_only';
}

/**
 * Get DOM selector to highlight/scroll on external setup pages.
 *
 * @param string $step_name Step name.
 *
 * @return string
 */
function wpbc_setup_wizard__get_step_target_selector( $step_name ) {

	return wpbc_setup_wizard__get_step_ui_matrix_value( $step_name, 'target_selector' );
}

/**
 * Get DOM selector to scroll on external setup pages.
 *
 * @param string $step_name Step name.
 *
 * @return string
 */
function wpbc_setup_wizard__get_step_scroll_selector( $step_name ) {

	$scroll_selector = wpbc_setup_wizard__get_step_ui_matrix_value( $step_name, 'scroll_selector' );

	return ( ! empty( $scroll_selector ) ) ? $scroll_selector : wpbc_setup_wizard__get_step_target_selector( $step_name );
}

/**
 * Get DOM selector to highlight on external setup pages.
 *
 * @param string $step_name Step name.
 *
 * @return string
 */
function wpbc_setup_wizard__get_step_highlight_selector( $step_name ) {

	$highlight_selector = wpbc_setup_wizard__get_step_ui_matrix_value( $step_name, 'highlight_selector' );

	return ( ! empty( $highlight_selector ) ) ? $highlight_selector : wpbc_setup_wizard__get_step_target_selector( $step_name );
}

/**
 * Get page open action for external setup pages.
 *
 * @param string $step_name Step name.
 *
 * @return string
 */
function wpbc_setup_wizard__get_step_open_action( $step_name ) {

	return wpbc_setup_wizard__get_step_ui_matrix_value( $step_name, 'open_action' );
}

/**
 * Get browser events that confirm an external setup page save.
 *
 * @param string $step_name Step name.
 *
 * @return string
 */
function wpbc_setup_wizard__get_step_save_events( $step_name ) {

	return wpbc_setup_wizard__get_step_ui_matrix_value( $step_name, 'save_events' );
}

/**
 * Get DOM selector for the existing page form related to the setup step.
 *
 * @param string $step_name Step name.
 *
 * @return string
 */
function wpbc_setup_wizard__get_step_form_selector( $step_name ) {

	return wpbc_setup_wizard__get_step_ui_matrix_value( $step_name, 'form_selector' );
}

/**
 * Get selector for the existing page save button related to the setup step.
 *
 * @param string $step_name Step name.
 *
 * @return string
 */
function wpbc_setup_wizard__get_step_save_selector( $step_name ) {

	return wpbc_setup_wizard__get_step_ui_matrix_value( $step_name, 'save_selector' );
}

/**
 * Add setup guide context to a target URL.
 *
 * @param string $url       URL.
 * @param string $step_name Step name.
 *
 * @return string
 */
function wpbc_setup_wizard__add_setup_context_to_url( $url, $step_name ) {

	return add_query_arg(
		array(
			'wpbc_setup'      => '1',
			'wpbc_setup_step' => $step_name,
		),
		$url
	);
}

/**
 * Get the Form Builder template search key for the selected booking type.
 *
 * @return string
 */
function wpbc_setup_wizard__get_bfb_template_search_key() {

	$booking_wizard_data_arr = get_bk_option( 'booking_wizard_data' );
	if (
		empty( $booking_wizard_data_arr )
		|| ! is_array( $booking_wizard_data_arr )
		|| empty( $booking_wizard_data_arr['save_and_continue__bookings_types'] )
		|| ! is_array( $booking_wizard_data_arr['save_and_continue__bookings_types'] )
	) {
		return '';
	}

	$booking_type = isset( $booking_wizard_data_arr['save_and_continue__bookings_types']['wpbc_swp_booking_types'] )
		? $booking_wizard_data_arr['save_and_continue__bookings_types']['wpbc_swp_booking_types']
		: '';
	$url_sep      = defined( 'WPBC_BFB_TEMPLATE_SEARCH_OR_SEPARATOR_URL' ) ? WPBC_BFB_TEMPLATE_SEARCH_OR_SEPARATOR_URL : '^';

	if ( 'full_days_bookings' === $booking_type ) {
		return 'full-days' . $url_sep . 'dates_form';
	}

	if ( 'time_slots_appointments' === $booking_type ) {
		if ( 'rangetime' === wpbc_setup_wizard__get_selected_appointments_type( $booking_wizard_data_arr ) ) {
			return 'times' . $url_sep . 'time slots';
		}

		return 'appointments' . $url_sep . 'service';
	}

	if ( 'changeover_multi_dates_bookings' === $booking_type ) {
		return 'changeover' . $url_sep . 'triangles';
	}

	return '';
}

/**
 * Get the existing admin page URL that should handle a setup step.
 *
 * @param string $step_name Step name.
 *
 * @return string
 */
function wpbc_setup_wizard__get_step_target_url( $step_name ) {

	if ( wpbc_setup_wizard__is_internal_step( $step_name ) ) {
		return add_query_arg( 'current_step', $step_name, wpbc_get_setup_wizard_page_url() );
	}

	switch ( $step_name ) {
		case 'date_selection':
			$url  = add_query_arg(
				array(
					'tab'               => 'general',
					'scroll_to_section' => 'wpbc_general_settings_calendar_tab',
				),
				wpbc_get_settings_url()
			);
			$url .= '#do_expand__wpbc_general_settings_calendar_metabox#do_other_actions__blink_day_selections';
			break;

		case 'working_time':
			$url = function_exists( 'wpbc_get_general_availability_url' )
				? wpbc_get_general_availability_url()
				: admin_url( 'admin.php?page=wpbc-availability&tab=general_availability' );
			$url = add_query_arg( 'wpbc_ag_open', 'working_time', $url );
			break;

		case 'time_slots_availability':
			$url = function_exists( 'wpbc_get_time_slots_availability_url' )
				? wpbc_get_time_slots_availability_url()
				: admin_url( 'admin.php?page=wpbc-availability&tab=time_slots_availability' );
			break;

		case 'date_availability':
			$url = function_exists( 'wpbc_get_general_availability_url' )
				? wpbc_get_general_availability_url()
				: admin_url( 'admin.php?page=wpbc-availability&tab=general_availability' );
			$url = add_query_arg( 'wpbc_ag_open', 'weekdays', $url );
			break;

		case 'form_structure':
			$url = ( (bool) WPBC_Frontend_Settings::is_bfb_enabled( null ) )
				? wpbc_get_settings_url() . '&tab=builder_booking_form'
				: wpbc_get_settings_url() . '&tab=form';
			if ( (bool) WPBC_Frontend_Settings::is_bfb_enabled( null ) ) {
				$template_search_key = wpbc_setup_wizard__get_bfb_template_search_key();
				if ( ! empty( $template_search_key ) ) {
					$url = add_query_arg( 'auto_open_template', $template_search_key, $url );
				}
			}
			break;

		case 'color_theme':
			$url = wpbc_get_settings_url() . '&tab=color_themes';
			break;

		case 'wizard_publish':
			$url = wpbc_get_resources_url() . '#wpbc_booking_resource_table';
			break;

		case 'get_started':
			$url = wpbc_get_bookings_url() . '&tab=vm_booking_listing';
			break;

		default:
			$url = wpbc_get_setup_wizard_page_url();
			break;
	}

	return wpbc_setup_wizard__add_setup_context_to_url( $url, $step_name );
}

/**
 * Get URL that completes an external setup step and redirects to the next mapped step.
 *
 * @param string $step_name Step name.
 *
 * @return string
 */
function wpbc_setup_wizard__get_step_continue_url( $step_name ) {

	if ( wpbc_setup_wizard__is_internal_step( $step_name ) ) {
		return wpbc_setup_wizard__get_step_target_url( $step_name );
	}

	return add_query_arg(
		array(
			'wpbc_setup_wizard'        => 'continue',
			'wpbc_setup_step'          => $step_name,
			'wpbc_setup_from_page_step' => $step_name,
			'_wpnonce'                 => wp_create_nonce( 'wpbc_settings_url_nonce' ),
		),
		wpbc_get_setup_wizard_page_url()
	);
}

/**
 * Get setup step metadata for routing and UI.
 *
 * @param string $step_name Step name.
 *
 * @return array
 */
function wpbc_setup_wizard__get_step_route_metadata( $step_name ) {

	return array(
		'is_external'   => ! wpbc_setup_wizard__is_internal_step( $step_name ),
		'target_url'    => wpbc_setup_wizard__get_step_target_url( $step_name ),
		'title'         => wpbc_setup_wizard__get_step_title( $step_name ),
		'heading'       => wpbc_setup_wizard__get_step_heading( $step_name ),
		'description'   => wpbc_setup_wizard__get_step_description( $step_name ),
		'save_behavior' => wpbc_setup_wizard__get_step_save_behavior( $step_name ),
		'target_selector' => wpbc_setup_wizard__get_step_target_selector( $step_name ),
		'scroll_selector' => wpbc_setup_wizard__get_step_scroll_selector( $step_name ),
		'highlight_selector' => wpbc_setup_wizard__get_step_highlight_selector( $step_name ),
		'form_selector'   => wpbc_setup_wizard__get_step_form_selector( $step_name ),
		'save_selector'   => wpbc_setup_wizard__get_step_save_selector( $step_name ),
		'save_events'     => wpbc_setup_wizard__get_step_save_events( $step_name ),
		'open_action'     => wpbc_setup_wizard__get_step_open_action( $step_name ),
	);
}

/**
 * Get first step after "Booking Type" for current profile.
 *
 * @return string
 */
function wpbc_setup_wizard__get_first_profile_step() {

	$route = wpbc_setup_wizard__get_profile_route();

	return ( empty( $route ) ) ? 'color_theme' : $route[0];
}
