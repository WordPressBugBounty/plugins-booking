<?php
/**
 * Focused Booking Modes V3 presentation compiler.
 *
 * @package Booking Calendar
 * @since   11.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Compile only the native, sidebar, horizontal, or page-options surface asked for.
 */
final class WPBC_Booking_Modes_V3_Compiler {

	/** @var WPBC_Booking_Modes_V3_Compiler|null */
	private static $instance = null;

	/** @var array<string,int> */
	private $compile_counts = array(
		'native'       => 0,
		'sidebar'      => 0,
		'root'         => 0,
		'horizontal'   => 0,
		'page_options' => 0,
	);

	/** @var array<string,array> */
	private $cache = array();

	/**
	 * Prevent direct construction.
	 */
	private function __construct() {}

	/**
	 * Return the shared request-local compiler.
	 *
	 * @return WPBC_Booking_Modes_V3_Compiler Compiler instance.
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Compile the WordPress Booking Calendar submenu without collecting page metadata.
	 *
	 * @param array  $submenu_rows Source WordPress submenu rows.
	 * @param array  $definition   Selected validated mode.
	 * @param string $edition_id   Exact current edition ID.
	 *
	 * @return array Native submenu rows in configured order plus inherited rows.
	 */
	public function compile_native( $submenu_rows, $definition, $edition_id ) {
		$cache_key = 'native|' . $definition['id'] . '|' . $edition_id;
		if ( isset( $this->cache[ $cache_key ] ) ) {
			return $this->cache[ $cache_key ];
		}

		++$this->compile_counts['native'];
		$compatibility_menu = WPBC_Booking_Modes_V3_Compatibility_Registry::get_instance()->get_native_menu( $definition['id'] );
		$compiled           = array();
		$source_position    = 0;
		foreach ( array_slice( $submenu_rows, 0, WPBC_Booking_Modes_V3_Definition_Validator::MAX_COLLECTION_ENTRIES ) as $source_row ) {
			$menu_slug = is_array( $source_row ) && isset( $source_row[2] ) && is_scalar( $source_row[2] ) ? sanitize_key( (string) $source_row[2] ) : '';
			if ( '' === $menu_slug ) {
				continue;
			}

			$definition_options  = isset( $definition['wordpress_menu'][ $menu_slug ] ) ? $definition['wordpress_menu'][ $menu_slug ] : array();
			$compatibility_options = isset( $compatibility_menu[ $menu_slug ] ) ? $compatibility_menu[ $menu_slug ] : array();
			if ( ! empty( $definition_options ) && ! $this->is_surface_visible( $definition_options, $edition_id ) ) {
				continue;
			}
			if ( isset( $compatibility_options['visible'] ) && false === $compatibility_options['visible'] ) {
				continue;
			}

			$menu_row = $source_row;
			if ( array_key_exists( 'title', $definition_options ) ) {
				$menu_row[0] = $definition_options['title'];
			}
			if ( array_key_exists( 'title', $compatibility_options ) ) {
				$menu_row[0] = $compatibility_options['title'];
			}
			$menu_row['_wpbc_v3_position'] = isset( $compatibility_options['position'] )
				? absint( $compatibility_options['position'] )
				: 10000 + $source_position;
			$menu_row['_wpbc_v3_sequence'] = $source_position;
			$compiled[] = $menu_row;
			++$source_position;
		}

		uasort(
			$compiled,
			static function ( $first_row, $second_row ) {
				if ( $first_row['_wpbc_v3_position'] === $second_row['_wpbc_v3_position'] ) {
					return $first_row['_wpbc_v3_sequence'] === $second_row['_wpbc_v3_sequence'] ? 0 : ( $first_row['_wpbc_v3_sequence'] < $second_row['_wpbc_v3_sequence'] ? -1 : 1 );
				}
				return $first_row['_wpbc_v3_position'] < $second_row['_wpbc_v3_position'] ? -1 : 1;
			}
		);
		$compiled = array_values( $compiled );
		foreach ( $compiled as $row_index => $menu_row ) {
			unset( $menu_row['_wpbc_v3_position'], $menu_row['_wpbc_v3_sequence'] );
			$compiled[ $row_index ] = $menu_row;
		}

		$this->cache[ $cache_key ] = $compiled;
		return $compiled;
	}

	/**
	 * Reapply source authority after the released native submenu filter.
	 *
	 * Extensions may change labels, order, or remove rows. They cannot introduce
	 * an unregistered slug or replace its capability, callback, or destination.
	 *
	 * @param array $filtered_rows Rows returned by the released result filter.
	 * @param array $compiled_rows Source-authorized rows before that filter.
	 *
	 * @return array Source-authorized filtered submenu rows.
	 */
	public function enforce_native_source_constraints( $filtered_rows, $compiled_rows ) {
		$allowed_rows = array();
		foreach ( $compiled_rows as $compiled_row ) {
			if ( is_array( $compiled_row ) && isset( $compiled_row[2] ) && is_scalar( $compiled_row[2] ) ) {
				$allowed_rows[ sanitize_key( (string) $compiled_row[2] ) ] = $compiled_row;
			}
		}

		$normalized = array();
		$seen       = array();
		foreach ( array_slice( is_array( $filtered_rows ) ? $filtered_rows : array(), 0, WPBC_Booking_Modes_V3_Definition_Validator::MAX_COLLECTION_ENTRIES ) as $filtered_row ) {
			$menu_slug = is_array( $filtered_row ) && isset( $filtered_row[2] ) && is_scalar( $filtered_row[2] ) ? sanitize_key( (string) $filtered_row[2] ) : '';
			if ( '' === $menu_slug || isset( $seen[ $menu_slug ] ) || ! isset( $allowed_rows[ $menu_slug ] ) ) {
				continue;
			}
			$menu_row = $allowed_rows[ $menu_slug ];
			if ( isset( $filtered_row[0] ) && is_scalar( $filtered_row[0] ) ) {
				$menu_row[0] = wp_strip_all_tags( (string) $filtered_row[0] );
			}
			$normalized[]       = $menu_row;
			$seen[ $menu_slug ] = true;
		}

		return $normalized;
	}

