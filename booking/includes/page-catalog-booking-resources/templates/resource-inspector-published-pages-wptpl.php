<?php
/**
 * Booking Resource inspector published-page actions and links template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-inspector-published-pages">
	<div class="wpbc_booking_resources__details_actions wpbc_catalog_booking_resources__editor_publishing_actions">
		<# if ( data.published_pages.preview_page && data.published_pages.preview_page.url ) { #><a class="button button-secondary wpbc_booking_resources__details_action" href="{{ data.published_pages.preview_page.url }}" target="_blank" rel="noopener noreferrer"><span class="wpbc-bi-eye" aria-hidden="true"></span>{{ data.published_pages.preview_label }}</a><# } #>
		<# if ( ! data.published_pages.preview_page || ! data.published_pages.preview_page.url ) { #><span class="wpbc_booking_resources__details_no_preview"><span class="wpbc-bi-info-circle" aria-hidden="true"></span>{{ data.published_pages.no_preview_label }}</span><# } #>
	</div>
	<# if ( data.published_pages.pages && data.published_pages.pages.length ) { #>
		<div class="wpbc_catalog_booking_resources__editor_published_pages">
			<ul class="wpbc_booking_resources__published_pages">
				<# _.each( data.published_pages.pages, function ( published_page ) { #><li><a href="{{ published_page.url }}" target="_blank" rel="noopener noreferrer"><span class="wpbc-bi-box-arrow-up-right" aria-hidden="true"></span>{{ published_page.label }}</a></li><# } ); #>
			</ul>
		</div>
	<# } #>
</script>
