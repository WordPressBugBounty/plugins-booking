<?php
/**
 * Server-side Booking Resource selection and native form rendering.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build the form action used by the non-JavaScript selection fallback.
 *
 * @param array<string,mixed> $config Selector configuration containing the
 *                                    original public URL during AJAX.
 *
 * @return string Public URL without selector query parameters.
 */
function wpbc_booking_resource_selector_get_fallback_url( $config = array() ) {
	$fallback_url = ! empty( $config['return_url'] ) ? esc_url_raw( $config['return_url'] ) : '';
	if ( ! $fallback_url ) {
		$request_uri  = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( (string) $_SERVER['REQUEST_URI'] ) : '/'; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$fallback_url = home_url( $request_uri );
	}
	$fallback_url = remove_query_arg( array( 'wpbc_resource_selector_resource', 'wpbc_resource_selector_start_over' ), $fallback_url );

	return wp_validate_redirect( $fallback_url, home_url( '/' ) );
}

/**
 * Build a non-JavaScript URL that explicitly returns to Resource selection.
 *
 * @param array<string,mixed> $config Selector configuration.
 *
 * @return string Validated public Start over URL.
 */
function wpbc_booking_resource_selector_get_start_over_url( $config = array() ) {
	return add_query_arg( 'wpbc_resource_selector_start_over', '1', wpbc_booking_resource_selector_get_fallback_url( $config ) );
}

/**
 * Render the two-step Booking Resource selection progress indicator.
 *
 * @param int                 $active_step Current step from 1 to 2.
 * @param array<string,mixed> $config      Normalized selector configuration.
 *
 * @return string Progress markup, or an empty string when disabled.
 */
function wpbc_booking_resource_selector_render_progress( $active_step, $config = array() ) {
	if ( isset( $config['show_progress'] ) && ! $config['show_progress'] ) {
		return '';
	}

	$steps = array(
		1 => array(
			'number' => isset( $config['progress_item_1_number'] ) ? $config['progress_item_1_number'] : '1',
			'title'  => isset( $config['progress_item_1_title'] ) ? $config['progress_item_1_title'] : __( 'Resource', 'booking' ),
		),
		2 => array(
			'number' => isset( $config['progress_item_2_number'] ) ? $config['progress_item_2_number'] : '2',
			'title'  => isset( $config['progress_item_2_title'] ) ? $config['progress_item_2_title'] : __( 'Date & Details', 'booking' ),
		),
	);
	$html  = '<ol class="wpbc_booking_resource_selector__progress" aria-label="' . esc_attr__( 'Booking progress', 'booking' ) . '">';
	foreach ( $steps as $step_number => $step ) {
		$step_class = $step_number < $active_step ? ' is-complete' : ( $step_number === $active_step ? ' is-active' : '' );
		$html      .= '<li class="wpbc_booking_resource_selector__progress_step' . esc_attr( $step_class ) . '"' . ( $step_number === $active_step ? ' aria-current="step"' : '' ) . '>';
		$html      .= '<span class="wpbc_booking_resource_selector__progress_number">' . esc_html( $step['number'] ) . '</span><span class="wpbc_booking_resource_selector__progress_label">' . esc_html( $step['title'] ) . '</span></li>';
	}
	$html .= '</ol>';

	return $html;
}

/**
 * Render the configurable Booking Resource screen heading.
 *
 * Omitted values use translated defaults. Explicit empty values hide their
 * element, preserving the same omitted-versus-empty contract as Appointments.
 *
 * @param array<string,mixed> $config              Normalized configuration.
 * @param string              $default_title       Translated default title.
 * @param string              $default_description Translated default description.
 *
 * @return string Escaped heading markup, or an empty string.
 */
function wpbc_booking_resource_selector_render_screen_heading( $config, $default_title, $default_description ) {
	$screen_title       = isset( $config['screen_1_title'] ) ? $config['screen_1_title'] : $default_title;
	$screen_description = isset( $config['screen_1_description'] ) ? $config['screen_1_description'] : $default_description;
	if ( '' === $screen_title && '' === $screen_description ) {
		return '';
	}

	$html = '<div class="wpbc_booking_resource_selector__heading">';
	if ( '' !== $screen_title ) {
		$html .= '<h3>' . esc_html( $screen_title ) . '</h3>';
	}
	if ( '' !== $screen_description ) {
		$html .= '<p>' . esc_html( $screen_description ) . '</p>';
	}
	$html .= '</div>';

	return $html;
}

