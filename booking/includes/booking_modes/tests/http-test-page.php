<?php
/**
 * Authenticated administration diagnostics for Booking Modes.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/runtime-test-suite.php';

/**
 * Collect read-only administration lifecycle measurements for the test page.
 */
final class WPBC_Booking_Modes_Test_Metrics {

	/**
	 * Collected metric values.
	 *
	 * @var array
	 */
	private static $metrics = array();

	/**
	 * Register lifecycle counters before WordPress builds the administration menu.
	 *
	 * @return void
	 */
	public static function init() {

		self::$metrics = array(
			'request_start'                 => isset( $_SERVER['REQUEST_TIME_FLOAT'] ) ? (float) $_SERVER['REQUEST_TIME_FLOAT'] : microtime( true ),
			'admin_menu_start'              => 0.0,
			'admin_menu_end'                => 0.0,
			'admin_menu_query_start'        => 0,
			'admin_menu_query_end'          => 0,
			'wpbc_menu_created_count'       => 0,
			'wpbc_define_nav_tabs_count'    => 0,
			'legacy_structure_filter_count' => 0,
			'legacy_navigation'              => array(),
		);

		add_action( '_admin_menu', array( __CLASS__, 'mark_admin_menu_start' ), -9999 );
		add_action( 'admin_menu', array( __CLASS__, 'mark_admin_menu_end' ), PHP_INT_MAX );
		add_action( 'wpbc_menu_created', array( __CLASS__, 'count_menu_created' ), PHP_INT_MAX );
		add_action( 'wpbc_define_nav_tabs', array( __CLASS__, 'count_define_nav_tabs' ), PHP_INT_MAX );
		add_filter( 'wpbc_plugin_menu_structure_arr', array( __CLASS__, 'count_legacy_structure_filter' ), PHP_INT_MAX, 2 );
	}

	/**
	 * Mark the beginning of WordPress administration menu preparation.
	 *
	 * @return void
	 */
	public static function mark_admin_menu_start() {

		self::$metrics['admin_menu_start']       = microtime( true );
		self::$metrics['admin_menu_query_start'] = get_num_queries();
	}

	/**
	 * Mark the end of WordPress administration menu registration.
	 *
	 * @return void
	 */
	public static function mark_admin_menu_end() {

		self::$metrics['admin_menu_end']       = microtime( true );
		self::$metrics['admin_menu_query_end'] = get_num_queries();
	}

	/**
	 * Count one legacy page-constructor lifecycle action.
	 *
	 * @return void
	 */
	public static function count_menu_created() {

		++self::$metrics['wpbc_menu_created_count'];
	}

	/**
	 * Count one legacy navigation assembly action.
	 *
	 * @return void
	 */
	public static function count_define_nav_tabs() {

		++self::$metrics['wpbc_define_nav_tabs_count'];
	}

	/**
	 * Count legacy structure filter applications without changing the structure.
	 *
	 * @param array  $navigation Legacy navigation structure.
	 * @param string $page_tag   Page tag currently being merged.
	 *
	 * @return array Unchanged navigation structure.
	 */
	public static function count_legacy_structure_filter( $navigation, $page_tag ) {

		unset( $page_tag );
		++self::$metrics['legacy_structure_filter_count'];
		self::$metrics['legacy_navigation'] = is_array( $navigation ) ? $navigation : array();

		return $navigation;
	}

	/**
	 * Get the latest complete legacy navigation snapshot.
	 *
	 * The test-only legacy filter runs throughout menu construction. Its final
	 * invocation contains the same complete tree used by page renderers.
	 *
	 * @return array Captured legacy navigation tree.
	 */
	public static function get_legacy_navigation() {

		return self::$metrics['legacy_navigation'];
	}

