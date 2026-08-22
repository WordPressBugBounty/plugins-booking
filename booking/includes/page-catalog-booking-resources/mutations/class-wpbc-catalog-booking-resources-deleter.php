<?php
/**
 * Independent reviewed deletion for the template-driven Resource catalog.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Preview and permanently delete an authorized Resource selection.
 */
final class WPBC_Catalog_Booking_Resources_Deleter {

	/** Maximum number of Resources accepted in one deletion. */
	const MAX_SELECTION = 100;

	/** Maximum number of child Resources accepted by one capacity reduction. */
	const MAX_CAPACITY_SELECTION = 199;

	/** @var WPBC_Catalog_Booking_Resources_Repository Independent repository. */
	private $repository;

	/** @var WPBC_Catalog_Booking_Resource_Content_Store Independent content store. */
	private $content_store;

	/**
	 * Initialize independent collaborators.
	 *
	 * @param WPBC_Catalog_Booking_Resources_Repository|null $repository    Optional repository.
	 * @param WPBC_Catalog_Booking_Resource_Content_Store|null $content_store Optional content store.
	 */
	public function __construct( $repository = null, $content_store = null ) {
		$this->repository    = $repository instanceof WPBC_Catalog_Booking_Resources_Repository ? $repository : new WPBC_Catalog_Booking_Resources_Repository();
		$this->content_store = $content_store instanceof WPBC_Catalog_Booking_Resource_Content_Store ? $content_store : new WPBC_Catalog_Booking_Resource_Content_Store();
	}

	/**
	 * Return a signed server-authoritative deletion review.
	 *
	 * @param array<int,mixed> $resource_ids Untrusted Resource IDs.
	 * @return array<string,mixed>|WP_Error Review or safe error.
	 */
	public function preview( $resource_ids ) {
		$review = $this->build_review( $resource_ids );
		if ( is_wp_error( $review ) ) {
			return $review;
		}
		$review['review_token'] = $this->create_review_token( $review );

		return $review;
	}

	/**
	 * Delete a previously reviewed selection while retaining existing bookings.
	 *
	 * @param array<int,mixed> $resource_ids Resource IDs.
	 * @param string           $review_token Signed preview token.
	 * @return array<string,mixed>|WP_Error Result or safe error.
	 */
	public function delete( $resource_ids, $review_token ) {
		$review = $this->build_review( $resource_ids );
		if ( is_wp_error( $review ) ) {
			return $review;
		}

		return $this->delete_review( $review, $review_token );
	}

	/**
	 * Return a signed deletion review limited to direct children of one parent.
	 *
	 * The expected remaining hierarchy is signed so a capacity reduction cannot
	 * silently delete from a group that changed after review.
	 *
	 * @param int              $parent_resource_id Parent Resource ID.
	 * @param array<int,mixed> $resource_ids       Child IDs to delete.
	 * @param array<int,mixed> $remaining_ids      Child IDs expected to remain.
	 * @return array<string,mixed>|WP_Error Signed review or safe error.
	 */
	public function preview_capacity_children( $parent_resource_id, $resource_ids, $remaining_ids ) {
		$review = $this->build_review( $resource_ids, self::MAX_CAPACITY_SELECTION );
		if ( is_wp_error( $review ) ) {
			return $review;
		}
		$review = $this->add_capacity_structure( $review, $parent_resource_id, $remaining_ids );
		if ( is_wp_error( $review ) ) {
			return $review;
		}
		$review['review_token'] = $this->create_review_token( $review );

		return $review;
	}

