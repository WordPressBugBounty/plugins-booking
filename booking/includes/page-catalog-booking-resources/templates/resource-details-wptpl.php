<?php
/**
 * Lazy Booking Resource details-row template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-details">
	<tr class="wpbc_booking_resources__details_row" id="wpbc_catalog_booking_resource_details_{{ data.resource_id }}" data-wpbc-booking-resource-details-row="{{ data.resource_id }}">
		<td colspan="{{ data.colspan }}">
			<# print( wp.template( 'wpbc-booking-resource-details-content' )( data ) ); #>
		</td>
	</tr>
</script>
