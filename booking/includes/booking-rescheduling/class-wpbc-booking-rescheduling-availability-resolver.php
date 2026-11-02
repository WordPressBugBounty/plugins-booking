<?php
/**
 * Booking Rescheduling policy, availability, and allocation resolver.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve current booking rules and the canonical non-mutating allocation.
 */
final class WPBC_Booking_Rescheduling_Availability_Resolver {

	/** @var WPBC_Booking_Rescheduling_Repository Domain repository. */
	private $repository;

	/**
	 * Construct the resolver.
	 *
	 * @param WPBC_Booking_Rescheduling_Repository|null $repository Optional domain repository.
	 */
	public function __construct( $repository = null ) {
		$this->repository = $repository ? $repository : new WPBC_Booking_Rescheduling_Repository();
	}

	/**
	 * Validate current policy, form, time, Appointment, availability, capacity,
	 * changeover, checkout, gaps, Seasons, conflicts, and exact allocations.
	 *
	 * @param array<string,mixed>            $booking              Authorized booking.
	 * @param array<int,array<string,mixed>> $date_rows            Canonical current rows.
	 * @param array<string,mixed>            $schedule             Canonical proposed schedule.
	 * @param array<string,mixed>|null       $appointment_snapshot Immutable Appointment snapshot.
	 *
	 * @return array<string,mixed>|WP_Error Authoritative resolution or safe error.
	 */
	public function resolve( $booking, $date_rows, $schedule, $appointment_snapshot ) {
		if ( ! function_exists( 'wpbc__where_to_save_booking' ) ) {
			return $this->get_unavailable_error();
		}

		$policy = $this->get_current_selection_policy();
		$policy_check = 'individual' === $schedule['selection_method']
			? true
			: $this->validate_selection_policy( $schedule['selected_dates'], $policy );
		if ( is_wp_error( $policy_check ) ) {
			return $policy_check;
		}
		$time_check = $this->validate_time_order( $schedule );
		if ( is_wp_error( $time_check ) ) {
			return $time_check;
		}

		$target_resource_id = absint( $schedule['target_resource_id'] );
		if ( $target_resource_id !== absint( $booking['booking_type'] ) ) {
			$resource_change_check = apply_filters( 'wpbc_booking_validate_resource_change', true, absint( $booking['booking_id'] ), $target_resource_id );
			if ( is_wp_error( $resource_change_check ) ) {
				return $resource_change_check;
			}
			if ( true !== $resource_change_check ) {
				return new WP_Error(
					'wpbc_booking_rescheduling_resource_incompatible',
					__( 'The booking is not compatible with the requested Booking Resource.', 'booking' ),
					array( 'status' => 409 )
				);
			}
		}
		$appointment_check  = $this->validate_appointment( $schedule, $appointment_snapshot, $target_resource_id );
		if ( is_wp_error( $appointment_check ) ) {
			return $appointment_check;
		}

		$quantity       = $this->repository->get_booking_quantity( $date_rows );
		$custom_form    = $this->repository->get_custom_form_key( $booking );
		$time_seconds   = 'full_day' === $schedule['time_application']
			? array( 0, 24 * 60 * 60 )
			: array( $this->time_to_seconds( $schedule['start_time'] ), $this->time_to_seconds( $schedule['end_time'] ) );
		$is_overnight_per_date = 'per_date' === $schedule['time_application'] && $time_seconds[1] <= $time_seconds[0];
		$where_to_save = $is_overnight_per_date && empty( $appointment_snapshot )
			? $this->resolve_overnight_occurrences( $booking, $schedule, $target_resource_id, $quantity, $custom_form )
			: $this->call_where_to_save(
				$booking,
				$schedule['selected_dates'],
				$time_seconds,
				$target_resource_id,
				$quantity,
				$custom_form,
				'per_date' === $schedule['time_application']
			);
		if ( is_wp_error( $where_to_save ) ) {
			return $where_to_save;
		}
		if ( ! is_array( $where_to_save ) || 'ok' !== ( isset( $where_to_save['result'] ) ? $where_to_save['result'] : '' ) ) {
			$message = is_array( $where_to_save ) && isset( $where_to_save['message'] )
				? wp_strip_all_tags( (string) $where_to_save['message'] )
				: __( 'The selected dates or times are unavailable. Choose another schedule and try again.', 'booking' );

			return new WP_Error( 'wpbc_booking_rescheduling_unavailable', $message, array( 'status' => 409 ) );
		}

		if ( ! empty( $appointment_snapshot ) && function_exists( 'wpbc_appointment_services_check_working_time' ) ) {
			$working_time_check = wpbc_appointment_services_check_working_time(
				$appointment_snapshot,
				absint( $where_to_save['main__resource_id'] ),
				array_keys( $where_to_save['resources_in_dates'] ),
				$time_seconds
			);
			if ( is_wp_error( $working_time_check ) ) {
				return $working_time_check;
			}
		}
		if ( ! empty( $appointment_snapshot ) && function_exists( 'wpbc_appointment_services_check_buffer_conflicts' ) ) {
			$buffer_check = wpbc_appointment_services_check_buffer_conflicts(
				$appointment_snapshot,
				absint( $where_to_save['main__resource_id'] ),
				array_keys( $where_to_save['resources_in_dates'] ),
				$time_seconds,
				absint( $booking['booking_id'] )
			);
			if ( is_wp_error( $buffer_check ) ) {
				return $buffer_check;
			}
		}

		$resource_ids = array( absint( $where_to_save['main__resource_id'] ) );
		foreach ( (array) $where_to_save['resources_in_dates'] as $date_resource_ids ) {
			$resource_ids = array_merge( $resource_ids, array_map( 'absint', (array) $date_resource_ids ) );
		}

		return array(
			'where_to_save'         => $where_to_save,
			'quantity'              => $quantity,
			'custom_form'           => $custom_form,
			'policy'                => $policy,
			'time_seconds'          => $time_seconds,
			'allocated_resource_ids' => array_values( array_unique( array_filter( $resource_ids ) ) ),
			'context_fingerprint'   => $this->build_context_fingerprint( $policy, $custom_form, $appointment_snapshot ),
		);
	}

