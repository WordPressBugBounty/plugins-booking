<?php
/**
 * Resource inspector group using the established collapsible-group contract.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-inspector-group">
	<# var panel_id = 'wpbc_catalog_booking_resource_' + data.mode + '_' + data.section.id; #>
	<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group wpbc_catalog_booking_resources__editor_section <# if ( data.section.expanded ) { #>is-open<# } #>" data-group="catalog-booking-resource-{{ data.section.id }}">
		<button type="button" class="group__header" role="button" aria-expanded="<# if ( data.section.expanded ) { #>true<# } else { #>false<# } #>" aria-controls="{{ panel_id }}">
			<h3>{{ data.section.title }}</h3>
			<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right" aria-hidden="true"></i>
		</button>
		<div class="group__fields" id="{{ panel_id }}" aria-hidden="<# if ( data.section.expanded ) { #>false<# } else { #>true<# } #>" <# if ( ! data.section.expanded ) { #>hidden<# } #>>
			<#
				var summary_is_open = false;
				_.each( data.section.fields || [], function ( field ) {
					if ( 'summary' === field.layout && ! summary_is_open ) {
						print( '<div class="wpbc_catalog_booking_resources__editor_summary">' );
						summary_is_open = true;
					} else if ( 'summary' !== field.layout && summary_is_open ) {
						print( '</div>' );
						summary_is_open = false;
					}
					print( wp.template( 'wpbc-booking-resource-inspector-field' )( { field: field, i18n: data.i18n, mode: data.mode } ) );
				} );
				if ( summary_is_open ) {
					print( '</div>' );
				}
			#>
			<# if ( data.section.publishing ) { print( wp.template( 'wpbc-booking-resource-inspector-publishing' )( { publishing: data.section.publishing, i18n: data.i18n } ) ); } #>
			<# if ( data.section.published_pages ) { print( wp.template( 'wpbc-booking-resource-inspector-published-pages' )( { published_pages: data.section.published_pages, i18n: data.i18n } ) ); } #>
		</div>
	</section>
</script>
