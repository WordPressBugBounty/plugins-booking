<?php
/**
 * Expanded time-row authorized resize-boundary template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-<?php echo esc_attr( WPBC_Timeline_Time_Rows_Movement_Config::TEMPLATE_RESIZE_HANDLES ); ?>">
	<span class="wpbc_timeline_time_rows_movement__resize_handles" role="group" aria-label="{{ data.group_label }}">
		<# if ( data.start ) { #>
		<button
			type="button"
			class="wpbc_timeline_time_rows_movement__resize_handle is-start is-ready"
			data-wpbc-timeline-time-rows-resize-handle="start"
			data-wpbc-timeline-time-rows-resize-operation="resize_start"
			aria-label="{{ data.start_label }}"
			aria-describedby="{{ data.status_id }}"
			aria-keyshortcuts="Enter Space"
			title="{{ data.keyboard_fallback }}"
		>
			<span class="wpbc_timeline_time_rows_movement__resize_idle_dot" aria-hidden="true"></span>
			<span class="wpbc_timeline_time_rows_movement__resize_ready_ring" aria-hidden="true"></span>
		</button>
		<# } #>
		<# if ( data.end ) { #>
		<button
			type="button"
			class="wpbc_timeline_time_rows_movement__resize_handle is-end is-ready"
			data-wpbc-timeline-time-rows-resize-handle="end"
			data-wpbc-timeline-time-rows-resize-operation="resize_end"
			aria-label="{{ data.end_label }}"
			aria-describedby="{{ data.status_id }}"
			aria-keyshortcuts="Enter Space"
			title="{{ data.keyboard_fallback }}"
		>
			<span class="wpbc_timeline_time_rows_movement__resize_idle_dot" aria-hidden="true"></span>
			<span class="wpbc_timeline_time_rows_movement__resize_ready_ring" aria-hidden="true"></span>
		</button>
		<# } #>
	</span>
</script>
