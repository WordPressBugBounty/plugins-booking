<?php
/**
 * Authorized Timeline Resource-selector read service.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Orchestrate one authorized, group-safe, data-only selector read.
 */
final class WPBC_Timeline_Resource_Selector_Read_Service {

	/** @var WPBC_Timeline_Authorization Timeline read authorization. */
	private $authorization;

	/** @var WPBC_Timeline_Resource_Selector_Request_Validator Request validator. */
	private $validator;

	/** @var WPBC_Timeline_Resource_Repository Resource domain repository. */
	private $resource_repository;

	/** @var WPBC_Timeline_Resource_Selector_DTO_Mapper Selector DTO mapper. */
	private $dto_mapper;

	/** @var WPBC_Timeline_Resource_View_Preferences Current-user view preferences. */
	private $view_preferences;

	/** @var callable|null Optional deterministic query counter for tests. */
	private $query_count_callback;

	/**
	 * Construct the read service.
	 *
	 * @param WPBC_Timeline_Authorization|null                         $authorization       Optional authorization service.
	 * @param WPBC_Timeline_Resource_Selector_Request_Validator|null  $validator           Optional request validator.
	 * @param WPBC_Timeline_Resource_Repository|null                   $resource_repository Optional Resource repository.
	 * @param WPBC_Timeline_Resource_Selector_DTO_Mapper|null          $dto_mapper          Optional selector mapper.
	 * @param WPBC_Timeline_Resource_View_Preferences|null             $view_preferences    Optional view preferences.
	 * @param callable|null                                            $query_count_callback Optional absolute query counter.
	 */
	public function __construct(
		$authorization = null,
		$validator = null,
		$resource_repository = null,
		$dto_mapper = null,
		$view_preferences = null,
		$query_count_callback = null
	) {
		$this->authorization        = $authorization ? $authorization : new WPBC_Timeline_Authorization();
		$this->validator            = $validator ? $validator : new WPBC_Timeline_Resource_Selector_Request_Validator();
		$this->resource_repository  = $resource_repository ? $resource_repository : new WPBC_Timeline_Resource_Repository();
		$this->dto_mapper           = $dto_mapper ? $dto_mapper : new WPBC_Timeline_Resource_Selector_DTO_Mapper();
		$this->view_preferences     = $view_preferences ? $view_preferences : new WPBC_Timeline_Resource_View_Preferences();
		$this->query_count_callback = is_callable( $query_count_callback ) ? $query_count_callback : null;
	}

	/**
	 * Read one independent Resource-selector page.
	 *
	 * Authorization runs before validation or repository access. The repository
	 * is called exactly once and remains the sole owner of prepared SQL,
	 * MultiUser filtering, search, group-safe pagination, and row budgets.
	 *
	 * @param mixed $request_values Untrusted selector request.
	 *
	 * @return array<string,mixed>|WP_Error Selector DTO or safe error.
	 */
	public function read( $request_values ) {
		if ( ! $this->authorization->current_user_can_view() ) {
			return new WP_Error(
				'wpbc_timeline_resource_selector_forbidden',
				__( 'Timeline booking Resources are unavailable for this account.', 'booking' ),
				array( 'status' => 403 )
			);
		}

		$query = $this->validator->validate( $request_values );
		if ( is_wp_error( $query ) ) {
			return $query;
		}

		$query_start   = $this->get_absolute_query_count();
		$resource_page = $this->resource_repository->get_resource_page( $query );
		if ( is_wp_error( $resource_page ) ) {
			return $resource_page;
		}
		$resource_rows    = isset( $resource_page['resources'] ) && is_array( $resource_page['resources'] ) ? $resource_page['resources'] : array();
		$maximum_resources = absint( wpbc_timeline_get_configuration()['limits']['maximum_resources'] );
		if ( count( $resource_rows ) > $maximum_resources ) {
			return new WP_Error(
				'wpbc_timeline_resource_budget_exceeded',
				__( 'This Timeline Resource page contains too many parent and child rows. Choose fewer Resource groups.', 'booking' ),
				array(
					'status'              => 400,
					'maximum_resources'   => $maximum_resources,
					'suggested_resources' => WPBC_Timeline_Resource_View_Preferences::DEFAULT_PAGE_SIZE,
				)
			);
		}
		$record          = $this->view_preferences->get_record();
		$query_count     = max( 0, $this->get_absolute_query_count() - $query_start );
		$maximum_queries = absint( wpbc_timeline_get_configuration()['limits']['maximum_resource_selector_queries'] );
		if ( $query_count > $maximum_queries ) {
			return new WP_Error(
				'wpbc_timeline_resource_selector_query_budget_exceeded',
				__( 'Booking Resources could not be loaded within the safe query limit.', 'booking' ),
				array(
					'status'          => 400,
					'query_count'     => $query_count,
					'maximum_queries' => $maximum_queries,
				)
			);
		}

		$resource_view = isset( $record['resource_view'] ) && is_array( $record['resource_view'] )
			? $record['resource_view']
			: array();
		return $this->dto_mapper->map_page( $resource_page, $resource_view, $query['search'] );
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
