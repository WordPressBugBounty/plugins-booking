<?php
/**
 * Single production bootstrap boundary for the administration Timeline.
 *
 * Removing this one include removes the new route, assets, templates, and all
 * Timeline-owned integration hooks while leaving the legacy Timeline intact.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once dirname( __DIR__ ) . '/_shared_ui/shared-ui.php';
require_once dirname( __DIR__ ) . '/booking-inspector/booking-inspector.php';
require_once dirname( __DIR__ ) . '/booking-overview-tooltip/booking-overview-tooltip.php';
require_once dirname( __DIR__ ) . '/page-catalog-booking-resources/booking-resource-upgrade-ui.php';
require_once __DIR__ . '/timeline-config.php';
require_once __DIR__ . '/class-wpbc-timeline-authorization.php';
require_once __DIR__ . '/class-wpbc-timeline-axis.php';
require_once __DIR__ . '/interface-wpbc-timeline-row-presentation-provider.php';
require_once __DIR__ . '/class-wpbc-timeline-row-presentation-registry.php';
require_once __DIR__ . '/time-rows/time-rows.php';
require_once __DIR__ . '/time-rows-selection/time-rows-selection.php';
require_once __DIR__ . '/class-wpbc-timeline-request-validator.php';
require_once __DIR__ . '/class-wpbc-timeline-selection-validator.php';
require_once __DIR__ . '/class-wpbc-timeline-resource-repository.php';
require_once __DIR__ . '/class-wpbc-timeline-booking-repository.php';
require_once __DIR__ . '/class-wpbc-timeline-dto-mapper.php';
require_once __DIR__ . '/unavailable-days-bg/unavailable-days-bg.php';
require_once __DIR__ . '/class-wpbc-timeline-rates-provider.php';
require_once __DIR__ . '/resource-preferences/resource-preferences.php';
require_once __DIR__ . '/class-wpbc-timeline-payload-guard.php';
require_once __DIR__ . '/class-wpbc-timeline-read-operations.php';
require_once __DIR__ . '/class-wpbc-timeline-handoff.php';
require_once __DIR__ . '/class-wpbc-timeline-selection-preview.php';
require_once dirname( __DIR__ ) . '/page-availability/class-wpbc-availability-range-mutation-service.php';
require_once __DIR__ . '/class-wpbc-timeline-block-service.php';
require_once __DIR__ . '/timeline-handoff-integration.php';
require_once __DIR__ . '/class-wpbc-timeline-presenter.php';
require_once __DIR__ . '/booking-resizing/booking-resizing.php';
require_once __DIR__ . '/booking-movement/booking-movement.php';
require_once __DIR__ . '/time-rows-movement/time-rows-movement.php';
require_once __DIR__ . '/timeline-routing.php';
require_once __DIR__ . '/timeline-page.php';
require_once __DIR__ . '/timeline-ajax.php';

add_filter( 'wpbc_booking_modes_canonical_pages', 'wpbc_timeline_register_canonical_page' );
add_filter( 'wpbc_booking_modes_resolved_navigation', 'wpbc_timeline_filter_sidebar_navigation', 20, 5 );
add_filter( 'wpbc_ui__horis_menu__item_main__title', 'wpbc_timeline_filter_navigation_title', 20, 3 );
add_action( 'hook__wpbc_ui__top_horisontal_nav__end', 'wpbc_timeline_render_email_toggle', 10, 2 );
add_action( 'wpbc_menu_created', 'wpbc_timeline_attach_page_controller', 10, 1 );
add_action( 'wpbc_enqueue_css_files', 'wpbc_timeline_enqueue_styles', 70, 1 );
add_action( 'wpbc_enqueue_js_files', 'wpbc_timeline_enqueue_scripts', 70, 1 );
add_action( 'admin_footer', 'wpbc_timeline_print_templates', 40 );

/**
 * Enqueue the compiled Timeline stylesheet only on the isolated route.
 *
 * @param string $where_to_load Booking Calendar asset context.
 *
 * @return void
 */
