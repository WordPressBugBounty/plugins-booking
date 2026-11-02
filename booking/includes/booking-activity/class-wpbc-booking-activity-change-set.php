<?php
/**
 * Versioned privacy boundary for booking-detail activity changes.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize bounded field changes before they enter Activity storage or DTOs.
 *
 * The contract supports redacted booking-form changes, display labels from
 * bounded choice controls, and exact values for an explicit allow list of
 * non-form operational fields. It never accepts unrestricted exact values.
 */
final class WPBC_Booking_Activity_Change_Set {

	/** Current serialized contract version. */
	const VERSION = 1;

	/** Maximum field changes stored for one mutation. */
	const MAX_CHANGES = 25;

	/** Maximum values retained on either side of one bounded choice change. */
	const MAX_VALUES_PER_SIDE = 5;

	/** Maximum stored field-key length. */
	const MAX_FIELD_KEY_LENGTH = 190;

	/** Maximum stored label length. */
	const MAX_LABEL_LENGTH = 100;

	/** Maximum stored bounded-choice label length. */
	const MAX_VALUE_LENGTH = 100;

	/** Maximum formatted exact operational value length. */
	const MAX_EXACT_VALUE_LENGTH = 20000;

	/** Maximum accepted total-change count. */
	const MAX_TOTAL_CHANGES = 999;

	/**
	 * Normalize one candidate change set into the executable-free v1 contract.
	 *
	 * Unknown versions, malformed records, extra keys, and values attached to a
	 * redacted change are discarded. Exact values are accepted only for the
	 * closed operational-field allow list. The derived truncation flag is never
	 * trusted from callers.
	 *
	 * @param mixed $candidate_change_set Untrusted candidate contract.
	 *
	 * @return array<string,mixed> Safe bounded contract, or an empty array.
	 */
	public static function normalize( $candidate_change_set ) {
		if ( ! is_array( $candidate_change_set ) ) {
			return array();
		}
		$candidate_version = isset( $candidate_change_set['version'] ) ? $candidate_change_set['version'] : 0;
		if ( self::VERSION !== absint( $candidate_version ) ) {
			return array();
		}

		$candidate_changes = isset( $candidate_change_set['changes'] ) && is_array( $candidate_change_set['changes'] )
			? $candidate_change_set['changes']
			: array();
		$safe_changes      = array();
		$seen_field_keys   = array();

		foreach ( $candidate_changes as $candidate_change ) {
			if ( self::MAX_CHANGES <= count( $safe_changes ) ) {
				break;
			}
			if ( ! is_array( $candidate_change ) ) {
				continue;
			}

			$field_key = self::normalize_field_key( isset( $candidate_change['field_key'] ) ? $candidate_change['field_key'] : '' );
			$label     = self::normalize_text( isset( $candidate_change['label'] ) ? $candidate_change['label'] : '', self::MAX_LABEL_LENGTH );
			if ( '' === $field_key || '' === $label || isset( $seen_field_keys[ $field_key ] ) ) {
				continue;
			}

			$candidate_value_policy = isset( $candidate_change['value_policy'] ) ? sanitize_key( $candidate_change['value_policy'] ) : '';
			$value_policy           = 'redacted';
			if ( 'bounded_choice' === $candidate_value_policy ) {
				$value_policy = 'bounded_choice';
			} elseif ( 'exact_value' === $candidate_value_policy && self::is_exact_value_field( $field_key ) ) {
				$value_policy = 'exact_value';
			}
			$safe_change = array(
				'field_key'   => $field_key,
				'label'       => $label,
				'value_policy' => $value_policy,
			);
			if ( 'bounded_choice' === $value_policy ) {
				$before_result                  = self::normalize_values( isset( $candidate_change['before'] ) ? $candidate_change['before'] : array() );
				$after_result                   = self::normalize_values( isset( $candidate_change['after'] ) ? $candidate_change['after'] : array() );
				$safe_change['before']           = $before_result['values'];
				$safe_change['after']            = $after_result['values'];
				$previously_truncated            = ! empty( $candidate_change['values_truncated'] )
					&& ( self::MAX_VALUES_PER_SIDE === count( $safe_change['before'] ) || self::MAX_VALUES_PER_SIDE === count( $safe_change['after'] ) );
				$safe_change['values_truncated'] = $before_result['truncated'] || $after_result['truncated'] || $previously_truncated;
			} elseif ( 'exact_value' === $value_policy ) {
				$exact_before = self::normalize_booking_schedule( isset( $candidate_change['before'] ) ? $candidate_change['before'] : array() );
				$exact_after  = self::normalize_booking_schedule( isset( $candidate_change['after'] ) ? $candidate_change['after'] : array() );
				if ( empty( $exact_before ) || empty( $exact_after ) ) {
					$safe_change['value_policy'] = 'redacted';
				} else {
					$safe_change['before'] = $exact_before;
					$safe_change['after']  = $exact_after;
				}
			}

			$safe_changes[]                  = $safe_change;
			$seen_field_keys[ $field_key ] = true;
		}

		if ( empty( $safe_changes ) ) {
			return array();
		}

		$total_changes = isset( $candidate_change_set['total_changes'] ) ? absint( $candidate_change_set['total_changes'] ) : count( $safe_changes );
		$total_changes = min( self::MAX_TOTAL_CHANGES, max( count( $safe_changes ), $total_changes ) );

		return array(
			'version'       => self::VERSION,
			'total_changes' => $total_changes,
			'truncated'     => $total_changes > count( $safe_changes ),
			'changes'       => $safe_changes,
		);
	}

