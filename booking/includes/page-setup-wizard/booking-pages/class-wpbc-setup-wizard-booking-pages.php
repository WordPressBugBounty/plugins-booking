<?php
/**
 * Published booking-page discovery and dialog component.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Own published booking-page discovery, presentation, and prompt dismissal.
 *
 * The component is reusable from Booking Listing and completed Setup Overview.
 * It returns only authorized, JSON-safe card data and renders a fixed,
 * server-owned WordPress template. It never creates, updates, or repairs pages.
 */
final class WPBC_Setup_Wizard_Booking_Pages {

	/** Logged-in AJAX action used to consume the first-install pages prompt. */
	const AJAX_ACTION = 'WPBC_AJX_SETUP_WIZARD_BOOKING_PAGES_PROMPT';

	/** Nonce action protecting the pages-prompt option update. */
	const NONCE_ACTION = 'wpbc_setup_wizard_booking_pages_prompt_wpbcnonce';

	/** Runtime browser adapter handle. */
	const SCRIPT_HANDLE = 'wpbc-setup-wizard-booking-pages';

	/** Runtime presentation handle. */
	const STYLE_HANDLE = 'wpbc-setup-wizard-booking-pages';

	/** Site-local user option recording that automatic display was consumed. */
	const USER_DISMISSAL_OPTION = 'booking_setup_wizard_booking_pages_prompt_dismissed';

	/** @var bool Whether dialog configuration was localized in this request. */
	private static $assets_configured = false;

	/** @var bool Whether the allow-listed dialog template was rendered. */
	private static $template_rendered = false;

	/**
	 * Register route-scoped assets, template rendering, and the AJAX endpoint.
	 *
	 * @return void
	 */
	public static function register() {
		add_action( 'wpbc_enqueue_js_files', array( __CLASS__, 'enqueue_booking_listing_scripts' ), 50 );
		add_action( 'wpbc_enqueue_css_files', array( __CLASS__, 'enqueue_booking_listing_styles' ), 50 );
		add_action( 'wpbc_hook_settings_page_footer', array( __CLASS__, 'render_booking_listing_template' ) );
		add_action( 'wp_ajax_' . self::AJAX_ACTION, array( __CLASS__, 'ajax_dismiss_prompt' ) );
	}

	/**
	 * Check whether the current user may access Setup-owned administration UI.
	 *
	 * @return bool True when access is allowed.
	 */
	private static function current_user_can_access() {
		return WPBC_Setup_Wizard_Access::current_user_can_access();
	}

