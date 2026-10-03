<?php
/**
 * Progressive save handler for Setup Wizard Appointment Services.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Create, update, or move Services to Draft for a service-based journey.
 *
 * Draft identifiers are mapped to canonical Service IDs in step-result metadata.
 * That mapping makes Back, double-click retries, and later Booking Form assignment
 * deterministic. A separate explicit lifecycle field stages Draft transitions;
 * omission alone is non-mutating and this handler never permanently deletes a
 * Service.
 */
final class WPBC_Setup_Wizard_Services_Save_Handler implements WPBC_Setup_Wizard_Step_Save_Handler {

	/** @var WPBC_Setup_Wizard_Services */
	private $services;

	/** @var WPBC_Setup_Wizard_Services_Module */
	private $services_module;

	/**
	 * Build the handler around the Services domain validator.
	 *
	 * @param WPBC_Setup_Wizard_Services|null $services Optional domain service for tests.
	 */
	public function __construct( $services = null ) {
		$this->services = $services instanceof WPBC_Setup_Wizard_Services
			? $services
			: new WPBC_Setup_Wizard_Services();
		$this->services_module = new WPBC_Setup_Wizard_Services_Module( $this->services );
	}

	/**
	 * Return the owned step identifier.
	 *
	 * @return string Stable step ID.
	 */
	public function get_step_id() {
		return 'services';
	}

	/**
	 * Describe whether the next boundary creates or updates canonical records.
	 *
	 * @param array<string,mixed> $checkpoint   Current checkpoint.
	 * @param array<string,mixed> $step_context Authorized presentation context.
	 *
	 * @return string Translated action label.
	 */
	public function get_primary_action_label( array $checkpoint, array $step_context = array() ) {
		$mappings = $this->get_service_mappings( $checkpoint );
		$services = isset( $checkpoint['values']['services']['services'] ) && is_array( $checkpoint['values']['services']['services'] )
			? $checkpoint['values']['services']['services']
			: array();
		if ( empty( $services ) && isset( $step_context['services'] ) && is_array( $step_context['services'] ) ) {
			$services = $step_context['services'];
		}

		foreach ( $services as $service ) {
			$draft_id  = isset( $service['draft_id'] ) ? sanitize_key( (string) $service['draft_id'] ) : '';
			$source_id = isset( $service['source_service_id'] ) ? absint( $service['source_service_id'] ) : 0;
			if ( ! $source_id && ( '' === $draft_id || empty( $mappings[ $draft_id ] ) ) ) {
				return __( 'Create services & continue', 'booking' );
			}
		}

		return __( 'Update services & continue', 'booking' );
	}

