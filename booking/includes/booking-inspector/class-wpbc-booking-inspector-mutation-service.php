<?php
/**
 * Authorized Booking Inspector mutation orchestration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validate and atomically persist editable booking-detail projections.
 */
final class WPBC_Booking_Inspector_Mutation_Service {

	/** @var WPBC_Booking_Inspector_Authorization Authorization service. */
	private $authorization;

	/** @var WPBC_Booking_Inspector_Update_Request_Validator Request validator. */
	private $validator;

	/** @var WPBC_Booking_Inspector_Mutation_Repository Mutation repository. */
	private $repository;

	/** @var WPBC_Booking_Inspector_Form_Field_Resolver Form-field resolver. */
	private $form_field_resolver;

	/** @var WPBC_Booking_Notes_Service Notes service. */
	private $notes_service;

	/** @var WPBC_Booking_Modified_Notification_Service Post-commit Modified-email dispatcher. */
	private $notification_service;

	/**
	 * Construct the mutation service with replaceable collaborators.
	 *
	 * @param WPBC_Booking_Inspector_Authorization|null          $authorization        Authorization service.
	 * @param WPBC_Booking_Inspector_Update_Request_Validator|null $validator          Update validator.
	 * @param WPBC_Booking_Inspector_Mutation_Repository|null    $repository           Mutation repository.
	 * @param WPBC_Booking_Inspector_Form_Field_Resolver|null    $form_field_resolver  Form resolver.
	 * @param WPBC_Booking_Notes_Service|null                    $notes_service         Notes service.
	 * @param WPBC_Booking_Modified_Notification_Service|null    $notification_service  Optional post-commit notification service.
	 */
	public function __construct( $authorization = null, $validator = null, $repository = null, $form_field_resolver = null, $notes_service = null, $notification_service = null ) {
		$this->authorization       = $authorization ? $authorization : new WPBC_Booking_Inspector_Authorization();
		$this->validator           = $validator ? $validator : new WPBC_Booking_Inspector_Update_Request_Validator();
		$this->repository          = $repository ? $repository : new WPBC_Booking_Inspector_Mutation_Repository();
		$this->form_field_resolver = $form_field_resolver ? $form_field_resolver : new WPBC_Booking_Inspector_Form_Field_Resolver();
		$this->notes_service       = $notes_service ? $notes_service : new WPBC_Booking_Notes_Service();
		$this->notification_service = $notification_service ? $notification_service : new WPBC_Booking_Modified_Notification_Service();
	}

	/**
	 * Apply one complete, currently authorized Inspector draft.
	 *
	 * @param mixed $request_values Untrusted request values.
	 *
	 * @return array<string,mixed>|WP_Error Normalized result or safe error.
	 */
	public function update( $request_values ) {
		$request = $this->validator->normalize( $request_values );
		if ( is_wp_error( $request ) ) {
			return $request;
		}

		$authorization_context = $this->authorization->authorize_booking( $request['booking_id'], $request['source'] );
		if ( is_wp_error( $authorization_context ) ) {
			return $authorization_context;
		}
		$booking = $authorization_context['booking'];
		if ( ! $this->current_user_can( 'edit_booking' ) ) {
			return new WP_Error(
				'wpbc_booking_inspector_update_forbidden',
				__( 'Booking changes are unavailable for this account.', 'booking' ),
				array( 'status' => 403 )
			);
		}

		$notes = $this->notes_service->get_booking_notes( $request['booking_id'], class_exists( 'wpdev_bk_personal' ) );
		if ( is_wp_error( $notes ) || null === $notes ) {
			return is_wp_error( $notes ) ? $notes : $this->authorization->get_not_found_error();
		}
		$current_fingerprint = WPBC_Booking_Inspector_Fingerprint::build( $booking, $notes );
		if ( ! hash_equals( $current_fingerprint, $request['fingerprint'] ) ) {
			return new WP_Error(
				'wpbc_booking_inspector_update_stale',
				__( 'This booking changed after it was opened. Reload it before saving.', 'booking' ),
				array( 'status' => 409 )
			);
		}

		$activity_change_set = array();
		$column_values       = $this->build_column_values( $booking, $notes, $request['draft'], $activity_change_set );
		if ( is_wp_error( $column_values ) ) {
			return $column_values;
		}
		if ( empty( $column_values ) ) {
			return array( 'changed' => false );
		}

		$update_result = $this->repository->update_booking(
			$request['booking_id'],
			isset( $booking['modification_date'] ) ? $booking['modification_date'] : '',
			$column_values
		);
		if ( is_wp_error( $update_result ) ) {
			return $update_result;
		}

		$this->run_compatibility_hooks( $booking, $column_values, $activity_change_set );
		$notifications_sent = $this->notification_service->send( $request['booking_id'], $request['send_modified_email'] );

		return array(
			'changed'            => true,
			'notifications_sent' => $notifications_sent,
		);
	}

