<?php
/**
 * Booking Form Builder - Activation helpers.
 *
 * Responsibilities:
 * 1) Create BFB DB table (wp_booking_form_structures) on activation (if missing).
 * 2) Ensure the "Booking Form Preview" page exists during activation.
 *
 * @package     Booking Calendar.
 * @author      wpdevelop, oplugins
 * @web-site    https://wpbookingcalendar.com/
 * @email       info@wpbookingcalendar.com
 *
 * @since       11.0.x
 * @file        ../includes/page-form-builder/save-load/bfb-activate.php
 * @modified    2026-02-23
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Return option key where preview page ID is stored.
 *
 * Must match WPBC_BFB_Preview_Service::get_page_option_key().
 *
 * @return string
 */
function wpbc_bfb_activation__get_preview_page_option_key() {
	return 'wpbc_bfb_preview_page_id';
}

/**
 * Return meta key used to mark the preview page (for recovery).
 *
 * @return string
 */
function wpbc_bfb_activation__get_preview_page_meta_key() {
	return '_wpbc_bfb_preview_page';
}

/**
 * Return canonical slug for the preview page.
 *
 * @return string
 */
function wpbc_bfb_activation__get_preview_page_slug() {
	return 'wpbc-bfb-preview';
}

/**
 * Try to find an administrator user ID (best-effort).
 *
 * @return int Admin user ID, or 0 if not found.
 */
function wpbc_bfb_activation__get_any_admin_user_id() {

	$users = get_users( array(
		'role'   => 'administrator',
		'number' => 1,
		'fields' => array( 'ID' ),
	) );

	if ( empty( $users ) ) {
		return 0;
	}

	if ( is_object( $users[0] ) && isset( $users[0]->ID ) ) {
		return (int) $users[0]->ID;
	}

	if ( is_array( $users[0] ) && isset( $users[0]['ID'] ) ) {
		return (int) $users[0]['ID'];
	}

	return 0;
}

/**
 * Temporarily switch current user to an admin user if the current user
 * cannot create private pages (activation edge-cases like WP-CLI).
 *
 * @return int Previous user ID (0 if none). Caller should restore with wp_set_current_user().
 */
function wpbc_bfb_activation__maybe_switch_to_admin_user() {

	$prev_user_id = (int) get_current_user_id();

	// If current user can create pages, do nothing.
	if ( $prev_user_id > 0 && user_can( $prev_user_id, 'publish_pages' ) ) {
		return $prev_user_id;
	}

	$admin_id = wpbc_bfb_activation__get_any_admin_user_id();
	if ( $admin_id > 0 ) {
		wp_set_current_user( $admin_id );
	}

	return $prev_user_id;
}

/**
 * Restore previous user after temporary switch.
 *
 * @param int $prev_user_id Previous user ID.
 *
 * @return void
 */
function wpbc_bfb_activation__restore_user( $prev_user_id ) {

	$prev_user_id = (int) $prev_user_id;

	// Restore to previous user if we had one; otherwise, reset to 0.
	if ( $prev_user_id > 0 ) {
		wp_set_current_user( $prev_user_id );
	} else {
		wp_set_current_user( 0 );
	}
}

/**
 * Validate that a page ID is a real WP page.
 *
 * @param int $page_id Page ID.
 *
 * @return bool
 */
function wpbc_bfb_activation__is_valid_page_id( $page_id ) {

	$page_id = (int) $page_id;

	if ( $page_id <= 0 ) {
		return false;
	}

	$page = get_post( $page_id );

	return ( $page instanceof WP_Post && 'page' === $page->post_type );
}

/**
 * Try to locate an existing preview page by meta marker.
 *
 * @return int Page ID or 0.
 */
function wpbc_bfb_activation__find_preview_page_by_meta() {

	$meta_key = wpbc_bfb_activation__get_preview_page_meta_key();

	$q = new WP_Query( array(
		'post_type'        => 'page',
		'post_status'      => array( 'private', 'publish', 'draft', 'pending' ),
		'posts_per_page'   => 1,
		'fields'           => 'ids',
		'no_found_rows'    => true,
		'suppress_filters' => true,          // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.SuppressFilters_suppress_filters
		'meta_key'         => $meta_key,     // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
		'meta_value'       => '1',           // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
	) );

	if ( empty( $q->posts ) ) {
		return 0;
	}

	return (int) $q->posts[0];
}

/**
 * Try to locate an existing preview page by slug.
 *
 * @return int Page ID or 0.
 */
function wpbc_bfb_activation__find_preview_page_by_slug() {

	$slug = wpbc_bfb_activation__get_preview_page_slug();

	$page = get_page_by_path( $slug, OBJECT, 'page' );
	if ( $page instanceof WP_Post ) {
		return (int) $page->ID;
	}

	return 0;
}


