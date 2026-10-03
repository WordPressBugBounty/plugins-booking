<?php
/**
 * Draft validation for the Setup Wizard module.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validate and normalize only fields owned by the current wizard step.
 */
final class WPBC_Setup_Wizard_Draft_Validator {

	/** @var WPBC_Setup_Wizard_Step_Data */
	private $step_data;

	/**
	 * Build the validator from the server-owned step field provider.
	 *
	 * @param WPBC_Setup_Wizard_Step_Data $step_data Read-only field contracts.
	 */
	public function __construct( WPBC_Setup_Wizard_Step_Data $step_data ) {
		$this->step_data = $step_data;
	}

	/**
	 * Validate one submitted step before draft persistence.
	 *
	 * Required-field checks run only for forward navigation. Back navigation
	 * still rejects malformed non-empty values and unsupported fields.
	 *
	 * @param string              $step_id          Registered step identifier.
	 * @param array<string,mixed> $submitted_fields Untrusted request fields.
	 * @param bool                $require_complete Whether required fields must be present.
	 * @param array<string,mixed> $draft_values     Current normalized draft values keyed by step.
	 *
	 * @return array<string,mixed>|WP_Error Sanitized fields or field-level errors.
	 */
	public function validate_step( $step_id, array $submitted_fields, $require_complete, array $draft_values = array() ) {
		$allowed_field_names = $this->step_data->get_field_names( $step_id );
		$unknown_field_names = array_diff( array_keys( $submitted_fields ), $allowed_field_names );

		if ( ! empty( $unknown_field_names ) || count( $submitted_fields ) > count( $allowed_field_names ) ) {
			return new WP_Error(
				'wpbc_setup_wizard_invalid_fields',
				__( 'The Setup Wizard received fields that are not available on this step.', 'booking' )
			);
		}

		$sanitized_fields = array();
		$field_errors     = array();
		$required_fields  = $require_complete ? $this->step_data->get_required_fields( $step_id ) : array();

		foreach ( $allowed_field_names as $field_id ) {
			$is_submitted = array_key_exists( $field_id, $submitted_fields );
			$raw_value    = $is_submitted ? $submitted_fields[ $field_id ] : '';

			if ( ! $is_submitted && in_array( $field_id, $required_fields, true ) ) {
				$field_errors[ $field_id ] = __( 'This field is required.', 'booking' );
				continue;
			}

			if ( ! $is_submitted ) {
				continue;
			}

			$validated_value = $this->validate_field( $step_id, $field_id, $raw_value, in_array( $field_id, $required_fields, true ) );
			if ( is_wp_error( $validated_value ) ) {
				$field_errors[ $field_id ] = $validated_value->get_error_message();
				continue;
			}

			$sanitized_fields[ $field_id ] = $validated_value;
		}

		if ( ! empty( $field_errors ) ) {
			return new WP_Error(
				'wpbc_setup_wizard_validation_failed',
				__( 'Review the highlighted fields before continuing.', 'booking' ),
				array( 'field_errors' => $field_errors )
			);
		}

		if ( $this->step_data->is_module_step( $step_id ) ) {
			$validated_module_values = $this->step_data->validate_module_values( $step_id, $sanitized_fields, $draft_values );
			if ( is_wp_error( $validated_module_values ) ) {
				return $validated_module_values;
			}
			$sanitized_fields = $validated_module_values;
		}

		return $sanitized_fields;
	}

	/**
	 * Revalidate every persisted value in the active route before approval.
	 *
	 * Approval must not trust values merely because they were valid in an older
	 * request. Each active step is rebuilt in route order so contextual module
	 * rules see only values already revalidated during this request.
	 *
	 * @param array<string,mixed> $draft_values Persisted draft values keyed by step.
	 * @param string[]            $step_ids     Current server-owned active route.
	 *
	 * @return array<string,array<string,mixed>>|WP_Error Revalidated route values or the first invalid step.
	 */
	public function validate_active_route( array $draft_values, array $step_ids ) {
		$validated_route_values = array();

		foreach ( $step_ids as $step_id ) {
			$step_id = sanitize_key( (string) $step_id );
			if ( in_array( $step_id, array( 'welcome', 'review_setup' ), true ) ) {
				continue;
			}

			$step_values = $this->step_data->get_step_values( $step_id, $draft_values );
			$validated_step_values = $this->validate_step( $step_id, $step_values, true, $validated_route_values );

			if ( is_wp_error( $validated_step_values ) ) {
				$error_data   = $validated_step_values->get_error_data();
				$field_errors = is_array( $error_data ) && isset( $error_data['field_errors'] ) && is_array( $error_data['field_errors'] )
					? $error_data['field_errors']
					: array();

				return new WP_Error(
					'wpbc_setup_wizard_review_invalid',
					__( 'One of the saved setup steps is no longer valid. Edit that step and review the plan again.', 'booking' ),
					array(
						'invalid_step_id' => $step_id,
						'field_errors'    => $field_errors,
					)
				);
			}

			if ( ! empty( $validated_step_values ) ) {
				$validated_route_values[ $step_id ] = $validated_step_values;
			}
		}

		return $validated_route_values;
	}

