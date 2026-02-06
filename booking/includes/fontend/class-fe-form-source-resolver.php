<?php
/**
 * Front-End Booking Form Source Resolver
 *
 * Decides which engine to use to build the booking form body:
 *  - bfb_db   : load exported shortcodes from booking_form_structures (only when BFB enabled)
 *  - legacy   : use legacy wpdev_bk_personal->get_booking_form()
 *  - simple   : fallback wpbc_simple_form__get_booking_form__as_html()
 *
 * Keeps legacy behavior by default:
 * - If BFB is disabled => never touches DB and returns legacy/simple only.
 *
 * @package Booking Calendar
 * @since   11.0.x
 * @file    ../includes/fontend/class-fe-form-source-resolver.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * MultiUser ownership helper (core-safe; MU add-on hooks via filters).
 *
 * @since 11.0.x
 */
class WPBC_FE_MU {


	public static function get_owner_user_id_for_resource( $resource_id ) {

		$resource_id = (int) $resource_id;

		$user_id = apply_bk_filter( 'get_user_of_this_bk_resource', false, $resource_id );
		if ( $user_id ) {
			return $user_id;
		}

		return 0;
	}


	public static function is_user_super_booking_admin( $user_id ) {

		$user_id = intval( $user_id );

		if ( ( class_exists( 'wpdev_bk_multiuser' ) ) && ( $user_id > 0 ) ) {
			$is_user_super_admin = apply_bk_filter( 'is_user_super_admin', $user_id );
			if ( ! $is_user_super_admin ) {
				return false;
			}
		}

		return true;
	}
}


/**
 * Resolver: decides BFB vs legacy vs simple and returns normalized loader args.
 *
 * @since 11.0.x
 */
class WPBC_FE_Form_Source_Resolver {

	/**
	 * Resolve form source.
	 *
	 * Input keys:
	 *  - resource_id (int)
	 *  - form_slug (string)  // from shortcode form_type
	 *  - form_status (string) // published|preview
	 *  - context (string) // frontend|preview|backend (optional)
	 *  - custom_params (array) // parsed from options parser
	 *  - legacy_instance (wpdev_booking|null) // optional
	 *
	 * Output:
	 *  - engine: 'bfb_db'|'legacy'|'simple'
	 *  - apply_after_load_filter: bool
	 *  - bfb_loader_args: array
	 *  - fallback_chain: array
	 *
	 * @param array $req
	 *
	 * @return array
	 */
	public static function resolve( $req ) {

		$req = is_array( $req ) ? $req : array();

		$resource_id     = isset( $req['resource_id'] ) ? (int) $req['resource_id'] : 0;
		$form_slug_raw   = isset( $req['form_slug'] ) ? (string) $req['form_slug'] : '';
		$form_status_raw = isset( $req['form_status'] ) ? (string) $req['form_status'] : '';
		$context         = isset( $req['context'] ) ? sanitize_key( (string) $req['context'] ) : 'frontend';
		$custom_params   = ( isset( $req['custom_params'] ) && is_array( $req['custom_params'] ) ) ? $req['custom_params'] : array();

		$legacy_instance = isset( $req['legacy_instance'] ) ? $req['legacy_instance'] : null;

		// ---------------------------------------------------------------------
		// Step A: determine slug + status (contract).
		// ---------------------------------------------------------------------
		$form_slug = sanitize_key( $form_slug_raw );
		if ( '' === $form_slug ) {
			$form_slug = 'standard';
		}

		$status = sanitize_key( $form_status_raw );

		// Backward compat: if no explicit status but options/context says preview.
		if ( '' === $status ) {
			if ( ( ! empty( $custom_params['context'] ) ) && ( 'preview' === sanitize_key( (string) $custom_params['context'] ) ) ) {
				$status = 'preview';
			}
		}
		if ( '' === $status && 'preview' === $context ) {
			$status = 'preview';
		}

		// Normalize synonyms.
		if ( in_array( $status, array( 'publish', 'published' ), true ) ) {
			$status = 'published';
		}
		if ( 'preview' !== $status ) {
			$status = 'published';
		}

		// ---------------------------------------------------------------------
		// If BFB is NOT enabled => legacy only (no DB touches).
		// ---------------------------------------------------------------------
		if ( ! class_exists( 'WPBC_Frontend_Settings' ) || ! WPBC_Frontend_Settings::is_bfb_enabled( null ) ) {
			return self::fallback_to_legacy_or_simple( $legacy_instance );
		}

		// If BFB runtime is not present => legacy only.
		if ( ! function_exists( 'wpbc_bfb_get_booking_form_source' ) ) {
			return self::fallback_to_legacy_or_simple( $legacy_instance );
		}

		// If storage is not available => legacy only.
		if ( ! class_exists( 'WPBC_BFB_Form_Storage' ) || ! method_exists( 'WPBC_BFB_Form_Storage', 'get_form_row_by_key' ) ) {
			return self::fallback_to_legacy_or_simple( $legacy_instance );
		}

		// Optional: if table does not exist, skip DB.
		if ( function_exists( 'wpbc_is_table_exists' ) && ! wpbc_is_table_exists( 'booking_form_structures' ) ) {
			return self::fallback_to_legacy_or_simple( $legacy_instance );
		}

		// ---------------------------------------------------------------------
		// Step B: determine owner_user_id (MultiUser, filterable).
		// ---------------------------------------------------------------------
		$owner_user_id = 0;

		// Caller may explicitly pass owner_user_id for future scopes.
		if ( isset( $req['owner_user_id'] ) ) {
			$owner_user_id = max( 0, (int) $req['owner_user_id'] );
		} else {
			$owner_user_id = WPBC_FE_MU::get_owner_user_id_for_resource( $resource_id );
			$is_super_user = WPBC_FE_MU::is_user_super_booking_admin( $owner_user_id );

			// If owner_user_id is is_super_user booking admin => treat as global (0).
			if ( $is_super_user ) {
				$owner_user_id = 0;
			} else {
				$owner_user_id = max( 0, (int) $owner_user_id );
			}
		}


		// ---------------------------------------------------------------------
		// Step C: query order (owner_user_id -> global -> standard fallback).
		// Resolver decides the final key to ask the loader for.
		// ---------------------------------------------------------------------
		$fallback_chain = array();

		$allow_standard_fallback = (bool) apply_filters(
			'wpbc_fe_resolver_allow_fallback_to_standard',
			true,
			$form_slug,
			$status,
			$owner_user_id,
			$req
		);

		// Try: (slug,status,owner_user_id) then (slug,status,global)
		$found = self::try_find_row( $form_slug, $status, $owner_user_id, $fallback_chain );
		if ( ! $found && ( $owner_user_id > 0 ) ) {
			$found = self::try_find_row( $form_slug, $status, 0, $fallback_chain );
		}

		// If missing and slug != standard => try standard (same status).
		if ( ! $found && $allow_standard_fallback && ( 'standard' !== $form_slug ) ) {

			$found = self::try_find_row( 'standard', $status, $owner_user_id, $fallback_chain );
			if ( ! $found && ( $owner_user_id > 0 ) ) {
				$found = self::try_find_row( 'standard', $status, 0, $fallback_chain );
			}
		}

		if ( $found ) {

			// Build args for BFB loader.
			$bfb_args = array(
				'form_slug'      => (string) $found['form_slug'],
				'status'         => (string) $found['status'],
				'owner_user_id'  => (int) $found['owner_user_id'],
				'resource_id'    => (int) $resource_id,
				'context'        => (string) $context,
			);

			// Pass form_id if known (fast, deterministic).
			if ( ! empty( $found['form_id'] ) ) {
				$bfb_args['form_id'] = (int) $found['form_id'];
			}

			$result = array(
				'engine'                 => 'bfb_db',
				'apply_after_load_filter'=> true,
				'bfb_loader_args'        => $bfb_args,
				'fallback_chain'         => $fallback_chain,
			);

			/**
			 * Final override point (future scopes, preview rules, etc).
			 *
			 * @param array $result
			 * @param array $req
			 */
			return (array) apply_filters( 'wpbc_fe_form_source_resolution', $result, $req );
		}

		// Not found in DB => legacy fallback (existing behavior).
		return self::fallback_to_legacy_or_simple( $legacy_instance );
	}

