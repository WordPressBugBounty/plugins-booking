<?php
/**
 * Timeline month, date, and time-bucket header WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-axis-header">
	<header class="wpbc_timeline__axis_header <# if ( data.axis.is_timed ) { #>is-timed<# } #>" data-wpbc-timeline-axis>
		<div class="wpbc_timeline__month_band" aria-hidden="true">
			<# _.each( data.axis.month_bands, function( month_band ) { #>
				<div class="wpbc_timeline__month" style="--wpbc-timeline-axis-span: {{ month_band.span }};">
					<span class="wpbc_timeline__month_label">{{ month_band.label }}</span>
				</div>
			<# } ); #>
		</div>
		<# if ( data.axis.is_timed ) { #>
			<div class="wpbc_timeline__date_band" aria-hidden="true">
				<# _.each( data.axis.date_bands, function( date_band ) { #>
					<div class="wpbc_timeline__date_group <# if ( date_band.is_today ) { #>is-today<# } #><# if ( date_band.is_weekend ) { #> is-weekend<# } #>" style="--wpbc-timeline-axis-span: {{ date_band.span }};">
						<span class="wpbc_timeline__date_label"><span>{{ date_band.weekday }}</span><strong>{{ date_band.day_number }}</strong></span>
					</div>
				<# } ); #>
			</div>
		<# } #>
		<div class="wpbc_timeline__day_band" role="row">
			<# _.each( data.axis.cells, function( cell, cell_index ) { #>
				<div
					class="wpbc_timeline__day <# if ( data.axis.is_timed ) { #>is-time-cell<# } #><# if ( ! data.axis.is_timed && cell.is_today ) { #> is-today<# } #><# if ( cell.is_weekend ) { #> is-weekend<# } #>"
					data-wpbc-timeline-date="{{ cell.date }}"
					data-wpbc-timeline-axis-cell
					data-wpbc-timeline-cell-start="{{ cell.start_epoch }}"
					data-wpbc-timeline-cell-end="{{ cell.end_epoch }}"
					role="columnheader"
					tabindex="<# if ( 0 === cell_index ) { #>0<# } else { #>-1<# } #>"
					aria-label="{{ cell.aria_label }}"
				>
					<# if ( data.axis.is_timed ) { #>
						<strong class="wpbc_timeline__time_label">{{ cell.primary_label }}</strong>
						<# if ( cell.secondary_label ) { #><span class="wpbc_timeline__offset_label">UTC{{ cell.secondary_label }}</span><# } #>
					<# } else { #>
						<span class="wpbc_timeline__weekday">{{ cell.primary_label }}</span>
						<strong class="wpbc_timeline__day_number">{{ cell.day_number }}</strong>
						<# if ( cell.is_today ) { #><span class="wpbc_timeline__today_label">{{ cell.date }}</span><# } #>
					<# } #>
				</div>
			<# } ); #>
		</div>
		<# if ( data.axis.current_time_marker && data.axis.current_time_marker.is_visible ) { #>
			<span class="wpbc_timeline__current_time_header" style="inset-inline-start: {{ data.axis.current_time_marker.position_percent }}%;" title="{{ data.axis.current_time_marker.label }}">
				<span class="wpbc_timeline__current_time_badge" aria-hidden="true">{{ data.axis.current_time_marker.badge_label }}</span>
				<span class="screen-reader-text">{{ data.axis.current_time_marker.label }}</span>
			</span>
		<# } #>
	</header>
</script>
