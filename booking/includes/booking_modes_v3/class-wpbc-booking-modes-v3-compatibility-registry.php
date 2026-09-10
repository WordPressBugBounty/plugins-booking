<?php
/**
 * Released-shape compatibility registry for Booking Modes V3.
 *
 * @package Booking Calendar
 * @since   11.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Expose V1-shaped summaries to existing paid and extension callbacks once.
 */
final class WPBC_Booking_Modes_V3_Compatibility_Registry {

	/** @var int Maximum normalized modes accepted from the released filter. */
	const MAX_MODES = 64;

	/** @var WPBC_Booking_Modes_V3_Compatibility_Registry|null */
	private static $instance = null;

	/** @var array<string,array<string,mixed>>|null */
	private $modes = null;

	/** @var array<string,array<string,mixed>> */
	private $default_modes = array();

	/** @var array<int,string>|null */
	private $allowed_mode_ids = null;

	/** @var array<string,array<string,mixed>> */
	private $page_placement_changes = array();

	/** @var array<string,array<string,mixed>> */
	private $compiler_definitions = array();

	/** @var int */
	private $build_count = 0;

	/**
	 * Prevent direct construction.
	 */
	private function __construct() {}

	/**
	 * Return the shared request-local compatibility registry.
	 *
	 * @return WPBC_Booking_Modes_V3_Compatibility_Registry Registry instance.
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Return all modes in the released V1 public shape.
	 *
	 * The focused V3 compiler never consumes the filtered result, preventing old
	 * presentation arrays from becoming authorization or declaration input.
	 *
	 * @return array<string,array<string,mixed>> Compatibility mode summaries.
	 */
	public function get_all() {
		if ( null !== $this->modes ) {
			return $this->modes;
		}

		$modes = array();
		foreach ( WPBC_Booking_Modes_V3_Definition_Registry::get_instance()->get_definitions() as $mode_id => $definition ) {
			$modes[ $mode_id ] = $this->build_legacy_mode( $definition );
		}
		if ( ! WPBC_Booking_Modes_V3_Definition_Translator::is_translation_ready() ) {
			return $this->normalize_modes( $modes, $modes );
		}

		++$this->build_count;
		$this->default_modes = $modes;

		/**
		 * Filter registered Booking Calendar modes using the released V1 shape.
		 *
		 * @param array $modes Mode summaries keyed by stable ID.
		 */
		$filtered_modes = apply_filters( 'wpbc_booking_modes_registered_modes', $modes );
		$this->modes    = $this->normalize_modes( $filtered_modes, $modes );

		return $this->modes;
	}

	/**
	 * Return one released-shape mode summary.
	 *
	 * @param string $mode_id Stable mode ID.
	 *
	 * @return array<string,mixed>|null Mode summary or null.
	 */
	public function get( $mode_id ) {
		$mode_id = is_scalar( $mode_id ) ? sanitize_key( (string) $mode_id ) : '';
		$modes   = $this->get_all();

		return isset( $modes[ $mode_id ] ) ? $modes[ $mode_id ] : null;
	}

