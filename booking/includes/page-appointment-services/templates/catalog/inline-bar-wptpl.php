<?php
/**
 * Appointment Services inline-editing status bar WP template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }
?>
<script type="text/html" id="tmpl-wpbc-appointment-services-inline-bar">
	<div class="wpbc_ui_catalog_inline_bar wpbc_ui_listing__viewport_sticky wpbc_appointment_services__inline_bar" data-wpbc-appointment-services-inline-bar data-wpbc-ui-catalog-inline-bar data-wpbc-ui-catalog-viewport-sticky>
		<div class="wpbc_ui_catalog_inline_bar__status wpbc_appointment_services__inline_bar_status">
			<strong>{{ data.title }}</strong>
			<span data-wpbc-appointment-services-inline-changed-label data-wpbc-ui-catalog-inline-count>{{ data.changed_label }}</span>
			<p class="description">{{ data.description }}</p>
		</div>
		<div class="wpbc_ui_catalog_inline_bar__actions wpbc_appointment_services__inline_bar_actions wpbc_ui_el__buttons_group">
			<button type="button" class="button button-secondary wpbc_appointment_services__inline_cancel" data-wpbc-ui-catalog-inline-cancel data-wpbc-right-sidebar-keep-open="1">{{ data.cancel }}</button>
			<button type="button" class="button button-primary wpbc_appointment_services__inline_review" data-wpbc-ui-catalog-inline-review data-wpbc-right-sidebar-keep-open="1"<# if ( ! data.changed_count ) { #> disabled<# } #>>{{ data.review }}</button>
		</div>
	</div>
</script>
