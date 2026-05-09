<?php
/**
 * Time slots availability helpers and public read endpoint.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Get DB table name for blocked time-slot intervals.
 *
 * @return string
 */
function wpbc_availability_timeslots__table_name() {
	global $wpdb;

	return $wpdb->prefix . 'booking_availability_timeslots';
}

/**
 * Get capability required to manage time-slot availability.
 *
 * @return string
 */
function wpbc_availability_timeslots__get_manage_cap() {

	$min_user_role = get_bk_option( 'booking_user_role_settings' );

	$capability = array(
		'administrator' => 'activate_plugins',
		'editor'        => 'publish_pages',
		'author'        => 'publish_posts',
		'contributor'   => 'edit_posts',
		'subscriber'    => 'read',
	);

	if ( isset( $capability[ $min_user_role ] ) ) {
		return $capability[ $min_user_role ];
	}

	return 'manage_options';
}

/**
 * Sanitize SQL date.
 *
 * @param mixed $date Date value.
 *
 * @return string
 */
function wpbc_availability_timeslots__sanitize_date( $date ) {

	if ( is_array( $date ) || is_object( $date ) ) {
		return '';
	}

	$date = sanitize_text_field( wp_unslash( $date ) );
	if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date ) && false !== strtotime( $date . ' 00:00:00' ) ) {
		return $date;
	}

	return '';
}

/**
 * Sanitize second in day.
 *
 * @param mixed $second Second value.
 *
 * @return int
 */
function wpbc_availability_timeslots__sanitize_second( $second ) {

	$second = intval( $second );

	return max( 0, min( 86400, $second ) );
}

/**
 * Normalize interval array.
 *
 * @param mixed $date Date.
 * @param mixed $start_second Start second.
 * @param mixed $end_second End second.
 *
 * @return array|null
 */
function wpbc_availability_timeslots__normalize_interval( $date, $start_second, $end_second ) {

	$date         = wpbc_availability_timeslots__sanitize_date( $date );
	$start_second = wpbc_availability_timeslots__sanitize_second( $start_second );
	$end_second   = wpbc_availability_timeslots__sanitize_second( $end_second );

	if ( empty( $date ) || $start_second >= $end_second ) {
		return null;
	}

	return array(
		'date'         => $date,
		'start_second' => $start_second,
		'end_second'   => $end_second,
	);
}

/**
 * Convert seconds in day into readable 24h value.
 *
 * @param int $second Second.
 *
 * @return string
 */
function wpbc_availability_timeslots__seconds_to_time( $second ) {

	$second = wpbc_availability_timeslots__sanitize_second( $second );
	$hours  = floor( $second / HOUR_IN_SECONDS );
	$mins   = floor( ( $second % HOUR_IN_SECONDS ) / MINUTE_IN_SECONDS );

	return sprintf( '%02d:%02d', $hours, $mins );
}

/**
 * Convert interval to existing Booking Calendar readable time range.
 *
 * @param array $interval Interval.
 *
 * @return string
 */
function wpbc_availability_timeslots__interval_to_readable( $interval ) {

	return wpbc_availability_timeslots__seconds_to_time( $interval[0] ) . ' - ' . wpbc_availability_timeslots__seconds_to_time( $interval[1] );
}

/**
 * Get SQL dates between two dates.
 *
 * @param string $date_start Start date.
 * @param string $date_end End date.
 *
 * @return array
 */
function wpbc_availability_timeslots__get_dates_in_range( $date_start, $date_end ) {

	$date_start = wpbc_availability_timeslots__sanitize_date( $date_start );
	$date_end   = wpbc_availability_timeslots__sanitize_date( $date_end );
	$dates      = array();

	if ( empty( $date_start ) || empty( $date_end ) ) {
		return $dates;
	}

	if ( $date_start > $date_end ) {
		$tmp        = $date_start;
		$date_start = $date_end;
		$date_end   = $tmp;
	}

	$timestamp = strtotime( $date_start . ' 00:00:00' );
	$end_time  = strtotime( $date_end . ' 00:00:00' );
	$max_days  = function_exists( 'wpbc_get_max_visible_days_in_calendar' ) ? intval( wpbc_get_max_visible_days_in_calendar() ) : 365;
	$max_days  = max( 1, min( 1095, $max_days ) );

	while ( $timestamp <= $end_time && count( $dates ) < $max_days ) {
		$dates[]    = gmdate( 'Y-m-d', $timestamp );
		$timestamp += DAY_IN_SECONDS;
	}

	return $dates;
}

