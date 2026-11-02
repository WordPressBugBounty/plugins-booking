<?php
/**
 * Booking activity append service.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validate and append immutable booking activity after successful mutations.
 */
final class WPBC_Booking_Activity_Append_Service {

	/** @var WPBC_Booking_Activity_Repository Activity repository. */
	private $repository;

	/** @var array<string,bool> Request-local event identities used by compatibility cutover. */
	private static $request_event_types = array();

	/** @var bool Whether the last append created a new immutable event. */
	private $last_append_was_created = false;

	/**
	 * Construct the service with an optional repository.
	 *
	 * @param WPBC_Booking_Activity_Repository|null $repository Optional repository.
	 */
	public function __construct( $repository = null ) {
		$this->repository = $repository ? $repository : new WPBC_Booking_Activity_Repository();
	}

	/**
	 * Append one typed event with retry-safe idempotency.
	 *
	 * Callers should pass a stable `idempotency_key` for operations that can be
	 * retried across requests. When omitted, the service derives a state-bound
	 * key from the preceding immutable stream position and safe payload. A
	 * successful append may repair the site's cron schedule, but never runs
	 * retention deletion in this request.
	 *
	 * @param int                 $booking_id Booking ID.
	 * @param string              $event_type Stable allow-listed event type.
	 * @param array<string,mixed> $payload    Candidate non-sensitive event metadata.
	 * @param array<string,mixed> $context    Actor, source, occurrence, and idempotency context.
	 *
	 * @return int|WP_Error Activity ID or safe error.
	 */
	public function append( $booking_id, $event_type, $payload = array(), $context = array() ) {
		$this->last_append_was_created = false;
		$booking_id = absint( $booking_id );
		$event_type = sanitize_key( $event_type );
		if ( ! $booking_id || ! in_array( $event_type, $this->get_allowed_event_types(), true ) ) {
			return new WP_Error( 'wpbc_booking_activity_invalid_event', __( 'The booking activity event is invalid.', 'booking' ) );
		}
		if ( ! wpbc_booking_activity_table_exists() ) {
			return new WP_Error( 'wpbc_booking_activity_storage_unavailable', __( 'Booking activity storage is not available.', 'booking' ) );
		}

		$booking_context = $this->repository->get_booking_context( $booking_id );
		if ( ! is_array( $booking_context ) ) {
			return new WP_Error( 'wpbc_booking_activity_booking_missing', __( 'Booking activity could not be recorded.', 'booking' ) );
		}
		$safe_payload    = $this->normalize_payload( $event_type, $payload );
		$event_source    = isset( $context['source'] ) ? sanitize_key( $context['source'] ) : 'system';
		$event_source    = in_array( $event_source, $this->get_allowed_sources(), true ) ? $event_source : 'system';
		$actor_user_id   = isset( $context['actor_user_id'] ) ? absint( $context['actor_user_id'] ) : get_current_user_id();
		$occurred_at     = isset( $context['occurred_at'] ) && $this->is_mysql_date_time( $context['occurred_at'] )
			? sanitize_text_field( $context['occurred_at'] )
			: current_time( 'mysql', true );
		$operation_key   = isset( $context['idempotency_key'] ) && is_scalar( $context['idempotency_key'] )
			? trim( (string) $context['idempotency_key'] )
			: '';
		if ( '' === $operation_key ) {
			$event_identity = $this->build_event_identity(
				$booking_id,
				isset( $booking_context['booking_type'] ) ? absint( $booking_context['booking_type'] ) : 0,
				$event_type,
				$safe_payload,
				$actor_user_id,
				$event_source
			);
			$latest_event   = $this->repository->get_latest_event( $booking_id );
			if ( $this->is_same_event_identity( $latest_event, $event_identity ) ) {
				self::$request_event_types[ $booking_id . ':' . $event_type ] = true;

				return absint( $latest_event['activity_id'] );
			}
			$operation_key = $this->build_state_key( $event_identity, $latest_event );
		}
		$idempotency_key = hash( 'sha256', get_current_blog_id() . '|' . $booking_id . '|' . $event_type . '|' . $operation_key );

		$event_id = $this->repository->insert_event(
			array(
				'booking_id'      => $booking_id,
				'resource_id'     => isset( $booking_context['booking_type'] ) ? absint( $booking_context['booking_type'] ) : 0,
				'event_type'      => $event_type,
				'event_payload'   => $safe_payload,
				'actor_user_id'   => $actor_user_id,
				'event_source'    => $event_source,
				'subject_hash'    => $this->get_subject_hash( $booking_context ),
				'idempotency_key' => $idempotency_key,
				'occurred_at'     => $occurred_at,
				'created_at'      => current_time( 'mysql', true ),
			)
		);
		if ( ! is_wp_error( $event_id ) ) {
			$this->last_append_was_created = method_exists( $this->repository, 'was_last_insert_created' )
				? $this->repository->was_last_insert_created()
				: true;
			self::$request_event_types[ $booking_id . ':' . $event_type ] = true;
			if ( function_exists( 'wpbc_booking_activity_retention_ensure_scheduled' ) ) {
				wpbc_booking_activity_retention_ensure_scheduled();
			}
		}

		return $event_id;
	}

