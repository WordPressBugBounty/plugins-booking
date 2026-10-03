<?php
/**
 * Modular Step 6 Service proposal editor.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized step context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$step_data                 = $template_context['step_data'];
$services                  = isset( $step_data['services'] ) && is_array( $step_data['services'] ) ? $step_data['services'] : array();
$inactive_service_ids      = isset( $step_data['inactive_service_ids'] ) && is_array( $step_data['inactive_service_ids'] ) ? array_values( array_map( 'absint', $step_data['inactive_service_ids'] ) ) : array();
$pricing_available         = ! empty( $step_data['pricing_available'] );
$currency_symbol           = isset( $step_data['currency_symbol'] ) ? (string) $step_data['currency_symbol'] : '$';
$max_services              = isset( $step_data['max_services'] ) ? absint( $step_data['max_services'] ) : 20;
$services_json             = wp_json_encode( $services );
$services_json             = false === $services_json ? '[]' : $services_json;
$inactive_service_ids_json = wp_json_encode( $inactive_service_ids );
$inactive_service_ids_json = false === $inactive_service_ids_json ? '[]' : $inactive_service_ids_json;
?>
<section class="wpbc_setup_wizard__step-content wpbc_setup_wizard__services-step" aria-labelledby="wpbc-setup-wizard-step-title">
	<header class="wpbc_setup_wizard__step-heading">
		<h1 id="wpbc-setup-wizard-step-title"><?php esc_html_e( 'Create your services', 'booking' ); ?></h1>
		<p class="wpbc_setup_wizard__lead"><?php esc_html_e( 'Add the services customers can choose in the guided appointment flow.', 'booking' ); ?></p>
	</header>
	<?php
	$template_context['templates']->render(
		'settings-hint',
		array( 'settings_hint' => $template_context['settings_hint'] )
	);
	?>

	<form id="wpbc-setup-wizard-step-form" novalidate>
		<input
			type="hidden"
			name="services"
			value="<?php echo esc_attr( $services_json ); ?>"
			required
			data-wpbc-setup-wizard-field
			data-wpbc-service-draft
			data-max-services="<?php echo esc_attr( (string) $max_services ); ?>"
			aria-describedby="wpbc-setup-wizard-services-error"
		>
		<input
			type="hidden"
			name="inactive_service_ids"
			value="<?php echo esc_attr( $inactive_service_ids_json ); ?>"
			data-wpbc-setup-wizard-field
			data-wpbc-inactive-service-ids
		>

		<div class="wpbc_setup_wizard__services-layout" data-wpbc-services-editor data-pricing-available="<?php echo $pricing_available ? 'true' : 'false'; ?>">
			<aside class="wpbc_setup_wizard__services-list-panel" aria-labelledby="wpbc-setup-wizard-services-list-title">
				<h2 id="wpbc-setup-wizard-services-list-title"><?php esc_html_e( 'Your services', 'booking' ); ?></h2>
				<div class="wpbc_setup_wizard__services-list" role="group" aria-label="<?php esc_attr_e( 'Services to edit', 'booking' ); ?>" data-wpbc-services-list></div>
				<button type="button" class="button button-secondary wpbc_setup_wizard__add-service" data-wpbc-add-service>
					<i class="menu_icon icon-1x wpbc_icn_add" aria-hidden="true"></i>
					<span><?php esc_html_e( 'Add another service', 'booking' ); ?></span>
				</button>
			</aside>

			<section class="wpbc_setup_wizard__service-details-panel" aria-labelledby="wpbc-setup-wizard-service-details-title">
				<header class="wpbc_setup_wizard__service-details-heading">
					<h2 id="wpbc-setup-wizard-service-details-title"><?php esc_html_e( 'Service details', 'booking' ); ?></h2>
					<span><?php esc_html_e( '* Required fields', 'booking' ); ?></span>
				</header>

				<div class="wpbc_setup_wizard__service-details-grid">
					<div class="wpbc_setup_wizard__field wpbc_setup_wizard__service-title-field">
						<label for="wpbc-setup-wizard-service-title"><?php esc_html_e( 'Service title', 'booking' ); ?> <span aria-hidden="true">*</span></label>
						<input id="wpbc-setup-wizard-service-title" type="text" maxlength="200" required data-wpbc-service-field="title" data-wpbc-setup-wizard-error-control-for="services">
					</div>

					<div class="wpbc_setup_wizard__field wpbc_setup_wizard__service-price-field">
						<label for="wpbc-setup-wizard-service-price">
							<?php
							printf(
								/* translators: %s: Current currency symbol. */
								esc_html__( 'Price (%s)', 'booking' ),
								esc_html( $currency_symbol )
							);
							?>
							<?php if ( ! $pricing_available ) : ?><span class="wpbc_setup_wizard__edition-badge"><?php esc_html_e( 'Pro', 'booking' ); ?></span><?php endif; ?>
						</label>
						<div class="wpbc_setup_wizard__price-control"><input id="wpbc-setup-wizard-service-price" type="number" min="0" max="1000" step="0.01" data-wpbc-service-field="base_cost" <?php disabled( ! $pricing_available ); ?>></div>
						<?php if ( ! $pricing_available ) : ?><span class="wpbc_setup_wizard__field-help"><?php esc_html_e( 'Available in Business Small or higher.', 'booking' ); ?></span><?php endif; ?>
					</div>

					<div class="wpbc_setup_wizard__field wpbc_setup_wizard__service-description-field">
						<label for="wpbc-setup-wizard-service-description"><?php esc_html_e( 'Description', 'booking' ); ?></label>
						<textarea id="wpbc-setup-wizard-service-description" maxlength="2000" rows="6" data-wpbc-service-field="description"></textarea>
					</div>

					<div class="wpbc_setup_wizard__field wpbc_setup_wizard__service-picture-field">
						<label><?php esc_html_e( 'Picture (optional)', 'booking' ); ?></label>
						<div class="wpbc_setup_wizard__service-picture-preview" data-wpbc-service-picture-preview>
							<img alt="" hidden data-wpbc-service-picture-image>
							<i class="menu_icon icon-1x wpbc-bi-image-fill" aria-hidden="true" data-wpbc-service-picture-placeholder></i>
						</div>
						<input id="wpbc-setup-wizard-service-picture-url" type="hidden" data-wpbc-service-field="picture_url">
						<div class="wpbc_setup_wizard__service-picture-actions">
							<button
								type="button"
								class="button button-secondary wpbc_media_upload_button"
								data-modal_title="<?php esc_attr_e( 'Select Service image', 'booking' ); ?>"
								data-btn_title="<?php esc_attr_e( 'Use this image', 'booking' ); ?>"
								data-url_field="wpbc-setup-wizard-service-picture-url"
							><?php esc_html_e( 'Select image', 'booking' ); ?></button>
							<button type="button" class="button button-secondary" data-wpbc-remove-service-picture><?php esc_html_e( 'Remove', 'booking' ); ?></button>
						</div>
					</div>

					<div class="wpbc_setup_wizard__service-time-grid">
						<div class="wpbc_setup_wizard__field">
							<label for="wpbc-setup-wizard-service-duration"><?php esc_html_e( 'Duration (minutes)', 'booking' ); ?></label>
							<div class="wpbc_setup_wizard__service-number-control">
								<input id="wpbc-setup-wizard-service-duration" type="number" min="0" max="1440" step="1" required data-wpbc-service-field="duration_minutes">
								<input type="range" min="0" max="480" step="5" value="30" data-wpbc-service-range="duration_minutes" aria-label="<?php esc_attr_e( 'Adjust Service duration in minutes', 'booking' ); ?>">
							</div>
						</div>
						<div class="wpbc_setup_wizard__field">
							<label for="wpbc-setup-wizard-service-buffer-before"><?php esc_html_e( 'Buffer before (minutes)', 'booking' ); ?></label>
							<div class="wpbc_setup_wizard__service-number-control">
								<input id="wpbc-setup-wizard-service-buffer-before" type="number" min="0" max="1440" step="1" required data-wpbc-service-field="buffer_before_minutes">
								<input type="range" min="0" max="480" step="5" value="0" data-wpbc-service-range="buffer_before_minutes" aria-label="<?php esc_attr_e( 'Adjust the buffer before the Service in minutes', 'booking' ); ?>">
							</div>
						</div>
						<div class="wpbc_setup_wizard__field">
							<label for="wpbc-setup-wizard-service-buffer-after"><?php esc_html_e( 'Buffer after (minutes)', 'booking' ); ?></label>
							<div class="wpbc_setup_wizard__service-number-control">
								<input id="wpbc-setup-wizard-service-buffer-after" type="number" min="0" max="1440" step="1" required data-wpbc-service-field="buffer_after_minutes">
								<input type="range" min="0" max="480" step="5" value="0" data-wpbc-service-range="buffer_after_minutes" aria-label="<?php esc_attr_e( 'Adjust the buffer after the Service in minutes', 'booking' ); ?>">
							</div>
						</div>
					</div>
				</div>

				<div class="wpbc_setup_wizard__service-summary wpbc_setup_wizard__message wpbc_setup_wizard__message--info">
					<p><strong><?php esc_html_e( 'Customers see:', 'booking' ); ?></strong><span data-wpbc-service-summary></span></p>
				</div>
			</section>
		</div>
		<span class="wpbc_setup_wizard__field-error wpbc_setup_wizard__field-error--group" id="wpbc-setup-wizard-services-error" data-wpbc-setup-wizard-error-for="services"></span>
	</form>

	<template data-wpbc-service-card-template>
		<div class="wpbc_setup_wizard__service-card">
			<label class="wpbc_setup_wizard__service-card-selection">
				<input class="screen-reader-text" type="radio" name="wpbc_setup_wizard_service_editor_selection">
				<span class="wpbc_setup_wizard__radio-mark" aria-hidden="true"></span>
				<span class="wpbc_setup_wizard__service-card-picture"><img alt="" hidden><i class="menu_icon icon-1x wpbc-bi-image-fill" aria-hidden="true"></i></span>
				<span class="wpbc_setup_wizard__service-card-copy"><strong></strong><span><span data-wpbc-service-card-duration></span> &middot; <em><?php esc_html_e( 'Active', 'booking' ); ?></em></span></span>
			</label>
			<button
				type="button"
				class="wpbc_setup_wizard__service-card-remove"
				data-wpbc-remove-service
				aria-label="<?php esc_attr_e( 'Remove Service', 'booking' ); ?>"
				title="<?php esc_attr_e( 'Remove Service', 'booking' ); ?>"
			>
				<i class="menu_icon icon-1x wpbc_icn_delete_outline" aria-hidden="true"></i>
			</button>
		</div>
	</template>
</section>
