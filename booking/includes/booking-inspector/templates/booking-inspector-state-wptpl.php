<?php
/**
 * Booking Inspector loading, empty, unsupported, and error state template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-inspector-state">
	<div class="wpbc_booking_inspector__state wpbc_booking_inspector__state--{{ data.state }}" <# if ( 'loading' === data.state ) { #>role="status"<# } else if ( 'error' === data.state ) { #>role="alert"<# } #>>
		<# if ( data.icon_class ) { #><span class="{{ data.icon_class }}" aria-hidden="true"></span><# } #>
		<p>{{ data.message }}</p>
	</div>
</script>
