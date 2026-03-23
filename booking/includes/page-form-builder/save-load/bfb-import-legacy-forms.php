<?php
/**
 * Booking Calendar - Legacy Forms Importer -> booking_form_structures.
 *
 * Purpose:
 * - Import legacy booking forms from:
 *   - global options
 *   - booking_forms_extended
 *   - MultiUser regular user user_meta
 * - Materialize them into booking_form_structures as canonical FormConfig rows.
 *
 * Supported cases:
 * - Standard form from:
 *   - booking_form_visual
 *   - booking_form
 *   - booking_form_show
 * - Custom forms from:
 *   - booking_forms_extended
 *
 * Strategy:
 * - If legacy form has Simple Form structure -> import as engine = 'bfb'
 * - If legacy form has only Advanced Form    -> import as engine = 'legacy_advanced'
 *   with EMPTY Builder structure.
 *
 * Notes:
 * - Free version:
 *   - Simple Form is converted into real BFB structure.
 * - Paid versions:
 *   - Advanced Form is imported without BFB structure yet.
 *   - Only advanced_form + content_form are imported.
 *
 * @package     Booking Calendar
 * @subpackage  Form Builder
 *
 * @since 11.0.0
 * @file  ../includes/page-form-builder/save-load/bfb-import-legacy-forms.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Get legacy option value for global or user owner context.
 *
 * @param string $option_name
 * @param int    $owner_user_id
 *
 * @return mixed
 */
function wpbc_bfb_get_legacy_option_value( $option_name, $owner_user_id = 0 ) {

	$option_name   = (string) $option_name;
	$owner_user_id = absint( $owner_user_id );

	if ( $owner_user_id > 0 ) {
		return get_user_option( $option_name, $owner_user_id );
	}

	return get_bk_option( $option_name );
}

/**
 * Check whether legacy form data is effectively empty.
 *
 * @param array $legacy_form
 *
 * @return bool
 */
function wpbc_bfb_is_empty_legacy_form( $legacy_form ) {

	$visual        = isset( $legacy_form['visual'] ) ? $legacy_form['visual'] : array();
	$advanced_form = isset( $legacy_form['advanced_form'] ) ? (string) $legacy_form['advanced_form'] : '';
	$content_form  = isset( $legacy_form['content_form'] ) ? (string) $legacy_form['content_form'] : '';

	$has_visual = ( is_array( $visual ) && ! empty( $visual ) );
	$has_adv    = ( '' !== trim( $advanced_form ) );
	$has_cnt    = ( '' !== trim( $content_form ) );

	return ( ! $has_visual && ! $has_adv && ! $has_cnt );
}

/**
 * Get normalized legacy standard form for specific owner.
 *
 * @param int $owner_user_id
 *
 * @return array|null
 */
function wpbc_bfb_get_legacy_standard_form_for_owner( $owner_user_id = 0 ) {

	$owner_user_id = absint( $owner_user_id );

	$advanced_form = wpbc_bfb_get_legacy_option_value( 'booking_form', $owner_user_id );
	$content_form  = wpbc_bfb_get_legacy_option_value( 'booking_form_show', $owner_user_id );
	$visual        = wpbc_bfb_get_legacy_option_value( 'booking_form_visual', $owner_user_id );

	$visual = maybe_unserialize( $visual );
	if ( ! is_array( $visual ) ) {
		$visual = array();
	}

	$legacy_engine = 'legacy_advanced';
	if ( ! empty( $visual ) ) {
		$legacy_engine = 'legacy_simple';
	}

	$legacy_form = array(
		'form_name'           => 'standard',
		'title'               => __( 'Standard', 'booking' ),
		'description'         => '',
		'picture_url'         => '',
		'owner_user_id'       => $owner_user_id,
		'is_default'          => 1,
		'booking_resource_id' => null,
		'legacy_engine'       => $legacy_engine,
		'visual'              => $visual,
		'advanced_form'       => (string) $advanced_form,
		'content_form'        => (string) $content_form,
	);

	if ( wpbc_bfb_is_empty_legacy_form( $legacy_form ) ) {
		return null;
	}

	return $legacy_form;
}