	// ---------------------------------------------------------------------
	// Internals
	// ---------------------------------------------------------------------

	/**
	 * Try find DB row for (slug,status,owner) and record attempt in chain.
	 *
	 * @param string $slug
	 * @param string $status
	 * @param int    $owner_user_id
	 * @param array  $chain (by ref)
	 *
	 * @return array|false
	 */
	private static function try_find_row( $slug, $status, $owner_user_id, &$chain ) {

		$slug          = sanitize_key( (string) $slug );
		$status        = sanitize_key( (string) $status );
		$owner_user_id = max( 0, (int) $owner_user_id );

		$chain[] = array(
			'form_slug'     => $slug,
			'status'        => $status,
			'owner_user_id' => $owner_user_id,
		);

		$row = WPBC_BFB_Form_Storage::get_form_row_by_key( $slug, $status, $owner_user_id );

		if ( ! $row || empty( $row->booking_form_id ) ) {
			return false;
		}

		return array(
			'form_id'       => (int) $row->booking_form_id,
			'form_slug'     => $slug,
			'status'        => $status,
			'owner_user_id' => isset( $row->owner_user_id ) ? max( 0, (int) $row->owner_user_id ) : $owner_user_id,
		);
	}

	/**
	 * Legacy/simple fallback result.
	 *
	 * @param mixed $legacy_instance
	 *
	 * @return array
	 */
	private static function fallback_to_legacy_or_simple( $legacy_instance ) {

		if ( ( ! empty( $legacy_instance ) ) && ( false !== $legacy_instance->wpdev_bk_personal ) && ( 'On' != get_bk_option( 'booking_is_use_simple_booking_form' ) ) ) {
			return array(
				'engine'                  => 'legacy',
				'apply_after_load_filter' => false,
				'bfb_loader_args'         => array(),
				'fallback_chain'          => array(),
			);
		}

		return array(
			'engine'                  => 'simple',
			'apply_after_load_filter' => true,
			'bfb_loader_args'         => array(),
			'fallback_chain'          => array(),
		);
	}
}
