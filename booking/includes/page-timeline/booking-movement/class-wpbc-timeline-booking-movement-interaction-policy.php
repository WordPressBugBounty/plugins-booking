<?php
/**
 * Timeline booking-movement interaction policy adapter.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Select one approved movement interaction from the canonical domain policy.
 */
final class WPBC_Timeline_Booking_Movement_Interaction_Policy {

	/** @var WPBC_Booking_Rescheduling_Interaction_Policy Canonical direct-interaction policy. */
	private $rescheduling_policy;

	/**
	 * Construct the movement policy adapter.
	 *
	 * @param WPBC_Booking_Rescheduling_Interaction_Policy|null $rescheduling_policy Optional canonical policy.
	 */
	public function __construct( $rescheduling_policy = null ) {
		$this->rescheduling_policy = $rescheduling_policy ? $rescheduling_policy : new WPBC_Booking_Rescheduling_Interaction_Policy();
	}

	/**
	 * Evaluate both direct movement modes from fresh canonical state.
	 *
	 * @param array<string,mixed>            $booking                Fresh authorized booking.
	 * @param array<int,array<string,mixed>> $date_rows              Fresh canonical date rows.
	 * @param array<int,int>                 $effective_resource_ids Fresh authorized allocation IDs.
	 * @param array<string,mixed>|WP_Error   $shape_context          Server-classified saved shape.
	 * @param array<string,mixed>|null       $appointment_snapshot   Immutable Appointment snapshot.
	 * @param int                            $proposal_revision      Positive proposal revision.
	 * @param bool                           $can_change_resource    Whether Resource changes are currently allowed.
	 *
	 * @return array<string,mixed>|WP_Error Availability and signed-token context, or safe error.
	 */
	public function evaluate_all(
		$booking,
		$date_rows,
		$effective_resource_ids,
		$shape_context,
		$appointment_snapshot,
		$proposal_revision,
		$can_change_resource
	) {
		$decision = $this->rescheduling_policy->evaluate_movement(
			$booking,
			$date_rows,
			$effective_resource_ids,
			$shape_context,
			$appointment_snapshot
		);

		return $this->rescheduling_policy->build_movement_context(
			$shape_context,
			$decision,
			$proposal_revision,
			$can_change_resource
		);
	}

	/**
	 * Evaluate one requested direct movement against fresh canonical state.
	 *
	 * @param array<string,mixed>           $booking                Fresh authorized booking.
	 * @param array<int,array<string,mixed>> $date_rows             Fresh canonical date rows.
	 * @param array<int,int>                $effective_resource_ids Fresh authorized allocation IDs.
	 * @param array<string,mixed>|WP_Error  $shape_context          Server-classified saved shape.
	 * @param array<string,mixed>|null      $appointment_snapshot   Immutable Appointment snapshot.
	 * @param string                        $interaction_source     Approved requested interaction source.
	 *
	 * @return array<string,mixed> Executable-free interaction decision.
	 */
	public function evaluate( $booking, $date_rows, $effective_resource_ids, $shape_context, $appointment_snapshot, $interaction_source ) {
		$decision = $this->rescheduling_policy->evaluate_movement(
			$booking,
			$date_rows,
			$effective_resource_ids,
			$shape_context,
			$appointment_snapshot
		);
		$scope_key   = 'cross_resource_drag' === $interaction_source ? 'cross_resource' : 'same_resource';
		$interaction = isset( $decision['interactions'][ $scope_key ] ) && is_array( $decision['interactions'][ $scope_key ] )
			? $decision['interactions'][ $scope_key ]
			: array();
		$expected_operation = 'cross_resource' === $scope_key ? 'change_resource' : 'shift';
		$eligible = ! empty( $interaction['eligible'] )
			&& $interaction_source === ( isset( $interaction['source'] ) ? $interaction['source'] : '' )
			&& $expected_operation === ( isset( $interaction['operation'] ) ? $interaction['operation'] : '' );
		$saved_selection_method = is_array( $shape_context ) && isset( $shape_context['saved']['selection_method'] )
			? sanitize_key( $shape_context['saved']['selection_method'] )
			: '';
		$fallback_reason = $eligible
			? ''
			: sanitize_key( isset( $interaction['fallback_reason'] ) ? $interaction['fallback_reason'] : 'operation_unsupported' );

		return array(
			'eligible'           => $eligible,
			'interaction_source' => sanitize_key( $interaction_source ),
			'operation'          => $expected_operation,
			'movement_scope'     => $scope_key,
			'saved_shape'        => sanitize_key( isset( $decision['saved_shape'] ) ? $decision['saved_shape'] : '' ),
			'selection_method'   => $saved_selection_method,
			'fallback'           => array(
				'required' => ! $eligible,
				'action'   => 'reschedule_dialog',
				'reason'   => $fallback_reason,
			),
		);
	}
}
