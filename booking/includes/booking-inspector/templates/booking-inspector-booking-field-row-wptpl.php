<?php
/**
 * Booking Inspector single booking-field row template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-inspector-booking-field-row">
	<#
	var field = data.field;
	var schedule_locked = false === field.editable;
	var editable = data.can_edit_fields && ! schedule_locked && 'file' !== field.type;
	var field_options = field.options || [];
	var has_empty_option = _.some( field_options, function ( option ) { return '' === option.value; } );
	#>
	<div class="wpbc_booking_inspector__form_field">
		<label id="{{ data.field_id }}_label" class="wpbc_booking_inspector__field_label" for="{{ data.field_id }}"><span>{{ field.label }}<# if ( field.required ) { #><span aria-hidden="true"> *</span><# } #></span><# if ( data.recently_changed ) { #><span class="wpbc_booking_inspector__field_changed">{{ data.i18n.changed }}</span><# } #></label>
		<# if ( 'textarea' === field.type ) { #>
		<textarea id="{{ data.field_id }}" rows="4" data-wpbc-booking-field="{{ field.key }}" <# if ( schedule_locked ) { #>disabled aria-describedby="{{ data.field_id }}_help"<# } else if ( ! editable ) { #>readonly<# } #>><# print( _.escape( field.value || '' ) ); #></textarea>
		<# } else if ( 'text' === field.type && field.multiple ) { #>
		<div class="wpbc_booking_inspector__legacy_text_values"><# _.each( field.values && field.values.length ? field.values : [ '' ], function ( field_value, value_index ) { #><input id="{{ data.field_id }}<# if ( value_index ) { #>_{{ value_index }}<# } #>" type="text" value="{{ field_value }}" aria-labelledby="{{ data.field_id }}_label" data-wpbc-booking-field="{{ field.key }}" <# if ( schedule_locked ) { #>disabled aria-describedby="{{ data.field_id }}_help"<# } else if ( ! editable ) { #>readonly<# } #>><# } ); #></div>
		<# } else if ( 'select' === field.type ) { #>
		<select id="{{ data.field_id }}" data-wpbc-booking-field="{{ field.key }}" <# if ( field.multiple ) { #>multiple<# } #> <# if ( ! editable ) { #>disabled<# } #> <# if ( schedule_locked ) { #>aria-describedby="{{ data.field_id }}_help"<# } #>><# if ( ! field.multiple && ! ( field.values || [] ).length && ! has_empty_option ) { #><option value="" selected>{{ data.i18n.select_value }}</option><# } #><# _.each( field_options, function ( option ) { #><option value="{{ option.value }}" <# if ( -1 !== ( field.values || [] ).indexOf( option.value ) || ( '' === option.value && ! ( field.values || [] ).length ) ) { #>selected<# } #>>{{ option.label }}</option><# } ); #></select>
		<# } else if ( 'radio' === field.type || 'checkbox' === field.type || 'acceptance' === field.type ) { #>
		<fieldset id="{{ data.field_id }}" class="wpbc_booking_inspector__choices" <# if ( schedule_locked ) { #>aria-describedby="{{ data.field_id }}_help"<# } #>><legend class="screen-reader-text">{{ field.label }}</legend><# _.each( field.options && field.options.length ? field.options : [ { value: field.value || '1', label: field.value || field.label } ], function ( option ) { #><label><input type="{{ 'radio' === field.type ? 'radio' : 'checkbox' }}" name="{{ data.field_id }}{{ 'radio' === field.type ? '' : '[]' }}" value="{{ option.value }}" data-wpbc-booking-field="{{ field.key }}" <# if ( -1 !== ( field.values || [] ).indexOf( option.value ) ) { #>checked<# } #> <# if ( ! editable ) { #>disabled<# } #>><span>{{ option.label }}</span></label><# } ); #></fieldset>
		<# } else { #>
		<input id="{{ data.field_id }}" type="{{ 'email' === field.type ? 'email' : 'text' }}" value="{{ field.value }}" data-wpbc-booking-field="{{ field.key }}" <# if ( schedule_locked ) { #>disabled aria-describedby="{{ data.field_id }}_help"<# } else if ( ! editable ) { #>readonly<# } #>>
		<# } #>
		<# if ( schedule_locked && field.editing_help ) { #><span id="{{ data.field_id }}_help" class="wpbc_booking_inspector__field_help">{{ field.editing_help }}</span><# } #>
	</div>
</script>
