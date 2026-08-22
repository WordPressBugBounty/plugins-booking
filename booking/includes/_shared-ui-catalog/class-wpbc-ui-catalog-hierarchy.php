<?php
/**
 * Shared structural hierarchy contracts for template-driven catalogs.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize hierarchy configuration, response state, and domain-neutral nodes.
 *
 * This class validates structural relationships only. Catalog repositories and
 * DTOs remain responsible for domain identity, permissions, business counts,
 * storage, search policy, sorting, and group-safe pagination.
 */
final class WPBC_UI_Catalog_Hierarchy {

	/**
	 * Maximum length accepted for an opaque hierarchy node identifier.
	 *
	 * @var int
	 */
	const MAXIMUM_NODE_ID_LENGTH = 191;

	/**
	 * Normalize the optional registered hierarchy mechanics.
	 *
	 * `global` persistence stores only the catalog-wide `all_expanded` Boolean.
	 * Per-node persistence is deliberately not part of this shared contract.
	 *
	 * @param mixed $hierarchy_configuration Candidate registered configuration.
	 * @param bool  $is_feature_enabled       Whether the hierarchy feature is enabled.
	 *
	 * @return array<string,mixed>|WP_Error Normalized configuration or safe error.
	 */
	public static function normalize_configuration( $hierarchy_configuration, $is_feature_enabled ) {
		if ( null === $hierarchy_configuration ) {
			$hierarchy_configuration = array();
		}
		if ( ! is_array( $hierarchy_configuration ) ) {
			return self::get_error( 'invalid_configuration' );
		}

		$allowed_keys = array( 'persistence', 'preference_key' );
		if ( array_diff( array_keys( $hierarchy_configuration ), $allowed_keys ) ) {
			return self::get_error( 'invalid_configuration' );
		}

		$persistence = isset( $hierarchy_configuration['persistence'] ) && is_scalar( $hierarchy_configuration['persistence'] )
			? sanitize_key( (string) $hierarchy_configuration['persistence'] )
			: 'none';
		if ( ! in_array( $persistence, array( 'none', 'global' ), true ) ) {
			return self::get_error( 'invalid_configuration' );
		}
		if ( ! $is_feature_enabled ) {
			$persistence = 'none';
		}

		$preference_key = isset( $hierarchy_configuration['preference_key'] ) && is_scalar( $hierarchy_configuration['preference_key'] )
			? sanitize_key( (string) $hierarchy_configuration['preference_key'] )
			: '';
		if ( 'global' === $persistence && '' === $preference_key ) {
			return self::get_error( 'invalid_configuration' );
		}

		return array(
			'persistence'   => $persistence,
			'preference_key' => 'global' === $persistence ? $preference_key : '',
		);
	}

	/**
	 * Normalize the optional catalog-wide disclosure preference.
	 *
	 * JSON scalar support keeps the state compatible with URL-encoded AJAX
	 * requests and the shared preference store. Per-node identifiers are
	 * rejected so domains cannot accidentally create a second persistence model.
	 *
	 * @param mixed $preference_state Candidate JSON string or stored array.
	 *
	 * @return array{all_expanded:?bool}|WP_Error Normalized preference or safe error.
	 */
	public static function normalize_preference_state( $preference_state ) {
		if ( '' === $preference_state || null === $preference_state ) {
			return array(
				'all_expanded' => null,
			);
		}
		if ( is_scalar( $preference_state ) ) {
			$preference_state = json_decode( (string) $preference_state, true );
		}
		if ( ! is_array( $preference_state ) || array_diff( array_keys( $preference_state ), array( 'all_expanded' ) ) ) {
			return self::get_error( 'invalid_preference' );
		}

		$all_expanded = array_key_exists( 'all_expanded', $preference_state ) ? $preference_state['all_expanded'] : null;
		if ( ! is_bool( $all_expanded ) && null !== $all_expanded ) {
			return self::get_error( 'invalid_preference' );
		}

		return array(
			'all_expanded' => $all_expanded,
		);
	}

