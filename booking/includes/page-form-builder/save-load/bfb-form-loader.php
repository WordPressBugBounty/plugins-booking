<?php
/**
 * Booking Form Loader (Builder + Legacy fallback).
 *
 * This helper:
 *  - Accepts a logical form identifier (form_slug) + status (and optional form_id).
 *  - Asks the Booking Form Builder (BFB) for exported form/content.
 *  - If Builder returns nothing, falls back to legacy:
 *      * booking_form / booking_form_show options.
 *      * booking_forms_extended (custom forms).
 *      * simple visual form export (booking_form_visual).
 *
 * It only returns the **source strings** (shortcodes):
 *  - "booking form" (form) – the main form shortcodes.
 *  - "Content of booking fields data" (content) – email/content template.
 *
 * Rendering/parsing of shortcodes stays in:
 *  - WPBC_BFB _FormShortcodeEngine (new engine), or
 *  - the legacy HTML generators (simple form free).
 *
 * @package Booking Calendar
 * @subpackage Form Builder
 * @file includes/page-form-builder/save-load/bfb-form-loader.php
 *
 * @since 11.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Basically  it is wrapper to call this function:   wpbc_bfb__load_from_bfb_table()   for loading data from  DB
 */

/**
 * Central helper for resolving which booking form configuration
 * should be used on the front-end (Builder vs legacy).
 */
class WPBC_BFB_Form_Loader {

	/**
	 * Singleton instance.
	 *
	 * @var WPBC_BFB_Form_Loader|null
	 */
	protected static $instance = null;

	/**
	 * Protect direct construction – use get_instance().
	 */
	protected function __construct() {}

	/**
	 * Prevent cloning.
	 */
	protected function __clone() {}

	/**
	 * Prevent unserializing.
	 */
	public function __wakeup() { // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		_doing_it_wrong( __METHOD__, 'Unserializing WPBC_BFB_Form_Loader is not allowed.', '11.0.0' );
	}