/**
 * Force a safe template for the BFB Preview page.
 *
 * Why:
 * - The Preview page is a technical/service page.
 * - It should not inherit decorative page templates like "Page with wide Image".
 * - For block themes, prefer a clean template like "page-no-title" or "page".
 * - For classic themes, use the default page template.  // FixIn: 10.15.2.1
 *
 * @param int $page_id Page ID.
 *
 * @return bool
 */
function wpbc_bfb_preview__force_safe_template( $page_id ) {

	$page_id = absint( $page_id );

	if ( $page_id <= 0 ) {
		return false;
	}

	/*
	 * Always clear any previously assigned template first.
	 * This is important when an existing Preview page was previously using
	 * an unwanted template, for example "Page with wide Image".
	 */
	delete_post_meta( $page_id, '_wp_page_template' );

	// Block themes: prefer a cleaner built-in page template, if available.
	if ( function_exists( 'wp_is_block_theme' ) && wp_is_block_theme() && function_exists( 'get_block_templates' ) ) {

		$theme_slug        = get_stylesheet();
		$templates         = get_block_templates(
			array(
				'post_type' => 'page',
			),
			'wp_template'
		);
		$safe_template_slug = '';

		foreach ( $templates as $template ) {

			if ( empty( $template->slug ) || empty( $template->theme ) ) {
				continue;
			}

			if ( $theme_slug !== $template->theme ) {
				continue;
			}

			if ( 'page-no-title' === $template->slug ) {
				$safe_template_slug = 'page-no-title';
				break;
			}

			if ( ( '' === $safe_template_slug ) && ( 'page' === $template->slug ) ) {
				$safe_template_slug = 'page';
			}
		}

		if ( '' !== $safe_template_slug ) {
			$result = wp_update_post(
				array(
					'ID'            => $page_id,
					'page_template' => $safe_template_slug,
				),
				true
			);

			return ( ! is_wp_error( $result ) );
		}
	}

	return true;
}


/**
 * The preview page has status 'publish', because the secure the output by your nonce + cap
 *
 * Preview security is already enforced by:
 *
 * wpbc_bfb_preview=1 + token + nonce
 *
 * is_user_logged_in() + current_user_can( wpbc_bfb_get_manage_cap() )
 *
 * So the preview page itself does not need to be private.
 *
 * @return false|int
 */
function wpbc_bfb_activation__create_preview_page_raw() {

	$page_data = array(
		'post_title'     => __( 'Booking Form Preview', 'booking' ),
		'post_content'   => '', // Content will be injected dynamically at preview time  by bfb-preview.php.
		'post_status'    => 'publish',
		'post_type'      => 'page',
		'post_name'      => wpbc_bfb_activation__get_preview_page_slug(),
		'comment_status' => 'closed',
		'ping_status'    => 'closed',
	);

	$page_id = wp_insert_post( $page_data, true );

	if ( ( ! is_wp_error( $page_id ) ) && ( ! empty( $page_id ) ) ) {
		// Success.
		wpbc_bfb_preview__force_safe_template( $page_id );
	} else {
		if ( is_wp_error( $page_id ) ) {
			return false;
		}
		if ( ! $page_id ) {
			return false;
		}
		$page_id = false;
	}

	return (int) $page_id;
}


/**
 * Create the "Booking Form Preview" page and store option.
 *
 * @return int|false Page ID on success, false on failure.
 */
function wpbc_bfb_activation__create_preview_page() {

	$prev_user_id = wpbc_bfb_activation__maybe_switch_to_admin_user();

	$page_id = wpbc_bfb_activation__create_preview_page_raw();

	// Restore user context.
	wpbc_bfb_activation__restore_user( $prev_user_id );

	if ( empty( $page_id ) || is_wp_error( $page_id ) ) {
		return false;
	}

	$page_id = (int) $page_id;

	// Mark page for recovery if option is deleted later.
	add_post_meta( $page_id, wpbc_bfb_activation__get_preview_page_meta_key(), '1', true );

	// Store the page ID in option (same key used by preview service).
	update_option( wpbc_bfb_activation__get_preview_page_option_key(), $page_id );

	return $page_id;
}

/**
 * Ensure preview page exists (activation-time).
 *
 * - Validates stored option page ID.
 * - If missing, tries to find by meta marker.
 * - If missing, tries to find by slug.
 * - If still missing, creates a new private page.
 *
 * @return int|false Page ID, or false on failure.
 */