	/**
	 * Get collected metrics with current request totals.
	 *
	 * @return array Metric names and scalar values.
	 */
	public static function get_metrics() {

		$admin_menu_duration = 0.0;

		if ( self::$metrics['admin_menu_end'] > self::$metrics['admin_menu_start'] ) {
			$admin_menu_duration = self::$metrics['admin_menu_end'] - self::$metrics['admin_menu_start'];
		}

		return array(
			'request_elapsed_seconds'       => microtime( true ) - self::$metrics['request_start'],
			'admin_menu_seconds'            => $admin_menu_duration,
			'admin_menu_query_delta'        => self::$metrics['admin_menu_query_end'] - self::$metrics['admin_menu_query_start'],
			'total_queries_at_render'       => get_num_queries(),
			'peak_memory_bytes'             => memory_get_peak_usage( true ),
			'wpbc_menu_created_count'       => self::$metrics['wpbc_menu_created_count'],
			'wpbc_define_nav_tabs_count'    => self::$metrics['wpbc_define_nav_tabs_count'],
			'legacy_structure_filter_count' => self::$metrics['legacy_structure_filter_count'],
			'navigation_resolution_count'   => WPBC_Booking_Mode_Navigation::get_instance()->get_build_count(),
		);
	}
}
WPBC_Booking_Modes_Test_Metrics::init();

/**
 * Register the temporary diagnostics page under WordPress Tools.
 *
 * @return void
 */
function wpbc_booking_modes_tests_register_page() {

	add_management_page(
		__( 'Booking Modes Tests', 'booking' ),
		__( 'Booking Modes Tests', 'booking' ),
		'activate_plugins',
		'wpbc-booking-modes-tests',
		'wpbc_booking_modes_tests_render_page'
	);
}
add_action( 'admin_menu', 'wpbc_booking_modes_tests_register_page', 99 );

/**
 * Get a normalized signature of the native WP Booking Calendar submenu.
 *
 * Labels are reduced to plain text so update-count markup cannot make fixture
 * comparisons unstable.
 *
 * @return array Native submenu signature rows.
 */
function wpbc_booking_modes_tests_get_native_submenu_signature() {

	global $submenu;

	$signature = array();
	$items     = isset( $submenu['wpbc'] ) && is_array( $submenu['wpbc'] ) ? $submenu['wpbc'] : array();

	foreach ( $items as $menu_item ) {
		$menu_label      = isset( $menu_item[0] ) && is_scalar( $menu_item[0] ) ? (string) $menu_item[0] : '';
		$menu_capability = isset( $menu_item[1] ) && is_scalar( $menu_item[1] ) ? (string) $menu_item[1] : '';
		$menu_slug       = isset( $menu_item[2] ) && is_scalar( $menu_item[2] ) ? (string) $menu_item[2] : '';

		$signature[] = array(
			'label'      => trim( wp_strip_all_tags( $menu_label ) ),
			'capability' => sanitize_key( $menu_capability ),
			'slug'       => sanitize_text_field( $menu_slug ),
		);
	}

	return $signature;
}

/**
 * Get a normalized signature of internal tabs and subtabs.
 *
 * @param array $navigation Resolved internal navigation tree.
 *
 * @return array Signature rows in renderer order.
 */
function wpbc_booking_modes_tests_get_internal_navigation_signature( $navigation ) {

	$signature = array();

	if ( ! is_array( $navigation ) ) {
		return $signature;
	}

	foreach ( $navigation as $page_tag => $tabs ) {
		if ( ! is_array( $tabs ) ) {
			continue;
		}

		foreach ( $tabs as $tab_tag => $tab ) {
			if ( ! is_array( $tab ) ) {
				continue;
			}

			$tab_title   = isset( $tab['title'] ) && is_scalar( $tab['title'] ) ? trim( wp_strip_all_tags( (string) $tab['title'] ) ) : '';
			$signature[] = array(
				'page'           => sanitize_key( $page_tag ),
				'tab'            => sanitize_key( $tab_tag ),
				'subtab'         => '',
				'title'          => $tab_title,
				'hidden'         => ! empty( $tab['hided'] ),
				'disabled'       => ! empty( $tab['disabled'] ),
				'active'         => ! empty( $tab['is_active'] ),
				'top_navigation' => ! empty( $tab['is_show_top_navigation'] ),
			);

			$subtabs = isset( $tab['subtabs'] ) && is_array( $tab['subtabs'] ) ? $tab['subtabs'] : array();

			foreach ( $subtabs as $subtab_tag => $subtab ) {
				if ( ! is_array( $subtab ) ) {
					continue;
				}

				$subtab_title = isset( $subtab['title'] ) && is_scalar( $subtab['title'] ) ? trim( wp_strip_all_tags( (string) $subtab['title'] ) ) : '';
				$signature[]  = array(
					'page'           => sanitize_key( $page_tag ),
					'tab'            => sanitize_key( $tab_tag ),
					'subtab'         => sanitize_key( $subtab_tag ),
					'title'          => $subtab_title,
					'hidden'         => ! empty( $subtab['hided'] ),
					'disabled'       => ! empty( $subtab['disabled'] ),
					'active'         => ! empty( $subtab['is_active'] ),
					'top_navigation' => false,
				);
			}
		}
	}

	return $signature;
}

