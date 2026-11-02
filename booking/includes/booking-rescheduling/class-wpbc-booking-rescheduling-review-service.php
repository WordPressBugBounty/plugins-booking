<?php
/**
 * Booking Rescheduling signed non-mutating review service.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build and revalidate authoritative rescheduling plans.
 */
final class WPBC_Booking_Rescheduling_Review_Service {

	/** Signed plan schema version. */
	const PLAN_VERSION = 1;

	/** Signed plan lifetime in seconds. */
	const PLAN_LIFETIME = 600;

	/** Maximum warnings returned to the browser. */
	const MAX_WARNINGS = 8;

	/** Maximum replay-relevant one-boundary proposals retained during one Review lifetime. */
	const MAX_REVIEW_CHAIN = 32;

	/** @var WPBC_Booking_Rescheduling_Review_Request_Validator Review validator. */
	private $request_validator;

	/** @var WPBC_Booking_Rescheduling_Authorization Authorization boundary. */
	private $authorization;

	/** @var WPBC_Booking_Rescheduling_Repository Domain repository. */
	private $repository;

	/** @var WPBC_Booking_Rescheduling_Source_Context Source context service. */
	private $source_context;

	/** @var WPBC_Booking_Rescheduling_Shape_Classifier Shape classifier. */
	private $shape_classifier;

	/** @var WPBC_Booking_Rescheduling_Proposal_Normalizer Proposal normalizer. */
	private $proposal_normalizer;

	/** @var WPBC_Booking_Rescheduling_Availability_Resolver Availability resolver. */
	private $availability_resolver;

	/** @var WPBC_Booking_Rescheduling_Interaction_Policy Direct-interaction policy. */
	private $interaction_policy;

	/**
	 * Construct the review service with replaceable focused dependencies.
	 *
	 * @param WPBC_Booking_Rescheduling_Review_Request_Validator|null $request_validator     Optional validator.
	 * @param WPBC_Booking_Rescheduling_Authorization|null            $authorization        Optional authorization.
	 * @param WPBC_Booking_Rescheduling_Repository|null               $repository           Optional repository.
	 * @param WPBC_Booking_Rescheduling_Source_Context|null           $source_context        Optional source-context service.
	 * @param WPBC_Booking_Rescheduling_Shape_Classifier|null         $shape_classifier      Optional classifier.
	 * @param WPBC_Booking_Rescheduling_Proposal_Normalizer|null      $proposal_normalizer   Optional normalizer.
	 * @param WPBC_Booking_Rescheduling_Availability_Resolver|null    $availability_resolver Optional resolver.
	 * @param WPBC_Booking_Rescheduling_Interaction_Policy|null       $interaction_policy    Optional direct-interaction policy.
	 */
	public function __construct(
		$request_validator = null,
		$authorization = null,
		$repository = null,
		$source_context = null,
		$shape_classifier = null,
		$proposal_normalizer = null,
		$availability_resolver = null,
		$interaction_policy = null
	) {
		$this->request_validator     = $request_validator ? $request_validator : new WPBC_Booking_Rescheduling_Review_Request_Validator();
		$this->authorization         = $authorization ? $authorization : new WPBC_Booking_Rescheduling_Authorization();
		$this->repository            = $repository ? $repository : new WPBC_Booking_Rescheduling_Repository();
		$this->source_context        = $source_context ? $source_context : new WPBC_Booking_Rescheduling_Source_Context();
		$this->shape_classifier      = $shape_classifier ? $shape_classifier : new WPBC_Booking_Rescheduling_Shape_Classifier();
		$this->proposal_normalizer   = $proposal_normalizer ? $proposal_normalizer : new WPBC_Booking_Rescheduling_Proposal_Normalizer();
		$this->availability_resolver = $availability_resolver ? $availability_resolver : new WPBC_Booking_Rescheduling_Availability_Resolver( $this->repository );
		$this->interaction_policy    = $interaction_policy ? $interaction_policy : new WPBC_Booking_Rescheduling_Interaction_Policy( $this->proposal_normalizer, $this->repository );
	}

	/**
	 * Build a signed review without mutating booking or activity storage.
	 *
	 * @param mixed $request_values Untrusted request values.
	 *
	 * @return array<string,mixed>|WP_Error Review DTO and signed plan, or safe error.
	 */
	public function review( $request_values ) {
		$request = $this->request_validator->normalize( $request_values );
		if ( is_wp_error( $request ) ) {
			return $request;
		}

		$proposal_chain = array( $request['proposal'] );
		if ( ! empty( $request['base_plan'] ) ) {
			$base_context = $this->revalidate_plan_for_apply(
				$request['base_plan'],
				$request['base_token'],
				$request['booking_id'],
				$request['source']
			);
			if ( is_wp_error( $base_context ) ) {
				return $base_context;
			}

			$proposal_chain = $this->get_plan_proposal_chain( $request['base_plan'] );
			if ( is_wp_error( $proposal_chain ) ) {
				return $proposal_chain;
			}
			$continuation_check = $this->validate_continuation_request( $request['proposal'], $proposal_chain );
			if ( is_wp_error( $continuation_check ) ) {
				return $continuation_check;
			}
			$proposal_chain = $this->compact_proposal_chain( $proposal_chain );
			if ( count( $proposal_chain ) >= self::MAX_REVIEW_CHAIN ) {
				return $this->get_invalid_plan_error();
			}
			$context = $this->build_continuation_context( $base_context, $request['proposal'] );
			$proposal_chain[] = $request['proposal'];
		} else {
			$context = $this->build_authoritative_context( $request['booking_id'], $request['source'], $request['proposal'] );
		}
		if ( is_wp_error( $context ) ) {
			return $context;
		}

		$issued_at  = time();
		$expires_at = $issued_at + self::PLAN_LIFETIME;
		$plan       = array(
			'version'                => self::PLAN_VERSION,
			'site_id'                => $this->get_site_id(),
			'user_id'                => $this->get_effective_user_id(),
			'actor_user_id'          => $this->get_actor_user_id(),
			'booking_id'             => absint( $request['booking_id'] ),
			'source'                 => $request['source'],
			'issued_at'              => $issued_at,
			'expires_at'             => $expires_at,
			'source_fingerprint'     => $context['source_fingerprint'],
			'context_fingerprint'    => $context['resolution']['context_fingerprint'],
			'allocation_fingerprint' => $this->build_allocation_fingerprint( $context['resolution']['where_to_save'] ),
			'proposal'               => $request['proposal'],
			'proposal_chain'         => array_values( $proposal_chain ),
			'schedule'               => $context['schedule'],
		);

		return array(
			'review'     => $this->build_review_dto( $context ),
			'plan'       => $plan,
			'token'      => $this->sign_plan( $plan ),
			'expires_at' => $expires_at,
		);
	}

	/**
	 * Verify the signed envelope and repeat every authoritative check for Apply.
	 *
	 * The caller must hold the canonical availability guard. A changed booking,
	 * policy, stored form, Appointment snapshot, or derived allocation invalidates
	 * the review instead of silently changing the approved plan.
	 *
	 * @param mixed  $plan                Untrusted signed plan.
	 * @param mixed  $token               Untrusted signature.
	 * @param int    $expected_booking_id Endpoint booking ID.
	 * @param string $expected_source     Endpoint host source.
	 *
	 * @return array<string,mixed>|WP_Error Fresh apply context or safe error.
	 */
	public function revalidate_plan_for_apply( $plan, $token, $expected_booking_id, $expected_source ) {
		$plan_check = $this->verify_plan( $plan, $token, $expected_booking_id, $expected_source );
		if ( is_wp_error( $plan_check ) ) {
			return $plan_check;
		}

		$proposal_chain = $this->get_plan_proposal_chain( $plan );
		if ( is_wp_error( $proposal_chain ) ) {
			return $proposal_chain;
		}

		$context = $this->build_authoritative_context( $expected_booking_id, $expected_source, reset( $proposal_chain ) );
		if ( is_wp_error( $context ) ) {
			return $context;
		}
		foreach ( array_slice( $proposal_chain, 1 ) as $proposal ) {
			$context = $this->build_continuation_context( $context, $proposal );
			if ( is_wp_error( $context ) ) {
				return $context;
			}
		}

		if (
			! hash_equals( (string) $plan['source_fingerprint'], $context['source_fingerprint'] ) ||
			! hash_equals( (string) $plan['context_fingerprint'], $context['resolution']['context_fingerprint'] ) ||
			! hash_equals( (string) $plan['allocation_fingerprint'], $this->build_allocation_fingerprint( $context['resolution']['where_to_save'] ) ) ||
			wp_json_encode( $plan['schedule'] ) !== wp_json_encode( $context['schedule'] )
		) {
			return $this->get_stale_plan_error();
		}

		return $context;
	}

