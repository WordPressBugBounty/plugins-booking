<?php
/**
 * Template-driven Booking Resources catalog page shell.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Determine whether the current request targets the independent catalog page.
 *
 * @return bool True only for the gated catalog administration route.
 */
function wpbc_catalog_booking_resources_is_page() {
	return 'new' === wpbc_booking_resources_catalog_get_request_renderer();
}

/**
 * Map the established Booking Calendar minimum role to a capability.
 *
 * @param string $role_option Booking Calendar option containing a minimum role.
 *
 * @return string WordPress capability name.
 */
function wpbc_catalog_booking_resources_get_role_capability( $role_option ) {
	$minimum_role = get_bk_option( sanitize_key( $role_option ) );
	$capabilities = array(
		'administrator' => 'activate_plugins',
		'editor'        => 'publish_pages',
		'author'        => 'publish_posts',
		'contributor'   => 'edit_posts',
		'subscriber'    => 'read',
	);

	return isset( $capabilities[ $minimum_role ] ) ? $capabilities[ $minimum_role ] : 'manage_options';
}

/**
 * Return the capability required by the canonical Resources role setting.
 *
 * Free installations use the Settings role because they do not expose the
 * multi-resource role option. Paid editions use the Resources role so the
 * parallel page remains aligned with the established administration boundary.
 *
 * @return string WordPress capability name.
 */
function wpbc_catalog_booking_resources_get_manage_capability() {
	$role_option = class_exists( 'wpdev_bk_personal' ) ? 'booking_user_role_resources' : 'booking_user_role_settings';
	$capability  = wpbc_catalog_booking_resources_get_role_capability( $role_option );

	/**
	 * Filter the capability required to view the independent Resources catalog.
	 *
	 * @param string $capability WordPress capability name.
	 */
	return (string) apply_filters( 'wpbc_catalog_booking_resources_manage_capability', $capability );
}

/**
 * Return allow-listed shared request overrides from the initial page URL.
 *
 * These values remain untrusted and are normalized by WPBC_UI_Catalog_Request.
 * Subsequent browser requests do not reuse this URL layer.
 *
 * @return array<string,mixed> Untrusted initial shared request overrides.
 */
function wpbc_catalog_booking_resources_get_initial_url_overrides() {
	$url_overrides = array();
	$url_parameters = array(
		'page_number'     => array( 'page_number', 'catalog_page' ),
		'items_per_page'  => array( 'items_per_page', 'catalog_per_page' ),
		'sort_by'         => array( 'sort_by', 'catalog_sort' ),
		'sort_order'      => array( 'sort_order', 'catalog_order' ),
		'search'          => array( 'search', 'catalog_search' ),
		'visible_columns' => array( 'visible_columns', 'catalog_columns' ),
		'column_order'    => array( 'column_order', 'catalog_column_order' ),
		'template_pack'   => array( 'template_pack' ),
	);

	foreach ( $url_parameters as $request_key => $parameter_names ) {
		foreach ( $parameter_names as $parameter_name ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only initial catalog display overrides.
			if ( ! array_key_exists( $parameter_name, $_GET ) ) {
				continue;
			}
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Validated by the shared request normalizer.
			$request_value = wp_unslash( $_GET[ $parameter_name ] );
			if ( in_array( $request_key, array( 'visible_columns', 'column_order' ), true ) && is_scalar( $request_value ) ) {
				$request_value = '' === trim( (string) $request_value ) ? array() : explode( ',', (string) $request_value );
			}
			$url_overrides[ $request_key ] = $request_value;
			break;
		}
	}

	return $url_overrides;
}

/**
 * Build the normalized browser configuration for the initial catalog mount.
 *
 * Phase 4 localizes the read endpoint and enables shared automatic loading.
 * The browser renders the returned DTOs through registered Resource templates.
 *
 * @return array<string,mixed> Browser-safe catalog configuration.
 */
