<?php
/**
 * Authorized unavailable-interval projection for Timeline backgrounds.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Compose canonical Availability-domain sources into normalized intervals.
 *
 * Every returned interval is half-open and clipped to the requested window.
 * A source that cannot be evaluated exactly is represented by an `unknown`
 * coverage record; absence of an interval never converts unknown data into an
 * available assertion.
 */
final class WPBC_Timeline_Unavailable_Days_BG_Projection {

	/** Maximum legacy booking buffer accepted by this bounded read. */
	const MAX_BOOKING_BUFFER_SECONDS = 31622400;

	/** @var array<int,array<string,mixed>> Owner-aware settings keyed by Resource ID. */
	private $resource_settings = array();

	/** @var string Cache fingerprint for the currently loaded Resource batch. */
	private $resource_settings_key = '';

	/**
	 * Return the internal booking query window required by saved booking buffers.
	 *
	 * The visible window remains unchanged. The start expands by the largest
	 * check-out buffer and the end expands by the largest check-in buffer so a
	 * booking immediately outside the visible range can still contribute an
	 * overlapping buffer interval.
	 *
	 * @param array<int,array<string,mixed>> $resources Authorized Resources.
	 * @param array<string,mixed>            $window    Validated Timeline window.
	 *
	 * @return array<string,mixed> Expanded internal query window.
	 */
	public function get_booking_query_window( $resources, $window ) {
		$settings   = $this->get_resource_settings( $resources );
		$max_before = 0;
		$max_after  = 0;
		foreach ( $settings as $resource_settings ) {
			if ( 'exact' !== $resource_settings['booking_buffer_state'] || ! empty( $resource_settings['bookings_always_available'] ) ) {
				continue;
			}
			$max_before = max( $max_before, absint( $resource_settings['buffer_before_seconds'] ) );
			$max_after  = max( $max_after, absint( $resource_settings['buffer_after_seconds'] ) );
		}
		if ( 0 === $max_before && 0 === $max_after ) {
			return $window;
		}

		$timezone = new DateTimeZone( (string) $window['timezone'] );
		$start    = new DateTimeImmutable( isset( $window['start_at'] ) ? $window['start_at'] : $window['start_date'] . ' 00:00:00', $timezone );
		$end      = new DateTimeImmutable( isset( $window['end_at'] ) ? $window['end_at'] : $window['end_date'] . ' 00:00:00', $timezone );
		$start    = $start->setTimestamp( $start->getTimestamp() - $max_after );
		$end      = $end->setTimestamp( $end->getTimestamp() + $max_before );
		$end_date = $end->format( 'Y-m-d' );
		if ( '00:00:00' !== $end->format( 'H:i:s' ) ) {
			$end_date = $end->modify( '+1 day' )->format( 'Y-m-d' );
		}

		$query_window               = $window;
		$query_window['start_date'] = $start->format( 'Y-m-d' );
		$query_window['end_date']   = $end_date;
		$query_window['start_at']   = ( new DateTimeImmutable( $query_window['start_date'] . ' 00:00:00', $timezone ) )->format( 'Y-m-d\TH:i:sP' );
		$query_window['end_at']     = ( new DateTimeImmutable( $query_window['end_date'] . ' 00:00:00', $timezone ) )->format( 'Y-m-d\TH:i:sP' );

		return $query_window;
	}

	/**
	 * Build exact unavailable intervals for one authorized Timeline window.
	 *
	 * @param array<int,array<string,mixed>> $resources      Authorized Resources.
	 * @param array<string,mixed>            $window         Validated Timeline window.
	 * @param array<string,mixed>            $booking_window Canonical booking projection.
	 *
	 * @return array<string,mixed>|WP_Error Normalized data-only DTO or safe error.
	 */
	public function project( $resources, $window, $booking_window ) {
		$resource_ids = array_values( array_filter( array_map( 'absint', wp_list_pluck( $resources, 'id' ) ) ) );
		$dates        = $this->get_dates( $window );
		$timezone     = new DateTimeZone( (string) $window['timezone'] );
		$window_start = ( new DateTimeImmutable( isset( $window['start_at'] ) ? $window['start_at'] : $window['start_date'] . ' 00:00:00', $timezone ) )->getTimestamp();
		$window_end   = ( new DateTimeImmutable( isset( $window['end_at'] ) ? $window['end_at'] : $window['end_date'] . ' 00:00:00', $timezone ) )->getTimestamp();
		$settings     = $this->get_resource_settings( $resources );
		$coverage     = $this->initialize_coverage( $resource_ids );
		$unknown      = array();
		$intervals    = array();

		$this->project_blocked_dates( $resource_ids, $dates, $timezone, $window_start, $window_end, $coverage, $unknown, $intervals );
		$this->project_blocked_times( $resource_ids, $window, $timezone, $window_start, $window_end, $coverage, $unknown, $intervals );
		$this->project_owner_rules( $resources, $dates, $settings, $timezone, $window_start, $window_end, $coverage, $unknown, $intervals );
		$this->project_seasonal_availability( $resources, $dates, $timezone, $window_start, $window_end, $coverage, $unknown, $intervals );
		$this->project_booking_buffers( $resources, $settings, $booking_window, $timezone, $window_start, $window_end, $coverage, $unknown, $intervals );
		$this->project_appointment_buffers( $resource_ids, $window, $timezone, $window_start, $window_end, $coverage, $unknown, $intervals );

		$intervals = $this->normalize_intervals( $intervals, $timezone );
		$coverage  = $this->flatten_coverage( $coverage );

		return array(
			'load_state' => empty( $unknown ) ? 'loaded' : 'partial',
			'intervals'  => $intervals,
			'coverage'   => $coverage,
			'unknown'    => array_values( $unknown ),
			'sources'    => array_values( self::get_source_definitions() ),
		);
	}