	/**
	 * Verify plan signature, shape, expiry, user, site, booking, and source.
	 *
	 * @param mixed  $plan                Candidate plan.
	 * @param mixed  $token               Candidate signature.
	 * @param int    $expected_booking_id Expected booking ID.
	 * @param string $expected_source     Expected source.
	 *
	 * @return true|WP_Error True when valid.
	 */
	public function verify_plan( $plan, $token, $expected_booking_id, $expected_source ) {
		$token = is_scalar( $token ) ? strtolower( trim( (string) $token ) ) : '';
		if ( ! is_array( $plan ) || ! preg_match( '/^[a-f0-9]{64}$/', $token ) || ! hash_equals( $this->sign_plan( $plan ), $token ) ) {
			return $this->get_invalid_plan_error();
		}

		$required = array( 'version', 'site_id', 'user_id', 'actor_user_id', 'booking_id', 'source', 'issued_at', 'expires_at', 'source_fingerprint', 'context_fingerprint', 'allocation_fingerprint', 'proposal', 'schedule' );
		foreach ( $required as $required_key ) {
			if ( ! array_key_exists( $required_key, $plan ) ) {
				return $this->get_invalid_plan_error();
			}
		}

		$issued_at  = absint( $plan['issued_at'] );
		$expires_at = absint( $plan['expires_at'] );
		if (
			self::PLAN_VERSION !== absint( $plan['version'] ) ||
			$this->get_site_id() !== absint( $plan['site_id'] ) ||
			$this->get_effective_user_id() !== absint( $plan['user_id'] ) ||
			$this->get_actor_user_id() !== absint( $plan['actor_user_id'] ) ||
			absint( $expected_booking_id ) !== absint( $plan['booking_id'] ) ||
			sanitize_key( $expected_source ) !== sanitize_key( $plan['source'] ) ||
			! $issued_at || $expires_at <= $issued_at || ( $expires_at - $issued_at ) > self::PLAN_LIFETIME || time() > $expires_at ||
			! preg_match( '/^[a-f0-9]{64}$/', (string) $plan['source_fingerprint'] ) ||
			! preg_match( '/^[a-f0-9]{64}$/', (string) $plan['context_fingerprint'] ) ||
			! preg_match( '/^[a-f0-9]{64}$/', (string) $plan['allocation_fingerprint'] )
		) {
			return $this->get_invalid_plan_error();
		}
		$proposal_chain = $this->get_plan_proposal_chain( $plan );
		if ( is_wp_error( $proposal_chain ) ) {
			return $proposal_chain;
		}

		return true;
	}

	/**
	 * Return the ordered one-boundary proposal chain from a signed plan.
	 *
	 * Plans issued before cumulative resize support contain only `proposal` and
	 * remain valid as a one-entry chain. New plans must retain the latest proposal
	 * as the final chain entry so Apply cannot replay a different schedule.
	 *
	 * @param array<string,mixed> $plan Signed Review plan.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Ordered proposals or a safe error.
	 */
	private function get_plan_proposal_chain( $plan ) {
		$proposal_chain = isset( $plan['proposal_chain'] ) ? $plan['proposal_chain'] : array( $plan['proposal'] );
		if (
			! is_array( $proposal_chain ) ||
			empty( $proposal_chain ) ||
			count( $proposal_chain ) > self::MAX_REVIEW_CHAIN
		) {
			return $this->get_invalid_plan_error();
		}
		foreach ( $proposal_chain as $proposal ) {
			if ( ! is_array( $proposal ) ) {
				return $this->get_invalid_plan_error();
			}
		}
		$latest_proposal = end( $proposal_chain );
		if ( wp_json_encode( $latest_proposal ) !== wp_json_encode( $plan['proposal'] ) ) {
			return $this->get_invalid_plan_error();
		}

		return array_values( $proposal_chain );
	}

	/**
	 * Validate continuity between a signed base Review and one new resize step.
	 *
	 * The base signature and canonical replay prove the cumulative schedule. The
	 * next proposal may change either boundary, but it must retain the same source,
	 * Resource, selection policy, and source-context token while advancing the
	 * monotonic proposal revision.
	 *
	 * @param array<string,mixed>            $proposal       New normalized resize proposal.
	 * @param array<int,array<string,mixed>> $proposal_chain Verified base proposal chain.
	 *
	 * @return true|WP_Error True when the continuation belongs to the base Review.
	 */
	private function validate_continuation_request( $proposal, $proposal_chain ) {
		$previous_proposal = end( $proposal_chain );
		if (
			'resize' !== $proposal['interaction_source'] ||
			'resize' !== $previous_proposal['interaction_source'] ||
			! in_array( $proposal['operation'], array( 'resize_start', 'resize_end' ), true ) ||
			! in_array( $previous_proposal['operation'], array( 'resize_start', 'resize_end' ), true ) ||
			absint( $proposal['booking_id'] ) !== absint( $previous_proposal['booking_id'] ) ||
			absint( $proposal['target_resource_id'] ) !== absint( $previous_proposal['target_resource_id'] ) ||
			(string) $proposal['selection_method'] !== (string) $previous_proposal['selection_method'] ||
			! hash_equals( (string) $previous_proposal['source_context_token'], (string) $proposal['source_context_token'] ) ||
			absint( $proposal['proposal_revision'] ) <= absint( $previous_proposal['proposal_revision'] )
		) {
			return $this->get_invalid_plan_error();
		}

		return true;
	}

	/**
	 * Compact replay-equivalent consecutive resize proposals.
	 *
	 * Pointer release may snap back to the already reviewed Timeline boundary. Older
	 * clients submitted that harmless release as another signed proposal, which could
	 * exhaust the bounded replay chain even though no schedule changed. Consecutive
	 * changes to the same boundary are also safely represented by the latest proposal:
	 * canonical replay has already proved that the protected opposite boundary stayed
	 * unchanged. For an opposite-boundary no-op, the earlier proposal must instead be
	 * retained because it is the operation that can be replayed from the preceding
	 * canonical context.
	 *
	 * This compaction runs only after the signed base has passed complete canonical
	 * replay and after the new revision has been compared with the actual final signed
	 * proposal. It therefore cannot weaken signature, monotonic revision, or Apply
	 * validation.
	 *
	 * @param array<int,array<string,mixed>> $proposal_chain Verified ordered proposal chain.
	 *
	 * @return array<int,array<string,mixed>> Replay-equivalent proposal chain.
	 */
	private function compact_proposal_chain( $proposal_chain ) {
		$compacted_chain = array();

		foreach ( $proposal_chain as $proposal ) {
			$previous_proposal = end( $compacted_chain );
			if (
				$previous_proposal &&
				$this->proposals_share_resize_identity( $previous_proposal, $proposal ) &&
				(string) $previous_proposal['operation'] === (string) $proposal['operation']
			) {
				$compacted_chain[ count( $compacted_chain ) - 1 ] = $proposal;
				continue;
			}
			if (
				$previous_proposal &&
				$this->proposals_describe_same_schedule( $previous_proposal, $proposal )
			) {
				continue;
			}

			$compacted_chain[] = $proposal;
		}

		return array_values( $compacted_chain );
	}

	/**
	 * Determine whether two consecutive proposals carry the same schedule inputs.
	 *
	 * Operation and revision are deliberately excluded. A user can activate the
	 * opposite handle and release on the same snapped boundary, producing a different
	 * operation and revision without changing the exact proposed interval.
	 *
	 * @param array<string,mixed> $first_proposal  Earlier verified proposal.
	 * @param array<string,mixed> $second_proposal Later verified proposal.
	 *
	 * @return bool True when both proposals describe the same authorized schedule.
	 */
	private function proposals_describe_same_schedule( $first_proposal, $second_proposal ) {
		return $this->proposals_share_resize_identity( $first_proposal, $second_proposal ) &&
			isset( $first_proposal['proposed_intervals'], $second_proposal['proposed_intervals'] ) &&
			wp_json_encode( $first_proposal['proposed_intervals'] ) === wp_json_encode( $second_proposal['proposed_intervals'] );
	}