	/**
	 * Format one authoritative booking schedule for Activity presentation.
	 *
	 * The value contains every selected ISO date plus the canonical time mode
	 * and minute boundaries. Invalid or partial schedules fail closed so a
	 * producer cannot record a misleading partial before/after value.
	 *
	 * @param mixed $candidate_schedule Candidate authoritative schedule.
	 *
	 * @return string Exact bounded schedule description, or an empty string.
	 */
	public static function format_booking_schedule( $candidate_schedule ) {
		$safe_schedule = self::normalize_booking_schedule( $candidate_schedule );
		if ( empty( $safe_schedule ) ) {
			return '';
		}

		if ( 'full_day' === $safe_schedule['time_application'] ) {
			$time_description = __( 'Full days', 'booking' );
		} else {
			$time_description = 'boundary' === $safe_schedule['time_application']
				? sprintf(
					/* translators: 1: start time on the first selected date, 2: end time on the last selected date. */
					__( '%1$s on the first date to %2$s on the last date', 'booking' ),
					$safe_schedule['start_time'],
					$safe_schedule['end_time']
				)
				: sprintf(
					/* translators: 1: start time, 2: end time used on every selected date. */
					__( '%1$s to %2$s on each date', 'booking' ),
					$safe_schedule['start_time'],
					$safe_schedule['end_time']
				);
		}

		return self::normalize_text(
			sprintf(
				/* translators: 1: comma-separated ISO booking dates, 2: exact booking time description. */
				__( 'Dates: %1$s; Time: %2$s', 'booking' ),
				implode( ', ', $safe_schedule['selected_dates'] ),
				$time_description
			),
			self::MAX_EXACT_VALUE_LENGTH
		);
	}

	/**
	 * Normalize one exact booking schedule into the storage contract.
	 *
	 * Only canonical dates, the supported time-application identifier, and
	 * required minute boundaries survive. Browser-only proposal metadata,
	 * Resource IDs, labels, intervals, and unknown keys are discarded.
	 *
	 * @param mixed $candidate_schedule Candidate schedule.
	 *
	 * @return array<string,mixed> Canonical executable-free schedule, or empty.
	 */
	private static function normalize_booking_schedule( $candidate_schedule ) {
		if ( ! is_array( $candidate_schedule ) ) {
			return array();
		}

		$time_application = isset( $candidate_schedule['time_application'] ) ? sanitize_key( $candidate_schedule['time_application'] ) : '';
		if ( ! in_array( $time_application, array( 'full_day', 'boundary', 'per_date' ), true ) ) {
			return array();
		}

		$selected_dates = array();
		foreach ( isset( $candidate_schedule['selected_dates'] ) ? (array) $candidate_schedule['selected_dates'] : array() as $candidate_date ) {
			$candidate_date = is_scalar( $candidate_date ) ? (string) $candidate_date : '';
			if ( ! self::is_iso_date( $candidate_date ) ) {
				return array();
			}
			$selected_dates[] = $candidate_date;
		}
		$selected_dates = array_values( array_unique( $selected_dates ) );
		sort( $selected_dates, SORT_STRING );
		if ( empty( $selected_dates ) || 1095 < count( $selected_dates ) ) {
			return array();
		}

		$safe_schedule = array(
			'selected_dates'   => $selected_dates,
			'time_application' => $time_application,
		);
		if ( 'full_day' === $time_application ) {
			return $safe_schedule;
		}

		$start_time = isset( $candidate_schedule['start_time'] ) && self::is_hour_minute( $candidate_schedule['start_time'] )
			? (string) $candidate_schedule['start_time']
			: '';
		$end_time   = isset( $candidate_schedule['end_time'] ) && self::is_hour_minute( $candidate_schedule['end_time'] )
			? (string) $candidate_schedule['end_time']
			: '';
		if ( '' === $start_time || '' === $end_time ) {
			return array();
		}

		$safe_schedule['start_time'] = $start_time;
		$safe_schedule['end_time']   = $end_time;

		return $safe_schedule;
	}

