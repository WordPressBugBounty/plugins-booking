<?php
/**
 * Signed same-site mode-switch destination intents for Booking Modes V3.
 *
 * @package Booking Calendar
 * @since   11.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Create and validate a short-lived switch destination without persistent data.
 */
final class WPBC_Booking_Modes_V3_Switch_Intent {

	/** @var int Maximum signed-intent lifetime in seconds. */
	const LIFETIME = 120;

	/** @var int Maximum encoded intent length accepted from a request. */
	const MAX_TOKEN_LENGTH = 4096;

	/** @var int Maximum fragment length retained after a mode switch. */
	const MAX_FRAGMENT_LENGTH = 512;

	/**
	 * Build the fixed administration landing URL for a validated mode switch.
	 *
	 * The destination and fragment are hints only. They are signed together with
	 * the real user, effective owner, site, target mode, and expiry, then checked
	 * again against normally contributed source metadata on the landing request.
	 *
	 * @param string $mode_id      Saved target mode ID.
	 * @param string $origin_url   Browser-provided current administration URL.
	 * @param string $fragment     Browser-provided URL fragment without `#`.
	 *
	 * @return string|WP_Error Fixed signed landing URL, or an intent error.
	 */
	public static function create_landing_url( $mode_id, $origin_url, $fragment = '' ) {
		$mode_id = is_scalar( $mode_id ) ? sanitize_key( (string) $mode_id ) : '';
		if ( ! in_array( $mode_id, wpbc_booking_modes_get_allowed_mode_ids(), true ) ) {
			return new WP_Error( 'wpbc_booking_modes_intent_invalid_mode', __( 'The selected Booking Calendar administration mode is not available.', 'booking' ) );
		}

		$context     = wpbc_booking_modes_get_context();
		$issued_at   = time();
		$payload     = array(
			'version'        => 1,
			'real_user_id'   => absint( $context['real_user_id'] ),
			'owner_user_id'  => absint( $context['owner_user_id'] ),
			'site_id'        => self::get_current_site_id(),
			'mode_id'        => $mode_id,
			'destination_url' => self::normalize_destination_url( $origin_url ),
			'fragment'       => self::normalize_fragment( $fragment ),
			'issued_at'      => $issued_at,
			'expires_at'     => $issued_at + self::LIFETIME,
		);
		$encoded_json = wp_json_encode( $payload );
		if ( ! is_string( $encoded_json ) || '' === $encoded_json ) {
			return new WP_Error( 'wpbc_booking_modes_intent_encode_failed', __( 'The mode destination could not be prepared.', 'booking' ) );
		}

		$token     = self::base64url_encode( $encoded_json );
		$signature = self::sign( $token );
		$landing   = add_query_arg(
			array(
				'page'                        => 'wpbc',
				'wpbc_booking_mode_landing'   => '1',
				'wpbc_booking_mode_intent'    => $token,
				'wpbc_booking_mode_signature' => $signature,
			),
			admin_url( 'admin.php' )
		);

		return wp_validate_redirect( $landing, admin_url( 'admin.php?page=wpbc' ) );
	}

