<?php
/**
 * Ready-state Booking Overview details WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-overview-context-popover">
	<div class="wpbc_booking_overview_tooltip__details_state" data-wpbc-booking-overview-details-state="ready">
		<# if ( data.costs.supported ) { #>
		<div class="wpbc_booking_overview_tooltip__financials">
			<div><span>{{ data.i18n.saved_cost }}</span><strong>{{ data.costs.has_saved_cost ? data.costs.saved_cost_formatted : data.i18n.not_available }}</strong></div>
			<div><span>{{ data.i18n.payment_status }}</span><strong>{{ data.costs.payment.label || data.i18n.not_available }}</strong></div>
		</div>
		<# } else { #>
		<p class="wpbc_booking_overview_tooltip__muted wpbc_booking_overview_tooltip__financials_notice">{{ data.i18n.unsupported_financials }}</p>
		<# } #>

		<h4 class="wpbc_booking_overview_tooltip__details_heading">{{ data.i18n.booking_data }}</h4>
		<# if ( data.fields.length ) { #>
		<dl class="wpbc_booking_overview_tooltip__fields">
		<# _.each( data.fields, function ( field ) { #>
			<div><dt>{{ field.label }}</dt><dd>{{ field.value || data.i18n.not_available }}</dd></div>
		<# } ); #>
		</dl>
		<# } else { #>
		<p class="wpbc_booking_overview_tooltip__muted">{{ data.i18n.empty_fields }}</p>
		<# } #>
		<# if ( data.created_label ) { #><p class="wpbc_booking_overview_tooltip__created"><span>{{ data.i18n.created }}:</span> {{ data.created_label }}</p><# } #>
		<# if ( data.is_truncated ) { #><p class="wpbc_booking_overview_tooltip__truncation">{{ data.i18n.truncated }}</p><# } #>
	</div>
</script>
