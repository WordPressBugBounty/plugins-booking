<?php
/**
 * Booking Inspector activity read boundary.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Read canonical booking activity when durable activity storage exists.
 */
final class WPBC_Booking_Inspector_Activity_Repository {

	/**
	 * Return one bounded page of canonical activity for one booking.
	 *
	 * @param int $booking_id Authorized booking ID.
	 * @param int $page       One-based page number.
	 * @param int $per_page   Bounded records per page.
	 *
	 * @return array<string,mixed> Canonical event and pagination contract.
	 */
	public function get_booking_activity( $booking_id, $page = 1, $per_page = 20 ) {
		return ( new WPBC_Booking_Activity_Read_Service() )->read( $booking_id, $page, $per_page );
	}
}
