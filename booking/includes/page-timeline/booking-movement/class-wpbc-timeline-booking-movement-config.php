<?php
/**
 * Timeline booking-movement module configuration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Own movement identifiers, hooks, assets, templates, and browser configuration.
 */
final class WPBC_Timeline_Booking_Movement_Config {

	/** Authenticated, non-mutating movement-context read action. */
	const READ_AJAX_ACTION = 'wpbc_timeline_booking_movement_read';

	/** Data-only response schema version. */
	const SCHEMA_VERSION = 2;

	/** Empty Resource-row insertion threshold retained for browser validation. */
	const EMPTY_ROW_INSERT_THRESHOLD_PIXELS = 18;

	/** Existing bundled SortableJS script handle. */
	const SORTABLE_HANDLE = 'wpbc-sortable';

	/** Compiler-owned browser adapter handle. */
	const SCRIPT_HANDLE = 'wpbc-timeline-booking-movement';

	/** Compiler-owned presentation stylesheet handle. */
	const STYLE_HANDLE = 'wpbc-timeline-booking-movement';

	/** Allow-listed explicit drag-grip template identifier. */
	const TEMPLATE_GRIP = 'wpbc-timeline-booking-movement-grip';

	/** Allow-listed drag-ghost template identifier. */
	const TEMPLATE_GHOST = 'wpbc-timeline-booking-movement-ghost';

	/** Allow-listed review template identifier. */
	const TEMPLATE_REVIEW = 'wpbc-timeline-booking-movement-review';

	/** Allow-listed live-region template identifier. */
	const TEMPLATE_LIVE_REGION = 'wpbc-timeline-booking-movement-live-region';

	/** Allow-listed canonical-card loading template identifier. */
	const TEMPLATE_LOADING = 'wpbc-timeline-booking-movement-loading';

	/**
	 * Register all movement-owned presentation hooks.
	 *
	 * The authenticated AJAX hook is registered by the module-owned endpoint
	 * include. No hook is reached when the module load filter returns false.
	 *
	 * @return void
	 */
	public static function register_hooks() {
		add_action( 'wpbc_enqueue_css_files', array( __CLASS__, 'enqueue_styles' ), 75, 1 );
		add_action( 'wpbc_enqueue_js_files', array( __CLASS__, 'enqueue_scripts' ), 65, 1 );
		add_action( 'admin_footer', array( __CLASS__, 'print_templates' ), 45 );
	}

	/**
	 * Return the active-site-bound read nonce action.
	 *
	 * @return string Stable nonce action for the current site.
	 */
	public static function get_read_nonce_action() {
		$site_id = function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0;

		return 'wpbc_timeline_booking_movement_read_' . $site_id;
	}

	/**
	 * Build the canonical non-mutating rescheduling Review transport.
	 *
	 * @return array<string,mixed> Review action, nonce, source, and schema.
	 */
	public static function get_review_transport() {
		if ( ! class_exists( 'WPBC_Booking_Rescheduling_Config' ) || ! class_exists( 'WPBC_Booking_Rescheduling_Proposal_Contract' ) ) {
			return array();
		}

		return array(
			'url'            => admin_url( 'admin-ajax.php' ),
			'action'         => WPBC_Booking_Rescheduling_Config::REVIEW_AJAX_ACTION,
			'nonce'          => wp_create_nonce( WPBC_Booking_Rescheduling_Config::get_review_nonce_action() ),
			'source'         => 'timeline',
			'schema_version' => WPBC_Booking_Rescheduling_Proposal_Contract::SCHEMA_VERSION,
			'template_id'    => WPBC_Booking_Rescheduling_Config::REVIEW_TEMPLATE_ID,
		);
	}

	/**
	 * Build the canonical state-changing rescheduling Apply transport.
	 *
	 * Apply accepts only the signed plan and token returned by Review. This
	 * module never constructs replacement booking rows in the browser.
	 *
	 * @return array<string,string> Apply action, nonce, and fixed source.
	 */
	public static function get_apply_transport() {
		if ( ! class_exists( 'WPBC_Booking_Rescheduling_Config' ) ) {
			return array();
		}

		return array(
			'url'    => admin_url( 'admin-ajax.php' ),
			'action' => WPBC_Booking_Rescheduling_Config::APPLY_AJAX_ACTION,
			'nonce'  => wp_create_nonce( WPBC_Booking_Rescheduling_Config::get_apply_nonce_action() ),
			'source' => 'timeline',
		);
	}

