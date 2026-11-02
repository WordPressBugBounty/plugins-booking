<?php
/**
 * Exact Booking Form submission validation for Add New Booking Inspector.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validates structured customer values against one exact authorized form.
 *
 * The caller must reload the current owner-authorized form definition before
 * every cost preview, review, and apply. This class never accepts serialized
 * browser form data and never infers fields from submitted keys.
 */
final class WPBC_Booking_New_Inspector_Form_Validator {

	/** Marker accepted by the canonical serializer. */
	const VALIDATED_CONTRACT = 'wpbc_booking_new_inspector_validated_form_v1';

	/** Enforce every creation requirement before Review or Apply. */
	const INTENT_CREATION = 'creation';

	/** Permit missing customer details while validating values used by pricing. */
	const INTENT_COST_PREVIEW = 'cost_preview';

	/** @var WPBC_Booking_New_Inspector_Field_DTO_Mapper Exact field resolver. */
	private $field_mapper;

	/**
	 * Construct the validator.
	 *
	 * @param WPBC_Booking_New_Inspector_Field_DTO_Mapper|null $field_mapper Optional exact field resolver.
	 */
	public function __construct( $field_mapper = null ) {
		$this->field_mapper = $field_mapper ? $field_mapper : new WPBC_Booking_New_Inspector_Field_DTO_Mapper();
	}

	/**
	 * Validate one structured submission against the exact current form.
	 *
	 * @param array<string,mixed>              $form_definition Exact authorized form definition.
	 * @param int                              $resource_id     Authorized Resource identifier.
	 * @param string                           $form_source     Stable form source.
	 * @param array<int,array<string,mixed>>   $submitted_fields Untrusted ordered field-value DTOs.
	 * @param string                           $validation_intent Exact validation purpose.
	 * @return array<string,mixed>|WP_Error Validated internal DTO or a safe validation error.
	 */
	public function validate( $form_definition, $resource_id, $form_source, $submitted_fields, $validation_intent = self::INTENT_CREATION ) {
		if ( ! in_array( $validation_intent, array( self::INTENT_CREATION, self::INTENT_COST_PREVIEW ), true ) ) {
			return $this->get_invalid_error(
				array( $this->get_field_error( '', 'invalid_validation_intent', __( 'The Booking Form validation purpose is invalid.', 'booking' ) ) )
			);
		}

		$form_contract = $this->field_mapper->resolve_form_contract( $form_definition, $resource_id, $form_source );
		if ( 'supported' !== $form_contract['support']['status'] ) {
			return new WP_Error(
				'wpbc_booking_new_inspector_form_unsupported',
				__( 'This Booking Form requires the full Add Booking page.', 'booking' ),
				array(
					'status'  => 422,
					'support' => $form_contract['support'],
				)
			);
		}

		$field_errors        = array();
		$validation_warnings = array();
		if ( ! is_array( $submitted_fields ) || ! $this->is_list_array( $submitted_fields ) || WPBC_Booking_New_Inspector_Config::MAX_FIELDS < count( $submitted_fields ) ) {
			return $this->get_invalid_error(
				array( $this->get_field_error( '', 'invalid_field_list', __( 'The Booking Form field list is invalid.', 'booking' ) ) )
			);
		}

		$exact_fields = array();
		foreach ( $form_contract['fields'] as $field_contract ) {
			$exact_fields[ $field_contract['key'] ] = $field_contract;
		}

		$submitted_by_key = array();
		foreach ( $submitted_fields as $submitted_field ) {
			if ( ! is_array( $submitted_field ) || ! $this->has_exact_keys( $submitted_field, array( 'key', 'values' ) ) ) {
				$field_errors[] = $this->get_field_error( '', 'invalid_field_shape', __( 'A Booking Form field has an invalid structure.', 'booking' ) );
				continue;
			}

			$field_key = is_string( $submitted_field['key'] ) ? $submitted_field['key'] : '';
			if ( ! $this->is_valid_field_key( $field_key ) ) {
				$field_errors[] = $this->get_field_error( '', 'invalid_field_key', __( 'A Booking Form field key is invalid.', 'booking' ) );
				continue;
			}
			if ( isset( $submitted_by_key[ $field_key ] ) ) {
				$field_errors[] = $this->get_field_error( $field_key, 'duplicate_field', __( 'A Booking Form field was submitted more than once.', 'booking' ) );
				continue;
			}

			if ( ! isset( $exact_fields[ $field_key ] ) ) {
				$field_errors[] = $this->get_disallowed_field_error( $field_key, $form_contract );
				continue;
			}
			if ( ! is_array( $submitted_field['values'] ) || ! $this->is_list_array( $submitted_field['values'] ) || WPBC_Booking_New_Inspector_Config::MAX_VALUES_PER_FIELD < count( $submitted_field['values'] ) ) {
				$field_errors[] = $this->get_field_error( $field_key, 'invalid_values', __( 'The submitted field values are invalid.', 'booking' ) );
				continue;
			}

			$values_are_strings = true;
			foreach ( $submitted_field['values'] as $submitted_value ) {
				if ( ! is_string( $submitted_value ) ) {
					$values_are_strings = false;
					break;
				}
			}
			if ( ! $values_are_strings ) {
				$field_errors[] = $this->get_field_error( $field_key, 'invalid_value_type', __( 'Booking Form values must be strings.', 'booking' ) );
				continue;
			}

			$submitted_by_key[ $field_key ] = $submitted_field['values'];
		}

		if ( ! empty( $field_errors ) ) {
			return $this->get_invalid_error( $field_errors );
		}

		$validated_fields = array();
		foreach ( $form_contract['fields'] as $field_contract ) {
			$field_key       = $field_contract['key'];
			$field_values    = isset( $submitted_by_key[ $field_key ] ) ? $submitted_by_key[ $field_key ] : array();
			$validated_field = $this->validate_field( $field_contract, $field_values, $validation_intent );
			if ( is_wp_error( $validated_field ) ) {
				$error_data     = $validated_field->get_error_data();
				$field_errors[] = is_array( $error_data ) && isset( $error_data['field_error'] )
					? $error_data['field_error']
					: $this->get_field_error( $field_key, 'invalid_value', __( 'The submitted field value is invalid.', 'booking' ) );
				continue;
			}
			if ( isset( $validated_field['validation_warning'] ) && is_array( $validated_field['validation_warning'] ) ) {
				$validation_warnings[] = $validated_field['validation_warning'];
				unset( $validated_field['validation_warning'] );
			}
			$validated_fields[] = $validated_field;
		}

		if ( ! empty( $field_errors ) ) {
			return $this->get_invalid_error( $field_errors );
		}

		return array(
			'contract'            => self::VALIDATED_CONTRACT,
			'schema_version'      => WPBC_Booking_New_Inspector_Config::SCHEMA_VERSION,
			'resource_id'         => absint( $resource_id ),
			'fields'              => $validated_fields,
			'schedule_fields'     => isset( $form_contract['schedule_fields'] ) ? $form_contract['schedule_fields'] : array(),
			'validation_warnings' => $validation_warnings,
		);
	}

