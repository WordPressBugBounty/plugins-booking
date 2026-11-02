<?php
/**
 * Timeline expanded time-row movement configuration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Own projected-booking eligibility, proposal assets, and server contracts.
 */
final class WPBC_Timeline_Time_Rows_Movement_Config {

	/** Data-only browser contract version. */
	const SCHEMA_VERSION = 4;

	/** Browser module factory identifier. */
	const MODULE_ID = 'time_rows_movement';

	/** Browser module instance identifier. */
	const INSTANCE_ID = 'wpbc_timeline_time_rows_movement';

	/** Existing accepted-data projection instance. */
	const TIME_ROWS_INSTANCE_ID = 'wpbc_timeline_time_rows';

	/** Existing expanded presentation identifier. */
	const TIME_ROWS_PRESENTATION_ID = 'time_rows';

	/** Compiler-owned browser adapter handle. */
	const SCRIPT_HANDLE = 'wpbc-timeline-time-rows-movement';

	/** Compiler-owned shared pure interaction-geometry handle. */
	const GEOMETRY_SCRIPT_HANDLE = 'wpbc-timeline-time-rows-interaction-geometry';

	/** Compiler-owned stylesheet handle. */
	const STYLE_HANDLE = 'wpbc-timeline-time-rows-movement';

	/** Allow-listed movement grip template. */
	const TEMPLATE_GRIP = 'wpbc-timeline-time-rows-movement-grip';

	/** Allow-listed resize handles template. */
	const TEMPLATE_RESIZE_HANDLES = 'wpbc-timeline-time-rows-resize-handles';

	/** Allow-listed gesture ghost template. */
	const TEMPLATE_GHOST = 'wpbc-timeline-time-rows-movement-ghost';

	/** Allow-listed eligibility status template. */
	const TEMPLATE_STATUS = 'wpbc-timeline-time-rows-movement-status';

	/** @var bool Whether module hooks have been registered. */
	private static $hooks_registered = false;

	/**
	 * Register the isolated compiler-gated browser boundary.
	 *
	 * @return void
	 */
	public static function register_hooks() {
		if ( self::$hooks_registered ) {
			return;
		}
		self::$hooks_registered = true;

		add_filter( 'wpbc_timeline_browser_extensions', array( __CLASS__, 'filter_browser_extensions' ) );
		add_filter( 'wpbc_timeline_script_dependencies', array( __CLASS__, 'filter_script_dependencies' ), 30, 2 );
		add_action( 'wpbc_enqueue_css_files', array( __CLASS__, 'enqueue_style' ), 72, 1 );
		add_action( 'admin_footer', array( __CLASS__, 'print_templates' ), 42 );
	}

	/**
	 * Append one executable-free Timeline extension descriptor.
	 *
	 * @param array<int,array<string,mixed>> $extensions Existing extension records.
	 *
	 * @return array<int,array<string,mixed>> Extended records.
	 */
	public static function filter_browser_extensions( $extensions ) {
		$extensions = is_array( $extensions ) ? $extensions : array();
		if ( ! self::has_browser_runtime() ) {
			return $extensions;
		}
		$extensions[] = array(
			'module_id'     => self::MODULE_ID,
			'instance_id'   => self::INSTANCE_ID,
			'capabilities'  => array(
				'projected_booking_eligibility',
				'same_resource_movement_proposal',
				'timed_resize_proposal',
				'full_day_movement_proposal',
				'cross_resource_movement_proposal',
			),
			'configuration' => self::get_browser_configuration(),
		);

		return $extensions;
	}

