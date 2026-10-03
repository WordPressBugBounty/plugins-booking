<?php
/**
 * Shared Setup Wizard progressive-save coordinator.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Coordinate validation, locking, idempotency, domain saving, and checkpointing.
 */
final class WPBC_Setup_Wizard_Progressive_Save_Coordinator {

	/** @var WPBC_Setup_Wizard_Checkpoint_Store */
	private $checkpoint_store;

	/** @var WPBC_Setup_Wizard_Draft_Validator */
	private $draft_validator;

	/** @var WPBC_Setup_Wizard_Step_Save_Registry */
	private $save_registry;

	/** @var WPBC_Setup_Wizard_Operation_Lock */
	private $operation_lock;

	/**
	 * Build the shared save boundary from explicit collaborators.
	 *
	 * @param WPBC_Setup_Wizard_Checkpoint_Store    $checkpoint_store Checkpoint persistence.
	 * @param WPBC_Setup_Wizard_Draft_Validator    $draft_validator  Step validator.
	 * @param WPBC_Setup_Wizard_Step_Save_Registry $save_registry   Domain handler registry.
	 * @param WPBC_Setup_Wizard_Operation_Lock     $operation_lock  Per-step lock.
	 */
	public function __construct( WPBC_Setup_Wizard_Checkpoint_Store $checkpoint_store, WPBC_Setup_Wizard_Draft_Validator $draft_validator, WPBC_Setup_Wizard_Step_Save_Registry $save_registry, WPBC_Setup_Wizard_Operation_Lock $operation_lock ) {
		$this->checkpoint_store = $checkpoint_store;
		$this->draft_validator  = $draft_validator;
		$this->save_registry    = $save_registry;
		$this->operation_lock   = $operation_lock;
	}

	/**
	 * Save the current step once and advance only after a verified result.
	 *
	 * @param string              $client_step_id    Client-observed current step.
	 * @param int                 $expected_revision Client-observed revision.
	 * @param array<string,mixed> $submitted_fields  Current-step fields.
	 * @param string              $operation_id      Stable idempotency identifier.
	 *
	 * @return array{checkpoint:array<string,mixed>,idempotent_replay:bool}|WP_Error Save result envelope or error.
	 */
	public function save_and_continue( $client_step_id, $expected_revision, array $submitted_fields, $operation_id ) {
		$client_step_id   = sanitize_key( is_scalar( $client_step_id ) ? (string) $client_step_id : '' );
		$raw_operation_id = is_scalar( $operation_id ) ? (string) $operation_id : '';
		$operation_id     = sanitize_key( $raw_operation_id );
		if ( '' === $operation_id || $operation_id !== $raw_operation_id || 100 < strlen( $operation_id ) ) {
			return new WP_Error( 'wpbc_setup_wizard_operation_invalid', __( 'The Setup Wizard save operation is invalid. Reload the page and try again.', 'booking' ) );
		}

		$checkpoint = $this->checkpoint_store->load();
		if ( $this->is_completed_operation( $checkpoint, $client_step_id, $operation_id, $expected_revision ) ) {
			return array(
				'checkpoint'       => $checkpoint,
				'idempotent_replay' => true,
			);
		}

		$request_state = $this->checkpoint_store->validate_request_state( $checkpoint, $client_step_id, $expected_revision );
		if ( is_wp_error( $request_state ) ) {
			return $request_state;
		}

		$handler = $this->save_registry->get_handler( $client_step_id );
		if ( null === $handler ) {
			return new WP_Error( 'wpbc_setup_wizard_save_handler_missing', __( 'This Setup Wizard step cannot be saved yet.', 'booking' ) );
		}

		$lock_scope = $this->checkpoint_store->get_lock_scope();
		$lock_token = $this->operation_lock->acquire( $lock_scope, $client_step_id, $operation_id );
		if ( is_wp_error( $lock_token ) ) {
			return $lock_token;
		}

		try {
			$checkpoint = $this->checkpoint_store->load();
			if ( $this->is_completed_operation( $checkpoint, $client_step_id, $operation_id, $expected_revision ) ) {
				return array(
					'checkpoint'       => $checkpoint,
					'idempotent_replay' => true,
				);
			}

			$request_state = $this->checkpoint_store->validate_request_state( $checkpoint, $client_step_id, $expected_revision );
			if ( is_wp_error( $request_state ) ) {
				return $request_state;
			}

			$validated_fields = $this->draft_validator->validate_step( $client_step_id, $submitted_fields, true, $checkpoint['values'] );
			if ( is_wp_error( $validated_fields ) ) {
				return $validated_fields;
			}

			if ( $handler->is_terminal() ) {
				$route_values = $checkpoint['values'];
				if ( ! empty( $validated_fields ) ) {
					$current_values                    = isset( $route_values[ $client_step_id ] ) && is_array( $route_values[ $client_step_id ] ) ? $route_values[ $client_step_id ] : array();
					$route_values[ $client_step_id ] = array_merge( $current_values, $validated_fields );
				}

				$route_checkpoint           = $checkpoint;
				$route_checkpoint['values'] = $route_values;
				$active_step_ids            = $this->checkpoint_store->get_active_step_ids( $route_checkpoint );
				$revalidated_values = $this->draft_validator->validate_active_route( $route_values, $active_step_ids );
				if ( is_wp_error( $revalidated_values ) ) {
					return $revalidated_values;
				}
				$validated_fields = isset( $revalidated_values[ $client_step_id ] ) ? $revalidated_values[ $client_step_id ] : $validated_fields;
			}

			$handler_result = $handler->save(
				$validated_fields,
				$checkpoint,
				array(
					'operation_id'      => $operation_id,
					'step_id'           => $client_step_id,
					'expected_revision' => (int) $expected_revision,
				)
			);
			if ( is_wp_error( $handler_result ) ) {
				return $handler_result;
			}

			$handler_result = $this->save_registry->normalize_result( $handler_result );
			if ( is_wp_error( $handler_result ) ) {
				return $handler_result;
			}

			$updated_checkpoint = $this->checkpoint_store->commit_step_save(
				$client_step_id,
				$expected_revision,
				$validated_fields,
				$operation_id,
				$handler_result,
				$handler->is_terminal()
			);
			if ( is_wp_error( $updated_checkpoint ) ) {
				return $updated_checkpoint;
			}

			return array(
				'checkpoint'       => $updated_checkpoint,
				'idempotent_replay' => false,
			);
		} finally {
			$this->operation_lock->release( $lock_scope, $client_step_id, $lock_token );
		}
	}

	/**
	 * Determine whether a stored step result already completed an operation.
	 *
	 * @param array<string,mixed> $checkpoint   Current checkpoint.
	 * @param string              $step_id      Stable step identifier.
	 * @param string              $operation_id Stable operation identifier.
	 * @param int                 $source_revision Revision observed by the original save.
	 *
	 * @return bool True when the exact operation already succeeded.
	 */
	private function is_completed_operation( array $checkpoint, $step_id, $operation_id, $source_revision ) {
		$step_result = isset( $checkpoint['step_results'][ $step_id ] ) && is_array( $checkpoint['step_results'][ $step_id ] )
			? $checkpoint['step_results'][ $step_id ]
			: array();

		return 'saved' === ( isset( $step_result['status'] ) ? $step_result['status'] : '' )
			&& isset( $step_result['operation_id'] )
			&& hash_equals( (string) $step_result['operation_id'], (string) $operation_id )
			&& isset( $step_result['source_revision'] )
			&& (int) $step_result['source_revision'] === (int) $source_revision;
	}
}
