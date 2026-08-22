<?php
/** Native WordPress database repository for Services. @package Booking Calendar */
if ( ! defined( 'ABSPATH' ) ) { exit; }

/** Native persistence adapter for Services, assignments, and Appointment snapshots. */
class WPBC_Appointment_Services_Repository {
	/**
	 * Determine whether the native repository tables are available.
	 *
	 * @return bool True when every required table exists.
	 */
	public function is_ready() { return wpbc_appointment_services_tables_exist(); }

	/**
	 * Resolve the owner applied to Service reads and writes.
	 *
	 * @return int MultiUser owner ID, or zero for site-wide ownership.
	 */
	private function owner_user_id() { return wpbc_appointment_services_get_owner_user_id(); }

	/**
	 * Determine whether owner scoping can be omitted for the current user.
	 *
	 * @return bool True when the user may view all Service owners.
	 */
	private function can_view_all_owners() { return wpbc_appointment_services_can_view_all_owners(); }

	/**
	 * Build owner-aware SQL conditions for administrator Service catalogs.
	 *
	 * Provider assignments use EXISTS so one Service is counted and returned only
	 * once even if assignment storage is extended with additional matching rows.
	 * Table names are internal constants; every dynamic value is returned as a
	 * separate placeholder argument for $wpdb->prepare().
	 *
	 * @param array<string,mixed> $query          Search, status, and resource_id values.
	 * @param bool                $include_status Whether to restrict the query to one status.
	 *
	 * @return array{where:array<int,string>,args:array<int,mixed>} SQL conditions and arguments.
	 */
	private function build_catalog_where( $query, $include_status = true ) {
		global $wpdb;

		$query = wp_parse_args(
			$query,
			array(
				'search'      => '',
				'status'      => 'active',
				'resource_id' => 0,
			)
		);
		$where = array( '1=1' );
		$args  = array();

		if ( ! $this->can_view_all_owners() ) {
			$where[] = 's.owner_user_id = %d';
			$args[]  = $this->owner_user_id();
		}

		$status = is_scalar( $query['status'] ) ? sanitize_key( $query['status'] ) : '';
		if ( $include_status && in_array( $status, array( 'active', 'inactive', 'archived' ), true ) ) {
			$where[] = 's.status = %s';
			$args[]  = $status;
		}

		$search = is_scalar( $query['search'] ) ? sanitize_text_field( $query['search'] ) : '';
		if ( '' !== $search ) {
			$like    = '%' . $wpdb->esc_like( $search ) . '%';
			$where[] = '(s.title LIKE %s OR s.description LIKE %s)';
			$args[]  = $like;
			$args[]  = $like;
		}

		$resource_id = is_scalar( $query['resource_id'] ) ? absint( $query['resource_id'] ) : 0;
		if ( $resource_id ) {
			$where[] = 'EXISTS ( SELECT 1 FROM ' . wpbc_appointment_services_table_name( 'service_resources' ) . ' sr WHERE sr.service_id = s.service_id AND sr.resource_id = %d AND sr.status = %s )';
			$args[]  = $resource_id;
			$args[]  = 'active';
		}

		return array(
			'where' => $where,
			'args'  => $args,
		);
	}