	/**
	 * Initialize source coverage for each authorized Resource.
	 *
	 * @param int[] $resource_ids Resource IDs.
	 *
	 * @return array<int,array<string,array<string,mixed>>> Coverage map.
	 */
	private function initialize_coverage( $resource_ids ) {
		$coverage = array();
		foreach ( $resource_ids as $resource_id ) {
			foreach ( self::get_source_definitions() as $source_id => $definition ) {
				$coverage[ $resource_id ][ $source_id ] = array(
					'resource_id' => $resource_id,
					'source'      => $source_id,
					'state'       => 'exact',
				);
			}
		}

		return $coverage;
	}

	/**
	 * Return stable source labels for rendering and accessible legends.
	 *
	 * @return array<string,array<string,string>> Source definitions.
	 */
	public static function get_source_definitions() {
		return array(
			'blocked_date'          => array( 'id' => 'blocked_date', 'label' => __( 'Blocked date', 'booking' ) ),
			'blocked_time'          => array( 'id' => 'blocked_time', 'label' => __( 'Blocked time', 'booking' ) ),
			'unavailable_weekday'   => array( 'id' => 'unavailable_weekday', 'label' => __( 'Unavailable weekday', 'booking' ) ),
			'working_time'          => array( 'id' => 'working_time', 'label' => __( 'Working Time', 'booking' ) ),
			'seasonal_availability' => array( 'id' => 'seasonal_availability', 'label' => __( 'Seasonal Availability', 'booking' ) ),
			'booking_buffer'        => array( 'id' => 'booking_buffer', 'label' => __( 'Booking buffer', 'booking' ) ),
			'appointment_buffer'    => array( 'id' => 'appointment_buffer', 'label' => __( 'Appointment buffer', 'booking' ) ),
		);
	}

	/**
	 * Project explicit full-date blocks through the canonical batch provider.
	 *
	 * @param int[]             $resource_ids Resource IDs.
	 * @param string[]          $dates Visible SQL dates.
	 * @param DateTimeZone      $timezone Site timezone.
	 * @param int               $window_start Window start timestamp.
	 * @param int               $window_end Window end timestamp.
	 * @param array             $coverage Coverage map, by reference.
	 * @param array             $unknown Unknown records, by reference.
	 * @param array             $intervals Intervals, by reference.
	 *
	 * @return void
	 */
	private function project_blocked_dates( $resource_ids, $dates, $timezone, $window_start, $window_end, &$coverage, &$unknown, &$intervals ) {
		global $wpdb;

		if ( ! function_exists( 'wpbc_for_resources_arr__get_unavailable_dates' ) ) {
			$this->mark_all_unknown( $resource_ids, 'blocked_date', 'blocked_date_provider_unavailable', $coverage, $unknown );
			return;
		}
		$query_dates = $dates;
		if ( 1 === count( $query_dates ) ) {
			$query_dates[] = $query_dates[0];
		}
		$blocks = wpbc_for_resources_arr__get_unavailable_dates( $resource_ids, $query_dates, $this->get_maximum_source_rows() );
		if ( is_wp_error( $blocks ) ) {
			$this->mark_all_unknown( $resource_ids, 'blocked_date', sanitize_key( $blocks->get_error_code() ), $coverage, $unknown );
			return;
		}
		if ( '' !== (string) $wpdb->last_error || ! is_array( $blocks ) ) {
			$this->mark_all_unknown( $resource_ids, 'blocked_date', 'blocked_date_query_failed', $coverage, $unknown );
			return;
		}
		$date_map = array_fill_keys( $dates, true );
		foreach ( $blocks as $resource_id => $blocked_dates ) {
			foreach ( array_unique( (array) $blocked_dates ) as $blocked_date ) {
				if ( isset( $date_map[ $blocked_date ] ) ) {
					$this->add_local_day_interval( $intervals, $unknown, $coverage, absint( $resource_id ), 'blocked_date', $blocked_date, $timezone, $window_start, $window_end );
				}
			}
		}
	}

