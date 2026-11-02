<?php
/**
 * Shared split action and single-date picker WordPress template.
 *
 * The executable-free model accepts scalar labels, a strict ISO date, and
 * presentation settings only. Domain navigation remains in the caller.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-shared-ui-date-jump">
	<#
	var component_id = String( data.id || '' ).replace( /[^A-Za-z0-9_-]/g, '' );
	var input_id = component_id + '__date';
	#>
	<div
		id="{{ component_id }}"
		class="wpbc_shared_ui_date_jump"
		data-wpbc-shared-ui-date-jump="{{ component_id }}"
		data-selected-date="{{ data.selected_date }}"
		data-first-day="{{ data.first_day }}"
	>
		<button type="button" class="wpbc_shared_ui_date_jump__action" data-wpbc-shared-ui-date-jump-action>
			<span>{{ data.action_label }}</span>
		</button>
		<button
			type="button"
			class="wpbc_shared_ui_date_jump__toggle"
			data-wpbc-shared-ui-date-jump-toggle
			aria-label="{{ data.choose_date_label }}"
			aria-haspopup="dialog"
			aria-expanded="false"
			aria-controls="datepick-div"
		>
			<span class="wpbc-bi-chevron-down" aria-hidden="true"></span>
		</button>
		<input
			id="{{ input_id }}"
			type="text"
			class="wpbc_shared_ui_date_jump__input"
			inputmode="numeric"
			autocomplete="off"
			tabindex="-1"
			value="{{ data.selected_date }}"
			aria-label="{{ data.date_label }}"
			data-wpbc-shared-ui-date-jump-input
		>
	</div>
</script>
