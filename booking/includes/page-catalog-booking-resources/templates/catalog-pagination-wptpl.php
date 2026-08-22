<?php
/**
 * Booking Resources pagination template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resources-pagination">
	<div class="wpbc_ui_listing__footer wpbc_booking_resources__list_footer" data-wpbc-ui-catalog-footer>
		<span class="wpbc_ui_listing__result_count wpbc_booking_resources__result_count" aria-live="polite">{{ data.results_status }}</span>
		<div class="wpbc_ui_listing__footer_controls">
			<div class="wpbc_ui_listing__items_per_page wpbc_booking_resources__items_per_page">
				<label for="wpbc_catalog_booking_resources_items_per_page">{{ data.show_label }}</label>
				<select id="wpbc_catalog_booking_resources_items_per_page" data-wpbc-ui-catalog-items-per-page autocomplete="off">
					<# _.each( data.items_per_page_options, function ( page_size ) { #>
						<option value="{{ page_size }}"<# if ( page_size === data.items_per_page ) { #> selected<# } #>>{{ page_size }}</option>
					<# } ); #>
				</select>
				<span>{{ data.per_page_label }}</span>
			</div>
			<nav class="wpbc_ui_listing__pagination wpbc_booking_resources__pagination" aria-label="{{ data.aria_label }}">
				<button type="button" class="button wpbc_ui_listing__page_previous wpbc_booking_resources__page_previous" data-wpbc-ui-catalog-page="{{ data.previous_page }}" data-wpbc-ui-catalog-page-direction="previous" aria-label="{{ data.previous_label }}"<# if ( ! data.has_previous ) { #> disabled<# } #>>
					<span class="wpbc-bi-chevron-left" aria-hidden="true"></span>
				</button>
				<div class="wpbc_ui_listing__page_label wpbc_booking_resources__page_label">
					<label class="screen-reader-text" for="wpbc_catalog_booking_resources_page_number">{{ data.page_number_label }}</label>
					<input id="wpbc_catalog_booking_resources_page_number" type="number" class="wpbc_ui_listing__page_number" min="1" max="{{ data.total_pages }}" step="1" value="{{ data.page_number }}" inputmode="numeric" data-wpbc-ui-catalog-page-number>
					<span aria-hidden="true">/</span>
					<span class="wpbc_ui_listing__page_total">{{ data.total_pages }}</span>
				</div>
				<button type="button" class="button wpbc_ui_listing__page_next wpbc_booking_resources__page_next" data-wpbc-ui-catalog-page="{{ data.next_page }}" data-wpbc-ui-catalog-page-direction="next" aria-label="{{ data.next_label }}"<# if ( ! data.has_next ) { #> disabled<# } #>>
					<span class="wpbc-bi-chevron-right" aria-hidden="true"></span>
				</button>
			</nav>
		</div>
	</div>
</script>