	/**
	 * Find one owner-visible Service and its active Provider assignments.
	 *
	 * @param int $service_id Service ID.
	 *
	 * @return array<string,mixed>|WP_Error Service row or a not-found/storage error.
	 */
	public function find( $service_id ) {
		global $wpdb;
		if ( ! $this->is_ready() ) { return wpbc_appointment_services_storage_error(); }
		$where = 'service_id = %d';
		$args  = array( absint( $service_id ) );
		if ( ! $this->can_view_all_owners() ) { $where .= ' AND owner_user_id = %d'; $args[] = $this->owner_user_id(); }
		$sql = 'SELECT * FROM ' . wpbc_appointment_services_table_name( 'services' ) . ' WHERE ' . $where . ' LIMIT 1';
		$row = $wpdb->get_row( $wpdb->prepare( $sql, $args ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		if ( ! $row ) { return new WP_Error( 'service_not_found', __( 'Service not found.', 'booking' ) ); }
		$row['resource_ids'] = $wpdb->get_col( $wpdb->prepare( 'SELECT resource_id FROM ' . wpbc_appointment_services_table_name( 'service_resources' ) . ' WHERE service_id = %d AND status = %s ORDER BY priority, assignment_id', $service_id, 'active' ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		return $row;
	}

	/**
	 * List owner-visible Services matching search, status, and Provider filters.
	 *
	 * @param array<string,mixed> $query Search, status, resource_id, sorting, and pagination values.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Service rows or a storage error.
	 */
	public function list_items( $query = array() ) {
		global $wpdb;
		if ( ! $this->is_ready() ) { return wpbc_appointment_services_storage_error(); }
		$query       = wp_parse_args( $query, array( 'search' => '', 'status' => 'active', 'resource_id' => 0, 'sort_by' => 'service_id', 'sort_order' => 'desc', 'limit' => 500, 'offset' => 0 ) );
		$query_parts = $this->build_catalog_where( $query, true );
		$limit       = min( 500, max( 1, is_scalar( $query['limit'] ) ? absint( $query['limit'] ) : 500 ) );
		$offset      = is_scalar( $query['offset'] ) ? absint( $query['offset'] ) : 0;
		$sort_columns = array(
			'service_id' => 's.service_id',
			'title'    => 's.title',
			'duration' => 's.duration_minutes',
			'price'    => 's.base_cost',
			'status'   => 's.status',
		);
		$sort_by      = is_scalar( $query['sort_by'] ) ? sanitize_key( $query['sort_by'] ) : 'service_id';
		$sort_column  = isset( $sort_columns[ $sort_by ] ) ? $sort_columns[ $sort_by ] : $sort_columns['service_id'];
		$sort_order   = is_scalar( $query['sort_order'] ) && 'asc' === strtolower( sanitize_key( $query['sort_order'] ) ) ? 'ASC' : 'DESC';
		$stable_order = 'service_id' === $sort_by ? '' : ', s.service_id ' . $sort_order;
		$sql          = 'SELECT s.* FROM ' . wpbc_appointment_services_table_name( 'services' ) . ' s WHERE ' . implode( ' AND ', $query_parts['where'] ) . ' ORDER BY ' . $sort_column . ' ' . $sort_order . $stable_order . ' LIMIT %d OFFSET %d';
		$sql_args    = array_merge( $query_parts['args'], array( $limit, $offset ) );
		$sql         = $wpdb->prepare( $sql, $sql_args ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$rows = (array) $wpdb->get_results( $sql, ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		if ( empty( $rows ) ) { return $rows; }

		$service_ids = array_values( array_filter( array_map( 'absint', wp_list_pluck( $rows, 'service_id' ) ) ) );
		$assignments = array();
		if ( $service_ids ) {
			$placeholders = implode( ', ', array_fill( 0, count( $service_ids ), '%d' ) );
			$assignment_sql = 'SELECT service_id, resource_id FROM ' . wpbc_appointment_services_table_name( 'service_resources' ) . ' WHERE status = %s AND service_id IN (' . $placeholders . ') ORDER BY priority, assignment_id';
			$assignment_args = array_merge( array( 'active' ), $service_ids );
			foreach ( (array) $wpdb->get_results( $wpdb->prepare( $assignment_sql, $assignment_args ), ARRAY_A ) as $assignment ) { // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
				$service_id = absint( $assignment['service_id'] );
				if ( ! isset( $assignments[ $service_id ] ) ) { $assignments[ $service_id ] = array(); }
				$assignments[ $service_id ][] = absint( $assignment['resource_id'] );
			}
		}
		foreach ( $rows as &$row ) {
			$service_id = absint( $row['service_id'] );
			$row['resource_ids'] = isset( $assignments[ $service_id ] ) ? $assignments[ $service_id ] : array();
		}
		unset( $row );
		return $rows;
	}

	/**
	 * Count owner-visible Services by status for the active search and Provider filters.
	 *
	 * The requested status is intentionally ignored so the Services screen can
	 * show exact All, Active, Draft, and Archived totals with one grouped query.
	 *
	 * @param array<string,mixed> $query Search and resource_id filter values.
	 *
	 * @return array<string,int>|WP_Error Counts keyed by all, active, inactive, and archived.
	 */
	public function count_items( $query = array() ) {
		global $wpdb;
		if ( ! $this->is_ready() ) { return wpbc_appointment_services_storage_error(); }

		$query_parts = $this->build_catalog_where( $query, false );
		$sql         = 'SELECT s.status, COUNT(*) AS items_count FROM ' . wpbc_appointment_services_table_name( 'services' ) . ' s WHERE ' . implode( ' AND ', $query_parts['where'] ) . ' GROUP BY s.status';
		if ( $query_parts['args'] ) {
			$sql = $wpdb->prepare( $sql, $query_parts['args'] ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		}

		$counts = array(
			'all'      => 0,
			'active'   => 0,
			'inactive' => 0,
			'archived' => 0,
		);
		foreach ( (array) $wpdb->get_results( $sql, ARRAY_A ) as $count_row ) { // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			$status = isset( $count_row['status'] ) ? sanitize_key( $count_row['status'] ) : '';
			if ( isset( $counts[ $status ] ) ) {
				$counts[ $status ] = absint( $count_row['items_count'] );
			}
		}
		$counts['all'] = $counts['active'] + $counts['inactive'] + $counts['archived'];

		return $counts;
	}

	/**
	 * List active public Services assigned to one Provider resource.
	 *
	 * Resource assignment is the public visibility boundary; administrator owner
	 * scoping is intentionally not applied to this catalogue lookup.
	 *
	 * @param int $resource_id Provider resource ID.
	 *
	 * @return array<int,array<string,mixed>> Active Service rows.
	 */
	public function list_active_for_resource( $resource_id ) {
		global $wpdb;
		if ( ! $this->is_ready() ) { return array(); }
		$sql = 'SELECT s.*, sr.duration_override, sr.cost_override FROM ' . wpbc_appointment_services_table_name( 'services' ) . ' s INNER JOIN ' . wpbc_appointment_services_table_name( 'service_resources' ) . ' sr ON sr.service_id = s.service_id WHERE s.status = %s AND sr.status = %s AND sr.resource_id = %d ORDER BY sr.priority, s.title, s.service_id';
		$rows = (array) $wpdb->get_results( $wpdb->prepare( $sql, 'active', 'active', absint( $resource_id ) ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

		return array_map( 'wpbc_appointment_services_apply_assignment_overrides', $rows );
	}

	/**
	 * Create or update a Service and replace its Provider assignments.
	 *
	 * @param array<string,mixed> $service Raw or normalized Service values.
	 *
	 * @return array<string,mixed>|WP_Error Saved Service or persistence error.
	 */
	public function save( $service ) {
		global $wpdb;
		if ( ! $this->is_ready() ) { return wpbc_appointment_services_storage_error(); }
		$raw_service = is_object( $service ) ? get_object_vars( $service ) : (array) $service;
		$service     = wpbc_appointment_services_sanitize_payload( $raw_service );
		$service_id  = absint( $service['service_id'] );
		$metadata    = wpbc_appointment_services_decode_metadata( isset( $raw_service['metadata'] ) ? $raw_service['metadata'] : array() );
		$existing    = array();

		if ( $service_id ) {
			$existing = $this->find( $service_id );
			if ( is_wp_error( $existing ) ) { return $existing; }
			$metadata = wpbc_appointment_services_decode_metadata( isset( $existing['metadata'] ) ? $existing['metadata'] : array() );
		}
		if ( ! wpbc_appointment_services_is_pricing_available() ) {
			// A downgrade must not erase a price that can become active after upgrading again.
			$service['base_cost'] = isset( $existing['base_cost'] ) && is_numeric( $existing['base_cost'] )
				? number_format( min( 9999999999.99, max( 0, (float) $existing['base_cost'] ) ), 2, '.', '' )
				: '0.00';
		}

		if ( '' !== $service['picture_url'] ) {
			$metadata['picture_url'] = $service['picture_url'];
		} else {
			unset( $metadata['picture_url'] );
		}
		$metadata['schema_version'] = max( 1, isset( $metadata['schema_version'] ) ? absint( $metadata['schema_version'] ) : 0 );
		$encoded_metadata           = wp_json_encode( $metadata );
		if ( false === $encoded_metadata ) {
			$encoded_metadata = wp_json_encode( array( 'schema_version' => 1 ) );
		}

		$now = current_time( 'mysql' ); $user_id = get_current_user_id();
		$data = array(
			'title' => $service['title'], 'description' => $service['description'], 'duration_minutes' => $service['duration_minutes'],
			'buffer_before_minutes' => $service['buffer_before_minutes'], 'buffer_after_minutes' => $service['buffer_after_minutes'],
			'base_cost' => $service['base_cost'], 'booking_form_id' => $service['booking_form_id'],
			'status' => $service['status'], 'metadata' => $encoded_metadata, 'modified_by' => $user_id, 'modification_date' => $now,
		);
		$formats = array( '%s', '%s', '%d', '%d', '%d', '%s', '%d', '%s', '%s', '%d', '%s' );
		if ( $service_id ) {
			$result = $wpdb->update( wpbc_appointment_services_table_name( 'services' ), $data, array( 'service_id' => $service_id ), $formats, array( '%d' ) );
		} else {
			$data['owner_user_id'] = $this->owner_user_id(); $data['created_by'] = $user_id; $data['creation_date'] = $now;
			$formats[] = '%d'; $formats[] = '%d'; $formats[] = '%s';
			$result = $wpdb->insert( wpbc_appointment_services_table_name( 'services' ), $data, $formats );
			$service_id = absint( $wpdb->insert_id );
		}
		if ( false === $result || ! $service_id ) { return new WP_Error( 'service_save_failed', __( 'The Service could not be saved.', 'booking' ) ); }
		$result = $this->replace_resources( $service_id, $service['resource_ids'] );
		if ( is_wp_error( $result ) ) { return $result; }
		return $this->find( $service_id );
	}

	/**
	 * Replace every active Provider assignment for a Service.
	 *
	 * @param int   $service_id  Service ID.
	 * @param int[] $resource_ids Requested Provider resource IDs.
	 *
	 * @return true|WP_Error True on success or an assignment persistence error.
	 */
	private function replace_resources( $service_id, $resource_ids ) {
		global $wpdb;
		$service_id         = absint( $service_id );
		$resource_ids       = array_values( array_unique( array_intersect( array_map( 'absint', (array) $resource_ids ), array_keys( wpbc_appointment_services_get_provider_options() ) ) ) );
		$existing_resources = array();
		$existing_rows      = (array) $wpdb->get_results(
			$wpdb->prepare(
				'SELECT resource_id FROM ' . wpbc_appointment_services_table_name( 'service_resources' ) . ' WHERE service_id = %d',
				$service_id
			),
			ARRAY_A
		); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		foreach ( $existing_rows as $existing_row ) {
			$existing_resources[] = absint( $existing_row['resource_id'] );
		}
		foreach ( $resource_ids as $priority => $resource_id ) {
			if ( in_array( $resource_id, $existing_resources, true ) ) {
				$result = $wpdb->update(
					wpbc_appointment_services_table_name( 'service_resources' ),
					array( 'priority' => $priority, 'status' => 'active' ),
					array( 'service_id' => $service_id, 'resource_id' => $resource_id ),
					array( '%d', '%s' ),
					array( '%d', '%d' )
				);
			} else {
				$result = $wpdb->insert(
					wpbc_appointment_services_table_name( 'service_resources' ),
					array( 'service_id' => $service_id, 'resource_id' => $resource_id, 'priority' => $priority, 'status' => 'active' ),
					array( '%d', '%d', '%d', '%s' )
				);
			}
			if ( false === $result ) { return new WP_Error( 'service_assignment_failed', __( 'Provider assignments could not be saved.', 'booking' ) ); }
		}

		$removed_resources = array_values( array_diff( $existing_resources, $resource_ids ) );
		if ( $removed_resources ) {
			$placeholders = implode( ',', array_fill( 0, count( $removed_resources ), '%d' ) );
			$sql          = 'DELETE FROM ' . wpbc_appointment_services_table_name( 'service_resources' ) . ' WHERE service_id = %d AND resource_id IN (' . $placeholders . ')';
			$result       = $wpdb->query( $wpdb->prepare( $sql, array_merge( array( $service_id ), $removed_resources ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			if ( false === $result ) { return new WP_Error( 'service_assignment_failed', __( 'Provider assignments could not be saved.', 'booking' ) ); }
		}
		return true;
	}

	/**
	 * Duplicate a Service as an inactive copy.
	 *
	 * @param int $service_id Source Service ID.
	 *
	 * @return array<string,mixed>|WP_Error Duplicated Service or an error.
	 */
	public function duplicate( $service_id ) {
		$source = $this->find( $service_id );
		if ( is_wp_error( $source ) ) { return $source; }
		$source['service_id'] = 0; $source['title'] = sprintf( __( '%s (Copy)', 'booking' ), $source['title'] ); $source['status'] = 'inactive';
		return $this->save( $source );
	}

	/**
	 * Archive one owner-visible Service.
	 *
	 * @param int $service_id Service ID.
	 *
	 * @return bool|WP_Error True on success or an error.
	 */
	public function archive( $service_id ) {
		$service = $this->find( $service_id );
		if ( is_wp_error( $service ) ) { return $service; }
		$service['status'] = 'archived';
		return is_wp_error( $this->save( $service ) ) ? new WP_Error( 'service_archive_failed', __( 'The Service could not be archived.', 'booking' ) ) : true;
	}

	/**
	 * Load the complete owner-authorized before-image required for safe deletion.
	 *
	 * @param int $service_id Service ID.
	 *
	 * @return array<string,mixed>|WP_Error Canonical Service and assignment rows, or an error.
	 */
	public function get_deletion_before_image( $service_id ) {
		global $wpdb;

		$service_id = absint( $service_id );
		$authorized = $this->find( $service_id );
		if ( is_wp_error( $authorized ) ) {
			return $authorized;
		}

		$service = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . wpbc_appointment_services_table_name( 'services' ) . ' WHERE service_id = %d LIMIT 1',
				$service_id
			),
			ARRAY_A
		); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		if ( ! $service ) {
			return new WP_Error( 'service_not_found', __( 'Service not found.', 'booking' ) );
		}

		$assignments = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . wpbc_appointment_services_table_name( 'service_resources' ) . ' WHERE service_id = %d ORDER BY assignment_id',
				$service_id
			),
			ARRAY_A
		); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		if ( null === $assignments ) {
			return new WP_Error( 'appointment_services_storage_unavailable', __( 'Provider assignments could not be audited safely.', 'booking' ) );
		}

		return array(
			'service'     => $service,
			'assignments' => $assignments,
		);
	}

	/**
	 * Audit every native reference that can make permanent Service deletion unsafe.
	 *
	 * Provider assignments are owned children and are reported for review. Existing
	 * appointment snapshots and saved Appointment shortcode or block configuration
	 * are independent consumers and therefore block deletion.
	 *
	 * @param int $service_id Service ID.
	 *
	 * @return array<string,mixed>|WP_Error Reference counts and confirmed post references, or an error.
	 */
	public function get_deletion_impact( $service_id ) {
		$service_id = absint( $service_id );
		$impacts    = $this->get_deletion_impacts( array( $service_id ) );

		if ( is_wp_error( $impacts ) ) {
			return $impacts;
		}

		return isset( $impacts[ $service_id ] )
			? $impacts[ $service_id ]
			: new WP_Error( 'service_not_found', __( 'Service not found.', 'booking' ) );
	}

	/**
	 * Audit deletion references for a bounded Service selection in batch.
	 *
	 * Appointment snapshot counts and saved post candidates are loaded once for
	 * the complete selection. This keeps bulk deletion review independent from
	 * selection size and avoids one full saved-content scan per Service.
	 *
	 * @param array<int,int>                   $service_ids   Service IDs to audit.
	 * @param array<int,array<string,mixed>>|null $before_images Optional authorized before-images keyed by Service ID.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Impacts keyed by Service ID, or a safe audit error.
	 */
	public function get_deletion_impacts( $service_ids, $before_images = null ) {
		global $wpdb;

		$service_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $service_ids ) ) ) );
		if ( empty( $service_ids ) ) {
			return new WP_Error( 'wpbc_service_invalid_delete_selection', __( 'Select at least one Service.', 'booking' ) );
		}

		$before_images = is_array( $before_images ) ? $before_images : array();
		foreach ( $service_ids as $service_id ) {
			if ( isset( $before_images[ $service_id ] ) && is_array( $before_images[ $service_id ] ) ) {
				continue;
			}
			$before_image = $this->get_deletion_before_image( $service_id );
			if ( is_wp_error( $before_image ) ) {
				return $before_image;
			}
			$before_images[ $service_id ] = $before_image;
		}

		$id_placeholders = implode( ', ', array_fill( 0, count( $service_ids ), '%d' ) );
		$appointment_rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT service_id, COUNT(*) AS reference_count FROM ' . wpbc_appointment_services_table_name( 'appointment_details' ) . " WHERE service_id IN ({$id_placeholders}) GROUP BY service_id",
				$service_ids
			),
			ARRAY_A
		); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		if ( null === $appointment_rows ) {
			return new WP_Error( 'appointment_services_storage_unavailable', __( 'Appointment references could not be audited safely.', 'booking' ) );
		}

		$appointment_counts = array_fill_keys( $service_ids, 0 );
		foreach ( $appointment_rows as $appointment_row ) {
			$appointment_service_id = absint( $appointment_row['service_id'] );
			if ( isset( $appointment_counts[ $appointment_service_id ] ) ) {
				$appointment_counts[ $appointment_service_id ] = absint( $appointment_row['reference_count'] );
			}
		}

		$post_candidates = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT ID, post_title, post_type, post_status, post_content FROM {$wpdb->posts} WHERE post_content LIKE %s AND post_status NOT IN (%s, %s, %s) ORDER BY ID",
				'%' . $wpdb->esc_like( 'booking_appointment' ) . '%',
				'trash',
				'auto-draft',
				'inherit'
			),
			ARRAY_A
		); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		if ( null === $post_candidates ) {
			return new WP_Error( 'appointment_services_storage_unavailable', __( 'Saved page references could not be audited safely.', 'booking' ) );
		}

		$post_references = array_fill_keys( $service_ids, array() );
		foreach ( $post_candidates as $post_candidate ) {
			$authorized_post_reference = array(
				'id'     => absint( $post_candidate['ID'] ),
				'title'  => sanitize_text_field( (string) $post_candidate['post_title'] ),
				'type'   => sanitize_key( (string) $post_candidate['post_type'] ),
				'status' => sanitize_key( (string) $post_candidate['post_status'] ),
			);
			foreach ( $service_ids as $service_id ) {
				if ( $this->post_content_references_service( (string) $post_candidate['post_content'], $service_id ) ) {
					$post_references[ $service_id ][] = $authorized_post_reference;
				}
			}
		}

		$impacts = array();
		foreach ( $service_ids as $service_id ) {
			$service_post_references = $post_references[ $service_id ];
			$impacts[ $service_id ] = array(
				'assignment_count'     => count( $before_images[ $service_id ]['assignments'] ),
				'appointment_count'    => $appointment_counts[ $service_id ],
				'post_reference_count' => count( $service_post_references ),
				'post_references'       => $service_post_references,
				'is_complete'           => true,
			);
		}

		return $impacts;
	}

