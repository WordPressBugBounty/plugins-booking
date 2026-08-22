<?php
/**
 * Appointment Services provider for the shared catalog contract.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Coordinate validated shared requests with the Service-owned repository and DTO.
 *
 * This adapter exists so shared catalog mechanics never need to understand
 * Service storage, editions, ownership, availability, or action permissions.
 */
final class WPBC_Appointment_Services_Catalog_Provider implements WPBC_UI_Catalog_Provider {

	/** @var object Service-domain data provider. */
	private $repository;

	/** @var WPBC_Appointment_Service_Catalog_DTO Service DTO mapper. */
	private $dto_mapper;

	/** @var WPBC_Appointment_Services_Catalog_Request Service-only filters. */
	private $service_request;

	/**
	 * Construct a provider with injectable dependencies for endpoint and runtime tests.
	 *
	 * @param object|null                                    $repository      Service-domain provider.
	 * @param WPBC_Appointment_Service_Catalog_DTO|null      $dto_mapper      DTO mapper.
	 * @param WPBC_Appointment_Services_Catalog_Request|null $service_request Validated Service filters.
	 */
	public function __construct( $repository = null, $dto_mapper = null, $service_request = null ) {
		$this->repository      = is_object( $repository ) ? $repository : wpbc_appointment_services_get_data_provider();
		$this->dto_mapper      = $dto_mapper instanceof WPBC_Appointment_Service_Catalog_DTO ? $dto_mapper : new WPBC_Appointment_Service_Catalog_DTO();
		$this->service_request = $service_request instanceof WPBC_Appointment_Services_Catalog_Request ? $service_request : WPBC_Appointment_Services_Catalog_Request::create();
	}

	/**
	 * Return the catalog identifier registered by the Service configuration.
	 *
	 * @return string Stable catalog identifier.
	 */
	public function get_catalog_id() {
		return 'appointment_services_catalog';
	}

	/**
	 * Return one normalized Service page without rendering row HTML.
	 *
	 * @param WPBC_UI_Catalog_Request $request Validated shared request.
	 *
	 * @return WPBC_UI_Catalog_Response|WP_Error Normalized response or safe error.
	 */
	public function get_response( $request ) {
		if ( ! $request instanceof WPBC_UI_Catalog_Request || $this->get_catalog_id() !== $request->get_catalog_id() ) {
			return new WP_Error( 'wpbc_appointment_services_invalid_request', __( 'The Services request is invalid.', 'booking' ) );
		}
		if ( ! is_object( $this->repository ) || ! method_exists( $this->repository, 'list_items' ) || ! wpbc_appointment_services_storage_is_ready() ) {
			return wpbc_appointment_services_storage_error();
		}

		$request_values = $request->to_array();
		$query          = array(
			'search'         => $request_values['search'],
			'status'         => $this->service_request->get( 'status', 'all' ),
			'resource_id'    => $this->service_request->get( 'resource_id', 0 ),
			'sort_by'        => $request_values['sort_by'],
			'sort_order'     => $request_values['sort_order'],
			'limit'          => $request_values['items_per_page'],
			'offset'         => ( $request_values['page_number'] - 1 ) * $request_values['items_per_page'],
		);
		$raw_counts = method_exists( $this->repository, 'count_items' ) ? $this->repository->count_items( $query ) : null;
		if ( is_wp_error( $raw_counts ) ) {
			return $raw_counts;
		}
		if ( null === $raw_counts ) {
			return $this->get_fallback_response( $request, $request_values, $query );
		}
		$counts      = wpbc_appointment_services_normalize_status_counts( $raw_counts );
		$status      = $this->service_request->get( 'status', 'all' );
		$total_items = 'all' === $status ? $counts['all'] : $counts[ $status ];
		$total_pages = max( 1, (int) ceil( $total_items / $request_values['items_per_page'] ) );
		if ( $request_values['page_number'] > $total_pages ) {
			$request_values['page_number'] = $total_pages;
			$request = WPBC_UI_Catalog_Request::create( $request->get_configuration(), $request_values );
			if ( is_wp_error( $request ) ) {
				return $request;
			}
			$query['offset'] = ( $total_pages - 1 ) * $request_values['items_per_page'];
		}

		$services = $this->repository->list_items( $query );
		if ( is_wp_error( $services ) ) {
			return $services;
		}
		$items = $this->dto_mapper->create_collection( $services );
		if ( is_wp_error( $items ) ) {
			return $items;
		}
		$provider_directory = wpbc_appointment_services_get_provider_directory();

		return WPBC_UI_Catalog_Response::create(
			$this->get_catalog_id(),
			$request,
			$items,
			array(
				'pagination'   => array( 'total_items' => $total_items ),
				'filters'      => array(
					'status'        => $status,
					'resource_id'   => $this->service_request->get( 'resource_id', 0 ),
					'status_counts' => $counts,
					'providers'     => array_values( $provider_directory ),
					'provider_count' => count( $provider_directory ),
					'storage_ready' => true,
				),
				'capabilities' => $this->get_capabilities(),
			)
		);
	}

