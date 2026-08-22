<?php
/**
 * Dedicated Add Appointment administrator page.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Check whether the Add Appointment tab is the current Booking Calendar page.
 *
 * @return bool True on the Add Appointment tab.
 */
function wpbc_add_appointment_page_is_active() {
	if ( ! is_admin() ) {
		return false;
	}

	$page = isset( $_GET['page'] ) && ! is_array( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$tab  = isset( $_GET['tab'] ) && ! is_array( $_GET['tab'] ) ? sanitize_key( wp_unslash( $_GET['tab'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended

	return 'wpbc' === $page && 'add-appointment' === $tab;
}

/**
 * Return the canonical administrator URL for the Add Appointment workflow.
 *
 * @return string Absolute WordPress administrator URL.
 */
function wpbc_add_appointment_page_get_url() {
	return add_query_arg(
		array(
			'page' => 'wpbc',
			'tab'  => 'add-appointment',
		),
		admin_url( 'admin.php' )
	);
}

/**
 * Read the page-level Appointment options from the current administrator URL.
 *
 * These values configure only the dedicated Add Appointment screen. Service
 * duration, buffers, price, and Booking Form remain owned by the Service.
 *
 * @return array{calendar_months:int,auto_select_provider:bool,allow_past:bool} Normalized page options.
 */
function wpbc_add_appointment_page_get_settings() {
	$months = isset( $_GET['appointment_months'] ) && ! is_array( $_GET['appointment_months'] )
		? absint( wp_unslash( $_GET['appointment_months'] ) ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		: 1;
	$months = min( 12, max( 1, $months ) );

	return array(
		'calendar_months'      => $months,
		'auto_select_provider' => isset( $_GET['appointment_auto_select_provider'] ) && ! is_array( $_GET['appointment_auto_select_provider'] ), // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		'allow_past'           => isset( $_GET['allow_past'] ), // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	);
}

/**
 * Print the legacy booking context required by calendar and submit scripts.
 *
 * Reusing the Add Booking minimum-date calculation keeps past-date behavior
 * identical in both administrator workflows.
 *
 * @param bool $allow_past Whether past dates may be selected and submitted.
 *
 * @return void
 */
function wpbc_add_appointment_page_print_booking_context( $allow_past ) {
	$allow_past_date_arr = WPBC_Add_Booking_Component::get_allow_past_min_date_arr(
		array(
			'allow_past'   => $allow_past ? 1 : 0,
			'booking_hash' => '',
		)
	);
	?>
	<script type="text/javascript">
		if ( 'undefined' !== typeof _wpbc ) {
			_wpbc.set_other_param( 'this_page_booking_hash', '' );
			_wpbc.set_other_param( 'this_page_allow_past', <?php echo wp_json_encode( $allow_past ? 1 : 0 ); ?> );
			_wpbc.set_other_param( 'this_page_allow_past_arr', <?php echo wp_json_encode( $allow_past_date_arr ); ?> );
		}
	</script>
	<?php
}

/**
 * Enqueue the existing Appointment controller and the page-only admin styles.
 *
 * @param string $where_to_load Booking Calendar asset context.
 *
 * @return void
 */
function wpbc_add_appointment_page_enqueue_css( $where_to_load ) {
	if ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) || ! wpbc_add_appointment_page_is_active() ) {
		return;
	}

	wp_enqueue_style(
		'wpbc-add-appointment-page',
		trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/add_appointment_page.css',
		array( 'wpbc-all-admin', 'wpbc-booking-appointment' ),
		WP_BK_VERSION_NUM
	);
}
add_action( 'wpbc_enqueue_css_files', 'wpbc_add_appointment_page_enqueue_css', 73 );

/**
 * Enqueue the existing AJAX Appointment controller and page inspector client.
 *
 * @param string $where_to_load Booking Calendar asset context.
 *
 * @return void
 */
function wpbc_add_appointment_page_enqueue_js( $where_to_load ) {
	if ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) || ! wpbc_add_appointment_page_is_active() ) {
		return;
	}

	wp_enqueue_script(
		'wpbc-add-appointment-page',
		trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/add_appointment_page.js',
		array( 'jquery', 'wpbc-booking-appointment', 'wpbc_all' ),
		WP_BK_VERSION_NUM,
		array( 'in_footer' => WPBC_JS_IN_FOOTER )
	);
	$settings            = wpbc_add_appointment_page_get_settings();
	$allow_past_date_arr = WPBC_Add_Booking_Component::get_allow_past_min_date_arr(
		array(
			'allow_past'   => $settings['allow_past'] ? 1 : 0,
			'booking_hash' => '',
		)
	);

	wp_localize_script(
		'wpbc-add-appointment-page',
		'wpbc_add_appointment_page_config',
		array(
			'emptyLabel'       => __( 'Not selected', 'booking' ),
			'enabledLabel'     => __( 'Enabled', 'booking' ),
			'disabledLabel'    => __( 'Disabled', 'booking' ),
			'minutesLabel'     => __( 'min', 'booking' ),
			'allowPast'        => $settings['allow_past'] ? 1 : 0,
			'allowPastDateArr' => $allow_past_date_arr,
		)
	);
}
add_action( 'wpbc_enqueue_js_files', 'wpbc_add_appointment_page_enqueue_js', 73 );

/**
 * Add Appointment page integrated into the shared Booking Calendar page shell.
 */
class WPBC_Page_Add_Appointment extends WPBC_Page_Structure {

	/**
	 * Place the page beside Booking Listing, Timeline, and Add Booking.
	 *
	 * @return string Parent page slug.
	 */
	public function in_page() {
		if ( ! WPBC_Add_Booking_Component::current_user_can_add_booking() ) {
			return (string) wp_rand( 100000, 1000000 );
		}

		return 'wpbc';
	}

	/**
	 * Register the released Appointment tab and shared inspector layout.
	 *
	 * @return array<string,array<string,mixed>> Tab definition.
	 */
	public function tabs() {
		return array(
			'add-appointment' => array(
				'is_show_top_path'                          => true,
				'is_show_top_navigation'                    => true,
				'left_navigation__default_view_mode'        => 'min',
				'right_vertical_sidebar__is_show'           => true,
				'right_vertical_sidebar__default_view_mode' => '',
				'right_vertical_sidebar_compact__is_show'   => true,
				'page_title'                                => __( 'Add New Appointment', 'booking' ),
				'page_description'                          => __( 'Select a Service and Provider, then create the Appointment with the existing Booking Calendar form.', 'booking' ),
				'title'                                     => __( 'Add Appointment', 'booking' ),
				'hint'                                      => __( 'Add Appointment', 'booking' ),
				'font_icon'                                 => 'wpbc-bi-plus-circle-dotted wpbc_icn_rotate_180',
				'default'                                   => false,
				'disabled'                                  => false,
				'hided'                                     => false,
				'subtabs'                                   => array(),
			),
		);
	}

	/**
	 * Render compact controls for the Appointment inspector.
	 *
	 * @return void
	 */
	public function right_sidebar_compact_content() {
		WPBC_UI_Sidebar_Panels::render_rightbar_tabs(
			array(
				array(
					'id'       => 'wpbc_tab_add_appointment_overview',
					'panel_id' => 'wpbc_add_appointment__inspector_overview',
					'title'    => __( 'Settings', 'booking' ),
					'icon'     => 'wpbc_icn_tune',
					'selected' => true,
				),
				array(
					'id'       => 'wpbc_tab_add_appointment_help',
					'panel_id' => 'wpbc_add_appointment__inspector_help',
					'title'    => __( 'Help', 'booking' ),
					'icon'     => 'wpbc-bi-info-circle',
				),
			),
			array(
				'aria_label' => __( 'Add Appointment Panels', 'booking' ),
				'context'    => 'add_appointment',
				'class'      => 'wpbc_add_appointment__rightbar_tabs',
			)
		);
	}

	/**
	 * Render the standard Builder-style Appointment inspector panels.
	 *
	 * @return void
	 */
	public function right_sidebar_content() {
		?>
		<div class="wpbc_bfb__panel--library wpbc_rightbar_palette wpbc_add_appointment__rightbar">
			<?php
			WPBC_UI_Sidebar_Panels::render_panel(
				array(
					'id'         => 'wpbc_add_appointment__inspector_overview',
					'labelledby' => 'wpbc_tab_add_appointment_overview',
					'class'      => 'wpbc_add_appointment__inspector_overview',
				),
				array( $this, 'render_overview_panel' )
			);
			WPBC_UI_Sidebar_Panels::render_panel(
				array(
					'id'         => 'wpbc_add_appointment__inspector_help',
					'labelledby' => 'wpbc_tab_add_appointment_help',
					'class'      => 'wpbc_add_appointment__inspector_help',
					'hidden'     => true,
				),
				array( $this, 'render_help_panel' )
			);
			?>
		</div>
		<?php
	}

	/**
	 * Render the contextual workflow panel.
	 *
	 * @return void
	 */
	public function render_overview_panel() {
		$settings = wpbc_add_appointment_page_get_settings();
		WPBC_UI_Sidebar_Panels::render_inspector_header( __( 'Appointment Settings', 'booking' ), __( 'Page-level options for this administrator booking.', 'booking' ) );
		?>
		<div class="wpbc_bfb__inspector__body wpbc_add_appointment__inspector_body">
			<?php
			WPBC_UI_Sidebar_Panels::render_collapsible_group(
				array(
					'id'    => 'wpbc_add_appointment_summary_group',
					'group' => 'add-appointment-summary',
					'title' => __( 'Appointment Summary', 'booking' ),
					'open'  => true,
				),
				array( $this, 'render_summary_content' )
			);
			WPBC_UI_Sidebar_Panels::render_collapsible_group(
				array(
					'id'    => 'wpbc_add_appointment_booking_tools_group',
					'group' => 'add-appointment-booking-tools',
					'title' => __( 'Booking tools', 'booking' ),
					'open'  => false,
				),
				function () {
					$send_emails = get_bk_option( 'booking_send_emails_off_addbooking' ) !== 'On';
					?>
					<div class="wpbc_add_appointment__setting_row wpbc_add_appointment__setting_row--toggle">
						<?php
						wpbc_flex_toggle(
							array(
								'id'       => 'is_send_email_for_pending',
								'name'     => 'is_send_email_for_pending',
								'label'    => array( 'title' => __( 'Emails sending', 'booking' ) ),
								'value'    => 'On',
								'selected' => $send_emails,
								'legend'   => __( 'Send email notifications for this Appointment', 'booking' ),
							)
						);
						?>
						<p><?php esc_html_e( 'Send the normal Booking Calendar notifications when this Appointment is created.', 'booking' ); ?></p>
					</div>
					<div class="wpbc_add_appointment__panel_actions wpbc_add_appointment__tool_actions">
						<button type="button" class="button wpbc_add_appointment__autofill" data-wpbc-add-appointment-autofill disabled><?php esc_html_e( 'Auto-fill form', 'booking' ); ?></button>
						<button type="button" class="button wpbc_add_appointment__start_over" data-wpbc-add-appointment-start-over hidden><?php esc_html_e( 'Start over', 'booking' ); ?></button>
					</div>
					<p class="wpbc_add_appointment__tool_help"><?php esc_html_e( 'Auto-fill becomes available after the Booking Form loads. It fills sample contact details but never submits the Appointment.', 'booking' ); ?></p>
					<?php
				}
			);
			WPBC_UI_Sidebar_Panels::render_collapsible_group(
				array(
					'id'    => 'wpbc_add_appointment_booking_options_group',
					'group' => 'add-appointment-booking-options',
					'title' => __( 'Booking options', 'booking' ),
					'open'  => false,
				),
				function () use ( $settings ) {
					?>
					<form class="wpbc_add_appointment__settings_form" method="get" action="<?php echo esc_url( admin_url( 'admin.php' ) ); ?>">
						<input type="hidden" name="page" value="wpbc">
						<input type="hidden" name="tab" value="add-appointment">
						<div class="wpbc_add_appointment__setting_row">
							<label for="wpbc_add_appointment__months"><strong><?php esc_html_e( 'Calendar months', 'booking' ); ?></strong></label>
							<select id="wpbc_add_appointment__months" name="appointment_months">
								<?php foreach ( array( 1, 2, 3, 4, 6, 12 ) as $months ) : ?>
									<option value="<?php echo absint( $months ); ?>" <?php selected( $settings['calendar_months'], $months ); ?>><?php echo absint( $months ); ?></option>
								<?php endforeach; ?>
							</select>
							<p><?php esc_html_e( 'Number of months shown in the Provider calendar.', 'booking' ); ?></p>
						</div>
						<div class="wpbc_add_appointment__setting_row wpbc_add_appointment__setting_row--toggle">
							<?php
							wpbc_flex_toggle(
								array(
									'id'       => 'wpbc_add_appointment__auto_provider',
									'name'     => 'appointment_auto_select_provider',
									'label'    => array( 'title' => __( 'Auto-select the only Provider', 'booking' ) ),
									'value'    => '1',
									'selected' => $settings['auto_select_provider'],
									'legend'   => __( 'Auto-select the only compatible Provider', 'booking' ),
								)
							);
							?>
							<p><?php esc_html_e( 'Skip Provider selection when only one compatible Provider exists.', 'booking' ); ?></p>
						</div>
						<div class="wpbc_add_appointment__setting_row wpbc_add_appointment__setting_row--toggle">
							<?php
							wpbc_flex_toggle(
								array(
									'id'       => 'wpbc_add_appointment__allow_past',
									'name'     => 'allow_past',
									'label'    => array( 'title' => __( 'Allow booking in the past', 'booking' ) ),
									'value'    => '1',
									'selected' => $settings['allow_past'],
									'legend'   => __( 'Allow booking in the past', 'booking' ),
								)
							);
							?>
							<p><?php esc_html_e( 'Use only for historical or manually entered Appointments.', 'booking' ); ?></p>
						</div>
						<button type="submit" class="button button-primary wpbc_add_appointment__apply_settings"><?php esc_html_e( 'Apply settings', 'booking' ); ?></button>
						<p class="wpbc_add_appointment__settings_notice"><?php esc_html_e( 'Applying settings restarts the current selection.', 'booking' ); ?></p>
					</form>
					<?php
				}
			);
			WPBC_UI_Sidebar_Panels::render_collapsible_group(
				array(
					'id'    => 'wpbc_add_appointment_manage_setup_group',
					'group' => 'add-appointment-manage-setup',
					'title' => __( 'Manage setup', 'booking' ),
					'open'  => false,
				),
				function () {
					?>
					<p><?php
						if ( wpbc_appointment_services_is_pricing_available() ) {
							esc_html_e( 'Services define duration, buffers, price, and Booking Form. Providers retain their existing calendars and availability.', 'booking' );
						} else {
							esc_html_e( 'Services define duration, buffers, and Booking Form. Providers retain their existing calendars and availability.', 'booking' );
						}
					?></p>
					<div class="wpbc_add_appointment__panel_actions">
						<a class="button" href="<?php echo esc_url( admin_url( 'admin.php?page=wpbc-services' ) ); ?>"><?php esc_html_e( 'Manage Services', 'booking' ); ?></a>
						<a class="button" href="<?php echo esc_url( admin_url( 'admin.php?page=wpbc-resources' ) ); ?>"><?php esc_html_e( 'Manage Providers', 'booking' ); ?></a>
					</div>
					<?php
				}
			);
			do_action( 'wpbc_admin_add_appointment_overview_panel' );
			?>
		</div>
		<?php
	}

	/**
	 * Render a live, read-only summary of the current Appointment stage.
	 *
	 * @return void
	 */
	public function render_summary_content() {
		?>
		<dl class="wpbc_add_appointment__summary" aria-live="polite">
			<div class="wpbc_add_appointment__summary_status"><dt><?php esc_html_e( 'Current step', 'booking' ); ?></dt><dd data-wpbc-add-appointment-summary="step"><?php esc_html_e( 'Service', 'booking' ); ?></dd></div>
			<div><dt><?php esc_html_e( 'Service', 'booking' ); ?></dt><dd data-wpbc-add-appointment-summary="service">&mdash;</dd></div>
			<div><dt><?php esc_html_e( 'Provider', 'booking' ); ?></dt><dd data-wpbc-add-appointment-summary="provider">&mdash;</dd></div>
			<div><dt><?php esc_html_e( 'Duration', 'booking' ); ?></dt><dd data-wpbc-add-appointment-summary="duration">&mdash;</dd></div>
			<div><dt><?php esc_html_e( 'Buffers (before / after)', 'booking' ); ?></dt><dd data-wpbc-add-appointment-summary="buffers">&mdash;</dd></div>
			<?php if ( wpbc_appointment_services_is_pricing_available() ) : ?>
				<div><dt><?php esc_html_e( 'Service price', 'booking' ); ?></dt><dd data-wpbc-add-appointment-summary="price">&mdash;</dd></div>
			<?php endif; ?>
			<div><dt><?php esc_html_e( 'Date', 'booking' ); ?></dt><dd data-wpbc-add-appointment-summary="date">&mdash;</dd></div>
			<div><dt><?php esc_html_e( 'Start time', 'booking' ); ?></dt><dd data-wpbc-add-appointment-summary="time">&mdash;</dd></div>
			<div><dt><?php esc_html_e( 'Customer', 'booking' ); ?></dt><dd data-wpbc-add-appointment-summary="customer">&mdash;</dd></div>
			<div><dt><?php esc_html_e( 'Booking Form', 'booking' ); ?></dt><dd data-wpbc-add-appointment-summary="form">&mdash;</dd></div>
			<div>
				<dt><?php esc_html_e( 'Email notifications', 'booking' ); ?></dt>
				<dd>
					<a href="#wpbc_add_appointment_booking_tools_group"
						class="wpbc_add_appointment__summary_link"
						data-wpbc-add-appointment-open-group="add-appointment-booking-tools"
						data-wpbc-add-appointment-focus="#is_send_email_for_pending"
						data-wpbc-add-appointment-summary="emails"
						aria-label="<?php esc_attr_e( 'Change email notification setting', 'booking' ); ?>">&mdash;</a>
				</dd>
			</div>
		</dl>
		<?php do_action( 'wpbc_admin_add_appointment_summary_panel' ); ?>
		<?php
	}

	/**
	 * Render contextual help without duplicating Booking Calendar settings.
	 *
	 * @return void
	 */
	public function render_help_panel() {
		WPBC_UI_Sidebar_Panels::render_inspector_header( __( 'Appointment Help', 'booking' ), __( 'This page creates a normal Booking with an attached Service snapshot.', 'booking' ) );
		?>
		<div class="wpbc_bfb__inspector__body wpbc_bfb__inspector__body--content wpbc_add_appointment__help_body">
			<div class="wpbc_add_appointment__hint"><span class="wpbc_icn_info_outline" aria-hidden="true"></span><p><?php esc_html_e( 'Availability belongs to the selected Provider booking resource. Service duration and buffers are validated before submission.', 'booking' ); ?></p></div>
			<div class="wpbc_add_appointment__help_section">
				<h4><?php esc_html_e( 'Appointment Flow', 'booking' ); ?></h4>
				<ol class="wpbc_add_appointment__steps">
					<li><span>1</span><?php esc_html_e( 'Choose a Service', 'booking' ); ?></li>
					<li><span>2</span><?php esc_html_e( 'Choose a Provider', 'booking' ); ?></li>
					<li><span>3</span><?php esc_html_e( 'Select date, time, and details', 'booking' ); ?></li>
				</ol>
			</div>
			<div class="wpbc_add_appointment__help_section">
				<h4><?php esc_html_e( 'When to use this page', 'booking' ); ?></h4>
				<p><?php esc_html_e( 'Use Add Appointment for the guided Service-first workflow. Use Add Booking for unrestricted resource-first administration.', 'booking' ); ?></p>
			</div>
			<a class="button wpbc_add_appointment__help_action" href="<?php echo esc_url( wpbc_get_new_booking_url() ); ?>"><?php esc_html_e( 'Open Add Booking', 'booking' ); ?></a>
			<?php do_action( 'wpbc_admin_add_appointment_help_panel' ); ?>
		</div>
		<?php
	}

	/**
	 * Render the existing AJAX Appointment component inside the admin canvas.
	 *
	 * @return void|false False when the current user cannot add bookings.
	 */
	public function content() {
		do_action( 'wpbc_hook_add_booking_page_header', 'add_appointment' );

		if ( ! wpbc_is_mu_user_can_be_here( 'activated_user' ) || ! WPBC_Add_Booking_Component::current_user_can_add_booking() ) {
			return false;
		}

		if ( function_exists( 'wpbc_js_for_bookings_page' ) ) {
			wpbc_js_for_bookings_page();
		}

		$settings = wpbc_add_appointment_page_get_settings();
		$config   = array(
			'cal_count'            => $settings['calendar_months'],
			'auto_select_provider' => $settings['auto_select_provider'],
			'allow_past'           => $settings['allow_past'],
		);
		$config = (array) apply_filters( 'wpbc_admin_add_appointment_config', $config, $settings );
		wpbc_add_appointment_page_print_booking_context( $settings['allow_past'] );
		?>
		<div class="wpbc_add_appointment_page wpdevelop" data-wpbc-add-appointment-page="1">
			<div class="wpbc_add_appointment__canvas">
				<?php echo wpbc_booking_appointment_shortcode( $config ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
			</div>
		</div>
		<?php

		do_action( 'wpbc_hook_add_booking_page_footer', 'add_appointment' );
	}
}
add_action( 'wpbc_menu_created', array( new WPBC_Page_Add_Appointment(), '__construct' ) );
