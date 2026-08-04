<?php
/**
 * Shared read-only WordPress runtime checks for the Appointment Flow.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Add one assertion to an Appointment runtime result collection.
 *
 * @param array<int,array<string,mixed>> $results Result collection passed by reference.
 * @param bool                           $passed  Whether the assertion passed.
 * @param string                         $label   Human-readable assertion name.
 * @param string                         $details Optional diagnostic details.
 * @param bool                           $skipped Whether the assertion was intentionally skipped.
 *
 * @return void
 */
function wpbc_appointment_tests_add_result( &$results, $passed, $label, $details = '', $skipped = false ) {
	$results[] = array(
		'passed'  => (bool) $passed,
		'label'   => (string) $label,
		'details' => (string) $details,
		'skipped' => (bool) $skipped,
	);
}

/**
 * Check whether a callback is registered in Booking Calendar's internal action registry.
 *
 * Activation and full-data-removal callbacks use the plugin's historical
 * `add_bk_action()` registry instead of WordPress actions. This helper lets the
 * WordPress-panel suite verify those lifecycle paths without invoking them.
 *
 * @param string          $action_type Internal Booking Calendar action name.
 * @param string|callable $callback    Callback expected in the action registry.
 *
 * @return bool True when the exact callback is registered.
 */
function wpbc_appointment_tests_has_internal_action( $action_type, $callback ) {
	global $wpbc_bk_action;

	if ( empty( $wpbc_bk_action[ $action_type ] ) || ! is_array( $wpbc_bk_action[ $action_type ] ) ) {
		return false;
	}

	foreach ( $wpbc_bk_action[ $action_type ] as $registered_action ) {
		if ( isset( $registered_action[0] ) && $callback === $registered_action[0] ) {
			return true;
		}
	}

	return false;
}

/**
 * Run the dependency-free, read-only Appointment checks inside WordPress.
 *
 * @return array{feature_enabled:bool,results:array<int,array<string,mixed>>,catalog:array<string,mixed>|WP_Error}
 */
