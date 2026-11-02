<?php
/**
 * Timeline Resource navigation presentation and asset configuration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Own the allow-listed templates and browser configuration for Resource navigation.
 */
final class WPBC_Timeline_Resource_Navigation_Config {

	/** Resource navigation source/runtime script handle. */
	const SCRIPT_HANDLE = 'wpbc-timeline-resource-navigation';

	/** Resource navigation source/runtime stylesheet handle. */
	const STYLE_HANDLE = 'wpbc-timeline-resource-navigation';

	/**
	 * Return the server-owned Resource navigation template map.
	 *
	 * No request value participates in template selection. Keeping this map in
	 * the Resource domain prevents the Timeline shell from acquiring selector
	 * row or pagination presentation knowledge.
	 *
	 * @return array<string,string> Template identifiers mapped to absolute files.
	 */
	public static function get_template_files() {
		return array(
			'wpbc-timeline-resource-selector'     => __DIR__ . '/templates/resource-selector-wptpl.php',
			'wpbc-timeline-resource-selector-row' => __DIR__ . '/templates/resource-selector-row-wptpl.php',
			'wpbc-timeline-resource-pagination'   => __DIR__ . '/templates/resource-pagination-wptpl.php',
			'wpbc-timeline-resource-pane-toggle'  => __DIR__ . '/templates/resource-pane-toggle-wptpl.php',
		);
	}

	/**
	 * Return the browser template-key contract.
	 *
	 * @return array<string,string> Stable keys mapped to allow-listed template IDs.
	 */
	public static function get_template_ids() {
		return array(
			'selector'     => 'wpbc-timeline-resource-selector',
			'selector_row' => 'wpbc-timeline-resource-selector-row',
			'pagination'   => 'wpbc-timeline-resource-pagination',
			'pane_toggle'  => 'wpbc-timeline-resource-pane-toggle',
		);
	}

	/**
	 * Return the selectable Resource page sizes shown in Timeline.
	 *
	 * The storage and endpoint contracts continue to accept any positive value
	 * up to the server maximum for backward compatibility. This smaller list is
	 * the stable, customer-facing set offered by the selector.
	 *
	 * @return int[] Ordered page-size choices.
	 */
	public static function get_page_size_options() {
		return array( 5, 10, 20, 30, 50 );
	}

