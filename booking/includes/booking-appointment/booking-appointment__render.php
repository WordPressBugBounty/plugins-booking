<?php
/**
 * Server-side Appointment selector and native booking-form rendering.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return a compact human-readable duration.
 *
 * @param int $minutes Duration in minutes.
 *
 * @return string Localized duration.
 */
function wpbc_booking_appointment_format_duration( $minutes ) {
	$minutes = absint( $minutes );
	$hours   = (int) floor( $minutes / 60 );
	$rest    = $minutes % 60;
	$parts   = array();
	if ( $hours ) {
		$parts[] = sprintf( _n( '%d hour', '%d hours', $hours, 'booking' ), $hours );
	}
	if ( $rest || ! $hours ) {
		$parts[] = sprintf( _n( '%d minute', '%d minutes', $rest, 'booking' ), $rest );
	}

	return implode( ' ', $parts );
}

/**
 * Return a clear duration summary before a Provider is selected.
 *
 * @param array<string,mixed> $service Public Service definition.
 *
 * @return string One duration or a Provider-dependent explanation.
 */
function wpbc_booking_appointment_get_duration_summary( $service ) {
	$durations = array();
	foreach ( (array) ( isset( $service['provider_rules'] ) ? $service['provider_rules'] : array() ) as $rules ) {
		if ( ! empty( $rules['duration_minutes'] ) ) {
			$durations[] = absint( $rules['duration_minutes'] );
		}
	}
	$durations = array_values( array_unique( $durations ) );
	if ( count( $durations ) > 1 ) {
		return __( 'Duration varies by Provider', 'booking' );
	}

	$duration_minutes = $durations ? reset( $durations ) : absint( $service['duration_minutes'] );

	return wpbc_booking_appointment_format_duration( $duration_minutes );
}

/**
 * Return a clear price summary before a Provider is selected.
 *
 * @param array<string,mixed> $service Public Service definition.
 *
 * @return string One price, a Provider-dependent explanation, or empty text.
 */
function wpbc_booking_appointment_get_cost_summary( $service ) {
	$costs = array();
	foreach ( (array) ( isset( $service['provider_rules'] ) ? $service['provider_rules'] : array() ) as $rules ) {
		if ( isset( $rules['base_cost'] ) && is_numeric( $rules['base_cost'] ) ) {
			$costs[] = number_format( (float) $rules['base_cost'], 2, '.', '' );
		}
	}
	$costs = array_values( array_unique( $costs ) );
	if ( count( $costs ) > 1 ) {
		return __( 'Price varies by Provider', 'booking' );
	}

	$cost = $costs ? reset( $costs ) : ( isset( $service['base_cost'] ) ? $service['base_cost'] : '' );
	$resource_id = ! empty( $service['resource_ids'] ) ? absint( reset( $service['resource_ids'] ) ) : 0;

	return function_exists( 'wpbc_booking_appointment_format_service_cost_text' )
		? wpbc_booking_appointment_format_service_cost_text( $cost, $resource_id )
		: '';
}

/**
 * Join non-empty Appointment summary fragments with a stable separator.
 *
 * @param array<int,string> $parts Summary fragments.
 *
 * @return string Joined summary.
 */
function wpbc_booking_appointment_join_summary_parts( $parts ) {
	$parts = array_values( array_filter( array_map( 'trim', $parts ) ) );

	return implode( ' · ', $parts );
}

/**
 * Build the form action used only by the non-JavaScript fallback.
 *
 * @param array<string,mixed> $config Appointment configuration containing the
 *                                    original public page URL during AJAX.
 *
 * @return string Public URL without Appointment selector query parameters.
 */
function wpbc_booking_appointment_get_fallback_url( $config = array() ) {
	$url = ! empty( $config['return_url'] ) ? esc_url_raw( $config['return_url'] ) : '';
	if ( ! $url ) {
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( (string) $_SERVER['REQUEST_URI'] ) : '/'; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$url         = home_url( $request_uri );
	}
	$url = remove_query_arg( array( 'wpbc_appointment_service', 'wpbc_appointment_provider' ), $url );

	return wp_validate_redirect( $url, home_url( '/' ) );
}

/**
 * Render the three-step progress indicator.
 *
 * @param int                 $active_step Current step from 1 to 3.
 * @param array<string,mixed> $config      Normalized Appointment configuration.
 *
 * @return string Progress markup, or an empty string when disabled.
 */
function wpbc_booking_appointment_render_progress( $active_step, $config = array() ) {
	if ( isset( $config['show_progress'] ) && ! $config['show_progress'] ) {
		return '';
	}

	$steps = array(
		1 => array(
			'number' => isset( $config['progress_item_1_number'] ) ? $config['progress_item_1_number'] : '1',
			'title'  => isset( $config['progress_item_1_title'] ) ? $config['progress_item_1_title'] : __( 'Service', 'booking' ),
		),
		2 => array(
			'number' => isset( $config['progress_item_2_number'] ) ? $config['progress_item_2_number'] : '2',
			'title'  => isset( $config['progress_item_2_title'] ) ? $config['progress_item_2_title'] : __( 'Provider', 'booking' ),
		),
		3 => array(
			'number' => isset( $config['progress_item_3_number'] ) ? $config['progress_item_3_number'] : '3',
			'title'  => isset( $config['progress_item_3_title'] ) ? $config['progress_item_3_title'] : __( 'Date & Details', 'booking' ),
		),
	);
	$html  = '<ol class="wpbc_booking_appointment__progress" aria-label="' . esc_attr__( 'Appointment booking progress', 'booking' ) . '">';
	foreach ( $steps as $step_number => $step ) {
		$class = $step_number < $active_step ? ' is-complete' : ( $step_number === $active_step ? ' is-active' : '' );
		$html .= '<li class="wpbc_booking_appointment__progress_step' . esc_attr( $class ) . '"' . ( $step_number === $active_step ? ' aria-current="step"' : '' ) . '>';
		$html .= '<span class="wpbc_booking_appointment__progress_number">' . esc_html( $step['number'] ) . '</span><span class="wpbc_booking_appointment__progress_label">' . esc_html( $step['title'] ) . '</span></li>';
	}
	$html .= '</ol>';

	return $html;
}

