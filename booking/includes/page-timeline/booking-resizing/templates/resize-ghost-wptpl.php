<?php
/**
 * Timeline booking-resizing dashed-ghost template.
 *
 * The browser controller places one instance for each visible affected
 * occurrence and updates presentation-only geometry during a pointer gesture.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-<?php echo esc_attr( WPBC_Timeline_Booking_Resizing_Config::TEMPLATE_GHOST ); ?>">
	<span class="wpbc_timeline_booking_resize__ghost" data-wpbc-timeline-booking-resize-ghost aria-hidden="true">
		<span class="wpbc_timeline_booking_resize__ghost_duration">{{ data.duration_label }}</span>
	</span>
</script>