	/**
	 * Return fixed domain template identifiers.
	 *
	 * @return array<string,string> Stable semantic template identifiers.
	 */
	public static function get_template_ids() {
		return array(
			'grip'        => self::TEMPLATE_GRIP,
			'ghost'       => self::TEMPLATE_GHOST,
			'review'      => self::TEMPLATE_REVIEW,
			'live_region' => self::TEMPLATE_LIVE_REGION,
			'loading'     => self::TEMPLATE_LOADING,
		);
	}

	/**
	 * Return the fixed server-owned template allow list.
	 *
	 * @return array<string,string> Template identifier to absolute path map.
	 */
	public static function get_template_files() {
		$template_root = __DIR__ . '/templates';

		return array(
			self::TEMPLATE_GRIP        => $template_root . '/movement-grip-wptpl.php',
			self::TEMPLATE_GHOST       => $template_root . '/movement-ghost-wptpl.php',
			self::TEMPLATE_REVIEW      => $template_root . '/movement-review-wptpl.php',
			self::TEMPLATE_LIVE_REGION => $template_root . '/movement-live-region-wptpl.php',
			self::TEMPLATE_LOADING     => $template_root . '/movement-loading-wptpl.php',
		);
	}

	/**
	 * Report whether the bundled SortableJS dependency is readable.
	 *
	 * @return bool True when the approved local dependency exists.
	 */
	public static function has_sortable_asset() {
		return is_readable( dirname( __DIR__, 3 ) . '/vendors/sortablejs/Sortable.min.js' );
	}

	/**
	 * Report whether the compiler-owned movement script is readable.
	 *
	 * @return bool True when the generated JavaScript exists.
	 */
	public static function has_runtime_script() {
		return is_readable( __DIR__ . '/_out/booking-movement.js' );
	}

	/**
	 * Report whether the compiler-owned movement stylesheet is readable.
	 *
	 * @return bool True when the generated CSS exists.
	 */
	public static function has_runtime_style() {
		return is_readable( __DIR__ . '/_out/booking-movement.css' );
	}

	/**
	 * Report whether every browser runtime dependency is available.
	 *
	 * @return bool True when movement may be exposed to the browser.
	 */
	public static function has_browser_runtime() {
		return self::has_sortable_asset() && self::has_runtime_script() && self::has_runtime_style();
	}

	/**
	 * Build the authorized, data-only browser configuration.
	 *
	 * @return array<string,mixed> Transport, templates, and localized text.
	 */
	public static function get_browser_configuration() {
		return array(
			'schema_version'   => self::SCHEMA_VERSION,
			'transport'        => array(
				'url'    => admin_url( 'admin-ajax.php' ),
				'action' => self::READ_AJAX_ACTION,
				'nonce'  => wp_create_nonce( self::get_read_nonce_action() ),
				'source' => 'timeline',
			),
			'review_transport' => self::get_review_transport(),
			'apply_transport'  => self::get_apply_transport(),
			'templates'        => self::get_template_ids(),
			'sortable'         => array(
				'direction'                  => 'horizontal',
				'fallback_tolerance'          => 8,
				'empty_insert_threshold'      => self::EMPTY_ROW_INSERT_THRESHOLD_PIXELS,
				'candidate_dwell_milliseconds' => 90,
				'deliberate_movement_pixels'  => 6,
				'autoscroll_edge_pixels'      => 48,
				'autoscroll_max_pixels'       => 18,
			),
			'i18n'             => array(
				'grip_label'       => __( 'Move booking', 'booking' ),
				'unavailable'      => __( 'Booking movement is unavailable. Use the full Reschedule dialog.', 'booking' ),
				'destination_unavailable' => __( 'This booking cannot be moved to another Booking Resource from the Timeline. Use the booking actions to change its Resource.', 'booking' ),
				'denial_reasons'   => array(
					'appointment_resource_change' => __( 'Appointment bookings can be moved only within their current Provider on the Timeline. Use the booking actions to change the Provider so Service compatibility and availability can be validated.', 'booking' ),
					'resource_change_unavailable' => __( 'Changing the Booking Resource is unavailable for this account or Booking Calendar edition.', 'booking' ),
					'operation_unsupported'       => __( 'This booking cannot be moved to another Booking Resource from the Timeline. Use the full Reschedule dialog.', 'booking' ),
				),
				'cancelled'        => __( 'Booking movement cancelled.', 'booking' ),
				'candidate_target' => __( 'Candidate Resource: %s. Server review is required.', 'booking' ),
				'review_loading'   => __( 'Reviewing the proposed booking movement.', 'booking' ),
				'review_title'     => __( 'Review booking movement', 'booking' ),
				'previous'         => __( 'Previous', 'booking' ),
				'proposed'         => __( 'Proposed', 'booking' ),
				'cancel'           => __( 'Cancel', 'booking' ),
				'apply'            => __( 'Apply changes', 'booking' ),
				'review_ready'     => __( 'Review the server-authorized movement before applying it.', 'booking' ),
				'applying'         => __( 'Applying booking movement.', 'booking' ),
				'refreshing'       => __( 'Refreshing the booking from canonical saved data.', 'booking' ),
				'applied'          => __( 'Booking movement applied.', 'booking' ),
				'apply_failed'     => __( 'The booking movement could not be applied. Canonical booking data will be reloaded when the persistence result is uncertain.', 'booking' ),
				'refresh_failed'   => __( 'The booking was processed, but canonical data could not be refreshed. Retry refresh to read the saved booking without applying it again.', 'booking' ),
				'retry_refresh'    => __( 'Retry refresh', 'booking' ),
				'review_failed'    => __( 'The booking movement could not be reviewed. Reload the Timeline and try again.', 'booking' ),
			),
		);
	}

