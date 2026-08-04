<?php
/**
 * Connect Setup Wizard booking profiles to administration presentation modes.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Get mode choices presented by the Setup Wizard.
 *
 * The wizard owns booking-form and availability configuration, while the
 * Booking Modes registry remains authoritative for which presentation modes
 * are available to the current owner. Keeping these responsibilities separate
 * prevents a booking behavior such as full-day booking from silently forcing
 * Rental terminology when the user explicitly selected Classic mode.
 *
 * @return array<string,array<string,mixed>> Setup choices keyed by mode ID.
 */
function wpbc_booking_modes_get_setup_mode_choices() {

	$registered_modes = wpbc_booking_modes_get_registered_modes();
	$allowed_mode_ids = wpbc_booking_modes_get_allowed_mode_ids();
	$choice_definitions = array(
		'appointment' => array(
			'title'                  => __( 'Appointments and services', 'booking' ),
			'description'            => __( 'Customers choose a Service, Provider, date, and start time.', 'booking' ),
			'preference_title'       => __( 'Appointment preferences', 'booking' ),
			'allowed_booking_types'  => array( 'time_slots_appointments' ),
			'default_booking_type'   => 'time_slots_appointments',
			'fixed_appointment_type' => 'durationtime',
		),
		'rental'      => array(
			'title'                 => __( 'Properties and rentals', 'booking' ),
			'description'           => __( 'Guests reserve properties or other resources for one or more dates.', 'booking' ),
			'preference_title'      => __( 'Rental preferences', 'booking' ),
			'allowed_booking_types' => array( 'full_days_bookings', 'changeover_multi_dates_bookings' ),
			'default_booking_type'  => 'full_days_bookings',
		),
		'classic'     => array(
			'title'                 => __( 'Classic Booking Calendar', 'booking' ),
			'description'           => __( 'Keep the traditional Booking Calendar terminology and configuration.', 'booking' ),
			'preference_title'      => __( 'Choose booking behavior', 'booking' ),
			'allowed_booking_types' => array( 'full_days_bookings', 'time_slots_appointments', 'changeover_multi_dates_bookings' ),
			'default_booking_type'  => 'full_days_bookings',
		),
	);
	$setup_choices = array();

	foreach ( $choice_definitions as $mode_id => $choice_definition ) {
		if ( ! isset( $registered_modes[ $mode_id ] ) || ! in_array( $mode_id, $allowed_mode_ids, true ) ) {
			continue;
		}

		$setup_choices[ $mode_id ] = array_merge(
			array(
				'id'                     => $mode_id,
				'fixed_appointment_type' => '',
			),
			$choice_definition
		);
	}

	return $setup_choices;
}

/**
 * Resolve the administration mode associated with a Setup Wizard booking type.
 *
 * The Setup Wizard remains authoritative for booking-form and availability
 * configuration. This mapping changes only the owner-scoped administration
 * presentation selected after that configuration is saved.
 *
 * @param string $booking_type      Sanitized Setup Wizard booking type identifier.
 * @param string $requested_mode_id Optional explicit mode selected in Step 4.
 *
 * @return string Allowed Booking Modes identifier, or an empty string when the
 *                booking type must not change the current selection.
 */
function wpbc_booking_modes_get_setup_mode_id( $booking_type, $requested_mode_id = '' ) {

	$booking_type      = is_scalar( $booking_type ) ? sanitize_key( (string) $booking_type ) : '';
	$requested_mode_id = is_scalar( $requested_mode_id ) ? sanitize_key( (string) $requested_mode_id ) : '';

	if ( '' !== $requested_mode_id ) {
		return in_array( $requested_mode_id, wpbc_booking_modes_get_allowed_mode_ids(), true ) ? $requested_mode_id : '';
	}

	$mode_map = array(
		'full_days_bookings'              => 'rental',
		'time_slots_appointments'         => 'appointment',
		'changeover_multi_dates_bookings' => 'rental',
	);

	/**
	 * Filter the Setup Wizard booking-type to administration-mode mapping.
	 *
	 * @param array  $mode_map     Mode identifiers keyed by Setup Wizard booking type.
	 * @param string $booking_type Sanitized booking type currently being resolved.
	 */
	$mode_map = apply_filters( 'wpbc_booking_modes_setup_booking_type_map', $mode_map, $booking_type );

	if ( ! is_array( $mode_map ) || ! isset( $mode_map[ $booking_type ] ) ) {
		return '';
	}

	$mode_id = is_scalar( $mode_map[ $booking_type ] ) ? sanitize_key( (string) $mode_map[ $booking_type ] ) : '';

	return in_array( $mode_id, wpbc_booking_modes_get_allowed_mode_ids(), true ) ? $mode_id : '';
}

/**
 * Persist the presentation mode selected indirectly by the Setup Wizard.
 *
 * This handler runs only after the wizard has validated, applied, and stored
 * its booking-type configuration. It deliberately does not run QuickStart or
 * mutate bookings, resources, Services, pages, availability, or prices.
 *
 * @param array $cleaned_data Validated Setup Wizard booking-type data.
 *
 * @return bool|WP_Error True when saved, false when no mapping applies, or a
 *                       storage error returned by the Booking Modes API.
 */
function wpbc_booking_modes_apply_setup_booking_type( $cleaned_data ) {

	if ( ! is_array( $cleaned_data ) || empty( $cleaned_data['wpbc_swp_booking_types'] ) ) {
		return false;
	}

	$requested_mode_id = isset( $cleaned_data['wpbc_swp_booking_mode'] ) ? $cleaned_data['wpbc_swp_booking_mode'] : '';
	$mode_id           = wpbc_booking_modes_get_setup_mode_id( $cleaned_data['wpbc_swp_booking_types'], $requested_mode_id );

	if ( '' === $mode_id ) {
		return false;
	}

	return wpbc_booking_modes_set_selected_mode_id( $mode_id );
}
add_action( 'wpbc_setup_wizard_booking_type_saved', 'wpbc_booking_modes_apply_setup_booking_type' );

