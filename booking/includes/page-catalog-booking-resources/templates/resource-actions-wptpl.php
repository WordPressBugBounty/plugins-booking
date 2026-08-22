<?php
/**
 * Booking Resource action-menu template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-actions">
	<# if ( data.actions.length ) { #>
		<div class="wpbc_ui_listing__actions wpbc_catalog_booking_resources__action_menu" data-wpbc-ui-catalog-action-menu data-wpbc-ui-catalog-action-item="{{ data.resource_id }}">
			<button type="button" class="wpbc_ui_listing__actions_toggle" aria-haspopup="menu" aria-expanded="false" aria-controls="{{ data.menu_id }}" aria-label="{{ data.aria_label }}" data-wpbc-ui-catalog-action-toggle>
				<span class="wpbc-bi-three-dots-vertical" aria-hidden="true"></span>
				<span class="screen-reader-text">{{ data.aria_label }}</span>
			</button>
			<ul id="{{ data.menu_id }}" class="wpbc_ui_listing__actions_menu" role="menu" aria-label="{{ data.aria_label }}" data-wpbc-ui-catalog-action-menu-list hidden>
				<# _.each( data.actions, function ( action ) { #>
					<li role="none">
						<button type="button" role="menuitem" tabindex="-1" class="wpbc_catalog_booking_resources__action {{ action.class_name }}" data-wpbc-booking-resource-action="{{ action.id }}" data-wpbc-booking-resource-id="{{ data.resource_id }}"<# if ( action.keep_sidebar_open ) { #> data-wpbc-right-sidebar-keep-open="1"<# } #>>
							<span>{{ action.label }}</span>
							<span class="{{ action.icon }}" aria-hidden="true"></span>
						</button>
					</li>
				<# } ); #>
			</ul>
		</div>
	<# } else { #>
		<span class="screen-reader-text">{{ data.empty_label }}</span><span aria-hidden="true">&mdash;</span>
	<# } #>
</script>
