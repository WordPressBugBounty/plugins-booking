<?php
/**
 * Stable Booking Calendar administration page references.
 *
 * These entries describe existing routes only. They do not register or expose
 * controllers that are unavailable in the active edition.
 *
 * @package Booking Calendar
 * @since   11.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$wpbc_booking_mode_canonical_pages = array(
	'wpbc__vm_booking_listing' => array(
		'page'  => 'wpbc',
		'tab'   => 'vm_booking_listing',
		'title' => 'Bookings',
	),
	'wpbc__vm_calendar' => array(
		'page'  => 'wpbc',
		'tab'   => 'vm_calendar',
		'title' => 'Timeline View',
	),
	'wpbc__add-booking' => array(
		'page'  => 'wpbc',
		'tab'   => 'add-booking',
		'title' => 'Add Booking',
	),
	'wpbc__add-appointment' => array(
		'page'       => 'wpbc',
		'tab'        => 'add-appointment',
		'title'      => 'Add Appointment',
		'feature_id' => '11_5',
	),
	'wpbc-services__appointment_services' => array(
		'page'       => 'wpbc-services',
		'tab'        => 'appointment_services',
		'title'      => 'Services',
		'feature_id' => '11_5',
	),
	'wpbc-availability__availability' => array(
		'page'  => 'wpbc-availability',
		'tab'   => 'availability',
		'title' => 'Block Dates',
	),
	'wpbc-availability__time_slots_availability' => array(
		'page'  => 'wpbc-availability',
		'tab'   => 'time_slots_availability',
		'title' => 'Block Times',
	),
	'wpbc-availability__general_availability' => array(
		'page'  => 'wpbc-availability',
		'tab'   => 'general_availability',
		'title' => 'Schedule & Rules',
	),
	'wpbc-availability__season_availability' => array(
		'page'       => 'wpbc-availability',
		'tab'        => 'season_availability',
		'title'      => 'Seasonal Availability',
		'edition_id' => 'business_medium',
	),
	'wpbc-availability__filter' => array(
		'page'       => 'wpbc-availability',
		'tab'        => 'filter',
		'title'      => 'Seasons',
		'edition_id' => 'business_medium',
	),
	'wpbc-resources__resources' => array(
		'page'  => 'wpbc-resources',
		'tab'   => 'resources',
		'title' => 'Resources',
	),
	'wpbc-resources__capacity' => array(
		'page'  => 'wpbc-resources',
		'tab'   => 'capacity',
		'title' => 'Capacity Rules',
	),
	'wpbc-resources__searchable_resources' => array(
		'page'       => 'wpbc-resources',
		'tab'        => 'searchable_resources',
		'title'      => 'Searchable Resources',
		'edition_id' => 'business_large',
	),
	'wpbc-prices__cost' => array(
		'page'       => 'wpbc-prices',
		'tab'        => 'cost',
		'title'      => 'Prices',
		'edition_id' => 'business_medium',
	),
	'wpbc-prices__cost_advanced' => array(
		'page'       => 'wpbc-prices',
		'tab'        => 'cost_advanced',
		'title'      => 'Advanced Costs',
		'edition_id' => 'business_medium',
	),
	'wpbc-prices__coupons' => array(
		'page'       => 'wpbc-prices',
		'tab'        => 'coupons',
		'title'      => 'Coupons',
		'edition_id' => 'business_large',
	),
	'wpbc-prices__filter' => array(
		'page'       => 'wpbc-prices',
		'tab'        => 'filter',
		'title'      => 'Seasons',
		'edition_id' => 'business_medium',
	),
	'wpbc-prices__payment' => array(
		'page'       => 'wpbc-prices',
		'tab'        => 'payment',
		'title'      => 'Payment Gateways',
		'edition_id' => 'business_small',
	),
	'wpbc-settings__general' => array(
		'page'  => 'wpbc-settings',
		'tab'   => 'general',
		'title' => 'General Settings',
	),
	'wpbc-settings__calendar_settings' => array(
		'page'  => 'wpbc-settings',
		'tab'   => 'calendar_settings',
		'title' => 'Calendar Settings',
	),
	'wpbc-settings__themes' => array(
		'page'  => 'wpbc-settings',
		'tab'   => 'themes',
		'title' => 'Calendar Appearance',
	),
	'wpbc-settings__form_messages' => array(
		'page'  => 'wpbc-settings',
		'tab'   => 'form_messages',
		'title' => 'Form Messages',
	),
	'wpbc-settings__builder_booking_form' => array(
		'page'  => 'wpbc-settings',
		'tab'   => 'builder_booking_form',
		'title' => 'Booking Forms',
	),
	'wpbc-settings__email' => array(
		'page'  => 'wpbc-settings',
		'tab'   => 'email',
		'title' => 'Emails',
	),
	'wpbc-settings__sync' => array(
		'page'  => 'wpbc-settings',
		'tab'   => 'sync',
		'title' => 'Sync',
	),
	'wpbc-settings__payment' => array(
		'page'       => 'wpbc-settings',
		'tab'        => 'payment',
		'title'      => 'Payment Gateways',
		'edition_id' => 'business_small',
	),
	'wpbc-settings__search' => array(
		'page'       => 'wpbc-settings',
		'tab'        => 'search',
		'title'      => 'Search Availability',
		'edition_id' => 'business_large',
	),
	'wpbc-settings__users' => array(
		'page'       => 'wpbc-settings',
		'tab'        => 'users',
		'title'      => 'Users',
		'edition_id' => 'multiuser',
	),
	'wpbc-setup__step_01' => array(
		'page'  => 'wpbc-setup',
		'tab'   => 'step_01',
		'title' => 'Setup',
	),
);

return $wpbc_booking_mode_canonical_pages;
