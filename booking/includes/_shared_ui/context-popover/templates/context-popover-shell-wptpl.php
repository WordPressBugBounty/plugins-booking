<?php
/**
 * Domain-neutral administration Context Popover shell WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-shared-ui-context-popover-shell">
	<#
	var component_id = String( data.id || '' ).replace( /[^A-Za-z0-9_-]/g, '' );
	var mode = 'interactive' === data.mode ? 'interactive' : 'preview';
	var owner_id = String( data.owner_id || component_id ).replace( /[^A-Za-z0-9_-]/g, '' );
	var interaction_group = String( data.interaction_group || component_id ).replace( /[^A-Za-z0-9_-]/g, '' );
	var heading_id = component_id + '__heading';
	var status_id = component_id + '__status';
	var role = 'interactive' === mode ? 'dialog' : 'tooltip';
	#>
	<section
		id="{{ component_id }}"
		class="wpbc_shared_ui_context_popover wpbc_shared_ui_context_popover--{{ mode }}"
		data-wpbc-shared-ui-context-popover-surface
		data-wpbc-shared-ui-context-popover-owner="{{ component_id }}"
		data-wpbc-shared-ui-context-popover-mode="{{ mode }}"
		data-wpbc-shared-ui-context-popover-state="idle"
		data-wpbc-shared-ui-layer-type="context_popover"
		data-wpbc-shared-ui-layer-instance="{{ component_id }}"
		data-wpbc-shared-ui-layer-owner="{{ owner_id }}"
		data-wpbc-shared-ui-layer-interaction-group="{{ interaction_group }}"
		role="{{ role }}"
		<# if ( data.title ) { #>aria-labelledby="{{ heading_id }}"<# } #>
		aria-describedby="{{ status_id }}"
		<# if ( 'interactive' === mode ) { #>aria-modal="false"<# } #>
		aria-busy="false"
		hidden
	>
		<# if ( data.title || 'interactive' === mode ) { #>
		<header class="wpbc_shared_ui_context_popover__header">
			<# if ( data.drag_enabled ) { #>
			<button
				type="button"
				class="wpbc_shared_ui_context_popover__drag"
				data-wpbc-shared-ui-context-popover-drag
				aria-label="{{ data.drag_label }}"
				title="{{ data.drag_label }}"
				hidden
				disabled
			>
				<span class="wpbc_icn_drag_indicator" aria-hidden="true"></span>
			</button>
			<# } #>
			<# if ( data.title ) { #><h3 id="{{ heading_id }}" class="wpbc_shared_ui_context_popover__heading" data-wpbc-shared-ui-context-popover-heading>{{ data.title }}</h3><# } #>
			<div class="wpbc_shared_ui_context_popover__header_content" data-wpbc-shared-ui-context-popover-header-content hidden></div>
			<# if ( 'interactive' === mode ) { #>
			<span class="wpbc_shared_ui_context_popover__header_actions">
				<# if ( data.pin_enabled ) { #>
				<button
					type="button"
					class="wpbc_shared_ui_context_popover__pin"
					data-wpbc-shared-ui-context-popover-pin
					data-pin-label="{{ data.pin_label }}"
					data-pinned-label="{{ data.pinned_label }}"
					data-unpin-label="{{ data.unpin_label }}"
					aria-label="{{ data.pin_label }}"
					aria-pressed="false"
				>
					<span class="wpbc-bi-pin" aria-hidden="true"></span>
					<span data-wpbc-shared-ui-context-popover-pin-label>{{ data.pin_label }}</span>
				</button>
				<# } #>
				<button type="button" class="wpbc_shared_ui_context_popover__close" data-wpbc-shared-ui-context-popover-close aria-label="{{ data.close_label }}">
					<span aria-hidden="true">&times;</span>
				</button>
			</span>
			<# } #>
		</header>
		<# } #>

		<div id="{{ status_id }}" class="wpbc_shared_ui_context_popover__status" data-wpbc-shared-ui-context-popover-status role="status" aria-live="polite"></div>

		<div class="wpbc_shared_ui_context_popover__loading" data-wpbc-shared-ui-context-popover-loading hidden>
			<span class="wpbc_booking_form_spin_loader" aria-hidden="true">
				<span class="wpbc_spins_loader_wrapper"><span class="wpbc_one_spin_loader_mini2"></span></span>
			</span>
			<span data-wpbc-shared-ui-context-popover-loading-label>{{ data.loading_label }}</span>
		</div>

		<div class="wpbc_shared_ui_context_popover__content" data-wpbc-shared-ui-context-popover-content hidden></div>

		<div class="wpbc_shared_ui_context_popover__empty" data-wpbc-shared-ui-context-popover-empty hidden>
			<p>{{ data.empty_label }}</p>
		</div>

		<div class="wpbc_shared_ui_context_popover__error notice notice-error inline" data-wpbc-shared-ui-context-popover-error hidden>
			<p>{{ data.error_label }}</p>
			<button type="button" class="button button-secondary" data-wpbc-shared-ui-context-popover-retry hidden>{{ data.retry_label }}</button>
		</div>

		<# if ( data.resize_enabled ) { #>
		<button
			type="button"
			class="wpbc_shared_ui_context_popover__resize"
			data-wpbc-shared-ui-context-popover-resize
			aria-label="{{ data.resize_label }}"
			title="{{ data.resize_label }}"
			hidden
			disabled
		>
			<span class="wpbc_icn_open_in_full wpbc_icn_rotate_90" aria-hidden="true"></span>
		</button>
		<# } #>
	</section>
</script>
