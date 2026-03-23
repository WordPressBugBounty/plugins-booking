<?php
/**
 * AJAX controller for Booking Form Builder (BFB) FormConfig.
 *
 * Responsibilities:
 * - Save Builder structure (+ exported shortcodes) into booking_form_structures table.
 * - Load FormConfig (DB first, legacy options fallback) for the Builder UI.
 *
 * This file exposes AJAX endpoints:
 * - WPBC_AJX_BFB_SAVE_FORM_CONFIG   -> wpbc_bfb_ajax_save_form_config()
 * - WPBC_AJX_BFB_LOAD_FORM_CONFIG   -> wpbc_bfb_ajax_load_form_config()
 * - WPBC_AJX_BFB_CREATE_FORM_CONFIG -> wpbc_bfb_ajax_create_form_config()
 * - WPBC_AJX_BFB_LIST_FORMS         -> wpbc_bfb_ajax_list_forms()
 * - WPBC_AJX_BFB_DELETE_FORM_CONFIG -> wpbc_bfb_ajax_delete_form_config()
 * - WPBC_AJX_BFB_DELETE_TEMPLATE_CONFIG -> wpbc_bfb_ajax_delete_template_config()
 *
 * Both endpoints work with the normalized FormConfig structure defined in
 * bfb-form-manager.php.
 *
 * @package     Booking Calendar.
 * @subpackage  Form Builder
 *
 * @since 11.0.0
 * @file        ../includes/page-form-builder/ajax/bfb-ajax.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * OR separator for template search queries (UI + AJAX).
 *
 * Used by wpbc_bfb_ajax_list_forms() to support multi-keyword searches:
 *    "time|duration|slots"
 *
 * NOTE:
 * - This separator is for AJAX search (POST) and UI input.
 * - Do NOT use it in URLs. Some server configs can block "|" in URLs.
 * - For URLs, use WPBC_BFB_TEMPLATE_SEARCH_OR_SEPARATOR_URL (default "^").
 *
 * @since 11.0.0
 */
if ( ! defined( 'WPBC_BFB_TEMPLATE_SEARCH_OR_SEPARATOR' ) ) {
	define( 'WPBC_BFB_TEMPLATE_SEARCH_OR_SEPARATOR', '|' );
}

/**
 * OR separator for template search queries in URLs only.
 *
 * Used for redirects like:
 *   &auto_open_template=service^duration
 *
 * @since 11.0.0
 */
if ( ! defined( 'WPBC_BFB_TEMPLATE_SEARCH_OR_SEPARATOR_URL' ) ) {
	define( 'WPBC_BFB_TEMPLATE_SEARCH_OR_SEPARATOR_URL', '^' );
 }

// == DEBUG ==
if ( ! defined( 'WPBC_BFB_DEBUG__FORM_NAME' ) ) {
//	define( 'WPBC_BFB_DEBUG__FORM_NAME', 'wizard-1' );
}

// == Helpers == =======================================================================================================

/**
 * Get capability required to manage booking forms in the Builder.
 *
 * Resolves to a WordPress capability based on the plugin setting
 * booking_user_role_settings. This keeps Form Builder access aligned with the
 * rest of the Booking Calendar admin UI.
 *
 * Mapping example:
 * - administrator -> activate_plugins
 * - editor        -> publish_pages
 * - author        -> publish_posts
 * - contributor   -> edit_posts
 * - subscriber    -> read
 *
 * If the configured role is not recognized, falls back to manage_options.
 *
 * @since 11.0.0
 *
 * @return string Capability name.
 */
function wpbc_bfb_get_manage_cap() {

	$min_user_role = get_bk_option( 'booking_user_role_settings' );

	$capability = array(
		'administrator' => 'activate_plugins',
		'editor'        => 'publish_pages',
		'author'        => 'publish_posts',
		'contributor'   => 'edit_posts',
		'subscriber'    => 'read',
	);

	if ( isset( $capability[ $min_user_role ] ) ) {
		return $capability[ $min_user_role ];
	}

	// Fallback: admins only.
	return 'manage_options';
}

/**
 * Extend the list of safe inline CSS properties for BFB-generated markup.
 *
 * Callback for the safe_style_css filter. It ensures that BFB-specific inline
 * styles (including CSS custom properties used by the layout engine) pass
 * through wp_kses() sanitization.
 *
 * The base list of allowed properties is provided by core; this function
 * appends additional properties if they are not already present.
 *
 * You can modify the final list via the wpbc_bfb_safe_style_props filter.
 *
 * @since 11.0.0
 *
 * @param string[] $styles Array of allowed CSS properties from core.
 *
 * @return string[] Modified array including BFB-specific properties.
 */
function wpbc_bfb_safe_style_props_filter( $styles ) {

	$extra_css_props = array(
		'display',
		'clear',        // used in wizard hidden_style (optional, but safe)
		'flex-basis',   // IMPORTANT: exported per-column layout width
		// Optional but often useful if you ever output them:
		'flex',
		'flex-grow',
		'flex-shrink',
		'width',
		'min-width',
		'max-width',
		'box-sizing',

		'transform',
		'align-self',
		'--wpbc-bfb-col-dir',
		'--wpbc-bfb-col-wrap',
		'--wpbc-bfb-col-jc',
		'--wpbc-bfb-col-ai',
		'--wpbc-bfb-col-gap',
		'--wpbc-bfb-col-ac',
		'--wpbc-bfb-col-aself',
		'--wpbc-col-min',
	);

	/**
	 * Filter extra safe CSS properties for BFB inline styles.
	 *
	 * @since 11.0.0
	 *
	 * @param string[] $extra_css_props List of extra CSS properties.
	 */
	$extra_css_props = apply_filters( 'wpbc_bfb_safe_style_props', $extra_css_props );

	foreach ( $extra_css_props as $prop ) {
		if ( ! in_array( $prop, $styles, true ) ) {
			$styles[] = $prop;
		}
	}

	return $styles;
}

/**
 * Allow STRICT ONLY: transform: translate(... , ...) with numeric/% values
 *
 * @param $allow
 * @param $css_test_string
 *
 * @return bool|mixed
 */
function wpbc_bfb_allow_transform_translate_only( $allow, $css_test_string ) {
	if ( $allow ) {
		return $allow;
	}

	$css_test_string = trim( (string) $css_test_string );

	// Allow ONLY: transform: translate(... , ...) with numeric/% values. Also allow px (common for translate), still STRICT.
	if ( preg_match( '/^transform\s*:\s*translate(?:3d|x|y)?\(\s*-?\d+(?:\.\d+)?(?:%|px)?\s*,\s*-?\d+(?:\.\d+)?(?:%|px)?\s*(?:,\s*-?\d+(?:\.\d+)?(?:%|px)?\s*)?\)\s*$/i', $css_test_string ) ) {
		return true;
	}

	return false;
}

/**
 * Sanitize advanced/content booking form text coming from the Builder.
 *
 * @since 11.0.0
 *
 * @param string $form_value Raw form markup (may be slashed).
 *
 * @return string Sanitized form markup.
 */