	/**
	 * Determine whether two verified proposals belong to one cumulative resize.
	 *
	 * @param array<string,mixed> $first_proposal  Earlier verified proposal.
	 * @param array<string,mixed> $second_proposal Later verified proposal.
	 *
	 * @return bool True when both proposals share the cumulative resize identity.
	 */
	private function proposals_share_resize_identity( $first_proposal, $second_proposal ) {
		$identity_keys = array(
			'booking_id',
			'interaction_source',
			'target_resource_id',
			'selection_method',
			'source_context_token',
		);

		foreach ( $identity_keys as $identity_key ) {
			if (
				! array_key_exists( $identity_key, $first_proposal ) ||
				! array_key_exists( $identity_key, $second_proposal ) ||
				(string) $first_proposal[ $identity_key ] !== (string) $second_proposal[ $identity_key ]
			) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Rebuild the complete authoritative context used by review and Apply.
	 *
	 * @param int                 $booking_id Booking ID.
	 * @param string              $source     Inspector host source.
	 * @param array<string,mixed> $proposal   Normalized transport proposal.
	 *
	 * @return array<string,mixed>|WP_Error Authoritative context or safe error.
	 */
	private function build_authoritative_context( $booking_id, $source, $proposal ) {
		$authorization_context = $this->authorization->authorize_booking( $booking_id, $source );
		if ( is_wp_error( $authorization_context ) ) {
			return $authorization_context;
		}
		$booking   = $authorization_context['booking'];
		$date_rows = $this->repository->get_booking_dates( $booking );
		if ( is_wp_error( $date_rows ) ) {
			return $date_rows;
		}
		$appointment_snapshot = $this->repository->get_appointment_snapshot( $booking_id );
		$shape_context        = $this->shape_classifier->classify( $date_rows, $authorization_context['effective_resource_ids'], $appointment_snapshot );
		if ( is_wp_error( $shape_context ) ) {
			return $shape_context;
		}
		$interaction_context = array();
		if ( 'resize' === $proposal['interaction_source'] ) {
			$interaction_context = $this->proposal_normalizer->get_resize_anchor_context( $proposal, $shape_context );
			if ( is_wp_error( $interaction_context ) ) {
				return $interaction_context;
			}
		} elseif ( in_array( $proposal['interaction_source'], array( 'drag', 'cross_resource_drag' ), true ) ) {
			$movement_decision = $this->interaction_policy->evaluate_movement(
				$booking,
				$date_rows,
				$authorization_context['effective_resource_ids'],
				$shape_context,
				$appointment_snapshot
			);
			$movement_context = $this->interaction_policy->build_movement_context(
				$shape_context,
				$movement_decision,
				absint( $proposal['proposal_revision'] ),
				$this->authorization->can_change_resource()
			);
			if ( is_wp_error( $movement_context ) ) {
				return $movement_context;
			}
			$requested_availability_key = 'drag' === $proposal['interaction_source']
				? 'same_resource_available'
				: 'cross_resource_available';
			if ( empty( $movement_context[ $requested_availability_key ] ) ) {
				return new WP_Error(
					'wpbc_booking_rescheduling_interaction_unsupported',
					__( 'This booking cannot use the requested Timeline movement. Use the full Reschedule dialog.', 'booking' ),
					array( 'status' => 409 )
				);
			}
			$interaction_context = $movement_context['source_context'];
		}

		$source_check = $this->source_context->verify(
			$proposal['source_context_token'],
			$booking,
			$date_rows,
			$source,
			$authorization_context['effective_resource_ids'],
			$interaction_context
		);
		if ( is_wp_error( $source_check ) ) {
			return $source_check;
		}
		$operation_check = $this->authorization->authorize_operation( $proposal['operation'] );
		if ( is_wp_error( $operation_check ) ) {
			return $operation_check;
		}

		$target_check = $this->authorization->authorize_resources( array( $proposal['target_resource_id'] ) );
		if ( is_wp_error( $target_check ) ) {
			return $target_check;
		}

		$schedule = $this->proposal_normalizer->normalize( $proposal, $shape_context, absint( $booking['booking_type'] ) );
		if ( is_wp_error( $schedule ) ) {
			return $schedule;
		}

		$resolution = $this->availability_resolver->resolve( $booking, $date_rows, $schedule, $appointment_snapshot );
		if ( is_wp_error( $resolution ) ) {
			return $resolution;
		}
		$allocation_identity_check = $this->validate_same_resource_movement_allocation( $booking, $date_rows, $schedule, $resolution );
		if ( is_wp_error( $allocation_identity_check ) ) {
			return $allocation_identity_check;
		}
		$allocated_check = $this->authorization->authorize_resources( $resolution['allocated_resource_ids'] );
		if ( is_wp_error( $allocated_check ) ) {
			return $allocated_check;
		}
		$resource_labels = $this->repository->get_resource_labels(
			array_merge(
				array(
					absint( $booking['booking_type'] ),
					absint( $schedule['target_resource_id'] ),
					absint( $resolution['where_to_save']['main__resource_id'] ),
				),
				(array) $resolution['allocated_resource_ids']
			)
		);
		if ( is_wp_error( $resource_labels ) ) {
			return $resource_labels;
		}

		return array(
			'authorization'            => $authorization_context,
			'booking'                  => $booking,
			'date_rows'                => $date_rows,
			'shape'                    => $shape_context,
			'schedule'                 => $schedule,
			'review_baseline_schedule' => $schedule,
			'resolution'               => $resolution,
			'resource_labels'          => $resource_labels,
			'appointment_snapshot'     => $appointment_snapshot,
			'source_fingerprint'       => WPBC_Booking_Date_Editor_Source_Fingerprint::build( $booking, $date_rows ),
			'source'                   => $source,
		);
	}

	/**
	 * Validate one additional boundary change against a revalidated Review base.
	 *
	 * The base context was reconstructed from current canonical booking state and
	 * a verified signed proposal chain. A private working shape makes the proposal
	 * normalizer enforce that this step changes exactly one boundary relative to
	 * the cumulative draft. The returned shape remains the immutable canonical
	 * baseline so Review and Apply never treat an earlier unsaved proposal as the
	 * saved booking. Availability, allocation, ownership, and Resource
	 * authorization are then repeated for the new result.
	 *
	 * @param array<string,mixed> $base_context Revalidated cumulative Review context.
	 * @param array<string,mixed> $proposal     New normalized one-boundary proposal.
	 *
	 * @return array<string,mixed>|WP_Error Fresh cumulative context or safe error.
	 */
	private function build_continuation_context( $base_context, $proposal ) {
		$booking                       = $base_context['booking'];
		$date_rows                     = $base_context['date_rows'];
		$appointment_snapshot          = $base_context['appointment_snapshot'];
		$working_shape_context          = $base_context['shape'];
		$working_shape_context['saved'] = $base_context['schedule'];

		$operation_check = $this->authorization->authorize_operation( $proposal['operation'] );
		if ( is_wp_error( $operation_check ) ) {
			return $operation_check;
		}
		$target_check = $this->authorization->authorize_resources( array( $proposal['target_resource_id'] ) );
		if ( is_wp_error( $target_check ) ) {
			return $target_check;
		}

		$schedule = $this->proposal_normalizer->normalize( $proposal, $working_shape_context, absint( $booking['booking_type'] ) );
		if ( is_wp_error( $schedule ) ) {
			return $schedule;
		}
		$resolution = $this->availability_resolver->resolve( $booking, $date_rows, $schedule, $appointment_snapshot );
		if ( is_wp_error( $resolution ) ) {
			return $resolution;
		}
		$allocation_identity_check = $this->validate_same_resource_movement_allocation( $booking, $date_rows, $schedule, $resolution );
		if ( is_wp_error( $allocation_identity_check ) ) {
			return $allocation_identity_check;
		}
		$allocated_check = $this->authorization->authorize_resources( $resolution['allocated_resource_ids'] );
		if ( is_wp_error( $allocated_check ) ) {
			return $allocated_check;
		}
		$resource_labels = $this->repository->get_resource_labels(
			array_merge(
				array(
					absint( $booking['booking_type'] ),
					absint( $schedule['target_resource_id'] ),
					absint( $resolution['where_to_save']['main__resource_id'] ),
				),
				(array) $resolution['allocated_resource_ids']
			)
		);
		if ( is_wp_error( $resource_labels ) ) {
			return $resource_labels;
		}

		return array(
			'authorization'            => $base_context['authorization'],
			'booking'                  => $booking,
			'date_rows'                => $date_rows,
			'shape'                    => $base_context['shape'],
			'schedule'                 => $schedule,
			'review_baseline_schedule' => isset( $base_context['review_baseline_schedule'] )
				? $base_context['review_baseline_schedule']
				: $base_context['schedule'],
			'resolution'               => $resolution,
			'resource_labels'          => $resource_labels,
			'appointment_snapshot'     => $appointment_snapshot,
			'source_fingerprint'       => $base_context['source_fingerprint'],
			'source'                   => $base_context['source'],
		);
	}

	/**
	 * Require a same-Resource Timeline shift to retain exact allocation identity.
	 *
	 * Availability and capacity remain server-owned and may legitimately resolve a
	 * different child Resource on another date. That behavior belongs to the full
	 * Reschedule workflow, not the direct same-row gesture. The comparison ignores
	 * shifted calendar keys but preserves the ordered per-date Resource groups, so
	 * only the schedule moves while primary and effective allocation identities stay
	 * unchanged.
	 *
	 * @param array<string,mixed>            $booking    Fresh canonical booking.
	 * @param array<int,array<string,mixed>> $date_rows  Fresh canonical booking-date rows.
	 * @param array<string,mixed>            $schedule   Canonical proposed schedule.
	 * @param array<string,mixed>            $resolution Server-derived availability resolution.
	 *
	 * @return true|WP_Error True when identity is preserved, otherwise a safe error.
	 */
	private function validate_same_resource_movement_allocation( $booking, $date_rows, $schedule, $resolution ) {
		if (
			'drag' !== ( isset( $schedule['interaction_source'] ) ? $schedule['interaction_source'] : '' )
			|| 'shift' !== ( isset( $schedule['operation'] ) ? $schedule['operation'] : '' )
		) {
			return true;
		}

		$current_primary_resource_id = absint( isset( $booking['booking_type'] ) ? $booking['booking_type'] : 0 );
		$proposed_target_resource_id = absint( isset( $schedule['target_resource_id'] ) ? $schedule['target_resource_id'] : 0 );
		$where_to_save               = isset( $resolution['where_to_save'] ) && is_array( $resolution['where_to_save'] )
			? $resolution['where_to_save']
			: array();
		$proposed_primary_resource_id = absint( isset( $where_to_save['main__resource_id'] ) ? $where_to_save['main__resource_id'] : 0 );
		$saved_allocation_sequence    = $this->get_saved_allocation_sequence( $date_rows );
		$proposed_allocation_sequence = $this->get_proposed_allocation_sequence( $where_to_save );

		if (
			! $current_primary_resource_id
			|| $current_primary_resource_id !== $proposed_target_resource_id
			|| $current_primary_resource_id !== $proposed_primary_resource_id
			|| empty( $saved_allocation_sequence )
			|| $saved_allocation_sequence !== $proposed_allocation_sequence
		) {
			return new WP_Error(
				'wpbc_booking_rescheduling_same_resource_allocation_changed',
				__( 'The proposed dates require a different Booking Resource allocation. Use the full Reschedule dialog.', 'booking' ),
				array( 'status' => 409 )
			);
		}

		return true;
	}

	/**
	 * Build chronological per-date allocation identities from canonical rows.
	 *
	 * Each distinct Resource contributes one identity per calendar date. Timed
	 * bookings store separate start and end boundary rows on the same date, but
	 * those rows represent one allocation rather than additional quantity.
	 * Deduplicating by Resource therefore matches the canonical quantity service
	 * while preserving child-Resource identity as dates shift uniformly.
	 *
	 * @param array<int,array<string,mixed>> $date_rows Fresh canonical booking-date rows.
	 *
	 * @return array<int,array<int,int>> Ordered Resource-ID groups, or an empty array for malformed rows.
	 */
	private function get_saved_allocation_sequence( $date_rows ) {
		$resources_by_date = array();
		foreach ( $date_rows as $date_row ) {
			$booking_date = is_array( $date_row ) && isset( $date_row['booking_date'] )
				? substr( (string) $date_row['booking_date'], 0, 10 )
				: '';
			$resource_id  = is_array( $date_row ) && isset( $date_row['resource_id'] ) ? absint( $date_row['resource_id'] ) : 0;
			if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $booking_date ) || ! $resource_id ) {
				return array();
			}
			$resources_by_date[ $booking_date ][ $resource_id ] = true;
		}
		ksort( $resources_by_date, SORT_STRING );

		$allocation_sequence = array();
		foreach ( $resources_by_date as $resource_ids ) {
			$normalized_resource_ids = array_map( 'absint', array_keys( $resource_ids ) );
			sort( $normalized_resource_ids, SORT_NUMERIC );
			$allocation_sequence[] = $normalized_resource_ids;
		}

		return $allocation_sequence;
	}

