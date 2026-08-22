<?php
/**
 * Shared response normalization for template-driven catalogs.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Produce stable JSON-safe success, empty, and error response contracts.
 */
final class WPBC_UI_Catalog_Response {

	/**
	 * Supported browser response schema version.
	 *
	 * @var int
	 */
	const SCHEMA_VERSION = 1;

	/**
	 * Normalized response payload.
	 *
	 * @var array
	 */
	private $response = array();

	/**
	 * Prevent direct construction; callers must use create() or create_empty().
	 *
	 * @param array $response Normalized response payload.
	 */
	private function __construct( $response ) {
		$this->response = $response;
	}

	/**
	 * Create a normalized successful response.
	 *
	 * Domain providers may supply JSON-safe item arrays and optional response
	 * sections, but cannot replace shared request, pagination, sorting, display,
	 * schema, catalog, or request identifiers.
	 *
	 * @param string                  $catalog_id     Registered catalog identifier.
	 * @param WPBC_UI_Catalog_Request $request        Validated shared request.
	 * @param mixed                   $items          Normalized provider item arrays.
	 * @param mixed                   $response_values Optional normalized sections.
	 *
	 * @return WPBC_UI_Catalog_Response|WP_Error Normalized response or safe error.
	 */
	public static function create( $catalog_id, $request, $items, $response_values = array() ) {
		$catalog_id = is_scalar( $catalog_id ) ? sanitize_key( (string) $catalog_id ) : '';
		if ( '' === $catalog_id || ! $request instanceof WPBC_UI_Catalog_Request || $catalog_id !== $request->get_catalog_id() ) {
			return self::get_error( 'invalid_response_context', __( 'The catalog response context is invalid.', 'booking' ) );
		}

		if ( ! is_array( $items ) || ! is_array( $response_values ) ) {
			return self::get_error( 'malformed_response', __( 'The catalog response is malformed.', 'booking' ) );
		}

		$normalized_items = array();
		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				return self::get_error( 'malformed_item', __( 'A catalog response item is malformed.', 'booking' ) );
			}