/**
 * Render a consistent public selector notice.
 *
 * @param string $message Notice text.
 * @param string $type    Notice type, such as error or empty.
 *
 * @return string Escaped notice markup.
 */
function wpbc_booking_resource_selector_render_notice( $message, $type = 'error' ) {
	return '<div class="wpbc_booking_resource_selector__notice wpbc_booking_resource_selector__notice--' . esc_attr( sanitize_html_class( $type ) ) . '" role="status" tabindex="-1"><span>' . esc_html( $message ) . '</span></div>';
}

/**
 * Render a structured selector error without allowing arbitrary HTML.
 *
 * @param WP_Error $error Selector workflow error.
 *
 * @return string Escaped notice markup.
 */
function wpbc_booking_resource_selector_render_error_notice( $error ) {
	return wpbc_booking_resource_selector_render_notice( $error->get_error_message(), 'error' );
}

/**
 * Build a compact two-letter fallback for a Booking Resource image.
 *
 * @param string $resource_title Public Booking Resource title.
 *
 * @return string Uppercase one- or two-letter fallback.
 */
function wpbc_booking_resource_selector_get_resource_initials( $resource_title ) {
	$initials = '';
	$words    = array_slice( array_filter( preg_split( '/\s+/u', trim( wp_strip_all_tags( (string) $resource_title ) ) ) ), 0, 2 );
	foreach ( $words as $word ) {
		$initials .= function_exists( 'mb_substr' ) ? mb_substr( $word, 0, 1 ) : substr( $word, 0, 1 );
	}

	if ( '' === $initials ) {
		$initials = 'R';
	}

	return function_exists( 'mb_strtoupper' ) ? mb_strtoupper( $initials ) : strtoupper( $initials );
}

/**
 * Render the Booking Resource choice stage.
 *
 * @param array<int,array<string,mixed>> $catalog      Public resource catalogue.
 * @param string                         $config_token Signed AJAX configuration.
 * @param array<string,mixed>            $config       Selector configuration.
 *
 * @return string Resource picker markup.
 */
function wpbc_booking_resource_selector_render_resources( $catalog, $config_token, $config = array() ) {
	if ( empty( $catalog ) ) {
		return wpbc_booking_resource_selector_render_notice( __( 'No Booking Resources are currently available.', 'booking' ), 'empty' );
	}

	$selected_resource_id = wpbc_booking_resource_selector_get_default_resource_id( $config );
	$html                 = wpbc_booking_resource_selector_render_progress( 1, $config );
	$html                .= wpbc_booking_resource_selector_render_screen_heading( $config, __( 'Choose a Booking Resource', 'booking' ), __( 'Select what you would like to book.', 'booking' ) );
	$html                .= '<form class="wpbc_booking_resource_selector__selection_form" method="get" action="' . esc_url( wpbc_booking_resource_selector_get_fallback_url( $config ) ) . '">';
	$html                .= '<div class="wpbc_booking_resource_selector__choices" role="radiogroup" aria-label="' . esc_attr__( 'Booking Resources', 'booking' ) . '">';
	foreach ( $catalog as $resource ) {
		$resource_id = absint( $resource['resource_id'] );
		$input_id    = 'wpbc_resource_selector_' . $resource_id . '_' . wp_rand( 1000, 9999 );
		$is_selected = $resource_id === $selected_resource_id;
		$html       .= '<label class="wpbc_booking_resource_selector__choice' . ( $is_selected ? ' is-selected' : '' ) . '" for="' . esc_attr( $input_id ) . '">';
		$html       .= '<input id="' . esc_attr( $input_id ) . '" type="radio" name="wpbc_resource_selector_resource" value="' . $resource_id . '"' . checked( $is_selected, true, false ) . ' required>';
		$html       .= '<span class="wpbc_booking_resource_selector__resource_icon" aria-hidden="true">';
		if ( ! empty( $resource['image_url'] ) ) {
			$html .= '<img src="' . esc_url( $resource['image_url'] ) . '" alt="" loading="lazy" decoding="async">';
		} else {
			$html .= esc_html( wpbc_booking_resource_selector_get_resource_initials( $resource['title'] ) );
		}
		$html .= '</span>';
		$html       .= '<span class="wpbc_booking_resource_selector__choice_body"><strong>' . esc_html( $resource['title'] ) . '</strong>';
		if ( ! empty( $resource['description'] ) ) {
			$html .= '<span class="wpbc_booking_resource_selector__choice_description">' . esc_html( $resource['description'] ) . '</span>';
		}
		$html .= '</span><span class="wpbc_booking_resource_selector__choice_mark" aria-hidden="true"></span></label>';
	}
	$html .= '</div><input type="hidden" name="wpbc_resource_selector_config" value="' . esc_attr( $config_token ) . '">';
	$html .= '<div class="wpbc_booking_resource_selector__actions"><button type="submit" class="wpbc_button wpbc_button_primary wpbc_booking_resource_selector__continue">' . esc_html__( 'Continue', 'booking' ) . '</button></div></form>';

	return $html;
}

