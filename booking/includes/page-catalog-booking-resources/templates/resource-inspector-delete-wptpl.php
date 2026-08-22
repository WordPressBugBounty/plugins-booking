<?php
/**
 * Booking Resource permanent-deletion review template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-inspector-delete">
	<form id="wpbc_catalog_booking_resources_delete_form" class="wpbc_catalog_booking_resources__editor wpbc_catalog_booking_resources__delete_review wpbc_ui_catalog_delete_review" data-wpbc-catalog-resource-delete-form data-wpbc-ui-catalog-delete-review-form data-mode="delete_review">
		<div class="wpbc_bfb__inspector__head"><div class="header_container"><div class="header_title_content">
			<h3 class="title" tabindex="-1" data-wpbc-catalog-resource-inspector-heading>{{ data.delete_i18n.title }}</h3>
			<span class="wpbc_catalog_booking_resources__editor_context wpbc_ui_catalog_delete_review__context">{{ data.selection_label }}</span>
			<div class="desc">{{ data.delete_i18n.review_help }}</div>
		</div></div></div>
		<div class="notice inline notice-error" data-wpbc-catalog-resource-inspector-message hidden role="alert"><p></p></div>
		<div class="wpbc_catalog_booking_resources__delete_body wpbc_ui_catalog_delete_review__body">
			<h2>{{ data.delete_i18n.resources_to_delete }}</h2>
			<label class="wpbc_catalog_booking_resources__delete_acknowledgement wpbc_booking_resources__delete_acknowledgement wpbc_ui_catalog_delete_review__acknowledgement is-attention" for="wpbc_booking_resources_delete_acknowledge">
				<input id="wpbc_booking_resources_delete_acknowledge" type="checkbox" data-wpbc-catalog-resource-delete-acknowledgement data-wpbc-ui-catalog-delete-acknowledgement>
				<span>{{ data.delete_i18n.acknowledgement }}</span>
			</label>
			<# _.each( data.preview.resources || [], function ( resource ) { #>
				<section class="wpbc_catalog_booking_resources__delete_card wpbc_ui_catalog_delete_review__card">
					<h3>{{ resource.title }}</h3>
					<p>{{ resource.type_label }} - {{ data.i18n.resource_id }}: {{ resource.id }}</p>
					<p class="<# if ( resource.booking_count ) { #>has-bookings<# } #>"><# if ( resource.booking_count ) { #>{{ resource.booking_count_label }}<# } else { #>{{ data.i18n.no_existing_bookings }}<# } #></p>
					<# if ( resource.actions && resource.actions.length ) { #>
					<div class="wpbc_ui_catalog_delete_review__actions">
						<h4>{{ data.delete_i18n.actions_heading }}</h4>
						<ul><# _.each( resource.actions, function ( action ) { #><li><a href="{{ action.url }}">{{ action.label }}</a><# if ( action.description ) { #><span class="description">{{ action.description }}</span><# } #></li><# } ); #></ul>
					</div>
					<# } #>
				</section>
			<# } ); #>
			<div class="wpbc_catalog_booking_resources__delete_warning wpbc_ui_catalog_delete_review__warning"><span class="wpbc-bi-exclamation-triangle" aria-hidden="true"></span><p>{{ data.delete_i18n.warning }}</p></div>
			<# if ( data.preview.has_bookings ) { #><div class="wpbc_catalog_booking_resources__delete_warning wpbc_catalog_booking_resources__delete_warning--bookings wpbc_ui_catalog_delete_review__warning is-caution"><span class="wpbc-bi-info-circle" aria-hidden="true"></span><p>{{ data.delete_i18n.bookings_retained_warning }}</p></div><# } #>
		</div>
	</form>
</script>
