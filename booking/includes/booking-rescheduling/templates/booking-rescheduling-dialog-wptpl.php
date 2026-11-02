<?php
/**
 * Accessible Booking Rescheduling dialog template.
 *
 * The template renders only the authorized initialization DTO and local draft
 * controls. Native calendar behavior, review, and persistence remain owned by
 * their respective adapters and server services.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-rescheduling-dialog">
	<#
	var inspector_id = String( data.inspector_id || 'wpbc_booking_inspector' ).replace( /[^A-Za-z0-9_-]/g, '' );
	var i18n = data.i18n || {};
	var resources = data.resources || [];
	var selected_dates = data.selected_dates || [];
	var title_id = inspector_id + '_rescheduling_title';
	var resource_title_id = inspector_id + '_rescheduling_resource_title';
	var selection_title_id = inspector_id + '_rescheduling_selection_title';
	var time_title_id = inspector_id + '_rescheduling_time_title';
	var editor_view_id = inspector_id + '_rescheduling_editor_view';
	var review_view_id = inspector_id + '_rescheduling_review_view';
	#>
	<section
		class="wpbc_booking_inspector__date_editor_layer wpbc_booking_rescheduling__layer"
		data-wpbc-booking-rescheduling-layer
		role="dialog"
		aria-modal="true"
		aria-labelledby="{{ title_id }}"
		tabindex="-1"
	>
		<header class="wpbc_shared_ui_inspector__header wpbc_booking_inspector__date_editor_header">
			<div class="wpbc_shared_ui_inspector__header_content wpbc_booking_inspector__date_editor_heading">
				<h3 id="{{ title_id }}" class="wpbc_shared_ui_inspector__heading">{{ i18n.title }}</h3>
			</div>
			<button type="button" class="wpbc_shared_ui_inspector__close" data-wpbc-booking-rescheduling-close aria-label="{{ i18n.close }}">
				<span class="wpbc-bi-x-lg" aria-hidden="true"></span>
			</button>
		</header>

		<div class="wpbc_shared_ui_inspector__status wpbc_booking_inspector__date_editor_status" data-wpbc-booking-rescheduling-status role="status" aria-live="polite" aria-atomic="true"></div>
		<div class="wpbc_shared_ui_inspector__loading wpbc_booking_inspector__date_editor_loading wpbc_spins_loading_container" data-wpbc-booking-rescheduling-loading hidden>
			<div class="wpbc_booking_form_spin_loader" aria-hidden="true"><div class="wpbc_spins_loader_wrapper"><div class="wpbc_one_spin_loader_mini2"></div></div></div>
			<span data-wpbc-booking-rescheduling-loading-label>{{ i18n.loading }}</span>
		</div>
		<div class="wpbc_shared_ui_inspector__error wpbc_booking_inspector__date_editor_error notice inline notice-error" data-wpbc-booking-rescheduling-error role="alert" hidden>
			<p data-wpbc-booking-rescheduling-error-message></p>
			<div class="wpbc_booking_inspector__date_editor_error_actions">
				<button type="button" class="button button-secondary" data-wpbc-booking-rescheduling-retry>{{ i18n.retry }}</button>
			</div>
		</div>

		<div id="{{ editor_view_id }}" class="wpbc_booking_inspector__date_editor_view" data-wpbc-booking-rescheduling-view="editor">
			<div class="wpbc_booking_inspector__date_editor_body">
				<section class="wpbc_booking_inspector__date_editor_fieldset wpbc_booking_rescheduling__resource_section" aria-labelledby="{{ resource_title_id }}">
					<h4 id="{{ resource_title_id }}">{{ i18n.booking_resource }}</h4>
					<label class="wpbc_booking_rescheduling__resource_control">
						<span class="screen-reader-text">{{ i18n.booking_resource }}</span>
						<select data-wpbc-booking-rescheduling-resource <# if ( resources.length < 2 ) { #>disabled<# } #>>
							<# resources.forEach( function ( resource ) { #>
							<option value="{{ resource.value }}" <# if ( Number( resource.value ) === Number( data.target_resource_id ) ) { #>selected<# } #>>{{ resource.label }}</option>
							<# } ); #>
						</select>
					</label>
					<p class="description">{{ i18n.resource_help }}</p>
				</section>

				<section class="wpbc_booking_inspector__date_editor_fieldset" role="group" aria-labelledby="{{ selection_title_id }}">
					<h4 id="{{ selection_title_id }}">{{ i18n.selection_method }}</h4>
					<div class="wpbc_booking_inspector__date_editor_choices">
						<label><input type="radio" name="{{ inspector_id }}_rescheduling_selection" value="policy" data-wpbc-booking-rescheduling-selection-method <# if ( 'individual' !== data.selection_method ) { #>checked<# } #>><span>{{ i18n.use_current_booking_rules }}</span></label>
						<label><input type="radio" name="{{ inspector_id }}_rescheduling_selection" value="individual" data-wpbc-booking-rescheduling-selection-method <# if ( 'individual' === data.selection_method ) { #>checked<# } #>><span>{{ i18n.select_dates_individually }}</span></label>
					</div>
				</section>

				<div class="wpbc_booking_inspector__date_editor_calendar_row">
					<section class="wpbc_booking_inspector__date_editor_calendar booking_form_div" id="booking_form_div{{ data.target_resource_id }}" data-wpbc-calendar-interactive="1" aria-labelledby="{{ inspector_id }}_rescheduling_calendar_title">
						<h4 id="{{ inspector_id }}_rescheduling_calendar_title">{{ i18n.select_dates }}</h4>
						<div class="wpbc_booking_inspector__date_editor_calendar_host" data-wpbc-booking-rescheduling-calendar-host aria-busy="false"></div>
					</section>
					<section class="wpbc_booking_inspector__date_editor_summary" aria-labelledby="{{ inspector_id }}_rescheduling_dates_title">
						<h4 id="{{ inspector_id }}_rescheduling_dates_title">{{ i18n.selected_dates }}</h4>
						<ol class="wpbc_booking_inspector__date_editor_selected_dates" data-wpbc-booking-rescheduling-selected-dates>
							<# if ( ! selected_dates.length ) { #><li class="wpbc_booking_inspector__muted">{{ i18n.no_selected_dates }}</li><# } #>
							<# selected_dates.forEach( function ( selected_date ) { #><li>{{ selected_date }}</li><# } ); #>
						</ol>
					</section>
				</div>

				<section class="wpbc_booking_inspector__date_editor_fieldset" role="group" aria-labelledby="{{ time_title_id }}">
					<h4 id="{{ time_title_id }}">{{ i18n.apply_times_as }}</h4>
					<div class="wpbc_booking_inspector__date_editor_choices">
						<label><input type="radio" name="{{ inspector_id }}_rescheduling_time" value="full_day" data-wpbc-booking-rescheduling-time-application <# if ( 'full_day' === data.time_application ) { #>checked<# } #>><span>{{ i18n.full_days }}</span></label>
						<label><input type="radio" name="{{ inspector_id }}_rescheduling_time" value="boundary" data-wpbc-booking-rescheduling-time-application <# if ( 'boundary' === data.time_application ) { #>checked<# } #>><span>{{ i18n.boundary_times }}</span></label>
						<label><input type="radio" name="{{ inspector_id }}_rescheduling_time" value="per_date" data-wpbc-booking-rescheduling-time-application <# if ( 'per_date' === data.time_application ) { #>checked<# } #>><span>{{ i18n.same_time_each_date }}</span></label>
					</div>
					<div class="wpbc_booking_inspector__date_editor_time_fields" data-wpbc-booking-rescheduling-time-fields <# if ( 'full_day' === data.time_application ) { #>hidden<# } #>>
						<label><span>{{ i18n.start_time }}</span><input type="time" step="60" value="{{ data.start_time || '' }}" data-wpbc-booking-rescheduling-time="start_time"></label>
						<label><span>{{ i18n.end_time }}</span><input type="time" step="60" value="{{ data.end_time || '' }}" data-wpbc-booking-rescheduling-time="end_time"></label>
					</div>
				</section>
			</div>
			<footer class="wpbc_booking_inspector__date_editor_footer">
				<button type="button" class="button button-secondary" data-wpbc-booking-rescheduling-reset>{{ i18n.reset }}</button>
				<button type="button" class="button button-primary" data-wpbc-booking-rescheduling-review aria-controls="{{ review_view_id }}" aria-disabled="true" disabled>{{ i18n.review_changes }}</button>
			</footer>
		</div>

		<div id="{{ review_view_id }}" class="wpbc_booking_inspector__date_editor_view" data-wpbc-booking-rescheduling-view="review" hidden>
			<div class="wpbc_booking_inspector__date_editor_body">
				<div class="wpbc_booking_inspector__date_editor_review" data-wpbc-booking-rescheduling-review-content></div>
			</div>
			<footer class="wpbc_booking_inspector__date_editor_footer">
				<button type="button" class="button button-secondary" data-wpbc-booking-rescheduling-back aria-controls="{{ editor_view_id }}">{{ i18n.back }}</button>
				<button type="button" class="button button-primary" data-wpbc-booking-rescheduling-apply aria-disabled="true" disabled>{{ i18n.apply_changes }}</button>
			</footer>
		</div>
	</section>
</script>
