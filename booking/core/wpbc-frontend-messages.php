<?php
/**
 * Visitor-facing booking form message registry and resolver.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Get the visitor-facing message registry.
 *
 * Defaults intentionally remain in PHP/gettext. Only administrator overrides are stored in the database.
 *
 * @return array
 */
function wpbc_frontend_messages__get_registry() {

	$registry = array(
		'message_check_no_selected_dates' => array(
			'default' => __( 'Please, select booking date(s) at Calendar.', 'booking' ),
			'title' => __( 'No booking dates selected', 'booking' ),
			'description' => __( 'Shown when the booking form is submitted without selected calendar dates.', 'booking' ),
			'group' => 'date_selection', 'severity' => 'warning', 'optional' => false, 'placeholders' => array(),
		),
		'message_range_selection_click_last_date' => array(
			'default' => __( 'Start date selected. Now click the last day of your booking to complete the date range.', 'booking' ),
			'title' => __( 'Complete date range', 'booking' ),
			'description' => __( 'Informational note shown after the first click in two-click range selection mode.', 'booking' ),
			'group' => 'date_selection', 'severity' => 'info', 'optional' => true, 'placeholders' => array(),
		),
		'message_range_selection_has_unavailable_dates' => array(
			'default' => __( 'The selected date range includes unavailable or already booked dates, so the selection was cleared. Please choose a range that contains only available dates.', 'booking' ),
			'title' => __( 'Unavailable date inside range', 'booking' ),
			'description' => __( 'Shown when a selected range contains an unavailable date and must be cleared.', 'booking' ),
			'group' => 'date_selection', 'severity' => 'warning', 'optional' => false, 'placeholders' => array(),
		),
		'message_dates_times_unavailable' => array(
			'default' => __( 'These dates and times in this calendar are already booked or unavailable.', 'booking' ),
			'title' => __( 'Dates or times unavailable', 'booking' ),
			'description' => __( 'Shown when the requested dates or times are no longer available.', 'booking' ),
			'group' => 'date_selection', 'severity' => 'warning', 'optional' => false, 'placeholders' => array(),
		),
		'message_choose_alternative_dates' => array(
			'default' => __( 'Please choose alternative date(s), times, or adjust the number of slots booked.', 'booking' ),
			'title' => __( 'Choose alternative dates', 'booking' ),
			'description' => __( 'Follow-up instruction for an unavailable date, time, or capacity selection.', 'booking' ),
			'group' => 'date_selection', 'severity' => 'warning', 'optional' => false, 'placeholders' => array(),
		),
		'message_cannot_save_in_one_resource' => array(
			'default' => __( 'It is not possible to store this sequence of the dates into the one same resource.', 'booking' ),
			'title' => __( 'Cannot use one booking resource', 'booking' ),
			'description' => __( 'Shown when the selected sequence cannot be stored in one booking resource.', 'booking' ),
			'group' => 'date_selection', 'severity' => 'warning', 'optional' => false, 'placeholders' => array(),
		),
		'message_check_required' => array(
			'default' => __( 'This field is required', 'booking' ),
			'title' => __( 'Required field', 'booking' ),
			'description' => __( 'Shown for an empty required text, select, or other standard field.', 'booking' ),
			'group' => 'form_validation', 'severity' => 'warning', 'optional' => false, 'placeholders' => array(),
		),
		'message_check_required_for_check_box' => array(
			'default' => __( 'This checkbox must be checked', 'booking' ),
			'title' => __( 'Required checkbox', 'booking' ),
			'description' => __( 'Shown when a required checkbox is not checked.', 'booking' ),
			'group' => 'form_validation', 'severity' => 'warning', 'optional' => false, 'placeholders' => array(),
		),
		'message_check_required_for_radio_box' => array(
			'default' => __( 'At least one option must be selected', 'booking' ),
			'title' => __( 'Required option', 'booking' ),
			'description' => __( 'Shown when no option is selected in a required radio group.', 'booking' ),
			'group' => 'form_validation', 'severity' => 'warning', 'optional' => false, 'placeholders' => array(),
		),
		'message_check_email' => array(
			'default' => __( 'Incorrect email address', 'booking' ),
			'title' => __( 'Invalid email address', 'booking' ),
			'description' => __( 'Shown when an email field does not contain a valid email address.', 'booking' ),
			'group' => 'form_validation', 'severity' => 'warning', 'optional' => false, 'placeholders' => array(),
		),
		'message_check_same_email' => array(
			'default' => __( 'Your emails do not match', 'booking' ),
			'title' => __( 'Email addresses do not match', 'booking' ),
			'description' => __( 'Shown when email confirmation does not match the original email field.', 'booking' ),
			'group' => 'form_validation', 'severity' => 'warning', 'optional' => false, 'placeholders' => array(),
		),
		'message_check_valid_date' => array(
			/* translators: Keep the {date_example} placeholder unchanged. */
			'default' => __( 'This field must be a valid date like {date_example}', 'booking' ),
			'title' => __( 'Invalid date format', 'booking' ),
			'description' => __( 'Shown for a field using the validate_as_date CSS class.', 'booking' ),
			'group' => 'form_validation', 'severity' => 'warning', 'optional' => false, 'placeholders' => array( '{date_example}' ),
		),
		'message_check_digits_only' => array(
			'default' => __( 'This field must contain only digits', 'booking' ),
			'title' => __( 'Digits only', 'booking' ),
			'description' => __( 'Shown for a field using the validate_as_digit CSS class.', 'booking' ),
			'group' => 'form_validation', 'severity' => 'warning', 'optional' => false, 'placeholders' => array(),
		),
		'message_check_digits_count' => array(
			/* translators: Keep the {digits} placeholder unchanged. */
			'default' => __( 'This field must contain {digits} digits', 'booking' ),
			'title' => __( 'Required number of digits', 'booking' ),
			'description' => __( 'Shown for validate_digit_N fields. Keep the {digits} placeholder.', 'booking' ),
			'group' => 'form_validation', 'severity' => 'warning', 'optional' => false, 'placeholders' => array( '{digits}' ),
		),
		'message_error_start_time' => array(
			'default' => __( 'Start Time is invalid. The date or time may be booked, or already in the past! Please choose another date or time.', 'booking' ),
			'title' => __( 'Invalid start time', 'booking' ),
			'description' => __( 'Shown when a selected start time cannot be booked.', 'booking' ),
			'group' => 'time_validation', 'severity' => 'warning', 'optional' => false, 'placeholders' => array(),
		),
		'message_error_end_time' => array(
			'default' => __( 'End Time is invalid. The date or time may be booked, or already in the past. The End Time may also be earlier that the start time, if only 1 day was selected! Please choose another date or time.', 'booking' ),
			'title' => __( 'Invalid end time', 'booking' ),
			'description' => __( 'Shown when a selected end time cannot be booked.', 'booking' ),
			'group' => 'time_validation', 'severity' => 'warning', 'optional' => false, 'placeholders' => array(),
		),
		'message_error_range_time' => array(
			'default' => __( 'The time(s) may be booked, or already in the past!', 'booking' ),
			'title' => __( 'Invalid time range', 'booking' ),
			'description' => __( 'Shown when a range-time selection is unavailable or in the past.', 'booking' ),
			'group' => 'time_validation', 'severity' => 'warning', 'optional' => false, 'placeholders' => array(),
		),
		'message_error_duration_time' => array(
			'default' => __( 'The time(s) may be booked, or already in the past!', 'booking' ),
			'title' => __( 'Invalid duration', 'booking' ),
			'description' => __( 'Shown when a duration-time selection is unavailable or in the past.', 'booking' ),
			'group' => 'time_validation', 'severity' => 'warning', 'optional' => false, 'placeholders' => array(),
		),
		'message_booking_saving' => array(
			'default' => __( 'Saving', 'booking' ),
			'title' => __( 'Saving booking', 'booking' ),
			'description' => __( 'Short progress text shown while the booking is being submitted.', 'booking' ),
			'group' => 'submission', 'severity' => 'info', 'optional' => false, 'placeholders' => array(),
		),
		'message_captcha_incorrect' => array(
			'default' => __( 'The code you entered is incorrect', 'booking' ),
			'title' => __( 'Incorrect CAPTCHA', 'booking' ),
			'description' => __( 'Shown after an incorrect CAPTCHA response.', 'booking' ),
			'group' => 'captcha', 'severity' => 'warning', 'optional' => false, 'placeholders' => array(),
		),
	);

	/**
	 * Filters the visitor-facing message registry.
	 *
	 * @param array $registry Message definitions keyed by stable message ID.
	 */
	return apply_filters( 'wpbc_frontend_message_registry', $registry );
}

