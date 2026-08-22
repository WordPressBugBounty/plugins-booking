<?php
/**
 * Shared catalog preference namespace boundary.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Store validated per-user catalog preferences in a site-local namespace.
 */
final class WPBC_UI_Catalog_Preferences {

	/**
	 * Stored payload schema version.
	 *
	 * @var int
	 */
	const STORAGE_VERSION = 1;

	/**
	 * Prefix shared by all independent catalog preference namespaces.
	 *
	 * @var string
	 */
	const NAMESPACE_PREFIX = 'wpbc_ui_catalog_';

	/**
	 * Return the stable preference namespace for one catalog.
	 *
	 * @param string $catalog_id Catalog identifier.
	 *
	 * @return string Sanitized preference namespace, or an empty string.
	 */
	public static function get_namespace( $catalog_id ) {
		$catalog_id = is_scalar( $catalog_id ) ? sanitize_key( (string) $catalog_id ) : '';

		return '' === $catalog_id ? '' : self::NAMESPACE_PREFIX . $catalog_id;
	}

	/**
	 * Return shared request keys that may later be stored as preferences.
	 *
	 * Search text and page number are intentionally request-local.
	 *
	 * @return array<int,string> Allow-listed preference keys.
	 */
	public static function get_request_keys() {
		return array(
			'items_per_page',
			'sort_by',
			'sort_order',
			'visible_columns',
			'column_order',
			'template_pack',
		);
	}

	/**
	 * Extract only shared request values from a stored preference payload.
	 *
	 * Values remain untrusted and are revalidated by WPBC_UI_Catalog_Request.
	 *
	 * @param mixed $stored_preferences Raw stored preference payload.
	 *
	 * @return array<string,mixed> Allow-listed untrusted preference values.
	 */
	public static function extract_request_values( $stored_preferences ) {
		$preference_values = array();

		if ( ! is_array( $stored_preferences ) ) {
			return $preference_values;
		}

		foreach ( self::get_request_keys() as $request_key ) {
			if ( array_key_exists( $request_key, $stored_preferences ) ) {
				$preference_values[ $request_key ] = $stored_preferences[ $request_key ];
			}
		}

		return $preference_values;
	}

	/**
	 * Load one user's site-local catalog preferences.
	 *
	 * WordPress prefixes non-global user options with the current site's table
	 * prefix. This keeps the same user's preferences isolated across multisite
	 * sites while the catalog namespace keeps independent catalogs isolated.
	 *
	 * @param string $catalog_id Catalog identifier.
	 * @param int    $user_id    WordPress user ID, or zero for the current user.
	 *
	 * @return array<string,mixed> Stored untrusted values, or an empty array.
	 */
	public static function load( $catalog_id, $user_id = 0 ) {
		$namespace = self::get_namespace( $catalog_id );
		$user_id   = $user_id ? absint( $user_id ) : get_current_user_id();
		if ( '' === $namespace || ! $user_id ) {
			return array();
		}

		$stored_payload = get_user_option( $namespace, $user_id );
		if (
			! is_array( $stored_payload )
			|| self::STORAGE_VERSION !== ( isset( $stored_payload['version'] ) ? absint( $stored_payload['version'] ) : 0 )
			|| ! isset( $stored_payload['values'] )
			|| ! is_array( $stored_payload['values'] )
		) {
			return array();
		}

		return $stored_payload['values'];
	}

	/**
	 * Save normalized shared and domain-owned preference values.
	 *
	 * Shared request values are extracted from the already validated request.
	 * Optional domain values must already be validated by the catalog provider;
	 * this method accepts only scalar values or scalar lists before storage.
	 *
	 * @param string                  $catalog_id             Catalog identifier.
	 * @param WPBC_UI_Catalog_Request $request                Validated shared request.
	 * @param array                   $additional_preferences Validated domain-owned values.
	 * @param int                     $user_id                WordPress user ID, or zero for the current user.
	 * @param int|string              $preference_revision    Monotonic browser revision for stale-write protection.
	 *
	 * @return true|WP_Error True when stored, or a safe validation error.
	 */
	public static function save( $catalog_id, $request, $additional_preferences = array(), $user_id = 0, $preference_revision = 0 ) {
		$namespace = self::get_namespace( $catalog_id );
		$user_id   = $user_id ? absint( $user_id ) : get_current_user_id();
		if ( '' === $namespace || ! $user_id || ! $request instanceof WPBC_UI_Catalog_Request || $catalog_id !== $request->get_catalog_id() ) {
			return self::get_error( 'invalid_context', __( 'The catalog preferences could not be saved.', 'booking' ) );
		}
		if ( ! is_array( $additional_preferences ) ) {
			return self::get_error( 'invalid_values', __( 'The catalog preferences are malformed.', 'booking' ) );
		}

		$preference_values = array();
		foreach ( $additional_preferences as $preference_key => $preference_value ) {
			$preference_key   = is_scalar( $preference_key ) ? sanitize_key( (string) $preference_key ) : '';
			$preference_value = self::normalize_storage_value( $preference_value );
			if ( '' === $preference_key || is_wp_error( $preference_value ) ) {
				return self::get_error( 'invalid_values', __( 'The catalog preferences are malformed.', 'booking' ) );
			}
			$preference_values[ $preference_key ] = $preference_value;
		}

		$request_values      = self::extract_request_values( $request->to_array() );
		$preference_revision = self::normalize_revision( $preference_revision );
		$current_payload     = get_user_option( $namespace, $user_id );
		if ( self::revision_is_current( $current_payload, $preference_revision ) ) {
			return true;
		}

		$payload = array(
			'version'  => self::STORAGE_VERSION,
			'revision' => $preference_revision,
			'values'   => array_merge( $preference_values, $request_values ),
		);
		$was_updated = update_user_option( $user_id, $namespace, $payload, false );
		if ( false === $was_updated && $payload !== get_user_option( $namespace, $user_id ) ) {
			return self::get_error( 'write_failed', __( 'The catalog preferences could not be saved.', 'booking' ) );
		}

		return true;
	}