	/**
	 * Permanently delete reviewed capacity children with structural compensation.
	 *
	 * @param int              $parent_resource_id Parent Resource ID.
	 * @param array<int,mixed> $resource_ids       Reviewed child IDs.
	 * @param array<int,mixed> $remaining_ids      Reviewed children that must remain.
	 * @param string           $review_token       Signed deletion token.
	 * @return array<string,mixed>|WP_Error Result or safe error.
	 */
	public function delete_capacity_children( $parent_resource_id, $resource_ids, $remaining_ids, $review_token ) {
		$review = $this->build_review( $resource_ids, self::MAX_CAPACITY_SELECTION );
		if ( is_wp_error( $review ) ) {
			return $review;
		}
		$review = $this->add_capacity_structure( $review, $parent_resource_id, $remaining_ids );
		if ( is_wp_error( $review ) ) {
			return $review;
		}

		return $this->delete_review( $review, $review_token );
	}

	/**
	 * Delete one already rebuilt and authorized review.
	 *
	 * @param array<string,mixed> $review       Current server-authoritative review.
	 * @param string              $review_token Signed review token.
	 * @return array<string,mixed>|WP_Error Result or safe error.
	 */
	private function delete_review( $review, $review_token ) {
		global $wpdb;
		if ( '' === $review_token || ! hash_equals( $this->create_review_token( $review ), $review_token ) ) {
			return new WP_Error( 'wpbc_catalog_delete_review_stale', __( 'The selected Booking Resources changed after the review. Review the deletion again before continuing.', 'booking' ) );
		}

		$ids          = array_values( array_map( 'absint', wp_list_pluck( $review['resources'], 'id' ) ) );
		$before_image = $this->capture_before_image( $ids );
		if ( is_wp_error( $before_image ) ) {
			return $before_image;
		}
		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		$delete_sql   = "DELETE FROM {$wpdb->prefix}bookingtypes WHERE booking_type_id IN ({$placeholders})";
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Transaction is used where supported; the before-image remains authoritative on legacy engines.
		$transaction_started = false !== $wpdb->query( 'START TRANSACTION' );
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Every ID was authorized and is prepared here.
		$deleted = $wpdb->query( $wpdb->prepare( $delete_sql, $ids ) );
		if ( false === $deleted || absint( $deleted ) !== count( $ids ) ) {
			return $this->get_failure_after_compensation( $before_image, $transaction_started );
		}
		$orphan_check_sql = "SELECT COUNT(*) FROM {$wpdb->prefix}bookingtypes WHERE parent IN ({$placeholders})";
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Rejects a concurrent child created after review before the parent can be committed as deleted.
		$orphan_count = absint( $wpdb->get_var( $wpdb->prepare( $orphan_check_sql, $ids ) ) );
		if ( 0 < $orphan_count ) {
			return $this->get_failure_after_compensation( $before_image, $transaction_started );
		}
		if ( ! $this->has_expected_capacity_structure( $review ) ) {
			return $this->get_failure_after_compensation( $before_image, $transaction_started );
		}

		$meta_sql = "DELETE FROM {$wpdb->prefix}booking_types_meta WHERE type_id IN ({$placeholders})";
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Deletes metadata owned by the authorized deleted Resources.
		$deleted_meta = $wpdb->query( $wpdb->prepare( $meta_sql, $ids ) );
		if ( false === $deleted_meta ) {
			return $this->get_failure_after_compensation( $before_image, $transaction_started );
		}
		foreach ( $ids as $resource_id ) {
			$presentation_deleted = $this->content_store->delete( $resource_id );
			if ( is_wp_error( $presentation_deleted ) ) {
				return $this->get_failure_after_compensation( $before_image, $transaction_started );
			}
		}
		if ( $transaction_started && false === $wpdb->query( 'COMMIT' ) ) {
			return $this->get_failure_after_compensation( $before_image, true );
		}

		// Verify the committed canonical structure as well. On a non-transactional
		// legacy table, restoring the parent safely adopts a concurrently added
		// child instead of leaving that child orphaned.
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Post-write verification uses the same prepared, reviewed IDs.
		$remaining_orphan_count = absint( $wpdb->get_var( $wpdb->prepare( $orphan_check_sql, $ids ) ) );
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Confirms every reviewed canonical row remains deleted.
		$remaining_row_count = absint( $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}bookingtypes WHERE booking_type_id IN ({$placeholders})", $ids ) ) );
		if ( 0 < $remaining_orphan_count || 0 < $remaining_row_count ) {
			return $this->get_failure_after_compensation( $before_image, false );
		}
		if ( ! $this->has_expected_capacity_structure( $review ) ) {
			return $this->get_failure_after_compensation( $before_image, false );
		}

		do_action( 'wpbc_deleted_booking_resources', implode( ',', $ids ) );
		do_action( 'wpbc_catalog_booking_resources_deleted', $ids );
		WPBC_Catalog_Booking_Resource_Demo_Policy::unregister_resource_ids( $ids );
		if ( function_exists( 'make_bk_action' ) ) {
			make_bk_action( 'wpbc_reinit_booking_resource_cache' );
		}

		return array( 'deleted_ids' => $ids, 'deleted_count' => count( $ids ) );
	}

