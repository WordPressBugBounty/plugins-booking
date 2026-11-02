<?php
/**
 * Booking Date Editor apply orchestration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Revalidate and persist one signed Date Editor proposal.
 *
 * @since 12.0.0
 */
final class WPBC_Booking_Date_Editor_Apply_Service {

	/** @var WPBC_Booking_Date_Editor_Apply_Request_Validator Apply request validator. */
	private $request_validator;

	/** @var WPBC_Booking_Date_Editor_Review_Service Authoritative review/revalidation service. */
	private $review_service;

	/** @var WPBC_Booking_Date_Editor_Mutation_Repository Focused mutation repository. */
	private $mutation_repository;

	/** @var WPBC_Booking_Modified_Notification_Service Post-commit Modified-email dispatcher. */
	private $notification_service;

	/** @var WPBC_Booking_Date_Editor_Form_Time_Synchronizer Compatible form-time synchronizer. */
	private $form_time_synchronizer;

	/**
	 * Construct the apply service with replaceable focused dependencies.
	 *
	 * @param WPBC_Booking_Date_Editor_Apply_Request_Validator|null $request_validator   Optional request validator.
	 * @param WPBC_Booking_Date_Editor_Review_Service|null          $review_service      Optional review/revalidation service.
	 * @param WPBC_Booking_Date_Editor_Mutation_Repository|null     $mutation_repository Optional mutation repository.
	 * @param WPBC_Booking_Modified_Notification_Service|null       $notification_service Optional post-commit notification service.
	 * @param WPBC_Booking_Date_Editor_Form_Time_Synchronizer|null  $form_time_synchronizer Optional form-time synchronizer.
	 */
	public function __construct( $request_validator = null, $review_service = null, $mutation_repository = null, $notification_service = null, $form_time_synchronizer = null ) {
		$this->request_validator   = $request_validator ? $request_validator : new WPBC_Booking_Date_Editor_Apply_Request_Validator();
		$this->review_service      = $review_service ? $review_service : new WPBC_Booking_Date_Editor_Review_Service();
		$this->mutation_repository = $mutation_repository ? $mutation_repository : new WPBC_Booking_Date_Editor_Mutation_Repository();
		$this->notification_service = $notification_service ? $notification_service : new WPBC_Booking_Modified_Notification_Service();
		$this->form_time_synchronizer = $form_time_synchronizer ? $form_time_synchronizer : new WPBC_Booking_Date_Editor_Form_Time_Synchronizer();
	}