	/**
	 * Normalize one historical booking-form field key.
	 *
	 * @param mixed $field_key Candidate field key.
	 *
	 * @return string Lowercase bounded key preserving supported separators.
	 */
	private static function normalize_field_key( $field_key ) {
		$field_key = strtolower( (string) $field_key );
		$field_key = preg_replace( '/[^a-z0-9:._-]/', '', $field_key );

		return substr( (string) $field_key, 0, self::MAX_FIELD_KEY_LENGTH );
	}

	/**
	 * Determine whether a field may retain exact operational values.
	 *
	 * Booking-form fields are intentionally absent. Dedicated cost, payment,
	 * Resource, status, locale, and read-state events already use their bounded
	 * typed payloads and do not need this change-set escape hatch.
	 *
	 * @param string $field_key Normalized field key.
	 *
	 * @return bool True only for an allow-listed non-form field.
	 */
	private static function is_exact_value_field( $field_key ) {
		return in_array( $field_key, array( 'booking_dates' ), true );
	}

	/**
	 * Validate one canonical ISO calendar date.
	 *
	 * @param mixed $candidate_date Candidate `Y-m-d` value.
	 *
	 * @return bool True for a real calendar date in canonical form.
	 */
	private static function is_iso_date( $candidate_date ) {
		if ( ! is_scalar( $candidate_date ) || 1 !== preg_match( '/^(\d{4})-(\d{2})-(\d{2})$/', (string) $candidate_date, $date_parts ) ) {
			return false;
		}

		return checkdate( (int) $date_parts[2], (int) $date_parts[3], (int) $date_parts[1] );
	}

	/**
	 * Validate one canonical 24-hour minute value.
	 *
	 * @param mixed $candidate_time Candidate `H:i` value.
	 *
	 * @return bool True for a canonical time from 00:00 through 23:59.
	 */
	private static function is_hour_minute( $candidate_time ) {
		return is_scalar( $candidate_time )
			&& 1 === preg_match( '/^(?:[01]\d|2[0-3]):[0-5]\d$/', (string) $candidate_time );
	}

	/**
	 * Normalize a bounded list of already-safe display labels.
	 *
	 * @param mixed $candidate_values Candidate scalar or value list.
	 *
	 * @return array{values:array<int,string>,truncated:bool} Safe unique labels and derived truncation state.
	 */
	private static function normalize_values( $candidate_values ) {
		$safe_values      = array();
		$values_truncated = false;
		foreach ( (array) $candidate_values as $candidate_value ) {
			if ( ! is_scalar( $candidate_value ) ) {
				continue;
			}
			$safe_value = self::normalize_text( $candidate_value, self::MAX_VALUE_LENGTH );
			if ( '' === $safe_value || in_array( $safe_value, $safe_values, true ) ) {
				continue;
			}
			if ( self::MAX_VALUES_PER_SIDE <= count( $safe_values ) ) {
				$values_truncated = true;
				break;
			}
			$safe_values[] = $safe_value;
		}

		return array(
			'values'    => $safe_values,
			'truncated' => $values_truncated,
		);
	}

	/**
	 * Normalize one plain-text label to a byte bound.
	 *
	 * @param mixed $candidate_text Candidate text.
	 * @param int   $maximum_length Maximum byte length.
	 *
	 * @return string Safe bounded plain text.
	 */
	private static function normalize_text( $candidate_text, $maximum_length ) {
		if ( ! is_scalar( $candidate_text ) ) {
			return '';
		}
		$safe_text = sanitize_text_field( (string) $candidate_text );
		if ( function_exists( 'mb_substr' ) ) {
			return mb_substr( $safe_text, 0, absint( $maximum_length ) );
		}

		return substr( $safe_text, 0, absint( $maximum_length ) );
	}
}
