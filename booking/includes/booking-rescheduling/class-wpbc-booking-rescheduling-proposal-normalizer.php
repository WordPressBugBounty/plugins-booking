<?php
/**
 * Booking Rescheduling authoritative proposal normalization.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Convert bounded browser dates or exact intervals into one canonical schedule.
 */
final class WPBC_Booking_Rescheduling_Proposal_Normalizer {

	/**
	 * Normalize one transport proposal against the server-classified saved shape.
	 *
	 * @param array<string,mixed> $proposal     Bounded browser proposal.
	 * @param array<string,mixed> $shape_context Server-classified saved context.
	 * @param int                 $current_resource_id Current canonical primary Resource.
	 *
	 * @return array<string,mixed>|WP_Error Canonical schedule proposal or safe error.
	 */
	public function normalize( $proposal, $shape_context, $current_resource_id ) {
		$operation = isset( $proposal['operation'] ) ? sanitize_key( $proposal['operation'] ) : '';
		if ( ! in_array( $operation, (array) $shape_context['allowed_operations'], true ) ) {
			return $this->get_unsupported_error(
				sprintf(
					/* translators: %s: rejected rescheduling operation. */
					__( 'The saved booking schedule does not allow the requested %s operation.', 'booking' ),
					$operation
				)
			);
		}

		$target_resource_id = absint( $proposal['target_resource_id'] );
		$current_resource_id = absint( $current_resource_id );
		if (
			( 'change_resource' === $operation && $target_resource_id === $current_resource_id ) ||
			( 'change_resource' !== $operation && $target_resource_id !== $current_resource_id )
		) {
			return $this->get_unsupported_error(
				'change_resource' === $operation
					? __( 'The proposed Booking Resource is already assigned to this booking. Choose a different Booking Resource.', 'booking' )
					: __( 'This operation must keep the booking on its current Booking Resource.', 'booking' )
			);
		}

		$is_resize = in_array( $operation, array( 'resize_start', 'resize_end' ), true );
		if ( $is_resize && $this->uses_server_expanded_resize( $shape_context['shape'] ) ) {
			$schedule = $this->normalize_server_expanded_resize( $proposal, $shape_context );
			if ( is_wp_error( $schedule ) ) {
				return $schedule;
			}
		} elseif ( isset( $proposal['proposed_dates'] ) ) {
			$schedule = array(
				'selected_dates'   => array_values( $proposal['proposed_dates'] ),
				'time_application' => 'full_day',
				'start_time'       => '',
				'end_time'         => '',
				'exact_intervals'  => array(),
			);
		} else {
			$schedule = $this->normalize_intervals( $proposal['proposed_intervals'] );
			if ( is_wp_error( $schedule ) ) {
				return $schedule;
			}
		}

		$schedule['operation']            = $operation;
		$schedule['interaction_source']   = $proposal['interaction_source'];
		$schedule['target_resource_id']   = $target_resource_id;
		$schedule['proposal_revision']    = absint( $proposal['proposal_revision'] );
		$schedule['source_context_token'] = $proposal['source_context_token'];
		$schedule['selection_method']     = isset( $schedule['selection_method'] )
			? $schedule['selection_method']
			: ( isset( $proposal['selection_method'] ) && 'individual' === $proposal['selection_method']
			? 'individual'
			: 'policy' );

		$semantics_check = $this->validate_operation_semantics( $schedule, $shape_context['saved'] );
		if ( is_wp_error( $semantics_check ) ) {
			return $semantics_check;
		}

		return $schedule;
	}

	/**
	 * Reconstruct the immutable resize anchor used to bind a source token.
	 *
	 * The proposal's unchanged endpoint must identify exactly one canonical
	 * server-derived segment. No browser segment index or target identifier is
	 * accepted.
	 *
	 * @param array<string,mixed> $proposal      Normalized browser proposal.
	 * @param array<string,mixed> $shape_context Fresh server-classified shape context.
	 *
	 * @return array<string,mixed>|WP_Error Stable interaction binding or safe error.
	 */
	public function get_resize_anchor_context( $proposal, $shape_context ) {
		if (
			! isset( $proposal['interaction_source'], $proposal['operation'], $proposal['proposed_intervals'] ) ||
			'resize' !== $proposal['interaction_source'] ||
			! in_array( $proposal['operation'], array( 'resize_start', 'resize_end' ), true ) ||
			1 !== count( $proposal['proposed_intervals'] )
		) {
			return $this->get_unsupported_error( __( 'A Timeline resize must provide exactly one start or end boundary anchor interval.', 'booking' ) );
		}

		$normalized_anchor = $this->normalize_intervals( $proposal['proposed_intervals'] );
		if ( is_wp_error( $normalized_anchor ) || 1 !== count( $normalized_anchor['exact_intervals'] ) ) {
			return $this->get_time_error( __( 'The Timeline resize anchor contains an invalid, ambiguous, or nonexistent local date and time.', 'booking' ) );
		}
		$proposed_interval = reset( $normalized_anchor['exact_intervals'] );
		$saved_segments     = $this->get_saved_resize_segments( $shape_context['saved'] );
		if ( is_wp_error( $saved_segments ) ) {
			return $saved_segments;
		}
		$unchanged_boundary = 'resize_start' === $proposal['operation'] ? 'end' : 'start';
		$target_segment      = $this->find_exact_anchor_segment( $saved_segments, $proposed_interval, $unchanged_boundary );
		if ( empty( $target_segment ) ) {
			return $this->get_unsupported_error(
				sprintf(
					/* translators: %s: unchanged resize boundary, either start or end. */
					__( 'The resize anchor could not be matched because its unchanged %s boundary no longer matches the saved booking.', 'booking' ),
					$unchanged_boundary
				)
			);
		}
		$is_group_resize = in_array( $shape_context['shape'], array( 'recurrent_timed_intervals', 'discontinuous_timed_intervals' ), true );

		return array(
			'interaction_source' => 'resize',
			'saved_shape'        => sanitize_key( $shape_context['shape'] ),
			'resize_scope'       => $is_group_resize ? 'shared_time_all_occurrences' : ( 'independent_full_days' === $shape_context['shape'] ? 'contiguous_full_day_segment' : 'single_interval' ),
			'immutable_interval' => $target_segment,
		);
	}

