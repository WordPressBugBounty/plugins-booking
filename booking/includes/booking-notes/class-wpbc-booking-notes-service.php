<?php
/**
 * Reusable Booking Notes service.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize canonical note storage into an explicit reusable contract.
 */
final class WPBC_Booking_Notes_Service {

	/** Storage or edition does not expose the note field. */
	const STATE_MISSING = 'missing';

	/** The note field exists and retains its never-set NULL value. */
	const STATE_EMPTY   = 'empty';

	/** The note field exists and was explicitly saved as an empty string. */
	const STATE_CLEARED = 'cleared';

	/** The note field contains a non-empty value. */
	const STATE_VALUE   = 'value';

	/** @var WPBC_Booking_Notes_Repository Canonical notes repository. */
	private $repository;

	/**
	 * Construct the service with an optional repository.
	 *
	 * @param WPBC_Booking_Notes_Repository|null $repository Optional repository for tests or alternate hosts.
	 */
	public function __construct( $repository = null ) {
		$this->repository = $repository ? $repository : new WPBC_Booking_Notes_Repository();
	}

	/**
	 * Load and normalize one authorized booking's note contract.
	 *
	 * The caller remains responsible for booking authorization. This service
	 * intentionally performs no customer-facing output integration and no write.
	 *
	 * @param int  $booking_id                   Authorized booking ID.
	 * @param bool $include_legacy_private_note Whether legacy remark storage is available.
	 *
	 * @return array<string,array<string,mixed>>|WP_Error|null Normalized note contract, safe error, or null.
	 */
	public function get_booking_notes( $booking_id, $include_legacy_private_note ) {
		$stored_notes = $this->repository->get_booking_notes( $booking_id, $include_legacy_private_note );
		if ( is_wp_error( $stored_notes ) || null === $stored_notes ) {
			return $stored_notes;
		}

		return $this->normalize_contract( $stored_notes );
	}

	/**
	 * Load notes for a trusted internal email composition workflow.
	 *
	 * This method permits the repository to read a booking after it was moved to
	 * Trash. It does not decide which note may be exposed; the email integration
	 * must still enforce its administrator-versus-customer audience contract.
	 *
	 * @param int  $booking_id                   Canonical booking ID.
	 * @param bool $include_legacy_private_note Whether legacy remark storage is needed.
	 *
	 * @return array<string,array<string,mixed>>|WP_Error|null Normalized note contract, safe error, or null.
	 */
	public function get_booking_notes_for_email( $booking_id, $include_legacy_private_note ) {
		$stored_notes = $this->repository->get_booking_notes_for_email( $booking_id, $include_legacy_private_note );
		if ( is_wp_error( $stored_notes ) || null === $stored_notes ) {
			return $stored_notes;
		}

		return $this->normalize_contract( $stored_notes );
	}

	/**
	 * Normalize repository values without conflating missing, NULL, or cleared.
	 *
	 * This public data-only boundary allows other authorized administration
	 * hosts to consume the same semantics without duplicating storage rules.
	 *
	 * @param array<string,mixed> $stored_notes Repository note values.
	 *
	 * @return array<string,array<string,mixed>> Public and private note records.
	 */
	public function normalize_contract( $stored_notes ) {
		$public_note_supported  = array_key_exists( 'public_note_supported', $stored_notes )
			? ! empty( $stored_notes['public_note_supported'] )
			: array_key_exists( 'public_note', $stored_notes );
		$private_note_supported = ! empty( $stored_notes['private_note_supported'] );

		return array(
			'public'  => $this->normalize_note(
				'public',
				$public_note_supported,
				array_key_exists( 'public_note', $stored_notes ),
				array_key_exists( 'public_note', $stored_notes ) ? $stored_notes['public_note'] : null
			),
			'private' => $this->normalize_note(
				'private',
				$private_note_supported,
				array_key_exists( 'private_note', $stored_notes ),
				array_key_exists( 'private_note', $stored_notes ) ? $stored_notes['private_note'] : null
			),
		);
	}

	/**
	 * Validate and persist the legacy private note through the notes repository.
	 *
	 * This method intentionally preserves an empty string as an explicit clear.
	 * Authorization and ownership checks remain the responsibility of the host
	 * action before it invokes this domain service.
	 *
	 * @param array<int|string> $booking_ids                  Authorized booking IDs.
	 * @param mixed             $private_note                 Untrusted private note value.
	 * @param bool              $legacy_private_note_supported Whether legacy remark storage exists.
	 *
	 * @return true|WP_Error True after persistence, or a safe validation/storage error.
	 */
	public function update_private_note( $booking_ids, $private_note, $legacy_private_note_supported ) {
		if ( ! $legacy_private_note_supported ) {
			return new WP_Error(
				'wpbc_booking_notes_private_unsupported',
				__( 'Private notes are not available for this booking.', 'booking' )
			);
		}

		$normalized_booking_ids = array_values( array_unique( array_filter( array_map( 'absint', $booking_ids ) ) ) );
		if ( empty( $normalized_booking_ids ) ) {
			return new WP_Error(
				'wpbc_booking_notes_invalid_booking',
				__( 'No bookings have been selected. Please select one or more bookings.', 'booking' )
			);
		}

		$normalized_private_note = sanitize_textarea_field( (string) $private_note );

		return $this->repository->update_private_note( $normalized_booking_ids, $normalized_private_note );
	}

	/**
	 * Normalize one note while retaining its canonical storage state.
	 *
	 * @param string $note_type      Stable note type.
	 * @param bool   $supported      Whether canonical storage exists in this edition.
	 * @param bool   $value_present  Whether the repository returned the field.
	 * @param mixed  $stored_value   Raw nullable stored value.
	 *
	 * @return array<string,mixed> Normalized note record.
	 */
	private function normalize_note( $note_type, $supported, $value_present, $stored_value ) {
		$note_state = self::STATE_VALUE;
		$note_value = null;

		if ( ! $supported || ! $value_present ) {
			$note_state = self::STATE_MISSING;
		} elseif ( null === $stored_value ) {
			$note_state = self::STATE_EMPTY;
		} elseif ( '' === (string) $stored_value ) {
			$note_state = self::STATE_CLEARED;
			$note_value = '';
		} else {
			$note_value = sanitize_textarea_field( (string) $stored_value );
		}

		return array(
			'type'      => sanitize_key( $note_type ),
			'supported' => (bool) $supported,
			'state'     => $note_state,
			'value'     => $note_value,
		);
	}
}
