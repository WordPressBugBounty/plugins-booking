<?php
/**
 * Expanded time-row authorized movement-grip template.
 *
 * The control is rendered only after fresh server eligibility and starts the
 * isolated Pointer Events or keyboard proposal state machine.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-<?php echo esc_attr( WPBC_Timeline_Time_Rows_Movement_Config::TEMPLATE_GRIP ); ?>">
	<button
		type="button"
		class="wpbc_timeline_time_rows_movement__grip"
		data-wpbc-timeline-time-rows-movement-grip
		aria-label="{{ data.label }}"
		aria-describedby="{{ data.status_id }}"
		aria-keyshortcuts="Enter Space ArrowLeft ArrowRight ArrowUp ArrowDown Escape"
		title="{{ data.keyboard_instructions }}"
	>
		<span class="wpbc_icn_drag_indicator" aria-hidden="true"></span>
	</button>
</script>