	/**
	 * Call the canonical availability and capacity allocator with bounded values.
	 *
	 * @param array<string,mixed> $booking                 Authorized booking.
	 * @param array<int,string>   $selected_dates           Dates to validate.
	 * @param array{0:int,1:int}  $time_seconds             Start and end seconds.
	 * @param int                 $target_resource_id       Authorized target Resource.
	 * @param int                 $quantity                 Canonical booking quantity.
	 * @param string              $custom_form              Canonical custom form key.
	 * @param bool                $use_recurrent_time       Whether each date uses the same time range.
	 *
	 * @return array<string,mixed> Canonical allocator result.
	 */
	private function call_where_to_save( $booking, $selected_dates, $time_seconds, $target_resource_id, $quantity, $custom_form, $use_recurrent_time ) {
		return wpbc__where_to_save_booking(
			array(
				'resource_id'                   => $target_resource_id,
				'skip_booking_id'               => absint( $booking['booking_id'] ),
				'dates_only_sql_arr'            => array_values( $selected_dates ),
				'time_as_seconds_arr'           => $time_seconds,
				'how_many_items_to_book'        => $quantity,
				'request_uri'                   => '',
				'allow_past'                    => true,
				'is_use_booking_recurrent_time' => (bool) $use_recurrent_time,
				'time_override_source'          => '',
				'as_single_resource'            => false,
				'aggregate_resource_id_arr'     => array(),
				'aggregate_type'                => 'all',
				'custom_form'                   => $custom_form,
			)
		);
	}

