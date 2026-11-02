<?php
/**
 * Central administration navigation policy.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve the shared Booking Calendar administration shell contract.
 *
 * The policy is deliberately data-only. Page controllers declare structural
 * exceptions, the page-structure layer supplies the current fullscreen state
 * and stored preference, and this class returns the normalized shell state.
 */
final class WPBC_Admin_Navigation_Policy {

	const CONTEXT_WORKSPACE = 'workspace';
	const CONTEXT_SETTINGS  = 'settings';
	const CONTEXT_FOCUSED   = 'focused';

	const PREFERENCE_SCOPE_WORKSPACE  = 'workspace';
	const PREFERENCE_SCOPE_SETTINGS   = 'settings';
	const PREFERENCE_SCOPE_FULLSCREEN = 'fullscreen';
	const PREFERENCE_SCOPE_NONE       = 'none';

	const SIDEBAR_MODE_MIN     = 'min';
	const SIDEBAR_MODE_COMPACT = 'compact';
	const SIDEBAR_MODE_MAX     = 'max';
	const SIDEBAR_MODE_NONE    = 'none';

	/**
	 * Resolve the complete administration navigation policy.
	 *
	 * Sidebar precedence is structural forced mode, page exception, valid
	 * context preference, and finally the context default. The structural
	 * `none` mode is never accepted from a page exception or user preference.
	 *
	 * @param array<string,mixed> $arguments {
	 *     Navigation inputs.
	 *
	 *     @type string $page_slug           Current Booking Calendar page slug.
	 *     @type array  $page_options        Merged active tab and subtab options.
	 *     @type bool   $is_full_screen      Whether the current shell is fullscreen.
	 *     @type string $saved_sidebar_mode  Context-specific stored sidebar mode.
	 * }
	 *
	 * @return array<string,mixed> Normalized navigation policy.
	 */
	public static function resolve( $arguments ) {
		$arguments = is_array( $arguments ) ? $arguments : array();
		$page_slug = isset( $arguments['page_slug'] ) && is_scalar( $arguments['page_slug'] )
			? (string) $arguments['page_slug']
			: '';
		$page_options = isset( $arguments['page_options'] ) && is_array( $arguments['page_options'] )
			? $arguments['page_options']
			: array();
		$is_full_screen = ! empty( $arguments['is_full_screen'] );
		$saved_mode     = isset( $arguments['saved_sidebar_mode'] ) && is_scalar( $arguments['saved_sidebar_mode'] )
			? (string) $arguments['saved_sidebar_mode']
			: '';

		$shell_context   = self::resolve_shell_context( $page_slug, $page_options );
		$preference_scope = self::resolve_preference_scope( $shell_context, $is_full_screen );
		$preference_name  = self::get_preference_name( $preference_scope );
		$forced_mode      = self::normalize_sidebar_mode(
			self::get_option( $page_options, 'left_navigation__force_view_mode', '' ),
			true
		);
		$page_mode        = self::normalize_sidebar_mode(
			self::get_option( $page_options, 'left_navigation__default_view_mode', '' ),
			false
		);
		$saved_mode       = self::normalize_sidebar_mode( $saved_mode, false );

		if ( '' !== $forced_mode ) {
			$sidebar_mode = $forced_mode;
		} elseif ( '' !== $page_mode ) {
			$sidebar_mode = $page_mode;
		} elseif ( '' !== $saved_mode && self::PREFERENCE_SCOPE_NONE !== $preference_scope ) {
			$sidebar_mode = $saved_mode;
		} else {
			$sidebar_mode = self::get_context_default_sidebar_mode( $shell_context, $is_full_screen );
		}

		$is_horizontal_navigation_visible = self::get_boolean_option(
			$page_options,
			'is_show_top_navigation',
			self::CONTEXT_WORKSPACE === $shell_context
		);
		$is_top_path_visible = self::get_boolean_option( $page_options, 'is_show_top_path', true );
		$top_path_options    = self::get_option( $page_options, 'top_path', array() );
		$top_path_options    = is_array( $top_path_options ) ? $top_path_options : array();
		$is_version_visible  = $is_top_path_visible && self::get_boolean_option( $top_path_options, 'show_version', true );
		$is_page_heading_visible = self::get_boolean_option(
			$page_options,
			'is_show_page_heading',
			! $is_horizontal_navigation_visible
		);
		$is_page_heading_explicit = array_key_exists( 'is_show_page_heading', $page_options );

		return array(
			'shell_context'                         => $shell_context,
			'is_full_screen'                        => $is_full_screen,
			'left_sidebar_mode'                     => $sidebar_mode,
			'left_sidebar_preference_scope'         => $preference_scope,
			'left_sidebar_preference_name'          => $preference_name,
			'is_left_sidebar_user_mode_enabled'     => '' === $forced_mode && '' === $page_mode && '' !== $preference_name,
			'is_horizontal_navigation_visible'      => $is_horizontal_navigation_visible,
			'is_top_path_visible'                   => $is_top_path_visible,
			'is_version_visible'                    => $is_version_visible,
			'is_page_heading_visible'               => $is_page_heading_visible,
			'is_page_heading_explicit'              => $is_page_heading_explicit,
		);
	}

