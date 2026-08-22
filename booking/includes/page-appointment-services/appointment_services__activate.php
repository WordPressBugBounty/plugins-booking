<?php
/** Database schema for Appointment Services. @package Booking Calendar */
if ( ! defined( 'ABSPATH' ) ) { exit; }

if ( ! defined( 'WPBC_APPOINTMENT_SERVICES_DB_VERSION' ) ) {
	define( 'WPBC_APPOINTMENT_SERVICES_DB_VERSION', '1.0.0' );
}

/**
 * Return the canonical starter Services used by a new installation.
 *
 * Both Services share the existing default Provider and Booking Form. Their
 * pictures use the configured starter-asset source, so distributions may use
 * bundled files or the corresponding Booking Calendar website directory.
 *
 * @param int $provider_id     Existing Booking Resource used as the Provider.
 * @param int $booking_form_id Optional published Booking Form assigned to the Services.
 *
 * @return array<int,array<string,mixed>> Normalized values accepted by the Service repository.
 */
function wpbc_appointment_services_get_starter_services_values( $provider_id, $booking_form_id = 0 ) {
	$common_values = array(
		'duration_minutes'      => 30,
		'buffer_before_minutes' => 0,
		'buffer_after_minutes'  => 0,
		'base_cost'             => '0.00',
		'booking_form_id'       => absint( $booking_form_id ),
		'status'                => 'active',
		'resource_ids'          => array( absint( $provider_id ) ),
	);

	return array(
		array_merge(
			$common_values,
			array(
				'title'       => __( 'Initial Consultation', 'booking' ),
				'description' => __( 'A focused first meeting to understand your needs and recommend the right next step.', 'booking' ),
				'metadata'    => array(
					'picture_url'    => wpbc_get_starter_asset_url( 'img/services/professional-services-demo_service-initial-consultation.png' ),
					'quickstart_key' => 'appointment_starter',
					'schema_version' => 1,
				),
			)
		),
		array_merge(
			$common_values,
			array(
				'title'       => __( 'One-to-One Session', 'booking' ),
				'description' => __( 'Personalized support tailored to your goals, questions, and schedule.', 'booking' ),
				'metadata'    => array(
					'picture_url'    => wpbc_get_starter_asset_url( 'img/services/professional-services-demo_service-one-to-one-session.png' ),
					'quickstart_key' => 'appointment_starter_one_to_one',
					'schema_version' => 1,
				),
			)
		),
	);
}

/**
 * Return the primary starter Service used by Appointment QuickStart.
 *
 * QuickStart creates at most one dedicated Service, while fresh activation
 * seeds the complete starter set returned by
 * `wpbc_appointment_services_get_starter_services_values()`.
 *
 * @param int $provider_id     Existing Booking Resource used as the Provider.
 * @param int $booking_form_id Optional published Booking Form assigned to the Service.
 *
 * @return array<string,mixed> Normalized values accepted by the Service repository.
 */
function wpbc_appointment_services_get_starter_service_values( $provider_id, $booking_form_id = 0 ) {
	$starter_services = wpbc_appointment_services_get_starter_services_values( $provider_id, $booking_form_id );

	return reset( $starter_services );
}

/**
 * Resolve the published starter form assigned to the default Appointment Service.
 *
 * The activation form registry owns the form identity. This resolver reads its
 * assignment marker so the Service seed does not duplicate a form slug.
 *
 * @return int Published Booking Form ID, or zero while form storage is unavailable.
 */
