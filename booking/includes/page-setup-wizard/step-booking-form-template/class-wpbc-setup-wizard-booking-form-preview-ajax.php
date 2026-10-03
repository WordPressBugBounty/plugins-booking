<?php
/**
 * Interactive Booking Form template preview endpoint for Setup Wizard Page 10.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return authorized inline or signed URL previews without saving forms.
 */
final class WPBC_Setup_Wizard_Booking_Form_Preview_Ajax {

	const ACTION = 'WPBC_AJX_SETUP_WIZARD_BOOKING_FORM_PREVIEW';

	/**
	 * Register the authenticated preview endpoint.
	 *
	 * @return void
	 */
	public static function register() {
		add_action( 'wp_ajax_' . self::ACTION, array( __CLASS__, 'create_preview' ) );
	}

	/**
	 * Resolve an allow-listed template, entry point, and target into preview data.
	 *
	 * Embedded Direct previews are request-local. Date Selection is read from
	 * canonical settings saved by the prior step. Appointment Flow and explicit
	 * new-window previews write only the existing ten-minute preview transient.
	 * No path calls the Form Builder save endpoint or imports, publishes, or
	 * assigns the selected template.
	 *
	 * @return void Sends a WordPress JSON response and terminates the request.
	 */
	public static function create_preview() {
		self::authorize_request();

		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- validated against the exact current server registry allow-list below.
		$raw_template_slug = isset( $_POST['template_slug'] ) && is_scalar( $_POST['template_slug'] )
			? wp_unslash( $_POST['template_slug'] )
			: '';
		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- validated against the exact server-owned usage allow-list below.
		$raw_booking_form_usage = isset( $_POST['booking_form_usage'] ) && is_scalar( $_POST['booking_form_usage'] )
			? wp_unslash( $_POST['booking_form_usage'] )
			: '';
		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- validated against the coordinator's exact target allow-list below.
		$raw_preview_target = isset( $_POST['preview_target'] ) && is_scalar( $_POST['preview_target'] )
			? wp_unslash( $_POST['preview_target'] )
			: '';
		$booking_form_context = self::get_booking_form_context();
		$preview = ( new WPBC_Setup_Wizard_Booking_Form_Preview() )->build_preview(
			$raw_template_slug,
			$raw_booking_form_usage,
			$raw_preview_target,
			array(),
			$booking_form_context
		);

		if ( is_wp_error( $preview ) ) {
			self::send_preview_error( $preview );
		}

		wp_send_json_success( $preview );
	}

	/**
	 * Load the current owner/site checkpoint for preview-only projection.
	 *
	 * The browser may choose an allow-listed template and target, but it never
	 * supplies Customer Journey or time choices. Reading those values from the
	 * current checkpoint keeps preview authorization and the eventual save on
	 * the same server-owned context.
	 *
	 * @return array{customer_journey:string,start_end_times:mixed,time_format:string} Preview projection context.
	 */
	private static function get_booking_form_context() {
		$module_registry  = new WPBC_Setup_Wizard_Step_Module_Registry();
		$step_registry    = new WPBC_Setup_Wizard_Step_Registry( $module_registry );
		$step_data        = new WPBC_Setup_Wizard_Step_Data( $module_registry );
		$checkpoint_store = new WPBC_Setup_Wizard_Draft_Store(
			$step_registry,
			new WPBC_Setup_Wizard_Draft_Validator( $step_data )
		);
		$checkpoint       = $checkpoint_store->load();
		$wizard_values    = isset( $checkpoint['values'] ) && is_array( $checkpoint['values'] )
			? $checkpoint['values']
			: array();

		return ( new WPBC_Setup_Wizard_Booking_Form_Time_Options() )->get_context_from_values( $wizard_values );
	}

	/**
	 * Send one normalized preview error without exposing internal exceptions.
	 *
	 * @param WP_Error $preview_error Validated preview error.
	 *
	 * @return void Sends a WordPress JSON response and terminates the request.
	 */
	private static function send_preview_error( WP_Error $preview_error ) {
		$error_data = $preview_error->get_error_data();
		$status     = is_array( $error_data ) && isset( $error_data['status'] )
			? absint( $error_data['status'] )
			: 400;
		$status     = in_array( $status, array( 400, 403, 404, 500, 503 ), true ) ? $status : 400;

		wp_send_json_error(
			array(
				'code'    => $preview_error->get_error_code(),
				'message' => $preview_error->get_error_message(),
			),
			$status
		);
	}

	/**
	 * Enforce the Setup Wizard nonce and complete production access policy.
	 *
	 * @return void Sends an error response when authorization fails.
	 */
	private static function authorize_request() {
		if ( ! WPBC_Setup_Wizard_Ajax::verify_request_nonce() ) {
			wp_send_json_error( array( 'message' => __( 'Your Setup Wizard session expired. Reload the page and try again.', 'booking' ) ), 403 );
		}

		if ( ! WPBC_Setup_Wizard_Access::current_user_can_access() ) {
			wp_send_json_error( array( 'message' => __( 'You are not allowed to preview booking forms.', 'booking' ) ), 403 );
		}
	}

}