	/**
	 * Normalize stored step values without trusting legacy or malformed records.
	 *
	 * Invalid and unsupported stored values are dropped. This method performs no
	 * persistence and is used only while normalizing the isolated draft option.
	 *
	 * @param array<string,mixed> $stored_values Stored values keyed by step.
	 * @param string[]            $step_ids      Registered step identifiers.
	 *
	 * @return array<string,array<string,mixed>> Safe values keyed by registered step.
	 */
	public function normalize_stored_values( array $stored_values, array $step_ids ) {
		$normalized_values = array();

		foreach ( $step_ids as $step_id ) {
			if ( ! isset( $stored_values[ $step_id ] ) || ! is_array( $stored_values[ $step_id ] ) ) {
				continue;
			}

			$allowed_fields = array_intersect_key( $stored_values[ $step_id ], array_flip( $this->step_data->get_field_names( $step_id ) ) );
			$step_values    = $this->validate_step( $step_id, $allowed_fields, false, $normalized_values );

			if ( ! is_wp_error( $step_values ) && ! empty( $step_values ) ) {
				$normalized_values[ $step_id ] = $step_values;
			}
		}

		return $normalized_values;
	}

	/**
	 * Validate one field against its exact server-side contract.
	 *
	 * @param string $step_id     Registered step identifier.
	 * @param string $field_id    Stable field identifier.
	 * @param mixed  $raw_value   Untrusted field value.
	 * @param bool   $is_required Whether an empty value is invalid.
	 *
	 * @return string|bool|array|WP_Error Sanitized value or validation error.
	 */
	private function validate_field( $step_id, $field_id, $raw_value, $is_required ) {
		if ( $this->step_data->is_module_step( $step_id ) ) {
			return $this->step_data->validate_module_field( $step_id, $field_id, $raw_value, $is_required );
		}

		if ( 'personalization_consent' === $field_id ) {
			if ( is_bool( $raw_value ) ) {
				return $raw_value;
			}

			if ( is_scalar( $raw_value ) && in_array( (string) $raw_value, array( '0', '1' ), true ) ) {
				return '1' === (string) $raw_value;
			}

			return new WP_Error( 'wpbc_setup_wizard_invalid_consent', __( 'Choose a valid personalization preference.', 'booking' ) );
		}

		if ( ! is_scalar( $raw_value ) ) {
			return new WP_Error( 'wpbc_setup_wizard_invalid_field', __( 'Enter a valid value.', 'booking' ) );
		}

		$value = sanitize_text_field( (string) $raw_value );
		if ( $is_required && '' === trim( $value ) ) {
			return new WP_Error( 'wpbc_setup_wizard_required_field', __( 'This field is required.', 'booking' ) );
		}

		if ( ! $is_required && '' === trim( $value ) ) {
			return '';
		}

		if ( 'business_name' === $field_id ) {
			if ( $this->get_text_length( $value ) > 200 ) {
				return new WP_Error( 'wpbc_setup_wizard_business_name_too_long', __( 'Use 200 characters or fewer for the business name.', 'booking' ) );
			}

			return $value;
		}

		if ( 'booking_email' === $field_id ) {
			if ( '' === $value && ! $is_required ) {
				return '';
			}

			$email_address = sanitize_email( $value );
			if ( '' === $email_address || $this->get_text_length( $email_address ) > 254 || ! is_email( $email_address ) ) {
				return new WP_Error( 'wpbc_setup_wizard_invalid_email', __( 'Enter a valid booking email address.', 'booking' ) );
			}

			return $email_address;
		}

		$allowed_values = $this->step_data->get_allowed_values( $step_id, $field_id );
		if ( ! empty( $allowed_values ) && ! in_array( $value, $allowed_values, true ) ) {
			return new WP_Error( 'wpbc_setup_wizard_invalid_choice', __( 'Choose one of the available options.', 'booking' ) );
		}

		return $value;
	}

	/**
	 * Measure a text value without requiring the multibyte PHP extension.
	 *
	 * @param string $text Text value.
	 *
	 * @return int Character or byte length.
	 */
	private function get_text_length( $text ) {
		return function_exists( 'mb_strlen' ) ? mb_strlen( $text ) : strlen( $text );
	}
}
