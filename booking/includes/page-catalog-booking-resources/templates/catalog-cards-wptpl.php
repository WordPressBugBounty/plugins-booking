<?php
/**
 * Booking Resources cards-pack template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resources-cards">
	<h2 id="wpbc_catalog_booking_resources_title_{{ data.catalog_id }}" class="screen-reader-text" tabindex="-1" data-wpbc-catalog-heading>{{ data.i18n.catalog_label }}</h2>
	<div class="wpbc_booking_resources__cards_header" data-wpbc-booking-resources-header></div>
	<div class="wpbc_booking_resources__cards" role="list" aria-labelledby="wpbc_catalog_booking_resources_title_{{ data.catalog_id }}" data-wpbc-booking-resources-rows></div>
	<div data-wpbc-booking-resources-pagination></div>
</script>

