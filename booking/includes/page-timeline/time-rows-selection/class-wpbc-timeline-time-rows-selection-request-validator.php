<?php
/**
 * Timeline time-row selection request validation.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validate exact time-row boundaries without trusting browser geometry.
 */
final class WPBC_Timeline_Time_Rows_Selection_Request_Validator {

	/**
	 * Normalize one time-row selection against server configuration.
	 *
	 * @param mixed        $request_values Untrusted request values.
	 * @param DateTimeZone $timezone      Authoritative site timezone.
	 *
	 * @return array<string,mixed>|WP_Error Internal normalized values or a safe error.
	 */
	public function normalize( $request_values, $timezone ) {
		$request_values = is_array( $request_values ) ? $request_values : array();
		$configuration  = WPBC_Timeline_Time_Rows_Selection_Config::get_configuration();

		if ( array_key_exists( 'selection_step_minutes', $request_values ) ) {
			return $this->get_error(
				'wpbc_timeline_selection_step_override',
				__( 'The Timeline selection step is controlled by the server.', 'booking' )
			);
		}

		$selection_kind = isset( $request_values['selection_kind'] ) && is_scalar( $request_values['selection_kind'] )
			? sanitize_key( (string) $request_values['selection_kind'] )
			: '';
		if ( ! in_array( $selection_kind, $configuration['selection_kinds'], true ) ) {
			return $this->get_error(
				'wpbc_timeline_selection_kind_invalid',
				__( 'Choose a supported Timeline selection type.', 'booking' )
			);
		}

		$start = $this->parse_exact_instant(
			isset( $request_values['start_at'] ) ? $request_values['start_at'] : null,
			$timezone
		);
		if ( is_wp_error( $start ) ) {
			return $start;
		}
		$end = $this->parse_exact_instant(
			isset( $request_values['end_at'] ) ? $request_values['end_at'] : null,
			$timezone
		);
		if ( is_wp_error( $end ) ) {
			return $end;
		}
		if ( $start >= $end ) {
			return $this->get_error(
				'wpbc_timeline_selection_range_invalid',
				__( 'Choose a valid start and end for this Timeline range.', 'booking' )
			);
		}

		$selection_step_minutes = absint( $configuration['selection_step_minutes'] );
		$duration_minutes       = (int) ( ( $end->getTimestamp() - $start->getTimestamp() ) / MINUTE_IN_SECONDS );
		if ( WPBC_Timeline_Time_Rows_Selection_Config::SELECTION_KIND_ALL_DAY === $selection_kind ) {
			if ( ! $this->is_local_midnight( $start ) || ! $this->is_local_midnight( $end ) ) {
				return $this->get_error(
					'wpbc_timeline_selection_full_day_invalid',
					__( 'A full-day Timeline selection must use exact local-day boundaries.', 'booking' )
				);
			}
		} elseif (
			$duration_minutes < $selection_step_minutes
			|| 0 !== $duration_minutes % $selection_step_minutes
			|| ! $this->is_wall_step_boundary( $start, $selection_step_minutes )
			|| ! $this->is_wall_step_boundary( $end, $selection_step_minutes )
		) {
			return $this->get_error(
				'wpbc_timeline_selection_snap_invalid',
				sprintf(
					/* translators: %d: server-defined Timeline selection step in minutes. */
					__( 'The selected range must align with the server-defined %d-minute Timeline selection step.', 'booking' ),
					$selection_step_minutes
				)
			);
		}

		return array(
			'start'                  => $start,
			'end'                    => $end,
			'selection_kind'         => $selection_kind,
			'selection_step_minutes' => $selection_step_minutes,
			'is_full_day'            => WPBC_Timeline_Time_Rows_Selection_Config::SELECTION_KIND_ALL_DAY === $selection_kind,
		);
	}