/**
 * Get normalized legacy custom forms for specific owner.
 *
 * @param int $owner_user_id
 *
 * @return array
 */
function wpbc_bfb_get_legacy_custom_forms_for_owner( $owner_user_id = 0 ) {

	$owner_user_id = absint( $owner_user_id );

	$extended = wpbc_bfb_get_legacy_option_value( 'booking_forms_extended', $owner_user_id );
	$extended = maybe_unserialize( $extended );

	if ( ! is_array( $extended ) || empty( $extended ) ) {
		return array();
	}

	$forms = array();

	foreach ( $extended as $one ) {

		if ( ! is_array( $one ) ) {
			continue;
		}

		$form_name = isset( $one['name'] ) ? sanitize_text_field( (string) $one['name'] ) : '';
		if ( '' === $form_name || 'standard' === $form_name ) {
			continue;
		}

		$visual = isset( $one['simple_form'] ) ? $one['simple_form'] : array();
		$visual = maybe_unserialize( $visual );
		if ( ! is_array( $visual ) ) {
			$visual = array();
		}

		$legacy_engine = 'legacy_advanced';
		if ( ! empty( $visual ) ) {
			$legacy_engine = 'legacy_simple';
		}

		$legacy_form = array(
			'form_name'           => $form_name,
			'title'               => isset( $one['title'] ) ? sanitize_text_field( (string) $one['title'] ) : $form_name,
			'description'         => isset( $one['description'] ) ? sanitize_textarea_field( (string) $one['description'] ) : '',
			'picture_url'         => '',
			'owner_user_id'       => $owner_user_id,
			'is_default'          => ! empty( $one['is_default'] ) ? 1 : 0,
			'booking_resource_id' => isset( $one['booking_resource_id'] ) ? absint( $one['booking_resource_id'] ) : null,
			'legacy_engine'       => $legacy_engine,
			'visual'              => $visual,
			'advanced_form'       => isset( $one['form'] ) ? (string) $one['form'] : '',
			'content_form'        => isset( $one['content'] ) ? (string) $one['content'] : '',
		);

		if ( wpbc_bfb_is_empty_legacy_form( $legacy_form ) ) {
			continue;
		}

		$forms[] = $legacy_form;
	}

	return $forms;
}

/**
 * Get all legacy forms for specific owner.
 *
 * @param int  $owner_user_id
 * @param bool $import_standard
 * @param bool $import_custom
 *
 * @return array
 */
function wpbc_bfb_get_legacy_forms_for_owner( $owner_user_id = 0, $import_standard = true, $import_custom = true ) {

	$forms = array();

	if ( $import_standard ) {
		$standard_form = wpbc_bfb_get_legacy_standard_form_for_owner( $owner_user_id );
		if ( ! empty( $standard_form ) ) {
			$forms[] = $standard_form;
		}
	}

	if ( $import_custom ) {
		$custom_forms = wpbc_bfb_get_legacy_custom_forms_for_owner( $owner_user_id );
		if ( ! empty( $custom_forms ) ) {
			$forms = array_merge( $forms, $custom_forms );
		}
	}

	return $forms;
}

/**
 * Build normalized settings for imported legacy form.
 *
 * @param string $legacy_engine
 *
 * @return array
 */
function wpbc_bfb_get_imported_settings_for_legacy_engine( $legacy_engine ) {

	$advanced_mode_source = 'advanced';

	if ( 'legacy_simple' === $legacy_engine ) {
		$advanced_mode_source = 'auto';
	}

	return wpbc_bfb__normalize_settings_array(
		array(
			'options'     => array(),
			'css_vars'    => array(),
			'bfb_options' => array(
				'advanced_mode_source' => $advanced_mode_source,
			),
		)
	);
}

/**
 * Build FormConfig array from normalized legacy form.
 *
 * Important:
 * - legacy_simple   -> create real BFB structure and store as engine = 'bfb'
 * - legacy_advanced -> DO NOT create BFB structure yet; store empty structure_json
 *
 * @param array $legacy_form
 *
 * @return array
 */
