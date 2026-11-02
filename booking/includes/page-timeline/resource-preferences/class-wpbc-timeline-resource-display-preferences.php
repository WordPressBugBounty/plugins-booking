<?php
/**
 * Versioned per-Resource Timeline display-preference contract.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validate and persist current-user, site-scoped Resource display overrides.
 */
final class WPBC_Timeline_Resource_Display_Preferences {

	/** Current display-preference schema version. */
	const SCHEMA_VERSION = 1;

	/** Separate user-option key for per-Resource display overrides. */
	const USER_OPTION_KEY = 'booking_custom_wpbc_timeline_resource_display_preferences';

	/** Dynamically inherit the current global Timeline booking-title template. */
	const BOOKING_TITLE_MODE_INHERIT = 'inherit';

	/** Use one Resource-specific booking-title template. */
	const BOOKING_TITLE_MODE_CUSTOM = 'custom';

	/** Maximum number of retained per-Resource records. */
	const MAXIMUM_RESOURCE_PREFERENCES = 500;

	/** Maximum normalized booking-title template length. */
	const MAXIMUM_TEMPLATE_LENGTH = 200;

	/** @var int Current user ID. */
	private $user_id;

	/** @var callable|null Optional test-safe storage reader. */
	private $read_callback;

	/** @var callable|null Optional test-safe storage writer. */
	private $write_callback;

	/**
	 * Construct the display-preference service.
	 *
	 * @param int|null      $user_id        Current user ID, or null to resolve it.
	 * @param callable|null $read_callback  Optional storage reader.
	 * @param callable|null $write_callback Optional storage writer.
	 */
	public function __construct( $user_id = null, $read_callback = null, $write_callback = null ) {
		$this->user_id        = null === $user_id ? $this->resolve_current_user_id() : absint( $user_id );
		$this->read_callback  = is_callable( $read_callback ) ? $read_callback : null;
		$this->write_callback = is_callable( $write_callback ) ? $write_callback : null;
	}

	/**
	 * Return the normalized versioned display-preference record.
	 *
	 * @return array<string,mixed> Schema-version 1 record.
	 */
	public function get_record() {
		return $this->normalize_stored_record( $this->read_stored_record() );
	}

	/**
	 * Normalize untrusted stored display preferences without writing them.
	 *
	 * Invalid entries are ignored on read so one corrupt value cannot prevent
	 * Timeline from loading. Save requests use the strict validator instead.
	 *
	 * @param mixed $stored_record Untrusted stored value.
	 *
	 * @return array<string,mixed> Normalized record.
	 */
	public function normalize_stored_record( $stored_record ) {
		$stored_record = is_array( $stored_record ) ? $stored_record : array();
		$resources     = isset( $stored_record['resources'] ) && is_array( $stored_record['resources'] )
			? $stored_record['resources']
			: array();
		$normalized    = array();

		foreach ( $resources as $resource_id => $resource_preference ) {
			if ( count( $normalized ) >= self::MAXIMUM_RESOURCE_PREFERENCES || ! $this->is_positive_integer_scalar( $resource_id ) ) {
				continue;
			}
			$candidate = is_array( $resource_preference ) && isset( $resource_preference['booking_title'] )
				? $resource_preference['booking_title']
				: array();
			$result    = $this->validate_booking_title_preference( $candidate );
			if ( is_wp_error( $result ) ) {
				continue;
			}
			$normalized[ (string) (int) $resource_id ] = array( 'booking_title' => $result );
		}

		return array(
			'schema_version' => self::SCHEMA_VERSION,
			'resources'      => $normalized,
		);
	}

