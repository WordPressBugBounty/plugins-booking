<?php
/**
 * Read-only rate projection for the Timeline.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Describe exact base-only rates and context-dependent pricing sources.
 */
final class WPBC_Timeline_Rates_Provider {

	/**
	 * Return rates for authorized Resources without presenting totals.
	 *
	 * A Resource with no conditional pricing metadata can expose its base cost as
	 * the exact effective unit rate. When seasonal or advanced rules exist, the
	 * layer explicitly reports `conditional` and withholds an invented amount;
	 * sampled graph points are never represented as exact editable data.
	 *
	 * @param array<int,array<string,mixed>> $resources Authorized Resources.
	 * @param array<string,mixed>            $window    Validated window.
	 *
	 * @return array<string,mixed>|WP_Error Data-only rates DTO or safe error.
	 */
	public function get_rates( $resources, $window ) {
		$resource_ids = array_values( array_filter( array_map( 'absint', wp_list_pluck( $resources, 'id' ) ) ) );
		$metadata     = $this->get_pricing_metadata_flags( $resource_ids );
		if ( is_wp_error( $metadata ) ) {
			return $metadata;
		}

		$rates = array();
		foreach ( $resources as $resource ) {
			$resource_id = absint( $resource['id'] );
			$base_rate   = isset( $resource['base_rate'] ) && is_array( $resource['base_rate'] ) ? $resource['base_rate'] : array();
			$flags       = isset( $metadata[ $resource_id ] ) ? $metadata[ $resource_id ] : array();
			$sources     = array( __( 'Resource base rate', 'booking' ) );
			$state       = class_exists( 'wpdev_bk_biz_s' ) ? 'loaded' : 'not_applicable';

			if ( in_array( 'rates', $flags, true ) ) {
				$sources[] = __( 'Seasonal rate rules', 'booking' );
				$state     = 'conditional';
			}
			if ( in_array( 'costs_depends', $flags, true ) ) {
				$sources[] = __( 'Advanced cost rules', 'booking' );
				$state     = 'conditional';
			}
			if ( in_array( 'costs_early_late_booking', $flags, true ) ) {
				$sources[] = __( 'Early or last-minute adjustments', 'booking' );
				$state     = 'conditional';
			}
			if ( in_array( 'fixed_deposit', $flags, true ) ) {
				$sources[] = __( 'Partial payment rules', 'booking' );
			}

			$rates[] = array(
				'resource_id'          => $resource_id,
				'window_start'         => sanitize_text_field( $window['start_date'] ),
				'window_end'           => sanitize_text_field( $window['end_date'] ),
				'state'                => $state,
				'effective_unit_rate'  => 'loaded' === $state ? sanitize_text_field( isset( $base_rate['amount'] ) ? (string) $base_rate['amount'] : '' ) : '',
				'formatted_unit_rate'  => 'loaded' === $state ? sanitize_text_field( isset( $base_rate['formatted'] ) ? (string) $base_rate['formatted'] : '' ) : '',
				'currency'             => sanitize_text_field( isset( $base_rate['currency'] ) ? (string) $base_rate['currency'] : '' ),
				'currency_symbol'      => sanitize_text_field( isset( $base_rate['currency_symbol'] ) ? (string) $base_rate['currency_symbol'] : '' ),
				'charging_period'      => sanitize_key( isset( $base_rate['period'] ) ? (string) $base_rate['period'] : '' ),
				'source_labels'        => array_values( array_unique( $sources ) ),
				'is_booking_total'     => false,
			);
		}

		return array(
			'load_state' => 'loaded',
			'rates'      => $rates,
		);
	}

	/**
	 * Batch-detect pricing metadata without returning serialized rule values.
	 *
	 * @param array<int,int> $resource_ids Authorized Resource IDs.
	 *
	 * @return array<int,array<int,string>>|WP_Error Metadata keys by Resource.
	 */
	private function get_pricing_metadata_flags( $resource_ids ) {
		global $wpdb;

		if ( ! class_exists( 'wpdev_bk_biz_m' ) || empty( $resource_ids ) || ! wpbc_is_table_exists( 'booking_types_meta' ) ) {
			return array();
		}

		$resource_placeholders = implode( ', ', array_fill( 0, count( $resource_ids ), '%d' ) );
		$query_parameters      = array_merge( $resource_ids, array( 'rates', 'costs_depends', 'costs_early_late_booking', 'fixed_deposit' ) );
		$sql = $wpdb->prepare(
			"SELECT type_id, meta_key FROM {$wpdb->prefix}booking_types_meta
			 WHERE type_id IN ( {$resource_placeholders} ) AND meta_key IN ( %s, %s, %s, %s )
			 ORDER BY type_id ASC, meta_key ASC",
			$query_parameters
		); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Placeholder counts are provider-owned.

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared bounded metadata projection.
		$rows = $wpdb->get_results( $sql, ARRAY_A );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $rows ) ) {
			return new WP_Error(
				'wpbc_timeline_rates_query_failed',
				__( 'Rates could not be loaded for this Timeline range.', 'booking' )
			);
		}

		$flags = array();
		foreach ( $rows as $row ) {
			$resource_id = isset( $row['type_id'] ) ? absint( $row['type_id'] ) : 0;
			$meta_key    = isset( $row['meta_key'] ) ? sanitize_key( $row['meta_key'] ) : '';
			if ( $resource_id && in_array( $meta_key, array( 'rates', 'costs_depends', 'costs_early_late_booking', 'fixed_deposit' ), true ) ) {
				$flags[ $resource_id ][] = $meta_key;
			}
		}

		return $flags;
	}
}