	/**
	 * Report whether the preceding append created a new immutable event.
	 *
	 * Stable-operation retries return the original event ID with this flag false,
	 * allowing side-effect hooks to remain at most once.
	 *
	 * @return bool True only when the preceding append inserted a new row.
	 */
	public function was_last_append_created() {
		return $this->last_append_was_created;
	}

	/**
	 * Determine whether this request already appended an event type for a booking.
	 *
	 * @param int    $booking_id Booking ID.
	 * @param string $event_type Stable event type.
	 *
	 * @return bool True when already appended during this request.
	 */
	public static function was_recorded_in_request( $booking_id, $event_type ) {
		return isset( self::$request_event_types[ absint( $booking_id ) . ':' . sanitize_key( $event_type ) ] );
	}

	/**
	 * Return an existing event for one stable operation without appending it.
	 *
	 * @param int    $booking_id   Booking ID.
	 * @param string $event_type   Allow-listed event type.
	 * @param string $operation_id Stable server-generated operation identifier.
	 *
	 * @return int|WP_Error Existing Activity ID, zero, or a storage error.
	 */
	public function get_existing_operation_event_id( $booking_id, $event_type, $operation_id ) {
		$booking_id   = absint( $booking_id );
		$event_type   = sanitize_key( $event_type );
		$operation_id = is_scalar( $operation_id ) ? trim( (string) $operation_id ) : '';
		if ( ! $booking_id || ! in_array( $event_type, $this->get_allowed_event_types(), true ) || '' === $operation_id ) {
			return new WP_Error( 'wpbc_booking_activity_invalid_event', __( 'The booking activity event is invalid.', 'booking' ) );
		}
		if ( ! wpbc_booking_activity_table_exists() ) {
			return new WP_Error( 'wpbc_booking_activity_storage_unavailable', __( 'Booking activity storage is not available.', 'booking' ) );
		}

		return $this->repository->get_event_id_by_idempotency_key( $this->build_idempotency_key( $booking_id, $event_type, $operation_id ) );
	}

	/**
	 * Build the immutable site-local Activity key for one operation.
	 *
	 * @param int    $booking_id   Booking ID.
	 * @param string $event_type   Stable event type.
	 * @param string $operation_id Stable operation identifier.
	 *
	 * @return string SHA-256 persistence key.
	 */
	public function build_idempotency_key( $booking_id, $event_type, $operation_id ) {
		return hash( 'sha256', get_current_blog_id() . '|' . absint( $booking_id ) . '|' . sanitize_key( $event_type ) . '|' . trim( (string) $operation_id ) );
	}

	/**
	 * Return all supported typed event names.
	 *
	 * @return array<int,string> Stable event types.
	 */
	public function get_allowed_event_types() {
		return array(
			'booking_created',
			'booking_updated',
			'booking_approved',
			'booking_set_pending',
			'booking_trashed',
			'booking_restored',
			'booking_marked_read',
			'booking_marked_unread',
			'booking_locale_changed',
			'booking_resource_changed',
			'booking_duplicated',
			'booking_dates_updated',
			'booking_details_updated',
			'public_note_updated',
			'private_note_updated',
			'booking_cost_updated',
			'payment_status_updated',
			'payment_response_received',
			'payment_request_sent',
		);
	}

	/**
	 * Normalize payload fields per event type and discard private content.
	 *
	 * @param string              $event_type Event type.
	 * @param array<string,mixed> $payload    Candidate payload.
	 *
	 * @return array<string,mixed> Safe bounded payload.
	 */
	private function normalize_payload( $event_type, $payload ) {
		$payload       = is_array( $payload ) ? $payload : array();
		$safe_payload  = array();
		$allowed_keys  = array( 'before', 'after', 'resource_id', 'fields', 'gateway' );
		foreach ( $allowed_keys as $payload_key ) {
			if ( ! array_key_exists( $payload_key, $payload ) ) {
				continue;
			}
			if ( 'resource_id' === $payload_key ) {
				$safe_payload[ $payload_key ] = absint( $payload[ $payload_key ] );
			} elseif ( 'fields' === $payload_key ) {
				$normalized_fields = array_values( array_unique( array_filter( array_map( 'sanitize_key', (array) $payload[ $payload_key ] ) ) ) );
				sort( $normalized_fields, SORT_STRING );
				$safe_payload[ $payload_key ] = array_slice( $normalized_fields, 0, 25 );
			} elseif ( is_scalar( $payload[ $payload_key ] ) ) {
				$safe_payload[ $payload_key ] = substr( sanitize_text_field( (string) $payload[ $payload_key ] ), 0, 190 );
			}
		}
		if ( in_array( $event_type, array( 'booking_details_updated', 'booking_dates_updated' ), true ) && isset( $payload['change_set'] ) ) {
			$change_set = WPBC_Booking_Activity_Change_Set::normalize( $payload['change_set'] );
			if ( $change_set ) {
				$safe_payload['change_set'] = $change_set;
			}
		}
		ksort( $safe_payload, SORT_STRING );

		return $safe_payload;
	}