/**
 * Get normalized saved message settings.
 *
 * @return array
 */
function wpbc_frontend_messages__get_settings() {

	$settings = get_bk_option( 'booking_frontend_messages' );
	if ( ! is_array( $settings ) ) {
		$settings = array();
	}

	// Accept an early flat override array as a compatibility fallback.
	if ( ! isset( $settings['messages'] ) ) {
		$flat = array_intersect_key( $settings, wpbc_frontend_messages__get_registry() );
		$settings = array( 'version' => 1, 'messages' => $flat, 'enabled' => array() );
	}

	return array(
		'version'  => 1,
		'messages' => ( isset( $settings['messages'] ) && is_array( $settings['messages'] ) ) ? $settings['messages'] : array(),
		'enabled'  => ( isset( $settings['enabled'] ) && is_array( $settings['enabled'] ) ) ? $settings['enabled'] : array(),
	);
}

/**
 * Resolve a message for the active Booking Calendar locale.
 *
 * @param string $message_key Stable registry key.
 * @param array  $replacements Optional literal placeholder replacements.
 * @param int    $resource_id Optional resource ID reserved for future scoped overrides.
 * @return string
 */
function wpbc_frontend_messages__get( $message_key, $replacements = array(), $resource_id = 0 ) {

	$registry = wpbc_frontend_messages__get_registry();
	if ( ! isset( $registry[ $message_key ] ) ) {
		return '';
	}

	$settings = wpbc_frontend_messages__get_settings();
	if ( isset( $settings['messages'][ $message_key ] ) && is_string( $settings['messages'][ $message_key ] ) && '' !== trim( $settings['messages'][ $message_key ] ) ) {
		$override = trim( $settings['messages'][ $message_key ] );
		// Translation-only overrides inherit the live gettext default instead of freezing the administrator's locale.
		if ( 0 === strpos( $override, '[lang=' ) ) {
			$override = $registry[ $message_key ]['default'] . "\n" . $override;
		}
		$value = wpbc_lang( $override );
	} else {
		$value = $registry[ $message_key ]['default'];
	}

	if ( is_array( $replacements ) && ! empty( $replacements ) ) {
		$safe_replacements = array();
		foreach ( $replacements as $placeholder => $replacement ) {
			$safe_replacements[ (string) $placeholder ] = sanitize_text_field( (string) $replacement );
		}
		$value = strtr( $value, $safe_replacements );
	}

	/**
	 * Filters a resolved visitor-facing message before final plain-text sanitization.
	 *
	 * @param string $value Message text.
	 * @param string $message_key Registry key.
	 * @param int    $resource_id Booking resource ID, or zero for global context.
	 */
	$value = apply_filters( 'wpbc_frontend_message_value', $value, $message_key, absint( $resource_id ) );
	if ( ! is_scalar( $value ) ) {
		$value = $registry[ $message_key ]['default'];
	}

	return sanitize_textarea_field( (string) $value );
}

