<?php
/**
 * Modular Step 7 weekly Working Hours proposal editor.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized step context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$step_data                = $template_context['step_data'];
$working_hours            = isset( $step_data['working_hours'] ) && is_array( $step_data['working_hours'] ) ? $step_data['working_hours'] : array();
$weekdays                  = isset( $step_data['weekdays'] ) && is_array( $step_data['weekdays'] ) ? $step_data['weekdays'] : array();
$time_options              = isset( $step_data['time_options'] ) && is_array( $step_data['time_options'] ) ? $step_data['time_options'] : array();
$max_intervals_per_day     = isset( $step_data['max_intervals_per_day'] ) ? absint( $step_data['max_intervals_per_day'] ) : 8;
$working_hours_json        = wp_json_encode( $working_hours );
$working_hours_json        = false === $working_hours_json ? '{"enabled":"On","weekdays":{}}' : $working_hours_json;
$working_hours_enabled     = ! isset( $working_hours['enabled'] ) || 'Off' !== $working_hours['enabled'];
?>
<section class="wpbc_setup_wizard__step-content wpbc_setup_wizard__working-hours-step" aria-labelledby="wpbc-setup-wizard-step-title">
	<header class="wpbc_setup_wizard__step-heading">
		<h1 id="wpbc-setup-wizard-step-title"><?php esc_html_e( 'Set your working hours', 'booking' ); ?></h1>
		<p class="wpbc_setup_wizard__lead"><?php esc_html_e( 'Define the weekly schedule used to calculate available booking times.', 'booking' ); ?></p>
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
			name="working_hours"
			value="<?php echo esc_attr( $working_hours_json ); ?>"
			required
			data-wpbc-setup-wizard-field
			data-wpbc-working-hours-draft
			data-max-intervals="<?php echo esc_attr( (string) $max_intervals_per_day ); ?>"
			aria-describedby="wpbc-setup-wizard-working-hours-error"
		>

		<div class="wpbc_setup_wizard__working-hours-panel<?php echo $working_hours_enabled ? '' : ' is-disabled'; ?>" data-wpbc-working-hours-editor>
			<div class="wpbc_setup_wizard__working-hours-master">
				<label for="wpbc-setup-wizard-working-hours-enabled">
					<input
						id="wpbc-setup-wizard-working-hours-enabled"
						type="checkbox"
						value="1"
						data-wpbc-working-hours-enabled
						aria-describedby="wpbc-setup-wizard-working-hours-enabled-description"
						<?php checked( $working_hours_enabled ); ?>
					>
					<strong><?php esc_html_e( 'Limit booking times to working hours', 'booking' ); ?></strong>
				</label>
				<p id="wpbc-setup-wizard-working-hours-enabled-description"><?php esc_html_e( 'Turn this on to restrict available booking times to the weekly schedule below.', 'booking' ); ?></p>
			</div>

			<fieldset class="wpbc_setup_wizard__working-hours-controls" data-wpbc-working-hours-controls <?php disabled( ! $working_hours_enabled ); ?>>
				<legend class="screen-reader-text"><?php esc_html_e( 'Weekly working-hours schedule', 'booking' ); ?></legend>
			<div class="wpbc_setup_wizard__working-hours-header">
				<strong><?php esc_html_e( 'Day', 'booking' ); ?></strong>
				<strong><?php esc_html_e( 'Working hours', 'booking' ); ?></strong>
				<button
					type="button"
					class="button button-secondary wpbc_setup_wizard__copy-schedule-toggle"
					aria-expanded="false"
					aria-controls="wpbc-setup-wizard-copy-schedule"
					data-wpbc-copy-schedule-toggle
				>
					<i class="menu_icon icon-1x wpbc_icn_content_copy" aria-hidden="true"></i>
					<span><?php esc_html_e( 'Copy schedule', 'booking' ); ?></span>
				</button>
			</div>

			<section id="wpbc-setup-wizard-copy-schedule" class="wpbc_setup_wizard__copy-schedule" aria-labelledby="wpbc-setup-wizard-copy-schedule-title" data-wpbc-copy-schedule-panel hidden>
				<div class="wpbc_setup_wizard__copy-schedule-heading">
					<div>
						<h2 id="wpbc-setup-wizard-copy-schedule-title"><?php esc_html_e( 'Copy a day schedule', 'booking' ); ?></h2>
						<p><?php esc_html_e( 'Choose one source day and the days that should receive its complete interval list.', 'booking' ); ?></p>
					</div>
					<button type="button" class="wpbc_setup_wizard__copy-schedule-close" data-wpbc-copy-schedule-cancel aria-label="<?php esc_attr_e( 'Close schedule copy controls', 'booking' ); ?>">
						<i class="menu_icon icon-1x wpbc_icn_close" aria-hidden="true"></i>
					</button>
				</div>

				<div class="wpbc_setup_wizard__copy-schedule-controls">
					<div class="wpbc_setup_wizard__field">
						<label for="wpbc-setup-wizard-copy-source"><?php esc_html_e( 'Copy from', 'booking' ); ?></label>
						<select id="wpbc-setup-wizard-copy-source" data-wpbc-copy-source>
							<?php foreach ( $weekdays as $weekday ) : ?>
								<option value="<?php echo esc_attr( (string) $weekday['day_number'] ); ?>" <?php selected( 1, (int) $weekday['day_number'] ); ?>><?php echo esc_html( $weekday['label'] ); ?></option>
							<?php endforeach; ?>
						</select>
					</div>

					<fieldset class="wpbc_setup_wizard__copy-targets">
						<legend><?php esc_html_e( 'Copy to', 'booking' ); ?></legend>
						<div>
							<?php foreach ( $weekdays as $weekday ) : ?>
								<?php $copy_day_number = isset( $weekday['day_number'] ) ? absint( $weekday['day_number'] ) : 0; ?>
								<label>
									<input type="checkbox" value="<?php echo esc_attr( (string) $copy_day_number ); ?>" data-wpbc-copy-target <?php checked( in_array( $copy_day_number, array( 2, 3, 4, 5 ), true ) ); ?> <?php disabled( 1 === $copy_day_number ); ?>>
									<span><?php echo esc_html( $weekday['label'] ); ?></span>
								</label>
							<?php endforeach; ?>
						</div>
					</fieldset>
				</div>

				<div class="wpbc_setup_wizard__copy-schedule-actions">
					<button type="button" class="button button-secondary" data-wpbc-copy-schedule-cancel><?php esc_html_e( 'Cancel', 'booking' ); ?></button>
					<button type="button" class="button button-primary" data-wpbc-copy-schedule-apply><?php esc_html_e( 'Copy hours', 'booking' ); ?></button>
				</div>
			</section>

			<div class="wpbc_setup_wizard__working-days">
				<?php foreach ( $weekdays as $weekday ) : ?>
					<?php
					$day_number    = isset( $weekday['day_number'] ) ? absint( $weekday['day_number'] ) : 0;
					$day_label     = isset( $weekday['label'] ) ? (string) $weekday['label'] : '';
					$day_intervals = isset( $working_hours['weekdays'][ $day_number ] ) && is_array( $working_hours['weekdays'][ $day_number ] ) ? $working_hours['weekdays'][ $day_number ] : array();
					$is_enabled    = ! empty( $day_intervals );
					$checkbox_id   = 'wpbc-setup-wizard-working-day-' . $day_number;
					/* translators: %s: Weekday name. */
					$working_intervals_label = sprintf( __( '%s working intervals', 'booking' ), $day_label );
					/* translators: %s: Weekday name. */
					$availability_label = sprintf( __( '%s availability', 'booking' ), $day_label );
					?>
					<div
						class="wpbc_setup_wizard__working-day<?php echo $is_enabled ? ' is-enabled' : ''; ?>"
						data-wpbc-working-day="<?php echo esc_attr( (string) $day_number ); ?>"
						data-day-label="<?php echo esc_attr( $day_label ); ?>"
					>
						<label class="wpbc_setup_wizard__working-day-toggle" for="<?php echo esc_attr( $checkbox_id ); ?>">
							<input
								id="<?php echo esc_attr( $checkbox_id ); ?>"
								type="checkbox"
								value="1"
								data-wpbc-working-day-toggle
								<?php checked( $is_enabled ); ?>
								<?php if ( 1 === $day_number ) : ?>data-wpbc-setup-wizard-error-control-for="working_hours"<?php endif; ?>
							>
							<span><?php echo esc_html( $day_label ); ?></span>
						</label>

						<div class="wpbc_setup_wizard__working-day-schedule">
							<div
								class="wpbc_setup_wizard__working-intervals"
								data-wpbc-working-intervals
								aria-label="<?php echo esc_attr( $working_intervals_label ); ?>"
							></div>
							<select class="wpbc_setup_wizard__working-unavailable" disabled data-wpbc-working-unavailable aria-label="<?php echo esc_attr( $availability_label ); ?>">
								<option><?php esc_html_e( 'Unavailable', 'booking' ); ?></option>
							</select>
						</div>

						<button type="button" class="wpbc_setup_wizard__add-interval" data-wpbc-add-working-interval>
							<i class="menu_icon icon-1x wpbc_icn_add" aria-hidden="true"></i>
							<span><?php esc_html_e( 'Add interval', 'booking' ); ?></span>
						</button>
					</div>
				<?php endforeach; ?>
			</div>

			<div class="wpbc_setup_wizard__working-hours-notice wpbc_setup_wizard__message wpbc_setup_wizard__message--info">
				<i class="menu_icon icon-1x wpbc_icn_info_outline" aria-hidden="true"></i>
				<p><?php esc_html_e( 'Journey-specific slots and durations will be calculated inside these hours.', 'booking' ); ?></p>
			</div>
			</fieldset>

		</div>
		<span class="wpbc_setup_wizard__field-error wpbc_setup_wizard__field-error--group" id="wpbc-setup-wizard-working-hours-error" data-wpbc-setup-wizard-error-for="working_hours"></span>
	</form>

	<template data-wpbc-working-interval-template>
		<div class="wpbc_setup_wizard__working-interval">
			<label class="screen-reader-text" data-wpbc-working-start-label><?php esc_html_e( 'Start time', 'booking' ); ?></label>
			<select data-wpbc-working-start>
				<?php foreach ( $time_options as $time_option ) : ?>
					<option value="<?php echo esc_attr( (string) $time_option['value'] ); ?>"><?php echo esc_html( $time_option['label'] ); ?></option>
				<?php endforeach; ?>
			</select>
			<span class="wpbc_setup_wizard__working-interval-separator" aria-hidden="true">&ndash;</span>
			<label class="screen-reader-text" data-wpbc-working-end-label><?php esc_html_e( 'End time', 'booking' ); ?></label>
			<select data-wpbc-working-end>
				<?php foreach ( $time_options as $time_option ) : ?>
					<option value="<?php echo esc_attr( (string) $time_option['value'] ); ?>"><?php echo esc_html( $time_option['label'] ); ?></option>
				<?php endforeach; ?>
			</select>
			<button type="button" class="wpbc_setup_wizard__remove-interval" data-wpbc-remove-working-interval>
				<i class="menu_icon icon-1x wpbc_icn_delete_outline" aria-hidden="true"></i>
				<span class="screen-reader-text"><?php esc_html_e( 'Remove working interval', 'booking' ); ?></span>
			</button>
		</div>
	</template>
</section>
