<?php
/**
 * First-install Setup Wizard launcher component.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Own the one-time Booking Listing invitation to start the Setup Wizard.
 *
 * Existing installation option names and AJAX contracts are preserved. The
 * new owner/site-scoped checkpoint is authoritative for completion suppression;
 * the released legacy completion option is deliberately not consulted.
 */
final class WPBC_Setup_Wizard_First_Run_Launcher {

	/** Logged-in WordPress AJAX action used to consume the invitation. */
	const AJAX_ACTION = 'WPBC_AJX_SETUP_WIZARD_FIRST_RUN_PROMPT';

	/** Nonce action protecting invitation state changes. */
	const NONCE_ACTION = 'wpbc_setup_wizard_first_run_prompt_wpbcnonce';

	/** Runtime browser adapter handle. */
	const SCRIPT_HANDLE = 'wpbc-setup-wizard-first-run-launcher';

	/** Runtime presentation handle. */
	const STYLE_HANDLE = 'wpbc-setup-wizard-first-run-launcher';

	/** @var bool Whether launcher configuration was localized in this request. */
	private static $assets_configured = false;

	/**
	 * Register route-scoped assets, template rendering, and the AJAX endpoint.
	 *
	 * @return void
	 */
	public static function register() {
		add_action( 'wpbc_enqueue_js_files', array( __CLASS__, 'enqueue_scripts' ), 60 );
		add_action( 'wpbc_enqueue_css_files', array( __CLASS__, 'enqueue_styles' ), 60 );
		add_action( 'wpbc_hook_settings_page_footer', array( __CLASS__, 'render_template' ) );
		add_action( 'wp_ajax_' . self::AJAX_ACTION, array( __CLASS__, 'ajax_dismiss' ) );
	}

	/**
	 * Build the current owner/site checkpoint store.
	 *
	 * @return WPBC_Setup_Wizard_Draft_Store Context-bound checkpoint store.
	 */
	private static function get_checkpoint_store() {
		$module_registry = new WPBC_Setup_Wizard_Step_Module_Registry();
		$step_registry   = new WPBC_Setup_Wizard_Step_Registry( $module_registry );
		$step_data       = new WPBC_Setup_Wizard_Step_Data( $module_registry );

		return new WPBC_Setup_Wizard_Draft_Store( $step_registry, new WPBC_Setup_Wizard_Draft_Validator( $step_data ) );
	}

	/**
	 * Check whether the production checkpoint is complete for this context.
	 *
	 * @return bool True when the normalized checkpoint has terminal status.
	 */
	private static function is_checkpoint_completed() {
		$checkpoint = self::get_checkpoint_store()->load();

		return isset( $checkpoint['status'] ) && 'completed' === $checkpoint['status'];
	}

	/**
	 * Check whether the first-install invitation remains pending.
	 *
	 * @return bool True when this site has an unconsumed, incomplete invitation.
	 */
	public static function is_prompt_pending() {
		return ! WPBC_Setup_Wizard_First_Install_State::is_automatic_onboarding_restricted()
			&& WPBC_Setup_Wizard_First_Install_State::is_initial_install_site()
			&& 'On' === get_bk_option( 'booking_setup_wizard_first_run_prompt' )
			&& ! self::is_checkpoint_completed();
	}

	/**
	 * Check whether the launcher belongs on this request.
	 *
	 * @return bool True for the eligible Booking Listing request.
	 */
	private static function should_render() {
		return WPBC_Setup_Wizard_Booking_Pages::is_booking_listing_route()
			&& self::is_prompt_pending();
	}

