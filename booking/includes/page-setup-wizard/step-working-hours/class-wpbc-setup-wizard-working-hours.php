<?php
/**
 * Working Hours draft integration for the modular Setup Wizard Working Hours step.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Read, present, and validate a progressively saved Working Time schedule.
 *
 * The DTO intentionally matches the canonical weekday interval shape used by
 * `booking_working_time_rules`, while excluding resource-specific overrides.
 * This class never updates canonical Working Time or unavailable weekdays.
 */
final class WPBC_Setup_Wizard_Working_Hours {

	const MAX_INTERVALS_PER_DAY = 8;
	const MAX_PAYLOAD_LENGTH     = 50000;
	const TIME_INCREMENT_SECONDS = 1800;

	/**
	 * Return the template context for the Working Hours step.
	 *
	 * @param array<string,mixed> $step_values Validated values for this step.
	 * @param string              $time_format Validated WordPress time format.
	 *
	 * @return array<string,mixed> Presentation-only schedule editor context.
	 */
	public function get_context( array $step_values, $time_format ) {
		$working_hours = isset( $step_values['working_hours'] ) && is_array( $step_values['working_hours'] )
			? $step_values['working_hours']
			: $this->get_initial_working_hours();

		return array(
			'values'                => $step_values,
			'working_hours'         => $working_hours,
			'weekdays'              => $this->get_weekday_records(),
			'time_options'          => $this->get_time_options( $working_hours, $time_format ),
			'max_intervals_per_day' => self::MAX_INTERVALS_PER_DAY,
		);
	}

	/**
	 * Load the authorized canonical default schedule or a safe starter proposal.
	 *
	 * The released General Availability page restricts this global setting to
	 * its configured capability and to the MultiUser super administrator. The
	 * wizard preserves that read boundary instead of exposing the schedule to a
	 * regular MultiUser account.
	 *
	 * @return array{enabled:string,weekdays:array<int,array<int,array{start_second:int,end_second:int}>>} Working Hours DTO.
	 */
	public function get_initial_working_hours() {
		$weekdays = $this->get_starter_weekdays();
		$enabled  = 'On';

		if ( $this->current_user_can_manage() && function_exists( 'wpbc_working_time__get_settings' ) ) {
			$settings = wpbc_working_time__get_settings();
			if ( isset( $settings['enabled'] ) && in_array( $settings['enabled'], array( 'On', 'Off' ), true ) ) {
				$enabled = $settings['enabled'];
			}
			if ( isset( $settings['default']['weekdays'] ) && is_array( $settings['default']['weekdays'] ) ) {
				$weekdays = $settings['default']['weekdays'];
			}
		}

		return array(
			'enabled'  => $enabled,
			'weekdays' => $this->normalize_weekdays_for_draft( $weekdays ),
		);
	}

