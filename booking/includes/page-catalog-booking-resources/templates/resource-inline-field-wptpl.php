<?php
/**
 * One server-declared Booking Resource inline field template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-inline-field">
	<label class="wpbc_booking_resources__inline_field wpbc_booking_resources__inline_field--{{ data.field.key }}" for="wpbc_catalog_inline_{{ data.resource_id }}_{{ data.field.key }}">
		<span class="screen-reader-text">{{ data.field.label }}</span>
		<span class="wpbc_booking_resources__inline_control_row">
			<# if ( data.field.prefix ) { #><span class="wpbc_booking_resources__inline_affix">{{ data.field.prefix }}</span><# } #>
			<# if ( 'textarea' === data.field.type ) { #>
				<textarea id="wpbc_catalog_inline_{{ data.resource_id }}_{{ data.field.key }}" class="wpbc_ui_catalog_inline_control wpbc_booking_resources__inline_control" rows="2"<# if ( data.field.maxlength ) { #> maxlength="{{ data.field.maxlength }}"<# } #> data-wpbc-catalog-inline-field="{{ data.field.key }}" data-wpbc-catalog-inline-resource="{{ data.resource_id }}" data-wpbc-catalog-inline-original="{{ data.field.value }}">{{ data.field.value }}</textarea>
			<# } else if ( 'select' === data.field.type ) { #>
				<select id="wpbc_catalog_inline_{{ data.resource_id }}_{{ data.field.key }}" class="wpbc_ui_catalog_inline_control wpbc_booking_resources__inline_control" data-wpbc-catalog-inline-field="{{ data.field.key }}" data-wpbc-catalog-inline-resource="{{ data.resource_id }}" data-wpbc-catalog-inline-original="{{ data.field.value }}"><# _.each( data.field.options || [], function ( option ) { #><option value="{{ option.value }}"<# if ( String( option.value ) === String( data.field.value ) ) { #> selected<# } #>>{{ option.label }}</option><# } ); #></select>
			<# } else { #>
				<input id="wpbc_catalog_inline_{{ data.resource_id }}_{{ data.field.key }}" class="wpbc_ui_catalog_inline_control wpbc_booking_resources__inline_control" type="<# if ( 'number' === data.field.type ) { #>number<# } else { #>text<# } #>" value="{{ data.field.value }}"<# if ( data.field.maxlength ) { #> maxlength="{{ data.field.maxlength }}"<# } #><# if ( null !== data.field.min && undefined !== data.field.min ) { #> min="{{ data.field.min }}"<# } #><# if ( null !== data.field.max && undefined !== data.field.max ) { #> max="{{ data.field.max }}"<# } #><# if ( null !== data.field.step && undefined !== data.field.step ) { #> step="{{ data.field.step }}"<# } #> data-wpbc-catalog-inline-field="{{ data.field.key }}" data-wpbc-catalog-inline-resource="{{ data.resource_id }}" data-wpbc-catalog-inline-original="{{ data.field.value }}">
			<# } #>
			<# if ( data.field.suffix ) { #><span class="wpbc_booking_resources__inline_affix">{{ data.field.suffix }}</span><# } #>
		</span>
	</label>
</script>
