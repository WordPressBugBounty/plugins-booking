<?php
/**
 * Idempotent Apply orchestration for Add New Booking Inspector.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Claims one signed review and invokes the canonical lifecycle at most once.
 */
final class WPBC_Booking_New_Inspector_Apply_Service {

	/** @var object Apply request validator. */
	private $request_validator;

	/** @var object Signed review verifier and revalidator. */
	private $review_service;

	/** @var object Durable claim repository. */
	private $idempotency_repository;

	/** @var object Canonical creation adapter. */
	private $creation_service;

	/** @var object Authoritative marker readback repository. */
	private $creation_repository;

	/**
	 * Construct the orchestration service with replaceable test boundaries.
	 *
	 * @param object|null $request_validator      Optional object exposing validate().
	 * @param object|null $review_service         Optional object exposing verify_plan() and revalidate_plan_for_apply().
	 * @param object|null $idempotency_repository Optional durable claim repository.
	 * @param object|null $creation_service       Optional canonical creation adapter.
	 * @param object|null $creation_repository    Optional marker readback repository.
	 */
	public function __construct( $request_validator = null, $review_service = null, $idempotency_repository = null, $creation_service = null, $creation_repository = null ) {
		$this->request_validator      = $request_validator ? $request_validator : new WPBC_Booking_New_Inspector_Apply_Request_Validator();
		$this->review_service         = $review_service ? $review_service : new WPBC_Booking_New_Inspector_Review_Service();
		$this->idempotency_repository = $idempotency_repository ? $idempotency_repository : new WPBC_Booking_New_Inspector_Idempotency_Repository();
		$this->creation_repository    = $creation_repository ? $creation_repository : new WPBC_Booking_New_Inspector_Creation_Repository();
		$this->creation_service       = $creation_service ? $creation_service : new WPBC_Booking_New_Inspector_Creation_Service( $this->creation_repository );
	}

	/**
	 * Apply one signed creation plan exactly once for its user/site scope.
	 *
	 * @param mixed $request_values Untrusted decoded Apply envelope.
	 * @return array<string,mixed>|WP_Error Created response or safe error.
	 */
	public function apply( $request_values ) {
		$request = $this->request_validator->validate( $request_values );
		if ( is_wp_error( $request ) ) {
			return $request;
		}
		$plan_check = $this->review_service->verify_plan( $request['plan'], $request['token'] );
		if ( is_wp_error( $plan_check ) ) {
			return $plan_check;
		}
		if ( ! hash_equals( (string) $request['plan']['idempotency_key'], (string) $request['idempotency_key'] ) ) {
			return new WP_Error( 'wpbc_booking_new_inspector_idempotency_invalid', __( 'The booking creation identifier does not match this review.', 'booking' ), array( 'status' => 409 ) );
		}

		$plan_fingerprint = hash( 'sha256', wp_json_encode( $request['plan'] ) . '|' . $request['token'] );
		$marker           = hash( 'sha256', 'wpbc-booking-new-inspector|' . $plan_fingerprint . '|' . $request['idempotency_key'] );
		$claim            = $this->idempotency_repository->claim( $request['idempotency_key'], $plan_fingerprint );
		if ( is_wp_error( $claim ) ) {
			return $claim;
		}
		if ( empty( $claim['is_new_claim'] ) ) {
			return $this->resolve_existing_claim( $claim, $request, $marker );
		}

		$revalidated = $this->review_service->revalidate_plan_for_apply( $request['plan'], $request['token'] );
		if ( is_wp_error( $revalidated ) ) {
			$this->idempotency_repository->fail_before_persistence( $request['idempotency_key'], $revalidated->get_error_code() );
			return $this->require_fresh_review( $revalidated );
		}
		$creation = $this->creation_service->create( $revalidated, $request['plan'], $marker );
		if ( is_wp_error( $creation ) ) {
			$this->idempotency_repository->fail_before_persistence( $request['idempotency_key'], $creation->get_error_code() );
			return $this->require_fresh_review( $creation );
		}

		$response = $this->build_response( $request, $creation['booking'], $creation['warnings'] );
		$status   = empty( $creation['warnings'] ) ? 'completed' : 'created_with_warnings';
		$this->idempotency_repository->complete( $request['idempotency_key'], $status, $creation['booking']['id'], $response );
		return $response;
	}

