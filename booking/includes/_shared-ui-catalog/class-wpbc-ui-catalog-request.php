<?php
/**
 * Shared request normalization for template-driven catalogs.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validate catalog mechanics without interpreting domain-specific filters.
 *
 * Known malformed request and URL values return WP_Error. Invalid stored
 * preferences are ignored key by key so stale configuration cannot prevent a
 * catalog from loading. Unknown keys never cross this shared boundary.
 */
final class WPBC_UI_Catalog_Request {

	/**
	 * Sanitized catalog configuration used for validation.
	 *
	 * @var array
	 */
	private $configuration = array();

	/**
	 * Normalized shared request values.
	 *
	 * @var array
	 */
	private $values = array();

	/**
	 * Keys explicitly supplied by the current request or initial URL.
	 *
	 * @var array
	 */
	private $provided_keys = array();

	/**
	 * Prevent direct construction; callers must use create().
	 *
	 * @param array $configuration Sanitized catalog configuration.
	 * @param array $values        Normalized shared request values.
	 * @param array $provided_keys Explicitly supplied request keys.
	 */
	private function __construct( $configuration, $values, $provided_keys ) {
		$this->configuration = $configuration;
		$this->values        = $values;
		$this->provided_keys = $provided_keys;
	}

	/**
	 * Create one validated shared request.
	 *
	 * Precedence is configuration defaults, valid stored preferences, current
	 * request values, then URL overrides on the initial request only.
	 *
	 * @param array $configuration     Registered catalog configuration.
	 * @param mixed $request_values    Current request payload.
	 * @param mixed $stored_preferences Untrusted stored preference payload.
	 * @param mixed $url_overrides     Untrusted initial URL overrides.
	 * @param bool  $is_initial_request Whether URL overrides may be applied.
	 *
	 * @return WPBC_UI_Catalog_Request|WP_Error Valid request or safe error.
	 */
	public static function create( $configuration, $request_values = array(), $stored_preferences = array(), $url_overrides = array(), $is_initial_request = false ) {
		if ( ! is_array( $configuration ) || empty( $configuration['id'] ) ) {
			return self::get_error( 'invalid_configuration', __( 'The catalog configuration is invalid.', 'booking' ) );
		}

		if ( ! is_array( $request_values ) || ! is_array( $url_overrides ) ) {
			return self::get_error( 'malformed_request', __( 'The catalog request is malformed.', 'booking' ) );
		}

		$normalized_values = self::get_defaults( $configuration );
		$provided_keys     = array();
		$preference_values = WPBC_UI_Catalog_Preferences::extract_request_values( $stored_preferences );
		$normalized_values = self::apply_values( $normalized_values, $preference_values, $configuration, false, $provided_keys );
		$normalized_values = self::apply_values( $normalized_values, $request_values, $configuration, true, $provided_keys );

		if ( is_wp_error( $normalized_values ) ) {
			return $normalized_values;
		}

		if ( $is_initial_request ) {
			$normalized_values = self::apply_values( $normalized_values, $url_overrides, $configuration, true, $provided_keys );

			if ( is_wp_error( $normalized_values ) ) {
				return $normalized_values;
			}
		}

		return new self( $configuration, $normalized_values, array_values( array_unique( $provided_keys ) ) );
	}

	/**
	 * Return the request's registered catalog identifier.
	 *
	 * @return string Catalog identifier.
	 */
	public function get_catalog_id() {
		return sanitize_key( (string) $this->configuration['id'] );
	}

	/**
	 * Return one normalized request value.
	 *
	 * @param string $request_key Shared request key.
	 * @param mixed  $default     Value returned when the key is unavailable.
	 *
	 * @return mixed Normalized value or the supplied default.
	 */
	public function get( $request_key, $default = null ) {
		$request_key = is_scalar( $request_key ) ? sanitize_key( (string) $request_key ) : '';

		return array_key_exists( $request_key, $this->values ) ? $this->values[ $request_key ] : $default;
	}

	/**
	 * Determine whether a key was explicitly supplied for this request.
	 *
	 * @param string $request_key Shared request key.
	 *
	 * @return bool True when request or initial URL input supplied the key.
	 */
	public function has( $request_key ) {
		$request_key = is_scalar( $request_key ) ? sanitize_key( (string) $request_key ) : '';

		return in_array( $request_key, $this->provided_keys, true );
	}