	/**
	 * Reconstruct the immutable direct-movement scope used by a source token.
	 *
	 * The target Resource is deliberately excluded because it must be authorized
	 * independently during Review and Apply. The binding prevents a token issued
	 * for one direct interaction, saved shape, selection mode, or proposal
	 * revision from authorizing another proposal.
	 *
	 * @param array<string,mixed> $proposal      Normalized browser proposal.
	 * @param array<string,mixed> $shape_context Fresh server-classified shape context.
	 *
	 * @return array<string,mixed>|WP_Error Stable interaction binding or safe error.
	 */
	public function get_movement_context( $proposal, $shape_context ) {
		$interaction_source = isset( $proposal['interaction_source'] ) ? sanitize_key( $proposal['interaction_source'] ) : '';
		$operation          = isset( $proposal['operation'] ) ? sanitize_key( $proposal['operation'] ) : '';
		$proposal_revision  = isset( $proposal['proposal_revision'] ) ? absint( $proposal['proposal_revision'] ) : 0;
		$expected_operation = 'drag' === $interaction_source ? 'shift' : 'change_resource';
		$saved_shape        = isset( $shape_context['shape'] ) ? sanitize_key( $shape_context['shape'] ) : '';
		$saved_method       = isset( $shape_context['saved']['selection_method'] )
			? sanitize_key( $shape_context['saved']['selection_method'] )
			: '';
		$proposed_method    = isset( $proposal['selection_method'] )
			? sanitize_key( $proposal['selection_method'] )
			: '';

		if (
			! in_array( $interaction_source, array( 'drag', 'cross_resource_drag' ), true ) ||
			$expected_operation !== $operation ||
			! $proposal_revision ||
			'' === $saved_shape ||
			! in_array( $saved_method, array( 'policy', 'individual' ), true ) ||
			$saved_method !== $proposed_method
		) {
			return $this->get_unsupported_error( __( 'The Timeline movement no longer matches its saved interaction scope or date-selection method.', 'booking' ) );
		}

		return array(
			'interaction_source' => $interaction_source,
			'saved_shape'        => $saved_shape,
			'movement_scope'     => 'drag' === $interaction_source ? 'same_resource_shift' : 'cross_resource_shift',
			'selection_method'   => $saved_method,
			'proposal_revision'  => $proposal_revision,
		);
	}

	/**
	 * Determine whether resize semantics must be expanded from canonical saved state.
	 *
	 * @param string $shape Server-classified saved shape.
	 *
	 * @return bool True for date-only or shared-time multi-occurrence shapes.
	 */
	private function uses_server_expanded_resize( $shape ) {
		return in_array(
			$shape,
			array(
				'single_full_day',
				'continuous_full_day_range',
				'independent_full_days',
				'recurrent_timed_intervals',
				'discontinuous_timed_intervals',
			),
			true
		);
	}

	/**
	 * Expand one browser anchor interval into a complete canonical resize schedule.
	 *
	 * The browser identifies geometry only. The saved dates, target segment, shared
	 * time model, and every affected exact interval are reconstructed here from the
	 * fresh server projection.
	 *
	 * @param array<string,mixed> $proposal      Normalized browser proposal.
	 * @param array<string,mixed> $shape_context Fresh server-classified shape context.
	 *
	 * @return array<string,mixed>|WP_Error Canonical schedule or safe error.
	 */
	private function normalize_server_expanded_resize( $proposal, $shape_context ) {
		if ( ! isset( $proposal['proposed_intervals'] ) || 1 !== count( $proposal['proposed_intervals'] ) ) {
			return $this->get_unsupported_error( __( 'This group resize requires exactly one clicked occurrence as its anchor.', 'booking' ) );
		}

		if ( 'full_day' === $shape_context['saved']['time_application'] ) {
			return $this->normalize_full_day_resize( $proposal, $shape_context );
		}

		return $this->normalize_shared_time_resize( $proposal, $shape_context );
	}

	/**
	 * Rebuild a full-day schedule by replacing only the server-matched date run.
	 *
	 * @param array<string,mixed> $proposal      Normalized browser proposal.
	 * @param array<string,mixed> $shape_context Fresh server-classified shape context.
	 *
	 * @return array<string,mixed>|WP_Error Canonical full-day schedule or safe error.
	 */
	private function normalize_full_day_resize( $proposal, $shape_context ) {
		$normalized_anchor = $this->normalize_intervals( $proposal['proposed_intervals'] );
		if ( is_wp_error( $normalized_anchor ) || 1 !== count( $normalized_anchor['exact_intervals'] ) ) {
			return $this->get_time_error( __( 'The full-day resize anchor contains an invalid, ambiguous, or nonexistent local date and time.', 'booking' ) );
		}

		$proposed_interval = reset( $normalized_anchor['exact_intervals'] );
		$site_timezone     = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		$proposed_start    = new DateTimeImmutable( $proposed_interval['start'] );
		$proposed_end      = new DateTimeImmutable( $proposed_interval['end'] );
		$proposed_start    = $proposed_start->setTimezone( $site_timezone );
		$proposed_end      = $proposed_end->setTimezone( $site_timezone );
		if ( '00:00' !== $proposed_start->format( 'H:i' ) || '00:00' !== $proposed_end->format( 'H:i' ) ) {
			return $this->get_time_error( __( 'Full-day resize boundaries must use exact local midnight instants.', 'booking' ) );
		}

		$saved_segments = $this->get_saved_resize_segments( $shape_context['saved'] );
		if ( is_wp_error( $saved_segments ) ) {
			return $saved_segments;
		}
		$changed_boundary   = 'resize_start' === $proposal['operation'] ? 'start' : 'end';
		$unchanged_boundary = 'start' === $changed_boundary ? 'end' : 'start';
		$target_segment      = $this->find_exact_anchor_segment( $saved_segments, $proposed_interval, $unchanged_boundary );
		if ( ! $target_segment ) {
			return $this->get_unsupported_error(
				sprintf(
					/* translators: %s: unchanged resize boundary, either start or end. */
					__( 'The full-day resize could not be matched because its unchanged %s boundary no longer matches a saved date segment.', 'booking' ),
					$unchanged_boundary
				)
			);
		}

		$replacement_dates = $this->get_half_open_dates( $proposed_start, $proposed_end );
		if ( is_wp_error( $replacement_dates ) ) {
			return $replacement_dates;
		}
		$target_dates = $this->get_half_open_dates(
			new DateTimeImmutable( $target_segment['start'] ),
			new DateTimeImmutable( $target_segment['end'] )
		);
		if ( is_wp_error( $target_dates ) ) {
			return $target_dates;
		}

		$selected_dates = array_values(
			array_unique(
				array_merge(
					array_values( array_diff( $shape_context['saved']['selected_dates'], $target_dates ) ),
					$replacement_dates
				)
			)
		);
		sort( $selected_dates, SORT_STRING );
		if ( empty( $selected_dates ) || count( $selected_dates ) > WPBC_Booking_Rescheduling_Proposal_Contract::MAX_PROPOSED_DATES ) {
			return $this->get_unsupported_error(
				sprintf(
					/* translators: %d: maximum supported selected-date count. */
					__( 'The resized full-day segment must contain at least one date and no more than %d dates.', 'booking' ),
					WPBC_Booking_Rescheduling_Proposal_Contract::MAX_PROPOSED_DATES
				)
			);
		}

		return array(
			'selected_dates'          => $selected_dates,
			'time_application'        => 'full_day',
			'start_time'              => '',
			'end_time'                => '',
			'exact_intervals'         => array(),
			'resize_scope'            => 'contiguous_full_day_segment',
			'affected_interval_count' => 1,
			'saved_segment_date_count' => count( $target_dates ),
			'proposed_segment_date_count' => count( $replacement_dates ),
			'saved_segment_dates'     => array_values( $target_dates ),
			'proposed_segment_dates'  => array_values( $replacement_dates ),
			'selection_method'        => 'independent_full_days' === $shape_context['shape'] ? 'individual' : 'policy',
		);
	}

