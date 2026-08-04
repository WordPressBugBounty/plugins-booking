<?php
/** AJAX Appointment Services admin page. @package Booking Calendar */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Enqueue Appointment Services management-page styles.
 *
 * @param string $where_to_load Booking Calendar asset context.
 *
 * @return void
 */
function wpbc_appointment_services_enqueue_css( $where_to_load ) {
	if ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) ) {
		return;
	}

	$is_resources_page_with_mode_guide = function_exists( 'wpbc_is_resources_page' )
		&& wpbc_is_resources_page()
		&& function_exists( 'wpbc_is_11_5_features_enabled' )
		&& wpbc_is_11_5_features_enabled();

	if ( $is_resources_page_with_mode_guide ) {
		wp_enqueue_style(
			'wpbc-appointment-provider-tools',
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/appointment_provider_tools.css',
			array(),
			WP_BK_VERSION_NUM
		);
	}

	if ( ! wpbc_appointment_services__is_page() ) {
		return;
	}

	WPBC_UI_Listing::enqueue_styles();
	wp_enqueue_style( 'wpbc-appointment-services-page', trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/appointment_services_page.css', array( 'wpbc-ui-listing' ), WP_BK_VERSION_NUM );
}
add_action( 'wpbc_enqueue_css_files', 'wpbc_appointment_services_enqueue_css', 66 );


/**
 * Resolve the Service that should be selected when the catalog first opens.
 *
 * An explicit `service_id` request always wins. The first owner-visible active
 * Service is selected automatically only on the Service and Provider Setup
 * Wizard step, leaving ordinary Services-page visits unchanged.
 *
 * @return int Initial Service ID, or zero when the inspector should stay closed.
 */
function wpbc_appointment_services_get_initial_service_id() {

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only selection state.
	$requested_service_id = isset( $_GET['service_id'] ) && is_scalar( $_GET['service_id'] )
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only selection state.
		? absint( wp_unslash( $_GET['service_id'] ) )
		: 0;

	if ( $requested_service_id ) {
		return $requested_service_id;
	}

	if (
		! function_exists( 'wpbc_setup_wizard_page__is_active_step' )
		|| ! wpbc_setup_wizard_page__is_active_step( 'service_provider' )
		|| ! function_exists( 'wpbc_appointment_services_repository' )
	) {
		return 0;
	}

	$services = wpbc_appointment_services_repository()->list_items(
		array(
			'status'     => 'active',
			'sort_by'    => 'service_id',
			'sort_order' => 'asc',
			'limit'      => 1,
		)
	);

	if ( is_wp_error( $services ) || empty( $services[0]['service_id'] ) ) {
		return 0;
	}

	return absint( $services[0]['service_id'] );
}


/**
 * Enqueue and configure the AJAX Appointment Services management client.
 *
 * @param string $where_to_load Booking Calendar asset context.
 *
 * @return void
 */