/**
 * Render a configurable Appointment screen heading.
 *
 * Omitted title or description parameters use translated defaults. Explicitly
 * empty values hide only that element, while two empty values remove the
 * heading wrapper completely.
 *
 * @param array<string,mixed> $config              Normalized Appointment configuration.
 * @param int                 $screen_number       One-based Appointment screen number.
 * @param string              $default_title       Translated default screen title.
 * @param string              $default_description Translated default screen description.
 *
 * @return string Escaped heading markup, or an empty string when both values are empty.
 */
function wpbc_booking_appointment_render_screen_heading( $config, $screen_number, $default_title, $default_description ) {
	$screen_number = absint( $screen_number );
	if ( ! $screen_number ) {
		return '';
	}

	$title_key       = 'screen_' . $screen_number . '_title';
	$description_key = 'screen_' . $screen_number . '_description';
	$title           = isset( $config[ $title_key ] ) ? $config[ $title_key ] : $default_title;
	$description     = isset( $config[ $description_key ] ) ? $config[ $description_key ] : $default_description;

	if ( '' === $title && '' === $description ) {
		return '';
	}

	$html = '<div class="wpbc_booking_appointment__heading">';
	if ( '' !== $title ) {
		$html .= '<h3>' . esc_html( $title ) . '</h3>';
	}
	if ( '' !== $description ) {
		$html .= '<p>' . esc_html( $description ) . '</p>';
	}
	$html .= '</div>';

	return $html;
}

/**
 * Check whether the released frontend catalog presentation is available.
 *
 * The Appointment workflow remains fully usable with its legacy card grid when
 * the 11.6 feature set is disabled. This keeps the release gate aligned with
 * the Resource Selector catalog and its shortcode popup controls.
 *
 * @return bool True when Appointment catalog presentation may be used.
 */
function wpbc_booking_appointment_is_catalog_enabled() {
	return function_exists( 'wpbc_is_11_6_features_enabled' ) && wpbc_is_11_6_features_enabled();
}

/**
 * Prepare Appointment presentation values for the active feature state.
 *
 * Stored or manually authored 11.6 catalog values remain harmless when the
 * feature is disabled: the compatibility renderer uses its established visible
 * card content and ignores all new presentation toggles.
 *
 * @param array<string,mixed> $config Raw or normalized Appointment configuration.
 *
 * @return array<string,mixed> Normalized render configuration.
 */
function wpbc_booking_appointment_get_catalog_render_config( $config ) {
	$config = wpbc_booking_appointment_normalize_config( $config );
	if ( wpbc_booking_appointment_is_catalog_enabled() ) {
		return $config;
	}

	foreach ( array( 'show_resource_image', 'show_resource_title', 'show_resource_description', 'show_resource_hierarchy', 'show_availability', 'show_starting_price' ) as $visible_config_key ) {
		$config[ $visible_config_key ] = true;
	}

	return $config;
}

/**
 * Return a grid track width that accounts for catalog gaps.
 *
 * @param string $item_width Normalized catalog item width.
 *
 * @return string Safe CSS grid track width.
 */
function wpbc_booking_appointment_get_catalog_track_width( $item_width ) {
	if ( ! preg_match( '/^(\d+(?:\.\d+)?)%$/', $item_width, $matches ) ) {
		return $item_width;
	}

	$percentage_width  = (float) $matches[1];
	$estimated_columns = max( 1, (int) floor( ( 100 + 0.0001 ) / $percentage_width ) );
	if ( $estimated_columns <= 1 ) {
		return $item_width;
	}

	$gap_adjustment = 10 * ( $estimated_columns - 1 ) / $estimated_columns;
	$gap_adjustment = rtrim( rtrim( number_format( $gap_adjustment, 4, '.', '' ), '0' ), '.' );

	return 'calc(' . $item_width . ' - ' . $gap_adjustment . 'px)';
}

/**
 * Render the opening markup for a selectable Service or Provider catalog.
 *
 * @param array<string,mixed> $config       Normalized Appointment configuration.
 * @param string              $catalog_type Either services or providers.
 * @param int                 $item_count   Number of authorized catalog items.
 *
 * @return string Escaped catalog opening markup, including an optional search field.
 */
