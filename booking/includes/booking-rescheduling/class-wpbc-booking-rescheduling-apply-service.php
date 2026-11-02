<?php
/**
 * Booking Rescheduling apply orchestration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Revalidate and persist one signed rescheduling plan under the canonical guard.
 */
final class WPBC_Booking_Rescheduling_Apply_Service {

	/** @var WPBC_Booking_Rescheduling_Apply_Request_Validator Apply validator. */
	private $request_validator;

	/** @var WPBC_Booking_Rescheduling_Review_Service Review/revalidation service. */
	private $review_service;

	/** @var WPBC_Booking_Rescheduling_Mutation_Service Mutation service. */
	private $mutation_service;

	/** @var WPBC_Booking_Modified_Notification_Service Post-commit Modified-email dispatcher. */
	private $notification_service;

	/**
	 * Construct the apply service.
	 *
	 * @param WPBC_Booking_Rescheduling_Apply_Request_Validator|null $request_validator Optional validator.
	 * @param WPBC_Booking_Rescheduling_Review_Service|null          $review_service    Optional review service.
	 * @param WPBC_Booking_Rescheduling_Mutation_Service|null        $mutation_service  Optional mutation service.
	 * @param WPBC_Booking_Modified_Notification_Service|null        $notification_service Optional post-commit notification service.
	 */
	public function __construct( $request_validator = null, $review_service = null, $mutation_service = null, $notification_service = null ) {
		$this->request_validator = $request_validator ? $request_validator : new WPBC_Booking_Rescheduling_Apply_Request_Validator();
		$this->review_service    = $review_service ? $review_service : new WPBC_Booking_Rescheduling_Review_Service();
		$this->mutation_service  = $mutation_service ? $mutation_service : new WPBC_Booking_Rescheduling_Mutation_Service();
		$this->notification_service = $notification_service ? $notification_service : new WPBC_Booking_Modified_Notification_Service();
	}

	/**
	 * Apply one signed plan after complete apply-time revalidation.
	 *
	 * @param mixed $request_values Untrusted endpoint values.
	 *
	 * @return array<string,mixed>|WP_Error Canonical post-save data or safe error.
	 */
	public function apply( $request_values ) {
		$request = $this->request_validator->normalize( $request_values );
		if ( is_wp_error( $request ) ) {
			return $request;
		}
		if ( ! function_exists( 'wpbc_booking_availability_guard_acquire' ) ) {
			return $this->get_apply_error();
		}

		$guard = wpbc_booking_availability_guard_acquire();
		if ( is_wp_error( $guard ) ) {
			return $guard;
		}

		$context = null;
		$result  = null;
		try {
			wpbc_cache__clear( 'wpbc__sql__get_booking_dates' );
			$context = $this->review_service->revalidate_plan_for_apply( $request['plan'], $request['token'], $request['booking_id'], $request['source'] );
			if ( is_wp_error( $context ) ) {
				return $context;
			}
			if ( ! wpbc_booking_availability_guard_is_owned( $guard ) ) {
				return wpbc_booking_availability_guard_get_busy_error();
			}

			$result = $this->mutation_service->apply( $context );
			if ( is_wp_error( $result ) ) {
				return $result;
			}
		} finally {
			wpbc_cache__clear( 'wpbc__sql__get_booking_dates' );
			wpbc_booking_availability_guard_release( $guard );
		}

		$notifications_sent = false;
		if ( ! empty( $result['changed'] ) ) {
			$this->run_compatibility_hooks( $context, $result, $request['token'], $request['send_modified_email'] );
			$notifications_sent = $this->notification_service->send(
				absint( $context['booking']['booking_id'] ),
				$request['send_modified_email']
			);
		}

		return $this->build_canonical_result( $context, $result, $notifications_sent );
	}

