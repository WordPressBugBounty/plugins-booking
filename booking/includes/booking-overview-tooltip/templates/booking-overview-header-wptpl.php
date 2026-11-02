<?php
/**
 * Booking Overview single-row header WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-overview-header">
	<div class="wpbc_booking_overview_tooltip__header_identity">
		<strong>{{ data.heading }}</strong>
		<# if ( data.label ) { #><span class="wpbc_booking_overview_tooltip__header_label">{{ data.label }}</span><# } #>
		<span class="wpbc_booking_overview_tooltip__status is-{{ data.status_key }}">
			<span class="wpbc_booking_overview_tooltip__status_marker" aria-hidden="true"></span>
			{{ data.status_label }}
		</span>
	</div>
</script>
