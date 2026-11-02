<?php
/**
 * Booking Rescheduling browser proposal contract.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize the bounded, non-authoritative browser rescheduling proposal.
 *
 * This class validates only the transport shape shared by the dialog and
 * future pointer adapters. Authorization, source-token verification, saved
 * shape classification, Resource allocation, availability, Appointment rules,
 * pricing, and persistence remain server-owned responsibilities.
 *
 * @since 12.0.0
 */
final class WPBC_Booking_Rescheduling_Proposal_Contract {

	/** Current browser proposal schema. */
	const SCHEMA_VERSION = 2;

	/** Maximum encoded proposal size. */
	const MAX_PROPOSAL_BYTES = 65536;

	/** Maximum selected dates accepted in one proposal. */
	const MAX_PROPOSED_DATES = 1095;

	/** Maximum exact intervals accepted in one proposal. */
	const MAX_PROPOSED_INTERVALS = 1095;

	/** Maximum duration of one exact interval in minutes. */
	const MAX_INTERVAL_MINUTES = 1576800;

	/** Maximum opaque signed source-context token length. */
	const MAX_SOURCE_CONTEXT_TOKEN_BYTES = 4096;

	/** Minimum opaque signed source-context token length. */
	const MIN_SOURCE_CONTEXT_TOKEN_BYTES = 32;

	/** Maximum positive browser proposal revision. */
	const MAX_PROPOSAL_REVISION = 2147483647;

	/**
	 * Return the complete interaction-source allow list.
	 *
	 * @return array<int,string> Stable interaction-source identifiers.
	 */
	public static function get_allowed_interaction_sources() {
		return array( 'dialog', 'resize', 'drag', 'cross_resource_drag' );
	}

	/**
	 * Return the complete operation allow list.
	 *
	 * @return array<int,string> Stable operation identifiers.
	 */
	public static function get_allowed_operations() {
		return array( 'shift', 'resize_start', 'resize_end', 'replace_dates', 'change_resource' );
	}

	/**
	 * Return the allowed operation set for every interaction adapter.
	 *
	 * The map prevents a browser from disguising cross-Resource movement as a
	 * same-Resource drag or a resize as a generic shift. It is transport
	 * validation only; server shape and authorization checks remain mandatory.
	 *
	 * @return array<string,array<int,string>> Interaction-to-operation map.
	 */
	public static function get_interaction_operation_map() {
		return array(
			'dialog'             => array( 'replace_dates', 'change_resource' ),
			'resize'             => array( 'resize_start', 'resize_end' ),
			'drag'               => array( 'shift' ),
			'cross_resource_drag' => array( 'change_resource' ),
		);
	}

	/**
	 * Return the only top-level fields accepted from a browser proposal.
	 *
	 * @return array<int,string> Stable allow-listed field names.
	 */
	public static function get_allowed_fields() {
		return array(
			'schema_version',
			'booking_id',
			'interaction_source',
			'operation',
			'target_resource_id',
			'selection_method',
			'proposed_dates',
			'proposed_intervals',
			'proposal_revision',
			'source_context_token',
		);
	}

	/**
	 * Return authoritative fields explicitly forbidden in browser proposals.
	 *
	 * Unknown fields are also rejected. This named list documents the most
	 * security-sensitive values that must be reloaded or derived server-side.
	 *
	 * @return array<int,string> Forbidden authority and storage field names.
	 */
	public static function get_forbidden_authority_fields() {
		return array(
			'owner_id',
			'site_id',
			'capability',
			'capabilities',
			'original_resource_allocations',
			'allocated_resource_ids',
			'effective_resource_ids',
			'primary_resource_id',
			'booking_quantity',
			'eligible_child_resources',
			'schedule_fingerprint',
			'movement_eligibility',
			'movement_scope',
			'target_authorized',
			'availability',
			'availability_result',
			'capacity',
			'capacity_result',
			'appointment_compatibility',
			'pricing',
			'edition',
			'sql',
			'storage_rows',
			'template_path',
			'template_paths',
		);
	}

