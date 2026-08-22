<?php
/**
 * Shared asset boundary for template-driven administration catalogs.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register and enqueue only the assets shared by independent catalogs.
 *
 * Domain data, SQL, permissions, and mutations deliberately remain outside
 * this class. Later phases can extend the catalog mechanics without coupling
 * this foundation to an individual administration page.
 */
final class WPBC_UI_Catalog {

	/**
	 * Build a cache-safe version for one generated shared asset.
	 *
	 * Shared catalog controllers can change independently during an in-version
	 * migration. Appending the generated file modification time prevents a
	 * cached lifecycle controller from running against a newer domain adapter.
	 *
	 * @param string $asset_filename Generated `_out` asset filename.
	 *
	 * @return string Plugin version with an optional file modification suffix.
	 */
	private static function get_asset_version( $asset_filename ) {
		$asset_filename = is_scalar( $asset_filename ) ? basename( (string) $asset_filename ) : '';
		$asset_path     = __DIR__ . '/_out/' . $asset_filename;
		$modified_time  = ( '' !== $asset_filename && is_file( $asset_path ) ) ? filemtime( $asset_path ) : false;

		return false === $modified_time
			? (string) WP_BK_VERSION_NUM
			: WP_BK_VERSION_NUM . '.' . (string) $modified_time;
	}

	/**
	 * Return a browser-safe configuration for one registered catalog mount.
	 *
	 * Trusted PHP template paths and provider objects live outside the stored
	 * configuration, so the returned array can be localized directly.
	 *
	 * @param string $catalog_id      Registered catalog identifier.
	 * @param string $mount_id        HTML element ID receiving the catalog.
	 * @param array  $initial_request Normalized initial shared request.
	 * @param array  $initial_response Normalized initial response contract.
	 *
	 * @return array<string,mixed> Browser configuration or an empty array.
	 */
	public static function get_client_configuration( $catalog_id, $mount_id, $initial_request, $initial_response ) {
		$registry      = WPBC_UI_Catalog_Registry::get_instance();
		$configuration = $registry->get_configuration( $catalog_id );
		$mount_id      = is_scalar( $mount_id ) ? sanitize_html_class( (string) $mount_id ) : '';

		if ( empty( $configuration ) || '' === $mount_id || ! is_array( $initial_request ) || ! is_array( $initial_response ) ) {
			return array();
		}

		$configuration['mount_id']             = $mount_id;
		$configuration['preference_namespace'] = WPBC_UI_Catalog_Preferences::get_namespace( $catalog_id );
		$configuration['initial_request']       = $initial_request;
		$configuration['initial_response']      = $initial_response;

		return $configuration;
	}

	/**
	 * Print allow-listed shared and catalog-owned WordPress templates.
	 *
	 * @param string $catalog_id Registered catalog identifier.
	 *
	 * @return array<int,string> Template identifiers made available.
	 */
	public static function print_templates( $catalog_id ) {
		return WPBC_UI_Catalog_Template_Loader::print_catalog_templates( $catalog_id );
	}

	/**
	 * Enqueue the shared catalog stylesheet.
	 *
	 * @return void
	 */
	public static function enqueue_styles() {
		wp_enqueue_style(
			'wpbc-ui-catalog',
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/wpbc_ui_catalog.css',
			array(),
			self::get_asset_version( 'wpbc_ui_catalog.css' )
		);
	}

	/**
	 * Enqueue shared catalog, hierarchy, selection, and row-action controllers.
	 *
	 * WordPress' `wp-util` package provides the allow-listed `wp.template()`
	 * renderer used by every template-driven catalog. The catalog script also
	 * exposes opt-in inline-workflow mechanics for sticky bars, busy controls,
	 * and changed-row presentation. Hierarchy, selection, inline workflow, and
	 * action menus do not perform domain reads or mutations.
	 *
	 * @return void
	 */
	public static function enqueue_scripts() {
		wp_enqueue_script(
			'wpbc-ui-catalog-sortable',
			wpbc_plugin_url( '/vendors/sortablejs/Sortable.min.js' ),
			array(),
			WP_BK_VERSION_NUM,
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
		wp_enqueue_script(
			'wpbc-ui-catalog',
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/wpbc_ui_catalog.js',
			array( 'wp-util', 'wpbc-ui-catalog-sortable' ),
			self::get_asset_version( 'wpbc_ui_catalog.js' ),
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
		wp_enqueue_script(
			'wpbc-ui-catalog-hierarchy',
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/wpbc_ui_catalog_hierarchy.js',
			array( 'wpbc-ui-catalog' ),
			self::get_asset_version( 'wpbc_ui_catalog_hierarchy.js' ),
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
		wp_enqueue_script(
			'wpbc-ui-catalog-selection',
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/wpbc_ui_catalog_selection.js',
			array( 'wpbc-ui-catalog' ),
			self::get_asset_version( 'wpbc_ui_catalog_selection.js' ),
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
		wp_enqueue_script(
			'wpbc-ui-catalog-actions',
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/wpbc_ui_catalog_actions.js',
			array( 'wpbc-ui-catalog' ),
			self::get_asset_version( 'wpbc_ui_catalog_actions.js' ),
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}
}
