<?php
/**
 * Appointment Services permanent-deletion review WP template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-appointment-services-delete-review">
	<form id="wpbc_appointment_services_delete_review_form" class="wpbc_appointment_services__delete_review wpbc_ui_catalog_delete_review" data-wpbc-ui-catalog-delete-review-form data-mode="delete_review">
		<div class="wpbc_bfb__inspector__head"><div class="header_container"><div class="header_title_content">
			<h3 class="title" tabindex="-1" data-wpbc-ui-catalog-delete-review-heading>{{ data.title }}</h3>
			<span class="wpbc_ui_catalog_delete_review__context">{{ data.selection_label }}</span>
			<p class="desc">{{ data.description }}</p>
		</div></div></div>
		<div class="wpbc_ui_catalog_delete_review__body">
			<p class="description">{{ data.pending_message }}</p>
			<# if ( data.warning && ! data.can_apply ) { #>
			<div class="wpbc_ui_catalog_delete_review__warning is-blocked" role="status">
				<span class="wpbc-bi-shield-exclamation" aria-hidden="true"></span>
				<p>{{ data.warning }}</p>
			</div>
			<# } #>
			<h2>{{ data.items_heading }}</h2>
			<# if ( data.can_apply ) { #>
			<label class="wpbc_ui_catalog_delete_review__acknowledgement is-attention" for="wpbc_appointment_services_delete_acknowledge">
				<input id="wpbc_appointment_services_delete_acknowledge" type="checkbox" data-wpbc-ui-catalog-delete-acknowledgement>
				<span>{{ data.acknowledgement }}</span>
			</label>
			<# } #>
			<# _.each( data.items || [], function ( service ) { #>
			<section class="wpbc_ui_catalog_delete_review__card">
				<h3>{{ service.title }}</h3>
				<p>{{ data.id_label }}: {{ service.id }}</p>
				<# if ( service.notes && service.notes.length ) { #><ul><# _.each( service.notes, function ( note ) { #><li>{{ note }}</li><# } ); #></ul><# } #>
				<# if ( service.actions && service.actions.length ) { #>
				<div class="wpbc_ui_catalog_delete_review__actions">
					<h4>{{ data.actions_heading }}</h4>
					<ul><# _.each( service.actions, function ( action ) { #><li><a href="{{ action.url }}">{{ action.label }}</a><# if ( action.description ) { #><span class="description">{{ action.description }}</span><# } #></li><# } ); #></ul>
				</div>
				<# } #>
			</section>
			<# } ); #>
			<# if ( data.warning && data.can_apply ) { #>
			<div class="wpbc_ui_catalog_delete_review__warning" role="status">
				<span class="wpbc-bi-exclamation-triangle" aria-hidden="true"></span>
				<p>{{ data.warning }}</p>
			</div>
			<# } #>
		</div>
	</form>
</script>
