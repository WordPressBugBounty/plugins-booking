<?php
/**
 * Working Time settings and availability helpers.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Get default Working Time settings.
 *
 * @return array
 */
function wpbc_working_time__get_default_settings() {

	$weekdays = array();

	for ( $day = 0; $day <= 6; $day++ ) {
		$weekdays[ $day ] = array();
		if ( $day >= 1 && $day <= 5 ) {
			$weekdays[ $day ][] = array(
				'start_second' => 9 * HOUR_IN_SECONDS,
				'end_second'   => 18 * HOUR_IN_SECONDS,
			);
		}
	}

	return array(
		'enabled'   => 'Off',
		'default'   => array(
			'weekdays' => $weekdays,
		),
		'resources' => array(),
	);
}

/**
 * Normalize Working Time settings.
 *
 * @param mixed $settings Settings.
 *
 * @return array
 */
function wpbc_working_time__normalize_settings( $settings ) {

	$defaults = wpbc_working_time__get_default_settings();

	if ( ! is_array( $settings ) ) {
		return $defaults;
	}

	$settings = wp_parse_args( $settings, $defaults );

	$settings['enabled'] = ( 'On' === (string) $settings['enabled'] ) ? 'On' : 'Off';
	$settings['default'] = array(
		'weekdays' => wpbc_working_time__normalize_weekday_intervals(
			isset( $settings['default']['weekdays'] ) ? $settings['default']['weekdays'] : array()
		),
	);

	if ( ! is_array( $settings['resources'] ) ) {
		$settings['resources'] = array();
	}

	foreach ( $settings['resources'] as $resource_id => $resource_settings ) {
		$resource_id = absint( $resource_id );
		if ( empty( $resource_id ) || ! is_array( $resource_settings ) ) {
			unset( $settings['resources'][ $resource_id ] );
			continue;
		}

		$mode = isset( $resource_settings['mode'] ) ? (string) $resource_settings['mode'] : 'inherit';
		if ( ! in_array( $mode, array( 'inherit', 'custom', 'disabled' ), true ) ) {
			$mode = 'inherit';
		}

		$settings['resources'][ $resource_id ] = array(
			'mode'     => $mode,
			'weekdays' => wpbc_working_time__normalize_weekday_intervals(
				isset( $resource_settings['weekdays'] ) ? $resource_settings['weekdays'] : array()
			),
		);
	}

	return $settings;
}

/**
 * Normalize weekly intervals.
 *
 * @param mixed $weekdays Weekday intervals.
 *
 * @return array
 */
function wpbc_working_time__normalize_weekday_intervals( $weekdays ) {

	$normalized = array();

	for ( $day = 0; $day <= 6; $day++ ) {
		$normalized[ $day ] = array();

		if ( empty( $weekdays[ $day ] ) || ! is_array( $weekdays[ $day ] ) ) {
			continue;
		}

		foreach ( $weekdays[ $day ] as $interval ) {
			if ( ! is_array( $interval ) ) {
				continue;
			}

			$start_second = isset( $interval['start_second'] ) ? absint( $interval['start_second'] ) : 0;
			$end_second   = isset( $interval['end_second'] ) ? absint( $interval['end_second'] ) : 0;
			$start_second = max( 0, min( DAY_IN_SECONDS, $start_second ) );
			$end_second   = max( 0, min( DAY_IN_SECONDS, $end_second ) );

			if ( $start_second < $end_second ) {
				$normalized[ $day ][] = array(
					'start_second' => $start_second,
					'end_second'   => $end_second,
				);
			}
		}

		usort(
			$normalized[ $day ],
			function ( $a, $b ) {
				return $a['start_second'] - $b['start_second'];
			}
		);
	}

	return $normalized;
}

/**
 * Get stored Working Time settings.
 *
 * @return array
 */
function wpbc_working_time__get_settings() {

	$settings = get_bk_option( 'booking_working_time_rules', array() );

	return wpbc_working_time__normalize_settings( maybe_unserialize( $settings ) );
}

/**
 * Save Working Time settings.
 *
 * @param array $settings Settings.
 *
 * @return void
 */
function wpbc_working_time__update_settings( $settings ) {

	$settings = wpbc_working_time__normalize_settings( $settings );

	update_bk_option( 'booking_working_time_rules', $settings );
	update_bk_option( 'booking_working_time_enabled', $settings['enabled'] );
}

/**
 * Add default Working Time options on activation/update.
 *
 * @return void
 */
function wpbc_activation__working_time() {

	$settings = wpbc_working_time__get_default_settings();

	add_bk_option( 'booking_working_time_enabled', 'Off' );
	add_bk_option( 'booking_working_time_rules', $settings );
}
add_bk_action( 'wpbc_free_version_activation', 'wpbc_activation__working_time' );
add_bk_action( 'wpbc_other_versions_activation', 'wpbc_activation__working_time' );

/**
 * Keep Working Time options present after plugin updates for existing installs.
 *
 * @return void
 */
function wpbc_working_time__maybe_install_options() {

	if ( ! is_admin() ) {
		return;
	}

	if (
		( false === get_bk_option( 'booking_working_time_enabled', false ) )
		|| ( false === get_bk_option( 'booking_working_time_rules', false ) )
	) {
		wpbc_activation__working_time();
	}
}
add_action( 'admin_init', 'wpbc_working_time__maybe_install_options' );