	/**
	 * Apply one shared wall-clock boundary to every canonical timed occurrence.
	 *
	 * @param array<string,mixed> $proposal      Normalized browser proposal.
	 * @param array<string,mixed> $shape_context Fresh server-classified shape context.
	 *
	 * @return array<string,mixed>|WP_Error Canonical shared-time schedule or safe error.
	 */
	private function normalize_shared_time_resize( $proposal, $shape_context ) {
		$normalized_anchor = $this->normalize_intervals( $proposal['proposed_intervals'] );
		if ( is_wp_error( $normalized_anchor ) || 1 !== count( $normalized_anchor['exact_intervals'] ) ) {
			return $this->get_time_error( __( 'The timed resize anchor contains an invalid, ambiguous, or nonexistent local date and time.', 'booking' ) );
		}

		$proposed_interval = reset( $normalized_anchor['exact_intervals'] );
		$saved_intervals   = $this->get_saved_exact_intervals( $shape_context['saved'] );
		if ( is_wp_error( $saved_intervals ) ) {
			return $saved_intervals;
		}
		$changed_boundary   = 'resize_start' === $proposal['operation'] ? 'start' : 'end';
		$unchanged_boundary = 'start' === $changed_boundary ? 'end' : 'start';
		$anchor_index       = $this->find_exact_anchor_index( $saved_intervals, $proposed_interval, $unchanged_boundary );
		if ( null === $anchor_index ) {
			return $this->get_unsupported_error(
				sprintf(
					/* translators: %s: unchanged resize boundary, either start or end. */
					__( 'The clicked occurrence could not be matched because its unchanged %s boundary no longer matches exactly one saved occurrence.', 'booking' ),
					$unchanged_boundary
				)
			);
		}

		$site_timezone  = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		$changed_instant = ( new DateTimeImmutable( $proposed_interval[ $changed_boundary ] ) )->setTimezone( $site_timezone );
		$start_time      = 'start' === $changed_boundary ? $changed_instant->format( 'H:i' ) : $shape_context['saved']['start_time'];
		$end_time        = 'end' === $changed_boundary ? $changed_instant->format( 'H:i' ) : $shape_context['saved']['end_time'];
		$rebuilt         = $this->build_per_date_intervals( $shape_context['saved']['selected_dates'], $start_time, $end_time );
		if ( is_wp_error( $rebuilt ) ) {
			return $rebuilt;
		}
		if (
			! isset( $rebuilt[ $anchor_index ] ) ||
			! $this->intervals_match_exactly( $rebuilt[ $anchor_index ], $proposed_interval ) ||
			$this->intervals_overlap( $rebuilt )
		) {
			return $this->get_unsupported_error( __( 'Applying the shared time boundary would create an overlapping or internally inconsistent occurrence group.', 'booking' ) );
		}

		return array(
			'selected_dates'          => array_values( $shape_context['saved']['selected_dates'] ),
			'time_application'        => 'per_date',
			'start_time'              => $start_time,
			'end_time'                => $end_time,
			'exact_intervals'         => $rebuilt,
			'resize_scope'            => 'shared_time_all_occurrences',
			'affected_interval_count' => count( $rebuilt ),
			'review_interval_index'   => $anchor_index,
		);
	}

