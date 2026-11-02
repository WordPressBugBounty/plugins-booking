<?php
/**
 * Compact Timeline legend WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-legend">
	<div class="wpbc_timeline__legend" role="group" aria-label="{{ data.i18n.legend_label }}">
		<ul class="wpbc_timeline__legend_row wpbc_timeline__legend_row--status">
			<li class="wpbc_timeline__legend_item"><span class="wpbc_timeline__legend_marker is-approved" aria-hidden="true"></span>{{ data.i18n.approved }}</li>
			<li class="wpbc_timeline__legend_item"><span class="wpbc_timeline__legend_marker is-pending" aria-hidden="true"></span>{{ data.i18n.pending }}</li>
			<li class="wpbc_timeline__legend_item"><span class="wpbc_timeline__legend_marker is-available" aria-hidden="true"></span>{{ data.i18n.available }}</li>
		</ul>
		<# if ( data.availability_sources && data.availability_sources.length ) { #>
			<div class="wpbc_timeline__legend_row wpbc_timeline__legend_row--unavailable" role="group" aria-labelledby="wpbc-timeline-unavailable-legend-label">
				<span id="wpbc-timeline-unavailable-legend-label" class="wpbc_timeline__legend_group_label">{{ data.i18n.unavailable }}:</span>
				<ul class="wpbc_timeline__legend_items">
					<# _.each( data.availability_sources, function ( availability_source ) { #>
						<li class="wpbc_timeline__legend_item">
							<span
								class="wpbc_timeline__legend_marker is-unavailable"
								data-wpbc-timeline-availability-source="{{ availability_source.id }}"
								aria-hidden="true"
							></span>
							{{ availability_source.label }}
						</li>
					<# } ); #>
				</ul>
			</div>
		<# } #>
	</div>
</script>
