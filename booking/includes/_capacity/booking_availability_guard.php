<?php
/**
 * Booking availability concurrency guard.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Classify the active WordPress database implementation for booking locking.
 *
 * SQLite must never receive MySQL advisory-lock statements. Custom database
 * drop-ins are classified separately because a SELECT-based advisory lock may
 * be routed to a read replica while booking writes use another connection.
 *
 * @param object $database             Active WordPress database object.
 * @param mixed  $database_engine      Current DB_ENGINE value, expected to be a string.
 * @param mixed  $legacy_database_type Current legacy DATABASE_TYPE value, expected to be a string.
 * @param bool   $has_sqlite_dropin     Whether the official SQLite drop-in marker is defined.
 *
 * @return string One of `sqlite`, `core_mysql`, or `custom`.
 */
function wpbc_booking_availability_guard_classify_database( $database, $database_engine = '', $legacy_database_type = '', $has_sqlite_dropin = false ) {
	$database_class       = is_object( $database ) ? strtolower( get_class( $database ) ) : '';
	$database_engine      = is_scalar( $database_engine ) ? strtolower( trim( (string) $database_engine ) ) : '';
	$legacy_database_type = is_scalar( $legacy_database_type ) ? strtolower( trim( (string) $legacy_database_type ) ) : '';
	$is_sqlite            = ( 'sqlite' === $database_engine )
		|| ( 'sqlite' === $legacy_database_type )
		|| $has_sqlite_dropin
		|| ( false !== strpos( $database_class, 'sqlite' ) );

	if ( $is_sqlite ) {
		return 'sqlite';
	}

	return ( 'wpdb' === $database_class ) ? 'core_mysql' : 'custom';
}

/**
 * Return the active database classification used by the availability guard.
 *
 * @return string One of `sqlite`, `core_mysql`, or `custom`.
 */
function wpbc_booking_availability_guard_get_database_classification() {
	global $wpdb;

	$database_engine      = defined( 'DB_ENGINE' ) ? DB_ENGINE : '';
	$legacy_database_type = defined( 'DATABASE_TYPE' ) ? DATABASE_TYPE : '';
	$has_sqlite_dropin    = defined( 'SQLITE_DB_DROPIN_VERSION' )
		|| ( defined( 'WP_SQLITE_AST_DRIVER' ) && WP_SQLITE_AST_DRIVER );

	return wpbc_booking_availability_guard_classify_database( $wpdb, $database_engine, $legacy_database_type, $has_sqlite_dropin );
}

/**
 * Select the concurrency-guard mode for the active database implementation.
 *
 * SQLite is always bypassed before filters run so MySQL lock SQL cannot be
 * enabled accidentally on WordPress Playground or another SQLite site.
 * Custom database drop-ins bypass the guard by default. A host may opt a
 * custom MySQL/MariaDB adapter into `mysql_named_lock` only after guaranteeing
 * that lock, availability, and write queries use the same primary server and
 * connection.
 *
 * @return string Either `mysql_named_lock` or `bypass`.
 */
function wpbc_booking_availability_guard_get_mode() {
	global $wpdb;

	$database_classification = wpbc_booking_availability_guard_get_database_classification();
	if ( 'sqlite' === $database_classification ) {
		return 'bypass';
	}

	$default_mode = ( 'core_mysql' === $database_classification ) ? 'mysql_named_lock' : 'bypass';

	/**
	 * Filters the booking availability guard mode for non-SQLite databases.
	 *
	 * Custom adapters must opt in only when advisory-lock and booking queries
	 * are guaranteed to use the same primary database server and connection.
	 *
	 * @param string $default_mode            Default `mysql_named_lock` or `bypass` mode.
	 * @param string $database_classification Database classification.
	 * @param object $wpdb                     Active WordPress database object.
	 */
	$guard_mode = apply_filters( 'wpbc_booking_availability_guard_mode', $default_mode, $database_classification, $wpdb );

	return ( 'mysql_named_lock' === $guard_mode ) ? 'mysql_named_lock' : 'bypass';
}