	/**
	 * Normalize exact RFC3339 intervals in the current site timezone.
	 *
	 * Explicit offsets must match the site's offset at the represented instant,
	 * which rejects forged offsets and nonexistent DST wall times. Heterogeneous
	 * multiple intervals remain unsupported until canonical storage can preserve
	 * their exact independent time values.
	 *
	 * @param array<int,array{start:string,end:string}> $intervals Exact intervals.
	 *
	 * @return array<string,mixed>|WP_Error Canonical schedule or safe error.
	 */
	private function normalize_intervals( $intervals ) {
		$site_timezone      = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		$canonical_intervals = array();
		foreach ( $intervals as $interval_index => $interval ) {
			$start = new DateTimeImmutable( $interval['start'] );
			$end   = new DateTimeImmutable( $interval['end'] );
			$start_local = $start->setTimezone( $site_timezone );
			$end_local   = $end->setTimezone( $site_timezone );
			if (
				$this->normalize_offset( $interval['start'] ) !== $start_local->format( 'P' ) ||
				$this->normalize_offset( $interval['end'] ) !== $end_local->format( 'P' ) ||
				! $this->is_unambiguous_site_instant( $start_local, $site_timezone ) ||
				! $this->is_unambiguous_site_instant( $end_local, $site_timezone )
			) {
				return $this->get_time_error(
					sprintf(
						/* translators: %d: one-based proposed interval position. */
						__( 'Proposed interval %d uses an offset that does not match the current site timezone, or it resolves to an ambiguous or nonexistent daylight-saving wall time.', 'booking' ),
						$interval_index + 1
					)
				);
			}
			$canonical_intervals[] = array(
				'start'            => $start_local->format( 'Y-m-d\TH:i:sP' ),
				'end'              => $end_local->format( 'Y-m-d\TH:i:sP' ),
				'start_date'       => $start_local->format( 'Y-m-d' ),
				'end_date'         => $end_local->format( 'Y-m-d' ),
				'start_time'       => $start_local->format( 'H:i' ),
				'end_time'         => $end_local->format( 'H:i' ),
				'duration_minutes' => (int) ( ( $end->getTimestamp() - $start->getTimestamp() ) / 60 ),
			);
		}

		$first = reset( $canonical_intervals );
		if ( 1 === count( $canonical_intervals ) ) {
			$selected_dates = $this->get_inclusive_dates( $first['start_date'], $first['end_date'] );
			$time_mode      = $first['start_date'] === $first['end_date'] ? 'per_date' : 'boundary';
		} else {
			$selected_dates = array();
			foreach ( $canonical_intervals as $interval_index => $canonical_interval ) {
				if (
					$canonical_interval['start_date'] !== $canonical_interval['end_date'] ||
					$canonical_interval['start_time'] !== $first['start_time'] ||
					$canonical_interval['end_time'] !== $first['end_time'] ||
					$canonical_interval['duration_minutes'] !== $first['duration_minutes']
				) {
					return $this->get_unsupported_error(
						sprintf(
							/* translators: %d: one-based proposed interval position. */
							__( 'Proposed interval %d does not use the same local start time, end time, and per-occurrence duration as the other occurrences.', 'booking' ),
							$interval_index + 1
						)
					);
				}
				$selected_dates[] = $canonical_interval['start_date'];
			}
			$selected_dates = array_values( array_unique( $selected_dates ) );
			sort( $selected_dates, SORT_STRING );
			$time_mode = 'per_date';
		}

		return array(
			'selected_dates'   => $selected_dates,
			'time_application' => $time_mode,
			'start_time'       => $first['start_time'],
			'end_time'         => $first['end_time'],
			'exact_intervals'  => $canonical_intervals,
		);
	}

	/**
	 * Validate operation-specific invariants against the canonical saved value.
	 *
	 * @param array<string,mixed> $schedule Canonical proposed schedule.
	 * @param array<string,mixed> $saved    Canonical saved projection.
	 *
	 * @return true|WP_Error True when valid, otherwise safe error.
	 */
	private function validate_operation_semantics( $schedule, $saved ) {
		$operation                  = $schedule['operation'];
		$interaction_source         = isset( $schedule['interaction_source'] ) ? sanitize_key( $schedule['interaction_source'] ) : '';
		$is_cross_resource_movement = 'cross_resource_drag' === $interaction_source && 'change_resource' === $operation;

		if ( $is_cross_resource_movement ) {
			$saved_method = isset( $saved['selection_method'] ) ? sanitize_key( $saved['selection_method'] ) : '';
			if (
				! in_array( $saved_method, array( 'policy', 'individual' ), true ) ||
				$saved_method !== $schedule['selection_method']
			) {
				return $this->get_unsupported_error( __( 'A cross-Resource Timeline movement must preserve the saved date-selection method.', 'booking' ) );
			}
		}

		if ( 'shift' === $operation || $is_cross_resource_movement ) {
			$shift_check = $this->validate_shift_semantics( $schedule, $saved );
			if ( is_wp_error( $shift_check ) ) {
				return $shift_check;
			}
		}
		if ( 'resize_start' === $operation ) {
			$resize_check = $this->validate_resize_semantics( $schedule, $saved, 'start' );
			if ( is_wp_error( $resize_check ) ) {
				return $resize_check;
			}
		}
		if ( 'resize_end' === $operation ) {
			$resize_check = $this->validate_resize_semantics( $schedule, $saved, 'end' );
			if ( is_wp_error( $resize_check ) ) {
				return $resize_check;
			}
		}

		return true;
	}

	/**
	 * Validate one exact boundary adjustment against the saved interval.
	 *
	 * The unchanged endpoint is compared as an instant instead of as a date-list
	 * position. This preserves valid overnight resizing when normalization moves
	 * between per-date and boundary presentation modes.
	 *
	 * @param array<string,mixed> $schedule         Canonical proposed schedule.
	 * @param array<string,mixed> $saved            Canonical saved projection.
	 * @param string              $changed_boundary Boundary being changed: `start` or `end`.
	 *
	 * @return true|WP_Error True when only the requested boundary changed, otherwise a safe error.
	 */
	private function validate_resize_semantics( $schedule, $saved, $changed_boundary ) {
		if (
			isset( $schedule['resize_scope'] ) &&
			in_array( $schedule['resize_scope'], array( 'contiguous_full_day_segment', 'shared_time_all_occurrences' ), true )
		) {
			return true;
		}

		$saved_intervals = $this->get_saved_exact_intervals( $saved );
		if ( is_wp_error( $saved_intervals ) ) {
			return $saved_intervals;
		}
		if ( 1 !== count( $saved_intervals ) || 1 !== count( $schedule['exact_intervals'] ) ) {
			return $this->get_unsupported_error( __( 'This single-boundary resize requires exactly one saved interval and one proposed interval.', 'booking' ) );
		}

		$unchanged_boundary = 'start' === $changed_boundary ? 'end' : 'start';
		$saved_instant      = new DateTimeImmutable( $saved_intervals[0][ $unchanged_boundary ] );
		$proposed_instant   = new DateTimeImmutable( $schedule['exact_intervals'][0][ $unchanged_boundary ] );
		if ( $saved_instant->getTimestamp() !== $proposed_instant->getTimestamp() ) {
			return $this->get_unsupported_error(
				sprintf(
					/* translators: %s: unchanged resize boundary, either start or end. */
					__( 'The proposal changes both boundaries. A %s-boundary resize must preserve the saved %s boundary exactly.', 'booking' ),
					$changed_boundary,
					$unchanged_boundary
				)
			);
		}

		return true;
	}

