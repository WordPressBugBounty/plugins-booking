<?php
/**
 * Booking Inspector scheduling-field policy.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Identify booking-form fields whose values define canonical booking time.
 *
 * These fields remain visible in Booking data, but only the Date Editor may
 * change their values because it updates availability rows and form storage as
 * one authoritative operation.
 *
 * @since 12.0.0
 */
final class WPBC_Booking_Inspector_Time_Field_Policy {

	/**
	 * Return the scheduling role represented by one internal field projection.
	 *
	 * Source type is authoritative. The narrow field-key fallback preserves old
	 * booking snapshots that predate semantic source-type storage.
	 *
	 * @param array<string,mixed> $field Internal booking-form field projection.
	 *
	 * @return string One of `range`, `start`, `end`, `duration`, or an empty string.
	 */
	public static function get_schedule_role( $field ) {
		if ( ! is_array( $field ) ) {
			return '';
		}

		$source_type = isset( $field['source_type'] ) ? sanitize_key( (string) $field['source_type'] ) : '';
		$field_key   = isset( $field['key'] ) ? sanitize_key( (string) $field['key'] ) : '';
		$source_roles = array(
			'rangetime'         => 'range',
			'season_rangetime'  => 'range',
			'time_slots'        => 'range',
			'weekday_rangetime' => 'range',
			'starttime'         => 'start',
			'weekday_starttime' => 'start',
			'endtime'           => 'end',
			'durationtime'      => 'duration',
		);
		if ( isset( $source_roles[ $source_type ] ) ) {
			return $source_roles[ $source_type ];
		}

		$key_roles = array(
			'rangetime'    => 'range',
			'starttime'    => 'start',
			'endtime'      => 'end',
			'durationtime' => 'duration',
		);

		return isset( $key_roles[ $field_key ] ) ? $key_roles[ $field_key ] : '';
	}

	/**
	 * Determine whether one field must be changed through the Date Editor.
	 *
	 * @param array<string,mixed> $field Internal booking-form field projection.
	 *
	 * @return bool True when the field changes canonical booking time.
	 */
	public static function is_schedule_field( $field ) {
		return '' !== self::get_schedule_role( $field );
	}
}
