<?php
/**
 * Appointment mode QuickStart operation.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reuse or create the bundled Appointment-ready Booking Form.
 *
 * Only the one required owner-scoped form is created. Existing forms,
 * including the Standard form, are never modified or replaced.
 *
 * @return int|WP_Error Published Booking Form ID, or a setup error.
 */
function wpbc_booking_modes_quickstart_ensure_appointment_form() {

	if (
		! class_exists( 'WPBC_BFB_Form_Storage' )
		|| ! function_exists( 'wpbc_get_bfb_template_record_by_key' )
		|| ( function_exists( 'wpbc_is_table_exists' ) && ! wpbc_is_table_exists( 'booking_form_structures' ) )
	) {
		return new WP_Error( 'wpbc_booking_modes_quickstart_form_storage_missing', __( 'The Booking Form storage is not ready.', 'booking' ) );
	}

	$form_slug     = 'time_appointments_booking';
	$owner_user_id = function_exists( 'wpbc_appointment_services_get_owner_user_id' ) ? absint( wpbc_appointment_services_get_owner_user_id() ) : 0;

	if ( $owner_user_id && 'On' !== get_bk_option( 'booking_is_custom_forms_for_regular_users' ) ) {
		return new WP_Error( 'wpbc_booking_modes_quickstart_owner_forms_disabled', __( 'Enable custom Booking Forms for regular users, or add Start Time to the owner Standard form, before running Appointment QuickStart.', 'booking' ) );
	}

	$existing_form = WPBC_BFB_Form_Storage::get_current_form_by_key( $form_slug, $owner_user_id, 'published' );

	if ( ! empty( $existing_form->booking_form_id ) ) {
		return absint( $existing_form->booking_form_id );
	}

	$template_record = wpbc_get_bfb_template_record_by_key( 'appointments_services_flow' );

	if ( empty( $template_record ) || ! is_array( $template_record ) ) {
		return new WP_Error( 'wpbc_booking_modes_quickstart_form_template_missing', __( 'The bundled Appointment Booking Form template is not available.', 'booking' ) );
	}

	$template_record['form_slug']           = $form_slug;
	$template_record['status']              = 'published';
	$template_record['scope']               = $owner_user_id ? 'user' : 'global';
	$template_record['owner_user_id']       = $owner_user_id;
	$template_record['booking_resource_id'] = null;
	$template_record['is_default']          = 0;
	$template_record['title']               = __( 'Time Appointments Booking Form', 'booking' );
	$template_record['picture_url']         = isset( $template_record['picture_url'] ) ? (string) $template_record['picture_url'] : '';

	if ( function_exists( 'wpbc_bfb_resolve_picture_url' ) ) {
		$template_record['picture_url'] = wpbc_bfb_resolve_picture_url( $template_record['picture_url'] );
	}

	$booking_form_id = WPBC_BFB_Form_Storage::save_form( $template_record );

	return $booking_form_id
		? absint( $booking_form_id )
		: new WP_Error( 'wpbc_booking_modes_quickstart_form_not_created', __( 'The Appointment Booking Form could not be created.', 'booking' ) );
}

/**
 * Find a repeat-safe starter Service for the active owner.
 *
 * A QuickStart-marked Service is preferred. An existing active Service is
 * reused only when it already has a Provider and a start-time-capable form;
 * otherwise a dedicated starter is created without changing customer data.
 *
 * @param int $booking_form_id Optional Appointment-ready Booking Form ID. Zero
 *                             performs a read-only reusable-Service pass first.
 * @param int $default_provider_id Fallback existing Provider resource ID.
 *
 * @return array<string,mixed>|WP_Error Service row, or a repository error.
 */
