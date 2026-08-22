<?php
/**
 * Complete Appointment Service table-row WP template.
 *
 * Renders the ordered, visible Service fields prepared from the normalized DTO
 * without performing queries, authorization, or mutation work.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
?>
<script type="text/html" id="tmpl-wpbc-appointment-service-row">
	<tr class="wpbc_ui_listing__row wpbc_ui_catalog_inline_row wpbc_appointment_services__item<# if ( data.is_inspector_selected ) { #> is-inspector-selected<# } #>" data-service-id="{{ data.service_id }}" data-wpbc-ui-catalog-selectable-row data-wpbc-ui-catalog-selection-checkbox-only data-wpbc-right-sidebar-keep-open="1" tabindex="0" aria-current="{{ data.is_inspector_selected ? 'true' : 'false' }}">
		<td class="wpbc_ui_listing__selection_column column-selection"><input type="checkbox" value="{{ data.service_id }}" data-wpbc-ui-catalog-select-item aria-label="{{ data.select_label }}"></td>
		<# _.each( data.columns, function ( column ) { #><td class="{{ column.class_name }}" data-label="{{ column.label }}"><# print( data.cells[ column.id ] || '' ); #></td><# } ); #>
	</tr>
</script>
