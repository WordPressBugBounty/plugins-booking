<?php
/**
 * Domain-neutral administration inspector shell WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-shared-ui-inspector">
	<#
	var component_id = String( data.id || '' ).replace( /[^A-Za-z0-9_-]/g, '' );
	var heading_id = component_id + '__heading';
	var status_id = component_id + '__status';
	#>
	<div
		class="wpbc_shared_ui_inspector"
		data-wpbc-shared-ui-inspector="{{ component_id }}"
		data-wpbc-shared-ui-layer-type="inspector"
		data-wpbc-shared-ui-layer-instance="{{ component_id }}"
		data-wpbc-shared-ui-layer-owner="{{ component_id }}"
		data-wpbc-shared-ui-layer-interaction-group="{{ component_id }}"
		hidden
	>
		<div class="wpbc_shared_ui_inspector__backdrop" data-wpbc-shared-ui-inspector-close aria-hidden="true"></div>
		<section class="wpbc_shared_ui_inspector__panel" role="dialog" aria-modal="true" aria-labelledby="{{ heading_id }}" aria-describedby="{{ status_id }}" tabindex="-1">
			<header class="wpbc_shared_ui_inspector__header">
				<h2 id="{{ heading_id }}" class="wpbc_shared_ui_inspector__heading" tabindex="-1">{{ data.title }}</h2>
				<div class="wpbc_shared_ui_inspector__header_content" data-wpbc-shared-ui-inspector-header-content hidden></div>
				<button type="button" class="wpbc_shared_ui_inspector__close" data-wpbc-shared-ui-inspector-close aria-label="{{ data.close_label }}">
					<span class="wpbc-bi-x-lg" aria-hidden="true"></span>
				</button>
			</header>
			<div id="{{ status_id }}" class="wpbc_shared_ui_inspector__status" data-wpbc-shared-ui-inspector-status role="status" aria-live="polite"></div>
			<div class="wpbc_shared_ui_inspector__loading wpbc_spins_loading_container" data-wpbc-shared-ui-inspector-loading hidden>
				<div class="wpbc_booking_form_spin_loader" aria-hidden="true"><div class="wpbc_spins_loader_wrapper"><div class="wpbc_one_spin_loader_mini2"></div></div></div>
				<span data-wpbc-shared-ui-inspector-loading-label>{{ data.loading_label }}</span>
			</div>
			<div class="notice inline notice-error wpbc_shared_ui_inspector__error" data-wpbc-shared-ui-inspector-error hidden role="alert"><p></p></div>
			<div class="wpbc_shared_ui_inspector__content" data-wpbc-shared-ui-inspector-content hidden></div>
		</section>
	</div>
</script>