function wpbc_appointment_services_enqueue_js( $where_to_load ) {
	if ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) || ! wpbc_appointment_services__is_page() ) {
		return;
	}
	wpbc_load_js__required_for_media_upload();
	$service_listing     = wpbc_appointment_services_get_catalog_listing();
	$selected_service_id = wpbc_appointment_services_get_initial_service_id();
	wp_enqueue_script( 'wpbc-appointment-services-page', trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/appointment_services_page.js', array(
		'jquery',
		'wpbc_all',
	), WP_BK_VERSION_NUM, array( 'in_footer' => WPBC_JS_IN_FOOTER ) );

	wp_localize_script( 'wpbc-appointment-services-page', 'wpbc_appointment_services_config', array(
			'ajax_url'        => admin_url( 'admin-ajax.php' ),
			'nonce'           => wp_create_nonce( 'wpbc_appointment_services_ajax_nonce' ),
			'actions'         => array(
				'list'      => 'WPBC_AJX_APPOINTMENT_SERVICES_LIST',
				'load'      => 'WPBC_AJX_APPOINTMENT_SERVICE_LOAD',
				'save'      => 'WPBC_AJX_APPOINTMENT_SERVICE_SAVE',
				'duplicate' => 'WPBC_AJX_APPOINTMENT_SERVICE_DUPLICATE',
				'archive'   => 'WPBC_AJX_APPOINTMENT_SERVICE_ARCHIVE',
			),
			'selected_id'     => $selected_service_id,
			'focus_section'   => wpbc_appointment_services_get_requested_focus_section(),
			'pricing_available' => wpbc_appointment_services_is_pricing_available(),
			'listing'         => $service_listing->get_client_settings(),
			'i18n'            => array(
				'loading'          => __( 'Loading Services', 'booking' ) . '...',
				'empty'            => __( 'No Services yet', 'booking' ),
				'empty_help'       => __( 'Create the first Service to define what customers can book.', 'booking' ),
				'no_providers'     => __( 'No Providers available', 'booking' ),
				'no_providers_help'=> __( 'Create a Provider before assigning Services and accepting Appointments.', 'booking' ),
				'not_connected'    => __( 'The Services database is not ready. Reload this page as an administrator or reactivate Booking Calendar to finish the database upgrade.', 'booking' ),
				'load_failed'      => __( 'Services could not be loaded.', 'booking' ),
				'save_failed'      => __( 'The Service could not be saved.', 'booking' ),
				'duplicate_failed' => __( 'The Service could not be duplicated.', 'booking' ),
				'archive_failed'   => __( 'The Service could not be archived.', 'booking' ),
				'confirm_archive'  => __( 'Archive this Service?', 'booking' ),
				'confirm_discard'  => __( 'Discard unsaved Service changes?', 'booking' ),
				'untitled'         => __( 'Untitled Service', 'booking' ),
				'new_service'      => __( 'New Service', 'booking' ),
				'active'           => __( 'Active', 'booking' ),
				'draft'            => __( 'Draft', 'booking' ),
				'archived'         => __( 'Archived', 'booking' ),
				'no_provider'      => __( 'No Providers assigned', 'booking' ),
				'no_availability'  => __( 'No weekly availability', 'booking' ),
				'more_providers'   => __( 'more Providers', 'booking' ),
				'available'                  => __( 'Available', 'booking' ),
				'unavailable'                => __( 'Unavailable', 'booking' ),
				'available_providers'        => __( 'Available Providers: %s', 'booking' ),
				'no_available_providers'     => __( 'No assigned Providers are available', 'booking' ),
				'edit_availability'          => __( 'Edit availability for %s', 'booking' ),
				'edit_provider_availability' => __( 'Edit Provider availability', 'booking' ),
				'column_id'                   => __( 'ID', 'booking' ),
				'column_service'              => __( 'Service', 'booking' ),
				'column_duration'             => __( 'Duration', 'booking' ),
				'column_price'                => __( 'Price', 'booking' ),
				'column_providers'            => __( 'Providers', 'booking' ),
				'column_weekly_availability'  => __( 'Weekly Availability', 'booking' ),
				'column_status'               => __( 'Status', 'booking' ),
				'column_actions'              => __( 'Actions', 'booking' ),
				/* translators: %s: Duration in minutes. */
				'duration_minutes'            => __( '%s min', 'booking' ),
				/* translators: 1: Buffer before in minutes, 2: Buffer after in minutes. */
				'buffers_summary'             => __( 'Buffers: %1$s / %2$s min', 'booking' ),
				/* translators: 1: Buffer before in minutes, 2: Buffer after in minutes. */
				'buffers_tooltip'             => __( 'Buffer before: %1$s min; Buffer after: %2$s min', 'booking' ),
				/* translators: 1: Service title, 2: Service description. */
				'service_thumbnail_tooltip'   => __( 'Title: %1$s — Description: %2$s', 'booking' ),
				'no_description'              => __( 'No description', 'booking' ),
				'edit'                       => __( 'Edit Service', 'booking' ),
				'archive'                    => __( 'Archive Service', 'booking' ),
				'showing'          => __( 'Showing %1$s–%2$s of %3$s Services', 'booking' ),
			),
			'currency_symbol' => wpbc_appointment_services_is_pricing_available() && function_exists( 'wpbc_get_currency_symbol' ) ? wpbc_get_currency_symbol() : '',
			'weekdays'        => array(
				__( 'Monday', 'booking' ),
				__( 'Tuesday', 'booking' ),
				__( 'Wednesday', 'booking' ),
				__( 'Thursday', 'booking' ),
				__( 'Friday', 'booking' ),
				__( 'Saturday', 'booking' ),
				__( 'Sunday', 'booking' ),
			),
		) );
}
add_action( 'wpbc_enqueue_js_files', 'wpbc_appointment_services_enqueue_js', 66 );

/**
 * Render the global Add Service action in the Booking Calendar top toolbar.
 *
 * Creating a Service is a page-level action, while saving remains contextual
 * to the Service editor in the right inspector.
 *
 * @param string $page_tag           Current Booking Calendar page tag.
 * @param string $active_page_tab    Current active page tab.
 * @param string $active_page_subtab Current active page subtab.
 *
 * @return void
 */
function wpbc_appointment_services_render_top_toolbar( $page_tag, $active_page_tab, $active_page_subtab ) {
	if (
		! wpbc_appointment_services__is_page()
		|| ! current_user_can( wpbc_appointment_services_get_manage_capability() )
	) {
		return;
	}
	?>
	<div class="wpbc_ui_el__buttons_group wpbc_appointment_services__top_toolbar">
		<button type="button" class="button button-secondary wpbc_appointment_services__add" disabled>
			<span class="wpbc-bi-plus-lg" aria-hidden="true"></span>
			<?php esc_html_e( 'Add Service', 'booking' ); ?>
		</button>
	</div>
	<?php
}
add_action( 'wpbc_ui_el__top_nav__content_end', 'wpbc_appointment_services_render_top_toolbar', 20, 3 );


