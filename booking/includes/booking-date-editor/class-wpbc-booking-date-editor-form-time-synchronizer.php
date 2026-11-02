<?php
/**
 * Booking Date Editor form-time synchronization.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Synchronize compatible saved booking-form time fields with canonical dates.
 *
 * The Date Editor owns booking time changes. This service updates only existing
 * single-value scheduling fields that can exactly represent the reviewed time;
 * unsupported, multiple, or incompatible controls remain untouched.
 *
 * @since 12.0.0
 */
final class WPBC_Booking_Date_Editor_Form_Time_Synchronizer {

	/** @var WPBC_Booking_Inspector_Form_Field_Resolver Booking-form projection service. */
	private $form_field_resolver;

	/**
	 * Construct the synchronizer.
	 *
	 * @param WPBC_Booking_Inspector_Form_Field_Resolver|null $form_field_resolver Optional resolver for isolated tests.
	 */
	public function __construct( $form_field_resolver = null ) {
		$this->form_field_resolver = $form_field_resolver ? $form_field_resolver : new WPBC_Booking_Inspector_Form_Field_Resolver();
	}

	/**
	 * Build synchronized form storage for one reviewed timed proposal.
	 *
	 * Full-day proposals have no exact customer-form time representation and are
	 * intentionally left unchanged. Choice fields update only to an option whose
	 * semantic time equals the proposal; free-form start/end fields use canonical
	 * 24-hour values. Existing proven `*_val` companions are updated together.
	 *
	 * @param array<string,mixed> $booking  Fresh authorized booking row.
	 * @param array<string,mixed> $proposal Fresh validated Date Editor proposal.
	 *
	 * @return array{form:string,updated_fields:array<int,string>} Synchronized form and changed field keys.
	 */
	public function synchronize( $booking, $proposal ) {
		$stored_form = isset( $booking['form'] ) ? (string) $booking['form'] : '';
		$resource_id = isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0;
		if (
			'' === $stored_form
			|| ! $resource_id
			|| ! is_array( $proposal )
			|| 'full_day' === ( isset( $proposal['time_application'] ) ? $proposal['time_application'] : '' )
		) {
			return array( 'form' => $stored_form, 'updated_fields' => array() );
		}

		$start_time = isset( $proposal['start_time'] ) ? $this->normalize_clock_time( $proposal['start_time'] ) : '';
		$end_time   = isset( $proposal['end_time'] ) ? $this->normalize_clock_time( $proposal['end_time'] ) : '';
		if ( '' === $start_time || '' === $end_time ) {
			return array( 'form' => $stored_form, 'updated_fields' => array() );
		}

		$form_projection = $this->form_field_resolver->resolve_booking_fields( $booking );
		$fields          = isset( $form_projection['fields'] ) && is_array( $form_projection['fields'] )
			? $form_projection['fields']
			: array();
		$replacement_values = array();
		$companion_values   = array();
		foreach ( $fields as $field ) {
			$role = WPBC_Booking_Inspector_Time_Field_Policy::get_schedule_role( $field );
			if ( '' === $role || ! empty( $field['multiple'] ) || empty( $field['key'] ) ) {
				continue;
			}

			$matching_value = $this->get_matching_field_value( $field, $role, $start_time, $end_time );
			if ( empty( $matching_value ) || ! $this->is_storage_safe_value( $matching_value['value'] ) ) {
				continue;
			}
			$field_key                        = sanitize_key( (string) $field['key'] );
			$replacement_values[ $field_key ] = (string) $matching_value['value'];

			$companion = isset( $field['storage_companion'] ) && is_array( $field['storage_companion'] )
				? $field['storage_companion']
				: array();
			$companion_key = isset( $companion['key'] ) ? sanitize_key( (string) $companion['key'] ) : '';
			if ( '' !== $companion_key && $this->is_storage_safe_value( $matching_value['label'] ) ) {
				$companion_values[ $companion_key ] = (string) $matching_value['label'];
			}
		}

		if ( empty( $replacement_values ) ) {
			return array( 'form' => $stored_form, 'updated_fields' => array() );
		}

		$updated_fields  = array();
		$updated_records = array();
		foreach ( explode( '~', $stored_form ) as $stored_record ) {
			$parts = explode( '^', $stored_record, 3 );
			if ( 3 !== count( $parts ) ) {
				$updated_records[] = $stored_record;
				continue;
			}
			$field_key = $this->get_stored_base_key( $parts[1], $resource_id );
			if ( isset( $replacement_values[ $field_key ] ) ) {
				if ( $parts[2] !== $replacement_values[ $field_key ] ) {
					$updated_fields[ $field_key ] = true;
				}
				$parts[2] = $replacement_values[ $field_key ];
			} elseif ( isset( $companion_values[ $field_key ] ) ) {
				$parts[2] = $companion_values[ $field_key ];
			}
			$updated_records[] = implode( '^', $parts );
		}

		return array(
			'form'           => implode( '~', $updated_records ),
			'updated_fields' => array_keys( $updated_fields ),
		);
	}

