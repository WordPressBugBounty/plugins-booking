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
		&& wpbc_is_resources_page();

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

	WPBC_UI_Catalog::enqueue_styles();
	wp_enqueue_style( 'wpbc-appointment-services-page', trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/appointment_services_page.css', array( 'wpbc-ui-catalog' ), WP_BK_VERSION_NUM );
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
 * Migrate released Service listing preferences into the shared catalog namespace.
 *
 * The migration runs only when the new site-local preference payload has never
 * been created. Existing shared preferences, including an explicit reset, are
 * never replaced by older listing values.
 *
 * @param array<string,mixed> $configuration Registered Service catalog configuration.
 *
 * @return void
 */
function wpbc_appointment_services_migrate_catalog_preferences( $configuration ) {
	$user_id   = get_current_user_id();
	$namespace = WPBC_UI_Catalog_Preferences::get_namespace( 'appointment_services_catalog' );
	if ( ! $user_id || '' === $namespace || false !== get_user_option( $namespace, $user_id ) ) {
		return;
	}

	$legacy_preferences = get_user_option( 'wpbc_admin_listing_preferences', $user_id );
	$legacy_preferences = is_array( $legacy_preferences ) && isset( $legacy_preferences['appointment_services_catalog'] ) && is_array( $legacy_preferences['appointment_services_catalog'] )
		? $legacy_preferences['appointment_services_catalog']
		: array();
	if ( empty( $legacy_preferences ) ) {
		return;
	}

	$request_values = array_intersect_key(
		$legacy_preferences,
		array(
			'items_per_page' => true,
			'sort_by'        => true,
			'sort_order'     => true,
			'column_order'   => true,
		)
	);
	if ( isset( $legacy_preferences['visible_fields'] ) && is_array( $legacy_preferences['visible_fields'] ) ) {
		$request_values['visible_columns'] = $legacy_preferences['visible_fields'];
	}
	$legacy_filters = isset( $legacy_preferences['filters'] ) && is_array( $legacy_preferences['filters'] )
		? $legacy_preferences['filters']
		: array();
	$service_request = WPBC_Appointment_Services_Catalog_Request::create(
		array(
			'status'      => isset( $legacy_filters['status'] ) ? $legacy_filters['status'] : 'all',
			'resource_id' => isset( $legacy_filters['resource_id'] ) ? $legacy_filters['resource_id'] : 0,
		)
	);

	$request = WPBC_UI_Catalog_Request::create( $configuration, $request_values );
	if ( ! is_wp_error( $request ) && ! is_wp_error( $service_request ) ) {
		WPBC_UI_Catalog_Preferences::save(
			'appointment_services_catalog',
			$request,
			array(
				'status'      => $service_request->get( 'status', 'all' ),
				'resource_id' => $service_request->get( 'resource_id', 0 ),
			),
			$user_id,
			1
		);
	}
}

/**
 * Return validated initial URL overrides for the Services catalog.
 *
 * @return array<string,mixed> Shared catalog URL overrides.
 */
function wpbc_appointment_services_get_initial_catalog_overrides() {
	$parameter_map = array(
		'page_number'     => 'catalog_page',
		'items_per_page'  => 'catalog_per_page',
		'sort_by'         => 'catalog_sort',
		'sort_order'      => 'catalog_order',
		'search'          => 'catalog_search',
		'visible_columns' => 'catalog_columns',
		'column_order'    => 'catalog_column_order',
		'template_pack'   => 'template_pack',
	);
	$url_overrides = array();
	foreach ( $parameter_map as $request_key => $parameter_name ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only initial catalog state.
		if ( ! isset( $_GET[ $parameter_name ] ) ) {
			continue;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Validated by WPBC_UI_Catalog_Request.
		$request_value = wp_unslash( $_GET[ $parameter_name ] );
		if ( in_array( $request_key, array( 'visible_columns', 'column_order' ), true ) && is_scalar( $request_value ) ) {
			$request_value = '' === trim( (string) $request_value ) ? array() : explode( ',', (string) $request_value );
		}
		$url_overrides[ $request_key ] = $request_value;
	}

	return $url_overrides;
}

/**
 * Build the shared Services catalog browser configuration.
 *
 * @return array<string,mixed> Browser-safe Service and catalog configuration.
 */
function wpbc_appointment_services_get_catalog_client_config() {
	$catalog_id           = 'appointment_services_catalog';
	$domain_configuration = wpbc_appointment_services_get_catalog_config();
	$configuration        = WPBC_UI_Catalog_Registry::get_instance()->get_configuration( $catalog_id );
	if ( empty( $configuration ) ) {
		return array();
	}

	wpbc_appointment_services_migrate_catalog_preferences( $configuration );
	$stored_preferences = WPBC_UI_Catalog_Preferences::load( $catalog_id );
	$shared_request      = WPBC_UI_Catalog_Request::create(
		$configuration,
		array( 'request_id' => 1 ),
		$stored_preferences,
		wpbc_appointment_services_get_initial_catalog_overrides(),
		true
	);
	$service_values = array(
		'status'      => isset( $stored_preferences['status'] ) ? $stored_preferences['status'] : 'all',
		'resource_id' => isset( $stored_preferences['resource_id'] ) ? $stored_preferences['resource_id'] : 0,
	);
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only initial Provider filter.
	if ( isset( $_GET['provider_id'] ) ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Validated by the Service request object.
		$service_values['resource_id'] = wp_unslash( $_GET['provider_id'] );
	}
	$service_request = WPBC_Appointment_Services_Catalog_Request::create( $service_values );
	$auto_load       = ! is_wp_error( $shared_request ) && ! is_wp_error( $service_request );
	if ( ! $auto_load ) {
		$shared_request = WPBC_UI_Catalog_Request::create( $configuration, array( 'request_id' => 1 ) );
		if ( is_wp_error( $shared_request ) ) {
			return array();
		}
		$initial_error    = is_wp_error( $service_request ) ? $service_request : new WP_Error( 'wpbc_appointment_services_invalid_request', __( 'The Services request is invalid.', 'booking' ) );
		$initial_response = WPBC_UI_Catalog_Response::from_wp_error( $catalog_id, 1, $initial_error );
		$service_request  = WPBC_Appointment_Services_Catalog_Request::create();
	} else {
		$empty_response   = WPBC_UI_Catalog_Response::create_empty( $catalog_id, $shared_request );
		$initial_response = is_wp_error( $empty_response )
			? WPBC_UI_Catalog_Response::from_wp_error( $catalog_id, 1, $empty_response )
			: $empty_response->to_array();
	}

	$initial_request                = $shared_request->to_array();
	$initial_request['status']      = $service_request->get( 'status', 'all' );
	$initial_request['resource_id'] = $service_request->get( 'resource_id', 0 );
	$client_configuration = WPBC_UI_Catalog::get_client_configuration( $catalog_id, 'wpbc_appointment_services_catalog', $initial_request, $initial_response );
	$client_configuration['ajax_url']        = admin_url( 'admin-ajax.php' );
	$client_configuration['auto_load']       = $auto_load;
	$client_configuration['nonce']           = wp_create_nonce( $configuration['nonce_name'] );
	$default_request = WPBC_UI_Catalog_Request::create( $configuration );
	if ( is_wp_error( $default_request ) ) {
		return array();
	}
	$client_configuration['default_request'] = $default_request->to_array();
	$client_configuration['default_request']['status']      = 'all';
	$client_configuration['default_request']['resource_id'] = 0;
	$client_configuration['url_parameters'] = array(
		'page_number'     => 'catalog_page',
		'items_per_page'  => 'catalog_per_page',
		'sort_by'         => 'catalog_sort',
		'sort_order'      => 'catalog_order',
		'search'          => 'catalog_search',
		'visible_columns' => 'catalog_columns',
		'column_order'    => 'catalog_column_order',
		'template_pack'   => 'template_pack',
		'resource_id'     => 'provider_id',
	);
	$client_configuration['filters']     = $domain_configuration['filters'];
	$client_configuration['actions']     = $domain_configuration['actions'];

	return $client_configuration;
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
	WPBC_UI_Catalog::enqueue_scripts();
	wpbc_load_js__required_for_media_upload();
	$selected_service_id = wpbc_appointment_services_get_initial_service_id();
	$default_provider_ids = array();

	if ( ! class_exists( 'wpdev_bk_personal' ) ) {
		$default_provider_id = function_exists( 'wpbc_get_default_resource' ) ? absint( wpbc_get_default_resource() ) : 1;
		if ( ! $default_provider_id ) {
			$default_provider_id = 1;
		}

		$default_provider_ids[] = $default_provider_id;
	}

	wp_enqueue_script( 'wpbc-appointment-services-page', trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/appointment_services_page.js', array(
		'jquery',
		'wpbc_all',
		'wpbc-ui-catalog',
		'wpbc-ui-catalog-actions',
	), WP_BK_VERSION_NUM, array( 'in_footer' => WPBC_JS_IN_FOOTER ) );

	wp_localize_script( 'wpbc-appointment-services-page', 'wpbc_appointment_services_config', array(
			'ajax_url'             => admin_url( 'admin-ajax.php' ),
			'nonce'                => wp_create_nonce( 'wpbc_appointment_services_ajax_nonce' ),
			'actions'              => array(
				'list'      => 'WPBC_AJX_APPOINTMENT_SERVICES_LIST',
				'load'      => 'WPBC_AJX_APPOINTMENT_SERVICE_LOAD',
				'save'      => 'WPBC_AJX_APPOINTMENT_SERVICE_SAVE',
				'duplicate' => 'WPBC_AJX_APPOINTMENT_SERVICE_DUPLICATE',
				'archive'   => 'WPBC_AJX_APPOINTMENT_SERVICE_ARCHIVE',
				'inline_schema' => 'WPBC_AJX_APPOINTMENT_SERVICES_INLINE_SCHEMA',
				'bulk_contract' => 'WPBC_AJX_APPOINTMENT_SERVICES_BULK_CONTRACT',
				'preview'   => 'WPBC_AJX_APPOINTMENT_SERVICES_CATALOG_PREVIEW',
				'apply'     => 'WPBC_AJX_APPOINTMENT_SERVICES_CATALOG_APPLY',
				'delete_preview' => 'WPBC_AJX_APPOINTMENT_SERVICES_DELETE_PREVIEW',
				'delete_apply'   => 'WPBC_AJX_APPOINTMENT_SERVICES_DELETE_APPLY',
			),
			'selected_id'          => $selected_service_id,
			'focus_section'        => wpbc_appointment_services_get_requested_focus_section(),
			'default_provider_ids' => $default_provider_ids,
			'pricing_available'    => wpbc_appointment_services_is_pricing_available(),
			'catalog'              => wpbc_appointment_services_get_catalog_client_config(),
			'i18n'                 => array(
				'loading'          => __( 'Loading Services', 'booking' ) . '...',
				'empty'            => __( 'No Services yet', 'booking' ),
				'empty_help'       => __( 'Create the first Service to define what customers can book.', 'booking' ),
				'no_providers'     => __( 'No Providers available', 'booking' ),
				'no_providers_help'=> __( 'Create a Provider before assigning Services and accepting Appointments.', 'booking' ),
				'not_connected'    => __( 'The Services database is not ready. Reload this page as an administrator or reactivate Booking Calendar to finish the database upgrade.', 'booking' ),
				'load_failed'      => __( 'Services could not be loaded.', 'booking' ),
				'operation_failed' => __( 'The Service editor could not be opened. Please reload the page and try again.', 'booking' ),
				'save_failed'      => __( 'The Service could not be saved.', 'booking' ),
				'duplicate_failed' => __( 'The Service could not be duplicated.', 'booking' ),
				'archive_failed'   => __( 'The Service could not be archived.', 'booking' ),
				'preview_failed'   => __( 'The Service changes could not be reviewed.', 'booking' ),
				'apply_failed'     => __( 'The Service changes could not be applied.', 'booking' ),
				'delete_preview_failed' => __( 'The Service deletion could not be reviewed.', 'booking' ),
				'delete_apply_failed'   => __( 'The selected Services could not be permanently deleted.', 'booking' ),
				'confirm_archive'  => __( 'Archive this Service?', 'booking' ),
				'confirm_discard'  => __( 'Discard unsaved Service changes?', 'booking' ),
				'untitled'         => __( 'Untitled Service', 'booking' ),
				'new_service'      => __( 'New Service', 'booking' ),
				'create_service_title'       => __( 'Add Service', 'booking' ),
				'create_service_description' => __( 'Create a Service without leaving the catalog.', 'booking' ),
				'edit_service_title'         => __( 'Edit Service', 'booking' ),
				'edit_service_description'   => __( 'Update this Service without leaving the catalog.', 'booking' ),
				'inspector_context_new'      => __( 'New', 'booking' ),
				/* translators: %d: Service ID. */
				'inspector_context_id'       => __( 'ID: %d', 'booking' ),
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
				/* translators: %s: Service title. */
				'select_service'             => __( 'Select %s', 'booking' ),
				'select_all'                 => __( 'Select all visible Services', 'booking' ),
				'editing_rows'               => __( 'Editing rows', 'booking' ),
				/* translators: %s: Number of changed Service rows. */
				'changed_rows'               => __( '%s changed rows', 'booking' ),
				'changed'                    => __( 'Changed', 'booking' ),
				'inline_help'                => __( 'Edit safe fields on this page, then review all changes before applying them.', 'booking' ),
				'inline_schema_failed'       => __( 'Safe inline Service fields could not be loaded.', 'booking' ),
				'bulk_contract_failed'       => __( 'Safe fields could not be determined for this Service selection.', 'booking' ),
				'cancel'                     => __( 'Cancel', 'booking' ),
				'review_changes'             => __( 'Review changes', 'booking' ),
				'apply_changes'              => __( 'Apply changes', 'booking' ),
				'bulk_edit_title'            => __( 'Edit selected Services', 'booking' ),
				'bulk_edit_description'      => __( 'Enable only the fields that should change for every selected Service.', 'booking' ),
				'inline_review_title'        => __( 'Review inline changes', 'booking' ),
				'bulk_review_title'          => __( 'Review bulk changes', 'booking' ),
				'review_confirmation'        => __( 'Confirm the row-specific changes before applying them.', 'booking' ),
				'review_description'         => __( 'No Service will change until you choose Apply changes.', 'booking' ),
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
 * Print Service-owned catalog templates on the Services page only.
 *
 * @return void
 */
function wpbc_appointment_services_print_catalog_templates() {
	static $templates_printed = false;
	if ( $templates_printed || ! wpbc_appointment_services__is_page() ) {
		return;
	}
	$templates_printed = true;
	WPBC_UI_Catalog::print_templates( 'appointment_services_catalog' );
}
add_action( 'admin_footer', 'wpbc_appointment_services_print_catalog_templates', 40 );

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
		<button type="button" class="button button-primary wpbc_appointment_services__add" disabled>
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
				'right_vertical_sidebar__content_click_collapse_mode' => 'none',
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
					<div class="wpbc_appointment_services__search">
						<span class="wpbc-bi-search" aria-hidden="true"></span>
						<label class="screen-reader-text" for="wpbc_service_search"><?php esc_html_e( 'Search Services', 'booking' ); ?></label>
						<input type="search" id="wpbc_service_search" placeholder="<?php esc_attr_e( 'Search Services', 'booking' ); ?>" autocomplete="off" data-wpbc-ui-catalog-search />
						<button type="button" class="wpbc_appointment_services__search_clear" aria-label="<?php esc_attr_e( 'Clear Service search', 'booking' ); ?>" data-wpbc-ui-catalog-search-clear data-wpbc-appointment-services-search-clear hidden>
							<span class="wpbc-bi-x-lg" aria-hidden="true"></span>
						</button>
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
				<div id="wpbc_appointment_services_catalog"></div>
				<noscript><p><?php esc_html_e( 'JavaScript is required to manage Services.', 'booking' ); ?></p></noscript>
			</div>
		</div>
		<?php
	}
}

add_action( 'wpbc_menu_created', array( new WPBC_Page_Appointment_Services(), '__construct' ) );
