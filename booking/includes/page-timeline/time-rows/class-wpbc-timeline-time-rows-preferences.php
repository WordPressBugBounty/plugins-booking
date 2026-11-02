<?php
/**
 * Per-user, per-Resource Timeline time-row presentation preferences.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validate and persist domain-owned time-row presentation settings.
 *
 * The service stores only executable-free presentation values inside the
 * shared site-scoped Timeline user-option record. Resource authorization is
 * deliberately rechecked by the thin AJAX boundary before this service saves.
 */
final class WPBC_Timeline_Time_Rows_Preferences {

	/** Domain-owned shared preference extension key. */
	const EXTENSION_KEY = 'time_rows';

	/** Stored extension schema version. */
	const SCHEMA_VERSION = 1;

	/** Maximum Resource preference records retained for one user and site. */
	const MAXIMUM_STORED_RESOURCES = 500;

	/** @var WPBC_Timeline_Resource_View_Preferences Shared site-scoped storage. */
	private $storage;

	/** @var array<string,mixed>|null Request-local normalized extension cache. */
	private $extension_record;

	/**
	 * Construct the preference service.
	 *
	 * @param WPBC_Timeline_Resource_View_Preferences|null $storage Optional test-safe shared storage.
	 */
	public function __construct( $storage = null ) {
		$this->storage = $storage ? $storage : new WPBC_Timeline_Resource_View_Preferences();
	}

	/**
	 * Return defaults or the stored settings for one authorized Resource DTO.
	 *
	 * @param int $resource_id Authorized booking Resource ID.
	 *
	 * @return array<string,mixed> JSON-safe presentation preferences.
	 */
	public function get_for_resource( $resource_id ) {
		$resource_id = absint( $resource_id );
		$record      = $this->get_extension_record();
		$resource_key = (string) $resource_id;
		$is_persisted = $resource_id && isset( $record['resources'][ $resource_key ] );
		$preferences = $is_persisted
			? $this->normalize_stored_preferences( $record['resources'][ $resource_key ] )
			: $this->get_default_preferences();

		$preferences['schema_version'] = self::SCHEMA_VERSION;
		$preferences['is_persisted']   = $is_persisted;

		return $preferences;
	}

	/**
	 * Validate and save time-row settings for one already-authorized Resource.
	 *
	 * Defaults remove the Resource entry so storage remains compact. When the
	 * bounded collection is full, the oldest associative entry is evicted before
	 * the new Resource is appended.
	 *
	 * @param int                 $resource_id Authorized booking Resource ID.
	 * @param array<string,mixed> $candidate   Untrusted request values.
	 *
	 * @return array<string,mixed>|WP_Error Saved DTO or safe validation error.
	 */
	public function save_for_resource( $resource_id, $candidate ) {
		$resource_id = absint( $resource_id );
		if ( ! $resource_id ) {
			return $this->error( 'wpbc_timeline_time_rows_resource_invalid', __( 'The booking Resource is invalid.', 'booking' ), 400 );
		}

		$validated = $this->validate_preferences( $candidate );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		$record       = $this->get_extension_record();
		$resource_key = (string) $resource_id;
		if ( $this->is_default_preferences( $validated ) ) {
			unset( $record['resources'][ $resource_key ] );
		} else {
			unset( $record['resources'][ $resource_key ] );
			while ( count( $record['resources'] ) >= self::MAXIMUM_STORED_RESOURCES ) {
				array_shift( $record['resources'] );
			}
			$record['resources'][ $resource_key ] = $validated;
		}

		$extension_record = empty( $record['resources'] ) ? array() : $record;
		if ( ! $this->storage->save_extension( self::EXTENSION_KEY, $extension_record ) ) {
			return $this->error( 'wpbc_timeline_time_rows_preferences_not_saved', __( 'The expanded schedule settings could not be saved.', 'booking' ), 500 );
		}

		$this->extension_record = $this->normalize_extension_record( $extension_record );

		return $this->get_for_resource( $resource_id );
	}

	/**
	 * Strictly validate executable-free browser preference values.
	 *
	 * @param mixed $candidate Untrusted request candidate.
	 *
	 * @return array<string,mixed>|WP_Error Normalized settings or safe error.
	 */
	public function validate_preferences( $candidate ) {
		if ( ! is_array( $candidate ) ) {
			return $this->error( 'wpbc_timeline_time_rows_preferences_invalid', __( 'The expanded schedule settings are invalid.', 'booking' ), 400 );
		}

		$mode = isset( $candidate['range_mode'] ) && is_scalar( $candidate['range_mode'] )
			? sanitize_key( (string) $candidate['range_mode'] )
			: '';
		if ( ! in_array( $mode, array( 'auto', 'full_day', 'custom' ), true ) ) {
			return $this->error( 'wpbc_timeline_time_rows_range_mode_invalid', __( 'The expanded schedule time range is invalid.', 'booking' ), 400 );
		}

		$zoom_percent = $this->validate_integer(
			isset( $candidate['zoom_percent'] ) ? $candidate['zoom_percent'] : null,
			WPBC_Timeline_Time_Rows_Config::TIME_ZOOM_MIN_PERCENT,
			WPBC_Timeline_Time_Rows_Config::TIME_ZOOM_MAX_PERCENT,
			WPBC_Timeline_Time_Rows_Config::TIME_ZOOM_STEP_PERCENT
		);
		if ( false === $zoom_percent ) {
			return $this->error( 'wpbc_timeline_time_rows_zoom_invalid', __( 'The expanded schedule density is invalid.', 'booking' ), 400 );
		}

		$range_policy = array( 'mode' => $mode );
		if ( 'custom' === $mode ) {
			$start_minute = $this->validate_integer(
				isset( $candidate['start_minute'] ) ? $candidate['start_minute'] : null,
				0,
				1440 - WPBC_Timeline_Time_Rows_Config::TIME_RANGE_STEP_MINUTES,
				WPBC_Timeline_Time_Rows_Config::TIME_RANGE_STEP_MINUTES
			);
			$end_minute = $this->validate_integer(
				isset( $candidate['end_minute'] ) ? $candidate['end_minute'] : null,
				WPBC_Timeline_Time_Rows_Config::TIME_RANGE_STEP_MINUTES,
				1440,
				WPBC_Timeline_Time_Rows_Config::TIME_RANGE_STEP_MINUTES
			);
			if ( false === $start_minute || false === $end_minute || $end_minute <= $start_minute ) {
				return $this->error( 'wpbc_timeline_time_rows_custom_range_invalid', __( 'The custom expanded schedule time range is invalid.', 'booking' ), 400 );
			}
			$range_policy['start_minute'] = $start_minute;
			$range_policy['end_minute']   = $end_minute;
		}

		return array(
			'range_policy' => $range_policy,
			'zoom_percent' => $zoom_percent,
		);
	}

