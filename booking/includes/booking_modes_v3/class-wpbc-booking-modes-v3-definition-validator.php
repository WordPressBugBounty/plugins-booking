<?php
/**
 * Strict validator for Booking Modes V3 declarations.
 *
 * @package Booking Calendar
 * @since   11.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validate and normalize the bounded, executable-free V3 declaration format.
 */
final class WPBC_Booking_Modes_V3_Definition_Validator {

	const MAX_COLLECTION_ENTRIES = 256;
	const MAX_SIDEBAR_NODES      = 512;
	const MAX_SIDEBAR_DEPTH      = 8;
	const MAX_TEXT_BYTES         = 4096;
	const MAX_IDENTIFIER_BYTES   = 128;
	const MAX_ICON_BYTES         = 512;
	const MAX_DIAGNOSTICS        = 50;

	/** @var array<int,string> */
	private $errors = array();

	/** @var int */
	private $sidebar_node_count = 0;

	/** @var array<string,string> */
	private $sidebar_placements = array();

	/**
	 * Validate one allow-listed declaration.
	 *
	 * @param string $expected_mode_id Expected allow-list identifier.
	 * @param mixed  $definition       Included declaration value.
	 *
	 * @return array<string,mixed> Validation result with valid, definition, and errors keys.
	 */
	public function validate( $expected_mode_id, $definition ) {
		$this->errors              = array();
		$this->sidebar_node_count  = 0;
		$this->sidebar_placements  = array();
		$normalized                = array();
		$top_level_keys            = array( 'id', 'label', 'description', 'default_route', 'quickstart_id', 'pages', 'wordpress_menu', 'sidebar_menu' );

		if ( ! is_array( $definition ) ) {
			$this->add_error( 'mode', 'The declaration must return an array.' );
			return $this->result( $normalized );
		}

		$this->validate_exact_keys( 'mode', $definition, $top_level_keys, $top_level_keys );
		$normalized['id']            = $this->validate_identifier( 'mode.id', isset( $definition['id'] ) ? $definition['id'] : null, false );
		$normalized['label']         = $this->validate_text( 'mode.label', isset( $definition['label'] ) ? $definition['label'] : null, self::MAX_TEXT_BYTES );
		$normalized['description']   = $this->validate_text( 'mode.description', isset( $definition['description'] ) ? $definition['description'] : null, self::MAX_TEXT_BYTES );
		$normalized['default_route'] = $this->validate_route( 'mode.default_route', isset( $definition['default_route'] ) ? $definition['default_route'] : null );
		$normalized['quickstart_id'] = $this->validate_identifier( 'mode.quickstart_id', isset( $definition['quickstart_id'] ) ? $definition['quickstart_id'] : null, true );

		if ( $normalized['id'] !== $expected_mode_id ) {
			$this->add_error( 'mode.id', 'The mode identifier does not match its allow-list key.' );
		}

		$normalized['pages']          = $this->validate_pages( isset( $definition['pages'] ) ? $definition['pages'] : null );
		$normalized['wordpress_menu'] = $this->validate_wordpress_menu( isset( $definition['wordpress_menu'] ) ? $definition['wordpress_menu'] : null, $normalized['pages'] );
		$normalized['sidebar_menu']   = $this->validate_sidebar_menu( isset( $definition['sidebar_menu'] ) ? $definition['sidebar_menu'] : null, $normalized['pages'] );
		$this->validate_horizontal_hosts( $normalized['pages'] );

		return $this->result( $normalized );
	}

	/**
	 * Build a stable validation result.
	 *
	 * @param array $definition Normalized declaration.
	 *
	 * @return array<string,mixed> Validation result.
	 */
	private function result( $definition ) {
		return array(
			'valid'      => empty( $this->errors ),
			'definition' => empty( $this->errors ) ? $definition : array(),
			'errors'     => $this->errors,
		);
	}

