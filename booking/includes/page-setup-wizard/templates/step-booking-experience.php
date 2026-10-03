<?php
/**
 * Page 4 Booking Mode terminology chooser.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized step context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$step_data           = $template_context['step_data'];
$selected_experience = $step_data['values']['booking_experience'];
?>
<section class="wpbc_setup_wizard__step-content" aria-labelledby="wpbc-setup-wizard-step-title">
	<header class="wpbc_setup_wizard__step-heading">
		<h1 id="wpbc-setup-wizard-step-title"><?php esc_html_e( 'Choose your admin terminology', 'booking' ); ?></h1>
		<p class="wpbc_setup_wizard__lead">
			<?php esc_html_e( 'This changes names and navigation in your admin area.', 'booking' ); ?>
			<span><?php esc_html_e( 'You can change the Booking Mode at any time from the top toolbar in the admin panel.', 'booking' ); ?></span>
		</p>
	</header>

	<form id="wpbc-setup-wizard-step-form" novalidate>
	<fieldset class="wpbc_setup_wizard__experience-fieldset" data-wpbc-setup-wizard-fields>
		<legend class="screen-reader-text"><?php esc_html_e( 'Choose the terminology used in your Booking Calendar administration area', 'booking' ); ?></legend>
		<div class="wpbc_setup_wizard__experience-grid wpbc_setup_wizard__mode-grid">
			<?php foreach ( $step_data['experiences'] as $experience ) : ?>
				<?php
				$is_selected = $selected_experience === $experience['id'];
				?>
				<label class="wpbc_setup_wizard__experience-card wpbc_setup_wizard__mode-card<?php echo $is_selected ? ' is-selected' : ''; ?>">
					<span class="wpbc_setup_wizard__card-topline">
						<span class="wpbc_setup_wizard__experience-choice">
							<input class="screen-reader-text" type="radio" name="booking_experience" value="<?php echo esc_attr( $experience['id'] ); ?>"<?php checked( $is_selected ); ?> required data-wpbc-setup-wizard-field aria-describedby="wpbc-setup-wizard-booking-experience-error">
							<span class="wpbc_setup_wizard__radio-mark" aria-hidden="true"></span>
							<strong class="wpbc_setup_wizard__experience-title"><?php echo esc_html( $experience['title'] ); ?></strong>
						</span>
						<span class="wpbc_setup_wizard__selected-badge"<?php echo $is_selected ? '' : ' hidden'; ?>>
							<i class="menu_icon icon-1x wpbc_icn_check" aria-hidden="true"></i>
							<?php esc_html_e( 'Selected', 'booking' ); ?>
						</span>
					</span>
					<span class="wpbc_setup_wizard__mode-preview" aria-hidden="true">
						<span class="wpbc_setup_wizard__mode-preview-sidebar">
							<span class="wpbc_setup_wizard__mode-preview-brand">
								<?php
								// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Trusted SVG helper escapes its generated attributes.
								echo wpbc_get_svg_logo_for_html(
									array(
										'svg_color'     => '#fff',
										'svg_color_alt' => '#fff',
										'opacity'       => '0.45',
										'style_default' => 'background-repeat: no-repeat; background-position: center; display: inline-block; vertical-align: middle;',
										'style_adjust'  => 'background-size: 22px auto; width: 22px; height: 22px; margin-top: 0;',
										'css_class'     => 'wpbc_setup_wizard__mode-preview-logo',
									)
								);
								?>
								<strong><?php esc_html_e( 'Booking Calendar', 'booking' ); ?></strong>
							</span>
							<span class="wpbc_setup_wizard__mode-preview-menu">
								<?php foreach ( $experience['admin_navigation'] as $navigation_index => $navigation_item ) : ?>
									<span class="<?php echo 0 === $navigation_index ? 'is-active' : ''; ?>">
										<i class="menu_icon icon-1x <?php echo esc_attr( $navigation_item['icon'] ); ?>" aria-hidden="true"></i>
										<?php echo esc_html( $navigation_item['label'] ); ?>
									</span>
								<?php endforeach; ?>
							</span>
						</span>
						<span class="wpbc_setup_wizard__mode-preview-canvas">
							<span></span><span></span><span></span><span></span>
						</span>
					</span>
					<span class="wpbc_setup_wizard__card-copy">
						<i class="menu_icon icon-1x wpbc_icn_bar_chart" aria-hidden="true"></i>
						<span class="wpbc_setup_wizard__card-copy-text">
							<strong><?php esc_html_e( 'Your dashboard will use', 'booking' ); ?></strong>
							<span><?php echo esc_html( $experience['dashboard_uses'] ); ?></span>
						</span>
					</span>
					<span class="wpbc_setup_wizard__card-copy">
						<i class="menu_icon icon-1x wpbc_icn_groups" aria-hidden="true"></i>
						<span class="wpbc_setup_wizard__card-copy-text">
							<strong><?php esc_html_e( 'Best for', 'booking' ); ?></strong>
							<span><?php echo esc_html( $experience['best_for'] ); ?></span>
						</span>
					</span>
				</label>
			<?php endforeach; ?>
		</div>
		<span class="wpbc_setup_wizard__field-error wpbc_setup_wizard__field-error--group" id="wpbc-setup-wizard-booking-experience-error" data-wpbc-setup-wizard-error-for="booking_experience"></span>
	</fieldset>
	</form>
</section>