	/**
	 * Revalidate and persist a bounded Services collection.
	 *
	 * Existing Provider assignments, Booking Form assignments, and metadata are
	 * retained because the Services editor does not own those fields. A database
	 * transaction is used when available; explicit before-images provide bounded
	 * compensation for storage engines that do not support transactions.
	 *
	 * @param array<string,mixed> $validated_fields  Validated current-step fields.
	 * @param array<string,mixed> $checkpoint        Current checkpoint.
	 * @param array<string,mixed> $operation_context Stable operation metadata.
	 *
	 * @return array<string,mixed>|WP_Error Verified result or error.
	 */
	public function save( array $validated_fields, array $checkpoint, array $operation_context ) {
		if ( 'guided_appointment_flow' !== $this->get_customer_journey_id( $checkpoint ) ) {
			return new WP_Error( 'wpbc_setup_wizard_services_journey_invalid', __( 'Services can be saved here only for the Guided appointment flow.', 'booking' ) );
		}
		if (
			! function_exists( 'wpbc_appointment_services_get_manage_capability' )
			|| ! current_user_can( wpbc_appointment_services_get_manage_capability() )
			|| ! function_exists( 'wpbc_appointment_services_get_data_provider' )
		) {
			return new WP_Error( 'wpbc_setup_wizard_services_forbidden', __( 'You are not allowed to manage Appointment Services.', 'booking' ) );
		}

		$submitted_services = isset( $validated_fields['services'] ) ? $validated_fields['services'] : array();
		$submitted_services = $this->services->validate_services( $submitted_services, true );
		if ( is_wp_error( $submitted_services ) ) {
			return $submitted_services;
		}
		$inactive_service_ids = isset( $validated_fields['inactive_service_ids'] ) ? $validated_fields['inactive_service_ids'] : array();
		$inactive_service_ids = $this->services->validate_inactive_service_ids( $inactive_service_ids );
		if ( is_wp_error( $inactive_service_ids ) ) {
			return $inactive_service_ids;
		}

		$repository       = wpbc_appointment_services_get_data_provider();
		$required_methods = array( 'begin_transaction', 'commit_transaction', 'rollback_transaction', 'find', 'save', 'find_by_setup_operation', 'get_deletion_before_image', 'update_details_preserving_assignments', 'move_to_draft_preserving_assignments', 'restore_service_row', 'compare_and_delete_service' );
		if ( ! is_object( $repository ) ) {
			return new WP_Error( 'wpbc_setup_wizard_services_storage_unsupported', __( 'The configured Appointment Services storage does not support Setup Wizard saves.', 'booking' ) );
		}
		foreach ( $required_methods as $required_method ) {
			if ( ! method_exists( $repository, $required_method ) ) {
				return new WP_Error( 'wpbc_setup_wizard_services_storage_unsupported', __( 'The configured Appointment Services storage does not support Setup Wizard saves.', 'booking' ) );
			}
		}
		$operation_id     = isset( $operation_context['operation_id'] ) ? sanitize_key( (string) $operation_context['operation_id'] ) : '';
		$service_mappings = $this->get_service_mappings( $checkpoint );
		$default_provider = $this->get_default_provider_id();
		$before_images    = array();
		$created_images   = array();
		$saved_services   = array();
		$created_ids      = array();
		$updated_ids      = array();
		$inactive_count   = 0;
		$transaction      = $repository->begin_transaction();
		$submitted_service_ids = $this->get_submitted_service_ids( $submitted_services, $service_mappings );
		if ( array_intersect( $inactive_service_ids, $submitted_service_ids ) ) {
			$this->compensate( $repository, $transaction, $before_images, $created_images );
			return new WP_Error( 'wpbc_setup_wizard_service_status_conflict', __( 'A Service cannot remain active and move to Draft in the same save.', 'booking' ) );
		}
		$allowed_inactive_service_ids = $this->get_allowed_inactive_service_ids( $checkpoint );

		foreach ( $submitted_services as $service_draft ) {
			$draft_id           = sanitize_key( (string) $service_draft['draft_id'] );
			$service_id         = absint( $service_draft['source_service_id'] );
			$is_operation_retry = false;
			if ( ! $service_id && isset( $service_mappings[ $draft_id ] ) ) {
				$service_id = absint( $service_mappings[ $draft_id ] );
			}
			if ( ! $service_id && '' !== $operation_id ) {
				$retry_service = $repository->find_by_setup_operation( $operation_id, $draft_id );
				if ( is_wp_error( $retry_service ) ) {
					$this->compensate( $repository, $transaction, $before_images, $created_images );
					return new WP_Error( 'wpbc_setup_wizard_service_retry_not_verified', __( 'A previous Service save could not be verified safely. Reload the Services step and try again.', 'booking' ) );
				}
				if ( is_array( $retry_service ) ) {
					$service_id         = absint( $retry_service['service_id'] );
					$is_operation_retry = true;
				}
			}

			$existing_service = array();
			if ( $service_id ) {
				$before_image = $repository->get_deletion_before_image( $service_id );
				if ( is_wp_error( $before_image ) || ! $this->is_current_owner_service( $before_image ) ) {
					$this->compensate( $repository, $transaction, $before_images, $created_images );
					return new WP_Error( 'wpbc_setup_wizard_service_stale', __( 'A Service changed or is no longer available. Reload the Services step and try again.', 'booking' ) );
				}
				$before_images[ $service_id ] = $before_image;
				$existing_service             = $before_image['service'];
				$existing_service['resource_ids'] = wp_list_pluck( $before_image['assignments'], 'resource_id' );
			}

			$service_payload = array_merge(
				$existing_service,
				array(
					'service_id'           => $service_id,
					'title'                => $service_draft['title'],
					'description'          => $service_draft['description'],
					'picture_url'          => $service_draft['picture_url'],
					'duration_minutes'     => $service_draft['duration_minutes'],
					'buffer_before_minutes' => $service_draft['buffer_before_minutes'],
					'buffer_after_minutes' => $service_draft['buffer_after_minutes'],
					'base_cost'            => $service_draft['base_cost'],
					'booking_form_id'       => isset( $existing_service['booking_form_id'] ) ? absint( $existing_service['booking_form_id'] ) : 0,
					'resource_ids'          => ! empty( $existing_service['resource_ids'] ) ? $existing_service['resource_ids'] : array( $default_provider ),
					'status'                => 'active',
					'metadata'              => $service_id
						? ( isset( $existing_service['metadata'] ) ? $existing_service['metadata'] : array() )
						: array(
							'wpbc_setup_wizard_operation_id' => $operation_id,
							'wpbc_setup_wizard_draft_id'     => $draft_id,
						),
				)
			);

			if ( ! $service_id && ! $default_provider ) {
				$was_restored = $this->compensate( $repository, $transaction, $before_images, $created_images );
				$message      = $was_restored
					? __( 'A Service cannot be created until an authorized Provider is available.', 'booking' )
					: __( 'A Service cannot be created because no authorized Provider is available, and previous Service values could not be restored completely.', 'booking' );
				return new WP_Error( 'wpbc_setup_wizard_service_provider_missing', $message );
			}

			$saved_service = $service_id
				? $repository->update_details_preserving_assignments( $service_payload )
				: $repository->save( $service_payload );
			if ( is_wp_error( $saved_service ) ) {
				$was_restored = $this->compensate( $repository, $transaction, $before_images, $created_images );
				$message      = $was_restored
					? __( 'A Service could not be saved. Previous Service values were restored.', 'booking' )
					: __( 'A Service could not be saved, and its previous values could not be restored completely. Review Appointment Services before continuing.', 'booking' );
				return new WP_Error( 'wpbc_setup_wizard_service_not_saved', $message );
			}

			$saved_id = absint( $saved_service['service_id'] );
			if ( ! $service_id ) {
				$created_image = $repository->get_deletion_before_image( $saved_id );
				if ( is_wp_error( $created_image ) ) {
					$this->compensate( $repository, $transaction, $before_images, $created_images );
					return new WP_Error( 'wpbc_setup_wizard_service_not_verified', __( 'A newly created Service could not be verified safely.', 'booking' ) );
				}
				$created_images[ $saved_id ] = $created_image;
				$created_ids[]                = $this->format_service_mapping( $draft_id, $saved_id );
			} elseif ( $is_operation_retry ) {
				$created_ids[] = $this->format_service_mapping( $draft_id, $saved_id );
			} else {
				$updated_ids[] = $this->format_service_mapping( $draft_id, $saved_id );
			}

			$saved_services[] = $this->get_service_fingerprint_values( $saved_service );
		}

		foreach ( $inactive_service_ids as $inactive_service_id ) {
			$before_image = $repository->get_deletion_before_image( $inactive_service_id );
			if ( is_wp_error( $before_image ) || ! $this->is_current_owner_service( $before_image ) ) {
				$this->compensate( $repository, $transaction, $before_images, $created_images );
				return new WP_Error( 'wpbc_setup_wizard_service_draft_stale', __( 'A Service selected for Draft changed or is no longer available. Reload the Services step and try again.', 'booking' ) );
			}

			$existing_service = $before_image['service'];
			$is_status_retry   = $this->is_inactive_operation_retry( $existing_service, $operation_id );
			if ( ! in_array( $inactive_service_id, $allowed_inactive_service_ids, true ) && ! $is_status_retry ) {
				$this->compensate( $repository, $transaction, $before_images, $created_images );
				return new WP_Error( 'wpbc_setup_wizard_service_draft_forbidden', __( 'A Service selected for Draft is not part of this saved Setup Wizard state.', 'booking' ) );
			}

			$existing_status = isset( $existing_service['status'] ) ? sanitize_key( (string) $existing_service['status'] ) : '';
			if ( 'inactive' === $existing_status ) {
				$updated_ids[]   = $this->format_inactive_service_id( $inactive_service_id );
				$saved_services[] = $this->get_service_fingerprint_values( $existing_service );
				++$inactive_count;
				continue;
			}
			if ( 'active' !== $existing_status ) {
				$this->compensate( $repository, $transaction, $before_images, $created_images );
				return new WP_Error( 'wpbc_setup_wizard_service_draft_status_invalid', __( 'Only an active Service can be moved to Draft from Setup Wizard.', 'booking' ) );
			}

			$before_images[ $inactive_service_id ] = $before_image;

			$saved_service = $repository->move_to_draft_preserving_assignments( $inactive_service_id, $operation_id );
			if (
				is_wp_error( $saved_service )
				|| 'inactive' !== sanitize_key( isset( $saved_service['status'] ) ? (string) $saved_service['status'] : '' )
			) {
				$was_restored = $this->compensate( $repository, $transaction, $before_images, $created_images );
				$message      = $was_restored
					? __( 'A Service could not be moved to Draft. Previous Service values were restored.', 'booking' )
					: __( 'A Service could not be moved to Draft, and previous values could not be restored completely. Review Appointment Services before continuing.', 'booking' );
				return new WP_Error( 'wpbc_setup_wizard_service_draft_not_saved', $message );
			}

			$updated_ids[]    = $this->format_inactive_service_id( $inactive_service_id );
			$saved_services[] = $this->get_service_fingerprint_values( $saved_service );
			++$inactive_count;
		}

		if ( $transaction && ! $repository->commit_transaction() ) {
			$was_restored = $this->compensate( $repository, true, $before_images, $created_images );
			$message      = $was_restored
				? __( 'Services could not be committed. Previous Service values were restored.', 'booking' )
				: __( 'Services could not be committed or restored completely. Review Appointment Services before continuing.', 'booking' );
			return new WP_Error( 'wpbc_setup_wizard_services_commit_failed', $message );
		}

		$summary = empty( $created_ids ) ? __( 'Appointment Services updated.', 'booking' ) : __( 'Appointment Services created and updated.', 'booking' );
		if ( 1 === $inactive_count ) {
			$summary = __( 'Appointment Services updated; one Service moved to Draft.', 'booking' );
		} elseif ( 1 < $inactive_count ) {
			/* translators: %d: Number of Appointment Services moved to Draft. */
			$summary = sprintf( __( 'Appointment Services updated; %d Services moved to Draft.', 'booking' ), $inactive_count );
		}

		return array(
			'status'                    => 'saved',
			'summary'                   => $summary,
			'canonical_fingerprint'     => hash( 'sha256', wp_json_encode( $saved_services ) ),
			'created_ids'               => $created_ids,
			'updated_ids'               => $updated_ids,
			'warnings'                  => array(),
			'writes_canonical_settings' => true,
		);
	}

