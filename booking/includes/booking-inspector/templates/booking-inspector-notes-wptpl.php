<?php
/**
 * Booking Inspector notes card template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-inspector-notes">
	<section class="wpbc_booking_inspector__card">
		<h4>{{ data.i18n.notes }}</h4>
		<# if ( data.notes && data.notes.length ) { #>
		<div class="wpbc_booking_inspector__notes">
			<# _.each( data.notes, function ( note ) { var note_editable = 'public' === note.type ? data.actions.can_edit_public_note : data.actions.can_edit_private_note; #><div><strong>{{ note.label }}</strong><span>{{ note.audience }}</span><textarea rows="4" aria-label="{{ note.label }}" data-wpbc-booking-note="{{ note.type }}" <# if ( ! note_editable ) { #>readonly<# } #>>{{ note.has_value ? note.value : '' }}</textarea></div><# } ); #>
		</div>
		<# } else { #>{{{ data.empty_state_html }}}<# } #>
	</section>
</script>
