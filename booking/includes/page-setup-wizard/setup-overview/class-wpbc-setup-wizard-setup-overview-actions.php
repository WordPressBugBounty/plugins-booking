<?php
/**
 * State-changing actions launched from the completed Setup overview.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handle nonce-protected wizard reopening and restart operations.
 */
final class WPBC_Setup_Wizard_Setup_Overview_Actions {

	/** Authenticated WordPress action used to reopen an allow-listed wizard step. */
	const ACTION_REOPEN_STEP = 'wpbc_setup_wizard_overview_reopen_step';

	/** Authenticated WordPress action used to restart wizard navigation. */
	const ACTION_RESTART     = 'wpbc_setup_wizard_overview_restart';

	/** Shared nonce action for completed-overview mutations. */
	const NONCE_ACTION       = 'wpbc_setup_wizard_overview_action';

	/** Request field carrying the completed-overview nonce. */
	const NONCE_NAME         = 'wpbc_setup_wizard_overview_nonce';

	/**
	 * Register authenticated WordPress action endpoints.
	 *
	 * @return void
	 */
	public static function register() {
		add_action( 'admin_post_' . self::ACTION_REOPEN_STEP, array( __CLASS__, 'reopen_step' ) );
		add_action( 'admin_post_' . self::ACTION_RESTART, array( __CLASS__, 'restart' ) );
	}

	/**
	 * Reopen one explicitly allow-listed earlier step from a completed overview.
	 *
	 * @return void
	 */
	public static function reopen_step() {
		self::authorize_request();

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified by authorize_request().
		$target_step_id = isset( $_POST['target_step_id'] ) && is_scalar( $_POST['target_step_id'] ) ? sanitize_key( wp_unslash( $_POST['target_step_id'] ) ) : '';
		$allowed_steps  = array( 'customer_journey' );
		if ( ! in_array( $target_step_id, $allowed_steps, true ) ) {
			self::redirect_with_notice( 'error' );
		}

		$draft_store = self::create_draft_store();
		$checkpoint  = $draft_store->load();
		if ( 'completed' !== $checkpoint['status'] ) {
			self::redirect_to_setup_page();
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified by authorize_request().
		$expected_revision = isset( $_POST['expected_revision'] ) && is_scalar( $_POST['expected_revision'] ) ? absint( wp_unslash( $_POST['expected_revision'] ) ) : -1;
		$result            = $draft_store->navigate_to_step( $target_step_id, $checkpoint['current_step'], $expected_revision );
		if ( is_wp_error( $result ) ) {
			self::redirect_with_notice( self::is_stale_error( $result ) ? 'stale' : 'error' );
		}

		self::redirect_to_setup_page();
	}

	/**
	 * Start a fresh wizard navigation pass without rolling back live settings.
	 *
	 * @return void
	 */
	public static function restart() {
		self::authorize_request();

		$draft_store = self::create_draft_store();
		$checkpoint  = $draft_store->load();
		if ( 'completed' !== $checkpoint['status'] ) {
			self::redirect_to_setup_page();
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Verified by authorize_request().
		$expected_revision = isset( $_POST['expected_revision'] ) && is_scalar( $_POST['expected_revision'] ) ? absint( wp_unslash( $_POST['expected_revision'] ) ) : -1;
		$result            = $draft_store->restart( $expected_revision );
		if ( is_wp_error( $result ) ) {
			self::redirect_with_notice( self::is_stale_error( $result ) ? 'stale' : 'error' );
		}

		self::redirect_to_setup_page();
	}

	/**
	 * Enforce login capability and the shared overview nonce.
	 *
	 * @return void
	 */
	private static function authorize_request() {
		if ( ! WPBC_Setup_Wizard_Access::current_user_can_access() ) {
			wp_die(
				esc_html__( 'You are not allowed to change this Setup Wizard.', 'booking' ),
				esc_html__( 'Access denied', 'booking' ),
				array( 'response' => 403 )
			);
		}

		$request_method = isset( $_SERVER['REQUEST_METHOD'] ) && is_scalar( $_SERVER['REQUEST_METHOD'] )
			? strtoupper( sanitize_text_field( wp_unslash( $_SERVER['REQUEST_METHOD'] ) ) )
			: '';
		if ( 'POST' !== $request_method ) {
			wp_die(
				esc_html__( 'This Setup Wizard action requires a form submission.', 'booking' ),
				esc_html__( 'Invalid request method', 'booking' ),
				array( 'response' => 405 )
			);
		}

		check_admin_referer( self::NONCE_ACTION, self::NONCE_NAME );
	}

	/**
	 * Create the owner/site-scoped checkpoint store used by overview actions.
	 *
	 * @return WPBC_Setup_Wizard_Draft_Store Checkpoint store.
	 */
	private static function create_draft_store() {
		$module_registry = new WPBC_Setup_Wizard_Step_Module_Registry();
		$step_registry   = new WPBC_Setup_Wizard_Step_Registry( $module_registry );
		$step_data       = new WPBC_Setup_Wizard_Step_Data( $module_registry );

		return new WPBC_Setup_Wizard_Draft_Store( $step_registry, new WPBC_Setup_Wizard_Draft_Validator( $step_data ) );
	}

	/**
	 * Determine whether an operation failed because the client checkpoint was stale.
	 *
	 * @param WP_Error $error Setup Wizard operation error.
	 *
	 * @return bool True for a stale revision or stale step error.
	 */
	private static function is_stale_error( WP_Error $error ) {
		return 0 === strpos( (string) $error->get_error_code(), 'wpbc_setup_wizard_stale_' );
	}

	/**
	 * Redirect to the canonical Setup Wizard menu URL and stop execution.
	 *
	 * @return void
	 */
	private static function redirect_to_setup_page() {
		wp_safe_redirect( wpbc_get_setup_wizard_page_url() );
		exit;
	}

	/**
	 * Redirect a bounded error code to the completed overview.
	 *
	 * @param string $notice_code Allow-listed presentation notice code.
	 *
	 * @return void
	 */
	private static function redirect_with_notice( $notice_code ) {
		$notice_code = in_array( $notice_code, array( 'stale', 'error' ), true ) ? $notice_code : 'error';
		wp_safe_redirect(
			add_query_arg(
				'wpbc_setup_overview_notice',
				$notice_code,
				wpbc_get_setup_wizard_page_url()
			)
		);
		exit;
	}
}
