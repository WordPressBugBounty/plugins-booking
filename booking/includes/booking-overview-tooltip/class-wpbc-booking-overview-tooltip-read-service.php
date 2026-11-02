<?php
/**
 * Authorized Booking Overview lazy read service.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Coordinate request validation, Inspector authorization, canonical reads, and mapping.
 */
final class WPBC_Booking_Overview_Tooltip_Read_Service {

	/** @var WPBC_Booking_Overview_Tooltip_Request_Validator Request validator. */
	private $validator;

	/** @var WPBC_Booking_Inspector_Authorization Canonical authorization service. */
	private $authorization;

	/** @var WPBC_Booking_Inspector_Date_Repository Canonical date repository. */
	private $date_repository;

	/** @var WPBC_Booking_Overview_Tooltip_Details_Mapper Bounded details mapper. */
	private $details_mapper;

	/**
	 * Construct the service with replaceable focused collaborators.
	 *
	 * @param WPBC_Booking_Overview_Tooltip_Request_Validator|null $validator       Optional validator.
	 * @param WPBC_Booking_Inspector_Authorization|null            $authorization   Optional authorization service.
	 * @param WPBC_Booking_Inspector_Date_Repository|null          $date_repository Optional date repository.
	 * @param WPBC_Booking_Overview_Tooltip_Details_Mapper|null    $details_mapper   Optional details mapper.
	 */
	public function __construct( $validator = null, $authorization = null, $date_repository = null, $details_mapper = null ) {
		$this->validator       = $validator ? $validator : new WPBC_Booking_Overview_Tooltip_Request_Validator();
		$this->authorization   = $authorization ? $authorization : new WPBC_Booking_Inspector_Authorization();
		$this->date_repository = $date_repository ? $date_repository : new WPBC_Booking_Inspector_Date_Repository();
		$this->details_mapper  = $details_mapper ? $details_mapper : new WPBC_Booking_Overview_Tooltip_Details_Mapper();
	}

	/**
	 * Return a bounded details DTO for one authorized booking.
	 *
	 * Missing and foreign bookings retain the Inspector authorization service's
	 * indistinguishable not-found result. No Inspector endpoint or full DTO is invoked.
	 *
	 * @param mixed $request_values Untrusted request values.
	 *
	 * @return array<string,mixed>|WP_Error Normalized response or safe error.
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
		$date_rows = $this->date_repository->get_booking_dates(
			$request['booking_id'],
			isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0
		);
		if ( is_wp_error( $date_rows ) ) {
			return $date_rows;
		}
		$overview = $this->details_mapper->map_details(
			$booking,
			$date_rows,
			$authorization_context['effective_resource_ids']
		);
		if ( is_wp_error( $overview ) ) {
			return $overview;
		}

		return array( 'overview' => $overview );
	}
}
