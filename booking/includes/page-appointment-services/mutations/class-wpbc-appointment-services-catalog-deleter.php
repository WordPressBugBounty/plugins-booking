<?php
/**
 * Independent reviewed deletion service for the Appointment Services catalog.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build and apply site-bound Service deletion plans without the legacy editor.
 */
final class WPBC_Appointment_Services_Catalog_Deleter {

	/** Maximum number of Services accepted by one reviewed deletion. */
	const MAX_SELECTION = 100;

	/** Maximum signed deletion-review lifetime in seconds. */
	const REVIEW_LIFETIME = 600;

	/** @var object Service data provider. */
	private $repository;

	/**
	 * Set the Service repository used by deletion preview and apply.
	 *
	 * @param object|null $repository Optional provider for tests or integrations.
	 */
	public function __construct( $repository = null ) {
		$this->repository = $repository ? $repository : wpbc_appointment_services_get_data_provider();
	}

	/**
	 * Build a signed, non-mutating permanent-deletion review.
	 *
	 * @param mixed $service_ids Requested Service IDs.
	 *
	 * @return array<string,mixed>|WP_Error Review DTO, signed plan, and policy state.
	 */
	public function preview( $service_ids ) {
		$authorization = $this->get_authorization_error();
		if ( is_wp_error( $authorization ) ) {
			return $authorization;
		}

		$before_images = $this->load_selected_before_images( $service_ids );
		if ( is_wp_error( $before_images ) ) {
			return $before_images;
		}

		$review_items = array();
		$plan_items   = array();
		$can_apply    = true;
		$impacts      = $this->repository->get_deletion_impacts( array_keys( $before_images ), $before_images );
		if ( is_wp_error( $impacts ) ) {
			return $impacts;
		}
		foreach ( $before_images as $service_id => $before_image ) {
			$impact = $impacts[ $service_id ];

			$notes = $this->get_impact_notes( $impact );
			$item_can_apply = ! empty( $impact['is_complete'] )
				&& empty( $impact['appointment_count'] )
				&& empty( $impact['post_reference_count'] );
			$can_apply = $can_apply && $item_can_apply;
			$review_items[] = array(
				'id'        => $service_id,
				'title'     => sanitize_text_field( (string) $before_image['service']['title'] ),
				'notes'     => $notes,
				'actions'   => $this->get_impact_actions( $service_id, $impact ),
				'can_apply' => $item_can_apply,
			);
			$plan_items[] = array(
				'id'       => $service_id,
				'snapshot' => $this->deletion_snapshot_hash( $before_image, $impact ),
			);
		}

		$selection_count = count( $review_items );
		$i18n             = $this->get_delete_review_i18n( $selection_count );
		$warning          = $can_apply
			? _n( 'This permanently removes the selected Service and its Provider assignments. This action cannot be undone.', 'This permanently removes the selected Services and their Provider assignments. This action cannot be undone.', $selection_count, 'booking' )
			: __( 'Deletion is blocked because one or more selected Services are referenced by Appointments or saved page configuration. Archive the Service or remove those references first, then review deletion again.', 'booking' );
		$plan             = array(
			'version'    => 1,
			'mode'       => 'delete',
			'site_id'    => get_current_blog_id(),
			'user_id'    => get_current_user_id(),
			'expires_at' => time() + self::REVIEW_LIFETIME,
			'services'   => $plan_items,
		);

		return array(
			'delete_review' => array(
				'items'           => $review_items,
				'selection_count' => $selection_count,
				'can_apply'       => $can_apply,
				'warning'         => $warning,
				'i18n'            => $i18n,
			),
			'plan'          => $plan,
			'token'         => $this->sign_plan( $plan ),
			'can_apply'     => $can_apply,
			'warning'       => $warning,
		);
	}

