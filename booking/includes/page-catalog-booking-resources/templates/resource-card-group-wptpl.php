<?php
/**
 * Parent Booking Resource card group template.
 *
 * This presentation-only wrapper composes an already-rendered parent card,
 * its decorative child-card stack, and the accessible child-card tray. The
 * shared hierarchy controller remains responsible for disclosure state.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-card-group">
	<div class="wpbc_booking_resources__card_group<# if ( data.is_expanded ) { #> is-expanded<# } #>" role="presentation" data-wpbc-booking-resource-card-group="{{ data.parent_id }}">
		<div class="wpbc_booking_resources__card_stage" data-wpbc-booking-resource-card-parent-slot>
			<div class="wpbc_booking_resources__card_stack" aria-hidden="true">
				<# _.each( data.stack_items, function ( stack_item, stack_index ) { #>
					<span class="wpbc_booking_resources__card_stack_item wpbc_booking_resources__card_stack_item--{{ stack_index + 1 }}">
						<# if ( stack_item.picture_url ) { #><img src="{{ stack_item.picture_url }}" alt="" loading="lazy" decoding="async"><# } #>
						<span>{{ stack_item.title }}</span>
					</span>
				<# } ); #>
			</div>
		</div>
		<section class="wpbc_booking_resources__children_tray" id="wpbc_booking_resource_children_{{ data.parent_id }}" aria-labelledby="wpbc_booking_resource_children_title_{{ data.parent_id }}" data-wpbc-booking-resource-card-children-panel<# if ( ! data.is_expanded ) { #> hidden<# } #>>
			<header class="wpbc_booking_resources__children_tray_header">
				<span>
					<strong id="wpbc_booking_resource_children_title_{{ data.parent_id }}">{{ data.children_heading }}</strong>
					<small>{{ data.children_description }}</small>
				</span>
				<button type="button" class="wpbc_booking_resources__children_tray_close" data-wpbc-ui-catalog-hierarchy-toggle="{{ data.parent_node_id }}" data-wpbc-ui-catalog-hierarchy-summary-toggle data-collapse-label="{{ data.collapse_label }}" data-expand-label="{{ data.expand_label }}" aria-expanded="true" aria-label="{{ data.collapse_label }}" title="{{ data.collapse_label }}">
					<span class="wpbc-bi-x-lg" aria-hidden="true"></span>
				</button>
			</header>
			<div class="wpbc_booking_resources__children_tray_cards" role="list" data-wpbc-booking-resource-card-children-slot></div>
		</section>
	</div>
</script>