	/**
	 * Validate every overnight occurrence as one canonical boundary interval.
	 *
	 * The legacy allocator represents a check-in/check-out interval across two
	 * calendar dates, while recurrent mode expects an ordered same-day range.
	 * Resolving each occurrence separately preserves that canonical distinction,
	 * validates both occupied dates, and combines results only after every
	 * occurrence succeeds. Apply therefore remains all-or-nothing.
	 *
	 * @param array<string,mixed> $booking            Authorized booking.
	 * @param array<string,mixed> $schedule           Canonical per-date schedule.
	 * @param int                 $target_resource_id Authorized target Resource.
	 * @param int                 $quantity           Canonical booking quantity.
	 * @param string              $custom_form        Canonical custom form key.
	 *
	 * @return array<string,mixed>|WP_Error Combined allocator result or safe error.
	 */
	private function resolve_overnight_occurrences( $booking, $schedule, $target_resource_id, $quantity, $custom_form ) {
		if ( count( $schedule['selected_dates'] ) !== count( $schedule['exact_intervals'] ) ) {
			return $this->get_time_error(
				sprintf(
					/* translators: 1: selected-date count, 2: exact-interval count. */
					__( 'The overnight proposal contains %1$d selected dates but %2$d exact intervals. Every selected date must have one validated overnight interval.', 'booking' ),
					count( $schedule['selected_dates'] ),
					count( $schedule['exact_intervals'] )
				)
			);
		}

		$combined_result = array(
			'result'             => 'ok',
			'main__resource_id'  => 0,
			'resources_in_dates' => array(),
			'time_to_book'       => array( $schedule['start_time'] . ':00', $schedule['end_time'] . ':00' ),
		);
		foreach ( $schedule['exact_intervals'] as $interval_index => $exact_interval ) {
			$start = new DateTimeImmutable( $exact_interval['start'] );
			$end   = new DateTimeImmutable( $exact_interval['end'] );
			$occurrence_dates = array( $start->format( 'Y-m-d' ), $end->format( 'Y-m-d' ) );
			$occurrence_result = $this->call_where_to_save(
				$booking,
				$occurrence_dates,
				array( $this->time_to_seconds( $start->format( 'H:i' ) ), $this->time_to_seconds( $end->format( 'H:i' ) ) ),
				$target_resource_id,
				$quantity,
				$custom_form,
				false
			);
			if ( ! is_array( $occurrence_result ) || 'ok' !== ( isset( $occurrence_result['result'] ) ? $occurrence_result['result'] : '' ) ) {
				$message = is_array( $occurrence_result ) && isset( $occurrence_result['message'] )
					? wp_strip_all_tags( (string) $occurrence_result['message'] )
					: __( 'The selected dates or times are unavailable. Choose another schedule and try again.', 'booking' );

				return new WP_Error( 'wpbc_booking_rescheduling_unavailable', $message, array( 'status' => 409 ) );
			}

			$main_resource_id = absint( $occurrence_result['main__resource_id'] );
			if ( $combined_result['main__resource_id'] && $combined_result['main__resource_id'] !== $main_resource_id ) {
				return $this->get_unavailable_error();
			}
			$start_date = $schedule['selected_dates'][ $interval_index ];
			$start_resources = isset( $occurrence_result['resources_in_dates'][ $start_date ] )
				? array_values( array_map( 'absint', (array) $occurrence_result['resources_in_dates'][ $start_date ] ) )
				: array();
			sort( $start_resources, SORT_NUMERIC );
			if ( count( array_filter( $start_resources ) ) < $quantity ) {
				return $this->get_unavailable_error();
			}
			foreach ( (array) $occurrence_result['resources_in_dates'] as $date_resources ) {
				$date_resources = array_values( array_map( 'absint', (array) $date_resources ) );
				sort( $date_resources, SORT_NUMERIC );
				if ( $start_resources !== $date_resources ) {
					return $this->get_unavailable_error();
				}
			}
			$combined_result['main__resource_id']              = $main_resource_id;
			$combined_result['resources_in_dates'][ $start_date ] = $start_resources;
		}

		return $combined_result;
	}

	/**
	 * Build a non-reversible fingerprint for apply-time policy/form checks.
	 *
	 * @param array<string,mixed>      $policy               Current policy.
	 * @param string                   $custom_form           Stored form key.
	 * @param array<string,mixed>|null $appointment_snapshot Appointment snapshot.
	 *
	 * @return string Hexadecimal HMAC.
	 */
	private function build_context_fingerprint( $policy, $custom_form, $appointment_snapshot ) {
		$payload = wp_json_encode(
			array(
				'policy'      => $policy,
				'custom_form' => $custom_form,
				'appointment' => $appointment_snapshot,
			)
		);

		return hash_hmac( 'sha256', 'wpbc_booking_rescheduling_context:v1:' . $payload, wp_salt( 'nonce' ) );
	}

	/**
	 * Return current bounded date-selection policy.
	 *
	 * @return array<string,mixed> Canonical policy snapshot.
	 */
	private function get_current_selection_policy() {
		$policy = function_exists( 'wpbc__calendar__js_params__get_days_selection_arr' )
			? wpbc__calendar__js_params__get_days_selection_arr()
			: array();
		$mode = isset( $policy['days_select_mode'] ) ? sanitize_key( $policy['days_select_mode'] ) : 'multiple';
		if ( ! in_array( $mode, array( 'single', 'multiple', 'fixed', 'dynamic' ), true ) ) {
			$mode = 'multiple';
		}

		return array(
			'days_select_mode'          => $mode,
			'fixed__days_num'           => max( 1, min( 180, isset( $policy['fixed__days_num'] ) ? absint( $policy['fixed__days_num'] ) : 1 ) ),
			'fixed__week_days__start'   => $this->normalize_integer_list( isset( $policy['fixed__week_days__start'] ) ? $policy['fixed__week_days__start'] : '-1', -1, 6 ),
			'dynamic__days_min'         => max( 1, isset( $policy['dynamic__days_min'] ) ? absint( $policy['dynamic__days_min'] ) : 1 ),
			'dynamic__days_max'         => isset( $policy['dynamic__days_max'] ) ? absint( $policy['dynamic__days_max'] ) : 0,
			'dynamic__days_specific'    => $this->normalize_integer_list( isset( $policy['dynamic__days_specific'] ) ? $policy['dynamic__days_specific'] : '', 1, 1095 ),
			'dynamic__week_days__start' => $this->normalize_integer_list( isset( $policy['dynamic__week_days__start'] ) ? $policy['dynamic__week_days__start'] : '-1', -1, 6 ),
		);
	}

