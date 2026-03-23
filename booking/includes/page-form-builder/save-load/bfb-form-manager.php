<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Helper functions for saving / loading between different versions of booking forms.
 *
 * This file is the bridge between:
 *
 * - Old world: booking_form, booking_form_show, booking_forms_extended, etc.
 * - New world: booking_form_structures table.
 *
 * It introduces a normalized FormConfig array:
 *
 * [
 *     'id'                  => booking_form_id,
 *     'form_name'           => 'standard' or custom key (maps to form_slug),
 *     'engine'              => 'bfb' | 'legacy_advanced' | 'legacy_simple',
 *     'engine_version'      => '1.0',
 *     'title'               => string,
 *     'description'         => string,
 *     'scope'               => string,
 *     'status'              => string,
 *     'is_default'          => int (0|1),
 *     'booking_resource_id' => int|null,
 *     'owner_user_id'       => int,
 *     'structure_json'      => string, // BFB structure or legacy stub/simple_form.
 *     'settings'            => array,  // Decoded settings_json.
 *     'advanced_form'       => string, // Booking form shortcode configuration.
 *     'content_form'        => string, // Fields content template.
 *     'picture_url'         => string,
 *     'created_at'          => string,
 *     'updated_at'          => string,
 * ]
 *
 * What we do:
 * - Re-use booking_form_structures as canonical FormConfig storage.
 *   Each row now carries:
 *   - form_slug (your form_name): 'standard', custom names, etc.
 *   - owner_user_id for MultiUser ownership.
 *   - engine, engine_version.
 *   - structure_json (BFB structure, or legacy stub/simple_form).
 *   - advanced_form + content_form (what front-end uses today).
 *
 * Main public API:
 * - wpbc_form_config_load():
 *     Tries the booking_form_structures table first, falls back to legacy
 *     wp_options-based configuration if no row exists.
 *
 * - wpbc_form_config_save():
 *     Used by the new Builder save controller. Writes to
 *     booking_form_structures via WPBC_BFB_Form_Storage::save_form().
 *     Optionally syncs booking_form / booking_forms_extended so all old
 *     runtime code keeps working.
 *
 * @package     Booking Calendar.
 * @author      wpdevelop, oplugins
 * @web-site    https://wpbookingcalendar.com/
 * @email       info@wpbookingcalendar.com
 *
 * @modified    2025-12-07
 * @version     1.1
 * @file        ../includes/page-form-builder/save-load/bfb-form-manager.php
 */

// == 1. Small JSON helper ==

/**
 * Safely JSON-encode arbitrary data for storage.
 *
 * Wrapper around wp_json_encode() that guarantees a string return value.
 * If encoding fails, an empty string is returned.
 *
 * @param mixed $data Arbitrary data to be encoded.
 *
 * @return string JSON string, or empty string on failure.
 */
function wpbc_form_config__encode_json( $data ) {
	$json = wp_json_encode( $data );

	return ( false === $json ) ? '' : $json;
}

// == 2. Build FormConfig from DB row ==

/**
 * Normalize raw DB row from booking_form_structures into a FormConfig array.
 *
 * This is the single place where columns from booking_form_structures are
 * mapped into the canonical FormConfig keys used in the new Form Manager.
 *
 * @param object $row Database row object. Typically returned by
 *                    WPBC_BFB_Form_Storage::get_current_form_by_key().
 *
 * @return array|null Normalized FormConfig array or null if the row is empty.
 */