	/**
	 * Validate the pages map and its surface-local options.
	 *
	 * @param mixed $pages Raw pages map.
	 *
	 * @return array<string,array<string,mixed>> Normalized pages.
	 */
	private function validate_pages( $pages ) {
		$normalized_pages = array();

		if ( ! $this->validate_map( 'mode.pages', $pages ) ) {
			return $normalized_pages;
		}

		foreach ( $pages as $page_id => $page_definition ) {
			$page_path = 'mode.pages.' . $page_id;
			$this->validate_identifier( $page_path . ' key', $page_id, false );

			if ( ! is_array( $page_definition ) ) {
				$this->add_error( $page_path, 'The page definition must be an array.' );
				continue;
			}

			$this->validate_exact_keys( $page_path, $page_definition, array( 'route', 'page_options', 'horizontal_menu' ), array( 'route' ) );
			$normalized_page = array(
				'route' => $this->validate_route( $page_path . '.route', isset( $page_definition['route'] ) ? $page_definition['route'] : null ),
			);

			if ( array_key_exists( 'page_options', $page_definition ) ) {
				$normalized_page['page_options'] = $this->validate_page_options( $page_path . '.page_options', $page_definition['page_options'] );
			}
			if ( array_key_exists( 'horizontal_menu', $page_definition ) ) {
				$normalized_page['horizontal_menu'] = $this->validate_horizontal_menu( $page_path . '.horizontal_menu', $page_definition['horizontal_menu'] );
			}

			$normalized_pages[ $page_id ] = $normalized_page;
		}

		return $normalized_pages;
	}

	/**
	 * Validate page-heading and host presentation options.
	 *
	 * @param string $path    Diagnostic path.
	 * @param mixed  $options Raw page options.
	 *
	 * @return array<string,mixed> Normalized options.
	 */
	private function validate_page_options( $path, $options ) {
		$normalized = array();
		$string_keys = array( 'page_title', 'page_description', 'top_path_title' );
		$bool_keys   = array( 'is_show_top_path', 'is_show_top_navigation', 'top_navigation_use_subtabs' );

		if ( ! is_array( $options ) ) {
			$this->add_error( $path, 'Page options must be an array.' );
			return $normalized;
		}

		$this->validate_exact_keys( $path, $options, array_merge( $string_keys, $bool_keys ), array() );
		foreach ( $string_keys as $key ) {
			if ( array_key_exists( $key, $options ) ) {
				$normalized[ $key ] = $this->validate_text( $path . '.' . $key, $options[ $key ], self::MAX_TEXT_BYTES );
			}
		}
		foreach ( $bool_keys as $key ) {
			if ( array_key_exists( $key, $options ) ) {
				$normalized[ $key ] = $this->validate_boolean( $path . '.' . $key, $options[ $key ] );
			}
		}

		return $normalized;
	}

	/**
	 * Validate one horizontal-menu declaration.
	 *
	 * @param string $path       Diagnostic path.
	 * @param mixed  $definition Raw horizontal definition.
	 *
	 * @return array<string,mixed> Normalized definition.
	 */
	private function validate_horizontal_menu( $path, $definition ) {
		$normalized = array();

		if ( ! is_array( $definition ) ) {
			$this->add_error( $path, 'Horizontal menu options must be an array.' );
			return $normalized;
		}

		$this->validate_exact_keys( $path, $definition, array( 'visible', 'title', 'font_icon', 'editions', 'show_on_pages' ), array() );
		if ( array_key_exists( 'visible', $definition ) ) {
			$normalized['visible'] = $this->validate_boolean( $path . '.visible', $definition['visible'] );
		}
		if ( array_key_exists( 'title', $definition ) ) {
			$normalized['title'] = $this->validate_text( $path . '.title', $definition['title'], self::MAX_TEXT_BYTES );
		}
		if ( array_key_exists( 'font_icon', $definition ) ) {
			$normalized['font_icon'] = $this->validate_text( $path . '.font_icon', $definition['font_icon'], self::MAX_ICON_BYTES );
		}
		if ( array_key_exists( 'editions', $definition ) ) {
			$normalized['editions'] = $this->validate_editions( $path . '.editions', $definition['editions'] );
		}
		if ( array_key_exists( 'show_on_pages', $definition ) ) {
			$normalized['show_on_pages'] = $this->validate_identifier_list( $path . '.show_on_pages', $definition['show_on_pages'] );
		}

		return $normalized;
	}

