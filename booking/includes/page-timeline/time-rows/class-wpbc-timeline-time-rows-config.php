<?php
/**
 * Isolated Timeline time-rows module configuration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Own the time-rows descriptor, templates, source/runtime assets, and browser schema.
 */
final class WPBC_Timeline_Time_Rows_Config {

	/** Data-only browser contract version. */
	const SCHEMA_VERSION = 10;

	/** Pure projection DTO schema version. */
	const PROJECTION_SCHEMA_VERSION = 1;

	/** Registered neutral presentation ID. */
	const PRESENTATION_ID = 'time_rows';

	/** Registered neutral presentation template key. */
	const PRESENTATION_TEMPLATE_KEY = 'time_rows';

	/** Browser module factory ID. */
	const MODULE_ID = 'time_rows';

	/** Browser module instance ID. */
	const INSTANCE_ID = 'wpbc_timeline_time_rows';

	/** Compiler-owned browser adapter handle. */
	const SCRIPT_HANDLE = 'wpbc-timeline-time-rows';

	/** Compiler-owned pure projector handle. */
	const PROJECTOR_SCRIPT_HANDLE = 'wpbc-timeline-time-rows-projector';

	/** Compiler-owned presentation stylesheet handle. */
	const STYLE_HANDLE = 'wpbc-timeline-time-rows';

	/** Allow-listed Resource-side panel template ID. */
	const TEMPLATE_RESOURCE = 'wpbc-timeline-time-rows-resource';

	/** Allow-listed canvas-side panel template ID. */
	const TEMPLATE_CANVAS = 'wpbc-timeline-time-rows-canvas';

	/** Allow-listed Availability state template ID. */
	const TEMPLATE_STATE = 'wpbc-timeline-time-rows-state';

	/** Allow-listed Availability background template ID. */
	const TEMPLATE_AVAILABILITY = 'wpbc-timeline-time-rows-availability';

	/** Allow-listed accessible summary template ID. */
	const TEMPLATE_SUMMARY = 'wpbc-timeline-time-rows-summary';

	/** Maximum windows mirrored from the native bounded cache. */
	const MAXIMUM_CACHED_WINDOWS = 3;

	/** Maximum timed booking lanes rendered directly before overflow. */
	const MAXIMUM_VISIBLE_LANES = 3;

	/** Safe Auto range start when exact Working Time is unavailable. */
	const AUTO_SAFE_START_MINUTE = 480;

	/** Safe Auto range end when exact Working Time is unavailable. */
	const AUTO_SAFE_END_MINUTE = 1080;

	/** Wall-minute increment exposed by the local visible-time range control. */
	const TIME_RANGE_STEP_MINUTES = 60;

	/** Minimum local vertical zoom percentage. */
	const TIME_ZOOM_MIN_PERCENT = 30;

	/** Maximum local vertical zoom percentage. */
	const TIME_ZOOM_MAX_PERCENT = 300;

	/** Local vertical zoom increment. */
	const TIME_ZOOM_STEP_PERCENT = 10;

	/** Default local vertical zoom percentage. */
	const TIME_ZOOM_DEFAULT_PERCENT = 100;

	/** Base CSS pixels rendered for one visible wall-clock hour. */
	const TIME_HOUR_HEIGHT_PX = 52;

	/** Minimum timed-surface height in CSS pixels. */
	const TIME_BODY_MIN_HEIGHT_PX = 260;

	/** @var bool Whether production hooks were registered this request. */
	private static $hooks_registered = false;

	/** @var bool Whether the shared production registry accepted the descriptor. */
	private static $presentation_registered = false;

	/** @var WPBC_Timeline_Time_Rows_Preferences|null Request-local preference service. */
	private static $preferences_service;