	/**
	 * Apply one signed proposal after all authoritative checks are repeated.
	 *
	 * Availability validation and persistence execute under the same canonical
	 * site lock. Compatibility hooks run only after persistence and after the
	 * lock is released, so extension callbacks cannot lengthen the critical
	 * section or observe a partially written booking.
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
			return $this->get_apply_unavailable_error();
		}

		$availability_guard = wpbc_booking_availability_guard_acquire();
		if ( is_wp_error( $availability_guard ) ) {
			return $availability_guard;
		}

		$apply_context = null;
		$write_result  = null;
		try {
			wpbc_cache__clear( 'wpbc__sql__get_booking_dates' );
			$apply_context = $this->review_service->revalidate_plan_for_apply(
				$request['plan'],
				$request['token'],
				$request['booking_id'],
				$request['source']
			);
			if ( is_wp_error( $apply_context ) ) {
				return $apply_context;
			}
			if ( ! wpbc_booking_availability_guard_is_owned( $availability_guard ) ) {
				return wpbc_booking_availability_guard_get_busy_error();
			}

			if ( $this->proposal_matches_saved( $apply_context['proposal'], $apply_context['saved'] ) ) {
				$write_result = array( 'changed' => false );
			} else {
				$canonical_date_rows = $this->build_canonical_date_rows( $apply_context );
				if ( is_wp_error( $canonical_date_rows ) ) {
					return $canonical_date_rows;
				}
				$form_synchronization = $this->form_time_synchronizer->synchronize(
					$apply_context['booking'],
					$apply_context['proposal']
				);
				$write_result = $this->mutation_repository->replace_booking_dates(
					$request['booking_id'],
					isset( $apply_context['booking']['modification_date'] ) ? (string) $apply_context['booking']['modification_date'] : '',
					$this->build_sort_date( $apply_context['proposal'] ),
					$canonical_date_rows,
					0,
					$form_synchronization['form']
				);
				if ( is_wp_error( $write_result ) ) {
					return $write_result;
				}
			}
		} finally {
			wpbc_cache__clear( 'wpbc__sql__get_booking_dates' );
			wpbc_booking_availability_guard_release( $availability_guard );
		}

		$notifications_sent = false;
		if ( ! empty( $write_result['changed'] ) ) {
			$this->run_compatibility_hooks( $apply_context, $request['send_modified_email'] );
			$notifications_sent = $this->notification_service->send(
				absint( $apply_context['booking']['booking_id'] ),
				$request['send_modified_email']
			);
		}

		return $this->build_canonical_result( $apply_context, ! empty( $write_result['changed'] ), $notifications_sent );
	}

	/**
	 * Convert the canonical allocation result into exact booking-date rows.
	 *
	 * @param array<string,mixed> $apply_context Fresh authoritative apply context.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Canonical rows or safe error.
	 */
	private function build_canonical_date_rows( $apply_context ) {
		$proposal        = $apply_context['proposal'];
		$where_to_save   = $apply_context['where_to_save'];
		$primary_resource_id = absint( $apply_context['resource_id'] );
		$resources_in_dates = isset( $where_to_save['resources_in_dates'] ) && is_array( $where_to_save['resources_in_dates'] )
			? $where_to_save['resources_in_dates']
			: array();
		$approved = isset( $apply_context['date_rows'][0]['approved'] ) && ! empty( $apply_context['date_rows'][0]['approved'] ) ? 1 : 0;
		$rows     = array();
		$dates    = array_keys( $resources_in_dates );
		$quantity = $this->get_booking_quantity( $apply_context['date_rows'] );

		if ( empty( $dates ) || count( $dates ) !== count( $proposal['selected_dates'] ) || $dates !== $proposal['selected_dates'] ) {
			return $this->get_apply_unavailable_error();
		}
		foreach ( $dates as $date_index => $booking_date ) {
			$date_resources = array_values( array_filter( array_map( 'absint', (array) $resources_in_dates[ $booking_date ] ) ) );
			if ( count( $date_resources ) < $quantity ) {
				return $this->get_apply_unavailable_error();
			}
			for ( $quantity_index = 0; $quantity_index < $quantity; $quantity_index++ ) {
				$effective_resource_id = $date_resources[ $quantity_index ];
				$type_id               = $effective_resource_id === $primary_resource_id ? null : $effective_resource_id;
				foreach ( $this->build_date_boundaries( $proposal, $booking_date, $date_index, count( $dates ) ) as $date_boundary ) {
					$rows[] = array(
						'booking_date' => $booking_date . ' ' . $date_boundary,
						'approved'     => $approved,
						'type_id'      => $type_id,
					);
				}
			}
		}

		return $rows;
	}

	/**
	 * Build the established 00/01/02 storage boundaries for one selected date.
	 *
	 * @param array<string,mixed> $proposal    Normalized proposal.
	 * @param string              $booking_date ISO date.
	 * @param int                 $date_index  Zero-based selected-date index.
	 * @param int                 $date_count  Total selected dates.
	 *
	 * @return array<int,string> One or two canonical `HH:MM:SS` boundaries.
	 */
	private function build_date_boundaries( $proposal, $booking_date, $date_index, $date_count ) {
		unset( $booking_date );
		if ( 'full_day' === $proposal['time_application'] ) {
			return array( '00:00:00' );
		}
		$start_boundary = $proposal['start_time'] . ':01';
		$end_boundary   = $proposal['end_time'] . ':02';
		if ( 'per_date' === $proposal['time_application'] || 1 === $date_count ) {
			return array( $start_boundary, $end_boundary );
		}
		if ( 0 === $date_index ) {
			return array( $start_boundary );
		}
		if ( $date_count - 1 === $date_index ) {
			return array( $end_boundary );
		}

		return array( '00:00:00' );
	}

	/**
	 * Return the capacity quantity represented by the current canonical rows.
	 *
	 * @param array<int,array<string,mixed>> $date_rows Current canonical date rows.
	 *
	 * @return int Positive capacity quantity.
	 */
	private function get_booking_quantity( $date_rows ) {
		$resources_by_date = array();
		foreach ( (array) $date_rows as $date_row ) {
			if ( ! is_array( $date_row ) || empty( $date_row['booking_date'] ) ) {
				continue;
			}
			$date_key    = substr( (string) $date_row['booking_date'], 0, 10 );
			$resource_id = isset( $date_row['resource_id'] ) ? absint( $date_row['resource_id'] ) : 0;
			if ( $resource_id ) {
				$resources_by_date[ $date_key ][ $resource_id ] = true;
			}
		}

		$quantity = 1;
		foreach ( $resources_by_date as $resource_ids ) {
			$quantity = max( $quantity, count( $resource_ids ) );
		}

		return $quantity;
	}