	/**
	 * Validate the native WordPress submenu overrides.
	 *
	 * @param mixed $menu  Raw native menu map.
	 * @param array $pages Validated local pages.
	 *
	 * @return array<string,array<string,mixed>> Normalized native overrides.
	 */
	private function validate_wordpress_menu( $menu, $pages ) {
		$normalized = array();

		if ( ! $this->validate_map( 'mode.wordpress_menu', $menu ) ) {
			return $normalized;
		}

		foreach ( $menu as $menu_slug => $definition ) {
			$path = 'mode.wordpress_menu.' . $menu_slug;
			$this->validate_identifier( $path . ' key', $menu_slug, false );
			if ( ! is_array( $definition ) ) {
				$this->add_error( $path, 'A WordPress menu override must be an array.' );
				continue;
			}

			$this->validate_exact_keys( $path, $definition, array( 'page_id', 'title', 'visible', 'editions' ), array() );
			$normalized[ $menu_slug ] = array();
			if ( array_key_exists( 'page_id', $definition ) ) {
				$page_id = $this->validate_identifier( $path . '.page_id', $definition['page_id'], false );
				if ( ! isset( $pages[ $page_id ] ) ) {
					$this->add_error( $path . '.page_id', 'The local page reference is undefined.' );
				}
				$normalized[ $menu_slug ]['page_id'] = $page_id;
			}
			if ( array_key_exists( 'title', $definition ) ) {
				$normalized[ $menu_slug ]['title'] = $this->validate_text( $path . '.title', $definition['title'], self::MAX_TEXT_BYTES );
			}
			if ( array_key_exists( 'visible', $definition ) ) {
				$normalized[ $menu_slug ]['visible'] = $this->validate_boolean( $path . '.visible', $definition['visible'] );
			}
			if ( array_key_exists( 'editions', $definition ) ) {
				$normalized[ $menu_slug ]['editions'] = $this->validate_editions( $path . '.editions', $definition['editions'] );
			}
		}

		return $normalized;
	}

	/**
	 * Validate the recursive sidebar map.
	 *
	 * @param mixed $menu  Raw sidebar map.
	 * @param array $pages Validated local pages.
	 *
	 * @return array<string,array<string,mixed>> Normalized sidebar map.
	 */
	private function validate_sidebar_menu( $menu, $pages ) {
		if ( ! $this->validate_map( 'mode.sidebar_menu', $menu ) ) {
			return array();
		}

		return $this->validate_sidebar_nodes( 'mode.sidebar_menu', $menu, $pages, 1 );
	}