function wpbc_appointment_services_get_starter_booking_form_id() {
	if (
		! function_exists( 'wpbc_get_activation_booking_form_page_configs' )
		|| ! function_exists( 'wpbc_is_table_exists' )
		|| ! wpbc_is_table_exists( 'booking_form_structures' )
		|| ! class_exists( 'WPBC_BFB_Form_Storage' )
	) {
		return 0;
	}

	$form_configs = wpbc_get_activation_booking_form_page_configs();
	if ( empty( $form_configs ) || ! is_array( $form_configs ) ) {
		return 0;
	}

	foreach ( $form_configs as $form_config ) {
		if ( empty( $form_config['assign_to_default_appointment_service'] ) ) {
			continue;
		}

		$form_slug = isset( $form_config['form_slug'] )
			? sanitize_key( (string) $form_config['form_slug'] )
			: '';
		if ( '' === $form_slug ) {
			return 0;
		}

		$booking_form = WPBC_BFB_Form_Storage::get_current_form_by_key( $form_slug, 0, 'published' );

		return ! empty( $booking_form->booking_form_id )
			? absint( $booking_form->booking_form_id )
			: 0;
	}

	return 0;
}

/**
 * Resolve a logical Appointment Services table suffix to its full table name.
 *
 * @param string $suffix Logical suffix: services, service_resources, or appointment_details.
 *
 * @return string WordPress-prefixed database table name.
 */
function wpbc_appointment_services_table_name( $suffix = 'services' ) {
	global $wpdb;
	$tables = array(
		'services'            => 'booking_services',
		'service_resources'   => 'booking_service_resources',
		'appointment_details' => 'booking_appointment_details',
	);
	$suffix = isset( $tables[ $suffix ] ) ? $suffix : 'services';
	return $wpdb->prefix . $tables[ $suffix ];
}

/**
 * Determine whether every Appointment Services table is available.
 *
 * @return bool True when the Service, assignment, and snapshot tables exist.
 */
function wpbc_appointment_services_tables_exist() {
	return wpbc_is_table_exists( 'booking_services' )
		&& wpbc_is_table_exists( 'booking_service_resources' )
		&& wpbc_is_table_exists( 'booking_appointment_details' );
}

/**
 * Create the starter Services after their database tables are installed.
 *
 * This runs only for a newly created Services table, or when an earlier seed
 * attempt was marked for retry. It deliberately does not inspect an existing
 * empty catalog because administrators may intentionally remove every Service.
 *
 * @return bool True when every starter Service was created successfully.
 */
function wpbc_activation__appointment_services__seed_default_service() {
	global $wpdb;

	if ( ! wpbc_appointment_services_tables_exist() ) {
		return false;
	}

	$provider_id = function_exists( 'wpbc_get_default_resource' ) ? absint( wpbc_get_default_resource() ) : 1;
	if ( ! $provider_id ) {
		$provider_id = 1;
	}

	$booking_form_id = wpbc_appointment_services_get_starter_booking_form_id();
	if ( ! $booking_form_id ) {
		return false;
	}

	$starter_services    = wpbc_appointment_services_get_starter_services_values( $provider_id, $booking_form_id );
	$now                 = current_time( 'mysql' );
	$current_user_id     = get_current_user_id();
	$owner_user_id       = function_exists( 'wpbc_appointment_services_get_owner_user_id' )
		? absint( wpbc_appointment_services_get_owner_user_id() )
		: 0;
	$created_service_ids = array();
	$assignment_inserted = true;

	foreach ( $starter_services as $starter_service ) {
		$metadata         = wp_json_encode( $starter_service['metadata'] );
		$service_inserted = $wpdb->insert(
			wpbc_appointment_services_table_name( 'services' ),
			array(
				'owner_user_id'         => $owner_user_id,
				'title'                 => $starter_service['title'],
				'description'           => $starter_service['description'],
				'duration_minutes'      => $starter_service['duration_minutes'],
				'buffer_before_minutes' => $starter_service['buffer_before_minutes'],
				'buffer_after_minutes'  => $starter_service['buffer_after_minutes'],
				'base_cost'             => $starter_service['base_cost'],
				'booking_form_id'       => $starter_service['booking_form_id'],
				'status'                => $starter_service['status'],
				'metadata'              => false === $metadata ? '{}' : $metadata,
				'created_by'            => $current_user_id,
				'modified_by'           => $current_user_id,
				'creation_date'         => $now,
				'modification_date'     => $now,
			),
			array( '%d', '%s', '%s', '%d', '%d', '%d', '%s', '%d', '%s', '%s', '%d', '%d', '%s', '%s' )
		); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		$service_id      = absint( $wpdb->insert_id );

		if ( false === $service_inserted || ! $service_id ) {
			break;
		}

		$created_service_ids[] = $service_id;
		$assignment_inserted   = $wpdb->insert(
			wpbc_appointment_services_table_name( 'service_resources' ),
			array(
				'service_id'  => $service_id,
				'resource_id' => $provider_id,
				'priority'    => 0,
				'status'      => 'active',
			),
			array( '%d', '%d', '%d', '%s' )
		); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery

		if ( false === $assignment_inserted ) {
			break;
		}
	}

	if ( count( $created_service_ids ) !== count( $starter_services ) || false === $assignment_inserted ) {
		foreach ( $created_service_ids as $created_service_id ) {
			$wpdb->delete(
				wpbc_appointment_services_table_name( 'service_resources' ),
				array( 'service_id' => $created_service_id ),
				array( '%d' )
			); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$wpdb->delete(
				wpbc_appointment_services_table_name( 'services' ),
				array( 'service_id' => $created_service_id ),
				array( '%d' )
			); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		}

		return false;
	}

	return true;
}