function wpbc_form_config__from_row( $row ) {

	if ( ! $row ) {
		return null;
	}

	$settings = array();
	if ( ! empty( $row->settings_json ) ) {
		$decoded = json_decode( $row->settings_json, true );
		if ( is_array( $decoded ) ) {
			$settings = $decoded;
		}
	}

	return array(
		'id'                  => (int) $row->booking_form_id,
		'owner_user_id'       => isset( $row->owner_user_id ) ? (int) $row->owner_user_id : 0,
		// External API uses "form_name" (key used in Builder / shortcodes); in DB it is stored as form_slug.
		'form_name'           => isset( $row->form_slug ) ? (string) $row->form_slug : '',
		'engine'              => ! empty( $row->engine ) ? (string) $row->engine : 'bfb',
		'engine_version'      => ! empty( $row->engine_version ) ? (string) $row->engine_version : '1.0',
		'title'               => isset( $row->title ) ? (string) $row->title : '',
		'description'         => isset( $row->description ) ? (string) $row->description : '',
		'scope'               => isset( $row->scope ) ? (string) $row->scope : 'global',
		'status'              => isset( $row->status ) ? (string) $row->status : 'published',
		'is_default'          => isset( $row->is_default ) ? (int) $row->is_default : 0,
		'booking_resource_id' => isset( $row->booking_resource_id ) ? (int) $row->booking_resource_id : null,
		'structure_json'      => isset( $row->structure_json ) ? (string) $row->structure_json : '',
		'settings'            => $settings,
		'advanced_form'       => isset( $row->advanced_form ) ? (string) $row->advanced_form : '',
		'content_form'        => isset( $row->content_form ) ? (string) $row->content_form : '',
		'picture_url'         => isset( $row->picture_url ) ? (string) $row->picture_url : '',
		'created_at'          => isset( $row->created_at ) ? (string) $row->created_at : '',
		'updated_at'          => isset( $row->updated_at ) ? (string) $row->updated_at : '',
	);
}

// == 3. Detect if a form already exists in storage ==

/**
 * Check if a FormConfig row already exists in storage.
 *
 * Currently this lookup is global per site (form_slug only, status 'published')
 * and does not yet filter by owner_user_id. The user_id parameter is reserved
 * for future MultiUser-aware lookups.
 *
 * @param string $form_key Unique form key/slug (e.g. 'standard').
 * @param int    $user_id  Optional. Owner user ID. Default 0 (global, not used yet).
 *
 * @return bool True if a row exists, false otherwise.
 */
function wpbc_form_config_exists_in_storage( $form_key, $user_id = 0 ) { // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable

	$form_key = (string) $form_key;
	if ( '' === $form_key ) {
		return false;
	}

	// Do not filter by owner_user_id for now – global per site, status = 'published'.
	$row = WPBC_BFB_Form_Storage::get_current_form_by_key( $form_key, $user_id, 'published' );

	return ( $row && ! empty( $row->booking_form_id ) );
}


// == 4. Legacy loader (fallback from old options) ==

/**
 * Build FormConfig from legacy options when no row exists in booking_form_structures.
 *
 * Behaviour:
 * - Standard form uses:
 *     - booking_form          (advanced form).
 *     - booking_form_show     (content form).
 *     - booking_form_visual   (Simple form structure, if present).
 * - Custom forms use booking_forms_extended (serialized array of forms).
 *
 * Returned FormConfig uses:
 * - engine: 'legacy_advanced' or 'legacy_simple' depending on available data.
 * - structure_json: encoded visual/simple_form structure or legacy stub.
 *
 * @param string $form_key Form key. 'standard' or custom key used in legacy options.
 * @param int    $user_id  Owner user ID for bookkeeping. Default 0.
 *
 * @return array|null FormConfig array on success or null if no legacy form found.
 */