	/**
	 * Enqueue and localize the compiled launcher adapter.
	 *
	 * @param string $where_to_load Booking Calendar asset context.
	 *
	 * @return void
	 */
	public static function enqueue_scripts( $where_to_load ) {
		if ( self::$assets_configured || ! in_array( $where_to_load, array( 'admin', 'both' ), true ) || ! self::should_render() ) {
			return;
		}

		$script_path = __DIR__ . '/_out/first-run-launcher.js';
		$version     = file_exists( $script_path ) ? (string) filemtime( $script_path ) : WP_BK_VERSION_NUM;
		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			wpbc_plugin_url( '/includes/page-setup-wizard/first-run-launcher/_out/first-run-launcher.js' ),
			array( 'jquery', 'wp-util', 'wpbc-modal' ),
			$version,
			true
		);
		wp_localize_script(
			self::SCRIPT_HANDLE,
			'wpbc_setup_wizard_first_run_launcher_vars',
			array(
				'ajax_url'                         => admin_url( 'admin-ajax.php', 'relative' ),
				'action'                           => self::AJAX_ACTION,
				'nonce'                            => wp_create_nonce( self::NONCE_ACTION ),
				'setup_url'                        => wpbc_get_setup_wizard_page_url(),
				'show'                             => true,
				'show_booking_pages_after_dismiss' => WPBC_Setup_Wizard_Booking_Pages::can_follow_setup_prompt(),
			)
		);

		self::$assets_configured = true;
	}

	/**
	 * Enqueue the compiled launcher presentation.
	 *
	 * @param string $where_to_load Booking Calendar asset context.
	 *
	 * @return void
	 */
	public static function enqueue_styles( $where_to_load ) {
		if ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) || ! self::should_render() ) {
			return;
		}

		$style_path = __DIR__ . '/_out/first-run-launcher.css';
		$version    = file_exists( $style_path ) ? (string) filemtime( $style_path ) : WP_BK_VERSION_NUM;
		wp_enqueue_style(
			self::STYLE_HANDLE,
			wpbc_plugin_url( '/includes/page-setup-wizard/first-run-launcher/_out/first-run-launcher.css' ),
			array(),
			$version
		);
	}

	/**
	 * Render the fixed launcher template in the Booking Listing footer.
	 *
	 * @param string $page Booking Calendar footer context.
	 *
	 * @return void
	 */
	public static function render_template( $page ) {
		if ( 'wpbc-ajx_booking' !== $page || ! self::should_render() ) {
			return;
		}

		$template_path = __DIR__ . '/templates/first-run-popup-wptpl.php';
		if ( is_readable( $template_path ) ) {
			require $template_path;
		}
	}

	/**
	 * Persist that the one-time invitation must not be shown again.
	 *
	 * @return void
	 */
	public static function ajax_dismiss() {
		if ( ! check_ajax_referer( self::NONCE_ACTION, 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Security check failed.', 'booking' ) ), 403 );
		}

		if ( ! WPBC_Setup_Wizard_Access::current_user_can_access() ) {
			wp_send_json_error( array( 'message' => __( 'You do not have access to Initial Setup.', 'booking' ) ), 403 );
		}

		if ( WPBC_Setup_Wizard_First_Install_State::is_automatic_onboarding_restricted() ) {
			wp_send_json_error( array( 'message' => __( 'The Initial Setup prompt is not available in this environment.', 'booking' ) ), 409 );
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above with check_ajax_referer().
		$choice = isset( $_POST['choice'] ) && is_scalar( $_POST['choice'] )
			// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified above with check_ajax_referer().
			? sanitize_key( wp_unslash( $_POST['choice'] ) )
			: '';
		if ( ! in_array( $choice, array( 'dismiss', 'start' ), true ) ) {
			wp_send_json_error( array( 'message' => __( 'The Initial Setup choice is not valid.', 'booking' ) ), 400 );
		}

		if ( ! WPBC_Setup_Wizard_First_Install_State::is_initial_install_site() ) {
			wp_send_json_error( array( 'message' => __( 'The Initial Setup prompt is not available for this installation.', 'booking' ) ), 409 );
		}

		update_bk_option( 'booking_setup_wizard_first_run_prompt', 'Off' );
		if ( 'Off' !== get_bk_option( 'booking_setup_wizard_first_run_prompt' ) ) {
			wp_send_json_error( array( 'message' => __( 'The Initial Setup choice could not be saved.', 'booking' ) ), 500 );
		}

		wp_send_json_success( array( 'choice' => $choice ) );
	}
}
