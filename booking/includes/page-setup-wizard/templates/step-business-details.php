<?php
/**
 * Approved Page 2 business-details form.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized step context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$step_data = $template_context['step_data'];
$values    = $step_data['values'];
?>
<section class="wpbc_setup_wizard__step-content" aria-labelledby="wpbc-setup-wizard-step-title">
	<header class="wpbc_setup_wizard__step-heading">
		<h1 id="wpbc-setup-wizard-step-title"><?php esc_html_e( 'Tell Us About Your Business', 'booking' ); ?></h1>
		<p class="wpbc_setup_wizard__lead"><?php esc_html_e( 'This will help customize your experience.', 'booking' ); ?></p>
	</header>

	<form class="wpbc_setup_wizard__content-panel" id="wpbc-setup-wizard-step-form" data-wpbc-setup-wizard-fields novalidate>
		<div class="wpbc_setup_wizard__field-grid">
			<div class="wpbc_setup_wizard__field">
				<label for="wpbc-setup-wizard-business-name"><?php esc_html_e( "What's the name of your business?", 'booking' ); ?></label>
				<input id="wpbc-setup-wizard-business-name" type="text" name="business_name" value="<?php echo esc_attr( $values['business_name'] ); ?>" maxlength="200" autocomplete="organization" required data-wpbc-setup-wizard-field aria-describedby="wpbc-setup-wizard-business-name-error">
				<span class="wpbc_setup_wizard__field-error" id="wpbc-setup-wizard-business-name-error" data-wpbc-setup-wizard-error-for="business_name"></span>
			</div>

			<div class="wpbc_setup_wizard__field">
				<label for="wpbc-setup-wizard-business-stage"><?php esc_html_e( 'Which one of these best describes you?', 'booking' ); ?></label>
				<select id="wpbc-setup-wizard-business-stage" name="business_stage" required data-wpbc-setup-wizard-field aria-describedby="wpbc-setup-wizard-business-stage-error">
					<?php foreach ( $step_data['business_stages'] as $stage_id => $stage_label ) : ?>
						<option value="<?php echo esc_attr( $stage_id ); ?>"<?php selected( $values['business_stage'], $stage_id ); ?>><?php echo esc_html( $stage_label ); ?></option>
					<?php endforeach; ?>
				</select>
				<span class="wpbc_setup_wizard__field-error" id="wpbc-setup-wizard-business-stage-error" data-wpbc-setup-wizard-error-for="business_stage"></span>
			</div>

			<div class="wpbc_setup_wizard__field">
				<label for="wpbc-setup-wizard-booking-email"><?php esc_html_e( 'Your Booking Email Address', 'booking' ); ?></label>
				<input id="wpbc-setup-wizard-booking-email" type="email" name="booking_email" value="<?php echo esc_attr( $values['booking_email'] ); ?>" maxlength="254" autocomplete="email" required data-wpbc-setup-wizard-field aria-describedby="wpbc-setup-wizard-booking-email-error">
				<span class="wpbc_setup_wizard__field-error" id="wpbc-setup-wizard-booking-email-error" data-wpbc-setup-wizard-error-for="booking_email"></span>
			</div>

			<div class="wpbc_setup_wizard__field">
				<label for="wpbc-setup-wizard-industry"><?php esc_html_e( 'What industry is your booking business in?', 'booking' ); ?></label>
				<select id="wpbc-setup-wizard-industry" name="industry" required data-wpbc-setup-wizard-field aria-describedby="wpbc-setup-wizard-industry-error">
					<option value=""><?php esc_html_e( 'Select', 'booking' ); ?></option>
					<?php foreach ( $step_data['industries'] as $industry_group ) : ?>
						<optgroup label="<?php echo esc_attr( $industry_group['label'] ); ?>">
							<?php foreach ( $industry_group['options'] as $industry_id => $industry_label ) : ?>
								<option value="<?php echo esc_attr( $industry_id ); ?>"<?php selected( $values['industry'], $industry_id ); ?>><?php echo esc_html( $industry_label ); ?></option>
							<?php endforeach; ?>
						</optgroup>
					<?php endforeach; ?>
				</select>
				<span class="wpbc_setup_wizard__field-error" id="wpbc-setup-wizard-industry-error" data-wpbc-setup-wizard-error-for="industry"></span>
			</div>

		</div>

		<div class="wpbc_setup_wizard__divider"></div>
		<div class="wpbc_setup_wizard__consent">
			<input id="wpbc-setup-wizard-personalization-consent" type="checkbox" name="personalization_consent" value="1"<?php checked( ! empty( $values['personalization_consent'] ) ); ?> data-wpbc-setup-wizard-field>
			<label for="wpbc-setup-wizard-personalization-consent"><?php esc_html_e( 'By checking this box, I agree to share this setup data to personalize my setup experience, get more relevant content, and help improve WP Booking Calendar for everyone.', 'booking' ); ?></label>
		</div>
	</form>
</section>
