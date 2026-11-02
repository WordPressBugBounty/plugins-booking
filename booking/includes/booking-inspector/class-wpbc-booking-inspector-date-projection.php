<?php
/**
 * Booking Inspector canonical date projection.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Convert legacy date markers into an exact, presentation-ready read model.
 */
final class WPBC_Booking_Inspector_Date_Projection {

	/** Compact, localized date shape used consistently throughout the Inspector. */
	const INSPECTOR_DATE_FORMAT = 'M j, Y';

	/**
	 * Project every saved date plus its logical timed intervals.
	 *
	 * The selected-date list preserves full-day, discontinuous, and intermediate
	 * rows. The interval list pairs legacy second-01 starts with second-02/08
	 * ends, including overnight and multi-day timed bookings.
	 *
	 * @param array<int,array<string,mixed>> $date_rows Canonical repository rows.
	 *
	 * @return array<string,mixed> JSON-safe date projection.
	 */
	public function project( $date_rows ) {
		$timezone        = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		$normalized_rows = array();
		$selected_dates  = array();
		$is_approved     = true;
		$valid_row_count = 0;

		foreach ( is_array( $date_rows ) ? $date_rows : array() as $date_row ) {
			$date_time = $this->parse_date_time( isset( $date_row['booking_date'] ) ? $date_row['booking_date'] : '', $timezone );
			$resource_id = isset( $date_row['resource_id'] ) ? absint( $date_row['resource_id'] ) : 0;
			if ( ! $date_time || ! $resource_id ) {
				continue;
			}

			$marker_second = absint( $date_time->format( 's' ) );
			$boundary      = 1 === $marker_second ? 'start' : ( in_array( $marker_second, array( 2, 8 ), true ) ? 'end' : 'full_day' );
			$normalized    = $date_time->setTime( (int) $date_time->format( 'H' ), (int) $date_time->format( 'i' ), 0 );
			$row_approved  = ! empty( $date_row['approved'] );

			++$valid_row_count;
			$is_approved = $is_approved && $row_approved;
			$selected_dates[] = array(
				'date'        => $normalized->format( 'Y-m-d' ),
				'date_label'  => $this->format_date( $normalized, $timezone ),
				'time_label'  => 'full_day' === $boundary ? __( 'Full day', 'booking' ) : $this->format_boundary_time( $boundary, $normalized, $timezone ),
				'boundary'    => $boundary,
				'resource_id' => $resource_id,
				'status'      => $row_approved ? 'approved' : 'pending',
				'sort_at'     => $date_time->getTimestamp(),
			);
			$normalized_rows[] = array(
				'boundary'    => $boundary,
				'date_time'   => $normalized,
				'resource_id' => $resource_id,
			);
		}

		$intervals = $this->build_intervals( $normalized_rows, $timezone );
		usort(
			$intervals,
			static function ( $left_interval, $right_interval ) {
				return strcmp( $left_interval['start_at'], $right_interval['start_at'] );
			}
		);
		usort(
			$selected_dates,
			static function ( $left_date, $right_date ) {
				$time_compare = $left_date['sort_at'] <=> $right_date['sort_at'];

				return 0 !== $time_compare ? $time_compare : $left_date['resource_id'] <=> $right_date['resource_id'];
			}
		);
		foreach ( $selected_dates as &$selected_date ) {
			unset( $selected_date['sort_at'] );
		}
		unset( $selected_date );

		$status_key   = 0 === $valid_row_count ? 'unknown' : ( $is_approved ? 'approved' : 'pending' );
		$status_label = 0 === $valid_row_count ? __( 'Unknown', 'booking' ) : ( $is_approved ? __( 'Approved', 'booking' ) : __( 'Pending', 'booking' ) );

		return array(
			'status'         => array(
				'key'   => $status_key,
				'label' => $status_label,
			),
			'selected_dates' => array_values( $selected_dates ),
			'intervals'      => array_values( $intervals ),
			'summary'        => $this->build_summary( $selected_dates, $intervals ),
		);
	}