function wpbc_bfb_sanitize_form_text( $form_value ) {

	$form_value = (string) $form_value;

	if ( '' === $form_value ) {
		return '';
	}

	// Make function self-contained for all call-sites.
	$form_value = wp_unslash( $form_value );
	$form_value = wp_kses_no_null( $form_value );

	// Optional but recommended: avoid comment encoding artifacts.
	// Remove this if you must preserve comments in DB exactly as-is.
	$form_value = preg_replace( '/<!--[\s\S]*?-->/', '', $form_value );

	// Start with WP default allowed tags, then extend with our custom tags (custom wins).
	$allowed_tags = array_merge(
		wp_kses_allowed_html( 'post' ),
		wpbc_get_allowed_simple_html_tags__for_wp_kses(),     // Custom short tags used in legacy / advanced markup.
	);

	// Allow 'name' on <p> (if used by legacy markup).
	if ( isset( $allowed_tags['p'] ) ) {
		$allowed_tags['p']['name'] = true;
	}

	// Extra attributes for layout/structure wrappers.
	foreach ( array( 'div', 'span', 'hr' ) as $tag ) {
		if ( ! isset( $allowed_tags[ $tag ] ) ) {
			$allowed_tags[ $tag ] = array();
		}
		$allowed_tags[ $tag ]['data-bfb-type']    = true;
		$allowed_tags[ $tag ]['data-orientation'] = true;
		$allowed_tags[ $tag ]['name']             = true;
		$allowed_tags[ $tag ]['aria-orientation'] = true;
	}

	// Temporarily allow extra inline style properties for BFB.
	add_filter( 'safe_style_css', 'wpbc_bfb_safe_style_props_filter', 10, 1 );

	// Allow ONLY transform: translate*(...) patterns (your strict validator).
	add_filter( 'safecss_filter_attr_allow_css', 'wpbc_bfb_allow_transform_translate_only', 10, 2 );

	$sanitized = wp_kses( $form_value, $allowed_tags );

	remove_filter( 'safecss_filter_attr_allow_css', 'wpbc_bfb_allow_transform_translate_only', 10 );
	remove_filter( 'safe_style_css', 'wpbc_bfb_safe_style_props_filter', 10 );

	return $sanitized;
}

/**
 * Sanitize a form slug/key.
 *
 * Allows: a-z, 0-9, underscore, dash.
 *
 * @param string $raw
 *
 * @return string
 */
function wpbc_bfb__sanitize_form_slug( $raw ) {

	$raw = strtolower( trim( sanitize_text_field( (string) $raw ) ) );

	// Replace spaces with underscore for readability.
	$raw = preg_replace( '/\s+/', '_', $raw );

	// Keep only: a-z 0-9 _ -
	$raw = preg_replace( '/[^a-z0-9_\-]/', '_', $raw );

	// Collapse multiple separators.
	$raw = preg_replace( '/[_\-]{2,}/', '_', $raw );

	// Trim separators.
	$raw = trim( $raw, '_-' );

	return $raw;
}

/**
 * Read form_details from POST (array or JSON string) and sanitize values.
 *
 * Keys:
 * - form_name
 * - title
 * - description
 * - picture_url
 *
 * IMPORTANT: We keep "presence" checks with array_key_exists() in the caller,
 * so UI can intentionally clear values by sending empty string.
 *
 * @param mixed $raw
 *
 * @return array
 */
function wpbc_bfb__normalize_form_details_from_post( $raw ) {

	if ( is_string( $raw ) && '' !== $raw ) {
		$tmp = json_decode( $raw, true );
		if ( is_array( $tmp ) ) {
			$raw = $tmp;
		}
	}

	if ( ! is_array( $raw ) ) {
		return array();
	}

	$out = array();

	if ( array_key_exists( 'form_name', $raw ) ) {
		$out['form_name'] = sanitize_text_field( $raw['form_name'] );
	}

	if ( array_key_exists( 'title', $raw ) ) {
		$out['title'] = sanitize_text_field( (string) $raw['title'] );
	}

	if ( array_key_exists( 'description', $raw ) ) {
		$out['description'] = sanitize_textarea_field( (string) $raw['description'] );
	}

	if ( array_key_exists( 'picture_url', $raw ) ) {
		$out['picture_url'] = esc_url_raw( (string) $raw['picture_url'] );
	}

	return $out;
}

/**
 * Split a search string into OR-terms by configured separator.
 *
 * Example (default "~"):
 * - "time~duration~slots" => array( 'time', 'duration', 'slots' )
 * - " time ~ duration "   => array( 'time', 'duration' )
 *
 * @since 11.0.0
 *
 * @param string $search_raw Raw search string.
 * @param int    $max_terms  Max number of terms allowed (anti-abuse).
 *
 * @return array List of unique, trimmed terms.
 */
function wpbc_bfb__split_search_terms_by_or_separator( $search_raw, $max_terms = 5 ) {

	$search_raw = trim( (string) $search_raw );

	if ( '' === $search_raw ) {
		return array();
	}

	$max_terms = absint( $max_terms );
	if ( $max_terms <= 0 ) {
		$max_terms = 5;
	}


	$sep = ( defined( 'WPBC_BFB_TEMPLATE_SEARCH_OR_SEPARATOR' ) ) ? (string) WPBC_BFB_TEMPLATE_SEARCH_OR_SEPARATOR : '|';
	if ( '' === $sep ) {
		$sep = '|';
	}

	$pattern = '/\s*' . preg_quote( $sep, '/' ) . '\s*/';
	$parts   = preg_split( $pattern, $search_raw );

	if ( ! is_array( $parts ) ) {
		return array();
	}

	$terms = array();

	foreach ( $parts as $p ) {
		$t = trim( (string) $p );
		if ( '' === $t ) {
			continue;
		}
		$terms[] = $t;
		if ( count( $terms ) >= $max_terms ) {
			break;
		}
	}

	$terms = array_values( array_unique( $terms ) );

	return $terms;
}

/**
* Normalize settings into array() and ensure ONLY supported schema exists:
 * {
 *   options     : {},
 *   css_vars    : [],
 *   bfb_options : { advanced_mode_source: 'builder'|'advanced'|'auto' }
 * }
 *
 * @param mixed $settings
 *
 * @return array
 */
function wpbc_bfb__normalize_settings_array( $settings ) {

	if ( is_string( $settings ) && '' !== $settings ) {
		$tmp = json_decode( $settings, true );
		if ( is_array( $tmp ) ) {
			$settings = $tmp;
		}
	}

	if ( ! is_array( $settings ) ) {
		$settings = array();
	}

	if ( empty( $settings['options'] ) || ! is_array( $settings['options'] ) ) {
		$settings['options'] = array();
	}

	if ( empty( $settings['css_vars'] ) || ! is_array( $settings['css_vars'] ) ) {
		$settings['css_vars'] = array();
	}

	if ( empty( $settings['bfb_options'] ) || ! is_array( $settings['bfb_options'] ) ) {
		$settings['bfb_options'] = array();
	}

	$src = isset( $settings['bfb_options']['advanced_mode_source'] ) ? strtolower( trim( (string) $settings['bfb_options']['advanced_mode_source'] ) ) : 'auto';
	if ( ! in_array( $src, array( 'builder', 'advanced', 'auto' ), true ) ) {
		$src = 'auto';
	}
	$settings['bfb_options']['advanced_mode_source'] = $src;

	return $settings;
}

/**
 * Check whether template key means "blank form".
 *
 * @param string $template_form_name
 *
 * @return bool
 */
function wpbc_bfb__is_blank_template_key( $template_form_name ) {

	$template_form_name = (string) $template_form_name;

	return ( '' === $template_form_name || '__blank__' === $template_form_name || 'blank' === $template_form_name );
}

/**
 * Get blank Builder structure seed.
 *
 * @return array
 */
function wpbc_bfb__get_blank_structure_seed() {

	return array(
		array(
			'page'    => 1,
			'content' => array(),
		),
	);
}

/**
 * Resolve BFB form/template picture URL.
 *
 * Rules:
 * - If value is already an absolute URL, return as is.
 * - If value is only a file name, first try local bundled templates image folder:
 *   ../includes/page-form-builder/save-load/../assets/template-img/
 * - If local file does not exist, use external fallback base URL.
 *
 * @param string $picture_url Raw picture_url value from DB.
 *
 * @return string
 */