function wpbc_form_config__load_from_legacy( $form_key, $user_id = 0 ) {

	$form_key = (string) $form_key;
	if ( '' === $form_key ) {
		$form_key = wpbc_bfb_get_default_form_key();
	}

	// 1) Standard form.
	if ( 'standard' === $form_key ) {

		$engine        = 'legacy_advanced';
		$advanced_form = wpbc_bfb_get_legacy_option_value( 'booking_form', $user_id );
		$content_form  = wpbc_bfb_get_legacy_option_value( 'booking_form_show', $user_id );

		$visual = wpbc_bfb_get_legacy_option_value( 'booking_form_visual', $user_id );
		$visual = maybe_unserialize( $visual );

		$structure_json = wpbc_form_config__encode_json( array() );

		// Free version only: use Simple Form structure as fallback Builder structure.
		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			if ( is_array( $visual ) && ! empty( $visual ) ) {
				$engine        = 'legacy_simple';
				$structure_arr = wpbc_simple_form__export_to_bfb_structure( $visual );
				$structure_json = wpbc_form_config__encode_json( $structure_arr );
			}
		}

		return array(
			'id'                  => 0,
			'owner_user_id'       => (int) $user_id,
			'form_name'           => 'standard',
			'engine'              => $engine,
			'engine_version'      => '1.0',
			'title'               => 'Standard',
			'description'         => '',
			'scope'               => 'global',
			'status'              => 'published',
			'is_default'          => 1,
			'booking_resource_id' => null,
			'structure_json'      => $structure_json,
			'settings'            => array(),
			'advanced_form'       => (string) $advanced_form,
			'content_form'        => (string) $content_form,
			'picture_url'         => '',
			'created_at'          => '',
			'updated_at'          => '',
		);
	}

	// 2) Custom forms from booking_forms_extended.
	$extended = wpbc_bfb_get_legacy_option_value( 'booking_forms_extended', $user_id );
	$extended = maybe_unserialize( $extended );

	if ( is_array( $extended ) ) {
		foreach ( $extended as $one ) {

			if ( empty( $one['name'] ) || (string) $one['name'] !== $form_key ) {
				continue;
			}

			$adv            = isset( $one['form'] ) ? $one['form'] : '';
			$cnt            = isset( $one['content'] ) ? $one['content'] : '';
			$engine         = 'legacy_advanced';
			$structure_json = wpbc_form_config__encode_json( array() );

			// Only if Advanced Form is absent, or plugin works in Free mode.
			if ( ( ! class_exists( 'wpdev_bk_personal' ) ) || empty( $adv ) ) {
				if ( ! empty( $one['simple_form'] ) && is_array( $one['simple_form'] ) ) {
					$engine         = 'legacy_simple';
					$structure_arr  = wpbc_simple_form__export_to_bfb_structure( $one['simple_form'] );
					$structure_json = wpbc_form_config__encode_json( $structure_arr );
				}
			}

			return array(
				'id'                  => 0,
				'owner_user_id'       => (int) $user_id,
				'form_name'           => $form_key,
				'engine'              => $engine,
				'engine_version'      => '1.0',
				'title'               => isset( $one['title'] ) ? (string) $one['title'] : (string) $form_key,
				'description'         => isset( $one['description'] ) ? (string) $one['description'] : '',
				'scope'               => 'global',
				'status'              => 'published',
				'is_default'          => ! empty( $one['is_default'] ) ? 1 : 0,
				'booking_resource_id' => isset( $one['booking_resource_id'] ) ? intval( $one['booking_resource_id'] ) : null,
				'structure_json'      => $structure_json,
				'settings'            => array(),
				'advanced_form'       => (string) $adv,
				'content_form'        => (string) $cnt,
				'picture_url'         => '',
				'created_at'          => '',
				'updated_at'          => '',
			);
		}
	}

	return null;
}

// == 5. Public loader: try DB first, then legacy ==

/**
 * Load unified FormConfig for a given form_key and optional owner.
 *
 * This is the main read API for booking form configuration:
 * - First tries the booking_form_structures table (new engine).
 *   Currently we load status = 'published' row via
 *   WPBC_BFB_Form_Storage::get_current_form_by_key().
 * - If nothing is found, falls back to legacy options via
 *   wpbc_form_config__load_from_legacy().
 *
 * @param string $form_key Form key. 'standard' or custom key. Default 'standard'.
 * @param int    $user_id  Owner user ID for MultiUser environment. Default 0.
 *
 * @return array|null Normalized FormConfig array or null if nothing found.
 */
