<?php
/**
 * Timeline recoverable-error WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-error">
	<div class="wpbc_timeline__state wpbc_timeline__state--error" role="alert">
		<span class="wpbc-bi-exclamation-triangle" aria-hidden="true"></span>
		<div>
			<h2>{{ data.i18n.error_title }}</h2>
			<p>{{ data.i18n.error_message }}</p>
			<div class="wpbc_timeline__state_actions">
				<button type="button" class="button button-primary" data-wpbc-timeline-retry>{{ data.i18n.retry }}</button>
				<a class="button" href="{{ data.links.legacy_timeline }}">{{ data.i18n.open_legacy_timeline }}</a>
			</div>
		</div>
	</div>
</script>
