<?php
/**
 * Shared Booking Resource card-field layout template.
 *
 * Flat, parent, and child card wrappers compose this presentation-only partial
 * so changing the cards layout requires editing one identifiable template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-card-fields">
	<div class="wpbc_booking_resources__card_media">
		<# if ( data.picture_url ) { #><img src="{{ data.picture_url }}" alt="" loading="lazy" decoding="async"><# } else { #><span class="wpbc_booking_resources__card_media_placeholder"><i class="menu_icon icon-1x wpbc-bi-image-fill" aria-hidden="true"></i></span><# } #>
		<div class="wpbc_booking_resources__card_selection">
			<# if ( data.selection_enabled ) { #>
				<label class="wpbc_ui_listing__selection_control" for="wpbc_catalog_booking_resource_card_select_{{ data.id }}">
					<span class="screen-reader-text">{{ data.selection_label }}</span>
					<input type="checkbox" id="wpbc_catalog_booking_resource_card_select_{{ data.id }}" value="{{ data.id }}" data-wpbc-ui-catalog-select-item>
				</label>
			<# } #>
		</div>
	</div>
	<header class="wpbc_booking_resources__card_header">
		<div class="wpbc_booking_resources__resource_identity wpbc_booking_resources__resource_identity--{{ data.row_variant }}" data-wpbc-ui-catalog-field="resource">
			<span class="wpbc_ui_listing__table_icon tooltip_top" data-original-title="{{ data.thumbnail_label }}" aria-label="{{ data.thumbnail_label }}" role="img" tabindex="0" title="{{ data.thumbnail_label }}">
				<# if ( data.picture_url ) { #><img src="{{ data.picture_url }}" alt="" loading="lazy" decoding="async"><# } else { #><i class="menu_icon icon-1x wpbc-bi-image-fill" aria-hidden="true"></i><# } #>
			</span>
			<span class="wpbc_ui_listing__item_copy">
				<strong class="wpbc_ui_listing__item_title" id="wpbc_booking_resource_title_{{ data.id }}" data-wpbc-ui-catalog-overflow-tooltip="{{ data.title }}">{{ data.title }}</strong>
				<span class="wpbc_booking_resources__card_type_badge">{{ data.type_badge_label }}</span>
				<# if ( data.description ) { #><small class="wpbc_ui_listing__item_description" data-wpbc-ui-catalog-overflow-tooltip="{{ data.description }}">{{ data.description }}</small><# } #>
				<# if ( 'child' === data.row_variant && data.parent_context_label ) { #><small class="wpbc_booking_resources__card_parent_context" data-wpbc-ui-catalog-overflow-tooltip="{{ data.parent_context_label }}">{{ data.parent_context_label }}</small><# } #>
			</span>
		</div>
	</header>
	<div class="wpbc_booking_resources__card_fields">
		<# _.each( data.columns, function ( column ) {
			if ( 'labels' === column.id ) { #>
				<div class="wpbc_booking_resources__card_labels wpbc_booking_resources__card_field--labels" data-wpbc-ui-catalog-field="labels" data-wpbc-booking-resource-labels></div>
			<# return; }
			if ( -1 !== [ 'resource', 'actions', 'id' ].indexOf( column.id ) ) { return; } #>
			<dl class="wpbc_ui_listing__field wpbc_booking_resources__card_field {{ column.class_name }}" data-wpbc-ui-catalog-field="{{ column.id }}">
				<dt><# if ( 'capacity' === column.id ) { #><span class="wpbc-bi-calendar2-check" aria-hidden="true"></span><# } else if ( 'price' === column.id ) { #><span class="wpbc-bi-cash-coin" aria-hidden="true"></span><# } #>{{ column.label }}</dt>
				<dd>
					<# if ( 'capacity' === column.id ) { #>{{ data.capacity }}
					<# } else if ( 'publishing' === column.id ) { #><code class="wpbc_booking_resources__shortcode" data-wpbc-ui-catalog-overflow-tooltip="{{ data.publishing_shortcode }}">{{ data.publishing_shortcode }}</code>
					<# } else if ( 'default_form' === column.id ) { #><span class="wpbc_booking_resources__clipped_text" data-wpbc-ui-catalog-overflow-tooltip="{{ data.default_form }}">{{ data.default_form }}</span>
					<# } else if ( 'structure' === column.id ) { #><span class="wpbc_booking_resources__clipped_text" data-wpbc-ui-catalog-overflow-tooltip="{{ data.structure_label }}">{{ data.structure_label }}</span>
					<# } else if ( 'priority' === column.id ) { #>{{ data.priority }}
					<# } else if ( 'price' === column.id ) { #><span data-wpbc-booking-resource-price></span>
					<# } else if ( 'owner' === column.id ) { #><span class="wpbc_booking_resources__clipped_text" data-wpbc-ui-catalog-overflow-tooltip="{{ data.owner_display_name }}">{{ data.owner_display_name }}</span>
					<# } #>
				</dd>
			</dl>
		<# } ); #>
	</div>
	<footer class="wpbc_booking_resources__card_footer">
		<# _.each( data.columns, function ( column ) { if ( 'id' === column.id ) { #><span data-wpbc-ui-catalog-field="id">{{ column.label }} {{ data.id }}</span><# } } ); #>
		<span class="wpbc_booking_resources__card_footer_actions">
			<# _.each( data.columns, function ( column ) { if ( 'actions' === column.id ) { #><span>{{ column.label }}</span><div data-wpbc-booking-resource-actions></div><# } } ); #>
			<button type="button" class="wpbc_booking_resources__details_toggle" data-wpbc-booking-resource-action="toggle_details" data-wpbc-booking-resource-id="{{ data.id }}" aria-expanded="false" aria-controls="wpbc_catalog_booking_resource_details_{{ data.id }}" data-show-label="{{ data.i18n.show_details }}" data-hide-label="{{ data.i18n.hide_details }}" aria-label="{{ data.i18n.show_details }}" title="{{ data.i18n.show_details }}"><span class="wpbc-bi-chevron-down" aria-hidden="true"></span></button>
			<# if ( data.hierarchy.expandable ) { #>
				<button type="button" class="wpbc_ui_listing__hierarchy_toggle wpbc_booking_resources__hierarchy_toggle" data-wpbc-ui-catalog-hierarchy-toggle="{{ data.hierarchy.node_id }}" data-wpbc-ui-catalog-hierarchy-parent-toggle data-collapse-label="{{ data.collapse_label }}" data-expand-label="{{ data.expand_label }}" aria-controls="wpbc_booking_resource_children_{{ data.id }}" aria-expanded="<# if ( data.is_expanded ) { #>true<# } else { #>false<# } #>" aria-label="<# if ( data.is_expanded ) { #>{{ data.collapse_label }}<# } else { #>{{ data.expand_label }}<# } #>" title="<# if ( data.is_expanded ) { #>{{ data.collapse_label }}<# } else { #>{{ data.expand_label }}<# } #>"><span class="<# if ( data.is_expanded ) { #>wpbc-bi-chevron-down<# } else { #>wpbc-bi-chevron-right<# } #>" data-wpbc-ui-catalog-hierarchy-toggle-icon aria-hidden="true"></span></button>
			<# } #>
		</span>
	</footer>
</script>