function wpbc_booking_appointment_render_catalog_open( $config, $catalog_type, $item_count ) {
	$catalog_type = 'providers' === $catalog_type ? 'providers' : 'services';
	$is_provider  = 'providers' === $catalog_type;
	$layout       = 'list' === $config['catalog_layout'] ? 'list' : 'grid';
	$column_count = 'list' === $layout ? absint( $config['catalog_list_items_per_row'] ) : absint( $config['catalog_grid_items_per_row'] );
	$column_count = min( 12, $column_count );
	$item_width   = wpbc_booking_appointment_normalize_css_width( $config['catalog_item_width'] );
	$catalog_class = 'wpbc_booking_appointment__catalog wpbc_booking_appointment__catalog--' . $layout;
	$catalog_styles = array();

	if ( empty( $config['show_resource_image'] ) ) {
		$catalog_class .= ' wpbc_booking_appointment__catalog--without-images';
	}
	if ( absint( $config['catalog_item_max_width'] ) > 0 ) {
		$catalog_class .= ' wpbc_booking_appointment__catalog--bounded';
		$catalog_styles[] = '--wpbc-appointment-catalog-item-max-width:' . min( 1200, max( 280, absint( $config['catalog_item_max_width'] ) ) ) . 'px';
	}
	if ( $column_count > 0 ) {
		$catalog_class .= ' wpbc_booking_appointment__catalog--explicit-columns wpbc_booking_appointment__catalog--columns-' . $column_count;
		$catalog_styles[] = '--wpbc-appointment-catalog-items-per-row:' . $column_count;
	} elseif ( '' !== $item_width ) {
		$catalog_class .= ' wpbc_booking_appointment__catalog--explicit-item-width';
		$catalog_styles[] = '--wpbc-appointment-catalog-item-width:' . $item_width;
		$catalog_styles[] = '--wpbc-appointment-catalog-item-track-width:' . wpbc_booking_appointment_get_catalog_track_width( $item_width );
	}

	$catalog_style = empty( $catalog_styles ) ? '' : ' style="' . esc_attr( implode( ';', $catalog_styles ) . ';' ) . '"';
	$catalog_label = $is_provider ? __( 'Providers', 'booking' ) : __( 'Services', 'booking' );
	$filter_label  = $is_provider ? __( 'Filter Providers', 'booking' ) : __( 'Filter Services', 'booking' );
	$search_label  = $is_provider ? __( 'Search Providers', 'booking' ) : __( 'Search Services', 'booking' );
	$html          = '<div class="' . esc_attr( $catalog_class ) . '" data-wpbc-appointment-catalog="" data-catalog-type="' . esc_attr( $catalog_type ) . '" data-layout="' . esc_attr( $layout ) . '"' . $catalog_style . '>';

	if ( ! empty( $config['show_resource_filters'] ) && absint( $item_count ) > 1 ) {
		$filter_id = wp_unique_id( 'wpbc_appointment_catalog_search_' );
		$html     .= '<div class="wpbc_booking_appointment__catalog_filters" role="search" aria-label="' . esc_attr( $filter_label ) . '">';
		$html     .= '<label class="wpbc_booking_appointment__catalog_search" for="' . esc_attr( $filter_id ) . '"><span class="screen-reader-text">' . esc_html( $search_label ) . '</span><input id="' . esc_attr( $filter_id ) . '" type="search" placeholder="' . esc_attr( $search_label ) . '" data-wpbc-appointment-catalog-search="" autocomplete="off"></label>';
		$html     .= '</div>';
	}

	$html .= '<div class="wpbc_booking_appointment__choices wpbc_booking_appointment__catalog_items" role="radiogroup" aria-label="' . esc_attr( $catalog_label ) . '" data-wpbc-appointment-catalog-items="">';

	return $html;
}

/**
 * Render the closing markup and accessible empty state for one catalog.
 *
 * @param string $catalog_type Either services or providers.
 *
 * @return string Escaped catalog closing markup.
 */
function wpbc_booking_appointment_render_catalog_close( $catalog_type ) {
	$is_provider = 'providers' === $catalog_type;
	$empty_label = $is_provider ? __( 'No Providers match your search.', 'booking' ) : __( 'No Services match your search.', 'booking' );

	return '</div><p class="wpbc_booking_appointment__catalog_empty" data-wpbc-appointment-catalog-empty="" role="status" hidden>' . esc_html( $empty_label ) . '</p><p class="screen-reader-text" data-wpbc-appointment-catalog-status="" aria-live="polite"></p></div>';
}

/**
 * Render the Service choice stage.
 *
 * @param array<string,mixed> $catalog Public catalogue.
 * @param string              $config_token Signed AJAX configuration.
 * @param array<string,mixed> $config       Appointment configuration.
 *
 * @return string Service picker markup.
 */
