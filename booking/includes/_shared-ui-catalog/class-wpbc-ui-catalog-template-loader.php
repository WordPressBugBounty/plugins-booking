<?php
/**
 * Allow-listed WordPress template loader for shared catalogs.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Print shared and catalog-owned WP template files once per request.
 */
final class WPBC_UI_Catalog_Template_Loader {

	/**
	 * Template identifiers already made available in the page.
	 *
	 * @var array
	 */
	private static $printed_template_ids = array();

	/**
	 * Physical files already included in the page.
	 *
	 * @var array
	 */
	private static $printed_template_files = array();

	/**
	 * Print all registered template files referenced by one catalog.
	 *
	 * Unknown template identifiers are ignored. Paths come only from shared code
	 * or a trusted registry declaration and are never accepted from requests.
	 *
	 * @param string $catalog_id Registered catalog identifier.
	 *
	 * @return array<int,string> Template identifiers available after loading.
	 */
	public static function print_catalog_templates( $catalog_id ) {
		$catalog_id    = is_scalar( $catalog_id ) ? sanitize_key( (string) $catalog_id ) : '';
		$registry      = WPBC_UI_Catalog_Registry::get_instance();
		$configuration = $registry->get_configuration( $catalog_id );

		if ( empty( $configuration ) ) {
			return array();
		}

		$template_files = array_merge( self::get_shared_template_files(), $registry->get_template_files( $catalog_id ) );
		$template_ids   = self::get_referenced_template_ids( $configuration );

		foreach ( $template_ids as $template_id ) {
			if ( in_array( $template_id, self::$printed_template_ids, true ) || empty( $template_files[ $template_id ] ) ) {
				continue;
			}

			$template_file = $template_files[ $template_id ];
			if ( ! in_array( $template_file, self::$printed_template_files, true ) ) {
				require $template_file;
				self::$printed_template_files[] = $template_file;
			}

			self::$printed_template_ids[] = $template_id;
		}

		return array_values( array_intersect( $template_ids, array_keys( $template_files ) ) );
	}

	/**
	 * Return trusted shared template files keyed by template identifier.
	 *
	 * @return array<string,string> Shared template file map.
	 */
	private static function get_shared_template_files() {
		return array(
			'wpbc-ui-catalog-shell'           => __DIR__ . '/templates/catalog-shell-wptpl.php',
			'wpbc-ui-catalog-empty'           => __DIR__ . '/templates/catalog-empty-wptpl.php',
			'wpbc-ui-catalog-error'           => __DIR__ . '/templates/catalog-error-wptpl.php',
			'wpbc-ui-catalog-inspector-shell' => __DIR__ . '/templates/catalog-inspector-shell-wptpl.php',
		);
	}

	/**
	 * Collect template IDs declared by the base map and presentation packs.
	 *
	 * @param array $configuration Registered catalog configuration.
	 *
	 * @return array<int,string> Unique referenced template identifiers.
	 */
	private static function get_referenced_template_ids( $configuration ) {
		$template_ids = array();
		$template_maps = array();

		if ( isset( $configuration['templates'] ) && is_array( $configuration['templates'] ) ) {
			$template_maps[] = $configuration['templates'];
		}

		if ( isset( $configuration['template_packs'] ) && is_array( $configuration['template_packs'] ) ) {
			foreach ( $configuration['template_packs'] as $template_pack ) {
				if ( is_array( $template_pack ) ) {
					$template_maps[] = $template_pack;
				}
			}
		}

		foreach ( $template_maps as $template_map ) {
			foreach ( $template_map as $template_id ) {
				$template_id = is_scalar( $template_id ) ? sanitize_key( (string) $template_id ) : '';
				if ( '' !== $template_id && ! in_array( $template_id, $template_ids, true ) ) {
					$template_ids[] = $template_id;
				}
			}
		}

		return $template_ids;
	}
}
