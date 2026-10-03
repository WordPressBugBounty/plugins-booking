<?php
/**
 * Reusable Days Off and date-availability editor.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized step context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$step_data             = isset( $template_context['step_data'] ) && is_array( $template_context['step_data'] ) ? $template_context['step_data'] : array();
$can_manage            = ! empty( $step_data['can_manage'] );
$has_resources         = ! empty( $step_data['has_resources'] );
$resources             = isset( $step_data['resources'] ) && is_array( $step_data['resources'] ) ? $step_data['resources'] : array();
$apply_options         = isset( $step_data['apply_options'] ) && is_array( $step_data['apply_options'] ) ? $step_data['apply_options'] : array();
$ranges                = isset( $step_data['ranges'] ) && is_array( $step_data['ranges'] ) ? $step_data['ranges'] : array();
$first_date            = isset( $step_data['default_first_date'] ) ? (string) $step_data['default_first_date'] : '';
$last_date             = isset( $step_data['default_last_date'] ) ? (string) $step_data['default_last_date'] : '';
$initial_state         = wp_json_encode( $step_data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );
$initial_state         = false === $initial_state ? '{}' : $initial_state;
$staged_values         = isset( $template_context['values']['days_off'] ) && is_array( $template_context['values']['days_off'] )
	? $template_context['values']['days_off']
	: array(
		'revision'          => isset( $step_data['revision'] ) ? (string) $step_data['revision'] : '',
		'unavailable_dates' => isset( $step_data['unavailable_dates'] ) && is_array( $step_data['unavailable_dates'] ) ? $step_data['unavailable_dates'] : array(),
	);
$staged_json           = wp_json_encode( $staged_values );
$staged_json           = false === $staged_json ? '{"revision":"","unavailable_dates":{}}' : $staged_json;
$is_aggregate_scope    = ! empty( $step_data['is_aggregate_scope'] );
$aggregate_legend_html = '';
$resource_legend_html  = '';
if ( function_exists( 'wpbc_get_calendar_legend__content_html' ) && ! empty( $resources ) ) {
	$aggregate_legend_html = wpbc_get_calendar_legend__content_html(
		array(
			'is_vertical'               => false,
			'text_for_day_cell'         => gmdate( 'd' ),
			'items'                     => array( 'available', 'resource_unavailable', 'resources_partially_unavailable', 'resources_have_bookings' ),
			'unavailable_day_cell_tag'  => 'a',
			'resource_id'               => absint( $resources[0]['id'] ),
			'titles'                   => array(
				'available'                       => __( 'Available', 'booking' ),
				'resource_unavailable'            => __( 'Unavailable', 'booking' ),
				'resources_partially_unavailable' => __( 'Some booking items unavailable', 'booking' ),
				'resources_have_bookings'         => __( 'Bookings exist for one or more booking items', 'booking' ),
			),
		)
	);
	$resource_legend_html = wpbc_get_calendar_legend__content_html(
		array(
			'is_vertical'               => false,
			'text_for_day_cell'         => gmdate( 'd' ),
			'items'                     => array( 'available', 'resource_unavailable', 'approved', 'pending', 'partially' ),
			'unavailable_day_cell_tag'  => 'a',
			'resource_id'               => absint( $resources[0]['id'] ),
			'titles'                   => array(
				'available'            => __( 'Available', 'booking' ),
				'resource_unavailable' => __( 'Unavailable', 'booking' ),
				'approved'             => __( 'Approved booking', 'booking' ),
				'pending'              => __( 'Pending booking', 'booking' ),
				'partially'            => __( 'Partially booked', 'booking' ),
			),
		)
	);
}
?>
<section class="wpbc_setup_wizard__step-content wpbc_setup_wizard__days-off-step" aria-labelledby="wpbc-setup-wizard-step-title" data-wpbc-days-off-editor>
	<header class="wpbc_setup_wizard__step-heading">
		<h1 id="wpbc-setup-wizard-step-title"><?php esc_html_e( 'Set days off and date availability', 'booking' ); ?></h1>
		<p class="wpbc_setup_wizard__lead"><?php esc_html_e( 'Add the dates when your business is closed.', 'booking' ); ?></p>
	</header>
	<?php
	$template_context['templates']->render(
		'settings-hint',
		array( 'settings_hint' => $template_context['settings_hint'] )
	);
	?>

	<form class="wpbc_setup_wizard__content-panel wpbc_setup_wizard__days-off-panel" id="wpbc-setup-wizard-step-form" novalidate>
		<input type="hidden" name="days_off" value="<?php echo esc_attr( $staged_json ); ?>" data-wpbc-setup-wizard-field data-wpbc-days-off-value>
		<?php if ( $can_manage && $has_resources ) : ?>
			<div class="wpbc_setup_wizard__days-off-fields">
				<div class="wpbc_setup_wizard__field">
					<label for="wpbc-setup-wizard-days-off-first-date"><?php esc_html_e( 'First date', 'booking' ); ?></label>
					<output id="wpbc-setup-wizard-days-off-first-date" class="wpbc_setup_wizard__days-off-date-output" data-wpbc-days-off-first-date aria-live="polite"><?php echo esc_html( $first_date ); ?></output>
				</div>
				<div class="wpbc_setup_wizard__field">
					<label for="wpbc-setup-wizard-days-off-last-date"><?php esc_html_e( 'Last date', 'booking' ); ?></label>
					<output id="wpbc-setup-wizard-days-off-last-date" class="wpbc_setup_wizard__days-off-date-output" data-wpbc-days-off-last-date aria-live="polite"><?php echo esc_html( $last_date ); ?></output>
				</div>
				<div class="wpbc_setup_wizard__field">
					<label for="wpbc-setup-wizard-days-off-scope"><?php esc_html_e( 'Apply to', 'booking' ); ?></label>
					<select id="wpbc-setup-wizard-days-off-scope" data-wpbc-days-off-scope aria-describedby="wpbc-setup-wizard-days-off-error">
						<?php foreach ( $apply_options as $apply_option ) : ?>
							<option value="<?php echo esc_attr( (string) $apply_option['value'] ); ?>"><?php echo esc_html( (string) $apply_option['label'] ); ?></option>
						<?php endforeach; ?>
					</select>
				</div>
			</div>

			<div class="wpbc_setup_wizard__days-off-native-availability wpbc_ajx_availability_container">
				<div class="wpbc_setup_wizard__days-off-picker-layout">
					<div class="wpbc_setup_wizard__days-off-calendar-column" data-wpbc-days-off-calendar-column>
						<div class="wpbc_cal_container bk_calendar_frame months_num_in_row_2 cal_month_num_2" style="width:100%;max-width:1023px;">
							<div id="wpbc-setup-wizard-days-off-calendar" class="wpbc_setup_wizard__days-off-calendar wpbc_calendar_id_0" data-wpbc-days-off-calendar aria-label="<?php esc_attr_e( 'Select the first and last unavailable date', 'booking' ); ?>"></div>
						</div>
					</div>
					<aside class="wpbc_setup_wizard__days-off-summary" aria-labelledby="wpbc-setup-wizard-days-off-summary-title">
						<strong id="wpbc-setup-wizard-days-off-summary-title" data-wpbc-days-off-summary-range></strong>
						<span data-wpbc-days-off-summary-count></span>
						<button type="button" class="button button-primary wpbc_setup_wizard__days-off-add" data-wpbc-days-off-add><?php esc_html_e( 'Add range', 'booking' ); ?></button>
						<button type="button" class="button-link wpbc_setup_wizard__days-off-clear" data-wpbc-days-off-clear><?php esc_html_e( 'Clear selection', 'booking' ); ?></button>
					</aside>
				</div>

				<?php if ( '' !== $aggregate_legend_html || '' !== $resource_legend_html ) : ?>
					<div class="wpbc_setup_wizard__days-off-legend" data-wpbc-days-off-aggregate-legend aria-label="<?php esc_attr_e( 'All booking items calendar legend', 'booking' ); ?>"<?php if ( ! $is_aggregate_scope ) : ?> hidden<?php endif; ?>>
						<?php echo $aggregate_legend_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Generated by the core allow-listed Booking Calendar legend renderer. ?>
					</div>
					<div class="wpbc_setup_wizard__days-off-legend" data-wpbc-days-off-resource-legend aria-label="<?php esc_attr_e( 'Booking item calendar legend', 'booking' ); ?>"<?php if ( $is_aggregate_scope ) : ?> hidden<?php endif; ?>>
						<?php echo $resource_legend_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Generated by the core allow-listed Booking Calendar legend renderer. ?>
					</div>
				<?php endif; ?>
			</div>

			<div class="wpbc_setup_wizard__field-error wpbc_setup_wizard__days-off-error" id="wpbc-setup-wizard-days-off-error" data-wpbc-days-off-error role="alert"></div>

			<section class="wpbc_setup_wizard__days-off-upcoming" aria-labelledby="wpbc-setup-wizard-days-off-upcoming-title">
				<h2 id="wpbc-setup-wizard-days-off-upcoming-title"><?php esc_html_e( 'Upcoming unavailable dates', 'booking' ); ?></h2>
				<p class="wpbc_setup_wizard__days-off-empty" data-wpbc-days-off-empty<?php if ( ! empty( $ranges ) ) : ?> hidden<?php endif; ?>><?php esc_html_e( 'No upcoming unavailable dates.', 'booking' ); ?></p>
				<ul class="wpbc_setup_wizard__days-off-ranges" data-wpbc-days-off-ranges>
					<?php foreach ( $ranges as $range ) : ?>
						<li>
							<span><?php echo esc_html( (string) $range['label'] ); ?></span>
							<span><?php echo esc_html( (string) $range['scope_label'] ); ?></span>
							<button type="button" class="wpbc_setup_wizard__days-off-remove" data-wpbc-days-off-remove data-first-date="<?php echo esc_attr( (string) $range['first_date'] ); ?>" data-last-date="<?php echo esc_attr( (string) $range['last_date'] ); ?>" data-scope="<?php echo esc_attr( (string) $range['scope'] ); ?>" aria-label="<?php esc_attr_e( 'Remove unavailable date range', 'booking' ); ?>">
								<i class="menu_icon icon-1x wpbc_icn_delete_outline" aria-hidden="true"></i>
							</button>
						</li>
					<?php endforeach; ?>
				</ul>
			</section>
		<?php else : ?>
			<div class="wpbc_setup_wizard__days-off-permission wpbc_setup_wizard__message wpbc_setup_wizard__message--warning">
				<?php if ( $can_manage ) : ?>
					<p><?php esc_html_e( 'No booking items are available for date availability yet. You can continue and configure days off later.', 'booking' ); ?></p>
				<?php else : ?>
					<p><?php esc_html_e( 'Your account can continue the Setup Wizard, but it cannot change Days Availability. Ask an administrator with Availability permission to configure days off.', 'booking' ); ?></p>
				<?php endif; ?>
			</div>
		<?php endif; ?>
	</form>

	<script type="application/json" data-wpbc-days-off-state><?php echo $initial_state; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- JSON is hex-escaped above. ?></script>
</section>
