<?php
/**
 * Timeline time-row authoritative preview and action template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-time-rows-selection-actions">
	<section
		class="wpbc_timeline__selection_popover wpbc_timeline_time_rows_selection__actions is-{{ data.state }}"
		data-wpbc-timeline-time-rows-selection-actions
		data-wpbc-timeline-time-rows-selection-state="{{ data.state }}"
		data-wpbc-timeline-selection-popover-state="{{ data.state }}"
		role="dialog"
		aria-label="{{ data.i18n.preview_label }}"
		aria-busy="<# if ( data.state === 'previewing' || data.state === 'applying' || data.state === 'awaiting_readback' ) { #>true<# } else { #>false<# } #>"
	>
		<# if ( data.state === 'ready' && data.preview ) { #>
			<div class="wpbc_timeline__selection_popover_body wpbc_timeline__selection_popover_body--ready">
				<div class="wpbc_timeline__selection_actions">
					<div class="wpbc_timeline__selection_action_buttons">
						<# if ( data.preview.actions.new_booking.authorized ) { #>
							<a class="button button-primary <# if ( ! data.preview.actions.new_booking.enabled ) { #>disabled<# } #>" <# if ( data.preview.actions.new_booking.enabled ) { #>href="{{ data.preview.actions.new_booking.url }}" <# if ( data.preview.actions.new_booking.launch_context ) { #>data-wpbc-booking-new-inspector-open="{{ data.preview.actions.new_booking.launch_context }}"<# } #><# } else { #>aria-disabled="true"<# } #>>{{ data.preview.actions.new_booking.label }}</a>
						<# } #>
						<# if ( data.preview.actions.block.authorized ) { #>
							<button type="button" class="button" data-wpbc-timeline-time-rows-selection-availability="block" <# if ( ! data.preview.actions.block.enabled ) { #>disabled<# } #>>{{ data.preview.actions.block.label }}</button>
						<# } #>
						<# if ( data.preview.actions.unblock.authorized ) { #>
							<button type="button" class="button" data-wpbc-timeline-time-rows-selection-availability="unblock" <# if ( ! data.preview.actions.unblock.enabled ) { #>disabled<# } #>>{{ data.preview.actions.unblock.label }}</button>
						<# } #>
					</div>
					<button type="button" class="button-link wpbc_timeline__selection_popover_close" data-wpbc-timeline-time-rows-selection-cancel aria-label="{{ data.i18n.cancel_selection }}">&times;</button>
				</div>
				<div class="wpbc_timeline__selection_summary">
					<strong class="wpbc_timeline__selection_resource_title">{{ data.preview.selection.resource_title }}</strong>
					<div class="wpbc_timeline__selection_summary_meta">
						<span><strong>{{ data.preview.selection.range_label }}</strong><span class="wpbc_timeline__selection_summary_separator" aria-hidden="true">|</span><strong>{{ data.preview.selection.duration_label }}</strong></span>
						<# if ( data.preview.quote && data.preview.quote.formatted ) { #>
							<span class="wpbc_timeline__selection_quote">{{ data.preview.quote.formatted }}</span>
						<# } #>
					</div>
					<# if ( data.preview.occupancy.overlap_count ) { #>
						<p class="wpbc_timeline__selection_warning">{{ data.preview.occupancy.overlap_label }}</p>
					<# } #>
					<# if ( data.preview.availability.load_state !== 'loaded' || data.preview.availability.state !== 'available' ) { #>
						<p class="wpbc_timeline__selection_warning">{{ data.i18n.availability_requires_review }}</p>
					<# } #>
					<# if ( data.preview.quote && data.preview.quote.label ) { #>
						<small class="wpbc_timeline__selection_quote_note">{{ data.preview.quote.label }}</small>
					<# } #>
				</div>
			</div>
		<# } else { #>
			<header>
				<strong><# if ( data.preview && data.preview.selection ) { #>{{ data.preview.selection.resource_title }}<# } else { #>{{ data.i18n.preview_label }}<# } #></strong>
				<button type="button" class="button-link" data-wpbc-timeline-time-rows-selection-cancel aria-label="{{ data.i18n.cancel_selection }}" <# if ( data.state === 'applying' || data.state === 'awaiting_readback' ) { #>disabled<# } #>>&times;</button>
			</header>
			<div class="wpbc_timeline__selection_popover_body">
				<# if ( data.state === 'previewing' || data.state === 'applying' || data.state === 'awaiting_readback' ) { #>
					<p class="wpbc_timeline__selection_progress">
						<span class="wpbc_booking_form_spin_loader wpbc_timeline__shared_spinner" aria-hidden="true"><span class="wpbc_spins_loader_wrapper"><span class="wpbc_one_spin_loader_mini2"></span></span></span>
						<span><# if ( data.state === 'applying' ) { #>{{ data.i18n.applying_availability }}<# } else if ( data.state === 'awaiting_readback' ) { #>{{ data.i18n.awaiting_readback }}<# } else { #>{{ data.i18n.checking_selection }}<# } #></span>
					</p>
				<# } else if ( data.state === 'error' ) { #>
					<p class="wpbc_timeline__selection_error" role="alert">{{ data.error_message }}</p>
					<button type="button" class="button" data-wpbc-timeline-time-rows-selection-retry>{{ data.i18n.retry_selection }}</button>
				<# } #>
			</div>
			<footer><button type="button" class="button-link" data-wpbc-timeline-time-rows-selection-cancel <# if ( data.state === 'applying' || data.state === 'awaiting_readback' ) { #>disabled<# } #>>{{ data.i18n.cancel_selection }}</button></footer>
		<# } #>
	</section>
</script>