function wpbc_booking_appointment_render_services( $catalog, $config_token, $config = array() ) {
	if ( empty( $catalog['services'] ) ) {
		$provider_count = isset( $catalog['diagnostics']['provider_count'] ) ? absint( $catalog['diagnostics']['provider_count'] ) : 0;
		$message        = $provider_count
			? __( 'No Services are currently available.', 'booking' )
			: __( 'No Providers are currently available.', 'booking' );
		if ( current_user_can( wpbc_appointment_services_get_manage_capability() ) ) {
			$message .= $provider_count
				? ' ' . __( 'Activate a Service and assign at least one Provider to it.', 'booking' )
				: ' ' . __( 'Create a Provider, then assign it to an active Service.', 'booking' );
		}

		return wpbc_booking_appointment_render_notice( $message, 'empty' );
	}

	$config          = wpbc_booking_appointment_get_catalog_render_config( $config );
	$catalog_enabled = wpbc_booking_appointment_is_catalog_enabled();
	$html  = wpbc_booking_appointment_render_progress( 1, $config );
	$html .= wpbc_booking_appointment_render_screen_heading( $config, 1, __( 'Choose a Service', 'booking' ), __( 'Select what you would like to book.', 'booking' ) );
	$html .= '<form class="wpbc_booking_appointment__selection_form" method="get" action="' . esc_url( wpbc_booking_appointment_get_fallback_url( $config ) ) . '" data-appointment-stage="service">';
	$html .= $catalog_enabled
		? wpbc_booking_appointment_render_catalog_open( $config, 'services', count( $catalog['services'] ) )
		: '<div class="wpbc_booking_appointment__choices" role="radiogroup" aria-label="' . esc_attr__( 'Services', 'booking' ) . '">';
	foreach ( $catalog['services'] as $service ) {
		$service_id    = absint( $service['service_id'] );
		$input_id      = 'wpbc_appointment_service_' . $service_id . '_' . wp_rand( 1000, 9999 );
		$search_text   = wp_strip_all_tags( (string) $service['title'] . ' ' . (string) $service['description'] );
		$choice_class  = 'wpbc_booking_appointment__choice wpbc_booking_appointment__choice--service';
		$choice_attrs  = '';
		if ( $catalog_enabled ) {
			$choice_class .= ' wpbc_booking_appointment__catalog_card';
			if ( ! empty( $config['show_resource_image'] ) && empty( $service['picture_url'] ) ) {
				$choice_class .= ' wpbc_booking_appointment__catalog_card--without-image';
			}
			$choice_attrs  = ' data-wpbc-appointment-catalog-card="" data-appointment-catalog-search="' . esc_attr( $search_text ) . '"';
		}
		$html .= '<label class="' . esc_attr( $choice_class ) . '" for="' . esc_attr( $input_id ) . '"' . $choice_attrs . ' data-summary-service="' . esc_attr( $service['title'] ) . '" data-summary-duration="' . esc_attr( wpbc_booking_appointment_get_duration_summary( $service ) ) . '" data-summary-price="' . esc_attr( wpbc_booking_appointment_get_cost_summary( $service ) ) . '" data-summary-buffer-before="' . absint( isset( $service['buffer_before_minutes'] ) ? $service['buffer_before_minutes'] : 0 ) . '" data-summary-buffer-after="' . absint( isset( $service['buffer_after_minutes'] ) ? $service['buffer_after_minutes'] : 0 ) . '">';
		$html      .= '<input id="' . esc_attr( $input_id ) . '" type="radio" name="wpbc_appointment_service" value="' . $service_id . '" required>';
		if ( ! empty( $config['show_resource_image'] ) && ! empty( $service['picture_url'] ) ) {
			$html .= '<span class="wpbc_booking_appointment__service_image" aria-hidden="true"><img src="' . esc_url( $service['picture_url'] ) . '" alt="" loading="lazy" decoding="async"></span>';
		}
		$html .= '<span class="wpbc_booking_appointment__choice_body">';
		$html .= ! empty( $config['show_resource_title'] )
			? '<strong>' . esc_html( $service['title'] ) . '</strong>'
			: '<span class="screen-reader-text">' . esc_html( $service['title'] ) . '</span>';
		$service_summary = wpbc_booking_appointment_join_summary_parts(
			array(
				wpbc_booking_appointment_get_duration_summary( $service ),
				! empty( $config['show_starting_price'] ) ? wpbc_booking_appointment_get_cost_summary( $service ) : '',
			)
		);
		$html      .= '<span class="wpbc_booking_appointment__choice_meta">' . esc_html( $service_summary ) . '</span>';
		if ( ! empty( $config['show_resource_description'] ) && ! empty( $service['description'] ) ) {
			$html .= '<span class="wpbc_booking_appointment__choice_description">' . esc_html( $service['description'] ) . '</span>';
		}
		$html .= '</span><span class="wpbc_booking_appointment__choice_mark" aria-hidden="true"></span></label>';
	}
	$html .= ( $catalog_enabled ? wpbc_booking_appointment_render_catalog_close( 'services' ) : '</div>' );
	$html .= '<input type="hidden" name="wpbc_appointment_config" value="' . esc_attr( $config_token ) . '">';
	$html .= '<div class="wpbc_booking_appointment__actions"><button type="submit" class="wpbc_button wpbc_button_primary wpbc_booking_appointment__continue">' . esc_html__( 'Continue', 'booking' ) . '</button></div></form>';

	return $html;
}

/**
 * Render the Provider choice stage for a selected Service.
 *
 * @param array<string,mixed> $catalog      Public catalogue.
 * @param array<string,mixed> $service      Selected Service.
 * @param string              $config_token Signed AJAX configuration.
 * @param array<string,mixed> $config       Appointment configuration.
 *
 * @return string Provider picker markup.
 */