	/**
	 * Validate and decode one signed intent in the current user/owner/site context.
	 *
	 * @param string $token     Base64url-encoded JSON payload.
	 * @param string $signature Hexadecimal HMAC signature.
	 *
	 * @return array<string,mixed>|WP_Error Normalized intent, or a validation error.
	 */
	public static function validate( $token, $signature ) {
		$token     = is_scalar( $token ) ? (string) $token : '';
		$signature = is_scalar( $signature ) ? strtolower( (string) $signature ) : '';
		if ( '' === $token || strlen( $token ) > self::MAX_TOKEN_LENGTH || 64 !== strlen( $signature ) || ! ctype_xdigit( $signature ) ) {
			return self::get_validation_error();
		}
		if ( ! hash_equals( self::sign( $token ), $signature ) ) {
			return self::get_validation_error();
		}

		$decoded_json = self::base64url_decode( $token );
		$payload      = is_string( $decoded_json ) ? json_decode( $decoded_json, true ) : null;
		$required     = array( 'version', 'real_user_id', 'owner_user_id', 'site_id', 'mode_id', 'destination_url', 'fragment', 'issued_at', 'expires_at' );
		if ( ! is_array( $payload ) || array_keys( $payload ) !== $required ) {
			return self::get_validation_error();
		}

		$context          = wpbc_booking_modes_get_context();
		$mode_id          = is_scalar( $payload['mode_id'] ) ? sanitize_key( (string) $payload['mode_id'] ) : '';
		$issued_at        = absint( $payload['issued_at'] );
		$expires_at       = absint( $payload['expires_at'] );
		$now              = time();
		$is_context_valid = 1 === absint( $payload['version'] )
			&& absint( $payload['real_user_id'] ) === absint( $context['real_user_id'] )
			&& absint( $payload['owner_user_id'] ) === absint( $context['owner_user_id'] )
			&& absint( $payload['site_id'] ) === self::get_current_site_id()
			&& $mode_id === wpbc_booking_modes_get_selected_mode_id()
			&& in_array( $mode_id, wpbc_booking_modes_get_allowed_mode_ids(), true )
			&& $issued_at <= ( $now + 30 )
			&& $expires_at >= $now
			&& $expires_at > $issued_at
			&& ( $expires_at - $issued_at ) <= self::LIFETIME;
		if ( ! $is_context_valid ) {
			return self::get_validation_error();
		}

		$destination_url = self::normalize_destination_url( $payload['destination_url'] );
		$fragment        = self::normalize_fragment( $payload['fragment'] );
		if ( (string) $payload['destination_url'] !== $destination_url || (string) $payload['fragment'] !== $fragment ) {
			return self::get_validation_error();
		}

		$payload['mode_id']         = $mode_id;
		$payload['destination_url'] = $destination_url;
		$payload['fragment']        = $fragment;

		return $payload;
	}

	/**
	 * Resolve an authorized final URL from a validated intent and source tree.
	 *
	 * The original route is preferred, including `wpbc-new`. When it is absent or
	 * no longer openable, the target definition's default route and then Bookings
	 * are checked. The released redirect filter may change the result only to
	 * another eligible same-site administration route.
	 *
	 * @param array $intent            Validated signed intent.
	 * @param array $source_navigation Normally contributed source navigation.
	 *
	 * @return string Eligible same-site administration URL.
	 */
	public static function resolve_destination( $intent, $source_navigation ) {
		$mode_id           = isset( $intent['mode_id'] ) ? sanitize_key( (string) $intent['mode_id'] ) : '';
		$source_navigation = is_array( $source_navigation ) ? $source_navigation : array();
		$destination_url   = isset( $intent['destination_url'] ) ? self::normalize_destination_url( $intent['destination_url'] ) : '';
		$fragment          = isset( $intent['fragment'] ) ? self::normalize_fragment( $intent['fragment'] ) : '';
		$resolved_url      = '';

		if ( '' !== $destination_url && self::is_destination_eligible( $destination_url, $mode_id, $source_navigation ) ) {
			$resolved_url = $destination_url;
	}

		if ( '' === $resolved_url ) {
			$definition = WPBC_Booking_Modes_V3_Compatibility_Registry::get_instance()->get_compiler_definition( $mode_id );
			if ( is_array( $definition ) && isset( $definition['default_route'] ) ) {
				$default_url = self::get_route_url( $definition['default_route'] );
				if ( self::is_destination_eligible( $default_url, $mode_id, $source_navigation ) ) {
					$resolved_url = $default_url;
				}
			}
		}
		$bookings_url = admin_url( 'admin.php?page=wpbc&tab=vm_booking_listing' );
		if ( '' === $resolved_url && self::is_destination_eligible( $bookings_url, $mode_id, $source_navigation ) ) {
			$resolved_url = $bookings_url;
		}
		if ( '' === $resolved_url ) {
			$resolved_url = admin_url( 'admin.php?page=wpbc' );
		}

		$resolved_url    = self::append_fragment( $resolved_url, $fragment );
		$current_page_id = wpbc_booking_modes_get_canonical_page_id_from_url( $destination_url );

		/**
		 * Filter the server-selected URL used after a successful mode switch.
		 *
		 * The filtered URL is accepted only when it remains a same-site, non-mutating,
		 * source-registered destination available to the target mode.
		 *
		 * @param string $resolved_url    Proposed administration URL.
		 * @param string $mode_id         Target mode identifier.
		 * @param string $current_page_id Original canonical page identifier.
		 */
		$filtered_url = apply_filters( 'wpbc_booking_modes_switch_redirect_url', $resolved_url, $mode_id, $current_page_id );
		$filtered_url = is_scalar( $filtered_url ) ? (string) $filtered_url : '';
		$filtered_fragment = self::normalize_fragment( wp_parse_url( $filtered_url, PHP_URL_FRAGMENT ) );
		$filtered_base     = self::normalize_destination_url( $filtered_url );
		if ( '' !== $filtered_base && self::is_destination_eligible( $filtered_base, $mode_id, $source_navigation ) ) {
			return self::append_fragment( $filtered_base, $filtered_fragment );
		}

		return $resolved_url;
	}

