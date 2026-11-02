<?php
/**
 * Booking Inspector sticky mutation footer template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-inspector-footer">
	<footer class="wpbc_booking_inspector__footer" data-wpbc-booking-inspector-footer>
		<div class="wpbc_booking_inspector__action_menu" role="group" aria-label="{{ data.i18n.booking_actions }}">
			<?php
			if ( function_exists( 'wpbc_template__booking_listing__el__btn_action' ) ) {
				wpbc_template__booking_listing__el__btn_action( 'booking_inspector' );
			}
			?>
			<textarea id="set_booking_note_text_{{ data.parsed_fields.booking_id }}" hidden>{{ data.parsed_fields.remark }}</textarea>
		</div>
		<div class="wpbc_booking_inspector__message" role="status" aria-live="polite" data-wpbc-booking-inspector-message hidden></div>
		<# if ( data.can_update ) { #>
		<div class="wpbc_booking_inspector__footer_actions">
			<button type="button" class="button" data-wpbc-booking-inspector-cancel disabled>{{ data.i18n.cancel }}</button>
			<button type="button" class="button button-primary" data-wpbc-booking-inspector-save aria-busy="false" disabled>
				<span class="wpbc_booking_inspector__save_spinner wpbc_icn_rotate_right wpbc_spin wpbc_ajax_icon wpbc_processing wpbc_icn_autorenew" data-wpbc-booking-inspector-save-spinner aria-hidden="true" hidden></span>
				<span data-wpbc-booking-inspector-save-label>{{ data.i18n.save_changes }}</span>
			</button>
		</div>
		<# } #>
	</footer>
</script>