	/**
	 * Parse one offset-qualified instant and prove its wall time and offset in
	 * the authoritative site timezone.
	 *
	 * @param mixed        $candidate Candidate RFC 3339 value.
	 * @param DateTimeZone $timezone  Authoritative site timezone.
	 *
	 * @return DateTimeImmutable|WP_Error Exact instant or a safe error.
	 */
	private function parse_exact_instant( $candidate, $timezone ) {
		$candidate = is_scalar( $candidate ) ? (string) $candidate : '';
		if ( preg_match( '/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})$/', $candidate, $local_matches ) ) {
			$local_candidates = $this->resolve_local_candidates( $local_matches[1], $timezone );
			if ( 1 < count( $local_candidates ) ) {
				return $this->get_error(
					'wpbc_timeline_selection_fold_ambiguous',
					__( 'Choose which offset occurrence of the repeated local time to use.', 'booking' )
				);
			}
			if ( empty( $local_candidates ) ) {
				return $this->get_error(
					'wpbc_timeline_selection_gap_invalid',
					__( 'The selected local time does not exist because of a daylight-saving transition.', 'booking' )
				);
			}

			return $this->get_error(
				'wpbc_timeline_selection_offset_required',
				__( 'Choose an exact offset-qualified Timeline time.', 'booking' )
			);
		}

		if ( ! preg_match( '/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(Z|[+-]\d{2}:\d{2})$/', $candidate, $matches ) ) {
			return $this->get_error(
				'wpbc_timeline_selection_offset_invalid',
				__( 'Choose a valid offset-qualified Timeline time.', 'booking' )
			);
		}

		try {
			$instant = new DateTimeImmutable( $candidate );
		} catch ( Exception $exception ) {
			return $this->get_error(
				'wpbc_timeline_selection_offset_invalid',
				__( 'Choose a valid offset-qualified Timeline time.', 'booking' )
			);
		}

		$site_instant    = $instant->setTimezone( $timezone );
		$provided_offset = 'Z' === $matches[2] ? '+00:00' : $matches[2];
		if ( $matches[1] !== $site_instant->format( 'Y-m-d\TH:i:s' ) ) {
			if ( empty( $this->resolve_local_candidates( $matches[1], $timezone ) ) ) {
				return $this->get_error(
					'wpbc_timeline_selection_gap_invalid',
					__( 'The selected local time does not exist because of a daylight-saving transition.', 'booking' )
				);
			}

			return $this->get_error(
				'wpbc_timeline_selection_offset_invalid',
				__( 'The selected UTC offset does not match the site timezone.', 'booking' )
			);
		}
		if ( $provided_offset !== $site_instant->format( 'P' ) ) {
			return $this->get_error(
				'wpbc_timeline_selection_offset_invalid',
				__( 'The selected UTC offset does not match the site timezone.', 'booking' )
			);
		}

		return $site_instant;
	}

	/**
	 * Resolve every exact instant represented by one site-local wall time.
	 *
	 * Zero results identify a spring gap and two results identify a fall fold.
	 * The calculation uses only server timezone transitions and never the
	 * browser timezone.
	 *
	 * @param string       $local_time Site-local `Y-m-d\TH:i:s` value.
	 * @param DateTimeZone $timezone   Authoritative site timezone.
	 *
	 * @return array<int,DateTimeImmutable> Exact matching instants.
	 */
	private function resolve_local_candidates( $local_time, $timezone ) {
		$utc_timezone = new DateTimeZone( 'UTC' );
		$wall_time    = DateTimeImmutable::createFromFormat( '!Y-m-d\TH:i:s', $local_time, $utc_timezone );
		if ( ! $wall_time || $wall_time->format( 'Y-m-d\TH:i:s' ) !== $local_time ) {
			return array();
		}

		$wall_epoch = $wall_time->getTimestamp();
		$offsets    = array( $timezone->getOffset( $wall_time ) => true );
		$transitions = $timezone->getTransitions( $wall_epoch - ( 2 * DAY_IN_SECONDS ), $wall_epoch + ( 2 * DAY_IN_SECONDS ) );
		foreach ( is_array( $transitions ) ? $transitions : array() as $transition ) {
			if ( isset( $transition['offset'] ) ) {
				$offsets[ (int) $transition['offset'] ] = true;
			}
		}

		$candidates = array();
		foreach ( array_keys( $offsets ) as $offset_seconds ) {
			$candidate = ( new DateTimeImmutable( '@' . ( $wall_epoch - (int) $offset_seconds ) ) )->setTimezone( $timezone );
			if ( $candidate->format( 'Y-m-d\TH:i:s' ) === $local_time ) {
				$candidates[ $candidate->getTimestamp() ] = $candidate;
			}
		}
		ksort( $candidates, SORT_NUMERIC );

		return array_values( $candidates );
	}

	/**
	 * Determine whether an exact instant is a local midnight boundary.
	 *
	 * @param DateTimeImmutable $instant Exact site-timezone instant.
	 *
	 * @return bool True for midnight with no seconds.
	 */
	private function is_local_midnight( $instant ) {
		return '00:00:00' === $instant->format( 'H:i:s' );
	}

	/**
	 * Determine whether an instant aligns to the server wall-clock step.
	 *
	 * @param DateTimeImmutable $instant      Exact site-timezone instant.
	 * @param int               $step_minutes Server-owned step in minutes.
	 *
	 * @return bool True when aligned.
	 */
	private function is_wall_step_boundary( $instant, $step_minutes ) {
		$wall_minute = ( (int) $instant->format( 'G' ) * 60 ) + (int) $instant->format( 'i' );

		return '00' === $instant->format( 's' ) && 0 === $wall_minute % max( 1, absint( $step_minutes ) );
	}

	/**
	 * Build one safe validation error.
	 *
	 * @param string $code    Stable error code.
	 * @param string $message Translated safe message.
	 *
	 * @return WP_Error Error with HTTP status metadata.
	 */
	private function get_error( $code, $message ) {
		return new WP_Error( $code, $message, array( 'status' => 400 ) );
	}
}
