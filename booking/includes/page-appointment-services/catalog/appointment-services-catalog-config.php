<?php
/**
 * Appointment Services shared catalog configuration.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return the Service-owned column, view, feature, and template declaration.
 *
 * This configuration contains presentation allow-lists only. Service SQL,
 * edition rules, ownership, and mutations remain in the Service domain.
 *
 * @return array<string,mixed> Shared catalog configuration.
 */
function wpbc_appointment_services_get_catalog_config() {
	$allowed_sort_keys = array( 'service_id', 'title', 'duration', 'price', 'status' );
	$definitions = array(
		'service'      => array( 'label' => __( 'Service', 'booking' ), 'class' => 'column-service', 'sort_key' => 'title', 'required' => true, 'reorderable' => true ),
		'duration'     => array( 'label' => __( 'Duration', 'booking' ), 'class' => 'column-duration', 'sort_key' => 'duration', 'required' => false, 'reorderable' => true ),
		'price'        => array( 'label' => __( 'Price', 'booking' ), 'class' => 'column-price', 'sort_key' => 'price', 'required' => false, 'reorderable' => true ),
		'providers'    => array( 'label' => __( 'Providers', 'booking' ), 'class' => 'column-providers', 'sort_key' => '', 'required' => false, 'reorderable' => true ),
		'availability' => array( 'label' => __( 'Weekly Availability', 'booking' ), 'class' => 'column-weekdays', 'sort_key' => '', 'required' => false, 'reorderable' => true ),
		'status'       => array( 'label' => __( 'Status', 'booking' ), 'class' => 'column-status', 'sort_key' => 'status', 'required' => false, 'reorderable' => true ),
		'actions'      => array( 'label' => __( 'Actions', 'booking' ), 'class' => 'column-actions', 'sort_key' => '', 'required' => true, 'reorderable' => true ),
	);
	if ( ! wpbc_appointment_services_is_pricing_available() ) {
		unset( $definitions['price'] );
		$allowed_sort_keys = array_values( array_diff( $allowed_sort_keys, array( 'price' ) ) );
	}
	$columns = array_keys( $definitions );

	return array(
		'id'         => 'appointment_services_catalog',
		'action'     => 'WPBC_AJX_APPOINTMENT_SERVICES_LIST',
		'nonce_name' => 'wpbc_appointment_services_ajax_nonce',
		'items_per_page' => array( 'default' => 10, 'options' => array( 5, 10, 50, 100 ), 'maximum' => 100 ),
		'sorting' => array( 'default_key' => 'service_id', 'default_order' => 'desc', 'allowed_keys' => $allowed_sort_keys ),
		'filters' => array(
			'status' => array(
				'default' => 'all',
				'allowed' => array( 'all', 'active', 'inactive', 'archived' ),
			),
			'resource_id' => array(
				'default' => 0,
				'minimum' => 0,
			),
		),
		'actions' => array(
			'edit' => array(
				'surface' => 'row',
				'mutation' => false,
			),
			'duplicate' => array(
				'surface' => 'inspector',
				'mutation' => true,
			),
			'archive' => array(
				'surface' => 'row',
				'mutation' => true,
			),
			'delete' => array(
				'surface' => 'selection',
				'mutation' => true,
			),
		),
		'columns' => array(
			'allowed'         => $columns,
			'default_visible' => $columns,
			'default_order'   => $columns,
			'required'        => array( 'service', 'actions' ),
			'definitions'     => $definitions,
		),
		'views' => array(
			'default'     => 'overview',
			'definitions' => array(
				'overview' => array( 'label' => __( 'Overview', 'booking' ), 'fields' => $columns ),
			),
		),
		'features' => array(
			'selection'          => true,
			'range_selection'    => true,
			'column_preferences' => true,
			'column_order'       => true,
			'template_packs'     => true,
			'hierarchy'          => false,
			'expanded_details'   => false,
			'inspector'          => true,
			'inline_operations'  => true,
			'bulk_operations'    => true,
			'bulk_delete'        => true,
		),
		'templates' => array(
			'catalog'          => 'wpbc-appointment-services-catalog',
			'shell'            => 'wpbc-ui-catalog-shell',
			'items'            => 'wpbc-appointment-services-table',
			'header'           => 'wpbc-appointment-services-header',
			'cards_header'     => 'wpbc-appointment-services-cards-header',
			'row'              => 'wpbc-appointment-service-row',
			'card'             => 'wpbc-appointment-service-card',
			'status_label'     => 'wpbc-appointment-service-status-label',
			'provider_labels'  => 'wpbc-appointment-service-provider-labels',
			'pagination'       => 'wpbc-appointment-services-pagination',
			'empty'            => 'wpbc-ui-catalog-empty',
			'error'            => 'wpbc-appointment-services-error',
			'inspector'        => 'wpbc-ui-catalog-inspector-shell',
			'inspector_create' => 'wpbc-appointment-service-inspector-create',
			'inspector_edit'   => 'wpbc-appointment-service-inspector-edit',
			'inline_bar'       => 'wpbc-appointment-services-inline-bar',
			'inline_field'     => 'wpbc-appointment-service-inline-field',
			'inline_review'    => 'wpbc-appointment-services-inline-review',
			'bulk_edit'        => 'wpbc-appointment-services-bulk-edit',
			'bulk_review'      => 'wpbc-appointment-services-bulk-review',
			'delete_review'    => 'wpbc-appointment-services-delete-review',
		),
		'default_template_pack' => 'table',
		'template_packs' => array(
			'table'   => array( 'catalog' => 'wpbc-appointment-services-catalog', 'items' => 'wpbc-appointment-services-table', 'header' => 'wpbc-appointment-services-header', 'row' => 'wpbc-appointment-service-row' ),
			'compact' => array( 'catalog' => 'wpbc-appointment-services-catalog', 'items' => 'wpbc-appointment-services-compact', 'header' => 'wpbc-appointment-services-header', 'row' => 'wpbc-appointment-service-row' ),
			'cards'   => array( 'catalog' => 'wpbc-appointment-services-catalog', 'items' => 'wpbc-appointment-services-cards', 'header' => 'wpbc-appointment-services-cards-header', 'row' => 'wpbc-appointment-service-card' ),
		),
		'i18n' => array(
			'catalog_label'       => __( 'Services catalog', 'booking' ),
			'loading'             => __( 'Loading Services', 'booking' ) . '...',
			'empty_title'         => __( 'No items found', 'booking' ),
			'empty_message'       => __( 'There are no items to display for this request.', 'booking' ),
			'error_title'         => __( 'Services unavailable', 'booking' ),
			'error_message'       => __( 'Services could not be loaded. Please refresh the page and try again.', 'booking' ),
			'search_placeholder'  => __( 'Search Services', 'booking' ),
			'column_service'      => __( 'Service', 'booking' ),
			'column_duration'     => __( 'Duration', 'booking' ),
			'column_price'        => __( 'Price', 'booking' ),
			'column_providers'    => __( 'Providers', 'booking' ),
			'column_availability' => __( 'Weekly Availability', 'booking' ),
			'column_status'       => __( 'Status', 'booking' ),
			'column_actions'      => __( 'Actions', 'booking' ),
			'column_id'           => __( 'ID', 'booking' ),
			'active'              => __( 'Active', 'booking' ),
			'inactive'            => __( 'Draft', 'booking' ),
			'archived'            => __( 'Archived', 'booking' ),
			'edit'                => __( 'Edit Service', 'booking' ),
			'archive'             => __( 'Archive Service', 'booking' ),
			'no_provider'         => __( 'No Providers assigned', 'booking' ),
			'available'           => __( 'Available', 'booking' ),
			'unavailable'         => __( 'Unavailable', 'booking' ),
			'layout_table'        => __( 'Default', 'booking' ),
			'layout_compact'      => __( 'Compact', 'booking' ),
			'layout_cards'        => __( 'Cards', 'booking' ),
			'layout_label'        => __( 'Layout', 'booking' ),
			'sort_by'             => __( 'Sort by', 'booking' ),
			'sort_services'       => __( 'Sort Services', 'booking' ),
			'customize_columns'   => __( 'Customize columns', 'booking' ),
			'columns_legend'      => __( 'Visible columns', 'booking' ),
			'close_columns'       => __( 'Close column settings', 'booking' ),
			'always_visible'      => __( 'Always visible', 'booking' ),
			'select_all'          => __( 'Select all visible Services', 'booking' ),
			'selected_services'   => __( 'Selected Services:', 'booking' ),
			'clear_selection'     => __( 'Clear selection', 'booking' ),
			'edit_selected'       => __( 'Edit selected', 'booking' ),
			'delete_selected'     => __( 'Delete selected', 'booking' ),
			'edit_rows'           => __( 'Edit rows', 'booking' ),
			'reset_order'         => __( 'Reset column order', 'booking' ),
			'reset_preferences'   => __( 'Reset to default', 'booking' ),
			'show_label'          => __( 'Show', 'booking' ),
			'per_page_label'      => __( 'per page', 'booking' ),
			'pagination_label'    => __( 'Services pagination', 'booking' ),
			'previous_page'       => __( 'Previous page', 'booking' ),
			'next_page'           => __( 'Next page', 'booking' ),
			'page_number'         => __( 'Page number', 'booking' ),
			/* translators: 1: First visible item, 2: Last visible item, 3: Total Services. */
			'showing'             => __( 'Showing %1$s–%2$s of %3$s Services', 'booking' ),
		),
	);
}