	/**
	 * Normalize catalog-wide hierarchy response state.
	 *
	 * @param mixed $hierarchy_response Candidate provider response section.
	 * @param bool  $is_feature_enabled Whether the registered feature is enabled.
	 *
	 * @return array<string,mixed>|WP_Error Normalized hierarchy state or safe error.
	 */
	public static function normalize_response( $hierarchy_response, $is_feature_enabled ) {
		if ( null === $hierarchy_response ) {
			$hierarchy_response = array();
		}
		if ( ! is_array( $hierarchy_response ) ) {
			return self::get_error( 'malformed_response' );
		}

		$allowed_keys = array( 'enabled', 'expanded_by_default', 'preference_state' );
		if ( array_diff( array_keys( $hierarchy_response ), $allowed_keys ) ) {
			return self::get_error( 'malformed_response' );
		}

		$is_enabled = array_key_exists( 'enabled', $hierarchy_response )
			? $hierarchy_response['enabled']
			: (bool) $is_feature_enabled;
		if ( ! is_bool( $is_enabled ) || ( $is_enabled && ! $is_feature_enabled ) ) {
			return self::get_error( 'malformed_response' );
		}

		$expanded_by_default = array_key_exists( 'expanded_by_default', $hierarchy_response )
			? $hierarchy_response['expanded_by_default']
			: false;
		if ( ! is_bool( $expanded_by_default ) ) {
			return self::get_error( 'malformed_response' );
		}

		$preference_state = self::normalize_preference_state(
			isset( $hierarchy_response['preference_state'] )
				? $hierarchy_response['preference_state']
				: array()
		);
		if ( is_wp_error( $preference_state ) ) {
			return self::get_error( 'malformed_response' );
		}

		return array(
			'enabled'             => $is_enabled,
			'expanded_by_default' => $expanded_by_default,
			'preference_state'    => $preference_state,
		);
	}

	/**
	 * Normalize and validate structural node metadata on catalog items.
	 *
	 * Enabled hierarchy responses must contain a parent-first flat node list.
	 * Requiring parents before descendants makes cycles impossible and lets the
	 * browser apply visibility in one linear pass. Flat responses are returned
	 * unchanged and incur no hierarchy validation or behavior.
	 *
	 * @param array $items              JSON-safe normalized catalog items.
	 * @param bool  $is_hierarchy_enabled Whether hierarchy is active for this response.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Normalized items or safe error.
	 */
	public static function normalize_items( $items, $is_hierarchy_enabled ) {
		if ( ! is_array( $items ) ) {
			return self::get_error( 'malformed_items' );
		}
		if ( ! $is_hierarchy_enabled ) {
			return $items;
		}

		$normalized_items = array();
		$nodes_by_id      = array();
		$child_counts     = array();

		foreach ( $items as $item ) {
			if ( ! is_array( $item ) || ! isset( $item['hierarchy'] ) || ! is_array( $item['hierarchy'] ) ) {
				return self::get_error( 'malformed_node' );
			}

			$node = self::normalize_node( $item['hierarchy'] );
			if ( is_wp_error( $node ) ) {
				return $node;
			}
			if ( isset( $nodes_by_id[ $node['node_id'] ] ) ) {
				return self::get_error( 'duplicate_node' );
			}

			if ( '' !== $node['parent_node_id'] ) {
				if ( ! isset( $nodes_by_id[ $node['parent_node_id'] ] ) ) {
					return self::get_error( 'missing_parent' );
				}

				$parent_node = $nodes_by_id[ $node['parent_node_id'] ];
				if ( ! $parent_node['is_container'] || $node['depth'] !== $parent_node['depth'] + 1 ) {
					return self::get_error( 'invalid_relationship' );
				}
				$child_counts[ $node['parent_node_id'] ] = isset( $child_counts[ $node['parent_node_id'] ] )
					? $child_counts[ $node['parent_node_id'] ] + 1
					: 1;
			} elseif ( 0 !== $node['depth'] ) {
				return self::get_error( 'invalid_relationship' );
			}

			$item['hierarchy']             = array_merge( $item['hierarchy'], $node );
			$nodes_by_id[ $node['node_id'] ] = $node;
			$normalized_items[]            = $item;
		}

		foreach ( $nodes_by_id as $node_id => $node ) {
			$rendered_child_count = isset( $child_counts[ $node_id ] ) ? $child_counts[ $node_id ] : 0;
			if (
				$rendered_child_count !== $node['rendered_children_count']
				|| $node['rendered_children_count'] > $node['children_count']
				|| ( 0 < $rendered_child_count && ! $node['is_container'] )
				|| ( $node['expandable'] && 0 === $rendered_child_count )
			) {
				return self::get_error( 'invalid_child_count' );
			}
		}

		return $normalized_items;
	}

