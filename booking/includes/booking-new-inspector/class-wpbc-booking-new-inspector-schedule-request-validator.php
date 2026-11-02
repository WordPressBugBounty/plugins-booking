<?php
/**
 * Request validator for Add New Booking Inspector schedule reads.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validates the bounded creation-schedule envelope without granting authority.
 */
final class WPBC_Booking_New_Inspector_Schedule_Request_Validator {

	/** @var WPBC_Booking_New_Inspector_Request_Validator Identity validator. */
	private $identity_validator;

	/**
	 * Construct the validator with an optional identity validator test double.
	 *
	 * @param object|null $identity_validator Object exposing validate().
	 */
	public function __construct( $identity_validator = null ) {
		$this->identity_validator = $identity_validator ? $identity_validator : new WPBC_Booking_New_Inspector_Request_Validator();
	}

	/**
	 * Validate one untrusted, non-mutating schedule request.
	 *
	 * The nested schedule is syntax-normalized later by the shared Booking
	 * normalizer. This layer owns the exact endpoint envelope and rejects unknown
	 * nested properties so future fields cannot silently broaden authority.
	 *
	 * @param mixed $request_values Untrusted request values without action or nonce.
	 * @return array<string,mixed>|WP_Error Normalized envelope or safe error.
	 */
	public function validate( $request_values ) {
		if ( ! is_array( $request_values ) ) {
			return $this->get_invalid_error();
		}

		$allowed_fields = array( 'schema_version', 'request_id', 'selection_source', 'resource_id', 'form_id', 'source_context_token', 'schedule', 'calendar_anchor_date' );
		if ( array_diff( array_keys( $request_values ), $allowed_fields ) ) {
			return $this->get_invalid_error();
		}

		$encoded_request = function_exists( 'wp_json_encode' ) ? wp_json_encode( $request_values ) : json_encode( $request_values );
		$request_limits  = WPBC_Booking_New_Inspector_Config::get_action_request_limits();
		if (
			! is_string( $encoded_request )
			|| $request_limits[ WPBC_Booking_New_Inspector_Config::ACTION_SCHEDULE ] < strlen( $encoded_request )
		) {
			return $this->get_invalid_error();
		}

		$identity_values = $request_values;
		unset( $identity_values['schedule'], $identity_values['calendar_anchor_date'] );
		$identity = $this->identity_validator->validate( $identity_values );
		if ( is_wp_error( $identity ) || empty( $identity['resource_id'] ) || '' === $identity['form_id'] ) {
			return $this->get_invalid_error();
		}

		$schedule = null;
		if ( array_key_exists( 'schedule', $request_values ) ) {
			if ( ! is_array( $request_values['schedule'] ) ) {
				return $this->get_invalid_error();
			}

			$allowed_schedule_fields = array( 'selection_method', 'time_application', 'selected_dates', 'start_time', 'end_time' );
			if ( array_diff( array_keys( $request_values['schedule'] ), $allowed_schedule_fields ) ) {
				return $this->get_invalid_error();
			}
			$schedule = $request_values['schedule'];
		}

		$identity['schedule'] = $schedule;
		$identity['calendar_anchor_date'] = $this->normalize_calendar_anchor_date(
			isset( $request_values['calendar_anchor_date'] ) ? $request_values['calendar_anchor_date'] : ''
		);
		if ( is_wp_error( $identity['calendar_anchor_date'] ) ) {
			return $identity['calendar_anchor_date'];
		}

		return $identity;
	}

	/**
	 * Normalize the presentation-only month anchor used after a context reload.
	 *
	 * The anchor changes only the initially displayed native-calendar month. It
	 * does not select a date or grant booking, Resource, or availability authority.
	 *
	 * @param mixed $calendar_anchor_date Candidate YYYY-MM-DD date or empty value.
	 * @return string|WP_Error Strict ISO date, empty string, or a safe error.
	 */
	private function normalize_calendar_anchor_date( $calendar_anchor_date ) {
		if ( '' === $calendar_anchor_date || null === $calendar_anchor_date ) {
			return '';
		}
		if ( ! is_scalar( $calendar_anchor_date ) ) {
			return $this->get_invalid_error();
		}

		$calendar_anchor_date = trim( (string) $calendar_anchor_date );
		if ( ! preg_match( '/^(\d{4})-(\d{2})-(\d{2})$/', $calendar_anchor_date, $date_parts ) ) {
			return $this->get_invalid_error();
		}
		if ( ! checkdate( (int) $date_parts[2], (int) $date_parts[3], (int) $date_parts[1] ) ) {
			return $this->get_invalid_error();
		}

		return $calendar_anchor_date;
	}

	/**
	 * Return one non-sensitive malformed schedule-request error.
	 *
	 * @return WP_Error Safe validation error.
	 */
	private function get_invalid_error() {
		return new WP_Error(
			'wpbc_booking_new_inspector_schedule_request_invalid',
			__( 'The booking schedule request is invalid. Reload the page and try again.', 'booking' ),
			array( 'status' => 400 )
		);
	}
}
