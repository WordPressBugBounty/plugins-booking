<?php
/**
 * Timeline booking-movement authoritative context service.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build one authorized, non-mutating direct-movement context DTO.
 */
final class WPBC_Timeline_Booking_Movement_Context_Service {

	/** @var WPBC_Timeline_Booking_Movement_Request_Validator Request validator. */
	private $request_validator;

	/** @var WPBC_Booking_Rescheduling_Authorization Authorization boundary. */
	private $authorization;

	/** @var WPBC_Booking_Rescheduling_Repository Canonical repository. */
	private $repository;

	/** @var WPBC_Booking_Rescheduling_Shape_Classifier Saved-shape classifier. */
	private $shape_classifier;

	/** @var WPBC_Timeline_Booking_Movement_Interaction_Policy Movement interaction policy. */
	private $interaction_policy;

	/** @var WPBC_Booking_Rescheduling_Source_Context Opaque source-context service. */
	private $source_context;

	/** @var WPBC_Booking_Rescheduling_Proposal_Normalizer Canonical schedule projector. */
	private $proposal_normalizer;

	/**
	 * Construct the context service with focused replaceable dependencies.
	 *
	 * @param WPBC_Timeline_Booking_Movement_Request_Validator|null  $request_validator  Optional request validator.
	 * @param WPBC_Booking_Rescheduling_Authorization|null           $authorization      Optional authorization boundary.
	 * @param WPBC_Booking_Rescheduling_Repository|null              $repository         Optional canonical repository.
	 * @param WPBC_Booking_Rescheduling_Shape_Classifier|null        $shape_classifier   Optional shape classifier.
	 * @param WPBC_Timeline_Booking_Movement_Interaction_Policy|null $interaction_policy Optional movement policy.
	 * @param WPBC_Booking_Rescheduling_Source_Context|null          $source_context      Optional source-context service.
	 * @param WPBC_Booking_Rescheduling_Proposal_Normalizer|null     $proposal_normalizer Optional schedule projector.
	 */
	public function __construct(
		$request_validator = null,
		$authorization = null,
		$repository = null,
		$shape_classifier = null,
		$interaction_policy = null,
		$source_context = null,
		$proposal_normalizer = null
	) {
		$this->request_validator   = $request_validator ? $request_validator : new WPBC_Timeline_Booking_Movement_Request_Validator();
		$this->authorization       = $authorization ? $authorization : new WPBC_Booking_Rescheduling_Authorization();
		$this->repository          = $repository ? $repository : new WPBC_Booking_Rescheduling_Repository();
		$this->shape_classifier    = $shape_classifier ? $shape_classifier : new WPBC_Booking_Rescheduling_Shape_Classifier();
		$this->interaction_policy  = $interaction_policy ? $interaction_policy : new WPBC_Timeline_Booking_Movement_Interaction_Policy();
		$this->source_context      = $source_context ? $source_context : new WPBC_Booking_Rescheduling_Source_Context();
		$this->proposal_normalizer = $proposal_normalizer ? $proposal_normalizer : new WPBC_Booking_Rescheduling_Proposal_Normalizer();
	}