	/**
	 * Validate and canonicalize one exact field.
	 *
	 * @param array<string,mixed> $field_contract Exact field contract.
	 * @param array<int,string>   $field_values   Untrusted submitted strings.
	 * @param string              $validation_intent Exact validation purpose.
	 * @return array<string,mixed>|WP_Error Validated field or field error.
	 */
	private function validate_field( $field_contract, $field_values, $validation_intent ) {
		$is_choice = in_array( $field_contract['type'], array( 'acceptance', 'checkbox', 'radio', 'select' ), true );
		if ( $is_choice ) {
			return $this->validate_choice_field( $field_contract, $field_values, $validation_intent );
		}

		if ( 1 < count( $field_values ) ) {
			return $this->get_field_wp_error( $field_contract['key'], 'multiple_values_not_allowed', __( 'This field accepts one value only.', 'booking' ) );
		}

		$raw_value = isset( $field_values[0] ) ? $field_values[0] : '';
		if ( $this->contains_disallowed_control_character( $raw_value ) ) {
			return $this->get_field_wp_error( $field_contract['key'], 'invalid_characters', __( 'This field contains unsupported control characters.', 'booking' ) );
		}
		if ( $this->get_maximum_value_bytes( $field_contract ) < strlen( $raw_value ) ) {
			return $this->get_field_wp_error( $field_contract['key'], 'value_too_long', __( 'This field exceeds the maximum allowed length.', 'booking' ) );
		}

		$validation_warning = null;
		if ( 'textarea' === $field_contract['type'] ) {
			$normalized_value = sanitize_textarea_field( $raw_value );
		} elseif ( 'email' === $field_contract['type'] ) {
			$trimmed_email     = trim( $raw_value );
			$normalized_value  = sanitize_email( $trimmed_email );
			if (
				'' !== $trimmed_email
				&& ( $normalized_value !== $trimmed_email || ! is_email( $normalized_value ) )
			) {
				if ( self::INTENT_COST_PREVIEW !== $validation_intent ) {
					return $this->get_field_wp_error( $field_contract['key'], 'invalid_email', __( 'Enter a valid email address.', 'booking' ) );
				}

				// Email cannot affect canonical pricing. Exclude the malformed value
				// from legacy cost input while keeping a visible non-blocking warning.
				$normalized_value   = '';
				$validation_warning = $this->get_field_error( $field_contract['key'], 'invalid_email', __( 'Enter a valid email address before reviewing the booking.', 'booking' ) );
			}
		} else {
			$normalized_value = sanitize_text_field( $raw_value );
		}

		if ( ! empty( $field_contract['maxlength'] ) && (int) $field_contract['maxlength'] < $this->get_character_length( $normalized_value ) ) {
			return $this->get_field_wp_error( $field_contract['key'], 'value_too_long', __( 'This field exceeds the configured maximum length.', 'booking' ) );
		}
		if ( self::INTENT_CREATION === $validation_intent && ! empty( $field_contract['required'] ) && '' === trim( $normalized_value ) ) {
			return $this->get_field_wp_error( $field_contract['key'], 'required', __( 'This field is required.', 'booking' ) );
		}

		$field_contract['values']         = array( $normalized_value );
		$field_contract['display_values'] = array( $normalized_value );
		if ( null !== $validation_warning ) {
			$field_contract['validation_warning'] = $validation_warning;
		}

		return $field_contract;
	}

