<?php
/**
 * Booking Rescheduling read repository.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Load canonical booking-owned inputs without exposing storage rows.
 */
final class WPBC_Booking_Rescheduling_Repository {

	/** @var WPBC_Booking_Inspector_Date_Repository Canonical date repository. */
	private $date_repository;

	/** @var WPBC_Booking_Inspector_Resource_Repository Resource repository. */
	private $resource_repository;

	/**
	 * Construct the repository.
	 *
	 * @param WPBC_Booking_Inspector_Date_Repository|null      $date_repository     Optional date repository.
	 * @param WPBC_Booking_Inspector_Resource_Repository|null  $resource_repository Optional Resource repository.
	 */
	public function __construct( $date_repository = null, $resource_repository = null ) {
		$this->date_repository     = $date_repository ? $date_repository : new WPBC_Booking_Inspector_Date_Repository();
		$this->resource_repository = $resource_repository ? $resource_repository : new WPBC_Booking_Inspector_Resource_Repository();
	}

	/**
	 * Load exact canonical date rows for an authorized booking.
	 *
	 * @param array<string,mixed> $booking Authorized booking record.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Canonical date rows or safe error.
	 */
	public function get_booking_dates( $booking ) {
		return $this->date_repository->get_booking_dates(
			isset( $booking['booking_id'] ) ? absint( $booking['booking_id'] ) : 0,
			isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0
		);
	}