	/**
	 * Find the exact stored value that represents one canonical time role.
	 *
	 * @param array<string,mixed> $field      Internal field projection.
	 * @param string              $role       Scheduling role.
	 * @param string              $start_time Canonical `HH:MM` start.
	 * @param string              $end_time   Canonical `HH:MM` end.
	 *
	 * @return array{value:string,label:string}|array{} Exact compatible value, or an empty array.
	 */
	private function get_matching_field_value( $field, $role, $start_time, $end_time ) {
		$options = isset( $field['options'] ) && is_array( $field['options'] ) ? $field['options'] : array();
		foreach ( $options as $option ) {
			$option_value = isset( $option['value'] ) ? (string) $option['value'] : '';
			if ( $this->value_matches_role( $option_value, $role, $start_time, $end_time ) ) {
				return array(
					'value' => $option_value,
					'label' => isset( $option['label'] ) ? (string) $option['label'] : $option_value,
				);
			}
		}

		if ( ! empty( $options ) || 'select' === ( isset( $field['type'] ) ? $field['type'] : '' ) ) {
			return array();
		}

		$value = $this->build_canonical_role_value( $role, $start_time, $end_time );

		return '' === $value ? array() : array( 'value' => $value, 'label' => $value );
	}

	/**
	 * Determine whether a stored option has the same scheduling meaning.
	 *
	 * @param string $candidate  Candidate stored option value.
	 * @param string $role       Scheduling role.
	 * @param string $start_time Canonical start.
	 * @param string $end_time   Canonical end.
	 *
	 * @return bool True for an exact semantic match.
	 */
	private function value_matches_role( $candidate, $role, $start_time, $end_time ) {
		if ( 'start' === $role ) {
			return $start_time === $this->normalize_clock_time( $candidate );
		}
		if ( 'end' === $role ) {
			return $end_time === $this->normalize_clock_time( $candidate );
		}
		if ( 'range' === $role ) {
			$range_parts = preg_split( '/\s+-\s+/', trim( (string) $candidate ), 2 );
			return 2 === count( $range_parts )
				&& $start_time === $this->normalize_clock_time( $range_parts[0] )
				&& $end_time === $this->normalize_clock_time( $range_parts[1] );
		}
		if ( 'duration' === $role ) {
			return $this->get_duration_minutes( $candidate ) === $this->get_interval_minutes( $start_time, $end_time );
		}

		return false;
	}

	/**
	 * Build a canonical free-form value for one scheduling role.
	 *
	 * @param string $role       Scheduling role.
	 * @param string $start_time Canonical start.
	 * @param string $end_time   Canonical end.
	 *
	 * @return string Canonical field value, or an empty string.
	 */
	private function build_canonical_role_value( $role, $start_time, $end_time ) {
		if ( 'start' === $role ) {
			return $start_time;
		}
		if ( 'end' === $role ) {
			return $end_time;
		}
		if ( 'range' === $role ) {
			return $start_time . ' - ' . $end_time;
		}
		if ( 'duration' === $role ) {
			$duration_minutes = $this->get_interval_minutes( $start_time, $end_time );

			return $duration_minutes > 0
				? sprintf( '%02d:%02d', floor( $duration_minutes / 60 ), $duration_minutes % 60 )
				: '';
		}

		return '';
	}

