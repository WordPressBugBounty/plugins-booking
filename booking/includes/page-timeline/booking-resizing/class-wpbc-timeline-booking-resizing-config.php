<?php
/**
 * Timeline booking-resizing configuration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Own stable identifiers, assets, templates, and browser configuration.
 */
final class WPBC_Timeline_Booking_Resizing_Config {

	/** Authenticated, non-mutating resize-context read action. */
	const READ_AJAX_ACTION = 'wpbc_timeline_booking_resizing_read';

	/** Data-only response schema version. */
	const SCHEMA_VERSION = 1;

	/** Compiler-owned browser adapter handle. */
	const SCRIPT_HANDLE = 'wpbc-timeline-booking-resizing';

	/** Compiler-owned presentation stylesheet handle. */
	const STYLE_HANDLE = 'wpbc-timeline-booking-resizing';

	/** Allow-listed loading-marker template identifier. */
	const TEMPLATE_LOADING = 'wpbc-timeline-booking-resizing-loading';

	/** Allow-listed eligible-handle template identifier. */
	const TEMPLATE_HANDLES = 'wpbc-timeline-booking-resizing-handles';

	/** Allow-listed dashed-ghost template identifier. */
	const TEMPLATE_GHOST = 'wpbc-timeline-booking-resizing-ghost';

	/** Allow-listed compact-review template identifier. */
	const TEMPLATE_REVIEW = 'wpbc-timeline-booking-resizing-review';

	/** Allow-listed live-region template identifier. */
	const TEMPLATE_LIVE_REGION = 'wpbc-timeline-booking-resizing-live-region';

	/**
	 * Return the active-site-bound read nonce action.
	 *
	 * @return string Stable nonce action for the current site.
	 */
	public static function get_read_nonce_action() {
		$site_id = function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0;

		return 'wpbc_timeline_booking_resizing_read_' . $site_id;
	}

	/**
	 * Build the bounded transport contract for the Timeline adapter.
	 *
	 * @return array<string,string> AJAX action and site-bound nonce.
	 */
	public static function get_read_transport() {
		return array(
			'url'    => admin_url( 'admin-ajax.php' ),
			'action' => self::READ_AJAX_ACTION,
			'nonce'  => wp_create_nonce( self::get_read_nonce_action() ),
			'source' => 'timeline',
		);
	}

	/**
	 * Build the canonical non-mutating Review transport contract.
	 *
	 * The signed plan and token remain private controller memory until the
	 * separate Apply transport submits that exact reviewed authorization.
	 *
	 * @return array<string,mixed> Review action, nonce, source, and proposal schema.
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
		);
	}

	/**
	 * Build the canonical state-changing Apply transport contract.
	 *
	 * Apply accepts only the signed plan and token returned by Review. The
	 * browser cannot submit or reconstruct replacement booking data here.
	 *
	 * @return array<string,string> Apply action, nonce, and fixed Timeline source.
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
	 * Return fixed domain template identifiers for the browser adapter.
	 *
	 * @return array<string,string> Stable semantic template identifiers.
	 */
	public static function get_template_ids() {
		return array(
			'loading'     => self::TEMPLATE_LOADING,
			'handles'     => self::TEMPLATE_HANDLES,
			'ghost'       => self::TEMPLATE_GHOST,
			'review'      => self::TEMPLATE_REVIEW,
			'live_region' => self::TEMPLATE_LIVE_REGION,
		);
	}

	/**
	 * Return the server-owned template allow list.
	 *
	 * Request values never participate in template selection or filesystem
	 * resolution. The returned files are verified again before inclusion.
	 *
	 * @return array<string,string> Template identifier to absolute path map.
	 */
	public static function get_template_files() {
		$template_root = __DIR__ . '/templates';

		return array(
			self::TEMPLATE_LOADING     => $template_root . '/loading-markers-wptpl.php',
			self::TEMPLATE_HANDLES     => $template_root . '/resize-handles-wptpl.php',
			self::TEMPLATE_GHOST       => $template_root . '/resize-ghost-wptpl.php',
			self::TEMPLATE_REVIEW      => $template_root . '/resize-review-wptpl.php',
			self::TEMPLATE_LIVE_REGION => $template_root . '/resize-live-region-wptpl.php',
		);
	}