	/**
	 * Return safe labels for authorized Resource IDs.
	 *
	 * @param array<int,int> $resource_ids Authorized Resource IDs.
	 *
	 * @return array<int,string>|WP_Error Resource ID to safe label map.
	 */
	public function get_resource_labels( $resource_ids ) {
		$resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $resource_ids ) ) ) );
		$options      = $this->resource_repository->get_action_resource_options();
		if ( is_wp_error( $options ) ) {
			return $options;
		}

		$labels = array();
		foreach ( (array) $options as $option ) {
			$resource_id = isset( $option['booking_type_id'] ) ? absint( $option['booking_type_id'] ) : 0;
			if ( $resource_id && in_array( $resource_id, $resource_ids, true ) ) {
				$labels[ $resource_id ] = isset( $option['title'] ) ? sanitize_text_field( (string) $option['title'] ) : '';
			}
		}
		foreach ( $resource_ids as $resource_id ) {
			if ( ! isset( $labels[ $resource_id ] ) || '' === $labels[ $resource_id ] ) {
				/* translators: %d: Booking Resource ID. */
				$labels[ $resource_id ] = sprintf( __( 'Booking Resource #%d', 'booking' ), $resource_id );
			}
		}

		return $labels;
	}

	/**
	 * Return authorized Resource choices for the accessible dialog.
	 *
	 * The current Resource is always present. Other choices are exposed only
	 * when the released change-Resource capability and saved-shape contract both
	 * permit them. Values are presentation data, never mutation authority.
	 *
	 * @param int  $current_resource_id Current canonical primary Resource.
	 * @param bool $allow_change        Whether alternative choices may be shown.
	 *
	 * @return array<int,array{value:int,label:string}>|WP_Error Authorized choices or safe error.
	 */
	public function get_target_resource_options( $current_resource_id, $allow_change ) {
		$current_resource_id = absint( $current_resource_id );
		$resource_rows       = $this->resource_repository->get_action_resource_options();
		if ( is_wp_error( $resource_rows ) ) {
			return $resource_rows;
		}

		$options = array();
		foreach ( (array) $resource_rows as $resource_row ) {
			$resource_id = isset( $resource_row['booking_type_id'] ) ? absint( $resource_row['booking_type_id'] ) : 0;
			if ( ! $resource_id || ( ! $allow_change && $resource_id !== $current_resource_id ) ) {
				continue;
			}
			$options[ $resource_id ] = array(
				'value' => $resource_id,
				'label' => isset( $resource_row['title'] ) ? sanitize_text_field( (string) $resource_row['title'] ) : '',
			);
		}

		if ( $current_resource_id && ! isset( $options[ $current_resource_id ] ) ) {
			/* translators: %d: Booking Resource ID. */
			$options[ $current_resource_id ] = array(
				'value' => $current_resource_id,
				'label' => sprintf( __( 'Booking Resource #%d', 'booking' ), $current_resource_id ),
			);
		}

		if ( ! $allow_change && isset( $options[ $current_resource_id ] ) ) {
			return array( $options[ $current_resource_id ] );
		}

		return array_values( $options );
	}

	/**
	 * Resolve the immutable Appointment snapshot for one booking when available.
	 *
	 * @param int $booking_id Authorized booking ID.
	 *
	 * @return array<string,mixed>|null Appointment snapshot or null.
	 */
	public function get_appointment_snapshot( $booking_id ) {
		if ( ! function_exists( 'wpbc_appointment_services_repository' ) ) {
			return null;
		}
		$repository = wpbc_appointment_services_repository();

		return is_object( $repository ) && method_exists( $repository, 'get_appointment_snapshot' )
			? $repository->get_appointment_snapshot( absint( $booking_id ) )
			: null;
	}

	/**
	 * Resolve the stored custom-form key used by canonical availability checks.
	 *
	 * @param array<string,mixed> $booking Authorized booking record.
	 *
	 * @return string Bounded form key.
	 */
	public function get_custom_form_key( $booking ) {
		$form_key = '';
		if ( class_exists( 'WPBC_Booking_Inspector_Form_Snapshot_Builder' ) ) {
			$form_key = ( new WPBC_Booking_Inspector_Form_Snapshot_Builder() )->get_stored_form_key(
				isset( $booking['form'] ) ? (string) $booking['form'] : '',
				isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0
			);
		}
		$form_key = sanitize_text_field( (string) $form_key );

		return '' === $form_key ? 'standard' : substr( $form_key, 0, 191 );
	}

	/**
	 * Calculate the saved booking quantity from canonical effective allocations.
	 *
	 * @param array<int,array<string,mixed>> $date_rows Canonical date rows.
	 *
	 * @return int Positive quantity.
	 */
	public function get_booking_quantity( $date_rows ) {
		$resources_by_date = array();
		foreach ( (array) $date_rows as $date_row ) {
			if ( ! is_array( $date_row ) || empty( $date_row['booking_date'] ) ) {
				continue;
			}
			$date_key    = substr( (string) $date_row['booking_date'], 0, 10 );
			$resource_id = isset( $date_row['resource_id'] ) ? absint( $date_row['resource_id'] ) : 0;
			if ( $resource_id ) {
				$resources_by_date[ $date_key ][ $resource_id ] = true;
			}
		}
		$quantity = 1;
		foreach ( $resources_by_date as $resource_ids ) {
			$quantity = max( $quantity, count( $resource_ids ) );
		}

		return $quantity;
	}

	/**
	 * Return the canonical capacity-hierarchy context for one Resource.
	 *
	 * Direct interactions use this server-derived relationship to distinguish an
	 * exact parent or child allocation from mixed or unrelated capacity state. No
	 * browser-supplied Resource relationship or capacity value participates.
	 *
	 * @param int $resource_id Authorized Resource ID.
	 *
	 * @return array{resource_id:int,parent_id:int,child_count:int,is_parent:bool,is_child:bool} Hierarchy context.
	 */
	public function get_resource_hierarchy_context( $resource_id ) {
		$resource_id = absint( $resource_id );
		if ( ! $resource_id || ! class_exists( 'wpdev_bk_biz_l' ) ) {
			return array(
				'resource_id' => $resource_id,
				'parent_id'   => 0,
				'child_count' => 0,
				'is_parent'   => false,
				'is_child'    => false,
			);
		}

		$child_count = function_exists( 'wpbc_get_child_resources_number' )
			? absint( wpbc_get_child_resources_number( $resource_id ) )
			: 0;
		$parent_id   = function_exists( 'wpbc_get_parent_resource' )
			? absint( wpbc_get_parent_resource( $resource_id ) )
			: 0;

		return array(
			'resource_id' => $resource_id,
			'parent_id'   => $parent_id,
			'child_count' => $child_count,
			'is_parent'   => 0 < $child_count,
			'is_child'    => 0 < $parent_id,
		);
	}

	/**
	 * Determine whether a Resource participates in a capacity hierarchy.
	 *
	 * Retained as a compatibility helper for callers that need only the broad
	 * hierarchy decision. Direct-resize policy uses the complete hierarchy
	 * context so exact parent and child allocations retain their distinct rules.
	 *
	 * @param int $resource_id Authorized Resource ID.
	 *
	 * @return bool True for a capacity parent or child Resource.
	 */
	public function is_capacity_resource( $resource_id ) {
		$hierarchy_context = $this->get_resource_hierarchy_context( $resource_id );

		return $hierarchy_context['is_parent'] || $hierarchy_context['is_child'];
	}
}