	/**
	 * Return mode IDs allowed for this owner, restricted to validated V3 modes.
	 *
	 * @return array<int,string> Allowed mode identifiers.
	 */
	public function get_allowed_mode_ids() {
		if ( null !== $this->allowed_mode_ids ) {
			return $this->allowed_mode_ids;
		}

		$modes            = $this->get_all();
		$allowed_mode_ids = array_keys( $modes );
		if ( ! WPBC_Booking_Modes_V3_Definition_Translator::is_translation_ready() ) {
			return in_array( 'classic', $allowed_mode_ids, true ) ? $allowed_mode_ids : array_merge( array( 'classic' ), $allowed_mode_ids );
		}
		$context          = WPBC_Booking_Modes_V3_Context::get_instance()->get_context();

		/**
		 * Filter allowed mode IDs using the released hook arguments.
		 *
		 * @param array $allowed_mode_ids Validated bundled mode IDs.
		 * @param array $modes            Released-shape mode summaries.
		 * @param array $context          Cached request context.
		 */
		$allowed_mode_ids = apply_filters( 'wpbc_booking_modes_allowed_mode_ids', $allowed_mode_ids, $modes, $context );
		$allowed_mode_ids = is_array( $allowed_mode_ids ) ? $allowed_mode_ids : array();
		$normalized       = array();
		foreach ( array_slice( $allowed_mode_ids, 0, WPBC_Booking_Modes_V3_Definition_Validator::MAX_COLLECTION_ENTRIES ) as $mode_id ) {
			$mode_id = is_scalar( $mode_id ) ? sanitize_key( (string) $mode_id ) : '';
			if ( isset( $modes[ $mode_id ] ) && ! in_array( $mode_id, $normalized, true ) ) {
				$normalized[] = $mode_id;
			}
		}
		if ( ! in_array( 'classic', $normalized, true ) ) {
			array_unshift( $normalized, 'classic' );
		}

		$this->allowed_mode_ids = $normalized;
		return $normalized;
	}

	/**
	 * Return a validated bundled definition or a bounded custom-mode adapter.
	 *
	 * Custom modes remain a released public contract. Their legacy placement and
	 * native-menu records are processed separately by the compiler; this compact
	 * declaration supplies only identity, default route, and canonical routes.
	 *
	 * @param string $mode_id Selected registered mode ID.
	 *
	 * @return array<string,mixed>|null Compiler definition or null when unknown.
	 */
	public function get_compiler_definition( $mode_id ) {
		$mode_id = is_scalar( $mode_id ) ? sanitize_key( (string) $mode_id ) : '';
		$bundled = WPBC_Booking_Modes_V3_Definition_Registry::get_instance()->get_definition( $mode_id );
		if ( is_array( $bundled ) ) {
			return $bundled;
		}
		if ( isset( $this->compiler_definitions[ $mode_id ] ) ) {
			return $this->compiler_definitions[ $mode_id ];
		}

		$mode = $this->get( $mode_id );
		if ( ! is_array( $mode ) ) {
			return null;
		}

		$default_page  = WPBC_Booking_Modes_V3_Page_Registry::get_instance()->get( $mode['default_page'] );
		$default_route = is_array( $default_page )
			? array( 'page' => $default_page['page'], 'tab' => $default_page['tab'], 'subtab' => $default_page['subtab'] )
			: array( 'page' => 'wpbc', 'tab' => 'vm_booking_listing', 'subtab' => '' );
		$pages = array();
		foreach ( $mode['pages'] as $canonical_page_id => $placement ) {
			unset( $placement );
			$canonical_page = WPBC_Booking_Modes_V3_Page_Registry::get_instance()->get( $canonical_page_id );
			if ( ! is_array( $canonical_page ) ) {
				continue;
			}
			$pages[ $canonical_page_id ] = array(
				'route' => array(
					'page'   => $canonical_page['page'],
					'tab'    => $canonical_page['tab'],
					'subtab' => $canonical_page['subtab'],
				),
			);
		}

		$this->compiler_definitions[ $mode_id ] = array(
			'id'             => $mode_id,
			'label'          => $mode['label'],
			'description'    => $mode['description'],
			'default_route'  => $default_route,
			'quickstart_id'  => $mode['quickstart_id'],
			'pages'          => $pages,
			'wordpress_menu' => array(),
			'sidebar_menu'   => array(),
		);

		return $this->compiler_definitions[ $mode_id ];
	}

	/**
	 * Return normalized native overrides after the released registry filter.
	 *
	 * @param string $mode_id Registered mode ID.
	 *
	 * @return array<string,array<string,mixed>> Native overrides.
	 */
	public function get_native_menu( $mode_id ) {
		$mode = $this->get( $mode_id );

		return is_array( $mode ) ? $mode['native_menu'] : array();
	}

