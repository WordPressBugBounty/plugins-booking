<?php
/**
 * Appointment Services cards-pack host WP template.
 *
 * Provides presentation-only sorting, card, and pagination mount points. The
 * shared controller and Service adapter provide the authorized response data.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
?>
<script type="text/html" id="tmpl-wpbc-appointment-services-cards">
	<div class="wpbc_appointment_services__cards_header" data-wpbc-appointment-services-cards-header></div>
	<div class="wpbc_appointment_services__cards" role="list" aria-label="{{ data.i18n.catalog_label }}" data-wpbc-appointment-services-cards></div>
	<div data-wpbc-appointment-services-pagination></div>
</script>