function wpbc_bfb_resolve_picture_url( $picture_url ) {

	$picture_url = trim( (string) $picture_url );

	if ( '' === $picture_url ) {
		return '';
	}

	// Already absolute URL or protocol-relative URL.
	if (
		( false !== strpos( $picture_url, '://' ) ) ||
		( 0 === strpos( $picture_url, '//' ) )
	) {
		return $picture_url;
	}

	// If path contains directories, treat it as already prepared relative path.
	// This helper is intended mainly for simple file names like "template_appointments_01.png".
	if (
		( false !== strpos( $picture_url, '/' ) ) ||
		( false !== strpos( $picture_url, '\\' ) )
	) {
		return $picture_url;
	}

	$file_name = sanitize_file_name( wp_basename( $picture_url ) );
	if ( '' === $file_name ) {
		return '';
	}

	$local_dir_path = trailingslashit( plugin_dir_path( __FILE__ ) ) . '../assets/template-img/';
	$local_file_path = $local_dir_path . $file_name;

	if ( file_exists( $local_file_path ) ) {
		return trailingslashit( plugin_dir_url( __FILE__ ) ) . '../assets/template-img/' . rawurlencode( $file_name );
	}

	$fallback_base_url = apply_filters( 'wpbc_bfb_template_picture_fallback_base_url', 'https://wpbookingcalendar.com/assets/template-img/' );

	return trailingslashit( $fallback_base_url ) . rawurlencode( $file_name );
}

/**
 * Verify AJAX delete nonce for BFB delete operations.
 *
 * Preferred nonce:
 * - wpbc_bfb_form_delete
 *
 * Backward-compatible fallback:
 * - wpbc_bfb_form_list
 *
 * This fallback allows template deletion from the Apply Template modal
 * even if only nonce_list is localized in older builder pages.
 *
 * @since 11.0.0
 *
 * @return bool
 */
function wpbc_bfb__verify_delete_request_nonce() {

	if ( check_ajax_referer( 'wpbc_bfb_form_delete', 'nonce', false ) ) {
		return true;
	}

	if ( check_ajax_referer( 'wpbc_bfb_form_list', 'nonce', false ) ) {
		return true;
	}

	return false;
}

/**
 * Check whether a listed template can be deleted in the current owner context.
 *
 * Rules:
 * - Only rows with status=template are deletable.
 * - Reserved/default templates are never deletable.
 * - In MU regular-user context, only own templates are deletable.
 * - In global/admin context, only global templates are deletable.
 *
 * @since 11.0.0
 *
 * @param string $form_slug              Template slug.
 * @param int    $row_owner_user_id      Owner of listed row.
 * @param int    $current_owner_user_id  Current owner context.
 * @param int    $is_default             Default flag.
 * @param string $status                 Row status.
 *
 * @return bool
 */
function wpbc_bfb__can_delete_template_in_current_context( $form_slug, $row_owner_user_id, $current_owner_user_id, $is_default, $status ) {

	if ( 'template' !== (string) $status ) {
		return false;
	}

	if ( 'standard' === (string) $form_slug ) {
		return false;
	}

	if ( 1 === absint( $is_default ) ) {
		return false;
	}

	$row_owner_user_id = absint( $row_owner_user_id );
	$current_owner_user_id = absint( $current_owner_user_id );

	if ( $current_owner_user_id > 0 ) {
		return ( $row_owner_user_id === $current_owner_user_id );
	}

	return ( 0 === $row_owner_user_id );
}

// == AJAX == ==========================================================================================================


/**
 * Handle AJAX request: save FormConfig from the Form Builder.
 *
 * Security:
 * - Verifies wpbc_bfb_form_save nonce (sent as 'nonce').
 * - Requires current_user_can( wpbc_bfb_get_manage_cap() ).
 *
 * Expects POST:
 * - nonce          : string  Nonce for 'wpbc_bfb_form_save'.
 * - form_name      : string  'standard' or custom key (optional, default 'standard').
 * - engine         : string  Engine name, usually 'bfb' (optional, default 'bfb').
 * - engine_version : string  Engine version (optional, default '1.0').
 * - structure      : string  JSON string (Builder structure).
 * - settings       : string  JSON string (extra settings, optional).
 * - advanced_form  : string  Shortcodes / markup for booking form (optional).
 * - content_form   : string  Shortcodes / markup for "Content of booking fields data" (optional).
 *
 * On success:
 * - Persists FormConfig via wpbc_form_config_save() (which writes to
 *   booking_form_structures and optionally syncs legacy options).
 *
 * Response (JSON):
 * - success: true|false
 * - data: {
 *     booking_form_id: int,
 *     form_name:       string,
 *     engine:          string
 *   }
 *
 * @since 11.0.0
 *
 * @return void
 */