	/**
	 * Compile the sidebar tree from original contributor metadata.
	 *
	 * @param array  $source_navigation Original registered navigation.
	 * @param array  $definition        Selected validated mode.
	 * @param string $edition_id        Exact current edition ID.
	 *
	 * @return array<string,array<string,mixed>> Legacy-compatible presentation tree.
	 */
	public function compile_sidebar( $source_navigation, $definition, $edition_id ) {
		$cache_key = 'sidebar|' . $definition['id'] . '|' . $edition_id;
		if ( isset( $this->cache[ $cache_key ] ) ) {
			return $this->cache[ $cache_key ];
		}
		++$this->compile_counts['sidebar'];
		$source_index = WPBC_Booking_Modes_V3_Source_Index::get_instance();
		$source_index->capture( $source_navigation );
		$captured_navigation = $source_index->get_navigation();
		if ( ! empty( $captured_navigation ) ) {
			$source_navigation = $captured_navigation;
		}
		$compatibility_registry = WPBC_Booking_Modes_V3_Compatibility_Registry::get_instance();
		$compatibility_groups   = $compatibility_registry->get_groups( $definition['id'] );
		$reserved_routes        = $this->collect_reserved_routes( $definition );
		$compiled               = array();

		foreach ( $definition['sidebar_menu'] as $root_key => $root_options ) {
			$compatibility_group = isset( $compatibility_groups[ $root_key ] ) ? $compatibility_groups[ $root_key ] : array();
			if ( ! $this->is_surface_visible( $root_options, $edition_id ) || ( isset( $compatibility_group['visible'] ) && false === $compatibility_group['visible'] ) ) {
				continue;
			}

			$root_items = array();
			if ( isset( $root_options['page_id'] ) ) {
				$compiled_node = $this->compile_page_node( $root_options['page_id'], $root_options, $definition, $edition_id, $reserved_routes );
				if ( null !== $compiled_node ) {
					$root_items = ! empty( $compiled_node['subtabs'] )
						? $compiled_node['subtabs']
						: array( $root_key => $compiled_node );
				}
			} else {
				$source_items = isset( $source_navigation[ $root_key ] ) && is_array( $source_navigation[ $root_key ] ) ? $source_navigation[ $root_key ] : array();
				if ( isset( $root_options['items'] ) && ! empty( $root_options['items'] ) ) {
					$root_items = $this->compile_configured_sidebar_nodes( $root_options['items'], $definition, $edition_id, $reserved_routes );
				}

				foreach ( $source_items as $source_item_key => $source_item ) {
					$route = array( 'page' => $root_key, 'tab' => $source_item_key, 'subtab' => '' );
					if ( isset( $root_items[ $source_item_key ] ) || isset( $reserved_routes[ WPBC_Booking_Modes_V3_Source_Index::get_route_key( $route ) ] ) || ! $this->is_source_visible( $source_item ) ) {
						continue;
					}
					$root_items[ $source_item_key ] = $this->prepare_inherited_source_node( $source_item, $route );
				}
			}

			if ( ! empty( $root_items ) ) {
				$compiled[ $root_key ] = $root_items;
			}
		}

		foreach ( $source_navigation as $source_root_key => $source_items ) {
			if ( isset( $definition['sidebar_menu'][ $source_root_key ] ) || isset( $compiled[ $source_root_key ] ) || ! is_array( $source_items ) ) {
				continue;
			}
			$inherited_items = array();
			foreach ( $source_items as $source_item_key => $source_item ) {
				$route = array( 'page' => $source_root_key, 'tab' => $source_item_key, 'subtab' => '' );
				if ( isset( $reserved_routes[ WPBC_Booking_Modes_V3_Source_Index::get_route_key( $route ) ] ) || ! $this->is_source_visible( $source_item ) ) {
					continue;
				}
				$inherited_items[ $source_item_key ] = $this->prepare_inherited_source_node( $source_item, $route );
			}
			if ( ! empty( $inherited_items ) ) {
				$compiled[ $source_root_key ] = $inherited_items;
			}
		}

		$compiled = $this->apply_legacy_page_placement_changes( $compiled, $definition, $edition_id );
		foreach ( $compiled as $root_key => $root_items ) {
			unset( $root_items );
			if ( isset( $compatibility_groups[ $root_key ]['visible'] ) && false === $compatibility_groups[ $root_key ]['visible'] ) {
				unset( $compiled[ $root_key ] );
			}
		}
		foreach ( $compiled as &$compiled_root_nodes ) {
			if ( is_array( $compiled_root_nodes ) ) {
				$this->add_sidebar_filter_identities( $compiled_root_nodes );
			}
		}
		unset( $compiled_root_nodes );
		$source_authorized_compiled = $compiled;
		$available_canonical_page_ids = $this->get_available_canonical_page_ids();

		/**
		 * Filter the focused V3 sidebar result using the released result hook.
		 *
		 * @param array  $compiled          Legacy-compatible sidebar tree.
		 * @param string $mode_id           Selected mode ID.
		 * @param array  $placement_summary Released canonical placement map.
		 * @param array  $available_ids      Available local definition page IDs.
		 * @param array  $context            Cached Booking Modes context.
		 */
		$compiled = apply_filters(
			'wpbc_booking_modes_resolved_navigation',
			$compiled,
			$definition['id'],
			$compatibility_registry->get_resolved_page_placements( $definition['id'], $available_canonical_page_ids ),
			$available_canonical_page_ids,
			wpbc_booking_modes_get_context()
		);
		$compiled = is_array( $compiled ) ? $compiled : $source_authorized_compiled;
		$compiled = $this->enforce_sidebar_source_constraints( $compiled, $source_authorized_compiled );
		$this->cache[ $cache_key ] = $compiled;

		return $compiled;
	}

	/**
	 * Compile root section labels/icons/expansion for an already compiled sidebar.
	 *
	 * @param array $legacy_roots     Original root section metadata.
	 * @param array $sidebar          Compiled sidebar tree.
	 * @param array $definition       Selected validated mode.
	 *
	 * @return array<string,array<string,mixed>> Root section metadata.
	 */
	public function compile_roots( $legacy_roots, $sidebar, $definition ) {
		$cache_key = 'root|' . $definition['id'];
		if ( isset( $this->cache[ $cache_key ] ) ) {
			return $this->cache[ $cache_key ];
		}

		++$this->compile_counts['root'];
		$compiled             = array();
		$compatibility_groups = WPBC_Booking_Modes_V3_Compatibility_Registry::get_instance()->get_groups( $definition['id'] );
		foreach ( $sidebar as $root_key => $root_items ) {
			$root_options         = isset( $definition['sidebar_menu'][ $root_key ] ) ? $definition['sidebar_menu'][ $root_key ] : array();
			$legacy_root          = isset( $legacy_roots[ $root_key ] ) && is_array( $legacy_roots[ $root_key ] ) ? $legacy_roots[ $root_key ] : array();
			$is_declared_root     = isset( $definition['sidebar_menu'][ $root_key ] );
			$is_registered_root   = isset( $legacy_root['type'] ) && 'menu' === $legacy_root['type'];
			if ( ! $is_declared_root && ! $is_registered_root ) {
				continue;
			}
			$compatibility_group  = isset( $compatibility_groups[ $root_key ] ) ? $compatibility_groups[ $root_key ] : array();
			$first_item           = is_array( $root_items ) ? reset( $root_items ) : array();
			$source_root          = $this->get_source_root_node( $root_options, $definition );
			$presentation_sources = array( $root_options, $compatibility_group, $legacy_root, $source_root, $first_item );
			$title                = $this->resolve_root_presentation_value( 'title', $presentation_sources, $root_key );
			$font_icon            = $this->resolve_root_presentation_value( 'font_icon', $presentation_sources, '' );
			$compiled[ $root_key ] = array(
				'type'           => 'menu',
				'title'          => $title,
				'font_icon'      => $font_icon,
				'mode_font_icon' => $font_icon,
				'mode_expanded'  => isset( $root_options['expanded'] ) ? $root_options['expanded'] : 'On',
				'mode_standalone' => isset( $root_options['page_id'] ) && 1 === count( $root_items ) && is_array( $first_item ) && empty( $first_item['subtabs'] ),
			);
			$compiled[ $root_key ]['_wpbc_v3_position'] = isset( $compatibility_group['position'] ) ? absint( $compatibility_group['position'] ) : 10000 + count( $compiled );
		}
		uasort(
			$compiled,
			static function ( $first_root, $second_root ) {
				if ( $first_root['_wpbc_v3_position'] === $second_root['_wpbc_v3_position'] ) {
					return 0;
				}

				return $first_root['_wpbc_v3_position'] < $second_root['_wpbc_v3_position'] ? -1 : 1;
			}
		);
		foreach ( $compiled as $root_key => $root_definition ) {
			unset( $root_definition['_wpbc_v3_position'] );
			$compiled[ $root_key ] = $root_definition;
		}
		$source_authorized_roots = $compiled;

		/**
		 * Filter V3 root presentation using the released hook signature.
		 *
		 * @param array  $compiled Root navigation.
		 * @param string $mode_id  Selected mode ID.
		 * @param array  $sidebar  Compiled sidebar tree.
		 */
		$compiled = apply_filters( 'wpbc_booking_modes_resolved_root_navigation', $compiled, $definition['id'], $sidebar );
		$compiled = is_array( $compiled ) ? $compiled : $source_authorized_roots;
		$compiled = $this->enforce_root_constraints( $compiled, $sidebar, $definition, $legacy_roots );
		$this->cache[ $cache_key ] = $compiled;

		return $compiled;
	}