/**
 * Complete a pending starter Service seed after activation forms are available.
 *
 * @return bool True when the pending Service was created; otherwise false.
 */
function wpbc_activation__appointment_services__maybe_seed_default_service() {
	if ( 'On' !== get_bk_option( 'booking_appointment_services_default_seed_pending' ) ) {
		return false;
	}

	if ( ! wpbc_activation__appointment_services__seed_default_service() ) {
		return false;
	}

	delete_bk_option( 'booking_appointment_services_default_seed_pending' );

	return true;
}
add_action(
	'wpbc_activation_custom_booking_forms_created',
	'wpbc_activation__appointment_services__maybe_seed_default_service'
);

/**
 * Create or upgrade all Service, assignment, and Appointment snapshot tables.
 *
 * @return void
 */
function wpbc_activation__appointment_services() {
	global $wpdb;
	require_once ABSPATH . 'wp-admin/includes/upgrade.php';

	$services_table_existed = wpbc_is_table_exists( 'booking_services' );
	if ( ! $services_table_existed ) {
		update_bk_option( 'booking_appointment_services_default_seed_pending', 'On' );
	}

	$charset_collate = $wpdb->get_charset_collate();
	$services        = wpbc_appointment_services_table_name( 'services' );
	$assignments     = wpbc_appointment_services_table_name( 'service_resources' );
	$details         = wpbc_appointment_services_table_name( 'appointment_details' );

	$sql_services = "CREATE TABLE {$services} (
		service_id bigint(20) unsigned NOT NULL auto_increment,
		owner_user_id bigint(20) unsigned NOT NULL default 0,
		title varchar(200) NOT NULL default '',
		description text NULL,
		duration_minutes smallint(5) unsigned NOT NULL default 30,
		buffer_before_minutes smallint(5) unsigned NOT NULL default 0,
		buffer_after_minutes smallint(5) unsigned NOT NULL default 0,
		base_cost decimal(12,2) NOT NULL default 0.00,
		booking_form_id bigint(20) unsigned NOT NULL default 0,
		status varchar(20) NOT NULL default 'active',
		metadata longtext NULL,
		created_by bigint(20) unsigned NOT NULL default 0,
		modified_by bigint(20) unsigned NOT NULL default 0,
		creation_date datetime NOT NULL default '0000-00-00 00:00:00',
		modification_date datetime NOT NULL default '0000-00-00 00:00:00',
		PRIMARY KEY  (service_id),
		KEY owner_status (owner_user_id,status),
		KEY status_title (status,title)
	) {$charset_collate};";

	$sql_assignments = "CREATE TABLE {$assignments} (
		assignment_id bigint(20) unsigned NOT NULL auto_increment,
		service_id bigint(20) unsigned NOT NULL,
		resource_id bigint(20) unsigned NOT NULL,
		duration_override smallint(5) unsigned NULL,
		cost_override decimal(12,2) NULL,
		priority int(10) unsigned NOT NULL default 0,
		status varchar(20) NOT NULL default 'active',
		PRIMARY KEY  (assignment_id),
		UNIQUE KEY service_resource (service_id,resource_id),
		KEY resource_status (resource_id,status),
		KEY service_status (service_id,status)
	) {$charset_collate};";

	$sql_details = "CREATE TABLE {$details} (
		appointment_detail_id bigint(20) unsigned NOT NULL auto_increment,
		booking_id bigint(20) unsigned NOT NULL,
		service_id bigint(20) unsigned NOT NULL,
		resource_id bigint(20) unsigned NOT NULL,
		service_title varchar(200) NOT NULL default '',
		duration_minutes smallint(5) unsigned NOT NULL default 0,
		buffer_before_minutes smallint(5) unsigned NOT NULL default 0,
		buffer_after_minutes smallint(5) unsigned NOT NULL default 0,
		base_cost decimal(12,2) NOT NULL default 0.00,
		booking_form_id bigint(20) unsigned NOT NULL default 0,
		metadata longtext NULL,
		creation_date datetime NOT NULL default '0000-00-00 00:00:00',
		modification_date datetime NOT NULL default '0000-00-00 00:00:00',
		PRIMARY KEY  (appointment_detail_id),
		UNIQUE KEY booking_id (booking_id),
		KEY service_id (service_id),
		KEY resource_id (resource_id)
	) {$charset_collate};";

	dbDelta( $sql_services );
	dbDelta( $sql_assignments );
	dbDelta( $sql_details );
	update_bk_option( 'booking_appointment_services_db_version', WPBC_APPOINTMENT_SERVICES_DB_VERSION );

	wpbc_activation__appointment_services__maybe_seed_default_service();
}
add_bk_action( 'wpbc_free_version_activation', 'wpbc_activation__appointment_services' );
add_bk_action( 'wpbc_other_versions_activation', 'wpbc_activation__appointment_services' );

