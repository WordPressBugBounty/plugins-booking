<?php
/**
 * Creation-specific schedule choices for Add New Booking Inspector.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Projects server-authorized creation choices without owning availability.
 */
final class WPBC_Booking_New_Inspector_Schedule_Policy {

	/**
	 * Determine whether this authenticated administrator workflow permits past dates.
	 *
	 * Add New Booking Inspector is an administrator Add Booking surface. Its
	 * server-built native calendar deliberately exposes the bounded past-date
	 * range, so Review and Apply must use the same policy. This value is owned by
	 * the server and is never accepted from the browser request.
	 *
	 * @return bool True because authorized Inspector creation permits bounded past dates.
	 */
	public static function permits_past_dates() {
		return WPBC_Booking_Native_Calendar_Contract_Builder::permits_past_dates();
	}

	/**
	 * Resolve the canonical time-override source for a normalized schedule.
	 *
	 * The released Add Booking path uses `times_availability` for an interval
	 * repeated on every selected date. A first-date/last-date boundary must use
	 * its own source so the canonical save handler does not convert a continuous
	 * multi-date range into recurrent intervals. Review and Apply use this same
	 * mapping so availability is checked against the exact schedule that will be
	 * persisted.
	 *
	 * @param string $time_application Normalized time application ID.
	 * @return string Canonical time-override source, or an empty string for full-day schedules.
	 */
	public static function resolve_time_override_source( $time_application ) {
		if ( 'per_date' === $time_application ) {
			return 'times_availability';
		}

		if ( 'boundary' === $time_application ) {
			return 'booking_new_inspector_boundary';
		}

		return '';
	}

	/**
	 * Return the schedule mechanics available for one authorized Booking form.
	 *
	 * Individual selection changes only native selection geometry. The native
	 * calendar still owns availability, capacity, seasons, and booking rules.
	 * Appointment forms are intentionally outside this Booking creation domain.
	 * The schedule-field argument remains part of the stable policy contract,
	 * but a form-owned time control does not prohibit an explicit all-day draft.
	 *
	 * @param string                         $form_source     Exact authorized Booking form source.
	 * @param array<int,array<string,mixed>> $schedule_fields Exact server-only schedule fields.
	 * @return array<string,array<int,array{id:string,label:string}>> Choice DTOs.
	 */
	public function get_choices( $form_source, $schedule_fields = array() ) {
		unset( $schedule_fields );

		$selection_methods = array(
			array(
				'id'    => 'policy',
				'label' => __( 'Use current booking rules', 'booking' ),
			),
		);
		if ( in_array( $form_source, array( 'classic', 'form_builder', 'advanced' ), true ) ) {
			$selection_methods[] = array(
				'id'    => 'individual',
				'label' => __( 'Select individual dates', 'booking' ),
			);
		}

		$time_applications = array(
			array(
				'id'    => 'full_day',
				'label' => __( 'Full days', 'booking' ),
			),
		);
		$time_applications[] = array(
			'id'    => 'boundary',
			'label' => __( 'Start on the first date and end on the last date', 'booking' ),
		);
		$time_applications[] = array(
			'id'    => 'per_date',
			'label' => __( 'Use the same time on every selected date', 'booking' ),
		);

		return array(
			'selection_methods' => $selection_methods,
			'time_applications' => $time_applications,
		);
	}

	/**
	 * Determine whether a normalized selection method is authorized.
	 *
	 * @param string              $selection_method Normalized method ID.
	 * @param array<string,mixed> $choices          Authorized choice DTOs.
	 * @return bool True when the method occurs in the server choice list.
	 */
	public function permits_selection_method( $selection_method, $choices ) {
		foreach ( isset( $choices['selection_methods'] ) ? $choices['selection_methods'] : array() as $choice ) {
			if ( isset( $choice['id'] ) && $selection_method === $choice['id'] ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Determine whether one normalized time application is authorized.
	 *
	 * @param string              $time_application Normalized time application ID.
	 * @param array<string,mixed> $choices          Authorized choice DTOs.
	 * @return bool True when the mode occurs in the server choice list.
	 */
	public function permits_time_application( $time_application, $choices ) {
		foreach ( isset( $choices['time_applications'] ) ? $choices['time_applications'] : array() as $choice ) {
			if ( isset( $choice['id'] ) && $time_application === $choice['id'] ) {
				return true;
			}
		}

		return false;
	}
}