	/**
	 * Return the trusted catalog configuration used by this request.
	 *
	 * @return array Registered catalog configuration.
	 */
	public function get_configuration() {
		return $this->configuration;
	}

	/**
	 * Export normalized shared request values.
	 *
	 * @return array<string,mixed> Normalized request payload.
	 */
	public function to_array() {
		return $this->values;
	}

	/**
	 * Build safe defaults from one registered configuration.
	 *
	 * @param array $configuration Registered catalog configuration.
	 *
	 * @return array<string,mixed> Shared request defaults.
	 */
	private static function get_defaults( $configuration ) {
		$page_size_config = isset( $configuration['items_per_page'] ) && is_array( $configuration['items_per_page'] )
			? $configuration['items_per_page']
			: array();
		$page_size_options = self::normalize_identifier_integers( isset( $page_size_config['options'] ) ? $page_size_config['options'] : array() );
		$maximum_page_size = isset( $page_size_config['maximum'] ) ? max( 1, absint( $page_size_config['maximum'] ) ) : 100;
		$page_size_options = array_values(
			array_filter(
				$page_size_options,
				static function ( $page_size ) use ( $maximum_page_size ) {
					return $page_size <= $maximum_page_size;
				}
			)
		);

		if ( empty( $page_size_options ) ) {
			$page_size_options = array( min( 10, $maximum_page_size ) );
		}

		$default_page_size = isset( $page_size_config['default'] ) ? absint( $page_size_config['default'] ) : $page_size_options[0];
		if ( ! in_array( $default_page_size, $page_size_options, true ) ) {
			$default_page_size = $page_size_options[0];
		}

		$sorting_config = isset( $configuration['sorting'] ) && is_array( $configuration['sorting'] ) ? $configuration['sorting'] : array();
		$allowed_sorting_keys = self::normalize_identifiers( isset( $sorting_config['allowed_keys'] ) ? $sorting_config['allowed_keys'] : array() );
		if ( empty( $allowed_sorting_keys ) ) {
			$allowed_sorting_keys = array( 'title' );
		}

		$default_sorting_key = isset( $sorting_config['default_key'] ) ? sanitize_key( (string) $sorting_config['default_key'] ) : $allowed_sorting_keys[0];
		if ( ! in_array( $default_sorting_key, $allowed_sorting_keys, true ) ) {
			$default_sorting_key = $allowed_sorting_keys[0];
		}

		$default_sorting_order = isset( $sorting_config['default_order'] ) ? strtolower( (string) $sorting_config['default_order'] ) : 'asc';
		if ( ! in_array( $default_sorting_order, array( 'asc', 'desc' ), true ) ) {
			$default_sorting_order = 'asc';
		}

		$column_config          = isset( $configuration['columns'] ) && is_array( $configuration['columns'] ) ? $configuration['columns'] : array();
		$allowed_columns        = self::normalize_identifiers( isset( $column_config['allowed'] ) ? $column_config['allowed'] : array() );
		$default_columns        = self::normalize_allowed_identifiers( isset( $column_config['default_visible'] ) ? $column_config['default_visible'] : array(), $allowed_columns );
		$default_column_order   = self::normalize_allowed_identifiers( isset( $column_config['default_order'] ) ? $column_config['default_order'] : array(), $allowed_columns );
		$required_columns       = self::normalize_allowed_identifiers( isset( $column_config['required'] ) ? $column_config['required'] : array(), $allowed_columns );
		$default_columns        = array_values( array_unique( array_merge( $default_columns, $required_columns ) ) );
		$default_column_order   = self::complete_column_order( $default_column_order, $allowed_columns, $column_config );
		$available_template_packs = isset( $configuration['template_packs'] ) && is_array( $configuration['template_packs'] )
			? self::normalize_identifiers( array_keys( $configuration['template_packs'] ) )
			: array();

		if ( empty( $available_template_packs ) ) {
			$available_template_packs = array( 'table' );
		}

		$default_template_pack = isset( $configuration['default_template_pack'] ) ? sanitize_key( (string) $configuration['default_template_pack'] ) : $available_template_packs[0];
		if ( ! in_array( $default_template_pack, $available_template_packs, true ) ) {
			$default_template_pack = $available_template_packs[0];
		}

		return array(
			'request_id'     => 0,
			'page_number'    => 1,
			'items_per_page' => $default_page_size,
			'sort_by'        => $default_sorting_key,
			'sort_order'     => $default_sorting_order,
			'search'         => '',
			'visible_columns' => $default_columns,
			'column_order'    => $default_column_order,
			'template_pack'   => $default_template_pack,
		);
	}