/** Appointment Services page definition for the shared Booking Calendar shell. */
class WPBC_Page_Appointment_Services extends WPBC_Page_Structure {

	/**
	 * Return the WordPress admin page slug when the user may access Services.
	 *
	 * @return string Page slug, or a non-matching random value when unauthorized.
	 */
	public function in_page() {
		if ( ! current_user_can( wpbc_appointment_services_get_manage_capability() ) ) {
			return (string) wp_rand( 100000, 1000000 );
		}

		return 'wpbc-services';
	}

	/**
	 * Define the Appointment Services tab and shared page-shell behavior.
	 *
	 * @return array<string,array<string,mixed>> Page tab definition.
	 */
	public function tabs() {
		$service_hint = wpbc_appointment_services_is_pricing_available()
			? __( 'Create Services and configure duration, buffers, price, Providers, and Booking Form.', 'booking' )
			: __( 'Create Services and configure duration, buffers, Providers, and Booking Form.', 'booking' );

		return array(
			'appointment_services' => array(
				'is_show_top_path'                          => true,
				'is_show_top_navigation'                    => false,
				'left_navigation__default_view_mode'        => 'compact',
				'right_vertical_sidebar__is_show'           => true,
				'right_vertical_sidebar__default_view_mode' => 'none',
				'right_vertical_sidebar_compact__is_show'   => true,
				'top_path'                                  => array( 'root_title' => false ),
				'top_path_title'                            => __( 'Services', 'booking' ),
				'title'                                     => __( 'Services', 'booking' ),
				'page_title'                                => __( 'Services', 'booking' ),
				'hint'                                      => $service_hint,
				'font_icon'                                 => 'wpbc-bi-grid',
				'default'                                   => true,
				'disabled'                                  => false,
				'hided'                                     => false,
				'subtabs'                                   => array(),
			),
		);
	}

	/**
	 * Render the compact Settings and Help controls for the right sidebar.
	 *
	 * @return void
	 */
	public function right_sidebar_compact_content() {
		WPBC_UI_Sidebar_Panels::render_rightbar_tabs( array(
				array(
					'id'       => 'wpbc_tab_service_settings',
					'panel_id' => 'wpbc_service__inspector_settings',
					'title'    => __( 'Settings', 'booking' ),
					'icon'     => 'wpbc_icn_tune',
					'selected' => true,
				),
				array(
					'id'       => 'wpbc_tab_service_help',
					'panel_id' => 'wpbc_service__inspector_help',
					'title'    => __( 'Help', 'booking' ),
					'icon'     => 'wpbc-bi-info-circle',
				),
			), array(
				'aria_label' => __( 'Service Panels', 'booking' ),
				'context'    => 'appointment_services',
				'class'      => 'wpbc_appointment_services__rightbar_tabs',
			) );
	}

	/**
	 * Render the right-sidebar Settings and Help inspector panels.
	 *
	 * @return void
	 */
	public function right_sidebar_content() {
		?>
		<div class="wpbc_bfb__panel--library wpbc_rightbar_palette wpbc_appointment_services__rightbar"><?php
		WPBC_UI_Sidebar_Panels::render_panel( array(
			'id'         => 'wpbc_service__inspector_settings',
			'labelledby' => 'wpbc_tab_service_settings',
			'class'      => 'wpbc_appointment_services__inspector_settings',
		), 'wpbc_appointment_services_render_settings_panel' );
		WPBC_UI_Sidebar_Panels::render_panel( array(
			'id'         => 'wpbc_service__inspector_help',
			'labelledby' => 'wpbc_tab_service_help',
			'class'      => 'wpbc_appointment_services__inspector_help',
			'hidden'     => true,
		), 'wpbc_appointment_services_render_help_panel' );
		?></div><?php
	}

