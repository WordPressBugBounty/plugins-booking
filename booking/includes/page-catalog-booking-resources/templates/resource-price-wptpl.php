<?php
/**
 * Booking Resource price template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-price">
	<# if ( data.price.display ) { #>
		<span class="wpbc_booking_resources__price_value" aria-label="{{ data.price.display }}">
			<span aria-hidden="true">{{ data.price.major }}<# if ( data.price.fraction ) { #><small class="wpbc_booking_resources__price_fraction">{{ data.price.fraction }}</small><# } #>{{ data.price.suffix }}</span>
		</span>
		<# if ( data.price.period_label ) { #>
			<span class="wpbc_booking_resources__price_period">/ {{ data.price.period_label }}</span>
		<# } #>
	<# } else { #>
		<span class="screen-reader-text">{{ data.empty_label }}</span><span aria-hidden="true">&mdash;</span>
	<# } #>
</script>
