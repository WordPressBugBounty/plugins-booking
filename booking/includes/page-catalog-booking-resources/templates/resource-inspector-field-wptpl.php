<?php
/**
 * Resource inspector field template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-inspector-field">
	<#
		var control_id = 'wpbc_catalog_booking_resource_' + data.mode + '_' + data.field.key;
		var is_readonly = ! data.field.editable || 'readonly' === data.field.type;
	#>
	<# if ( 'hidden' === data.field.type ) { #>
		<input type="hidden" value="{{ data.field.value }}" data-wpbc-catalog-resource-field="{{ data.field.key }}">
	<# } else if ( 'summary' === data.field.layout ) { #>
		<div class="wpbc_catalog_booking_resources__editor_summary_item" data-wpbc-catalog-resource-field-wrap="{{ data.field.key }}">
			<# if ( data.field.editable && 'select' === data.field.type ) { #>
				<label class="wpbc_catalog_booking_resources__editor_summary_label" for="{{ control_id }}">{{ data.field.label }}</label>
				<div class="wpbc_catalog_booking_resources__editor_summary_value">
					<select id="{{ control_id }}" class="inspector__input" data-wpbc-catalog-resource-field="{{ data.field.key }}">
						<# _.each( data.field.options || [], function ( option ) { #><option value="{{ option.value }}" <# if ( String( option.value ) === String( data.field.value ) ) { #>selected<# } #>>{{ option.label }}</option><# } ); #>
					</select>
				</div>
			<# } else { #>
				<span class="wpbc_catalog_booking_resources__editor_summary_label">{{ data.field.label }}</span>
				<div class="wpbc_catalog_booking_resources__editor_summary_value"><span class="wpbc_catalog_booking_resources__editor_readonly_line"><span class="wpbc_catalog_booking_resources__editor_readonly_value">{{ data.field.display_value }}</span></span></div>
			<# } #>
			<# if ( data.field.link_url && data.field.link_label ) { #><a class="wpbc_catalog_booking_resources__editor_field_link wpbc_catalog_booking_resources__editor_summary_action" href="{{ data.field.link_url }}"><span class="wpbc-bi-box-arrow-up-right" aria-hidden="true"></span>{{ data.field.link_label }}</a><# } #>
			<# if ( data.field.help ) { #><p class="description wpbc_bfb__help wpbc_catalog_booking_resources__editor_summary_help">{{ data.field.help }}</p><# } #>
		</div>
	<# } else { #>
	<div class="inspector__row wpbc_catalog_booking_resources__inspector_field wpbc_catalog_booking_resources__inspector_field--{{ data.field.type }}" data-wpbc-catalog-resource-field-wrap="{{ data.field.key }}">
		<# if ( 'radio' === data.field.type ) { #><span class="inspector__label" id="{{ control_id }}_label">{{ data.field.label }}</span><# } else if ( is_readonly && 'code' !== data.field.type ) { #><span class="inspector__label">{{ data.field.label }}</span><# } else { #><label class="inspector__label" for="{{ control_id }}">{{ data.field.label }}</label><# } #>
		<div class="inspector__control">
			<# if ( 'radio' === data.field.type ) { #>
				<div class="wpbc_catalog_booking_resources__create_choice_group" role="radiogroup" aria-labelledby="{{ control_id }}_label">
					<# _.each( data.field.options || [], function ( option, option_index ) { var option_id = control_id + '_' + option_index; #>
						<label for="{{ option_id }}" <# if ( String( option.value ) === String( data.field.value ) ) { #>class="is-selected"<# } #>>
							<input id="{{ option_id }}" type="radio" name="{{ control_id }}" value="{{ option.value }}" data-wpbc-catalog-resource-radio-field="{{ data.field.key }}" <# if ( String( option.value ) === String( data.field.value ) ) { #>checked<# } #>>
							<span>{{ option.label }}</span>
						</label>
					<# } ); #>
				</div>
			<# } else if ( 'media' === data.field.type ) { #>
				<div class="wpbc_ui_listing__media wpbc_catalog_booking_resources__editor_media">
					<button type="button" class="wpbc_ui_listing__media_preview wpbc_media_upload_button" data-modal_title="{{ data.i18n.select_image_title }}" data-btn_title="{{ data.i18n.use_image }}" data-url_field="{{ control_id }}" aria-label="{{ data.i18n.select_image }}">
						<img src="{{ data.field.value }}" alt="" class="wpbc_ui_listing__media_image" data-wpbc-catalog-resource-image-preview <# if ( ! data.field.value ) { #>hidden<# } #>>
						<i class="wpbc_ui_listing__media_placeholder menu_icon icon-1x wpbc-bi-image-fill" data-wpbc-catalog-resource-image-placeholder aria-hidden="true" <# if ( data.field.value ) { #>hidden<# } #>></i>
					</button>
					<div class="wpbc_ui_listing__media_actions wpbc_ui_el__buttons_group">
						<button type="button" class="button wpbc_media_upload_button" data-modal_title="{{ data.i18n.select_image_title }}" data-btn_title="{{ data.i18n.use_image }}" data-url_field="{{ control_id }}">{{ data.i18n.select_image }}</button>
						<button type="button" class="button" data-wpbc-catalog-resource-remove-image <# if ( ! data.field.value ) { #>disabled<# } #>>{{ data.i18n.remove_image }}</button>
					</div>
				</div>
				<input type="text" id="{{ control_id }}" class="inspector__input" value="{{ data.field.value }}" data-wpbc-catalog-resource-field="{{ data.field.key }}" readonly>
			<# } else if ( 'textarea' === data.field.type ) { #>
				<textarea id="{{ control_id }}" class="inspector__input" rows="5" data-wpbc-catalog-resource-field="{{ data.field.key }}" <# if ( data.field.maxlength ) { #>maxlength="{{ data.field.maxlength }}"<# } #> <# if ( data.field.required ) { #>required<# } #>>{{ data.field.value }}</textarea>
			<# } else if ( 'select' === data.field.type && data.field.editable ) { #>
				<select id="{{ control_id }}" class="inspector__input" data-wpbc-catalog-resource-field="{{ data.field.key }}">
					<# _.each( data.field.options || [], function ( option ) { #><option value="{{ option.value }}" <# if ( String( option.value ) === String( data.field.value ) ) { #>selected<# } #>>{{ option.label }}</option><# } ); #>
				</select>
			<# } else if ( 'code' === data.field.type && ( ! data.field.editable || data.field.readonly_input ) ) { #>
				<input id="{{ control_id }}" type="text" class="inspector__input wpbc_catalog_booking_resources__editor_code" value="{{ data.field.value }}" <# if ( data.field.editable ) { #>data-wpbc-catalog-resource-field="{{ data.field.key }}"<# } #> readonly>
			<# } else if ( is_readonly ) { #>
				<span class="wpbc_catalog_booking_resources__editor_readonly_value">{{ data.field.value }}</span>
			<# } else { #>
				<# if ( 'number' === data.field.type && data.field.slider ) { #><div class="wpbc_catalog_booking_resources__number_control"><# } #>
				<div class="wpbc_catalog_booking_resources__editor_input_row">
					<# if ( data.field.prefix ) { #><span class="wpbc_catalog_booking_resources__editor_input_prefix">{{ data.field.prefix }}</span><# } #>
					<input id="{{ control_id }}" type="<# if ( 'number' === data.field.type ) { #>number<# } else { #>text<# } #>" class="inspector__input <# if ( 'code' === data.field.type ) { #>wpbc_catalog_booking_resources__editor_code<# } #>" value="{{ data.field.value }}" data-wpbc-catalog-resource-field="{{ data.field.key }}" <# if ( data.field.min !== '' ) { #>min="{{ data.field.min }}"<# } #> <# if ( data.field.max !== '' ) { #>max="{{ data.field.max }}"<# } #> <# if ( data.field.step !== '' ) { #>step="{{ data.field.step }}"<# } #> <# if ( data.field.maxlength ) { #>maxlength="{{ data.field.maxlength }}"<# } #> <# if ( data.field.required ) { #>required<# } #>>
					<# if ( data.field.suffix ) { #><span class="wpbc_catalog_booking_resources__editor_input_suffix">{{ data.field.suffix }}</span><# } #>
				</div>
				<# if ( 'number' === data.field.type && data.field.slider ) { #>
					<input type="range" class="wpbc_catalog_booking_resources__number_slider" min="{{ data.field.slider_min }}" max="{{ data.field.slider_max }}" step="{{ data.field.slider_step }}" value="{{ data.field.value }}" aria-label="{{ data.field.label }}" data-wpbc-catalog-resource-range="{{ data.field.key }}" data-wpbc-catalog-resource-range-default-min="{{ data.field.slider_min }}" data-wpbc-catalog-resource-range-default-max="{{ data.field.slider_max }}">
				</div>
				<# } #>
			<# } #>
			<# if ( data.field.link_url && data.field.link_label ) { #><a class="wpbc_catalog_booking_resources__editor_field_link" href="{{ data.field.link_url }}"><span class="wpbc-bi-box-arrow-up-right" aria-hidden="true"></span>{{ data.field.link_label }}</a><# } #>
			<# if ( data.field.help ) { #><p class="description wpbc_bfb__help">{{ data.field.help }}</p><# } #>
		</div>
	</div>
	<# } #>
</script>