	/**
	 * Build booking-level logical intervals while retaining Resource metadata.
	 *
	 * Capacity allocation can rotate between child Resources across the saved
	 * dates. Consequently, a start marker and its matching end marker do not
	 * always have the same effective Resource ID. Pairing by Resource creates
	 * false one-minute or midnight intervals. Equal boundary timestamps are
	 * therefore treated as one allocation batch for the booking, while every
	 * contributing Resource ID remains available on the interval DTO.
	 *
	 * @param array<int,array<string,mixed>> $date_rows Normalized booking rows.
	 * @param DateTimeZone                   $timezone  Site timezone.
	 *
	 * @return array<int,array<string,mixed>> Projected intervals.
	 */
	private function build_intervals( $date_rows, $timezone ) {
		$intervals     = $this->build_timed_intervals( $date_rows, $timezone );
		$full_day_rows = array();

		foreach ( $date_rows as $date_row ) {
			if ( 'full_day' !== $date_row['boundary'] || $this->is_date_covered_by_timed_interval( $date_row['date_time'], $intervals ) ) {
				continue;
			}

			$date_key = $date_row['date_time']->format( 'Y-m-d' );
			if ( ! isset( $full_day_rows[ $date_key ] ) ) {
				$full_day_rows[ $date_key ] = array(
					'date_time'    => $date_row['date_time'],
					'resource_ids' => array(),
				);
			}
			$full_day_rows[ $date_key ]['resource_ids'][] = absint( $date_row['resource_id'] );
		}

		ksort( $full_day_rows, SORT_STRING );
		$full_day_group    = array();
		$previous_full_day = null;
		foreach ( $full_day_rows as $full_day_row ) {
			$current_full_day = $full_day_row['date_time'];
			if ( $previous_full_day && 1 < (int) $previous_full_day->diff( $current_full_day )->format( '%a' ) ) {
				$intervals[]    = $this->build_full_day_interval( $full_day_group, $timezone );
				$full_day_group = array();
			}
			$full_day_group[]  = $full_day_row;
			$previous_full_day = $current_full_day;
		}
		if ( ! empty( $full_day_group ) ) {
			$intervals[] = $this->build_full_day_interval( $full_day_group, $timezone );
		}

		return $intervals;
	}

	/**
	 * Pair booking-level start and end boundary batches.
	 *
	 * @param array<int,array<string,mixed>> $date_rows Normalized booking rows.
	 * @param DateTimeZone                   $timezone  Site timezone.
	 *
	 * @return array<int,array<string,mixed>> Complete, unambiguous timed intervals.
	 */
	private function build_timed_intervals( $date_rows, $timezone ) {
		$boundary_batches = array();
		foreach ( $date_rows as $date_row ) {
			if ( ! in_array( $date_row['boundary'], array( 'start', 'end' ), true ) ) {
				continue;
			}
			$batch_key = $date_row['date_time']->format( 'Y-m-d\TH:i:sP' );
			if ( ! isset( $boundary_batches[ $batch_key ] ) ) {
				$boundary_batches[ $batch_key ] = array(
					'boundary'     => $date_row['boundary'],
					'date_time'    => $date_row['date_time'],
					'resource_ids' => array(),
					'row_count'    => 0,
					'is_mixed'     => false,
				);
			} elseif ( $boundary_batches[ $batch_key ]['boundary'] !== $date_row['boundary'] ) {
				$boundary_batches[ $batch_key ]['is_mixed'] = true;
			}
			$boundary_batches[ $batch_key ]['resource_ids'][] = absint( $date_row['resource_id'] );
			++$boundary_batches[ $batch_key ]['row_count'];
		}

		ksort( $boundary_batches, SORT_STRING );
		$intervals    = array();
		$active_start = null;
		foreach ( $boundary_batches as $boundary_batch ) {
			if ( ! empty( $boundary_batch['is_mixed'] ) ) {
				$active_start = null;
				continue;
			}
			if ( 'start' === $boundary_batch['boundary'] ) {
				$active_start = null === $active_start ? $boundary_batch : null;
				continue;
			}
			if ( null === $active_start
				|| $boundary_batch['date_time'] <= $active_start['date_time']
				|| $boundary_batch['row_count'] !== $active_start['row_count'] ) {
				$active_start = null;
				continue;
			}

			$resource_ids = array_values(
				array_unique(
					array_merge( $active_start['resource_ids'], $boundary_batch['resource_ids'] )
				)
			);
			sort( $resource_ids, SORT_NUMERIC );
			$intervals[] = $this->build_interval(
				$active_start['date_time'],
				$boundary_batch['date_time'],
				false,
				$resource_ids,
				$timezone
			);
			$active_start = null;
		}

		return $intervals;
	}

