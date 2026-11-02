<?php
/**
 * Reusable administration Context Popover shell registration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register domain-neutral Context Popover assets and fixed UI templates.
 *
 * Domains retain ownership of authorization, DTOs, requests, content
 * templates, actions, and suppression policy. This class owns only compiled
 * asset registration and fixed server-owned UI template paths.
 *
 * @since 12.0.0
 */
final class WPBC_Shared_UI_Context_Popover {

	/** Shared script handle. */
	const SCRIPT_HANDLE = 'wpbc-shared-ui-context-popover';

	/** Shared stylesheet handle. */
	const STYLE_HANDLE = 'wpbc-shared-ui-context-popover';

	/** Stable shell template identifier, without the `tmpl-` prefix. */
	const TEMPLATE_ID = 'wpbc-shared-ui-context-popover-shell';

	/** Stable control-button template identifier, without the `tmpl-` prefix. */
	const CONTROL_BUTTON_TEMPLATE_ID = 'wpbc-shared-ui-context-popover-button';

	/**
	 * Enqueue the compiler-owned Context Popover stylesheet from `_out`.
	 *
	 * Source is maintained in `_src`; the normal asset compiler creates the
	 * runtime file. Production PHP never enqueues the source stylesheet.
	 *
	 * @return void
	 */
	public static function enqueue_style() {
		$asset_path = __DIR__ . '/_out/context-popover.css';

		wp_enqueue_style(
			self::STYLE_HANDLE,
			WPBC_PLUGIN_URL . '/includes/_shared_ui/context-popover/_out/context-popover.css',
			array( 'wpbc-ui-both' ),
			self::get_asset_version( $asset_path )
		);
	}

	/**
	 * Enqueue the compiler-owned Context Popover controller from `_out`.
	 *
	 * WordPress templates are resolved by `wp-util`. Tippy supplies positioning
	 * through a component-owned sentinel so domain triggers retain ownership of
	 * their own attributes and third-party instances.
	 *
	 * @return void
	 */
	public static function enqueue_script() {
		$asset_path = __DIR__ . '/_out/context-popover.js';

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			WPBC_PLUGIN_URL . '/includes/_shared_ui/context-popover/_out/context-popover.js',
			array( 'wp-util', 'wpbc-tipcy' ),
			self::get_asset_version( $asset_path ),
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}

	/**
	 * Return the fixed server-owned WordPress shell template identifier.
	 *
	 * @return string Template identifier without the `tmpl-` prefix.
	 */
	public static function get_template_id() {
		return self::TEMPLATE_ID;
	}

	/**
	 * Return the fixed server-owned shared control-button template identifier.
	 *
	 * The template owns only neutral button markup and presentation. Callers
	 * retain ownership of action meaning, authorization, and side effects.
	 *
	 * @return string Template identifier without the `tmpl-` prefix.
	 */
	public static function get_control_button_template_id() {
		return self::CONTROL_BUTTON_TEMPLATE_ID;
	}

	/**
	 * Print the allow-listed Context Popover templates once per request.
	 *
	 * The paths cannot be selected by a request, browser value, or domain
	 * configuration. Domains render authorized content into the shell or pass
	 * executable-free presentation values to the control-button template.
	 *
	 * @return void
	 */
	public static function print_template() {
		static $template_printed = false;

		if ( $template_printed ) {
			return;
		}

		$template_root  = realpath( __DIR__ . '/templates' );
		$template_files = array(
			'context-popover-shell-wptpl.php',
			'context-popover-button-wptpl.php',
		);

		if ( false === $template_root ) {
			return;
		}

		$template_printed = true;
		foreach ( $template_files as $template_file ) {
			$template_path = realpath( $template_root . DIRECTORY_SEPARATOR . $template_file );

			if (
				false === $template_path
				|| 0 !== strpos( $template_path, $template_root . DIRECTORY_SEPARATOR )
				|| ! is_readable( $template_path )
			) {
				continue;
			}

			require $template_path;
		}
	}

	/**
	 * Return an asset version that changes when its generated file changes.
	 *
	 * Missing generated assets retain the plugin version without emitting a
	 * filesystem warning while the normal compiler is still pending.
	 *
	 * @param string $asset_path Absolute generated asset path.
	 *
	 * @return string Asset version.
	 */
	private static function get_asset_version( $asset_path ) {
		$asset_modified = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;

		return false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;
	}
}
