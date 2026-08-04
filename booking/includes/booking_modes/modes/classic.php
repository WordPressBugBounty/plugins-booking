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

return array(
	'id'                      => 'classic',
	'label'                   => __( 'Classic', 'booking' ),
	'description'             => __( 'Use the established Booking Calendar administration terminology and navigation.', 'booking' ),
	'default_page'            => 'wpbc__vm_booking_listing',
	'preserve_unmapped_pages' => true,
	'groups'                  => array(),
	'pages'                   => array(
		'wpbc__add-appointment'               => array( 'visible' => false ),
		'wpbc-services__appointment_services' => array( 'visible' => false ),
	),
	'native_menu'             => array(
		'wpbc-services' => array( 'visible' => false ),
	),
	'quickstart_id'           => '',
);
