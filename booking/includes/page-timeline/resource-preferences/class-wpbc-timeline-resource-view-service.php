<?php
/**
 * Persisted Timeline Resource-view orchestration service.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Authorize, resolve, save, reset, and reauthorize Timeline Resource views.
 */
final class WPBC_Timeline_Resource_View_Service {

	/** @var WPBC_Timeline_Authorization Timeline authorization service. */
	private $authorization;

	/** @var WPBC_Timeline_Resource_Repository Resource repository. */
	private $resource_repository;

	/** @var WPBC_Timeline_Resource_View_Preferences Resource-view storage. */
	private $view_preferences;

	/** @var WPBC_Timeline_Resource_View_Context Signed-context service. */
	private $view_context;

	/** @var WPBC_Timeline_Resource_Group_Policy Resource hierarchy paging policy. */
	private $group_policy;

	/**
	 * Construct the Resource-view service.
	 *
	 * @param WPBC_Timeline_Authorization|null             $authorization       Optional authorization service.
	 * @param WPBC_Timeline_Resource_Repository|null       $resource_repository Optional Resource repository.
	 * @param WPBC_Timeline_Resource_View_Preferences|null $view_preferences    Optional preference storage.
	 * @param WPBC_Timeline_Resource_View_Context|null     $view_context        Optional signed-context service.
	 * @param WPBC_Timeline_Resource_Group_Policy|null     $group_policy        Optional hierarchy paging policy.
	 */
	public function __construct( $authorization = null, $resource_repository = null, $view_preferences = null, $view_context = null, $group_policy = null ) {
		$this->authorization       = $authorization ? $authorization : new WPBC_Timeline_Authorization();
		$this->resource_repository = $resource_repository ? $resource_repository : new WPBC_Timeline_Resource_Repository();
		$this->view_preferences    = $view_preferences ? $view_preferences : new WPBC_Timeline_Resource_View_Preferences();
		$this->view_context        = $view_context ? $view_context : new WPBC_Timeline_Resource_View_Context();
		$this->group_policy        = $group_policy ? $group_policy : new WPBC_Timeline_Resource_Group_Policy();
	}

	/**
	 * Resolve the current user's persisted view for an initial Timeline read.
	 *
	 * @return array<string,mixed>|WP_Error Authorized Resource page or safe error.
	 */
	public function resolve_initial() {
		$authorized = $this->authorize();
		if ( is_wp_error( $authorized ) ) {
			return $authorized;
		}

		$record        = $this->view_preferences->get_record();
		$resource_view = $record['resource_view'];
		$resolved      = $this->resolve_view( $resource_view );
		if ( is_wp_error( $resolved ) ) {
			return $resolved;
		}

		return $this->build_result( $resource_view, $resolved );
	}

	/**
	 * Save a complete Resource-view draft after exact ownership authorization.
	 *
	 * @param mixed $candidate Untrusted Resource-view draft.
	 *
	 * @return array<string,mixed>|WP_Error Canonical saved view and context or safe error.
	 */
	public function save( $candidate ) {
		$authorized = $this->authorize();
		if ( is_wp_error( $authorized ) ) {
			return $authorized;
		}

		$authorization_context = $this->authorize_candidate( $candidate );
		if ( is_wp_error( $authorization_context ) ) {
			return $authorization_context;
		}

		$validated = $this->view_preferences->validate_resource_view(
			$candidate,
			$authorization_context['resource_ids'],
			$authorization_context['expandable_ids']
		);
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		$resolved = $this->resolve_view( $validated );
		if ( is_wp_error( $resolved ) ) {
			return $resolved;
		}
		$validated['page'] = $resolved['pagination']['page'];
		$saved             = $this->view_preferences->save_resource_view(
			$validated,
			$authorization_context['resource_ids'],
			$authorization_context['expandable_ids']
		);
		if ( is_wp_error( $saved ) ) {
			return $saved;
		}

		return $this->build_result( $saved, $resolved );
	}

	/**
	 * Reset only Resource-view state while retaining toolbar preferences.
	 *
	 * @return array<string,mixed>|WP_Error Canonical default view or safe error.
	 */
	public function reset() {
		return $this->save(
			array(
				'selection_mode'        => WPBC_Timeline_Resource_View_Preferences::SELECTION_MODE_ALL,
				'selected_resource_ids' => array(),
				'sort_order'            => WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_STANDARD,
				'page'                  => WPBC_Timeline_Resource_View_Preferences::DEFAULT_PAGE,
				'per_page'              => WPBC_Timeline_Resource_View_Preferences::DEFAULT_PAGE_SIZE,
				'expanded_resource_ids' => array(),
				'expanded_parent_ids'   => array(),
			)
		);
	}