	/**
	 * Check whether one full-day row belongs inside a timed boundary envelope.
	 *
	 * @param DateTimeImmutable              $date_time Date being evaluated.
	 * @param array<int,array<string,mixed>> $intervals Complete timed intervals.
	 *
	 * @return bool True when the calendar date is bounded by a timed interval.
	 */
	private function is_date_covered_by_timed_interval( $date_time, $intervals ) {
		$date_value = $date_time->format( 'Y-m-d' );
		foreach ( $intervals as $interval ) {
			if ( $date_value >= substr( $interval['start_at'], 0, 10 ) && $date_value <= substr( $interval['end_at'], 0, 10 ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Build one contiguous run of full dates as a half-open interval.
	 *
	 * @param array<int,array<string,mixed>> $full_days Consecutive full-date rows.
	 * @param DateTimeZone                   $timezone Site timezone.
	 *
	 * @return array<string,mixed> Interval DTO.
	 */
	private function build_full_day_interval( $full_days, $timezone ) {
		$first_row    = reset( $full_days );
		$last_row     = end( $full_days );
		$start        = $first_row['date_time'];
		$end          = $last_row['date_time']->modify( '+1 day' );
		$resource_ids = array();
		foreach ( $full_days as $full_day_row ) {
			$resource_ids = array_merge( $resource_ids, $full_day_row['resource_ids'] );
		}
		$resource_ids = array_values( array_unique( array_map( 'absint', $resource_ids ) ) );
		sort( $resource_ids, SORT_NUMERIC );

		return $this->build_interval( $start, $end, true, $resource_ids, $timezone );
	}

	/**
	 * Build one JSON-safe interval record.
	 *
	 * @param DateTimeImmutable $start        Inclusive start.
	 * @param DateTimeImmutable $end          Exclusive end.
	 * @param bool              $is_full_day  Whether the interval is one full date.
	 * @param array<int,int>    $resource_ids Effective Resource IDs.
	 * @param DateTimeZone      $timezone     Site timezone.
	 *
	 * @return array<string,mixed> Interval DTO.
	 */
	private function build_interval( $start, $end, $is_full_day, $resource_ids, $timezone ) {
		$is_overnight = ! $is_full_day && $start->format( 'Y-m-d' ) !== $end->format( 'Y-m-d' );
		$display_end  = $is_full_day ? $end->modify( '-1 day' ) : $end;
		$resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $resource_ids ) ) ) );
		sort( $resource_ids, SORT_NUMERIC );

		return array(
			'start_at'         => $start->format( 'Y-m-d\TH:i:sP' ),
			'end_at'           => $end->format( 'Y-m-d\TH:i:sP' ),
			'start_label'      => $this->format_date_time( $start, $is_full_day, $timezone ),
			'end_label'        => $this->format_date_time( $display_end, $is_full_day, $timezone ),
			'start_date_label' => $this->format_date( $start, $timezone ),
			'end_date_label'   => $this->format_date( $display_end, $timezone ),
			'start_time_label' => $is_full_day ? '' : $this->format_time( $start, $timezone ),
			'end_time_label'   => $is_full_day ? '' : $this->format_time( $display_end, $timezone ),
			'duration_label'   => $this->format_duration( $start, $end, $is_full_day ),
			'is_full_day'      => (bool) $is_full_day,
			'is_overnight'     => $is_overnight,
			'resource_id'      => empty( $resource_ids ) ? 0 : reset( $resource_ids ),
			'resource_ids'     => $resource_ids,
		);
	}

