<?php
/**
 * Shared mathematical time axis for the administration Timeline.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build site-local, offset-explicit Timeline buckets and geometry.
 *
 * Calendar-day windows retain local-midnight boundaries. Timed buckets advance
 * by elapsed seconds inside each local date, so missing and repeated DST hours
 * remain explicit without rewriting canonical booking timestamps.
 */
final class WPBC_Timeline_Axis {

	/**
	 * Count axis cells without constructing presentation labels.
	 *
	 * @param DateTimeImmutable $window_start Inclusive site-local boundary.
	 * @param DateTimeImmutable $window_end   Exclusive site-local boundary.
	 * @param int               $cell_minutes Allow-listed cell duration.
	 *
	 * @return int Number of visual cells.
	 */
	public function count_cells( $window_start, $window_end, $cell_minutes ) {
		$cell_minutes = max( 5, absint( $cell_minutes ) );
		$cell_count   = 0;
		$day_start    = $window_start->setTime( 0, 0, 0 );

		while ( $day_start < $window_end ) {
			$day_end = $day_start->modify( '+1 day' );
			if ( $day_end > $window_end ) {
				$day_end = $window_end;
			}

			if ( DAY_IN_SECONDS / MINUTE_IN_SECONDS === $cell_minutes ) {
				++$cell_count;
			} else {
				$elapsed_minutes = max( 1, (int) ceil( ( $day_end->getTimestamp() - $day_start->getTimestamp() ) / MINUTE_IN_SECONDS ) );
				$cell_count     += (int) ceil( $elapsed_minutes / $cell_minutes );
			}
			$day_start = $day_end;
		}

		return $cell_count;
	}