	/**
	 * Project manual time blocks in one canonical batch read.
	 *
	 * @param int[]        $resource_ids Resource IDs.
	 * @param array        $window Validated window.
	 * @param DateTimeZone $timezone Site timezone.
	 * @param int          $window_start Window start timestamp.
	 * @param int          $window_end Window end timestamp.
	 * @param array        $coverage Coverage map, by reference.
	 * @param array        $unknown Unknown records, by reference.
	 * @param array        $intervals Intervals, by reference.
	 *
	 * @return void
	 */
	private function project_blocked_times( $resource_ids, $window, $timezone, $window_start, $window_end, &$coverage, &$unknown, &$intervals ) {
		global $wpdb;

		if ( ! function_exists( 'wpbc_availability_timeslots__get_intervals_for_resources' ) ) {
			$this->mark_all_unknown( $resource_ids, 'blocked_time', 'blocked_time_provider_unavailable', $coverage, $unknown );
			return;
		}
		if ( ! function_exists( 'wpbc_is_table_exists' ) || ! wpbc_is_table_exists( 'booking_availability_timeslots' ) ) {
			$this->mark_all_state( $resource_ids, 'blocked_time', 'not_applicable', $coverage );
			return;
		}
		$end_date = ( new DateTimeImmutable( $window['end_date'] . ' 00:00:00', $timezone ) )->modify( '-1 day' )->format( 'Y-m-d' );
		$blocks   = wpbc_availability_timeslots__get_intervals_for_resources(
			array(
				'resource_id' => $resource_ids,
				'date_start'  => $window['start_date'],
				'date_end'    => $end_date,
				'maximum_rows' => $this->get_maximum_source_rows(),
			)
		);
		if ( is_wp_error( $blocks ) ) {
			$this->mark_all_unknown( $resource_ids, 'blocked_time', sanitize_key( $blocks->get_error_code() ), $coverage, $unknown );
			return;
		}
		if ( '' !== (string) $wpdb->last_error || ! is_array( $blocks ) ) {
			$this->mark_all_unknown( $resource_ids, 'blocked_time', 'blocked_time_query_failed', $coverage, $unknown );
			return;
		}
		foreach ( $blocks as $sql_date => $resource_blocks ) {
			foreach ( (array) $resource_blocks as $resource_id => $resource_intervals ) {
				foreach ( (array) $resource_intervals as $resource_interval ) {
					$this->add_local_seconds_interval(
						$intervals,
						$unknown,
						$coverage,
						absint( $resource_id ),
						'blocked_time',
						$sql_date,
						isset( $resource_interval['start_second'] ) ? absint( $resource_interval['start_second'] ) : 0,
						isset( $resource_interval['end_second'] ) ? absint( $resource_interval['end_second'] ) : DAY_IN_SECONDS,
						$timezone,
						$window_start,
						$window_end
					);
				}
			}
		}
	}

	/**
	 * Project owner-specific weekday and Working Time rules.
	 *
	 * @param array        $resources Authorized Resources.
	 * @param string[]     $dates Visible SQL dates.
	 * @param array        $settings Resource settings.
	 * @param DateTimeZone $timezone Site timezone.
	 * @param int          $window_start Window start timestamp.
	 * @param int          $window_end Window end timestamp.
	 * @param array        $coverage Coverage map, by reference.
	 * @param array        $unknown Unknown records, by reference.
	 * @param array        $intervals Intervals, by reference.
	 *
	 * @return void
	 */
	private function project_owner_rules( $resources, $dates, $settings, $timezone, $window_start, $window_end, &$coverage, &$unknown, &$intervals ) {
		foreach ( $resources as $resource ) {
			$resource_id      = absint( $resource['id'] );
			$resource_settings = isset( $settings[ $resource_id ] ) ? $settings[ $resource_id ] : array();
			if ( empty( $resource_settings ) ) {
				$this->mark_unknown( $resource_id, 'unavailable_weekday', 'owner_settings_unavailable', $coverage, $unknown );
				$this->mark_unknown( $resource_id, 'working_time', 'owner_settings_unavailable', $coverage, $unknown );
				continue;
			}
			if ( 'unknown' === $resource_settings['working_time_state'] ) {
				$this->mark_unknown( $resource_id, 'working_time', 'working_time_provider_unavailable', $coverage, $unknown );
			}
			foreach ( $dates as $sql_date ) {
				$weekday = (int) gmdate( 'w', strtotime( $sql_date . ' 00:00:00 UTC' ) );
				if ( in_array( $weekday, $resource_settings['unavailable_weekdays'], true ) ) {
					$this->add_local_day_interval( $intervals, $unknown, $coverage, $resource_id, 'unavailable_weekday', $sql_date, $timezone, $window_start, $window_end );
				}
				if ( 'exact' !== $resource_settings['working_time_state'] || false === $resource_settings['working_time_rule'] ) {
					continue;
				}
				$working_intervals = isset( $resource_settings['working_time_rule']['weekdays'][ $weekday ] )
					? $resource_settings['working_time_rule']['weekdays'][ $weekday ]
					: array();
				$cursor = 0;
				foreach ( $working_intervals as $working_interval ) {
					$start_second = isset( $working_interval['start_second'] ) ? absint( $working_interval['start_second'] ) : 0;
					$end_second   = isset( $working_interval['end_second'] ) ? absint( $working_interval['end_second'] ) : 0;
					if ( $cursor < $start_second ) {
						$this->add_local_seconds_interval( $intervals, $unknown, $coverage, $resource_id, 'working_time', $sql_date, $cursor, $start_second, $timezone, $window_start, $window_end );
					}
					$cursor = max( $cursor, $end_second );
				}
				if ( $cursor < DAY_IN_SECONDS ) {
					$this->add_local_seconds_interval( $intervals, $unknown, $coverage, $resource_id, 'working_time', $sql_date, $cursor, DAY_IN_SECONDS, $timezone, $window_start, $window_end );
				}
			}
		}
	}