	/**
	 * Validate the complete Working Hours proposal from one draft field.
	 *
	 * Distinct intervals are sorted and may touch at a boundary, but duplicates
	 * and overlaps are rejected because they create an ambiguous setup review.
	 *
	 * @param mixed $raw_working_hours JSON transport string or stored array.
	 * @param bool  $require_complete  Whether at least one interval is required.
	 *
	 * @return array<string,mixed>|WP_Error Normalized schedule or an error.
	 */
	public function validate_working_hours( $raw_working_hours, $require_complete ) {
		if ( is_string( $raw_working_hours ) ) {
			if ( strlen( $raw_working_hours ) > self::MAX_PAYLOAD_LENGTH ) {
				return new WP_Error( 'wpbc_setup_wizard_working_hours_too_large', __( 'The Working Hours draft is too large.', 'booking' ) );
			}

			$raw_working_hours = json_decode( $raw_working_hours, true );
			if ( JSON_ERROR_NONE !== json_last_error() ) {
				return new WP_Error( 'wpbc_setup_wizard_working_hours_invalid_json', __( 'The Working Hours draft is invalid.', 'booking' ) );
			}
		}

		if ( ! is_array( $raw_working_hours ) ) {
			return new WP_Error( 'wpbc_setup_wizard_working_hours_invalid', __( 'Enter valid Working Hours.', 'booking' ) );
		}

		if ( array_diff( array_keys( $raw_working_hours ), array( 'enabled', 'weekdays' ) ) ) {
			return new WP_Error( 'wpbc_setup_wizard_working_hours_unknown_field', __( 'The Working Hours draft contains an unsupported field.', 'booking' ) );
		}

		$enabled = isset( $raw_working_hours['enabled'] ) && is_scalar( $raw_working_hours['enabled'] )
			? (string) $raw_working_hours['enabled']
			: 'On';
		if ( ! in_array( $enabled, array( 'On', 'Off' ), true ) ) {
			return new WP_Error( 'wpbc_setup_wizard_working_hours_enabled_invalid', __( 'The Working Hours draft has an invalid status.', 'booking' ) );
		}

		$raw_weekdays = isset( $raw_working_hours['weekdays'] ) && is_array( $raw_working_hours['weekdays'] )
			? $raw_working_hours['weekdays']
			: array();

		foreach ( array_keys( $raw_weekdays ) as $day_key ) {
			if ( ! preg_match( '/^[0-6]$/', (string) $day_key ) ) {
				return new WP_Error( 'wpbc_setup_wizard_working_hours_day_invalid', __( 'The Working Hours draft contains an invalid weekday.', 'booking' ) );
			}
		}

		$normalized_weekdays = array();
		$interval_count      = 0;

		for ( $day_number = 0; $day_number <= 6; $day_number++ ) {
			$raw_intervals = isset( $raw_weekdays[ $day_number ] ) && is_array( $raw_weekdays[ $day_number ] )
				? array_values( $raw_weekdays[ $day_number ] )
				: array();

			if ( count( $raw_intervals ) > self::MAX_INTERVALS_PER_DAY ) {
				return new WP_Error(
					'wpbc_setup_wizard_working_hours_interval_limit',
					/* translators: %d: Maximum intervals per weekday. */
					sprintf( __( 'Add no more than %d working intervals to one day.', 'booking' ), self::MAX_INTERVALS_PER_DAY )
				);
			}

			$normalized_intervals = array();
			foreach ( $raw_intervals as $raw_interval ) {
				$normalized_interval = $this->validate_interval( $raw_interval );
				if ( is_wp_error( $normalized_interval ) ) {
					return $normalized_interval;
				}
				$normalized_intervals[] = $normalized_interval;
			}

			usort( $normalized_intervals, array( $this, 'compare_intervals' ) );
			$previous_end = -1;
			foreach ( $normalized_intervals as $normalized_interval ) {
				if ( $normalized_interval['start_second'] < $previous_end ) {
					return new WP_Error( 'wpbc_setup_wizard_working_hours_overlap', __( 'Working intervals on the same day cannot overlap or repeat.', 'booking' ) );
				}
				$previous_end = $normalized_interval['end_second'];
			}

			$normalized_weekdays[ $day_number ] = $normalized_intervals;
			$interval_count                    += count( $normalized_intervals );
		}

		if ( $require_complete && 'On' === $enabled && 0 === $interval_count ) {
			return new WP_Error( 'wpbc_setup_wizard_working_hours_required', __( 'Enable at least one weekday and add its working hours.', 'booking' ) );
		}

		return array(
			'enabled'  => $enabled,
			'weekdays' => $normalized_weekdays,
		);
	}

	/**
	 * Validate one canonical interval-shaped draft record.
	 *
	 * @param mixed $raw_interval Untrusted interval candidate.
	 *
	 * @return array{start_second:int,end_second:int}|WP_Error Normalized interval or an error.
	 */
	private function validate_interval( $raw_interval ) {
		if ( ! is_array( $raw_interval ) || array_diff( array_keys( $raw_interval ), array( 'start_second', 'end_second' ) ) ) {
			return new WP_Error( 'wpbc_setup_wizard_working_hours_interval_invalid', __( 'Enter a valid start and end time for every working interval.', 'booking' ) );
		}

		$start_second = $this->validate_second( isset( $raw_interval['start_second'] ) ? $raw_interval['start_second'] : null );
		$end_second   = $this->validate_second( isset( $raw_interval['end_second'] ) ? $raw_interval['end_second'] : null );

		if ( null === $start_second || null === $end_second || $start_second >= $end_second ) {
			return new WP_Error( 'wpbc_setup_wizard_working_hours_interval_invalid', __( 'Every working interval must end after it starts.', 'booking' ) );
		}

		return array(
			'start_second' => $start_second,
			'end_second'   => $end_second,
		);
	}

	/**
	 * Normalize a minute-aligned second value within one day.
	 *
	 * @param mixed $raw_second Untrusted second value.
	 *
	 * @return int|null Normalized value, or null when invalid.
	 */
	private function validate_second( $raw_second ) {
		if ( ! is_scalar( $raw_second ) || ! preg_match( '/^\d+$/', (string) $raw_second ) ) {
			return null;
		}

		$second = absint( $raw_second );
		if ( DAY_IN_SECONDS < $second || 0 !== $second % MINUTE_IN_SECONDS ) {
			return null;
		}

		return $second;
	}

	/**
	 * Compare two Working Time intervals by start and then end.
	 *
	 * @param array<string,int> $first_interval  First interval.
	 * @param array<string,int> $second_interval Second interval.
	 *
	 * @return int Comparison result for `usort()`.
	 */
	private function compare_intervals( $first_interval, $second_interval ) {
		if ( $first_interval['start_second'] === $second_interval['start_second'] ) {
			return $first_interval['end_second'] - $second_interval['end_second'];
		}

		return $first_interval['start_second'] - $second_interval['start_second'];
	}

