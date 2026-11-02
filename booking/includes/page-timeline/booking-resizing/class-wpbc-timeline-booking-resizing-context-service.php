<?php
/**
 * Timeline booking-resizing authoritative context service.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build one authorized, non-mutating direct-resize eligibility DTO.
 */
final class WPBC_Timeline_Booking_Resizing_Context_Service {

	/** @var WPBC_Timeline_Booking_Resizing_Request_Validator Request validator. */
	private $request_validator;

	/** @var WPBC_Booking_Rescheduling_Authorization Authorization boundary. */
	private $authorization;

	/** @var WPBC_Booking_Rescheduling_Repository Canonical repository. */
	private $repository;

	/** @var WPBC_Booking_Rescheduling_Shape_Classifier Saved-shape classifier. */
	private $shape_classifier;

	/** @var WPBC_Booking_Rescheduling_Interaction_Policy Interaction policy. */
	private $interaction_policy;

	/** @var WPBC_Booking_Rescheduling_Source_Context Source-context service. */
	private $source_context;

	/**
	 * Construct the context service with focused replaceable dependencies.
	 *
	 * @param WPBC_Timeline_Booking_Resizing_Request_Validator|null $request_validator  Optional request validator.
	 * @param WPBC_Booking_Rescheduling_Authorization|null          $authorization     Optional authorization boundary.
	 * @param WPBC_Booking_Rescheduling_Repository|null             $repository        Optional canonical repository.
	 * @param WPBC_Booking_Rescheduling_Shape_Classifier|null       $shape_classifier  Optional shape classifier.
	 * @param WPBC_Booking_Rescheduling_Interaction_Policy|null     $interaction_policy Optional interaction policy.
	 * @param WPBC_Booking_Rescheduling_Source_Context|null         $source_context     Optional source-context service.
	 */
	public function __construct(
		$request_validator = null,
		$authorization = null,
		$repository = null,
		$shape_classifier = null,
		$interaction_policy = null,
		$source_context = null
	) {
		$this->request_validator  = $request_validator ? $request_validator : new WPBC_Timeline_Booking_Resizing_Request_Validator();
		$this->authorization      = $authorization ? $authorization : new WPBC_Booking_Rescheduling_Authorization();
		$this->repository         = $repository ? $repository : new WPBC_Booking_Rescheduling_Repository();
		$this->shape_classifier   = $shape_classifier ? $shape_classifier : new WPBC_Booking_Rescheduling_Shape_Classifier();
		$this->interaction_policy = $interaction_policy ? $interaction_policy : new WPBC_Booking_Rescheduling_Interaction_Policy( null, $this->repository );
		$this->source_context     = $source_context ? $source_context : new WPBC_Booking_Rescheduling_Source_Context();
	}

	/**
	 * Return current direct-resize eligibility for one Timeline segment.
	 *
	 * The service reloads and authorizes all canonical source state. It performs
	 * no availability review and no mutation; availability, capacity, conflicts,
	 * time, timezone, and DST are checked later by canonical Review and Apply.
	 *
	 * @param mixed $request_values Untrusted endpoint values.
	 *
	 * @return array<string,mixed>|WP_Error Data-only eligibility DTO or safe error.
	 */
	public function read( $request_values ) {
		$request = $this->request_validator->normalize( $request_values );
		if ( is_wp_error( $request ) ) {
			return $request;
		}

		$authorization_context = $this->authorization->authorize_booking( $request['booking_id'], $request['source'] );
		if ( is_wp_error( $authorization_context ) ) {
			return $authorization_context;
		}

		$booking   = $authorization_context['booking'];
		$date_rows = $this->repository->get_booking_dates( $booking );
		if ( is_wp_error( $date_rows ) ) {
			return $date_rows;
		}

		$effective_resource_ids = isset( $authorization_context['effective_resource_ids'] )
			? array_values( (array) $authorization_context['effective_resource_ids'] )
			: array();
		if ( '' !== $request['source_context_token'] ) {
			$source_check = $this->source_context->verify(
				$request['source_context_token'],
				$booking,
				$date_rows,
				$request['source'],
				$effective_resource_ids
			);
			if ( is_wp_error( $source_check ) ) {
				return $source_check;
			}
		}

		$appointment_snapshot = $this->repository->get_appointment_snapshot( $request['booking_id'] );
		$shape_context        = $this->shape_classifier->classify( $date_rows, $effective_resource_ids, $appointment_snapshot );
		$eligibility          = $this->interaction_policy->evaluate_resize(
			$booking,
			$date_rows,
			$effective_resource_ids,
			$shape_context,
			$appointment_snapshot,
			$request['visible_interval']
		);
		$interaction_context = ! empty( $eligibility['eligible'] )
			? array(
				'interaction_source' => 'resize',
				'saved_shape'        => $eligibility['saved_shape'],
				'resize_scope'       => $eligibility['resize_scope'],
				'immutable_interval' => $eligibility['immutable_interval'],
			)
			: array();

		return array(
			'resize_context' => array_merge(
				array(
					'schema_version'       => WPBC_Timeline_Booking_Resizing_Config::SCHEMA_VERSION,
					'booking_id'           => absint( $request['booking_id'] ),
					'target_resource_id'   => isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0,
					'interaction_source'   => 'resize',
					'source_context_token' => $this->source_context->issue(
						$booking,
						$date_rows,
						$request['source'],
						$effective_resource_ids,
						$interaction_context
					),
					'proposal_revision'    => 1,
				),
				$eligibility
			),
		);
	}
}