	/**
	 * Validate that a shift moves the complete saved schedule uniformly.
	 *
	 * Date-only schedules move by a uniform calendar-day delta. Timed schedules
	 * compare exact site-timezone instants so an overnight interval can cross
	 * midnight without a false rejection caused by clock-face time wrapping.
	 *
	 * @param array<string,mixed> $schedule Canonical proposed schedule.
	 * @param array<string,mixed> $saved    Canonical saved projection.
	 *
	 * @return true|WP_Error True when the shift is uniform, otherwise a safe error.
	 */
	private function validate_shift_semantics( $schedule, $saved ) {
		$saved_is_full_day    = 'full_day' === $saved['time_application'];
		$proposed_is_full_day = 'full_day' === $schedule['time_application'];

		if ( $saved_is_full_day || $proposed_is_full_day ) {
			if (
				! $saved_is_full_day ||
				! $proposed_is_full_day ||
				count( $schedule['selected_dates'] ) !== count( $saved['selected_dates'] ) ||
				$this->get_duration_minutes( $schedule ) !== $this->get_duration_minutes( $saved ) ||
				! $this->has_uniform_date_shift( $saved['selected_dates'], $schedule['selected_dates'] )
			) {
				return $this->get_unsupported_error( __( 'A full-day shift must preserve the number of selected dates, duration, and the same calendar-day offset for every date.', 'booking' ) );
			}

			return true;
		}

		$saved_intervals = $this->get_saved_exact_intervals( $saved );
		if ( is_wp_error( $saved_intervals ) ) {
			return $saved_intervals;
		}
		if ( empty( $schedule['exact_intervals'] ) || count( $schedule['exact_intervals'] ) !== count( $saved_intervals ) ) {
			return $this->get_unsupported_error(
				sprintf(
					/* translators: 1: proposed interval count, 2: saved interval count. */
					__( 'The proposed shift contains %1$d intervals, but the saved schedule contains %2$d. A shift must move every interval.', 'booking' ),
					count( $schedule['exact_intervals'] ),
					count( $saved_intervals )
				)
			);
		}

		$expected_shift_seconds = null;
		foreach ( $saved_intervals as $interval_index => $saved_interval ) {
			$proposed_interval = $schedule['exact_intervals'][ $interval_index ];
			$saved_start       = new DateTimeImmutable( $saved_interval['start'] );
			$saved_end         = new DateTimeImmutable( $saved_interval['end'] );
			$proposed_start    = new DateTimeImmutable( $proposed_interval['start'] );
			$proposed_end      = new DateTimeImmutable( $proposed_interval['end'] );
			$start_shift       = $proposed_start->getTimestamp() - $saved_start->getTimestamp();
			$end_shift         = $proposed_end->getTimestamp() - $saved_end->getTimestamp();

			if (
				$start_shift !== $end_shift ||
				( $saved_end->getTimestamp() - $saved_start->getTimestamp() ) !== ( $proposed_end->getTimestamp() - $proposed_start->getTimestamp() ) ||
				( null !== $expected_shift_seconds && $start_shift !== $expected_shift_seconds )
			) {
				return $this->get_unsupported_error(
					sprintf(
						/* translators: %d: one-based interval position that failed uniform-shift validation. */
						__( 'Proposed interval %d does not preserve both its duration and the same start/end shift used by every other interval.', 'booking' ),
						$interval_index + 1
					)
				);
			}
			$expected_shift_seconds = $start_shift;
		}

		return true;
	}

	/**
	 * Rebuild the server-authoritative exact intervals from a saved projection.
	 *
	 * The Date Editor projection deliberately exposes date/time controls rather
	 * than browser-authoritative timestamps. Rebuilding here keeps shift
	 * semantics tied to canonical saved rows and the current WordPress timezone.
	 *
	 * @param array<string,mixed> $saved Canonical saved projection.
	 *
	 * This public projection is shared by server-owned interaction policies so
	 * gesture eligibility and Review compare against the same immutable instants.
	 * It does not accept browser timestamps and does not mutate canonical data.
	 *
	 * @return array<int,array{start:string,end:string}>|WP_Error Exact intervals or a safe time error.
	 */
	public function get_saved_exact_intervals( $saved ) {
		$site_timezone = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		$saved_dates   = isset( $saved['selected_dates'] ) ? array_values( (array) $saved['selected_dates'] ) : array();
		$start_time    = isset( $saved['start_time'] ) ? (string) $saved['start_time'] : '';
		$end_time      = isset( $saved['end_time'] ) ? (string) $saved['end_time'] : '';
		$intervals     = array();

		if ( empty( $saved_dates ) || ! preg_match( '/^\d{2}:\d{2}$/', $start_time ) || ! preg_match( '/^\d{2}:\d{2}$/', $end_time ) ) {
			return $this->get_unsupported_error( __( 'The saved booking is missing canonical dates or exact start/end times required for Timeline resizing.', 'booking' ) );
		}

		if ( 'boundary' === $saved['time_application'] ) {
			$start = $this->create_strict_site_date_time( reset( $saved_dates ), $start_time, $site_timezone );
			$end   = $this->create_strict_site_date_time( end( $saved_dates ), $end_time, $site_timezone );
			if ( ! $start || ! $end || $end <= $start ) {
				return $this->get_time_error( __( 'The saved boundary interval is ambiguous, nonexistent, or ends before it starts in the current site timezone.', 'booking' ) );
			}
			$intervals[] = array(
				'start' => $start->format( 'Y-m-d\TH:i:sP' ),
				'end'   => $end->format( 'Y-m-d\TH:i:sP' ),
			);

			return $intervals;
		}

		if ( 'per_date' !== $saved['time_application'] ) {
			return $this->get_unsupported_error( __( 'The saved timed schedule is neither one boundary interval nor a supported repeated interval per date.', 'booking' ) );
		}

		foreach ( $saved_dates as $saved_date ) {
			$end_date = $end_time <= $start_time
				? ( new DateTimeImmutable( $saved_date, new DateTimeZone( 'UTC' ) ) )->modify( '+1 day' )->format( 'Y-m-d' )
				: $saved_date;
			$start    = $this->create_strict_site_date_time( $saved_date, $start_time, $site_timezone );
			$end      = $this->create_strict_site_date_time( $end_date, $end_time, $site_timezone );
			if ( ! $start || ! $end || $end <= $start ) {
				return $this->get_time_error(
					sprintf(
						/* translators: %s: saved ISO occurrence date. */
						__( 'The saved occurrence on %s is ambiguous, nonexistent, or ends before it starts in the current site timezone.', 'booking' ),
						$saved_date
					)
				);
			}
			$intervals[] = array(
				'start' => $start->format( 'Y-m-d\TH:i:sP' ),
				'end'   => $end->format( 'Y-m-d\TH:i:sP' ),
			);
		}

		return $intervals;
	}