	/**
	 * Compile only the horizontal host currently being rendered.
	 *
	 * @param array  $source_navigation Original navigation tree.
	 * @param array  $definition        Selected validated mode.
	 * @param string $edition_id        Exact current edition ID.
	 * @param string $active_page       Current page slug.
	 * @param string $active_tab        Current tab slug.
	 * @param string $active_subtab     Current subtab slug.
	 *
	 * @return array Legacy-compatible tree with only the current host replaced.
	 */
	public function compile_horizontal( $source_navigation, $definition, $edition_id, $active_page, $active_tab, $active_subtab ) {
		$cache_key = 'horizontal|' . $definition['id'] . '|' . $edition_id . '|' . $active_page . '|' . $active_tab . '|' . $active_subtab;
		if ( isset( $this->cache[ $cache_key ] ) ) {
			return $this->cache[ $cache_key ];
		}

		++$this->compile_counts['horizontal'];
		$source_index = WPBC_Booking_Modes_V3_Source_Index::get_instance();
		$source_index->capture( $source_navigation );
		$captured_navigation = $source_index->get_navigation();
		if ( ! empty( $captured_navigation ) ) {
			$source_navigation = $captured_navigation;
		}
		$host_page_id = $this->find_page_id_for_route( $definition, $active_page, $active_tab, $active_subtab );
		if ( '' === $host_page_id || ! isset( $source_navigation[ $active_page ] ) ) {
			$this->cache[ $cache_key ] = $source_navigation;
			return $source_navigation;
		}

		$compiled_host  = array();
		$reserved_routes = array();
		$has_overrides   = false;
		foreach ( $definition['pages'] as $page_id => $page_definition ) {
			if ( ! isset( $page_definition['horizontal_menu'] ) ) {
				continue;
			}
			$horizontal = $page_definition['horizontal_menu'];
			$show_here  = isset( $horizontal['show_on_pages'] )
				? in_array( $host_page_id, $horizontal['show_on_pages'], true )
				: $page_definition['route']['page'] === $active_page;
			if ( ! $show_here ) {
				continue;
			}

			$has_overrides = true;
			$route_key = WPBC_Booking_Modes_V3_Source_Index::get_route_key( $page_definition['route'] );
			$reserved_routes[ $route_key ] = true;
			if ( ! $this->is_surface_visible( $horizontal, $edition_id ) ) {
				continue;
			}
			$record = WPBC_Booking_Modes_V3_Source_Index::get_instance()->get_record( $page_definition['route'] );
			if ( null === $record ) {
				continue;
			}

			$node = $record['node'];
			if ( array_key_exists( 'title', $horizontal ) ) {
				$node['title'] = $horizontal['title'];
			}
			if ( array_key_exists( 'font_icon', $horizontal ) ) {
				$node['font_icon'] = $horizontal['font_icon'];
			}
			$node['top_navigation_hidden'] = false;
			$node['is_active'] = $page_definition['route']['page'] === $active_page
				&& $page_definition['route']['tab'] === $active_tab
				&& ( '' === $page_definition['route']['subtab'] || $page_definition['route']['subtab'] === $active_subtab );
			$node_key = isset( $compiled_host[ $record['tab'] ] ) ? $page_id : $record['tab'];
			$compiled_host[ $node_key ] = $node;
		}

		if ( ! $has_overrides ) {
			$this->cache[ $cache_key ] = $source_navigation;
			return $source_navigation;
		}

		foreach ( $source_navigation[ $active_page ] as $tab_key => $source_node ) {
			$route = array( 'page' => $active_page, 'tab' => $tab_key, 'subtab' => '' );
			if ( ! isset( $reserved_routes[ WPBC_Booking_Modes_V3_Source_Index::get_route_key( $route ) ] ) && $this->is_source_visible( $source_node ) ) {
				$compiled_host[ $tab_key ] = $source_node;
			}
		}

		$compiled_navigation                 = $source_navigation;
		$compiled_navigation[ $active_page ] = $compiled_host;
		$this->cache[ $cache_key ]            = $compiled_navigation;

		return $compiled_navigation;
	}

	/**
	 * Apply current-route page options without changing controller callbacks.
	 *
	 * @param array  $current_page_params Original tab/subtab parameters.
	 * @param array  $definition          Selected validated mode.
	 * @param string $page_slug           Current page slug.
	 * @param string $tab_slug            Current tab slug.
	 * @param string $subtab_slug         Current subtab slug.
	 *
	 * @return array Updated presentation parameters.
	 */
	public function apply_page_options( $current_page_params, $definition, $page_slug, $tab_slug, $subtab_slug ) {
		++$this->compile_counts['page_options'];
		$page_id = $this->find_page_id_for_route( $definition, $page_slug, $tab_slug, $subtab_slug );
		if ( '' === $page_id || empty( $definition['pages'][ $page_id ]['page_options'] ) ) {
			return $current_page_params;
		}

		$target_key = '' !== $subtab_slug && isset( $current_page_params['subtab'] ) ? 'subtab' : 'tab';
		$current_page_params[ $target_key ] = array_merge(
			isset( $current_page_params[ $target_key ] ) && is_array( $current_page_params[ $target_key ] ) ? $current_page_params[ $target_key ] : array(),
			$definition['pages'][ $page_id ]['page_options']
		);

		return $current_page_params;
	}

