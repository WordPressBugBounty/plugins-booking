<?php
/**
 * Booking Inspector composition template.
 *
 * Every HTML fragment is rendered by an allow-listed domain template before
 * it reaches this composition boundary. The server response remains data-only.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-inspector-details">
	<article class="wpbc_booking_inspector" data-wpbc-booking-inspector-booking="{{ data.booking_id }}">
		{{{ data.header_html }}}
		{{{ data.resource_html }}}
		{{{ data.tabs_html }}}
		<div class="wpbc_booking_inspector__panels">
			{{{ data.booking_fields_html }}}
			{{{ data.dates_html }}}
			{{{ data.costs_html }}}
			{{{ data.activity_html }}}
		</div>
		{{{ data.footer_html }}}
	</article>
</script>
