<?php
/**
 * JSON-safe Timeline Resource-selector DTO mapping.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Map authorized repository records to the selector's strict data contract.
 */
final class WPBC_Timeline_Resource_Selector_DTO_Mapper {

	/** Selector response schema version. */
	const SCHEMA_VERSION = 2;

	/** @var WPBC_Timeline_Resource_Group_Policy Resource hierarchy selection policy. */
	private $group_policy;

	/**
	 * Construct the selector DTO mapper.
	 *
	 * @param WPBC_Timeline_Resource_Group_Policy|null $group_policy Optional Resource hierarchy policy.
	 */
	public function __construct( $group_policy = null ) {
		$this->group_policy = $group_policy ? $group_policy : new WPBC_Timeline_Resource_Group_Policy();
	}

	/**
	 * Map one authorized Resource page.
	 *
	 * The mapper uses an explicit field allow-list. Repository-only owner IDs,
	 * priorities, raw costs, SQL details, callbacks, filesystem paths, and HTML
	 * therefore cannot enter the JSON response.
	 *
	 * @param array<string,mixed> $resource_page Authorized repository page.
	 * @param array<string,mixed> $resource_view Current user's normalized view state.
	 * @param string              $search        Validated selector search.
	 *
	 * @return array<string,mixed> JSON-safe selector response.
	 */
	public function map_page( $resource_page, $resource_view, $search ) {
		$resource_page = is_array( $resource_page ) ? $resource_page : array();
		$resource_view = is_array( $resource_view ) ? $resource_view : array();
		$resources     = isset( $resource_page['resources'] ) && is_array( $resource_page['resources'] )
			? $resource_page['resources']
			: array();
		$pagination    = isset( $resource_page['pagination'] ) && is_array( $resource_page['pagination'] )
			? $resource_page['pagination']
			: array();
		$selection_mode = isset( $resource_view['selection_mode'] )
			&& WPBC_Timeline_Resource_View_Preferences::SELECTION_MODE_EXPLICIT === $resource_view['selection_mode']
			? WPBC_Timeline_Resource_View_Preferences::SELECTION_MODE_EXPLICIT
			: WPBC_Timeline_Resource_View_Preferences::SELECTION_MODE_ALL;
		$selected_ids = isset( $resource_view['selected_resource_ids'] ) && is_array( $resource_view['selected_resource_ids'] )
			? array_values( array_unique( array_filter( array_map( 'absint', $resource_view['selected_resource_ids'] ) ) ) )
			: array();
		$unit        = isset( $pagination['unit'] ) && 'resource_group' === $pagination['unit'] ? 'resource_group' : 'resource';
		$group_states = $this->group_policy->get_selector_states(
			$resources,
			$selection_mode,
			$selected_ids,
			'resource_group' === $unit
		);
		$resource_dtos = array();

		foreach ( $resources as $resource ) {
			if ( ! is_array( $resource ) ) {
				continue;
			}
			$resource_id = isset( $resource['id'] ) ? absint( $resource['id'] ) : 0;
			if ( ! $resource_id ) {
				continue;
			}
			$resource_dtos[] = $this->map_resource(
				$resource,
				WPBC_Timeline_Resource_View_Preferences::SELECTION_MODE_ALL === $selection_mode
					|| in_array( $resource_id, $selected_ids, true ),
				isset( $group_states[ $resource_id ] ) ? $group_states[ $resource_id ] : array()
			);
		}

		$page        = max( 1, absint( isset( $pagination['page'] ) ? $pagination['page'] : 1 ) );
		$per_page    = max( 1, absint( isset( $pagination['per_page'] ) ? $pagination['per_page'] : WPBC_Timeline_Resource_View_Preferences::DEFAULT_PAGE_SIZE ) );
		$total_items = max( 0, absint( isset( $pagination['total_items'] ) ? $pagination['total_items'] : 0 ) );
		$total_pages = max( 0, absint( isset( $pagination['total_pages'] ) ? $pagination['total_pages'] : 0 ) );

		return array(
			'schema_version' => self::SCHEMA_VERSION,
			'resources'      => $resource_dtos,
			'selector_pagination' => array(
				'page'          => $page,
				'per_page'      => $per_page,
				'total_items'   => $total_items,
				'total_pages'   => $total_pages,
				'unit'          => $unit,
				'has_previous'  => 1 < $page,
				'has_next'      => 0 < $total_pages && $page < $total_pages,
				'search'        => sanitize_text_field( (string) $search ),
			),
			'selection'      => array(
				'mode' => $selection_mode,
			),
		);
	}