	/**
	 * Determine whether a reviewed proposal is already the canonical saved value.
	 *
	 * @param array<string,mixed> $proposal Reviewed proposal.
	 * @param array<string,mixed> $saved    Fresh saved projection.
	 *
	 * @return bool True when persistence is unnecessary.
	 */
	private function proposal_matches_saved( $proposal, $saved ) {
		/*
		 * The selection method controls validation only; it is not part of the
		 * canonical booking-date storage shape. Changing only that control must
		 * therefore remain a non-mutating apply.
		 */
		$keys = array( 'time_application', 'start_time', 'end_time', 'selected_dates' );
		foreach ( $keys as $key ) {
			if ( ! array_key_exists( $key, $saved ) || $proposal[ $key ] !== $saved[ $key ] ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Build the derived booking sort boundary without changing other fields.
	 *
	 * @param array<string,mixed> $proposal Normalized proposal.
	 *
	 * @return string Canonical SQL datetime.
	 */
	private function build_sort_date( $proposal ) {
		$first_date = reset( $proposal['selected_dates'] );
		$first_time = 'full_day' === $proposal['time_application'] ? '00:00:00' : $proposal['start_time'] . ':01';

		return $first_date . ' ' . $first_time;
	}

	/**
	 * Run released post-save hooks with the current operation notification intent.
	 *
	 * @param array<string,mixed> $apply_context Fresh authoritative apply context.
	 * @param bool                $send_modified_email Whether this operation requested the Modified email.
	 *
	 * @return void
	 */
	private function run_compatibility_hooks( $apply_context, $send_modified_email ) {
		$proposal       = $apply_context['proposal'];
		$booking_id     = absint( $apply_context['booking']['booking_id'] );
		$resource_id    = absint( $apply_context['resource_id'] );
		$time_boundaries = 'full_day' === $proposal['time_application']
			? array( '00:00:00', '24:00:00' )
			: array( $proposal['start_time'] . ':01', $proposal['end_time'] . ':02' );
		$create_params = array(
			'resource_id'                   => $resource_id,
			'dates_only_sql_arr'            => $proposal['selected_dates'],
			'time_as_his_arr'               => $time_boundaries,
			'is_from_admin_panel'           => true,
			'is_edit_booking'               => $booking_id,
			'is_duplicate_booking'          => 0,
			'is_approve_booking'            => ! empty( $apply_context['date_rows'][0]['approved'] ) ? 1 : 0,
			'how_many_items_to_book'        => $this->get_booking_quantity( $apply_context['date_rows'] ),
			'is_use_booking_recurrent_time' => 'per_date' === $proposal['time_application'],
			'is_emails_send'                => $send_modified_email ? 1 : 0,
			'activity_payload'              => array(
				'fields' => array( 'booking_dates' ),
				'change_set' => array(
					'version'       => 1,
					'total_changes' => 1,
					'changes'      => array(
						array(
							'field_key'   => 'booking_dates',
							'label'       => __( 'Booking dates', 'booking' ),
							'value_policy' => 'exact_value',
							'before'      => $apply_context['saved'],
							'after'       => $proposal,
						),
					),
				),
			),
		);

		do_action( 'wpbc_booking_after_save', $booking_id, $create_params, $apply_context['where_to_save'] );
	}

	/**
	 * Return the canonical browser-safe values proven by the locked apply.
	 *
	 * This Step 7 result deliberately has no second fallible post-commit read.
	 * Step 8 owns Inspector readback and host refresh. A successful database
	 * commit must not be reported as a failed apply merely because a later UI
	 * refresh is unavailable.
	 *
	 * @param array<string,mixed> $apply_context Fresh authoritative apply context.
	 * @param bool                $changed       Whether canonical rows changed.
	 * @param bool                $notifications_sent Whether the established Modified sender reported success.
	 *
	 * @return array<string,mixed> Canonical persisted-date projection.
	 */
	private function build_canonical_result( $apply_context, $changed, $notifications_sent ) {
		$canonical        = $changed ? $apply_context['proposal'] : $apply_context['saved'];
		$time_application = $canonical['time_application'];
		if ( 'boundary' === $time_application && 1 === count( $canonical['selected_dates'] ) ) {
			// One timed date is stored as one repeated-per-date interval shape.
			$time_application = 'per_date';
		}

		return array(
			'changed'            => (bool) $changed,
			'booking_id'         => absint( $apply_context['booking']['booking_id'] ),
			'resource_id'        => absint( $apply_context['resource_id'] ),
			'notifications_sent' => (bool) $notifications_sent,
			'canonical'          => array(
				'time_application' => $time_application,
				'start_time'       => $canonical['start_time'],
				'end_time'         => $canonical['end_time'],
				'selected_dates'   => $canonical['selected_dates'],
			),
		);
	}

	/**
	 * Return a safe apply-unavailable error.
	 *
	 * @return WP_Error Safe error.
	 */
	private function get_apply_unavailable_error() {
		return new WP_Error(
			'wpbc_booking_date_editor_apply_unavailable',
			__( 'The booking date changes could not be applied. Reload the dates and try again.', 'booking' ),
			array( 'status' => 409 )
		);
	}
}
