<?php
/**
 * Timeline time-row selection server and development-draft configuration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Own selection identifiers, development hooks, assets, templates, and text.
 */
final class WPBC_Timeline_Time_Rows_Selection_Config {

	/** Data-only browser interaction contract version. */
	const SCHEMA_VERSION = 2;

	/** Time-row selection surface identifier. */
	const SELECTION_SURFACE = 'time_rows';

	/** Timed selection kind. */
	const SELECTION_KIND_TIMED = 'timed';

	/** Full local-day selection kind. */
	const SELECTION_KIND_ALL_DAY = 'all_day';

	/** Server-owned timed selection increment in wall-clock minutes. */
	const SELECTION_STEP_MINUTES = 15;

	/** Browser module factory ID. */
	const MODULE_ID = 'time_rows_selection';

	/** Browser module instance ID. */
	const INSTANCE_ID = 'wpbc_timeline_time_rows_selection';

	/** Existing time-rows browser instance providing accepted geometry context. */
	const TIME_ROWS_INSTANCE_ID = 'wpbc_timeline_time_rows';

	/** Existing time-rows presentation ID. */
	const TIME_ROWS_PRESENTATION_ID = 'time_rows';

	/** Compiler-owned browser adapter handle. */
	const SCRIPT_HANDLE = 'wpbc-timeline-time-rows-selection';

	/** Compiler-owned shared pure geometry handle. */
	const GEOMETRY_SCRIPT_HANDLE = 'wpbc-timeline-time-rows-interaction-geometry';

	/** Compiler-owned stylesheet handle. */
	const STYLE_HANDLE = 'wpbc-timeline-time-rows-selection';

	/** Allow-listed draft-overlay template ID. */
	const TEMPLATE_DRAFT = 'wpbc-timeline-time-rows-selection-draft';

	/** Allow-listed accessible-status template ID. */
	const TEMPLATE_STATUS = 'wpbc-timeline-time-rows-selection-status';

	/** Allow-listed authoritative action-popover template ID. */
	const TEMPLATE_ACTIONS = 'wpbc-timeline-time-rows-selection-actions';

	/** @var bool Whether development browser hooks were registered. */
	private static $hooks_registered = false;

	/**
	 * Return the executable-free server selection contract.
	 *
	 * The browser may receive this value in a later presentation phase, but it
	 * never supplies or overrides the authoritative step during validation.
	 *
	 * @return array<string,mixed> Stable selection configuration.
	 */
	public static function get_configuration() {
		return array(
			'schema_version'         => 1,
			'selection_surface'      => self::SELECTION_SURFACE,
			'selection_step_minutes' => self::SELECTION_STEP_MINUTES,
			'selection_kinds'        => array(
				self::SELECTION_KIND_TIMED,
				self::SELECTION_KIND_ALL_DAY,
			),
		);
	}

	/**
	 * Determine whether the development-only local draft adapter is enabled.
	 *
	 * The parent time-rows feature gate remains the primary rollback boundary.
	 * This filter supports focused development tests without a stored setting or
	 * customer-facing switch.
	 *
	 * @return bool True when draft presentation hooks may register.
	 */
	public static function is_draft_enabled() {
		/**
		 * Filters whether the development-only time-row selection draft loads.
		 *
		 * @since 12.0.0
		 *
		 * @param bool $is_enabled Development default state.
		 */
		return (bool) apply_filters( 'wpbc_timeline_time_rows_selection_draft_enabled', true );
	}

	/**
	 * Register development-only assets, templates, and browser configuration.
	 *
	 * @return void
	 */
	public static function register_hooks() {
		if ( self::$hooks_registered || ! self::is_draft_enabled() ) {
			return;
		}
		self::$hooks_registered = true;

		add_filter( 'wpbc_timeline_browser_extensions', array( __CLASS__, 'filter_browser_extensions' ) );
		add_filter( 'wpbc_timeline_script_dependencies', array( __CLASS__, 'filter_script_dependencies' ), 20, 2 );
		add_action( 'wpbc_enqueue_css_files', array( __CLASS__, 'enqueue_style' ), 71, 1 );
		add_action( 'admin_footer', array( __CLASS__, 'print_templates' ), 41 );
	}

