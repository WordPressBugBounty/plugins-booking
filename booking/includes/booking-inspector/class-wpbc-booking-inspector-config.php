<?php
/**
 * Executable-free configuration and asset registration for Booking Inspector.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Own stable identifiers, limits, templates, assets, and localized labels.
 */
final class WPBC_Booking_Inspector_Config {

	/** Authenticated read action. */
	const AJAX_ACTION = 'wpbc_booking_inspector_read';

	/** Authenticated booking-details update action. */
	const UPDATE_AJAX_ACTION = 'wpbc_booking_inspector_update';

	/** Authenticated paginated activity action. */
	const ACTIVITY_AJAX_ACTION = 'wpbc_booking_inspector_read_activity';

	/** Compatibility action used by the initial Timeline implementation. */
	const LEGACY_AJAX_ACTION = 'wpbc_timeline_read_booking_details';

	/** Nonce action for authenticated reads. */
	const NONCE_ACTION = 'wpbc_booking_inspector_read';

	/** Nonce action for authenticated booking-details updates. */
	const UPDATE_NONCE_ACTION = 'wpbc_booking_inspector_update';

	/** Timeline host identifier. */
	const SOURCE_TIMELINE = 'timeline';

	/** Booking Listing host identifier. */
	const SOURCE_BOOKING_LISTING = 'booking_listing';

	/** Calendar host identifier. */
	const SOURCE_CALENDAR = 'calendar';

	/** Schedule host identifier. */
	const SOURCE_SCHEDULE = 'schedule';

	/** Domain template identifier without the `tmpl-` prefix. */
	const TEMPLATE_ID = 'wpbc-booking-inspector-details';

	/** Compiled host-adapter registry handle. */
	const HOSTS_SCRIPT_HANDLE = 'wpbc-booking-inspector-hosts';

	/** Compiled browser adapter handle. */
	const SCRIPT_HANDLE = 'wpbc-booking-inspector';

	/** Compiled domain stylesheet handle. */
	const STYLE_HANDLE = 'wpbc-booking-inspector';

	/**
	 * Return server-owned scalar configuration.
	 *
	 * @return array<string,mixed> Domain configuration.
	 */
	public static function get_configuration() {
		return array(
			'component_id'    => 'wpbc_booking_inspector',
			'template_id'     => self::TEMPLATE_ID,
			'ajax_action'     => self::AJAX_ACTION,
			'nonce_action'    => self::get_nonce_action(),
			'allowed_sources' => self::get_allowed_sources(),
			'update_action'   => self::UPDATE_AJAX_ACTION,
			'update_nonce_action' => self::get_update_nonce_action(),
			'read_only'       => false,
		);
	}

	/**
	 * Return the fixed host identifiers permitted to request booking details.
	 *
	 * A host identifier records where the Inspector was opened. It never grants
	 * access and cannot replace booking, Resource, owner, or edition checks.
	 *
	 * @return array<int,string> Ordered allow-listed host identifiers.
	 */
	public static function get_allowed_sources() {
		return array(
			self::SOURCE_TIMELINE,
			self::SOURCE_BOOKING_LISTING,
			self::SOURCE_CALENDAR,
			self::SOURCE_SCHEDULE,
		);
	}

	/**
	 * Determine whether a host identifier is explicitly supported.
	 *
	 * @param mixed $source_identifier Candidate host identifier.
	 *
	 * @return bool True when the normalized identifier is allow-listed.
	 */
	public static function is_allowed_source( $source_identifier ) {
		$source_identifier = is_scalar( $source_identifier ) ? sanitize_key( (string) $source_identifier ) : '';

		return in_array( $source_identifier, self::get_allowed_sources(), true );
	}

	/**
	 * Return a nonce action bound to the current WordPress site.
	 *
	 * This prevents an authenticated nonce created for one multisite site from
	 * being treated as the canonical Inspector nonce on another site.
	 *
	 * @return string Site-bound nonce action.
	 */
	public static function get_nonce_action() {
		$site_id = function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0;

		return self::NONCE_ACTION . ':' . $site_id;
	}