	/**
	 * Validate one bounded option field and order values by the exact definition.
	 *
	 * @param array<string,mixed> $field_contract Exact field contract.
	 * @param array<int,string>   $field_values   Submitted option values.
	 * @param string              $validation_intent Exact validation purpose.
	 * @return array<string,mixed>|WP_Error Validated choice field or field error.
	 */
	private function validate_choice_field( $field_contract, $field_values, $validation_intent ) {
		$field_values = array_values( array_filter( $field_values, 'strlen' ) );
		if ( empty( $field_contract['multiple'] ) && 1 < count( $field_values ) ) {
			return $this->get_field_wp_error( $field_contract['key'], 'multiple_values_not_allowed', __( 'This field accepts one choice only.', 'booking' ) );
		}
		if ( self::INTENT_CREATION === $validation_intent && ! empty( $field_contract['required'] ) && empty( $field_values ) ) {
			return $this->get_field_wp_error( $field_contract['key'], 'required', __( 'This field is required.', 'booking' ) );
		}
		if ( count( $field_values ) !== count( array_unique( $field_values, SORT_STRING ) ) ) {
			return $this->get_field_wp_error( $field_contract['key'], 'duplicate_value', __( 'The same choice cannot be submitted more than once.', 'booking' ) );
		}

		$selected_values = array_fill_keys( $field_values, true );
		$ordered_values  = array();
		$ordered_labels  = array();
		foreach ( $field_contract['options'] as $field_option ) {
			$option_value = (string) $field_option['value'];
			if ( ! isset( $selected_values[ $option_value ] ) ) {
				continue;
			}
			$ordered_values[] = $option_value;
			$ordered_labels[] = (string) $field_option['label'];
			unset( $selected_values[ $option_value ] );
		}
		if ( ! empty( $selected_values ) ) {
			return $this->get_field_wp_error( $field_contract['key'], 'invalid_option', __( 'A submitted choice is not available in the current Booking Form.', 'booking' ) );
		}

		$field_contract['values']         = $ordered_values;
		$field_contract['display_values'] = $ordered_labels;

		return $field_contract;
	}

	/**
	 * Return a stable error for a key outside the exact customer-field schema.
	 *
	 * @param string              $field_key    Submitted field key.
	 * @param array<string,mixed> $form_contract Exact form contract.
	 * @return array<string,string> Field error DTO.
	 */
	private function get_disallowed_field_error( $field_key, $form_contract ) {
		$schedule_keys = isset( $form_contract['schedule_keys'] ) ? $form_contract['schedule_keys'] : array();
		if ( in_array( $field_key, $schedule_keys, true ) || in_array( $field_key, array( 'rangetime', 'starttime', 'endtime', 'durationtime' ), true ) ) {
			return $this->get_field_error( $field_key, 'schedule_field_not_allowed', __( 'Schedule values must be submitted through the schedule contract.', 'booking' ) );
		}

		$system_keys = isset( $form_contract['system_keys'] ) ? $form_contract['system_keys'] : array();
		if ( in_array( $field_key, $system_keys, true ) || $this->is_system_field_key( $field_key ) ) {
			return $this->get_field_error( $field_key, 'system_field_not_allowed', __( 'System Booking Form fields cannot be submitted as customer values.', 'booking' ) );
		}

		return $this->get_field_error( $field_key, 'unknown_field', __( 'This field is not present in the current Booking Form.', 'booking' ) );
	}

