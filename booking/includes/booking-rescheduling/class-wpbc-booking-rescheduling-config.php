<?php
/**
 * Booking Rescheduling configuration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Own stable endpoint, nonce, and template identifiers for rescheduling.
 */
final class WPBC_Booking_Rescheduling_Config {

	/** Stable accessible-dialog component identifier. */
	const COMPONENT_ID = 'wpbc_booking_rescheduling';

	/** Authenticated non-mutating dialog read action. */
	const READ_AJAX_ACTION = 'wpbc_booking_rescheduling_read';

	/** Authenticated non-mutating review action. */
	const REVIEW_AJAX_ACTION = 'wpbc_booking_rescheduling_review';

	/** Authenticated apply action. */
	const APPLY_AJAX_ACTION = 'wpbc_booking_rescheduling_apply';

	/** Accessible dialog template identifier without the WordPress prefix. */
	const DIALOG_TEMPLATE_ID = 'wpbc-booking-rescheduling-dialog';

	/** Review template identifier without the WordPress `tmpl-` prefix. */
	const REVIEW_TEMPLATE_ID = 'wpbc-booking-rescheduling-review';

	/** Compiler-owned dialog stylesheet handle. */
	const STYLE_HANDLE = 'wpbc-booking-rescheduling';

	/** Compiler-owned dialog adapter handle. */
	const SCRIPT_HANDLE = 'wpbc-booking-rescheduling';

	/**
	 * Return the site-bound dialog-read nonce action.
	 *
	 * @return string Stable nonce action.
	 */
	public static function get_read_nonce_action() {
		return 'wpbc_booking_rescheduling_read_' . self::get_site_id();
	}

	/**
	 * Return the site-bound review nonce action.
	 *
	 * @return string Stable nonce action.
	 */
	public static function get_review_nonce_action() {
		return 'wpbc_booking_rescheduling_review_' . self::get_site_id();
	}

	/**
	 * Return the site-bound apply nonce action.
	 *
	 * @return string Stable nonce action.
	 */
	public static function get_apply_nonce_action() {
		return 'wpbc_booking_rescheduling_apply_' . self::get_site_id();
	}

	/**
	 * Return the fixed domain template allow list.
	 *
	 * @return array<string,string> Template identifier to absolute path map.
	 */
	public static function get_template_files() {
		return array(
			self::DIALOG_TEMPLATE_ID => __DIR__ . '/templates/booking-rescheduling-dialog-wptpl.php',
			self::REVIEW_TEMPLATE_ID => __DIR__ . '/templates/booking-rescheduling-review-wptpl.php',
		);
	}

