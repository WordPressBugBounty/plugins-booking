<?php
/**
 * Timeline booking-movement canonical-card loading template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-booking-movement-loading">
	<span
		class="wpbc_timeline_booking_movement__loading"
		data-wpbc-timeline-booking-movement-loading
		aria-hidden="true"
	>
		<span class="wpbc_booking_form_spin_loader">
			<span class="wpbc_spins_loader_wrapper">
				<span class="wpbc_one_spin_loader_mini2"></span>
			</span>
		</span>
	</span>
</script>
