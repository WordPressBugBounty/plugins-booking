<?php
/**
 * Authenticated disabled-gate diagnostics for Booking Modes.
 *
 * This test-only file is loaded only when the explicit diagnostics constant is
 * enabled while the 11.5 master feature gate is disabled. It must not load any
 * Booking Modes runtime file or read the selected-mode user option.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Collect request and administration-menu metrics without loading Booking Modes.
 */
final class WPBC_Booking_Modes_Disabled_Gate_Test_Metrics {

	/**
	 * Collected request metrics.
	 *
	 * @var array<string,int|float>
	 */
	private static $metrics = array();

	/**
	 * Register baseline counters before WordPress builds the administration menu.
	 *
	 * @return void
	 */
	public static function init() {

		self::$metrics = array(
			'request_start'          => isset( $_SERVER['REQUEST_TIME_FLOAT'] ) ? (float) $_SERVER['REQUEST_TIME_FLOAT'] : microtime( true ),
			'admin_menu_start'       => 0.0,
			'admin_menu_end'         => 0.0,
			'admin_menu_query_start' => 0,
			'admin_menu_query_end'   => 0,
			'mode_option_reads'      => 0,
		);

		add_action( '_admin_menu', array( __CLASS__, 'mark_admin_menu_start' ), -9999 );
		add_action( 'admin_menu', array( __CLASS__, 'mark_admin_menu_end' ), PHP_INT_MAX );
		add_filter( 'get_user_option_booking_admin_mode', array( __CLASS__, 'count_mode_option_read' ), PHP_INT_MAX, 3 );
	}

	/**
	 * Mark the beginning of WordPress administration-menu preparation.
	 *
	 * @return void
	 */
	public static function mark_admin_menu_start() {

		self::$metrics['admin_menu_start']       = microtime( true );
		self::$metrics['admin_menu_query_start'] = get_num_queries();
	}

	/**
	 * Mark the end of WordPress administration-menu registration.
	 *
	 * @return void
	 */
	public static function mark_admin_menu_end() {

		self::$metrics['admin_menu_end']       = microtime( true );
		self::$metrics['admin_menu_query_end'] = get_num_queries();
	}

	/**
	 * Count unexpected reads of the new selected-mode user option.
	 *
	 * @param mixed   $option_value Current filtered user-option value.
	 * @param string  $option_name  User-option name.
	 * @param WP_User $user         WordPress user object.
	 *
	 * @return mixed Unchanged user-option value.
	 */
	public static function count_mode_option_read( $option_value, $option_name, $user ) {

		unset( $option_name, $user );
		++self::$metrics['mode_option_reads'];

		return $option_value;
	}

	/**
	 * Return the disabled-gate request baseline.
	 *
	 * @return array<string,int|float> Scalar request metrics.
	 */
	public static function get_metrics() {

		$admin_menu_duration = 0.0;

		if ( self::$metrics['admin_menu_end'] > self::$metrics['admin_menu_start'] ) {
			$admin_menu_duration = self::$metrics['admin_menu_end'] - self::$metrics['admin_menu_start'];
		}

		return array(
			'request_elapsed_seconds' => microtime( true ) - self::$metrics['request_start'],
			'admin_menu_seconds'      => $admin_menu_duration,
			'admin_menu_query_delta'  => self::$metrics['admin_menu_query_end'] - self::$metrics['admin_menu_query_start'],
			'total_queries_at_render' => get_num_queries(),
			'peak_memory_bytes'       => memory_get_peak_usage( true ),
			'mode_option_read_count'  => self::$metrics['mode_option_reads'],
		);
	}
}
WPBC_Booking_Modes_Disabled_Gate_Test_Metrics::init();

/**
 * Add one disabled-gate result row.
 *
 * @param array<int,array<string,mixed>> $results Test results passed by reference.
 * @param bool                           $passed  Whether the assertion passed.
 * @param string                         $label   Human-readable assertion label.
 * @param string                         $details Optional diagnostic details.
 *
 * @return void
 */
function wpbc_booking_modes_disabled_tests_add_result( &$results, $passed, $label, $details = '' ) {

	$results[] = array(
		'passed'  => (bool) $passed,
		'label'   => (string) $label,
		'details' => (string) $details,
	);
}

/**
 * Run read-only assertions for the disabled 11.5 master gate.
 *
 * @return array<int,array<string,mixed>> Normalized result rows.
 */
