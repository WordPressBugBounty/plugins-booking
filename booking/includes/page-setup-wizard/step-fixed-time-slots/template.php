<?php
/**
 * Sortable fixed time-slot setup editor presentation.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized step context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$step_data           = isset( $template_context['step_data'] ) && is_array( $template_context['step_data'] ) ? $template_context['step_data'] : array();
$draft_field_name    = isset( $step_data['draft_field_name'] ) ? sanitize_key( (string) $step_data['draft_field_name'] ) : 'fixed_time_slots';
$draft_values        = isset( $step_data['draft_values'] ) && is_array( $step_data['draft_values'] ) ? $step_data['draft_values'] : array();
$editor_title        = isset( $step_data['editor_title'] ) ? sanitize_text_field( (string) $step_data['editor_title'] ) : __( 'Set fixed time slots', 'booking' );
$editor_description  = isset( $step_data['editor_description'] ) ? sanitize_text_field( (string) $step_data['editor_description'] ) : __( 'Choose the fixed time slots customers can use when booking.', 'booking' );
$list_title          = isset( $step_data['list_title'] ) ? sanitize_text_field( (string) $step_data['list_title'] ) : __( 'Fixed time slots', 'booking' );
$list_description    = isset( $step_data['list_description'] ) ? sanitize_text_field( (string) $step_data['list_description'] ) : __( 'Choices shown in the booking form.', 'booking' );
$list_label          = isset( $step_data['list_label'] ) ? sanitize_text_field( (string) $step_data['list_label'] ) : $list_title;
$time_options        = isset( $step_data['time_options'] ) && is_array( $step_data['time_options'] ) ? $step_data['time_options'] : array();
$end_time_options    = isset( $step_data['end_time_options'] ) && is_array( $step_data['end_time_options'] ) ? $step_data['end_time_options'] : array();
$interval_options    = isset( $step_data['interval_options'] ) && is_array( $step_data['interval_options'] ) ? $step_data['interval_options'] : array();
$duration_options    = isset( $step_data['duration_options'] ) && is_array( $step_data['duration_options'] ) ? $step_data['duration_options'] : array();
$generator_from      = isset( $step_data['generator_from'] ) ? (string) $step_data['generator_from'] : '10:00';
$generator_to        = isset( $step_data['generator_to'] ) ? (string) $step_data['generator_to'] : '14:30';
$generator_interval  = isset( $step_data['generator_interval'] ) ? absint( $step_data['generator_interval'] ) : 30;
$generator_duration  = isset( $step_data['generator_duration'] ) ? absint( $step_data['generator_duration'] ) : 30;
$max_time_slots      = isset( $step_data['max_time_slots'] ) ? absint( $step_data['max_time_slots'] ) : 288;
$time_increment      = isset( $step_data['time_increment'] ) ? absint( $step_data['time_increment'] ) : 5;
$draft_values_json   = wp_json_encode( $draft_values );
$draft_values_json   = false === $draft_values_json ? '{}' : $draft_values_json;
$field_error_id      = 'wpbc-setup-wizard-fixed-time-slots-error';
$list_title_id       = 'wpbc-setup-wizard-fixed-time-slots-list-title';
?>
<section class="wpbc_setup_wizard__step-content wpbc_setup_wizard__fixed-slots-step" aria-labelledby="wpbc-setup-wizard-step-title">
	<header class="wpbc_setup_wizard__step-heading">
		<h1 id="wpbc-setup-wizard-step-title"><?php echo esc_html( $editor_title ); ?></h1>
		<p class="wpbc_setup_wizard__lead"><?php echo esc_html( $editor_description ); ?></p>
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
			name="<?php echo esc_attr( $draft_field_name ); ?>"
			value="<?php echo esc_attr( $draft_values_json ); ?>"
			required
			data-wpbc-setup-wizard-field
			data-wpbc-fixed-slots-draft
			data-max-time-slots="<?php echo esc_attr( (string) $max_time_slots ); ?>"
			data-time-increment="<?php echo esc_attr( (string) $time_increment ); ?>"
			aria-describedby="<?php echo esc_attr( $field_error_id ); ?>"
		>

		<div class="wpbc_setup_wizard__fixed-slots-editor" data-wpbc-fixed-slots-editor data-field-id="<?php echo esc_attr( $draft_field_name ); ?>">
			<section class="wpbc_setup_wizard__fixed-slots-panel" aria-labelledby="<?php echo esc_attr( $list_title_id ); ?>">
				<div class="wpbc_setup_wizard__fixed-slots-toolbar">
					<div class="wpbc_setup_wizard__fixed-slots-heading">
						<h2 id="<?php echo esc_attr( $list_title_id ); ?>"><?php echo esc_html( $list_title ); ?></h2>
						<p><?php echo esc_html( $list_description ); ?></p>
					</div>

					<div class="wpbc_setup_wizard__fixed-slots-generator" data-wpbc-fixed-slots-generator>
						<label>
							<span><?php esc_html_e( 'From', 'booking' ); ?></span>
							<select data-wpbc-fixed-generator-from>
								<?php foreach ( $time_options as $option ) : ?>
									<option value="<?php echo esc_attr( (string) $option['value'] ); ?>" <?php selected( $generator_from, (string) $option['value'] ); ?>><?php echo esc_html( (string) $option['label'] ); ?></option>
								<?php endforeach; ?>
							</select>
						</label>
						<label>
							<span><?php echo esc_html_x( 'To', 'range end', 'booking' ); ?></span>
							<select data-wpbc-fixed-generator-to aria-describedby="wpbc-fixed-slots-to-description">
								<?php foreach ( $time_options as $option ) : ?>
									<option value="<?php echo esc_attr( (string) $option['value'] ); ?>" <?php selected( $generator_to, (string) $option['value'] ); ?>><?php echo esc_html( (string) $option['label'] ); ?></option>
								<?php endforeach; ?>
							</select>
							<span class="screen-reader-text" id="wpbc-fixed-slots-to-description"><?php esc_html_e( 'Last generated slot start time', 'booking' ); ?></span>
						</label>
						<label>
							<span><?php esc_html_e( 'Every', 'booking' ); ?></span>
							<select data-wpbc-fixed-generator-interval>
								<?php foreach ( $interval_options as $interval_option ) : ?>
									<option value="<?php echo esc_attr( (string) $interval_option['value'] ); ?>" <?php selected( $generator_interval, (int) $interval_option['value'] ); ?>><?php echo esc_html( (string) $interval_option['label'] ); ?></option>
								<?php endforeach; ?>
							</select>
						</label>
						<label>
							<span><?php esc_html_e( 'Duration', 'booking' ); ?></span>
							<select data-wpbc-fixed-generator-duration>
								<?php foreach ( $duration_options as $duration_option ) : ?>
									<option value="<?php echo esc_attr( (string) $duration_option['value'] ); ?>" <?php selected( $generator_duration, (int) $duration_option['value'] ); ?>><?php echo esc_html( (string) $duration_option['label'] ); ?></option>
								<?php endforeach; ?>
							</select>
						</label>
						<button type="button" class="button button-secondary wpbc_setup_wizard__fixed-slots-generate" data-wpbc-generate-fixed-slots>
							<i class="menu_icon icon-1x wpbc_icn_add" aria-hidden="true"></i>
							<span><?php esc_html_e( 'Generate times', 'booking' ); ?></span>
						</button>
					</div>
				</div>

				<div class="wpbc_setup_wizard__fixed-slots-body">
					<div
						class="wpbc_setup_wizard__fixed-slot-list"
						data-wpbc-fixed-slot-list
						data-list-label="<?php echo esc_attr( $list_label ); ?>"
						aria-label="<?php echo esc_attr( $list_label ); ?>"
					></div>
					<div class="wpbc_setup_wizard__fixed-slots-actions">
						<button type="button" class="button button-secondary wpbc_setup_wizard__fixed-slot-add" data-wpbc-add-fixed-slot>
							<i class="menu_icon icon-1x wpbc_icn_add" aria-hidden="true"></i>
							<span><?php esc_html_e( 'Add one time slot', 'booking' ); ?></span>
						</button>
						<button type="button" class="button-link wpbc_setup_wizard__fixed-slots-clear" data-wpbc-clear-fixed-slots>
							<?php esc_html_e( 'Clear times', 'booking' ); ?>
						</button>
					</div>
				</div>
			</section>

			<template data-wpbc-fixed-slot-template>
				<div class="wpbc_setup_wizard__fixed-slot">
					<button type="button" class="wpbc_setup_wizard__fixed-slot-move" data-wpbc-move-fixed-slot>
						<i class="menu_icon icon-1x wpbc_icn_drag_indicator" aria-hidden="true"></i>
						<span class="screen-reader-text"><?php esc_html_e( 'Move fixed time slot', 'booking' ); ?></span>
					</button>
					<label class="screen-reader-text" data-wpbc-fixed-slot-start-label><?php esc_html_e( 'Fixed time slot start', 'booking' ); ?></label>
					<select data-wpbc-fixed-slot-start>
						<?php foreach ( $time_options as $option ) : ?>
							<option value="<?php echo esc_attr( (string) $option['value'] ); ?>"><?php echo esc_html( (string) $option['label'] ); ?></option>
						<?php endforeach; ?>
					</select>
					<span class="wpbc_setup_wizard__fixed-slot-separator" aria-hidden="true">&ndash;</span>
					<label class="screen-reader-text" data-wpbc-fixed-slot-end-label><?php esc_html_e( 'Fixed time slot end', 'booking' ); ?></label>
					<select data-wpbc-fixed-slot-end>
						<?php foreach ( $end_time_options as $option ) : ?>
							<option value="<?php echo esc_attr( (string) $option['value'] ); ?>"><?php echo esc_html( (string) $option['label'] ); ?></option>
						<?php endforeach; ?>
					</select>
					<button type="button" class="wpbc_setup_wizard__fixed-slot-remove" data-wpbc-remove-fixed-slot>
						<i class="menu_icon icon-1x wpbc_icn_delete_outline" aria-hidden="true"></i>
						<span class="screen-reader-text"><?php esc_html_e( 'Remove fixed time slot', 'booking' ); ?></span>
					</button>
				</div>
			</template>
		</div>

		<span class="wpbc_setup_wizard__field-error wpbc_setup_wizard__field-error--group" id="<?php echo esc_attr( $field_error_id ); ?>" data-wpbc-setup-wizard-error-for="<?php echo esc_attr( $draft_field_name ); ?>"></span>
	</form>
</section>
