<?php
/**
 * Timeline zoom and window toolbar WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-toolbar">
	<div class="wpbc_timeline__toolbar" aria-label="{{ data.i18n.toolbar_label }}">
		<div class="wpbc_timeline__toolbar_group wpbc_timeline__toolbar_group--start">
			<div class="wpbc_timeline__shared_dropdown wpbc_timeline__shared_dropdown--advanced-combination" data-wpbc-timeline-advanced-combination-dropdown></div>
			<span id="wpbc_timeline_advanced_combination_description" class="screen-reader-text" data-wpbc-timeline-advanced-combination-description>{{ data.i18n.advanced_combination_description }}</span>
			<div class="wpbc_timeline__visual_zoom wpbc_timeline__visual_zoom--toolbar">
				<label class="wpbc_timeline__visual_zoom_label" for="wpbc_timeline_visual_zoom">{{ data.i18n.visual_zoom_short_label }}</label>
				<div class="wpbc_timeline__visual_zoom_control">
					<span class="wpbc-bi-zoom-out" aria-hidden="true"></span>
					<input
						type="range"
						id="wpbc_timeline_visual_zoom"
						class="wpbc_timeline__visual_zoom_range"
						min="{{ data.metadata.visual_zoom.min_percent }}"
						max="{{ data.metadata.visual_zoom.max_percent }}"
						step="{{ data.metadata.visual_zoom.step_percent }}"
						value="{{ data.metadata.visual_zoom.default_percent }}"
						data-wpbc-timeline-visual-zoom-range
						aria-label="{{ data.i18n.visual_zoom_label }}"
						aria-describedby="wpbc_timeline_visual_zoom_description wpbc_timeline_visual_zoom_status"
					>
					<span class="wpbc-bi-zoom-in" aria-hidden="true"></span>
					<output id="wpbc_timeline_visual_zoom_status" class="wpbc_timeline__visual_zoom_status" for="wpbc_timeline_visual_zoom" data-wpbc-timeline-visual-zoom-status><# if ( data.metadata.visual_zoom && data.metadata.visual_zoom.default_percent ) { #>{{ data.metadata.visual_zoom.default_percent }}%<# } else { #>100%<# } #></output>
				</div>
				<span id="wpbc_timeline_visual_zoom_description" class="screen-reader-text">{{ data.i18n.visual_zoom_description }}</span>
			</div>
		</div>
		<div class="wpbc_timeline__toolbar_group wpbc_timeline__toolbar_group--end">
			<div class="wpbc_timeline__date_range_navigation" data-wpbc-timeline-date-range-navigation></div>
			<div class="wpbc_timeline__date_jump" data-wpbc-timeline-date-jump></div>
			<div class="wpbc_timeline__reset_preferences" data-wpbc-timeline-reset-preferences-host></div>
		</div>
	</div>
</script>
