<?php
/**
 * Deferred translation for Booking Modes V3 declarations.
 *
 * @package Booking Calendar
 * @since   11.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Translate declaration display strings only after WordPress initializes.
 *
 * V3 declarations are validated during the early fail-closed preflight. Keeping
 * their source values translation-neutral prevents just-in-time text-domain
 * loading before `init`, while this class restores normal translated labels for
 * every presentation consumer later in the request.
 */
final class WPBC_Booking_Modes_V3_Definition_Translator {

	/**
	 * Translate every display string in one validated declaration.
	 *
	 * The declaration is returned unchanged before `init` and in isolated CLI
	 * checks where the WordPress action API is unavailable.
	 *
	 * @param array $definition Validated translation-neutral declaration.
	 *
	 * @return array Declaration with translated display strings when safe.
	 */
	public static function translate( $definition ) {
		if ( ! self::is_translation_ready() || ! is_array( $definition ) ) {
			return $definition;
		}

		foreach ( array( 'label', 'description' ) as $mode_text_key ) {
			if ( isset( $definition[ $mode_text_key ] ) && is_string( $definition[ $mode_text_key ] ) ) {
				$definition[ $mode_text_key ] = translate( $definition[ $mode_text_key ], 'booking' );
			}
		}

		foreach ( $definition['pages'] as $page_id => $page_definition ) {
			if ( isset( $page_definition['page_options'] ) ) {
				$definition['pages'][ $page_id ]['page_options'] = self::translate_keys(
					$page_definition['page_options'],
					array( 'page_title', 'page_description', 'top_path_title' )
				);
			}
			if ( isset( $page_definition['horizontal_menu'] ) ) {
				$definition['pages'][ $page_id ]['horizontal_menu'] = self::translate_keys(
					$page_definition['horizontal_menu'],
					array( 'title' )
				);
			}
		}

		foreach ( $definition['wordpress_menu'] as $menu_slug => $menu_definition ) {
			$definition['wordpress_menu'][ $menu_slug ] = self::translate_keys( $menu_definition, array( 'title' ) );
		}

		$definition['sidebar_menu'] = self::translate_sidebar_nodes( $definition['sidebar_menu'] );

		return $definition;
	}

	/**
	 * Determine whether calling the Booking Calendar text domain is safe.
	 *
	 * @return bool True at or after the WordPress `init` action.
	 */
	public static function is_translation_ready() {
		return function_exists( 'did_action' ) && 0 < did_action( 'init' );
	}

	/**
	 * Translate an allow-listed set of display keys.
	 *
	 * @param array $record    Validated declaration record.
	 * @param array $text_keys Display keys to translate.
	 *
	 * @return array Updated record.
	 */
	private static function translate_keys( $record, $text_keys ) {
		foreach ( $text_keys as $text_key ) {
			if ( array_key_exists( $text_key, $record ) && is_string( $record[ $text_key ] ) ) {
				$record[ $text_key ] = translate( $record[ $text_key ], 'booking' );
			}
		}

		return $record;
	}

	/**
	 * Translate recursive sidebar labels without translating identifiers/icons.
	 *
	 * @param array $nodes Validated sidebar node map.
	 *
	 * @return array Translated sidebar node map.
	 */
	private static function translate_sidebar_nodes( $nodes ) {
		foreach ( $nodes as $node_key => $node ) {
			$node = self::translate_keys( $node, array( 'title' ) );
			if ( isset( $node['items'] ) && is_array( $node['items'] ) ) {
				$node['items'] = self::translate_sidebar_nodes( $node['items'] );
			}
			$nodes[ $node_key ] = $node;
		}

		return $nodes;
	}
}
