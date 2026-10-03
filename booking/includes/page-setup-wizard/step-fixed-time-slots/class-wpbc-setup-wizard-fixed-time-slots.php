<?php
/**
 * Fixed Time Slots proposal service for the Setup Wizard.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build, validate, generate, and present ordered fixed time-slot ranges.
 *
 * Each slot is an explicit same-day start/end pair. This preserves the order
 * selected by the customer and maps directly to Form Builder's `rangetime`
 * option contract without coupling this reusable editor to Form Builder.
 */
final class WPBC_Setup_Wizard_Fixed_Time_Slots {

	const MAX_TIME_SLOTS     = 288;
	const MAX_PAYLOAD_LENGTH = 20000;
	const TIME_INCREMENT     = 5;

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
	 * Return starter slots aligned with the preferred two-column template.
	 *
	 * @return array{time_slots:array<int,array{start_time:string,end_time:string}>} Starter slots.
	 */
	public function get_initial_fixed_time_slots() {
		return array(
			'time_slots' => $this->generate_time_slots( '10:00', '14:30', 30, 30 ),
		);
	}

	/**
	 * Build presentation data for the dedicated fixed-slot editor.
	 *
	 * @param array<string,mixed> $step_values Validated values for this module.
	 * @param string              $time_format Validated WordPress time format.
	 *
	 * @return array<string,mixed> Data-only template context.
	 */
	public function get_context( array $step_values, $time_format ) {
		$fixed_time_slots = isset( $step_values['fixed_time_slots'] ) && is_array( $step_values['fixed_time_slots'] )
			? $step_values['fixed_time_slots']
			: $this->get_initial_fixed_time_slots();

		return array(
			'values'                   => $step_values,
			'draft_field_name'         => 'fixed_time_slots',
			'draft_values'             => $fixed_time_slots,
			'editor_title'             => __( 'Set fixed time slots', 'booking' ),
			'editor_description'       => __( 'Choose the fixed time slot options customers can use when booking.', 'booking' ),
			'list_title'               => __( 'Fixed time slots', 'booking' ),
			'list_description'         => __( 'Choices shown in the booking form.', 'booking' ),
			'list_label'               => __( 'Fixed time slots', 'booking' ),
			'time_options'             => $this->clock_times->get_time_options( $time_format ),
			'end_time_options'         => $this->get_end_time_options( $time_format ),
			'interval_options'         => $this->clock_times->get_interval_options(),
			'duration_options'         => $this->get_duration_options(),
			'generator_from'           => '10:00',
			'generator_to'             => '14:30',
			'generator_interval'       => 30,
			'generator_duration'       => 30,
			'max_time_slots'           => self::MAX_TIME_SLOTS,
			'time_increment'           => self::TIME_INCREMENT,
		);
	}

