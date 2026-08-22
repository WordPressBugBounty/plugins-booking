<?php
/**
 * Appointment Services cards sorting header WP template.
 *
 * Cards do not have table column headings, so this presentation-only header
 * keeps select-all-visible and the same allow-listed sorting choices available
 * in every layout.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-appointment-services-cards-header">
	<div class="wpbc_appointment_services__cards_header_controls">
		<label class="wpbc_appointment_services__cards_select_all">
			<input type="checkbox" data-wpbc-ui-catalog-select-all>
			<span>{{ data.select_all_label }}</span>
		</label>
		<nav class="wpbc_appointment_services__cards_sort" aria-label="{{ data.i18n.sort_services }}">
			<span>{{ data.i18n.sort_by }}</span>
			<# _.each( data.columns, function ( column ) { if ( ! column.sort_key ) { return; } #>
				<a href="#" class="wpbc_ui_listing__sort_link<# if ( column.is_sorted ) { #> is-active<# } #>" data-wpbc-ui-catalog-sort="{{ column.sort_key }}"<# if ( column.is_sorted ) { #> aria-current="true"<# } #>>
					<span>{{ column.label }}</span>
					<i class="wpbc_ui_listing__sort_icon {{ column.sort_icon }}" aria-hidden="true"></i>
				</a>
			<# } ); #>
		</nav>
	</div>
</script>
