<?php
/**
 * Configuration for the independent Booking Resources catalog.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return edition-aware Overview columns matching the established listing.
 *
 * The independent catalog owns this declaration and does not call the legacy
 * listing schema. Unsupported edition columns are omitted before preferences
 * and requests are validated.
 *
 * @return array<string,mixed> Allowed, visible, ordered, and defined columns.
 */
function wpbc_catalog_booking_resources_get_column_config() {
	$column_definitions = array(
		'resource' => array(
			'label'       => __( 'Booking resource', 'booking' ),
			'class'       => 'column-resource',
			'sort_key'    => 'title',
			'required'    => true,
			'reorderable' => true,
		),
		'labels'   => array(
			'label'       => __( 'Labels', 'booking' ),
			'class'       => 'column-labels',
			'sort_key'    => '',
			'required'    => false,
			'reorderable' => true,
		),
		'publishing' => array(
			'label'       => __( 'Publish shortcode', 'booking' ),
			'class'       => 'column-publishing',
			'sort_key'    => '',
			'required'    => false,
			'reorderable' => true,
		),
		'default_form' => array(
			'label'       => __( 'Default booking form', 'booking' ),
			'class'       => 'column-default-form',
			'sort_key'    => '',
			'required'    => false,
			'reorderable' => true,
		),
		'structure' => array(
			'label'       => __( 'Parent / child connection', 'booking' ),
			'class'       => 'column-structure',
			'sort_key'    => '',
			'required'    => false,
			'reorderable' => true,
		),
		'priority' => array(
			'label'       => __( 'Priority', 'booking' ),
			'class'       => 'column-priority',
			'sort_key'    => 'priority',
			'required'    => false,
			'reorderable' => true,
		),
		'capacity' => array(
			'label'       => __( 'Capacity', 'booking' ),
			'class'       => 'column-capacity',
			'sort_key'    => 'capacity',
			'required'    => false,
			'reorderable' => true,
		),
		'price'    => array(
			'label'       => __( 'Price', 'booking' ),
			'class'       => 'column-price',
			'sort_key'    => 'cost',
			'required'    => false,
			'reorderable' => true,
		),
		'owner'    => array(
			'label'       => __( 'Owner', 'booking' ),
			'class'       => 'column-owner',
			'sort_key'    => '',
			'required'    => false,
			'reorderable' => true,
		),
		'actions'  => array(
			'label'       => __( 'Actions', 'booking' ),
			'class'       => 'column-actions',
			'sort_key'    => '',
			'required'    => true,
			'reorderable' => true,
		),
		'id'       => array(
			'label'       => __( 'ID', 'booking' ),
			'class'       => 'column-id',
			'sort_key'    => 'id',
			'required'    => false,
			'reorderable' => true,
		),
	);

	if ( ! class_exists( 'wpdev_bk_biz_l' ) ) {
		unset( $column_definitions['structure'], $column_definitions['priority'], $column_definitions['capacity'] );
	}
	if ( ! class_exists( 'wpdev_bk_biz_s' ) ) {
		unset( $column_definitions['price'] );
	}
	if ( ! class_exists( 'wpdev_bk_biz_m' ) ) {
		unset( $column_definitions['default_form'] );
	}
	if (
		! class_exists( 'wpdev_bk_multiuser' )
		|| ! (bool) apply_bk_filter( 'multiuser_is_user_can_be_here', true, 'only_super_admin' )
	) {
		unset( $column_definitions['owner'] );
	}

	$column_ids = array_keys( $column_definitions );
	$default_visible_columns = class_exists( 'wpdev_bk_personal' )
		? array_values( array_intersect( array( 'resource', 'labels', 'capacity', 'price', 'actions', 'id' ), $column_ids ) )
		: $column_ids;

	return array(
		'allowed'         => $column_ids,
		'default_visible' => $default_visible_columns,
		'default_order'   => $column_ids,
		'required'        => array_values( array_intersect( array( 'resource', 'actions' ), $column_ids ) ),
		'definitions'     => $column_definitions,
	);
}

/**
 * Return the readable mechanics and template contract for this catalog.
 *
 * This domain configuration declares allow-lists and edition availability. It
 * contains no SQL, rendered HTML, ownership queries, or mutation behavior.
 *
 * @return array<string,mixed> Booking Resources catalog configuration.
 */