	/**
	 * Return a site-bound nonce action for booking-details updates.
	 *
	 * @return string Site-bound update nonce action.
	 */
	public static function get_update_nonce_action() {
		$site_id = function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0;

		return self::UPDATE_NONCE_ACTION . ':' . $site_id;
	}

	/**
	 * Return the browser-facing adapter contract for an authorized host.
	 *
	 * @param string $source_identifier Server-selected allow-listed host identifier.
	 *
	 * @return array<string,mixed> JSON-safe adapter configuration, or an empty array for an invalid host.
	 */
	public static function get_browser_configuration( $source_identifier ) {
		$source_identifier = is_scalar( $source_identifier ) ? sanitize_key( (string) $source_identifier ) : '';
		if ( ! self::is_allowed_source( $source_identifier ) ) {
			return array();
		}

		return array(
			'component_id' => 'wpbc_booking_inspector',
			'templates'    => self::get_browser_template_ids(),
			'transport'    => array(
				'url'    => admin_url( 'admin-ajax.php' ),
				'action' => self::AJAX_ACTION,
				'nonce'  => wp_create_nonce( self::get_nonce_action() ),
				'update_action' => self::UPDATE_AJAX_ACTION,
				'update_nonce'  => wp_create_nonce( self::get_update_nonce_action() ),
				'activity_action' => self::ACTIVITY_AJAX_ACTION,
				'activity_nonce'  => wp_create_nonce( self::get_nonce_action() ),
				'listing_action_nonce' => wp_create_nonce( 'wpbc_ajx_booking_listing_ajx_wpbcnonce' ),
				'listing_action_user_id' => wpbc_get_current_user_id(),
				'listing_action_locale' => get_user_locale(),
				'source' => $source_identifier,
			),
			'i18n'         => array(
				'title'         => __( 'Booking details', 'booking' ),
				'close_label'   => __( 'Close booking details', 'booking' ),
				'loading'       => __( 'Loading booking details', 'booking' ),
				'loaded'        => __( 'Booking details loaded.', 'booking' ),
				'error'         => __( 'Booking details could not be loaded. Try again.', 'booking' ),
				'booking_number' => __( 'Booking ID', 'booking' ),
				'created'       => __( 'Created', 'booking' ),
				'last_updated'  => __( 'Last updated', 'booking' ),
				'booking_details' => __( 'Booking Details', 'booking' ),
				'dates'         => __( 'Dates Overview', 'booking' ),
				'costs'         => __( 'Costs', 'booking' ),
				'activity'      => __( 'Activity', 'booking' ),
				'resource'      => __( 'Booking Resource', 'booking' ),
				'dates_and_costs' => __( 'Dates and costs', 'booking' ),
				'check_in'      => __( 'Start', 'booking' ),
				'check_out'     => __( 'End', 'booking' ),
				'saved_cost'    => __( 'Saved booking cost', 'booking' ),
				'payment_status' => __( 'Payment status', 'booking' ),
				'booking_data'  => __( 'Booking data', 'booking' ),
				'system_information' => __( 'System information', 'booking' ),
				'select_value'  => __( 'Select an option', 'booking' ),
				'edit_in_add_booking' => __( 'Edit in Add Booking', 'booking' ),
				'edit_in_add_booking_title' => __( 'Edit this booking on the Add Booking page', 'booking' ),
				'notes'         => __( 'Notes', 'booking' ),
				'selected_dates' => __( 'Selected dates', 'booking' ),
				'canonical_intervals' => __( 'Date and time intervals', 'booking' ),
				'date_summary'   => __( 'Booking date summary', 'booking' ),
				'no_notes'      => __( 'No notes are stored for this booking.', 'booking' ),
				'no_activity'   => __( 'No structured activity has been recorded for this booking.', 'booking' ),
				'page'          => __( 'Page', 'booking' ),
				'of'            => __( 'of', 'booking' ),
				'previous'      => __( 'Previous', 'booking' ),
				'next'          => __( 'Next', 'booking' ),
				'loading_activity' => __( 'Loading booking activity', 'booking' ),
				'activity_error'   => __( 'Booking activity could not be loaded. Try again.', 'booking' ),
				'not_available' => __( 'Not available', 'booking' ),
				'resource_id'   => __( 'ID', 'booking' ),
				'cancel'        => __( 'Cancel', 'booking' ),
				'save_changes'  => __( 'Save changes', 'booking' ),
				'changed'       => __( 'Changed', 'booking' ),
				'saving_button' => __( 'Saving', 'booking' ) . '...',
				'saving'        => __( 'Saving booking changes', 'booking' ) . '...',
				'saved'         => __( 'Saved successfully.', 'booking' ),
				'save_error'    => __( 'Booking changes could not be saved. Review the fields and try again.', 'booking' ),
				'discard_changes' => __( 'Discard unsaved booking changes?', 'booking' ),
				'finish_edits_before_action' => __( 'Save or cancel your booking changes before using another booking action.', 'booking' ),
				'action_error'   => __( 'The booking action could not be opened. Refresh the page and try again.', 'booking' ),
				'customer'      => __( 'Customer', 'booking' ),
				'duration'      => __( 'Duration', 'booking' ),
				'booking_actions' => __( 'Booking actions', 'booking' ),
				'change_cost'        => __( 'Change cost', 'booking' ),
				'change_dates'       => __( 'Change dates', 'booking' ),
				'change_booking_resource' => __( 'Change resource', 'booking' ),
			),
			'date_editor'   => class_exists( 'WPBC_Booking_Date_Editor_Config' ) ? WPBC_Booking_Date_Editor_Config::get_browser_configuration() : array(),
			'rescheduling'  => class_exists( 'WPBC_Booking_Rescheduling_Config' ) ? WPBC_Booking_Rescheduling_Config::get_browser_configuration() : array(),
			'read_only'     => false,
		);
	}

