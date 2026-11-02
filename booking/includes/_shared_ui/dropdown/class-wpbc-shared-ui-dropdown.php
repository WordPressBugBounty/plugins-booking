<?php
/**
 * Reusable administration dropdown component registration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the shared dropdown assets and allow-listed WordPress template.
 *
 * The class deliberately does not accept domain options or template paths.
 * Callers enqueue the compiled assets, print the fixed template once, and pass
 * their already-authorized scalar view model to `wp.template()`.
 */
final class WPBC_Shared_UI_Dropdown {

	/** Shared script handle. */
	const SCRIPT_HANDLE = 'wpbc-shared-ui-dropdown';

	/** Shared stylesheet handle. */
	const STYLE_HANDLE = 'wpbc-shared-ui-dropdown';

	/** Stable WordPress template identifier, without the `tmpl-` prefix. */
	const TEMPLATE_ID = 'wpbc-shared-ui-dropdown';

	/**
	 * Enqueue the compiled shared dropdown stylesheet.
	 *
	 * @return void
	 */
	public static function enqueue_style() {
		$asset_path     = __DIR__ . '/_out/dropdown.css';
		$asset_modified = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;
		$asset_version  = false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;

		wp_enqueue_style(
			self::STYLE_HANDLE,
			WPBC_PLUGIN_URL . '/includes/_shared_ui/dropdown/_out/dropdown.css',
			array(),
			$asset_version
		);
	}

	/**
	 * Enqueue the compiled shared dropdown controller.
	 *
	 * The controller uses delegated document events so dynamically rendered
	 * instances need no inline scripts or per-instance initialization.
	 *
	 * @return void
	 */
	public static function enqueue_script() {
		$asset_path     = __DIR__ . '/_out/dropdown.js';
		$asset_modified = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;
		$asset_version  = false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			WPBC_PLUGIN_URL . '/includes/_shared_ui/dropdown/_out/dropdown.js',
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
	 * Print the allow-listed dropdown template once per request.
	 *
	 * @return void
	 */
	public static function print_template() {
		static $template_printed = false;

		if ( $template_printed ) {
			return;
		}

		$template_root = realpath( __DIR__ . '/templates' );
		$template_path = realpath( __DIR__ . '/templates/dropdown-wptpl.php' );

		if ( false === $template_root || false === $template_path || 0 !== strpos( $template_path, $template_root . DIRECTORY_SEPARATOR ) || ! is_readable( $template_path ) ) {
			return;
		}

		$template_printed = true;
		require $template_path;
	}
}
