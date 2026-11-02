<?php
/**
 * Synchronized Resource and Timeline row-group WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-resource-row">
	<div
		class="wpbc_timeline__resource_row wpbc_timeline__resource_row--{{ data.node_role }} <# if ( data.is_details_expanded ) { #>is-expanded<# } #><# if ( data.open_row_presentation_ids.length ) { #> has-open-row-presentation<# } #>"
		data-wpbc-timeline-row-key="{{ data.row_key }}"
		data-wpbc-timeline-row-side="resource"
		data-wpbc-timeline-node-id="{{ data.node_id }}"
		data-wpbc-timeline-resource-title="{{ data.title }}"
		data-wpbc-timeline-parent-id="{{ data.parent_id || 0 }}"
		style="--wpbc-timeline-lanes: {{ data.lane_count || 1 }};"
		<# if ( ! data.is_hierarchy_visible ) { #>hidden<# } #>
	>
		<# if ( data.is_expandable || data.is_child || data.row_presentations.length ) { #>
			<div class="wpbc_timeline__row_controls">
				<# _.each( data.row_presentations, function( presentation ) { var toggle_state = data.row_presentation_toggle_states[ presentation.id ] || {}; #>
					<button
						type="button"
						class="wpbc_timeline__row_presentation_toggle"
						data-wpbc-timeline-row-presentation-toggle="{{ presentation.id }}"
						data-wpbc-timeline-resource-id="{{ data.id }}"
						aria-expanded="<# if ( toggle_state.is_open ) { #>true<# } else { #>false<# } #>"
						aria-controls="{{ toggle_state.controlled_host_ids }}"
						aria-label="{{ toggle_state.accessible_label }}"
						title="{{ toggle_state.accessible_label }}"
					>
						<span class="<# if ( toggle_state.is_open ) { #>wpbc-bi-chevron-down<# } else { #>wpbc-bi-chevron-right<# } #>" aria-hidden="true"></span>
					</button>
				<# } ); #>
				<# if ( data.is_expandable ) { #>
					<button
						type="button"
						class="wpbc_timeline__hierarchy_toggle"
						data-wpbc-timeline-hierarchy-toggle="{{ data.id }}"
						aria-expanded="<# if ( data.is_hierarchy_expanded ) { #>true<# } else { #>false<# } #>"
						aria-label="<# if ( data.is_hierarchy_expanded ) { #>{{ data.i18n.collapse_children }}<# } else { #>{{ data.i18n.expand_children }}<# } #>"
					>
						<span class="<# if ( data.is_hierarchy_expanded ) { #>wpbc-bi-dash-square-dotted<# } else { #>wpbc-bi-plus-square-dotted<# } #>" data-wpbc-timeline-hierarchy-icon aria-hidden="true"></span>
					</button>
				<# } else if ( data.is_child ) { #>
					<span class="wpbc_timeline__hierarchy_spacer" aria-hidden="true"></span>
					<span class="wpbc_timeline__tree_connector <# if ( data.is_last_child ) { #>is-last-child<# } #>" aria-hidden="true"></span>
				<# } #>
			</div>
		<# } #>
		<div class="wpbc_timeline__resource_identity">
			<# if ( data.image_url ) { #>
				<img src="{{ data.image_url }}" alt="" loading="lazy">
			<# } else { #>
				<span class="wpbc_timeline__resource_image_placeholder" aria-hidden="true"><span class="wpbc-bi-image"></span></span>
			<# } #>
			<div class="wpbc_timeline__resource_text">
				<strong>
					<span class="wpbc_timeline__resource_title" data-wpbc-ui-catalog-overflow-tooltip="{{ data.title }}">{{ data.title }}</span>
				</strong>
				<# if ( data.is_parent ) { #>
					<div class="wpbc_timeline__resource_labels">
						<span class="wpbc_timeline__parent_badge">{{ data.i18n.parent_resource }}</span>
						<span class="wpbc_timeline__capacity_badge">{{ data.capacity_label }}</span>
					</div>
				<# } #>
				<# if ( data.subtitle ) { #><span>{{ data.subtitle }}</span><# } #>
				<# _.each( data.row_presentations, function( presentation ) { var toggle_state = data.row_presentation_toggle_states[ presentation.id ] || {}; if ( presentation.toggle_open_label ) { #>
					<button
						type="button"
						class="wpbc_timeline__row_presentation_text_toggle"
						data-wpbc-timeline-row-presentation-toggle="{{ presentation.id }}"
						data-wpbc-timeline-resource-id="{{ data.id }}"
						aria-expanded="<# if ( toggle_state.is_open ) { #>true<# } else { #>false<# } #>"
						aria-controls="{{ toggle_state.controlled_host_ids }}"
						aria-label="{{ toggle_state.accessible_label }}"
					>
						<span class="wpbc_timeline__row_presentation_text_toggle_open">{{ presentation.toggle_open_label }}</span>
						<span class="wpbc_timeline__row_presentation_text_toggle_close">{{ presentation.toggle_close_label || presentation.toggle_open_label }}</span>
					</button>
				<# } } ); #>
			</div>
		</div>
		<div class="wpbc_timeline__resource_actions">
			<# if ( data.has_details ) { #>
				<button
					type="button"
					class="wpbc_timeline__row_toggle wpbc_timeline__resource_details_toggle"
					data-wpbc-timeline-row-toggle="{{ data.row_key }}"
					aria-expanded="<# if ( data.is_details_expanded ) { #>true<# } else { #>false<# } #>"
					aria-label="<# if ( data.is_details_expanded ) { #>{{ data.i18n.collapse_resource }}<# } else { #>{{ data.i18n.expand_resource }}<# } #>"
					title="<# if ( data.is_details_expanded ) { #>{{ data.i18n.collapse_resource }}<# } else { #>{{ data.i18n.expand_resource }}<# } #>"
				>
					<span class="wpbc-bi-info-circle" aria-hidden="true"></span>
				</button>
			<# } #>
			<div data-wpbc-timeline-resource-actions-host="{{ data.id }}"></div>
		</div>
		<# if ( data.has_details ) { #>
			<div class="wpbc_timeline__resource_details" <# if ( ! data.is_details_expanded ) { #>hidden<# } #> data-wpbc-timeline-row-details>
				<# if ( data.supports_capacity ) { #>
					<span>{{ data.i18n.capacity }}: {{ data.capacity }}</span>
					<# if ( data.child_count ) { #><span>{{ data.i18n.child_resources }}: {{ data.child_count }}</span><# } #>
				<# } else if ( data.description ) { #>
					<span class="wpbc_timeline__resource_description">{{ data.description }}</span>
				<# } #>
			</div>
		<# } #>
		<# _.each( data.row_presentations, function( presentation ) { var is_presentation_open = -1 !== data.open_row_presentation_ids.indexOf( presentation.id ); #>
			<div
				id="wpbc_timeline_row_presentation_resource_{{ data.id }}_{{ presentation.id }}"
				class="wpbc_timeline__row_presentation_host wpbc_timeline__row_presentation_host--resource"
				data-wpbc-timeline-row-presentation-host="{{ presentation.id }}"
				data-wpbc-timeline-row-presentation-side="resource"
				data-wpbc-timeline-resource-id="{{ data.id }}"
				role="region"
				aria-label="{{ presentation.label }}"
				aria-hidden="<# if ( is_presentation_open ) { #>false<# } else { #>true<# } #>"
				<# if ( ! is_presentation_open ) { #>hidden<# } #>
			></div>
		<# } ); #>
	</div>
	<div
		class="wpbc_timeline__canvas_row wpbc_timeline__canvas_row--{{ data.node_role }} <# if ( data.is_details_expanded ) { #>is-expanded<# } #><# if ( data.open_row_presentation_ids.length ) { #> has-open-row-presentation<# } #>"
		data-wpbc-timeline-row-key="{{ data.row_key }}"
		data-wpbc-timeline-row-side="canvas"
		data-wpbc-timeline-node-id="{{ data.node_id }}"
		data-wpbc-timeline-parent-id="{{ data.parent_id || 0 }}"
		style="--wpbc-timeline-lanes: {{ data.lane_count || 1 }};"
		<# if ( ! data.is_hierarchy_visible ) { #>hidden<# } #>
	>
		<div
			class="wpbc_timeline__canvas_track"
			data-wpbc-timeline-selection-track
			data-wpbc-timeline-resource-id="{{ data.id }}"
			role="gridcell"
			tabindex="0"
			aria-label="{{ data.title }}"
			aria-description="{{ data.i18n.selection_instructions }}"
		>
			<# _.each( data.axis.cells, function( cell ) { #>
				<span class="wpbc_timeline__canvas_cell <# if ( ! data.axis.is_timed && cell.is_today ) { #>is-today<# } #><# if ( cell.is_weekend ) { #> is-weekend<# } #>" data-wpbc-timeline-date="{{ cell.date }}" data-wpbc-timeline-cell-start="{{ cell.start_at }}" data-wpbc-timeline-cell-end="{{ cell.end_at }}" aria-hidden="true"></span>
			<# } ); #>
			<div data-wpbc-timeline-segments data-wpbc-timeline-booking-accessory-overlay></div>
			<div class="wpbc_timeline__selection_host" data-wpbc-timeline-selection-host></div>
		</div>
		<# if ( data.has_details ) { #>
			<div class="wpbc_timeline__canvas_details" <# if ( ! data.is_details_expanded ) { #>hidden<# } #> data-wpbc-timeline-row-details></div>
		<# } #>
		<# _.each( data.row_presentations, function( presentation ) { var is_presentation_open = -1 !== data.open_row_presentation_ids.indexOf( presentation.id ); #>
			<div
				id="wpbc_timeline_row_presentation_canvas_{{ data.id }}_{{ presentation.id }}"
				class="wpbc_timeline__row_presentation_host wpbc_timeline__row_presentation_host--canvas"
				data-wpbc-timeline-row-presentation-host="{{ presentation.id }}"
				data-wpbc-timeline-row-presentation-side="canvas"
				data-wpbc-timeline-resource-id="{{ data.id }}"
				role="region"
				aria-label="{{ presentation.label }}"
				aria-hidden="<# if ( is_presentation_open ) { #>false<# } else { #>true<# } #>"
				<# if ( ! is_presentation_open ) { #>hidden<# } #>
			></div>
		<# } ); #>
	</div>
</script>