function wpbc_bfb_ajax_save_form_config() {
	global $wpdb;

	if ( ! check_ajax_referer( 'wpbc_bfb_form_save', 'nonce', false ) ) {
		wp_send_json_error( array( 'code' => 'invalid_nonce', 'message' => __( 'Security check failed.', 'booking' ) ) );
	}

	if ( ! current_user_can( wpbc_bfb_get_manage_cap() ) ) {
		wp_send_json_error( array( 'code' => 'forbidden', 'message' => __( 'You are not allowed to save booking forms.', 'booking' ) ) );
	}

	// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$form_name = isset( $_POST['form_name'] ) ? wpbc_bfb__sanitize_form_slug( wp_unslash( $_POST['form_name'] ) ) : '';
	if ( '' === $form_name ) {
		$form_name = 'standard';
	}
	if ( ( defined( 'WPBC_BFB_DEBUG__FORM_NAME' ) ) && ( ! empty( WPBC_BFB_DEBUG__FORM_NAME ) ) ) {
		$form_name = WPBC_BFB_DEBUG__FORM_NAME;
	}

	$status = isset( $_POST['status'] ) ? sanitize_key( wp_unslash( $_POST['status'] ) ) : 'published';
	$allowed_statuses = array( 'published', 'preview', 'template' );
	if ( ! in_array( $status, $allowed_statuses, true ) ) {
		$status = 'published';
	}

	// Preview context ID (calendar/resource) used ONLY to build preview URL + render shortcode.                        It is NOT saved into FormConfig in BFB mode !
	$preview_form_id = isset( $_POST['preview_form_id'] ) ? absint( wp_unslash( $_POST['preview_form_id'] ) ) : 0;
	if ( $preview_form_id <= 0 ) {
		$preview_form_id = 1;
	}
	// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$return_preview_url = ( isset( $_POST['return_preview_url'] ) && '1' === (string) wp_unslash( $_POST['return_preview_url'] ) );

	// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$engine         = isset( $_POST['engine'] ) ? sanitize_text_field( wp_unslash( $_POST['engine'] ) ) : 'bfb';
	// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$engine_version = isset( $_POST['engine_version'] ) ? sanitize_text_field( wp_unslash( $_POST['engine_version'] ) ) : '1.0';

	// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$structure_raw = isset( $_POST['structure'] ) ? wp_unslash( $_POST['structure'] ) : '';
	// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$settings_raw  = isset( $_POST['settings'] ) ? wp_unslash( $_POST['settings'] ) : '';

	// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$content_form_raw = isset( $_POST['content_form'] ) ? wp_unslash( $_POST['content_form'] ) : '';
	$content_form     = wpbc_bfb_sanitize_form_text( $content_form_raw );

	// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$advanced_form_raw = isset( $_POST['advanced_form'] ) ? wp_unslash( $_POST['advanced_form'] ) : '';
	$advanced_form     = wpbc_bfb_sanitize_form_text( $advanced_form_raw );


	// Validate structure JSON.
	$structure_arr = json_decode( $structure_raw, true );
	if ( ! is_array( $structure_arr ) ) {
		wp_send_json_error( array( 'code' => 'invalid_structure', 'message' => __( 'Form structure is not a valid JSON object.', 'booking' ) ) );
	}

	// Settings JSON (normalized to the ONLY supported schema).
	$settings_arr = wpbc_bfb__normalize_settings_array( $settings_raw );
	// $advanced_mode_source = ( isset( $settings_arr['bfb_options']['advanced_mode_source'] ) ) ? (string) $settings_arr['bfb_options']['advanced_mode_source'] : 'builder';

	// Check if owner of this form  is "Regular User" in MU.
	$owner_user_id = WPBC_FE_Custom_Form_Helper::wpbc_mu__get_current__owner_user_id();

	$form_config = array(
		'form_name'           => $form_name,
		'engine'              => $engine,
		'engine_version'      => $engine_version,
		'structure_json'      => wpbc_form_config__encode_json( $structure_arr ),
		'settings'            => $settings_arr,
		'advanced_form'       => $advanced_form,
		'content_form'        => $content_form,
		'owner_user_id'       => $owner_user_id,
		'scope'               => 'global',
		'status'              => $status,
		'is_default' => ( ( 'standard' === $form_name ) && ( 'template' !== $status ) ) ? 1 : 0,
		'booking_resource_id' => null,
	);

	// ---------------------------------------------------------------------
	// Form Details (title/description/picture) coming from UI.
	// - Preserve existing values unless UI explicitly sent a key.
	// ---------------------------------------------------------------------

	// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$form_details_raw = isset( $_POST['form_details'] ) ? wp_unslash( $_POST['form_details'] ) : null;
	$form_details     = wpbc_bfb__normalize_form_details_from_post( $form_details_raw );

	$existing_cfg = wpbc_form_config_load( $form_name, $owner_user_id );

	// Optional: rename slug/key (save by booking_form_id to avoid creating a duplicate).
	if ( array_key_exists( 'form_name', $form_details ) && '' !== $form_details['form_name'] ) {

		$new_form_name = (string) $form_details['form_name'];

		// Block reserved.
		if ( 'standard' === $new_form_name && 'standard' !== $form_name ) {
			wp_send_json_error( array( 'code' => 'reserved', 'message' => __( 'This form key is reserved.', 'booking' ) ) );
		}

		// If slug changed, ensure no collision.
		if ( $new_form_name !== $form_name ) {

			$is_fallback_to_legacy = false;
			$collision             = wpbc_form_config_load( $new_form_name, $owner_user_id, 'published', $is_fallback_to_legacy );

			$existing_id  = ( is_array( $existing_cfg ) && isset( $existing_cfg['id'] ) ) ? absint( $existing_cfg['id'] ) : 0;
			$collision_id = ( is_array( $collision ) && isset( $collision['id'] ) ) ? absint( $collision['id'] ) : 0;

			if ( ! empty( $collision ) && $collision_id !== $existing_id ) {
				wp_send_json_error( array( 'code' => 'already_exists', 'message' => __( 'Form key already exists. Please choose another.', 'booking' ) ) );
			}

			// Save by ID (so wpbc_form_config_save updates this row).
			if ( $existing_id > 0 ) {
				$form_config['booking_form_id'] = $existing_id;
			}

			$form_name = $new_form_name;

			// Keep flags consistent.
			$form_config['form_name']  = $form_name;
			$form_config['is_default'] = ( 'standard' === $form_name ) ? 1 : 0;
		}
	}


	$existing_title = ( is_array( $existing_cfg ) && isset( $existing_cfg['title'] ) ) ? (string) $existing_cfg['title'] : '';
	$existing_desc  = ( is_array( $existing_cfg ) && isset( $existing_cfg['description'] ) ) ? (string) $existing_cfg['description'] : '';
	$existing_pic   = ( is_array( $existing_cfg ) && isset( $existing_cfg['picture_url'] ) ) ? (string) $existing_cfg['picture_url'] : '';

	// Default: keep existing if set, otherwise fallback.
	$form_title = ( '' !== trim( $existing_title ) ) ? $existing_title : ( ( 'standard' === $form_name ) ? __( 'Standard', 'booking' ) : $form_name );
	$form_desc  = $existing_desc;
	$form_pic   = $existing_pic;

	// 1) Preferred: override from form_details if key exists (supports clearing).
	if ( array_key_exists( 'title', $form_details ) ) {
		$form_title = (string) $form_details['title'];
	}

	if ( array_key_exists( 'description', $form_details ) ) {
		$form_desc = (string) $form_details['description'];
	}

	if ( array_key_exists( 'picture_url', $form_details ) ) {
		$form_pic = (string) $form_details['picture_url'];
	}

	// 2) Backward compatibility: keep your old options override (if still used elsewhere).
	if ( ! empty( $settings_arr['options'] ) && is_array( $settings_arr['options'] ) ) {

		$options = $settings_arr['options'];

		if ( array_key_exists( 'booking_form_title', $options ) && ! array_key_exists( 'title', $form_details ) ) {
			$form_title = sanitize_text_field( $options['booking_form_title'] );
		}

		if ( array_key_exists( 'booking_form_description', $options ) && ! array_key_exists( 'description', $form_details ) ) {
			$form_desc = sanitize_textarea_field( $options['booking_form_description'] );
		}
	}

	// Store final meta into columns.
	$form_config['title']       = $form_title;
	$form_config['description'] = $form_desc;
	$form_config['picture_url'] = $form_pic;

	// Apply (possibly adjusted) settings back into form_config (important).
	$form_config['settings'] = wpbc_bfb__normalize_settings_array( $settings_arr );

	// We do not need to update options: 'booking_form', etc... in BFB!
	$sync_legacy = false;
	// == One Saving point ==
	$booking_form_id = wpbc_form_config_save( $form_config, array( 'sync_legacy' => (bool) $sync_legacy ) );

	if ( ! $booking_form_id ) {

		wp_send_json_error(
			array(
				'code'    => 'save_failed',
				'message' => __( 'Error saving booking form.', 'booking' ) . ( ! empty( $wpdb->last_error ) ? ' ' . $wpdb->last_error : '' ),
			)
		);
	}


	$preview_url   = '';
	$preview_token = '';

	if ( $return_preview_url && 'preview' === $status && class_exists( 'WPBC_BFB_Preview_Service' ) ) {

		$preview_service = WPBC_BFB_Preview_Service::get_instance();

		$res = $preview_service->create_preview_session( $preview_form_id, wpbc_get_current_user_id(), $structure_arr, $form_name, $advanced_form, $content_form );

		if ( is_array( $res ) && ! empty( $res['preview_url'] ) ) {
			$preview_url   = (string) $res['preview_url'];
			$preview_token = ! empty( $res['token'] ) ? (string) $res['token'] : '';
		}
	}

	wp_send_json_success(
		array(
			'booking_form_id' => $booking_form_id,
			'form_name'       => $form_name,
			'engine'          => $engine,
			'status'          => $status,
			'preview_url'     => $preview_url,
			'token'           => $preview_token,
			'title'          => isset( $form_config['title'] ) ? (string) $form_config['title'] : '',
			'description'    => isset( $form_config['description'] ) ? (string) $form_config['description'] : '',
			'picture_url'    => isset( $form_config['picture_url'] ) ? (string) $form_config['picture_url'] : '',
		)
	);

}
add_action( 'wp_ajax_' . 'WPBC_AJX_BFB_SAVE_FORM_CONFIG', 'wpbc_bfb_ajax_save_form_config' );


/**
 * Handle AJAX request: save FormConfig as TEMPLATE.
 *
 * This is a minimal wrapper around wpbc_bfb_ajax_save_form_config().
 * It forces status='template' and reuses all validations/sanitizers.
 *
 * @since 11.0.0
 *
 * @return void
 */
function wpbc_bfb_ajax_save_form_config_template() {

	// Force template status (listing expects status='template').
	$_POST['status'] = 'template';

	// Reuse main save logic.
	wpbc_bfb_ajax_save_form_config();
}
add_action( 'wp_ajax_' . 'WPBC_AJX_BFB_SAVE_FORM_CONFIG_TEMPLATE', 'wpbc_bfb_ajax_save_form_config_template' );


/**
 * Handle AJAX request: load FormConfig for the Form Builder.
 *
 * Security:
 * - Verifies wpbc_bfb_form_load nonce (sent as 'nonce').
 * - Requires current_user_can( wpbc_bfb_get_manage_cap() ).
 *
 * Expects POST:
 * - nonce     : string  Nonce for 'wpbc_bfb_form_load'.
 * - form_name : string  'standard' or custom key (optional, default 'standard').
 *
 * Behaviour:
 * - Loads FormConfig via wpbc_form_config_load().
 * - For engine = 'bfb', decodes structure_json into 'structure' array.
 * - For engine = 'legacy_*', returns a simple "notice" structure in Builder canvas.
 *
 * @since 11.0.0
 *
 * @return void
 */
