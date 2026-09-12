<?php
/**
 * First-install onboarding prompts on the Booking Listing page.
 *
 * @package Booking Calendar
 * @since   11.8.1
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Coordinate first-run prompt eligibility, assets, templates, and dismissal.
 *
 * The Setup domain owns the persisted state and markup. The Booking Listing is
 * only the route where this non-mutating entry prompt is presented.
 *
 * @since 11.8.1
 */
final class WPBC_Setup_Wizard_First_Run_Popup {

	/**
	 * Logged-in WordPress AJAX action used to consume the Setup prompt.
	 *
	 * @var string
	 */
	const AJAX_ACTION = 'WPBC_AJX_SETUP_WIZARD_FIRST_RUN_PROMPT';

	/**
	 * Logged-in WordPress AJAX action used to consume the booking-pages prompt.
	 *
	 * @var string
	 */
	const BOOKING_PAGES_AJAX_ACTION = 'WPBC_AJX_SETUP_WIZARD_BOOKING_PAGES_PROMPT';

	/**
	 * Nonce action protecting prompt state changes.
	 *
	 * @var string
	 */
	const NONCE_ACTION = 'wpbc_setup_wizard_first_run_prompt_wpbcnonce';

	/**
	 * Nonce action protecting booking-pages prompt state changes.
	 *
	 * @var string
	 */
	const BOOKING_PAGES_NONCE_ACTION = 'wpbc_setup_wizard_booking_pages_prompt_wpbcnonce';

	/**
	 * WordPress script handle for the route-scoped browser adapter.
	 *
	 * @var string
	 */
	const SCRIPT_HANDLE = 'wpbc-setup-wizard-first-run-popup';

	/**
	 * WordPress style handle for the route-scoped popup presentation.
	 *
	 * @var string
	 */
	const STYLE_HANDLE  = 'wpbc-setup-wizard-first-run-popup';

	/**
	 * Whether route-scoped assets were configured during this request.
	 *
	 * @var bool
	 */
	private static $assets_configured = false;

	/**
	 * Register prompt assets, allow-listed templates, and AJAX endpoints.
	 *
	 * @return void
	 */
	public static function init() {

		add_action( 'wpbc_enqueue_js_files', array( __CLASS__, 'enqueue_js_files' ), 60 );
		add_action( 'wpbc_enqueue_css_files', array( __CLASS__, 'enqueue_css_files' ), 60 );
		add_action( 'wpbc_hook_settings_page_footer', array( __CLASS__, 'render_template' ) );
		add_action( 'wp_ajax_' . self::AJAX_ACTION, array( __CLASS__, 'ajax_dismiss' ) );
		add_action( 'wp_ajax_' . self::BOOKING_PAGES_AJAX_ACTION, array( __CLASS__, 'ajax_dismiss_booking_pages_prompt' ) );
	}

	/**
	 * Check whether the current administrator can use Initial Setup.
	 *
	 * This mirrors the Setup menu's role and MultiUser ownership boundaries. The
	 * AJAX endpoint repeats the same check because browser visibility is never an
	 * authorization boundary.
	 *
	 * @return bool True when the current user may access Setup.
	 */
	private static function current_user_can_access() {

		if ( ! wpbc_is_user_can_access_wizard_page() ) {
			return false;
		}

		$minimum_role = get_bk_option( 'booking_user_role_settings' );

		return wpbc_is_current_user_have_this_role( $minimum_role );
	}

	/**
	 * Check whether the first-run prompt remains pending for this site.
	 *
	 * @return bool True when the prompt belongs to an unfinished first install.
	 */
	private static function is_setup_prompt_pending() {

		return wpbc_setup_wizard_is_initial_install_site()
			&& 'On' === get_bk_option( 'booking_setup_wizard_first_run_prompt' )
			&& 'On' !== get_bk_option( 'booking_setup_wizard_page_is_completed' );
	}

	/**
	 * Check whether the booking-pages prompt is enabled for this first install.
	 *
	 * This deliberately does not inspect the Setup prompt flag. The browser needs
	 * the cards preloaded so it can open the second dialog immediately after a
	 * successful first-dialog dismissal.
	 *
	 * @return bool True when this installation owns an unconsumed pages prompt.
	 */
	private static function is_booking_pages_prompt_enabled() {

		return wpbc_setup_wizard_is_initial_install_site()
			&& 'On' === get_bk_option( 'booking_setup_wizard_booking_pages_prompt' );
	}

