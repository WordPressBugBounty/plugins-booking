<?php
/**
 * Booking Resources table header template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resources-header">
	<tr>
		<# if ( data.selection_enabled ) { #>
			<th scope="col" class="wpbc_ui_listing__column wpbc_ui_listing__column_selection">
				<label class="wpbc_ui_listing__selection_control" for="wpbc_catalog_booking_resources_select_all">
					<span class="screen-reader-text">{{ data.i18n.select_all }}</span>
					<input type="checkbox" id="wpbc_catalog_booking_resources_select_all" data-wpbc-ui-catalog-select-all>
				</label>
			</th>
		<# } #>
		<# _.each( data.columns, function ( column ) { #>
			<th scope="col" class="wpbc_ui_listing__column {{ column.class_name }}" data-wpbc-ui-catalog-column="{{ column.id }}"<# if ( column.sort_key ) { #> aria-sort="{{ column.aria_sort }}"<# } #>>
				<# if ( data.hierarchy_enabled && 'resource' === column.id ) { #>
					<button type="button" class="wpbc_ui_listing__hierarchy_all_toggle wpbc_booking_resources__hierarchy_all_toggle" data-wpbc-ui-catalog-hierarchy-toggle-all aria-pressed="<# if ( data.all_expanded ) { #>true<# } else { #>false<# } #>" aria-label="<# if ( data.all_expanded ) { #>{{ data.i18n.collapse_all }}<# } else { #>{{ data.i18n.expand_all }}<# } #>" title="<# if ( data.all_expanded ) { #>{{ data.i18n.collapse_all }}<# } else { #>{{ data.i18n.expand_all }}<# } #>">
						<span class="wpbc_icn_rotate_90 <# if ( data.all_expanded ) { #>wpbc-bi-arrows-collapse-vertical<# } else { #>wpbc-bi-arrows-expand-vertical<# } #>" data-wpbc-ui-catalog-hierarchy-toggle-all-icon aria-hidden="true"></span>
					</button>
				<# } #>
				<# if ( column.sort_key ) { #>
					<a href="#" class="wpbc_ui_listing__sort_link<# if ( column.is_sorted ) { #> is-active<# } #>" data-wpbc-ui-catalog-sort="{{ column.sort_key }}">
						<span>{{ column.label }}</span>
						<i class="wpbc_ui_listing__sort_icon {{ column.sort_icon }}" aria-hidden="true"></i>
					</a>
				<# } else { #>
					{{ column.label }}
				<# } #>
			</th>
		<# } ); #>
	</tr>
</script>