function wpbc_catalog_booking_resources_get_client_config() {
	$catalog_id    = 'catalog_booking_resources';
	$configuration = WPBC_UI_Catalog_Registry::get_instance()->get_configuration( $catalog_id );

	if ( empty( $configuration ) ) {
		return array();
	}

	$stored_preferences = WPBC_UI_Catalog_Preferences::load( $catalog_id );
	$request = WPBC_UI_Catalog_Request::create(
		$configuration,
		array( 'request_id' => 1 ),
		$stored_preferences,
		wpbc_catalog_booking_resources_get_initial_url_overrides(),
		true
	);
	$stored_resource_request = WPBC_Catalog_Booking_Resources_Request::create(
		array_intersect_key( $stored_preferences, array( 'resource_type' => true, 'hierarchy_state' => true ) )
	);
	if ( is_wp_error( $stored_resource_request ) ) {
		$stored_resource_request = WPBC_Catalog_Booking_Resources_Request::create();
	}
	$resource_request = $stored_resource_request;
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only initial filter override validated below.
	if ( ! empty( $configuration['features']['resource_type_filter'] ) && isset( $_GET['resource_type'] ) ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Validated by the Resource request object.
		$resource_request = WPBC_Catalog_Booking_Resources_Request::create(
			array(
				'resource_type'   => wp_unslash( $_GET['resource_type'] ),
				'hierarchy_state' => $stored_resource_request->get( 'hierarchy_state', array() ),
			)
		);
	}
	$auto_load        = ! is_wp_error( $request ) && ! is_wp_error( $resource_request );

	if ( is_wp_error( $request ) || is_wp_error( $resource_request ) ) {
		$fallback_request = WPBC_UI_Catalog_Request::create( $configuration, array( 'request_id' => 1 ) );
		if ( is_wp_error( $fallback_request ) ) {
			return array();
		}

		$initial_request  = $fallback_request->to_array();
		$initial_request['resource_type'] = 'all';
		$initial_request['hierarchy_state'] = WPBC_Catalog_Booking_Resources_Request::create()->get_hierarchy_state_json();
		$initial_error = is_wp_error( $request ) ? $request : $resource_request;
		$initial_response = WPBC_UI_Catalog_Response::from_wp_error( $catalog_id, 1, $initial_error );
	} else {
		$initial_request                  = $request->to_array();
		$initial_request['resource_type'] = $resource_request->get( 'resource_type', 'all' );
		$initial_request['hierarchy_state'] = $resource_request->get_hierarchy_state_json();
		$empty_response  = WPBC_UI_Catalog_Response::create_empty( $catalog_id, $request );
		if ( is_wp_error( $empty_response ) ) {
			$initial_response = WPBC_UI_Catalog_Response::from_wp_error( $catalog_id, 1, $empty_response );
		} else {
			$initial_response = $empty_response->to_array();
		}
	}

	$client_configuration = WPBC_UI_Catalog::get_client_configuration(
		$catalog_id,
		'wpbc_catalog_booking_resources',
		$initial_request,
		$initial_response
	);
	$client_configuration['ajax_url'] = admin_url( 'admin-ajax.php' );
	$client_configuration['auto_load'] = $auto_load;
	$client_configuration['is_demo']   = function_exists( 'wpbc_is_this_demo' ) && wpbc_is_this_demo();
	$client_configuration['nonce']     = wp_create_nonce( $configuration['nonce_name'] );
	$client_configuration['details_action'] = 'WPBC_AJX_CATALOG_BOOKING_RESOURCE_DETAILS';
	$client_configuration['inspector_create_schema_action'] = 'WPBC_AJX_CATALOG_BOOKING_RESOURCE_CREATE_SCHEMA';
	$client_configuration['inspector_edit_schema_action']   = 'WPBC_AJX_CATALOG_BOOKING_RESOURCE_EDIT_SCHEMA';
	$client_configuration['inspector_create_action']        = 'WPBC_AJX_CATALOG_BOOKING_RESOURCE_CREATE';
	$client_configuration['inspector_update_action']        = 'WPBC_AJX_CATALOG_BOOKING_RESOURCE_UPDATE';
	$client_configuration['bulk_schema_action']             = 'WPBC_AJX_CATALOG_BOOKING_RESOURCES_BULK_SCHEMA';
	$client_configuration['bulk_preview_action']            = 'WPBC_AJX_CATALOG_BOOKING_RESOURCES_BULK_PREVIEW';
	$client_configuration['bulk_apply_action']              = 'WPBC_AJX_CATALOG_BOOKING_RESOURCES_BULK_APPLY';
	$client_configuration['inline_schema_action']           = 'WPBC_AJX_CATALOG_BOOKING_RESOURCES_INLINE_SCHEMA';
	$client_configuration['inline_preview_action']          = 'WPBC_AJX_CATALOG_BOOKING_RESOURCES_INLINE_PREVIEW';
	$client_configuration['inline_apply_action']            = 'WPBC_AJX_CATALOG_BOOKING_RESOURCES_INLINE_APPLY';
	$client_configuration['delete_preview_action']          = 'WPBC_AJX_CATALOG_BOOKING_RESOURCES_DELETE_PREVIEW';
	$client_configuration['delete_apply_action']            = 'WPBC_AJX_CATALOG_BOOKING_RESOURCES_DELETE_APPLY';
	$client_configuration['capacity_context_action']        = 'WPBC_AJX_CATALOG_BOOKING_RESOURCE_CAPACITY_CONTEXT';
	$client_configuration['capacity_preview_action']        = 'WPBC_AJX_CATALOG_BOOKING_RESOURCE_CAPACITY_PREVIEW';
	$client_configuration['capacity_apply_action']          = 'WPBC_AJX_CATALOG_BOOKING_RESOURCE_CAPACITY_APPLY';
	$default_request = WPBC_UI_Catalog_Request::create( $configuration );
	$client_configuration['default_request'] = is_wp_error( $default_request ) ? array() : $default_request->to_array();
	$client_configuration['default_request']['resource_type'] = 'all';
	$client_configuration['default_request']['hierarchy_state'] = WPBC_Catalog_Booking_Resources_Request::create()->get_hierarchy_state_json();
	$client_configuration['url_parameters'] = array(
		'page_number'     => 'catalog_page',
		'items_per_page'  => 'catalog_per_page',
		'sort_by'         => 'catalog_sort',
		'sort_order'      => 'catalog_order',
		'search'          => 'catalog_search',
		'visible_columns' => 'catalog_columns',
		'column_order'    => 'catalog_column_order',
		'template_pack'   => 'template_pack',
	);
	if ( ! empty( $configuration['features']['resource_type_filter'] ) ) {
		$client_configuration['url_parameters']['resource_type'] = 'resource_type';
	}

	return $client_configuration;
}

