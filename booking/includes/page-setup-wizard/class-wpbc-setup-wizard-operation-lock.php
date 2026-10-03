<?php
/**
 * WordPress-backed Setup Wizard operation lock.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Serialize save operations for one storage context and step.
 */
final class WPBC_Setup_Wizard_WordPress_Operation_Lock implements WPBC_Setup_Wizard_Operation_Lock {

	const LOCK_TTL = 120;

	/**
	 * Acquire one option-backed lock through WordPress' atomic add operation.
	 *
	 * Expired records are removed once and acquisition is retried. The option is
	 * non-autoloaded and contains only opaque hashes and timestamps.
	 *
	 * @param string $lock_scope   Opaque checkpoint storage scope.
	 * @param string $step_id      Stable step identifier.
	 * @param string $operation_id Stable operation identifier.
	 *
	 * @return string|WP_Error Opaque lock token or busy error.
	 */
	public function acquire( $lock_scope, $step_id, $operation_id ) {
		$option_name = $this->get_option_name( $lock_scope, $step_id );
		$lock_token  = function_exists( 'wp_generate_uuid4' ) ? wp_generate_uuid4() : uniqid( 'wpbc_', true );
		$lock_record = array(
			'token'        => $lock_token,
			'operation_id' => sanitize_key( $operation_id ),
			'expires_at'   => time() + self::LOCK_TTL,
		);

		if ( add_option( $option_name, $lock_record, '', false ) ) {
			return $lock_token;
		}

		$existing_lock = get_option( $option_name, array() );
		if ( $this->delete_expired_lock( $option_name, $existing_lock ) ) {
			if ( add_option( $option_name, $lock_record, '', false ) ) {
				return $lock_token;
			}
		}

		return new WP_Error( 'wpbc_setup_wizard_operation_locked', __( 'This Setup Wizard step is already being saved. Wait for it to finish, then try again.', 'booking' ) );
	}

	/**
	 * Release a lock only when its opaque token still matches.
	 *
	 * @param string $lock_scope Opaque checkpoint storage scope.
	 * @param string $step_id    Stable step identifier.
	 * @param string $lock_token Opaque token returned by acquire().
	 *
	 * @return void
	 */
	public function release( $lock_scope, $step_id, $lock_token ) {
		$option_name  = $this->get_option_name( $lock_scope, $step_id );
		$current_lock = get_option( $option_name, array() );

		if ( is_array( $current_lock ) && isset( $current_lock['token'] ) && hash_equals( (string) $current_lock['token'], (string) $lock_token ) ) {
			$this->delete_lock_record( $option_name, $current_lock );
		}
	}

	/**
	 * Build a bounded site-option name without exposing context identifiers.
	 *
	 * @param string $lock_scope Opaque checkpoint storage scope.
	 * @param string $step_id    Stable step identifier.
	 *
	 * @return string WordPress option name.
	 */
	private function get_option_name( $lock_scope, $step_id ) {
		return 'wpbc_setup_wizard_step_lock_' . md5( (string) $lock_scope . '|' . sanitize_key( $step_id ) );
	}

	/**
	 * Atomically remove the exact expired record observed by this request.
	 *
	 * A normal read-then-delete sequence could remove a fresh lock created by a
	 * competing request between those operations. Matching both option name and
	 * serialized value limits deletion to the stale record that was read. The
	 * option cache is cleared only after that exact row was removed.
	 *
	 * @param string $option_name  Internal lock option name.
	 * @param mixed  $lock_record Observed lock record candidate.
	 *
	 * @return bool True when this request removed the observed expired record.
	 */
	private function delete_expired_lock( $option_name, $lock_record ) {
		if ( ! is_array( $lock_record ) || ! isset( $lock_record['expires_at'] ) || (int) $lock_record['expires_at'] >= time() ) {
			return false;
		}

		return $this->delete_lock_record( $option_name, $lock_record );
	}

	/**
	 * Atomically delete one exact lock record and clear its option cache.
	 *
	 * @param string              $option_name Internal lock option name.
	 * @param array<string,mixed> $lock_record Exact record observed by the caller.
	 *
	 * @return bool True when the exact record was deleted.
	 */
	private function delete_lock_record( $option_name, array $lock_record ) {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Atomic compare-and-delete is required; the exact option cache is cleared below.
		$deleted_rows = $wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->options} WHERE option_name = %s AND option_value = %s",
				$option_name,
				maybe_serialize( $lock_record )
			)
		);

		if ( 1 !== (int) $deleted_rows ) {
			return false;
		}

		wp_cache_delete( $option_name, 'options' );
		wp_cache_delete( 'notoptions', 'options' );

		return true;
	}
}
