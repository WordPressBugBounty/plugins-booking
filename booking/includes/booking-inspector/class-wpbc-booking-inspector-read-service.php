<?php
/**
 * Authorized Booking Inspector read orchestration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Coordinate validation, authorization, repositories, and DTO mapping.
 */
final class WPBC_Booking_Inspector_Read_Service {

	/** @var WPBC_Booking_Inspector_Authorization Authorization service. */
	private $authorization;

	/** @var WPBC_Booking_Inspector_Request_Validator Request validator. */
	private $validator;

	/** @var WPBC_Booking_Inspector_Activity_Repository Activity repository. */
	private $activity_repository;

	/** @var WPBC_Booking_Inspector_DTO_Mapper DTO mapper. */
	private $dto_mapper;

	/** @var WPBC_Booking_Inspector_Date_Repository Canonical date repository. */
	private $date_repository;

	/** @var WPBC_Booking_Notes_Service Canonical notes service. */
	private $notes_service;

	/** @var WPBC_Booking_Inspector_Resource_Repository Resource action-choice repository. */
	private $resource_repository;

	/**
	 * Construct the read service with replaceable focused dependencies.
	 *
	 * @param WPBC_Booking_Inspector_Authorization|null        $authorization        Optional authorization service.
	 * @param WPBC_Booking_Inspector_Request_Validator|null    $validator            Optional validator.
	 * @param WPBC_Booking_Inspector_Activity_Repository|null  $activity_repository  Optional activity repository.
	 * @param WPBC_Booking_Inspector_DTO_Mapper|null           $dto_mapper            Optional DTO mapper.
	 * @param WPBC_Booking_Inspector_Date_Repository|null      $date_repository       Optional date repository.
	 * @param WPBC_Booking_Notes_Service|null                  $notes_service         Optional notes service.
	 * @param WPBC_Booking_Inspector_Resource_Repository|null  $resource_repository   Optional Resource repository.
	 */
	public function __construct(
		$authorization = null,
		$validator = null,
		$activity_repository = null,
		$dto_mapper = null,
		$date_repository = null,
		$notes_service = null,
		$resource_repository = null
	) {
		$this->authorization       = $authorization ? $authorization : new WPBC_Booking_Inspector_Authorization();
		$this->validator           = $validator ? $validator : new WPBC_Booking_Inspector_Request_Validator();
		$this->activity_repository = $activity_repository ? $activity_repository : new WPBC_Booking_Inspector_Activity_Repository();
		$this->dto_mapper          = $dto_mapper ? $dto_mapper : new WPBC_Booking_Inspector_DTO_Mapper();
		$this->date_repository     = $date_repository ? $date_repository : new WPBC_Booking_Inspector_Date_Repository();
		$this->notes_service       = $notes_service ? $notes_service : new WPBC_Booking_Notes_Service();
		$this->resource_repository = $resource_repository ? $resource_repository : new WPBC_Booking_Inspector_Resource_Repository();
	}

	/**
	 * Return one authorized booking details DTO.
	 *
	 * Foreign and missing records deliberately produce the same safe error.
	 *
	 * @param mixed $request_values Untrusted request values.
	 *
	 * @return array<string,mixed>|WP_Error Data-only response or safe error.
	 */
	public function read( $request_values ) {
		$request = $this->validator->normalize( $request_values );
		if ( is_wp_error( $request ) ) {
			return $request;
		}

		$authorization_context = $this->authorization->authorize_booking( $request['booking_id'], $request['source'] );
		if ( is_wp_error( $authorization_context ) ) {
			return $authorization_context;
		}
		$booking = $authorization_context['booking'];

		$activity = $this->activity_repository->get_booking_activity( $request['booking_id'] );
		if ( is_wp_error( $activity ) ) {
			return $activity;
		}
		$date_rows = $this->date_repository->get_booking_dates(
			$request['booking_id'],
			isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0
		);
		if ( is_wp_error( $date_rows ) ) {
			return $date_rows;
		}
		$notes = $this->notes_service->get_booking_notes(
			$request['booking_id'],
			class_exists( 'wpdev_bk_personal' )
		);
		if ( is_wp_error( $notes ) || null === $notes ) {
			return is_wp_error( $notes ) ? $notes : $this->authorization->get_not_found_error();
		}
		$action_resource_options = array();
		$current_user_id         = function_exists( 'wpbc_get_current_user_id' )
			? wpbc_get_current_user_id()
			: ( function_exists( 'get_current_user_id' ) ? get_current_user_id() : 0 );
		$can_change_resource     = function_exists( 'wpbc_is_user_can' ) && wpbc_is_user_can( 'change_booking_resource', $current_user_id );
		$can_duplicate_booking   = function_exists( 'wpbc_is_user_can' ) && wpbc_is_user_can( 'duplicate_booking_to_other_resource', $current_user_id );
		if ( class_exists( 'wpdev_bk_personal' ) && ( $can_change_resource || $can_duplicate_booking ) ) {
			$action_resource_options = $this->resource_repository->get_action_resource_options();
			if ( is_wp_error( $action_resource_options ) ) {
				return $action_resource_options;
			}
		}

		$booking_dto = $this->dto_mapper->map_booking(
				$booking,
				$activity,
				$date_rows,
				$authorization_context['effective_resource_ids'],
				$notes,
				$action_resource_options
			);
		if ( is_wp_error( $booking_dto ) ) {
			return $booking_dto;
		}
		$can_reschedule = class_exists( 'WPBC_Booking_Rescheduling_Source_Context' )
			&& function_exists( 'wpbc_is_user_can' )
			&& wpbc_is_user_can( 'edit_booking', $current_user_id );
		if ( $can_reschedule ) {
			$booking_dto['rescheduling'] = array(
				'source_context_token' => ( new WPBC_Booking_Rescheduling_Source_Context() )->issue(
					$booking,
					$date_rows,
					$request['source'],
					$authorization_context['effective_resource_ids']
				),
			);
		}

		return array(
			'booking' => $booking_dto,
		);
	}
}
