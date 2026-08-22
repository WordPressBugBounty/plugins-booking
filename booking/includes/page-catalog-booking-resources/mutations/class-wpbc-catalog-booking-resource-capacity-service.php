<?php
/**
 * Independent reviewed capacity operations for the Resource catalog.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Plan and apply Booking Resource capacity without using the legacy catalog.
 *
 * Capacity remains a Booking Resources domain rule. The shared catalog only
 * transports and renders this service contract; it never assumes that every
 * catalog parent contributes one unit or that every container is bookable.
 */
final class WPBC_Catalog_Booking_Resource_Capacity_Service {

	/**
	 * Hard safety limit for one parent plus its child calendars.
	 *
	 * @var int
	 */
	const MAX_CAPACITY = 200;

	/**
	 * Independent Resource repository.
	 *
	 * @var WPBC_Catalog_Booking_Resources_Repository
	 */
	private $repository;

	/**
	 * Independent presentation-value store.
	 *
	 * @var WPBC_Catalog_Booking_Resource_Content_Store
	 */
	private $content_store;

	/**
	 * Compensating permanent-deletion service.
	 *
	 * @var WPBC_Catalog_Booking_Resources_Deleter
	 */
	private $deleter;

	/**
	 * Set independent read and presentation-storage collaborators.
	 *
	 * @param WPBC_Catalog_Booking_Resources_Repository|null $repository    Optional repository.
	 * @param WPBC_Catalog_Booking_Resource_Content_Store|null $content_store Optional content store.
	 * @param WPBC_Catalog_Booking_Resources_Deleter|null      $deleter       Optional deletion service.
	 */
	public function __construct( $repository = null, $content_store = null, $deleter = null ) {
		$this->repository    = $repository instanceof WPBC_Catalog_Booking_Resources_Repository ? $repository : new WPBC_Catalog_Booking_Resources_Repository();
		$this->content_store = $content_store instanceof WPBC_Catalog_Booking_Resource_Content_Store ? $content_store : new WPBC_Catalog_Booking_Resource_Content_Store();
		$this->deleter       = $deleter instanceof WPBC_Catalog_Booking_Resources_Deleter ? $deleter : new WPBC_Catalog_Booking_Resources_Deleter( $this->repository, $this->content_store );
	}

	/**
	 * Return the authorized capacity editor context for a root or child row.
	 *
	 * A child action resolves to its authorized parent so both row action entry
	 * points operate on the same canonical group.
	 *
	 * @param int $requested_resource_id Resource row that opened the inspector.
	 *
	 * @return array<string,mixed>|WP_Error Client-safe context or validation error.
	 */
	public function get_context( $requested_resource_id ) {
		$root_resource = $this->get_authorized_root_resource( $requested_resource_id );
		if ( is_wp_error( $root_resource ) ) {
			return $root_resource;
		}

		$children = $this->repository->get_capacity_children( absint( $root_resource['id'] ) );
		if ( is_wp_error( $children ) ) {
			return $children;
		}

		$current_capacity   = count( $children ) + 1;
		$maximum_additional = $this->get_maximum_additional_units( $current_capacity );

		return array(
			'resource_id'          => absint( $root_resource['id'] ),
			'requested_resource_id' => absint( $requested_resource_id ),
			'title'                => wp_strip_all_tags( (string) $root_resource['title'] ),
			'current_capacity'     => $current_capacity,
			'minimum_capacity'     => 1,
			'maximum_capacity'     => $current_capacity + $maximum_additional,
			'maximum_additional'   => $maximum_additional,
			'children'             => $this->prepare_children( $children ),
		);
	}

	/**
	 * Build a signed capacity review without mutating storage.
	 *
	 * @param int              $resource_id        Root or child Resource ID.
	 * @param mixed            $target_capacity    Requested whole-number capacity.
	 * @param array<int,mixed> $detach_resource_ids Explicit children to remove from the group.
	 * @param string           $decrease_action     Either detach or delete.
	 *
	 * @return array<string,mixed>|WP_Error Signed public preview or error.
	 */
	public function preview( $resource_id, $target_capacity, $detach_resource_ids = array(), $decrease_action = 'detach' ) {
		$plan = $this->build_plan( $resource_id, $target_capacity, $detach_resource_ids, $decrease_action );
		if ( is_wp_error( $plan ) ) {
			return $plan;
		}

		return array_merge(
			$this->prepare_public_plan( $plan ),
			array( 'review_token' => $this->create_review_token( $plan ) )
		);
	}