	/**
	 * Normalize one untrusted browser proposal.
	 *
 * Dates and intervals are mutually exclusive. The explicit selection method
 * distinguishes current policy geometry from individual-date intent without
 * granting any availability authority. Exact intervals use strict RFC3339
 * minute boundaries with an explicit UTC offset. Offsets are retained only as
 * proposal data; a later server workflow resolves them against the current
 * site timezone and rejects invalid or ambiguous DST transitions.
	 *
	 * @param mixed $proposal Untrusted browser proposal.
	 *
	 * @return array<string,mixed>|WP_Error Normalized proposal or safe error.
	 */
	public function normalize( $proposal ) {
		if ( ! is_array( $proposal ) ) {
			return $this->get_invalid_proposal_error();
		}

		$encoded_proposal = function_exists( 'wp_json_encode' ) ? wp_json_encode( $proposal ) : json_encode( $proposal );
		if ( ! is_string( $encoded_proposal ) || strlen( $encoded_proposal ) > self::MAX_PROPOSAL_BYTES ) {
			return $this->get_invalid_proposal_error();
		}

		$allowed_fields = array_fill_keys( self::get_allowed_fields(), true );
		foreach ( array_keys( $proposal ) as $proposal_key ) {
			if ( ! is_string( $proposal_key ) || ! isset( $allowed_fields[ $proposal_key ] ) ) {
				return $this->get_invalid_proposal_error();
			}
		}

		$schema_version = $this->normalize_positive_integer( isset( $proposal['schema_version'] ) ? $proposal['schema_version'] : null, self::SCHEMA_VERSION );
		$booking_id     = $this->normalize_positive_integer( isset( $proposal['booking_id'] ) ? $proposal['booking_id'] : null );
		$target_resource_id = $this->normalize_positive_integer( isset( $proposal['target_resource_id'] ) ? $proposal['target_resource_id'] : null );
		$proposal_revision  = $this->normalize_positive_integer(
			isset( $proposal['proposal_revision'] ) ? $proposal['proposal_revision'] : null,
			self::MAX_PROPOSAL_REVISION
		);
		if ( ! $schema_version || self::SCHEMA_VERSION !== $schema_version || ! $booking_id || ! $target_resource_id || ! $proposal_revision ) {
			return $this->get_invalid_proposal_error();
		}

		$raw_interaction_source = isset( $proposal['interaction_source'] ) && is_string( $proposal['interaction_source'] )
			? $proposal['interaction_source']
			: '';
		$raw_operation          = isset( $proposal['operation'] ) && is_string( $proposal['operation'] )
			? $proposal['operation']
			: '';
		$interaction_source     = sanitize_key( $raw_interaction_source );
		$operation              = sanitize_key( $raw_operation );
		$raw_selection_method   = isset( $proposal['selection_method'] ) && is_string( $proposal['selection_method'] )
			? $proposal['selection_method']
			: '';
		$selection_method       = sanitize_key( $raw_selection_method );
		$operation_map      = self::get_interaction_operation_map();
		if (
			$raw_interaction_source !== $interaction_source ||
			$raw_operation !== $operation ||
			! in_array( $interaction_source, self::get_allowed_interaction_sources(), true ) ||
			! in_array( $operation, self::get_allowed_operations(), true ) ||
			! isset( $operation_map[ $interaction_source ] ) ||
			! in_array( $operation, $operation_map[ $interaction_source ], true )
		) {
			return $this->get_invalid_proposal_error();
		}
		if ( $raw_selection_method !== $selection_method || ! in_array( $selection_method, array( 'policy', 'individual' ), true ) ) {
			return $this->get_invalid_proposal_error();
		}

		$source_context_token = isset( $proposal['source_context_token'] ) && is_scalar( $proposal['source_context_token'] )
			? trim( (string) $proposal['source_context_token'] )
			: '';
		$token_length         = strlen( $source_context_token );
		if (
			$token_length < self::MIN_SOURCE_CONTEXT_TOKEN_BYTES ||
			$token_length > self::MAX_SOURCE_CONTEXT_TOKEN_BYTES ||
			! preg_match( '/^[A-Za-z0-9._~-]+$/', $source_context_token )
		) {
			return $this->get_invalid_proposal_error();
		}

		$has_dates     = array_key_exists( 'proposed_dates', $proposal );
		$has_intervals = array_key_exists( 'proposed_intervals', $proposal );
		if ( $has_dates === $has_intervals || ( in_array( $operation, array( 'resize_start', 'resize_end' ), true ) && ! $has_intervals ) ) {
			return $this->get_invalid_proposal_error();
		}

		$normalized_proposal = array(
			'schema_version'      => self::SCHEMA_VERSION,
			'booking_id'          => $booking_id,
			'interaction_source'  => $interaction_source,
			'operation'           => $operation,
			'target_resource_id'  => $target_resource_id,
			'selection_method'    => $selection_method,
			'proposal_revision'   => $proposal_revision,
			'source_context_token' => $source_context_token,
		);

		if ( $has_dates ) {
			$proposed_dates = $this->normalize_dates( $proposal['proposed_dates'] );
			if ( is_wp_error( $proposed_dates ) ) {
				return $proposed_dates;
			}
			$normalized_proposal['proposed_dates'] = $proposed_dates;
		} else {
			$proposed_intervals = $this->normalize_intervals( $proposal['proposed_intervals'] );
			if ( is_wp_error( $proposed_intervals ) ) {
				return $proposed_intervals;
			}
			$normalized_proposal['proposed_intervals'] = $proposed_intervals;
		}

		return $normalized_proposal;
	}

	/**
	 * Normalize a strict positive integer without accepting floats or signs.
	 *
	 * @param mixed    $candidate Candidate integer.
	 * @param int|null $maximum   Optional maximum value.
	 *
	 * @return int Positive integer, or zero when invalid.
	 */
	private function normalize_positive_integer( $candidate, $maximum = null ) {
		if ( is_int( $candidate ) ) {
			$normalized = $candidate;
		} elseif ( is_string( $candidate ) && preg_match( '/^[1-9]\d*$/', $candidate ) ) {
			$normalized = (int) $candidate;
		} else {
			return 0;
		}

		if ( $normalized < 1 || ( null !== $maximum && $normalized > $maximum ) ) {
			return 0;
		}

		return $normalized;
	}