	/**
	 * Register the mode-neutral presentation with the shared server allow list.
	 *
	 * @param WPBC_Timeline_Row_Presentation_Registry|null $registry Optional controlled registry for tests.
	 *
	 * @return true|WP_Error Registration result.
	 */
	public static function register_presentation( $registry = null ) {
		$is_shared_registry = null === $registry;

		if ( $is_shared_registry && self::$presentation_registered ) {
			return true;
		}
		$registry = $registry ? $registry : WPBC_Timeline_Row_Presentation_Registry::get_instance();
		$result   = $registry->register(
			array(
				'id'                  => self::PRESENTATION_ID,
				'label'               => __( 'Expanded schedule', 'booking' ),
				'template_key'        => self::PRESENTATION_TEMPLATE_KEY,
				'is_exclusive'        => true,
				'is_read_only'        => true,
				'toggle_open_label'  => __( 'Expand Time Section', 'booking' ),
				'toggle_close_label' => __( 'Collapse Time Section', 'booking' ),
			),
			new WPBC_Timeline_Time_Rows_Provider()
		);
		if ( $is_shared_registry && true === $result ) {
			self::$presentation_registered = true;
		}

		return $result;
	}

	/**
	 * Register module-owned assets, templates, and executable-free extension data.
	 *
	 * @return void
	 */
	public static function register_hooks() {
		if ( self::$hooks_registered ) {
			return;
		}
		self::$hooks_registered = true;

		add_filter( 'wpbc_timeline_preference_extension_keys', array( __CLASS__, 'filter_preference_extension_keys' ) );
		add_filter( 'wpbc_timeline_resource_dto', array( __CLASS__, 'filter_resource_dto' ), 10, 2 );
		add_filter( 'wpbc_timeline_browser_extensions', array( __CLASS__, 'filter_browser_extensions' ) );
		add_filter( 'wpbc_timeline_script_dependencies', array( __CLASS__, 'filter_script_dependencies' ), 10, 2 );
		add_action( 'wpbc_enqueue_css_files', array( __CLASS__, 'enqueue_style' ), 69, 1 );
		add_action( 'admin_footer', array( __CLASS__, 'print_templates' ), 39 );
	}

	/**
	 * Register the domain-owned key in the neutral Timeline preference record.
	 *
	 * @param array<int,string> $extension_keys Existing server-owned keys.
	 *
	 * @return array<int,string> Extended key allow list.
	 */
	public static function filter_preference_extension_keys( $extension_keys ) {
		$extension_keys   = is_array( $extension_keys ) ? $extension_keys : array();
		$extension_keys[] = WPBC_Timeline_Time_Rows_Preferences::EXTENSION_KEY;

		return $extension_keys;
	}

	/**
	 * Attach authorized per-Resource preferences to the neutral Resource DTO.
	 *
	 * The mapper invokes this filter only after the repository and MultiUser
	 * boundary produced an authorized Resource. The resulting values contain no
	 * labels, HTML, paths, callbacks, SQL, or mutation authority.
	 *
	 * @param array<string,mixed> $resource_dto Authorized Resource DTO.
	 * @param array<string,mixed> $resource     Authorized domain Resource record.
	 *
	 * @return array<string,mixed> Resource DTO with domain presentation settings.
	 */
	public static function filter_resource_dto( $resource_dto, $resource ) {
		$resource_dto = is_array( $resource_dto ) ? $resource_dto : array();
		$resource_id  = isset( $resource['id'] ) ? absint( $resource['id'] ) : 0;
		if ( ! $resource_id ) {
			return $resource_dto;
		}

		$resource_dto['row_presentation_preferences'] = isset( $resource_dto['row_presentation_preferences'] ) && is_array( $resource_dto['row_presentation_preferences'] )
			? $resource_dto['row_presentation_preferences']
			: array();
		$resource_dto['row_presentation_preferences'][ self::PRESENTATION_ID ] = self::get_preferences_service()->get_for_resource( $resource_id );

		return $resource_dto;
	}

	/**
	 * Return the request-local preference service shared by DTO mapping and AJAX.
	 *
	 * @return WPBC_Timeline_Time_Rows_Preferences Domain preference service.
	 */
	public static function get_preferences_service() {
		if ( ! self::$preferences_service ) {
			self::$preferences_service = new WPBC_Timeline_Time_Rows_Preferences();
		}

		return self::$preferences_service;
	}

	/**
	 * Append the fixed browser extension registration.
	 *
	 * @param array<int,array<string,mixed>> $extensions Existing extension records.
	 *
	 * @return array<int,array<string,mixed>> Extended records.
	 */
	public static function filter_browser_extensions( $extensions ) {
		$extensions   = is_array( $extensions ) ? $extensions : array();
		$extensions[] = array(
			'module_id'     => self::MODULE_ID,
			'instance_id'   => self::INSTANCE_ID,
			'configuration' => self::get_browser_configuration(),
		);

		return $extensions;
	}