function wpbc_booking_appointment_render_providers( $catalog, $service, $config_token, $config = array() ) {
	$providers = wpbc_booking_appointment_get_service_providers( $catalog, $service );
	if ( empty( $providers ) ) {
		return wpbc_booking_appointment_render_notice( __( 'No Providers are currently available for this Service.', 'booking' ), 'empty' );
	}

	$config          = wpbc_booking_appointment_get_catalog_render_config( $config );
	$catalog_enabled = wpbc_booking_appointment_is_catalog_enabled();
	$html  = wpbc_booking_appointment_render_progress( 2, $config );
	$html .= wpbc_booking_appointment_render_selected_service( $service );
	$html .= wpbc_booking_appointment_render_screen_heading( $config, 2, __( 'Choose a Provider', 'booking' ), __( 'Select who will provide this Service.', 'booking' ) );
	$html .= '<form class="wpbc_booking_appointment__selection_form" method="get" action="' . esc_url( wpbc_booking_appointment_get_fallback_url( $config ) ) . '" data-appointment-stage="provider">';
	$html .= '<input type="hidden" name="wpbc_appointment_service" value="' . absint( $service['service_id'] ) . '">';
	$html .= $catalog_enabled
		? wpbc_booking_appointment_render_catalog_open( $config, 'providers', count( $providers ) )
		: '<div class="wpbc_booking_appointment__choices wpbc_booking_appointment__choices--providers" role="radiogroup" aria-label="' . esc_attr__( 'Providers', 'booking' ) . '">';
	foreach ( $providers as $provider ) {
		$provider_id      = absint( $provider['provider_id'] );
		$provider_service = wpbc_booking_appointment_get_effective_service( $service, $provider_id );
		$input_id         = 'wpbc_appointment_provider_' . $provider_id . '_' . wp_rand( 1000, 9999 );
		$initials         = '';
		foreach ( array_slice( array_filter( preg_split( '/\s+/u', trim( $provider['title'] ) ) ), 0, 2 ) as $word ) {
			$initials .= function_exists( 'mb_substr' ) ? mb_substr( $word, 0, 1 ) : substr( $word, 0, 1 );
		}
		$provider_details = wpbc_booking_appointment_join_summary_parts(
			array(
				wpbc_booking_appointment_format_duration( $provider_service['duration_minutes'] ),
				! empty( $config['show_starting_price'] ) ? wpbc_booking_appointment_format_service_cost_text( $provider_service['base_cost'], $provider_id ) : '',
			)
		);
		if ( ! empty( $config['show_availability'] ) && isset( $provider['has_weekly_availability'] ) && ! $provider['has_weekly_availability'] ) {
			$provider_details = wpbc_booking_appointment_join_summary_parts(
				array(
					$provider_details,
					__( 'No weekly availability configured', 'booking' ),
				)
			);
		}
		if ( ! empty( $config['show_resource_hierarchy'] ) ) {
			/* translators: %s: effective Service duration, optional price, and availability for this Provider. */
			$provider_meta = sprintf( __( 'Offers this Service · %s', 'booking' ), $provider_details );
		} else {
			$provider_meta = $provider_details;
		}
		$search_text  = wp_strip_all_tags( (string) $provider['title'] . ' ' . (string) $service['title'] . ' ' . $provider_meta );
		$choice_class = 'wpbc_booking_appointment__choice wpbc_booking_appointment__choice--provider';
		$choice_attrs = '';
		if ( $catalog_enabled ) {
			$choice_class .= ' wpbc_booking_appointment__catalog_card';
			$choice_attrs  = ' data-wpbc-appointment-catalog-card="" data-appointment-catalog-search="' . esc_attr( $search_text ) . '"';
		}
		$html .= '<label class="' . esc_attr( $choice_class ) . '" for="' . esc_attr( $input_id ) . '"' . $choice_attrs . ' data-summary-provider="' . esc_attr( $provider['title'] ) . '" data-summary-duration="' . esc_attr( wpbc_booking_appointment_format_duration( $provider_service['duration_minutes'] ) ) . '" data-summary-price="' . esc_attr( wpbc_booking_appointment_format_service_cost_text( $provider_service['base_cost'], $provider_id ) ) . '" data-summary-buffer-before="' . absint( isset( $provider_service['buffer_before_minutes'] ) ? $provider_service['buffer_before_minutes'] : 0 ) . '" data-summary-buffer-after="' . absint( isset( $provider_service['buffer_after_minutes'] ) ? $provider_service['buffer_after_minutes'] : 0 ) . '">';
		$html .= '<input id="' . esc_attr( $input_id ) . '" type="radio" name="wpbc_appointment_provider" value="' . $provider_id . '" required>';
		if ( ! empty( $config['show_resource_image'] ) ) {
			$html .= '<span class="wpbc_booking_appointment__provider_avatar" aria-hidden="true">';
			if ( ! empty( $provider['image_url'] ) ) {
				$html .= '<img src="' . esc_url( $provider['image_url'] ) . '" alt="" loading="lazy" decoding="async">';
			} else {
				$initials = $initials ? $initials : 'P';
				$initials = function_exists( 'mb_strtoupper' ) ? mb_strtoupper( $initials ) : strtoupper( $initials );
				$html     .= esc_html( $initials );
			}
			$html .= '</span>';
		}
		$html .= '<span class="wpbc_booking_appointment__choice_body">';
		$html .= ! empty( $config['show_resource_title'] )
			? '<strong>' . esc_html( $provider['title'] ) . '</strong>'
			: '<span class="screen-reader-text">' . esc_html( $provider['title'] ) . '</span>';
		$html .= '<span class="wpbc_booking_appointment__choice_meta">' . esc_html( $provider_meta ) . '</span></span>';
		$html .= '<span class="wpbc_booking_appointment__choice_mark" aria-hidden="true"></span></label>';
	}
	$html .= ( $catalog_enabled ? wpbc_booking_appointment_render_catalog_close( 'providers' ) : '</div>' );
	$html .= '<input type="hidden" name="wpbc_appointment_config" value="' . esc_attr( $config_token ) . '">';
	$html .= '<div class="wpbc_booking_appointment__actions">';
	if ( empty( $config['service_id'] ) ) {
		$html .= '<button type="button" class="wpbc_button wpbc_button_secondary wpbc_booking_appointment__back" data-appointment-back="service">' . esc_html__( 'Back', 'booking' ) . '</button>';
	}
	$html .= '<button type="submit" class="wpbc_button wpbc_button_primary wpbc_booking_appointment__continue">' . esc_html__( 'Continue', 'booking' ) . '</button></div></form>';

	return $html;
}

/**
 * Render a compact selected-Service summary.
 *
 * @param array<string,mixed> $service Selected Service.
 *
 * @return string Summary markup.
 */
function wpbc_booking_appointment_render_selected_service( $service ) {
	$summary = wpbc_booking_appointment_join_summary_parts( array( wpbc_booking_appointment_get_duration_summary( $service ), wpbc_booking_appointment_get_cost_summary( $service ) ) );

	return '<div class="wpbc_booking_appointment__selected" data-summary-service="' . esc_attr( $service['title'] ) . '" data-summary-duration="' . esc_attr( wpbc_booking_appointment_get_duration_summary( $service ) ) . '" data-summary-price="' . esc_attr( wpbc_booking_appointment_get_cost_summary( $service ) ) . '" data-summary-buffer-before="' . absint( isset( $service['buffer_before_minutes'] ) ? $service['buffer_before_minutes'] : 0 ) . '" data-summary-buffer-after="' . absint( isset( $service['buffer_after_minutes'] ) ? $service['buffer_after_minutes'] : 0 ) . '"><span>' . esc_html__( 'Service', 'booking' ) . '</span><strong>' . esc_html( $service['title'] ) . '</strong><small>' . esc_html( $summary ) . '</small></div>';
}

/**
 * Resolve the published Booking Form slug for the Appointment shortcode.
 *
 * An explicit shortcode form_type wins. Otherwise the selected Service's
 * published form is used when it is valid for the Provider owner; stale,
 * unpublished, or inaccessible form IDs fall back to `standard`.
 *
 * @param array<string,mixed> $service     Selected Service.
 * @param int                 $provider_id Provider resource ID.
 * @param array<string,mixed> $config      Shortcode configuration.
 *
 * @return string Safe published form slug.
 */
