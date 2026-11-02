<?php
/**
 * Availability state notice for the Timeline time-rows presentation.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-time-rows-state">
	<# if ( 'loaded' !== data.state ) { #>
		<p class="wpbc_timeline_time_rows__state is-{{ data.state }}" role="status" aria-live="polite">
			<span class="wpbc-bi-info-circle" aria-hidden="true"></span>
			<span>{{ data.message }}</span>
		</p>
	<# } #>
</script>
