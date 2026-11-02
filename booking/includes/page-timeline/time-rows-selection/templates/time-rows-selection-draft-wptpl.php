<?php
/**
 * Timeline time-row selection draft overlay template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-time-rows-selection-draft">
	<div
		class="wpbc_timeline_time_rows_selection__overlay is-{{ data.status }} is-phase-{{ data.phase }}"
		data-wpbc-timeline-time-rows-selection-overlay
		data-wpbc-timeline-time-rows-selection-draft-id="{{ data.draft_identity }}"
		data-wpbc-timeline-time-rows-selection-phase="{{ data.phase }}"
		data-wpbc-timeline-resource-id="{{ data.resource_id }}"
		role="group"
		aria-label="{{ data.label }}"
		aria-describedby="{{ data.status_id }}"
	>
		<# _.each( data.slices, function( slice ) { #>
			<span
				class="wpbc_timeline_time_rows_selection__slice"
				style="inset-inline-start: {{ slice.inline_start_px }}px; inline-size: {{ slice.inline_size_px }}px; inset-block-start: {{ slice.block_start_px }}px; block-size: {{ slice.block_size_px }}px;"
				aria-hidden="true"
			>
				<# if ( slice.duration_label ) { #>
					<span class="wpbc_timeline_time_rows_selection__label wpbc_timeline_time_rows_selection__duration" data-wpbc-timeline-time-rows-selection-duration>{{ slice.duration_label }}</span>
				<# } #>
			</span>
		<# } ); #>
		<# if ( data.start_endpoint_label ) { #>
			<span
				class="wpbc_timeline_time_rows_selection__label wpbc_timeline_time_rows_selection__endpoint is-start"
				data-wpbc-timeline-time-rows-selection-start-label
				style="inset-inline-start: {{ data.start_control.inline_px }}px; inset-block-start: {{ data.start_control.block_px }}px;"
				aria-hidden="true"
			>{{ data.start_endpoint_label }}</span>
		<# } #>
		<# if ( data.end_endpoint_label ) { #>
			<span
				class="wpbc_timeline_time_rows_selection__label wpbc_timeline_time_rows_selection__endpoint is-end"
				data-wpbc-timeline-time-rows-selection-end-label
				style="inset-inline-start: {{ data.end_control.inline_px }}px; inset-block-start: {{ data.end_control.block_px }}px;"
				aria-hidden="true"
			>{{ data.end_endpoint_label }}</span>
		<# } #>
		<span
			class="wpbc_timeline_time_rows_selection__boundary is-start<# if ( data.active_boundary === 'start' ) { #> is-pointer-active<# } #>"
			data-wpbc-timeline-time-rows-selection-boundary="start"
			role="slider"
			tabindex="0"
			aria-label="{{ data.start_control.label }}"
			aria-valuemin="{{ data.start_control.value_min }}"
			aria-valuemax="{{ data.start_control.value_max }}"
			aria-valuenow="{{ data.start_control.value_now }}"
			aria-valuetext="{{ data.start_control.value_text }}"
			style="inset-inline-start: {{ data.start_control.inline_px }}px; inset-block-start: {{ data.start_control.block_px }}px;"
		></span>
		<span
			class="wpbc_timeline_time_rows_selection__boundary is-end<# if ( data.active_boundary === 'end' ) { #> is-pointer-active<# } #>"
			data-wpbc-timeline-time-rows-selection-boundary="end"
			role="slider"
			tabindex="0"
			aria-label="{{ data.end_control.label }}"
			aria-valuemin="{{ data.end_control.value_min }}"
			aria-valuemax="{{ data.end_control.value_max }}"
			aria-valuenow="{{ data.end_control.value_now }}"
			aria-valuetext="{{ data.end_control.value_text }}"
			style="inset-inline-start: {{ data.end_control.inline_px }}px; inset-block-start: {{ data.end_control.block_px }}px;"
		></span>
		<# if ( data.fold_choices && data.fold_choices.length ) { #>
			<div
				class="wpbc_timeline_time_rows_selection__fold_choices"
				role="group"
				aria-label="{{ data.fold_group_label }}"
			>
				<p>{{ data.fold_instructions }}</p>
				<div class="wpbc_timeline_time_rows_selection__fold_choice_buttons">
				<# _.each( data.fold_choices, function( choice ) { #>
					<button
						type="button"
						class="button button-secondary"
						data-wpbc-timeline-time-rows-selection-fold-choice="{{ choice.occurrence_id }}"
						data-wpbc-timeline-time-rows-selection-fold-endpoint="{{ choice.endpoint }}"
					>{{ choice.label }}</button>
				<# } ); #>
				</div>
			</div>
		<# } #>
	</div>
</script>
