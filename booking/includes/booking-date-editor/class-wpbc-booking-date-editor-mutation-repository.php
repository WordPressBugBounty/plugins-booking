<?php
/**
 * Booking Date Editor focused persistence repository.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Replace canonical booking-date rows and their derived booking values.
 *
 * A server-authorized cross-Resource replacement also keeps the encoded form
 * field identifiers aligned with the new primary Resource. Field values and
 * every unrelated booking column remain untouched.
 *
 * @since 12.0.0
 */
final class WPBC_Booking_Date_Editor_Mutation_Repository {

	/** @var wpdb|object Database adapter implementing the wpdb methods used here. */
	private $database;

	/** @var bool Whether canonical booking-date rows store allocation type IDs. */
	private $supports_resource_allocations;

	/** @var string|null Optional database-classification override for isolated tests. */
	private $database_classification;

	/**
	 * Construct the focused persistence repository.
	 *
	 * The optional arguments exist so development tests can exercise the real
	 * write, rollback, and compensation code without replacing the global
	 * WordPress database connection. Production callers use the current-site
	 * `$wpdb` adapter and the released Business Large schema decision.
	 *
	 * @param wpdb|object|null $database                      Optional compatible database adapter.
	 * @param bool|null        $supports_resource_allocations Optional allocation-column override.
	 * @param string|null      $database_classification       Optional guard database classification.
	 */
	public function __construct( $database = null, $supports_resource_allocations = null, $database_classification = null ) {
		global $wpdb;

		$this->database                      = null !== $database ? $database : $wpdb;
		$this->supports_resource_allocations = null === $supports_resource_allocations
			? class_exists( 'wpdev_bk_biz_l' )
			: (bool) $supports_resource_allocations;
		$this->database_classification = null === $database_classification ? null : sanitize_key( $database_classification );
	}

