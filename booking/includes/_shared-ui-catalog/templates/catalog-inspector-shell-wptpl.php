<?php
/**
 * Shared native-sidebar inspector state shell.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-ui-catalog-inspector-shell">
	<div class="wpbc_ui_catalog__inspector" data-wpbc-ui-catalog-inspector="{{ data.catalog_id }}">
		<div class="wpbc_ui_catalog__inspector_empty" data-wpbc-ui-catalog-inspector-empty>
			<span class="{{ data.empty_icon }}" aria-hidden="true"></span>
			<h2>{{ data.empty_title }}</h2>
			<p>{{ data.empty_message }}</p>
		</div>
		<div class="wpbc_ui_catalog__inspector_loading" data-wpbc-ui-catalog-inspector-loading hidden role="status" aria-live="polite">
			<div class="wpbc_spins_loading_container wpbc_bfb_spins_loading_container">
				<div class="wpbc_booking_form_spin_loader" aria-hidden="true"><div class="wpbc_spins_loader_wrapper"><div class="wpbc_one_spin_loader_mini2"></div></div></div>
				<span>{{ data.loading_label }}</span>
			</div>
		</div>
		<div class="notice inline notice-error" data-wpbc-ui-catalog-inspector-error hidden role="alert"><p></p></div>
		<div data-wpbc-ui-catalog-inspector-form></div>
	</div>
</script>
