<?php
/**
 * Shared empty-state template for a template-driven catalog.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-ui-catalog-empty">
	<div class="wpbc_ui_catalog__empty" role="status">
		<span class="wpbc-bi-inbox" aria-hidden="true"></span>
		<h2>{{ data.title }}</h2>
		<p>{{ data.message }}</p>
	</div>
</script>
