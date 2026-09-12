<?php
/**
 * WordPress template for the first-install Setup Wizard prompt.
 *
 * @package Booking Calendar
 * @since   11.8.1
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-setup-wizard-first-run-popup">
	<div class="wpdevelop">
		<div
			id="wpbc_setup_wizard_first_run_popup"
			class="modal wpbc_popup_modal wpbc_setup_wizard_first_run_popup"
			tabindex="-1"
			role="dialog"
			aria-modal="true"
			aria-hidden="true"
			aria-labelledby="wpbc_setup_wizard_first_run_popup_title"
			aria-describedby="wpbc_setup_wizard_first_run_popup_description"
		>
			<div class="modal-dialog" role="document">
				<div class="modal-content">
					<button
						type="button"
						class="wpbc_setup_wizard_first_run_popup__close"
						data-wpbc-setup-first-run-dismiss="1"
						aria-label="<?php esc_attr_e( 'Close setup invitation', 'booking' ); ?>"
					>
						<span aria-hidden="true">&times;</span>
					</button>
					<div class="modal-body wpbc_setup_wizard_first_run_popup__body">
						<div class="wpbc_setup_wizard_first_run_popup__logo" aria-hidden="true">
							<?php
							// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Trusted SVG helper escapes its generated attributes.
							echo wpbc_get_svg_logo_for_html(
								array(
									'svg_color'     => '#444',
									'svg_color_alt' => '#bbb',
									'opacity'       => '0.35',
									'style_default' => 'background-repeat: no-repeat; background-position: center; display: inline-block; vertical-align: middle;',
									'style_adjust'  => 'background-size: 70px auto; width: 96px; height: 96px; margin-top: 0;',
									'css_class'     => 'wpbc_setup_wizard_first_run_popup__logo_mark',
								)
							);
							?>
						</div>

						<h2 id="wpbc_setup_wizard_first_run_popup_title">
							<?php esc_html_e( 'Welcome to WP Booking Calendar', 'booking' ); ?>
						</h2>

						<p id="wpbc_setup_wizard_first_run_popup_description" class="wpbc_setup_wizard_first_run_popup__description">
							<?php esc_html_e( 'Set up your booking flow in a few minutes. You can leave at any time and continue later from Setup.', 'booking' ); ?>
						</p>

						<div class="wpbc_setup_wizard_first_run_popup__notice" role="note">
							<span class="wpbc_icn_info_outline" aria-hidden="true"></span>
							<span><?php esc_html_e( 'Existing bookings are preserved. Settings change only when you save a Setup step.', 'booking' ); ?></span>
						</div>

						<div class="wpbc_setup_wizard_first_run_popup__actions">
							<button type="button" class="button button-primary button-hero" data-wpbc-setup-first-run-start="1">
								<?php esc_html_e( 'Start guided setup', 'booking' ); ?>
							</button>
							<button type="button" class="button button-secondary button-hero" data-wpbc-setup-first-run-dismiss="1">
								<?php esc_html_e( 'Not now', 'booking' ); ?>
							</button>
						</div>

						<p class="wpbc_setup_wizard_first_run_popup__later">
							<?php esc_html_e( 'If you postpone, Initial Setup remains available from the Booking Calendar menu.', 'booking' ); ?>
						</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</script>
