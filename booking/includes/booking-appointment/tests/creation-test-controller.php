<?php
/**
 * Opt-in WordPress HTTP booking-creation tests for Appointment Flow.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return whether destructive Appointment creation tests were explicitly enabled.
 *
 * The separate constant prevents the read-only diagnostics panel from ever
 * enabling booking creation implicitly.
 *
 * @return bool True only for the strict boolean opt-in value.
 */
function wpbc_appointment_creation_tests_are_enabled() {
	return defined( 'WPBC_ENABLE_APPOINTMENT_CREATION_TESTS' )
		&& true === WPBC_ENABLE_APPOINTMENT_CREATION_TESTS
		&& function_exists( 'wpbc_is_11_5_features_enabled' )
		&& wpbc_is_11_5_features_enabled();
}

/**
 * Authorize one Appointment creation-test AJAX request.
 *
 * @return void
 */
function wpbc_appointment_creation_tests_authorize_ajax() {
	if ( ! wpbc_appointment_creation_tests_are_enabled() ) {
		wp_send_json_error( array( 'message' => __( 'Appointment booking-creation tests are disabled.', 'booking' ) ), 403 );
	}
	if ( ! current_user_can( 'activate_plugins' ) ) {
		wp_send_json_error( array( 'message' => __( 'You are not allowed to run Appointment booking-creation tests.', 'booking' ) ), 403 );
	}
	check_ajax_referer( 'wpbc_appointment_creation_tests', 'nonce' );
}

/**
 * Return pending fixtures owned by the current WordPress administrator.
 *
 * @return array<string,array<string,mixed>> Pending fixtures keyed by token.
 */
function wpbc_appointment_creation_tests_get_fixtures() {
	$fixtures = get_user_meta( get_current_user_id(), '_wpbc_appointment_creation_test_fixtures', true );
	return is_array( $fixtures ) ? $fixtures : array();
}

/**
 * Persist pending fixtures for the current WordPress administrator.
 *
 * @param array<string,array<string,mixed>> $fixtures Pending fixtures keyed by token.
 *
 * @return void
 */
function wpbc_appointment_creation_tests_save_fixtures( $fixtures ) {
	if ( empty( $fixtures ) ) {
		delete_user_meta( get_current_user_id(), '_wpbc_appointment_creation_test_fixtures' );
		return;
	}
	update_user_meta( get_current_user_id(), '_wpbc_appointment_creation_test_fixtures', $fixtures );
}

/**
 * Validate a future fixture date and strict 24-hour Start Time.
 *
 * @param string $date       ISO date supplied by the administrator.
 * @param string $start_time Strict 24-hour Start Time.
 *
 * @return true|WP_Error True when both values are safe for a controlled fixture.
 */
function wpbc_appointment_creation_tests_validate_schedule( $date, $start_time ) {
	$date_object = DateTime::createFromFormat( '!Y-m-d', $date, wp_timezone() );
	$date_errors = DateTime::getLastErrors();
	if ( ! $date_object || ( is_array( $date_errors ) && ( $date_errors['warning_count'] || $date_errors['error_count'] ) ) || $date_object->format( 'Y-m-d' ) !== $date ) {
		return new WP_Error( 'invalid_fixture_date', __( 'Select a valid future test date.', 'booking' ) );
	}

	$today       = new DateTime( 'today', wp_timezone() );
	$latest_date = clone $today;
	$latest_date->modify( '+2 years' );
	if ( $date_object <= $today || $date_object > $latest_date ) {
		return new WP_Error( 'unsafe_fixture_date', __( 'The test date must be within the next two years.', 'booking' ) );
	}
	if ( ! preg_match( '/^(?:[01]\d|2[0-3]):[0-5]\d$/', $start_time ) ) {
		return new WP_Error( 'invalid_fixture_time', __( 'Enter the Start Time in 24-hour HH:MM format.', 'booking' ) );
	}
	return true;
}

/**
 * Build minimal normal Booking Calendar form data for an HTTP fixture.
 *
 * The Service remains authoritative for duration and end time. The marker is
 * stored in Details so cleanup can prove ownership before deleting anything.
 *
 * @param int    $provider_id Provider booking-resource ID.
 * @param string $start_time  Strict 24-hour Start Time.
 * @param string $marker      Unique fixture ownership marker.
 *
 * @return string Encoded Booking Calendar form data.
 */
function wpbc_appointment_creation_tests_build_form_data( $provider_id, $start_time, $marker ) {
	$provider_id = absint( $provider_id );
	return implode(
		'~',
		array(
			'selectbox-one^starttime' . $provider_id . '^' . $start_time,
			'text^name' . $provider_id . '^WPBC Appointment Test',
			'text^secondname' . $provider_id . '^Fixture',
			'email^email' . $provider_id . '^wpbc-appointment-test@example.invalid',
			'textarea^details' . $provider_id . '^' . $marker,
		)
	);
}