/**
 * Enqueue catalog styles only on the independent Resources page.
 *
 * @param string $where_to_load Booking Calendar asset context.
 *
 * @return void
 */
function wpbc_catalog_booking_resources_enqueue_css( $where_to_load ) {
	if ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) || ! wpbc_catalog_booking_resources_is_page() ) {
		return;
	}

	$asset_path    = __DIR__ . '/_out/booking_resources_catalog.css';
	$asset_modified = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;
	$asset_version  = false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;

	WPBC_UI_Catalog::enqueue_styles();
	wp_enqueue_style(
		'wpbc-catalog-booking-resources',
		trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/booking_resources_catalog.css',
		array( 'wpbc-ui-catalog' ),
		$asset_version
	);
}
add_action( 'wpbc_enqueue_css_files', 'wpbc_catalog_booking_resources_enqueue_css', 68 );

/**
 * Enqueue and configure catalog scripts only on the independent Resources page.
 *
 * @param string $where_to_load Booking Calendar asset context.
 *
 * @return void
 */
function wpbc_catalog_booking_resources_enqueue_js( $where_to_load ) {
	if ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) || ! wpbc_catalog_booking_resources_is_page() ) {
		return;
	}

	$asset_path     = __DIR__ . '/_out/booking_resources_catalog.js';
	$asset_modified = is_readable( $asset_path ) ? filemtime( $asset_path ) : false;
	$asset_version  = false !== $asset_modified ? WP_BK_VERSION_NUM . '.' . $asset_modified : WP_BK_VERSION_NUM;

	WPBC_UI_Catalog::enqueue_scripts();
	if ( function_exists( 'wpbc_load_js__required_for_media_upload' ) ) {
		wpbc_load_js__required_for_media_upload();
	}
	if ( function_exists( 'wpbc_load_js__required_for_modals' ) ) {
		wpbc_load_js__required_for_modals();
	}
	wp_enqueue_script(
		'wpbc-catalog-booking-resources',
		trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/booking_resources_catalog.js',
		array( 'wpbc-ui-catalog', 'wpbc-ui-catalog-hierarchy', 'wpbc-ui-catalog-selection', 'wpbc-ui-catalog-actions', 'wpbc-admin-support' ),
		$asset_version,
		array( 'in_footer' => WPBC_JS_IN_FOOTER )
	);
	wp_localize_script(
		'wpbc-catalog-booking-resources',
		'wpbc_catalog_booking_resources_config',
		wpbc_catalog_booking_resources_get_client_config()
	);
}
add_action( 'wpbc_enqueue_js_files', 'wpbc_catalog_booking_resources_enqueue_js', 68 );