/**
 * Upgrade the Appointment Services schema from an authorized admin request.
 *
 * @return void
 */
function wpbc_activation__appointment_services__maybe_upgrade() {
	if ( ! is_admin() || ! current_user_can( 'activate_plugins' ) ) { return; }
	if (
		WPBC_APPOINTMENT_SERVICES_DB_VERSION !== get_bk_option( 'booking_appointment_services_db_version' )
		|| ! wpbc_appointment_services_tables_exist()
		|| 'On' === get_bk_option( 'booking_appointment_services_default_seed_pending' )
	) {
		wpbc_activation__appointment_services();
	}
}
add_action( 'admin_init', 'wpbc_activation__appointment_services__maybe_upgrade' );

/**
 * Remove Appointment Services tables during Booking Calendar's full data removal.
 *
 * @return void
 */
function wpbc_deactivation__appointment_services() {
	global $wpdb;
	$wpdb->query( 'DROP TABLE IF EXISTS ' . wpbc_appointment_services_table_name( 'appointment_details' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	$wpdb->query( 'DROP TABLE IF EXISTS ' . wpbc_appointment_services_table_name( 'service_resources' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	$wpdb->query( 'DROP TABLE IF EXISTS ' . wpbc_appointment_services_table_name( 'services' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	delete_bk_option( 'booking_appointment_services_default_seed_pending' );
}
add_bk_action( 'wpbc_free_version_deactivation', 'wpbc_deactivation__appointment_services' );
add_bk_action( 'wpbc_other_versions_deactivation', 'wpbc_deactivation__appointment_services' );