/**
 * Prepare one one-time fixture for submission to the real booking endpoint.
 *
 * @return void
 */
function wpbc_appointment_creation_tests_ajax_prepare() {
	wpbc_appointment_creation_tests_authorize_ajax();

	if ( empty( $_POST['confirmed'] ) || '1' !== sanitize_text_field( wp_unslash( $_POST['confirmed'] ) ) ) {
		wp_send_json_error( array( 'message' => __( 'Confirm the controlled booking creation and cleanup before continuing.', 'booking' ) ), 400 );
	}

	$service_id  = isset( $_POST['service_id'] ) ? absint( $_POST['service_id'] ) : 0;
	$provider_id = isset( $_POST['provider_id'] ) ? absint( $_POST['provider_id'] ) : 0;
	$date        = isset( $_POST['date'] ) ? sanitize_text_field( wp_unslash( $_POST['date'] ) ) : '';
	$start_time  = isset( $_POST['start_time'] ) ? sanitize_text_field( wp_unslash( $_POST['start_time'] ) ) : '';
	$schedule    = wpbc_appointment_creation_tests_validate_schedule( $date, $start_time );
	if ( is_wp_error( $schedule ) ) {
		wp_send_json_error( array( 'message' => $schedule->get_error_message() ), 400 );
	}

	$service = wpbc_appointment_services_repository()->find_active_for_resource( $service_id, $provider_id );
	if ( is_wp_error( $service ) ) {
		wp_send_json_error( array( 'message' => $service->get_error_message() ), 400 );
	}

	$service   = wpbc_appointment_services_apply_assignment_overrides( $service );
	$form_slug = wpbc_booking_appointment_resolve_form_slug( $service, $provider_id, array( 'form_type' => '' ) );
	$token     = wp_generate_uuid4();
	$marker    = '[WPBC-APPOINTMENT-TEST-' . $token . ']';
	$fixtures  = wpbc_appointment_creation_tests_get_fixtures();
	if ( count( $fixtures ) >= 20 ) {
		wp_send_json_error( array( 'message' => __( 'Clean pending Appointment test fixtures before preparing another booking.', 'booking' ) ), 409 );
	}
	$fixtures[ $token ] = array(
		'marker'      => $marker,
		'service_id'  => $service_id,
		'provider_id' => $provider_id,
		'date'        => $date,
		'start_time'  => $start_time,
		'created_at'  => time(),
	);
	wpbc_appointment_creation_tests_save_fixtures( $fixtures );

	$date_object = DateTime::createFromFormat( '!Y-m-d', $date, wp_timezone() );
	wp_send_json_success(
		array(
			'token'          => $token,
			'marker'         => $marker,
			'duration'       => absint( $service['duration_minutes'] ),
			'create_request' => array(
				'resource_id'                 => $provider_id,
				'dates_ddmmyy_csv'            => $date_object->format( 'd.m.Y' ),
				'formdata'                    => wpbc_appointment_creation_tests_build_form_data( $provider_id, $start_time, $marker ),
				'booking_hash'                => wp_generate_password( 32, false, false ),
				'custom_form'                 => $form_slug,
				'is_emails_send'              => 0,
				'active_locale'               => determine_locale(),
				'form_status'                 => 'published',
				'allow_past'                  => 0,
				'service_id'                  => $service_id,
				'appointment_service_required'=> 1,
				'appointment_context_token'   => wpbc_booking_appointment_encode_submission_context( array(), $service_id, $provider_id ),
			),
		)
	);
}
/**
 * Register the authenticated fixture-preparation AJAX action.
 *
 * @see wpbc_appointment_creation_tests_ajax_prepare()
 */
add_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_TEST_PREPARE', 'wpbc_appointment_creation_tests_ajax_prepare' );

/**
 * Find bookings that contain the exact unique marker for one fixture.
 *
 * @param array<string,mixed> $fixture Stored fixture definition.
 *
 * @return array<int,object> Matching core booking rows.
 */
function wpbc_appointment_creation_tests_find_bookings( $fixture ) {
	global $wpdb;
	$like = '%' . $wpdb->esc_like( $fixture['marker'] ) . '%';
	return $wpdb->get_results(
		$wpdb->prepare(
			"SELECT booking_id, booking_type, form, creation_date FROM {$wpdb->prefix}booking WHERE booking_type = %d AND form LIKE %s",
			absint( $fixture['provider_id'] ),
			$like
		)
	); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
}

