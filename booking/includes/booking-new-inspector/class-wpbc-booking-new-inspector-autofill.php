<?php
/**
 * Logged-in-user initial values for Add New Booking Inspector field DTOs.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Applies Booking-domain auto-fill values to authorized Inspector field DTOs.
 */
final class WPBC_Booking_New_Inspector_Autofill {

	/** @var WPBC_Booking_Logged_User_Autofill Booking auto-fill resolver. */
	private $logged_user_autofill;

	/**
	 * Construct the Inspector projector.
	 *
	 * @param WPBC_Booking_Logged_User_Autofill|null $logged_user_autofill Optional resolver for tests.
	 */
	public function __construct( $logged_user_autofill = null ) {
		$this->logged_user_autofill = $logged_user_autofill
			? $logged_user_autofill
			: new WPBC_Booking_Logged_User_Autofill();
	}

	/**
	 * Populate empty supported DTO fields with current-user initial values.
	 *
	 * Existing scalar or multi-value field values are preserved. Schedule,
	 * option, acceptance, hidden, system, and unsupported controls are never
	 * populated by this projector.
	 *
	 * Profile strings remain untrusted data. The Inspector's WordPress templates
	 * must use escaped interpolation, and Review/Apply must validate the values
	 * against the current exact-form contract before using or persisting them.
	 *
	 * @param array<int,array<string,mixed>> $field_dtos Authorized exact-form fields.
	 *
	 * @return array<int,array<string,mixed>> Field DTOs with initial values.
	 */
	public function apply( $field_dtos ) {
		$field_dtos = is_array( $field_dtos ) ? $field_dtos : array();
		$fill_values = $this->logged_user_autofill->get_fill_values();
		if ( empty( $field_dtos ) || empty( $fill_values ) ) {
			return $field_dtos;
		}

		foreach ( $field_dtos as $field_index => $field_dto ) {
			if ( ! is_array( $field_dto ) || ! empty( $field_dto['multiple'] ) ) {
				continue;
			}

			$current_value = isset( $field_dto['value'] ) && is_scalar( $field_dto['value'] )
				? (string) $field_dto['value']
				: '';
			if ( '' !== $current_value ) {
				continue;
			}

			$field_value = $this->logged_user_autofill->get_field_value(
				isset( $field_dto['key'] ) ? (string) $field_dto['key'] : '',
				isset( $field_dto['type'] ) ? (string) $field_dto['type'] : '',
				$fill_values
			);
			if ( '' !== $field_value ) {
				$field_dtos[ $field_index ]['value'] = $field_value;
			}
		}

		return $field_dtos;
	}
}
