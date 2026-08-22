<?php
/**
 * Independent SQL repository for the Booking Resources catalog.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Read authorized Booking Resource records without using either old catalog.
 *
 * Paid editions read the canonical `bookingtypes` table. Free has one implicit
 * Resource and therefore does not query that table. Dynamic values are always
 * prepared, sort expressions are selected from a fixed map, and MultiUser
 * ownership is applied to result and count queries at this boundary.
 */
final class WPBC_Catalog_Booking_Resources_Repository {

	/**
	 * Cross-edition Resource presentation option prefix.
	 *
	 * @var string
	 */
	const CONTENT_OPTION_PREFIX = 'wpbc_booking_resource_content_';

	/**
	 * Load one authorized, filtered, sorted, and paginated Resource page.
	 *
	 * @param array $query_values Validated page, page-size, sorting, search, and Resource type values.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Domain records or a safe error.
	 */
	public function get_resources( $query_values ) {
		$query_values = $this->normalize_query_values( $query_values );

		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			$resource = $this->get_free_resource();
			if ( ! $this->free_resource_matches( $resource, $query_values ) || 0 < $query_values['offset'] ) {
				return array();
			}

			return array( $resource );
		}
		if ( class_exists( 'wpdev_bk_biz_l' ) && 'all' === $query_values['resource_type'] ) {
			return $this->get_paid_hierarchy_resources( $query_values );
		}