	/**
	 * Build the compact Overview date summary.
	 *
	 * @param array<int,array<string,mixed>> $selected_dates Exact selected dates.
	 * @param array<int,array<string,mixed>> $intervals      Logical intervals.
	 *
	 * @return array<string,mixed> Summary DTO.
	 */
	private function build_summary( $selected_dates, $intervals ) {
		$unique_dates         = array_values( array_unique( array_column( $selected_dates, 'date' ) ) );
		$unique_intervals     = $this->get_unique_intervals( $intervals );
		$first                = ! empty( $unique_intervals ) ? reset( $unique_intervals ) : array();
		$last                 = ! empty( $unique_intervals ) ? end( $unique_intervals ) : array();
		$selected_dates_label = sprintf(
			/* translators: %s: number of exact dates stored for a booking. */
			_n( '%s selected date', '%s selected dates', count( $unique_dates ), 'booking' ),
			number_format_i18n( count( $unique_dates ) )
		);

		return array(
			'start_label'          => isset( $first['start_label'] ) ? $first['start_label'] : '',
			'end_label'            => isset( $last['end_label'] ) ? $last['end_label'] : '',
			'start_date_label'     => isset( $first['start_date_label'] ) ? $first['start_date_label'] : '',
			'end_date_label'       => isset( $last['end_date_label'] ) ? $last['end_date_label'] : '',
			'start_time_label'     => isset( $first['start_time_label'] ) ? $first['start_time_label'] : '',
			'end_time_label'       => isset( $last['end_time_label'] ) ? $last['end_time_label'] : '',
			'selected_date_count'  => count( $unique_dates ),
			'selected_dates_label' => $selected_dates_label,
			'is_discontinuous'     => 1 < count( $unique_intervals ) || ! $this->are_dates_contiguous( $unique_dates ),
			'metrics'              => $this->build_summary_metrics( $unique_dates, $unique_intervals, $selected_dates_label ),
			'overview'             => $this->build_overview( $unique_dates, $unique_intervals ),
		);
	}

	/**
	 * Build ordered, presentation-ready metrics for the Dates Overview card.
	 *
	 * Elapsed duration and nights are shown only for one continuous interval.
	 * This prevents recurrent or discontinuous bookings from being described as
	 * one uninterrupted stay while still exposing their exact selected count.
	 *
	 * @param array<int,string>              $unique_dates         Ordered unique ISO dates.
	 * @param array<int,array<string,mixed>> $unique_intervals     Ordered unique logical intervals.
	 * @param string                         $selected_dates_label Localized selected-date count.
	 *
	 * @return array<int,string> Ordered localized metric labels.
	 */
	private function build_summary_metrics( $unique_dates, $unique_intervals, $selected_dates_label ) {
		$metrics       = array();
		$is_continuous = 1 === count( $unique_intervals ) && $this->are_dates_contiguous( $unique_dates );

		if ( $is_continuous && ! empty( $unique_intervals[0]['duration_label'] ) ) {
			$metrics[] = $unique_intervals[0]['duration_label'];
		}
		if ( '' !== $selected_dates_label ) {
			$metrics[] = $selected_dates_label;
		}
		if ( $is_continuous ) {
			$night_count = max( 0, count( $unique_dates ) - 1 );
			$metrics[]    = sprintf(
				/* translators: %s: number of nights between the first and last selected booking dates. */
				_n( '%s night', '%s nights', $night_count, 'booking' ),
				number_format_i18n( $night_count )
			);
		}

		return $metrics;
	}

	/**
	 * Remove capacity-allocation duplicates from summary-only interval analysis.
	 *
	 * The exact interval list remains unchanged for the Dates tab. The compact
	 * overview must not describe identical allocations on child Resources as
	 * separate customer occurrences.
	 *
	 * @param array<int,array<string,mixed>> $intervals Logical interval DTOs.
	 *
	 * @return array<int,array<string,mixed>> Ordered unique logical intervals.
	 */
	private function get_unique_intervals( $intervals ) {
		$unique_intervals = array();

		foreach ( is_array( $intervals ) ? $intervals : array() as $interval ) {
			$interval_key = implode(
				'|',
				array(
					isset( $interval['start_at'] ) ? (string) $interval['start_at'] : '',
					isset( $interval['end_at'] ) ? (string) $interval['end_at'] : '',
					! empty( $interval['is_full_day'] ) ? '1' : '0',
				)
			);
			if ( isset( $unique_intervals[ $interval_key ] ) ) {
				continue;
			}
			$unique_intervals[ $interval_key ] = $interval;
		}

		return array_values( $unique_intervals );
	}