/**
 * Print registered WP templates only for the independent catalog page.
 *
 * Templates are static presentation files. They perform no authorization,
 * queries, mutations, or domain decisions.
 *
 * @return void
 */
function wpbc_catalog_booking_resources_print_templates() {
	static $templates_printed = false;

	if ( $templates_printed || ! wpbc_catalog_booking_resources_is_page() ) {
		return;
	}

	$templates_printed = true;
	WPBC_UI_Catalog::print_templates( 'catalog_booking_resources' );
}
add_action( 'admin_footer', 'wpbc_catalog_booking_resources_print_templates', 40 );

/**
 * Render the shared Free-edition Booking Resource upgrade button.
 *
 * Both the top toolbar and catalog footer open the same informational modal.
 * The toolbar keeps its compact label on one line, while the footer preserves
 * the established superscript Pro marker used by in-page upgrade controls.
 *
 * @param bool $use_superscript Whether to render the Pro marker in a sup element.
 *
 * @return void
 */
function wpbc_catalog_booking_resources_render_upgrade_button( $use_superscript = false ) {
	?>
	<button
		type="button"
		class="button button-primary tooltip_bottom wpbc_catalog_booking_resources__upgrade_button"
		data-wpbc-catalog-booking-resource-upgrade
		data-wpbc-catalog-booking-resource-upgrade-url="<?php echo esc_url( 'https://wpbookingcalendar.com/features/' ); ?>"
		aria-haspopup="dialog"
		aria-controls="wpbc_catalog_booking_resources__upgrade_modal"
		data-original-title="<?php esc_attr_e( 'Adding more Booking Resources is available in paid versions.', 'booking' ); ?>"
		title="<?php esc_attr_e( 'Adding more Booking Resources is available in paid versions.', 'booking' ); ?>"
	>
		<span class="wpbc-bi-plus-lg" aria-hidden="true"></span>
		<?php if ( $use_superscript ) : ?>
			<?php esc_html_e( 'Add Booking Resource', 'booking' ); ?>
			<sup><?php esc_html_e( '(Pro)', 'booking' ); ?></sup>
		<?php else : ?>
			<?php esc_html_e( 'Add Booking Resource (Pro)', 'booking' ); ?>
		<?php endif; ?>
	</button>
	<?php
}

/**
 * Render the old-compatible Add Resource control in the native top toolbar.
 *
 * @param string $page_tag           Current Booking Calendar page tag.
 * @param string $active_page_tab    Current active tab.
 * @param string $active_page_subtab Current active subtab.
 *
 * @return void
 */
