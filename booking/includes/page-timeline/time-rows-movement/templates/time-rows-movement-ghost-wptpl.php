<?php
/**
 * Expanded time-row movement or resize proposal ghost template.
 *
 * The browser supplies presentation-only text and geometry after resolving an
 * immutable shared-geometry snapshot. The ghost never carries authority.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-<?php echo esc_attr( WPBC_Timeline_Time_Rows_Movement_Config::TEMPLATE_GHOST ); ?>">
	<div
		class="wpbc_timeline_time_rows_movement__ghost<# if ( data.start_label || data.duration_label || data.end_label ) { #> has-range-labels<# } #>"
		data-wpbc-timeline-time-rows-movement-ghost
		aria-hidden="true"
	>
		<# if ( data.start_label ) { #>
			<span class="wpbc_timeline_time_rows_movement__ghost_label wpbc_timeline_time_rows_movement__ghost_endpoint is-start" data-wpbc-timeline-time-rows-resize-start-label>{{ data.start_label }}</span>
		<# } #>
		<# if ( data.duration_label ) { #>
			<span class="wpbc_timeline_time_rows_movement__ghost_label wpbc_timeline_time_rows_movement__ghost_duration" data-wpbc-timeline-time-rows-resize-duration>{{ data.duration_label }}</span>
		<# } #>
		<# if ( data.end_label ) { #>
			<span class="wpbc_timeline_time_rows_movement__ghost_label wpbc_timeline_time_rows_movement__ghost_endpoint is-end" data-wpbc-timeline-time-rows-resize-end-label>{{ data.end_label }}</span>
		<# } #>
		<# if ( data.show_start ) { #>
			<span class="wpbc_timeline_time_rows_movement__ghost_boundary is-start"></span>
		<# } #>
		<# if ( data.show_end ) { #>
			<span class="wpbc_timeline_time_rows_movement__ghost_boundary is-end"></span>
		<# } #>
	</div>
</script>
