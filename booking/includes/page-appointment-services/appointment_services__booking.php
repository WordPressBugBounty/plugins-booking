<?php
/** Appointment Service integration with the existing booking form and save pipeline. @package Booking Calendar */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Determine whether the resource-specific frontend Service adapter is enabled.
 *
 * This compatibility adapter is disabled by default. Extensions or a future
 * explicit setting may enable it through the existing filter. The dedicated
 * [booking_appointment] controller remains the primary public workflow.
 *
 * @return bool True when the Service selector integration may run.
 */
function wpbc_appointment_services_frontend_is_enabled() {
	$enabled = false;

	return (bool) apply_filters( 'wpbc_appointment_services_frontend_is_enabled', $enabled );
}

/**
 * Manage the request-local Service context used while rendering one Appointment form.
 *
 * The Appointment controller sets this context immediately before the native
 * booking form is rendered and clears it immediately afterwards. Keeping the
 * context server-side prevents a normal booking form from inventing a Service.
 *
 * @param string              $operation Context operation: get, set, or clear.
 * @param array<string,mixed> $service   Validated Service context for a set operation.
 *
 * @return array{service_id:int,resource_id:int,title:string}|array{} Current normalized context, or an empty array.
 */
function wpbc_appointment_services_form_hint_context( $operation = 'get', $service = array() ) {
	static $service_context = array();

	if ( 'clear' === $operation ) {
		$service_context = array();
	} elseif ( 'set' === $operation ) {
		$service_context = array(
			'service_id'  => absint( isset( $service['service_id'] ) ? $service['service_id'] : 0 ),
			'resource_id' => absint( isset( $service['resource_id'] ) ? $service['resource_id'] : 0 ),
			'title'       => sanitize_text_field( isset( $service['title'] ) ? $service['title'] : '' ),
		);
	}

	return $service_context;
}

/**
 * Replace the Service Hint shortcode in a rendered booking form.
 *
 * Appointment forms receive a visible title plus a form field so the value can
 * participate in the standard booking-data pipeline. All other forms receive
 * an empty string. Repeated hints display the same title but only the first one
 * emits the field that is submitted with the booking.
 *
 * @param string $form_html   Rendered booking form markup.
 * @param int    $resource_id Booking resource used by the form.
 * @param string $form_slug   Booking Form slug used by the renderer.
 *
 * @return string Form markup with Service Hint shortcodes replaced.
 */
function wpbc_appointment_services_replace_service_title_hint( $form_html, $resource_id, $form_slug ) {
	$shortcode = '[service_title_hint]';
	if ( false === strpos( $form_html, $shortcode ) ) {
		return $form_html;
	}

	$service_context = wpbc_appointment_services_form_hint_context();
	$resource_id     = absint( $resource_id );
	$service_title   = isset( $service_context['title'] ) ? sanitize_text_field( $service_context['title'] ) : '';
	if ( '' === $service_title || $resource_id !== absint( isset( $service_context['resource_id'] ) ? $service_context['resource_id'] : 0 ) ) {
		return str_replace( $shortcode, '', $form_html );
	}

	$hint_id    = 'service_title_hint_tip' . $resource_id;
	$input_name = 'service_title_hint' . $resource_id;
	$first_html = '<span class="wpbc_field_hint wpbc_appointment_service_hint" id="' . esc_attr( $hint_id ) . '">' . esc_html( $service_title ) . '</span>'
		. '<input class="wpbc_field_hint wpbc_appointment_service_hint" id="' . esc_attr( $input_name ) . '" name="' . esc_attr( $input_name ) . '" value="' . esc_attr( $service_title ) . '" style="display:none;" type="text" />';

	$form_html = preg_replace_callback(
		'/\[service_title_hint\]/',
		static function () use ( $first_html ) {
			return $first_html;
		},
		$form_html,
		1
	);

	$repeated_html = '<span class="wpbc_field_hint wpbc_appointment_service_hint service_title_hint_tip' . $resource_id . '">' . esc_html( $service_title ) . '</span>';

	return str_replace( $shortcode, $repeated_html, $form_html );
}
add_filter( 'wpbc_replace_shortcodes_in_booking_form', 'wpbc_appointment_services_replace_service_title_hint', 30, 3 );

/**
 * Synchronize Service Hint values with a repository-validated Appointment Service.
 *
 * Submitted Service Hint fields are deliberately removed first because browser
 * form values are untrusted. A value is restored only when the core booking
 * pipeline supplies the Service record that passed the signed Appointment
 * context and resource-assignment checks.
 *
 * @param array<string,mixed> $structured_booking_data Values-only booking data.
 * @param array<string,mixed> $all_booking_data        Complete parsed booking fields.
 * @param array<string,mixed> $appointment_service    Validated Appointment Service, or an empty array.
 * @param int                 $resource_id             Submitted booking resource ID.
 *
 * @return array{structured_booking_data:array<string,mixed>,all_booking_data:array<string,mixed>} Trusted booking data.
 */
function wpbc_appointment_services_sync_service_hint_booking_data( $structured_booking_data, $all_booking_data, $appointment_service, $resource_id ) {
	unset( $structured_booking_data['service_title_hint'], $all_booking_data['service_title_hint'] );

	$service_title = sanitize_text_field( isset( $appointment_service['title'] ) ? $appointment_service['title'] : '' );
	if ( '' === $service_title ) {
		return array(
			'structured_booking_data' => $structured_booking_data,
			'all_booking_data'        => $all_booking_data,
		);
	}

	$resource_id = absint( $resource_id );
	$structured_booking_data['service_title_hint'] = $service_title;
	$all_booking_data['service_title_hint']        = array(
		'type'          => 'text',
		'original_name' => 'service_title_hint' . $resource_id,
		'name'          => 'service_title_hint',
		'value'         => $service_title,
	);

	return array(
		'structured_booking_data' => $structured_booking_data,
		'all_booking_data'        => $all_booking_data,
	);
}

/**
 * Insert compatible Services before an existing resource-specific booking form.
 *
 * @param string $form_html     Existing booking form markup.
 * @param mixed  $form_settings Existing form settings supplied by the filter.
 * @param int    $resource_id   Booking resource acting as the Provider.
 * @param string $custom_form   Requested custom form name.
 *
 * @return string Filtered booking form markup.
 */