function wpbc_appointment_tests_run_runtime() {
	$results         = array();
	$catalog         = array();
	$feature_enabled = function_exists( 'wpbc_is_11_5_features_enabled' ) && wpbc_is_11_5_features_enabled();

	wpbc_appointment_tests_add_result( $results, shortcode_exists( 'booking' ), 'Legacy [booking] shortcode is registered' );
	wpbc_appointment_tests_add_result( $results, shortcode_exists( 'bookingform' ), 'Legacy [bookingform] shortcode is registered' );
	wpbc_appointment_tests_add_result( $results, shortcode_exists( 'bookingselect' ), 'Legacy [bookingselect] shortcode is registered' );
	wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_is_11_5_features_enabled' ), 'The 11.5 feature-gate API is loaded' );
	wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_appointment_creation_tests_are_enabled' ), 'Booking-creation tests use an independent strict opt-in gate' );
	wpbc_appointment_tests_add_result( $results, false !== has_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_TEST_PREPARE', 'wpbc_appointment_creation_tests_ajax_prepare' ), 'Administrator-only fixture preparation endpoint is registered' );
	wpbc_appointment_tests_add_result( $results, false !== has_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_TEST_CLEANUP', 'wpbc_appointment_creation_tests_ajax_cleanup' ), 'Administrator-only fixture cleanup endpoint is registered' );

	if ( $feature_enabled ) {
		$pricing_available = function_exists( 'wpbc_appointment_services_is_pricing_available' ) && wpbc_appointment_services_is_pricing_available();
		wpbc_appointment_tests_add_result( $results, class_exists( 'WPBC_Page_Appointment_Services' ), 'Services administration page is loaded' );
		wpbc_appointment_tests_add_result( $results, false !== has_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICES_LIST', 'wpbc_appointment_services_ajax_list' ), 'Services listing AJAX endpoint is registered' );
		wpbc_appointment_tests_add_result( $results, false !== has_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICE_LOAD', 'wpbc_appointment_services_ajax_load' ), 'Service loading AJAX endpoint is registered' );
		wpbc_appointment_tests_add_result( $results, false !== has_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICE_SAVE', 'wpbc_appointment_services_ajax_save' ), 'Service saving AJAX endpoint is registered' );
		wpbc_appointment_tests_add_result( $results, false !== has_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICE_DUPLICATE', 'wpbc_appointment_services_ajax_duplicate' ), 'Service duplication AJAX endpoint is registered' );
		wpbc_appointment_tests_add_result( $results, false !== has_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICE_ARCHIVE', 'wpbc_appointment_services_ajax_archive' ), 'Service archive AJAX endpoint is registered' );
		wpbc_appointment_tests_add_result( $results, false !== has_action( 'admin_init', 'wpbc_activation__appointment_services__maybe_upgrade' ), 'Appointment schema upgrade path is registered for authorized admin requests' );
		wpbc_appointment_tests_add_result( $results, wpbc_appointment_tests_has_internal_action( 'wpbc_free_version_activation', 'wpbc_activation__appointment_services' ), 'Free activation registers the Appointment schema installer' );
		wpbc_appointment_tests_add_result( $results, wpbc_appointment_tests_has_internal_action( 'wpbc_other_versions_activation', 'wpbc_activation__appointment_services' ), 'Commercial activation registers the Appointment schema installer' );
		wpbc_appointment_tests_add_result( $results, wpbc_appointment_tests_has_internal_action( 'wpbc_free_version_deactivation', 'wpbc_deactivation__appointment_services' ), 'Free full-data removal registers Appointment table cleanup' );
		wpbc_appointment_tests_add_result( $results, wpbc_appointment_tests_has_internal_action( 'wpbc_other_versions_deactivation', 'wpbc_deactivation__appointment_services' ), 'Commercial full-data removal registers Appointment table cleanup' );
		wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_bfb_register_field_packs__appointment_start_over' ), 'Appointment Start Over Form Builder field is loaded' );
		wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_bfb_register_field_packs__field_service_title_hint_wptpl' ), 'Appointment Service Hint Form Builder field is loaded' );
		wpbc_appointment_tests_add_result( $results, class_exists( 'WPBC_Page_Add_Appointment' ), 'Dedicated Add Appointment admin page is loaded' );
		wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_add_appointment_page_is_active' ), 'Add Appointment page routing helper is loaded' );
		wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_add_appointment_page_get_url' ), 'Add Appointment provides a capability-checked administration entry route' );
		wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_add_appointment_page_get_settings' ), 'Add Appointment page options use a normalized configuration contract' );
		if ( function_exists( 'wpbc_add_appointment_page_get_settings' ) ) {
			$had_auto_select_provider      = array_key_exists( 'appointment_auto_select_provider', $_GET ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$original_auto_select_provider = $had_auto_select_provider ? $_GET['appointment_auto_select_provider'] : null; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			unset( $_GET['appointment_auto_select_provider'] );
			$default_page_settings = wpbc_add_appointment_page_get_settings();
			$_GET['appointment_auto_select_provider'] = '1';
			$enabled_page_settings = wpbc_add_appointment_page_get_settings();
			if ( $had_auto_select_provider ) {
				$_GET['appointment_auto_select_provider'] = $original_auto_select_provider;
			} else {
				unset( $_GET['appointment_auto_select_provider'] );
			}

			wpbc_appointment_tests_add_result( $results, false === $default_page_settings['auto_select_provider'], 'Add Appointment keeps the Provider step by default' );
			wpbc_appointment_tests_add_result( $results, true === $enabled_page_settings['auto_select_provider'], 'Add Appointment can explicitly auto-select the only Provider' );
		}
		wpbc_appointment_tests_add_result( $results, is_callable( array( 'WPBC_Add_Booking_Component', 'get_allow_past_min_date_arr' ) ), 'Add Appointment can reuse the standard Add Booking past-date calculation' );
		wpbc_appointment_tests_add_result( $results, shortcode_exists( 'booking_appointment' ), '[booking_appointment] is registered while the gate is enabled' );
		$starter_form_configs = function_exists( 'wpbc_get_activation_booking_form_page_configs' )
			? wpbc_get_activation_booking_form_page_configs()
			: array();
		$appointment_service_form_config = (
			isset( $starter_form_configs['appointment_services_booking'] )
			&& is_array( $starter_form_configs['appointment_services_booking'] )
		)
			? $starter_form_configs['appointment_services_booking']
			: array();
		$starter_page_configs = function_exists( 'wpbc_get_activation_booking_page_configs' )
			? wpbc_get_activation_booking_page_configs()
			: array();
		$appointment_page_config = isset( $starter_page_configs['appointment_booking'] ) && is_array( $starter_page_configs['appointment_booking'] )
			? $starter_page_configs['appointment_booking']
			: array();
		$appointment_page_slug = isset( $appointment_page_config['page_slug'] ) ? $appointment_page_config['page_slug'] : '';
		$appointment_shortcode = isset( $appointment_page_config['shortcode'] ) ? $appointment_page_config['shortcode'] : '';
		wpbc_appointment_tests_add_result(
			$results,
			'appointments_services_flow' === ( isset( $appointment_service_form_config['template_key'] ) ? $appointment_service_form_config['template_key'] : '' )
				&& 'appointment_services_booking' === ( isset( $appointment_service_form_config['form_slug'] ) ? $appointment_service_form_config['form_slug'] : '' )
				&& ! empty( $appointment_service_form_config['assign_to_default_appointment_service'] ),
			'Activation registers one dedicated Appointment Service Booking Form fixture'
		);
		wpbc_appointment_tests_add_result( $results, isset( $starter_form_configs['time_appointments_booking'] ), 'The legacy Time Appointments form remains available as an activation fixture' );
		wpbc_appointment_tests_add_result( $results, ! isset( $starter_page_configs['time_appointments_booking'] ), 'Activation does not create the legacy Time Appointments page' );
		wpbc_appointment_tests_add_result( $results, ! isset( $starter_page_configs['appointment_services_booking'] ), 'The dedicated Appointment Service form does not create a duplicate public page' );
		wpbc_appointment_tests_add_result( $results, 'wpbc-appointment-booking' === $appointment_page_slug, 'Activation registers the canonical Appointment page slug' );
		wpbc_appointment_tests_add_result( $results, '[booking_appointment]' === $appointment_shortcode, 'Activation registers the Appointment workflow shortcode' );
		wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_booking_appointment_resolve_stage' ), 'Appointment stage controller is loaded' );
		wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_booking_appointment_get_service_form_settings_url' ), 'Incompatible Appointment forms provide an authenticated Service editor route with page-level access enforcement' );
		wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_booking_appointment_get_error_response_data' ), 'Appointment errors use a structured response contract for optional actions' );
		if ( function_exists( 'wpbc_booking_appointment_get_service_form_settings_url' ) && is_user_logged_in() ) {
			$service_form_settings_url = wpbc_booking_appointment_get_service_form_settings_url( 321 );
			$service_form_query        = array();
			parse_str( (string) wp_parse_url( $service_form_settings_url, PHP_URL_QUERY ), $service_form_query );
			wpbc_appointment_tests_add_result(
				$results,
				'wpbc-services' === ( isset( $service_form_query['page'] ) ? $service_form_query['page'] : '' )
				&& 321 === absint( isset( $service_form_query['service_id'] ) ? $service_form_query['service_id'] : 0 )
				&& 'booking_form' === ( isset( $service_form_query['wpbc_service_focus'] ) ? $service_form_query['wpbc_service_focus'] : '' ),
				'Service form repair route targets the exact Service and Booking Form inspector group'
			);
		}
		wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_booking_appointment_encode_config' ), 'Appointment configuration signer is loaded' );
		wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_booking_appointment_validate_submission_context' ), 'Signed submission-context validator is loaded' );
		wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_appointment_services_repository' ), 'Appointment Services repository is loaded' );
		wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_appointment_services_get_starter_service_values' ), 'Activation uses one canonical starter Service definition' );
		$starter_service_values = function_exists( 'wpbc_appointment_services_get_starter_service_values' )
			? wpbc_appointment_services_get_starter_service_values( 1, 987654 )
			: array();
		wpbc_appointment_tests_add_result(
			$results,
			987654 === ( isset( $starter_service_values['booking_form_id'] ) ? absint( $starter_service_values['booking_form_id'] ) : 0 ),
			'The starter Service definition accepts its dedicated Booking Form ID'
		);
		wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_appointment_services_get_starter_booking_form_id' ), 'Activation can resolve the dedicated starter Booking Form ID' );
		wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_activation__appointment_services__seed_default_service' ), 'A newly installed Services schema has a retry-safe starter Service seed' );
		wpbc_appointment_tests_add_result(
			$results,
			false !== has_action( 'wpbc_activation_custom_booking_forms_created', 'wpbc_activation__appointment_services__maybe_seed_default_service' ),
			'Pending starter Service seeding resumes after activation custom forms are available'
		);
		wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_appointment_services_apply_assignment_overrides' ), 'Provider-assignment rule resolver is loaded' );
		wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_appointment_services_is_pricing_available' ), 'Service pricing uses one edition-aware capability check' );
		$service_listing_columns    = wpbc_appointment_services_get_catalog_listing()->get_setting( 'columns', array() );
		$service_listing_column_ids = wp_list_pluck( $service_listing_columns, 'id' );
		$service_listing_settings   = wpbc_appointment_services_get_catalog_listing()->get_client_settings();
		$price_column_is_available  = in_array( 'price', $service_listing_column_ids, true );
		$status_column_index = array_search( 'status', $service_listing_column_ids, true );
		$status_column       = false !== $status_column_index ? $service_listing_columns[ $status_column_index ] : array();
		wpbc_appointment_tests_add_result(
			$results,
			! in_array( 'id', $service_listing_column_ids, true )
				&& 'wpbc_appointment_services_render_status_listing_header' === ( isset( $status_column['header_callback'] ) ? $status_column['header_callback'] : '' )
				&& in_array( 'service_id', $service_listing_settings['sortable_columns'], true ),
			'Services catalog combines Service ID with Status while preserving independent ID sorting'
		);
		wpbc_appointment_tests_add_result( $results, $pricing_available === $price_column_is_available, 'Services catalog exposes Price only when the cost engine is available' );
		wpbc_appointment_tests_add_result( $results, false !== has_filter( 'wpbc_booking_cost_base_total', 'wpbc_booking_appointment_filter_base_cost_total' ), 'Appointment base-price integration is registered' );
		wpbc_appointment_tests_add_result( $results, false !== has_filter( 'wpbc_booking_cost_calculation_params', 'wpbc_booking_appointment_filter_cost_params' ), 'Signed live-cost context integration is registered' );
		wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_appointment_services_get_existing_buffer_intervals' ), 'Single-query Provider buffer loader is loaded' );
		wpbc_appointment_tests_add_result( $results, false !== has_action( 'wp_ajax_nopriv_WPBC_AJX_BOOKING_APPOINTMENT_RESOLVE', 'wpbc_booking_appointment_ajax_resolve' ), 'Signed-out AJAX resolver hook is registered' );
		wpbc_appointment_tests_add_result( $results, false !== has_action( 'wp_ajax_WPBC_AJX_BOOKING_APPOINTMENT_RESOLVE', 'wpbc_booking_appointment_ajax_resolve' ), 'Signed-in AJAX resolver hook is registered' );
		wpbc_appointment_tests_add_result( $results, false !== has_action( 'wp_ajax_nopriv_WPBC_AJX_BOOKING_APPOINTMENT_VALIDATE_TIME', 'wpbc_booking_appointment_ajax_validate_time' ), 'Signed-out time-preflight hook is registered' );
		wpbc_appointment_tests_add_result( $results, false !== has_action( 'wp_ajax_WPBC_AJX_BOOKING_APPOINTMENT_VALIDATE_TIME', 'wpbc_booking_appointment_ajax_validate_time' ), 'Signed-in time-preflight hook is registered' );
		wpbc_appointment_tests_add_result( $results, false !== has_filter( 'wpbc_replace_params_for_booking', 'wpbc_appointment_services_add_replace_params' ), 'Appointment email/confirmation replacements are registered' );
		wpbc_appointment_tests_add_result( $results, false !== has_filter( 'wpbc_replace_shortcodes_in_booking_form', 'wpbc_appointment_services_replace_service_title_hint' ), 'Appointment Service Hint form replacement is registered' );
		wpbc_appointment_tests_add_result( $results, false !== has_filter( 'wpbc_email_help_shortcodes', 'wpbc_appointment_services_add_email_help_shortcodes' ), 'Appointment email-shortcode help is registered' );
		wpbc_appointment_tests_add_result( $results, false !== has_filter( 'wpbc_payment_help_shortcodes', 'wpbc_appointment_services_add_payment_help_shortcodes' ), 'Appointment payment-shortcode help is registered' );
		wpbc_appointment_tests_add_result( $results, false !== has_filter( 'wpbc_booking_listing_parsed_fields', 'wpbc_appointment_services_add_listing_fields' ), 'Appointment listing/export fields are registered' );
		$listing_schema = function_exists( 'wpbc_ajx_get__request_params__names_default' ) ? wpbc_ajx_get__request_params__names_default() : array();
		wpbc_appointment_tests_add_result( $results, isset( $listing_schema['wh_appointment_service'] ), 'Booking Listing accepts a sanitized Appointment Service filter' );
		wpbc_appointment_tests_add_result( $results, false !== has_filter( 'wpbc_booking_listing_sql_query_parts', 'wpbc_appointment_services_filter_listing_query' ), 'Appointment Service filtering is attached after native ownership restrictions' );
		wpbc_appointment_tests_add_result( $results, false !== has_action( 'wpbc_booking_listing_toolbar_after_resources', 'wpbc_appointment_services_render_listing_filter' ), 'Appointment Service selector is attached to the native listing toolbar' );
		wpbc_appointment_tests_add_result( $results, false !== has_action( 'wpbc_hook_settings_page_before_content_table', 'wpbc_appointment_services_render_provider_tools' ), 'Provider semantic setup links are attached to the Resources screen' );
		wpbc_appointment_tests_add_result( $results, function_exists( 'wpbc_appointment_services_provider_has_weekly_availability' ), 'Provider weekly-availability guidance is available without replacing native availability' );
		wpbc_appointment_tests_add_result( $results, false !== has_filter( 'wpbc_timeline_booking_pipeline_title', 'wpbc_appointment_services_filter_timeline_pipeline_title' ), 'Appointment Timeline tooltip integration is registered' );
		wpbc_appointment_tests_add_result( $results, false !== has_filter( 'wpbc_timeline_booking_popover', 'wpbc_appointment_services_filter_timeline_popover' ), 'Appointment Timeline popover integration is registered' );
		wpbc_appointment_tests_add_result( $results, false !== has_action( 'wpbc_booking_after_save', 'wpbc_appointment_services_after_booking_save' ), 'Immutable Appointment snapshot hook is registered' );

		$normal_service_hint_html = apply_filters( 'wpbc_replace_shortcodes_in_booking_form', 'Before [service_title_hint] After', 987654, 'standard' );
		wpbc_appointment_tests_add_result( $results, 'Before  After' === $normal_service_hint_html, 'Service Hint is empty outside the Appointment flow' );
		$normal_service_hint_replacements = apply_filters( 'wpbc_replace_params_for_booking', array(), 0, 987654, '' );
		wpbc_appointment_tests_add_result(
			$results,
			array_key_exists( 'service_title_hint', $normal_service_hint_replacements ) && '' === $normal_service_hint_replacements['service_title_hint'],
			'Service Hint email replacement is empty for a non-Appointment booking'
		);

		wpbc_appointment_services_form_hint_context(
			'set',
			array(
				'service_id'  => 123,
				'resource_id' => 987654,
				'title'       => 'Consultation',
			)
		);
		$appointment_service_hint_html = apply_filters( 'wpbc_replace_shortcodes_in_booking_form', '[service_title_hint] / [service_title_hint]', 987654, 'standard' );
		$mismatched_service_hint_html  = apply_filters( 'wpbc_replace_shortcodes_in_booking_form', '[service_title_hint]', 987655, 'standard' );
		wpbc_appointment_services_form_hint_context( 'clear' );
		$service_hint_rendered = false !== strpos( $appointment_service_hint_html, '>Consultation</span>' )
			&& false !== strpos( $appointment_service_hint_html, 'name="service_title_hint987654"' )
			&& 2 === substr_count( $appointment_service_hint_html, '>Consultation</span>' );
		wpbc_appointment_tests_add_result( $results, $service_hint_rendered, 'Appointment Service Hint renders the trusted Service and one submitted field' );
		wpbc_appointment_tests_add_result( $results, '' === $mismatched_service_hint_html, 'Service Hint rejects an Appointment context for another Provider resource' );

		$spoofed_hint = array(
			'service_title_hint' => array(
				'type'          => 'text',
				'original_name' => 'service_title_hint987654',
				'name'          => 'service_title_hint',
				'value'         => 'Spoofed Service',
			),
		);
		$normal_hint_data = wpbc_appointment_services_sync_service_hint_booking_data(
			array( 'service_title_hint' => 'Spoofed Service' ),
			$spoofed_hint,
			array(),
			987654
		);
		$trusted_hint_data = wpbc_appointment_services_sync_service_hint_booking_data(
			array( 'service_title_hint' => 'Spoofed Service' ),
			$spoofed_hint,
			array( 'title' => 'Consultation' ),
			987654
		);
		wpbc_appointment_tests_add_result(
			$results,
			! isset( $normal_hint_data['structured_booking_data']['service_title_hint'], $normal_hint_data['all_booking_data']['service_title_hint'] ),
			'Non-Appointment saves discard submitted Service Hint values'
		);
		wpbc_appointment_tests_add_result(
			$results,
			'Consultation' === $trusted_hint_data['structured_booking_data']['service_title_hint']
				&& 'Consultation' === $trusted_hint_data['all_booking_data']['service_title_hint']['value'],
			'Appointment saves replace submitted Service Hint values with the validated Service title'
		);

		$tables_ready = function_exists( 'wpbc_appointment_services_tables_exist' ) && wpbc_appointment_services_tables_exist();
		wpbc_appointment_tests_add_result( $results, $tables_ready, 'Appointment Services tables are installed', 'Activate/update Booking Calendar or visit an authorized admin page to run the schema upgrade.' );
		wpbc_appointment_tests_add_result(
			$results,
			defined( 'WPBC_APPOINTMENT_SERVICES_DB_VERSION' )
			&& WPBC_APPOINTMENT_SERVICES_DB_VERSION === get_bk_option( 'booking_appointment_services_db_version' ),
			'Appointment Services database version matches the installed schema',
			'Run the authorized Appointment schema upgrade and reload this panel.'
		);
		$picture_service = wpbc_appointment_services_normalize_item(
			array(
				'title'    => 'Picture test',
				'metadata' => wp_json_encode( array( 'picture_url' => 'https://example.com/service.jpg' ) ),
			)
		);
		$unsafe_picture_service = wpbc_appointment_services_normalize_item(
			array(
				'title'       => 'Unsafe picture test',
				'picture_url' => 'javascript:alert(1)',
			)
		);
		wpbc_appointment_tests_add_result( $results, 'https://example.com/service.jpg' === $picture_service['picture_url'], 'Service pictures normalize from the extensible metadata document' );
		wpbc_appointment_tests_add_result( $results, '' === $unsafe_picture_service['picture_url'], 'Unsafe Service picture URLs are rejected before rendering' );
		$provider_image_options = array(
			17 => array( 'picture' => 'https://example.com/provider.jpg' ),
			18 => array( 'picture' => array( 'https://example.com/provider-array.jpg', 64, 64 ) ),
			19 => array( 'picture' => 'javascript:alert(1)' ),
		);
		wpbc_appointment_tests_add_result(
			$results,
			'https://example.com/provider.jpg' === wpbc_appointment_services_get_provider_image_url( 17, $provider_image_options ),
			'Services resolve Provider pictures from Business Large Searchable Resource options'
		);
		wpbc_appointment_tests_add_result(
			$results,
			'https://example.com/provider-array.jpg' === wpbc_booking_appointment_get_provider_image_url( 18, $provider_image_options ),
			'Appointment flow delegates Provider picture resolution to the shared Services resolver'
		);
		wpbc_appointment_tests_add_result(
			$results,
			'' === wpbc_appointment_services_get_provider_image_url( 19, $provider_image_options )
				&& '' === wpbc_appointment_services_get_provider_image_url( 20, $provider_image_options ),
			'Provider picture resolution rejects unsafe and missing values'
		);

		$config = wpbc_booking_appointment_normalize_config(
			array(
				'services'             => '9,3,9,0',
				'providers'            => '7,2,7,0',
				'nummonths'            => 99,
				'startmonth'           => '2026-07',
				'auto_select_provider' => 'off',
			)
		);
		wpbc_appointment_tests_add_result( $results, array( 9, 3 ) === $config['service_ids'], 'Service restrictions normalize to unique positive IDs' );
		wpbc_appointment_tests_add_result( $results, array( 7, 2 ) === $config['provider_ids'], 'Provider restrictions normalize to unique positive IDs' );
		wpbc_appointment_tests_add_result( $results, 24 === $config['cal_count'], 'Calendar count is capped at the public maximum' );
		wpbc_appointment_tests_add_result( $results, false === $config['auto_select_provider'], 'Boolean shortcode options normalize predictably' );
		wpbc_appointment_tests_add_result( $results, false === $config['allow_past'], 'Past-date booking is disabled by default in signed Appointment configuration' );
		$service_order_fixture = array(
			7 => array( 'service_id' => 7, 'title' => 'Alpha Service' ),
			8 => array( 'service_id' => 8, 'title' => 'Beta Service' ),
			9 => array( 'service_id' => 9, 'title' => 'Gamma Service' ),
		);
		$requested_service_order = wpbc_booking_appointment_order_services( $service_order_fixture, array( 9, 7, 8 ) );
		$default_service_order   = wpbc_booking_appointment_order_services( $service_order_fixture );
		wpbc_appointment_tests_add_result( $results, array( 9, 7, 8 ) === array_keys( $requested_service_order ), 'Appointment Services follow the explicit shortcode order' );
		wpbc_appointment_tests_add_result( $results, array( 7, 8, 9 ) === array_keys( $default_service_order ), 'Appointment Services retain natural title order when the shortcode omits a Service list' );

		$default_config = wpbc_booking_appointment_normalize_config( array() );
		wpbc_appointment_tests_add_result( $results, false === $default_config['auto_select_provider'], 'Appointment shortcode keeps the Provider step by default' );
		wpbc_appointment_tests_add_result( $results, true === $default_config['show_progress'], 'Appointment shortcode shows the progress line by default' );
		$default_progress_html = wpbc_booking_appointment_render_progress( 1, $default_config );
		$has_default_progress  = false !== strpos( $default_progress_html, '>1</span><span class="wpbc_booking_appointment__progress_label">Service<' )
			&& false !== strpos( $default_progress_html, '>2</span><span class="wpbc_booking_appointment__progress_label">Provider<' )
			&& false !== strpos( $default_progress_html, '>3</span><span class="wpbc_booking_appointment__progress_label">Date &amp; Details<' );
		wpbc_appointment_tests_add_result( $results, $has_default_progress, 'Omitted progress parameters use the default numbers and titles' );
		$default_screen_heading = wpbc_booking_appointment_render_screen_heading(
			$default_config,
			1,
			__( 'Choose a Service', 'booking' ),
			__( 'Select what you would like to book.', 'booking' )
		);
		$has_default_screen_copy = false !== strpos( $default_screen_heading, '<h3>' . esc_html__( 'Choose a Service', 'booking' ) . '</h3>' )
			&& false !== strpos( $default_screen_heading, '<p>' . esc_html__( 'Select what you would like to book.', 'booking' ) . '</p>' );
		wpbc_appointment_tests_add_result( $results, $has_default_screen_copy, 'Omitted screen copy parameters use translated defaults' );

		$auto_select_provider_config = wpbc_booking_appointment_normalize_config( array( 'auto_select_provider' => 'on' ) );
		wpbc_appointment_tests_add_result( $results, true === $auto_select_provider_config['auto_select_provider'], 'Appointment shortcode can explicitly auto-select the only Provider' );

		$hidden_progress_config = wpbc_booking_appointment_normalize_config( array( 'show_progress' => 'off' ) );
		$progress_is_hidden     = false === $hidden_progress_config['show_progress'] && '' === wpbc_booking_appointment_render_progress( 1, $hidden_progress_config );
		wpbc_appointment_tests_add_result( $results, $progress_is_hidden, 'Appointment shortcode can hide the complete progress line' );

		$custom_progress_config = wpbc_booking_appointment_normalize_config(
			array(
				'progress_item_1_title' => '',
				'progress_item_1_number' => '01/03',
				'progress_item_2_title' => 'Specialist',
				'progress_item_3_title' => 'Schedule & Details',
				'screen_1_title'        => '',
				'screen_1_description'  => 'Pick & book.',
				'screen_2_title'        => 'Choose a Specialist',
				'screen_2_description'  => '',
			)
		);
		$custom_progress_html        = wpbc_booking_appointment_render_progress( 2, $custom_progress_config );
		$has_custom_progress_values = false !== strpos( $custom_progress_html, '>01/03</span><span class="wpbc_booking_appointment__progress_label"></span>' )
			&& false !== strpos( $custom_progress_html, '>Specialist<' )
			&& false !== strpos( $custom_progress_html, '>Schedule &amp; Details<' );
		wpbc_appointment_tests_add_result(
			$results,
			$has_custom_progress_values,
			'Appointment shortcode renders empty titles and custom progress values safely'
		);
		$custom_screen_1_heading = wpbc_booking_appointment_render_screen_heading( $custom_progress_config, 1, 'Default title', 'Default description' );
		$custom_screen_2_heading = wpbc_booking_appointment_render_screen_heading( $custom_progress_config, 2, 'Default title', 'Default description' );
		$has_custom_screen_copy  = false === strpos( $custom_screen_1_heading, '<h3>' )
			&& false !== strpos( $custom_screen_1_heading, '<p>Pick &amp; book.</p>' )
			&& false !== strpos( $custom_screen_2_heading, '<h3>Choose a Specialist</h3>' )
			&& false === strpos( $custom_screen_2_heading, '<p>' );
		wpbc_appointment_tests_add_result( $results, $has_custom_screen_copy, 'Appointment shortcode can replace or hide each screen title and description independently' );
		$custom_progress_token      = wpbc_booking_appointment_encode_config( $custom_progress_config );
		$decoded_progress_config   = wpbc_booking_appointment_decode_config( $custom_progress_token );
		$custom_progress_round_trip = ! is_wp_error( $decoded_progress_config )
			&& '' === $decoded_progress_config['progress_item_1_title']
			&& '01/03' === $decoded_progress_config['progress_item_1_number']
			&& 'Specialist' === $decoded_progress_config['progress_item_2_title']
			&& 'Pick & book.' === $decoded_progress_config['screen_1_description'];
		wpbc_appointment_tests_add_result( $results, $custom_progress_round_trip, 'Normalized progress and screen copy survive signed AJAX configuration round trips' );

		$legacy_progress_config = wpbc_booking_appointment_normalize_config(
			array(
				'progress_service_title'  => '',
				'progress_service_number' => 'Legacy number',
				'progress_item_1_number'  => 'Canonical number',
			)
		);
		$legacy_progress_is_normalized = '' === $legacy_progress_config['progress_item_1_title']
			&& 'Canonical number' === $legacy_progress_config['progress_item_1_number']
			&& ! array_key_exists( 'progress_service_title', $legacy_progress_config )
			&& ! array_key_exists( 'progress_service_number', $legacy_progress_config );
		wpbc_appointment_tests_add_result( $results, $legacy_progress_is_normalized, 'Legacy progress names normalize to indexed names while canonical values take precedence' );

		$allow_past_config = wpbc_booking_appointment_normalize_config( array( 'allow_past' => 'on' ) );
		wpbc_appointment_tests_add_result( $results, true === $allow_past_config['allow_past'], 'Add Appointment can carry past-date context through its signed AJAX controller' );
		wpbc_appointment_tests_add_result( $results, false === wpbc_booking_appointment_is_past_booking_enabled( array( 'allow_past' => false ) ), 'Past Appointment creation remains disabled without explicit opt-in' );
		wpbc_appointment_tests_add_result( $results, true === wpbc_booking_appointment_is_past_booking_enabled( $allow_past_config ), 'Signed shortcode opt-in enables past Appointment creation without a login requirement' );

		$token   = wpbc_booking_appointment_encode_config( $config );
		$decoded = wpbc_booking_appointment_decode_config( $token );
		wpbc_appointment_tests_add_result( $results, ! is_wp_error( $decoded ) && $decoded['service_ids'] === $config['service_ids'], 'Signed Appointment configuration round-trips' );
		wpbc_appointment_tests_add_result( $results, is_wp_error( wpbc_booking_appointment_decode_config( $token . 'x' ) ), 'Tampered Appointment configuration is rejected' );

		$submission_token = wpbc_booking_appointment_encode_submission_context( array(), 9, 7 );
		$submission_valid = wpbc_booking_appointment_validate_submission_context( $submission_token, 9, 7 );
		$submission_wrong = wpbc_booking_appointment_validate_submission_context( $submission_token, 9, 8 );
		$submission_empty = wpbc_booking_appointment_validate_submission_context( '', 9, 7 );
		wpbc_appointment_tests_add_result( $results, ! is_wp_error( $submission_valid ), 'Signed submission context accepts its exact Service/Provider pair' );
		wpbc_appointment_tests_add_result( $results, is_wp_error( $submission_wrong ) && 'appointment_context_mismatch' === $submission_wrong->get_error_code(), 'Signed submission context rejects a different Provider' );
		wpbc_appointment_tests_add_result( $results, is_wp_error( $submission_empty ) && 'appointment_context_required' === $submission_empty->get_error_code(), 'Appointment submissions require a signed selection context' );

		$override_rules = wpbc_appointment_services_apply_assignment_overrides(
			array(
				'duration_minutes' => 30,
				'duration_override'=> 45,
				'base_cost'        => '25.00',
				'cost_override'    => '0.00',
			)
		);
		wpbc_appointment_tests_add_result( $results, 45 === $override_rules['duration_minutes'] && 30 === $override_rules['base_duration_minutes'], 'Provider duration override becomes the effective duration' );
		wpbc_appointment_tests_add_result( $results, '0.00' === $override_rules['base_cost'] && '25.00' === $override_rules['base_service_cost'], 'A zero Provider cost override remains a deliberate override' );
		$variable_duration_summary = wpbc_booking_appointment_get_duration_summary(
			array(
				'duration_minutes' => 30,
				'provider_rules'   => array(
					2 => array( 'duration_minutes' => 30 ),
					7 => array( 'duration_minutes' => 45 ),
				),
			)
		);
		wpbc_appointment_tests_add_result( $results, __( 'Duration varies by Provider', 'booking' ) === $variable_duration_summary, 'Provider-dependent durations are explained before Provider selection' );
		$resolved_end       = wpbc_appointment_services_resolve_end_seconds( array( 'duration_minutes' => 45 ), 9 * HOUR_IN_SECONDS, 1440 );
		$invalid_end        = wpbc_appointment_services_resolve_end_seconds( array( 'duration_minutes' => 90 ), 23 * HOUR_IN_SECONDS, 1440 );
		$stored_interval    = wpbc_appointment_services_normalize_stored_interval( '2030-01-15 09:00:01', '2030-01-15 10:00:02' );
		$expected_start     = wpbc_convert__sql_date__to_seconds( '2030-01-15 09:00:00', false );
		$expected_end       = wpbc_convert__sql_date__to_seconds( '2030-01-15 10:00:00', false );
		$adjacent_intervals = wpbc_appointment_services_intervals_overlap( $expected_start, $expected_end, $expected_end, $expected_end + HOUR_IN_SECONDS );
		$buffered_overlap   = wpbc_appointment_services_intervals_overlap( $expected_start, $expected_end + ( 10 * MINUTE_IN_SECONDS ), $expected_end, $expected_end + HOUR_IN_SECONDS );
		$day_start          = wpbc_convert__sql_date__to_seconds( '2030-01-15 00:00:00', false );
		$existing_gap       = array(
			array( 'start' => $day_start + ( 13 * HOUR_IN_SECONDS ), 'end' => $day_start + ( 14 * HOUR_IN_SECONDS ), 'buffer_before_minutes' => 0, 'buffer_after_minutes' => 0 ),
			array( 'start' => $day_start + ( 16 * HOUR_IN_SECONDS ), 'end' => $day_start + ( 16 * HOUR_IN_SECONDS ) + ( 30 * MINUTE_IN_SECONDS ), 'buffer_before_minutes' => 0, 'buffer_after_minutes' => 0 ),
			array( 'start' => $day_start + ( 17 * HOUR_IN_SECONDS ), 'end' => $day_start + ( 17 * HOUR_IN_SECONDS ) + ( 30 * MINUTE_IN_SECONDS ), 'buffer_before_minutes' => 0, 'buffer_after_minutes' => 0 ),
		);
		$existing_with_after_buffer = $existing_gap;
		$existing_with_after_buffer[0]['buffer_after_minutes'] = 20;
		$slot_1400_without_old_buffer = wpbc_appointment_services_has_buffer_conflict( $day_start + ( 14 * HOUR_IN_SECONDS ), $day_start + ( 14 * HOUR_IN_SECONDS ) + ( 30 * MINUTE_IN_SECONDS ), 0, 20, $existing_gap );
		$slot_1400_with_old_buffer    = wpbc_appointment_services_has_buffer_conflict( $day_start + ( 14 * HOUR_IN_SECONDS ), $day_start + ( 14 * HOUR_IN_SECONDS ) + ( 30 * MINUTE_IN_SECONDS ), 0, 20, $existing_with_after_buffer );
		$slot_1430                    = wpbc_appointment_services_has_buffer_conflict( $day_start + ( 14 * HOUR_IN_SECONDS ) + ( 30 * MINUTE_IN_SECONDS ), $day_start + ( 15 * HOUR_IN_SECONDS ), 0, 20, $existing_with_after_buffer );
		$slot_1500                    = wpbc_appointment_services_has_buffer_conflict( $day_start + ( 15 * HOUR_IN_SECONDS ), $day_start + ( 15 * HOUR_IN_SECONDS ) + ( 30 * MINUTE_IN_SECONDS ), 0, 20, $existing_with_after_buffer );
		$slot_1530                    = wpbc_appointment_services_has_buffer_conflict( $day_start + ( 15 * HOUR_IN_SECONDS ) + ( 30 * MINUTE_IN_SECONDS ), $day_start + ( 16 * HOUR_IN_SECONDS ), 0, 20, $existing_with_after_buffer );
		$preloaded_buffer_check       = wpbc_appointment_services_check_buffer_conflicts_in_intervals(
			array( 'buffer_before_minutes' => 0, 'buffer_after_minutes' => 20 ),
			array( '2030-01-15' ),
			array( 14 * HOUR_IN_SECONDS, ( 14 * HOUR_IN_SECONDS ) + ( 30 * MINUTE_IN_SECONDS ) ),
			$existing_with_after_buffer
		);
		$admin_time_details = wpbc_appointment_services_get_admin_time_details(
			array( 'buffer_before_minutes' => 10, 'buffer_after_minutes' => 20 ),
			(object) array( 'dates' => array( '2030-01-15 13:00:01', '2030-01-15 14:00:02' ) )
		);
		wpbc_appointment_tests_add_result( $results, ( 9 * HOUR_IN_SECONDS ) + ( 45 * MINUTE_IN_SECONDS ) === $resolved_end, 'Service duration derives the exact server-side end time' );
		wpbc_appointment_tests_add_result( $results, is_wp_error( $invalid_end ) && 'appointment_service_duration_invalid' === $invalid_end->get_error_code(), 'A Service that crosses midnight is rejected' );
		wpbc_appointment_tests_add_result( $results, $expected_start === $stored_interval[0] && $expected_end === $stored_interval[1], 'Internal booking boundary markers normalize to exact Service times' );
		wpbc_appointment_tests_add_result( $results, false === $adjacent_intervals && true === $buffered_overlap, 'Adjacent zero-buffer Appointments remain available while a real buffer overlaps' );
		wpbc_appointment_tests_add_result( $results, false === $slot_1400_without_old_buffer, '14:00 remains valid when the 13:00-14:00 booking has no saved after-buffer' );
		wpbc_appointment_tests_add_result( $results, true === $slot_1400_with_old_buffer, '14:00 is blocked when the earlier Appointment owns a 20-minute after-buffer' );
		wpbc_appointment_tests_add_result( $results, false === $slot_1430 && false === $slot_1500 && true === $slot_1530, 'A 30-minute Service plus 20-minute after-buffer fits at 14:30 and 15:00 but not 15:30 before a 16:00 booking' );
		wpbc_appointment_tests_add_result( $results, is_wp_error( $preloaded_buffer_check ) && 'appointment_service_buffer_conflict' === $preloaded_buffer_check->get_error_code(), 'Bulk and selected-time checks share the same preloaded buffer rule' );
		wpbc_appointment_tests_add_result(
			$results,
			isset( $admin_time_details['appointment_reserved_start'], $admin_time_details['appointment_reserved_end'] )
				&& ( $day_start + ( 12 * HOUR_IN_SECONDS ) + ( 50 * MINUTE_IN_SECONDS ) ) === $admin_time_details['appointment_reserved_start']
				&& ( $day_start + ( 14 * HOUR_IN_SECONDS ) + ( 20 * MINUTE_IN_SECONDS ) ) === $admin_time_details['appointment_reserved_end'],
			'Administrator details distinguish Appointment time from Provider reserved time'
		);

		$catalog = wpbc_booking_appointment_get_catalog( wpbc_booking_appointment_normalize_config( array() ) );
		wpbc_appointment_tests_add_result( $results, ! is_wp_error( $catalog ), 'Public Service/Provider catalog resolves without an error', is_wp_error( $catalog ) ? $catalog->get_error_message() : '' );
		if ( ! is_wp_error( $catalog ) ) {
			$catalog_shape = isset( $catalog['services'], $catalog['providers'], $catalog['diagnostics'] ) && is_array( $catalog['services'] ) && is_array( $catalog['providers'] ) && is_array( $catalog['diagnostics'] );
			wpbc_appointment_tests_add_result( $results, $catalog_shape, 'Public catalog has stable services/providers/diagnostics collections' );
			wpbc_appointment_tests_add_result( $results, ! empty( $catalog['services'] ), 'At least one active public Service is available', 'Create an active Service and assign an active Provider before testing the complete HTTP form stage.', empty( $catalog['services'] ) );

			$fixture = wpbc_appointment_tests_get_http_fixture( $catalog );
			if ( $fixture['service_id'] && $fixture['provider_id'] ) {
				$service = wpbc_booking_appointment_get_service( $catalog, $fixture['service_id'] );
				$effective_service = is_wp_error( $service ) ? $service : wpbc_booking_appointment_get_effective_service( $service, $fixture['provider_id'] );
				$saved_service     = wpbc_appointment_services_repository()->find_active_for_resource( $fixture['service_id'], $fixture['provider_id'] );
				$effective_rules_match = ! is_wp_error( $effective_service )
					&& ! is_wp_error( $saved_service )
					&& absint( $effective_service['duration_minutes'] ) === absint( $saved_service['duration_minutes'] )
					&& (
						$pricing_available
							? (string) $effective_service['base_cost'] === (string) $saved_service['base_cost']
							: '' === (string) $effective_service['base_cost']
					);
				wpbc_appointment_tests_add_result( $results, $effective_rules_match, 'Rendered and saved Appointment rules resolve identically' );
				$filtered_base_cost = is_wp_error( $effective_service )
					? null
					: apply_filters(
						'wpbc_booking_cost_base_total',
						999.99,
						array( 'service_id' => $fixture['service_id'], 'resource_id' => $fixture['provider_id'] )
					);
				$expected_base_cost = $pricing_available && ! is_wp_error( $effective_service ) ? (float) $effective_service['base_cost'] : 999.99;
				wpbc_appointment_tests_add_result( $results, ! is_wp_error( $effective_service ) && $expected_base_cost === (float) $filtered_base_cost, 'Service price replaces the base total only when the edition cost engine is available' );
				$resolved_form_slug = is_wp_error( $effective_service ) ? '' : wpbc_booking_appointment_resolve_form_slug( $effective_service, $fixture['provider_id'], array( 'form_type' => '' ) );
				wpbc_appointment_tests_add_result( $results, '' !== $resolved_form_slug, 'Service Booking Form resolves to a published slug or standard fallback' );
				$submission_token = wpbc_booking_appointment_encode_submission_context( array(), $fixture['service_id'], $fixture['provider_id'] );
				$previous_post    = $_POST;
				$_POST['appointment_service_id']    = $fixture['service_id'];
				$_POST['appointment_context_token'] = $submission_token;
				$live_cost_params = apply_filters( 'wpbc_booking_cost_calculation_params', array( 'resource_id' => $fixture['provider_id'] ) );
				$_POST             = $previous_post;
				$expected_live_service_id = $pricing_available ? $fixture['service_id'] : 0;
				wpbc_appointment_tests_add_result( $results, $expected_live_service_id === absint( isset( $live_cost_params['service_id'] ) ? $live_cost_params['service_id'] : 0 ), 'Signed live-cost context is applied only when Service pricing is available' );
				$provider_markup = is_wp_error( $service )
					? ''
					: wpbc_booking_appointment_render_providers(
						$catalog,
						$service,
						wpbc_booking_appointment_encode_config( array() ),
						array()
					);
				$provider_terms_are_clear = false !== strpos( $provider_markup, esc_html__( 'Offers this Service', 'booking' ) ) && false === strpos( $provider_markup, esc_html__( 'Available Provider', 'booking' ) );
				wpbc_appointment_tests_add_result( $results, $provider_terms_are_clear, 'Provider choices use Service-specific terminology' );
			} else {
				wpbc_appointment_tests_add_result( $results, false, 'Provider choices use Service-specific terminology', 'Create an active Service and assign an active Provider.', true );
			}
		}

		$snapshot_booking_id = 0;
		if ( $tables_ready ) {
			global $wpdb;
			$snapshot_booking_id = absint( $wpdb->get_var( 'SELECT booking_id FROM ' . wpbc_appointment_services_table_name( 'appointment_details' ) . ' ORDER BY appointment_detail_id DESC LIMIT 1' ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		}
		if ( $snapshot_booking_id ) {
			$snapshot       = wpbc_appointment_services_repository()->get_appointment_snapshot( $snapshot_booking_id );
			$replace_values = apply_filters( 'wpbc_replace_params_for_booking', array(), $snapshot_booking_id, $snapshot['resource_id'], '' );
			$listing_values = apply_filters( 'wpbc_booking_listing_parsed_fields', array(), $snapshot_booking_id, null );
			$replacement_ok = isset( $replace_values['service_title'], $replace_values['service_title_hint'], $replace_values['service_duration'], $replace_values['service_cost'], $replace_values['service_cost_digits_only'], $replace_values['provider_title'], $replace_values['appointment_summary'] );
			$listing_ok     = isset( $listing_values['appointment_service_title'], $listing_values['appointment_provider_title'], $listing_values['appointment_duration_minutes'], $listing_values['appointment_service_cost'] );
			wpbc_appointment_tests_add_result( $results, $replacement_ok, 'Saved Appointment exposes immutable email/confirmation values' );
			wpbc_appointment_tests_add_result( $results, $listing_ok, 'Saved Appointment exposes listing/export values' );
		} else {
			wpbc_appointment_tests_add_result( $results, false, 'Saved Appointment exposes immutable email/confirmation values', 'Create one Appointment through [booking_appointment], then reload this panel.', true );
			wpbc_appointment_tests_add_result( $results, false, 'Saved Appointment exposes listing/export values', 'Create one Appointment through [booking_appointment], then reload this panel.', true );
		}

		$html = do_shortcode( '[booking_appointment services="2147483647"]' );
		wpbc_appointment_tests_add_result( $results, false !== strpos( $html, 'wpbc_booking_appointment' ), 'Appointment shortcode renders its isolated component wrapper' );

		$multiple_instances_html = do_shortcode( '[booking_appointment services="2147483647"][booking_appointment services="2147483647"]' );
		$instance_matches        = array();
		preg_match_all( '/id="(wpbc_booking_appointment_\d+)"/', $multiple_instances_html, $instance_matches );
		$instance_ids = isset( $instance_matches[1] ) ? array_values( array_unique( $instance_matches[1] ) ) : array();
		wpbc_appointment_tests_add_result(
			$results,
			2 === count( $instance_ids ),
			'Multiple Appointment blocks receive isolated component IDs',
			'Expected two unique Appointment component wrappers on the same page.'
		);
	} else {
		wpbc_appointment_tests_add_result( $results, ! shortcode_exists( 'booking_appointment' ), '[booking_appointment] stays unavailable while the gate is disabled' );
		$disabled_starter_page_configs = function_exists( 'wpbc_get_activation_booking_page_configs' )
			? wpbc_get_activation_booking_page_configs()
			: array();
		wpbc_appointment_tests_add_result( $results, ! isset( $disabled_starter_page_configs['appointment_booking'] ), 'Appointment starter page stays unavailable while the gate is disabled' );
		wpbc_appointment_tests_add_result( $results, ! function_exists( 'wpbc_bfb_register_field_packs__field_service_title_hint_wptpl' ), 'Appointment Service Hint Form Builder field stays unavailable while the gate is disabled' );
		wpbc_appointment_tests_add_result( $results, ! function_exists( 'wpbc_booking_appointment_resolve_stage' ), 'Appointment controller stays unloaded while the gate is disabled' );
		wpbc_appointment_tests_add_result( $results, ! function_exists( 'wpbc_appointment_services_repository' ), 'Appointment Services repository stays unloaded while the gate is disabled' );
		wpbc_appointment_tests_add_result( $results, ! class_exists( 'WPBC_Page_Appointment_Services' ) && ! class_exists( 'WPBC_Page_Add_Appointment' ), 'Services and Add Appointment pages stay unloaded while the gate is disabled' );
		wpbc_appointment_tests_add_result( $results, ! function_exists( 'wpbc_bfb_register_field_packs__appointment_start_over' ), 'Appointment Start Over Form Builder field stays unloaded while the gate is disabled' );
		wpbc_appointment_tests_add_result( $results, false === has_action( 'admin_init', 'wpbc_activation__appointment_services__maybe_upgrade' ), 'Appointment schema upgrade path stays unloaded while the gate is disabled' );
		wpbc_appointment_tests_add_result( $results, ! wpbc_appointment_tests_has_internal_action( 'wpbc_free_version_activation', 'wpbc_activation__appointment_services' ) && ! wpbc_appointment_tests_has_internal_action( 'wpbc_other_versions_activation', 'wpbc_activation__appointment_services' ), 'Appointment activation callbacks stay unloaded while the gate is disabled' );
		wpbc_appointment_tests_add_result(
			$results,
			false === has_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICES_LIST', 'wpbc_appointment_services_ajax_list' )
			&& false === has_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICE_LOAD', 'wpbc_appointment_services_ajax_load' )
			&& false === has_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICE_SAVE', 'wpbc_appointment_services_ajax_save' )
			&& false === has_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICE_DUPLICATE', 'wpbc_appointment_services_ajax_duplicate' )
			&& false === has_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICE_ARCHIVE', 'wpbc_appointment_services_ajax_archive' ),
			'Services AJAX endpoints stay unloaded while the gate is disabled'
		);
		wpbc_appointment_tests_add_result(
			$results,
			false === has_action( 'wp_ajax_WPBC_AJX_BOOKING_APPOINTMENT_RESOLVE', 'wpbc_booking_appointment_ajax_resolve' )
			&& false === has_action( 'wp_ajax_nopriv_WPBC_AJX_BOOKING_APPOINTMENT_RESOLVE', 'wpbc_booking_appointment_ajax_resolve' )
			&& false === has_action( 'wp_ajax_WPBC_AJX_BOOKING_APPOINTMENT_VALIDATE_TIME', 'wpbc_booking_appointment_ajax_validate_time' )
			&& false === has_action( 'wp_ajax_nopriv_WPBC_AJX_BOOKING_APPOINTMENT_VALIDATE_TIME', 'wpbc_booking_appointment_ajax_validate_time' ),
			'Appointment public AJAX endpoints stay unloaded while the gate is disabled'
		);
		wpbc_appointment_tests_add_result( $results, false === has_action( 'wpbc_enqueue_js_files', 'wpbc_booking_appointment_enqueue_js' ) && false === has_action( 'wpbc_enqueue_css_files', 'wpbc_booking_appointment_enqueue_css' ), 'Appointment assets stay unregistered while the gate is disabled' );
		wpbc_appointment_tests_add_result( $results, ! wp_script_is( 'wpbc-booking-appointment', 'registered' ) && ! wp_style_is( 'wpbc-booking-appointment', 'registered' ), 'Appointment runtime assets stay unloaded while the gate is disabled' );
	}

	return array(
		'feature_enabled' => $feature_enabled,
		'results'         => $results,
		'catalog'         => $catalog,
	);
}

/**
 * Select the first public Service/Provider pair for a read-only HTTP render test.
 *
 * @param array<string,mixed>|WP_Error $catalog Public Appointment catalog.
 *
 * @return array{service_id:int,provider_id:int,duration_minutes:int,service_cost:string,form_slug:string} Fixture values or zeros when no pair exists.
 */
function wpbc_appointment_tests_get_http_fixture( $catalog ) {
	$fixture = array(
		'service_id'      => 0,
		'provider_id'     => 0,
		'duration_minutes'=> 0,
		'service_cost'    => '',
		'form_slug'       => 'standard',
	);
	if ( is_wp_error( $catalog ) || empty( $catalog['services'] ) ) {
		return $fixture;
	}

	foreach ( $catalog['services'] as $service ) {
		if ( empty( $service['service_id'] ) || empty( $service['resource_ids'] ) ) {
			continue;
		}
		$fixture['service_id']  = absint( $service['service_id'] );
		$fixture['provider_id'] = absint( reset( $service['resource_ids'] ) );
		if ( $fixture['service_id'] && $fixture['provider_id'] ) {
			$effective_service           = wpbc_booking_appointment_get_effective_service( $service, $fixture['provider_id'] );
			$fixture['duration_minutes'] = absint( $effective_service['duration_minutes'] );
			$fixture['service_cost']     = wpbc_appointment_services_is_pricing_available()
				? number_format( (float) $effective_service['base_cost'], 2, '.', '' )
				: '';
			$fixture['form_slug']        = wpbc_booking_appointment_resolve_form_slug( $effective_service, $fixture['provider_id'], array( 'form_type' => '' ) );
			break;
		}
	}

	return $fixture;
}

/**
 * Build every active Service/Provider pair available to controlled HTTP tests.
 *
 * @param array<string,mixed>|WP_Error $catalog Public Appointment catalog.
 *
 * @return array<int,array{service_id:int,provider_id:int,label:string}> Selectable fixture pairs.
 */
function wpbc_appointment_tests_get_http_fixtures( $catalog ) {
	$fixtures = array();
	if ( is_wp_error( $catalog ) || empty( $catalog['services'] ) || empty( $catalog['providers'] ) ) {
		return $fixtures;
	}

	foreach ( $catalog['services'] as $service ) {
		foreach ( (array) $service['resource_ids'] as $provider_id ) {
			$provider_id = absint( $provider_id );
			if ( ! $provider_id || empty( $catalog['providers'][ $provider_id ] ) ) {
				continue;
			}
			$fixtures[] = array(
				'service_id'  => absint( $service['service_id'] ),
				'provider_id' => $provider_id,
				'label'       => sprintf(
					/* translators: 1: Service title, 2: Provider title. */
					__( '%1$s with %2$s', 'booking' ),
					wp_strip_all_tags( $service['title'] ),
					wp_strip_all_tags( $catalog['providers'][ $provider_id ]['title'] )
				),
			);
		}
	}
	return $fixtures;
}
