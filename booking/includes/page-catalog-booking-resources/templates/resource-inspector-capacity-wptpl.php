<?php
/**
 * Booking Resource capacity editor and signed review template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resource-inspector-capacity">
	<form id="wpbc_catalog_booking_resource_capacity_form" class="wpbc_catalog_booking_resources__editor wpbc_booking_resources__capacity_editor" data-wpbc-catalog-resource-capacity-form data-mode="{{ data.view.mode }}">
		<div class="wpbc_bfb__inspector__head"><div class="header_container"><div class="header_title_content">
			<h3 class="title" tabindex="-1" data-wpbc-catalog-resource-inspector-heading>{{ data.view.title }}</h3>
			<span class="wpbc_catalog_booking_resources__editor_context">{{ data.view.context_label }}</span>
			<div class="desc">{{ data.view.description }}</div>
		</div></div></div>
		<div class="notice inline notice-error" data-wpbc-catalog-resource-inspector-message hidden role="alert"><p></p></div>
		<div class="wpbc_booking_resources__capacity_content">
			<# if ( 'capacity' === data.view.mode ) { #>
				<div class="wpbc_booking_resources__capacity_summary">
					<span>{{ data.i18n.current_capacity }}</span>
					<strong>{{ data.view.current_capacity }} {{ data.i18n.units }}</strong>
					<span class="wpbc_booking_resources__capacity_summary_icon"><span class="wpbc-bi-people-fill" aria-hidden="true"></span></span>
				</div>
				<div class="wpbc_booking_resources__capacity_control">
					<label for="wpbc_catalog_booking_resource_capacity_target">{{ data.i18n.set_new_capacity }}</label>
					<div class="wpbc_booking_resources__capacity_control_row">
						<input id="wpbc_catalog_booking_resource_capacity_target" type="number" min="{{ data.view.minimum_capacity }}" max="{{ data.view.maximum_capacity }}" step="1" value="{{ data.view.target_capacity }}" data-wpbc-catalog-capacity-target>
						<input type="range" min="{{ data.view.minimum_capacity }}" max="{{ data.view.maximum_capacity }}" step="1" value="{{ data.view.target_capacity }}" aria-label="{{ data.i18n.set_new_capacity }}" data-wpbc-catalog-capacity-range>
					</div>
				</div>
			<# } #>
			<div class="wpbc_booking_resources__capacity_comparison">
				<div class="wpbc_booking_resources__capacity_comparison_value"><span>{{ data.i18n.before }}</span><strong data-wpbc-catalog-capacity-before>{{ data.view.current_capacity }}</strong><small>{{ data.i18n.units }}</small></div>
				<span class="wpbc-bi-arrow-right" aria-hidden="true"></span>
				<div class="wpbc_booking_resources__capacity_comparison_value is-target"><span>{{ data.i18n.after }}</span><strong data-wpbc-catalog-capacity-after>{{ data.view.target_capacity }}</strong><small>{{ data.i18n.units }}</small></div>
			</div>
			<# if ( 'capacity' === data.view.mode ) { #>
				<div class="wpbc_booking_resources__capacity_change_preview" data-wpbc-catalog-capacity-changes>
					<h3>{{ data.i18n.preview_changes }}</h3>
					<div class="wpbc_booking_resources__capacity_changes">
						<div class="wpbc_booking_resources__capacity_change_row"><span class="wpbc-bi-check-circle" aria-hidden="true"></span><div><strong data-wpbc-catalog-capacity-keep-label>{{ data.view.keep_label }}</strong><p>{{ data.i18n.keep_existing_help }}</p></div></div>
						<div class="wpbc_booking_resources__capacity_change_row" data-wpbc-catalog-capacity-increase-row <# if ( 'increase' !== data.view.operation ) { #>hidden<# } #>><span class="wpbc-bi-plus-circle" aria-hidden="true"></span><div><strong data-wpbc-catalog-capacity-create-label>{{ data.view.create_label }}</strong><p>{{ data.i18n.create_units_help }}</p></div></div>
					</div>
					<div data-wpbc-catalog-capacity-decrease <# if ( 'decrease' !== data.view.operation ) { #>hidden<# } #>>
						<fieldset class="wpbc_booking_resources__capacity_decrease_choices">
							<legend>{{ data.i18n.decrease_outcome }}</legend>
							<label class="<# if ( 'detach' === data.view.decrease_action ) { #>is-selected<# } #>"><input type="radio" name="wpbc_catalog_capacity_decrease_action" value="detach" data-wpbc-catalog-capacity-decrease-action <# if ( 'detach' === data.view.decrease_action ) { #>checked<# } #>><span><strong>{{ data.i18n.detach_units }}</strong><small>{{ data.i18n.detach_units_help }}</small></span></label>
							<label class="is-destructive<# if ( 'delete' === data.view.decrease_action ) { #> is-selected<# } #>"><input type="radio" name="wpbc_catalog_capacity_decrease_action" value="delete" data-wpbc-catalog-capacity-decrease-action <# if ( 'delete' === data.view.decrease_action ) { #>checked<# } #>><span><strong>{{ data.i18n.delete_units }}</strong><small>{{ data.i18n.delete_units_help }}</small></span></label>
						</fieldset>
						<h3 data-wpbc-catalog-capacity-decrease-heading>{{ data.view.decrease_heading }}</h3>
						<p class="description" data-wpbc-catalog-capacity-decrease-help>{{ data.view.decrease_help }}</p>
						<div class="wpbc_booking_resources__capacity_units">
							<# _.each( data.view.children || [], function ( child ) { #>
								<label class="wpbc_booking_resources__capacity_unit<# if ( child.selected ) { #> is-selected<# } #>">
									<input type="checkbox" value="{{ child.id }}" data-wpbc-catalog-capacity-detach <# if ( child.selected ) { #>checked<# } #>>
									<span class="wpbc_ui_listing__table_icon wpbc_booking_resources__capacity_unit_icon"><# if ( child.picture_url ) { #><img src="{{ child.picture_url }}" alt=""><# } else { #><i class="menu_icon icon-1x wpbc-bi-image-fill" aria-hidden="true"></i><# } #></span>
									<span class="wpbc_booking_resources__capacity_unit_copy"><strong>{{ child.title }}</strong><small>{{ child.booking_count_label }}</small></span>
									<span class="wpbc_booking_resources__capacity_unit_outcome<# if ( 'delete' === data.view.decrease_action ) { #> is-destructive<# } #>" <# if ( ! child.selected ) { #>hidden<# } #>>{{ data.view.decrease_outcome_label }}</span>
								</label>
							<# } ); #>
						</div>
					</div>
				</div>
			<# } else { #>
				<div class="wpbc_booking_resources__capacity_changes">
					<div class="wpbc_booking_resources__capacity_change_row"><span class="<# if ( 'increase' === data.view.operation ) { #>wpbc-bi-plus-circle<# } else { #>wpbc-bi-arrow-left-right<# } #>" aria-hidden="true"></span><div><strong>{{ data.view.operation_label }}</strong><p>{{ data.view.operation_help }}</p></div></div>
				</div>
				<# if ( 'increase' === data.view.operation ) { #>
					<h3>{{ data.i18n.new_child_units }}</h3>
					<div class="wpbc_booking_resources__capacity_review_units"><# _.each( data.view.resources || [], function ( resource ) { #><div class="wpbc_booking_resources__capacity_review_unit"><strong>{{ resource.title }}</strong><span>{{ data.i18n.new_child_calendar }}</span><small>{{ data.i18n.create_units_help }}</small></div><# } ); #></div>
				<# } else if ( 'delete' === data.view.decrease_action ) { #>
					<h3>{{ data.i18n.units_to_delete }}</h3>
					<div class="wpbc_booking_resources__capacity_review_units"><# _.each( data.view.resources || [], function ( resource ) { #><div class="wpbc_booking_resources__capacity_review_unit is-destructive"><strong>{{ resource.title }}</strong><span>{{ data.i18n.will_be_deleted }}</span><small>{{ resource.booking_count_label }}</small></div><# } ); #></div>
				<# } else { #>
					<h3>{{ data.i18n.independent_units }}</h3>
					<div class="wpbc_booking_resources__capacity_review_units"><# _.each( data.view.resources || [], function ( resource ) { #><div class="wpbc_booking_resources__capacity_review_unit"><strong>{{ resource.title }}</strong><span>{{ data.i18n.make_independent }}</span><small>{{ resource.booking_count_label }}</small></div><# } ); #></div>
				<# } #>
				<# if ( 'delete' === data.view.decrease_action ) { #>
					<div class="wpbc_booking_resources__capacity_safety is-destructive">
						<div class="wpbc_booking_resources__capacity_change_row"><span class="wpbc-bi-exclamation-triangle" aria-hidden="true"></span><div><strong>{{ data.i18n.capacity_delete_warning }}</strong></div></div>
						<# if ( data.view.delete_has_bookings ) { #><div class="wpbc_booking_resources__capacity_change_row"><span class="wpbc-bi-info-circle" aria-hidden="true"></span><div><strong>{{ data.i18n.capacity_delete_bookings_warning }}</strong></div></div><# } #>
					</div>
					<label class="wpbc_catalog_booking_resources__delete_acknowledgement wpbc_booking_resources__delete_acknowledgement wpbc_booking_resources__delete_acknowledgement--attention"><input type="checkbox" data-wpbc-catalog-capacity-delete-acknowledgement><span>{{ data.i18n.capacity_delete_acknowledgement }}</span></label>
				<# } else { #>
					<div class="wpbc_booking_resources__capacity_safety">
						<div class="wpbc_booking_resources__capacity_change_row"><span class="wpbc-bi-shield-check" aria-hidden="true"></span><div><strong>{{ data.i18n.no_resources_deleted }}</strong></div></div>
						<div class="wpbc_booking_resources__capacity_change_row"><span class="wpbc-bi-info-circle" aria-hidden="true"></span><div><strong>{{ data.i18n.independent_units_help }}</strong></div></div>
					</div>
				<# } #>
			<# } #>
		</div>
	</form>
</script>
