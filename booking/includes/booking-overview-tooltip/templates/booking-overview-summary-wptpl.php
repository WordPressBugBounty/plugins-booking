<?php
/**
 * Booking Overview left-column summary WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-overview-summary">
	<div class="wpbc_booking_overview_tooltip__summary">
		<h4>{{ data.i18n.resource }}</h4>
		<div class="wpbc_booking_overview_tooltip__resource">
			<# if ( data.resource.picture_url ) { #><img src="{{ data.resource.picture_url }}" alt=""><# } #>
			<div>
				<strong>{{ data.resource.title || data.i18n.not_available }}</strong>
				<# if ( data.resource.subtitle ) { #><span>{{ data.resource.subtitle }}</span><# } #>
			</div>
		</div>
		<dl class="wpbc_booking_overview_tooltip__schedule">
			<div><dt>{{ data.i18n.start }}</dt><dd>{{ data.start_label || data.i18n.not_available }}</dd></div>
			<div><dt>{{ data.i18n.end }}</dt><dd>{{ data.end_label || data.i18n.not_available }}</dd></div>
			<div><dt>{{ data.i18n.duration }}</dt><dd>{{ data.duration_label || data.i18n.not_available }}</dd></div>
		</dl>
		<# if ( data.selected_dates.length ) { #>
		<details class="wpbc_booking_overview_tooltip__disclosure">
			<summary>{{ data.i18n.selected_dates }} ({{ data.selected_dates.length }})</summary>
			<ul class="wpbc_booking_overview_tooltip__list">
			<# _.each( data.selected_dates, function ( selected_date ) { #>
				<li><span>{{ selected_date.date_label }}</span><small>{{ selected_date.time_label }}</small></li>
			<# } ); #>
			</ul>
		</details>
		<# } #>
		<# if ( data.additional_intervals.length ) { #>
		<details class="wpbc_booking_overview_tooltip__disclosure">
			<summary>{{ data.i18n.intervals }} ({{ data.interval_count }})</summary>
			<ul class="wpbc_booking_overview_tooltip__list">
			<# _.each( data.additional_intervals, function ( interval ) { #>
				<li><span>{{ interval.start_label }}</span><span aria-hidden="true">&rarr;</span><span>{{ interval.end_label }}</span><# if ( interval.duration_label ) { #><small>{{ interval.duration_label }}</small><# } #></li>
			<# } ); #>
			</ul>
		</details>
		<# } #>
	</div>
</script>
