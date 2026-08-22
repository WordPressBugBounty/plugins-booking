<?php
/**
 * Registry for independent template-driven catalogs.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Store validated catalog mechanics, optional providers, and trusted templates.
 */
final class WPBC_UI_Catalog_Registry {

	/**
	 * Shared registry instance.
	 *
	 * @var WPBC_UI_Catalog_Registry|null
	 */
	private static $instance = null;

	/**
	 * Registered catalog configurations keyed by stable catalog ID.
	 *
	 * @var array
	 */
	private $configurations = array();

	/**
	 * Optional catalog providers keyed by stable catalog ID.
	 *
	 * @var array
	 */
	private $providers = array();

	/**
	 * Trusted template files keyed by catalog ID and template ID.
	 *
	 * @var array
	 */
	private $template_files = array();

	/**
	 * Prevent direct construction.
	 */
	private function __construct() {}

	/**
	 * Return the request-scoped shared registry.
	 *
	 * @return WPBC_UI_Catalog_Registry Shared registry instance.
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Register one catalog configuration and optional provider.
	 *
	 * Template paths are trusted code declarations and are never localized to
	 * JavaScript. Duplicate identifiers fail rather than replacing a catalog.
	 *
	 * @param mixed                         $configuration Raw catalog configuration.
	 * @param WPBC_UI_Catalog_Provider|null $provider      Optional domain provider.
	 * @param mixed                         $template_files Template ID to PHP file map.
	 *
	 * @return true|WP_Error True when registered, otherwise a safe error.
	 */
	public function register( $configuration, $provider = null, $template_files = array() ) {
		$configuration = $this->normalize_configuration( $configuration );
		if ( is_wp_error( $configuration ) ) {
			return $configuration;
		}

		$catalog_id = $configuration['id'];
		if ( isset( $this->configurations[ $catalog_id ] ) ) {
			return $this->get_error( 'duplicate_catalog', __( 'A catalog with this identifier is already registered.', 'booking' ) );
		}

		if ( null !== $provider ) {
			$provider_catalog_id = '';
			if ( $provider instanceof WPBC_UI_Catalog_Provider ) {
				$raw_provider_catalog_id = $provider->get_catalog_id();
				$provider_catalog_id     = is_scalar( $raw_provider_catalog_id ) ? sanitize_key( (string) $raw_provider_catalog_id ) : '';
			}
			if ( $catalog_id !== $provider_catalog_id ) {
				return $this->get_error( 'invalid_provider', __( 'The catalog provider is invalid.', 'booking' ) );
			}
		}

		$normalized_template_files = $this->normalize_template_files( $template_files );
		if ( is_wp_error( $normalized_template_files ) ) {
			return $normalized_template_files;
		}

		$this->configurations[ $catalog_id ] = $configuration;
		$this->template_files[ $catalog_id ] = $normalized_template_files;
		if ( null !== $provider ) {
			$this->providers[ $catalog_id ] = $provider;
		}

		return true;
	}

	/**
	 * Determine whether a catalog identifier is registered.
	 *
	 * @param string $catalog_id Catalog identifier.
	 *
	 * @return bool True when registered.
	 */
	public function has( $catalog_id ) {
		$catalog_id = is_scalar( $catalog_id ) ? sanitize_key( (string) $catalog_id ) : '';

		return isset( $this->configurations[ $catalog_id ] );
	}

	/**
	 * Return one registered configuration.
	 *
	 * @param string $catalog_id Catalog identifier.
	 *
	 * @return array Registered configuration or an empty array.
	 */
	public function get_configuration( $catalog_id ) {
		$catalog_id = is_scalar( $catalog_id ) ? sanitize_key( (string) $catalog_id ) : '';

		return isset( $this->configurations[ $catalog_id ] ) ? $this->configurations[ $catalog_id ] : array();
	}

	/**
	 * Return all registered configurations.
	 *
	 * @return array<string,array> Configurations keyed by catalog ID.
	 */
	public function get_configurations() {
		return $this->configurations;
	}

	/**
	 * Return trusted template files for one catalog.
	 *
	 * @param string $catalog_id Catalog identifier.
	 *
	 * @return array<string,string> Template paths keyed by template ID.
	 */
	public function get_template_files( $catalog_id ) {
		$catalog_id = is_scalar( $catalog_id ) ? sanitize_key( (string) $catalog_id ) : '';

		return isset( $this->template_files[ $catalog_id ] ) ? $this->template_files[ $catalog_id ] : array();
	}