	/**
	 * Project Seasonal Availability through its domain-owned repository.
	 *
	 * @param array        $resources Authorized Resources.
	 * @param string[]     $dates Visible dates.
	 * @param DateTimeZone $timezone Site timezone.
	 * @param int          $window_start Window start timestamp.
	 * @param int          $window_end Window end timestamp.
	 * @param array        $coverage Coverage map, by reference.
	 * @param array        $unknown Unknown records, by reference.
	 * @param array        $intervals Intervals, by reference.
	 *
	 * @return void
	 */
	private function project_seasonal_availability( $resources, $dates, $timezone, $window_start, $window_end, &$coverage, &$unknown, &$intervals ) {
		$resource_ids = array_values( array_filter( array_map( 'absint', wp_list_pluck( $resources, 'id' ) ) ) );
		if ( ! class_exists( 'wpdev_bk_biz_m' ) ) {
			$this->mark_all_state( $resource_ids, 'seasonal_availability', 'not_applicable', $coverage );
			return;
		}
		if ( ! class_exists( 'WPBC_Catalog_Availability_Repository' ) ) {
			$this->mark_all_unknown( $resource_ids, 'seasonal_availability', 'seasonal_provider_unavailable', $coverage, $unknown );
			return;
		}
		$projection = ( new WPBC_Catalog_Availability_Repository() )->get_unavailable_date_projection( $resources, $dates );
		if ( is_wp_error( $projection ) ) {
			$this->mark_all_unknown( $resource_ids, 'seasonal_availability', 'seasonal_query_failed', $coverage, $unknown );
			return;
		}
		foreach ( isset( $projection['unknown'] ) ? $projection['unknown'] : array() as $resource_id => $reason ) {
			$this->mark_unknown( absint( $resource_id ), 'seasonal_availability', sanitize_key( $reason ), $coverage, $unknown );
		}
		foreach ( isset( $projection['unavailable_dates'] ) ? $projection['unavailable_dates'] : array() as $resource_id => $unavailable_dates ) {
			foreach ( $unavailable_dates as $sql_date ) {
				$this->add_local_day_interval( $intervals, $unknown, $coverage, absint( $resource_id ), 'seasonal_availability', $sql_date, $timezone, $window_start, $window_end );
			}
		}
	}

	/**
	 * Project canonical booking gaps from saved settings and exact booking spans.
	 *
	 * @param array        $resources Authorized Resources.
	 * @param array        $settings Resource settings.
	 * @param array        $booking_window Booking projection.
	 * @param DateTimeZone $timezone Site timezone.
	 * @param int          $window_start Window start timestamp.
	 * @param int          $window_end Window end timestamp.
	 * @param array        $coverage Coverage map, by reference.
	 * @param array        $unknown Unknown records, by reference.
	 * @param array        $intervals Intervals, by reference.
	 *
	 * @return void
	 */
	private function project_booking_buffers( $resources, $settings, $booking_window, $timezone, $window_start, $window_end, &$coverage, &$unknown, &$intervals ) {
		$canonical_intervals = isset( $booking_window['canonical_intervals'] ) && is_array( $booking_window['canonical_intervals'] )
			? $booking_window['canonical_intervals']
			: null;
		foreach ( $resources as $resource ) {
			$resource_id = absint( $resource['id'] );
			if ( ! isset( $settings[ $resource_id ] ) ) {
				$this->mark_unknown( $resource_id, 'booking_buffer', 'booking_buffer_settings_unavailable', $coverage, $unknown );
				continue;
			}
			$resource_settings = $settings[ $resource_id ];
			if ( 'not_applicable' === $resource_settings['booking_buffer_state'] ) {
				$coverage[ $resource_id ]['booking_buffer']['state'] = 'not_applicable';
				continue;
			}
			if ( 'unknown' === $resource_settings['booking_buffer_state'] ) {
				$this->mark_unknown( $resource_id, 'booking_buffer', 'booking_buffer_settings_invalid', $coverage, $unknown );
				continue;
			}
			$before_seconds = absint( $resource_settings['buffer_before_seconds'] );
			$after_seconds  = absint( $resource_settings['buffer_after_seconds'] );
			if ( ! empty( $resource_settings['bookings_always_available'] ) ) {
				continue;
			}
			if ( 0 === $before_seconds && 0 === $after_seconds ) {
				continue;
			}
			if ( null === $canonical_intervals ) {
				$this->mark_unknown( $resource_id, 'booking_buffer', 'canonical_booking_intervals_unavailable', $coverage, $unknown );
				continue;
			}
			foreach ( $canonical_intervals as $booking_interval ) {
				if ( $resource_id !== absint( isset( $booking_interval['resource_id'] ) ? $booking_interval['resource_id'] : 0 ) ) {
					continue;
				}
				if ( ! empty( $resource_settings['pending_bookings_available'] ) && 'pending' === ( isset( $booking_interval['status'] ) ? $booking_interval['status'] : '' ) ) {
					continue;
				}
				if ( empty( $booking_interval['start'] ) || empty( $booking_interval['end'] ) ) {
					$this->mark_unknown( $resource_id, 'booking_buffer', 'canonical_booking_interval_invalid', $coverage, $unknown );
					continue;
				}
				try {
					$booking_start = ( new DateTimeImmutable( $booking_interval['start'] ) )->getTimestamp();
					$booking_end   = ( new DateTimeImmutable( $booking_interval['end'] ) )->getTimestamp();
				} catch ( Exception $exception ) {
					$this->mark_unknown( $resource_id, 'booking_buffer', 'canonical_booking_interval_invalid', $coverage, $unknown );
					continue;
				}
				$booking_id         = isset( $booking_interval['booking_id'] ) ? absint( $booking_interval['booking_id'] ) : 0;
				$related_segment_id = $booking_id
					? 'booking-' . $booking_id . '-resource-' . $resource_id . '-start-' . $booking_start
					: '';
				if ( $before_seconds ) {
					$this->add_timestamp_interval( $intervals, $resource_id, 'booking_buffer', $booking_start - $before_seconds, $booking_start, $window_start, $window_end, $related_segment_id );
				}
				if ( $after_seconds ) {
					$this->add_timestamp_interval( $intervals, $resource_id, 'booking_buffer', $booking_end, $booking_end + $after_seconds, $window_start, $window_end, $related_segment_id );
				}
			}
		}
	}