	/**
	 * Build chronological per-date allocation identities from Review resolution.
	 *
	 * @param array<string,mixed> $where_to_save Server-derived allocation result.
	 *
	 * @return array<int,array<int,int>> Ordered Resource-ID groups, or an empty array for malformed allocation.
	 */
	private function get_proposed_allocation_sequence( $where_to_save ) {
		$resources_in_dates = isset( $where_to_save['resources_in_dates'] ) && is_array( $where_to_save['resources_in_dates'] )
			? $where_to_save['resources_in_dates']
			: array();
		if ( empty( $resources_in_dates ) ) {
			return array();
		}
		ksort( $resources_in_dates, SORT_STRING );

		$allocation_sequence = array();
		foreach ( $resources_in_dates as $booking_date => $resource_ids ) {
			if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $booking_date ) ) {
				return array();
			}
			$normalized_resource_ids = array_values( array_filter( array_map( 'absint', (array) $resource_ids ) ) );
			sort( $normalized_resource_ids, SORT_NUMERIC );
			if ( empty( $normalized_resource_ids ) ) {
				return array();
			}
			$allocation_sequence[] = $normalized_resource_ids;
		}

		return $allocation_sequence;
	}

	/**
	 * Build the complete data-only review presentation contract.
	 *
	 * @param array<string,mixed> $context Authoritative context.
	 *
	 * @return array<string,mixed> Browser-safe review DTO.
	 */
	private function build_review_dto( $context ) {
		$booking                = $context['booking'];
		$saved                  = $context['shape']['saved'];
		$schedule               = $context['schedule'];
		$where_to_save          = $context['resolution']['where_to_save'];
		$current_resource       = absint( $booking['booking_type'] );
		$target_resource        = absint( $schedule['target_resource_id'] );
		$primary_resource       = absint( $where_to_save['main__resource_id'] );
		$resource_labels        = isset( $context['resource_labels'] ) && is_array( $context['resource_labels'] ) ? $context['resource_labels'] : array();
		$existing_dates         = array_values( (array) $saved['selected_dates'] );
		$proposed_dates         = array_values( $schedule['selected_dates'] );
		$existing_duration      = $this->proposal_normalizer->get_duration_minutes( $saved );
		$proposed_duration      = $this->proposal_normalizer->get_duration_minutes( $schedule );
		$resize_impact          = $this->build_resize_impact( $context, $existing_dates, $proposed_dates );
		$allocation_counts      = array();
		$resolved_resource_ids   = isset( $context['resolution']['allocated_resource_ids'] )
			? (array) $context['resolution']['allocated_resource_ids']
			: array();
		$allocated_resource_ids = array_values(
			array_unique(
				array_filter(
					array_map( 'absint', $resolved_resource_ids )
				)
			)
		);
		sort( $allocated_resource_ids, SORT_NUMERIC );
		$allocated_resources = array();
		foreach ( $allocated_resource_ids as $allocated_resource_id ) {
			$allocated_resources[] = array(
				'id'    => $allocated_resource_id,
				'label' => isset( $resource_labels[ $allocated_resource_id ] ) ? $resource_labels[ $allocated_resource_id ] : '',
			);
		}
		$resources_in_dates = isset( $where_to_save['resources_in_dates'] ) && is_array( $where_to_save['resources_in_dates'] )
			? $where_to_save['resources_in_dates']
			: array();
		ksort( $resources_in_dates, SORT_STRING );
		foreach ( $resources_in_dates as $date => $resource_ids ) {
			$date_resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $resource_ids ) ) ) );
			sort( $date_resource_ids, SORT_NUMERIC );
			$allocation_counts[] = array(
				'date'         => sanitize_text_field( $date ),
				'count'        => count( $date_resource_ids ),
				'resource_ids' => $date_resource_ids,
			);
		}

		$warnings = array(
			__( 'No email notification will be sent when these changes are applied.', 'booking' ),
			__( 'The saved booking cost and payment state will remain unchanged.', 'booking' ),
		);
		if ( $target_resource !== $current_resource ) {
			$warnings[] = __( 'The primary Booking Resource and exact capacity allocations will change together.', 'booking' );
		}

		return array(
			'booking_id'         => absint( $booking['booking_id'] ),
			'interaction_source' => $schedule['interaction_source'],
			'operation'          => $schedule['operation'],
			'saved_shape'        => $context['shape']['shape'],
			'resources'          => array(
				'existing'               => array( 'id' => $current_resource, 'label' => isset( $resource_labels[ $current_resource ] ) ? $resource_labels[ $current_resource ] : '' ),
				'proposed_target'        => array( 'id' => $target_resource, 'label' => isset( $resource_labels[ $target_resource ] ) ? $resource_labels[ $target_resource ] : '' ),
				'proposed_primary'       => array( 'id' => $primary_resource, 'label' => isset( $resource_labels[ $primary_resource ] ) ? $resource_labels[ $primary_resource ] : '' ),
				'proposed_allocated'     => $allocated_resources,
				'proposed_allocated_ids' => $allocated_resource_ids,
				'resource_changed'       => $target_resource !== $current_resource,
				'allocation_changed'     => $primary_resource !== $current_resource,
			),
			'dates'              => array(
				'existing' => $existing_dates,
				'proposed' => $proposed_dates,
				'added'    => array_values( array_diff( $proposed_dates, $existing_dates ) ),
				'removed'  => array_values( array_diff( $existing_dates, $proposed_dates ) ),
			),
			'times'              => array(
				'existing_start' => isset( $saved['start_time'] ) ? (string) $saved['start_time'] : '',
				'proposed_start' => (string) $schedule['start_time'],
				'start_changed'  => ( isset( $saved['start_time'] ) ? (string) $saved['start_time'] : '' ) !== (string) $schedule['start_time'],
				'existing_end'   => isset( $saved['end_time'] ) ? (string) $saved['end_time'] : '',
				'proposed_end'   => (string) $schedule['end_time'],
				'end_changed'    => ( isset( $saved['end_time'] ) ? (string) $saved['end_time'] : '' ) !== (string) $schedule['end_time'],
			),
			'duration'           => array(
				'existing_minutes'   => $existing_duration,
				'proposed_minutes'   => $proposed_duration,
				'difference_minutes' => $proposed_duration - $existing_duration,
				'existing_label'     => $this->format_duration_minutes( $existing_duration ),
				'proposed_label'     => $this->format_duration_minutes( $proposed_duration ),
				'difference_label'   => $this->format_duration_difference( $proposed_duration - $existing_duration ),
			),
			'resize_impact'      => $resize_impact,
			'quantity'           => array(
				'existing'           => absint( $context['resolution']['quantity'] ),
				'proposed'           => absint( $context['resolution']['quantity'] ),
				'allocation_by_date' => $allocation_counts,
			),
			'availability'       => array(
				'available'       => true,
				'available_label' => __( 'Available', 'booking' ),
				'capacity'        => 'sufficient',
				'capacity_label'  => __( 'Sufficient capacity', 'booking' ),
			),
			'implications'       => $this->build_implications( ! empty( $context['appointment_snapshot'] ), $schedule['selection_method'] ),
			'notifications'      => array( 'send_email' => false, 'behavior' => 'none' ),
			'saved_cost'         => array( 'changed' => false, 'behavior' => 'preserved' ),
			'warnings'           => array_slice( $warnings, 0, self::MAX_WARNINGS ),
			'unsupported'        => array(),
		);
	}

	/**
	 * Build explicit resize impact for the canonical Review presentation.
	 *
	 * @param array<string,mixed> $context        Authoritative review context.
	 * @param array<int,string>   $existing_dates Canonical saved dates.
	 * @param array<int,string>   $proposed_dates Canonical proposed dates.
	 *
	 * @return array<string,mixed> Group impact DTO, or an empty record when not applicable.
	 */
	private function build_resize_impact( $context, $existing_dates, $proposed_dates ) {
		$schedule          = $context['schedule'];
		$baseline_schedule = isset( $context['review_baseline_schedule'] ) && is_array( $context['review_baseline_schedule'] )
			? $context['review_baseline_schedule']
			: $schedule;
		if (
			'resize' !== $schedule['interaction_source'] ||
			! in_array( $schedule['operation'], array( 'resize_start', 'resize_end' ), true )
		) {
			return array();
		}

		$saved_intervals = $this->proposal_normalizer->get_saved_exact_intervals( $context['shape']['saved'] );
		$proposed_intervals = isset( $schedule['exact_intervals'] ) ? $schedule['exact_intervals'] : array();
		$existing_per_occurrence = 0;
		$proposed_per_occurrence = 0;
		if ( ! is_wp_error( $saved_intervals ) && ! empty( $saved_intervals ) ) {
			$saved_start = new DateTimeImmutable( $saved_intervals[0]['start'] );
			$saved_end   = new DateTimeImmutable( $saved_intervals[0]['end'] );
			$existing_per_occurrence = (int) ( ( $saved_end->getTimestamp() - $saved_start->getTimestamp() ) / 60 );
		}
		if ( ! empty( $proposed_intervals ) ) {
			$proposed_start = new DateTimeImmutable( $proposed_intervals[0]['start'] );
			$proposed_end   = new DateTimeImmutable( $proposed_intervals[0]['end'] );
			$proposed_per_occurrence = (int) ( ( $proposed_end->getTimestamp() - $proposed_start->getTimestamp() ) / 60 );
		}
		if ( 'full_day' === $schedule['time_application'] ) {
			$existing_per_occurrence = isset( $baseline_schedule['saved_segment_date_count'] ) ? absint( $baseline_schedule['saved_segment_date_count'] ) * 1440 : 0;
			$proposed_per_occurrence = isset( $schedule['proposed_segment_date_count'] ) ? absint( $schedule['proposed_segment_date_count'] ) * 1440 : 0;

			return $this->build_full_day_resize_impact( $schedule, $baseline_schedule, $existing_dates, $proposed_dates, $existing_per_occurrence, $proposed_per_occurrence );
		}

		$occurrence_count  = isset( $schedule['affected_interval_count'] ) ? absint( $schedule['affected_interval_count'] ) : 1;
		$existing_time     = 'resize_start' === $schedule['operation'] ? (string) $context['shape']['saved']['start_time'] : (string) $context['shape']['saved']['end_time'];
		$proposed_time     = 'resize_start' === $schedule['operation'] ? (string) $schedule['start_time'] : (string) $schedule['end_time'];
		$comparison_intervals = $this->get_timed_resize_comparison_intervals( $saved_intervals, $proposed_intervals, $schedule );
		$period_comparison    = empty( $comparison_intervals )
			? array()
			: $this->build_timed_resize_period_comparison( $comparison_intervals['saved'], $comparison_intervals['proposed'] );
		$title             = 'resize_start' === $schedule['operation']
			? sprintf(
				/* translators: %s: number of affected booking occurrences. */
				_n( 'Change start time for %s occurrence', 'Change start time for %s occurrences', $occurrence_count, 'booking' ),
				number_format_i18n( $occurrence_count )
			)
			: sprintf(
				/* translators: %s: number of affected booking occurrences. */
				_n( 'Change end time for %s occurrence', 'Change end time for %s occurrences', $occurrence_count, 'booking' ),
				number_format_i18n( $occurrence_count )
			);

		return array(
			'scope'                         => isset( $schedule['resize_scope'] ) ? sanitize_key( $schedule['resize_scope'] ) : 'single_interval',
			'occurrence_count'              => $occurrence_count,
			'changed_boundary'              => 'resize_start' === $schedule['operation'] ? 'start' : 'end',
			'dates_unchanged'               => $existing_dates === $proposed_dates,
			'existing_minutes_per_occurrence' => $existing_per_occurrence,
			'proposed_minutes_per_occurrence' => $proposed_per_occurrence,
			'existing_duration_label'       => $this->format_duration_minutes( $existing_per_occurrence ),
			'proposed_duration_label'       => $this->format_duration_minutes( $proposed_per_occurrence ),
			'title'                         => $title,
			'period_comparison'             => $period_comparison,
			'boundary_description'          => sprintf(
				/* translators: 1: saved boundary time, 2: proposed boundary time. */
				__( '%1$s → %2$s', 'booking' ),
				$existing_time,
				$proposed_time
			),
			'dates_description'             => empty( $period_comparison ) && $existing_dates === $proposed_dates ? __( 'Dates remain unchanged', 'booking' ) : '',
			'duration_description'          => sprintf(
				/* translators: 1: saved duration, 2: proposed duration. */
				__( 'Duration per occurrence: %1$s → %2$s', 'booking' ),
				$this->format_duration_minutes( $existing_per_occurrence ),
				$this->format_duration_minutes( $proposed_per_occurrence )
			),
		);
	}

	/**
	 * Resolve the canonical occurrence represented in a timed resize Review.
	 *
	 * Shared-time resizing rebuilds every occurrence on the server, while the
	 * browser submits only one exact anchor interval. The normalizer records the
	 * matched anchor index so grouped Reviews can display that clicked occurrence
	 * with the same complete Previous-to-Proposed comparison as a single interval.
	 * Older internal callers without an index retain the first canonical pair.
	 * The canonical index is intentionally used across cumulative two-boundary
	 * Reviews, where the final proposal may differ from the saved booking at both
	 * endpoints even though every individual signed step changed only one.
	 *
	 * @param array<int,array<string,string>>|WP_Error $saved_intervals    Canonical saved exact intervals.
	 * @param array<int,array<string,string>>          $proposed_intervals Canonical proposed exact intervals.
	 * @param array<string,mixed>                      $schedule           Authoritative proposed schedule.
	 *
	 * @return array{saved:array<string,string>,proposed:array<string,string>}|array{} Matched occurrence pair or an empty record.
	 */
	private function get_timed_resize_comparison_intervals( $saved_intervals, $proposed_intervals, $schedule ) {
		if (
			is_wp_error( $saved_intervals ) ||
			! is_array( $saved_intervals ) ||
			! is_array( $proposed_intervals ) ||
			empty( $saved_intervals ) ||
			count( $saved_intervals ) !== count( $proposed_intervals )
		) {
			return array();
		}

		$comparison_index = isset( $schedule['review_interval_index'] )
			? absint( $schedule['review_interval_index'] )
			: 0;
		if ( ! isset( $saved_intervals[ $comparison_index ], $proposed_intervals[ $comparison_index ] ) ) {
			return array();
		}

		return array(
			'saved'    => $saved_intervals[ $comparison_index ],
			'proposed' => $proposed_intervals[ $comparison_index ],
		);
	}

	/**
	 * Build a structured full-period comparison for one timed occurrence.
	 *
	 * Canonical instants are converted to the current WordPress timezone before
	 * component comparison and formatting. This prevents a date-only boundary
	 * change from being reduced to two identical clock labels in Timeline Review.
	 * The browser receives presentation parts and never parses localized dates.
	 *
	 * @param array<string,string> $saved_interval    Canonical saved exact interval.
	 * @param array<string,string> $proposed_interval Canonical proposed exact interval.
	 *
	 * @return array<string,mixed> Previous/proposed labels and component parts, or an empty record.
	 */
	private function build_timed_resize_period_comparison( $saved_interval, $proposed_interval ) {
		if (
			! isset( $saved_interval['start'], $saved_interval['end'], $proposed_interval['start'], $proposed_interval['end'] )
		) {
			return array();
		}
		$interval_values = array(
			$saved_interval['start'],
			$saved_interval['end'],
			$proposed_interval['start'],
			$proposed_interval['end'],
		);
		foreach ( $interval_values as $interval_value ) {
			if ( ! is_string( $interval_value ) || '' === $interval_value ) {
				return array();
			}
		}

		$site_timezone = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		try {
			$saved_start    = ( new DateTimeImmutable( $saved_interval['start'] ) )->setTimezone( $site_timezone );
			$saved_end      = ( new DateTimeImmutable( $saved_interval['end'] ) )->setTimezone( $site_timezone );
			$proposed_start = ( new DateTimeImmutable( $proposed_interval['start'] ) )->setTimezone( $site_timezone );
			$proposed_end   = ( new DateTimeImmutable( $proposed_interval['end'] ) )->setTimezone( $site_timezone );
		} catch ( Exception $exception ) {
			return array();
		}

		return array(
			'previous_label' => __( 'Previous', 'booking' ),
			'proposed_label' => __( 'Proposed', 'booking' ),
			'changed_label'  => __( 'Changed', 'booking' ),
			'before_parts'   => $this->build_timed_resize_period_parts( $saved_start, $saved_end, $proposed_start, $proposed_end, $site_timezone ),
			'after_parts'    => $this->build_timed_resize_period_parts( $proposed_start, $proposed_end, $saved_start, $saved_end, $site_timezone ),
		);
	}

	/**
	 * Build localized date/time parts for one side of a timed period comparison.
	 *
	 * Placeholder tokens preserve translated punctuation and argument order while
	 * the domain template can emphasize only the exact changed date or time.
	 *
	 * @param DateTimeImmutable $display_start    Start instant to display.
	 * @param DateTimeImmutable $display_end      End instant to display.
	 * @param DateTimeImmutable $comparison_start Start instant on the opposite side.
	 * @param DateTimeImmutable $comparison_end   End instant on the opposite side.
	 * @param DateTimeZone      $site_timezone    Current WordPress site timezone.
	 *
	 * @return array<int,array<string,mixed>> Ordered localized text parts with change state.
	 */
	private function build_timed_resize_period_parts( $display_start, $display_end, $comparison_start, $comparison_end, $site_timezone ) {
		$part_tokens = array(
			'{{WPBC_START_DATE}}' => array(
				'role'    => 'start_date',
				'text'    => $this->format_review_instant_component( $display_start, 'date', $site_timezone ),
				'changed' => $display_start->format( 'Y-m-d' ) !== $comparison_start->format( 'Y-m-d' ),
			),
			'{{WPBC_START_TIME}}' => array(
				'role'    => 'start_time',
				'text'    => $this->format_review_instant_component( $display_start, 'time', $site_timezone ),
				'changed' => $display_start->format( 'H:i' ) !== $comparison_start->format( 'H:i' ),
			),
			'{{WPBC_END_DATE}}'   => array(
				'role'    => 'end_date',
				'text'    => $this->format_review_instant_component( $display_end, 'date', $site_timezone ),
				'changed' => $display_end->format( 'Y-m-d' ) !== $comparison_end->format( 'Y-m-d' ),
			),
			'{{WPBC_END_TIME}}'   => array(
				'role'    => 'end_time',
				'text'    => $this->format_review_instant_component( $display_end, 'time', $site_timezone ),
				'changed' => $display_end->format( 'H:i' ) !== $comparison_end->format( 'H:i' ),
			),
		);
		$tokenized_period = sprintf(
			/* translators: 1: start date, 2: start time, 3: end date, 4: end time. */
			__( '%1$s, %2$s - %3$s, %4$s', 'booking' ),
			'{{WPBC_START_DATE}}',
			'{{WPBC_START_TIME}}',
			'{{WPBC_END_DATE}}',
			'{{WPBC_END_TIME}}'
		);
		$tokenized_parts = preg_split(
			'/(\{\{WPBC_(?:START_DATE|START_TIME|END_DATE|END_TIME)\}\})/',
			$tokenized_period,
			-1,
			PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY
		);
		$period_parts = array();

		foreach ( is_array( $tokenized_parts ) ? $tokenized_parts : array() as $tokenized_part ) {
			$period_parts[] = isset( $part_tokens[ $tokenized_part ] )
				? $part_tokens[ $tokenized_part ]
				: array(
					'role'    => 'separator',
					'text'    => $tokenized_part,
					'changed' => false,
				);
		}

		return $period_parts;
	}

	/**
	 * Format one exact instant component using WordPress site display settings.
	 *
	 * @param DateTimeImmutable $instant       Canonical instant in the site timezone.
	 * @param string            $component     Component name: `date` or `time`.
	 * @param DateTimeZone      $site_timezone Current WordPress site timezone.
	 *
	 * @return string Localized component label.
	 */
	private function format_review_instant_component( $instant, $component, $site_timezone ) {
		$format = 'time' === $component
			? ( function_exists( 'get_option' ) ? (string) get_option( 'time_format', 'g:i a' ) : 'g:i a' )
			: ( function_exists( 'get_option' ) ? (string) get_option( 'date_format', 'M j, Y' ) : 'M j, Y' );

		return function_exists( 'wp_date' )
			? wp_date( $format, $instant->getTimestamp(), $site_timezone )
			: $instant->format( $format );
	}

	/**
	 * Build inclusive calendar-date review text for a full-day segment resize.
	 *
	 * The internal exclusive end boundary must never be presented as a booked
	 * date. The server-normalized segment date arrays are therefore used for all
	 * customer-facing labels.
	 *
	 * @param array<string,mixed> $schedule                   Canonical proposed schedule.
	 * @param array<string,mixed> $baseline_schedule          First canonical Review schedule.
	 * @param array<int,string>   $existing_dates             Complete saved booking dates.
	 * @param array<int,string>   $proposed_dates             Complete proposed booking dates.
	 * @param int                 $existing_duration_minutes  Saved segment duration in minutes.
	 * @param int                 $proposed_duration_minutes  Proposed segment duration in minutes.
	 *
	 * @return array<string,mixed> Full-day resize impact DTO.
	 */
	private function build_full_day_resize_impact( $schedule, $baseline_schedule, $existing_dates, $proposed_dates, $existing_duration_minutes, $proposed_duration_minutes ) {
		$saved_segment_dates = isset( $baseline_schedule['saved_segment_dates'] ) && is_array( $baseline_schedule['saved_segment_dates'] )
			? array_values( $baseline_schedule['saved_segment_dates'] )
			: array();
		$proposed_segment_dates = isset( $schedule['proposed_segment_dates'] ) && is_array( $schedule['proposed_segment_dates'] )
			? array_values( $schedule['proposed_segment_dates'] )
			: array();
		$occurrence_count       = 1;
		$period_comparison      = $this->build_full_day_resize_period_comparison( $saved_segment_dates, $proposed_segment_dates );
		$title                  = 'resize_start' === $schedule['operation']
			? sprintf(
				/* translators: %s: number of affected booking occurrences. */
				_n( 'Change start date for %s occurrence', 'Change start date for %s occurrences', $occurrence_count, 'booking' ),
				number_format_i18n( $occurrence_count )
			)
			: sprintf(
				/* translators: %s: number of affected booking occurrences. */
				_n( 'Change end date for %s occurrence', 'Change end date for %s occurrences', $occurrence_count, 'booking' ),
				number_format_i18n( $occurrence_count )
			);

		return array(
			'scope'                           => isset( $schedule['resize_scope'] ) ? sanitize_key( $schedule['resize_scope'] ) : 'single_interval',
			'occurrence_count'                => $occurrence_count,
			'changed_boundary'                => 'resize_start' === $schedule['operation'] ? 'start' : 'end',
			'dates_unchanged'                 => $existing_dates === $proposed_dates,
			'existing_minutes_per_occurrence' => $existing_duration_minutes,
			'proposed_minutes_per_occurrence' => $proposed_duration_minutes,
			'existing_duration_label'         => $this->format_duration_minutes( $existing_duration_minutes ),
			'proposed_duration_label'         => $this->format_duration_minutes( $proposed_duration_minutes ),
			'title'                           => $title,
			'period_comparison'               => $period_comparison,
			'boundary_description'            => $this->format_full_day_segment_summary( __( 'Previous', 'booking' ), $saved_segment_dates ),
			'dates_description'               => $this->format_full_day_segment_summary( __( 'Proposed', 'booking' ), $proposed_segment_dates ),
			'duration_description'            => sprintf(
				/* translators: 1: saved duration, 2: proposed duration. */
				__( 'Duration per occurrence: %1$s → %2$s', 'booking' ),
				$this->format_duration_minutes( $existing_duration_minutes ),
				$this->format_duration_minutes( $proposed_duration_minutes )
			),
		);
	}

	/**
	 * Build a structured full-day period comparison for compact Timeline Review.
	 *
	 * Full-day Review uses inclusive selected dates rather than the internal
	 * exclusive midnight boundary. Returning the same presentation contract as
	 * timed Review keeps the shared template on its accessible highlighted path.
	 *
	 * @param array<int,string> $saved_segment_dates    Canonical saved inclusive dates.
	 * @param array<int,string> $proposed_segment_dates Canonical proposed inclusive dates.
	 *
	 * @return array<string,mixed> Previous/proposed labels and component parts, or an empty record.
	 */
	private function build_full_day_resize_period_comparison( $saved_segment_dates, $proposed_segment_dates ) {
		if ( empty( $saved_segment_dates ) || empty( $proposed_segment_dates ) ) {
			return array();
		}

		return array(
			'previous_label' => __( 'Previous', 'booking' ),
			'proposed_label' => __( 'Proposed', 'booking' ),
			'changed_label'  => __( 'Changed', 'booking' ),
			'before_parts'   => $this->build_full_day_resize_period_parts( $saved_segment_dates, $proposed_segment_dates ),
			'after_parts'    => $this->build_full_day_resize_period_parts( $proposed_segment_dates, $saved_segment_dates ),
		);
	}

	/**
	 * Build localized inclusive date parts for one full-day comparison side.
	 *
	 * A one-date segment is rendered once and marked changed when either logical
	 * boundary differs, avoiding a misleading duplicated one-day range.
	 *
	 * @param array<int,string> $display_dates    Inclusive dates displayed on this side.
	 * @param array<int,string> $comparison_dates Inclusive dates displayed on the opposite side.
	 *
	 * @return array<int,array<string,mixed>> Ordered localized date parts with change state.
	 */
	private function build_full_day_resize_period_parts( $display_dates, $comparison_dates ) {
		$display_start    = reset( $display_dates );
		$display_end      = end( $display_dates );
		$comparison_start = reset( $comparison_dates );
		$comparison_end   = end( $comparison_dates );

		if ( $display_start === $display_end ) {
			return array(
				array(
					'role'    => 'date',
					'text'    => $this->format_review_date( $display_start ),
					'changed' => $display_start !== $comparison_start || $display_end !== $comparison_end,
				),
			);
		}

		$date_parts = array(
			'{{WPBC_START_DATE}}' => array(
				'role'    => 'start_date',
				'text'    => $this->format_review_date( $display_start ),
				'changed' => $display_start !== $comparison_start,
			),
			'{{WPBC_END_DATE}}'   => array(
				'role'    => 'end_date',
				'text'    => $this->format_review_date( $display_end ),
				'changed' => $display_end !== $comparison_end,
			),
		);
		$tokenized_range = sprintf(
			/* translators: 1: first inclusive date, 2: final inclusive date. */
			__( '%1$s - %2$s', 'booking' ),
			'{{WPBC_START_DATE}}',
			'{{WPBC_END_DATE}}'
		);
		$tokenized_parts = preg_split(
			'/(\{\{WPBC_(?:START_DATE|END_DATE)\}\})/',
			$tokenized_range,
			-1,
			PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY
		);
		$period_parts = array();

		foreach ( is_array( $tokenized_parts ) ? $tokenized_parts : array() as $tokenized_part ) {
			$period_parts[] = isset( $date_parts[ $tokenized_part ] )
				? $date_parts[ $tokenized_part ]
				: array(
					'role'    => 'separator',
					'text'    => $tokenized_part,
					'changed' => false,
				);
		}

		return $period_parts;
	}

	/**
	 * Format one inclusive full-day segment and its selected-date count.
	 *
	 * @param string            $label         Localized summary label.
	 * @param array<int,string> $segment_dates Ordered canonical `Y-m-d` dates.
	 *
	 * @return string Localized inclusive range summary.
	 */
	private function format_full_day_segment_summary( $label, $segment_dates ) {
		if ( empty( $segment_dates ) ) {
			return '';
		}

		$first_date = reset( $segment_dates );
		$last_date  = end( $segment_dates );
		$date_range = $this->format_review_date( $first_date );
		if ( $last_date !== $first_date ) {
			$date_range = sprintf(
				/* translators: 1: first inclusive date, 2: final inclusive date. */
				__( '%1$s - %2$s', 'booking' ),
				$date_range,
				$this->format_review_date( $last_date )
			);
		}

		$date_count = count( $segment_dates );

		return sprintf(
			/* translators: 1: summary label, 2: inclusive date or date range, 3: number of full days. */
			__( '%1$s: %2$s, %3$s', 'booking' ),
			$label,
			$date_range,
			sprintf(
				/* translators: %s: number of full days. */
				_n( '%s day', '%s days', $date_count, 'booking' ),
				number_format_i18n( $date_count )
			)
		);
	}

	/**
	 * Format one canonical booking date using the WordPress site date format.
	 *
	 * @param string $date_value Canonical `Y-m-d` date.
	 *
	 * @return string Localized date label, or the canonical value as a fallback.
	 */
	private function format_review_date( $date_value ) {
		$site_timezone = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		$date_time     = DateTimeImmutable::createFromFormat( '!Y-m-d', $date_value, $site_timezone );
		if ( ! $date_time || $date_time->format( 'Y-m-d' ) !== $date_value ) {
			return sanitize_text_field( (string) $date_value );
		}

		$date_format = function_exists( 'get_option' ) ? (string) get_option( 'date_format', 'M j, Y' ) : 'M j, Y';

		return function_exists( 'wp_date' )
			? wp_date( $date_format, $date_time->getTimestamp(), $site_timezone )
			: $date_time->format( 'M j, Y' );
	}

	/**
	 * Format an exact non-negative duration for review presentation.
	 *
	 * @param int $duration_minutes Exact elapsed duration in minutes.
	 *
	 * @return string Localized days, hours, and minutes label.
	 */
	private function format_duration_minutes( $duration_minutes ) {
		$duration_minutes = absint( $duration_minutes );
		if ( 0 === $duration_minutes ) {
			return sprintf(
				/* translators: %s: number of minutes. */
				_n( '%s minute', '%s minutes', 0, 'booking' ),
				number_format_i18n( 0 )
			);
		}

		return function_exists( 'wpbc_format_duration_minutes' )
			? wpbc_format_duration_minutes( $duration_minutes )
			: sprintf(
				/* translators: %s: number of minutes. */
				_n( '%s minute', '%s minutes', $duration_minutes, 'booking' ),
				number_format_i18n( $duration_minutes )
			);
	}

	/**
	 * Format a signed duration difference without losing a zero-minute result.
	 *
	 * @param int $difference_minutes Signed elapsed duration difference.
	 *
	 * @return string Localized signed days, hours, and minutes label.
	 */
	private function format_duration_difference( $difference_minutes ) {
		$difference_minutes = (int) $difference_minutes;
		if ( 0 === $difference_minutes ) {
			return $this->format_duration_minutes( 0 );
		}

		return ( 0 < $difference_minutes ? '+' : '-' ) . $this->format_duration_minutes( abs( $difference_minutes ) );
	}

	/**
	 * Build explicit review implications proven by canonical validation.
	 *
	 * @param bool   $is_appointment Whether Appointment-specific validation ran.
	 * @param string $selection_method Whether current range geometry applied.
	 *
	 * @return array<int,array<string,string>> Implication records.
	 */
	private function build_implications( $is_appointment, $selection_method ) {
		$validated = __( 'Validated against the current server rules.', 'booking' );

		return array(
			array( 'key' => 'selection_policy', 'label' => __( 'Date selection rules', 'booking' ), 'status' => 'individual' === $selection_method ? 'individual_geometry' : 'validated', 'detail' => 'individual' === $selection_method ? __( 'Range-length and start-day geometry is bypassed; availability and every other server rule still apply.', 'booking' ) : $validated ),
			array( 'key' => 'changeover', 'label' => __( 'Changeover', 'booking' ), 'status' => 'validated', 'detail' => $validated ),
			array( 'key' => 'checkout', 'label' => __( 'Checkout', 'booking' ), 'status' => 'validated', 'detail' => $validated ),
			array( 'key' => 'gaps', 'label' => __( 'Unbookable gaps', 'booking' ), 'status' => 'validated', 'detail' => $validated ),
			array( 'key' => 'working_time', 'label' => __( 'Working Time', 'booking' ), 'status' => $is_appointment ? 'validated' : 'not_applicable', 'detail' => $is_appointment ? $validated : __( 'Not applicable to this booking.', 'booking' ) ),
			array( 'key' => 'seasons', 'label' => __( 'Seasons', 'booking' ), 'status' => 'validated', 'detail' => $validated ),
			array( 'key' => 'appointment', 'label' => __( 'Appointment', 'booking' ), 'status' => $is_appointment ? 'validated' : 'not_applicable', 'detail' => $is_appointment ? $validated : __( 'Not applicable to this booking.', 'booking' ) ),
		);
	}

	/**
	 * Fingerprint exact server-derived allocation without exposing it separately.
	 *
	 * @param array<string,mixed> $where_to_save Canonical allocation result.
	 *
	 * @return string Hexadecimal HMAC.
	 */
	private function build_allocation_fingerprint( $where_to_save ) {
		$allocation = array(
			'main__resource_id'  => isset( $where_to_save['main__resource_id'] ) ? absint( $where_to_save['main__resource_id'] ) : 0,
			'resources_in_dates' => isset( $where_to_save['resources_in_dates'] ) ? $where_to_save['resources_in_dates'] : array(),
			'time_to_book'       => isset( $where_to_save['time_to_book'] ) ? $where_to_save['time_to_book'] : array(),
		);

		return hash_hmac( 'sha256', 'wpbc_booking_rescheduling_allocation:v1:' . wp_json_encode( $allocation ), wp_salt( 'nonce' ) );
	}

	/**
	 * Sign one complete plan.
	 *
	 * @param array<string,mixed> $plan Plan.
	 *
	 * @return string Hexadecimal HMAC.
	 */
	private function sign_plan( $plan ) {
		return hash_hmac( 'sha256', 'wpbc_booking_rescheduling_review:v1:' . wp_json_encode( $plan ), wp_salt( 'nonce' ) );
	}

	/** @return int Current site ID. */
	private function get_site_id() {
		return function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0;
	}

	/** @return int Effective MultiUser user ID. */
	private function get_effective_user_id() {
		return function_exists( 'wpbc_get_current_user_id' ) ? absint( wpbc_get_current_user_id() ) : $this->get_actor_user_id();
	}

	/** @return int Current WordPress actor ID. */
	private function get_actor_user_id() {
		return function_exists( 'get_current_user_id' ) ? absint( get_current_user_id() ) : 0;
	}

	/** @return WP_Error Safe invalid-plan error. */
	private function get_invalid_plan_error() {
		return new WP_Error( 'wpbc_booking_rescheduling_plan_invalid', __( 'The reviewed booking schedule is invalid or expired. Review the changes again.', 'booking' ), array( 'status' => 400 ) );
	}

	/** @return WP_Error Safe stale-plan error. */
	private function get_stale_plan_error() {
		return new WP_Error( 'wpbc_booking_rescheduling_plan_stale', __( 'The booking or its scheduling rules changed after review. Reload and review the changes again.', 'booking' ), array( 'status' => 409 ) );
	}
}
