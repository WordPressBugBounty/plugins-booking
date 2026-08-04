<?php
/**
 * Canonical administration page registry for Booking Modes.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Load and cache stable page, tab, and subtab identifiers.
 *
 * Registry entries reference existing controllers. They do not register pages,
 * grant capabilities, or determine whether an edition loaded a controller.
 */
final class WPBC_Booking_Mode_Page_Registry {

	/**
	 * Shared page registry instance.
	 *
	 * @var WPBC_Booking_Mode_Page_Registry|null
	 */
	private static $instance = null;

	/**
	 * Normalized page definitions, or null before first use.
	 *
	 * @var array|null
	 */
	private $pages = null;

	/**
	 * Number of registry builds in this request.
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
	 * @return WPBC_Booking_Mode_Page_Registry Page registry instance.
	 */
	public static function get_instance() {

		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Get all canonical page definitions.
	 *
	 * @return array Page definitions keyed by canonical identifier.
	 */
	public function get_all() {

		if ( null !== $this->pages ) {
			return $this->pages;
		}

		++$this->build_count;

		$pages = require __DIR__ . '/canonical-pages.php';
		$pages = $this->normalize_pages( $pages );

		/**
		 * Filter canonical Booking Calendar administration page definitions.
		 *
		 * Commercial editions and extensions can add stable page references here
		 * without changing the Booking Modes module. This filter runs once per
		 * request when the registry is first requested.
		 *
		 * @param array $pages Normalized page definitions keyed by canonical ID.
		 */
		$pages = apply_filters( 'wpbc_booking_modes_canonical_pages', $pages );

		$this->pages = $this->normalize_pages( $pages );

		return $this->pages;
	}

	/**
	 * Get one canonical page definition.
	 *
	 * @param string $page_id Canonical page identifier.
	 *
	 * @return array|null Page definition, or null when unknown.
	 */
	public function get( $page_id ) {

		$page_id = is_scalar( $page_id ) ? sanitize_key( (string) $page_id ) : '';
		$pages   = $this->get_all();

		return isset( $pages[ $page_id ] ) ? $pages[ $page_id ] : null;
	}

	/**
	 * Check whether a canonical page is registered.
	 *
	 * @param string $page_id Canonical page identifier.
	 *
	 * @return bool True when the page reference exists.
	 */
	public function has( $page_id ) {

		return null !== $this->get( $page_id );
	}

	/**
	 * Build an administration URL for an existing canonical route.
	 *
	 * This method does not check controller availability or capability. The
	 * existing page remains authoritative for both checks.
	 *
	 * @param string $page_id Canonical page identifier.
	 *
	 * @return string Empty string for an unknown page, otherwise its admin URL.
	 */
	public function get_url( $page_id ) {

		$page = $this->get( $page_id );

		if ( null === $page ) {
			return '';
		}

		$query_args = array( 'page' => $page['page'] );

		if ( '' !== $page['tab'] ) {
			$query_args['tab'] = $page['tab'];
		}

		if ( '' !== $page['subtab'] ) {
			$query_args['subtab'] = $page['subtab'];
		}

		return add_query_arg( $query_args, admin_url( 'admin.php' ) );
	}

	/**
	 * Get the number of page-registry builds in the current request.
	 *
	 * @return int Registry build count.
	 */
	public function get_build_count() {

		return $this->build_count;
	}

	/**
	 * Normalize a collection of canonical page definitions.
	 *
	 * @param array $pages Raw page definitions.
	 *
	 * @return array Valid normalized page definitions.
	 */
	private function normalize_pages( $pages ) {

		$normalized_pages = array();

		if ( ! is_array( $pages ) ) {
			return $normalized_pages;
		}

		foreach ( $pages as $page_id => $page_definition ) {
			$page_id = sanitize_key( $page_id );

			if ( '' === $page_id || ! is_array( $page_definition ) ) {
				continue;
			}

			$page = wp_parse_args(
				$page_definition,
				array(
					'id'          => $page_id,
					'page'        => '',
					'tab'         => '',
					'subtab'      => '',
					'title'       => '',
					'feature_id'  => '',
					'edition_id'  => '',
				)
			);

			$page['id']         = $page_id;
			$page['page']       = is_scalar( $page['page'] ) ? sanitize_key( (string) $page['page'] ) : '';
			$page['tab']        = is_scalar( $page['tab'] ) ? sanitize_key( (string) $page['tab'] ) : '';
			$page['subtab']     = is_scalar( $page['subtab'] ) ? sanitize_key( (string) $page['subtab'] ) : '';
			$page['title']      = is_scalar( $page['title'] ) ? wp_strip_all_tags( (string) $page['title'] ) : '';
			$page['feature_id'] = is_scalar( $page['feature_id'] ) ? sanitize_key( (string) $page['feature_id'] ) : '';
			$page['edition_id'] = is_scalar( $page['edition_id'] ) ? sanitize_key( (string) $page['edition_id'] ) : '';

			if ( '' === $page['page'] ) {
				continue;
			}

			$normalized_pages[ $page_id ] = $page;
		}

		return $normalized_pages;
	}
}