	/**
	 * Return the data-only endpoint contract embedded in authorized Inspector DTOs.
	 *
	 * The explicit dialog uses this contract. A fresh
	 * source-context token is issued only by the authorized read service after
	 * canonical booking authorization. Future pointer adapters must use the same
	 * authoritative review and apply services.
	 *
	 * @return array<string,mixed> JSON-safe endpoint configuration.
	 */
	public static function get_browser_configuration() {
		return array(
			'active'         => true,
			'component_id'   => self::COMPONENT_ID,
			'schema_version' => WPBC_Booking_Rescheduling_Proposal_Contract::SCHEMA_VERSION,
			'read'           => array(
				'action' => self::READ_AJAX_ACTION,
				'nonce'  => wp_create_nonce( self::get_read_nonce_action() ),
			),
			'review'         => array(
				'action' => self::REVIEW_AJAX_ACTION,
				'nonce'  => wp_create_nonce( self::get_review_nonce_action() ),
			),
			'apply'          => array(
				'action' => self::APPLY_AJAX_ACTION,
				'nonce'  => wp_create_nonce( self::get_apply_nonce_action() ),
			),
			'templates'      => array(
				'dialog' => self::DIALOG_TEMPLATE_ID,
				'review' => self::REVIEW_TEMPLATE_ID,
			),
			'i18n'           => array(
				'title'                    => __( 'Reschedule booking', 'booking' ),
				'open'                     => __( 'Reschedule', 'booking' ),
				'close'                    => __( 'Close booking rescheduling', 'booking' ),
				'booking_resource'          => __( 'Booking Resource', 'booking' ),
				'resource_help'             => __( 'Availability, capacity, ownership, and compatible allocations are checked again by the server.', 'booking' ),
				'selection_method'          => __( 'Selection method', 'booking' ),
				'use_current_booking_rules' => __( 'Use current booking rules', 'booking' ),
				'select_dates_individually' => __( 'Select dates individually', 'booking' ),
				'select_dates'              => __( 'Select dates', 'booking' ),
				'apply_times_as'            => __( 'Apply times as', 'booking' ),
				'full_days'                 => __( 'Full days', 'booking' ),
				'boundary_times'            => __( 'Start on the first date and end on the last date', 'booking' ),
				'same_time_each_date'       => __( 'Use the same time interval on every selected date', 'booking' ),
				'start_time'                => __( 'Start time', 'booking' ),
				'end_time'                  => __( 'End time', 'booking' ),
				'selected_dates'            => __( 'Selected dates', 'booking' ),
				'no_selected_dates'         => __( 'No dates are selected.', 'booking' ),
				'reset'                     => __( 'Reset proposal', 'booking' ),
				'review_changes'            => __( 'Review changes', 'booking' ),
				'back'                      => __( 'Back', 'booking' ),
				'apply_changes'             => __( 'Apply changes', 'booking' ),
				'loading'                   => __( 'Loading booking rescheduling', 'booking' ) . '...',
				'loading_calendar'          => __( 'Loading calendar availability', 'booking' ) . '...',
				'loading_review'            => __( 'Reviewing booking schedule', 'booking' ) . '...',
				'applying'                  => __( 'Applying booking schedule changes', 'booking' ) . '...',
				'refreshing'                => __( 'Refreshing booking details', 'booking' ) . '...',
				'loaded'                    => __( 'Booking schedule and calendar availability loaded.', 'booking' ),
				'load_error'                => __( 'The booking schedule could not be loaded. Try again.', 'booking' ),
				'calendar_error'            => __( 'The calendar availability could not be loaded. Try again.', 'booking' ),
				'hydration_warning'          => __( 'Some saved dates could not be highlighted automatically. Reset the proposal or use the Add Booking page.', 'booking' ),
				'review_error'              => __( 'The proposed schedule could not be reviewed. Check the Resource, dates, and times, then try again.', 'booking' ),
				'apply_error'               => __( 'The booking schedule changes could not be applied. Review the proposal and try again.', 'booking' ),
				'readback_error'            => __( 'The booking was rescheduled, but the updated booking details could not be loaded. Retry the refresh.', 'booking' ),
				'retry'                     => __( 'Retry', 'booking' ),
				'retry_refresh'             => __( 'Retry refresh', 'booking' ),
				'discard_changes'            => __( 'Discard the unsaved rescheduling proposal?', 'booking' ),
				'timezone_error'             => __( 'The selected time is unavailable or ambiguous in the current site timezone because of daylight-saving time.', 'booking' ),
				'unsupported'                => __( 'This saved booking schedule cannot be rescheduled safely here. Use the Add Booking page.', 'booking' ),
			),
		);
	}

	/**
	 * Enqueue the compiler-owned dialog stylesheet from `_out`.
	 *
	 * Source files remain in `_src`; the normal project compiler creates the
	 * runtime asset. PHP must never enqueue the source file.
	 *
	 * @return void
	 */
	public static function enqueue_style() {
		$asset_path = __DIR__ . '/_out/booking-rescheduling.css';

		wp_enqueue_style(
			self::STYLE_HANDLE,
			WPBC_PLUGIN_URL . '/includes/booking-rescheduling/_out/booking-rescheduling.css',
			array( WPBC_Booking_Date_Editor_Config::STYLE_HANDLE ),
			self::get_asset_version( $asset_path )
		);
	}

	/**
	 * Enqueue the compiler-owned thin dialog adapter from `_out`.
	 *
	 * The Date Editor script is a dependency because it owns the sole native
	 * calendar adapter and active-instance guard reused by this dialog.
	 *
	 * @return void
	 */
	public static function enqueue_script() {
		$asset_path = __DIR__ . '/_out/booking-rescheduling.js';

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			WPBC_PLUGIN_URL . '/includes/booking-rescheduling/_out/booking-rescheduling.js',
			array( 'jquery', 'wp-util', WPBC_Booking_Inspector_Config::SCRIPT_HANDLE, WPBC_Booking_Date_Editor_Config::SCRIPT_HANDLE ),
			self::get_asset_version( $asset_path ),
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}

	/**
	 * Print fixed allow-listed domain templates once.
	 *
	 * @return void
	 */
	public static function print_templates() {
		static $templates_printed = false;
		if ( $templates_printed ) {
			return;
		}

		$template_root = realpath( __DIR__ . '/templates' );
		if ( false === $template_root ) {
			return;
		}

		$templates_printed = true;
		foreach ( self::get_template_files() as $template_path ) {
			$template_path = realpath( $template_path );
			if ( false !== $template_path && 0 === strpos( $template_path, $template_root . DIRECTORY_SEPARATOR ) && is_readable( $template_path ) ) {
				require $template_path;
			}
		}
	}

	/**
	 * Resolve the current site identifier without trusting request data.
	 *
	 * @return int Current site ID.
	 */
	private static function get_site_id() {
		return function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0;
	}

	/**
	 * Build a cache-safe version for a compiler-owned asset.
	 *
	 * @param string $asset_path Absolute `_out` asset path.
	 *
	 * @return string Plugin version with an optional modification suffix.
	 */
	private static function get_asset_version( $asset_path ) {
		$asset_modified = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;

		return false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;
	}
}