	/**
	 * Build the complete JSON-safe axis DTO for one validated window.
	 *
	 * @param array<string,mixed> $window Validated Timeline window.
	 *
	 * @return array<string,mixed> Shared axis DTO.
	 */
	public function build_axis( $window ) {
		$timezone     = $this->get_timezone( $window );
		$window_start = $this->get_boundary( $window, 'start_at', 'start_date', $timezone );
		$window_end   = $this->get_boundary( $window, 'end_at', 'end_date', $timezone );
		$cell_minutes = isset( $window['cell_minutes'] ) ? max( 5, absint( $window['cell_minutes'] ) ) : DAY_IN_SECONDS / MINUTE_IN_SECONDS;
		$is_timed     = DAY_IN_SECONDS / MINUTE_IN_SECONDS !== $cell_minutes;
		$cells        = $this->build_cells( $window_start, $window_end, $cell_minutes, $timezone );
		$cell_count   = count( $cells );
		$today        = new DateTimeImmutable( 'today', $timezone );
		$month_bands  = array();
		$date_bands   = array();

		foreach ( $cells as $cell_index => &$cell ) {
			$month_key = $cell['month_key'];
			$date_key  = $cell['date'];
			if ( ! isset( $month_bands[ $month_key ] ) ) {
				$month_bands[ $month_key ] = array(
					'key'   => $month_key,
					'label' => $cell['month_label'],
					'span'  => 0,
				);
			}
			++$month_bands[ $month_key ]['span'];

			if ( ! isset( $date_bands[ $date_key ] ) ) {
				$date_timestamp = absint( $cell['start_epoch'] );
				$date_bands[ $date_key ] = array_merge(
					$this->build_date_band_metadata( $date_key, $timezone ),
					array(
						'date'        => $date_key,
						'label'       => wp_date( 'D, M j', $date_timestamp, $timezone ),
						'weekday'     => wp_date( 'D', $date_timestamp, $timezone ),
						'day_number'  => wp_date( 'j', $date_timestamp, $timezone ),
						'today_label' => wp_date( 'M j', $date_timestamp, $timezone ),
						'is_today'    => $date_key === $today->format( 'Y-m-d' ),
						'is_weekend'  => 6 <= absint( wp_date( 'N', $date_timestamp, $timezone ) ),
						'span'        => 0,
					)
				);
			}
			++$date_bands[ $date_key ]['span'];

			$cell['index']                = $cell_index;
			$cell['offset_percent']       = $cell_count ? round( 100 * $cell_index / $cell_count, 8 ) : 0;
			$cell['width_percent']        = $cell_count ? round( 100 / $cell_count, 8 ) : 100;
			$cell['is_today']             = $date_key === $today->format( 'Y-m-d' );
			$cell['is_weekend']           = 6 <= absint( $cell['weekday_number'] );
			$cell['show_offset']          = ! empty( $cell['is_dst_transition'] ) || ! empty( $cell['is_repeated_time'] );
			$cell['secondary_label']      = $cell['show_offset'] ? $cell['utc_offset'] : '';
			$cell['aria_label']           = $is_timed
				? sprintf(
					/* translators: 1: date, 2: local time, 3: UTC offset. */
					__( '%1$s at %2$s, UTC offset %3$s', 'booking' ),
					wp_date( 'F j, Y', absint( $cell['start_epoch'] ), $timezone ),
					$cell['primary_label'],
					$cell['utc_offset']
				)
				: wp_date( 'F j, Y', absint( $cell['start_epoch'] ), $timezone );
		}
		unset( $cell );

		$now              = new DateTimeImmutable( 'now', $timezone );
		$current_date_label = wp_date( get_option( 'date_format' ), $now->getTimestamp(), $timezone );
		$current_time_label = wp_date( get_option( 'time_format' ), $now->getTimestamp(), $timezone );
		$current_position = $this->map_timestamp_to_position( $now->getTimestamp(), $cells );
		$current_visible  = $now >= $window_start && $now < $window_end;
		$anchor_at        = isset( $window['anchor_at'] ) ? $this->parse_instant( $window['anchor_at'], $timezone ) : $window_start;
		$anchor_position  = $this->map_timestamp_to_position( $anchor_at->getTimestamp(), $cells );

		return array(
			'view'                => isset( $window['view'] ) ? sanitize_key( $window['view'] ) : 'day',
			'cell_minutes'        => $cell_minutes,
			'cell_count'          => $cell_count,
			'cell_width_px'       => $this->get_cell_width( $cell_minutes ),
			'header_height_px'     => $is_timed ? 132 : 104,
			'is_timed'            => $is_timed,
			'timezone'            => $timezone->getName(),
			'start_at'            => $window_start->format( 'Y-m-d\TH:i:sP' ),
			'end_at'              => $window_end->format( 'Y-m-d\TH:i:sP' ),
			'start_epoch'         => $window_start->getTimestamp(),
			'end_epoch'           => $window_end->getTimestamp(),
			'month_bands'         => array_values( $month_bands ),
			'date_bands'          => array_values( $date_bands ),
			'cells'               => array_values( $cells ),
			'range_label'         => $this->format_range_label( $window_start, $window_end->modify( '-1 second' ), $timezone ),
			'anchor'              => array(
				'at'               => $anchor_at->format( 'Y-m-d\TH:i:sP' ),
				'position_percent' => $cell_count ? round( 100 * $anchor_position / $cell_count, 8 ) : 0,
			),
			'current_time_marker' => array(
				'is_visible'       => $is_timed && $current_visible,
				'position_percent' => $cell_count ? round( 100 * $current_position / $cell_count, 8 ) : 0,
				'at'               => $now->format( 'Y-m-d\TH:i:sP' ),
				'badge_label'      => sprintf(
					/* translators: 1: site-local current date, 2: site-local current time. */
					__( '%1$s, %2$s', 'booking' ),
					wp_date( 'M j', $now->getTimestamp(), $timezone ),
					$current_time_label
				),
				'label'            => sprintf(
					/* translators: 1: site-local current date, 2: site-local current time. */
					__( 'Current date and time: %1$s at %2$s', 'booking' ),
					$current_date_label,
					$current_time_label
				),
			),
		);
	}

	/**
	 * Map exact timestamps to shared exact and cell-expanded visual geometry.
	 *
	 * @param array<string,mixed> $axis          Axis DTO from build_axis().
	 * @param int                 $start_epoch   Inclusive visible start timestamp.
	 * @param int                 $end_epoch     Exclusive visible end timestamp.
	 *
	 * @return array<string,float> Exact and visual percentages.
	 */
	public function get_segment_geometry( $axis, $start_epoch, $end_epoch ) {
		$cells       = isset( $axis['cells'] ) && is_array( $axis['cells'] ) ? $axis['cells'] : array();
		$cell_count  = max( 1, count( $cells ) );
		$start_units = $this->map_timestamp_to_position( (int) $start_epoch, $cells );
		$end_units   = $this->map_timestamp_to_position( (int) $end_epoch, $cells );
		$visual_start = max( 0, min( $cell_count - 1, (int) floor( $start_units ) ) );
		$visual_end   = max( $visual_start + 1, min( $cell_count, (int) ceil( $end_units ) ) );

		return array(
			'offset_percent'        => round( 100 * $start_units / $cell_count, 8 ),
			'width_percent'         => round( 100 * max( 0, $end_units - $start_units ) / $cell_count, 8 ),
			'visual_offset_percent' => round( 100 * $visual_start / $cell_count, 8 ),
			'visual_width_percent'  => round( 100 * ( $visual_end - $visual_start ) / $cell_count, 8 ),
		);
	}

