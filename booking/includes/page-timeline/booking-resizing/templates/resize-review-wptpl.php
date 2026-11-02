<?php
/**
 * Timeline booking-resizing review-panel template.
 *
 * The template projects only controller-normalized fields from the authorized
 * canonical Review and Apply DTOs held only in controller memory.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-<?php echo esc_attr( WPBC_Timeline_Booking_Resizing_Config::TEMPLATE_REVIEW ); ?>">
	<#
	var resize_impact = data.resize_impact || {};
	var period_comparison = resize_impact.period_comparison || {};
	var before_parts = Array.isArray( period_comparison.before_parts ) ? period_comparison.before_parts : [];
	var after_parts = Array.isArray( period_comparison.after_parts ) ? period_comparison.after_parts : [];
	var has_primary_action = 'ready' === data.state
		|| ( 'error' === data.state && data.show_fallback )
		|| 'refresh_error' === data.state;
	var has_actions = has_primary_action || false !== data.can_cancel;
	#>
	<div class="wpbc_timeline_booking_resize__review wpbc_timeline_booking_resize__review--{{ data.state }}" role="dialog" aria-modal="false" aria-label="{{ data.title }}" data-wpbc-timeline-booking-resize-review>
		<div class="wpbc_timeline_booking_resize__review_summary">
			<# if ( 'busy' === data.state ) { #>
				<span class="wpbc_timeline_booking_resize__review_spinner" aria-hidden="true"></span>
				<strong>{{ data.message }}</strong>
			<# } else if ( 'error' === data.state || 'refresh_error' === data.state ) { #>
				<strong>{{ data.title }}</strong>
				<span class="wpbc_timeline_booking_resize__review_error" role="alert">{{ data.message }}</span>
			<# } else if ( resize_impact.title ) { #>
				<strong>{{ resize_impact.title }}</strong>
				<# if ( before_parts.length && after_parts.length ) { #>
					<span class="wpbc_timeline_booking_resize__review_period_comparison">
						<span class="wpbc_timeline_booking_resize__review_period">
							<span class="wpbc_timeline_booking_resize__review_period_label">{{ period_comparison.previous_label || '' }}</span>
							<strong class="wpbc_timeline_booking_resize__review_period_parts"><# before_parts.forEach( function ( period_part ) { #><span class="wpbc_timeline_booking_resize__review_period_part<# if ( true === period_part.changed ) { #> is-previous-changed<# } #>">{{ period_part.text || '' }}<# if ( true === period_part.changed ) { #><span class="screen-reader-text"> ({{ period_comparison.changed_label || '' }})</span><# } #></span><# } ); #></strong>
						</span>
						<span class="wpbc_timeline_booking_resize__review_period_transition">
							<span class="wpbc_icn_arrow_forward" aria-hidden="true"></span>
							<span class="wpbc_timeline_booking_resize__review_period">
								<span class="wpbc_timeline_booking_resize__review_period_label">{{ period_comparison.proposed_label || '' }}</span>
								<strong class="wpbc_timeline_booking_resize__review_period_parts"><# after_parts.forEach( function ( period_part ) { #><span class="wpbc_timeline_booking_resize__review_period_part<# if ( true === period_part.changed ) { #> is-changed<# } #>">{{ period_part.text || '' }}<# if ( true === period_part.changed ) { #><span class="screen-reader-text"> ({{ period_comparison.changed_label || '' }})</span><# } #></span><# } ); #></strong>
							</span>
						</span>
					</span>
				<# } else if ( resize_impact.boundary_description ) { #><span>{{ resize_impact.boundary_description }}</span><# } #>
				<# if ( resize_impact.dates_description ) { #><span>{{ resize_impact.dates_description }}</span><# } #>
				<# if ( resize_impact.duration_description ) { #><span>{{ resize_impact.duration_description }}</span><# } #>
			<# } else { #>
				<strong>{{ data.title }}</strong>
				<span>{{ data.interval_description }}</span>
				<span>{{ data.duration_description }}</span>
			<# } #>
		</div>
		<# if ( has_actions ) { #>
		<div class="wpbc_timeline_booking_resize__review_actions">
			<# if ( 'ready' === data.state ) { #>
				<button type="button" class="button button-primary" data-wpbc-timeline-booking-resize-apply aria-disabled="false">{{ data.apply_label }}</button>
			<# } else if ( 'error' === data.state && data.show_fallback ) { #>
				<button type="button" class="button" data-wpbc-timeline-booking-resize-fallback>{{ data.fallback_label }}</button>
			<# } else if ( 'refresh_error' === data.state ) { #>
				<button type="button" class="button button-primary" data-wpbc-timeline-booking-resize-retry-refresh>{{ data.retry_refresh_label }}</button>
			<# } #>
			<# if ( false !== data.can_cancel ) { #>
				<button type="button" class="button" data-wpbc-timeline-booking-resize-cancel>{{ data.cancel_label }}</button>
			<# } #>
		</div>
		<# } #>
	</div>
</script>
