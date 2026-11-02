<?php
/**
 * Bounded booking activity retention service.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Apply one non-blocking, site-local Activity cleanup batch.
 */
final class WPBC_Booking_Activity_Retention_Service {

	/** Site-local option containing non-sensitive cleanup status. */
	const STATUS_OPTION = 'wpbc_booking_activity_retention_status';

	/** Site-local option used as a bounded cleanup mutex. */
	const LOCK_OPTION = 'wpbc_booking_activity_retention_lock';

	/** Maximum age of an abandoned cleanup lock. */
	const LOCK_TTL_SECONDS = 300;

	/** @var object Retention repository contract. */
	private $repository;

	/** @var object Versioned policy provider contract. */
	private $policy_provider;

	/** @var object Site-local operational state contract. */
	private $state_store;

	/** @var bool Whether a full batch may schedule another asynchronous batch. */
	private $allow_continuation;

	/**
	 * Construct the service with optional testable domain collaborators.
	 *
	 * @param object|null $repository        Optional retention repository.
	 * @param object|null $policy_provider   Optional policy provider.
	 * @param object|null $state_store       Optional operational state store.
	 * @param bool        $allow_continuation Whether full batches schedule another cron event.
	 */
	public function __construct( $repository = null, $policy_provider = null, $state_store = null, $allow_continuation = true ) {
		$this->repository = $repository ? $repository : new WPBC_Booking_Activity_Retention_Repository();
		$this->policy_provider = $policy_provider ? $policy_provider : new WPBC_Booking_Activity_Retention_Policy();
		$this->state_store = $state_store ? $state_store : new WPBC_Booking_Activity_Retention_State();
		$this->allow_continuation = (bool) $allow_continuation;
	}

	/**
	 * Run one bounded cleanup batch for the current site.
	 *
	 * Age cleanup runs first. Remaining batch capacity may then remove the
	 * oldest row-cap overflow outside the retry-protection horizon. All deletes
	 * target preselected IDs, so concurrent appends cannot enter the delete set.
	 *
	 * @param int|null $now_timestamp Optional UTC timestamp for deterministic tests.
	 *
	 * @return array<string,mixed>|WP_Error Cleanup result or safe error.
	 */
	public function run_cleanup( $now_timestamp = null ) {
		$now_timestamp = null === $now_timestamp ? time() : absint( $now_timestamp );
		if ( ! $this->repository->table_exists() ) {
			return $this->fail(
				'wpbc_booking_activity_retention_storage_unavailable',
				__( 'Booking activity storage is not available.', 'booking' ),
				$now_timestamp
			);
		}
		if ( ! $this->acquire_lock( $now_timestamp ) ) {
			return new WP_Error(
				'wpbc_booking_activity_retention_locked',
				__( 'Booking activity cleanup is already running.', 'booking' )
			);
		}

		$policy           = $this->policy_provider->get_policy();
		$batch_size       = absint( $policy['batch_size'] );
		$age_cutoff       = gmdate( 'Y-m-d H:i:s', $now_timestamp - ( absint( $policy['max_age_days'] ) * DAY_IN_SECONDS ) );
		$protected_cutoff = gmdate( 'Y-m-d H:i:s', $now_timestamp - ( absint( $policy['retry_protection_days'] ) * DAY_IN_SECONDS ) );
		$expired_ids      = $this->repository->get_expired_activity_ids( $age_cutoff, $batch_size );
		if ( is_wp_error( $expired_ids ) ) {
			$error = $this->fail( $expired_ids->get_error_code(), $expired_ids->get_error_message(), $now_timestamp, $policy );
			$this->release_lock();

			return $error;
		}

		$deleted_count = $this->repository->delete_activity_ids( $expired_ids );
		if ( is_wp_error( $deleted_count ) ) {
			$error = $this->fail( $deleted_count->get_error_code(), $deleted_count->get_error_message(), $now_timestamp, $policy );
			$this->release_lock();

			return $error;
		}

		$selected_count = count( $expired_ids );
		$remaining      = max( 0, $batch_size - $selected_count );
		if ( $remaining > 0 ) {
			$row_count = $this->repository->count_activity();
			if ( is_wp_error( $row_count ) ) {
				$error = $this->fail( $row_count->get_error_code(), $row_count->get_error_message(), $now_timestamp, $policy, $deleted_count );
				$this->release_lock();

				return $error;
			}

			$overflow_count = max( 0, absint( $row_count ) - absint( $policy['max_rows'] ) );
			if ( $overflow_count > 0 ) {
				$row_cap_ids = $this->repository->get_row_cap_activity_ids( $protected_cutoff, min( $remaining, $overflow_count ) );
				if ( is_wp_error( $row_cap_ids ) ) {
					$error = $this->fail( $row_cap_ids->get_error_code(), $row_cap_ids->get_error_message(), $now_timestamp, $policy, $deleted_count );
					$this->release_lock();

					return $error;
				}

				$row_cap_deleted = $this->repository->delete_activity_ids( $row_cap_ids );
				if ( is_wp_error( $row_cap_deleted ) ) {
					$error = $this->fail( $row_cap_deleted->get_error_code(), $row_cap_deleted->get_error_message(), $now_timestamp, $policy, $deleted_count );
					$this->release_lock();

					return $error;
				}

				$selected_count += count( $row_cap_ids );
				$deleted_count  += absint( $row_cap_deleted );
			}
		}

		$more_pending = false;
		if ( $selected_count >= $batch_size ) {
			$more_pending = $this->repository->has_more_eligible_activity( $age_cutoff, $protected_cutoff, $policy['max_rows'] );
			if ( is_wp_error( $more_pending ) ) {
				$error = $this->fail( $more_pending->get_error_code(), $more_pending->get_error_message(), $now_timestamp, $policy, $deleted_count );
				$this->release_lock();

				return $error;
			}
		}
		$status_name = $more_pending ? 'more_pending' : 'complete';
		$error_code  = '';
		if ( $more_pending && $this->allow_continuation ) {
			$continuation_scheduled = function_exists( 'wpbc_booking_activity_retention_schedule_continuation' )
				&& wpbc_booking_activity_retention_schedule_continuation();
			if ( ! $continuation_scheduled ) {
				$status_name = 'error';
				$error_code  = 'continuation_schedule_failed';
			}
		}

		$status = array(
			'policy_version' => absint( $policy['version'] ),
			'last_run_at'    => gmdate( 'Y-m-d H:i:s', $now_timestamp ),
			'deleted_count'  => absint( $deleted_count ),
			'status'         => $status_name,
			'error_code'     => $error_code,
		);
		$this->state_store->update_status( self::STATUS_OPTION, $status );
		$this->release_lock();

		return $status;
	}

