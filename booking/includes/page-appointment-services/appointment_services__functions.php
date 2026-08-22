<?php
/** Appointment Services helpers and repository boundary. @package Booking Calendar */
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Determine whether the current request is the Appointment Services page.
 *
 * @return bool True only for the wpbc-services WordPress admin route.
 */
function wpbc_appointment_services__is_page() {
	if ( ! is_admin() ) { return false; }
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$page = isset( $_REQUEST['page'] ) ? sanitize_key( wp_unslash( $_REQUEST['page'] ) ) : '';
	return 'wpbc-services' === $page;
}

/**
 * Return the capability required to manage Appointment Services.
 *
 * @return string WordPress capability name.
 */
function wpbc_appointment_services_get_manage_capability() {
	$settings_role = get_bk_option( 'booking_user_role_settings' );
	$capabilities  = array(
		'administrator' => 'activate_plugins',
		'editor'        => 'publish_pages',
		'author'        => 'publish_posts',
		'contributor'   => 'edit_posts',
		'subscriber'    => 'read',
	);
	$capability = isset( $capabilities[ $settings_role ] ) ? $capabilities[ $settings_role ] : 'manage_options';

	/**
	 * Filter the capability required to manage Appointment Services.
	 *
	 * @param string $capability WordPress capability name.
	 */
	return (string) apply_filters( 'wpbc_appointment_services_manage_capability', $capability );
}

/**
 * Determine whether Service pricing can use the Booking Calendar cost engine.
 *
 * The database fields remain available in every edition so upgrades and
 * downgrades never require a destructive schema change. Presentation, editing,
 * calculation, and public output use this single runtime check so editions
 * below Business Small cannot advertise or apply an unsupported price.
 *
 * @return bool True when Service pricing is available in the active edition.
 */
function wpbc_appointment_services_is_pricing_available() {
	$is_available = class_exists( 'wpdev_bk_biz_s' );

	/**
	 * Filter whether the active edition or an extension provides Service pricing.
	 *
	 * @param bool $is_available Whether the Business Small cost engine is loaded.
	 */
	return (bool) apply_filters( 'wpbc_appointment_services_pricing_available', $is_available );
}

/**
 * Read the requested Service inspector focus from the administration URL.
 *
 * The value controls only presentation after an authorized Service has loaded.
 * Keeping an explicit allow-list prevents request data from becoming a CSS or
 * DOM selector in the Services JavaScript client.
 *
 * @return string Supported inspector focus key, or an empty string.
 */
