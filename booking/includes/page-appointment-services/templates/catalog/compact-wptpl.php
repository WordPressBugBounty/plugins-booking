<?php
/**
 * Appointment Services compact-pack host WP template.
 *
 * Keeps the semantic table and authorized fields while applying the compact
 * Service presentation and shared pagination controls.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
?>
<script type="text/html" id="tmpl-wpbc-appointment-services-compact">
	<div class="wpbc_ui_listing__table_wrap wpbc_appointment_services__table_wrap wpbc_appointment_services__table_wrap--compact" tabindex="0" role="region" aria-label="{{ data.i18n.catalog_label }}">
		<table class="wpbc_ui_listing__table wpbc_ui_listing__table--catalog wpbc_ui_listing__table--responsive wpbc_appointment_services__table wpbc_appointment_services__table--compact">
			<caption class="screen-reader-text">{{ data.i18n.catalog_label }}</caption><thead data-wpbc-appointment-services-header></thead><tbody data-wpbc-appointment-services-rows></tbody>
		</table>
	</div>
	<div data-wpbc-appointment-services-pagination></div>
</script>