			$normalized_item = self::normalize_json_value( $item );
			if ( is_wp_error( $normalized_item ) ) {
				return $normalized_item;
			}
			$normalized_items[] = $normalized_item;
		}

		$request_values   = $request->to_array();
		$page_number      = $request_values['page_number'];
		$items_per_page   = $request_values['items_per_page'];
		$pagination_values = isset( $response_values['pagination'] ) && is_array( $response_values['pagination'] )
			? $response_values['pagination']
			: array();
		foreach ( array( 'total_items', 'page_item_count' ) as $pagination_key ) {
			if (
				isset( $pagination_values[ $pagination_key ] )
				&& (
					! is_scalar( $pagination_values[ $pagination_key ] )
					|| ! preg_match( '/^-?\d+$/', (string) $pagination_values[ $pagination_key ] )
				)
			) {
				return self::get_error( 'malformed_pagination', __( 'The catalog pagination response is malformed.', 'booking' ) );
			}
		}
		$total_items     = isset( $pagination_values['total_items'] )
			? max( 0, (int) $pagination_values['total_items'] )
			: count( $normalized_items );
		$page_item_count = isset( $pagination_values['page_item_count'] )
			? max( 0, (int) $pagination_values['page_item_count'] )
			: count( $normalized_items );
		$total_pages    = 0 === $total_items ? 0 : (int) ceil( $total_items / $items_per_page );
		$items_from     = 0 === $page_item_count ? 0 : ( ( $page_number - 1 ) * $items_per_page ) + 1;
		$items_to       = 0 === $page_item_count ? 0 : min( $total_items, $items_from + $page_item_count - 1 );
		$filters        = array( 'search' => $request_values['search'] );
		if (
			$page_item_count > $items_per_page
			|| $page_item_count > $total_items
			|| ( ! empty( $normalized_items ) && 0 === $page_item_count )
			|| ( empty( $normalized_items ) && 0 < $page_item_count )
			|| ( 0 < $page_item_count && $items_from > $total_items )
		) {
			return self::get_error( 'inconsistent_pagination', __( 'The catalog pagination response is inconsistent.', 'booking' ) );
		}

		if ( isset( $response_values['filters'] ) ) {
			$normalized_filters = self::normalize_json_value( $response_values['filters'] );
			if ( is_wp_error( $normalized_filters ) || ! is_array( $normalized_filters ) ) {
				return self::get_error( 'malformed_filters', __( 'The catalog filter response is malformed.', 'booking' ) );
			}
			$filters = array_merge( $filters, $normalized_filters );
		}

		$configuration = $request->get_configuration();
		$features      = isset( $configuration['features'] ) && is_array( $configuration['features'] ) ? $configuration['features'] : array();
		$hierarchy_values = isset( $response_values['hierarchy'] ) ? self::normalize_json_value( $response_values['hierarchy'] ) : array();
		if ( is_wp_error( $hierarchy_values ) ) {
			return self::get_error( 'malformed_hierarchy', __( 'The catalog hierarchy response is malformed.', 'booking' ) );
		}
		$hierarchy = WPBC_UI_Catalog_Hierarchy::normalize_response( $hierarchy_values, ! empty( $features['hierarchy'] ) );
		if ( is_wp_error( $hierarchy ) ) {
			return $hierarchy;
		}

		$normalized_items = WPBC_UI_Catalog_Hierarchy::normalize_items( $normalized_items, $hierarchy['enabled'] );
		if ( is_wp_error( $normalized_items ) ) {
			return $normalized_items;
		}

		$capabilities = array();
		if ( isset( $response_values['capabilities'] ) ) {
			if ( ! is_array( $response_values['capabilities'] ) ) {
				return self::get_error( 'malformed_capabilities', __( 'The catalog capability response is malformed.', 'booking' ) );
			}
			foreach ( $response_values['capabilities'] as $capability_key => $is_allowed ) {
				$capability_key = is_scalar( $capability_key ) ? sanitize_key( (string) $capability_key ) : '';
				if ( '' === $capability_key || ! is_bool( $is_allowed ) ) {
					return self::get_error( 'malformed_capabilities', __( 'The catalog capability response is malformed.', 'booking' ) );
				}
				$capabilities[ $capability_key ] = $is_allowed;
			}
		}

		$messages = array();
		if ( isset( $response_values['messages'] ) ) {
			if ( ! is_array( $response_values['messages'] ) ) {
				return self::get_error( 'malformed_messages', __( 'The catalog message response is malformed.', 'booking' ) );
			}
			foreach ( $response_values['messages'] as $message ) {
				if ( ! is_scalar( $message ) ) {
					return self::get_error( 'malformed_messages', __( 'The catalog message response is malformed.', 'booking' ) );
				}
				$messages[] = sanitize_text_field( (string) $message );
			}
		}

		return new self(
			array(
				'schema_version' => self::SCHEMA_VERSION,
				'success'        => true,
				'catalog_id'     => $catalog_id,
				'request_id'     => $request_values['request_id'],
				'items'          => $normalized_items,
				'pagination'     => array(
					'page_number'    => $page_number,
					'items_per_page' => $items_per_page,
					'total_items'    => $total_items,
					'page_item_count' => $page_item_count,
					'total_pages'    => $total_pages,
					'items_from'     => $items_from,
					'items_to'       => $items_to,
				),
				'sorting'        => array(
					'sort_by'    => $request_values['sort_by'],
					'sort_order' => $request_values['sort_order'],
				),
				'filters'        => $filters,
				'display'        => array(
					'visible_columns' => $request_values['visible_columns'],
					'column_order'    => $request_values['column_order'],
					'template_pack'   => $request_values['template_pack'],
				),
				'hierarchy'      => $hierarchy,
				'capabilities'   => $capabilities,
				'messages'       => $messages,
				'error'          => null,
			)
		);
	}

	/**
	 * Create the canonical empty response contract.
	 *
	 * @param string                  $catalog_id Registered catalog identifier.
	 * @param WPBC_UI_Catalog_Request $request    Validated shared request.
	 * @param mixed                   $response_values Optional normalized sections.
	 *
	 * @return WPBC_UI_Catalog_Response|WP_Error Empty response or safe error.
	 */
	public static function create_empty( $catalog_id, $request, $response_values = array() ) {
		if ( ! is_array( $response_values ) ) {
			return self::get_error( 'malformed_response', __( 'The catalog response is malformed.', 'booking' ) );
		}

		$response_values['pagination'] = array( 'total_items' => 0 );

		return self::create( $catalog_id, $request, array(), $response_values );
	}

	/**
	 * Create a stable non-sensitive browser error contract.
	 *
	 * @param string $catalog_id   Catalog identifier.
	 * @param mixed  $request_id   Client request sequence.
	 * @param string $error_code   Stable error code.
	 * @param string $error_message Localized safe message.
	 * @param bool   $retryable    Whether the browser may offer a retry.
	 *
	 * @return array<string,mixed> Normalized error payload.
	 */
	public static function get_error_response( $catalog_id, $request_id, $error_code, $error_message, $retryable = false ) {
		$catalog_id = is_scalar( $catalog_id ) ? sanitize_key( (string) $catalog_id ) : '';
		$request_id = is_scalar( $request_id ) && preg_match( '/^\d+$/', (string) $request_id ) ? (int) $request_id : 0;
		$error_code = is_scalar( $error_code ) ? sanitize_key( (string) $error_code ) : 'catalog_error';

		return array(
			'schema_version' => self::SCHEMA_VERSION,
			'success'        => false,
			'catalog_id'     => $catalog_id,
			'request_id'     => $request_id,
			'items'          => array(),
			'error'          => array(
				'code'      => '' === $error_code ? 'catalog_error' : $error_code,
				'message'   => is_scalar( $error_message ) ? sanitize_text_field( (string) $error_message ) : '',
				'retryable' => (bool) $retryable,
			),
		);
	}

	/**
	 * Convert a WordPress error into the shared browser error contract.
	 *
	 * @param string   $catalog_id Catalog identifier.
	 * @param mixed    $request_id Client request sequence.
	 * @param WP_Error $error      Safe WordPress error.
	 * @param bool     $retryable  Whether the browser may offer a retry.
	 *
	 * @return array<string,mixed> Normalized error payload.
	 */
	public static function from_wp_error( $catalog_id, $request_id, $error, $retryable = false ) {
		if ( ! is_wp_error( $error ) ) {
			$error = self::get_error( 'catalog_error', __( 'The catalog could not be loaded.', 'booking' ) );
		}

		return self::get_error_response( $catalog_id, $request_id, $error->get_error_code(), $error->get_error_message(), $retryable );
	}

	/**
	 * Determine whether the normalized response contains no items.
	 *
	 * @return bool True for an empty successful response.
	 */
	public function is_empty() {
		return empty( $this->response['items'] );
	}

	/**
	 * Export the normalized response payload.
	 *
	 * @return array<string,mixed> JSON-safe response payload.
	 */
	public function to_array() {
		return $this->response;
	}

	/**
	 * Recursively normalize JSON-safe scalar and array values.
	 *
	 * @param mixed $response_value Provider response value.
	 *
	 * @return mixed|WP_Error JSON-safe value or safe error.
	 */
	private static function normalize_json_value( $response_value ) {
		if ( is_null( $response_value ) || is_string( $response_value ) || is_int( $response_value ) || is_float( $response_value ) || is_bool( $response_value ) ) {
			return $response_value;
		}

		if ( ! is_array( $response_value ) ) {
			return self::get_error( 'unsafe_response_value', __( 'The catalog response contains an unsupported value.', 'booking' ) );
		}

		$normalized_value = array();
		foreach ( $response_value as $response_key => $nested_value ) {
			$normalized_key = is_int( $response_key ) ? $response_key : sanitize_key( (string) $response_key );
			if ( '' === $normalized_key ) {
				return self::get_error( 'unsafe_response_key', __( 'The catalog response contains an unsupported key.', 'booking' ) );
			}

			$normalized_nested_value = self::normalize_json_value( $nested_value );
			if ( is_wp_error( $normalized_nested_value ) ) {
				return $normalized_nested_value;
			}
			$normalized_value[ $normalized_key ] = $normalized_nested_value;
		}

		return $normalized_value;
	}

	/**
	 * Create a namespaced, non-sensitive response error.
	 *
	 * @param string $error_code    Short error code.
	 * @param string $error_message User-facing error message.
	 *
	 * @return WP_Error Response error.
	 */
	private static function get_error( $error_code, $error_message ) {
		return new WP_Error( 'wpbc_ui_catalog_' . sanitize_key( $error_code ), $error_message );
	}
}