	/**
	 * Apply one signed capacity review after rebuilding current state.
	 *
	 * @param int              $resource_id        Root or child Resource ID.
	 * @param mixed            $target_capacity    Reviewed capacity.
	 * @param array<int,mixed> $detach_resource_ids Reviewed child detachments.
	 * @param string           $review_token       Signed preview token.
	 * @param string           $decrease_action    Either detach or delete.
	 * @param bool             $acknowledged       Permanent-deletion acknowledgement.
	 *
	 * @return array<string,mixed>|WP_Error Mutation result or safe error.
	 */
	public function apply( $resource_id, $target_capacity, $detach_resource_ids, $review_token, $decrease_action = 'detach', $acknowledged = false ) {
		if ( function_exists( 'wpbc_is_this_demo' ) && wpbc_is_this_demo() ) {
			return new WP_Error( 'wpbc_catalog_capacity_demo', __( 'Changing resource capacity is disabled in the public demo.', 'booking' ) );
		}

		$plan = $this->build_plan( $resource_id, $target_capacity, $detach_resource_ids, $decrease_action );
		if ( is_wp_error( $plan ) ) {
			return $plan;
		}
		$expected_token = $this->create_review_token( $plan );
		if ( '' === (string) $review_token || ! hash_equals( $expected_token, (string) $review_token ) ) {
			return new WP_Error(
				'wpbc_catalog_capacity_review_stale',
				__( 'This resource group changed after it was reviewed. Review the capacity change again before applying it.', 'booking' )
			);
		}
		if ( 'decrease' === $plan['operation'] && 'delete' === $plan['decrease_action'] && ! $acknowledged ) {
			return new WP_Error( 'wpbc_catalog_capacity_delete_acknowledgement', __( 'Confirm the permanent deletion before applying this capacity change.', 'booking' ) );
		}

		$created_ids  = array();
		$detached_ids = array();
		$deleted_ids  = array();
		if ( 'increase' === $plan['operation'] ) {
			$created_ids = $this->create_child_units( $plan );
			if ( is_wp_error( $created_ids ) ) {
				return $created_ids;
			}
			if ( ! $this->has_expected_children( $plan['resource_id'], array_merge( wp_list_pluck( $plan['children'], 'id' ), $created_ids ) ) ) {
				return $this->get_create_failure_after_compensation( $created_ids );
			}
			foreach ( $created_ids as $created_id ) {
				do_action( 'wpbc_resource_created', $created_id );
			}
		} elseif ( 'detach' === $plan['decrease_action'] ) {
			$detached_ids = $this->detach_child_units( $plan['resource_id'], $plan['detach_ids'] );
			if ( is_wp_error( $detached_ids ) ) {
				return $detached_ids;
			}
			$remaining_child_ids = array_values( array_diff( array_map( 'absint', wp_list_pluck( $plan['children'], 'id' ) ), $detached_ids ) );
			if ( ! $this->has_expected_children( $plan['resource_id'], $remaining_child_ids ) ) {
				return $this->get_detach_failure_after_compensation( $plan['resource_id'], $detached_ids );
			}
		} else {
			$delete_result = $this->deleter->delete_capacity_children(
				$plan['resource_id'],
				$plan['detach_ids'],
				$plan['remaining_child_ids'],
				$plan['delete_review']['review_token']
			);
			if ( is_wp_error( $delete_result ) ) {
				return $delete_result;
			}
			$deleted_ids = array_values( array_map( 'absint', $delete_result['deleted_ids'] ) );
		}

		if ( function_exists( 'make_bk_action' ) ) {
			make_bk_action( 'wpbc_reinit_booking_resource_cache' );
		}

		/**
		 * Fires after the independent catalog applies a capacity change.
		 *
		 * @param int            $resource_id   Top-level Resource ID.
		 * @param int            $old_capacity Capacity before the operation.
		 * @param int            $new_capacity Capacity after the operation.
		 * @param array<int,int> $created_ids   New child calendar IDs.
		 * @param array<int,int> $detached_ids  Children made independent.
		 * @param array<int,int> $deleted_ids   Children permanently deleted.
		 */
		do_action(
			'wpbc_catalog_booking_resource_capacity_adjusted',
			$plan['resource_id'],
			$plan['current_capacity'],
			$plan['target_capacity'],
			$created_ids,
			$detached_ids,
			$deleted_ids
		);

		// Preserve the established domain event for integrations outside either catalog UI.
		do_action(
			'wpbc_booking_resource_capacity_adjusted',
			$plan['resource_id'],
			$plan['current_capacity'],
			$plan['target_capacity'],
			$created_ids,
			$detached_ids,
			$deleted_ids
		);

		return array(
			'resource_id'  => absint( $plan['resource_id'] ),
			'old_capacity' => absint( $plan['current_capacity'] ),
			'new_capacity' => absint( $plan['target_capacity'] ),
			'created_ids'  => array_values( array_map( 'absint', $created_ids ) ),
			'detached_ids' => array_values( array_map( 'absint', $detached_ids ) ),
			'deleted_ids'  => array_values( array_map( 'absint', $deleted_ids ) ),
			'affected_ids' => array_values( array_unique( array_merge( array( absint( $plan['resource_id'] ) ), $created_ids, $detached_ids ) ) ),
		);
	}