/**
 * Register the Service catalog and its domain-owned WP templates.
 *
 * @return true|WP_Error Registration result.
 */
function wpbc_appointment_services_register_catalog() {
	static $registration_result = null;
	if ( null !== $registration_result ) {
		return $registration_result;
	}
	$template_directory = dirname( __DIR__ ) . '/templates/catalog';
	$registration_result = WPBC_UI_Catalog_Registry::get_instance()->register(
		wpbc_appointment_services_get_catalog_config(),
		new WPBC_Appointment_Services_Catalog_Provider(),
		array(
			'wpbc-appointment-services-catalog'          => $template_directory . '/catalog-wptpl.php',
			'wpbc-appointment-services-table'            => $template_directory . '/table-wptpl.php',
			'wpbc-appointment-services-compact'          => $template_directory . '/compact-wptpl.php',
			'wpbc-appointment-services-cards'            => $template_directory . '/cards-wptpl.php',
			'wpbc-appointment-services-header'           => $template_directory . '/header-wptpl.php',
			'wpbc-appointment-services-cards-header'     => $template_directory . '/cards-header-wptpl.php',
			'wpbc-appointment-service-row'               => $template_directory . '/service-row-wptpl.php',
			'wpbc-appointment-service-card'              => $template_directory . '/service-card-wptpl.php',
			'wpbc-appointment-service-status-label'      => $template_directory . '/status-label-wptpl.php',
			'wpbc-appointment-service-provider-labels'   => $template_directory . '/provider-labels-wptpl.php',
			'wpbc-appointment-services-pagination'       => $template_directory . '/pagination-wptpl.php',
			'wpbc-appointment-services-error'            => $template_directory . '/error-wptpl.php',
			'wpbc-appointment-service-inspector-create'  => $template_directory . '/inspector-create-wptpl.php',
			'wpbc-appointment-service-inspector-edit'    => $template_directory . '/inspector-edit-wptpl.php',
			'wpbc-appointment-services-inline-bar'       => $template_directory . '/inline-bar-wptpl.php',
			'wpbc-appointment-service-inline-field'      => $template_directory . '/inline-field-wptpl.php',
			'wpbc-appointment-services-inline-review'    => $template_directory . '/inline-review-wptpl.php',
			'wpbc-appointment-services-bulk-edit'        => $template_directory . '/bulk-edit-wptpl.php',
			'wpbc-appointment-services-bulk-review'      => $template_directory . '/bulk-review-wptpl.php',
			'wpbc-appointment-services-delete-review'    => $template_directory . '/delete-review-wptpl.php',
		)
	);

	return $registration_result;
}