	/**
	 * Return current direct-movement eligibility for one canonical booking.
	 *
	 * This read reloads and authorizes the saved source. It does not enumerate or
	 * authorize targets and performs no availability, allocation, pricing,
	 * capacity, compatibility, ownership, notification, or persistence work.
	 *
	 * @param mixed $request_values Untrusted endpoint values.
	 *
	 * @return array<string,mixed>|WP_Error Data-only movement context or safe error.
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
		$appointment_snapshot   = $this->repository->get_appointment_snapshot( $request['booking_id'] );
		$shape_context          = $this->shape_classifier->classify( $date_rows, $effective_resource_ids, $appointment_snapshot );
		if ( is_wp_error( $shape_context ) ) {
			return $shape_context;
		}
		$schedule_seed = $this->build_schedule_seed( $shape_context );
		if ( is_wp_error( $schedule_seed ) ) {
			return $schedule_seed;
		}
		$segment_check = $this->validate_visible_segment( $request['segment'], $date_rows, $effective_resource_ids, $schedule_seed );
		if ( is_wp_error( $segment_check ) ) {
			return $segment_check;
		}

		$movement_context = $this->interaction_policy->evaluate_all(
			$booking,
			$date_rows,
			$effective_resource_ids,
			$shape_context,
			$appointment_snapshot,
			$request['proposal_revision'],
			$this->authorization->can_change_resource()
		);
		if ( is_wp_error( $movement_context ) ) {
			return $movement_context;
		}
		$movement_available    = ! empty( $movement_context['same_resource_available'] ) || ! empty( $movement_context['cross_resource_available'] );
		$source_context_token = $movement_available
			? $this->source_context->issue(
				$booking,
				$date_rows,
				$request['source'],
				$effective_resource_ids,
				$movement_context['source_context']
			)
			: '';

		return array(
			'movement_context' => array(
				'booking_id'             => absint( $request['booking_id'] ),
				'primary_resource_id'    => isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0,
				'schedule_seed'          => $schedule_seed,
				'saved_shape'            => sanitize_key( $movement_context['saved_shape'] ),
				'proposal_revision'      => absint( $request['proposal_revision'] ),
				'gesture_availability'   => array(
					'same_resource'  => ! empty( $movement_context['same_resource_available'] ),
					'cross_resource' => ! empty( $movement_context['cross_resource_available'] ),
				),
				'gesture_restrictions' => array(
					'same_resource'  => sanitize_key( isset( $movement_context['same_resource_fallback_reason'] ) ? $movement_context['same_resource_fallback_reason'] : '' ),
					'cross_resource' => sanitize_key( isset( $movement_context['cross_resource_fallback_reason'] ) ? $movement_context['cross_resource_fallback_reason'] : '' ),
				),
				'source_context_token' => $source_context_token,
				'fallback_reason'      => sanitize_key( $movement_context['fallback_reason'] ),
			),
		);
	}

	/**
	 * Build a bounded allocation-free schedule seed from canonical saved rows.
	 *
	 * @param array<string,mixed> $shape_context Server-classified saved shape.
	 *
	 * @return array<string,mixed>|WP_Error Canonical browser proposal seed or safe error.
	 */
	private function build_schedule_seed( $shape_context ) {
		$saved = isset( $shape_context['saved'] ) && is_array( $shape_context['saved'] ) ? $shape_context['saved'] : array();
		$selected_dates = isset( $saved['selected_dates'] ) ? array_values( (array) $saved['selected_dates'] ) : array();
		if ( empty( $selected_dates ) || count( $selected_dates ) > WPBC_Booking_Rescheduling_Proposal_Contract::MAX_PROPOSED_DATES ) {
			return $this->get_stale_segment_error();
		}
		$time_application = isset( $saved['time_application'] ) ? sanitize_key( $saved['time_application'] ) : '';
		$exact_intervals  = 'full_day' === $time_application
			? $this->proposal_normalizer->get_saved_resize_segments( $saved )
			: $this->proposal_normalizer->get_saved_exact_intervals( $saved );
		if (
			is_wp_error( $exact_intervals )
			|| empty( $exact_intervals )
			|| count( $exact_intervals ) > WPBC_Booking_Rescheduling_Proposal_Contract::MAX_PROPOSED_INTERVALS
		) {
			return is_wp_error( $exact_intervals ) ? $exact_intervals : $this->get_stale_segment_error();
		}

		return array(
			'selection_method' => isset( $saved['selection_method'] ) ? sanitize_key( $saved['selection_method'] ) : '',
			'time_application' => $time_application,
			'selected_dates'   => array_map( 'sanitize_text_field', $selected_dates ),
			'start_time'       => isset( $saved['start_time'] ) ? sanitize_text_field( $saved['start_time'] ) : '',
			'end_time'         => isset( $saved['end_time'] ) ? sanitize_text_field( $saved['end_time'] ) : '',
			'exact_intervals'  => array_values( $exact_intervals ),
		);
	}

