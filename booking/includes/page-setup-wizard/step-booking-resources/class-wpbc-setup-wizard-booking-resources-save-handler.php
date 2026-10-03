<?php
/**
 * Progressive save handler for Setup Wizard Booking Resources.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Create new Resources and update authorized existing Resources for full-day setup.
 *
 * Canonical domain mutation services retain responsibility for storage, hooks,
 * edition rules, and cache invalidation. This handler composes those mutations
 * with effective-owner checks, stale-write protection, bounded retry recovery,
 * and compensation when a later mutation or checkpoint write fails.
 */
final class WPBC_Setup_Wizard_Booking_Resources_Save_Handler implements WPBC_Setup_Wizard_Step_Save_Handler {

	const MAX_JOURNAL_OPERATIONS = 20;

	/** @var WPBC_Setup_Wizard_Booking_Resources */
	private $booking_resources;

	/**
	 * Build the handler around the Resource validation service.
	 *
	 * @param WPBC_Setup_Wizard_Booking_Resources|null $booking_resources Optional service for tests.
	 */
	public function __construct( $booking_resources = null ) {
		$this->booking_resources = $booking_resources instanceof WPBC_Setup_Wizard_Booking_Resources ? $booking_resources : new WPBC_Setup_Wizard_Booking_Resources();
	}

	/** @return string Stable step ID. */
	public function get_step_id() {
		return 'booking_resources';
	}

	/**
	 * Return the server-owned action label.
	 *
	 * @param array<string,mixed> $checkpoint   Current checkpoint.
	 * @param array<string,mixed> $step_context Authorized context.
	 *
	 * @return string Translated action label.
	 */
	public function get_primary_action_label( array $checkpoint, array $step_context = array() ) {
		unset( $checkpoint, $step_context );

		return __( 'Save booking resources & continue', 'booking' );
	}

