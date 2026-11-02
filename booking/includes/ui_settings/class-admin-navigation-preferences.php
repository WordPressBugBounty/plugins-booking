<?php
/**
 * Scoped administration navigation preference integration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Load, validate, and bridge scoped left-sidebar presentation preferences.
 *
 * This service owns only presentation state. Cookie and user-option values
 * must never be used for authorization, route access, ownership, or edition
 * decisions.
 */
final class WPBC_Admin_Navigation_Preferences {

	const LEGACY_PREFERENCE_NAME = 'left_sidebar_view_mode';
	const COOKIE_NAME            = 'wpbc_admin_left_sidebar';
	const COOKIE_LIFETIME        = 300;
	const COOKIE_CLOCK_SKEW      = 60;

	/**
	 * Return the effective saved mode for one navigation preference scope.
	 *
	 * A fresh matching cookie bridges an explicit browser action while its AJAX
	 * save is pending. The scoped user option follows. Only Settings may use the
	 * untouched legacy option as a final compatibility fallback.
	 *
	 * @param int    $user_id          Current WordPress user ID.
	 * @param string $preference_scope Workspace, settings, fullscreen, or none.
	 *
	 * @return string Valid saved mode, or an empty string for the policy default.
	 */
	public static function get_effective_mode( $user_id, $preference_scope ) {
		$preference_name = WPBC_Admin_Navigation_Policy::get_preference_name( $preference_scope );
		if ( '' === $preference_name || ! class_exists( 'WPBC_User_Custom_Data_Saver' ) ) {
			return '';
		}

		$scoped_mode = WPBC_User_Custom_Data_Saver::get_user_data_value( $user_id, $preference_name );
		$legacy_mode = '';
		if ( WPBC_Admin_Navigation_Policy::PREFERENCE_SCOPE_SETTINGS === $preference_scope ) {
			$legacy_mode = WPBC_User_Custom_Data_Saver::get_user_data_value( $user_id, self::LEGACY_PREFERENCE_NAME );
		}

		return self::resolve_mode(
			$preference_scope,
			$scoped_mode,
			$legacy_mode,
			self::get_cookie_value()
		);
	}

	/**
	 * Resolve scoped, legacy, and short-lived cookie values deterministically.
	 *
	 * @param string   $preference_scope  Requested preference scope.
	 * @param mixed    $scoped_mode       Saved scoped user-option value.
	 * @param mixed    $legacy_mode       Untouched legacy user-option value.
	 * @param mixed    $cookie_value      Candidate navigation cookie value.
	 * @param int|null $current_timestamp Optional timestamp for deterministic tests.
	 *
	 * @return string Valid mode, or an empty string for the context default.
	 */
	public static function resolve_mode( $preference_scope, $scoped_mode = '', $legacy_mode = '', $cookie_value = '', $current_timestamp = null ) {
		$preference_scope = is_scalar( $preference_scope ) ? (string) $preference_scope : '';
		$scoped_mode      = WPBC_Admin_Navigation_Policy::normalize_preference_mode( $scoped_mode );
		$legacy_mode      = WPBC_Admin_Navigation_Policy::normalize_preference_mode( $legacy_mode );
		$cookie_mode      = self::resolve_cookie_mode( $preference_scope, $cookie_value, $current_timestamp );

		if ( '' !== $cookie_mode ) {
			return $cookie_mode;
		}

		if ( '' !== $scoped_mode ) {
			return $scoped_mode;
		}

		if (
			WPBC_Admin_Navigation_Policy::PREFERENCE_SCOPE_SETTINGS === $preference_scope
			&& '' !== $legacy_mode
		) {
			return $legacy_mode;
		}

		return '';
	}

	/**
	 * Create an allow-listed short-lived navigation cookie value.
	 *
	 * @param string   $preference_scope Workspace, settings, or fullscreen.
	 * @param mixed    $mode             Candidate min, compact, or max mode.
	 * @param int|null $issued_timestamp Optional timestamp for deterministic tests.
	 *
	 * @return string Encoded logical value without URL escaping, or an empty string.
	 */
	public static function create_cookie_value( $preference_scope, $mode, $issued_timestamp = null ) {
		$preference_scope = is_scalar( $preference_scope ) ? (string) $preference_scope : '';
		$mode             = WPBC_Admin_Navigation_Policy::normalize_preference_mode( $mode );

		if ( ! in_array( $preference_scope, self::get_cookie_scopes(), true ) || '' === $mode ) {
			return '';
		}

		$issued_timestamp = null === $issued_timestamp ? time() : abs( (int) $issued_timestamp );

		return $preference_scope . '|' . $mode . '|' . $issued_timestamp;
	}

	/**
	 * Resolve a valid mode from a fresh cookie matching the requested scope.
	 *
	 * @param string   $preference_scope  Requested preference scope.
	 * @param mixed    $cookie_value      Candidate raw cookie value.
	 * @param int|null $current_timestamp Optional timestamp for deterministic tests.
	 *
	 * @return string Cookie mode, or an empty string when invalid or inapplicable.
	 */
	public static function resolve_cookie_mode( $preference_scope, $cookie_value, $current_timestamp = null ) {
		$cookie_value = is_scalar( $cookie_value ) ? (string) $cookie_value : '';
		if ( ! preg_match( '/^(workspace|settings|fullscreen)\|(min|compact|max)\|([0-9]{10,})$/', $cookie_value, $cookie_parts ) ) {
			return '';
		}

		if ( (string) $preference_scope !== $cookie_parts[1] ) {
			return '';
		}

		$current_timestamp = null === $current_timestamp ? time() : abs( (int) $current_timestamp );
		$issued_timestamp  = abs( (int) $cookie_parts[3] );

		if (
			$issued_timestamp > ( $current_timestamp + self::COOKIE_CLOCK_SKEW )
			|| $issued_timestamp < ( $current_timestamp - self::COOKIE_LIFETIME )
		) {
			return '';
		}

		return $cookie_parts[2];
	}