	/**
	 * Build the authorized, data-only browser configuration.
	 *
	 * @return array<string,mixed> Transport, template, and localized-text DTO.
	 */
	public static function get_browser_configuration() {
		return array(
			'schema_version'   => self::SCHEMA_VERSION,
			'transport'        => self::get_read_transport(),
			'review_transport' => self::get_review_transport(),
			'apply_transport'  => self::get_apply_transport(),
			'templates'        => self::get_template_ids(),
			'pointer'          => self::get_pointer_configuration(),
			'i18n'             => array(
				'checking'        => __( 'Checking whether this booking can be resized.', 'booking' ),
				'ready'           => __( 'Booking resize handles are ready.', 'booking' ),
				'partially_ready' => __( 'Available booking resize handles are ready. A boundary marked with an X cannot be resized directly.', 'booking' ),
				'denied'          => __( 'Use the full Reschedule dialog to change this booking.', 'booking' ),
				'error'           => __( 'Booking resize availability could not be checked. Use the full Reschedule dialog.', 'booking' ),
				'denial_reasons'  => array(
					'appointment_booking' => __( 'Appointment bookings cannot be resized directly. Use the full Reschedule dialog.', 'booking' ),
					'capacity_booking'    => __( 'This booking uses a capacity allocation that can span multiple child Booking Resources. Timeline resizing cannot safely preserve that allocation. Use the full Reschedule dialog.', 'booking' ),
					'ambiguous_schedule'  => __( 'The saved booking schedule cannot be resized directly. Use the full Reschedule dialog.', 'booking' ),
					'boundaries_clipped'  => __( 'This Timeline segment does not show a resizable booking boundary. Scroll to the booking boundary or use the full Reschedule dialog.', 'booking' ),
					'boundary_clipped'    => __( 'One booking boundary is outside this Timeline segment. Scroll to that boundary or use the full Reschedule dialog.', 'booking' ),
				),
				'group_label'     => __( 'Booking resize boundaries', 'booking' ),
				'resize_start'    => __( 'Resize booking start. Press Enter or Space to open the full Reschedule dialog.', 'booking' ),
				'resize_end'      => __( 'Resize booking end. Press Enter or Space to open the full Reschedule dialog.', 'booking' ),
				'cancelled'       => __( 'Booking resize preview cancelled.', 'booking' ),
				'review_pending'  => __( 'Checking the proposed booking dates and times.', 'booking' ),
				'review_ready'    => __( 'The resized booking is ready for review.', 'booking' ),
				'review_error'    => __( 'The proposed booking dates and times could not be reviewed.', 'booking' ),
				'review_stale'    => __( 'The booking changed. Resize availability is being refreshed.', 'booking' ),
				'full_dialog'     => __( 'Open full Reschedule dialog', 'booking' ),
				'applying'         => __( 'Applying the reviewed booking schedule.', 'booking' ),
				'applied'          => __( 'The booking schedule was updated.', 'booking' ),
				'apply_error'      => __( 'The reviewed booking schedule could not be applied.', 'booking' ),
				'refreshing'       => __( 'Refreshing the Timeline with the saved booking schedule.', 'booking' ),
				'refresh_error'    => __( 'The booking was saved, but the Timeline could not be refreshed. Retry the refresh without applying the change again.', 'booking' ),
				'retry_refresh'    => __( 'Retry refresh', 'booking' ),
				'close'            => __( 'Close', 'booking' ),
				// JavaScript selects these templates; context keeps them separate from the canonical PHP plural pairs.
				/* translators: %s: duration value. */
				'duration_day'     => _x( '%s day', 'Timeline duration', 'booking' ),
				/* translators: %s: duration value. */
				'duration_days'    => _x( '%s days', 'Timeline duration', 'booking' ),
				/* translators: %s: duration value. */
				'duration_hour'    => _x( '%s hour', 'Timeline duration', 'booking' ),
				/* translators: %s: duration value. */
				'duration_hours'   => _x( '%s hours', 'Timeline duration', 'booking' ),
				/* translators: %s: duration value. */
				'duration_minute'  => _x( '%s minute', 'Timeline duration', 'booking' ),
				/* translators: %s: duration value. */
				'duration_minutes' => _x( '%s minutes', 'Timeline duration', 'booking' ),
				'review_title'    => __( 'Review resized booking', 'booking' ),
				'cancel'          => __( 'Cancel', 'booking' ),
				'apply'           => __( 'Apply', 'booking' ),
			),
		);
	}