	/**
	 * Return JSON-safe browser configuration for the focused navigation module.
	 *
	 * @return array<string,mixed> Presentation identifiers, limits, and translated labels.
	 */
	public static function get_browser_configuration() {
		return array(
			'templates'              => self::get_template_ids(),
			'default_selector_size'  => WPBC_Timeline_Resource_View_Preferences::DEFAULT_PAGE_SIZE,
			'maximum_selector_size'  => WPBC_Timeline_Resource_View_Preferences::MAXIMUM_PAGE_SIZE,
			'page_size_options'      => self::get_page_size_options(),
			'maximum_selected'       => WPBC_Timeline_Resource_View_Preferences::MAXIMUM_SELECTED_RESOURCES,
			'search_delay_ms'        => 250,
			'sort_options'           => array(
				array(
					'value' => WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_STANDARD,
					'label' => __( 'Standard order', 'booking' ),
				),
				array(
					'value' => WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_TITLE_ASC,
					'label' => __( 'Name A to Z', 'booking' ),
				),
				array(
					'value' => WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_TITLE_DESC,
					'label' => __( 'Name Z to A', 'booking' ),
				),
				array(
					'value' => WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_ID_ASC,
					'label' => __( 'Resource ID ascending', 'booking' ),
				),
				array(
					'value' => WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_ID_DESC,
					'label' => __( 'Resource ID descending', 'booking' ),
				),
			),
			'i18n'                   => array(
				'show_resource_panel'    => __( 'Show booking Resources', 'booking' ),
				'hide_resource_panel'    => __( 'Hide booking Resources', 'booking' ),
				'choose_resources'       => __( 'Choose booking Resources', 'booking' ),
				'selector_instructions'  => __( 'Search, sort, and choose the booking Resources to show. Apply Resources saves this view for your account.', 'booking' ),
				'all_resources'          => __( 'All Resources', 'booking' ),
				'resources_count'        => __( 'Resources: {count}', 'booking' ),
				'search_resources'       => __( 'Search Resources', 'booking' ),
				'sort_resources'         => __( 'Sort booking Resources', 'booking' ),
				'resources_per_page'     => __( 'Booking Resources per page', 'booking' ),
				'per_page'               => __( 'per page', 'booking' ),
				'select_all'             => __( 'Select all', 'booking' ),
				'clear_all'              => __( 'Clear all', 'booking' ),
				'selected_count'         => __( '{count} selected', 'booking' ),
				'loading'                => __( 'Loading booking Resources…', 'booking' ),
				'empty'                  => __( 'No booking Resources match this search.', 'booking' ),
				'load_error'             => __( 'Booking Resources could not be loaded. Try again.', 'booking' ),
				'minimum_one'            => __( 'At least one booking Resource is required.', 'booking' ),
				'maximum_selected_error' => __( 'Select up to 500 booking Resources. Use Clear all before choosing a smaller set.', 'booking' ),
				'cancel'                 => __( 'Cancel', 'booking' ),
				'apply'                  => __( 'Apply Resources', 'booking' ),
				'applying'               => __( 'Applying booking Resources…', 'booking' ),
				'applied'                => __( 'Booking Resources updated.', 'booking' ),
				'previous'               => __( 'Previous', 'booking' ),
				'next'                   => __( 'Next', 'booking' ),
				'page_status'            => __( 'Page {page} of {pages}', 'booking' ),
				'previous_page_label'    => __( 'Previous booking Resource page', 'booking' ),
				'next_page_label'        => __( 'Next booking Resource page', 'booking' ),
				'select_resource'        => __( 'Show {title} in Timeline', 'booking' ),
				'select_resource_group'  => __( 'Show the {title} Resource group in Timeline', 'booking' ),
			),
		);
	}

	/**
	 * Determine whether the compiled Resource navigation script is available.
	 *
	 * Source changes intentionally remain inactive until the normal project
	 * compiler creates `_out`; production never falls back to `_src`.
	 *
	 * @return bool True when the runtime script can be enqueued.
	 */
	public static function has_runtime_script() {
		return is_readable( __DIR__ . '/_out/timeline-resource-navigation.js' );
	}

	/**
	 * Enqueue the compiled Resource navigation stylesheet when available.
	 *
	 * @param string $timeline_style_handle Compiled Timeline stylesheet handle.
	 *
	 * @return void
	 */
	public static function enqueue_style( $timeline_style_handle ) {
		$asset_path = __DIR__ . '/_out/timeline-resource-navigation.css';
		if ( ! is_readable( $asset_path ) ) {
			return;
		}

		wp_enqueue_style(
			self::STYLE_HANDLE,
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/timeline-resource-navigation.css',
			array( $timeline_style_handle, WPBC_Shared_UI_Popover::STYLE_HANDLE ),
			WP_BK_VERSION_NUM . '.' . filemtime( $asset_path )
		);
	}

	/**
	 * Enqueue the compiled focused Resource navigation module when available.
	 *
	 * @param string $module_runtime_handle Timeline module registry handle.
	 *
	 * @return void
	 */
	public static function enqueue_script( $module_runtime_handle ) {
		$asset_path = __DIR__ . '/_out/timeline-resource-navigation.js';
		if ( ! is_readable( $asset_path ) ) {
			return;
		}

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/timeline-resource-navigation.js',
			array( $module_runtime_handle, 'jquery', 'wp-util', WPBC_Shared_UI_Popover::SCRIPT_HANDLE ),
			WP_BK_VERSION_NUM . '.' . filemtime( $asset_path ),
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}

	/**
	 * Print each Resource navigation WordPress template once.
	 *
	 * Realpath containment supplements the fixed map so a future refactor cannot
	 * accidentally turn a browser or request value into an include path.
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
