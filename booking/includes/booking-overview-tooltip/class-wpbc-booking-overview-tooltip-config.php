<?php
/**
 * Booking Overview Context Popover configuration and template registration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Own the Booking Overview popover's executable-free browser configuration.
 */
final class WPBC_Booking_Overview_Tooltip_Config {

	/** Authenticated lazy-details action. */
	const AJAX_ACTION = 'wpbc_booking_overview_tooltip_read';

	/** Site-bound nonce action prefix. */
	const NONCE_ACTION = 'wpbc_booking_overview_tooltip_read';

	/** Only the new Timeline may request this first lazy-details integration. */
	const SOURCE_TIMELINE = 'timeline';

	/** Stable component identifier. */
	const COMPONENT_ID = 'wpbc_booking_overview_tooltip';

	/** Domain WordPress template identifier without the `tmpl-` prefix. */
	const TEMPLATE_ID = 'wpbc-booking-overview-tooltip';

	/** Booking header template identifier without `tmpl-`. */
	const HEADER_TEMPLATE_ID = 'wpbc-booking-overview-header';

	/** Complete Booking Overview template identifier without `tmpl-`. */
	const DETAILS_TEMPLATE_ID = 'wpbc-booking-overview-context-popover';

	/** Booking summary partial template identifier without `tmpl-`. */
	const SUMMARY_TEMPLATE_ID = 'wpbc-booking-overview-summary';

	/** Booking details loading partial template identifier without `tmpl-`. */
	const LOADING_TEMPLATE_ID = 'wpbc-booking-overview-loading';

	/** Booking details error partial template identifier without `tmpl-`. */
	const ERROR_TEMPLATE_ID = 'wpbc-booking-overview-error';

	/** Compiler-owned stylesheet handle. */
	const STYLE_HANDLE = 'wpbc-booking-overview-tooltip';

	/** Compiler-owned browser adapter handle. */
	const SCRIPT_HANDLE = 'wpbc-booking-overview-tooltip';

	/** Layer above Timeline booking cards and below its sticky date header. */
	const TIMELINE_LAYER_Z_INDEX = 20;

	/**
	 * Return the bounded browser interaction configuration.
	 *
	 * @return array<string,mixed> JSON-safe popover configuration.
	 */
	public static function get_browser_configuration() {
		return array(
			'active'                  => true,
			'component_id'            => self::COMPONENT_ID,
			'template_id'             => self::TEMPLATE_ID,
			'header_template_id'      => self::HEADER_TEMPLATE_ID,
			'details_template_id'     => self::DETAILS_TEMPLATE_ID,
			'summary_template_id'     => self::SUMMARY_TEMPLATE_ID,
			'loading_template_id'     => self::LOADING_TEMPLATE_ID,
			'error_template_id'       => self::ERROR_TEMPLATE_ID,
			'mode'                    => 'interactive',
			'pin_policy'              => 'manual',
			'fit_on_first_open'        => true,
			'pin_to_viewport'          => true,
			'draggable_when_pinned'    => true,
			'resizable_when_pinned'    => true,
			'external_scroll_policy'  => 'retain',
			'preferred_width'         => 680,
			'maximum_width'           => 700,
			'fixed_unpinned_height'   => 350,
			'maximum_resized_width'   => 1200,
			'layer_z_index'            => self::TIMELINE_LAYER_Z_INDEX,
			'scroll_resume_delay_ms'  => 220,
			'transport'               => array(
				'url'    => admin_url( 'admin-ajax.php' ),
				'action' => self::AJAX_ACTION,
				'nonce'  => wp_create_nonce( self::get_nonce_action() ),
				'source' => self::SOURCE_TIMELINE,
			),
			'i18n'                    => array(
				'title'                  => __( 'Booking overview', 'booking' ),
				'close'                  => __( 'Close booking overview', 'booking' ),
				'pin'                    => __( 'Pin', 'booking' ),
				'pinned'                 => __( 'Pinned', 'booking' ),
				'unpin'                  => __( 'Unpin booking overview', 'booking' ),
				'move'                   => __( 'Move pinned booking overview', 'booking' ),
				'resize'                 => __( 'Resize pinned booking overview', 'booking' ),
				'open_details'           => __( 'Open booking details', 'booking' ),
				'loading'                => __( 'Loading booking data…', 'booking' ),
				'loaded'                 => __( 'Booking data loaded.', 'booking' ),
				'error'                  => __( 'Booking data could not be loaded. Try again.', 'booking' ),
				'retry'                  => __( 'Retry', 'booking' ),
				'resource'               => __( 'Booking resource', 'booking' ),
				'start'                  => __( 'Start', 'booking' ),
				'end'                    => __( 'End', 'booking' ),
				'duration'               => __( 'Duration', 'booking' ),
				'intervals'              => __( 'Date and time intervals', 'booking' ),
				'selected_dates'         => __( 'Selected dates', 'booking' ),
				'booking_data'           => __( 'Booking data', 'booking' ),
				'saved_cost'             => __( 'Saved booking cost', 'booking' ),
				'payment_status'         => __( 'Payment status', 'booking' ),
				'created'                => __( 'Created', 'booking' ),
				'not_available'          => __( 'Not available', 'booking' ),
				'loading_value'          => __( 'Loading…', 'booking' ),
				'empty_fields'           => __( 'No booking form data is available.', 'booking' ),
				'unsupported_financials' => __( 'Saved cost and payment details are not available.', 'booking' ),
				'truncated'              => __( 'Additional booking information is available in Booking details.', 'booking' ),
			),
		);
	}