function wpbc_catalog_booking_resources_render_top_toolbar( $page_tag, $active_page_tab, $active_page_subtab ) {
	unset( $page_tag, $active_page_tab, $active_page_subtab );

	if ( ! wpbc_catalog_booking_resources_is_page() || ! current_user_can( wpbc_catalog_booking_resources_get_manage_capability() ) ) {
		return;
	}
	$maximum_quantity = ( new WPBC_Catalog_Booking_Resource_Inspector_Schema() )->get_maximum_quantity();
	?>
	<div class="wpbc_ui_el__buttons_group wpbc_catalog_booking_resources__top_toolbar">
		<?php if ( class_exists( 'wpdev_bk_personal' ) && 0 < $maximum_quantity ) : ?>
			<button type="button" class="button button-primary" data-wpbc-catalog-booking-resource-create data-wpbc-right-sidebar-keep-open="1">
				<span class="wpbc-bi-plus-lg" aria-hidden="true"></span>
				<?php esc_html_e( 'Add Booking Resource', 'booking' ); ?>
			</button>
		<?php elseif ( class_exists( 'wpdev_bk_personal' ) ) : ?>
			<span class="wpbc_catalog_booking_resources__free_limit_top"><span class="wpbc-bi-info-circle" aria-hidden="true"></span><?php esc_html_e( 'The Booking Resource limit for this account has been reached.', 'booking' ); ?></span>
		<?php else : ?>
			<?php wpbc_catalog_booking_resources_render_upgrade_button(); ?>
		<?php endif; ?>
	</div>
	<?php
}
add_action( 'wpbc_ui_el__top_nav__content_end', 'wpbc_catalog_booking_resources_render_top_toolbar', 20, 3 );

/**
 * Render the Free-edition explanation shown by the Pro-only add control.
 *
 * The modal is informational only. It never calls a mutation endpoint in the
 * Free edition and keeps the existing single default Resource available.
 *
 * @return void
 */
function wpbc_catalog_booking_resources_render_free_upgrade_modal() {
	if ( class_exists( 'wpdev_bk_personal' ) ) {
		return;
	}
	?>
	<div class="wpdevelop">
		<div
			id="wpbc_catalog_booking_resources__upgrade_modal"
			class="modal wpbc_popup_modal wpbc_catalog_booking_resources__upgrade_modal"
			tabindex="-1"
			role="dialog"
			aria-hidden="true"
			aria-labelledby="wpbc_catalog_booking_resources__upgrade_modal_title"
			aria-describedby="wpbc_catalog_booking_resources__upgrade_modal_description"
		>
			<div class="modal-dialog">
				<div class="modal-content">
					<div class="modal-header">
						<button type="button" class="close" data-dismiss="modal" aria-label="<?php esc_attr_e( 'Close', 'booking' ); ?>"><span aria-hidden="true">&times;</span></button>
						<h4 id="wpbc_catalog_booking_resources__upgrade_modal_title" class="modal-title"><?php esc_html_e( 'Add more Booking Resources with Pro', 'booking' ); ?></h4>
					</div>
					<div class="modal-body">
						<p id="wpbc_catalog_booking_resources__upgrade_modal_description"><?php esc_html_e( 'Creating additional Booking Resources is available in paid versions of Booking Calendar. Each Resource can have its own calendar and availability.', 'booking' ); ?></p>
						<p><?php esc_html_e( 'Your default Resource remains ready to customize in the Free version.', 'booking' ); ?></p>
					</div>
					<div class="modal-footer">
						<button type="button" class="button button-secondary" data-dismiss="modal"><?php esc_html_e( 'Close', 'booking' ); ?></button>
						<a class="button button-primary" href="<?php echo esc_url( 'https://wpbookingcalendar.com/features/' ); ?>" target="_blank" rel="noopener noreferrer">
							<?php esc_html_e( 'Compare Pro versions', 'booking' ); ?>
							<span class="screen-reader-text"> <?php esc_html_e( '(opens in a new tab)', 'booking' ); ?></span>
						</a>
					</div>
				</div>
			</div>
		</div>
	</div>
	<?php
}

/**
 * Render the reusable informational dialog for catalog warnings and messages.
 *
 * The browser runtime supplies escaped text through textContent before opening
 * the established Booking Calendar modal. Keeping one dialog in the page avoids
 * browser alerts while preserving a safe fallback when modal assets fail.
 *
 * @return void
 */