	/**
	 * Build the semantic compact-header presentation for the stored date shape.
	 *
	 * Continuous bookings retain Start, duration, arrow, and End. Single-day
	 * bookings avoid repeating the same date. Recurrent or independent intervals
	 * show first/last occurrence semantics and never imply that gaps are booked.
	 *
	 * @param array<int,string>              $unique_dates     Ordered unique ISO dates.
	 * @param array<int,array<string,mixed>> $unique_intervals Ordered unique intervals.
	 *
	 * @return array<string,mixed> JSON-safe, presentation-ready overview.
	 */
	private function build_overview( $unique_dates, $unique_intervals ) {
		$interval_count = count( $unique_intervals );
		$date_count     = count( $unique_dates );
		$first          = $interval_count ? reset( $unique_intervals ) : array();
		$last           = $interval_count ? end( $unique_intervals ) : array();
		$base_overview  = array(
			'kind'               => 'unavailable',
			'leading_label'      => __( 'Dates', 'booking' ),
			'leading_value'      => __( 'Not available', 'booking' ),
			'leading_secondary'  => '',
			'center_value'       => '',
			'center_secondary'   => '',
			'trailing_label'     => '',
			'trailing_value'     => '',
			'trailing_secondary' => '',
			'show_arrow'         => false,
		);

		if ( ! $interval_count ) {
			return $base_overview;
		}

		if ( 1 === $interval_count ) {
			if ( ! $this->are_dates_contiguous( $unique_dates ) ) {
				return array_merge(
					$base_overview,
					array(
						'kind'               => 'discontinuous_dates_with_boundary_times',
						'leading_label'      => __( 'First selected date', 'booking' ),
						'leading_value'      => isset( $first['start_date_label'] ) ? $first['start_date_label'] : '',
						'leading_secondary'  => empty( $first['start_time_label'] )
							? ''
							: sprintf( __( 'Starts at %s', 'booking' ), $first['start_time_label'] ),
						'center_value'       => sprintf(
							/* translators: %s: number of exact dates stored for a booking. */
							_n( '%s selected date', '%s selected dates', $date_count, 'booking' ),
							number_format_i18n( $date_count )
						),
						'trailing_label'     => __( 'Last selected date', 'booking' ),
						'trailing_value'     => isset( $first['end_date_label'] ) ? $first['end_date_label'] : '',
						'trailing_secondary' => empty( $first['end_time_label'] )
							? ''
							: sprintf( __( 'Ends at %s', 'booking' ), $first['end_time_label'] ),
					)
				);
			}

			$is_same_date = isset( $first['start_date_label'], $first['end_date_label'] )
				&& $first['start_date_label'] === $first['end_date_label'];

			if ( $is_same_date ) {
				return array_merge(
					$base_overview,
					array(
						'kind'               => ! empty( $first['is_full_day'] ) ? 'single_full_day' : 'single_timed_interval',
						'leading_label'      => __( 'Date', 'booking' ),
						'leading_value'      => isset( $first['start_date_label'] ) ? $first['start_date_label'] : '',
						'center_value'       => isset( $first['duration_label'] ) ? $first['duration_label'] : '',
						'trailing_label'     => __( 'Time', 'booking' ),
						'trailing_value'     => ! empty( $first['is_full_day'] )
							? __( 'Full day', 'booking' )
							: $this->format_interval_time_range( $first ),
					)
				);
			}

			return array_merge(
				$base_overview,
				array(
					'kind'               => ! empty( $first['is_full_day'] ) ? 'continuous_full_day_range' : 'continuous_timed_range',
					'leading_label'      => __( 'Start', 'booking' ),
					'leading_value'      => isset( $first['start_date_label'] ) ? $first['start_date_label'] : '',
					'leading_secondary'  => isset( $first['start_time_label'] ) ? $first['start_time_label'] : '',
					'center_value'       => isset( $first['duration_label'] ) ? $first['duration_label'] : '',
					'trailing_label'     => __( 'End', 'booking' ),
					'trailing_value'     => isset( $first['end_date_label'] ) ? $first['end_date_label'] : '',
					'trailing_secondary' => isset( $first['end_time_label'] ) ? $first['end_time_label'] : '',
					'show_arrow'         => true,
				)
			);
		}

		if ( $this->intervals_share_time_range( $unique_intervals ) ) {
			return array_merge(
				$base_overview,
				array(
					'kind'               => 'recurrent_timed_intervals',
					'leading_label'      => __( 'First date', 'booking' ),
					'leading_value'      => isset( $first['start_date_label'] ) ? $first['start_date_label'] : '',
					'center_value'       => sprintf(
						/* translators: %s: number of recurrent booking occurrences. */
						_n( '%s occurrence', '%s occurrences', $interval_count, 'booking' ),
						number_format_i18n( $interval_count )
					),
					'center_secondary'   => $this->format_recurrent_time_summary( $first ),
					'trailing_label'     => __( 'Last date', 'booking' ),
					'trailing_value'     => isset( $last['start_date_label'] ) ? $last['start_date_label'] : '',
				)
			);
		}

		if ( $this->intervals_are_full_day( $unique_intervals ) ) {
			return array_merge(
				$base_overview,
				array(
					'kind'           => 'independent_full_days',
					'leading_label'  => __( 'First date', 'booking' ),
					'leading_value'  => isset( $first['start_date_label'] ) ? $first['start_date_label'] : '',
					'center_value'   => sprintf(
						/* translators: %s: number of exact dates stored for a booking. */
						_n( '%s selected date', '%s selected dates', $date_count, 'booking' ),
						number_format_i18n( $date_count )
					),
					'trailing_label' => __( 'Last date', 'booking' ),
					'trailing_value' => isset( $last['end_date_label'] ) ? $last['end_date_label'] : '',
				)
			);
		}

		return array_merge(
			$base_overview,
			array(
				'kind'               => 'independent_intervals',
				'leading_label'      => __( 'First interval', 'booking' ),
				'leading_value'      => isset( $first['start_date_label'] ) ? $first['start_date_label'] : '',
				'leading_secondary'  => ! empty( $first['is_full_day'] )
					? __( 'Full day', 'booking' )
					: $this->format_interval_time_range( $first ),
				'center_value'       => sprintf(
					/* translators: %s: number of independent booking intervals. */
					_n( '%s interval', '%s intervals', $interval_count, 'booking' ),
					number_format_i18n( $interval_count )
				),
				'center_secondary'   => sprintf(
					/* translators: %s: number of exact dates stored for a booking. */
					_n( '%s selected date', '%s selected dates', $date_count, 'booking' ),
					number_format_i18n( $date_count )
				),
				'trailing_label'     => __( 'Last interval', 'booking' ),
				'trailing_value'     => isset( $last['end_date_label'] ) ? $last['end_date_label'] : '',
				'trailing_secondary' => ! empty( $last['is_full_day'] )
					? __( 'Full day', 'booking' )
					: $this->format_interval_time_range( $last ),
			)
		);
	}

