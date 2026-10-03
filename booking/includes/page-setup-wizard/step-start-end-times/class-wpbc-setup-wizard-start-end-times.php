<?php
/**
 * Start and End Times proposal service for the Setup Wizard.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build, validate, and present reusable start-time and end-time choices.
 *
 * The saved DTO deliberately uses the same `HH:MM` values accepted by the
 * Form Builder `starttime` and `endtime` fields. This module does not mutate a
 * Booking Form; a later Booking Form step can apply these validated choices to
 * its selected template without coupling this editor to the wizard shell.
 */
final class WPBC_Setup_Wizard_Start_End_Times {

	const MAX_TIMES_PER_LIST = 288;
	const MAX_PAYLOAD_LENGTH  = 10000;
	const TIME_INCREMENT      = 5;

	/**
	 * Return a safe starter configuration for both time lists.
	 *
	 * @return array{start_times:string[],end_times:string[]} Starter choices.
	 */
	public function get_initial_start_end_times() {
		return array(
			'start_times' => $this->generate_time_values( '08:00', '12:30', 30 ),
			'end_times'   => $this->generate_time_values( '13:00', '17:30', 30 ),
		);
	}

	/**
	 * Build presentation data for the reusable time-list editor.
	 *
	 * @param array<string,mixed> $step_values Validated values for this module.
	 * @param string              $time_format Validated WordPress time format.
	 *
	 * @return array<string,mixed> Data-only template context.
	 */
	public function get_context( array $step_values, $time_format ) {
		$start_end_times = isset( $step_values['start_end_times'] ) && is_array( $step_values['start_end_times'] )
			? $step_values['start_end_times']
			: $this->get_initial_start_end_times();

		$time_options = $this->get_time_options( $time_format );

		return array(
			'values'              => $step_values,
			'start_end_times'     => $start_end_times,
			'time_options'        => $time_options,
			'draft_field_name'    => 'start_end_times',
			'draft_values'        => $start_end_times,
			'editor_title'        => __( 'Set start and end times', 'booking' ),
			'editor_description'  => __( 'Choose the start and end time options customers can use when booking.', 'booking' ),
			'validation_rule'     => 'end_after_start',
			'list_definitions'    => array(
				'start_times' => array(
					'title'            => __( 'Start times', 'booking' ),
					'description'      => __( 'Choices shown in the booking form.', 'booking' ),
					'list_label'       => __( 'Start times', 'booking' ),
					'clear_aria_label' => __( 'Clear Start times', 'booking' ),
					'clear_status'     => __( 'Start times cleared.', 'booking' ),
					'add_label'        => __( 'Add one time slot', 'booking' ),
					'generator_interval' => 30,
					'options'          => $time_options,
				),
				'end_times'   => array(
					'title'            => __( 'End times', 'booking' ),
					'description'      => __( 'Choices shown in the booking form.', 'booking' ),
					'list_label'       => __( 'End times', 'booking' ),
					'clear_aria_label' => __( 'Clear End times', 'booking' ),
					'clear_status'     => __( 'End times cleared.', 'booking' ),
					'add_label'        => __( 'Add one time slot', 'booking' ),
					'generator_interval' => 30,
					'options'          => $time_options,
				),
			),
			'copy_action'        => array(
				'source'      => 'start_times',
				'target'      => 'end_times',
				'label'       => __( 'Copy start times to end times', 'booking' ),
				'aria_label'  => __( 'Copy Start times to End times', 'booking' ),
				'status'      => __( 'Start times copied to End times.', 'booking' ),
			),
			'interval_options'    => $this->get_interval_options(),
			'max_times_per_list'  => self::MAX_TIMES_PER_LIST,
			'time_increment'      => self::TIME_INCREMENT,
		);
	}

