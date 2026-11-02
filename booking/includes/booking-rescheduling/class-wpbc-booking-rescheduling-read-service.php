<?php
/**
 * Booking Rescheduling accessible-dialog initialization service.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build an authorized, non-mutating rescheduling dialog DTO.
 */
final class WPBC_Booking_Rescheduling_Read_Service {

	/** @var WPBC_Booking_Rescheduling_Read_Request_Validator Read validator. */
	private $request_validator;

	/** @var WPBC_Booking_Rescheduling_Authorization Authorization boundary. */
	private $authorization;

	/** @var WPBC_Booking_Rescheduling_Repository Domain repository. */
	private $repository;

	/** @var WPBC_Booking_Rescheduling_Shape_Classifier Saved-shape classifier. */
	private $shape_classifier;

	/** @var WPBC_Booking_Rescheduling_Source_Context Source-token service. */
	private $source_context;

	/** @var WPBC_Booking_Date_Editor_Read_Service Native calendar contract service. */
	private $date_editor_read_service;

	/**
	 * Construct the read service with replaceable focused dependencies.
	 *
	 * @param WPBC_Booking_Rescheduling_Read_Request_Validator|null $request_validator        Optional validator.
	 * @param WPBC_Booking_Rescheduling_Authorization|null          $authorization           Optional authorization service.
	 * @param WPBC_Booking_Rescheduling_Repository|null             $repository              Optional repository.
	 * @param WPBC_Booking_Rescheduling_Shape_Classifier|null       $shape_classifier        Optional classifier.
	 * @param WPBC_Booking_Rescheduling_Source_Context|null         $source_context          Optional source-token service.
	 * @param WPBC_Booking_Date_Editor_Read_Service|null            $date_editor_read_service Optional native calendar service.
	 */
	public function __construct(
		$request_validator = null,
		$authorization = null,
		$repository = null,
		$shape_classifier = null,
		$source_context = null,
		$date_editor_read_service = null
	) {
		$this->request_validator        = $request_validator ? $request_validator : new WPBC_Booking_Rescheduling_Read_Request_Validator();
		$this->authorization            = $authorization ? $authorization : new WPBC_Booking_Rescheduling_Authorization();
		$this->repository               = $repository ? $repository : new WPBC_Booking_Rescheduling_Repository();
		$this->shape_classifier         = $shape_classifier ? $shape_classifier : new WPBC_Booking_Rescheduling_Shape_Classifier();
		$this->source_context           = $source_context ? $source_context : new WPBC_Booking_Rescheduling_Source_Context();
		$this->date_editor_read_service = $date_editor_read_service ? $date_editor_read_service : new WPBC_Booking_Date_Editor_Read_Service();
	}