function wpbc_form_config_load( $form_key = 'standard', $user_id = 0, $status = 'published', $is_fallback_to_legacy = true ) {

	$form_key = (string) $form_key;
	if ( '' === $form_key ) {
		$form_key = 'standard';

	}

	// 1) Try storage table first (status = 'published').
	$row = WPBC_BFB_Form_Storage::get_current_form_by_key( $form_key, $user_id, $status );
	if ( $row ) {
		return wpbc_form_config__from_row( $row );
	}

	// 2) Fallback to legacy options.
	if ( $is_fallback_to_legacy ) {

		return wpbc_form_config__load_from_legacy( $form_key, $user_id );

	}

	// Not found.
	return null;
}

// == 6. Sync back to legacy options (for runtime compatibility) ==

/**
 * Sync a normalized FormConfig back into legacy wp_options for runtime compatibility.
 *
 * This keeps all existing Booking Calendar runtime code working while the
 * new Form Builder engine is being rolled out.
 *
 * Behaviour:
 * - 'standard' form maps to:
 *     - booking_form      (advanced_form).
 *     - booking_form_show (content_form).
 * - Custom forms are stored in booking_forms_extended (serialized array).
 *
 * @param array $cfg FormConfig array produced by the Form Manager.
 *
 * @return void
 */
function wpbc_form_config__sync_legacy_options( array $cfg ) {

	if ( empty( $cfg['form_name'] ) ) {
		return;
	}

	$form_name     = (string) $cfg['form_name'];
	$advanced_form = isset( $cfg['advanced_form'] ) ? (string) $cfg['advanced_form'] : '';
	$content_form  = isset( $cfg['content_form'] ) ? (string) $cfg['content_form'] : '';

	// Standard form.
	if ( 'standard' === $form_name ) {
		if ( '' !== $advanced_form ) {
			update_bk_option( 'booking_form', $advanced_form );
		}
		if ( '' !== $content_form ) {
			update_bk_option( 'booking_form_show', $content_form );
		}

		// Optionally update booking_form_visual from structure_json for legacy_simple
		// (we can add this later when exact mapping is defined).
		return;
	}

	// Custom forms: booking_forms_extended.
	$extended = get_bk_option( 'booking_forms_extended' );
	$extended = maybe_unserialize( $extended );

	if ( ! is_array( $extended ) ) {
		$extended = array();
	}

	$found = false;

	foreach ( $extended as &$one ) {
		if ( empty( $one['name'] ) || (string) $one['name'] !== $form_name ) {
			continue;
		}

		$one['form']    = $advanced_form;
		$one['content'] = $content_form;
		$found          = true;
		break;
	}
	unset( $one );

	if ( ! $found ) {
		$extended[] = array(
			'name'    => $form_name,
			'form'    => $advanced_form,
			'content' => $content_form,
		);
	}

	update_bk_option( 'booking_forms_extended', serialize( $extended ) );
}

// == 7. Public saver: BFB (and later other engines) -> DB + legacy ==

/**
 * Save BFB Form into DB  - Main Save Function!
 *
 * Save unified FormConfig into booking_form_structures and sync legacy options.
 *
 * Expected minimal keys in $form_config:
 * - form_name
 * - engine
 * - structure_json  (for BFB this is full Builder structure JSON)
 * - advanced_form   (booking form shortcode configuration)
 * - content_form    (fields data/content configuration)
 *
 * Behaviour:
 * - Always writes to booking_form_structures via WPBC_BFB_Form_Storage::save_form().
 *   - Uses form_slug = form_name.
 *   - Uses status from $form_config['status'] or 'published' by default.
 * - Optionally calls wpbc_form_config__sync_legacy_options() to keep
 *   existing legacy runtime code working.
 *
 * @param array $form_config Normalized FormConfig array.
 * @param array $args        {
 *     Optional. Additional saving arguments.
 *
 *     @type bool $sync_legacy Whether to sync legacy wp_options. Default true.
 * }
 *
 * @return int|false booking_form_id on success, or false on failure.
 */
