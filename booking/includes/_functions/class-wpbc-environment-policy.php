<?php
/**
 * Shared environment identity and capability policy.
 *
 * @package Booking Calendar
 * @since   11.9.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Provide one authoritative classification for Booking Calendar environments.
 *
 * Environment identity is intentionally separate from individual capabilities.
 * A public live demo may block WordPress page publishing and automatic
 * onboarding while still allowing selected Setup Wizard configuration. Internal
 * test sites, including the Free test site, retain normal publishing behavior.
 */
final class WPBC_Environment_Policy {

	/** Standard customer or development installation. */
	const TYPE_STANDARD = 'standard';

	/** Public, shared Booking Calendar live demo. */
	const TYPE_PUBLIC_LIVE_DEMO = 'public_live_demo';

	/** Internal Booking Calendar test environment. */
	const TYPE_INTERNAL_TEST = 'internal_test';

	/** WordPress Playground installation. */
	const TYPE_PLAYGROUND = 'playground';

	/**
	 * Return the current environment type.
	 *
	 * WordPress's configured home host is authoritative. The current HTTP Host is
	 * used only when no configured host is available, which prevents a request
	 * header from overriding a valid site identity.
	 *
	 * @return string One of the TYPE_* constants.
	 */
	public static function get_environment_type() {
		$site_host      = self::get_site_host();
		$request_host   = self::get_request_host();
		$canonical_host = '' !== $site_host ? $site_host : $request_host;

		// A managed public host retains write restrictions even if Playground is also detected.
		if ( self::is_public_live_demo_host( $canonical_host ) ) {
			$environment_type = self::TYPE_PUBLIC_LIVE_DEMO;
		} elseif ( self::is_playground() ) {
			$environment_type = self::TYPE_PLAYGROUND;
		} elseif ( self::is_internal_test_host( $canonical_host ) ) {
			$environment_type = self::TYPE_INTERNAL_TEST;
		} else {
			$environment_type = self::TYPE_STANDARD;
		}

		/**
		 * Filter the authoritative Booking Calendar environment type.
		 *
		 * The returned value must be one of the documented TYPE_* constants. An
		 * unsupported value is ignored so a malformed integration cannot weaken a
		 * detected live-demo restriction.
		 *
		 * @since 11.9.0
		 *
		 * @param string $environment_type Detected environment type.
		 * @param string $canonical_host  Normalized host used for classification.
		 * @param string $site_host       Normalized WordPress home URL host.
		 * @param string $request_host    Normalized request host used as fallback.
		 */
		$filtered_type = function_exists( 'apply_filters' )
			? apply_filters( 'wpbc_environment_type', $environment_type, $canonical_host, $site_host, $request_host )
			: $environment_type;
		$allowed_types = array(
			self::TYPE_STANDARD,
			self::TYPE_PUBLIC_LIVE_DEMO,
			self::TYPE_INTERNAL_TEST,
			self::TYPE_PLAYGROUND,
		);

		return in_array( $filtered_type, $allowed_types, true ) ? $filtered_type : $environment_type;
	}

	/**
	 * Determine whether this is a public Booking Calendar live demo.
	 *
	 * @return bool True for a public shared live demo.
	 */
	public static function is_live_demo() {
		return self::TYPE_PUBLIC_LIVE_DEMO === self::get_environment_type();
	}

	/**
	 * Determine whether this is an internal Booking Calendar test environment.
	 *
	 * @return bool True for an explicitly identified internal test host.
	 */
	public static function is_internal_test() {
		return self::TYPE_INTERNAL_TEST === self::get_environment_type();
	}

	/**
	 * Determine whether WordPress is running in Playground.
	 *
	 * @return bool True only for the canonical strict boolean constant.
	 */
	public static function is_playground() {
		return defined( 'WPBC_IS_PLAYGROUND' ) && true === WPBC_IS_PLAYGROUND;
	}

	/**
	 * Determine whether WordPress page discovery and publishing are restricted.
	 *
	 * The released publishing filter is applied here, rather than in an
	 * individual publisher, so every Setup Wizard and publishing consumer sees
	 * the same capability decision.
	 *
	 * @return bool True when Booking Calendar must not discover or mutate pages.
	 */
	public static function is_page_publishing_restricted() {
		$is_restricted = self::is_live_demo();
		$site_host     = self::get_site_host();
		$request_host  = self::get_request_host();

		/**
		 * Filter whether Booking Calendar page publishing is restricted.
		 *
		 * @since 11.6.0
		 *
		 * @param bool   $is_restricted Whether the shared environment policy restricts publishing.
		 * @param string $site_host     Normalized WordPress home URL host.
		 * @param string $request_host  Normalized request host used only as a fallback.
		 */
		return function_exists( 'apply_filters' )
			? (bool) apply_filters( 'wpbc_publish_booking_form_is_demo_restricted', $is_restricted, $site_host, $request_host )
			: $is_restricted;
	}

	/**
	 * Determine whether Booking Calendar may discover and publish WordPress pages.
	 *
	 * @return bool True when page publishing is available.
	 */
	public static function allows_page_publishing() {
		return ! self::is_page_publishing_restricted();
	}

	/**
	 * Determine whether Setup Wizard may collect Business details.
	 *
	 * @return bool True on customer and internal test installations.
	 */
	public static function allows_setup_business_details() {
		return ! self::is_live_demo() && ! self::is_playground();
	}

	/**
	 * Determine whether Setup Wizard may send its optional summary email.
	 *
	 * @return bool True when the Business details consent step is available.
	 */
	public static function allows_setup_summary_email() {
		return self::allows_setup_business_details();
	}

