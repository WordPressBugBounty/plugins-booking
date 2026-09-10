<?php
/**
 * Lazy source metadata index for Booking Modes V3.
 *
 * @package Booking Calendar
 * @since   11.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Capture the fully contributed page tree once and index routes without HTML.
 */
final class WPBC_Booking_Modes_V3_Source_Index {

	/** @var int Maximum accepted contributor nodes per request. */
	const MAX_SOURCE_NODES = 2048;

	/** @var int Maximum accepted contributor navigation depth. */
	const MAX_SOURCE_DEPTH = 8;

	/** @var WPBC_Booking_Modes_V3_Source_Index|null */
	private static $instance = null;

	/** @var array<string,array<string,mixed>> */
	private $navigation = array();

	/** @var array<string,array<string,mixed>> */
	private $routes = array();

	/** @var int */
	private $capture_count = 0;

	/**
	 * Prevent direct construction.
	 */
	private function __construct() {}

	/**
	 * Return the shared request-local source index.
	 *
	 * @return WPBC_Booking_Modes_V3_Source_Index Source index.
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Capture the first complete non-empty contributed tree.
	 *
	 * The shared page structure remains authoritative. This method never calls a
	 * page controller, content callback, save handler, or domain constructor.
	 *
	 * @param array $navigation Registered page, tab, and subtab metadata.
	 *
	 * @return void
	 */
	public function capture( $navigation ) {
		if ( ! empty( $this->navigation ) || ! is_array( $navigation ) || empty( $navigation ) ) {
			return;
		}

		++$this->capture_count;
		$remaining_nodes = self::MAX_SOURCE_NODES;
		$this->navigation = $this->bound_navigation( $navigation, 1, $remaining_nodes );

		foreach ( $this->navigation as $page_slug => $tabs ) {
			if ( ! is_array( $tabs ) ) {
				continue;
			}
			foreach ( $tabs as $tab_slug => $tab ) {
				if ( ! is_array( $tab ) ) {
					continue;
				}
				$route = array( 'page' => $page_slug, 'tab' => $tab_slug, 'subtab' => '' );
				$this->routes[ self::get_route_key( $route ) ] = array(
					'page'   => $page_slug,
					'tab'    => $tab_slug,
					'subtab' => '',
					'node'   => $tab,
				);

				$subtabs = isset( $tab['subtabs'] ) && is_array( $tab['subtabs'] ) ? $tab['subtabs'] : array();
				foreach ( $subtabs as $subtab_slug => $subtab ) {
					if ( ! is_array( $subtab ) ) {
						continue;
					}
					$route = array( 'page' => $page_slug, 'tab' => $tab_slug, 'subtab' => $subtab_slug );
					$this->routes[ self::get_route_key( $route ) ] = array(
						'page'        => $page_slug,
						'tab'         => $tab_slug,
						'subtab'      => $subtab_slug,
						'node'        => $subtab,
						'parent_node' => $tab,
					);
				}
			}
		}
	}

	/**
	 * Bound contributor navigation while preserving each accepted source node.
	 *
	 * Only recursive `subtabs` collections are traversed. Other source metadata,
	 * including callbacks, URLs, capabilities, and domain presentation fields,
	 * remains byte-for-byte in the accepted node.
	 *
	 * @param array $nodes     Contributor navigation at the current depth.
	 * @param int   $depth     Current tree depth.
	 * @param int   $remaining Remaining node budget passed by reference.
	 *
	 * @return array Bounded navigation in original contributor order.
	 */
	private function bound_navigation( $nodes, $depth, &$remaining ) {
		$bounded = array();
		if ( ! is_array( $nodes ) || $depth > self::MAX_SOURCE_DEPTH || $remaining <= 0 ) {
			return $bounded;
		}

		foreach ( array_slice( $nodes, 0, WPBC_Booking_Modes_V3_Definition_Validator::MAX_COLLECTION_ENTRIES, true ) as $node_key => $node ) {
			if ( $remaining <= 0 ) {
				break;
			}
			if ( 1 === $depth ) {
				if ( ! is_array( $node ) ) {
					continue;
				}
				$bounded[ $node_key ] = $this->bound_navigation( $node, $depth + 1, $remaining );
				continue;
			}
			if ( ! is_array( $node ) ) {
				continue;
			}

			--$remaining;
			$bounded_node = $node;
			if ( isset( $node['subtabs'] ) ) {
				$bounded_node['subtabs'] = $this->bound_navigation( $node['subtabs'], $depth + 1, $remaining );
			}
			$bounded[ $node_key ] = $bounded_node;
		}

		return $bounded;
	}

	/**
	 * Return one indexed route record.
	 *
	 * @param array $route Normalized route with page, tab, and subtab keys.
	 *
	 * @return array<string,mixed>|null Source record or null when unavailable.
	 */
	public function get_record( $route ) {
		$route_key = self::get_route_key( $route );

		return isset( $this->routes[ $route_key ] ) ? $this->routes[ $route_key ] : null;
	}

	/**
	 * Return the immutable source navigation snapshot.
	 *
	 * @return array<string,array<string,mixed>> Source navigation.
	 */
	public function get_navigation() {
		return $this->navigation;
	}

	/**
	 * Return the number of source captures in this request.
	 *
	 * @return int Capture count.
	 */
	public function get_capture_count() {
		return $this->capture_count;
	}

	/**
	 * Build a collision-safe key for one normalized route.
	 *
	 * @param array $route Route fields.
	 *
	 * @return string Route index key.
	 */
	public static function get_route_key( $route ) {
		$page   = isset( $route['page'] ) && is_scalar( $route['page'] ) ? (string) $route['page'] : '';
		$tab    = isset( $route['tab'] ) && is_scalar( $route['tab'] ) ? (string) $route['tab'] : '';
		$subtab = isset( $route['subtab'] ) && is_scalar( $route['subtab'] ) ? (string) $route['subtab'] : '';

		return strlen( $page ) . ':' . $page . '|' . strlen( $tab ) . ':' . $tab . '|' . strlen( $subtab ) . ':' . $subtab;
	}
}
