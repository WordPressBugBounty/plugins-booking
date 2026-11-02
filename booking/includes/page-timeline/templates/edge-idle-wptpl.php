<?php
/**
 * Timeline adjacent-window idle WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-edge-idle">
	<div class="wpbc_timeline__edge_buffer is-{{ data.direction }} is-idle is-{{ data.area }}" data-wpbc-timeline-edge-sentinel="{{ data.direction }}">
		<# if ( 'header' === data.area ) { #>
			<div class="wpbc_timeline__edge_preview_header" aria-hidden="true">
				<# _.each( data.preview.cells, function( preview_cell ) { #>
					<span class="wpbc_timeline__edge_preview_cell <# if ( preview_cell.is_weekend ) { #>is-weekend<# } #>">
						<# if ( data.preview.is_timed ) { #>
							<strong>{{ preview_cell.primary_label }}</strong>
						<# } else { #>
							<span>{{ preview_cell.primary_label }}</span>
							<strong>{{ preview_cell.day_number }}</strong>
						<# } #>
					</span>
				<# } ); #>
			</div>
		<# } else { #>
			<div class="wpbc_timeline__edge_placeholder_rows" aria-hidden="true">
				<# _.each( data.placeholder_rows, function( placeholder_row ) { #>
					<div class="wpbc_timeline__edge_placeholder_row" style="height: {{ placeholder_row.height_px }}px;">
						<# _.each( placeholder_row.cells, function() { #><span class="wpbc_timeline__edge_placeholder_cell"><i></i></span><# } ); #>
					</div>
				<# } ); #>
			</div>
			<div class="wpbc_timeline__edge_status">
				<button type="button" class="button" data-wpbc-timeline-edge-load="{{ data.direction }}">
					<# if ( 'previous' === data.direction ) { #>{{ data.i18n.load_previous_dates }}<# } else { #>{{ data.i18n.load_next_dates }}<# } #>
				</button>
			</div>
		<# } #>
	</div>
</script>