	/**
	 * Determine whether the environment permits automatic Setup onboarding.
	 *
	 * Request-specific restrictions such as network administration, bulk
	 * activation, and iframe requests remain the activation coordinator's
	 * responsibility.
	 *
	 * @return bool True when the environment permits automatic onboarding.
	 */
	public static function allows_automatic_setup_onboarding() {
		return ! self::is_live_demo() && ! self::is_playground();
	}

	/**
	 * Return the normalized WordPress home host.
	 *
	 * @return string Normalized host, or an empty string when unavailable.
	 */
	public static function get_site_host() {
		if ( ! function_exists( 'home_url' ) ) {
			return '';
		}

		return self::normalize_host( home_url( '/' ) );
	}

	/**
	 * Return the normalized current request host.
	 *
	 * This value is only a fallback when WordPress has no configured home host.
	 * Proxy-only forwarding headers are intentionally ignored.
	 *
	 * @return string Normalized host, or an empty string outside HTTP.
	 */
	public static function get_request_host() {
		if ( empty( $_SERVER['HTTP_HOST'] ) ) {
			return '';
		}

		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- normalize_host() validates and reduces the value to a hostname.
		$request_host = function_exists( 'wp_unslash' ) ? wp_unslash( $_SERVER['HTTP_HOST'] ) : $_SERVER['HTTP_HOST'];

		return self::normalize_host( $request_host );
	}

	/**
	 * Normalize a URL host or HTTP Host value.
	 *
	 * @param mixed $host Hostname, optionally containing a port or trailing dot.
	 *
	 * @return string Lowercase hostname, or an empty string when invalid.
	 */
	public static function normalize_host( $host ) {
		$host = trim( strtolower( (string) $host ) );
		if ( '' === $host ) {
			return '';
		}

		$host_url        = preg_match( '#^[a-z][a-z0-9+.-]*://#i', $host ) ? $host : 'http://' . ltrim( $host, '/' );
		$normalized_host = function_exists( 'wp_parse_url' )
			? wp_parse_url( $host_url, PHP_URL_HOST )
			: parse_url( $host_url, PHP_URL_HOST );
		if ( ! is_string( $normalized_host ) ) {
			return '';
		}

		return strtolower( rtrim( $normalized_host, '.' ) );
	}

	/**
	 * Determine whether a host is one of the managed public live demos.
	 *
	 * Exact matching prevents internal, customer, and lookalike subdomains from
	 * inheriting demo restrictions merely because their names share a suffix.
	 *
	 * @param string $host Normalized or unnormalized hostname.
	 *
	 * @return bool True for a managed public live-demo host.
	 */
	public static function is_public_live_demo_host( $host ) {
		$host = self::normalize_host( $host );

		/**
		 * Filter the exact public live-demo host allow-list.
		 *
		 * @since 11.9.0
		 *
		 * @param string[] $live_demo_hosts Normalized public live-demo hosts.
		 */
		$live_demo_hosts = array(
			'personal.wpbookingcalendar.com',
			'bs.wpbookingcalendar.com',
			'bm.wpbookingcalendar.com',
			'bl.wpbookingcalendar.com',
			'multiuser.wpbookingcalendar.com',
			'personaltest.wpbookingcalendar.com',
			'bstest.wpbookingcalendar.com',
			'bmtest.wpbookingcalendar.com',
			'bltest.wpbookingcalendar.com',
			'multiusertest.wpbookingcalendar.com',
		);
		if ( function_exists( 'apply_filters' ) ) {
			$live_demo_hosts = apply_filters( 'wpbc_environment_public_live_demo_hosts', $live_demo_hosts );
		}
		$live_demo_hosts = self::normalize_host_list( $live_demo_hosts );

		return '' !== $host && in_array( $host, $live_demo_hosts, true );
	}

	/**
	 * Determine whether a host is an explicitly identified internal test site.
	 *
	 * Internal test sites intentionally keep standard publishing and onboarding
	 * capabilities. This explicit identity prevents future suffix-based logic
	 * from accidentally treating the Free test site as a public demo.
	 *
	 * @param string $host Normalized or unnormalized hostname.
	 *
	 * @return bool True for an internal test host.
	 */
	public static function is_internal_test_host( $host ) {
		$host = self::normalize_host( $host );

		/**
		 * Filter the exact internal test host allow-list.
		 *
		 * @since 11.9.0
		 *
		 * @param string[] $internal_test_hosts Normalized internal test hosts.
		 */
		$internal_test_hosts = array(
			'freetest.wpbookingcalendar.com',
			'beta',
		);
		if ( function_exists( 'apply_filters' ) ) {
			$internal_test_hosts = apply_filters( 'wpbc_environment_internal_test_hosts', $internal_test_hosts );
		}
		$internal_test_hosts = self::normalize_host_list( $internal_test_hosts );

		return '' !== $host && in_array( $host, $internal_test_hosts, true );
	}

	/**
	 * Normalize and deduplicate a filtered hostname list.
	 *
	 * @param mixed $hosts Candidate hostname list.
	 *
	 * @return string[] Valid normalized hostnames.
	 */
	private static function normalize_host_list( $hosts ) {
		$normalized_hosts = array();

		foreach ( is_array( $hosts ) ? $hosts : array() as $host ) {
			if ( ! is_scalar( $host ) ) {
				continue;
			}

			$normalized_host = self::normalize_host( $host );
			if ( '' !== $normalized_host ) {
				$normalized_hosts[] = $normalized_host;
			}
		}

		return array_values( array_unique( $normalized_hosts ) );
	}
}
