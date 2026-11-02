<?php
/**
 * Booking Inspector compatibility facade for structured field projection.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once dirname( __DIR__ ) . '/booking-domain/class-wpbc-booking-structured-field-resolver.php';

/**
 * Preserve the released Booking Inspector structured-field resolver name.
 *
 * The inherited implementation retains the public
 * `$include_orphaned_stored_fields` compatibility parameter. Advanced Mode
 * parsing remains in the shared parent and continues to call `wpbc_parse_form(`
 * without moving Inspector editing or snapshot decisions into shared code.
 *
 * @since 12.0.0
 */
final class WPBC_Booking_Inspector_Structured_Field_Resolver extends WPBC_Booking_Structured_Field_Resolver {
}