/**
 * Convert a Booking Calendar time range key into seconds.
 *
 * @param string|int $time_range_key Time key.
 *
 * @return array
 */
function wpbc_availability_timeslots__time_key_to_seconds( $time_range_key ) {

	if ( '0' === (string) $time_range_key || false === strpos( (string) $time_range_key, '-' ) ) {
		return array( 0, 86400 );
	}

	return wpbc_transform_timerange__s_range__in__seconds_arr( $time_range_key );
}

/**
 * Build date bounds for interval queries.
 *
 * @param string|array $dates_to_check Dates to check.
 * @param int          $max_days_count Maximum days count.
 *
 * @return array
 */
function wpbc_availability_timeslots__get_date_bounds( $dates_to_check = 'CURDATE', $max_days_count = 365 ) {

	$max_days_count = max( 1, intval( $max_days_count ) );

	if ( is_array( $dates_to_check ) && ! empty( $dates_to_check ) ) {
		$dates = array_values(
			array_filter(
				array_map( 'wpbc_availability_timeslots__sanitize_date', $dates_to_check )
			)
		);
		sort( $dates );
		if ( ! empty( $dates ) ) {
			return array(
				'start' => $dates[0],
				'end'   => $dates[ count( $dates ) - 1 ],
			);
		}
	}

	$today_ts = strtotime( wpbc_datetime_localized__use_wp_timezone( gmdate( 'Y-m-d H:i:s' ), 'Y-m-d 00:00:00' ) );

	if ( 'ALL' === $dates_to_check ) {
		return array(
			'start' => gmdate( 'Y-m-d', strtotime( '-' . $max_days_count . ' days', $today_ts ) ),
			'end'   => gmdate( 'Y-m-d', strtotime( '+' . $max_days_count . ' days', $today_ts ) ),
		);
	}

	return array(
		'start' => gmdate( 'Y-m-d', $today_ts ),
		'end'   => gmdate( 'Y-m-d', strtotime( '+' . ( $max_days_count - 1 ) . ' days', $today_ts ) ),
	);
}

/**
 * Get blocked intervals for resources and dates.
 *
 * @param array $params Query params.
 *
 * @return array [date][resource_id][].
 */
