<?php
/**
 * Booking Inspector complete booking-fields panel template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-inspector-booking-fields">
	<section id="{{ data.inspector_id }}_panel_details" class="wpbc_booking_inspector__panel" role="tabpanel" aria-labelledby="{{ data.inspector_id }}_tab_details" tabindex="0" data-wpbc-booking-inspector-panel="details">
		<section class="wpbc_booking_inspector__card">
			<div class="wpbc_booking_inspector__card_heading"><h4>{{ data.i18n.booking_data }}</h4><# if ( data.actions && data.actions.can_edit ) { #><a href="{{ data.actions.edit_url }}" class="wpbc_booking_inspector__edit_link" title="{{ data.i18n.edit_in_add_booking_title }}"><span class="wpbc-bi-box-arrow-up-right" aria-hidden="true"></span>{{ data.i18n.edit_in_add_booking }}</a><# } #></div>
			<# if ( data.field_rows_html ) { #><div class="wpbc_booking_inspector__form_fields" data-wpbc-booking-details-fields>{{{ data.field_rows_html }}}</div><# } else { #>{{{ data.empty_state_html }}}<# } #>
		</section>
		{{{ data.notes_html }}}
		{{{ data.system_information_html }}}
	</section>
</script>