	/**
	 * Keep a canonical weekday array bounded and JSON-safe for the draft UI.
	 *
	 * @param mixed $weekdays Canonical weekday interval candidate.
	 *
	 * @return array<int,array<int,array{start_second:int,end_second:int}>> Normalized weekdays.
	 */
	private function normalize_weekdays_for_draft( $weekdays ) {
		$normalized_weekdays = array();

		for ( $day_number = 0; $day_number <= 6; $day_number++ ) {
			$normalized_weekdays[ $day_number ] = array();
			$day_intervals = isset( $weekdays[ $day_number ] ) && is_array( $weekdays[ $day_number ] )
				? array_slice( $weekdays[ $day_number ], 0, self::MAX_INTERVALS_PER_DAY )
				: array();

			foreach ( $day_intervals as $day_interval ) {
				$normalized_interval = $this->validate_interval( $day_interval );
				if ( ! is_wp_error( $normalized_interval ) ) {
					$normalized_weekdays[ $day_number ][] = $normalized_interval;
				}
			}

			usort( $normalized_weekdays[ $day_number ], array( $this, 'compare_intervals' ) );
		}

		return $normalized_weekdays;
	}

	/**
	 * Return the safe proposal shown when canonical Working Time cannot be read.
	 *
	 * @return array<int,array<int,array{start_second:int,end_second:int}>> Starter weekdays.
	 */
	private function get_starter_weekdays() {
		$weekdays    = array_fill( 0, 7, array() );
		$weekdays[1] = array(
			array( 'start_second' => 9 * HOUR_IN_SECONDS, 'end_second' => 12 * HOUR_IN_SECONDS ),
			array( 'start_second' => 13 * HOUR_IN_SECONDS, 'end_second' => 17 * HOUR_IN_SECONDS ),
		);

		for ( $day_number = 2; $day_number <= 5; $day_number++ ) {
			$weekdays[ $day_number ][] = array( 'start_second' => 9 * HOUR_IN_SECONDS, 'end_second' => 17 * HOUR_IN_SECONDS );
		}

		$weekdays[6][] = array( 'start_second' => 10 * HOUR_IN_SECONDS, 'end_second' => 14 * HOUR_IN_SECONDS );

		return $weekdays;
	}

	/**
	 * Return Monday-through-Sunday labels without changing storage day numbers.
	 *
	 * @return array<int,array{day_number:int,label:string}> Weekday presentation records.
	 */
	private function get_weekday_records() {
		return array(
			array( 'day_number' => 1, 'label' => __( 'Monday', 'booking' ) ),
			array( 'day_number' => 2, 'label' => __( 'Tuesday', 'booking' ) ),
			array( 'day_number' => 3, 'label' => __( 'Wednesday', 'booking' ) ),
			array( 'day_number' => 4, 'label' => __( 'Thursday', 'booking' ) ),
			array( 'day_number' => 5, 'label' => __( 'Friday', 'booking' ) ),
			array( 'day_number' => 6, 'label' => __( 'Saturday', 'booking' ) ),
			array( 'day_number' => 0, 'label' => __( 'Sunday', 'booking' ) ),
		);
	}

	/**
	 * Return 30-minute choices plus any minute-aligned canonical endpoints.
	 *
	 * @param array<string,mixed> $working_hours Current Working Hours DTO.
	 * @param string              $time_format   Validated WordPress time format.
	 *
	 * @return array<int,array{value:int,label:string}> Ordered time options.
	 */
	private function get_time_options( array $working_hours, $time_format ) {
		$time_format = in_array( $time_format, array( 'g:i a', 'g:i A', 'H:i' ), true ) ? $time_format : 'H:i';
		$seconds     = array();

		for ( $second = 0; $second <= DAY_IN_SECONDS; $second += self::TIME_INCREMENT_SECONDS ) {
			$seconds[ $second ] = true;
		}

		if ( isset( $working_hours['weekdays'] ) && is_array( $working_hours['weekdays'] ) ) {
			foreach ( $working_hours['weekdays'] as $day_intervals ) {
				foreach ( (array) $day_intervals as $day_interval ) {
					if ( isset( $day_interval['start_second'] ) ) {
						$seconds[ absint( $day_interval['start_second'] ) ] = true;
					}
					if ( isset( $day_interval['end_second'] ) ) {
						$seconds[ absint( $day_interval['end_second'] ) ] = true;
					}
				}
			}
		}

		ksort( $seconds, SORT_NUMERIC );
		$time_options = array();
		foreach ( array_keys( $seconds ) as $second ) {
			$second = min( DAY_IN_SECONDS, absint( $second ) );
			$label  = DAY_IN_SECONDS === $second
				? __( '24:00', 'booking' )
				: wp_date( $time_format, $second, new DateTimeZone( 'UTC' ) );
			$time_options[] = array(
				'value' => $second,
				'label' => $label,
			);
		}

		return $time_options;
	}

	/**
	 * Check the released General Availability read boundary.
	 *
	 * @return bool True when the current user may read global Working Time.
	 */
	public function current_user_can_manage() {
		if ( function_exists( 'wpbc_is_mu_user_can_be_here' ) && ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) ) {
			return false;
		}

		$capability = function_exists( 'wpbc_availability_general__get_manage_cap' )
			? wpbc_availability_general__get_manage_cap()
			: 'manage_options';

		return current_user_can( $capability );
	}
}