function wpbc_availability_timeslots__get_intervals_for_resources( $params = array() ) {

	global $wpdb;

	if ( ! wpbc_is_table_exists( 'booking_availability_timeslots' ) ) {
		if ( function_exists( 'wpbc_activation__availability_timeslots' ) ) {
			wpbc_activation__availability_timeslots();
		}
		if ( ! wpbc_is_table_exists( 'booking_availability_timeslots' ) ) {
			return array();
		}
	}

	$defaults = array(
		'resource_id'    => array(),
		'dates_to_check' => 'CURDATE',
		'date_start'     => '',
		'date_end'       => '',
		'max_days_count' => 365,
		'use_cache'      => true,
	);
	$params   = wp_parse_args( $params, $defaults );

	$resource_ids = wpbc_get_unique_array_of_resources_id( $params['resource_id'] );
	$resource_ids = array_values( array_filter( array_map( 'intval', $resource_ids ) ) );

	if ( empty( $resource_ids ) ) {
		return array();
	}

	$date_start = wpbc_availability_timeslots__sanitize_date( $params['date_start'] );
	$date_end   = wpbc_availability_timeslots__sanitize_date( $params['date_end'] );

	if ( empty( $date_start ) || empty( $date_end ) ) {
		$bounds     = wpbc_availability_timeslots__get_date_bounds( $params['dates_to_check'], $params['max_days_count'] );
		$date_start = $bounds['start'];
		$date_end   = $bounds['end'];
	}

	if ( $date_start > $date_end ) {
		$tmp        = $date_start;
		$date_start = $date_end;
		$date_end   = $tmp;
	}

	$cache_params = array(
		'resource_id' => $resource_ids,
		'date_start'  => $date_start,
		'date_end'    => $date_end,
	);

	if ( $params['use_cache'] ) {
		$cached_value = wpbc_cache__get( 'wpbc_availability_timeslots__get_intervals_for_resources', $cache_params );
		if ( null !== $cached_value ) {
			return $cached_value;
		}
	}

	$table                = wpbc_availability_timeslots__table_name();
	$resource_placeholders = implode( ',', array_fill( 0, count( $resource_ids ), '%d' ) );
	$query_values          = array_merge( $resource_ids, array( $date_start, $date_end ) );

	$sql = $wpdb->prepare(
		"SELECT timeslot_id, resource_id, block_date, start_second, end_second, group_uid, source, note
		   FROM {$table}
		  WHERE status = 'active'
		    AND resource_id IN ({$resource_placeholders})
		    AND block_date >= %s
		    AND block_date <= %s
		  ORDER BY block_date ASC, resource_id ASC, start_second ASC, end_second ASC",
		$query_values
	);

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
	$rows = $wpdb->get_results( $sql );

	$intervals = array();

	foreach ( $rows as $row ) {
		$date        = $row->block_date;
		$resource_id = (int) $row->resource_id;

		if ( ! isset( $intervals[ $date ] ) ) {
			$intervals[ $date ] = array();
		}
		if ( ! isset( $intervals[ $date ][ $resource_id ] ) ) {
			$intervals[ $date ][ $resource_id ] = array();
		}

		$intervals[ $date ][ $resource_id ][] = array(
			'timeslot_id'   => (int) $row->timeslot_id,
			'resource_id'   => $resource_id,
			'date'          => $date,
			'start_second'  => (int) $row->start_second,
			'end_second'    => (int) $row->end_second,
			'group_uid'     => (string) $row->group_uid,
			'source'        => (string) $row->source,
			'note'          => (string) $row->note,
			'readable_time' => wpbc_availability_timeslots__seconds_to_time( (int) $row->start_second ) . ' - ' . wpbc_availability_timeslots__seconds_to_time( (int) $row->end_second ),
		);
	}

	if ( $params['use_cache'] ) {
		return wpbc_cache__save( 'wpbc_availability_timeslots__get_intervals_for_resources', $cache_params, $intervals );
	}

	return $intervals;
}

/**
 * Merge aggregate resource blocks into primary resources.
 *
 * @param array $blocks Blocks [date][resource_id][].
 * @param array $primary_resource_ids Primary resources.
 * @param array $aggregate_resource_ids Aggregate resources.
 *
 * @return array
 */
function wpbc_availability_timeslots__aggregate_merge_intervals( $blocks, $primary_resource_ids, $aggregate_resource_ids ) {

	if ( empty( $aggregate_resource_ids ) || empty( $blocks ) ) {
		return $blocks;
	}

	$primary_resource_ids   = array_values( array_filter( array_map( 'intval', $primary_resource_ids ) ) );
	$aggregate_resource_ids = array_values( array_filter( array_map( 'intval', $aggregate_resource_ids ) ) );

	foreach ( $blocks as $date => $resource_blocks ) {
		foreach ( $primary_resource_ids as $primary_resource_id ) {
			if ( ! isset( $blocks[ $date ][ $primary_resource_id ] ) ) {
				$blocks[ $date ][ $primary_resource_id ] = array();
			}
			foreach ( $aggregate_resource_ids as $aggregate_resource_id ) {
				if ( empty( $resource_blocks[ $aggregate_resource_id ] ) ) {
					continue;
				}
				$blocks[ $date ][ $primary_resource_id ] = array_merge( $blocks[ $date ][ $primary_resource_id ], $resource_blocks[ $aggregate_resource_id ] );
			}
		}
	}

	return $blocks;
}

/**
 * Normalize a time interval into seconds array.
 *
 * @param array|string $interval Interval as array( start, end ) or 'start - end'.
 *
 * @return array
 */
function wpbc_availability_timeslots__normalize_seconds_interval( $interval ) {

	if ( is_string( $interval ) ) {
		$interval = explode( '-', $interval );
	}

	if ( ! is_array( $interval ) || count( $interval ) < 2 ) {
		return array();
	}

	return array(
		wpbc_availability_timeslots__sanitize_second( $interval[0] ),
		wpbc_availability_timeslots__sanitize_second( $interval[1] ),
	);
}

/**
 * Check if some form slot is still free.
 *
 * @param array $timeslots_to_check Timeslots as seconds arrays or 'start - end' strings.
 * @param array $busy_intervals Busy intervals as seconds arrays or 'start - end' strings.
 *
 * @return bool
 */
