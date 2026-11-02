<?php
/**
 * Booking Date Editor interaction-contract template.
 *
 * This template owns the accessible Date Editor layer and its browser-draft
 * controls. It renders only values supplied by the authorized Date Editor read
 * service; signed review and persistence remain server-owned boundaries.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-inspector-date-editor">
	<#
	var inspector_id = String( data.inspector_id || 'wpbc_booking_inspector' ).replace( /[^A-Za-z0-9_-]/g, '' );
	var selection_method = 'individual' === data.selection_method ? 'individual' : 'policy';
	var allowed_time_applications = [ 'full_day', 'boundary', 'per_date' ];
	var time_application = -1 !== allowed_time_applications.indexOf( data.time_application ) ? data.time_application : 'full_day';
	var selected_dates = Array.isArray( data.selected_dates ) ? data.selected_dates : [];
	var summary = data.selected_summary || {};
	var i18n = data.i18n || {};
	var title_id = inspector_id + '_date_editor_title';
	var guidance_id = inspector_id + '_date_editor_guidance';
	var selection_help_id = inspector_id + '_date_editor_selection_help';
	var time_help_id = inspector_id + '_date_editor_time_help';
	var editor_view_id = inspector_id + '_date_editor_view';
	var review_view_id = inspector_id + '_date_review_view';
	#>
	<section
		class="wpbc_booking_inspector__date_editor_layer"
		data-wpbc-booking-date-editor-layer
		aria-labelledby="{{ title_id }}"
		aria-describedby="{{ guidance_id }}"
		tabindex="-1"
		hidden
	>
		<header class="wpbc_shared_ui_inspector__header wpbc_booking_inspector__date_editor_header">
			<div class="wpbc_shared_ui_inspector__header_content wpbc_booking_inspector__date_editor_heading">
				<h3 id="{{ title_id }}" class="wpbc_shared_ui_inspector__heading">{{ i18n.change_dates_title }}</h3>
				<p id="{{ guidance_id }}">{{ i18n.date_editor_guidance }}</p>
			</div>
			<button
				type="button"
				class="wpbc_shared_ui_inspector__close wpbc_booking_inspector__date_editor_close"
				data-wpbc-booking-date-editor-close
				aria-label="{{ i18n.close_date_editor }}"
			>
				<span class="wpbc-bi-x-lg" aria-hidden="true"></span>
			</button>
		</header>

		<div
			class="wpbc_shared_ui_inspector__status wpbc_booking_inspector__date_editor_status"
			data-wpbc-booking-date-editor-status
			role="status"
			aria-live="polite"
			aria-atomic="true"
		></div>
		<div
			class="wpbc_shared_ui_inspector__loading wpbc_booking_inspector__date_editor_loading wpbc_spins_loading_container"
			data-wpbc-booking-date-editor-loading
			hidden
		>
			<div class="wpbc_booking_form_spin_loader" aria-hidden="true"><div class="wpbc_spins_loader_wrapper"><div class="wpbc_one_spin_loader_mini2"></div></div></div>
			<span data-wpbc-booking-date-editor-loading-label>{{ i18n.loading_dates }}</span>
		</div>
		<div class="wpbc_shared_ui_inspector__error wpbc_booking_inspector__date_editor_error notice inline notice-error" data-wpbc-booking-date-editor-error role="alert" hidden>
			<p data-wpbc-booking-date-editor-error-message></p>
			<div class="wpbc_booking_inspector__date_editor_error_actions">
				<button type="button" class="button button-secondary" data-wpbc-booking-date-editor-retry>{{ i18n.retry }}</button>
				<a class="button button-secondary" data-wpbc-booking-date-editor-fallback href="{{ data.fallback && data.fallback.url ? data.fallback.url : '' }}" <# if ( ! data.fallback || ! data.fallback.url ) { #>hidden<# } #>>{{ data.fallback && data.fallback.label ? data.fallback.label : i18n.edit_in_add_booking }}</a>
			</div>
		</div>

		<div id="{{ editor_view_id }}" class="wpbc_booking_inspector__date_editor_view" data-wpbc-booking-date-editor-view="editor">
			<div class="wpbc_booking_inspector__date_editor_body">
				<fieldset class="wpbc_booking_inspector__date_editor_fieldset" aria-describedby="{{ selection_help_id }}">
					<strong>{{ i18n.selection_method }}</strong>
					<div class="wpbc_booking_inspector__date_editor_choices wpbc_booking_inspector__date_editor_choices--selection">
						<label>
							<input
								type="radio"
								name="{{ inspector_id }}_date_selection_method"
								value="policy"
								data-wpbc-booking-date-editor-selection-method
								<# if ( 'policy' === selection_method ) { #>checked<# } #>
							>
							<span>{{ i18n.use_current_booking_rules }}</span>
						</label>
						<label>
							<input
								type="radio"
								name="{{ inspector_id }}_date_selection_method"
								value="individual"
								data-wpbc-booking-date-editor-selection-method
								<# if ( 'individual' === selection_method ) { #>checked<# } #>
							>
							<span>{{ i18n.select_dates_individually }}</span>
						</label>
					</div>
					<p id="{{ selection_help_id }}" class="description wpbc_booking_inspector__date_editor_help">{{ i18n.individual_selection_help }}</p>
				</fieldset>

				<div class="wpbc_booking_inspector__date_editor_calendar_row">
					<section class="wpbc_booking_inspector__date_editor_calendar booking_form_div" <# if ( data.resource_id ) { #>id="booking_form_div{{ data.resource_id }}"<# } #> data-wpbc-calendar-interactive="1" aria-labelledby="{{ inspector_id }}_date_editor_calendar_title">
						<h4 id="{{ inspector_id }}_date_editor_calendar_title">{{ i18n.select_dates }}</h4>
						<div
							class="wpbc_booking_inspector__date_editor_calendar_host"
							data-wpbc-booking-date-editor-calendar-host
							aria-busy="false"
						></div>
					</section>

					<section class="wpbc_booking_inspector__date_editor_summary" aria-labelledby="{{ inspector_id }}_date_editor_summary_title">
						<h4 id="{{ inspector_id }}_date_editor_summary_title">{{ i18n.selected_dates }}</h4>
						<dl>
							<div><dt>{{ i18n.selected_dates }}</dt><dd><output data-wpbc-booking-date-editor-summary="selected_dates">{{ summary.selected_dates || selected_dates.length }}</output></dd></div>
							<div><dt>{{ i18n.calendar_days }}</dt><dd><output data-wpbc-booking-date-editor-summary="calendar_days">{{ summary.calendar_days || selected_dates.length }}</output></dd></div>
							<div><dt>{{ i18n.nights }}</dt><dd><output data-wpbc-booking-date-editor-summary="nights">{{ summary.nights || 0 }}</output></dd></div>
							<div><dt>{{ i18n.time }}</dt><dd><output data-wpbc-booking-date-editor-summary="time">{{ summary.time_label || i18n.full_days }}</output></dd></div>
						</dl>
						<ol class="wpbc_booking_inspector__date_editor_selected_dates" data-wpbc-booking-date-editor-selected-dates>
							<# if ( ! selected_dates.length ) { #>
							<li class="wpbc_booking_inspector__muted" data-wpbc-booking-date-editor-no-selected-dates>{{ i18n.no_selected_dates }}</li>
							<# } #>
							<# selected_dates.forEach( function ( selected_date ) { #>
							<li>{{ selected_date }}</li>
							<# } ); #>
						</ol>
					</section>
				</div>

				<fieldset class="wpbc_booking_inspector__date_editor_fieldset" aria-describedby="{{ time_help_id }}">
					<strong>{{ i18n.apply_times_as }}</strong>
					<div class="wpbc_booking_inspector__date_editor_choices wpbc_booking_inspector__date_editor_choices--time">
						<label>
							<input
								type="radio"
								name="{{ inspector_id }}_date_time_application"
								value="full_day"
								data-wpbc-booking-date-editor-time-application
								<# if ( 'full_day' === time_application ) { #>checked<# } #>
							>
							<span>{{ i18n.full_days }}</span>
						</label>
						<label>
							<input
								type="radio"
								name="{{ inspector_id }}_date_time_application"
								value="boundary"
								data-wpbc-booking-date-editor-time-application
								<# if ( 'boundary' === time_application ) { #>checked<# } #>
							>
							<span>{{ i18n.boundary_times }}</span>
						</label>
						<label>
							<input
								type="radio"
								name="{{ inspector_id }}_date_time_application"
								value="per_date"
								data-wpbc-booking-date-editor-time-application
								<# if ( 'per_date' === time_application ) { #>checked<# } #>
							>
							<span>{{ i18n.same_time_each_date }}</span>
						</label>
					</div>
					<p
						id="{{ time_help_id }}"
						class="description wpbc_booking_inspector__date_editor_help"
						data-wpbc-booking-date-editor-time-help
						<# if ( 'per_date' !== time_application ) { #>hidden<# } #>
					>{{ i18n.same_interval_each_date }}</p>
					<div
						class="wpbc_booking_inspector__date_editor_time_fields"
						data-wpbc-booking-date-editor-time-fields
						<# if ( 'full_day' === time_application ) { #>hidden<# } #>
					>
						<label>
							<span>{{ i18n.start_time }}</span>
							<input type="time" step="60" value="{{ data.start_time || '' }}" data-wpbc-booking-date-editor-time="start_time">
						</label>
						<label>
							<span>{{ i18n.end_time }}</span>
							<input type="time" step="60" value="{{ data.end_time || '' }}" data-wpbc-booking-date-editor-time="end_time">
						</label>
					</div>
				</fieldset>

			</div>

			<footer class="wpbc_booking_inspector__date_editor_footer">
				<button type="button" class="button button-secondary" data-wpbc-booking-date-editor-reset>{{ i18n.reset_days_selection }}</button>
				<button type="button" class="button button-primary" data-wpbc-booking-date-editor-review aria-controls="{{ review_view_id }}" aria-disabled="true" disabled>{{ i18n.review_changes }}</button>
			</footer>
		</div>

		<div id="{{ review_view_id }}" class="wpbc_booking_inspector__date_editor_view" data-wpbc-booking-date-editor-view="review" hidden>
			<div class="wpbc_booking_inspector__date_editor_body">
				<section class="wpbc_booking_inspector__date_editor_review" aria-labelledby="{{ inspector_id }}_date_review_title">
					<h4 id="{{ inspector_id }}_date_review_title" tabindex="-1">{{ i18n.review_date_changes }}</h4>
					<div data-wpbc-booking-date-editor-review-content></div>
				</section>
			</div>
			<footer class="wpbc_booking_inspector__date_editor_footer">
				<button type="button" class="button button-secondary" data-wpbc-booking-date-editor-back aria-controls="{{ editor_view_id }}">{{ i18n.back }}</button>
				<button type="button" class="button button-primary" data-wpbc-booking-date-editor-apply aria-disabled="true" disabled>{{ i18n.apply_changes }}</button>
			</footer>
		</div>
	</section>
</script>
