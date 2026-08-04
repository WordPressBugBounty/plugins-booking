<?php
/**
 * Appointment administration mode metadata.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

return array(
	'id'            => 'appointment',
	'label'         => __( 'Appointments', 'booking' ),
	'description'   => __( 'Present existing Booking Calendar features with appointment-focused terminology.', 'booking' ),
	'default_page'  => 'wpbc__vm_booking_listing',
	'groups'        => array(
		'wpbc'              => array( 'title' => __( 'Appointments', 'booking' ), 'position' => 10 ),
		'wpbc-services'     => array( 'title' => __( 'Services', 'booking' ), 'position' => 20, 'font_icon' => 'wpbc-bi-grid' ),
		'wpbc-resources'    => array( 'title' => __( 'Providers', 'booking' ), 'position' => 30 ),
		'wpbc-availability' => array( 'title' => __( 'Availability', 'booking' ), 'position' => 40 ),
		'wpbc-prices'       => array( 'title' => __( 'Pricing & Payments', 'booking' ), 'position' => 50 ),
		'wpbc-settings'     => array( 'title' => __( 'Settings', 'booking' ), 'position' => 60 ),
	),
	'pages'         => array(
		'wpbc__vm_booking_listing'                         => array( 'title' => __( 'Appointments', 'booking' ), 'position' => 10 ),
		'wpbc__vm_calendar'                                => array( 'title' => __( 'Calendar', 'booking' ), 'position' => 20 ),
		'wpbc__add-appointment'                            => array( 'title' => __( 'Add Appointment', 'booking' ), 'position' => 30 ),
		'wpbc-services__appointment_services'              => array( 'title' => __( 'Services', 'booking' ), 'position' => 10 ),
		'wpbc-resources__resources'                        => array( 'title' => __( 'Providers', 'booking' ), 'position' => 10 ),
		'wpbc-resources__capacity'                         => array( 'title' => __( 'Capacity Rules', 'booking' ), 'position' => 20 ),
		'wpbc-resources__searchable_resources'             => array( 'title' => __( 'Searchable Providers', 'booking' ), 'position' => 30 ),
		'wpbc-availability__time_slots_availability'       => array( 'title' => __( 'Time Slots', 'booking' ), 'position' => 10 ),
		'wpbc-availability__general_availability'          => array( 'title' => __( 'Working Hours', 'booking' ), 'position' => 20 ),
		'wpbc-availability__availability'                  => array( 'title' => __( 'Days Off', 'booking' ), 'position' => 30 ),
		'wpbc-availability__season_availability'           => array( 'title' => __( 'Season Availability', 'booking' ), 'position' => 40 ),
		'wpbc-availability__filter'                        => array( 'title' => __( 'Seasons', 'booking' ), 'position' => 50 ),
		'wpbc-prices__cost'                                => array( 'title' => __( 'Prices', 'booking' ), 'position' => 10 ),
		'wpbc-prices__cost_advanced'                       => array( 'title' => __( 'Pricing Rules', 'booking' ), 'position' => 20 ),
		'wpbc-prices__coupons'                             => array( 'title' => __( 'Coupons', 'booking' ), 'position' => 30 ),
		'wpbc-prices__filter'                              => array( 'title' => __( 'Seasons', 'booking' ), 'position' => 40 ),
		'wpbc-prices__payment'                             => array( 'title' => __( 'Payment Gateways', 'booking' ), 'position' => 50 ),
		'wpbc-settings__general'                           => array( 'position' => 10 ),
		'wpbc-settings__calendar_settings'                 => array( 'position' => 20 ),
		'wpbc-settings__themes'                            => array( 'position' => 30 ),
		'wpbc-settings__form_messages'                     => array( 'position' => 40 ),
		'wpbc-settings__builder_booking_form'              => array( 'title' => __( 'Booking Forms', 'booking' ), 'position' => 50 ),
		'wpbc-settings__email'                             => array( 'position' => 60 ),
		'wpbc-settings__sync'                              => array( 'position' => 70 ),
		'wpbc-settings__payment'                           => array( 'position' => 80 ),
		'wpbc-settings__users'                             => array( 'position' => 99999 ),
		'wpbc-setup__step_01'                              => array( 'position' => 10 ),
	),
	'native_menu'   => array(
		'wpbc'              => array( 'title' => __( 'Appointments', 'booking' ), 'position' => 10 ),
		'wpbc-new'          => array( 'title' => __( '+ Add Appointment', 'booking' ), 'position' => 20 ),
		'wpbc-services'     => array( 'title' => __( 'Services', 'booking' ), 'position' => 30 ),
		'wpbc-resources'    => array( 'title' => __( 'Providers', 'booking' ), 'position' => 40 ),
		'wpbc-availability' => array( 'title' => __( 'Availability', 'booking' ), 'position' => 50 ),
		'wpbc-prices'       => array( 'title' => __( 'Pricing & Payments', 'booking' ), 'position' => 60 ),
		'wpbc-settings'     => array( 'title' => __( 'Settings', 'booking' ), 'position' => 70 ),
		'wpbc-setup'        => array( 'title' => __( 'Setup', 'booking' ), 'position' => 80 ),
	),
	'quickstart_id' => 'appointment',
);