	/**
	 * Return per-surface compiler invocation counts for development tests.
	 *
	 * @return array<string,int> Invocation counts.
	 */
	public function get_compile_counts() {
		return $this->compile_counts;
	}

	/**
	 * Resolve the exact current product edition identifier.
	 *
	 * @return string One of the six V3 edition IDs.
	 */
	public static function get_current_edition_id() {
		$version_type = function_exists( 'wpbc_get_version_type__and_mu' ) ? wpbc_get_version_type__and_mu() : 'free';
		$edition_map  = array(
			'free'      => 'free',
			'personal'  => 'personal',
			'biz_s'     => 'business_small',
			'biz_m'     => 'business_medium',
			'biz_l'     => 'business_large',
			'multiuser' => 'multiuser',
		);

		return isset( $edition_map[ $version_type ] ) ? $edition_map[ $version_type ] : 'free';
	}

	/**
	 * Compile one configured local page from indexed source metadata.
	 *
	 * @param string $page_id         Local definition page ID.
	 * @param array  $options         Sidebar node overrides.
	 * @param array  $definition      Selected mode.
	 * @param string $edition_id      Exact edition.
	 * @param array  $reserved_routes Reserved explicit source placements.
	 *
	 * @return array|null Prepared source node, or null when unavailable/hidden.
	 */
	private function compile_page_node( $page_id, $options, $definition, $edition_id, $reserved_routes ) {
		if ( ! isset( $definition['pages'][ $page_id ] ) || ! $this->is_surface_visible( $options, $edition_id ) ) {
			return null;
		}

		$page_definition = $definition['pages'][ $page_id ];
		$record          = WPBC_Booking_Modes_V3_Source_Index::get_instance()->get_record( $page_definition['route'] );
		if ( null === $record ) {
			return null;
		}

		$node = $record['node'];
		$node['_wpbc_v3_source_route'] = $page_definition['route'];
		$node['_wpbc_v3_source_identity'] = WPBC_Booking_Modes_V3_Source_Index::get_route_key( $page_definition['route'] );
		if ( array_key_exists( 'title', $options ) ) {
			$node['title'] = $options['title'];
		}
		foreach ( array( 'font_icon', 'font_icon_right' ) as $icon_key ) {
			if ( array_key_exists( $icon_key, $options ) ) {
				$node[ $icon_key ] = $options[ $icon_key ];
			}
		}

		$has_declared_children = isset( $options['items'] ) && ! empty( $options['items'] );
		$has_source_children   = ! empty( $node['subtabs'] ) && is_array( $node['subtabs'] );
		if ( $has_declared_children || $has_source_children ) {
			$node['subtabs'] = $this->compile_source_children( $record, $options, $definition, $edition_id, $reserved_routes );
		}
		if ( ! empty( $node['subtabs'] ) ) {
			$node['is_active'] = ! empty( $node['is_active'] ) || $this->has_active_descendant( $node['subtabs'] );
			$node['_wpbc_v3_expanded'] = isset( $options['expanded'] ) ? $options['expanded'] : 'when_active';
			if ( ! empty( $node['css_classes'] ) ) {
				$node['_wpbc_v3_branch_css_classes'] = $node['css_classes'];
				$node['style'] = isset( $node['style'] ) ? rtrim( $node['style'], '; ' ) . ';order:initial;' : 'order:initial;';
			}
		}

		return $node;
	}

	/**
	 * Compile or inherit a source-linked parent's own children.
	 *
	 * @param array  $record          Indexed parent record.
	 * @param array  $options         Sidebar overrides.
	 * @param array  $definition      Selected mode.
	 * @param string $edition_id      Exact edition.
	 * @param array  $reserved_routes Reserved source identities.
	 *
	 * @return array<string,array<string,mixed>> Prepared children.
	 */
	private function compile_source_children( $record, $options, $definition, $edition_id, $reserved_routes ) {
		$source_children = isset( $record['node']['subtabs'] ) && is_array( $record['node']['subtabs'] ) ? $record['node']['subtabs'] : array();
		if ( ! isset( $options['items'] ) || empty( $options['items'] ) ) {
			return $this->prepare_inherited_source_children( $source_children, $record );
		}

		$compiled = $this->compile_configured_sidebar_nodes( $options['items'], $definition, $edition_id, $reserved_routes );

		foreach ( $source_children as $child_key => $source_child ) {
			$route = array( 'page' => $record['page'], 'tab' => $record['tab'], 'subtab' => $child_key );
			if ( ! isset( $compiled[ $child_key ] ) && ! isset( $reserved_routes[ WPBC_Booking_Modes_V3_Source_Index::get_route_key( $route ) ] ) && $this->is_source_visible( $source_child ) ) {
				$compiled[ $child_key ] = $this->prepare_inherited_source_node( $source_child, $route );
			}
		}

		return $compiled;
	}

	/**
	 * Collect every explicit source placement, including hidden nodes.
	 *
	 * @param array $definition Selected mode.
	 *
	 * @return array<string,bool> Route-key reservation map.
	 */
	private function collect_reserved_routes( $definition ) {
		$reserved = array();
		$walk     = function ( $nodes ) use ( &$walk, &$reserved, $definition ) {
			foreach ( $nodes as $node ) {
				if ( isset( $node['page_id'] ) && isset( $definition['pages'][ $node['page_id'] ] ) ) {
					$reserved[ WPBC_Booking_Modes_V3_Source_Index::get_route_key( $definition['pages'][ $node['page_id'] ]['route'] ) ] = true;
				}
				if ( isset( $node['items'] ) && is_array( $node['items'] ) ) {
					$walk( $node['items'] );
				}
			}
		};
		$walk( $definition['sidebar_menu'] );

		return $reserved;
	}

