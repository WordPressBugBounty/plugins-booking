<?php
/**
 * Authorized Resource repository for Add New Booking Inspector.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Loads the bounded site-local Resource universe under current MultiUser scope.
 */
final class WPBC_Booking_New_Inspector_Resource_Repository {

	/**
	 * Load normalized authorized Resource records.
	 *
	 * The repository intentionally returns an internal owner identifier so the
	 * form repository can select the correct owner form. The bootstrap DTO mapper
	 * never exposes that identifier to the browser.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Authorized internal records or a safe query error.
	 */
	public function get_authorized_resources() {
		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			return array( $this->get_free_resource() );
		}

		global $wpdb;
		if ( ! is_object( $wpdb ) || empty( $wpdb->prefix ) ) {
			return $this->get_query_error();
		}

		// Lower paid editions do not own MultiUser or capacity table columns.
		$has_owner_column     = class_exists( 'wpdev_bk_multiuser' );
		$has_capacity_columns = class_exists( 'wpdev_bk_biz_l' ) || $has_owner_column;
		$select_columns       = array(
			'bt.booking_type_id',
			'bt.title',
			$has_owner_column ? 'bt.users' : '0 AS users',
			$has_capacity_columns ? 'bt.parent' : '0 AS parent',
			$has_capacity_columns ? 'bt.prioritet' : '0 AS prioritet',
		);
		$query_parameters     = array();
		$sql                  = 'SELECT ' . implode( ', ', $select_columns ) . " FROM {$wpdb->prefix}bookingtypes AS bt WHERE 1 = 1";
		$owner_user_id        = $this->get_restricted_owner_user_id();
		if ( null !== $owner_user_id ) {
			$sql               .= ' AND bt.users = %d';
			$query_parameters[] = $owner_user_id;
		}
		$sql               .= $has_capacity_columns
			? ' ORDER BY bt.prioritet ASC, bt.booking_type_id ASC LIMIT %d'
			: ' ORDER BY bt.booking_type_id ASC LIMIT %d';
		$query_parameters[] = WPBC_Booking_New_Inspector_Config::MAX_RESOURCE_CHOICES + 1;
		$sql                = $wpdb->prepare( $sql, $query_parameters ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Repository owns the complete SQL structure and placeholder count.

		$wpdb->last_error = '';
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- One bounded site-local bootstrap read.
		$database_rows = $wpdb->get_results( $sql, ARRAY_A );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $database_rows ) ) {
			return $this->get_query_error();
		}

		$resources = array();
		foreach ( $database_rows as $database_row ) {
			$resource_id = isset( $database_row['booking_type_id'] ) ? absint( $database_row['booking_type_id'] ) : 0;
			if ( ! $resource_id || ! $this->current_user_owns_resource( $resource_id ) ) {
				continue;
			}

			$title       = isset( $database_row['title'] ) ? (string) $database_row['title'] : '';
			$title       = function_exists( 'wpbc_lang' ) ? wpbc_lang( $title ) : $title;
			$title       = trim( wp_strip_all_tags( html_entity_decode( $title, ENT_QUOTES, 'UTF-8' ) ) );
			$resources[] = array(
				'id'            => $resource_id,
				'label'         => '' !== $title ? $title : sprintf( __( 'Resource #%d', 'booking' ), $resource_id ),
				'parent_id'     => ! empty( $database_row['parent'] ) ? absint( $database_row['parent'] ) : null,
				'owner_user_id' => isset( $database_row['users'] ) ? absint( $database_row['users'] ) : 0,
			);
		}

		if ( WPBC_Booking_New_Inspector_Config::MAX_RESOURCE_CHOICES < count( $resources ) ) {
			return new WP_Error(
				'wpbc_booking_new_inspector_resource_limit',
				__( 'Too many Booking Resources are available for this view. Use the full Add Booking page.', 'booking' ),
				array( 'status' => 400 )
			);
		}

		return $resources;
	}

	/**
	 * Return the canonical default Resource when it remains authorized.
	 *
	 * @param array<int,array<string,mixed>> $resources Authorized internal records.
	 * @return int First authorized default Resource ID, or zero when none exist.
	 */
	public function get_default_resource_id( $resources ) {
		$default_resource_id = function_exists( 'wpbc_get_default_resource' ) ? absint( wpbc_get_default_resource() ) : 1;
		foreach ( $resources as $resource ) {
			if ( isset( $resource['id'] ) && $default_resource_id === absint( $resource['id'] ) ) {
				return $default_resource_id;
			}
		}

		return ! empty( $resources[0]['id'] ) ? absint( $resources[0]['id'] ) : 0;
	}

	/**
	 * Resolve the current MultiUser SQL restriction without accepting a user ID.
	 *
	 * @return int|null Current regular owner ID, or null for unrestricted reads.
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

	/**
	 * Recheck one Resource through the released MultiUser ownership filter.
	 *
	 * @param int $resource_id Resource identifier.
	 * @return bool True when the current user may use the Resource.
	 */
	private function current_user_owns_resource( $resource_id ) {
		return ! function_exists( 'wpbc_is_mu_user_can_be_here' )
			|| wpbc_is_mu_user_can_be_here( 'resource_owner', absint( $resource_id ) );
	}

	/**
	 * Return the implicit Free Resource without querying paid storage.
	 *
	 * @return array<string,mixed> Internal Free Resource record.
	 */
	private function get_free_resource() {
		$title = function_exists( 'wpbc_get_resource_title' ) ? wpbc_get_resource_title( 1 ) : '';
		$title = trim( wp_strip_all_tags( function_exists( 'wpbc_lang' ) ? wpbc_lang( (string) $title ) : (string) $title ) );

		return array(
			'id'            => 1,
			'label'         => '' !== $title ? $title : __( 'Default Resource', 'booking' ),
			'parent_id'     => null,
			'owner_user_id' => 0,
		);
	}

	/**
	 * Return a non-sensitive Resource read error.
	 *
	 * @return WP_Error Safe repository error.
	 */
	private function get_query_error() {
		return new WP_Error(
			'wpbc_booking_new_inspector_resources_unavailable',
			__( 'Booking Resources could not be loaded. Reload the page and try again.', 'booking' ),
			array( 'status' => 500 )
		);
	}
}
