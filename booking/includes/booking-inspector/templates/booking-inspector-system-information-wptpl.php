<?php
/**
 * Booking Inspector system-information card template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-booking-inspector-system-information">
	<# if ( data.created_label || data.last_modified_label ) { #>
	<section class="wpbc_booking_inspector__card wpbc_booking_inspector__system_information">
		<h4>{{ data.i18n.system_information }}</h4>
		<dl>
			<# if ( data.created_label ) { #><div><dt>{{ data.i18n.created }}</dt><dd><time datetime="{{ data.created_at }}">{{ data.created_label }}</time></dd></div><# } #>
			<# if ( data.last_modified_label ) { #><div><dt>{{ data.i18n.last_updated }}</dt><dd><time datetime="{{ data.last_modified_at }}">{{ data.last_modified_label }}</time></dd></div><# } #>
		</dl>
	</section>
	<# } #>
</script>