/**
 * Get the environment and owner context needed to identify one matrix result.
 *
 * @param array<string,mixed> $context Cached Booking Modes request context.
 *
 * @return array<string,string> Human-readable environment values.
 */
function wpbc_booking_modes_tests_get_environment_signature( $context ) {

	$context = is_array( $context ) ? $context : array();

	return array(
		'wpbc_version'           => defined( 'WPDEV_BK_VERSION' ) ? WPDEV_BK_VERSION : '',
		'wordpress_version'      => get_bloginfo( 'version' ),
		'php_version'            => PHP_VERSION,
		'edition'                => function_exists( 'wpbc_get_version_type__and_mu' ) ? wpbc_get_version_type__and_mu() : 'unknown',
		'feature_gate'           => wpbc_is_11_5_features_enabled() ? 'enabled' : 'disabled',
		'navigation_boundary'    => wpbc_booking_modes_is_navigation_boundary_enabled() ? 'enabled' : 'disabled',
		'real_user_id'           => isset( $context['real_user_id'] ) ? (string) absint( $context['real_user_id'] ) : '0',
		'owner_user_id'          => isset( $context['owner_user_id'] ) ? (string) absint( $context['owner_user_id'] ) : '0',
		'is_multiuser'           => ! empty( $context['is_multiuser'] ) ? 'yes' : 'no',
		'is_simulated_login'     => ! empty( $context['is_simulated_login'] ) ? 'yes' : 'no',
		'current_page'           => isset( $context['page'] ) ? sanitize_key( (string) $context['page'] ) : '',
		'current_tab'            => isset( $context['tab'] ) ? sanitize_key( (string) $context['tab'] ) : '',
		'current_subtab'         => isset( $context['subtab'] ) ? sanitize_key( (string) $context['subtab'] ) : '',
	);
}

/**
 * Find repeated scalar identifiers in one diagnostic signature.
 *
 * Empty identifiers are excluded because an extension may deliberately omit a
 * non-routing display value without creating a duplicate route.
 *
 * @param array<int,mixed> $identifiers Values to compare.
 *
 * @return array<int,string> Sorted duplicate identifiers.
 */
function wpbc_booking_modes_tests_get_duplicate_identifiers( $identifiers ) {

	$normalized_identifiers = array();

	foreach ( (array) $identifiers as $identifier ) {
		if ( ! is_scalar( $identifier ) || '' === (string) $identifier ) {
			continue;
		}

		$normalized_identifiers[] = (string) $identifier;
	}

	$duplicate_identifiers = array_keys(
		array_filter(
			array_count_values( $normalized_identifiers ),
			static function ( $identifier_count ) {
				return $identifier_count > 1;
			}
		)
	);
	sort( $duplicate_identifiers, SORT_STRING );

	return $duplicate_identifiers;
}

/**
 * Get the browser-only Phase 8 acceptance rows that cannot be inferred safely.
 *
 * These rows stay explicitly manual. The diagnostics page must never claim
 * that a visual, edition, role, redirect, upgrade, or live-demo behavior passed
 * merely because its underlying PHP callback is registered.
 *
 * @return array<int,array<string,string>> Manual acceptance rows.
 */