	/**
	 * Ask one registered provider for a normalized response.
	 *
	 * @param string                  $catalog_id Catalog identifier.
	 * @param WPBC_UI_Catalog_Request $request    Validated shared request.
	 *
	 * @return WPBC_UI_Catalog_Response|WP_Error Provider response or safe error.
	 */
	public function get_response( $catalog_id, $request ) {
		$catalog_id = is_scalar( $catalog_id ) ? sanitize_key( (string) $catalog_id ) : '';
		if ( ! $request instanceof WPBC_UI_Catalog_Request || $catalog_id !== $request->get_catalog_id() ) {
			return $this->get_error( 'invalid_request', __( 'The catalog request is invalid.', 'booking' ) );
		}

		if ( ! isset( $this->providers[ $catalog_id ] ) ) {
			return $this->get_error( 'missing_provider', __( 'The catalog data provider is not available.', 'booking' ) );
		}

		$response = $this->providers[ $catalog_id ]->get_response( $request );
		if ( is_wp_error( $response ) || $response instanceof WPBC_UI_Catalog_Response ) {
			return $response;
		}

		return $this->get_error( 'invalid_provider_response', __( 'The catalog provider returned an invalid response.', 'booking' ) );
	}

	/**
	 * Normalize trusted catalog configuration into a stable shared contract.
	 *
	 * @param mixed $configuration Raw configuration.
	 *
	 * @return array|WP_Error Normalized configuration or safe error.
	 */
	private function normalize_configuration( $configuration ) {
		if ( ! is_array( $configuration ) || empty( $configuration['id'] ) ) {
			return $this->get_error( 'invalid_configuration', __( 'The catalog configuration is invalid.', 'booking' ) );
		}

		$catalog_id = sanitize_key( (string) $configuration['id'] );
		if ( '' === $catalog_id ) {
			return $this->get_error( 'invalid_catalog_id', __( 'The catalog identifier is invalid.', 'booking' ) );
		}

		$page_size_config = isset( $configuration['items_per_page'] ) && is_array( $configuration['items_per_page'] ) ? $configuration['items_per_page'] : array();
		$page_size_options = $this->normalize_positive_integers( isset( $page_size_config['options'] ) ? $page_size_config['options'] : array() );
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
			return $this->get_error( 'invalid_page_sizes', __( 'The catalog page-size configuration is invalid.', 'booking' ) );
		}

		$default_page_size = isset( $page_size_config['default'] ) ? absint( $page_size_config['default'] ) : $page_size_options[0];
		if ( ! in_array( $default_page_size, $page_size_options, true ) ) {
			return $this->get_error( 'invalid_default_page_size', __( 'The default catalog page size is invalid.', 'booking' ) );
		}

		$sorting_config = isset( $configuration['sorting'] ) && is_array( $configuration['sorting'] ) ? $configuration['sorting'] : array();
		$allowed_sorting_keys = $this->normalize_identifiers( isset( $sorting_config['allowed_keys'] ) ? $sorting_config['allowed_keys'] : array() );
		$default_sorting_key  = isset( $sorting_config['default_key'] ) ? sanitize_key( (string) $sorting_config['default_key'] ) : '';
		$default_sorting_order = isset( $sorting_config['default_order'] ) ? strtolower( (string) $sorting_config['default_order'] ) : '';
		if ( empty( $allowed_sorting_keys ) || ! in_array( $default_sorting_key, $allowed_sorting_keys, true ) || ! in_array( $default_sorting_order, array( 'asc', 'desc' ), true ) ) {
			return $this->get_error( 'invalid_sorting', __( 'The catalog sorting configuration is invalid.', 'booking' ) );
		}

