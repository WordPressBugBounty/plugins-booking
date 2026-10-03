<?php
/**
 * Dates, times, and website-language editor.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized step context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$step_data                = $template_context['step_data'];
$values                   = $step_data['values'];
$site_language            = $step_data['site_language'];
$language_status          = 'wpbc_setup_wizard__language-status wpbc_setup_wizard__language-status--' . sanitize_html_class( $site_language['status'] );
$translation_action_class = 'button button-secondary wpbc_setup_wizard__translation-action';
if ( ! empty( $site_language['is_local_source_recommended'] ) ) {
	$translation_action_class .= ' wpbc_setup_wizard__translation-action--recommended';
}
?>
<section class="wpbc_setup_wizard__step-content" aria-labelledby="wpbc-setup-wizard-step-title" data-wpbc-date-time-formats-editor>
	<header class="wpbc_setup_wizard__step-heading">
		<h1 id="wpbc-setup-wizard-step-title"><?php esc_html_e( 'Dates, times and language', 'booking' ); ?></h1>
		<p class="wpbc_setup_wizard__lead"><?php esc_html_e( 'Choose how dates and times are displayed, and manage the Booking Calendar translation for your site language.', 'booking' ); ?></p>
	</header>

	<form class="wpbc_setup_wizard__content-panel" id="wpbc-setup-wizard-step-form" data-wpbc-setup-wizard-fields novalidate>
		<div class="wpbc_setup_wizard__field-grid">
			<div class="wpbc_setup_wizard__field">
				<label for="wpbc-setup-wizard-date-format"><?php esc_html_e( 'Date Format', 'booking' ); ?></label>
				<select id="wpbc-setup-wizard-date-format" name="date_format" required data-wpbc-setup-wizard-field aria-describedby="wpbc-setup-wizard-date-format-error">
					<?php foreach ( $step_data['date_formats'] as $date_format ) : ?>
						<option value="<?php echo esc_attr( $date_format['value'] ); ?>"<?php selected( $values['date_format'], $date_format['value'] ); ?>><?php echo esc_html( $date_format['label'] ); ?></option>
					<?php endforeach; ?>
				</select>
				<span class="wpbc_setup_wizard__field-error" id="wpbc-setup-wizard-date-format-error" data-wpbc-setup-wizard-error-for="date_format"></span>
			</div>

			<div class="wpbc_setup_wizard__field">
				<label for="wpbc-setup-wizard-time-format"><?php esc_html_e( 'Time Format', 'booking' ); ?></label>
				<select id="wpbc-setup-wizard-time-format" name="time_format" required data-wpbc-setup-wizard-field aria-describedby="wpbc-setup-wizard-time-format-error">
					<?php foreach ( $step_data['time_formats'] as $time_format ) : ?>
						<option value="<?php echo esc_attr( $time_format['value'] ); ?>"<?php selected( $values['time_format'], $time_format['value'] ); ?>><?php echo esc_html( $time_format['label'] ); ?></option>
					<?php endforeach; ?>
				</select>
				<span class="wpbc_setup_wizard__field-error" id="wpbc-setup-wizard-time-format-error" data-wpbc-setup-wizard-error-for="time_format"></span>
			</div>

			<div class="wpbc_setup_wizard__field">
				<label for="wpbc-setup-wizard-week-start"><?php esc_html_e( 'Start day of the week', 'booking' ); ?></label>
				<select id="wpbc-setup-wizard-week-start" name="start_day_of_week" required data-wpbc-setup-wizard-field aria-describedby="wpbc-setup-wizard-week-start-help wpbc-setup-wizard-week-start-error">
					<?php foreach ( $step_data['week_start_days'] as $weekday_id => $weekday_label ) : ?>
						<option value="<?php echo esc_attr( $weekday_id ); ?>"<?php selected( $values['start_day_of_week'], $weekday_id ); ?>><?php echo esc_html( $weekday_label ); ?></option>
					<?php endforeach; ?>
				</select>
				<span class="wpbc_setup_wizard__field-help" id="wpbc-setup-wizard-week-start-help"><?php esc_html_e( 'Select which day the week starts on.', 'booking' ); ?></span>
				<span class="wpbc_setup_wizard__field-error" id="wpbc-setup-wizard-week-start-error" data-wpbc-setup-wizard-error-for="start_day_of_week"></span>
			</div>

			<div class="wpbc_setup_wizard__field wpbc_setup_wizard__language-field">
				<label for="wpbc-setup-wizard-site-language"><?php esc_html_e( 'Booking Calendar language', 'booking' ); ?></label>
				<select id="wpbc-setup-wizard-site-language" disabled aria-describedby="wpbc-setup-wizard-site-language-source wpbc-setup-wizard-site-language-help wpbc-setup-wizard-site-language-status wpbc-setup-wizard-site-language-local-source-recommendation wpbc-setup-wizard-site-language-updated wpbc-setup-wizard-site-language-update-recommendation">
					<option selected><?php echo esc_html( $site_language['label'] ); ?></option>
				</select>
				<span class="wpbc_setup_wizard__translation-source" id="wpbc-setup-wizard-site-language-source" data-wpbc-local-translation-source="<?php echo esc_attr( $site_language['translation_source'] ); ?>">
					<span><?php esc_html_e( 'Translation source:', 'booking' ); ?></span>
					<strong data-wpbc-local-translation-source-label><?php echo esc_html( $site_language['translation_source_label'] ); ?></strong>
				</span>
				<span class="<?php echo esc_attr( $language_status ); ?>" id="wpbc-setup-wizard-site-language-status" data-wpbc-local-translation-status>
					<?php echo esc_html( $site_language['status_label'] ); ?>
				</span>
				<span class="wpbc_setup_wizard__field-help" id="wpbc-setup-wizard-site-language-help" data-wpbc-local-translation-help>
					<?php echo esc_html( $site_language['help'] ); ?>
				</span>
				<span class="wpbc_setup_wizard__translation-source-recommendation" id="wpbc-setup-wizard-site-language-local-source-recommendation" data-wpbc-local-source-recommendation<?php if ( empty( $site_language['is_local_source_recommended'] ) ) : ?> hidden<?php endif; ?>>
					<?php echo esc_html( $site_language['local_source_recommendation'] ); ?>
				</span>
				<span class="wpbc_setup_wizard__translation-updated" id="wpbc-setup-wizard-site-language-updated" data-wpbc-local-translation-updated<?php if ( empty( $site_language['updated_label'] ) ) : ?> hidden<?php endif; ?>>
					<?php echo esc_html( $site_language['updated_label'] ); ?>
				</span>
				<span class="wpbc_setup_wizard__translation-recommendation" id="wpbc-setup-wizard-site-language-update-recommendation" data-wpbc-local-translation-recommendation<?php if ( empty( $site_language['is_update_recommended'] ) ) : ?> hidden<?php endif; ?>>
					<?php echo esc_html( $site_language['update_recommendation'] ); ?>
				</span>

				<?php if ( $site_language['can_install'] ) : ?>
					<button type="button" class="<?php echo esc_attr( $translation_action_class ); ?>" data-wpbc-install-local-translation aria-controls="wpbc-setup-wizard-local-translation-console">
						<i class="menu_icon icon-1x wpbc_icn_download" aria-hidden="true"></i>
						<span data-wpbc-install-local-translation-label><?php echo esc_html( $site_language['action_label'] ); ?></span>
					</button>
				<?php endif; ?>

				<?php if ( ! $site_language['is_demo'] && ! $site_language['can_manage'] ) : ?>
					<span class="wpbc_setup_wizard__field-help"><?php esc_html_e( 'An administrator who can install plugins must update and select the Local translation source.', 'booking' ); ?></span>
				<?php endif; ?>

				<div class="wpbc_setup_wizard__translation-feedback" data-wpbc-local-translation-feedback role="status" aria-live="polite"></div>
			</div>
		</div>

		<section id="wpbc-setup-wizard-local-translation-console" class="wpbc_setup_wizard__translation-console" data-wpbc-local-translation-console aria-labelledby="wpbc-setup-wizard-local-translation-console-title" aria-busy="false" hidden>
			<header class="wpbc_setup_wizard__translation-console-header">
				<h2 id="wpbc-setup-wizard-local-translation-console-title"><?php esc_html_e( 'Local translation update log', 'booking' ); ?></h2>
				<span data-wpbc-local-translation-console-state><?php esc_html_e( 'Waiting', 'booking' ); ?></span>
			</header>
			<ol class="wpbc_setup_wizard__translation-console-log" data-wpbc-local-translation-console-log role="log" aria-live="polite" aria-relevant="additions text"></ol>
		</section>

		<div class="wpbc_setup_wizard__divider"></div>
		<p class="wpbc_setup_wizard__settings-note">
			<?php esc_html_e( 'You can always change these settings later', 'booking' ); ?>
			&mdash;
			<a href="<?php echo esc_url( $step_data['date_time_settings_url'] ); ?>"><?php esc_html_e( 'Settings', 'booking' ); ?> &gt; <?php esc_html_e( 'Date / Time Formats', 'booking' ); ?></a>
			<span aria-hidden="true">&middot;</span>
			<a href="<?php echo esc_url( $step_data['translation_settings_url'] ); ?>"><?php esc_html_e( 'Settings', 'booking' ); ?> &gt; <?php esc_html_e( 'Admin Panel', 'booking' ); ?> &gt; <?php esc_html_e( 'Translations', 'booking' ); ?></a>
		</p>
	</form>
</section>