	/**
	 * Return one Resource booking-title preference or the inheritance default.
	 *
	 * @param mixed          $resource_id             Untrusted Resource ID.
	 * @param array<int,int> $authorized_resource_ids Current authorized Resource IDs.
	 *
	 * @return array<string,string>|WP_Error Mode/template or safe ownership error.
	 */
	public function get_booking_title_preference( $resource_id, $authorized_resource_ids ) {
		if ( ! $this->is_positive_integer_scalar( $resource_id ) ) {
			return $this->error( 'wpbc_timeline_resource_id_invalid', __( 'The booking Resource identifier is invalid.', 'booking' ), 400 );
		}
		$resource_id = (int) $resource_id;
		$authorized_resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $authorized_resource_ids ) ) ) );
		if ( ! in_array( $resource_id, $authorized_resource_ids, true ) ) {
			return $this->error( 'wpbc_timeline_resource_settings_unavailable', __( 'The booking Resource settings are not available.', 'booking' ), 404 );
		}
		$record      = $this->get_record();
		$key         = (string) $resource_id;

		return $resource_id && isset( $record['resources'][ $key ]['booking_title'] )
			? $record['resources'][ $key ]['booking_title']
			: array(
				'mode'     => self::BOOKING_TITLE_MODE_INHERIT,
				'template' => '',
			);
	}

	/**
	 * Batch-read booking-title preferences for authorized Resources.
	 *
	 * The caller supplies Resource IDs that have already passed the Timeline
	 * repository's ownership and edition boundary. Reading the complete option
	 * once prevents Resource-specific title resolution from introducing one
	 * user-option read per Timeline row.
	 *
	 * @param array<int,int> $authorized_resource_ids Authorized effective Resource IDs.
	 *
	 * @return array<int,array<string,string>> Preferences keyed by Resource ID.
	 */
	public function get_booking_title_preferences( $authorized_resource_ids ) {
		$authorized_resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $authorized_resource_ids ) ) ) );
		if ( empty( $authorized_resource_ids ) ) {
			return array();
		}
		$record                  = $this->get_record();
		$preferences             = array();

		foreach ( $authorized_resource_ids as $resource_id ) {
			$key = (string) $resource_id;
			$preferences[ $resource_id ] = isset( $record['resources'][ $key ]['booking_title'] )
				? $record['resources'][ $key ]['booking_title']
				: array(
					'mode'     => self::BOOKING_TITLE_MODE_INHERIT,
					'template' => '',
				);
		}

		return $preferences;
	}

	/**
	 * Determine whether one authorized Resource has an explicit stored record.
	 *
	 * Explicit inheritance remains distinguishable from a missing record so the
	 * settings inspector can offer a true reset operation without resolving or
	 * rendering booking titles.
	 *
	 * @param mixed          $resource_id             Untrusted Resource ID.
	 * @param array<int,int> $authorized_resource_ids Current authorized Resource IDs.
	 *
	 * @return bool|WP_Error True for an explicit record, false when missing, or a safe ownership error.
	 */
	public function has_booking_title_preference( $resource_id, $authorized_resource_ids ) {
		$preference = $this->get_booking_title_preference( $resource_id, $authorized_resource_ids );
		if ( is_wp_error( $preference ) ) {
			return $preference;
		}

		$record = $this->get_record();

		return isset( $record['resources'][ (string) (int) $resource_id ]['booking_title'] );
	}

	/**
	 * Strictly validate one booking-title preference.
	 *
	 * A custom empty string is valid and remains distinct from inheritance. The
	 * title policy may render its Booking-ID fallback, but this storage
	 * contract does not resolve or render titles.
	 *
	 * @param mixed $candidate Untrusted booking-title preference.
	 *
	 * @return array<string,string>|WP_Error Normalized preference or safe error.
	 */
	public function validate_booking_title_preference( $candidate ) {
		if ( ! is_array( $candidate ) || ! isset( $candidate['mode'] ) || ! is_scalar( $candidate['mode'] ) ) {
			return $this->error( 'wpbc_timeline_resource_display_invalid', __( 'The Timeline Resource display preference is invalid.', 'booking' ), 400 );
		}

		$mode = sanitize_key( (string) $candidate['mode'] );
		if ( ! in_array( $mode, array( self::BOOKING_TITLE_MODE_INHERIT, self::BOOKING_TITLE_MODE_CUSTOM ), true ) ) {
			return $this->error( 'wpbc_timeline_resource_title_mode_invalid', __( 'The booking-title preference mode is invalid.', 'booking' ), 400 );
		}
		if ( self::BOOKING_TITLE_MODE_INHERIT === $mode ) {
			return array(
				'mode'     => self::BOOKING_TITLE_MODE_INHERIT,
				'template' => '',
			);
		}
		if ( ! array_key_exists( 'template', $candidate ) || ! is_scalar( $candidate['template'] ) ) {
			return $this->error( 'wpbc_timeline_resource_title_template_invalid', __( 'The booking-title template is invalid.', 'booking' ), 400 );
		}

		$raw_template = (string) $candidate['template'];
		if ( $raw_template !== wp_strip_all_tags( $raw_template ) || preg_match( '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $raw_template ) ) {
			return $this->error( 'wpbc_timeline_resource_title_template_invalid', __( 'The booking-title template is invalid.', 'booking' ), 400 );
		}
		$template = preg_replace( '/[\r\n\t]+/', ' ', $raw_template );
		$template = trim( preg_replace( '/ {2,}/', ' ', $template ) );
		$length   = function_exists( 'mb_strlen' ) ? mb_strlen( $template ) : strlen( $template );
		if ( self::MAXIMUM_TEMPLATE_LENGTH < $length || ! $this->has_valid_token_brackets( $template ) ) {
			return $this->error( 'wpbc_timeline_resource_title_template_invalid', __( 'The booking-title template is invalid.', 'booking' ), 400 );
		}

		return array(
			'mode'     => self::BOOKING_TITLE_MODE_CUSTOM,
			'template' => $template,
		);
	}

	/**
	 * Validate and save one authorized Resource display preference.
	 *
	 * @param mixed          $resource_id             Untrusted Resource ID.
	 * @param mixed          $candidate               Untrusted booking-title preference.
	 * @param array<int,int> $authorized_resource_ids Current authorized Resource IDs.
	 *
	 * @return array<string,string>|WP_Error Saved preference or safe error.
	 */
	public function save_booking_title_preference( $resource_id, $candidate, $authorized_resource_ids ) {
		if ( ! $this->is_positive_integer_scalar( $resource_id ) ) {
			return $this->error( 'wpbc_timeline_resource_id_invalid', __( 'The booking Resource identifier is invalid.', 'booking' ), 400 );
		}
		$resource_id             = (int) $resource_id;
		$authorized_resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $authorized_resource_ids ) ) ) );
		if ( ! in_array( $resource_id, $authorized_resource_ids, true ) ) {
			return $this->error( 'wpbc_timeline_resource_settings_unavailable', __( 'The booking Resource settings are not available.', 'booking' ), 404 );
		}

		$validated = $this->validate_booking_title_preference( $candidate );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		$stored_record = $this->read_stored_record();
		$record        = $this->get_record();
		$key    = (string) $resource_id;
		if ( ! isset( $record['resources'][ $key ] ) && count( $record['resources'] ) >= self::MAXIMUM_RESOURCE_PREFERENCES ) {
			return $this->error( 'wpbc_timeline_resource_display_too_large', __( 'Too many Resource display preferences are stored.', 'booking' ), 400 );
		}
		$record['resources'][ $key ] = array( 'booking_title' => $validated );
		$stored_record               = $this->merge_normalized_resources( $stored_record, $record['resources'] );
		if ( ! $this->write_record( $stored_record ) ) {
			return $this->error( 'wpbc_timeline_resource_display_not_saved', __( 'The Timeline Resource display preference could not be saved.', 'booking' ), 500 );
		}

		return $validated;
	}

	/**
	 * Remove one authorized Resource override and restore the missing-record state.
	 *
	 * Reset differs from saving explicit inheritance: it removes only the selected
	 * Resource entry while preserving compatible future top-level storage fields.
	 *
	 * @param mixed          $resource_id             Untrusted Resource ID.
	 * @param array<int,int> $authorized_resource_ids Current authorized Resource IDs.
	 *
	 * @return array<string,string>|WP_Error Inherited default state or a safe error.
	 */
	public function reset_booking_title_preference( $resource_id, $authorized_resource_ids ) {
		$preference = $this->get_booking_title_preference( $resource_id, $authorized_resource_ids );
		if ( is_wp_error( $preference ) ) {
			return $preference;
		}

		$stored_record = $this->read_stored_record();
		$record        = $this->get_record();
		$key           = (string) (int) $resource_id;
		if ( ! isset( $record['resources'][ $key ] ) ) {
			return array(
				'mode'     => self::BOOKING_TITLE_MODE_INHERIT,
				'template' => '',
			);
		}

		unset( $record['resources'][ $key ] );
		$stored_record = $this->merge_normalized_resources( $stored_record, $record['resources'] );
		if ( ! $this->write_record( $stored_record ) ) {
			return $this->error( 'wpbc_timeline_resource_display_not_saved', __( 'The Timeline Resource display preference could not be reset.', 'booking' ), 500 );
		}

		return array(
			'mode'     => self::BOOKING_TITLE_MODE_INHERIT,
			'template' => '',
		);
	}

	/**
	 * Merge normalized Resource entries into a compatible raw stored record.
	 *
	 * @param array<string,mixed> $stored_record        Raw compatible stored record.
	 * @param array<string,mixed> $normalized_resources Validated Resource preference map.
	 *
	 * @return array<string,mixed> Versioned record with unknown top-level fields preserved.
	 */
	private function merge_normalized_resources( $stored_record, $normalized_resources ) {
		$stored_record                   = is_array( $stored_record ) ? $stored_record : array();
		$stored_record['schema_version'] = self::SCHEMA_VERSION;
		$stored_record['resources']      = $normalized_resources;

		return $stored_record;
	}

	/**
	 * Read raw storage through injected or WordPress storage.
	 *
	 * @return array<string,mixed> Raw record.
	 */
	private function read_stored_record() {
		if ( ! $this->user_id ) {
			return array();
		}
		$stored = $this->read_callback
			? call_user_func( $this->read_callback, self::USER_OPTION_KEY, $this->user_id )
			: get_user_option( self::USER_OPTION_KEY, $this->user_id );

		return is_array( $stored ) ? $stored : array();
	}

	/**
	 * Persist the complete display record in site-scoped user storage.
	 *
	 * @param array<string,mixed> $record Validated display record.
	 *
	 * @return bool True when unchanged or stored.
	 */
	private function write_record( $record ) {
		if ( ! $this->user_id ) {
			return false;
		}
		$stored = $this->read_stored_record();
		if (
			isset( $stored['schema_version'] )
			&& is_scalar( $stored['schema_version'] )
			&& self::SCHEMA_VERSION < (int) $stored['schema_version']
		) {
			return false;
		}
		if ( $record === $stored ) {
			return true;
		}
		if ( $this->write_callback ) {
			return false !== call_user_func( $this->write_callback, $this->user_id, self::USER_OPTION_KEY, $record, false );
		}

		return false !== update_user_option( $this->user_id, self::USER_OPTION_KEY, $record, false );
	}

	/**
	 * Confirm that every square-bracket sequence is a supported token shape.
	 *
	 * Token names remain open for existing Booking Calendar fields. This method
	 * validates syntax only; unknown well-formed tokens are resolved later by
	 * the established booking-title formatter.
	 *
	 * @param string $template Normalized template.
	 *
	 * @return bool True when brackets are balanced and token-shaped.
	 */
	private function has_valid_token_brackets( $template ) {
		$without_tokens = preg_replace( '/\[[A-Za-z0-9_-]+\]/', '', $template );

		return false === strpos( $without_tokens, '[' ) && false === strpos( $without_tokens, ']' );
	}

	/**
	 * Determine whether a scalar is a lossless positive platform integer.
	 *
	 * @param mixed $candidate Untrusted scalar.
	 *
	 * @return bool True for a canonical positive integer representation.
	 */
	private function is_positive_integer_scalar( $candidate ) {
		if ( ! is_scalar( $candidate ) || ! preg_match( '/^[1-9]\d*$/', (string) $candidate ) ) {
			return false;
		}

		return (string) (int) $candidate === (string) $candidate;
	}

	/**
	 * Resolve the current Booking Calendar user ID.
	 *
	 * @return int Current user ID or zero.
	 */
	private function resolve_current_user_id() {
		return function_exists( 'wpbc_get_current_user_id' ) ? absint( wpbc_get_current_user_id() ) : absint( get_current_user_id() );
	}

	/**
	 * Build one safe display-preference error.
	 *
	 * @param string $code    Stable machine-readable code.
	 * @param string $message Safe translated message.
	 * @param int    $status  HTTP status for a future endpoint.
	 *
	 * @return WP_Error Safe error.
	 */
	private function error( $code, $message, $status ) {
		return new WP_Error( $code, $message, array( 'status' => $status ) );
	}
}