function wpbc_catalog_booking_resources_get_config() {
	$column_config = wpbc_catalog_booking_resources_get_column_config();
	$display_views = array(
		'overview'   => array(
			'label'  => __( 'Overview', 'booking' ),
			'fields' => array( 'resource', 'labels', 'capacity', 'price', 'actions', 'id' ),
		),
		'publishing' => array(
			'label'  => __( 'Publishing', 'booking' ),
			'fields' => array( 'resource', 'publishing', 'default_form', 'actions', 'id' ),
		),
	);
	if ( class_exists( 'wpdev_bk_biz_s' ) || class_exists( 'wpdev_bk_biz_m' ) || class_exists( 'wpdev_bk_biz_l' ) ) {
		$display_views['booking_setup'] = array(
			'label'  => __( 'Booking setup', 'booking' ),
			'fields' => array( 'resource', 'default_form', 'capacity', 'price', 'actions', 'id' ),
		);
	}
	if ( class_exists( 'wpdev_bk_biz_l' ) ) {
		$display_views['structure'] = array(
			'label'  => __( 'Structure', 'booking' ),
			'fields' => array( 'resource', 'structure', 'priority', 'capacity', 'actions', 'id' ),
		);
	}
	if ( isset( $column_config['definitions']['owner'] ) ) {
		$display_views['ownership'] = array(
			'label'  => __( 'Ownership', 'booking' ),
			'fields' => array( 'resource', 'owner', 'actions', 'id' ),
		);
	}
	$display_views['all'] = array(
		'label'  => __( 'All fields', 'booking' ),
		'fields' => $column_config['allowed'],
	);
	$sorting_keys  = array( 'id', 'title' );
	if ( isset( $column_config['definitions']['capacity'] ) ) {
		$sorting_keys[] = 'capacity';
	}
	if ( isset( $column_config['definitions']['priority'] ) ) {
		$sorting_keys[] = 'priority';
	}
	if ( isset( $column_config['definitions']['price'] ) ) {
		$sorting_keys[] = 'cost';
	}

	return array(
		'id'         => 'catalog_booking_resources',
		'action'     => 'WPBC_AJX_CATALOG_BOOKING_RESOURCES_LIST',
		'nonce_name' => 'wpbc_catalog_booking_resources_nonce',

		'items_per_page' => array(
			'default' => 10,
			'options' => array( 5, 10, 50, 100 ),
			'maximum' => 100,
		),

		'sorting' => array(
			'default_key'   => 'title',
			'default_order' => 'asc',
			'allowed_keys'  => $sorting_keys,
		),

		'columns' => $column_config,
		'views'   => array(
			'default'     => 'overview',
			'definitions' => $display_views,
		),

		'features' => array(
			'inline_operations'   => true,
			'selection'          => true,
			'range_selection'    => true,
			'column_preferences' => true,
			'column_order'       => true,
			'template_packs'     => true,
			'hierarchy'          => true,
			'expanded_details'   => true,
			'inspector'          => true,
			'bulk_operations'    => class_exists( 'wpdev_bk_biz_s' ),
			'delete_operations'  => class_exists( 'wpdev_bk_personal' ),
			'resource_filters'       => class_exists( 'wpdev_bk_personal' ),
			'resource_type_filter' => class_exists( 'wpdev_bk_biz_l' ),
		),
		'hierarchy' => array(
			'persistence'   => 'global',
			'preference_key' => 'hierarchy_state',
		),

		'templates' => array(
			'catalog'       => 'wpbc-booking-resources-catalog',
			'shell'         => 'wpbc-ui-catalog-shell',
			'items'         => 'wpbc-booking-resources-table',
			'filters'       => 'wpbc-booking-resources-filters',
			'toolbar'       => 'wpbc-booking-resources-toolbar',
			'header'        => 'wpbc-booking-resources-header',
			'row'           => 'wpbc-booking-resource-row',
			'parent_row'    => 'wpbc-booking-resource-parent-row',
			'child_row'     => 'wpbc-booking-resource-child-row',
			'row_cells'     => 'wpbc-booking-resource-row-cells',
			'child_summary' => 'wpbc-booking-resource-child-summary',
			'labels'        => 'wpbc-booking-resource-labels',
			'price'         => 'wpbc-booking-resource-price',
			'details'       => 'wpbc-booking-resource-details',
			'details_content' => 'wpbc-booking-resource-details-content',
			'empty'         => 'wpbc-ui-catalog-empty',
			'error'         => 'wpbc-ui-catalog-error',
			'pagination'    => 'wpbc-booking-resources-pagination',
			'action_menu'   => 'wpbc-booking-resource-actions',
			'inspector'       => 'wpbc-ui-catalog-inspector-shell',
			'inspector_create' => 'wpbc-booking-resource-inspector-create',
			'inspector_edit'   => 'wpbc-booking-resource-inspector-edit',
			'inspector_group'  => 'wpbc-booking-resource-inspector-group',
			'inspector_field'  => 'wpbc-booking-resource-inspector-field',
			'inspector_publishing' => 'wpbc-booking-resource-inspector-publishing',
			'inspector_published_pages' => 'wpbc-booking-resource-inspector-published-pages',
			'inspector_bulk_edit'        => 'wpbc-booking-resource-inspector-bulk-edit',
			'inspector_bulk_group'       => 'wpbc-booking-resource-inspector-bulk-group',
			'inspector_bulk_field'       => 'wpbc-booking-resource-inspector-bulk-field',
			'inspector_bulk_review'      => 'wpbc-booking-resource-inspector-bulk-review',
			'inspector_delete'           => 'wpbc-booking-resource-inspector-delete',
			'inspector_capacity'         => 'wpbc-booking-resource-inspector-capacity',
			'inline_bar'                 => 'wpbc-booking-resources-inline-bar',
			'inline_field'               => 'wpbc-booking-resource-inline-field',
			'inspector_inline_review'   => 'wpbc-booking-resource-inspector-inline-review',
		),

		'default_template_pack' => 'table',
		'template_packs'        => array(
			'table' => array(
				'catalog'       => 'wpbc-booking-resources-catalog',
				'items'         => 'wpbc-booking-resources-table',
				'filters'       => 'wpbc-booking-resources-filters',
				'toolbar'       => 'wpbc-booking-resources-toolbar',
				'header'        => 'wpbc-booking-resources-header',
				'row'           => 'wpbc-booking-resource-row',
				'parent_row'    => 'wpbc-booking-resource-parent-row',
				'child_row'     => 'wpbc-booking-resource-child-row',
				'row_cells'     => 'wpbc-booking-resource-row-cells',
				'child_summary' => 'wpbc-booking-resource-child-summary',
				'labels'        => 'wpbc-booking-resource-labels',
				'price'         => 'wpbc-booking-resource-price',
				'action_menu'   => 'wpbc-booking-resource-actions',
				'pagination'    => 'wpbc-booking-resources-pagination',
				'details'       => 'wpbc-booking-resource-details',
			),
			'compact' => array(
				'catalog'       => 'wpbc-booking-resources-catalog',
				'items'         => 'wpbc-booking-resources-compact',
				'filters'       => 'wpbc-booking-resources-filters',
				'toolbar'       => 'wpbc-booking-resources-toolbar',
				'header'        => 'wpbc-booking-resources-header',
				'row'           => 'wpbc-booking-resource-row',
				'parent_row'    => 'wpbc-booking-resource-parent-row',
				'child_row'     => 'wpbc-booking-resource-child-row',
				'row_cells'     => 'wpbc-booking-resource-row-cells',
				'child_summary' => 'wpbc-booking-resource-child-summary',
				'labels'        => 'wpbc-booking-resource-labels',
				'price'         => 'wpbc-booking-resource-price',
				'action_menu'   => 'wpbc-booking-resource-actions',
				'pagination'    => 'wpbc-booking-resources-pagination',
				'details'       => 'wpbc-booking-resource-details',
			),
			'cards' => array(
				'catalog'       => 'wpbc-booking-resources-catalog',
				'items'         => 'wpbc-booking-resources-cards',
				'filters'       => 'wpbc-booking-resources-filters',
				'toolbar'       => 'wpbc-booking-resources-toolbar',
				'header'        => 'wpbc-booking-resources-cards-header',
				'row'           => 'wpbc-booking-resource-card',
				'parent_row'    => 'wpbc-booking-resource-parent-card',
				'child_row'     => 'wpbc-booking-resource-child-card',
				'card_group'    => 'wpbc-booking-resource-card-group',
				'row_cells'     => 'wpbc-booking-resource-card-fields',
				'child_summary' => 'wpbc-booking-resource-child-summary-card',
				'labels'        => 'wpbc-booking-resource-labels',
				'price'         => 'wpbc-booking-resource-price',
				'action_menu'   => 'wpbc-booking-resource-actions',
				'pagination'    => 'wpbc-booking-resources-pagination',
				'details'       => 'wpbc-booking-resource-details-card',
			),
		),

		'i18n' => array(
			'catalog_label'     => __( 'Booking resources catalog', 'booking' ),
			'loading'           => __( 'Loading', 'booking' ) . '...',
			'empty_title'       => __( 'No items found', 'booking' ),
			'empty_message'     => __( 'There are no items to display for this request.', 'booking' ),
			'error_title'       => __( 'Catalog unavailable', 'booking' ),
			'error_message'     => __( 'The catalog could not be loaded. Please refresh the page and try again.', 'booking' ),
			'search_placeholder' => __( 'Search booking resources', 'booking' ),
			'search_label'       => __( 'Search booking resources', 'booking' ),
			'search_clear'       => __( 'Clear booking resource search', 'booking' ),
			'resource_type_label' => __( 'Filter booking resources by type', 'booking' ),
			'resource_type_all'   => __( 'All resource types', 'booking' ),
			'resource_type_single' => __( 'Resources', 'booking' ),
			'resource_type_parent' => __( 'Parent resources', 'booking' ),
			'resource_type_child'  => __( 'Child resources', 'booking' ),
			'view_label'           => __( 'View', 'booking' ),
			'layout_label'         => __( 'Layout', 'booking' ),
			'layout_table'         => __( 'Default', 'booking' ),
			'layout_compact'       => __( 'Compact', 'booking' ),
			'layout_cards'         => __( 'Cards', 'booking' ),
			'sort_resources'       => __( 'Sort booking resources', 'booking' ),
			'sort_by'              => __( 'Sort by', 'booking' ),
			'overview_view'        => __( 'Overview', 'booking' ),
			'custom_view'          => __( 'Custom columns', 'booking' ),
			'edit_rows'            => __( 'Edit rows', 'booking' ),
			'inline_editing_rows'  => __( 'Editing rows', 'booking' ),
			'inline_no_changes_yet' => __( 'No changes yet', 'booking' ),
			'inline_help'          => __( 'Edit safe fields on this page, then review all changes before applying them.', 'booking' ),
			'inline_changed'       => __( 'Changed', 'booking' ),
			/* translators: %1$s: Number of changed rows. */
			'inline_changed_row'   => __( '%1$s changed row', 'booking' ),
			/* translators: %1$s: Number of changed rows. */
			'inline_changed_rows'  => __( '%1$s changed rows', 'booking' ),
			'inline_loading'       => __( 'Preparing inline fields...', 'booking' ),
			'inline_review_title'  => __( 'Review inline changes', 'booking' ),
			'inline_review_description' => __( 'Confirm the row-specific changes before applying them.', 'booking' ),
			'inline_discard'       => __( 'Discard all inline Booking Resource changes?', 'booking' ),
			'inline_load_failed'   => __( 'The inline Booking Resource fields could not be loaded.', 'booking' ),
			'inline_review_failed' => __( 'The inline Booking Resource changes could not be reviewed.', 'booking' ),
			'inline_apply_failed'  => __( 'The inline Booking Resource changes could not be applied.', 'booking' ),
			'selected_resources'   => __( 'Selected resources:', 'booking' ),
			'clear_selection'      => __( 'Clear selection', 'booking' ),
			'edit_selected'        => __( 'Edit selected', 'booking' ),
			'delete_selected'      => __( 'Delete selected', 'booking' ),
			'resource_selected'    => __( 'resource selected', 'booking' ),
			'resources_selected'   => __( 'resources selected', 'booking' ),
			'current'              => __( 'Current', 'booking' ),
			'operation'            => __( 'operation', 'booking' ),
			'new_value'            => __( 'new value', 'booking' ),
			'edit_booking_resources' => __( 'Edit Booking Resources', 'booking' ),
			'delete_booking_resources' => __( 'Delete Booking Resources', 'booking' ),
			'review_changes'       => __( 'Review changes before applying', 'booking' ),
			'review_changes_help'  => __( 'No Booking Resource will change until you choose Apply changes.', 'booking' ),
			'review_changes_button' => __( 'Review changes', 'booking' ),
			'apply_changes'        => __( 'Apply changes', 'booking' ),
			'delete_review_help'   => __( 'Review this permanent action before deleting the selected resources.', 'booking' ),
			'resources_to_delete'  => __( 'Resources to be permanently deleted', 'booking' ),
			'delete_acknowledgement' => __( 'I understand that these Booking Resources will be permanently deleted.', 'booking' ),
			'delete_warning'       => __( 'This permanently removes the selected Booking Resources and their resource settings. This action cannot be undone.', 'booking' ),
			'bookings_retained_warning' => __( 'Existing bookings are retained, but their deleted Booking Resources will no longer be available. Reassign or remove those bookings first if they must remain editable.', 'booking' ),
			'bookings_retained'    => __( 'bookings retained', 'booking' ),
			'no_existing_bookings' => __( 'No existing bookings', 'booking' ),
			'resource_id'          => __( 'ID', 'booking' ),
			'delete_resource'      => __( 'Delete %1$s resource', 'booking' ),
			'delete_resources'     => __( 'Delete %1$s resources', 'booking' ),
			'bulk_load_failed'     => __( 'The selected Booking Resources could not be loaded.', 'booking' ),
			'bulk_review_failed'   => __( 'The proposed changes could not be reviewed.', 'booking' ),
			'bulk_apply_failed'    => __( 'The selected Booking Resources could not be updated.', 'booking' ),
			'delete_load_failed'   => __( 'The selected Booking Resources could not be reviewed for deletion.', 'booking' ),
			'delete_apply_failed'  => __( 'The selected Booking Resources could not be deleted.', 'booking' ),
			'adjust_capacity'       => __( 'Adjust capacity', 'booking' ),
			'capacity_description'  => __( 'Capacity controls how many unit calendars belong to this resource.', 'booking' ),
			'current_capacity'      => __( 'Current capacity', 'booking' ),
			'set_new_capacity'      => __( 'Set new capacity', 'booking' ),
			'before'                => __( 'Before', 'booking' ),
			'after'                 => __( 'After', 'booking' ),
			'units'                 => __( 'units', 'booking' ),
			'preview_changes'       => __( 'Preview changes', 'booking' ),
			'keep_existing_unit'    => __( 'Keep %1$s existing unit', 'booking' ),
			'keep_existing_units'   => __( 'Keep %1$s existing units', 'booking' ),
			'keep_existing_help'    => __( 'Existing unit calendars and their settings remain unchanged.', 'booking' ),
			'create_new_unit'       => __( 'Create %1$s new unit calendar', 'booking' ),
			'create_new_units'      => __( 'Create %1$s new unit calendars', 'booking' ),
			'create_units_help'     => __( 'New units inherit the parent resource owner, price, default form, photo, and description.', 'booking' ),
			'select_units_to_detach' => __( 'Select units to make independent', 'booking' ),
			'choose_detach_unit'     => __( 'Choose %1$s unit to make independent', 'booking' ),
			'choose_detach_units'    => __( 'Choose %1$s units to make independent', 'booking' ),
			'select_detach_help'    => __( 'Selected units become independent Booking Resources. Their bookings and settings stay unchanged.', 'booking' ),
			'make_independent'      => __( 'Becomes independent', 'booking' ),
			'decrease_outcome'      => __( 'When capacity decreases', 'booking' ),
			'detach_units'          => __( 'Make selected units independent', 'booking' ),
			'detach_units_help'     => __( 'Keep the selected units, their settings, and their bookings as independent Booking Resources.', 'booking' ),
			'delete_units'          => __( 'Permanently delete selected units', 'booking' ),
			'delete_units_help'     => __( 'Permanently remove the selected child Booking Resources. Existing bookings are retained but lose their available Booking Resource.', 'booking' ),
			'choose_delete_unit'     => __( 'Choose %1$s unit to permanently delete', 'booking' ),
			'choose_delete_units'    => __( 'Choose %1$s units to permanently delete', 'booking' ),
			'will_be_deleted'       => __( 'Will be deleted', 'booking' ),
			'units_to_delete'       => __( 'Units to be permanently deleted', 'booking' ),
			'capacity_delete_acknowledgement' => __( 'I understand that these child Booking Resources will be permanently deleted.', 'booking' ),
			'capacity_delete_warning' => __( 'This permanently removes the selected child Booking Resources and their settings. This action cannot be undone.', 'booking' ),
			'capacity_delete_bookings_warning' => __( 'Existing bookings are retained, but their deleted Booking Resources will no longer be available. Reassign or remove those bookings first if they must remain editable.', 'booking' ),
			'review_capacity_change' => __( 'Review capacity change', 'booking' ),
			'review_capacity_title' => __( 'Review capacity change', 'booking' ),
			'review_capacity_help'  => __( 'Confirm how the resource group will change.', 'booking' ),
			'new_child_units'       => __( 'New child units', 'booking' ),
			'new_child_calendar'    => __( 'New child calendar', 'booking' ),
			'independent_units'     => __( 'Independent units', 'booking' ),
			'no_resources_deleted'  => __( 'No Booking Resources or bookings will be deleted.', 'booking' ),
			'independent_units_help' => __( 'Each independent unit keeps its title, availability, pricing, and bookings.', 'booking' ),
			'back'                  => __( 'Back', 'booking' ),
			'apply_capacity_change' => __( 'Apply capacity change', 'booking' ),
			'capacity_load_failed'  => __( 'The capacity editor could not be loaded.', 'booking' ),
			'capacity_review_failed' => __( 'The capacity change could not be reviewed.', 'booking' ),
			'capacity_apply_failed' => __( 'The capacity change could not be applied.', 'booking' ),
			'selection_changed'    => __( 'The catalog selection changed. Close this inspector and start again with the current selection.', 'booking' ),
			'customize_columns'    => __( 'Customize columns', 'booking' ),
			'columns_legend'       => __( 'Visible columns', 'booking' ),
			'always_visible'       => __( 'Always visible', 'booking' ),
			'fixed_position'       => __( 'Fixed position', 'booking' ),
			'reset_order'          => __( 'Reset column order', 'booking' ),
			'reset_preferences'    => __( 'Reset to default', 'booking' ),
			'close_columns'        => __( 'Close column settings', 'booking' ),
			/* translators: %1$s: Catalog column label. */
			'move_column'          => __( 'Move %1$s column', 'booking' ),
			'column_moved'         => __( 'Column moved.', 'booking' ),
			'show'                 => __( 'Show', 'booking' ),
			'per_page'             => __( 'per page', 'booking' ),
			'page_number'          => __( 'Page number', 'booking' ),
			'no_description'       => __( 'No description', 'booking' ),
			/* translators: 1: Booking Resource title. 2: Booking Resource description. */
			'thumbnail_tooltip'    => __( 'Title: %1$s — Description: %2$s', 'booking' ),
			'parent_label'         => __( 'Parent', 'booking' ),
			'child_label'          => __( 'Child', 'booking' ),
			'independent_label'    => __( 'Independent', 'booking' ),
			/* translators: 1: Parent label. 2: Number of child Resources. */
			'parent_child_label'    => __( '%1$s · %2$s child', 'booking' ),
			/* translators: 1: Parent label. 2: Number of child Resources. */
			'parent_children_label' => __( '%1$s · %2$s children', 'booking' ),
			/* translators: 1: Parent Booking Resource title. 2: Number of child Resources. */
			'children_of_count'    => __( 'Children of %1$s (%2$s)', 'booking' ),
			/* translators: %1$s: Parent Booking Resource title. */
			'children_belong_to'   => __( 'Units that belong to %1$s.', 'booking' ),
			/* translators: %1$s: Parent Booking Resource title. */
			'child_of'             => __( 'Child of %1$s', 'booking' ),
			'column_resource'      => __( 'Booking Resource', 'booking' ),
			'column_labels'        => __( 'Labels', 'booking' ),
			'column_capacity'      => __( 'Capacity', 'booking' ),
			'column_price'         => __( 'Price', 'booking' ),
			'column_actions'       => __( 'Actions', 'booking' ),
			'column_id'            => __( 'ID', 'booking' ),
			'select_all'           => __( 'Select all visible booking resources', 'booking' ),
			/* translators: %s: Booking Resource title. */
			'select_resource'      => __( 'Select booking resource %s', 'booking' ),
			'expand_all'           => __( 'Expand all child resources', 'booking' ),
			'collapse_all'         => __( 'Collapse all child resources', 'booking' ),
			'expand_children'      => __( 'Show child resources', 'booking' ),
			'collapse_children'    => __( 'Hide child resources', 'booking' ),
			/* translators: %1$s: Number of child Booking Resources. */
			'child_count_singular' => __( '%1$s child resource', 'booking' ),
			/* translators: %1$s: Number of child Booking Resources. */
			'child_count_plural'   => __( '%1$s child resources', 'booking' ),
			/* translators: %1$s: Parent Booking Resource title. */
			'expand_children_for'  => __( 'Show child resources for %1$s', 'booking' ),
			/* translators: %1$s: Parent Booking Resource title. */
			'collapse_children_for' => __( 'Hide child resources for %1$s', 'booking' ),
			'show_details'         => __( 'Show resource details', 'booking' ),
			'hide_details'         => __( 'Hide resource details', 'booking' ),
			'details_loading'      => __( 'Loading', 'booking' ) . '...',
			'details_load_failed'  => __( 'The Booking Resource details could not be loaded. Please try again.', 'booking' ),
			'inspector_empty_title' => __( 'Edit a Booking Resource', 'booking' ),
			'inspector_empty_message' => __( 'Select a Booking Resource row or choose Edit to open its settings.', 'booking' ),
			'inspector_loading'      => __( 'Loading', 'booking' ) . '...',
			'inspector_load_failed'          => __( 'The Booking Resource editor could not be loaded.', 'booking' ),
			'inspector_save_failed'          => __( 'The Booking Resource could not be saved.', 'booking' ),
			'inspector_discard'              => __( 'Discard unsaved Booking Resource changes?', 'booking' ),
			'create_unavailable'             => __( 'The Booking Resource limit for this account has been reached.', 'booking' ),
			'select_image_title'             => __( 'Select Booking Resource Image', 'booking' ),
			'use_image'                      => __( 'Use this image', 'booking' ),
			'select_image'                   => __( 'Select image', 'booking' ),
			'remove_image'                   => __( 'Remove', 'booking' ),
			'demo_image_change_unavailable'       => __( 'Changing the Booking Resource image is not allowed in demo versions.', 'booking' ),
			'demo_image_change_unavailable_title' => __( 'Booking Resource image', 'booking' ),
			'cancel'                         => __( 'Cancel', 'booking' ),
			'save_changes'                   => __( 'Save changes', 'booking' ),
			'add_resource'                   => __( 'Add resource', 'booking' ),
			'shortcode_copied'     => __( 'Shortcode copied.', 'booking' ),
			'shortcode_copy_failed' => __( 'The shortcode could not be copied.', 'booking' ),
			'no_labels'            => __( 'No labels', 'booking' ),
			'no_actions'           => __( 'No actions available', 'booking' ),
			'price_unavailable'    => __( 'Price is not available', 'booking' ),
			/* translators: %1$s: Booking Resource title. */
			'actions_for'       => __(
				'Actions for %1$s',
				'booking'
			),
			'pagination_label'  => __( 'Booking Resources pagination', 'booking' ),
			'previous_page'     => __( 'Previous page', 'booking' ),
			'next_page'         => __( 'Next page', 'booking' ),
			/* translators: 1: Current page number. 2: Total page count. */
			'page_status'       => __(
				'Page %1$s of %2$s',
				'booking'
			),
			/* translators: 1: First result number. 2: Last result number. 3: Total result count. */
			'results_status'    => __(
				'Showing %1$s to %2$s of %3$s',
				'booking'
			),
		),
	);
}

