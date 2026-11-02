<?php
/**
 * Booking activity retention operational state.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Own site-local, non-sensitive retention lock and status options.
 */
final class WPBC_Booking_Activity_Retention_State {

	/**
	 * Acquire the cleanup lock, recovering an abandoned lock.
	 *
	 * @param string $option_name  Site-local lock option name.
	 * @param int    $now_timestamp Current UTC timestamp.
	 * @param int    $ttl_seconds   Maximum valid lock age in seconds.
	 *
	 * @return bool True when this execution owns the lock.
	 */
	public function acquire_lock( $option_name, $now_timestamp, $ttl_seconds ) {
		$stored_lock = absint( get_option( $option_name, 0 ) );
		if ( $stored_lock && $stored_lock > ( $now_timestamp - $ttl_seconds ) ) {
			return false;
		}
		if ( $stored_lock ) {
			delete_option( $option_name );
		}

		return add_option( $option_name, $now_timestamp, '', false );
	}

	/**
	 * Release a site-local cleanup lock.
	 *
	 * @param string $option_name Site-local lock option name.
	 *
	 * @return void
	 */
	public function release_lock( $option_name ) {
		delete_option( $option_name );
	}

	/**
	 * Persist a non-sensitive site-local cleanup status record.
	 *
	 * @param string              $option_name Site-local status option name.
	 * @param array<string,mixed> $status      Normalized operational status.
	 *
	 * @return void
	 */
	public function update_status( $option_name, $status ) {
		update_option( $option_name, $status, false );
	}
}