	/**
	 * Determine whether the exact selected calendar dates are consecutive.
	 *
	 * @param array<int,string> $dates Ordered ISO dates.
	 *
	 * @return bool True when there is no unselected calendar date between rows.
	 */
	private function are_dates_contiguous( $dates ) {
		$previous_date = null;
		foreach ( $dates as $date_value ) {
			$current_date = DateTimeImmutable::createFromFormat( '!Y-m-d', (string) $date_value, new DateTimeZone( 'UTC' ) );
			if ( ! $current_date instanceof DateTimeImmutable ) {
				return false;
			}
			if ( $previous_date instanceof DateTimeImmutable && 1 !== (int) $previous_date->diff( $current_date )->format( '%a' ) ) {
				return false;
			}
			$previous_date = $current_date;
		}

		return true;
	}

	/**
	 * Determine whether every interval represents a full calendar day or range.
	 *
	 * @param array<int,array<string,mixed>> $intervals Unique logical intervals.
	 *
	 * @return bool True when every interval is full-day.
	 */
	private function intervals_are_full_day( $intervals ) {
		foreach ( $intervals as $interval ) {
			if ( empty( $interval['is_full_day'] ) ) {
				return false;
			}
		}

		return ! empty( $intervals );
	}

	/**
	 * Determine whether timed intervals repeat one exact clock-time range.
	 *
	 * @param array<int,array<string,mixed>> $intervals Unique logical intervals.
	 *
	 * @return bool True for two or more timed occurrences with matching times.
	 */
	private function intervals_share_time_range( $intervals ) {
		$first_signature = '';

		foreach ( $intervals as $interval ) {
			if ( ! empty( $interval['is_full_day'] ) || empty( $interval['start_at'] ) || empty( $interval['end_at'] ) ) {
				return false;
			}
			$day_offset = $this->get_interval_day_offset( $interval );
			if ( null === $day_offset ) {
				return false;
			}
			$signature = substr( $interval['start_at'], 11, 8 ) . '|' . substr( $interval['end_at'], 11, 8 ) . '|' . $day_offset;
			if ( '' === $first_signature ) {
				$first_signature = $signature;
				continue;
			}
			if ( $signature !== $first_signature ) {
				return false;
			}
		}

		return 1 < count( $intervals );
	}

