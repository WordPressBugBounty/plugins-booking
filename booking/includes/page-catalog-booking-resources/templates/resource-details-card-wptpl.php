<?php
/**
 * Lazy Booking Resource details template for the cards pack.
 *
 * The shared details-body template keeps authorized fields and actions exactly
 * equivalent to the table packs while this wrapper supplies valid card markup.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-details-card">
	<section class="wpbc_booking_resources__details_row wpbc_booking_resources__details_row--card" role="listitem" id="wpbc_catalog_booking_resource_details_{{ data.resource_id }}" data-wpbc-booking-resource-details-row="{{ data.resource_id }}">
		<# print( wp.template( 'wpbc-booking-resource-details-content' )( data ) ); #>
	</section>
</script>
