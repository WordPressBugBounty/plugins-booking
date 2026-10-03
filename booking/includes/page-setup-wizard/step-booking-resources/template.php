<?php
/**
 * Setup Wizard Booking Resources editor template.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized step context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$step_data                  = $template_context['step_data'];
$existing_resources         = isset( $step_data['existing_resources'] ) && is_array( $step_data['existing_resources'] ) ? $step_data['existing_resources'] : array();
$booking_resources          = isset( $step_data['booking_resources'] ) && is_array( $step_data['booking_resources'] ) ? $step_data['booking_resources'] : array();
$existing_resource_updates  = isset( $step_data['existing_resource_updates'] ) && is_array( $step_data['existing_resource_updates'] ) ? $step_data['existing_resource_updates'] : array();
$can_create_resources       = ! empty( $step_data['can_create_resources'] );
$pricing_available          = ! empty( $step_data['pricing_available'] );
$media_upload_available     = ! empty( $step_data['media_upload_available'] );
$currency_symbol            = isset( $step_data['currency_symbol'] ) ? (string) $step_data['currency_symbol'] : '$';
$max_resource_drafts        = isset( $step_data['max_resource_drafts'] ) ? absint( $step_data['max_resource_drafts'] ) : 0;
$booking_resources_json     = wp_json_encode( $booking_resources );
$booking_resources_json     = false === $booking_resources_json ? '[]' : $booking_resources_json;
$existing_resources_json    = wp_json_encode( $existing_resources );
$existing_resources_json    = false === $existing_resources_json ? '[]' : $existing_resources_json;
$existing_updates_json      = wp_json_encode( $existing_resource_updates );
$existing_updates_json      = false === $existing_updates_json ? '[]' : $existing_updates_json;
?>
<section class="wpbc_setup_wizard__step-content wpbc_setup_wizard__booking-resources-step" aria-labelledby="wpbc-setup-wizard-step-title">
	<header class="wpbc_setup_wizard__step-heading">
		<h1 id="wpbc-setup-wizard-step-title"><?php esc_html_e( 'Create your booking resources', 'booking' ); ?></h1>
		<p class="wpbc_setup_wizard__lead"><?php esc_html_e( 'Add the spaces, equipment, or other full-day items customers can book.', 'booking' ); ?></p>
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
			name="booking_resources"
			value="<?php echo esc_attr( $booking_resources_json ); ?>"
			required
			data-wpbc-setup-wizard-field
			data-wpbc-booking-resource-drafts
			data-max-resource-drafts="<?php echo esc_attr( (string) $max_resource_drafts ); ?>"
			aria-describedby="wpbc-setup-wizard-booking-resources-error"
		>
		<input
			type="hidden"
			name="existing_booking_resources"
			value="<?php echo esc_attr( $existing_updates_json ); ?>"
			data-wpbc-setup-wizard-field
			data-wpbc-existing-resource-updates
			aria-describedby="wpbc-setup-wizard-existing-booking-resources-error"
		>
		<input type="hidden" value="<?php echo esc_attr( $existing_resources_json ); ?>" data-wpbc-existing-resource-source>

		<div class="wpbc_setup_wizard__booking-resources-layout" data-wpbc-booking-resources-editor data-can-create="<?php echo $can_create_resources ? 'true' : 'false'; ?>" data-pricing-available="<?php echo $pricing_available ? 'true' : 'false'; ?>" data-media-upload-available="<?php echo $media_upload_available ? 'true' : 'false'; ?>">
			<aside class="wpbc_setup_wizard__booking-resources-list-panel" aria-labelledby="wpbc-setup-wizard-booking-resources-list-title">
				<h2 id="wpbc-setup-wizard-booking-resources-list-title"><?php esc_html_e( 'Your booking resources', 'booking' ); ?></h2>

				<section class="wpbc_setup_wizard__resource-list-section wpbc_setup_wizard__resource-list-section--new" aria-labelledby="wpbc-setup-wizard-new-resources-title">
					<h3 id="wpbc-setup-wizard-new-resources-title"><?php esc_html_e( 'New in this setup', 'booking' ); ?></h3>
					<p><?php esc_html_e( 'Create new Booking Resources for this booking flow.', 'booking' ); ?></p>
					<div class="wpbc_setup_wizard__new-resource-list" role="group" aria-label="<?php esc_attr_e( 'New Booking Resources to edit', 'booking' ); ?>" data-wpbc-new-resource-list></div>
				</section>

				<div class="wpbc_setup_wizard__add-resource-wrap">
					<button type="button" class="button button-secondary wpbc_setup_wizard__add-resource" data-wpbc-add-resource <?php disabled( ! $can_create_resources ); ?>>
						<i class="menu_icon icon-1x wpbc_icn_add" aria-hidden="true"></i>
						<span><?php esc_html_e( 'Add another booking resource', 'booking' ); ?></span>
						<?php if ( ! $can_create_resources ) : ?><span class="wpbc_setup_wizard__edition-badge"><?php esc_html_e( 'Pro', 'booking' ); ?></span><?php endif; ?>
					</button>
					<?php if ( ! $can_create_resources ) : ?><p><?php esc_html_e( 'Additional Booking Resources are available in Pro versions.', 'booking' ); ?></p><?php endif; ?>
				</div>

				<?php if ( ! empty( $existing_resources ) ) : ?>
					<section class="wpbc_setup_wizard__resource-list-section wpbc_setup_wizard__resource-list-section--existing" aria-labelledby="wpbc-setup-wizard-existing-resources-title">
						<h3 id="wpbc-setup-wizard-existing-resources-title"><?php esc_html_e( 'Existing booking resources', 'booking' ); ?></h3>
						<p><?php esc_html_e( 'Select an existing Booking Resource to edit its details.', 'booking' ); ?></p>
						<div class="wpbc_setup_wizard__existing-resource-list" role="group" aria-label="<?php esc_attr_e( 'Existing Booking Resources to edit', 'booking' ); ?>" data-wpbc-existing-resource-list>
							<?php foreach ( $existing_resources as $resource_index => $existing_resource ) : ?>
								<label class="wpbc_setup_wizard__existing-resource-card" data-wpbc-existing-resource-card data-resource-index="<?php echo esc_attr( (string) $resource_index ); ?>">
									<input class="screen-reader-text" type="radio" name="wpbc_setup_wizard_resource_editor_selection" value="existing-<?php echo esc_attr( (string) absint( $existing_resource['id'] ) ); ?>" data-wpbc-resource-selection="existing:<?php echo esc_attr( (string) $resource_index ); ?>">
									<span class="wpbc_setup_wizard__radio-mark" aria-hidden="true"></span>
									<span class="wpbc_setup_wizard__resource-card-picture">
										<img src="<?php echo esc_url( $existing_resource['picture_url'] ); ?>" alt="" <?php echo empty( $existing_resource['picture_url'] ) ? 'hidden' : ''; ?>>
										<i class="menu_icon icon-1x wpbc-bi-image-fill" aria-hidden="true" <?php echo empty( $existing_resource['picture_url'] ) ? '' : 'hidden'; ?>></i>
									</span>
									<span class="wpbc_setup_wizard__resource-card-copy">
										<span class="wpbc_setup_wizard__resource-card-title-row">
											<strong><?php echo esc_html( $existing_resource['title'] ); ?></strong>
											<span
												class="wpbc_setup_wizard__resource-status-badge is-existing"
												data-wpbc-resource-status
												data-existing-label="<?php esc_attr_e( 'Existing', 'booking' ); ?>"
												data-changed-label="<?php esc_attr_e( 'Changed', 'booking' ); ?>"
												aria-live="polite"
											><?php esc_html_e( 'Existing', 'booking' ); ?></span>
										</span>
									</span>
								</label>
							<?php endforeach; ?>
						</div>
					</section>
				<?php endif; ?>
			</aside>

			<section class="wpbc_setup_wizard__resource-details-panel" aria-labelledby="wpbc-setup-wizard-resource-details-title" data-wpbc-resource-details>
				<header class="wpbc_setup_wizard__resource-details-heading">
					<h2 id="wpbc-setup-wizard-resource-details-title"><?php esc_html_e( 'Booking resource details', 'booking' ); ?></h2>
					<span><?php esc_html_e( '* Required fields', 'booking' ); ?></span>
				</header>

				<div class="wpbc_setup_wizard__resource-empty" data-wpbc-resource-empty>
					<p><?php echo esc_html( $can_create_resources ? __( 'Select an existing Booking Resource to edit it, or add a new Resource.', 'booking' ) : __( 'Select your existing Booking Resource to edit its details.', 'booking' ) ); ?></p>
				</div>

				<div class="wpbc_setup_wizard__resource-details-fields" data-wpbc-resource-fields hidden>
					<div class="wpbc_setup_wizard__field wpbc_setup_wizard__resource-title-field">
						<label for="wpbc-setup-wizard-resource-title"><?php esc_html_e( 'Resource name', 'booking' ); ?> <span aria-hidden="true">*</span></label>
						<input id="wpbc-setup-wizard-resource-title" type="text" maxlength="200" required data-wpbc-resource-field="title" data-wpbc-setup-wizard-error-control-for="booking_resources">
					</div>

					<div class="wpbc_setup_wizard__field wpbc_setup_wizard__resource-price-field">
						<label for="wpbc-setup-wizard-resource-price">
							<?php printf( esc_html__( 'Base cost (%s)', 'booking' ), esc_html( $currency_symbol ) ); ?>
							<?php if ( ! $pricing_available ) : ?><span class="wpbc_setup_wizard__edition-badge"><?php esc_html_e( 'Business Small+', 'booking' ); ?></span><?php endif; ?>
						</label>
						<input id="wpbc-setup-wizard-resource-price" type="number" min="0" step="0.01" data-wpbc-resource-field="base_cost" <?php disabled( ! $pricing_available ); ?>>
						<span class="wpbc_setup_wizard__field-help"><?php echo esc_html( $pricing_available ? __( 'Default price for this Booking Resource.', 'booking' ) : __( 'Pricing is available in Business Small or higher.', 'booking' ) ); ?></span>
					</div>

					<div class="wpbc_setup_wizard__field wpbc_setup_wizard__resource-description-field">
						<label for="wpbc-setup-wizard-resource-description"><?php esc_html_e( 'Description', 'booking' ); ?></label>
						<textarea id="wpbc-setup-wizard-resource-description" maxlength="2000" rows="7" data-wpbc-resource-field="description"></textarea>
					</div>

					<div class="wpbc_setup_wizard__field wpbc_setup_wizard__resource-picture-field">
						<label><?php esc_html_e( 'Picture (optional)', 'booking' ); ?></label>
						<div class="wpbc_setup_wizard__resource-picture-preview" data-wpbc-resource-picture-preview>
							<img alt="" hidden data-wpbc-resource-picture-image>
							<i class="menu_icon icon-1x wpbc-bi-image-fill" aria-hidden="true" data-wpbc-resource-picture-placeholder></i>
						</div>
						<input id="wpbc-setup-wizard-resource-picture-url" type="hidden" data-wpbc-resource-field="picture_url">
						<div class="wpbc_setup_wizard__resource-picture-actions">
							<button type="button" class="button button-secondary wpbc_media_upload_button" data-modal_title="<?php esc_attr_e( 'Select Booking Resource image', 'booking' ); ?>" data-btn_title="<?php esc_attr_e( 'Use this image', 'booking' ); ?>" data-url_field="wpbc-setup-wizard-resource-picture-url" <?php disabled( ! $media_upload_available ); ?>><?php esc_html_e( 'Select image', 'booking' ); ?></button>
							<button type="button" class="button button-secondary" data-wpbc-remove-resource-picture><?php esc_html_e( 'Remove', 'booking' ); ?></button>
						</div>
					</div>

				</div>
			</section>
		</div>
		<span class="wpbc_setup_wizard__field-error wpbc_setup_wizard__field-error--group" id="wpbc-setup-wizard-booking-resources-error" data-wpbc-setup-wizard-error-for="booking_resources"></span>
		<span class="wpbc_setup_wizard__field-error wpbc_setup_wizard__field-error--group" id="wpbc-setup-wizard-existing-booking-resources-error" data-wpbc-setup-wizard-error-for="existing_booking_resources"></span>
	</form>

	<template data-wpbc-resource-card-template>
		<div class="wpbc_setup_wizard__resource-card">
			<label class="wpbc_setup_wizard__resource-card-selection">
				<input class="screen-reader-text" type="radio" name="wpbc_setup_wizard_resource_editor_selection">
				<span class="wpbc_setup_wizard__radio-mark" aria-hidden="true"></span>
				<span class="wpbc_setup_wizard__resource-card-picture"><img alt="" hidden><i class="menu_icon icon-1x wpbc-bi-image-fill" aria-hidden="true"></i></span>
				<span class="wpbc_setup_wizard__resource-card-copy">
					<span class="wpbc_setup_wizard__resource-card-title-row">
						<strong></strong>
						<span class="wpbc_setup_wizard__resource-status-badge is-new"><?php esc_html_e( 'New', 'booking' ); ?></span>
					</span>
				</span>
			</label>
			<button type="button" class="wpbc_setup_wizard__resource-card-remove" data-wpbc-remove-resource aria-label="<?php esc_attr_e( 'Remove Booking Resource', 'booking' ); ?>" title="<?php esc_attr_e( 'Remove Booking Resource', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc_icn_delete_outline" aria-hidden="true"></i></button>
		</div>
	</template>
</section>
