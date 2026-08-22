<?php
/**
 * Appointment Service catalog DTO mapper.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Convert owner-authorized Service rows into presentation-neutral catalog data.
 *
 * The mapper keeps HTML out of endpoint responses while retaining the Service
 * domain's edition-aware price and authorized Provider presentation fields.
 */
final class WPBC_Appointment_Service_Catalog_DTO {

	/**
	 * Provider presentation directory keyed by Booking Resource ID.
	 *
	 * @var array<int,array<string,mixed>>
	 */
	private $provider_directory;

	/**
	 * Whether this edition exposes Service pricing.
	 *
	 * @var bool
	 */
	private $pricing_available;

	/**
	 * Initialize a mapper with already-authorized domain presentation data.
	 *
	 * @param array<int,array<string,mixed>>|null $provider_directory Provider directory or null to load it.
	 * @param bool|null                           $pricing_available  Edition pricing support or null to detect it.
	 */
	public function __construct( $provider_directory = null, $pricing_available = null ) {
		$this->provider_directory = is_array( $provider_directory ) ? $provider_directory : wpbc_appointment_services_get_provider_directory();
		$this->pricing_available  = is_bool( $pricing_available ) ? $pricing_available : wpbc_appointment_services_is_pricing_available();
	}

	/**
	 * Map one Service row without producing HTML.
	 *
	 * @param mixed $service_row Service repository row.
	 *
	 * @return array<string,mixed>|WP_Error Stable JSON-safe DTO or validation error.
	 */
	public function create( $service_row ) {
		$service = wpbc_appointment_services_normalize_item( $service_row );
		if ( empty( $service['service_id'] ) ) {
			return new WP_Error( 'wpbc_appointment_services_invalid_item', __( 'A Service response item is invalid.', 'booking' ) );
		}

		$provider_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $service['resource_ids'] ) ) ) );
		$providers    = array();
		foreach ( $provider_ids as $provider_id ) {
			if ( isset( $this->provider_directory[ $provider_id ] ) ) {
				$provider = $this->provider_directory[ $provider_id ];
				$providers[] = array(
					'id'                      => $provider_id,
					'title'                   => sanitize_text_field( (string) $provider['title'] ),
					'initials'                => sanitize_text_field( (string) $provider['initials'] ),
					'avatar_url'              => esc_url_raw( (string) $provider['avatar_url'] ),
					'availability_url'        => esc_url_raw( (string) $provider['availability_url'] ),
					'weekdays'                => array_map( 'boolval', (array) $provider['weekdays'] ),
					'has_weekly_availability' => ! empty( $provider['has_weekly_availability'] ),
				);
			}
		}

		$status = in_array( $service['status'], array( 'active', 'inactive', 'archived' ), true ) ? $service['status'] : 'inactive';

		return array(
			'id'                    => absint( $service['service_id'] ),
			'service_id'            => absint( $service['service_id'] ),
			'title'                 => sanitize_text_field( (string) $service['title'] ),
			'description'           => sanitize_textarea_field( (string) $service['description'] ),
			'picture_url'           => esc_url_raw( (string) $service['picture_url'] ),
			'status'                => $status,
			'duration_minutes'      => absint( $service['duration_minutes'] ),
			'buffer_before_minutes' => absint( $service['buffer_before_minutes'] ),
			'buffer_after_minutes'  => absint( $service['buffer_after_minutes'] ),
			'base_cost'             => $this->pricing_available ? (string) $service['base_cost'] : '',
			'pricing_available'     => $this->pricing_available,
			'booking_form_id'       => absint( $service['booking_form_id'] ),
			'resource_ids'          => $provider_ids,
			'providers'             => $providers,
			'has_weekly_availability' => (bool) wp_list_filter( $providers, array( 'has_weekly_availability' => true ) ),
			'actions'               => array(
				'edit'      => true,
				'duplicate' => true,
				'archive'   => 'archived' !== $status,
			),
		);
	}

	/**
	 * Map a Service collection and stop on malformed rows.
	 *
	 * @param mixed $service_rows Repository Service rows.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error DTO collection or safe validation error.
	 */
	public function create_collection( $service_rows ) {
		$items = array();
		foreach ( (array) $service_rows as $service_row ) {
			$item = $this->create( $service_row );
			if ( is_wp_error( $item ) ) {
				return $item;
			}
			$items[] = $item;
		}

		return $items;
	}
}
