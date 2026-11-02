<?php
/**
 * Timeline adapter for the unavailable-background projection.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Keep Timeline orchestration independent from Availability-domain details.
 */
final class WPBC_Timeline_Availability_Provider {

	/** @var WPBC_Timeline_Unavailable_Days_BG_Projection Domain projection. */
	private $projection;

	/**
	 * Construct the adapter.
	 *
	 * @param WPBC_Timeline_Unavailable_Days_BG_Projection|null $projection Optional projection service.
	 */
	public function __construct( $projection = null ) {
		$this->projection = $projection ? $projection : new WPBC_Timeline_Unavailable_Days_BG_Projection();
	}

	/**
	 * Expand the internal booking read only as far as canonical saved buffers require.
	 *
	 * @param array<int,array<string,mixed>> $resources Authorized Resources.
	 * @param array<string,mixed>            $window    Validated Timeline window.
	 *
	 * @return array<string,mixed> Internal half-open booking query window.
	 */
	public function get_booking_query_window( $resources, $window ) {
		return $this->projection->get_booking_query_window( $resources, $window );
	}

	/**
	 * Return exact unavailable intervals and explicit unknown source coverage.
	 *
	 * @param array<int,array<string,mixed>> $resources      Authorized Resources.
	 * @param array<string,mixed>            $window         Validated Timeline window.
	 * @param array<string,mixed>            $booking_window Canonical booking projection.
	 *
	 * @return array<string,mixed>|WP_Error Data-only availability DTO or safe error.
	 */
	public function get_availability( $resources, $window, $booking_window ) {
		return $this->projection->project( $resources, $window, $booking_window );
	}
}