	/**
	 * Determine whether a submitted key is reserved for server-owned data.
	 *
	 * @param string $field_key Normalized key.
	 * @return bool True for a hidden, generated, or workflow-owned key.
	 */
	private function is_system_field_key( $field_key ) {
		if ( '_hint' === substr( $field_key, -5 ) || '_val' === substr( $field_key, -4 ) ) {
			return true;
		}

		return in_array(
			$field_key,
			array( 'calendar', 'captcha', 'submit', 'standard_bk_cost', 'wpbc_bfb_form_id', 'wpbc_custom_booking_form', 'wpbc_other_action' ),
			true
		);
	}

	/**
	 * Return the hard byte ceiling for one exact control.
	 *
	 * @param array<string,mixed> $field_contract Exact field contract.
	 * @return int Maximum bytes.
	 */
	private function get_maximum_value_bytes( $field_contract ) {
		if ( 'coupon' === $field_contract['source_type'] ) {
			return WPBC_Booking_New_Inspector_Config::MAX_COUPON_VALUE_BYTES;
		}
		if ( 'email' === $field_contract['type'] ) {
			return WPBC_Booking_New_Inspector_Config::MAX_EMAIL_VALUE_BYTES;
		}
		if ( 'textarea' === $field_contract['type'] ) {
			return WPBC_Booking_New_Inspector_Config::MAX_TEXTAREA_VALUE_BYTES;
		}

		return WPBC_Booking_New_Inspector_Config::MAX_TEXT_VALUE_BYTES;
	}

	/**
	 * Return a Unicode-aware character count when the runtime supports it.
	 *
	 * @param string $field_value Normalized field value.
	 * @return int Character count.
	 */
	private function get_character_length( $field_value ) {
		return function_exists( 'mb_strlen' ) ? mb_strlen( $field_value, 'UTF-8' ) : strlen( $field_value );
	}

	/**
	 * Detect control bytes that must not enter canonical storage.
	 *
	 * @param string $field_value Raw field value.
	 * @return bool True when a disallowed control byte exists.
	 */
	private function contains_disallowed_control_character( $field_value ) {
		return 1 === preg_match( '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $field_value );
	}

	/**
	 * Check one DTO record for an exact property allow list.
	 *
	 * @param array<string,mixed> $record       Candidate record.
	 * @param array<int,string>   $allowed_keys Exact property names.
	 * @return bool True when no property is missing or unknown.
	 */
	private function has_exact_keys( $record, $allowed_keys ) {
		$record_keys = array_keys( $record );
		sort( $record_keys );
		sort( $allowed_keys );

		return $record_keys === $allowed_keys;
	}

	/**
	 * Determine whether an array is a zero-based ordered list on older PHP.
	 *
	 * @param array<mixed> $candidate Candidate array.
	 * @return bool True for a list.
	 */
	private function is_list_array( $candidate ) {
		return array_values( $candidate ) === $candidate;
	}

	/**
	 * Validate the exact field-key syntax shared with the form resolver.
	 *
	 * @param string $field_key Candidate field key.
	 * @return bool True for a normalized bounded key.
	 */
	private function is_valid_field_key( $field_key ) {
		return 1 === preg_match( '/^[a-z0-9:._-]{1,100}$/', $field_key );
	}

	/**
	 * Build one bounded field-error DTO.
	 *
	 * @param string $field_key Field key, or an empty string for envelope errors.
	 * @param string $code      Stable field error code.
	 * @param string $message   Safe translated message.
	 * @return array<string,string> Field error DTO.
	 */
	private function get_field_error( $field_key, $code, $message ) {
		return array(
			'key'     => substr( (string) $field_key, 0, 100 ),
			'code'    => sanitize_key( $code ),
			'message' => sanitize_text_field( $message ),
		);
	}

	/**
	 * Wrap one field-error DTO for internal validation flow.
	 *
	 * @param string $field_key Field key.
	 * @param string $code      Stable error code.
	 * @param string $message   Safe message.
	 * @return WP_Error Field validation error.
	 */
	private function get_field_wp_error( $field_key, $code, $message ) {
		return new WP_Error(
			'wpbc_booking_new_inspector_field_invalid',
			$message,
			array( 'field_error' => $this->get_field_error( $field_key, $code, $message ) )
		);
	}

	/**
	 * Build the uniform fail-closed submission error.
	 *
	 * @param array<int,array<string,string>> $field_errors Field error DTOs.
	 * @return WP_Error Invalid submission error.
	 */
	private function get_invalid_error( $field_errors ) {
		return new WP_Error(
			'wpbc_booking_new_inspector_form_invalid',
			__( 'Correct the invalid Booking Form fields and try again.', 'booking' ),
			array(
				'status'       => 422,
				'field_errors' => array_slice( $field_errors, 0, WPBC_Booking_New_Inspector_Config::MAX_FIELD_ERRORS ),
			)
		);
	}
}