	/**
	 * Project canonical saved state into independently targetable resize segments.
	 *
	 * Timed per-date schedules expose one server-derived occurrence per selected
	 * date. Full-day schedules expose contiguous half-open calendar runs so a
	 * disconnected date set can resize one run without relying on a browser index.
	 *
	 * @param array<string,mixed> $saved Canonical saved projection.
	 *
	 * @return array<int,array{start:string,end:string}>|WP_Error Resize segments or a safe error.
	 */
	public function get_saved_resize_segments( $saved ) {
		if ( ! isset( $saved['time_application'] ) || 'full_day' !== $saved['time_application'] ) {
			return $this->get_saved_exact_intervals( $saved );
		}

		$site_timezone = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		$saved_dates   = isset( $saved['selected_dates'] ) ? array_values( array_unique( (array) $saved['selected_dates'] ) ) : array();
		if ( empty( $saved_dates ) ) {
			return $this->get_unsupported_error( __( 'The saved full-day booking does not contain any canonical selected dates.', 'booking' ) );
		}
		sort( $saved_dates, SORT_STRING );

		$segments      = array();
		$segment_start = reset( $saved_dates );
		$segment_end   = $segment_start;
		foreach ( array_slice( $saved_dates, 1 ) as $saved_date ) {
			$expected_date = ( new DateTimeImmutable( $segment_end, new DateTimeZone( 'UTC' ) ) )->modify( '+1 day' )->format( 'Y-m-d' );
			if ( $expected_date !== $saved_date ) {
				$segments[]    = $this->build_full_day_segment( $segment_start, $segment_end, $site_timezone );
				$segment_start = $saved_date;
			}
			$segment_end = $saved_date;
		}
		$segments[] = $this->build_full_day_segment( $segment_start, $segment_end, $site_timezone );

		foreach ( $segments as $segment ) {
			if ( is_wp_error( $segment ) ) {
				return $segment;
			}
		}

		return $segments;
	}

	/**
	 * Build one half-open full-day segment with site-timezone calendar arithmetic.
	 *
	 * @param string       $start_date    Inclusive first selected date.
	 * @param string       $end_date      Inclusive final selected date.
	 * @param DateTimeZone $site_timezone Current WordPress site timezone.
	 *
	 * @return array{start:string,end:string}|WP_Error Exact segment or safe error.
	 */
	private function build_full_day_segment( $start_date, $end_date, $site_timezone ) {
		$start = $this->create_strict_site_date_time( $start_date, '00:00', $site_timezone );
		$end   = $this->create_strict_site_date_time(
			( new DateTimeImmutable( $end_date, new DateTimeZone( 'UTC' ) ) )->modify( '+1 day' )->format( 'Y-m-d' ),
			'00:00',
			$site_timezone
		);
		if ( ! $start || ! $end || $end <= $start ) {
			return $this->get_time_error(
				sprintf(
					/* translators: 1: first ISO date in the saved segment, 2: last ISO date in the saved segment. */
					__( 'The saved full-day segment from %1$s through %2$s cannot be represented as exact local-midnight boundaries in the current site timezone.', 'booking' ),
					$start_date,
					$end_date
				)
			);
		}

		return array(
			'start' => $start->format( 'Y-m-d\TH:i:sP' ),
			'end'   => $end->format( 'Y-m-d\TH:i:sP' ),
		);
	}

	/**
	 * Find the unique segment whose unchanged endpoint matches a proposal anchor.
	 *
	 * @param array<int,array{start:string,end:string}> $segments           Canonical segments.
	 * @param array<string,mixed>                       $proposed_interval  Proposed anchor interval.
	 * @param string                                    $unchanged_boundary Unchanged endpoint key.
	 *
	 * @return array{start:string,end:string}|array{} Unique segment or an empty record.
	 */
	private function find_exact_anchor_segment( $segments, $proposed_interval, $unchanged_boundary ) {
		$index = $this->find_exact_anchor_index( $segments, $proposed_interval, $unchanged_boundary );

		return null === $index ? array() : $segments[ $index ];
	}

	/**
	 * Find the unique canonical interval identified by its protected endpoint.
	 *
	 * @param array<int,array{start:string,end:string}> $segments           Canonical segments.
	 * @param array<string,mixed>                       $proposed_interval  Proposed anchor interval.
	 * @param string                                    $unchanged_boundary Unchanged endpoint key.
	 *
	 * @return int|null Zero-based interval index or null when not unique.
	 */
	private function find_exact_anchor_index( $segments, $proposed_interval, $unchanged_boundary ) {
		$proposal_instant = new DateTimeImmutable( $proposed_interval[ $unchanged_boundary ] );
		$matched_index    = null;
		foreach ( $segments as $segment_index => $segment ) {
			$segment_instant = new DateTimeImmutable( $segment[ $unchanged_boundary ] );
			if ( $proposal_instant->getTimestamp() !== $segment_instant->getTimestamp() ) {
				continue;
			}
			if ( null !== $matched_index ) {
				return null;
			}
			$matched_index = $segment_index;
		}

		return $matched_index;
	}

