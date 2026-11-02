<?php
/**
 * Timeline Resource selector WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-resource-selector">
	<div
		class="wpbc_shared_ui_popover wpbc_timeline_resource_navigation__selector"
		data-wpbc-shared-ui-popover="wpbc-timeline-resource-selector"
		data-wpbc-shared-ui-layer-owner="wpbc-timeline-resource-selector"
	>
		<div
			class="wpbc_timeline_resource_navigation__drawer_backdrop"
			data-wpbc-shared-ui-popover-close
			data-wpbc-timeline-resource-drawer-backdrop
			aria-hidden="true"
			hidden
		></div>
		<button
			type="button"
			class="button wpbc_shared_ui_popover__trigger wpbc_timeline_resource_navigation__trigger"
			data-wpbc-shared-ui-popover-trigger
			data-wpbc-timeline-resource-selector-trigger
			aria-haspopup="dialog"
			aria-expanded="false"
			aria-controls="wpbc_timeline_resource_selector_panel"
		>
			<span class="wpbc_icn_tune" aria-hidden="true"></span>
			<span data-wpbc-timeline-resource-selector-label>{{ data.trigger_label }}</span>
			<span class="wpbc_icn_expand_more" aria-hidden="true"></span>
		</button>
		<div
			id="wpbc_timeline_resource_selector_panel"
			class="wpbc_shared_ui_popover__panel wpbc_timeline_resource_navigation__panel"
			data-wpbc-shared-ui-popover-panel
			role="dialog"
			aria-modal="false"
			aria-labelledby="wpbc_timeline_resource_selector_heading"
			aria-describedby="wpbc_timeline_resource_selector_description"
			data-wpbc-timeline-resource-selector-panel
			data-wpbc-timeline-resource-layout="popover"
			hidden
		>
			<span class="wpbc_timeline_resource_navigation__drawer_handle" aria-hidden="true"></span>
			<h2 id="wpbc_timeline_resource_selector_heading" class="screen-reader-text">{{ data.i18n.choose_resources }}</h2>
			<p id="wpbc_timeline_resource_selector_description" class="screen-reader-text">{{ data.i18n.selector_instructions }}</p>
			<div class="wpbc_timeline_resource_navigation__search_controls">
				<label class="screen-reader-text" for="wpbc_timeline_resource_selector_search">{{ data.i18n.search_resources }}</label>
				<div class="wpbc_timeline_resource_navigation__search">
					<span class="wpbc_icn_search" aria-hidden="true"></span>
					<input
						type="search"
						id="wpbc_timeline_resource_selector_search"
						data-wpbc-timeline-resource-search
						placeholder="{{ data.i18n.search_resources }}"
						autocomplete="off"
					>
				</div>
				<div class="wpbc_timeline_resource_navigation__preference_controls">
					<label class="screen-reader-text" for="wpbc_timeline_resource_selector_sort">{{ data.i18n.sort_resources }}</label>
					<select
						id="wpbc_timeline_resource_selector_sort"
						class="wpbc_timeline_resource_navigation__sort"
						data-wpbc-timeline-resource-sort
						aria-label="{{ data.i18n.sort_resources }}"
						autocomplete="off"
					>
						<# _.each( data.sort_options || [], function ( option ) { #>
							<option value="{{ option.value }}" <# if ( option.value === data.sort_order ) { #>selected<# } #>>{{ option.label }}</option>
						<# } ); #>
					</select>
					<label class="screen-reader-text" for="wpbc_timeline_resource_selector_page_size">{{ data.i18n.resources_per_page }}</label>
					<select
						id="wpbc_timeline_resource_selector_page_size"
						class="wpbc_timeline_resource_navigation__page_size"
						data-wpbc-timeline-resource-page-size
						aria-label="{{ data.i18n.resources_per_page }}"
						autocomplete="off"
					>
						<# _.each( data.page_size_options || [], function ( page_size ) { #>
							<option value="{{ page_size }}" <# if ( page_size === data.per_page ) { #>selected<# } #>>{{ page_size }} {{ data.i18n.per_page }}</option>
						<# } ); #>
					</select>
				</div>
			</div>
			<div class="wpbc_timeline_resource_navigation__selection_toolbar">
				<span class="wpbc_timeline_resource_navigation__selection_actions">
					<button type="button" class="button-link" data-wpbc-timeline-resource-select-all>{{ data.i18n.select_all }}</button>
					<button type="button" class="button-link" data-wpbc-timeline-resource-clear-all>{{ data.i18n.clear_all }}</button>
				</span>
				<span data-wpbc-timeline-resource-selected-count>{{ data.selected_label }}</span>
			</div>
			<div class="wpbc_timeline_resource_navigation__status" data-wpbc-timeline-resource-selector-status role="status" aria-live="polite" hidden>
				<span class="wpbc_booking_form_spin_loader" data-wpbc-timeline-resource-selector-spinner aria-hidden="true" hidden>
					<span class="wpbc_spins_loader_wrapper"><span class="wpbc_one_spin_loader_mini2"></span></span>
				</span>
				<span data-wpbc-timeline-resource-selector-status-message></span>
			</div>
			<div class="wpbc_timeline_resource_navigation__rows" data-wpbc-timeline-resource-selector-rows></div>
			<div data-wpbc-timeline-resource-selector-pagination></div>
			<p class="wpbc_timeline_resource_navigation__validation" data-wpbc-timeline-resource-validation role="alert" hidden>
				<span class="wpbc_icn_error_outline" aria-hidden="true"></span>
				<span data-wpbc-timeline-resource-validation-message>{{ data.i18n.minimum_one }}</span>
			</p>
			<div class="wpbc_timeline_resource_navigation__footer">
				<button type="button" class="button" data-wpbc-shared-ui-popover-close data-wpbc-timeline-resource-cancel>{{ data.i18n.cancel }}</button>
				<button type="button" class="button button-primary" data-wpbc-timeline-resource-apply>{{ data.i18n.apply }}</button>
			</div>
		</div>
	</div>
</script>
