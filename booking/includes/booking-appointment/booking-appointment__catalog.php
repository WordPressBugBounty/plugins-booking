<?php
/**
 * Public Service and Provider catalogue for Appointment booking.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve the public image configured for one Provider Booking Resource.
 *
 * Searchable Resources belongs to Business Large, so editions without that
 * module receive an empty URL and retain the Provider-initials fallback.
 *
 * @param int                            $provider_id    Provider Booking Resource ID.
 * @param array<int,array<string,mixed>> $search_options Searchable Resource options keyed by resource ID.
 *
 * @return string Sanitized Provider image URL or an empty string.
 */
function wpbc_booking_appointment_get_provider_image_url( $provider_id, $search_options ) {
	return wpbc_appointment_services_get_provider_image_url( $provider_id, $search_options );
}

/**
 * Load active Service assignment rows for the public Provider set.
 *
 * The native repository uses one joined query. Replacement repositories retain
 * compatibility through their existing list_active_for_resource() contract.
 *
 * @param int[]  $provider_ids Provider resource IDs.
 * @param object $repository   Configured Service repository.
 *
 * @return array<int,array<string,mixed>> Service rows containing resource_id.
 */
function wpbc_booking_appointment_get_assignment_rows( $provider_ids, $repository ) {
	global $wpdb;

	$provider_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $provider_ids ) ) ) );
	if ( empty( $provider_ids ) ) {
		return array();
	}

	if ( $repository instanceof WPBC_Appointment_Services_Repository ) {
		$placeholders = implode( ',', array_fill( 0, count( $provider_ids ), '%d' ) );
		$sql = 'SELECT s.*, sr.resource_id, sr.duration_override, sr.cost_override, sr.priority AS assignment_priority
			FROM ' . wpbc_appointment_services_table_name( 'services' ) . ' s
			INNER JOIN ' . wpbc_appointment_services_table_name( 'service_resources' ) . ' sr ON sr.service_id = s.service_id
			WHERE s.status = %s AND sr.status = %s AND sr.resource_id IN (' . $placeholders . ')
			ORDER BY s.title, s.service_id, sr.priority, sr.assignment_id';
		$args = array_merge( array( 'active', 'active' ), $provider_ids );

		return (array) $wpdb->get_results( $wpdb->prepare( $sql, $args ), ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.PreparedSQL.NotPrepared
	}

	$rows = array();
	foreach ( $provider_ids as $provider_id ) {
		foreach ( (array) $repository->list_active_for_resource( $provider_id ) as $service ) {
			$service                = is_object( $service ) ? get_object_vars( $service ) : (array) $service;
			$service['resource_id'] = $provider_id;
			$rows[]                 = $service;
		}
	}

	return $rows;
}

/**
 * Order public Services for the Appointment selection step.
 *
 * An explicit shortcode Service list is both a restriction and a presentation
 * sequence. When no sequence is supplied, the existing natural title order is
 * retained. Any unexpected Service not present in the requested sequence is
 * appended alphabetically so filters and replacement repositories do not lose
 * catalogue entries.
 *
 * @param array<int,array<string,mixed>> $services              Services keyed by Service ID.
 * @param int[]                          $requested_service_ids Requested Service IDs in display order.
 *
 * @return array<int,array<string,mixed>> Ordered Services keyed by Service ID.
 */
function wpbc_booking_appointment_order_services( $services, $requested_service_ids = array() ) {
	$services              = (array) $services;
	$requested_service_ids = wpbc_booking_appointment_normalize_ids( $requested_service_ids );
	$title_sort_callback   = static function ( $left, $right ) {
		return strnatcasecmp( (string) $left['title'], (string) $right['title'] );
	};

	if ( empty( $requested_service_ids ) ) {
		uasort( $services, $title_sort_callback );
		return $services;
	}

	$ordered_services = array();
	foreach ( $requested_service_ids as $service_id ) {
		if ( isset( $services[ $service_id ] ) ) {
			$ordered_services[ $service_id ] = $services[ $service_id ];
		}
	}

	$remaining_services = array_diff_key( $services, $ordered_services );
	uasort( $remaining_services, $title_sort_callback );

	return $ordered_services + $remaining_services;
}

