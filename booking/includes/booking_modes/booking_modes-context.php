<?php
/**
 * Request and owner context for Booking Modes.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve immutable request context once for the current PHP request.
 */
final class WPBC_Booking_Mode_Context {

	/**
	 * Shared context instance.
	 *
	 * @var WPBC_Booking_Mode_Context|null
	 */
	private static $instance = null;

	/**
	 * Normalized context, or null before first use.
	 *
	 * @var array|null
	 */
	private $context = null;

	/**
	 * Number of context builds in the current request.
	 *
	 * @var int
	 */
	private $build_count = 0;

	/**
	 * Prevent direct construction.
	 */
	private function __construct() {}

	/**
	 * Get the shared request instance.
	 *
	 * @return WPBC_Booking_Mode_Context Context instance.
	 */
	public static function get_instance() {

		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Get normalized request and Booking Calendar owner context.
	 *
	 * Request values are presentation context only. They never authorize access
	 * or replace the existing page/controller capability checks.
	 *
	 * @return array Normalized context values.
	 */
	public function get_context() {

		if ( null !== $this->context ) {
			return $this->context;
		}

		++$this->build_count;

		$page              = $this->get_request_key( 'page' );
		$real_user_id      = get_current_user_id();
		$owner_user_id     = function_exists( 'wpbc_get_current_user_id' ) ? absint( wpbc_get_current_user_id() ) : absint( $real_user_id );
		$is_multiuser      = class_exists( 'wpdev_bk_multiuser' );
		$is_real_super     = $is_multiuser ? (bool) apply_bk_filter( 'is_user_super_admin', $real_user_id ) : current_user_can( 'activate_plugins' );
		$is_owner_super    = $is_multiuser ? (bool) apply_bk_filter( 'is_user_super_admin', $owner_user_id ) : $is_real_super;
		$is_doing_ajax     = function_exists( 'wp_doing_ajax' ) ? wp_doing_ajax() : ( defined( 'DOING_AJAX' ) && DOING_AJAX );

		$context = array(
			'feature_enabled'                    => true,
			'is_admin'                           => is_admin(),
			'is_ajax'                            => (bool) $is_doing_ajax,
			'is_wpbc_page'                       => 0 === strpos( $page, 'wpbc' ),
			'page'                               => $page,
			'tab'                                => $this->get_request_key( 'tab' ),
			'subtab'                             => $this->get_request_key( 'subtab' ),
			'real_user_id'                       => absint( $real_user_id ),
			'owner_user_id'                      => $owner_user_id,
			'is_multiuser'                       => $is_multiuser,
			'is_simulated_login'                 => $is_multiuser && $owner_user_id > 0 && $owner_user_id !== absint( $real_user_id ),
			'is_real_booking_super_admin'        => $is_real_super,
			'is_owner_booking_super_admin'       => $is_owner_super,
		);

		/**
		 * Filter the cached Booking Modes request and owner context.
		 *
		 * This filter runs once per request. It must not grant page access; existing
		 * Booking Calendar controllers remain authoritative for capabilities.
		 *
		 * @param array $context Normalized request and owner context.
		 */
		$filtered_context = apply_filters( 'wpbc_booking_modes_context', $context );
		$this->context    = $this->normalize_context( $filtered_context, $context );

		return $this->context;
	}

	/**
	 * Get the number of context builds in the current request.
	 *
	 * @return int Context build count.
	 */
	public function get_build_count() {

		return $this->build_count;
	}

	/**
	 * Read and sanitize a scalar request key.
	 *
	 * @param string $request_key Request parameter name.
	 *
	 * @return string Sanitized request value, or an empty string.
	 */
	private function get_request_key( $request_key ) {

		if ( ! isset( $_REQUEST[ $request_key ] ) || ! is_scalar( $_REQUEST[ $request_key ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return '';
		}

		return sanitize_key( wp_unslash( $_REQUEST[ $request_key ] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	}

	/**
	 * Normalize filtered context without discarding extension metadata.
	 *
	 * @param mixed $filtered_context Context returned by the public filter.
	 * @param array $default_context  Internally resolved fallback context.
	 *
	 * @return array Safe context values plus any additional extension keys.
	 */
	private function normalize_context( $filtered_context, $default_context ) {

		$context = is_array( $filtered_context ) ? wp_parse_args( $filtered_context, $default_context ) : $default_context;

		foreach ( array( 'page', 'tab', 'subtab' ) as $request_key ) {
			$context[ $request_key ] = is_scalar( $context[ $request_key ] ) ? sanitize_key( (string) $context[ $request_key ] ) : '';
		}

		foreach ( array( 'real_user_id', 'owner_user_id' ) as $user_id_key ) {
			$context[ $user_id_key ] = is_scalar( $context[ $user_id_key ] ) ? absint( $context[ $user_id_key ] ) : 0;
		}

		foreach ( array( 'feature_enabled', 'is_admin', 'is_ajax', 'is_wpbc_page', 'is_multiuser', 'is_simulated_login', 'is_real_booking_super_admin', 'is_owner_booking_super_admin' ) as $boolean_key ) {
			$context[ $boolean_key ] = (bool) $context[ $boolean_key ];
		}

		return $context;
	}
}