	/**
	 * Validate one complete fixed-slot DTO.
	 *
	 * @param mixed $raw_fixed_time_slots JSON transport string or stored array.
	 * @param bool  $require_complete      Whether at least one slot is required.
	 *
	 * @return array{time_slots:array<int,array{start_time:string,end_time:string}>}|WP_Error Normalized slots or an error.
	 */
	public function validate_fixed_time_slots( $raw_fixed_time_slots, $require_complete ) {
		if ( is_string( $raw_fixed_time_slots ) ) {
			if ( strlen( $raw_fixed_time_slots ) > self::MAX_PAYLOAD_LENGTH ) {
				return new WP_Error( 'wpbc_setup_wizard_fixed_time_slots_too_large', __( 'The fixed time slots draft is too large.', 'booking' ) );
			}

			$raw_fixed_time_slots = json_decode( $raw_fixed_time_slots, true );
			if ( JSON_ERROR_NONE !== json_last_error() ) {
				return new WP_Error( 'wpbc_setup_wizard_fixed_time_slots_invalid_json', __( 'The fixed time slots draft is invalid.', 'booking' ) );
			}
		}

		if ( ! is_array( $raw_fixed_time_slots ) ) {
			return new WP_Error( 'wpbc_setup_wizard_fixed_time_slots_invalid', __( 'Enter valid fixed time slots.', 'booking' ) );
		}

		if ( array_diff( array_keys( $raw_fixed_time_slots ), array( 'time_slots' ) ) ) {
			return new WP_Error( 'wpbc_setup_wizard_fixed_time_slots_unknown_field', __( 'The fixed time slots draft contains an unsupported field.', 'booking' ) );
		}

		$raw_slots = isset( $raw_fixed_time_slots['time_slots'] ) ? $raw_fixed_time_slots['time_slots'] : array();
		if ( ! is_array( $raw_slots ) ) {
			return new WP_Error( 'wpbc_setup_wizard_fixed_time_slots_list_invalid', __( 'The fixed time slot list must contain valid ranges.', 'booking' ) );
		}

		$raw_slots = array_values( $raw_slots );
		if ( count( $raw_slots ) > self::MAX_TIME_SLOTS ) {
			/* translators: %d: Maximum number of fixed time slots. */
			return new WP_Error( 'wpbc_setup_wizard_fixed_time_slots_limit', sprintf( __( 'Add no more than %d fixed time slots.', 'booking' ), self::MAX_TIME_SLOTS ) );
		}

		$normalized_slots = array();
		$seen_slots       = array();
		foreach ( $raw_slots as $raw_slot ) {
			if ( ! is_array( $raw_slot ) || array_diff( array_keys( $raw_slot ), array( 'start_time', 'end_time' ) ) ) {
				return new WP_Error( 'wpbc_setup_wizard_fixed_time_slot_invalid', __( 'Every fixed time slot must contain only a start time and an end time.', 'booking' ) );
			}

			$start_time    = isset( $raw_slot['start_time'] ) && is_scalar( $raw_slot['start_time'] ) ? (string) $raw_slot['start_time'] : '';
			$end_time      = isset( $raw_slot['end_time'] ) && is_scalar( $raw_slot['end_time'] ) ? (string) $raw_slot['end_time'] : '';
			$start_minutes = $this->clock_times->time_to_minutes( $start_time );
			$end_minutes   = $this->end_time_to_minutes( $end_time );

			if (
				null === $start_minutes
				|| null === $end_minutes
				|| 0 !== $start_minutes % self::TIME_INCREMENT
				|| 0 !== $end_minutes % self::TIME_INCREMENT
				|| $end_minutes <= $start_minutes
			) {
				return new WP_Error( 'wpbc_setup_wizard_fixed_time_slot_range_invalid', __( 'Every fixed time slot must end after it starts and use five-minute values.', 'booking' ) );
			}

			$normalized_start = $this->minutes_to_time( $start_minutes );
			$normalized_end   = $this->minutes_to_time( $end_minutes );
			$slot_key         = $normalized_start . ' - ' . $normalized_end;
			if ( isset( $seen_slots[ $slot_key ] ) ) {
				return new WP_Error( 'wpbc_setup_wizard_fixed_time_slot_duplicate', __( 'The same fixed time slot cannot appear twice.', 'booking' ) );
			}

			$seen_slots[ $slot_key ] = true;
			$normalized_slots[]      = array(
				'start_time' => $normalized_start,
				'end_time'   => $normalized_end,
			);
		}

		if ( $require_complete && empty( $normalized_slots ) ) {
			return new WP_Error( 'wpbc_setup_wizard_fixed_time_slots_required', __( 'Add at least one fixed time slot.', 'booking' ) );
		}

		return array( 'time_slots' => $normalized_slots );
	}

	/**
	 * Generate fixed ranges with independent spacing and duration controls.
	 *
	 * The `to` value is the last start time, matching the editor labels and
	 * allowing overlapping slots when duration is greater than spacing.
	 *
	 * @param string $from_time       First start time in `HH:MM` format.
	 * @param string $to_time         Last start time in `HH:MM` format.
	 * @param int    $spacing_minutes Positive distance between slot starts.
	 * @param int    $duration_minutes Positive length of each slot.
	 *
	 * @return array<int,array{start_time:string,end_time:string}> Generated slots, or an empty array for invalid input.
	 */
	public function generate_time_slots( $from_time, $to_time, $spacing_minutes, $duration_minutes ) {
		$from_minutes     = $this->clock_times->time_to_minutes( $from_time );
		$to_minutes       = $this->clock_times->time_to_minutes( $to_time );
		$spacing_minutes  = absint( $spacing_minutes );
		$duration_minutes = absint( $duration_minutes );

		if (
			null === $from_minutes
			|| null === $to_minutes
			|| $to_minutes < $from_minutes
			|| self::TIME_INCREMENT > $spacing_minutes
			|| self::TIME_INCREMENT > $duration_minutes
			|| 0 !== $spacing_minutes % self::TIME_INCREMENT
			|| 0 !== $duration_minutes % self::TIME_INCREMENT
			|| $to_minutes + $duration_minutes > 24 * 60
		) {
			return array();
		}

		$time_slots = array();
		for ( $start_minutes = $from_minutes; $start_minutes <= $to_minutes && count( $time_slots ) < self::MAX_TIME_SLOTS; $start_minutes += $spacing_minutes ) {
			$end_minutes = $start_minutes + $duration_minutes;
			if ( 24 * 60 < $end_minutes ) {
				break;
			}
			$time_slots[] = array(
				'start_time' => $this->minutes_to_time( $start_minutes ),
				'end_time'   => $this->minutes_to_time( $end_minutes ),
			);
		}

		return $time_slots;
	}

