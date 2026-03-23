<?php
/**
 * Storage of Booking form structure.
 *
 * == Columns (booking_form_structures) ==
 *
 * Identity & keys
 * 		booking_form_id    – primary key.
 * 		form_slug          – machine-readable key/slug, logical identity of form (e.g. 'standard').
 * 		status             – 'published', 'preview', 'draft', 'archived', etc.
 * 		scope              – how this form is used: 'global', 'resource', 'user', 'template', etc.
 * 		version            – integer version for the (form_slug, status) pair; incremented on each save.
 *
 * Context
 * 		booking_resource_id – nullable; if you bind a specific form to a particular booking resource (calendar).
 * 		owner_user_id       – nullable; owner of the form (MultiUser).
 *
 * Engine & payloads
 * 		engine              – engine key: 'bfb', 'legacy_simple', 'legacy_advanced', etc. Default 'bfb'.
 * 		engine_version      – engine version, e.g. '1.0'.
 * 		structure_json      – canonical builder structure (pages -> sections -> columns -> fields).
 * 		settings_json       – extra non-structural options (CSS classes, theme/skin, internal flags, etc.).
 * 		advanced_form       – shortcodes / markup for booking form (optional).
 * 		content_form        – shortcodes / markup for "Content of booking fields data" (optional).
 *
 * Flags & meta
 * 		is_default          – 0/1 flag; default form for a given scope/resource.
 * 		title               – form name shown in admin (e.g., “'Standard'”).
 * 		description         – optional admin description.
 * 		picture_url         – optional image/preview URL.
 *
 * Audit
 * 		created_at          – datetime (site local time).
 * 		updated_at          – datetime (site local time).
 *      created_by          – bigint user ID (creator).
 *      updated_by          – bigint user ID (last editor).
 *
 * Uniqueness
 * 		UNIQUE (form_slug, status) – single row per slug+status pair.
 *
 * @package     Booking Calendar.
 * @author      wpdevelop, oplugins
 * @web-site    https://wpbookingcalendar.com/
 * @email       info@wpbookingcalendar.com
 * @file        ../includes/page-form-builder/save-load/bfb-form-storage.php
 *
 * @since       11.0.0
 * @modified    2025-12-07
 * @version     1.1
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Storage layer for Booking Form Builder configurations.
 *
 * - Stores canonical Builder JSON structure.
 * - Supports per-user ownership via owner_user_id (MultiUser).
 * - Supports status-based variants per form_slug (active/preview/draft).
 */
class WPBC_BFB_Form_Storage {

