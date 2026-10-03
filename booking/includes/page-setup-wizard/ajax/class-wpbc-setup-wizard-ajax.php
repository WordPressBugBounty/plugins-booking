<?php
/**
 * AJAX endpoints for Setup Wizard checkpoint saving and navigation.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Orchestrate nonce-protected, authorized, data-only checkpoint requests.
 */
final class WPBC_Setup_Wizard_Ajax {

	const ACTION_SAVE_CONTINUE = 'WPBC_AJX_SETUP_WIZARD_SAVE_CONTINUE';
	const ACTION_BACK          = 'WPBC_AJX_SETUP_WIZARD_BACK';
	const ACTION_EDIT          = 'WPBC_AJX_SETUP_WIZARD_EDIT';
	const ACTION_RESTART       = 'WPBC_AJX_SETUP_WIZARD_RESTART';
	const ACTION_SKIP          = 'WPBC_AJX_SETUP_WIZARD_SKIP';
	const NONCE_ACTION         = 'wpbc_setup_wizard_nonce';

	/**
	 * Register authenticated endpoints while the module gate is enabled.
	 *
	 * @return void
	 */
	public static function register() {
		add_action( 'wp_ajax_' . self::ACTION_SAVE_CONTINUE, array( __CLASS__, 'save_and_continue' ) );
		add_action( 'wp_ajax_' . self::ACTION_BACK, array( __CLASS__, 'navigate_back' ) );
		add_action( 'wp_ajax_' . self::ACTION_EDIT, array( __CLASS__, 'edit_step' ) );
		add_action( 'wp_ajax_' . self::ACTION_RESTART, array( __CLASS__, 'restart' ) );
		add_action( 'wp_ajax_' . self::ACTION_SKIP, array( __CLASS__, 'skip_setup' ) );
	}

