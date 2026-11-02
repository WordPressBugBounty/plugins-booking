<?php
/**
 * Canonical creation lifecycle adapter for Add New Booking Inspector.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Converts one revalidated plan into the released wpbc_booking_save() contract.
 */
final class WPBC_Booking_New_Inspector_Creation_Service {

	/** @var object Authoritative readback repository. */
	private $creation_repository;

	/**
	 * Construct the service.
	 *
	 * @param object|null $creation_repository Optional marker readback repository.
	 */
	public function __construct( $creation_repository = null ) {
		$this->creation_repository = $creation_repository ? $creation_repository : new WPBC_Booking_New_Inspector_Creation_Repository();
	}

	/**
	 * Invoke the canonical lifecycle once and resolve ambiguous persisted results.
	 *
	 * @param array<string,mixed> $revalidated Fresh Phase 8 revalidation result.
	 * @param array<string,mixed> $plan        Verified signed plan.
	 * @param string              $marker      Server-derived persistence marker.
	 * @return array<string,mixed>|WP_Error Created booking, warnings, and lifecycle result.
	 */
	public function create( $revalidated, $plan, $marker ) {
		if ( ! function_exists( 'wpbc_booking_save' ) ) {
			return new WP_Error( 'wpbc_booking_new_inspector_lifecycle_unavailable', __( 'The booking creation service is unavailable. Reload the page and try again.', 'booking' ), array( 'status' => 503 ) );
		}
		$context  = $revalidated['context'];
		$schedule = $context['schedule'];
		$dates    = array_map( array( $this, 'convert_iso_date_to_display_date' ), (array) $schedule['selected_dates'] );
		$dates    = array_values( array_filter( $dates ) );
		if ( ! $dates ) {
			return new WP_Error( 'wpbc_booking_new_inspector_schedule_invalid', __( 'Select at least one valid booking date.', 'booking' ), array( 'status' => 400 ) );
		}
		$is_timed = 'full_day' !== (string) $schedule['time_application'];
		$request  = array(
			'resource_id'                  => absint( $context['resource']['id'] ),
			'dates_ddmmyy_csv'             => implode( ', ', $dates ),
			'form_data'                    => (string) $context['canonical_form_data'],
			'booking_hash'                 => '',
			'custom_form'                  => 'standard' === (string) $context['form']['id'] ? '' : (string) $context['form']['id'],
			'is_emails_send'               => $this->resolve_email_intent( (string) $plan['workflow']['email_intent'] ),
			'is_show_payment_form'         => 0,
			'user_id'                      => function_exists( 'wpbc_get_current_user_id' ) ? absint( wpbc_get_current_user_id() ) : get_current_user_id(),
			'request_uri'                  => function_exists( 'wpbc_get_bookings_url' ) ? wpbc_get_bookings_url() : admin_url(),
			'allow_past'                   => WPBC_Booking_New_Inspector_Schedule_Policy::permits_past_dates() ? 1 : 0,
			'is_approve_booking'           => 0,
			'save_booking_even_if_unavailable' => 0,
			'is_use_booking_recurrent_time' => 'per_date' === (string) $schedule['time_application'] ? 1 : 0,
			'form_status'                  => 'published',
			'wpbc_admin_booking_nonce'     => wp_create_nonce( 'wpbc_admin_booking_create' ),
			'wpbc_admin_cost_correction'   => 'corrected' === (string) $plan['cost']['intent'] ? (string) $plan['cost']['corrected_cost'] : '',
			'wpbc_server_creation_context' => array(
				'idempotency_marker' => $marker,
				'purpose'            => 'booking_new_inspector_apply',
				'notes'              => isset( $plan['notes'] ) && is_array( $plan['notes'] ) ? $plan['notes'] : array(),
			),
		);
		if ( $is_timed ) {
			$request['wpbc_time_override_enabled'] = 1;
			$request['wpbc_time_override_source']  = WPBC_Booking_New_Inspector_Schedule_Policy::resolve_time_override_source( (string) $schedule['time_application'] );
			$request['wpbc_time_override_start']   = (string) $schedule['start_time'];
			$request['wpbc_time_override_end']     = (string) $schedule['end_time'];
		}

		try {
			$lifecycle_result = wpbc_booking_save( $request );
		} catch ( Throwable $throwable ) {
			$lifecycle_result = array(
				'ajx_data' => array(
					'status'                   => 'error',
					'status_error'             => 'booking_lifecycle_interrupted',
					'ajx_after_action_message' => __( 'The booking lifecycle was interrupted. The saved result is being resolved safely.', 'booking' ),
				),
			);
		} finally {
			if ( function_exists( 'wpbc_clear_request_form_context' ) ) {
				wpbc_clear_request_form_context();
			}
		}
		$readback = $this->creation_repository->find_by_marker( $marker );
		$status   = isset( $lifecycle_result['ajx_data']['status'] ) ? (string) $lifecycle_result['ajx_data']['status'] : 'error';
		if ( 'ok' !== $status && function_exists( 'make_bk_action' ) ) {
			make_bk_action( 'finish_check_multiuser_params_for_client_side', absint( $context['resource']['id'] ) );
		}
		if ( null !== $readback && ! empty( $readback['dates'] ) ) {
			$warnings = array();
			if ( 'ok' !== $status ) {
				$warnings[] = __( 'The booking was created, but a post-save operation reported a warning. Review the booking details before retrying any external action.', 'booking' );
			}
			if ( ! empty( $lifecycle_result['ajx_data']['ajx_after_action_message'] ) && 'warning' === (string) $lifecycle_result['ajx_data']['ajx_after_action_message_status'] ) {
				$warnings[] = sanitize_text_field( (string) $lifecycle_result['ajx_data']['ajx_after_action_message'] );
			}
			if ( isset( $plan['notes'] ) && wp_json_encode( $plan['notes'] ) !== wp_json_encode( isset( $readback['notes'] ) ? $readback['notes'] : array() ) ) {
				$warnings[] = __( 'The booking was created, but its notes could not be verified. Review the saved booking before retrying.', 'booking' );
			}
			return array( 'booking' => $readback, 'warnings' => array_slice( array_values( array_unique( $warnings ) ), 0, WPBC_Booking_New_Inspector_Config::MAX_WARNINGS ) );
		}
		if ( null !== $readback ) {
			$this->creation_repository->compensate_orphan_without_dates( $marker );
		}
		$message = isset( $lifecycle_result['ajx_data']['ajx_after_action_message'] ) ? sanitize_text_field( (string) $lifecycle_result['ajx_data']['ajx_after_action_message'] ) : __( 'The booking was not created. Review the booking and try again.', 'booking' );
		return new WP_Error( 'wpbc_booking_new_inspector_create_failed', $message, array( 'status' => 409, 'persisted' => false ) );
	}