	/**
	 * Persist one already authorized and revalidated date allocation.
	 *
	 * Transactional MySQL/MariaDB tables use a transaction. Other database
	 * adapters use bounded compensation from exact before-images so a failed
	 * delete, insert, or derived-value update does not leave a partial change.
	 *
	 * @param int                              $booking_id                 Authorized booking ID.
	 * @param string                           $expected_modification_date Fresh optimistic-lock timestamp.
	 * @param string                           $sort_date                  Canonical first booking boundary.
	 * @param array<int,array<string,mixed>>   $canonical_date_rows        Canonical rows without storage IDs.
	 * @param int                              $target_resource_id          Optional server-authorized primary Resource replacement.
	 * @param string|null                      $synchronized_form           Optional server-derived canonical form storage.
	 *
	 * @return array<string,mixed>|WP_Error Persistence result or safe error.
	 */
	public function replace_booking_dates( $booking_id, $expected_modification_date, $sort_date, $canonical_date_rows, $target_resource_id = 0, $synchronized_form = null ) {
		$wpdb = $this->database;

		$booking_id                 = absint( $booking_id );
		$expected_modification_date = sanitize_text_field( (string) $expected_modification_date );
		$sort_date                  = sanitize_text_field( (string) $sort_date );
		$canonical_date_rows        = is_array( $canonical_date_rows ) ? $canonical_date_rows : array();
		$target_resource_id         = absint( $target_resource_id );
		$synchronized_form          = null === $synchronized_form ? null : (string) $synchronized_form;
		if (
			! $booking_id ||
			'' === $expected_modification_date ||
			empty( $canonical_date_rows ) ||
			! $this->is_valid_sort_date( $sort_date )
		) {
			return $this->get_storage_error();
		}
		foreach ( $canonical_date_rows as $canonical_date_row ) {
			if ( ! $this->is_valid_canonical_date_row( $canonical_date_row ) ) {
				return $this->get_storage_error();
			}
		}

		$before_booking = $this->get_booking_before_image( $booking_id, $expected_modification_date );
		if ( is_wp_error( $before_booking ) ) {
			return $before_booking;
		}
		$is_resource_change = $target_resource_id && $target_resource_id !== absint( $before_booking['booking_type'] );
		$updated_form       = null === $synchronized_form ? (string) $before_booking['form'] : $synchronized_form;
		if ( $is_resource_change ) {
			$updated_form = $this->replace_booking_form_resource_suffixes(
				$updated_form,
				absint( $before_booking['booking_type'] ),
				$target_resource_id
			);
			if ( is_wp_error( $updated_form ) ) {
				return $updated_form;
			}
		}
		$is_form_change = $updated_form !== (string) $before_booking['form'];
		$restores_booking_context = $is_resource_change || $is_form_change;
		$before_date_rows = $this->get_date_before_images( $booking_id );
		if ( is_wp_error( $before_date_rows ) ) {
			return $before_date_rows;
		}

		$uses_transaction  = $this->begin_transaction_if_supported();
		$modification_date = current_time( 'mysql' );
		if ( $modification_date === $expected_modification_date ) {
			$expected_timestamp = strtotime( $expected_modification_date . ' UTC' );
			$modification_date  = false === $expected_timestamp
				? $modification_date
				: gmdate( 'Y-m-d H:i:s', $expected_timestamp + 1 );
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Domain-owned optimistic update of the two derived booking values.
		$booking_update = array(
			'sort_date'         => $sort_date,
			'modification_date' => $modification_date,
		);
		$booking_update_formats = array( '%s', '%s' );
		if ( $is_resource_change ) {
			$booking_update['booking_type'] = $target_resource_id;
			$booking_update_formats[]       = '%d';
		}
		if ( $is_form_change ) {
			$booking_update['form']          = $updated_form;
			$booking_update_formats[]        = '%s';
		}
		$updated = $wpdb->update(
			$wpdb->prefix . 'booking',
			$booking_update,
			array(
				'booking_id'        => $booking_id,
				'modification_date' => $expected_modification_date,
				'trash'             => 0,
			),
			$booking_update_formats,
			array( '%d', '%s', '%d' )
		);
		if ( 1 !== $updated ) {
			if ( $uses_transaction ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- No date rows were touched; only the transaction must be closed.
				$wpdb->query( 'ROLLBACK' );
			}
			if ( false === $updated ) {
				return $this->get_storage_error();
			}

			return $this->get_stale_error();
		}

		$delete_sql = $wpdb->prepare(
			"DELETE FROM {$wpdb->prefix}bookingdates WHERE booking_id = %d",
			$booking_id
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared exact booking-date replacement.
		if ( false === $wpdb->query( $delete_sql ) ) {
			return $this->handle_write_failure( $uses_transaction, $restores_booking_context, $booking_id, $before_booking, $before_date_rows );
		}

		foreach ( $canonical_date_rows as $canonical_date_row ) {
			if ( ! $this->insert_date_row( $booking_id, $canonical_date_row ) ) {
				return $this->handle_write_failure( $uses_transaction, $restores_booking_context, $booking_id, $before_booking, $before_date_rows );
			}
		}

		$readback = $this->read_and_verify_persisted_state(
			$booking_id,
			$target_resource_id ? $target_resource_id : absint( $before_booking['booking_type'] ),
			$updated_form,
			$sort_date,
			$modification_date,
			$canonical_date_rows
		);
		if ( is_wp_error( $readback ) ) {
			return $this->handle_write_failure( $uses_transaction, $restores_booking_context, $booking_id, $before_booking, $before_date_rows );
		}

		if ( $uses_transaction && false === $wpdb->query( 'COMMIT' ) ) { // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Explicit domain transaction boundary.
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Attempt rollback before bounded compensation.
			if ( false !== $wpdb->query( 'ROLLBACK' ) ) {
				return $this->get_storage_error();
			}

			return $this->handle_write_failure( false, $restores_booking_context, $booking_id, $before_booking, $before_date_rows );
		}

		return array(
			'changed'           => true,
			'modification_date' => $readback['modification_date'],
			'used_transaction'  => $uses_transaction,
			'canonical_rows'    => $readback['canonical_rows'],
		);
	}

	/**
	 * Reread and verify the exact canonical values written by this repository.
	 *
	 * This check runs before transaction commit, or before a non-transactional
	 * write is accepted. Any mismatch enters the same rollback or bounded
	 * compensation path as an insert failure, so callers never receive intended
	 * proposal rows as though they were proven storage state.
	 *
	 * @param int                            $booking_id       Booking ID.
	 * @param int                            $resource_id      Expected primary Resource.
	 * @param string                         $form             Expected canonical form value.
	 * @param string                         $sort_date        Expected sort boundary.
	 * @param string                         $modification_date Expected modification timestamp.
	 * @param array<int,array<string,mixed>> $expected_rows    Expected canonical date rows.
	 *
	 * @return array<string,mixed>|WP_Error Verified canonical values or safe error.
	 */
	private function read_and_verify_persisted_state( $booking_id, $resource_id, $form, $sort_date, $modification_date, $expected_rows ) {
		$wpdb = $this->database;

		$booking_sql = $wpdb->prepare(
			"SELECT booking_id, booking_type, form, sort_date, modification_date, trash FROM {$wpdb->prefix}booking WHERE booking_id = %d LIMIT 1",
			$booking_id
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared canonical post-write readback.
		$booking = $wpdb->get_row( $booking_sql, ARRAY_A );
		if (
			! is_array( $booking )
			|| ! empty( $booking['trash'] )
			|| absint( $booking['booking_type'] ) !== absint( $resource_id )
			|| ! hash_equals( (string) $form, (string) $booking['form'] )
			|| ! hash_equals( (string) $sort_date, (string) $booking['sort_date'] )
			|| ! hash_equals( (string) $modification_date, (string) $booking['modification_date'] )
		) {
			return $this->get_storage_error();
		}

		$stored_rows = $this->get_date_before_images( $booking_id );
		if ( is_wp_error( $stored_rows ) ) {
			return $stored_rows;
		}
		$canonical_rows = $this->normalize_canonical_rows( $stored_rows );
		if ( $canonical_rows !== $this->normalize_canonical_rows( $expected_rows ) ) {
			return $this->get_storage_error();
		}

		return array(
			'modification_date' => (string) $booking['modification_date'],
			'canonical_rows'    => $canonical_rows,
		);
	}

	/**
	 * Normalize date rows for exact storage comparison and canonical readback.
	 *
	 * @param array<int,array<string,mixed>> $date_rows Stored or expected rows.
	 *
	 * @return array<int,array<string,mixed>> Ordered canonical row values.
	 */
	private function normalize_canonical_rows( $date_rows ) {
		$normalized_rows = array();

		foreach ( $date_rows as $date_row ) {
			$normalized_rows[] = array(
				'booking_date' => isset( $date_row['booking_date'] ) ? (string) $date_row['booking_date'] : '',
				'approved'     => ! empty( $date_row['approved'] ) ? 1 : 0,
				'type_id'      => isset( $date_row['type_id'] ) && null !== $date_row['type_id'] && 0 < absint( $date_row['type_id'] )
					? absint( $date_row['type_id'] )
					: null,
			);
		}

		return $normalized_rows;
	}

	/**
	 * Validate the derived sort boundary before a direct database write.
	 *
	 * @param string $sort_date Candidate SQL datetime.
	 *
	 * @return bool True for a strict canonical full-day or start boundary.
	 */
	private function is_valid_sort_date( $sort_date ) {
		$date_parts = $this->parse_sql_datetime( $sort_date );

		return ! empty( $date_parts ) && in_array( $date_parts['second'], array( 0, 1 ), true );
	}

	/**
	 * Validate one service-built canonical booking-date row.
	 *
	 * @param mixed $date_row Candidate row.
	 *
	 * @return bool True when the row is safe for focused persistence.
	 */
	private function is_valid_canonical_date_row( $date_row ) {
		if ( ! is_array( $date_row ) || ! array_key_exists( 'booking_date', $date_row ) || ! array_key_exists( 'approved', $date_row ) ) {
			return false;
		}

		$date_parts = $this->parse_sql_datetime( $date_row['booking_date'] );
		if (
			empty( $date_parts ) ||
			! in_array( $date_parts['second'], array( 0, 1, 2 ), true ) ||
			( 0 === $date_parts['second'] && ( 0 !== $date_parts['hour'] || 0 !== $date_parts['minute'] ) ) ||
			! in_array( $date_row['approved'], array( 0, 1 ), true )
		) {
			return false;
		}

		return ! isset( $date_row['type_id'] ) || null === $date_row['type_id'] || 0 < absint( $date_row['type_id'] );
	}

	/**
	 * Replace the Resource suffix in encoded booking form field identifiers.
	 *
	 * Booking form storage uses `type^field{resource_id}^value` records joined
	 * by `~`. Only the identifier component is changed. The field type, exact
	 * value, record order, array marker, and unrecognized historical records are
	 * preserved byte-for-byte so a Resource move cannot alter customer data.
	 *
	 * @param string $stored_form        Encoded booking form storage.
	 * @param int    $source_resource_id Current canonical Resource ID.
	 * @param int    $target_resource_id Server-authorized target Resource ID.
	 *
	 * @return string|WP_Error Rewritten storage or a safe validation error.
	 */
	private function replace_booking_form_resource_suffixes( $stored_form, $source_resource_id, $target_resource_id ) {
		$stored_form        = (string) $stored_form;
		$source_resource_id = absint( $source_resource_id );
		$target_resource_id = absint( $target_resource_id );
		if ( ! $source_resource_id || ! $target_resource_id ) {
			return $this->get_storage_error();
		}
		if ( '' === $stored_form || $source_resource_id === $target_resource_id ) {
			return $stored_form;
		}

		$source_suffix = (string) $source_resource_id;
		$target_suffix = (string) $target_resource_id;
		$records       = explode( '~', $stored_form );
		foreach ( $records as $record_index => $record ) {
			$parts = explode( '^', $record, 3 );
			if ( 3 !== count( $parts ) ) {
				continue;
			}

			$field_name  = $parts[1];
			$array_mark  = '[]' === substr( $field_name, -2 ) ? '[]' : '';
			$field_name  = $array_mark ? substr( $field_name, 0, -2 ) : $field_name;
			$suffix_size = strlen( $source_suffix );
			if ( $suffix_size > strlen( $field_name ) || $source_suffix !== substr( $field_name, -$suffix_size ) ) {
				continue;
			}

			$parts[1]               = substr( $field_name, 0, -$suffix_size ) . $target_suffix . $array_mark;
			$records[ $record_index ] = implode( '^', $parts );
		}

		return implode( '~', $records );
	}

	/**
	 * Parse one strict SQL datetime without applying a server timezone.
	 *
	 * @param mixed $date_time Candidate SQL datetime.
	 *
	 * @return array<string,int> Parsed parts, or an empty array when invalid.
	 */
	private function parse_sql_datetime( $date_time ) {
		$date_time = is_scalar( $date_time ) ? trim( (string) $date_time ) : '';
		if ( ! preg_match( '/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/', $date_time, $matches ) ) {
			return array();
		}

		$date_parts = array(
			'year'   => (int) $matches[1],
			'month'  => (int) $matches[2],
			'day'    => (int) $matches[3],
			'hour'   => (int) $matches[4],
			'minute' => (int) $matches[5],
			'second' => (int) $matches[6],
		);
		if (
			! checkdate( $date_parts['month'], $date_parts['day'], $date_parts['year'] ) ||
			23 < $date_parts['hour'] ||
			59 < $date_parts['minute'] ||
			59 < $date_parts['second']
		) {
			return array();
		}

		return $date_parts;
	}

	/**
	 * Load the derived booking values before mutation and enforce stale state.
	 *
	 * @param int    $booking_id                 Booking ID.
	 * @param string $expected_modification_date Expected timestamp.
	 *
	 * @return array<string,mixed>|WP_Error Before-image or safe error.
	 */
	private function get_booking_before_image( $booking_id, $expected_modification_date ) {
		$wpdb = $this->database;

		$sql = $wpdb->prepare(
			"SELECT booking_id, booking_type, form, sort_date, modification_date, trash FROM {$wpdb->prefix}booking WHERE booking_id = %d LIMIT 1",
			$booking_id
		);
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared exact current-site booking lookup.
		$booking = $wpdb->get_row( $sql, ARRAY_A );
		if ( ! is_array( $booking ) || ! empty( $booking['trash'] ) || ! hash_equals( $expected_modification_date, (string) $booking['modification_date'] ) ) {
			return $this->get_stale_error();
		}

		return $booking;
	}

	/**
	 * Load exact booking-date rows for bounded compensation.
	 *
	 * @param int $booking_id Booking ID.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Exact before-images or safe error.
	 */
	private function get_date_before_images( $booking_id ) {
		$wpdb = $this->database;

		$field_names = $this->supports_resource_allocations
			? 'booking_dates_id, booking_id, booking_date, approved, type_id'
			: 'booking_dates_id, booking_id, booking_date, approved';
		$sql         = $wpdb->prepare(
			"SELECT {$field_names} FROM {$wpdb->prefix}bookingdates WHERE booking_id = %d ORDER BY booking_dates_id ASC",
			$booking_id
		); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Field list is selected only from two repository-owned constants.
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Prepared exact current-site date lookup.
		$date_rows = $wpdb->get_results( $sql, ARRAY_A );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $date_rows ) || empty( $date_rows ) ) {
			return $this->get_storage_error();
		}

		return $date_rows;
	}

	/**
	 * Start a transaction only when both canonical tables use a transactional engine.
	 *
	 * @return bool True when a transaction started successfully.
	 */
	private function begin_transaction_if_supported() {
		$wpdb = $this->database;

		$database_classification = null !== $this->database_classification
			? $this->database_classification
			: ( function_exists( 'wpbc_booking_availability_guard_get_database_classification' ) ? wpbc_booking_availability_guard_get_database_classification() : '' );
		if ( 'core_mysql' !== $database_classification ) {
			return false;
		}
		$table_names = array( $wpdb->prefix . 'booking', $wpdb->prefix . 'bookingdates' );
		foreach ( $table_names as $table_name ) {
			$table_status_sql = $wpdb->prepare( 'SHOW TABLE STATUS WHERE Name = %s', $table_name );
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Engine detection determines whether rollback is reliable.
			$table_status = $wpdb->get_row( $table_status_sql, ARRAY_A );
			if ( ! is_array( $table_status ) || empty( $table_status['Engine'] ) || ! in_array( strtolower( (string) $table_status['Engine'] ), array( 'innodb', 'ndbcluster' ), true ) ) {
				return false;
			}
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Explicit domain transaction boundary.
		return false !== $wpdb->query( 'START TRANSACTION' );
	}

	/**
	 * Insert one canonical booking-date row.
	 *
	 * @param int                       $booking_id Booking ID.
	 * @param array<string,mixed>       $date_row  Canonical date row.
	 *
	 * @return bool True on success.
	 */
	private function insert_date_row( $booking_id, $date_row ) {
		$wpdb = $this->database;

		$insert_values = array(
			'booking_id'   => absint( $booking_id ),
			'booking_date' => isset( $date_row['booking_date'] ) ? (string) $date_row['booking_date'] : '',
			'approved'     => ! empty( $date_row['approved'] ) ? 1 : 0,
		);
		$insert_formats = array( '%d', '%s', '%d' );
		if ( $this->supports_resource_allocations ) {
			$insert_values['type_id'] = ! empty( $date_row['type_id'] ) ? absint( $date_row['type_id'] ) : null;
			$insert_formats[]          = '%d';
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Domain-owned canonical booking-date insert.
		return false !== $wpdb->insert( $wpdb->prefix . 'bookingdates', $insert_values, $insert_formats );
	}

	/**
	 * Roll back a transaction or restore bounded before-images.
	 *
	 * @param bool                            $uses_transaction          Transaction state.
	 * @param bool                            $restores_booking_context Whether Resource or form storage was changed.
	 * @param int                             $booking_id               Booking ID.
	 * @param array<string,mixed>             $before_booking           Booking before-image.
	 * @param array<int,array<string,mixed>>  $before_rows              Date before-images.
	 *
	 * @return bool True when rollback or compensation completed.
	 */
	private function rollback_or_compensate( $uses_transaction, $restores_booking_context, $booking_id, $before_booking, $before_rows ) {
		$wpdb = $this->database;

		if ( $uses_transaction ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Explicit domain transaction rollback.
			return false !== $wpdb->query( 'ROLLBACK' );
		}

		$delete_sql = $wpdb->prepare( "DELETE FROM {$wpdb->prefix}bookingdates WHERE booking_id = %d", $booking_id );
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Bounded compensation for this exact booking.
		if ( false === $wpdb->query( $delete_sql ) ) {
			return false;
		}
		foreach ( $before_rows as $before_row ) {
			$insert_values = array(
				'booking_dates_id' => absint( $before_row['booking_dates_id'] ),
				'booking_id'       => absint( $before_row['booking_id'] ),
				'booking_date'     => (string) $before_row['booking_date'],
				'approved'         => ! empty( $before_row['approved'] ) ? 1 : 0,
			);
			$insert_formats = array( '%d', '%d', '%s', '%d' );
			if ( $this->supports_resource_allocations ) {
				$insert_values['type_id'] = isset( $before_row['type_id'] ) && null !== $before_row['type_id'] ? absint( $before_row['type_id'] ) : null;
				$insert_formats[]          = '%d';
			}
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Exact bounded date-row compensation.
			if ( false === $wpdb->insert( $wpdb->prefix . 'bookingdates', $insert_values, $insert_formats ) ) {
				return false;
			}
		}

		$booking_restore = array(
			'sort_date'         => $before_booking['sort_date'],
			'modification_date' => $before_booking['modification_date'],
		);
		$booking_restore_formats = array( '%s', '%s' );
		if ( $restores_booking_context ) {
			$booking_restore['booking_type'] = absint( $before_booking['booking_type'] );
			$booking_restore['form']         = (string) $before_booking['form'];
			$booking_restore_formats[]       = '%d';
			$booking_restore_formats[]       = '%s';
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Restore exact changed booking values.
		return false !== $wpdb->update(
			$wpdb->prefix . 'booking',
			$booking_restore,
			array( 'booking_id' => $booking_id ),
			$booking_restore_formats,
			array( '%d' )
		);
	}

	/**
	 * Convert one write failure into a safe error after rollback/compensation.
	 *
	 * @param bool                            $uses_transaction          Transaction state.
	 * @param bool                            $restores_booking_context Whether Resource or form storage was changed.
	 * @param int                             $booking_id               Booking ID.
	 * @param array<string,mixed>             $before_booking           Booking before-image.
	 * @param array<int,array<string,mixed>>  $before_rows              Date before-images.
	 *
	 * @return WP_Error Safe storage or compensation error.
	 */
	private function handle_write_failure( $uses_transaction, $restores_booking_context, $booking_id, $before_booking, $before_rows ) {
		if ( ! $this->rollback_or_compensate( $uses_transaction, $restores_booking_context, $booking_id, $before_booking, $before_rows ) ) {
			return new WP_Error(
				'wpbc_booking_date_editor_compensation_failed',
				__( 'Booking dates could not be restored after a storage error. Contact the website administrator.', 'booking' ),
				array( 'status' => 500 )
			);
		}

		return $this->get_storage_error();
	}

	/**
	 * Return the uniform stale-source error.
	 *
	 * @return WP_Error Safe stale error.
	 */
	private function get_stale_error() {
		return new WP_Error(
			'wpbc_booking_date_editor_apply_stale',
			__( 'The booking changed after it was reviewed. Reload the dates and review the changes again.', 'booking' ),
			array( 'status' => 409 )
		);
	}

	/**
	 * Return the uniform persistence error.
	 *
	 * @return WP_Error Safe storage error.
	 */
	private function get_storage_error() {
		return new WP_Error(
			'wpbc_booking_date_editor_apply_failed',
			__( 'Booking date changes could not be saved. Try again.', 'booking' ),
			array( 'status' => 500 )
		);
	}
}