	/**
	 * Verify the production Setup Wizard nonce.
	 *
	 * @return bool True when the request contains a recognized valid nonce.
	 */
	public static function verify_request_nonce() {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- This method performs the nonce verification.
		if ( ! isset( $_REQUEST['nonce'] ) || ! is_scalar( $_REQUEST['nonce'] ) ) {
			return false;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- This method performs the nonce verification.
		$nonce = sanitize_text_field( wp_unslash( $_REQUEST['nonce'] ) );
		return (bool) wp_verify_nonce( $nonce, self::NONCE_ACTION );
	}

	/**
	 * Save one validated step through the progressive coordinator and continue.
	 *
	 * @return void Sends a WordPress JSON response and terminates the request.
	 */
	public static function save_and_continue() {
		self::authorize_request();

		$current_step_id   = self::get_request_string( 'current_step' );
		$expected_revision = self::get_request_integer( 'expected_revision' );
		$operation_id      = self::get_request_string( 'operation_id' );
		$request_id        = self::get_request_string( 'request_id' );
		$submitted_fields  = self::get_request_fields();
		$services          = self::get_services();
		$result            = $services['coordinator']->save_and_continue( $current_step_id, $expected_revision, $submitted_fields, $operation_id );

		self::send_result( $result, $request_id, self::get_page_url() );
	}

	/**
	 * Navigate backward without saving or validating current form fields.
	 *
	 * @return void Sends a WordPress JSON response and terminates the request.
	 */
	public static function navigate_back() {
		self::authorize_request();

		$current_step_id   = self::get_request_string( 'current_step' );
		$expected_revision = self::get_request_integer( 'expected_revision' );
		$request_id        = self::get_request_string( 'request_id' );
		$updated_draft     = self::get_draft_store()->navigate_back( $current_step_id, $expected_revision );

		self::send_result( $updated_draft, $request_id, self::get_page_url() );
	}

	/**
	 * Navigate from the journey rail or review plan to one earlier active step.
	 *
	 * @return void Sends a WordPress JSON response and terminates the request.
	 */
	public static function edit_step() {
		self::authorize_request();

		$target_step_id    = self::get_request_string( 'target_step' );
		$current_step_id   = self::get_request_string( 'current_step' );
		$expected_revision = self::get_request_integer( 'expected_revision' );
		$request_id        = self::get_request_string( 'request_id' );
		$updated_draft     = self::get_draft_store()->navigate_to_step( $target_step_id, $current_step_id, $expected_revision );

		self::send_result( $updated_draft, $request_id, self::get_page_url() );
	}

	/**
	 * Restart wizard navigation without claiming a settings rollback.
	 *
	 * @return void Sends a WordPress JSON response and terminates the request.
	 */
	public static function restart() {
		self::authorize_request();

		if ( 'restart' !== self::get_request_string( 'confirmation' ) ) {
			wp_send_json_error( array( 'message' => __( 'Confirm that you want to restart Setup Wizard navigation.', 'booking' ) ), 400 );
		}

		$expected_revision = self::get_request_integer( 'expected_revision' );
		$request_id        = self::get_request_string( 'request_id' );
		$updated_draft     = self::get_draft_store()->restart( $expected_revision );

		self::send_result( $updated_draft, $request_id, self::get_page_url() );
	}

	/**
	 * Skip remaining steps, complete the checkpoint, and open Setup overview.
	 *
	 * This action intentionally does not save unsaved current-page fields or run
	 * step mutation handlers. Previously completed progressive saves remain live.
	 *
	 * @return void Sends a WordPress JSON response and terminates the request.
	 */
	public static function skip_setup() {
		self::authorize_request();

		if ( 'skip' !== self::get_request_string( 'confirmation' ) ) {
			wp_send_json_error( array( 'message' => __( 'Confirm that you want to skip the remaining steps and exit the Setup Wizard.', 'booking' ) ), 400 );
		}

		$current_step_id   = self::get_request_string( 'current_step' );
		$expected_revision = self::get_request_integer( 'expected_revision' );
		$request_id        = self::get_request_string( 'request_id' );
		$updated_draft     = self::get_draft_store()->complete_with_skipped_steps( $current_step_id, $expected_revision );

		self::send_result( $updated_draft, $request_id, self::get_page_url() );
	}

	/**
	 * Verify the fixed nonce and the complete server-side access boundary.
	 *
	 * @return void Sends an error response when authorization fails.
	 */
	private static function authorize_request() {
		if ( ! self::verify_request_nonce() ) {
			wp_send_json_error( array( 'message' => __( 'Your Setup Wizard session expired. Reload the page and try again.', 'booking' ) ), 403 );
		}

		if ( ! WPBC_Setup_Wizard_Access::current_user_can_access() ) {
			wp_send_json_error( array( 'message' => __( 'You are not allowed to use this Setup Wizard.', 'booking' ) ), 403 );
		}
	}

	/**
	 * Create a checkpoint store bound to the current authorized request context.
	 *
	 * @return WPBC_Setup_Wizard_Draft_Store Draft persistence service.
	 */
	private static function get_draft_store() {
		$services = self::get_services();

		return $services['checkpoint_store'];
	}

	/**
	 * Build shared request services around one registry and validator instance.
	 *
	 * @return array{checkpoint_store:WPBC_Setup_Wizard_Draft_Store,coordinator:WPBC_Setup_Wizard_Progressive_Save_Coordinator} Request services.
	 */
	private static function get_services() {
		$module_registry  = new WPBC_Setup_Wizard_Step_Module_Registry();
		$step_data        = new WPBC_Setup_Wizard_Step_Data( $module_registry );
		$step_registry    = new WPBC_Setup_Wizard_Step_Registry( $module_registry );
		$draft_validator  = new WPBC_Setup_Wizard_Draft_Validator( $step_data );
		$checkpoint_store = new WPBC_Setup_Wizard_Draft_Store( $step_registry, $draft_validator );

		return array(
			'checkpoint_store' => $checkpoint_store,
			'coordinator'      => WPBC_Setup_Wizard_Progressive_Save_Factory::create_coordinator(
				$checkpoint_store,
				$draft_validator,
				$step_registry
			),
		);
	}

	/**
	 * Read the current step field collection before domain validation.
	 *
	 * The draft validator owns sanitization and the exact per-step allow-list.
	 * Non-array input becomes empty and cannot bypass forward validation.
	 *
	 * @return array<string,mixed> Unslashed request fields.
	 */
	private static function get_request_fields() {
		if ( ! isset( $_POST['fields'] ) || ! is_array( $_POST['fields'] ) ) {
			return array();
		}

		return wp_unslash( $_POST['fields'] );
	}

	/**
	 * Read and sanitize one scalar request string.
	 *
	 * @param string $key Request field name.
	 *
	 * @return string Sanitized string, or an empty string when absent or invalid.
	 */
	private static function get_request_string( $key ) {
		if ( ! isset( $_POST[ $key ] ) || ! is_scalar( $_POST[ $key ] ) ) {
			return '';
		}

		return sanitize_text_field( wp_unslash( $_POST[ $key ] ) );
	}

	/**
	 * Read one non-negative integer request value.
	 *
	 * @param string $key Request field name.
	 *
	 * @return int Sanitized integer.
	 */
	private static function get_request_integer( $key ) {
		if ( ! isset( $_POST[ $key ] ) || ! is_scalar( $_POST[ $key ] ) ) {
			return -1;
		}

		return absint( wp_unslash( $_POST[ $key ] ) );
	}

	/**
	 * Build the canonical Setup Wizard URL without client input.
	 *
	 * @return string Administration URL for the Setup Wizard.
	 */
	private static function get_page_url() {
		return wpbc_get_setup_wizard_page_url();
	}

	/**
	 * Send a normalized data-only success or error response.
	 *
	 * @param array<string,mixed>|WP_Error $result       Service result.
	 * @param string                       $request_id   Client request correlation identifier.
	 * @param string                       $redirect_url Server-owned destination URL.
	 * @return void Sends a WordPress JSON response and terminates the request.
	 */
	private static function send_result( $result, $request_id, $redirect_url ) {
		if ( is_wp_error( $result ) ) {
			$status = 400;
			if ( 0 === strpos( $result->get_error_code(), 'wpbc_setup_wizard_stale_' ) || 'wpbc_setup_wizard_operation_locked' === $result->get_error_code() ) {
				$status = 409;
			} elseif ( in_array( $result->get_error_code(), array( 'wpbc_setup_wizard_validation_failed', 'wpbc_setup_wizard_review_invalid' ), true ) ) {
				$status = 422;
			}

			$error_data     = $result->get_error_data();
			$field_errors   = is_array( $error_data ) && isset( $error_data['field_errors'] ) && is_array( $error_data['field_errors'] )
				? $error_data['field_errors']
				: array();
			$invalid_step_id = is_array( $error_data ) && isset( $error_data['invalid_step_id'] )
				? sanitize_key( (string) $error_data['invalid_step_id'] )
				: '';

			wp_send_json_error(
				array(
					'code'            => $result->get_error_code(),
					'message'         => $result->get_error_message(),
					'field_errors'    => $field_errors,
					'invalid_step_id' => $invalid_step_id,
					'request_id'      => sanitize_key( $request_id ),
				),
				$status
			);
		}

		$idempotent_replay = is_array( $result ) && isset( $result['checkpoint'], $result['idempotent_replay'] );
		$checkpoint        = $idempotent_replay ? $result['checkpoint'] : $result;

		wp_send_json_success(
			array(
				'checkpoint'       => array(
					'status'             => $checkpoint['status'],
					'current_step'       => $checkpoint['current_step'],
					'completed_steps'    => $checkpoint['completed_steps'],
					'needs_review_steps' => $checkpoint['needs_review_steps'],
					'revision'           => (int) $checkpoint['revision'],
				),
				'redirect_url'      => esc_url_raw( $redirect_url ),
				'idempotent_replay' => $idempotent_replay ? (bool) $result['idempotent_replay'] : false,
				'request_id'        => sanitize_key( $request_id ),
			)
		);
	}
}