function wpbc_appointment_services_add_frontend_selector( $form_html, $form_settings, $resource_id, $custom_form ) {
	if ( ! wpbc_appointment_services_frontend_is_enabled() ) {
		return $form_html;
	}
	$repository = wpbc_appointment_services_repository();
	$services   = $repository->list_active_for_resource( $resource_id );
	if ( empty( $services ) ) {
		return $form_html;
	}
	$select_id = 'wpbc_appointment_service_' . absint( $resource_id );
	$html      = '<div class="wpbc_appointment_service_selector" data-resource-id="' . absint( $resource_id ) . '">';
	$html      .= '<label for="' . esc_attr( $select_id ) . '">' . esc_html__( 'Service', 'booking' ) . '</label>';
	$html      .= '<select id="' . esc_attr( $select_id ) . '" class="wpbc_appointment_service_select" required>';
	if ( count( $services ) > 1 ) {
		$html .= '<option value="">' . esc_html__( 'Select a Service', 'booking' ) . '</option>';
	}
	foreach ( $services as $service ) {
		$details = sprintf( _n( '%d minute', '%d minutes', absint( $service['duration_minutes'] ), 'booking' ), absint( $service['duration_minutes'] ) );
		$context_token = function_exists( 'wpbc_booking_appointment_encode_submission_context' )
			? wpbc_booking_appointment_encode_submission_context( array(), $service['service_id'], $resource_id )
			: '';
		$html .= '<option value="' . absint( $service['service_id'] ) . '" data-duration="' . absint( $service['duration_minutes'] ) . '" data-appointment-context-token="' . esc_attr( $context_token ) . '">' . esc_html( $service['title'] . ' — ' . $details ) . '</option>';
	}
	$html .= '</select><p class="wpbc_appointment_service_summary" aria-live="polite"></p></div>';

	return $html . $form_html;
}

add_filter( 'wpbc_booking_form__html__before_wrapper', 'wpbc_appointment_services_add_frontend_selector', 20, 4 );

/**
 * Enqueue the resource-specific Service selector booking adapter.
 *
 * @param string $where_to_load Booking Calendar asset context.
 *
 * @return void
 */
function wpbc_appointment_services_enqueue_frontend_js( $where_to_load ) {
	if ( ! in_array( $where_to_load, array(
			'client',
			'both',
		), true ) || ! wpbc_appointment_services_frontend_is_enabled() ) {
		return;
	}
	$base = trailingslashit( plugins_url( '', __FILE__ ) );
	wp_enqueue_script( 'wpbc-appointment-services-client', $base . '_out/appointment_services_client.js', array(
		'jquery',
		'wpbc_capacity',
	), WP_BK_VERSION_NUM, array( 'in_footer' => WPBC_JS_IN_FOOTER ) );
}

add_action( 'wpbc_enqueue_js_files', 'wpbc_appointment_services_enqueue_frontend_js', 70 );

/**
 * Enqueue Service selector styling for public forms and admin previews.
 *
 * @param string $where_to_load Booking Calendar asset context.
 *
 * @return void
 */
