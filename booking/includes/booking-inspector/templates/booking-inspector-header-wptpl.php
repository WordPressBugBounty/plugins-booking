<?php
/**
 * Booking Inspector identity header template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-inspector-header">
	<header class="wpbc_booking_inspector__identity" data-wpbc-booking-inspector-header>
		<div class="wpbc_booking_inspector__identity_title">
			<span>{{ data.i18n.booking_number }}: {{ data.booking_id }}</span>
			<# if ( data.status && data.status.label ) { #>
			<span class="wpbc_booking_inspector__status wpbc_booking_inspector__status--{{ data.status.key }}">{{ data.status.label }}</span>
			<# } #>
		</div>
	</header>
</script>
