<?php
/**
 * Booking Overview right-column loading WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-overview-loading">
	<div class="wpbc_booking_overview_tooltip__details_state wpbc_booking_overview_tooltip__loading" data-wpbc-booking-overview-details-state="loading">
		<div class="wpbc_booking_overview_tooltip__loading_feedback">
			<div class="wpbc_booking_form_spin_loader" aria-hidden="true">
				<div class="wpbc_spins_loader_wrapper"><div class="wpbc_one_spin_loader_mini2"></div></div>
			</div>
			<span>{{ data.message }}</span>
			<div class="wpbc_booking_overview_tooltip__loading_skeleton" aria-hidden="true">
				<span></span>
				<span></span>
				<span></span>
			</div>
		</div>
	</div>
</script>
