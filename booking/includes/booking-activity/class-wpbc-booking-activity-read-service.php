<?php
/**
 * Booking activity read service.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Coordinate bounded activity reads and DTO mapping.
 */
final class WPBC_Booking_Activity_Read_Service {

	/** @var WPBC_Booking_Activity_Repository Activity repository. */
	private $repository;

	/** @var WPBC_Booking_Activity_DTO_Mapper DTO mapper. */
	private $dto_mapper;

	/**
	 * Construct the read service with optional collaborators.
	 *
	 * @param WPBC_Booking_Activity_Repository|null $repository Optional repository.
	 * @param WPBC_Booking_Activity_DTO_Mapper|null $dto_mapper Optional mapper.
	 */
	public function __construct( $repository = null, $dto_mapper = null ) {
		$this->repository = $repository ? $repository : new WPBC_Booking_Activity_Repository();
		$this->dto_mapper = $dto_mapper ? $dto_mapper : new WPBC_Booking_Activity_DTO_Mapper();
	}

	/**
	 * Return one mapped activity page for an already-authorized booking.
	 *
	 * @param int $booking_id Authorized booking ID.
	 * @param int $page       One-based page.
	 * @param int $per_page   Bounded page size.
	 *
	 * @return array<string,mixed>|WP_Error Mapped page or safe error.
	 */
	public function read( $booking_id, $page = 1, $per_page = 20 ) {
		$page     = max( 1, absint( $page ) );
		$per_page = min( 50, max( 1, absint( $per_page ) ) );
		if ( ! wpbc_booking_activity_table_exists() ) {
			return array(
				'events'     => array(),
				'pagination' => array( 'page' => $page, 'per_page' => $per_page, 'total_items' => 0, 'total_pages' => 0 ),
			);
		}

		$activity_page = $this->repository->get_booking_activity( absint( $booking_id ), $page, $per_page );
		if ( is_wp_error( $activity_page ) ) {
			return $activity_page;
		}

		return $this->dto_mapper->map_page( $activity_page );
	}
}