/**
 * Build the server-wide advisory-lock name for the current WordPress site.
 *
 * The hashed database name and table prefix keep multisite locks independent
 * and ensure the complete name remains below MySQL's 64-character limit.
 *
 * @return string Stable advisory-lock name.
 */
function wpbc_booking_availability_guard_get_lock_name() {
	global $wpdb;

	$database_name = defined( 'DB_NAME' ) ? DB_NAME : '';
	$table_prefix  = isset( $wpdb->prefix ) ? $wpdb->prefix : '';

	return 'wpbc_booking_' . md5( $database_name . '|' . $table_prefix );
}

/**
 * Run one scalar database query without exposing an expected capability error.
 *
 * The previous WordPress database error-suppression state is restored before
 * returning. An exception or database error is represented as `null`; callers
 * decide whether to bypass or reject the guarded operation.
 *
 * @param string $query Prepared SQL query.
 *
 * @return mixed|null Scalar result, or null when the query could not run.
 */
function wpbc_booking_availability_guard_get_var( $query ) {
	global $wpdb;

	$previous_suppression = null;
	$has_last_error       = is_object( $wpdb ) && property_exists( $wpdb, 'last_error' );
	$previous_last_error  = $has_last_error ? $wpdb->last_error : null;
	if ( is_object( $wpdb ) && method_exists( $wpdb, 'suppress_errors' ) ) {
		$previous_suppression = $wpdb->suppress_errors( true );
	}

	try {
		$query_result = $wpdb->get_var( $query ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared advisory-lock control query.
	} catch ( Exception $exception ) {
		$query_result = null;
	} catch ( Throwable $throwable ) {
		$query_result = null;
	} finally {
		if ( null !== $previous_suppression ) {
			$wpdb->suppress_errors( $previous_suppression );
		}
		if ( $has_last_error ) {
			$wpdb->last_error = $previous_last_error;
		}
	}

	return $query_result;
}

/**
 * Return the visitor-safe error used when a supported advisory lock is busy.
 *
 * @return WP_Error Retryable booking-save error.
 */
function wpbc_booking_availability_guard_get_busy_error() {
	return new WP_Error(
		'booking_availability_guard_busy',
		__( 'Another booking is being completed for this calendar. Please try again in a few seconds.', 'booking' )
	);
}

/**
 * Acquire the current site's booking availability guard.
 *
 * Unsupported databases deliberately return a bypass token so booking
 * creation remains available. A timeout on a supported lock returns a
 * retryable error because proceeding concurrently would defeat the guard.
 * Nested acquisitions in the same request use a depth counter and do not call
 * GET_LOCK() recursively.
 *
 * @param int $wait_seconds Maximum number of seconds to wait for the lock.
 *
 * @return array|WP_Error Guard token, or a retryable busy error.
 */
function wpbc_booking_availability_guard_acquire( $wait_seconds = 5 ) {
	global $wpdb;

	$database_classification = wpbc_booking_availability_guard_get_database_classification();
	$guard_mode               = wpbc_booking_availability_guard_get_mode();
	if ( 'mysql_named_lock' !== $guard_mode ) {
		return array(
			'mode'      => 'bypass',
			'reason'    => $database_classification,
			'lock_name' => '',
		);
	}

	$lock_name = wpbc_booking_availability_guard_get_lock_name();
	if ( ! isset( $GLOBALS['wpbc_booking_availability_guard_locks'] ) || ! is_array( $GLOBALS['wpbc_booking_availability_guard_locks'] ) ) {
		$GLOBALS['wpbc_booking_availability_guard_locks'] = array();
	}

	if ( ! empty( $GLOBALS['wpbc_booking_availability_guard_locks'][ $lock_name ]['depth'] ) ) {
		$nested_guard = array(
			'mode'      => 'mysql_named_lock',
			'reason'    => 'nested',
			'lock_name' => $lock_name,
		);
		if ( wpbc_booking_availability_guard_is_owned( $nested_guard ) ) {
			++$GLOBALS['wpbc_booking_availability_guard_locks'][ $lock_name ]['depth'];

			return $nested_guard;
		}

		unset( $GLOBALS['wpbc_booking_availability_guard_locks'][ $lock_name ] );
	}

	$wait_seconds = max( 0, min( 10, absint( $wait_seconds ) ) );
	$lock_query   = $wpdb->prepare( 'SELECT GET_LOCK(%s, %d)', $lock_name, $wait_seconds );
	$lock_result  = wpbc_booking_availability_guard_get_var( $lock_query );

	if ( '1' === (string) $lock_result ) {
		$GLOBALS['wpbc_booking_availability_guard_locks'][ $lock_name ] = array( 'depth' => 1 );

		return array(
			'mode'      => 'mysql_named_lock',
			'reason'    => 'acquired',
			'lock_name' => $lock_name,
		);
	}

	if ( '0' === (string) $lock_result ) {
		return wpbc_booking_availability_guard_get_busy_error();
	}

	return array(
		'mode'      => 'bypass',
		'reason'    => 'named_lock_unavailable',
		'lock_name' => '',
	);
}

/**
 * Determine whether a guard token represents an active named lock.
 *
 * @param array $guard_token Guard token returned by the acquire function.
 *
 * @return bool True for an active named-lock token.
 */
function wpbc_booking_availability_guard_is_active( $guard_token ) {
	return is_array( $guard_token )
		&& isset( $guard_token['mode'], $guard_token['lock_name'] )
		&& 'mysql_named_lock' === $guard_token['mode']
		&& '' !== $guard_token['lock_name'];
}

/**
 * Confirm that the current database connection still owns the named lock.
 *
 * Bypass tokens return true because no database lock is required. Active
 * tokens are checked immediately before persistence to detect a WordPress
 * database reconnection that implicitly released the session lock.
 *
 * @param array $guard_token Guard token returned by the acquire function.
 *
 * @return bool True when persistence may proceed under this token.
 */
function wpbc_booking_availability_guard_is_owned( $guard_token ) {
	global $wpdb;

	if ( ! wpbc_booking_availability_guard_is_active( $guard_token ) ) {
		return true;
	}

	$lock_name = $guard_token['lock_name'];
	if ( empty( $GLOBALS['wpbc_booking_availability_guard_locks'][ $lock_name ]['depth'] ) ) {
		return false;
	}

	$ownership_query  = $wpdb->prepare( 'SELECT IS_USED_LOCK(%s) = CONNECTION_ID()', $lock_name );
	$ownership_result = wpbc_booking_availability_guard_get_var( $ownership_query );

	return '1' === (string) $ownership_result;
}

/**
 * Release one acquisition depth for a booking availability guard.
 *
 * The outermost release executes RELEASE_LOCK(). The in-memory state is always
 * removed even when the database connection has already terminated, because
 * MySQL/MariaDB release session locks automatically on disconnect.
 *
 * @param array $guard_token Guard token returned by the acquire function.
 *
 * @return bool True when no release was required or the lock was released.
 */
function wpbc_booking_availability_guard_release( $guard_token ) {
	global $wpdb;

	if ( ! wpbc_booking_availability_guard_is_active( $guard_token ) ) {
		return true;
	}

	$lock_name = $guard_token['lock_name'];
	if ( empty( $GLOBALS['wpbc_booking_availability_guard_locks'][ $lock_name ]['depth'] ) ) {
		return false;
	}

	if ( 1 < $GLOBALS['wpbc_booking_availability_guard_locks'][ $lock_name ]['depth'] ) {
		--$GLOBALS['wpbc_booking_availability_guard_locks'][ $lock_name ]['depth'];

		return true;
	}

	unset( $GLOBALS['wpbc_booking_availability_guard_locks'][ $lock_name ] );
	$release_query  = $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name );
	$release_result = wpbc_booking_availability_guard_get_var( $release_query );

	return '1' === (string) $release_result;
}
