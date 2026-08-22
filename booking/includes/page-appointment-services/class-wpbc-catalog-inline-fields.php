<?php
/**
 * Appointment Services inline and bulk field definitions.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Produce current Service editing fields without owning mutations.
 *
 * Field availability follows the current edition and authorized selection;
 * preview and apply services rebuild this contract before accepting values.
 *
 * @since 11.6.0
 */
final class WPBC_Appointment_Services_Catalog_Inline_Fields implements WPBC_UI_Catalog_Inline_Fields {

	/**
	 * Return inline-safe fields for one authorized Service.
	 *
	 * @param array<string,mixed> $record Current authorized Service.
	 * @return array<int,array<string,mixed>> Browser-safe field definitions.
	 */
	public function get_inline_fields( $record ) {
		$fields = array(
			array( 'key' => 'title', 'column' => 'service', 'label' => __( 'Title', 'booking' ), 'type' => 'text', 'value' => isset( $record['title'] ) ? (string) $record['title'] : '', 'maxlength' => 200 ),
			array( 'key' => 'description', 'column' => 'service', 'label' => __( 'Description', 'booking' ), 'type' => 'textarea', 'value' => isset( $record['description'] ) ? (string) $record['description'] : '', 'maxlength' => 2000 ),
			array( 'key' => 'duration_minutes', 'column' => 'duration', 'label' => __( 'Duration', 'booking' ), 'type' => 'number', 'value' => isset( $record['duration_minutes'] ) ? (string) absint( $record['duration_minutes'] ) : '', 'min' => 1, 'max' => 1440, 'step' => 1 ),
		);
		if ( wpbc_appointment_services_is_pricing_available() ) {
			$fields[] = array( 'key' => 'base_cost', 'column' => 'price', 'label' => __( 'Price', 'booking' ), 'type' => 'number', 'value' => isset( $record['base_cost'] ) ? (string) $record['base_cost'] : '', 'min' => 0, 'max' => 1000, 'step' => 1 );
		}

		return WPBC_UI_Catalog_Inline_Field_Schema::normalize_fields( $fields );
	}

	/**
	 * Return fields safely shared by every authorized Service.
	 *
	 * @param array<int,array<string,mixed>> $records Authorized Services.
	 * @return array<int,array<string,mixed>> Common browser-safe fields.
	 */
	public function get_bulk_fields( $records ) {
		$fields = array(
			array( 'key' => 'duration_minutes', 'label' => __( 'Duration', 'booking' ), 'type' => 'number', 'min' => 1, 'max' => 1440, 'step' => 1, 'default_value' => 30 ),
			array( 'key' => 'buffer_before_minutes', 'label' => __( 'Buffer before', 'booking' ), 'type' => 'number', 'min' => 0, 'max' => 1440, 'step' => 1, 'default_value' => 0 ),
			array( 'key' => 'buffer_after_minutes', 'label' => __( 'Buffer after', 'booking' ), 'type' => 'number', 'min' => 0, 'max' => 1440, 'step' => 1, 'default_value' => 0 ),
			array(
				'key'     => 'status',
				'label'   => __( 'Status', 'booking' ),
				'type'    => 'select',
				'options' => array(
					array( 'value' => 'active', 'label' => __( 'Active', 'booking' ) ),
					array( 'value' => 'inactive', 'label' => __( 'Draft', 'booking' ) ),
					array( 'value' => 'archived', 'label' => __( 'Archived', 'booking' ) ),
				),
			),
		);
		if ( wpbc_appointment_services_is_pricing_available() ) {
			array_splice( $fields, 3, 0, array( array( 'key' => 'base_cost', 'label' => __( 'Price', 'booking' ), 'type' => 'number', 'min' => 0, 'max' => 1000, 'step' => 1, 'default_value' => 0 ) ) );
		}
		$owner_ids = array_values( array_unique( array_map( 'absint', wp_list_pluck( $records, 'owner_user_id' ) ) ) );
		if ( ! wpbc_appointment_services_can_view_all_owners() && 2 > count( $owner_ids ) ) {
			$form_options = array();
			foreach ( wpbc_appointment_services_get_form_options() as $form_id => $form_label ) {
				$form_options[] = array( 'value' => (string) absint( $form_id ), 'label' => $form_label );
			}
			array_splice( $fields, count( $fields ) - 1, 0, array( array( 'key' => 'booking_form_id', 'label' => __( 'Booking Form', 'booking' ), 'type' => 'select', 'options' => $form_options ) ) );
		}

		return WPBC_UI_Catalog_Inline_Field_Schema::normalize_fields( $fields );
	}
}