		$column_config          = isset( $configuration['columns'] ) && is_array( $configuration['columns'] ) ? $configuration['columns'] : array();
		$allowed_columns        = $this->normalize_identifiers( isset( $column_config['allowed'] ) ? $column_config['allowed'] : array() );
		$default_visible_columns = $this->normalize_allowed_identifiers(
			isset( $column_config['default_visible'] ) ? $column_config['default_visible'] : array(),
			$allowed_columns
		);
		$default_column_order = $this->normalize_allowed_identifiers(
			isset( $column_config['default_order'] ) ? $column_config['default_order'] : array(),
			$allowed_columns
		);
		$required_columns = $this->normalize_allowed_identifiers(
			isset( $column_config['required'] ) ? $column_config['required'] : array(),
			$allowed_columns
		);
		$column_definitions = $this->normalize_column_definitions(
			isset( $column_config['definitions'] ) ? $column_config['definitions'] : array(),
			$allowed_columns
		);
		$view_config       = isset( $configuration['views'] ) && is_array( $configuration['views'] ) ? $configuration['views'] : array();
		$view_definitions  = $this->normalize_view_definitions(
			isset( $view_config['definitions'] ) ? $view_config['definitions'] : array(),
			$allowed_columns
		);
		$default_view      = isset( $view_config['default'] ) ? sanitize_key( (string) $view_config['default'] ) : '';
		if ( '' === $default_view || ! isset( $view_definitions[ $default_view ] ) ) {
			$default_view = ! empty( $view_definitions ) ? (string) key( $view_definitions ) : '';
		}

		$templates             = $this->normalize_template_map( isset( $configuration['templates'] ) ? $configuration['templates'] : array() );
		$template_packs        = $this->normalize_template_packs( isset( $configuration['template_packs'] ) ? $configuration['template_packs'] : array() );
		$default_template_pack = isset( $configuration['default_template_pack'] ) ? sanitize_key( (string) $configuration['default_template_pack'] ) : '';
		if (
			empty( $templates['catalog'] )
			|| empty( $templates['shell'] )
			|| empty( $templates['empty'] )
			|| empty( $templates['error'] )
			|| empty( $template_packs[ $default_template_pack ] )
		) {
			return $this->get_error( 'invalid_templates', __( 'The catalog template configuration is invalid.', 'booking' ) );
		}

		$features = array();
		foreach ( isset( $configuration['features'] ) && is_array( $configuration['features'] ) ? $configuration['features'] : array() as $feature_id => $is_enabled ) {
			$feature_id = is_scalar( $feature_id ) ? sanitize_key( (string) $feature_id ) : '';
			if ( '' !== $feature_id ) {
				$features[ $feature_id ] = (bool) $is_enabled;
			}
		}
		$hierarchy_configuration = WPBC_UI_Catalog_Hierarchy::normalize_configuration(
			isset( $configuration['hierarchy'] ) ? $configuration['hierarchy'] : null,
			! empty( $features['hierarchy'] )
		);
		if ( is_wp_error( $hierarchy_configuration ) ) {
			return $hierarchy_configuration;
		}

		$search_configuration = isset( $configuration['search'] ) && is_array( $configuration['search'] )
			? $configuration['search']
			: array();
		$search_debounce_delay = isset( $search_configuration['debounce_delay_ms'] ) && is_scalar( $search_configuration['debounce_delay_ms'] )
			? absint( $search_configuration['debounce_delay_ms'] )
			: 300;
		$search_debounce_delay = min( 2000, $search_debounce_delay );
		$search_immediate_clear = ! isset( $search_configuration['immediate_clear'] )
			|| (bool) $search_configuration['immediate_clear'];

		$i18n = array();
		foreach ( isset( $configuration['i18n'] ) && is_array( $configuration['i18n'] ) ? $configuration['i18n'] : array() as $message_id => $message ) {
			$message_id = is_scalar( $message_id ) ? sanitize_key( (string) $message_id ) : '';
			if ( '' !== $message_id && is_scalar( $message ) ) {
				$i18n[ $message_id ] = sanitize_text_field( (string) $message );
			}
		}

		$action     = isset( $configuration['action'] ) && is_scalar( $configuration['action'] ) ? preg_replace( '/[^A-Za-z0-9_\-]/', '', (string) $configuration['action'] ) : '';
		$nonce_name = isset( $configuration['nonce_name'] ) && is_scalar( $configuration['nonce_name'] ) ? sanitize_key( (string) $configuration['nonce_name'] ) : '';
		if ( '' === $action || '' === $nonce_name ) {
			return $this->get_error( 'invalid_transport', __( 'The catalog transport configuration is invalid.', 'booking' ) );
		}