	/**
	 * Paginate a legacy replacement provider that exposes only list_items().
	 *
	 * This bounded compatibility path preserves the released Service provider
	 * filter. Native storage uses count_items() and never enters this branch.
	 *
	 * @param WPBC_UI_Catalog_Request $request        Validated shared request.
	 * @param array<string,mixed>      $request_values Normalized shared values.
	 * @param array<string,mixed>      $query          Service query values.
	 *
	 * @return WPBC_UI_Catalog_Response|WP_Error Normalized response or provider error.
	 */
	private function get_fallback_response( $request, $request_values, $query ) {
		$status = $this->service_request->get( 'status', 'all' );
		$query['status'] = 'all';
		$query['limit']  = 500;
		$query['offset'] = 0;

		$service_rows = $this->repository->list_items( $query );
		if ( is_wp_error( $service_rows ) ) {
			return $service_rows;
		}

		$all_services = array_map( 'wpbc_appointment_services_normalize_item', (array) $service_rows );
		$counts       = array( 'all' => count( $all_services ), 'active' => 0, 'inactive' => 0, 'archived' => 0 );
		foreach ( $all_services as $service ) {
			if ( isset( $counts[ $service['status'] ] ) ) {
				++$counts[ $service['status'] ];
			}
		}

		$filtered_services = 'all' === $status
			? $all_services
			: array_values(
				array_filter(
					$all_services,
					static function ( $service ) use ( $status ) {
						return $status === $service['status'];
					}
				)
			);
		$total_items      = count( $filtered_services );
		$total_pages      = max( 1, (int) ceil( $total_items / $request_values['items_per_page'] ) );
		$page_number      = min( $request_values['page_number'], $total_pages );
		if ( $page_number !== $request_values['page_number'] ) {
			$request_values['page_number'] = $page_number;
			$request = WPBC_UI_Catalog_Request::create( $request->get_configuration(), $request_values );
			if ( is_wp_error( $request ) ) {
				return $request;
			}
		}
		$page_services = array_slice( $filtered_services, ( $page_number - 1 ) * $request_values['items_per_page'], $request_values['items_per_page'] );
		$items         = $this->dto_mapper->create_collection( $page_services );
		if ( is_wp_error( $items ) ) {
			return $items;
		}
		$provider_directory = wpbc_appointment_services_get_provider_directory();

		return WPBC_UI_Catalog_Response::create(
			$this->get_catalog_id(),
			$request,
			$items,
			array(
				'pagination'   => array( 'total_items' => $total_items ),
				'filters'      => array(
					'status'         => $status,
					'resource_id'    => $this->service_request->get( 'resource_id', 0 ),
					'status_counts'  => $counts,
					'providers'      => array_values( $provider_directory ),
					'provider_count' => count( $provider_directory ),
					'storage_ready'  => true,
				),
				'capabilities' => $this->get_capabilities(),
			)
		);
	}

	/**
	 * Return the current user's Service action capabilities.
	 *
	 * Mutation endpoints repeat the same capability check immediately before a
	 * write. These values control presentation only and never authorize a write.
	 *
	 * @return array<string,bool> Browser-safe Service action capabilities.
	 */
	private function get_capabilities() {
		$can_manage_services = current_user_can( wpbc_appointment_services_get_manage_capability() );

		return array(
			'create'      => $can_manage_services,
			'edit'        => $can_manage_services,
			'duplicate'   => $can_manage_services,
			'archive'     => $can_manage_services,
			'bulk_edit'   => $can_manage_services,
			'bulk_delete' => false,
		);
	}
}
