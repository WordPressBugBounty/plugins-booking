<?php
/**
 * Availability background slices for the Timeline time-rows presentation.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-time-rows-availability">
	<# _.each( data.availability_slices, function( slice ) { #>
		<span class="wpbc_timeline_time_rows__availability {{ slice.css_class }}" style="inset-inline-start: {{ slice.left_percent }}%; inline-size: {{ slice.width_percent }}%; inset-block-start: {{ slice.top_percent }}%; block-size: {{ slice.height_percent }}%;" title="{{ slice.label }}" aria-hidden="true"></span>
	<# } ); #>
</script>