function wpbc_form_config_save( array $form_config, array $args = array() ) {

	$args = wp_parse_args(
		$args,
		array(
			'sync_legacy' => true,
		)
	);

	$form_name = isset( $form_config['form_name'] ) ? (string) $form_config['form_name'] : '';
	if ( '' === $form_name ) {
		$form_name = 'standard';
	}

	$engine         = isset( $form_config['engine'] ) ? (string) $form_config['engine'] : 'bfb';
	$engine_version = isset( $form_config['engine_version'] ) ? (string) $form_config['engine_version'] : '1.0';

	$structure_json = isset( $form_config['structure_json'] ) ? (string) $form_config['structure_json'] : '';
	$settings       = isset( $form_config['settings'] ) ? $form_config['settings'] : array();
	$settings_json  = wpbc_form_config__encode_json( $settings ); // Returns '' on error/empty.

	$advanced_form = isset( $form_config['advanced_form'] ) ? (string) $form_config['advanced_form'] : '';
	$content_form  = isset( $form_config['content_form'] ) ? (string) $form_config['content_form'] : '';

	if ( '' === $structure_json && 'bfb' === $engine ) {
		// For BFB we expect real structure JSON.
		return false;
	}

	$owner_user_id = isset( $form_config['owner_user_id'] ) ? (int) $form_config['owner_user_id'] : 0;

	$storage_data = array(
		// New schema uses form_slug; we map form_name -> form_slug.
		'form_slug'           => $form_name,

		'title'               => isset( $form_config['title'] ) ? (string) $form_config['title'] : $form_name,
		'description'         => isset( $form_config['description'] ) ? (string) $form_config['description'] : '',
		'scope'               => isset( $form_config['scope'] ) ? (string) $form_config['scope'] : 'global',

		'booking_resource_id' => isset( $form_config['booking_resource_id'] ) ? (int) $form_config['booking_resource_id'] : null,
		'owner_user_id'       => ! empty( $owner_user_id ) ? $owner_user_id : 0,
		'is_default'          => ! empty( $form_config['is_default'] ) ? 1 : 0,
		'status'              => isset( $form_config['status'] ) ? (string) $form_config['status'] : 'published',

		'engine'              => $engine,
		'engine_version'      => $engine_version,
		'structure_json'      => $structure_json,
		'settings_json'       => $settings_json,
		'advanced_form'       => $advanced_form,
		'content_form'        => $content_form,

		// Optional picture/preview image URL.
		'picture_url'         => isset( $form_config['picture_url'] ) ? (string) $form_config['picture_url'] : null,
	);

	$booking_form_id = WPBC_BFB_Form_Storage::save_form( $storage_data );

	if ( $booking_form_id && ! empty( $args['sync_legacy'] ) ) {
		wpbc_form_config__sync_legacy_options( $form_config );
	}

	return $booking_form_id;
}


// == Default Load Form !) ==

/**
 * Get default form key used by the Form Builder.
 *
 * Centralizes the default key for the main booking form, currently 'standard'.
 *
 * @return string Default form key.
 */
function wpbc_bfb_get_default_form_key() {
	return 'standard';
}

/**
 * Output AJAX boot configuration for the Form Builder.
 *
 * Prints a small inline script that exposes WPBC_BFB_Ajax on window. This
 * configuration is consumed by the JS Builder to perform save / load
 * requests via admin-ajax.php.
 *
 * Should be called only on the Form Builder admin page.
 *
 * @return void
 */