	/**
	 * Build ordered cells, preserving explicit local UTC offsets.
	 *
	 * @param DateTimeImmutable $window_start Inclusive boundary.
	 * @param DateTimeImmutable $window_end   Exclusive boundary.
	 * @param int               $cell_minutes Cell duration.
	 * @param DateTimeZone      $timezone     Site timezone.
	 *
	 * @return array<int,array<string,mixed>> Axis cells.
	 */
	private function build_cells( $window_start, $window_end, $cell_minutes, $timezone ) {
		$cells                 = array();
		$wall_time_hits        = array();
		$wall_time_occurrences = array();
		$previous_offset       = null;
		$day_start             = $window_start;

		while ( $day_start < $window_end ) {
			$day_end = $day_start->modify( '+1 day' );
			if ( $day_end > $window_end ) {
				$day_end = $window_end;
			}
			$bucket_start_epoch = $day_start->getTimestamp();
			$day_end_epoch      = $day_end->getTimestamp();
			$step_seconds       = DAY_IN_SECONDS / MINUTE_IN_SECONDS === $cell_minutes
				? max( 1, $day_end_epoch - $bucket_start_epoch )
				: $cell_minutes * MINUTE_IN_SECONDS;

			while ( $bucket_start_epoch < $day_end_epoch ) {
				$bucket_end_epoch = min( $day_end_epoch, $bucket_start_epoch + $step_seconds );
				$bucket_start     = ( new DateTimeImmutable( '@' . $bucket_start_epoch ) )->setTimezone( $timezone );
				$bucket_end       = ( new DateTimeImmutable( '@' . $bucket_end_epoch ) )->setTimezone( $timezone );
				$utc_offset       = $bucket_start->format( 'P' );
				$wall_time_key    = $bucket_start->format( 'Y-m-d H:i' );
				$wall_time_hits[ $wall_time_key ] = isset( $wall_time_hits[ $wall_time_key ] ) ? $wall_time_hits[ $wall_time_key ] + 1 : 1;
				$wall_time_occurrences[ $wall_time_key ] = isset( $wall_time_occurrences[ $wall_time_key ] ) ? $wall_time_occurrences[ $wall_time_key ] + 1 : 1;
				$wall_end_minute = $bucket_end->format( 'Y-m-d' ) === $bucket_start->format( 'Y-m-d' )
					? $this->get_wall_minute( $bucket_end, $bucket_start->format( 'Y-m-d' ) )
					: 24 * HOUR_IN_SECONDS / MINUTE_IN_SECONDS;

				$cells[] = array(
					'key'               => $bucket_start->format( 'Ymd-His-P' ),
					'date'              => $bucket_start->format( 'Y-m-d' ),
					'month_key'         => $bucket_start->format( 'Y-m' ),
					'month_label'       => wp_date( 'F Y', $bucket_start_epoch, $timezone ),
					'weekday_number'    => absint( $bucket_start->format( 'N' ) ),
					'start_at'          => $bucket_start->format( 'Y-m-d\TH:i:sP' ),
					'end_at'            => $bucket_end->format( 'Y-m-d\TH:i:sP' ),
					'start_epoch'       => $bucket_start_epoch,
					'end_epoch'         => $bucket_end_epoch,
					'utc_offset'        => $utc_offset,
					'wall_start_minute' => $this->get_wall_minute( $bucket_start, $bucket_start->format( 'Y-m-d' ) ),
					'wall_end_minute'   => $wall_end_minute,
					'wall_occurrence'   => $wall_time_occurrences[ $wall_time_key ],
					'occurrence_id'     => 'wall-' . $bucket_start->format( 'Ymd-Hi' ) . '-' . $wall_time_occurrences[ $wall_time_key ] . '-' . $bucket_start_epoch,
					'primary_label'     => DAY_IN_SECONDS / MINUTE_IN_SECONDS === $cell_minutes
						? wp_date( 'D', $bucket_start_epoch, $timezone )
						: wp_date( get_option( 'time_format' ), $bucket_start_epoch, $timezone ),
					'day_number'        => wp_date( 'j', $bucket_start_epoch, $timezone ),
					'is_dst_transition' => null !== $previous_offset && $previous_offset !== $utc_offset,
					'is_repeated_time'  => false,
				);
				$previous_offset    = $utc_offset;
				$bucket_start_epoch = $bucket_end_epoch;
			}
			$day_start = $day_end;
		}

		foreach ( $cells as &$cell ) {
			$wall_time_key             = substr( $cell['start_at'], 0, 16 );
			$wall_time_key             = str_replace( 'T', ' ', $wall_time_key );
			$cell['is_repeated_time'] = isset( $wall_time_hits[ $wall_time_key ] ) && 1 < $wall_time_hits[ $wall_time_key ];
		}
		unset( $cell );

		return $cells;
	}