	/**
	 * Build the exact allow-listed canonical row changes.
	 *
	 * @param array<string,mixed>               $booking             Authorized booking row.
	 * @param array<string,array<string,mixed>> $notes               Current normalized notes.
	 * @param array<string,mixed>               $draft               Untrusted decoded draft.
	 * @param array<string,mixed>               $activity_change_set Authoritative privacy-aware field changes.
	 *
	 * @return array<string,mixed>|WP_Error Canonical changes or validation error.
	 */
	private function build_column_values( $booking, $notes, $draft, &$activity_change_set = array() ) {
		$column_values   = array();
		$form_projection = $this->form_field_resolver->resolve_booking_fields( $booking );
		$draft_fields    = isset( $draft['fields'] ) && is_array( $draft['fields'] ) ? $draft['fields'] : array();
		$updated_form    = $this->replace_form_values(
			isset( $booking['form'] ) ? (string) $booking['form'] : '',
			isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0,
			isset( $form_projection['fields'] ) ? $form_projection['fields'] : array(),
			$draft_fields,
			$activity_change_set
		);
		if ( is_wp_error( $updated_form ) ) {
			return $updated_form;
		}
		if ( $updated_form !== ( isset( $booking['form'] ) ? (string) $booking['form'] : '' ) ) {
			$column_values['form'] = $updated_form;
		}

		$draft_notes = isset( $draft['notes'] ) && is_array( $draft['notes'] ) ? $draft['notes'] : array();
		if ( array_key_exists( 'public', $draft_notes ) && ! empty( $notes['public']['supported'] ) && function_exists( 'wpbc_booking_notes_column_exists' ) && wpbc_booking_notes_column_exists( 'public_note' ) ) {
			$public_note = sanitize_textarea_field( (string) $draft_notes['public'] );
			$current_public_note = isset( $notes['public']['value'] ) ? (string) $notes['public']['value'] : '';
			if ( $public_note !== $current_public_note ) {
				$column_values['public_note'] = $public_note;
			}
		}
		if ( array_key_exists( 'private', $draft_notes ) && ! empty( $notes['private']['supported'] ) && $this->current_user_can( 'set_booking_note' ) ) {
			$private_note = sanitize_textarea_field( (string) $draft_notes['private'] );
			$current_private_note = isset( $notes['private']['value'] ) ? (string) $notes['private']['value'] : '';
			if ( $private_note !== $current_private_note ) {
				$column_values['remark'] = $private_note;
			}
		}

		if ( ! empty( $booking['supports_costs'] ) && isset( $draft['costs'] ) && is_array( $draft['costs'] ) ) {
			if ( array_key_exists( 'saved_cost', $draft['costs'] ) && $this->current_user_can( 'set_booking_cost' ) ) {
				$raw_cost = str_replace( ',', '.', trim( (string) $draft['costs']['saved_cost'] ) );
				if ( '' === $raw_cost && ( ! array_key_exists( 'cost', $booking ) || null === $booking['cost'] || '' === (string) $booking['cost'] ) ) {
					$raw_cost = null;
				}
				if ( null !== $raw_cost && ( ! is_numeric( $raw_cost ) || 0 > (float) $raw_cost ) ) {
					return $this->get_field_error( __( 'Saved booking cost must be zero or greater.', 'booking' ) );
				}
				$normalized_cost = null === $raw_cost ? null : round( (float) $raw_cost, 2 );
				if ( null !== $normalized_cost && (float) $booking['cost'] !== $normalized_cost ) {
					$column_values['cost'] = $normalized_cost;
				}
			}
			if ( array_key_exists( 'payment_status', $draft['costs'] ) && $this->current_user_can( 'set_payment_status' ) ) {
				$payment_status = sanitize_text_field( (string) $draft['costs']['payment_status'] );
				$current_payment_status = isset( $booking['pay_status'] ) ? (string) $booking['pay_status'] : '';
				$allowed_statuses       = $this->get_allowed_payment_statuses();
				if ( $payment_status !== $current_payment_status && ! isset( $allowed_statuses[ $payment_status ] ) ) {
					return $this->get_field_error( __( 'Select a valid payment status.', 'booking' ) );
				}
				if ( $payment_status !== $current_payment_status ) {
					$column_values['pay_status'] = $payment_status;
				}
			}
		}

		return $column_values;
	}

