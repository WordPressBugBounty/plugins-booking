<?php
/**
 * Timeline response budget enforcement and diagnostics.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reject oversized payloads without silently truncating domain records.
 */
final class WPBC_Timeline_Payload_Guard {

	/**
	 * Validate query, segment, interval, and JSON budgets and append diagnostics.
	 *
	 * @param array<string,mixed> $payload       Data-only operation payload.
	 * @param int                 $query_count   Queries used by the operation.
	 * @param int                 $segment_count  Returned booking segment count.
	 * @param int                 $interval_count Returned Availability interval count.
	 *
	 * @return array<string,mixed>|WP_Error Guarded payload or structured error.
	 */
	public function guard( $payload, $query_count, $segment_count = 0, $interval_count = 0 ) {
		$limits = wpbc_timeline_get_configuration()['limits'];
		if ( $query_count > $limits['maximum_queries'] ) {
			return new WP_Error(
				'wpbc_timeline_query_budget_exceeded',
				sprintf(
					/* translators: 1: required database query count, 2: maximum supported query count. */
					__( 'This Timeline request requires %1$d database queries, but the safe maximum is %2$d. Choose fewer Resources or a shorter date range.', 'booking' ),
					absint( $query_count ),
					absint( $limits['maximum_queries'] )
				),
				array(
					'query_count'           => absint( $query_count ),
					'maximum_queries'       => absint( $limits['maximum_queries'] ),
					'suggested_window_days' => max( 1, (int) floor( $limits['default_window_days'] / 2 ) ),
					'suggested_resources'   => absint( $limits['default_resources'] ),
				)
			);
		}
		if ( $segment_count > $limits['maximum_segments'] ) {
			return new WP_Error(
				'wpbc_timeline_segment_budget_exceeded',
				sprintf(
					/* translators: 1: required booking segment count, 2: maximum supported segment count. */
					__( 'This Timeline range contains %1$d booking segments, but the safe maximum is %2$d. Choose fewer Resources or a shorter date range.', 'booking' ),
					absint( $segment_count ),
					absint( $limits['maximum_segments'] )
				),
				array(
					'segment_count'         => absint( $segment_count ),
					'maximum_segments'      => absint( $limits['maximum_segments'] ),
					'suggested_window_days' => max( 1, (int) floor( $limits['default_window_days'] / 2 ) ),
					'suggested_resources'   => absint( $limits['default_resources'] ),
				)
			);
		}
		if ( $interval_count > $limits['maximum_intervals'] ) {
			return new WP_Error(
				'wpbc_timeline_interval_budget_exceeded',
				sprintf(
					/* translators: 1: required unavailable interval count, 2: maximum supported interval count. */
					__( 'This Timeline range contains %1$d unavailable intervals, but the safe maximum is %2$d. Choose fewer Resources or a shorter date range.', 'booking' ),
					absint( $interval_count ),
					absint( $limits['maximum_intervals'] )
				),
				array(
					'interval_count'        => absint( $interval_count ),
					'maximum_intervals'     => absint( $limits['maximum_intervals'] ),
					'suggested_window_days' => max( 1, (int) floor( $limits['default_window_days'] / 2 ) ),
					'suggested_resources'   => absint( $limits['default_resources'] ),
				)
			);
		}

		$payload['diagnostics'] = array(
			'query_count'     => max( 0, absint( $query_count ) ),
			'segment_count'   => max( 0, absint( $segment_count ) ),
			'interval_count'  => max( 0, absint( $interval_count ) ),
			'raw_json_bytes'  => 0,
		);
		$json = wp_json_encode( $payload );
		if ( false === $json ) {
			return new WP_Error(
				'wpbc_timeline_payload_encoding_failed',
				__( 'Timeline data could not be prepared safely.', 'booking' )
			);
		}

		$json_bytes                               = strlen( $json );
		$payload['diagnostics']['raw_json_bytes'] = $json_bytes;
		$final_json                               = wp_json_encode( $payload );
		$json_bytes                               = false === $final_json ? $json_bytes : strlen( $final_json );
		$payload['diagnostics']['raw_json_bytes'] = $json_bytes;
		if ( $json_bytes > $limits['maximum_json_bytes'] ) {
			return new WP_Error(
				'wpbc_timeline_payload_budget_exceeded',
				sprintf(
					/* translators: 1: required encoded Timeline response size in bytes, 2: maximum supported response size in bytes. */
					__( 'This Timeline response requires %1$d bytes, but the safe maximum is %2$d bytes. Choose fewer Resources or a shorter date range.', 'booking' ),
					$json_bytes,
					absint( $limits['maximum_json_bytes'] )
				),
				array(
					'raw_json_bytes'        => $json_bytes,
					'maximum_json_bytes'    => absint( $limits['maximum_json_bytes'] ),
					'suggested_window_days' => max( 1, (int) floor( $limits['default_window_days'] / 2 ) ),
					'suggested_resources'   => absint( $limits['default_resources'] ),
				)
			);
		}

		return $payload;
	}
}
