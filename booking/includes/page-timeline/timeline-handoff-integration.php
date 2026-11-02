<?php
/**
 * Timeline integration with canonical booking-creation pages.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Read and verify one Timeline handoff from the current administration URL.
 *
 * The token is presentation context only. Destination workflows remain
 * authoritative for booking validation, pricing, email intent, and saving.
 *
 * @param string $purpose Expected signed-token purpose.
 *
 * @return array<string,mixed>|WP_Error|null Verified context, error, or null.
 */
function wpbc_timeline_get_requested_handoff( $purpose ) {
	if ( ! isset( $_GET['wpbc_timeline_handoff'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only signed navigation context.
		return null;
	}

	$token = sanitize_text_field( wp_unslash( $_GET['wpbc_timeline_handoff'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only signed navigation context.

	return ( new WPBC_Timeline_Handoff() )->verify_token( $token, $purpose );
}

/**
 * Resolve the reviewed email intent from a verified Timeline handoff.
 *
 * @param string $purpose Expected signed-token purpose.
 *
 * @return bool|null True to send, false not to send, or null without a valid intent.
 */
function wpbc_timeline_get_requested_email_intent( $purpose ) {
	$handoff = wpbc_timeline_get_requested_handoff( $purpose );
	if ( ! is_array( $handoff ) || ! isset( $handoff['email_intent'] ) ) {
		return null;
	}

	$email_intent = sanitize_key( (string) $handoff['email_intent'] );
	if ( ! in_array( $email_intent, array( 'send', 'do_not_send' ), true ) ) {
		return null;
	}

	return 'send' === $email_intent;
}

/**
 * Convert a verified Timeline selection into Add Booking component arguments.
 *
 * @param array<string,mixed> $handoff Verified booking handoff.
 *
 * @return array<string,mixed> Canonical component arguments.
 */
function wpbc_timeline_get_add_booking_component_args( $handoff ) {
	if ( ! is_array( $handoff ) || empty( $handoff['resource_id'] ) ) {
		return array();
	}

	$timezone = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
	try {
		$start = ( new DateTimeImmutable( (string) $handoff['start_at'] ) )->setTimezone( $timezone );
		$end   = ( new DateTimeImmutable( (string) $handoff['end_at'] ) )->setTimezone( $timezone );
	} catch ( Exception $exception ) {
		return array();
	}
	if ( $start >= $end ) {
		return array();
	}

	$arguments = array(
		'resource_id'                     => absint( $handoff['resource_id'] ),
		'booking_type'                    => absint( $handoff['resource_id'] ),
		'booking_form'                    => isset( $handoff['booking_form'] ) ? sanitize_text_field( (string) $handoff['booking_form'] ) : '',
		'calendar_dates_start'            => '',
		'calendar_dates_end'              => '',
		'selected_dates_without_calendar' => '',
		'start_month_calendar'            => array( (int) $start->format( 'Y' ), (int) $start->format( 'n' ) ),
		'preselect_calendar_dates'        => 1,
		'initial_calendar_dates'          => array(),
		'selected_date'                   => $start->format( 'Y-m-d' ),
	);

	if ( ! empty( $handoff['is_full_day'] ) ) {
		$initial_calendar_dates = array();
		$selected_dates         = array();
		$current                = $start->setTime( 0, 0, 0 );
		while ( $current < $end ) {
			$initial_calendar_dates[] = $current->format( 'Y-m-d' );
			$selected_dates[]         = $current->format( 'd.m.Y' );
			$current                  = $current->modify( '+1 day' );
		}
		$arguments['initial_calendar_dates'] = $initial_calendar_dates;
		$arguments['selected_dates']         = implode( ', ', $selected_dates );
	} else {
		$arguments['initial_calendar_dates'] = array( $start->format( 'Y-m-d' ) );
		$arguments['selected_dates']         = $start->format( 'd.m.Y' );
		$arguments['selected_time']          = $start->format( 'H:i' );
		$arguments['time_override_enabled']  = 1;
		$arguments['time_override_source']   = 'timeline_selection';
		$arguments['time_override_start']    = $start->format( 'H:i' );
		$arguments['time_override_end']      = $end->format( 'H:i' );
	}

	return $arguments;
}

/**
 * Convert a verified selection into Add Appointment component configuration.
 *
 * @param array<string,mixed> $handoff Verified appointment handoff.
 *
 * @return array<string,mixed> Appointment component configuration.
 */
function wpbc_timeline_get_add_appointment_config( $handoff ) {
	if ( ! is_array( $handoff ) || empty( $handoff['resource_id'] ) || empty( $handoff['start_at'] ) || empty( $handoff['end_at'] ) ) {
		return array();
	}

	$timezone = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
	try {
		$start = ( new DateTimeImmutable( (string) $handoff['start_at'] ) )->setTimezone( $timezone );
		$end   = ( new DateTimeImmutable( (string) $handoff['end_at'] ) )->setTimezone( $timezone );
	} catch ( Exception $exception ) {
		return array();
	}
	if ( $start >= $end ) {
		return array();
	}

	return array(
		'provider_id'                     => absint( $handoff['resource_id'] ),
		'provider_ids'                    => array( absint( $handoff['resource_id'] ) ),
		'service_id'                      => isset( $handoff['service_id'] ) ? absint( $handoff['service_id'] ) : 0,
		'service_ids'                     => ! empty( $handoff['service_id'] ) ? array( absint( $handoff['service_id'] ) ) : array(),
		'calendar_dates_start'            => '',
		'calendar_dates_end'              => '',
		'selected_dates_without_calendar' => '',
		'start_month_calendar'            => array( (int) $start->format( 'Y' ), (int) $start->format( 'n' ) ),
		'preselect_calendar_dates'        => 1,
		'initial_calendar_dates'          => array( $start->format( 'Y-m-d' ) ),
		'initial_start_time'              => '',
		'return_url'                      => ( new WPBC_Timeline_Handoff() )->get_timeline_return_url( $handoff ),
	);
}

/**
 * Render a safe return action and preserved-selection summary.
 *
 * @param array<string,mixed> $handoff Verified Timeline handoff.
 *
 * @return void
 */
function wpbc_timeline_render_handoff_notice( $handoff ) {
	if ( ! is_array( $handoff ) ) {
		return;
	}

	$return_url = ( new WPBC_Timeline_Handoff() )->get_timeline_return_url( $handoff );
	?>
	<div class="notice notice-info inline wpbc_timeline_handoff_notice">
		<p>
			<strong><?php esc_html_e( 'Timeline selection preserved.', 'booking' ); ?></strong>
			<?php esc_html_e( 'Complete the canonical booking workflow below. Returning to Timeline restores this date and time context.', 'booking' ); ?>
			<a href="<?php echo esc_url( $return_url ); ?>"><?php esc_html_e( 'Return to Timeline', 'booking' ); ?></a>
		</p>
	</div>
	<?php
}

/**
 * Build the configured initial Timeline window request.
 *
 * The default preset remains a server-owned configuration choice. Returning a
 * normal request shape here ensures the first authorized read uses the same
 * validation path as navigation and AJAX reads instead of relying on the
 * validator's generic day-count fallback.
 *
 * @return array<string,mixed> Allow-listed default window request.
 */
function wpbc_timeline_get_default_window_request() {
	$configuration     = wpbc_timeline_get_configuration();
	$default_preset_id = sanitize_key( $configuration['default_preset'] );
	$default_preset     = isset( $configuration['presets'][ $default_preset_id ] )
		? $configuration['presets'][ $default_preset_id ]
		: array();
	$default_months     = isset( $default_preset['window_months'] )
		? absint( $default_preset['window_months'] )
		: 0;
	$window_request     = array(
		'view' => sanitize_key( $configuration['default_view'] ),
	);

	if ( 0 < $default_months ) {
		$window_request['window_months'] = $default_months;
	} else {
		$window_request['window_days'] = max(
			1,
			absint(
				isset( $default_preset['window_days'] )
					? $default_preset['window_days']
					: $configuration['limits']['default_window_days']
			)
		);
	}

	return $window_request;
}

/**
 * Resolve a signed Timeline return token into an initial window request.
 *
 * A valid signed return context takes precedence. Without one, the configured
 * default preset and scale are returned.
 *
 * @return array<string,mixed> Allow-listed return or default read request.
 */
function wpbc_timeline_get_return_window_request() {
	if ( ! isset( $_GET['wpbc_timeline_return'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only signed navigation context.
		$preferred_request = ( new WPBC_Timeline_Preferences() )->get_initial_window_request();
		if ( ! empty( $preferred_request ) ) {
			return $preferred_request;
		}

		return wpbc_timeline_get_default_window_request();
	}

	$token   = sanitize_text_field( wp_unslash( $_GET['wpbc_timeline_return'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only signed navigation context.
	$payload = ( new WPBC_Timeline_Handoff() )->verify_token( $token, 'timeline_return' );
	if ( is_wp_error( $payload ) || ! is_array( $payload ) ) {
		$preferred_request = ( new WPBC_Timeline_Preferences() )->get_initial_window_request();
		if ( ! empty( $preferred_request ) ) {
			return $preferred_request;
		}

		return wpbc_timeline_get_default_window_request();
	}

	$context = isset( $payload['return_context'] ) && is_array( $payload['return_context'] ) ? $payload['return_context'] : array();
	$anchor  = ! empty( $context['anchor_at'] )
		? sanitize_text_field( (string) $context['anchor_at'] )
		: ( ! empty( $payload['start_at'] ) ? sanitize_text_field( (string) $payload['start_at'] ) : '' );

	return array(
		'anchor_at'     => $anchor,
		'anchor_ratio'  => isset( $context['anchor_ratio'] ) ? (float) $context['anchor_ratio'] : 0.5,
		'view'          => isset( $context['view'] ) ? sanitize_key( (string) $context['view'] ) : '',
		'window_days'   => isset( $context['window_days'] ) ? absint( $context['window_days'] ) : 0,
		'window_months' => isset( $context['window_months'] ) ? absint( $context['window_months'] ) : 0,
	);
}
