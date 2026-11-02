<?php
/**
 * Executable-free configuration contracts for the administration Timeline.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return the stable Timeline identifiers, presentation packs, and limits.
 *
 * The records in this configuration contain identifiers and scalar limits only.
 * Authorization, data access, business calculations, and mutations belong to
 * dedicated domain layers and never to executable configuration.
 *
 * @return array<string,mixed> Timeline configuration.
 */
function wpbc_timeline_get_configuration() {
	return array(
		'component_id'          => 'wpbc_timeline',
		'canonical_page_id'     => 'wpbc__timeline',
		'route'                 => array(
			'page' => 'wpbc',
			'tab'  => 'timeline',
		),
		'default_template_pack' => 'admin',
		'template_packs'        => array(
			'admin' => array(
				'shell'         => 'wpbc-timeline-shell',
				'toolbar'       => 'wpbc-timeline-toolbar',
				'axis_header'   => 'wpbc-timeline-axis-header',
				'canvas_backdrop' => 'wpbc-timeline-canvas-backdrop',
				'resource_row'  => 'wpbc-timeline-resource-row',
				'booking_segment' => 'wpbc-timeline-booking-segment',
				'time_slot_overflow' => 'wpbc-timeline-time-slot-overflow',
				'selection'       => 'wpbc-timeline-selection',
				'selection_popover' => 'wpbc-timeline-selection-popover',
				'loading'       => 'wpbc-timeline-loading',
				'edge_idle'     => 'wpbc-timeline-edge-idle',
				'edge_loading'  => 'wpbc-timeline-edge-loading',
				'edge_slow'     => 'wpbc-timeline-edge-slow',
				'edge_error'    => 'wpbc-timeline-edge-error',
				'empty'         => 'wpbc-timeline-empty',
				'error'         => 'wpbc-timeline-error',
				'unauthorized'  => 'wpbc-timeline-unauthorized',
				'legend'        => 'wpbc-timeline-legend',
			),
		),
		'navigation_packs'      => array( 'white' ),
		'default_navigation_pack' => 'white',
		'asset_handles'         => array(
			'module_runtime_script'       => 'wpbc-timeline-modules',
			'window_cache_script'         => 'wpbc-timeline-window-cache',
			'availability_cache_script'   => 'wpbc-timeline-availability-cache',
			'toolbar_navigation_script'   => 'wpbc-timeline-toolbar-navigation',
			'empty_range_selection_script' => 'wpbc-timeline-empty-range-selection',
			'booking_interactions_script'  => 'wpbc-timeline-booking-interactions',
			'rendering_script'             => 'wpbc-timeline-rendering',
			'page_controller_script'       => 'wpbc-timeline-page-controller',
			'script'                      => 'wpbc-timeline',
			'style'                       => 'wpbc-timeline',
		),
		'default_view'          => 'day',
		'default_preset'        => 'month',
		'presets'               => array(
			'month'      => array(
				'window_days'            => 0,
				'window_months'          => 1,
				'view'                   => 'day',
				'locks_view'             => false,
				'label'                  => __( '1 month', 'booking' ),
			),
			'two-weeks'  => array(
				'window_days'            => 14,
				'window_months'          => 0,
				'view'                   => 'day',
				'locks_view'             => false,
				'label'                  => __( '2 weeks', 'booking' ),
			),
			'week'       => array(
				'window_days'            => 7,
				'window_months'          => 0,
				'view'                   => '6-hours',
				'locks_view'             => false,
				'label'                  => __( 'Week', 'booking' ),
			),
			'day'        => array(
				'window_days'            => 1,
				'window_months'          => 0,
				'view'                   => 'hour',
				'locks_view'             => false,
				'label'                  => __( 'Day', 'booking' ),
			),
			'two-months' => array(
				'window_days'            => 0,
				'window_months'          => 2,
				'view'                   => 'day',
				'locks_view'             => false,
				'label'                  => __( '2 months', 'booking' ),
			),
		),
		/*
		 * Exact visible dropdown contract. Values are opaque UI identifiers;
		 * preset and view mappings carry the Timeline request meaning.
		 */
		'range_scale_options'    => array(
			array(
				'value'     => 'month_day',
				'title'     => __( '1 month — 1 day', 'booking' ),
				'preset_id' => 'month',
				'view_id'   => 'day',
			),
			array(
				'value'     => 'month_12_hours',
				'title'     => __( '1 month — 12 hours', 'booking' ),
				'preset_id' => 'month',
				'view_id'   => '12-hours',
			),
			array(
				'value'     => 'month_6_hours',
				'title'     => __( '1 month — 6 hours', 'booking' ),
				'preset_id' => 'month',
				'view_id'   => '6-hours',
			),
			array(
				'value'     => 'two_weeks_3_hours',
				'title'     => __( '2 weeks — 3 hours', 'booking' ),
				'preset_id' => 'two-weeks',
				'view_id'   => '3-hours',
			),
			array(
				'value'     => 'two_weeks_2_hours',
				'title'     => __( '2 weeks — 2 hours', 'booking' ),
				'preset_id' => 'two-weeks',
				'view_id'   => '2-hours',
			),
			array(
				'value'     => 'week_hour',
				'title'     => __( 'Week — 1 hour', 'booking' ),
				'preset_id' => 'week',
				'view_id'   => 'hour',
			),
			array(
				'value'     => 'week_30_minutes',
				'title'     => __( 'Week — 30 minutes', 'booking' ),
				'preset_id' => 'week',
				'view_id'   => '30-minutes',
			),
			array(
				'value'     => 'day_15_minutes',
				'title'     => __( 'Day — 15 minutes', 'booking' ),
				'preset_id' => 'day',
				'view_id'   => '15-minutes',
			),
			array(
				'value'     => 'day_10_minutes',
				'title'     => __( 'Day — 10 minutes', 'booking' ),
				'preset_id' => 'day',
				'view_id'   => '10-minutes',
			),
			array(
				'value'     => 'day_5_minutes',
				'title'     => __( 'Day — 5 minutes', 'booking' ),
				'preset_id' => 'day',
				'view_id'   => '5-minutes',
			),
		),
		'supported_views'       => array(
			'day'       => array( 'cell_minutes' => 1440, 'label' => __( '1 day', 'booking' ) ),
			'12-hours'  => array( 'cell_minutes' => 720, 'label' => __( '12 hours', 'booking' ) ),
			'6-hours'   => array( 'cell_minutes' => 360, 'label' => __( '6 hours', 'booking' ) ),
			'3-hours'   => array( 'cell_minutes' => 180, 'label' => __( '3 hours', 'booking' ) ),
			'2-hours'   => array( 'cell_minutes' => 120, 'label' => __( '2 hours', 'booking' ) ),
			'hour'      => array( 'cell_minutes' => 60, 'label' => __( '1 hour', 'booking' ) ),
			'30-minutes' => array( 'cell_minutes' => 30, 'label' => __( '30 minutes', 'booking' ) ),
			'15-minutes' => array( 'cell_minutes' => 15, 'label' => __( '15 minutes', 'booking' ) ),
			'10-minutes' => array( 'cell_minutes' => 10, 'label' => __( '10 minutes', 'booking' ) ),
			'5-minutes'  => array( 'cell_minutes' => 5, 'label' => __( '5 minutes', 'booking' ) ),
		),
		'limits'                 => array(
			'default_window_days'           => 14,
			'maximum_window_days'           => 62,
			'maximum_window_months'         => 2,
			'default_resources'             => 20,
			'maximum_resources'             => 50,
			'maximum_axis_buckets'          => 25000,
			'maximum_projection_date_rows' => 50000,
			'maximum_segments'              => 10000,
			'maximum_intervals'             => 10000,
			'maximum_queries'               => 200,
			'maximum_resource_selector_queries' => 12,
			'maximum_json_bytes'            => 1572864,
		),
		'window_loading'         => array(
			'maximum_cached_windows' => 3,
			'edge_placeholder_cells' => 3,
			'edge_prefetch_percent'  => 18,
			'edge_rearm_percent'     => 32,
			'request_cooldown_ms'    => 400,
			'slow_loading_ms'        => 3000,
			'request_timeout_ms'     => 15000,
		),
		'visual_zoom'           => array(
			'min_percent'     => 30,
			'max_percent'     => 300,
			'step_percent'    => 10,
			'default_percent' => 100,
		),
	);
}