function wpbc_bfb_output_ajax_boot_config() {

	$form_key = wpbc_bfb_get_default_form_key(); // 'standard' – or detect from current screen / URL / selection.

	$ajax_config = array(
		'url'                   => admin_url( 'admin-ajax.php' ),
		'nonce_save'            => wp_create_nonce( 'wpbc_bfb_form_save' ),
		'nonce_load'            => wp_create_nonce( 'wpbc_bfb_form_load' ),
		'nonce_create'          => wp_create_nonce( 'wpbc_bfb_form_create' ),
		'nonce_list'            => wp_create_nonce( 'wpbc_bfb_form_list' ),
		'form_name'             => $form_key,                                   // info: INIT_FORM_LOAD.
		'engine'                => 'bfb',
		'engine_version'        => '1.0',
		// Initial load behavior.
		'initial_load'          => 'ajax',                                     // 'ajax' / 'example' / 'blank'.
		'initial_load_fallback' => 'example',                                  // 'example' / 'blank'.
		'load_action'           => 'WPBC_AJX_BFB_LOAD_FORM_CONFIG',
	);
	?>
	<script type="text/javascript"> window.WPBC_BFB_Ajax = <?php echo wp_json_encode( $ajax_config ); ?>; </script>
	<?php
}

/**
 * Get the "advanced" booking form configuration for a given form key.
 *
 * This is a thin convenience wrapper around wpbc_form_config_load() that
 * returns only the advanced_form string.
 *
 * @param string $form_key Form key. Default 'standard'.
 *
 * @return string Advanced form configuration or empty string if not found.
 */
function wpbc_get_form_advanced( $form_key = 'standard' ) {
	$cfg = wpbc_form_config_load( $form_key );

	return ( ! empty( $cfg['advanced_form'] ) ? $cfg['advanced_form'] : '' );
}

/**
 * Get the "content" (fields data) configuration for a given form key.
 *
 * This is a thin convenience wrapper around wpbc_form_config_load() that
 * returns only the content_form string.
 *
 * @param string $form_key Form key. Default 'standard'.
 *
 * @return string Content form configuration or empty string if not found.
 */
function wpbc_get_form_content( $form_key = 'standard' ) {
	$cfg = wpbc_form_config_load( $form_key );

	return ( ! empty( $cfg['content_form'] ) ? $cfg['content_form'] : '' );
}



/**
 * Bridge: implement wpbc_bfb_form_loader_from_builder filter using
 * booking_form_structures table.
 *
 * This function is responsible ONLY for pulling already exported
 * shortcodes/markup from the BFB storage:
 *  - advanced_form  -> "booking form" shortcodes.
 *  - content_form   -> "Content of booking fields data" shortcodes.
 *
 * It does NOT try to interpret structure_json; that is the Builder's job.
 *
 * @since 11.0.0
 */


/**
 * Load form/content from booking_form_structures for the Form Loader.
 *
 * Expected $args keys (normalized by WPBC_BFB_Form_Loader):
 * - form_slug    : string  Logical form key (e.g. 'standard').
 * - form_id      : int     booking_form_id (optional, takes precedence).
 * - status       : string  'published', 'preview', 'draft', ...
 * - resource_id  : int     Booking resource ID (currently informational).
 * - user_id      : int     Current user ID (reserved for future MultiUser).
 *
 * @param array $empty Default empty pair: ['form' => '', 'content' => ''].
 * @param array $args  Loader arguments.
 *
 * @return array Pair ['form' => string, 'content' => string].
 */