function wpbc_bfb_build_form_config_from_legacy_form( $legacy_form, $args ) {

	$args = wp_parse_args(
		$args,
		array(
			'skip_if_exists'           => true,
			'set_bfb_form_not_defined' => true,
		)
	);

	$legacy_engine = isset( $legacy_form['legacy_engine'] ) ? (string) $legacy_form['legacy_engine'] : 'legacy_advanced';
	$visual        = isset( $legacy_form['visual'] ) ? $legacy_form['visual'] : array();

	$engine         = 'legacy_advanced';
	$engine_version = '1.0';
	$structure_json = wpbc_form_config__encode_json( array() );

	if ( ( ! $args['set_bfb_form_not_defined'] ) && ( 'legacy_simple' === $legacy_engine ) ) {

		$engine        = 'bfb';
		$structure_arr = wpbc_simple_form__export_to_bfb_structure( $visual );

		if ( empty( $structure_arr ) || ! is_array( $structure_arr ) ) {
			$structure_arr = wpbc_bfb__get_blank_structure_seed();
		}

		$structure_json = wpbc_form_config__encode_json( $structure_arr );
	}

	return array(
		'form_name'           => isset( $legacy_form['form_name'] ) ? (string) $legacy_form['form_name'] : 'standard',
		'engine'              => $engine,
		'engine_version'      => $engine_version,
		'structure_json'      => $structure_json,
		'settings'            => wpbc_bfb_get_imported_settings_for_legacy_engine( $legacy_engine ),
		'advanced_form'       => isset( $legacy_form['advanced_form'] ) ? (string) $legacy_form['advanced_form'] : '',
		'content_form'        => isset( $legacy_form['content_form'] ) ? (string) $legacy_form['content_form'] : '',
		'owner_user_id'       => isset( $legacy_form['owner_user_id'] ) ? absint( $legacy_form['owner_user_id'] ) : 0,
		'title'               => isset( $legacy_form['title'] ) ? (string) $legacy_form['title'] : '',
		'description'         => isset( $legacy_form['description'] ) ? (string) $legacy_form['description'] : '',
		'picture_url'         => isset( $legacy_form['picture_url'] ) ? (string) $legacy_form['picture_url'] : '',
		'scope'               => 'global',
		'status'              => 'published',
		'is_default'          => ! empty( $legacy_form['is_default'] ) ? 1 : 0,
		'booking_resource_id' => isset( $legacy_form['booking_resource_id'] ) ? $legacy_form['booking_resource_id'] : null,
	);
}

/**
 * Import one normalized legacy form into booking_form_structures.
 *
 * @param array $legacy_form
 * @param array $args
 *
 * @return array
 */
function wpbc_bfb_import_one_legacy_form( $legacy_form, $args = array() ) {

	$args = wp_parse_args(
		$args,
		array(
			'skip_if_exists'           => true,
			'set_bfb_form_not_defined' => true,
		)
	);

	$form_name     = isset( $legacy_form['form_name'] ) ? (string) $legacy_form['form_name'] : '';
	$owner_user_id = isset( $legacy_form['owner_user_id'] ) ? absint( $legacy_form['owner_user_id'] ) : 0;

	if ( '' === $form_name ) {
		return array(
			'status'  => 'error',
			'message' => __( 'Missing form name.', 'booking' ),
		);
	}

	$is_fallback_to_legacy = false;
	$existing              = wpbc_form_config_load( $form_name, $owner_user_id, 'published', $is_fallback_to_legacy );

	if ( ! empty( $existing ) && ! empty( $args['skip_if_exists'] ) ) {
		return array(
			'status'           => 'skipped',
			'form_name'        => $form_name,
			'owner_user_id'    => $owner_user_id,
			'booking_form_id'  => isset( $existing['id'] ) ? absint( $existing['id'] ) : 0,
			'imported_engine'  => isset( $existing['engine'] ) ? (string) $existing['engine'] : '',
			'legacy_engine'    => isset( $legacy_form['legacy_engine'] ) ? (string) $legacy_form['legacy_engine'] : '',
		);
	}

	$form_config = wpbc_bfb_build_form_config_from_legacy_form( $legacy_form, $args );
	$sync_legacy = false;

	$booking_form_id = wpbc_form_config_save(
		$form_config,
		array(
			'sync_legacy' => (bool) $sync_legacy,
		)
	);

	if ( ! $booking_form_id ) {
		return array(
			'status'        => 'error',
			'form_name'     => $form_name,
			'owner_user_id' => $owner_user_id,
			'legacy_engine' => isset( $legacy_form['legacy_engine'] ) ? (string) $legacy_form['legacy_engine'] : '',
			'message'       => __( 'Error saving imported legacy form.', 'booking' ),
		);
	}

	return array(
		'status'           => 'imported',
		'form_name'        => $form_name,
		'owner_user_id'    => $owner_user_id,
		'booking_form_id'  => absint( $booking_form_id ),
		'imported_engine'  => isset( $form_config['engine'] ) ? (string) $form_config['engine'] : '',
		'legacy_engine'    => isset( $legacy_form['legacy_engine'] ) ? (string) $legacy_form['legacy_engine'] : '',
	);
}