function wpbc_bfb_ajax_load_form_config() {

	if ( ! check_ajax_referer( 'wpbc_bfb_form_load', 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'invalid_nonce',
				'message' => __( 'Security check failed.', 'booking' ),
			)
		);
	}

	if ( ! current_user_can( wpbc_bfb_get_manage_cap() ) ) {
		wp_send_json_error(
			array(
				'code'    => 'forbidden',
				'message' => __( 'You are not allowed to load booking forms.', 'booking' ),
			)
		);
	}

	$form_name = isset( $_POST['form_name'] ) ? sanitize_text_field( wp_unslash( $_POST['form_name'] ) ) : '';
	if ( '' === $form_name ) {
		$form_name = 'standard';
	}
	if ( ( defined( 'WPBC_BFB_DEBUG__FORM_NAME' ) ) && ( ! empty( WPBC_BFB_DEBUG__FORM_NAME ) ) ) {
		$form_name = WPBC_BFB_DEBUG__FORM_NAME;
	}


	$status           = isset( $_POST['status'] ) ? sanitize_key( wp_unslash( $_POST['status'] ) ) : 'published';
	$allowed_statuses = array( 'published', 'preview', 'template' );
	if ( ! in_array( $status, $allowed_statuses, true ) ) {
		$status = 'published';
	}


	// Check if owner of this form  is "Regular User" in MU.
	$user_id = WPBC_FE_Custom_Form_Helper::wpbc_mu__get_current__owner_user_id();

	if ( ! empty( $user_id ) ) {
		make_bk_action( 'check_multiuser_params_for_client_side_by_user_id', $user_id );   // == MU ==  // FixIn: 2026-03-06 11:57.
	}

	$form_config = wpbc_form_config_load( $form_name, $user_id, $status );

	if ( ! empty( $user_id ) ) {
		make_bk_action( 'finish_check_multiuser_params_for_client_side', null );          // == MU ==   // FixIn: 2026-03-06 11:57.
	}

	if ( empty( $form_config ) || ( ! is_array( $form_config ) ) ) {
		wp_send_json_error(
			array(
				'code'    => 'not_found',
				'message' => __( 'Booking form configuration not found.', 'booking' ),
			),
			404
		);
	}

	$engine    = isset( $form_config['engine'] ) ? (string) $form_config['engine'] : '';
	$structure = array();

	if ( ! empty( $form_config['structure_json'] ) ) {
		$tmp = json_decode( $form_config['structure_json'], true );
		if ( is_array( $tmp ) ) {
			$structure = $tmp;
		}
	}

	// Fallback notice only when no structure exists at all.
	if ( empty( $structure ) && in_array( $engine, array( 'legacy_simple', 'legacy_advanced' ), true ) ) {

		$structure = array(
			array(
				'page'    => 1,
				'content' => array(
					array(
						'type' => 'field',
						'data' => array(
							'id'             => 'static_text_legacy_notice_1',
							'type'           => 'static_text',
							'usage_key'      => 'static_text',
							'text'           => __( 'This form is currently configured in Advanced Form mode only.', 'booking' ),
							'tag'            => 'p',
							'align'          => 'center',
							'bold'           => 1,
							'italic'         => 0,
							'html_allowed'   => 0,
							'nl2br'          => 1,
							'name'           => 'static_text_legacy_notice_1',
							'html_id'        => '',
							'cssclass_extra' => '',
							'label'          => 'Static_text',
						),
					),
					array(
						'type' => 'field',
						'data' => array(
							'id'             => 'static_text_legacy_notice_2',
							'type'           => 'static_text',
							'usage_key'      => 'static_text',
							'text'           => __( 'Nothing is broken - a Form Builder layout just has not been created yet. You can continue using Advanced Form, or start building visually by dragging fields from Add Fields (right sidebar) onto this canvas.', 'booking' ),
							'tag'            => 'p',
							'align'          => 'center',
							'bold'           => 0,
							'italic'         => 0,
							'html_allowed'   => 0,
							'nl2br'          => 1,
							'name'           => 'static_text_legacy_notice_2',
							'html_id'        => '',
							'cssclass_extra' => '',
							'label'          => 'Static_text',
						),
					),
				),
			),
		);
	}

	$settings_out = wpbc_bfb__normalize_settings_array( isset( $form_config['settings'] ) ? $form_config['settings'] : array() );

	wp_send_json_success(
		array(
			'form_name'      => isset( $form_config['form_name'] ) ? (string) $form_config['form_name'] : $form_name,
			'engine'         => $engine,
			'engine_version' => isset( $form_config['engine_version'] ) ? (string) $form_config['engine_version'] : '',
			'structure'      => $structure,
			'settings'       => $settings_out,
			'advanced_form'  => isset( $form_config['advanced_form'] ) ? (string) $form_config['advanced_form'] : '',
			'content_form'   => isset( $form_config['content_form'] ) ? (string) $form_config['content_form'] : '',
			'title'          => isset( $form_config['title'] ) ? (string) $form_config['title'] : '',
			'description'    => isset( $form_config['description'] ) ? (string) $form_config['description'] : '',
			'picture_url'    => isset( $form_config['picture_url'] ) ? (string) $form_config['picture_url'] : '',
		)
	);
}
add_action( 'wp_ajax_' . 'WPBC_AJX_BFB_LOAD_FORM_CONFIG', 'wpbc_bfb_ajax_load_form_config' );


/**
 * Handle AJAX request: create new FormConfig by cloning a template form,
 * or creating a blank form when template is not selected / not available.
 *
 * Expects POST:
 * - nonce
 * - form_name          (new form key / slug)
 * - template_form_name (optional; '' or '__blank__' => blank form)
 * - title              (optional)
 * - description        (optional)
 * - image_url          (optional)
 */
