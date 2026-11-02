<?php
/**
 * Booking Rescheduling saved-shape classifier.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Classify canonical saved rows through the proven Date Editor projection.
 */
final class WPBC_Booking_Rescheduling_Shape_Classifier {

	/**
	 * Classify one authorized booking's complete saved date allocation.
	 *
	 * @param array<int,array<string,mixed>> $date_rows              Canonical date rows.
	 * @param array<int,int>                 $effective_resource_ids Authorized effective Resource IDs.
	 * @param array<string,mixed>|null       $appointment_snapshot   Immutable Appointment snapshot.
	 *
	 * @return array<string,mixed>|WP_Error Saved projection and shape contract.
	 */
	public function classify( $date_rows, $effective_resource_ids, $appointment_snapshot = null ) {
		$saved = ( new WPBC_Booking_Date_Editor_Read_Service() )->normalize_saved_date_rows( $date_rows, $effective_resource_ids );
		if ( empty( $saved['supported'] ) ) {
			return new WP_Error(
				'wpbc_booking_rescheduling_shape_unsupported',
				__( 'This saved booking schedule cannot be rescheduled safely. Edit it on the Add Booking page.', 'booking' ),
				array( 'status' => 409 )
			);
		}

		$selected_dates = isset( $saved['selected_dates'] ) ? (array) $saved['selected_dates'] : array();
		$time_mode      = isset( $saved['time_application'] ) ? sanitize_key( $saved['time_application'] ) : '';
		if ( ! empty( $appointment_snapshot ) ) {
			$shape = 'appointment';
		} elseif ( 'full_day' === $time_mode ) {
			$shape = 1 === count( $selected_dates )
				? 'single_full_day'
				: ( $this->dates_are_consecutive( $selected_dates ) ? 'continuous_full_day_range' : 'independent_full_days' );
		} elseif ( 'boundary' === $time_mode ) {
			$shape = 'continuous_boundary_interval';
		} elseif ( 'per_date' === $time_mode ) {
			$shape = 1 === count( $selected_dates )
				? 'single_timed_interval'
				: ( $this->dates_are_consecutive( $selected_dates ) ? 'recurrent_timed_intervals' : 'discontinuous_timed_intervals' );
		} else {
			return new WP_Error(
				'wpbc_booking_rescheduling_shape_unsupported',
				__( 'This saved booking schedule cannot be rescheduled safely. Edit it on the Add Booking page.', 'booking' ),
				array( 'status' => 409 )
			);
		}

		return array(
			'shape'              => $shape,
			'saved'              => $saved,
			'allowed_operations' => $this->get_allowed_operations( $shape ),
		);
	}

	/**
	 * Return operations supported for one server-classified saved shape.
	 *
	 * @param string $shape Stable saved-shape identifier.
	 *
	 * @return array<int,string> Allowed operations.
	 */
	private function get_allowed_operations( $shape ) {
		if ( 'appointment' === $shape ) {
			return array( 'shift', 'replace_dates' );
		}
		if (
			in_array(
				$shape,
				array(
					'single_timed_interval',
					'continuous_boundary_interval',
					'single_full_day',
					'continuous_full_day_range',
					'independent_full_days',
					'recurrent_timed_intervals',
					'discontinuous_timed_intervals',
				),
				true
			)
		) {
			return array( 'shift', 'resize_start', 'resize_end', 'replace_dates', 'change_resource' );
		}

		return array( 'shift', 'replace_dates', 'change_resource' );
	}

	/**
	 * Determine whether ordered dates are consecutive.
	 *
	 * @param array<int,string> $dates Ordered ISO dates.
	 *
	 * @return bool True when every date follows the preceding date.
	 */
	private function dates_are_consecutive( $dates ) {
		for ( $index = 1; $index < count( $dates ); $index++ ) {
			$previous = DateTimeImmutable::createFromFormat( '!Y-m-d', $dates[ $index - 1 ], new DateTimeZone( 'UTC' ) );
			$current  = DateTimeImmutable::createFromFormat( '!Y-m-d', $dates[ $index ], new DateTimeZone( 'UTC' ) );
			if ( ! $previous || ! $current || 1 !== (int) $previous->diff( $current )->format( '%r%a' ) ) {
				return false;
			}
		}

		return true;
	}
}