	/**
	 * Build the current deletion impact after authorization and hierarchy checks.
	 *
	 * @param array<int,mixed> $resource_ids       Resource IDs.
	 * @param int              $maximum_selection Maximum accepted selection size.
	 * @return array<string,mixed>|WP_Error Review or safe error.
	 */
	private function build_review( $resource_ids, $maximum_selection = self::MAX_SELECTION ) {
		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			return new WP_Error( 'wpbc_catalog_delete_edition', __( 'Deleting Booking Resources is available in Pro versions.', 'booking' ) );
		}

		$resources = $this->get_authorized_resources( $resource_ids, $maximum_selection );
		if ( is_wp_error( $resources ) ) {
			return $resources;
		}
		$protected_resource_ids = WPBC_Catalog_Booking_Resource_Demo_Policy::get_protected_deletion_ids( wp_list_pluck( $resources, 'id' ) );
		if ( ! empty( $protected_resource_ids ) ) {
			return new WP_Error(
				'wpbc_catalog_delete_demo_seed',
				__( 'The Booking Resources installed with this demo are protected and cannot be deleted. Select only Resources created during this demo.', 'booking' )
			);
		}
		$selected_ids = array_fill_keys( array_map( 'absint', wp_list_pluck( $resources, 'id' ) ), true );
		foreach ( $resources as $resource ) {
			foreach ( isset( $resource['children'] ) ? (array) $resource['children'] : array() as $child ) {
				$child_id = isset( $child['id'] ) ? absint( $child['id'] ) : 0;
				if ( $child_id && ! isset( $selected_ids[ $child_id ] ) ) {
					return new WP_Error(
						'wpbc_catalog_delete_children_missing',
						sprintf( __( 'A parent resource can be deleted only with all its child resources. Also select: %s.', 'booking' ), wp_strip_all_tags( wpbc_lang( (string) $child['title'] ) ) )
					);
				}
			}
		}

		$counts        = $this->get_booking_counts( array_keys( $selected_ids ) );
		$review_items  = array();
		$total_bookings = 0;
		foreach ( $resources as $resource ) {
			$resource_id   = absint( $resource['id'] );
			$booking_count = isset( $counts[ $resource_id ] ) ? absint( $counts[ $resource_id ] ) : 0;
			$total_bookings += $booking_count;
			$review_items[] = array(
				'id'                  => $resource_id,
				'title'               => wp_strip_all_tags( wpbc_lang( (string) $resource['title'] ) ),
				'parent_id'           => isset( $resource['parent_id'] ) ? absint( $resource['parent_id'] ) : 0,
				'child_count'         => isset( $resource['child_count'] ) ? absint( $resource['child_count'] ) : 0,
				'type_label'          => $this->get_type_label( $resource ),
				'booking_count'       => $booking_count,
				'booking_count_label' => sprintf(
					/* translators: %s: Number of retained bookings. */
					_n( '%s booking retained', '%s bookings retained', $booking_count, 'booking' ),
					number_format_i18n( $booking_count )
				),
				'actions'             => $this->get_booking_actions( $resource_id, $booking_count ),
			);
		}
		$selection_count = count( $review_items );

