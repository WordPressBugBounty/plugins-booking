<?php
/**
 * Booking Rescheduling interaction-policy boundary.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Decide whether an authorized canonical booking may use a direct gesture.
 *
 * The saved-shape classifier describes domain operations in general. This
 * policy applies the narrower safety rules required by direct interactions so
 * dialog support never accidentally grants pointer-gesture eligibility.
 */
final class WPBC_Booking_Rescheduling_Interaction_Policy {

	/** @var WPBC_Booking_Rescheduling_Proposal_Normalizer Exact-interval projector. */
	private $proposal_normalizer;

	/** @var WPBC_Booking_Rescheduling_Repository Canonical booking repository. */
	private $repository;

	/**
	 * Construct the interaction policy with focused dependencies.
	 *
	 * @param WPBC_Booking_Rescheduling_Proposal_Normalizer|null $proposal_normalizer Optional exact-interval projector.
	 * @param WPBC_Booking_Rescheduling_Repository|null          $repository          Optional canonical repository.
	 */
	public function __construct( $proposal_normalizer = null, $repository = null ) {
		$this->proposal_normalizer = $proposal_normalizer ? $proposal_normalizer : new WPBC_Booking_Rescheduling_Proposal_Normalizer();
		$this->repository          = $repository ? $repository : new WPBC_Booking_Rescheduling_Repository();
	}

