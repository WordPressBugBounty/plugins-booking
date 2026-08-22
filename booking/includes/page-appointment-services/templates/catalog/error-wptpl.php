<?php
/**
 * Appointment Services error-state WP template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-appointment-services-error">
	<div class="wpbc_appointment_services__empty wpbc_appointment_services__empty--error" role="alert">
		<span class="wpbc-bi-exclamation-triangle" aria-hidden="true"></span>
		<div><h2>{{ data.title }}</h2><p>{{ data.message }}</p></div>
	</div>
</script>
