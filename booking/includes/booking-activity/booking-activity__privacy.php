<?php
/**
 * WordPress personal-data integration for booking activity.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the booking activity personal-data exporter.
 *
 * @param array<string,mixed> $exporters Registered exporters.
 *
 * @return array<string,mixed> Exporters with Booking Calendar activity.
 */
function wpbc_booking_activity_register_exporter( $exporters ) {
	$exporters['wpbc-booking-activity'] = array(
		'exporter_friendly_name' => __( 'Booking Calendar activity', 'booking' ),
		'callback'               => 'wpbc_booking_activity_export_personal_data',
	);

	return $exporters;
}
add_filter( 'wp_privacy_personal_data_exporters', 'wpbc_booking_activity_register_exporter' );

/**
 * Export structured activity connected to a normalized booking email.
 *
 * @param string $email_address Privacy request email.
 * @param int    $page          One-based exporter page.
 *
 * @return array<string,mixed> WordPress exporter response.
 */
function wpbc_booking_activity_export_personal_data( $email_address, $page = 1 ) {
	$export_items = array();
	if ( ! wpbc_booking_activity_table_exists() || ! is_email( $email_address ) ) {
		return array( 'data' => $export_items, 'done' => true );
	}
	$rows = ( new WPBC_Booking_Activity_Repository() )->get_subject_activity( hash( 'sha256', strtolower( sanitize_email( $email_address ) ) ), $page, 100 );
	foreach ( $rows as $row ) {
		$export_items[] = array(
			'group_id'    => 'wpbc-booking-activity',
			'group_label' => __( 'Booking Calendar activity', 'booking' ),
			'item_id'     => 'wpbc-booking-activity-' . absint( $row['activity_id'] ),
			'data'        => array(
				array( 'name' => __( 'Booking ID', 'booking' ), 'value' => absint( $row['booking_id'] ) ),
				array( 'name' => __( 'Activity', 'booking' ), 'value' => sanitize_key( $row['event_type'] ) ),
				array( 'name' => __( 'Date', 'booking' ), 'value' => sanitize_text_field( $row['occurred_at'] ) ),
			),
		);
	}

	return array( 'data' => $export_items, 'done' => count( $rows ) < 100 );
}

/**
 * Register the booking activity personal-data eraser.
 *
 * @param array<string,mixed> $erasers Registered erasers.
 *
 * @return array<string,mixed> Erasers with Booking Calendar activity.
 */
function wpbc_booking_activity_register_eraser( $erasers ) {
	$erasers['wpbc-booking-activity'] = array(
		'eraser_friendly_name' => __( 'Booking Calendar activity', 'booking' ),
		'callback'             => 'wpbc_booking_activity_erase_personal_data',
	);

	return $erasers;
}
add_filter( 'wp_privacy_personal_data_erasers', 'wpbc_booking_activity_register_eraser' );

/**
 * Erase structured activity connected to a normalized booking email.
 *
 * @param string $email_address Privacy request email.
 * @param int    $page          Eraser page (all matching hashes are removed once).
 *
 * @return array<string,mixed> WordPress eraser response.
 */
function wpbc_booking_activity_erase_personal_data( $email_address, $page = 1 ) {
	unset( $page );
	$response = array( 'items_removed' => false, 'items_retained' => false, 'messages' => array(), 'done' => true );
	if ( ! wpbc_booking_activity_table_exists() || ! is_email( $email_address ) ) {
		return $response;
	}
	$deleted = ( new WPBC_Booking_Activity_Repository() )->erase_subject_activity( hash( 'sha256', strtolower( sanitize_email( $email_address ) ) ) );
	if ( is_wp_error( $deleted ) ) {
		$response['items_retained'] = true;
		$response['messages'][]     = $deleted->get_error_message();
	} else {
		$response['items_removed'] = 0 < $deleted;
	}

	return $response;
}
