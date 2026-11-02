<?php
/**
 * Accessible chronological summary for the Timeline time-rows presentation.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-time-rows-summary">
	<details id="wpbc_time_rows_summary_{{ data.resource_id }}" class="wpbc_timeline_time_rows__summary">
		<summary>{{ data.i18n.schedule_summary }}</summary>
		<# if ( data.records.length ) { #>
			<ol>
				<# _.each( data.records, function( record ) { #>
					<li><strong>{{ record.kind_label }}</strong><# if ( record.date ) { #> &middot; <time datetime="{{ record.date }}">{{ record.date }}</time><# } #><# if ( record.time_label ) { #> &middot; {{ record.time_label }}<# } #><# if ( record.label ) { #> &middot; {{ record.label }}<# } #><# if ( record.status_label ) { #> &middot; {{ record.status_label }}<# } #><# if ( record.continuation_label ) { #> &middot; {{ record.continuation_label }}<# } #></li>
				<# } ); #>
			</ol>
		<# } else { #>
			<p>{{ data.i18n.no_summary_records }}</p>
		<# } #>
	</details>
</script>
