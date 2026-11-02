<?php
/**
 * Timeline Resource selector row WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-resource-selector-row">
	<label
		class="wpbc_timeline_resource_navigation__row <# if ( data.is_child ) { #>is-child<# } #>"
		data-wpbc-timeline-resource-selector-row="{{ data.id }}"
		data-wpbc-timeline-resource-group="{{ data.group_id }}"
		<# if ( data.is_group_control ) { #>data-wpbc-timeline-resource-group-control<# } #>
		style="--wpbc-timeline-resource-depth: <# if ( data.is_child ) { #>1<# } else { #>0<# } #>;"
	>
		<input
			type="checkbox"
			value="{{ data.id }}"
			data-wpbc-timeline-resource-checkbox
			<# if ( data.is_group_control ) { #>data-wpbc-timeline-resource-group-checkbox<# } #>
			aria-label="{{ data.checkbox_label }}"
			<# if ( data.is_selected ) { #>checked<# } #>
		>
		<span class="wpbc_timeline_resource_navigation__thumbnail" aria-hidden="true">
			<# if ( data.image_url ) { #><img src="{{ data.image_url }}" alt=""><# } else { #><span class="wpbc_icn_home"></span><# } #>
		</span>
		<span class="wpbc_timeline_resource_navigation__row_text">
			<strong>{{ data.title }}</strong>
			<# if ( data.subtitle ) { #><span>{{ data.subtitle }}</span><# } #>
		</span>
	</label>
</script>