function wpbc_availability_timeslots__is_some_timeslot_available( $timeslots_to_check, $busy_intervals ) {

	if ( empty( $timeslots_to_check ) ) {
		return true;
	}

	$has_valid_slot = false;

	foreach ( $timeslots_to_check as $slot ) {
		$slot = wpbc_availability_timeslots__normalize_seconds_interval( $slot );

		if ( empty( $slot ) || $slot[0] >= $slot[1] ) {
			continue;
		}

		$has_valid_slot = true;
		$is_intersected = false;
		foreach ( $busy_intervals as $busy_interval ) {
			$busy_interval = wpbc_availability_timeslots__normalize_seconds_interval( $busy_interval );

			if ( empty( $busy_interval ) || $busy_interval[0] >= $busy_interval[1] ) {
				continue;
			}

			if ( wpbc_is__intervals__intersected( $slot, $busy_interval ) ) {
				$is_intersected = true;
				break;
			}
		}

		if ( ! $is_intersected ) {
			return true;
		}
	}

	if ( ! $has_valid_slot ) {
		return true;
	}

	return false;
}

/**
 * Apply saved blocked intervals to one availability resource object.
 *
 * @param object $availability_obj Availability object.
 * @param array  $blocked_intervals Blocked DB rows.
 * @param array  $timeslots_to_check Timeslots from booking form.
 *
 * @return object
 */
function wpbc_availability_timeslots__apply_blocks_to_availability_obj( $availability_obj, $blocked_intervals, $timeslots_to_check = array() ) {

	if ( empty( $blocked_intervals ) ) {
		return $availability_obj;
	}

	$was_day_unavailable = ! empty( $availability_obj->is_day_unavailable );
	$previous_day_status = $availability_obj->_day_status;

	foreach ( $blocked_intervals as $blocked_interval ) {
		$time_range = array(
			wpbc_availability_timeslots__sanitize_second( $blocked_interval['start_second'] ),
			wpbc_availability_timeslots__sanitize_second( $blocked_interval['end_second'] ),
		);

		if ( $time_range[0] >= $time_range[1] ) {
			continue;
		}

		if ( ! $was_day_unavailable ) {
			$availability_obj->_day_status = 'time_slots_booking';
		}
		$availability_obj->booked_time_slots['in_seconds'][]  = $time_range;
		$availability_obj->booked_time_slots['readable24h'][] = wpbc_availability_timeslots__interval_to_readable( $time_range );
		if ( ! $was_day_unavailable ) {
			$availability_obj->pending_approved[ $time_range[0] ] = 'approved';
		}

		$time_range_key = $time_range[0] . ' - ' . $time_range[1];
		if ( empty( $availability_obj->__booked__times__details ) ) {
			$availability_obj->__booked__times__details = array();
		}

		$availability_obj->__booked__times__details[ $time_range_key ] = (object) array(
			'approved'                    => '1',
			'booking_id'                  => 'availability_timeslot_' . (int) $blocked_interval['timeslot_id'],
			'unavailable_timeslot_id'     => (int) $blocked_interval['timeslot_id'],
			'availability_timeslot_id'    => (int) $blocked_interval['timeslot_id'],
			'source_type'                 => 'availability_timeslot',
			'time_slot_status'            => 'unavailable',
			'time_slot_status_title'      => __( 'Unavailable time-slot', 'booking' ),
			'parent'                      => '0',
			'prioritet'                   => '0',
			'type'                        => isset( $blocked_interval['resource_id'] ) ? (string) intval( $blocked_interval['resource_id'] ) : '0',
			'date_res_type'               => null,
			'block_date'                  => isset( $blocked_interval['date'] ) ? $blocked_interval['date'] : '',
			'readable_time'               => wpbc_transform_timerange__seconds_arr__in__formated_hours( $time_range ),
			'group_uid'                   => isset( $blocked_interval['group_uid'] ) ? (string) $blocked_interval['group_uid'] : '',
			'__summary__booking'          => (object) array(
				'source_type'              => 'availability_timeslot',
				'unavailable_timeslot_id'  => (int) $blocked_interval['timeslot_id'],
				'time_slot_status'         => 'unavailable',
			),
		);

		if ( 'On' === get_bk_option( 'booking_is_show_booked_data_in_tooltips' ) ) {
			$tooltip_text  = '';
			$tooltip_text .= '<div class="wpbc_tooltip_item tooltip_booked_time">' . wpbc_transform_timerange__seconds_arr__in__formated_hours( $time_range ) . '</div>';
			$tooltip_text .= '<div class="wpbc_tooltip_item">' . esc_html__( 'Unavailable time-slot', 'booking' ) . '</div>';
			$availability_obj->tooltips['details'][ 'availability_timeslot_' . (int) $blocked_interval['timeslot_id'] ] = $tooltip_text;
		}
	}

	$merged_seconds_arr = wpbc_merge_intersected_intervals( $availability_obj->booked_time_slots['in_seconds'] );

	$availability_obj->booked_time_slots['merged_seconds']  = $merged_seconds_arr;
	$availability_obj->booked_time_slots['merged_readable'] = array();

	foreach ( $merged_seconds_arr as $busy_interval ) {
		$availability_obj->booked_time_slots['merged_readable'][] = wpbc_transform_timerange__seconds_arr__in__formated_hours( $busy_interval );
	}

	if ( $was_day_unavailable ) {
		$availability_obj->_day_status = $previous_day_status;
		return $availability_obj;
	}

	ksort( $availability_obj->pending_approved );

	if ( ! empty( $availability_obj->booked_time_slots['merged_readable'] ) ) {
		$tooltip_content_arr = array_map(
			function ( $item ) {
				return '<div class="wpbc_tooltip_item">' . $item . '</div>';
			},
			$availability_obj->booked_time_slots['merged_readable']
		);

		$availability_obj->tooltips['times'] = '<div class="wpbc_tooltip_resource_container">' . implode( '', $tooltip_content_arr ) . '</div>';
	}

	if (
		( ! empty( $merged_seconds_arr ) )
		&& (
			( 0 >= (int) $merged_seconds_arr[0][0] && 86400 <= (int) $merged_seconds_arr[0][1] )
			|| ( ! wpbc_availability_timeslots__is_some_timeslot_available( $timeslots_to_check, $merged_seconds_arr ) )
		)
	) {
		$availability_obj->is_day_unavailable = true;
		$availability_obj->_day_status        = 'full_day_booking';
	}

	return $availability_obj;
}