	/**
	 * Convert legacy parallel Start/End lists to explicit fixed-slot pairs.
	 *
	 * @param mixed $start_times Legacy ordered start-time list.
	 * @param mixed $end_times   Legacy ordered end-time list.
	 *
	 * @return array{time_slots:array<int,array{start_time:string,end_time:string}>}|WP_Error Normalized pairs or an error.
	 */
	public function create_slots_from_time_lists( $start_times, $end_times ) {
		if ( ! is_array( $start_times ) || ! is_array( $end_times ) || count( $start_times ) !== count( $end_times ) ) {
			return new WP_Error( 'wpbc_setup_wizard_fixed_time_slots_legacy_lists_invalid', __( 'The previous time choices cannot be converted to fixed time slots.', 'booking' ) );
		}

		$time_slots = array();
		foreach ( array_values( $start_times ) as $slot_index => $start_time ) {
			$time_slots[] = array(
				'start_time' => $start_time,
				'end_time'   => $end_times[ $slot_index ],
			);
		}

		return $this->validate_fixed_time_slots( array( 'time_slots' => $time_slots ), true );
	}

	/**
	 * Return the generator duration choices.
	 *
	 * @return array<int,array{value:int,label:string}> Ordered duration choices.
	 */
	public function get_duration_options() {
		$durations = array( 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240 );
		$options   = array();

		foreach ( $durations as $duration_minutes ) {
			/* translators: %d: Slot duration in minutes. */
			$label = sprintf( _n( '%d minute', '%d minutes', $duration_minutes, 'booking' ), $duration_minutes );
			$options[] = array(
				'value' => $duration_minutes,
				'label' => $label,
			);
		}

		return $options;
	}

	/**
	 * Format one validated clock value for a fixed-slot label.
	 *
	 * @param string $time_value Validated `HH:MM` time, including `24:00` for an end value.
	 * @param string $time_format Validated WordPress time format.
	 *
	 * @return string Localized display label.
	 */
	public function format_time_label( $time_value, $time_format ) {
		$time_format = in_array( $time_format, array( 'g:i a', 'g:i A', 'H:i' ), true ) ? $time_format : 'H:i';
		if ( '24:00' === $time_value ) {
			if ( 'H:i' === $time_format ) {
				return '24:00';
			}

			return sprintf(
				/* translators: %s: Midnight formatted in the site's time format. */
				__( '%s (next day)', 'booking' ),
				wp_date( $time_format, 0, new DateTimeZone( 'UTC' ) )
			);
		}

		$time_minutes = $this->clock_times->time_to_minutes( $time_value );
		if ( null === $time_minutes ) {
			return '';
		}

		return wp_date( $time_format, $time_minutes * MINUTE_IN_SECONDS, new DateTimeZone( 'UTC' ) );
	}

	/**
	 * Return all supported fixed-slot end values, including day-end `24:00`.
	 *
	 * @param string $time_format Validated WordPress time format.
	 *
	 * @return array<int,array{value:string,label:string}> Ordered end-time options.
	 */
	private function get_end_time_options( $time_format ) {
		$options   = $this->clock_times->get_time_options( $time_format );
		$options[] = array(
			'value' => '24:00',
			'label' => $this->format_time_label( '24:00', $time_format ),
		);

		return $options;
	}

	/**
	 * Convert a fixed-slot end value to minutes after day start.
	 *
	 * @param mixed $raw_time Untrusted end-time value.
	 *
	 * @return int|null Minutes from day start, including 1440, or null.
	 */
	private function end_time_to_minutes( $raw_time ) {
		if ( '24:00' === $raw_time ) {
			return 24 * 60;
		}

		return $this->clock_times->time_to_minutes( $raw_time );
	}

	/**
	 * Convert bounded minutes to a normalized clock value.
	 *
	 * @param int $minutes Minutes from day start, from zero through 1440.
	 *
	 * @return string Normalized clock value.
	 */
	private function minutes_to_time( $minutes ) {
		$minutes = min( 24 * 60, max( 0, (int) $minutes ) );

		return sprintf( '%02d:%02d', (int) floor( $minutes / 60 ), $minutes % 60 );
	}
}