	/**
	 * Resolve canonical Service IDs retained by the active proposal collection.
	 *
	 * @param array<int,array<string,mixed>> $submitted_services Validated Service proposals.
	 * @param array<string,int>               $service_mappings  Retained draft-to-Service mappings.
	 *
	 * @return int[] Canonical Service IDs that must remain active.
	 */
	private function get_submitted_service_ids( array $submitted_services, array $service_mappings ) {
		$service_ids = array();
		foreach ( $submitted_services as $submitted_service ) {
			$draft_id  = sanitize_key( (string) $submitted_service['draft_id'] );
			$service_id = absint( $submitted_service['source_service_id'] );
			if ( ! $service_id && isset( $service_mappings[ $draft_id ] ) ) {
				$service_id = absint( $service_mappings[ $draft_id ] );
			}
			if ( $service_id ) {
				$service_ids[] = $service_id;
			}
		}

		return array_values( array_unique( $service_ids ) );
	}

	/**
	 * Build the owner-authorized allow-list for an explicit Draft transition.
	 *
	 * Current active canonical IDs authorize the initial action. Previously saved
	 * checkpoint values authorize idempotent revisits after the Service is already
	 * inactive and therefore no longer appears in the active repository query.
	 *
	 * @param array<string,mixed> $checkpoint Current checkpoint.
	 *
	 * @return int[] Authorized Service IDs.
	 */
	private function get_allowed_inactive_service_ids( array $checkpoint ) {
		$service_ids = $this->services->get_authorized_active_service_ids();
		$stored_ids  = isset( $checkpoint['values']['services']['inactive_service_ids'] ) && is_array( $checkpoint['values']['services']['inactive_service_ids'] )
			? $checkpoint['values']['services']['inactive_service_ids']
			: array();

		return array_values( array_unique( array_filter( array_map( 'absint', array_merge( $service_ids, $stored_ids ) ) ) ) );
	}

