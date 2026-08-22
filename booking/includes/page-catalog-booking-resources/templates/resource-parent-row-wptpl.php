<?php
/**
 * Complete parent Booking Resource row template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-parent-row">
	<tr
		class="wpbc_ui_listing__row wpbc_booking_resources__item wpbc_catalog_booking_resources__row wpbc_booking_resources__item--parent wpbc_catalog_booking_resources__row--group-root<# if ( data.is_expanded ) { #> is-expanded<# } #>"
		data-wpbc-booking-resource-id="{{ data.id }}"
		data-wpbc-ui-catalog-node-id="{{ data.hierarchy.node_id }}"
		data-wpbc-ui-catalog-hierarchy-container
		<# if ( data.hierarchy.expandable ) { #>data-wpbc-ui-catalog-hierarchy-expandable<# } #>
		data-wpbc-ui-catalog-selectable-row
		data-wpbc-listing-item-id="{{ data.id }}"
		data-wpbc-booking-resource-type="parent"
		aria-selected="false"
		tabindex="0"
	>
		<# print( wp.template( 'wpbc-booking-resource-row-cells' )( data ) ); #>
	</tr>
</script>