	/**
	 * Enqueue the compiler-owned adapter and append its stable dependency.
	 *
	 * @param array<int,string>   $dependencies  Timeline script dependencies.
	 * @param array<string,mixed> $configuration Timeline executable-free configuration.
	 *
	 * @return array<int,string> Filtered dependency handles.
	 */
	public static function filter_script_dependencies( $dependencies, $configuration ) {
		$dependencies = is_array( $dependencies ) ? $dependencies : array();
		$asset_handles = isset( $configuration['asset_handles'] ) && is_array( $configuration['asset_handles'] )
			? $configuration['asset_handles']
			: array();
		$module_handle = isset( $asset_handles['module_runtime_script'] )
			? sanitize_key( (string) $asset_handles['module_runtime_script'] )
			: '';
		$interactions_handle = isset( $asset_handles['booking_interactions_script'] )
			? sanitize_key( (string) $asset_handles['booking_interactions_script'] )
			: '';
		if ( ! $module_handle || ! $interactions_handle || ! self::has_browser_runtime() ) {
			return $dependencies;
		}

		$runtime_assets = self::get_runtime_asset_paths();
		wp_enqueue_script(
			self::GEOMETRY_SCRIPT_HANDLE,
			trailingslashit( plugins_url( '', dirname( __DIR__ ) . '/time-rows/time-rows.php' ) ) . '_out/time-rows-interaction-geometry.js',
			array(),
			self::get_asset_version( $runtime_assets['geometry_script'] ),
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/time-rows-movement.js',
			array(
				'jquery',
				'wp-util',
				$module_handle,
				$interactions_handle,
				WPBC_Timeline_Time_Rows_Config::SCRIPT_HANDLE,
				self::GEOMETRY_SCRIPT_HANDLE,
			),
			self::get_asset_version( $runtime_assets['script'] ),
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
		$dependencies[] = self::SCRIPT_HANDLE;

		return array_values( array_unique( $dependencies ) );
	}

	/**
	 * Enqueue the compiler-owned module stylesheet on Timeline requests.
	 *
	 * @param string $where_to_load Booking Calendar asset context.
	 *
	 * @return void
	 */
	public static function enqueue_style( $where_to_load ) {
		if ( ! self::should_load_for_request( $where_to_load ) || ! self::has_browser_runtime() ) {
			return;
		}
		$runtime_assets = self::get_runtime_asset_paths();
		wp_enqueue_style(
			self::STYLE_HANDLE,
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/time-rows-movement.css',
			array( WPBC_Timeline_Time_Rows_Config::STYLE_HANDLE ),
			self::get_asset_version( $runtime_assets['style'] )
		);
	}

	/**
	 * Print fixed module-owned WordPress templates once.
	 *
	 * @return void
	 */
	public static function print_templates() {
		static $templates_printed = false;
		$template_root            = realpath( __DIR__ . '/templates' );

		if ( $templates_printed || ! wpbc_timeline_is_page() || ! self::has_browser_runtime() || false === $template_root ) {
			return;
		}
		$templates_printed = true;
		foreach ( self::get_template_files() as $template_path ) {
			$resolved_path = realpath( $template_path );
			if (
				false === $resolved_path
				|| 0 !== strpos( $resolved_path, $template_root . DIRECTORY_SEPARATOR )
				|| ! is_readable( $resolved_path )
			) {
				continue;
			}
			include $resolved_path;
		}
	}

	/**
	 * Return compiler input paths without generating runtime files.
	 *
	 * @return array<string,string> Source assets keyed by type.
	 */
	public static function get_source_asset_paths() {
		return array(
			'geometry_script' => dirname( __DIR__ ) . '/time-rows/_src/time-rows-interaction-geometry.js',
			'script'          => __DIR__ . '/_src/time-rows-movement.js',
			'style'           => __DIR__ . '/_src/time-rows-movement.css',
		);
	}

	/**
	 * Return compiler-owned runtime paths used by PHP.
	 *
	 * @return array<string,string> Runtime assets keyed by type.
	 */
	public static function get_runtime_asset_paths() {
		return array(
			'geometry_script' => dirname( __DIR__ ) . '/time-rows/_out/time-rows-interaction-geometry.js',
			'script'          => __DIR__ . '/_out/time-rows-movement.js',
			'style'           => __DIR__ . '/_out/time-rows-movement.css',
		);
	}

	/**
	 * Report whether the normal compiler produced the complete browser runtime.
	 *
	 * @return bool True when every required generated asset is readable.
	 */
	public static function has_browser_runtime() {
		if ( ! class_exists( 'WPBC_Timeline_Time_Rows_Config' ) ) {
			return false;
		}
		$runtime_assets           = self::get_runtime_asset_paths();
		$time_rows_runtime_assets = WPBC_Timeline_Time_Rows_Config::get_runtime_asset_paths();

		return is_readable( $runtime_assets['geometry_script'] )
			&& is_readable( $runtime_assets['script'] )
			&& is_readable( $runtime_assets['style'] )
			&& is_readable( $time_rows_runtime_assets['script'] )
			&& is_readable( $time_rows_runtime_assets['projector_script'] );
	}

	/**
	 * Return fixed template identifiers for the browser adapter.
	 *
	 * @return array<string,string> Semantic slots mapped to template IDs.
	 */
	public static function get_template_ids() {
		return array(
			'grip'           => self::TEMPLATE_GRIP,
			'resize_handles' => self::TEMPLATE_RESIZE_HANDLES,
			'ghost'          => self::TEMPLATE_GHOST,
			'status'         => self::TEMPLATE_STATUS,
		);
	}

	/**
	 * Return the fixed server-owned template allow list.
	 *
	 * @return array<string,string> Template IDs mapped to absolute paths.
	 */
	public static function get_template_files() {
		return array(
			self::TEMPLATE_GRIP           => __DIR__ . '/templates/time-rows-movement-grip-wptpl.php',
			self::TEMPLATE_RESIZE_HANDLES => __DIR__ . '/templates/time-rows-resize-handles-wptpl.php',
			self::TEMPLATE_GHOST          => __DIR__ . '/templates/time-rows-movement-ghost-wptpl.php',
			self::TEMPLATE_STATUS         => __DIR__ . '/templates/time-rows-movement-status-wptpl.php',
		);
	}

	/**
	 * Build executable-free authoritative eligibility configuration.
	 *
	 * Both transports belong to existing booking-domain endpoints. This module
	 * never accepts browser-provided authority and registers no additional AJAX
	 * action.
	 *
	 * @return array<string,mixed> Browser templates, transports, and text.
	 */
	public static function get_browser_configuration() {
		$movement_transport    = array();
		$resize_transport      = array();
		$review_schema_version = class_exists( 'WPBC_Booking_Rescheduling_Proposal_Contract' )
			? WPBC_Booking_Rescheduling_Proposal_Contract::SCHEMA_VERSION
			: 0;
		if ( class_exists( 'WPBC_Timeline_Booking_Movement_Config' ) ) {
			$movement_transport = array(
				'url'    => admin_url( 'admin-ajax.php' ),
				'action' => WPBC_Timeline_Booking_Movement_Config::READ_AJAX_ACTION,
				'nonce'  => wp_create_nonce( WPBC_Timeline_Booking_Movement_Config::get_read_nonce_action() ),
				'source' => 'timeline',
			);
		}
		if ( class_exists( 'WPBC_Timeline_Booking_Resizing_Config' ) ) {
			$resize_transport                   = WPBC_Timeline_Booking_Resizing_Config::get_read_transport();
			$resize_transport['schema_version'] = WPBC_Timeline_Booking_Resizing_Config::SCHEMA_VERSION;
		}

		return array(
			'schema_version'         => self::SCHEMA_VERSION,
			'review_schema_version'  => $review_schema_version,
			'selection_step_minutes' => WPBC_Timeline_Time_Rows_Selection_Config::SELECTION_STEP_MINUTES,
			'optional_gestures'      => array(
				'full_day_movement'       => true,
				'full_day_resize'         => false,
				'cross_resource_movement' => true,
			),
			'time_rows'      => array(
				'instance_id'     => self::TIME_ROWS_INSTANCE_ID,
				'presentation_id' => self::TIME_ROWS_PRESENTATION_ID,
			),
			'transport'      => array(
				'movement' => $movement_transport,
				'resize'   => $resize_transport,
			),
			'templates'      => self::get_template_ids(),
			'i18n'           => array(
				'checking'              => __( 'Checking booking movement and resize eligibility.', 'booking' ),
				'ready'                 => __( 'Authorized booking controls are ready.', 'booking' ),
				'denied'                => __( 'Use the full Reschedule dialog to change this booking.', 'booking' ),
				'resize_denial_reasons' => array(
					'appointment_booking' => __( 'Appointment bookings keep their saved Service duration and cannot be resized directly. Use the full Reschedule dialog.', 'booking' ),
					'capacity_booking'    => __( 'This booking uses a capacity allocation that cannot be resized safely in the Timeline. Use the full Reschedule dialog.', 'booking' ),
					'ambiguous_schedule'  => __( 'The saved booking schedule cannot be resized directly. Use the full Reschedule dialog.', 'booking' ),
					'boundaries_clipped'  => __( 'This Timeline segment does not show a resizable booking boundary. Scroll to the booking boundary or use the full Reschedule dialog.', 'booking' ),
					'boundary_clipped'    => __( 'One booking boundary is outside this Timeline segment. Scroll to that boundary or use the full Reschedule dialog.', 'booking' ),
					'full_reschedule'     => __( 'Use the full Reschedule dialog to change this booking.', 'booking' ),
				),
				'error'                 => __( 'Booking interaction eligibility could not be checked.', 'booking' ),
				'movement_label'        => __( 'Move booking', 'booking' ),
				'resize_group_label'       => __( 'Booking resize boundaries', 'booking' ),
				'resize_start_label'       => __( 'Resize booking start', 'booking' ),
				'resize_end_label'         => __( 'Resize booking end', 'booking' ),
				'resize_keyboard_fallback' => __(
					'Press Enter or Space to open the full Reschedule dialog. Drag this handle to preview an exact boundary change.',
					'booking'
				),
				'resize_gesture_started'   => __(
					'Booking resize started. Move the boundary to an exact date and time, then release to review.',
					'booking'
				),
				'resize_proposal_changed'  => __( 'Proposed boundary: %1$s at %2$s.', 'booking' ),
				'resize_proposal_changed_all_day' => __( 'Proposed boundary date: %s.', 'booking' ),
				'resize_group_explanation' => __( 'The same boundary change will be reviewed for every occurrence in this saved schedule.', 'booking' ),
				// JavaScript selects these templates; context keeps them separate from the canonical PHP plural pairs.
				/* translators: %s: duration value. */
				'resize_duration_day'      => _x( '%s day', 'Timeline duration', 'booking' ),
				/* translators: %s: duration value. */
				'resize_duration_days'     => _x( '%s days', 'Timeline duration', 'booking' ),
				/* translators: %s: duration value. */
				'resize_duration_hour'     => _x( '%s hour', 'Timeline duration', 'booking' ),
				/* translators: %s: duration value. */
				'resize_duration_hours'    => _x( '%s hours', 'Timeline duration', 'booking' ),
				/* translators: %s: duration value. */
				'resize_duration_minute'   => _x( '%s minute', 'Timeline duration', 'booking' ),
				/* translators: %s: duration value. */
				'resize_duration_minutes'  => _x( '%s minutes', 'Timeline duration', 'booking' ),
				'resize_group'             => __( '%s occurrences', 'booking' ),
				'resize_no_change'         => __( 'The booking boundary was not changed.', 'booking' ),
				'resize_cancelled'         => __( 'Booking resize cancelled.', 'booking' ),
				'resize_review_unavailable' => __( 'The booking resize review is unavailable. Reload the Timeline and try again.', 'booking' ),
				'keyboard_instructions' => __( 'Press Enter to start. Use Left and Right to change the date, Up and Down to change the time, Enter to review, or Escape to cancel.', 'booking' ),
				'full_day_keyboard_instructions' => __( 'Press Enter to start. Use Left and Right to change the date, Enter to review, or Escape to cancel.', 'booking' ),
				'gesture_started'       => __( 'Booking movement started. Move to a new date and time, then release to review.', 'booking' ),
				'keyboard_started'      => __( 'Keyboard movement started. Use arrow keys, then press Enter to review or Escape to cancel.', 'booking' ),
				'proposal_changed'      => __( 'Proposed start: %1$s at %2$s.', 'booking' ),
				'proposal_changed_all_day' => __( 'Proposed start date: %s.', 'booking' ),
				'group_shift'           => __( 'All selected occurrences will move by the same date and time shift.', 'booking' ),
				'cross_resource_started' => __( 'Cross-Resource movement started. Move to an authorized expanded Resource and release to review.', 'booking' ),
				'cross_resource_changed' => __( 'Proposed Resource %1$s, starting %2$s at %3$s.', 'booking' ),
				'cross_resource_changed_all_day' => __( 'Proposed Resource %1$s, starting %2$s.', 'booking' ),
				'fold_unavailable'      => __( 'Choose an unambiguous time outside the repeated clock hour.', 'booking' ),
				'gap_unavailable'       => __( 'That local time does not exist because of a daylight-saving transition.', 'booking' ),
				'outside_unavailable'   => __( 'The proposed time is outside the loaded Timeline range.', 'booking' ),
				'no_change'             => __( 'The booking was not moved.', 'booking' ),
				'cancelled'             => __( 'Booking movement cancelled.', 'booking' ),
				'review_unavailable'    => __( 'The booking movement review is unavailable. Reload the Timeline and try again.', 'booking' ),
			),
		);
	}

	/**
	 * Decide whether module assets belong to the current request.
	 *
	 * @param string $where_to_load Booking Calendar asset context.
	 *
	 * @return bool True only for the isolated administration Timeline.
	 */
	private static function should_load_for_request( $where_to_load ) {
		return in_array( $where_to_load, array( 'admin', 'both' ), true ) && wpbc_timeline_is_page();
	}

	/**
	 * Build one cache-safe compiler-owned asset version.
	 *
	 * @param string $asset_path Absolute runtime path.
	 *
	 * @return string Plugin version extended by the modification time.
	 */
	private static function get_asset_version( $asset_path ) {
		$asset_modified = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;

		return false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;
	}
}
