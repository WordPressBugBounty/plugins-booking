<?php
/**
 * Resource-side identity and time rail for the Timeline time-rows presentation.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-time-rows-resource">
	<section
		class="wpbc_timeline_time_rows wpbc_timeline_time_rows--resource"
		data-wpbc-timeline-time-rows-panel="resource"
		data-wpbc-timeline-time-rows-resource-id="{{ data.resource_id }}"
		data-wpbc-timeline-time-rows-cache-key="{{ data.cache_key }}"
		style="--wpbc-time-rows-body-height: {{ data.body_height_px }}px; --wpbc-time-rows-all-day-height: {{ data.all_day_height_px }}px;"
	>
		<header class="wpbc_timeline_time_rows__resource_header">
			<span class="screen-reader-text" role="status" aria-live="polite" data-wpbc-timeline-time-rows-preference-status></span>
			<div class="wpbc_timeline_time_rows__resource_identity">
				<span class="wpbc_timeline_time_rows__resource_identity_icon wpbc-bi-clock" aria-hidden="true"></span>
				<span class="wpbc_timeline_time_rows__resource_identity_copy">
					<strong>{{ data.resource_summary.title }}</strong>
					<span>{{ data.i18n.expanded_hours }}</span>
				</span>
				<button
					type="button"
					class="button-link wpbc_timeline_time_rows__collapse"
					data-wpbc-timeline-row-presentation-toggle="time_rows"
					data-wpbc-timeline-resource-id="{{ data.resource_id }}"
					aria-expanded="true"
					aria-controls="wpbc_timeline_row_presentation_resource_{{ data.resource_id }}_time_rows wpbc_timeline_row_presentation_canvas_{{ data.resource_id }}_time_rows"
				>
					<span>{{ data.i18n.collapse }}</span>
					<span class="wpbc-bi-chevron-down" aria-hidden="true"></span>
				</button>
			</div>
		</header>
		<div class="wpbc_timeline_time_rows__all_day_label" style="block-size: var(--wpbc-time-rows-all-day-height);">
			<strong>{{ data.i18n.all_day }}</strong>
		</div>
		<div class="wpbc_timeline_time_rows__time_rail" style="block-size: var(--wpbc-time-rows-body-height);" aria-hidden="true">
			<# _.each( data.time_ticks, function( tick ) { #>
				<span class="wpbc_timeline_time_rows__time_tick <# if ( tick.is_hour ) { #>is-hour<# } else if ( tick.is_half_hour ) { #>is-half-hour<# } else { #>is-minor<# } #><# if ( tick.is_boundary ) { #> is-boundary<# } #>" style="inset-block-start: {{ tick.offset_percent }}%;">
					<span class="wpbc_timeline_time_rows__time_tick_marker" aria-hidden="true"></span>
					<# if ( tick.label ) { #><span class="wpbc_timeline_time_rows__time_tick_label">{{ tick.label }}</span><# } #>
				</span>
			<# } ); #>
		</div>
	</section>
</script>