	/**
	 * Return the calendar-day span of one interval.
	 *
	 * Clock times alone cannot distinguish a same-day recurrence from a repeated
	 * overnight or multi-day interval. Including this offset prevents unlike
	 * interval shapes from being summarized as one common recurrence pattern.
	 *
	 * @param array<string,mixed> $interval Interval DTO.
	 *
	 * @return int|null Non-negative calendar-day offset, or null when unavailable.
	 */
	private function get_interval_day_offset( $interval ) {
		if ( empty( $interval['start_at'] ) || empty( $interval['end_at'] ) ) {
			return null;
		}

		$utc_timezone = new DateTimeZone( 'UTC' );
		$start_date = DateTimeImmutable::createFromFormat(
			'!Y-m-d',
			substr( $interval['start_at'], 0, 10 ),
			$utc_timezone
		);
		$end_date   = DateTimeImmutable::createFromFormat(
			'!Y-m-d',
			substr( $interval['end_at'], 0, 10 ),
			$utc_timezone
		);
		if ( ! $start_date || ! $end_date || $end_date < $start_date ) {
			return null;
		}

		return (int) $start_date->diff( $end_date )->format( '%r%a' );
	}

	/**
	 * Format the shared schedule shown for recurrent timed intervals.
	 *
	 * Same-day occurrences need only their common time range. Overnight and
	 * multi-day occurrences also show elapsed duration so an earlier end clock
	 * cannot be mistaken for a reversed same-day interval.
	 *
	 * @param array<string,mixed> $interval Interval DTO.
	 *
	 * @return string Localized recurrent schedule summary.
	 */
	private function format_recurrent_time_summary( $interval ) {
		$time_range = $this->format_interval_time_range( $interval );
		$day_offset = $this->get_interval_day_offset( $interval );

		if ( null === $day_offset || 1 > $day_offset || empty( $interval['duration_label'] ) ) {
			return $time_range;
		}

		return sprintf(
			/* translators: 1: recurrent start/end time range, 2: elapsed duration. */
			__( '%1$s (%2$s)', 'booking' ),
			$time_range,
			$interval['duration_label']
		);
	}

	/**
	 * Format one interval's clock-time range without repeating its date.
	 *
	 * @param array<string,mixed> $interval Interval DTO.
	 *
	 * @return string Localized start/end time range, or an empty string.
	 */
	private function format_interval_time_range( $interval ) {
		if ( empty( $interval['start_time_label'] ) || empty( $interval['end_time_label'] ) ) {
			return '';
		}

		return sprintf(
			/* translators: 1: start time, 2: end time. */
			__( '%1$s – %2$s', 'booking' ),
			$interval['start_time_label'],
			$interval['end_time_label']
		);
	}

	/**
	 * Parse one site-local booking date safely.
	 *
	 * @param mixed        $date_value Candidate database date.
	 * @param DateTimeZone $timezone   Site timezone.
	 *
	 * @return DateTimeImmutable|null Parsed value or null.
	 */
	private function parse_date_time( $date_value, $timezone ) {
		if ( ! is_scalar( $date_value ) ) {
			return null;
		}

		$date_time = DateTimeImmutable::createFromFormat( '!Y-m-d H:i:s', (string) $date_value, $timezone );

		return $date_time instanceof DateTimeImmutable ? $date_time : null;
	}

