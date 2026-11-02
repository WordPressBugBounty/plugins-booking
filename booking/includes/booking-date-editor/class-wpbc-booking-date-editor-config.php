<?php
/**
 * Configuration and native asset registration for Booking Date Editor.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Own stable Date Editor identifiers, labels, templates, and asset paths.
 *
 * This boundary keeps presentation and native-calendar adapter assets in the
 * Date Editor domain while Booking Inspector remains only the host. The
 * adapter is activated only by an authorized Booking Inspector host.
 *
 * @since 12.0.0
 */
final class WPBC_Booking_Date_Editor_Config {

	/** Stable browser component identifier. */
	const COMPONENT_ID = 'wpbc_booking_date_editor';

	/** Domain template identifier without the `tmpl-` prefix. */
	const TEMPLATE_ID = 'wpbc-booking-inspector-date-editor';

	/** Domain review template identifier without the template prefix. */
	const REVIEW_TEMPLATE_ID = 'wpbc-booking-inspector-date-editor-review';

	/** Compiled domain stylesheet handle. */
	const STYLE_HANDLE = 'wpbc-booking-date-editor';

	/** Compiled native-calendar adapter handle. */
	const SCRIPT_HANDLE = 'wpbc-booking-date-editor';

	/** Authenticated Date Editor read action. */
	const READ_AJAX_ACTION = 'wpbc_booking_date_editor_read';

	/** Authenticated, non-mutating Date Editor review action. */
	const REVIEW_AJAX_ACTION = 'wpbc_booking_date_editor_review';

	/** Authenticated Date Editor apply action. */
	const APPLY_AJAX_ACTION = 'wpbc_booking_date_editor_apply';

