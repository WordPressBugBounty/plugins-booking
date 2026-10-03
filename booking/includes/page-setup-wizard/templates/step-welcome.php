<?php
/**
 * Approved Page 1 welcome content.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized step context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<section class="wpbc_setup_wizard__step-content wpbc_setup_wizard__welcome" aria-labelledby="wpbc-setup-wizard-step-title">
	<h1 id="wpbc-setup-wizard-step-title"><?php esc_html_e( 'Welcome to WP Booking Calendar!', 'booking' ); ?></h1>
	<p class="wpbc_setup_wizard__lead"><?php esc_html_e( "We'll guide you through the steps to set up WP Booking Calendar on your site.", 'booking' ); ?></p>

	<div class="wpbc_setup_wizard__notice wpbc_setup_wizard__message wpbc_setup_wizard__message--warning" role="note">
		<span class="wpbc_setup_wizard__notice-icon" aria-hidden="true">!</span>
		<div>
			<h2><?php esc_html_e( 'Important!', 'booking' ); ?></h2>
			<p>
				<?php esc_html_e( 'If you have previously configured the Booking Calendar, this setup will override some of your settings. In this case, you can', 'booking' ); ?>
				<button type="button" class="wpbc_setup_wizard__inline-action" data-wpbc-setup-wizard-open-dialog="skip"><?php esc_html_e( 'skip setup', 'booking' ); ?></button>.
			</p>
		</div>
	</div>
</section>
