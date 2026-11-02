<?php
/**
 * Authorization for Add New Booking Inspector bootstrap reads.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reuses the canonical Add Booking and MultiUser authorization decisions.
 */
final class WPBC_Booking_New_Inspector_Authorization {

	/**
	 * Determine whether the current user may load creation bootstrap data.
	 *
	 * @return bool True when the user is logged in, may add bookings, and has an active MultiUser context.
	 */
	public function current_user_can_bootstrap() {
		if ( ! function_exists( 'is_user_logged_in' ) || ! is_user_logged_in() ) {
			return false;
		}

		if (
			! class_exists( 'WPBC_Add_Booking_Component' )
			|| ! method_exists( 'WPBC_Add_Booking_Component', 'current_user_can_add_booking' )
			|| ! WPBC_Add_Booking_Component::current_user_can_add_booking()
		) {
			return false;
		}

		return ! function_exists( 'wpbc_is_mu_user_can_be_here' )
			|| wpbc_is_mu_user_can_be_here( 'activated_user' );
	}

	/**
	 * Return a uniform safe authorization error.
	 *
	 * @return WP_Error Safe forbidden response.
	 */
	public function get_forbidden_error() {
		return new WP_Error(
			'wpbc_booking_new_inspector_forbidden',
			__( 'You are not allowed to add bookings.', 'booking' ),
			array( 'status' => 403 )
		);
	}
}
