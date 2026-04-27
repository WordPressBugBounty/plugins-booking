<?php
/**
 * Booking Form Builder - Bundled templates activation/update helpers.
 *
 * Responsibilities:
 * - Register bundled BFB templates.
 * - Seed missing template records into wp_booking_form_structures.
 * - Track per-template seed versions.
 * - Optionally update bundled template rows in future releases.
 *
 * @package     Booking Calendar
 * @author      wpdevelop, oplugins
 * @web-site    https://wpbookingcalendar.com/
 * @email       info@wpbookingcalendar.com
 *
 * @since       11.0.x
 * @file        ../includes/page-form-builder/assets/template-records/bfb-activate-templates.php
 * @modified    2026-03-09
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Return option key storing bundled templates seed state.
 *
 * Stored value example:
 * array(
 *     'service_appointments' => '11.0.0',
 *     'contact_inquiry'      => '11.1.0',
 * )
 *
 * @return string
 */
function wpbc_bfb_activation__get_templates_seed_state_option_key() {
	return 'wpbc_bfb_templates_seed_state';
}

/**
 * Get stored bundled templates seed state.
 *
 * @return array
 */
function wpbc_bfb_activation__get_templates_seed_state() {

	$state = get_option( wpbc_bfb_activation__get_templates_seed_state_option_key(), array() );

	return ( is_array( $state ) ) ? $state : array();
}

/**
 * Save bundled templates seed state.
 *
 * @param array $state Seed state.
 *
 * @return void
 */
function wpbc_bfb_activation__save_templates_seed_state( $state ) {

	if ( ! is_array( $state ) ) {
		$state = array();
	}

	update_option( wpbc_bfb_activation__get_templates_seed_state_option_key(), $state );
}

/**
 * Delete bundled templates seed state.
 *
 * @return void
 */
function wpbc_bfb_activation__delete_templates_seed_state() {
	delete_bk_option( wpbc_bfb_activation__get_templates_seed_state_option_key() );
}

/**
 * Return absolute path to bundled template records directory.
 *
 * @return string
 */
function wpbc_bfb_activation__get_templates_dir_path() {

	// return dirname( __FILE__ ); // . '/../assets/template-records'; //.

	return WPBC_PLUGIN_DIR . '/includes/page-form-builder/assets/template-records';
}

/**
 * Return bundled template registry.
 *
 * Each item must return:
 * array(
 *     'template_key' => 'service_appointments',
 *     'seed_version' => '11.0.0',
 *     'sync_mode'    => 'insert_only', // or 'upsert'
 *     'record'       => array( ... DB columns ... ),
 * )
 *
 * Notes:
 * - template_key must stay stable across releases.
 * - seed_version is compared against stored seed state for this template.
 * - sync_mode:
 *     - insert_only = insert once if missing, never overwrite existing row.
 *     - upsert      = insert if missing, update existing row when seed_version increases.
 *
 * @return array
 */
function wpbc_bfb_activation__get_templates_registry() {

	$templates      = array();
	$template_files = array(

		// Contact Forms.
		wpbc_bfb_activation__get_templates_dir_path() . '/contact_form_simple.php',
		wpbc_bfb_activation__get_templates_dir_path() . '/technical_support_form.php',
		wpbc_bfb_activation__get_templates_dir_path() . '/inquiry_form_simple.php',

		// Advanced Not Synced Forms.
		wpbc_bfb_activation__get_templates_dir_path() . '/dates_advanced_2_steps_wizard_with_hints.php',
		wpbc_bfb_activation__get_templates_dir_path() . '/dates_advanced_form_with_hints.php',

		// Time Slots.
		wpbc_bfb_activation__get_templates_dir_path() . '/time_slots_start_end_times_1_hour_selection.php',
		wpbc_bfb_activation__get_templates_dir_path() . '/time_slots_start_duration_times_selection.php',
		wpbc_bfb_activation__get_templates_dir_path() . '/time_slots_30_min_2_steps_wizard.php',
		wpbc_bfb_activation__get_templates_dir_path() . '/time_slots_20_min_2_steps_wizard.php',

		// Time - Service Appointments.
		wpbc_bfb_activation__get_templates_dir_path() . '/time_appointments_3_steps_wizard.php',
		wpbc_bfb_activation__get_templates_dir_path() . '/time_appointments_2_steps_vertical_layout.php',
		wpbc_bfb_activation__get_templates_dir_path() . '/time_appointments_2_steps_wizard.php',

		// Full Day - Booking Forms.
		wpbc_bfb_activation__get_templates_dir_path() . '/dates_form_with_3_columns_layout.php',
		wpbc_bfb_activation__get_templates_dir_path() . '/dates_form_with_calendar_next_to_form.php',
		wpbc_bfb_activation__get_templates_dir_path() . '/dates_form_with_vertical_layout.php',
		wpbc_bfb_activation__get_templates_dir_path() . '/dates_form_wizard_2_steps.php',

		// Hints
		wpbc_bfb_activation__get_templates_dir_path() . '/time_slots_20_min_3_steps_review_with_hints.php',
		wpbc_bfb_activation__get_templates_dir_path() . '/time_appointments_3_steps_review_with_hints.php',
		wpbc_bfb_activation__get_templates_dir_path() . '/dates_advanced_3_steps_review_with_hints.php',

		// Example future records:
		// wpbc_bfb_activation__get_templates_dir_path() . '/template-contact-inquiry.php',
		// wpbc_bfb_activation__get_templates_dir_path() . '/template-event-registration.php',
	);

	foreach ( $template_files as $template_file ) {
		if ( file_exists( $template_file ) ) {
			$template_config = require $template_file;

			if ( is_array( $template_config ) ) {
				$templates[] = $template_config;
			}
		}
	}

	/**
	 * Allow third-party code or future modules to register bundled templates.
	 */
	$templates = apply_filters( 'wpbc_bfb_activation__templates_registry', $templates );

	return $templates;
}