	/**
	 * Return the active Date Editor browser presentation/read contract.
	 *
	 * @return array<string,mixed> JSON-safe presentation configuration.
	 */
	public static function get_browser_configuration() {
		return array(
			'active'       => true,
			'component_id' => self::COMPONENT_ID,
			'template_id'  => self::TEMPLATE_ID,
			'review_template_id' => self::REVIEW_TEMPLATE_ID,
			'read'         => array(
				'action' => self::READ_AJAX_ACTION,
				'nonce'  => wp_create_nonce( self::get_read_nonce_action() ),
			),
			'review'       => array(
				'action' => self::REVIEW_AJAX_ACTION,
				'nonce'  => wp_create_nonce( self::get_review_nonce_action() ),
			),
			'apply'        => array(
				'action' => self::APPLY_AJAX_ACTION,
				'nonce'  => wp_create_nonce( self::get_apply_nonce_action() ),
			),
			'i18n'         => array(
				'change_dates_title'        => __( 'Change booking dates', 'booking' ),
				'close_date_editor'         => __( 'Close date editor', 'booking' ),
				'date_editor_guidance'      => __( 'Choose dates and times, then review the proposal before applying it.', 'booking' ),
				'selection_method'          => __( 'Selection method', 'booking' ),
				'use_current_booking_rules' => __( 'Use current booking rules', 'booking' ),
				'select_dates_individually' => __( 'Select dates individually', 'booking' ),
				'individual_selection_help' => __( 'Only date-range length and start-day rules are overridden. Availability, capacity, seasons, changeover, Appointment, time-order, and booking-conflict rules are still checked before saving.', 'booking' ),
				'select_dates'              => __( 'Select dates', 'booking' ),
				'apply_times_as'            => __( 'Apply times as', 'booking' ),
				'full_days'                 => __( 'Full days', 'booking' ),
				'full_day'                  => __( 'Full day', 'booking' ),
				'boundary_times'            => __( 'Start on the first date and end on the last date', 'booking' ),
				'same_time_each_date'       => __( 'Use the same time slot on every selected date', 'booking' ),
				'same_interval_each_date'   => __( 'Same interval on every selected date', 'booking' ),
				'start_time'                => __( 'Start time', 'booking' ),
				'end_time'                  => __( 'End time', 'booking' ),
				/* translators: %s: exact booking start time. */
				'starts_at_time'            => __( 'Starts at %s', 'booking' ),
				/* translators: %s: exact booking end time. */
				'ends_at_time'              => __( 'Ends at %s', 'booking' ),
				/* translators: 1: exact booking start time, 2: exact booking end time. */
				'time_interval'             => __( '%1$s – %2$s', 'booking' ),
				'selected_dates'            => __( 'Selected dates', 'booking' ),
				'calendar_days'             => __( 'Calendar days', 'booking' ),
				'nights'                    => __( 'Nights', 'booking' ),
				'time'                      => __( 'Time', 'booking' ),
				'no_selected_dates'         => __( 'No dates are selected.', 'booking' ),
				'reset_days_selection'      => __( 'Reset Days Selection', 'booking' ),
				'review_changes'            => __( 'Review changes', 'booking' ),
				'review_date_changes'       => __( 'Review date changes', 'booking' ),
				'loading_review'             => __( 'Reviewing booking dates', 'booking' ) . '...',
				'review_error'               => __( 'The proposed booking dates could not be reviewed. Check the selection and try again.', 'booking' ),
				'previous_value'             => __( 'Previous', 'booking' ),
				'proposed_value'             => __( 'Proposed', 'booking' ),
				'changed_value'              => __( 'Changed', 'booking' ),
				'review_warnings'            => __( 'Review notes', 'booking' ),
				'back'                      => __( 'Back', 'booking' ),
				'apply_changes'             => __( 'Apply changes', 'booking' ),
				'applying_changes'           => __( 'Applying booking date changes', 'booking' ) . '...',
				'refreshing_booking'         => __( 'Refreshing booking details', 'booking' ) . '...',
				'retry_readback'             => __( 'Retry refresh', 'booking' ),
				'apply_success'              => __( 'Booking dates updated.', 'booking' ),
				'apply_error'                => __( 'The booking date changes could not be applied. Review the dates and try again.', 'booking' ),
				'readback_error'             => __( 'The booking dates were saved, but the updated booking details could not be loaded. Retry the refresh.', 'booking' ),
				'loading_dates'              => __( 'Loading booking dates', 'booking' ) . '...',
				'loading_calendar'           => __( 'Loading calendar availability', 'booking' ) . '...',
				'calendar_loaded'            => __( 'Booking dates and calendar availability loaded.', 'booking' ),
				'load_error'                 => __( 'The booking dates could not be loaded. Try again.', 'booking' ),
				'calendar_error'             => __( 'The calendar availability could not be loaded. Try again.', 'booking' ),
				'hydration_warning'          => __( 'Some saved dates could not be highlighted automatically. You can still select dates individually.', 'booking' ),
				'unsupported_dates'          => __( 'These saved booking dates must be edited on the Add Booking page.', 'booking' ),
				'edit_in_add_booking'        => __( 'Edit in Add Booking', 'booking' ),
				'retry'                      => __( 'Retry', 'booking' ),
				'discard_changes'            => __( 'Discard unsaved date and time changes?', 'booking' ),
			),
		);
	}

	/**
	 * Return the site-bound action used to sign Date Editor read requests.
	 *
	 * @return string Stable nonce action for the current site.
	 */
	public static function get_read_nonce_action() {
		$site_id = function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0;

		return 'wpbc_booking_date_editor_read_' . $site_id;
	}

	/**
	 * Return the site-bound action used to sign Date Editor review requests.
	 *
	 * @return string Stable review nonce action for the current site.
	 */
	public static function get_review_nonce_action() {
		$site_id = function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0;

		return 'wpbc_booking_date_editor_review_' . $site_id;
	}

	/**
	 * Return the site-bound action used to authorize Date Editor persistence.
	 *
	 * @return string Stable apply nonce action for the current site.
	 */
	public static function get_apply_nonce_action() {
		$site_id = function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0;

		return 'wpbc_booking_date_editor_apply_' . $site_id;
	}

	/**
	 * Return the fixed allow-listed Date Editor template files.
	 *
	 * @return array<string,string> Stable template ID to absolute path map.
	 */
	public static function get_template_files() {
		return array(
			self::TEMPLATE_ID        => __DIR__ . '/templates/booking-date-editor-wptpl.php',
			self::REVIEW_TEMPLATE_ID => __DIR__ . '/templates/booking-date-editor-review-wptpl.php',
		);
	}

