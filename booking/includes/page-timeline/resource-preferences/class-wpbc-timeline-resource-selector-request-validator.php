<?php
/**
 * Timeline Resource-selector request validation.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validate the selector's independent search and pagination request.
 */
final class WPBC_Timeline_Resource_Selector_Request_Validator {

	/** Maximum accepted selector page number. */
	const MAXIMUM_PAGE = 100000;

	/** Maximum normalized search length. */
	const MAXIMUM_SEARCH_LENGTH = 200;

	/**
	 * Validate one Resource-selector read request.
	 *
	 * Missing fields receive server defaults. Explicit malformed fields are
	 * rejected instead of being silently clamped, allowing the endpoint to
	 * return stable validation errors and preventing ambiguous browser state.
	 *
	 * @param mixed $request_values Untrusted selector request.
	 *
	 * @return array<string,mixed>|WP_Error Prepared repository query or error.
	 */
	public function validate( $request_values ) {
		if ( ! is_array( $request_values ) ) {
			return $this->error(
				'wpbc_timeline_resource_selector_request_invalid',
				__( 'The booking Resource selector request is invalid.', 'booking' )
			);
		}

		$page = array_key_exists( 'page', $request_values ) ? $request_values['page'] : 1;
		if ( ! $this->is_positive_integer_scalar( $page ) || self::MAXIMUM_PAGE < (int) $page ) {
			return $this->error(
				'wpbc_timeline_resource_selector_page_invalid',
				__( 'The booking Resource selector page is invalid.', 'booking' )
			);
		}

		$per_page = array_key_exists( 'per_page', $request_values )
			? $request_values['per_page']
			: WPBC_Timeline_Resource_View_Preferences::DEFAULT_PAGE_SIZE;
		if (
			! $this->is_positive_integer_scalar( $per_page )
			|| WPBC_Timeline_Resource_View_Preferences::MAXIMUM_PAGE_SIZE < (int) $per_page
		) {
			return $this->error(
				'wpbc_timeline_resource_selector_page_size_invalid',
				__( 'The booking Resource selector page size is invalid.', 'booking' )
			);
		}

		$search = array_key_exists( 'search', $request_values ) ? $request_values['search'] : '';
		if ( ! is_scalar( $search ) ) {
			return $this->error(
				'wpbc_timeline_resource_selector_search_invalid',
				__( 'The booking Resource selector search is invalid.', 'booking' )
			);
		}
		$search        = sanitize_text_field( (string) $search );
		$search_length = function_exists( 'mb_strlen' ) ? mb_strlen( $search ) : strlen( $search );
		if ( self::MAXIMUM_SEARCH_LENGTH < $search_length ) {
			return $this->error(
				'wpbc_timeline_resource_selector_search_too_long',
				__( 'The booking Resource selector search is too long.', 'booking' )
			);
		}

		$sort_order = array_key_exists( 'sort_order', $request_values )
			? $request_values['sort_order']
			: WPBC_Timeline_Resource_View_Preferences::SORT_ORDER_STANDARD;
		if ( ! is_scalar( $sort_order ) ) {
			return $this->error(
				'wpbc_timeline_resource_selector_sort_invalid',
				__( 'The booking Resource selector sort order is invalid.', 'booking' )
			);
		}
		$sort_order = sanitize_key( (string) $sort_order );
		if ( ! in_array( $sort_order, WPBC_Timeline_Resource_View_Preferences::get_allowed_sort_orders(), true ) ) {
			return $this->error(
				'wpbc_timeline_resource_selector_sort_invalid',
				__( 'The booking Resource selector sort order is invalid.', 'booking' )
			);
		}

		$page     = (int) $page;
		$per_page = (int) $per_page;

		return array(
			'page'       => $page,
			'per_page'   => $per_page,
			'offset'     => ( $page - 1 ) * $per_page,
			'search'     => $search,
			'sort_order' => $sort_order,
		);
	}

	/**
	 * Determine whether a scalar is a lossless positive platform integer.
	 *
	 * @param mixed $candidate Untrusted scalar.
	 *
	 * @return bool True for a canonical positive integer representation.
	 */
	private function is_positive_integer_scalar( $candidate ) {
		if ( is_int( $candidate ) ) {
			return 0 < $candidate;
		}
		if ( ! is_string( $candidate ) || ! preg_match( '/^[1-9]\d*$/', $candidate ) ) {
			return false;
		}

		return (string) (int) $candidate === (string) $candidate;
	}

	/**
	 * Build one safe selector request error.
	 *
	 * @param string $code    Stable error code.
	 * @param string $message Safe translated message.
	 *
	 * @return WP_Error Validation error.
	 */
	private function error( $code, $message ) {
		return new WP_Error( $code, $message, array( 'status' => 400 ) );
	}
}