	/**
	 * Render the AJAX-driven Service filters and management table shell.
	 *
	 * @return void|false False when the current user is unauthorized.
	 */
	public function content() {
		if ( ! current_user_can( wpbc_appointment_services_get_manage_capability() ) ) {
			return false;
		}
		$providers            = wpbc_appointment_services_get_provider_options();
		$resource_capability   = class_exists( 'wpdev_bk_personal' )
			? get_bk_option( 'booking_user_role_resources' )
			: get_bk_option( 'booking_user_role_settings' );
		$can_manage_providers = $resource_capability && current_user_can( $resource_capability );
		$selected_provider_id = isset( $_GET['provider_id'] ) ? absint( $_GET['provider_id'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! isset( $providers[ $selected_provider_id ] ) ) {
			$selected_provider_id = 0;
		}
		?>
		<div class="wpbc_appointment_services_page" data-wpbc-appointment-services-page="1">
			<div class="wpbc_appointment_services__filters">
				<div class="wpbc_appointment_services__status_filters" role="group" aria-label="<?php
				esc_attr_e( 'Filter Services by status', 'booking' ); ?>">
					<button type="button" class="wpbc_appointment_services__status_filter is-active"
					        data-service-status="all" aria-pressed="true"><span><?php
							esc_html_e( 'All', 'booking' ); ?></span><strong data-service-count="all">0</strong>
					</button>
					<button type="button" class="wpbc_appointment_services__status_filter" data-service-status="active"
					        aria-pressed="false"><span><?php
							esc_html_e( 'Active', 'booking' ); ?></span><strong data-service-count="active">0</strong>
					</button>
					<button type="button" class="wpbc_appointment_services__status_filter"
					        data-service-status="inactive" aria-pressed="false"><span><?php
							esc_html_e( 'Draft', 'booking' ); ?></span><strong data-service-count="inactive">0</strong>
					</button>
					<button type="button" class="wpbc_appointment_services__status_filter"
					        data-service-status="archived" aria-pressed="false"><span><?php
							esc_html_e( 'Archived', 'booking' ); ?></span><strong
							data-service-count="archived">0</strong></button>
					<span class="wpbc_appointment_services__filter_divider" aria-hidden="true"></span>
					<span class="wpbc_appointment_services__provider_total"><span><?php
							esc_html_e( 'Providers', 'booking' ); ?></span><strong data-provider-count>0</strong></span>
				</div>
				<div class="wpbc_appointment_services__filter_controls">
					<div class="wpbc_appointment_services__search"><span class="wpbc-bi-search"
					                                                     aria-hidden="true"></span><label
							class="screen-reader-text" for="wpbc_service_search"><?php
							esc_html_e( 'Search Services', 'booking' ); ?></label><input type="search"
					                                                                     id="wpbc_service_search"
					                                                                     placeholder="<?php
					                                                                     esc_attr_e( 'Search Services', 'booking' ); ?>"/>
					</div>
					<label class="screen-reader-text" for="wpbc_service_provider_filter"><?php
						esc_html_e( 'Filter by Provider', 'booking' ); ?></label>
					<select id="wpbc_service_provider_filter">
						<option value="0"><?php
							esc_html_e( 'All Providers', 'booking' ); ?></option><?php
						foreach ( $providers as $provider_id => $provider_title ) : ?>
							<option value="<?php
							echo esc_attr( $provider_id ); ?>" <?php selected( $selected_provider_id, absint( $provider_id ) ); ?>><?php
							echo esc_html( $provider_title ); ?></option><?php
						endforeach; ?></select>
				</div>
			</div>
			<div class="wpbc_appointment_services__content" aria-live="polite" aria-busy="true">
				<div class="wpbc_appointment_services__provider_notice" hidden>
					<span class="wpbc-bi-exclamation-circle" aria-hidden="true"></span>
					<div><strong><?php esc_html_e( 'No Providers available', 'booking' ); ?></strong>
						<span><?php esc_html_e( 'Create a Provider before assigning Services and accepting Appointments.', 'booking' ); ?></span></div>
					<?php if ( $can_manage_providers ) : ?>
						<a class="button button-secondary" href="<?php echo esc_url( admin_url( 'admin.php?page=wpbc-resources' ) ); ?>"><?php esc_html_e( 'Manage Providers', 'booking' ); ?></a>
					<?php endif; ?>
				</div>
				<div class="wpbc_appointment_services__loading is-visible" role="status" aria-hidden="false"
				     data-wpbc-appointment-services-loader="1">
					<div class="wpbc_spins_loading_container">
						<div class="wpbc_booking_form_spin_loader">
							<div class="wpbc_spins_loader_wrapper">
								<div class="wpbc_spin_loader_one_new"></div>
							</div>
						</div>
						<span><?php
							esc_html_e( 'Loading Services', 'booking' ); ?> ...</span></div>
				</div>
				<?php wpbc_appointment_services_get_catalog_listing()->render(); ?>
				<div class="wpbc_appointment_services__empty" hidden><span class="wpbc-bi-grid"
				                                                           aria-hidden="true"></span>
					<h2><?php
						esc_html_e( 'No Services yet', 'booking' ); ?></h2>
					<p><?php
						esc_html_e( 'Create the first Service to define what customers can book.', 'booking' ); ?></p>
				</div>
			</div>
		</div>
		<?php
	}
}

add_action( 'wpbc_menu_created', array( new WPBC_Page_Appointment_Services(), '__construct' ) );