/**
 * Get admin URL for editing the rule that made a timeline day unavailable.
 *
 * @param string $source_type Unavailable source type.
 * @param int    $resource_id Booking resource ID.
 *
 * @return string
 */
function wpbc_availability_timeslots__get_unavailable_rule_url( $source_type, $resource_id = 0 ) {

	switch ( $source_type ) {
		case 'days_availability':
			$url = function_exists( 'wpbc_get_availability_url' )
				? esc_url_raw( wpbc_get_availability_url( true, false ) . '&tab=availability' )
				: esc_url_raw( admin_url( 'admin.php?page=wpbc-availability&tab=availability' ) );
			break;

		case 'season_filter':
			$url = function_exists( 'wpbc_get_availability_url' )
				? esc_url_raw( wpbc_get_availability_url( true, false ) . '&tab=season_availability' )
				: esc_url_raw( admin_url( 'admin.php?page=wpbc-availability&tab=season_availability' ) );
			break;

		case 'weekday_unavailable':
		case 'from_today_unavailable':
		case 'limit_available_from_today':
			return function_exists( 'wpbc_get_general_availability_url' )
				? esc_url_raw( wpbc_get_general_availability_url( true, false ) )
				: esc_url_raw( admin_url( 'admin.php?page=wpbc-availability&tab=general_availability' ) );

		default:
			return '';
	}

	if ( ! empty( $resource_id ) ) {
		$url = add_query_arg( 'resource_id', absint( $resource_id ), $url );
	}

	return esc_url_raw( $url );
}

/**
 * Get full-day unavailable statuses that come from availability rules.
 *
 * @return array
 */
