<?php
/**
 * Booking Resource selector shortcode registration and public assets.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Read one resource selection from the non-JavaScript GET fallback.
 *
 * @return int Selected Booking Resource ID or zero.
 */
function wpbc_booking_resource_selector_get_fallback_selection() {
	if ( ! isset( $_GET['wpbc_resource_selector_resource'] ) || is_array( $_GET['wpbc_resource_selector_resource'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return 0;
	}

	return absint( wp_unslash( $_GET['wpbc_resource_selector_resource'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
}

/**
 * Detect an explicit non-JavaScript request to return to Resource selection.
 *
 * @return bool True when the current URL requests the first selector stage.
 */
function wpbc_booking_resource_selector_is_fallback_start_over() {
	if ( ! isset( $_GET['wpbc_resource_selector_start_over'] ) || is_array( $_GET['wpbc_resource_selector_start_over'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return false;
	}

	return '1' === sanitize_text_field( wp_unslash( $_GET['wpbc_resource_selector_start_over'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
}

/**
 * Render the [booking_resource_selector] resource-first booking workflow.
 *
 * @param mixed $attributes Shortcode attributes.
 *
 * @return string Resource selector or selected native Booking Form.
 */
function wpbc_booking_resource_selector_shortcode( $attributes = array() ) {
	$config               = wpbc_booking_resource_selector_normalize_config( $attributes );
	$config['return_url'] = wpbc_booking_resource_selector_get_fallback_url();
	$resource_id          = wpbc_booking_resource_selector_get_fallback_selection();
	$result               = wpbc_booking_resource_selector_resolve_stage( $config, $resource_id, ! wpbc_booking_resource_selector_is_fallback_start_over() );

	if ( is_wp_error( $result ) ) {
		$stage_html = wpbc_booking_resource_selector_render_error_notice( $result );
		$stage      = 'error';
	} else {
		$stage_html = $result['html'];
		$stage      = $result['stage'];
	}

	static $instance_number = 0;
	++$instance_number;
	$instance_id = 'wpbc_booking_resource_selector_' . $instance_number;
	$html        = '<div id="' . esc_attr( $instance_id ) . '" class="wpbc_booking_resource_selector" data-resource-selector-stage="' . esc_attr( $stage ) . '" data-config-token="' . esc_attr( wpbc_booking_resource_selector_encode_config( $config ) ) . '" data-selected-resource-id="' . wpbc_booking_resource_selector_get_default_resource_id( $config ) . '" aria-busy="false">';
	$html       .= '<div class="wpbc_booking_resource_selector__stage wpbc_booking_ui_theme_scope" aria-live="polite" aria-busy="false">' . $stage_html . '</div>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	$html       .= '<div class="wpbc_booking_resource_selector__loading" role="status" aria-live="polite" hidden aria-hidden="true"><span class="wpbc_booking_resource_selector__spinner" aria-hidden="true"></span><span>' . esc_html__( 'Loading booking form...', 'booking' ) . '</span></div>';
	$html       .= '<div class="wpbc_booking_resource_selector__ajax_notice wpbc_booking_ui_theme_scope" role="alert" aria-live="assertive" tabindex="-1" hidden></div></div>';

	return (string) apply_filters( 'wpbc_booking_resource_selector_shortcode_html', $html, $config, $result );
}
add_shortcode( 'booking_resource_selector', 'wpbc_booking_resource_selector_shortcode' );

/**
 * Enqueue the Booking Resource selector controller on public pages.
 *
 * @param string $where_to_load Booking Calendar asset context.
 *
 * @return void
 */
function wpbc_booking_resource_selector_enqueue_js( $where_to_load ) {
	if ( ! in_array( $where_to_load, array( 'client', 'both' ), true ) ) {
		return;
	}

	$base_url = trailingslashit( plugins_url( '', __FILE__ ) );
	wp_enqueue_script( 'wpbc-booking-resource-selector', $base_url . '_out/booking-resource-selector.js', array( 'jquery', 'wpbc_capacity' ), WP_BK_VERSION_NUM, array( 'in_footer' => WPBC_JS_IN_FOOTER ) );
	wp_localize_script(
		'wpbc-booking-resource-selector',
		'wpbc_booking_resource_selector_config',
		array(
			'ajax_url'             => admin_url( 'admin-ajax.php' ),
			'action'               => 'WPBC_AJX_BOOKING_RESOURCE_SELECTOR_RESOLVE',
			'nonce'                => wp_create_nonce( 'wpbc_booking_resource_selector_ajax' ),
			'error'                => __( 'The booking form could not be loaded. Please try again.', 'booking' ),
			'initialization_error' => __( 'The booking form could not be initialized. Please start over and try again.', 'booking' ),
			'duplicate_resource'   => __( 'This Booking Resource already has an open booking form on this page. Complete or restart that booking before opening another form for the same resource.', 'booking' ),
		)
	);
}
add_action( 'wpbc_enqueue_js_files', 'wpbc_booking_resource_selector_enqueue_js', 73 );

/**
 * Enqueue Booking Resource selector styling on public pages.
 *
 * @param string $where_to_load Booking Calendar asset context.
 *
 * @return void
 */
function wpbc_booking_resource_selector_enqueue_css( $where_to_load ) {
	if ( ! in_array( $where_to_load, array( 'client', 'both' ), true ) ) {
		return;
	}

	wp_enqueue_style( 'wpbc-booking-resource-selector', trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/booking-resource-selector.css', array( 'wpbc-all-client' ), WP_BK_VERSION_NUM );

	$theme_css = wpbc_booking_resource_selector_build_theme_css();
	if ( '' !== $theme_css && class_exists( 'WPBC_FE_Assets' ) ) {
		WPBC_FE_Assets::add_inline_css_to_wp_style( 'wpbc-booking-resource-selector', $theme_css, 'booking-resource-selector-theme' );
	}
}
add_action( 'wpbc_enqueue_css_files', 'wpbc_booking_resource_selector_enqueue_css', 73 );
