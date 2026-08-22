<?php
/**
 * Shared lazy Booking Resource details-body template.
 *
 * Table and cards wrappers compose this presentation-only partial so both
 * packs expose the same authorized fields and actions.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-details-content">
	<div class="wpbc_booking_resources__details_content <# if ( 'loading' === data.state ) { #>is-loading<# } else if ( 'error' === data.state ) { #>has-error<# } #>" role="<# if ( 'error' === data.state ) { #>alert<# } else if ( 'loading' === data.state ) { #>status<# } else { #>region<# } #>" <# if ( 'ready' === data.state ) { #>aria-labelledby="wpbc_catalog_booking_resource_details_title_{{ data.resource_id }}"<# } else { #>aria-label="{{ data.title }}"<# } #> <# if ( 'loading' === data.state ) { #>aria-busy="true" aria-live="polite"<# } #>>
		<# if ( 'loading' === data.state ) { #>
			<div class="wpbc_spins_loading_container wpbc_bfb_spins_loading_container"><div class="wpbc_booking_form_spin_loader" aria-hidden="true"><div class="wpbc_spins_loader_wrapper"><div class="wpbc_one_spin_loader_mini2"></div></div></div><span>{{ data.loading_label }}</span></div>
		<# } else if ( 'error' === data.state ) { #>
			<span class="wpbc-bi-exclamation-triangle" aria-hidden="true"></span><span>{{ data.error_message }}</span>
		<# } else { #>
			<h2 class="screen-reader-text" id="wpbc_catalog_booking_resource_details_title_{{ data.resource_id }}">{{ data.title }}</h2>
			<div class="wpbc_booking_resources__details_grid">
				<# _.each( data.sections || [], function ( section ) { #>
					<section class="wpbc_booking_resources__details_card {{ section.class_name }}" data-wpbc-booking-resource-details-section="{{ section.id }}">
						<h3><span class="{{ section.icon }}" aria-hidden="true"></span><span>{{ section.title }}</span></h3>
						<# if ( section.fields && section.fields.length ) { #><dl>
							<# _.each( section.fields, function ( field ) { #>
								<div class="wpbc_booking_resources__details_value <# if ( 'code' === field.value_type ) { #>wpbc_booking_resources__details_shortcode<# } #>">
									<dt class="{{ field.label_class }}">{{ field.label }}</dt><dd>
										<# if ( 'code' === field.value_type ) { #><span class="wpbc_booking_resources__details_shortcode_value"><code data-wpbc-ui-catalog-overflow-tooltip="{{ field.value }}">{{ field.value }}</code></span>
										<# } else if ( 'links' === field.value_type && field.links && field.links.length ) { #><ul class="wpbc_booking_resources__published_pages"><# _.each( field.links, function ( field_link ) { #><li><# if ( field_link.url ) { #><a href="{{ field_link.url }}" target="_blank" rel="noopener noreferrer"><span class="wpbc-bi-box-arrow-up-right" aria-hidden="true"></span>{{ field_link.label }}</a><# } else { #><span>{{ field_link.label }}</span><# } #></li><# } ); #></ul>
										<# } else { #><span>{{ field.value }}</span><# } #>
									</dd>
									<# if ( field.manage_url && field.manage_label ) { #><a class="button button-secondary button-small tooltip_top wpbc_booking_resources__details_edit_link wpbc_booking_resources__details_value_action" href="{{ field.manage_url }}" aria-label="{{ field.manage_label }}" title="{{ field.manage_label }}" data-wpbc-ui-catalog-details-tooltip="1"><span class="wpbc-bi-pencil-square" aria-hidden="true"></span><span class="screen-reader-text">{{ field.manage_label }}</span></a><# } #>
									<# if ( field.help ) { #><p class="wpbc_booking_resources__details_value_help">{{ field.help }}</p><# } #>
								</div>
							<# } ); #>
						</dl><# } #>
						<# if ( section.actions && section.actions.length ) { #><div class="wpbc_booking_resources__details_actions">
							<# _.each( section.actions, function ( action ) { var button_class = 'primary' === action.style ? 'button-primary' : 'button-secondary'; var destructive_class = 'destructive' === action.style ? ' wpbc_booking_resources__details_action--delete' : ''; #>
								<# if ( 'edit' === action.kind ) { #><button type="button" class="button {{ button_class }} wpbc_booking_resources__details_action" data-wpbc-booking-resource-action="edit_resource" data-wpbc-booking-resource-id="{{ data.resource_id }}" data-wpbc-right-sidebar-keep-open="1"><span class="{{ action.icon }}" aria-hidden="true"></span>{{ action.label }}</button>
								<# } else if ( 'capacity' === action.kind ) { #><button type="button" class="button {{ button_class }} wpbc_booking_resources__details_action" data-wpbc-booking-resource-action="adjust_capacity" data-wpbc-booking-resource-id="{{ data.resource_id }}" data-wpbc-right-sidebar-keep-open="1"><span class="{{ action.icon }}" aria-hidden="true"></span>{{ action.label }}</button>
								<# } else if ( 'delete' === action.kind ) { #><button type="button" class="button {{ button_class }} wpbc_booking_resources__details_action{{ destructive_class }}" data-wpbc-booking-resource-action="delete_resource" data-wpbc-booking-resource-id="{{ data.resource_id }}" data-wpbc-right-sidebar-keep-open="1"><span class="{{ action.icon }}" aria-hidden="true"></span>{{ action.label }}</button>
								<# } else if ( 'pending' === action.kind ) { #><button type="button" class="button {{ button_class }} wpbc_booking_resources__details_action{{ destructive_class }}" aria-disabled="true"><span class="{{ action.icon }}" aria-hidden="true"></span>{{ action.label }}</button>
								<# } else if ( 'copy' === action.kind ) { #><button type="button" class="button {{ button_class }} wpbc_booking_resources__details_action" data-wpbc-booking-resource-shortcode-command="copy" data-wpbc-booking-resource-id="{{ data.resource_id }}" data-wpbc-booking-resource-shortcode="{{ action.copy_value }}"><span class="{{ action.icon }}" aria-hidden="true"></span>{{ action.label }}</button>
								<# } else if ( 'customize' === action.kind || 'publish' === action.kind ) { #><button type="button" class="button {{ button_class }} wpbc_booking_resources__details_action" data-wpbc-booking-resource-shortcode-command="{{ action.kind }}" data-wpbc-booking-resource-id="{{ data.resource_id }}" data-wpbc-booking-resource-shortcode="{{ action.copy_value }}"><span class="{{ action.icon }}" aria-hidden="true"></span>{{ action.label }}</button>
								<# } else { #><a class="button {{ button_class }} wpbc_booking_resources__details_action" href="{{ action.url }}" <# if ( action.target ) { #>target="{{ action.target }}" rel="noopener noreferrer"<# } #>><span class="{{ action.icon }}" aria-hidden="true"></span>{{ action.label }}</a><# } #>
							<# } ); #>
						</div><# if ( 'booking_page' === section.id ) { #><p class="wpbc_booking_resources__copy_status" data-wpbc-booking-resource-copy-status="{{ data.resource_id }}" role="status"></p><# } #><# } #>
					</section>
				<# } ); #>
			</div>
		<# } #>
	</div>
</script>