function wpbc_booking_modes_tests_get_manual_acceptance_matrix() {

	return array(
		array(
			'area'         => __( 'Mode navigation', 'booking' ),
			'verification' => __( 'Open Classic, Appointments, and Rentals and verify the native submenu, internal vertical navigation, and top horizontal navigation.', 'booking' ),
		),
		array(
			'area'         => __( 'Active route', 'booking' ),
			'verification' => __( 'Verify active parent, tab, and subtab highlighting on representative pages in every mode.', 'booking' ),
		),
		array(
			'area'         => __( 'Direct routes', 'booking' ),
			'verification' => __( 'Open hidden and regrouped canonical URLs directly and confirm the existing controller and capability checks still run.', 'booking' ),
		),
		array(
			'area'         => __( 'Mode switching', 'booking' ),
			'verification' => __( 'Verify progress, success, and error notices; duplicate-click blocking; protected AJAX persistence; and one valid server-selected redirect.', 'booking' ),
		),
		array(
			'area'         => __( 'Permissions', 'booking' ),
			'verification' => __( 'Verify insufficient roles cannot switch modes and forged or expired nonces do not change the stored selection.', 'booking' ),
		),
		array(
			'area'         => __( 'Editions', 'booking' ),
			'verification' => __( 'Repeat the navigation checks in Free and every supported commercial edition, including Business Large routes.', 'booking' ),
		),
		array(
			'area'         => __( 'MultiUser', 'booking' ),
			'verification' => __( 'Repeat as Booking Calendar super administrator, regular owner, and simulated owner; confirm owner-scoped persistence and capabilities.', 'booking' ),
		),
		array(
			'area'         => __( 'Upgrade compatibility', 'booking' ),
			'verification' => __( 'Verify an installation without booking_admin_mode starts in Classic and obsolete Quick Modes options are ignored.', 'booking' ),
		),
		array(
			'area'         => __( 'Feature disabled', 'booking' ),
			'verification' => __( 'Disable WPBC_ENABLE_11_5_FEATURES and use this Tools page to capture the isolation and request baseline before comparing enabled results.', 'booking' ),
		),
		array(
			'area'         => __( 'Live demo', 'booking' ),
			'verification' => __( 'Verify the selector remains presentation-only, QuickStart shows documentation only, and forged mutation requests are rejected.', 'booking' ),
		),
		array(
			'area'         => __( 'Setup Wizard', 'booking' ),
			'verification' => __( 'Complete and revisit Setup Wizard flows and confirm mode presentation does not repeat or alter existing setup mutations.', 'booking' ),
		),
		array(
			'area'         => __( 'Performance', 'booking' ),
			'verification' => __( 'Capture at least three disabled and enabled requests and compare median request time, menu time, query delta, and peak memory.', 'booking' ),
		),
	);
}

/**
 * Render the read-only Booking Modes foundation test panel.
 *
 * @return void
 */