	/**
	 * Build exact local-midnight and transition metadata for one site-local date.
	 *
	 * The metadata is presentation-neutral. Consumers can project local wall-time
	 * ranges without inferring a 24-hour duration or querying timezone rules.
	 *
	 * @param string       $date_key SQL-formatted site-local date.
	 * @param DateTimeZone $timezone Site timezone used by the Timeline window.
	 *
	 * @return array<string,mixed> JSON-safe date boundary and transition fields.
	 */
	private function build_date_band_metadata( $date_key, $timezone ) {
		$day_start = new DateTimeImmutable( $date_key . ' 00:00:00', $timezone );
		$day_end   = $day_start->modify( '+1 day' );

		return array(
			'start_at'                 => $day_start->format( 'Y-m-d\TH:i:sP' ),
			'end_at'                   => $day_end->format( 'Y-m-d\TH:i:sP' ),
			'start_epoch'              => $day_start->getTimestamp(),
			'end_epoch'                => $day_end->getTimestamp(),
			'elapsed_minutes'          => (int) ( ( $day_end->getTimestamp() - $day_start->getTimestamp() ) / MINUTE_IN_SECONDS ),
			'wall_minutes'             => 24 * HOUR_IN_SECONDS / MINUTE_IN_SECONDS,
			'utc_offset_start_seconds' => $day_start->getOffset(),
			'utc_offset_end_seconds'   => $day_end->getOffset(),
			'transitions'              => $this->build_date_transitions( $date_key, $day_start, $day_end, $timezone ),
		);
	}