	/**
	 * Normalize one supported clock value to `HH:MM`.
	 *
	 * @param mixed $time_value Candidate time.
	 *
	 * @return string Normalized time or an empty string.
	 */
	private function normalize_clock_time( $time_value ) {
		$time_value = is_scalar( $time_value ) ? trim( (string) $time_value ) : '';
		if ( 1 === preg_match( '/^([01]?\d|2[0-3]):([0-5]\d)$/', $time_value, $matches ) ) {
			return sprintf( '%02d:%02d', absint( $matches[1] ), absint( $matches[2] ) );
		}
		if ( 1 === preg_match( '/^(0?[1-9]|1[0-2]):([0-5]\d)\s*([ap]m)$/i', $time_value, $matches ) ) {
			$hours = absint( $matches[1] ) % 12;
			if ( 'pm' === strtolower( $matches[3] ) ) {
				$hours += 12;
			}

			return sprintf( '%02d:%02d', $hours, absint( $matches[2] ) );
		}

		return '';
	}

	/**
	 * Return elapsed minutes between same-day canonical boundaries.
	 *
	 * @param string $start_time Canonical start.
	 * @param string $end_time   Canonical end.
	 *
	 * @return int Positive elapsed minutes, or zero.
	 */
	private function get_interval_minutes( $start_time, $end_time ) {
		$start_parts = array_map( 'absint', explode( ':', $start_time ) );
		$end_parts   = array_map( 'absint', explode( ':', $end_time ) );
		$minutes     = ( $end_parts[0] * 60 + $end_parts[1] ) - ( $start_parts[0] * 60 + $start_parts[1] );

		return max( 0, $minutes );
	}

	/**
	 * Parse one configured duration value into minutes.
	 *
	 * @param string $duration_value Candidate configured duration.
	 *
	 * @return int Parsed minutes, or -1 when unsupported.
	 */
	private function get_duration_minutes( $duration_value ) {
		if ( function_exists( 'wpbc_parse_duration_time_value' ) ) {
			$duration_parts = wpbc_parse_duration_time_value( (string) $duration_value );
			if ( is_array( $duration_parts ) && isset( $duration_parts[0], $duration_parts[1] ) ) {
				return absint( $duration_parts[0] ) * 60 + absint( $duration_parts[1] );
			}
		}
		if ( 1 === preg_match( '/^(\d{1,3}):([0-5]\d)$/', trim( (string) $duration_value ), $matches ) ) {
			return absint( $matches[1] ) * 60 + absint( $matches[2] );
		}

		return -1;
	}

	/**
	 * Resolve an encoded storage name to its internal base key.
	 *
	 * @param string $stored_name Encoded storage field name.
	 * @param int    $resource_id Booking Resource suffix.
	 *
	 * @return string Normalized base key.
	 */
	private function get_stored_base_key( $stored_name, $resource_id ) {
		$stored_name = preg_replace( '/\[\]$/', '', (string) $stored_name );
		$suffix      = (string) absint( $resource_id );
		if ( '' !== $suffix && substr( $stored_name, -strlen( $suffix ) ) === $suffix ) {
			$stored_name = substr( $stored_name, 0, -strlen( $suffix ) );
		}

		return sanitize_key( $stored_name );
	}

	/**
	 * Reject encoded-form delimiter injection in derived values.
	 *
	 * @param mixed $field_value Candidate derived field value.
	 *
	 * @return bool True when the value is safe for the legacy encoded form.
	 */
	private function is_storage_safe_value( $field_value ) {
		return is_scalar( $field_value )
			&& false === strpos( (string) $field_value, '~' )
			&& false === strpos( (string) $field_value, '^' );
	}
}
