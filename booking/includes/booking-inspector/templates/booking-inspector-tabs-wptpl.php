<?php
/**
 * Booking Inspector tab-list template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-inspector-tabs">
	<div class="wpbc_booking_inspector__tabs" role="tablist" aria-label="{{ data.i18n.title }}">
		<button type="button" id="{{ data.inspector_id }}_tab_details" role="tab" aria-selected="true" aria-controls="{{ data.inspector_id }}_panel_details" tabindex="0" data-wpbc-booking-inspector-tab="details">{{ data.i18n.booking_details }}</button>
		<button type="button" id="{{ data.inspector_id }}_tab_dates" role="tab" aria-selected="false" aria-controls="{{ data.inspector_id }}_panel_dates" tabindex="-1" data-wpbc-booking-inspector-tab="dates">{{ data.i18n.dates }}</button>
		<# if ( data.costs_supported ) { #><button type="button" id="{{ data.inspector_id }}_tab_costs" role="tab" aria-selected="false" aria-controls="{{ data.inspector_id }}_panel_costs" tabindex="-1" data-wpbc-booking-inspector-tab="costs">{{ data.i18n.costs }}</button><# } #>
		<button type="button" id="{{ data.inspector_id }}_tab_activity" role="tab" aria-selected="false" aria-controls="{{ data.inspector_id }}_panel_activity" tabindex="-1" data-wpbc-booking-inspector-tab="activity">{{ data.i18n.activity }}</button>
	</div>
</script>