	/**
	 * Return normalized legacy root-group presentation for one mode.
	 *
	 * @param string $mode_id Registered mode ID.
	 *
	 * @return array<string,array<string,mixed>> Root group presentation.
	 */
	public function get_groups( $mode_id ) {
		$mode = $this->get( $mode_id );

		return is_array( $mode ) ? $mode['groups'] : array();
	}

	/**
	 * Apply the released placement hook once and return changes from V3 defaults.
	 *
	 * A custom mode has no bundled baseline, so its complete bounded placement map
	 * is returned as the compatibility change set.
	 *
	 * @param string $mode_id            Selected registered mode ID.
	 * @param array  $available_page_ids Canonical source IDs available now.
	 *
	 * @return array<string,mixed> Changed placements and removed canonical IDs.
	 */
	public function get_page_placement_changes( $mode_id, $available_page_ids ) {
		$cache_key = $mode_id . '|' . implode( ',', $available_page_ids );
		if ( isset( $this->page_placement_changes[ $cache_key ] ) ) {
			return $this->page_placement_changes[ $cache_key ];
		}

		$mode      = $this->get( $mode_id );
		$placement = is_array( $mode ) ? $mode['pages'] : array();
		$context   = WPBC_Booking_Modes_V3_Context::get_instance()->get_context();
		$placement = apply_filters( 'wpbc_booking_modes_mode_page_placement', $placement, $mode_id, $mode, $available_page_ids, $context );
		$placement = $this->normalize_page_placements( $placement );
		$baseline  = isset( $this->default_modes[ $mode_id ] ) ? $this->default_modes[ $mode_id ]['pages'] : array();
		$changes   = array();
		$removed   = array();

		foreach ( $placement as $page_id => $page_placement ) {
			if ( ! isset( $baseline[ $page_id ] ) || $baseline[ $page_id ] !== $page_placement ) {
				$changes[ $page_id ] = $page_placement;
			}
		}
		foreach ( $baseline as $page_id => $page_placement ) {
			unset( $page_placement );
			if ( ! isset( $placement[ $page_id ] ) ) {
				$removed[] = $page_id;
			}
		}
		if ( ! isset( $this->default_modes[ $mode_id ] ) && is_array( $mode ) && empty( $mode['preserve_unmapped_pages'] ) ) {
			foreach ( $available_page_ids as $page_id ) {
				$page_id = is_scalar( $page_id ) ? sanitize_key( (string) $page_id ) : '';
				if ( '' !== $page_id && ! isset( $placement[ $page_id ] ) && ! in_array( $page_id, $removed, true ) ) {
					$removed[] = $page_id;
				}
			}
		}

		$this->page_placement_changes[ $cache_key ] = array(
			'placements' => $changes,
			'removed'    => $removed,
			'resolved'   => $placement,
		);

		return $this->page_placement_changes[ $cache_key ];
	}

	/**
	 * Return the bounded placement map passed through the released page hook.
	 *
	 * @param string $mode_id            Selected registered mode ID.
	 * @param array  $available_page_ids Canonical source IDs available now.
	 *
	 * @return array<string,array<string,mixed>> Resolved canonical placements.
	 */
	public function get_resolved_page_placements( $mode_id, $available_page_ids ) {
		$change_set = $this->get_page_placement_changes( $mode_id, $available_page_ids );

		return isset( $change_set['resolved'] ) && is_array( $change_set['resolved'] ) ? $change_set['resolved'] : array();
	}

	/**
	 * Return the number of public compatibility builds.
	 *
	 * @return int Build count.
	 */
	public function get_build_count() {
		return $this->build_count;
	}