	/**
	 * Replace only fields present in the current immutable form projection.
	 *
	 * Existing records retain their stored order. A changed field without a
	 * stored record is inserted relative to the surrounding current schema so a
	 * previously empty field does not move to the end after its first save.
	 *
	 * @param string                         $stored_form         Canonical encoded form.
	 * @param int                            $resource_id         Booking Resource ID.
	 * @param array<int,array<string,mixed>> $field_schema        Current authorized field schema.
	 * @param array<string,mixed>            $draft_fields        Untrusted draft fields.
	 * @param array<string,mixed>            $activity_change_set Authoritative privacy-aware field changes.
	 *
	 * @return string|WP_Error Updated canonical form or validation error.
	 */
	private function replace_form_values( $stored_form, $resource_id, $field_schema, $draft_fields, &$activity_change_set = array() ) {
		$schema_by_key = array();
		$schema_order  = array();
		foreach ( $field_schema as $field ) {
			if ( is_array( $field ) && ! empty( $field['key'] ) ) {
				$field_key = $this->normalize_field_key( $field['key'] );
				if ( ! isset( $schema_order[ $field_key ] ) ) {
					$schema_order[ $field_key ] = count( $schema_order );
				}
				$schema_by_key[ $field_key ] = $field;
			}
		}
		$normalized_drafts = array();
		foreach ( $draft_fields as $field_key => $draft_value ) {
			$field_key = $this->normalize_field_key( $field_key );
			if ( ! isset( $schema_by_key[ $field_key ] ) ) {
				return $this->get_field_error( __( 'One or more booking fields are no longer available.', 'booking' ) );
			}
			$normalized_value = $this->normalize_field_value( $schema_by_key[ $field_key ], $draft_value );
			if ( is_wp_error( $normalized_value ) ) {
				return $normalized_value;
			}
			$current_values = isset( $schema_by_key[ $field_key ]['values'] ) && is_array( $schema_by_key[ $field_key ]['values'] )
				? array_map( 'strval', $schema_by_key[ $field_key ]['values'] )
				: array();
			if ( $normalized_value === $current_values ) {
				continue;
			}
			if ( WPBC_Booking_Inspector_Time_Field_Policy::is_schedule_field( $schema_by_key[ $field_key ] ) ) {
				return $this->get_field_error( __( 'Change booking time with Change dates.', 'booking' ) );
			}
			$normalized_drafts[ $field_key ] = $normalized_value;
		}
		if ( empty( $normalized_drafts ) ) {
			return $stored_form;
		}
		$activity_change_set = $this->build_activity_change_set( $field_schema, $normalized_drafts );
		$this->add_synchronized_companion_drafts( $schema_by_key, $schema_order, $normalized_drafts );

		$stored_records    = explode( '~', $stored_form );
		$stored_field_keys = array();
		foreach ( $stored_records as $stored_record ) {
			$stored_parts = explode( '^', $stored_record, 3 );
			if ( 3 === count( $stored_parts ) ) {
				$stored_field_keys[ $this->get_stored_base_key( $stored_parts[1], $resource_id ) ] = true;
			}
		}

		$pending_fields = array();
		foreach ( $field_schema as $field ) {
			$field_key = isset( $field['key'] ) ? $this->normalize_field_key( $field['key'] ) : '';
			if ( '' !== $field_key && array_key_exists( $field_key, $normalized_drafts ) && ! isset( $stored_field_keys[ $field_key ] ) ) {
				$pending_fields[] = $field_key;
			}
		}

		$updated_records     = array();
		$replaced_fields     = array();
		$pending_field_index = 0;
		foreach ( $stored_records as $stored_record ) {
			$parts = explode( '^', $stored_record, 3 );
			if ( 3 !== count( $parts ) ) {
				$updated_records[] = $stored_record;
				continue;
			}
			$base_key = $this->get_stored_base_key( $parts[1], $resource_id );
			while (
				isset( $pending_fields[ $pending_field_index ] )
				&& isset( $schema_order[ $base_key ] )
				&& $schema_order[ $pending_fields[ $pending_field_index ] ] < $schema_order[ $base_key ]
			) {
				$pending_field_key = $pending_fields[ $pending_field_index ];
				$updated_records   = array_merge(
					$updated_records,
					$this->build_form_value_records(
						$schema_by_key[ $pending_field_key ],
						$normalized_drafts[ $pending_field_key ],
						$resource_id
					)
				);
				$replaced_fields[ $pending_field_key ] = true;
				++$pending_field_index;
			}
			if ( isset( $normalized_drafts[ $base_key ] ) ) {
				if ( ! isset( $replaced_fields[ $base_key ] ) ) {
					$updated_records = array_merge(
						$updated_records,
						$this->build_form_value_records(
							$schema_by_key[ $base_key ],
							$normalized_drafts[ $base_key ],
							$resource_id,
							$parts[0],
							$parts[1]
						)
					);
					$replaced_fields[ $base_key ] = true;
				}
				continue;
			}
			$updated_records[] = $stored_record;
		}

		while ( isset( $pending_fields[ $pending_field_index ] ) ) {
			$field_key = $pending_fields[ $pending_field_index ];
			$updated_records = array_merge(
				$updated_records,
				$this->build_form_value_records( $schema_by_key[ $field_key ], $normalized_drafts[ $field_key ], $resource_id )
			);
			$replaced_fields[ $field_key ] = true;
			++$pending_field_index;
		}

		return implode( '~', array_filter( $updated_records, 'strlen' ) );
	}

