<?php
/**
 * Add New Booking Inspector domain WordPress templates.
 *
 * These fixed templates render authorized DTO values only. They perform no
 * request, authorization, pricing, availability, persistence, or edition
 * decisions.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-new-inspector-shell">
	<div class="wpbc_booking_new_inspector" data-wpbc-booking-new-inspector-state="editing">
		<div class="wpbc_booking_new_inspector__body">
			<div data-wpbc-booking-new-inspector-resource-host></div>
			<div class="wpbc_booking_new_inspector__review_error notice notice-error inline" data-wpbc-booking-new-inspector-review-error role="alert" tabindex="-1" hidden><p></p></div>
			<div data-wpbc-booking-new-inspector-fields-host></div>
			<div data-wpbc-booking-new-inspector-notes-host></div>
			<div data-wpbc-booking-new-inspector-dates-host></div>
			<div data-wpbc-booking-new-inspector-costs-host></div>
		</div>
		<footer class="wpbc_booking_new_inspector__footer" data-wpbc-booking-new-inspector-footer-host></footer>
	</div>
</script>

<script type="text/html" id="tmpl-wpbc-booking-new-inspector-header">
	<div class="wpbc_booking_new_inspector__header">
		<div class="wpbc_booking_new_inspector__header_text">
			<h2>{{ data.title }}</h2>
			<# if ( data.subtitle ) { #><p>{{ data.subtitle }}</p><# } #>
		</div>
	</div>
</script>

<script type="text/html" id="tmpl-wpbc-booking-new-inspector-resource">
	<#
	var resources = Array.isArray( data.resources ) ? data.resources : [];
	var forms = Array.isArray( data.forms ) ? data.forms : [];
	var selected_resource = _.find( resources, function ( resource ) { return true === resource.selected; } ) || {};
	#>
	<section class="wpbc_booking_new_inspector__card wpbc_booking_new_inspector__resource" aria-labelledby="wpbc_booking_new_inspector_resource_heading">
		<div class="wpbc_booking_new_inspector__section_heading">
			<div>
				<h3 id="wpbc_booking_new_inspector_resource_heading">{{ data.i18n.resource_and_form }}</h3>
				<p>{{ data.i18n.resource_and_form_help }}</p>
			</div>
			<# if ( selected_resource.label ) { #><span class="wpbc_booking_new_inspector__resource_summary">{{ selected_resource.label }}</span><# } #>
		</div>
		<div class="wpbc_booking_new_inspector__choice_row">
			<div class="wpbc_booking_new_inspector__control">
				<label for="wpbc_booking_new_inspector_resource">{{ data.i18n.booking_resource }}</label>
				<select id="wpbc_booking_new_inspector_resource" data-wpbc-booking-new-inspector-resource>
					<# _.each( resources, function ( resource ) { #><option value="{{ resource.id }}" <# if ( resource.selected ) { #>selected<# } #> <# if ( false === resource.selectable ) { #>disabled<# } #>>{{ resource.label }}</option><# } ); #>
				</select>
			</div>
			<div class="wpbc_booking_new_inspector__control">
				<label for="wpbc_booking_new_inspector_form">{{ data.i18n.booking_form }}</label>
				<select id="wpbc_booking_new_inspector_form" data-wpbc-booking-new-inspector-form>
					<# _.each( forms, function ( form ) { #><option value="{{ form.id }}" <# if ( form.selected ) { #>selected<# } #>>{{ form.label }}</option><# } ); #>
				</select>
			</div>
		</div>
	</section>
</script>

<script type="text/html" id="tmpl-wpbc-booking-new-inspector-fields">
	<# var has_fields = Array.isArray( data.fields ) && data.fields.length; #>
	<section class="wpbc_booking_new_inspector__card" aria-labelledby="wpbc_booking_new_inspector_fields_heading">
		<div class="wpbc_booking_new_inspector__section_heading">
			<div><h3 id="wpbc_booking_new_inspector_fields_heading">{{ data.i18n.booking_details }}</h3><p>{{ data.i18n.booking_details_help }}</p></div>
		</div>
		<# if ( has_fields ) { #><div class="wpbc_booking_new_inspector__fields" data-wpbc-booking-new-inspector-fields></div><# } else { #><div class="wpbc_booking_new_inspector__empty_inline" role="status"><p>{{ data.i18n.no_booking_fields }}</p></div><# } #>
	</section>
</script>

<script type="text/html" id="tmpl-wpbc-booking-new-inspector-field">
	<#
	var field_values = Array.isArray( data.value ) ? data.value.map( String ) : [ String( data.value || '' ) ];
	var is_choice_group = -1 !== [ 'checkbox', 'radio', 'acceptance' ].indexOf( data.type );
	#>
	<div class="wpbc_booking_new_inspector__field" data-wpbc-booking-new-inspector-field="{{ data.key }}">
		<# if ( is_choice_group ) { #>
			<fieldset id="{{ data.field_id }}" aria-describedby="{{ data.error_id }}" <# if ( data.required ) { #>aria-required="true"<# } #>>
				<legend>{{ data.label }}<# if ( data.required ) { #> <span class="wpbc_booking_new_inspector__required" aria-hidden="true">*</span><# } #></legend>
				<div class="wpbc_booking_new_inspector__options">
					<# _.each( data.options || [], function ( option, option_index ) { #>
						<label for="{{ data.field_id }}_{{ option_index }}"><input id="{{ data.field_id }}_{{ option_index }}" type="<# if ( 'radio' === data.type ) { #>radio<# } else { #>checkbox<# } #>" name="{{ data.field_id }}<# if ( data.multiple ) { #>[]<# } #>" value="{{ option.value }}" aria-describedby="{{ data.error_id }}" data-wpbc-booking-new-inspector-field-input="{{ data.key }}" <# if ( -1 !== field_values.indexOf( String( option.value ) ) ) { #>checked<# } #> <# if ( option.disabled || data.readonly ) { #>disabled<# } #>> <span>{{ option.label }}</span></label>
					<# } ); #>
				</div>
			</fieldset>
		<# } else { #>
			<label for="{{ data.field_id }}">{{ data.label }}<# if ( data.required ) { #> <span class="wpbc_booking_new_inspector__required" aria-hidden="true">*</span><# } #></label>
			<# if ( 'textarea' === data.type ) { #>
				<textarea id="{{ data.field_id }}" aria-describedby="{{ data.error_id }}" data-wpbc-booking-new-inspector-field-input="{{ data.key }}" <# if ( data.required ) { #>required aria-required="true"<# } #> <# if ( data.readonly ) { #>readonly<# } #> <# if ( data.validation && data.validation.maxlength ) { #>maxlength="{{ data.validation.maxlength }}"<# } #>>{{ field_values[0] }}</textarea>
			<# } else if ( 'select' === data.type ) { #>
				<select id="{{ data.field_id }}" aria-describedby="{{ data.error_id }}" data-wpbc-booking-new-inspector-field-input="{{ data.key }}" <# if ( data.multiple ) { #>multiple<# } #> <# if ( data.required ) { #>required aria-required="true"<# } #> <# if ( data.readonly ) { #>disabled<# } #>><# if ( ! data.multiple ) { #><option value=""></option><# } #><# _.each( data.options || [], function ( option ) { #><option value="{{ option.value }}" <# if ( -1 !== field_values.indexOf( String( option.value ) ) ) { #>selected<# } #> <# if ( option.disabled ) { #>disabled<# } #>>{{ option.label }}</option><# } ); #></select>
			<# } else { #>
				<input id="{{ data.field_id }}" type="<# if ( 'email' === data.type ) { #>email<# } else { #>text<# } #>" value="{{ field_values[0] }}" aria-describedby="{{ data.error_id }}" data-wpbc-booking-new-inspector-field-input="{{ data.key }}" <# if ( data.required ) { #>required aria-required="true"<# } #> <# if ( data.readonly ) { #>readonly<# } #> <# if ( data.validation && data.validation.maxlength ) { #>maxlength="{{ data.validation.maxlength }}"<# } #>>
			<# } #>
		<# } #>
		<# if ( data.help ) { #><p class="description">{{ data.help }}</p><# } #>
		<div id="{{ data.error_id }}" class="wpbc_booking_new_inspector__field_error" data-wpbc-booking-new-inspector-field-error="{{ data.key }}" hidden></div>
	</div>
</script>

<script type="text/html" id="tmpl-wpbc-booking-new-inspector-notes">
	<# var notes = Array.isArray( data.notes ) ? data.notes : []; #>
	<# if ( notes.length ) { #>
	<section class="wpbc_booking_new_inspector__card" aria-labelledby="wpbc_booking_new_inspector_notes_heading">
		<h3 id="wpbc_booking_new_inspector_notes_heading">{{ data.i18n.notes }}</h3>
		<div class="wpbc_booking_new_inspector__notes">
			<# _.each( notes, function ( note ) { #>
			<div>
				<strong>{{ note.label }}</strong>
				<span>{{ note.audience }}</span>
				<textarea rows="4" maxlength="{{ note.maxlength }}" aria-label="{{ note.label }}" data-wpbc-booking-new-inspector-note="{{ note.type }}">{{ note.value || '' }}</textarea>
			</div>
			<# } ); #>
		</div>
	</section>
	<# } #>
</script>

<script type="text/html" id="tmpl-wpbc-booking-new-inspector-dates">
	<#
	var schedule = data.schedule && 'object' === typeof data.schedule ? data.schedule : {};
	var schedule_dates = Array.isArray( schedule.selected_dates ) ? schedule.selected_dates : ( Array.isArray( schedule.dates ) ? schedule.dates : [] );
	var choices = data.choices && 'object' === typeof data.choices ? data.choices : {};
	var selection_methods = Array.isArray( choices.selection_methods ) ? choices.selection_methods : [];
	var time_applications = Array.isArray( choices.time_applications ) ? choices.time_applications : [];
	var time_application = schedule.time_application || ( 'time_range' === schedule.mode ? 'boundary' : 'full_day' );
	#>
	<section class="wpbc_booking_new_inspector__card wpbc_booking_new_inspector__schedule" aria-labelledby="wpbc_booking_new_inspector_dates_heading">
		<div class="wpbc_booking_new_inspector__section_heading">
			<div><h3 id="wpbc_booking_new_inspector_dates_heading">{{ data.i18n.schedule }}</h3><p>{{ data.i18n.schedule_help }}</p></div>
			<button type="button" class="button button-secondary" data-wpbc-booking-new-inspector-schedule-reset <# if ( ! schedule_dates.length ) { #>disabled<# } #>>{{ data.i18n.reset_dates }}</button>
		</div>
		<div class="wpbc_booking_new_inspector__schedule_status" data-wpbc-booking-new-inspector-schedule-status role="status" aria-live="polite"></div>
		<div class="wpbc_booking_new_inspector__schedule_error notice inline notice-error" data-wpbc-booking-new-inspector-schedule-error role="alert" tabindex="-1" hidden><p>{{ data.i18n.schedule_failed }}</p></div>
		<# if ( selection_methods.length ) { #>
			<fieldset class="wpbc_booking_new_inspector__schedule_choices"><legend>{{ data.i18n.selection_method }}</legend><div class="wpbc_booking_new_inspector__options"><# _.each( selection_methods, function ( choice ) { #><label><input type="radio" name="wpbc_booking_new_inspector_selection_method" value="{{ choice.id }}" data-wpbc-booking-new-inspector-selection-method <# if ( choice.id === schedule.selection_method ) { #>checked<# } #>> <span>{{ choice.label }}</span></label><# } ); #></div></fieldset>
		<# } #>
		<div class="wpbc_booking_new_inspector__calendar_row">
			<div class="wpbc_booking_new_inspector__calendar booking_form_div" data-wpbc-calendar-interactive="1"><h4>{{ data.i18n.select_dates }}</h4><div class="wpbc_booking_new_inspector__calendar_host" data-wpbc-booking-new-inspector-calendar-host aria-busy="true"></div></div>
			<aside class="wpbc_booking_new_inspector__date_overview" aria-labelledby="wpbc_booking_new_inspector_date_overview_heading"><h4 id="wpbc_booking_new_inspector_date_overview_heading">{{ data.i18n.selected_dates }}</h4><p><strong><output data-wpbc-booking-new-inspector-selected-count>{{ schedule_dates.length }}</output></strong> {{ data.i18n.dates_selected }}</p><ol data-wpbc-booking-new-inspector-selected-dates><# if ( ! schedule_dates.length ) { #><li data-wpbc-booking-new-inspector-no-dates>{{ data.i18n.no_dates }}</li><# } #><# _.each( schedule_dates, function ( selected_date ) { #><li>{{ selected_date }}</li><# } ); #></ol></aside>
		</div>
		<# if ( time_applications.length ) { #>
			<fieldset class="wpbc_booking_new_inspector__schedule_choices"><legend>{{ data.i18n.apply_times_as }}</legend><div class="wpbc_booking_new_inspector__options"><# _.each( time_applications, function ( choice ) { #><label><input type="radio" name="wpbc_booking_new_inspector_time_application" value="{{ choice.id }}" data-wpbc-booking-new-inspector-time-application <# if ( choice.id === time_application ) { #>checked<# } #>> <span>{{ choice.label }}</span></label><# } ); #></div></fieldset>
		<# } #>
		<div class="wpbc_booking_new_inspector__time_row" data-wpbc-booking-new-inspector-time-row <# if ( 'full_day' === time_application ) { #>hidden<# } #>><div class="wpbc_booking_new_inspector__control"><label for="wpbc_booking_new_inspector_start_time">{{ data.i18n.start_time }}</label><input id="wpbc_booking_new_inspector_start_time" type="time" value="{{ schedule.start_time || '' }}" data-wpbc-booking-new-inspector-start-time></div><div class="wpbc_booking_new_inspector__control"><label for="wpbc_booking_new_inspector_end_time">{{ data.i18n.end_time }}</label><input id="wpbc_booking_new_inspector_end_time" type="time" value="{{ schedule.end_time || '' }}" data-wpbc-booking-new-inspector-end-time></div></div>
	</section>
</script>

<script type="text/html" id="tmpl-wpbc-booking-new-inspector-costs">
	<#
	var cost = data.cost && 'object' === typeof data.cost ? data.cost : {};
	var line_items = Array.isArray( cost.line_items ) ? cost.line_items : [];
	var validation_messages = Array.isArray( data.validation_messages ) ? data.validation_messages : [];
	var has_total = 'calculated' === cost.status && cost.formatted_total;
	var correction_value = '' !== String( data.correction_value || '' ) ? String( data.correction_value ) : ( has_total ? String( cost.total || '' ) : '' );
	#>
	<section class="wpbc_booking_new_inspector__card wpbc_booking_new_inspector__cost" aria-labelledby="wpbc_booking_new_inspector_cost_heading">
		<div class="wpbc_booking_new_inspector__section_heading wpbc_booking_new_inspector__cost_heading <# if ( data.upgrade_required ) { #>wpbc_booking_new_inspector__cost_upgrade_heading<# } #>">
			<div>
				<h3 id="wpbc_booking_new_inspector_cost_heading">{{ data.i18n.cost }}</h3>
				<p id="wpbc_booking_new_inspector_cost_status" data-wpbc-booking-new-inspector-cost-status role="status" aria-live="polite">{{ data.upgrade_required ? data.i18n.cost_upgrade_message : ( cost.message || data.i18n.cost_unavailable ) }}</p>
			</div>
			<# if ( data.upgrade_required ) { #><button type="button" class="button-link wpbc_booking_new_inspector__cost_upgrade_dismiss" aria-label="{{ data.i18n.dismiss_cost_upgrade }}" data-wpbc-booking-new-inspector-dismiss-cost>{{ data.i18n.dismiss }}</button><# } #>
		</div>
		<# if ( validation_messages.length ) { #>
			<ul class="wpbc_booking_new_inspector__cost_validation_messages" role="list"><# _.each( validation_messages, function ( validation_message ) { #><li>{{ validation_message }}</li><# } ); #></ul>
		<# } #>
		<# if ( ! data.upgrade_required ) { #>
		<div class="wpbc_booking_new_inspector__cost_controls">
			<div class="wpbc_booking_new_inspector__cost_actions">
				<button type="button" class="button button-secondary" data-wpbc-booking-new-inspector-cost-preview>{{ data.i18n.recalculate_cost }}</button>
				<# if ( data.fallback && data.fallback.url ) { #><a class="button" href="{{ data.fallback.url }}">{{ data.fallback.label }}</a><# } #>
			</div>
			<# if ( data.correction_allowed ) { #>
				<label class="wpbc_booking_new_inspector__cost_editor">
					<span class="screen-reader-text">{{ data.i18n.cost_correction }}</span>
					<input type="number" min="0" max="1000000000" step="0.01" inputmode="decimal" value="{{ correction_value }}" placeholder="{{ data.i18n.cost_unavailable_short }}" aria-describedby="wpbc_booking_new_inspector_cost_status" data-wpbc-booking-new-inspector-cost-correction>
					<# if ( cost.currency ) { #><span aria-hidden="true">{{ cost.currency }}</span><# } #>
				</label>
			<# } else { #>
				<span class="wpbc_booking_new_inspector__cost_placeholder" aria-label="{{ has_total ? data.i18n.cost_calculated : data.i18n.cost_unavailable }}">{{ has_total ? cost.formatted_total : data.i18n.cost_unavailable_short }}</span>
			<# } #>
		</div>
		<# if ( line_items.length ) { #>
			<dl class="wpbc_booking_new_inspector__cost_lines"><# _.each( line_items, function ( line_item ) { #><div><dt>{{ line_item.label }}</dt><dd>{{ line_item.formatted_amount }}</dd></div><# } ); #></dl>
		<# } #>
		<# } #>
	</section>
</script>

<script type="text/html" id="tmpl-wpbc-booking-new-inspector-footer">
	<div class="wpbc_booking_new_inspector__footer_actions">
		<a class="button button-secondary wpbc_booking_new_inspector__footer_fallback" href="{{ data.url }}">{{ data.i18n.open_full_page }}</a>
		<div class="wpbc_booking_new_inspector__footer_primary_actions">
			<button type="button" class="button" data-wpbc-shared-ui-inspector-close>{{ data.i18n.cancel }}</button>
			<button type="button" class="button button-primary" data-wpbc-booking-new-inspector-review>{{ data.i18n.review_and_create }}</button>
		</div>
	</div>
</script>

<script type="text/html" id="tmpl-wpbc-booking-new-inspector-review">
	<#
	var review = data.review && 'object' === typeof data.review ? data.review : {};
	var schedule = review.schedule && 'object' === typeof review.schedule ? review.schedule : {};
	var fields = Array.isArray( review.fields ) ? review.fields : [];
	var notes = Array.isArray( review.notes ) ? review.notes : [];
	var dates = Array.isArray( schedule.dates ) ? schedule.dates : [];
	var warnings = Array.isArray( review.warnings ) ? review.warnings : [];
	var limitations = Array.isArray( review.limitations ) ? review.limitations : [];
	var first_date = dates.length ? dates[0] : '';
	var last_date = dates.length ? dates[dates.length - 1] : '';
	var review_time_text = data.i18n.full_days;
	if ( 'boundary' === schedule.time_application ) {
		review_time_text = String( data.i18n.review_boundary_schedule || '' )
			.replace( '{start_date}', first_date )
			.replace( '{start_time}', schedule.start_time || '' )
			.replace( '{end_date}', last_date )
			.replace( '{end_time}', schedule.end_time || '' );
	} else if ( 'per_date' === schedule.time_application ) {
		review_time_text = String( data.i18n.review_per_date_schedule || '' )
			.replace( '{start_time}', schedule.start_time || '' )
			.replace( '{end_time}', schedule.end_time || '' );
	}
	#>
	<div class="wpbc_booking_new_inspector wpbc_booking_new_inspector--review" data-wpbc-booking-new-inspector-review-view>
		<div class="wpbc_booking_new_inspector__body">
			<section class="wpbc_booking_new_inspector__card" aria-labelledby="wpbc_booking_new_inspector_review_heading">
				<div class="wpbc_booking_new_inspector__section_heading"><div><h3 id="wpbc_booking_new_inspector_review_heading">{{ data.i18n.review_title }}</h3></div></div>
				<dl class="wpbc_booking_new_inspector__review_summary">
					<div><dt>{{ data.i18n.review_resource }}</dt><dd>{{ review.resource && review.resource.label ? review.resource.label : '' }}</dd></div>
					<div><dt>{{ data.i18n.review_form }}</dt><dd>{{ review.form && review.form.label ? review.form.label : '' }}</dd></div>
					<div><dt>{{ data.i18n.review_schedule }}</dt><dd><span>{{ dates.join( ', ' ) }}</span><span>{{ review_time_text }}</span></dd></div>
				</dl>
			</section>
			<section class="wpbc_booking_new_inspector__card" aria-labelledby="wpbc_booking_new_inspector_review_fields_heading">
				<h3 id="wpbc_booking_new_inspector_review_fields_heading">{{ data.i18n.review_fields }}</h3>
				<dl class="wpbc_booking_new_inspector__review_summary"><# _.each( fields, function ( field ) { #><div><dt>{{ field.label }}</dt><dd>{{ field.value }}</dd></div><# } ); #></dl>
			</section>
			<# if ( notes.length ) { #>
			<section class="wpbc_booking_new_inspector__card" aria-labelledby="wpbc_booking_new_inspector_review_notes_heading">
				<h3 id="wpbc_booking_new_inspector_review_notes_heading">{{ data.i18n.review_notes }}</h3>
				<dl class="wpbc_booking_new_inspector__review_summary"><# _.each( notes, function ( note ) { #><div><dt><span>{{ note.label }}</span><small>{{ note.audience }}</small></dt><dd>{{ note.value || data.i18n.note_not_set }}</dd></div><# } ); #></dl>
			</section>
			<# } #>
			<section class="wpbc_booking_new_inspector__card" aria-labelledby="wpbc_booking_new_inspector_review_cost_heading">
				<h3 id="wpbc_booking_new_inspector_review_cost_heading">{{ data.i18n.review_cost }}</h3>
				<p>{{ review.cost && review.cost.formatted_total ? review.cost.formatted_total : ( review.cost && review.cost.message ? review.cost.message : data.i18n.cost_unavailable ) }}</p>
				<dl class="wpbc_booking_new_inspector__review_summary">
					<div><dt>{{ data.i18n.review_email }}</dt><dd>{{ review.email_intent || data.i18n.email_default }}</dd></div>
					<div><dt>{{ data.i18n.review_approval }}</dt><dd>{{ review.approval_intent || '' }}</dd></div>
				</dl>
				<# if ( warnings.length ) { #><ul class="wpbc_booking_new_inspector__review_warnings" role="list"><# _.each( warnings, function ( warning ) { #><li>{{ warning }}</li><# } ); #></ul><# } #>
				<# if ( limitations.length ) { #><ul class="wpbc_booking_new_inspector__review_limitations"><# _.each( limitations, function ( limitation ) { #><li>{{ limitation }}</li><# } ); #></ul><# } #>
			</section>
		</div>
		<footer class="wpbc_booking_new_inspector__footer">
			<div class="wpbc_booking_new_inspector__footer_actions">
				<button type="button" class="button" data-wpbc-booking-new-inspector-review-cancel>{{ data.i18n.cancel }}</button>
				<button type="button" class="button button-primary" data-wpbc-booking-new-inspector-create>{{ data.i18n.create_booking }}</button>
			</div>
		</footer>
	</div>
</script>

<script type="text/html" id="tmpl-wpbc-booking-new-inspector-created">
	<div class="wpbc_booking_new_inspector wpbc_booking_new_inspector--created" data-wpbc-booking-new-inspector-created-view>
		<div class="wpbc_booking_new_inspector__body">
			<section class="wpbc_booking_new_inspector__state wpbc_booking_new_inspector__state--created" role="status" tabindex="-1" data-wpbc-booking-new-inspector-created-status>
				<h3>{{ data.i18n.created_title }}</h3>
				<p>{{ data.i18n.created_message }}</p>
				<p><strong>{{ data.i18n.booking_number }}:</strong> {{ data.booking.booking_id }}</p>
				<# if ( data.warnings && data.warnings.length ) { #><ul class="wpbc_booking_new_inspector__review_warnings"><# _.each( data.warnings, function ( warning ) { #><li>{{ warning }}</li><# } ); #></ul><# } #>
				<p role="status" aria-live="polite" data-wpbc-booking-new-inspector-readback-status>{{ data.i18n.refreshing_timeline }}</p>
				<button type="button" class="button" data-wpbc-booking-new-inspector-readback-retry hidden>{{ data.i18n.retry_timeline_refresh }}</button>
			</section>
		</div>
		<footer class="wpbc_booking_new_inspector__footer"><div class="wpbc_booking_new_inspector__footer_actions"><button type="button" class="button button-primary" data-wpbc-shared-ui-inspector-close>{{ data.i18n.close }}</button></div></footer>
	</div>
</script>

<script type="text/html" id="tmpl-wpbc-booking-new-inspector-state">
	<div class="wpbc_booking_new_inspector__state wpbc_booking_new_inspector__state--{{ data.state }}" data-state="{{ data.state }}" <# if ( 'error' === data.state ) { #>role="alert"<# } else { #>role="status"<# } #>>
		<# if ( 'loading' === data.state ) { #><div class="wpbc_booking_new_inspector__state_loader wpbc_spins_loading_container"><div class="wpbc_booking_form_spin_loader" aria-hidden="true"><div class="wpbc_spins_loader_wrapper"><div class="wpbc_one_spin_loader_mini2"></div></div></div><h3>{{ data.title }}</h3></div><# } else { #><h3>{{ data.title }}</h3><# } #><p>{{ data.message }}</p>
		<div class="wpbc_booking_new_inspector__state_actions"><# if ( data.retry ) { #><button type="button" class="button button-secondary" data-wpbc-booking-new-inspector-retry>{{ data.i18n.retry }}</button><# } #><# if ( data.url ) { #><a class="button button-secondary" href="{{ data.url }}">{{ data.i18n.open_full_page }}</a><# } #><# if ( 'loading' !== data.state ) { #><button type="button" class="button" data-wpbc-shared-ui-inspector-close>{{ data.i18n.cancel }}</button><# } #></div>
	</div>
</script>

<script type="text/html" id="tmpl-wpbc-booking-new-inspector-unsupported-form">
	<div class="wpbc_booking_new_inspector wpbc_booking_new_inspector--unsupported"><div class="wpbc_booking_new_inspector__body"><section class="wpbc_booking_new_inspector__state wpbc_booking_new_inspector__state--unsupported" role="status"><span class="wpbc-bi-exclamation-triangle" aria-hidden="true"></span><h3>{{ data.i18n.unsupported_title }}</h3><p>{{ data.support && data.support.message ? data.support.message : data.i18n.unsupported_message }}</p></section></div><footer class="wpbc_booking_new_inspector__footer"><div class="wpbc_booking_new_inspector__footer_actions"><button type="button" class="button" data-wpbc-shared-ui-inspector-close>{{ data.i18n.cancel }}</button><a class="button button-primary" href="{{ data.fallback && data.fallback.url ? data.fallback.url : data.canonical_url }}">{{ data.fallback && data.fallback.label ? data.fallback.label : data.i18n.open_full_page }}</a></div></footer></div>
</script>