	/**
	 * Apply one untrusted value layer to normalized request values.
	 *
	 * @param array $normalized_values Current normalized values.
	 * @param array $candidate_values  Untrusted candidate values.
	 * @param array $configuration     Registered catalog configuration.
	 * @param bool  $reject_invalid    Whether invalid values return WP_Error.
	 * @param array $provided_keys     Explicit key collection passed by reference.
	 *
	 * @return array|WP_Error Updated values or safe error.
	 */
	private static function apply_values( $normalized_values, $candidate_values, $configuration, $reject_invalid, &$provided_keys ) {
		$known_keys = array_keys( $normalized_values );

		foreach ( $known_keys as $request_key ) {
			if ( ! array_key_exists( $request_key, $candidate_values ) ) {
				continue;
			}

			$normalized_value = self::normalize_value( $request_key, $candidate_values[ $request_key ], $configuration );
			if ( is_wp_error( $normalized_value ) ) {
				if ( $reject_invalid ) {
					return $normalized_value;
				}
				continue;
			}

			$normalized_values[ $request_key ] = $normalized_value;
			if ( $reject_invalid ) {
				$provided_keys[] = $request_key;
			}
		}

		return $normalized_values;
	}

	/**
	 * Normalize one known shared request value.
	 *
	 * @param string $request_key   Shared request key.
	 * @param mixed  $request_value Untrusted request value.
	 * @param array  $configuration Registered catalog configuration.
	 *
	 * @return mixed|WP_Error Normalized value or safe error.
	 */
	private static function normalize_value( $request_key, $request_value, $configuration ) {
		switch ( $request_key ) {
			case 'request_id':
				return self::normalize_integer( $request_value, 0, PHP_INT_MAX, $request_key );

			case 'page_number':
				return self::normalize_integer( $request_value, 1, PHP_INT_MAX, $request_key );

			case 'items_per_page':
				$page_size = self::normalize_integer( $request_value, 1, PHP_INT_MAX, $request_key );
				if ( is_wp_error( $page_size ) ) {
					return $page_size;
				}

				$page_size_config  = isset( $configuration['items_per_page'] ) && is_array( $configuration['items_per_page'] ) ? $configuration['items_per_page'] : array();
				$maximum_page_size = isset( $page_size_config['maximum'] ) ? max( 1, absint( $page_size_config['maximum'] ) ) : 100;
				$allowed_page_sizes = self::normalize_identifier_integers( isset( $page_size_config['options'] ) ? $page_size_config['options'] : array() );
				if ( $page_size > $maximum_page_size || ! in_array( $page_size, $allowed_page_sizes, true ) ) {
					return self::get_error( 'invalid_items_per_page', __( 'The requested catalog page size is not available.', 'booking' ) );
				}
				return $page_size;

			case 'sort_by':
				if ( ! is_scalar( $request_value ) ) {
					return self::get_error( 'invalid_sort_by', __( 'The requested catalog sorting field is invalid.', 'booking' ) );
				}
				$sorting_key = sanitize_key( (string) $request_value );
				$sorting_config = isset( $configuration['sorting'] ) && is_array( $configuration['sorting'] ) ? $configuration['sorting'] : array();
				$allowed_sorting_keys = self::normalize_identifiers( isset( $sorting_config['allowed_keys'] ) ? $sorting_config['allowed_keys'] : array() );
				return in_array( $sorting_key, $allowed_sorting_keys, true )
					? $sorting_key
					: self::get_error( 'invalid_sort_by', __( 'The requested catalog sorting field is invalid.', 'booking' ) );

			case 'sort_order':
				if ( ! is_scalar( $request_value ) ) {
					return self::get_error( 'invalid_sort_order', __( 'The requested catalog sorting direction is invalid.', 'booking' ) );
				}
				$sorting_order = strtolower( trim( (string) $request_value ) );
				return in_array( $sorting_order, array( 'asc', 'desc' ), true )
					? $sorting_order
					: self::get_error( 'invalid_sort_order', __( 'The requested catalog sorting direction is invalid.', 'booking' ) );

			case 'search':
				if ( ! is_scalar( $request_value ) ) {
					return self::get_error( 'invalid_search', __( 'The catalog search value is invalid.', 'booking' ) );
				}
				$search_value = sanitize_text_field( (string) $request_value );
				return function_exists( 'mb_substr' ) ? mb_substr( $search_value, 0, 200 ) : substr( $search_value, 0, 200 );

			case 'visible_columns':
				$column_config   = isset( $configuration['columns'] ) && is_array( $configuration['columns'] ) ? $configuration['columns'] : array();
				$allowed_columns = self::normalize_identifiers( isset( $column_config['allowed'] ) ? $column_config['allowed'] : array() );
				$visible_columns = self::normalize_identifier_list( $request_value, $allowed_columns, $request_key );
				if ( is_wp_error( $visible_columns ) ) {
					return $visible_columns;
				}
				$required_columns = self::normalize_allowed_identifiers( isset( $column_config['required'] ) ? $column_config['required'] : array(), $allowed_columns );
				return array_values( array_unique( array_merge( $visible_columns, $required_columns ) ) );

			case 'column_order':
				$column_config   = isset( $configuration['columns'] ) && is_array( $configuration['columns'] ) ? $configuration['columns'] : array();
				$allowed_columns = self::normalize_identifiers( isset( $column_config['allowed'] ) ? $column_config['allowed'] : array() );
				$column_order    = self::normalize_identifier_list( $request_value, $allowed_columns, $request_key );
				return is_wp_error( $column_order ) ? $column_order : self::complete_column_order( $column_order, $allowed_columns, $column_config );

			case 'template_pack':
				if ( ! is_scalar( $request_value ) ) {
					return self::get_error( 'invalid_template_pack', __( 'The requested catalog layout is invalid.', 'booking' ) );
				}
				$template_pack = sanitize_key( (string) $request_value );
				$allowed_template_packs = isset( $configuration['template_packs'] ) && is_array( $configuration['template_packs'] )
					? self::normalize_identifiers( array_keys( $configuration['template_packs'] ) )
					: array();
				return in_array( $template_pack, $allowed_template_packs, true )
					? $template_pack
					: self::get_error( 'invalid_template_pack', __( 'The requested catalog layout is invalid.', 'booking' ) );
		}

		return self::get_error( 'unsupported_request_key', __( 'The catalog request contains an unsupported value.', 'booking' ) );
	}