	/**
	 * Load and normalize the complete bounded extension once per request.
	 *
	 * @return array<string,mixed> Normalized extension record.
	 */
	private function get_extension_record() {
		if ( null === $this->extension_record ) {
			$this->extension_record = $this->normalize_extension_record(
				$this->storage->get_extension( self::EXTENSION_KEY )
			);
		}

		return $this->extension_record;
	}

	/**
	 * Normalize stored extension data without treating it as a browser request.
	 *
	 * @param mixed $stored_record Untrusted user-meta value.
	 *
	 * @return array<string,mixed> Bounded normalized extension record.
	 */
	private function normalize_extension_record( $stored_record ) {
		$stored_record = is_array( $stored_record ) ? $stored_record : array();
		$resources     = isset( $stored_record['resources'] ) && is_array( $stored_record['resources'] )
			? $stored_record['resources']
			: array();
		$normalized = array();

		foreach ( $resources as $resource_id => $preferences ) {
			$resource_id = absint( $resource_id );
			if ( ! $resource_id || count( $normalized ) >= self::MAXIMUM_STORED_RESOURCES ) {
				continue;
			}
			$normalized[ (string) $resource_id ] = $this->normalize_stored_preferences( $preferences );
		}

		return array(
			'schema_version' => self::SCHEMA_VERSION,
			'resources'      => $normalized,
		);
	}

	/**
	 * Normalize one previously stored Resource record to safe defaults.
	 *
	 * @param mixed $preferences Stored Resource preference value.
	 *
	 * @return array<string,mixed> Normalized range and zoom.
	 */
	private function normalize_stored_preferences( $preferences ) {
		$preferences = is_array( $preferences ) ? $preferences : array();
		$range       = isset( $preferences['range_policy'] ) && is_array( $preferences['range_policy'] )
			? $preferences['range_policy']
			: array();
		$candidate = array(
			'range_mode'   => isset( $range['mode'] ) ? $range['mode'] : 'auto',
			'start_minute' => isset( $range['start_minute'] ) ? $range['start_minute'] : 0,
			'end_minute'   => isset( $range['end_minute'] ) ? $range['end_minute'] : 1440,
			'zoom_percent' => isset( $preferences['zoom_percent'] ) ? $preferences['zoom_percent'] : WPBC_Timeline_Time_Rows_Config::TIME_ZOOM_DEFAULT_PERCENT,
		);
		$validated = $this->validate_preferences( $candidate );

		return is_wp_error( $validated ) ? $this->get_default_preferences() : $validated;
	}

	/**
	 * Return canonical first-use settings.
	 *
	 * @return array<string,mixed> Auto range and normal density.
	 */
	private function get_default_preferences() {
		return array(
			'range_policy' => array( 'mode' => 'auto' ),
			'zoom_percent' => WPBC_Timeline_Time_Rows_Config::TIME_ZOOM_DEFAULT_PERCENT,
		);
	}

	/**
	 * Determine whether normalized values equal the storage-free defaults.
	 *
	 * @param array<string,mixed> $preferences Normalized preferences.
	 *
	 * @return bool True when the Resource entry can be omitted.
	 */
	private function is_default_preferences( $preferences ) {
		return $preferences === $this->get_default_preferences();
	}

	/**
	 * Validate a bounded stepped integer without coercing malformed values.
	 *
	 * @param mixed $candidate Untrusted scalar candidate.
	 * @param int   $minimum   Inclusive minimum.
	 * @param int   $maximum   Inclusive maximum.
	 * @param int   $step      Required increment from the minimum.
	 *
	 * @return int|false Validated integer, or false.
	 */
	private function validate_integer( $candidate, $minimum, $maximum, $step ) {
		if ( ! is_scalar( $candidate ) || ! preg_match( '/^-?\d+$/', (string) $candidate ) ) {
			return false;
		}
		$candidate = (int) $candidate;
		if ( $candidate < $minimum || $candidate > $maximum || 0 !== ( $candidate - $minimum ) % $step ) {
			return false;
		}

		return $candidate;
	}

	/**
	 * Create one safe validation or persistence error.
	 *
	 * @param string $code    Stable error code.
	 * @param string $message Translated safe message.
	 * @param int    $status  HTTP status.
	 *
	 * @return WP_Error Error with a bounded status value.
	 */
	private function error( $code, $message, $status ) {
		return new WP_Error( $code, $message, array( 'status' => absint( $status ) ) );
	}
}
