<?php
/**
 * AJAX read and mutation boundary for the reusable Days Off editor.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Authorize, validate, and normalize scoped reads and canonical writes.
 */
final class WPBC_Setup_Wizard_Days_Off_Ajax {

	const ACTION_MUTATE = 'WPBC_AJX_SETUP_WIZARD_DAYS_OFF_MUTATE';
	const ACTION_LOAD   = 'WPBC_AJX_SETUP_WIZARD_DAYS_OFF_LOAD';

	/**
	 * Register the authenticated scoped-read endpoint.
	 *
	 * @return void
	 */
	public static function register() {
		add_action( 'wp_ajax_' . self::ACTION_LOAD, array( __CLASS__, 'load' ) );
	}

	/**
	 * Load canonical unavailable dates for one authorized Resource scope.
	 *
	 * @return void Sends a JSON response and terminates.
	 */
	public static function load() {
		$days_off   = self::authorize_request();
		$scope      = self::get_request_string( 'scope' );
		$request_id = substr( sanitize_key( self::get_request_string( 'request_id' ) ), 0, 80 );
		$result     = $days_off->get_state( $scope );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error(
				array(
					'code'       => $result->get_error_code(),
					'message'    => $result->get_error_message(),
					'request_id' => $request_id,
				),
				400
			);
		}

		wp_send_json_success(
			array(
				'state'      => $result,
				'request_id' => $request_id,
			)
		);
	}

	/**
	 * Apply one explicit Add/Delete range request.
	 *
	 * @return void Sends a JSON response and terminates.
	 */
	public static function mutate() {
		$days_off   = self::authorize_request();
		$view_scope = self::get_request_string( 'view_scope' );
		if ( '' === $view_scope ) {
			$view_scope = 'all';
		}

		$result = $days_off->mutate_range(
			self::get_request_string( 'operation' ),
			self::get_request_string( 'scope' ),
			self::get_request_string( 'first_date' ),
			self::get_request_string( 'last_date' ),
			self::get_request_string( 'revision' ),
			$view_scope
		);
		$request_id = substr( sanitize_key( self::get_request_string( 'request_id' ) ), 0, 80 );

		if ( is_wp_error( $result ) ) {
			$error_data = $result->get_error_data();
			$response   = array(
				'code'       => $result->get_error_code(),
				'message'    => $result->get_error_message(),
				'request_id' => $request_id,
			);
			if ( is_array( $error_data ) && isset( $error_data['state'] ) && is_array( $error_data['state'] ) ) {
				$response['state'] = $error_data['state'];
			}
			$status = 'wpbc_setup_wizard_days_off_stale_state' === $result->get_error_code() ? 409 : 400;
			wp_send_json_error( $response, $status );
		}

		wp_send_json_success(
			array(
				'state'      => $result,
				'operation'  => self::get_request_string( 'operation' ),
				'request_id' => $request_id,
			)
		);
	}

	/**
	 * Verify the shared wizard nonce, page access, and Availability policy.
	 *
	 * @return WPBC_Setup_Wizard_Days_Off Authorized domain service.
	 */
	private static function authorize_request() {
		if ( ! WPBC_Setup_Wizard_Ajax::verify_request_nonce() ) {
			wp_send_json_error( array( 'message' => __( 'Your Setup Wizard session expired. Reload the page and try again.', 'booking' ) ), 403 );
		}
		if ( ! WPBC_Setup_Wizard_Access::current_user_can_access() ) {
			wp_send_json_error( array( 'message' => __( 'You are not allowed to use this Setup Wizard.', 'booking' ) ), 403 );
		}
		$days_off = new WPBC_Setup_Wizard_Days_Off();
		if ( ! $days_off->current_user_can_manage() ) {
			wp_send_json_error( array( 'message' => __( 'You are not allowed to change date availability.', 'booking' ) ), 403 );
		}

		return $days_off;
	}

	/**
	 * Read one scalar request value without accepting arrays or objects.
	 *
	 * @param string $key Request field.
	 *
	 * @return string Sanitized value.
	 */
	private static function get_request_string( $key ) {
		if ( ! isset( $_POST[ $key ] ) || ! is_scalar( $_POST[ $key ] ) ) {
			return '';
		}

		return sanitize_text_field( wp_unslash( $_POST[ $key ] ) );
	}
}