function wpbc_catalog_booking_resources_render_message_modal() {
	?>
	<div class="wpdevelop">
		<div
			id="wpbc_catalog_booking_resources__message_modal"
			class="modal wpbc_popup_modal wpbc_catalog_booking_resources__upgrade_modal wpbc_catalog_booking_resources__message_modal"
			tabindex="-1"
			role="dialog"
			aria-hidden="true"
			aria-labelledby="wpbc_catalog_booking_resources__message_modal_title"
			aria-describedby="wpbc_catalog_booking_resources__message_modal_description"
		>
			<div class="modal-dialog">
				<div class="modal-content">
					<div class="modal-header">
						<button type="button" class="close" data-dismiss="modal" aria-label="<?php esc_attr_e( 'Close', 'booking' ); ?>"><span aria-hidden="true">&times;</span></button>
						<h4 id="wpbc_catalog_booking_resources__message_modal_title" class="modal-title" data-wpbc-default-title="<?php esc_attr_e( 'Booking Resources', 'booking' ); ?>"><?php esc_html_e( 'Booking Resources', 'booking' ); ?></h4>
					</div>
					<div class="modal-body">
						<p id="wpbc_catalog_booking_resources__message_modal_description"></p>
					</div>
					<div class="modal-footer">
						<button type="button" class="button button-primary" data-dismiss="modal"><?php esc_html_e( 'Close', 'booking' ); ?></button>
					</div>
				</div>
			</div>
		</div>
	</div>
	<?php
}

/**
 * Render sticky inspector actions in the native right-sidebar footer.
 *
 * @param array $active_page Current page identifiers.
 *
 * @return void
 */
function wpbc_catalog_booking_resources_render_right_sidebar_footer( $active_page ) {
	if (
		empty( $active_page['active_page'] )
		|| 'wpbc-resources' !== $active_page['active_page']
		|| ! wpbc_catalog_booking_resources_is_page()
		|| ! current_user_can( wpbc_catalog_booking_resources_get_manage_capability() )
	) {
		return;
	}
	?>
	<div class="wpbc_ui_el__vert_right_bar__footer_section wpbc_catalog_booking_resources__right_sidebar_footer" data-wpbc-ui-catalog-inspector-footer hidden>
		<div class="wpbc_catalog_booking_resources__footer_actions wpbc_ui_el__buttons_group">
			<button type="button" class="button" data-wpbc-ui-catalog-inspector-cancel><?php esc_html_e( 'Cancel', 'booking' ); ?></button>
			<button type="submit" class="button button-primary" form="wpbc_catalog_booking_resource_inspector_form" data-wpbc-ui-catalog-inspector-save disabled><?php esc_html_e( 'Save changes', 'booking' ); ?></button>
		</div>
	</div>
	<?php
}
add_action( 'wpbc_ui__right_vertical_sidebar_footer', 'wpbc_catalog_booking_resources_render_right_sidebar_footer', 10, 1 );

/**
 * Register the independent catalog shell with the shared admin page controller.
 */
class WPBC_Page_Catalog_Booking_Resources extends WPBC_Page_Structure {

	/**
	 * Return the catalog page slug for authorized users.
	 *
	 * @return string Page slug or a non-matching value when unauthorized.
	 */
	public function in_page() {
		if ( ! wpbc_booking_resources_catalog_should_use_new_renderer() || ! current_user_can( wpbc_catalog_booking_resources_get_manage_capability() ) ) {
			return 'wpbc-catalog-booking-resources-unauthorized';
		}

		return 'wpbc-resources';
	}

	/**
	 * Define the initial template-driven catalog page tab.
	 *
	 * @return array<string,array<string,mixed>> Page tab definition.
	 */
	public function tabs() {
		return array(
			'resources' => array(
				'is_show_top_path'                          => true,
				'is_show_top_navigation'                    => false,
				'left_navigation__default_view_mode'        => 'compact',
				'right_vertical_sidebar__is_show'           => true,
				'right_vertical_sidebar__default_view_mode' => 'none',
				'right_vertical_sidebar__content_click_collapse_mode' => 'none',
				'right_vertical_sidebar_compact__is_show'   => true,
				'top_path'                                  => array( 'root_title' => false ),
				'top_path_title'                            => __( 'Booking Resources', 'booking' ),
				'title'                                     => __( 'Booking Resources', 'booking' ),
				'page_title'                                => __( 'Booking Resources', 'booking' ),
				'hint'                                      => __( 'A new, unified listing for the properties, people, places, and assets customers can book.', 'booking' ),
				'font_icon'                                 => 'wpbc-bi-collection',
				'default'                                   => true,
				'disabled'                                  => false,
				'hided'                                     => false,
				'subtabs'                                   => array(),
			),
		);
	}

