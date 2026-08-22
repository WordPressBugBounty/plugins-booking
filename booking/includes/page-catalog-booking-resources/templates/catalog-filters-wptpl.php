<?php
/**
 * Booking Resources search and type filters template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-resources-filters">
	<# if ( data.show_filters ) { #>
		<form class="wpbc_booking_resources__filters" action="#" role="search" data-wpbc-ui-catalog-filters>
			<label class="wpbc_booking_resources__search" for="wpbc_catalog_booking_resource_search">
				<span class="wpbc-bi-search" aria-hidden="true"></span>
				<span class="screen-reader-text">{{ data.i18n.search_label }}</span>
				<input type="search" id="wpbc_catalog_booking_resource_search" value="{{ data.search }}" placeholder="{{ data.i18n.search_placeholder }}" autocomplete="off" data-wpbc-ui-catalog-search>
				<button type="button" class="wpbc_booking_resources__search_clear" aria-label="{{ data.i18n.search_clear }}" data-wpbc-ui-catalog-search-clear<# if ( ! data.search ) { #> hidden<# } #>>
					<span class="wpbc-bi-x-lg" aria-hidden="true"></span>
				</button>
			</label>
			<# if ( data.show_resource_type_filter ) { #>
				<label class="screen-reader-text" for="wpbc_catalog_booking_resource_type">{{ data.i18n.resource_type_label }}</label>
				<select id="wpbc_catalog_booking_resource_type" data-wpbc-ui-catalog-filter="resource_type" autocomplete="off">
					<option value="all"<# if ( 'all' === data.resource_type ) { #> selected<# } #>>{{ data.i18n.resource_type_all }}</option>
					<option value="single"<# if ( 'single' === data.resource_type ) { #> selected<# } #>>{{ data.i18n.resource_type_single }}</option>
					<option value="parent"<# if ( 'parent' === data.resource_type ) { #> selected<# } #>>{{ data.i18n.resource_type_parent }}</option>
					<option value="child"<# if ( 'child' === data.resource_type ) { #> selected<# } #>>{{ data.i18n.resource_type_child }}</option>
				</select>
			<# } #>
		</form>
	<# } #>
</script>