	/**
	 * Return the complete authorized dialog initialization contract.
	 *
	 * This service does not mutate booking, date, Activity, cache, or option
	 * storage. The native calendar contract deliberately excludes availability;
	 * the established calendar loader obtains it after the browser mounts the
	 * shared adapter.
	 *
	 * @param mixed $request_values Untrusted endpoint values.
	 *
	 * @return array<string,mixed>|WP_Error Data-only dialog DTO or safe error.
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

		$booking     = $authorization_context['booking'];
		$date_rows   = $this->repository->get_booking_dates( $booking );
		$current_resource_id = isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0;
		if ( is_wp_error( $date_rows ) ) {
			return $date_rows;
		}
		if ( '' !== $request['source_context_token'] ) {
			$source_check = $this->source_context->verify(
				$request['source_context_token'],
				$booking,
				$date_rows,
				$request['source'],
				$authorization_context['effective_resource_ids']
			);
			if ( is_wp_error( $source_check ) ) {
				return $source_check;
			}
		}

		$appointment_snapshot = $this->repository->get_appointment_snapshot( $request['booking_id'] );
		$shape_context        = $this->shape_classifier->classify(
			$date_rows,
			$authorization_context['effective_resource_ids'],
			$appointment_snapshot
		);
		if ( is_wp_error( $shape_context ) ) {
			return array(
				'rescheduling' => array(
					'schema_version' => WPBC_Booking_Rescheduling_Proposal_Contract::SCHEMA_VERSION,
					'booking_id'     => absint( $request['booking_id'] ),
					'supported'      => false,
					'reason'         => sanitize_key( $shape_context->get_error_code() ),
				),
			);
		}

		$can_change_resource = in_array( 'change_resource', $shape_context['allowed_operations'], true )
			&& $this->authorization->can_change_resource();
		$resource_options    = $this->repository->get_target_resource_options( $current_resource_id, $can_change_resource );
		if ( is_wp_error( $resource_options ) ) {
			return $resource_options;
		}

		$target_resource_id = $request['target_resource_id'] ? absint( $request['target_resource_id'] ) : $current_resource_id;
		$allowed_target_ids = wp_list_pluck( $resource_options, 'value' );
		$allowed_target_ids = array_values( array_unique( array_filter( array_map( 'absint', $allowed_target_ids ) ) ) );
		if ( ! in_array( $target_resource_id, $allowed_target_ids, true ) ) {
			return new WP_Error(
				'wpbc_booking_rescheduling_target_unauthorized',
				__( 'The requested Booking Resource is unavailable for this account.', 'booking' ),
				array( 'status' => 403 )
			);
		}

		$resource_check = $this->authorization->authorize_resources( array( $target_resource_id ) );
		if ( is_wp_error( $resource_check ) ) {
			return $resource_check;
		}
		if ( $target_resource_id !== $current_resource_id ) {
			$operation_check = $this->authorization->authorize_operation( 'change_resource' );
			if ( is_wp_error( $operation_check ) ) {
				return $operation_check;
			}
		}
		if ( ! $target_resource_id || ! function_exists( 'wpbc_pre_get_calendar_html' ) ) {
			return new WP_Error(
				'wpbc_booking_rescheduling_calendar_unavailable',
				__( 'The booking calendar could not be loaded. Reload the page and try again.', 'booking' ),
				array( 'status' => 500 )
			);
		}

		$saved          = $shape_context['saved'];
		$booking_hash   = isset( $booking['hash'] ) ? sanitize_text_field( (string) $booking['hash'] ) : '';
		$calendar       = $this->date_editor_read_service->build_native_calendar_contract(
			$target_resource_id,
			$booking_hash,
			$this->repository->get_custom_form_key( $booking ),
			$saved['selected_dates']
		);
		$source_token   = $this->source_context->issue(
			$booking,
			$date_rows,
			$request['source'],
			$authorization_context['effective_resource_ids']
		);
		$site_timezone  = function_exists( 'wp_timezone_string' ) ? wp_timezone_string() : '';
		if ( '' === $site_timezone && function_exists( 'wp_timezone' ) ) {
			$site_timezone = wp_timezone()->getName();
		}

		return array(
			'rescheduling' => array(
				'schema_version'       => WPBC_Booking_Rescheduling_Proposal_Contract::SCHEMA_VERSION,
				'booking_id'           => absint( $request['booking_id'] ),
				'supported'            => true,
				'saved_shape'          => sanitize_key( $shape_context['shape'] ),
				'allowed_operations'   => array_values( $shape_context['allowed_operations'] ),
				'current_resource_id'  => $current_resource_id,
				'target_resource_id'   => $target_resource_id,
				'source_context_token' => $source_token,
				'proposal_revision'    => 1,
				'timezone'             => array(
					'name' => sanitize_text_field( (string) $site_timezone ),
				),
				'initial'              => array(
					'selection_method' => $saved['selection_method'],
					'time_application' => $saved['time_application'],
					'start_time'       => $saved['start_time'],
					'end_time'         => $saved['end_time'],
					'selected_dates'   => array_values( $saved['selected_dates'] ),
					'target_resource_id' => $current_resource_id,
				),
				'choices'              => array(
					'resources'         => $resource_options,
					'selection_methods' => array( 'policy', 'individual' ),
					'time_applications' => array( 'full_day', 'boundary', 'per_date' ),
				),
				'saved_rows'           => array_values( $saved['saved_rows'] ),
				'calendar'             => $calendar,
			),
		);
	}
}