/**
 * Add one published page to a Setup Wizard test-link collection.
 *
 * @param array  $page_links Page-link collection passed by reference.
 * @param string $page_url   Public page URL.
 * @param string $label      Button label.
 *
 * @return void
 */
function wpbc_booking_modes_add_setup_test_page_link( &$page_links, $page_url, $label ) {

	$page_url = is_scalar( $page_url ) ? esc_url_raw( (string) $page_url ) : '';
	$label    = is_scalar( $label ) ? sanitize_text_field( (string) $label ) : '';

	if ( '' === $page_url || '' === $label ) {
		return;
	}

	foreach ( $page_links as $page_link ) {
		if ( isset( $page_link['url'] ) && $page_url === $page_link['url'] ) {
			return;
		}
	}

	$page_links[] = array(
		'url'   => $page_url,
		'label' => $label,
	);
}

/**
 * Get published booking pages suitable for the active Setup Wizard mode.
 *
 * This is a read-only discovery operation. It reuses QuickStart ownership and
 * shortcode discovery when available, but never creates, republishes, or edits
 * site content. Classic mode falls back to the plugin's published activation
 * pages because it intentionally has no QuickStart operation.
 *
 * @param string $mode_id Optional mode ID. Empty uses the current selection.
 *
 * @return array<int,array{url:string,label:string}> Published page links.
 */
function wpbc_booking_modes_get_setup_test_page_links( $mode_id = '' ) {

	$mode_id    = is_scalar( $mode_id ) ? sanitize_key( (string) $mode_id ) : '';
	$mode_id    = '' !== $mode_id ? $mode_id : wpbc_booking_modes_get_selected_mode_id();
	$page_links = array();

	if ( 'appointment' === $mode_id ) {
		$test_url = function_exists( 'wpbc_booking_modes_get_quickstart_test_url' )
			? wpbc_booking_modes_get_quickstart_test_url( 'appointment' )
			: '';

		if ( '' === $test_url && function_exists( 'wpbc_booking_modes_quickstart_find_page' ) ) {
			$appointment_page = wpbc_booking_modes_quickstart_find_page( 'appointment_booking', '[booking_appointment' );
			if ( $appointment_page instanceof WP_Post && 'publish' === $appointment_page->post_status ) {
				$test_url = get_permalink( $appointment_page->ID );
			}
		}

		wpbc_booking_modes_add_setup_test_page_link( $page_links, $test_url, __( 'Test Appointment Page', 'booking' ) );
	} elseif ( 'rental' === $mode_id ) {
		$test_url = function_exists( 'wpbc_booking_modes_get_quickstart_test_url' )
			? wpbc_booking_modes_get_quickstart_test_url( 'rental' )
			: '';

		if ( '' === $test_url && function_exists( 'wpbc_booking_modes_quickstart_find_page' ) ) {
			$property_page = wpbc_booking_modes_quickstart_find_page( 'rental_property_booking', '[booking resource_id=' );
			if ( $property_page instanceof WP_Post && 'publish' === $property_page->post_status ) {
				$test_url = get_permalink( $property_page->ID );
			}
		}

		wpbc_booking_modes_add_setup_test_page_link( $page_links, $test_url, __( 'Test Property Page', 'booking' ) );

		if ( function_exists( 'wpbc_booking_modes_quickstart_find_page' ) ) {
			$search_page = wpbc_booking_modes_quickstart_find_page( 'rental_availability_search', '[bookingsearch' );
			if ( $search_page instanceof WP_Post && 'publish' === $search_page->post_status ) {
				wpbc_booking_modes_add_setup_test_page_link( $page_links, get_permalink( $search_page->ID ), __( 'Test Availability Search', 'booking' ) );
			}
		}
	} elseif ( 'classic' === $mode_id ) {
		if ( function_exists( 'wpbc_booking_modes_quickstart_find_page' ) ) {
			foreach ( array( '[booking ', '[booking]' ) as $classic_shortcode_match ) {
				$classic_page = wpbc_booking_modes_quickstart_find_page( 'classic_booking_page', $classic_shortcode_match );
				if ( $classic_page instanceof WP_Post && 'publish' === $classic_page->post_status ) {
					wpbc_booking_modes_add_setup_test_page_link( $page_links, get_permalink( $classic_page->ID ), __( 'Test Booking Page', 'booking' ) );
				}
			}
		}

		if ( function_exists( 'wpbc_get_published_activation_booking_pages' ) ) {
			foreach ( wpbc_get_published_activation_booking_pages() as $published_page ) {
				if ( ! is_array( $published_page ) ) {
					continue;
				}

				$page_url   = isset( $published_page['url'] ) ? $published_page['url'] : '';
				$page_label = isset( $published_page['button_title'] ) ? $published_page['button_title'] : __( 'Test Booking Page', 'booking' );
				wpbc_booking_modes_add_setup_test_page_link( $page_links, $page_url, $page_label );
			}
		}
	}

	/**
	 * Filter published booking-page links shown in the Setup Wizard bar.
	 *
	 * @param array  $page_links Published page links with URL and button label.
	 * @param string $mode_id    Active Booking Modes identifier.
	 */
	$page_links = apply_filters( 'wpbc_booking_modes_setup_test_page_links', $page_links, $mode_id );

	return is_array( $page_links ) ? $page_links : array();
}