function wpbc_bfb__load_from_bfb_table( $empty, $args ) {

	global $wpdb;

	// Ensure we have a consistent empty array.
	if ( ! is_array( $empty ) ) {
		$empty = array(
			'form'    => '',
			'content' => '',
		);
	}

	// Normalized args (defensive).
	$form_id   = isset( $args['form_id'] ) ? intval( $args['form_id'] ) : 0;
	$form_slug = isset( $args['form_slug'] ) ? (string) $args['form_slug'] : '';
	$status    = isset( $args['status'] ) ? strtolower( trim( (string) $args['status'] ) ) : 'published';

	// FixIn: 2026-03-08.
	$has_user_key = array_key_exists( 'user_id', $args );
	$owner_user_id = $has_user_key ? max( 0, (int) $args['user_id'] ) : 0;

	$has_owner_key = array_key_exists( 'owner_user_id', $args );
	$owner_user_id = $has_owner_key ? max( $owner_user_id, (int) $args['owner_user_id'] ) : $owner_user_id;

	$has_owner_key =  $has_user_key || $has_owner_key;

	// -----------------------------------------------------------------
	// Normalize status to match DB semantics.
	// booking_form_structures uses values like: active, preview, draft, archived.
	// -----------------------------------------------------------------
	if ( '' === $status ) {
		$status = 'published';
	} elseif ( in_array( $status, array( 'publish', 'published' ), true ) ) {
		$status = 'published';
	}


	// Nothing to do if we have neither an ID nor a slug.
	if ( $form_id <= 0 && '' === $form_slug ) {
		return $empty;
	}

	// Optional: if helper exists, ensure table really exists.
	if ( function_exists( 'wpbc_is_table_exists' ) && ! wpbc_is_table_exists( 'booking_form_structures' ) ) {
		return $empty;
	}

	// -----------------------------------------------------------------
	// Build SELECT depending on whether form_id is available.
	// -----------------------------------------------------------------
	if ( $form_id > 0 ) {
		// Prefer direct lookup by primary key + status.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT advanced_form, content_form, settings_json
				   FROM {$wpdb->prefix}booking_form_structures
				  WHERE booking_form_id = %d
				    AND status          = %s
				  LIMIT 1", $form_id, $status ) );
	} else {

		if ( $has_owner_key && $owner_user_id > 0 ) {

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$row = $wpdb->get_row( $wpdb->prepare( "SELECT advanced_form, content_form, settings_json
				   FROM {$wpdb->prefix}booking_form_structures
				  WHERE form_slug     = %s
				    AND status        = %s
				    AND owner_user_id = %d
				  ORDER BY version DESC, updated_at DESC, booking_form_id DESC
				  LIMIT 1", $form_slug, $status, $owner_user_id ) );

		} elseif ( $has_owner_key ) {

			// global: 0 or NULL
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$row = $wpdb->get_row( $wpdb->prepare( "SELECT advanced_form, content_form, settings_json
				   FROM {$wpdb->prefix}booking_form_structures
				  WHERE form_slug = %s
				    AND status    = %s
				    AND ( owner_user_id = 0 OR owner_user_id IS NULL )
				  ORDER BY version DESC, updated_at DESC, booking_form_id DESC
				  LIMIT 1", $form_slug, $status ) );

		} else {

			// Legacy behavior: no owner filter at all.
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$row = $wpdb->get_row( $wpdb->prepare( "SELECT advanced_form, content_form, settings_json
				   FROM {$wpdb->prefix}booking_form_structures
				  WHERE form_slug = %s
				    AND status    = %s
				  LIMIT 1", $form_slug, $status ) );
		}
	}


	if ( ! $row ) {
		return $empty;
	}

	// Ensure we always return both keys, even if one is empty.
	$form          = isset( $row->advanced_form ) ? (string) $row->advanced_form : '';
	$content       = isset( $row->content_form ) ? (string) $row->content_form : '';
	$settings_json = isset( $row->settings_json ) ? (string) $row->settings_json : '';

	return array(
		'form'          => $form,
		'content'       => $content,
		'settings_json' => $settings_json,
	);
}

/**
 * Attach loader to wpbc_bfb_form_loader_from_builder.
 */
add_filter( 'wpbc_bfb_form_loader_from_builder', 'wpbc_bfb__load_from_bfb_table', 10, 2 );