	/**
	 * Recursively validate sidebar nodes with bounded depth and node count.
	 *
	 * @param string $path  Diagnostic path.
	 * @param array  $nodes Raw node map.
	 * @param array  $pages Validated local pages.
	 * @param int    $depth Current one-based depth.
	 *
	 * @return array<string,array<string,mixed>> Normalized nodes.
	 */
	private function validate_sidebar_nodes( $path, $nodes, $pages, $depth ) {
		$normalized = array();

		if ( $depth > self::MAX_SIDEBAR_DEPTH ) {
			$this->add_error( $path, 'The sidebar nesting depth exceeds the supported limit.' );
			return $normalized;
		}

		foreach ( $nodes as $node_key => $definition ) {
			++$this->sidebar_node_count;
			$node_path = $path . '.' . $node_key;
			$this->validate_identifier( $node_path . ' key', $node_key, false );
			if ( $this->sidebar_node_count > self::MAX_SIDEBAR_NODES ) {
				$this->add_error( $node_path, 'The sidebar node count exceeds the supported limit.' );
				break;
			}
			if ( ! is_array( $definition ) ) {
				$this->add_error( $node_path, 'A sidebar node must be an array.' );
				continue;
			}

			$this->validate_exact_keys( $node_path, $definition, array( 'page_id', 'title', 'font_icon', 'font_icon_right', 'visible', 'editions', 'expanded', 'items' ), array() );
			$normalized_node = array();
			if ( array_key_exists( 'page_id', $definition ) ) {
				$page_id = $this->validate_identifier( $node_path . '.page_id', $definition['page_id'], false );
				if ( ! isset( $pages[ $page_id ] ) ) {
					$this->add_error( $node_path . '.page_id', 'The local page reference is undefined.' );
				}
				$source_identity = isset( $pages[ $page_id ]['route'] )
					? WPBC_Booking_Modes_V3_Definition_Validator::get_route_identity( $pages[ $page_id ]['route'] )
					: 'undefined:' . $page_id;
				if ( isset( $this->sidebar_placements[ $source_identity ] ) ) {
					$this->add_error( $node_path . '.page_id', 'The source page already has an explicit sidebar placement.' );
				} else {
					$this->sidebar_placements[ $source_identity ] = $node_path;
				}
				$normalized_node['page_id'] = $page_id;
			}
			foreach ( array( 'title', 'font_icon', 'font_icon_right' ) as $text_key ) {
				if ( array_key_exists( $text_key, $definition ) ) {
					$limit = 'title' === $text_key ? self::MAX_TEXT_BYTES : self::MAX_ICON_BYTES;
					$normalized_node[ $text_key ] = $this->validate_text( $node_path . '.' . $text_key, $definition[ $text_key ], $limit );
				}
			}
			if ( array_key_exists( 'visible', $definition ) ) {
				$normalized_node['visible'] = $this->validate_boolean( $node_path . '.visible', $definition['visible'] );
			}
			if ( array_key_exists( 'editions', $definition ) ) {
				$normalized_node['editions'] = $this->validate_editions( $node_path . '.editions', $definition['editions'] );
			}
			if ( array_key_exists( 'expanded', $definition ) ) {
				$expanded = $definition['expanded'];
				if ( ! is_string( $expanded ) || ! in_array( $expanded, array( 'On', 'Off', 'when_active' ), true ) ) {
					$this->add_error( $node_path . '.expanded', 'Expanded must be On, Off, or when_active.' );
					$expanded = '';
				}
				$normalized_node['expanded'] = $expanded;
			}
			if ( array_key_exists( 'items', $definition ) ) {
				if ( $this->validate_map( $node_path . '.items', $definition['items'] ) ) {
					$normalized_node['items'] = $this->validate_sidebar_nodes( $node_path . '.items', $definition['items'], $pages, $depth + 1 );
				} else {
					$normalized_node['items'] = array();
				}
			} elseif ( $depth > 1 && ! isset( $normalized_node['page_id'] ) ) {
				$this->add_error( $node_path, 'A new nested folder must declare its items map.' );
			}
			if ( $depth > 1 && ! isset( $normalized_node['page_id'] ) && ( ! array_key_exists( 'title', $normalized_node ) || '' === $normalized_node['title'] ) ) {
				$this->add_error( $node_path, 'A new nested folder must declare its title.' );
			}

			$normalized[ $node_key ] = $normalized_node;
		}

		return $normalized;
	}

	/**
	 * Validate local page references used as horizontal hosts.
	 *
	 * @param array $pages Validated pages map.
	 *
	 * @return void
	 */
	private function validate_horizontal_hosts( $pages ) {
		foreach ( $pages as $page_id => $page_definition ) {
			if ( ! isset( $page_definition['horizontal_menu']['show_on_pages'] ) ) {
				continue;
			}
			foreach ( $page_definition['horizontal_menu']['show_on_pages'] as $host_page_id ) {
				if ( ! isset( $pages[ $host_page_id ] ) ) {
					$this->add_error( 'mode.pages.' . $page_id . '.horizontal_menu.show_on_pages', 'The horizontal host page reference is undefined: ' . $host_page_id . '.' );
				}
			}
		}
	}