	/**
	 * Project immutable Appointment snapshot buffers in one batch.
	 *
	 * @param int[]        $resource_ids Resource IDs.
	 * @param array        $window Validated window.
	 * @param DateTimeZone $timezone Site timezone.
	 * @param int          $window_start Window start timestamp.
	 * @param int          $window_end Window end timestamp.
	 * @param array        $coverage Coverage map, by reference.
	 * @param array        $unknown Unknown records, by reference.
	 * @param array        $intervals Intervals, by reference.
	 *
	 * @return void
	 */
	private function project_appointment_buffers( $resource_ids, $window, $timezone, $window_start, $window_end, &$coverage, &$unknown, &$intervals ) {
		if ( ! function_exists( 'wpbc_appointment_services_get_existing_buffer_intervals_for_resources' ) ) {
			$this->mark_all_state( $resource_ids, 'appointment_buffer', 'not_applicable', $coverage );
			return;
		}
		if ( ! function_exists( 'wpbc_is_table_exists' ) || ! wpbc_is_table_exists( 'booking_appointment_details' ) ) {
			$this->mark_all_unknown( $resource_ids, 'appointment_buffer', 'appointment_storage_unavailable', $coverage, $unknown );
			return;
		}
		$configuration = wpbc_timeline_get_configuration();
		$maximum_rows = isset( $configuration['limits']['maximum_projection_date_rows'] )
			? max( 1, absint( $configuration['limits']['maximum_projection_date_rows'] ) )
			: 50000;
		$range_end = ( new DateTimeImmutable( $window['end_date'] . ' 00:00:00', $timezone ) )->modify( '-1 day' )->format( 'Y-m-d' );
		$snapshots = wpbc_appointment_services_get_existing_buffer_intervals_for_resources(
			$resource_ids,
			$window['start_date'],
			$range_end,
			array(),
			$maximum_rows
		);
		if ( is_wp_error( $snapshots ) ) {
			$this->mark_all_unknown( $resource_ids, 'appointment_buffer', sanitize_key( $snapshots->get_error_code() ), $coverage, $unknown );
			return;
		}
		$this->append_appointment_buffer_intervals( $snapshots, $window_start, $window_end, $intervals );
	}

	/**
	 * Append exact Appointment snapshot buffers to the interval collection.
	 *
	 * Keeping snapshot projection separate from the bounded provider call makes
	 * the immutable snapshot contract directly testable without duplicating its
	 * timestamp or booking-relation rules in development fixtures.
	 *
	 * @param array<int,array<int,array<string,mixed>>> $snapshots    Snapshot rows keyed by Resource ID.
	 * @param int                                       $window_start Window start timestamp.
	 * @param int                                       $window_end   Window end timestamp.
	 * @param array                                     $intervals    Intervals, by reference.
	 *
	 * @return void
	 */
	private function append_appointment_buffer_intervals( $snapshots, $window_start, $window_end, &$intervals ) {
		foreach ( $snapshots as $resource_id => $resource_snapshots ) {
			foreach ( $resource_snapshots as $snapshot ) {
				$start              = isset( $snapshot['start'] ) ? (int) $snapshot['start'] : 0;
				$end                = isset( $snapshot['end'] ) ? (int) $snapshot['end'] : 0;
				$before             = isset( $snapshot['buffer_before_minutes'] ) ? absint( $snapshot['buffer_before_minutes'] ) * MINUTE_IN_SECONDS : 0;
				$after              = isset( $snapshot['buffer_after_minutes'] ) ? absint( $snapshot['buffer_after_minutes'] ) * MINUTE_IN_SECONDS : 0;
				$booking_id         = isset( $snapshot['booking_id'] ) ? absint( $snapshot['booking_id'] ) : 0;
				$related_segment_id = $booking_id && $start
					? 'booking-' . $booking_id . '-resource-' . absint( $resource_id ) . '-start-' . $start
					: '';
				if ( $before ) {
					$this->add_timestamp_interval( $intervals, absint( $resource_id ), 'appointment_buffer', $start - $before, $start, $window_start, $window_end, $related_segment_id );
				}
				if ( $after ) {
					$this->add_timestamp_interval( $intervals, absint( $resource_id ), 'appointment_buffer', $end, $end + $after, $window_start, $window_end, $related_segment_id );
				}
			}
		}
	}

