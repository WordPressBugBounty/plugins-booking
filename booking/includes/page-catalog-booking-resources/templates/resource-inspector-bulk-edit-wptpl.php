<?php
/**
 * Booking Resource bulk-edit inspector template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-inspector-bulk-edit">
	<form id="wpbc_catalog_booking_resources_bulk_form" class="wpbc_catalog_booking_resources__editor wpbc_catalog_booking_resources__bulk_editor" data-wpbc-catalog-resource-bulk-form data-mode="bulk_edit">
		<div class="wpbc_bfb__inspector__head"><div class="header_container"><div class="header_title_content">
			<h3 class="title" tabindex="-1" data-wpbc-catalog-resource-inspector-heading>{{ data.schema.title }}</h3>
			<span class="wpbc_catalog_booking_resources__editor_context">{{ data.selection_label }}</span>
			<div class="desc">{{ data.schema.description }}</div>
		</div></div></div>
		<div class="notice inline notice-error" data-wpbc-catalog-resource-inspector-message hidden role="alert"><p></p></div>
		<div class="wpbc_catalog_booking_resources__editor_sections">
			<# _.each( data.schema.sections || [], function ( section ) { print( wp.template( 'wpbc-booking-resource-inspector-bulk-group' )( { section: section, i18n: data.i18n } ) ); } ); #>
		</div>
	</form>
</script>
