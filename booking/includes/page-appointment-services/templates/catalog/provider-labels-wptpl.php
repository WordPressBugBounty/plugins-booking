<?php
/**
 * Appointment Service Provider-labels WP template.
 *
 * Presents only Provider identity and availability links already authorized
 * and sanitized by the Service DTO.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
?>
<script type="text/html" id="tmpl-wpbc-appointment-service-provider-labels">
	<# if ( data.providers.length ) { var visible_providers = data.providers.slice( 0, data.max_visible || 3 ); #>
		<div class="wpbc_appointment_services__provider_stack">
			<# _.each( visible_providers, function ( provider ) { #>
				<# if ( provider.availability_url ) { #>
					<a class="wpbc_appointment_services__provider_avatar<# if ( ! provider.has_weekly_availability ) { #> has-no-availability<# } #>" href="{{ provider.availability_url }}" title="{{ provider.title }}" aria-label="{{ provider.title }}">
						<# if ( provider.avatar_url ) { #><img src="{{ provider.avatar_url }}" alt="" loading="lazy"><# } else { #>{{ provider.initials }}<# } #>
					</a>
				<# } else { #>
					<span class="wpbc_appointment_services__provider_avatar<# if ( ! provider.has_weekly_availability ) { #> has-no-availability<# } #>" title="{{ provider.title }}" aria-label="{{ provider.title }}">
						<# if ( provider.avatar_url ) { #><img src="{{ provider.avatar_url }}" alt="" loading="lazy"><# } else { #>{{ provider.initials }}<# } #>
					</span>
				<# } #>
			<# } ); #>
			<# if ( data.providers.length > visible_providers.length ) { #><span class="wpbc_appointment_services__provider_more" title="{{ data.more_label }}">+{{ data.providers.length - visible_providers.length }}</span><# } #>
		</div>
	<# } else { #><span class="wpbc_appointment_services__no_provider">{{ data.empty_label }}</span><# } #>
</script>