/**
 * Build the public Service catalogue from active resource assignments.
 *
 * This intentionally uses the existing repository contract rather than an
 * owner-scoped administrator query. A Service is public only when it is active
 * and actively assigned to a Provider resource available in this context.
 *
 * @param array<string,mixed> $config Normalized shortcode configuration.
 *
 * @return array{services:array<int,array<string,mixed>>,providers:array<int,array<string,mixed>>,diagnostics:array<string,int>}|WP_Error Catalogue or storage error.
 */
function wpbc_booking_appointment_get_catalog( $config ) {
	if ( ! function_exists( 'wpbc_appointment_services_repository' ) || ! wpbc_appointment_services_storage_is_ready() ) {
		return new WP_Error( 'appointment_storage_unavailable', __( 'Appointment Services are not available.', 'booking' ) );
	}

	$config           = wpbc_booking_appointment_normalize_config( $config );
	$repository       = wpbc_appointment_services_repository();
	$provider_options = wpbc_appointment_services_get_provider_options();
	$provider_options = (array) apply_filters( 'wpbc_booking_appointment_public_provider_options', $provider_options, $config );
	$search_options   = array();
	if ( function_exists( 'wpbc_searchable_resources__get_all_options' ) ) {
		$search_options = (array) wpbc_searchable_resources__get_all_options();
	}

	if ( $config['provider_ids'] ) {
		$provider_options = array_intersect_key( $provider_options, array_fill_keys( $config['provider_ids'], true ) );
	}

	$services  = array();
	$providers = array();
	$pricing_available = wpbc_appointment_services_is_pricing_available();
	$maximum_duration = absint( apply_filters( 'wpbc_booking_appointment_maximum_duration_minutes', 24 * 60, $config ) );
	$assignment_rows = wpbc_booking_appointment_get_assignment_rows( array_keys( $provider_options ), $repository );
	foreach ( $assignment_rows as $service ) {
		$provider_id = ! empty( $service['resource_id'] ) ? absint( $service['resource_id'] ) : 0;
		if ( ! $provider_id || ! isset( $provider_options[ $provider_id ] ) ) {
			continue;
		}

		$base_service      = wpbc_appointment_services_normalize_item( $service );
		$effective_service = wpbc_appointment_services_apply_assignment_overrides( $service );
		if ( ! $pricing_available ) {
			$base_service['base_cost'] = '';
		}
		$service_id        = absint( $base_service['service_id'] );
		$duration_minutes  = absint( $effective_service['duration_minutes'] );
		if ( ! $service_id || ! $duration_minutes || ( $maximum_duration && $duration_minutes > $maximum_duration ) || ( $config['service_ids'] && ! in_array( $service_id, $config['service_ids'], true ) ) ) {
			continue;
		}

		if ( ! isset( $services[ $service_id ] ) ) {
			$base_service['resource_ids']  = array();
			$base_service['provider_rules'] = array();
			$services[ $service_id ]       = $base_service;
		}
		$services[ $service_id ]['resource_ids'][] = $provider_id;
		$services[ $service_id ]['provider_rules'][ $provider_id ] = array(
			'duration_minutes'          => absint( $effective_service['duration_minutes'] ),
			'base_duration_minutes'     => absint( $effective_service['base_duration_minutes'] ),
			'duration_override_minutes' => absint( $effective_service['duration_override_minutes'] ),
			'base_cost'                 => $pricing_available ? (string) $effective_service['base_cost'] : '',
			'base_service_cost'         => $pricing_available ? (string) $effective_service['base_service_cost'] : '',
			'cost_override'             => $pricing_available ? $effective_service['cost_override'] : null,
		);

		if ( ! isset( $providers[ $provider_id ] ) ) {
			$providers[ $provider_id ] = array(
				'provider_id'             => $provider_id,
				'title'                   => wp_strip_all_tags( wpbc_lang( $provider_options[ $provider_id ] ) ),
				'image_url'               => wpbc_booking_appointment_get_provider_image_url( $provider_id, $search_options ),
				'service_ids'             => array(),
				'has_weekly_availability' => function_exists( 'wpbc_appointment_services_provider_has_weekly_availability' )
					? wpbc_appointment_services_provider_has_weekly_availability( $provider_id )
					: true,
			);
		}
		$providers[ $provider_id ]['service_ids'][] = $service_id;
	}

	foreach ( $services as &$service ) {
		$service['resource_ids'] = array_values( array_unique( array_map( 'absint', $service['resource_ids'] ) ) );
	}
	unset( $service );
	foreach ( $providers as &$provider ) {
		$provider['service_ids'] = array_values( array_unique( array_map( 'absint', $provider['service_ids'] ) ) );
	}
	unset( $provider );

	$services = wpbc_booking_appointment_order_services( $services, $config['service_ids'] );

	$catalog = array(
		'services'    => $services,
		'providers'   => $providers,
		'diagnostics' => array(
			'provider_count'   => count( $provider_options ),
			'assignment_count' => count( $assignment_rows ),
		),
	);

	return (array) apply_filters( 'wpbc_booking_appointment_public_catalog', $catalog, $config );
}