	/**
	 * Return the fixed browser template registry used by every Inspector host.
	 *
	 * Template IDs are declared by the server so a host cannot select an
	 * arbitrary template or filesystem path.
	 *
	 * @return array<string,string> Stable template role to template ID map.
	 */
	public static function get_browser_template_ids() {
		return array(
			'shell'              => WPBC_Shared_UI_Inspector::get_template_id(),
			'details'            => self::TEMPLATE_ID,
			'header'             => 'wpbc-booking-inspector-header',
			'resource'           => 'wpbc-booking-inspector-resource',
			'tabs'               => 'wpbc-booking-inspector-tabs',
			'booking_fields'     => 'wpbc-booking-inspector-booking-fields',
			'booking_field_row'  => 'wpbc-booking-inspector-booking-field-row',
			'dates'              => 'wpbc-booking-inspector-dates',
			'costs'              => 'wpbc-booking-inspector-costs',
			'notes'              => 'wpbc-booking-inspector-notes',
			'system_information' => 'wpbc-booking-inspector-system-information',
			'activity'           => 'wpbc-booking-inspector-activity',
			'footer'             => 'wpbc-booking-inspector-footer',
			'state'              => 'wpbc-booking-inspector-state',
		);
	}

	/**
	 * Return the allow-listed domain template files in render dependency order.
	 *
	 * @return array<string,string> Stable template ID to absolute path map.
	 */
	public static function get_template_files() {
		$template_directory = __DIR__ . '/templates/';

		return array(
			'wpbc-booking-inspector-header'            => $template_directory . 'booking-inspector-header-wptpl.php',
			'wpbc-booking-inspector-resource'          => $template_directory . 'booking-inspector-resource-wptpl.php',
			'wpbc-booking-inspector-tabs'              => $template_directory . 'booking-inspector-tabs-wptpl.php',
			'wpbc-booking-inspector-booking-field-row' => $template_directory . 'booking-inspector-booking-field-row-wptpl.php',
			'wpbc-booking-inspector-booking-fields'    => $template_directory . 'booking-inspector-booking-fields-wptpl.php',
			'wpbc-booking-inspector-dates'             => $template_directory . 'booking-inspector-dates-wptpl.php',
			'wpbc-booking-inspector-costs'             => $template_directory . 'booking-inspector-costs-wptpl.php',
			'wpbc-booking-inspector-notes'             => $template_directory . 'booking-inspector-notes-wptpl.php',
			'wpbc-booking-inspector-system-information' => $template_directory . 'booking-inspector-system-information-wptpl.php',
			'wpbc-booking-inspector-activity'          => $template_directory . 'booking-inspector-activity-wptpl.php',
			'wpbc-booking-inspector-footer'            => $template_directory . 'booking-inspector-footer-wptpl.php',
			'wpbc-booking-inspector-state'             => $template_directory . 'booking-inspector-state-wptpl.php',
			self::TEMPLATE_ID                           => $template_directory . 'booking-inspector-wptpl.php',
		);
	}

