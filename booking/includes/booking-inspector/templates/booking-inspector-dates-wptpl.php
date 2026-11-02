<?php
/**
 * Booking Inspector canonical dates panel template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-inspector-dates">
	<section id="{{ data.inspector_id }}_panel_dates" class="wpbc_booking_inspector__panel" role="tabpanel" aria-labelledby="{{ data.inspector_id }}_tab_dates" tabindex="0" data-wpbc-booking-inspector-panel="dates" hidden>
		<# if ( data.dates.intervals && data.dates.intervals.length ) { #>
		<section class="wpbc_booking_inspector__card wpbc_booking_inspector__date_intervals_card">
			<h4>{{ data.i18n.canonical_intervals }}</h4>
			<# if ( data.dates.summary && data.dates.summary.metrics && data.dates.summary.metrics.length ) { #>
			<div class="wpbc_booking_inspector__date_metrics" aria-label="{{ data.i18n.date_summary }}"><# _.each( data.dates.summary.metrics, function ( metric_label ) { #><span>{{ metric_label }}</span><# } ); #></div>
			<# } #>
			<ul class="wpbc_booking_inspector__intervals"><# _.each( data.dates.intervals, function ( interval ) { #><li><div class="wpbc_booking_inspector__interval_range"><strong>{{ interval.start_label }}</strong><span class="wpbc_booking_inspector__interval_arrow wpbc_icn_arrow_forward" aria-hidden="true"></span><strong>{{ interval.end_label }}</strong></div></li><# } ); #></ul>
		</section>
		<# } #>
		<section class="wpbc_booking_inspector__card">
			<h4>{{ data.i18n.selected_dates }}</h4>
			<# if ( data.dates.selected_dates && data.dates.selected_dates.length ) { #>
			<ul class="wpbc_booking_inspector__date_list"><# _.each( data.dates.selected_dates, function ( selected_date ) { #><li><span class="wpbc-bi-calendar3" aria-hidden="true"></span><strong>{{ selected_date.date_label }}</strong><span>{{ selected_date.time_label }}</span></li><# } ); #></ul>
			<# } else { #>{{{ data.empty_state_html }}}<# } #>
		</section>
	</section>
</script>