	/**
	 * Normalize ordered unique strict ISO calendar dates.
	 *
	 * @param mixed $proposed_dates Candidate date collection.
	 *
	 * @return array<int,string>|WP_Error Normalized dates or safe error.
	 */
	private function normalize_dates( $proposed_dates ) {
		if ( ! is_array( $proposed_dates ) || empty( $proposed_dates ) || count( $proposed_dates ) > self::MAX_PROPOSED_DATES ) {
			return $this->get_invalid_proposal_error();
		}

		$normalized_dates = array();
		foreach ( $proposed_dates as $proposed_date ) {
			if ( ! is_string( $proposed_date ) || ! preg_match( '/^(\d{4})-(\d{2})-(\d{2})$/', $proposed_date, $date_parts ) ) {
				return $this->get_invalid_proposal_error();
			}
			if ( ! checkdate( (int) $date_parts[2], (int) $date_parts[3], (int) $date_parts[1] ) ) {
				return $this->get_invalid_proposal_error();
			}
			$normalized_dates[ $proposed_date ] = $proposed_date;
		}

		$normalized_dates = array_values( $normalized_dates );
		sort( $normalized_dates, SORT_STRING );

		return $normalized_dates;
	}

	/**
	 * Normalize ordered unique strict RFC3339 exact-minute intervals.
	 *
	 * @param mixed $proposed_intervals Candidate interval collection.
	 *
	 * @return array<int,array{start:string,end:string}>|WP_Error Normalized intervals or safe error.
	 */
	private function normalize_intervals( $proposed_intervals ) {
		if ( ! is_array( $proposed_intervals ) || empty( $proposed_intervals ) || count( $proposed_intervals ) > self::MAX_PROPOSED_INTERVALS ) {
			return $this->get_invalid_proposal_error();
		}

		$normalized_intervals = array();
		foreach ( $proposed_intervals as $proposed_interval ) {
			if ( ! is_array( $proposed_interval ) || array( 'end', 'start' ) !== $this->get_sorted_array_keys( $proposed_interval ) ) {
				return $this->get_invalid_proposal_error();
			}

			$start = $this->normalize_exact_instant( $proposed_interval['start'] );
			$end   = $this->normalize_exact_instant( $proposed_interval['end'] );
			if ( ! $start || ! $end || $end['timestamp'] <= $start['timestamp'] ) {
				return $this->get_invalid_proposal_error();
			}

			$duration_minutes = ( $end['timestamp'] - $start['timestamp'] ) / 60;
			if ( $duration_minutes > self::MAX_INTERVAL_MINUTES ) {
				return $this->get_invalid_proposal_error();
			}

			$interval_key = $start['value'] . '|' . $end['value'];
			$normalized_intervals[ $interval_key ] = array(
				'start' => $start['value'],
				'end'   => $end['value'],
			);
		}

		ksort( $normalized_intervals, SORT_STRING );

		return array_values( $normalized_intervals );
	}

	/**
	 * Return sorted string keys for one bounded interval record.
	 *
	 * @param array<mixed> $record Candidate record.
	 *
	 * @return array<int,string> Sorted keys, or an empty array for non-string keys.
	 */
	private function get_sorted_array_keys( $record ) {
		$keys = array_keys( $record );
		foreach ( $keys as $key ) {
			if ( ! is_string( $key ) ) {
				return array();
			}
		}
		sort( $keys, SORT_STRING );

		return $keys;
	}

	/**
	 * Normalize one strict RFC3339 instant with exact-minute precision.
	 *
	 * @param mixed $instant Candidate timestamp.
	 *
	 * @return array{value:string,timestamp:int}|array{} Normalized value or empty record.
	 */
	private function normalize_exact_instant( $instant ) {
		if ( ! is_string( $instant ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:Z|[+-]\d{2}:\d{2})$/', $instant ) ) {
			return array();
		}

		$parse_value = 'Z' === substr( $instant, -1 ) ? substr( $instant, 0, -1 ) . '+00:00' : $instant;
		$date_time   = DateTimeImmutable::createFromFormat( '!Y-m-d\TH:i:sP', $parse_value );
		$parse_errors = DateTimeImmutable::getLastErrors();
		if ( ! $date_time || ( is_array( $parse_errors ) && ( $parse_errors['warning_count'] || $parse_errors['error_count'] ) ) ) {
			return array();
		}
		if ( $date_time->format( 'Y-m-d\TH:i:sP' ) !== $parse_value ) {
			return array();
		}

		return array(
			'value'     => $date_time->format( 'Y-m-d\TH:i:sP' ),
			'timestamp' => $date_time->getTimestamp(),
		);
	}

	/**
	 * Return the uniform malformed-proposal error without echoing input values.
	 *
	 * @return WP_Error Safe validation error.
	 */
	private function get_invalid_proposal_error() {
		return new WP_Error(
			'wpbc_booking_rescheduling_proposal_invalid',
			__( 'The proposed booking schedule is invalid. Reload the booking and try again.', 'booking' ),
			array( 'status' => 400 )
		);
	}
}
