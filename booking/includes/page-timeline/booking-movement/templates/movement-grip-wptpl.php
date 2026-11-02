<?php
/**
 * Explicit Timeline booking-movement grip template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-booking-movement-grip">
	<button
		type="button"
		class="wpbc_timeline__booking_accessory wpbc_timeline__booking_drag_indicator wpbc_timeline_booking_movement__grip"
		data-wpbc-timeline-booking-movement-grip
		data-wpbc-timeline-booking-id="{{ data.booking_id }}"
		aria-label="{{ data.label }}"
		aria-describedby="wpbc-timeline-booking-movement-live-region"
	>
		<span class="wpbc_icn_drag_indicator" aria-hidden="true"></span>
	</button>
</script>