function wpbc_bfb_ajax_create_form_config() {

	if ( ! check_ajax_referer( 'wpbc_bfb_form_create', 'nonce', false ) ) {
		wp_send_json_error(
			array(
				'code'    => 'invalid_nonce',
				'message' => __( 'Security check failed.', 'booking' ),
			)
		);
	}

	if ( ! current_user_can( wpbc_bfb_get_manage_cap() ) ) {
		wp_send_json_error(
			array(
				'code'    => 'forbidden',
				'message' => __( 'You are not allowed to create booking forms.', 'booking' ),
			)
		);
	}

	// New form key.
	// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$form_name = isset( $_POST['form_name'] ) ? wpbc_bfb__sanitize_form_slug( wp_unslash( $_POST['form_name'] ) ) : '';
	if ( '' === $form_name ) {
		wp_send_json_error(
			array(
				'code'    => 'invalid_form_name',
				'message' => __( 'Form key is required.', 'booking' ),
			)
		);
	}
	if ( 'standard' === $form_name ) {
		wp_send_json_error( array( 'code' => 'reserved', 'message' => __( 'This form key is reserved.', 'booking' ) ) );
	}

	// Template key (optional).
	$template_form_name = isset( $_POST['template_form_name'] ) ? sanitize_text_field( wp_unslash( $_POST['template_form_name'] ) ) : '';

	$is_blank = wpbc_bfb__is_blank_template_key( $template_form_name );

	// Meta.
	$title       = isset( $_POST['title'] ) ? sanitize_text_field( wp_unslash( $_POST['title'] ) ) : '';
	$description = isset( $_POST['description'] ) ? sanitize_textarea_field( wp_unslash( $_POST['description'] ) ) : '';
	$image_url   = isset( $_POST['image_url'] ) ? esc_url_raw( wp_unslash( $_POST['image_url'] ) ) : '';

	if ( '' === $title ) {
		$title = $form_name;
	}

	// MU owner logic.
	$owner_user_id = WPBC_FE_Custom_Form_Helper::wpbc_mu__get_current__owner_user_id();

	// Ensure new form does not already exist.
	$is_fallback_to_legacy = false;
	$existing              = wpbc_form_config_load( $form_name, $owner_user_id, 'published', $is_fallback_to_legacy );
	if ( ! empty( $existing ) ) {
		wp_send_json_error(
			array(
				'code'    => 'already_exists',
				'message' => __( 'Form key already exists. Please choose another.', 'booking' ),
			)
		);
	}

	$template     = array();
	$structure_arr = array();
	$settings_arr  = array();
	$engine        = 'bfb';
	$engine_version = '1.0';
	$advanced_form = '';
	$content_form  = '';

	// Try to load template only when requested.
	if ( ! $is_blank ) {

		// 1) Prefer user-owned template (MU) if exists.
		if ( $owner_user_id > 0 ) {
			$template = wpbc_form_config_load( $template_form_name, $owner_user_id, 'template' );
		}

		// 2) Fallback to global template.
		if ( empty( $template ) ) {
			$template = wpbc_form_config_load( $template_form_name, 0, 'template' );
		}

		// 3) If still missing (template deleted), fallback to standard if it exists.
		if ( empty( $template ) ) {
			$template = wpbc_form_config_load( 'standard', $owner_user_id );
		}

		// If still nothing, create blank.
		if ( empty( $template ) ) {
			$is_blank = true;
		}
	}

	if ( $is_blank ) {

		// Blank form seed.
		$structure_arr = wpbc_bfb__get_blank_structure_seed();
		$settings_arr  = wpbc_bfb__normalize_settings_array( array() );

		// IMPORTANT: blank forms start in Builder sync mode (Builder -> Advanced).
		if ( empty( $settings_arr['bfb_options'] ) || ! is_array( $settings_arr['bfb_options'] ) ) {
			$settings_arr['bfb_options'] = array();
		}
		$settings_arr['bfb_options']['advanced_mode_source'] = 'builder';

		$engine         = 'bfb';
		$engine_version = '1.0';
		$advanced_form  = '';
		$content_form   = '';

	} else {

		// Clone structure from template.
		if ( ! empty( $template['structure_json'] ) ) {
			$tmp = json_decode( $template['structure_json'], true );
			if ( is_array( $tmp ) ) {
				$structure_arr = $tmp;
			}
		}

		// Clone settings from template.
		$settings_arr = wpbc_bfb__normalize_settings_array( isset( $template['settings'] ) ? $template['settings'] : array() );

		$engine         = ! empty( $template['engine'] ) ? (string) $template['engine'] : 'bfb';
		$engine_version = ! empty( $template['engine_version'] ) ? (string) $template['engine_version'] : '1.0';

		$advanced_form = isset( $template['advanced_form'] ) ? (string) $template['advanced_form'] : '';
		$content_form  = isset( $template['content_form'] ) ? (string) $template['content_form'] : '';
	}

	$form_config = array(
		'form_name'      => $form_name,
		'engine'         => $engine,
		'engine_version' => $engine_version,
		'structure_json' => wpbc_form_config__encode_json( $structure_arr ),
		'settings'       => $settings_arr,
		'advanced_form'  => $advanced_form,
		'content_form'   => $content_form,
		'owner_user_id'  => $owner_user_id,

		'title'          => $title,
		'description'    => $description,
		'picture_url'    => $image_url,

		'scope'               => 'global',
		'status'              => 'published',
		'is_default'          => 0,
		'booking_resource_id' => null,
	);

	$sync_legacy = false;

	$booking_form_id = wpbc_form_config_save( $form_config, array( 'sync_legacy' => (bool) $sync_legacy ) );

	if ( ! $booking_form_id ) {
		wp_send_json_error(
			array(
				'code'    => 'create_failed',
				'message' => __( 'Error creating booking form.', 'booking' ),
			)
		);
	}

	wp_send_json_success(
		array(
			'booking_form_id' => $booking_form_id,
			'form_name'       => $form_name,
		)
	);
}
add_action( 'wp_ajax_' . 'WPBC_AJX_BFB_CREATE_FORM_CONFIG', 'wpbc_bfb_ajax_create_form_config' );


/**
 * Handle AJAX request: list booking forms for current user (and optionally global ones).
 *
 * Security:
 * - Verifies wpbc_bfb_form_list nonce (sent as 'nonce').
 * - Requires current_user_can( wpbc_bfb_get_manage_cap() ).
 *
 * Expects POST:
 * - nonce          : string  Nonce for 'wpbc_bfb_form_list'.
 * - include_global : 0|1     If 1, include global forms (owner_user_id=0/NULL) in addition to user-owned.
 * - status         : string  Default 'published'. Allowed: published|preview|draft|archived|template
 * - search         : string  Optional filter by title/slug/description
 * - limit          : int     Optional max rows (default 20, max 500)
 * - page           : int     Optional page number, starts from 1
 *
 * Response (JSON):
 * - success: true|false
 * - data: { forms: [ ... ] }
 *
 * @since 11.0.0
 *
 * @return void
 */