		return array(
			'mode'                => 'delete_review',
			'resources'           => $review_items,
			'selection_count'     => $selection_count,
			'total_booking_count' => $total_bookings,
			'has_bookings'        => $total_bookings > 0,
			'i18n'                => $this->get_review_i18n( $selection_count ),
		);
	}

	/**
	 * Return deletion-review text using WordPress locale plural rules.
	 *
	 * Preparing count-sensitive text on the server keeps the WP template free
	 * from English-only singular/plural assumptions.
	 *
	 * @param int $selection_count Number of Resources in the review.
	 * @return array<string,string> Localized deletion-review strings.
	 */
	private function get_review_i18n( $selection_count ) {
		$selection_count = max( 1, absint( $selection_count ) );

		return array(
			'title'                     => _n( 'Delete Booking Resource', 'Delete Booking Resources', $selection_count, 'booking' ),
			'selection_label'           => sprintf(
				/* translators: %s: Number of selected Booking Resources. */
				_n( '%s resource selected', '%s resources selected', $selection_count, 'booking' ),
				number_format_i18n( $selection_count )
			),
			'review_help'               => _n( 'Review this permanent action before deleting the selected resource.', 'Review this permanent action before deleting the selected resources.', $selection_count, 'booking' ),
			'resources_to_delete'       => _n( 'Resource to be permanently deleted', 'Resources to be permanently deleted', $selection_count, 'booking' ),
			'acknowledgement'           => _n( 'I understand that this Booking Resource will be permanently deleted.', 'I understand that these Booking Resources will be permanently deleted.', $selection_count, 'booking' ),
			'warning'                   => _n( 'This permanently removes the selected Booking Resource and its resource settings. This action cannot be undone.', 'This permanently removes the selected Booking Resources and their resource settings. This action cannot be undone.', $selection_count, 'booking' ),
			'bookings_retained_warning' => _n( 'Existing bookings are retained, but their deleted Booking Resource will no longer be available. Reassign or remove those bookings first if they must remain editable.', 'Existing bookings are retained, but their deleted Booking Resources will no longer be available. Reassign or remove those bookings first if they must remain editable.', $selection_count, 'booking' ),
			'actions_heading'           => __( 'Open affected records', 'booking' ),
			'delete_button'             => sprintf(
				/* translators: %s: Number of Booking Resources to delete. */
				_n( 'Delete %s resource', 'Delete %s resources', $selection_count, 'booking' ),
				number_format_i18n( $selection_count )
			),
		);
	}

	/**
	 * Build an authorized link to bookings affected by one Resource deletion.
	 *
	 * Booking rows do not block Resource deletion, but the direct link lets an
	 * administrator reassign or remove them before applying the reviewed action.
	 *
	 * @param int $resource_id  Booking Resource ID.
	 * @param int $booking_count Number of retained bookings.
	 *
	 * @return array<int,array<string,string>> Authorized affected-record actions.
	 */
	private function get_booking_actions( $resource_id, $booking_count ) {
		$resource_id  = absint( $resource_id );
		$booking_count = absint( $booking_count );
		if ( ! $resource_id || ! $booking_count || ! function_exists( 'wpbc_get_bookings_url' ) || ! current_user_can( wpbc_catalog_booking_resources_get_role_capability( 'booking_user_role_booking' ) ) ) {
			return array();
		}

		return array(
			array(
				'label'       => sprintf(
					/* translators: %s: Number of retained bookings. */
					_n( 'View %s retained booking', 'View %s retained bookings', $booking_count, 'booking' ),
					number_format_i18n( $booking_count )
				),
				'url'         => esc_url_raw(
					add_query_arg(
						array(
							'tab'             => 'vm_booking_listing',
							'wh_booking_type' => $resource_id,
							'overwrite'       => 1,
						),
						wpbc_get_bookings_url( true, false )
					)
				),
				'description' => __( 'Reassign or remove these bookings before deletion if they must remain editable.', 'booking' ),
			),
		);
	}

	/**
	 * Resolve unique IDs through the independent repository.
	 *
	 * @param array<int,mixed> $resource_ids       Resource IDs.
	 * @param int              $maximum_selection Maximum accepted selection size.
	 * @return array<int,array<string,mixed>>|WP_Error Resources or safe error.
	 */
	private function get_authorized_resources( $resource_ids, $maximum_selection ) {
		$ids = array();
		foreach ( is_array( $resource_ids ) ? $resource_ids : array() as $resource_id ) {
			$resource_id = absint( $resource_id );
			if ( $resource_id ) {
				$ids[ $resource_id ] = $resource_id;
			}
		}
		$ids = array_values( $ids );
		if ( empty( $ids ) ) {
			return new WP_Error( 'wpbc_catalog_delete_selection_small', __( 'Select at least one Booking Resource to delete.', 'booking' ) );
		}
		$maximum_selection = max( 1, absint( $maximum_selection ) );
		if ( count( $ids ) > $maximum_selection ) {
			return new WP_Error( 'wpbc_catalog_delete_selection_large', sprintf( __( 'Select no more than %s Booking Resources in one deletion.', 'booking' ), number_format_i18n( $maximum_selection ) ) );
		}

		$resources = array();
		foreach ( $ids as $resource_id ) {
			$resource = $this->repository->get_resource( $resource_id );
			if ( is_wp_error( $resource ) ) {
				return $resource;
			}
			if ( ! is_array( $resource ) ) {
				return new WP_Error( 'wpbc_catalog_delete_resource_unavailable', __( 'One of the selected Booking Resources is not available to this account.', 'booking' ) );
			}
			$resource_children = $this->repository->get_capacity_children( $resource_id );
			if ( is_wp_error( $resource_children ) ) {
				return new WP_Error( 'wpbc_catalog_delete_hierarchy_incomplete', __( 'This resource group contains child resources that are unavailable in the current account context. It cannot be deleted here.', 'booking' ) );
			}
			$resource['children'] = $resource_children;
			$resources[] = $resource;
		}

		return $resources;
	}

	/**
	 * Add and validate the parent structure owned by a capacity deletion.
	 *
	 * @param array<string,mixed> $review              Current deletion review.
	 * @param int                 $parent_resource_id  Expected parent ID.
	 * @param array<int,mixed>    $remaining_ids       Expected remaining children.
	 * @return array<string,mixed>|WP_Error Capacity-bound review or error.
	 */
	private function add_capacity_structure( $review, $parent_resource_id, $remaining_ids ) {
		$parent_resource_id = absint( $parent_resource_id );
		$remaining_ids      = array_values( array_unique( array_filter( array_map( 'absint', (array) $remaining_ids ) ) ) );
		sort( $remaining_ids, SORT_NUMERIC );
		if ( ! $parent_resource_id ) {
			return new WP_Error( 'wpbc_catalog_capacity_parent_invalid', __( 'The parent Booking Resource is invalid.', 'booking' ) );
		}
		foreach ( (array) $review['resources'] as $resource ) {
			if ( $parent_resource_id !== absint( $resource['parent_id'] ) || 0 !== absint( $resource['child_count'] ) ) {
				return new WP_Error( 'wpbc_catalog_capacity_delete_child_invalid', __( 'Only direct child units of this resource group can be deleted while reducing capacity.', 'booking' ) );
			}
		}
		$current_children = $this->repository->get_capacity_children( $parent_resource_id );
		if ( is_wp_error( $current_children ) ) {
			return $current_children;
		}
		$current_child_ids = array_values( array_map( 'absint', wp_list_pluck( $current_children, 'id' ) ) );
		$reviewed_ids      = array_values( array_map( 'absint', wp_list_pluck( $review['resources'], 'id' ) ) );
		$expected_all_ids  = array_values( array_unique( array_merge( $remaining_ids, $reviewed_ids ) ) );
		sort( $current_child_ids, SORT_NUMERIC );
		sort( $expected_all_ids, SORT_NUMERIC );
		if ( $current_child_ids !== $expected_all_ids ) {
			return new WP_Error( 'wpbc_catalog_capacity_delete_structure_changed', __( 'This resource group changed before the child deletion could be reviewed. Reload the catalog and try again.', 'booking' ) );
		}
		$review['capacity_parent_id']       = $parent_resource_id;
		$review['expected_capacity_children'] = $remaining_ids;

		return $review;
	}

	/**
	 * Verify an optional capacity-parent structure before and after deletion.
	 *
	 * @param array<string,mixed> $review Current deletion review.
	 * @return bool True when no capacity constraint exists or it still matches.
	 */
	private function has_expected_capacity_structure( $review ) {
		global $wpdb;

		if ( empty( $review['capacity_parent_id'] ) ) {
			return true;
		}
		$expected_ids = array_values( array_map( 'absint', (array) $review['expected_capacity_children'] ) );
		sort( $expected_ids, SORT_NUMERIC );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Exact post-mutation hierarchy verification supports engine-independent compensation.
		$current_ids = array_map( 'absint', (array) $wpdb->get_col( $wpdb->prepare( "SELECT booking_type_id FROM {$wpdb->prefix}bookingtypes WHERE parent = %d ORDER BY booking_type_id ASC", absint( $review['capacity_parent_id'] ) ) ) );

		return '' === (string) $wpdb->last_error && $expected_ids === $current_ids;
	}

	/**
	 * Count retained bookings for authorized Resource IDs.
	 *
	 * @param array<int,mixed> $resource_ids Resource IDs.
	 * @return array<int,int> Counts indexed by Resource ID.
	 */
	private function get_booking_counts( $resource_ids ) {
		global $wpdb;

		$ids = array_values( array_filter( array_map( 'absint', $resource_ids ) ) );
		if ( empty( $ids ) ) {
			return array();
		}
		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		$sql          = "SELECT booking_type, COUNT(*) AS booking_count FROM {$wpdb->prefix}booking WHERE booking_type IN ({$placeholders}) GROUP BY booking_type";
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read-only impact summary for prepared authorized IDs.
		$rows   = $wpdb->get_results( $wpdb->prepare( $sql, $ids ), ARRAY_A );
		$counts = array();
		foreach ( is_array( $rows ) ? $rows : array() as $row ) {
			$counts[ absint( $row['booking_type'] ) ] = absint( $row['booking_count'] );
		}

		return $counts;
	}

	/**
	 * Capture every value removed by a reviewed deletion.
	 *
	 * The snapshot permits explicit compensation on legacy MyISAM tables where
	 * transaction commands do not guarantee rollback.
	 *
	 * @param array<int,int> $resource_ids Reviewed Resource IDs.
	 *
	 * @return array<string,mixed>|WP_Error Complete before-image or storage error.
	 */
	private function capture_before_image( $resource_ids ) {
		global $wpdb;

		$resource_ids = array_values( array_filter( array_map( 'absint', $resource_ids ) ) );
		$placeholders = implode( ',', array_fill( 0, count( $resource_ids ), '%d' ) );
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Exact reviewed rows are required for compensation.
		$resource_rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}bookingtypes WHERE booking_type_id IN ({$placeholders})", $resource_ids ), ARRAY_A );
		if ( '' !== (string) $wpdb->last_error || count( (array) $resource_rows ) !== count( $resource_ids ) ) {
			return new WP_Error( 'wpbc_catalog_delete_snapshot_failed', __( 'The selected Booking Resources could not be prepared for safe deletion.', 'booking' ) );
		}
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Exact owned metadata is required for compensation.
		$metadata_rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}booking_types_meta WHERE type_id IN ({$placeholders})", $resource_ids ), ARRAY_A );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $metadata_rows ) ) {
			return new WP_Error( 'wpbc_catalog_delete_snapshot_failed', __( 'The selected Booking Resources could not be prepared for safe deletion.', 'booking' ) );
		}

		$presentation_options = array();
		foreach ( $resource_ids as $resource_id ) {
			$option_name = WPBC_Catalog_Booking_Resources_Repository::CONTENT_OPTION_PREFIX . $resource_id;
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Existence must be distinguished from a missing option for exact compensation.
			$option_row = $wpdb->get_row( $wpdb->prepare( "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", $option_name ), ARRAY_A );
			$presentation_options[ $option_name ] = is_array( $option_row )
				? array( 'exists' => true, 'value' => maybe_unserialize( $option_row['option_value'] ) )
				: array( 'exists' => false, 'value' => null );
		}
		$search_options = null;
		if ( function_exists( 'wpbc_searchable_resources__get_all_options' ) ) {
			$all_search_options = (array) wpbc_searchable_resources__get_all_options();
			$search_options     = array();
			foreach ( $resource_ids as $resource_id ) {
				$search_options[ $resource_id ] = array_key_exists( $resource_id, $all_search_options )
					? array( 'exists' => true, 'value' => $all_search_options[ $resource_id ] )
					: array( 'exists' => false, 'value' => null );
			}
		}

		return array(
			'resource_ids'         => $resource_ids,
			'resource_rows'        => $resource_rows,
			'metadata_rows'        => $metadata_rows,
			'presentation_options' => $presentation_options,
			'search_options'       => $search_options,
		);
	}

	/**
	 * Roll back when possible, restore the captured values, and return a safe error.
	 *
	 * @param array<string,mixed> $before_image       Values captured before deletion.
	 * @param bool                $transaction_started Whether START TRANSACTION succeeded.
	 *
	 * @return WP_Error Mutation failure or high-severity compensation failure.
	 */
	private function get_failure_after_compensation( $before_image, $transaction_started ) {
		global $wpdb;

		if ( $transaction_started ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Best-effort database rollback precedes engine-independent compensation.
			$wpdb->query( 'ROLLBACK' );
		}
		$compensated = $this->restore_before_image( $before_image );
		if ( ! $compensated ) {
			return new WP_Error( 'wpbc_catalog_delete_compensation_failed', __( 'The deletion failed and could not be fully compensated. Contact an administrator before trying again.', 'booking' ) );
		}

		return new WP_Error( 'wpbc_catalog_delete_failed', __( 'The selected Booking Resources could not be deleted. No deletion was applied.', 'booking' ) );
	}

	/**
	 * Restore and verify a deletion before-image.
	 *
	 * @param array<string,mixed> $before_image Captured canonical and presentation values.
	 *
	 * @return bool True only when every captured value is restored.
	 */
	private function restore_before_image( $before_image ) {
		global $wpdb;

		foreach ( (array) $before_image['resource_rows'] as $resource_row ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Recovery writes only the exact request-local before-image.
			if ( false === $wpdb->replace( $wpdb->prefix . 'bookingtypes', $resource_row, array_fill( 0, count( $resource_row ), '%s' ) ) ) {
				return false;
			}
		}
		$resource_ids = array_values( array_map( 'absint', (array) $before_image['resource_ids'] ) );
		$placeholders = implode( ',', array_fill( 0, count( $resource_ids ), '%d' ) );
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery -- Recovery resets only metadata owned by the reviewed IDs.
		if ( false === $wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}booking_types_meta WHERE type_id IN ({$placeholders})", $resource_ids ) ) ) {
			return false;
		}
		foreach ( (array) $before_image['metadata_rows'] as $metadata_row ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Recovery writes only the exact request-local before-image.
			if ( false === $wpdb->replace( $wpdb->prefix . 'booking_types_meta', $metadata_row, array_fill( 0, count( $metadata_row ), '%s' ) ) ) {
				return false;
			}
		}
		foreach ( (array) $before_image['presentation_options'] as $option_name => $option_state ) {
			if ( ! empty( $option_state['exists'] ) ) {
				update_option( $option_name, $option_state['value'], false );
			} else {
				delete_option( $option_name );
			}
		}
		if ( is_array( $before_image['search_options'] ) && function_exists( 'wpbc_searchable_resources__get_all_options' ) && function_exists( 'wpbc_searchable_resources__save_all_options' ) ) {
			$current_search_options = (array) wpbc_searchable_resources__get_all_options();
			foreach ( $before_image['search_options'] as $resource_id => $search_state ) {
				if ( ! empty( $search_state['exists'] ) ) {
					$current_search_options[ absint( $resource_id ) ] = $search_state['value'];
				} else {
					unset( $current_search_options[ absint( $resource_id ) ] );
				}
			}
			wpbc_searchable_resources__save_all_options( $current_search_options );
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Final canonical verification of compensated IDs.
		$restored_count = absint( $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}bookingtypes WHERE booking_type_id IN ({$placeholders})", $resource_ids ) ) );
		if ( count( $resource_ids ) !== $restored_count ) {
			return false;
		}
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Exact metadata count verifies the captured before-image.
		$restored_metadata_count = absint( $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}booking_types_meta WHERE type_id IN ({$placeholders})", $resource_ids ) ) );
		if ( count( (array) $before_image['metadata_rows'] ) !== $restored_metadata_count ) {
			return false;
		}
		foreach ( (array) $before_image['presentation_options'] as $option_name => $option_state ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Existence and exact value are both required for compensation verification.
			$restored_option = $wpdb->get_row( $wpdb->prepare( "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", $option_name ), ARRAY_A );
			if ( empty( $option_state['exists'] ) ) {
				if ( is_array( $restored_option ) ) {
					return false;
				}
			} elseif ( ! is_array( $restored_option ) || maybe_unserialize( $restored_option['option_value'] ) !== $option_state['value'] ) {
				return false;
			}
		}
		if ( is_array( $before_image['search_options'] ) && function_exists( 'wpbc_searchable_resources__get_all_options' ) ) {
			$restored_search_options = (array) wpbc_searchable_resources__get_all_options();
			foreach ( $before_image['search_options'] as $resource_id => $search_state ) {
				$resource_id = absint( $resource_id );
				if ( empty( $search_state['exists'] ) ) {
					if ( array_key_exists( $resource_id, $restored_search_options ) ) {
						return false;
					}
				} elseif ( ! array_key_exists( $resource_id, $restored_search_options ) || $restored_search_options[ $resource_id ] !== $search_state['value'] ) {
					return false;
				}
			}
		}

		return true;
	}

	/**
	 * Return a safe structure label without invoking the old catalog.
	 *
	 * @param array<string,mixed> $resource Resource.
	 * @return string Translated type label.
	 */
	private function get_type_label( $resource ) {
		if ( ! empty( $resource['parent_id'] ) ) {
			return __( 'Child resource', 'booking' );
		}
		if ( ! empty( $resource['child_count'] ) ) {
			return __( 'Parent resource', 'booking' );
		}

		return __( 'Independent resource', 'booking' );
	}

	/**
	 * Sign current identities, hierarchy, and booking impact.
	 *
	 * @param array<string,mixed> $review Review data.
	 * @return string Review signature.
	 */
	private function create_review_token( $review ) {
		return wp_hash(
			wp_json_encode(
				array(
					'resources'                    => $review['resources'],
					'total_booking_count'          => $review['total_booking_count'],
					'capacity_parent_id'           => isset( $review['capacity_parent_id'] ) ? absint( $review['capacity_parent_id'] ) : 0,
					'expected_capacity_children'   => isset( $review['expected_capacity_children'] ) ? array_values( array_map( 'absint', $review['expected_capacity_children'] ) ) : array(),
				)
			),
			'nonce'
		);
	}
}
