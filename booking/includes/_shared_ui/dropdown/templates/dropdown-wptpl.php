<?php
/**
 * Shared single-selection dropdown WordPress template.
 *
 * The executable-free model accepts scalar labels and ordered records of type
 * `option`, `heading`, or `separator`. It never accepts arbitrary HTML.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-shared-ui-dropdown">
	<#
	var component_id = String( data.id || '' ).replace( /[^A-Za-z0-9_-]/g, '' );
	var selected_value = String( data.selected_value || '' );
	var selected_label = String( data.selected_label || '' );
	var described_by = String( data.described_by || '' ).replace( /[^A-Za-z0-9_\- ]/g, '' );
	var listbox_id = component_id + '__listbox';
	var button_id = component_id + '__button';
	#>
	<div
		id="{{ component_id }}"
		class="wpbc_shared_ui_dropdown<# if ( data.class_name ) { #> {{ data.class_name }}<# } #>"
		data-wpbc-shared-ui-dropdown="{{ component_id }}"
		data-wpbc-shared-ui-dropdown-value="{{ selected_value }}"
	>
		<button
			type="button"
			id="{{ button_id }}"
			class="wpbc_shared_ui_dropdown__trigger"
			data-wpbc-shared-ui-dropdown-trigger
			aria-haspopup="listbox"
			aria-expanded="false"
			aria-controls="{{ listbox_id }}"
			<# if ( described_by ) { #>aria-describedby="{{ described_by }}"<# } #>
			<# if ( data.disabled ) { #>disabled<# } #>
		>
			<span class="screen-reader-text">{{ data.label }}: </span>
			<# if ( data.icon_class ) { #><span class="wpbc_shared_ui_dropdown__icon {{ data.icon_class }}" aria-hidden="true"></span><# } #>
			<span class="wpbc_shared_ui_dropdown__value" data-wpbc-shared-ui-dropdown-label>{{ selected_label }}</span>
			<span class="wpbc_shared_ui_dropdown__caret wpbc-bi-chevron-down" aria-hidden="true"></span>
		</button>
		<div class="wpbc_shared_ui_dropdown__panel" data-wpbc-shared-ui-dropdown-panel hidden>
			<div
				id="{{ listbox_id }}"
				class="wpbc_shared_ui_dropdown__listbox"
				data-wpbc-shared-ui-dropdown-listbox
				role="listbox"
				aria-orientation="vertical"
				aria-labelledby="{{ button_id }}"
				tabindex="-1"
			>
				<# _.each( data.options || [], function( option ) {
					var option_type = option.type || 'option';
					if ( 'heading' === option_type ) { #>
						<div class="wpbc_shared_ui_dropdown__heading" role="presentation">{{ option.label }}</div>
					<# } else if ( 'separator' === option_type ) { #>
						<div class="wpbc_shared_ui_dropdown__separator" role="separator"></div>
					<# } else { #>
						<button
							type="button"
							class="wpbc_shared_ui_dropdown__option<# if ( String( option.value ) === selected_value ) { #> is-selected<# } #><# if ( option.is_destructive ) { #> is-destructive<# } #>"
							role="option"
							tabindex="-1"
							data-wpbc-shared-ui-dropdown-option
							data-value="{{ option.value }}"
							data-default-disabled="<# if ( option.disabled ) { #>true<# } else { #>false<# } #>"
							aria-selected="<# if ( String( option.value ) === selected_value ) { #>true<# } else { #>false<# } #>"
							<# if ( option.disabled ) { #>disabled aria-disabled="true"<# } #>
						>
							<span class="wpbc_shared_ui_dropdown__option_label">{{ option.label }}</span>
							<# if ( option.icon_class ) { #><span class="wpbc_shared_ui_dropdown__option_icon {{ option.icon_class }}" aria-hidden="true"></span><# } #>
						</button>
					<# }
				} ); #>
			</div>
		</div>
		<# if ( data.name ) { #>
			<input type="hidden" name="{{ data.name }}" value="{{ selected_value }}" data-wpbc-shared-ui-dropdown-input>
		<# } #>
	</div>
</script>
