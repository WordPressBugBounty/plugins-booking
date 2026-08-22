<?php
/**
 * Booking Resource inspector shortcode and publishing-actions template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-inspector-publishing">
	<div class="wpbc_booking_resources__details_actions wpbc_catalog_booking_resources__editor_publishing_actions">
		<button type="button" class="button button-secondary wpbc_booking_resources__details_action" data-wpbc-booking-resource-shortcode-command="copy" data-wpbc-booking-resource-id="{{ data.publishing.resource_id }}" data-wpbc-booking-resource-shortcode="{{ data.publishing.shortcode }}"><span class="wpbc-bi-clipboard" aria-hidden="true"></span>{{ data.publishing.copy_label }}</button>
		<button type="button" class="button button-secondary wpbc_booking_resources__details_action" data-wpbc-booking-resource-shortcode-command="customize" data-wpbc-booking-resource-id="{{ data.publishing.resource_id }}" data-wpbc-booking-resource-shortcode="{{ data.publishing.shortcode }}"><span class="wpbc-bi-sliders" aria-hidden="true"></span>{{ data.publishing.customize_label }}</button>
		<button type="button" class="button button-primary wpbc_booking_resources__details_action" data-wpbc-booking-resource-shortcode-command="publish" data-wpbc-booking-resource-id="{{ data.publishing.resource_id }}" data-wpbc-booking-resource-shortcode="{{ data.publishing.shortcode }}"><span class="wpbc-bi-box-arrow-up-right" aria-hidden="true"></span>{{ data.publishing.publish_label }}</button>
	</div>
	<p class="wpbc_booking_resources__copy_status" data-wpbc-booking-resource-copy-status="{{ data.publishing.resource_id }}" role="status"></p>
</script>
