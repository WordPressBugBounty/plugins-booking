<?php
/**
 * Resource-owned Timeline row-presentation availability contract.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Decide whether one registered neutral presentation is available to a
 * Resource that has already passed the Timeline authorization boundary.
 */
interface WPBC_Timeline_Row_Presentation_Provider {

	/**
	 * Return the stable presentation ID owned by this provider.
	 *
	 * @return string Registered presentation ID.
	 */
	public function get_presentation_id();

	/**
	 * Determine whether the presentation is available for one authorized Resource.
	 *
	 * Implementations may apply domain eligibility rules, but must not mutate the
	 * Resource or return presentation content.
	 *
	 * @param array<string,mixed> $resource Authorized internal Resource record.
	 *
	 * @return bool True when the descriptor may be exposed for this Resource.
	 */
	public function is_available_for_resource( $resource );
}