	/**
	 * Normalize a same-site, non-mutating Booking Calendar administration URL.
	 *
	 * @param mixed $candidate_url Untrusted destination candidate.
	 *
	 * @return string Normalized URL without a fragment, or an empty string.
	 */
	public static function normalize_destination_url( $candidate_url ) {
		$candidate_url = is_scalar( $candidate_url ) ? wp_validate_redirect( (string) $candidate_url, '' ) : '';
		if ( '' === $candidate_url ) {
			return '';
		}

		$admin_base       = admin_url( 'admin.php' );
		$candidate_host   = strtolower( (string) wp_parse_url( $candidate_url, PHP_URL_HOST ) );
		$admin_host       = strtolower( (string) wp_parse_url( $admin_base, PHP_URL_HOST ) );
		$candidate_path   = (string) wp_parse_url( $candidate_url, PHP_URL_PATH );
		$admin_path       = (string) wp_parse_url( $admin_base, PHP_URL_PATH );
		$candidate_port   = absint( wp_parse_url( $candidate_url, PHP_URL_PORT ) );
		$admin_port       = absint( wp_parse_url( $admin_base, PHP_URL_PORT ) );
		$candidate_scheme = strtolower( (string) wp_parse_url( $candidate_url, PHP_URL_SCHEME ) );
		$admin_scheme     = strtolower( (string) wp_parse_url( $admin_base, PHP_URL_SCHEME ) );
		if ( $candidate_host !== $admin_host || $candidate_path !== $admin_path || $candidate_port !== $admin_port || $candidate_scheme !== $admin_scheme ) {
			return '';
		}

		$query_string = wp_parse_url( $candidate_url, PHP_URL_QUERY );
		$query_args   = array();
		if ( ! is_string( $query_string ) ) {
			return '';
		}
		wp_parse_str( $query_string, $query_args );
		$page_slug = isset( $query_args['page'] ) && is_scalar( $query_args['page'] ) ? sanitize_key( (string) $query_args['page'] ) : '';
		if ( 0 !== strpos( $page_slug, 'wpbc' ) || 'wpbc-log-off' === $page_slug ) {
			return '';
		}

		$blocked_keys = array( '_wpnonce', '_wp_http_referer', 'action', 'action2', 'nonce', 'security', 'wpbc_booking_mode_landing', 'wpbc_booking_mode_intent', 'wpbc_booking_mode_signature' );
		foreach ( $blocked_keys as $blocked_key ) {
			if ( array_key_exists( $blocked_key, $query_args ) ) {
				return '';
			}
		}

		$normalized_args = array();
		foreach ( array_slice( $query_args, 0, 64, true ) as $query_key => $query_value ) {
			$normalized_key = is_scalar( $query_key ) ? sanitize_key( (string) $query_key ) : '';
			if ( '' === $normalized_key || $normalized_key !== (string) $query_key ) {
				continue;
			}
			$normalized_args[ $normalized_key ] = self::normalize_query_value( $query_value );
		}
		$normalized_args['page'] = $page_slug;
		foreach ( array( 'tab', 'subtab' ) as $route_key ) {
			if ( isset( $normalized_args[ $route_key ] ) ) {
				$normalized_args[ $route_key ] = sanitize_key( (string) $normalized_args[ $route_key ] );
			}
		}

		$normalized_url = add_query_arg( $normalized_args, $admin_base );

		return wp_validate_redirect( $normalized_url, '' );
	}