function wpbc_timeline_enqueue_styles( $where_to_load ) {
	if ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) || ! wpbc_timeline_is_page() ) {
		return;
	}

	$configuration  = wpbc_timeline_get_configuration();
	$asset_path     = __DIR__ . '/_out/timeline.css';
	$asset_modified = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;
	$asset_version  = false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;

	WPBC_Shared_UI_Dropdown::enqueue_style();
	WPBC_Shared_UI_Popover::enqueue_style();
	WPBC_Shared_UI_Context_Popover::enqueue_style();
	WPBC_Shared_UI_Inspector::enqueue_style();
	WPBC_Shared_UI_Date_Range_Navigation::enqueue_style();
	WPBC_Shared_UI_Date_Jump::enqueue_style();
	WPBC_Booking_Inspector_Config::enqueue_style();
	WPBC_Booking_Overview_Tooltip_Config::enqueue_style();
	if ( class_exists( 'WPBC_Print' ) ) {
		WPBC_Print::enqueue_style();
	}

	wp_enqueue_style(
		$configuration['asset_handles']['style'],
		trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/timeline.css',
		array( 'wpbc-ui-both', WPBC_Shared_UI_Dropdown::STYLE_HANDLE, WPBC_Shared_UI_Popover::STYLE_HANDLE, WPBC_Shared_UI_Context_Popover::STYLE_HANDLE, WPBC_Shared_UI_Inspector::STYLE_HANDLE, WPBC_Shared_UI_Date_Range_Navigation::STYLE_HANDLE, WPBC_Shared_UI_Date_Jump::STYLE_HANDLE, WPBC_Booking_Inspector_Config::STYLE_HANDLE, WPBC_Booking_Overview_Tooltip_Config::STYLE_HANDLE ),
		$asset_version
	);
	WPBC_Timeline_Resource_Navigation_Config::enqueue_style( $configuration['asset_handles']['style'] );
	WPBC_Timeline_Resource_Settings_Config::enqueue_style( $configuration['asset_handles']['style'] );
	WPBC_Timeline_Booking_Resizing_Config::enqueue_style( $configuration['asset_handles']['style'] );
}

/**
 * Enqueue and configure the compiled Timeline script on its isolated route.
 *
 * @param string $where_to_load Booking Calendar asset context.
 *
 * @return void
 */
