<?php
/**
 * Timeline booking-resizing authorized-handle template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-<?php echo esc_attr( WPBC_Timeline_Booking_Resizing_Config::TEMPLATE_HANDLES ); ?>">
	<span class="wpbc_timeline_booking_resize__handles" role="group" aria-label="{{ data.group_label }}">
		<# if ( data.start && data.start.eligible ) { #>
		<button
			type="button"
			class="wpbc_timeline_booking_resize__handle wpbc_timeline_booking_resize__handle--start is-ready"
			data-wpbc-timeline-booking-resize-handle="start"
			data-wpbc-timeline-booking-resize-operation="{{ data.start.operation }}"
			aria-label="{{ data.start.label }}"
			aria-haspopup="dialog"
		>
			<span class="wpbc_timeline_booking_resize__idle_dot" aria-hidden="true"></span>
			<span class="wpbc_timeline_booking_resize__ready_ring" aria-hidden="true"></span>
		</button>
		<# } #>
		<# if ( data.end && data.end.eligible ) { #>
		<button
			type="button"
			class="wpbc_timeline_booking_resize__handle wpbc_timeline_booking_resize__handle--end is-ready"
			data-wpbc-timeline-booking-resize-handle="end"
			data-wpbc-timeline-booking-resize-operation="{{ data.end.operation }}"
			aria-label="{{ data.end.label }}"
			aria-haspopup="dialog"
		>
			<span class="wpbc_timeline_booking_resize__idle_dot" aria-hidden="true"></span>
			<span class="wpbc_timeline_booking_resize__ready_ring" aria-hidden="true"></span>
		</button>
		<# } #>
	</span>
</script>