	/**
	 * Determine whether a configured surface record is visible in this edition.
	 *
	 * @param array  $options    Validated surface options.
	 * @param string $edition_id Exact edition ID.
	 *
	 * @return bool True when no explicit presentation suppression applies.
	 */
	private function is_surface_visible( $options, $edition_id ) {
		if ( array_key_exists( 'visible', $options ) && false === $options['visible'] ) {
			return false;
		}
		if ( array_key_exists( 'editions', $options ) && ! in_array( $edition_id, $options['editions'], true ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Preserve source visibility flags for declaration-omitted inherited nodes.
	 *
	 * Explicit declaration entries may intentionally expose a source node whose
	 * original horizontal/sidebar renderer marked it hidden. The source record
	 * must still exist, so this helper is used only for automatic inheritance.
	 *
	 * @param mixed $source_node Registered source node.
	 *
	 * @return bool True when the source node remains presentable.
	 */
	private function is_source_visible( $source_node ) {
		return is_array( $source_node ) && empty( $source_node['disabled'] ) && empty( $source_node['hided'] );
	}

	/**
	 * Keep inherited source metadata while applying V3 branch-only layout state.
	 *
	 * Source CSS ordering classes belong to the complete folder wrapper in the
	 * recursive/sidebar context. The child heading retains every other source
	 * class and receives an inline neutral order so its children cannot precede it.
	 *
	 * @param array $source_node Original source node.
	 *
	 * @return array Prepared inherited node.
	 */
	private function prepare_inherited_source_node( $source_node, $route = array(), $source_identity = '' ) {
		if ( ! empty( $route ) ) {
			$source_node['_wpbc_v3_source_route'] = $route;
			$source_identity = WPBC_Booking_Modes_V3_Source_Index::get_route_key( $route );
		}
		if ( '' !== $source_identity ) {
			$source_node['_wpbc_v3_source_identity'] = $source_identity;
		}
		if ( empty( $source_node['subtabs'] ) || ! is_array( $source_node['subtabs'] ) ) {
			return $source_node;
		}

		$prepared_children = array();
		foreach ( $source_node['subtabs'] as $child_key => $source_child ) {
			if ( ! $this->is_source_visible( $source_child ) ) {
				continue;
			}
			$child_route = array();
			if ( isset( $route['page'], $route['tab'] ) && empty( $route['subtab'] ) ) {
				$child_route = array( 'page' => $route['page'], 'tab' => $route['tab'], 'subtab' => $child_key );
			}
			$child_identity = $source_identity . '>' . strlen( (string) $child_key ) . ':' . (string) $child_key;
			$prepared_children[ $child_key ] = $this->prepare_inherited_source_node( $source_child, $child_route, $child_identity );
		}
		$source_node['subtabs'] = $prepared_children;
		if ( empty( $prepared_children ) ) {
			return $source_node;
		}

		$source_node['_wpbc_v3_expanded'] = 'when_active';
		$source_node['is_active'] = ! empty( $source_node['is_active'] ) || $this->has_active_descendant( $prepared_children );
		if ( ! empty( $source_node['css_classes'] ) ) {
			$source_node['_wpbc_v3_branch_css_classes'] = $source_node['css_classes'];
			$source_node['style'] = isset( $source_node['style'] )
				? rtrim( $source_node['style'], '; ' ) . ';order:initial;'
				: 'order:initial;';
		}

		return $source_node;
	}

	/**
	 * Compile an ordered map of explicit source-linked and pure folder nodes.
	 *
	 * @param array  $configured_nodes Sidebar node declarations.
	 * @param array  $definition      Selected mode declaration.
	 * @param string $edition_id      Exact current edition ID.
	 * @param array  $reserved_routes Explicit source reservations.
	 *
	 * @return array<string,array<string,mixed>> Prepared visible nodes.
	 */
	private function compile_configured_sidebar_nodes( $configured_nodes, $definition, $edition_id, $reserved_routes ) {
		$compiled_nodes = array();
		foreach ( $configured_nodes as $node_key => $node_options ) {
			if ( ! $this->is_surface_visible( $node_options, $edition_id ) ) {
				continue;
			}
			if ( isset( $node_options['page_id'] ) ) {
				$compiled_node = $this->compile_page_node( $node_options['page_id'], $node_options, $definition, $edition_id, $reserved_routes );
			} else {
				$compiled_node = $this->compile_pure_folder_node( $node_options, $definition, $edition_id, $reserved_routes );
			}
			if ( null !== $compiled_node ) {
				$compiled_nodes[ $node_key ] = $compiled_node;
			}
		}

		return $compiled_nodes;
	}

	/**
	 * Compile a source-less nested folder using only validated presentation data.
	 *
	 * @param array  $options         Pure folder declaration.
	 * @param array  $definition      Selected mode declaration.
	 * @param string $edition_id      Exact current edition ID.
	 * @param array  $reserved_routes Explicit source reservations.
	 *
	 * @return array<string,mixed>|null Prepared folder, or null when empty.
	 */
	private function compile_pure_folder_node( $options, $definition, $edition_id, $reserved_routes ) {
		if ( empty( $options['title'] ) || empty( $options['items'] ) ) {
			return null;
		}

		$children = $this->compile_configured_sidebar_nodes( $options['items'], $definition, $edition_id, $reserved_routes );
		if ( empty( $children ) ) {
			return null;
		}

		$node = array(
			'title'                => $options['title'],
			'url'                  => '',
			'disabled'             => false,
			'hided'                => false,
			'is_active'            => $this->has_active_descendant( $children ),
			'subtabs'              => $children,
			'_wpbc_v3_expanded'    => isset( $options['expanded'] ) ? $options['expanded'] : 'when_active',
			'_wpbc_v3_pure_folder' => true,
		);
		foreach ( array( 'font_icon', 'font_icon_right' ) as $icon_key ) {
			if ( array_key_exists( $icon_key, $options ) ) {
				$node[ $icon_key ] = $options[ $icon_key ];
			}
		}

		return $node;
	}

	/**
	 * Prepare source children while retaining their exact registered order.
	 *
	 * @param array $source_children Source child nodes.
	 * @param array $parent_record   Indexed source parent.
	 *
	 * @return array<string,array<string,mixed>> Eligible inherited children.
	 */
	private function prepare_inherited_source_children( $source_children, $parent_record ) {
		$prepared_children = array();
		foreach ( $source_children as $child_key => $source_child ) {
			if ( ! $this->is_source_visible( $source_child ) ) {
				continue;
			}
			$route = array( 'page' => $parent_record['page'], 'tab' => $parent_record['tab'], 'subtab' => $child_key );
			$prepared_children[ $child_key ] = $this->prepare_inherited_source_node( $source_child, $route );
		}

		return $prepared_children;
	}

	/**
	 * Check recursive active state without changing source callbacks or URLs.
	 *
	 * @param array $nodes Prepared child node map.
	 *
	 * @return bool True when any descendant is active.
	 */
	private function has_active_descendant( $nodes ) {
		foreach ( $nodes as $node ) {
			if ( ! empty( $node['is_active'] ) ) {
				return true;
			}
			if ( ! empty( $node['subtabs'] ) && is_array( $node['subtabs'] ) && $this->has_active_descendant( $node['subtabs'] ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Apply bounded changes made through the released legacy placement hooks.
	 *
	 * @param array  $compiled   Source-authorized V3 sidebar.
	 * @param array  $definition Selected compiler definition.
	 * @param string $edition_id Exact current edition ID.
	 *
	 * @return array Sidebar with compatible label, removal, order, and placement changes.
	 */
	private function apply_legacy_page_placement_changes( $compiled, $definition, $edition_id ) {
		$compatibility_registry = WPBC_Booking_Modes_V3_Compatibility_Registry::get_instance();
		if ( null === $compatibility_registry->get( $definition['id'] ) ) {
			return $compiled;
		}

		$available_page_ids = $this->get_available_canonical_page_ids();
		$change_set = $compatibility_registry->get_page_placement_changes( $definition['id'], $available_page_ids );
		foreach ( $change_set['removed'] as $canonical_page_id ) {
			$canonical_page = WPBC_Booking_Modes_V3_Page_Registry::get_instance()->get( $canonical_page_id );
			if ( is_array( $canonical_page ) ) {
				$this->remove_sidebar_source_identity( $compiled, WPBC_Booking_Modes_V3_Source_Index::get_route_key( $canonical_page ) );
			}
		}

		foreach ( $change_set['placements'] as $canonical_page_id => $placement ) {
			$canonical_page = WPBC_Booking_Modes_V3_Page_Registry::get_instance()->get( $canonical_page_id );
			if ( ! is_array( $canonical_page ) ) {
				continue;
			}
			$route = array( 'page' => $canonical_page['page'], 'tab' => $canonical_page['tab'], 'subtab' => $canonical_page['subtab'] );
			$source_identity = WPBC_Booking_Modes_V3_Source_Index::get_route_key( $route );
			$this->remove_sidebar_source_identity( $compiled, $source_identity );
			if ( empty( $placement['visible'] ) || $this->is_route_explicitly_suppressed( $source_identity, $definition, $edition_id ) ) {
				continue;
			}

			$record = WPBC_Booking_Modes_V3_Source_Index::get_instance()->get_record( $route );
			if ( null === $record || ! $this->is_source_visible( $record['node'] ) ) {
				continue;
			}
			$node = $this->prepare_inherited_source_node( $record['node'], $route );
			foreach ( array( 'title', 'font_icon', 'font_icon_right' ) as $presentation_key ) {
				if ( array_key_exists( $presentation_key, $placement ) ) {
					$node[ $presentation_key ] = $placement[ $presentation_key ];
				}
			}
			$node['_wpbc_v3_position'] = isset( $placement['position'] ) ? absint( $placement['position'] ) : 1000;
			$target_group = ! empty( $placement['group'] ) ? $placement['group'] : $route['page'];
			$navigation_key = ! empty( $placement['navigation_key'] ) ? $placement['navigation_key'] : ( '' !== $route['subtab'] ? $route['subtab'] : $route['tab'] );

			if ( '' !== $route['subtab'] && $target_group === $route['page'] ) {
				$parent_route = array( 'page' => $route['page'], 'tab' => $route['tab'], 'subtab' => '' );
				if ( $this->insert_sidebar_source_child( $compiled, WPBC_Booking_Modes_V3_Source_Index::get_route_key( $parent_route ), $navigation_key, $node ) ) {
					continue;
				}
			}
			if ( ! isset( $compiled[ $target_group ] ) || ! is_array( $compiled[ $target_group ] ) ) {
				$compiled[ $target_group ] = array();
			}
			$compiled[ $target_group ][ $navigation_key ] = $node;
			$compiled[ $target_group ] = $this->sort_compatibility_nodes( $compiled[ $target_group ] );
		}

		return $compiled;
	}

	/**
	 * Check whether a V3 declaration explicitly suppresses one source route.
	 *
	 * Released compatibility filters may remove or restyle eligible nodes, but
	 * cannot restore a route hidden by the selected mode or current edition.
	 *
	 * @param string $source_identity Collision-safe source identity.
	 * @param array  $definition      Selected mode declaration.
	 * @param string $edition_id      Exact current edition ID.
	 *
	 * @return bool True when the declaration suppresses the route.
	 */
	private function is_route_explicitly_suppressed( $source_identity, $definition, $edition_id ) {
		$is_suppressed = false;
		$walk = function ( $nodes, $ancestor_suppressed = false ) use ( &$walk, &$is_suppressed, $source_identity, $definition, $edition_id ) {
			foreach ( $nodes as $node ) {
				$node_suppressed = $ancestor_suppressed || ! $this->is_surface_visible( $node, $edition_id );
				if ( isset( $node['page_id'], $definition['pages'][ $node['page_id'] ] ) ) {
					$route_identity = WPBC_Booking_Modes_V3_Source_Index::get_route_key( $definition['pages'][ $node['page_id'] ]['route'] );
					if ( $source_identity === $route_identity && $node_suppressed ) {
						$is_suppressed = true;
						return;
					}
				}
				if ( isset( $node['items'] ) && is_array( $node['items'] ) ) {
					$walk( $node['items'], $node_suppressed );
				}
			}
		};
		$walk( $definition['sidebar_menu'] );

		return $is_suppressed;
	}

	/**
	 * Remove one source identity from any root in a complete sidebar.
	 *
	 * @param array  $sidebar         Sidebar roots passed by reference.
	 * @param string $source_identity Collision-safe source identity.
	 *
	 * @return bool True when a node was removed.
	 */
	private function remove_sidebar_source_identity( &$sidebar, $source_identity ) {
		foreach ( $sidebar as &$root_nodes ) {
			if ( is_array( $root_nodes ) && $this->remove_source_identity( $root_nodes, $source_identity ) ) {
				unset( $root_nodes );
				return true;
			}
		}
		unset( $root_nodes );

		return false;
	}

	/**
	 * Insert one source child below its parent in any sidebar root.
	 *
	 * @param array  $sidebar         Sidebar roots passed by reference.
	 * @param string $parent_identity Parent source identity.
	 * @param string $navigation_key  Presentation child key.
	 * @param array  $child_node      Prepared source child.
	 *
	 * @return bool True when the source parent was found.
	 */
	private function insert_sidebar_source_child( &$sidebar, $parent_identity, $navigation_key, $child_node ) {
		foreach ( $sidebar as &$root_nodes ) {
			if ( is_array( $root_nodes ) && $this->insert_source_child( $root_nodes, $parent_identity, $navigation_key, $child_node ) ) {
				unset( $root_nodes );
				return true;
			}
		}
		unset( $root_nodes );

		return false;
	}

	/**
	 * Remove one source identity from any sidebar depth.
	 *
	 * @param array  $nodes           Navigation nodes passed by reference.
	 * @param string $source_identity Collision-safe source identity.
	 *
	 * @return bool True when a node was removed.
	 */
	private function remove_source_identity( &$nodes, $source_identity ) {
		foreach ( $nodes as $node_key => &$node ) {
			if ( is_array( $node ) && isset( $node['_wpbc_v3_source_identity'] ) && $source_identity === $node['_wpbc_v3_source_identity'] ) {
				unset( $nodes[ $node_key ] );
				unset( $node );
				return true;
			}
			if ( is_array( $node ) && ! empty( $node['subtabs'] ) && is_array( $node['subtabs'] ) && $this->remove_source_identity( $node['subtabs'], $source_identity ) ) {
				unset( $node );
				return true;
			}
		}
		unset( $node );

		return false;
	}

	/**
	 * Insert one compatible subtab below its original source parent.
	 *
	 * @param array  $nodes           Navigation nodes passed by reference.
	 * @param string $parent_identity Parent source identity.
	 * @param string $navigation_key  Presentation child key.
	 * @param array  $child_node      Prepared source child.
	 *
	 * @return bool True when the source parent was found.
	 */
	private function insert_source_child( &$nodes, $parent_identity, $navigation_key, $child_node ) {
		foreach ( $nodes as &$node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			if ( isset( $node['_wpbc_v3_source_identity'] ) && $parent_identity === $node['_wpbc_v3_source_identity'] ) {
				$node['subtabs'] = isset( $node['subtabs'] ) && is_array( $node['subtabs'] ) ? $node['subtabs'] : array();
				$node['subtabs'][ $navigation_key ] = $child_node;
				$node['subtabs'] = $this->sort_compatibility_nodes( $node['subtabs'] );
				$node['_wpbc_v3_expanded'] = isset( $node['_wpbc_v3_expanded'] ) ? $node['_wpbc_v3_expanded'] : 'when_active';
				unset( $node );
				return true;
			}
			if ( ! empty( $node['subtabs'] ) && is_array( $node['subtabs'] ) && $this->insert_source_child( $node['subtabs'], $parent_identity, $navigation_key, $child_node ) ) {
				unset( $node );
				return true;
			}
		}
		unset( $node );

		return false;
	}

	/**
	 * Sort compatibility placements while retaining source order for stable ties.
	 *
	 * @param array $nodes Navigation sibling map.
	 *
	 * @return array Sorted sibling map.
	 */
	private function sort_compatibility_nodes( $nodes ) {
		$sequence = 0;
		foreach ( $nodes as $node_key => $node ) {
			$nodes[ $node_key ]['_wpbc_v3_sort'] = isset( $node['_wpbc_v3_position'] ) ? absint( $node['_wpbc_v3_position'] ) : 10000 + $sequence;
			$nodes[ $node_key ]['_wpbc_v3_sequence'] = $sequence;
			++$sequence;
		}
		uasort(
			$nodes,
			static function ( $first_node, $second_node ) {
				if ( $first_node['_wpbc_v3_sort'] === $second_node['_wpbc_v3_sort'] ) {
					return $first_node['_wpbc_v3_sequence'] === $second_node['_wpbc_v3_sequence'] ? 0 : ( $first_node['_wpbc_v3_sequence'] < $second_node['_wpbc_v3_sequence'] ? -1 : 1 );
				}
				return $first_node['_wpbc_v3_sort'] < $second_node['_wpbc_v3_sort'] ? -1 : 1;
			}
		);
		foreach ( $nodes as $node_key => $node ) {
			unset( $node['_wpbc_v3_position'], $node['_wpbc_v3_sort'], $node['_wpbc_v3_sequence'] );
			$nodes[ $node_key ] = $node;
		}

		return $nodes;
	}

	/**
	 * Reapply source and explicit V3 constraints after the released tree filter.
	 *
	 * @param array $filtered Navigation returned by the public result filter.
	 * @param array $allowed  Source-authorized navigation before that filter.
	 *
	 * @return array Safe navigation preserving compatible labels/order/removals.
	 */
	private function enforce_sidebar_source_constraints( $filtered, $allowed ) {
		$allowed_nodes = array();
		foreach ( $allowed as $root_nodes ) {
			if ( is_array( $root_nodes ) ) {
				$this->index_allowed_sidebar_nodes( $root_nodes, $allowed_nodes );
			}
		}
		$seen = array();
		$normalized = array();
		$remaining_nodes = WPBC_Booking_Modes_V3_Definition_Validator::MAX_SIDEBAR_NODES;
		foreach ( array_slice( $filtered, 0, WPBC_Booking_Modes_V3_Definition_Validator::MAX_COLLECTION_ENTRIES, true ) as $root_key => $root_nodes ) {
			if ( ! isset( $allowed[ $root_key ] ) || ! is_array( $root_nodes ) ) {
				continue;
			}
			$safe_nodes = $this->normalize_filtered_sidebar_nodes( $root_nodes, $allowed_nodes, $seen, 1, $remaining_nodes );
			if ( ! empty( $safe_nodes ) ) {
				$normalized[ $root_key ] = $safe_nodes;
			}
		}

		return $normalized;
	}

	/**
	 * Add stable internal identities to source-less folders before filtering.
	 *
	 * The identity travels through the released result filter and permits label
	 * and order changes without letting a callback introduce an arbitrary folder.
	 *
	 * @param array  $nodes Navigation nodes passed by reference.
	 * @param string $path  Stable key path used by recursive calls.
	 *
	 * @return void
	 */
	private function add_sidebar_filter_identities( &$nodes, $path = '' ) {
		foreach ( $nodes as $node_key => &$node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			$node_path = $path . '/' . strlen( (string) $node_key ) . ':' . (string) $node_key;
			if ( ! empty( $node['_wpbc_v3_pure_folder'] ) ) {
				$node['_wpbc_v3_filter_identity'] = 'pure:' . $node_path;
			}
			if ( ! empty( $node['subtabs'] ) && is_array( $node['subtabs'] ) ) {
				$this->add_sidebar_filter_identities( $node['subtabs'], $node_path );
			}
		}
		unset( $node );
	}

	/**
	 * Index source and pure-folder identities allowed before public filtering.
	 *
	 * @param array $nodes         Allowed navigation nodes.
	 * @param array $allowed_nodes Identity map passed by reference.
	 *
	 * @return void
	 */
	private function index_allowed_sidebar_nodes( $nodes, &$allowed_nodes ) {
		foreach ( $nodes as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			$identity = isset( $node['_wpbc_v3_source_identity'] ) ? 'source:' . $node['_wpbc_v3_source_identity'] : '';
			if ( '' === $identity && isset( $node['_wpbc_v3_filter_identity'] ) ) {
				$identity = $node['_wpbc_v3_filter_identity'];
			}
			if ( '' !== $identity ) {
				$allowed_nodes[ $identity ] = $node;
			}
			if ( ! empty( $node['subtabs'] ) && is_array( $node['subtabs'] ) ) {
				$this->index_allowed_sidebar_nodes( $node['subtabs'], $allowed_nodes );
			}
		}
	}

	/**
	 * Normalize filtered nodes against the source-authorized identity map.
	 *
	 * @param array $nodes         Filtered navigation nodes.
	 * @param array $allowed_nodes Source-authorized nodes by identity.
	 * @param array $seen          Seen identities passed by reference.
	 * @param int   $depth         Current filtered tree depth.
	 * @param int   $remaining     Remaining node budget passed by reference.
	 *
	 * @return array Safe filtered nodes.
	 */
	private function normalize_filtered_sidebar_nodes( $nodes, $allowed_nodes, &$seen, $depth, &$remaining ) {
		$normalized = array();
		if ( $depth > WPBC_Booking_Modes_V3_Definition_Validator::MAX_SIDEBAR_DEPTH || $remaining <= 0 ) {
			return $normalized;
		}
		foreach ( array_slice( $nodes, 0, WPBC_Booking_Modes_V3_Definition_Validator::MAX_COLLECTION_ENTRIES, true ) as $node_key => $candidate ) {
			if ( $remaining <= 0 ) {
				break;
			}
			--$remaining;
			if ( ! is_array( $candidate ) ) {
				continue;
			}
			$identity = isset( $candidate['_wpbc_v3_source_identity'] ) ? 'source:' . $candidate['_wpbc_v3_source_identity'] : '';
			if ( '' === $identity && isset( $candidate['_wpbc_v3_filter_identity'] ) ) {
				$identity = $candidate['_wpbc_v3_filter_identity'];
			}
			if ( '' === $identity || isset( $seen[ $identity ] ) || ! isset( $allowed_nodes[ $identity ] ) ) {
				continue;
			}

			$node = $allowed_nodes[ $identity ];
			foreach ( array( 'title', 'font_icon', 'font_icon_right', 'css_classes', 'folder_style', 'style', '_wpbc_v3_expanded' ) as $presentation_key ) {
				if ( array_key_exists( $presentation_key, $candidate ) && is_scalar( $candidate[ $presentation_key ] ) ) {
					$node[ $presentation_key ] = $candidate[ $presentation_key ];
				}
			}
			$seen[ $identity ] = true;
			$candidate_children = isset( $candidate['subtabs'] ) && is_array( $candidate['subtabs'] ) ? $candidate['subtabs'] : array();
			$node['subtabs'] = $this->normalize_filtered_sidebar_nodes( $candidate_children, $allowed_nodes, $seen, $depth + 1, $remaining );
			if ( ! empty( $node['_wpbc_v3_pure_folder'] ) && empty( $node['subtabs'] ) ) {
				continue;
			}
			$node['is_active'] = ! empty( $node['is_active'] ) || $this->has_active_descendant( $node['subtabs'] );
			$normalized[ $node_key ] = $node;
		}

		return $normalized;
	}

	/**
	 * Restrict filtered root metadata to groups present in the safe sidebar.
	 *
	 * @param array $filtered     Filtered root metadata.
	 * @param array $sidebar      Safe compiled sidebar.
	 * @param array $definition   Selected declaration.
	 * @param array $legacy_roots Original root metadata.
	 *
	 * @return array Safe root metadata.
	 */
	private function enforce_root_constraints( $filtered, $sidebar, $definition, $legacy_roots ) {
		$normalized           = array();
		$compatibility_groups = WPBC_Booking_Modes_V3_Compatibility_Registry::get_instance()->get_groups( $definition['id'] );
		foreach ( array_slice( is_array( $filtered ) ? $filtered : array(), 0, WPBC_Booking_Modes_V3_Definition_Validator::MAX_COLLECTION_ENTRIES, true ) as $root_key => $candidate ) {
			if ( ! isset( $sidebar[ $root_key ] ) || ! is_array( $candidate ) ) {
				continue;
			}
			$root_options         = isset( $definition['sidebar_menu'][ $root_key ] ) ? $definition['sidebar_menu'][ $root_key ] : array();
			$legacy_root          = isset( $legacy_roots[ $root_key ] ) && is_array( $legacy_roots[ $root_key ] ) ? $legacy_roots[ $root_key ] : array();
			$compatibility_group  = isset( $compatibility_groups[ $root_key ] ) ? $compatibility_groups[ $root_key ] : array();
			$source_root          = $this->get_source_root_node( $root_options, $definition );
			$root_items           = $sidebar[ $root_key ];
			$first_item           = is_array( $root_items ) ? reset( $root_items ) : array();
			$presentation_sources = array( $root_options, $compatibility_group, $legacy_root, $source_root, $first_item );
			$title                = $this->resolve_root_presentation_value( 'title', $presentation_sources, $root_key );
			$font_icon            = $this->resolve_root_presentation_value( 'font_icon', $presentation_sources, '' );
			$base                 = array(
				'type'            => 'menu',
				'title'           => $title,
				'font_icon'       => $font_icon,
				'mode_font_icon'  => $font_icon,
				'mode_expanded'   => isset( $root_options['expanded'] ) ? $root_options['expanded'] : 'On',
				'mode_standalone' => isset( $root_options['page_id'] ) && 1 === count( $root_items ) && is_array( $first_item ) && empty( $first_item['subtabs'] ),
			);
			foreach ( array( 'title', 'font_icon', 'mode_font_icon' ) as $presentation_key ) {
				if ( array_key_exists( $presentation_key, $candidate ) && is_scalar( $candidate[ $presentation_key ] ) ) {
					$base[ $presentation_key ] = $candidate[ $presentation_key ];
				}
			}
			$normalized[ $root_key ] = $base;
		}

		return $normalized;
	}

	/**
	 * Resolve one root display value through declared compatibility precedence.
	 *
	 * @param string $presentation_key Presentation field name.
	 * @param array  $sources          Ordered source records from highest to lowest priority.
	 * @param string $fallback         Value used when no source declares the field.
	 *
	 * @return string First declared scalar display value or the fallback.
	 */
	private function resolve_root_presentation_value( $presentation_key, $sources, $fallback ) {
		foreach ( $sources as $source ) {
			if ( is_array( $source ) && array_key_exists( $presentation_key, $source ) && is_scalar( $source[ $presentation_key ] ) ) {
				return (string) $source[ $presentation_key ];
			}
		}

		return $fallback;
	}

	/**
	 * Return original source metadata for a root linked directly to a page.
	 *
	 * @param array $root_options Root sidebar declaration.
	 * @param array $definition  Selected mode declaration.
	 *
	 * @return array<string,mixed> Source node or an empty array.
	 */
	private function get_source_root_node( $root_options, $definition ) {
		if ( ! isset( $root_options['page_id'], $definition['pages'][ $root_options['page_id'] ] ) ) {
			return array();
		}

		$record = WPBC_Booking_Modes_V3_Source_Index::get_instance()->get_record( $definition['pages'][ $root_options['page_id'] ]['route'] );

		return is_array( $record ) && isset( $record['node'] ) && is_array( $record['node'] ) ? $record['node'] : array();
	}

	/**
	 * Return canonical IDs whose routes exist in the captured source index.
	 *
	 * @return array<int,string> Available canonical IDs.
	 */
	private function get_available_canonical_page_ids() {
		$available = array();
		foreach ( WPBC_Booking_Modes_V3_Page_Registry::get_instance()->get_all() as $page_id => $page ) {
			if ( null !== WPBC_Booking_Modes_V3_Source_Index::get_instance()->get_record( $page ) ) {
				$available[] = $page_id;
			}
		}

		return $available;
	}

	/**
	 * Find a local definition page for an exact current route.
	 *
	 * @param array  $definition Selected mode.
	 * @param string $page_slug  Page slug.
	 * @param string $tab_slug   Tab slug.
	 * @param string $subtab_slug Subtab slug.
	 *
	 * @return string Local page ID, or an empty string.
	 */
	private function find_page_id_for_route( $definition, $page_slug, $tab_slug, $subtab_slug ) {
		foreach ( $definition['pages'] as $page_id => $page_definition ) {
			$route = $page_definition['route'];
			if ( $route['page'] === $page_slug && $route['tab'] === $tab_slug && ( '' === $route['subtab'] || $route['subtab'] === $subtab_slug ) ) {
				return $page_id;
			}
		}

		return '';
	}
}
