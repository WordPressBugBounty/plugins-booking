<?php
/**
 * Booking Rescheduling authorization boundary.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Authorize bookings and target Resources for review and apply.
 */
final class WPBC_Booking_Rescheduling_Authorization {

	/** @var WPBC_Booking_Inspector_Authorization Canonical booking authorization. */
	private $booking_authorization;

	/** @var WPBC_Booking_Inspector_Resource_Repository Resource ownership repository. */
	private $resource_repository;

	/**
	 * Construct the boundary with focused dependencies.
	 *
	 * @param WPBC_Booking_Inspector_Authorization|null        $booking_authorization Optional booking authorization.
	 * @param WPBC_Booking_Inspector_Resource_Repository|null  $resource_repository   Optional Resource repository.
	 */
	public function __construct( $booking_authorization = null, $resource_repository = null ) {
		$this->booking_authorization = $booking_authorization ? $booking_authorization : new WPBC_Booking_Inspector_Authorization();
		$this->resource_repository   = $resource_repository ? $resource_repository : new WPBC_Booking_Inspector_Resource_Repository();
	}

	/**
	 * Authorize one editable booking using the established Inspector boundary.
	 *
	 * @param int    $booking_id Booking ID.
	 * @param string $source     Allow-listed Inspector host source.
	 *
	 * @return array<string,mixed>|WP_Error Authorized context or safe error.
	 */
	public function authorize_booking( $booking_id, $source ) {
		if ( ! $this->current_user_can_edit() ) {
			return new WP_Error(
				'wpbc_booking_rescheduling_unauthorized',
				__( 'Booking schedule changes are unavailable for this account.', 'booking' ),
				array( 'status' => 403 )
			);
		}

		return $this->booking_authorization->authorize_booking( $booking_id, $source );
	}

	/**
	 * Enforce operation-specific released capabilities and edition support.
	 *
	 * @param string $operation Normalized rescheduling operation.
	 *
	 * @return true|WP_Error True when permitted, otherwise safe error.
	 */
	public function authorize_operation( $operation ) {
		$operation = sanitize_key( $operation );
		if ( 'change_resource' !== $operation ) {
			return true;
		}

		if ( ! $this->can_change_resource() ) {
			return new WP_Error(
				'wpbc_booking_rescheduling_operation_unauthorized',
				__( 'Changing the Booking Resource is unavailable for this account or edition.', 'booking' ),
				array( 'status' => 403 )
			);
		}

		return true;
	}

	/**
	 * Determine whether the current edition and effective user may request a
	 * different primary Booking Resource.
	 *
	 * This is a presentation eligibility check only. Every requested target and
	 * every server-derived allocation is authorized again during Review and Apply.
	 *
	 * @return bool True when the released capability is available.
	 */
	public function can_change_resource() {
		$user_id = function_exists( 'wpbc_get_current_user_id' )
			? absint( wpbc_get_current_user_id() )
			: ( function_exists( 'get_current_user_id' ) ? absint( get_current_user_id() ) : 0 );

		return class_exists( 'wpdev_bk_personal' )
			&& function_exists( 'wpbc_is_user_can' )
			&& wpbc_is_user_can( 'change_booking_resource', $user_id );
	}

	/**
	 * Authorize every server-resolved requested or allocated Resource.
	 *
	 * @param array<int,int> $resource_ids Resource IDs derived by the server.
	 *
	 * @return true|WP_Error True when every Resource is authorized.
	 */
	public function authorize_resources( $resource_ids ) {
		$resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $resource_ids ) ) ) );
		sort( $resource_ids, SORT_NUMERIC );
		if ( empty( $resource_ids ) ) {
			return $this->get_target_error();
		}

		$authorized_ids = $this->resource_repository->get_authorized_resource_ids( $resource_ids );
		if ( is_wp_error( $authorized_ids ) ) {
			return $authorized_ids;
		}
		$authorized_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $authorized_ids ) ) ) );
		sort( $authorized_ids, SORT_NUMERIC );

		return $resource_ids === $authorized_ids ? true : $this->get_target_error();
	}

	/**
	 * Determine whether the effective current user can edit bookings.
	 *
	 * @return bool True when the released booking capability allows editing.
	 */
	private function current_user_can_edit() {
		$user_id = function_exists( 'wpbc_get_current_user_id' )
			? absint( wpbc_get_current_user_id() )
			: ( function_exists( 'get_current_user_id' ) ? absint( get_current_user_id() ) : 0 );

		return function_exists( 'wpbc_is_user_can' ) && wpbc_is_user_can( 'edit_booking', $user_id );
	}

	/**
	 * Return the uniform target-Resource error.
	 *
	 * @return WP_Error Safe authorization error.
	 */
	private function get_target_error() {
		return new WP_Error(
			'wpbc_booking_rescheduling_target_unauthorized',
			__( 'The requested Booking Resource is unavailable for this account.', 'booking' ),
			array( 'status' => 403 )
		);
	}
}
