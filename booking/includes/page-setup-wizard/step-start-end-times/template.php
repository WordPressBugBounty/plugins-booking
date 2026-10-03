<?php
/**
 * Reusable sortable time-choice setup editor presentation.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized step context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$step_data          = isset( $template_context['step_data'] ) && is_array( $template_context['step_data'] ) ? $template_context['step_data'] : array();
$draft_field_name   = isset( $step_data['draft_field_name'] ) ? sanitize_key( (string) $step_data['draft_field_name'] ) : 'start_end_times';
$draft_values       = isset( $step_data['draft_values'] ) && is_array( $step_data['draft_values'] ) ? $step_data['draft_values'] : array();
$editor_title       = isset( $step_data['editor_title'] ) ? sanitize_text_field( (string) $step_data['editor_title'] ) : __( 'Set booking times', 'booking' );
$editor_description = isset( $step_data['editor_description'] ) ? sanitize_text_field( (string) $step_data['editor_description'] ) : __( 'Choose the time options customers can use when booking.', 'booking' );
$validation_rule    = isset( $step_data['validation_rule'] ) ? sanitize_key( (string) $step_data['validation_rule'] ) : 'independent_lists';
$list_definitions   = isset( $step_data['list_definitions'] ) && is_array( $step_data['list_definitions'] ) ? $step_data['list_definitions'] : array();
$copy_action        = isset( $step_data['copy_action'] ) && is_array( $step_data['copy_action'] ) ? $step_data['copy_action'] : array();
$interval_options   = isset( $step_data['interval_options'] ) && is_array( $step_data['interval_options'] ) ? $step_data['interval_options'] : array();
$max_times_per_list = isset( $step_data['max_times_per_list'] ) ? absint( $step_data['max_times_per_list'] ) : 288;
$time_increment     = isset( $step_data['time_increment'] ) ? absint( $step_data['time_increment'] ) : 5;
$draft_values_json  = wp_json_encode( $draft_values );
$draft_values_json  = false === $draft_values_json ? '{}' : $draft_values_json;
$field_error_id     = 'wpbc-setup-wizard-' . str_replace( '_', '-', $draft_field_name ) . '-error';
?>
<section class="wpbc_setup_wizard__step-content wpbc_setup_wizard__time-choices-step" aria-labelledby="wpbc-setup-wizard-step-title">
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
			data-wpbc-time-choices-draft
			data-max-times="<?php echo esc_attr( (string) $max_times_per_list ); ?>"
			data-time-increment="<?php echo esc_attr( (string) $time_increment ); ?>"
			aria-describedby="<?php echo esc_attr( $field_error_id ); ?>"
		>

		<div
			class="wpbc_setup_wizard__time-choices-editor"
			data-wpbc-time-choices-editor
			data-field-id="<?php echo esc_attr( $draft_field_name ); ?>"
			data-validation-rule="<?php echo esc_attr( $validation_rule ); ?>"
		>
			<?php foreach ( $list_definitions as $raw_list_id => $raw_list_definition ) : ?>
				<?php
				$list_id         = sanitize_key( (string) $raw_list_id );
				$list_definition = is_array( $raw_list_definition ) ? $raw_list_definition : array();
				$options         = isset( $list_definition['options'] ) && is_array( $list_definition['options'] ) ? $list_definition['options'] : array();
				$current_values  = isset( $draft_values[ $list_id ] ) && is_array( $draft_values[ $list_id ] ) ? array_values( $draft_values[ $list_id ] ) : array();
				$first_value     = ! empty( $current_values ) ? (string) reset( $current_values ) : ( isset( $options[0]['value'] ) ? (string) $options[0]['value'] : '' );
				$last_value      = ! empty( $current_values ) ? (string) end( $current_values ) : ( isset( $options[ count( $options ) - 1 ]['value'] ) ? (string) $options[ count( $options ) - 1 ]['value'] : '' );
				$list_title      = isset( $list_definition['title'] ) ? (string) $list_definition['title'] : $list_id;
				$list_label      = isset( $list_definition['list_label'] ) ? (string) $list_definition['list_label'] : $list_title;
				$generator_interval = isset( $list_definition['generator_interval'] ) ? absint( $list_definition['generator_interval'] ) : 30;
				$list_title_id   = 'wpbc-setup-wizard-' . str_replace( '_', '-', $list_id ) . '-title';
				?>

				<?php if ( ! empty( $copy_action ) && $list_id === sanitize_key( isset( $copy_action['target'] ) ? (string) $copy_action['target'] : '' ) ) : ?>
					<div class="wpbc_setup_wizard__time-copy-row" aria-label="<?php echo esc_attr( isset( $copy_action['aria_label'] ) ? (string) $copy_action['aria_label'] : '' ); ?>">
						<span aria-hidden="true"></span>
						<button
							type="button"
							class="button button-secondary wpbc_setup_wizard__copy-start-times"
							data-wpbc-copy-times
							data-source-list="<?php echo esc_attr( sanitize_key( isset( $copy_action['source'] ) ? (string) $copy_action['source'] : '' ) ); ?>"
							data-target-list="<?php echo esc_attr( $list_id ); ?>"
							data-status="<?php echo esc_attr( isset( $copy_action['status'] ) ? (string) $copy_action['status'] : '' ); ?>"
						>
							<i class="menu_icon icon-1x wpbc_icn_arrow_forward" aria-hidden="true"></i>
							<span><?php echo esc_html( isset( $copy_action['label'] ) ? (string) $copy_action['label'] : '' ); ?></span>
						</button>
						<span aria-hidden="true"></span>
					</div>
				<?php endif; ?>

				<section class="wpbc_setup_wizard__time-list-panel" aria-labelledby="<?php echo esc_attr( $list_title_id ); ?>" data-wpbc-time-list-panel="<?php echo esc_attr( $list_id ); ?>">
					<div class="wpbc_setup_wizard__time-list-toolbar">
						<div class="wpbc_setup_wizard__time-list-heading">
							<h2 id="<?php echo esc_attr( $list_title_id ); ?>"><?php echo esc_html( $list_title ); ?></h2>
							<p><?php echo esc_html( isset( $list_definition['description'] ) ? (string) $list_definition['description'] : '' ); ?></p>
						</div>

						<div class="wpbc_setup_wizard__time-generator" data-wpbc-time-generator="<?php echo esc_attr( $list_id ); ?>">
							<label>
								<span><?php esc_html_e( 'From', 'booking' ); ?></span>
								<select data-wpbc-generator-from>
									<?php foreach ( $options as $option ) : ?>
										<option value="<?php echo esc_attr( (string) $option['value'] ); ?>" <?php selected( $first_value, (string) $option['value'] ); ?>><?php echo esc_html( (string) $option['label'] ); ?></option>
									<?php endforeach; ?>
								</select>
							</label>
							<label>
								<span><?php echo esc_html_x( 'To', 'range end', 'booking' ); ?></span>
								<select data-wpbc-generator-to>
									<?php foreach ( $options as $option ) : ?>
										<option value="<?php echo esc_attr( (string) $option['value'] ); ?>" <?php selected( $last_value, (string) $option['value'] ); ?>><?php echo esc_html( (string) $option['label'] ); ?></option>
									<?php endforeach; ?>
								</select>
							</label>
							<label>
								<span><?php esc_html_e( 'Every', 'booking' ); ?></span>
								<select data-wpbc-generator-interval>
									<?php foreach ( $interval_options as $interval_option ) : ?>
										<option value="<?php echo esc_attr( (string) $interval_option['value'] ); ?>" <?php selected( $generator_interval, (int) $interval_option['value'] ); ?>><?php echo esc_html( (string) $interval_option['label'] ); ?></option>
									<?php endforeach; ?>
								</select>
							</label>
							<button type="button" class="button button-secondary wpbc_setup_wizard__generate-times" data-wpbc-generate-times>
								<i class="menu_icon icon-1x wpbc_icn_add" aria-hidden="true"></i>
								<span><?php esc_html_e( 'Generate times', 'booking' ); ?></span>
							</button>
						</div>
					</div>

					<div class="wpbc_setup_wizard__time-list-body">
						<div
							class="wpbc_setup_wizard__time-choice-list"
							data-wpbc-time-choice-list="<?php echo esc_attr( $list_id ); ?>"
							data-list-label="<?php echo esc_attr( $list_label ); ?>"
							data-clear-status="<?php echo esc_attr( isset( $list_definition['clear_status'] ) ? (string) $list_definition['clear_status'] : '' ); ?>"
							aria-label="<?php echo esc_attr( $list_label ); ?>"
						></div>
						<div class="wpbc_setup_wizard__time-list-actions">
							<button type="button" class="button button-secondary wpbc_setup_wizard__add-time" data-wpbc-add-time>
								<i class="menu_icon icon-1x wpbc_icn_add" aria-hidden="true"></i>
								<span><?php echo esc_html( isset( $list_definition['add_label'] ) ? (string) $list_definition['add_label'] : __( 'Add one choice', 'booking' ) ); ?></span>
							</button>
							<button
								type="button"
								class="button-link wpbc_setup_wizard__clear-times"
								data-wpbc-clear-times
								aria-label="<?php echo esc_attr( isset( $list_definition['clear_aria_label'] ) ? (string) $list_definition['clear_aria_label'] : '' ); ?>"
							>
								<?php esc_html_e( 'Clear times', 'booking' ); ?>
							</button>
						</div>
					</div>
				</section>

				<template data-wpbc-time-choice-template="<?php echo esc_attr( $list_id ); ?>">
					<div class="wpbc_setup_wizard__time-choice">
						<button type="button" class="wpbc_setup_wizard__time-choice-move" data-wpbc-move-time>
							<i class="menu_icon icon-1x wpbc_icn_drag_indicator" aria-hidden="true"></i>
							<span class="screen-reader-text"><?php esc_html_e( 'Move time choice', 'booking' ); ?></span>
						</button>
						<label class="screen-reader-text" data-wpbc-time-choice-label><?php esc_html_e( 'Time choice', 'booking' ); ?></label>
						<select data-wpbc-time-choice>
							<?php foreach ( $options as $option ) : ?>
								<option value="<?php echo esc_attr( (string) $option['value'] ); ?>"><?php echo esc_html( (string) $option['label'] ); ?></option>
							<?php endforeach; ?>
						</select>
						<button type="button" class="wpbc_setup_wizard__time-choice-remove" data-wpbc-remove-time>
							<i class="menu_icon icon-1x wpbc_icn_delete_outline" aria-hidden="true"></i>
							<span class="screen-reader-text"><?php esc_html_e( 'Remove time choice', 'booking' ); ?></span>
						</button>
					</div>
				</template>
			<?php endforeach; ?>
		</div>

		<span class="wpbc_setup_wizard__field-error wpbc_setup_wizard__field-error--group" id="<?php echo esc_attr( $field_error_id ); ?>" data-wpbc-setup-wizard-error-for="<?php echo esc_attr( $draft_field_name ); ?>"></span>
	</form>
</section>
