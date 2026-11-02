<?php
/**
 * Reusable administration inspector shell registration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register domain-neutral inspector presentation and interaction mechanics.
 *
 * Domains retain ownership of authorization, requests, DTOs, templates, and
 * mutations. This component owns only dialog lifecycle, focus containment,
 * outside-click handling, loading/error states, and focus restoration.
 *
 * @since 12.0.0
 */
final class WPBC_Shared_UI_Inspector {

	/** Shared script handle. */
	const SCRIPT_HANDLE = 'wpbc-shared-ui-inspector';

	/** Shared stylesheet handle. */
	const STYLE_HANDLE = 'wpbc-shared-ui-inspector';

	/** Stable WordPress template identifier, without the `tmpl-` prefix. */
	const TEMPLATE_ID = 'wpbc-shared-ui-inspector';

	/**
	 * Enqueue the compiled inspector stylesheet.
	 *
	 * @return void
	 */
	public static function enqueue_style() {
		$asset_path     = __DIR__ . '/_out/inspector.css';
		$asset_modified = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;
		$asset_version  = false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;

		wp_enqueue_style(
			self::STYLE_HANDLE,
			WPBC_PLUGIN_URL . '/includes/_shared_ui/inspector/_out/inspector.css',
			array( 'wpbc-ui-both' ),
			$asset_version
		);
	}

	/**
	 * Enqueue the compiled inspector controller.
	 *
	 * @return void
	 */
	public static function enqueue_script() {
		$asset_path     = __DIR__ . '/_out/inspector.js';
		$asset_modified = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;
		$asset_version  = false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			WPBC_PLUGIN_URL . '/includes/_shared_ui/inspector/_out/inspector.js',
			array(),
			$asset_version,
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}

	/**
	 * Return the fixed server-owned WordPress template identifier.
	 *
	 * @return string Template identifier without the `tmpl-` prefix.
	 */
	public static function get_template_id() {
		return self::TEMPLATE_ID;
	}

	/**
	 * Print the allow-listed inspector shell template once per request.
	 *
	 * @return void
	 */
	public static function print_template() {
		static $template_printed = false;

		if ( $template_printed ) {
			return;
		}

		$template_root = realpath( __DIR__ . '/templates' );
		$template_path = realpath( __DIR__ . '/templates/inspector-wptpl.php' );

		if ( false === $template_root || false === $template_path || 0 !== strpos( $template_path, $template_root . DIRECTORY_SEPARATOR ) || ! is_readable( $template_path ) ) {
			return;
		}

		$template_printed = true;
		require $template_path;
	}
}
