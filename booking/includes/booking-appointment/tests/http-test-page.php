<?php
/**
 * Authenticated browser diagnostics page for the Appointment Flow.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/runtime-test-suite.php';
require_once __DIR__ . '/creation-test-controller.php';

/**
 * Register the temporary Appointment test page under WordPress Tools.
 *
 * @return void
 */
function wpbc_appointment_tests_register_page() {
	$hook = add_management_page(
		__( 'Appointment Flow Tests', 'booking' ),
		__( 'Appointment Flow Tests', 'booking' ),
		'activate_plugins',
		'wpbc-appointment-tests',
		'wpbc_appointment_tests_render_page'
	);
	if ( $hook ) {
		add_action( 'load-' . $hook, 'wpbc_appointment_tests_prepare_page' );
	}
}
add_action( 'admin_menu', 'wpbc_appointment_tests_register_page', 99 );

/**
 * Enqueue the browser runner only for the authenticated diagnostics page.
 *
 * @return void
 */
function wpbc_appointment_tests_prepare_page() {
	if ( ! current_user_can( 'activate_plugins' ) ) {
		wp_die(
			esc_html__( 'You are not allowed to run Appointment Flow tests.', 'booking' ),
			esc_html__( 'Access denied', 'booking' ),
			array( 'response' => 403 )
		);
	}

	wp_enqueue_script(
		'wpbc-appointment-http-tests',
		plugins_url( 'http-test-runner.js', __FILE__ ),
		array(),
		defined( 'WP_BK_VERSION_NUM' ) ? WP_BK_VERSION_NUM : '1.0.0',
		true
	);
}

/**
 * Render the server results and configure real browser-to-WordPress HTTP tests.
 *
 * @return void
 */