function wpbc_availability_timeslots__get_unavailable_day_statuses() {

	return array(
		'resource_availability'       => array(
			'source_type' => 'days_availability',
			'title'       => __( 'Unavailable day', 'booking' ),
			'source'      => __( 'Days Availability', 'booking' ),
		),
		'weekday_unavailable'         => array(
			'source_type' => 'weekday_unavailable',
			'title'       => __( 'Unavailable weekday', 'booking' ),
			'source'      => __( 'General availability', 'booking' ),
		),
		'season_filter'               => array(
			'source_type' => 'season_filter',
			'title'       => __( 'Season unavailable', 'booking' ),
			'source'      => __( 'Season Availability', 'booking' ),
		),
		'from_today_unavailable'      => array(
			'source_type' => 'from_today_unavailable',
			'title'       => __( 'Unavailable from today', 'booking' ),
			'source'      => __( 'General availability', 'booking' ),
		),
		'limit_available_from_today'  => array(
			'source_type' => 'limit_available_from_today',
			'title'       => __( 'Outside available date range', 'booking' ),
			'source'      => __( 'General availability', 'booking' ),
		),
	);
}

/**
 * Maybe add a read-only full-day bar for unavailable day rules.
 *
 * @param array  $bars Bars array.
 * @param string $date SQL date.
 * @param int    $resource_id Resource ID.
 * @param object $availability_obj Availability object.
 *
 * @return array
 */
function wpbc_availability_timeslots__maybe_add_unavailable_day_bar( $bars, $date, $resource_id, $availability_obj ) {

	if ( empty( $availability_obj->_day_status ) ) {
		return $bars;
	}

	$unavailable_statuses = wpbc_availability_timeslots__get_unavailable_day_statuses();
	$day_status           = (string) $availability_obj->_day_status;

	if ( ! isset( $unavailable_statuses[ $day_status ] ) ) {
		return $bars;
	}

	if ( ! isset( $bars[ $date ] ) ) {
		$bars[ $date ] = array();
	}
	if ( ! isset( $bars[ $date ][ $resource_id ] ) ) {
		$bars[ $date ][ $resource_id ] = array();
	}

	$status = $unavailable_statuses[ $day_status ];
	$rule_url = wpbc_availability_timeslots__get_unavailable_rule_url( $status['source_type'], $resource_id );

	$bars[ $date ][ $resource_id ][] = array(
		'type'                    => 'unavailable_day',
		'source_type'             => $status['source_type'],
		'editable'                => false,
		'start_second'            => 0,
		'end_second'              => 86400,
		'start_minute'            => 0,
		'end_minute'              => 1440,
		'booking_id'              => '',
		'booking_url'             => '',
		'rule_url'                => $rule_url,
		'rule_source'             => $status['source'],
		'unavailable_timeslot_id' => 0,
		'approved'                => '',
		'status_title'            => $status['title'],
		'time_text'               => __( 'Full day', 'booking' ),
		'tooltip'                 => sprintf(
			/* translators: 1: unavailable day status, 2: rule source. */
			__( '%1$s | Source: %2$s', 'booking' ),
			$status['title'],
			$status['source']
		),
	);

	return $bars;
}

/**
 * Convert availability details into timeline bars.
 *
 * @param array $availability_dates Availability dates.
 * @param array $resource_ids Resource IDs.
 *
 * @return array
 */
