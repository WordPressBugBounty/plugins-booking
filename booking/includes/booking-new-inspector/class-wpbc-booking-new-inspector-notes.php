<?php
/**
 * Authorized creation-note contract for Add New Booking Inspector.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Projects and validates the note fields that may participate in creation.
 *
 * The contract deliberately mirrors the released Booking Inspector permissions:
 * public notes require editable Booking access and public-note storage; private
 * notes additionally require the established `set_booking_note` permission.
 */
final class WPBC_Booking_New_Inspector_Notes {

	/**
	 * Return the currently authorized, executable-free note definitions.
	 *
	 * @return array<int,array<string,mixed>> Ordered JSON-safe note definitions.
	 */
	public function get_authorized_definitions() {
		if ( ! $this->current_user_can_edit_booking() ) {
			return array();
		}

		$definitions = array();
		if ( $this->column_exists( 'public_note' ) ) {
			$definitions[] = $this->build_definition(
				'public',
				__( 'Public note', 'booking' ),
				__( 'Not automatically sent or displayed', 'booking' )
			);
		}
		if ( $this->column_exists( 'remark' ) && $this->current_user_can_set_private_note() ) {
			$definitions[] = $this->build_definition(
				'private',
				__( 'Private note', 'booking' ),
				__( 'Administrators only', 'booking' )
			);
		}

		return $definitions;
	}

	/**
	 * Validate an exact creation-note draft against current authority and storage.
	 *
	 * Unknown, missing, non-scalar, oversized, or no-longer-authorized values are
	 * rejected so Review and Apply cannot broaden the bootstrap definition.
	 *
	 * @param mixed $draft_notes Untrusted note values keyed by stable note type.
	 * @return array<string,string>|WP_Error Canonical note values or safe error.
	 */
	public function validate_draft( $draft_notes ) {
		if ( ! is_array( $draft_notes ) || ( ! empty( $draft_notes ) && array_values( $draft_notes ) === $draft_notes ) ) {
			return $this->get_invalid_error();
		}

		$definitions = $this->get_authorized_definitions();
		$allowed     = array();
		foreach ( $definitions as $definition ) {
			$allowed[ $definition['type'] ] = true;
		}

		$actual_keys   = array_keys( $draft_notes );
		$expected_keys = array_keys( $allowed );
		sort( $actual_keys );
		sort( $expected_keys );
		if ( $actual_keys !== $expected_keys ) {
			return $this->get_invalid_error();
		}

		$normalized_notes = array();
		foreach ( $expected_keys as $note_type ) {
			if ( ! is_scalar( $draft_notes[ $note_type ] ) ) {
				return $this->get_invalid_error();
			}
			$raw_note = (string) $draft_notes[ $note_type ];
			if ( WPBC_Booking_New_Inspector_Config::MAX_NOTE_VALUE_BYTES < strlen( $raw_note ) ) {
				return $this->get_invalid_error();
			}
			$normalized_notes[ $note_type ] = sanitize_textarea_field( $raw_note );
		}

		return $normalized_notes;
	}

	/**
	 * Project canonical notes into authorized Review rows.
	 *
	 * @param array<string,string> $notes Canonical note values.
	 * @return array<int,array<string,string>> Ordered review-note DTOs.
	 */
	public function get_review_rows( $notes ) {
		$rows = array();
		foreach ( $this->get_authorized_definitions() as $definition ) {
			$note_type = $definition['type'];
			$rows[]    = array(
				'type'     => $note_type,
				'label'    => $definition['label'],
				'audience' => $definition['audience'],
				'value'    => isset( $notes[ $note_type ] ) ? (string) $notes[ $note_type ] : '',
			);
		}

		return $rows;
	}

	/**
	 * Build one empty note definition for the browser DTO.
	 *
	 * @param string $note_type Stable public or private type.
	 * @param string $label     Translated note label.
	 * @param string $audience  Translated audience description.
	 * @return array<string,mixed> JSON-safe note definition.
	 */
	private function build_definition( $note_type, $label, $audience ) {
		return array(
			'type'      => $note_type,
			'label'     => sanitize_text_field( $label ),
			'audience'  => sanitize_text_field( $audience ),
			'value'     => '',
			'maxlength' => WPBC_Booking_New_Inspector_Config::MAX_NOTE_VALUE_BYTES,
		);
	}

	/**
	 * Check the released edit-booking permission for the effective user.
	 *
	 * @return bool True when note editing may be exposed.
	 */
	private function current_user_can_edit_booking() {
		return function_exists( 'wpbc_is_user_can' )
			&& function_exists( 'wpbc_get_current_user_id' )
			&& wpbc_is_user_can( 'edit_booking', wpbc_get_current_user_id() );
	}

	/**
	 * Check the released private-note permission for the effective user.
	 *
	 * @return bool True when private notes may be exposed.
	 */
	private function current_user_can_set_private_note() {
		return function_exists( 'wpbc_is_user_can' )
			&& function_exists( 'wpbc_get_current_user_id' )
			&& wpbc_is_user_can( 'set_booking_note', wpbc_get_current_user_id() );
	}

	/**
	 * Check one allow-listed Booking Notes storage column.
	 *
	 * @param string $column_name Supported column name.
	 * @return bool True when current-site storage exists.
	 */
	private function column_exists( $column_name ) {
		return function_exists( 'wpbc_booking_notes_column_exists' )
			&& wpbc_booking_notes_column_exists( $column_name );
	}

	/**
	 * Return a non-sensitive invalid-note error.
	 *
	 * @return WP_Error Safe validation error.
	 */
	private function get_invalid_error() {
		return new WP_Error(
			'wpbc_booking_new_inspector_notes_invalid',
			__( 'The booking notes are invalid or are no longer authorized. Review the booking and try again.', 'booking' ),
			array( 'status' => 400 )
		);
	}
}
