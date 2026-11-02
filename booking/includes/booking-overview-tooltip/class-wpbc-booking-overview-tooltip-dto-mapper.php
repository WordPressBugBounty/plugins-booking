<?php
/**
 * Bounded Booking Overview Context Popover DTO mapping.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Project authorized booking-card presentation into a compact popover DTO.
 */
final class WPBC_Booking_Overview_Tooltip_DTO_Mapper {

	/** Booking Overview DTO schema version. */
	const SCHEMA_VERSION = 1;

	/** Maximum length of the booking label. */
	const MAXIMUM_LABEL_LENGTH = 200;

	/** Maximum length of compact presentation labels. */
	const MAXIMUM_META_LENGTH = 160;

	/**
	 * Map one authorized booking-card projection to the overview contract.
	 *
	 * The input must contain presentation-safe values already authorized for the
	 * current Timeline card. The allow list intentionally excludes notes, raw
	 * form storage, ownership metadata, capabilities, and financial values.
	 *
	 * @param array<string,mixed> $card Authorized booking-card presentation.
	 *
	 * @return array<string,mixed> Bounded JSON-safe overview DTO.
	 */
	public function map_card( $card ) {
		$booking_id = isset( $card['booking_id'] ) ? absint( $card['booking_id'] ) : 0;
		if ( ! $booking_id ) {
			return array();
		}
		$status_key = isset( $card['status'] ) && 'pending' === sanitize_key( (string) $card['status'] )
			? 'pending'
			: 'approved';

		return array(
			'schema_version'          => self::SCHEMA_VERSION,
			'booking_id'              => $booking_id,
			'resource_id'             => isset( $card['resource_id'] ) ? absint( $card['resource_id'] ) : 0,
			'heading'                 => sprintf(
				/* translators: %d: booking ID. */
				__( 'Booking #%d', 'booking' ),
				$booking_id
			),
			'label'                   => $this->normalize_text(
				isset( $card['label'] ) ? $card['label'] : '',
				self::MAXIMUM_LABEL_LENGTH
			),
			'status_key'              => $status_key,
			'status_label'            => $this->normalize_text(
				isset( $card['status_label'] ) ? $card['status_label'] : '',
				self::MAXIMUM_META_LENGTH
			),
			'start_label'             => $this->normalize_text(
				isset( $card['start_label'] ) ? $card['start_label'] : '',
				self::MAXIMUM_META_LENGTH
			),
			'end_label'               => $this->normalize_text(
				isset( $card['end_label'] ) ? $card['end_label'] : '',
				self::MAXIMUM_META_LENGTH
			),
			'date_label'              => $this->normalize_text(
				isset( $card['date_label'] ) ? $card['date_label'] : '',
				self::MAXIMUM_META_LENGTH
			),
			'duration_label'          => $this->normalize_text(
				isset( $card['duration_label'] ) ? $card['duration_label'] : '',
				self::MAXIMUM_META_LENGTH
			),
			'is_clipped_start'        => ! empty( $card['is_clipped_start'] ),
			'is_clipped_end'          => ! empty( $card['is_clipped_end'] ),
			'continues_before_label'  => $this->normalize_text(
				isset( $card['continues_before_label'] ) ? $card['continues_before_label'] : '',
				self::MAXIMUM_META_LENGTH
			),
			'continues_after_label'   => $this->normalize_text(
				isset( $card['continues_after_label'] ) ? $card['continues_after_label'] : '',
				self::MAXIMUM_META_LENGTH
			),
		);
	}

	/**
	 * Sanitize and bound one presentation string without interpreting it.
	 *
	 * @param mixed $text       Candidate scalar text.
	 * @param int   $max_length Maximum Unicode character count.
	 *
	 * @return string Sanitized bounded text.
	 */
	private function normalize_text( $text, $max_length ) {
		$text = is_scalar( $text ) ? sanitize_text_field( (string) $text ) : '';
		if ( function_exists( 'mb_substr' ) ) {
			return mb_substr( $text, 0, $max_length );
		}

		return wp_check_invalid_utf8( substr( $text, 0, $max_length ), true );
	}
}
