<?php
/**
 * Stable two-column Booking Overview WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-overview-tooltip">
	<div class="wpbc_booking_overview_tooltip" data-wpbc-booking-overview-view data-wpbc-booking-id="{{ data.booking_id }}">
		<div class="wpbc_booking_overview_tooltip__body">
			<section class="wpbc_booking_overview_tooltip__column wpbc_booking_overview_tooltip__column--summary" data-wpbc-booking-overview-summary-host>
				{{{ data.summary_html }}}
			</section>
			<section
				class="wpbc_booking_overview_tooltip__column wpbc_booking_overview_tooltip__column--details"
				data-wpbc-booking-overview-details-host
				aria-busy="true"
				tabindex="-1"
			>
				{{{ data.details_html }}}
			</section>
		</div>

		<footer class="wpbc_booking_overview_tooltip__footer">
			<button type="button" class="button button-primary wpbc_booking_overview_tooltip__action" data-wpbc-booking-overview-open-details>{{ data.open_details_label }}</button>
		</footer>
	</div>
</script>
