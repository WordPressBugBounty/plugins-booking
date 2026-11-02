<?php
/**
 * Durable idempotency claims for Add New Booking Inspector creation.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Atomically claims a site/user/purpose key and stores its terminal result.
 */
final class WPBC_Booking_New_Inspector_Idempotency_Repository {

	/** Durable record version. */
	const RECORD_VERSION = 1;

	/**
	 * Claim an idempotency key using WordPress' unique option-name insert.
	 *
	 * @param string $idempotency_key Server-issued identifier.
	 * @param string $plan_fingerprint Signed-plan fingerprint.
	 * @return array<string,mixed>|WP_Error New or existing claim record.
	 */
	public function claim( $idempotency_key, $plan_fingerprint ) {
		$option_name = $this->get_option_name( $idempotency_key );
		$record      = array(
			'version'          => self::RECORD_VERSION,
			'status'           => 'applying',
			'site_id'          => $this->get_site_id(),
			'user_id'          => $this->get_effective_user_id(),
			'actor_user_id'    => $this->get_actor_user_id(),
			'purpose'          => 'booking_new_inspector_apply',
			'idempotency_key'  => $idempotency_key,
			'plan_fingerprint' => $plan_fingerprint,
			'booking_id'       => 0,
			'result'           => array(),
			'created_at'       => time(),
			'updated_at'       => time(),
		);
		if ( add_option( $option_name, $record, '', false ) ) {
			if ( function_exists( 'wp_schedule_single_event' ) ) {
				wp_schedule_single_event( time() + DAY_IN_SECONDS, 'wpbc_booking_new_inspector_cleanup_idempotency', array( $option_name ) );
			}
			$record['is_new_claim'] = true;
			return $record;
		}
		$existing = get_option( $option_name, null );
		if ( ! is_array( $existing ) || empty( $existing['plan_fingerprint'] ) || ! hash_equals( (string) $existing['plan_fingerprint'], $plan_fingerprint ) ) {
			return new WP_Error( 'wpbc_booking_new_inspector_idempotency_conflict', __( 'This booking creation identifier is already bound to another review.', 'booking' ), array( 'status' => 409 ) );
		}
		$existing['is_new_claim'] = false;
		return $existing;
	}

	/**
	 * Persist the terminal result for safe retries.
	 *
	 * @param string              $idempotency_key Server-issued identifier.
	 * @param string              $status          Completed or created_with_warnings.
	 * @param int                 $booking_id      Authoritative booking ID.
	 * @param array<string,mixed> $result          JSON-safe Apply response.
	 * @return bool True when stored.
	 */
	public function complete( $idempotency_key, $status, $booking_id, $result ) {
		$option_name = $this->get_option_name( $idempotency_key );
		$record      = get_option( $option_name, array() );
		if ( ! is_array( $record ) ) {
			return false;
		}
		$record['status']     = in_array( $status, array( 'completed', 'created_with_warnings' ), true ) ? $status : 'created_with_warnings';
		$record['booking_id'] = absint( $booking_id );
		$record['result']     = $result;
		$record['updated_at'] = time();
		return update_option( $option_name, $record, false );
	}

	/**
	 * Mark a proven pre-persistence failure so a fresh Review is required.
	 *
	 * @param string $idempotency_key Server-issued identifier.
	 * @param string $error_code      Safe error code.
	 * @return bool True when stored.
	 */
	public function fail_before_persistence( $idempotency_key, $error_code ) {
		$option_name = $this->get_option_name( $idempotency_key );
		$record      = get_option( $option_name, array() );
		if ( ! is_array( $record ) ) {
			return false;
		}
		$record['status']     = 'failed';
		$record['error_code'] = sanitize_key( $error_code );
		$record['updated_at'] = time();
		return update_option( $option_name, $record, false );
	}

	/**
	 * Delete one expired internal claim after every signed plan using it expired.
	 *
	 * The option name is a SHA-256 scoped identifier generated only by this
	 * repository. A strict prefix/length check prevents the cron argument from
	 * selecting arbitrary options.
	 *
	 * @param mixed $option_name Scheduled internal option name.
	 * @return void
	 */
	public static function cleanup_expired_claim( $option_name ) {
		$option_name = is_scalar( $option_name ) ? (string) $option_name : '';
		if ( ! preg_match( '/^wpbc_bni_idem_[a-f0-9]{64}$/', $option_name ) ) {
			return;
		}
		$record = get_option( $option_name, null );
		if ( ! is_array( $record ) || empty( $record['created_at'] ) || time() < absint( $record['created_at'] ) + WPBC_Booking_New_Inspector_Review_Service::PLAN_LIFETIME ) {
			return;
		}
		delete_option( $option_name );
	}

	/**
	 * Build the site, actor, purpose, and key-bound claim option name.
	 *
	 * @param string $idempotency_key Server-issued identifier.
	 * @return string Hashed, site-local option name.
	 */
	private function get_option_name( $idempotency_key ) {
		$scope = implode( '|', array( $this->get_site_id(), $this->get_effective_user_id(), 'booking_new_inspector_apply', $idempotency_key ) );
		return 'wpbc_bni_idem_' . hash( 'sha256', $scope );
	}

	/**
	 * Get the current multisite site identifier.
	 *
	 * @return int Current site ID, or zero outside WordPress test fixtures.
	 */
	private function get_site_id() {
		return function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0;
	}

	/**
	 * Get the effective MultiUser identity for the claim scope.
	 *
	 * @return int Current effective MultiUser ID.
	 */
	private function get_effective_user_id() {
		return function_exists( 'wpbc_get_current_user_id' ) ? absint( wpbc_get_current_user_id() ) : $this->get_actor_user_id();
	}

	/**
	 * Get the authenticated WordPress actor for audit metadata.
	 *
	 * @return int Current WordPress actor ID.
	 */
	private function get_actor_user_id() {
		return function_exists( 'get_current_user_id' ) ? absint( get_current_user_id() ) : 0;
	}
}
