<?php
/**
 * Start Time and Duration proposal service for the Setup Wizard.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build, validate, and present reusable start-time and duration choices.
 *
 * Values use the `HH:MM` storage contract accepted by Form Builder's
 * `starttime` and `durationtime` fields. The proposal remains checkpoint-only
 * until the Booking Form step applies it to the selected template.
 */
final class WPBC_Setup_Wizard_Start_Duration_Times {

	const MAX_TIMES_PER_LIST = 288;
	const MAX_PAYLOAD_LENGTH  = 10000;
	const TIME_INCREMENT      = 5;

	/** @var WPBC_Setup_Wizard_Start_End_Times */
	private $clock_times;

	/**
	 * Build the service around the shared clock-time helper.
	 *
	 * @param WPBC_Setup_Wizard_Start_End_Times|null $clock_times Optional helper for tests or composition.
	 */
	public function __construct( $clock_times = null ) {
		$this->clock_times = $clock_times instanceof WPBC_Setup_Wizard_Start_End_Times
			? $clock_times
			: new WPBC_Setup_Wizard_Start_End_Times();
	}

	/**
	 * Return starter choices aligned with the recommended Form Builder template.
	 *
	 * @return array{start_times:string[],duration_times:string[]} Starter choices.
	 */
	public function get_initial_start_duration_times() {
		return array(
			'start_times'    => $this->clock_times->generate_time_values( '10:00', '15:40', 20 ),
			'duration_times' => array( '00:20', '00:40', '01:00', '01:20', '01:40', '02:00' ),
		);
	}

	/**
	 * Build presentation data for the shared sortable choice-list editor.
	 *
	 * @param array<string,mixed> $step_values Validated values for this module.
	 * @param string              $time_format Validated WordPress time format.
	 *
	 * @return array<string,mixed> Data-only template context.
	 */
	public function get_context( array $step_values, $time_format ) {
		$start_duration_times = isset( $step_values['start_duration_times'] ) && is_array( $step_values['start_duration_times'] )
			? $step_values['start_duration_times']
			: $this->get_initial_start_duration_times();

		return array(
			'values'              => $step_values,
			'draft_field_name'    => 'start_duration_times',
			'draft_values'        => $start_duration_times,
			'editor_title'        => __( 'Set start and duration times', 'booking' ),
			'editor_description'  => __( 'Choose the start times and duration options customers can use when booking.', 'booking' ),
			'validation_rule'     => 'independent_lists',
			'list_definitions'    => array(
				'start_times'    => array(
					'title'            => __( 'Start times', 'booking' ),
					'description'      => __( 'Choices shown in the booking form.', 'booking' ),
					'list_label'       => __( 'Start times', 'booking' ),
					'clear_aria_label' => __( 'Clear Start times', 'booking' ),
					'clear_status'     => __( 'Start times cleared.', 'booking' ),
					'add_label'        => __( 'Add one time slot', 'booking' ),
					'generator_interval' => 20,
					'options'          => $this->clock_times->get_time_options( $time_format ),
				),
				'duration_times' => array(
					'title'            => __( 'Duration times', 'booking' ),
					'description'      => __( 'Duration choices shown in the booking form.', 'booking' ),
					'list_label'       => __( 'Duration times', 'booking' ),
					'clear_aria_label' => __( 'Clear Duration times', 'booking' ),
					'clear_status'     => __( 'Duration times cleared.', 'booking' ),
					'add_label'        => __( 'Add one duration', 'booking' ),
					'generator_interval' => 20,
					'options'          => $this->get_duration_options(),
				),
			),
			'copy_action'         => array(),
			'interval_options'    => $this->clock_times->get_interval_options(),
			'max_times_per_list'  => self::MAX_TIMES_PER_LIST,
			'time_increment'      => self::TIME_INCREMENT,
		);
	}

	/**
	 * Validate one complete start-time and duration-choice DTO.
	 *
	 * @param mixed $raw_start_duration_times JSON transport string or stored array.
	 * @param bool  $require_complete          Whether both lists are required.
	 *
	 * @return array{start_times:string[],duration_times:string[]}|WP_Error Normalized choices or an error.
	 */
	public function validate_start_duration_times( $raw_start_duration_times, $require_complete ) {
		if ( is_string( $raw_start_duration_times ) ) {
			if ( strlen( $raw_start_duration_times ) > self::MAX_PAYLOAD_LENGTH ) {
				return new WP_Error( 'wpbc_setup_wizard_start_duration_times_too_large', __( 'The start time and duration draft is too large.', 'booking' ) );
			}

			$raw_start_duration_times = json_decode( $raw_start_duration_times, true );
			if ( JSON_ERROR_NONE !== json_last_error() ) {
				return new WP_Error( 'wpbc_setup_wizard_start_duration_times_invalid_json', __( 'The start time and duration draft is invalid.', 'booking' ) );
			}
		}

		if ( ! is_array( $raw_start_duration_times ) ) {
			return new WP_Error( 'wpbc_setup_wizard_start_duration_times_invalid', __( 'Enter valid start time and duration choices.', 'booking' ) );
		}

		if ( array_diff( array_keys( $raw_start_duration_times ), array( 'start_times', 'duration_times' ) ) ) {
			return new WP_Error( 'wpbc_setup_wizard_start_duration_times_unknown_field', __( 'The start time and duration draft contains an unsupported field.', 'booking' ) );
		}

		$start_times = $this->clock_times->validate_time_list(
			isset( $raw_start_duration_times['start_times'] ) ? $raw_start_duration_times['start_times'] : array(),
			$require_complete,
			__( 'Add at least one start time.', 'booking' )
		);
		if ( is_wp_error( $start_times ) ) {
			return $start_times;
		}

		$duration_times = $this->validate_duration_list(
			isset( $raw_start_duration_times['duration_times'] ) ? $raw_start_duration_times['duration_times'] : array(),
			$require_complete
		);
		if ( is_wp_error( $duration_times ) ) {
			return $duration_times;
		}

		return array(
			'start_times'    => $start_times,
			'duration_times' => $duration_times,
		);
	}