/**
 * Return one selectable Service from the public catalogue.
 *
 * @param array<string,mixed> $catalog    Public catalogue.
 * @param int                 $service_id Requested Service ID.
 *
 * @return array<string,mixed>|WP_Error Service or public validation error.
 */
function wpbc_booking_appointment_get_service( $catalog, $service_id ) {
	$service_id = absint( $service_id );
	if ( ! $service_id || empty( $catalog['services'][ $service_id ] ) ) {
		return new WP_Error( 'appointment_service_unavailable', __( 'The selected Service is not available. Please choose another Service.', 'booking' ) );
	}

	return $catalog['services'][ $service_id ];
}

/**
 * Return Providers compatible with one public Service.
 *
 * @param array<string,mixed> $catalog Public catalogue.
 * @param array<string,mixed> $service Selected Service.
 *
 * @return array<int,array<string,mixed>> Compatible Providers keyed by resource ID.
 */
function wpbc_booking_appointment_get_service_providers( $catalog, $service ) {
	$providers = array();
	foreach ( (array) $service['resource_ids'] as $provider_id ) {
		$provider_id = absint( $provider_id );
		if ( isset( $catalog['providers'][ $provider_id ] ) ) {
			$providers[ $provider_id ] = $catalog['providers'][ $provider_id ];
		}
	}

	return (array) apply_filters( 'wpbc_booking_appointment_service_providers', $providers, $service, $catalog );
}

/**
 * Return one compatible Provider from a public Service catalogue.
 *
 * @param array<string,mixed> $catalog     Public catalogue.
 * @param array<string,mixed> $service     Selected Service.
 * @param int                 $provider_id Requested Provider resource ID.
 *
 * @return array<string,mixed>|WP_Error Provider or compatibility error.
 */
function wpbc_booking_appointment_get_provider( $catalog, $service, $provider_id ) {
	$providers   = wpbc_booking_appointment_get_service_providers( $catalog, $service );
	$provider_id = absint( $provider_id );
	if ( ! $provider_id || empty( $providers[ $provider_id ] ) ) {
		return new WP_Error( 'appointment_provider_unavailable', __( 'The selected Provider is not available for this Service. Please choose another Provider.', 'booking' ) );
	}

	return $providers[ $provider_id ];
}

/**
 * Resolve the Service values effective for one selected Provider.
 *
 * The Service picker continues to show the base Service duration. Once a
 * Provider is selected, its nullable assignment overrides become authoritative
 * for native form rendering and match the server-side save lookup.
 *
 * @param array<string,mixed> $service     Public Service definition.
 * @param int                 $provider_id Selected Provider resource ID.
 *
 * @return array<string,mixed> Service definition with effective values.
 */
function wpbc_booking_appointment_get_effective_service( $service, $provider_id ) {
	$provider_id = absint( $provider_id );
	$rules       = ! empty( $service['provider_rules'][ $provider_id ] ) && is_array( $service['provider_rules'][ $provider_id ] )
		? $service['provider_rules'][ $provider_id ]
		: array();
	if ( $rules ) {
		$service = array_merge( $service, $rules );
	}

	return (array) apply_filters( 'wpbc_booking_appointment_effective_service', $service, $provider_id );
}
