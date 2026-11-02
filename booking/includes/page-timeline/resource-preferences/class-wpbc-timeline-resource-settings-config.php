<?php
/**
 * Timeline per-Resource settings presentation configuration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Own allow-listed templates, source/runtime assets, and browser labels.
 */
final class WPBC_Timeline_Resource_Settings_Config {

	/** Focused Resource-settings script handle. */
	const SCRIPT_HANDLE = 'wpbc-timeline-resource-settings';

	/** Focused Resource-settings stylesheet handle. */
	const STYLE_HANDLE = 'wpbc-timeline-resource-settings';

	/**
	 * Return the fixed Resource-settings template allow-list.
	 *
	 * @return array<string,string> Template IDs mapped to absolute files.
	 */
	public static function get_template_files() {
		return array(
			'wpbc-timeline-resource-row-actions'       => __DIR__ . '/templates/resource-row-actions-wptpl.php',
			'wpbc-timeline-resource-settings-header'   => __DIR__ . '/templates/resource-settings-header-wptpl.php',
			'wpbc-timeline-resource-settings-inspector' => __DIR__ . '/templates/resource-settings-inspector-wptpl.php',
		);
	}

	/**
	 * Return stable browser template keys.
	 *
	 * @return array<string,string> Browser keys mapped to template IDs.
	 */
	public static function get_template_ids() {
		return array(
			'row_actions' => 'wpbc-timeline-resource-row-actions',
			'header'      => 'wpbc-timeline-resource-settings-header',
			'inspector'   => 'wpbc-timeline-resource-settings-inspector',
		);
	}

	/**
	 * Return JSON-safe browser configuration for the focused settings adapter.
	 *
	 * @return array<string,mixed> Template, transport-independent, and translated presentation values.
	 */
	public static function get_browser_configuration() {
		return array(
			'templates'     => self::get_template_ids(),
			'maximum_length' => WPBC_Timeline_Resource_Display_Preferences::MAXIMUM_TEMPLATE_LENGTH,
			'tokens'        => array( '[id]', '[name]', '[firstname]', '[secondname]', '[lastname]', '[email]' ),
			'i18n'          => array(
				'row_actions'          => __( 'Actions for {title}', 'booking' ),
				'timeline_settings'    => __( 'Timeline settings', 'booking' ),
				'inspector_title'      => __( '{title} · Timeline settings', 'booking' ),
				'close'                => __( 'Close Resource settings', 'booking' ),
				'loading'              => __( 'Loading Resource settings…', 'booking' ),
				'loaded'               => __( 'Resource settings loaded.', 'booking' ),
				'load_error'           => __( 'Resource settings could not be loaded. Reload the page and try again.', 'booking' ),
				'booking_title'        => __( 'Booking title', 'booking' ),
				'booking_title_help'   => __( 'Choose how booking titles are displayed for this Resource in Timeline.', 'booking' ),
				'use_default'          => __( 'Use Timeline default', 'booking' ),
				'use_default_help'     => __( 'Inherit the global template from Booking Calendar settings.', 'booking' ),
				'inherited_default'    => __( 'Inherited default', 'booking' ),
				'custom_title'         => __( 'Custom booking title', 'booking' ),
				'custom_title_help'    => __( 'Use a custom template for this Resource only.', 'booking' ),
				'template'             => __( 'Template', 'booking' ),
				'insert_token'         => __( 'Insert a booking field token:', 'booking' ),
				'insert_token_label'   => __( 'Insert {token}', 'booking' ),
				'reset'                => __( 'Reset to default', 'booking' ),
				'cancel'               => __( 'Cancel', 'booking' ),
				'save'                 => __( 'Save preference', 'booking' ),
				'saving'               => __( 'Saving Resource preference…', 'booking' ),
				'saved'                => __( 'Resource preference saved.', 'booking' ),
				'resetting'            => __( 'Resetting Resource preference…', 'booking' ),
				'reset_complete'       => __( 'Resource preference reset to the Timeline default.', 'booking' ),
				'save_error'           => __( 'Resource settings could not be saved. Review the template and try again.', 'booking' ),
				'discard_changes'      => __( 'Discard your unsaved Resource settings?', 'booking' ),
				'configured'           => __( 'Custom Resource preference', 'booking' ),
				'not_configured'       => __( 'No Resource-specific preference is stored.', 'booking' ),
			),
		);
	}

	/**
	 * Determine whether the compiled settings module is available.
	 *
	 * @return bool True when the runtime JavaScript can be enqueued.
	 */
	public static function has_runtime_script() {
		return is_readable( __DIR__ . '/_out/timeline-resource-settings.js' );
	}

	/**
	 * Enqueue the compiled settings stylesheet when available.
	 *
	 * @param string $timeline_style_handle Compiled Timeline stylesheet handle.
	 *
	 * @return void
	 */
	public static function enqueue_style( $timeline_style_handle ) {
		$asset_path = __DIR__ . '/_out/timeline-resource-settings.css';
		if ( ! is_readable( $asset_path ) ) {
			return;
		}

		wp_enqueue_style(
			self::STYLE_HANDLE,
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/timeline-resource-settings.css',
			array( $timeline_style_handle, WPBC_Shared_UI_Dropdown::STYLE_HANDLE, WPBC_Shared_UI_Inspector::STYLE_HANDLE ),
			WP_BK_VERSION_NUM . '.' . filemtime( $asset_path )
		);
	}

	/**
	 * Enqueue the compiled focused settings module when available.
	 *
	 * @param string $module_runtime_handle Timeline module registry handle.
	 *
	 * @return void
	 */
	public static function enqueue_script( $module_runtime_handle ) {
		$asset_path = __DIR__ . '/_out/timeline-resource-settings.js';
		if ( ! is_readable( $asset_path ) ) {
			return;
		}

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/timeline-resource-settings.js',
			array( $module_runtime_handle, 'jquery', 'wp-util', WPBC_Shared_UI_Dropdown::SCRIPT_HANDLE, WPBC_Shared_UI_Inspector::SCRIPT_HANDLE ),
			WP_BK_VERSION_NUM . '.' . filemtime( $asset_path ),
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}

	/**
	 * Print every allow-listed domain template once on Timeline.
	 *
	 * @return void
	 */
	public static function print_templates() {
		static $templates_printed = false;

		if ( $templates_printed || ! wpbc_timeline_is_page() ) {
			return;
		}

		$template_root = realpath( __DIR__ . '/templates' );
		if ( false === $template_root ) {
			return;
		}

		$templates_printed = true;
		foreach ( self::get_template_files() as $template_path ) {
			$template_path = realpath( $template_path );
			if ( false === $template_path || 0 !== strpos( $template_path, $template_root . DIRECTORY_SEPARATOR ) || ! is_readable( $template_path ) ) {
				continue;
			}
			require $template_path;
		}
	}
}