/**
 * Return the trusted Timeline WordPress-template file map.
 *
 * Template paths are defined only by the server. No request or browser value is
 * accepted as a template identifier or filesystem path.
 *
 * @return array<string,string> Template identifiers mapped to absolute files.
 */
function wpbc_timeline_get_template_files() {
	return array(
		'wpbc-timeline-shell'        => __DIR__ . '/templates/timeline-shell-wptpl.php',
		'wpbc-timeline-toolbar'      => __DIR__ . '/templates/timeline-toolbar-wptpl.php',
		'wpbc-timeline-axis-header'  => __DIR__ . '/templates/axis-header-wptpl.php',
		'wpbc-timeline-canvas-backdrop' => __DIR__ . '/templates/canvas-backdrop-wptpl.php',
		'wpbc-timeline-resource-row' => __DIR__ . '/templates/resource-row-wptpl.php',
		'wpbc-timeline-booking-segment' => __DIR__ . '/templates/booking-segment-wptpl.php',
		'wpbc-timeline-time-slot-overflow' => __DIR__ . '/templates/time-slot-overflow-wptpl.php',
		'wpbc-timeline-selection'    => __DIR__ . '/templates/selection-wptpl.php',
		'wpbc-timeline-selection-popover' => __DIR__ . '/templates/selection-popover-wptpl.php',
		'wpbc-timeline-loading'      => __DIR__ . '/templates/loading-state-wptpl.php',
		'wpbc-timeline-edge-idle'    => __DIR__ . '/templates/edge-idle-wptpl.php',
		'wpbc-timeline-edge-loading' => __DIR__ . '/templates/edge-loading-wptpl.php',
		'wpbc-timeline-edge-slow'    => __DIR__ . '/templates/edge-slow-wptpl.php',
		'wpbc-timeline-edge-error'   => __DIR__ . '/templates/edge-error-wptpl.php',
		'wpbc-timeline-empty'        => __DIR__ . '/templates/empty-state-wptpl.php',
		'wpbc-timeline-error'        => __DIR__ . '/templates/error-state-wptpl.php',
		'wpbc-timeline-unauthorized' => __DIR__ . '/templates/unauthorized-state-wptpl.php',
		'wpbc-timeline-legend'       => __DIR__ . '/templates/legend-wptpl.php',
	);
}

/**
 * Return the template IDs referenced by the selected server-defined pack.
 *
 * @param string $template_pack Requested server-defined pack identifier.
 *
 * @return array<int,string> Ordered allow-listed template identifiers.
 */
function wpbc_timeline_get_template_ids( $template_pack = 'admin' ) {
	$configuration = wpbc_timeline_get_configuration();
	$template_pack = is_scalar( $template_pack ) ? sanitize_key( (string) $template_pack ) : '';

	if ( ! isset( $configuration['template_packs'][ $template_pack ] ) ) {
		$template_pack = $configuration['default_template_pack'];
	}

	return array_values( $configuration['template_packs'][ $template_pack ] );
}
