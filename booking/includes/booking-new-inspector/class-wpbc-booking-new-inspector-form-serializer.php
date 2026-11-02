<?php
/**
 * Canonical Booking Form serializer for Add New Booking Inspector.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Serializes only the exact normalized output of the server validator.
 *
 * The output preserves the released `type^name^value~...` storage contract,
 * Resource suffixes, array suffixes, and generated `*_val` display companions.
 * It can add the exact schedule-owned Booking Form records when a normalized,
 * server-reviewed schedule is supplied. It never accepts independent browser
 * values for those disabled controls.
 */
final class WPBC_Booking_New_Inspector_Form_Serializer {

	/**
	 * Serialize one validated form DTO to canonical legacy storage records.
	 *
	 * @param array<string,mixed>      $validated_form     Output from the exact form validator.
	 * @param array<string,mixed>|null $normalized_schedule Optional reviewed schedule DTO.
	 * @return string|WP_Error Canonical form string or a safe contract error.
	 */
	public function serialize( $validated_form, $normalized_schedule = null ) {
		if (
			! is_array( $validated_form )
			|| ! isset( $validated_form['contract'], $validated_form['resource_id'], $validated_form['fields'] )
			|| WPBC_Booking_New_Inspector_Form_Validator::VALIDATED_CONTRACT !== $validated_form['contract']
			|| 0 >= absint( $validated_form['resource_id'] )
			|| ! is_array( $validated_form['fields'] )
			|| WPBC_Booking_New_Inspector_Config::MAX_FIELDS < count( $validated_form['fields'] )
		) {
			return $this->get_contract_error();
		}

		$resource_id = absint( $validated_form['resource_id'] );
		$records     = array();
		foreach ( $validated_form['fields'] as $validated_field ) {
			if ( ! $this->is_valid_field( $validated_field ) ) {
				return $this->get_contract_error();
			}

			$field_key     = (string) $validated_field['key'];
			$storage_type  = (string) $validated_field['storage_type'];
			$is_multiple   = ! empty( $validated_field['multiple'] );
			$field_name    = $field_key . $resource_id . ( $is_multiple ? '[]' : '' );
			$field_values  = array_values( $validated_field['values'] );
			$display_values = array_values( $validated_field['display_values'] );
			if ( empty( $field_values ) ) {
				$field_values   = array( '' );
				$display_values = array( '' );
			}

			foreach ( $field_values as $field_index => $field_value ) {
				$display_value = isset( $display_values[ $field_index ] ) ? $display_values[ $field_index ] : $field_value;
				$records[]     = $storage_type . '^' . $field_name . '^' . $this->escape_storage_value( $field_value );
				$records[]     = $storage_type . '^' . $field_key . '_val' . $resource_id . '^' . $this->escape_storage_value( $display_value );
			}
		}
		if ( null !== $normalized_schedule ) {
			$schedule_records = $this->get_schedule_records( $validated_form, $normalized_schedule, $resource_id );
			if ( is_wp_error( $schedule_records ) ) {
				return $schedule_records;
			}
			$records = array_merge( $records, $schedule_records );
		}

		return implode( '~', $records );
	}

	/**
	 * Build exact canonical records for disabled schedule-owned form controls.
	 *
	 * @param array<string,mixed> $validated_form      Trusted validator output.
	 * @param array<string,mixed> $normalized_schedule Reviewed normalized schedule.
	 * @param int                 $resource_id         Authorized Resource identifier.
	 * @return array<int,string>|WP_Error Canonical records or a contract error.
	 */
	private function get_schedule_records( $validated_form, $normalized_schedule, $resource_id ) {
		$schedule_fields = isset( $validated_form['schedule_fields'] ) ? $validated_form['schedule_fields'] : array();
		if ( ! is_array( $schedule_fields ) || ! $this->is_valid_schedule( $normalized_schedule ) || WPBC_Booking_New_Inspector_Config::MAX_FIELDS < count( $schedule_fields ) ) {
			return $this->get_contract_error();
		}
		if ( empty( $schedule_fields ) ) {
			return array();
		}

		$time_application = isset( $normalized_schedule['time_application'] ) && is_string( $normalized_schedule['time_application'] )
			? $normalized_schedule['time_application']
			: '';
		$start_time       = isset( $normalized_schedule['start_time'] ) && is_string( $normalized_schedule['start_time'] )
			? $normalized_schedule['start_time']
			: '';
		$end_time         = isset( $normalized_schedule['end_time'] ) && is_string( $normalized_schedule['end_time'] )
			? $normalized_schedule['end_time']
			: '';
		if (
			! in_array( $time_application, array( 'full_day', 'boundary', 'per_date' ), true )
			|| ( 'full_day' !== $time_application && ( ! $this->is_time( $start_time ) || ! $this->is_time( $end_time ) ) )
		) {
			return $this->get_contract_error();
		}

		$records = array();
		foreach ( $schedule_fields as $schedule_field ) {
			if ( ! $this->is_valid_schedule_field( $schedule_field ) ) {
				return $this->get_contract_error();
			}
			if ( 'full_day' === $time_application ) {
				// The reviewed all-day schedule is authoritative. Do not invent a
				// configured time-slot value merely to populate a disabled control.
				continue;
			}

			$field_value = $this->get_schedule_field_value( $schedule_field['schedule_type'], $start_time, $end_time );
			if ( '' === $field_value ) {
				return $this->get_contract_error();
			}
			$field_label = $this->get_schedule_field_label( $field_value, $schedule_field['options'] );
			$field_name  = $schedule_field['key'] . $resource_id;
			$records[]   = $schedule_field['storage_type'] . '^' . $field_name . '^' . $this->escape_storage_value( $field_value );
			$records[]   = $schedule_field['storage_type'] . '^' . $schedule_field['key'] . '_val' . $resource_id . '^' . $this->escape_storage_value( $field_label );
		}

		return $records;
	}

