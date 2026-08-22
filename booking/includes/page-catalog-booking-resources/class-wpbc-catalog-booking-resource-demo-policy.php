<?php
/**
 * Public-demo mutation policy for the Booking Resources catalog.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Identify demo-created Resources without weakening normal authorization.
 *
 * The live demos must keep their activation fixtures available for every
 * visitor, while still allowing visitors to evaluate create, edit, and delete
 * workflows with Resources created during the demo session. New catalog
 * creations are recorded explicitly. The legacy fixture limits remain as a
 * compatibility fallback for Resources created before this marker existed or
 * through the temporary legacy Resources page.
 */
final class WPBC_Catalog_Booking_Resource_Demo_Policy {

	/**
	 * Site-local list of Resource IDs created after demo activation.
	 *
	 * @var string
	 */
	const CREATED_RESOURCE_IDS_OPTION = 'booking_catalog_demo_created_resource_ids';

	/**
	 * Return whether the current installation is a public demo.
	 *
	 * @return bool True for a public demo installation.
	 */
	public static function is_demo() {
		return function_exists( 'wpbc_is_this_demo' ) && wpbc_is_this_demo();
	}

	/**
	 * Remember Resources created during a public demo.
	 *
	 * Normal Resource ownership and edition checks still authorize every later
	 * mutation. This marker only distinguishes visitor-created Resources from
	 * activation fixtures when deletion is reviewed.
	 *
	 * @param array<int,mixed>|mixed $resource_ids Created Resource IDs.
	 * @return void
	 */
	public static function register_created_resource_ids( $resource_ids ) {
		if ( ! self::is_demo() ) {
			return;
		}

		$created_resource_ids = array_values(
			array_unique(
				array_merge(
					self::get_created_resource_ids(),
					self::normalize_resource_ids( $resource_ids )
				)
			)
		);
		sort( $created_resource_ids, SORT_NUMERIC );
		update_option( self::CREATED_RESOURCE_IDS_OPTION, $created_resource_ids, false );
	}

	/**
	 * Remove successfully deleted Resources from the demo marker.
	 *
	 * @param array<int,mixed>|mixed $resource_ids Deleted Resource IDs.
	 * @return void
	 */
	public static function unregister_resource_ids( $resource_ids ) {
		if ( ! self::is_demo() ) {
			return;
		}

		$deleted_resource_ids = array_fill_keys( self::normalize_resource_ids( $resource_ids ), true );
		$created_resource_ids = array_values(
			array_filter(
				self::get_created_resource_ids(),
				static function ( $resource_id ) use ( $deleted_resource_ids ) {
					return ! isset( $deleted_resource_ids[ $resource_id ] );
				}
			)
		);

		update_option( self::CREATED_RESOURCE_IDS_OPTION, $created_resource_ids, false );
	}

	/**
	 * Return whether one authorized Resource may be deleted in this environment.
	 *
	 * This method does not replace capability, ownership, hierarchy, review-token,
	 * or edition validation. It only protects activation fixtures in public demos.
	 *
	 * @param int $resource_id Booking Resource ID.
	 * @return bool True when the Resource is not a protected demo fixture.
	 */
	public static function can_delete_resource( $resource_id ) {
		$resource_id = absint( $resource_id );
		if ( ! self::is_demo() ) {
			return 0 < $resource_id;
		}
		if ( ! $resource_id ) {
			return false;
		}
		if ( in_array( $resource_id, self::get_created_resource_ids(), true ) ) {
			return true;
		}

		return $resource_id > self::get_initial_resource_id_limit();
	}

	/**
	 * Return protected fixture IDs from a proposed deletion selection.
	 *
	 * @param array<int,mixed>|mixed $resource_ids Proposed Resource IDs.
	 * @return array<int,int> Protected Resource IDs.
	 */
	public static function get_protected_deletion_ids( $resource_ids ) {
		if ( ! self::is_demo() ) {
			return array();
		}

		return array_values(
			array_filter(
				self::normalize_resource_ids( $resource_ids ),
				static function ( $resource_id ) {
					return ! self::can_delete_resource( $resource_id );
				}
			)
		);
	}

	/**
	 * Return demo-created Resource IDs stored for the current site.
	 *
	 * @return array<int,int> Normalized Resource IDs.
	 */
	private static function get_created_resource_ids() {
		return self::normalize_resource_ids( get_option( self::CREATED_RESOURCE_IDS_OPTION, array() ) );
	}

	/**
	 * Return the last Resource ID installed by the matching demo fixture set.
	 *
	 * These limits reproduce the established legacy demo deletion boundary. They
	 * intentionally apply only as a compatibility fallback; new catalog creation
	 * also records exact IDs in the site-local marker above.
	 *
	 * @return int Last protected activation-fixture Resource ID.
	 */
	private static function get_initial_resource_id_limit() {
		if ( class_exists( 'wpdev_bk_multiuser' ) ) {
			return 17;
		}
		if ( class_exists( 'wpdev_bk_biz_l' ) ) {
			return 12;
		}
		if ( class_exists( 'wpdev_bk_personal' ) ) {
			return 4;
		}

		return 1;
	}

	/**
	 * Normalize untrusted scalar or array Resource IDs.
	 *
	 * @param array<int,mixed>|mixed $resource_ids Resource IDs.
	 * @return array<int,int> Unique positive Resource IDs.
	 */
	private static function normalize_resource_ids( $resource_ids ) {
		$normalized_ids = array_values(
			array_filter(
				array_map( 'absint', (array) $resource_ids )
			)
		);
		$normalized_ids = array_values( array_unique( $normalized_ids ) );
		sort( $normalized_ids, SORT_NUMERIC );

		return $normalized_ids;
	}
}