	/**
	 * Translate one validated V3 definition to the released summary shape.
	 *
	 * @param array $definition Validated V3 definition.
	 *
	 * @return array<string,mixed> Released-shape summary.
	 */
	private function build_legacy_mode( $definition ) {
		$mode = array(
			'id'                      => $definition['id'],
			'label'                   => $definition['label'],
			'description'             => $definition['description'],
			'default_page'            => $this->find_canonical_page_id( $definition['default_route'] ),
			'preserve_unmapped_pages' => true,
			'groups'                  => array(),
			'pages'                   => array(),
			'native_menu'             => array(),
			'quickstart_id'           => $definition['quickstart_id'],
		);

		$group_position = 0;
		foreach ( $definition['sidebar_menu'] as $group_id => $group_definition ) {
			$group_position += 10;
			$mode['groups'][ $group_id ] = array(
				'title'     => isset( $group_definition['title'] ) ? $group_definition['title'] : $group_id,
				'position'  => $group_position,
				'font_icon' => isset( $group_definition['font_icon'] ) ? $group_definition['font_icon'] : '',
				'visible'   => ! isset( $group_definition['visible'] ) || false !== $group_definition['visible'],
			);
		}

		foreach ( $definition['sidebar_menu'] as $group_id => $group_definition ) {
			if ( isset( $group_definition['page_id'] ) ) {
				$this->add_legacy_sidebar_placement( $mode['pages'], $definition, $group_definition['page_id'], $group_id, $group_id, $group_definition, 10 );
			}
			if ( isset( $group_definition['items'] ) && is_array( $group_definition['items'] ) ) {
				$this->add_legacy_sidebar_placements( $mode['pages'], $definition, $group_definition['items'], $group_id );
			}
		}

		$native_position = 0;
		foreach ( $definition['wordpress_menu'] as $menu_slug => $menu_definition ) {
			$native_position += 10;
			$native_menu = array(
				'position' => $native_position,
				'visible'  => isset( $menu_definition['visible'] ) ? $menu_definition['visible'] : true,
			);
			if ( array_key_exists( 'title', $menu_definition ) ) {
				$native_menu['title'] = $menu_definition['title'];
			}
			$mode['native_menu'][ $menu_slug ] = $native_menu;
		}

		return $mode;
	}

	/**
	 * Normalize filtered mode summaries and always preserve bundled Classic.
	 *
	 * @param mixed $filtered_modes Filter result.
	 * @param array $default_modes  Bundled summaries.
	 *
	 * @return array<string,array<string,mixed>> Normalized summaries.
	 */
	private function normalize_modes( $filtered_modes, $default_modes ) {
		$normalized = array();
		$filtered_modes = is_array( $filtered_modes ) ? $filtered_modes : array();
		foreach ( array_slice( $filtered_modes, 0, WPBC_Booking_Modes_V3_Definition_Validator::MAX_COLLECTION_ENTRIES, true ) as $mode_id => $mode ) {
			if ( count( $normalized ) >= self::MAX_MODES ) {
				break;
			}
			$mode_id = is_scalar( $mode_id ) ? sanitize_key( (string) $mode_id ) : '';
			if ( '' === $mode_id || ! is_array( $mode ) ) {
				continue;
			}
			$mode = wp_parse_args(
				$mode,
				array( 'id' => $mode_id, 'label' => $mode_id, 'description' => '', 'default_page' => '', 'preserve_unmapped_pages' => false, 'groups' => array(), 'pages' => array(), 'native_menu' => array(), 'quickstart_id' => '' )
			);
			$mode['id']                      = $mode_id;
			$mode['label']                   = is_scalar( $mode['label'] ) ? wp_strip_all_tags( (string) $mode['label'] ) : $mode_id;
			$mode['description']             = is_scalar( $mode['description'] ) ? wp_strip_all_tags( (string) $mode['description'] ) : '';
			$mode['default_page']            = is_scalar( $mode['default_page'] ) ? sanitize_key( (string) $mode['default_page'] ) : '';
			$mode['preserve_unmapped_pages'] = (bool) $mode['preserve_unmapped_pages'];
			$mode['groups']                  = $this->normalize_groups( $mode['groups'] );
			$mode['pages']                   = $this->normalize_page_placements( $mode['pages'] );
			$mode['native_menu']             = $this->normalize_native_menu( $mode['native_menu'] );
			$mode['quickstart_id']           = is_scalar( $mode['quickstart_id'] ) ? sanitize_key( (string) $mode['quickstart_id'] ) : '';
			$normalized[ $mode_id ]          = $mode;
		}
		if ( ! isset( $normalized['classic'] ) ) {
			$normalized['classic'] = $default_modes['classic'];
		}

		return $normalized;
	}

