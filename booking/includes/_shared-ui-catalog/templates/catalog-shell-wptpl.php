<?php
/**
 * Shared loading-state template for a template-driven catalog.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-ui-catalog-shell">
	<section class="wpbc_ui_catalog" data-wpbc-ui-catalog="{{ data.catalog_id }}" aria-label="{{ data.aria_label }}" aria-busy="true">
		<div class="wpbc_spins_loading_container wpbc_ui_catalog__loading" role="status">
			<div class="wpbc_booking_form_spin_loader" aria-hidden="true">
				<div class="wpbc_spins_loader_wrapper">
					<div class="wpbc_one_spin_loader_mini2"></div>
				</div>
			</div>
			<span>{{ data.loading_message }}</span>
		</div>
	</section>
</script>