	/**
	 * Build the pointer-projection configuration.
	 *
	 * Pointer movement always uses a continuous minute-level projection so the
	 * local dashed preview follows the gesture smoothly. By default, release
	 * performs one final cell-step projection that preserves the immutable
	 * boundary's wall-clock precision while moving it by the active Timeline
	 * scale. The filter provides a bounded compatibility rollback for timed
	 * release projection without disabling server authorization. Full-day
	 * releases always retain complete-day boundaries.
	 *
	 * @return array<string,bool> Sanitized pointer behavior configuration.
	 */
	private static function get_pointer_configuration() {
		$pointer_configuration = array(
			'snap_to_timeline_step' => true,
		);

		/**
		 * Filters Timeline booking-resize pointer presentation behavior.
		 *
		 * Returning `false` for `snap_to_timeline_step` retains the minute-level
		 * timed boundary when the pointer is released. Drag-time presentation is
		 * continuous regardless of this value. Full-day releases, authorization,
		 * and canonical Review validation remain unchanged.
		 *
		 * @since 12.0.0
		 *
		 * @param array<string,bool> $pointer_configuration Pointer behavior values.
		 */
		$pointer_configuration = apply_filters( 'wpbc_timeline_booking_resizing_pointer_configuration', $pointer_configuration );
		if ( ! is_array( $pointer_configuration ) ) {
			$pointer_configuration = array();
		}

		return array(
			'snap_to_timeline_step' => ! isset( $pointer_configuration['snap_to_timeline_step'] ) || false !== $pointer_configuration['snap_to_timeline_step'],
		);
	}

	/**
	 * Report whether the compiler-owned browser adapter exists.
	 *
	 * This fail-closed check keeps Timeline usable before the normal compiler has
	 * generated `_out` and prevents PHP from enqueueing an absent dependency.
	 *
	 * @return bool True when the generated runtime file is readable.
	 */
	public static function has_runtime_script() {
		return is_readable( __DIR__ . '/_out/booking-resizing.js' );
	}

	/**
	 * Enqueue the compiler-owned presentation stylesheet.
	 *
	 * @param string $timeline_style_handle Timeline stylesheet dependency handle.
	 *
	 * @return void
	 */
	public static function enqueue_style( $timeline_style_handle ) {
		$asset_path = __DIR__ . '/_out/booking-resizing.css';
		if ( ! is_readable( $asset_path ) ) {
			return;
		}

		wp_enqueue_style(
			self::STYLE_HANDLE,
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/booking-resizing.css',
			array( sanitize_key( $timeline_style_handle ) ),
			self::get_asset_version( $asset_path )
		);
	}

	/**
	 * Enqueue the compiler-owned adapter after the Timeline module registry.
	 *
	 * @param string $timeline_module_handle Timeline module-registry handle.
	 *
	 * @return void
	 */
	public static function enqueue_script( $timeline_module_handle ) {
		$asset_path = __DIR__ . '/_out/booking-resizing.js';
		if ( ! is_readable( $asset_path ) ) {
			return;
		}

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/booking-resizing.js',
			array( 'jquery', 'wp-util', sanitize_key( $timeline_module_handle ) ),
			self::get_asset_version( $asset_path ),
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}

	/**
	 * Print every fixed domain template once on the Timeline page.
	 *
	 * @return void
	 */
	public static function print_templates() {
		static $templates_printed = false;
		$template_root            = realpath( __DIR__ . '/templates' );

		if ( $templates_printed || false === $template_root ) {
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
