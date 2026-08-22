<?php
/**
 * Complete parent Booking Resource card template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-parent-card">
	<article class="wpbc_booking_resources__item wpbc_booking_resources__card wpbc_booking_resources__item--parent wpbc_catalog_booking_resources__row--group-root<# if ( data.is_expanded ) { #> is-expanded<# } #>" role="listitem" data-wpbc-booking-resource-id="{{ data.id }}" data-wpbc-ui-catalog-node-id="{{ data.hierarchy.node_id }}" data-wpbc-ui-catalog-hierarchy-container <# if ( data.hierarchy.expandable ) { #>data-wpbc-ui-catalog-hierarchy-expandable<# } #> data-wpbc-ui-catalog-selectable-row data-wpbc-ui-catalog-selection-checkbox-only data-wpbc-listing-item-id="{{ data.id }}" data-wpbc-booking-resource-type="parent">
		<# print( wp.template( 'wpbc-booking-resource-card-fields' )( data ) ); #>
	</article>
</script>
