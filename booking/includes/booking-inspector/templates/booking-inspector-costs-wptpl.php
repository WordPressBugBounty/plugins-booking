<?php
/**
 * Booking Inspector costs panel template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-inspector-costs">
	<# if ( data.costs_supported ) { #>
	<section id="{{ data.inspector_id }}_panel_costs" class="wpbc_booking_inspector__panel" role="tabpanel" aria-labelledby="{{ data.inspector_id }}_tab_costs" tabindex="0" data-wpbc-booking-inspector-panel="costs" hidden>
		<section class="wpbc_booking_inspector__card wpbc_booking_inspector__saved_cost">
			<label><span>{{ data.i18n.saved_cost }}</span><input type="number" min="0" step="0.01" value="{{ data.costs.saved_cost }}" data-wpbc-booking-cost="saved_cost" <# if ( ! data.actions.can_edit_cost ) { #>readonly<# } #>></label>
			<label><span>{{ data.i18n.payment_status }}</span><select data-wpbc-booking-cost="payment_status" <# if ( ! data.actions.can_edit_payment_status ) { #>disabled<# } #>><# _.each( data.costs.payment.options || [], function ( option ) { #><option value="{{ option.value }}" <# if ( option.value === data.costs.payment.value ) { #>selected<# } #>>{{ option.label }}</option><# } ); #></select></label>
		</section>
	</section>
	<# } #>
</script>