	/**
	 * Return the current-site nonce action for lazy Booking Overview reads.
	 *
	 * @return string Site-bound nonce action.
	 */
	public static function get_nonce_action() {
		$site_id = function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0;

		return self::NONCE_ACTION . ':' . $site_id;
	}

	/**
	 * Enqueue the compiler-owned Booking Overview stylesheet from `_out`.
	 *
	 * Source is maintained in `_src`; the normal asset compiler creates the
	 * runtime file. Production PHP must never enqueue source assets.
	 *
	 * @return void
	 */
	public static function enqueue_style() {
		$asset_path = __DIR__ . '/_out/booking-overview-tooltip.css';

		WPBC_Shared_UI_Context_Popover::enqueue_style();

		wp_enqueue_style(
			self::STYLE_HANDLE,
			WPBC_PLUGIN_URL . '/includes/booking-overview-tooltip/_out/booking-overview-tooltip.css',
			array( 'wpbc-ui-both', WPBC_Shared_UI_Context_Popover::STYLE_HANDLE ),
			self::get_asset_version( $asset_path )
		);
	}

	/**
	 * Enqueue the compiler-owned Booking Overview adapter from `_out`.
	 *
	 * @return void
	 */
	public static function enqueue_script() {
		$asset_path = __DIR__ . '/_out/booking-overview-tooltip.js';

		WPBC_Shared_UI_Context_Popover::enqueue_script();

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			WPBC_PLUGIN_URL . '/includes/booking-overview-tooltip/_out/booking-overview-tooltip.js',
			array( 'jquery', 'wp-util', WPBC_Shared_UI_Context_Popover::SCRIPT_HANDLE ),
			self::get_asset_version( $asset_path ),
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}

	/**
	 * Print the shared shell and fixed booking-domain content template once.
	 *
	 * The template path is server-owned and cannot be selected by a request or
	 * browser value.
	 *
	 * @return void
	 */
	public static function print_template() {
		static $template_printed = false;

		if ( $template_printed ) {
			return;
		}

		WPBC_Shared_UI_Context_Popover::print_template();

		$template_root = realpath( __DIR__ . '/templates' );
		$template_paths = array(
			realpath( __DIR__ . '/templates/booking-overview-tooltip-wptpl.php' ),
			realpath( __DIR__ . '/templates/booking-overview-header-wptpl.php' ),
			realpath( __DIR__ . '/templates/booking-overview-context-popover-wptpl.php' ),
			realpath( __DIR__ . '/templates/booking-overview-summary-wptpl.php' ),
			realpath( __DIR__ . '/templates/booking-overview-loading-wptpl.php' ),
			realpath( __DIR__ . '/templates/booking-overview-error-wptpl.php' ),
		);
		if (
			false === $template_root
			|| in_array( false, $template_paths, true )
		) {
			return;
		}
		foreach ( $template_paths as $template_path ) {
			if ( 0 !== strpos( $template_path, $template_root . DIRECTORY_SEPARATOR ) || ! is_readable( $template_path ) ) {
				return;
			}
		}

		$template_printed = true;
		foreach ( $template_paths as $template_path ) {
			require $template_path;
		}
	}

	/**
	 * Return an asset version that changes when the generated file changes.
	 *
	 * Missing generated assets retain the plugin version so source development
	 * does not emit filesystem warnings before the normal compiler is run.
	 *
	 * @param string $asset_path Absolute generated asset path.
	 *
	 * @return string Asset version.
	 */
	private static function get_asset_version( $asset_path ) {
		$asset_modified = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;

		return false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;
	}
}