	/**
	 * Confirm that an inactive Service belongs to the current retry operation.
	 *
	 * @param array<string,mixed> $service      Canonical Service row.
	 * @param string              $operation_id Stable progressive-save operation ID.
	 *
	 * @return bool True when the stored marker proves an idempotent retry.
	 */
	private function is_inactive_operation_retry( array $service, $operation_id ) {
		if ( '' === $operation_id || 'inactive' !== sanitize_key( isset( $service['status'] ) ? (string) $service['status'] : '' ) ) {
			return false;
		}

		$metadata = $this->decode_service_metadata( isset( $service['metadata'] ) ? $service['metadata'] : array() );

		return isset( $metadata['wpbc_setup_wizard_inactive_operation_id'] )
			&& hash_equals( $operation_id, (string) $metadata['wpbc_setup_wizard_inactive_operation_id'] );
	}

	/**
	 * Decode canonical Service metadata without assuming the native provider.
	 *
	 * @param mixed $metadata Canonical metadata array or JSON string.
	 *
	 * @return array<string,mixed> Decoded metadata.
	 */
	private function decode_service_metadata( $metadata ) {
		if ( function_exists( 'wpbc_appointment_services_decode_metadata' ) ) {
			return wpbc_appointment_services_decode_metadata( $metadata );
		}
		if ( is_array( $metadata ) ) {
			return $metadata;
		}

		$decoded = json_decode( (string) $metadata, true );

		return is_array( $decoded ) ? $decoded : array();
	}

