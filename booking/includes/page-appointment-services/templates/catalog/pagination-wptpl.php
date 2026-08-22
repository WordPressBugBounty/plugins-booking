<?php
/**
 * Appointment Services pagination WP template.
 *
 * Renders the normalized result count, page-size selector, and keyboard-
 * accessible page controls supplied by the shared response contract.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
?>
<script type="text/html" id="tmpl-wpbc-appointment-services-pagination">
	<div class="wpbc_ui_listing__footer wpbc_appointment_services__list_footer">
		<span class="wpbc_ui_listing__result_count" aria-live="polite">{{ data.results_status }}</span>
		<div class="wpbc_ui_listing__footer_controls">
			<div class="wpbc_ui_listing__items_per_page"><label for="wpbc_appointment_services_items_per_page">{{ data.show_label }}</label><select id="wpbc_appointment_services_items_per_page" data-wpbc-ui-catalog-items-per-page autocomplete="off"><# _.each( data.items_per_page_options, function ( page_size ) { #><option value="{{ page_size }}"<# if ( page_size === data.items_per_page ) { #> selected<# } #>>{{ page_size }}</option><# } ); #></select><span>{{ data.per_page_label }}</span></div>
			<nav class="wpbc_ui_listing__pagination" aria-label="{{ data.aria_label }}">
				<button type="button" class="button" data-wpbc-ui-catalog-page="{{ data.previous_page }}" aria-label="{{ data.previous_label }}"<# if ( ! data.has_previous ) { #> disabled<# } #>><span class="wpbc-bi-chevron-left" aria-hidden="true"></span></button>
				<label class="screen-reader-text" for="wpbc_appointment_services_page_number">{{ data.page_number_label }}</label><input id="wpbc_appointment_services_page_number" type="number" class="wpbc_ui_listing__page_number" min="1" max="{{ data.total_pages }}" value="{{ data.page_number }}" data-wpbc-ui-catalog-page-number><span aria-hidden="true">/</span><span>{{ data.total_pages }}</span>
				<button type="button" class="button" data-wpbc-ui-catalog-page="{{ data.next_page }}" aria-label="{{ data.next_label }}"<# if ( ! data.has_next ) { #> disabled<# } #>><span class="wpbc-bi-chevron-right" aria-hidden="true"></span></button>
			</nav>
		</div>
	</div>
</script>