	/**
	 * Check whether the booking-pages prompt is next in the first-run sequence.
	 *
	 * @return bool True after the Setup prompt has been consumed.
	 */
	private static function is_booking_pages_prompt_pending() {

		return self::is_booking_pages_prompt_enabled()
			&& 'Off' === get_bk_option( 'booking_setup_wizard_first_run_prompt' )
			&& ! empty( self::get_booking_page_cards() );
	}

	/**
	 * Get presentation metadata for valid public starter booking pages.
	 *
	 * Page existence and shortcode validation remain owned by the publishing
	 * module. This Setup-owned mapper adds only translated onboarding copy and
	 * resolved local previews for the allow-listed starter page purposes.
	 *
	 * @return array<int,array<string,string>> JSON-safe card records.
	 */
	private static function get_booking_page_cards() {

		static $booking_page_cards_by_site = array();

		$site_id = get_current_blog_id();

		if ( array_key_exists( $site_id, $booking_page_cards_by_site ) ) {
			return $booking_page_cards_by_site[ $site_id ];
		}

		$booking_page_cards_by_site[ $site_id ] = array();

		if ( ! function_exists( 'wpbc_get_published_activation_booking_pages' ) ) {
			return $booking_page_cards_by_site[ $site_id ];
		}

		$published_pages = wpbc_get_published_activation_booking_pages();
		if ( empty( $published_pages ) || ! is_array( $published_pages ) ) {
			return $booking_page_cards_by_site[ $site_id ];
		}

		$page_presentations = array(
			'full_day_booking' => array(
				'template_key' => 'dates_2_columns_hints_full_days',
				'description'  => __( 'Try a date-based booking for stays, rentals, events, or other full-day reservations.', 'booking' ),
			),
			'appointment_booking' => array(
				'template_key' => 'appointments_services_flow',
				'description'  => __( 'Try the guided service and appointment booking experience.', 'booking' ),
			),
			'time_slots_booking' => array(
				'template_key' => 'time_slots_2_columns_hints',
				'description'  => __( 'Try a two-step time-slot booking with date and time selection followed by customer details.', 'booking' ),
			),
			'resource_selector_booking' => array(
				'image_url'   => 'https://wpbookingcalendar.com/assets/template-img/wp_booking_calendar__resource_selection_card.png',
				'description' => __( 'Choose a Booking Resource first, then continue through its booking form.', 'booking' ),
			),
			'contact_form' => array(
				'template_key' => 'contact_form_simple',
				'description'  => __( 'Preview the simple inquiry form included with your starter pages.', 'booking' ),
			),
		);

		foreach ( $page_presentations as $page_key => $page_presentation ) {
			if ( empty( $published_pages[ $page_key ] ) || ! is_array( $published_pages[ $page_key ] ) ) {
				continue;
			}

			$published_page  = $published_pages[ $page_key ];
			$image_url       = isset( $page_presentation['image_url'] )
				? esc_url_raw( (string) $page_presentation['image_url'] )
				: '';
			$template_key    = isset( $page_presentation['template_key'] )
				? sanitize_key( (string) $page_presentation['template_key'] )
				: '';
			$template_record = '' !== $template_key && function_exists( 'wpbc_get_bfb_template_record_by_key' )
				? wpbc_get_bfb_template_record_by_key( $template_key )
				: array();

			if (
				'' === $image_url
				&& ! empty( $template_record['picture_url'] )
				&& function_exists( 'wpbc_bfb_resolve_picture_url' )
			) {
				$image_url = esc_url_raw( wpbc_bfb_resolve_picture_url( $template_record['picture_url'] ) );
			}

			$page_title = isset( $published_page['page_title'] ) ? (string) $published_page['page_title'] : '';
			/* translators: %s: starter booking page title. */
			$image_alt = sprintf( __( 'Preview of %s', 'booking' ), $page_title );
			/* translators: %s: starter booking page title. */
			$button_title = sprintf( __( 'Open %s', 'booking' ), $page_title );

			$booking_page_cards_by_site[ $site_id ][] = array(
				'key'          => $page_key,
				'url'          => esc_url_raw( (string) $published_page['url'] ),
				'page_title'   => $page_title,
				'button_title' => $button_title,
				'description'  => $page_presentation['description'],
				'image_url'    => $image_url,
				'image_alt'    => $image_alt,
			);
		}

		return $booking_page_cards_by_site[ $site_id ];
	}

