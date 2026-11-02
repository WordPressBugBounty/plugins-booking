<?php
/**
 * Booking Date Editor authorized review template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-inspector-date-editor-review">
	<#
	var review = data.review || {};
	var fields = Array.isArray( review.fields ) ? review.fields : [];
	var warnings = Array.isArray( review.warnings ) ? review.warnings : [];
	var i18n = data.i18n || {};
	#>
	<div class="wpbc_booking_inspector__date_editor_review_fields">
		<# fields.forEach( function ( field ) {
			var field_changed = true === field.changed;
			var has_before_parts = Array.isArray( field.before_parts ) && field.before_parts.length;
			var has_after_parts = Array.isArray( field.after_parts ) && field.after_parts.length;
		#>
		<section class="wpbc_booking_inspector__date_editor_review_field">
			<h4>{{ field.label || '' }}</h4>
			<div class="wpbc_booking_inspector__date_editor_review_values">
				<div class="wpbc_booking_inspector__date_editor_review_value">
					<span>
						{{ i18n.previous_value || '' }}
						<# if ( field_changed && ! has_before_parts ) { #><span class="screen-reader-text"> ({{ i18n.changed_value || '' }})</span><# } #>
					</span>
					<# if ( has_before_parts ) { #>
					<strong class="wpbc_booking_inspector__date_editor_review_parts"><# field.before_parts.forEach( function ( field_part ) { #><span class="wpbc_booking_inspector__date_editor_review_part<# if ( true === field_part.changed ) { #> is-previous-changed<# } #>">{{ field_part.text || '' }}<# if ( true === field_part.changed ) { #><span class="screen-reader-text"> ({{ i18n.changed_value || '' }})</span><# } #></span><# } ); #></strong>
					<# } else { #>
					<strong class="<# if ( field_changed ) { #>is-previous-changed<# } #>">{{ field.before || '' }}</strong>
					<# } #>
				</div>
				<span class="wpbc_icn_arrow_forward" aria-hidden="true"></span>
				<div class="wpbc_booking_inspector__date_editor_review_value">
					<span>
						{{ i18n.proposed_value || '' }}
						<# if ( field_changed && ! has_after_parts ) { #><span class="screen-reader-text"> ({{ i18n.changed_value || '' }})</span><# } #>
					</span>
					<# if ( has_after_parts ) { #>
					<strong class="wpbc_booking_inspector__date_editor_review_parts"><# field.after_parts.forEach( function ( field_part ) { #><span class="wpbc_booking_inspector__date_editor_review_part<# if ( true === field_part.changed ) { #> is-changed<# } #>">{{ field_part.text || '' }}<# if ( true === field_part.changed ) { #><span class="screen-reader-text"> ({{ i18n.changed_value || '' }})</span><# } #></span><# } ); #></strong>
					<# } else { #>
					<strong class="<# if ( field_changed ) { #>is-changed<# } #>">{{ field.after || '' }}</strong>
					<# } #>
				</div>
			</div>
		</section>
		<# } ); #>
	</div>
	<# if ( warnings.length ) { #>
	<section class="wpbc_booking_inspector__date_editor_review_warnings">
		<h4>{{ i18n.review_warnings || '' }}</h4>
		<ul>
			<# warnings.forEach( function ( warning ) { #><li>{{ warning }}</li><# } ); #>
		</ul>
	</section>
	<# } #>
</script>