	/**
	 * Add server-derived updates for collapsed legacy `*_val` companions.
	 *
	 * The authoritative field resolver attaches companion metadata only when the
	 * canonical and display records are semantically equivalent. When that
	 * canonical field changes, this method maps the validated value to its
	 * configured display label and updates the existing companion record in the
	 * same persistence operation. The browser cannot request or identify a
	 * companion, and the derived write is intentionally absent from Activity so
	 * one customer-facing field change produces one change record.
	 *
	 * @param array<string,array<string,mixed>> $schema_by_key     Current schema keyed by field.
	 * @param array<string,int>                 $schema_order      Current schema positions.
	 * @param array<string,array<int,string>>   $normalized_drafts Validated changed values.
	 *
	 * @return void
	 */
	private function add_synchronized_companion_drafts( &$schema_by_key, &$schema_order, &$normalized_drafts ) {
		$canonical_drafts = $normalized_drafts;
		foreach ( $canonical_drafts as $field_key => $field_values ) {
			$field = isset( $schema_by_key[ $field_key ] ) ? $schema_by_key[ $field_key ] : array();
			$companion = isset( $field['storage_companion'] ) && is_array( $field['storage_companion'] )
				? $field['storage_companion']
				: array();
			$companion_key = isset( $companion['key'] ) ? $this->normalize_field_key( $companion['key'] ) : '';
			if ( '' === $companion_key || $field_key === $companion_key || isset( $schema_by_key[ $companion_key ] ) ) {
				continue;
			}

			$companion_values = $this->map_values_to_option_labels(
				$field_values,
				isset( $field['options'] ) && is_array( $field['options'] ) ? $field['options'] : array()
			);
			if ( null === $companion_values ) {
				$companion_values = array_values( array_map( 'strval', $field_values ) );
			}
			$current_companion_values = isset( $companion['values'] ) && is_array( $companion['values'] )
				? array_values( array_map( 'strval', $companion['values'] ) )
				: array();
			if ( $companion_values === $current_companion_values ) {
				continue;
			}

			$schema_by_key[ $companion_key ] = array(
				'key'      => $companion_key,
				'type'     => 'text',
				'values'   => $current_companion_values,
				'multiple' => 1 < count( $companion_values ),
				'required' => false,
				'options'  => array(),
			);
			$schema_order[ $companion_key ]  = isset( $schema_order[ $field_key ] ) ? $schema_order[ $field_key ] : count( $schema_order );
			$normalized_drafts[ $companion_key ] = $companion_values;
		}
	}