	/**
	 * Append the fixed executable-free browser extension registration.
	 *
	 * @param array<int,array<string,mixed>> $extensions Existing extensions.
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
			'capabilities'  => array( 'selection_actions' ),
			'configuration' => self::get_browser_configuration(),
		);

		return $extensions;
	}

	/**
	 * Enqueue compiler-owned scripts and append the adapter dependency.
	 *
	 * @param array<int,string>   $dependencies  Timeline dependencies.
	 * @param array<string,mixed> $configuration Timeline configuration.
	 *
	 * @return array<int,string> Filtered dependency handles.
	 */
	public static function filter_script_dependencies( $dependencies, $configuration ) {
		$dependencies  = is_array( $dependencies ) ? $dependencies : array();
		$module_handle = isset( $configuration['asset_handles']['module_runtime_script'] )
			? sanitize_key( (string) $configuration['asset_handles']['module_runtime_script'] )
			: '';
		if ( ! $module_handle || ! self::has_browser_runtime() ) {
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
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/time-rows-selection.js',
			array(
				$module_handle,
				'wp-util',
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
	 * Enqueue the compiler-owned stylesheet on the administration Timeline.
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
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/time-rows-selection.css',
			array( WPBC_Timeline_Time_Rows_Config::STYLE_HANDLE ),
			self::get_asset_version( $runtime_assets['style'] )
		);
	}

	/**
	 * Print the fixed allow-listed WordPress templates once.
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
	 * Return compiler input paths without creating generated files.
	 *
	 * @return array<string,string> Source assets keyed by type.
	 */
	public static function get_source_asset_paths() {
		return array(
			'geometry_script' => dirname( __DIR__ ) . '/time-rows/_src/time-rows-interaction-geometry.js',
			'script'          => __DIR__ . '/_src/time-rows-selection.js',
			'style'           => __DIR__ . '/_src/time-rows-selection.css',
		);
	}

	/**
	 * Return compiler-owned runtime paths referenced by PHP.
	 *
	 * @return array<string,string> Runtime assets keyed by type.
	 */
	public static function get_runtime_asset_paths() {
		return array(
			'geometry_script' => dirname( __DIR__ ) . '/time-rows/_out/time-rows-interaction-geometry.js',
			'script'          => __DIR__ . '/_out/time-rows-selection.js',
			'style'           => __DIR__ . '/_out/time-rows-selection.css',
		);
	}

	/**
	 * Report whether every compiler-owned browser dependency is readable.
	 *
	 * @return bool True only after the normal compiler creates all runtime files.
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
			&& is_readable( $time_rows_runtime_assets['projector_script'] )
			&& is_readable( $time_rows_runtime_assets['script'] )
			&& is_readable( $time_rows_runtime_assets['style'] );
	}

	/**
	 * Return fixed template identifiers.
	 *
	 * @return array<string,string> Semantic keys mapped to template IDs.
	 */
	public static function get_template_ids() {
		return array(
			'draft'   => self::TEMPLATE_DRAFT,
			'status'  => self::TEMPLATE_STATUS,
			'actions' => self::TEMPLATE_ACTIONS,
		);
	}

	/**
	 * Return the fixed server-owned template allow list.
	 *
	 * @return array<string,string> Template IDs mapped to absolute paths.
	 */
	public static function get_template_files() {
		return array(
			self::TEMPLATE_DRAFT   => __DIR__ . '/templates/time-rows-selection-draft-wptpl.php',
			self::TEMPLATE_STATUS  => __DIR__ . '/templates/time-rows-selection-status-wptpl.php',
			self::TEMPLATE_ACTIONS => __DIR__ . '/templates/time-rows-selection-actions-wptpl.php',
		);
	}

	/**
	 * Return executable-free local interaction configuration.
	 *
	 * Transport and signed loaded-window state remain owned by the Timeline page
	 * controller and are resolved only when an explicit preview or apply occurs.
	 *
	 * @return array<string,mixed> Browser identifiers, templates, limits, and text.
	 */
	public static function get_browser_configuration() {
		return array(
			'schema_version'         => self::SCHEMA_VERSION,
			'selection_surface'      => self::SELECTION_SURFACE,
			'selection_kind'         => self::SELECTION_KIND_TIMED,
			'selection_step_minutes' => self::SELECTION_STEP_MINUTES,
			'time_rows'              => array(
				'instance_id'     => self::TIME_ROWS_INSTANCE_ID,
				'presentation_id' => self::TIME_ROWS_PRESENTATION_ID,
			),
			'templates'              => self::get_template_ids(),
			'gesture'                => array(
				'touch_tolerance_pixels' => 8,
			),
			'i18n'                   => array(
				'surface_label'       => __( 'Select an empty time range for this Resource', 'booking' ),
				'instructions'        => __( 'Press Enter to start a selection. Use the start and end controls with arrow keys, Home, or End. Press Enter to review actions or Escape to cancel.', 'booking' ),
				'draft_label'         => __( 'Selected time from {start} to {end}', 'booking' ),
				/* translators: {start}: selection start; {end}: selection end; {duration}: exact duration. */
				'draft_label_with_duration' => __( 'Selected time from {start} to {end}, lasting {duration}', 'booking' ),
				/* translators: {start}: accepted selection start wall date and time. */
				'draft_start_summary' => __( '{start}', 'booking' ),
				/* translators: {end}: accepted selection end wall date and time. */
				'draft_end_summary'   => __( '{end}', 'booking' ),
				/* translators: {count}: number of complete hours in the selected time range. */
				'duration_hours_short' => __( '{count} h', 'booking' ),
				/* translators: {count}: number of remaining minutes in the selected time range. */
				'duration_minutes_short' => __( '{count} min', 'booking' ),
				/* translators: {hours}: formatted hours; {minutes}: formatted minutes. */
				'duration_hours_minutes_short' => __( '{hours} {minutes}', 'booking' ),
				'start_control_label' => __( 'Selection start: {time}. Use arrow keys to adjust.', 'booking' ),
				'end_control_label'   => __( 'Selection end: {time}. Use arrow keys to adjust.', 'booking' ),
				'draft_ready'         => __( 'Time range selected. Press Enter to review available actions.', 'booking' ),
				'dst_gap'             => __( 'This local time does not exist because of a daylight-saving time change.', 'booking' ),
				'dst_fold'            => __( 'This local time occurs twice. An exact occurrence must be chosen before review.', 'booking' ),
				'fold_group_label'     => __( 'Choose the exact repeated-hour occurrence', 'booking' ),
				'fold_instructions'    => __( 'This clock time occurs twice. Choose the exact UTC offset for each affected boundary.', 'booking' ),
				'fold_start_boundary'  => __( 'Start', 'booking' ),
				'fold_end_boundary'    => __( 'End', 'booking' ),
				/* translators: 1: boundary label; 2: date; 3: local time; 4: exact UTC offset. */
				'fold_choice_label'    => __( '{boundary}: {date} at {time} ({offset})', 'booking' ),
				'cancelled'           => __( 'Time-range selection cancelled.', 'booking' ),
				'unavailable'         => __( 'Time-range selection is unavailable until the expanded schedule is ready.', 'booking' ),
				'preview_label'       => __( 'Selected time actions', 'booking' ),
				'checking_selection'  => __( 'Checking this selection…', 'booking' ),
				'applying_availability' => __( 'Applying Availability changes…', 'booking' ),
				'awaiting_readback'   => __( 'Refreshing the authoritative Timeline…', 'booking' ),
				'preview_ready'       => __( 'Available actions are ready.', 'booking' ),
				'availability_requires_review' => __( 'Availability is not fully authoritative for this range. The destination workflow will validate it again.', 'booking' ),
				'preview_error'       => __( 'The selected time could not be reviewed. Try again.', 'booking' ),
				'apply_error'         => __( 'The Availability change could not be applied. Review the selection and try again.', 'booking' ),
				'retry_selection'     => __( 'Retry', 'booking' ),
				'cancel_selection'    => __( 'Cancel selection', 'booking' ),
			),
		);
	}

	/**
	 * Decide whether selection assets belong to the current request.
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