	/**
	 * Format a stable result marker for one Service moved to Draft.
	 *
	 * @param int $service_id Canonical Service ID.
	 *
	 * @return string Step-result marker.
	 */
	private function format_inactive_service_id( $service_id ) {
		return 'service_status:' . absint( $service_id ) . ':inactive';
	}

	/**
	 * Restore changed records or roll back the active transaction.
	 *
	 * @param WPBC_Appointment_Services_Repository     $repository    Canonical repository.
	 * @param bool                                     $transaction   Whether a transaction is active.
	 * @param array<int,array<string,mixed>>            $before_images Existing Service before-images.
	 * @param array<int,array<string,mixed>>            $created_images Created Service before-images.
	 *
	 * @return bool True when the rollback or every compensation write succeeds.
	 */
	private function compensate( $repository, $transaction, array $before_images, array $created_images ) {
		if ( $transaction ) {
			$repository->rollback_transaction();
			$rollback_verified = true;
			foreach ( $before_images as $service_id => $before_image ) {
				$current_image = $repository->get_deletion_before_image( $service_id );
				if ( is_wp_error( $current_image ) || $before_image !== $current_image ) {
					$rollback_verified = false;
					break;
				}
			}
			if ( $rollback_verified ) {
				foreach ( array_keys( $created_images ) as $service_id ) {
					if ( ! is_wp_error( $repository->find( $service_id ) ) ) {
						$rollback_verified = false;
						break;
					}
				}
			}
			if ( $rollback_verified ) {
				return true;
			}
		}

		$was_restored = true;
		foreach ( array_reverse( $created_images, true ) as $created_image ) {
			if ( is_wp_error( $repository->compare_and_delete_service( $created_image ) ) ) {
				$was_restored = false;
			}
		}
		foreach ( $before_images as $before_image ) {
			if ( is_wp_error( $repository->restore_service_row( $before_image ) ) ) {
				$was_restored = false;
			}
		}

		return $was_restored;
	}

