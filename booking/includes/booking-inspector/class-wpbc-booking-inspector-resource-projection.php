<?php
/**
 * Booking Inspector Resource summary projection.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve one authorized Resource summary without exposing storage records.
 */
final class WPBC_Booking_Inspector_Resource_Projection {

	/** @var WPBC_Booking_Inspector_Resource_Repository Resource repository. */
	private $resource_repository;

	/**
	 * Construct the projection with its domain repository.
	 *
	 * @param WPBC_Booking_Inspector_Resource_Repository|null $resource_repository Optional repository for tests.
	 */
	public function __construct( $resource_repository = null ) {
		$this->resource_repository = $resource_repository ? $resource_repository : new WPBC_Booking_Inspector_Resource_Repository();
	}

	/**
	 * Project the booking's primary visible Resource.
	 *
	 * @param array<string,mixed> $booking Internal authorized booking row.
	 * @param array<int,int>      $effective_resource_ids Authorized effective Resources.
	 *
	 * @return array<string,mixed>|WP_Error JSON-safe Resource summary or safe query error.
	 */
	public function project( $booking, $effective_resource_ids ) {
		$primary_resource_id    = isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0;
		$effective_resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $effective_resource_ids ) ) ) );
		if ( ! in_array( $primary_resource_id, $effective_resource_ids, true ) ) {
			$primary_resource_id = ! empty( $effective_resource_ids ) ? reset( $effective_resource_ids ) : 0;
		}

		$resource_content = array();
		if ( $primary_resource_id && function_exists( 'wpbc_booking_resource_content_repository' ) ) {
			$resource_content = wpbc_booking_resource_content_repository()->get( $primary_resource_id );
		}
		$title = isset( $resource_content['title'] ) ? wpbc_lang( (string) $resource_content['title'] ) : '';
		if ( '' === trim( $title ) && function_exists( 'wpbc_get_resource_title' ) ) {
			$title = wpbc_get_resource_title( $primary_resource_id );
		}
		$resource_pricing = $this->resource_repository->get_resource_pricing( $primary_resource_id );
		if ( is_wp_error( $resource_pricing ) ) {
			return $resource_pricing;
		}
		$pricing = $this->project_pricing( $resource_pricing, $primary_resource_id );

		return array(
			'resource_id'       => $primary_resource_id,
			'title'             => sanitize_text_field( $title ),
			'description'       => isset( $resource_content['description'] ) ? sanitize_textarea_field( wp_strip_all_tags( (string) $resource_content['description'] ) ) : '',
			'picture_url'       => isset( $resource_content['picture_url'] ) ? esc_url_raw( wpbc_lang( (string) $resource_content['picture_url'] ) ) : '',
			'allocation_count'  => count( $effective_resource_ids ),
			'pricing'           => $pricing,
		);
	}

	/**
	 * Convert repository pricing data to a translated browser-safe summary.
	 *
	 * @param array<string,mixed> $resource_pricing Repository pricing record.
	 * @param int                 $resource_id      Authorized Resource ID.
	 *
	 * @return array<string,mixed> Browser-safe pricing summary.
	 */
	private function project_pricing( $resource_pricing, $resource_id ) {
		if ( empty( $resource_pricing['supported'] ) ) {
			return array( 'supported' => false );
		}

		$period        = isset( $resource_pricing['period'] ) ? sanitize_key( $resource_pricing['period'] ) : '';
		$period_labels = array(
			'day'     => _x( 'day', 'price period unit', 'booking' ),
			'night'   => _x( 'night', 'price period unit', 'booking' ),
			'hour'    => _x( 'hour', 'price period unit', 'booking' ),
			'session' => _x( 'session', 'price period unit', 'booking' ),
			'fixed'   => _x( 'booking', 'price period unit', 'booking' ),
		);
		$formatted_cost = '';
		if ( isset( $resource_pricing['cost'] ) && is_numeric( $resource_pricing['cost'] ) ) {
			$formatted_cost = function_exists( 'wpbc_get_cost_with_currency_for_user' )
				? wpbc_get_cost_with_currency_for_user( $resource_pricing['cost'], $resource_id )
				: number_format_i18n( (float) $resource_pricing['cost'], 2 );
			$formatted_cost = sanitize_text_field( html_entity_decode( wp_strip_all_tags( (string) $formatted_cost ), ENT_QUOTES, 'UTF-8' ) );
		}

		return array(
			'supported'      => true,
			'formatted_cost' => $formatted_cost,
			'period'         => $period,
			'period_label'   => isset( $period_labels[ $period ] ) ? $period_labels[ $period ] : '',
		);
	}
}
