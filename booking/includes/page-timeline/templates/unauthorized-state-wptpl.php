<?php
/**
 * Timeline unauthorized-state WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-unauthorized">
	<div class="wpbc_timeline__state wpbc_timeline__state--unauthorized" role="alert">
		<span class="wpbc-bi-lock" aria-hidden="true"></span>
		<div>
			<h2>{{ data.i18n.unauthorized_title }}</h2>
			<p>{{ data.i18n.unauthorized_message }}</p>
		</div>
	</div>
</script>