function wpbc_booking_modes_disabled_tests_run() {

	$results = array();
	$metrics = WPBC_Booking_Modes_Disabled_Gate_Test_Metrics::get_metrics();

	wpbc_booking_modes_disabled_tests_add_result( $results, function_exists( 'wpbc_is_11_5_features_enabled' ) && ! wpbc_is_11_5_features_enabled(), 'The 11.5 master feature gate is disabled' );
	wpbc_booking_modes_disabled_tests_add_result( $results, ! class_exists( 'WPBC_Booking_Mode_Registry', false ), 'The Booking Modes registry class is not loaded' );
	wpbc_booking_modes_disabled_tests_add_result( $results, ! class_exists( 'WPBC_Booking_Mode_Navigation', false ), 'The Booking Modes navigation class is not loaded' );
	wpbc_booking_modes_disabled_tests_add_result( $results, ! function_exists( 'wpbc_booking_modes_get_registered_modes' ), 'The Booking Modes public API is not loaded' );
	wpbc_booking_modes_disabled_tests_add_result( $results, ! function_exists( 'wpbc_booking_modes_render_toolbar_selector' ), 'The mode selector renderer is not loaded' );
	wpbc_booking_modes_disabled_tests_add_result( $results, false === has_action( 'wp_ajax_WPBC_AJX_BOOKING_MODE_SWITCH' ), 'The mode-switch AJAX endpoint is not registered' );
	wpbc_booking_modes_disabled_tests_add_result( $results, false === has_action( 'wp_ajax_WPBC_AJX_BOOKING_MODE_QUICKSTART' ), 'The QuickStart AJAX endpoint is not registered' );
	wpbc_booking_modes_disabled_tests_add_result( $results, false === has_action( 'wpbc_ui_el__top_nav__content_start', 'wpbc_booking_modes_render_toolbar_selector' ), 'The Booking Modes toolbar hook is not registered' );
	wpbc_booking_modes_disabled_tests_add_result( $results, ! wp_script_is( 'wpbc-booking-modes-toolbar', 'registered' ) && ! wp_script_is( 'wpbc-booking-modes-toolbar', 'enqueued' ), 'The Booking Modes script is not registered or enqueued' );
	wpbc_booking_modes_disabled_tests_add_result( $results, ! wp_style_is( 'wpbc-booking-modes-toolbar', 'registered' ) && ! wp_style_is( 'wpbc-booking-modes-toolbar', 'enqueued' ), 'The Booking Modes stylesheet is not registered or enqueued' );
	wpbc_booking_modes_disabled_tests_add_result( $results, 0 === $metrics['mode_option_read_count'], 'The booking_admin_mode user option is not read' );

	return $results;
}

/**
 * Register the disabled-gate diagnostics page under WordPress Tools.
 *
 * @return void
 */
function wpbc_booking_modes_disabled_tests_register_page() {

	add_management_page(
		__( 'Booking Modes Disabled-Gate Tests', 'booking' ),
		__( 'Booking Modes Tests', 'booking' ),
		'activate_plugins',
		'wpbc-booking-modes-tests',
		'wpbc_booking_modes_disabled_tests_render_page'
	);
}
add_action( 'admin_menu', 'wpbc_booking_modes_disabled_tests_register_page', 99 );

/**
 * Render the read-only disabled-gate diagnostics page.
 *
 * @return void
 */
function wpbc_booking_modes_disabled_tests_render_page() {

	if ( ! current_user_can( 'activate_plugins' ) ) {
		wp_die(
			esc_html__( 'You are not allowed to run Booking Modes diagnostics.', 'booking' ),
			esc_html__( 'Access denied', 'booking' ),
			array( 'response' => 403 )
		);
	}

	$results = wpbc_booking_modes_disabled_tests_run();
	$metrics = WPBC_Booking_Modes_Disabled_Gate_Test_Metrics::get_metrics();
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Booking Modes Disabled-Gate Tests', 'booking' ); ?></h1>
		<p><?php esc_html_e( 'These checks prove that the Booking Modes runtime remains isolated while the 11.5 master feature gate is disabled. The explicit diagnostics file is the only Booking Modes file loaded for this test.', 'booking' ); ?></p>

		<h2><?php esc_html_e( 'Isolation checks', 'booking' ); ?></h2>
		<table class="widefat striped">
			<thead><tr><th><?php esc_html_e( 'Status', 'booking' ); ?></th><th><?php esc_html_e( 'Check', 'booking' ); ?></th><th><?php esc_html_e( 'Details', 'booking' ); ?></th></tr></thead>
			<tbody>
			<?php foreach ( $results as $test_result ) : ?>
				<tr>
					<td><?php echo esc_html( $test_result['passed'] ? 'PASS' : 'FAIL' ); ?></td>
					<td><?php echo esc_html( $test_result['label'] ); ?></td>
					<td><?php echo esc_html( $test_result['details'] ); ?></td>
				</tr>
			<?php endforeach; ?>
			</tbody>
		</table>

		<h2><?php esc_html_e( 'Disabled-gate request baseline', 'booking' ); ?></h2>
		<table class="widefat striped">
			<tbody>
			<?php foreach ( $metrics as $metric_name => $metric_value ) : ?>
				<tr><th><?php echo esc_html( $metric_name ); ?></th><td><?php echo esc_html( is_float( $metric_value ) ? number_format( $metric_value, 6, '.', '' ) : (string) $metric_value ); ?></td></tr>
			<?php endforeach; ?>
			</tbody>
		</table>

		<p><?php esc_html_e( 'Record this baseline, then enable WPBC_ENABLE_11_5_FEATURES and reopen the same Tools page for the enabled-gate comparison.', 'booking' ); ?></p>
		<p><?php esc_html_e( 'Remove WPBC_ENABLE_BOOKING_MODES_TESTS from wp-config.php when testing is complete.', 'booking' ); ?></p>
	</div>
	<?php
}
