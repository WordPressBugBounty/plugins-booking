<?php
/**
 * Booking Inspector compatibility facade for exact Booking Form resolution.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once dirname( __DIR__ ) . '/booking-domain/class-wpbc-booking-form-definition-repository.php';

/**
 * Preserve the released Booking Inspector repository class name.
 *
 * Exact authorized form-source resolution is implemented by the neutral
 * Booking-domain parent. The facade intentionally adds no Inspector authority,
 * snapshot behavior, rendering, or mutation.
 *
 * @since 12.0.0
 */
final class WPBC_Booking_Inspector_Form_Definition_Repository extends WPBC_Booking_Form_Definition_Repository {
}
