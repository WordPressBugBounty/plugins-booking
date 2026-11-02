<?php
/**
 * Timeline Resource-settings inspector content template.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-timeline-resource-settings-inspector">
	<form class="wpbc_timeline_resource_settings__form" data-wpbc-timeline-resource-settings-form novalidate>
		<section class="wpbc_timeline_resource_settings__section" aria-labelledby="wpbc_timeline_resource_settings_booking_title">
			<h3 id="wpbc_timeline_resource_settings_booking_title">{{ data.i18n.booking_title }}</h3>
			<p class="description">{{ data.i18n.booking_title_help }}</p>

			<label class="wpbc_timeline_resource_settings__choice">
				<input type="radio" name="wpbc_timeline_resource_title_mode" value="inherit" <# if ( 'inherit' === data.booking_title.mode ) { #>checked<# } #>>
				<span>
					<strong>{{ data.i18n.use_default }}</strong>
					<small>{{ data.i18n.use_default_help }}</small>
				</span>
			</label>
			<div class="wpbc_timeline_resource_settings__inherited">
				<strong>{{ data.i18n.inherited_default }}:</strong>
				<code>{{ data.booking_title.inherited_template }}</code>
			</div>

			<label class="wpbc_timeline_resource_settings__choice">
				<input type="radio" name="wpbc_timeline_resource_title_mode" value="custom" <# if ( 'custom' === data.booking_title.mode ) { #>checked<# } #>>
				<span>
					<strong>{{ data.i18n.custom_title }}</strong>
					<small>{{ data.i18n.custom_title_help }}</small>
				</span>
			</label>

			<div class="wpbc_timeline_resource_settings__custom" data-wpbc-timeline-resource-custom-fields>
				<label for="wpbc_timeline_resource_settings_template">{{ data.i18n.template }}</label>
				<input
					type="text"
					id="wpbc_timeline_resource_settings_template"
					class="regular-text"
					maxlength="{{ data.maximum_length }}"
					value="{{ data.booking_title.custom_template }}"
					data-wpbc-timeline-resource-settings-template
				>
				<p class="description">{{ data.i18n.insert_token }}</p>
				<div class="wpbc_timeline_resource_settings__tokens">
					<# _.each( data.tokens || [], function( token ) { #>
						<button type="button" class="button button-small" data-wpbc-timeline-resource-settings-token="{{ token.value }}" aria-label="{{ token.label }}">{{ token.value }}</button>
					<# } ); #>
				</div>
			</div>
			<p class="wpbc_timeline_resource_settings__stored_state">
				<# if ( data.booking_title.is_configured ) { #>{{ data.i18n.configured }}<# } else { #>{{ data.i18n.not_configured }}<# } #>
			</p>
		</section>

		<div class="wpbc_timeline_resource_settings__footer">
			<button type="button" class="button-link" data-wpbc-timeline-resource-settings-reset <# if ( ! data.booking_title.is_configured ) { #>disabled<# } #>>{{ data.i18n.reset }}</button>
			<span class="wpbc_timeline_resource_settings__footer_actions">
				<button type="button" class="button" data-wpbc-shared-ui-inspector-close>{{ data.i18n.cancel }}</button>
				<button type="submit" class="button button-primary" data-wpbc-timeline-resource-settings-save>{{ data.i18n.save }}</button>
			</span>
		</div>
	</form>
</script>