	/**
	 * Build a privacy-aware Activity change set from validated field changes.
	 *
	 * Exact values are represented only by configured display labels from a
	 * bounded choice field. Free-form fields and obvious personal-data field
	 * families carry only the fact that their value changed.
	 *
	 * @param array<int,array<string,mixed>> $field_schema      Current authorized field schema.
	 * @param array<string,array<int,string>> $normalized_drafts Validated changed values keyed by field.
	 *
	 * @return array<string,mixed> Versioned bounded Activity candidate.
	 */
	private function build_activity_change_set( $field_schema, $normalized_drafts ) {
		$change_records  = array();
		$total_changes   = 0;
		$maximum_changes = class_exists( 'WPBC_Booking_Activity_Change_Set' )
			? WPBC_Booking_Activity_Change_Set::MAX_CHANGES
			: 25;

		foreach ( $field_schema as $field ) {
			$field_key = is_array( $field ) && isset( $field['key'] ) ? $this->normalize_field_key( $field['key'] ) : '';
			if ( '' === $field_key || ! array_key_exists( $field_key, $normalized_drafts ) ) {
				continue;
			}
			++$total_changes;
			if ( $maximum_changes <= count( $change_records ) ) {
				continue;
			}

			$field_label = isset( $field['label'] ) ? sanitize_text_field( (string) $field['label'] ) : '';
			$field_label = '' !== $field_label ? $field_label : $field_key;
			$change_record = array(
				'field_key'   => $field_key,
				'label'       => $field_label,
				'value_policy' => 'redacted',
			);
			if ( $this->may_record_bounded_choice_labels( $field_key, $field ) ) {
				$before_labels = $this->map_values_to_option_labels(
					isset( $field['values'] ) && is_array( $field['values'] ) ? $field['values'] : array(),
					$field['options']
				);
				$after_labels  = $this->map_values_to_option_labels( $normalized_drafts[ $field_key ], $field['options'] );
				if ( null !== $before_labels && null !== $after_labels ) {
					$change_record['value_policy'] = 'bounded_choice';
					$change_record['before']       = $before_labels;
					$change_record['after']        = $after_labels;
				}
			}
			$change_records[] = $change_record;
		}

		if ( empty( $change_records ) ) {
			return array();
		}

		return array(
			'version'       => class_exists( 'WPBC_Booking_Activity_Change_Set' ) ? WPBC_Booking_Activity_Change_Set::VERSION : 1,
			'total_changes' => $total_changes,
			'changes'       => $change_records,
		);
	}