	/**
	 * Build the canonical identity of one normalized event candidate.
	 *
	 * @param int                 $booking_id    Booking ID.
	 * @param int                 $resource_id   Current Resource ID.
	 * @param string              $event_type    Event type.
	 * @param array<string,mixed> $payload       Safe payload.
	 * @param int                 $actor_user_id WordPress actor ID.
	 * @param string              $event_source  Server-owned event source.
	 *
	 * @return array<string,mixed> Canonical event identity.
	 */
	private function build_event_identity( $booking_id, $resource_id, $event_type, $payload, $actor_user_id, $event_source ) {
		return array(
			'booking_id'    => absint( $booking_id ),
			'resource_id'   => absint( $resource_id ),
			'event_type'    => sanitize_key( $event_type ),
			'event_payload' => $payload,
			'actor_user_id' => absint( $actor_user_id ),
			'event_source'  => sanitize_key( $event_source ),
		);
	}

	/**
	 * Determine whether the stream already ends with the retry candidate.
	 *
	 * @param array<string,mixed>|null $latest_event   Latest stored event.
	 * @param array<string,mixed>      $event_identity Canonical candidate identity.
	 *
	 * @return bool True when the latest event is the same logical operation.
	 */
	private function is_same_event_identity( $latest_event, $event_identity ) {
		if ( ! is_array( $latest_event ) || empty( $latest_event['activity_id'] ) ) {
			return false;
		}

		return absint( $latest_event['booking_id'] ) === $event_identity['booking_id']
			&& absint( $latest_event['resource_id'] ) === $event_identity['resource_id']
			&& sanitize_key( $latest_event['event_type'] ) === $event_identity['event_type']
			&& absint( $latest_event['actor_user_id'] ) === $event_identity['actor_user_id']
			&& sanitize_key( $latest_event['event_source'] ) === $event_identity['event_source']
			&& wp_json_encode( $latest_event['event_payload'] ) === wp_json_encode( $event_identity['event_payload'] );
	}

	/**
	 * Derive an operation key from an immutable stream position.
	 *
	 * Concurrent first attempts see the same previous event and therefore
	 * derive the same unique key. An immediate retry sees its matching event at
	 * the stream head and returns before this method is called.
	 *
	 * @param array<string,mixed>      $event_identity Canonical candidate identity.
	 * @param array<string,mixed>|null $latest_event   Latest stored event.
	 *
	 * @return string State-bound operation key.
	 */
	private function build_state_key( $event_identity, $latest_event ) {
		$previous_event_id = is_array( $latest_event ) && isset( $latest_event['activity_id'] )
			? absint( $latest_event['activity_id'] )
			: 0;

		return hash( 'sha256', wp_json_encode( $event_identity ) . '|' . $previous_event_id );
	}

	/**
	 * Build a one-way privacy subject identifier from the booking email field.
	 *
	 * @param array<string,mixed>|null $booking_context Current booking context.
	 *
	 * @return string SHA-256 normalized email hash or an empty string.
	 */
	private function get_subject_hash( $booking_context ) {
		if ( ! is_array( $booking_context ) || empty( $booking_context['form'] ) ) {
			return '';
		}
		$resource_id = isset( $booking_context['booking_type'] ) ? absint( $booking_context['booking_type'] ) : 1;
		$parsed_form = function_exists( 'wpbc_get_parsed_booking_data_arr' )
			? wpbc_get_parsed_booking_data_arr( $booking_context['form'], $resource_id, array( 'get' => 'value' ) )
			: array();
		$email = isset( $parsed_form['email'] ) ? sanitize_email( $parsed_form['email'] ) : '';

		return '' !== $email ? hash( 'sha256', strtolower( $email ) ) : '';
	}

	/**
	 * Return server-owned activity sources.
	 *
	 * @return array<int,string> Allowed source identifiers.
	 */
	private function get_allowed_sources() {
		return array( 'booking', 'inspector', 'timeline', 'payment', 'system', 'import', 'api', 'legacy' );
	}

	/**
	 * Validate a canonical MySQL date/time string.
	 *
	 * @param mixed $date_time Candidate date/time.
	 *
	 * @return bool True for a valid canonical value.
	 */
	private function is_mysql_date_time( $date_time ) {
		return is_scalar( $date_time ) && 1 === preg_match( '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', (string) $date_time );
	}
}