function wpbc_booking_modes_tests_render_page() {

	if ( ! current_user_can( 'activate_plugins' ) ) {
		wp_die(
			esc_html__( 'You are not allowed to run Booking Modes foundation tests.', 'booking' ),
			esc_html__( 'Access denied', 'booking' ),
			array( 'response' => 403 )
		);
	}

	$legacy_navigation   = WPBC_Booking_Modes_Test_Metrics::get_legacy_navigation();
	$suite               = wpbc_booking_modes_tests_run_runtime( $legacy_navigation );
	$metrics             = WPBC_Booking_Modes_Test_Metrics::get_metrics();
	$native_submenu      = wpbc_booking_modes_tests_get_native_submenu_signature();
	$internal_navigation = wpbc_booking_modes_tests_get_internal_navigation_signature( $suite['resolved_navigation'] );
	$environment         = wpbc_booking_modes_tests_get_environment_signature( $suite['context'] );
	$manual_matrix       = wpbc_booking_modes_tests_get_manual_acceptance_matrix();
	$native_slugs        = wp_list_pluck( $native_submenu, 'slug' );
	$internal_routes     = array();

	foreach ( $internal_navigation as $navigation_item ) {
		$internal_routes[] = implode( '|', array( $navigation_item['page'], $navigation_item['tab'], $navigation_item['subtab'] ) );
	}

	$duplicate_native_slugs    = wpbc_booking_modes_tests_get_duplicate_identifiers( $native_slugs );
	$duplicate_internal_routes = wpbc_booking_modes_tests_get_duplicate_identifiers( $internal_routes );

	wpbc_booking_modes_tests_add_result(
		$suite['results'],
		empty( $duplicate_native_slugs ),
		'The native WP Booking Calendar submenu has no duplicate slugs',
		empty( $duplicate_native_slugs ) ? '' : implode( ', ', $duplicate_native_slugs )
	);
	wpbc_booking_modes_tests_add_result(
		$suite['results'],
		empty( $duplicate_internal_routes ),
		'The resolved internal navigation has no duplicate canonical routes',
		empty( $duplicate_internal_routes ) ? '' : implode( ', ', $duplicate_internal_routes )
	);
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Booking Modes Tests', 'booking' ); ?></h1>
		<p><?php esc_html_e( 'These checks are read-only. They validate the registry, active presentation boundary, switch security, redirects, and current menu lifecycle.', 'booking' ); ?></p>

		<h2><?php esc_html_e( 'Runtime checks', 'booking' ); ?></h2>
		<table class="widefat striped">
			<thead><tr><th><?php esc_html_e( 'Status', 'booking' ); ?></th><th><?php esc_html_e( 'Check', 'booking' ); ?></th><th><?php esc_html_e( 'Details', 'booking' ); ?></th></tr></thead>
			<tbody>
			<?php foreach ( $suite['results'] as $test_result ) : ?>
				<tr>
					<td><?php echo esc_html( $test_result['passed'] ? 'PASS' : 'FAIL' ); ?></td>
					<td><?php echo esc_html( $test_result['label'] ); ?></td>
					<td><?php echo esc_html( $test_result['details'] ); ?></td>
				</tr>
			<?php endforeach; ?>
			</tbody>
		</table>

		<h2><?php esc_html_e( 'Environment', 'booking' ); ?></h2>
		<table class="widefat striped">
			<tbody>
			<?php foreach ( $environment as $environment_name => $environment_value ) : ?>
				<tr><th><?php echo esc_html( $environment_name ); ?></th><td><?php echo esc_html( $environment_value ); ?></td></tr>
			<?php endforeach; ?>
			</tbody>
		</table>

		<h2><?php esc_html_e( 'Request metrics', 'booking' ); ?></h2>
		<table class="widefat striped">
			<tbody>
			<?php foreach ( $metrics as $metric_name => $metric_value ) : ?>
				<tr><th><?php echo esc_html( $metric_name ); ?></th><td><?php echo esc_html( is_float( $metric_value ) ? number_format( $metric_value, 6, '.', '' ) : (string) $metric_value ); ?></td></tr>
			<?php endforeach; ?>
			<tr><th><?php esc_html_e( 'mode_registry_build_count', 'booking' ); ?></th><td><?php echo esc_html( (string) WPBC_Booking_Mode_Registry::get_instance()->get_build_count() ); ?></td></tr>
			<tr><th><?php esc_html_e( 'page_registry_build_count', 'booking' ); ?></th><td><?php echo esc_html( (string) WPBC_Booking_Mode_Page_Registry::get_instance()->get_build_count() ); ?></td></tr>
			<tr><th><?php esc_html_e( 'context_build_count', 'booking' ); ?></th><td><?php echo esc_html( (string) WPBC_Booking_Mode_Context::get_instance()->get_build_count() ); ?></td></tr>
			<tr><th><?php esc_html_e( 'mode_option_read_count', 'booking' ); ?></th><td><?php echo esc_html( (string) WPBC_Booking_Mode_Storage::get_instance()->get_read_count() ); ?></td></tr>
			</tbody>
		</table>

		<h2><?php esc_html_e( 'Mode registry', 'booking' ); ?></h2>
		<table class="widefat striped">
			<thead><tr><th><?php esc_html_e( 'ID', 'booking' ); ?></th><th><?php esc_html_e( 'Label', 'booking' ); ?></th><th><?php esc_html_e( 'Default page', 'booking' ); ?></th><th><?php esc_html_e( 'Allowed', 'booking' ); ?></th></tr></thead>
			<tbody>
			<?php foreach ( $suite['modes'] as $mode_id => $mode ) : ?>
				<tr>
					<td><?php echo esc_html( $mode_id ); ?></td>
					<td><?php echo esc_html( $mode['label'] ); ?></td>
					<td><?php echo esc_html( $mode['default_page'] ); ?></td>
					<td><?php echo esc_html( in_array( $mode_id, $suite['allowed_mode_ids'], true ) ? 'yes' : 'no' ); ?></td>
				</tr>
			<?php endforeach; ?>
			</tbody>
		</table>

		<h2><?php esc_html_e( 'Native submenu signature', 'booking' ); ?></h2>
		<table class="widefat striped">
			<thead><tr><th><?php esc_html_e( 'Label', 'booking' ); ?></th><th><?php esc_html_e( 'Capability', 'booking' ); ?></th><th><?php esc_html_e( 'Slug', 'booking' ); ?></th></tr></thead>
			<tbody>
			<?php foreach ( $native_submenu as $menu_item ) : ?>
				<tr><td><?php echo esc_html( $menu_item['label'] ); ?></td><td><?php echo esc_html( $menu_item['capability'] ); ?></td><td><?php echo esc_html( $menu_item['slug'] ); ?></td></tr>
			<?php endforeach; ?>
			</tbody>
		</table>

		<h2><?php esc_html_e( 'Internal navigation signature', 'booking' ); ?></h2>
		<table class="widefat striped">
			<thead><tr><th><?php esc_html_e( 'Page', 'booking' ); ?></th><th><?php esc_html_e( 'Tab', 'booking' ); ?></th><th><?php esc_html_e( 'Subtab', 'booking' ); ?></th><th><?php esc_html_e( 'Title', 'booking' ); ?></th><th><?php esc_html_e( 'Hidden', 'booking' ); ?></th><th><?php esc_html_e( 'Disabled', 'booking' ); ?></th><th><?php esc_html_e( 'Active', 'booking' ); ?></th><th><?php esc_html_e( 'Top navigation', 'booking' ); ?></th></tr></thead>
			<tbody>
			<?php foreach ( $internal_navigation as $navigation_item ) : ?>
				<tr>
					<td><?php echo esc_html( $navigation_item['page'] ); ?></td>
					<td><?php echo esc_html( $navigation_item['tab'] ); ?></td>
					<td><?php echo esc_html( $navigation_item['subtab'] ); ?></td>
					<td><?php echo esc_html( $navigation_item['title'] ); ?></td>
					<td><?php echo esc_html( $navigation_item['hidden'] ? 'yes' : 'no' ); ?></td>
					<td><?php echo esc_html( $navigation_item['disabled'] ? 'yes' : 'no' ); ?></td>
					<td><?php echo esc_html( $navigation_item['active'] ? 'yes' : 'no' ); ?></td>
					<td><?php echo esc_html( $navigation_item['top_navigation'] ? 'yes' : 'no' ); ?></td>
				</tr>
			<?php endforeach; ?>
			</tbody>
		</table>

		<p><strong><?php esc_html_e( 'Available canonical page IDs:', 'booking' ); ?></strong> <?php echo esc_html( implode( ', ', $suite['available_page_ids'] ) ); ?></p>

		<p><strong><?php esc_html_e( 'Selected mode:', 'booking' ); ?></strong> <?php echo esc_html( $suite['selected_mode_id'] ); ?></p>

		<h2><?php esc_html_e( 'Manual Phase 8 acceptance matrix', 'booking' ); ?></h2>
		<p><?php esc_html_e( 'These browser and environment checks require direct observation. Record PASS or FAIL externally for each tested edition and ownership context; they are intentionally not inferred from callback registration.', 'booking' ); ?></p>
		<table class="widefat striped">
			<thead><tr><th><?php esc_html_e( 'Status', 'booking' ); ?></th><th><?php esc_html_e( 'Area', 'booking' ); ?></th><th><?php esc_html_e( 'Required verification', 'booking' ); ?></th></tr></thead>
			<tbody>
			<?php foreach ( $manual_matrix as $acceptance_row ) : ?>
				<tr><td><?php esc_html_e( 'MANUAL', 'booking' ); ?></td><td><?php echo esc_html( $acceptance_row['area'] ); ?></td><td><?php echo esc_html( $acceptance_row['verification'] ); ?></td></tr>
			<?php endforeach; ?>
			</tbody>
		</table>

		<p><?php esc_html_e( 'Remove WPBC_ENABLE_BOOKING_MODES_TESTS from wp-config.php when testing is complete.', 'booking' ); ?></p>
	</div>
	<?php
}