	/**
	 * Determine whether saved post content explicitly names one Appointment Service.
	 *
	 * @param string $post_content Saved block or shortcode content.
	 * @param int    $service_id  Service ID.
	 *
	 * @return bool True when an Appointment shortcode or block contains the ID.
	 */
	private function post_content_references_service( $post_content, $service_id ) {
		$service_id = absint( $service_id );
		if ( ! $service_id || '' === $post_content || false === stripos( $post_content, 'booking_appointment' ) ) {
			return false;
		}

		$single_patterns = array(
			'/\bservice_id\s*=\s*["\']?' . $service_id . '(?:["\']|\s|\]|$)/i',
			'/["\']service_id["\']\s*:\s*["\']?' . $service_id . '(?:["\']|\s|,|\}|$)/i',
		);
		foreach ( $single_patterns as $single_pattern ) {
			if ( preg_match( $single_pattern, $post_content ) ) {
				return true;
			}
		}

		$list_patterns = array(
			'/\bservice_ids\s*=\s*["\']([^"\']*)["\']/i',
			'/\bservices\s*=\s*["\']([^"\']*)["\']/i',
			'/["\']service_ids["\']\s*:\s*\[([^\]]*)\]/i',
			'/["\']services["\']\s*:\s*(?:\[([^\]]*)\]|["\']([^"\']*)["\'])/i',
		);
		foreach ( $list_patterns as $list_pattern ) {
			if ( ! preg_match_all( $list_pattern, $post_content, $matches ) ) {
				continue;
			}
			$matched_lists = isset( $matches[1] ) ? $matches[1] : array();
			if ( isset( $matches[2] ) ) {
				foreach ( $matches[2] as $match_index => $alternate_match ) {
					if ( '' !== $alternate_match ) {
						$matched_lists[ $match_index ] = $alternate_match;
					}
				}
			}
			foreach ( $matched_lists as $matched_list ) {
				$matched_ids = array_values( array_filter( array_map( 'absint', preg_split( '/[^0-9]+/', (string) $matched_list ) ) ) );
				if ( in_array( $service_id, $matched_ids, true ) ) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Start a native database transaction for a reviewed deletion batch.
	 *
	 * @return bool True when the transaction command succeeded.
	 */
	public function begin_transaction() {
		global $wpdb;
		return false !== $wpdb->query( 'START TRANSACTION' ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
	}

	/**
	 * Commit the active native database transaction.
	 *
	 * @return bool True when the commit command succeeded.
	 */
	public function commit_transaction() {
		global $wpdb;
		return false !== $wpdb->query( 'COMMIT' ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
	}

	/**
	 * Roll back the active native database transaction.
	 *
	 * @return bool True when the rollback command succeeded.
	 */
	public function rollback_transaction() {
		global $wpdb;
		return false !== $wpdb->query( 'ROLLBACK' ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
	}

	/**
	 * Delete one Service only when its reviewed canonical row remains unchanged.
	 *
	 * @param array<string,mixed> $before_image Canonical before-image from get_deletion_before_image().
	 *
	 * @return true|WP_Error True on success, or a stale/storage error.
	 */
	public function compare_and_delete_service( $before_image ) {
		global $wpdb;

		$service = isset( $before_image['service'] ) && is_array( $before_image['service'] ) ? $before_image['service'] : array();
		$service_id = isset( $service['service_id'] ) ? absint( $service['service_id'] ) : 0;
		if ( ! $service_id ) {
			return new WP_Error( 'wpbc_service_invalid_delete_before_image', __( 'The reviewed Service deletion is invalid.', 'booking' ) );
		}

		$assignment_result = $wpdb->delete(
			wpbc_appointment_services_table_name( 'service_resources' ),
			array( 'service_id' => $service_id ),
			array( '%d' )
		); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		if ( false === $assignment_result ) {
			return new WP_Error( 'wpbc_service_delete_failed', __( 'Provider assignments could not be removed.', 'booking' ) );
		}

		$delete_result = $wpdb->delete(
			wpbc_appointment_services_table_name( 'services' ),
			array(
				'service_id'        => $service_id,
				'owner_user_id'     => absint( $service['owner_user_id'] ),
				'modification_date' => (string) $service['modification_date'],
			),
			array( '%d', '%d', '%s' )
		); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		if ( 1 !== $delete_result ) {
			$this->restore_deleted_service( $before_image );
			return new WP_Error( 'wpbc_service_stale_delete_apply', __( 'The Service changed after review. Review the deletion again.', 'booking' ) );
		}

		return true;
	}

	/**
	 * Restore a deleted Service and its assignments after a partial batch failure.
	 *
	 * @param array<string,mixed> $before_image Canonical deletion before-image.
	 *
	 * @return true|WP_Error True on success, or a compensation error.
	 */
	public function restore_deleted_service( $before_image ) {
		global $wpdb;

		$service = isset( $before_image['service'] ) && is_array( $before_image['service'] ) ? $before_image['service'] : array();
		$service_id = isset( $service['service_id'] ) ? absint( $service['service_id'] ) : 0;
		if ( ! $service_id ) {
			return new WP_Error( 'wpbc_service_delete_compensation_failed', __( 'A deleted Service could not be restored.', 'booking' ) );
		}

		$exists = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT service_id FROM ' . wpbc_appointment_services_table_name( 'services' ) . ' WHERE service_id = %d',
				$service_id
			)
		); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		if ( ! $exists && false === $wpdb->insert( wpbc_appointment_services_table_name( 'services' ), $service ) ) { // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			return new WP_Error( 'wpbc_service_delete_compensation_failed', __( 'A deleted Service could not be restored.', 'booking' ) );
		}

		$assignments = isset( $before_image['assignments'] ) && is_array( $before_image['assignments'] ) ? $before_image['assignments'] : array();
		foreach ( $assignments as $assignment ) {
			$assignment_exists = $wpdb->get_var(
				$wpdb->prepare(
					'SELECT assignment_id FROM ' . wpbc_appointment_services_table_name( 'service_resources' ) . ' WHERE assignment_id = %d',
					absint( $assignment['assignment_id'] )
				)
			); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			if ( ! $assignment_exists && false === $wpdb->insert( wpbc_appointment_services_table_name( 'service_resources' ), $assignment ) ) { // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
				return new WP_Error( 'wpbc_service_delete_compensation_failed', __( 'Deleted Provider assignments could not be restored.', 'booking' ) );
			}
		}

		return true;
	}

	/**
	 * Find an active Service with an active assignment to a Provider.
	 *
	 * @param int $service_id  Service ID.
	 * @param int $resource_id Provider resource ID.
	 *
	 * @return array<string,mixed>|WP_Error Service row or compatibility/storage error.
	 */
	public function find_active_for_resource( $service_id, $resource_id ) {
		global $wpdb;
		if ( ! $this->is_ready() ) { return wpbc_appointment_services_storage_error(); }
		$sql = 'SELECT s.*, sr.duration_override, sr.cost_override FROM ' . wpbc_appointment_services_table_name( 'services' ) . ' s INNER JOIN ' . wpbc_appointment_services_table_name( 'service_resources' ) . ' sr ON sr.service_id = s.service_id WHERE s.service_id = %d AND s.status = %s AND sr.resource_id = %d AND sr.status = %s LIMIT 1';
		$service = $wpdb->get_row( $wpdb->prepare( $sql, absint( $service_id ), 'active', absint( $resource_id ), 'active' ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

		return $service ? wpbc_appointment_services_apply_assignment_overrides( $service ) : new WP_Error( 'service_provider_mismatch', __( 'The selected Service is not available from this Provider.', 'booking' ) );
	}

	/**
	 * Insert or update the immutable Service values attached to an Appointment.
	 *
	 * @param int                 $booking_id  Core booking ID.
	 * @param int                 $resource_id Provider resource ID.
	 * @param array<string,mixed> $service     Service values copied into the snapshot.
	 *
	 * @return bool True when the snapshot was persisted.
	 */
	public function save_appointment_snapshot( $booking_id, $resource_id, $service ) {
		global $wpdb;
		if ( ! $this->is_ready() || ! absint( $booking_id ) || ! absint( $resource_id ) || empty( $service['service_id'] ) ) {
			return false;
		}
		$service = wp_parse_args(
			(array) $service,
			array(
				'title'                => '',
				'duration_minutes'     => 0,
				'buffer_before_minutes'=> 0,
				'buffer_after_minutes' => 0,
				'base_cost'            => '0.00',
				'booking_form_id'      => 0,
			)
		);
		if ( ! wpbc_appointment_services_is_pricing_available() ) {
			// New snapshots below Business Small must not imply an unsupported charge.
			$service['base_cost']         = '0.00';
			$service['base_service_cost'] = '0.00';
			$service['cost_override']     = null;
		}
		$existing_id = $wpdb->get_var( $wpdb->prepare( 'SELECT appointment_detail_id FROM ' . wpbc_appointment_services_table_name( 'appointment_details' ) . ' WHERE booking_id = %d', $booking_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		if ( $existing_id ) {
			return true;
		}

		$now               = current_time( 'mysql' );
		$base_service_cost = isset( $service['base_service_cost'] ) && is_numeric( $service['base_service_cost'] )
			? number_format( min( 9999999999.99, max( 0, (float) $service['base_service_cost'] ) ), 2, '.', '' )
			: number_format( min( 9999999999.99, max( 0, (float) $service['base_cost'] ) ), 2, '.', '' );
		$cost_override     = isset( $service['cost_override'] ) && is_numeric( $service['cost_override'] )
			? number_format( min( 9999999999.99, max( 0, (float) $service['cost_override'] ) ), 2, '.', '' )
			: null;
		$metadata          = array(
			'schema_version'            => 2,
			'provider_title'            => wpbc_appointment_services_get_provider_title( $resource_id ),
			'base_duration_minutes'     => isset( $service['base_duration_minutes'] ) ? min( 65535, absint( $service['base_duration_minutes'] ) ) : min( 65535, absint( $service['duration_minutes'] ) ),
			'duration_override_minutes' => isset( $service['duration_override_minutes'] ) ? min( 65535, absint( $service['duration_override_minutes'] ) ) : 0,
			'base_service_cost'          => $base_service_cost,
			'cost_override'              => $cost_override,
		);
		$data     = array(
			'booking_id' => absint( $booking_id ), 'service_id' => absint( $service['service_id'] ), 'resource_id' => absint( $resource_id ),
			'service_title' => sanitize_text_field( $service['title'] ), 'duration_minutes' => min( 65535, absint( $service['duration_minutes'] ) ),
			'buffer_before_minutes' => min( 65535, absint( $service['buffer_before_minutes'] ) ), 'buffer_after_minutes' => min( 65535, absint( $service['buffer_after_minutes'] ) ),
			'base_cost' => number_format( min( 9999999999.99, max( 0, (float) $service['base_cost'] ) ), 2, '.', '' ), 'booking_form_id' => absint( $service['booking_form_id'] ),
			'metadata' => wp_json_encode( $metadata ), 'creation_date' => $now, 'modification_date' => $now,
		);
		$formats  = array( '%d', '%d', '%d', '%s', '%d', '%d', '%d', '%s', '%d', '%s', '%s', '%s' );
		$inserted = $wpdb->insert( wpbc_appointment_services_table_name( 'appointment_details' ), $data, $formats );
		if ( false !== $inserted ) {
			return true;
		}

		// A concurrent duplicate hook may have inserted the immutable row first.
		return (bool) $wpdb->get_var( $wpdb->prepare( 'SELECT appointment_detail_id FROM ' . wpbc_appointment_services_table_name( 'appointment_details' ) . ' WHERE booking_id = %d', $booking_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
	}

	/**
	 * Return the Appointment Service snapshot for a core booking.
	 *
	 * @param int $booking_id Core booking ID.
	 *
	 * @return array<string,mixed>|null Snapshot row, or null when absent/unavailable.
	 */
	public function get_appointment_snapshot( $booking_id ) {
		global $wpdb;
		if ( ! $this->is_ready() ) { return null; }
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . wpbc_appointment_services_table_name( 'appointment_details' ) . ' WHERE booking_id = %d LIMIT 1', absint( $booking_id ) ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		return $row ? $row : null;
	}

	/**
	 * Update the Provider stored in an Appointment snapshot after a valid move.
	 *
	 * @param int $booking_id  Core booking ID.
	 * @param int $resource_id New Provider resource ID.
	 *
	 * @return bool True when the database update did not fail.
	 */
	public function update_snapshot_resource( $booking_id, $resource_id ) {
		global $wpdb;
		$snapshot = $this->get_appointment_snapshot( $booking_id );
		if ( ! $snapshot ) {
			return true;
		}
		$metadata                   = wpbc_appointment_services_decode_snapshot_metadata( $snapshot['metadata'] );
		$metadata['schema_version'] = max( 2, isset( $metadata['schema_version'] ) ? absint( $metadata['schema_version'] ) : 0 );
		$metadata['provider_title'] = wpbc_appointment_services_get_provider_title( $resource_id );

		return false !== $wpdb->update(
			wpbc_appointment_services_table_name( 'appointment_details' ),
			array( 'resource_id' => absint( $resource_id ), 'metadata' => wp_json_encode( $metadata ), 'modification_date' => current_time( 'mysql' ) ),
			array( 'booking_id' => absint( $booking_id ) ),
			array( '%d', '%s', '%s' ), array( '%d' )
		);
	}
}