	/**
	 * Acquire the site-local cleanup lock, recovering an abandoned lock.
	 *
	 * @param int $now_timestamp Current UTC timestamp.
	 *
	 * @return bool True when this execution owns the lock.
	 */
	private function acquire_lock( $now_timestamp ) {
		return $this->state_store->acquire_lock( self::LOCK_OPTION, $now_timestamp, self::LOCK_TTL_SECONDS );
	}

	/**
	 * Release the site-local cleanup lock owned by this execution.
	 *
	 * @return void
	 */
	private function release_lock() {
		$this->state_store->release_lock( self::LOCK_OPTION );
	}

	/**
	 * Record a controlled non-sensitive error state and return a safe error.
	 *
	 * @param string                  $error_code     Stable error code.
	 * @param string                  $error_message  Safe translated message.
	 * @param int                     $now_timestamp  Current UTC timestamp.
	 * @param array<string,int>|null  $policy         Optional effective policy.
	 * @param int                     $deleted_count  Rows deleted before failure.
	 *
	 * @return WP_Error Safe cleanup error.
	 */
	private function fail( $error_code, $error_message, $now_timestamp, $policy = null, $deleted_count = 0 ) {
		$status = array(
			'policy_version' => is_array( $policy ) && isset( $policy['version'] ) ? absint( $policy['version'] ) : WPBC_Booking_Activity_Retention_Policy::VERSION,
			'last_run_at'    => gmdate( 'Y-m-d H:i:s', $now_timestamp ),
			'deleted_count'  => absint( $deleted_count ),
			'status'         => 'error',
			'error_code'     => sanitize_key( $error_code ),
		);
		$this->state_store->update_status( self::STATUS_OPTION, $status );

		return new WP_Error( sanitize_key( $error_code ), $error_message );
	}
}
