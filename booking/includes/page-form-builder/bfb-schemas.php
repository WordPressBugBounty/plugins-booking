<?php
/**
 * Hybrid++ Schemas utilities: normalize/validate/merge/extract.
 *
 * @package     Booking Calendar.
 * @author      wpdevelop, oplugins
 * @web-site    https://wpbookingcalendar.com/
 * @email       info@wpbookingcalendar.com
 *
 * @since       11.0.0
 * @modified    2025-08-29
 * @version     1.0
 */

// ---------------------------------------------------------------------------------------------------------------------
// == File  bfb-schemas.php == Time point: 2025-08-29 12:25
// ---------------------------------------------------------------------------------------------------------------------
if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Utilities for working with field/section/component packs.
 */
class WPBC_BFB_Schemas_Util {

	/**
	 * Normalize a single pack to a safe, known shape.
	 *
	 * @param array $pack Raw pack from a filter callback.
	 *
	 * @return array Normalized pack.
	 */
	public static function normalize_pack( $pack ) {
		$pack = is_array( $pack ) ? $pack : array();

		$pack['kind']   = isset( $pack['kind'] ) ? sanitize_key( $pack['kind'] ) : 'field';
		$pack['type']   = isset( $pack['type'] ) ? sanitize_key( $pack['type'] ) : '';
		$pack['schema'] = ( isset( $pack['schema'] ) && is_array( $pack['schema'] ) ) ? $pack['schema'] : array();
		if ( ! isset( $pack['schema']['props'] ) || ! is_array( $pack['schema']['props'] ) ) {
			$pack['schema']['props'] = array();
		}

		$pack['inspector_ui'] = ( isset( $pack['inspector_ui'] ) && is_array( $pack['inspector_ui'] ) ) ? $pack['inspector_ui'] : array();

		if ( ! isset( $pack['inspector_ui']['groups'] ) || ! is_array( $pack['inspector_ui']['groups'] ) ) {
			$pack['inspector_ui']['groups'] = array();
		}

		$pack['header_actions'] = ( isset( $pack['header_actions'] ) && is_array( $pack['header_actions'] ) ) ? array_values( $pack['header_actions'] ) : array();

		$pack['templates_printer'] = ( isset( $pack['templates_printer'] ) && is_callable( $pack['templates_printer'] ) ) ? $pack['templates_printer'] : null;

		return $pack;
	}

	/**
	 * Basic validation: keep only supported prop/control types and JSON-serializable data.
	 *
	 * @param array $pack Normalized pack.
	 *
	 * @return array Validated pack (unsafe bits removed).
	 */
	public static function validate_pack( $pack ) {

		// Allow extra prop/control types used by the Inspector Factory.
		$allowed_prop_types = array( 'string', 'number', 'boolean', 'array', 'int', 'float', 'enum', 'color' );
		// Expanded to support Factory extras and color control.
		$allowed_control_types = array( 'text', 'number', 'checkbox', 'textarea', 'select', 'range_number', 'len', 'color' );

		// Validate prop meta.
		foreach ( $pack['schema']['props'] as $prop_key => $meta ) {

			if ( ! is_array( $meta ) ) {
				unset( $pack['schema']['props'][ $prop_key ] );
				continue;
			}
			$meta['type'] = isset( $meta['type'] ) ? $meta['type'] : 'string';
			if ( ! in_array( $meta['type'], $allowed_prop_types, true ) ) {
				unset( $pack['schema']['props'][ $prop_key ] );
				continue;
			}
			// Drop non-serializable values.
			foreach ( $meta as $k => $v ) {
				if ( is_object( $v ) && ! ( $v instanceof JsonSerializable ) ) {
					unset( $meta[ $k ] );
				}
			}
			$pack['schema']['props'][ $prop_key ] = $meta;
		}

		// Validate inspector groups/controls.
		if ( ! empty( $pack['inspector_ui']['groups'] ) ) {
			foreach ( $pack['inspector_ui']['groups'] as $g_i => $group ) {
				if ( ! is_array( $group ) ) {
					unset( $pack['inspector_ui']['groups'][ $g_i ] );
					continue;
				}
				$group['controls'] = ( isset( $group['controls'] ) && is_array( $group['controls'] ) ) ? $group['controls'] : array();

				foreach ( $group['controls'] as $c_i => $control ) {
					if ( ! is_array( $control ) ) {
						unset( $group['controls'][ $c_i ] );
						continue;
					}
					if ( empty( $control['key'] ) || empty( $control['type'] ) || ! in_array( $control['type'], $allowed_control_types, true ) ) {
						unset( $group['controls'][ $c_i ] );
						continue;
					}
					// Remove objects in control meta.
					foreach ( $control as $k => $v ) {
						if ( is_object( $v ) && ! ( $v instanceof JsonSerializable ) ) {
							unset( $control[ $k ] );
						}
					}
					$group['controls'][ $c_i ] = $control;
				}
				$pack['inspector_ui']['groups'][ $g_i ] = $group;
			}
		}

		// Sanitize header action keys.
		if ( ! empty( $pack['header_actions'] ) ) {
			$san = array();
			foreach ( $pack['header_actions'] as $act ) {
				$san[] = sanitize_key( $act );
			}
			$pack['header_actions'] = array_values( array_unique( $san ) );
		}

		return $pack;
	}

	/**
	 * Merge a list of packs keyed by type. Later packs win on conflicts.
	 *
	 * @param array $packs Packs list.
	 *
	 * @return array Merged packs keyed by type.
	 */
	public static function merge_packs( $packs ) {
		$merged = array();
		foreach ( (array) $packs as $pack ) {
			$pack = self::normalize_pack( $pack );
			$pack = self::validate_pack( $pack );
			if ( empty( $pack['type'] ) ) {
				continue;
			}
			$merged[ $pack['type'] ] = $pack; // last writer wins.
		}

		return $merged;
	}

	/**
	 * Extract only the JS-safe schema bits for localization.
	 *
	 * @param array $packs_by_type Merged packs keyed by type.
	 *
	 * @return array Array keyed by type for JS (small payload).
	 */
	public static function extract_schemas_for_js( $packs_by_type ) {
		$out = array();
		foreach ( (array) $packs_by_type as $type => $pack ) {
			$out[ $type ] = array(
				'kind'           => isset( $pack['kind'] ) ? $pack['kind'] : 'field',
				'schema'         => isset( $pack['schema'] ) ? $pack['schema'] : array( 'props' => array() ),
				'inspector_ui'   => isset( $pack['inspector_ui'] ) ? $pack['inspector_ui'] : array( 'groups' => array() ),
				'header_actions' => isset( $pack['header_actions'] ) ? array_values( $pack['header_actions'] ) : array(),
			);
		}

		return $out;
	}
}