/**
 * Remove Working Time options when Booking Calendar data is deleted on deactivation.
 *
 * @return void
 */
function wpbc_deactivation__working_time() {

	delete_bk_option( 'booking_working_time_enabled' );
	delete_bk_option( 'booking_working_time_rules' );
}
add_bk_action( 'wpbc_free_version_deactivation', 'wpbc_deactivation__working_time' );
add_bk_action( 'wpbc_other_versions_deactivation', 'wpbc_deactivation__working_time' );

/**
 * Convert time string into seconds.
 *
 * @param string $time_value Time in H:i format.
 *
 * @return int
 */
function wpbc_working_time__time_to_seconds( $time_value ) {

	$time_value = (string) $time_value;
	if ( ! preg_match( '/^([01]?\d|2[0-4]):([0-5]\d)$/', $time_value, $matches ) ) {
		return 0;
	}

	$hours = min( 24, absint( $matches[1] ) );
	$mins  = ( 24 === $hours ) ? 0 : absint( $matches[2] );

	return min( DAY_IN_SECONDS, ( $hours * HOUR_IN_SECONDS ) + ( $mins * MINUTE_IN_SECONDS ) );
}

/**
 * Convert seconds into H:i time.
 *
 * @param int $seconds Seconds.
 *
 * @return string
 */
function wpbc_working_time__seconds_to_time( $seconds ) {

	$seconds = max( 0, min( DAY_IN_SECONDS, absint( $seconds ) ) );
	$hours   = (int) floor( $seconds / HOUR_IN_SECONDS );
	$mins    = (int) floor( ( $seconds % HOUR_IN_SECONDS ) / MINUTE_IN_SECONDS );

	return sprintf( '%02d:%02d', $hours, $mins );
}

/**
 * Get effective Working Time rule for a resource.
 *
 * @param int $resource_id Resource ID.
 *
 * @return array|false
 */
function wpbc_working_time__get_effective_rule( $resource_id ) {

	$settings    = wpbc_working_time__get_settings();
	$resource_id = absint( $resource_id );

	if ( 'On' !== $settings['enabled'] ) {
		return false;
	}

	if ( ! empty( $settings['resources'][ $resource_id ] ) ) {
		$resource_settings = $settings['resources'][ $resource_id ];

		if ( 'disabled' === $resource_settings['mode'] ) {
			return false;
		}

		if ( 'custom' === $resource_settings['mode'] ) {
			return array(
				'source'   => 'resource',
				'weekdays' => $resource_settings['weekdays'],
			);
		}
	}

	return array(
		'source'   => 'default',
		'weekdays' => $settings['default']['weekdays'],
	);
}

/**
 * Get working intervals for date/resource.
 *
 * @param int    $resource_id Resource ID.
 * @param string $sql_date SQL date.
 *
 * @return array
 */
function wpbc_working_time__get_working_intervals_for_date( $resource_id, $sql_date ) {

	$rule = wpbc_working_time__get_effective_rule( $resource_id );
	if ( false === $rule || empty( $sql_date ) ) {
		return array();
	}

	$weekday = (int) gmdate( 'w', strtotime( $sql_date . ' 00:00:00' ) );

	return isset( $rule['weekdays'][ $weekday ] ) ? $rule['weekdays'][ $weekday ] : array();
}

/**
 * Get outside-working-time intervals for date/resource.
 *
 * @param int    $resource_id Resource ID.
 * @param string $sql_date SQL date.
 *
 * @return array
 */
function wpbc_working_time__get_non_working_intervals_for_date( $resource_id, $sql_date ) {

	$working_intervals = wpbc_working_time__get_working_intervals_for_date( $resource_id, $sql_date );

	if ( false === wpbc_working_time__get_effective_rule( $resource_id ) ) {
		return array();
	}

	if ( empty( $working_intervals ) ) {
		return array(
			array(
				'date'          => $sql_date,
				'resource_id'   => absint( $resource_id ),
				'start_second'  => 0,
				'end_second'    => DAY_IN_SECONDS,
				'source_type'   => 'working_time',
				'readable_time' => __( 'Full day', 'booking' ),
			),
		);
	}

	$busy   = array();
	$cursor = 0;

	foreach ( $working_intervals as $interval ) {
		$start_second = absint( $interval['start_second'] );
		$end_second   = absint( $interval['end_second'] );

		if ( $cursor < $start_second ) {
			$busy[] = array(
				'date'          => $sql_date,
				'resource_id'   => absint( $resource_id ),
				'start_second'  => $cursor,
				'end_second'    => $start_second,
				'source_type'   => 'working_time',
				'readable_time' => wpbc_transform_timerange__seconds_arr__in__formated_hours( array( $cursor, $start_second ) ),
			);
		}

		$cursor = max( $cursor, $end_second );
	}

	if ( $cursor < DAY_IN_SECONDS ) {
		$busy[] = array(
			'date'          => $sql_date,
			'resource_id'   => absint( $resource_id ),
			'start_second'  => $cursor,
			'end_second'    => DAY_IN_SECONDS,
			'source_type'   => 'working_time',
			'readable_time' => wpbc_transform_timerange__seconds_arr__in__formated_hours( array( $cursor, DAY_IN_SECONDS ) ),
		);
	}

	return $busy;
}
