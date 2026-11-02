<?php
/**
 * Timeline mobile Resource-pane toggle WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-resource-pane-toggle">
	<button
		type="button"
		class="button wpbc_timeline_resource_navigation__pane_toggle"
		data-wpbc-timeline-resource-pane-toggle
		aria-controls="wpbc_timeline_resource_pane"
		aria-expanded="true"
		aria-label="{{ data.hide_label }}"
		title="{{ data.hide_label }}"
		hidden
	>
		<span class="wpbc-bi-layout-sidebar-inset" aria-hidden="true"></span>
		<span class="screen-reader-text" data-wpbc-timeline-resource-pane-toggle-label>{{ data.hide_label }}</span>
	</button>
</script>
