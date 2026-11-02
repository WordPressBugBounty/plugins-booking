<?php
/**
 * Shared date-range/previous/next navigation WordPress template.
 *
 * The executable-free model accepts scalar labels, ISO dates, and presentation
 * limits only. It never accepts arbitrary HTML or domain behavior.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-shared-ui-date-range-navigation">
	<#
	var component_id = String( data.id || '' ).replace( /[^A-Za-z0-9_-]/g, '' );
	var panel_id = component_id + '__panel';
	var heading_id = component_id + '__heading';
	var status_id = component_id + '__status';
	var start_id = component_id + '__start';
	var end_id = component_id + '__end';
	#>
	<div
		id="{{ component_id }}"
		class="wpbc_shared_ui_date_range_navigation"
		data-wpbc-shared-ui-date-range-navigation="{{ component_id }}"
		data-start-date="{{ data.start_date }}"
		data-end-date="{{ data.end_date }}"
		data-first-day="{{ data.first_day }}"
		data-maximum-span-days="{{ data.maximum_span_days }}"
	>
		<div class="wpbc_shared_ui_popover wpbc_shared_ui_date_range_navigation__popover" data-wpbc-shared-ui-popover="{{ component_id }}">
			<button type="button" class="wpbc_shared_ui_popover__trigger wpbc_shared_ui_date_range_navigation__trigger" data-wpbc-shared-ui-popover-trigger aria-haspopup="dialog" aria-expanded="false" aria-controls="{{ panel_id }}">
				<span class="wpbc-bi-calendar3" aria-hidden="true"></span>
				<span data-wpbc-shared-ui-date-range-label>{{ data.range_label }}</span>
			</button>
			<div id="{{ panel_id }}" class="wpbc_shared_ui_popover__panel wpbc_shared_ui_date_range_navigation__panel" data-wpbc-shared-ui-popover-panel role="dialog" aria-modal="false" aria-labelledby="{{ heading_id }}" hidden>
				<h2 id="{{ heading_id }}" class="wpbc_shared_ui_popover__heading">{{ data.dialog_label }}</h2>
				<div class="wpbc_shared_ui_date_range_navigation__fields">
					<div class="wpbc_shared_ui_date_range_navigation__field">
						<label for="{{ start_id }}">{{ data.start_label }}</label>
						<input id="{{ start_id }}" type="text" inputmode="numeric" autocomplete="off" value="{{ data.start_date }}" placeholder="YYYY-MM-DD" data-wpbc-shared-ui-date-range-start aria-describedby="{{ status_id }}">
					</div>
					<span class="wpbc_shared_ui_date_range_navigation__separator" aria-hidden="true">&ndash;</span>
					<div class="wpbc_shared_ui_date_range_navigation__field">
						<label for="{{ end_id }}">{{ data.end_label }}</label>
						<input id="{{ end_id }}" type="text" inputmode="numeric" autocomplete="off" value="{{ data.end_date }}" placeholder="YYYY-MM-DD" data-wpbc-shared-ui-date-range-end aria-describedby="{{ status_id }}">
					</div>
				</div>
				<p id="{{ status_id }}" class="wpbc_shared_ui_date_range_navigation__status" data-wpbc-shared-ui-date-range-status aria-live="polite"></p>
				<div class="wpbc_shared_ui_date_range_navigation__actions">
					<button type="button" class="button-link wpbc_shared_ui_date_range_navigation__reset" data-wpbc-shared-ui-date-range-reset>
						<span>{{ data.reset_label }}</span>
					</button>
					<button type="button" class="button" data-wpbc-shared-ui-popover-close>{{ data.cancel_label }}</button>
					<button type="button" class="button button-primary" data-wpbc-shared-ui-date-range-apply>
						<span>{{ data.apply_label }}</span>
					</button>
				</div>
				<span data-wpbc-shared-ui-date-range-invalid-message hidden>{{ data.invalid_message }}</span>
				<span data-wpbc-shared-ui-date-range-maximum-message hidden>{{ data.maximum_message }}</span>
			</div>
		</div>
		<button type="button" class="wpbc_shared_ui_date_range_navigation__shift" data-wpbc-shared-ui-date-range-shift="previous" aria-label="{{ data.previous_label }}">
			<span class="wpbc-bi-chevron-left" aria-hidden="true"></span>
		</button>
		<button type="button" class="wpbc_shared_ui_date_range_navigation__shift" data-wpbc-shared-ui-date-range-shift="next" aria-label="{{ data.next_label }}">
			<span class="wpbc-bi-chevron-right" aria-hidden="true"></span>
		</button>
	</div>
</script>