	/**
	 * Validate current range geometry rules.
	 *
	 * @param array<int,string>  $dates  Proposed dates.
	 * @param array<string,mixed> $policy Current policy.
	 *
	 * @return true|WP_Error True when allowed.
	 */
	private function validate_selection_policy( $dates, $policy ) {
		$count = count( $dates );
		$mode  = $policy['days_select_mode'];
		if ( 0 === $count ) {
			return $this->get_policy_error( __( 'The proposed schedule does not contain any selected calendar dates.', 'booking' ) );
		}
		if ( 'single' === $mode && 1 !== $count ) {
			return $this->get_policy_error(
				sprintf(
					/* translators: %d: proposed number of selected calendar dates. */
					__( 'The proposed schedule selects %d calendar dates, but this Booking Resource currently allows exactly one calendar date.', 'booking' ),
					$count
				)
			);
		}
		if ( 'multiple' === $mode ) {
			return true;
		}
		if ( ! $this->dates_are_consecutive( $dates ) ) {
			return $this->get_policy_error( __( 'The proposed dates contain one or more gaps, but the current booking rule requires one continuous date range.', 'booking' ) );
		}
		$first_date = reset( $dates );
		$weekday    = (int) gmdate( 'w', strtotime( $first_date . ' 12:00:00 UTC' ) );
		if ( 'fixed' === $mode ) {
			$required_count = absint( $policy['fixed__days_num'] );
			if ( $required_count !== $count ) {
				return $this->get_policy_error(
					sprintf(
						/* translators: 1: proposed number of selected calendar dates, 2: required number of selected calendar dates. */
						__( 'The proposed range has a calendar-date count of %1$d, but the current fixed-length rule requires exactly %2$d.', 'booking' ),
						$count,
						$required_count
					)
				);
			}
			if ( ! $this->weekday_allowed( $weekday, $policy['fixed__week_days__start'] ) ) {
				return $this->get_start_weekday_error( $first_date, $policy['fixed__week_days__start'] );
			}

			return true;
		}
		$minimum            = max( 1, absint( $policy['dynamic__days_min'] ) );
		$configured_maximum = absint( $policy['dynamic__days_max'] );
		$maximum            = 0 === $configured_maximum ? 0 : max( $minimum, $configured_maximum );
		if ( $count < $minimum ) {
			return $this->get_policy_error(
				sprintf(
					/* translators: 1: proposed number of selected calendar dates, 2: minimum allowed number of selected calendar dates. */
					__( 'The proposed range has a calendar-date count of %1$d, but the current minimum is %2$d.', 'booking' ),
					$count,
					$minimum
				)
			);
		}
		if ( ( 0 < $maximum ) && ( $count > $maximum ) ) {
			return $this->get_policy_error(
				sprintf(
					/* translators: 1: proposed number of selected calendar dates, 2: maximum allowed number of selected calendar dates. */
					__( 'The proposed range has a calendar-date count of %1$d, but the current maximum is %2$d.', 'booking' ),
					$count,
					$maximum
				)
			);
		}
		if ( ! empty( $policy['dynamic__days_specific'] ) && ! in_array( $count, $policy['dynamic__days_specific'], true ) ) {
			return $this->get_policy_error(
				sprintf(
					/* translators: 1: proposed number of selected calendar dates, 2: comma-separated allowed date counts. */
					__( 'The proposed range has a calendar-date count of %1$d. The current rule allows only these counts: %2$s.', 'booking' ),
					$count,
					implode( ', ', array_map( 'absint', $policy['dynamic__days_specific'] ) )
				)
			);
		}
		if ( ! $this->weekday_allowed( $weekday, $policy['dynamic__week_days__start'] ) ) {
			return $this->get_start_weekday_error( $first_date, $policy['dynamic__week_days__start'] );
		}

		return true;
	}