function wpbc_bfb_ajax_list_forms() {

	global $wpdb;

	if ( ! check_ajax_referer( 'wpbc_bfb_form_list', 'nonce', false ) ) {
		wp_send_json_error( array(
			'code'    => 'invalid_nonce',
			'message' => __( 'Security check failed.', 'booking' ),
		) );
	}

	if ( ! current_user_can( wpbc_bfb_get_manage_cap() ) ) {
		wp_send_json_error( array(
			'code'    => 'forbidden',
			'message' => __( 'You are not allowed to list booking forms.', 'booking' ),
		) );
	}

	// Allow global forms ONLY when listing templates.
	// Templates usually live as global rows (owner_user_id = 0 / NULL).
	// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$include_global = ( isset( $_POST['include_global'] ) && '1' === (string) wp_unslash( $_POST['include_global'] ) );

	// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$status = isset( $_POST['status'] ) ? sanitize_key( wp_unslash( $_POST['status'] ) ) : 'published';
	if ( '' === $status ) {
		$status = 'published';
	}

	$allowed_statuses = array( 'published', 'preview', 'draft', 'archived', 'template' );
	if ( ! in_array( $status, $allowed_statuses, true ) ) {
		$status = 'published';
	}

	// Security policy: include_global is allowed only for templates.
	if ( 'template' !== $status ) {
		$include_global = false;
	}

	$search = isset( $_POST['search'] ) ? sanitize_text_field( wp_unslash( $_POST['search'] ) ) : '';

	// Pagination.
	$page = isset( $_POST['page'] ) ? absint( wp_unslash( $_POST['page'] ) ) : 1;
	if ( $page <= 0 ) {
		$page = 1;
	}

	$limit = isset( $_POST['limit'] ) ? absint( wp_unslash( $_POST['limit'] ) ) : 20;
	if ( $limit <= 0 ) {
		$limit = 20;
	}
	if ( $limit > 500 ) {
		$limit = 500;
	}

	$offset = ( $page - 1 ) * $limit;
	if ( $offset < 0 ) {
		$offset = 0;
	}

	// MU owner logic (same as save/load/create).
	$owner_user_id = WPBC_FE_Custom_Form_Helper::wpbc_mu__get_current__owner_user_id();

	$table = $wpdb->prefix . 'booking_form_structures';

	// Base WHERE.
	$where_sql  = " WHERE status = %s ";
	$where_args = array( $status );

	// Owner/global logic.
	if ( $owner_user_id > 0 ) {
		if ( $include_global ) {
			$where_sql .= " AND ( owner_user_id = %d OR owner_user_id = 0 OR owner_user_id IS NULL ) ";
			$where_args[] = $owner_user_id;
		} else {
			$where_sql .= " AND owner_user_id = %d ";
			$where_args[] = $owner_user_id;
		}
	} else {
		// Non-MU (or super admin context): treat as global rows.
		$where_sql .= " AND ( owner_user_id = 0 OR owner_user_id IS NULL ) ";
	}

	// Search filter. Supports OR search by configured separator (default "~"): "time~duration~slots"
	if ( '' !== $search ) {

		$terms = wpbc_bfb__split_search_terms_by_or_separator( $search, 5 );

		if ( empty( $terms ) ) {
			// No usable terms after splitting.
		} elseif ( 1 === count( $terms ) ) {

			$like = '%' . $wpdb->esc_like( $terms[0] ) . '%';
			$where_sql .= " AND ( form_slug LIKE %s OR title LIKE %s OR description LIKE %s ) ";
			$where_args[] = $like;
			$where_args[] = $like;
			$where_args[] = $like;

		} else {

			$or_groups = array();

			foreach ( $terms as $term ) {

				$or_groups[] = "( form_slug LIKE %s OR title LIKE %s OR description LIKE %s )";

				$like = '%' . $wpdb->esc_like( $term ) . '%';
				$where_args[] = $like;
				$where_args[] = $like;
				$where_args[] = $like;
			}

			$where_sql .= " AND ( " . implode( ' OR ', $or_groups ) . " ) ";
		}
	}

	// Order:
	// - prefer user-owned rows first (when include_global + owner_user_id > 0)
	// - default forms first
	// - newest first
	$order_sql = " ORDER BY is_default DESC, updated_at DESC, version DESC, booking_form_id DESC ";

	if ( $owner_user_id > 0 && $include_global ) {
		$order_sql = " ORDER BY ( owner_user_id = " . intval( $owner_user_id ) . " ) DESC, is_default DESC, updated_at DESC, version DESC, booking_form_id DESC ";
	}

	$limit_plus_one = $limit + 1;

	$sql = "SELECT booking_form_id, form_slug, title, description, picture_url, updated_at, owner_user_id, status, scope, is_default, version
			FROM {$table}
			{$where_sql}
			{$order_sql}
			LIMIT " . intval( $limit_plus_one ) . ' OFFSET ' . intval( $offset );

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
	$rows = $wpdb->get_results( $wpdb->prepare( $sql, $where_args ) );

	$has_more = ( count( (array) $rows ) > $limit );
	if ( $has_more ) {
		$rows = array_slice( (array) $rows, 0, $limit );
	}

	$forms = array();

	// If include_global + owner_user_id > 0: dedupe by slug, prefer owner over global.
	$seen_by_slug = array();

	foreach ( (array) $rows as $r ) {

		$slug = isset( $r->form_slug ) ? (string) $r->form_slug : '';
		if ( '' === $slug ) {
			continue;
		}

		if ( $owner_user_id > 0 && $include_global ) {
			if ( isset( $seen_by_slug[ $slug ] ) ) {
				continue;
			}
			$seen_by_slug[ $slug ] = true;
		}


		$row_owner_user_id = isset( $r->owner_user_id ) ? absint( $r->owner_user_id ) : 0;
		$row_status        = isset( $r->status ) ? (string) $r->status : '';
		$row_is_default    = isset( $r->is_default ) ? absint( $r->is_default ) : 0;

		$raw_picture_url = isset( $r->picture_url ) ? (string) $r->picture_url : '';

		$final_picture_url = ( 'template' === $row_status ) ? wpbc_bfb_resolve_picture_url( $raw_picture_url ) : $raw_picture_url;

		$can_delete = wpbc_bfb__can_delete_template_in_current_context(
			$slug,
			$row_owner_user_id,
			$owner_user_id,
			$row_is_default,
			$row_status
		);

		$forms[] = array(
			'booking_form_id' => isset( $r->booking_form_id ) ? (int) $r->booking_form_id : 0,
			'form_slug'       => $slug,
			'title'           => isset( $r->title ) ? (string) $r->title : '',
			'description'     => isset( $r->description ) ? (string) $r->description : '',
			'picture_url'     => $final_picture_url,
			'updated_at'      => isset( $r->updated_at ) ? (string) $r->updated_at : '',
			'owner_user_id'   => $row_owner_user_id,
			'status'          => $row_status,
			'scope'           => isset( $r->scope ) ? (string) $r->scope : '',
			'is_default'      => $row_is_default,
			'version'         => isset( $r->version ) ? (int) $r->version : 0,
			'can_delete'      => $can_delete ? 1 : 0,
		);
	}

	wp_send_json_success( array(
		'forms'    => $forms,
		'count'    => count( $forms ),
		'page'     => $page,
		'limit'    => $limit,
		'has_more' => $has_more,
	) );
}
add_action( 'wp_ajax_' . 'WPBC_AJX_BFB_LIST_FORMS', 'wpbc_bfb_ajax_list_forms' );


/**
 * Handle AJAX request: delete a TEMPLATE FormConfig.
 *
 * Security:
 * - Verifies wpbc_bfb_form_delete nonce (or list nonce fallback).
 * - Requires current_user_can( wpbc_bfb_get_manage_cap() ).
 *
 * Expects POST:
 * - nonce     : string  Nonce for delete/list action.
 * - form_name : string  Template slug/key to delete.
 *
 * Behaviour:
 * - Deletes ONLY template rows for the given slug.
 * - In MultiUser mode: a regular user can delete ONLY their own templates.
 * - Global templates shown to regular MU users are NOT deletable.
 *
 * Response (JSON):
 * - success: true|false
 * - data: {
 *     form_name: string,
 *     deleted:   int
 *   }
 *
 * @since 11.0.0
 *
 * @return void
 */