	/**
	 * Validate one complete start/end time-choice DTO.
	 *
	 * Lists preserve the user's order because their order is also the future
	 * Form Builder option order. Duplicate values and values outside the shared
	 * five-minute precision are rejected instead of being silently rewritten.
	 *
	 * @param mixed $raw_start_end_times JSON transport string or stored array.
	 * @param bool  $require_complete    Whether both lists and a usable pair are required.
	 *
	 * @return array{start_times:string[],end_times:string[]}|WP_Error Normalized choices or an error.
	 */
	public function validate_start_end_times( $raw_start_end_times, $require_complete ) {
		if ( is_string( $raw_start_end_times ) ) {
			if ( strlen( $raw_start_end_times ) > self::MAX_PAYLOAD_LENGTH ) {
				return new WP_Error( 'wpbc_setup_wizard_start_end_times_too_large', __( 'The start and end time draft is too large.', 'booking' ) );
			}

			$raw_start_end_times = json_decode( $raw_start_end_times, true );
			if ( JSON_ERROR_NONE !== json_last_error() ) {
				return new WP_Error( 'wpbc_setup_wizard_start_end_times_invalid_json', __( 'The start and end time draft is invalid.', 'booking' ) );
			}
		}

		if ( ! is_array( $raw_start_end_times ) ) {
			return new WP_Error( 'wpbc_setup_wizard_start_end_times_invalid', __( 'Enter valid start and end time choices.', 'booking' ) );
		}

		if ( array_diff( array_keys( $raw_start_end_times ), array( 'start_times', 'end_times' ) ) ) {
			return new WP_Error( 'wpbc_setup_wizard_start_end_times_unknown_field', __( 'The start and end time draft contains an unsupported field.', 'booking' ) );
		}

		$start_times = $this->validate_time_list(
			isset( $raw_start_end_times['start_times'] ) ? $raw_start_end_times['start_times'] : array(),
			$require_complete,
			__( 'Add at least one start time.', 'booking' )
		);
		if ( is_wp_error( $start_times ) ) {
			return $start_times;
		}

		$end_times = $this->validate_time_list(
			isset( $raw_start_end_times['end_times'] ) ? $raw_start_end_times['end_times'] : array(),
			$require_complete,
			__( 'Add at least one end time.', 'booking' )
		);
		if ( is_wp_error( $end_times ) ) {
			return $end_times;
		}

		if ( $require_complete && ! $this->has_usable_time_pair( $start_times, $end_times ) ) {
			return new WP_Error( 'wpbc_setup_wizard_start_end_times_pair_invalid', __( 'Add an end time that is later than at least one start time.', 'booking' ) );
		}

		return array(
			'start_times' => $start_times,
			'end_times'   => $end_times,
		);
	}

	/**
	 * Generate inclusive `HH:MM` values for a bounded same-day range.
	 *
	 * @param string $start_time      First time in `HH:MM` format.
	 * @param string $end_time        Last time in `HH:MM` format.
	 * @param int    $interval_minutes Positive interval in minutes.
	 *
	 * @return string[] Ordered time values, or an empty array for invalid input.
	 */
	public function generate_time_values( $start_time, $end_time, $interval_minutes ) {
		$start_minutes    = $this->time_to_minutes( $start_time );
		$end_minutes      = $this->time_to_minutes( $end_time );
		$interval_minutes = absint( $interval_minutes );

		if (
			null === $start_minutes
			|| null === $end_minutes
			|| $end_minutes < $start_minutes
			|| self::TIME_INCREMENT > $interval_minutes
			|| 0 !== $interval_minutes % self::TIME_INCREMENT
		) {
			return array();
		}

		$time_values = array();
		for ( $minute = $start_minutes; $minute <= $end_minutes && count( $time_values ) < self::MAX_TIMES_PER_LIST; $minute += $interval_minutes ) {
			$time_values[] = sprintf( '%02d:%02d', (int) floor( $minute / 60 ), $minute % 60 );
		}

		return $time_values;
	}

	/**
	 * Return every time selectable by this editor.
	 *
	 * @param string $time_format Validated WordPress time format.
	 *
	 * @return array<int,array{value:string,label:string}> Ordered options.
	 */
	public function get_time_options( $time_format ) {
		$time_format = in_array( $time_format, array( 'g:i a', 'g:i A', 'H:i' ), true ) ? $time_format : 'H:i';
		$options     = array();

		for ( $minute = 0; $minute < 24 * 60; $minute += self::TIME_INCREMENT ) {
			$options[] = array(
				'value' => sprintf( '%02d:%02d', (int) floor( $minute / 60 ), $minute % 60 ),
				'label' => wp_date( $time_format, $minute * MINUTE_IN_SECONDS, new DateTimeZone( 'UTC' ) ),
			);
		}

		return $options;
	}

