<?php
/**
 * Normalization for executable-free catalog editing field contracts.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize the common field shape without deciding domain field availability.
 *
 * This class exists so every catalog can expose the same safe browser contract
 * while keeping field selection, authorization, validation, and mutations in
 * its domain module.
 *
 * @since 11.6.0
 */
final class WPBC_UI_Catalog_Inline_Field_Schema {

	/**
	 * Supported browser control types.
	 *
	 * @var array<int,string>
	 */
	const CONTROL_TYPES = array( 'text', 'textarea', 'number', 'select' );

	/**
	 * Normalize a list of domain-authorized field definitions.
	 *
	 * Unknown properties, callbacks, objects, and malformed options are removed.
	 * A domain must still validate the field and its value again at preview and
	 * apply time.
	 *
	 * @param mixed $raw_fields Domain field definitions.
	 * @return array<int,array<string,mixed>> Browser-safe field definitions.
	 */
	public static function normalize_fields( $raw_fields ) {
		$normalized_fields = array();

		foreach ( is_array( $raw_fields ) ? $raw_fields : array() as $raw_field ) {
			$normalized_field = self::normalize_field( $raw_field );
			if ( ! empty( $normalized_field ) ) {
				$normalized_fields[] = $normalized_field;
			}
		}

		return $normalized_fields;
	}

	/**
	 * Index normalized fields by their stable key.
	 *
	 * @param mixed $raw_fields Domain field definitions.
	 * @return array<string,array<string,mixed>> Fields keyed by field key.
	 */
	public static function index_fields( $raw_fields ) {
		$indexed_fields = array();

		foreach ( self::normalize_fields( $raw_fields ) as $field ) {
			$indexed_fields[ $field['key'] ] = $field;
		}

		return $indexed_fields;
	}

	/**
	 * Normalize one common field definition.
	 *
	 * @param mixed $raw_field Raw field definition.
	 * @return array<string,mixed> Normalized definition or an empty array.
	 */
	private static function normalize_field( $raw_field ) {
		if ( ! is_array( $raw_field ) ) {
			return array();
		}

		$field_key    = isset( $raw_field['key'] ) && is_scalar( $raw_field['key'] ) ? sanitize_key( (string) $raw_field['key'] ) : '';
		$control_type = isset( $raw_field['type'] ) && is_scalar( $raw_field['type'] ) ? sanitize_key( (string) $raw_field['type'] ) : '';
		if ( '' === $field_key || ! in_array( $control_type, self::CONTROL_TYPES, true ) ) {
			return array();
		}

		$normalized_field = array(
			'key'     => $field_key,
			'column'  => isset( $raw_field['column'] ) && is_scalar( $raw_field['column'] ) ? sanitize_key( (string) $raw_field['column'] ) : '',
			'label'   => isset( $raw_field['label'] ) && is_scalar( $raw_field['label'] ) ? wp_strip_all_tags( (string) $raw_field['label'] ) : $field_key,
			'type'    => $control_type,
			'value'   => isset( $raw_field['value'] ) && is_scalar( $raw_field['value'] ) ? (string) $raw_field['value'] : '',
			'options' => self::normalize_choices( isset( $raw_field['options'] ) ? $raw_field['options'] : array() ),
		);

		foreach ( array( 'prefix', 'suffix', 'help', 'section' ) as $property_name ) {
			if ( isset( $raw_field[ $property_name ] ) && is_scalar( $raw_field[ $property_name ] ) ) {
				$normalized_field[ $property_name ] = wp_strip_all_tags( (string) $raw_field[ $property_name ] );
			}
		}
		foreach ( array( 'min', 'max', 'step', 'maxlength', 'default_value', 'slider_min', 'slider_max', 'slider_step' ) as $property_name ) {
			if ( isset( $raw_field[ $property_name ] ) && is_numeric( $raw_field[ $property_name ] ) ) {
				$normalized_field[ $property_name ] = (float) $raw_field[ $property_name ];
			}
		}
		if ( isset( $raw_field['operations'] ) ) {
			$normalized_field['operations'] = self::normalize_choices( $raw_field['operations'], 'id' );
		}

		return $normalized_field;
	}

	/**
	 * Normalize select options or bulk operations into value-label records.
	 *
	 * @param mixed  $raw_choices Raw choices.
	 * @param string $value_key   Choice key containing the stable value.
	 * @return array<int,array<string,string>> Browser-safe choices.
	 */
	private static function normalize_choices( $raw_choices, $value_key = 'value' ) {
		$normalized_choices = array();

		foreach ( is_array( $raw_choices ) ? $raw_choices : array() as $raw_key => $raw_choice ) {
			if ( is_array( $raw_choice ) ) {
				$choice_value = isset( $raw_choice[ $value_key ] ) && is_scalar( $raw_choice[ $value_key ] ) ? (string) $raw_choice[ $value_key ] : '';
				$choice_label = isset( $raw_choice['label'] ) && is_scalar( $raw_choice['label'] ) ? (string) $raw_choice['label'] : $choice_value;
			} else {
				$is_list_choice = is_int( $raw_key );
				$choice_value   = $is_list_choice && is_scalar( $raw_choice ) ? (string) $raw_choice : ( is_scalar( $raw_key ) ? (string) $raw_key : '' );
				$choice_label   = is_scalar( $raw_choice ) ? (string) $raw_choice : $choice_value;
			}
			$choice_value = sanitize_key( $choice_value );
			if ( '' !== $choice_value ) {
				$normalized_choices[] = array(
					$value_key => $choice_value,
					'label'    => wp_strip_all_tags( $choice_label ),
				);
			}
		}

		return $normalized_choices;
	}
}