	/**
	 * Return exact UTC-offset transitions inside one half-open local date.
	 *
	 * Offset-explicit wall boundaries identify both missing local time (gap) and
	 * repeated local time (fold) without requiring browser timezone arithmetic.
	 *
	 * @param string            $date_key SQL-formatted site-local date.
	 * @param DateTimeImmutable $day_start Inclusive local-midnight boundary.
	 * @param DateTimeImmutable $day_end   Exclusive next-midnight boundary.
	 * @param DateTimeZone      $timezone  Site timezone used by the Timeline.
	 *
	 * @return array<int,array<string,mixed>> Ordered JSON-safe transitions.
	 */
	private function build_date_transitions( $date_key, $day_start, $day_end, $timezone ) {
		$timezone_transitions = $timezone->getTransitions( $day_start->getTimestamp() - 1, $day_end->getTimestamp() );
		if ( false === $timezone_transitions || 2 > count( $timezone_transitions ) ) {
			return array();
		}

		$transitions     = array();
		$previous_offset = (int) $timezone_transitions[0]['offset'];
		foreach ( array_slice( $timezone_transitions, 1 ) as $timezone_transition ) {
			$transition_epoch = isset( $timezone_transition['ts'] ) ? (int) $timezone_transition['ts'] : 0;
			$current_offset    = isset( $timezone_transition['offset'] ) ? (int) $timezone_transition['offset'] : $previous_offset;
			if ( $transition_epoch < $day_start->getTimestamp() || $transition_epoch >= $day_end->getTimestamp() || $current_offset === $previous_offset ) {
				$previous_offset = $current_offset;
				continue;
			}

			$offset_delta_seconds = $current_offset - $previous_offset;
			$instant_utc          = new DateTimeImmutable( '@' . $transition_epoch );
			$local_before         = $instant_utc->setTimezone( $this->get_fixed_offset_timezone( $previous_offset ) );
			$local_after          = $instant_utc->setTimezone( $this->get_fixed_offset_timezone( $current_offset ) );
			$wall_before_minute   = $this->get_wall_minute( $local_before, $date_key );
			$wall_after_minute    = $this->get_wall_minute( $local_after, $date_key );

			$transitions[] = array(
				'transition_id'          => 'transition-' . $transition_epoch . '-' . $previous_offset . '-' . $current_offset,
				'at'                     => $instant_utc->setTimezone( $timezone )->format( 'Y-m-d\TH:i:sP' ),
				'epoch'                  => $transition_epoch,
				'kind'                   => 0 < $offset_delta_seconds ? 'gap' : 'fold',
				'offset_before_seconds'  => $previous_offset,
				'offset_after_seconds'   => $current_offset,
				'delta_minutes'           => (int) ( $offset_delta_seconds / MINUTE_IN_SECONDS ),
				'local_before_at'         => $local_before->format( 'Y-m-d\TH:i:sP' ),
				'local_after_at'          => $local_after->format( 'Y-m-d\TH:i:sP' ),
				'wall_range_start_minute' => max( 0, min( 24 * HOUR_IN_SECONDS / MINUTE_IN_SECONDS, min( $wall_before_minute, $wall_after_minute ) ) ),
				'wall_range_end_minute'   => max( 0, min( 24 * HOUR_IN_SECONDS / MINUTE_IN_SECONDS, max( $wall_before_minute, $wall_after_minute ) ) ),
			);
			$previous_offset = $current_offset;
		}

		return $transitions;
	}

	/**
	 * Build a fixed-offset timezone for an exact transition boundary.
	 *
	 * @param int $offset_seconds Signed UTC offset in seconds.
	 *
	 * @return DateTimeZone Fixed-offset timezone.
	 */
	private function get_fixed_offset_timezone( $offset_seconds ) {
		$absolute_seconds = abs( (int) $offset_seconds );
		$offset_hours     = (int) floor( $absolute_seconds / HOUR_IN_SECONDS );
		$offset_minutes   = (int) floor( ( $absolute_seconds % HOUR_IN_SECONDS ) / MINUTE_IN_SECONDS );
		$offset_name      = sprintf( '%s%02d:%02d', 0 > $offset_seconds ? '-' : '+', $offset_hours, $offset_minutes );

		return new DateTimeZone( $offset_name );
	}

	/**
	 * Convert an offset-explicit local instant to a minute on one civil date.
	 *
	 * Values may fall outside the 0-to-1440 range when an offset transition
	 * crosses a civil-date boundary. Transition DTOs clamp those edge values.
	 *
	 * @param DateTimeImmutable $instant  Offset-explicit local instant.
	 * @param string            $date_key SQL-formatted reference date.
	 *
	 * @return int Signed wall minute relative to the reference local midnight.
	 */
	private function get_wall_minute( $instant, $date_key ) {
		$utc_timezone     = new DateTimeZone( 'UTC' );
		$reference_date   = new DateTimeImmutable( $date_key . ' 00:00:00', $utc_timezone );
		$instant_date     = new DateTimeImmutable( $instant->format( 'Y-m-d' ) . ' 00:00:00', $utc_timezone );
		$relative_days    = (int) ( ( $instant_date->getTimestamp() - $reference_date->getTimestamp() ) / DAY_IN_SECONDS );
		$minute_of_day    = ( (int) $instant->format( 'H' ) * HOUR_IN_SECONDS + (int) $instant->format( 'i' ) * MINUTE_IN_SECONDS ) / MINUTE_IN_SECONDS;

		return $relative_days * 24 * HOUR_IN_SECONDS / MINUTE_IN_SECONDS + (int) $minute_of_day;
	}