	/**
	 * Normalize an explicitly supplied browser URL fragment.
	 *
	 * @param mixed $fragment Untrusted fragment, with or without a leading `#`.
	 *
	 * @return string Safe fragment without a leading `#`.
	 */
	public static function normalize_fragment( $fragment ) {
		$fragment = is_scalar( $fragment ) ? ltrim( (string) $fragment, '#' ) : '';
		$fragment = preg_replace( '/[\x00-\x20\x7F]/', '', $fragment );
		$fragment = preg_replace( '/[^A-Za-z0-9_\-:.\/=%&?]/', '', (string) $fragment );

		return substr( (string) $fragment, 0, self::MAX_FRAGMENT_LENGTH );
	}

	/**
	 * Determine whether a destination exists in source metadata and target mode.
	 *
	 * @param string $destination_url   Normalized administration URL.
	 * @param string $mode_id           Target mode ID.
	 * @param array  $source_navigation Normally contributed navigation tree.
	 *
	 * @return bool True when the controller route remains available.
	 */
	private static function is_destination_eligible( $destination_url, $mode_id, $source_navigation ) {
		$route = self::get_route_from_url( $destination_url );
		if ( empty( $route ) ) {
			return false;
		}
		if ( 'wpbc-new' === $route['page'] ) {
			$route = self::get_add_alias_route( $mode_id );
		}
		$route = self::resolve_default_route( $route, $source_navigation );
		if ( empty( $route ) ) {
			return false;
		}

		$source_index = WPBC_Booking_Modes_V3_Source_Index::get_instance();
		$source_index->capture( $source_navigation );
		if ( null === $source_index->get_record( $route ) ) {
			return false;
		}

		$mode = wpbc_booking_modes_get_mode( $mode_id );
		if ( ! is_array( $mode ) ) {
			return false;
		}
		$canonical_page_id = wpbc_booking_modes_get_canonical_page_id_for_route( $route['page'], $route['tab'], $route['subtab'] );
		if ( '' !== $canonical_page_id && isset( $mode['pages'][ $canonical_page_id ] ) ) {
			return true;
		}

		return ! empty( $mode['preserve_unmapped_pages'] );
	}

	/**
	 * Resolve a page's default registered tab when the URL omits one.
	 *
	 * @param array $route             Parsed page, tab, and subtab route.
	 * @param array $source_navigation Normally contributed source navigation.
	 *
	 * @return array<string,string> Resolved route, or an empty array.
	 */
	private static function resolve_default_route( $route, $source_navigation ) {
		if ( ! isset( $source_navigation[ $route['page'] ] ) || ! is_array( $source_navigation[ $route['page'] ] ) ) {
			return array();
		}
		if ( '' !== $route['tab'] ) {
			return $route;
		}

		$first_tab = '';
		foreach ( $source_navigation[ $route['page'] ] as $tab_slug => $tab ) {
			if ( ! is_array( $tab ) ) {
				continue;
			}
			if ( '' === $first_tab ) {
				$first_tab = sanitize_key( (string) $tab_slug );
			}
			if ( ! empty( $tab['default'] ) ) {
				$route['tab'] = sanitize_key( (string) $tab_slug );
				return $route;
			}
		}
		$route['tab'] = $first_tab;

		return '' !== $first_tab ? $route : array();
	}

	/**
	 * Convert the released native Add-page alias to the target mode route.
	 *
	 * @param string $mode_id Target mode ID.
	 *
	 * @return array<string,string> Existing Add Appointment or Add Booking route.
	 */
	private static function get_add_alias_route( $mode_id ) {
		$page_id = 'appointment' === $mode_id ? 'wpbc__add-appointment' : 'wpbc__add-booking';
		$page    = wpbc_booking_modes_get_canonical_page( $page_id );

		return is_array( $page )
			? array( 'page' => $page['page'], 'tab' => $page['tab'], 'subtab' => $page['subtab'] )
			: array();
	}

	/**
	 * Parse a normalized administration URL into its route identifiers.
	 *
	 * @param string $destination_url Normalized administration URL.
	 *
	 * @return array<string,string> Page, tab, and subtab, or an empty array.
	 */
	private static function get_route_from_url( $destination_url ) {
		$query_string = wp_parse_url( $destination_url, PHP_URL_QUERY );
		$query_args   = array();
		if ( ! is_string( $query_string ) ) {
			return array();
		}
		wp_parse_str( $query_string, $query_args );
		$page = isset( $query_args['page'] ) && is_scalar( $query_args['page'] ) ? sanitize_key( (string) $query_args['page'] ) : '';
		if ( '' === $page || 'wpbc-log-off' === $page ) {
			return array();
		}

		return array(
			'page'   => $page,
			'tab'    => isset( $query_args['tab'] ) && is_scalar( $query_args['tab'] ) ? sanitize_key( (string) $query_args['tab'] ) : '',
			'subtab' => isset( $query_args['subtab'] ) && is_scalar( $query_args['subtab'] ) ? sanitize_key( (string) $query_args['subtab'] ) : '',
		);
	}

