<?php
/**
 * Booking Inspector authorization boundary.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve one reusable, host-independent booking authorization context.
 */
final class WPBC_Booking_Inspector_Authorization {

	/** @var WPBC_Booking_Inspector_Repository Booking repository. */
	private $booking_repository;

	/** @var WPBC_Booking_Inspector_Resource_Repository Resource repository. */
	private $resource_repository;

	/**
	 * Construct the authorization service with focused repositories.
	 *
	 * @param WPBC_Booking_Inspector_Repository|null          $booking_repository  Optional booking repository.
	 * @param WPBC_Booking_Inspector_Resource_Repository|null $resource_repository Optional Resource repository.
	 */
	public function __construct( $booking_repository = null, $resource_repository = null ) {
		$this->booking_repository  = $booking_repository ? $booking_repository : new WPBC_Booking_Inspector_Repository();
		$this->resource_repository = $resource_repository ? $resource_repository : new WPBC_Booking_Inspector_Resource_Repository();
	}

	/**
	 * Determine whether the current user may inspect owned bookings.
	 *
	 * @return bool True when the read boundary is authorized.
	 */
	public function current_user_can_read() {
		$role_capabilities = array(
			'administrator' => 'activate_plugins',
			'editor'        => 'publish_pages',
			'author'        => 'publish_posts',
			'contributor'   => 'edit_posts',
			'subscriber'    => 'read',
		);
		$minimum_role = function_exists( 'get_bk_option' ) ? sanitize_key( (string) get_bk_option( 'booking_user_role_booking' ) ) : 'editor';
		$minimum_role = isset( $role_capabilities[ $minimum_role ] ) ? $minimum_role : 'editor';

		if ( function_exists( 'wpbc_is_current_user_have_this_role' ) ) {
			$has_capability = (bool) wpbc_is_current_user_have_this_role( $minimum_role );
		} else {
			$has_capability = current_user_can( $role_capabilities[ $minimum_role ] );
		}

		if ( ! $has_capability ) {
			return false;
		}

		return ! function_exists( 'wpbc_is_mu_user_can_be_here' ) || wpbc_is_mu_user_can_be_here( 'activated_user' );
	}

	/**
	 * Resolve and authorize one booking for any allow-listed Inspector host.
	 *
	 * Missing, trashed, foreign-owned, edition-invalid, and wrong-site records
	 * deliberately share one not-found result. The returned context is internal
	 * domain data and must be mapped before it reaches the browser.
	 *
	 * @param int    $booking_id       Requested booking ID.
	 * @param string $source_identifier Allow-listed Inspector host identifier.
	 *
	 * @return array<string,mixed>|WP_Error Authorized context or safe error.
	 */
	public function authorize_booking( $booking_id, $source_identifier ) {
		$booking_id        = absint( $booking_id );
		$source_identifier = is_scalar( $source_identifier ) ? sanitize_key( (string) $source_identifier ) : '';

		if ( ! WPBC_Booking_Inspector_Config::is_allowed_source( $source_identifier ) ) {
			return new WP_Error(
				'wpbc_booking_inspector_request_invalid',
				__( 'The booking details request is invalid.', 'booking' ),
				array( 'status' => 400 )
			);
		}

		if ( ! $booking_id || ! $this->current_user_can_read() ) {
			return new WP_Error(
				'wpbc_booking_inspector_unauthorized',
				__( 'Booking details are unavailable for this account.', 'booking' ),
				array( 'status' => 403 )
			);
		}

		$booking = $this->booking_repository->get_booking( $booking_id );
		if ( is_wp_error( $booking ) ) {
			return $booking;
		}
		if ( ! is_array( $booking ) ) {
			return $this->get_not_found_error();
		}

		$effective_resource_ids = isset( $booking['effective_resource_ids'] ) && is_array( $booking['effective_resource_ids'] )
			? array_values( array_unique( array_filter( array_map( 'absint', $booking['effective_resource_ids'] ) ) ) )
			: array();
		$authorized_resource_ids = $this->resource_repository->get_authorized_resource_ids( $effective_resource_ids );
		if ( is_wp_error( $authorized_resource_ids ) ) {
			return $authorized_resource_ids;
		}

		sort( $effective_resource_ids, SORT_NUMERIC );
		$authorized_resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $authorized_resource_ids ) ) ) );
		sort( $authorized_resource_ids, SORT_NUMERIC );
		if ( empty( $effective_resource_ids ) || $effective_resource_ids !== $authorized_resource_ids ) {
			return $this->get_not_found_error();
		}

		return array(
			'booking'               => $booking,
			'effective_resource_ids' => $effective_resource_ids,
			'source'                => $source_identifier,
			'site_id'               => function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0,
		);
	}

	/**
	 * Return the uniform missing/foreign/trash authorization result.
	 *
	 * @return WP_Error Safe not-found error.
	 */
	public function get_not_found_error() {
		return new WP_Error(
			'wpbc_booking_inspector_not_found',
			__( 'The requested booking could not be found.', 'booking' ),
			array( 'status' => 404 )
		);
	}
}