function wpbc_bfb_activation__ensure_preview_page_exists() {

	$option_key = wpbc_bfb_activation__get_preview_page_option_key();
	$page_id    = (int) get_option( $option_key );

	// 1) Option points to a valid page.
	if ( wpbc_bfb_activation__is_valid_page_id( $page_id ) ) {

		// Enforce publish status (best effort).
		$page = get_post( $page_id );
		if ( $page instanceof WP_Post && 'publish' !== $page->post_status ) {
			wp_update_post( array(
				'ID'          => (int) $page_id,
				'post_status' => 'publish',
			) );
		}

		// Ensure meta marker exists.
		wpbc_bfb_preview__force_safe_template( (int) $page_id );
		add_post_meta( (int) $page_id, wpbc_bfb_activation__get_preview_page_meta_key(), '1', true );

		return (int) $page_id;
	}

	// 2) Try recovery by meta marker.
	$found_id = wpbc_bfb_activation__find_preview_page_by_meta();
	if ( $found_id > 0 && wpbc_bfb_activation__is_valid_page_id( $found_id ) ) {
		$found_page = get_post( $found_id );
		if ( $found_page instanceof WP_Post && 'publish' !== $found_page->post_status ) {
			wp_update_post( array(
				'ID'          => (int) $found_id,
				'post_status' => 'publish',
			) );
		}
		wpbc_bfb_preview__force_safe_template( (int) $found_id );
		update_option( $option_key, (int) $found_id );
		return (int) $found_id;
	}

	// 3) Try recovery by slug.
	$found_id = wpbc_bfb_activation__find_preview_page_by_slug();
	if ( $found_id > 0 && wpbc_bfb_activation__is_valid_page_id( $found_id ) ) {
		$found_page = get_post( $found_id );
		if ( $found_page instanceof WP_Post && 'publish' !== $found_page->post_status ) {
			wp_update_post( array(
				'ID'          => (int) $found_id,
				'post_status' => 'publish',
			) );
		}
		wpbc_bfb_preview__force_safe_template( (int) $found_id );
		// Mark it as ours (so next time meta lookup works).
		add_post_meta( (int) $found_id, wpbc_bfb_activation__get_preview_page_meta_key(), '1', true );
		update_option( $option_key, (int) $found_id );
		return (int) $found_id;
	}

	// 4) Create.
	return wpbc_bfb_activation__create_preview_page();
}

/**
 * Activation hook entry: ensure the preview page exists.
 *
 * @return void
 */
function wpbc_bfb_activation__preview_page() {
	wpbc_bfb_activation__ensure_preview_page_exists();
}
add_bk_action( 'wpbc_free_version_activation', 'wpbc_bfb_activation__preview_page' );


/**
 *  A c t i v a t e  - Create new DB Table for Booking Form Builder structures.
 *
 * This table stores:
 *  - Canonical form builder structure as JSON (structure_json).
 *  - Additional settings as JSON (settings_json).
 *  - Optional precompiled HTML can be added later (not in this schema).
 *  - Ownership via owner_user_id (for MultiUser).
 *
 * @return void
 */
function wpbc_bfb_activation__form_structures_table() {

	global $wpdb;

	$charset_collate  = ( ! empty( $wpdb->charset ) ) ? 'DEFAULT CHARACTER SET ' . $wpdb->charset : '';
	$charset_collate .= ( ! empty( $wpdb->collate ) ) ? ' COLLATE ' . $wpdb->collate : '';

	if ( ! wpbc_is_table_exists( 'booking_form_structures' ) ) {



		$simple_sql = "CREATE TABLE {$wpdb->prefix}booking_form_structures (
			booking_form_id bigint(20) unsigned NOT NULL auto_increment,
			form_slug VARCHAR(191) NOT NULL,
			status VARCHAR(32) NOT NULL,
			owner_user_id BIGINT(20) UNSIGNED NOT NULL DEFAULT 0,

			scope varchar(64) NOT NULL default 'global',
			version int(11) NOT NULL default 1,
			booking_resource_id BIGINT UNSIGNED NULL,

			engine varchar(32) NOT NULL default 'bfb',
			engine_version varchar(16) NOT NULL default '1.0',
			structure_json LONGTEXT NOT NULL,
			settings_json LONGTEXT NULL,
			advanced_form LONGTEXT NULL,
			content_form LONGTEXT NULL,

			is_default TINYINT(1) NOT NULL DEFAULT 0,
			title VARCHAR(255) NOT NULL,
			description TEXT NULL,
			picture_url text NULL,

			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,

			created_by bigint(20) unsigned DEFAULT NULL,
			updated_by bigint(20) unsigned DEFAULT NULL,
			PRIMARY KEY  (booking_form_id),
			UNIQUE KEY form_slug_status (form_slug, status, owner_user_id)
		) {$charset_collate}";

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->query( $simple_sql );

		do_action( 'wpbc_bfb_activation__form_structures_table__after_create' );

		wpbc_bfb__import_old_booking_forms();
	} else {
		do_action( 'wpbc_bfb_activation__form_structures_table__table_already_exists' );
	}
}
add_bk_action( 'wpbc_free_version_activation', 'wpbc_bfb_activation__form_structures_table' );


