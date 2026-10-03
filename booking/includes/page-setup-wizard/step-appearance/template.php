<?php
/**
 * Modular Setup Wizard Appearance editor.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized step context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$step_data          = isset( $template_context['step_data'] ) && is_array( $template_context['step_data'] ) ? $template_context['step_data'] : array();
$values             = isset( $step_data['values'] ) && is_array( $step_data['values'] ) ? $step_data['values'] : array();
$starting_styles    = isset( $step_data['starting_styles'] ) && is_array( $step_data['starting_styles'] ) ? $step_data['starting_styles'] : array();
$accent_colors      = isset( $step_data['accent_colors'] ) && is_array( $step_data['accent_colors'] ) ? $step_data['accent_colors'] : array();
$calendar_skins     = isset( $step_data['calendar_skins'] ) && is_array( $step_data['calendar_skins'] ) ? $step_data['calendar_skins'] : array();
$selected_style     = isset( $values['booking_form_style'] ) ? (string) $values['booking_form_style'] : '';
$selected_accent    = isset( $values['booking_form_accent_color'] ) ? strtoupper( (string) $values['booking_form_accent_color'] ) : '#315EFB';
$selected_skin      = isset( $values['booking_skin'] ) ? (string) $values['booking_skin'] : '';
$selected_time_mode = isset( $values['booking_timeslot_picker'] ) ? (string) $values['booking_timeslot_picker'] : 'Off';
$template_slug      = isset( $step_data['template_slug'] ) ? (string) $step_data['template_slug'] : '';
$booking_form_usage = isset( $step_data['booking_form_usage'] ) ? sanitize_key( (string) $step_data['booking_form_usage'] ) : '';
$preview_html       = isset( $step_data['preview_html'] ) && is_string( $step_data['preview_html'] ) ? $step_data['preview_html'] : '';
$preview_error      = isset( $step_data['preview_error'] ) && is_string( $step_data['preview_error'] ) ? $step_data['preview_error'] : '';
?>
<section class="wpbc_setup_wizard__step-content wpbc_setup_wizard__appearance-step" aria-labelledby="wpbc-setup-wizard-step-title">
	<header class="wpbc_setup_wizard__step-heading">
		<h1 id="wpbc-setup-wizard-step-title"><?php esc_html_e( 'Choose your booking appearance', 'booking' ); ?></h1>
		<p class="wpbc_setup_wizard__lead"><?php esc_html_e( 'Select a starting style and fine-tune the booking experience.', 'booking' ); ?></p>
	</header>
	<?php
	$template_context['templates']->render(
		'settings-hint',
		array( 'settings_hint' => $template_context['settings_hint'] )
	);
	?>

	<form id="wpbc-setup-wizard-step-form" novalidate>
		<div
			class="wpbc_setup_wizard__appearance-editor"
			data-wpbc-appearance-editor
			data-template-slug="<?php echo esc_attr( $template_slug ); ?>"
			data-booking-form-usage="<?php echo esc_attr( $booking_form_usage ); ?>"
		>
			<section class="wpbc_setup_wizard__appearance-panel wpbc_setup_wizard__appearance-starting" aria-labelledby="wpbc-appearance-starting-title">
				<h2 id="wpbc-appearance-starting-title"><?php esc_html_e( 'Starting style', 'booking' ); ?></h2>
				<div class="wpbc_setup_wizard__appearance-style-grid">
					<?php foreach ( $starting_styles as $style ) : ?>
						<?php
						$style_id          = isset( $style['id'] ) ? sanitize_key( (string) $style['id'] ) : '';
						$style_label       = isset( $style['label'] ) ? (string) $style['label'] : '';
						$style_description = isset( $style['description'] ) ? (string) $style['description'] : '';
						$is_selected       = $selected_style === $style_id;
						?>
						<label class="wpbc_setup_wizard__appearance-style-card wpbc_setup_wizard__appearance-style-card--<?php echo esc_attr( $style_id ); ?><?php echo $is_selected ? ' is-selected' : ''; ?>">
							<span class="wpbc_setup_wizard__appearance-style-copy">
								<input
									type="radio"
									name="booking_form_style"
									value="<?php echo esc_attr( $style_id ); ?>"
									required
									data-wpbc-setup-wizard-field
									data-wpbc-appearance-style
									<?php checked( $is_selected ); ?>
								>
								<span>
									<strong><?php echo esc_html( $style_label ); ?></strong>
									<small><?php echo esc_html( $style_description ); ?></small>
								</span>
							</span>
							<span class="wpbc_setup_wizard__appearance-style-preview" aria-hidden="true">
								<span class="wpbc_setup_wizard__appearance-mini-calendar">
									<span class="wpbc_setup_wizard__appearance-mini-calendar-grid">
										<?php for ( $calendar_index = 0; $calendar_index < 28; $calendar_index++ ) : ?>
											<span></span>
										<?php endfor; ?>
									</span>
								</span>
								<i class="wpbc_setup_wizard__appearance-mini-fields"><b></b><b></b><b></b></i>
							</span>
						</label>
					<?php endforeach; ?>
				</div>
				<span class="wpbc_setup_wizard__field-error wpbc_setup_wizard__field-error--group" data-wpbc-setup-wizard-error-for="booking_form_style"></span>
			</section>

			<section class="wpbc_setup_wizard__appearance-panel wpbc_setup_wizard__appearance-controls" aria-label="<?php esc_attr_e( 'Booking appearance controls', 'booking' ); ?>">
				<div class="wpbc_setup_wizard__appearance-control" data-wpbc-appearance-accent-control>
					<label for="wpbc-setup-wizard-appearance-accent">
						<strong><?php esc_html_e( 'Accent color', 'booking' ); ?></strong>
						<span><?php esc_html_e( 'Choose a color that matches your brand.', 'booking' ); ?></span>
					</label>
					<div class="wpbc_setup_wizard__appearance-accent-options">
						<div class="wpbc_setup_wizard__appearance-accent-swatches" role="group" aria-label="<?php esc_attr_e( 'Preset accent colors', 'booking' ); ?>">
							<?php foreach ( $accent_colors as $accent_color ) : ?>
								<?php
								$accent_value = isset( $accent_color['value'] ) ? strtoupper( (string) $accent_color['value'] ) : '';
								$accent_label = isset( $accent_color['label'] ) ? (string) $accent_color['label'] : '';
								if ( ! preg_match( '/^#[0-9A-F]{6}$/', $accent_value ) || '' === $accent_label ) {
									continue;
								}
								$is_accent_selected = $selected_accent === $accent_value;
								?>
								<button
									type="button"
									class="wpbc_setup_wizard__appearance-accent-swatch<?php echo $is_accent_selected ? ' is-selected' : ''; ?>"
									style="--wpbc-appearance-accent: <?php echo esc_attr( $accent_value ); ?>;"
									data-wpbc-appearance-accent-swatch="<?php echo esc_attr( $accent_value ); ?>"
									aria-label="<?php echo esc_attr( sprintf( __( 'Use %s accent color', 'booking' ), $accent_label ) ); ?>"
									aria-pressed="<?php echo $is_accent_selected ? 'true' : 'false'; ?>"
								></button>
							<?php endforeach; ?>
						</div>
						<input
							type="text"
							id="wpbc-setup-wizard-appearance-accent"
							name="booking_form_accent_color"
							value="<?php echo esc_attr( $selected_accent ); ?>"
							class="wpbc_setup_wizard__appearance-coloris"
							data-coloris
							autocomplete="off"
							pattern="^#[0-9A-Fa-f]{6}$"
							required
							data-wpbc-setup-wizard-field
							data-wpbc-appearance-accent-value
						>
					</div>
					<span class="wpbc_setup_wizard__field-error" data-wpbc-setup-wizard-error-for="booking_form_accent_color"></span>
				</div>

				<div class="wpbc_setup_wizard__appearance-control">
					<label for="wpbc-setup-wizard-appearance-skin">
						<strong><?php esc_html_e( 'Calendar skin', 'booking' ); ?></strong>
						<span><?php esc_html_e( 'Choose the calendar appearance used in the booking form.', 'booking' ); ?></span>
					</label>
					<select id="wpbc-setup-wizard-appearance-skin" name="booking_skin" required data-wpbc-setup-wizard-field data-wpbc-appearance-preview-field>
						<?php foreach ( $calendar_skins as $skin_group ) : ?>
							<optgroup label="<?php echo esc_attr( isset( $skin_group['label'] ) ? (string) $skin_group['label'] : '' ); ?>">
								<?php foreach ( $skin_group['options'] as $skin_option ) : ?>
									<option value="<?php echo esc_attr( (string) $skin_option['value'] ); ?>" data-wpbc-calendar-skin-url="<?php echo esc_url( isset( $skin_option['url'] ) ? (string) $skin_option['url'] : '' ); ?>" <?php selected( $selected_skin, (string) $skin_option['value'] ); ?>><?php echo esc_html( (string) $skin_option['label'] ); ?></option>
								<?php endforeach; ?>
							</optgroup>
						<?php endforeach; ?>
					</select>
					<span class="wpbc_setup_wizard__field-error" data-wpbc-setup-wizard-error-for="booking_skin"></span>
				</div>

				<fieldset class="wpbc_setup_wizard__appearance-control wpbc_setup_wizard__appearance-time-control">
					<legend><?php esc_html_e( 'Time selection', 'booking' ); ?></legend>
					<p><?php esc_html_e( 'Choose how time slots are shown in the booking form.', 'booking' ); ?></p>
					<div>
						<label class="<?php echo 'Off' === $selected_time_mode ? 'is-selected' : ''; ?>">
							<input type="radio" name="booking_timeslot_picker" value="Off" required data-wpbc-setup-wizard-field data-wpbc-appearance-time-mode <?php checked( $selected_time_mode, 'Off' ); ?>>
							<span><?php esc_html_e( 'Select box', 'booking' ); ?></span>
						</label>
						<label class="<?php echo 'On' === $selected_time_mode ? 'is-selected' : ''; ?>">
							<input type="radio" name="booking_timeslot_picker" value="On" required data-wpbc-setup-wizard-field data-wpbc-appearance-time-mode <?php checked( $selected_time_mode, 'On' ); ?>>
							<span><?php esc_html_e( 'Time picker', 'booking' ); ?></span>
						</label>
					</div>
					<span class="wpbc_setup_wizard__field-error wpbc_setup_wizard__field-error--group" data-wpbc-setup-wizard-error-for="booking_timeslot_picker"></span>
				</fieldset>
			</section>

			<section class="wpbc_setup_wizard__appearance-preview-panel" aria-labelledby="wpbc-setup-wizard-appearance-preview-title">
				<header class="wpbc_setup_wizard__appearance-preview-toolbar">
					<div>
						<h2 id="wpbc-setup-wizard-appearance-preview-title"><?php esc_html_e( 'Live preview', 'booking' ); ?></h2>
						<span><i aria-hidden="true"></i><?php esc_html_e( 'Updates instantly', 'booking' ); ?></span>
					</div>
				</header>
				<div class="wpbc_setup_wizard__appearance-preview-stage" data-wpbc-appearance-preview-stage>
					<div class="wpbc_theme_preview wpbc_theme_preview_mode_form" data-wpbc-theme-preview="1" data-wpbc-appearance-inline-preview data-wpbc-inline-booking-preview="1">
						<div class="wpbc_theme_real_preview" data-wpbc-theme-calendar-panel="1">
							<?php echo $preview_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- generated by the shared Form Builder renderer after registry resolution and preview sanitization. ?>
						</div>
					</div>
					<div class="wpbc_setup_wizard__appearance-preview-error" role="alert" <?php echo '' === $preview_error ? 'hidden' : ''; ?> data-wpbc-appearance-preview-error>
						<i class="menu_icon icon-1x wpbc_icn_error_outline" aria-hidden="true"></i>
						<span><?php echo esc_html( $preview_error ); ?></span>
					</div>
				</div>
				<p class="wpbc_setup_wizard__appearance-preview-note wpbc_setup_wizard__message wpbc_setup_wizard__message--info">
					<i class="menu_icon icon-1x wpbc_icn_info_outline" aria-hidden="true"></i>
					<span><?php esc_html_e( 'This request-local preview uses the booking form template selected in the previous step. Appearance changes are shown immediately and do not change any live Booking Calendar setting. Calculated date, time, capacity, and cost summaries are marked Preview only, and final booking submission is disabled.', 'booking' ); ?></span>
				</p>
			</section>
		</div>
	</form>
</section>
