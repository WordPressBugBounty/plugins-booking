<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

function wpbc_elementor__register_widget__booking_form( $widgets_manager ) {

	require_once WPBC_PLUGIN_DIR . '/includes/elementor-booking-form/elementor-widget-booking.php';

	$widgets_manager->register( new \Elementor_WPBC_Booking_Form_1() );
}

add_action( 'elementor/widgets/register', 'wpbc_elementor__register_widget__booking_form' );


//function my_plugin_register_editor_styles() {
//	wp_register_style( 'elementor-wpbc-client-pages', wpbc_plugin_url( '/css/client.css' ), array(), WP_BK_VERSION_NUM );
//}
//add_action( 'elementor/editor/after_register_styles', 'my_plugin_register_editor_styles' );

function my_plugin_enqueue_editor_styles() {
	wp_enqueue_style( 'elementor-wpbc-client-pages' , wpbc_plugin_url( '/css/client.css' ), array(), WP_BK_VERSION_NUM );
}
add_action( 'elementor/editor/after_enqueue_styles', 'my_plugin_enqueue_editor_styles' );