	/**
	 * Render the compact Settings tab for the native right sidebar.
	 *
	 * @return void
	 */
	public function right_sidebar_compact_content() {
		WPBC_UI_Sidebar_Panels::render_rightbar_tabs(
			array(
				array(
					'id'       => 'wpbc_tab_catalog_booking_resources_selection',
					'panel_id' => 'wpbc_catalog_booking_resources__inspector_selection',
					'title'    => __( 'Settings', 'booking' ),
					'icon'     => 'wpbc_icn_tune',
					'selected' => true,
				),
			),
			array(
				'aria_label' => __( 'Booking resource panels', 'booking' ),
				'context'    => 'catalog_booking_resources',
				'class'      => 'wpbc_catalog_booking_resources__rightbar_tabs',
			)
		);
	}

	/**
	 * Render the template target inside the native old-compatible palette.
	 *
	 * @return void
	 */
	public function right_sidebar_content() {
		?>
		<div class="wpbc_bfb__panel--library wpbc_rightbar_palette wpbc_catalog_booking_resources__rightbar">
			<?php
			WPBC_UI_Sidebar_Panels::render_panel(
				array(
					'id'         => 'wpbc_catalog_booking_resources__inspector_selection',
					'labelledby' => 'wpbc_tab_catalog_booking_resources_selection',
					'class'      => 'wpbc_catalog_booking_resources__inspector_panel',
				),
				static function () {
					?><div data-wpbc-catalog-booking-resources-inspector-host></div><?php
				}
			);
			?>
		</div>
		<?php
	}

	/**
	 * Render the Phase 4 catalog mount without querying Booking Resource data in PHP.
	 *
	 * @return void|false False when the current user is unauthorized.
	 */
	public function content() {
		if ( 'new' !== wpbc_booking_resources_catalog_get_request_renderer() || ! current_user_can( wpbc_catalog_booking_resources_get_manage_capability() ) ) {
			return false;
		}
		?>
		<div class="wpbc_catalog_booking_resources_page">
			<div id="wpbc_catalog_booking_resources" class="wpbc_catalog_booking_resources__mount" data-wpbc-catalog-mount="catalog_booking_resources" aria-live="polite">
				<div class="wpbc_spins_loading_container wpbc_ui_catalog__loading" role="status">
					<div class="wpbc_booking_form_spin_loader" aria-hidden="true">
						<div class="wpbc_spins_loader_wrapper">
							<div class="wpbc_one_spin_loader_mini2"></div>
						</div>
					</div>
					<span><?php esc_html_e( 'Loading', 'booking' ); ?>...</span>
				</div>
			</div>
			<noscript>
				<div class="notice notice-error inline">
					<p><?php esc_html_e( 'JavaScript is required to display the Booking Resources catalog.', 'booking' ); ?></p>
				</div>
			</noscript>
		</div>
		<?php if ( ! class_exists( 'wpdev_bk_personal' ) ) : ?>
			<div class="wpbc_catalog_booking_resources__footer_upgrade">
				<?php wpbc_catalog_booking_resources_render_upgrade_button( true ); ?>
			</div>
		<?php endif; ?>
		<div class="wpbc_page_publish_notice_section wpbc_catalog_booking_resources__footer_notice">
			<?php
			// Render only the provider guidance formerly attached to the broad legacy Resources hook.
			if ( function_exists( 'wpbc_appointment_services_render_provider_tools' ) ) {
				wpbc_appointment_services_render_provider_tools( 'resources' );
			}
			?>
		</div>
		<?php
		wpbc_catalog_booking_resources_render_free_upgrade_modal();
		wpbc_catalog_booking_resources_render_message_modal();
		if ( class_exists( 'WPBC_Booking_Form_Publish_Modal' ) ) {
			WPBC_Booking_Form_Publish_Modal::render();
		}
	}
}

if ( wpbc_booking_resources_catalog_should_use_new_renderer() ) {
	add_action( 'wpbc_menu_created', array( new WPBC_Page_Catalog_Booking_Resources(), '__construct' ) );
}