	/**
	 * Validate time ordering after site-timezone normalization.
	 *
	 * @param array<string,mixed> $schedule Canonical schedule.
	 *
	 * @return true|WP_Error True when ordered.
	 */
	private function validate_time_order( $schedule ) {
		if ( 'full_day' === $schedule['time_application'] ) {
			return true;
		}
		$start = $this->time_to_seconds( $schedule['start_time'] );
		$end   = $this->time_to_seconds( $schedule['end_time'] );
		if ( 'per_date' === $schedule['time_application'] && $end <= $start ) {
			return ! empty( $schedule['exact_intervals'] ) && count( $schedule['exact_intervals'] ) === count( $schedule['selected_dates'] )
				? true
				: $this->get_time_error(
					sprintf(
						/* translators: 1: proposed start time, 2: proposed end time, 3: selected-date count, 4: exact-interval count. */
						__( 'The proposed repeated time is %1$s to %2$s and crosses midnight, but it contains %4$d exact intervals for %3$d selected dates. Overnight proposals require one exact interval for every selected date.', 'booking' ),
						$schedule['start_time'],
						$schedule['end_time'],
						count( $schedule['selected_dates'] ),
						count( $schedule['exact_intervals'] )
					)
				);
		}
		if ( 'boundary' === $schedule['time_application'] && empty( $schedule['exact_intervals'] ) ) {
			$first = reset( $schedule['selected_dates'] );
			$last  = end( $schedule['selected_dates'] );
			if ( strtotime( $last . ' ' . $schedule['end_time'] . ':00 UTC' ) <= strtotime( $first . ' ' . $schedule['start_time'] . ':00 UTC' ) ) {
				return $this->get_time_error(
					sprintf(
						/* translators: 1: proposed start date and time, 2: proposed end date and time. */
						__( 'The proposed end (%2$s) is not later than the proposed start (%1$s).', 'booking' ),
						$first . ' ' . $schedule['start_time'],
						$last . ' ' . $schedule['end_time']
					)
				);
			}
		}

		return true;
	}

	/**
	 * Enforce Appointment Service compatibility and saved duration.
	 *
	 * @param array<string,mixed>      $schedule             Canonical proposal.
	 * @param array<string,mixed>|null $appointment_snapshot Appointment snapshot.
	 * @param int                      $target_resource_id    Requested target Resource.
	 *
	 * @return true|WP_Error True when compatible.
	 */
	private function validate_appointment( $schedule, $appointment_snapshot, $target_resource_id ) {
		if ( empty( $appointment_snapshot ) ) {
			return true;
		}
		if ( 'per_date' !== $schedule['time_application'] ) {
			return new WP_Error(
				'wpbc_booking_rescheduling_appointment_invalid',
				__( 'This booking uses an Appointment Service, which requires one repeated time interval per selected date. The proposed boundary-time mode is not compatible.', 'booking' ),
				array( 'status' => 409 )
			);
		}
		if ( absint( $appointment_snapshot['resource_id'] ) !== absint( $target_resource_id ) ) {
			return new WP_Error(
				'wpbc_booking_rescheduling_appointment_invalid',
				__( 'The selected Booking Resource does not match the Provider assigned to the saved Appointment Service.', 'booking' ),
				array( 'status' => 409 )
			);
		}

		$duration          = ( $this->time_to_seconds( $schedule['end_time'] ) - $this->time_to_seconds( $schedule['start_time'] ) ) / 60;
		$required_duration = absint( $appointment_snapshot['duration_minutes'] );
		if ( $required_duration !== (int) $duration ) {
			return new WP_Error(
				'wpbc_booking_rescheduling_appointment_invalid',
				sprintf(
					/* translators: 1: proposed duration in minutes, 2: Appointment Service duration in minutes. */
					__( 'The proposed Appointment duration is %1$d minutes, but the saved Appointment Service requires %2$d minutes.', 'booking' ),
					(int) $duration,
					$required_duration
				),
				array( 'status' => 409 )
			);
		}

		return true;
	}