	/**
	 * Print the fixed allow-listed Date Editor templates once.
	 *
	 * @return void
	 */
	public static function print_template() {
		static $template_printed = false;

		if ( $template_printed ) {
			return;
		}

		$template_root = realpath( __DIR__ . '/templates' );
		if ( false === $template_root ) {
			return;
		}

		$template_printed = true;
		foreach ( self::get_template_files() as $template_path ) {
			$template_path = realpath( $template_path );
			if ( false === $template_path || 0 !== strpos( $template_path, $template_root . DIRECTORY_SEPARATOR ) || ! is_readable( $template_path ) ) {
				continue;
			}

			require $template_path;
		}
	}

	/**
	 * Enqueue native calendar presentation assets and the compiled editor CSS.
	 *
	 * The canonical helpers are intentionally reused so calendar, skin, and
	 * client presentation remain identical to the front end and Add Booking.
	 * The normal asset compiler owns creation of the module's `_out` file.
	 *
	 * @return void
	 */
	public static function enqueue_style() {
		$asset_path = __DIR__ . '/_out/booking-date-editor.css';

		if ( function_exists( 'wpbc_enqueue_styles__front_end' ) ) {
			wpbc_enqueue_styles__front_end();
		}
		if ( function_exists( 'wpbc_enqueue_styles__calendar' ) ) {
			wpbc_enqueue_styles__calendar();
		}

		wp_enqueue_style(
			self::STYLE_HANDLE,
			WPBC_PLUGIN_URL . '/includes/booking-date-editor/_out/booking-date-editor.css',
			array( WPBC_Booking_Inspector_Config::STYLE_HANDLE, 'wpbc-calendar', 'wpbc-all-client' ),
			self::get_asset_version( $asset_path )
		);
	}

	/**
	 * Enqueue the native calendar runtime and compiled Date Editor adapter.
	 *
	 * `wpbc_all` owns the calendar core and standard calendar AJAX loader.
	 * `wpbc-datepick` owns the datepicker widget. The locale handle is optional
	 * because English uses the datepicker default. `wpbc-main-client` is not
	 * normally registered on Timeline or Booking Listing, so this boundary
	 * registers the canonical existing file when required. Business editions
	 * register `wpbc-bs`; declaring it as an optional dependency guarantees that
	 * the native range resolver is ready before this adapter can activate.
	 *
	 * @return void
	 */
	public static function enqueue_script() {
		$asset_path          = __DIR__ . '/_out/booking-date-editor.js';
		$script_dependencies = array(
			'jquery',
			'wp-util',
			'wpbc-main-client',
			WPBC_Booking_Inspector_Config::SCRIPT_HANDLE,
		);

		wp_enqueue_script( 'wpbc_all' );
		wp_enqueue_script( 'wpbc-datepick' );

		if ( ! wp_script_is( 'wpbc-main-client', 'registered' ) ) {
			wp_register_script(
				'wpbc-main-client',
				WPBC_PLUGIN_URL . '/js/client.js',
				array( 'wpbc-datepick' ),
				WP_BK_VERSION_NUM,
				array( 'in_footer' => WPBC_JS_IN_FOOTER )
			);
		}
		wp_enqueue_script( 'wpbc-main-client' );

		if ( wp_script_is( 'wpbc-datepick-localize', 'registered' ) ) {
			wp_enqueue_script( 'wpbc-datepick-localize' );
			$script_dependencies[] = 'wpbc-datepick-localize';
		}

		if ( wp_script_is( 'wpbc-bs', 'registered' ) ) {
			$script_dependencies[] = 'wpbc-bs';
		}

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			WPBC_PLUGIN_URL . '/includes/booking-date-editor/_out/booking-date-editor.js',
			$script_dependencies,
			self::get_asset_version( $asset_path ),
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}

	/**
	 * Build a cache-safe version for a compiler-owned asset.
	 *
	 * A version fallback is required while a source checkout is waiting for the
	 * normal asset compiler. PHP still references only the `_out` runtime path.
	 *
	 * @param string $asset_path Absolute compiler-owned asset path.
	 *
	 * @return string Plugin version with a file modification suffix when present.
	 */
	private static function get_asset_version( $asset_path ) {
		$asset_modified = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;

		return false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;
	}
}