/**
 * Normalize bundled template config.
 *
 * @param array $template_config Raw template config.
 *
 * @return array
 */
function wpbc_bfb_activation__normalize_template_config( $template_config ) {

	$template_config = wp_parse_args(
		$template_config,
		array(
			'template_key' => '',
			'seed_version' => '1.0.0',
			'sync_mode'    => 'insert_only',
			'record'       => array(),
		)
	);

	$template_config['template_key'] = sanitize_key( $template_config['template_key'] );
	$template_config['seed_version'] = (string) $template_config['seed_version'];
	$template_config['sync_mode']    = ( 'upsert' === $template_config['sync_mode'] ) ? 'upsert' : 'insert_only';

	$template_config['record'] = wp_parse_args(
		$template_config['record'],
		array(
			'form_slug'           => '',
			'status'              => 'template',
			'scope'               => 'global',
			'version'             => 1,
			'booking_resource_id' => null,
			'owner_user_id'       => 0,
			'engine'              => 'bfb',
			'engine_version'      => '1.0',
			'structure_json'      => '',
			'settings_json'       => '',
			'advanced_form'       => '',
			'content_form'        => '',
			'is_default'          => 0,
			'title'               => '',
			'description'         => '',
			'picture_url'         => '',
		)
	);

	$template_config['record']['form_slug']      = sanitize_title( $template_config['record']['form_slug'] );
	$template_config['record']['status']         = sanitize_key( $template_config['record']['status'] );
	$template_config['record']['scope']          = sanitize_key( $template_config['record']['scope'] );
	$template_config['record']['version']        = (int) $template_config['record']['version'];
	$template_config['record']['owner_user_id']  = (int) $template_config['record']['owner_user_id'];
	$template_config['record']['is_default']     = (int) $template_config['record']['is_default'];
	$template_config['record']['engine']         = (string) $template_config['record']['engine'];
	$template_config['record']['engine_version'] = (string) $template_config['record']['engine_version'];
	$template_config['record']['title']          = (string) $template_config['record']['title'];
	$template_config['record']['description']    = (string) $template_config['record']['description'];
	$template_config['record']['picture_url']    = (string) $template_config['record']['picture_url'];

	if ( null !== $template_config['record']['booking_resource_id'] ) {
		$template_config['record']['booking_resource_id'] = (int) $template_config['record']['booking_resource_id'];
	}

	return $template_config;
}

/**
 * Find existing bundled template row by unique fields.
 *
 * @param array $record Template DB record.
 *
 * @return int
 */
function wpbc_bfb_activation__find_existing_template_id( $record ) {

	global $wpdb;

	// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	$existing_id = (int) $wpdb->get_var( $wpdb->prepare(
		"SELECT booking_form_id
			 FROM {$wpdb->prefix}booking_form_structures
			 WHERE form_slug = %s
			   AND status = %s
			   AND owner_user_id = %d
			 LIMIT 1",
		$record['form_slug'],
		$record['status'],
		(int) $record['owner_user_id']
	) );

	return $existing_id;
}

/**
 * Build DB row for insert/update.
 *
 * @param array $record Template DB record.
 *
 * @return array
 */
function wpbc_bfb_activation__build_template_db_row( $record ) {

	$now = current_time( 'mysql' );

	return array(
		'form_slug'           => $record['form_slug'],
		'status'              => $record['status'],
		'scope'               => $record['scope'],
		'version'             => (int) $record['version'],
		'booking_resource_id' => $record['booking_resource_id'],
		'owner_user_id'       => (int) $record['owner_user_id'],
		'engine'              => $record['engine'],
		'engine_version'      => $record['engine_version'],
		'structure_json'      => $record['structure_json'],
		'settings_json'       => $record['settings_json'],
		'advanced_form'       => $record['advanced_form'],
		'content_form'        => $record['content_form'],
		'is_default'          => (int) $record['is_default'],
		'title'               => $record['title'],
		'description'         => $record['description'],
		'picture_url'         => $record['picture_url'],
		'updated_at'          => $now,
		'updated_by'          => 0,
	);
}

/**
 * Insert bundled template record.
 *
 * @param array $record Template DB record.
 *
 * @return bool
 */