function wpbc_timeline_enqueue_scripts( $where_to_load ) {
	if ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) || ! wpbc_timeline_is_page() ) {
		return;
	}

	$configuration                        = wpbc_timeline_get_configuration();
	$module_runtime_asset_path            = __DIR__ . '/_out/timeline-modules.js';
	$module_runtime_modified              = is_readable( $module_runtime_asset_path ) ? filemtime( $module_runtime_asset_path ) : false;
	$module_runtime_asset_version         = false !== $module_runtime_modified ? WP_BK_VERSION_NUM . '.' . $module_runtime_modified : WP_BK_VERSION_NUM;
	$resource_navigation_modified         = WPBC_Timeline_Resource_Navigation_Config::has_runtime_script();
	$resource_settings_modified           = WPBC_Timeline_Resource_Settings_Config::has_runtime_script();
	$window_cache_asset_path              = __DIR__ . '/_out/timeline-window-cache.js';
	$window_cache_modified                = is_readable( $window_cache_asset_path ) ? filemtime( $window_cache_asset_path ) : false;
	$window_cache_asset_version           = false !== $window_cache_modified ? WP_BK_VERSION_NUM . '.' . $window_cache_modified : WP_BK_VERSION_NUM;
	$availability_cache_asset_path        = __DIR__ . '/_out/timeline-availability-cache.js';
	$availability_cache_modified          = is_readable( $availability_cache_asset_path ) ? filemtime( $availability_cache_asset_path ) : false;
	$availability_cache_asset_version     = false !== $availability_cache_modified ? WP_BK_VERSION_NUM . '.' . $availability_cache_modified : WP_BK_VERSION_NUM;
	$toolbar_navigation_asset_path        = __DIR__ . '/_out/timeline-toolbar-navigation.js';
	$toolbar_navigation_modified          = is_readable( $toolbar_navigation_asset_path ) ? filemtime( $toolbar_navigation_asset_path ) : false;
	$toolbar_navigation_asset_version     = false !== $toolbar_navigation_modified ? WP_BK_VERSION_NUM . '.' . $toolbar_navigation_modified : WP_BK_VERSION_NUM;
	$empty_range_selection_asset_path     = __DIR__ . '/_out/timeline-empty-range-selection.js';
	$empty_range_selection_modified       = is_readable( $empty_range_selection_asset_path ) ? filemtime( $empty_range_selection_asset_path ) : false;
	$empty_range_selection_asset_version  = false !== $empty_range_selection_modified ? WP_BK_VERSION_NUM . '.' . $empty_range_selection_modified : WP_BK_VERSION_NUM;
	$booking_interactions_asset_path      = __DIR__ . '/_out/timeline-booking-interactions.js';
	$booking_interactions_modified        = is_readable( $booking_interactions_asset_path ) ? filemtime( $booking_interactions_asset_path ) : false;
	$booking_interactions_asset_version   = false !== $booking_interactions_modified ? WP_BK_VERSION_NUM . '.' . $booking_interactions_modified : WP_BK_VERSION_NUM;
	$rendering_asset_path                 = __DIR__ . '/_out/timeline-rendering.js';
	$rendering_modified                   = is_readable( $rendering_asset_path ) ? filemtime( $rendering_asset_path ) : false;
	$rendering_asset_version              = false !== $rendering_modified ? WP_BK_VERSION_NUM . '.' . $rendering_modified : WP_BK_VERSION_NUM;
	$page_controller_asset_path           = __DIR__ . '/_out/timeline-page-controller.js';
	$page_controller_modified             = is_readable( $page_controller_asset_path ) ? filemtime( $page_controller_asset_path ) : false;
	$page_controller_asset_version        = false !== $page_controller_modified ? WP_BK_VERSION_NUM . '.' . $page_controller_modified : WP_BK_VERSION_NUM;
	$asset_path                           = __DIR__ . '/_out/timeline.js';
	$asset_modified                       = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;
	$asset_version                        = false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;
	$authorization                        = new WPBC_Timeline_Authorization();
	$presenter                            = new WPBC_Timeline_Presenter();
	$is_authorized                        = $authorization->current_user_can_view();
	$initial_reads                        = array();
	if ( $is_authorized && ! class_exists( 'wpdev_bk_personal' ) ) {
		wpbc_load_js__required_for_modals();
	}
	$script_dependencies                  = array(
		'jquery',
		'wp-util',
		'wpbc-admin-support',
		'wpbc-ui-catalog',
		WPBC_Shared_UI_Dropdown::SCRIPT_HANDLE,
		WPBC_Shared_UI_Popover::SCRIPT_HANDLE,
		WPBC_Shared_UI_Inspector::SCRIPT_HANDLE,
		WPBC_Shared_UI_Date_Range_Navigation::SCRIPT_HANDLE,
		WPBC_Shared_UI_Date_Jump::SCRIPT_HANDLE,
	);
	if ( false !== $module_runtime_modified ) {
		array_unshift( $script_dependencies, $configuration['asset_handles']['module_runtime_script'] );
	}
	if ( false !== $module_runtime_modified && false !== $window_cache_modified ) {
		$script_dependencies[] = $configuration['asset_handles']['window_cache_script'];
	}
	if ( false !== $module_runtime_modified && false !== $availability_cache_modified ) {
		$script_dependencies[] = $configuration['asset_handles']['availability_cache_script'];
	}
	if ( false !== $module_runtime_modified && false !== $window_cache_modified && false !== $toolbar_navigation_modified ) {
		$script_dependencies[] = $configuration['asset_handles']['toolbar_navigation_script'];
	}
	if ( false !== $module_runtime_modified && false !== $empty_range_selection_modified ) {
		$script_dependencies[] = $configuration['asset_handles']['empty_range_selection_script'];
	}
	if ( false !== $module_runtime_modified && false !== $booking_interactions_modified ) {
		$script_dependencies[] = $configuration['asset_handles']['booking_interactions_script'];
	}
	if ( false !== $module_runtime_modified && false !== $booking_interactions_modified && false !== $rendering_modified ) {
		$script_dependencies[] = $configuration['asset_handles']['rendering_script'];
	}
	if (
		false !== $module_runtime_modified
		&& false !== $window_cache_modified
		&& false !== $availability_cache_modified
		&& false !== $toolbar_navigation_modified
		&& false !== $empty_range_selection_modified
		&& false !== $booking_interactions_modified
		&& false !== $rendering_modified
		&& false !== $page_controller_modified
	) {
		$script_dependencies[] = $configuration['asset_handles']['page_controller_script'];
	}
	if ( $is_authorized ) {
		$read_operations                  = new WPBC_Timeline_Read_Operations( $authorization );
		$initial_request                 = wpbc_timeline_get_return_window_request();
		$initial_reads['metadata']        = $read_operations->get_bootstrap_metadata();
		$initial_reads['window']          = $read_operations->get_window( $initial_request );
		if ( is_wp_error( $initial_reads['window'] ) && ! isset( $_GET['wpbc_timeline_return'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only signed navigation context is checked by the handoff verifier.
			$initial_reads['window'] = $read_operations->get_window( wpbc_timeline_get_default_window_request() );
		}
		$initial_reads['previous_window'] = $read_operations->get_initial_previous_window( $initial_reads['window'] );
		$initial_reads['next_window']     = $read_operations->get_initial_next_window( $initial_reads['window'] );
		$initial_reads['transport']       = array(
			'url'       => admin_url( 'admin-ajax.php' ),
			'action'    => 'wpbc_timeline_read_window',
			'nonce'     => wp_create_nonce( 'wpbc_timeline_read' ),
			'availability' => array(
				'action' => 'wpbc_timeline_read_availability',
				'nonce'  => wp_create_nonce( 'wpbc_timeline_read' ),
			),
			'preferences' => array(
				'action' => 'wpbc_timeline_save_preferences',
				'reset_action' => 'wpbc_timeline_reset_preferences',
				'nonce'        => wp_create_nonce( 'wpbc_timeline_preferences' ),
			),
			'resources' => array(
				'action'           => 'wpbc_timeline_read_resources',
				'selection_action' => 'wpbc_timeline_read_resource_selection',
				'save_action'      => 'wpbc_timeline_save_resource_view',
				'reset_action'     => 'wpbc_timeline_reset_resource_view',
				'nonce'            => wp_create_nonce( 'wpbc_timeline_read_resources' ),
				'selection_nonce'  => wp_create_nonce( 'wpbc_timeline_read_resource_selection' ),
				'view_nonce'       => wp_create_nonce( 'wpbc_timeline_resource_view' ),
			),
			'resource_settings' => array(
				'read_action'  => 'wpbc_timeline_read_resource_settings',
				'save_action'  => 'wpbc_timeline_save_resource_settings',
				'reset_action' => 'wpbc_timeline_reset_resource_settings',
				'read_nonce'   => wp_create_nonce( 'wpbc_timeline_read_resource_settings' ),
				'write_nonce'  => wp_create_nonce( 'wpbc_timeline_resource_settings' ),
			),
			'selection' => array(
				'preview_action' => 'wpbc_timeline_preview_selection',
				'apply_action'   => 'wpbc_timeline_apply_block',
				'preview_nonce'  => wp_create_nonce( 'wpbc_timeline_selection_preview' ),
				'apply_nonce'    => wp_create_nonce( 'wpbc_timeline_apply_block' ),
			),
		);
	}
	if ( false !== $module_runtime_modified ) {
		WPBC_Timeline_Booking_Resizing_Config::enqueue_script( $configuration['asset_handles']['module_runtime_script'] );
	}

	WPBC_UI_Catalog::enqueue_controller();
	WPBC_Shared_UI_Dropdown::enqueue_script();
	WPBC_Shared_UI_Popover::enqueue_script();
	WPBC_Shared_UI_Inspector::enqueue_script();
	WPBC_Shared_UI_Date_Range_Navigation::enqueue_script();
	WPBC_Shared_UI_Date_Jump::enqueue_script();
	WPBC_Booking_Inspector_Config::enqueue_script();
	WPBC_Booking_Overview_Tooltip_Config::enqueue_script();
	if ( class_exists( 'WPBC_Print' ) ) {
		WPBC_Print::enqueue_script( WPBC_JS_IN_FOOTER );
	}

	if ( false !== $module_runtime_modified ) {
		wp_enqueue_script(
			$configuration['asset_handles']['module_runtime_script'],
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/timeline-modules.js',
			array(),
			$module_runtime_asset_version,
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}
	if ( false !== $module_runtime_modified && $resource_navigation_modified ) {
		WPBC_Timeline_Resource_Navigation_Config::enqueue_script( $configuration['asset_handles']['module_runtime_script'] );
	}
	if ( false !== $module_runtime_modified && $resource_settings_modified ) {
		WPBC_Timeline_Resource_Settings_Config::enqueue_script( $configuration['asset_handles']['module_runtime_script'] );
	}
	if ( false !== $module_runtime_modified && false !== $window_cache_modified ) {
		wp_enqueue_script(
			$configuration['asset_handles']['window_cache_script'],
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/timeline-window-cache.js',
			array( $configuration['asset_handles']['module_runtime_script'] ),
			$window_cache_asset_version,
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}
	if ( false !== $module_runtime_modified && false !== $availability_cache_modified ) {
		wp_enqueue_script(
			$configuration['asset_handles']['availability_cache_script'],
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/timeline-availability-cache.js',
			array( $configuration['asset_handles']['module_runtime_script'] ),
			$availability_cache_asset_version,
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}
	if ( false !== $module_runtime_modified && false !== $window_cache_modified && false !== $toolbar_navigation_modified ) {
		wp_enqueue_script(
			$configuration['asset_handles']['toolbar_navigation_script'],
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/timeline-toolbar-navigation.js',
			array(
				$configuration['asset_handles']['module_runtime_script'],
				$configuration['asset_handles']['window_cache_script'],
			),
			$toolbar_navigation_asset_version,
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}
	if ( false !== $module_runtime_modified && false !== $empty_range_selection_modified ) {
		wp_enqueue_script(
			$configuration['asset_handles']['empty_range_selection_script'],
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/timeline-empty-range-selection.js',
			array( $configuration['asset_handles']['module_runtime_script'] ),
			$empty_range_selection_asset_version,
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}
	if ( false !== $module_runtime_modified && false !== $booking_interactions_modified ) {
		$booking_interaction_dependencies = array(
			$configuration['asset_handles']['module_runtime_script'],
			WPBC_Booking_Inspector_Config::HOSTS_SCRIPT_HANDLE,
			WPBC_Booking_Overview_Tooltip_Config::SCRIPT_HANDLE,
		);
		if ( WPBC_Timeline_Booking_Resizing_Config::has_runtime_script() ) {
			$booking_interaction_dependencies[] = WPBC_Timeline_Booking_Resizing_Config::SCRIPT_HANDLE;
		}
		wp_enqueue_script(
			$configuration['asset_handles']['booking_interactions_script'],
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/timeline-booking-interactions.js',
			$booking_interaction_dependencies,
			$booking_interactions_asset_version,
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}
	if ( false !== $module_runtime_modified && false !== $booking_interactions_modified && false !== $rendering_modified ) {
		wp_enqueue_script(
			$configuration['asset_handles']['rendering_script'],
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/timeline-rendering.js',
			array(
				$configuration['asset_handles']['module_runtime_script'],
				$configuration['asset_handles']['booking_interactions_script'],
			),
			$rendering_asset_version,
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}
	if (
		false !== $module_runtime_modified
		&& false !== $window_cache_modified
		&& false !== $availability_cache_modified
		&& false !== $toolbar_navigation_modified
		&& false !== $empty_range_selection_modified
		&& false !== $booking_interactions_modified
		&& false !== $rendering_modified
		&& false !== $page_controller_modified
	) {
		$page_controller_dependencies = array(
			$configuration['asset_handles']['module_runtime_script'],
			$configuration['asset_handles']['window_cache_script'],
			$configuration['asset_handles']['availability_cache_script'],
			$configuration['asset_handles']['toolbar_navigation_script'],
			$configuration['asset_handles']['empty_range_selection_script'],
			$configuration['asset_handles']['booking_interactions_script'],
			$configuration['asset_handles']['rendering_script'],
		);
		if ( $resource_navigation_modified ) {
			$page_controller_dependencies[] = WPBC_Timeline_Resource_Navigation_Config::SCRIPT_HANDLE;
		}
		if ( $resource_settings_modified ) {
			$page_controller_dependencies[] = WPBC_Timeline_Resource_Settings_Config::SCRIPT_HANDLE;
		}
		wp_enqueue_script(
			$configuration['asset_handles']['page_controller_script'],
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/timeline-page-controller.js',
			$page_controller_dependencies,
			$page_controller_asset_version,
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}

	/**
	 * Filters the Timeline entry-point dependencies for isolated browser modules.
	 *
	 * Extension modules may enqueue their compiler-owned runtime here and append
	 * only its stable script handle. The main Timeline entry point then executes
	 * after every registered factory without acquiring domain-specific branches.
	 *
	 * @since 12.0.0
	 *
	 * @param array<int,string>  $script_dependencies Current script handles.
	 * @param array<string,mixed> $configuration       Executable-free Timeline configuration.
	 */
	$script_dependencies = apply_filters( 'wpbc_timeline_script_dependencies', $script_dependencies, $configuration );
	$script_dependencies = array_values(
		array_unique(
			array_filter(
				array_map( 'sanitize_key', is_array( $script_dependencies ) ? $script_dependencies : array() )
			)
		)
	);

	wp_enqueue_script(
		$configuration['asset_handles']['script'],
		trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/timeline.js',
		$script_dependencies,
		$asset_version,
		array( 'in_footer' => WPBC_JS_IN_FOOTER )
	);

	wp_localize_script(
		$configuration['asset_handles']['script'],
		'wpbc_timeline_config',
		$presenter->get_page_view_model( $is_authorized, $initial_reads )
	);
}

/**
 * Print only allow-listed Timeline WordPress templates once per request.
 *
 * @return void
 */
function wpbc_timeline_print_templates() {
	static $templates_printed = false;

	if ( $templates_printed || ! wpbc_timeline_is_page() ) {
		return;
	}

	$template_root  = realpath( __DIR__ . '/templates' );
	$template_files = wpbc_timeline_get_template_files();
	$template_ids   = wpbc_timeline_get_template_ids( 'admin' );

	if ( false === $template_root ) {
		return;
	}

	$templates_printed = true;
	WPBC_Shared_UI_Dropdown::print_template();
	WPBC_Shared_UI_Date_Range_Navigation::print_template();
	WPBC_Shared_UI_Date_Jump::print_template();
	WPBC_Shared_UI_Context_Popover::print_template();
	WPBC_Shared_UI_Inspector::print_template();
	WPBC_Booking_Inspector_Config::print_template();
	WPBC_Booking_Overview_Tooltip_Config::print_template();
	WPBC_Timeline_Booking_Resizing_Config::print_templates();
	WPBC_Timeline_Resource_Navigation_Config::print_templates();
	WPBC_Timeline_Resource_Settings_Config::print_templates();
	if ( class_exists( 'WPBC_Print' ) ) {
		WPBC_Print::print_modal();
	}
	do_action( 'wpbc_hook_booking_template__hidden_templates' );
	foreach ( $template_ids as $template_id ) {
		if ( ! isset( $template_files[ $template_id ] ) ) {
			continue;
		}

		$template_path = realpath( $template_files[ $template_id ] );
		if ( false === $template_path || 0 !== strpos( $template_path, $template_root . DIRECTORY_SEPARATOR ) || ! is_readable( $template_path ) ) {
			continue;
		}

		require $template_path;
	}
	$authorization = new WPBC_Timeline_Authorization();
	if ( $authorization->current_user_can_view() ) {
		wpbc_catalog_booking_resources_render_free_upgrade_modal();
	}
}
