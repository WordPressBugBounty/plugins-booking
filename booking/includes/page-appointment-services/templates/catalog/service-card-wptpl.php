<?php
/**
 * Complete Appointment Service card WP template.
 *
 * Changes presentation only; it consumes the same ordered fields and escaped
 * cell fragments as the semantic table row.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
?>
<script type="text/html" id="tmpl-wpbc-appointment-service-card">
	<article class="wpbc_ui_catalog_inline_row wpbc_appointment_services__card wpbc_appointment_services__item<# if ( data.is_inspector_selected ) { #> is-inspector-selected<# } #>" role="listitem" data-service-id="{{ data.service_id }}" data-wpbc-ui-catalog-selectable-row data-wpbc-ui-catalog-selection-checkbox-only data-wpbc-right-sidebar-keep-open="1" tabindex="0" aria-current="{{ data.is_inspector_selected ? 'true' : 'false' }}">
		<div class="wpbc_appointment_services__card_media<# if ( ! data.picture_url ) { #> has-placeholder<# } #>">
			<# if ( data.picture_url ) { #><img src="{{ data.picture_url }}" alt="" loading="lazy" decoding="async"><# } #>
			<label class="wpbc_appointment_services__card_select"><input type="checkbox" value="{{ data.service_id }}" data-wpbc-ui-catalog-select-item aria-label="{{ data.select_label }}"></label>
			<# if ( ! data.picture_url ) { #><span class="wpbc-bi-briefcase" aria-hidden="true"></span><# } #>
		</div>
		<div class="wpbc_appointment_services__card_identity"><# print( data.cells.service || '' ); #></div>
		<div class="wpbc_appointment_services__card_fields"><# _.each( data.columns, function ( column ) { if ( 'service' === column.id || 'actions' === column.id ) { return; } #><div class="wpbc_appointment_services__card_field"><span>{{ column.label }}</span><div><# print( data.cells[ column.id ] || '' ); #></div></div><# } ); #></div>
		<div class="wpbc_appointment_services__card_actions"><# print( data.cells.actions || '' ); #></div>
	</article>
</script>
