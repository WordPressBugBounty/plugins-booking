<?php
/**
 * Read-only Timeline booking-card WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-booking-segment">
	<article
		class="wpbc_timeline__booking_segment is-{{ data.status }} <# if ( data.is_compact ) { #>is-compact<# } #> <# if ( data.is_day_time_slot ) { #>is-day-time-slot<# } #> <# if ( data.initials ) { #>has-booking-avatar<# } #> <# if ( data.is_clipped_start ) { #>is-clipped-start<# } #> <# if ( data.is_clipped_end ) { #>is-clipped-end<# } #>"
		data-wpbc-timeline-segment-id="{{ data.segment_id }}"
		data-wpbc-timeline-booking-id="{{ data.booking_id }}"
		data-wpbc-timeline-booking-resource-id="{{ data.resource_id }}"
		data-wpbc-timeline-lane-index="{{ data.lane_index || 0 }}"
		data-wpbc-booking-inspector-trigger
		data-wpbc-booking-inspector-trigger-id="{{ data.segment_id }}"
		data-wpbc-booking-id="{{ data.booking_id }}"
		<# if ( data.time_slot_group_key ) { #>data-wpbc-timeline-time-slot-group="{{ data.time_slot_group_key }}"<# } #>
		style="inset-inline-start: {{ data.presentation_offset_percent }}%; width: {{ data.presentation_width_percent }}%; top: calc(var(--wpbc_timeline_general__booking-lane-offset) + ({{ data.lane_index || 0 }} * var(--wpbc_timeline_general__lane-height)));"
		aria-label="{{ data.aria_label }}"
		role="group"
	>
		<button
			type="button"
			class="wpbc_timeline__booking_selection"
			data-wpbc-timeline-booking-select
			aria-label="{{ data.selection_aria_label }}"
			aria-pressed="false"
		>
			<# if ( data.is_clipped_start ) { #>
			<span class="wpbc_timeline__continuation wpbc_timeline__continuation--start" role="img" aria-label="{{ data.continues_before_label }}">
				<span class="wpbc_icn_keyboard_double_arrow_left" aria-hidden="true"></span>
			</span>
			<# } #>

			<span class="wpbc_timeline__booking_copy">
				<# if ( data.initials ) { #><span class="wpbc_timeline__booking_avatar" aria-hidden="true">{{ data.initials }}</span><# } #>
				<span class="wpbc_timeline__booking_details">
					<span class="wpbc_timeline__booking_title">
						<strong data-wpbc-ui-catalog-overflow-tooltip="{{ data.label }}" data-wpbc-ui-catalog-overflow-tooltip-delay-ms="610" data-wpbc-ui-catalog-overflow-tooltip-focus="pointer-only">{{ data.label }}</strong>
					</span>
					<# if ( data.is_day_time_slot ) { #>
						<span class="wpbc_timeline__booking_secondary wpbc_timeline__booking_time_slot" data-wpbc-ui-catalog-overflow-tooltip="{{ data.schedule_label }}" data-wpbc-ui-catalog-overflow-tooltip-delay-ms="610" data-wpbc-ui-catalog-overflow-tooltip-focus="pointer-only"><span class="wpbc-bi-clock" aria-hidden="true"></span>{{ data.time_slot_time_label }}</span>
					<# } else { #>
						<span class="wpbc_timeline__booking_secondary" data-wpbc-ui-catalog-overflow-tooltip="{{ data.schedule_label }}" data-wpbc-ui-catalog-overflow-tooltip-delay-ms="610" data-wpbc-ui-catalog-overflow-tooltip-focus="pointer-only">{{ data.schedule_label }}</span>
					<# } #>
					<span class="wpbc_timeline__booking_status" aria-hidden="true"></span>
				</span>
			</span>
			<# if ( data.is_clipped_end ) { #>
			<span class="wpbc_timeline__continuation wpbc_timeline__continuation--end" role="img" aria-label="{{ data.continues_after_label }}">
				<span class="wpbc_icn_keyboard_double_arrow_right" aria-hidden="true"></span>
			</span>
			<# } #>
		</button>

		<span class="wpbc_timeline__booking_accessory_dock" data-wpbc-timeline-booking-accessory data-wpbc-timeline-sortable-exclude>
			<span
				class="wpbc_timeline__booking_control_rail <# if ( data.is_compact ) { #>is-compact<# } #>"
				data-wpbc-timeline-booking-control-rail
				data-wpbc-timeline-booking-accessory
				data-wpbc-timeline-sortable-exclude
				data-wpbc-timeline-accessory-segment-id="{{ data.segment_id }}"
				data-wpbc-timeline-booking-id="{{ data.booking_id }}"
				style="--wpbc-timeline-booking-segment-inline-start: {{ data.presentation_offset_percent }}%; --wpbc-timeline-booking-segment-inline-size: {{ data.presentation_width_percent }}%;"
				role="group"
				aria-label="{{ data.accessory_aria_label }}"
			>
				<span
					class="wpbc_timeline__booking_accessory wpbc_timeline__booking_drag_indicator"
					aria-hidden="true"
				>
					<span class="wpbc_icn_drag_indicator"></span>
				</span>
				<span class="wpbc_timeline__booking_end_controls">
					<button
						type="button"
						class="wpbc_timeline__booking_accessory wpbc_timeline__booking_info"
						data-wpbc-booking-overview-info-trigger
						data-wpbc-timeline-booking-id="{{ data.booking_id }}"
						data-wpbc-timeline-segment-hint="{{ data.segment_id }}"
						aria-label="{{ data.information_aria_label }}"
						aria-haspopup="dialog"
						aria-expanded="false"
					>
						<span class="wpbc-bi-info-circle" aria-hidden="true"></span>
					</button>
					<button
						type="button"
						class="wpbc_timeline__booking_accessory wpbc_timeline__booking_details_action"
						data-wpbc-timeline-booking-details-action
						data-wpbc-timeline-booking-id="{{ data.booking_id }}"
						data-wpbc-timeline-segment-hint="{{ data.segment_id }}"
						aria-label="{{ data.details_aria_label }}"
						aria-haspopup="dialog"
						hidden
					>
						<span class="wpbc-bi-three-dots-vertical" aria-hidden="true"></span>
					</button>
				</span>
			</span>
		</span>

		<span class="wpbc_timeline__booking_selection_chrome" aria-hidden="true">
			<span class="wpbc_timeline__booking_selection_dot wpbc_timeline__booking_selection_dot--start"></span>
			<span class="wpbc_timeline__booking_selection_badge">{{ data.i18n.selected_booking }}</span>
			<span class="wpbc_timeline__booking_selection_dot wpbc_timeline__booking_selection_dot--end"></span>
		</span>

		<span
			class="wpbc_timeline_booking_resize__host"
			data-wpbc-timeline-booking-resize-host
			data-wpbc-timeline-booking-accessory
			data-wpbc-timeline-sortable-exclude
		>
			<span data-wpbc-timeline-booking-resize-visual-host></span>
			<span data-wpbc-timeline-booking-resize-live-host></span>
		</span>
	</article>
</script>

