<?php
/**
 * Booking Resource inline-edit sticky summary template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resources-inline-bar">
	<div class="wpbc_ui_catalog_inline_bar wpbc_booking_resources__inline_bar wpbc_ui_listing__viewport_sticky" data-wpbc-catalog-inline-bar data-wpbc-ui-catalog-inline-bar data-wpbc-ui-catalog-viewport-sticky hidden>
		<div class="wpbc_ui_catalog_inline_bar__status wpbc_booking_resources__inline_bar_status">
			<strong>{{ data.i18n.inline_editing_rows }}</strong>
			<span data-wpbc-catalog-inline-count data-wpbc-ui-catalog-inline-count>{{ data.i18n.inline_no_changes_yet }}</span>
			<span class="description">{{ data.i18n.inline_help }}</span>
		</div>
		<div class="wpbc_ui_catalog_inline_bar__actions wpbc_booking_resources__inline_bar_actions wpbc_ui_el__buttons_group">
			<button type="button" class="button" data-wpbc-catalog-inline-cancel data-wpbc-ui-catalog-inline-cancel>{{ data.i18n.cancel }}</button>
			<button type="button" class="button button-primary" data-wpbc-catalog-inline-review data-wpbc-ui-catalog-inline-review disabled>{{ data.i18n.review_changes_button }}</button>
		</div>
		<div class="notice inline notice-error wpbc_booking_resources__inline_message" data-wpbc-catalog-inline-message hidden role="alert"><p></p></div>
	</div>
</script>
