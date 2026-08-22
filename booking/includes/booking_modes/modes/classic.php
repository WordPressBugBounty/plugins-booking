<?php
/**
 * Classic administration mode metadata.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$wpbc_classic_booking_mode = array(
	'id'                      => 'classic',
	'label'                   => __( 'Classic', 'booking' ),
	'description'             => __( 'Use the established Booking Calendar administration terminology and navigation.', 'booking' ),
	'default_page'            => 'wpbc__vm_booking_listing',
	'preserve_unmapped_pages' => true,
	'groups' => array(),
	'pages'                   => array(
		'wpbc__add-appointment'                     => array( 'visible' => false ),
		'wpbc-services__appointment_services'       => array( 'visible' => false ),
	),
	'native_menu' => array(
		'wpbc'              => array( 'position' => 10 ),
		'wpbc-new'          => array( 'position' => 20 ),
		'wpbc-resources'    => array( 'position' => 30 ),
		'wpbc-availability' => array( 'position' => 40 ),
		'wpbc-prices'       => array( 'position' => 50 ),
		'wpbc-services'     => array( 'visible' => false ),
		'wpbc-settings'     => array( 'position' => 60 ),
		'wpbc-setup'        => array( 'position' => 70 ),
	),
	'quickstart_id'           => '',
);

return $wpbc_classic_booking_mode;
