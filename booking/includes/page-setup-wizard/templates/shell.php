<?php
/**
 * Full-screen Setup Wizard shell.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized shell context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$templates    = $template_context['templates'];
$draft        = $template_context['draft'];
$step_dialogs = isset( $template_context['step_data']['dialogs'] ) && is_array( $template_context['step_data']['dialogs'] )
	? $template_context['step_data']['dialogs']
	: array();
?>
<div
	class="wpbc_setup_wizard"
	data-wpbc-setup-wizard
	data-step="<?php echo esc_attr( $draft['current_step'] ); ?>"
	data-revision="<?php echo esc_attr( (string) $draft['revision'] ); ?>"
	data-request-phase="idle"
	aria-busy="false"
>
	<header class="wpbc_setup_wizard__header wpbc_ui_el wpbc_ui_el__top_nav" aria-label="<?php esc_attr_e( 'Booking Calendar Setup Wizard', 'booking' ); ?>">
		<?php
		// Reuse the canonical Booking Calendar brand menu and all of its current items.
		wpbc_ui__top_nav__dropdown__wpbc();
		if ( ! empty( $template_context['header_template_id'] ) ) {
			$templates->render(
				$template_context['header_template_id'],
				array(
					'current_step' => $template_context['current_step'],
					'step_data'    => $template_context['step_data'],
				)
			);
		}
		?>
		<div class="wpbc_ui_el__make_space"></div>
		<a
			class="wpbc_setup_wizard__close"
			href="<?php echo esc_url( $template_context['close_url'] ); ?>"
			aria-label="<?php esc_attr_e( 'Close Setup Wizard and keep saved progress', 'booking' ); ?>"
		>
			<i class="menu_icon icon-1x wpbc_icn_close" aria-hidden="true"></i>
		</a>
	</header>

	<div class="wpbc_setup_wizard__layout">
		<?php $templates->render( 'rail', $template_context ); ?>
		<main class="wpbc_setup_wizard__main" id="wpbc-setup-wizard-main" tabindex="-1">
			<div class="wpbc_setup_wizard__stage wpbc_setup_wizard__stage--<?php echo esc_attr( $draft['current_step'] ); ?>">
				<div
					class="wpbc_setup_wizard__request-error wpbc_setup_wizard__message wpbc_setup_wizard__message--error"
					data-wpbc-setup-wizard-request-error
					role="alert"
					aria-live="assertive"
					aria-atomic="true"
					tabindex="-1"
					hidden
				>
					<i class="menu_icon icon-1x wpbc_icn_error_outline" aria-hidden="true"></i>
					<div class="wpbc_setup_wizard__request-error-content">
						<h2><?php esc_html_e( 'This step could not be saved', 'booking' ); ?></h2>
						<p data-wpbc-setup-wizard-request-error-message></p>
						<p class="wpbc_setup_wizard__request-error-reference" data-wpbc-setup-wizard-request-error-reference hidden>
							<?php esc_html_e( 'Reference:', 'booking' ); ?>
							<code data-wpbc-setup-wizard-request-error-request-id></code>
						</p>
					</div>
					<button
						type="button"
						class="wpbc_setup_wizard__request-error-dismiss"
						data-wpbc-setup-wizard-dismiss-error
						aria-label="<?php esc_attr_e( 'Dismiss this error', 'booking' ); ?>"
					>
						<i class="menu_icon icon-1x wpbc_icn_close" aria-hidden="true"></i>
					</button>
				</div>
				<?php
				$templates->render(
					$template_context['step_template_id'],
					array(
						'current_step'  => $template_context['current_step'],
						'draft'         => $draft,
						'step_data'     => $template_context['step_data'],
						'templates'     => $templates,
						'settings_hint' => isset( $template_context['settings_hint'] ) && is_array( $template_context['settings_hint'] ) ? $template_context['settings_hint'] : array(),
					)
				);
				?>
			</div>
		</main>
	</div>

	<?php $templates->render( 'footer', $template_context ); ?>
	<?php
	$templates->render(
		'confirmation-dialog',
		array(
			'dialog_id'     => 'wpbc-setup-wizard-restart-dialog',
			'action'        => 'restart',
			'title'         => __( 'Restart the Setup Wizard?', 'booking' ),
			'description'   => __( 'This restarts wizard navigation, recommendations, and editable wizard values while retaining operation history. It does not restore or roll back Booking Calendar settings or separately completed actions.', 'booking' ),
			'confirm_label' => __( 'Restart Wizard', 'booking' ),
		)
	);
	$templates->render(
		'confirmation-dialog',
		array(
			'dialog_id'      => 'wpbc-setup-wizard-skip-dialog',
			'action'         => 'skip',
			'title'         => __( 'Skip the remaining setup steps?', 'booking' ),
			'description'   => __( 'This marks every remaining Setup Wizard step as skipped, completes the setup, and opens Setup overview. Settings and actions already saved remain active. Unsaved changes on this page will not be saved.', 'booking' ),
			'confirm_label' => __( 'Skip Setup Wizard', 'booking' ),
		)
	);
	foreach ( $step_dialogs as $step_dialog ) {
		if ( ! is_array( $step_dialog ) ) {
			continue;
		}

		$templates->render( 'confirmation-dialog', $step_dialog );
	}
	?>
	<div
		class="wpbc_setup_wizard__transition"
		data-wpbc-setup-wizard-transition
		aria-hidden="true"
	>
		<div class="wpbc_setup_wizard__transition-panel">
			<span class="spinner is-active" aria-hidden="true"></span>
			<span data-wpbc-setup-wizard-transition-message><?php esc_html_e( 'Saving setup progress...', 'booking' ); ?></span>
		</div>
	</div>
	<p class="wpbc_setup_wizard__status" role="status" aria-live="polite" aria-atomic="true" data-wpbc-setup-wizard-status></p>
</div>
