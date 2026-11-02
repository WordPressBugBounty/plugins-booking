<?php
/**
 * Administration Timeline shell WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-shell">
	<section
		class="wpbc_timeline wpbc_timeline--{{ data.navigation_pack }}"
		data-wpbc-timeline-component="{{ data.component_id }}"
		data-wpbc-timeline-template-pack="{{ data.template_pack }}"
		dir="<# if ( data.is_rtl ) { #>rtl<# } else { #>ltr<# } #>"
		style="--wpbc-timeline-cells: {{ data.axis.cell_count }}; --wpbc-timeline-cell-width: {{ data.axis.cell_width_px }}px; --wpbc_timeline_general__resource-header-height: {{ data.axis.header_height_px }}px;"
		aria-labelledby="wpbc_timeline_canvas_heading"
	>
		<div class="wpbc_timeline__toolbar_host" data-wpbc-timeline-toolbar></div>
		<div class="wpbc_timeline__viewport">
			<div class="wpbc_timeline__sticky_header">
				<div class="wpbc_timeline__resource_header">
					<div data-wpbc-timeline-resource-pane-toggle-host></div>
					<h2 id="wpbc_timeline_resources_heading">{{ data.i18n.resource_heading }}</h2>
					<div data-wpbc-timeline-resource-selector-host></div>
				</div>
				<div class="wpbc_timeline__axis_header_viewport" data-wpbc-timeline-axis-viewport>
					<div class="wpbc_timeline__axis_header_track">
						<div data-wpbc-timeline-edge-header="previous"></div>
						<div class="wpbc_timeline__axis_header_content" data-wpbc-timeline-axis-header></div>
						<div data-wpbc-timeline-edge-header="next"></div>
					</div>
				</div>
			</div>
			<div class="wpbc_timeline__body">
				<aside id="wpbc_timeline_resource_pane" class="wpbc_timeline__resources <# if ( data.resource_upgrade && data.resource_upgrade.visible ) { #>has-resource-upgrade<# } #>" data-wpbc-timeline-resource-pane aria-labelledby="wpbc_timeline_resources_heading">
					<div class="wpbc_timeline__resource_rows" data-wpbc-timeline-resource-rows></div>
					<# if ( data.resource_upgrade && data.resource_upgrade.visible ) { #>
						<div class="wpbc_timeline__resource_upgrade">
							<?php wpbc_catalog_booking_resources_render_upgrade_button( true, true ); ?>
						</div>
					<# } #>
					<div data-wpbc-timeline-resource-main-pagination></div>
				</aside>
				<section class="wpbc_timeline__canvas" data-wpbc-timeline-canvas aria-labelledby="wpbc_timeline_canvas_heading" tabindex="0">
					<h2 id="wpbc_timeline_canvas_heading" class="screen-reader-text">{{ data.i18n.canvas_heading }}</h2>
					<div class="wpbc_timeline__canvas_body">
						<div data-wpbc-timeline-edge-canvas="previous"></div>
						<div class="wpbc_timeline__canvas_axis_content" data-wpbc-timeline-canvas-axis-content>
							<div data-wpbc-timeline-canvas-backdrop></div>
							<div class="wpbc_timeline__canvas_rows" data-wpbc-timeline-canvas-rows></div>
						</div>
						<div data-wpbc-timeline-edge-canvas="next"></div>
					</div>
				</section>
			</div>
			<div class="wpbc_timeline__state_host" data-wpbc-timeline-state hidden></div>
			<div class="wpbc_timeline__request_overlay" data-wpbc-timeline-request-overlay aria-hidden="true" hidden>
				<div class="wpbc_spins_loading_container wpbc_timeline__request_overlay_status">
					<div class="wpbc_booking_form_spin_loader" aria-hidden="true">
						<div class="wpbc_spins_loader_wrapper">
							<div class="wpbc_one_spin_loader_mini2"></div>
						</div>
					</div>
					<span data-wpbc-timeline-request-overlay-message>{{ data.i18n.loading }}</span>
				</div>
			</div>
		</div>
		<div class="wpbc_timeline__legend_host" data-wpbc-timeline-legend></div>
		<div data-wpbc-timeline-resource-settings-inspector-host></div>
		<div data-wpbc-timeline-booking-inspector-host></div>
		<# if ( data.new_booking && data.new_booking.visible ) { #>
			<div data-wpbc-booking-new-inspector-host></div>
		<# } #>
	</section>
</script>