/**
 * Check whether an optional message is enabled.
 *
 * @param string $message_key Registry key.
 * @return bool
 */
function wpbc_frontend_messages__is_enabled( $message_key ) {

	$registry = wpbc_frontend_messages__get_registry();
	if ( ! isset( $registry[ $message_key ] ) ) {
		return false;
	}
	if ( empty( $registry[ $message_key ]['optional'] ) ) {
		return true;
	}

	$settings = wpbc_frontend_messages__get_settings();
	return ! isset( $settings['enabled'][ $message_key ] ) || 'Off' !== $settings['enabled'][ $message_key ];
}

/**
 * Split a validated [lang=LOCALE] message into editable sections.
 *
 * @param string $value Stored message value.
 * @return array
 */
function wpbc_frontend_messages__parse_language_sections( $value ) {

	$result = array( 'default' => '', 'translations' => array() );
	$value = (string) $value;
	if ( '' === $value ) {
		return $result;
	}

	if ( ! preg_match_all( '/\[lang=([A-Za-z0-9_@.\-]+)\]/', $value, $matches, PREG_OFFSET_CAPTURE ) ) {
		$result['default'] = trim( $value );
		return $result;
	}

	$result['default'] = trim( substr( $value, 0, $matches[0][0][1] ) );
	$count = count( $matches[0] );
	for ( $index = 0; $index < $count; $index++ ) {
		$locale = $matches[1][ $index ][0];
		$start = $matches[0][ $index ][1] + strlen( $matches[0][ $index ][0] );
		$end = ( $index + 1 < $count ) ? $matches[0][ $index + 1 ][1] : strlen( $value );
		$result['translations'][ $locale ] = trim( substr( $value, $start, $end - $start ) );
	}

	return $result;
}