	/**
	 * Load owner-specific settings once per owner and Resource batch.
	 *
	 * @param array<int,array<string,mixed>> $resources Authorized Resources.
	 *
	 * @return array<int,array<string,mixed>> Settings keyed by Resource ID.
	 */
	private function get_resource_settings( $resources ) {
		$fingerprint_rows = array();
		$resources_by_owner = array();
		foreach ( $resources as $resource ) {
			$resource_id = isset( $resource['id'] ) ? absint( $resource['id'] ) : 0;
			$owner_id    = isset( $resource['owner_user_id'] ) ? absint( $resource['owner_user_id'] ) : 0;
			if ( $resource_id ) {
				$fingerprint_rows[]              = $resource_id . ':' . $owner_id;
				$resources_by_owner[ $owner_id ][] = $resource_id;
			}
		}
		sort( $fingerprint_rows, SORT_STRING );
		$settings_key = get_current_blog_id() . ':' . implode( '|', $fingerprint_rows );
		if ( $settings_key === $this->resource_settings_key ) {
			return $this->resource_settings;
		}

		$owner_ids = array_values( array_filter( array_map( 'absint', array_keys( $resources_by_owner ) ) ) );
		if ( class_exists( 'wpdev_bk_multiuser' ) && ! empty( $owner_ids ) && function_exists( 'update_meta_cache' ) ) {
			update_meta_cache( 'user', $owner_ids );
		}

		$settings_by_resource = array();
		foreach ( $resources_by_owner as $owner_id => $resource_ids ) {
			$previous_user = $this->activate_owner_context( $owner_id );
			$unavailable_weekdays = array();
			for ( $weekday = 0; $weekday <= 6; $weekday++ ) {
				if ( 'On' === get_bk_option( 'booking_unavailable_day' . $weekday ) ) {
					$unavailable_weekdays[] = $weekday;
				}
			}
			$working_rules = function_exists( 'wpbc_working_time__get_effective_rules_for_resources' )
				? wpbc_working_time__get_effective_rules_for_resources( $resource_ids )
				: array();
			$buffer_state = function_exists( 'wpbc_get_from_settings__extra_seconds__before_after' ) ? 'exact' : 'not_applicable';
			$buffer_before = 0;
			$buffer_after  = 0;
			$bookings_always_available = 'On' === get_bk_option( 'booking_is_days_always_available' );
			$pending_bookings_available = 'On' === get_bk_option( 'booking_is_show_pending_days_as_available' );
			if ( 'exact' === $buffer_state ) {
				list( $buffer_before, $buffer_after ) = wpbc_get_from_settings__extra_seconds__before_after();
				if (
					! is_numeric( $buffer_before )
					|| ! is_numeric( $buffer_after )
					|| (int) $buffer_before < 0
					|| (int) $buffer_after < 0
					|| self::MAX_BOOKING_BUFFER_SECONDS < (int) $buffer_before
					|| self::MAX_BOOKING_BUFFER_SECONDS < (int) $buffer_after
				) {
					$buffer_state  = 'unknown';
					$buffer_before = 0;
					$buffer_after  = 0;
				}
			}
			foreach ( $resource_ids as $resource_id ) {
				$settings_by_resource[ $resource_id ] = array(
					'unavailable_weekdays'  => $unavailable_weekdays,
					'working_time_state'    => function_exists( 'wpbc_working_time__get_effective_rules_for_resources' ) ? 'exact' : 'unknown',
					'working_time_rule'     => isset( $working_rules[ $resource_id ] ) ? $working_rules[ $resource_id ] : false,
					'booking_buffer_state'  => $buffer_state,
					'buffer_before_seconds' => absint( $buffer_before ),
					'buffer_after_seconds'  => absint( $buffer_after ),
					'bookings_always_available' => $bookings_always_available,
					'pending_bookings_available' => $pending_bookings_available,
				);
			}
			$this->restore_owner_context( $previous_user );
		}

		$this->resource_settings     = $settings_by_resource;
		$this->resource_settings_key = $settings_key;

		return $settings_by_resource;
	}

	/**
	 * Activate one already-authorized MultiUser owner.
	 *
	 * @param int $owner_id Owner WordPress user ID.
	 *
	 * @return mixed Previous environment token.
	 */
	private function activate_owner_context( $owner_id ) {
		if ( ! class_exists( 'wpdev_bk_multiuser' ) || ! absint( $owner_id ) ) {
			return null;
		}
		$previous_user = apply_bk_filter( 'get_client_side_active_params_of_user' );
		make_bk_action( 'check_multiuser_params_for_client_side_by_user_id', absint( $owner_id ) );

		return $previous_user;
	}

	/**
	 * Restore the previous MultiUser environment.
	 *
	 * @param mixed $previous_user Previous environment token.
	 *
	 * @return void
	 */
	private function restore_owner_context( $previous_user ) {
		if ( class_exists( 'wpdev_bk_multiuser' ) && null !== $previous_user ) {
			make_bk_action( 'wpbc_mu_set_environment_for_user', $previous_user );
		}
	}

	/**
	 * Add one full local day as a half-open interval.
	 *
	 * @param array        $intervals Intervals, by reference.
	 * @param array        $unknown Unknown records, by reference.
	 * @param array        $coverage Coverage map, by reference.
	 * @param int          $resource_id Resource ID.
	 * @param string       $source_id Source ID.
	 * @param string       $sql_date SQL date.
	 * @param DateTimeZone $timezone Site timezone.
	 * @param int          $window_start Window start timestamp.
	 * @param int          $window_end Window end timestamp.
	 *
	 * @return void
	 */
	private function add_local_day_interval( &$intervals, &$unknown, &$coverage, $resource_id, $source_id, $sql_date, $timezone, $window_start, $window_end ) {
		try {
			$start = new DateTimeImmutable( $sql_date . ' 00:00:00', $timezone );
			$end   = $start->modify( '+1 day' );
		} catch ( Exception $exception ) {
			$this->mark_unknown( $resource_id, $source_id, 'invalid_local_date', $coverage, $unknown );
			return;
		}
		$this->add_timestamp_interval( $intervals, $resource_id, $source_id, $start->getTimestamp(), $end->getTimestamp(), $window_start, $window_end );
	}