	/**
	 * Enqueue the compiled domain stylesheet.
	 *
	 * @return void
	 */
	public static function enqueue_style() {
		$asset_path     = __DIR__ . '/_out/booking-inspector.css';
		$asset_modified = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;
		$asset_version  = false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;

		wp_enqueue_style(
			self::STYLE_HANDLE,
			WPBC_PLUGIN_URL . '/includes/booking-inspector/_out/booking-inspector.css',
			array( WPBC_Shared_UI_Inspector::STYLE_HANDLE ),
			$asset_version
		);

		if ( class_exists( 'WPBC_Booking_Date_Editor_Config' ) ) {
			WPBC_Booking_Date_Editor_Config::enqueue_style();
		}
		if ( class_exists( 'WPBC_Booking_Rescheduling_Config' ) ) {
			WPBC_Booking_Rescheduling_Config::enqueue_style();
		}
	}

	/**
	 * Enqueue the compiled domain browser adapter.
	 *
	 * @return void
	 */
	public static function enqueue_script() {
		$asset_path     = __DIR__ . '/_out/booking-inspector.js';
		$asset_modified = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;
		$asset_version  = false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			WPBC_PLUGIN_URL . '/includes/booking-inspector/_out/booking-inspector.js',
			array( 'jquery', 'wp-util', WPBC_Shared_UI_Inspector::SCRIPT_HANDLE ),
			$asset_version,
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);

		if ( class_exists( 'WPBC_Booking_Date_Editor_Config' ) ) {
			WPBC_Booking_Date_Editor_Config::enqueue_script();
		}
		if ( class_exists( 'WPBC_Booking_Rescheduling_Config' ) ) {
			WPBC_Booking_Rescheduling_Config::enqueue_script();
		}

		$hosts_asset_path     = __DIR__ . '/_out/booking-inspector-hosts.js';
		$hosts_asset_modified = is_readable( $hosts_asset_path ) ? filemtime( $hosts_asset_path ) : false;
		$hosts_asset_version  = false !== $hosts_asset_modified ? WP_BK_VERSION_NUM . '.' . $hosts_asset_modified : WP_BK_VERSION_NUM;

		wp_enqueue_script(
			self::HOSTS_SCRIPT_HANDLE,
			WPBC_PLUGIN_URL . '/includes/booking-inspector/_out/booking-inspector-hosts.js',
			array( self::SCRIPT_HANDLE ),
			$hosts_asset_version,
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}

	/**
	 * Print the fixed allow-listed domain templates once.
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

		if ( class_exists( 'WPBC_Booking_Date_Editor_Config' ) ) {
			WPBC_Booking_Date_Editor_Config::print_template();
		}
		if ( class_exists( 'WPBC_Booking_Rescheduling_Config' ) ) {
			WPBC_Booking_Rescheduling_Config::print_templates();
		}
	}
}