/**
 * Import legacy forms for one owner.
 *
 * @param int   $owner_user_id
 * @param array $args
 *
 * @return array
 */
function wpbc_bfb_import_legacy_forms_for_owner( $owner_user_id = 0, $args = array() ) {

	$args = wp_parse_args(
		$args,
		array(
			'import_standard'          => true,
			'import_custom'            => true,
			'skip_if_exists'           => true,
			'set_bfb_form_not_defined' => true,
		)
	);

	$owner_user_id = absint( $owner_user_id );
	$legacy_forms  = wpbc_bfb_get_legacy_forms_for_owner( $owner_user_id, $args['import_standard'], $args['import_custom'] );

	$result = array(
		'owner_user_id' => $owner_user_id,
		'imported'      => 0,
		'skipped'       => 0,
		'errors'        => 0,
		'items'         => array(),
	);

	foreach ( $legacy_forms as $legacy_form ) {

		$item_result = wpbc_bfb_import_one_legacy_form( $legacy_form, $args );
		$result['items'][] = $item_result;

		switch ( $item_result['status'] ) {
			case 'imported':
				++$result['imported'];
				break;
			case 'skipped':
				++$result['skipped'];
				break;
			default:
				++$result['errors'];
				break;
		}
	}

	return $result;
}

/**
 * Get activated regular user IDs in MultiUser.
 *
 * @return array
 */
function wpbc_bfb_get_mu_activated_regular_user_ids() {

	$user_ids = array();

	if ( ! class_exists( 'wpdev_bk_multiuser' ) ) {
		return $user_ids;
	}

	global $wpdb;
	$prefix = $wpdb->get_blog_prefix();

	$users = get_users(
		array(
			'fields'     => 'ids',
			'meta_key'   => "{$prefix}booking_is_active",   // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
			'meta_value' => 'On',                           // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
			'number'     => 9999,
		)
	);

	if ( empty( $users ) ) {
		return $user_ids;
	}

	foreach ( $users as $user_id ) {

		$user_id = absint( $user_id );
		if ( $user_id <= 0 ) {
			continue;
		}

		$is_super_admin = apply_bk_filter( 'is_user_super_admin', $user_id );
		if ( $is_super_admin ) {
			continue;
		}

		$user_ids[] = $user_id;
	}

	return array_values( array_unique( $user_ids ) );
}

/**
 * Import legacy forms depending on requested mode.
 *
 * Modes:
 * - current_context : import current owner context only
 * - all_global      : import global forms only
 * - all_users       : import global + all activated MU regular users
 *
 * @param array $args
 *
 * @return array
 */