function wpbc_booking_modes_quickstart_ensure_appointment_service( $booking_form_id, $default_provider_id ) {

	if (
		! function_exists( 'wpbc_appointment_services_repository' )
		|| ! function_exists( 'wpbc_appointment_services_get_starter_service_values' )
	) {
		return new WP_Error( 'wpbc_booking_modes_quickstart_service_api_missing', __( 'The Appointment Services API is not available.', 'booking' ) );
	}

	$repository    = wpbc_appointment_services_repository();
	$service_rows  = array();
	$owner_user_id = function_exists( 'wpbc_appointment_services_get_owner_user_id' ) ? absint( wpbc_appointment_services_get_owner_user_id() ) : 0;

	foreach ( array( 'active', 'inactive', 'archived' ) as $service_status ) {
		$status_rows = $repository->list_items(
			array(
				'status'     => $service_status,
				'sort_by'    => 'service_id',
				'sort_order' => 'asc',
				'limit'      => 500,
			)
		);

		if ( is_wp_error( $status_rows ) ) {
			return $status_rows;
		}

		$service_rows = array_merge( $service_rows, $status_rows );
	}

	$marked_service = array();

	foreach ( $service_rows as $service_row ) {
		if ( absint( $service_row['owner_user_id'] ) !== $owner_user_id ) {
			continue;
		}

		$metadata = function_exists( 'wpbc_appointment_services_decode_metadata' )
			? wpbc_appointment_services_decode_metadata( $service_row['metadata'] )
			: json_decode( (string) $service_row['metadata'], true );

		if ( is_array( $metadata ) && 'appointment_starter' === ( isset( $metadata['quickstart_key'] ) ? $metadata['quickstart_key'] : '' ) ) {
			$marked_service = $service_row;
			break;
		}
	}

	if ( ! empty( $marked_service ) ) {
		if ( 'active' !== $marked_service['status'] ) {
			return new WP_Error( 'wpbc_booking_modes_quickstart_service_not_active', __( 'A previous QuickStart Service exists but is not active. Activate or remove that Service before trying again.', 'booking' ) );
		}

		$service_needs_repair = false;
		if ( empty( $marked_service['resource_ids'] ) ) {
			$marked_service['resource_ids'] = array( absint( $default_provider_id ) );
			$service_needs_repair            = true;
		}

		$marked_provider_id = absint( reset( $marked_service['resource_ids'] ) );
		$marked_form_slug   = function_exists( 'wpbc_booking_appointment_resolve_form_slug' )
			? wpbc_booking_appointment_resolve_form_slug( $marked_service, $marked_provider_id, array() )
			: '';
		$marked_form_is_suitable = '' !== $marked_form_slug
			&& function_exists( 'wpbc_booking_appointment_form_has_start_time' )
			&& wpbc_booking_appointment_form_has_start_time( $marked_form_slug, $marked_provider_id );

		if ( $marked_form_is_suitable && ! $booking_form_id ) {
			return $service_needs_repair ? $repository->save( $marked_service ) : $marked_service;
		}

		if ( ! $booking_form_id ) {
			return new WP_Error( 'wpbc_booking_modes_quickstart_appointment_form_required', __( 'An Appointment-ready Booking Form is required for the starter Service.', 'booking' ) );
		}

		if ( absint( $marked_service['booking_form_id'] ) !== absint( $booking_form_id ) ) {
			$marked_service['booking_form_id'] = absint( $booking_form_id );
			$service_needs_repair              = true;
		}
		if ( $service_needs_repair ) {
			$marked_service = $repository->save( $marked_service );
		}

		return $marked_service;
	}

	foreach ( $service_rows as $service_row ) {
		if (
			'active' !== $service_row['status']
			|| absint( $service_row['owner_user_id'] ) !== $owner_user_id
			|| empty( $service_row['resource_ids'] )
		) {
			continue;
		}

		$provider_id = absint( reset( $service_row['resource_ids'] ) );
		$form_slug   = function_exists( 'wpbc_booking_appointment_resolve_form_slug' )
			? wpbc_booking_appointment_resolve_form_slug( $service_row, $provider_id, array() )
			: '';

		if (
			'' !== $form_slug
			&& function_exists( 'wpbc_booking_appointment_form_has_start_time' )
			&& wpbc_booking_appointment_form_has_start_time( $form_slug, $provider_id )
		) {
			return $service_row;
		}
	}

	if ( ! $booking_form_id ) {
		return new WP_Error( 'wpbc_booking_modes_quickstart_appointment_form_required', __( 'An Appointment-ready Booking Form is required for the starter Service.', 'booking' ) );
	}

	$starter_service                    = wpbc_appointment_services_get_starter_service_values( $default_provider_id );
	$starter_service['booking_form_id'] = absint( $booking_form_id );

	return $repository->save( $starter_service );
}