	/**
	 * Return the first authorized Provider used for a new Service.
	 *
	 * @return int Provider resource ID.
	 */
	private function get_default_provider_id() {
		$provider_options = function_exists( 'wpbc_appointment_services_get_provider_options' )
			? wpbc_appointment_services_get_provider_options()
			: array();
		$provider_ids = array_values( array_filter( array_map( 'absint', array_keys( (array) $provider_options ) ) ) );

		if ( ! empty( $provider_ids ) ) {
			return (int) reset( $provider_ids );
		}

		return 0;
	}

	/**
	 * Confirm that a Service before-image belongs to the effective wizard owner.
	 *
	 * Catalog super administrators may read all MultiUser owners, but a Setup
	 * Wizard session must mutate only its effective owner context.
	 *
	 * @param array<string,mixed> $before_image Canonical Service before-image.
	 *
	 * @return bool True when the Service owner matches the wizard owner.
	 */
	private function is_current_owner_service( array $before_image ) {
		$service       = isset( $before_image['service'] ) && is_array( $before_image['service'] ) ? $before_image['service'] : array();
		$owner_user_id = function_exists( 'wpbc_appointment_services_get_owner_user_id' )
			? absint( wpbc_appointment_services_get_owner_user_id() )
			: 0;

		return isset( $service['owner_user_id'] ) && $owner_user_id === absint( $service['owner_user_id'] );
	}

	/**
	 * Extract canonical Service IDs from retained step-result metadata.
	 *
	 * @param array<string,mixed> $checkpoint Current checkpoint.
	 *
	 * @return array<string,int> Service IDs keyed by draft identifier.
	 */
	private function get_service_mappings( array $checkpoint ) {
		$result   = isset( $checkpoint['step_results']['services'] ) && is_array( $checkpoint['step_results']['services'] ) ? $checkpoint['step_results']['services'] : array();
		$stored   = array_merge( isset( $result['created_ids'] ) ? (array) $result['created_ids'] : array(), isset( $result['updated_ids'] ) ? (array) $result['updated_ids'] : array() );
		$mappings = array();

		foreach ( $stored as $mapping ) {
			if ( is_scalar( $mapping ) && preg_match( '/^service:([a-z0-9_-]{1,64}):([0-9]+)$/', (string) $mapping, $matches ) ) {
				$mappings[ $matches[1] ] = absint( $matches[2] );
			}
		}

		return $mappings;
	}

	/**
	 * Format one bounded Service identity mapping.
	 *
	 * @param string $draft_id  Stable wizard draft identifier.
	 * @param int    $service_id Canonical Service ID.
	 *
	 * @return string Mapping stored in step-result metadata.
	 */
	private function format_service_mapping( $draft_id, $service_id ) {
		return 'service:' . sanitize_key( $draft_id ) . ':' . absint( $service_id );
	}

	/**
	 * Return stable canonical fields used for post-write fingerprinting.
	 *
	 * @param array<string,mixed> $service Canonical Service row.
	 *
	 * @return array<string,mixed> Stable fields.
	 */
	private function get_service_fingerprint_values( array $service ) {
		return array(
			'service_id'            => absint( $service['service_id'] ),
			'title'                 => (string) $service['title'],
			'description'           => (string) $service['description'],
			'duration_minutes'      => absint( $service['duration_minutes'] ),
			'buffer_before_minutes' => absint( $service['buffer_before_minutes'] ),
			'buffer_after_minutes'  => absint( $service['buffer_after_minutes'] ),
			'base_cost'             => (string) $service['base_cost'],
			'booking_form_id'       => absint( $service['booking_form_id'] ),
			'resource_ids'          => array_values( array_map( 'absint', (array) $service['resource_ids'] ) ),
			'status'                => (string) $service['status'],
		);
	}

	/**
	 * Read the saved Customer Journey.
	 *
	 * @param array<string,mixed> $checkpoint Current checkpoint.
	 *
	 * @return string Journey ID.
	 */
	private function get_customer_journey_id( array $checkpoint ) {
		return isset( $checkpoint['values']['customer_journey']['customer_journey'] )
			? sanitize_key( (string) $checkpoint['values']['customer_journey']['customer_journey'] )
			: '';
	}

	/**
	 * Services do not complete the route.
	 *
	 * @return bool False.
	 */
	public function is_terminal() {
		return false;
	}
}
