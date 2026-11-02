<?php
/**
 * Booking Inspector Resource-ownership repository.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve exact Resource IDs through edition and MultiUser ownership rules.
 */
final class WPBC_Booking_Inspector_Resource_Repository {

	/**
	 * Load the authorized Resource choices used by canonical booking actions.
	 *
	 * Change-resource and duplicate-booking dialogs are shared with Booking
	 * Listing, but Inspector hosts do not execute the Listing search request that
	 * normally supplies their choices. This repository therefore exposes only
	 * the three presentation fields those established dialogs require and applies
	 * the same current-user MultiUser restriction as Inspector authorization.
	 *
	 * @return array<int,array<string,int|string>>|WP_Error Authorized JSON-safe Resource choices or a safe query error.
	 */
	public function get_action_resource_options() {
		global $wpdb;

		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			return array();
		}

		$has_capacity_columns = class_exists( 'wpdev_bk_biz_l' );
		$select_columns       = $has_capacity_columns
			? 'bt.booking_type_id, bt.title, bt.parent, bt.prioritet'
			: 'bt.booking_type_id, bt.title';
		$sql                  = "SELECT {$select_columns} FROM {$wpdb->prefix}bookingtypes AS bt WHERE 1 = 1";
		$query_parameters     = array();
		$owner_user_id        = $this->get_restricted_owner_user_id();

		if ( 0 === $owner_user_id ) {
			return array();
		}
		if ( null !== $owner_user_id ) {
			$sql                .= ' AND bt.users = %d';
			$query_parameters[] = $owner_user_id;
		}
		$sql .= $has_capacity_columns
			? ' ORDER BY bt.parent ASC, bt.prioritet ASC, bt.title ASC, bt.booking_type_id ASC'
			: ' ORDER BY bt.title ASC, bt.booking_type_id ASC';

		if ( ! empty( $query_parameters ) ) {
			$sql = $wpdb->prepare( $sql, $query_parameters ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- SQL structure and placeholder count are repository-owned.
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read-only, ownership-scoped domain query.
		$resource_rows = $wpdb->get_results( $sql, ARRAY_A );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $resource_rows ) ) {
			return new WP_Error(
				'wpbc_booking_inspector_action_resources_query_failed',
				__( 'Booking details could not be loaded. Try again.', 'booking' )
			);
		}

		if ( $has_capacity_columns && function_exists( 'wpbc_ajx_get_sorted_booking_resources_arr' ) ) {
			$resource_rows = wpbc_ajx_get_sorted_booking_resources_arr( $resource_rows );
		}

		$resource_options = array();
		foreach ( $resource_rows as $resource_row ) {
			$resource_id = isset( $resource_row['booking_type_id'] ) ? absint( $resource_row['booking_type_id'] ) : 0;
			if ( ! $resource_id ) {
				continue;
			}

			$resource_title = isset( $resource_row['title'] ) ? (string) $resource_row['title'] : '';
			if ( function_exists( 'wpbc_lang' ) ) {
				$resource_title = wpbc_lang( $resource_title );
			}

			$resource_option = array(
				'booking_type_id' => $resource_id,
				'title'           => sanitize_text_field( $resource_title ),
			);
			if ( $has_capacity_columns ) {
				$resource_option['parent'] = isset( $resource_row['parent'] ) ? absint( $resource_row['parent'] ) : 0;
			}
			$resource_options[] = $resource_option;
		}

		return $resource_options;
	}

	/**
	 * Load the edition-supported base price for one already authorized Resource.
	 *
	 * The caller must authorize the Resource before invoking this method. Free
	 * editions return an explicit unsupported contract and never query a column
	 * that their schema does not own.
	 *
	 * @param int $resource_id Authorized Booking Resource ID.
	 *
	 * @return array<string,mixed>|WP_Error Raw pricing record or safe query error.
	 */
	public function get_resource_pricing( $resource_id ) {
		global $wpdb;

		$resource_id = absint( $resource_id );
		if ( ! $resource_id || ! class_exists( 'wpdev_bk_biz_s' ) ) {
			return array( 'supported' => false );
		}

		$sql = $wpdb->prepare(
			"SELECT pricing_bt.cost FROM {$wpdb->prefix}bookingtypes AS pricing_bt WHERE pricing_bt.booking_type_id = %d LIMIT 1",
			$resource_id
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared exact authorized Resource lookup.
		$resource_cost = $wpdb->get_var( $sql );
		if ( '' !== (string) $wpdb->last_error ) {
			return new WP_Error(
				'wpbc_booking_inspector_resource_pricing_query_failed',
				__( 'Booking details could not be loaded. Try again.', 'booking' )
			);
		}

		return array(
			'supported' => true,
			'cost'      => is_numeric( $resource_cost ) ? (string) $resource_cost : '',
			'period'    => function_exists( 'wpbc_get_cost_per_period_for_user' )
				? sanitize_key( (string) wpbc_get_cost_per_period_for_user( $resource_id ) )
				: 'day',
		);
	}

	/**
	 * Return only server-resolved Resource IDs authorized for the current user.
	 *
	 * @param array<int,int> $resource_ids Server-resolved effective Resource IDs.
	 *
	 * @return array<int,int>|WP_Error Authorized IDs or safe query error.
	 */
	public function get_authorized_resource_ids( $resource_ids ) {
		global $wpdb;

		$resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $resource_ids ) ) ) );
		if ( empty( $resource_ids ) ) {
			return array();
		}

		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			return in_array( 1, $resource_ids, true ) ? array( 1 ) : array();
		}

		$placeholders     = implode( ', ', array_fill( 0, count( $resource_ids ), '%d' ) );
		$query_parameters = $resource_ids;
		$sql              = "SELECT bt.booking_type_id FROM {$wpdb->prefix}bookingtypes AS bt WHERE bt.booking_type_id IN ( {$placeholders} )";
		$owner_user_id    = $this->get_restricted_owner_user_id();
		if ( 0 === $owner_user_id ) {
			return array();
		}
		if ( null !== $owner_user_id ) {
			$sql               .= ' AND bt.users = %d';
			$query_parameters[] = $owner_user_id;
		}
		$sql .= ' ORDER BY bt.booking_type_id ASC';
		$sql  = $wpdb->prepare( $sql, $query_parameters ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Placeholder count and SQL structure are repository-owned.

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared exact ownership read.
		$authorized_ids = $wpdb->get_col( $sql );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $authorized_ids ) ) {
			return new WP_Error(
				'wpbc_booking_inspector_resources_query_failed',
				__( 'Booking details could not be loaded. Try again.', 'booking' )
			);
		}

		return array_values( array_filter( array_map( 'absint', $authorized_ids ) ) );
	}

	/**
	 * Return the current MultiUser owner restriction.
	 *
	 * @return int|null Owner ID, or null when the read is unrestricted.
	 */
	private function get_restricted_owner_user_id() {
		if ( ! class_exists( 'wpdev_bk_multiuser' ) ) {
			return null;
		}

		$current_user    = function_exists( 'wpbc_mu__wp_get_current_user' ) ? wpbc_mu__wp_get_current_user() : wp_get_current_user();
		$current_user_id = is_object( $current_user ) && isset( $current_user->ID ) ? absint( $current_user->ID ) : 0;
		$is_super_admin  = $current_user_id && (bool) apply_bk_filter( 'is_user_super_admin', $current_user_id );

		return $is_super_admin ? null : $current_user_id;
	}
}