	/**
	 * Resolve the reviewed email intent to the canonical Add Booking switch.
	 *
	 * An explicit reviewed choice wins; otherwise the established Add Booking
	 * option remains authoritative for backward compatibility.
	 *
	 * @param mixed $email_intent Reviewed email intent.
	 * @return int One to send email, or zero to suppress email.
	 */
	private function resolve_email_intent( $email_intent ) {
		if ( 'send' === $email_intent ) {
			return 1;
		}
		if ( 'do_not_send' === $email_intent ) {
			return 0;
		}
		return 'On' !== get_bk_option( 'booking_send_emails_off_addbooking' ) ? 1 : 0;
	}

	/**
	 * Convert a normalized ISO date to the canonical Add Booking display date.
	 *
	 * @param mixed $iso_date Normalized YYYY-MM-DD date.
	 * @return string DD.MM.YYYY date, or an empty string for invalid input.
	 */
	private function convert_iso_date_to_display_date( $iso_date ) {
		$iso_date = is_scalar( $iso_date ) ? trim( (string) $iso_date ) : '';
		if ( ! preg_match( '/^(\d{4})-(\d{2})-(\d{2})$/', $iso_date, $matches ) ) {
			return '';
		}
		return $matches[3] . '.' . $matches[2] . '.' . $matches[1];
	}
}
