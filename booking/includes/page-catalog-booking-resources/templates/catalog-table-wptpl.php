<?php
/**
 * Booking Resources semantic table template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resources-table">
	<h2 id="wpbc_catalog_booking_resources_title_{{ data.catalog_id }}" class="screen-reader-text" tabindex="-1" data-wpbc-catalog-heading>{{ data.i18n.catalog_label }}</h2>
	<div class="wpbc_ui_listing__table_wrap wpbc_booking_resources__table_wrap wpbc_catalog_booking_resources__table_scroll" tabindex="0" role="region" aria-labelledby="wpbc_catalog_booking_resources_title_{{ data.catalog_id }}">
		<table class="wpbc_ui_listing__table wpbc_ui_listing__table--catalog wpbc_ui_listing__table--responsive wpbc_booking_resources__table wpbc_catalog_booking_resources__table">
			<caption class="screen-reader-text">{{ data.i18n.catalog_label }}</caption>
			<thead data-wpbc-booking-resources-header></thead>
			<tbody data-wpbc-booking-resources-rows></tbody>
		</table>
	</div>
	<div data-wpbc-booking-resources-pagination></div>
</script>