	/**
	 * Resolve the shell context from an explicit page contract or page slug.
	 *
	 * @param string              $page_slug    Current Booking Calendar page slug.
	 * @param array<string,mixed> $page_options Merged active page options.
	 *
	 * @return string One of the context constants.
	 */
	public static function resolve_shell_context( $page_slug, $page_options ) {
		$page_options    = is_array( $page_options ) ? $page_options : array();
		$explicit_context = self::get_option( $page_options, 'navigation_shell_context', '' );
		$explicit_context = is_scalar( $explicit_context ) ? (string) $explicit_context : '';

		if ( in_array( $explicit_context, self::get_shell_contexts(), true ) ) {
			return $explicit_context;
		}

		return 'wpbc-settings' === (string) $page_slug ? self::CONTEXT_SETTINGS : self::CONTEXT_WORKSPACE;
	}

	/**
	 * Resolve the storage scope for a reusable sidebar preference.
	 *
	 * Focused shells do not persist a sidebar preference because their layout is
	 * task-specific. Fullscreen has its own scope so it cannot overwrite the
	 * normal workspace or Settings preference.
	 *
	 * @param string $shell_context  Resolved shell context.
	 * @param bool   $is_full_screen Whether the current shell is fullscreen.
	 *
	 * @return string One of the preference-scope constants.
	 */
	public static function resolve_preference_scope( $shell_context, $is_full_screen ) {
		if ( self::CONTEXT_FOCUSED === $shell_context ) {
			return self::PREFERENCE_SCOPE_NONE;
		}

		if ( $is_full_screen ) {
			return self::PREFERENCE_SCOPE_FULLSCREEN;
		}

		return self::CONTEXT_SETTINGS === $shell_context
			? self::PREFERENCE_SCOPE_SETTINGS
			: self::PREFERENCE_SCOPE_WORKSPACE;
	}

	/**
	 * Return the user-data key for a preference scope.
	 *
	 * @param string $preference_scope Resolved preference scope.
	 *
	 * @return string Stable user-data key, or an empty string for no persistence.
	 */
	public static function get_preference_name( $preference_scope ) {
		$preference_names = array(
			self::PREFERENCE_SCOPE_WORKSPACE  => 'left_sidebar_view_mode__workspace',
			self::PREFERENCE_SCOPE_SETTINGS   => 'left_sidebar_view_mode__settings',
			self::PREFERENCE_SCOPE_FULLSCREEN => 'left_sidebar_view_mode__fullscreen',
		);

		return isset( $preference_names[ $preference_scope ] ) ? $preference_names[ $preference_scope ] : '';
	}

	/**
	 * Return all valid shell contexts.
	 *
	 * @return array<int,string> Ordered context identifiers.
	 */
	public static function get_shell_contexts() {
		return array( self::CONTEXT_WORKSPACE, self::CONTEXT_SETTINGS, self::CONTEXT_FOCUSED );
	}

	/**
	 * Normalize a user-selectable sidebar mode.
	 *
	 * Structural `none` is deliberately excluded because it is never a stored
	 * preference or ordinary page exception.
	 *
	 * @param mixed $mode Candidate sidebar mode.
	 *
	 * @return string Valid min, compact, or max mode; otherwise an empty string.
	 */
	public static function normalize_preference_mode( $mode ) {
		return self::normalize_sidebar_mode( $mode, false );
	}

	/**
	 * Normalize a sidebar mode for its source of authority.
	 *
	 * @param mixed $mode       Candidate sidebar mode.
	 * @param bool  $allow_none Whether the structural `none` mode is permitted.
	 *
	 * @return string Valid normalized mode, or an empty string.
	 */
	private static function normalize_sidebar_mode( $mode, $allow_none ) {
		$mode          = is_scalar( $mode ) ? (string) $mode : '';
		$allowed_modes = array( self::SIDEBAR_MODE_MIN, self::SIDEBAR_MODE_COMPACT, self::SIDEBAR_MODE_MAX );

		if ( $allow_none ) {
			$allowed_modes[] = self::SIDEBAR_MODE_NONE;
		}

		return in_array( $mode, $allowed_modes, true ) ? $mode : '';
	}

	/**
	 * Return the final fallback sidebar mode for the current context.
	 *
	 * @param string $shell_context  Resolved shell context.
	 * @param bool   $is_full_screen Whether the current shell is fullscreen.
	 *
	 * @return string Sidebar mode.
	 */
	public static function get_context_default_sidebar_mode( $shell_context, $is_full_screen ) {
		if ( $is_full_screen || self::CONTEXT_SETTINGS === $shell_context ) {
			return self::SIDEBAR_MODE_MAX;
		}

		return self::SIDEBAR_MODE_MIN;
	}

	/**
	 * Read an option without treating explicit false as an absent value.
	 *
	 * @param array<string,mixed> $options       Option collection.
	 * @param string              $key           Option key.
	 * @param mixed               $default_value Value returned when the key is absent.
	 *
	 * @return mixed Stored option or default value.
	 */
	private static function get_option( $options, $key, $default_value ) {
		return array_key_exists( $key, $options ) ? $options[ $key ] : $default_value;
	}

	/**
	 * Resolve a boolean option while preserving an explicit false value.
	 *
	 * @param array<string,mixed> $options       Option collection.
	 * @param string              $key           Option key.
	 * @param bool                $default_value Value returned when the key is absent.
	 *
	 * @return bool Resolved boolean value.
	 */
	private static function get_boolean_option( $options, $key, $default_value ) {
		return array_key_exists( $key, $options ) ? (bool) $options[ $key ] : (bool) $default_value;
	}
}