	/**
	 * Enqueue the compiler-owned adapter and append its stable dependency handle.
	 *
	 * @param array<int,string>  $dependencies  Timeline entry-point dependencies.
	 * @param array<string,mixed> $configuration Timeline executable-free configuration.
	 *
	 * @return array<int,string> Filtered dependency handles.
	 */
	public static function filter_script_dependencies( $dependencies, $configuration ) {
		$dependencies = is_array( $dependencies ) ? $dependencies : array();
		$module_handle = isset( $configuration['asset_handles']['module_runtime_script'] )
			? sanitize_key( (string) $configuration['asset_handles']['module_runtime_script'] )
			: '';

		if ( self::enqueue_script( $module_handle ) ) {
			$dependencies[] = self::SCRIPT_HANDLE;
		}

		return $dependencies;
	}

	/**
	 * Return source files consumed by the normal project compiler.
	 *
	 * @return array<string,string> Source asset paths keyed by type.
	 */
	public static function get_source_asset_paths() {
		return array(
			'projector_script' => __DIR__ . '/_src/time-rows-projector.js',
			'script'           => __DIR__ . '/_src/time-rows.js',
			'style'            => __DIR__ . '/_src/time-rows.css',
		);
	}

	/**
	 * Return compiler-owned runtime asset paths used by PHP.
	 *
	 * @return array<string,string> Runtime asset paths keyed by type.
	 */
	public static function get_runtime_asset_paths() {
		return array(
			'projector_script' => __DIR__ . '/_out/time-rows-projector.js',
			'script'           => __DIR__ . '/_out/time-rows.js',
			'style'            => __DIR__ . '/_out/time-rows.css',
		);
	}

	/**
	 * Return the domain-owned WordPress template allow list.
	 *
	 * @return array<string,string> Template IDs mapped to fixed absolute files.
	 */
	public static function get_template_files() {
		return array(
			self::TEMPLATE_RESOURCE     => __DIR__ . '/templates/time-rows-resource-wptpl.php',
			self::TEMPLATE_CANVAS       => __DIR__ . '/templates/time-rows-canvas-wptpl.php',
			self::TEMPLATE_AVAILABILITY => __DIR__ . '/templates/time-rows-availability-wptpl.php',
			self::TEMPLATE_STATE        => __DIR__ . '/templates/time-rows-state-wptpl.php',
			self::TEMPLATE_SUMMARY      => __DIR__ . '/templates/time-rows-summary-wptpl.php',
		);
	}

	/**
	 * Return the server-owned visible-time presets for expanded Resource rows.
	 *
	 * Presets reuse the existing custom range preference contract. Keeping their
	 * identifiers and minute boundaries in PHP prevents browser markup from
	 * becoming an authority for persisted values.
	 *
	 * @return array<int,array<string,int|string>> Ordered preset DTOs.
	 */
	public static function get_time_range_presets() {
		return array(
			array(
				'id'           => 'business_day_08_17',
				'start_minute' => 480,
				'end_minute'   => 1020,
				'label'        => __( '08:00–17:00', 'booking' ),
				'aria_label'   => __( 'Show the visible time range from 08:00 to 17:00', 'booking' ),
			),
			array(
				'id'           => 'business_day_09_18',
				'start_minute' => 540,
				'end_minute'   => 1080,
				'label'        => __( '09:00–18:00', 'booking' ),
				'aria_label'   => __( 'Show the visible time range from 09:00 to 18:00', 'booking' ),
			),
			array(
				'id'           => 'business_day_10_19',
				'start_minute' => 600,
				'end_minute'   => 1140,
				'label'        => __( '10:00–19:00', 'booking' ),
				'aria_label'   => __( 'Show the visible time range from 10:00 to 19:00', 'booking' ),
			),
		);
	}