	/**
	 * Map one authorized Resource to the lightweight selector row contract.
	 *
	 * @param array<string,mixed> $resource   Authorized repository record.
	 * @param bool                $is_selected Whether the current view selects it.
	 * @param array<string,mixed> $group_state Server-owned hierarchy selection state.
	 *
	 * @return array<string,mixed> JSON-safe Resource row.
	 */
	private function map_resource( $resource, $is_selected, $group_state ) {
		$resource_id = absint( $resource['id'] );
		$parent_id   = isset( $resource['parent_id'] ) ? absint( $resource['parent_id'] ) : 0;
		$node_role   = isset( $resource['node_role'] ) ? sanitize_key( $resource['node_role'] ) : 'resource';
		if ( ! in_array( $node_role, array( 'resource', 'capacity_parent', 'child' ), true ) ) {
			$node_role = 'resource';
		}

		return array(
			'id'                 => $resource_id,
			'title'              => sanitize_text_field( isset( $resource['title'] ) ? (string) $resource['title'] : '' ),
			'subtitle'           => $this->get_rate_subtitle( $resource ),
			'image_url'          => isset( $resource['image_url'] ) ? esc_url_raw( (string) $resource['image_url'] ) : '',
			'parent_id'          => $parent_id,
			'node_role'          => $node_role,
			'node_id'            => 'booking-resource:' . $resource_id,
			'parent_node_id'     => $parent_id ? 'booking-resource:' . $parent_id : '',
			'is_parent'          => 'capacity_parent' === $node_role,
			'is_child'           => 'child' === $node_role,
			'is_aggregate'       => ! empty( $resource['is_aggregate'] ),
			'is_expandable'      => ! empty( $resource['is_expandable'] ),
			'child_count'        => isset( $resource['child_count'] ) ? absint( $resource['child_count'] ) : 0,
			'visible_child_count' => isset( $resource['visible_child_count'] ) ? absint( $resource['visible_child_count'] ) : 0,
			'child_position'     => isset( $resource['child_position'] ) ? absint( $resource['child_position'] ) : 0,
			'is_last_child'      => ! empty( $resource['is_last_child'] ),
			'is_selected'        => (bool) $is_selected,
			'group_id'           => isset( $group_state['group_id'] ) ? absint( $group_state['group_id'] ) : $resource_id,
			'is_group_control'    => ! empty( $group_state['is_group_control'] ),
			'selection_scope_ids' => isset( $group_state['selection_scope_ids'] ) && is_array( $group_state['selection_scope_ids'] )
				? array_values( array_filter( array_map( 'absint', $group_state['selection_scope_ids'] ) ) )
				: array( $resource_id ),
			'selection_state'     => isset( $group_state['selection_state'] ) && in_array( $group_state['selection_state'], array( 'selected', 'mixed', 'unselected' ), true )
				? $group_state['selection_state']
				: ( $is_selected ? 'selected' : 'unselected' ),
		);
	}

	/**
	 * Build the selector's safe display-only rate subtitle.
	 *
	 * @param array<string,mixed> $resource Authorized repository record.
	 *
	 * @return string Sanitized subtitle.
	 */
	private function get_rate_subtitle( $resource ) {
		$base_rate = isset( $resource['base_rate'] ) && is_array( $resource['base_rate'] ) ? $resource['base_rate'] : array();
		$formatted = isset( $base_rate['formatted'] ) ? sanitize_text_field( (string) $base_rate['formatted'] ) : '';
		$period    = isset( $base_rate['period'] ) ? sanitize_key( (string) $base_rate['period'] ) : '';
		$labels    = array(
			'day'   => __( 'day', 'booking' ),
			'night' => __( 'night', 'booking' ),
			'hour'  => __( 'hour', 'booking' ),
			'fixed' => __( 'fixed', 'booking' ),
		);

		if ( '' === $formatted ) {
			return '';
		}
		if ( ! isset( $labels[ $period ] ) ) {
			return $formatted;
		}

		return sanitize_text_field(
			sprintf(
				/* translators: 1: formatted price, 2: charging period. */
				__( '%1$s / %2$s', 'booking' ),
				$formatted,
				$labels[ $period ]
			)
		);
	}
}
