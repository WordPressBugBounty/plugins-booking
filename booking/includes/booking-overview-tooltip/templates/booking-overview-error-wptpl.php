<?php
/**
 * Booking Overview right-column recoverable error WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-overview-error">
	<div class="wpbc_booking_overview_tooltip__details_state wpbc_booking_overview_tooltip__error notice notice-error inline" data-wpbc-booking-overview-details-state="error">
		<p>{{ data.message }}</p>
		<button type="button" class="button button-secondary" data-wpbc-booking-overview-retry>{{ data.retry_label }}</button>
	</div>
</script>
