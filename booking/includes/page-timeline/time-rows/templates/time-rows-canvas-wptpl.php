<?php
/**
 * Canvas-side controls and booking/Availability surfaces for time rows.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-time-rows-canvas">
	<section
		class="wpbc_timeline_time_rows wpbc_timeline_time_rows--canvas"
		data-wpbc-timeline-time-rows-panel="canvas"
		data-wpbc-timeline-time-rows-resource-id="{{ data.resource_id }}"
		data-wpbc-timeline-time-rows-cache-key="{{ data.cache_key }}"
		style="--wpbc-time-rows-body-height: {{ data.body_height_px }}px; --wpbc-time-rows-all-day-height: {{ data.all_day_height_px }}px;"
	>
		<header class="wpbc_timeline_time_rows__canvas_toolbar">
			<div
				class="wpbc_timeline_time_rows__toolbar_card wpbc_timeline_time_rows__range_control"
				data-wpbc-timeline-time-rows-range-control
				data-wpbc-timeline-resource-id="{{ data.resource_id }}"
				style="--wpbc-time-rows-range-start: {{ data.range.start_percent }}%; --wpbc-time-rows-range-end: {{ data.range.end_percent }}%;"
			>
				<div class="wpbc_timeline_time_rows__range_heading">
					<div class="wpbc_timeline_time_rows__range_editor">
						<span class="wpbc_timeline_time_rows__range_summary">
							<span class="wpbc_timeline_time_rows__control_label">{{ data.i18n.visible_hours }}:</span>
							<span class="wpbc_timeline_time_rows__range_values" aria-live="polite">
								<output for="wpbc_time_rows_range_start_{{ data.resource_id }}" data-wpbc-timeline-time-rows-range-output="start">{{ data.range.start_label }}</output>
								<span aria-hidden="true">&ndash;</span>
								<output for="wpbc_time_rows_range_end_{{ data.resource_id }}" data-wpbc-timeline-time-rows-range-output="end">{{ data.range.end_label }}</output>
							</span>
						</span>
						<div class="wpbc_timeline_time_rows__dual_range" role="group" aria-label="{{ data.i18n.time_range }}">
							<span class="wpbc_timeline_time_rows__dual_range_track" aria-hidden="true"><span></span></span>
							<input
								type="range"
								id="wpbc_time_rows_range_start_{{ data.resource_id }}"
								min="0"
								max="1440"
								step="{{ data.range.step_minutes }}"
								value="{{ data.range.start_minute }}"
								data-wpbc-timeline-time-rows-range
								data-wpbc-timeline-time-rows-range-boundary="start"
								data-wpbc-timeline-resource-id="{{ data.resource_id }}"
								aria-label="{{ data.range.start_aria_label }}"
							>
							<input
								type="range"
								id="wpbc_time_rows_range_end_{{ data.resource_id }}"
								min="0"
								max="1440"
								step="{{ data.range.step_minutes }}"
								value="{{ data.range.end_minute }}"
								data-wpbc-timeline-time-rows-range
								data-wpbc-timeline-time-rows-range-boundary="end"
								data-wpbc-timeline-resource-id="{{ data.resource_id }}"
								aria-label="{{ data.range.end_aria_label }}"
							>
						</div>
					</div>
					<span class="wpbc_timeline_time_rows__range_actions">
						<button
							type="button"
							class="button-link <# if ( 'auto' === data.range.mode ) { #>is-active<# } #>"
							data-wpbc-timeline-time-rows-range-mode="auto"
							data-wpbc-timeline-resource-id="{{ data.resource_id }}"
							aria-label="{{ data.i18n.use_auto_range }}"
							aria-pressed="<# if ( 'auto' === data.range.mode ) { #>true<# } else { #>false<# } #>"
						>{{ data.i18n.auto_range }}</button>
						<# _.each( data.range.presets, function( preset ) { #>
							<button
								type="button"
								class="button-link wpbc_timeline_time_rows__range_preset <# if ( preset.is_active ) { #>is-active<# } #>"
								data-wpbc-timeline-time-rows-range-mode="custom"
								data-wpbc-timeline-time-rows-range-preset="{{ preset.id }}"
								data-wpbc-timeline-resource-id="{{ data.resource_id }}"
								aria-label="{{ preset.aria_label }}"
								aria-pressed="<# if ( preset.is_active ) { #>true<# } else { #>false<# } #>"
								title="{{ preset.aria_label }}"
							>{{ preset.label }}</button>
						<# } ); #>
						<button
							type="button"
							class="button-link <# if ( 'full_day' === data.range.mode ) { #>is-active<# } #>"
							data-wpbc-timeline-time-rows-range-mode="full_day"
							data-wpbc-timeline-resource-id="{{ data.resource_id }}"
							aria-label="{{ data.i18n.use_full_day_range }}"
							aria-pressed="<# if ( 'full_day' === data.range.mode ) { #>true<# } else { #>false<# } #>"
						>{{ data.i18n.full_day_range }}</button>
					</span>
				</div>
			</div>
			<label class="wpbc_timeline_time_rows__toolbar_card wpbc_timeline_time_rows__zoom_control">
				<span class="wpbc_timeline_time_rows__control_label">{{ data.i18n.time_zoom }}:</span>
				<span class="wpbc-bi-zoom-out" aria-hidden="true"></span>
				<input
					type="range"
					class="wpbc_timeline_time_rows__zoom_range"
					min="{{ data.zoom.min_percent }}"
					max="{{ data.zoom.max_percent }}"
					step="{{ data.zoom.step_percent }}"
					value="{{ data.zoom.percent }}"
					data-wpbc-timeline-time-rows-zoom
					data-wpbc-timeline-resource-id="{{ data.resource_id }}"
					aria-label="{{ data.i18n.time_zoom }}"
					aria-describedby="wpbc_time_rows_zoom_description_{{ data.resource_id }}"
					aria-valuetext="{{ data.zoom.label }}"
				>
				<span class="wpbc-bi-zoom-in" aria-hidden="true"></span>
				<output class="wpbc_timeline_time_rows__zoom_status" data-wpbc-timeline-time-rows-zoom-status>{{ data.zoom.label }}</output>
				<span id="wpbc_time_rows_zoom_description_{{ data.resource_id }}" class="screen-reader-text">{{ data.i18n.time_zoom_description }}</span>
			</label>
		</header>

		<div class="wpbc_timeline_time_rows__state_host" data-wpbc-timeline-time-rows-state-host></div>

		<div
			class="wpbc_timeline_time_rows__all_day_surface"
			style="block-size: var(--wpbc-time-rows-all-day-height);"
			aria-label="{{ data.i18n.all_day }}"
		>
			<# _.each( data.dates, function( date ) { #>
				<span class="wpbc_timeline_time_rows__date_column" data-wpbc-timeline-time-rows-date="{{ date.date }}" style="inset-inline-start: {{ date.offset_percent }}%; inline-size: {{ date.width_percent }}%;" aria-hidden="true"></span>
			<# } ); #>
			<# _.each( data.full_day_fragments, function( fragment ) { #>
				<article
					class="wpbc_timeline_time_rows__booking wpbc_timeline_time_rows__booking--all-day is-{{ fragment.status }} <# if ( fragment.shows_earlier_indicator ) { #>is-clipped-start<# } #><# if ( fragment.shows_later_indicator ) { #> is-clipped-end<# } #>"
					data-wpbc-timeline-segment-id="{{ fragment.render_segment_id }}"
					data-wpbc-timeline-booking-id="{{ fragment.booking_id }}"
					data-wpbc-timeline-booking-resource-id="{{ fragment.resource_id }}"
					data-wpbc-booking-inspector-trigger
					data-wpbc-booking-inspector-trigger-id="{{ fragment.render_segment_id }}"
					data-wpbc-booking-id="{{ fragment.booking_id }}"
					data-wpbc-timeline-time-rows-read-only
					style="inset-inline-start: {{ fragment.left_percent }}%; inline-size: {{ fragment.width_percent }}%; inset-block-start: {{ fragment.stack_top_px }}px;"
					role="group"
					aria-label="{{ fragment.aria_label }}"
				>
					<button type="button" class="wpbc_timeline_time_rows__booking_select" data-wpbc-timeline-booking-select aria-label="{{ fragment.selection_aria_label }}" aria-pressed="false">
						<# if ( fragment.shows_earlier_indicator ) { #><span class="wpbc_timeline_time_rows__continuation is-earlier" aria-hidden="true">&lsaquo;</span><# } #>
						<# if ( fragment.initials ) { #><span class="wpbc_timeline_time_rows__avatar" aria-hidden="true">{{ fragment.initials }}</span><# } #>
						<span class="wpbc_timeline_time_rows__booking_copy"><strong>{{ fragment.label }}</strong><span>{{ fragment.schedule_label }}</span></span>
						<span class="wpbc_timeline_time_rows__booking_status" title="{{ fragment.status_label }}" aria-hidden="true"><# if ( 'approved' === fragment.status ) { #>&#10003;<# } else if ( 'pending' === fragment.status ) { #>&hellip;<# } else { #>?<# } #></span>
						<# if ( fragment.shows_later_indicator ) { #><span class="wpbc_timeline_time_rows__continuation is-later" aria-hidden="true">&rsaquo;</span><# } #>
					</button>
					<span class="wpbc_timeline_time_rows__booking_controls" data-wpbc-timeline-booking-control-rail data-wpbc-timeline-booking-control-rail-card-owned data-wpbc-timeline-booking-id="{{ fragment.booking_id }}">
						<button type="button" class="wpbc_timeline_time_rows__booking_info" data-wpbc-booking-overview-info-trigger data-wpbc-timeline-booking-id="{{ fragment.booking_id }}" data-wpbc-timeline-segment-hint="{{ fragment.render_segment_id }}" aria-label="{{ fragment.information_aria_label }}" aria-haspopup="dialog" aria-expanded="false"><span class="wpbc-bi-info-circle" aria-hidden="true"></span></button>
						<button type="button" class="wpbc_timeline_time_rows__booking_details" data-wpbc-timeline-booking-details-action data-wpbc-timeline-booking-id="{{ fragment.booking_id }}" data-wpbc-timeline-segment-hint="{{ fragment.render_segment_id }}" aria-label="{{ fragment.details_aria_label }}" aria-haspopup="dialog" hidden><span class="wpbc-bi-three-dots-vertical" aria-hidden="true"></span></button>
					</span>
					<span class="wpbc_timeline_time_rows__booking_selection_chrome" aria-hidden="true"></span>
				</article>
			<# } ); #>
		</div>

		<div class="wpbc_timeline_time_rows__timed_surface" style="block-size: var(--wpbc-time-rows-body-height);">
			<# _.each( data.dates, function( date ) { #>
				<span class="wpbc_timeline_time_rows__date_column" data-wpbc-timeline-time-rows-date="{{ date.date }}" style="inset-inline-start: {{ date.offset_percent }}%; inline-size: {{ date.width_percent }}%;" aria-hidden="true"></span>
				<# _.each( date.dst_slices, function( transition ) { #>
					<span class="wpbc_timeline_time_rows__dst_slice is-{{ transition.kind }}" style="inset-inline-start: {{ date.offset_percent }}%; inline-size: {{ date.width_percent }}%; inset-block-start: {{ transition.top_percent }}%; block-size: {{ transition.height_percent }}%;" role="note" aria-label="{{ transition.label }}"><span>{{ transition.kind_label }}</span></span>
				<# } ); #>
			<# } ); #>
			<# _.each( data.time_ticks, function( tick ) { if ( ! tick.is_hour ) { return; } #><span class="wpbc_timeline_time_rows__hour_line" style="inset-block-start: {{ tick.offset_percent }}%;" aria-hidden="true"></span><# } ); #>
			<div data-wpbc-timeline-time-rows-availability-host>
				<# _.each( data.availability_slices, function( slice ) { #>
					<span class="wpbc_timeline_time_rows__availability {{ slice.css_class }}" style="inset-inline-start: {{ slice.left_percent }}%; inline-size: {{ slice.width_percent }}%; inset-block-start: {{ slice.top_percent }}%; block-size: {{ slice.height_percent }}%;" title="{{ slice.label }}" aria-hidden="true"></span>
				<# } ); #>
			</div>
			<# _.each( data.timed_fragments, function( fragment ) { if ( fragment.is_overflowed ) { return; } #>
				<article
					class="wpbc_timeline_time_rows__booking wpbc_timeline_time_rows__booking--timed is-{{ fragment.status }} <# if ( fragment.shows_earlier_indicator ) { #>is-clipped-start<# } #><# if ( fragment.shows_later_indicator ) { #> is-clipped-end<# } #>"
					data-wpbc-timeline-segment-id="{{ fragment.render_segment_id }}"
					data-wpbc-timeline-booking-id="{{ fragment.booking_id }}"
					data-wpbc-timeline-booking-resource-id="{{ fragment.resource_id }}"
					data-wpbc-booking-inspector-trigger
					data-wpbc-booking-inspector-trigger-id="{{ fragment.render_segment_id }}"
					data-wpbc-booking-id="{{ fragment.booking_id }}"
					data-wpbc-timeline-time-rows-read-only
					style="inset-inline-start: calc({{ fragment.left_percent }}% + var(--wpbc-time-rows-booking-column-gutter)); inline-size: max(1px, calc({{ fragment.width_percent }}% - var(--wpbc-time-rows-booking-column-gutter) - var(--wpbc-time-rows-booking-column-gutter))); inset-block-start: {{ fragment.top_percent }}%; block-size: {{ fragment.height_percent }}%;"
					role="group"
					aria-label="{{ fragment.aria_label }}"
				>
					<button type="button" class="wpbc_timeline_time_rows__booking_select" data-wpbc-timeline-booking-select aria-label="{{ fragment.selection_aria_label }}" aria-pressed="false">
						<# if ( fragment.shows_earlier_indicator ) { #><span class="wpbc_timeline_time_rows__continuation is-earlier" aria-hidden="true">&uarr;</span><# } #>
						<# if ( fragment.initials ) { #><span class="wpbc_timeline_time_rows__avatar" aria-hidden="true">{{ fragment.initials }}</span><# } #>
						<span class="wpbc_timeline_time_rows__booking_copy"><strong>{{ fragment.label }}</strong><span>{{ fragment.schedule_label }}</span></span>
						<span class="wpbc_timeline_time_rows__booking_status" title="{{ fragment.status_label }}" aria-hidden="true"><# if ( 'approved' === fragment.status ) { #>&#10003;<# } else if ( 'pending' === fragment.status ) { #>&hellip;<# } else { #>?<# } #></span>
						<# if ( fragment.shows_later_indicator ) { #><span class="wpbc_timeline_time_rows__continuation is-later" aria-hidden="true">&darr;</span><# } #>
					</button>
					<span class="wpbc_timeline_time_rows__booking_controls" data-wpbc-timeline-booking-control-rail data-wpbc-timeline-booking-control-rail-card-owned data-wpbc-timeline-booking-id="{{ fragment.booking_id }}">
						<button type="button" class="wpbc_timeline_time_rows__booking_info" data-wpbc-booking-overview-info-trigger data-wpbc-timeline-booking-id="{{ fragment.booking_id }}" data-wpbc-timeline-segment-hint="{{ fragment.render_segment_id }}" aria-label="{{ fragment.information_aria_label }}" aria-haspopup="dialog" aria-expanded="false"><span class="wpbc-bi-info-circle" aria-hidden="true"></span></button>
						<button type="button" class="wpbc_timeline_time_rows__booking_details" data-wpbc-timeline-booking-details-action data-wpbc-timeline-booking-id="{{ fragment.booking_id }}" data-wpbc-timeline-segment-hint="{{ fragment.render_segment_id }}" aria-label="{{ fragment.details_aria_label }}" aria-haspopup="dialog" hidden><span class="wpbc-bi-three-dots-vertical" aria-hidden="true"></span></button>
					</span>
					<span class="wpbc_timeline_time_rows__booking_selection_chrome" aria-hidden="true"></span>
				</article>
			<# } ); #>
			<# _.each( data.overflow_groups, function( overflow ) { #>
				<details class="wpbc_timeline_time_rows__overflow" style="inset-inline-start: {{ overflow.left_percent }}%; inline-size: {{ overflow.width_percent }}%; inset-block-start: {{ overflow.top_percent }}%;">
					<summary aria-label="{{ overflow.aria_label }}">{{ overflow.label }}</summary>
					<ul>
						<# _.each( overflow.records, function( fragment ) { #>
							<li data-wpbc-timeline-time-rows-read-only data-wpbc-timeline-segment-id="{{ fragment.render_segment_id }}" data-wpbc-timeline-booking-id="{{ fragment.booking_id }}" data-wpbc-timeline-booking-resource-id="{{ fragment.resource_id }}" data-wpbc-booking-inspector-trigger data-wpbc-booking-inspector-trigger-id="{{ fragment.render_segment_id }}" data-wpbc-booking-id="{{ fragment.booking_id }}">
								<button type="button" class="wpbc_timeline_time_rows__overflow_booking" data-wpbc-timeline-booking-select data-wpbc-timeline-booking-id="{{ fragment.booking_id }}" aria-label="{{ fragment.selection_aria_label }}" aria-pressed="false"><strong>{{ fragment.label }}</strong><span>{{ fragment.schedule_label }}</span><span class="screen-reader-text">{{ fragment.status_label }}</span></button>
								<button type="button" class="wpbc_timeline_time_rows__overflow_info" data-wpbc-booking-overview-info-trigger data-wpbc-timeline-booking-id="{{ fragment.booking_id }}" data-wpbc-timeline-segment-hint="{{ fragment.render_segment_id }}" aria-label="{{ fragment.information_aria_label }}" aria-haspopup="dialog" aria-expanded="false"><span class="wpbc-bi-info-circle" aria-hidden="true"></span></button>
								<button type="button" data-wpbc-timeline-booking-details-action data-wpbc-timeline-booking-id="{{ fragment.booking_id }}" data-wpbc-timeline-segment-hint="{{ fragment.render_segment_id }}" aria-label="{{ fragment.details_aria_label }}" aria-haspopup="dialog" hidden><span class="wpbc-bi-three-dots-vertical" aria-hidden="true"></span></button>
							</li>
						<# } ); #>
					</ul>
				</details>
			<# } ); #>
		</div>
		<div class="wpbc_timeline_time_rows__summary_host" data-wpbc-timeline-time-rows-summary-host></div>
	</section>
</script>