	/**
	 * Return the supported generator intervals.
	 *
	 * @return array<int,array{value:int,label:string}> Ordered interval choices.
	 */
	public function get_interval_options() {
		$intervals = array( 5, 10, 15, 20, 30, 60, 120 );
		$options   = array();

		foreach ( $intervals as $interval_minutes ) {
			/* translators: %d: Time interval in minutes. */
			$label = sprintf( _n( '%d minute', '%d minutes', $interval_minutes, 'booking' ), $interval_minutes );
			$options[] = array(
				'value' => $interval_minutes,
				'label' => $label,
			);
		}

		return $options;
	}

	/**
	 * Validate one ordered list of unique time values.
	 *
	 * @param mixed  $raw_time_list   Untrusted time-list candidate.
	 * @param bool   $require_complete Whether an empty list is invalid.
	 * @param string $required_message Translated list-specific required message.
	 *
	 * @return string[]|WP_Error Normalized list or an error.
	 */
	public function validate_time_list( $raw_time_list, $require_complete, $required_message ) {
		if ( ! is_array( $raw_time_list ) ) {
			return new WP_Error( 'wpbc_setup_wizard_time_list_invalid', __( 'Every time list must contain valid time choices.', 'booking' ) );
		}

		$raw_time_list = array_values( $raw_time_list );
		if ( count( $raw_time_list ) > self::MAX_TIMES_PER_LIST ) {
			/* translators: %d: Maximum number of time choices. */
			return new WP_Error( 'wpbc_setup_wizard_time_list_limit', sprintf( __( 'Add no more than %d choices to one time list.', 'booking' ), self::MAX_TIMES_PER_LIST ) );
		}

		$normalized_times = array();
		foreach ( $raw_time_list as $raw_time ) {
			$time_minutes = $this->time_to_minutes( $raw_time );
			if ( null === $time_minutes || 0 !== $time_minutes % self::TIME_INCREMENT ) {
				return new WP_Error( 'wpbc_setup_wizard_time_value_invalid', __( 'Use a valid five-minute time for every choice.', 'booking' ) );
			}

			$normalized_time = sprintf( '%02d:%02d', (int) floor( $time_minutes / 60 ), $time_minutes % 60 );
			if ( in_array( $normalized_time, $normalized_times, true ) ) {
				return new WP_Error( 'wpbc_setup_wizard_time_value_duplicate', __( 'The same time cannot appear twice in one list.', 'booking' ) );
			}
			$normalized_times[] = $normalized_time;
		}

		if ( $require_complete && empty( $normalized_times ) ) {
			return new WP_Error( 'wpbc_setup_wizard_time_list_required', $required_message );
		}

		return $normalized_times;
	}

	/**
	 * Determine whether at least one end choice follows one start choice.
	 *
	 * @param string[] $start_times Validated start times.
	 * @param string[] $end_times   Validated end times.
	 *
	 * @return bool True when the two lists can create a positive time range.
	 */
	private function has_usable_time_pair( array $start_times, array $end_times ) {
		if ( empty( $start_times ) || empty( $end_times ) ) {
			return false;
		}

		$start_minutes = array_map( array( $this, 'time_to_minutes' ), $start_times );
		$end_minutes   = array_map( array( $this, 'time_to_minutes' ), $end_times );

		return max( $end_minutes ) > min( $start_minutes );
	}

	/**
	 * Convert one exact `HH:MM` value to minutes after midnight.
	 *
	 * @param mixed $raw_time Untrusted time value.
	 *
	 * @return int|null Minutes after midnight, or null when invalid.
	 */
	public function time_to_minutes( $raw_time ) {
		if ( ! is_scalar( $raw_time ) || ! preg_match( '/^(?:[01]\d|2[0-3]):[0-5]\d$/', (string) $raw_time ) ) {
			return null;
		}

		list( $hour, $minute ) = array_map( 'intval', explode( ':', (string) $raw_time ) );

		return ( $hour * 60 ) + $minute;
	}
}
