<?php
/**
 * Rental mode QuickStart operation.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Apply the minimum Rental date-range and changeover configuration once.
 *
 * The caller persists a profile marker immediately after this function. Later
 * retries therefore preserve any manual changes made after initial QuickStart.
 * Booking Form layout, themes, email, pricing, and existing resources are not
 * overwritten.
 *
 * @return void
 */
function wpbc_booking_modes_quickstart_apply_rental_profile() {

	update_bk_option( 'booking_type_of_day_selections', 'range' );
	update_bk_option( 'booking_range_selection_type', 'dynamic' );
	update_bk_option( 'booking_range_selection_days_count', '2' );
	update_bk_option( 'booking_range_selection_days_max_count_dynamic', 30 );
	update_bk_option( 'booking_range_selection_days_specific_num_dynamic', '' );
	update_bk_option( 'booking_range_start_day', '-1' );
	update_bk_option( 'booking_range_selection_days_count_dynamic', '2' );
	update_bk_option( 'booking_range_start_day_dynamic', '-1' );
	update_bk_option( 'booking_range_selection_time_is_active', 'On' );
	update_bk_option( 'booking_range_selection_start_time', '14:00' );
	update_bk_option( 'booking_range_selection_end_time', '12:00' );
	update_bk_option( 'booking_change_over_days_triangles', 'On' );
	update_bk_option( 'booking_recurrent_time', 'Off' );
}

/**
 * Run Rental QuickStart using the active edition's supported engines.
 *
 * The first existing Booking Resource is reused as the Property. The rental
 * date-range profile is applied only once, a public Property page is ensured,
 * and Business Large receives a separate availability-search page. Capacity,
 * pricing, and extras remain guided follow-up operations because QuickStart
 * must not invent commercial values for existing customer resources.
 *
 * @return array<string,mixed>|WP_Error QuickStart result, or an error.
 */
function wpbc_booking_modes_run_rental_quickstart() {

	$state       = wpbc_booking_modes_get_quickstart_state( 'rental' );
	$resource_id = wpbc_booking_modes_quickstart_get_first_resource_id();

	if ( is_wp_error( $resource_id ) ) {
		return $resource_id;
	}

	if ( empty( $state['profile_version'] ) ) {
		wpbc_booking_modes_quickstart_apply_rental_profile();
		$state['profile_version'] = 1;
		$profile_state_result     = wpbc_booking_modes_set_quickstart_state( 'rental', $state );

		if ( is_wp_error( $profile_state_result ) ) {
			return $profile_state_result;
		}
	}

	$property_page = wpbc_booking_modes_quickstart_ensure_page(
		'rental_property_booking',
		'wpbc-rental-booking',
		__( 'Book a Property', 'booking' ),
		'[booking resource_id=' . absint( $resource_id ) . ']',
		'[booking resource_id=' . absint( $resource_id )
	);

	if ( is_wp_error( $property_page ) ) {
		return $property_page;
	}

	$search_page = array();
	if ( class_exists( 'wpdev_bk_biz_l' ) && shortcode_exists( 'bookingsearch' ) ) {
		$search_page = wpbc_booking_modes_quickstart_ensure_page(
			'rental_availability_search',
			'wpbc-rental-search',
			__( 'Search Property Availability', 'booking' ),
			'[bookingsearch]',
			'[bookingsearch'
		);

		if ( is_wp_error( $search_page ) ) {
			return $search_page;
		}
	}

	$state['completed']       = true;
	$state['completed_at']    = ! empty( $state['completed_at'] ) ? $state['completed_at'] : current_time( 'mysql' );
	$state['resource_id']     = absint( $resource_id );
	$state['page_id']         = absint( $property_page['page_id'] );
	$state['search_page_id']  = ! empty( $search_page['page_id'] ) ? absint( $search_page['page_id'] ) : 0;
	$state_result             = wpbc_booking_modes_set_quickstart_state( 'rental', $state );

	if ( is_wp_error( $state_result ) ) {
		return $state_result;
	}

	return array(
		'mode_id'      => 'rental',
		'message'      => __( 'Rental QuickStart is ready. Review capacity, pricing, extras, and availability, then test the booking page.', 'booking' ),
		'test_url'     => $property_page['test_url'],
		'page_id'      => absint( $property_page['page_id'] ),
		'resource_id'  => absint( $resource_id ),
		'search_url'   => ! empty( $search_page['test_url'] ) ? $search_page['test_url'] : '',
		'capacity_url' => wpbc_booking_modes_get_canonical_page_url( 'wpbc-resources__capacity' ),
		'pricing_url'  => wpbc_booking_modes_get_canonical_page_url( 'wpbc-prices__cost' ),
		'availability_url' => wpbc_booking_modes_get_canonical_page_url( 'wpbc-availability__availability' ),
	);
}
