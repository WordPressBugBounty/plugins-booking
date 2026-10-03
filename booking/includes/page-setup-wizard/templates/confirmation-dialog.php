<?php
/**
 * Accessible confirmation dialog for shell and step-specific decisions.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized dialog context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$dialog_id          = isset( $template_context['dialog_id'] ) ? (string) $template_context['dialog_id'] : '';
$dialog_action      = isset( $template_context['action'] ) ? (string) $template_context['action'] : '';
$dialog_title       = isset( $template_context['title'] ) ? (string) $template_context['title'] : '';
$dialog_description = isset( $template_context['description'] ) ? (string) $template_context['description'] : '';
$dialog_details     = isset( $template_context['details'] ) && is_array( $template_context['details'] ) ? $template_context['details'] : array();
$dialog_note        = isset( $template_context['note'] ) ? (string) $template_context['note'] : '';
$cancel_label       = isset( $template_context['cancel_label'] ) ? (string) $template_context['cancel_label'] : __( 'Cancel', 'booking' );
$confirm_label      = isset( $template_context['confirm_label'] ) ? (string) $template_context['confirm_label'] : __( 'Continue', 'booking' );
$dialog_classes     = 'wpbc_setup_wizard__dialog';

$dialog_details = array_values(
	array_filter(
		array_map(
			static function ( $dialog_detail ) {
				return is_scalar( $dialog_detail ) ? trim( (string) $dialog_detail ) : '';
			},
			$dialog_details
		)
	)
);

if ( ! empty( $dialog_details ) ) {
	$dialog_classes .= ' wpbc_setup_wizard__dialog--with-details';
}
?>
<div class="wpbc_setup_wizard__dialog-backdrop" data-wpbc-setup-wizard-dialog="<?php echo esc_attr( $dialog_action ); ?>" hidden>
	<div class="<?php echo esc_attr( $dialog_classes ); ?>" id="<?php echo esc_attr( $dialog_id ); ?>" role="dialog" aria-modal="true" aria-labelledby="<?php echo esc_attr( $dialog_id ); ?>-title" aria-describedby="<?php echo esc_attr( $dialog_id ); ?>-description" tabindex="-1">
		<h2 id="<?php echo esc_attr( $dialog_id ); ?>-title"><?php echo esc_html( $dialog_title ); ?></h2>
		<div class="wpbc_setup_wizard__dialog-content" id="<?php echo esc_attr( $dialog_id ); ?>-description">
			<p><?php echo esc_html( $dialog_description ); ?></p>
			<?php if ( ! empty( $dialog_details ) ) : ?>
				<ul class="wpbc_setup_wizard__dialog-details">
					<?php foreach ( $dialog_details as $dialog_detail ) : ?>
						<li><?php echo esc_html( $dialog_detail ); ?></li>
					<?php endforeach; ?>
				</ul>
			<?php endif; ?>
			<?php if ( '' !== $dialog_note ) : ?>
				<p class="wpbc_setup_wizard__dialog-note"><?php echo esc_html( $dialog_note ); ?></p>
			<?php endif; ?>
		</div>
		<div class="wpbc_setup_wizard__dialog-actions">
			<button type="button" class="button" data-wpbc-setup-wizard-dialog-cancel><?php echo esc_html( $cancel_label ); ?></button>
			<button type="button" class="button button-primary" data-wpbc-setup-wizard-confirm="<?php echo esc_attr( $dialog_action ); ?>"><?php echo esc_html( $confirm_label ); ?></button>
		</div>
	</div>
</div>
