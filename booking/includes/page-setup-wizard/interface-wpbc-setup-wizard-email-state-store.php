<?php
/**
 * Setup Wizard summary-email checkpoint contract.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Define the narrow checkpoint operations required by the Review email sender.
 *
 * The sender owns email composition and delivery while the checkpoint store
 * remains the only component that knows how user-, site-, and owner-scoped
 * wizard metadata is persisted.
 */
interface WPBC_Setup_Wizard_Email_State_Store {

	/**
	 * Load the current normalized Setup Wizard checkpoint.
	 *
	 * @return array<string,mixed> Normalized checkpoint.
	 */
	public function load();

	/**
	 * Return the opaque site-, user-, and owner-scoped lock identifier.
	 *
	 * @return string Context-specific lock scope.
	 */
	public function get_lock_scope();

	/**
	 * Persist normalized summary-email state against an expected revision.
	 *
	 * @param array<string,mixed> $email_state      New summary-email metadata.
	 * @param int                 $expected_revision Checkpoint revision observed by the sender.
	 *
	 * @return array<string,mixed>|WP_Error Updated checkpoint or a stale/storage error.
	 */
	public function update_email_state( array $email_state, $expected_revision );
}
