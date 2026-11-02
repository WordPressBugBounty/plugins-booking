<?php
/**
 * Timeline booking-resizing loading-marker template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-<?php echo esc_attr( WPBC_Timeline_Booking_Resizing_Config::TEMPLATE_LOADING ); ?>">
	<span class="wpbc_timeline_booking_resize__loading" aria-hidden="true">
		<# if ( data.show_start ) { #>
		<span class="wpbc_timeline_booking_resize__loading_marker wpbc_timeline_booking_resize__loading_marker--start"></span>
		<# } #>
		<# if ( data.show_end ) { #>
		<span class="wpbc_timeline_booking_resize__loading_marker wpbc_timeline_booking_resize__loading_marker--end"></span>
		<# } #>
	</span>
</script>
