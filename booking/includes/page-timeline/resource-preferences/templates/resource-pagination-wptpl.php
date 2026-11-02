<?php
/**
 * Timeline Resource pagination WordPress template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-resource-pagination">
	<nav class="wpbc_timeline_resource_navigation__pagination is-{{ data.context }}" aria-label="{{ data.navigation_label }}">
		<button
			type="button"
			class="button"
			data-wpbc-timeline-resource-page="previous"
			data-wpbc-timeline-resource-page-context="{{ data.context }}"
			aria-label="{{ data.i18n.previous_page_label }}"
			<# if ( ! data.has_previous || data.is_busy ) { #>disabled<# } #>
		>
			<span class="wpbc_icn_chevron_left" aria-hidden="true"></span>
			<span>{{ data.i18n.previous }}</span>
		</button>
		<span class="wpbc_timeline_resource_navigation__page_status">{{ data.page_status }}</span>
		<button
			type="button"
			class="button"
			data-wpbc-timeline-resource-page="next"
			data-wpbc-timeline-resource-page-context="{{ data.context }}"
			aria-label="{{ data.i18n.next_page_label }}"
			<# if ( ! data.has_next || data.is_busy ) { #>disabled<# } #>
		>
			<span>{{ data.i18n.next }}</span>
			<span class="wpbc_icn_chevron_right" aria-hidden="true"></span>
		</button>
	</nav>
</script>
