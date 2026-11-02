<?php
/**
 * Timeline Resource-row action-menu host template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-resource-row-actions">
	<div
		class="wpbc_timeline_resource_settings__row_actions"
		data-wpbc-timeline-resource-settings-actions="{{ data.resource_id }}"
		data-wpbc-timeline-resource-settings-menu-host
	></div>
</script>
