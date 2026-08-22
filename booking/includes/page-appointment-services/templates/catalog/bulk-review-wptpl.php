<?php
/**
 * Appointment Services bulk review WP template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }
?>
<script type="text/html" id="tmpl-wpbc-appointment-services-bulk-review">
	<form id="{{ data.form_id }}" class="wpbc_ui_catalog_inline_review" data-wpbc-ui-catalog-inline-review-form data-mode="{{ data.mode }}">
		<div class="wpbc_bfb__inspector__head"><div class="header_container"><div class="header_title_content"><h3 class="title" tabindex="-1" data-wpbc-ui-catalog-inline-review-heading>{{ data.title }}</h3><span class="wpbc_ui_catalog_inline_review__context">{{ data.changed_label }}</span><p class="desc">{{ data.description }}</p></div></div></div>
		<div class="wpbc_ui_catalog_inline_review__content"><p class="description">{{ data.pending_message }}</p><# if ( data.warning ) { #><div class="notice notice-warning inline"><p>{{ data.warning }}</p></div><# } #><# _.each( data.rows || [], function ( row ) { #><section class="wpbc_ui_catalog_inline_review__row"><h3>{{ row.title }}</h3><dl class="wpbc_ui_catalog_inline_review__fields"><# _.each( row.fields || [], function ( field ) { #><div class="wpbc_ui_catalog_inline_review__field"><dt>{{ field.label }}</dt><dd><del>{{ field.before }}</del><span class="wpbc-bi-arrow-right" aria-hidden="true"></span><ins>{{ field.after }}</ins></dd></div><# } ); #></dl><# if ( row.notes && row.notes.length ) { #><div class="wpbc_ui_catalog_inline_review__notes"><# _.each( row.notes, function ( note ) { #><p>{{ note }}</p><# } ); #></div><# } #></section><# } ); #></div>
	</form>
</script>