	/**
	 * Build an administration URL for a declaration route.
	 *
	 * @param array $route Page, tab, and optional subtab identifiers.
	 *
	 * @return string Same-site administration URL, or an empty string.
	 */
	private static function get_route_url( $route ) {
		if ( ! is_array( $route ) || empty( $route['page'] ) ) {
			return '';
		}
		$query_args = array( 'page' => sanitize_key( (string) $route['page'] ) );
		if ( ! empty( $route['tab'] ) ) {
			$query_args['tab'] = sanitize_key( (string) $route['tab'] );
		}
		if ( ! empty( $route['subtab'] ) ) {
			$query_args['subtab'] = sanitize_key( (string) $route['subtab'] );
		}

		return self::normalize_destination_url( add_query_arg( $query_args, admin_url( 'admin.php' ) ) );
	}

	/**
	 * Normalize a scalar or one-level array query value.
	 *
	 * @param mixed $query_value Parsed query value.
	 *
	 * @return string|array Sanitized query value.
	 */
	private static function normalize_query_value( $query_value ) {
		if ( is_array( $query_value ) ) {
			$normalized = array();
			foreach ( array_slice( $query_value, 0, 32, true ) as $value_key => $nested_value ) {
				if ( ! is_scalar( $nested_value ) ) {
					continue;
				}
				$normalized_key                = is_int( $value_key ) ? $value_key : sanitize_key( (string) $value_key );
				$normalized[ $normalized_key ] = sanitize_text_field( (string) $nested_value );
			}

			return $normalized;
		}

		return is_scalar( $query_value ) ? sanitize_text_field( (string) $query_value ) : '';
	}

	/**
	 * Append a validated fragment without changing the server route.
	 *
	 * @param string $destination_url Normalized URL without a fragment.
	 * @param string $fragment        Validated fragment without `#`.
	 *
	 * @return string URL with the optional fragment.
	 */
	private static function append_fragment( $destination_url, $fragment ) {
		$fragment = self::normalize_fragment( $fragment );

		return '' !== $fragment ? $destination_url . '#' . $fragment : $destination_url;
	}

	/**
	 * Return the current multisite-aware site identifier.
	 *
	 * @return int Current WordPress blog ID.
	 */
	private static function get_current_site_id() {
		return function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0;
	}

	/**
	 * Sign one encoded intent with the site's WordPress nonce salt.
	 *
	 * @param string $token Encoded intent token.
	 *
	 * @return string Hexadecimal SHA-256 HMAC.
	 */
	private static function sign( $token ) {
		return hash_hmac( 'sha256', (string) $token, wp_salt( 'nonce' ) );
	}

	/**
	 * Encode bytes using unpadded URL-safe Base64.
	 *
	 * @param string $bytes Raw bytes.
	 *
	 * @return string URL-safe encoded value.
	 */
	private static function base64url_encode( $bytes ) {
		return rtrim( strtr( base64_encode( $bytes ), '+/', '-_' ), '=' );
	}

	/**
	 * Decode unpadded URL-safe Base64 with strict validation.
	 *
	 * @param string $encoded Encoded token.
	 *
	 * @return string|false Decoded bytes, or false for malformed input.
	 */
	private static function base64url_decode( $encoded ) {
		if ( 1 === strlen( $encoded ) % 4 || ! preg_match( '/^[A-Za-z0-9_-]+$/', $encoded ) ) {
			return false;
		}
		$padding = ( 4 - ( strlen( $encoded ) % 4 ) ) % 4;

		return base64_decode( strtr( $encoded, '-_', '+/' ) . str_repeat( '=', $padding ), true );
	}

	/**
	 * Build the deliberately generic signed-intent validation error.
	 *
	 * @return WP_Error Invalid or expired intent error.
	 */
	private static function get_validation_error() {
		return new WP_Error( 'wpbc_booking_modes_intent_invalid', __( 'The mode destination expired or is no longer valid.', 'booking' ) );
	}
}
