<?php
/**
 * Appointment Service status-label WP template.
 *
 * Maps the validated status identifier and translated label into the shared
 * Service presentation without deciding domain status behavior.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
?>
<script type="text/html" id="tmpl-wpbc-appointment-service-status-label"><span class="wpbc_appointment_services__status status-{{ data.status }}">{{ data.label }}</span></script>
