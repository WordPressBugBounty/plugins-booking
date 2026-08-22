<?php
/**
 * Stable Booking Calendar administration page references.
 *
 * These entries describe existing routes only. They do not register or expose
 * controllers that are unavailable in the active edition.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$wpbc_booking_mode_canonical_pages = array(
	'wpbc__vm_booking_listing' => array(
		'page'  => 'wpbc',
		'tab'   => 'vm_booking_listing',
		'title' => __( 'Bookings', 'booking' ),
	),
	'wpbc__vm_calendar' => array(
		'page'  => 'wpbc',
		'tab'   => 'vm_calendar',
		'title' => __( 'Timeline View', 'booking' ),
	),
	'wpbc__add-booking' => array(
		'page'  => 'wpbc',
		'tab'   => 'add-booking',
		'title' => __( 'Add Booking', 'booking' ),
	),
	'wpbc__add-appointment' => array(
		'page'       => 'wpbc',
		'tab'        => 'add-appointment',
		'title'      => __( 'Add Appointment', 'booking' ),
		'feature_id' => '11_5',
	),
	'wpbc-services__appointment_services' => array(
		'page'       => 'wpbc-services',
		'tab'        => 'appointment_services',
		'title'      => __( 'Services', 'booking' ),
		'feature_id' => '11_5',
	),
	'wpbc-availability__availability' => array(
		'page'  => 'wpbc-availability',
		'tab'   => 'availability',
		'title' => __( 'Days Availability', 'booking' ),
	),
	'wpbc-availability__time_slots_availability' => array(
		'page'  => 'wpbc-availability',
		'tab'   => 'time_slots_availability',
		'title' => __( 'Time Slots Availability', 'booking' ),
	),
	'wpbc-availability__general_availability' => array(
		'page'  => 'wpbc-availability',
		'tab'   => 'general_availability',
		'title' => __( 'General Availability', 'booking' ),
	),
	'wpbc-availability__season_availability' => array(
		'page'       => 'wpbc-availability',
		'tab'        => 'season_availability',
		'title'      => __( 'Season Availability', 'booking' ),
		'edition_id' => 'business_medium',
	),
	'wpbc-availability__filter' => array(
		'page'       => 'wpbc-availability',
		'tab'        => 'filter',
		'title'      => __( 'Seasons', 'booking' ),
		'edition_id' => 'business_medium',
	),
	'wpbc-resources__resources' => array(
		'page'  => 'wpbc-resources',
		'tab'   => 'resources',
		'title' => __( 'Resources', 'booking' ),
	),
	'wpbc-resources__capacity' => array(
		'page'  => 'wpbc-resources',
		'tab'   => 'capacity',
		'title' => __( 'Capacity Rules', 'booking' ),
	),
	'wpbc-resources__searchable_resources' => array(
		'page'       => 'wpbc-resources',
		'tab'        => 'searchable_resources',
		'title'      => __( 'Searchable Resources', 'booking' ),
		'edition_id' => 'business_large',
	),
	'wpbc-prices__cost' => array(
		'page'       => 'wpbc-prices',
		'tab'        => 'cost',
		'title'      => __( 'Prices', 'booking' ),
		'edition_id' => 'business_medium',
	),
	'wpbc-prices__cost_advanced' => array(
		'page'       => 'wpbc-prices',
		'tab'        => 'cost_advanced',
		'title'      => __( 'Advanced Costs', 'booking' ),
		'edition_id' => 'business_medium',
	),
	'wpbc-prices__coupons' => array(
		'page'       => 'wpbc-prices',
		'tab'        => 'coupons',
		'title'      => __( 'Coupons', 'booking' ),
		'edition_id' => 'business_large',
	),
	'wpbc-prices__filter' => array(
		'page'       => 'wpbc-prices',
		'tab'        => 'filter',
		'title'      => __( 'Seasons', 'booking' ),
		'edition_id' => 'business_medium',
	),
	'wpbc-prices__payment' => array(
		'page'       => 'wpbc-prices',
		'tab'        => 'payment',
		'title'      => __( 'Payment Gateways', 'booking' ),
		'edition_id' => 'business_small',
	),
	'wpbc-settings__general' => array(
		'page'  => 'wpbc-settings',
		'tab'   => 'general',
		'title' => __( 'General Settings', 'booking' ),
	),
	'wpbc-settings__calendar_settings' => array(
		'page'  => 'wpbc-settings',
		'tab'   => 'calendar_settings',
		'title' => __( 'Calendar Settings', 'booking' ),
	),
	'wpbc-settings__themes' => array(
		'page'  => 'wpbc-settings',
		'tab'   => 'themes',
		'title' => __( 'Calendar Appearance', 'booking' ),
	),
	'wpbc-settings__form_messages' => array(
		'page'  => 'wpbc-settings',
		'tab'   => 'form_messages',
		'title' => __( 'Form Messages', 'booking' ),
	),
	'wpbc-settings__builder_booking_form' => array(
		'page'  => 'wpbc-settings',
		'tab'   => 'builder_booking_form',
		'title' => __( 'Booking Forms', 'booking' ),
	),
	'wpbc-settings__email' => array(
		'page'  => 'wpbc-settings',
		'tab'   => 'email',
		'title' => __( 'Emails', 'booking' ),
	),
	'wpbc-settings__sync' => array(
		'page'  => 'wpbc-settings',
		'tab'   => 'sync',
		'title' => __( 'Sync', 'booking' ),
	),
	'wpbc-settings__payment' => array(
		'page'       => 'wpbc-settings',
		'tab'        => 'payment',
		'title'      => __( 'Payment Gateways', 'booking' ),
		'edition_id' => 'business_small',
	),
	'wpbc-settings__search' => array(
		'page'       => 'wpbc-settings',
		'tab'        => 'search',
		'title'      => __( 'Search Availability', 'booking' ),
		'edition_id' => 'business_large',
	),
	'wpbc-settings__users' => array(
		'page'       => 'wpbc-settings',
		'tab'        => 'users',
		'title'      => __( 'Users', 'booking' ),
		'edition_id' => 'multiuser',
	),
	'wpbc-setup__step_01' => array(
		'page'  => 'wpbc-setup',
		'tab'   => 'step_01',
		'title' => __( 'Setup', 'booking' ),
	),
);

return $wpbc_booking_mode_canonical_pages;
