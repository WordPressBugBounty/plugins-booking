<?php
/**
 * Cached Booking Modes navigation boundary.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve the legacy administration navigation tree once for presentation.
 *
 * Existing page controllers continue using the original tree for activation,
 * capabilities, rendering, and direct-route access. Only navigation consumers
 * receive the cached, filtered presentation tree returned by this class.
 */
final class WPBC_Booking_Mode_Navigation {

	/**
	 * Shared resolver instance.
	 *
	 * @var WPBC_Booking_Mode_Navigation|null
	 */
	private static $instance = null;

	/**
	 * Complete legacy navigation supplied at the shared consumer boundary.
	 *
	 * @var array|null
	 */
	private $legacy_navigation = null;

	/**
	 * Cached presentation navigation.
	 *
	 * @var array|null
	 */
	private $resolved_navigation = null;

	/**
	 * Canonical page identifiers available in the legacy tree.
	 *
	 * @var array
	 */
	private $available_page_ids = array();

	/**
	 * Normalized placement map for the selected mode.
	 *
	 * @var array
	 */
	private $mode_page_placement = array();

	/**
	 * Number of navigation resolutions in the current request.
	 *
	 * @var int
	 */
	private $build_count = 0;

	/**
	 * Prevent direct construction.
	 */
	private function __construct() {}