	/**
	 * Run established lifecycle and Activity hooks after successful persistence.
	 *
	 * @param array<string,mixed> $context Fresh apply context.
	 * @param array<string,mixed> $result  Persistence result.
	 * @param string              $token   Verified plan signature used for Activity idempotency.
	 * @param bool                $send_modified_email Whether this operation requested the Modified email.
	 *
	 * @return void
	 */
	private function run_compatibility_hooks( $context, $result, $token, $send_modified_email ) {
		$schedule          = $context['schedule'];
		$booking_id        = absint( $context['booking']['booking_id'] );
		$resource_id       = absint( $result['primary_resource_id'] );
		$time_boundaries   = 'full_day' === $schedule['time_application']
			? array( '00:00:00', '24:00:00' )
			: array( $schedule['start_time'] . ':01', $schedule['end_time'] . ':02' );
		$changed_fields    = array( 'booking_dates' );
		$activity_changes  = array(
			array(
				'field_key'   => 'booking_dates',
				'label'       => __( 'Booking dates', 'booking' ),
				'value_policy' => 'exact_value',
				'before'      => $context['shape']['saved'],
				'after'       => $schedule,
			),
		);
		if ( absint( $context['booking']['booking_type'] ) !== $resource_id ) {
			$previous_resource_id    = absint( $context['booking']['booking_type'] );
			$resource_labels         = isset( $context['resource_labels'] ) && is_array( $context['resource_labels'] ) ? $context['resource_labels'] : array();
			$previous_resource_label = isset( $resource_labels[ $previous_resource_id ] ) ? sanitize_text_field( $resource_labels[ $previous_resource_id ] ) : '';
			$new_resource_label      = isset( $resource_labels[ $resource_id ] ) ? sanitize_text_field( $resource_labels[ $resource_id ] ) : '';
			$changed_fields[]   = 'booking_resource';
			$activity_changes[] = array(
				'field_key'   => 'booking_resource',
				'label'       => __( 'Booking Resource', 'booking' ),
				'value_policy' => 'bounded_choice',
				'before'      => array( $previous_resource_label ),
				'after'       => array( $new_resource_label ),
			);
		}
		$create_params = array(
			'resource_id'                   => $resource_id,
			'dates_only_sql_arr'            => $schedule['selected_dates'],
			'time_as_his_arr'               => $time_boundaries,
			'is_from_admin_panel'           => true,
			'is_edit_booking'               => $booking_id,
			'is_duplicate_booking'          => 0,
			'is_approve_booking'            => ! empty( $context['date_rows'][0]['approved'] ) ? 1 : 0,
			'how_many_items_to_book'        => absint( $context['resolution']['quantity'] ),
			'is_use_booking_recurrent_time' => 'per_date' === $schedule['time_application'],
			'is_emails_send'                => $send_modified_email ? 1 : 0,
			'activity_idempotency_key'      => 'reschedule:' . substr( $token, 0, 48 ),
			'activity_payload'              => array(
				'fields'     => $changed_fields,
				'change_set' => array(
					'version'       => 1,
					'total_changes' => count( $activity_changes ),
					'changes'       => $activity_changes,
				),
			),
		);

		do_action( 'wpbc_booking_after_save', $booking_id, $create_params, $context['resolution']['where_to_save'] );
		if ( absint( $context['booking']['booking_type'] ) !== $resource_id ) {
			do_action( 'wpbc_booking_action__change_booking_resource', $booking_id, $resource_id );
		}
	}

	/**
	 * Return only canonical data proven by the guarded persistence result.
	 *
	 * @param array<string,mixed> $context Fresh apply context.
	 * @param array<string,mixed> $result  Persistence result.
	 * @param bool                $notifications_sent Whether the established Modified sender reported success.
	 *
	 * @return array<string,mixed> Canonical post-save DTO and host refresh request.
	 */
	private function build_canonical_result( $context, $result, $notifications_sent ) {
		$canonical_rows = array();
		foreach ( (array) $result['canonical_rows'] as $row ) {
			$canonical_rows[] = array(
				'booking_date' => (string) $row['booking_date'],
				'approved'     => ! empty( $row['approved'] ),
				'resource_id'  => ! empty( $row['type_id'] ) ? absint( $row['type_id'] ) : absint( $result['primary_resource_id'] ),
			);
		}

		return array(
			'changed'             => ! empty( $result['changed'] ),
			'booking_id'          => absint( $context['booking']['booking_id'] ),
			'primary_resource_id' => absint( $result['primary_resource_id'] ),
			'requested_resource_id' => absint( $context['schedule']['target_resource_id'] ),
			'modification_date'   => isset( $result['modification_date'] ) ? (string) $result['modification_date'] : '',
			'canonical_identity'  => array(
				'booking_id'        => absint( $context['booking']['booking_id'] ),
				'modification_date' => isset( $result['modification_date'] ) ? (string) $result['modification_date'] : '',
			),
			'schedule'            => array(
				'dates'            => array_values( $context['schedule']['selected_dates'] ),
				'time_application' => $context['schedule']['time_application'],
				'start_time'       => $context['schedule']['start_time'],
				'end_time'         => $context['schedule']['end_time'],
			),
			'quantity'            => absint( $context['resolution']['quantity'] ),
			'canonical_date_rows' => $canonical_rows,
			'preserved'           => array(
				'form_data'        => true,
				'notes'            => true,
				'status'           => true,
				'saved_cost'       => true,
				'payment_state'    => true,
				'notification_intent' => true,
			),
			'notifications_sent'  => (bool) $notifications_sent,
			'host_refresh'        => array(
				'required'   => true,
				'booking_id' => absint( $context['booking']['booking_id'] ),
				'source'     => $context['source'],
			),
		);
	}

	/** @return WP_Error Safe missing-guard error. */
	private function get_apply_error() {
		return new WP_Error( 'wpbc_booking_rescheduling_apply_unavailable', __( 'The booking schedule could not be changed safely. Try again.', 'booking' ), array( 'status' => 500 ) );
	}
}