	/**
	 * Add seconds-in-day boundaries after rejecting DST gaps or repeated times.
	 *
	 * @param array        $intervals Intervals, by reference.
	 * @param array        $unknown Unknown records, by reference.
	 * @param array        $coverage Coverage map, by reference.
	 * @param int          $resource_id Resource ID.
	 * @param string       $source_id Source ID.
	 * @param string       $sql_date SQL date.
	 * @param int          $start_second Start second.
	 * @param int          $end_second End second.
	 * @param DateTimeZone $timezone Site timezone.
	 * @param int          $window_start Window start timestamp.
	 * @param int          $window_end Window end timestamp.
	 *
	 * @return void
	 */
	private function add_local_seconds_interval( &$intervals, &$unknown, &$coverage, $resource_id, $source_id, $sql_date, $start_second, $end_second, $timezone, $window_start, $window_end ) {
		$start_second = max( 0, min( DAY_IN_SECONDS, absint( $start_second ) ) );
		$end_second   = max( 0, min( DAY_IN_SECONDS, absint( $end_second ) ) );
		if ( $end_second <= $start_second ) {
			$this->mark_unknown( $resource_id, $source_id, 'invalid_local_interval', $coverage, $unknown );
			return;
		}
		$start = $this->get_local_boundary( $sql_date, $start_second, $timezone );
		$end   = $this->get_local_boundary( $sql_date, $end_second, $timezone );
		if ( false === $start || false === $end || $end->getTimestamp() <= $start->getTimestamp() ) {
			$this->mark_unknown( $resource_id, $source_id, 'ambiguous_or_invalid_dst_interval', $coverage, $unknown );
			return;
		}
		$this->add_timestamp_interval( $intervals, $resource_id, $source_id, $start->getTimestamp(), $end->getTimestamp(), $window_start, $window_end );
	}

	/**
	 * Resolve one site-local wall-clock boundary without guessing a DST fold.
	 *
	 * @param string       $sql_date SQL date.
	 * @param int          $second_in_day Seconds after local midnight.
	 * @param DateTimeZone $timezone Site timezone.
	 *
	 * @return DateTimeImmutable|false Exact boundary or false when ambiguous/invalid.
	 */
	private function get_local_boundary( $sql_date, $second_in_day, $timezone ) {
		$day = new DateTimeImmutable( $sql_date . ' 00:00:00', $timezone );
		if ( DAY_IN_SECONDS === $second_in_day ) {
			return $day->modify( '+1 day' );
		}
		$hours   = (int) floor( $second_in_day / HOUR_IN_SECONDS );
		$minutes = (int) floor( ( $second_in_day % HOUR_IN_SECONDS ) / MINUTE_IN_SECONDS );
		$seconds = (int) ( $second_in_day % MINUTE_IN_SECONDS );
		$boundary = $day->setTime( $hours, $minutes, $seconds );
		if ( $boundary->format( 'Y-m-d H:i:s' ) !== sprintf( '%s %02d:%02d:%02d', $sql_date, $hours, $minutes, $seconds ) ) {
			return false;
		}
		$naive_timestamp = gmmktime( $hours, $minutes, $seconds, absint( substr( $sql_date, 5, 2 ) ), absint( substr( $sql_date, 8, 2 ) ), absint( substr( $sql_date, 0, 4 ) ) );
		$transitions = $timezone->getTransitions( $day->getTimestamp() - DAY_IN_SECONDS, $day->modify( '+2 days' )->getTimestamp() );
		if ( ! is_array( $transitions ) || 2 > count( $transitions ) ) {
			// Fixed-offset timezones have no DST gap or fold and return false here.
			return $boundary;
		}
		for ( $index = 1; $index < count( $transitions ); $index++ ) {
			$old_offset  = (int) $transitions[ $index - 1 ]['offset'];
			$new_offset  = (int) $transitions[ $index ]['offset'];
			$transition  = (int) $transitions[ $index ]['ts'];
			$local_old   = $transition + $old_offset;
			$local_new   = $transition + $new_offset;
			$range_start = min( $local_old, $local_new );
			$range_end   = max( $local_old, $local_new );
			if ( $old_offset !== $new_offset && $naive_timestamp >= $range_start && $naive_timestamp < $range_end ) {
				return false;
			}
		}

		return $boundary;
	}

	/**
	 * Add and clip one exact timestamp interval.
	 *
	 * @param array  $intervals Intervals, by reference.
	 * @param int    $resource_id Resource ID.
	 * @param string $source_id Source ID.
	 * @param int    $start Start timestamp.
	 * @param int    $end End timestamp.
	 * @param int    $window_start Window start timestamp.
	 * @param int    $window_end Window end timestamp.
	 * @param string $related_segment_id Optional authorized booking segment identity for presentation alignment.
	 *
	 * @return void
	 */
	private function add_timestamp_interval( &$intervals, $resource_id, $source_id, $start, $end, $window_start, $window_end, $related_segment_id = '' ) {
		$start = max( (int) $start, (int) $window_start );
		$end   = min( (int) $end, (int) $window_end );
		if ( ! $resource_id || $end <= $start ) {
			return;
		}
		$intervals[] = array(
			'resource_id'       => absint( $resource_id ),
			'source'            => sanitize_key( $source_id ),
			'start'             => $start,
			'end'               => $end,
			'related_segment_id' => sanitize_key( $related_segment_id ),
		);
	}