	/**
	 * Normalize one domain-neutral hierarchy node.
	 *
	 * Domain-specific keys already present in the hierarchy array are preserved
	 * by normalize_items(); this method returns only the shared structural keys.
	 *
	 * @param array $node Candidate hierarchy node metadata.
	 *
	 * @return array<string,mixed>|WP_Error Normalized node or safe error.
	 */
	private static function normalize_node( $node ) {
		$required_keys = array(
			'node_id',
			'parent_node_id',
			'node_kind',
			'is_container',
			'expandable',
			'children_count',
			'rendered_children_count',
			'depth',
			'position',
			'is_last_sibling',
		);
		if ( array_diff( $required_keys, array_keys( $node ) ) ) {
			return self::get_error( 'malformed_node' );
		}

		$node_id        = self::normalize_node_id( $node['node_id'], false );
		$parent_node_id = self::normalize_node_id( $node['parent_node_id'], true );
		if ( is_wp_error( $node_id ) || is_wp_error( $parent_node_id ) || $node_id === $parent_node_id ) {
			return self::get_error( 'malformed_node' );
		}

		$node_kind = is_scalar( $node['node_kind'] ) ? sanitize_key( (string) $node['node_kind'] ) : '';
		if ( ! in_array( $node_kind, array( 'entity', 'virtual' ), true ) ) {
			return self::get_error( 'malformed_node' );
		}
		if ( ! is_bool( $node['is_container'] ) || ! is_bool( $node['expandable'] ) || ! is_bool( $node['is_last_sibling'] ) ) {
			return self::get_error( 'malformed_node' );
		}
		if ( $node['expandable'] && ! $node['is_container'] ) {
			return self::get_error( 'invalid_relationship' );
		}

		$children_count          = self::normalize_count( $node['children_count'] );
		$rendered_children_count = self::normalize_count( $node['rendered_children_count'] );
		$depth                   = self::normalize_count( $node['depth'] );
		$position                = self::normalize_count( $node['position'] );
		if ( is_wp_error( $children_count ) || is_wp_error( $rendered_children_count ) || is_wp_error( $depth ) || is_wp_error( $position ) ) {
			return self::get_error( 'malformed_node' );
		}

		return array(
			'node_id'                 => $node_id,
			'parent_node_id'          => $parent_node_id,
			'node_kind'               => $node_kind,
			'is_container'            => $node['is_container'],
			'expandable'              => $node['expandable'],
			'children_count'          => $children_count,
			'rendered_children_count' => $rendered_children_count,
			'depth'                   => $depth,
			'position'                => $position,
			'is_last_sibling'         => $node['is_last_sibling'],
		);
	}

	/**
	 * Normalize one opaque hierarchy node identifier.
	 *
	 * @param mixed $node_id        Candidate identifier.
	 * @param bool  $is_empty_valid Whether an empty root-parent identifier is valid.
	 *
	 * @return string|WP_Error Normalized identifier or safe error.
	 */
	private static function normalize_node_id( $node_id, $is_empty_valid ) {
		if ( null === $node_id && $is_empty_valid ) {
			return '';
		}
		if ( ! is_scalar( $node_id ) ) {
			return self::get_error( 'malformed_node' );
		}

		$node_id = trim( sanitize_text_field( (string) $node_id ) );
		if ( ( '' === $node_id && ! $is_empty_valid ) || self::MAXIMUM_NODE_ID_LENGTH < strlen( $node_id ) ) {
			return self::get_error( 'malformed_node' );
		}

		return $node_id;
	}

	/**
	 * Normalize one nonnegative integer hierarchy value.
	 *
	 * @param mixed $candidate Candidate count, depth, or position.
	 *
	 * @return int|WP_Error Normalized integer or safe error.
	 */
	private static function normalize_count( $candidate ) {
		if ( ! is_scalar( $candidate ) || ! preg_match( '/^\d+$/', (string) $candidate ) ) {
			return self::get_error( 'malformed_node' );
		}

		return absint( $candidate );
	}

	/**
	 * Return a namespaced safe hierarchy error.
	 *
	 * @param string $error_code Short error suffix.
	 *
	 * @return WP_Error Safe hierarchy error.
	 */
	private static function get_error( $error_code ) {
		$error_message = 'invalid_preference' === $error_code
			? __( 'The catalog hierarchy preference is invalid.', 'booking' )
			: __( 'The catalog hierarchy response is malformed.', 'booking' );

		return new WP_Error(
			'wpbc_ui_catalog_hierarchy_' . sanitize_key( $error_code ),
			$error_message
		);
	}
}