	/**
	 * Normalize a legacy integer list.
	 *
	 * @param mixed $value   Candidate list.
	 * @param int   $minimum Minimum accepted integer.
	 * @param int   $maximum Maximum accepted integer.
	 *
	 * @return array<int,int> Bounded unique integers.
	 */
	private function normalize_integer_list( $value, $minimum, $maximum ) {
		$values = is_array( $value ) ? $value : explode( ',', (string) $value );
		$result = array();
		foreach ( $values as $entry ) {
			if ( is_scalar( $entry ) && preg_match( '/^-?\d+$/', trim( (string) $entry ) ) ) {
				$entry = (int) $entry;
				if ( $entry >= $minimum && $entry <= $maximum ) {
					$result[ $entry ] = $entry;
				}
			}
		}

		return array_values( $result );
	}

	/**
	 * Determine whether dates are consecutive.
	 *
	 * @param array<int,string> $dates Ordered dates.
	 *
	 * @return bool True when consecutive.
	 */
	private function dates_are_consecutive( $dates ) {
		for ( $index = 1; $index < count( $dates ); $index++ ) {
			$previous = strtotime( $dates[ $index - 1 ] . ' 12:00:00 UTC' );
			$current  = strtotime( $dates[ $index ] . ' 12:00:00 UTC' );
			if ( false === $previous || false === $current || DAY_IN_SECONDS !== ( $current - $previous ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Check a weekday allow list.
	 *
	 * @param int            $weekday Native Sunday-zero weekday.
	 * @param array<int,int> $allowed Allowed weekdays or `-1`.
	 *
	 * @return bool True when allowed.
	 */
	private function weekday_allowed( $weekday, $allowed ) {
		return in_array( -1, $allowed, true ) || in_array( $weekday, $allowed, true );
	}

	/**
	 * Build an exact, localized explanation for a rejected start weekday.
	 *
	 * @param string         $first_date       Proposed first ISO date.
	 * @param array<int,int> $allowed_weekdays Allowed Sunday-zero weekdays.
	 *
	 * @return WP_Error Safe policy error with the failed rule and allowed values.
	 */
	private function get_start_weekday_error( $first_date, $allowed_weekdays ) {
		$timezone       = new DateTimeZone( 'UTC' );
		$reference_date = new DateTimeImmutable( '2026-10-18 12:00:00', $timezone );
		$allowed_labels = array();
		foreach ( $allowed_weekdays as $allowed_weekday ) {
			if ( $allowed_weekday < 0 || $allowed_weekday > 6 ) {
				continue;
			}
			$allowed_labels[] = wp_date( 'l', $reference_date->modify( '+' . $allowed_weekday . ' days' )->getTimestamp(), $timezone );
		}

		return $this->get_policy_error(
			sprintf(
				/* translators: 1: proposed start weekday, 2: proposed ISO start date, 3: comma-separated allowed start weekdays. */
				__( 'The proposed range starts on %1$s (%2$s), but the current rule allows only these start weekdays: %3$s.', 'booking' ),
				wp_date( 'l', strtotime( $first_date . ' 12:00:00 UTC' ), $timezone ),
				$first_date,
				implode( ', ', $allowed_labels )
			)
		);
	}

	/**
	 * Convert `HH:MM` to seconds.
	 *
	 * @param string $time Exact-minute time.
	 *
	 * @return int Seconds after midnight.
	 */
	private function time_to_seconds( $time ) {
		$parts = array_map( 'intval', explode( ':', $time ) );

		return ( $parts[0] * 3600 ) + ( $parts[1] * 60 );
	}

	/** @return WP_Error Safe resolver-unavailable error. */
	private function get_unavailable_error() {
		return new WP_Error( 'wpbc_booking_rescheduling_review_unavailable', __( 'The proposed schedule could not be reviewed. Reload the page and try again.', 'booking' ), array( 'status' => 500 ) );
	}

	/**
	 * Return a safe policy error with the exact failed rule when known.
	 *
	 * @param string $message Authorized rule-specific message.
	 *
	 * @return WP_Error Safe policy error.
	 */
	private function get_policy_error( $message = '' ) {
		$message = '' !== $message
			? $message
			: __( 'The proposed dates do not match the current booking rules.', 'booking' );

		return new WP_Error( 'wpbc_booking_rescheduling_policy_invalid', $message, array( 'status' => 409 ) );
	}

	/**
	 * Return a safe time-order error with exact rejected values when known.
	 *
	 * @param string $message Authorized time-specific message.
	 *
	 * @return WP_Error Safe time-order error.
	 */
	private function get_time_error( $message = '' ) {
		$message = '' !== $message
			? $message
			: __( 'The proposed start and end times are invalid.', 'booking' );

		return new WP_Error( 'wpbc_booking_rescheduling_time_order_invalid', $message, array( 'status' => 409 ) );
	}
}