	/**
	 * Enqueue the compiler-owned movement stylesheet on the Timeline page.
	 *
	 * @param string $where_to_load Booking Calendar asset context.
	 *
	 * @return void
	 */
	public static function enqueue_styles( $where_to_load ) {
		if ( ! self::should_load_for_request( $where_to_load ) || ! self::has_browser_runtime() ) {
			return;
		}

		$configuration = wpbc_timeline_get_configuration();
		$asset_path    = __DIR__ . '/_out/booking-movement.css';
		wp_enqueue_style(
			self::STYLE_HANDLE,
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/booking-movement.css',
			array(
				$configuration['asset_handles']['style'],
				WPBC_Booking_Rescheduling_Config::STYLE_HANDLE,
			),
			self::get_asset_version( $asset_path )
		);
	}

	/**
	 * Enqueue SortableJS and the compiler-owned movement adapter.
	 *
	 * @param string $where_to_load Booking Calendar asset context.
	 *
	 * @return void
	 */
	public static function enqueue_scripts( $where_to_load ) {
		if ( ! self::should_load_for_request( $where_to_load ) || ! self::has_browser_runtime() ) {
			return;
		}

		$configuration = wpbc_timeline_get_configuration();
		if ( ! wp_script_is( self::SORTABLE_HANDLE, 'registered' ) ) {
			wp_register_script(
				self::SORTABLE_HANDLE,
				wpbc_plugin_url( '/vendors/sortablejs/Sortable.min.js' ),
				array(),
				WP_BK_VERSION_NUM,
				array( 'in_footer' => WPBC_JS_IN_FOOTER )
			);
		}
		wp_enqueue_script( self::SORTABLE_HANDLE );

		$asset_path = __DIR__ . '/_out/booking-movement.js';
		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/booking-movement.js',
			array(
				'jquery',
				'wp-util',
				'wpbc-admin-support',
				self::SORTABLE_HANDLE,
				$configuration['asset_handles']['module_runtime_script'],
				$configuration['asset_handles']['booking_interactions_script'],
			),
			self::get_asset_version( $asset_path ),
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
		wp_localize_script( self::SCRIPT_HANDLE, 'wpbc_timeline_booking_movement_config', self::get_browser_configuration() );
	}

	/**
	 * Print the fixed movement templates once when the browser runtime exists.
	 *
	 * @return void
	 */
	public static function print_templates() {
		static $templates_printed = false;

		if ( $templates_printed || ! wpbc_timeline_is_page() || ! self::has_browser_runtime() ) {
			return;
		}
		$template_root = realpath( __DIR__ . '/templates' );
		if ( false === $template_root ) {
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
	 * Decide whether movement assets belong to the current request.
	 *
	 * @param string $where_to_load Booking Calendar asset context.
	 *
	 * @return bool True only for the isolated administration Timeline.
	 */
	private static function should_load_for_request( $where_to_load ) {
		return in_array( $where_to_load, array( 'admin', 'both' ), true ) && wpbc_timeline_is_page();
	}

	/**
	 * Build a cache-safe version for one compiler-owned asset.
	 *
	 * @param string $asset_path Absolute runtime asset path.
	 *
	 * @return string Plugin version extended by the asset modification time.
	 */
	private static function get_asset_version( $asset_path ) {
		$asset_modified = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;

		return false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;
	}
}
