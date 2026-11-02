<?php
/**
 * Reusable administration popover asset registration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register domain-neutral disclosure-popover interaction and presentation.
 *
 * Domain templates own the trigger label and complete panel contents. This
 * class owns only the compiled behavior and scoped visual shell.
 *
 * @since 12.0.0
 */
final class WPBC_Shared_UI_Popover {

	/** Shared script handle. */
	const SCRIPT_HANDLE = 'wpbc-shared-ui-popover';

	/** Shared stylesheet handle. */
	const STYLE_HANDLE = 'wpbc-shared-ui-popover';

	/**
	 * Enqueue the compiled shared popover stylesheet.
	 *
	 * @return void
	 */
	public static function enqueue_style() {
		$asset_path     = __DIR__ . '/_out/popover.css';
		$asset_modified = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;
		$asset_version  = false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;

		wp_enqueue_style(
			self::STYLE_HANDLE,
			WPBC_PLUGIN_URL . '/includes/_shared_ui/popover/_out/popover.css',
			array(),
			$asset_version
		);
	}

	/**
	 * Enqueue the compiled shared popover controller.
	 *
	 * Delegated document events support dynamically rendered domain instances
	 * without inline scripts or per-instance initialization.
	 *
	 * @return void
	 */
	public static function enqueue_script() {
		$asset_path     = __DIR__ . '/_out/popover.js';
		$asset_modified = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;
		$asset_version  = false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			WPBC_PLUGIN_URL . '/includes/_shared_ui/popover/_out/popover.js',
			array(),
			$asset_version,
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}
}
