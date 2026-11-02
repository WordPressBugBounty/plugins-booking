<?php
/**
 * Authorized Booking Resource repository for the Timeline.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Load the server-authorized Resource universe in bounded batches.
 */
final class WPBC_Timeline_Resource_Repository {

	/**
	 * Cross-edition Resource presentation option prefix.
	 *
	 * @var string
	 */
	const CONTENT_OPTION_PREFIX = 'wpbc_booking_resource_content_';

	/**
	 * Load one searchable, vertically paged Resource list.
	 *
	 * MultiUser ownership is applied in SQL. Browser values can choose only the
	 * page and search term; they cannot supply an owner or site identifier.
	 *
	 * @param array<string,mixed> $query_values Validated Resource query.
	 *
	 * @return array<string,mixed>|WP_Error Resource records and pagination.
	 */
	public function get_resource_page( $query_values ) {
		$query_values = is_array( $query_values ) ? $query_values : array();
		$query_values['sort_order'] = $this->normalize_sort_order(
			isset( $query_values['sort_order'] ) ? $query_values['sort_order'] : WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_STANDARD
		);

		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			$resource = $this->get_free_resource();
			$matches  = '' === $query_values['search'] || false !== stripos( '1 ' . $resource['title'], $query_values['search'] );
			$rows     = $matches && 0 === absint( $query_values['offset'] ) ? array( $resource ) : array();

			return array(
				'resources' => $rows,
				'pagination' => array(
					'page'        => absint( $query_values['page'] ),
					'per_page'    => absint( $query_values['per_page'] ),
					'total_items' => $matches ? 1 : 0,
					'total_pages' => $matches ? 1 : 0,
				),
			);
		}

		$is_hierarchy_page = class_exists( 'wpdev_bk_biz_l' );
		$rows              = $is_hierarchy_page
			? $this->query_paid_hierarchy_resources( $query_values )
			: $this->query_paid_resources( $query_values );
		if ( is_wp_error( $rows ) ) {
			return $rows;
		}
		$maximum_resources = absint( wpbc_timeline_get_configuration()['limits']['maximum_resources'] );
		if ( count( $rows ) > $maximum_resources ) {
			return new WP_Error(
				'wpbc_timeline_resource_budget_exceeded',
				__( 'This Timeline Resource page contains too many parent and child rows. Choose fewer Resource groups.', 'booking' ),
				array(
					'maximum_resources'   => $maximum_resources,
					'suggested_resources' => absint( wpbc_timeline_get_configuration()['limits']['default_resources'] ),
				)
			);
		}

		$total_items = $is_hierarchy_page
			? $this->count_paid_hierarchy_groups( $query_values['search'] )
			: $this->count_paid_resources( $query_values['search'] );
		if ( is_wp_error( $total_items ) ) {
			return $total_items;
		}