	/**
	 * Sort, merge, and map internal intervals to JSON-safe ISO records.
	 *
	 * @param array        $intervals Internal intervals.
	 * @param DateTimeZone $timezone Site timezone.
	 *
	 * @return array<int,array<string,mixed>> Normalized DTO intervals.
	 */
	private function normalize_intervals( $intervals, $timezone ) {
		usort(
			$intervals,
			static function ( $left, $right ) {
				return array( $left['resource_id'], $left['source'], $left['related_segment_id'], $left['start'], $left['end'] ) <=> array( $right['resource_id'], $right['source'], $right['related_segment_id'], $right['start'], $right['end'] );
			}
		);
		$merged = array();
		foreach ( $intervals as $interval ) {
			$last_index = count( $merged ) - 1;
			if (
				$last_index >= 0
				&& $merged[ $last_index ]['resource_id'] === $interval['resource_id']
				&& $merged[ $last_index ]['source'] === $interval['source']
				&& $merged[ $last_index ]['related_segment_id'] === $interval['related_segment_id']
				&& $interval['start'] <= $merged[ $last_index ]['end']
			) {
				$merged[ $last_index ]['end'] = max( $merged[ $last_index ]['end'], $interval['end'] );
				continue;
			}
			$merged[] = $interval;
		}

		$definitions = self::get_source_definitions();
		$dto         = array();
		foreach ( $merged as $index => $interval ) {
			$start = ( new DateTimeImmutable( '@' . $interval['start'] ) )->setTimezone( $timezone );
			$end   = ( new DateTimeImmutable( '@' . $interval['end'] ) )->setTimezone( $timezone );
			$dto[] = array(
				'interval_id'       => 'unavailable-' . absint( $interval['resource_id'] ) . '-' . sanitize_key( $interval['source'] ) . '-' . $index,
				'resource_id'       => absint( $interval['resource_id'] ),
				'source'            => sanitize_key( $interval['source'] ),
				'source_label'      => isset( $definitions[ $interval['source'] ]['label'] ) ? $definitions[ $interval['source'] ]['label'] : '',
				'state'             => 'exact',
				'start_at'          => $start->format( 'Y-m-d\TH:i:sP' ),
				'end_at'            => $end->format( 'Y-m-d\TH:i:sP' ),
				'related_segment_id' => isset( $interval['related_segment_id'] ) ? sanitize_key( $interval['related_segment_id'] ) : '',
			);
		}

		return $dto;
	}

	/**
	 * Mark a source unknown for one Resource.
	 *
	 * @param int    $resource_id Resource ID.
	 * @param string $source_id Source ID.
	 * @param string $reason Safe reason key.
	 * @param array  $coverage Coverage map, by reference.
	 * @param array  $unknown Unknown records, by reference.
	 *
	 * @return void
	 */
	private function mark_unknown( $resource_id, $source_id, $reason, &$coverage, &$unknown ) {
		$resource_id = absint( $resource_id );
		$source_id   = sanitize_key( $source_id );
		$reason      = sanitize_key( $reason );
		if ( ! isset( $coverage[ $resource_id ][ $source_id ] ) ) {
			return;
		}
		$coverage[ $resource_id ][ $source_id ]['state'] = 'unknown';
		$key = $resource_id . ':' . $source_id . ':' . $reason;
		$unknown[ $key ] = array(
			'resource_id' => $resource_id,
			'source'      => $source_id,
			'state'       => 'unknown',
			'reason'      => $reason,
		);
	}

	/**
	 * Mark one source unknown for every Resource.
	 *
	 * @param int[]  $resource_ids Resource IDs.
	 * @param string $source_id Source ID.
	 * @param string $reason Safe reason key.
	 * @param array  $coverage Coverage map, by reference.
	 * @param array  $unknown Unknown records, by reference.
	 *
	 * @return void
	 */
	private function mark_all_unknown( $resource_ids, $source_id, $reason, &$coverage, &$unknown ) {
		foreach ( $resource_ids as $resource_id ) {
			$this->mark_unknown( $resource_id, $source_id, $reason, $coverage, $unknown );
		}
	}

	/**
	 * Mark one source state for every Resource.
	 *
	 * @param int[]  $resource_ids Resource IDs.
	 * @param string $source_id Source ID.
	 * @param string $state Exact, unknown, or not_applicable.
	 * @param array  $coverage Coverage map, by reference.
	 *
	 * @return void
	 */
	private function mark_all_state( $resource_ids, $source_id, $state, &$coverage ) {
		foreach ( $resource_ids as $resource_id ) {
			if ( isset( $coverage[ $resource_id ][ $source_id ] ) ) {
				$coverage[ $resource_id ][ $source_id ]['state'] = sanitize_key( $state );
			}
		}
	}

	/**
	 * Flatten coverage in stable Resource/source order.
	 *
	 * @param array $coverage Coverage map.
	 *
	 * @return array<int,array<string,mixed>> Coverage records.
	 */
	private function flatten_coverage( $coverage ) {
		$records = array();
		ksort( $coverage, SORT_NUMERIC );
		foreach ( $coverage as $resource_coverage ) {
			foreach ( self::get_source_definitions() as $source_id => $definition ) {
				if ( isset( $resource_coverage[ $source_id ] ) ) {
					$records[] = $resource_coverage[ $source_id ];
				}
			}
		}

		return $records;
	}

	/**
	 * Build SQL dates in the validated half-open window.
	 *
	 * @param array<string,mixed> $window Validated window.
	 *
	 * @return string[] SQL dates.
	 */
	private function get_dates( $window ) {
		$timezone = new DateTimeZone( (string) $window['timezone'] );
		$current  = new DateTimeImmutable( $window['start_date'] . ' 00:00:00', $timezone );
		$end      = new DateTimeImmutable( $window['end_date'] . ' 00:00:00', $timezone );
		$dates    = array();
		while ( $current < $end ) {
			$dates[] = $current->format( 'Y-m-d' );
			$current = $current->modify( '+1 day' );
		}

		return $dates;
	}

	/**
	 * Return the shared row ceiling for source-domain batch reads.
	 *
	 * @return int Maximum source rows accepted by one projection.
	 */
	private function get_maximum_source_rows() {
		$configuration = wpbc_timeline_get_configuration();

		return isset( $configuration['limits']['maximum_projection_date_rows'] )
			? max( 1, absint( $configuration['limits']['maximum_projection_date_rows'] ) )
			: 50000;
	}
}

