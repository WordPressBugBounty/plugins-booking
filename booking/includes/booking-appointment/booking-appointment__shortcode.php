<?php
/**
 * Appointment shortcode registration and public assets.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Read a positive Appointment selector value from the non-JavaScript GET fallback.
 *
 * @param string $key Request key.
 *
 * @return int Selected ID or zero.
 */
function wpbc_booking_appointment_get_fallback_selection( $key ) {
	if ( ! isset( $_GET[ $key ] ) || is_array( $_GET[ $key ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return 0;
	}

	return absint( wp_unslash( $_GET[ $key ] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
}

/**
 * Render the [booking_appointment] Service-first booking workflow.
 *
 * Supported attributes include service_id, provider_id, services, providers,
 * nummonths, startmonth, calendar_dates_start, calendar_dates_end, options,
 * form_type, auto_select_provider, show_progress, progress_item_1_title,
 * progress_item_1_number through progress_item_3_title/progress_item_3_number,
 * screen_1_title, screen_1_description, screen_2_title, screen_2_description,
 * and allow_past. Provider auto-selection is disabled unless
 * auto_select_provider is explicitly enabled. Past bookings are available to
 * public visitors only when allow_past is explicitly enabled by the shortcode.
 *
 * @param mixed $attributes Shortcode attributes.
 *
 * @return string Appointment selector or fixed native booking form.
 */
function wpbc_booking_appointment_shortcode( $attributes = array() ) {
	$config      = wpbc_booking_appointment_normalize_config( $attributes );
	$config['return_url'] = wpbc_booking_appointment_get_fallback_url();
	$service_id  = wpbc_booking_appointment_get_fallback_selection( 'wpbc_appointment_service' );
	$provider_id = wpbc_booking_appointment_get_fallback_selection( 'wpbc_appointment_provider' );
	$result      = wpbc_booking_appointment_resolve_stage( $config, $service_id, $provider_id );

	if ( is_wp_error( $result ) ) {
		$stage_html = wpbc_booking_appointment_render_error_notice( $result );
		$stage      = 'error';
	} else {
		$stage_html = $result['html'];
		$stage      = $result['stage'];
	}

	static $instance_number = 0;
	++$instance_number;
	$instance_id = 'wpbc_booking_appointment_' . $instance_number;
	$html  = '<div id="' . esc_attr( $instance_id ) . '" class="wpbc_booking_appointment" data-appointment-stage="' . esc_attr( $stage ) . '" data-config-token="' . esc_attr( wpbc_booking_appointment_encode_config( $config ) ) . '" aria-busy="false">';
	$html .= '<div class="wpbc_booking_appointment__stage wpbc_booking_ui_theme_scope" aria-live="polite" aria-busy="false">' . $stage_html . '</div>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	$html .= '<div class="wpbc_booking_appointment__loading" role="status" aria-live="polite" hidden aria-hidden="true"><span class="wpbc_booking_appointment__spinner" aria-hidden="true"></span><span>' . esc_html__( 'Loading appointment…', 'booking' ) . '</span></div>';
	$html .= '<div class="wpbc_booking_appointment__ajax_notice wpbc_booking_ui_theme_scope" role="alert" aria-live="assertive" tabindex="-1" hidden></div></div>';

	return (string) apply_filters( 'wpbc_booking_appointment_shortcode_html', $html, $config, $result );
}
add_shortcode( 'booking_appointment', 'wpbc_booking_appointment_shortcode' );

/**
 * Enqueue the Appointment selector controller on public Booking Calendar pages.
 *
 * @param string $where_to_load Booking Calendar asset context.
 *
 * @return void
 */
function wpbc_booking_appointment_enqueue_js( $where_to_load ) {
	if ( ! in_array( $where_to_load, array( 'client', 'both' ), true ) ) {
		return;
	}

	$base_url = trailingslashit( plugins_url( '', __FILE__ ) );
	wp_enqueue_script( 'wpbc-booking-appointment', $base_url . '_out/booking-appointment.js', array( 'jquery', 'wpbc_capacity' ), WP_BK_VERSION_NUM, array( 'in_footer' => WPBC_JS_IN_FOOTER ) );
	wp_localize_script(
		'wpbc-booking-appointment',
		'wpbc_booking_appointment_config',
		array(
			'ajax_url'        => admin_url( 'admin-ajax.php' ),
			'action'          => 'WPBC_AJX_BOOKING_APPOINTMENT_RESOLVE',
			'validate_action' => 'WPBC_AJX_BOOKING_APPOINTMENT_VALIDATE_TIME',
			'nonce'           => wp_create_nonce( 'wpbc_booking_appointment_ajax' ),
			'error'           => __( 'The Appointment form could not be loaded. Please try again.', 'booking' ),
			'validation_error'=> __( 'This Appointment time could not be verified. Please try again.', 'booking' ),
			'initialization_error' => __( 'The Appointment form could not be initialized. Please start over and try again.', 'booking' ),
			'duplicate_provider'   => __( 'This Provider already has an open Appointment form on this page. Complete or restart that Appointment before opening another form for the same Provider.', 'booking' ),
		)
	);
}
add_action( 'wpbc_enqueue_js_files', 'wpbc_booking_appointment_enqueue_js', 72 );

/**
 * Enqueue Appointment selector styling on public Booking Calendar pages.
 *
 * @param string $where_to_load Booking Calendar asset context.
 *
 * @return void
 */
function wpbc_booking_appointment_enqueue_css( $where_to_load ) {
	$is_add_appointment_admin_page = 'admin' === $where_to_load
		&& function_exists( 'wpbc_add_appointment_page_is_active' )
		&& wpbc_add_appointment_page_is_active();

	if ( ! in_array( $where_to_load, array( 'client', 'both' ), true ) && ! $is_add_appointment_admin_page ) {
		return;
	}

	wp_enqueue_style( 'wpbc-booking-appointment', trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/booking-appointment.css', array( 'wpbc-all-client' ), WP_BK_VERSION_NUM );

	$theme_css = wpbc_booking_appointment_build_theme_css();
	if ( '' !== $theme_css && class_exists( 'WPBC_FE_Assets' ) ) {
		WPBC_FE_Assets::add_inline_css_to_wp_style( 'wpbc-booking-appointment', $theme_css, 'booking-appointment-theme' );
	}
}
add_action( 'wpbc_enqueue_css_files', 'wpbc_booking_appointment_enqueue_css', 72 );
