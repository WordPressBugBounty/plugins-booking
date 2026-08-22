<?php
/**
 * Booking Resource bulk-edit field template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-inspector-bulk-field">
	<# var field_id = 'wpbc_catalog_booking_resources_bulk_' + data.field.key; #>
	<div class="wpbc_catalog_booking_resources__bulk_field" data-wpbc-catalog-resource-bulk-field="{{ data.field.key }}" data-wpbc-catalog-resource-bulk-prefix="{{ data.field.prefix }}" data-wpbc-catalog-resource-bulk-suffix="{{ data.field.suffix }}">
		<div class="wpbc_catalog_booking_resources__bulk_field_head">
			<label for="{{ field_id }}_enabled">
				<input type="checkbox" id="{{ field_id }}_enabled" data-wpbc-catalog-resource-bulk-enable="{{ data.field.key }}">
				<strong>{{ data.field.label }}</strong>
			</label>
			<span>{{ data.i18n.current }}: {{ data.field.current_display }}</span>
		</div>
		<div class="wpbc_catalog_booking_resources__bulk_field_controls">
			<label class="screen-reader-text" for="{{ field_id }}_operation">{{ data.field.label }} {{ data.i18n.operation }}</label>
			<select id="{{ field_id }}_operation" data-wpbc-catalog-resource-bulk-operation="{{ data.field.key }}" disabled>
				<# _.each( data.field.operations || [], function ( operation ) { #><option value="{{ operation.id }}">{{ operation.label }}</option><# } ); #>
			</select>
			<label class="screen-reader-text" for="{{ field_id }}_value">{{ data.field.label }} {{ data.i18n.new_value }}</label>
			<div class="wpbc_catalog_booking_resources__bulk_value">
				<# if ( data.field.prefix ) { #><span data-wpbc-catalog-resource-bulk-prefix>{{ data.field.prefix }}</span><# } #>
				<# if ( 'select' === data.field.type ) { #>
					<select id="{{ field_id }}_value" data-wpbc-catalog-resource-bulk-value="{{ data.field.key }}" disabled>
						<# _.each( data.field.options || [], function ( option ) { #><option value="{{ option.value }}">{{ option.label }}</option><# } ); #>
					</select>
				<# } else { #>
					<input type="number" id="{{ field_id }}_value" min="{{ data.field.min }}" <# if ( data.field.max ) { #>max="{{ data.field.max }}"<# } #> step="{{ data.field.step }}" value="0" data-wpbc-catalog-resource-bulk-value="{{ data.field.key }}" disabled>
				<# } #>
				<# if ( data.field.suffix ) { #><span data-wpbc-catalog-resource-bulk-suffix>{{ data.field.suffix }}</span><# } #>
			</div>
		</div>
		<# if ( 'number' === data.field.type ) { #><input type="range" min="{{ data.field.slider_min }}" max="{{ data.field.slider_max }}" step="{{ data.field.slider_step }}" value="0" aria-label="{{ data.field.label }}" data-wpbc-catalog-resource-bulk-range="{{ data.field.key }}" disabled><# } #>
		<# if ( data.field.help ) { #><p class="description">{{ data.field.help }}</p><# } #>
	</div>
</script>
