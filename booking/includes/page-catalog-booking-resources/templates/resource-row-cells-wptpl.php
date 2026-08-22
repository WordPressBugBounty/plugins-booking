<?php
/**
 * Shared Booking Resource row-cell layout template.
 *
 * Parent, child, and flat row wrappers compose this presentation-only partial,
 * keeping column layout in one identifiable WP template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-row-cells">
	<# if ( data.selection_enabled ) { #>
		<td class="wpbc_ui_listing__column_selection" data-label="">
			<label class="wpbc_ui_listing__selection_control" for="wpbc_catalog_booking_resource_select_{{ data.id }}">
				<span class="screen-reader-text">{{ data.selection_label }}</span>
				<input type="checkbox" id="wpbc_catalog_booking_resource_select_{{ data.id }}" value="{{ data.id }}" data-wpbc-ui-catalog-select-item>
			</label>
			<button type="button" class="wpbc_booking_resources__details_toggle" data-wpbc-booking-resource-action="toggle_details" data-wpbc-booking-resource-id="{{ data.id }}" aria-expanded="false" aria-controls="wpbc_catalog_booking_resource_details_{{ data.id }}" data-show-label="{{ data.i18n.show_details }}" data-hide-label="{{ data.i18n.hide_details }}" aria-label="{{ data.i18n.show_details }}" title="{{ data.i18n.show_details }}">
				<span class="wpbc-bi-chevron-down" aria-hidden="true"></span>
			</button>
		</td>
	<# } #>
	<# _.each( data.columns, function ( column ) { #>
		<td class="wpbc_ui_listing__field {{ column.class_name }}" data-wpbc-ui-catalog-field="{{ column.id }}" data-label="{{ column.label }}">
			<# if ( 'resource' === column.id ) { #>
				<div class="wpbc_booking_resources__resource_identity wpbc_booking_resources__resource_identity--{{ data.row_variant }}">
					<# if ( data.hierarchy.expandable ) { #>
						<button type="button" class="wpbc_ui_listing__hierarchy_toggle wpbc_booking_resources__hierarchy_toggle" data-wpbc-ui-catalog-hierarchy-toggle="{{ data.hierarchy.node_id }}" data-wpbc-ui-catalog-hierarchy-parent-toggle data-collapse-label="{{ data.collapse_label }}" data-expand-label="{{ data.expand_label }}" aria-expanded="<# if ( data.is_expanded ) { #>true<# } else { #>false<# } #>" aria-label="<# if ( data.is_expanded ) { #>{{ data.collapse_label }}<# } else { #>{{ data.expand_label }}<# } #>" title="<# if ( data.is_expanded ) { #>{{ data.collapse_label }}<# } else { #>{{ data.expand_label }}<# } #>">
							<span class="<# if ( data.is_expanded ) { #>wpbc-bi-chevron-down<# } else { #>wpbc-bi-chevron-right<# } #>" data-wpbc-ui-catalog-hierarchy-toggle-icon aria-hidden="true"></span>
						</button>
					<# } #>
					<# if ( 'child' === data.row_variant ) { #><span class="wpbc_booking_resources__tree_connector" aria-hidden="true"></span><# } #>
					<span class="wpbc_ui_listing__table_icon tooltip_top" data-original-title="{{ data.thumbnail_label }}" aria-label="{{ data.thumbnail_label }}" role="img" tabindex="0" title="{{ data.thumbnail_label }}">
						<# if ( data.picture_url ) { #>
							<img src="{{ data.picture_url }}" alt="" loading="lazy" decoding="async">
						<# } else { #>
							<i class="menu_icon icon-1x wpbc-bi-image-fill" aria-hidden="true"></i>
						<# } #>
					</span>
					<span class="wpbc_ui_listing__item_copy">
						<strong class="wpbc_ui_listing__item_title" id="wpbc_booking_resource_title_{{ data.id }}" data-wpbc-ui-catalog-overflow-tooltip="{{ data.title }}">
							{{ data.title }}
							<# if ( 'parent' === data.row_variant ) { #><span class="wpbc_booking_resources__parent_badge">{{ data.parent_label }}</span><# } #>
						</strong>
						<# if ( data.description ) { #><small class="wpbc_ui_listing__item_description" data-wpbc-ui-catalog-overflow-tooltip="{{ data.description }}">{{ data.description }}</small><# } #>
					</span>
				</div>
			<# } else if ( 'labels' === column.id ) { #>
				<div data-wpbc-booking-resource-labels></div>
			<# } else if ( 'capacity' === column.id ) { #>
				{{ data.capacity }}
			<# } else if ( 'publishing' === column.id ) { #>
				<code class="wpbc_booking_resources__shortcode" data-wpbc-ui-catalog-overflow-tooltip="{{ data.publishing_shortcode }}">{{ data.publishing_shortcode }}</code>
			<# } else if ( 'default_form' === column.id ) { #>
				<span class="wpbc_booking_resources__clipped_text" data-wpbc-ui-catalog-overflow-tooltip="{{ data.default_form }}">{{ data.default_form }}</span>
			<# } else if ( 'structure' === column.id ) { #>
				<span class="wpbc_booking_resources__clipped_text" data-wpbc-ui-catalog-overflow-tooltip="{{ data.structure_label }}">{{ data.structure_label }}</span>
			<# } else if ( 'priority' === column.id ) { #>
				{{ data.priority }}
			<# } else if ( 'price' === column.id ) { #>
				<span data-wpbc-booking-resource-price></span>
			<# } else if ( 'owner' === column.id ) { #>
				<span class="wpbc_booking_resources__clipped_text" data-wpbc-ui-catalog-overflow-tooltip="{{ data.owner_display_name }}">{{ data.owner_display_name }}</span>
			<# } else if ( 'actions' === column.id ) { #>
				<div data-wpbc-booking-resource-actions></div>
			<# } else if ( 'id' === column.id ) { #>
				{{ data.id }}
			<# } #>
		</td>
	<# } ); #>
</script>