	/**
	 * Build the private capacity plan from current canonical state.
	 *
	 * @param int              $resource_id        Root or child Resource ID.
	 * @param mixed            $target_capacity    Requested capacity.
	 * @param array<int,mixed> $detach_resource_ids Requested children removed from the group.
	 * @param string           $decrease_action     Either detach or delete.
	 *
	 * @return array<string,mixed>|WP_Error Validated plan or error.
	 */
	private function build_plan( $resource_id, $target_capacity, $detach_resource_ids, $decrease_action ) {
		$context = $this->get_context( $resource_id );
		if ( is_wp_error( $context ) ) {
			return $context;
		}
		$target_capacity = $this->normalize_target_capacity( $target_capacity );
		if ( is_wp_error( $target_capacity ) ) {
			return $target_capacity;
		}
		if ( $target_capacity < 1 || $target_capacity > absint( $context['maximum_capacity'] ) ) {
			return new WP_Error(
				'wpbc_catalog_capacity_range',
				sprintf(
					/* translators: 1: Minimum capacity. 2: Maximum capacity. */
					__( 'Choose a capacity between %1$s and %2$s.', 'booking' ),
					number_format_i18n( 1 ),
					number_format_i18n( absint( $context['maximum_capacity'] ) )
				)
			);
		}
		if ( $target_capacity === absint( $context['current_capacity'] ) ) {
			return new WP_Error( 'wpbc_catalog_capacity_unchanged', __( 'Choose a different capacity before reviewing the change.', 'booking' ) );
		}

		$root_resource = $this->repository->get_resource( absint( $context['resource_id'] ) );
		if ( is_wp_error( $root_resource ) || ! is_array( $root_resource ) ) {
			return is_wp_error( $root_resource ) ? $root_resource : new WP_Error( 'wpbc_catalog_capacity_root_missing', __( 'The parent Booking Resource no longer exists.', 'booking' ) );
		}
		if ( ! empty( $root_resource['parent_id'] ) ) {
			return new WP_Error( 'wpbc_catalog_capacity_hierarchy_changed', __( 'This resource group changed while its capacity was being prepared. Reload the catalog and try again.', 'booking' ) );
		}
		$children = $this->repository->get_capacity_children( absint( $root_resource['id'] ) );
		if ( is_wp_error( $children ) ) {
			return $children;
		}
		if ( count( $children ) + 1 !== absint( $context['current_capacity'] ) ) {
			return new WP_Error( 'wpbc_catalog_capacity_hierarchy_changed', __( 'This resource group changed while its capacity was being prepared. Reload the catalog and try again.', 'booking' ) );
		}

		$operation         = $target_capacity > absint( $context['current_capacity'] ) ? 'increase' : 'decrease';
		$decrease_action   = sanitize_key( (string) $decrease_action );
		if ( ! in_array( $decrease_action, array( 'detach', 'delete' ), true ) ) {
			return new WP_Error( 'wpbc_catalog_capacity_decrease_action', __( 'Choose a valid action for the child units removed from capacity.', 'booking' ) );
		}
		if ( 'increase' === $operation ) {
			$decrease_action = 'detach';
		}
		$detach_ids        = $this->normalize_resource_ids( $detach_resource_ids );
		$detach_resources  = array();
		$create_resources  = array();
		$create_count      = 0;
		if ( 'increase' === $operation ) {
			$create_count = $target_capacity - absint( $context['current_capacity'] );
			if ( ! empty( $detach_ids ) ) {
				return new WP_Error( 'wpbc_catalog_capacity_detach_unexpected', __( 'Do not select resources to detach when increasing capacity.', 'booking' ) );
			}
			$create_resources = $this->prepare_new_units( $root_resource, $create_count, $children );
			if ( is_wp_error( $create_resources ) ) {
				return $create_resources;
			}
		} else {
			$required_detach_count = absint( $context['current_capacity'] ) - $target_capacity;
			if ( count( $detach_ids ) !== $required_detach_count ) {
				return new WP_Error(
					'wpbc_catalog_capacity_detach_count',
					sprintf(
						/* translators: %s: Required number of child resources. */
						'delete' === $decrease_action
							? _n( 'Select exactly %s child resource to permanently delete.', 'Select exactly %s child resources to permanently delete.', $required_detach_count, 'booking' )
							: _n( 'Select exactly %s child resource to make independent.', 'Select exactly %s child resources to make independent.', $required_detach_count, 'booking' ),
						number_format_i18n( $required_detach_count )
					)
				);
			}
			$children_by_id = array();
			foreach ( $children as $child_resource ) {
				$children_by_id[ absint( $child_resource['id'] ) ] = $child_resource;
			}
			foreach ( $detach_ids as $detach_id ) {
				if ( ! isset( $children_by_id[ $detach_id ] ) ) {
					return new WP_Error( 'wpbc_catalog_capacity_child_invalid', __( 'One of the selected units no longer belongs to this resource group.', 'booking' ) );
				}
				$detach_resources[] = $children_by_id[ $detach_id ];
			}
		}

		$remaining_child_ids = array_values( array_diff( array_map( 'absint', wp_list_pluck( $children, 'id' ) ), $detach_ids ) );
		$plan                = array(
			'resource_id'      => absint( $root_resource['id'] ),
			'root_resource'    => $root_resource,
			'title'            => (string) $root_resource['title'],
			'current_capacity' => absint( $context['current_capacity'] ),
			'target_capacity'  => $target_capacity,
			'operation'        => $operation,
			'decrease_action'  => $decrease_action,
			'create_count'     => $create_count,
			'create_resources' => $create_resources,
			'detach_ids'       => $detach_ids,
			'detach_resources' => $detach_resources,
			'remaining_child_ids' => $remaining_child_ids,
			'delete_review'    => array(),
			'children'         => $children,
		);
		if ( 'decrease' === $operation && 'delete' === $decrease_action ) {
			$delete_review = $this->deleter->preview_capacity_children( $plan['resource_id'], $detach_ids, $remaining_child_ids );
			if ( is_wp_error( $delete_review ) ) {
				return $delete_review;
			}
			$plan['delete_review'] = $delete_review;
		}

		return $plan;
	}