/**
 * D e a c t i v a t e  - Drop Booking Form Builder structures table.
 *
 * @return void
 */
function wpbc_bfb_deactivation__form_structures_table() {

	global $wpdb;



	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}booking_form_structures" );

	delete_bk_option( 'wpbc_bfb_legacy_import_done_for_pro' );
}
add_bk_action( 'wpbc_free_version_deactivation', 'wpbc_bfb_deactivation__form_structures_table' );


/**
 * Import legacy "standard" booking form as initial BFB structure.
 *
 * @return void
 */
function wpbc_bfb__import_old_booking_forms() {

	// Get actual  booking form  structure.
	$builder_structure_arr = wpbc_simple_form__export_to_bfb_structure();

	$resource_id      = wpbc_get_default_resource();  // FixIn: 2026-03-07.
	$formdata         = '';
	$custom_form_name = 'standard';

	$advanced_form = wpbc_get__booking_form_fields__configuration( $resource_id, $custom_form_name );
	$content_form  = wpbc_get__booking_form_data_configuration( $resource_id, $formdata );

	$form_config = array(
		'form_name'           => 'standard',
		'engine'              => 'bfb',
		'engine_version'      => '1.0',
		'structure_json'      => wpbc_form_config__encode_json( $builder_structure_arr ),
		'settings'            => array(),
		'advanced_form'       => $advanced_form,
		'content_form'        => $content_form,
		'owner_user_id'       => 0,
		'title'               => 'Standard',
		'description'         => '',
		'scope'               => 'global',
		'status'              => 'published',
		'is_default'          => 1,
		'booking_resource_id' => null,
	);

	// We do not need to update legacy options (booking_form, etc...) in BFB.
	$sync_legacy = false;
	// == One Saving point ==
	$booking_form_id = wpbc_form_config_save( $form_config, array( 'sync_legacy' => (bool) $sync_legacy ) );

}





/**
 * Import booking forms on activation  of Pro versions of Booking Calendar.
 *
 *    $mode = 'current_context';    // Import booking forms  only  for the == Current User == (usually - "Regular User").
 *    $mode = 'all_global';         // Import booking forms for == Super Booking Admin == user ( user_id = 0 ).  or for pro versions in all  other situations.
 *    $mode = 'all_users';          // Import booking forms for == All Users ==.
 *
 * @return void
 */
function wpbc_bfb_import_legacy_forms__on_activation() {

	if ( ! is_admin() ) {
		return;
	}

	$import_version = '11.0.0';
	if ( $import_version === get_option( 'wpbc_bfb_legacy_import_done_for_pro', '' ) ) {
		return;
	}

	if ( false === ( $is_in_action_late_activation = get_transient( 'wpbc_pro_versions__late_activation_60' ) ) ) {
		return;
	}

	delete_transient( 'wpbc_pro_versions__late_activation_60' );

	$summary = wpbc_bfb_import_legacy_forms(
		array(
			'mode'                     => ( class_exists( 'wpdev_bk_multiuser' ) ) ? 'all_users' : 'all_global',
			'import_standard'          => true,
			'import_custom'            => true,
			'skip_if_exists'           => ( wpbc_is_this_demo() ) ? false : true,
			'set_bfb_form_not_defined' => true,
		)
	);
	update_option( 'wpbc_bfb_legacy_import_done_for_pro', $import_version );
}
add_action( 'init', 'wpbc_bfb_import_legacy_forms__on_activation', 1000 );


/**
 * Schedule one deferred legacy-form import after Pro activation.  The import runs on a later request while this transient exists.
 *
 * @return void
 */
function wpbc_pro_versions__late_activation(){

	// Get any existing copy of our transient data
	if ( false === ( $is_in_action_late_activation = get_transient( 'wpbc_pro_versions__late_activation_60' ) ) ) {
		// It wasn't there, so regenerate the data and save the transient
		$is_in_action_late_activation = true;
		set_transient( 'wpbc_pro_versions__late_activation_60', $is_in_action_late_activation, HOUR_IN_SECONDS );
	}
}
add_bk_action( 'wpbc_other_versions_activation', 'wpbc_pro_versions__late_activation' );