	/**
	 * Add ordered legacy placements from a recursive V3 sidebar declaration.
	 *
	 * @param array  $placements Legacy placements passed by reference.
	 * @param array  $definition Validated V3 definition.
	 * @param array  $nodes      Sidebar node declarations.
	 * @param string $group_id   Root presentation group.
	 *
	 * @return void
	 */
	private function add_legacy_sidebar_placements( &$placements, $definition, $nodes, $group_id ) {
		$position = 0;
		foreach ( $nodes as $navigation_key => $node ) {
			$position += 10;
			if ( isset( $node['page_id'] ) ) {
				$this->add_legacy_sidebar_placement( $placements, $definition, $node['page_id'], $group_id, $navigation_key, $node, $position );
			}
			if ( isset( $node['items'] ) && is_array( $node['items'] ) ) {
				$this->add_legacy_sidebar_placements( $placements, $definition, $node['items'], $group_id );
			}
		}
	}

	/**
	 * Add one V3 local page to the released canonical placement shape.
	 *
	 * @param array  $placements    Legacy placements passed by reference.
	 * @param array  $definition    Validated V3 definition.
	 * @param string $local_page_id Local V3 page ID.
	 * @param string $group_id      Root presentation group.
	 * @param string $navigation_key Presentation key.
	 * @param array  $node          Sidebar presentation overrides.
	 * @param int    $position      Stable sibling position.
	 *
	 * @return void
	 */
	private function add_legacy_sidebar_placement( &$placements, $definition, $local_page_id, $group_id, $navigation_key, $node, $position ) {
		if ( ! isset( $definition['pages'][ $local_page_id ] ) ) {
			return;
		}
		$canonical_page_id = $this->find_canonical_page_id( $definition['pages'][ $local_page_id ]['route'] );
		if ( '' === $canonical_page_id ) {
			return;
		}
		$placement = array(
			'visible'        => ! isset( $node['visible'] ) || false !== $node['visible'],
			'position'       => absint( $position ),
			'group'          => sanitize_key( $group_id ),
			'navigation_key' => sanitize_key( $navigation_key ),
		);
		foreach ( array( 'title', 'font_icon', 'font_icon_right' ) as $presentation_key ) {
			if ( array_key_exists( $presentation_key, $node ) ) {
				$placement[ $presentation_key ] = $node[ $presentation_key ];
			}
		}
		$placements[ $canonical_page_id ] = $placement;
	}

	/**
	 * Normalize released group presentation records with bounded work.
	 *
	 * @param mixed $groups Filtered group map.
	 *
	 * @return array<string,array<string,mixed>> Normalized groups.
	 */
	private function normalize_groups( $groups ) {
		$normalized = array();
		foreach ( is_array( $groups ) ? array_slice( $groups, 0, WPBC_Booking_Modes_V3_Definition_Validator::MAX_COLLECTION_ENTRIES, true ) : array() as $group_id => $group ) {
			$group_id = is_scalar( $group_id ) ? sanitize_key( (string) $group_id ) : '';
			if ( '' === $group_id || ! is_array( $group ) ) {
				continue;
			}
			$normalized[ $group_id ] = array(
				'title'     => isset( $group['title'] ) && is_scalar( $group['title'] ) ? wp_strip_all_tags( (string) $group['title'] ) : $group_id,
				'position'  => isset( $group['position'] ) ? absint( $group['position'] ) : 1000,
				'font_icon' => isset( $group['font_icon'] ) && is_scalar( $group['font_icon'] ) ? (string) $group['font_icon'] : '',
				'visible'   => ! isset( $group['visible'] ) || (bool) $group['visible'],
			);
		}

		return $normalized;
	}