function wpbc_booking_appointment_resolve_form_slug( $service, $provider_id, $config ) {
	$form_slug = ! empty( $config['form_type'] ) ? sanitize_text_field( $config['form_type'] ) : '';
	$form_id   = ! empty( $service['booking_form_id'] ) ? absint( $service['booking_form_id'] ) : 0;
	if ( '' === $form_slug && $form_id && class_exists( 'WPBC_FE_Custom_Form_Helper' ) ) {
		$owner_user_id = class_exists( 'WPBC_FE_MU' )
			? WPBC_FE_MU::get_owner_user_id_for_resource( absint( $provider_id ) )
			: 0;
		if ( class_exists( 'WPBC_FE_MU' ) && WPBC_FE_MU::is_user_super_booking_admin( $owner_user_id ) ) {
			$owner_user_id = 0;
		}
		$forms = WPBC_FE_Custom_Form_Helper::get_custom_booking_forms_list(
			array(
				'include_standard' => false,
				'owner_user_id'    => absint( $owner_user_id ),
				'statuses'         => array( 'published' ),
			)
		);
		foreach ( $forms as $candidate_slug => $candidate ) {
			if ( $form_id === absint( isset( $candidate['id'] ) ? $candidate['id'] : 0 ) ) {
				$form_slug = sanitize_text_field( $candidate_slug );
				break;
			}
		}
	}
	if ( '' === $form_slug ) {
		$form_slug = 'standard';
	}

	return (string) apply_filters( 'wpbc_booking_appointment_form_slug', $form_slug, $service, absint( $provider_id ), $config );
}

/**
 * Determine whether the resolved published Booking Form contains Start Time.
 *
 * The check runs before native rendering so a misconfigured form cannot enqueue
 * calendar initialization for markup that will subsequently be discarded.
 *
 * @param string $form_slug   Resolved form slug.
 * @param int    $provider_id Provider resource ID.
 *
 * @return bool True when Start Time is present or an extension allows the form.
 */
