<?php
/**
 * Timeline axis-cell backdrop WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-canvas-backdrop">
	<div class="wpbc_timeline__canvas_backdrop" aria-hidden="true">
		<# _.each( data.axis.cells, function( cell ) { #>
			<span
				class="wpbc_timeline__canvas_backdrop_day <# if ( ! data.axis.is_timed && cell.is_today ) { #>is-today<# } #><# if ( cell.is_weekend ) { #> is-weekend<# } #>"
				data-wpbc-timeline-canvas-anchor-cell
				data-wpbc-timeline-cell-start="{{ cell.start_epoch }}"
				data-wpbc-timeline-cell-end="{{ cell.end_epoch }}"
			></span>
		<# } ); #>
		<# if ( data.axis.current_time_marker && data.axis.current_time_marker.is_visible ) { #>
			<span class="wpbc_timeline__current_time_marker" style="inset-inline-start: {{ data.axis.current_time_marker.position_percent }}%;"></span>
		<# } #>
	</div>
</script>