	/**
	 * Normalize one bounded integer request value.
	 *
	 * @param mixed  $request_value Untrusted value.
	 * @param int    $minimum       Inclusive minimum.
	 * @param int    $maximum       Inclusive maximum.
	 * @param string $request_key   Key used for a safe error code.
	 *
	 * @return int|WP_Error Bounded integer or safe error.
	 */
	private static function normalize_integer( $request_value, $minimum, $maximum, $request_key ) {
		if ( ! is_scalar( $request_value ) || ! preg_match( '/^-?\d+$/', trim( (string) $request_value ) ) ) {
			return self::get_error( 'invalid_' . sanitize_key( $request_key ), __( 'A numeric catalog request value is invalid.', 'booking' ) );
		}

		$request_value = (int) $request_value;

		return max( $minimum, min( $maximum, $request_value ) );
	}

	/**
	 * Normalize and validate an identifier list.
	 *
	 * @param mixed  $request_value      Untrusted list.
	 * @param array  $allowed_identifiers Allow-listed identifiers.
	 * @param string $request_key        Key used for a safe error code.
	 *
	 * @return array|WP_Error Normalized unique identifiers or safe error.
	 */
	private static function normalize_identifier_list( $request_value, $allowed_identifiers, $request_key ) {
		if ( ! is_array( $request_value ) ) {
			return self::get_error( 'invalid_' . sanitize_key( $request_key ), __( 'A catalog display preference is malformed.', 'booking' ) );
		}

		$normalized_identifiers = array();
		foreach ( $request_value as $identifier ) {
			if ( ! is_scalar( $identifier ) ) {
				return self::get_error( 'invalid_' . sanitize_key( $request_key ), __( 'A catalog display preference is malformed.', 'booking' ) );
			}

			$identifier = sanitize_key( (string) $identifier );
			if ( '' === $identifier || ! in_array( $identifier, $allowed_identifiers, true ) || in_array( $identifier, $normalized_identifiers, true ) ) {
				return self::get_error( 'invalid_' . sanitize_key( $request_key ), __( 'A catalog display preference contains an unsupported value.', 'booking' ) );
			}

			$normalized_identifiers[] = $identifier;
		}

		return $normalized_identifiers;
	}