function wpbc_appointment_tests_render_page() {
	if ( ! current_user_can( 'activate_plugins' ) ) {
		wp_die(
			esc_html__( 'You are not allowed to run Appointment Flow tests.', 'booking' ),
			esc_html__( 'Access denied', 'booking' ),
			array( 'response' => 403 )
		);
	}

	$suite            = wpbc_appointment_tests_run_runtime();
	$fixture          = wpbc_appointment_tests_get_http_fixture( $suite['catalog'] );
	$creation_fixtures = wpbc_appointment_tests_get_http_fixtures( $suite['catalog'] );
	$http_test_config = $suite['feature_enabled']
		? wpbc_booking_appointment_normalize_config( array( 'return_url' => home_url( '/' ) ) )
		: array();
	$config           = array(
		'ajax_url'        => admin_url( 'admin-ajax.php' ),
		'action'          => 'WPBC_AJX_BOOKING_APPOINTMENT_RESOLVE',
		'validate_action' => 'WPBC_AJX_BOOKING_APPOINTMENT_VALIDATE_TIME',
		'nonce'           => wp_create_nonce( 'wpbc_booking_appointment_ajax' ),
		'config_token'    => $suite['feature_enabled'] ? wpbc_booking_appointment_encode_config( $http_test_config ) : '',
		'feature_enabled' => (bool) $suite['feature_enabled'],
		'service_id'      => $fixture['service_id'],
		'provider_id'     => $fixture['provider_id'],
		'duration_minutes' => $fixture['duration_minutes'],
		'service_cost'    => $fixture['service_cost'],
		'form_slug'       => $fixture['form_slug'],
		'creation_enabled' => wpbc_appointment_creation_tests_are_enabled(),
		'creation_prepare_action' => 'WPBC_AJX_APPOINTMENT_TEST_PREPARE',
		'creation_cleanup_action' => 'WPBC_AJX_APPOINTMENT_TEST_CLEANUP',
		'creation_nonce'  => wp_create_nonce( 'wpbc_appointment_creation_tests' ),
		'create_action'   => 'WPBC_AJX_BOOKING__CREATE',
		'create_nonce'    => wp_create_nonce( 'wpbc_calendar_load_ajx' . '_wpbcnonce' ),
		'create_user_id'  => function_exists( 'wpbc_get_current_user_id' ) ? wpbc_get_current_user_id() : get_current_user_id(),
		'create_locale'   => determine_locale(),
		'default_test_date' => wp_date( 'Y-m-d', strtotime( '+30 days' ) ),
	);
	wp_add_inline_script( 'wpbc-appointment-http-tests', 'window.wpbc_appointment_http_test_config = ' . wp_json_encode( $config ) . ';', 'before' );
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Appointment Flow HTTP Tests', 'booking' ); ?></h1>
		<p>
			<?php esc_html_e( 'The automatic diagnostics are read-only. They validate the loaded WordPress runtime and send real browser requests to the existing Appointment AJAX endpoints. Controlled booking creation is separately gated, confirmed, and never runs automatically.', 'booking' ); ?>
		</p>
		<p>
			<strong><?php esc_html_e( 'Feature gate:', 'booking' ); ?></strong>
			<?php echo $suite['feature_enabled'] ? esc_html__( 'enabled', 'booking' ) : esc_html__( 'disabled', 'booking' ); ?>
			&nbsp;|&nbsp;
			<strong><?php esc_html_e( 'HTTP fixture:', 'booking' ); ?></strong>
			<?php
			if ( $fixture['service_id'] && $fixture['provider_id'] ) {
				echo esc_html( sprintf( 'Service #%d / Provider #%d', $fixture['service_id'], $fixture['provider_id'] ) );
			} else {
				esc_html_e( 'No active Service/Provider pair', 'booking' );
			}
			?>
		</p>

		<h2><?php esc_html_e( 'WordPress runtime', 'booking' ); ?></h2>
		<table class="widefat striped" style="max-width:1100px">
			<thead><tr><th style="width:90px"><?php esc_html_e( 'Result', 'booking' ); ?></th><th><?php esc_html_e( 'Check', 'booking' ); ?></th><th><?php esc_html_e( 'Details', 'booking' ); ?></th></tr></thead>
			<tbody>
			<?php foreach ( $suite['results'] as $result ) : ?>
				<?php $result_status = ! empty( $result['skipped'] ) ? 'SKIP' : ( $result['passed'] ? 'PASS' : 'FAIL' ); ?>
				<tr>
					<td><strong style="color:<?php echo ! empty( $result['skipped'] ) ? '#996800' : ( $result['passed'] ? '#008a20' : '#b32d2e' ); ?>"><?php echo esc_html( $result_status ); ?></strong></td>
					<td><?php echo esc_html( $result['label'] ); ?></td>
					<td><?php echo esc_html( $result['passed'] ? '' : $result['details'] ); ?></td>
				</tr>
			<?php endforeach; ?>
			</tbody>
		</table>

		<h2><?php esc_html_e( 'Controlled booking creation', 'booking' ); ?></h2>
		<?php if ( wpbc_appointment_creation_tests_are_enabled() ) : ?>
			<div class="notice notice-warning inline" style="max-width:1060px;padding:12px 16px">
				<p><strong><?php esc_html_e( 'Use only on a disposable test website.', 'booking' ); ?></strong></p>
				<p><?php esc_html_e( 'This test sends one real request to the normal booking-creation endpoint. Emails are disabled and the exact marker-owned booking is deleted immediately, but payment and third-party booking hooks can still run.', 'booking' ); ?></p>
			</div>
			<div style="max-width:1100px;display:flex;flex-wrap:wrap;gap:14px;align-items:end;margin:14px 0">
				<label><strong><?php esc_html_e( 'Service and Provider', 'booking' ); ?></strong><br>
					<select id="wpbc-appointment-creation-fixture">
						<?php if ( empty( $creation_fixtures ) ) : ?>
							<option value=""><?php esc_html_e( 'No active Service/Provider pair', 'booking' ); ?></option>
						<?php endif; ?>
						<?php foreach ( $creation_fixtures as $creation_fixture ) : ?>
							<option value="<?php echo esc_attr( $creation_fixture['service_id'] . ':' . $creation_fixture['provider_id'] ); ?>"><?php echo esc_html( $creation_fixture['label'] ); ?></option>
						<?php endforeach; ?>
					</select>
				</label>
				<label><strong><?php esc_html_e( 'Test date', 'booking' ); ?></strong><br><input type="date" id="wpbc-appointment-creation-date" value="<?php echo esc_attr( $config['default_test_date'] ); ?>"></label>
				<label><strong><?php esc_html_e( 'Start Time', 'booking' ); ?></strong><br><input type="time" id="wpbc-appointment-creation-time" value="10:00"></label>
				<label style="max-width:520px"><input type="checkbox" id="wpbc-appointment-creation-confirm"> <?php esc_html_e( 'I understand that this creates a real test booking and then permanently deletes only that marked fixture.', 'booking' ); ?></label>
				<button type="button" class="button button-primary" id="wpbc-run-appointment-creation-tests"<?php disabled( empty( $creation_fixtures ) ); ?>><?php esc_html_e( 'Create, verify, and clean up', 'booking' ); ?></button>
				<button type="button" class="button" id="wpbc-clean-appointment-creation-tests"><?php esc_html_e( 'Clean pending fixtures', 'booking' ); ?></button>
			</div>
			<table class="widefat striped" style="max-width:1100px">
				<thead><tr><th style="width:90px"><?php esc_html_e( 'Result', 'booking' ); ?></th><th><?php esc_html_e( 'Creation check', 'booking' ); ?></th><th><?php esc_html_e( 'Details', 'booking' ); ?></th></tr></thead>
				<tbody id="wpbc-appointment-creation-test-results"><tr><td>WAIT</td><td><?php esc_html_e( 'Creation tests never run automatically.', 'booking' ); ?></td><td></td></tr></tbody>
			</table>
		<?php else : ?>
			<p><?php esc_html_e( 'Booking creation is disabled. On a disposable test website, enable the 11.5 feature gate and define WPBC_ENABLE_APPOINTMENT_CREATION_TESTS as strict true to expose the confirmed creation and cleanup controls.', 'booking' ); ?></p>
		<?php endif; ?>

		<h2><?php esc_html_e( 'Browser HTTP requests', 'booking' ); ?></h2>
		<p><button type="button" class="button button-primary" id="wpbc-run-appointment-http-tests"><?php esc_html_e( 'Run HTTP tests again', 'booking' ); ?></button></p>
		<table class="widefat striped" style="max-width:1100px">
			<thead><tr><th style="width:90px"><?php esc_html_e( 'Result', 'booking' ); ?></th><th><?php esc_html_e( 'HTTP check', 'booking' ); ?></th><th><?php esc_html_e( 'Details', 'booking' ); ?></th></tr></thead>
			<tbody id="wpbc-appointment-http-test-results"><tr><td>WAIT</td><td><?php esc_html_e( 'Waiting for the browser runner', 'booking' ); ?></td><td></td></tr></tbody>
		</table>

		<h2><?php esc_html_e( 'Appointment acceptance check', 'booking' ); ?></h2>
		<p><?php esc_html_e( 'After the read-only checks pass, complete this short manual check on a disposable Appointment page:', 'booking' ); ?></p>
		<ol style="max-width:1100px;line-height:1.7">
			<li><?php esc_html_e( 'Confirm the standard Setup Wizard retains its established booking-type workflow and native WordPress admin button colors.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Confirm the WordPress submenu exposes Services while the 11.5 feature gate is enabled, and the Booking Calendar navigation exposes Bookings, Timeline View, Add Booking, and Add Appointment without duplicate entries.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Open Booking Listing and confirm the Service filter restricts results to immutable Appointment snapshots while the native Resource filter and ownership rules remain unchanged.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Open the Booking Listing Add Booking popup. Confirm Add Appointment is available while adding, normal Add booking remains the primary action, and Add Appointment is hidden while editing an existing booking.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Open Providers. Confirm Providers remain Booking Resources and the Working Hours, Days Off, and Service Assignments links open the established availability and Services screens.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Verify the Services screen clearly explains no Services, no Providers, a Service without assigned Providers, and a Provider without weekly availability.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'On Services, confirm the Status column header contains independent Status and ID sorting controls, and every row displays its status badge and Service ID together in that column. Repeat after search, sorting, pagination, and AJAX refreshes, and confirm both controls sort the complete result set before pagination.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'On Services, confirm every editor field uses the standard Inspector layout. Select a Service picture from the WordPress Media Library, save, reload, and verify the picture remains visible in the management table and the public Service choice. Remove it, save again, and confirm both views return to their no-picture layout.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Repeat the administration checks in Free and commercial editions. In MultiUser, confirm a regular user sees only owned Services and authorized Provider resources, while a super administrator retains the expected wider access.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'In Free and Personal, confirm the Services table and Appointment flow do not display a price, the Pricing inspector shows a clear Business Small upgrade explanation instead of an editable field, and saving another Service field does not erase a price previously stored by a paid edition. In Business Small or higher, confirm Service pricing remains editable and visible.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Confirm the Add Appointment Service-first controller works inside the shared admin canvas. Verify Settings and Help switch correctly, Appointment Summary is first and expanded, all other Settings groups are collapsed, and Appointment Flow appears in Help only.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'On a public Appointment page, confirm show_progress="off" removes the complete numbered progress line through every AJAX stage. Then set progress_item_1_title="" and progress_item_1_number="01/03", configure the remaining indexed progress values, and confirm they remain unchanged after selecting a Service and Provider. Configure screen_1_title, screen_1_description, screen_2_title, and screen_2_description, including empty values, and confirm each screen uses the requested copy while omitted parameters retain their defaults.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'While signed out, render [booking_appointment calendar_dates_start="2026-01-30" allow_past="on"], select an available historical date and time, and confirm the Appointment is saved. Remove allow_past and confirm the same historical submission remains unavailable.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Select a Service and Provider, then a date and Start Time, and enter customer details. Confirm Appointment Summary updates each value immediately without changing booking availability.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Click the Summary email status and confirm Booking tools expands, scrolls into view, and focuses Emails sending. Toggle it and confirm the Summary changes immediately. Submit both states on disposable bookings and confirm native Booking Calendar email behavior follows the toggle.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Confirm Auto-select Provider is disabled initially and a Service with one compatible Provider still shows the Provider step. Then enable Auto-select Provider, apply the options, and confirm that Provider is selected automatically. Also confirm applying options restarts selection, the URL contains allow_past=1 when enabled, and the Provider calendar loads real availability for both past and future dates.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Confirm Auto-fill is disabled before the Booking Form loads, fills only sample contact fields afterward, and never selects a date/time or submits the Appointment.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Choose a Service and two Providers with different duration overrides. Confirm the Service says that duration varies and each Provider shows its effective duration.', 'booking' ); ?></li>
			<?php if ( wpbc_appointment_services_is_pricing_available() ) : ?>
				<li><?php esc_html_e( 'Configure different Provider price overrides. Confirm each Provider shows its effective price and the native cost hints use that Service price before extras and discounts.', 'booking' ); ?></li>
			<?php endif; ?>
			<li><?php esc_html_e( 'Assign a published Booking Form to the Service. Confirm it loads when form_type is omitted, while an explicit shortcode form_type still wins.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Assign a Booking Form without Start Time and open the Appointment flow while signed in as an authorized administrator. Confirm the warning includes Select Booking Form; clicking it opens the exact Service, reveals the right inspector, expands and highlights Booking Form, and focuses its selector. Confirm signed-out visitors see only the escaped warning text.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Create one Appointment and confirm the saved end time equals start time plus the effective Provider duration.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Verify adjacent zero-buffer times can be booked, then add a buffer and confirm the overlapping adjacent time is rejected.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Select a date with buffered Appointments. Confirm invalid Start Time options are disabled or omitted while valid options remain selectable.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Open the browser console and confirm the Service-aware check reports duration, buffers, blocked Start Times, and requested Provider-reserved intervals without customer data.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Select a start whose Service duration or buffer overlaps another Appointment. Confirm the warning appears below Start Time and the wizard does not advance.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Reload this panel, then verify the snapshot checks pass and the Service appears in Booking Listing, print output, and CSV export.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Expand the Appointment in Booking Listing. Confirm its dedicated Appointment details row appears and the bottom system line shows Buffer and Blocked values when buffers are non-zero.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Open the Appointment in Timeline and confirm Appointment time, buffers, and Provider reserved time are clearly distinguished.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Add the Appointment shortcodes to confirmation and email templates. Verify the saved Service, Provider, and duration are shown. In Business Small or higher, also verify Service price and payment-description replacements.', 'booking' ); ?></li>
		</ol>

		<h2><?php esc_html_e( 'Phase 6 compatibility matrix', 'booking' ); ?></h2>
		<p><?php esc_html_e( 'Complete these environment-dependent checks after the automatic WordPress runtime and HTTP checks pass:', 'booking' ); ?></p>
		<ol style="max-width:1100px;line-height:1.7">
			<li><?php esc_html_e( 'Complete Service to Provider to Date and Time to Details using both the standard Booking Form and a custom multi-step Booking Form. Verify Back preserves valid selections, forward navigation waits for time preflight, and Start over returns only that Appointment component to Service selection without reloading the page.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Place two Appointment shortcodes or blocks on one page. Verify different Providers operate independently and opening the same Provider twice shows the controlled duplicate-Provider warning instead of initializing conflicting native forms.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'On a disposable capacity-one Provider and future time, submit two browser requests as simultaneously as practical. Exactly one booking may succeed; the other must be rejected by the normal authoritative availability pipeline. Remove the successful test booking afterward.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Render and submit representative legacy [booking], [bookingform], and [bookingselect] pages with the 11.5 gate enabled. Confirm their resource IDs, calendars, forms, validation, pricing, and save behavior remain unchanged.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Repeat protected page and AJAX requests as an administrator, an unauthorized signed-in user, and a signed-out visitor. Confirm capabilities, ownership, and nonces prevent Service, Provider, test-panel, and administration access without exposing private data.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Repeat Service, Provider, listing, Add Appointment, and booking checks in Free and every available commercial edition. In MultiUser, verify regular-user isolation, super-administrator access, and site-owner boundaries.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'At desktop and narrow mobile widths, complete the flow using mouse, touch, and keyboard only. Verify visible focus, radio-card selection, disabled Start Times, wizard navigation, notices, inspector panels, and Start over remain understandable and operable.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Run this panel once with both test and 11.5 feature constants enabled, then again with only the test constant enabled. The disabled-gate run must report Services, Appointment pages, endpoints, schema callbacks, and assets as unloaded.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Upgrade a copy of an existing 11.4.3 or 11.4.4 website containing bookings, resources, forms, pricing, and availability. Confirm Classic remains selected, existing data is unchanged, the Appointment schema upgrades once, one active Consultation Service is created and assigned to the default Provider, and disabling the 11.5 gate leaves core bookings usable. Confirm later visits do not recreate a Service after the catalog is intentionally emptied.', 'booking' ); ?></li>
			<li><?php esc_html_e( 'Test ordinary activation, deactivation, reactivation, multisite and network activation, rollback to the supported maintenance package, and separately confirmed full data removal. Never run removal or concurrent-creation checks against production data.', 'booking' ); ?></li>
		</ol>

		<p style="max-width:1100px;margin-top:20px">
			<strong><?php esc_html_e( 'Security:', 'booking' ); ?></strong>
			<?php esc_html_e( 'Remove WPBC_ENABLE_APPOINTMENT_TESTS from wp-config.php when testing is complete. This page is available only to administrators who can activate plugins.', 'booking' ); ?>
		</p>
	</div>
	<?php
}