	/**
	 * Validate a route object.
	 *
	 * @param string $path  Diagnostic path.
	 * @param mixed  $route Raw route.
	 *
	 * @return array<string,string> Normalized route.
	 */
	private function validate_route( $path, $route ) {
		$normalized = array( 'page' => '', 'tab' => '', 'subtab' => '' );

		if ( ! is_array( $route ) ) {
			$this->add_error( $path, 'A route must be an array.' );
			return $normalized;
		}

		$this->validate_exact_keys( $path, $route, array( 'page', 'tab', 'subtab' ), array( 'page', 'tab' ) );
		$normalized['page'] = $this->validate_identifier( $path . '.page', isset( $route['page'] ) ? $route['page'] : null, false );
		$normalized['tab']  = $this->validate_identifier( $path . '.tab', isset( $route['tab'] ) ? $route['tab'] : null, false );
		if ( array_key_exists( 'subtab', $route ) ) {
			$normalized['subtab'] = $this->validate_identifier( $path . '.subtab', $route['subtab'], true );
		}

		return $normalized;
	}

	/**
	 * Build a stable identity for duplicate placement validation.
	 *
	 * @param array $route Normalized route.
	 *
	 * @return string Collision-safe source route identity.
	 */
	private static function get_route_identity( $route ) {
		return strlen( $route['page'] ) . ':' . $route['page'] . '|'
			. strlen( $route['tab'] ) . ':' . $route['tab'] . '|'
			. strlen( $route['subtab'] ) . ':' . $route['subtab'];
	}

	/**
	 * Validate an exact-edition list.
	 *
	 * @param string $path     Diagnostic path.
	 * @param mixed  $editions Raw edition list.
	 *
	 * @return array<int,string> Normalized editions.
	 */
	private function validate_editions( $path, $editions ) {
		$allowed = array( 'free', 'personal', 'business_small', 'business_medium', 'business_large', 'multiuser' );
		$values  = $this->validate_identifier_list( $path, $editions );

		foreach ( $values as $edition_id ) {
			if ( ! in_array( $edition_id, $allowed, true ) ) {
				$this->add_error( $path, 'The edition identifier is not supported: ' . $edition_id . '.' );
			}
		}

		return $values;
	}

	/**
	 * Validate an ordered list of unique identifiers.
	 *
	 * @param string $path   Diagnostic path.
	 * @param mixed  $values Raw list.
	 *
	 * @return array<int,string> Normalized list.
	 */
	private function validate_identifier_list( $path, $values ) {
		$normalized = array();

		if ( ! is_array( $values ) || ! $this->is_list( $values ) ) {
			$this->add_error( $path, 'The value must be an ordered list.' );
			return $normalized;
		}
		if ( count( $values ) > self::MAX_COLLECTION_ENTRIES ) {
			$this->add_error( $path, 'The list exceeds the supported entry limit.' );
			return $normalized;
		}

		foreach ( $values as $index => $identifier ) {
			$identifier = $this->validate_identifier( $path . '.' . $index, $identifier, false );
			if ( in_array( $identifier, $normalized, true ) ) {
				$this->add_error( $path . '.' . $index, 'Duplicate list values are not allowed.' );
			}
			$normalized[] = $identifier;
		}

		return $normalized;
	}

	/**
	 * Validate an associative map and its budget.
	 *
	 * @param string $path  Diagnostic path.
	 * @param mixed  $value Candidate map.
	 *
	 * @return bool True when the value can be iterated as a bounded map.
	 */
	private function validate_map( $path, $value ) {
		if ( ! is_array( $value ) ) {
			$this->add_error( $path, 'The value must be an array map.' );
			return false;
		}
		if ( count( $value ) > self::MAX_COLLECTION_ENTRIES ) {
			$this->add_error( $path, 'The map exceeds the supported entry limit.' );
			return false;
		}

		return true;
	}

