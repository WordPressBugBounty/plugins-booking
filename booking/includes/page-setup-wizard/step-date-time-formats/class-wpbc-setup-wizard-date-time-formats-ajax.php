<?php
/**
 * Explicit Local translation mutation for Setup Wizard Step 3.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Authorize and orchestrate the Step 3 Local translation installation.
 */
final class WPBC_Setup_Wizard_Date_Time_Formats_Ajax {

	const ACTION_INSTALL_LOCAL_TRANSLATION = 'WPBC_AJX_SETUP_WIZARD_INSTALL_LOCAL_TRANSLATION';

	/**
	 * Register the authenticated mutation endpoint.
	 *
	 * @return void
	 */
	public static function register() {
		add_action( 'wp_ajax_' . self::ACTION_INSTALL_LOCAL_TRANSLATION, array( __CLASS__, 'install_local_translation' ) );
	}

	/**
	 * Update the complete Local archive and select Local as the preferred source.
	 *
	 * @return void Sends a WordPress JSON response and terminates the request.
	 */
	public static function install_local_translation() {
		self::authorize_request();

		$request_id = self::get_request_id();
		$service    = new WPBC_Setup_Wizard_Date_Time_Formats();
		$result     = $service->install_site_local_translation();

		if ( is_wp_error( $result ) ) {
			$error_data = $result->get_error_data();
			$error_logs = is_array( $error_data ) && isset( $error_data['logs'] ) && is_array( $error_data['logs'] )
				? $error_data['logs']
				: array();

			wp_send_json_error(
				array(
					'code'       => $result->get_error_code(),
					'message'    => $result->get_error_message(),
					'logs'       => $error_logs,
					'language'   => self::get_language_response( $service->get_site_language_context() ),
					'request_id' => $request_id,
				),
				400
			);
		}

		wp_send_json_success(
			array(
				'language'   => self::get_language_response( $result ),
				'message'    => $result['message'],
				'logs'       => isset( $result['logs'] ) && is_array( $result['logs'] ) ? $result['logs'] : array(),
				'reload_page' => true,
				'request_id' => $request_id,
			)
		);
	}

	/**
	 * Normalize the authorized language presentation sent to the browser.
	 *
	 * @param array<string,mixed> $language_context Server-derived language context.
	 * @return array<string,mixed> Stable, data-only browser response.
	 */
	private static function get_language_response( array $language_context ) {
		return array(
			'locale'                      => isset( $language_context['locale'] ) ? (string) $language_context['locale'] : '',
			'label'                       => isset( $language_context['label'] ) ? (string) $language_context['label'] : '',
			'status'                      => isset( $language_context['status'] ) ? (string) $language_context['status'] : '',
			'status_label'                => isset( $language_context['status_label'] ) ? (string) $language_context['status_label'] : '',
			'help'                        => isset( $language_context['help'] ) ? (string) $language_context['help'] : '',
			'translation_source'          => isset( $language_context['translation_source'] ) ? (string) $language_context['translation_source'] : '',
			'translation_source_label'    => isset( $language_context['translation_source_label'] ) ? (string) $language_context['translation_source_label'] : '',
			'is_local_source_recommended' => ! empty( $language_context['is_local_source_recommended'] ),
			'local_source_recommendation' => isset( $language_context['local_source_recommendation'] ) ? (string) $language_context['local_source_recommendation'] : '',
			'action_label'                => isset( $language_context['action_label'] ) ? (string) $language_context['action_label'] : '',
		);
	}

	/**
	 * Enforce the nonce, production wizard access, capability, and demo policy.
	 *
	 * @return void Sends an error response when authorization fails.
	 */
	private static function authorize_request() {
		if ( ! WPBC_Setup_Wizard_Ajax::verify_request_nonce() ) {
			wp_send_json_error( array( 'message' => __( 'Your Setup Wizard session expired. Reload the page and try again.', 'booking' ) ), 403 );
		}

		if ( ! WPBC_Setup_Wizard_Access::current_user_can_access() || ! current_user_can( 'activate_plugins' ) ) {
			wp_send_json_error( array( 'message' => __( 'You are not allowed to install Booking Calendar translations.', 'booking' ) ), 403 );
		}

		if ( function_exists( 'wpbc_is_this_demo' ) && wpbc_is_this_demo() ) {
			wp_send_json_error( array( 'message' => __( 'Local translation downloads are unavailable on live demo sites.', 'booking' ) ), 403 );
		}
	}

	/**
	 * Read a request correlation identifier without accepting domain input.
	 *
	 * @return string Sanitized request identifier.
	 */
	private static function get_request_id() {
		if ( ! isset( $_POST['request_id'] ) || ! is_scalar( $_POST['request_id'] ) ) {
			return '';
		}

		return sanitize_key( wp_unslash( $_POST['request_id'] ) );
	}
}
