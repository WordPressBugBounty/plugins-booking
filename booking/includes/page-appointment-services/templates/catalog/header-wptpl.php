<?php
/**
 * Appointment Services table-header WP template.
 *
 * Renders only server-allow-listed columns and sort controls supplied by the
 * Service catalog adapter.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
?>
<script type="text/html" id="tmpl-wpbc-appointment-services-header">
	<tr>
		<th scope="col" class="wpbc_ui_listing__selection_column column-selection"><input type="checkbox" data-wpbc-ui-catalog-select-all aria-label="{{ data.select_all_label }}"></th>
		<# _.each( data.columns, function ( column ) { #>
			<th
				scope="col"
				class="wpbc_ui_listing__column {{ column.class_name }}"
				data-wpbc-ui-catalog-column="{{ column.id }}"
				<# if ( 'status' === column.id ) { #>
					aria-sort="<# if ( 'status' === data.sort_by || 'service_id' === data.sort_by ) { #>{{ 'desc' === data.sort_order ? 'descending' : 'ascending' }}<# } else { #>none<# } #>"
				<# } else if ( column.sort_key ) { #>
					aria-sort="{{ column.aria_sort }}"
				<# } #>
			>
				<# if ( 'status' === column.id ) { #>
					<div class="wpbc_appointment_services__status_header">
						<a href="#" class="wpbc_ui_listing__sort_link<# if ( 'status' === data.sort_by ) { #> is-active<# } #>" data-wpbc-ui-catalog-sort="status">
							<span>{{ column.label }}</span>
							<i class="wpbc_ui_listing__sort_icon <# if ( 'status' === data.sort_by ) { #>wpbc-bi-arrow-{{ 'asc' === data.sort_order ? 'up' : 'down' }}<# } else { #>wpbc_icn_import_export<# } #>" aria-hidden="true"></i>
						</a>
						<a href="#" class="wpbc_ui_listing__sort_link<# if ( 'service_id' === data.sort_by ) { #> is-active<# } #>" data-wpbc-ui-catalog-sort="service_id">
							<span>{{ data.id_label }}</span>
							<i class="wpbc_ui_listing__sort_icon <# if ( 'service_id' === data.sort_by ) { #>wpbc-bi-arrow-{{ 'asc' === data.sort_order ? 'up' : 'down' }}<# } else { #>wpbc_icn_import_export<# } #>" aria-hidden="true"></i>
						</a>
					</div>
				<# } else if ( column.sort_key ) { #>
					<a href="#" class="wpbc_ui_listing__sort_link<# if ( column.is_sorted ) { #> is-active<# } #>" data-wpbc-ui-catalog-sort="{{ column.sort_key }}">
						<span>{{ column.label }}</span>
						<i class="wpbc_ui_listing__sort_icon {{ column.sort_icon }}" aria-hidden="true"></i>
					</a>
				<# } else { #>{{ column.label }}<# } #>
			</th>
		<# } ); #>
	</tr>
</script>