/**
 * Resolve the published Booking Form slug for one selected resource.
 *
 * An explicit form_type wins. Otherwise the established resource-specific
 * default form filter is used, followed by the standard form.
 *
 * @param int                 $resource_id Selected Booking Resource ID.
 * @param array<string,mixed> $config      Selector configuration.
 *
 * @return string Safe Booking Form slug.
 */
function wpbc_booking_resource_selector_resolve_form_slug( $resource_id, $config ) {
	$form_slug = ! empty( $config['form_type'] ) ? sanitize_text_field( $config['form_type'] ) : '';
	if ( '' === $form_slug ) {
		$form_slug = sanitize_text_field( (string) apply_bk_filter( 'wpbc_get_default_custom_form', '', absint( $resource_id ) ) );
	}
	if ( '' === $form_slug ) {
		$form_slug = 'standard';
	}

	$form_slug = apply_filters( 'wpbc_booking_resource_selector_form_slug', $form_slug, absint( $resource_id ), $config );

	return sanitize_text_field( (string) $form_slug );
}

/**
 * Build the native aggregate resource expression for one primary resource.
 *
 * @param int                 $resource_id Primary Booking Resource ID.
 * @param array<string,mixed> $config      Selector configuration.
 *
 * @return string Primary ID or a semicolon-delimited aggregate expression.
 */
function wpbc_booking_resource_selector_get_render_resource_id( $resource_id, $config ) {
	$resource_id   = absint( $resource_id );
	$aggregate_ids = array_values( array_diff( wpbc_booking_resource_selector_normalize_ids( $config['aggregate_resource_ids'] ), array( $resource_id ) ) );

	return implode( ';', array_merge( array( $resource_id ), $aggregate_ids ) );
}

/**
 * Render one native Booking Calendar form for the selected resource.
 *
 * @param array<string,mixed> $resource_record     Selected public resource.
 * @param array<string,mixed> $config              Selector configuration.
 * @param string              $config_token        Signed AJAX configuration.
 * @param bool                $can_change_resource Whether another Resource can be selected.
 *
 * @return string|WP_Error Native form markup or a controlled error.
 */
