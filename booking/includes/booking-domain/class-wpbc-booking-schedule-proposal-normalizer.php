<?php
/**
 * Shared Booking schedule-proposal normalization.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize the schedule shape shared by creation and full date editing.
 *
 * This class owns bounded syntax normalization only. It does not authorize a
 * booking or Resource, load availability, apply current selection policy,
 * classify a saved booking, sign a review, or persist dates. Rescheduling
 * drag, resize, and Resource-change semantics remain in the Rescheduling
 * domain because they require canonical saved state.
 *
 * @since 12.0.0
 */
final class WPBC_Booking_Schedule_Proposal_Normalizer {

	/** Maximum selected dates supported by the shared syntax contract. */
	const MAX_SELECTED_DATES = 1095;

	/**
	 * Normalize one untrusted schedule proposal.
	 *
	 * Callers may choose a smaller date limit but cannot expand the shared hard
	 * ceiling. Unknown properties are ignored for compatibility with the released
	 * Date Editor proposal contract; endpoint validators must independently
	 * allow-list their request envelopes.
	 *
	 * @param mixed $proposal           Candidate schedule values.
	 * @param int   $max_selected_dates Caller-specific maximum selected dates.
	 * @return array<string,mixed>|WP_Error Normalized schedule or safe error.
	 */
	public function normalize( $proposal, $max_selected_dates = self::MAX_SELECTED_DATES ) {
		if ( ! is_array( $proposal ) ) {
			return $this->get_invalid_proposal_error();
		}

		$max_selected_dates = absint( $max_selected_dates );
		if ( ! $max_selected_dates || self::MAX_SELECTED_DATES < $max_selected_dates ) {
			return $this->get_invalid_proposal_error();
		}

		$selection_method = isset( $proposal['selection_method'] ) && is_scalar( $proposal['selection_method'] )
			? sanitize_key( (string) $proposal['selection_method'] )
			: '';
		$time_application = isset( $proposal['time_application'] ) && is_scalar( $proposal['time_application'] )
			? sanitize_key( (string) $proposal['time_application'] )
			: '';
		if (
			! in_array( $selection_method, array( 'policy', 'individual' ), true )
			|| ! in_array( $time_application, array( 'full_day', 'boundary', 'per_date' ), true )
		) {
			return $this->get_invalid_proposal_error();
		}

		$selected_dates = isset( $proposal['selected_dates'] ) && is_array( $proposal['selected_dates'] )
			? $proposal['selected_dates']
			: array();
		if ( empty( $selected_dates ) || $max_selected_dates < count( $selected_dates ) ) {
			return $this->get_invalid_proposal_error();
		}

		$normalized_dates = array();
		foreach ( $selected_dates as $selected_date ) {
			if ( ! is_scalar( $selected_date ) ) {
				return $this->get_invalid_proposal_error();
			}

			$selected_date = trim( (string) $selected_date );
			if (
				! preg_match( '/^(\d{4})-(\d{2})-(\d{2})$/', $selected_date, $date_parts )
				|| ! checkdate( (int) $date_parts[2], (int) $date_parts[3], (int) $date_parts[1] )
			) {
				return $this->get_invalid_proposal_error();
			}

			$normalized_dates[ $selected_date ] = $selected_date;
		}
		$normalized_dates = array_values( $normalized_dates );
		sort( $normalized_dates, SORT_STRING );

		$start_time = $this->normalize_time( isset( $proposal['start_time'] ) ? $proposal['start_time'] : '' );
		$end_time   = $this->normalize_time( isset( $proposal['end_time'] ) ? $proposal['end_time'] : '' );
		if ( 'full_day' === $time_application ) {
			$start_time = '';
			$end_time   = '';
		} elseif ( '' === $start_time || '' === $end_time ) {
			return $this->get_invalid_proposal_error();
		}

		return array(
			'selection_method' => $selection_method,
			'time_application' => $time_application,
			'start_time'       => $start_time,
			'end_time'         => $end_time,
			'selected_dates'   => $normalized_dates,
		);
	}

	/**
	 * Normalize one strict exact-minute wall time.
	 *
	 * @param mixed $time_value Candidate 24-hour time.
	 * @return string Strict `HH:MM` value or an empty string.
	 */
	private function normalize_time( $time_value ) {
		$time_value = is_scalar( $time_value ) ? trim( (string) $time_value ) : '';

		return preg_match( '/^(?:[01]\d|2[0-3]):[0-5]\d$/', $time_value ) ? $time_value : '';
	}

	/**
	 * Return the shared malformed schedule error.
	 *
	 * Calling domains may translate this error to their released public error
	 * code and message without exposing rejected input.
	 *
	 * @return WP_Error Safe syntax error.
	 */
	private function get_invalid_proposal_error() {
		return new WP_Error(
			'wpbc_booking_schedule_proposal_invalid',
			__( 'The proposed booking schedule is invalid. Review the selection and try again.', 'booking' ),
			array( 'status' => 400 )
		);
	}
}