	/**
	 * Complete a column order while retaining fixed columns in default slots.
	 *
	 * @param array $requested_order Requested allow-listed order.
	 * @param array $allowed_columns Complete allow-listed column collection.
	 * @param array $column_config   Registered column configuration.
	 *
	 * @return array<int,string> Complete normalized column order.
	 */
	private static function complete_column_order( $requested_order, $allowed_columns, $column_config ) {
		$default_order = self::normalize_allowed_identifiers(
			isset( $column_config['default_order'] ) ? $column_config['default_order'] : array(),
			$allowed_columns
		);
		foreach ( $allowed_columns as $column_id ) {
			if ( ! in_array( $column_id, $default_order, true ) ) {
				$default_order[] = $column_id;
			}
			if ( ! in_array( $column_id, $requested_order, true ) ) {
				$requested_order[] = $column_id;
			}
		}

		$definitions = isset( $column_config['definitions'] ) && is_array( $column_config['definitions'] ) ? $column_config['definitions'] : array();
		$movable_order = array_values(
			array_filter(
				$requested_order,
				static function ( $column_id ) use ( $definitions ) {
					return ! isset( $definitions[ $column_id ]['reorderable'] ) || ! empty( $definitions[ $column_id ]['reorderable'] );
				}
			)
		);
		$movable_index = 0;

		return array_map(
			static function ( $column_id ) use ( $definitions, $movable_order, &$movable_index ) {
				if ( isset( $definitions[ $column_id ]['reorderable'] ) && empty( $definitions[ $column_id ]['reorderable'] ) ) {
					return $column_id;
				}

				return isset( $movable_order[ $movable_index ] ) ? $movable_order[ $movable_index++ ] : $column_id;
			},
			$default_order
		);
	}

	/**
	 * Normalize scalar identifiers while silently dropping invalid values.
	 *
	 * @param mixed $identifiers Raw identifier collection.
	 *
	 * @return array<int,string> Sanitized unique identifiers.
	 */
	private static function normalize_identifiers( $identifiers ) {
		$normalized_identifiers = array();

		if ( ! is_array( $identifiers ) ) {
			return $normalized_identifiers;
		}

		foreach ( $identifiers as $identifier ) {
			$identifier = is_scalar( $identifier ) ? sanitize_key( (string) $identifier ) : '';
			if ( '' !== $identifier && ! in_array( $identifier, $normalized_identifiers, true ) ) {
				$normalized_identifiers[] = $identifier;
			}
		}

		return $normalized_identifiers;
	}

	/**
	 * Normalize integer configuration values.
	 *
	 * @param mixed $integers Raw integer collection.
	 *
	 * @return array<int,int> Positive unique integers.
	 */
	private static function normalize_identifier_integers( $integers ) {
		$normalized_integers = array();

		if ( ! is_array( $integers ) ) {
			return $normalized_integers;
		}

		foreach ( $integers as $integer ) {
			$integer = is_scalar( $integer ) ? absint( $integer ) : 0;
			if ( 0 < $integer && ! in_array( $integer, $normalized_integers, true ) ) {
				$normalized_integers[] = $integer;
			}
		}

		return $normalized_integers;
	}

	/**
	 * Normalize defaults against an allow-list without returning errors.
	 *
	 * @param mixed $identifiers         Raw default identifiers.
	 * @param array $allowed_identifiers Allowed identifiers.
	 *
	 * @return array<int,string> Valid default identifiers.
	 */
	private static function normalize_allowed_identifiers( $identifiers, $allowed_identifiers ) {
		return array_values( array_intersect( self::normalize_identifiers( $identifiers ), $allowed_identifiers ) );
	}

	/**
	 * Create a namespaced, non-sensitive request error.
	 *
	 * @param string $error_code    Short error code.
	 * @param string $error_message User-facing error message.
	 *
	 * @return WP_Error Request error.
	 */
	private static function get_error( $error_code, $error_message ) {
		return new WP_Error( 'wpbc_ui_catalog_' . sanitize_key( $error_code ), $error_message );
	}
}