	/**
	 * Apply a signed deletion after complete apply-time authorization and impact revalidation.
	 *
	 * @param mixed  $plan  Signed plan returned by preview().
	 * @param string $token Submitted HMAC token.
	 *
	 * @return array<string,mixed>|WP_Error Deleted IDs or a safe error.
	 */
	public function apply( $plan, $token ) {
		$authorization = $this->get_authorization_error();
		if ( is_wp_error( $authorization ) ) {
			return $authorization;
		}

		$plan  = is_array( $plan ) ? $plan : array();
		$token = is_scalar( $token ) ? (string) $token : '';
		if ( ! $this->is_valid_plan_envelope( $plan, $token ) ) {
			return new WP_Error( 'wpbc_service_invalid_delete_review', __( 'This Service deletion review is invalid or has expired. Review it again.', 'booking' ) );
		}

		$service_ids   = wp_list_pluck( $plan['services'], 'id' );
		$before_images = $this->load_selected_before_images( $service_ids );
		if ( is_wp_error( $before_images ) ) {
			return $before_images;
		}
		$impacts = $this->repository->get_deletion_impacts( $service_ids, $before_images );
		if ( is_wp_error( $impacts ) ) {
			return $impacts;
		}

		foreach ( $plan['services'] as $service_plan ) {
			$service_id = absint( $service_plan['id'] );
			$impact     = $impacts[ $service_id ];
			if ( empty( $impact['is_complete'] ) ) {
				return new WP_Error( 'wpbc_service_delete_audit_incomplete', __( 'This Service cannot be deleted until all references can be audited safely.', 'booking' ) );
			}
			if ( ! empty( $impact['appointment_count'] ) || ! empty( $impact['post_reference_count'] ) ) {
				return new WP_Error( 'wpbc_service_delete_referenced', __( 'This Service is referenced and cannot be permanently deleted.', 'booking' ) );
			}
			if ( empty( $service_plan['snapshot'] ) || ! hash_equals( (string) $service_plan['snapshot'], $this->deletion_snapshot_hash( $before_images[ $service_id ], $impact ) ) ) {
				return new WP_Error( 'wpbc_service_stale_delete_review', __( 'A selected Service or one of its references changed after review. Review the deletion again.', 'booking' ) );
			}
		}

		$transaction_started = $this->repository->begin_transaction();
		$deleted_ids         = array();
		foreach ( $plan['services'] as $service_plan ) {
			$service_id = absint( $service_plan['id'] );
			$result     = $this->repository->compare_and_delete_service( $before_images[ $service_id ] );
			if ( is_wp_error( $result ) ) {
				if ( $transaction_started ) {
					$this->repository->rollback_transaction();
				}
				$compensation = $this->compensate_deleted_services( $deleted_ids, $before_images );
				return is_wp_error( $compensation ) ? $compensation : $result;
			}
			$deleted_ids[] = $service_id;
		}

		if ( $transaction_started && ! $this->repository->commit_transaction() ) {
			$this->repository->rollback_transaction();
			$compensation = $this->compensate_deleted_services( $deleted_ids, $before_images );
			return is_wp_error( $compensation ) ? $compensation : new WP_Error( 'wpbc_service_delete_failed', __( 'The Service deletion could not be committed.', 'booking' ) );
		}

		do_action( 'wpbc_appointment_services_deleted', $deleted_ids, $before_images, get_current_user_id(), get_current_blog_id() );

		return array(
			'deleted_ids'   => array_values( array_map( 'absint', $deleted_ids ) ),
			'deleted_count' => count( $deleted_ids ),
		);
	}

	/**
	 * Return localized labels for the domain-owned delete-review template.
	 *
	 * @param int $selection_count Number of Services in the reviewed batch.
	 *
	 * @return array<string,string> Localized labels.
	 */
	private function get_delete_review_i18n( $selection_count ) {
		$selection_count = max( 1, absint( $selection_count ) );

		return array(
			'title'           => _n( 'Delete Service', 'Delete Services', $selection_count, 'booking' ),
			'selection_label' => sprintf(
				/* translators: %s: Number of selected Services. */
				_n( '%s Service selected', '%s Services selected', $selection_count, 'booking' ),
				number_format_i18n( $selection_count )
			),
			'description'     => _n( 'Review this permanent action and its reference impact before deleting the selected Service.', 'Review this permanent action and its reference impact before deleting the selected Services.', $selection_count, 'booking' ),
			'pending_message' => _n( 'No Service will change until you choose Delete Service.', 'No Service will change until you choose Delete Services.', $selection_count, 'booking' ),
			'items_heading'   => _n( 'Service to be permanently deleted', 'Services to be permanently deleted', $selection_count, 'booking' ),
			'acknowledgement' => _n( 'I understand that this Service will be permanently deleted.', 'I understand that these Services will be permanently deleted.', $selection_count, 'booking' ),
			'delete_button'   => sprintf(
				/* translators: %s: Number of Services to delete. */
				_n( 'Delete %s Service', 'Delete %s Services', $selection_count, 'booking' ),
				number_format_i18n( $selection_count )
			),
			'id_label'        => __( 'Service ID', 'booking' ),
			'actions_heading' => __( 'Open blocking references', 'booking' ),
		);
	}