/**
 * Run Appointment QuickStart without modifying existing resources or settings.
 *
 * The operation provisions the minimum missing Service, assignment, suitable
 * form, and public page. Existing availability remains authoritative and is
 * exposed through Working Hours and Days Off follow-up URLs.
 *
 * @return array<string,mixed>|WP_Error QuickStart result, or an error.
 */
function wpbc_booking_modes_run_appointment_quickstart() {

	$state               = wpbc_booking_modes_get_quickstart_state( 'appointment' );
	$default_provider_id = wpbc_booking_modes_quickstart_get_first_resource_id();

	if ( is_wp_error( $default_provider_id ) ) {
		return $default_provider_id;
	}

	$service = wpbc_booking_modes_quickstart_ensure_appointment_service( 0, $default_provider_id );

	if ( is_wp_error( $service ) && 'wpbc_booking_modes_quickstart_appointment_form_required' === $service->get_error_code() ) {
		$booking_form_id = wpbc_booking_modes_quickstart_ensure_appointment_form();

		if ( is_wp_error( $booking_form_id ) ) {
			return $booking_form_id;
		}

		$service = wpbc_booking_modes_quickstart_ensure_appointment_service( $booking_form_id, $default_provider_id );
	}

	if ( is_wp_error( $service ) ) {
		return $service;
	}

	$booking_form_id = ! empty( $service['booking_form_id'] ) ? absint( $service['booking_form_id'] ) : 0;
	$provider_id = ! empty( $service['resource_ids'] ) ? absint( reset( $service['resource_ids'] ) ) : absint( $default_provider_id );
	$page_result = wpbc_booking_modes_quickstart_ensure_page(
		'appointment_booking',
		'wpbc-appointment-booking',
		__( 'Book an Appointment', 'booking' ),
		'[booking_appointment]',
		'[booking_appointment'
	);

	if ( is_wp_error( $page_result ) ) {
		return $page_result;
	}

	$state['completed']       = true;
	$state['completed_at']    = ! empty( $state['completed_at'] ) ? $state['completed_at'] : current_time( 'mysql' );
	$state['resource_id']     = $provider_id;
	$state['service_id']      = absint( $service['service_id'] );
	$state['booking_form_id'] = absint( $booking_form_id );
	$state['page_id']         = absint( $page_result['page_id'] );
	$state_result             = wpbc_booking_modes_set_quickstart_state( 'appointment', $state );

	if ( is_wp_error( $state_result ) ) {
		return $state_result;
	}

	return array(
		'mode_id'      => 'appointment',
		'message'      => __( 'Appointment QuickStart is ready. Review Working Hours and Days Off, then test the booking page.', 'booking' ),
		'test_url'     => $page_result['test_url'],
		'page_id'      => absint( $page_result['page_id'] ),
		'resource_id'  => $provider_id,
		'service_id'   => absint( $service['service_id'] ),
		'booking_form_id' => absint( $booking_form_id ),
		'working_hours_url' => function_exists( 'wpbc_appointment_services_get_provider_availability_url' ) ? wpbc_appointment_services_get_provider_availability_url( $provider_id ) : '',
		'days_off_url' => add_query_arg( 'resource_id', $provider_id, wpbc_booking_modes_get_canonical_page_url( 'wpbc-availability__availability' ) ),
	);
}