	/**
	 * Persist validated Resource updates and drafts exactly once.
	 *
	 * @param array<string,mixed> $validated_fields Validated current-step fields.
	 * @param array<string,mixed> $checkpoint       Current checkpoint.
	 * @param array<string,mixed> $operation_context Stable operation metadata.
	 *
	 * @return array<string,mixed>|WP_Error Normalized result or error.
	 */
	public function save( array $validated_fields, array $checkpoint, array $operation_context ) {
		$journey_id = isset( $checkpoint['values']['customer_journey']['customer_journey'] )
			? sanitize_key( (string) $checkpoint['values']['customer_journey']['customer_journey'] )
			: '';
		if ( ! WPBC_Setup_Wizard_Customer_Journey_Policy::uses_booking_resources_configuration( $journey_id ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resources_route_invalid', __( 'Booking Resources are not part of the selected Customer Journey.', 'booking' ) );
		}

		$resource_drafts  = isset( $validated_fields['booking_resources'] ) && is_array( $validated_fields['booking_resources'] ) ? $validated_fields['booking_resources'] : array();
		$resource_updates = isset( $validated_fields['existing_booking_resources'] ) && is_array( $validated_fields['existing_booking_resources'] ) ? $validated_fields['existing_booking_resources'] : array();
		if ( ! class_exists( 'wpdev_bk_personal' ) && ! empty( $resource_drafts ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resources_paid_required', __( 'Additional Booking Resources are available in Pro versions.', 'booking' ) );
		}

		if (
			! class_exists( 'WPBC_Catalog_Booking_Resource_Updater' )
			|| ! class_exists( 'WPBC_Catalog_Booking_Resources_Repository' )
			|| ( ! empty( $resource_drafts ) && ! class_exists( 'WPBC_Catalog_Booking_Resource_Creator' ) )
			|| ! function_exists( 'wpbc_catalog_booking_resources_get_manage_capability' )
		) {
			return new WP_Error( 'wpbc_setup_wizard_resources_domain_unavailable', __( 'Booking Resources are temporarily unavailable. Restore a complete Booking Calendar package and try again.', 'booking' ) );
		}
		if ( ! current_user_can( wpbc_catalog_booking_resources_get_manage_capability() ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resources_forbidden', __( 'You are not allowed to manage Booking Resources.', 'booking' ) );
		}
		if ( empty( $resource_drafts ) && empty( $resource_updates ) ) {
			return $this->create_result( array(), array(), array(), false );
		}

		$operation_id = isset( $operation_context['operation_id'] ) ? sanitize_key( (string) $operation_context['operation_id'] ) : '';
		if ( '' === $operation_id ) {
			return new WP_Error( 'wpbc_setup_wizard_resources_operation_invalid', __( 'The Booking Resource save operation is invalid. Reload the page and try again.', 'booking' ) );
		}

		$creator               = ! empty( $resource_drafts ) ? new WPBC_Catalog_Booking_Resource_Creator() : null;
		$updater               = new WPBC_Catalog_Booking_Resource_Updater();
		$repository            = new WPBC_Catalog_Booking_Resources_Repository();
		$journal_option_name   = $this->get_journal_option_name();
		$journal_before        = get_option( $journal_option_name, false );
		$journal               = is_array( $journal_before ) ? $journal_before : array();
		$retry_key             = $this->get_retry_key( $resource_drafts, $resource_updates, $operation_context );
		$operation_record      = isset( $journal[ $retry_key ] ) && is_array( $journal[ $retry_key ] ) ? $journal[ $retry_key ] : array();
		$resource_mappings     = isset( $operation_record['resources'] ) && is_array( $operation_record['resources'] ) ? $operation_record['resources'] : array();
		$update_mappings       = isset( $operation_record['updates'] ) && is_array( $operation_record['updates'] ) ? $operation_record['updates'] : array();
		$created_this_request  = array();
		$updated_before_images = array();
		$saved_resources       = array();
		$updated_ids           = array();

		foreach ( $resource_updates as $resource_update ) {
			$resource_id        = absint( $resource_update['resource_id'] );
			$current_resource   = $this->get_current_owner_resource( $repository, $resource_id );
			$target_fingerprint = $this->booking_resources->get_editable_resource_fields_fingerprint( $resource_update );
			if ( is_wp_error( $current_resource ) ) {
				return $this->compensate_error( $current_resource, $creator, $updater, $created_this_request, $updated_before_images, $journal_option_name, $journal_before );
			}

			$current_fingerprint = $this->booking_resources->get_existing_resource_fingerprint( $current_resource );
			$journal_fingerprint = isset( $update_mappings[ $resource_id ] ) && is_scalar( $update_mappings[ $resource_id ] ) ? (string) $update_mappings[ $resource_id ] : '';
			if ( $target_fingerprint === $journal_fingerprint && $target_fingerprint === $current_fingerprint ) {
				$saved_resources[] = $this->get_saved_resource_fingerprint_value( $current_resource );
				$updated_ids[]      = $resource_id;
				continue;
			}
			if ( ! hash_equals( (string) $resource_update['source_fingerprint'], $current_fingerprint ) ) {
				$stale_error = new WP_Error( 'wpbc_setup_wizard_resource_update_stale', __( 'A Booking Resource changed after this step was opened. Reload the step before saving your changes.', 'booking' ) );

				return $this->compensate_error( $stale_error, $creator, $updater, $created_this_request, $updated_before_images, $journal_option_name, $journal_before );
			}

			$updated_before_images[] = array(
				'resource_id' => $resource_id,
				'fields'      => $this->booking_resources->get_existing_resource_editable_fields( $current_resource ),
			);
			$updated_resource = $updater->update( $resource_id, $this->get_updater_fields( $resource_update ) );
			if ( is_wp_error( $updated_resource ) || ! is_array( $updated_resource ) ) {
				$update_error = is_wp_error( $updated_resource ) ? $updated_resource : new WP_Error( 'wpbc_setup_wizard_resource_update_failed', __( 'The Booking Resource could not be updated.', 'booking' ) );

				return $this->compensate_error( $update_error, $creator, $updater, $created_this_request, $updated_before_images, $journal_option_name, $journal_before );
			}
			$updated_resource_fingerprint = $this->booking_resources->get_existing_resource_fingerprint( $updated_resource );
			if ( ! hash_equals( $target_fingerprint, $updated_resource_fingerprint ) ) {
				$verification_error = new WP_Error( 'wpbc_setup_wizard_resource_update_unverified', __( 'The Booking Resource update could not be verified.', 'booking' ) );

				return $this->compensate_error( $verification_error, $creator, $updater, $created_this_request, $updated_before_images, $journal_option_name, $journal_before );
			}

			$update_mappings[ $resource_id ] = $target_fingerprint;
			$journal[ $retry_key ]           = $this->build_operation_record( $operation_id, $resource_mappings, $update_mappings );
			if ( ! $this->save_journal( $journal_option_name, $journal ) ) {
				$journal_error = new WP_Error( 'wpbc_setup_wizard_resource_journal_failed', __( 'The Booking Resource retry state could not be saved. No changes were retained.', 'booking' ) );

				return $this->compensate_error( $journal_error, $creator, $updater, $created_this_request, $updated_before_images, $journal_option_name, $journal_before );
			}
			$saved_resources[] = $this->get_saved_resource_fingerprint_value( $updated_resource );
			$updated_ids[]      = $resource_id;
		}

		foreach ( $resource_drafts as $resource_draft ) {
			$draft_id    = sanitize_key( (string) $resource_draft['draft_id'] );
			$resource_id = isset( $resource_mappings[ $draft_id ] ) ? absint( $resource_mappings[ $draft_id ] ) : 0;
			if ( $resource_id ) {
				$saved_resource = $this->get_current_owner_resource( $repository, $resource_id );
				if ( is_wp_error( $saved_resource ) ) {
					return $this->compensate_error( $saved_resource, $creator, $updater, $created_this_request, $updated_before_images, $journal_option_name, $journal_before );
				}
			} else {
				$storage_context = WPBC_Setup_Wizard_Access::get_storage_context();
				$created         = $creator->create(
					array(
						'title'         => $resource_draft['title'],
						'description'   => $resource_draft['description'],
						'picture_url'   => $resource_draft['picture_url'],
						'quantity'      => 1,
						'creation_mode' => 'independent',
						'base_cost'     => $resource_draft['base_cost'],
						'owner_user_id' => absint( $storage_context['owner_user_id'] ),
					)
				);
				if ( is_wp_error( $created ) || empty( $created['resource_ids'][0] ) ) {
					$create_error = is_wp_error( $created ) ? $created : new WP_Error( 'wpbc_setup_wizard_resource_create_failed', __( 'The Booking Resource could not be created.', 'booking' ) );

					return $this->compensate_error( $create_error, $creator, $updater, $created_this_request, $updated_before_images, $journal_option_name, $journal_before );
				}
				$resource_id                    = absint( $created['resource_ids'][0] );
				$created_this_request[]         = $resource_id;
				$resource_mappings[ $draft_id ] = $resource_id;
				$journal[ $retry_key ]           = $this->build_operation_record( $operation_id, $resource_mappings, $update_mappings );
				if ( ! $this->save_journal( $journal_option_name, $journal ) ) {
					$journal_error = new WP_Error( 'wpbc_setup_wizard_resource_journal_failed', __( 'The Booking Resource retry state could not be saved. No changes were retained.', 'booking' ) );

					return $this->compensate_error( $journal_error, $creator, $updater, $created_this_request, $updated_before_images, $journal_option_name, $journal_before );
				}
				$saved_resource = $this->get_current_owner_resource( $repository, $resource_id );
				if ( is_wp_error( $saved_resource ) ) {
					return $this->compensate_error( $saved_resource, $creator, $updater, $created_this_request, $updated_before_images, $journal_option_name, $journal_before );
				}
			}

			$saved_resources[] = $this->get_saved_resource_fingerprint_value( $saved_resource );
		}

		$created_ids = array();
		foreach ( $resource_mappings as $draft_id => $resource_id ) {
			$created_ids[] = 'resource:' . sanitize_key( $draft_id ) . ':' . absint( $resource_id );
		}

		return $this->create_result( $created_ids, array_values( array_unique( array_map( 'absint', $updated_ids ) ) ), $saved_resources, true );
	}

	/**
	 * Load one Resource and verify effective-owner scope.
	 *
	 * @param WPBC_Catalog_Booking_Resources_Repository $repository Canonical repository.
	 * @param int                                       $resource_id Resource ID.
	 *
	 * @return array<string,mixed>|WP_Error Authorized Resource or error.
	 */
	private function get_current_owner_resource( $repository, $resource_id ) {
		$resource = $repository->get_resource( $resource_id );
		if ( is_wp_error( $resource ) || ! is_array( $resource ) || empty( $resource['id'] ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_unavailable', __( 'A Booking Resource is no longer available. Reload the step and try again.', 'booking' ) );
		}
		if ( class_exists( 'wpdev_bk_multiuser' ) ) {
			$storage_context = WPBC_Setup_Wizard_Access::get_storage_context();
			if ( absint( $storage_context['owner_user_id'] ) !== absint( isset( $resource['owner_user_id'] ) ? $resource['owner_user_id'] : 0 ) ) {
				return new WP_Error( 'wpbc_setup_wizard_resource_owner_invalid', __( 'A Booking Resource does not belong to the current Booking Calendar owner.', 'booking' ) );
			}
		}

		return $resource;
	}

	/**
	 * Return only fields accepted by the canonical updater.
	 *
	 * @param array<string,mixed> $resource_update Validated update.
	 *
	 * @return array<string,string> Canonical updater fields.
	 */
	private function get_updater_fields( array $resource_update ) {
		return array(
			'title'       => (string) $resource_update['title'],
			'description' => (string) $resource_update['description'],
			'picture_url' => (string) $resource_update['picture_url'],
			'base_cost'   => (string) $resource_update['base_cost'],
		);
	}

	/**
	 * Build a minimal canonical result fingerprint value.
	 *
	 * @param array<string,mixed> $resource Canonical Resource.
	 *
	 * @return array<string,mixed> Non-sensitive fingerprint value.
	 */
	private function get_saved_resource_fingerprint_value( array $resource ) {
		return array(
			'id'          => absint( $resource['id'] ),
			'fingerprint' => $this->booking_resources->get_existing_resource_fingerprint( $resource ),
		);
	}

	/**
	 * Restore mutations and return either the original or compensation error.
	 *
	 * @param WP_Error                                     $original_error       Original safe error.
	 * @param WPBC_Catalog_Booking_Resource_Creator|null  $creator              Canonical creator when drafts exist.
	 * @param WPBC_Catalog_Booking_Resource_Updater       $updater              Canonical updater.
	 * @param int[]                                        $created_resource_ids Resources created by this request.
	 * @param array<int,array<string,mixed>>               $updated_before_images Existing values changed by this request.
	 * @param string                                       $journal_option_name  Owner-scoped option name.
	 * @param mixed                                        $journal_before       Original option value.
	 *
	 * @return WP_Error Safe error.
	 */
	private function compensate_error( $original_error, $creator, $updater, array $created_resource_ids, array $updated_before_images, $journal_option_name, $journal_before ) {
		$compensated = $this->compensate( $creator, $updater, $created_resource_ids, $updated_before_images, $journal_option_name, $journal_before );
		if ( is_wp_error( $compensated ) ) {
			return $compensated;
		}

		return $original_error;
	}

	/**
	 * Restore the journal, remove new Resources, and restore existing values.
	 *
	 * @param WPBC_Catalog_Booking_Resource_Creator|null $creator               Canonical creator when drafts exist.
	 * @param WPBC_Catalog_Booking_Resource_Updater      $updater               Canonical updater.
	 * @param int[]                                       $created_resource_ids  Resources created by this request.
	 * @param array<int,array<string,mixed>>              $updated_before_images Existing values changed by this request.
	 * @param string                                      $journal_option_name   Owner-scoped option name.
	 * @param mixed                                       $journal_before        Original option value.
	 *
	 * @return true|WP_Error True after compensation or a safe recovery error.
	 */
	private function compensate( $creator, $updater, array $created_resource_ids, array $updated_before_images, $journal_option_name, $journal_before ) {
		$compensation_failed = false;
		if ( $creator instanceof WPBC_Catalog_Booking_Resource_Creator ) {
			$created_resources_restored = $creator->compensate_created_resources( $created_resource_ids );
			if ( is_wp_error( $created_resources_restored ) ) {
				$compensation_failed = true;
			}
		}
		foreach ( array_reverse( $updated_before_images ) as $before_image ) {
			$restored = $updater->update( absint( $before_image['resource_id'] ), $before_image['fields'] );
			if (
				is_wp_error( $restored )
				|| ! is_array( $restored )
				|| ! hash_equals(
					$this->booking_resources->get_editable_resource_fields_fingerprint( $before_image['fields'] ),
					$this->booking_resources->get_existing_resource_fingerprint( $restored )
				)
			) {
				$compensation_failed = true;
			}
		}
		if ( false === $journal_before ) {
			delete_option( $journal_option_name );
			$journal_restored = false === get_option( $journal_option_name, false );
		} else {
			update_option( $journal_option_name, is_array( $journal_before ) ? $journal_before : array(), false );
			$journal_restored = get_option( $journal_option_name, false ) === ( is_array( $journal_before ) ? $journal_before : array() );
		}
		wp_cache_delete( $journal_option_name, 'options' );
		if ( ! $journal_restored || $compensation_failed ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_compensation_failed', __( 'A Booking Resource change could not be safely restored. Reload the page before making further changes.', 'booking' ) );
		}

		return true;
	}

	/**
	 * Return a site- and effective-owner-scoped operation journal option.
	 *
	 * @return string Safe option name.
	 */
	private function get_journal_option_name() {
		$storage_context = WPBC_Setup_Wizard_Access::get_storage_context();

		return 'wpbc_setup_resource_ops_' . absint( $storage_context['site_id'] ) . '_' . absint( $storage_context['owner_user_id'] );
	}

	/**
	 * Build a deterministic retry identity for one revision and complete payload.
	 *
	 * @param array<int,array<string,mixed>> $resource_drafts  Validated new drafts.
	 * @param array<int,array<string,mixed>> $resource_updates Validated existing updates.
	 * @param array<string,mixed>            $operation_context Progressive-save metadata.
	 *
	 * @return string Stable, non-customer-data journal key.
	 */
	private function get_retry_key( array $resource_drafts, array $resource_updates, array $operation_context ) {
		$expected_revision = isset( $operation_context['expected_revision'] ) ? (int) $operation_context['expected_revision'] : 0;
		$payload_json       = wp_json_encode(
			array(
				'drafts'  => $resource_drafts,
				'updates' => $resource_updates,
			)
		);
		$payload_json       = false === $payload_json ? '[]' : $payload_json;

		return 'retry_' . hash( 'sha256', $expected_revision . '|' . $payload_json );
	}

	/**
	 * Build one bounded operation-journal record.
	 *
	 * @param string                  $operation_id      Browser operation ID.
	 * @param array<string,int>       $resource_mappings Draft-to-ID mappings.
	 * @param array<int|string,string> $update_mappings   Resource-to-target mappings.
	 *
	 * @return array<string,mixed> Operation record.
	 */
	private function build_operation_record( $operation_id, array $resource_mappings, array $update_mappings ) {
		return array(
			'created_at'   => time(),
			'operation_id' => sanitize_key( (string) $operation_id ),
			'resources'    => $resource_mappings,
			'updates'      => $update_mappings,
		);
	}

	/**
	 * Persist a pruned retry journal and verify ambiguous update_option results.
	 *
	 * @param string                              $journal_option_name Option name.
	 * @param array<string,array<string,mixed>>   $journal             Operation records.
	 *
	 * @return bool True when the intended journal is stored.
	 */
	private function save_journal( $journal_option_name, array $journal ) {
		$journal = $this->prune_journal( $journal );

		return update_option( $journal_option_name, $journal, false ) || $journal === get_option( $journal_option_name, array() );
	}

	/**
	 * Keep only the most recent bounded operation records.
	 *
	 * @param array<string,array<string,mixed>> $journal Operation records.
	 *
	 * @return array<string,array<string,mixed>> Bounded journal.
	 */
	private function prune_journal( array $journal ) {
		uasort(
			$journal,
			static function ( $first_record, $second_record ) {
				$first_time  = is_array( $first_record ) && isset( $first_record['created_at'] ) ? absint( $first_record['created_at'] ) : 0;
				$second_time = is_array( $second_record ) && isset( $second_record['created_at'] ) ? absint( $second_record['created_at'] ) : 0;

				return $first_time <=> $second_time;
			}
		);
		while ( self::MAX_JOURNAL_OPERATIONS < count( $journal ) ) {
			array_shift( $journal );
		}

		return $journal;
	}

	/**
	 * Build one normalized progressive-save result.
	 *
	 * @param string[]                       $created_ids     Stable draft-to-Resource mappings.
	 * @param int[]                          $updated_ids     Updated Resource IDs.
	 * @param array<int,array<string,mixed>> $saved_resources Canonical fingerprint values.
	 * @param bool                           $did_write       Whether canonical values changed.
	 *
	 * @return array<string,mixed> Progressive result.
	 */
	private function create_result( array $created_ids, array $updated_ids, array $saved_resources, $did_write ) {
		$created_count = count( $created_ids );
		$updated_count = count( $updated_ids );
		if ( $created_count && $updated_count ) {
			/* translators: 1: Number of created Resources. 2: Number of updated Resources. */
			$summary = sprintf( __( '%1$d Booking Resources created and %2$d updated.', 'booking' ), $created_count, $updated_count );
		} elseif ( $created_count ) {
			$summary = sprintf( _n( '%d Booking Resource created.', '%d Booking Resources created.', $created_count, 'booking' ), $created_count );
		} elseif ( $updated_count ) {
			$summary = sprintf( _n( '%d Booking Resource updated.', '%d Booking Resources updated.', $updated_count, 'booking' ), $updated_count );
		} else {
			$summary = __( 'Existing Booking Resources retained.', 'booking' );
		}

		return array(
			'status'                    => 'saved',
			'summary'                   => $summary,
			'canonical_fingerprint'     => hash( 'sha256', wp_json_encode( $saved_resources ) ),
			'created_ids'               => $created_ids,
			'updated_ids'               => $updated_ids,
			'warnings'                  => array(),
			'writes_canonical_settings' => (bool) $did_write,
		);
	}

	/** @return bool False because Review Setup completes the route. */
	public function is_terminal() {
		return false;
	}
}