	/**
	 * Format one site-local date.
	 *
	 * @param DateTimeImmutable $date_time Date value.
	 * @param DateTimeZone      $timezone  Site timezone.
	 *
	 * @return string Localized date.
	 */
	private function format_date( $date_time, $timezone ) {
		return wp_date( self::INSPECTOR_DATE_FORMAT, $date_time->getTimestamp(), $timezone );
	}

	/**
	 * Format one date or date/time boundary.
	 *
	 * @param DateTimeImmutable $date_time   Date/time value.
	 * @param bool              $is_full_day Whether time should be omitted.
	 * @param DateTimeZone      $timezone    Site timezone.
	 *
	 * @return string Localized boundary.
	 */
	private function format_date_time( $date_time, $is_full_day, $timezone ) {
		$format = $is_full_day
			? self::INSPECTOR_DATE_FORMAT
			: self::INSPECTOR_DATE_FORMAT . ' - ' . $this->get_booking_time_format();

		return wp_date( $format, $date_time->getTimestamp(), $timezone );
	}

	/**
	 * Format one site-local time using Booking Calendar's saved time option.
	 *
	 * The split value lets templates place a time on its own visual line without
	 * parsing a translated combined date/time label in the browser.
	 *
	 * @param DateTimeImmutable $date_time Time value.
	 * @param DateTimeZone      $timezone  Site timezone.
	 *
	 * @return string Localized time.
	 */
	private function format_time( $date_time, $timezone ) {
		return wp_date( $this->get_booking_time_format(), $date_time->getTimestamp(), $timezone );
	}

	/**
	 * Format a selected-date boundary label.
	 *
	 * @param string            $boundary  Start or end boundary.
	 * @param DateTimeImmutable $date_time Boundary date/time.
	 * @param DateTimeZone      $timezone  Site timezone.
	 *
	 * @return string Localized boundary label.
	 */
	private function format_boundary_time( $boundary, $date_time, $timezone ) {
		$time_label = wp_date( $this->get_booking_time_format(), $date_time->getTimestamp(), $timezone );

		return 'start' === $boundary
			? sprintf( __( 'Starts at %s', 'booking' ), $time_label )
			: sprintf( __( 'Ends at %s', 'booking' ), $time_label );
	}

	/**
	 * Return the canonical Booking Calendar time format with safe fallbacks.
	 *
	 * Booking Calendar has its own saved time-format option. The Inspector must
	 * follow that option instead of WordPress's generic time format so its dates
	 * agree with the calendar, booking forms, and existing booking workflows.
	 *
	 * @return string Valid non-empty PHP date/time format.
	 */
	private function get_booking_time_format() {
		$time_format = function_exists( 'get_bk_option' ) ? get_bk_option( 'booking_time_format' ) : '';
		$time_format = is_scalar( $time_format ) ? trim( (string) $time_format ) : '';
		if ( '' === $time_format ) {
			$time_format = (string) get_option( 'time_format', 'H:i' );
		}

		return '' !== trim( $time_format ) ? $time_format : 'H:i';
	}

	/**
	 * Format one exact interval duration.
	 *
	 * @param DateTimeImmutable $start       Inclusive start.
	 * @param DateTimeImmutable $end         Exclusive end.
	 * @param bool              $is_full_day Whether the interval is full-day.
	 *
	 * @return string Localized duration.
	 */
	private function format_duration( $start, $end, $is_full_day ) {
		if ( $is_full_day ) {
			$day_count = max( 1, (int) $start->diff( $end )->format( '%a' ) );

			return sprintf( _n( '%s day', '%s days', $day_count, 'booking' ), number_format_i18n( $day_count ) );
		}

		$duration_minutes = max( 1, (int) round( ( $end->getTimestamp() - $start->getTimestamp() ) / MINUTE_IN_SECONDS ) );

		return wpbc_format_duration_minutes( $duration_minutes );
	}
}