function wpbc_availability_timeslots__availability_to_bars( $availability_dates, $resource_ids ) {

	$bars         = array();
	$resource_ids = array_values( array_filter( array_map( 'intval', $resource_ids ) ) );

	foreach ( $availability_dates as $date => $date_obj ) {
		foreach ( $resource_ids as $resource_id ) {
			if ( empty( $date_obj[ $resource_id ] ) ) {
				continue;
			}

			$bars = wpbc_availability_timeslots__maybe_add_unavailable_day_bar( $bars, $date, $resource_id, $date_obj[ $resource_id ] );

			if ( empty( $date_obj[ $resource_id ]->__booked__times__details ) ) {
				continue;
			}

			if ( ! isset( $bars[ $date ] ) ) {
				$bars[ $date ] = array();
			}
			if ( ! isset( $bars[ $date ][ $resource_id ] ) ) {
				$bars[ $date ][ $resource_id ] = array();
			}

			foreach ( $date_obj[ $resource_id ]->__booked__times__details as $time_key => $details ) {
				$seconds     = wpbc_availability_timeslots__time_key_to_seconds( $time_key );
				$source_type = ( isset( $details->source_type ) && 'availability_timeslot' === $details->source_type ) ? 'availability_timeslot' : 'booking';
				$time_text   = wpbc_transform_timerange__seconds_arr__in__formated_hours( $seconds );
				$booking_id  = isset( $details->booking_id ) ? (string) $details->booking_id : '';
				$booking_url = '';
				$status_text = '';
				$tooltip     = '';

				if ( 'booking' === $source_type ) {
					if ( '' !== $booking_id ) {
						$booking_url = esc_url_raw( wpbc_get_bookings_url( true, false ) . '&wh_booking_id=' . intval( $booking_id ) . '&tab=vm_booking_listing' );
					}
					$status_text = ( isset( $details->approved ) && '1' === (string) $details->approved ) ? __( 'Approved', 'booking' ) : __( 'Pending', 'booking' );
					$tooltip     = sprintf(
						/* translators: 1: booking id, 2: booking status, 3: booked time. */
						__( 'Booking ID: %1$s | %2$s | %3$s', 'booking' ),
						$booking_id,
						$status_text,
						$time_text
					);
				} else {
					$status_text = __( 'Unavailable time-slot', 'booking' );
					$tooltip     = sprintf(
						/* translators: 1: unavailable time-slot id, 2: unavailable time. */
						__( 'Unavailable time-slot ID: %1$s | %2$s', 'booking' ),
						isset( $details->unavailable_timeslot_id ) ? (int) $details->unavailable_timeslot_id : 0,
						$time_text
					);
				}

				$bars[ $date ][ $resource_id ][] = array(
					'type'                     => ( 'availability_timeslot' === $source_type ) ? 'blocked' : 'booked',
					'source_type'              => $source_type,
					'editable'                 => ( 'availability_timeslot' === $source_type ),
					'start_second'             => (int) $seconds[0],
					'end_second'               => (int) $seconds[1],
					'start_minute'             => (int) floor( $seconds[0] / MINUTE_IN_SECONDS ),
					'end_minute'               => (int) ceil( $seconds[1] / MINUTE_IN_SECONDS ),
					'booking_id'               => $booking_id,
					'booking_url'              => $booking_url,
					'unavailable_timeslot_id'  => isset( $details->unavailable_timeslot_id ) ? (int) $details->unavailable_timeslot_id : 0,
					'approved'                 => isset( $details->approved ) ? (string) $details->approved : '',
					'status_title'             => $status_text,
					'time_text'                => $time_text,
					'tooltip'                  => $tooltip,
				);
			}
		}
	}

	return $bars;
}

/**
 * AJAX: read blocked time slots for a calendar/frontend request.
 *
 * @return void
 */
function wpbc_availability_timeslots_ajax_read() {

	$resource_id = isset( $_REQUEST['resource_id'] ) ? intval( $_REQUEST['resource_id'] ) : wpbc_get_default_resource(); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$date_start  = isset( $_REQUEST['date_start'] ) ? wpbc_availability_timeslots__sanitize_date( $_REQUEST['date_start'] ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$date_end    = isset( $_REQUEST['date_end'] ) ? wpbc_availability_timeslots__sanitize_date( $_REQUEST['date_end'] ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended

	$intervals = wpbc_availability_timeslots__get_intervals_for_resources(
		array(
			'resource_id' => $resource_id,
			'date_start'  => $date_start,
			'date_end'    => $date_end,
		)
	);

	$dates_to_check  = wpbc_availability_timeslots__get_dates_in_range( $date_start, $date_end );
	$availability    = wpbc_get_availability_per_days_arr(
		array(
			'resource_id'                         => $resource_id,
			'dates_to_check'                      => $dates_to_check,
			'force_check_from_today_unavailable'  => true,
		)
	);
	$resource_ids    = isset( $availability['resources_id_arr__in_dates'] ) ? $availability['resources_id_arr__in_dates'] : array( $resource_id );
	$timeline_bars   = wpbc_availability_timeslots__availability_to_bars( $availability['dates'], $resource_ids );

	wp_send_json_success(
		array(
			'resource_id' => $resource_id,
			'date_start'  => $date_start,
			'date_end'    => $date_end,
			'intervals'   => $intervals,
			'bars'        => $timeline_bars,
		)
	);
}
add_action( 'wp_ajax_WPBC_AJX_AVAILABILITY_TIMESLOTS_READ', 'wpbc_availability_timeslots_ajax_read' );
add_action( 'wp_ajax_nopriv_WPBC_AJX_AVAILABILITY_TIMESLOTS_READ', 'wpbc_availability_timeslots_ajax_read' );