/**
 * Verify and remove exact fixture bookings without sending deletion emails.
 *
 * @param string                 $token      Fixture token owned by the current administrator.
 * @param array<string,mixed>    $fixture    Stored fixture definition.
 * @param int                    $booking_id Optional ID returned by the real create endpoint.
 *
 * @return array<string,mixed> Verification and cleanup result.
 */
function wpbc_appointment_creation_tests_cleanup_fixture( $token, $fixture, $booking_id = 0 ) {
	global $wpdb;
	$rows = wpbc_appointment_creation_tests_find_bookings( $fixture );
	if ( $booking_id ) {
		$rows = array_values(
			array_filter(
				$rows,
				static function ( $booking_row ) use ( $booking_id ) {
					return absint( $booking_row->booking_id ) === absint( $booking_id );
				}
			)
		);
	}

	$result = array(
		'token'             => $token,
		'booking_found'     => ! empty( $rows ),
		'snapshot_valid'    => false,
		'duration_valid'    => false,
		'deleted'           => false,
		'deleted_ids'       => array(),
		'remaining_records' => 0,
	);
	foreach ( $rows as $booking_row ) {
		$current_booking_id = absint( $booking_row->booking_id );
		$snapshot           = wpbc_appointment_services_repository()->get_appointment_snapshot( $current_booking_id );
		$dates              = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT booking_date FROM {$wpdb->prefix}bookingdates WHERE booking_id = %d ORDER BY booking_date ASC",
				$current_booking_id
			)
		); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$snapshot_valid = is_array( $snapshot )
			&& absint( $snapshot['service_id'] ) === absint( $fixture['service_id'] )
			&& absint( $snapshot['resource_id'] ) === absint( $fixture['provider_id'] );
		$duration_valid = false;
		if ( $snapshot_valid && ! empty( $dates ) ) {
			$interval       = wpbc_appointment_services_normalize_stored_interval( reset( $dates ), end( $dates ) );
			$duration_valid = is_array( $interval )
				&& 2 === count( $interval )
				&& ( absint( $snapshot['duration_minutes'] ) * MINUTE_IN_SECONDS ) === ( $interval[1] - $interval[0] );
		}
		$result['snapshot_valid'] = $result['snapshot_valid'] || $snapshot_valid;
		$result['duration_valid'] = $result['duration_valid'] || $duration_valid;

		do_action( 'wpbc_booking_action__delete', (string) $current_booking_id );
		$wpdb->delete( $wpdb->prefix . 'bookingdates', array( 'booking_id' => $current_booking_id ), array( '%d' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->delete( $wpdb->prefix . 'booking', array( 'booking_id' => $current_booking_id ), array( '%d' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$result['deleted_ids'][] = $current_booking_id;
	}

	$remaining_rows              = wpbc_appointment_creation_tests_find_bookings( $fixture );
	$result['remaining_records'] = count( $remaining_rows );
	$result['deleted']           = ! empty( $rows ) && empty( $remaining_rows );
	if ( function_exists( 'wpbc_booking_cache__new_bookings__reset' ) ) {
		wpbc_booking_cache__new_bookings__reset();
	}
	return $result;
}

/**
 * Clean one or every pending fixture through an authenticated WordPress request.
 *
 * @return void
 */
function wpbc_appointment_creation_tests_ajax_cleanup() {
	wpbc_appointment_creation_tests_authorize_ajax();
	$token      = isset( $_POST['token'] ) ? sanitize_text_field( wp_unslash( $_POST['token'] ) ) : '';
	$booking_id = isset( $_POST['booking_id'] ) ? absint( $_POST['booking_id'] ) : 0;
	$fixtures   = wpbc_appointment_creation_tests_get_fixtures();
	if ( $token && ! isset( $fixtures[ $token ] ) ) {
		wp_send_json_error( array( 'message' => __( 'The booking-creation fixture is missing or belongs to another administrator.', 'booking' ) ), 404 );
	}

	$tokens  = $token ? array( $token ) : array_keys( $fixtures );
	$results = array();
	foreach ( $tokens as $fixture_token ) {
		$cleanup_result = wpbc_appointment_creation_tests_cleanup_fixture( $fixture_token, $fixtures[ $fixture_token ], $token === $fixture_token ? $booking_id : 0 );
		$results[]      = $cleanup_result;
		if ( 0 === absint( $cleanup_result['remaining_records'] ) ) {
			unset( $fixtures[ $fixture_token ] );
		}
	}
	wpbc_appointment_creation_tests_save_fixtures( $fixtures );
	wp_send_json_success( array( 'fixtures' => $results ) );
}
/**
 * Register the authenticated marker-owned cleanup AJAX action.
 *
 * @see wpbc_appointment_creation_tests_ajax_cleanup()
 */
add_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_TEST_CLEANUP', 'wpbc_appointment_creation_tests_ajax_cleanup' );
