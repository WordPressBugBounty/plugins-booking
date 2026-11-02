<?php
/**
 * Timeline adjacent-window slow-request WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-edge-slow">
	<div class="wpbc_timeline__edge_buffer is-{{ data.direction }} is-slow is-{{ data.area }}" data-wpbc-timeline-edge-sentinel="{{ data.direction }}">
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
			<div class="wpbc_timeline__edge_status" role="status" aria-live="polite">
				<span class="wpbc_booking_form_spin_loader wpbc_timeline__shared_spinner" aria-hidden="true">
					<span class="wpbc_spins_loader_wrapper">
						<span class="wpbc_one_spin_loader_mini2"></span>
					</span>
				</span>
				<span class="wpbc_timeline__edge_status_copy">
					<strong><# if ( 'previous' === data.direction ) { #>{{ data.i18n.loading_previous_dates }}<# } else { #>{{ data.i18n.loading_next_dates }}<# } #></strong>
					<span><# if ( data.preview.range_label ) { #>{{ data.preview.range_label }} · <# } #>{{ data.i18n.still_loading }}</span>
				</span>
				<button type="button" class="button" data-wpbc-timeline-edge-cancel="{{ data.direction }}">{{ data.i18n.cancel_loading }}</button>
			</div>
		<# } #>
	</div>
</script>
