<?php
/**
 * Booking Resources inline and bulk field definitions.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Produce current Resource field contracts from the domain inspector schema.
 *
 * The provider selects presentation-safe fields only. Resource mutation
 * services remain responsible for request-time authorization and validation.
 *
 * @since 11.6.0
 */
final class WPBC_Catalog_Booking_Resources_Inline_Fields implements WPBC_UI_Catalog_Inline_Fields {

	/** @var WPBC_Catalog_Booking_Resource_Inspector_Schema Resource schema service. */
	private $schema;

	/** @var array<int,array<string,array<string,mixed>>> Request-local field cache. */
	private $field_cache = array();

	/**
	 * Construct the provider with an optional schema service for tests.
	 *
	 * @param WPBC_Catalog_Booking_Resource_Inspector_Schema|null $schema Resource schema service.
	 */
	public function __construct( $schema = null ) {
		$this->schema = $schema instanceof WPBC_Catalog_Booking_Resource_Inspector_Schema ? $schema : new WPBC_Catalog_Booking_Resource_Inspector_Schema();
	}

	/**
	 * Return inline-safe fields for one authorized Resource.
	 *
	 * @param array<string,mixed> $record Current authorized Resource.
	 * @return array<int,array<string,mixed>> Browser-safe field definitions.
	 */
	public function get_inline_fields( $record ) {
		$column_map = array(
			'title'        => 'resource',
			'description'  => 'resource',
			'base_cost'    => 'price',
			'default_form' => 'default_form',
			'priority'     => 'priority',
		);
		$inline_fields = array();

		foreach ( $this->get_indexed_fields( $record ) as $field_key => $field ) {
			if ( empty( $field['editable'] ) || ! isset( $column_map[ $field_key ] ) || ! in_array( $field['type'], WPBC_UI_Catalog_Inline_Field_Schema::CONTROL_TYPES, true ) ) {
				continue;
			}
			$field['column'] = $column_map[ $field_key ];
			$inline_fields[] = $field;
		}

		return WPBC_UI_Catalog_Inline_Field_Schema::normalize_fields( $inline_fields );
	}

	/**
	 * Return fields safely shared by every authorized Resource.
	 *
	 * @param array<int,array<string,mixed>> $records Authorized Resources.
	 * @return array<int,array<string,mixed>> Common browser-safe fields.
	 */
	public function get_bulk_fields( $records ) {
		$allowed_keys        = array( 'searchable_status', 'availability_mode', 'base_cost', 'default_form', 'priority', 'owner_user_id' );
		$fields_by_resource  = array();

		foreach ( $records as $record ) {
			$resource_fields = $this->get_indexed_fields( $record );
			foreach ( $resource_fields as $field_key => $field ) {
				if ( ! in_array( $field_key, $allowed_keys, true ) || empty( $field['editable'] ) ) {
					unset( $resource_fields[ $field_key ] );
				}
			}
			$fields_by_resource[] = $resource_fields;
		}

		$common_fields = array();
		foreach ( $allowed_keys as $field_key ) {
			$field_definitions = array();
			foreach ( $fields_by_resource as $resource_fields ) {
				if ( ! isset( $resource_fields[ $field_key ] ) ) {
					$field_definitions = array();
					break;
				}
				$field_definitions[] = $resource_fields[ $field_key ];
			}
			if ( empty( $field_definitions ) || ( 'owner_user_id' === $field_key && $this->selection_has_hierarchy( $records ) ) ) {
				continue;
			}
			$field_definition = $field_definitions[0];
			if ( in_array( $field_key, array( 'searchable_status', 'availability_mode', 'default_form', 'owner_user_id' ), true ) ) {
				$field_definition['options'] = $this->intersect_options( $field_definitions, 'owner_user_id' === $field_key );
				if ( empty( $field_definition['options'] ) ) {
					continue;
				}
			}
			$common_fields[] = $field_definition;
		}

		return WPBC_UI_Catalog_Inline_Field_Schema::normalize_fields( $common_fields );
	}

	/**
	 * Return current inspector fields indexed by stable key.
	 *
	 * @param array<string,mixed> $resource Authorized Resource.
	 * @return array<string,array<string,mixed>> Current Resource fields.
	 */
	public function get_indexed_fields( $resource ) {
		$resource_id = isset( $resource['id'] ) ? absint( $resource['id'] ) : 0;
		if ( $resource_id && isset( $this->field_cache[ $resource_id ] ) ) {
			return $this->field_cache[ $resource_id ];
		}
		$contract = $this->schema->get_edit_schema( $resource );
		$fields   = array();
		if ( ! is_wp_error( $contract ) ) {
			foreach ( isset( $contract['sections'] ) ? (array) $contract['sections'] : array() as $section ) {
				foreach ( isset( $section['fields'] ) ? (array) $section['fields'] : array() as $field ) {
					if ( ! empty( $field['key'] ) ) {
						$fields[ sanitize_key( $field['key'] ) ] = $field;
					}
				}
			}
		}
		if ( $resource_id ) {
			$this->field_cache[ $resource_id ] = $fields;
		}

		return $fields;
	}

	/**
	 * Intersect select choices across current Resource schemas.
	 *
	 * @param array<int,array<string,mixed>> $definitions Field definitions.
	 * @param bool                           $exclude_zero Whether zero cannot be assigned.
	 * @return array<int,array{value:string,label:string}> Common choices.
	 */
	private function intersect_options( $definitions, $exclude_zero ) {
		$options = array();
		foreach ( isset( $definitions[0]['options'] ) ? (array) $definitions[0]['options'] : array() as $option ) {
			$option_value = isset( $option['value'] ) ? (string) $option['value'] : '';
			if ( $exclude_zero && '0' === $option_value ) {
				continue;
			}
			$is_common = true;
			foreach ( array_slice( $definitions, 1 ) as $definition ) {
				if ( ! in_array( $option_value, array_map( 'strval', wp_list_pluck( isset( $definition['options'] ) ? $definition['options'] : array(), 'value' ) ), true ) ) {
					$is_common = false;
					break;
				}
			}
			if ( $is_common ) {
				$options[] = array(
					'value' => $option_value,
					'label' => isset( $option['label'] ) ? wp_strip_all_tags( (string) $option['label'] ) : $option_value,
				);
			}
		}

		return $options;
	}

	/**
	 * Determine whether ownership editing could split a Resource hierarchy.
	 *
	 * @param array<int,array<string,mixed>> $resources Authorized Resources.
	 * @return bool True when a parent or child is present.
	 */
	private function selection_has_hierarchy( $resources ) {
		foreach ( $resources as $resource ) {
			if ( ! empty( $resource['parent_id'] ) || ! empty( $resource['child_count'] ) ) {
				return true;
			}
		}

		return false;
	}
}
