<?php
/**
 * Administration read authorization for the isolated Timeline page.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Keep page-read authorization separate from rendering and presentation data.
 */
final class WPBC_Timeline_Authorization {

	/**
	 * Determine whether the current administrator may view the Timeline shell.
	 *
	 * The parent Booking Calendar menu already requires WordPress `read`. The
	 * explicit check keeps direct requests and future read endpoints aligned,
	 * while the established MultiUser activation filter remains authoritative.
	 *
	 * @return bool True when the current user may view the page.
	 */
	public function current_user_can_view() {
		if ( ! current_user_can( 'read' ) ) {
			return false;
		}

		if ( function_exists( 'wpbc_is_mu_user_can_be_here' ) && ! wpbc_is_mu_user_can_be_here( 'activated_user' ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Determine whether the current administrator may enter the canonical
	 * Add Booking or Add Appointment workflow.
	 *
	 * @return bool True when booking creation is authorized.
	 */
	public function current_user_can_create_booking() {
		return class_exists( 'WPBC_Add_Booking_Component' )
			&& WPBC_Add_Booking_Component::current_user_can_add_booking()
			&& $this->current_user_can_view();
	}

	/**
	 * Determine whether the current administrator may change Availability.
	 *
	 * The capability is resolved by the Availability domain. Timeline never
	 * treats a visible action or Resource row as mutation authorization.
	 *
	 * @return bool True when Availability changes are authorized.
	 */
	public function current_user_can_manage_availability() {
		if ( ! $this->current_user_can_view() ) {
			return false;
		}

		$capability = function_exists( 'wpbc_availability_timeslots__get_manage_cap' )
			? wpbc_availability_timeslots__get_manage_cap()
			: 'manage_options';

		return current_user_can( $capability );
	}
}