	/**
	 * Enumerate full dates inside a half-open site-timezone interval.
	 *
	 * @param DateTimeImmutable $start Inclusive local midnight.
	 * @param DateTimeImmutable $end   Exclusive local midnight.
	 *
	 * @return array<int,string>|WP_Error Ordered dates or safe error.
	 */
	private function get_half_open_dates( $start, $end ) {
		if ( $end <= $start ) {
			return $this->get_time_error( __( 'The proposed full-day end boundary must be later than its start boundary.', 'booking' ) );
		}

		$dates   = array();
		$current = $start;
		while ( $current < $end && count( $dates ) <= WPBC_Booking_Rescheduling_Proposal_Contract::MAX_PROPOSED_DATES ) {
			$dates[] = $current->format( 'Y-m-d' );
			$current = $current->modify( '+1 day' );
		}
		if ( $current != $end || empty( $dates ) || count( $dates ) > WPBC_Booking_Rescheduling_Proposal_Contract::MAX_PROPOSED_DATES ) {
			return $this->get_time_error(
				sprintf(
					/* translators: %d: maximum supported selected-date count. */
					__( 'The proposed full-day boundaries are not aligned to whole local calendar days or exceed the %d-date limit.', 'booking' ),
					WPBC_Booking_Rescheduling_Proposal_Contract::MAX_PROPOSED_DATES
				)
			);
		}

		return $dates;
	}

	/**
	 * Build every exact interval from shared per-date wall-clock boundaries.
	 *
	 * @param array<int,string> $selected_dates Canonical occurrence dates.
	 * @param string            $start_time     Shared start time.
	 * @param string            $end_time       Shared end time.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Exact intervals or safe error.
	 */
	private function build_per_date_intervals( $selected_dates, $start_time, $end_time ) {
		$saved_projection = array(
			'selected_dates'   => array_values( $selected_dates ),
			'time_application' => 'per_date',
			'start_time'       => $start_time,
			'end_time'         => $end_time,
		);
		$intervals = $this->get_saved_exact_intervals( $saved_projection );
		if ( is_wp_error( $intervals ) ) {
			return $intervals;
		}

		foreach ( $intervals as $interval_index => $interval ) {
			$start = new DateTimeImmutable( $interval['start'] );
			$end   = new DateTimeImmutable( $interval['end'] );
			$intervals[ $interval_index ]['start_date']       = $start->format( 'Y-m-d' );
			$intervals[ $interval_index ]['end_date']         = $end->format( 'Y-m-d' );
			$intervals[ $interval_index ]['start_time']       = $start->format( 'H:i' );
			$intervals[ $interval_index ]['end_time']         = $end->format( 'H:i' );
			$intervals[ $interval_index ]['duration_minutes'] = (int) ( ( $end->getTimestamp() - $start->getTimestamp() ) / 60 );
		}

		return $intervals;
	}

	/**
	 * Compare two interval records as exact instants.
	 *
	 * @param array<string,mixed> $first_interval  First interval.
	 * @param array<string,mixed> $second_interval Second interval.
	 *
	 * @return bool True when both endpoints represent the same instants.
	 */
	private function intervals_match_exactly( $first_interval, $second_interval ) {
		return ( new DateTimeImmutable( $first_interval['start'] ) )->getTimestamp() === ( new DateTimeImmutable( $second_interval['start'] ) )->getTimestamp()
			&& ( new DateTimeImmutable( $first_interval['end'] ) )->getTimestamp() === ( new DateTimeImmutable( $second_interval['end'] ) )->getTimestamp();
	}

