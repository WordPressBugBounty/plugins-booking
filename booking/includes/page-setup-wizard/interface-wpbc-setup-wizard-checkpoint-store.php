<?php
/**
 * Setup Wizard checkpoint persistence contract.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Define the persistence operations required by progressive step saving.
 *
 * The coordinator depends on this narrow contract so domain save handlers do
 * not learn how wizard metadata is stored. Implementations must remain scoped
 * to the current WordPress site, real user, and effective Booking Calendar
 * owner.
 */
interface WPBC_Setup_Wizard_Checkpoint_Store {

	/**
	 * Load the normalized checkpoint for the current storage context.
	 *
	 * @return array<string,mixed> Normalized checkpoint.
	 */
	public function load();

	/**
	 * Return an opaque lock scope for the current storage context.
	 *
	 * @return string Site-, user-, and owner-scoped lock identifier.
	 */
	public function get_lock_scope();

	/**
	 * Return the server-owned active route for a normalized checkpoint.
	 *
	 * @param array<string,mixed> $checkpoint Current normalized checkpoint.
	 *
	 * @return string[] Ordered active step identifiers.
	 */
	public function get_active_step_ids( array $checkpoint );

	/**
	 * Validate a client-observed step and revision against current storage.
	 *
	 * @param array<string,mixed> $checkpoint         Current checkpoint.
	 * @param string              $client_step_id     Client-observed step ID.
	 * @param int                 $expected_revision  Client-observed revision.
	 *
	 * @return true|WP_Error True when current, otherwise a stale-state error.
	 */
	public function validate_request_state( array $checkpoint, $client_step_id, $expected_revision );

	/**
	 * Commit one validated step result and advance through the active route.
	 *
	 * @param string              $client_step_id     Step being saved.
	 * @param int                 $expected_revision  Client-observed revision.
	 * @param array<string,mixed> $validated_fields   Validated step fields.
	 * @param string              $operation_id       Stable idempotency identifier.
	 * @param array<string,mixed> $operation_result   Normalized handler result.
	 * @param bool                $is_terminal        Whether this completes the route.
	 *
	 * @return array<string,mixed>|WP_Error Updated checkpoint or error.
	 */
	public function commit_step_save( $client_step_id, $expected_revision, array $validated_fields, $operation_id, array $operation_result, $is_terminal );
}