	/**
	 * Verify and exactly reauthorize a Resource context for a window read.
	 *
	 * The exact IDs are reloaded first so deleted and foreign-owner identifiers
	 * receive the same not-found response. The persisted view is then resolved
	 * again so collection or pagination changes cannot preserve a stale page.
	 *
	 * @param mixed $token Untrusted signed Resource-view context.
	 *
	 * @return array<string,mixed>|WP_Error Authorized Resource page or safe error.
	 */
	public function resolve_signed( $token ) {
		$authorized = $this->authorize();
		if ( is_wp_error( $authorized ) ) {
			return $authorized;
		}

		$record        = $this->view_preferences->get_record();
		$resource_view = $record['resource_view'];
		$context       = $this->view_context->verify( $token, $resource_view );
		if ( is_wp_error( $context ) ) {
			return $context;
		}

		$exact_resources = $this->resource_repository->get_authorized_resources_by_ids( $context['resource_ids'] );
		if ( is_wp_error( $exact_resources ) ) {
			return $exact_resources;
		}
		if ( count( $exact_resources ) !== count( $context['resource_ids'] ) ) {
			return $this->get_unavailable_error();
		}

		$resolved = $this->resolve_view( $resource_view );
		if ( is_wp_error( $resolved ) ) {
			return $resolved;
		}
		$effective_ids = array_values( array_filter( array_map( 'absint', wp_list_pluck( $resolved['resources'], 'id' ) ) ) );
		if ( $effective_ids !== $context['resource_ids'] || $resolved['pagination'] !== $context['pagination'] ) {
			return new WP_Error(
				'wpbc_timeline_resource_view_context_stale',
				__( 'The Timeline Resource view changed. Reload the Resources and try again.', 'booking' ),
				array( 'status' => 409 )
			);
		}

		return $this->build_result( $resource_view, $resolved );
	}

	/**
	 * Authorize every submitted identifier without trusting client filtering.
	 *
	 * @param mixed $candidate Untrusted Resource-view draft.
	 *
	 * @return array<string,array<int,int>>|WP_Error Authorized identifier sets.
	 */
	private function authorize_candidate( $candidate ) {
		$identifier_lists = $this->view_preferences->validate_candidate_identifier_lists( $candidate );
		if ( is_wp_error( $identifier_lists ) ) {
			return $identifier_lists;
		}
		$selection_mode = is_array( $candidate ) && isset( $candidate['selection_mode'] ) && is_scalar( $candidate['selection_mode'] )
			? sanitize_key( (string) $candidate['selection_mode'] )
			: '';
		if ( ! in_array( $selection_mode, array( WPBC_Timeline_Resource_View_Preferences::SELECTION_MODE_ALL, WPBC_Timeline_Resource_View_Preferences::SELECTION_MODE_EXPLICIT ), true ) ) {
			return new WP_Error(
				'wpbc_timeline_resource_selection_mode_invalid',
				__( 'The Timeline Resource selection mode is invalid.', 'booking' ),
				array( 'status' => 400 )
			);
		}

		$requested_ids = array_values(
			array_unique(
				array_merge(
					$identifier_lists['selected_resource_ids'],
					$identifier_lists['expanded_resource_ids'],
					$identifier_lists['expanded_parent_ids']
				)
			)
		);
		$resources = empty( $requested_ids )
			? array()
			: $this->resource_repository->get_authorized_resources_by_ids( $requested_ids );
		if ( is_wp_error( $resources ) ) {
			return $resources;
		}
		if ( count( $resources ) !== count( $requested_ids ) ) {
			return $this->get_unavailable_error();
		}

		$probe_resources = array();
		if ( WPBC_Timeline_Resource_View_Preferences::SELECTION_MODE_ALL === $selection_mode ) {
			$probe = $this->resource_repository->get_resource_page(
				array(
					'page'     => 1,
					'per_page' => 1,
					'offset'   => 0,
					'search'   => '',
				)
			);
			if ( is_wp_error( $probe ) ) {
				return $probe;
			}
			$probe_resources = isset( $probe['resources'] ) && is_array( $probe['resources'] ) ? $probe['resources'] : array();
			if ( empty( $probe_resources ) ) {
				return $this->get_empty_error();
			}
		}

		$authorized_resources = array_merge( $resources, $probe_resources );
		$resource_ids         = array_values( array_unique( array_filter( array_map( 'absint', wp_list_pluck( $authorized_resources, 'id' ) ) ) ) );
		$expandable_ids       = array();
		foreach ( $authorized_resources as $resource ) {
			if ( ! empty( $resource['is_expandable'] ) ) {
				$expandable_ids[] = absint( $resource['id'] );
			}
		}

		return array(
			'resource_ids'   => $resource_ids,
			'expandable_ids' => array_values( array_unique( array_filter( $expandable_ids ) ) ),
		);
	}