function wpbc_appointment_services_get_requested_focus_section() {
	if ( ! isset( $_GET['wpbc_service_focus'] ) || is_array( $_GET['wpbc_service_focus'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return '';
	}

	$requested_focus = sanitize_key( wp_unslash( $_GET['wpbc_service_focus'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$allowed_focuses = array( 'booking_form' );

	return in_array( $requested_focus, $allowed_focuses, true ) ? $requested_focus : '';
}

/**
 * Determine whether the current user satisfies the configured Availability role.
 *
 * Booking Calendar stores a minimum WordPress role in
 * `booking_user_role_availability`. The native role helper maps that role to a
 * hierarchical capability, allowing administrators to access pages configured
 * for editors or lower roles. Passing the stored role directly to
 * `current_user_can()` would incorrectly reject those higher roles.
 *
 * @return bool True when the current user may manage Booking Calendar availability.
 */
function wpbc_appointment_services_can_manage_availability() {
	$availability_role = sanitize_key( (string) get_bk_option( 'booking_user_role_availability' ) );

	if ( '' === $availability_role ) {
		return false;
	}
	if ( function_exists( 'wpbc_is_current_user_have_this_role' ) ) {
		return wpbc_is_current_user_have_this_role( $availability_role );
	}

	return current_user_can( $availability_role );
}

/**
 * Resolve the MultiUser-aware owner for Service queries and writes.
 *
 * @return int Owner user ID, or zero for site-wide ownership.
 */
function wpbc_appointment_services_get_owner_user_id() {
	if ( class_exists( 'WPBC_FE_Custom_Form_Helper' ) ) {
		return absint( WPBC_FE_Custom_Form_Helper::wpbc_mu__get_current__owner_user_id() );
	}
	if ( class_exists( 'wpdev_bk_multiuser' ) ) {
		$current_user_id = wpbc_get_current_user_id();
		if ( ! apply_bk_filter( 'is_user_super_admin', $current_user_id ) ) { return absint( $current_user_id ); }
	}
	return 0;
}

/**
 * Determine whether the current user may query Services from all owners.
 *
 * @return bool True for a Booking Calendar MultiUser super administrator.
 */
function wpbc_appointment_services_can_view_all_owners() {
	return class_exists( 'wpdev_bk_multiuser' ) && apply_bk_filter( 'is_user_super_admin', wpbc_get_current_user_id() );
}

/**
 * Return existing Booking Calendar resources as Provider choices.
 *
 * @return array<int,string> Provider titles keyed by booking resource ID.
 */
function wpbc_appointment_services_get_provider_options() {
	$options = array();
	$resources = apply_bk_filter( 'wpdebk_get_keyed_all_bk_resources', array() );
	foreach ( (array) $resources as $resource_id => $resource ) {
		$resource = is_object( $resource ) ? get_object_vars( $resource ) : (array) $resource;
		$id = ! empty( $resource['id'] ) ? absint( $resource['id'] ) : absint( $resource_id );
		if ( $id ) { $options[ $id ] = ! empty( $resource['title'] ) ? wpbc_lang( $resource['title'] ) : sprintf( __( 'Provider #%d', 'booking' ), $id ); }
	}
	if ( empty( $options ) && ! class_exists( 'wpdev_bk_personal' ) ) {
		$title = function_exists( 'wpbc_get_resource_title' ) ? wpbc_get_resource_title( 1 ) : '';
		$options[1] = $title ? $title : __( 'Default Provider', 'booking' );
	}
	return apply_filters( 'wpbc_appointment_service_provider_options', $options );
}

/**
 * Build the Provider-specific Working Time administration URL.
 *
 * The Services catalog exposes only a recurring weekday summary. This URL
 * opens the native General Availability page at the Provider-aware Working
 * Time section where that summary can be edited.
 *
 * @param int $resource_id Provider booking resource ID.
 *
 * @return string Provider availability URL, or an empty string when the
 *                current user cannot manage availability.
 */
function wpbc_appointment_services_get_provider_availability_url( $resource_id ) {
	$resource_id = absint( $resource_id );

	if ( ! $resource_id || ! wpbc_appointment_services_can_manage_availability() ) {
		return '';
	}

	$availability_url = function_exists( 'wpbc_get_general_availability_url' )
		? wpbc_get_general_availability_url()
		: admin_url( 'admin.php?page=wpbc-availability&tab=general_availability' );

	return esc_url_raw(
		add_query_arg(
			array(
				'resource_id' => $resource_id,
				'wpbc_ag_open' => 'working_time',
			),
			$availability_url
		)
	);
}

/**
 * Resolve the recurring weekday availability known for one Provider.
 *
 * General unavailable weekdays are authoritative. When Working Time is
 * enabled, weekdays without any effective interval are also unavailable.
 * Date-specific and seasonal exceptions remain in the native calendar engine
 * and are intentionally not guessed by this lightweight administration state.
 *
 * @param int                 $resource_id Provider booking resource ID.
 * @param array<string,mixed> $resource    Optional source resource values.
 *
 * @return array<string,bool> Availability keyed by mon through sun.
 */
function wpbc_appointment_services_get_provider_weekday_availability( $resource_id, $resource = array() ) {
	$weekdays = array(
		'mon' => 'On' !== get_bk_option( 'booking_unavailable_day1' ),
		'tue' => 'On' !== get_bk_option( 'booking_unavailable_day2' ),
		'wed' => 'On' !== get_bk_option( 'booking_unavailable_day3' ),
		'thu' => 'On' !== get_bk_option( 'booking_unavailable_day4' ),
		'fri' => 'On' !== get_bk_option( 'booking_unavailable_day5' ),
		'sat' => 'On' !== get_bk_option( 'booking_unavailable_day6' ),
		'sun' => 'On' !== get_bk_option( 'booking_unavailable_day0' ),
	);

	if ( function_exists( 'wpbc_working_time__get_effective_rule' ) ) {
		$working_time_rule = wpbc_working_time__get_effective_rule( absint( $resource_id ) );
		if ( is_array( $working_time_rule ) && isset( $working_time_rule['weekdays'] ) ) {
			$day_numbers = array(
				'mon' => 1,
				'tue' => 2,
				'wed' => 3,
				'thu' => 4,
				'fri' => 5,
				'sat' => 6,
				'sun' => 0,
			);
			foreach ( $day_numbers as $day_key => $day_number ) {
				$weekdays[ $day_key ] = $weekdays[ $day_key ] && ! empty( $working_time_rule['weekdays'][ $day_number ] );
			}
		}
	}

	return (array) apply_filters( 'wpbc_appointment_service_provider_weekday_availability', $weekdays, absint( $resource_id ), $resource );
}

/**
 * Determine whether a Provider has at least one recurring bookable weekday.
 *
 * @param int                 $resource_id Provider booking resource ID.
 * @param array<string,mixed> $resource    Optional source resource values.
 *
 * @return bool True when one or more weekdays are available.
 */
function wpbc_appointment_services_provider_has_weekly_availability( $resource_id, $resource = array() ) {
	return in_array( true, wpbc_appointment_services_get_provider_weekday_availability( $resource_id, $resource ), true );
}

/**
 * Resolve the public image configured for one Provider Booking Resource.
 *
 * Existing Business Large Searchable Resources values remain the fast path
 * because callers already load that option collection once for a Provider
 * list. When that legacy field is not configured, the resolver uses the
 * cross-edition Booking Resource content repository so Free's bundled default
 * image and pictures saved by the Resource catalog reach every Provider UI.
 * The guarded fallback keeps this presentation helper safe during partial
 * bootstrap and compatibility requests where the content repository has not
 * been loaded yet.
 *
 * @param int                            $provider_id   Provider Booking Resource ID.
 * @param array<int,array<string,mixed>> $search_options Searchable Resource options keyed by resource ID.
 *
 * @return string Sanitized Provider image URL or an empty string.
 */
function wpbc_appointment_services_get_provider_image_url( $provider_id, $search_options ) {
	$provider_id = absint( $provider_id );
	if ( ! $provider_id ) {
		return '';
	}

	if ( ! empty( $search_options[ $provider_id ]['picture'] ) ) {
		$image_value = $search_options[ $provider_id ]['picture'];
		if ( is_array( $image_value ) ) {
			$image_value = reset( $image_value );
		}
		if ( ! is_scalar( $image_value ) ) {
			return '';
		}

		return esc_url_raw( wpbc_lang( (string) $image_value ) );
	}

	if ( ! function_exists( 'wpbc_booking_resource_content_repository' ) ) {
		return '';
	}

	// Booking Calendar Free has exactly one implicit Booking Resource (ID 1).
	if ( ! class_exists( 'wpdev_bk_personal' ) && 1 !== $provider_id ) {
		return '';
	}

	$resource_content = wpbc_booking_resource_content_repository()->get( $provider_id );
	if ( empty( $resource_content['picture_url'] ) || ! is_scalar( $resource_content['picture_url'] ) ) {
		return '';
	}

	return esc_url_raw( wpbc_lang( (string) $resource_content['picture_url'] ) );
}

/**
 * Provider presentation data for the Services management table.
 *
 * Booking resources remain the availability authority. The default weekday
 * map combines General Availability with each resource's effective Working
 * Time rule. Cross-edition Booking Resource pictures are reused before a
 * WordPress user avatar, keeping the administration catalog consistent with
 * the public Appointment flow. Extensions may replace the presentation or
 * recurring-weekday summary through the filters below without changing the
 * Services page contract.
 *
 * @return array<int,array<string,mixed>>
 */
function wpbc_appointment_services_get_provider_directory() {
	$directory       = array();
	$options         = wpbc_appointment_services_get_provider_options();
	$resources       = apply_bk_filter( 'wpdebk_get_keyed_all_bk_resources', array() );
	$resources_by_id = array();
	$search_options  = function_exists( 'wpbc_searchable_resources__get_all_options' )
		? (array) wpbc_searchable_resources__get_all_options()
		: array();

	foreach ( (array) $resources as $resource_id => $resource ) {
		$resource = is_object( $resource ) ? get_object_vars( $resource ) : (array) $resource;
		$id       = ! empty( $resource['id'] ) ? absint( $resource['id'] ) : absint( $resource_id );
		if ( $id ) { $resources_by_id[ $id ] = $resource; }
	}

	foreach ( $options as $resource_id => $title ) {
		$resource            = isset( $resources_by_id[ $resource_id ] ) ? $resources_by_id[ $resource_id ] : array();
		$user_id             = ! empty( $resource['users'] ) ? absint( $resource['users'] ) : 0;
		$resource_image_url  = wpbc_appointment_services_get_provider_image_url( $resource_id, $search_options );
		$wp_user_avatar_url  = $user_id ? get_avatar_url( $user_id, array( 'size' => 64 ) ) : '';
		$words               = preg_split( '/\s+/u', trim( wp_strip_all_tags( $title ) ) );
		$initials            = '';
		foreach ( array_slice( array_filter( (array) $words ), 0, 2 ) as $word ) {
			$initials .= function_exists( 'mb_substr' ) ? mb_substr( $word, 0, 1 ) : substr( $word, 0, 1 );
		}
		$provider_weekdays = wpbc_appointment_services_get_provider_weekday_availability( $resource_id, $resource );
		$entry = array(
			'id'                      => absint( $resource_id ),
			'title'                   => $title,
			'initials'                => strtoupper( $initials ? $initials : 'P' ),
			'avatar_url'              => $resource_image_url ? $resource_image_url : $wp_user_avatar_url,
			'availability_url'        => wpbc_appointment_services_get_provider_availability_url( $resource_id ),
			'weekdays'                => $provider_weekdays,
			'has_weekly_availability' => in_array( true, $provider_weekdays, true ),
		);
		$directory[ $resource_id ] = apply_filters( 'wpbc_appointment_service_provider_presentation', $entry, absint( $resource_id ), $resource );
	}

	return $directory;
}

/**
 * Return published Booking Forms that can be assigned to a Service.
 *
 * @return array<int,string> Form titles keyed by form ID; zero means the default form.
 */
function wpbc_appointment_services_get_form_options() {
	$options = array( 0 => __( 'Default Booking Form', 'booking' ) );
	if ( class_exists( 'WPBC_FE_Custom_Form_Helper' ) ) {
		$forms = WPBC_FE_Custom_Form_Helper::get_custom_booking_forms_list(
			array( 'include_standard' => false, 'owner_user_id' => wpbc_appointment_services_get_owner_user_id(), 'statuses' => array( 'published' ) )
		);
		foreach ( $forms as $form ) {
			if ( ! empty( $form['id'] ) ) { $options[ absint( $form['id'] ) ] = ! empty( $form['title'] ) ? $form['title'] : $form['name']; }
		}
	}
	return apply_filters( 'wpbc_appointment_service_form_options', $options );
}

/**
 * Return the configured Appointment Services data provider.
 *
 * The native repository supplies list_items(), count_items(), find(), save(),
 * duplicate(), and archive(). Extensions may replace it through the provider
 * filter; count_items() enables efficient server-side catalog pagination.
 *
 * @return object|null
 */
function wpbc_appointment_services_get_data_provider() {
	return apply_filters( 'wpbc_appointment_services_data_provider', null );
}

/**
 * Determine whether the configured Service storage is ready for requests.
 *
 * @return bool True when a provider exists and reports usable storage.
 */
function wpbc_appointment_services_storage_is_ready() {
	$provider = wpbc_appointment_services_get_data_provider();
	if ( ! is_object( $provider ) || ! method_exists( $provider, 'list_items' ) ) { return false; }
	return method_exists( $provider, 'is_ready' ) ? (bool) $provider->is_ready() : true;
}

/**
 * Build the standard error returned when Service storage is unavailable.
 *
 * @return WP_Error Storage-not-ready error with administrator guidance.
 */
function wpbc_appointment_services_storage_error() {
	return new WP_Error( 'appointment_services_storage_unavailable', __( 'The Services database is not ready. Reload the page as an administrator or reactivate Booking Calendar to finish the database upgrade.', 'booking' ) );
}

/**
 * Sanitize and normalize a Service payload at the repository boundary.
 *
 * @param mixed $payload Raw Service values from AJAX or another provider.
 *
 * @return array<string,mixed> Safe values with defaults and bounded numeric fields.
 */
function wpbc_appointment_services_sanitize_payload( $payload ) {
	$payload = is_array( $payload ) ? $payload : array();
	$title   = isset( $payload['title'] ) ? sanitize_text_field( $payload['title'] ) : '';
	$title   = wp_html_excerpt( $title, 200, '' );
	$metadata = wpbc_appointment_services_decode_metadata( isset( $payload['metadata'] ) ? $payload['metadata'] : array() );
	$picture_url = array_key_exists( 'picture_url', $payload ) ? $payload['picture_url'] : ( isset( $metadata['picture_url'] ) ? $metadata['picture_url'] : '' );
	$picture_url = is_scalar( $picture_url ) ? esc_url_raw( trim( (string) $picture_url ) ) : '';
	return array(
		'service_id' => isset( $payload['service_id'] ) ? absint( $payload['service_id'] ) : 0,
		'title' => $title,
		'description' => isset( $payload['description'] ) ? sanitize_textarea_field( $payload['description'] ) : '',
		'picture_url' => $picture_url,
		'status' => isset( $payload['status'] ) && in_array( $payload['status'], array( 'active', 'inactive', 'archived' ), true ) ? $payload['status'] : 'active',
		'duration_minutes' => isset( $payload['duration_minutes'] ) ? min( 65535, max( 1, absint( $payload['duration_minutes'] ) ) ) : 30,
		'buffer_before_minutes' => isset( $payload['buffer_before_minutes'] ) ? min( 65535, absint( $payload['buffer_before_minutes'] ) ) : 0,
		'buffer_after_minutes' => isset( $payload['buffer_after_minutes'] ) ? min( 65535, absint( $payload['buffer_after_minutes'] ) ) : 0,
		'base_cost' => isset( $payload['base_cost'] ) && is_numeric( $payload['base_cost'] ) ? number_format( min( 9999999999.99, max( 0, (float) $payload['base_cost'] ) ), 2, '.', '' ) : '0.00',
		'booking_form_id' => isset( $payload['booking_form_id'] ) ? absint( $payload['booking_form_id'] ) : 0,
		'resource_ids' => isset( $payload['resource_ids'] ) ? array_values( array_filter( array_map( 'absint', (array) $payload['resource_ids'] ) ) ) : array(),
	);
}

/**
 * Apply nullable Provider-assignment overrides to one Service row.
 *
 * The returned `duration_minutes` and `base_cost` are effective values used by
 * the Appointment flow. Original Service values and the applied override are
 * retained separately so snapshots and extensions can explain their source.
 *
 * @param mixed $service Service row optionally containing assignment overrides.
 *
 * @return array<string,mixed> Service row with effective scheduling values.
 */
function wpbc_appointment_services_apply_assignment_overrides( $service ) {
	$service = is_object( $service ) ? get_object_vars( $service ) : (array) $service;

	$base_duration_minutes     = isset( $service['duration_minutes'] ) ? min( 65535, absint( $service['duration_minutes'] ) ) : 0;
	$has_duration_override     = array_key_exists( 'duration_override', $service ) && null !== $service['duration_override'] && absint( $service['duration_override'] ) > 0;
	$duration_override_minutes = $has_duration_override ? min( 65535, absint( $service['duration_override'] ) ) : 0;
	$base_service_cost         = isset( $service['base_cost'] ) && is_numeric( $service['base_cost'] ) ? min( 9999999999.99, max( 0, (float) $service['base_cost'] ) ) : 0.0;
	$has_cost_override         = array_key_exists( 'cost_override', $service ) && null !== $service['cost_override'] && is_numeric( $service['cost_override'] );
	$cost_override             = $has_cost_override ? min( 9999999999.99, max( 0, (float) $service['cost_override'] ) ) : null;

	$service['base_duration_minutes']     = $base_duration_minutes;
	$service['duration_override_minutes'] = $duration_override_minutes;
	$service['duration_minutes']          = $has_duration_override ? $duration_override_minutes : $base_duration_minutes;
	$service['base_service_cost']         = number_format( $base_service_cost, 2, '.', '' );
	$service['cost_override']             = null === $cost_override ? null : number_format( $cost_override, 2, '.', '' );
	$service['base_cost']                 = number_format( null === $cost_override ? $base_service_cost : $cost_override, 2, '.', '' );

	return (array) apply_filters( 'wpbc_appointment_service_effective_assignment', $service );
}

/**
 * Return a stable public title for a Provider resource.
 *
 * @param int $resource_id Booking resource acting as the Provider.
 *
 * @return string Localized plain-text Provider title.
 */
function wpbc_appointment_services_get_provider_title( $resource_id ) {
	$resource_id = absint( $resource_id );
	$title       = function_exists( 'wpbc_get_resource_title' ) ? wpbc_get_resource_title( $resource_id ) : '';
	if ( '' === trim( wp_strip_all_tags( (string) $title ) ) ) {
		$options = wpbc_appointment_services_get_provider_options();
		$title   = isset( $options[ $resource_id ] ) ? $options[ $resource_id ] : sprintf( __( 'Provider #%d', 'booking' ), $resource_id );
	}

	return sanitize_text_field( wp_strip_all_tags( wpbc_lang( (string) $title ) ) );
}

/**
 * Decode an Appointment Service metadata value into an associative array.
 *
	 * @param mixed $metadata JSON string or already-decoded metadata.
 *
	 * @return array<string,mixed> Decoded metadata, or an empty array for invalid input.
 */
function wpbc_appointment_services_decode_metadata( $metadata ) {
	if ( is_array( $metadata ) ) {
		return $metadata;
	}

	$decoded = json_decode( (string) $metadata, true );

	return is_array( $decoded ) ? $decoded : array();
}

/**
 * Decode Appointment snapshot metadata using the shared metadata parser.
 *
 * This compatibility wrapper preserves the existing snapshot helper while
 * allowing Service records and snapshots to share one defensive JSON parser.
 *
 * @param mixed $metadata JSON string or already-decoded metadata.
 *
 * @return array<string,mixed> Decoded metadata, or an empty array for invalid input.
 */
function wpbc_appointment_services_decode_snapshot_metadata( $metadata ) {
	return wpbc_appointment_services_decode_metadata( $metadata );
}

/**
 * Normalize a provider result into the stable Service response contract.
 *
 * @param mixed $service Service row returned by a data provider.
 *
 * @return array<string,mixed> Normalized Service item.
 */
function wpbc_appointment_services_normalize_item( $service ) {
	$service = is_object( $service ) ? get_object_vars( $service ) : (array) $service;
	return wp_parse_args( wpbc_appointment_services_sanitize_payload( $service ), array( 'service_id' => 0, 'title' => '' ) );
}

/**
 * Normalize Service status counts returned by a repository.
 *
 * @param mixed $raw_counts Repository count response.
 *
 * @return array<string,int> Counts keyed by all, active, inactive, and archived.
 */
function wpbc_appointment_services_normalize_status_counts( $raw_counts ) {
	$raw_counts = is_array( $raw_counts ) ? $raw_counts : array();
	$counts     = array(
		'all'      => 0,
		'active'   => isset( $raw_counts['active'] ) ? absint( $raw_counts['active'] ) : 0,
		'inactive' => isset( $raw_counts['inactive'] ) ? absint( $raw_counts['inactive'] ) : 0,
		'archived' => isset( $raw_counts['archived'] ) ? absint( $raw_counts['archived'] ) : 0,
	);
	$counts['all'] = $counts['active'] + $counts['inactive'] + $counts['archived'];

	return $counts;
}

/**
 * Authorize an Appointment Services AJAX request.
 *
 * @return void Terminates with JSON when the nonce or capability check fails.
 */
function wpbc_appointment_services_ajax_authorize() {
	if ( false === check_ajax_referer( 'wpbc_appointment_services_ajax_nonce', 'nonce', false ) ) {
		wp_send_json_error( array( 'message' => __( 'Security check failed.', 'booking' ) ), 403 );
	}
	if ( ! current_user_can( wpbc_appointment_services_get_manage_capability() ) ) {
		wp_send_json_error( array( 'message' => __( 'You do not have permission to manage services.', 'booking' ) ), 403 );
	}
}

/**
 * Send a consistent JSON error for a failed data-provider operation.
 *
 * @param mixed  $result   Provider result, optionally a WP_Error instance.
 * @param string $fallback Fallback message when no provider error is available.
 *
 * @return void Terminates with a JSON error response.
 */
function wpbc_appointment_services_send_provider_error( $result, $fallback ) {
	$message = is_wp_error( $result ) ? $result->get_error_message() : $fallback;
	wp_send_json_error( array( 'message' => $message ), 500 );
}