	/**
	 * Build capability-aware direct links for one Service impact audit.
	 *
	 * @param int                 $service_id Service ID.
	 * @param array<string,mixed> $impact     Current reference audit.
	 *
	 * @return array<int,array<string,string>> Authorized blocker actions.
	 */
	private function get_impact_actions( $service_id, $impact ) {
		$actions           = array();
		$appointment_count = isset( $impact['appointment_count'] ) ? absint( $impact['appointment_count'] ) : 0;

		if ( $appointment_count && $this->current_user_can_view_bookings() && function_exists( 'wpbc_get_bookings_url' ) ) {
			$actions[] = array(
				'label'       => sprintf(
					/* translators: %s: Number of blocking Appointments. */
					_n( 'View %s blocking Appointment', 'View %s blocking Appointments', $appointment_count, 'booking' ),
					number_format_i18n( $appointment_count )
				),
				'url'         => esc_url_raw(
					add_query_arg(
						array(
							'tab'                    => 'vm_booking_listing',
							'wh_appointment_service' => absint( $service_id ),
							'overwrite'              => 1,
						),
						wpbc_get_bookings_url( true, false )
					)
				),
				'description' => __( 'Review the Appointment records that retain this Service snapshot. Archive the Service unless that history can be removed safely.', 'booking' ),
			);
		}

		foreach ( isset( $impact['post_references'] ) && is_array( $impact['post_references'] ) ? $impact['post_references'] : array() as $post_reference ) {
			$post_id = isset( $post_reference['id'] ) ? absint( $post_reference['id'] ) : 0;
			if ( ! $post_id || ! current_user_can( 'edit_post', $post_id ) ) {
				continue;
			}
			$edit_url = get_edit_post_link( $post_id, 'raw' );
			if ( ! $edit_url ) {
				continue;
			}
			$post_title = isset( $post_reference['title'] ) ? sanitize_text_field( (string) $post_reference['title'] ) : '';
			if ( '' === $post_title ) {
				$post_title = sprintf( __( 'Untitled content #%s', 'booking' ), number_format_i18n( $post_id ) );
			}
			$actions[] = array(
				'label'       => sprintf( __( 'Edit saved content: %s', 'booking' ), $post_title ),
				'url'         => esc_url_raw( $edit_url ),
				'description' => __( 'Remove or change the Appointment Service restriction in this saved content.', 'booking' ),
			);
		}

		return $actions;
	}

	/**
	 * Check the configured Booking Listing role using hierarchical capabilities.
	 *
	 * @return bool True when the current user can open the Bookings listing.
	 */
	private function current_user_can_view_bookings() {
		$minimum_role = sanitize_key( (string) get_bk_option( 'booking_user_role_booking' ) );
		if ( '' === $minimum_role ) {
			return false;
		}
		if ( function_exists( 'wpbc_is_current_user_have_this_role' ) ) {
			return wpbc_is_current_user_have_this_role( $minimum_role );
		}

		$capabilities = array(
			'administrator' => 'activate_plugins',
			'editor'        => 'publish_pages',
			'author'        => 'publish_posts',
			'contributor'   => 'edit_posts',
			'subscriber'    => 'read',
		);

		return isset( $capabilities[ $minimum_role ] ) && current_user_can( $capabilities[ $minimum_role ] );
	}

	/**
	 * Convert one reference audit into authorized review notes.
	 *
	 * @param array<string,mixed> $impact Reference audit.
	 *
	 * @return array<int,string> Plain localized notes.
	 */
	private function get_impact_notes( $impact ) {
		$notes = array();
		$assignment_count = absint( $impact['assignment_count'] );
		$appointment_count = absint( $impact['appointment_count'] );
		$post_reference_count = absint( $impact['post_reference_count'] );

		if ( $assignment_count ) {
			$notes[] = sprintf(
				/* translators: %s: Number of Provider assignments. */
				_n( '%s Provider assignment will also be removed.', '%s Provider assignments will also be removed.', $assignment_count, 'booking' ),
				number_format_i18n( $assignment_count )
			);
		} else {
			$notes[] = __( 'No Provider assignments.', 'booking' );
		}
		if ( $appointment_count ) {
			$notes[] = sprintf(
				/* translators: %s: Number of Appointment snapshots. */
				_n( '%s Appointment snapshot blocks deletion.', '%s Appointment snapshots block deletion.', $appointment_count, 'booking' ),
				number_format_i18n( $appointment_count )
			);
		}
		if ( $post_reference_count ) {
			$notes[] = sprintf(
				/* translators: %s: Number of saved page references. */
				_n( '%s saved page configuration blocks deletion.', '%s saved page configurations block deletion.', $post_reference_count, 'booking' ),
				number_format_i18n( $post_reference_count )
			);
		}

		return $notes;
	}

