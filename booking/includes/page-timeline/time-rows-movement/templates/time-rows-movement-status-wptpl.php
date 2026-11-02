<?php
/**
 * Expanded time-row movement eligibility status template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-<?php echo esc_attr( WPBC_Timeline_Time_Rows_Movement_Config::TEMPLATE_STATUS ); ?>">
	<# if ( data.is_loading && ( data.show_start || data.show_end ) ) { #>
	<span
		class="wpbc_timeline_time_rows_movement__eligibility_loading"
		data-wpbc-timeline-time-rows-movement-eligibility-loading
		aria-hidden="true"
	>
		<# if ( data.show_start ) { #>
		<span class="wpbc_timeline_time_rows_movement__eligibility_marker is-start"></span>
		<# } #>
		<# if ( data.show_end ) { #>
		<span class="wpbc_timeline_time_rows_movement__eligibility_marker is-end"></span>
		<# } #>
	</span>
	<# } #>
	<# if ( data.message ) { #>
	<span
		id="{{ data.status_id }}"
		class="screen-reader-text wpbc_timeline_time_rows_movement__status"
		data-wpbc-timeline-time-rows-movement-status
		role="status"
		aria-live="polite"
	>{{ data.message }}</span>
	<# } #>
</script>
