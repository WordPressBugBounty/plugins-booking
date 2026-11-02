<?php
/**
 * Reusable administration split action and single-date picker component.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register domain-neutral date-jump assets and its allow-listed template.
 *
 * The component owns split-button presentation, the standard Booking Calendar
 * datepicker, keyboard/focus behavior, and neutral browser events. Callers own
 * authorization, loading, date interpretation, persistence, and navigation.
 *
 * @since 12.0.0
 */
final class WPBC_Shared_UI_Date_Jump {

	/** Shared script handle. */
	const SCRIPT_HANDLE = 'wpbc-shared-ui-date-jump';

	/** Shared stylesheet handle. */
	const STYLE_HANDLE = 'wpbc-shared-ui-date-jump';

	/** Stable WordPress template identifier, without the `tmpl-` prefix. */
	const TEMPLATE_ID = 'wpbc-shared-ui-date-jump';

	/**
	 * Enqueue the compiled component stylesheet.
	 *
	 * @return void
	 */
	public static function enqueue_style() {
		$asset_path     = __DIR__ . '/_out/date-jump.css';
		$asset_modified = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;
		$asset_version  = false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;

		wp_enqueue_style(
			self::STYLE_HANDLE,
			WPBC_PLUGIN_URL . '/includes/_shared_ui/date-jump/_out/date-jump.css',
			array(),
			$asset_version
		);
	}

	/**
	 * Enqueue the compiled controller and standard Booking Calendar datepicker.
	 *
	 * @return void
	 */
	public static function enqueue_script() {
		$asset_path          = __DIR__ . '/_out/date-jump.js';
		$asset_modified      = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;
		$asset_version       = false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;
		$script_dependencies = array( 'jquery', 'wpbc-datepick' );

		wp_enqueue_script( 'wpbc-datepick' );
		if ( wp_script_is( 'wpbc-datepick-localize', 'registered' ) ) {
			wp_enqueue_script( 'wpbc-datepick-localize' );
			$script_dependencies[] = 'wpbc-datepick-localize';
		}

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			WPBC_PLUGIN_URL . '/includes/_shared_ui/date-jump/_out/date-jump.js',
			$script_dependencies,
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
	 * Print the allow-listed date-jump template once per request.
	 *
	 * @return void
	 */
	public static function print_template() {
		static $template_printed = false;

		if ( $template_printed ) {
			return;
		}

		$template_root = realpath( __DIR__ . '/templates' );
		$template_path = realpath( __DIR__ . '/templates/date-jump-wptpl.php' );

		if ( false === $template_root || false === $template_path || 0 !== strpos( $template_path, $template_root . DIRECTORY_SEPARATOR ) || ! is_readable( $template_path ) ) {
			return;
		}

		$template_printed = true;
		require $template_path;
	}
}