	/**
	 * Get the shared request instance.
	 *
	 * @return WPBC_Booking_Mode_Navigation Navigation resolver instance.
	 */
	public static function get_instance() {

		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Resolve a complete legacy navigation tree for presentation.
	 *
	 * The first non-empty tree is authoritative for the request. This method is
	 * called from the shared navigation getter after the legacy menu callbacks
	 * have completed, and subsequent renderers receive the same cached result.
	 *
	 * @param array $legacy_navigation Complete legacy page, tab, and subtab tree.
	 *
	 * @return array Cached presentation navigation tree.
	 */
	public function resolve( $legacy_navigation ) {

		if ( null !== $this->resolved_navigation ) {
			return $this->resolved_navigation;
		}

		if ( ! is_array( $legacy_navigation ) || empty( $legacy_navigation ) ) {
			return is_array( $legacy_navigation ) ? $legacy_navigation : array();
		}

		++$this->build_count;

		$this->legacy_navigation  = $legacy_navigation;
		$this->available_page_ids = $this->resolve_available_page_ids( $legacy_navigation );

		$mode_id                 = wpbc_booking_modes_get_selected_mode_id();
		$mode                    = wpbc_booking_modes_get_mode( $mode_id );
		$context                 = wpbc_booking_modes_get_context();
		$mode_page_placement     = is_array( $mode ) && isset( $mode['pages'] ) && is_array( $mode['pages'] ) ? $mode['pages'] : array();

		/**
		 * Filter the selected mode's canonical page placement map.
		 *
		 * Placement describes presentation only. It must not register controllers,
		 * grant capabilities, or block direct access to an existing route.
		 *
		 * @param array  $mode_page_placement Canonical page placement map.
		 * @param string $mode_id             Selected mode identifier.
		 * @param array  $mode                Selected normalized mode definition.
		 * @param array  $available_page_ids  Canonical IDs present in the legacy tree.
		 * @param array  $context             Cached request and owner context.
		 */
		$mode_page_placement = apply_filters( 'wpbc_booking_modes_mode_page_placement', $mode_page_placement, $mode_id, $mode, $this->available_page_ids, $context );
		$this->mode_page_placement = is_array( $mode_page_placement ) ? $mode_page_placement : array();

		$preserve_unmapped_pages = is_array( $mode ) && ! empty( $mode['preserve_unmapped_pages'] );
		$resolved_navigation     = $this->apply_mode_page_placement( $legacy_navigation, $this->mode_page_placement, $preserve_unmapped_pages );

		/**
		 * Filter the complete resolved administration navigation tree.
		 *
		 * This is the single presentation boundary for the internal vertical and
		 * horizontal navigation renderers. It runs no more than once per request.
		 * Unknown commercial and extension pages should be preserved unless their
		 * defining extension deliberately changes them here.
		 *
		 * @param array  $resolved_navigation Complete legacy-compatible navigation.
		 * @param string $mode_id             Selected mode identifier.
		 * @param array  $mode_page_placement Normalized canonical placement map.
		 * @param array  $available_page_ids  Canonical IDs present in the legacy tree.
		 * @param array  $context             Cached request and owner context.
		 */
		$filtered_navigation = apply_filters( 'wpbc_booking_modes_resolved_navigation', $resolved_navigation, $mode_id, $this->mode_page_placement, $this->available_page_ids, $context );

		$this->resolved_navigation = is_array( $filtered_navigation ) ? $filtered_navigation : $legacy_navigation;

		return $this->resolved_navigation;
	}

	/**
	 * Get the captured legacy navigation tree.
	 *
	 * @return array Empty before resolution, otherwise the unmodified source tree.
	 */
	public function get_legacy_navigation() {

		return is_array( $this->legacy_navigation ) ? $this->legacy_navigation : array();
	}

	/**
	 * Get canonical page identifiers available in the captured legacy tree.
	 *
	 * @return array Canonical page identifiers in registry order.
	 */
	public function get_available_page_ids() {

		return $this->available_page_ids;
	}

	/**
	 * Get the selected mode's normalized page placement map.
	 *
	 * @return array Canonical page placement map.
	 */
	public function get_mode_page_placement() {

		return $this->mode_page_placement;
	}

	/**
	 * Get the number of navigation resolutions in the current request.
	 *
	 * @return int Navigation build count.
	 */
	public function get_build_count() {

		return $this->build_count;
	}

	/**
	 * Find canonical routes that exist in the legacy navigation tree.
	 *
	 * @param array $legacy_navigation Complete legacy navigation tree.
	 *
	 * @return array Available canonical page identifiers.
	 */
	private function resolve_available_page_ids( $legacy_navigation ) {

		$available_page_ids = array();
		$canonical_pages    = wpbc_booking_modes_get_canonical_pages();

		foreach ( $canonical_pages as $page_id => $canonical_page ) {
			$page_tag   = $canonical_page['page'];
			$tab_tag    = $canonical_page['tab'];
			$subtab_tag = $canonical_page['subtab'];

			if ( ! isset( $legacy_navigation[ $page_tag ] ) || ! is_array( $legacy_navigation[ $page_tag ] ) ) {
				continue;
			}

			if ( '' === $tab_tag ) {
				$available_page_ids[] = $page_id;
				continue;
			}

			if ( ! isset( $legacy_navigation[ $page_tag ][ $tab_tag ] ) || ! is_array( $legacy_navigation[ $page_tag ][ $tab_tag ] ) ) {
				continue;
			}

			if ( '' !== $subtab_tag ) {
				$subtabs = isset( $legacy_navigation[ $page_tag ][ $tab_tag ]['subtabs'] ) && is_array( $legacy_navigation[ $page_tag ][ $tab_tag ]['subtabs'] )
					? $legacy_navigation[ $page_tag ][ $tab_tag ]['subtabs']
					: array();

				if ( ! isset( $subtabs[ $subtab_tag ] ) ) {
					continue;
				}
			}

			$available_page_ids[] = $page_id;
		}

		return $available_page_ids;
	}

	/**
	 * Apply a mode definition to the legacy presentation tree.
	 *
	 * Registered canonical routes omitted from a mode are removed from navigation
	 * unless that mode explicitly preserves unmapped legacy pages. Unknown
	 * extension routes remain untouched, and the original controller tree is
	 * never modified outside this copied array.
	 *
	 * @param array  $legacy_navigation   Complete legacy navigation tree.
	 * @param array  $mode_page_placement Canonical placement definitions.
	 * @param bool   $preserve_unmapped_pages Whether omitted canonical pages remain visible.
	 *
	 * @return array Mode-specific presentation tree.
	 */
	private function apply_mode_page_placement( $legacy_navigation, $mode_page_placement, $preserve_unmapped_pages ) {

		if ( empty( $mode_page_placement ) ) {
			return $legacy_navigation;
		}

		$resolved_navigation = $legacy_navigation;
		$canonical_pages     = wpbc_booking_modes_get_canonical_pages();

		foreach ( $canonical_pages as $page_id => $canonical_page ) {
			$page_tag   = $canonical_page['page'];
			$tab_tag    = $canonical_page['tab'];
			$subtab_tag = $canonical_page['subtab'];

			if ( '' === $tab_tag || ! isset( $resolved_navigation[ $page_tag ][ $tab_tag ] ) ) {
				continue;
			}

			$page_placement = isset( $mode_page_placement[ $page_id ] ) && is_array( $mode_page_placement[ $page_id ] )
				? $mode_page_placement[ $page_id ]
				: null;

			if ( null === $page_placement && $preserve_unmapped_pages ) {
				continue;
			}

			if ( null === $page_placement || ( isset( $page_placement['visible'] ) && false === (bool) $page_placement['visible'] ) ) {
				if ( '' !== $subtab_tag && isset( $resolved_navigation[ $page_tag ][ $tab_tag ]['subtabs'][ $subtab_tag ] ) ) {
					unset( $resolved_navigation[ $page_tag ][ $tab_tag ]['subtabs'][ $subtab_tag ] );
				} elseif ( '' === $subtab_tag ) {
					unset( $resolved_navigation[ $page_tag ][ $tab_tag ] );
				}
				continue;
			}

			if ( '' !== $subtab_tag && isset( $resolved_navigation[ $page_tag ][ $tab_tag ]['subtabs'][ $subtab_tag ] ) ) {
				$resolved_navigation[ $page_tag ][ $tab_tag ]['subtabs'][ $subtab_tag ] = $this->apply_item_presentation(
					$resolved_navigation[ $page_tag ][ $tab_tag ]['subtabs'][ $subtab_tag ],
					$page_placement
				);
			} else {
				$resolved_navigation[ $page_tag ][ $tab_tag ] = $this->apply_item_presentation(
					$resolved_navigation[ $page_tag ][ $tab_tag ],
					$page_placement
				);
			}
		}

		foreach ( $resolved_navigation as $page_tag => $page_navigation ) {
			if ( ! is_array( $page_navigation ) ) {
				continue;
			}

			$resolved_navigation[ $page_tag ] = $this->sort_presentation_items( $page_navigation );

			foreach ( $resolved_navigation[ $page_tag ] as $tab_tag => $tab_definition ) {
				if ( ! empty( $tab_definition['subtabs'] ) && is_array( $tab_definition['subtabs'] ) ) {
					$resolved_navigation[ $page_tag ][ $tab_tag ]['subtabs'] = $this->sort_presentation_items( $tab_definition['subtabs'] );
				}
			}
		}

		return $resolved_navigation;
	}

	/**
	 * Apply safe title and ordering metadata to one navigation item.
	 *
	 * @param array $navigation_item Existing legacy navigation item.
	 * @param array $page_placement Mode-specific presentation values.
	 *
	 * @return array Updated navigation item.
	 */
	private function apply_item_presentation( $navigation_item, $page_placement ) {

		if ( ! empty( $page_placement['title'] ) && is_scalar( $page_placement['title'] ) ) {
			$navigation_item['title'] = wp_strip_all_tags( (string) $page_placement['title'] );
		}

		$navigation_item['_wpbc_mode_position'] = isset( $page_placement['position'] ) ? absint( $page_placement['position'] ) : 1000;

		return $navigation_item;
	}

	/**
	 * Sort explicitly placed items while retaining unknown extension item order.
	 *
	 * @param array $navigation_items Navigation items keyed by legacy slug.
	 *
	 * @return array Sorted navigation items without private ordering metadata.
	 */
	private function sort_presentation_items( $navigation_items ) {

		$sequence = 0;

		foreach ( $navigation_items as $navigation_key => $navigation_item ) {
			$navigation_items[ $navigation_key ]['_wpbc_mode_sort'] = isset( $navigation_item['_wpbc_mode_position'] )
				? absint( $navigation_item['_wpbc_mode_position'] )
				: 10000 + $sequence;
			++$sequence;
		}

		uasort(
			$navigation_items,
			static function ( $first_item, $second_item ) {
				if ( $first_item['_wpbc_mode_sort'] === $second_item['_wpbc_mode_sort'] ) {
					return 0;
				}

				return $first_item['_wpbc_mode_sort'] < $second_item['_wpbc_mode_sort'] ? -1 : 1;
			}
		);

		foreach ( $navigation_items as $navigation_key => $navigation_item ) {
			unset( $navigation_item['_wpbc_mode_position'], $navigation_item['_wpbc_mode_sort'] );
			$navigation_items[ $navigation_key ] = $navigation_item;
		}

		return $navigation_items;
	}
}