	/**
	 * Determine whether configured option labels may be retained for a field.
	 *
	 * @param string              $field_key Normalized field key.
	 * @param array<string,mixed> $field     Current authorized field schema.
	 *
	 * @return bool True only for a bounded, non-sensitive choice field.
	 */
	private function may_record_bounded_choice_labels( $field_key, $field ) {
		$field_type = isset( $field['type'] ) ? sanitize_key( $field['type'] ) : '';
		if ( ! in_array( $field_type, array( 'acceptance', 'checkbox', 'radio', 'select' ), true ) || empty( $field['options'] ) || ! is_array( $field['options'] ) ) {
			return false;
		}

		$sensitive_key_fragments = array(
			'name',
			'email',
			'phone',
			'address',
			'postcode',
			'zip',
			'message',
			'detail',
			'note',
			'request',
			'comment',
			'password',
			'token',
			'secret',
			'medical',
		);
		foreach ( $sensitive_key_fragments as $sensitive_key_fragment ) {
			if ( false !== strpos( $field_key, $sensitive_key_fragment ) ) {
				return false;
			}
		}
		if ( 1 === preg_match( '/(?:^|[:._-])city(?:$|[:._-])/', $field_key ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Resolve validated option values to configured display labels.
	 *
	 * Unknown values return null so legacy or stale option values are redacted
	 * rather than copied into the immutable Activity stream.
	 *
	 * @param array<int,string>              $field_values Current or proposed values.
	 * @param array<int,array<string,mixed>> $field_options Current authorized options.
	 *
	 * @return array<int,string>|null Display labels, or null when any value is unknown.
	 */
	private function map_values_to_option_labels( $field_values, $field_options ) {
		$option_labels = array();
		foreach ( $field_options as $field_option ) {
			if ( is_array( $field_option ) && isset( $field_option['value'], $field_option['label'] ) ) {
				$option_labels[ (string) $field_option['value'] ] = sanitize_text_field( (string) $field_option['label'] );
			}
		}

		$field_labels = array();
		foreach ( $field_values as $field_value ) {
			$field_value = (string) $field_value;
			if ( ! array_key_exists( $field_value, $option_labels ) ) {
				return null;
			}
			$field_labels[] = $option_labels[ $field_value ];
		}

		return $field_labels;
	}

	/**
	 * Build canonical storage records for one already normalized booking field.
	 *
	 * Existing type and name values are supplied when a stored record is being
	 * replaced so the update preserves both legacy storage compatibility and the
	 * field's original position. New records use the current authorized schema.
	 *
	 * @param array<string,mixed> $field        Current authorized field definition.
	 * @param array<int,string>   $field_values Already normalized field values.
	 * @param int                 $resource_id  Booking Resource ID.
	 * @param string              $record_type  Optional existing storage type.
	 * @param string              $record_name  Optional existing storage name.
	 *
	 * @return array<int,string> Canonical encoded field records.
	 */
	private function build_form_value_records( $field, $field_values, $resource_id, $record_type = '', $record_name = '' ) {
		$field_key   = isset( $field['key'] ) ? $this->normalize_field_key( $field['key'] ) : '';
		$record_type = '' !== $record_type ? sanitize_key( $record_type ) : $this->get_storage_type( $field );
		$record_name = '' !== $record_name ? (string) $record_name : $field_key . absint( $resource_id );
		$field_type  = isset( $field['type'] ) ? sanitize_key( $field['type'] ) : 'text';

		if ( ! empty( $field['multiple'] ) || 'checkbox' === $field_type ) {
			$record_name = rtrim( $record_name, '[]' ) . '[]';
		}

		$field_records = array();
		foreach ( $field_values as $field_value ) {
			$field_records[] = $record_type . '^' . $record_name . '^' . $field_value;
		}

		return $field_records;
	}

	/**
	 * Normalize one submitted field against its current server-generated schema.
	 *
	 * @param array<string,mixed> $field       Current field definition.
	 * @param mixed               $draft_value Submitted scalar or array.
	 *
	 * @return array<int,string>|WP_Error Safe values or validation error.
	 */
	private function normalize_field_value( $field, $draft_value ) {
		$field_type = isset( $field['type'] ) ? sanitize_key( $field['type'] ) : 'text';
		$raw_values = is_array( $draft_value ) ? $draft_value : array( $draft_value );
		$safe_values = array();
		foreach ( $raw_values as $raw_value ) {
			if ( ! is_scalar( $raw_value ) ) {
				continue;
			}
			$safe_value = 'textarea' === $field_type ? sanitize_textarea_field( (string) $raw_value ) : sanitize_text_field( (string) $raw_value );
			$safe_value = str_replace( array( '^', '~' ), '', $safe_value );
			if ( '' !== $safe_value ) {
				$safe_values[] = $safe_value;
			}
		}

		$allowed_values = array();
		foreach ( isset( $field['options'] ) && is_array( $field['options'] ) ? $field['options'] : array() as $field_option ) {
			if ( is_array( $field_option ) && isset( $field_option['value'] ) ) {
				$allowed_values[] = (string) $field_option['value'];
			}
		}
		if ( ! empty( $allowed_values ) && in_array( $field_type, array( 'acceptance', 'checkbox', 'radio', 'select' ), true ) ) {
			foreach ( $safe_values as $safe_value ) {
				if ( ! in_array( $safe_value, $allowed_values, true ) ) {
					return $this->get_field_error( __( 'Select a valid value for every booking field.', 'booking' ) );
				}
			}
		}
		if ( ! empty( $field['required'] ) && empty( $safe_values ) ) {
			return $this->get_field_error( sprintf( /* translators: %s: booking field label. */ __( '%s is required.', 'booking' ), $field['label'] ) );
		}
		if ( empty( $field['multiple'] ) && 'checkbox' !== $field_type && 1 < count( $safe_values ) ) {
			$safe_values = array_slice( $safe_values, 0, 1 );
		}

		return $safe_values;
	}

	/**
	 * Return a normalized base key from one canonical stored field name.
	 *
	 * @param string $stored_name Stored field name including Resource suffix.
	 * @param int    $resource_id Booking Resource ID.
	 *
	 * @return string Normalized base key.
	 */
	private function get_stored_base_key( $stored_name, $resource_id ) {
		$base_key = rtrim( (string) $stored_name, '[]' );
		$suffix   = (string) absint( $resource_id );
		if ( '' !== $suffix && $suffix === substr( $base_key, -strlen( $suffix ) ) ) {
			$base_key = substr( $base_key, 0, -strlen( $suffix ) );
		}

		return $this->normalize_field_key( $base_key );
	}

	/**
	 * Normalize a booking-form field key without collapsing supported separators.
	 *
	 * Booking form keys historically permit dots, colons, underscores, and
	 * hyphens. WordPress sanitize_key() removes dots and colons, which can make
	 * two valid form fields collide or make a submitted draft impossible to
	 * match to its server-generated schema.
	 *
	 * @param mixed $field_key Untrusted or stored booking-form field key.
	 *
	 * @return string Lowercase bounded field key.
	 */
	private function normalize_field_key( $field_key ) {
		$field_key = strtolower( (string) $field_key );
		$field_key = preg_replace( '/[^a-z0-9:._-]/', '', $field_key );

		return substr( (string) $field_key, 0, 190 );
	}

	/**
	 * Map a normalized presentation type to canonical form storage.
	 *
	 * @param array<string,mixed> $field Field definition.
	 *
	 * @return string Canonical storage type.
	 */
	private function get_storage_type( $field ) {
		$field_type = isset( $field['type'] ) ? sanitize_key( $field['type'] ) : 'text';

		return 'select' === $field_type ? 'selectbox' : $field_type;
	}

	/**
	 * Return payment statuses as a key-to-label map.
	 *
	 * @return array<string,string> Allowed payment status map.
	 */
	private function get_allowed_payment_statuses() {
		$allowed_statuses = array();
		$status_titles    = function_exists( 'get_payment_status_titles' ) ? (array) get_payment_status_titles() : array();
		foreach ( $status_titles as $status_label => $status_key ) {
			$status_key = sanitize_text_field( (string) $status_key );
			if ( '' !== $status_key ) {
				$allowed_statuses[ $status_key ] = sanitize_text_field( (string) $status_label );
			}
		}

		return $allowed_statuses;
	}

	/**
	 * Check an established booking action capability for the current user.
	 *
	 * @param string $action Booking action identifier.
	 *
	 * @return bool True when the current user may perform the action.
	 */
	private function current_user_can( $action ) {
		return function_exists( 'wpbc_is_user_can' ) && wpbc_is_user_can( $action, wpbc_get_current_user_id() );
	}

	/**
	 * Fire released hooks only after the complete row update succeeds.
	 *
	 * @param array<string,mixed> $booking       Previous booking row.
	 * @param array<string,mixed> $column_values Persisted changes.
	 * @param array<string,mixed> $activity_change_set Privacy-aware booking-field changes.
	 *
	 * @return void
	 */
	private function run_compatibility_hooks( $booking, $column_values, $activity_change_set = array() ) {
		$booking_id = isset( $booking['booking_id'] ) ? absint( $booking['booking_id'] ) : 0;
		if ( isset( $column_values['remark'] ) ) {
			do_action( 'wpbc_booking_action__note_saved', (string) $booking_id, $column_values['remark'] );
		}
		if ( isset( $column_values['cost'] ) ) {
			do_action( 'wpbc_booking_action__set_booking_cost', $booking_id, $column_values['cost'], isset( $booking['cost'] ) ? $booking['cost'] : '' );
		}
		if ( isset( $column_values['pay_status'] ) ) {
			do_action( 'wpbc_booking_action__set_payment_status', $booking_id, $column_values['pay_status'], isset( $booking['pay_status'] ) ? $booking['pay_status'] : '' );
		}
		do_action( 'wpbc_booking_inspector_booking_updated', $booking_id, array_keys( $column_values ), $activity_change_set );
	}

	/**
	 * Return a safe field-validation error.
	 *
	 * @param string $message Translated validation message.
	 *
	 * @return WP_Error Validation error.
	 */
	private function get_field_error( $message ) {
		return new WP_Error(
			'wpbc_booking_inspector_update_invalid_field',
			sanitize_text_field( $message ),
			array( 'status' => 400 )
		);
	}
}
