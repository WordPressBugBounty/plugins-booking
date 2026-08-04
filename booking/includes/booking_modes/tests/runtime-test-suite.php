<?php
/**
 * Read-only runtime checks for the Booking Modes foundation.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Add one normalized result to the Booking Modes test collection.
 *
 * @param array  $results Test results passed by reference.
 * @param bool   $passed  Whether the assertion passed.
 * @param string $label   Human-readable assertion label.
 * @param string $details Optional diagnostic details.
 *
 * @return void
 */
function wpbc_booking_modes_tests_add_result( &$results, $passed, $label, $details = '' ) {

	$results[] = array(
		'passed'  => (bool) $passed,
		'label'   => (string) $label,
		'details' => (string) $details,
	);
}

/**
 * Run non-mutating foundation checks inside WordPress administration.
 *
 * @param array $legacy_navigation Optional captured legacy navigation tree.
 *
 * @return array Test results and normalized registry snapshots.
 */
function wpbc_booking_modes_tests_run_runtime( $legacy_navigation = array() ) {

	$results       = array();
	$mode_registry = WPBC_Booking_Mode_Registry::get_instance();
	$page_registry = WPBC_Booking_Mode_Page_Registry::get_instance();
	$context_store = WPBC_Booking_Mode_Context::get_instance();
	$mode_storage  = WPBC_Booking_Mode_Storage::get_instance();
	$navigation    = WPBC_Booking_Mode_Navigation::get_instance();

	$modes_first      = wpbc_booking_modes_get_registered_modes();
	$modes_second     = wpbc_booking_modes_get_registered_modes();
	$pages_first      = wpbc_booking_modes_get_canonical_pages();
	$pages_second     = wpbc_booking_modes_get_canonical_pages();
	$context_first    = wpbc_booking_modes_get_context();
	$context_second   = wpbc_booking_modes_get_context();
	$allowed_mode_ids = wpbc_booking_modes_get_allowed_mode_ids();
	$selected_mode_id = wpbc_booking_modes_get_selected_mode_id();
	$resolved_first    = ! empty( $legacy_navigation ) ? wpbc_booking_modes_resolve_navigation( $legacy_navigation ) : array();
	$resolved_second   = ! empty( $legacy_navigation ) ? wpbc_booking_modes_resolve_navigation( $legacy_navigation ) : array();

	wpbc_booking_modes_tests_add_result( $results, function_exists( 'wpbc_is_11_5_features_enabled' ) && wpbc_is_11_5_features_enabled(), 'The 11.5 master feature gate is enabled' );
	wpbc_booking_modes_tests_add_result( $results, isset( $modes_first['classic'], $modes_first['appointment'], $modes_first['rental'] ), 'Classic, Appointments, and Rentals are registered by default' );
	wpbc_booking_modes_tests_add_result( $results, $modes_first === $modes_second && 1 === $mode_registry->get_build_count(), 'The mode registry is built no more than once per request' );
	wpbc_booking_modes_tests_add_result( $results, $pages_first === $pages_second && 1 === $page_registry->get_build_count(), 'The canonical page registry is built no more than once per request' );
	wpbc_booking_modes_tests_add_result( $results, $context_first === $context_second && 1 === $context_store->get_build_count(), 'The owner/request context is built no more than once per request' );
	wpbc_booking_modes_tests_add_result( $results, in_array( 'classic', $allowed_mode_ids, true ), 'Classic remains an allowed compatibility mode' );
	wpbc_booking_modes_tests_add_result( $results, in_array( $selected_mode_id, $allowed_mode_ids, true ), 'The selected or fallback mode is allowed in the current context' );
	wpbc_booking_modes_tests_add_result( $results, 1 === $mode_storage->get_read_count(), 'Owner-scoped mode persistence is read no more than once per request' );
	wpbc_booking_modes_tests_add_result( $results, 'booking_admin_mode' === WPBC_Booking_Mode_Storage::OPTION_NAME, 'The new implementation uses only the booking_admin_mode user option' );
	wpbc_booking_modes_tests_add_result( $results, isset( $pages_first['wpbc__vm_booking_listing'], $pages_first['wpbc__add-booking'], $pages_first['wpbc-services__appointment_services'], $pages_first['wpbc-resources__capacity'], $pages_first['wpbc-settings__builder_booking_form'] ), 'Required shared canonical routes are registered' );
	wpbc_booking_modes_tests_add_result( $results, false !== strpos( wpbc_booking_modes_get_canonical_page_url( 'wpbc__add-booking' ), 'page=wpbc' ) && false !== strpos( wpbc_booking_modes_get_canonical_page_url( 'wpbc__add-booking' ), 'tab=add-booking' ), 'Canonical URLs preserve existing page and tab identifiers' );
	$add_appointment_url = wpbc_booking_modes_get_canonical_page_url( 'wpbc__add-appointment' );
	$services_url        = wpbc_booking_modes_get_canonical_page_url( 'wpbc-services__appointment_services' );
	wpbc_booking_modes_tests_add_result(
		$results,
		false !== strpos( $add_appointment_url, 'page=wpbc' )
			&& false !== strpos( $add_appointment_url, 'tab=add-appointment' )
			&& false !== strpos( $services_url, 'page=wpbc-services' )
			&& false !== strpos( $services_url, 'tab=appointment_services' ),
		'Appointment-specific direct routes remain registered independently from mode visibility'
	);
	wpbc_booking_modes_tests_add_result(
		$results,
		class_exists( 'WPBC_Page_Add_Appointment' ) && class_exists( 'WPBC_Page_Appointment_Services' ),
		'Appointment-specific direct-route controllers remain loaded independently from mode visibility'
	);
	wpbc_booking_modes_tests_add_result( $results, ! empty( $modes_first['appointment']['pages'] ) && ! empty( $modes_first['appointment']['native_menu'] ) && ! empty( $modes_first['rental']['pages'] ) && ! empty( $modes_first['rental']['native_menu'] ), 'Appointment and Rental presentation definitions are active' );
	wpbc_booking_modes_tests_add_result(
		$results,
		! empty( $modes_first['classic']['preserve_unmapped_pages'] )
			&& isset( $modes_first['classic']['pages']['wpbc__add-appointment']['visible'] )
			&& false === $modes_first['classic']['pages']['wpbc__add-appointment']['visible']
			&& isset( $modes_first['classic']['pages']['wpbc-services__appointment_services']['visible'] )
			&& false === $modes_first['classic']['pages']['wpbc-services__appointment_services']['visible']
			&& isset( $modes_first['classic']['native_menu']['wpbc-services']['visible'] )
			&& false === $modes_first['classic']['native_menu']['wpbc-services']['visible'],
		'Classic preserves legacy routes while excluding Services and Add Appointment from navigation'
	);
	wpbc_booking_modes_tests_add_result(
		$results,
		isset( $modes_first['rental']['pages']['wpbc__add-appointment']['visible'] )
			&& false === $modes_first['rental']['pages']['wpbc__add-appointment']['visible']
			&& isset( $modes_first['rental']['pages']['wpbc-services__appointment_services']['visible'] )
			&& false === $modes_first['rental']['pages']['wpbc-services__appointment_services']['visible']
			&& isset( $modes_first['rental']['native_menu']['wpbc-services']['visible'] )
			&& false === $modes_first['rental']['native_menu']['wpbc-services']['visible'],
		'Rental explicitly excludes Services and Add Appointment from navigation without disabling their routes'
	);
	wpbc_booking_modes_tests_add_result( $results, 'appointment' === wpbc_booking_modes_get_setup_mode_id( 'time_slots_appointments' ), 'The time-based Setup Wizard profile selects Appointment mode' );
	wpbc_booking_modes_tests_add_result( $results, 'rental' === wpbc_booking_modes_get_setup_mode_id( 'full_days_bookings' ) && 'rental' === wpbc_booking_modes_get_setup_mode_id( 'changeover_multi_dates_bookings' ), 'The full-day and changeover Setup Wizard profiles select Rental mode' );
	wpbc_booking_modes_tests_add_result( $results, 'classic' === wpbc_booking_modes_get_setup_mode_id( 'full_days_bookings', 'classic' ), 'An explicit Classic selection is independent from the full-day booking behavior' );
	wpbc_booking_modes_tests_add_result( $results, '' === wpbc_booking_modes_get_setup_mode_id( 'unknown_profile' ), 'Unknown Setup Wizard profiles do not overwrite the selected mode' );
	$setup_mode_choices = wpbc_booking_modes_get_setup_mode_choices();
	wpbc_booking_modes_tests_add_result( $results, isset( $setup_mode_choices['appointment'], $setup_mode_choices['rental'], $setup_mode_choices['classic'] ), 'Setup Step 4 uses the three allowed Booking Modes definitions' );
	wpbc_booking_modes_tests_add_result( $results, array( 'time_slots_appointments' ) === $setup_mode_choices['appointment']['allowed_booking_types'], 'Appointment mode exposes only its time-based booking behavior' );
	wpbc_booking_modes_tests_add_result( $results, 'durationtime' === $setup_mode_choices['appointment']['fixed_appointment_type'], 'Appointment mode fixes Setup Step 4 to Service duration and start-time availability' );
	wpbc_booking_modes_tests_add_result( $results, '' === $setup_mode_choices['classic']['fixed_appointment_type'], 'Classic mode keeps its selectable appointment availability workflow' );
	$appointment_wizard_data = array(
		'save_and_continue__bookings_types' => array(
			'wpbc_swp_booking_mode'              => 'appointment',
			'wpbc_swp_booking_types'             => 'time_slots_appointments',
			'wpbc_swp_booking_appointments_type' => 'rangetime',
		),
	);
	wpbc_booking_modes_tests_add_result(
		$results,
		function_exists( 'wpbc_setup_wizard__get_selected_appointments_type' )
			&& 'durationtime' === wpbc_setup_wizard__get_selected_appointments_type( $appointment_wizard_data ),
		'Appointment mode ignores incompatible fixed-slot values in persisted wizard history'
	);
	$classic_wizard_data = array(
		'save_and_continue__bookings_types' => array(
			'wpbc_swp_booking_mode'              => 'classic',
			'wpbc_swp_booking_types'             => 'time_slots_appointments',
			'wpbc_swp_booking_appointments_type' => 'rangetime',
		),
	);
	wpbc_booking_modes_tests_add_result(
		$results,
		function_exists( 'wpbc_setup_wizard__get_selected_appointments_type' )
			&& 'rangetime' === wpbc_setup_wizard__get_selected_appointments_type( $classic_wizard_data ),
		'Classic mode preserves its selected fixed-slot profile'
	);
	wpbc_booking_modes_tests_add_result( $results, function_exists( 'wpbc_setup_wizard__is_booking_modes_runtime_ready' ) && wpbc_setup_wizard__is_booking_modes_runtime_ready(), 'Setup Wizard mode resolution waits for the WordPress user and translation runtime' );
	wpbc_booking_modes_tests_add_result( $results, false !== has_action( 'init', 'wpbc_tour_maybe_initialize_setup_wizard_tour' ), 'Setup Wizard tour eligibility is deferred until init' );
	wpbc_booking_modes_tests_add_result( $results, function_exists( 'wpbc_booking_modes_get_setup_test_page_links' ), 'The Setup Bar can discover published mode-specific test pages without creating content' );
	wpbc_booking_modes_tests_add_result( $results, false !== has_action( 'wpbc_setup_wizard_booking_type_saved', 'wpbc_booking_modes_apply_setup_booking_type' ), 'The Setup Wizard mode synchronization handler is registered' );
	wpbc_booking_modes_tests_add_result( $results, isset( $modes_first['appointment']['pages']['wpbc-resources__capacity'], $modes_first['appointment']['pages']['wpbc-resources__searchable_resources'] ), 'Appointment Providers include Capacity Rules and edition-aware Searchable Providers' );
	wpbc_booking_modes_tests_add_result( $results, function_exists( 'wpbc_booking_modes_render_toolbar_selector' ) && false !== has_action( 'wpbc_ui_el__top_nav__content_start', 'wpbc_booking_modes_render_toolbar_selector' ), 'The shared toolbar selector is registered' );
	wpbc_booking_modes_tests_add_result( $results, false !== has_action( 'wp_ajax_WPBC_AJX_BOOKING_MODE_SWITCH', 'wpbc_booking_modes_ajax_switch_mode' ), 'The protected mode-switch AJAX endpoint is registered' );
	$quickstart_is_registered = function_exists( 'wpbc_booking_modes_run_quickstart' ) && function_exists( 'wpbc_booking_modes_run_appointment_quickstart' ) && function_exists( 'wpbc_booking_modes_run_rental_quickstart' );
	wpbc_booking_modes_tests_add_result( $results, $quickstart_is_registered, 'Appointment and Rental QuickStart operations are registered separately from navigation' );
	wpbc_booking_modes_tests_add_result( $results, false !== has_action( 'wp_ajax_WPBC_AJX_BOOKING_MODE_QUICKSTART', 'wpbc_booking_modes_ajax_quickstart' ), 'The protected QuickStart AJAX endpoint is registered separately from mode switching' );
	wpbc_booking_modes_tests_add_result( $results, function_exists( 'wpbc_booking_modes_render_quickstart_action' ) && false !== has_action( 'wpbc_inside_ui__admin_messages', 'wpbc_booking_modes_render_quickstart_action' ), 'The explicit QuickStart notice uses the floating admin-message stack' );
	wpbc_booking_modes_tests_add_result( $results, function_exists( 'wpbc_booking_modes_render_quickstart_dismiss_button' ), 'QuickStart exposes the persistent Booking Calendar dismissal control' );
	wpbc_booking_modes_tests_add_result( $results, false !== has_filter( 'wpbc_booking_listing_show_set_unavailable_times_button_text', 'wpbc_booking_modes_filter_set_unavailable_times_button_text' ), 'Classic and Rental toolbar presentation stays behind a shared controller filter' );
	wpbc_booking_modes_tests_add_result( $results, false !== has_filter( 'wpbc_admin_menu_parent_slug', 'wpbc_booking_modes_filter_admin_menu_parent_slug' ), 'Mode-hidden native pages use the shared hidden-page registration boundary' );
	$expected_services_parent = 'appointment' === $selected_mode_id ? 'wpbc' : false;
	wpbc_booking_modes_tests_add_result(
		$results,
		$expected_services_parent === wpbc_booking_modes_filter_admin_menu_parent_slug( 'wpbc', 'wpbc-services' ),
		'Services resolves to a visible Appointment submenu or a directly accessible hidden Classic and Rental page'
	);
	$expected_availability_button_text = ! in_array( $selected_mode_id, array( 'classic', 'rental' ), true );
	wpbc_booking_modes_tests_add_result( $results, $expected_availability_button_text === wpbc_booking_modes_filter_set_unavailable_times_button_text( true ), 'Only Appointment mode shows the Set Time Availability button text' );
	wpbc_booking_modes_tests_add_result( $results, $quickstart_is_registered && is_wp_error( wpbc_booking_modes_validate_quickstart_request( 'appointment', '' ) ), 'QuickStart rejects an invalid nonce before any content mutation' );
	wpbc_booking_modes_tests_add_result( $results, 'appointment' === $modes_first['appointment']['quickstart_id'] && 'rental' === $modes_first['rental']['quickstart_id'] && '' === $modes_first['classic']['quickstart_id'], 'Only Appointment and Rental modes declare QuickStart operations' );
	wpbc_booking_modes_tests_add_result( $results, false !== has_action( 'admin_init', 'wpbc_booking_modes_redirect_native_add_page' ), 'The legacy Add page redirect runs before administration output' );
	wpbc_booking_modes_tests_add_result( $results, is_wp_error( wpbc_booking_modes_validate_switch_request( 'appointment', '' ) ), 'A mode switch with an invalid nonce is rejected before persistence' );
	wpbc_booking_modes_tests_add_result( $results, false !== strpos( wpbc_booking_modes_get_switch_redirect_url( 'rental', 'wpbc__add-appointment' ), 'tab=vm_booking_listing' ), 'A route hidden by the target mode receives a server-selected fallback' );
	wpbc_booking_modes_tests_add_result( $results, false !== strpos( wpbc_booking_modes_get_switch_redirect_url( 'classic', 'wpbc__add-appointment' ), 'tab=vm_booking_listing' ), 'Switching to Classic from Add Appointment receives the Classic fallback' );
	wpbc_booking_modes_tests_add_result( $results, false !== strpos( wpbc_booking_modes_get_switch_redirect_url( 'classic', 'wpbc-services__appointment_services' ), 'tab=vm_booking_listing' ), 'Switching to Classic from Services receives the Classic fallback' );
	wpbc_booking_modes_tests_add_result( $results, false !== strpos( wpbc_booking_modes_get_switch_redirect_url( 'classic', 'wpbc__add-booking' ), 'tab=add-booking' ), 'Switching to Classic preserves an established legacy route' );
	wpbc_booking_modes_tests_add_result( $results, function_exists( 'wpbc_booking_modes_resolve_navigation' ), 'The shared navigation boundary is available' );
	wpbc_booking_modes_tests_add_result( $results, function_exists( 'wpbc_booking_modes_is_navigation_boundary_enabled' ) && wpbc_booking_modes_is_navigation_boundary_enabled(), 'The navigation presentation boundary is active' );
	wpbc_booking_modes_tests_add_result( $results, ! empty( $legacy_navigation ), 'The browser panel captured the complete legacy navigation tree' );

	if ( ! empty( $legacy_navigation ) ) {
		wpbc_booking_modes_tests_add_result( $results, $resolved_first === $resolved_second && 1 === $navigation->get_build_count(), 'The presentation navigation is resolved no more than once per request' );
		wpbc_booking_modes_tests_add_result( $results, $legacy_navigation === $navigation->get_legacy_navigation(), 'The resolver preserves an unmodified legacy source snapshot' );
		$classic_appointment_routes_hidden = 'classic' !== $selected_mode_id
			|| (
				! isset( $resolved_first['wpbc']['add-appointment'] )
				&& ! isset( $resolved_first['wpbc-services']['appointment_services'] )
			);
		$classic_add_booking_preserved = 'classic' !== $selected_mode_id
			|| ! isset( $legacy_navigation['wpbc']['add-booking'] )
			|| (
				isset( $resolved_first['wpbc']['add-booking'] )
				&& $legacy_navigation['wpbc']['add-booking'] === $resolved_first['wpbc']['add-booking']
			);
		wpbc_booking_modes_tests_add_result( $results, $classic_appointment_routes_hidden, 'Classic excludes appointment-specific routes from internal navigation' );
		wpbc_booking_modes_tests_add_result( $results, $classic_add_booking_preserved, 'Classic preserves the established Add Booking route without modification' );
		wpbc_booking_modes_tests_add_result( $results, ! empty( $navigation->get_available_page_ids() ), 'Canonical routes are intersected with the real legacy navigation tree' );
	}

	return array(
		'results'             => $results,
		'modes'               => $modes_first,
		'pages'               => $pages_first,
		'context'             => $context_first,
		'allowed_mode_ids'    => $allowed_mode_ids,
		'selected_mode_id'    => $selected_mode_id,
		'legacy_navigation'   => $legacy_navigation,
		'resolved_navigation' => $resolved_first,
		'available_page_ids'  => $navigation->get_available_page_ids(),
	);
}