	/**
	 * Resolve one normalized all-mode or explicit-mode Resource page.
	 *
	 * @param array<string,mixed> $resource_view Normalized Resource view.
	 *
	 * @return array<string,mixed>|WP_Error Effective resources and pagination.
	 */
	private function resolve_view( $resource_view ) {
		if ( WPBC_Timeline_Resource_View_Preferences::SELECTION_MODE_EXPLICIT === $resource_view['selection_mode'] ) {
			return $this->resolve_explicit_view( $resource_view );
		}

		$query = array(
			'page'     => absint( $resource_view['page'] ),
			'per_page' => absint( $resource_view['per_page'] ),
			'offset'   => ( absint( $resource_view['page'] ) - 1 ) * absint( $resource_view['per_page'] ),
			'search'   => '',
			'sort_order' => $resource_view['sort_order'],
		);
		$page  = $this->resource_repository->get_resource_page( $query );
		if ( is_wp_error( $page ) ) {
			return $page;
		}
		$total_pages = absint( isset( $page['pagination']['total_pages'] ) ? $page['pagination']['total_pages'] : 0 );
		if ( 0 < $total_pages && $query['page'] > $total_pages ) {
			$query['page']   = $total_pages;
			$query['offset'] = ( $total_pages - 1 ) * $query['per_page'];
			$page            = $this->resource_repository->get_resource_page( $query );
			if ( is_wp_error( $page ) ) {
				return $page;
			}
		}
		if ( empty( $page['resources'] ) ) {
			return $this->get_empty_error();
		}

		$page['pagination'] = $this->normalize_pagination( $page['pagination'] );

		return $page;
	}

	/**
	 * Page an exact selection while retaining complete Business Large groups.
	 *
	 * @param array<string,mixed> $resource_view Normalized explicit view.
	 *
	 * @return array<string,mixed>|WP_Error Effective resources and pagination.
	 */
	private function resolve_explicit_view( $resource_view ) {
		$selected_ids = $resource_view['selected_resource_ids'];
		$resources    = $this->resource_repository->get_authorized_resources_by_ids( $selected_ids, $resource_view['sort_order'] );
		if ( is_wp_error( $resources ) ) {
			return $resources;
		}
		if ( count( $resources ) !== count( $selected_ids ) ) {
			return $this->get_unavailable_error();
		}

		$maximum_resources = absint( wpbc_timeline_get_configuration()['limits']['maximum_resources'] );
		$paged_resources  = $this->group_policy->paginate_selected_resources(
			$resources,
			$resource_view['page'],
			$resource_view['per_page'],
			$maximum_resources
		);
		if ( is_wp_error( $paged_resources ) ) {
			return $paged_resources;
		}
		$paged_resources['pagination'] = $this->normalize_pagination( $paged_resources['pagination'] );

		return $paged_resources;
	}

	/**
	 * Add flags to the stable Resource pagination DTO.
	 *
	 * @param array<string,mixed> $pagination Repository pagination.
	 *
	 * @return array<string,mixed> Normalized pagination.
	 */
	private function normalize_pagination( $pagination ) {
		$page        = max( 1, absint( isset( $pagination['page'] ) ? $pagination['page'] : 1 ) );
		$total_pages = absint( isset( $pagination['total_pages'] ) ? $pagination['total_pages'] : 0 );

		return array(
			'page'         => $page,
			'per_page'     => max( 1, absint( isset( $pagination['per_page'] ) ? $pagination['per_page'] : WPBC_Timeline_Resource_View_Preferences::DEFAULT_PAGE_SIZE ) ),
			'total_items'  => absint( isset( $pagination['total_items'] ) ? $pagination['total_items'] : 0 ),
			'total_pages'  => $total_pages,
			'unit'         => isset( $pagination['unit'] ) && 'resource_group' === $pagination['unit'] ? 'resource_group' : 'resource',
			'has_previous' => 1 < $page,
			'has_next'     => 0 < $total_pages && $page < $total_pages,
		);
	}

	/**
	 * Build the canonical data-only service result.
	 *
	 * @param array<string,mixed> $resource_view Normalized source view.
	 * @param array<string,mixed> $resolved      Effective page result.
	 *
	 * @return array<string,mixed> Canonical view, page, and signed context.
	 */
	private function build_result( $resource_view, $resolved ) {
		$effective_view         = $resource_view;
		$effective_view['page'] = $resolved['pagination']['page'];

		return array(
			'resource_view'         => $effective_view,
			'resources'             => $resolved['resources'],
			'resource_pagination'   => $resolved['pagination'],
			'resource_view_context' => $this->view_context->create( $resource_view, $resolved['resources'], $resolved['pagination'] ),
		);
	}

	/**
	 * Enforce Timeline authorization.
	 *
	 * @return true|WP_Error True when authorized or a safe error.
	 */
	private function authorize() {
		return $this->authorization->current_user_can_view()
			? true
			: new WP_Error(
				'wpbc_timeline_resource_view_forbidden',
				__( 'Timeline booking Resources are unavailable for this account.', 'booking' ),
				array( 'status' => 403 )
			);
	}

	/**
	 * Return the minimum-one enforcement error.
	 *
	 * @return WP_Error Empty Resource view error.
	 */
	private function get_empty_error() {
		return new WP_Error(
			'wpbc_timeline_resource_selection_empty',
			__( 'At least one available booking Resource is required.', 'booking' ),
			array( 'status' => 422 )
		);
	}

	/**
	 * Return uniform missing, deleted, and foreign-owner behavior.
	 *
	 * @return WP_Error Uniform unavailable Resource error.
	 */
	private function get_unavailable_error() {
		return new WP_Error(
			'wpbc_timeline_resource_selection_unavailable',
			__( 'One or more selected booking Resources are not available.', 'booking' ),
			array( 'status' => 404 )
		);
	}
}
