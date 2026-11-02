<?php
/**
 * Timeline boundary for reviewed Availability range mutations.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reauthorize a signed Timeline plan before delegating to Availability.
 */
final class WPBC_Timeline_Block_Service {

	/** @var WPBC_Timeline_Authorization Authorization service. */
	private $authorization;

	/** @var WPBC_Timeline_Resource_Repository Resource repository. */
	private $resource_repository;

	/** @var WPBC_Timeline_Handoff Signed-plan service. */
	private $handoff;

	/** @var WPBC_Availability_Range_Mutation_Service Availability mutation service. */
	private $availability_service;

	/**
	 * Construct the Timeline mutation boundary with optional test doubles.
	 *
	 * @param WPBC_Timeline_Authorization|null              $authorization        Authorization service.
	 * @param WPBC_Timeline_Resource_Repository|null        $resource_repository  Resource repository.
	 * @param WPBC_Timeline_Handoff|null                    $handoff              Signed-plan service.
	 * @param WPBC_Availability_Range_Mutation_Service|null $availability_service Availability service.
	 */
	public function __construct( $authorization = null, $resource_repository = null, $handoff = null, $availability_service = null ) {
		$this->authorization        = $authorization ? $authorization : new WPBC_Timeline_Authorization();
		$this->resource_repository  = $resource_repository ? $resource_repository : new WPBC_Timeline_Resource_Repository();
		$this->handoff              = $handoff ? $handoff : new WPBC_Timeline_Handoff();
		$this->availability_service = $availability_service ? $availability_service : new WPBC_Availability_Range_Mutation_Service();
	}

	/**
	 * Apply a signed plan after capability, ownership, and context revalidation.
	 *
	 * Booking rows are never mutation inputs. The Availability-owned service
	 * changes only explicit full-date state or manual timed intervals.
	 *
	 * @param mixed $token Candidate signed plan.
	 * @param mixed $mode  Either `block` or `unblock`.
	 *
	 * @return array<string,mixed>|WP_Error Mutation result or safe error.
	 */
	public function apply( $token, $mode ) {
		if ( ! $this->authorization->current_user_can_manage_availability() ) {
			return new WP_Error( 'wpbc_timeline_block_forbidden', __( 'You do not have permission to change Availability.', 'booking' ), array( 'status' => 403 ) );
		}

		$mode = is_scalar( $mode ) ? sanitize_key( (string) $mode ) : '';
		if ( ! in_array( $mode, array( 'block', 'unblock' ), true ) ) {
			return new WP_Error( 'wpbc_timeline_block_mode_invalid', __( 'Choose whether to block or unblock this range.', 'booking' ), array( 'status' => 400 ) );
		}

		$plan = $this->handoff->verify_token( $token, 'availability_block' );
		if ( is_wp_error( $plan ) ) {
			return $plan;
		}

		$resource_id = absint( isset( $plan['resource_id'] ) ? $plan['resource_id'] : 0 );
		$resources   = $this->resource_repository->get_authorized_resources_by_ids( array( $resource_id ) );
		if ( is_wp_error( $resources ) ) {
			return $resources;
		}
		if ( ! $resource_id || 1 !== count( $resources ) ) {
			return new WP_Error( 'wpbc_timeline_resource_not_found', __( 'The requested Booking Resource was not found.', 'booking' ), array( 'status' => 404 ) );
		}

		$timezone = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		try {
			$start = ( new DateTimeImmutable( (string) $plan['start_at'] ) )->setTimezone( $timezone );
			$end   = ( new DateTimeImmutable( (string) $plan['end_at'] ) )->setTimezone( $timezone );
		} catch ( Exception $exception ) {
			return new WP_Error( 'wpbc_timeline_block_range_invalid', __( 'The reviewed Availability range is invalid.', 'booking' ), array( 'status' => 400 ) );
		}
		if ( $start >= $end ) {
			return new WP_Error(
				'wpbc_timeline_block_range_invalid',
				__( 'The reviewed Availability end must be later than its start.', 'booking' ),
				array( 'status' => 400 )
			);
		}

		$result = $this->availability_service->apply( $resource_id, $start, $end, $mode, ! empty( $plan['is_full_day'] ) );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return array(
			'resource_id'        => $resource_id,
			'mode'               => $mode,
			'is_full_day'        => ! empty( $plan['is_full_day'] ),
			'changed_dates'      => absint( isset( $result['changed_dates'] ) ? $result['changed_dates'] : 0 ),
			'changed_intervals'  => absint( isset( $result['changed_intervals'] ) ? $result['changed_intervals'] : 0 ),
			'bookings_preserved' => true,
		);
	}
}