	/**
	 * Check whether the current request is the Booking Listing route.
	 *
	 * @return bool True for the authorized Booking Listing request.
	 */
	public static function is_booking_listing_route() {
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
	 * Check whether automatic booking-page prompting remains enabled.
	 *
	 * @return bool True when the preserved first-install option is On.
	 */
	private static function is_prompt_enabled() {
		return WPBC_Setup_Wizard_First_Install_State::is_initial_install_site()
			&& 'On' === get_bk_option( 'booking_setup_wizard_booking_pages_prompt' )
			&& ! self::is_prompt_dismissed_for_current_user();
	}

	/**
	 * Return the real authenticated user that owns this presentation preference.
	 *
	 * The published-pages prompt is a per-user Booking Listing preference, not an
	 * effective MultiUser owner's Setup checkpoint. The site-local user-option API
	 * supplies multisite isolation without accepting a browser-provided user ID.
	 *
	 * @return int Real authenticated WordPress user ID, or zero when unavailable.
	 */
	private static function get_prompt_user_id() {
		$storage_context = WPBC_Setup_Wizard_Access::get_storage_context();

		return isset( $storage_context['real_user_id'] ) ? absint( $storage_context['real_user_id'] ) : 0;
	}

	/**
	 * Check whether the current user already closed the automatic pages dialog.
	 *
	 * @return bool True when automatic display was consumed for this user/site.
	 */
	private static function is_prompt_dismissed_for_current_user() {
		$user_id = self::get_prompt_user_id();

		return $user_id && '1' === (string) get_user_option( self::USER_DISMISSAL_OPTION, $user_id );
	}

	/**
	 * Persist automatic-dialog dismissal for the current user and site.
	 *
	 * WordPress can return false when an identical value already exists. Verify
	 * storage after the write so an idempotent close is still treated as success.
	 *
	 * @return bool True when the site-local user preference is stored.
	 */
	private static function persist_prompt_dismissal_for_current_user() {
		$user_id = self::get_prompt_user_id();
		if ( ! $user_id ) {
			return false;
		}

		$was_updated = update_user_option( $user_id, self::USER_DISMISSAL_OPTION, '1', false );

		return false !== $was_updated || '1' === (string) get_user_option( self::USER_DISMISSAL_OPTION, $user_id );
	}

	/**
	 * Check whether the pages dialog may follow a dismissed Setup invitation.
	 *
	 * This intentionally does not require the first-run option to be Off because
	 * the browser calls it only after the authenticated dismissal succeeds.
	 *
	 * @return bool True when an unconsumed pages prompt has usable cards.
	 */
	public static function can_follow_setup_prompt() {
		return self::is_prompt_enabled() && ! empty( self::get_booking_page_cards() );
	}

	/**
	 * Check whether the one-time pages dialog should open on page load.
	 *
	 * @return bool True after the Setup invitation has been consumed.
	 */
	private static function is_prompt_pending() {
		return self::can_follow_setup_prompt()
			&& 'Off' === get_bk_option( 'booking_setup_wizard_first_run_prompt' );
	}

	/**
	 * Get presentation metadata for the Setup-created page and starter examples.
	 *
	 * @return array<int,array<string,mixed>> JSON-safe card records.
	 */
	public static function get_booking_page_cards() {
		static $booking_page_cards_by_context = array();

		$storage_context = WPBC_Setup_Wizard_Access::get_storage_context();
		$cache_key       = absint( get_current_blog_id() ) . ':' . ( isset( $storage_context['owner_user_id'] ) ? absint( $storage_context['owner_user_id'] ) : 0 );
		if ( array_key_exists( $cache_key, $booking_page_cards_by_context ) ) {
			return $booking_page_cards_by_context[ $cache_key ];
		}

		$page_records      = array();
		$setup_page_record = self::get_setup_created_page_record();
		if ( ! empty( $setup_page_record ) ) {
			$page_records[] = $setup_page_record;
		}

		$page_presentations = array(
			'full_day_booking'          => array(
				'template_key' => 'dates_2_columns_hints_full_days',
				'description'  => __( 'Try a date-based booking for stays, rentals, events, or other full-day reservations.', 'booking' ),
			),
			'appointment_booking'       => array(
				'template_key' => 'appointments_services_selection_summary',
				'description'  => __( 'Try the guided service and appointment booking experience.', 'booking' ),
			),
			'time_slots_booking'        => array(
				'template_key' => 'time_slots_2_columns_hints',
				'description'  => __( 'Try a two-step time-slot booking with date and time selection followed by customer details.', 'booking' ),
			),
			'resource_selector_booking' => array(
				'image_url'   => 'https://wpbookingcalendar.com/assets/template-img/wp_booking_calendar__resource_selection_card.png',
				'description' => __( 'Choose a Booking Resource first, then continue through its booking form.', 'booking' ),
			),
			'contact_form'               => array(
				'template_key' => 'contact_form_simple',
				'description'  => __( 'Preview the simple inquiry form included with your starter pages.', 'booking' ),
			),
		);

		if ( function_exists( 'wpbc_get_published_activation_booking_pages' ) ) {
			$published_pages = wpbc_get_published_activation_booking_pages();
			foreach ( is_array( $published_pages ) ? $page_presentations : array() as $page_key => $page_presentation ) {
				if ( empty( $published_pages[ $page_key ] ) || ! is_array( $published_pages[ $page_key ] ) ) {
					continue;
				}

				$page_records[] = array_merge(
					$published_pages[ $page_key ],
					$page_presentation,
					array(
						'key'     => $page_key,
						'section' => 'examples',
					)
				);
			}
		}

		$booking_page_cards_by_context[ $cache_key ] = self::prepare_booking_page_cards( $page_records );

		return $booking_page_cards_by_context[ $cache_key ];
	}

	/**
	 * Build the primary card for the latest public page created by Setup Wizard.
	 *
	 * Page discovery is delegated to the publishing domain so this presentation
	 * layer cannot drift from its owner- and multisite-scoped creation markers.
	 * A Form Builder slug is read only from the server-owned managed shortcode and
	 * is used solely to resolve the matching preview image.
	 *
	 * @return array<string,mixed> Authorized page record, or an empty array.
	 */
	private static function get_setup_created_page_record() {
		if ( ! class_exists( 'WPBC_Setup_Wizard_Publish_Integration' ) ) {
			return array();
		}

		$publish_integration = new WPBC_Setup_Wizard_Publish_Integration();
		$page                = $publish_integration->get_latest_created_page();
		if ( ! $page || empty( $page->ID ) ) {
			return array();
		}

		$page_url   = get_permalink( $page->ID );
		$page_title = wp_strip_all_tags( get_the_title( $page->ID ) );
		if ( ! is_string( $page_url ) || '' === $page_url || '' === $page_title ) {
			return array();
		}

		$template_key = '';
		if ( preg_match( '/\bform_type\s*=\s*(["\'])([^"\']+)\1/i', (string) $page->post_content, $matches ) ) {
			$template_key = sanitize_key( $matches[2] );
		}

		$page_record = array(
			'key'          => 'setup_wizard_booking_page',
			'section'      => 'setup',
			'url'          => $page_url,
			'page_title'   => $page_title,
			'button_title' => __( 'Open your booking page', 'booking' ),
			'description'  => __( 'Created from the customer journey, Booking Form, appearance, and publishing choices you saved in Setup Wizard.', 'booking' ),
			'template_key' => $template_key,
		);

		$published_content_id = (string) get_post_meta(
			$page->ID,
			WPBC_Setup_Wizard_Publish_Integration::META_CONTENT,
			true
		);
		if ( WPBC_Setup_Wizard_Publish_Integration::CONTENT_RESOURCE_SELECTION === $published_content_id ) {
			$page_record['image_url'] = 'https://wpbookingcalendar.com/assets/template-img/wp_booking_calendar__resource_selection_card.png';
		}

		return $page_record;
	}

	/**
	 * Normalize authorized published-page records for picture-card presentation.
	 *
	 * @param array<int,array<string,mixed>> $page_records Authorized page records.
	 *
	 * @return array<int,array<string,mixed>> Normalized card records.
	 */
	public static function prepare_booking_page_cards( array $page_records ) {
		$booking_page_cards = array();

		foreach ( $page_records as $page_record ) {
			if ( ! is_array( $page_record ) ) {
				continue;
			}

			$page_url   = isset( $page_record['url'] ) && is_scalar( $page_record['url'] ) ? esc_url_raw( (string) $page_record['url'] ) : '';
			$page_title = isset( $page_record['page_title'] ) && is_scalar( $page_record['page_title'] ) ? sanitize_text_field( (string) $page_record['page_title'] ) : '';
			if ( '' === $page_url || '' === $page_title ) {
				continue;
			}

			$image_url    = isset( $page_record['image_url'] ) && is_scalar( $page_record['image_url'] ) ? esc_url_raw( (string) $page_record['image_url'] ) : '';
			$template_key = isset( $page_record['template_key'] ) && is_scalar( $page_record['template_key'] ) ? sanitize_key( (string) $page_record['template_key'] ) : '';
			if ( '' === $image_url && '' !== $template_key ) {
				$template_record = self::get_template_record_by_key_or_slug( $template_key );
				if ( ! empty( $template_record['picture_url'] ) && function_exists( 'wpbc_bfb_resolve_picture_url' ) ) {
					$image_url = esc_url_raw( wpbc_bfb_resolve_picture_url( $template_record['picture_url'] ) );
				}
			}

			$description = isset( $page_record['description'] ) && is_scalar( $page_record['description'] )
				? sanitize_text_field( (string) $page_record['description'] )
				: __( 'Open this published page and try its booking experience.', 'booking' );
			$image_alt  = isset( $page_record['image_alt'] ) && is_scalar( $page_record['image_alt'] ) ? sanitize_text_field( (string) $page_record['image_alt'] ) : '';
			if ( '' === $image_alt ) {
				/* translators: %s: published booking page title. */
				$image_alt = sprintf( __( 'Preview of %s', 'booking' ), $page_title );
			}

			$button_title = isset( $page_record['button_title'] ) && is_scalar( $page_record['button_title'] ) ? sanitize_text_field( (string) $page_record['button_title'] ) : '';
			if ( '' === $button_title ) {
				/* translators: %s: published booking page title. */
				$button_title = sprintf( __( 'Open %s', 'booking' ), $page_title );
			}

			$booking_page_cards[] = array(
				'key'          => isset( $page_record['key'] ) && is_scalar( $page_record['key'] ) ? sanitize_key( (string) $page_record['key'] ) : '',
				'section'      => isset( $page_record['section'] ) && 'setup' === sanitize_key( (string) $page_record['section'] ) ? 'setup' : 'examples',
				'url'          => $page_url,
				'page_title'   => $page_title,
				'button_title' => $button_title,
				'description'  => $description,
				'image_url'    => $image_url,
				'image_alt'    => $image_alt,
			);
		}

		return $booking_page_cards;
	}

	/**
	 * Resolve one allow-listed Form Builder template by key or form slug.
	 *
	 * @param string $template_identifier Sanitized template key or form slug.
	 *
	 * @return array<string,mixed> Bundled template record, or an empty array.
	 */
	private static function get_template_record_by_key_or_slug( $template_identifier ) {
		$template_identifier = sanitize_key( (string) $template_identifier );
		if ( '' === $template_identifier ) {
			return array();
		}

		if ( function_exists( 'wpbc_get_bfb_template_record_by_key' ) ) {
			$template_record = wpbc_get_bfb_template_record_by_key( $template_identifier );
			if ( ! empty( $template_record ) && is_array( $template_record ) ) {
				return $template_record;
			}
		}

		if ( ! function_exists( 'wpbc_bfb_activation__get_templates_registry' ) || ! function_exists( 'wpbc_bfb_activation__normalize_template_config' ) ) {
			return array();
		}

		foreach ( (array) wpbc_bfb_activation__get_templates_registry() as $template_config ) {
			$template_config = wpbc_bfb_activation__normalize_template_config( $template_config );
			$template_record = isset( $template_config['record'] ) && is_array( $template_config['record'] ) ? $template_config['record'] : array();
			$template_slug   = isset( $template_record['form_slug'] ) && is_scalar( $template_record['form_slug'] ) ? sanitize_title( (string) $template_record['form_slug'] ) : '';
			if ( $template_identifier === $template_slug ) {
				return $template_record;
			}
		}

		return array();
	}

	/**
	 * Check whether Booking Listing may manually reopen validated starter pages.
	 *
	 * @return bool True when at least one page is available on the allowed route.
	 */
	public static function can_manually_open_booking_pages_dialog() {
		$is_initial_install_or_demo = WPBC_Setup_Wizard_First_Install_State::is_initial_install_site()
			|| WPBC_Setup_Wizard_Environment_Policy::is_live_demo();

		return self::is_booking_listing_route()
			&& $is_initial_install_or_demo
			&& ! empty( self::get_booking_page_cards() );
	}

	/**
	 * Check whether Booking Listing requires the dialog component.
	 *
	 * @return bool True when automatic or manual dialog use is available.
	 */
	private static function should_render_booking_listing() {
		return self::is_booking_listing_route()
			&& ( self::is_prompt_pending() || self::can_manually_open_booking_pages_dialog() );
	}

	/**
	 * Enqueue and configure the dialog for an authorized manual caller.
	 *
	 * @param array<int,array<string,mixed>> $booking_page_cards Authorized cards.
	 *
	 * @return bool True when the dialog was configured.
	 */
	public static function enqueue_manual_dialog( array $booking_page_cards ) {
		if ( self::$assets_configured ) {
			return true;
		}

		$booking_page_cards = self::prepare_booking_page_cards( $booking_page_cards );
		if ( empty( $booking_page_cards ) ) {
			return false;
		}

		self::enqueue_script();
		self::enqueue_style();
		self::localize_script(
			$booking_page_cards,
			false,
			'',
			'',
			__( 'Open a published booking page in a new tab and try the booking experience as a visitor.', 'booking' ),
			__( 'Close', 'booking' )
		);

		return true;
	}

	/**
	 * Enqueue and configure the component on Booking Listing.
	 *
	 * @param string $where_to_load Booking Calendar asset context.
	 *
	 * @return void
	 */
	public static function enqueue_booking_listing_scripts( $where_to_load ) {
		if ( self::$assets_configured || ! in_array( $where_to_load, array( 'admin', 'both' ), true ) || ! self::should_render_booking_listing() ) {
			return;
		}

		$booking_page_cards = self::get_booking_page_cards();
		self::enqueue_script();
		self::localize_script(
			$booking_page_cards,
			self::is_prompt_pending(),
			self::AJAX_ACTION,
			wp_create_nonce( self::NONCE_ACTION ),
			__( 'Open your configured booking page or a starter example in a new tab and try the booking experience as a visitor.', 'booking' ),
			__( 'Continue to Booking Listing', 'booking' )
		);
	}

	/**
	 * Enqueue component styles on Booking Listing.
	 *
	 * @param string $where_to_load Booking Calendar asset context.
	 *
	 * @return void
	 */
	public static function enqueue_booking_listing_styles( $where_to_load ) {
		if ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) || ! self::should_render_booking_listing() ) {
			return;
		}