	/**
	 * Reset one user's site-local catalog preferences.
	 *
	 * @param string     $catalog_id          Catalog identifier.
	 * @param int        $user_id             WordPress user ID, or zero for the current user.
	 * @param int|string $preference_revision Monotonic browser revision for stale-write protection.
	 *
	 * @return bool Whether the preference is absent after the reset.
	 */
	public static function reset( $catalog_id, $user_id = 0, $preference_revision = 0 ) {
		$namespace = self::get_namespace( $catalog_id );
		$user_id   = $user_id ? absint( $user_id ) : get_current_user_id();
		if ( '' === $namespace || ! $user_id ) {
			return false;
		}

		$current_payload      = get_user_option( $namespace, $user_id );
		$preference_revision = self::normalize_revision( $preference_revision );
		if ( self::revision_is_current( $current_payload, $preference_revision ) ) {
			return true;
		}
		$reset_payload = array(
			'version'  => self::STORAGE_VERSION,
			'revision' => $preference_revision,
			'values'   => array(),
		);
		$was_updated = update_user_option(
			$user_id,
			$namespace,
			$reset_payload,
			false
		);
		if ( false === $was_updated && $reset_payload !== get_user_option( $namespace, $user_id ) ) {
			return false;
		}

		return array() === self::load( $catalog_id, $user_id );
	}

	/**
	 * Normalize a browser revision without depending on the PHP integer size.
	 *
	 * JavaScript millisecond timestamps exceed 32-bit integers. Keeping the
	 * revision as a canonical decimal string preserves ordering on every
	 * supported PHP architecture.
	 *
	 * @param mixed $preference_revision Candidate non-negative revision.
	 *
	 * @return string Canonical decimal revision.
	 */
	private static function normalize_revision( $preference_revision ) {
		if ( ! is_scalar( $preference_revision ) || ! preg_match( '/^\d+$/', (string) $preference_revision ) ) {
			return '0';
		}

		$preference_revision = ltrim( (string) $preference_revision, '0' );

		return '' === $preference_revision ? '0' : $preference_revision;
	}

	/**
	 * Determine whether an existing payload is at least as new as a request.
	 *
	 * @param mixed  $current_payload     Existing user-option payload.
	 * @param string $preference_revision Canonical incoming decimal revision.
	 *
	 * @return bool True when the incoming write must be ignored.
	 */
	private static function revision_is_current( $current_payload, $preference_revision ) {
		if ( ! is_array( $current_payload ) || ! isset( $current_payload['revision'] ) ) {
			return false;
		}

		$current_revision = self::normalize_revision( $current_payload['revision'] );
		if ( strlen( $current_revision ) !== strlen( $preference_revision ) ) {
			return strlen( $current_revision ) > strlen( $preference_revision );
		}

		return 0 <= strcmp( $current_revision, $preference_revision );
	}

	/**
	 * Normalize one catalog-owned value for safe user-option storage.
	 *
	 * @param mixed $preference_value Validated domain preference candidate.
	 *
	 * @return scalar|array|WP_Error Storage-safe value or error.
	 */
	private static function normalize_storage_value( $preference_value ) {
		if ( is_scalar( $preference_value ) || null === $preference_value ) {
			return $preference_value;
		}
		if ( ! is_array( $preference_value ) ) {
			return self::get_error( 'invalid_value', __( 'A catalog preference is malformed.', 'booking' ) );
		}

		$normalized_values = array();
		foreach ( $preference_value as $list_value ) {
			if ( ! is_scalar( $list_value ) && null !== $list_value ) {
				return self::get_error( 'invalid_value', __( 'A catalog preference is malformed.', 'booking' ) );
			}
			$normalized_values[] = $list_value;
		}

		return $normalized_values;
	}

	/**
	 * Create a namespaced preference error.
	 *
	 * @param string $error_code    Short error code.
	 * @param string $error_message Safe localized message.
	 *
	 * @return WP_Error Preference error.
	 */
	private static function get_error( $error_code, $error_message ) {
		return new WP_Error( 'wpbc_ui_catalog_preferences_' . sanitize_key( $error_code ), $error_message );
	}
}
