<?php
/**
 * Resource eligibility for the Timeline time-rows presentation.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Expose the mode-neutral presentation for every already-authorized Resource.
 */
final class WPBC_Timeline_Time_Rows_Provider implements WPBC_Timeline_Row_Presentation_Provider {

	/**
	 * Return the registered presentation ID.
	 *
	 * @return string Stable presentation ID.
	 */
	public function get_presentation_id() {
		return WPBC_Timeline_Time_Rows_Config::PRESENTATION_ID;
	}

	/**
	 * Accept one already-authorized Resource with a stable positive identity.
	 *
	 * Booking Mode does not participate in eligibility. Classic, Appointment,
	 * Rental, and future modes therefore consume the same Timeline-native source.
	 *
	 * @param array<string,mixed> $resource Authorized internal Resource record.
	 *
	 * @return bool True for a positive authorized Resource ID.
	 */
	public function is_available_for_resource( $resource ) {
		return 0 < absint( isset( $resource['id'] ) ? $resource['id'] : 0 );
	}
}
