<?php
/**
 * Sticky Setup Wizard footer actions.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized footer context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$continue_label = isset( $template_context['continue_label'] ) && is_scalar( $template_context['continue_label'] )
	? (string) $template_context['continue_label']
	: __( 'Save & continue', 'booking' );
$show_continue_icon = ! isset( $template_context['show_continue_icon'] ) || ! empty( $template_context['show_continue_icon'] );
?>
<footer class="wpbc_setup_wizard__footer">
	<div class="wpbc_setup_wizard__footer-secondary">
		<button type="button" class="button button-link" data-wpbc-setup-wizard-open-dialog="skip"><?php esc_html_e( 'Skip Setup Wizard', 'booking' ); ?></button>
		<button type="button" class="button button-link" data-wpbc-setup-wizard-open-dialog="restart"><?php esc_html_e( 'Restart Wizard', 'booking' ); ?></button>
	</div>
	<div class="wpbc_setup_wizard__footer-primary">
		<?php if ( ! empty( $template_context['footer_note'] ) ) : ?>
			<p class="wpbc_setup_wizard__footer-note"><?php echo esc_html( $template_context['footer_note'] ); ?></p>
		<?php endif; ?>
		<div class="wpbc_setup_wizard__footer-primary-actions">
			<?php if ( $template_context['has_previous_step'] ) : ?>
				<button type="button" class="button button-secondary" data-wpbc-setup-wizard-direction="back">
					<i class="menu_icon icon-1x wpbc_icn_arrow_back_ios" aria-hidden="true"></i>
					<span><?php esc_html_e( 'Back', 'booking' ); ?></span>
				</button>
			<?php endif; ?>
			<button
				type="button"
				<?php if ( $template_context['has_step_form'] ) : ?>form="wpbc-setup-wizard-step-form"<?php endif; ?>
				class="button button-primary"
				data-wpbc-setup-wizard-direction="next"
				<?php if ( $template_context['can_continue'] ) : ?>data-wpbc-setup-wizard-enable-when-ready<?php endif; ?>
				<?php if ( $template_context['has_step_form'] ) : ?>data-wpbc-setup-wizard-submit-when-ready<?php endif; ?>
				disabled
			>
				<span><?php echo esc_html( $continue_label ); ?></span>
				<?php if ( $show_continue_icon ) : ?>
					<i class="menu_icon icon-1x wpbc_icn_arrow_forward_ios" aria-hidden="true"></i>
				<?php endif; ?>
			</button>
		</div>
	</div>
</footer>
