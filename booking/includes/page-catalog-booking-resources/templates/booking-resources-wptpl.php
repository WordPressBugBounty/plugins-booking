<?php
/**
 * Booking Resources catalog wrapper template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resources-catalog">
	<div class="wpbc_catalog_booking_resources wpbc_booking_resources_page wpbc_ui_catalog" data-wpbc-catalog-id="{{ data.catalog_id }}" data-wpbc-template-pack="{{ data.initial_request.template_pack }}">
		<div data-wpbc-booking-resources-filters></div>
		<div data-wpbc-catalog-inline-bar-host></div>
		<# if ( data.features && data.features.selection ) { #>
			<div class="wpbc_ui_listing__selection_summary" data-wpbc-ui-catalog-selection-summary data-wpbc-ui-catalog-selection-summary-sticky="1" hidden>
				<div class="wpbc_ui_listing__selection_status">
					<strong aria-live="polite" aria-atomic="true">{{ data.i18n.selected_resources }} <span data-wpbc-ui-catalog-selection-count>0</span></strong>
					<button type="button" class="button-link" data-wpbc-ui-catalog-selection-clear>{{ data.i18n.clear_selection }}</button>
				</div>
				<div class="wpbc_catalog_booking_resources__selection_actions wpbc_ui_catalog_selection_actions">
					<# if ( data.features && data.features.bulk_operations ) { #><button type="button" class="button button-primary" data-wpbc-catalog-selection-action="bulk_edit"><span class="wpbc-bi-pencil-square" aria-hidden="true"></span>{{ data.i18n.edit_selected }}</button><# } #>
					<# if ( data.features && data.features.delete_operations ) { #><button type="button" class="button wpbc_catalog_booking_resources__selection_delete wpbc_ui_catalog_selection_delete" data-wpbc-catalog-selection-action="delete"><span class="wpbc-bi-trash3" aria-hidden="true"></span>{{ data.i18n.delete_selected }}</button><# } #>
				</div>
			</div>
		<# } #>
		<div class="wpbc_ui_listing wpbc_ui_listing--catalog wpbc_booking_resources__listing" data-wpbc-ui-catalog-listing data-wpbc-listing-display="1">
			<div data-wpbc-booking-resources-toolbar></div>
			<div class="wpbc_booking_resources__content" data-wpbc-catalog-content aria-live="polite" aria-busy="true">
				<div class="wpbc_booking_resources__loading is-visible" data-wpbc-ui-catalog-loading role="status">
					<div class="wpbc_spins_loading_container">
						<div class="wpbc_booking_form_spin_loader" aria-hidden="true">
							<div class="wpbc_spins_loader_wrapper"><div class="wpbc_one_spin_loader_mini2"></div></div>
						</div>
						<span>{{ data.i18n.loading }}</span>
					</div>
				</div>
				<div data-wpbc-ui-catalog-response></div>
			</div>
		</div>
	</div>
</script>