	/**
	 * Validate required and allow-listed array keys.
	 *
	 * @param string $path          Diagnostic path.
	 * @param array  $value         Candidate object-like array.
	 * @param array  $allowed_keys  Allowed string keys.
	 * @param array  $required_keys Required string keys.
	 *
	 * @return void
	 */
	private function validate_exact_keys( $path, $value, $allowed_keys, $required_keys ) {
		foreach ( $required_keys as $required_key ) {
			if ( ! array_key_exists( $required_key, $value ) ) {
				$this->add_error( $path . '.' . $required_key, 'The required field is missing.' );
			}
		}
		foreach ( array_keys( $value ) as $key ) {
			if ( ! is_string( $key ) || ! in_array( $key, $allowed_keys, true ) ) {
				$this->add_error( $path . '.' . ( is_scalar( $key ) ? (string) $key : '?' ), 'The field is not supported.' );
			}
		}
	}

	/**
	 * Validate a declaration identifier without coercion.
	 *
	 * @param string $path        Diagnostic path.
	 * @param mixed  $value       Candidate identifier.
	 * @param bool   $allow_empty Whether an empty identifier is valid.
	 *
	 * @return string Original valid identifier, or an empty string.
	 */
	private function validate_identifier( $path, $value, $allow_empty ) {
		if ( ! is_string( $value ) ) {
			$this->add_error( $path, 'The identifier must be a string.' );
			return '';
		}
		if ( '' === $value && $allow_empty ) {
			return '';
		}
		if ( '' === $value || strlen( $value ) > self::MAX_IDENTIFIER_BYTES || ! preg_match( '/^[a-z0-9][a-z0-9_-]*$/', $value ) ) {
			$this->add_error( $path, 'The identifier is empty, malformed, or too long.' );
			return '';
		}

		return $value;
	}

	/**
	 * Validate declaration display text without changing explicit empty strings.
	 *
	 * @param string $path      Diagnostic path.
	 * @param mixed  $value     Candidate text.
	 * @param int    $max_bytes Maximum byte length.
	 *
	 * @return string Original valid text, or an empty string.
	 */
	private function validate_text( $path, $value, $max_bytes ) {
		if ( ! is_string( $value ) ) {
			$this->add_error( $path, 'The value must be a string.' );
			return '';
		}
		if ( strlen( $value ) > $max_bytes ) {
			$this->add_error( $path, 'The string exceeds the supported byte limit.' );
			return '';
		}

		return $value;
	}

	/**
	 * Validate a strict boolean without truthy coercion.
	 *
	 * @param string $path  Diagnostic path.
	 * @param mixed  $value Candidate boolean.
	 *
	 * @return bool Original boolean, or false after an error.
	 */
	private function validate_boolean( $path, $value ) {
		if ( ! is_bool( $value ) ) {
			$this->add_error( $path, 'The value must be a boolean.' );
			return false;
		}

		return $value;
	}

	/**
	 * Determine whether an array has sequential zero-based integer keys.
	 *
	 * @param array $value Candidate list.
	 *
	 * @return bool True for an ordered list, including an empty list.
	 */
	private function is_list( $value ) {
		return array_keys( $value ) === range( 0, count( $value ) - 1 ) || empty( $value );
	}

	/**
	 * Add one bounded diagnostic with its declaration path.
	 *
	 * @param string $path    Declaration field path.
	 * @param string $message Human-readable failure reason.
	 *
	 * @return void
	 */
	private function add_error( $path, $message ) {
		if ( count( $this->errors ) >= self::MAX_DIAGNOSTICS ) {
			return;
		}

		$this->errors[] = $path . ': ' . $message;
	}
}
