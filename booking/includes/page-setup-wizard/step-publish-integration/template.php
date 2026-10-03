<?php
/**
 * Progressive Publish & integrate Setup Wizard page.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized step context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$step_data        = isset( $template_context['step_data'] ) && is_array( $template_context['step_data'] ) ? $template_context['step_data'] : array();
$values           = isset( $step_data['values'] ) && is_array( $step_data['values'] ) ? $step_data['values'] : array();
$destinations     = isset( $step_data['destinations'] ) && is_array( $step_data['destinations'] ) ? $step_data['destinations'] : array();
$pages            = isset( $step_data['pages'] ) && is_array( $step_data['pages'] ) ? $step_data['pages'] : array();
$content_options  = isset( $step_data['content_options'] ) && is_array( $step_data['content_options'] ) ? $step_data['content_options'] : array();
$selected_content = isset( $step_data['selected_content'] ) && is_array( $step_data['selected_content'] ) ? $step_data['selected_content'] : array();
$insertion_help   = isset( $step_data['insertion_help'] ) && is_array( $step_data['insertion_help'] ) ? $step_data['insertion_help'] : array();
$destination_id   = isset( $values['publish_destination'] ) ? sanitize_key( (string) $values['publish_destination'] ) : '';
$page_title       = isset( $values['publish_page_title'] ) ? (string) $values['publish_page_title'] : '';
$existing_page_id = isset( $values['publish_existing_page_id'] ) ? absint( $values['publish_existing_page_id'] ) : 0;
$content_id       = isset( $values['publish_page_content'] ) ? sanitize_key( (string) $values['publish_page_content'] ) : '';
$page_url         = isset( $step_data['page_url'] ) ? (string) $step_data['page_url'] : '';
$home_path        = isset( $step_data['home_path'] ) ? (string) $step_data['home_path'] : '/';
$has_created_page = ! empty( $step_data['has_created_page'] );
$shortcode        = isset( $selected_content['shortcode'] ) ? (string) $selected_content['shortcode'] : '';
$shortcode_help_url   = isset( $selected_content['shortcode_help_url'] ) ? (string) $selected_content['shortcode_help_url'] : '';
$shortcode_help_label = isset( $selected_content['shortcode_help_label'] ) ? (string) $selected_content['shortcode_help_label'] : '';
$insertion_help_url   = isset( $insertion_help['url'] ) ? (string) $insertion_help['url'] : '';
$insertion_help_label = isset( $insertion_help['label'] ) ? (string) $insertion_help['label'] : '';
?>
<section class="wpbc_setup_wizard__step-content wpbc_setup_wizard__publish-step" aria-labelledby="wpbc-setup-wizard-step-title">
	<header class="wpbc_setup_wizard__step-heading">
		<h1 id="wpbc-setup-wizard-step-title"><?php esc_html_e( 'Choose how customers will access booking', 'booking' ); ?></h1>
		<p class="wpbc_setup_wizard__lead"><?php esc_html_e( 'Choose a destination. Your page or publishing choice is saved when you continue.', 'booking' ); ?></p>
	</header>
	<?php
	$template_context['templates']->render(
		'settings-hint',
		array( 'settings_hint' => $template_context['settings_hint'] )
	);
	?>

	<form id="wpbc-setup-wizard-step-form" novalidate>
		<div class="wpbc_setup_wizard__publish-editor" data-wpbc-publish-integration-editor data-home-path="<?php echo esc_attr( $home_path ); ?>" data-has-created-page="<?php echo esc_attr( $has_created_page ? '1' : '0' ); ?>">
			<fieldset class="wpbc_setup_wizard__publish-destinations">
				<legend class="screen-reader-text"><?php esc_html_e( 'Booking access destination', 'booking' ); ?></legend>
				<?php foreach ( $destinations as $destination ) : ?>
					<?php
					$option_id       = isset( $destination['id'] ) ? sanitize_key( (string) $destination['id'] ) : '';
					$option_label    = isset( $destination['label'] ) ? (string) $destination['label'] : '';
					$option_text     = isset( $destination['description'] ) ? (string) $destination['description'] : '';
					$option_icon     = isset( $destination['icon'] ) ? sanitize_html_class( (string) $destination['icon'] ) : 'wpbc_icn_description';
					$option_badge    = isset( $destination['badge'] ) ? (string) $destination['badge'] : '';
					$option_badge_id = '' !== $option_badge ? 'wpbc-publish-destination-badge-' . $option_id : '';
					$is_enabled      = ! empty( $destination['is_enabled'] );
					$disabled_reason = isset( $destination['disabled_reason'] ) ? (string) $destination['disabled_reason'] : '';
					$is_selected     = $destination_id === $option_id;
					?>
					<div class="wpbc_setup_wizard__publish-destination-option">
						<span class="wpbc_setup_wizard__publish-destination-badges">
							<?php if ( '' !== $option_badge ) : ?>
								<span id="<?php echo esc_attr( $option_badge_id ); ?>" class="wpbc_setup_wizard__publish-badge"><?php echo esc_html( $option_badge ); ?></span>
							<?php endif; ?>
						</span>
						<label class="wpbc_setup_wizard__publish-destination-card<?php echo $is_selected ? ' is-selected' : ''; ?><?php echo $is_enabled ? '' : ' is-disabled'; ?>"<?php echo '' !== $disabled_reason ? ' title="' . esc_attr( $disabled_reason ) . '"' : ''; ?>>
							<span class="wpbc_setup_wizard__publish-destination-heading">
								<input
									type="radio"
									name="publish_destination"
									value="<?php echo esc_attr( $option_id ); ?>"
									required
									data-wpbc-setup-wizard-field
									data-wpbc-publish-destination
									<?php if ( '' !== $option_badge_id ) : ?>
										aria-describedby="<?php echo esc_attr( $option_badge_id ); ?>"
									<?php endif; ?>
									<?php checked( $is_selected ); ?>
									<?php disabled( ! $is_enabled ); ?>
								>
								<i class="menu_icon icon-2x <?php echo esc_attr( $option_icon ); ?>" aria-hidden="true"></i>
								<strong><?php echo esc_html( $option_label ); ?></strong>
							</span>

							<span><?php echo esc_html( $option_text ); ?></span>
							<?php if ( ! $is_enabled && '' !== $disabled_reason ) : ?>
								<small><?php echo esc_html( $disabled_reason ); ?></small>
							<?php endif; ?>
						</label>
					</div>
				<?php endforeach; ?>
			</fieldset>
			<span class="wpbc_setup_wizard__field-error wpbc_setup_wizard__field-error--group" data-wpbc-setup-wizard-error-for="publish_destination"></span>

			<section class="wpbc_setup_wizard__publish-settings" aria-labelledby="wpbc-publish-settings-title">
				<header>
					<h2 id="wpbc-publish-settings-title"><?php esc_html_e( 'Page settings', 'booking' ); ?></h2>
					<p><?php esc_html_e( 'Set up your booking page details and choose what happens next.', 'booking' ); ?></p>
				</header>

				<div class="wpbc_setup_wizard__publish-later wpbc_setup_wizard__message wpbc_setup_wizard__message--info" data-wpbc-publish-later-panel <?php echo WPBC_Setup_Wizard_Publish_Integration::DESTINATION_LATER === $destination_id ? '' : 'hidden'; ?>>
					<i class="menu_icon icon-1x wpbc_icn_schedule" aria-hidden="true"></i>
					<div>
						<strong><?php esc_html_e( 'Finish setup without publishing', 'booking' ); ?></strong>
						<p><?php esc_html_e( 'Your booking configuration is already saved. You can add the booking experience to a WordPress page later.', 'booking' ); ?></p>
					</div>
				</div>

				<div class="wpbc_setup_wizard__publish-settings-body" data-wpbc-publish-settings-body <?php echo WPBC_Setup_Wizard_Publish_Integration::DESTINATION_LATER === $destination_id ? 'hidden' : ''; ?>>
					<div class="wpbc_setup_wizard__publish-fields">
						<div class="wpbc_setup_wizard__publish-page-fields">
							<label class="wpbc_setup_wizard__publish-field" data-wpbc-publish-create-field <?php echo WPBC_Setup_Wizard_Publish_Integration::DESTINATION_CREATE_PAGE === $destination_id ? '' : 'hidden'; ?>>
								<span><?php esc_html_e( 'Page title', 'booking' ); ?></span>
								<input
									type="text"
									name="publish_page_title"
									value="<?php echo esc_attr( $page_title ); ?>"
									maxlength="200"
									data-wpbc-setup-wizard-field
									data-wpbc-publish-page-title
									<?php if ( WPBC_Setup_Wizard_Publish_Integration::DESTINATION_CREATE_PAGE === $destination_id ) : ?>
										required
									<?php endif; ?>
								>
								<span class="wpbc_setup_wizard__field-error" data-wpbc-setup-wizard-error-for="publish_page_title"></span>
							</label>

							<label class="wpbc_setup_wizard__publish-field" data-wpbc-publish-existing-field <?php echo WPBC_Setup_Wizard_Publish_Integration::DESTINATION_EXISTING_PAGE === $destination_id ? '' : 'hidden'; ?>>
								<span><?php esc_html_e( 'WordPress page', 'booking' ); ?></span>
								<select
									name="publish_existing_page_id"
									data-wpbc-setup-wizard-field
									data-wpbc-publish-existing-page
									<?php if ( WPBC_Setup_Wizard_Publish_Integration::DESTINATION_EXISTING_PAGE === $destination_id ) : ?>
										required
									<?php endif; ?>
								>
									<option value="0"><?php esc_html_e( 'Choose a page', 'booking' ); ?></option>
									<?php foreach ( $pages as $page ) : ?>
										<option value="<?php echo esc_attr( (string) absint( $page['id'] ) ); ?>" data-page-url="<?php echo esc_attr( isset( $page['url'] ) ? (string) $page['url'] : '' ); ?>" <?php selected( $existing_page_id, absint( $page['id'] ) ); ?>><?php echo esc_html( isset( $page['title'] ) ? (string) $page['title'] : '' ); ?></option>
									<?php endforeach; ?>
								</select>
								<span class="wpbc_setup_wizard__field-error" data-wpbc-setup-wizard-error-for="publish_existing_page_id"></span>
							</label>

							<div class="wpbc_setup_wizard__publish-field wpbc_setup_wizard__publish-url-field" data-wpbc-publish-page-url-field <?php echo in_array( $destination_id, array( WPBC_Setup_Wizard_Publish_Integration::DESTINATION_CREATE_PAGE, WPBC_Setup_Wizard_Publish_Integration::DESTINATION_EXISTING_PAGE ), true ) ? '' : 'hidden'; ?>>
								<span><?php esc_html_e( 'Page URL', 'booking' ); ?></span>
								<div>
									<input type="text" value="<?php echo esc_attr( $page_url ); ?>" readonly data-wpbc-publish-page-url>
									<button type="button" class="button button-link" data-wpbc-publish-copy="page-url" aria-label="<?php esc_attr_e( 'Copy page URL', 'booking' ); ?>">
										<i class="menu_icon icon-1x wpbc_icn_content_copy" aria-hidden="true"></i>
									</button>
								</div>
							</div>
						</div>

						<label class="wpbc_setup_wizard__publish-field wpbc_setup_wizard__publish-content-field">
							<span><?php esc_html_e( 'Page content', 'booking' ); ?></span>
							<select
								name="publish_page_content"
								data-wpbc-setup-wizard-field
								data-wpbc-publish-page-content
								<?php if ( WPBC_Setup_Wizard_Publish_Integration::DESTINATION_LATER !== $destination_id ) : ?>
									required
								<?php endif; ?>
							>
								<?php foreach ( $content_options as $content_option ) : ?>
									<option
										value="<?php echo esc_attr( isset( $content_option['id'] ) ? (string) $content_option['id'] : '' ); ?>"
										data-content-description="<?php echo esc_attr( isset( $content_option['description'] ) ? (string) $content_option['description'] : '' ); ?>"
										data-content-shortcode="<?php echo esc_attr( isset( $content_option['shortcode'] ) ? (string) $content_option['shortcode'] : '' ); ?>"
										data-content-help-url="<?php echo esc_url( isset( $content_option['shortcode_help_url'] ) ? (string) $content_option['shortcode_help_url'] : '' ); ?>"
										data-content-help-label="<?php echo esc_attr( isset( $content_option['shortcode_help_label'] ) ? (string) $content_option['shortcode_help_label'] : '' ); ?>"
										<?php selected( $content_id, isset( $content_option['id'] ) ? (string) $content_option['id'] : '' ); ?>
									><?php echo esc_html( isset( $content_option['label'] ) ? (string) $content_option['label'] : '' ); ?></option>
								<?php endforeach; ?>
							</select>
							<span class="wpbc_setup_wizard__field-error" data-wpbc-setup-wizard-error-for="publish_page_content"></span>
						</label>
					</div>

					<aside class="wpbc_setup_wizard__publish-content-info wpbc_setup_wizard__message wpbc_setup_wizard__message--info" aria-live="polite">
						<i class="menu_icon icon-1x wpbc_icn_info_outline" aria-hidden="true"></i>
						<div>
							<strong data-wpbc-publish-content-title><?php echo esc_html( isset( $selected_content['label'] ) ? (string) $selected_content['label'] : '' ); ?></strong>
							<p data-wpbc-publish-content-description><?php echo esc_html( isset( $selected_content['description'] ) ? (string) $selected_content['description'] : '' ); ?></p>
							<p><?php esc_html_e( 'This recommendation follows the customer journey selected earlier. You can choose another supported page content option.', 'booking' ); ?></p>
							<nav class="wpbc_setup_wizard__publish-content-help" aria-label="<?php esc_attr_e( 'Booking shortcode help', 'booking' ); ?>">
								<a href="<?php echo esc_url( $shortcode_help_url ); ?>" target="_blank" rel="noopener noreferrer" data-wpbc-publish-shortcode-help <?php echo '' === $shortcode_help_url ? 'hidden' : ''; ?>>
									<span data-wpbc-publish-shortcode-help-label><?php echo esc_html( $shortcode_help_label ); ?></span>
									<span class="screen-reader-text"><?php esc_html_e( ' (opens in a new tab)', 'booking' ); ?></span>
								</a>
								<?php if ( '' !== $insertion_help_url && '' !== $insertion_help_label ) : ?>
									<a href="<?php echo esc_url( $insertion_help_url ); ?>" target="_blank" rel="noopener noreferrer">
										<?php echo esc_html( $insertion_help_label ); ?>
										<span class="screen-reader-text"><?php esc_html_e( ' (opens in a new tab)', 'booking' ); ?></span>
									</a>
								<?php endif; ?>
							</nav>
						</div>
					</aside>

					<div class="wpbc_setup_wizard__publish-shortcode">
						<label for="wpbc-setup-wizard-publish-shortcode"><?php esc_html_e( 'Shortcode', 'booking' ); ?></label>
						<div>
							<input id="wpbc-setup-wizard-publish-shortcode" type="text" value="<?php echo esc_attr( $shortcode ); ?>" readonly data-wpbc-publish-shortcode>
							<button type="button" class="button button-link" data-wpbc-publish-copy="shortcode">
								<i class="menu_icon icon-1x wpbc_icn_content_copy" aria-hidden="true"></i>
								<span><?php esc_html_e( 'Copy', 'booking' ); ?></span>
							</button>
						</div>
					</div>
				</div>

				<div class="wpbc_setup_wizard__publish-notice wpbc_setup_wizard__message wpbc_setup_wizard__message--warning" data-wpbc-publish-notice>
					<i class="menu_icon icon-1x wpbc_icn_info_outline" aria-hidden="true"></i>
					<p data-wpbc-publish-notice-text><?php esc_html_e( 'Save creates this WordPress page now. Repeating the save updates the same Setup Wizard page instead of creating a duplicate.', 'booking' ); ?></p>
				</div>
			</section>
		</div>
	</form>
</section>
