<?php
/**
 * Timeline loading-state WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-loading">
	<div class="wpbc_timeline__state wpbc_timeline__state--loading" role="status">
		<div class="wpbc_spins_loading_container">
			<div class="wpbc_booking_form_spin_loader" aria-hidden="true">
				<div class="wpbc_spins_loader_wrapper">
					<div class="wpbc_one_spin_loader_mini2"></div>
				</div>
			</div>
			<span>{{ data.i18n.loading }}</span>
		</div>
	</div>
</script>