	/**
	 * Return every supported positive duration in five-minute increments.
	 *
	 * @return array<int,array{value:string,label:string}> Ordered duration options.
	 */
	public function get_duration_options() {
		$options = array();
		for ( $minute = self::TIME_INCREMENT; $minute <= DAY_IN_SECONDS / MINUTE_IN_SECONDS; $minute += self::TIME_INCREMENT ) {
			$options[] = array(
				'value' => $this->minutes_to_duration( $minute ),
				'label' => $this->format_duration_label( $minute ),
			);
		}

		return $options;
	}

	/**
	 * Format one validated duration for customer-facing summaries and choices.
	 *
	 * @param int $duration_minutes Positive duration in minutes.
	 *
	 * @return string Localized duration label.
	 */
	public function format_duration_label( $duration_minutes ) {
		$duration_minutes = absint( $duration_minutes );
		$hours            = (int) floor( $duration_minutes / 60 );
		$minutes          = $duration_minutes % 60;

		if ( 0 < $hours && 0 < $minutes ) {
			/* translators: 1: Number of hours, 2: Number of minutes. */
			return sprintf( __( '%1$d hr %2$d min', 'booking' ), $hours, $minutes );
		}
		if ( 0 < $hours ) {
			/* translators: %d: Number of hours. */
			return sprintf( _n( '%d hour', '%d hours', $hours, 'booking' ), $hours );
		}

		/* translators: %d: Number of minutes. */
		return sprintf( _n( '%d minute', '%d minutes', $minutes, 'booking' ), $minutes );
	}

	/**
	 * Validate one ordered list of unique positive durations.
	 *
	 * @param mixed $raw_duration_list Untrusted duration-list candidate.
	 * @param bool  $require_complete  Whether an empty list is invalid.
	 *
	 * @return string[]|WP_Error Normalized durations or an error.
	 */
	private function validate_duration_list( $raw_duration_list, $require_complete ) {
		if ( ! is_array( $raw_duration_list ) ) {
			return new WP_Error( 'wpbc_setup_wizard_duration_list_invalid', __( 'The duration list must contain valid choices.', 'booking' ) );
		}

		$raw_duration_list = array_values( $raw_duration_list );
		if ( count( $raw_duration_list ) > self::MAX_TIMES_PER_LIST ) {
			/* translators: %d: Maximum number of duration choices. */
			return new WP_Error( 'wpbc_setup_wizard_duration_list_limit', sprintf( __( 'Add no more than %d duration choices.', 'booking' ), self::MAX_TIMES_PER_LIST ) );
		}

		$normalized_durations = array();
		foreach ( $raw_duration_list as $raw_duration ) {
			$duration_minutes = $this->duration_to_minutes( $raw_duration );
			if ( null === $duration_minutes || 0 !== $duration_minutes % self::TIME_INCREMENT ) {
				return new WP_Error( 'wpbc_setup_wizard_duration_value_invalid', __( 'Use a valid positive five-minute duration for every choice.', 'booking' ) );
			}

			$normalized_duration = $this->minutes_to_duration( $duration_minutes );
			if ( in_array( $normalized_duration, $normalized_durations, true ) ) {
				return new WP_Error( 'wpbc_setup_wizard_duration_value_duplicate', __( 'The same duration cannot appear twice in the list.', 'booking' ) );
			}
			$normalized_durations[] = $normalized_duration;
		}

		if ( $require_complete && empty( $normalized_durations ) ) {
			return new WP_Error( 'wpbc_setup_wizard_duration_list_required', __( 'Add at least one duration.', 'booking' ) );
		}

		return $normalized_durations;
	}

	/**
	 * Convert one exact duration value to minutes.
	 *
	 * @param mixed $raw_duration Untrusted `HH:MM` duration.
	 *
	 * @return int|null Positive duration up to 24 hours, or null when invalid.
	 */
	private function duration_to_minutes( $raw_duration ) {
		if ( ! is_scalar( $raw_duration ) || ! preg_match( '/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/', (string) $raw_duration ) ) {
			return null;
		}

		list( $hour, $minute ) = array_map( 'intval', explode( ':', (string) $raw_duration ) );
		$duration_minutes = ( $hour * 60 ) + $minute;

		return 0 < $duration_minutes ? $duration_minutes : null;
	}

	/**
	 * Convert minutes to the Form Builder `HH:MM` duration contract.
	 *
	 * @param int $duration_minutes Positive duration up to 24 hours.
	 *
	 * @return string Normalized duration value.
	 */
	private function minutes_to_duration( $duration_minutes ) {
		$duration_minutes = min( 24 * 60, max( self::TIME_INCREMENT, absint( $duration_minutes ) ) );

		return sprintf( '%02d:%02d', (int) floor( $duration_minutes / 60 ), $duration_minutes % 60 );
	}
}