	/**
	 * Resolve an authorized root when a root or one of its children is supplied.
	 *
	 * @param int $resource_id Requested Resource ID.
	 *
	 * @return array<string,mixed>|WP_Error Authorized root or error.
	 */
	private function get_authorized_root_resource( $resource_id ) {
		if ( ! class_exists( 'wpdev_bk_biz_l' ) ) {
			return new WP_Error( 'wpbc_catalog_capacity_edition', __( 'Adjusting resource capacity is available in the Business Large version and higher.', 'booking' ) );
		}
		$resource = $this->repository->get_resource( absint( $resource_id ) );
		if ( is_wp_error( $resource ) ) {
			return $resource;
		}
		if ( ! is_array( $resource ) ) {
			return new WP_Error( 'wpbc_catalog_capacity_not_found', __( 'The Booking Resource is unavailable.', 'booking' ) );
		}
		if ( ! empty( $resource['parent_id'] ) ) {
			$resource = $this->repository->get_resource( absint( $resource['parent_id'] ) );
			if ( is_wp_error( $resource ) ) {
				return $resource;
			}
			if ( ! is_array( $resource ) ) {
				return new WP_Error( 'wpbc_catalog_capacity_parent_unavailable', __( 'The parent Booking Resource is unavailable in the current account context.', 'booking' ) );
			}
		}

		return $resource;
	}

	/**
	 * Return client-safe children with retained booking counts.
	 *
	 * @param array<int,array<string,mixed>> $children Authorized children.
	 *
	 * @return array<int,array<string,mixed>> Prepared children.
	 */
	private function prepare_children( $children ) {
		$booking_counts    = $this->get_booking_counts( wp_list_pluck( $children, 'id' ) );
		$prepared_children = array();
		foreach ( $children as $child_resource ) {
			$child_id       = absint( $child_resource['id'] );
			$booking_count  = isset( $booking_counts[ $child_id ] ) ? absint( $booking_counts[ $child_id ] ) : 0;
			$prepared_children[] = array(
				'id'                  => $child_id,
				'title'               => wp_strip_all_tags( (string) $child_resource['title'] ),
				'picture_url'         => isset( $child_resource['picture_url'] ) ? esc_url_raw( (string) $child_resource['picture_url'] ) : '',
				'booking_count'       => $booking_count,
				'booking_count_label' => 0 < $booking_count
					? sprintf(
						/* translators: %s: Number of retained bookings. */
						_n( '%s booking retained', '%s bookings retained', $booking_count, 'booking' ),
						number_format_i18n( $booking_count )
					)
					: __( 'No existing bookings', 'booking' ),
			);
		}

		return $prepared_children;
	}

	/**
	 * Count bookings retained by child calendars.
	 *
	 * @param array<int,mixed> $resource_ids Authorized child IDs.
	 *
	 * @return array<int,int> Counts keyed by Resource ID.
	 */
	private function get_booking_counts( $resource_ids ) {
		global $wpdb;

		$resource_ids = array_values( array_filter( array_map( 'absint', (array) $resource_ids ) ) );
		if ( empty( $resource_ids ) ) {
			return array();
		}
		$placeholders = implode( ',', array_fill( 0, count( $resource_ids ), '%d' ) );
		$sql          = "SELECT booking_type, COUNT(*) AS booking_count FROM {$wpdb->prefix}booking WHERE booking_type IN ({$placeholders}) GROUP BY booking_type";
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared -- Prepared, bounded impact summary.
		$count_rows = $wpdb->get_results( $wpdb->prepare( $sql, $resource_ids ), ARRAY_A );
		$counts     = array();
		foreach ( is_array( $count_rows ) ? $count_rows : array() as $count_row ) {
			$counts[ absint( $count_row['booking_type'] ) ] = absint( $count_row['booking_count'] );
		}

		return $counts;
	}