	/**
	 * Return the executable-free browser adapter configuration.
	 *
	 * The only transport saves an explicit preference change. Expanded content
	 * and initial settings still come from accepted native Timeline data, so
	 * opening one or many Resources never initiates a request.
	 *
	 * @return array<string,mixed> Schema, identities, limits, templates, and strings.
	 */
	public static function get_browser_configuration() {
		return array(
			'schema_version'           => self::SCHEMA_VERSION,
			'projection_schema_version' => self::PROJECTION_SCHEMA_VERSION,
			'presentation_id'          => self::PRESENTATION_ID,
			'template_key'             => self::PRESENTATION_TEMPLATE_KEY,
			'initial_open'             => array(
				'first_resource' => self::should_auto_open_first_resource(),
				'animate'        => true,
			),
			'range_presets'            => self::get_time_range_presets(),
			'preferences'              => array(
				'url'    => admin_url( 'admin-ajax.php' ),
				'action' => 'wpbc_timeline_time_rows_save_preferences',
				'nonce'  => wp_create_nonce( 'wpbc_timeline_time_rows_preferences' ),
			),
			'templates'                => array(
				'resource'     => self::TEMPLATE_RESOURCE,
				'canvas'       => self::TEMPLATE_CANVAS,
				'availability' => self::TEMPLATE_AVAILABILITY,
				'state'        => self::TEMPLATE_STATE,
				'summary'      => self::TEMPLATE_SUMMARY,
			),
			'limits'                   => array(
				'maximum_cached_windows' => self::MAXIMUM_CACHED_WINDOWS,
				'maximum_visible_lanes'  => self::MAXIMUM_VISIBLE_LANES,
				'auto_safe_start_minute' => self::AUTO_SAFE_START_MINUTE,
				'auto_safe_end_minute'   => self::AUTO_SAFE_END_MINUTE,
				'time_range_step_minutes' => self::TIME_RANGE_STEP_MINUTES,
				'time_zoom_min_percent'   => self::TIME_ZOOM_MIN_PERCENT,
				'time_zoom_max_percent'   => self::TIME_ZOOM_MAX_PERCENT,
				'time_zoom_step_percent'  => self::TIME_ZOOM_STEP_PERCENT,
				'time_zoom_default_percent' => self::TIME_ZOOM_DEFAULT_PERCENT,
				'time_hour_height_px'     => self::TIME_HOUR_HEIGHT_PX,
				'time_body_min_height_px' => self::TIME_BODY_MIN_HEIGHT_PX,
			),
			'i18n'                     => array(
				'label'                     => __( 'Expanded schedule', 'booking' ),
				'expanded_hours'            => __( 'Expanded hours', 'booking' ),
				'visible_hours'             => __( 'Visible hours', 'booking' ),
				'collapse'                  => __( 'Collapse', 'booking' ),
				'time_range'                => __( 'Time range', 'booking' ),
				'time_range_start'          => __( 'Visible time starts at {time}', 'booking' ),
				'time_range_end'            => __( 'Visible time ends at {time}', 'booking' ),
				'auto_range'                => __( 'Auto', 'booking' ),
				'auto_range_label'          => __( 'Auto: {range}', 'booking' ),
				'use_auto_range'            => __( 'Use the automatically calculated visible time range', 'booking' ),
				'full_day_range'            => __( 'Full day', 'booking' ),
				'use_full_day_range'        => __( 'Show the complete day from 00:00 to 24:00', 'booking' ),
				'time_zoom'                 => __( 'Time zoom', 'booking' ),
				'time_zoom_description'     => __( 'Change the vertical height of visible time slots without loading data.', 'booking' ),
				'time_zoom_value'           => __( '{percent}%', 'booking' ),
				'preferences_save_failed'   => __( 'The expanded schedule settings could not be saved. Reload the page and try again.', 'booking' ),
				'all_day'                   => __( 'All day', 'booking' ),
				'availability_loading'      => __( 'Availability is loading. Bookings are already shown.', 'booking' ),
				'availability_partial'      => __( 'Some Availability information is incomplete.', 'booking' ),
				'availability_failed'       => __( 'Availability could not be loaded. Bookings are still shown.', 'booking' ),
				'refreshing'                 => __( 'Updating the expanded schedule from the authoritative Timeline data.', 'booking' ),
				'schedule_summary'          => __( 'Accessible schedule summary', 'booking' ),
				'no_summary_records'        => __( 'No bookings or Availability records in this range.', 'booking' ),
				'select_booking'            => __( 'Select booking: {label}', 'booking' ),
				'booking_information'       => __( 'Show information for booking: {label}', 'booking' ),
				'booking_details'           => __( 'Open details for booking: {label}', 'booking' ),
				'continued_before'          => __( 'Continues before this visible range', 'booking' ),
				'continued_after'           => __( 'Continues after this visible range', 'booking' ),
				'status_approved'           => __( 'Approved', 'booking' ),
				'status_pending'            => __( 'Pending', 'booking' ),
				'status_unknown'            => __( 'Booking status unavailable', 'booking' ),
				'more_bookings'             => __( '{count} more bookings', 'booking' ),
				'dst_gap'                   => __( 'Daylight-saving time gap', 'booking' ),
				'dst_fold'                  => __( 'Daylight-saving time fold', 'booking' ),
				'dst_transition'            => __( 'Time change', 'booking' ),
				'dst_transition_label'      => __( '{kind}: clocks change from UTC{before} to UTC{after}', 'booking' ),
				'availability_unknown'      => __( 'Availability unknown', 'booking' ),
				'full_day_booking'          => __( 'Full-day booking', 'booking' ),
				'timed_booking'             => __( 'Timed booking', 'booking' ),
				'availability_record'       => __( 'Availability', 'booking' ),
				'availability_state_record' => __( 'Availability state', 'booking' ),
			),
		);
	}