	/**
	 * Get singleton instance.
	 *
	 * @return WPBC_BFB_Form_Loader
	 */
	public static function get_instance() {

		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Get booking form (shortcodes string) by form slug / ID.
	 *
	 * This returns the main "Booking form" configuration in shortcodes format.
	 * It does NOT parse shortcodes, only returns the source string.
	 *
	 * @param array $args {
	 *     Optional. Arguments for resolving the form.
	 *
	 *     @type string $form_slug       Logical form identifier. Examples:
	 *                                   'standard', 'appointments-services-1'.
	 *                                   Empty string or 'auto' means: resolve using
	 *                                   legacy default custom form for $resource_id.
	 *     @type int    $form_id         Optional. Numeric ID of the Builder form
	 *                                   (booking_form_id in booking_form_structures).
	 *                                   If provided, Builder may prefer it over form_slug.
	 *     @type string $status          Desired Builder status. Examples:
	 *                                   'published', 'preview', 'draft', 'archived'.
	 *                                   Legacy fallback ignores it.
	 *     @type string $bfb_form_status Optional alias for $status used in shortcodes,
	 *                                   e.g. bfb_form_status="preview".
	 *     @type int    $resource_id    Booking resource ID. Used when resolving the
	 *                                   default custom form in legacy code.
	 *     @type int    $user_id         Optional user ID. Mostly for MultiUser; legacy
	 *                                   get_bk_option() already respects the current user.
	 * }
	 *
	 * @return string Booking form in shortcodes format.
	 */
	public static function get_form( $args = array() ) {

		return self::get_instance()->get_value_internal( 'form', $args );
	}

	/**
	 * Get "Content of booking fields data" template (shortcodes string)
	 * by form slug / ID.
	 *
	 * @param array $args See WPBC_BFB_Form_Loader::get_form().
	 *
	 * @return string Content template in shortcodes format.
	 */
	public static function get_content( $args = array() ) {

		return self::get_instance()->get_value_internal( 'content', $args );
	}

	/**
	 * Get both booking form and content template at once.
	 *
	 * @param array $args See WPBC_BFB_Form_Loader::get_form().
	 *
	 * @return array {
	 *     @type string $form      Booking form in shortcodes format.
	 *     @type string $content   "Content of booking fields data" in shortcodes format.
	 *     @type string $source    'builder' or 'legacy'.
	 *     @type string $form_slug Resolved form slug that was actually used.
	 * }
	 */
	public static function get_pair( $args = array() ) {

		return self::get_instance()->get_pair_internal( $args );
	}

	/**
	 * Internal router for single value.
	 *
	 * @param string $what 'form' or 'content'.
	 * @param array  $args Arguments.
	 *
	 * @return string
	 */
	protected function get_value_internal( $what, $args ) {

		$pair = $this->get_pair_internal( $args );

		if ( 'content' === $what ) {
			return isset( $pair['content'] ) ? $pair['content'] : '';
		}

		return isset( $pair['form'] ) ? $pair['form'] : '';
	}

	/**
	 * Internal logic for resolving Builder vs legacy form.
	 *
	 * @param array $args Arguments.
	 *
	 * @return array See self::get_pair().
	 */
	protected function get_pair_internal( $args ) {

		$defaults = array(
			'form_slug'       => '',
			'form_id'         => 0,
			'status'          => 'published',
			'bfb_form_status' => '',
			'resource_id'     => 0,
			'user_id'         => 0,
		);

		$args = wp_parse_args( $args, $defaults );

		// Normalize types.
		$args['form_id']     = isset( $args['form_id'] ) ? intval( $args['form_id'] ) : 0;
		$args['resource_id'] = isset( $args['resource_id'] ) ? intval( $args['resource_id'] ) : 0;
		$args['user_id']     = isset( $args['user_id'] ) ? intval( $args['user_id'] ) : 0;

		// Map BFB alias into status if provided (e.g. bfb_form_status="preview").
		if ( ! empty( $args['bfb_form_status'] ) ) {
			$args['status'] = $args['bfb_form_status'];
		}
		unset( $args['bfb_form_status'] );

		// Normalize status to a known set where possible (DB uses e.g. active/preview).
		$args['status'] = $this->normalize_status( $args['status'] );

		/**
		 * Filter the raw arguments before any resolution.
		 *
		 * Can be used to:
		 *  - Map resource_id -> default form_slug.
		 *  - Inject MultiUser scopes.
		 *
		 * @param array $args Arguments passed to the loader.
		 */
		$args = apply_filters( 'wpbc_bfb_form_loader_args', $args );

		// Resolve empty / "auto" slug into concrete value using existing legacy logic.
		$resolved_slug     = $this->resolve_form_slug( $args );
		$args['form_slug'] = $resolved_slug;

		// ---------------------------------------------------------------------
		// 1. Try to load from Builder table via filter.
		// ---------------------------------------------------------------------
		$builder_pair = $this->maybe_load_from_builder( $args );

		if ( is_array( $builder_pair ) ) {
			$builder_form          = isset( $builder_pair['form'] ) ? $builder_pair['form'] : '';
			$builder_content       = isset( $builder_pair['content'] ) ? $builder_pair['content'] : '';
			$builder_settings_json = isset( $builder_pair['settings_json'] ) ? (string) $builder_pair['settings_json'] : '';

			if ( ( '' !== trim( $builder_form ) ) || ( '' !== trim( $builder_content ) ) ) {
				return array(
					'form'          => $builder_form,
					'content'       => $builder_content,
					'settings_json' => $builder_settings_json,
					'source'        => 'builder',
					'form_slug'     => $resolved_slug,
				);
			}
		}


		// ---------------------------------------------------------------------
		// 2. Fallback to legacy storage (options / usermeta).
		// ---------------------------------------------------------------------
		$legacy_pair = $this->load_from_legacy( $args );

		return array(
			'form'          => isset( $legacy_pair['form'] ) ? $legacy_pair['form'] : '',
			'content'       => isset( $legacy_pair['content'] ) ? $legacy_pair['content'] : '',
			'settings_json' => '', // legacy has no per-form settings_json yet.
			'source'        => 'legacy',
			'form_slug'     => $resolved_slug,
		);
	}

	/**
	 * Normalize loader status to match DB semantics.
	 *
	 * Maps generic or legacy-like values (e.g. 'publish') to actual statuses
	 * used in booking_form_structures ('published', 'preview', 'draft', 'archived').
	 *
	 * @param string $status  Raw status.
	 *
	 * @return string Normalized status.
	 */
	protected function normalize_status( $status ) {

		$status = strtolower( trim( (string) $status ) );

		if ( '' === $status ) {
			$status = 'published';
		}

		// Map some common aliases.
		if ( in_array( $status, array( 'publish', 'published' ), true ) ) {
			$status = 'published';
		}

		return $status;
	}

	/**
	 * Resolve empty or special slugs into real legacy form names.
	 *
	 * Examples:
	 *  - '' or 'auto'  => current default custom form for $resource_id (or 'standard').
	 *  - 'standard'    => keep as is.
	 *
	 * @param array $args Loader arguments.
	 *
	 * @return string Resolved form slug.
	 */
	protected function resolve_form_slug( $args ) {

		$slug = isset( $args['form_slug'] ) ? trim( (string) $args['form_slug'] ) : '';

		if ( '' !== $slug && 'auto' !== $slug ) {
			return $slug;
		}

		$resource_id = isset( $args['resource_id'] ) ? intval( $args['resource_id'] ) : 0;

		// Existing logic for resolving default custom form for specific resource.
		if ( $resource_id > 0 ) {
			$default_slug = apply_bk_filter( 'wpbc_get_default_custom_form', 'standard', $resource_id );
		} else {
			$default_slug = 'standard';
		}

		if ( empty( $default_slug ) ) {
			$default_slug = 'standard';
		}

		return $default_slug;
	}

	/**
	 * Try to get form + content from the new Builder storage.
	 *
	 * The actual lookup is delegated to a filter so that this class
	 * does not depend on any concrete BFB DB schema.
	 *
	 * If Builder is disabled, the table is missing or the requested slug/ID
	 * does not exist, the filter should return the $empty value.
	 *
	 * @param array $args Loader arguments.
	 *
	 * @return array {
	 *     @type string $form    Optional. Booking form in shortcodes format.
	 *     @type string $content Optional. Content of booking fields data in shortcodes format.
	 * }
	 */
	protected function maybe_load_from_builder( $args ) {

		$empty = array(
			'form'          => '',
			'content'       => '',
			'settings_json' => '',
		);

		/**
		 * Allows the Booking Form Builder module to provide form/content strings.
		 *
		 * Typical implementation in BFB (pseudo-code):
		 *
		 *  function my_bfb_loader( $empty, $args ) {
		 *      // 1) Verify Builder is active and table exists.
		 *      // 2) If $args['form_id'] > 0:
		 *      //        SELECT row FROM {$wpdb->prefix}booking_form_structures
		 *      //          WHERE booking_form_id = $args['form_id']
		 *      //            AND status          = $args['status'];
		 *      //    else:
		 *      //        SELECT row FROM {$wpdb->prefix}booking_form_structures
		 *      //          WHERE form_slug = $args['form_slug']
		 *      //            AND status    = $args['status'];
		 *      // 3) If found, return array(
		 *      //        'form'    => $row->advanced_form,
		 *      //        'content' => $row->content_form,
		 *      //    );
		 *      // 4) On any error or no row found, return $empty.
		 *  }
		 *
		 * @param array $empty Default empty value.
		 * @param array $args  Loader arguments (form_slug, form_id, status, resource_id, user_id).
		 */
		$pair = apply_filters( 'wpbc_bfb_form_loader_from_builder', $empty, $args );

		if ( ! is_array( $pair ) ) {
			return $empty;
		}

		// Normalize to have both keys.
		$pair = wp_parse_args(
			$pair,
			array(
				'form'          => '',
				'content'       => '',
				'settings_json' => '',
			)
		);

		return $pair;
	}

	/**
	 * Fallback loader that reads forms from legacy options (and MultiUser usermeta).
	 *
	 * It reuses the same mechanisms as your current code:
	 *  - Default form:
	 *      * booking_form / booking_form_show options.
	 *  - Custom forms:
	 *      * booking_forms_extended via:
	 *          - apply_bk_filter( 'wpdev_get_booking_form', ... )
	 *          - wpbc_get_custom_booking_form() for content.
	 *  - Simple mode:
	 *      * wpbc_simple_form__get_booking_form__as_shortcodes().
	 *      * wpbc_simple_form__get_form_show__as_shortcodes().
	 *
	 * @param array $args Loader arguments.
	 *
	 * @return array {
	 *     @type string $form    Booking form (shortcodes).
	 *     @type string $content Content of booking fields data (shortcodes).
	 * }
	 */
	protected function load_from_legacy( $args ) {

		$form_slug = isset( $args['form_slug'] ) ? (string) $args['form_slug'] : 'standard';

		// -----------------------------------------------------------------
		// 1. Advanced booking form (shortcodes).
		// -----------------------------------------------------------------
		$default_form = get_bk_option( 'booking_form' );
		$form         = '';

		if ( 'standard' === $form_slug || '' === $form_slug ) {

			// Default standard form.
			$form = $default_form;

		} else {

			// Custom form via existing filter that reads booking_forms_extended.
			$form = apply_bk_filter( 'wpdev_get_booking_form', $default_form, $form_slug );
		}

		// If still empty, build advanced form from Simple mode visual structure.
		if ( ( '' === trim( $form ) ) && function_exists( 'wpbc_simple_form__get_booking_form__as_shortcodes' ) ) {
			$form = wpbc_simple_form__get_booking_form__as_shortcodes();
		}

		// -----------------------------------------------------------------
		// 2. "Content of booking fields data" (shortcodes).
		// -----------------------------------------------------------------
		$default_content = get_bk_option( 'booking_form_show' );
		$content         = '';

		if ( 'standard' === $form_slug || '' === $form_slug ) {

			// Default standard content.
			$content = $default_content;

		} else {

			// Custom content via helper that reads booking_forms_extended[name]['content'].
			if ( function_exists( 'wpbc_get_custom_booking_form' ) ) {
				$content = wpbc_get_custom_booking_form(
					$default_content,
					$form_slug,
					false,        // Let helper call get_bk_option( 'booking_forms_extended' ) internally.
					'content',
					true          // Replace simple HTML shortcodes <r>, <c>, <f>, <l>, <item>.
				);
			}
		}

		// If still empty, build content from Simple mode visual structure.
		if ( ( '' === trim( $content ) ) && function_exists( 'wpbc_simple_form__get_form_show__as_shortcodes' ) ) {
			$content = wpbc_simple_form__get_form_show__as_shortcodes();
		}

		/**
		 * Final filter over legacy values before returning.
		 *
		 * @param array $pair {
		 *     @type string $form    Booking form (shortcodes).
		 *     @type string $content Content of booking fields data (shortcodes).
		 * }
		 * @param array $args Loader arguments.
		 */
		$pair = apply_filters(
			'wpbc_bfb_form_loader_legacy',
			array(
				'form'    => $form,
				'content' => $content,
			),
			$args
		);

		// Ensure expected shape.
		$pair = wp_parse_args(
			$pair,
			array(
				'form'    => '',
				'content' => '',
			)
		);

		return $pair;
	}
}




/**
 * Wrapper: get booking form (shortcodes) by slug/status.
 *
 * This is a convenience function for use in templates or older code.
 *
 * @param array $args See WPBC_BFB_Form_Loader::get_form().
 *
 * @return string
 */
function wpbc_bfb_get_booking_form_source( $args = array() ) {

	return WPBC_BFB_Form_Loader::get_form( $args );
}

/**
 * Wrapper: get "Content of booking fields data" (shortcodes) by slug/status.
 *
 * @param array $args See WPBC_BFB_Form_Loader::get_form().
 *
 * @return string
 */
function wpbc_bfb_get_booking_content_source( $args = array() ) {

	return WPBC_BFB_Form_Loader::get_content( $args );
}

/**
 * Wrapper: get both booking form and content template at once.
 *
 * @param array $args See WPBC_BFB_Form_Loader::get_form().
 *
 * @return array See WPBC_BFB_Form_Loader::get_pair().
 */
function wpbc_bfb_get_booking_form_pair( $args = array() ) {

	return WPBC_BFB_Form_Loader::get_pair( $args );
}
