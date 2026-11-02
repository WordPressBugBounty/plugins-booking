<?php
/**
 * Timeline time-row selection polite status template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-time-rows-selection-status">
	<span
		id="{{ data.status_id }}"
		class="screen-reader-text wpbc_timeline_time_rows_selection__status"
		data-wpbc-timeline-time-rows-selection-status
		role="status"
		aria-live="polite"
		aria-atomic="true"
	>{{ data.message }}</span>
</script>