function wpbc_bfb_activation__insert_template_record( $record ) {

	global $wpdb;

	$table_name = $wpdb->prefix . 'booking_form_structures';
	$data       = wpbc_bfb_activation__build_template_db_row( $record );

	$data['created_at'] = $data['updated_at'];
	$data['created_by'] = 0;
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	$inserted = $wpdb->insert( $table_name, $data );

	return ( false !== $inserted );
}

/**
 * Update bundled template record by row ID.
 *
 * @param int   $booking_form_id Existing row ID.
 * @param array $record          Template DB record.
 *
 * @return bool
 */
function wpbc_bfb_activation__update_template_record( $booking_form_id, $record ) {

	global $wpdb;

	$table_name      = $wpdb->prefix . 'booking_form_structures';
	$booking_form_id = (int) $booking_form_id;
	$data            = wpbc_bfb_activation__build_template_db_row( $record );

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	$updated = $wpdb->update(
		$table_name,
		$data,
		array(
			'booking_form_id' => $booking_form_id,
		)
	);

	return ( false !== $updated );
}

/**
 * Sync one bundled template.
 *
 * @param array $template_config Template config.
 * @param array $seed_state      Current stored seed state.
 *
 * @return array
 */
/**
 * Sync one bundled template.
 *
 * @param array $template_config Template config.
 * @param array $seed_state      Current stored seed state.
 *
 * @return array
 */
function wpbc_bfb_activation__sync_one_template( $template_config, $seed_state ) {

	$result = array(
		'ok'         => false,
		'seed_state' => $seed_state,
	);

	$template_config = wpbc_bfb_activation__normalize_template_config( $template_config );

	if ( empty( $template_config['template_key'] ) ) {
		return $result;
	}

	if ( empty( $template_config['record']['form_slug'] ) ) {
		return $result;
	}

	$template_key    = $template_config['template_key'];
	$seed_version    = $template_config['seed_version'];
	$sync_mode       = $template_config['sync_mode'];
	$record          = $template_config['record'];
	$stored_version  = isset( $seed_state[ $template_key ] ) ? (string) $seed_state[ $template_key ] : '';
	$existing_row_id = wpbc_bfb_activation__find_existing_template_id( $record );

	// Already synced for this template version and DB row still exists.
	if (
		( $existing_row_id > 0 ) &&
		( ! empty( $stored_version ) ) &&
		version_compare( $stored_version, $seed_version, '>=' )
	) {
		$result['ok'] = true;
		return $result;
	}

	// Insert if missing.
	if ( $existing_row_id <= 0 ) {
		$result['ok'] = wpbc_bfb_activation__insert_template_record( $record );

		if ( $result['ok'] ) {
			$result['seed_state'][ $template_key ] = $seed_version;
		}

		return $result;
	}

	// Existing row found.
	if ( 'upsert' === $sync_mode ) {
		$result['ok'] = wpbc_bfb_activation__update_template_record( $existing_row_id, $record );
	} else {
		// insert_only mode: mark as synced, do not overwrite existing row.
		$result['ok'] = true;
	}

	if ( $result['ok'] ) {
		$result['seed_state'][ $template_key ] = $seed_version;
	}

	return $result;
}

/**
 * Seed bundled BFB templates.
 *
 * Runs both:
 * - after table creation,
 * - when table already exists.
 *
 * @return void
 */
/**
 * Seed bundled BFB templates.
 *
 * Runs both:
 * - after table creation,
 * - when table already exists.
 *
 * @return void
 */
function wpbc_bfb_activation__seed_templates() {

	if ( ! wpbc_is_table_exists( 'booking_form_structures' ) ) {
		return;
	}

	$templates = wpbc_bfb_activation__get_templates_registry();
	if ( empty( $templates ) || ! is_array( $templates ) ) {
		return;
	}

	$seed_state = wpbc_bfb_activation__get_templates_seed_state();
	$is_changed = false;

	foreach ( $templates as $template_config ) {

		$seed_state_before = $seed_state;

		$sync_result = wpbc_bfb_activation__sync_one_template( $template_config, $seed_state );
		$seed_state  = $sync_result['seed_state'];

		if ( $seed_state !== $seed_state_before ) {
			$is_changed = true;
		}
	}

	if ( $is_changed ) {
		wpbc_bfb_activation__save_templates_seed_state( $seed_state );
	}
}
add_action( 'wpbc_bfb_activation__form_structures_table__after_create', 'wpbc_bfb_activation__seed_templates' );
add_action( 'wpbc_bfb_activation__form_structures_table__table_already_exists', 'wpbc_bfb_activation__seed_templates' );

/**
 * Cleanup bundled templates seed state on deactivation.
 *
 * @return void
 */
function wpbc_bfb_activation__cleanup_templates_seed_state_on_deactivation() {
	wpbc_bfb_activation__delete_templates_seed_state();
}
add_bk_action( 'wpbc_free_version_deactivation', 'wpbc_bfb_activation__cleanup_templates_seed_state_on_deactivation' );