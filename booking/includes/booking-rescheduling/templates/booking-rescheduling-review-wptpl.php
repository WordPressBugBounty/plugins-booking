<?php
/**
 * Booking Rescheduling review WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-rescheduling-review">
	<#
	var resources = data.resources || {};
	var dates = data.dates || {};
	var times = data.times || {};
	var duration = data.duration || {};
	var quantity = data.quantity || {};
	var availability = data.availability || {};
	var implications = Array.isArray( data.implications ) ? data.implications : [];
	var warnings = Array.isArray( data.warnings ) ? data.warnings : [];
	var existing_dates = Array.isArray( dates.existing ) ? dates.existing : [];
	var proposed_dates = Array.isArray( dates.proposed ) ? dates.proposed : [];
	var added_dates = Array.isArray( dates.added ) ? dates.added : [];
	var removed_dates = Array.isArray( dates.removed ) ? dates.removed : [];
	var allocation_by_date = Array.isArray( quantity.allocation_by_date ) ? quantity.allocation_by_date : [];
	var resource_changed = true === resources.resource_changed;
	var allocation_changed = true === resources.allocation_changed;
	var duration_changed = Number( duration.difference_minutes || 0 ) !== 0;
	#>
	<section class="wpbc_booking_rescheduling__review" aria-labelledby="wpbc_booking_rescheduling_review_title_{{ data.booking_id }}">
		<h3 id="wpbc_booking_rescheduling_review_title_{{ data.booking_id }}"><?php esc_html_e( 'Review booking schedule changes', 'booking' ); ?></h3>
		<div class="wpbc_booking_inspector__date_editor_review_fields wpbc_booking_rescheduling__review_fields">
			<section class="wpbc_booking_inspector__date_editor_review_field">
				<h4><?php esc_html_e( 'Booking Resource', 'booking' ); ?></h4>
				<div class="wpbc_booking_inspector__date_editor_review_values">
					<div class="wpbc_booking_inspector__date_editor_review_value">
						<span><?php esc_html_e( 'Previous', 'booking' ); ?><# if ( resource_changed ) { #><span class="screen-reader-text"> (<?php esc_html_e( 'Changed value', 'booking' ); ?>)</span><# } #></span>
						<strong class="<# if ( resource_changed ) { #>is-previous-changed<# } #>">{{ resources.existing && resources.existing.label ? resources.existing.label : '' }}</strong>
					</div>
					<span class="wpbc_icn_arrow_forward" aria-hidden="true"></span>
					<div class="wpbc_booking_inspector__date_editor_review_value">
						<span><?php esc_html_e( 'Proposed', 'booking' ); ?><# if ( resource_changed ) { #><span class="screen-reader-text"> (<?php esc_html_e( 'Changed value', 'booking' ); ?>)</span><# } #></span>
						<strong class="<# if ( resource_changed ) { #>is-changed<# } #>">{{ resources.proposed_target && resources.proposed_target.label ? resources.proposed_target.label : '' }}</strong>
					</div>
				</div>
			</section>

			<section class="wpbc_booking_inspector__date_editor_review_field">
				<h4><?php esc_html_e( 'Primary allocation', 'booking' ); ?></h4>
				<div class="wpbc_booking_inspector__date_editor_review_values">
					<div class="wpbc_booking_inspector__date_editor_review_value">
						<span><?php esc_html_e( 'Previous', 'booking' ); ?><# if ( allocation_changed ) { #><span class="screen-reader-text"> (<?php esc_html_e( 'Changed value', 'booking' ); ?>)</span><# } #></span>
						<strong class="<# if ( allocation_changed ) { #>is-previous-changed<# } #>">{{ resources.existing && resources.existing.label ? resources.existing.label : '' }}</strong>
					</div>
					<span class="wpbc_icn_arrow_forward" aria-hidden="true"></span>
					<div class="wpbc_booking_inspector__date_editor_review_value">
						<span><?php esc_html_e( 'Proposed', 'booking' ); ?><# if ( allocation_changed ) { #><span class="screen-reader-text"> (<?php esc_html_e( 'Changed value', 'booking' ); ?>)</span><# } #></span>
						<strong class="<# if ( allocation_changed ) { #>is-changed<# } #>">{{ resources.proposed_primary && resources.proposed_primary.label ? resources.proposed_primary.label : '' }}</strong>
					</div>
				</div>
			</section>

			<section class="wpbc_booking_inspector__date_editor_review_field">
				<h4><?php esc_html_e( 'Dates', 'booking' ); ?></h4>
				<div class="wpbc_booking_inspector__date_editor_review_values wpbc_booking_rescheduling__review_date_values">
					<div class="wpbc_booking_inspector__date_editor_review_value">
						<span><?php esc_html_e( 'Previous', 'booking' ); ?></span>
						<ul class="wpbc_booking_rescheduling__review_date_list"><# existing_dates.forEach( function ( booking_date ) { var removed = -1 !== removed_dates.indexOf( booking_date ); #><li class="<# if ( removed ) { #>is-previous-changed<# } #>">{{ booking_date }}<# if ( removed ) { #><span class="screen-reader-text"> (<?php esc_html_e( 'Removed', 'booking' ); ?>)</span><# } #></li><# } ); #></ul>
					</div>
					<span class="wpbc_icn_arrow_forward" aria-hidden="true"></span>
					<div class="wpbc_booking_inspector__date_editor_review_value">
						<span><?php esc_html_e( 'Proposed', 'booking' ); ?></span>
						<ul class="wpbc_booking_rescheduling__review_date_list"><# proposed_dates.forEach( function ( booking_date ) { var added = -1 !== added_dates.indexOf( booking_date ); #><li class="<# if ( added ) { #>is-changed<# } #>">{{ booking_date }}<# if ( added ) { #><span class="screen-reader-text"> (<?php esc_html_e( 'Added', 'booking' ); ?>)</span><# } #></li><# } ); #></ul>
					</div>
				</div>
			</section>

			<# [
				{ label: '<?php echo esc_js( __( 'Start time', 'booking' ) ); ?>', before: times.existing_start || '', after: times.proposed_start || '', changed: true === times.start_changed },
				{ label: '<?php echo esc_js( __( 'End time', 'booking' ) ); ?>', before: times.existing_end || '', after: times.proposed_end || '', changed: true === times.end_changed },
				{ label: '<?php echo esc_js( __( 'Duration', 'booking' ) ); ?>', before: duration.existing_label || '', after: duration.proposed_label || '', changed: duration_changed, show_difference: true },
				{ label: '<?php echo esc_js( __( 'Quantity', 'booking' ) ); ?>', before: String( quantity.existing || 0 ), after: String( quantity.proposed || 0 ), changed: Number( quantity.existing || 0 ) !== Number( quantity.proposed || 0 ) }
			].forEach( function ( field ) { #>
			<section class="wpbc_booking_inspector__date_editor_review_field">
				<h4>{{ field.label }}</h4>
				<div class="wpbc_booking_inspector__date_editor_review_values">
					<div class="wpbc_booking_inspector__date_editor_review_value"><span><?php esc_html_e( 'Previous', 'booking' ); ?><# if ( field.changed ) { #><span class="screen-reader-text"> (<?php esc_html_e( 'Changed value', 'booking' ); ?>)</span><# } #></span><strong class="<# if ( field.changed ) { #>is-previous-changed<# } #>">{{ field.before }}</strong></div>
					<span class="wpbc_icn_arrow_forward" aria-hidden="true"></span>
					<div class="wpbc_booking_inspector__date_editor_review_value"><span><?php esc_html_e( 'Proposed', 'booking' ); ?><# if ( field.changed ) { #><span class="screen-reader-text"> (<?php esc_html_e( 'Changed value', 'booking' ); ?>)</span><# } #></span><strong class="<# if ( field.changed ) { #>is-changed<# } #>">{{ field.after }}</strong></div>
				</div>
				<# if ( true === field.show_difference ) { #><p class="description"><?php esc_html_e( 'Difference:', 'booking' ); ?> {{ duration.difference_label || '' }}</p><# } #>
			</section>
			<# } ); #>
		</div>

		<div class="wpbc_booking_rescheduling__allocation">
			<h4><?php esc_html_e( 'Availability and capacity', 'booking' ); ?></h4>
			<dl class="wpbc_booking_rescheduling__status_list">
				<div><dt><?php esc_html_e( 'Availability', 'booking' ); ?></dt><dd>{{ availability.available_label || '' }}</dd></div>
				<div><dt><?php esc_html_e( 'Capacity', 'booking' ); ?></dt><dd>{{ availability.capacity_label || '' }}</dd></div>
			</dl>
			<# if ( allocation_by_date.length ) { #><ul class="wpbc_booking_rescheduling__allocation_list"><# allocation_by_date.forEach( function ( allocation ) { #><li><span>{{ allocation.date }}</span><strong>{{ allocation.count }}</strong></li><# } ); #></ul><# } #>
		</div>
		<section class="wpbc_booking_rescheduling__implications">
			<h4><?php esc_html_e( 'Rule implications', 'booking' ); ?></h4>
			<ul><# implications.forEach( function ( implication ) { #><li><strong>{{ implication.label }}:</strong> {{ implication.detail }}</li><# } ); #></ul>
		</section>
		<# if ( warnings.length ) { #>
		<section class="wpbc_booking_inspector__date_editor_review_warnings wpbc_booking_rescheduling__warnings">
			<h4><?php esc_html_e( 'Review notes', 'booking' ); ?></h4>
			<ul><# warnings.forEach( function ( warning ) { #><li>{{ warning }}</li><# } ); #></ul>
		</section>
		<# } #>
	</section>
</script>