/**
 * Validate and sanitize one raw multilingual override.
 *
 * @param string $message_key Registry key.
 * @param mixed  $raw_value Posted value.
 * @return string|WP_Error
 */
function wpbc_frontend_messages__validate_value( $message_key, $raw_value ) {

	$registry = wpbc_frontend_messages__get_registry();
	if ( ! isset( $registry[ $message_key ] ) || ! is_scalar( $raw_value ) ) {
		return new WP_Error( 'invalid_message', __( 'Invalid message value.', 'booking' ) );
	}

	$value = str_replace( array( "\r\n", "\r" ), "\n", wp_unslash( (string) $raw_value ) );
	$value = trim( $value );
	if ( '' === $value ) {
		return '';
	}
	if ( 4000 < strlen( $value ) ) {
		return new WP_Error( 'message_too_long', __( 'A form message cannot exceed 4000 characters.', 'booking' ) );
	}
	if ( false !== strpos( $value, '<' ) || false !== strpos( $value, '>' ) ) {
		return new WP_Error( 'message_html_not_allowed', __( 'HTML is not allowed in form messages.', 'booking' ) );
	}

	$sanitized = sanitize_textarea_field( $value );
	$without_valid_tags = preg_replace( '/\[lang=([A-Za-z0-9_@.\-]+)\]/', '', $sanitized );
	if ( false !== stripos( $without_valid_tags, '[lang' ) ) {
		return new WP_Error( 'invalid_language_tag', __( 'A language section contains an invalid [lang=LOCALE] tag.', 'booking' ) );
	}

	$sections = wpbc_frontend_messages__parse_language_sections( $sanitized );
	if ( preg_match_all( '/\[lang=([A-Za-z0-9_@.\-]+)\]/', $sanitized, $locale_matches ) ) {
		if ( count( $locale_matches[1] ) !== count( array_unique( $locale_matches[1] ) ) ) {
			return new WP_Error( 'duplicate_language', __( 'Each locale can be used only once in a message.', 'booking' ) );
		}
		foreach ( $sections['translations'] as $translation ) {
			if ( '' === trim( $translation ) ) {
				return new WP_Error( 'empty_translation', __( 'Language sections cannot be empty.', 'booking' ) );
			}
		}
	}

	$placeholder_default = '' !== $sections['default'] ? $sections['default'] : $registry[ $message_key ]['default'];
	$all_sections = array_merge( array( $placeholder_default ), array_values( $sections['translations'] ) );
	foreach ( $registry[ $message_key ]['placeholders'] as $placeholder ) {
		foreach ( $all_sections as $section_text ) {
			if ( false === strpos( $section_text, $placeholder ) ) {
				return new WP_Error(
					'missing_placeholder',
					sprintf( __( 'The message must contain the %s placeholder in every language.', 'booking' ), $placeholder )
				);
			}
		}
	}

	return $sanitized;
}
