<?php
/**
 * Timeline day-cell time-slot overflow WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-time-slot-overflow">
	<div
		class="wpbc_timeline__time_slot_overflow"
		data-wpbc-timeline-time-slot-overflow="{{ data.overflow_id }}"
		data-wpbc-timeline-time-slot-group="{{ data.group_key }}"
		style="inset-inline-start: {{ data.presentation_offset_percent }}%; width: {{ data.presentation_width_percent }}%; top: calc(var(--wpbc_timeline_general__booking-lane-offset) + ({{ data.lane_index || 0 }} * var(--wpbc_timeline_general__lane-height)));"
	>
		<button
			type="button"
			class="button button-small wpbc_timeline__time_slot_more"
			data-wpbc-timeline-time-slot-more
			aria-controls="{{ data.overflow_id }}-popover"
			aria-expanded="false"
			aria-label="{{ data.aria_label }}"
		>
			{{ data.more_label }}
		</button>
		<div
			class="wpbc_timeline__time_slot_popover"
			id="{{ data.overflow_id }}-popover"
			data-wpbc-timeline-time-slot-popover
			role="dialog"
			aria-labelledby="{{ data.overflow_id }}-heading"
			hidden
		>
			<header>
				<strong id="{{ data.overflow_id }}-heading">{{ data.heading }}</strong>
				<button type="button" class="button-link" data-wpbc-timeline-time-slot-close aria-label="{{ data.i18n.close_time_slot_bookings }}">
					<span class="wpbc-bi-x-lg" aria-hidden="true"></span>
				</button>
			</header>
			<ul class="wpbc_timeline__time_slot_list">
				<# _.each( data.items, function( item ) { #>
					<li>
						<button
							type="button"
							class="wpbc_timeline__time_slot_item"
							data-wpbc-timeline-time-slot-item
							data-wpbc-booking-id="{{ item.booking_id }}"
							data-wpbc-booking-inspector-trigger
							data-wpbc-booking-inspector-trigger-id="{{ item.segment_id }}"
							aria-label="{{ item.aria_label }}"
						>
							<strong>{{ item.label }}</strong>
							<span>{{ item.time_label }} <span aria-hidden="true">&middot;</span> {{ item.duration_label }}</span>
						</button>
					</li>
				<# } ); #>
			</ul>
		</div>
	</div>
</script>