	/**
	 * Evaluate direct pointer-resize eligibility for one authorized booking.
	 *
	 * Visibility values identify the already rendered Timeline segment. They do
	 * not grant authority: each boundary is enabled only when it resolves to the
	 * matching server-derived immutable instant. Capability, ownership, site,
	 * quantity, capacity, Appointment, and shape context are all server-owned.
	 *
	 * @param array<string,mixed>             $booking                Fresh authorized booking.
	 * @param array<int,array<string,mixed>>  $date_rows              Fresh canonical date rows.
	 * @param array<int,int>                  $effective_resource_ids Fresh authorized Resource IDs.
	 * @param array<string,mixed>|WP_Error    $shape_context          Server-classified saved shape.
	 * @param array<string,mixed>|null        $appointment_snapshot   Immutable Appointment snapshot.
	 * @param array{start:string,end:string}  $visible_interval       Rendered segment interval.
	 *
	 * @return array<string,mixed> Executable-free eligibility decision.
	 */
	public function evaluate_resize( $booking, $date_rows, $effective_resource_ids, $shape_context, $appointment_snapshot, $visible_interval ) {
		if ( ! empty( $appointment_snapshot ) ) {
			return $this->get_ineligible_result( 'appointment_booking' );
		}
		if ( is_wp_error( $shape_context ) || ! is_array( $shape_context ) || empty( $shape_context['shape'] ) || empty( $shape_context['saved'] ) ) {
			return $this->get_ineligible_result( 'ambiguous_schedule' );
		}

		$shape  = sanitize_key( (string) $shape_context['shape'] );
		$reason = $this->get_unsupported_shape_reason( $shape );
		if ( '' !== $reason ) {
			return $this->get_ineligible_result( $reason, $shape );
		}

		$effective_resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $effective_resource_ids ) ) ) );
		$quantity               = $this->repository->get_booking_quantity( $date_rows );
		if ( 1 !== absint( $quantity ) || 1 !== count( $effective_resource_ids ) ) {
			return $this->get_ineligible_result( 'capacity_booking', $shape );
		}

		if ( ! $this->is_resize_allocation_safe( $booking, $date_rows, $effective_resource_ids ) ) {
			return $this->get_ineligible_result( 'capacity_booking', $shape );
		}

		$resize_segments = $this->proposal_normalizer->get_saved_resize_segments( $shape_context['saved'] );
		if ( is_wp_error( $resize_segments ) || empty( $resize_segments ) ) {
			return $this->get_ineligible_result( 'ambiguous_schedule', $shape );
		}

		$visible_start      = $this->parse_exact_instant( isset( $visible_interval['start'] ) ? $visible_interval['start'] : '' );
		$visible_end        = $this->parse_exact_instant( isset( $visible_interval['end'] ) ? $visible_interval['end'] : '' );
		if ( ! $visible_start || ! $visible_end || $visible_end <= $visible_start ) {
			return $this->get_ineligible_result( 'ambiguous_schedule', $shape );
		}
		$immutable_interval = $this->find_visible_resize_segment( $resize_segments, $visible_start, $visible_end );
		if ( empty( $immutable_interval ) ) {
			return $this->get_ineligible_result( 'ambiguous_schedule', $shape );
		}
		$immutable_start = $this->parse_exact_instant( $immutable_interval['start'] );
		$immutable_end   = $this->parse_exact_instant( $immutable_interval['end'] );

		$start_eligible = $immutable_start->getTimestamp() === $visible_start->getTimestamp();
		$end_eligible   = $immutable_end->getTimestamp() === $visible_end->getTimestamp();
		$eligible       = $start_eligible || $end_eligible;
		$is_group_resize = in_array( $shape, array( 'recurrent_timed_intervals', 'discontinuous_timed_intervals' ), true );
		$affected_intervals = $is_group_resize ? $resize_segments : array( $immutable_interval );

		return array(
			'eligible'                => $eligible,
			'saved_shape'             => $shape,
			'resize_scope'            => $is_group_resize ? 'shared_time_all_occurrences' : ( 'independent_full_days' === $shape ? 'contiguous_full_day_segment' : 'single_interval' ),
			'affected_interval_count' => count( $affected_intervals ),
			'affected_intervals'      => array_values( $affected_intervals ),
			'immutable_interval' => array(
				'start' => $immutable_start->format( 'Y-m-d\TH:i:sP' ),
				'end'   => $immutable_end->format( 'Y-m-d\TH:i:sP' ),
			),
			'boundaries'        => array(
				'start' => $this->get_boundary_result( $start_eligible, 'resize_start' ),
				'end'   => $this->get_boundary_result( $end_eligible, 'resize_end' ),
			),
			'fallback'          => array(
				'required' => ! $eligible,
				'action'   => 'reschedule_dialog',
				'reason'   => $eligible ? '' : 'boundaries_clipped',
			),
		);
	}

	/**
	 * Evaluate direct Timeline movement eligibility for one authorized booking.
	 *
	 * This decision exposes only the approved source/operation pairs. It does not
	 * select or authorize a target Resource, allocate capacity, or decide
	 * availability. Those decisions remain in authoritative Review and Apply.
	 * The exact allocation identity check prevents a partial series represented
	 * by stale or incomplete date rows from becoming directly movable.
	 *
	 * @param array<string,mixed>            $booking                Fresh authorized booking.
	 * @param array<int,array<string,mixed>> $date_rows              Fresh canonical date rows.
	 * @param array<int,int>                 $effective_resource_ids Fresh authorized allocation Resource IDs.
	 * @param array<string,mixed>|WP_Error   $shape_context          Server-classified saved shape.
	 * @param array<string,mixed>|null       $appointment_snapshot   Immutable Appointment snapshot.
	 *
	 * @return array<string,mixed> Executable-free movement eligibility decision.
	 */
	public function evaluate_movement( $booking, $date_rows, $effective_resource_ids, $shape_context, $appointment_snapshot ) {
		if (
			is_wp_error( $shape_context ) ||
			! is_array( $shape_context ) ||
			empty( $shape_context['shape'] ) ||
			empty( $shape_context['saved'] )
		) {
			return $this->get_movement_ineligible_result( 'ambiguous_schedule' );
		}

		$shape  = sanitize_key( (string) $shape_context['shape'] );
		$reason = 'appointment' === $shape ? '' : $this->get_unsupported_shape_reason( $shape );
		if ( '' !== $reason ) {
			return $this->get_movement_ineligible_result( $reason, $shape );
		}
		$saved_selection_method = isset( $shape_context['saved']['selection_method'] )
			? sanitize_key( $shape_context['saved']['selection_method'] )
			: '';
		if ( ! in_array( $saved_selection_method, array( 'policy', 'individual' ), true ) ) {
			return $this->get_movement_ineligible_result( 'ambiguous_schedule', $shape );
		}

		if ( ! $this->is_movement_allocation_complete( $booking, $date_rows, $effective_resource_ids ) ) {
			return $this->get_movement_ineligible_result( 'ambiguous_allocation', $shape );
		}

		$allowed_operations = isset( $shape_context['allowed_operations'] )
			? array_map( 'sanitize_key', (array) $shape_context['allowed_operations'] )
			: array();
		$same_resource_eligible  = in_array( 'shift', $allowed_operations, true );
		$cross_resource_eligible = empty( $appointment_snapshot ) && in_array( 'change_resource', $allowed_operations, true );
		$eligible                = $same_resource_eligible || $cross_resource_eligible;

		return array(
			'eligible'          => $eligible,
			'saved_shape'       => $shape,
			'interaction_scope' => 'timeline_booking_movement',
			'interactions'      => array(
				'same_resource'  => $this->get_movement_interaction_result(
					$same_resource_eligible,
					'drag',
					'shift',
					'operation_unsupported'
				),
				'cross_resource' => $this->get_movement_interaction_result(
					$cross_resource_eligible,
					'cross_resource_drag',
					'change_resource',
					! empty( $appointment_snapshot ) ? 'appointment_resource_change' : 'operation_unsupported'
				),
			),
			'fallback'          => array(
				'required' => ! $eligible,
				'action'   => 'reschedule_dialog',
				'reason'   => $eligible ? '' : 'operation_unsupported',
			),
		);
	}

	/**
	 * Build the canonical direct-movement availability and token binding.
	 *
	 * One selected Timeline segment needs one source token before its eventual
	 * drop target is known. The token therefore binds the complete server-derived
	 * same-Resource/cross-Resource availability set rather than trusting a
	 * browser-selected interaction. Review reconstructs this exact set and also
	 * checks that the submitted interaction remains individually eligible.
	 *
	 * @param array<string,mixed>|WP_Error $shape_context       Server-classified saved shape.
	 * @param array<string,mixed>          $movement_decision   Result from evaluate_movement().
	 * @param int                          $proposal_revision   Positive proposal revision.
	 * @param bool                         $can_change_resource Whether the current account may change Resource.
	 *
	 * @return array<string,mixed>|WP_Error Availability DTO and opaque-token context, or safe error.
	 */
	public function build_movement_context( $shape_context, $movement_decision, $proposal_revision, $can_change_resource ) {
		if (
			is_wp_error( $shape_context )
			|| ! is_array( $shape_context )
			|| empty( $shape_context['shape'] )
			|| empty( $shape_context['saved'] )
			|| ! is_array( $movement_decision )
			|| $proposal_revision < 1
			|| $proposal_revision > WPBC_Booking_Rescheduling_Proposal_Contract::MAX_PROPOSAL_REVISION
		) {
			return new WP_Error(
				'wpbc_booking_rescheduling_movement_context_invalid',
				__( 'The booking movement context is no longer available. Reload the Timeline and try again.', 'booking' ),
				array( 'status' => 409 )
			);
		}

		$same_resource = isset( $movement_decision['interactions']['same_resource'] ) && is_array( $movement_decision['interactions']['same_resource'] )
			? $movement_decision['interactions']['same_resource']
			: array();
		$cross_resource = isset( $movement_decision['interactions']['cross_resource'] ) && is_array( $movement_decision['interactions']['cross_resource'] )
			? $movement_decision['interactions']['cross_resource']
			: array();
		$same_resource_available = ! empty( $same_resource['eligible'] )
			&& 'drag' === ( isset( $same_resource['source'] ) ? $same_resource['source'] : '' )
			&& 'shift' === ( isset( $same_resource['operation'] ) ? $same_resource['operation'] : '' );
		$cross_resource_available = $can_change_resource
			&& ! empty( $cross_resource['eligible'] )
			&& 'cross_resource_drag' === ( isset( $cross_resource['source'] ) ? $cross_resource['source'] : '' )
			&& 'change_resource' === ( isset( $cross_resource['operation'] ) ? $cross_resource['operation'] : '' );
		$same_resource_fallback_reason = $same_resource_available
			? ''
			: sanitize_key( isset( $same_resource['fallback_reason'] ) ? $same_resource['fallback_reason'] : 'operation_unsupported' );
		$cross_resource_policy_available = ! empty( $cross_resource['eligible'] )
			&& 'cross_resource_drag' === ( isset( $cross_resource['source'] ) ? $cross_resource['source'] : '' )
			&& 'change_resource' === ( isset( $cross_resource['operation'] ) ? $cross_resource['operation'] : '' );
		if ( $cross_resource_available ) {
			$cross_resource_fallback_reason = '';
		} elseif ( ! $cross_resource_policy_available ) {
			$cross_resource_fallback_reason = sanitize_key( isset( $cross_resource['fallback_reason'] ) ? $cross_resource['fallback_reason'] : 'operation_unsupported' );
		} else {
			$cross_resource_fallback_reason = 'resource_change_unavailable';
		}
		$saved_shape = sanitize_key( $shape_context['shape'] );
		$selection_method = isset( $shape_context['saved']['selection_method'] )
			? sanitize_key( $shape_context['saved']['selection_method'] )
			: '';
		if ( ! in_array( $selection_method, array( 'policy', 'individual' ), true ) ) {
			return new WP_Error(
				'wpbc_booking_rescheduling_movement_context_invalid',
				__( 'The booking movement context is no longer available. Reload the Timeline and try again.', 'booking' ),
				array( 'status' => 409 )
			);
		}

		$fallback_reason = '';
		if ( ! $same_resource_available && ! $cross_resource_available ) {
			$fallback_reason = isset( $movement_decision['fallback']['reason'] )
				? sanitize_key( $movement_decision['fallback']['reason'] )
				: 'operation_unsupported';
			if ( '' === $fallback_reason ) {
				$fallback_reason = 'operation_unsupported';
			}
		}

		return array(
			'same_resource_available'        => $same_resource_available,
			'cross_resource_available'       => $cross_resource_available,
			'same_resource_fallback_reason'  => $same_resource_fallback_reason,
			'cross_resource_fallback_reason' => $cross_resource_fallback_reason,
			'saved_shape'                    => $saved_shape,
			'selection_method'               => $selection_method,
			'fallback_reason'                => $fallback_reason,
			'source_context'                 => array(
				'interaction_source'       => 'movement',
				'saved_shape'              => $saved_shape,
				'movement_scope'           => 'direct_movement',
				'selection_method'         => $selection_method,
				'proposal_revision'        => absint( $proposal_revision ),
				'same_resource_available'  => $same_resource_available,
				'cross_resource_available' => $cross_resource_available,
			),
		);
	}

	/**
	 * Confirm that canonical rows describe the complete effective allocation.
	 *
	 * @param array<string,mixed>            $booking                Fresh authorized booking.
	 * @param array<int,array<string,mixed>> $date_rows              Fresh canonical date rows.
	 * @param array<int,int>                 $effective_resource_ids Fresh effective Resource IDs.
	 *
	 * @return bool True when every row belongs to exactly the effective allocation set.
	 */
	private function is_movement_allocation_complete( $booking, $date_rows, $effective_resource_ids ) {
		$primary_resource_id    = isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0;
		$effective_resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $effective_resource_ids ) ) ) );
		sort( $effective_resource_ids, SORT_NUMERIC );
		if ( ! $primary_resource_id || empty( $date_rows ) || empty( $effective_resource_ids ) ) {
			return false;
		}

		$row_resource_ids = array();
		foreach ( $date_rows as $date_row ) {
			$row_resource_id = is_array( $date_row ) && isset( $date_row['resource_id'] )
				? absint( $date_row['resource_id'] )
				: 0;
			if ( ! $row_resource_id || ! in_array( $row_resource_id, $effective_resource_ids, true ) ) {
				return false;
			}
			$row_resource_ids[] = $row_resource_id;
		}

		$row_resource_ids = array_values( array_unique( $row_resource_ids ) );
		sort( $row_resource_ids, SORT_NUMERIC );

		return $effective_resource_ids === $row_resource_ids;
	}

	/**
	 * Build one direct-movement source/operation decision.
	 *
	 * @param bool   $eligible       Whether the interaction is currently eligible.
	 * @param string $source         Approved proposal interaction source.
	 * @param string $operation      Approved proposal operation.
	 * @param string $fallback_reason Stable reason when ineligible.
	 *
	 * @return array<string,mixed> Movement interaction decision.
	 */
	private function get_movement_interaction_result( $eligible, $source, $operation, $fallback_reason ) {
		return array(
			'eligible'        => (bool) $eligible,
			'source'          => sanitize_key( $source ),
			'operation'       => sanitize_key( $operation ),
			'fallback_reason' => $eligible ? '' : sanitize_key( $fallback_reason ),
		);
	}

	/**
	 * Build a complete full-dialog fallback for an unsafe movement source.
	 *
	 * @param string $reason Stable fallback reason.
	 * @param string $shape  Optional classified shape.
	 *
	 * @return array<string,mixed> Ineligible movement decision.
	 */
	private function get_movement_ineligible_result( $reason, $shape = '' ) {
		return array(
			'eligible'          => false,
			'saved_shape'       => sanitize_key( $shape ),
			'interaction_scope' => 'timeline_booking_movement',
			'interactions'      => array(
				'same_resource'  => $this->get_movement_interaction_result( false, 'drag', 'shift', $reason ),
				'cross_resource' => $this->get_movement_interaction_result(
					false,
					'cross_resource_drag',
					'change_resource',
					$reason
				),
			),
			'fallback'          => array(
				'required' => true,
				'action'   => 'reschedule_dialog',
				'reason'   => sanitize_key( $reason ),
			),
		);
	}

	/**
	 * Decide whether the canonical allocation is unambiguous for direct resize.
	 *
	 * A quantity-one booking may use one exact capacity allocation when every
	 * saved row uses the same Resource. A parent allocation is safe only when it
	 * is also the booking's primary Resource. A child allocation is safe when the
	 * primary Resource is that child or its canonical parent. Unrelated, mixed,
	 * and multiple allocations continue to require the dialog.
	 *
	 * @param array<string,mixed>            $booking                Fresh authorized booking.
	 * @param array<int,array<string,mixed>> $date_rows              Fresh canonical date rows.
	 * @param array<int,int>                 $effective_resource_ids One normalized effective Resource ID.
	 *
	 * @return bool True when the allocation is exact and safe for a direct gesture.
	 */
	private function is_resize_allocation_safe( $booking, $date_rows, $effective_resource_ids ) {
		$primary_resource_id   = isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0;
		$effective_resource_id = isset( $effective_resource_ids[0] ) ? absint( $effective_resource_ids[0] ) : 0;
		if ( ! $primary_resource_id || ! $effective_resource_id || empty( $date_rows ) ) {
			return false;
		}

		foreach ( $date_rows as $date_row ) {
			$row_resource_id = is_array( $date_row ) && isset( $date_row['resource_id'] )
				? absint( $date_row['resource_id'] )
				: 0;
			if ( $effective_resource_id !== $row_resource_id ) {
				return false;
			}
		}

		$effective_hierarchy = $this->repository->get_resource_hierarchy_context( $effective_resource_id );
		if ( ! empty( $effective_hierarchy['is_parent'] ) ) {
			return $primary_resource_id === $effective_resource_id;
		}

		if ( ! empty( $effective_hierarchy['is_child'] ) ) {
			$parent_resource_id = isset( $effective_hierarchy['parent_id'] ) ? absint( $effective_hierarchy['parent_id'] ) : 0;

			return $primary_resource_id === $effective_resource_id || $primary_resource_id === $parent_resource_id;
		}

		return $primary_resource_id === $effective_resource_id;
	}

	/**
	 * Return the stable fallback reason for a shape unsafe for direct resize.
	 *
	 * @param string $shape Server-classified saved shape.
	 *
	 * @return string Stable fallback reason, or an empty string when eligible for further checks.
	 */
	private function get_unsupported_shape_reason( $shape ) {
		if (
			in_array(
				$shape,
				array(
					'single_timed_interval',
					'continuous_boundary_interval',
					'single_full_day',
					'continuous_full_day_range',
					'independent_full_days',
					'recurrent_timed_intervals',
					'discontinuous_timed_intervals',
				),
				true
			)
		) {
			return '';
		}

		return 'ambiguous_schedule';
	}

	/**
	 * Resolve one rendered segment against canonical server-derived boundaries.
	 *
	 * A clipped Timeline segment may expose one or neither canonical edge. The
	 * visible range must still be contained by exactly one canonical segment;
	 * only exact visible edges become interactive, so a browser card or occurrence
	 * index never becomes mutation authority.
	 *
	 * @param array<int,array{start:string,end:string}> $segments      Canonical resize segments.
	 * @param DateTimeImmutable                         $visible_start Visible segment start.
	 * @param DateTimeImmutable                         $visible_end   Visible segment end.
	 *
	 * @return array{start:string,end:string}|array{} Unique canonical segment or an empty record.
	 */
	private function find_visible_resize_segment( $segments, $visible_start, $visible_end ) {
		$matched_segment = array();
		foreach ( $segments as $segment ) {
			$segment_start = $this->parse_exact_instant( isset( $segment['start'] ) ? $segment['start'] : '' );
			$segment_end   = $this->parse_exact_instant( isset( $segment['end'] ) ? $segment['end'] : '' );
			if (
				! $segment_start ||
				! $segment_end ||
				$visible_start < $segment_start ||
				$visible_end > $segment_end
			) {
				continue;
			}
			if ( ! empty( $matched_segment ) ) {
				return array();
			}
			$matched_segment = array(
				'start' => $segment_start->format( 'Y-m-d\TH:i:sP' ),
				'end'   => $segment_end->format( 'Y-m-d\TH:i:sP' ),
			);
		}

		return $matched_segment;
	}

	/**
	 * Build one boundary decision with its approved proposal operation.
	 *
	 * @param bool   $eligible Whether the canonical boundary is visible.
	 * @param string $operation Approved rescheduling operation.
	 *
	 * @return array<string,mixed> Boundary eligibility DTO.
	 */
	private function get_boundary_result( $eligible, $operation ) {
		return array(
			'eligible'        => (bool) $eligible,
			'operation'       => sanitize_key( $operation ),
			'fallback_reason' => $eligible ? '' : 'boundary_clipped',
		);
	}

	/**
	 * Build a complete full-dialog fallback decision.
	 *
	 * @param string $reason Stable fallback reason.
	 * @param string $shape  Optional classified shape.
	 *
	 * @return array<string,mixed> Ineligible interaction decision.
	 */
	private function get_ineligible_result( $reason, $shape = '' ) {
		return array(
			'eligible'                => false,
			'saved_shape'             => sanitize_key( $shape ),
			'resize_scope'            => '',
			'affected_interval_count' => 0,
			'affected_intervals'      => array(),
			'immutable_interval' => null,
			'boundaries'        => array(
				'start' => $this->get_boundary_result( false, 'resize_start' ),
				'end'   => $this->get_boundary_result( false, 'resize_end' ),
			),
			'fallback'          => array(
				'required' => true,
				'action'   => 'reschedule_dialog',
				'reason'   => sanitize_key( $reason ),
			),
		);
	}

	/**
	 * Parse one strict exact-minute offset instant.
	 *
	 * @param mixed $instant Candidate instant.
	 *
	 * @return DateTimeImmutable|null Parsed instant or null.
	 */
	private function parse_exact_instant( $instant ) {
		if ( ! is_string( $instant ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:Z|[+-]\d{2}:\d{2})$/', $instant ) ) {
			return null;
		}
		$parse_value  = 'Z' === substr( $instant, -1 ) ? substr( $instant, 0, -1 ) . '+00:00' : $instant;
		$date_time    = DateTimeImmutable::createFromFormat( '!Y-m-d\TH:i:sP', $parse_value );
		$parse_errors = DateTimeImmutable::getLastErrors();
		if ( ! $date_time || ( is_array( $parse_errors ) && ( $parse_errors['warning_count'] || $parse_errors['error_count'] ) ) ) {
			return null;
		}

		return $date_time;
	}
}
