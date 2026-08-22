<?php
/**
 * Appointment Services catalog shell WP template.
 *
 * Renders allow-listed layout and column controls around the active Service
 * template pack without containing Service queries or mutation behavior.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
?>
<script type="text/html" id="tmpl-wpbc-appointment-services-catalog">
	<div class="wpbc_appointment_services__catalog wpbc_ui_catalog" data-wpbc-catalog-id="{{ data.catalog_id }}" data-wpbc-template-pack="{{ data.initial_request.template_pack }}">
		<div data-wpbc-appointment-services-inline-bar-host></div>
		<div class="wpbc_ui_listing__selection_summary wpbc_appointment_services__selection_summary" data-wpbc-ui-catalog-selection-summary data-wpbc-ui-catalog-selection-summary-sticky="1" hidden>
			<div class="wpbc_ui_listing__selection_status">
				<strong aria-live="polite" aria-atomic="true">{{ data.i18n.selected_services }} <span data-wpbc-ui-catalog-selection-count>0</span></strong>
				<button type="button" class="button-link" data-wpbc-ui-catalog-selection-clear>{{ data.i18n.clear_selection }}</button>
			</div>
				<div class="wpbc_ui_listing__selection_actions wpbc_appointment_services__selection_actions wpbc_ui_catalog_selection_actions">
					<button type="button" class="button button-primary wpbc_appointment_services__bulk_edit" data-wpbc-right-sidebar-keep-open="1"><span class="wpbc-bi-pencil-square" aria-hidden="true"></span>{{ data.i18n.edit_selected }}</button>
					<button type="button" class="button wpbc_ui_catalog_selection_delete wpbc_appointment_services__bulk_delete" data-wpbc-right-sidebar-keep-open="1"><span class="wpbc-bi-trash3" aria-hidden="true"></span>{{ data.i18n.delete_selected }}</button>
				</div>
		</div>
		<div class="wpbc_ui_listing wpbc_ui_listing--catalog" data-wpbc-ui-catalog-listing>
			<div class="wpbc_ui_listing__display_toolbar" data-wpbc-ui-catalog-display-controls>
				<div class="wpbc_ui_listing__toolbar_actions wpbc_ui_el__buttons_group">
					<button type="button" class="button button-secondary wpbc_ui_catalog_inline_toggle wpbc_appointment_services__inline_toggle" data-wpbc-ui-catalog-inline-toggle aria-pressed="false" disabled>
						<span class="wpbc-bi-pencil-square" aria-hidden="true"></span>
						<span data-wpbc-appointment-services-inline-toggle-label data-wpbc-ui-catalog-inline-toggle-label>{{ data.i18n.edit_rows }}</span>
					</button>
				</div>
				<div class="wpbc_ui_listing__view_control">
					<label for="wpbc_appointment_services_layout">{{ data.i18n.layout_label }}</label>
					<select id="wpbc_appointment_services_layout" data-wpbc-ui-catalog-template-pack autocomplete="off">
						<# _.each( data.template_packs, function ( template_pack, template_pack_id ) { #>
							<option value="{{ template_pack_id }}"<# if ( template_pack_id === data.initial_request.template_pack ) { #> selected<# } #>>{{ data.i18n[ 'layout_' + template_pack_id ] || template_pack_id }}</option>
						<# } ); #>
					</select>
				</div>
				<details class="wpbc_ui_listing__display_customizer has-viewport-positioning" data-wpbc-ui-catalog-display-customizer>
					<summary class="button button-secondary"><span class="wpbc-bi-sliders" aria-hidden="true"></span>{{ data.i18n.customize_columns }}</summary>
					<div class="wpbc_ui_listing__display_panel">
						<button type="button" class="wpbc_ui_listing__display_close" aria-label="{{ data.i18n.close_columns }}" data-wpbc-ui-catalog-display-close><span class="wpbc-bi-x-lg" aria-hidden="true"></span></button>
						<fieldset><legend>{{ data.i18n.columns_legend }}</legend><div class="wpbc_ui_listing__display_field_list" data-wpbc-ui-catalog-column-list>
							<# _.each( data.initial_request.column_order, function ( column_id, column_index ) { var column = data.columns.definitions[ column_id ]; if ( ! column ) { return; } var is_visible = -1 !== data.initial_request.visible_columns.indexOf( column_id ); #>
								<div class="wpbc_ui_listing__display_field_item<# if ( column.reorderable ) { #> is-reorderable<# } else { #> is-fixed<# } #>" data-wpbc-ui-catalog-column-item="{{ column_id }}" data-wpbc-ui-catalog-column-default-index="{{ column_index }}" data-wpbc-ui-catalog-column-reorderable="{{ column.reorderable ? '1' : '0' }}">
									<# if ( column.reorderable ) { #><button type="button" class="wpbc_ui_listing__display_drag_handle" aria-label="{{ column.label }}" data-wpbc-ui-catalog-column-drag-handle><span class="wpbc-bi-grip-vertical" aria-hidden="true"></span></button><# } #>
									<label class="wpbc_ui_listing__display_field" for="wpbc_service_column_{{ column_id }}"><input id="wpbc_service_column_{{ column_id }}" type="checkbox" value="{{ column_id }}" data-wpbc-ui-catalog-column-visible<# if ( is_visible ) { #> checked<# } #><# if ( column.required ) { #> disabled<# } #>><span>{{ column.label }}</span><# if ( column.required ) { #><small>{{ data.i18n.always_visible }}</small><# } #></label>
								</div>
							<# } ); #>
						</div><p class="screen-reader-text" aria-live="polite" data-wpbc-ui-catalog-column-status></p></fieldset>
						<div class="wpbc_ui_listing__display_actions"><button type="button" class="button-link" data-wpbc-ui-catalog-column-order-reset>{{ data.i18n.reset_order }}</button><button type="button" class="button-link" data-wpbc-ui-catalog-preferences-reset>{{ data.i18n.reset_preferences }}</button></div>
					</div>
				</details>
			</div>
			<div class="wpbc_appointment_services__catalog_content" data-wpbc-catalog-content aria-live="polite" aria-busy="true">
				<div class="wpbc_appointment_services__loading is-visible" data-wpbc-ui-catalog-loading role="status">
					<div class="wpbc_spins_loading_container"><div class="wpbc_booking_form_spin_loader" aria-hidden="true"><div class="wpbc_spins_loader_wrapper"><div class="wpbc_one_spin_loader_mini2"></div></div></div><span>{{ data.i18n.loading }}</span></div>
				</div>
				<div data-wpbc-ui-catalog-response></div>
			</div>
		</div>
	</div>
</script>
