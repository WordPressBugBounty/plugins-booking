<?php
/**
 * Booking Resource edit-inspector template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-inspector-edit">
	<form id="wpbc_catalog_booking_resource_inspector_form" class="wpbc_catalog_booking_resources__editor" data-wpbc-catalog-resource-inspector-form data-mode="edit" data-resource-id="{{ data.schema.resource_id }}">
		<div class="wpbc_bfb__inspector__head wpbc_ui_catalog_inspector__header"><div class="header_container"><div class="header_title_content"><h3 class="title">{{ data.schema.title }}</h3><span class="wpbc_ui_catalog_inspector__context wpbc_catalog_booking_resources__editor_context">{{ data.schema.context }}</span><div class="desc">{{ data.schema.description }}</div></div></div></div>
		<div class="notice inline" data-wpbc-catalog-resource-inspector-message hidden role="status"><p></p></div>
		<div class="wpbc_catalog_booking_resources__editor_sections">
			<# _.each( data.schema.sections || [], function ( section ) { print( wp.template( 'wpbc-booking-resource-inspector-group' )( { section: section, i18n: data.i18n, mode: 'edit' } ) ); } ); #>
		</div>
	</form>
</script>