		return array(
			'resources'  => $this->map_resources( $rows ),
			'pagination' => array(
				'page'        => absint( $query_values['page'] ),
				'per_page'    => absint( $query_values['per_page'] ),
				'total_items' => $total_items,
				'total_pages' => $total_items ? (int) ceil( $total_items / max( 1, absint( $query_values['per_page'] ) ) ) : 0,
				'unit'        => $is_hierarchy_page ? 'resource_group' : 'resource',
			),
		);
	}

	/**
	 * Reload exact Resource IDs through the same ownership boundary.
	 *
	 * Missing and foreign-owner IDs are omitted so consumers can return uniform
	 * not-found behavior without disclosing whether a Resource exists.
	 *
	 * @param array<int,int> $resource_ids Candidate Resource IDs.
	 * @param string         $sort_order   Allow-listed Resource sort value.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Authorized Resource records.
	 */
	public function get_authorized_resources_by_ids( $resource_ids, $sort_order = WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_STANDARD ) {
		global $wpdb;

		$resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $resource_ids ) ) ) );
		$sort_order   = $this->normalize_sort_order( $sort_order );
		if ( empty( $resource_ids ) ) {
			return array();
		}

		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			return in_array( 1, $resource_ids, true ) ? array( $this->get_free_resource() ) : array();
		}

		$placeholders     = implode( ', ', array_fill( 0, count( $resource_ids ), '%d' ) );
		$query_parameters = $resource_ids;
		$sql              = 'SELECT ' . implode( ', ', $this->get_select_fields() )
			. " FROM {$wpdb->prefix}bookingtypes AS bt";
		if ( class_exists( 'wpdev_bk_biz_l' ) ) {
			$sql .= " LEFT JOIN {$wpdb->prefix}bookingtypes AS root_sort"
				. ' ON root_sort.booking_type_id = CASE WHEN bt.parent = 0 THEN bt.booking_type_id ELSE bt.parent END';
		}
		$sql          .= " WHERE bt.booking_type_id IN ( {$placeholders} )";
		$owner_user_id = $this->get_restricted_owner_user_id();
		if ( null !== $owner_user_id ) {
			$sql               .= ' AND bt.users = %d';
			$query_parameters[] = $owner_user_id;
		}
		if ( class_exists( 'wpdev_bk_biz_l' ) ) {
			$root_sort_sql = $this->get_exact_group_sort_sql( $sort_order );
			$child_sort_sql = $this->get_sort_sql( $sort_order, 'bt', true );
			$sql .= " ORDER BY {$root_sort_sql},"
				. ' CASE WHEN bt.parent = 0 THEN 0 ELSE 1 END ASC,'
				. " {$child_sort_sql}";
		} else {
			$sql .= ' ORDER BY ' . $this->get_sort_sql( $sort_order, 'bt', false );
		}
		$sql  = $wpdb->prepare( $sql, $query_parameters ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- SQL structure and placeholder count are repository-owned.

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared bounded repository read.
		$rows = $wpdb->get_results( $sql, ARRAY_A );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $rows ) ) {
			return $this->get_query_error();
		}

		return $this->map_resources( $rows );
	}

	/**
	 * Load a bounded authorized Resource-ID universe without presentation rows.
	 *
	 * This read exists for converting the persisted `all` selection expression
	 * into an exact explicit draft after one Resource is unchecked. It must not
	 * use group-paged presentation reads because one Business Large root may
	 * expand to several child rows and legitimately exceed the display budget.
	 *
	 * @param int $maximum_ids Maximum IDs to return, including an overflow sentinel.
	 *
	 * @return array<int,int>|WP_Error Authorized Resource IDs or a safe query error.
	 */
	public function get_authorized_resource_ids( $maximum_ids ) {
		global $wpdb;

		$maximum_ids = max( 1, absint( $maximum_ids ) );
		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			return array( 1 );
		}

		$query_parameters = array();
		$where_sql        = $this->get_where_sql( '', $query_parameters );
		$sql              = "SELECT bt.booking_type_id FROM {$wpdb->prefix}bookingtypes AS bt WHERE {$where_sql}"
			. ' ORDER BY bt.booking_type_id ASC LIMIT %d';
		$query_parameters[] = $maximum_ids;
		$sql                = $wpdb->prepare( $sql, $query_parameters ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Repository-owned predicates and limit.

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- One prepared bounded ID-only read avoids presentation-row and N+1 work.
		$resource_ids = $wpdb->get_col( $sql );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $resource_ids ) ) {
			return $this->get_query_error();
		}

		return array_values( array_filter( array_map( 'absint', $resource_ids ) ) );
	}

	/**
	 * Return the current MultiUser owner restriction.
	 *
	 * @return int|null Owner ID, or null for unrestricted/non-MultiUser reads.
	 */
	public function get_restricted_owner_user_id() {
		if ( ! class_exists( 'wpdev_bk_multiuser' ) ) {
			return null;
		}

		$current_user    = function_exists( 'wpbc_mu__wp_get_current_user' ) ? wpbc_mu__wp_get_current_user() : wp_get_current_user();
		$current_user_id = is_object( $current_user ) && isset( $current_user->ID ) ? absint( $current_user->ID ) : 0;
		$is_super_admin  = $current_user_id && (bool) apply_bk_filter( 'is_user_super_admin', $current_user_id );

		return $is_super_admin ? null : $current_user_id;
	}

	/**
	 * Query one paid Resource page with SQL-owned ordering and ownership.
	 *
	 * @param array<string,mixed> $query_values Validated query.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Database rows or error.
	 */
	private function query_paid_resources( $query_values ) {
		global $wpdb;

		$query_parameters = array();
		$where_sql        = $this->get_where_sql( $query_values['search'], $query_parameters );
		$sql              = 'SELECT ' . implode( ', ', $this->get_select_fields() )
			. " FROM {$wpdb->prefix}bookingtypes AS bt WHERE {$where_sql}";

		$sql .= ' ORDER BY ' . $this->get_sort_sql( $query_values['sort_order'], 'bt', false );

		$sql                .= ' LIMIT %d OFFSET %d';
		$query_parameters[] = absint( $query_values['per_page'] );
		$query_parameters[] = absint( $query_values['offset'] );
		$sql                 = $wpdb->prepare( $sql, $query_parameters ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- SQL structure and placeholders are repository-owned.

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared bounded repository read.
		$rows = $wpdb->get_results( $sql, ARRAY_A );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $rows ) ) {
			return $this->get_query_error();
		}

		return $rows;
	}

	/**
	 * Load intact parent/child Resource groups for one bounded page.
	 *
	 * Root identifiers are paged first. The second query loads every authorized
	 * root and direct child together, matching the Booking Resources Catalog
	 * hierarchy contract without depending on its controller or templates.
	 *
	 * @param array<string,mixed> $query_values Validated query.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Database rows or error.
	 */
	private function query_paid_hierarchy_resources( $query_values ) {
		global $wpdb;

		$root_ids = $this->query_paid_hierarchy_root_ids( $query_values );
		if ( is_wp_error( $root_ids ) || empty( $root_ids ) ) {
			return $root_ids;
		}

		$root_placeholders = implode( ', ', array_fill( 0, count( $root_ids ), '%d' ) );
		$query_parameters  = $root_ids;
		$sql               = 'SELECT ' . implode( ', ', $this->get_select_fields() )
			. " FROM {$wpdb->prefix}bookingtypes AS bt"
			. " INNER JOIN {$wpdb->prefix}bookingtypes AS root_sort"
			. " ON root_sort.booking_type_id = CASE WHEN bt.booking_type_id IN ( {$root_placeholders} ) THEN bt.booking_type_id ELSE bt.parent END"
			. " WHERE ( bt.booking_type_id IN ( {$root_placeholders} ) OR bt.parent IN ( {$root_placeholders} ) )";
		$query_parameters = array_merge( $query_parameters, $root_ids, $root_ids );
		$owner_user_id   = $this->get_restricted_owner_user_id();
		if ( null !== $owner_user_id ) {
			$sql               .= ' AND bt.users = %d';
			$query_parameters[] = $owner_user_id;
		}
		$root_sort_sql  = $this->get_sort_sql( $query_values['sort_order'], 'root_sort', true );
		$child_sort_sql = $this->get_sort_sql( $query_values['sort_order'], 'bt', true );
		$sql .= " ORDER BY {$root_sort_sql},"
			. ' CASE WHEN bt.booking_type_id = root_sort.booking_type_id THEN 0 ELSE 1 END ASC,'
			. " {$child_sort_sql}";
		$sql  = $wpdb->prepare( $sql, $query_parameters ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- SQL structure and placeholder counts are repository-owned.

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared bounded hierarchy read.
		$rows = $wpdb->get_results( $sql, ARRAY_A );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $rows ) ) {
			return $this->get_query_error();
		}

		return $rows;
	}

	/**
	 * Load the authorized root identifiers that define one hierarchy page.
	 *
	 * Search matches on a child retain the complete parent group. An authorized
	 * orphan is treated as its own root so ownership filtering never hides it.
	 *
	 * @param array<string,mixed> $query_values Validated query.
	 *
	 * @return array<int,int>|WP_Error Root IDs or error.
	 */
	private function query_paid_hierarchy_root_ids( $query_values ) {
		global $wpdb;

		$query_parameters = array();
		$where_sql        = $this->get_hierarchy_root_where_sql( $query_values['search'], $query_parameters );
		$sort_sql         = $this->get_sort_sql( $query_values['sort_order'], 'root', true );
		$sql              = "SELECT root.booking_type_id FROM {$wpdb->prefix}bookingtypes AS root WHERE {$where_sql}"
			. " ORDER BY {$sort_sql} LIMIT %d OFFSET %d";
		$query_parameters[] = absint( $query_values['per_page'] );
		$query_parameters[] = absint( $query_values['offset'] );
		$sql                = $wpdb->prepare( $sql, $query_parameters ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Repository-owned predicates and placeholders.

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared bounded root page.
		$root_ids = $wpdb->get_col( $sql );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $root_ids ) ) {
			return $this->get_query_error();
		}

		return array_values( array_filter( array_map( 'absint', $root_ids ) ) );
	}

	/**
	 * Count intact hierarchy groups under the same search and owner boundary.
	 *
	 * @param string $search Sanitized search term.
	 *
	 * @return int|WP_Error Group count or error.
	 */
	private function count_paid_hierarchy_groups( $search ) {
		global $wpdb;

		$query_parameters = array();
		$where_sql        = $this->get_hierarchy_root_where_sql( $search, $query_parameters );
		$sql              = "SELECT COUNT(*) FROM {$wpdb->prefix}bookingtypes AS root WHERE {$where_sql}";
		if ( ! empty( $query_parameters ) ) {
			$sql = $wpdb->prepare( $sql, $query_parameters ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Repository-owned predicates.
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared bounded hierarchy count.
		$count = $wpdb->get_var( $sql );
		if ( '' !== (string) $wpdb->last_error ) {
			return $this->get_query_error();
		}

		return max( 0, (int) $count );
	}

	/**
	 * Build root predicates shared by hierarchy paging and counting.
	 *
	 * @param string $search            Sanitized search term.
	 * @param array  $query_parameters Prepared parameters collected by reference.
	 *
	 * @return string Prepared SQL predicate.
	 */
	private function get_hierarchy_root_where_sql( $search, &$query_parameters ) {
		global $wpdb;

		$where_parts   = array();
		$owner_user_id = $this->get_restricted_owner_user_id();
		if ( null !== $owner_user_id ) {
			$where_parts[]      = 'root.users = %d';
			$query_parameters[] = $owner_user_id;
		}

		$visible_parent_owner = '';
		if ( null !== $owner_user_id ) {
			$visible_parent_owner = ' AND visible_parent.users = %d';
			$query_parameters[]   = $owner_user_id;
		}
		$where_parts[] = '( root.parent = 0 OR NOT EXISTS ( SELECT 1 FROM ' . $wpdb->prefix
			. 'bookingtypes AS visible_parent WHERE visible_parent.booking_type_id = root.parent'
			. $visible_parent_owner . ' ) )';

		if ( '' !== $search ) {
			$search_like = '%' . $wpdb->esc_like( $search ) . '%';
			$child_owner = '';
			$child_parameters = array();
			if ( null !== $owner_user_id ) {
				$child_owner        = ' AND search_child.users = %d';
				$child_parameters[] = $owner_user_id;
			}
			$where_parts[] = '( CAST( root.booking_type_id AS CHAR ) LIKE %s OR root.title LIKE %s'
				. " OR EXISTS ( SELECT 1 FROM {$wpdb->prefix}bookingtypes AS search_child"
				. " WHERE search_child.parent = root.booking_type_id{$child_owner}"
				. ' AND ( CAST( search_child.booking_type_id AS CHAR ) LIKE %s OR search_child.title LIKE %s ) ) )';
			$query_parameters = array_merge(
				$query_parameters,
				array( $search_like, $search_like ),
				$child_parameters,
				array( $search_like, $search_like )
			);
		}

		return implode( ' AND ', $where_parts );
	}

	/**
	 * Count paid Resources under the same search and ownership predicates.
	 *
	 * @param string $search Sanitized search term.
	 *
	 * @return int|WP_Error Resource count or safe error.
	 */
	private function count_paid_resources( $search ) {
		global $wpdb;

		$query_parameters = array();
		$where_sql        = $this->get_where_sql( $search, $query_parameters );
		$sql              = "SELECT COUNT(*) FROM {$wpdb->prefix}bookingtypes AS bt WHERE {$where_sql}";
		if ( ! empty( $query_parameters ) ) {
			$sql = $wpdb->prepare( $sql, $query_parameters ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Repository-owned SQL.
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared count query.
		$count = $wpdb->get_var( $sql );
		if ( '' !== (string) $wpdb->last_error ) {
			return $this->get_query_error();
		}

		return max( 0, (int) $count );
	}

	/**
	 * Build static edition-aware Resource fields.
	 *
	 * @return array<int,string> SQL select expressions.
	 */
	private function get_select_fields() {
		global $wpdb;

		$child_count = class_exists( 'wpdev_bk_biz_l' )
			? '( SELECT COUNT(*) FROM ' . $wpdb->prefix . 'bookingtypes AS child_bt WHERE child_bt.parent = bt.booking_type_id'
				. ( class_exists( 'wpdev_bk_multiuser' ) ? ' AND child_bt.users = bt.users' : '' ) . ' )'
			: '0';

		return array(
			'bt.booking_type_id AS id',
			'bt.title AS title',
			class_exists( 'wpdev_bk_biz_s' ) ? 'bt.cost AS cost' : "'' AS cost",
			class_exists( 'wpdev_bk_biz_l' ) ? 'bt.parent AS parent_id' : '0 AS parent_id',
			class_exists( 'wpdev_bk_biz_l' ) ? 'bt.prioritet AS priority' : '0 AS priority',
			class_exists( 'wpdev_bk_multiuser' ) ? 'bt.users AS owner_user_id' : '0 AS owner_user_id',
			"{$child_count} AS child_count",
		);
	}

	/**
	 * Build paid Resource predicates with prepared dynamic values.
	 *
	 * @param string $search            Sanitized search term.
	 * @param array  $query_parameters Prepared parameters collected by reference.
	 *
	 * @return string SQL predicate.
	 */
	private function get_where_sql( $search, &$query_parameters ) {
		global $wpdb;

		$where_parts   = array( '1 = 1' );
		$owner_user_id = $this->get_restricted_owner_user_id();
		if ( null !== $owner_user_id ) {
			$where_parts[]      = 'bt.users = %d';
			$query_parameters[] = $owner_user_id;
		}

		if ( '' !== $search ) {
			$search_like        = '%' . $wpdb->esc_like( $search ) . '%';
			$where_parts[]      = '( CAST( bt.booking_type_id AS CHAR ) LIKE %s OR bt.title LIKE %s )';
			$query_parameters[] = $search_like;
			$query_parameters[] = $search_like;
		}

		return implode( ' AND ', $where_parts );
	}

	/**
	 * Normalize a trusted or untrusted Resource sort to the stable default.
	 *
	 * @param mixed $sort_order Candidate Resource sort value.
	 *
	 * @return string Allow-listed Resource sort value.
	 */
	private function normalize_sort_order( $sort_order ) {
		$sort_order = is_scalar( $sort_order ) ? sanitize_key( (string) $sort_order ) : '';

		return in_array( $sort_order, WPBC_Timeline_Resource_View_Preferences::get_allowed_sort_orders(), true )
			? $sort_order
			: WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_STANDARD;
	}

	/**
	 * Build one static allow-listed Resource ORDER BY fragment.
	 *
	 * The fragment contains no request text. Business Large callers pass true
	 * so Standard order retains the established priority-based group ordering;
	 * other editions retain the established title order.
	 *
	 * @param string $sort_order          Normalized Resource sort value.
	 * @param string $table_alias         Repository-owned SQL table alias.
	 * @param bool   $standard_is_priority Whether Standard uses Resource priority.
	 *
	 * @return string Static SQL ordering fragment.
	 */
	private function get_sort_sql( $sort_order, $table_alias, $standard_is_priority ) {
		$sort_order  = $this->normalize_sort_order( $sort_order );
		$table_alias = in_array( $table_alias, array( 'bt', 'root', 'root_sort' ), true ) ? $table_alias : 'bt';

		switch ( $sort_order ) {
			case WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_TITLE_DESC:
				return "{$table_alias}.title DESC, {$table_alias}.booking_type_id DESC";

			case WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_ID_ASC:
				return "{$table_alias}.booking_type_id ASC";

			case WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_ID_DESC:
				return "{$table_alias}.booking_type_id DESC";

			case WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_TITLE_ASC:
				return "{$table_alias}.title ASC, {$table_alias}.booking_type_id ASC";

			case WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_STANDARD:
			default:
				return $standard_is_priority
					? "{$table_alias}.prioritet ASC, {$table_alias}.booking_type_id ASC"
					: "{$table_alias}.title ASC, {$table_alias}.booking_type_id ASC";
		}
	}

	/**
	 * Build exact-ID group ordering with an orphan-safe Resource fallback.
	 *
	 * @param string $sort_order Normalized Resource sort value.
	 *
	 * @return string Static SQL ordering fragment.
	 */
	private function get_exact_group_sort_sql( $sort_order ) {
		switch ( $this->normalize_sort_order( $sort_order ) ) {
			case WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_TITLE_DESC:
				return 'COALESCE( root_sort.title, bt.title ) DESC, COALESCE( root_sort.booking_type_id, bt.booking_type_id ) DESC';

			case WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_ID_ASC:
				return 'COALESCE( root_sort.booking_type_id, bt.booking_type_id ) ASC';

			case WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_ID_DESC:
				return 'COALESCE( root_sort.booking_type_id, bt.booking_type_id ) DESC';

			case WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_TITLE_ASC:
				return 'COALESCE( root_sort.title, bt.title ) ASC, COALESCE( root_sort.booking_type_id, bt.booking_type_id ) ASC';

			case WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_STANDARD:
			default:
				return 'COALESCE( root_sort.prioritet, bt.prioritet ) ASC, COALESCE( root_sort.booking_type_id, bt.booking_type_id ) ASC';
		}
	}

	/**
	 * Map canonical rows and batched presentation options to JSON-safe records.
	 *
	 * @param array<int,array<string,mixed>> $database_rows Canonical rows.
	 *
	 * @return array<int,array<string,mixed>> Authorized Resource DTO sources.
	 */
	private function map_resources( $database_rows ) {
		$resource_ids          = array_values( array_filter( array_map( 'absint', wp_list_pluck( $database_rows, 'id' ) ) ) );
		$content               = $this->get_stored_content( $resource_ids );
		$rate_contexts         = $this->get_rate_contexts( $database_rows );
		$visible_child_counts  = array();
		$child_ids_by_parent   = array();
		$child_positions       = array();
		$resources             = array();

		foreach ( $database_rows as $database_row ) {
			$resource_id = isset( $database_row['id'] ) ? absint( $database_row['id'] ) : 0;
			$parent_id   = isset( $database_row['parent_id'] ) ? absint( $database_row['parent_id'] ) : 0;
			if ( ! $resource_id || ! $parent_id ) {
				continue;
			}
			$child_ids_by_parent[ $parent_id ][] = $resource_id;
			$child_positions[ $resource_id ]      = count( $child_ids_by_parent[ $parent_id ] );
			$visible_child_counts[ $parent_id ]   = isset( $visible_child_counts[ $parent_id ] )
				? $visible_child_counts[ $parent_id ] + 1
				: 1;
		}

		foreach ( $database_rows as $database_row ) {
			$resource_id        = absint( $database_row['id'] );
			$stored             = isset( $content[ $resource_id ] ) ? $content[ $resource_id ] : array();
			$parent_id          = isset( $database_row['parent_id'] ) ? absint( $database_row['parent_id'] ) : 0;
			$child_count        = isset( $database_row['child_count'] ) ? absint( $database_row['child_count'] ) : 0;
			$visible_child_count = isset( $visible_child_counts[ $resource_id ] ) ? absint( $visible_child_counts[ $resource_id ] ) : 0;
			$child_position     = isset( $child_positions[ $resource_id ] ) ? absint( $child_positions[ $resource_id ] ) : 0;
			$cost               = isset( $database_row['cost'] ) ? sanitize_text_field( (string) $database_row['cost'] ) : '';
			$owner_id           = isset( $database_row['owner_user_id'] ) ? absint( $database_row['owner_user_id'] ) : 0;
			$rate_context       = isset( $rate_contexts[ $owner_id ] ) ? $rate_contexts[ $owner_id ] : array();

			$resources[] = array(
				'id'            => $resource_id,
				'title'         => wp_strip_all_tags( wpbc_lang( (string) $database_row['title'] ) ),
				'image_url'     => isset( $stored['picture_url'] ) ? esc_url_raw( wpbc_lang( (string) $stored['picture_url'] ) ) : '',
				'description'   => isset( $stored['description'] )
					? wp_strip_all_tags( wpbc_lang( (string) $stored['description'] ) )
					: '',
				'parent_id'     => $parent_id,
				'node_role'     => $parent_id ? 'child' : ( $child_count || $visible_child_count ? 'capacity_parent' : 'resource' ),
				'is_aggregate'  => 0 < $child_count,
				// Exact-ID authorization reads may omit children, so canonical child count owns expandability.
				'is_expandable' => 0 < $child_count || 0 < $visible_child_count,
				'child_count'   => $child_count,
				'visible_child_count' => $visible_child_count,
				'child_position' => $child_position,
				'is_last_child' => $parent_id && isset( $child_ids_by_parent[ $parent_id ] )
					? $child_position === count( $child_ids_by_parent[ $parent_id ] )
					: false,
				'capacity'      => $child_count ? 1 + $child_count : 1,
				'owner_user_id' => $owner_id,
				'priority'      => isset( $database_row['priority'] ) ? (int) $database_row['priority'] : 0,
				'base_cost'     => $cost,
				'base_rate'     => $this->get_base_rate( $cost, $rate_context ),
			);
		}

		return $resources;
	}

	/**
	 * Load Resource presentation options in one prepared options-table query.
	 *
	 * @param array<int,int> $resource_ids Resource IDs.
	 *
	 * @return array<int,array<string,mixed>> Options keyed by Resource ID.
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
		$sql          = $wpdb->prepare(
			"SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name IN ( {$placeholders} )",
			$option_names
		); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Placeholder count is repository-owned.

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Bounded batch avoids per-Resource option queries.
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
	 * Build a safe base-rate presentation through canonical edition settings.
	 *
	 * @param string              $cost         Stored Resource base cost.
	 * @param array<string,mixed> $rate_context Batched owner pricing settings.
	 *
	 * @return array<string,string> Base rate, currency, and charging period.
	 */
	private function get_base_rate( $cost, $rate_context ) {
		if ( ! class_exists( 'wpdev_bk_biz_s' ) || '' === $cost ) {
			return array(
				'amount'          => '',
				'formatted'       => '',
				'currency'        => '',
				'currency_symbol' => '',
				'period'          => '',
			);
		}

		$formatted = function_exists( 'wpbc_cost_show' )
			? wp_strip_all_tags( (string) wpbc_cost_show( $cost, array( 'currency' => isset( $rate_context['currency'] ) ? $rate_context['currency'] : '' ) ) )
			: $cost;

		return array(
			'amount'          => $cost,
			'formatted'       => trim( html_entity_decode( $formatted, ENT_QUOTES, 'UTF-8' ) ),
			'currency'        => isset( $rate_context['currency'] ) ? sanitize_text_field( (string) $rate_context['currency'] ) : '',
			'currency_symbol' => isset( $rate_context['currency_symbol'] ) ? sanitize_text_field( (string) $rate_context['currency_symbol'] ) : '',
			'period'          => isset( $rate_context['period'] ) ? sanitize_key( (string) $rate_context['period'] ) : '',
		);
	}

	/**
	 * Load pricing settings once per owner represented in a Resource batch.
	 *
	 * @param array<int,array<string,mixed>> $database_rows Canonical Resource rows.
	 *
	 * @return array<int,array<string,string>> Pricing context keyed by owner ID.
	 */
	private function get_rate_contexts( $database_rows ) {
		if ( ! class_exists( 'wpdev_bk_biz_s' ) ) {
			return array();
		}

		$owner_ids = array( 0 );
		if ( class_exists( 'wpdev_bk_multiuser' ) ) {
			$owner_ids       = array_values(
				array_unique(
					array_map( 'absint', wp_list_pluck( $database_rows, 'owner_user_id' ) )
				)
			);
			$cache_owner_ids = array_values( array_filter( $owner_ids ) );
			if ( ! empty( $cache_owner_ids ) ) {
				// Prime all represented owners in one query before owner-context option reads.
				update_meta_cache( 'user', $cache_owner_ids );
			}
		}
		$contexts = array();
		foreach ( $owner_ids as $owner_id ) {
			$previous_user = $this->activate_owner_context( $owner_id );
			$contexts[ $owner_id ] = array(
				'currency'        => function_exists( 'wpbc_get_currency' ) ? sanitize_text_field( (string) wpbc_get_currency() ) : '',
				'currency_symbol' => function_exists( 'wpbc_get_currency_symbol' ) ? wp_strip_all_tags( (string) wpbc_get_currency_symbol() ) : '',
				'period'          => sanitize_key( (string) get_bk_option( 'booking_paypal_price_period' ) ),
			);
			$this->restore_owner_context( $previous_user );
		}

		return $contexts;
	}

	/**
	 * Activate one already-authorized MultiUser owner without a Resource lookup.
	 *
	 * @param int $owner_id Owner WordPress user ID.
	 *
	 * @return mixed Previous MultiUser environment token.
	 */
	private function activate_owner_context( $owner_id ) {
		if ( ! class_exists( 'wpdev_bk_multiuser' ) || ! $owner_id ) {
			return null;
		}

		$previous_user = apply_bk_filter( 'get_client_side_active_params_of_user' );
		make_bk_action( 'check_multiuser_params_for_client_side_by_user_id', absint( $owner_id ) );

		return $previous_user;
	}

	/**
	 * Restore a previously active MultiUser environment.
	 *
	 * @param mixed $previous_user Previous environment token.
	 *
	 * @return void
	 */
	private function restore_owner_context( $previous_user ) {
		if ( class_exists( 'wpdev_bk_multiuser' ) && null !== $previous_user ) {
			make_bk_action( 'wpbc_mu_set_environment_for_user', $previous_user );
		}
	}

	/**
	 * Return the implicit Free Resource.
	 *
	 * @return array<string,mixed> Free Resource record.
	 */
	private function get_free_resource() {
		$stored      = get_option( self::CONTENT_OPTION_PREFIX . '1', array() );
		$stored      = is_array( $stored ) ? $stored : array();
		$title       = isset( $stored['title'] ) ? wp_strip_all_tags( wpbc_lang( (string) $stored['title'] ) ) : '';
		$picture_url = array_key_exists( 'picture_url', $stored ) ? esc_url_raw( wpbc_lang( (string) $stored['picture_url'] ) ) : '';
		$description = array_key_exists( 'description', $stored )
			? wp_strip_all_tags( wpbc_lang( (string) $stored['description'] ) )
			: '';

		return array(
			'id'            => 1,
			'title'         => '' !== $title ? $title : __( 'Default Resource', 'booking' ),
			'image_url'     => $picture_url,
			'description'   => $description,
			'parent_id'     => 0,
			'node_role'     => 'resource',
			'is_aggregate'  => false,
			'is_expandable' => false,
			'child_count'   => 0,
			'visible_child_count' => 0,
			'child_position' => 0,
			'is_last_child' => false,
			'capacity'      => 1,
			'owner_user_id' => 0,
			'priority'      => 0,
			'base_cost'     => '',
			'base_rate'     => array( 'amount' => '', 'formatted' => '', 'currency' => '', 'currency_symbol' => '', 'period' => '' ),
		);
	}

	/**
	 * Create a non-sensitive Resource query error.
	 *
	 * @return WP_Error Safe error.
	 */
	private function get_query_error() {
		return new WP_Error(
			'wpbc_timeline_resources_query_failed',
			__( 'Booking Resources could not be loaded. Reload the page and try again.', 'booking' )
		);
	}
}
