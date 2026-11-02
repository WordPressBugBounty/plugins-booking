<?php
/**
 * Timeline adjacent-window recoverable-error WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-edge-error">
	<div class="wpbc_timeline__edge_buffer is-{{ data.direction }} is-error is-{{ data.area }}" data-wpbc-timeline-edge-sentinel="{{ data.direction }}">
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
			<div class="wpbc_timeline__edge_status" role="alert">
				<span class="wpbc-bi-exclamation-triangle" aria-hidden="true"></span>
				<span class="wpbc_timeline__edge_status_copy"><strong>{{ data.i18n.edge_load_failed }}</strong><# if ( data.preview.range_label ) { #><span>{{ data.preview.range_label }}</span><# } #></span>
				<button type="button" class="button" data-wpbc-timeline-edge-load="{{ data.direction }}">{{ data.i18n.retry_loading_dates }}</button>
			</div>
		<# } #>
	</div>
</script>
