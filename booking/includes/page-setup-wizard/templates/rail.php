<?php
/**
 * Open-ended setup journey rail.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized rail context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<aside class="wpbc_setup_wizard__rail" aria-labelledby="wpbc-setup-wizard-journey-title">
	<h2 id="wpbc-setup-wizard-journey-title"><?php esc_html_e( 'Your setup journey', 'booking' ); ?></h2>
	<ol class="wpbc_setup_wizard__steps">
		<?php foreach ( $template_context['rail_items'] as $rail_item ) : ?>
			<li class="wpbc_setup_wizard__step wpbc_setup_wizard__step--<?php echo esc_attr( $rail_item['state'] ); ?>"<?php echo 'current' === $rail_item['state'] ? ' aria-current="step"' : ''; ?>>
				<span class="wpbc_setup_wizard__step-marker" aria-hidden="true"><?php echo 'complete' === $rail_item['state'] ? '&#10003;' : ''; ?></span>
				<?php if ( 'complete' === $rail_item['state'] ) : ?>
					<?php
					/* translators: %s: Setup Wizard step label. */
					$step_link_label = sprintf( __( 'Go to %s setup step', 'booking' ), $rail_item['label'] );
					?>
					<button
						type="button"
						class="wpbc_setup_wizard__step-label wpbc_setup_wizard__step-link"
						data-wpbc-setup-wizard-edit-step="<?php echo esc_attr( $rail_item['id'] ); ?>"
						aria-label="<?php echo esc_attr( $step_link_label ); ?>"
					><?php echo esc_html( $rail_item['label'] ); ?></button>
				<?php else : ?>
					<span class="wpbc_setup_wizard__step-label"><?php echo esc_html( $rail_item['label'] ); ?></span>
				<?php endif; ?>
			</li>
		<?php endforeach; ?>
		<li class="wpbc_setup_wizard__step wpbc_setup_wizard__step--future" aria-hidden="true">
			<span class="wpbc_setup_wizard__step-marker"></span>
		</li>
	</ol>
	<p class="wpbc_setup_wizard__rail-note"><?php echo esc_html( $template_context['rail_note'] ); ?></p>
</aside>
