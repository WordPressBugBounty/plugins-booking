<?php
/**
 * Booking Resources provider for the shared catalog response contract.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Coordinate validated requests, the independent repository, and Resource DTOs.
 */
final class WPBC_Catalog_Booking_Resources_Provider implements WPBC_UI_Catalog_Provider {

	/**
	 * Independent Resource repository.
	 *
	 * @var WPBC_Catalog_Booking_Resources_Repository
	 */
	private $repository;

	/**
	 * Stable Resource DTO mapper.
	 *
	 * @var WPBC_Catalog_Booking_Resource_DTO
	 */
	private $dto_mapper;

	/**
	 * Validated domain filters.
	 *
	 * @var WPBC_Catalog_Booking_Resources_Request
	 */
	private $resource_request;

	/**
	 * Create a provider with optional focused dependencies for tests/endpoints.
	 *
	 * @param WPBC_Catalog_Booking_Resources_Repository|null $repository       Independent repository.
	 * @param WPBC_Catalog_Booking_Resource_DTO|null         $dto_mapper       Resource DTO mapper.
	 * @param WPBC_Catalog_Booking_Resources_Request|null    $resource_request Validated domain filters.
	 */
	public function __construct( $repository = null, $dto_mapper = null, $resource_request = null ) {
		$this->repository       = $repository instanceof WPBC_Catalog_Booking_Resources_Repository ? $repository : new WPBC_Catalog_Booking_Resources_Repository();
		$this->dto_mapper       = $dto_mapper instanceof WPBC_Catalog_Booking_Resource_DTO ? $dto_mapper : new WPBC_Catalog_Booking_Resource_DTO();
		$this->resource_request = $resource_request instanceof WPBC_Catalog_Booking_Resources_Request
			? $resource_request
			: WPBC_Catalog_Booking_Resources_Request::create();
	}

	/**
	 * Return the stable catalog identifier served by this provider.
	 *
	 * @return string Catalog identifier.
	 */
	public function get_catalog_id() {
		return 'catalog_booking_resources';
	}

	/**
	 * Return a normalized, JSON-safe list response.
	 *
	 * Business Large `all` requests paginate complete parent/child groups. The
	 * explicit type filters remain flat because their contextual rows are not
	 * part of the requested result.
	 *
	 * @param WPBC_UI_Catalog_Request $request Validated shared request.
	 *
	 * @return WPBC_UI_Catalog_Response|WP_Error Normalized response or safe error.
	 */
	public function get_response( $request ) {
		if ( ! $request instanceof WPBC_UI_Catalog_Request || $this->get_catalog_id() !== $request->get_catalog_id() ) {
			return new WP_Error(
				'wpbc_catalog_booking_resources_invalid_request',
				__( 'The Booking Resources request is invalid.', 'booking' )
			);
		}
		if ( is_wp_error( $this->resource_request ) ) {
			return $this->resource_request;
		}

		$request_values = $request->to_array();
		$query_values   = array(
			'page_number'    => $request_values['page_number'],
			'items_per_page' => $request_values['items_per_page'],
			'sort_by'        => $request_values['sort_by'],
			'sort_order'     => $request_values['sort_order'],
			'search'         => $request_values['search'],
			'resource_type'  => $this->resource_request->get( 'resource_type', 'all' ),
			'include_publishing' => in_array( 'publishing', $request_values['visible_columns'], true ),
		);

		$total_resources = $this->repository->count_resources( $query_values );
		if ( is_wp_error( $total_resources ) ) {
			return $total_resources;
		}

		$total_pages      = 0 === $total_resources ? 1 : (int) ceil( $total_resources / $request_values['items_per_page'] );
		$last_page_number = max( 1, $total_pages );
		if ( $request_values['page_number'] > $last_page_number ) {
			$request_values['page_number'] = $last_page_number;
			$request = WPBC_UI_Catalog_Request::create( $request->get_configuration(), $request_values );
			if ( is_wp_error( $request ) ) {
				return $request;
			}
			$query_values['page_number'] = $last_page_number;
		}

		$resources = $this->repository->get_resources( $query_values );
		if ( is_wp_error( $resources ) ) {
			return $resources;
		}

		$items = $this->dto_mapper->create_collection( $resources );
		if ( is_wp_error( $items ) ) {
			return $items;
		}

		$hierarchy          = $this->repository->get_hierarchy( $resources );
		$hierarchy_state    = $this->resource_request->get(
			'hierarchy_state',
			array(
				'all_expanded' => null,
			)
		);
		$is_hierarchy_view  = class_exists( 'wpdev_bk_biz_l' ) && 'all' === $this->resource_request->get( 'resource_type', 'all' );
		$page_item_count    = isset( $hierarchy['pagination_unit_count'] )
			? absint( $hierarchy['pagination_unit_count'] )
			: count( $items );

		return WPBC_UI_Catalog_Response::create(
			$this->get_catalog_id(),
			$request,
			$items,
			array(
				'pagination'   => array(
					'total_items'    => $total_resources,
					'page_item_count' => $page_item_count,
				),
				'filters'      => array(
					'resource_type' => $this->resource_request->get( 'resource_type', 'all' ),
				),
				'hierarchy'    => array(
					'enabled'             => $is_hierarchy_view,
					'expanded_by_default' => null === $hierarchy_state['all_expanded'] ? $is_hierarchy_view : (bool) $hierarchy_state['all_expanded'],
					'preference_state'    => $hierarchy_state,
				),
				'capabilities' => array(
					'create'      => false,
					'bulk_edit'   => false,
					'bulk_delete' => false,
				),
			)
		);
	}
}