function wpbc_booking_appointment_form_has_start_time( $form_slug, $provider_id ) {
	global $wpdb;

	$has_start_time = false;
	if ( class_exists( 'WPBC_FE_Form_Source_Resolver' ) ) {
		$resolution = WPBC_FE_Form_Source_Resolver::resolve(
			array(
				'resource_id' => absint( $provider_id ),
				'form_slug'   => sanitize_text_field( $form_slug ),
				'form_status' => 'published',
			)
		);
		$form_id = ! empty( $resolution['bfb_loader_args']['form_id'] ) ? absint( $resolution['bfb_loader_args']['form_id'] ) : 0;
		if ( $form_id ) {
			$form_source = $wpdb->get_var( $wpdb->prepare( "SELECT advanced_form FROM {$wpdb->prefix}booking_form_structures WHERE booking_form_id = %d AND status = %s LIMIT 1", $form_id, 'published' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$has_start_time = is_string( $form_source ) && false !== stripos( $form_source, 'starttime' );
		}
	}

	return (bool) apply_filters( 'wpbc_booking_appointment_form_has_start_time', $has_start_time, $form_slug, absint( $provider_id ) );
}

/**
 * Temporarily suppress the older Provider-first Service selector.
 *
 * @param bool $enabled Existing selector state.
 *
 * @return bool Always false inside the Appointment renderer scope.
 */
function wpbc_booking_appointment_disable_resource_service_selector( $enabled ) {
	return false;
}

/**
 * Build the Service editor URL for an incompatible Appointment form.
 *
 * The public Appointment workflow may be rendered for signed-out customers, so
 * the administration action is exposed only during an authenticated session.
 * The target Services page remains authoritative for capability and ownership
 * checks. The focus argument is allow-listed again by that page before it is
 * passed to JavaScript, which also supports custom Booking Calendar roles that
 * may add Appointments without sharing the global Settings capability.
 *
 * @param int $service_id Service that needs a compatible Booking Form.
 *
 * @return string Service editor URL, or an empty string when unavailable.
 */
function wpbc_booking_appointment_get_service_form_settings_url( $service_id ) {
	$service_id = absint( $service_id );
	if ( ! $service_id || ! is_user_logged_in() ) {
		return '';
	}

	return add_query_arg(
		array(
			'page'               => 'wpbc-services',
			'service_id'         => $service_id,
			'wpbc_service_focus' => 'booking_form',
		),
		admin_url( 'admin.php' )
	);
}

/**
 * Convert an Appointment error into a safe public response payload.
 *
 * Only the explicitly supported administration action keys are copied from
 * WP_Error data. This keeps arbitrary validation data out of public JSON and
 * prevents general error messages from becoming an HTML rendering channel.
 *
 * @param WP_Error $error Appointment workflow error.
 *
 * @return array<string,mixed> Sanitized message, code, and optional action.
 */
function wpbc_booking_appointment_get_error_response_data( $error ) {
	$response_data = array(
		'message' => $error->get_error_message(),
		'code'    => $error->get_error_code(),
	);
	$error_data    = $error->get_error_data();

	if ( is_array( $error_data ) && ! empty( $error_data['action_url'] ) && ! empty( $error_data['action_label'] ) ) {
		$response_data['action_url']   = esc_url_raw( $error_data['action_url'] );
		$response_data['action_label'] = sanitize_text_field( $error_data['action_label'] );
	}

	return $response_data;
}

/**
 * Render one complete existing booking form for a fixed Provider.
 *
 * @param array<string,mixed> $service      Selected Service.
 * @param array<string,mixed> $provider     Selected Provider.
 * @param array<string,mixed> $config       Shortcode configuration.
 * @param string              $config_token Signed AJAX configuration.
 *
 * @return string|WP_Error Appointment form markup or configuration error.
 */
function wpbc_booking_appointment_render_booking_form( $service, $provider, $config, $config_token ) {
	$provider_id = absint( $provider['provider_id'] );
	$form_slug   = wpbc_booking_appointment_resolve_form_slug( $service, $provider_id, $config );
	$allow_past  = wpbc_booking_appointment_is_past_booking_enabled( $config );
	$require_start_time = (bool) apply_filters( 'wpbc_booking_appointment_require_start_time', true, $service, $provider, $form_slug );
	if ( $require_start_time && ! wpbc_booking_appointment_form_has_start_time( $form_slug, $provider_id ) ) {
		$error_data           = array();
		$service_settings_url = wpbc_booking_appointment_get_service_form_settings_url( $service['service_id'] );
		if ( $service_settings_url ) {
			$error_data = array(
				'action_url'   => $service_settings_url,
				'action_label' => __( 'Select Booking Form', 'booking' ),
			);
		}

		return new WP_Error(
			'appointment_start_time_missing',
			__( 'This Appointment form needs a Start Time field. Select a Booking Form containing Start Time in the Service settings.', 'booking' ),
			$error_data
		);
	}

	static $rendered_provider_ids = array();
	if ( isset( $rendered_provider_ids[ $provider_id ] ) ) {
		return new WP_Error( 'appointment_duplicate_provider_form', __( 'This Provider already has an open Appointment form on this page. Complete or restart that Appointment before opening another form for the same Provider.', 'booking' ) );
	}
	$rendered_provider_ids[ $provider_id ] = true;

	$render_params = array(
		'is_echo'                    => 0,
		'resource_id'                => $provider_id,
		'cal_count'                  => absint( $config['cal_count'] ),
		'custom_booking_form'        => $form_slug,
		'shortcode_param__options'   => $config['options'],
		'calendar_dates_start'       => $config['calendar_dates_start'],
		'calendar_dates_end'         => $config['calendar_dates_end'],
		'calendar_request_overrides' => array(
			'allow_past' => $allow_past ? 1 : 0,
		),
	);
	if ( ! empty( $config['start_month_calendar'] ) && is_array( $config['start_month_calendar'] ) ) {
		$render_params['start_month_calendar'] = array(
			absint( $config['start_month_calendar'][0] ),
			absint( $config['start_month_calendar'][1] ),
		);
	}

	if ( function_exists( 'wpbc_appointment_services_form_hint_context' ) ) {
		wpbc_appointment_services_form_hint_context(
			'set',
			array(
				'service_id'  => $service['service_id'],
				'resource_id' => $provider_id,
				'title'       => $service['title'],
			)
		);
	}

	add_filter( 'wpbc_appointment_services_frontend_is_enabled', 'wpbc_booking_appointment_disable_resource_service_selector', PHP_INT_MAX );
	try {
		$form_html = WPBC_FE_Render::render_booking_form( $render_params );
	} finally {
		remove_filter( 'wpbc_appointment_services_frontend_is_enabled', 'wpbc_booking_appointment_disable_resource_service_selector', PHP_INT_MAX );
		if ( function_exists( 'wpbc_appointment_services_form_hint_context' ) ) {
			wpbc_appointment_services_form_hint_context( 'clear' );
		}
	}

	$duration_minutes = absint( $service['duration_minutes'] );
	$duration_value   = sprintf( '%02d:%02d', (int) floor( $duration_minutes / 60 ), $duration_minutes % 60 );
	$service_cost     = wpbc_appointment_services_is_pricing_available() && isset( $service['base_cost'] ) && is_numeric( $service['base_cost'] )
		? number_format( (float) $service['base_cost'], 2, '.', '' )
		: '';
	$submission_context = wpbc_booking_appointment_encode_submission_context( $config, $service['service_id'], $provider_id );
	$html  = wpbc_booking_appointment_render_progress( 3, $config );
	$html .= wpbc_booking_appointment_render_booking_header( $service, $provider, $config );
	$html .= '<div class="wpbc_booking_appointment__native_form" data-service-id="' . absint( $service['service_id'] ) . '" data-provider-id="' . $provider_id . '" data-service-title="' . esc_attr( $service['title'] ) . '" data-provider-title="' . esc_attr( $provider['title'] ) . '" data-duration="' . esc_attr( $duration_value ) . '" data-duration-label="' . esc_attr( wpbc_booking_appointment_format_duration( $duration_minutes ) ) . '" data-buffer-before="' . absint( $service['buffer_before_minutes'] ) . '" data-buffer-after="' . absint( $service['buffer_after_minutes'] ) . '" data-service-cost="' . esc_attr( $service_cost ) . '" data-service-cost-label="' . esc_attr( wpbc_booking_appointment_format_service_cost_text( $service_cost, $provider_id ) ) . '" data-form-slug="' . esc_attr( $form_slug ) . '" data-config-token="' . esc_attr( $config_token ) . '" data-appointment-context-token="' . esc_attr( $submission_context ) . '" data-allow-past="' . ( $allow_past ? '1' : '0' ) . '">';
	$html .= $form_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	$html .= '</div>';

	return $html;
}

/**
 * Render the selected Appointment summary above the native Booking Form.
 *
 * The Service picture is decorative because the adjacent text identifies the
 * selected Service. Invalid or unsupported picture URLs are omitted even when
 * filtered Service data bypasses repository normalization.
 *
 * @param array<string,mixed> $service  Effective Service presentation data.
 * @param array<string,mixed> $provider Selected Provider presentation data.
 * @param array<string,mixed> $config   Normalized shortcode configuration.
 *
 * @return string Escaped Appointment header markup.
 */
function wpbc_booking_appointment_render_booking_header( $service, $provider, $config ) {
	$provider_id         = absint( isset( $provider['provider_id'] ) ? $provider['provider_id'] : 0 );
	$duration_minutes    = absint( isset( $service['duration_minutes'] ) ? $service['duration_minutes'] : 0 );
	$service_cost        = isset( $service['base_cost'] ) ? $service['base_cost'] : '';
	$service_title       = isset( $service['title'] ) ? (string) $service['title'] : '';
	$provider_title      = isset( $provider['title'] ) ? (string) $provider['title'] : '';
	$service_picture_url = isset( $service['picture_url'] ) ? (string) $service['picture_url'] : '';
	$safe_picture_url    = esc_url( $service_picture_url );
	$show_service_image  = ! isset( $config['show_resource_image'] ) || (bool) $config['show_resource_image'];
	$appointment_summary = wpbc_booking_appointment_join_summary_parts(
		array(
			wpbc_booking_appointment_format_duration( $duration_minutes ),
			$provider_title,
			wpbc_booking_appointment_format_service_cost_text( $service_cost, $provider_id ),
		)
	);
	$summary_label       = wpbc_frontend_messages__get( 'message_appointment_summary_label', array(), $provider_id );
	$start_over_label    = wpbc_frontend_messages__get( 'message_appointment_start_over', array(), $provider_id );

	$html = '<div class="wpbc_booking_appointment__booking_header">';
	if ( $show_service_image && '' !== $safe_picture_url ) {
		$html .= '<span class="wpbc_booking_appointment__service_image wpbc_booking_appointment__booking_header_image" aria-hidden="true"><img src="' . esc_url( $service_picture_url ) . '" alt="" loading="lazy" decoding="async"></span>';
	}
	$html .= '<div class="wpbc_booking_appointment__booking_header_content"><span>' . esc_html( $summary_label ) . '</span><strong>' . esc_html( $service_title ) . '</strong><small>' . esc_html( $appointment_summary ) . '</small></div>';
	$html .= '<a class="wpbc_button wpbc_button_secondary wpbc_booking_appointment__change" data-wpbc-appointment-action="start-over" href="' . esc_url( wpbc_booking_appointment_get_fallback_url( $config ) ) . '">' . esc_html( $start_over_label ) . '</a>';
	$html .= '</div>';

	return $html;
}

/**
 * Render a consistent public notice.
 *
 * @param string              $message Notice text.
 * @param string              $type    Notice type: error or empty.
 * @param array<string,mixed> $action  Optional action_url and action_label.
 *
 * @return string Notice markup.
 */
function wpbc_booking_appointment_render_notice( $message, $type = 'error', $action = array() ) {
	$html = '<div class="wpbc_booking_appointment__notice wpbc_booking_appointment__notice--' . esc_attr( sanitize_html_class( $type ) ) . '" role="status" tabindex="-1">';
	$html .= '<span>' . esc_html( $message ) . '</span>';
	if ( ! empty( $action['action_url'] ) && ! empty( $action['action_label'] ) ) {
		$html .= ' <a class="wpbc_booking_appointment__notice_action" href="' . esc_url( $action['action_url'] ) . '">' . esc_html( $action['action_label'] ) . '</a>';
	}
	$html .= '</div>';

	return $html;
}

/**
 * Render a structured Appointment error without allowing arbitrary HTML.
 *
 * @param WP_Error $error Appointment workflow error.
 *
 * @return string Escaped notice markup with an optional authorized action.
 */
function wpbc_booking_appointment_render_error_notice( $error ) {
	$error_data = wpbc_booking_appointment_get_error_response_data( $error );

	return wpbc_booking_appointment_render_notice( $error_data['message'], 'error', $error_data );
}

/**
 * Resolve and render the correct Appointment stage.
 *
 * @param array<string,mixed> $config      Normalized configuration.
 * @param int                 $service_id  Selected Service ID.
 * @param int                 $provider_id Selected Provider ID.
 *
 * @return array{stage:string,html:string,service_id:int,provider_id:int}|WP_Error Stage response or validation error.
 */
function wpbc_booking_appointment_resolve_stage( $config, $service_id = 0, $provider_id = 0 ) {
	$config       = wpbc_booking_appointment_normalize_config( $config );
	$config_token = wpbc_booking_appointment_encode_config( $config );
	$catalog      = wpbc_booking_appointment_get_catalog( $config );
	if ( is_wp_error( $catalog ) ) {
		return $catalog;
	}

	$service_id  = $config['service_id'] ? $config['service_id'] : absint( $service_id );
	$provider_id = $config['provider_id'] ? $config['provider_id'] : absint( $provider_id );
	if ( ! $service_id ) {
		return array( 'stage' => 'service', 'html' => wpbc_booking_appointment_render_services( $catalog, $config_token, $config ), 'service_id' => 0, 'provider_id' => 0 );
	}

	$service = wpbc_booking_appointment_get_service( $catalog, $service_id );
	if ( is_wp_error( $service ) ) {
		return $service;
	}
	$providers = wpbc_booking_appointment_get_service_providers( $catalog, $service );
	if ( ! $provider_id && $config['auto_select_provider'] && 1 === count( $providers ) ) {
		$provider_id = absint( key( $providers ) );
	}
	if ( ! $provider_id ) {
		return array( 'stage' => 'provider', 'html' => wpbc_booking_appointment_render_providers( $catalog, $service, $config_token, $config ), 'service_id' => absint( $service['service_id'] ), 'provider_id' => 0 );
	}

	$provider = wpbc_booking_appointment_get_provider( $catalog, $service, $provider_id );
	if ( is_wp_error( $provider ) ) {
		return $provider;
	}
	$effective_service = wpbc_booking_appointment_get_effective_service( $service, $provider_id );
	$html              = wpbc_booking_appointment_render_booking_form( $effective_service, $provider, $config, $config_token );
	if ( is_wp_error( $html ) ) {
		return $html;
	}

	return array( 'stage' => 'booking', 'html' => $html, 'service_id' => absint( $service['service_id'] ), 'provider_id' => absint( $provider['provider_id'] ) );
}