	/**
	 * Get form row by (form_slug, status, owner_user_id).
	 *
	 * Field owner_user_id:   > 0 : owner-specific row only
	 *                       =  0 : global row (owner_user_id = 0 OR NULL)
	 *
	 * @param string $form_slug
	 * @param string $status
	 * @param int    $owner_user_id
	 *
	 * @return object|null
	 */
	public static function get_form_row_by_key( $form_slug, $status = 'published', $owner_user_id = 0 ) {
		global $wpdb;

		$form_slug     = sanitize_text_field( (string) $form_slug );
		$status        = sanitize_key( (string) $status );
		$owner_user_id = max( 0, (int) $owner_user_id );

		if ( '' === $form_slug ) {
			return null;
		}

		$status = ( in_array( $status, array( 'publish', 'published' ), true ) ) ? 'published' : $status;
		$status = ( 'preview' !== $status ) ? 'published' : $status;

		// If your table still has duplicates (before UNIQUE upgrade), choose newest deterministically.   $order_by = 'ORDER BY version DESC, updated_at DESC, booking_form_id DESC';

		// Regular User in MultiUser version context.
		if ( $owner_user_id > 0 ) {

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			return $wpdb->get_row( $wpdb->prepare( "SELECT *
				   FROM {$wpdb->prefix}booking_form_structures
				  WHERE form_slug      = %s
				    AND status         = %s
				    AND owner_user_id  = %d
				  ORDER BY version DESC, updated_at DESC, booking_form_id DESC
				  LIMIT 1", $form_slug, $status, $owner_user_id ) );
		}

		// Global: owner_user_id=0 OR NULL (migration safe).
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return $wpdb->get_row( $wpdb->prepare( "SELECT *
			   FROM {$wpdb->prefix}booking_form_structures
			  WHERE form_slug = %s
			    AND status    = %s
			    AND ( owner_user_id = 0 OR owner_user_id IS NULL )
			  ORDER BY version DESC, updated_at DESC, booking_form_id DESC
			  LIMIT 1", $form_slug, $status ) );
	}

	/**
	 * Get the current (active) form row by form_slug.
	 *
	 * In MultiUser mode you can pass $user_id to limit search
	 * to forms owned by that user (not implemented yet).
	 *
	 * Note:
	 * - We currently define "current" as the row with status = 'published'
	 *   for a given form_slug.
	 * - Scope and booking_resource_id are not used to distinguish rows
	 *   because the DB constraint is UNIQUE(form_slug, status).
	 *
	 * @param string   $form_slug Form slug.
	 * @param int|bool $user_id   Optional owner user ID (for future use).
	 *
	 * @return object|null
	 */
	public static function get_current_form_by_key( $form_slug, $user_id = 0, $status = 'published' ) {
		global $wpdb;

		$form_slug = sanitize_text_field( (string) $form_slug );
		$status    = sanitize_key( (string) $status );
		$user_id   = max( 0, (int) $user_id );

		if ( '' === $form_slug ) {
			return null;
		}

		if ( $user_id > 0 ) {
			if ( 'template' === $status ) {
				// Exception  for templates loading,  for regular  users.
				$sql = $wpdb->prepare( "SELECT *
				 FROM {$wpdb->prefix}booking_form_structures
				 WHERE form_slug = %s
				   AND status = %s
				   AND ( owner_user_id = %d OR owner_user_id = 0 OR owner_user_id IS NULL )
				 ORDER BY version DESC, updated_at DESC, booking_form_id DESC
				 LIMIT 1", $form_slug, $status, $user_id );
			} else {
				$sql = $wpdb->prepare( "SELECT *
				 FROM {$wpdb->prefix}booking_form_structures
				 WHERE form_slug = %s
				   AND status = %s
				   AND owner_user_id = %d
				 ORDER BY version DESC, updated_at DESC, booking_form_id DESC
				 LIMIT 1", $form_slug, $status, $user_id );
			}
		} else {
			$sql = $wpdb->prepare( "SELECT *
			 FROM {$wpdb->prefix}booking_form_structures
			 WHERE form_slug = %s
			   AND status = %s
			   AND ( owner_user_id = 0 OR owner_user_id IS NULL )
			 ORDER BY version DESC, updated_at DESC, booking_form_id DESC
			 LIMIT 1", $form_slug, $status );
		}

		return $wpdb->get_row( $sql ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
	}

	/**
	 * Update compiled HTML cache for an existing form row.
	 *
	 * NOTE:
	 * The current DB schema example for booking_form_structures does not
	 * yet define compiled_html / compiled_version / compiled_updated_at
	 * columns. To avoid SQL errors, this method currently only bumps
	 * updated_at for the given booking_form_id.
	 *
	 * You can extend the table and this method later when you add
	 * compiled_html support.
	 *
	 * @param int    $booking_form_id  Primary key of the row.
	 * @param string $compiled_html    Precompiled HTML (unused in current schema).
	 * @param int    $compiled_version Optional exporter/schema version (unused).
	 *
	 * @return bool True on success, false on failure.
	 */
	public static function update_compiled_html( $booking_form_id, $compiled_html, $compiled_version = 1 ) {

		global $wpdb;

		$now = current_time( 'mysql' );

		$data = array(
			'updated_at' => $now,
		);

		$where = array(
			'booking_form_id' => intval( $booking_form_id ),
		);

		$data_formats  = array( '%s' );
		$where_formats = array( '%d' );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$updated = $wpdb->update( $wpdb->prefix . 'booking_form_structures', $data, $where, $data_formats, $where_formats );

		if ( false === $updated ) {
			return false;
		}

		return true;
	}

	/**
	 * Insert or update a form row for a given (form_slug, status) pair.
	 *
	 * Behavior with current schema:
	 * - UNIQUE KEY (form_slug, status, owner_user_id) guarantees a single row per
	 *   slug+status.
	 * - On first save for (form_slug, status) -> INSERT with version = 1.
	 * - On subsequent saves -> UPDATE existing row, bumping version.
	 *
	 * @param array $data {
	 *
	 *     @type string $form_slug          Required form slug (logical identity).
	 *                                      Backwards-compat: 'form_key' is also accepted.
	 *     @type string $title              Human-readable title.
	 *     @type string $description        Optional description.
	 *     @type string $scope              Scope, e.g. 'global', 'resource', 'user', 'template'. Default 'global'.
	 *     @type string $status             'published', 'preview', 'draft', 'archived', ... Default 'draft'.
	 *     @type int    $booking_resource_id Optional booking resource ID.
	 *     @type int    $owner_user_id      Optional owner ID (MultiUser). Backwards-compat: 'user_id'.
	 *     @type int    $is_default         1 if default, 0 otherwise.
	 *
	 *     @type string $engine             Engine key: 'bfb', 'legacy_simple', 'legacy_advanced'. Default 'bfb'.
	 *     @type string $engine_version     Engine version. Default '1.0'.
	 *     @type string $structure_json     Canonical JSON structure (required).
	 *     @type string $settings_json      Optional JSON with extra settings.
	 *     @type string $advanced_form      Optional shortcodes string for booking form.
	 *     @type string $content_form       Optional "Content of booking fields data" shortcodes.
	 *     @type string $picture_url        Optional preview image URL.
	 *
	 * @return int|false Booking form ID or false on failure.
	 */
	public static function save_form( $data ) {
		global $wpdb;

		$now        = current_time( 'mysql' );
		$current_id = wpbc_get_current_user_id();

		// -----------------------------------------------------------------
		// Required: form_slug and structure_json
		// -----------------------------------------------------------------
		$form_slug = isset( $data['form_slug'] ) ? $data['form_slug'] : '';
		// Backwards-compat: older callers may still pass 'form_key'.
		if ( '' === $form_slug && isset( $data['form_key'] ) ) {
			$form_slug = $data['form_key'];
		}

		$structure_json = isset( $data['structure_json'] ) ? $data['structure_json'] : wpbc_form_config__encode_json( array() );

		if ( '' === $form_slug || '' === $structure_json ) {
			return false;
		}

		// -----------------------------------------------------------------
		// Optional fields with defaults
		// -----------------------------------------------------------------
		$title       = isset( $data['title'] ) ? $data['title'] : '';
		$description = isset( $data['description'] ) ? $data['description'] : '';
		$scope       = isset( $data['scope'] ) ? $data['scope'] : 'global';
		$status      = isset( $data['status'] ) ? $data['status'] : 'draft';

		$booking_resource_id = isset( $data['booking_resource_id'] ) ? intval( $data['booking_resource_id'] ) : null;

		// Owner user ID: prefer explicit owner_user_id, fall back to user_id, then current user.
		if ( isset( $data['owner_user_id'] ) ) {
			$owner_user_id = intval( $data['owner_user_id'] );
		} elseif ( isset( $data['user_id'] ) ) {
			$owner_user_id = intval( $data['user_id'] );
		} else {
			$owner_user_id = $current_id ? $current_id : 0;
		}
		$owner_user_id = (int) $owner_user_id;
		if ( $owner_user_id < 0 ) {
			$owner_user_id = 0;
		}

		$is_default = ! empty( $data['is_default'] ) ? 1 : 0;

		$settings_json  = isset( $data['settings_json'] ) ? $data['settings_json'] : null;
		$engine         = isset( $data['engine'] ) ? $data['engine'] : 'bfb';
		$engine_version = isset( $data['engine_version'] ) ? $data['engine_version'] : '1.0';
		$advanced_form  = isset( $data['advanced_form'] ) ? $data['advanced_form'] : null;
		$content_form   = isset( $data['content_form'] ) ? $data['content_form'] : null;
		$picture_url    = isset( $data['picture_url'] ) ? $data['picture_url'] : null;

		// -----------------------------------------------------------------
		// 1) Try to find existing row for this (form_slug, status) pair. Because of UNIQUE(form_slug, status, $owner_user_id), this will be at most one row.
		// -----------------------------------------------------------------
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$existing = $wpdb->get_row( $wpdb->prepare( "SELECT *
			   FROM {$wpdb->prefix}booking_form_structures
			  WHERE form_slug = %s
				AND status    = %s
				AND owner_user_id = %d
			  LIMIT 1", $form_slug, $status, $owner_user_id ) );

		if ( $existing ) {
			// --- UPDATE existing row ---------------------------------------------------------------
			$booking_form_id = intval( $existing->booking_form_id );
			$version         = intval( $existing->version );
			$version         = ( $version > 0 ) ? ( $version + 1 ) : 1;

			$update_data = array(
				'title'               => $title,
				'description'         => $description,
				'scope'               => $scope,
				'status'              => $status,
				'version'             => $version,
				'booking_resource_id' => $booking_resource_id,
				'owner_user_id'       => $owner_user_id,
				'engine'              => $engine,
				'engine_version'      => $engine_version,
				'structure_json'      => $structure_json,
				'settings_json'       => $settings_json,
				'advanced_form'       => $advanced_form,
				'content_form'        => $content_form,
				'is_default'          => $is_default,
				'picture_url'         => $picture_url,
				'updated_at'          => $now,
				'updated_by'          => $current_id ? $current_id : null,
			);

			$update_formats = array(
				'%s', // title.
				'%s', // description.
				'%s', // scope.
				'%s', // status.
				'%d', // version.
				'%d', // booking_resource_id.
				'%d', // owner_user_id.
				'%s', // engine.
				'%s', // engine_version.
				'%s', // structure_json.
				'%s', // settings_json.
				'%s', // advanced_form.
				'%s', // content_form.
				'%d', // is_default.
				'%s', // picture_url.
				'%s', // updated_at.
				'%d', // updated_by.
			);

			$where         = array( 'booking_form_id' => $booking_form_id );
			$where_formats = array( '%d' );

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$updated = $wpdb->update( $wpdb->prefix . 'booking_form_structures', $update_data, $where, $update_formats, $where_formats );

			if ( false === $updated ) {
				return false;
			}

			return $booking_form_id;
		}

		// -----------------------------------------------------------------
		// 2) No row yet – INSERT first version for this (form_slug, status)
		// -----------------------------------------------------------------
		$version = 1;

		$insert_data = array(
			'form_slug'           => $form_slug,
			'status'              => $status,
			'scope'               => $scope,
			'version'             => $version,
			'booking_resource_id' => $booking_resource_id,
			'owner_user_id'       => $owner_user_id,
			'engine'              => $engine,
			'engine_version'      => $engine_version,
			'structure_json'      => $structure_json,
			'settings_json'       => $settings_json,
			'advanced_form'       => $advanced_form,
			'content_form'        => $content_form,
			'is_default'          => $is_default,
			'title'               => $title,
			'description'         => $description,
			'picture_url'         => $picture_url,
			'created_at'          => $now,
			'updated_at'          => $now,
			'created_by'          => $current_id ? $current_id : null,
			'updated_by'          => $current_id ? $current_id : null,
		);

		$insert_formats = array(
			'%s', // form_slug.
			'%s', // status.
			'%s', // scope.
			'%d', // version.
			'%d', // booking_resource_id.
			'%d', // owner_user_id.
			'%s', // engine.
			'%s', // engine_version.
			'%s', // structure_json.
			'%s', // settings_json.
			'%s', // advanced_form.
			'%s', // content_form.
			'%d', // is_default.
			'%s', // title.
			'%s', // description.
			'%s', // picture_url.
			'%s', // created_at.
			'%s', // updated_at.
			'%d', // created_by.
			'%d', // updated_by.
		);

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$inserted = $wpdb->insert( $wpdb->prefix . 'booking_form_structures', $insert_data, $insert_formats );

		if ( false === $inserted ) {
			return false;
		}
		return intval( $wpdb->insert_id );
	}
}
