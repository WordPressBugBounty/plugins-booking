<?php
/**
 * Appointment Services safe bulk-field editor WP template.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }
?>
<script type="text/html" id="tmpl-wpbc-appointment-services-bulk-edit">
	<div class="wpbc_appointment_services__operation">
		<h2>{{ data.title }}</h2>
		<p>{{ data.description }}</p>
		<# _.each( data.fields, function ( field ) { #>
			<label class="wpbc_appointment_services__bulk_field">
				<span><input type="checkbox" data-wpbc-appointment-services-bulk-enable="{{ field.key }}"> <strong>{{ field.label }}</strong></span>
				<# if ( 'select' === field.type ) { #>
					<select data-wpbc-appointment-services-bulk-value="{{ field.key }}" disabled>
						<# _.each( field.options, function ( option ) { #><option value="{{ option.value }}">{{ option.label }}</option><# } ); #>
					</select>
				<# } else { #>
					<input type="{{ field.type }}" value="{{ field.default_value }}" min="{{ field.min }}" max="{{ field.max }}" step="{{ field.step }}" data-wpbc-appointment-services-bulk-value="{{ field.key }}" disabled>
					<input type="range" value="{{ field.default_value }}" min="{{ field.min }}" max="{{ field.max }}" step="{{ field.step }}" data-wpbc-appointment-services-bulk-range="{{ field.key }}" aria-label="{{ field.label }}" disabled>
				<# } #>
			</label>
		<# } ); #>
	</div>
</script>
