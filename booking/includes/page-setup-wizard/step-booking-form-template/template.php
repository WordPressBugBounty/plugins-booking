<?php
/**
 * Modular Page 9 Booking Form template selector.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized step context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$step_data           = $template_context['step_data'];
$templates           = isset( $step_data['templates'] ) && is_array( $step_data['templates'] ) ? $step_data['templates'] : array();
$filters             = isset( $step_data['filters'] ) && is_array( $step_data['filters'] ) ? $step_data['filters'] : array();
$usage_options       = isset( $step_data['usage_options'] ) && is_array( $step_data['usage_options'] ) ? $step_data['usage_options'] : array();
$selected_template   = isset( $step_data['selected_template'] ) && is_array( $step_data['selected_template'] ) ? $step_data['selected_template'] : array();
$selected_slug       = isset( $step_data['values']['booking_form_template'] ) ? (string) $step_data['values']['booking_form_template'] : '';
$selected_usage      = isset( $step_data['values']['booking_form_usage'] ) ? sanitize_key( (string) $step_data['values']['booking_form_usage'] ) : 'direct_booking_form';
$selected_category   = isset( $selected_template['category'] ) ? sanitize_key( (string) $selected_template['category'] ) : '';
$initial_filter      = ! empty( $selected_template['is_recommended'] )
	? 'recommended'
	: ( in_array( $selected_category, array( 'appointments', 'time_slots', 'full_days' ), true ) ? $selected_category : 'all' );
$preview_title       = isset( $selected_template['title'] ) ? (string) $selected_template['title'] : '';
$preview_kind        = isset( $step_data['preview_kind'] ) ? sanitize_key( (string) $step_data['preview_kind'] ) : '';
$preview_html        = isset( $step_data['preview_html'] ) ? (string) $step_data['preview_html'] : '';
$preview_bootstrap   = isset( $step_data['preview_bootstrap'] ) && is_array( $step_data['preview_bootstrap'] ) ? $step_data['preview_bootstrap'] : array();
$preview_error       = isset( $step_data['preview_error'] ) ? (string) $step_data['preview_error'] : '';
$has_inline_preview  = 'inline' === $preview_kind && '' !== trim( $preview_html ) && ! empty( $preview_bootstrap );
$applied_form_slug   = 'standard';
$preview_shortcode   = 'appointment_flow' === $selected_usage
	? sprintf( '[booking_appointment form_type="%s"]', $applied_form_slug )
	: sprintf( '[booking form_type="%s"]', $applied_form_slug );
?>
<section class="wpbc_setup_wizard__step-content wpbc_setup_wizard__booking-form-step" aria-labelledby="wpbc-setup-wizard-step-title">
	<header class="wpbc_setup_wizard__step-heading">
		<h1 id="wpbc-setup-wizard-step-title"><?php esc_html_e( 'Choose a booking form template', 'booking' ); ?></h1>
		<p class="wpbc_setup_wizard__lead"><?php esc_html_e( 'Select a template and try the real booking form before continuing.', 'booking' ); ?></p>
	</header>
	<?php
	$template_context['templates']->render(
		'settings-hint',
		array( 'settings_hint' => $template_context['settings_hint'] )
	);
	?>

	<form id="wpbc-setup-wizard-step-form" novalidate>
		<div class="wpbc_setup_wizard__booking-form-layout" data-wpbc-booking-form-template-editor data-initial-filter="<?php echo esc_attr( $initial_filter ); ?>">
			<section class="wpbc_setup_wizard__template-library" aria-labelledby="wpbc-setup-wizard-template-library-title">
				<div class="wpbc_setup_wizard__template-controls">
					<h2 id="wpbc-setup-wizard-template-library-title"><?php esc_html_e( 'Templates', 'booking' ); ?></h2>

					<label class="wpbc_setup_wizard__template-search">
						<span class="screen-reader-text"><?php esc_html_e( 'Search booking form templates', 'booking' ); ?></span>
						<input type="search" placeholder="<?php esc_attr_e( 'Search templates', 'booking' ); ?>" autocomplete="off" data-wpbc-template-search>
					</label>

					<div class="wpbc_setup_wizard__template-filters" role="tablist" aria-label="<?php esc_attr_e( 'Filter booking form templates', 'booking' ); ?>">
						<?php foreach ( $filters as $filter_index => $filter ) : ?>
							<?php
							$filter_id    = isset( $filter['id'] ) ? sanitize_key( (string) $filter['id'] ) : '';
							$filter_label = isset( $filter['label'] ) ? (string) $filter['label'] : '';
							$filter_count = isset( $filter['count'] ) ? absint( $filter['count'] ) : 0;
							$is_active    = $initial_filter === $filter_id;
							?>
							<button
								type="button"
								role="tab"
								id="wpbc-setup-wizard-template-filter-<?php echo esc_attr( $filter_id ); ?>"
								aria-selected="<?php echo $is_active ? 'true' : 'false'; ?>"
								tabindex="<?php echo $is_active ? '0' : '-1'; ?>"
								class="wpbc_setup_wizard__template-filter<?php echo $is_active ? ' is-active' : ''; ?>"
								data-wpbc-template-filter="<?php echo esc_attr( $filter_id ); ?>"
								data-template-count="<?php echo esc_attr( (string) $filter_count ); ?>"
							>
								<?php echo esc_html( $filter_label ); ?><?php if ( 'all' === $filter_id ) : ?> <span>(<?php echo esc_html( (string) $filter_count ); ?>)</span><?php endif; ?>
							</button>
						<?php endforeach; ?>
					</div>
				</div>

				<div
					class="wpbc_setup_wizard__template-grid"
					role="tabpanel"
					tabindex="0"
					aria-live="polite"
					aria-labelledby="wpbc-setup-wizard-template-filter-<?php echo esc_attr( $initial_filter ); ?>"
					data-wpbc-template-grid
				>
					<?php foreach ( $templates as $template ) : ?>
						<?php
						$template_slug        = isset( $template['slug'] ) ? (string) $template['slug'] : '';
						$template_title       = isset( $template['title'] ) ? (string) $template['title'] : '';
						$template_description = isset( $template['description'] ) ? (string) $template['description'] : '';
						$template_picture_url = isset( $template['picture_url'] ) ? (string) $template['picture_url'] : '';
						$template_category    = isset( $template['category'] ) ? sanitize_key( (string) $template['category'] ) : 'other';
						$is_recommended       = ! empty( $template['is_recommended'] );
						$is_selected          = $selected_slug === $template_slug;
						?>
						<article
							class="wpbc_setup_wizard__template-card<?php echo $is_selected ? ' is-selected' : ''; ?>"
							data-wpbc-template-card
							data-template-slug="<?php echo esc_attr( $template_slug ); ?>"
							data-template-category="<?php echo esc_attr( $template_category ); ?>"
							data-template-recommended="<?php echo $is_recommended ? 'true' : 'false'; ?>"
							data-template-picture-url="<?php echo esc_url( $template_picture_url ); ?>"
						>
							<label>
								<span class="wpbc_setup_wizard__template-card-preview" data-wpbc-template-card-preview>
									<?php if ( '' !== $template_picture_url ) : ?>
										<img src="<?php echo esc_url( $template_picture_url ); ?>" alt="" loading="lazy" data-wpbc-template-card-image>
									<?php endif; ?>
									<span class="wpbc_setup_wizard__template-image-placeholder"<?php if ( '' !== $template_picture_url ) : ?> hidden<?php endif; ?> data-wpbc-template-image-placeholder>
										<i class="menu_icon icon-2x wpbc-bi-image-fill" aria-hidden="true"></i>
										<span><?php esc_html_e( 'Preview unavailable', 'booking' ); ?></span>
									</span>
								</span>
								<span class="wpbc_setup_wizard__template-card-heading">
									<input
										type="radio"
										name="booking_form_template"
										value="<?php echo esc_attr( $template_slug ); ?>"
										required
										data-wpbc-setup-wizard-field
										data-wpbc-template-radio
										<?php checked( $is_selected ); ?>
									>
									<span class="wpbc_setup_wizard__radio-mark" aria-hidden="true"></span>
									<strong data-wpbc-template-title><?php echo esc_html( $template_title ); ?></strong>
								</span>
								<span class="screen-reader-text" data-wpbc-template-description><?php echo esc_html( $template_description ); ?></span>
							</label>
						</article>
					<?php endforeach; ?>
				</div>
				<p class="wpbc_setup_wizard__template-empty" data-wpbc-template-empty hidden><?php esc_html_e( 'No templates match this search and filter.', 'booking' ); ?></p>
				<?php if ( empty( $templates ) ) : ?>
					<p class="wpbc_setup_wizard__template-catalog-unavailable wpbc_setup_wizard__message wpbc_setup_wizard__message--warning"><?php esc_html_e( 'Booking form templates are temporarily unavailable. You can go back without changing any live form.', 'booking' ); ?></p>
				<?php endif; ?>
				<span class="wpbc_setup_wizard__field-error wpbc_setup_wizard__field-error--group" id="wpbc-setup-wizard-booking-form-template-error" data-wpbc-setup-wizard-error-for="booking_form_template"></span>
			</section>

			<section class="wpbc_setup_wizard__booking-form-usage-panel" aria-labelledby="wpbc-setup-wizard-booking-form-usage-title">
				<fieldset class="wpbc_setup_wizard__booking-form-usage" data-wpbc-booking-form-usage>
					<legend id="wpbc-setup-wizard-booking-form-usage-title"><?php esc_html_e( 'Use template with', 'booking' ); ?></legend>
					<div class="wpbc_setup_wizard__booking-form-usage-options">
						<?php foreach ( $usage_options as $usage_option ) : ?>
							<?php
							$usage_id          = isset( $usage_option['id'] ) ? sanitize_key( (string) $usage_option['id'] ) : '';
							$usage_label       = isset( $usage_option['label'] ) ? (string) $usage_option['label'] : '';
							$usage_description = isset( $usage_option['description'] ) ? (string) $usage_option['description'] : '';
							?>
							<label class="wpbc_setup_wizard__booking-form-usage-option<?php echo $selected_usage === $usage_id ? ' is-selected' : ''; ?>">
								<input
									type="radio"
									name="booking_form_usage"
									value="<?php echo esc_attr( $usage_id ); ?>"
									required
									data-wpbc-setup-wizard-field
									data-wpbc-booking-form-usage-radio
									<?php checked( $selected_usage, $usage_id ); ?>
								>
								<span>
									<strong><?php echo esc_html( $usage_label ); ?></strong>
									<small><?php echo esc_html( $usage_description ); ?></small>
								</span>
							</label>
						<?php endforeach; ?>
					</div>
					<span class="wpbc_setup_wizard__field-error wpbc_setup_wizard__field-error--group" data-wpbc-setup-wizard-error-for="booking_form_usage"></span>
				</fieldset>
			</section>

			<section class="wpbc_setup_wizard__template-preview-panel" aria-labelledby="wpbc-setup-wizard-template-preview-title">
				<header class="wpbc_setup_wizard__template-preview-toolbar">
					<div class="wpbc_setup_wizard__template-preview-heading">
						<h2 id="wpbc-setup-wizard-template-preview-title"><?php esc_html_e( 'Live preview', 'booking' ); ?></h2>
						<span><i aria-hidden="true"></i><?php esc_html_e( 'Real booking form preview', 'booking' ); ?></span>
					</div>
					<div class="wpbc_setup_wizard__template-preview-actions">
						<button type="button" class="button button-secondary" data-wpbc-template-refresh>
							<i class="menu_icon icon-1x wpbc_icn_refresh" aria-hidden="true"></i>
							<span><?php esc_html_e( 'Refresh', 'booking' ); ?></span>
						</button>
						<button
							type="button"
							class="button button-secondary"
							data-wpbc-template-open-preview
						>
							<i class="menu_icon icon-1x wpbc_icn_open_in_new" aria-hidden="true"></i>
							<span><?php esc_html_e( 'Open in new window', 'booking' ); ?></span>
						</button>
					</div>
				</header>

				<div
					class="wpbc_setup_wizard__template-preview-stage"
					data-wpbc-template-preview-stage
					data-initial-preview-kind="<?php echo esc_attr( $has_inline_preview ? 'inline' : '' ); ?>"
					data-initial-preview-template-slug="<?php echo esc_attr( $has_inline_preview ? $selected_slug : '' ); ?>"
					data-initial-preview-booking-form-usage="<?php echo esc_attr( $has_inline_preview ? $selected_usage : '' ); ?>"
				>
					<div class="wpbc_setup_wizard__template-preview-loader" role="status" aria-live="polite" <?php echo $has_inline_preview || '' !== $preview_error ? 'hidden' : ''; ?> data-wpbc-template-preview-loader>
						<span class="spinner is-active" aria-hidden="true"></span>
						<span><?php esc_html_e( 'Loading the interactive booking form preview.', 'booking' ); ?></span>
					</div>
					<div class="wpbc_setup_wizard__template-inline-preview" <?php echo $has_inline_preview ? '' : 'hidden'; ?> data-wpbc-template-inline-preview data-wpbc-inline-booking-preview="1">
						<div class="wpbc_theme_preview wpbc_theme_preview_mode_form" data-wpbc-theme-preview="1">
							<div class="wpbc_theme_real_preview" data-wpbc-template-inline-preview-content>
								<?php echo $preview_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- generated by the shared Form Builder renderer after server registry resolution and preview sanitization. ?>
							</div>
						</div>
					</div>
					<?php if ( $has_inline_preview ) : ?>
						<script type="application/json" data-wpbc-template-initial-preview-bootstrap><?php echo wp_json_encode( $preview_bootstrap, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- JSON is hex encoded and parsed only as data by the allow-listed preview renderer. ?></script>
					<?php endif; ?>
					<iframe
						title="<?php esc_attr_e( 'Interactive booking form template preview', 'booking' ); ?>"
						src="about:blank"
						hidden
						data-wpbc-template-preview-frame
					></iframe>
					<div class="wpbc_setup_wizard__template-preview-error" role="alert" <?php echo '' === $preview_error ? 'hidden' : ''; ?> data-wpbc-template-preview-error>
						<i class="menu_icon icon-1x wpbc_icn_error_outline" aria-hidden="true"></i>
						<span><?php echo '' !== $preview_error ? esc_html( $preview_error ) : esc_html__( 'The interactive preview could not be loaded. Try refreshing it.', 'booking' ); ?></span>
					</div>
				</div>

				<footer class="wpbc_setup_wizard__template-preview-details">
					<div>
						<strong data-wpbc-template-preview-title><?php echo esc_html( $preview_title ); ?></strong>
						<code data-wpbc-template-preview-slug><?php echo esc_html( $selected_slug ); ?></code>
						<span class="wpbc_setup_wizard__template-preview-shortcode">
							<span><?php esc_html_e( 'Shortcode:', 'booking' ); ?></span>
							<code data-wpbc-template-preview-shortcode><?php echo esc_html( $preview_shortcode ); ?></code>
						</span>
					</div>
					<p data-wpbc-template-preview-description><?php echo isset( $selected_template['description'] ) ? esc_html( (string) $selected_template['description'] ) : ''; ?></p>
				</footer>
				<p class="wpbc_setup_wizard__template-preview-note wpbc_setup_wizard__message wpbc_setup_wizard__message--info">
					<i class="menu_icon icon-1x wpbc_icn_info_outline" aria-hidden="true"></i>
					<span><?php esc_html_e( 'The embedded preview uses the real booking form and Booking Calendar styles. In this request-local preview, calculated date, time, capacity, and cost summaries are marked Preview only and final booking submission is disabled. Open it in a new window to use the complete preview behavior and check the active site theme. Selecting or trying a template does not replace a saved form. Update booking form & continue applies the selected template to the Standard Booking Form used on the front end.', 'booking' ); ?></span>
				</p>
			</section>
		</div>
	</form>
</section>