		self::enqueue_style();
	}

	/**
	 * Localize one authoritative, JSON-safe dialog configuration.
	 *
	 * @param array<int,array<string,mixed>> $booking_page_cards Normalized cards.
	 * @param bool                            $show               Whether to open on load.
	 * @param string                          $action             Optional AJAX action.
	 * @param string                          $nonce              Optional AJAX nonce.
	 * @param string                          $description        Dialog description.
	 * @param string                          $dismiss_label      Dialog close-button label.
	 *
	 * @return void
	 */
	private static function localize_script( array $booking_page_cards, $show, $action, $nonce, $description, $dismiss_label ) {
		wp_localize_script(
			self::SCRIPT_HANDLE,
			'wpbc_setup_wizard_booking_pages_vars',
			array(
				'ajax_url'      => admin_url( 'admin-ajax.php', 'relative' ),
				'action'        => (string) $action,
				'nonce'         => (string) $nonce,
				'show'          => (bool) $show,
				'booking_pages' => $booking_page_cards,
				'description'   => sanitize_text_field( $description ),
				'dismiss_label' => sanitize_text_field( $dismiss_label ),
			)
		);

		self::$assets_configured = true;
	}

	/**
	 * Enqueue the compiled browser adapter.
	 *
	 * @return void
	 */
	private static function enqueue_script() {
		$script_path = __DIR__ . '/_out/booking-pages-dialog.js';
		$version     = file_exists( $script_path ) ? (string) filemtime( $script_path ) : WP_BK_VERSION_NUM;

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			wpbc_plugin_url( '/includes/page-setup-wizard/booking-pages/_out/booking-pages-dialog.js' ),
			array( 'jquery', 'wp-util', 'wpbc-modal' ),
			$version,
			true
		);
	}

	/**
	 * Enqueue the compiled dialog presentation.
	 *
	 * @return void
	 */
	private static function enqueue_style() {
		$style_path = __DIR__ . '/_out/booking-pages-dialog.css';
		$version    = file_exists( $style_path ) ? (string) filemtime( $style_path ) : WP_BK_VERSION_NUM;

		wp_enqueue_style(
			self::STYLE_HANDLE,
			wpbc_plugin_url( '/includes/page-setup-wizard/booking-pages/_out/booking-pages-dialog.css' ),
			array(),
			$version
		);
	}

	/**
	 * Render the allow-listed template in the Booking Listing footer.
	 *
	 * @param string $page Booking Calendar footer context.
	 *
	 * @return void
	 */
	public static function render_booking_listing_template( $page ) {
		if ( 'wpbc-ajx_booking' !== $page || ! self::should_render_booking_listing() ) {
			return;
		}

		self::render_template();
	}

	/**
	 * Render the fixed dialog template once.
	 *
	 * @return bool True when the template is available or already rendered.
	 */
	public static function render_template() {
		if ( self::$template_rendered ) {
			return true;
		}

		$template_path = __DIR__ . '/templates/booking-pages-popup-wptpl.php';
		if ( ! is_readable( $template_path ) ) {
			return false;
		}

		require $template_path;
		self::$template_rendered = true;

		return true;
	}

	/**
	 * Persist dismissal of the first-install pages prompt.
	 *
	 * @return void
	 */
	public static function ajax_dismiss_prompt() {
		if ( ! check_ajax_referer( self::NONCE_ACTION, 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Security check failed.', 'booking' ) ), 403 );
		}

		if ( ! self::current_user_can_access() ) {
			wp_send_json_error( array( 'message' => __( 'You do not have access to Initial Setup.', 'booking' ) ), 403 );
		}

		if ( ! WPBC_Setup_Wizard_First_Install_State::is_initial_install_site() ) {
			wp_send_json_error( array( 'message' => __( 'The starter-pages prompt is not available for this installation.', 'booking' ) ), 409 );
		}

		if ( self::is_prompt_dismissed_for_current_user() ) {
			wp_send_json_success( array( 'dismissed' => true ) );
		}

		if ( 'Off' !== get_bk_option( 'booking_setup_wizard_first_run_prompt' ) ) {
			wp_send_json_error( array( 'message' => __( 'Finish the Initial Setup choice before dismissing starter pages.', 'booking' ) ), 409 );
		}

		if ( ! self::persist_prompt_dismissal_for_current_user() ) {
			wp_send_json_error( array( 'message' => __( 'The starter-pages choice could not be saved.', 'booking' ) ), 500 );
		}

		wp_send_json_success( array( 'dismissed' => true ) );
	}
}