		$normalized_configuration = array(
			'id'                    => $catalog_id,
			'schema_version'        => WPBC_UI_Catalog_Response::SCHEMA_VERSION,
			'action'                => $action,
			'nonce_name'            => $nonce_name,
			'items_per_page'         => array(
				'default' => $default_page_size,
				'options' => $page_size_options,
				'maximum' => $maximum_page_size,
			),
			'sorting'               => array(
				'default_key'   => $default_sorting_key,
				'default_order' => $default_sorting_order,
				'allowed_keys'  => $allowed_sorting_keys,
			),
			'columns'               => array(
				'allowed'         => $allowed_columns,
				'default_visible' => $default_visible_columns,
				'default_order'   => $default_column_order,
				'required'        => $required_columns,
				'definitions'     => $column_definitions,
			),
			'views'                 => array(
				'default'     => $default_view,
				'definitions' => $view_definitions,
			),
			'features'              => $features,
			'search'                => array(
				'debounce_delay_ms' => $search_debounce_delay,
				'immediate_clear'   => $search_immediate_clear,
			),
			'hierarchy'             => $hierarchy_configuration,
			'templates'             => $templates,
			'template_packs'        => $template_packs,
			'default_template_pack' => $default_template_pack,
			'i18n'                  => $i18n,
		);

		$default_request = WPBC_UI_Catalog_Request::create( $normalized_configuration );