/**
 * Register the catalog mechanics, independent provider, and WP templates.
 *
 * @return true|WP_Error Registration result.
 */
function wpbc_catalog_booking_resources_register_catalog() {
	static $registration_result = null;

	if ( null !== $registration_result ) {
		return $registration_result;
	}

	$registration_result = WPBC_UI_Catalog_Registry::get_instance()->register(
		wpbc_catalog_booking_resources_get_config(),
		new WPBC_Catalog_Booking_Resources_Provider(),
		array(
			'wpbc-booking-resources-catalog'    => __DIR__ . '/templates/booking-resources-wptpl.php',
			'wpbc-booking-resources-table'      => __DIR__ . '/templates/catalog-table-wptpl.php',
			'wpbc-booking-resources-compact'    => __DIR__ . '/templates/catalog-compact-wptpl.php',
			'wpbc-booking-resources-cards'      => __DIR__ . '/templates/catalog-cards-wptpl.php',
			'wpbc-booking-resources-cards-header' => __DIR__ . '/templates/catalog-cards-header-wptpl.php',
			'wpbc-booking-resources-filters'    => __DIR__ . '/templates/catalog-filters-wptpl.php',
			'wpbc-booking-resources-toolbar'    => __DIR__ . '/templates/catalog-toolbar-wptpl.php',
			'wpbc-booking-resources-header'     => __DIR__ . '/templates/catalog-header-wptpl.php',
			'wpbc-booking-resource-row'         => __DIR__ . '/templates/resource-row-wptpl.php',
			'wpbc-booking-resource-parent-row'  => __DIR__ . '/templates/resource-parent-row-wptpl.php',
			'wpbc-booking-resource-child-row'   => __DIR__ . '/templates/resource-child-row-wptpl.php',
			'wpbc-booking-resource-row-cells'   => __DIR__ . '/templates/resource-row-cells-wptpl.php',
			'wpbc-booking-resource-child-summary' => __DIR__ . '/templates/resource-child-summary-wptpl.php',
			'wpbc-booking-resource-card'         => __DIR__ . '/templates/resource-card-wptpl.php',
			'wpbc-booking-resource-parent-card'  => __DIR__ . '/templates/resource-parent-card-wptpl.php',
			'wpbc-booking-resource-child-card'   => __DIR__ . '/templates/resource-child-card-wptpl.php',
			'wpbc-booking-resource-card-group'   => __DIR__ . '/templates/resource-card-group-wptpl.php',
			'wpbc-booking-resource-card-fields'  => __DIR__ . '/templates/resource-card-fields-wptpl.php',
			'wpbc-booking-resource-child-summary-card' => __DIR__ . '/templates/resource-child-summary-card-wptpl.php',
			'wpbc-booking-resource-labels'      => __DIR__ . '/templates/resource-labels-wptpl.php',
			'wpbc-booking-resource-price'       => __DIR__ . '/templates/resource-price-wptpl.php',
			'wpbc-booking-resource-actions'     => __DIR__ . '/templates/resource-actions-wptpl.php',
			'wpbc-booking-resource-details'     => __DIR__ . '/templates/resource-details-wptpl.php',
			'wpbc-booking-resource-details-card' => __DIR__ . '/templates/resource-details-card-wptpl.php',
			'wpbc-booking-resource-details-content' => __DIR__ . '/templates/resource-details-content-wptpl.php',
			'wpbc-booking-resource-inspector-create' => __DIR__ . '/templates/resource-inspector-create-wptpl.php',
			'wpbc-booking-resource-inspector-edit'   => __DIR__ . '/templates/resource-inspector-edit-wptpl.php',
			'wpbc-booking-resource-inspector-group'  => __DIR__ . '/templates/resource-inspector-group-wptpl.php',
			'wpbc-booking-resource-inspector-field'  => __DIR__ . '/templates/resource-inspector-field-wptpl.php',
			'wpbc-booking-resource-inspector-publishing' => __DIR__ . '/templates/resource-inspector-publishing-wptpl.php',
			'wpbc-booking-resource-inspector-published-pages' => __DIR__ . '/templates/resource-inspector-published-pages-wptpl.php',
			'wpbc-booking-resource-inspector-bulk-edit' => __DIR__ . '/templates/resource-inspector-bulk-edit-wptpl.php',
			'wpbc-booking-resource-inspector-bulk-group' => __DIR__ . '/templates/resource-inspector-bulk-group-wptpl.php',
			'wpbc-booking-resource-inspector-bulk-field' => __DIR__ . '/templates/resource-inspector-bulk-field-wptpl.php',
			'wpbc-booking-resource-inspector-bulk-review' => __DIR__ . '/templates/resource-inspector-bulk-review-wptpl.php',
			'wpbc-booking-resource-inspector-delete' => __DIR__ . '/templates/resource-inspector-delete-wptpl.php',
			'wpbc-booking-resource-inspector-capacity' => __DIR__ . '/templates/resource-inspector-capacity-wptpl.php',
			'wpbc-booking-resources-inline-bar' => __DIR__ . '/templates/catalog-inline-bar-wptpl.php',
			'wpbc-booking-resource-inline-field' => __DIR__ . '/templates/resource-inline-field-wptpl.php',
			'wpbc-booking-resource-inspector-inline-review' => __DIR__ . '/templates/resource-inspector-inline-review-wptpl.php',
			'wpbc-booking-resources-pagination' => __DIR__ . '/templates/catalog-pagination-wptpl.php',
		)
	);

	return $registration_result;
}