	/**
	 * Set the short-lived navigation cookie on all applicable admin paths.
	 *
	 * @param string $preference_scope Workspace, settings, or fullscreen.
	 * @param mixed  $mode             Candidate min, compact, or max mode.
	 *
	 * @return bool True when an allow-listed value was accepted.
	 */
	public static function set_cookie( $preference_scope, $mode ) {
		$cookie_value = self::create_cookie_value( $preference_scope, $mode );
		if ( '' === $cookie_value ) {
			return false;
		}

		if ( ! headers_sent() ) {
			$cookie_domain = defined( 'COOKIE_DOMAIN' ) ? COOKIE_DOMAIN : '';
			$cookie_paths  = function_exists( 'wpbc_ui__get_admin_preference_cookie_paths' )
				? wpbc_ui__get_admin_preference_cookie_paths()
				: array( '/' );

			foreach ( $cookie_paths as $cookie_path ) {
				setcookie(
					self::COOKIE_NAME,
					$cookie_value,
					time() + self::COOKIE_LIFETIME,
					$cookie_path,
					$cookie_domain,
					is_ssl(),
					false
				);
			}
		}

		$_COOKIE[ self::COOKIE_NAME ] = $cookie_value;

		return true;
	}

	/**
	 * Validate a scoped sidebar value before the generic user-option saver writes it.
	 *
	 * Unrelated user-data payloads pass through unchanged. Scoped navigation
	 * preferences accept exactly one scalar `value` in the policy allow-list.
	 *
	 * @param mixed               $sanitized_data Sanitized pending user data.
	 * @param string              $data_name      Sanitized preference name.
	 * @param int                 $user_id        Current target user ID.
	 *
	 * @return mixed|WP_Error Validated data, unchanged unrelated data, or a rejection error.
	 */
	public static function validate_before_save( $sanitized_data, $data_name, $user_id ) {
		$preference_scope = self::get_scope_from_preference_name( $data_name );
		if ( '' === $preference_scope ) {
			return $sanitized_data;
		}
		if ( ! is_array( $sanitized_data ) ) {
			return new WP_Error(
				'wpbc_invalid_navigation_preference',
				__( 'The side menu preference is invalid.', 'booking' )
			);
		}

		$mode = isset( $sanitized_data['value'] ) && is_scalar( $sanitized_data['value'] )
			? WPBC_Admin_Navigation_Policy::normalize_preference_mode( $sanitized_data['value'] )
			: '';

		if ( 1 !== count( $sanitized_data ) || '' === $mode ) {
			return new WP_Error(
				'wpbc_invalid_navigation_preference',
				__( 'The side menu preference is invalid.', 'booking' )
			);
		}

		return array( 'value' => $mode );
	}

	/**
	 * Synchronize the server cookie after a scoped user option is verified.
	 *
	 * @param int                 $user_id        User whose preference was saved.
	 * @param string              $data_name      Sanitized preference name.
	 * @param array<string,mixed> $sanitized_data Verified stored data.
	 *
	 * @return void
	 */
	public static function sync_cookie_after_save( $user_id, $data_name, $sanitized_data ) {
		$preference_scope = self::get_scope_from_preference_name( $data_name );
		if (
			'' === $preference_scope
			|| wpbc_get_current_user_id() !== absint( $user_id )
			|| ! isset( $sanitized_data['value'] )
			|| ! is_scalar( $sanitized_data['value'] )
		) {
			return;
		}

		self::set_cookie( $preference_scope, $sanitized_data['value'] );
	}

	/**
	 * Return the scope represented by a scoped preference name.
	 *
	 * @param mixed $preference_name Candidate unprefixed user-data name.
	 *
	 * @return string Preference scope, or an empty string.
	 */
	public static function get_scope_from_preference_name( $preference_name ) {
		$preference_name = is_scalar( $preference_name ) ? (string) $preference_name : '';

		foreach ( self::get_cookie_scopes() as $preference_scope ) {
			if ( WPBC_Admin_Navigation_Policy::get_preference_name( $preference_scope ) === $preference_name ) {
				return $preference_scope;
			}
		}

		return '';
	}

	/**
	 * Return scopes permitted in the navigation cookie.
	 *
	 * @return array<int,string> Allow-listed scope identifiers.
	 */
	private static function get_cookie_scopes() {
		return array(
			WPBC_Admin_Navigation_Policy::PREFERENCE_SCOPE_WORKSPACE,
			WPBC_Admin_Navigation_Policy::PREFERENCE_SCOPE_SETTINGS,
			WPBC_Admin_Navigation_Policy::PREFERENCE_SCOPE_FULLSCREEN,
		);
	}

	/**
	 * Read and sanitize the optional browser navigation cookie.
	 *
	 * @return string Raw logical cookie value, or an empty string.
	 */
	private static function get_cookie_value() {
		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotValidated -- Optional same-origin presentation preference.
		return isset( $_COOKIE[ self::COOKIE_NAME ] ) && is_scalar( $_COOKIE[ self::COOKIE_NAME ] )
			? sanitize_text_field( wp_unslash( $_COOKIE[ self::COOKIE_NAME ] ) )
			: '';
	}
}

if ( function_exists( 'add_filter' ) ) {
	add_filter( 'wpbc_user_custom_data_before_save', array( 'WPBC_Admin_Navigation_Preferences', 'validate_before_save' ), 10, 3 );
	add_action( 'wpbc_user_custom_data_saved', array( 'WPBC_Admin_Navigation_Preferences', 'sync_cookie_after_save' ), 10, 3 );
}