function wpbc_appointment_services_enqueue_frontend_css( $where_to_load ) {
	$is_admin_preview = 'admin' === $where_to_load && function_exists( 'wpbc_is_admin_page_with_frontend_booking_preview' ) && wpbc_is_admin_page_with_frontend_booking_preview();
	if (
		( ! in_array( $where_to_load, array(
				'client',
				'both',
			), true ) && ! $is_admin_preview ) || ! wpbc_appointment_services_frontend_is_enabled() ) {
		return;
	}
	wp_enqueue_style( 'wpbc-appointment-services-client', trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/appointment_services_client.css', array( 'wpbc-all-client' ), WP_BK_VERSION_NUM );
}

add_action( 'wpbc_enqueue_css_files', 'wpbc_appointment_services_enqueue_frontend_css', 70 );

/**
 * Persist an immutable Service snapshot after the core booking save succeeds.
 *
 * @param int    $booking_id            Saved booking ID.
 * @param array  $create_params         Normalized booking creation parameters.
 * @param string $where_to_save_booking Booking save context supplied by core.
 *
 * @return void
 */
function wpbc_appointment_services_after_booking_save( $booking_id, $create_params, $where_to_save_booking ) {
	if ( empty( $create_params['appointment_service'] ) || empty( $create_params['resource_id'] ) ) {
		return;
	}
	$saved = wpbc_appointment_services_repository()->save_appointment_snapshot( $booking_id, $create_params['resource_id'], $create_params['appointment_service'] );
	if ( ! $saved ) {
		do_action( 'wpbc_appointment_snapshot_save_failed', absint( $booking_id ), $create_params, $where_to_save_booking );
	}
}

add_action( 'wpbc_booking_after_save', 'wpbc_appointment_services_after_booking_save', 10, 3 );

/**
 * Remove Appointment snapshots when their core bookings are permanently deleted.
 *
 * @param int|int[]|string $booking_ids Booking ID, array, or comma-separated IDs.
 *
 * @return void
 */
function wpbc_appointment_services_delete_booking_snapshots( $booking_ids ) {
	global $wpdb;
	if ( ! wpbc_appointment_services_tables_exist() ) {
		return;
	}
	$ids = is_array( $booking_ids ) ? $booking_ids : explode( ',', (string) $booking_ids );
	$ids = array_values( array_filter( array_map( 'absint', $ids ) ) );
	if ( empty( $ids ) ) {
		return;
	}
	$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
	$sql          = 'DELETE FROM ' . wpbc_appointment_services_table_name( 'appointment_details' ) . ' WHERE booking_id IN (' . $placeholders . ')';
	$wpdb->query( $wpdb->prepare( $sql, $ids ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
}

add_action( 'wpbc_booking_action__delete', 'wpbc_appointment_services_delete_booking_snapshots', 10, 1 );
add_action( 'wpbc_booking_delete', 'wpbc_appointment_services_delete_booking_snapshots', 10, 1 );

/**
 * Remove Service assignments when booking resources are permanently deleted.
 *
 * @param int|int[]|string $resource_ids Resource ID, array, or comma-separated IDs.
 *
 * @return void
 */
function wpbc_appointment_services_delete_resource_assignments( $resource_ids ) {
	global $wpdb;
	if ( ! wpbc_appointment_services_tables_exist() ) {
		return;
	}
	$ids = is_array( $resource_ids ) ? $resource_ids : explode( ',', (string) $resource_ids );
	$ids = array_values( array_filter( array_map( 'absint', $ids ) ) );
	if ( empty( $ids ) ) {
		return;
	}
	$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
	$sql          = 'DELETE FROM ' . wpbc_appointment_services_table_name( 'service_resources' ) . ' WHERE resource_id IN (' . $placeholders . ')';
	$wpdb->query( $wpdb->prepare( $sql, $ids ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
}

add_action( 'wpbc_deleted_booking_resources', 'wpbc_appointment_services_delete_resource_assignments', 10, 1 );

/**
 * Return one immutable Appointment snapshot with request-local caching.
 *
 * @param int $booking_id Core booking ID.
 *
 * @return array<string,mixed>|false Snapshot row or false.
 */
function wpbc_appointment_services_get_cached_snapshot( $booking_id ) {
	static $snapshots = array();

	$booking_id = absint( $booking_id );
	if ( ! array_key_exists( $booking_id, $snapshots ) ) {
		$snapshots[ $booking_id ] = wpbc_appointment_services_repository()->get_appointment_snapshot( $booking_id );
	}

	return $snapshots[ $booking_id ];
}

/**
 * Extract an exact Appointment interval from a core booking record.
 *
 * Listing records store date strings while Timeline records contain date
 * objects. Both retain core's boundary seconds, which are normalized here.
 *
 * @param mixed $booking Core listing or Timeline booking record.
 *
 * @return array{0:int,1:int}|false Exact start/end timestamps or false.
 */
function wpbc_appointment_services_get_booking_exact_interval( $booking ) {
	if ( ! is_object( $booking ) || empty( $booking->dates ) ) {
		return false;
	}

	$dates = array();
	foreach ( (array) $booking->dates as $date_value ) {
		if ( is_object( $date_value ) && isset( $date_value->booking_date ) ) {
			$date_value = $date_value->booking_date;
		} elseif ( is_array( $date_value ) && isset( $date_value['booking_date'] ) ) {
			$date_value = $date_value['booking_date'];
		}
		if ( is_string( $date_value ) && preg_match( '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $date_value ) ) {
			$dates[] = $date_value;
		}
	}
	if ( empty( $dates ) ) {
		return false;
	}

	sort( $dates );
	return wpbc_appointment_services_normalize_stored_interval( reset( $dates ), end( $dates ) );
}

/**
 * Format an exact interval for compact administrator-facing details.
 *
 * @param int $start_timestamp Exact start timestamp.
 * @param int $end_timestamp   Exact end timestamp.
 *
 * @return string Localized interval label.
 */
function wpbc_appointment_services_format_interval( $start_timestamp, $end_timestamp ) {
	$date_format = get_bk_option( 'booking_date_format' );
	$time_format = get_bk_option( 'booking_time_format' );
	$date_format = $date_format ? $date_format : 'm / d / Y, D';
	$time_format = $time_format ? $time_format : 'h:i a';
	$same_day    = wpbc_datetime__no_wp_timezone( 'Y-m-d', $start_timestamp ) === wpbc_datetime__no_wp_timezone( 'Y-m-d', $end_timestamp );
	$start       = wpbc_datetime__no_wp_timezone( $same_day ? $time_format : $date_format . ' ' . $time_format, $start_timestamp );
	$end         = wpbc_datetime__no_wp_timezone( $same_day ? $time_format : $date_format . ' ' . $time_format, $end_timestamp );

	return $start . ' - ' . $end;
}

/**
 * Build administrator-facing time and buffer values from immutable data.
 *
 * @param array<string,mixed> $snapshot Immutable Appointment snapshot.
 * @param mixed               $booking  Core booking record.
 *
 * @return array<string,mixed> Exact and formatted Appointment intervals.
 */
function wpbc_appointment_services_get_admin_time_details( $snapshot, $booking ) {
	$interval = wpbc_appointment_services_get_booking_exact_interval( $booking );
	if ( false === $interval ) {
		return array();
	}

	$buffer_before = absint( $snapshot['buffer_before_minutes'] );
	$buffer_after  = absint( $snapshot['buffer_after_minutes'] );
	$reserved_start = $interval[0] - ( $buffer_before * MINUTE_IN_SECONDS );
	$reserved_end   = $interval[1] + ( $buffer_after * MINUTE_IN_SECONDS );

	return array(
		'appointment_start_timestamp'       => $interval[0],
		'appointment_end_timestamp'         => $interval[1],
		'appointment_reserved_start'        => $reserved_start,
		'appointment_reserved_end'          => $reserved_end,
		'appointment_time_label'             => wpbc_appointment_services_format_interval( $interval[0], $interval[1] ),
		'appointment_reserved_time_label'    => wpbc_appointment_services_format_interval( $reserved_start, $reserved_end ),
	);
}

/**
 * Add Service identity to the existing AJAX booking-listing record.
 *
 * @param array<string,mixed> $fields     Parsed listing fields.
 * @param int                 $booking_id Booking ID.
 * @param mixed               $booking    Original booking record.
 *
 * @return array<string,mixed> Filtered listing fields.
 */
function wpbc_appointment_services_add_listing_fields( $fields, $booking_id, $booking ) {
	if ( ! function_exists( 'wpbc_is_11_5_features_enabled' ) || ! wpbc_is_11_5_features_enabled() ) {
		return $fields;
	}

	$snapshot = wpbc_appointment_services_get_cached_snapshot( $booking_id );
	if ( $snapshot ) {
		$pricing_available = wpbc_appointment_services_is_pricing_available();
		$metadata                                      = wpbc_appointment_services_decode_snapshot_metadata( $snapshot['metadata'] );
		$fields['appointment_service_id']       = absint( $snapshot['service_id'] );
		$fields['appointment_service_title']    = sanitize_text_field( $snapshot['service_title'] );
		$fields['appointment_duration_minutes'] = absint( $snapshot['duration_minutes'] );
		$fields['appointment_provider_id']       = absint( $snapshot['resource_id'] );
		$fields['appointment_provider_title']    = ! empty( $metadata['provider_title'] )
			? sanitize_text_field( $metadata['provider_title'] )
			: wpbc_appointment_services_get_provider_title( $snapshot['resource_id'] );
		$fields['appointment_buffer_before_minutes'] = absint( $snapshot['buffer_before_minutes'] );
		$fields['appointment_buffer_after_minutes']  = absint( $snapshot['buffer_after_minutes'] );
		$fields['appointment_service_cost']          = $pricing_available ? number_format( (float) $snapshot['base_cost'], 2, '.', '' ) : '';
		$fields['appointment_service_cost_formatted'] = function_exists( 'wpbc_booking_appointment_format_service_cost_text' )
			? wpbc_booking_appointment_format_service_cost_text( $snapshot['base_cost'], $snapshot['resource_id'] )
			: '';
		$fields = array_merge( $fields, wpbc_appointment_services_get_admin_time_details( $snapshot, $booking ) );
	}

	return $fields;
}

add_filter( 'wpbc_booking_listing_parsed_fields', 'wpbc_appointment_services_add_listing_fields', 10, 3 );

/**
 * Determine whether Appointment-specific Booking Listing controls are active.
 *
 * Appointment data remains available in every presentation mode, but its
 * Service filter belongs only to the Appointment administration workflow.
 *
 * @return bool True when 11.5 features and Appointment mode are active.
 */
function wpbc_appointment_services_is_appointment_listing_mode() {
	return function_exists( 'wpbc_is_11_5_features_enabled' )
		&& wpbc_is_11_5_features_enabled()
		&& function_exists( 'wpbc_booking_modes_get_selected_mode_id' )
		&& 'appointment' === wpbc_booking_modes_get_selected_mode_id();
}

/**
 * Register the Service filter in the shared Booking Listing request contract.
 *
 * @param array<string,array<string,mixed>> $request_schema Existing request schema.
 * @param string                            $structure_type Requested schema representation.
 *
 * @return array<string,array<string,mixed>> Extended request schema.
 */
function wpbc_appointment_services_add_listing_request_rule( $request_schema, $structure_type ) {
	$request_schema['wh_appointment_service'] = array(
		'validate' => 'digit_or_csd',
		'default'  => array(),
	);

	return $request_schema;
}
add_filter( 'wpbc_booking_listing_request_params_schema', 'wpbc_appointment_services_add_listing_request_rule', 10, 2 );

/**
 * Normalize scalar, array, or comma-separated Service filter values.
 *
 * The request sanitizer supports both scalar and array `digit_or_csd` values.
 * This helper flattens those compatible representations into unique positive
 * Service IDs and can restrict them to an authorized Service catalogue.
 *
 * @param mixed                 $raw_service_ids     Sanitized scalar or array value.
 * @param array<int,mixed>|null $allowed_service_ids Optional owner-visible Service IDs. Pass null to skip authorization filtering.
 *
 * @return array<int,int> Unique positive Service IDs.
 */
function wpbc_appointment_services_normalize_listing_service_ids( $raw_service_ids, $allowed_service_ids = null ) {
	$raw_values  = is_array( $raw_service_ids ) ? $raw_service_ids : array( $raw_service_ids );
	$service_ids = array();

	foreach ( $raw_values as $raw_value ) {
		$separated_values = is_scalar( $raw_value ) ? explode( ',', (string) $raw_value ) : array();
		foreach ( $separated_values as $separated_value ) {
			$service_id = absint( $separated_value );
			if ( $service_id ) {
				$service_ids[ $service_id ] = $service_id;
			}
		}
	}

	$service_ids = array_values( $service_ids );
	if ( null !== $allowed_service_ids ) {
		$allowed_service_ids = array_values( array_unique( array_filter( array_map( 'absint', $allowed_service_ids ) ) ) );
		$service_ids         = array_values( array_intersect( $service_ids, $allowed_service_ids ) );
	}

	return $service_ids;
}

/**
 * Return owner-visible Services available to the Appointment listing filter.
 *
 * All statuses are intentionally included because historical Appointments must
 * remain filterable after their Service is deactivated or archived.
 *
 * @return array<int,array<string,mixed>> Owner-visible Service rows.
 */
function wpbc_appointment_services_get_listing_services() {
	$repository = wpbc_appointment_services_get_data_provider();
	$services   = is_object( $repository ) && method_exists( $repository, 'list_items' )
		? $repository->list_items( array( 'status' => 'all' ) )
		: array();

	return is_wp_error( $services ) || ! is_array( $services ) ? array() : $services;
}

/**
 * Restrict the shared Booking Listing to one or more snapshotted Appointment Services.
 *
 * The existing Booking Resource query remains authoritative for Provider and
 * MultiUser ownership filtering. This additional EXISTS clause only narrows
 * those already-authorized bookings by their immutable Appointment snapshot.
 *
 * @param array{where:string,args:array<int,mixed>} $query_parts    Existing SQL WHERE and arguments.
 * @param array<string,mixed>                      $request_params Sanitized request values.
 * @param array<string,mixed>                      $params         Values merged with defaults.
 *
 * @return array{where:string,args:array<int,mixed>} Filtered query parts.
 */
function wpbc_appointment_services_filter_listing_query( $query_parts, $request_params, $params ) {
	if ( ! wpbc_appointment_services_is_appointment_listing_mode() || ! wpbc_appointment_services_tables_exist() ) {
		return $query_parts;
	}

	$listing_services    = wpbc_appointment_services_get_listing_services();
	$allowed_service_ids = wp_list_pluck( $listing_services, 'service_id' );
	$service_ids         = wpbc_appointment_services_normalize_listing_service_ids(
		isset( $params['wh_appointment_service'] ) ? $params['wh_appointment_service'] : array(),
		$allowed_service_ids
	);
	if ( empty( $service_ids ) || ! isset( $query_parts['where'], $query_parts['args'] ) ) {
		return $query_parts;
	}

	$service_placeholders  = implode( ', ', array_fill( 0, count( $service_ids ), '%d' ) );
	$query_parts['where'] .= ' AND EXISTS ( SELECT 1 FROM ' . wpbc_appointment_services_table_name( 'appointment_details' ) . ' appointment_filter WHERE appointment_filter.booking_id = bk.booking_id AND appointment_filter.service_id IN ( ' . $service_placeholders . ' ) )';
	$query_parts['args']   = array_merge( $query_parts['args'], $service_ids );

	return $query_parts;
}
add_filter( 'wpbc_booking_listing_sql_query_parts', 'wpbc_appointment_services_filter_listing_query', 10, 3 );

/**
 * Render the owner-aware Service selector beside the existing Provider filter.
 *
 * @param array<string,mixed> $request_params Sanitized current filter values.
 * @param array<string,mixed> $defaults       Default filter values.
 *
 * @return void
 */
function wpbc_appointment_services_render_listing_filter( $request_params, $defaults ) {
	if ( ! wpbc_appointment_services_is_appointment_listing_mode() || ! wpbc_appointment_services_storage_is_ready() ) {
		return;
	}

	$services            = wpbc_appointment_services_get_listing_services();
	$service_options     = array();
	$allowed_service_ids = array();
	foreach ( $services as $service ) {
		$service_id     = absint( isset( $service['service_id'] ) ? $service['service_id'] : 0 );
		$service_title  = isset( $service['title'] ) ? sanitize_text_field( $service['title'] ) : '';
		$service_status = isset( $service['status'] ) ? sanitize_key( $service['status'] ) : 'active';
		if ( ! $service_id || '' === $service_title ) {
			continue;
		}
		if ( 'active' !== $service_status ) {
			$status_label  = 'archived' === $service_status ? __( 'Archived', 'booking' ) : __( 'Inactive', 'booking' );
			$service_title = sprintf( '%1$s (%2$s)', $service_title, $status_label );
		}
		$allowed_service_ids[] = $service_id;
		$service_options[ $service_id ] = array(
			'title' => $service_title,
			'attr'  => array( 'title' => $service_title ),
		);
	}

	$selected_services = isset( $request_params['wh_appointment_service'] )
		? $request_params['wh_appointment_service']
		: ( isset( $defaults['wh_appointment_service'] ) ? $defaults['wh_appointment_service'] : array() );
	$selected_services = wpbc_appointment_services_normalize_listing_service_ids( $selected_services, $allowed_service_ids );

	wpbc_ui_chosen_filter_enqueue_assets();
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Shared component escapes its complete output.
	echo wpbc_ui_chosen_filter_get_html(
		array(
			'id'                    => 'wh_appointment_service',
			'name'                  => 'wh_appointment_service',
			'options'               => $service_options,
			'selected_values'       => $selected_services,
			'multiple'              => true,
			'placeholder'           => empty( $service_options ) ? __( 'No Services', 'booking' ) : __( 'All Services', 'booking' ),
			'clear_label'           => __( 'Clear Service selection', 'booking' ),
			'disabled'              => empty( $service_options ),
			'container_class'       => 'wpbc_booking_listing__service_filter',
			'attributes'            => array( 'aria-label' => __( 'Filter Appointments by Service', 'booking' ) ),
			'listing_param'         => 'wh_appointment_service',
			'listing_value_type'    => 'integer_array',
			'empty_request_value'   => array(),
			'clear_selected_values' => array(),
		)
	);
}
add_action( 'wpbc_booking_listing_toolbar_after_resources', 'wpbc_appointment_services_render_listing_filter', 10, 2 );

/**
 * Add immutable Appointment timing to a Timeline pipeline tooltip.
 *
 * @param string              $title      Existing plain-text tooltip.
 * @param int                 $booking_id Core booking ID.
 * @param array<int,mixed>    $bookings   Timeline booking collection.
 *
 * @return string Filtered tooltip.
 */
function wpbc_appointment_services_filter_timeline_pipeline_title( $title, $booking_id, $bookings ) {
	if ( ! function_exists( 'wpbc_is_11_5_features_enabled' ) || ! wpbc_is_11_5_features_enabled() ) {
		return $title;
	}

	$snapshot = wpbc_appointment_services_get_cached_snapshot( $booking_id );
	$booking  = isset( $bookings[ $booking_id ] ) ? $bookings[ $booking_id ] : null;
	$details  = $snapshot ? wpbc_appointment_services_get_admin_time_details( $snapshot, $booking ) : array();
	if ( empty( $details ) ) {
		return $title;
	}

	$title .= "\n" . sprintf( __( 'Service: %s', 'booking' ), sanitize_text_field( $snapshot['service_title'] ) );
	$service_cost = function_exists( 'wpbc_booking_appointment_format_service_cost' ) ? wpbc_booking_appointment_format_service_cost( $snapshot['base_cost'], $snapshot['resource_id'] ) : '';
	if ( '' !== $service_cost ) {
		$title .= "\n" . sprintf( __( 'Service price: %s', 'booking' ), wp_strip_all_tags( $service_cost ) );
	}
	$title .= "\n" . sprintf( __( 'Appointment: %s', 'booking' ), $details['appointment_time_label'] );
	$title .= "\n" . sprintf(
		__( 'Provider reserved: %1$s (buffers %2$d / %3$d min)', 'booking' ),
		$details['appointment_reserved_time_label'],
		absint( $snapshot['buffer_before_minutes'] ),
		absint( $snapshot['buffer_after_minutes'] )
	);

	return $title;
}
add_filter( 'wpbc_timeline_booking_pipeline_title', 'wpbc_appointment_services_filter_timeline_pipeline_title', 10, 3 );

/**
 * Add Appointment timing to the administrator Timeline popover.
 *
 * @param array<string,string> $popover    Existing popover title and content.
 * @param int                  $booking_id Core booking ID.
 * @param array<int,mixed>     $bookings   Timeline booking collection.
 * @param bool                 $is_frontend Whether Timeline is public.
 *
 * @return array<string,string> Filtered popover.
 */
function wpbc_appointment_services_filter_timeline_popover( $popover, $booking_id, $bookings, $is_frontend ) {
	if ( $is_frontend || ! function_exists( 'wpbc_is_11_5_features_enabled' ) || ! wpbc_is_11_5_features_enabled() ) {
		return $popover;
	}

	$snapshot = wpbc_appointment_services_get_cached_snapshot( $booking_id );
	$booking  = isset( $bookings[ $booking_id ] ) ? $bookings[ $booking_id ] : null;
	$details  = $snapshot ? wpbc_appointment_services_get_admin_time_details( $snapshot, $booking ) : array();
	if ( empty( $details ) ) {
		return $popover;
	}

	$metadata       = wpbc_appointment_services_decode_snapshot_metadata( $snapshot['metadata'] );
	$provider_title = ! empty( $metadata['provider_title'] )
		? sanitize_text_field( $metadata['provider_title'] )
		: wpbc_appointment_services_get_provider_title( $snapshot['resource_id'] );
	$service_cost = function_exists( 'wpbc_booking_appointment_format_service_cost' ) ? wpbc_booking_appointment_format_service_cost( $snapshot['base_cost'], $snapshot['resource_id'] ) : '';
	$popover['content'] .= '<div class="wpbc_timeline_appointment_details">'
		. '<strong>' . esc_html__( 'Appointment', 'booking' ) . '</strong><br>'
		. esc_html__( 'Service', 'booking' ) . ': ' . esc_html( $snapshot['service_title'] ) . '<br>'
		. esc_html__( 'Provider', 'booking' ) . ': ' . esc_html( $provider_title ) . '<br>'
		. ( '' !== $service_cost ? esc_html__( 'Service price', 'booking' ) . ': ' . wp_kses_post( $service_cost ) . '<br>' : '' )
		. esc_html__( 'Appointment time', 'booking' ) . ': ' . esc_html( $details['appointment_time_label'] ) . '<br>'
		. esc_html__( 'Buffer before / after', 'booking' ) . ': ' . absint( $snapshot['buffer_before_minutes'] ) . ' / ' . absint( $snapshot['buffer_after_minutes'] ) . ' ' . esc_html__( 'min', 'booking' ) . '<br>'
		. esc_html__( 'Provider reserved', 'booking' ) . ': ' . esc_html( $details['appointment_reserved_time_label'] )
		. '</div>';

	return $popover;
}
add_filter( 'wpbc_timeline_booking_popover', 'wpbc_appointment_services_filter_timeline_popover', 10, 4 );

/**
 * Add immutable Appointment values to email and confirmation replacements.
 *
 * Available shortcodes are `[service_title]`, `[service_title_hint]`, `[service_duration]`,
 * `[service_duration_minutes]`, `[provider_title]`, and
 * `[appointment_summary]`. Non-Appointment bookings retain their existing
 * replacement collection unchanged.
 *
 * @param array<string,mixed> $replace    Existing replacement values.
 * @param int                 $booking_id Core booking ID.
 * @param int                 $bktype     Booking resource ID.
 * @param string              $formdata   Stored booking form data.
 *
 * @return array<string,mixed> Replacement values with Appointment context.
 */
function wpbc_appointment_services_add_replace_params( $replace, $booking_id, $bktype, $formdata ) {
	$replace['service_title_hint'] = '';
	$snapshot = wpbc_appointment_services_repository()->get_appointment_snapshot( $booking_id );
	if ( ! $snapshot ) {
		return $replace;
	}

	$metadata       = wpbc_appointment_services_decode_snapshot_metadata( $snapshot['metadata'] );
	$service_title  = sanitize_text_field( $snapshot['service_title'] );
	$provider_title = ! empty( $metadata['provider_title'] )
		? sanitize_text_field( $metadata['provider_title'] )
		: wpbc_appointment_services_get_provider_title( $snapshot['resource_id'] );
	$duration       = function_exists( 'wpbc_booking_appointment_format_duration' )
		? wpbc_booking_appointment_format_duration( $snapshot['duration_minutes'] )
		: sprintf( _n( '%d minute', '%d minutes', absint( $snapshot['duration_minutes'] ), 'booking' ), absint( $snapshot['duration_minutes'] ) );
	$pricing_available   = wpbc_appointment_services_is_pricing_available();
	$service_cost_digits = $pricing_available ? number_format( (float) $snapshot['base_cost'], 2, '.', '' ) : '';
	$service_cost        = $pricing_available && function_exists( 'wpbc_booking_appointment_format_service_cost' )
		? wpbc_booking_appointment_format_service_cost( $snapshot['base_cost'], $snapshot['resource_id'] )
		: '';

	$replace['service_title']            = $service_title;
	$replace['service_title_hint']       = $service_title;
	$replace['service_duration']         = $duration;
	$replace['service_duration_minutes'] = absint( $snapshot['duration_minutes'] );
	$replace['service_cost']             = $service_cost;
	$replace['service_cost_digits_only'] = $service_cost_digits;
	$replace['provider_title']           = $provider_title;
	$summary_parts = array( $service_title, $provider_title, $duration );
	if ( '' !== $service_cost ) {
		$summary_parts[] = function_exists( 'wpbc_booking_appointment_format_service_cost_text' )
			? wpbc_booking_appointment_format_service_cost_text( $snapshot['base_cost'], $snapshot['resource_id'] )
			: $service_cost_digits;
	}
	$replace['appointment_summary'] = implode( ' · ', $summary_parts );

	return $replace;
}

add_filter( 'wpbc_replace_params_for_booking', 'wpbc_appointment_services_add_replace_params', 20, 4 );

/**
 * Document Appointment replacement shortcodes in the existing email help UI.
 *
 * @param array<int,string> $fields          Existing email help rows.
 * @param array<int,string> $skip_shortcodes Shortcodes hidden by the email type.
 * @param string            $email_example   Existing example text.
 *
 * @return array<int,string> Help rows including Appointment replacements.
 */
function wpbc_appointment_services_add_email_help_shortcodes( $fields, $skip_shortcodes, $email_example ) {
	$fields[] = '<hr/>';
	$fields[] = '<strong>' . esc_html__( 'Appointment details', 'booking' ) . '</strong>';
	$fields[] = '<code>[service_title_hint]</code> - ' . esc_html__( 'Service Hint value saved with the Appointment; empty for other bookings.', 'booking' );
	$fields[] = '<code>[service_title]</code> — ' . esc_html__( 'Service title saved with the Appointment.', 'booking' );
	$fields[] = '<code>[service_duration]</code> — ' . esc_html__( 'Formatted Service duration.', 'booking' );
	$fields[] = '<code>[service_duration_minutes]</code> — ' . esc_html__( 'Service duration in minutes.', 'booking' );
	if ( wpbc_appointment_services_is_pricing_available() ) {
		$fields[] = '<code>[service_cost]</code> — ' . esc_html__( 'Effective Service price with currency.', 'booking' );
		$fields[] = '<code>[service_cost_digits_only]</code> — ' . esc_html__( 'Effective Service price without currency.', 'booking' );
	}
	$fields[] = '<code>[provider_title]</code> — ' . esc_html__( 'Provider title saved with the Appointment.', 'booking' );
	$fields[] = '<code>[appointment_summary]</code> — ' . esc_html__( 'Service, Provider, and duration in one line.', 'booking' );

	return $fields;
}

add_filter( 'wpbc_email_help_shortcodes', 'wpbc_appointment_services_add_email_help_shortcodes', 20, 3 );

/**
 * Document Appointment values in the Payment Description help panel.
 *
 * @param array<int,string> $fields Existing payment-description help rows.
 *
 * @return array<int,string> Help rows including Appointment replacements.
 */
function wpbc_appointment_services_add_payment_help_shortcodes( $fields ) {
	$fields[] = '<hr/><strong>' . esc_html__( 'Appointment details', 'booking' ) . '</strong>';
	$service_cost_shortcode = wpbc_appointment_services_is_pricing_available() ? ', <code>[service_cost]</code>' : '';
	$fields[] = '<code>[service_title]</code>, <code>[service_title_hint]</code>, <code>[service_duration]</code>' . $service_cost_shortcode . ', <code>[provider_title]</code>, <code>[appointment_summary]</code>';

	return $fields;
}
add_filter( 'wpbc_payment_help_shortcodes', 'wpbc_appointment_services_add_payment_help_shortcodes', 20, 1 );

/**
 * Return the snapshotted Service ID for a booking.
 *
 * @param int $booking_id Booking ID.
 *
 * @return int Service ID, or zero for a non-Appointment booking.
 */
function wpbc_appointment_services_get_booking_service_id( $booking_id ) {
	$snapshot = wpbc_appointment_services_repository()->get_appointment_snapshot( $booking_id );

	return $snapshot ? absint( $snapshot['service_id'] ) : 0;
}

/**
 * Prevent moving an Appointment to a Provider who cannot perform its Service.
 *
 * Non-Appointment bookings preserve the incoming validation result. Appointment
 * bookings return WP_Error when the target resource lacks an active assignment.
 * Core may deliberately bypass this filter through its force-change setting.
 *
 * @param true|WP_Error $valid       Validation result from earlier callbacks.
 * @param int           $booking_id  Booking being moved.
 * @param int           $resource_id Target Provider resource ID.
 *
 * @return true|WP_Error Incoming result or a Service/Provider mismatch error.
 */
function wpbc_appointment_services_validate_resource_change( $valid, $booking_id, $resource_id ) {
	$service_id = wpbc_appointment_services_get_booking_service_id( $booking_id );
	if ( ! $service_id ) {
		return $valid;
	}
	$service = wpbc_appointment_services_repository()->find_active_for_resource( $service_id, $resource_id );

	return is_wp_error( $service ) ? $service : $valid;
}

add_filter( 'wpbc_booking_validate_resource_change', 'wpbc_appointment_services_validate_resource_change', 10, 3 );

/**
 * Keep the Appointment snapshot aligned after a successful resource move.
 *
 * @param int $booking_id  Moved booking ID.
 * @param int $resource_id New Provider resource ID.
 *
 * @return void
 */
function wpbc_appointment_services_after_resource_change( $booking_id, $resource_id ) {
	if ( wpbc_appointment_services_get_booking_service_id( $booking_id ) ) {
		wpbc_appointment_services_repository()->update_snapshot_resource( $booking_id, $resource_id );
	}
}

add_action( 'wpbc_booking_action__change_booking_resource', 'wpbc_appointment_services_after_resource_change', 10, 2 );

/**
 * Resolve the server-authoritative end time for an Appointment Service.
 *
 * @param array<string,mixed> $service                  Effective Service values.
 * @param int                 $start_seconds            Selected start time as seconds in the day.
 * @param int                 $maximum_duration_minutes Maximum allowed duration in minutes.
 *
 * @return int|WP_Error End time as seconds in the day, or a validation error.
 */
function wpbc_appointment_services_resolve_end_seconds( $service, $start_seconds, $maximum_duration_minutes = 1440 ) {
	$duration_minutes         = ! empty( $service['duration_minutes'] ) ? absint( $service['duration_minutes'] ) : 0;
	$maximum_duration_minutes = absint( $maximum_duration_minutes );
	if ( ! $duration_minutes || ( $maximum_duration_minutes && $duration_minutes > $maximum_duration_minutes ) ) {
		return new WP_Error( 'appointment_service_duration_invalid', __( 'The selected Service duration is invalid. Please contact the website administrator.', 'booking' ) );
	}

	$end_seconds = absint( $start_seconds ) + ( $duration_minutes * MINUTE_IN_SECONDS );
	if ( $end_seconds > DAY_IN_SECONDS ) {
		return new WP_Error( 'appointment_service_duration_invalid', __( 'The selected Service does not fit in the chosen day. Please select an earlier start time.', 'booking' ) );
	}

	return $end_seconds;
}

/**
 * Convert Booking Calendar's stored boundary markers to exact interval times.
 *
 * Core stores timed starts with `+1` second and ends with `+2` seconds. An end
 * at midnight is represented as `23:59:52`. Buffer comparison must remove
 * those internal markers or adjacent zero-buffer Appointments look overlapped.
 *
 * @param string $starts_at Stored SQL start datetime.
 * @param string $ends_at   Stored SQL end datetime.
 *
 * @return array{0:int,1:int} Exact start and end timestamps.
 */
function wpbc_appointment_services_normalize_stored_interval( $starts_at, $ends_at ) {
	$start_timestamp = wpbc_convert__sql_date__to_seconds( $starts_at, false );
	$end_timestamp   = wpbc_convert__sql_date__to_seconds( $ends_at, false );
	$start_time      = substr( (string) $starts_at, -8 );
	$end_time        = substr( (string) $ends_at, -8 );

	if ( '01' === substr( $start_time, -2 ) ) {
		$start_timestamp--;
	}
	if ( '02' === substr( $end_time, -2 ) ) {
		$end_timestamp -= 2;
	} elseif ( '23:59:52' === $end_time ) {
		$end_timestamp += 8;
	}

	return array( $start_timestamp, $end_timestamp );
}

/**
 * Determine whether two half-open scheduling intervals overlap.
 *
 * @param int $left_start  First interval start timestamp.
 * @param int $left_end    First interval end timestamp.
 * @param int $right_start Second interval start timestamp.
 * @param int $right_end   Second interval end timestamp.
 *
 * @return bool True only when the intervals overlap; touching boundaries pass.
 */
function wpbc_appointment_services_intervals_overlap( $left_start, $left_end, $right_start, $right_end ) {
	return (int) $left_start < (int) $right_end && (int) $left_end > (int) $right_start;
}

/**
 * Check one exact Appointment interval against buffered existing intervals.
 *
 * Existing rows must contain exact Unix timestamps in `start` and `end` plus
 * optional `buffer_before_minutes` and `buffer_after_minutes` values. Keeping
 * this calculation independent from SQL lets the save path, AJAX preflight,
 * and browser test panel exercise the same boundary rules.
 *
 * @param int                         $new_start               Exact new start timestamp.
 * @param int                         $new_end                 Exact new end timestamp.
 * @param int                         $new_buffer_before       New Service buffer before in minutes.
 * @param int                         $new_buffer_after        New Service buffer after in minutes.
 * @param array<int,array<string,int>> $existing_intervals     Exact existing intervals and buffers.
 *
 * @return bool True when any buffered interval overlaps.
 */
function wpbc_appointment_services_has_buffer_conflict( $new_start, $new_end, $new_buffer_before, $new_buffer_after, $existing_intervals ) {
	$new_start = (int) $new_start - ( absint( $new_buffer_before ) * MINUTE_IN_SECONDS );
	$new_end   = (int) $new_end + ( absint( $new_buffer_after ) * MINUTE_IN_SECONDS );
	if ( $new_end <= $new_start ) {
		return false;
	}

	foreach ( (array) $existing_intervals as $existing_interval ) {
		$old_start = isset( $existing_interval['start'] ) ? (int) $existing_interval['start'] : 0;
		$old_end   = isset( $existing_interval['end'] ) ? (int) $existing_interval['end'] : 0;
		if ( ! $old_start || $old_end <= $old_start ) {
			continue;
		}
		$old_start -= ( isset( $existing_interval['buffer_before_minutes'] ) ? absint( $existing_interval['buffer_before_minutes'] ) : 0 ) * MINUTE_IN_SECONDS;
		$old_end   += ( isset( $existing_interval['buffer_after_minutes'] ) ? absint( $existing_interval['buffer_after_minutes'] ) : 0 ) * MINUTE_IN_SECONDS;
		if ( wpbc_appointment_services_intervals_overlap( $new_start, $new_end, $old_start, $old_end ) ) {
			return true;
		}
	}

	return false;
}

/**
 * Load exact buffered intervals for one Provider in one bounded date range.
 *
 * One query is intentionally shared by the selected-time preflight, the bulk
 * Start Time filter, and final save validation. Appointment snapshots preserve
 * the buffers that applied when an existing booking was created. The 46-day
 * SQL margin covers the complete unsigned SMALLINT minute range used by the
 * existing Service schema, including legacy values larger than one day.
 *
 * @param int      $resource_id     Provider resource ID.
 * @param string[] $dates           Selected SQL dates.
 * @param int      $skip_booking_id Optional booking excluded during an update.
 *
 * @return array<int,array<string,int>> Existing exact intervals and buffers.
 */
function wpbc_appointment_services_get_existing_buffer_intervals( $resource_id, $dates, $skip_booking_id = 0 ) {
	global $wpdb;

	$date_values = array_values( array_filter( array_map( 'sanitize_text_field', (array) $dates ) ) );
	if ( ! absint( $resource_id ) || empty( $date_values ) ) {
		return array();
	}

	$range_start = min( $date_values );
	$range_end   = max( $date_values );
	$sql         = "SELECT b.booking_id, DATE(bd.booking_date) AS appointment_date, MIN(bd.booking_date) AS starts_at, MAX(bd.booking_date) AS ends_at,
		COALESCE(ad.buffer_before_minutes,0) AS buffer_before_minutes,
		COALESCE(ad.buffer_after_minutes,0) AS buffer_after_minutes
		FROM {$wpdb->prefix}booking b
		INNER JOIN {$wpdb->prefix}bookingdates bd ON bd.booking_id = b.booking_id
		LEFT JOIN " . wpbc_appointment_services_table_name( 'appointment_details' ) . " ad ON ad.booking_id = b.booking_id
		WHERE b.booking_type = %d AND b.booking_id <> %d AND b.trash = 0
		AND DATE(bd.booking_date) BETWEEN DATE_SUB(%s, INTERVAL 46 DAY) AND DATE_ADD(%s, INTERVAL 46 DAY)
		GROUP BY b.booking_id, DATE(bd.booking_date)";
	$existing    = $wpdb->get_results( $wpdb->prepare( $sql, absint( $resource_id ), absint( $skip_booking_id ), $range_start, $range_end ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
	$intervals   = array();

	foreach ( (array) $existing as $booking ) {
		list( $old_start, $old_end ) = wpbc_appointment_services_normalize_stored_interval( $booking['starts_at'], $booking['ends_at'] );
		$intervals[] = array(
			'booking_id'            => absint( $booking['booking_id'] ),
			'start'                 => $old_start,
			'end'                   => $old_end,
			'buffer_before_minutes' => absint( $booking['buffer_before_minutes'] ),
			'buffer_after_minutes'  => absint( $booking['buffer_after_minutes'] ),
		);
	}

	return $intervals;
}

/**
 * Check Service buffers against an already loaded interval collection.
 *
 * @param array                    $service            Effective Service definition.
 * @param string[]                 $dates              Selected SQL dates.
 * @param int[]                    $time_seconds       Exact start and end seconds in the day.
 * @param array<int,array<string,int>> $existing_intervals Existing Provider intervals.
 *
 * @return true|WP_Error True when the requested interval is available.
 */
function wpbc_appointment_services_check_buffer_conflicts_in_intervals( $service, $dates, $time_seconds, $existing_intervals ) {
	if ( empty( $service ) || count( $time_seconds ) < 2 || empty( $dates ) ) {
		return true;
	}

	$new_before = isset( $service['buffer_before_minutes'] ) ? absint( $service['buffer_before_minutes'] ) : 0;
	$new_after  = isset( $service['buffer_after_minutes'] ) ? absint( $service['buffer_after_minutes'] ) : 0;
	foreach ( (array) $dates as $date_value ) {
		$date_value = sanitize_text_field( $date_value );
		$new_start  = wpbc_convert__sql_date__to_seconds( $date_value . ' ' . wpbc_transform__seconds__in__24_hours_his( $time_seconds[0] ), false );
		$new_end    = wpbc_convert__sql_date__to_seconds( $date_value . ' ' . wpbc_transform__seconds__in__24_hours_his( $time_seconds[1] ), false );
		if ( wpbc_appointment_services_has_buffer_conflict( $new_start, $new_end, $new_before, $new_after, $existing_intervals ) ) {
			return new WP_Error( 'appointment_service_buffer_conflict', __( 'This start time is unavailable because the Service duration or required buffer overlaps another appointment. Please choose another time.', 'booking' ) );
		}
	}

	return true;
}

/**
 * Check Service buffers against existing bookings after the core availability
 * engine has selected the actual Provider resource.
 *
 * @param array $service         Selected Service definition.
 * @param int   $resource_id     Provider resource ID.
 * @param array $dates           Selected booking dates.
 * @param array $time_seconds    Start and end time expressed as day seconds.
 * @param int   $skip_booking_id Optional booking excluded during an update.
 *
 * @return true|WP_Error True when buffers do not overlap, otherwise a conflict error.
 */
function wpbc_appointment_services_check_buffer_conflicts( $service, $resource_id, $dates, $time_seconds, $skip_booking_id = 0 ) {
	if ( empty( $service ) || count( $time_seconds ) < 2 || empty( $dates ) ) {
		return true;
	}
	$date_values = array_values( array_filter( array_map( 'sanitize_text_field', (array) $dates ) ) );
	if ( empty( $date_values ) ) {
		return true;
	}
	$existing_intervals = wpbc_appointment_services_get_existing_buffer_intervals( $resource_id, $date_values, $skip_booking_id );

	return wpbc_appointment_services_check_buffer_conflicts_in_intervals( $service, $date_values, $time_seconds, $existing_intervals );
}