	/**
	 * Check whether the current authorized user can manually reopen starter pages.
	 *
	 * Automatic display remains controlled by the one-time prompt option. This
	 * separate read-only capability keeps the approved starter-page window
	 * available from the first-install welcome panel after that option is Off.
	 * Updates remain excluded by the persisted initial-install marker. Live demo
	 * sites are the only presentation-only exception: they may open existing demo
	 * pages manually, but never enable either automatic prompt. No missing page is
	 * created or repaired while evaluating this method. The Booking Listing route
	 * is part of this decision so the launcher is never emitted on Timeline where
	 * its route-scoped assets are intentionally absent.
	 *
	 * @return bool True when at least one validated starter page can be shown.
	 */
	public static function can_manually_open_booking_pages_dialog() {

		$is_initial_install_or_demo = wpbc_setup_wizard_is_initial_install_site()
			|| ( function_exists( 'wpbc_is_this_demo' ) && wpbc_is_this_demo() );

		return self::is_booking_listing_route()
			&& $is_initial_install_or_demo
			&& ! empty( self::get_booking_page_cards() );
	}

	/**
	 * Check whether the current request is the Booking Listing route.
	 *
	 * The Booking Listing controller normalizes an omitted tab into `$_REQUEST`
	 * before administration assets are enqueued. Reading that normalized value
	 * avoids loading the interface over a saved Timeline default.
	 *
	 * @return bool True when the current authorized request is Booking Listing.
	 */
	private static function is_booking_listing_route() {

		if ( ! is_admin() || ! wpbc_is_bookings_page() || ! self::current_user_can_access() ) {
			return false;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only route selection.
		$requested_tab = isset( $_REQUEST['tab'] ) && is_scalar( $_REQUEST['tab'] )
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only route selection.
			? sanitize_key( wp_unslash( $_REQUEST['tab'] ) )
			: '';

		return in_array( $requested_tab, array( '', 'vm_booking_listing' ), true );
	}

	/**
	 * Check whether the current request needs the popup interface.
	 *
	 * A pending first-run prompt can open automatically. After the starter-pages
	 * prompt is consumed, the same interface remains available only through the
	 * explicit welcome-panel button. Both paths retain the exact route, user, and
	 * first-install boundaries.
	 *
	 * @return bool True when assets and allow-listed templates are required.
	 */
	private static function should_render() {

		if ( ! self::is_booking_listing_route() ) {
			return false;
		}

		return self::is_setup_prompt_pending()
			|| self::can_manually_open_booking_pages_dialog();
	}

	/**
	 * Enqueue the thin browser adapter on an eligible Booking Listing request.
	 *
	 * @param string $where_to_load Booking Calendar asset context.
	 *
	 * @return void
	 */
	public static function enqueue_js_files( $where_to_load ) {

		if ( self::$assets_configured || ! in_array( $where_to_load, array( 'admin', 'both' ), true ) || ! self::should_render() ) {
			return;
		}

		$script_path = WPBC_PLUGIN_DIR . '/includes/page-setup/_out/setup_first_run_popup.js';
		$version     = file_exists( $script_path ) ? (string) filemtime( $script_path ) : WP_BK_VERSION_NUM;

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			wpbc_plugin_url( '/includes/page-setup/_out/setup_first_run_popup.js' ),
			array( 'jquery', 'wp-util', 'wpbc-modal' ),
			$version,
			true
		);

		$can_open_booking_pages = self::can_manually_open_booking_pages_dialog();
		$booking_page_cards      = $can_open_booking_pages ? self::get_booking_page_cards() : array();

		wp_localize_script(
			self::SCRIPT_HANDLE,
			'wpbc_setup_wizard_first_run_popup_vars',
			array(
				'ajax_url'             => admin_url( 'admin-ajax.php', 'relative' ),
				'setup_prompt'         => array(
					'action'    => self::AJAX_ACTION,
					'nonce'     => wp_create_nonce( self::NONCE_ACTION ),
					'setup_url' => wpbc_get_setup_wizard_page_url(),
					'show'      => self::is_setup_prompt_pending(),
				),
				'booking_pages_prompt' => array(
					'action'        => self::BOOKING_PAGES_AJAX_ACTION,
					'nonce'         => wp_create_nonce( self::BOOKING_PAGES_NONCE_ACTION ),
					'available'     => $can_open_booking_pages,
					'show'          => self::is_booking_pages_prompt_pending(),
					'booking_pages' => $booking_page_cards,
				),
			)
		);

		self::$assets_configured = true;
	}

