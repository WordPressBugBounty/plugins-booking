<?php
/**
 * Appointment Service edit-inspector header WP template.
 *
 * Identifies edit mode above the existing Service-owned inspector fields;
 * authorization and persistence remain in the Service mutation endpoint.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
?>
<script type="text/html" id="tmpl-wpbc-appointment-service-inspector-edit">
	<div class="wpbc_bfb__inspector__head wpbc_ui_catalog_inspector__header" data-wpbc-appointment-service-inspector-template="edit">
		<div class="header_container"><div class="header_title_content"><h3 class="title">{{ data.title }}</h3><span class="wpbc_ui_catalog_inspector__context">{{ data.context }}</span><div class="desc">{{ data.description }}</div></div></div>
	</div>
</script>