	/**
	 * Build exact new-unit titles for review and stale-state signing.
	 *
	 * @param array<string,mixed>            $root_resource Root Resource.
	 * @param int                            $create_count  Units to create.
	 * @param array<int,array<string,mixed>> $children      Current children.
	 *
	 * @return array<int,array<string,string>>|WP_Error Prospective unit summaries.
	 */
	private function prepare_new_units( $root_resource, $create_count, $children ) {
		global $wpdb;

		$root_id = absint( $root_resource['id'] );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Exact canonical title is part of the signed creation review.
		$root_title = $wpdb->get_var( $wpdb->prepare( "SELECT title FROM {$wpdb->prefix}bookingtypes WHERE booking_type_id = %d", $root_id ) );
		if ( null === $root_title ) {
			return new WP_Error( 'wpbc_catalog_capacity_root_missing', __( 'The parent Booking Resource no longer exists.', 'booking' ) );
		}
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Small title projection prevents generated-name collisions.
		$used_titles = array_map( 'strval', (array) $wpdb->get_col( "SELECT title FROM {$wpdb->prefix}bookingtypes" ) );
		$next_unit   = max( 2, count( $children ) + 2 );
		$new_units   = array();
		for ( $unit_index = 0; $unit_index < absint( $create_count ); $unit_index++ ) {
			$new_units[] = array(
				'title'       => $this->get_unique_unit_title( (string) $root_title, $used_titles, $next_unit ),
				'picture_url' => isset( $root_resource['picture_url'] ) ? esc_url_raw( (string) $root_resource['picture_url'] ) : '',
			);
		}

		return $new_units;
	}

	/**
	 * Create reviewed child rows and compensate every inserted row on failure.
	 *
	 * This explicit compensation also works on legacy MyISAM installations
	 * where SQL transaction commands cannot provide rollback guarantees.
	 *
	 * @param array<string,mixed> $plan Current signed plan.
	 *
	 * @return array<int,int>|WP_Error Created IDs or storage error.
	 */
	private function create_child_units( $plan ) {
		global $wpdb;

		$resource_id = absint( $plan['resource_id'] );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Canonical row supplies inherited runtime fields.
		$root_row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}bookingtypes WHERE booking_type_id = %d", $resource_id ), ARRAY_A );
		if ( ! is_array( $root_row ) ) {
			return new WP_Error( 'wpbc_catalog_capacity_root_missing', __( 'The parent Booking Resource no longer exists.', 'booking' ) );
		}
		$next_priority = $this->get_next_priority( $plan['root_resource'], $plan['children'] );
		$created_ids   = array();

		foreach ( $plan['create_resources'] as $unit_index => $create_resource ) {
			$unit_title    = (string) $create_resource['title'];
			$insert_values = array(
				'title'     => $unit_title,
				'parent'    => $resource_id,
				'prioritet' => min( 2147483647, $next_priority + $unit_index ),
			);
			$insert_formats = array( '%s', '%d', '%d' );
			foreach ( array( 'cost' => '%s', 'default_form' => '%s', 'visitors' => '%d', 'users' => '%d' ) as $column_name => $column_format ) {
				if ( array_key_exists( $column_name, $root_row ) ) {
					$insert_values[ $column_name ] = $root_row[ $column_name ];
					$insert_formats[]              = $column_format;
				}
			}

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Canonical table has no CRUD API; inserted IDs are compensation-scoped.
			$inserted = $wpdb->insert( $wpdb->prefix . 'bookingtypes', $insert_values, $insert_formats );
			if ( 1 !== $inserted || ! $wpdb->insert_id ) {
				return $this->get_create_failure_after_compensation( $created_ids );
			}
			$created_id    = absint( $wpdb->insert_id );
			$created_ids[] = $created_id;
			$stored = $this->content_store->save(
				$created_id,
				$unit_title,
				isset( $plan['root_resource']['description'] ) ? (string) $plan['root_resource']['description'] : '',
				isset( $plan['root_resource']['picture_url'] ) ? (string) $plan['root_resource']['picture_url'] : ''
			);
			if ( is_wp_error( $stored ) ) {
				return $this->get_create_failure_after_compensation( $created_ids );
			}
		}