	/**
	 * Normalize released canonical page placements with bounded scalar fields.
	 *
	 * @param mixed $placements Filtered placement map.
	 *
	 * @return array<string,array<string,mixed>> Normalized placements.
	 */
	private function normalize_page_placements( $placements ) {
		$normalized = array();
		foreach ( is_array( $placements ) ? array_slice( $placements, 0, WPBC_Booking_Modes_V3_Definition_Validator::MAX_COLLECTION_ENTRIES, true ) : array() as $page_id => $placement ) {
			$page_id = is_scalar( $page_id ) ? sanitize_key( (string) $page_id ) : '';
			if ( '' === $page_id || ! is_array( $placement ) ) {
				continue;
			}
			$normalized_placement = array(
				'visible'  => ! isset( $placement['visible'] ) || (bool) $placement['visible'],
				'position' => isset( $placement['position'] ) ? absint( $placement['position'] ) : 1000,
			);
			foreach ( array( 'group', 'navigation_key' ) as $identifier_key ) {
				if ( isset( $placement[ $identifier_key ] ) && is_scalar( $placement[ $identifier_key ] ) ) {
					$normalized_placement[ $identifier_key ] = sanitize_key( (string) $placement[ $identifier_key ] );
				}
			}
			foreach ( array( 'title', 'font_icon', 'font_icon_right' ) as $display_key ) {
				if ( array_key_exists( $display_key, $placement ) && is_scalar( $placement[ $display_key ] ) ) {
					$normalized_placement[ $display_key ] = 'title' === $display_key ? wp_strip_all_tags( (string) $placement[ $display_key ] ) : (string) $placement[ $display_key ];
				}
			}
			$normalized[ $page_id ] = $normalized_placement;
		}

		return $normalized;
	}

	/**
	 * Normalize native submenu presentation records with bounded work.
	 *
	 * @param mixed $native_menu Filtered native submenu map.
	 *
	 * @return array<string,array<string,mixed>> Normalized native overrides.
	 */
	private function normalize_native_menu( $native_menu ) {
		$normalized = array();
		foreach ( is_array( $native_menu ) ? array_slice( $native_menu, 0, WPBC_Booking_Modes_V3_Definition_Validator::MAX_COLLECTION_ENTRIES, true ) : array() as $menu_slug => $menu ) {
			$menu_slug = is_scalar( $menu_slug ) ? sanitize_key( (string) $menu_slug ) : '';
			if ( '' === $menu_slug || ! is_array( $menu ) ) {
				continue;
			}
			$normalized_menu = array(
				'position' => isset( $menu['position'] ) ? absint( $menu['position'] ) : 1000,
				'visible'  => ! isset( $menu['visible'] ) || (bool) $menu['visible'],
			);
			if ( array_key_exists( 'title', $menu ) && is_scalar( $menu['title'] ) ) {
				$normalized_menu['title'] = wp_strip_all_tags( (string) $menu['title'] );
			}
			$normalized[ $menu_slug ] = $normalized_menu;
		}

		return $normalized;
	}

	/**
	 * Resolve a source route to an existing released canonical ID.
	 *
	 * @param array $route Normalized V3 route.
	 *
	 * @return string Canonical page ID or an empty string.
	 */
	private function find_canonical_page_id( $route ) {
		foreach ( WPBC_Booking_Modes_V3_Page_Registry::get_instance()->get_all() as $page_id => $page ) {
			if ( $route['page'] === $page['page'] && $route['tab'] === $page['tab'] && $route['subtab'] === $page['subtab'] ) {
				return $page_id;
			}
		}

		return '';
	}
}
