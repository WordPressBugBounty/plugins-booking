<?php
/**
 * Authorized Timeline Resource selection-universe read service.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return the bounded authorized IDs needed to materialize an `all` draft.
 */
final class WPBC_Timeline_Resource_Selection_Read_Service {

	/** @var WPBC_Timeline_Authorization Timeline read authorization. */
	private $authorization;

	/** @var WPBC_Timeline_Resource_Repository Resource domain repository. */
	private $resource_repository;

	/** @var callable|null Optional deterministic query counter for tests. */
	private $query_count_callback;

	/**
	 * Construct the selection-universe read service.
	 *
	 * @param WPBC_Timeline_Authorization|null       $authorization       Optional authorization service.
	 * @param WPBC_Timeline_Resource_Repository|null $resource_repository Optional Resource repository.
	 * @param callable|null                          $query_count_callback Optional absolute query counter.
	 */
	public function __construct( $authorization = null, $resource_repository = null, $query_count_callback = null ) {
		$this->authorization        = $authorization ? $authorization : new WPBC_Timeline_Authorization();
		$this->resource_repository  = $resource_repository ? $resource_repository : new WPBC_Timeline_Resource_Repository();
		$this->query_count_callback = is_callable( $query_count_callback ) ? $query_count_callback : null;
	}

	/**
	 * Read the complete authorized ID set within the explicit-selection limit.
	 *
	 * The response is deliberately presentation-free. The save path remains
	 * authoritative and reloads every submitted exact ID before persistence.
	 *
	 * @return array<string,mixed>|WP_Error Selection DTO or a safe error.
	 */
	public function read() {
		if ( ! $this->authorization->current_user_can_view() ) {
			return new WP_Error(
				'wpbc_timeline_resource_selector_forbidden',
				__( 'Timeline booking Resources are unavailable for this account.', 'booking' ),
				array( 'status' => 403 )
			);
		}

		$maximum_selected = WPBC_Timeline_Resource_View_Preferences::MAXIMUM_SELECTED_RESOURCES;
		$query_start       = $this->get_absolute_query_count();
		$resource_ids      = $this->resource_repository->get_authorized_resource_ids( $maximum_selected + 1 );
		if ( is_wp_error( $resource_ids ) ) {
			return $resource_ids;
		}

		$query_count     = max( 0, $this->get_absolute_query_count() - $query_start );
		$maximum_queries = absint( wpbc_timeline_get_configuration()['limits']['maximum_resource_selector_queries'] );
		if ( $query_count > $maximum_queries ) {
			return new WP_Error(
				'wpbc_timeline_resource_selector_query_budget_exceeded',
				__( 'Booking Resources could not be loaded within the safe query limit.', 'booking' ),
				array( 'status' => 400 )
			);
		}

		$resource_ids = $this->normalize_resource_ids( $resource_ids );
		if ( is_wp_error( $resource_ids ) ) {
			return $resource_ids;
		}
		if ( count( $resource_ids ) > $maximum_selected ) {
			return new WP_Error(
				'wpbc_timeline_resource_selection_too_large',
				__( 'Select up to 500 booking Resources. Use Clear all before choosing a smaller set.', 'booking' ),
				array( 'status' => 400 )
			);
		}
		if ( empty( $resource_ids ) ) {
			return new WP_Error(
				'wpbc_timeline_resource_selection_empty',
				__( 'At least one booking Resource is required.', 'booking' ),
				array( 'status' => 422 )
			);
		}

		return array(
			'schema_version' => 1,
			'selection'      => array(
				'mode'         => WPBC_Timeline_Resource_View_Preferences::SELECTION_MODE_EXPLICIT,
				'resource_ids' => $resource_ids,
				'count'        => count( $resource_ids ),
			),
		);
	}

	/**
	 * Normalize the repository's ID-only result and fail closed on bad shapes.
	 *
	 * Numeric strings are accepted because WordPress database helpers return
	 * integer columns as strings. Other scalar and compound values are rejected.
	 *
	 * @param mixed $resource_ids Repository result.
	 *
	 * @return array<int,int>|WP_Error Unique positive IDs or a safe error.
	 */
	private function normalize_resource_ids( $resource_ids ) {
		if ( ! is_array( $resource_ids ) ) {
			return $this->get_unavailable_error();
		}

		$normalized_ids = array();
		foreach ( $resource_ids as $resource_id ) {
			if ( ! is_int( $resource_id ) && ( ! is_string( $resource_id ) || ! preg_match( '/^[1-9][0-9]*$/D', $resource_id ) ) ) {
				return $this->get_unavailable_error();
			}
			$resource_id = absint( $resource_id );
			if ( ! $resource_id ) {
				return $this->get_unavailable_error();
			}
			$normalized_ids[ $resource_id ] = $resource_id;
		}

		return array_values( $normalized_ids );
	}

	/**
	 * Return a non-enumerating selection read error.
	 *
	 * @return WP_Error Safe selection error.
	 */
	private function get_unavailable_error() {
		return new WP_Error(
			'wpbc_timeline_resource_selection_unavailable',
			__( 'The selected booking Resources are no longer available.', 'booking' ),
			array( 'status' => 404 )
		);
	}

	/**
	 * Return the absolute database query count.
	 *
	 * @return int Non-negative query count.
	 */
	private function get_absolute_query_count() {
		if ( $this->query_count_callback ) {
			return max( 0, absint( call_user_func( $this->query_count_callback ) ) );
		}

		global $wpdb;

		return isset( $wpdb->num_queries ) ? max( 0, absint( $wpdb->num_queries ) ) : 0;
	}
}