	/**
	 * Validate one trusted schedule-field contract before serialization.
	 *
	 * @param mixed $schedule_field Candidate schedule-field contract.
	 * @return bool True when the field is safe to serialize.
	 */
	private function is_valid_schedule_field( $schedule_field ) {
		if (
			! is_array( $schedule_field )
			|| ! isset( $schedule_field['key'], $schedule_field['schedule_type'], $schedule_field['storage_type'], $schedule_field['required'], $schedule_field['options'] )
			|| ! is_string( $schedule_field['key'] )
			|| 1 !== preg_match( '/^[a-z0-9:._-]{1,100}$/', $schedule_field['key'] )
			|| ! in_array( $schedule_field['schedule_type'], array( 'durationtime', 'endtime', 'rangetime', 'season_rangetime', 'starttime', 'time_slots', 'weekday_rangetime', 'weekday_starttime' ), true )
			|| ! in_array( $schedule_field['storage_type'], array( 'selectbox-one', 'text' ), true )
			|| ! is_bool( $schedule_field['required'] )
			|| ! is_array( $schedule_field['options'] )
			|| WPBC_Booking_New_Inspector_Config::MAX_OPTIONS_PER_FIELD < count( $schedule_field['options'] )
		) {
			return false;
		}
		foreach ( $schedule_field['options'] as $option ) {
			if (
				! is_array( $option )
				|| ! isset( $option['value'], $option['label'] )
				|| ! is_string( $option['value'] )
				|| ! is_string( $option['label'] )
				|| WPBC_Booking_New_Inspector_Config::MAX_FIELD_VALUE_BYTES < strlen( $option['value'] )
				|| WPBC_Booking_New_Inspector_Config::MAX_FIELD_VALUE_BYTES < strlen( $option['label'] )
			) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Validate the bounded reviewed schedule shape consumed by serialization.
	 *
	 * @param mixed $normalized_schedule Candidate normalized schedule.
	 * @return bool True when dates and time mode are internally coherent.
	 */
	private function is_valid_schedule( $normalized_schedule ) {
		if (
			! is_array( $normalized_schedule )
			|| ! isset( $normalized_schedule['time_application'], $normalized_schedule['selected_dates'], $normalized_schedule['start_time'], $normalized_schedule['end_time'] )
			|| ! is_string( $normalized_schedule['time_application'] )
			|| ! is_array( $normalized_schedule['selected_dates'] )
			|| empty( $normalized_schedule['selected_dates'] )
			|| WPBC_Booking_New_Inspector_Config::MAX_DATES < count( $normalized_schedule['selected_dates'] )
		) {
			return false;
		}
		$unique_dates = array();
		foreach ( $normalized_schedule['selected_dates'] as $selected_date ) {
			if ( ! is_string( $selected_date ) || 1 !== preg_match( '/^\d{4}-\d{2}-\d{2}$/', $selected_date ) || isset( $unique_dates[ $selected_date ] ) ) {
				return false;
			}
			$unique_dates[ $selected_date ] = true;
		}

		return true;
	}

	/**
	 * Convert one reviewed schedule to the exact semantic field value.
	 *
	 * @param string $schedule_type Schedule field semantic type.
	 * @param string $start_time    Exact start time.
	 * @param string $end_time      Exact end time.
	 * @return string Canonical schedule value or an empty string.
	 */
	private function get_schedule_field_value( $schedule_type, $start_time, $end_time ) {
		if ( in_array( $schedule_type, array( 'starttime', 'weekday_starttime' ), true ) ) {
			return $start_time;
		}
		if ( 'endtime' === $schedule_type ) {
			return $end_time;
		}
		if ( in_array( $schedule_type, array( 'rangetime', 'season_rangetime', 'time_slots', 'weekday_rangetime' ), true ) ) {
			return $start_time . ' - ' . $end_time;
		}
		if ( 'durationtime' === $schedule_type ) {
			$start_minutes = $this->get_time_minutes( $start_time );
			$end_minutes   = $this->get_time_minutes( $end_time );
			$duration      = $end_minutes - $start_minutes;
			if ( 0 >= $duration ) {
				$duration += 24 * 60;
			}

			return sprintf( '%02d:%02d', (int) floor( $duration / 60 ), $duration % 60 );
		}

		return '';
	}

	/**
	 * Resolve an exact configured display label for a canonical schedule value.
	 *
	 * @param string                           $field_value Canonical schedule value.
	 * @param array<int,array<string,mixed>> $options     Exact authorized options.
	 * @return string Configured label or the canonical value.
	 */
	private function get_schedule_field_label( $field_value, $options ) {
		foreach ( $options as $option ) {
			if ( is_array( $option ) && isset( $option['value'], $option['label'] ) && (string) $option['value'] === $field_value ) {
				return (string) $option['label'];
			}
		}

		return $field_value;
	}

	/**
	 * Determine whether a value is a strict exact-minute wall time.
	 *
	 * @param string $time_value Candidate time.
	 * @return bool True for HH:MM values.
	 */
	private function is_time( $time_value ) {
		return 1 === preg_match( '/^(?:[01]\d|2[0-3]):[0-5]\d$/', (string) $time_value );
	}

	/**
	 * Convert one already validated wall time to minutes after midnight.
	 *
	 * @param string $time_value Strict HH:MM time.
	 * @return int Minutes after midnight.
	 */
	private function get_time_minutes( $time_value ) {
		$time_parts = array_map( 'intval', explode( ':', $time_value ) );

		return ( $time_parts[0] * 60 ) + $time_parts[1];
	}

	/**
	 * Validate the trusted internal field shape before serialization.
	 *
	 * This second allow list prevents accidental serialization of arbitrary
	 * arrays even when a caller bypasses the validator contract intentionally.
	 *
	 * @param mixed $validated_field Candidate field record.
	 * @return bool True when the record is safe to serialize.
	 */
	private function is_valid_field( $validated_field ) {
		if (
			! is_array( $validated_field )
			|| ! isset( $validated_field['key'], $validated_field['storage_type'], $validated_field['values'], $validated_field['display_values'] )
			|| ! is_string( $validated_field['key'] )
			|| 1 !== preg_match( '/^[a-z0-9:._-]{1,100}$/', $validated_field['key'] )
			|| ! in_array( $validated_field['storage_type'], array( 'checkbox', 'coupon', 'email', 'radio', 'selectbox-multiple', 'selectbox-one', 'text', 'textarea' ), true )
			|| ! is_array( $validated_field['values'] )
			|| ! is_array( $validated_field['display_values'] )
			|| WPBC_Booking_New_Inspector_Config::MAX_VALUES_PER_FIELD < count( $validated_field['values'] )
			|| count( $validated_field['values'] ) !== count( $validated_field['display_values'] )
		) {
			return false;
		}

		foreach ( array_merge( $validated_field['values'], $validated_field['display_values'] ) as $field_value ) {
			if ( ! is_string( $field_value ) || WPBC_Booking_New_Inspector_Config::MAX_FIELD_VALUE_BYTES < strlen( $field_value ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Escape delimiters and quotes exactly as the released browser serializer.
	 *
	 * @param string $field_value Validated field or display value.
	 * @return string Storage-safe value.
	 */
	private function escape_storage_value( $field_value ) {
		return str_replace(
			array( '^', '~', '"', "'" ),
			array( '&#94;', '&#126;', '&#34;', '&#39;' ),
			(string) $field_value
		);
	}

	/**
	 * Return a safe error for a forged or incomplete validated DTO.
	 *
	 * @return WP_Error Serializer contract error.
	 */
	private function get_contract_error() {
		return new WP_Error(
			'wpbc_booking_new_inspector_serialization_invalid',
			__( 'The validated Booking Form data could not be serialized.', 'booking' ),
			array( 'status' => 500 )
		);
	}
}
