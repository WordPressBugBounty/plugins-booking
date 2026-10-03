<?php
/**
 * Setup Wizard progressive step-save contracts.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Define one domain-owned Setup Wizard step save boundary.
 *
 * Implementations are responsible for their own capability, ownership,
 * edition, validation, canonical persistence, verification, and compensation.
 * The shared coordinator supplies already normalized wizard fields, but a
 * canonical handler must still revalidate every domain rule at apply time.
 */
interface WPBC_Setup_Wizard_Step_Save_Handler {

	/**
	 * Return the stable step identifier owned by this handler.
	 *
	 * @return string Stable step ID.
	 */
	public function get_step_id();

	/**
	 * Return the server-owned primary action label for the current state.
	 *
	 * @param array<string,mixed> $checkpoint   Current normalized checkpoint.
	 * @param array<string,mixed> $step_context Authorized presentation context.
	 *
	 * @return string Translated primary action label.
	 */
	public function get_primary_action_label( array $checkpoint, array $step_context = array() );

	/**
	 * Save one validated step through its domain boundary.
	 *
	 * @param array<string,mixed> $validated_fields Validated current-step fields.
	 * @param array<string,mixed> $checkpoint       Current normalized checkpoint.
	 * @param array<string,mixed> $operation_context Stable operation metadata.
	 *
	 * @return array<string,mixed>|WP_Error Domain result or error.
	 */
	public function save( array $validated_fields, array $checkpoint, array $operation_context );

	/**
	 * Determine whether a successful save completes the active route.
	 *
	 * @return bool True for a terminal step.
	 */
	public function is_terminal();
}

/**
 * Define the per-step operation lock required by the progressive coordinator.
 */
interface WPBC_Setup_Wizard_Operation_Lock {

	/**
	 * Acquire one context- and step-scoped operation lock.
	 *
	 * @param string $lock_scope   Opaque checkpoint storage scope.
	 * @param string $step_id      Stable step identifier.
	 * @param string $operation_id Stable operation identifier.
	 *
	 * @return string|WP_Error Opaque lock token or a busy error.
	 */
	public function acquire( $lock_scope, $step_id, $operation_id );

	/**
	 * Release a lock only when the caller still owns its token.
	 *
	 * @param string $lock_scope Opaque checkpoint storage scope.
	 * @param string $step_id    Stable step identifier.
	 * @param string $lock_token Opaque token returned by acquire().
	 *
	 * @return void
	 */
	public function release( $lock_scope, $step_id, $lock_token );
}