		return $created_ids;
	}

	/**
	 * Compensate a failed increase and return the correct failure severity.
	 *
	 * @param array<int,int> $created_ids IDs inserted by this request.
	 *
	 * @return WP_Error Safe mutation or compensation error.
	 */
	private function get_create_failure_after_compensation( $created_ids ) {
		$compensated = $this->rollback_created_units( $created_ids );
		if ( ! $compensated ) {
			return new WP_Error( 'wpbc_catalog_capacity_compensation_failed', __( 'The capacity change failed and could not be fully compensated. Contact an administrator before trying again.', 'booking' ) );
		}

		return new WP_Error( 'wpbc_catalog_capacity_create_failed', __( 'The new resource units could not be created. No capacity change was applied.', 'booking' ) );
	}

	/**
	 * Detach reviewed children in one constrained statement with compensation.
	 *
	 * @param int            $resource_id Parent Resource ID.
	 * @param array<int,int> $detach_ids  Children to preserve as independent rows.
	 *
	 * @return array<int,int>|WP_Error Detached IDs or error.
	 */
	private function detach_child_units( $resource_id, $detach_ids ) {
		global $wpdb;

		$detach_ids = array_values( array_filter( array_map( 'absint', $detach_ids ) ) );
		if ( empty( $detach_ids ) ) {
			return new WP_Error( 'wpbc_catalog_capacity_detach_empty', __( 'Select the units that should become independent.', 'booking' ) );
		}
		$placeholders = implode( ',', array_fill( 0, count( $detach_ids ), '%d' ) );
		$query_values = array_merge( array( absint( $resource_id ) ), $detach_ids );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Transaction is used where supported; compensation remains authoritative for legacy engines.
		$transaction_started = false !== $wpdb->query( 'START TRANSACTION' );
		$lock_suffix         = $transaction_started ? ' FOR UPDATE' : '';
		$lock_sql            = "SELECT booking_type_id FROM {$wpdb->prefix}bookingtypes WHERE parent = %d AND booking_type_id IN ({$placeholders}){$lock_suffix}";
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared relationship revalidation.
		$current_ids = array_map( 'absint', (array) $wpdb->get_col( $wpdb->prepare( $lock_sql, $query_values ) ) );
		sort( $current_ids, SORT_NUMERIC );
		sort( $detach_ids, SORT_NUMERIC );
		if ( $current_ids !== $detach_ids ) {
			if ( $transaction_started ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Rolls back only this request-local transaction.
				$wpdb->query( 'ROLLBACK' );
			}
			return new WP_Error( 'wpbc_catalog_capacity_detach_conflict', __( 'The selected unit relationship changed before it could be saved. Reload the catalog and review the capacity again.', 'booking' ) );
		}

		$update_sql = "UPDATE {$wpdb->prefix}bookingtypes SET parent = 0 WHERE parent = %d AND booking_type_id IN ({$placeholders})";
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery -- One constrained statement preserves child records and bookings.
		$updated_rows = $wpdb->query( $wpdb->prepare( $update_sql, $query_values ) );
		if ( count( $detach_ids ) !== absint( $updated_rows ) ) {
			if ( $transaction_started ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Best-effort engine rollback before explicit compensation.
				$wpdb->query( 'ROLLBACK' );
			}
			return $this->get_detach_failure_after_compensation( $resource_id, $detach_ids );
		}
		if ( $transaction_started && false === $wpdb->query( 'COMMIT' ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Best-effort engine rollback before explicit compensation.
			$wpdb->query( 'ROLLBACK' );
			return $this->get_detach_failure_after_compensation( $resource_id, $detach_ids );
		}

		return $detach_ids;
	}

	/**
	 * Restore reviewed parent relationships after a failed detach.
	 *
	 * @param int            $resource_id Parent Resource ID.
	 * @param array<int,int> $detach_ids  IDs that must belong to the parent again.
	 *
	 * @return WP_Error Conflict or high-severity compensation error.
	 */
	private function get_detach_failure_after_compensation( $resource_id, $detach_ids ) {
		global $wpdb;

		$placeholders = implode( ',', array_fill( 0, count( $detach_ids ), '%d' ) );
		$restore_sql  = "UPDATE {$wpdb->prefix}bookingtypes SET parent = %d WHERE parent = 0 AND booking_type_id IN ({$placeholders})";
		$values       = array_merge( array( absint( $resource_id ) ), $detach_ids );
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery -- Compensation is bounded to reviewed IDs still detached by this request.
		$wpdb->query( $wpdb->prepare( $restore_sql, $values ) );
		$verify_sql = "SELECT booking_type_id FROM {$wpdb->prefix}bookingtypes WHERE parent = %d AND booking_type_id IN ({$placeholders})";
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Verifies complete compensation.
		$restored_ids = array_map( 'absint', (array) $wpdb->get_col( $wpdb->prepare( $verify_sql, $values ) ) );
		sort( $restored_ids, SORT_NUMERIC );
		sort( $detach_ids, SORT_NUMERIC );
		if ( $restored_ids !== $detach_ids ) {
			return new WP_Error( 'wpbc_catalog_capacity_compensation_failed', __( 'The capacity change failed and could not be fully compensated. Contact an administrator before trying again.', 'booking' ) );
		}

		return new WP_Error( 'wpbc_catalog_capacity_detach_conflict', __( 'The selected unit relationship changed before it could be saved. Reload the catalog and review the capacity again.', 'booking' ) );
	}

	/**
	 * Remove only child rows created by the failed request and verify cleanup.
	 *
	 * @param array<int,int> $created_ids Inserted Resource IDs.
	 *
	 * @return bool True when every inserted row and presentation option is gone.
	 */
	private function rollback_created_units( $created_ids ) {
		global $wpdb;

		$compensated = true;
		foreach ( array_map( 'absint', $created_ids ) as $created_id ) {
			if ( ! $created_id ) {
				continue;
			}
			$content_deleted = $this->content_store->delete( $created_id );
			if ( is_wp_error( $content_deleted ) ) {
				$compensated = false;
			}
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Removes only a row inserted by this request.
			$wpdb->delete( $wpdb->prefix . 'bookingtypes', array( 'booking_type_id' => $created_id ), array( '%d' ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Verifies compensation for this exact inserted ID.
			$row_exists = $wpdb->get_var( $wpdb->prepare( "SELECT booking_type_id FROM {$wpdb->prefix}bookingtypes WHERE booking_type_id = %d", $created_id ) );
			if ( null !== $row_exists || false !== get_option( WPBC_Catalog_Booking_Resources_Repository::CONTENT_OPTION_PREFIX . $created_id, false ) ) {
				$compensated = false;
			}
		}

		return $compensated;
	}

	/**
	 * Verify the complete direct-child structure after a reviewed mutation.
	 *
	 * This closes the race between preview revalidation and persistence without
	 * relying on a transactional storage engine. Unexpected concurrent children
	 * cause the request-local mutation to be compensated and rejected.
	 *
	 * @param int              $resource_id       Parent Resource ID.
	 * @param array<int,mixed> $expected_child_ids Expected direct-child IDs.
	 *
	 * @return bool True when canonical children exactly match the expectation.
	 */
	private function has_expected_children( $resource_id, $expected_child_ids ) {
		global $wpdb;

		$expected_child_ids = array_values( array_filter( array_map( 'absint', $expected_child_ids ) ) );
		sort( $expected_child_ids, SORT_NUMERIC );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Final bounded structural verification for compensation safety.
		$current_child_ids = array_map( 'absint', (array) $wpdb->get_col( $wpdb->prepare( "SELECT booking_type_id FROM {$wpdb->prefix}bookingtypes WHERE parent = %d ORDER BY booking_type_id ASC", absint( $resource_id ) ) ) );

		return $expected_child_ids === $current_child_ids;
	}

	/**
	 * Return the client-safe portion of a private plan.
	 *
	 * @param array<string,mixed> $plan Internal plan.
	 *
	 * @return array<string,mixed> Public structural review.
	 */
	private function prepare_public_plan( $plan ) {
		return array(
			'resource_id'      => absint( $plan['resource_id'] ),
			'title'            => wp_strip_all_tags( (string) $plan['title'] ),
			'current_capacity' => absint( $plan['current_capacity'] ),
			'target_capacity'  => absint( $plan['target_capacity'] ),
			'operation'        => sanitize_key( $plan['operation'] ),
			'decrease_action'  => sanitize_key( $plan['decrease_action'] ),
			'create_count'     => absint( $plan['create_count'] ),
			'create_resources' => array_map(
				static function ( $resource ) {
					return array(
						'title'       => wp_strip_all_tags( (string) $resource['title'] ),
						'picture_url' => isset( $resource['picture_url'] ) ? esc_url_raw( (string) $resource['picture_url'] ) : '',
					);
				},
				$plan['create_resources']
			),
			'detach_resources' => $this->prepare_children( $plan['detach_resources'] ),
			'delete_has_bookings' => ! empty( $plan['delete_review']['has_bookings'] ),
		);
	}

	/**
	 * Return quota-aware additional units permitted for the current account.
	 *
	 * @param int $current_capacity Current root plus child count.
	 *
	 * @return int Allowed new child count.
	 */
	private function get_maximum_additional_units( $current_capacity ) {
		$hard_limit = max( 0, self::MAX_CAPACITY - absint( $current_capacity ) );
		$allowed    = (int) apply_filters( 'wpbc_check_max_allowed_booking_resources', $hard_limit );

		return min( $hard_limit, max( 0, $allowed ) );
	}

	/**
	 * Generate a unique bounded child title.
	 *
	 * @param string            $root_title  Canonical root title.
	 * @param array<int,string> $used_titles Existing/generated titles by reference.
	 * @param int               $next_unit   Next suffix by reference.
	 *
	 * @return string Unique child title.
	 */
	private function get_unique_unit_title( $root_title, &$used_titles, &$next_unit ) {
		$root_title = wp_strip_all_tags( (string) $root_title );
		do {
			$suffix = sprintf(
				/* translators: %s: Sequential child-unit number. */
				__( ' - Unit %s', 'booking' ),
				number_format_i18n( $next_unit )
			);
			$maximum_root_length = max( 1, 200 - $this->get_text_length( $suffix ) );
			$bounded_root        = function_exists( 'mb_substr' ) ? mb_substr( $root_title, 0, $maximum_root_length ) : substr( $root_title, 0, $maximum_root_length );
			$unit_title          = $bounded_root . $suffix;
			++$next_unit;
		} while ( in_array( $unit_title, $used_titles, true ) );
		$used_titles[] = $unit_title;

		return $unit_title;
	}

	/**
	 * Return the next stable priority following the current group.
	 *
	 * @param array<string,mixed>            $root_resource Root Resource.
	 * @param array<int,array<string,mixed>> $children      Current children.
	 *
	 * @return int Next non-negative priority.
	 */
	private function get_next_priority( $root_resource, $children ) {
		$priorities = array( isset( $root_resource['priority'] ) ? absint( $root_resource['priority'] ) : 0 );
		foreach ( $children as $child_resource ) {
			$priorities[] = isset( $child_resource['priority'] ) ? absint( $child_resource['priority'] ) : 0;
		}

		return min( 2147483646, max( $priorities ) + 1 );
	}

	/**
	 * Normalize a strict positive whole-number capacity.
	 *
	 * @param mixed $target_capacity Untrusted value.
	 *
	 * @return int|WP_Error Capacity or validation error.
	 */
	private function normalize_target_capacity( $target_capacity ) {
		if ( ! is_scalar( $target_capacity ) || ! preg_match( '/^\d+$/', (string) $target_capacity ) ) {
			return new WP_Error( 'wpbc_catalog_capacity_invalid', __( 'Choose a valid whole-number capacity.', 'booking' ) );
		}

		return absint( $target_capacity );
	}

	/**
	 * Normalize unique positive Resource IDs.
	 *
	 * @param array<int,mixed> $resource_ids Untrusted IDs.
	 *
	 * @return array<int,int> Normalized IDs.
	 */
	private function normalize_resource_ids( $resource_ids ) {
		$normalized_ids = array();
		foreach ( is_array( $resource_ids ) ? $resource_ids : array() as $resource_id ) {
			$resource_id = absint( $resource_id );
			if ( $resource_id ) {
				$normalized_ids[ $resource_id ] = $resource_id;
			}
		}

		return array_values( $normalized_ids );
	}

	/**
	 * Return a text length without requiring mbstring.
	 *
	 * @param string $text Text to measure.
	 *
	 * @return int Character or byte length.
	 */
	private function get_text_length( $text ) {
		return function_exists( 'mb_strlen' ) ? mb_strlen( (string) $text ) : strlen( (string) $text );
	}

	/**
	 * Sign the exact hierarchy and inherited values used by a review.
	 *
	 * @param array<string,mixed> $plan Current operation plan.
	 *
	 * @return string Request-bound review token.
	 */
	private function create_review_token( $plan ) {
		$child_context = array();
		foreach ( $plan['children'] as $child_resource ) {
			$child_context[] = array(
				'id'        => absint( $child_resource['id'] ),
				'parent_id' => isset( $child_resource['parent_id'] ) ? absint( $child_resource['parent_id'] ) : 0,
				'title'     => isset( $child_resource['title'] ) ? (string) $child_resource['title'] : '',
				'priority'  => isset( $child_resource['priority'] ) ? absint( $child_resource['priority'] ) : 0,
			);
		}
		$root_resource = $plan['root_resource'];
		$token_context = array(
			'user_id'          => get_current_user_id(),
			'resource_id'      => absint( $plan['resource_id'] ),
			'current_capacity' => absint( $plan['current_capacity'] ),
			'target_capacity'  => absint( $plan['target_capacity'] ),
			'operation'        => sanitize_key( $plan['operation'] ),
			'decrease_action'  => sanitize_key( $plan['decrease_action'] ),
			'detach_ids'       => array_values( array_map( 'absint', $plan['detach_ids'] ) ),
			'delete_review_token' => isset( $plan['delete_review']['review_token'] ) ? (string) $plan['delete_review']['review_token'] : '',
			'create_titles'     => wp_list_pluck( $plan['create_resources'], 'title' ),
			'root'              => array(
				'title'        => isset( $root_resource['title'] ) ? (string) $root_resource['title'] : '',
				'description'  => isset( $root_resource['description'] ) ? (string) $root_resource['description'] : '',
				'picture_url'  => isset( $root_resource['picture_url'] ) ? (string) $root_resource['picture_url'] : '',
				'cost'         => isset( $root_resource['cost'] ) ? (string) $root_resource['cost'] : '',
				'default_form' => isset( $root_resource['default_form'] ) ? (string) $root_resource['default_form'] : '',
				'owner_user_id' => isset( $root_resource['owner_user_id'] ) ? absint( $root_resource['owner_user_id'] ) : 0,
			),
			'children'          => $child_context,
		);

		return wp_hash( wp_json_encode( $token_context ), 'nonce' );
	}
}
