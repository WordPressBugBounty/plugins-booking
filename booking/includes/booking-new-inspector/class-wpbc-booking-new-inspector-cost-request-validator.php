<?php
/**
 * Request validation for Add New Booking Inspector cost preview.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validates the exact bounded data-only cost-preview envelope.
 */
final class WPBC_Booking_New_Inspector_Cost_Request_Validator {

	/** @var object Shared identity request validator. */
	private $identity_validator;

	/**
	 * Construct the validator.
	 *
	 * @param object|null $identity_validator Optional object exposing validate().
	 */
	public function __construct( $identity_validator = null ) {
		$this->identity_validator = $identity_validator ? $identity_validator : new WPBC_Booking_New_Inspector_Request_Validator();
	}

	/**
	 * Validate one untrusted cost-preview request without granting authority.
	 *
	 * @param mixed $request_values Candidate decoded request values.
	 * @return array<string,mixed>|WP_Error Normalized envelope or a safe error.
	 */
	public function validate( $request_values ) {
		if ( ! is_array( $request_values ) ) {
			return $this->get_invalid_error();
		}

		$allowed_fields = array(
			'schema_version',
			'request_id',
			'resource_id',
			'form_id',
			'form_source',
			'selection_source',
			'source_context_token',
			'schedule',
			'fields',
			'notes',
			'email_intent',
			'cost_intent',
			'corrected_cost',
			'draft_revision',
		);
		if ( array_diff( array_keys( $request_values ), $allowed_fields ) || array_diff( $allowed_fields, array_keys( $request_values ) ) ) {
			return $this->get_invalid_error();
		}

		$encoded_request = function_exists( 'wp_json_encode' ) ? wp_json_encode( $request_values ) : json_encode( $request_values );
		$request_limits  = WPBC_Booking_New_Inspector_Config::get_action_request_limits();
		if ( ! is_string( $encoded_request ) || $request_limits[ WPBC_Booking_New_Inspector_Config::ACTION_COST_PREVIEW ] < strlen( $encoded_request ) ) {
			return $this->get_invalid_error();
		}

		$identity_values = array_intersect_key(
			$request_values,
			array_flip( array( 'schema_version', 'request_id', 'selection_source', 'resource_id', 'form_id', 'source_context_token' ) )
		);
		if ( '' === $identity_values['source_context_token'] ) {
			unset( $identity_values['source_context_token'] );
		}
		$identity = $this->identity_validator->validate( $identity_values );
		if ( is_wp_error( $identity ) || empty( $identity['resource_id'] ) || '' === $identity['form_id'] ) {
			return $this->get_invalid_error();
		}

		$form_source = is_string( $request_values['form_source'] ) ? sanitize_key( $request_values['form_source'] ) : '';
		if ( ! in_array( $form_source, array( 'classic', 'form_builder', 'advanced', 'appointment' ), true ) ) {
			return $this->get_invalid_error();
		}
		if ( ! is_array( $request_values['schedule'] ) || ! $this->has_exact_schedule_keys( $request_values['schedule'] ) ) {
			return $this->get_invalid_error();
		}
		if ( ! is_array( $request_values['fields'] ) || array_values( $request_values['fields'] ) !== $request_values['fields'] || WPBC_Booking_New_Inspector_Config::MAX_FIELDS < count( $request_values['fields'] ) ) {
			return $this->get_invalid_error();
		}
		$notes = $this->validate_note_shape( $request_values['notes'] );
		if ( is_wp_error( $notes ) ) {
			return $this->get_invalid_error();
		}

		$email_intent      = is_string( $request_values['email_intent'] ) ? sanitize_key( $request_values['email_intent'] ) : '';
		$cost_intent       = is_string( $request_values['cost_intent'] ) ? sanitize_key( $request_values['cost_intent'] ) : '';
		$raw_corrected_cost = is_string( $request_values['corrected_cost'] ) ? trim( $request_values['corrected_cost'] ) : null;
		$corrected_cost     = null === $raw_corrected_cost ? '' : $this->normalize_corrected_cost( $raw_corrected_cost );
		if (
			! in_array( $email_intent, array( 'send', 'do_not_send', 'canonical_default' ), true )
			|| ! in_array( $cost_intent, array( 'canonical', 'corrected' ), true )
			|| null === $raw_corrected_cost
			|| ( 'canonical' === $cost_intent && '' !== $raw_corrected_cost )
			|| ( 'corrected' === $cost_intent && '' === $corrected_cost )
		) {
			return $this->get_invalid_error();
		}
		if ( ! is_int( $request_values['draft_revision'] ) || 0 > $request_values['draft_revision'] || 2147483647 < $request_values['draft_revision'] ) {
			return $this->get_invalid_error();
		}

		$identity['form_source']          = $form_source;
		$identity['source_context_token'] = isset( $request_values['source_context_token'] ) ? (string) $request_values['source_context_token'] : '';
		$identity['schedule']             = $request_values['schedule'];
		$identity['fields']               = $request_values['fields'];
		$identity['notes']                = $notes;
		$identity['email_intent']         = $email_intent;
		$identity['cost_intent']          = $cost_intent;
		$identity['corrected_cost']       = $corrected_cost;
		$identity['draft_revision']       = $request_values['draft_revision'];

		return $identity;
	}

