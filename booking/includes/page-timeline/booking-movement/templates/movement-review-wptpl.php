<?php
/**
 * Timeline booking-movement review template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-booking-movement-review">
	<section
		class="wpbc_shared_ui_inspector__panel wpbc_booking_inspector__date_editor_layer wpbc_timeline_booking_movement__review"
		role="dialog"
		aria-modal="true"
		aria-labelledby="wpbc-timeline-booking-movement-review-title"
		aria-describedby="wpbc-timeline-booking-movement-review-status"
		tabindex="-1"
		data-wpbc-timeline-booking-movement-review
	>
		<header class="wpbc_shared_ui_inspector__header wpbc_booking_inspector__date_editor_header wpbc_timeline_booking_movement__review_header">
			<div class="wpbc_shared_ui_inspector__header_content wpbc_booking_inspector__date_editor_heading">
				<h2 id="wpbc-timeline-booking-movement-review-title" class="wpbc_shared_ui_inspector__heading">{{ data.title }}</h2>
			</div>
		</header>

		<div class="wpbc_booking_inspector__date_editor_view wpbc_timeline_booking_movement__review_view">
			<div class="wpbc_booking_inspector__date_editor_body wpbc_timeline_booking_movement__review_body">
				<div class="wpbc_timeline_booking_movement__review_status" role="status" <# if ( data.is_busy ) { #>aria-busy="true"<# } #>>
					<# if ( data.is_busy ) { #><span class="wpbc_timeline_booking_movement__review_spinner" aria-hidden="true"></span><# } #>
					<p id="wpbc-timeline-booking-movement-review-status">{{ data.status }}</p>
				</div>
				<div class="wpbc_booking_inspector__date_editor_review wpbc_timeline_booking_movement__canonical_review" data-wpbc-timeline-booking-movement-canonical-review>{{{ data.review_html }}}</div>
			</div>
			<footer class="wpbc_booking_inspector__date_editor_footer wpbc_timeline_booking_movement__review_actions">
				<# if ( data.can_cancel ) { #>
				<button type="button" class="button button-secondary" data-wpbc-timeline-booking-movement-review-close>{{ data.cancel_label }}</button>
				<# } #>
				<# if ( data.can_apply ) { #>
				<button type="button" class="button button-primary" data-wpbc-timeline-booking-movement-apply>{{ data.apply_label }}</button>
				<# } #>
				<# if ( data.can_retry_refresh ) { #>
				<button type="button" class="button button-primary" data-wpbc-timeline-booking-movement-retry-refresh>{{ data.retry_refresh_label }}</button>
				<# } #>
			</footer>
		</div>
	</section>
</script>
