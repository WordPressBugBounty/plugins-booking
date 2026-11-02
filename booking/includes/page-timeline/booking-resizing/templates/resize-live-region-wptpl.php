<?php
/**
 * Timeline booking-resizing polite live-region template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-<?php echo esc_attr( WPBC_Timeline_Booking_Resizing_Config::TEMPLATE_LIVE_REGION ); ?>">
	<span class="screen-reader-text" role="status" aria-live="polite" aria-atomic="true">{{ data.message }}</span>
</script>
