<?php
/**
 * Complete flat Booking Resource card template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-card">
	<article class="wpbc_booking_resources__item wpbc_booking_resources__card wpbc_booking_resources__item--single" role="listitem" data-wpbc-booking-resource-id="{{ data.id }}" data-wpbc-ui-catalog-node-id="{{ data.hierarchy.node_id }}" data-wpbc-ui-catalog-selectable-row data-wpbc-ui-catalog-selection-checkbox-only data-wpbc-listing-item-id="{{ data.id }}" data-wpbc-booking-resource-type="{{ data.hierarchy.type }}">
		<# print( wp.template( 'wpbc-booking-resource-card-fields' )( data ) ); #>
	</article>
</script>