	/**
	 * Load authorized deletion before-images for a bounded selection.
	 *
	 * @param mixed $service_ids Requested IDs.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Before-images keyed by Service ID.
	 */
	private function load_selected_before_images( $service_ids ) {
		$service_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $service_ids ) ) ) );
		if ( empty( $service_ids ) || self::MAX_SELECTION < count( $service_ids ) ) {
			return new WP_Error( 'wpbc_service_invalid_delete_selection', __( 'Select between 1 and 100 Services.', 'booking' ) );
		}

		$before_images = array();
		foreach ( $service_ids as $service_id ) {
			$before_image = $this->repository->get_deletion_before_image( $service_id );
			if ( is_wp_error( $before_image ) ) {
				return $before_image;
			}
			$before_images[ $service_id ] = $before_image;
		}

		return $before_images;
	}

	/**
	 * Return an authorization or storage-contract error when deletion is unavailable.
	 *
	 * @return true|WP_Error True when available, otherwise an error.
	 */
	private function get_authorization_error() {
		if ( ! current_user_can( wpbc_appointment_services_get_manage_capability() ) ) {
			return new WP_Error( 'wpbc_service_delete_forbidden', __( 'You are not allowed to delete Services.', 'booking' ) );
		}
		$required_methods = array( 'get_deletion_before_image', 'get_deletion_impacts', 'begin_transaction', 'commit_transaction', 'rollback_transaction', 'compare_and_delete_service', 'restore_deleted_service' );
		if ( ! is_object( $this->repository ) ) {
			return wpbc_appointment_services_storage_error();
		}
		foreach ( $required_methods as $required_method ) {
			if ( ! method_exists( $this->repository, $required_method ) ) {
				return new WP_Error( 'wpbc_service_delete_unsupported_storage', __( 'Permanent deletion is unavailable for the configured Service storage provider.', 'booking' ) );
			}
		}

		return true;
	}

	/**
	 * Hash canonical storage and reference impact for stale-review detection.
	 *
	 * @param array<string,mixed> $before_image Canonical Service and assignment rows.
	 * @param array<string,mixed> $impact       Complete reference audit.
	 *
	 * @return string SHA-256 snapshot hash.
	 */
	private function deletion_snapshot_hash( $before_image, $impact ) {
		return hash( 'sha256', wp_json_encode( array( 'before' => $before_image, 'impact' => $impact ) ) );
	}

	/**
	 * Sign one site- and user-bound deletion plan.
	 *
	 * @param array<string,mixed> $plan Deletion plan.
	 *
	 * @return string HMAC signature.
	 */
	private function sign_plan( $plan ) {
		return hash_hmac( 'sha256', wp_json_encode( $plan ), wp_salt( 'nonce' ) );
	}

	/**
	 * Validate a signed deletion plan envelope and bounded shape.
	 *
	 * @param array<string,mixed> $plan  Submitted plan.
	 * @param string              $token Submitted signature.
	 *
	 * @return bool True when authentic, current, and site/user bound.
	 */
	private function is_valid_plan_envelope( $plan, $token ) {
		return '' !== $token
			&& isset( $plan['version'], $plan['mode'], $plan['site_id'], $plan['user_id'], $plan['expires_at'], $plan['services'] )
			&& 1 === absint( $plan['version'] )
			&& 'delete' === $plan['mode']
			&& get_current_blog_id() === absint( $plan['site_id'] )
			&& get_current_user_id() === absint( $plan['user_id'] )
			&& time() <= absint( $plan['expires_at'] )
			&& is_array( $plan['services'] )
			&& ! empty( $plan['services'] )
			&& self::MAX_SELECTION >= count( $plan['services'] )
			&& hash_equals( $this->sign_plan( $plan ), $token );
	}

	/**
	 * Restore before-images for Services deleted before a batch failure.
	 *
	 * @param array<int,int>                 $deleted_ids   Deleted Service IDs.
	 * @param array<int,array<string,mixed>> $before_images Before-images keyed by ID.
	 *
	 * @return true|WP_Error True when restored, otherwise a compensation error.
	 */
	private function compensate_deleted_services( $deleted_ids, $before_images ) {
		foreach ( array_reverse( $deleted_ids ) as $service_id ) {
			$result = $this->repository->restore_deleted_service( $before_images[ $service_id ] );
			if ( is_wp_error( $result ) ) {
				return new WP_Error( 'wpbc_service_delete_compensation_failed', __( 'The Service deletion was interrupted and could not be fully restored. Restore the affected Services from a database backup.', 'booking' ) );
			}
		}

		return true;
	}
}