	/**
	 * Validate only the bounded executable-free note envelope.
	 *
	 * Current authority and the exact supported keys are reloaded by the notes
	 * domain service; this boundary rejects malformed browser structures early.
	 *
	 * @param mixed $raw_notes Candidate note map.
	 * @return array<string,string>|WP_Error Bounded note strings or safe error.
	 */
	private function validate_note_shape( $raw_notes ) {
		if ( ! is_array( $raw_notes ) || ( ! empty( $raw_notes ) && array_values( $raw_notes ) === $raw_notes ) ) {
			return $this->get_invalid_error();
		}

		$notes = array();
		foreach ( $raw_notes as $note_type => $raw_note ) {
			$note_type = is_string( $note_type ) ? sanitize_key( $note_type ) : '';
			if ( ! in_array( $note_type, array( 'public', 'private' ), true ) || ! is_scalar( $raw_note ) ) {
				return $this->get_invalid_error();
			}
			$raw_note = (string) $raw_note;
			if ( WPBC_Booking_New_Inspector_Config::MAX_NOTE_VALUE_BYTES < strlen( $raw_note ) ) {
				return $this->get_invalid_error();
			}
			$notes[ $note_type ] = $raw_note;
		}

		return $notes;
	}

	/**
	 * Normalize one administrator-entered exact total without granting authority.
	 *
	 * Authorization, edition, Resource ownership, and current pricing are reloaded
	 * by the service. This method only bounds the scalar to the released correction
	 * format so malformed browser values cannot reach pricing.
	 *
	 * @param mixed $raw_cost Candidate exact total.
	 * @return string Normalized decimal without trailing zeroes, or an empty string.
	 */
	private function normalize_corrected_cost( $raw_cost ) {
		if ( ! is_scalar( $raw_cost ) ) {
			return '';
		}

		$raw_cost = trim( (string) $raw_cost );
		if ( '' === $raw_cost || ! preg_match( '/^[0-9]{1,10}(?:\.[0-9]{1,8})?$/', $raw_cost ) ) {
			return '';
		}

		$normalized_cost = (float) $raw_cost;
		if ( ! is_finite( $normalized_cost ) || 0 > $normalized_cost || 1000000000 < $normalized_cost ) {
			return '';
		}

		$normalized_cost = rtrim( rtrim( number_format( $normalized_cost, 8, '.', '' ), '0' ), '.' );

		return '' === $normalized_cost ? '0' : $normalized_cost;
	}

	/**
	 * Check the exact client-owned schedule property list.
	 *
	 * @param array<string,mixed> $schedule Candidate schedule.
	 * @return bool True when the schedule has no missing or unknown properties.
	 */
	private function has_exact_schedule_keys( $schedule ) {
		$actual_keys   = array_keys( $schedule );
		$expected_keys = array( 'selection_method', 'time_application', 'selected_dates', 'start_time', 'end_time' );
		sort( $actual_keys );
		sort( $expected_keys );

		return $actual_keys === $expected_keys;
	}

	/**
	 * Return one non-sensitive malformed-request error.
	 *
	 * @return WP_Error Safe validation error.
	 */
	private function get_invalid_error() {
		return new WP_Error(
			'wpbc_booking_new_inspector_cost_request_invalid',
			__( 'The cost preview request is invalid. Review the booking details and try again.', 'booking' ),
			array( 'status' => 400 )
		);
	}
}
