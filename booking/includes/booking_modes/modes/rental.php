<?php
/**
 * Rental administration mode metadata.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

return array(
	'id'            => 'rental',
	'label'         => __( 'Rentals', 'booking' ),
	'description'   => __( 'Present existing Booking Calendar features with property-rental terminology.', 'booking' ),
	'default_page'  => 'wpbc__vm_booking_listing',
	'groups'        => array(
		'wpbc'              => array( 'title' => __( 'Bookings', 'booking' ), 'position' => 10 ),
		'wpbc-resources'    => array( 'title' => __( 'Properties', 'booking' ), 'position' => 20 ),
		'wpbc-availability' => array( 'title' => __( 'Availability', 'booking' ), 'position' => 30 ),
		'wpbc-prices'       => array( 'title' => __( 'Pricing & Extras', 'booking' ), 'position' => 40 ),
		'wpbc-settings'     => array( 'title' => __( 'Settings', 'booking' ), 'position' => 50 ),
	),
	'pages'         => array(
		'wpbc__vm_booking_listing'                   => array( 'title' => __( 'Bookings', 'booking' ), 'position' => 10 ),
		'wpbc__vm_calendar'                          => array( 'title' => __( 'Timeline', 'booking' ), 'position' => 20 ),
		'wpbc__add-booking'                          => array( 'title' => __( 'Add Booking', 'booking' ), 'position' => 30 ),
		'wpbc__add-appointment'                      => array( 'visible' => false ),
		'wpbc-services__appointment_services'        => array( 'visible' => false ),
		'wpbc-resources__resources'                  => array( 'title' => __( 'Properties', 'booking' ), 'position' => 10 ),
		'wpbc-resources__capacity'                   => array( 'title' => __( 'Capacity Rules', 'booking' ), 'position' => 20 ),
		'wpbc-resources__searchable_resources'       => array( 'title' => __( 'Searchable Properties', 'booking' ), 'position' => 30 ),
		'wpbc-resources__users'                      => array( 'title' => __( 'Property Users', 'booking' ), 'position' => 40 ),
		'wpbc-availability__availability'            => array( 'title' => __( 'Days Availability', 'booking' ), 'position' => 10 ),
		'wpbc-availability__general_availability'    => array( 'title' => __( 'Weekdays Availability', 'booking' ), 'position' => 20 ),
		'wpbc-availability__season_availability'     => array( 'title' => __( 'Season Availability', 'booking' ), 'position' => 30 ),
		'wpbc-availability__filter'                  => array( 'title' => __( 'Seasons', 'booking' ), 'position' => 40 ),
		'wpbc-prices__cost'                          => array( 'title' => __( 'Prices & Extras', 'booking' ), 'position' => 10 ),
		'wpbc-prices__cost_advanced'                 => array( 'title' => __( 'Advanced Costs', 'booking' ), 'position' => 20 ),
		'wpbc-prices__coupons'                       => array( 'position' => 30 ),
		'wpbc-prices__filter'                        => array( 'position' => 40 ),
		'wpbc-prices__payment'                       => array( 'position' => 50 ),
		'wpbc-settings__general'                     => array( 'position' => 10 ),
		'wpbc-settings__calendar_settings'           => array( 'title' => __( 'Calendar Settings', 'booking' ), 'position' => 20 ),
		'wpbc-settings__themes'                      => array( 'position' => 30 ),
		'wpbc-settings__form_messages'               => array( 'position' => 40 ),
		'wpbc-settings__builder_booking_form'        => array( 'title' => __( 'Booking Forms', 'booking' ), 'position' => 50 ),
		'wpbc-settings__email'                       => array( 'position' => 60 ),
		'wpbc-settings__sync'                        => array( 'position' => 70 ),
		'wpbc-settings__payment'                     => array( 'position' => 80 ),
		'wpbc-settings__search'                      => array( 'position' => 90 ),
		'wpbc-settings__users'                       => array( 'position' => 99999 ),
		'wpbc-setup__step_01'                        => array( 'position' => 10 ),
	),
	'native_menu'   => array(
		'wpbc'              => array( 'title' => __( 'Bookings', 'booking' ), 'position' => 10 ),
		'wpbc-new'          => array( 'title' => __( '+ Add Booking', 'booking' ), 'position' => 20 ),
		'wpbc-services'     => array( 'visible' => false ),
		'wpbc-resources'    => array( 'title' => __( 'Properties', 'booking' ), 'position' => 30 ),
		'wpbc-availability' => array( 'title' => __( 'Availability', 'booking' ), 'position' => 40 ),
		'wpbc-prices'       => array( 'title' => __( 'Pricing & Extras', 'booking' ), 'position' => 50 ),
		'wpbc-settings'     => array( 'title' => __( 'Settings', 'booking' ), 'position' => 60 ),
		'wpbc-setup'        => array( 'title' => __( 'Setup', 'booking' ), 'position' => 70 ),
	),
	'quickstart_id' => 'rental',
);