		return is_wp_error( $default_request ) ? $default_request : $normalized_configuration;
	}

	/**
	 * Normalize allow-listed column presets used by the generic view selector.
	 *
	 * @param mixed $view_definitions Raw preset definitions keyed by identifier.
	 * @param array $allowed_columns  Registered column identifiers.
	 *
	 * @return array<string,array<string,mixed>> Browser-safe preset metadata.
	 */
	private function normalize_view_definitions( $view_definitions, $allowed_columns ) {
		$normalized_views = array();

		if ( ! is_array( $view_definitions ) ) {
			return $normalized_views;
		}

		foreach ( $view_definitions as $view_id => $view_definition ) {
			$view_id = is_scalar( $view_id ) ? sanitize_key( (string) $view_id ) : '';
			if ( '' === $view_id || ! is_array( $view_definition ) ) {
				continue;
			}

			$view_fields = $this->normalize_allowed_identifiers(
				isset( $view_definition['fields'] ) ? $view_definition['fields'] : array(),
				$allowed_columns
			);
			if ( empty( $view_fields ) ) {
				continue;
			}

			$normalized_views[ $view_id ] = array(
				'id'     => $view_id,
				'label'  => isset( $view_definition['label'] ) && is_scalar( $view_definition['label'] )
					? sanitize_text_field( (string) $view_definition['label'] )
					: $view_id,
				'fields' => $view_fields,
			);
		}

		return $normalized_views;
	}

	/**
	 * Normalize presentation metadata for allow-listed catalog columns.
	 *
	 * @param mixed $column_definitions Raw column definitions keyed by ID.
	 * @param array $allowed_columns    Registered column identifiers.
	 *
	 * @return array<string,array<string,mixed>> Browser-safe column metadata.
	 */
	private function normalize_column_definitions( $column_definitions, $allowed_columns ) {
		$normalized_definitions = array();

		if ( ! is_array( $column_definitions ) ) {
			return $normalized_definitions;
		}

		foreach ( $allowed_columns as $column_id ) {
			$column_definition = isset( $column_definitions[ $column_id ] ) && is_array( $column_definitions[ $column_id ] )
				? $column_definitions[ $column_id ]
				: array();
			$sort_key = isset( $column_definition['sort_key'] ) && is_scalar( $column_definition['sort_key'] )
				? sanitize_key( (string) $column_definition['sort_key'] )
				: '';
			$column_label = isset( $column_definition['label'] ) && is_scalar( $column_definition['label'] )
				? sanitize_text_field( (string) $column_definition['label'] )
				: $column_id;
			$column_class = isset( $column_definition['class'] ) && is_scalar( $column_definition['class'] )
				? sanitize_html_class( (string) $column_definition['class'] )
				: 'column-' . sanitize_html_class( $column_id );
			$normalized_definitions[ $column_id ] = array(
				'id'          => $column_id,
				'label'       => $column_label,
				'class'       => $column_class,
				'sort_key'    => $sort_key,
				'required'    => ! empty( $column_definition['required'] ),
				'reorderable' => ! isset( $column_definition['reorderable'] ) || ! empty( $column_definition['reorderable'] ),
			);
		}

		return $normalized_definitions;
	}

	/**
	 * Normalize trusted template file declarations.
	 *
	 * @param mixed $template_files Raw template file map.
	 *
	 * @return array|WP_Error Template paths or safe error.
	 */
	private function normalize_template_files( $template_files ) {
		$normalized_template_files = array();

		if ( ! is_array( $template_files ) ) {
			return $this->get_error( 'invalid_template_files', __( 'The catalog template files are invalid.', 'booking' ) );
		}

		foreach ( $template_files as $template_id => $template_file ) {
			$template_id = is_scalar( $template_id ) ? sanitize_key( (string) $template_id ) : '';
			$template_file = is_scalar( $template_file ) ? (string) $template_file : '';
			$resolved_file = '' !== $template_file ? realpath( $template_file ) : false;
			if ( '' === $template_id || false === $resolved_file || 'php' !== strtolower( pathinfo( $resolved_file, PATHINFO_EXTENSION ) ) || ! is_readable( $resolved_file ) ) {
				return $this->get_error( 'invalid_template_file', __( 'A catalog template file is invalid.', 'booking' ) );
			}
			$normalized_template_files[ $template_id ] = $resolved_file;
		}

		return $normalized_template_files;
	}

	/**
	 * Normalize template IDs keyed by their presentation role.
	 *
	 * @param mixed $template_map Raw role-to-template map.
	 *
	 * @return array<string,string> Normalized template map.
	 */
	private function normalize_template_map( $template_map ) {
		$normalized_templates = array();

		if ( ! is_array( $template_map ) ) {
			return $normalized_templates;
		}

		foreach ( $template_map as $template_role => $template_id ) {
			$template_role = is_scalar( $template_role ) ? sanitize_key( (string) $template_role ) : '';
			$template_id   = is_scalar( $template_id ) ? sanitize_key( (string) $template_id ) : '';
			if ( '' !== $template_role && '' !== $template_id ) {
				$normalized_templates[ $template_role ] = $template_id;
			}
		}

		return $normalized_templates;
	}

	/**
	 * Normalize allow-listed presentation packs.
	 *
	 * @param mixed $template_packs Raw template packs.
	 *
	 * @return array<string,array> Normalized template packs.
	 */
	private function normalize_template_packs( $template_packs ) {
		$normalized_template_packs = array();

		if ( ! is_array( $template_packs ) ) {
			return $normalized_template_packs;
		}

		foreach ( $template_packs as $template_pack_id => $template_map ) {
			$template_pack_id = is_scalar( $template_pack_id ) ? sanitize_key( (string) $template_pack_id ) : '';
			$template_map     = $this->normalize_template_map( $template_map );
			if ( '' !== $template_pack_id && ! empty( $template_map ) ) {
				$normalized_template_packs[ $template_pack_id ] = $template_map;
			}
		}

		return $normalized_template_packs;
	}

	/**
	 * Normalize scalar identifiers.
	 *
	 * @param mixed $identifiers Raw identifiers.
	 *
	 * @return array<int,string> Sanitized unique identifiers.
	 */
	private function normalize_identifiers( $identifiers ) {
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
	 * Keep valid defaults in their declared order.
	 *
	 * @param mixed $identifiers         Raw defaults.
	 * @param array $allowed_identifiers Allowed identifiers.
	 *
	 * @return array<int,string> Valid defaults.
	 */
	private function normalize_allowed_identifiers( $identifiers, $allowed_identifiers ) {
		return array_values( array_intersect( $this->normalize_identifiers( $identifiers ), $allowed_identifiers ) );
	}

	/**
	 * Normalize positive integer configuration values.
	 *
	 * @param mixed $integers Raw integer values.
	 *
	 * @return array<int,int> Positive unique integers.
	 */
	private function normalize_positive_integers( $integers ) {
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
	 * Create a namespaced registry error.
	 *
	 * @param string $error_code    Short error code.
	 * @param string $error_message User-facing error message.
	 *
	 * @return WP_Error Registry error.
	 */
	private function get_error( $error_code, $error_message ) {
		return new WP_Error( 'wpbc_ui_catalog_' . sanitize_key( $error_code ), $error_message );
	}
}