	/**
	 * Locate one timestamp on the equal-width visual cell axis.
	 *
	 * @param int                            $timestamp Unix timestamp.
	 * @param array<int,array<string,mixed>> $cells     Ordered axis cells.
	 *
	 * @return float Position expressed in visual cell units.
	 */
	private function map_timestamp_to_position( $timestamp, $cells ) {
		$cell_count = count( $cells );
		if ( 0 === $cell_count || $timestamp <= (int) $cells[0]['start_epoch'] ) {
			return 0.0;
		}
		if ( $timestamp >= (int) $cells[ $cell_count - 1 ]['end_epoch'] ) {
			return (float) $cell_count;
		}

		$low  = 0;
		$high = $cell_count - 1;
		while ( $low <= $high ) {
			$middle = (int) floor( ( $low + $high ) / 2 );
			$start  = (int) $cells[ $middle ]['start_epoch'];
			$end    = (int) $cells[ $middle ]['end_epoch'];
			if ( $timestamp < $start ) {
				$high = $middle - 1;
				continue;
			}
			if ( $timestamp >= $end ) {
				$low = $middle + 1;
				continue;
			}

			return $middle + ( $timestamp - $start ) / max( 1, $end - $start );
		}

		return (float) max( 0, min( $cell_count, $low ) );
	}

	/**
	 * Resolve a validated site timezone.
	 *
	 * @param array<string,mixed> $window Window contract.
	 *
	 * @return DateTimeZone Site timezone.
	 */
	private function get_timezone( $window ) {
		if ( ! empty( $window['timezone'] ) ) {
			try {
				return new DateTimeZone( (string) $window['timezone'] );
			} catch ( Exception $exception ) {
				unset( $exception );
			}
		}

		return function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
	}

	/**
	 * Resolve one normalized window boundary.
	 *
	 * @param array<string,mixed> $window      Window contract.
	 * @param string              $instant_key RFC3339 field.
	 * @param string              $date_key    SQL-date fallback field.
	 * @param DateTimeZone        $timezone    Site timezone.
	 *
	 * @return DateTimeImmutable Boundary in the site timezone.
	 */
	private function get_boundary( $window, $instant_key, $date_key, $timezone ) {
		if ( ! empty( $window[ $instant_key ] ) ) {
			return $this->parse_instant( $window[ $instant_key ], $timezone );
		}

		return new DateTimeImmutable( (string) $window[ $date_key ] . ' 00:00:00', $timezone );
	}

	/**
	 * Parse an RFC3339 instant and normalize it to the site timezone.
	 *
	 * @param mixed        $instant  Candidate instant.
	 * @param DateTimeZone $timezone Site timezone.
	 *
	 * @return DateTimeImmutable Parsed instant or current site-local time.
	 */
	private function parse_instant( $instant, $timezone ) {
		try {
			return ( new DateTimeImmutable( (string) $instant ) )->setTimezone( $timezone );
		} catch ( Exception $exception ) {
			unset( $exception );
			return new DateTimeImmutable( 'now', $timezone );
		}
	}

	/**
	 * Return a readable width for one visual bucket.
	 *
	 * @param int $cell_minutes Cell duration.
	 *
	 * @return int CSS pixel width.
	 */
	private function get_cell_width( $cell_minutes ) {
		if ( 360 <= $cell_minutes ) {
			return 96;
		}
		if ( 120 <= $cell_minutes ) {
			return 84;
		}
		if ( 60 <= $cell_minutes ) {
			return 76;
		}

		return 64;
	}

	/**
	 * Format the compact visible range.
	 *
	 * @param DateTimeImmutable $first_day First visible boundary.
	 * @param DateTimeImmutable $last_day  Last visible instant.
	 * @param DateTimeZone      $timezone  Site timezone.
	 *
	 * @return string Localized range.
	 */
	private function format_range_label( $first_day, $last_day, $timezone ) {
		if ( $first_day->format( 'Y-m' ) === $last_day->format( 'Y-m' ) ) {
			return sprintf(
				/* translators: 1: abbreviated month and first day, 2: last day and year. */
				__( '%1$s – %2$s', 'booking' ),
				wp_date( 'M j', $first_day->getTimestamp(), $timezone ),
				wp_date( 'j, Y', $last_day->getTimestamp(), $timezone )
			);
		}

		return sprintf(
			/* translators: 1: first visible date, 2: last visible date. */
			__( '%1$s – %2$s', 'booking' ),
			wp_date( 'M j, Y', $first_day->getTimestamp(), $timezone ),
			wp_date( 'M j, Y', $last_day->getTimestamp(), $timezone )
		);
	}
}