function wpbc_bfb_ajax_delete_template_config() {
	global $wpdb;

	if ( ! wpbc_bfb__verify_delete_request_nonce() ) {
		wp_send_json_error(
			array(
				'code'    => 'invalid_nonce',
				'message' => __( 'Security check failed.', 'booking' ),
			)
		);
	}

	if ( ! current_user_can( wpbc_bfb_get_manage_cap() ) ) {
		wp_send_json_error(
			array(
				'code'    => 'forbidden',
				'message' => __( 'You are not allowed to delete templates.', 'booking' ),
			)
		);
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
	$form_name = isset( $_POST['form_name'] ) ? sanitize_text_field( wp_unslash( $_POST['form_name'] ) ) : '';
	if ( '' === $form_name ) {
		wp_send_json_error(
			array(
				'code'    => 'invalid_form_name',
				'message' => __( 'Template key is required.', 'booking' ),
			)
		);
	}

	if ( 'standard' === $form_name ) {
		wp_send_json_error(
			array(
				'code'    => 'reserved',
				'message' => __( 'This template cannot be deleted.', 'booking' ),
			)
		);
	}

	$owner_user_id = WPBC_FE_Custom_Form_Helper::wpbc_mu__get_current__owner_user_id();

	/**
	 * Filter whether deletion of a specific template is allowed.
	 *
	 * @since 11.0.0
	 *
	 * @param bool   $is_allowed    Default true.
	 * @param string $form_name     Template slug/key.
	 * @param int    $owner_user_id Owner user id in MU (0 for global).
	 */
	$is_allowed = apply_filters( 'wpbc_bfb_delete_template_is_allowed', true, $form_name, $owner_user_id );
	if ( ! $is_allowed ) {
		wp_send_json_error(
			array(
				'code'    => 'not_allowed',
				'message' => __( 'Deletion is not allowed for this template.', 'booking' ),
			)
		);
	}

	$table = $wpdb->prefix . 'booking_form_structures';

	$where_sql  = " WHERE form_slug = %s AND status = %s ";
	$where_args = array( $form_name, 'template' );

	if ( $owner_user_id > 0 ) {
		$where_sql .= " AND owner_user_id = %d ";
		$where_args[] = $owner_user_id;
	} else {
		$where_sql .= " AND ( owner_user_id = 0 OR owner_user_id IS NULL ) ";
	}

	$sql = "SELECT booking_form_id, is_default, owner_user_id
			FROM {$table}
			{$where_sql}
			ORDER BY updated_at DESC, version DESC, booking_form_id DESC
			LIMIT 1";

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
	$row = $wpdb->get_row( $wpdb->prepare( $sql, $where_args ) );

	if ( empty( $row ) ) {
		wp_send_json_error(
			array(
				'code'    => 'not_found',
				'message' => __( 'Template not found.', 'booking' ),
			)
		);
	}

	if ( 1 === absint( $row->is_default ) ) {
		wp_send_json_error(
			array(
				'code'    => 'reserved',
				'message' => __( 'This template cannot be deleted.', 'booking' ),
			)
		);
	}

	$delete_sql = "DELETE FROM {$table} {$where_sql}";

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
	$deleted = $wpdb->query( $wpdb->prepare( $delete_sql, $where_args ) );

	if ( false === $deleted ) {
		wp_send_json_error(
			array(
				'code'    => 'delete_failed',
				'message' => __( 'Error deleting template.', 'booking' ) . ( ! empty( $wpdb->last_error ) ? ' ' . $wpdb->last_error : '' ),
			)
		);
	}

	wp_send_json_success(
		array(
			'form_name' => $form_name,
			/* translators: 1: template name */
			'message' => sprintf( __( 'Template %s deleted.', 'booking' ), "'" . $form_name . "'" ) . ' [' . absint( $deleted ) . ']',
			'deleted' => absint( $deleted ),
		)
	);
}
add_action( 'wp_ajax_' . 'WPBC_AJX_BFB_DELETE_TEMPLATE_CONFIG', 'wpbc_bfb_ajax_delete_template_config' );


/**
 * Handle AJAX request: delete a custom FormConfig.
 *
 * Security:
 * - Verifies wpbc_bfb_form_delete nonce (sent as 'nonce').
 * - Requires current_user_can( wpbc_bfb_get_manage_cap() ).
 *
 * Expects POST:
 * - nonce     : string  Nonce for 'wpbc_bfb_form_delete'.
 * - form_name : string  Custom form slug/key to delete (required).
 *
 * Behaviour:
 * - Blocks deletion of reserved/default forms (e.g. 'standard' or is_default=1).
 * - In MultiUser mode: a regular user can delete ONLY their own forms.
 * - Deletes ALL rows for this form_slug (all statuses/versions), excluding scope='template'.
 *
 * Response (JSON):
 * - success: true|false
 * - data: {
 *     form_name: string,
 *     deleted:   int
 *   }
 *
 * @since 11.0.0
 *
 * @return void
 */
function wpbc_bfb_ajax_delete_form_config() {
	global $wpdb;

	if ( ! wpbc_bfb__verify_delete_request_nonce() ) {
		wp_send_json_error(
			array(
				'code'    => 'invalid_nonce',
				'message' => __( 'Security check failed.', 'booking' ),
			)
		);
	}

	if ( ! current_user_can( wpbc_bfb_get_manage_cap() ) ) {
		wp_send_json_error(
			array(
				'code'    => 'forbidden',
				'message' => __( 'You are not allowed to delete booking forms.', 'booking' ),
			)
		);
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
	$form_name = isset( $_POST['form_name'] ) ? sanitize_text_field( wp_unslash( $_POST['form_name'] ) ) : '';
	if ( '' === $form_name ) {
		wp_send_json_error(
			array(
				'code'    => 'invalid_form_name',
				'message' => __( 'Form key is required.', 'booking' ),
			)
		);
	}

	// Block reserved key.
	if ( 'standard' === $form_name ) {
		wp_send_json_error(
			array(
				'code'    => 'reserved',
				'message' => __( 'This form cannot be deleted.', 'booking' ),
			)
		);
	}

	// MU owner logic (same approach as save/load/create/list).
	$owner_user_id = WPBC_FE_Custom_Form_Helper::wpbc_mu__get_current__owner_user_id();

	/**
	 * Filter whether deletion of a specific form is allowed.
	 *
	 * @since 11.0.0
	 *
	 * @param bool   $is_allowed    Default true.
	 * @param string $form_name     Form slug/key.
	 * @param int    $owner_user_id Owner user id in MU (0 for global).
	 */
	$is_allowed = apply_filters( 'wpbc_bfb_delete_form_is_allowed', true, $form_name, $owner_user_id );
	if ( ! $is_allowed ) {
		wp_send_json_error(
			array(
				'code'    => 'not_allowed',
				'message' => __( 'Deletion is not allowed for this form.', 'booking' ),
			)
		);
	}

	$table = $wpdb->prefix . 'booking_form_structures';

	// ---------------------------------------------------------------------------------
	// Check existence + protect default/template.
	// ---------------------------------------------------------------------------------
	$where_sql  = " WHERE form_slug = %s ";
	$where_args = array( $form_name );

	if ( $owner_user_id > 0 ) {
		$where_sql .= " AND owner_user_id = %d ";
		$where_args[] = $owner_user_id;
	} else {
		$where_sql .= " AND ( owner_user_id = 0 OR owner_user_id IS NULL ) ";
	}

	// Exclude template scope rows from selection checks as well.
	$where_sql .= " AND ( scope IS NULL OR scope <> %s ) ";
	$where_args[] = 'template';

	// Exclude template scope rows from selection checks as well.
	$where_sql .= " AND ( status IS NULL OR status <> %s ) ";
	$where_args[] = 'template';

	$sql = "SELECT booking_form_id, is_default, scope, status
			FROM {$table}
			{$where_sql}
			ORDER BY updated_at DESC, version DESC, booking_form_id DESC
			LIMIT 1";

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
	$row = $wpdb->get_row( $wpdb->prepare( $sql, $where_args ) );

	if ( empty( $row ) ) {
		wp_send_json_error(
			array(
				'code'    => 'not_found',
				'message' => __( 'Booking form not found.', 'booking' ),
			)
		);
	}

	$is_default = isset( $row->is_default ) ? absint( $row->is_default ) : 0;
	if ( 1 === $is_default ) {
		wp_send_json_error(
			array(
				'code'    => 'reserved',
				'message' => __( 'This form cannot be deleted.', 'booking' ),
			)
		);
	}

	$scope  = isset( $row->scope ) ? (string) $row->scope : '';
	$status = isset( $row->status ) ? (string) $row->status : '';
	if ( ( 'template' === $scope ) || ( 'template' === $status ) ) {
		wp_send_json_error(
			array(
				'code'    => 'reserved',
				'message' => __( 'Template forms cannot be deleted.', 'booking' ),
			)
		);
	}

	// ---------------------------------------------------------------------------------
	// Delete ALL rows for this slug/owner (all statuses/versions), excluding templates.
	// ---------------------------------------------------------------------------------
	$delete_where_sql  = " WHERE form_slug = %s ";
	$delete_where_args = array( $form_name );

	if ( $owner_user_id > 0 ) {
		$delete_where_sql .= " AND owner_user_id = %d ";
		$delete_where_args[] = $owner_user_id;
	} else {
		$delete_where_sql .= " AND ( owner_user_id = 0 OR owner_user_id IS NULL ) ";
	}

	$delete_where_sql .= " AND ( scope IS NULL OR scope <> %s ) ";
	$delete_where_args[] = 'template';
	$delete_where_sql .= " AND ( status IS NULL OR status <> %s ) ";
	$delete_where_args[] = 'template';

	$delete_sql = "DELETE FROM {$table} {$delete_where_sql}";

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
	$deleted = $wpdb->query( $wpdb->prepare( $delete_sql, $delete_where_args ) );

	if ( false === $deleted ) {
		wp_send_json_error(
			array(
				'code'    => 'delete_failed',
				'message' => __( 'Error deleting booking form.', 'booking' ) . ( ! empty( $wpdb->last_error ) ? ' ' . $wpdb->last_error : '' ),
			)
		);
	}

	wp_send_json_success(
		array(
			'form_name' => $form_name,
			/* translators: 1: template name */
			'message'   => sprintf( __( 'Booking form %s deleted.', 'booking' ), "'" . $form_name . "'" ) . ' [' . absint( $deleted ) . ']',
			'deleted'   => absint( $deleted ),
		)
	);
}
add_action( 'wp_ajax_' . 'WPBC_AJX_BFB_DELETE_FORM_CONFIG', 'wpbc_bfb_ajax_delete_form_config' );
