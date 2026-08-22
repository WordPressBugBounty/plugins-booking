<?php
/**
 * Complete child Booking Resource row template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-child-row">
	<tr
		class="wpbc_ui_listing__row wpbc_booking_resources__item wpbc_catalog_booking_resources__row wpbc_booking_resources__item--child<# if ( data.hierarchy.is_last_sibling ) { #> wpbc_booking_resources__item--last-child<# } #>"
		data-wpbc-booking-resource-id="{{ data.id }}"
		data-wpbc-ui-catalog-node-id="{{ data.hierarchy.node_id }}"
		data-wpbc-ui-catalog-parent-node-id="{{ data.hierarchy.parent_node_id }}"
		data-wpbc-ui-catalog-selectable-row
		data-wpbc-listing-item-id="{{ data.id }}"
		data-wpbc-booking-resource-type="child"
		data-wpbc-parent-id="{{ data.hierarchy.parent_id }}"
		aria-selected="false"
		tabindex="0"
		<# if ( ! data.is_expanded ) { #>hidden<# } #>
	>
		<# print( wp.template( 'wpbc-booking-resource-row-cells' )( data ) ); #>
	</tr>
</script>