	/**
	 * Enqueue route-scoped popup presentation styles.
	 *
	 * @param string $where_to_load Booking Calendar asset context.
	 *
	 * @return void
	 */
	public static function enqueue_css_files( $where_to_load ) {

		if ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) || ! self::should_render() ) {
			return;
		}

		$style_path = WPBC_PLUGIN_DIR . '/includes/page-setup/_out/setup_first_run_popup.css';
		$version    = file_exists( $style_path ) ? (string) filemtime( $style_path ) : WP_BK_VERSION_NUM;

		wp_enqueue_style(
			self::STYLE_HANDLE,
			wpbc_plugin_url( '/includes/page-setup/_out/setup_first_run_popup.css' ),
			array(),
			$version
		);
	}

	/**
	 * Render the Setup-owned, allow-listed WordPress template.
	 *
	 * @param string $page Booking Calendar footer template context.
	 *
	 * @return void
	 */
	public static function render_template( $page ) {

		if ( 'wpbc-ajx_booking' !== $page || ! self::should_render() ) {
			return;
		}

		$template_paths = array(
			WPBC_PLUGIN_DIR . '/includes/page-setup/templates/first-run-popup-wptpl.php',
			WPBC_PLUGIN_DIR . '/includes/page-setup/templates/booking-pages-popup-wptpl.php',
		);

		foreach ( $template_paths as $template_path ) {
			if ( is_readable( $template_path ) ) {
				require $template_path;
			}
		}
	}

	/**
	 * Persist that the first-run prompt must not be shown again.
	 *
	 * Both the start and dismiss choices consume the one-time prompt. Starting the
	 * wizard does not mark Setup complete; completion remains owned by its existing
	 * step workflow.
	 *
	 * @return void
	 */
	public static function ajax_dismiss() {

		if ( ! check_ajax_referer( self::NONCE_ACTION, 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Security check failed.', 'booking' ) ), 403 );
		}

		if ( ! self::current_user_can_access() ) {
			wp_send_json_error( array( 'message' => __( 'You do not have access to Initial Setup.', 'booking' ) ), 403 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above with check_ajax_referer().
		$choice = isset( $_POST['choice'] ) && is_scalar( $_POST['choice'] )
			// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above with check_ajax_referer().
			? sanitize_key( wp_unslash( $_POST['choice'] ) )
			: '';

		if ( ! in_array( $choice, array( 'dismiss', 'start' ), true ) ) {
			wp_send_json_error( array( 'message' => __( 'The Initial Setup choice is not valid.', 'booking' ) ), 400 );
		}

		if ( ! wpbc_setup_wizard_is_initial_install_site() ) {
			wp_send_json_error( array( 'message' => __( 'The Initial Setup prompt is not available for this installation.', 'booking' ) ), 409 );
		}

		update_bk_option( 'booking_setup_wizard_first_run_prompt', 'Off' );
		if ( 'Off' !== get_bk_option( 'booking_setup_wizard_first_run_prompt' ) ) {
			wp_send_json_error( array( 'message' => __( 'The Initial Setup choice could not be saved.', 'booking' ) ), 500 );
		}

		wp_send_json_success( array( 'choice' => $choice ) );
	}

	/**
	 * Permanently dismiss the first-install booking-pages prompt.
	 *
	 * The endpoint is intentionally idempotent. Closing the dialog twice because
	 * of overlapping browser events still leaves the one-time option safely Off.
	 *
	 * @return void
	 */
	public static function ajax_dismiss_booking_pages_prompt() {

		if ( ! check_ajax_referer( self::BOOKING_PAGES_NONCE_ACTION, 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Security check failed.', 'booking' ) ), 403 );
		}

		if ( ! self::current_user_can_access() ) {
			wp_send_json_error( array( 'message' => __( 'You do not have access to Initial Setup.', 'booking' ) ), 403 );
		}

		if ( ! wpbc_setup_wizard_is_initial_install_site() ) {
			wp_send_json_error( array( 'message' => __( 'The starter-pages prompt is not available for this installation.', 'booking' ) ), 409 );
		}

		if ( 'Off' === get_bk_option( 'booking_setup_wizard_booking_pages_prompt' ) ) {
			wp_send_json_success( array( 'dismissed' => true ) );
		}

		if ( 'Off' !== get_bk_option( 'booking_setup_wizard_first_run_prompt' ) ) {
			wp_send_json_error( array( 'message' => __( 'Finish the Initial Setup choice before dismissing starter pages.', 'booking' ) ), 409 );
		}

		update_bk_option( 'booking_setup_wizard_booking_pages_prompt', 'Off' );
		if ( 'Off' !== get_bk_option( 'booking_setup_wizard_booking_pages_prompt' ) ) {
			wp_send_json_error( array( 'message' => __( 'The starter-pages choice could not be saved.', 'booking' ) ), 500 );
		}

		wp_send_json_success( array( 'dismissed' => true ) );
	}
}

WPBC_Setup_Wizard_First_Run_Popup::init();
