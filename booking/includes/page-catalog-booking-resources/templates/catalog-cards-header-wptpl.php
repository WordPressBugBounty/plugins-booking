<?php
/**
 * Booking Resources cards header and sorting template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resources-cards-header">
	<div class="wpbc_booking_resources__cards_header_controls">
		<# if ( data.selection_enabled ) { #>
			<label class="wpbc_ui_listing__selection_control wpbc_booking_resources__cards_select_all" for="wpbc_catalog_booking_resources_cards_select_all">
				<input type="checkbox" id="wpbc_catalog_booking_resources_cards_select_all" data-wpbc-ui-catalog-select-all>
				<span>{{ data.i18n.select_all }}</span>
			</label>
		<# } #>
		<# if ( data.hierarchy_enabled ) { #>
			<button type="button" class="wpbc_ui_listing__hierarchy_all_toggle wpbc_booking_resources__hierarchy_all_toggle" data-wpbc-ui-catalog-hierarchy-toggle-all aria-pressed="<# if ( data.all_expanded ) { #>true<# } else { #>false<# } #>" aria-label="<# if ( data.all_expanded ) { #>{{ data.i18n.collapse_all }}<# } else { #>{{ data.i18n.expand_all }}<# } #>" title="<# if ( data.all_expanded ) { #>{{ data.i18n.collapse_all }}<# } else { #>{{ data.i18n.expand_all }}<# } #>">
				<span class="wpbc_icn_rotate_90 <# if ( data.all_expanded ) { #>wpbc-bi-arrows-collapse-vertical<# } else { #>wpbc-bi-arrows-expand-vertical<# } #>" data-wpbc-ui-catalog-hierarchy-toggle-all-icon aria-hidden="true"></span>
			</button>
		<# } #>
	</div>
	<nav class="wpbc_booking_resources__cards_sort" aria-label="{{ data.i18n.sort_resources }}">
		<span>{{ data.i18n.sort_by }}</span>
		<# _.each( data.columns, function ( column ) { if ( ! column.sort_key ) { return; } #>
			<a href="#" class="wpbc_ui_listing__sort_link<# if ( column.is_sorted ) { #> is-active<# } #>" data-wpbc-ui-catalog-sort="{{ column.sort_key }}"<# if ( column.is_sorted ) { #> aria-current="true"<# } #>>
				<span>{{ column.label }}</span>
				<i class="wpbc_ui_listing__sort_icon {{ column.sort_icon }}" aria-hidden="true"></i>
			</a>
		<# } ); #>
	</nav>
</script>
