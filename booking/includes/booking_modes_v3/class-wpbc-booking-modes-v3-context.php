<?php
/**
 * Request and owner context for Booking Modes V3.
 *
 * @package Booking Calendar
 * @since   11.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve immutable request context once without performing navigation work.
 */
final class WPBC_Booking_Modes_V3_Context {

	/** @var WPBC_Booking_Modes_V3_Context|null */
	private static $instance = null;

	/** @var array<string,mixed>|null */
	private $context = null;

	/** @var int */
	private $build_count = 0;

	/**
	 * Prevent direct construction.
	 */
	private function __construct() {}

	/**
	 * Return the shared request instance.
	 *
	 * @return WPBC_Booking_Modes_V3_Context Context instance.
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Return normalized request, actor, owner, and multisite context.
	 *
	 * @return array<string,mixed> Cached context values.
	 */
	public function get_context() {
		if ( null !== $this->context ) {
			return $this->context;
		}

		++$this->build_count;
		$real_user_id  = get_current_user_id();
		$owner_user_id = function_exists( 'wpbc_get_current_user_id' ) ? absint( wpbc_get_current_user_id() ) : absint( $real_user_id );
		$is_multiuser  = class_exists( 'wpdev_bk_multiuser' );
		$is_ajax       = function_exists( 'wp_doing_ajax' ) ? wp_doing_ajax() : ( defined( 'DOING_AJAX' ) && DOING_AJAX );
		$page          = $this->get_request_key( 'page' );
		$context       = array(
			'feature_enabled'              => true,
			'is_admin'                     => is_admin(),
			'is_ajax'                      => (bool) $is_ajax,
			'is_wpbc_page'                 => 0 === strpos( $page, 'wpbc' ),
			'page'                         => $page,
			'tab'                          => $this->get_request_key( 'tab' ),
			'subtab'                       => $this->get_request_key( 'subtab' ),
			'real_user_id'                 => absint( $real_user_id ),
			'owner_user_id'                => $owner_user_id,
			'site_id'                      => function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0,
			'is_multiuser'                 => $is_multiuser,
			'is_simulated_login'           => $is_multiuser && $owner_user_id > 0 && $owner_user_id !== absint( $real_user_id ),
			'is_real_booking_super_admin'  => $is_multiuser ? (bool) apply_bk_filter( 'is_user_super_admin', $real_user_id ) : current_user_can( 'activate_plugins' ),
			'is_owner_booking_super_admin' => $is_multiuser ? (bool) apply_bk_filter( 'is_user_super_admin', $owner_user_id ) : current_user_can( 'activate_plugins' ),
		);

		/**
		 * Filter the cached Booking Modes request and owner context.
		 *
		 * This released hook remains presentation-only and cannot grant access.
		 *
		 * @param array $context Normalized V3 request context.
		 */
		$filtered_context = apply_filters( 'wpbc_booking_modes_context', $context );
		$this->context    = $this->normalize_context( $filtered_context, $context );

		return $this->context;
	}

	/**
	 * Return the number of request-context builds.
	 *
	 * @return int Build count.
	 */
	public function get_build_count() {
		return $this->build_count;
	}

	/**
	 * Read a scalar presentation request key.
	 *
	 * @param string $request_key Request parameter name.
	 *
	 * @return string Sanitized request value.
	 */
	private function get_request_key( $request_key ) {
		if ( ! isset( $_REQUEST[ $request_key ] ) || ! is_scalar( $_REQUEST[ $request_key ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return '';
		}

		return sanitize_key( wp_unslash( $_REQUEST[ $request_key ] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	}

	/**
	 * Normalize a filtered context while retaining extension metadata.
	 *
	 * @param mixed $filtered_context Filter result.
	 * @param array $default_context  Source-confirmed defaults.
	 *
	 * @return array<string,mixed> Safe context.
	 */
	private function normalize_context( $filtered_context, $default_context ) {
		$context = is_array( $filtered_context ) ? wp_parse_args( $filtered_context, $default_context ) : $default_context;

		foreach ( array( 'page', 'tab', 'subtab' ) as $key ) {
			$context[ $key ] = is_scalar( $context[ $key ] ) ? sanitize_key( (string) $context[ $key ] ) : '';
		}
		foreach ( array( 'real_user_id', 'owner_user_id', 'site_id' ) as $key ) {
			$context[ $key ] = is_scalar( $context[ $key ] ) ? absint( $context[ $key ] ) : 0;
		}
		foreach ( array( 'feature_enabled', 'is_admin', 'is_ajax', 'is_wpbc_page', 'is_multiuser', 'is_simulated_login', 'is_real_booking_super_admin', 'is_owner_booking_super_admin' ) as $key ) {
			$context[ $key ] = (bool) $context[ $key ];
		}

		return $context;
	}
}
