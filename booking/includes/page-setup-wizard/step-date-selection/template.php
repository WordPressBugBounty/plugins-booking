<?php
/**
 * Setup Wizard Date Selection editor.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized step context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$step_data             = isset( $template_context['step_data'] ) && is_array( $template_context['step_data'] ) ? $template_context['step_data'] : array();
$values                = isset( $step_data['values'] ) && is_array( $step_data['values'] ) ? $step_data['values'] : array();
$weekdays              = isset( $step_data['weekdays'] ) && is_array( $step_data['weekdays'] ) ? $step_data['weekdays'] : array();
$specific_day_presets  = isset( $step_data['specific_day_presets'] ) && is_array( $step_data['specific_day_presets'] ) ? $step_data['specific_day_presets'] : array();
$legend_items          = isset( $step_data['legend_items'] ) && is_array( $step_data['legend_items'] ) ? $step_data['legend_items'] : array();
$legend_preview_items  = isset( $step_data['legend_preview_items'] ) && is_array( $step_data['legend_preview_items'] ) ? $step_data['legend_preview_items'] : array();
$time_options          = isset( $step_data['time_options'] ) && is_array( $step_data['time_options'] ) ? $step_data['time_options'] : array();
$supports_advanced     = ! empty( $step_data['supports_advanced_range_rules'] );
$preview_html          = isset( $step_data['preview_html'] ) && is_string( $step_data['preview_html'] ) ? $step_data['preview_html'] : '';
$preview_error         = isset( $step_data['preview_error'] ) && is_string( $step_data['preview_error'] ) ? $step_data['preview_error'] : '';
$resource_id           = isset( $step_data['preview_resource_id'] ) ? absint( $step_data['preview_resource_id'] ) : 1;
$customer_journey_policy = isset( $step_data['customer_journey_policy'] ) && is_array( $step_data['customer_journey_policy'] ) ? $step_data['customer_journey_policy'] : array();
$journey_mode_policies = isset( $customer_journey_policy['mode_policy'] ) && is_array( $customer_journey_policy['mode_policy'] ) ? $customer_journey_policy['mode_policy'] : array();
$selected_mode         = isset( $values['date_selection_mode'] ) ? (string) $values['date_selection_mode'] : 'single';
$selected_mode_policy  = isset( $journey_mode_policies[ $selected_mode ] ) && is_array( $journey_mode_policies[ $selected_mode ] ) ? $journey_mode_policies[ $selected_mode ] : array();
$changeover_policy     = isset( $selected_mode_policy['changeover'] ) ? (string) $selected_mode_policy['changeover'] : 'hidden_off';
$recurrent_policy      = isset( $selected_mode_policy['recurrent_time'] ) ? (string) $selected_mode_policy['recurrent_time'] : 'hidden_off';
$checkout_policy       = isset( $selected_mode_policy['checkout_available'] ) ? (string) $selected_mode_policy['checkout_available'] : 'hidden_off';
$calendar_preview_year = absint( current_time( 'Y' ) );
$dynamic_weekdays      = isset( $values['date_selection_dynamic_weekdays'] ) ? explode( ',', (string) $values['date_selection_dynamic_weekdays'] ) : array( '-1' );
$fixed_weekdays        = isset( $values['date_selection_fixed_weekdays'] ) ? explode( ',', (string) $values['date_selection_fixed_weekdays'] ) : array( '-1' );
$changeover_is_enabled = $supports_advanced && isset( $values['date_selection_changeover_enabled'] ) && 'On' === $values['date_selection_changeover_enabled'];
$changeover_is_visible = in_array( $changeover_policy, array( 'optional', 'required_on' ), true );
$recurrent_is_visible  = in_array( $recurrent_policy, array( 'optional', 'optional_default_on', 'required_on' ), true );
$checkout_is_supported = 'optional' === $checkout_policy;
$behavior_is_visible   = $recurrent_is_visible || $checkout_is_supported;
$locked_mode_count     = 0;
$legend_is_enabled     = isset( $values['date_selection_legend_enabled'] ) && 'On' === $values['date_selection_legend_enabled'];
$legend_is_vertical    = isset( $values['date_selection_legend_vertical'] ) && 'On' === $values['date_selection_legend_vertical'];
$advanced_toggle_disabled_reason = __( 'This option requires Booking Calendar Business Small or higher.', 'booking' );
$checkout_changeover_disabled_reason = __( 'Turn off Changeover days to use this option. Changeover processing already controls the check-out boundary.', 'booking' );
$checkout_mode_disabled_reason = __( 'This option is available only for Flexible or Fixed range selection.', 'booking' );
$changeover_journey_disabled_reason = __( 'Changeover days are required by the selected Customer Journey.', 'booking' );
$recurrent_journey_disabled_reason = __( 'The selected Customer Journey requires the same selected times on every booking date.', 'booking' );
$checkout_disabled_reason = '';

if ( ! $supports_advanced ) {
	$checkout_disabled_reason = $advanced_toggle_disabled_reason;
} elseif ( ! $checkout_is_supported ) {
	$checkout_disabled_reason = $checkout_mode_disabled_reason;
} elseif ( $changeover_is_enabled ) {
	$checkout_disabled_reason = $checkout_changeover_disabled_reason;
}

if ( in_array( '-1', $dynamic_weekdays, true ) ) {
	$dynamic_weekdays = array_column( $weekdays, 'value' );
}
if ( in_array( '-1', $fixed_weekdays, true ) ) {
	$fixed_weekdays = array_column( $weekdays, 'value' );
}
foreach ( $journey_mode_policies as $journey_mode_policy ) {
	if ( isset( $journey_mode_policy['status'] ) && 'locked' === $journey_mode_policy['status'] ) {
		$locked_mode_count++;
	}
}

$selection_modes = array(
	'single'   => array(
		'label'                => __( 'Single day', 'booking' ),
		'description'          => __( 'Customers choose one date.', 'booking' ),
		'calendar_preview_type' => 'calendar',
	),
	'multiple' => array(
		'label'                => __( 'Multiple days', 'booking' ),
		'description'          => __( 'Customers choose independent dates.', 'booking' ),
		'calendar_preview_type' => 'calendar-multiple',
	),
	'dynamic'  => array(
		'label'                => __( 'Flexible range', 'booking' ),
		'description'          => __( 'Customers choose the first and last date.', 'booking' ),
		'calendar_preview_type' => 'range-flexible-end',
	),
	'fixed'    => array(
		'label'                => __( 'Fixed range', 'booking' ),
		'description'          => __( 'One click selects a set number of days.', 'booking' ),
		'calendar_preview_type' => 'range-fixed-selected',
	),
);
?>
<section class="wpbc_setup_wizard__step-content wpbc_setup_wizard__date-selection-step" aria-labelledby="wpbc-setup-wizard-step-title" data-wpbc-date-selection-editor data-resource-id="<?php echo esc_attr( (string) $resource_id ); ?>">
	<header class="wpbc_setup_wizard__step-heading">
		<h1 id="wpbc-setup-wizard-step-title"><?php esc_html_e( 'Choose how dates are selected', 'booking' ); ?></h1>
		<p class="wpbc_setup_wizard__lead"><?php esc_html_e( 'Select one behavior and check the customer preview.', 'booking' ); ?></p>
	</header>
	<?php
	$template_context['templates']->render(
		'settings-hint',
		array( 'settings_hint' => $template_context['settings_hint'] )
	);
	?>

	<form id="wpbc-setup-wizard-step-form" class="wpbc_setup_wizard__date-selection-form" novalidate>
		<fieldset class="wpbc_setup_wizard__date-selection-modes" data-wpbc-date-selection-modes>
			<div class="wpbc_setup_wizard__date-selection-modes-heading">
				<strong><?php esc_html_e( 'Selection mode', 'booking' ); ?></strong>
				<span class="wpbc_setup_wizard__date-selection-compatibility-note">
					<i class="menu_icon icon-1x wpbc_icn_info_outline" aria-hidden="true"></i>
					<?php esc_html_e( 'Only compatible date behaviors can be selected.', 'booking' ); ?>
				</span>
				<?php if ( ! empty( $customer_journey_policy['label'] ) ) : ?>
					<span class="wpbc_setup_wizard__date-selection-journey-badge">
						<?php
						echo esc_html(
							sprintf(
								/* translators: %s: Selected Customer Journey name. */
								__( 'Journey: %s', 'booking' ),
								(string) $customer_journey_policy['label']
							)
						);
						?>
					</span>
				<?php endif; ?>
			</div>
			<div class="wpbc_setup_wizard__date-selection-mode-grid">
				<?php foreach ( $selection_modes as $mode_id => $mode ) : ?>
					<?php
					$mode_policy       = isset( $journey_mode_policies[ $mode_id ] ) && is_array( $journey_mode_policies[ $mode_id ] ) ? $journey_mode_policies[ $mode_id ] : array();
					$mode_status       = isset( $mode_policy['status'] ) ? (string) $mode_policy['status'] : 'locked';
					$is_policy_locked  = 'locked' === $mode_status;
					$is_edition_locked = 'fixed' === $mode_id && ! $supports_advanced;
					$is_locked         = $is_policy_locked || $is_edition_locked;
					$disabled_reason   = $is_edition_locked ? $advanced_toggle_disabled_reason : ( isset( $mode_policy['disabled_reason'] ) ? (string) $mode_policy['disabled_reason'] : '' );
					$badge_label       = isset( $mode_policy['badge_label'] ) ? (string) $mode_policy['badge_label'] : '';
					?>
					<div class="wpbc_setup_wizard__date-selection-mode-option">
						<?php if ( '' !== $badge_label || $is_edition_locked ) : ?>
							<span class="wpbc_setup_wizard__date-selection-mode-badges">
								<?php if ( '' !== $badge_label ) : ?>
									<span class="wpbc_setup_wizard__date-selection-mode-badge is-<?php echo esc_attr( $mode_status ); ?>"><?php echo esc_html( $badge_label ); ?></span>
								<?php endif; ?>
								<?php if ( $is_edition_locked ) : ?>
									<span class="wpbc_setup_wizard__edition-badge"><?php esc_html_e( 'PRO / BS+', 'booking' ); ?></span>
								<?php endif; ?>
							</span>
						<?php endif; ?>
						<label
							class="wpbc_setup_wizard__date-selection-mode-card is-<?php echo esc_attr( $mode_status ); ?><?php echo $selected_mode === $mode_id ? ' is-selected' : ''; ?><?php echo $is_locked ? ' is-locked' : ''; ?>"
							<?php if ( $is_locked ) : ?>
								aria-disabled="true"
								title="<?php echo esc_attr( $disabled_reason ); ?>"
							<?php endif; ?>
						>
							<input
								type="radio"
								name="date_selection_mode"
								value="<?php echo esc_attr( $mode_id ); ?>"
								data-wpbc-setup-wizard-field
								data-wpbc-date-selection-mode
								data-wpbc-date-selection-mode-status="<?php echo esc_attr( $mode_status ); ?>"
								data-wpbc-date-selection-policy-changeover="<?php echo esc_attr( isset( $mode_policy['changeover'] ) ? (string) $mode_policy['changeover'] : 'hidden_off' ); ?>"
								data-wpbc-date-selection-policy-recurrent-time="<?php echo esc_attr( isset( $mode_policy['recurrent_time'] ) ? (string) $mode_policy['recurrent_time'] : 'hidden_off' ); ?>"
								data-wpbc-date-selection-policy-checkout-available="<?php echo esc_attr( isset( $mode_policy['checkout_available'] ) ? (string) $mode_policy['checkout_available'] : 'hidden_off' ); ?>"
								required
								<?php checked( $selected_mode, $mode_id ); ?>
								<?php disabled( $is_locked ); ?>
							>
							<span class="wpbc_setup_wizard__date-selection-mode-icon wpbc_setup_wizard__journey-step--<?php echo esc_attr( $mode['calendar_preview_type'] ); ?>" aria-hidden="true">
								<span class="wpbc_setup_wizard__date-selection-mode-header">
									<strong class="wpbc_setup_wizard__date-selection-mode-year"><?php echo esc_html( (string) $calendar_preview_year ); ?></strong>
									<span class="wpbc_setup_wizard__date-selection-mode-navigation">
										<i class="menu_icon icon-1x wpbc_icn_keyboard_arrow_left" aria-hidden="true"></i>
										<i class="menu_icon icon-1x wpbc_icn_keyboard_arrow_right" aria-hidden="true"></i>
									</span>
								</span>
								<span class="wpbc_setup_wizard__preview-calendar">
									<?php for ( $calendar_index = 0; $calendar_index < 28; $calendar_index++ ) : ?>
										<span></span>
									<?php endfor; ?>
								</span>
							</span>
							<span class="wpbc_setup_wizard__date-selection-mode-copy">
								<strong>
									<?php echo esc_html( $mode['label'] ); ?>
									<?php if ( $is_policy_locked ) : ?>
										<i class="menu_icon icon-1x wpbc_icn_lock_outline" aria-hidden="true"></i>
									<?php endif; ?>
								</strong>
								<small><?php echo esc_html( $mode['description'] ); ?></small>
							</span>
						</label>
					</div>
				<?php endforeach; ?>
			</div>
			<?php if ( 0 < $locked_mode_count ) : ?>
				<button type="button" class="button-link wpbc_setup_wizard__date-selection-review-journeys" data-wpbc-setup-wizard-direction="back"><?php esc_html_e( 'Review Customer Journey options', 'booking' ); ?></button>
			<?php endif; ?>
			<span class="wpbc_setup_wizard__field-error wpbc_setup_wizard__field-error--group" data-wpbc-setup-wizard-error-for="date_selection_mode"></span>
		</fieldset>

		<div class="wpbc_setup_wizard__date-selection-workspace">
			<section class="wpbc_setup_wizard__date-selection-preview" aria-labelledby="wpbc-date-selection-preview-title">
				<h2 id="wpbc-date-selection-preview-title"><?php esc_html_e( 'Customer preview', 'booking' ); ?></h2>
				<p class="wpbc_setup_wizard__date-selection-preview-help"><?php esc_html_e( 'Try selecting dates. This uses the real Booking Calendar selection behavior and your current availability.', 'booking' ); ?></p>
				<div class="wpbc_setup_wizard__date-selection-calendar" data-wpbc-date-selection-calendar>
					<?php if ( '' !== $preview_html ) : ?>
						<?php echo $preview_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Generated by the canonical Booking Calendar renderer. ?>
					<?php else : ?>
						<div class="notice notice-warning inline wpbc_setup_wizard__message wpbc_setup_wizard__message--warning"><p><?php echo esc_html( $preview_error ); ?></p></div>
					<?php endif; ?>
				</div>
				<div class="wpbc_setup_wizard__date-selection-legend-preview<?php echo $legend_is_vertical ? ' is-vertical' : ''; ?>" data-wpbc-date-selection-legend-preview data-wpbc-date-selection-legend-day-number="<?php echo esc_attr( wp_date( 'd' ) ); ?>"<?php if ( ! $legend_is_enabled ) : ?> hidden<?php endif; ?>>
					<?php foreach ( $legend_items as $legend_item ) : ?>
						<?php
						$legend_id       = (string) $legend_item['id'];
						$legend_item_key = 'date_selection_legend_item_' . $legend_id;
						?>
						<div data-wpbc-date-selection-legend-preview-item="<?php echo esc_attr( $legend_id ); ?>"<?php if ( ! isset( $values[ $legend_item_key ] ) || 'On' !== $values[ $legend_item_key ] ) : ?> hidden<?php endif; ?>>
							<?php if ( ! empty( $legend_preview_items[ $legend_id ] ) ) : ?>
								<?php echo $legend_preview_items[ $legend_id ]; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Generated by the canonical Booking Calendar legend renderer. ?>
							<?php endif; ?>
						</div>
					<?php endforeach; ?>
				</div>
			</section>

			<div class="wpbc_setup_wizard__date-selection-sidebar">
				<aside class="wpbc_setup_wizard__date-selection-settings" aria-labelledby="wpbc-date-selection-settings-title">
				<div class="wpbc_setup_wizard__date-selection-settings-heading">
					<h2 id="wpbc-date-selection-settings-title" data-wpbc-date-selection-settings-title><?php esc_html_e( 'Date selection settings', 'booking' ); ?></h2>
					<?php if ( ! $supports_advanced ) : ?>
						<span class="wpbc_setup_wizard__edition-badge"><?php esc_html_e( 'PRO / BS+', 'booking' ); ?></span>
					<?php endif; ?>
				</div>

				<div class="wpbc_setup_wizard__date-selection-settings-panel" data-wpbc-date-selection-panel="single">
					<p><?php esc_html_e( 'Each click replaces the previous date selection with one date.', 'booking' ); ?></p>
				</div>

				<div class="wpbc_setup_wizard__date-selection-settings-panel" data-wpbc-date-selection-panel="multiple">
					<p><?php esc_html_e( 'Each click adds or removes an independent date from the selection.', 'booking' ); ?></p>
				</div>

				<div class="wpbc_setup_wizard__date-selection-settings-panel" data-wpbc-date-selection-panel="fixed">
					<div class="wpbc_setup_wizard__date-selection-number-field">
						<div class="wpbc_setup_wizard__date-selection-number-heading">
							<label for="wpbc-date-selection-fixed-days"><?php esc_html_e( 'Number of days', 'booking' ); ?></label>
							<input id="wpbc-date-selection-fixed-days" type="number" name="date_selection_fixed_days" min="1" max="365" step="1" value="<?php echo esc_attr( $values['date_selection_fixed_days'] ); ?>" data-wpbc-setup-wizard-field data-wpbc-date-selection-number="date_selection_fixed_days" required>
						</div>
						<input class="wpbc_setup_wizard__date-selection-range" type="range" min="1" max="180" step="1" value="<?php echo esc_attr( $values['date_selection_fixed_days'] ); ?>" data-wpbc-date-selection-range="date_selection_fixed_days" aria-label="<?php esc_attr_e( 'Number of days selected with one click', 'booking' ); ?>">
						<p class="wpbc_setup_wizard__date-selection-number-help"><?php esc_html_e( 'One click selects this many consecutive days.', 'booking' ); ?></p>
					</div>
					<span class="wpbc_setup_wizard__field-error" data-wpbc-setup-wizard-error-for="date_selection_fixed_days"></span>
					<?php
					// The visible weekday buttons are synchronized into this allow-listed scalar transport field.
					?>
					<input type="hidden" name="date_selection_fixed_weekdays" value="<?php echo esc_attr( $values['date_selection_fixed_weekdays'] ); ?>" data-wpbc-setup-wizard-field data-wpbc-date-selection-weekday-transport="fixed" required>
					<div class="wpbc_setup_wizard__date-selection-weekdays" data-wpbc-date-selection-weekdays="fixed" role="group" aria-label="<?php esc_attr_e( 'Allowed fixed range start days', 'booking' ); ?>">
						<span><?php esc_html_e( 'A booking can start on', 'booking' ); ?></span>
						<div>
							<?php foreach ( $weekdays as $weekday ) : ?>
								<button type="button" class="button<?php echo in_array( (string) $weekday['value'], $fixed_weekdays, true ) ? ' is-selected' : ''; ?>" data-weekday="<?php echo esc_attr( (string) $weekday['value'] ); ?>" aria-pressed="<?php echo in_array( (string) $weekday['value'], $fixed_weekdays, true ) ? 'true' : 'false'; ?>" title="<?php echo esc_attr( (string) $weekday['label'] ); ?>"><?php echo esc_html( (string) $weekday['short_label'] ); ?></button>
							<?php endforeach; ?>
						</div>
					</div>
					<span class="wpbc_setup_wizard__field-error" data-wpbc-setup-wizard-error-for="date_selection_fixed_weekdays"></span>
				</div>

				<div class="wpbc_setup_wizard__date-selection-settings-panel" data-wpbc-date-selection-panel="dynamic">
					<p class="wpbc_setup_wizard__date-selection-number-intro"><?php esc_html_e( 'Set the shortest and longest flexible range customers can select.', 'booking' ); ?></p>
					<div class="wpbc_setup_wizard__date-selection-number-grid">
						<div class="wpbc_setup_wizard__date-selection-number-field">
							<div class="wpbc_setup_wizard__date-selection-number-heading">
								<label for="wpbc-date-selection-dynamic-min"><?php esc_html_e( 'Minimum days', 'booking' ); ?></label>
								<input id="wpbc-date-selection-dynamic-min" type="number" name="date_selection_dynamic_min" min="1" max="365" step="1" value="<?php echo esc_attr( $values['date_selection_dynamic_min'] ); ?>" data-wpbc-setup-wizard-field data-wpbc-date-selection-number="date_selection_dynamic_min" required <?php disabled( ! $supports_advanced ); ?>>
							</div>
							<input class="wpbc_setup_wizard__date-selection-range" type="range" min="1" max="180" step="1" value="<?php echo esc_attr( $values['date_selection_dynamic_min'] ); ?>" data-wpbc-date-selection-range="date_selection_dynamic_min" aria-label="<?php esc_attr_e( 'Minimum flexible range length', 'booking' ); ?>" <?php disabled( ! $supports_advanced ); ?>>
						</div>
						<div class="wpbc_setup_wizard__date-selection-number-field">
							<div class="wpbc_setup_wizard__date-selection-number-heading">
								<label for="wpbc-date-selection-dynamic-max"><?php esc_html_e( 'Maximum days', 'booking' ); ?></label>
								<input id="wpbc-date-selection-dynamic-max" type="number" name="date_selection_dynamic_max" min="1" max="365" step="1" value="<?php echo esc_attr( $values['date_selection_dynamic_max'] ); ?>" data-wpbc-setup-wizard-field data-wpbc-date-selection-number="date_selection_dynamic_max" required <?php disabled( ! $supports_advanced ); ?>>
							</div>
							<input class="wpbc_setup_wizard__date-selection-range" type="range" min="1" max="180" step="1" value="<?php echo esc_attr( $values['date_selection_dynamic_max'] ); ?>" data-wpbc-date-selection-range="date_selection_dynamic_max" aria-label="<?php esc_attr_e( 'Maximum flexible range length', 'booking' ); ?>" <?php disabled( ! $supports_advanced ); ?>>
						</div>
					</div>
					<span class="wpbc_setup_wizard__field-error" data-wpbc-setup-wizard-error-for="date_selection_dynamic_min"></span>
					<span class="wpbc_setup_wizard__field-error" data-wpbc-setup-wizard-error-for="date_selection_dynamic_max"></span>
					<input type="hidden" name="date_selection_dynamic_weekdays" value="<?php echo esc_attr( $values['date_selection_dynamic_weekdays'] ); ?>" data-wpbc-setup-wizard-field data-wpbc-date-selection-weekday-transport="dynamic" required>
					<div class="wpbc_setup_wizard__date-selection-weekdays" data-wpbc-date-selection-weekdays="dynamic" role="group" aria-label="<?php esc_attr_e( 'Allowed flexible range start days', 'booking' ); ?>">
						<span><?php esc_html_e( 'A booking can start on', 'booking' ); ?></span>
						<div>
							<?php foreach ( $weekdays as $weekday ) : ?>
								<button type="button" class="button<?php echo in_array( (string) $weekday['value'], $dynamic_weekdays, true ) ? ' is-selected' : ''; ?>" data-weekday="<?php echo esc_attr( (string) $weekday['value'] ); ?>" aria-pressed="<?php echo in_array( (string) $weekday['value'], $dynamic_weekdays, true ) ? 'true' : 'false'; ?>" title="<?php echo esc_attr( (string) $weekday['label'] ); ?>" <?php disabled( ! $supports_advanced ); ?>><?php echo esc_html( (string) $weekday['short_label'] ); ?></button>
							<?php endforeach; ?>
						</div>
					</div>
					<div class="wpbc_setup_wizard__date-selection-specific">
						<label for="wpbc-date-selection-dynamic-specific"><?php esc_html_e( 'Specific number of days to select', 'booking' ); ?></label>
						<input
							id="wpbc-date-selection-dynamic-specific"
							type="text"
							name="date_selection_dynamic_specific"
							value="<?php echo esc_attr( $values['date_selection_dynamic_specific'] ); ?>"
							placeholder="<?php esc_attr_e( 'Example: 7,14,21,28', 'booking' ); ?>"
							maxlength="500"
							data-wpbc-setup-wizard-field
							data-wpbc-date-selection-specific
							<?php disabled( ! $supports_advanced ); ?>
						>
						<div class="wpbc_setup_wizard__date-selection-specific-presets" aria-label="<?php esc_attr_e( 'Specific day presets', 'booking' ); ?>">
							<?php foreach ( $specific_day_presets as $specific_day_preset ) : ?>
								<button
									type="button"
									class="button-link"
									data-wpbc-date-selection-specific-preset="<?php echo esc_attr( (string) $specific_day_preset['value'] ); ?>"
									<?php if ( null !== $specific_day_preset['minimum_days'] ) : ?>
										data-wpbc-date-selection-preset-minimum="<?php echo esc_attr( (string) $specific_day_preset['minimum_days'] ); ?>"
									<?php endif; ?>
									<?php if ( null !== $specific_day_preset['maximum_days'] ) : ?>
										data-wpbc-date-selection-preset-maximum="<?php echo esc_attr( (string) $specific_day_preset['maximum_days'] ); ?>"
									<?php endif; ?>
									<?php if ( null !== $specific_day_preset['start_weekdays'] ) : ?>
										data-wpbc-date-selection-preset-weekdays="<?php echo esc_attr( (string) $specific_day_preset['start_weekdays'] ); ?>"
									<?php endif; ?>
									<?php disabled( ! $supports_advanced ); ?>
								><?php echo esc_html( (string) $specific_day_preset['label'] ); ?></button>
							<?php endforeach; ?>
						</div>
						<span class="wpbc_setup_wizard__field-help"><?php esc_html_e( 'Allow only these stay lengths within the minimum and maximum range. Comma-separated numbers and ranges such as 3-5 are supported.', 'booking' ); ?></span>
						<span class="wpbc_setup_wizard__field-help"><?php esc_html_e( 'Presets also set matching minimum, maximum, and start weekdays. Clear keeps those controls unchanged.', 'booking' ); ?></span>
						<span class="wpbc_setup_wizard__field-error" data-wpbc-setup-wizard-error-for="date_selection_dynamic_specific"></span>
					</div>
					<?php if ( ! $supports_advanced ) : ?>
						<p class="wpbc_setup_wizard__date-selection-locked-note wpbc_setup_wizard__message wpbc_setup_wizard__message--warning"><?php esc_html_e( 'This edition uses the unrestricted two-click flexible range. Custom range limits, specific stay lengths, and start weekdays require Business Small or higher.', 'booking' ); ?></p>
					<?php endif; ?>
					<span class="wpbc_setup_wizard__field-error" data-wpbc-setup-wizard-error-for="date_selection_dynamic_weekdays"></span>
				</div>

				</aside>

				<section class="wpbc_setup_wizard__date-selection-changeover<?php echo $supports_advanced ? '' : ' is-locked'; ?>" aria-labelledby="wpbc-date-selection-changeover-title" data-wpbc-date-selection-changeover<?php if ( ! $changeover_is_visible ) : ?> hidden<?php endif; ?>>
					<div class="wpbc_setup_wizard__date-selection-changeover-heading">
						<h2 id="wpbc-date-selection-changeover-title"><?php esc_html_e( 'Changeover days', 'booking' ); ?></h2>
						<?php if ( ! $supports_advanced ) : ?>
							<span class="wpbc_setup_wizard__edition-badge"><?php esc_html_e( 'PRO / BS+', 'booking' ); ?></span>
						<?php endif; ?>
						<span
							class="wpbc_ui__toggle wpbc_setup_wizard__date-selection-changeover-toggle"
							data-wpbc-date-selection-disabled-tooltip="wpbc-date-selection-changeover-disabled-description"
							<?php if ( ! $supports_advanced || 'required_on' === $changeover_policy ) : ?>
								title="<?php echo esc_attr( ! $supports_advanced ? $advanced_toggle_disabled_reason : $changeover_journey_disabled_reason ); ?>"
								tabindex="0"
								aria-describedby="wpbc-date-selection-changeover-disabled-description"
								data-wpbc-date-selection-disabled-tooltip-active="1"
							<?php endif; ?>
						>
							<input
								type="checkbox"
								id="wpbc-date-selection-changeover-enabled"
								class="wpbc_ui_checkbox"
								aria-label="<?php esc_attr_e( 'Use changeover days', 'booking' ); ?>"
								data-wpbc-date-selection-toggle="date_selection_changeover_enabled"
								data-wpbc-date-selection-policy-state="<?php echo esc_attr( $changeover_policy ); ?>"
								data-wpbc-date-selection-edition-locked="<?php echo $supports_advanced ? '0' : '1'; ?>"
								data-wpbc-date-selection-disabled-reason="<?php echo esc_attr( ! $supports_advanced ? $advanced_toggle_disabled_reason : ( 'required_on' === $changeover_policy ? $changeover_journey_disabled_reason : '' ) ); ?>"
								<?php checked( $changeover_is_enabled ); ?>
								<?php disabled( ! $supports_advanced || 'required_on' === $changeover_policy ); ?>
							>
							<label class="wpbc_ui__toggle_icon" for="wpbc-date-selection-changeover-enabled"></label>
						</span>
						<span id="wpbc-date-selection-changeover-disabled-description" class="screen-reader-text" data-wpbc-date-selection-disabled-description><?php echo esc_html( ! $supports_advanced ? $advanced_toggle_disabled_reason : ( 'required_on' === $changeover_policy ? $changeover_journey_disabled_reason : '' ) ); ?></span>
						<input type="hidden" name="date_selection_changeover_enabled" value="<?php echo esc_attr( $values['date_selection_changeover_enabled'] ); ?>" data-wpbc-setup-wizard-field required>
					</div>
					<div class="wpbc_setup_wizard__date-selection-changeover-visual wpbc_setup_wizard__journey-step--range-check-out" aria-hidden="true">
						<span class="wpbc_setup_wizard__preview-calendar">
							<?php for ( $changeover_calendar_index = 0; $changeover_calendar_index < 28; $changeover_calendar_index++ ) : ?>
								<span></span>
							<?php endfor; ?>
						</span>
					</div>
					<p class="wpbc_setup_wizard__date-selection-changeover-help"><?php esc_html_e( 'Use arrival and departure boundaries for stays.', 'booking' ); ?></p>
					<div
						class="wpbc_setup_wizard__date-selection-changeover-controls"
						data-wpbc-date-selection-changeover-controls
						<?php if ( ! $changeover_is_enabled ) : ?> hidden<?php endif; ?>
					>
						<div class="wpbc_setup_wizard__date-selection-changeover-fields" data-wpbc-date-selection-changeover-fields>
							<div class="wpbc_setup_wizard__date-selection-time-fields">
								<label class="wpbc_setup_wizard__date-selection-time-field" for="wpbc-date-selection-check-in">
									<span><?php esc_html_e( 'Guests check in at', 'booking' ); ?></span>
									<select id="wpbc-date-selection-check-in" name="date_selection_check_in_time" data-wpbc-setup-wizard-field required <?php disabled( ! $supports_advanced ); ?>>
										<?php foreach ( $time_options as $time_value => $time_label ) : ?>
											<option value="<?php echo esc_attr( $time_value ); ?>" <?php selected( $values['date_selection_check_in_time'], $time_value ); ?>><?php echo esc_html( $time_label ); ?></option>
										<?php endforeach; ?>
									</select>
								</label>
								<label class="wpbc_setup_wizard__date-selection-time-field" for="wpbc-date-selection-check-out">
									<span><?php esc_html_e( 'Guests check out at', 'booking' ); ?></span>
									<select id="wpbc-date-selection-check-out" name="date_selection_check_out_time" data-wpbc-setup-wizard-field required <?php disabled( ! $supports_advanced ); ?>>
										<?php foreach ( $time_options as $time_value => $time_label ) : ?>
											<option value="<?php echo esc_attr( $time_value ); ?>" <?php selected( $values['date_selection_check_out_time'], $time_value ); ?>><?php echo esc_html( $time_label ); ?></option>
										<?php endforeach; ?>
									</select>
								</label>
							</div>
							<div class="wpbc_setup_wizard__date-selection-changeover-option">
								<label for="wpbc-date-selection-triangles"><?php esc_html_e( 'Show changeover days as triangles', 'booking' ); ?></label>
								<span
									class="wpbc_ui__toggle wpbc_setup_wizard__date-selection-changeover-option-toggle"
									data-wpbc-date-selection-disabled-tooltip="wpbc-date-selection-triangles-disabled-description"
									<?php if ( ! $supports_advanced ) : ?>
										title="<?php echo esc_attr( $advanced_toggle_disabled_reason ); ?>"
										tabindex="0"
										aria-describedby="wpbc-date-selection-triangles-disabled-description"
										data-wpbc-date-selection-disabled-tooltip-active="1"
									<?php endif; ?>
								>
									<input type="checkbox" id="wpbc-date-selection-triangles" class="wpbc_ui_checkbox" data-wpbc-date-selection-toggle="date_selection_triangles" data-wpbc-date-selection-disabled-reason="<?php echo esc_attr( $supports_advanced ? '' : $advanced_toggle_disabled_reason ); ?>" <?php checked( 'On', $values['date_selection_triangles'] ); ?> <?php disabled( ! $supports_advanced ); ?>>
									<label class="wpbc_ui__toggle_icon" for="wpbc-date-selection-triangles"></label>
								</span>
								<span id="wpbc-date-selection-triangles-disabled-description" class="screen-reader-text" data-wpbc-date-selection-disabled-description><?php echo esc_html( $supports_advanced ? '' : $advanced_toggle_disabled_reason ); ?></span>
							</div>
							<input type="hidden" name="date_selection_triangles" value="<?php echo esc_attr( $values['date_selection_triangles'] ); ?>" data-wpbc-setup-wizard-field required>
						</div>
					</div>
				</section>

				<section class="wpbc_setup_wizard__date-selection-behavior" aria-labelledby="wpbc-date-selection-behavior-title" data-wpbc-date-selection-behavior<?php if ( ! $behavior_is_visible ) : ?> hidden<?php endif; ?>>
					<h2 id="wpbc-date-selection-behavior-title"><?php esc_html_e( 'Additional date behavior', 'booking' ); ?></h2>
					<div class="wpbc_setup_wizard__date-selection-option" data-wpbc-date-selection-recurrent-option<?php if ( ! $recurrent_is_visible ) : ?> hidden<?php endif; ?>>
						<span>
							<label for="wpbc-date-selection-recurrent-time"><?php esc_html_e( 'Use selected times for each booking date', 'booking' ); ?></label>
							<small><?php esc_html_e( 'Use selected times as booked time slots on each selected date.', 'booking' ); ?></small>
						</span>
						<span
							class="wpbc_ui__toggle wpbc_setup_wizard__date-selection-option-toggle"
							data-wpbc-date-selection-disabled-tooltip="wpbc-date-selection-recurrent-time-disabled-description"
							<?php if ( 'required_on' === $recurrent_policy ) : ?>
								title="<?php echo esc_attr( $recurrent_journey_disabled_reason ); ?>"
								tabindex="0"
								aria-describedby="wpbc-date-selection-recurrent-time-disabled-description"
								data-wpbc-date-selection-disabled-tooltip-active="1"
							<?php endif; ?>
						>
							<input type="checkbox" id="wpbc-date-selection-recurrent-time" class="wpbc_ui_checkbox" data-wpbc-date-selection-toggle="date_selection_recurrent_time" data-wpbc-date-selection-policy-state="<?php echo esc_attr( $recurrent_policy ); ?>" data-wpbc-date-selection-disabled-reason="<?php echo esc_attr( 'required_on' === $recurrent_policy ? $recurrent_journey_disabled_reason : '' ); ?>" <?php checked( 'On', $values['date_selection_recurrent_time'] ); ?> <?php disabled( 'required_on' === $recurrent_policy ); ?>>
							<label class="wpbc_ui__toggle_icon" for="wpbc-date-selection-recurrent-time"></label>
						</span>
						<span id="wpbc-date-selection-recurrent-time-disabled-description" class="screen-reader-text" data-wpbc-date-selection-disabled-description><?php echo esc_html( 'required_on' === $recurrent_policy ? $recurrent_journey_disabled_reason : '' ); ?></span>
					</div>
					<input type="hidden" name="date_selection_recurrent_time" value="<?php echo esc_attr( $values['date_selection_recurrent_time'] ); ?>" data-wpbc-setup-wizard-field required>

					<div
						class="wpbc_setup_wizard__date-selection-option<?php echo $supports_advanced ? '' : ' is-locked'; ?>"
						data-wpbc-date-selection-checkout-option
						data-wpbc-date-selection-policy-state="<?php echo esc_attr( $checkout_policy ); ?>"
						<?php if ( ! $checkout_is_supported ) : ?>
							hidden
						<?php endif; ?>
					>
						<span>
							<label for="wpbc-date-selection-checkout-available"><?php esc_html_e( 'Set check out date as available', 'booking' ); ?></label>
							<small><?php esc_html_e( 'Remove the last selected day from saving to the booking.', 'booking' ); ?></small>
						</span>
						<?php if ( ! $supports_advanced ) : ?>
							<span class="wpbc_setup_wizard__edition-badge"><?php esc_html_e( 'PRO / BS+', 'booking' ); ?></span>
						<?php endif; ?>
						<span
							class="wpbc_ui__toggle wpbc_setup_wizard__date-selection-option-toggle"
							data-wpbc-date-selection-disabled-tooltip="wpbc-date-selection-checkout-disabled-description"
							data-wpbc-date-selection-checkout-reason-edition="<?php echo esc_attr( $advanced_toggle_disabled_reason ); ?>"
							data-wpbc-date-selection-checkout-reason-changeover="<?php echo esc_attr( $checkout_changeover_disabled_reason ); ?>"
							data-wpbc-date-selection-checkout-reason-mode="<?php echo esc_attr( $checkout_mode_disabled_reason ); ?>"
							<?php if ( '' !== $checkout_disabled_reason ) : ?>
								title="<?php echo esc_attr( $checkout_disabled_reason ); ?>"
								tabindex="0"
								aria-describedby="wpbc-date-selection-checkout-disabled-description"
								data-wpbc-date-selection-disabled-tooltip-active="1"
							<?php endif; ?>
						>
							<input
								type="checkbox"
								id="wpbc-date-selection-checkout-available"
								class="wpbc_ui_checkbox"
								data-wpbc-date-selection-toggle="date_selection_checkout_available"
								data-wpbc-date-selection-edition-locked="<?php echo $supports_advanced ? '0' : '1'; ?>"
								data-wpbc-date-selection-disabled-reason="<?php echo esc_attr( $checkout_disabled_reason ); ?>"
								<?php checked( $checkout_is_supported && ! $changeover_is_enabled && 'On' === $values['date_selection_checkout_available'] ); ?>
								<?php disabled( ! $supports_advanced || ! $checkout_is_supported || $changeover_is_enabled ); ?>
							>
							<label class="wpbc_ui__toggle_icon" for="wpbc-date-selection-checkout-available"></label>
						</span>
						<span id="wpbc-date-selection-checkout-disabled-description" class="screen-reader-text" data-wpbc-date-selection-disabled-description><?php echo esc_html( $checkout_disabled_reason ); ?></span>
					</div>
					<input type="hidden" name="date_selection_checkout_available" value="<?php echo esc_attr( ! $checkout_is_supported || $changeover_is_enabled ? 'Off' : $values['date_selection_checkout_available'] ); ?>" data-wpbc-setup-wizard-field required>
				</section>

				<section class="wpbc_setup_wizard__date-selection-legend" aria-labelledby="wpbc-date-selection-legend-title" data-wpbc-date-selection-legend>
					<div class="wpbc_setup_wizard__date-selection-section-heading">
						<span>
							<h2 id="wpbc-date-selection-legend-title"><?php esc_html_e( 'Calendar legend', 'booking' ); ?></h2>
							<small><?php esc_html_e( 'Choose which date states customers see below the calendar.', 'booking' ); ?></small>
						</span>
						<span class="wpbc_ui__toggle wpbc_setup_wizard__date-selection-section-toggle">
							<input type="checkbox" id="wpbc-date-selection-legend-enabled" class="wpbc_ui_checkbox" aria-label="<?php esc_attr_e( 'Show legend below calendar', 'booking' ); ?>" data-wpbc-date-selection-toggle="date_selection_legend_enabled" <?php checked( $legend_is_enabled ); ?>>
							<label class="wpbc_ui__toggle_icon" for="wpbc-date-selection-legend-enabled"></label>
						</span>
						<input type="hidden" name="date_selection_legend_enabled" value="<?php echo esc_attr( $values['date_selection_legend_enabled'] ); ?>" data-wpbc-setup-wizard-field required>
					</div>

					<div class="wpbc_setup_wizard__date-selection-legend-settings" data-wpbc-date-selection-legend-settings<?php if ( ! $legend_is_enabled ) : ?> hidden<?php endif; ?>>
						<div class="wpbc_setup_wizard__date-selection-legend-grid">
							<?php foreach ( $legend_items as $legend_item ) : ?>
								<?php
								$legend_id           = (string) $legend_item['id'];
								$legend_item_key     = 'date_selection_legend_item_' . $legend_id;
								$legend_text_key     = 'date_selection_legend_text_' . $legend_id;
								$legend_control_id   = 'wpbc-date-selection-legend-item-' . $legend_id;
								$legend_text_id      = 'wpbc-date-selection-legend-text-' . $legend_id;
								$legend_toggle_label = sprintf(
									/* translators: %s: Calendar legend item label. */
									__( 'Show %s', 'booking' ),
									(string) $legend_item['label']
								);
								?>
								<div class="wpbc_setup_wizard__date-selection-legend-item" data-wpbc-date-selection-legend-item="<?php echo esc_attr( $legend_id ); ?>">
									<div class="wpbc_setup_wizard__date-selection-legend-item-heading">
										<label for="<?php echo esc_attr( $legend_text_id ); ?>"><?php echo esc_html( (string) $legend_item['label'] ); ?></label>
										<span class="wpbc_ui__toggle">
											<input type="checkbox" id="<?php echo esc_attr( $legend_control_id ); ?>" class="wpbc_ui_checkbox" aria-label="<?php echo esc_attr( $legend_toggle_label ); ?>" data-wpbc-date-selection-toggle="<?php echo esc_attr( $legend_item_key ); ?>" <?php checked( 'On', $values[ $legend_item_key ] ); ?>>
											<label class="wpbc_ui__toggle_icon" for="<?php echo esc_attr( $legend_control_id ); ?>"></label>
										</span>
									</div>
									<input id="<?php echo esc_attr( $legend_text_id ); ?>" type="text" name="<?php echo esc_attr( $legend_text_key ); ?>" value="<?php echo esc_attr( $values[ $legend_text_key ] ); ?>" placeholder="<?php echo esc_attr( (string) $legend_item['placeholder'] ); ?>" maxlength="255" data-wpbc-setup-wizard-field data-wpbc-date-selection-legend-title="<?php echo esc_attr( $legend_id ); ?>">
									<span class="wpbc_setup_wizard__field-error" data-wpbc-setup-wizard-error-for="<?php echo esc_attr( $legend_text_key ); ?>"></span>
									<input type="hidden" name="<?php echo esc_attr( $legend_item_key ); ?>" value="<?php echo esc_attr( $values[ $legend_item_key ] ); ?>" data-wpbc-setup-wizard-field required>
								</div>
							<?php endforeach; ?>
						</div>

						<div class="wpbc_setup_wizard__date-selection-legend-options">
							<div class="wpbc_setup_wizard__date-selection-option">
								<label for="wpbc-date-selection-legend-show-numbers"><?php esc_html_e( 'Show date number in legend', 'booking' ); ?></label>
								<span class="wpbc_ui__toggle wpbc_setup_wizard__date-selection-option-toggle">
									<input type="checkbox" id="wpbc-date-selection-legend-show-numbers" class="wpbc_ui_checkbox" data-wpbc-date-selection-toggle="date_selection_legend_show_numbers" <?php checked( 'On', $values['date_selection_legend_show_numbers'] ); ?>>
									<label class="wpbc_ui__toggle_icon" for="wpbc-date-selection-legend-show-numbers"></label>
								</span>
							</div>
							<input type="hidden" name="date_selection_legend_show_numbers" value="<?php echo esc_attr( $values['date_selection_legend_show_numbers'] ); ?>" data-wpbc-setup-wizard-field required>
							<div class="wpbc_setup_wizard__date-selection-option">
								<label for="wpbc-date-selection-legend-vertical"><?php esc_html_e( 'Show legend items in a column', 'booking' ); ?></label>
								<span class="wpbc_ui__toggle wpbc_setup_wizard__date-selection-option-toggle">
									<input type="checkbox" id="wpbc-date-selection-legend-vertical" class="wpbc_ui_checkbox" data-wpbc-date-selection-toggle="date_selection_legend_vertical" <?php checked( 'On', $values['date_selection_legend_vertical'] ); ?>>
									<label class="wpbc_ui__toggle_icon" for="wpbc-date-selection-legend-vertical"></label>
								</span>
							</div>
							<input type="hidden" name="date_selection_legend_vertical" value="<?php echo esc_attr( $values['date_selection_legend_vertical'] ); ?>" data-wpbc-setup-wizard-field required>
						</div>
					</div>
				</section>
			</div>
		</div>
	</form>
</section>
