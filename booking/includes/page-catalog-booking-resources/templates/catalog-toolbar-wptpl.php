<?php
/**
 * Booking Resources display controls template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resources-toolbar">
	<div class="wpbc_ui_listing__display_toolbar" data-wpbc-ui-catalog-display-controls>
		<div class="wpbc_ui_listing__toolbar_actions wpbc_ui_el__buttons_group">
			<button type="button" class="button button-secondary wpbc_ui_catalog_inline_toggle" data-wpbc-catalog-inline-toggle data-wpbc-ui-catalog-inline-toggle aria-pressed="false">
				<span class="wpbc-bi-pencil-square" aria-hidden="true"></span>
				<span data-wpbc-catalog-inline-toggle-label data-wpbc-ui-catalog-inline-toggle-label>{{ data.i18n.edit_rows }}</span>
			</button>
		</div>
		<div class="wpbc_ui_listing__view_control">
				<label for="wpbc_catalog_booking_resources_view">{{ data.i18n.view_label }}</label>
				<select id="wpbc_catalog_booking_resources_view" data-wpbc-ui-catalog-view autocomplete="off">
					<# _.each( data.views, function ( view ) { #>
						<option value="{{ view.id }}" data-wpbc-ui-catalog-view-fields="{{ view.fields.join( ',' ) }}"<# if ( view.id === data.active_view ) { #> selected<# } #>>{{ view.label }}</option>
					<# } ); #>
					<option value="custom"<# if ( 'custom' === data.active_view ) { #> selected<# } #>>{{ data.i18n.custom_view }}</option>
				</select>
		</div>
		<div class="wpbc_ui_listing__view_control wpbc_booking_resources__layout_control">
			<label for="wpbc_catalog_booking_resources_layout">{{ data.i18n.layout_label }}</label>
			<select id="wpbc_catalog_booking_resources_layout" data-wpbc-ui-catalog-template-pack autocomplete="off">
				<# _.each( data.template_packs, function ( template_pack ) { #>
					<option value="{{ template_pack.id }}"<# if ( template_pack.id === data.active_template_pack ) { #> selected<# } #>>{{ template_pack.label }}</option>
				<# } ); #>
			</select>
		</div>
		<details class="wpbc_ui_listing__display_customizer has-viewport-positioning" data-wpbc-ui-catalog-display-customizer>
				<summary class="button button-secondary">
					<span class="wpbc-bi-sliders" aria-hidden="true"></span>
					{{ data.i18n.customize_columns }}
				</summary>
				<div class="wpbc_ui_listing__display_panel">
					<button type="button" class="wpbc_ui_listing__display_close" aria-label="{{ data.i18n.close_columns }}" data-wpbc-ui-catalog-display-close>
						<span class="wpbc-bi-x-lg" aria-hidden="true"></span>
					</button>
					<fieldset>
						<legend>{{ data.i18n.columns_legend }}</legend>
						<div class="wpbc_ui_listing__display_field_list" data-wpbc-ui-catalog-column-list>
							<# _.each( data.columns, function ( column, column_index ) { #>
								<div class="wpbc_ui_listing__display_field_item<# if ( column.reorderable ) { #> is-reorderable<# } else { #> is-fixed<# } #>" data-wpbc-ui-catalog-column-item="{{ column.id }}" data-wpbc-ui-catalog-column-default-index="{{ column.default_index }}" data-wpbc-ui-catalog-column-reorderable="<# if ( column.reorderable ) { #>1<# } else { #>0<# } #>">
									<# if ( column.reorderable ) { #>
										<button type="button" class="wpbc_ui_listing__display_drag_handle" aria-label="{{ column.move_label }}" data-wpbc-ui-catalog-column-drag-handle>
											<span class="wpbc-bi-grip-vertical" aria-hidden="true"></span>
										</button>
									<# } else { #>
										<span class="wpbc_ui_listing__display_fixed_icon" aria-hidden="true"><span class="wpbc-bi-lock-fill"></span></span>
									<# } #>
									<label class="wpbc_ui_listing__display_field" for="wpbc_catalog_column_{{ column.id }}">
										<input type="checkbox" id="wpbc_catalog_column_{{ column.id }}" value="{{ column.id }}" data-wpbc-ui-catalog-column-visible<# if ( column.visible ) { #> checked<# } #><# if ( column.required ) { #> disabled<# } #>>
										<span>{{ column.label }}</span>
										<span class="wpbc_ui_listing__display_field_meta">
											<# if ( column.required ) { #><small>{{ data.i18n.always_visible }}</small><# } #>
											<# if ( ! column.reorderable ) { #><small>{{ data.i18n.fixed_position }}</small><# } #>
										</span>
									</label>
								</div>
							<# } ); #>
						</div>
						<p class="screen-reader-text" aria-live="polite" data-wpbc-ui-catalog-column-status></p>
					</fieldset>
					<div class="wpbc_ui_listing__display_actions">
						<button type="button" class="button-link" data-wpbc-ui-catalog-column-order-reset>{{ data.i18n.reset_order }}</button>
						<button type="button" class="button-link" data-wpbc-ui-catalog-preferences-reset>{{ data.i18n.reset_preferences }}</button>
					</div>
				</div>
		</details>
	</div>
</script>
