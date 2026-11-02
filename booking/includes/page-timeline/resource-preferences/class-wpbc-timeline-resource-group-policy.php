<?php
/**
 * Timeline booking Resource hierarchy and selected-page policy.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Keep Business Large hierarchy selection and paging semantics in one domain service.
 */
final class WPBC_Timeline_Resource_Group_Policy {

	/** @var callable|null Optional edition resolver used by deterministic tests. */
	private $hierarchy_enabled_callback;

	/**
	 * Construct the Resource group policy.
	 *
	 * @param callable|null $hierarchy_enabled_callback Optional callback returning whether hierarchy semantics are enabled.
	 */
	public function __construct( $hierarchy_enabled_callback = null ) {
		$this->hierarchy_enabled_callback = is_callable( $hierarchy_enabled_callback ) ? $hierarchy_enabled_callback : null;
	}

	/**
	 * Determine whether Business Large hierarchy semantics are active.
	 *
	 * @return bool True when parent and child Resources form root groups.
	 */
	public function is_hierarchy_enabled() {
		if ( $this->hierarchy_enabled_callback ) {
			return (bool) call_user_func( $this->hierarchy_enabled_callback );
		}

		return class_exists( 'wpdev_bk_biz_l' );
	}

	/**
	 * Build ordered Resource groups without changing the authorized row order.
	 *
	 * An authorized orphan child retains its stored parent identifier as the
	 * group key. This keeps related selected children together without inventing
	 * or exposing a parent row the current user cannot read.
	 *
	 * @param array<int,array<string,mixed>> $resources         Authorized Resource records.
	 * @param bool|null                      $hierarchy_enabled Optional explicit hierarchy mode.
	 *
	 * @return array<int,array<int,array<string,mixed>>> Ordered groups.
	 */
	public function group_resources( $resources, $hierarchy_enabled = null ) {
		$hierarchy_enabled = null === $hierarchy_enabled ? $this->is_hierarchy_enabled() : (bool) $hierarchy_enabled;
		$groups            = array();

		foreach ( is_array( $resources ) ? $resources : array() as $resource ) {
			if ( ! is_array( $resource ) ) {
				continue;
			}
			$resource_id = isset( $resource['id'] ) ? absint( $resource['id'] ) : 0;
			if ( ! $resource_id ) {
				continue;
			}
			$parent_id = isset( $resource['parent_id'] ) ? absint( $resource['parent_id'] ) : 0;
			$group_id  = $hierarchy_enabled && $parent_id ? $parent_id : $resource_id;
			if ( ! isset( $groups[ $group_id ] ) ) {
				$groups[ $group_id ] = array();
			}
			$groups[ $group_id ][] = $resource;
		}

		return array_values( $groups );
	}

	/**
	 * Return selector state for each authorized row on one complete page.
	 *
	 * Parent rows are group controls. Their scope contains the parent and every
	 * authorized child returned in the same repository-owned root group. Child
	 * and flat rows continue to control only their own exact Resource ID.
	 *
	 * @param array<int,array<string,mixed>> $resources     Authorized selector-page Resources.
	 * @param string                         $selection_mode Normalized all or explicit mode.
	 * @param array<int,int>                 $selected_ids  Explicit selected Resource IDs.
	 * @param bool                           $group_safe     Whether this page uses root-group pagination.
	 *
	 * @return array<int,array<string,mixed>> State keyed by Resource ID.
	 */
	public function get_selector_states( $resources, $selection_mode, $selected_ids, $group_safe ) {
		$selected_lookup = array_fill_keys( array_filter( array_map( 'absint', (array) $selected_ids ) ), true );
		$is_all_mode     = WPBC_Timeline_Resource_View_Preferences::SELECTION_MODE_ALL === $selection_mode;
		$states          = array();

		foreach ( $this->group_resources( $resources, $group_safe ) as $group_resources ) {
			$group_ids = array_values( array_filter( array_map( 'absint', wp_list_pluck( $group_resources, 'id' ) ) ) );
			$group_id  = 0;
			if ( ! empty( $group_resources ) ) {
				$first_resource = $group_resources[0];
				$group_id       = $group_safe && ! empty( $first_resource['parent_id'] )
					? absint( $first_resource['parent_id'] )
					: absint( $first_resource['id'] );
			}
			$selected_count = $is_all_mode
				? count( $group_ids )
				: count( array_intersect( $group_ids, array_keys( $selected_lookup ) ) );
			$group_state = 0 === $selected_count
				? 'unselected'
				: ( count( $group_ids ) === $selected_count ? 'selected' : 'mixed' );

			foreach ( $group_resources as $resource ) {
				$resource_id     = absint( $resource['id'] );
				$is_group_control = $group_safe
					&& $resource_id === $group_id
					&& ( 'capacity_parent' === ( isset( $resource['node_role'] ) ? $resource['node_role'] : '' ) || ! empty( $resource['is_expandable'] ) );
				$is_selected      = $is_all_mode || isset( $selected_lookup[ $resource_id ] );
				$states[ $resource_id ] = array(
					'group_id'            => $group_id,
					'is_group_control'     => $is_group_control,
					'selection_scope_ids'  => $is_group_control ? $group_ids : array( $resource_id ),
					'selection_state'      => $is_group_control ? $group_state : ( $is_selected ? 'selected' : 'unselected' ),
				);
			}
		}

		return $states;
	}

	/**
	 * Page an exact selected set by whole root group and enforce the row budget.
	 *
	 * The page size counts groups in Business Large. The response row limit is
	 * checked after whole groups are selected; a large group returns an explicit
	 * error and is never silently sliced.
	 *
	 * @param array<int,array<string,mixed>> $resources         Authorized selected Resources in canonical order.
	 * @param int                            $page              Requested page.
	 * @param int                            $per_page          Requested groups or flat Resources per page.
	 * @param int                            $maximum_resources Maximum rows allowed in one response.
	 * @param bool|null                      $hierarchy_enabled Optional explicit hierarchy mode.
	 *
	 * @return array<string,mixed>|WP_Error Complete selected page or safe budget error.
	 */
	public function paginate_selected_resources( $resources, $page, $per_page, $maximum_resources, $hierarchy_enabled = null ) {
		$hierarchy_enabled = null === $hierarchy_enabled ? $this->is_hierarchy_enabled() : (bool) $hierarchy_enabled;
		$groups            = $this->group_resources( $resources, $hierarchy_enabled );
		$total_items       = count( $groups );
		if ( ! $total_items ) {
			return new WP_Error(
				'wpbc_timeline_resource_selection_empty',
				__( 'At least one booking Resource is required.', 'booking' ),
				array( 'status' => 400 )
			);
		}

		$per_page    = max( 1, absint( $per_page ) );
		$total_pages = (int) ceil( $total_items / $per_page );
		$page        = min( max( 1, absint( $page ) ), $total_pages );
		$page_groups = array_slice( $groups, ( $page - 1 ) * $per_page, $per_page );
		$page_rows   = array();
		foreach ( $page_groups as $group_resources ) {
			$page_rows = array_merge( $page_rows, $group_resources );
		}

		$maximum_resources = max( 1, absint( $maximum_resources ) );
		if ( count( $page_rows ) > $maximum_resources ) {
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

		return array(
			'resources'  => $page_rows,
			'pagination' => array(
				'page'        => $page,
				'per_page'    => $per_page,
				'total_items' => $total_items,
				'total_pages' => $total_pages,
				'unit'        => $hierarchy_enabled ? 'resource_group' : 'resource',
			),
		);
	}
}
