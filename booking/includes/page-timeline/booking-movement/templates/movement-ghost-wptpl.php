<?php
/**
 * Timeline booking-movement ghost template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-booking-movement-ghost">
	<div
		class="wpbc_timeline_booking_movement__ghost"
		data-wpbc-timeline-booking-movement-candidate-ghost
		data-wpbc-timeline-sortable-exclude
		aria-hidden="true"
	>
		<span class="wpbc_timeline_booking_movement__ghost_title">{{ data.title }}</span>
		<# if ( data.duration_label ) { #>
			<span class="wpbc_timeline_booking_movement__ghost_duration">{{ data.duration_label }}</span>
		<# } #>
	</div>
</script>
