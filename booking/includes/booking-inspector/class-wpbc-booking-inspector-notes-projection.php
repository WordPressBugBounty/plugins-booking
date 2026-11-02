<?php
/**
 * Booking Inspector notes projection boundary.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Project authorized notes without conflating private and future public notes.
 */
final class WPBC_Booking_Inspector_Notes_Projection {

	/**
	 * Return the current read-only notes DTO.
	 *
	 * The existing Personal-or-higher `booking.remark` value remains a private
	 * administrator note. The distinct public-note contract does not imply an
	 * email or front-end output integration.
	 *
	 * @param array<string,array<string,mixed>> $notes Canonical normalized note contract.
	 *
	 * @return array<int,array<string,mixed>> Authorized note records.
	 */
	public function project( $notes ) {
		$projected_notes = array();
		$note_types      = array( 'public', 'private' );

		foreach ( $note_types as $note_type ) {
			if ( empty( $notes[ $note_type ]['supported'] ) ) {
				continue;
			}

			$note_state = isset( $notes[ $note_type ]['state'] ) ? sanitize_key( $notes[ $note_type ]['state'] ) : WPBC_Booking_Notes_Service::STATE_MISSING;
			$has_value  = WPBC_Booking_Notes_Service::STATE_VALUE === $note_state;
			$projected_notes[] = array(
				'type'        => $note_type,
				'label'       => 'public' === $note_type ? __( 'Public note', 'booking' ) : __( 'Private note', 'booking' ),
				'audience'    => 'public' === $note_type
					? __( 'Not automatically sent or displayed', 'booking' )
					: __( 'Administrators only', 'booking' ),
				'state'       => $note_state,
				'state_label' => $this->get_state_label( $note_state ),
				'has_value'   => $has_value,
				'value'       => $has_value && isset( $notes[ $note_type ]['value'] )
					? sanitize_textarea_field( (string) $notes[ $note_type ]['value'] )
					: '',
			);
		}

		return $projected_notes;
	}

	/**
	 * Return a readable label for a note storage state.
	 *
	 * @param string $note_state Normalized storage state.
	 *
	 * @return string Translated state label.
	 */
	private function get_state_label( $note_state ) {
		if ( WPBC_Booking_Notes_Service::STATE_EMPTY === $note_state ) {
			return __( 'Not set', 'booking' );
		}
		if ( WPBC_Booking_Notes_Service::STATE_CLEARED === $note_state ) {
			return __( 'Cleared', 'booking' );
		}

		return __( 'Unavailable', 'booking' );
	}
}
