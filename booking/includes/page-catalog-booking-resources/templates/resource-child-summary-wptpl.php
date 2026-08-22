<?php
/**
 * Collapsed child-group summary row template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-child-summary">
	<tr class="wpbc_ui_listing__row wpbc_booking_resources__children_summary" data-wpbc-parent-id="{{ data.parent_id }}" data-wpbc-ui-catalog-hierarchy-summary-for="{{ data.parent_node_id }}"<# if ( data.is_expanded ) { #> hidden<# } #>>
		<# if ( data.selection_enabled ) { #>
			<td class="wpbc_ui_listing__column_selection wpbc_booking_resources__children_summary_spacer" data-label=""></td>
		<# } #>
		<# _.each( data.columns, function ( column ) { #>
			<td class="wpbc_ui_listing__field {{ column.class_name }}<# if ( 'resource' !== column.id ) { #> wpbc_booking_resources__children_summary_spacer<# } #>" data-wpbc-ui-catalog-field="{{ column.id }}" data-label="">
				<# if ( 'resource' === column.id ) { #>
					<button type="button" class="wpbc_ui_catalog__hierarchy_summary_button wpbc_booking_resources__children_summary_button" data-wpbc-ui-catalog-hierarchy-toggle="{{ data.parent_node_id }}" data-wpbc-ui-catalog-hierarchy-summary-toggle data-collapse-label="{{ data.collapse_label }}" data-expand-label="{{ data.expand_label }}" aria-expanded="<# if ( data.is_expanded ) { #>true<# } else { #>false<# } #>" aria-label="<# if ( data.is_expanded ) { #>{{ data.collapse_label }}<# } else { #>{{ data.expand_label }}<# } #>" title="<# if ( data.is_expanded ) { #>{{ data.collapse_label }}<# } else { #>{{ data.expand_label }}<# } #>">
						<span class="wpbc_ui_catalog__hierarchy_summary_connector wpbc_booking_resources__summary_connector" aria-hidden="true"></span>
						<span class="<# if ( data.is_expanded ) { #>wpbc-bi-chevron-down<# } else { #>wpbc-bi-chevron-right<# } #>" data-wpbc-ui-catalog-hierarchy-toggle-icon aria-hidden="true"></span>
						<span data-wpbc-ui-catalog-hierarchy-summary-count>{{ data.children_label }}</span>
					</button>
				<# } #>
			</td>
		<# } ); #>
	</tr>
</script>