		return $this->get_paid_resources( $query_values );
	}

	/**
	 * Count authorized Resources using the same search and type predicates.
	 *
	 * @param array $query_values Validated search and Resource type values.
	 *
	 * @return int|WP_Error Matching Resource count or a safe error.
	 */
	public function count_resources( $query_values ) {
		global $wpdb;

		$query_values = $this->normalize_query_values( $query_values );
		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			return $this->free_resource_matches( $this->get_free_resource(), $query_values ) ? 1 : 0;
		}
		if ( class_exists( 'wpdev_bk_biz_l' ) && 'all' === $query_values['resource_type'] ) {
			return $this->count_paid_hierarchy_groups( $query_values );
		}

		$query_parameters = array();
		$where_sql        = $this->get_paid_where_sql( $query_values, $query_parameters );
		$sql              = "SELECT COUNT(*) FROM {$wpdb->prefix}bookingtypes AS bt WHERE {$where_sql}";
		$sql              = $this->prepare_sql( $sql, $query_parameters );
		if ( is_wp_error( $sql ) ) {
			return $sql;
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared read-only repository query.
		$total_resources = $wpdb->get_var( $sql );
		if ( '' !== (string) $wpdb->last_error ) {
			return $this->get_query_error();
		}

		return max( 0, (int) $total_resources );
	}

	/**
	 * Load one authorized Resource by ID.
	 *
	 * @param int $resource_id Booking Resource ID.
	 *
	 * @return array<string,mixed>|WP_Error|null Domain record, safe error, or null when hidden/missing.
	 */
	public function get_resource( $resource_id ) {
		$resource_id = absint( $resource_id );
		if ( ! $resource_id ) {
			return null;
		}

		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			return 1 === $resource_id ? $this->get_free_resource() : null;
		}

		$resources = $this->get_paid_resources(
			array(
				'page_number'    => 1,
				'items_per_page' => 1,
				'offset'         => 0,
				'sort_by'        => 'id',
				'sort_order'     => 'asc',
				'search'         => '',
				'resource_type'  => 'all',
			),
			$resource_id
		);
		if ( is_wp_error( $resources ) ) {
			return $resources;
		}

		return isset( $resources[0] ) ? $resources[0] : null;
	}

	/**
	 * Describe hierarchy metadata already present on authorized records.
	 *
	 * This method performs no rendering and no additional per-row queries. Phase
	 * 7 can consume this stable metadata when grouped pagination is introduced.
	 *
	 * @param array $resources Authorized repository records.
	 *
	 * @return array<string,mixed> Normalized hierarchy summary.
	 */
	public function get_hierarchy( $resources = array() ) {
		$nodes                 = array();
		$pagination_unit_count = 0;
		foreach ( is_array( $resources ) ? $resources : array() as $resource ) {
			if ( ! is_array( $resource ) || empty( $resource['id'] ) ) {
				continue;
			}

			$nodes[] = array(
				'id'                  => absint( $resource['id'] ),
				'parent_id'           => isset( $resource['parent_id'] ) ? absint( $resource['parent_id'] ) : 0,
				'child_count'         => isset( $resource['child_count'] ) ? max( 0, absint( $resource['child_count'] ) ) : 0,
				'visible_child_count' => isset( $resource['visible_child_count'] ) ? max( 0, absint( $resource['visible_child_count'] ) ) : 0,
				'is_group_root'       => ! empty( $resource['is_group_root'] ),
			);
			if ( ! empty( $resource['is_group_root'] ) ) {
				++$pagination_unit_count;
			}
		}

		return array(
			'enabled'               => class_exists( 'wpdev_bk_biz_l' ),
			'pagination_unit_count' => $pagination_unit_count,
			'nodes'                 => $nodes,
		);
	}

	/**
	 * Load one authorized Resource and its lazy details-only relationships.
	 *
	 * Children and published-page matches are intentionally loaded here rather
	 * than in the list query. This keeps list responses bounded while retaining
	 * the repository as the only Phase 8 component that executes SQL.
	 *
	 * @param int $resource_id Booking Resource ID.
	 *
	 * @return array<string,mixed>|WP_Error|null Domain record, safe error, or null.
	 */
	public function get_resource_details( $resource_id ) {
		$resource = $this->get_resource( $resource_id );
		if ( is_wp_error( $resource ) || null === $resource ) {
			return $resource;
		}

		$resource_id                     = absint( $resource['id'] );
		$resource['children']             = $this->get_authorized_children( $resource_id );
		$resource['published_pages']      = $this->find_published_pages( $resource_id );
		$publishing_shortcodes            = $this->get_publishing_shortcodes( array( $resource_id ) );
		$resource['publishing_shortcode'] = isset( $publishing_shortcodes[ $resource_id ] )
			? $publishing_shortcodes[ $resource_id ]
			: '[booking resource_id=' . $resource_id . ']';

		return $resource;
	}

	/**
	 * Return same-owner top-level Resources eligible to become a parent.
	 *
	 * The query repeats the repository's MultiUser restriction and excludes the
	 * current Resource. Child Resources are never returned, preventing nested
	 * hierarchies and cycles before the update service validates the selection.
	 *
	 * @param array<string,mixed> $resource Authorized current Resource record.
	 *
	 * @return array<int,array{value:string,label:string}> Parent select options.
	 */
	public function get_parent_options( $resource ) {
		$options = array(
			array( 'value' => '0', 'label' => __( 'Independent resource', 'booking' ) ),
		);
		if ( ! class_exists( 'wpdev_bk_biz_l' ) || empty( $resource['id'] ) ) {
			return $options;
		}

		global $wpdb;

		$resource_id     = absint( $resource['id'] );
		$resource_owner  = isset( $resource['owner_user_id'] ) ? absint( $resource['owner_user_id'] ) : 0;
		$query_parameters = array( $resource_id );
		$sql              = "SELECT bt.booking_type_id AS id, bt.title AS title FROM {$wpdb->prefix}bookingtypes AS bt WHERE bt.parent = 0 AND bt.booking_type_id <> %d";
		if ( class_exists( 'wpdev_bk_multiuser' ) ) {
			$sql               .= ' AND bt.users = %d';
			$query_parameters[] = $resource_owner;
		}
		$restricted_owner_id = $this->get_restricted_owner_user_id();
		if ( null !== $restricted_owner_id && ( ! class_exists( 'wpdev_bk_multiuser' ) || $restricted_owner_id !== $resource_owner ) ) {
			return $options;
		}
		$sql .= ' ORDER BY bt.prioritet ASC, bt.booking_type_id ASC';
		$sql  = $this->prepare_sql( $sql, $query_parameters );
		if ( is_wp_error( $sql ) ) {
			return $options;
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared, bounded parent-choice query.
		$parent_rows = $wpdb->get_results( $sql, ARRAY_A );
		foreach ( is_array( $parent_rows ) ? $parent_rows : array() as $parent_row ) {
			$parent_id = isset( $parent_row['id'] ) ? absint( $parent_row['id'] ) : 0;
			if ( $parent_id ) {
				$options[] = array(
					'value' => (string) $parent_id,
					'label' => wp_strip_all_tags( wpbc_lang( (string) $parent_row['title'] ) ),
				);
			}
		}

		return $options;
	}

	/**
	 * Return authorized top-level Resources available to a create request.
	 *
	 * Unlike edit choices, creation has no current Resource to exclude. The
	 * repository still applies the current MultiUser ownership boundary before
	 * any Resource identifier or title enters the inspector schema.
	 *
	 * @return array<int,array{value:string,label:string}> Parent select options.
	 */
	public function get_create_parent_options() {
		$options = array(
			array( 'value' => '0', 'label' => __( 'Select a parent resource', 'booking' ) ),
		);
		if ( ! class_exists( 'wpdev_bk_biz_l' ) ) {
			return $options;
		}

		global $wpdb;

		$query_parameters = array();
		$sql              = "SELECT bt.booking_type_id AS id, bt.title AS title FROM {$wpdb->prefix}bookingtypes AS bt WHERE bt.parent = 0";
		$owner_user_id    = $this->get_restricted_owner_user_id();
		if ( null !== $owner_user_id ) {
			$sql                .= ' AND bt.users = %d';
			$query_parameters[] = $owner_user_id;
		}
		$sql .= ' ORDER BY bt.prioritet ASC, bt.booking_type_id ASC';
		$sql  = $this->prepare_sql( $sql, $query_parameters );
		if ( is_wp_error( $sql ) ) {
			return $options;
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared, bounded create-parent query.
		$parent_rows = $wpdb->get_results( $sql, ARRAY_A );
		foreach ( is_array( $parent_rows ) ? $parent_rows : array() as $parent_row ) {
			$parent_id = isset( $parent_row['id'] ) ? absint( $parent_row['id'] ) : 0;
			if ( $parent_id ) {
				$options[] = array(
					'value' => (string) $parent_id,
					'label' => wp_strip_all_tags( wpbc_lang( (string) $parent_row['title'] ) ),
				);
			}
		}

		return $options;
	}

	/**
	 * Load authorized direct children for one Resource.
	 *
	 * The same MultiUser owner restriction as the list and exact-item queries is
	 * applied before a child title can enter the details DTO.
	 *
	 * @param int $parent_resource_id Parent Booking Resource ID.
	 *
	 * @return array<int,array{id:int,title:string}> Authorized child summaries.
	 */
	public function get_authorized_children( $parent_resource_id ) {
		global $wpdb;

		$parent_resource_id = absint( $parent_resource_id );
		if ( ! class_exists( 'wpdev_bk_biz_l' ) || ! $parent_resource_id ) {
			return array();
		}

		$query_parameters = array( $parent_resource_id );
		$sql              = "SELECT bt.booking_type_id AS id, bt.title AS title FROM {$wpdb->prefix}bookingtypes AS bt WHERE bt.parent = %d";
		$owner_user_id    = $this->get_restricted_owner_user_id();
		if ( null !== $owner_user_id ) {
			$sql                .= ' AND bt.users = %d';
			$query_parameters[] = $owner_user_id;
		}
		$sql .= ' ORDER BY bt.booking_type_id ASC';
		$sql  = $this->prepare_sql( $sql, $query_parameters );
		if ( is_wp_error( $sql ) ) {
			return array();
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared lazy relationship query.
		$child_rows = $wpdb->get_results( $sql, ARRAY_A );
		$children   = array();
		foreach ( is_array( $child_rows ) ? $child_rows : array() as $child_row ) {
			$child_id = isset( $child_row['id'] ) ? absint( $child_row['id'] ) : 0;
			if ( $child_id ) {
				$children[] = array(
					'id'    => $child_id,
					'title' => wp_strip_all_tags( wpbc_lang( (string) $child_row['title'] ) ),
				);
			}
		}

		return $children;
	}

	/**
	 * Load complete authorized child records for a capacity operation.
	 *
	 * Capacity changes require the same enriched values as the catalog plus a
	 * proof that MultiUser filtering did not hide part of the canonical group.
	 * Returning an error for a partially visible hierarchy prevents a mutation
	 * from changing a group the current account cannot review in full.
	 *
	 * @param int $parent_resource_id Authorized top-level Booking Resource ID.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Enriched children or a safe hierarchy error.
	 */
	public function get_capacity_children( $parent_resource_id ) {
		global $wpdb;

		$parent_resource_id = absint( $parent_resource_id );
		if ( ! class_exists( 'wpdev_bk_biz_l' ) || ! $parent_resource_id ) {
			return array();
		}

		$select_parameters = array();
		$select_fields     = $this->get_paid_select_fields( $select_parameters );
		$query_parameters  = array_merge( $select_parameters, array( $parent_resource_id ) );
		$sql               = 'SELECT ' . implode( ', ', $select_fields )
			. " FROM {$wpdb->prefix}bookingtypes AS bt WHERE bt.parent = %d";
		$owner_user_id     = $this->get_restricted_owner_user_id();
		if ( null !== $owner_user_id ) {
			$sql               .= ' AND bt.users = %d';
			$query_parameters[] = $owner_user_id;
		}
		$sql .= ' ORDER BY bt.prioritet ASC, bt.booking_type_id ASC';
		$sql  = $this->prepare_sql( $sql, $query_parameters );
		if ( is_wp_error( $sql ) ) {
			return $sql;
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared, bounded capacity-context query.
		$child_rows = $wpdb->get_results( $sql, ARRAY_A );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $child_rows ) ) {
			return $this->get_query_error();
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Count-only comparison detects children hidden by the current ownership boundary.
		$canonical_child_count = absint( $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}bookingtypes WHERE parent = %d", $parent_resource_id ) ) );
		if ( $canonical_child_count !== count( $child_rows ) ) {
			return new WP_Error(
				'wpbc_catalog_capacity_hierarchy_incomplete',
				__( 'This resource group contains units that are unavailable in the current account context. Its capacity cannot be changed here.', 'booking' )
			);
		}

		return $this->enrich_resources( $child_rows );
	}

	/**
	 * Find published posts containing a Booking shortcode for one Resource.
	 *
	 * SQL narrows candidates only. WordPress shortcode parsing performs the
	 * exact ID comparison so Resource 5 never matches Resource 50.
	 *
	 * @param int $resource_id Booking Resource ID.
	 *
	 * @return array<int,array{url:string,title:string}> Public page summaries.
	 */
	private function find_published_pages( $resource_id ) {
		global $wpdb;

		$resource_id = absint( $resource_id );
		if ( ! $resource_id ) {
			return array();
		}

		$booking_like = '%' . $wpdb->esc_like( '[booking' ) . '%';
		if ( 1 === $resource_id ) {
			$sql = $wpdb->prepare(
				"SELECT ID, post_content FROM {$wpdb->posts} WHERE post_status = 'publish' AND post_type IN ( 'page', 'post' ) AND post_content LIKE %s ORDER BY post_modified_gmt DESC",
				$booking_like
			);
		} else {
			$sql = $wpdb->prepare(
				"SELECT ID, post_content FROM {$wpdb->posts} WHERE post_status = 'publish' AND post_type IN ( 'page', 'post' ) AND post_content LIKE %s AND post_content LIKE %s ORDER BY post_modified_gmt DESC",
				$booking_like,
				'%' . $wpdb->esc_like( (string) $resource_id ) . '%'
			);
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared, read-only, and lazy by design.
		$candidates      = $wpdb->get_results( $sql );
		$published_pages = array();
		foreach ( is_array( $candidates ) ? $candidates : array() as $candidate ) {
			$post_id = isset( $candidate->ID ) ? absint( $candidate->ID ) : 0;
			if ( ! $post_id || ! $this->shortcode_matches_resource( (string) $candidate->post_content, $resource_id ) ) {
				continue;
			}
			$page_url = get_permalink( $post_id );
			if ( ! $page_url ) {
				continue;
			}
			// Decode numeric entities exposed after WordPress decodes a stored ampersand entity.
			$page_title       = html_entity_decode(
				wp_specialchars_decode( wp_strip_all_tags( (string) get_the_title( $post_id ) ), ENT_QUOTES ),
				ENT_QUOTES,
				get_bloginfo( 'charset' )
			);
			$published_pages[] = array(
				'url'   => esc_url_raw( $page_url ),
				'title' => '' !== $page_title ? $page_title : __( '(no title)', 'booking' ),
			);
		}

		return $published_pages;
	}

	/**
	 * Determine whether a Booking shortcode targets one Resource.
	 *
	 * @param string $shortcode_text Content containing possible shortcodes.
	 * @param int    $resource_id    Booking Resource ID.
	 *
	 * @return bool True when an exact Booking shortcode target is present.
	 */
	private function shortcode_matches_resource( $shortcode_text, $resource_id ) {
		$shortcode_pattern = get_shortcode_regex( array( 'booking' ) );
		if ( ! preg_match_all( '/' . $shortcode_pattern . '/s', (string) $shortcode_text, $shortcode_matches, PREG_SET_ORDER ) ) {
			return false;
		}

		foreach ( $shortcode_matches as $shortcode_match ) {
			$shortcode_attributes = shortcode_parse_atts( $shortcode_match[3] );
			$target_resource_id   = 1;
			if ( is_array( $shortcode_attributes ) && isset( $shortcode_attributes['resource_id'] ) ) {
				$target_resource_id = absint( $shortcode_attributes['resource_id'] );
			} elseif ( is_array( $shortcode_attributes ) && isset( $shortcode_attributes['type'] ) ) {
				$target_resource_id = absint( $shortcode_attributes['type'] );
			}
			if ( absint( $resource_id ) === $target_resource_id ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Count complete hierarchy groups for the Business Large `all` view.
	 *
	 * A top-level Resource is one pagination unit together with its authorized
	 * children. An authorized orphan is retained as its own unit, matching the
	 * established visible-Resource behavior without exposing another owner.
	 *
	 * @param array $query_values Normalized repository query.
	 *
	 * @return int|WP_Error Matching group count or a safe error.
	 */
	private function count_paid_hierarchy_groups( $query_values ) {
		global $wpdb;

		$query_parameters = array();
		$where_sql        = $this->get_paid_hierarchy_root_where_sql( $query_values, $query_parameters );
		$sql              = "SELECT COUNT(*) FROM {$wpdb->prefix}bookingtypes AS root WHERE {$where_sql}";
		$sql              = $this->prepare_sql( $sql, $query_parameters );
		if ( is_wp_error( $sql ) ) {
			return $sql;
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared read-only repository query.
		$total_groups = $wpdb->get_var( $sql );
		if ( '' !== (string) $wpdb->last_error ) {
			return $this->get_query_error();
		}

		return max( 0, (int) $total_groups );
	}

	/**
	 * Load one page of intact authorized hierarchy groups.
	 *
	 * Root IDs are paginated first. A second bounded query returns those roots
	 * and their visible children, preserving root-first grouping and applying
	 * the same allow-listed sort to roots and children independently.
	 *
	 * @param array $query_values Normalized repository query.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Enriched group rows or a safe error.
	 */
	private function get_paid_hierarchy_resources( $query_values ) {
		global $wpdb;

		$root_ids = $this->get_paid_hierarchy_root_ids( $query_values );
		if ( is_wp_error( $root_ids ) || empty( $root_ids ) ) {
			return $root_ids;
		}

		$root_placeholders = implode( ', ', array_fill( 0, count( $root_ids ), '%d' ) );
		$select_params     = array();
		$select_fields     = $this->get_paid_select_fields( $select_params );
		$query_parameters  = $select_params;
		$sql               = 'SELECT ' . implode( ', ', $select_fields )
			. " FROM {$wpdb->prefix}bookingtypes AS bt"
			. " INNER JOIN {$wpdb->prefix}bookingtypes AS root_sort"
			. " ON root_sort.booking_type_id = CASE WHEN bt.booking_type_id IN ( {$root_placeholders} ) THEN bt.booking_type_id ELSE bt.parent END";
		$query_parameters  = array_merge( $query_parameters, $root_ids );
		$sql              .= " WHERE ( bt.booking_type_id IN ( {$root_placeholders} ) OR bt.parent IN ( {$root_placeholders} ) )";
		$query_parameters  = array_merge( $query_parameters, $root_ids, $root_ids );

		$owner_user_id = $this->get_restricted_owner_user_id();
		if ( null !== $owner_user_id ) {
			$sql                .= ' AND bt.users = %d';
			$query_parameters[] = $owner_user_id;
		}

		$root_sort_params = array();
		$root_sort_sql    = $this->get_hierarchy_sort_expression( $query_values['sort_by'], 'root_sort', $root_sort_params );
		$child_sort_sql   = $this->get_sort_expression( $query_values['sort_by'], 'bt', '1' );
		$sort_direction   = 'desc' === $query_values['sort_order'] ? 'DESC' : 'ASC';
		$sql             .= " ORDER BY {$root_sort_sql} {$sort_direction}, root_sort.booking_type_id {$sort_direction},"
			. " CASE WHEN bt.booking_type_id = root_sort.booking_type_id THEN 0 ELSE 1 END ASC,"
			. " {$child_sort_sql} {$sort_direction}, bt.booking_type_id {$sort_direction}";
		$query_parameters = array_merge( $query_parameters, $root_sort_params );
		$sql              = $this->prepare_sql( $sql, $query_parameters );
		if ( is_wp_error( $sql ) ) {
			return $sql;
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared read-only repository query.
		$database_rows = $wpdb->get_results( $sql, ARRAY_A );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $database_rows ) ) {
			return $this->get_query_error();
		}

		return $this->enrich_resources( $database_rows, $root_ids, $query_values['include_publishing'] );
	}

	/**
	 * Load the sorted root IDs that define one hierarchy page.
	 *
	 * @param array $query_values Normalized repository query.
	 *
	 * @return array<int,int>|WP_Error Root IDs in display order or a safe error.
	 */
	private function get_paid_hierarchy_root_ids( $query_values ) {
		global $wpdb;

		$where_params = array();
		$where_sql    = $this->get_paid_hierarchy_root_where_sql( $query_values, $where_params );
		$sort_params  = array();
		$sort_sql     = $this->get_hierarchy_sort_expression( $query_values['sort_by'], 'root', $sort_params );
		$direction    = 'desc' === $query_values['sort_order'] ? 'DESC' : 'ASC';
		$sql          = "SELECT root.booking_type_id FROM {$wpdb->prefix}bookingtypes AS root"
			. " WHERE {$where_sql}"
			. " ORDER BY {$sort_sql} {$direction}, root.booking_type_id {$direction}"
			. ' LIMIT %d OFFSET %d';
		$query_parameters = array_merge(
			$where_params,
			$sort_params,
			array( $query_values['items_per_page'], $query_values['offset'] )
		);
		$sql = $this->prepare_sql( $sql, $query_parameters );
		if ( is_wp_error( $sql ) ) {
			return $sql;
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared read-only repository query.
		$root_ids = $wpdb->get_col( $sql );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $root_ids ) ) {
			return $this->get_query_error();
		}

		return array_values( array_filter( array_map( 'absint', $root_ids ) ) );
	}

	/**
	 * Build filters shared by hierarchy count and root-page queries.
	 *
	 * @param array $query_values     Normalized repository query.
	 * @param array $query_parameters Prepared values collected by reference.
	 *
	 * @return string Static SQL predicates containing prepared placeholders.
	 */
	private function get_paid_hierarchy_root_where_sql( $query_values, &$query_parameters ) {
		global $wpdb;

		$where_parts   = array();
		$owner_user_id = $this->get_restricted_owner_user_id();
		if ( null !== $owner_user_id ) {
			$where_parts[]      = 'root.users = %d';
			$query_parameters[] = $owner_user_id;
		}

		$parent_params = array();
		$parent_exists = $this->get_visible_parent_exists_sql( 'root', 'visible_parent', $parent_params );
		$where_parts[]  = "( root.parent = 0 OR NOT {$parent_exists} )";
		$query_parameters = array_merge( $query_parameters, $parent_params );

		if ( '' !== $query_values['search'] ) {
			$search_like  = '%' . $wpdb->esc_like( $query_values['search'] ) . '%';
			$child_params = array();
			$child_owner  = '';
			if ( null !== $owner_user_id ) {
				$child_owner   = ' AND search_child.users = %d';
				$child_params[] = $owner_user_id;
			}
			$where_parts[] = '( CAST( root.booking_type_id AS CHAR ) LIKE %s OR root.title LIKE %s'
				. " OR EXISTS ( SELECT 1 FROM {$wpdb->prefix}bookingtypes AS search_child"
				. " WHERE search_child.parent = root.booking_type_id{$child_owner}"
				. ' AND ( CAST( search_child.booking_type_id AS CHAR ) LIKE %s OR search_child.title LIKE %s ) ) )';
			$query_parameters = array_merge(
				$query_parameters,
				array( $search_like, $search_like ),
				$child_params,
				array( $search_like, $search_like )
			);
		}

		return empty( $where_parts ) ? '1 = 1' : implode( ' AND ', $where_parts );
	}

	/**
	 * Return edition-safe SELECT fields shared by flat and hierarchy reads.
	 *
	 * @param array $query_parameters Prepared values collected by reference.
	 *
	 * @return array<int,string> Static SELECT expressions.
	 */
	private function get_paid_select_fields( &$query_parameters ) {
		$child_count_field = '0 AS child_count';
		$capacity_field    = '1 AS capacity';
		$query_parameters  = array();

		if ( class_exists( 'wpdev_bk_biz_l' ) ) {
			$child_params      = array();
			$child_count_sql   = $this->get_child_count_sql( 'bt', 'capacity_child', $child_params );
			$child_count_field = "CASE WHEN bt.parent = 0 THEN {$child_count_sql} ELSE 0 END AS child_count";
			$capacity_field    = "CASE WHEN bt.parent = 0 THEN 1 + {$child_count_sql} ELSE 1 END AS capacity";
			$query_parameters  = array_merge( $child_params, $child_params );
		}

		return array(
			'bt.booking_type_id AS id',
			'bt.title AS title',
			class_exists( 'wpdev_bk_biz_s' ) ? 'bt.cost AS cost' : "'' AS cost",
			class_exists( 'wpdev_bk_biz_m' ) ? 'bt.default_form AS default_form' : "'standard' AS default_form",
			class_exists( 'wpdev_bk_biz_l' ) ? 'bt.prioritet AS priority' : '0 AS priority',
			class_exists( 'wpdev_bk_biz_l' ) ? 'bt.parent AS parent_id' : '0 AS parent_id',
			class_exists( 'wpdev_bk_multiuser' ) ? 'bt.users AS owner_user_id' : '0 AS owner_user_id',
			$child_count_field,
			$capacity_field,
		);
	}

	/**
	 * Query canonical paid Resource rows and enrich them in bounded batches.
	 *
	 * @param array $query_values Normalized repository query.
	 * @param int   $resource_id  Optional exact Resource ID.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Enriched domain records or error.
	 */
	private function get_paid_resources( $query_values, $resource_id = 0 ) {
		global $wpdb;

		$query_values     = $this->normalize_query_values( $query_values );
		$select_params    = array();
		$select_fields    = $this->get_paid_select_fields( $select_params );
		$query_parameters = $select_params;
		$where_params     = array();
		$where_sql        = $this->get_paid_where_sql( $query_values, $where_params, $resource_id );
		$query_parameters = array_merge( $query_parameters, $where_params );
		$sort_expression  = $this->get_sort_expression( $query_values['sort_by'] );
		$sort_direction   = 'desc' === $query_values['sort_order'] ? 'DESC' : 'ASC';
		$sql              = 'SELECT ' . implode( ', ', $select_fields )
			. " FROM {$wpdb->prefix}bookingtypes AS bt"
			. " WHERE {$where_sql}"
			. " ORDER BY {$sort_expression} {$sort_direction}, bt.booking_type_id {$sort_direction}"
			. ' LIMIT %d OFFSET %d';
		$query_parameters[] = $query_values['items_per_page'];
		$query_parameters[] = $query_values['offset'];
		$sql                = $this->prepare_sql( $sql, $query_parameters );
		if ( is_wp_error( $sql ) ) {
			return $sql;
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared read-only repository query.
		$database_rows = $wpdb->get_results( $sql, ARRAY_A );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $database_rows ) ) {
			return $this->get_query_error();
		}

		return $this->enrich_resources( $database_rows, array(), $query_values['include_publishing'] );
	}

	/**
	 * Build paid-edition filters with prepared values kept in SQL order.
	 *
	 * @param array $query_values    Normalized repository query.
	 * @param array $query_parameters Prepared values collected by reference.
	 * @param int   $resource_id     Optional exact Resource ID.
	 *
	 * @return string Static SQL predicates containing placeholders only for collected values.
	 */
	private function get_paid_where_sql( $query_values, &$query_parameters, $resource_id = 0 ) {
		global $wpdb;

		$where_parts   = array( '1 = 1' );
		$owner_user_id = $this->get_restricted_owner_user_id();
		if ( null !== $owner_user_id ) {
			$where_parts[]     = 'bt.users = %d';
			$query_parameters[] = $owner_user_id;
		}

		if ( $resource_id ) {
			$where_parts[]      = 'bt.booking_type_id = %d';
			$query_parameters[] = absint( $resource_id );
		}

		if ( class_exists( 'wpdev_bk_biz_l' ) ) {
			if ( in_array( $query_values['resource_type'], array( 'single', 'parent' ), true ) ) {
				$type_params     = array();
				$child_count_sql = $this->get_child_count_sql( 'bt', 'type_child', $type_params );
				$where_parts[]    = 'bt.parent = 0';
				$where_parts[]    = 'parent' === $query_values['resource_type'] ? "{$child_count_sql} > 0" : "{$child_count_sql} = 0";
				$query_parameters = array_merge( $query_parameters, $type_params );
			} elseif ( 'child' === $query_values['resource_type'] ) {
				$where_parts[] = 'bt.parent > 0';
			}
		} elseif ( in_array( $query_values['resource_type'], array( 'parent', 'child' ), true ) ) {
			$where_parts[] = '1 = 0';
		}

		if ( '' !== $query_values['search'] ) {
			$search_like        = '%' . $wpdb->esc_like( $query_values['search'] ) . '%';
			$where_parts[]      = '( CAST( bt.booking_type_id AS CHAR ) LIKE %s OR bt.title LIKE %s )';
			$query_parameters[] = $search_like;
			$query_parameters[] = $search_like;
		}

		return implode( ' AND ', $where_parts );
	}

	/**
	 * Return a correlated authorized child count expression.
	 *
	 * @param string $parent_alias      Fixed parent SQL alias.
	 * @param string $child_alias       Fixed child SQL alias.
	 * @param array  $query_parameters Prepared values collected by reference.
	 *
	 * @return string Static correlated SQL expression.
	 */
	private function get_child_count_sql( $parent_alias, $child_alias, &$query_parameters ) {
		global $wpdb;

		if ( ! class_exists( 'wpdev_bk_biz_l' ) ) {
			return '0';
		}

		$parent_alias = in_array( $parent_alias, array( 'bt', 'root', 'root_sort' ), true ) ? $parent_alias : 'bt';
		$child_aliases = array( 'capacity_child', 'type_child', 'root_sort_child' );
		$child_alias   = in_array( $child_alias, $child_aliases, true ) ? $child_alias : 'capacity_child';
		$owner_sql     = '';
		$owner_user_id = $this->get_restricted_owner_user_id();
		if ( null !== $owner_user_id ) {
			$owner_sql          = " AND {$child_alias}.users = %d";
			$query_parameters[] = $owner_user_id;
		}

		return "( SELECT COUNT(*) FROM {$wpdb->prefix}bookingtypes AS {$child_alias} WHERE {$child_alias}.parent = {$parent_alias}.booking_type_id{$owner_sql} )";
	}

	/**
	 * Return a correlated visible-parent existence expression.
	 *
	 * @param string $resource_alias    Fixed Resource SQL alias.
	 * @param string $parent_alias      Fixed parent SQL alias.
	 * @param array  $query_parameters Prepared values collected by reference.
	 *
	 * @return string Static correlated SQL expression.
	 */
	private function get_visible_parent_exists_sql( $resource_alias, $parent_alias, &$query_parameters ) {
		global $wpdb;

		$resource_alias = 'root' === $resource_alias ? 'root' : 'bt';
		$parent_alias   = 'visible_parent';
		$owner_sql      = '';
		$owner_user_id = $this->get_restricted_owner_user_id();
		if ( null !== $owner_user_id ) {
			$owner_sql          = " AND {$parent_alias}.users = %d";
			$query_parameters[] = $owner_user_id;
		}

		return "EXISTS ( SELECT 1 FROM {$wpdb->prefix}bookingtypes AS {$parent_alias} WHERE {$parent_alias}.booking_type_id = {$resource_alias}.parent{$owner_sql} )";
	}

	/**
	 * Resolve a hierarchy-root sort expression, including derived capacity.
	 *
	 * @param string $sort_by          Validated public sort key.
	 * @param string $root_alias       Fixed root table alias.
	 * @param array  $query_parameters Prepared values collected by reference.
	 *
	 * @return string Safe SQL expression.
	 */
	private function get_hierarchy_sort_expression( $sort_by, $root_alias, &$query_parameters ) {
		$root_alias = in_array( $root_alias, array( 'root', 'root_sort' ), true ) ? $root_alias : 'root';
		if ( 'capacity' !== $sort_by ) {
			return $this->get_sort_expression( $sort_by, $root_alias );
		}

		$child_count_sql = $this->get_child_count_sql( $root_alias, 'root_sort_child', $query_parameters );
		$capacity_sql    = "CASE WHEN {$root_alias}.parent = 0 THEN 1 + {$child_count_sql} ELSE 1 END";

		return $this->get_sort_expression( $sort_by, $root_alias, $capacity_sql );
	}

	/**
	 * Resolve an allow-listed public sort key to a static SQL expression.
	 *
	 * @param string $sort_by             Validated public sort key.
	 * @param string $table_alias         Fixed Resource table alias.
	 * @param string $capacity_expression Safe derived-capacity expression.
	 *
	 * @return string Safe SQL expression.
	 */
	private function get_sort_expression( $sort_by, $table_alias = 'bt', $capacity_expression = 'capacity' ) {
		$table_alias = in_array( $table_alias, array( 'bt', 'root', 'root_sort' ), true ) ? $table_alias : 'bt';
		$sort_expressions = array(
			'id'       => "{$table_alias}.booking_type_id",
			'title'    => "{$table_alias}.title",
			'priority' => class_exists( 'wpdev_bk_biz_l' ) ? "{$table_alias}.prioritet" : "{$table_alias}.booking_type_id",
			'capacity' => class_exists( 'wpdev_bk_biz_l' ) ? $capacity_expression : "{$table_alias}.booking_type_id",
			'cost'     => class_exists( 'wpdev_bk_biz_s' ) ? "CAST( {$table_alias}.cost AS DECIMAL(20,4) )" : "{$table_alias}.booking_type_id",
		);
		$sort_by = sanitize_key( (string) $sort_by );

		return isset( $sort_expressions[ $sort_by ] ) ? $sort_expressions[ $sort_by ] : $sort_expressions['title'];
	}

	/**
	 * Apply content and pricing enrichment without per-row database queries.
	 *
	 * @param array $database_rows      Canonical database rows.
	 * @param array $group_root_ids     IDs that consume pagination units; all rows when omitted.
	 * @param bool  $include_publishing Whether canonical shortcode metadata is needed for this response.
	 *
	 * @return array<int,array<string,mixed>> Enriched domain records.
	 */
	private function enrich_resources( $database_rows, $group_root_ids = array(), $include_publishing = false ) {
		$resource_ids          = array();
		$resource_titles       = array();
		$has_grouped_hierarchy = ! empty( $group_root_ids );
		foreach ( $database_rows as $database_row ) {
			if ( ! empty( $database_row['id'] ) ) {
				$resource_id                     = absint( $database_row['id'] );
				$resource_ids[]                  = $resource_id;
				$resource_titles[ $resource_id ] = wp_strip_all_tags( wpbc_lang( (string) $database_row['title'] ) );
			}
		}

		$group_root_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $group_root_ids ) ) ) );
		$group_root_map = array_fill_keys( $group_root_ids, true );
		if ( empty( $group_root_ids ) ) {
			$group_root_ids = $resource_ids;
		}
		$visible_child_counts = array_fill_keys( $group_root_ids, 0 );
		$child_ids_by_parent  = array();
		$child_positions      = array();
		$parent_ids           = array();
		foreach ( $database_rows as $database_row ) {
			$resource_id = isset( $database_row['id'] ) ? absint( $database_row['id'] ) : 0;
			$parent_id   = isset( $database_row['parent_id'] ) ? absint( $database_row['parent_id'] ) : 0;
			if ( $has_grouped_hierarchy && isset( $group_root_map[ $resource_id ] ) ) {
				$parent_id = 0;
			}
			if ( $parent_id && isset( $visible_child_counts[ $parent_id ] ) ) {
				++$visible_child_counts[ $parent_id ];
			}
			if ( $parent_id ) {
				$parent_ids[]                         = $parent_id;
				$child_ids_by_parent[ $parent_id ][] = $resource_id;
				$child_positions[ $resource_id ]      = count( $child_ids_by_parent[ $parent_id ] );
			}
		}
		$parent_titles = $this->get_parent_titles( $parent_ids, $resource_titles );

		$stored_content        = $this->get_stored_content( $resource_ids );
		$legacy_content        = $this->get_legacy_search_content();
		$owner_names           = $this->get_owner_display_names( $database_rows );
		$publishing_shortcodes = $include_publishing ? $this->get_publishing_shortcodes( $resource_ids ) : array();
		$resources             = array();

		foreach ( $database_rows as $database_row ) {
			$resource_id    = absint( $database_row['id'] );
			$stored          = isset( $stored_content[ $resource_id ] ) ? $stored_content[ $resource_id ] : array();
			$legacy          = isset( $legacy_content[ $resource_id ] ) && is_array( $legacy_content[ $resource_id ] ) ? $legacy_content[ $resource_id ] : array();
			$description     = array_key_exists( 'description', $stored ) ? (string) $stored['description'] : ( isset( $legacy['description'] ) ? (string) $legacy['description'] : '' );
			$picture_url     = array_key_exists( 'picture_url', $stored ) ? (string) $stored['picture_url'] : ( isset( $legacy['picture'] ) ? (string) $legacy['picture'] : '' );
			$parent_id       = max( 0, absint( $database_row['parent_id'] ) );
			if ( $has_grouped_hierarchy && isset( $group_root_map[ $resource_id ] ) ) {
				$parent_id = 0;
			}
			$child_count     = max( 0, absint( $database_row['child_count'] ) );
			$visible_child_count = isset( $visible_child_counts[ $resource_id ] ) ? absint( $visible_child_counts[ $resource_id ] ) : 0;
			$resource_type   = 0 < $parent_id ? 'child' : ( 0 < $visible_child_count || 0 < $child_count ? 'parent' : 'single' );
			$child_position  = isset( $child_positions[ $resource_id ] ) ? absint( $child_positions[ $resource_id ] ) : 0;
			$cost            = class_exists( 'wpdev_bk_biz_s' ) ? (string) $database_row['cost'] : '';
			$price_period    = class_exists( 'wpdev_bk_biz_s' ) && function_exists( 'wpbc_get_cost_per_period_for_user' )
				? sanitize_key( (string) wpbc_get_cost_per_period_for_user( $resource_id ) )
				: '';
			$price_presentation   = $this->get_price_presentation( $cost, $resource_id );
			$publishing_shortcode = isset( $publishing_shortcodes[ $resource_id ] )
				? $publishing_shortcodes[ $resource_id ]
				: '[booking resource_id=' . $resource_id . ']';

			$resources[] = array(
				'id'             => $resource_id,
				'title'          => wp_strip_all_tags( wpbc_lang( (string) $database_row['title'] ) ),
				'description'    => wp_strip_all_tags( wpbc_lang( $description ) ),
				'picture_url'    => esc_url_raw( wpbc_lang( $picture_url ) ),
				'attachment_id'  => isset( $stored['attachment_id'] ) ? absint( $stored['attachment_id'] ) : 0,
				'parent_id'      => $parent_id,
				'parent_title'   => $parent_id && isset( $parent_titles[ $parent_id ] ) ? $parent_titles[ $parent_id ] : '',
				'resource_type'  => $resource_type,
				'capacity'       => max( 1, absint( $database_row['capacity'] ) ),
				'child_count'    => $child_count,
				'visible_child_count' => $visible_child_count,
				'child_position' => $child_position,
				'is_last_child'  => $parent_id && $child_position === count( $child_ids_by_parent[ $parent_id ] ),
				'is_group_root'  => in_array( $resource_id, $group_root_ids, true ),
				'cost'           => $cost,
				'price_display'  => $price_presentation['display'],
				'price_major'    => $price_presentation['major'],
				'price_fraction' => $price_presentation['fraction'],
				'price_suffix'   => $price_presentation['suffix'],
				'price_period'   => $price_period,
				'publishing_shortcode' => $publishing_shortcode,
				'default_form'   => class_exists( 'wpdev_bk_biz_m' ) ? sanitize_text_field( (string) $database_row['default_form'] ) : 'standard',
				'owner_user_id'  => class_exists( 'wpdev_bk_multiuser' ) ? absint( $database_row['owner_user_id'] ) : 0,
				'owner_display_name' => isset( $owner_names[ absint( $database_row['owner_user_id'] ) ] )
					? $owner_names[ absint( $database_row['owner_user_id'] ) ]
					: '',
				'priority'       => class_exists( 'wpdev_bk_biz_l' ) ? max( 0, (int) $database_row['priority'] ) : 0,
			);
		}

		return $resources;
	}

	/**
	 * Resolve authorized parent titles for child DTO relationship metadata.
	 *
	 * Titles already present in the current bounded result are reused. Missing
	 * parents are loaded in one prepared query so flat child filters remain free
	 * of per-row queries and never expose a parent owned by another user.
	 *
	 * @param array $parent_ids      Canonical parent Resource IDs.
	 * @param array $resource_titles Titles already loaded in the current result.
	 *
	 * @return array<int,string> Sanitized parent titles keyed by Resource ID.
	 */
	private function get_parent_titles( $parent_ids, $resource_titles ) {
		global $wpdb;

		$parent_ids  = array_values( array_unique( array_filter( array_map( 'absint', (array) $parent_ids ) ) ) );
		$titles      = array_intersect_key( (array) $resource_titles, array_fill_keys( $parent_ids, true ) );
		$missing_ids = array_values( array_diff( $parent_ids, array_keys( $titles ) ) );
		if ( ! class_exists( 'wpdev_bk_personal' ) || empty( $missing_ids ) ) {
			return $titles;
		}

		$placeholders     = implode( ', ', array_fill( 0, count( $missing_ids ), '%d' ) );
		$query_parameters = $missing_ids;
		$sql              = "SELECT booking_type_id, title FROM {$wpdb->prefix}bookingtypes WHERE booking_type_id IN ( {$placeholders} )";
		$owner_user_id    = $this->get_restricted_owner_user_id();
		if ( null !== $owner_user_id ) {
			$sql                .= ' AND users = %d';
			$query_parameters[] = $owner_user_id;
		}
		$sql = $this->prepare_sql( $sql, $query_parameters );
		if ( is_wp_error( $sql ) ) {
			return $titles;
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared bounded relationship lookup.
		$parent_rows = $wpdb->get_results( $sql, ARRAY_A );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $parent_rows ) ) {
			return $titles;
		}
		foreach ( $parent_rows as $parent_row ) {
			$parent_id = isset( $parent_row['booking_type_id'] ) ? absint( $parent_row['booking_type_id'] ) : 0;
			if ( $parent_id ) {
				$titles[ $parent_id ] = wp_strip_all_tags( wpbc_lang( (string) $parent_row['title'] ) );
			}
		}

		return $titles;
	}

	/**
	 * Format one Resource price through the canonical Payment Setup options.
	 *
	 * The plain full value remains authoritative and accessible. Fractional
	 * digits are split only when the configured decimal separator can be located
	 * safely, allowing the template to reduce their visual emphasis without
	 * reconstructing currency position, spacing, or separators in JavaScript.
	 *
	 * @param string $cost        Canonical Resource cost.
	 * @param int    $resource_id Booking Resource ID used for MultiUser settings.
	 *
	 * @return array{display:string,major:string,fraction:string,suffix:string} Plain price presentation.
	 */
	private function get_price_presentation( $cost, $resource_id ) {
		$empty_price = array(
			'display'  => '',
			'major'    => '',
			'fraction' => '',
			'suffix'   => '',
		);
		if ( ! class_exists( 'wpdev_bk_biz_s' ) || '' === $cost || ! function_exists( 'wpbc_get_cost_with_currency_for_user' ) ) {
			return $empty_price;
		}

		$formatted_cost = wpbc_get_cost_with_currency_for_user( $cost, $resource_id );
		$price_display  = html_entity_decode( wp_strip_all_tags( (string) $formatted_cost ), ENT_QUOTES, 'UTF-8' );
		$price_display  = trim( $price_display );
		if ( '' === $price_display ) {
			return $empty_price;
		}

		$decimal_count     = 0;
		$decimal_separator = '';
		$previous_user     = -1;
		if ( $resource_id && function_exists( 'apply_bk_filter' ) ) {
			$previous_user = apply_bk_filter( 'wpbc_mu_set_environment_for_owner_of_resource', -1, $resource_id );
		}
		if ( function_exists( 'wpbc_get_cost_decimals' ) ) {
			$decimal_count = min( 8, absint( wpbc_get_cost_decimals() ) );
		}
		if ( function_exists( 'wpbc_get_cost_decimal_separator' ) ) {
			$decimal_separator = (string) wpbc_get_cost_decimal_separator();
		}
		if ( $resource_id && function_exists( 'make_bk_action' ) ) {
			make_bk_action( 'wpbc_mu_set_environment_for_user', $previous_user );
		}

		$price_presentation = array(
			'display'  => $price_display,
			'major'    => $price_display,
			'fraction' => '',
			'suffix'   => '',
		);
		if ( 0 === $decimal_count || '' === $decimal_separator ) {
			return $price_presentation;
		}

		$separator_position = strrpos( $price_display, $decimal_separator );
		if ( false === $separator_position ) {
			return $price_presentation;
		}
		$fraction_length = strlen( $decimal_separator ) + $decimal_count;
		$fraction_value  = substr( $price_display, $separator_position, $fraction_length );
		$fraction_digits = substr( $fraction_value, strlen( $decimal_separator ) );
		if ( strlen( $fraction_digits ) !== $decimal_count || ! preg_match( '/^\d+$/', $fraction_digits ) ) {
			return $price_presentation;
		}

		$price_presentation['major']    = substr( $price_display, 0, $separator_position );
		$price_presentation['suffix']   = substr( $price_display, $separator_position + $fraction_length );
		if ( preg_match( '/^0+$/', $fraction_digits ) ) {
			$price_presentation['display'] = $price_presentation['major'] . $price_presentation['suffix'];

			return $price_presentation;
		}
		$price_presentation['fraction'] = $fraction_value;

		return $price_presentation;
	}

	/**
	 * Load canonical publishing shortcodes for one visible Resource page.
	 *
	 * This bounded prepared query replaces the old catalog's per-resource
	 * metadata calls. Missing metadata intentionally falls back in the DTO layer
	 * to the conventional `[booking resource_id=ID]` shortcode.
	 *
	 * @param array $resource_ids Positive authorized Resource IDs.
	 *
	 * @return array<int,string> Sanitized shortcodes keyed by Resource ID.
	 */
	public function get_publishing_shortcodes( $resource_ids ) {
		global $wpdb;

		$resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $resource_ids ) ) ) );
		if ( ! class_exists( 'wpdev_bk_personal' ) || empty( $resource_ids ) ) {
			return array();
		}

		$placeholders   = implode( ', ', array_fill( 0, count( $resource_ids ), '%d' ) );
		$sql_parameters = array_merge( array( 'shortcode_default' ), $resource_ids );
		$sql            = "SELECT type_id, meta_value FROM {$wpdb->prefix}booking_types_meta"
			. " WHERE meta_key = %s AND type_id IN ( {$placeholders} ) ORDER BY meta_id ASC";
		$sql = $this->prepare_sql( $sql, $sql_parameters );
		if ( is_wp_error( $sql ) ) {
			return array();
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared bounded metadata lookup.
		$metadata_rows = $wpdb->get_results( $sql, ARRAY_A );
		$shortcodes    = array();
		foreach ( is_array( $metadata_rows ) ? $metadata_rows : array() as $metadata_row ) {
			$resource_id      = isset( $metadata_row['type_id'] ) ? absint( $metadata_row['type_id'] ) : 0;
			$stored_shortcode = isset( $metadata_row['meta_value'] ) ? maybe_unserialize( $metadata_row['meta_value'] ) : '';
			$shortcode        = is_scalar( $stored_shortcode ) ? trim( wp_strip_all_tags( (string) $stored_shortcode ) ) : '';
			if ( $resource_id && '' !== $shortcode && ! isset( $shortcodes[ $resource_id ] ) ) {
				$shortcodes[ $resource_id ] = $shortcode;
			}
		}

		return $shortcodes;
	}

	/**
	 * Resolve owner display names through WordPress user objects already backed by cache.
	 *
	 * @param array $database_rows Authorized repository rows.
	 *
	 * @return array<int,string> Sanitized display names keyed by owner user ID.
	 */
	private function get_owner_display_names( $database_rows ) {
		$owner_names = array();

		if (
			! class_exists( 'wpdev_bk_multiuser' )
			|| ! (bool) apply_bk_filter( 'multiuser_is_user_can_be_here', true, 'only_super_admin' )
		) {
			return $owner_names;
		}

		foreach ( $database_rows as $database_row ) {
			$owner_user_id = isset( $database_row['owner_user_id'] ) ? absint( $database_row['owner_user_id'] ) : 0;
			if ( ! $owner_user_id || isset( $owner_names[ $owner_user_id ] ) ) {
				continue;
			}

			$owner_user = get_userdata( $owner_user_id );
			$owner_names[ $owner_user_id ] = $owner_user && isset( $owner_user->display_name )
				? sanitize_text_field( (string) $owner_user->display_name )
				: '';
		}

		return $owner_names;
	}

	/**
	 * Read the canonical legacy Search Availability option without catalog APIs.
	 *
	 * This compatibility fallback is needed only until a photo or description is
	 * saved in edition-neutral Resource content. The core option wrapper retains
	 * established MultiUser option filtering while keeping this repository
	 * independent from both Resources catalog implementations.
	 *
	 * @return array<int,array<string,mixed>> Legacy content keyed by Resource ID.
	 */
	private function get_legacy_search_content() {
		if ( ! class_exists( 'wpdev_bk_biz_l' ) ) {
			return array();
		}

		$stored_options = function_exists( 'get_bk_option' )
			? get_bk_option( 'booking_resources_search_options', array() )
			: get_option( 'booking_resources_search_options', array() );
		$stored_options = maybe_unserialize( $stored_options );

		return is_array( $stored_options ) ? $stored_options : array();
	}

	/**
	 * Load page presentation options in one prepared query.
	 *
	 * @param array $resource_ids Positive Resource IDs.
	 *
	 * @return array<int,array<string,mixed>> Stored content keyed by Resource ID.
	 */
	private function get_stored_content( $resource_ids ) {
		global $wpdb;

		$resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $resource_ids ) ) ) );
		if ( empty( $resource_ids ) ) {
			return array();
		}

		$option_names = array_map(
			static function ( $resource_id ) {
				return self::CONTENT_OPTION_PREFIX . $resource_id;
			},
			$resource_ids
		);
		$placeholders = implode( ', ', array_fill( 0, count( $option_names ), '%s' ) );
		$sql          = "SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name IN ( {$placeholders} )";
		$sql          = $wpdb->prepare( $sql, $option_names ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Placeholder count is derived from integer-normalized IDs.

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared bounded option lookup avoids N+1 reads.
		$option_rows = $wpdb->get_results( $sql, ARRAY_A );
		$content     = array();
		foreach ( is_array( $option_rows ) ? $option_rows : array() as $option_row ) {
			$resource_id = absint( substr( (string) $option_row['option_name'], strlen( self::CONTENT_OPTION_PREFIX ) ) );
			$option_value = maybe_unserialize( $option_row['option_value'] );
			if ( $resource_id && is_array( $option_value ) ) {
				$content[ $resource_id ] = $option_value;
			}
		}

		return $content;
	}

	/**
	 * Build the implicit Free Resource from canonical cross-edition storage.
	 *
	 * The bundled Resource image is used only until a picture value has been
	 * explicitly stored. This preserves an administrator's deliberate choice to
	 * remove the default image.
	 *
	 * @return array<string,mixed> Free Resource domain record.
	 */
	private function get_free_resource() {
		$stored      = get_option( self::CONTENT_OPTION_PREFIX . '1', array() );
		$stored      = is_array( $stored ) ? $stored : array();
		$title       = isset( $stored['title'] ) ? wp_strip_all_tags( wpbc_lang( (string) $stored['title'] ) ) : '';
		$description = array_key_exists( 'description', $stored )
			? wp_strip_all_tags( wpbc_lang( (string) $stored['description'] ) )
			: __( 'A unique calendar for any item that can be booked.', 'booking' );
		$picture_url = array_key_exists( 'picture_url', $stored )
			? esc_url_raw( wpbc_lang( (string) $stored['picture_url'] ) )
			: wpbc_get_starter_asset_url( 'img/resources/booking-resource.jpg' );

		return array(
			'id'             => 1,
			'title'          => '' !== $title ? $title : __( 'Default Resource', 'booking' ),
			'description'    => $description,
			'picture_url'    => $picture_url,
			'attachment_id'  => isset( $stored['attachment_id'] ) ? absint( $stored['attachment_id'] ) : 0,
			'parent_id'      => 0,
			'resource_type'  => 'single',
			'capacity'       => 1,
			'child_count'    => 0,
			'visible_child_count' => 0,
			'is_group_root'  => true,
			'cost'           => '',
			'price_display'  => '',
			'price_major'    => '',
			'price_fraction' => '',
			'price_suffix'   => '',
			'price_period'   => '',
			'publishing_shortcode' => '[booking resource_id=1]',
			'default_form'   => 'standard',
			'owner_user_id'  => 0,
			'priority'       => 0,
		);
	}

	/**
	 * Determine whether the implicit Free Resource matches validated filters.
	 *
	 * @param array $resource     Free Resource domain record.
	 * @param array $query_values Normalized repository query.
	 *
	 * @return bool True when the Resource belongs in the result.
	 */
	private function free_resource_matches( $resource, $query_values ) {
		if ( ! in_array( $query_values['resource_type'], array( 'all', 'single' ), true ) ) {
			return false;
		}
		if ( '' === $query_values['search'] ) {
			return true;
		}

		return false !== stripos( absint( $resource['id'] ) . ' ' . (string) $resource['title'], $query_values['search'] );
	}

	/**
	 * Return the owner ID required in MultiUser queries, or null for unrestricted viewers.
	 *
	 * @return int|null Current Booking Calendar owner ID or null for a super administrator/non-MultiUser edition.
	 */
	private function get_restricted_owner_user_id() {
		if ( ! class_exists( 'wpdev_bk_multiuser' ) ) {
			return null;
		}

		$current_user = function_exists( 'wpbc_mu__wp_get_current_user' ) ? wpbc_mu__wp_get_current_user() : wp_get_current_user();
		$current_user_id = is_object( $current_user ) && isset( $current_user->ID ) ? absint( $current_user->ID ) : 0;
		$is_super_admin  = $current_user_id && (bool) apply_bk_filter( 'is_user_super_admin', $current_user_id );

		return $is_super_admin ? null : $current_user_id;
	}

	/**
	 * Normalize trusted provider values before composing repository queries.
	 *
	 * @param mixed $query_values Provider query values.
	 *
	 * @return array<string,mixed> Bounded repository query.
	 */
	private function normalize_query_values( $query_values ) {
		$query_values = is_array( $query_values ) ? $query_values : array();
		$page_number  = isset( $query_values['page_number'] ) ? max( 1, absint( $query_values['page_number'] ) ) : 1;
		$page_size    = isset( $query_values['items_per_page'] ) ? max( 1, min( 100, absint( $query_values['items_per_page'] ) ) ) : 10;
		$sort_by      = isset( $query_values['sort_by'] ) ? sanitize_key( (string) $query_values['sort_by'] ) : 'title';
		$sort_order   = isset( $query_values['sort_order'] ) && 'desc' === strtolower( (string) $query_values['sort_order'] ) ? 'desc' : 'asc';
		$search       = isset( $query_values['search'] ) && is_scalar( $query_values['search'] ) ? sanitize_text_field( (string) $query_values['search'] ) : '';
		$resource_type = isset( $query_values['resource_type'] ) ? sanitize_key( (string) $query_values['resource_type'] ) : 'all';
		$include_publishing = ! empty( $query_values['include_publishing'] );

		if ( ! in_array( $sort_by, array( 'id', 'title', 'priority', 'capacity', 'cost' ), true ) ) {
			$sort_by = 'title';
		}
		if ( ! in_array( $resource_type, array( 'all', 'single', 'parent', 'child' ), true ) ) {
			$resource_type = 'all';
		}

		return array(
			'page_number'    => $page_number,
			'items_per_page' => $page_size,
			'offset'         => ( $page_number - 1 ) * $page_size,
			'sort_by'        => $sort_by,
			'sort_order'     => $sort_order,
			'search'         => $search,
			'resource_type'  => $resource_type,
			'include_publishing' => $include_publishing,
		);
	}

	/**
	 * Prepare a SQL statement or return a safe error when preparation fails.
	 *
	 * @param string $sql              SQL containing only repository-declared structure.
	 * @param array  $query_parameters Dynamic values matching SQL placeholders.
	 *
	 * @return string|WP_Error Prepared SQL or safe error.
	 */
	private function prepare_sql( $sql, $query_parameters ) {
		global $wpdb;

		if ( empty( $query_parameters ) ) {
			return $sql;
		}

		$prepared_sql = $wpdb->prepare( $sql, $query_parameters ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- SQL structure and placeholders are repository-owned.

		return is_string( $prepared_sql ) && '' !== $prepared_sql ? $prepared_sql : $this->get_query_error();
	}

	/**
	 * Create a non-sensitive repository query error.
	 *
	 * @return WP_Error Safe repository error.
	 */
	private function get_query_error() {
		return new WP_Error(
			'wpbc_catalog_booking_resources_query_failed',
			__( 'Booking Resources could not be loaded. Please refresh the page and try again.', 'booking' )
		);
	}
}