	/**
	 * Resolve a replay, double-click, timeout, or concurrent request safely.
	 *
	 * @param array<string,mixed> $claim   Existing durable claim.
	 * @param array<string,mixed> $request Validated Apply request.
	 * @param string              $marker  Server-derived booking marker.
	 * @return array<string,mixed>|WP_Error Stored result or non-retryable lifecycle state.
	 */
	private function resolve_existing_claim( $claim, $request, $marker ) {
		if ( in_array( $claim['status'], array( 'completed', 'created_with_warnings' ), true ) && ! empty( $claim['result'] ) ) {
			$result               = $claim['result'];
			$result['request_id'] = $request['request_id'];
			return $result;
		}
		$readback = $this->creation_repository->find_by_marker( $marker );
		if ( null !== $readback && ! empty( $readback['dates'] ) ) {
			$warnings = array( __( 'The booking was already created. Its final response was recovered after an interrupted request.', 'booking' ) );
			$response = $this->build_response( $request, $readback, $warnings );
			$this->idempotency_repository->complete( $request['idempotency_key'], 'created_with_warnings', $readback['id'], $response );
			return $response;
		}
		if ( null !== $readback && empty( $readback['dates'] ) ) {
			$this->creation_repository->compensate_orphan_without_dates( $marker );
			$this->idempotency_repository->fail_before_persistence( $request['idempotency_key'], 'orphan_compensated' );
			return new WP_Error( 'wpbc_booking_new_inspector_orphan_compensated', __( 'An incomplete booking row was removed safely. Review the booking again before creating it.', 'booking' ), array( 'status' => 409, 'retry_state' => WPBC_Booking_New_Inspector_Contract::STATE_EDITING ) );
		}
		if ( 'failed' === $claim['status'] ) {
			return new WP_Error( 'wpbc_booking_new_inspector_apply_previously_failed', __( 'This reviewed creation attempt did not complete. Review the current booking details again.', 'booking' ), array( 'status' => 409, 'retry_state' => WPBC_Booking_New_Inspector_Contract::STATE_EDITING ) );
		}

		return new WP_Error( 'wpbc_booking_new_inspector_apply_in_progress', __( 'This booking creation request is already being processed. Wait briefly before checking the result again.', 'booking' ), array( 'status' => 409, 'retry_state' => WPBC_Booking_New_Inspector_Contract::STATE_APPLYING ) );
	}

	/**
	 * Preserve one safe Apply error while requiring a new signed Review.
	 *
	 * A failed pre-persistence claim is terminal for its idempotency key. Returning
	 * to editing prevents the browser from offering a retry that is guaranteed to
	 * resolve as a previously failed claim.
	 *
	 * @param WP_Error $error Apply-time validation or canonical creation error.
	 * @return WP_Error Error with the editing recovery state.
	 */
	private function require_fresh_review( $error ) {
		$error_data = $error->get_error_data();
		$error_data = is_array( $error_data ) ? $error_data : array();
		$error_data['retry_state'] = WPBC_Booking_New_Inspector_Contract::STATE_EDITING;

		return new WP_Error( $error->get_error_code(), $error->get_error_message(), $error_data );
	}

	/**
	 * Build the stable created-booking response.
	 *
	 * @param array<string,mixed> $request  Validated Apply request.
	 * @param array<string,mixed> $booking  Authoritative booking readback.
	 * @param array<int,string>   $warnings Safe warning strings.
	 * @return array<string,mixed> Apply response DTO.
	 */
	private function build_response( $request, $booking, $warnings ) {
		$readback_revision = hash( 'sha256', wp_json_encode( $booking ) );
		$saved_cost        = isset( $booking['saved_cost'] ) ? (string) $booking['saved_cost'] : '';
		$created_booking   = array(
			'booking_id'       => absint( $booking['id'] ),
			'resource_id'      => absint( $booking['resource_id'] ),
			'status'           => sanitize_key( (string) $booking['status'] ),
			'cost'             => array(
				'status'          => '' !== $saved_cost ? 'calculated' : 'unavailable',
				'total'           => $saved_cost,
				'formatted_total' => $saved_cost,
				'currency'        => isset( $request['plan']['cost']['currency'] ) ? sanitize_text_field( (string) $request['plan']['cost']['currency'] ) : '',
				'line_items'      => array(),
			),
			'message'          => empty( $warnings ) ? __( 'The booking was created successfully.', 'booking' ) : __( 'The booking was created with warnings.', 'booking' ),
			'readback_revision' => $readback_revision,
		);
		return array(
			'schema_version'  => WPBC_Booking_New_Inspector_Config::SCHEMA_VERSION,
			'request_id'      => $request['request_id'],
			'state'           => WPBC_Booking_New_Inspector_Contract::STATE_CREATED,
			'booking'         => $created_booking,
			'idempotency_key' => $request['idempotency_key'],
			'warnings'        => array_slice( array_values( array_unique( array_map( 'sanitize_text_field', $warnings ) ) ), 0, WPBC_Booking_New_Inspector_Config::MAX_WARNINGS ),
		);
	}
}