	/**
	 * Determine whether the first Timeline Resource should open after initial paint.
	 *
	 * The selected Booking Mode is owner-aware through the canonical Booking Modes
	 * storage API. Classic and Rental modes remain opt-in only, while Appointment
	 * mode receives the requested first-Resource expanded schedule automatically.
	 * A missing Booking Modes API safely preserves the historical closed state.
	 *
	 * @return bool True only for the currently selected Appointment mode.
	 */
	public static function should_auto_open_first_resource() {
		return function_exists( 'wpbc_booking_modes_get_selected_mode_id' )
			&& 'appointment' === wpbc_booking_modes_get_selected_mode_id();
	}

	/**
	 * Enqueue the compiler-owned browser adapter when available.
	 *
	 * @param string $module_runtime_handle Timeline module-registry handle.
	 *
	 * @return bool True when the runtime script was enqueued.
	 */
	public static function enqueue_script( $module_runtime_handle ) {
		$runtime_assets = self::get_runtime_asset_paths();
		$asset_path     = $runtime_assets['script'];
		$projector_path = $runtime_assets['projector_script'];

		if ( ! $module_runtime_handle || ! is_readable( $projector_path ) || ! is_readable( $asset_path ) ) {
			return false;
		}
		wp_enqueue_script(
			self::PROJECTOR_SCRIPT_HANDLE,
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/time-rows-projector.js',
			array(),
			WP_BK_VERSION_NUM . '.' . filemtime( $projector_path ),
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/time-rows.js',
			array( $module_runtime_handle, 'wp-util', self::PROJECTOR_SCRIPT_HANDLE ),
			WP_BK_VERSION_NUM . '.' . filemtime( $asset_path ),
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);

		return true;
	}

	/**
	 * Enqueue the compiler-owned stylesheet on the Timeline route when available.
	 *
	 * @param string $where_to_load Booking Calendar asset context.
	 *
	 * @return void
	 */
	public static function enqueue_style( $where_to_load ) {
		$runtime_assets = self::get_runtime_asset_paths();
		$asset_path     = $runtime_assets['style'];

		if ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) || ! wpbc_timeline_is_page() || ! is_readable( $asset_path ) ) {
			return;
		}
		wp_enqueue_style(
			self::STYLE_HANDLE,
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/time-rows.css',
			array( 'wpbc-timeline' ),
			WP_BK_VERSION_NUM . '.' . filemtime( $asset_path )
		);
	}

	/**
	 * Print the fixed domain template allow list once on the Timeline page.
	 *
	 * @return void
	 */
	public static function print_templates() {
		static $templates_printed = false;
		$template_root            = realpath( __DIR__ . '/templates' );

		if ( $templates_printed || ! wpbc_timeline_is_page() || false === $template_root ) {
			return;
		}
		$templates_printed = true;
		foreach ( self::get_template_files() as $template_path ) {
			$resolved_path = realpath( $template_path );
			if ( false === $resolved_path || 0 !== strpos( $resolved_path, $template_root . DIRECTORY_SEPARATOR ) || ! is_readable( $resolved_path ) ) {
				continue;
			}
			require $resolved_path;
		}
	}
}
