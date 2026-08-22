<?php
/**
 * Booking Resources compact table-pack template.
 *
 * This pack retains semantic table relationships and all authorized fields,
 * while its namespaced CSS reduces row height and supporting copy.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resources-compact">
	<h2 id="wpbc_catalog_booking_resources_title_{{ data.catalog_id }}" class="screen-reader-text" tabindex="-1" data-wpbc-catalog-heading>{{ data.i18n.catalog_label }}</h2>
	<div class="wpbc_ui_listing__table_wrap wpbc_booking_resources__table_wrap wpbc_catalog_booking_resources__table_scroll wpbc_booking_resources__compact_wrap" tabindex="0" role="region" aria-labelledby="wpbc_catalog_booking_resources_title_{{ data.catalog_id }}">
		<table class="wpbc_ui_listing__table wpbc_ui_listing__table--catalog wpbc_ui_listing__table--responsive wpbc_booking_resources__table wpbc_booking_resources__table--compact wpbc_catalog_booking_resources__table">
			<caption class="screen-reader-text">{{ data.i18n.catalog_label }}</caption>
			<thead data-wpbc-booking-resources-header></thead>
			<tbody data-wpbc-booking-resources-rows></tbody>
		</table>
	</div>
	<div data-wpbc-booking-resources-pagination></div>
</script>