	/**
	 * Verify that the selected rendered segment still belongs to canonical state.
	 *
	 * The selected Resource is used only to match the already authorized source
	 * allocation. It is never returned as a target or treated as permission to
	 * move to another Resource.
	 *
	 * @param array<string,mixed>            $segment                Normalized selected segment.
	 * @param array<int,array<string,mixed>> $date_rows              Canonical booking-date rows.
	 * @param array<int,int>                 $effective_resource_ids Authorized allocation IDs.
	 * @param array<string,mixed>            $schedule_seed          Canonical allocation-free seed.
	 *
	 * @return true|WP_Error True when current, otherwise one non-disclosing stale error.
	 */
	private function validate_visible_segment( $segment, $date_rows, $effective_resource_ids, $schedule_seed ) {
		$segment_resource_id    = isset( $segment['resource_id'] ) ? absint( $segment['resource_id'] ) : 0;
		$effective_resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $effective_resource_ids ) ) ) );
		if ( ! $segment_resource_id || ! in_array( $segment_resource_id, $effective_resource_ids, true ) ) {
			return $this->get_stale_segment_error();
		}

		$segment_start_matches = false;
		$site_timezone         = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		foreach ( $date_rows as $date_row ) {
			if ( ! is_array( $date_row ) || $segment_resource_id !== absint( isset( $date_row['resource_id'] ) ? $date_row['resource_id'] : 0 ) ) {
				continue;
			}
			$booking_date = isset( $date_row['booking_date'] ) ? (string) $date_row['booking_date'] : '';
			if ( ! preg_match( '/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}):(00|01)$/', $booking_date, $date_matches ) ) {
				continue;
			}
			$row_start = DateTimeImmutable::createFromFormat( '!Y-m-d H:i:s', $date_matches[1] . ':00', $site_timezone );
			if ( $row_start && $row_start->getTimestamp() === absint( $segment['start_timestamp'] ) ) {
				$segment_start_matches = true;
				break;
			}
		}
		if ( ! $segment_start_matches ) {
			return $this->get_stale_segment_error();
		}

		$visible_start = isset( $segment['visible_start_time'] ) ? (int) $segment['visible_start_time'] : 0;
		$visible_end   = isset( $segment['visible_end_time'] ) ? (int) $segment['visible_end_time'] : 0;
		$segment_start = isset( $segment['start_timestamp'] ) ? absint( $segment['start_timestamp'] ) : 0;
		if ( ! $visible_start || ! $visible_end || ! $segment_start || $segment_start > $visible_start || $visible_end <= $visible_start ) {
			return $this->get_stale_segment_error();
		}

		foreach ( (array) $schedule_seed['exact_intervals'] as $exact_interval ) {
			try {
				$interval_start = new DateTimeImmutable( $exact_interval['start'] );
				$interval_end   = new DateTimeImmutable( $exact_interval['end'] );
			} catch ( Exception $exception ) {
				unset( $exception );
				continue;
			}
			if (
				$interval_start->getTimestamp() === $segment_start
				&& $interval_start->getTimestamp() <= $visible_start
				&& $interval_end->getTimestamp() >= $visible_end
			) {
				return true;
			}
		}

		return $this->get_stale_segment_error();
	}

	/**
	 * Return one uniform, data-free stale-segment error.
	 *
	 * @return WP_Error Safe stale or unauthorized segment error.
	 */
	private function get_stale_segment_error() {
		return new WP_Error(
			'wpbc_timeline_booking_movement_segment_stale',
			__( 'The selected booking segment changed or is no longer available. Reload the Timeline and try again.', 'booking' ),
			array( 'status' => 409 )
		);
	}
}
