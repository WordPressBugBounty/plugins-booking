<?php
/**
 * Booking Resource labels template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-labels">
	<# if ( data.labels.length ) { #>
		<div class="wpbc_booking_resources__labels wpbc_flextable_labels" aria-label="{{ data.aria_label }}">
			<# _.each( data.labels, function ( label ) { #>
				<span class="wpbc_label wpbc_booking_resources__label wpbc_booking_resources__label--{{ label.kind }} {{ label.class_name }}" title="{{ label.title }}" data-wpbc-ui-catalog-static-title="{{ label.title }}" data-wpbc-ui-catalog-overflow-tooltip="{{ label.text }}">{{ label.text }}</span>
			<# } ); #>
		</div>
	<# } else { #>
		<span class="screen-reader-text">{{ data.empty_label }}</span><span aria-hidden="true">&mdash;</span>
	<# } #>
</script>
