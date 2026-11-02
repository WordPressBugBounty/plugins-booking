<?php
/**
 * Booking Inspector Resource summary template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-inspector-resource">
	<section class="wpbc_booking_inspector__summary" aria-label="{{ data.i18n.title }}">
		<div class="wpbc_booking_inspector__summary_top">
			<div class="wpbc_booking_inspector__customer" aria-label="{{ data.i18n.customer }}">
				<strong>{{ data.customer.name || data.label }}</strong>
				<# if ( data.customer.email ) { #><span>{{ data.customer.email }}</span><# } #>
				<# if ( data.customer.phone ) { #><span>{{ data.customer.phone }}</span><# } #>
			</div>
			<# if ( data.resource && data.resource.resource_id ) { #>
			<div class="wpbc_booking_inspector__resource" aria-label="{{ data.i18n.resource }}">
				<# if ( data.resource.picture_url ) { #><img src="{{ data.resource.picture_url }}" alt="" width="96" height="64"><# } #>
				<div class="wpbc_booking_inspector__resource_details">
					<div class="wpbc_booking_inspector__resource_title"><strong>{{ data.resource.title }}</strong><span>[{{ data.i18n.resource_id }}: {{ data.resource.resource_id }}]</span></div>
					<# if ( data.resource.pricing && data.resource.pricing.supported && data.resource.pricing.formatted_cost ) { #><span class="wpbc_booking_inspector__resource_price"><strong>{{ data.resource.pricing.formatted_cost }}</strong><# if ( data.resource.pricing.period_label ) { #> / {{ data.resource.pricing.period_label }}<# } #></span><# } #>
					<# if ( data.actions && data.actions.can_update ) { #><button type="button" class="button button-secondary wpbc_booking_inspector__resource_action" data-wpbc-booking-rescheduling-open><span>{{ data.i18n.change_booking_resource }}</span></button><# } #>
				</div>
			</div>
			<# } #>
		</div>
		<div class="wpbc_booking_inspector__summary_bottom">
			<div class="wpbc_booking_inspector__date_summary">
				<#
					var date_overview = data.dates && data.dates.summary && data.dates.summary.overview
						? data.dates.summary.overview
						: {
							leading_label: data.i18n.check_in,
							leading_value: data.dates.summary.start_date_label || data.dates.summary.start_label || data.i18n.not_available,
							leading_secondary: data.dates.summary.start_time_label || '',
							center_value: data.header_duration_label || '',
							center_secondary: '',
							trailing_label: data.i18n.check_out,
							trailing_value: data.dates.summary.end_date_label || data.dates.summary.end_label || data.i18n.not_available,
							trailing_secondary: data.dates.summary.end_time_label || '',
							show_arrow: true
						};
				#>
				<div class="wpbc_booking_inspector__date_values">
					<# if ( date_overview.leading_label || date_overview.leading_value ) { #><div class="wpbc_booking_inspector__summary_metric"><span>{{ date_overview.leading_label }}</span><strong><span class="wpbc_booking_inspector__summary_date_label">{{ date_overview.leading_value }}</span><# if ( date_overview.leading_secondary ) { #><span class="wpbc_booking_inspector__summary_time_label">{{ date_overview.leading_secondary }}</span><# } #></strong></div><# } #>
					<# if ( date_overview.center_value || date_overview.center_secondary || date_overview.show_arrow ) { #><div class="wpbc_booking_inspector__date_transition"><# if ( date_overview.center_value ) { #><span class="wpbc_booking_inspector__duration">{{ date_overview.center_value }}</span><# } #><# if ( date_overview.center_secondary ) { #><span class="wpbc_booking_inspector__summary_time_label">{{ date_overview.center_secondary }}</span><# } #><# if ( date_overview.show_arrow ) { #><span class="wpbc_booking_inspector__date_arrow wpbc_icn_arrow_forward" aria-hidden="true"></span><# } #></div><# } #>
					<# if ( date_overview.trailing_label || date_overview.trailing_value ) { #><div class="wpbc_booking_inspector__summary_metric"><span>{{ date_overview.trailing_label }}</span><strong><span class="wpbc_booking_inspector__summary_date_label">{{ date_overview.trailing_value }}</span><# if ( date_overview.trailing_secondary ) { #><span class="wpbc_booking_inspector__summary_time_label">{{ date_overview.trailing_secondary }}</span><# } #></strong></div><# } #>
				</div>
				<# if ( data.actions && data.actions.can_update ) { #><button type="button" class="button button-secondary wpbc_booking_inspector__summary_action" data-wpbc-booking-date-editor-open><span>{{ data.i18n.change_dates }}</span></button><# } #>
			</div>
			<# if ( data.costs_supported ) { #>
			<div class="wpbc_booking_inspector__financial_summary">
				<div class="wpbc_booking_inspector__financial_values">
					<div class="wpbc_booking_inspector__summary_metric"><span>{{ data.i18n.saved_cost }}</span><strong>{{ data.costs.saved_cost_formatted || data.i18n.not_available }}</strong></div>
					<div class="wpbc_booking_inspector__summary_metric wpbc_booking_inspector__payment wpbc_booking_inspector__payment--{{ data.costs.payment.state }}"><span>{{ data.i18n.payment_status }}</span><strong>{{ data.costs.payment.label || data.i18n.not_available }}</strong></div>
				</div>
				<# if ( data.actions && data.actions.can_edit_cost ) { #><button type="button" class="button button-secondary wpbc_booking_inspector__summary_action" data-wpbc-booking-inspector-open-tab="costs">{{ data.i18n.change_cost }}</button><# } #>
			</div>
			<# } #>
		</div>
	</section>
</script>
