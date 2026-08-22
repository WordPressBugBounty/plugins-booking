<?php
/**
 * One server-declared Appointment Service inline field template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-appointment-service-inline-field">
	<label class="wpbc_appointment_services__inline_field wpbc_appointment_services__inline_field--{{ data.field.key }}" for="wpbc_service_inline_{{ data.service_id }}_{{ data.field.key }}">
		<span class="screen-reader-text">{{ data.field.label }}</span>
		<# if ( 'textarea' === data.field.type ) { #>
			<textarea id="wpbc_service_inline_{{ data.service_id }}_{{ data.field.key }}" class="wpbc_ui_catalog_inline_control wpbc_appointment_services__inline_textarea" rows="3"<# if ( data.field.maxlength ) { #> maxlength="{{ data.field.maxlength }}"<# } #> data-wpbc-appointment-services-inline-field="{{ data.field.key }}" data-service-id="{{ data.service_id }}" data-wpbc-ui-catalog-inline-original="{{ data.field.original_value }}">{{ data.field.value }}</textarea>
		<# } else { #>
			<input id="wpbc_service_inline_{{ data.service_id }}_{{ data.field.key }}" class="wpbc_ui_catalog_inline_control<# if ( 'number' === data.field.type ) { #> wpbc_appointment_services__inline_number<# } else { #> wpbc_appointment_services__inline_input<# } #>" type="<# if ( 'number' === data.field.type ) { #>number<# } else { #>text<# } #>" value="{{ data.field.value }}"<# if ( data.field.maxlength ) { #> maxlength="{{ data.field.maxlength }}"<# } #><# if ( null !== data.field.min && undefined !== data.field.min ) { #> min="{{ data.field.min }}"<# } #><# if ( null !== data.field.max && undefined !== data.field.max ) { #> max="{{ data.field.max }}"<# } #><# if ( null !== data.field.step && undefined !== data.field.step ) { #> step="{{ data.field.step }}"<# } #> data-wpbc-appointment-services-inline-field="{{ data.field.key }}" data-service-id="{{ data.service_id }}" data-wpbc-ui-catalog-inline-original="{{ data.field.original_value }}">
		<# } #>
	</label>
</script>
