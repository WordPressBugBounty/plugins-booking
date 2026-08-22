<?php
/**
 * Booking Resource bulk-edit collapsible group template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-inspector-bulk-group">
	<# var panel_id = 'wpbc_catalog_booking_resources_bulk_' + data.section.id; #>
	<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group wpbc_catalog_booking_resources__editor_section <# if ( data.section.expanded ) { #>is-open<# } #>" data-group="catalog-booking-resources-bulk-{{ data.section.id }}">
		<button type="button" class="group__header" role="button" aria-expanded="<# if ( data.section.expanded ) { #>true<# } else { #>false<# } #>" aria-controls="{{ panel_id }}">
			<h3>{{ data.section.title }}</h3>
			<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right" aria-hidden="true"></i>
		</button>
		<div class="group__fields" id="{{ panel_id }}" aria-hidden="<# if ( data.section.expanded ) { #>false<# } else { #>true<# } #>" <# if ( ! data.section.expanded ) { #>hidden<# } #>>
			<# _.each( data.section.fields || [], function ( field ) { print( wp.template( 'wpbc-booking-resource-inspector-bulk-field' )( { field: field, i18n: data.i18n } ) ); } ); #>
		</div>
	</section>
</script>