	/**
	 * Detect overlap among proposed occurrences from the same booking.
	 *
	 * @param array<int,array<string,mixed>> $intervals Ordered exact intervals.
	 *
	 * @return bool True when any occurrence overlaps another occurrence.
	 */
	private function intervals_overlap( $intervals ) {
		usort(
			$intervals,
			static function ( $first_interval, $second_interval ) {
				return strcmp( $first_interval['start'], $second_interval['start'] );
			}
		);
		for ( $interval_index = 1; $interval_index < count( $intervals ); $interval_index++ ) {
			$previous_end = new DateTimeImmutable( $intervals[ $interval_index - 1 ]['end'] );
			$current_start = new DateTimeImmutable( $intervals[ $interval_index ]['start'] );
			if ( $previous_end > $current_start ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Create one strict, unambiguous minute in the current site timezone.
	 *
	 * @param string       $date_value    Strict `YYYY-MM-DD` date.
	 * @param string       $time_value    Strict `HH:MM` time.
	 * @param DateTimeZone $site_timezone Current WordPress site timezone.
	 *
	 * @return DateTimeImmutable|null Parsed instant, or null for normalized, missing, or repeated wall minutes.
	 */
	private function create_strict_site_date_time( $date_value, $time_value, $site_timezone ) {
		$wall_minute = $date_value . ' ' . $time_value;
		$instant     = DateTimeImmutable::createFromFormat( '!Y-m-d H:i', $wall_minute, $site_timezone );

		if ( ! $instant || $instant->format( 'Y-m-d H:i' ) !== $wall_minute || ! $this->is_unambiguous_site_instant( $instant, $site_timezone ) ) {
			return null;
		}

		return $instant;
	}

	/**
	 * Verify that every proposed date moved by the same calendar-day delta.
	 *
	 * @param array<int,string> $saved_dates    Saved ordered dates.
	 * @param array<int,string> $proposed_dates Proposed ordered dates.
	 *
	 * @return bool True for one uniform shift.
	 */
	private function has_uniform_date_shift( $saved_dates, $proposed_dates ) {
		$expected_delta = null;
		foreach ( $saved_dates as $index => $saved_date ) {
			if ( ! isset( $proposed_dates[ $index ] ) ) {
				return false;
			}
			$saved    = new DateTimeImmutable( $saved_date, new DateTimeZone( 'UTC' ) );
			$proposed = new DateTimeImmutable( $proposed_dates[ $index ], new DateTimeZone( 'UTC' ) );
			$delta    = (int) $saved->diff( $proposed )->format( '%r%a' );
			if ( null === $expected_delta ) {
				$expected_delta = $delta;
			} elseif ( $expected_delta !== $delta ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Calculate logical duration for canonical schedule comparison.
	 *
	 * @param array<string,mixed> $schedule Canonical schedule.
	 *
	 * @return int Duration in minutes.
	 */
	public function get_duration_minutes( $schedule ) {
		if ( 'full_day' === $schedule['time_application'] ) {
			return count( $schedule['selected_dates'] ) * 1440;
		}
		if ( ! empty( $schedule['exact_intervals'] ) ) {
			$duration = 0;
			foreach ( $schedule['exact_intervals'] as $interval ) {
				$duration += absint( $interval['duration_minutes'] );
			}

			return $duration;
		}
		$start_seconds = $this->time_to_seconds( $schedule['start_time'] );
		$end_seconds   = $this->time_to_seconds( $schedule['end_time'] );
		if ( 'per_date' === $schedule['time_application'] ) {
			$interval_seconds = $end_seconds - $start_seconds;
			if ( 0 >= $interval_seconds ) {
				$interval_seconds += defined( 'DAY_IN_SECONDS' ) ? DAY_IN_SECONDS : 86400;
			}

			return (int) ( $interval_seconds / 60 ) * count( $schedule['selected_dates'] );
		}
		$first = reset( $schedule['selected_dates'] );
		$last  = end( $schedule['selected_dates'] );
		$start = strtotime( $first . ' ' . $schedule['start_time'] . ':00 UTC' );
		$end   = strtotime( $last . ' ' . $schedule['end_time'] . ':00 UTC' );

		return false === $start || false === $end ? 0 : (int) ( ( $end - $start ) / 60 );
	}

	/**
	 * Return inclusive ISO dates for one ordered boundary interval.
	 *
	 * @param string $start_date Start date.
	 * @param string $end_date   End date.
	 *
	 * @return array<int,string> Inclusive dates.
	 */
	private function get_inclusive_dates( $start_date, $end_date ) {
		$dates   = array();
		$current = new DateTimeImmutable( $start_date, new DateTimeZone( 'UTC' ) );
		$end     = new DateTimeImmutable( $end_date, new DateTimeZone( 'UTC' ) );
		while ( $current <= $end && count( $dates ) <= WPBC_Booking_Rescheduling_Proposal_Contract::MAX_PROPOSED_DATES ) {
			$dates[] = $current->format( 'Y-m-d' );
			$current = $current->modify( '+1 day' );
		}

		return $dates;
	}

	/**
	 * Normalize an RFC3339 offset suffix.
	 *
	 * @param string $instant Exact instant.
	 *
	 * @return string `+00:00` or explicit offset.
	 */
	private function normalize_offset( $instant ) {
		return 'Z' === substr( $instant, -1 ) ? '+00:00' : substr( $instant, -6 );
	}

	/**
	 * Verify that one site-local wall minute maps to exactly one instant.
	 *
	 * Repeated fall-back minutes have two matching instants and are rejected.
	 * Nonexistent spring-forward minutes cannot arrive with a matching site
	 * offset, but the same exact-one rule also protects that case.
	 *
	 * @param DateTimeImmutable $local_instant Canonical instant in the site timezone.
	 * @param DateTimeZone      $site_timezone Current WordPress site timezone.
	 *
	 * @return bool True only for one unambiguous wall minute.
	 */
	private function is_unambiguous_site_instant( $local_instant, $site_timezone ) {
		$wall_minute    = $local_instant->format( 'Y-m-d H:i' );
		$wall_reference = DateTimeImmutable::createFromFormat( '!Y-m-d H:i', $wall_minute, new DateTimeZone( 'UTC' ) );
		$timestamp      = $local_instant->getTimestamp();
		$offsets        = array( $local_instant->getOffset() => true );
		$day_seconds    = defined( 'DAY_IN_SECONDS' ) ? DAY_IN_SECONDS : 86400;
		$transitions    = $site_timezone->getTransitions( $timestamp - ( 2 * $day_seconds ), $timestamp + ( 2 * $day_seconds ) );
		$matches        = 0;

		foreach ( is_array( $transitions ) ? $transitions : array() as $transition ) {
			if ( isset( $transition['offset'] ) ) {
				$offsets[ (int) $transition['offset'] ] = true;
			}
		}
		foreach ( array_keys( $offsets ) as $offset_seconds ) {
			$candidate_timestamp = $wall_reference ? $wall_reference->getTimestamp() - (int) $offset_seconds : 0;
			$candidate = ( new DateTimeImmutable( '@' . $candidate_timestamp ) )->setTimezone( $site_timezone );
			if ( $candidate->format( 'Y-m-d H:i' ) === $wall_minute ) {
				$matches++;
			}
		}

		return 1 === $matches;
	}

	/**
	 * Convert exact-minute time to seconds after midnight.
	 *
	 * @param string $time_value `HH:MM` value.
	 *
	 * @return int Seconds after midnight.
	 */
	private function time_to_seconds( $time_value ) {
		$parts = array_map( 'intval', explode( ':', $time_value ) );

		return ( $parts[0] * 3600 ) + ( $parts[1] * 60 );
	}

	/**
	 * Return the unsupported-semantics error with the exact failed invariant.
	 *
	 * @param string $message Authorized invariant-specific message.
	 *
	 * @return WP_Error Safe error.
	 */
	private function get_unsupported_error( $message = '' ) {
		$message = '' !== $message
			? $message
			: __( 'This rescheduling operation is not supported for the saved booking schedule.', 'booking' );

		return new WP_Error(
			'wpbc_booking_rescheduling_operation_unsupported',
			$message,
			array( 'status' => 409 )
		);
	}

	/**
	 * Return the site-timezone/DST error.
	 *
	 * @param string $message Authorized time-specific message.
	 *
	 * @return WP_Error Safe error.
	 */
	private function get_time_error( $message = '' ) {
		$message = '' !== $message
			? $message
			: __( 'The proposed time does not match the current site timezone or daylight-saving rules.', 'booking' );

		return new WP_Error(
			'wpbc_booking_rescheduling_time_invalid',
			$message,
			array( 'status' => 409 )
		);
	}
}
