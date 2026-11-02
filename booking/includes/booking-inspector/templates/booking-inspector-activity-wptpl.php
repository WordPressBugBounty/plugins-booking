<?php
/**
 * Booking Inspector paginated activity panel template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-inspector-activity">
	<section id="{{ data.inspector_id }}_panel_activity" class="wpbc_booking_inspector__panel" role="tabpanel" aria-labelledby="{{ data.inspector_id }}_tab_activity" tabindex="0" data-wpbc-booking-inspector-panel="activity" hidden>
		<section class="wpbc_booking_inspector__card">
			<h4>{{ data.i18n.activity }}</h4>
			<div class="wpbc_booking_inspector__activity_status" role="status" aria-live="polite" data-wpbc-booking-activity-message></div>
			<# if ( data.activity.events.length ) { #>
			<ol class="wpbc_booking_inspector__activity">
				<# _.each( data.activity.events, function ( event ) { #>
				<li>
					<div><strong>{{ event.label }}</strong><time>{{ event.occurred_at }}</time></div>
					<# if ( event.actor_label ) { #><span>{{ event.actor_label }}</span><# } #>
					<# if ( event.description ) { #><p>{{ event.description }}</p><# } #>
					<# if ( event.changes && event.changes.length ) { #>
					<ul class="wpbc_booking_inspector__activity_changes">
						<# _.each( event.changes, function ( change ) { #>
						<li><strong>{{ change.label }}</strong><span>{{ change.description }}</span></li>
						<# } ); #>
					</ul>
					<# } #>
					<# if ( event.changes_notice ) { #><p class="wpbc_booking_inspector__activity_changes_notice">{{ event.changes_notice }}</p><# } #>
				</li>
				<# } ); #>
			</ol>
			<# } else { #>{{{ data.empty_state_html }}}<# } #>
			<# if ( data.activity.pagination && data.activity.pagination.total_pages > 1 ) { #>
			<nav class="wpbc_booking_inspector__pagination" aria-label="{{ data.i18n.activity }}">
				<button type="button" class="button" data-wpbc-booking-activity-page="{{ Number( data.activity.pagination.page ) - 1 }}" <# if ( Number( data.activity.pagination.page ) <= 1 ) { #>disabled<# } #>>{{ data.i18n.previous }}</button>
				<span>{{ data.i18n.page }} {{ data.activity.pagination.page }} {{ data.i18n.of }} {{ data.activity.pagination.total_pages }}</span>
				<button type="button" class="button" data-wpbc-booking-activity-page="{{ Number( data.activity.pagination.page ) + 1 }}" <# if ( Number( data.activity.pagination.page ) >= Number( data.activity.pagination.total_pages ) ) { #>disabled<# } #>>{{ data.i18n.next }}</button>
			</nav>
			<# } #>
		</section>
	</section>
</script>