function wpbc_bfb_import_legacy_forms( $args = array() ) {

	$args = wp_parse_args(
		$args,
		array(
			'mode'                     => 'current_context',
			'import_standard'          => true,
			'import_custom'            => true,
			'skip_if_exists'           => true,
			'set_bfb_form_not_defined' => true,
		)
	);

	$mode = sanitize_key( (string) $args['mode'] );
	if ( ! in_array( $mode, array( 'current_context', 'all_global', 'all_users' ), true ) ) {
		$mode = 'current_context';
	}

	$current_owner_user_id = 0;
	if ( class_exists( 'WPBC_FE_Custom_Form_Helper' ) ) {
		$current_owner_user_id = WPBC_FE_Custom_Form_Helper::wpbc_mu__get_current__owner_user_id();
	}

	$summary = array(
		'mode'         => $mode,
		'imported'     => 0,
		'skipped'      => 0,
		'errors'       => 0,
		'owners'       => array(),
		'message'      => '',
	);

	if ( 'current_context' === $mode ) {
		// Import booking forms  only  for the == Current User == (usually - "Regular User").
		$owner_result = wpbc_bfb_import_legacy_forms_for_owner( $current_owner_user_id, $args );
		$summary['owners'][] = $owner_result;

	} elseif ( 'all_global' === $mode ) {
		// Import booking forms for == Super Booking Admin == user ( user_id = 0 ).
		$owner_result = wpbc_bfb_import_legacy_forms_for_owner( 0, $args );
		$summary['owners'][] = $owner_result;

	} elseif ( 'all_users' === $mode ) {
		// Import booking forms for == All Users ==.

		// Always import global first.
		$summary['owners'][] = wpbc_bfb_import_legacy_forms_for_owner( 0, $args );

		$user_ids = wpbc_bfb_get_mu_activated_regular_user_ids();

		foreach ( $user_ids as $user_id ) {
			$summary['owners'][] = wpbc_bfb_import_legacy_forms_for_owner( $user_id, $args );
		}
	}

	foreach ( $summary['owners'] as $owner_result ) {
		$summary['imported'] += isset( $owner_result['imported'] ) ? absint( $owner_result['imported'] ) : 0;
		$summary['skipped']  += isset( $owner_result['skipped'] ) ? absint( $owner_result['skipped'] ) : 0;
		$summary['errors']   += isset( $owner_result['errors'] ) ? absint( $owner_result['errors'] ) : 0;
	}

	$summary['message'] = sprintf(
		/* translators: 1: imported count, 2: skipped count, 3: error count */
		__( 'Legacy forms import finished. Imported: %1$d. Skipped: %2$d. Errors: %3$d.', 'booking' ),
		$summary['imported'],
		$summary['skipped'],
		$summary['errors']
	);

	return $summary;
}

/**
 * AJAX: import legacy forms into booking_form_structures.
 *
 * Modes:
 * - current_context
 * - all_global
 * - all_users
 *
 * @return void
 */
function wpbc_bfb_ajax_import_legacy_forms() {

	if ( ! check_ajax_referer( 'wpbc_bfb_import_legacy_forms', 'nonce', false ) ) {
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
				'message' => __( 'You are not allowed to import booking forms.', 'booking' ),
			)
		);
	}

	$mode = isset( $_POST['mode'] ) ? sanitize_key( wp_unslash( $_POST['mode'] ) ) : 'current_context';
	if ( ! in_array( $mode, array( 'current_context', 'all_global', 'all_users' ), true ) ) {
		$mode = 'current_context';
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$skip_if_exists = isset( $_POST['skip_if_exists'] ) ? ( 'skip' === wp_unslash( $_POST['skip_if_exists'] ) ) : true;
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	$set_bfb_form_not_defined = isset( $_POST['set_bfb_form_not_defined'] ) ? ( 'not_defined' === wp_unslash( $_POST['set_bfb_form_not_defined'] ) ) : true;

	// Security: importing all MU users is allowed only for super admin context.
	if ( 'all_users' === $mode ) {
		$current_user_id     = wpbc_get_current_user_id();
		$is_user_super_admin = apply_bk_filter( 'is_user_super_admin', $current_user_id );

		if ( ! $is_user_super_admin ) {
			wp_send_json_error(
				array(
					'code'    => 'forbidden_all_users',
					'message' => __( 'Only super admin can import forms for all users.', 'booking' ),
				)
			);
		}
	}

	$summary = wpbc_bfb_import_legacy_forms(
		array(
			'mode'                     => $mode,
			'import_standard'          => true,
			'import_custom'            => true,
			'skip_if_exists'           => $skip_if_exists,
			'set_bfb_form_not_defined' => $set_bfb_form_not_defined,
		)
	);

	wp_send_json_success( $summary );
}
add_action( 'wp_ajax_' . 'WPBC_AJX_BFB_IMPORT_LEGACY_FORMS', 'wpbc_bfb_ajax_import_legacy_forms' );

