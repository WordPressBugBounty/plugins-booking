<?php
/**
 * Local Timeline range-selection overlay template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-selection">
	<div
		class="wpbc_timeline__selection"
		data-wpbc-timeline-selection
		style="inset-inline-start: {{ data.offset_percent }}%; width: {{ data.width_percent }}%;"
		role="group"
		aria-label="{{ data.aria_label }}"
	>
		<span
			class="wpbc_timeline__selection_handle wpbc_timeline__selection_handle--start<# if ( 'start' === data.active_boundary ) { #> is-active<# } #>"
			data-wpbc-timeline-selection-handle="start"
			role="slider"
			tabindex="0"
			aria-label="{{ data.start_handle.label }}"
			aria-orientation="horizontal"
			aria-valuemin="{{ data.start_handle.min }}"
			aria-valuemax="{{ data.start_handle.max }}"
			aria-valuenow="{{ data.start_handle.now }}"
			aria-valuetext="{{ data.start_handle.value_text }}"
			aria-disabled="<# if ( data.state === 'applying' ) { #>true<# } else { #>false<# } #>"
		></span>
		<span class="wpbc_timeline__selection_duration">{{ data.duration_label }}</span>
		<span
			class="wpbc_timeline__selection_handle wpbc_timeline__selection_handle--end<# if ( 'end' === data.active_boundary ) { #> is-active<# } #>"
			data-wpbc-timeline-selection-handle="end"
			role="slider"
			tabindex="0"
			aria-label="{{ data.end_handle.label }}"
			aria-orientation="horizontal"
			aria-valuemin="{{ data.end_handle.min }}"
			aria-valuemax="{{ data.end_handle.max }}"
			aria-valuenow="{{ data.end_handle.now }}"
			aria-valuetext="{{ data.end_handle.value_text }}"
			aria-disabled="<# if ( data.state === 'applying' ) { #>true<# } else { #>false<# } #>"
		></span>
	</div>
</script>
