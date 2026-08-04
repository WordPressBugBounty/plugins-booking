<?php
/**
 * Public Booking Resource catalogue for the selector shortcode.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize one Booking Resource record for public selection.
 *
 * @param mixed               $resource_record  Raw resource object or array.
 * @param int                 $fallback_id      Resource ID supplied by the keyed collection.
 * @param array<string,mixed> $resource_options Public searchable-resource presentation options.
 *
 * @return array<string,mixed>|null Public resource data, or null when invalid.
 */
function wpbc_booking_resource_selector_normalize_resource( $resource_record, $fallback_id = 0, $resource_options = array() ) {
	$resource_record = is_object( $resource_record ) ? get_object_vars( $resource_record ) : (array) $resource_record;
	$resource_id     = ! empty( $resource_record['id'] ) ? absint( $resource_record['id'] ) : absint( $fallback_id );
	if ( ! $resource_id ) {
		return null;
	}

	$resource_title = ! empty( $resource_record['title'] ) ? wp_strip_all_tags( wpbc_lang( $resource_record['title'] ) ) : '';
	if ( '' === $resource_title ) {
		/* translators: %d: Booking Resource ID. */
		$resource_title = sprintf( __( 'Booking Resource #%d', 'booking' ), $resource_id );
	}

	$image_value = '';
	if ( ! empty( $resource_record['image_url'] ) ) {
		$image_value = $resource_record['image_url'];
	} elseif ( ! empty( $resource_record['picture'] ) ) {
		$image_value = $resource_record['picture'];
	} elseif ( ! empty( $resource_options['picture'] ) ) {
		$image_value = $resource_options['picture'];
	}
	if ( is_array( $image_value ) ) {
		$image_value = reset( $image_value );
	}
	$image_url = is_scalar( $image_value ) ? esc_url_raw( wpbc_lang( (string) $image_value ) ) : '';

	return array(
		'resource_id' => $resource_id,
		'title'       => $resource_title,
		'description' => ! empty( $resource_record['description'] ) ? wp_strip_all_tags( wpbc_lang( $resource_record['description'] ) ) : '',
		'image_url'   => $image_url,
		'parent_id'   => isset( $resource_record['parent'] ) ? absint( $resource_record['parent'] ) : 0,
		'count'       => isset( $resource_record['count'] ) ? absint( $resource_record['count'] ) : 0,
	);
}

/**
 * Build the public Booking Resource catalogue in configured display order.
 *
 * Commercial editions supply their resource cache through the established
 * filter. The free edition falls back to its one canonical resource.
 *
 * @param array<string,mixed> $config Normalized selector configuration.
 *
 * @return array<int,array<string,mixed>> Resources keyed by resource ID.
 */
function wpbc_booking_resource_selector_get_catalog( $config ) {
	$config         = wpbc_booking_resource_selector_normalize_config( $config );
	$raw_resources  = (array) apply_bk_filter( 'wpdebk_get_keyed_all_bk_resources', array() );
	$search_options = array();
	if ( function_exists( 'wpbc_searchable_resources__get_all_options' ) ) {
		$search_options = (array) wpbc_searchable_resources__get_all_options();
	}
	$resources = array();

	foreach ( $raw_resources as $resource_key => $resource_record ) {
		$normalized_resource_id = absint( $resource_key );
		if ( is_object( $resource_record ) && ! empty( $resource_record->id ) ) {
			$normalized_resource_id = absint( $resource_record->id );
		} elseif ( is_array( $resource_record ) && ! empty( $resource_record['id'] ) ) {
			$normalized_resource_id = absint( $resource_record['id'] );
		}
		$resource_options = array();
		if ( isset( $search_options[ $normalized_resource_id ] ) && is_array( $search_options[ $normalized_resource_id ] ) ) {
			$resource_options = $search_options[ $normalized_resource_id ];
		}
		$resource = wpbc_booking_resource_selector_normalize_resource( $resource_record, $resource_key, $resource_options );
		if ( $resource ) {
			$resources[ $resource['resource_id'] ] = $resource;
		}
	}

	if ( empty( $resources ) && ! class_exists( 'wpdev_bk_personal' ) ) {
		$resource_id               = class_exists( 'WPBC_FE_Attr_Postprocessor' ) ? WPBC_FE_Attr_Postprocessor::get_default_booking_resource_id() : 1;
		$resource_title            = function_exists( 'wpbc_get_resource_title' ) ? wpbc_get_resource_title( $resource_id ) : '';
		$resources[ $resource_id ] = array(
			'resource_id' => absint( $resource_id ),
			'title'       => $resource_title ? wp_strip_all_tags( wpbc_lang( $resource_title ) ) : __( 'Default Booking Resource', 'booking' ),
			'description' => '',
			'image_url'   => '',
			'parent_id'   => 0,
			'count'       => 0,
		);
	}

	if ( $config['resource_ids'] ) {
		$ordered_resources = array();
		foreach ( $config['resource_ids'] as $resource_id ) {
			if ( isset( $resources[ $resource_id ] ) ) {
				$ordered_resources[ $resource_id ] = $resources[ $resource_id ];
			}
		}
		$resources = $ordered_resources;
	}

	return (array) apply_filters( 'wpbc_booking_resource_selector_public_catalog', $resources, $config );
}

/**
 * Return one selectable Booking Resource from a public catalogue.
 *
 * @param array<int,array<string,mixed>> $catalog     Public resource catalogue.
 * @param int                            $resource_id Requested Booking Resource ID.
 *
 * @return array<string,mixed>|WP_Error Resource or a public validation error.
 */
function wpbc_booking_resource_selector_get_resource( $catalog, $resource_id ) {
	$resource_id = absint( $resource_id );
	if ( ! $resource_id || empty( $catalog[ $resource_id ] ) ) {
		return new WP_Error( 'resource_selector_resource_unavailable', __( 'The selected Booking Resource is not available. Please choose another resource.', 'booking' ) );
	}

	return $catalog[ $resource_id ];
}