function wpbc_booking_resource_selector_render_booking_form( $resource_record, $config, $config_token, $can_change_resource = false ) {
	$resource_id = absint( $resource_record['resource_id'] );
	$form_slug   = wpbc_booking_resource_selector_resolve_form_slug( $resource_id, $config );
	$allow_past  = wpbc_booking_resource_selector_is_past_booking_enabled( $config );

	static $rendered_resource_ids = array();
	if ( isset( $rendered_resource_ids[ $resource_id ] ) ) {
		return new WP_Error( 'resource_selector_duplicate_form', __( 'This Booking Resource already has an open booking form on this page. Complete or restart that booking before opening another form for the same resource.', 'booking' ) );
	}
	$rendered_resource_ids[ $resource_id ] = true;

	$render_params = array(
		'is_echo'                         => 0,
		'resource_id'                     => wpbc_booking_resource_selector_get_render_resource_id( $resource_id, $config ),
		'cal_count'                       => absint( $config['cal_count'] ),
		'custom_booking_form'             => $form_slug,
		'selected_dates_without_calendar' => $config['selected_dates'],
		'shortcode_param__options'        => $config['options'],
		'calendar_dates_start'            => $config['calendar_dates_start'],
		'calendar_dates_end'              => $config['calendar_dates_end'],
		'calendar_request_overrides'      => array(
			'allow_past' => $allow_past ? 1 : 0,
		),
	);
	if ( ! empty( $config['start_month_calendar'] ) && is_array( $config['start_month_calendar'] ) ) {
		$render_params['start_month_calendar'] = array(
			absint( $config['start_month_calendar'][0] ),
			absint( $config['start_month_calendar'][1] ),
		);
	}

	$form_html          = WPBC_FE_Render::render_booking_form( $render_params );
	$submission_context = wpbc_booking_resource_selector_encode_submission_context( $config, $resource_id );
	$summary_label      = wpbc_frontend_messages__get( 'message_resource_selector_summary_label', array(), $resource_id );
	$start_over_label   = wpbc_frontend_messages__get( 'message_resource_selector_start_over', array(), $resource_id );
	$html               = wpbc_booking_resource_selector_render_progress( 2, $config );
	$html              .= '<div class="wpbc_booking_resource_selector__booking_header"><div><span>' . esc_html( $summary_label ) . '</span><strong>' . esc_html( $resource_record['title'] ) . '</strong></div>';
	if ( $can_change_resource ) {
		$html .= '<a class="wpbc_button wpbc_button_secondary wpbc_booking_resource_selector__change" data-wpbc-resource-selector-action="start-over" href="' . esc_url( wpbc_booking_resource_selector_get_start_over_url( $config ) ) . '">' . esc_html( $start_over_label ) . '</a>';
	}
	$html .= '</div>';
	$html .= '<div class="wpbc_booking_resource_selector__native_form" data-resource-id="' . $resource_id . '" data-resource-title="' . esc_attr( $resource_record['title'] ) . '" data-form-slug="' . esc_attr( $form_slug ) . '" data-config-token="' . esc_attr( $config_token ) . '" data-resource-selector-context-token="' . esc_attr( $submission_context ) . '" data-allow-past="' . ( $allow_past ? '1' : '0' ) . '">';
	$html .= $form_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	$html .= '</div>';

	return $html;
}

/**
 * Resolve and render the current Booking Resource selector stage.
 *
 * @param array<string,mixed> $config            Normalized selector configuration.
 * @param int                 $resource_id       Selected Booking Resource ID.
 * @param bool                $allow_auto_select Whether this request may skip Resource selection.
 *
 * @return array{stage:string,html:string,resource_id:int}|WP_Error Stage response or validation error.
 */
function wpbc_booking_resource_selector_resolve_stage( $config, $resource_id = 0, $allow_auto_select = true ) {
	$config       = wpbc_booking_resource_selector_normalize_config( $config );
	$config_token = wpbc_booking_resource_selector_encode_config( $config );
	$catalog      = wpbc_booking_resource_selector_get_catalog( $config );
	$resource_id  = absint( $resource_id );

	if ( ! $resource_id && $allow_auto_select && $config['auto_select_resource'] ) {
		$default_resource_id = wpbc_booking_resource_selector_get_default_resource_id( $config );
		if ( $default_resource_id && isset( $catalog[ $default_resource_id ] ) ) {
			$resource_id = $default_resource_id;
		}
		if ( ! $resource_id && 1 === count( $catalog ) ) {
			$resource_id = absint( key( $catalog ) );
		}
	}
	if ( ! $resource_id ) {
		return array(
			'stage'       => 'resource',
			'html'        => wpbc_booking_resource_selector_render_resources( $catalog, $config_token, $config ),
			'resource_id' => 0,
		);
	}

	$resource = wpbc_booking_resource_selector_get_resource( $catalog, $resource_id );
	if ( is_wp_error( $resource ) ) {
		return $resource;
	}
	$form_html = wpbc_booking_resource_selector_render_booking_form( $resource, $config, $config_token, count( $catalog ) > 1 );
	if ( is_wp_error( $form_html ) ) {
		return $form_html;
	}

	return array(
		'stage'       => 'booking',
		'html'        => $form_html,
		'resource_id' => absint( $resource['resource_id'] ),
	);
}
