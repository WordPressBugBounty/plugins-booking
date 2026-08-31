<?php
/**
 * Admin Panel UI - Parts
 *
 * @version  1.2
 * @package  Any
 * @category Page Structure in Admin Panel
 * @author   wpdevelop
 *
 * @web-site https://wpbookingcalendar.com/
 * @email info@wpbookingcalendar.com
 *
 * @modified 2025-02-15
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;                                                                                                               // Exit, if accessed directly.
}

/**
 * Show Top Nav bar
 *
 * @param array $args - parameters.
 *
 * @return void
 */
function wpbc_ui__top_nav( $args = array() ) {

	$defaults = array(
		'attr'                             => array(),
		'is_full_screen_user_mode_enabled' => true,
	);
	$params   = wp_parse_args( $args, $defaults );

	echo '<div class="wpbc_ui_el wpbc_ui_el__top_nav">';

	wpbc_ui__vert_left_bar__do_toggle();
	wpbc_ui_el__divider_vertical( array( 'class' => 'wpbc_ui_el__vertical_line wpbc_ui__top_nav__btn_show_left_vertical_nav_divider' ) );

	wpbc_ui__top_nav__dropdown__wpbc();

	do_action( 'wpbc_ui_el__top_nav__content_start', $params['page_tag'], $params['active_page_tab'], $params['active_page_subtab'] );


	?><div class="wpbc_ui_el__make_space"></div><?php  	// Spacer.

	do_action( 'wpbc_ui_el__top_nav__content_center', $params['page_tag'], $params['active_page_tab'], $params['active_page_subtab'] );

	// Load Top News Message and "Search by ID" fields.
	echo '<style type="text/css"> .wpbc_message_wrapper  { margin-left: 0px !important; } </style>';
	make_bk_action( 'wpbc_h1_header_content_end', $params['page_tag'], $params['active_page_tab'], $params['active_page_subtab'] );

	?><div class="wpbc_ui_el__make_space"></div><?php	// Spacer.

	do_action( 'wpbc_ui_el__top_nav__content_end', $params['page_tag'], $params['active_page_tab'], $params['active_page_subtab'] );

	wpbc_ui_el__divider_vertical();

	// Right sidebar toggle button.
	wpbc_ui__vert_right_bar__do_toggle();
	wpbc_ui_el__divider_vertical( array( 'class' => 'wpbc_ui_el__vertical_line wpbc_ui__top_nav__btn_show_right_vertical_nav_divider' ) );


	// Full Screen Buttons.
	wpbc_ui__top_nav__btn_full_screen( $params );
	wpbc_ui__top_nav__btn_normal_screen( $params );

	echo '</div>';
}



/**
 * Show element - "WPBC - Main Dropdown"
 *
 * @return void
 */
function wpbc_ui__top_nav__dropdown__wpbc() {

	$svg_size       = '22px';
	$svg_icon_style =  'margin:5px 5px 0 0;'; // 'background-position: 0 0;background-size: ' . $svg_size . ' ' . $svg_size . ';width: ' . $svg_size . ';height: ' . $svg_size . ';'; //.
	$svg_icon       = wpbc_get_svg_logo_for_background( '#555', '#e5e5e5', '1.0' );

	$wpbc_starter_pages       = function_exists( 'wpbc_get_published_activation_booking_pages' ) ? wpbc_get_published_activation_booking_pages() : array();
	$wp_post_booking_absolute = false;

	if (
		empty( $wpbc_starter_pages ) &&
		function_exists( 'wpbc_stp_wiz__is_exist_published_page_with_booking_form' )
	) {
		$wp_post_booking_absolute = wpbc_stp_wiz__is_exist_published_page_with_booking_form();
	}

	$el_arr = array(
		// 'title'        => 'Booking Calendar',
		// 'font_icon'    => 'wpbc-bi-calendar2-range',
		'title_html'      => '<span class="nav-tab-text" style="margin: -3px 0 0 5px;font-size: 16px;padding: 0;"><span style="position: absolute;font-size: 7px;margin-top: 13px;margin-left: 1px;">WP</span>Booking Calendar</span>',
		'svg_icon'        => $svg_icon,
		'svg_icon_style'  => $svg_icon_style,
		'style'           => 'display: flex;flex-flow:row nowrap;align-items: center;justify-content: flex-start; ',
		'container_style' => 'padding: 0 15px 0 10px;',
		'position'        => 'left',
		'has_down_arrow'  => true,
		'items'           => array(),
	);

	if ( ! empty( $wpbc_starter_pages ) && is_array( $wpbc_starter_pages ) ) {
		$el_arr['items'][] = array(
			'type'  => 'header',
			'title' => __( 'Visit Booking Pages', 'booking' ),
		);
		$el_arr['items'][] = array(
			'type'  => 'link',
			'title' => __( 'Visit Home Page', 'booking' ),
			'url'   => esc_url( home_url( '/' ) ),
		);

		foreach ( $wpbc_starter_pages as $wpbc_starter_page ) {
			if ( empty( $wpbc_starter_page['url'] ) ) {
				continue;
			}

			$wpbc_starter_page_title = __( 'Go to page with booking form', 'booking' );
			if ( ! empty( $wpbc_starter_page['button_title'] ) ) {
				$wpbc_starter_page_title = $wpbc_starter_page['button_title'];
			} elseif ( ! empty( $wpbc_starter_page['page_title'] ) ) {
				$wpbc_starter_page_title = $wpbc_starter_page['page_title'];
			}

			$el_arr['items'][] = array(
				'type'  => 'link',
				'title' => $wpbc_starter_page_title,
				'url'   => esc_url( $wpbc_starter_page['url'] ),
			);
		}
	} elseif ( ! empty( $wp_post_booking_absolute ) ) {
		$el_arr['items'][] = array(
			'type'  => 'header',
			'title' => __( 'Visit Booking Page', 'booking' ),
		);
		$el_arr['items'][] = array(
			'type'  => 'link',
			'title' => __( 'Visit Home Page', 'booking' ),
			'url'   => esc_url( home_url( '/' ) ),
		);
		$el_arr['items'][] = array(
			'type'  => 'link',
			'title' => __( 'Go to page with booking form', 'booking' ),
			'url'   => esc_url( $wp_post_booking_absolute ),
		);
	}
	$el_arr['items'][] = array(
		'type'  => 'header',
		'title' => __( 'Help', 'booking' ),
	);
	$el_arr['items'][] = array(
		'type'  => 'link',
		'title' => __( 'FAQ', 'booking' ),
		'url'   => 'https://wpbookingcalendar.com/faq/',
	);
	$el_arr['items'][] = array(
		'type'  => 'header',
		'title' => __( 'Support', 'booking' ),
	);
	$el_arr['items'][] = array(
		'type'  => 'link',
		'title' => __( 'Support Forum', 'booking' ),
		'url'   => 'https://wpbookingcalendar.com/support/',
	);
	$el_arr['items'][] = array(
		'type'  => 'link',
		'title' => __( 'Contact Support', 'booking' ),
		'url'   => 'mailto:support@wpbookingcalendar.com',
		'attr'  => array( 'style' => 'font-weight: 600;' ),
	);
	$el_arr['items'][] = array( 'type' => 'divider' );
	$el_arr['items'][] = array(
		'type'  => 'link',
		'title' => __( 'Release History', 'booking' ),
		'url'   => 'https://wpbookingcalendar.com/wn/',
	);
	$el_arr['items'][] = array(
		'type'  => 'link',
		'title' => __( 'What\'s New', 'booking' ) . ' <span style="float:right">' . esc_attr( WP_BK_VERSION_NUM ) . '</span>',
		'url'   => esc_url( admin_url( add_query_arg( array( 'page' => 'wpbc-about' ), 'index.php' ) ) ),
	);
//	$el_arr['items'][] = array(
//		'type'  => 'link',
//		'title' => __( 'About', 'booking' ),
//		'url'   => 'https://wpbookingcalendar.com/',
//	);


	$is_show_up = wpbc_is_show_up();

	if ( $is_show_up ) {
		$el_arr['items'][] = array( 'type' => 'divider' );
		$el_arr['items'][] = array(
			'type'  => 'link',
			'title' => ( class_exists( 'wpdev_bk_personal' ) )
				? __( 'View Upgrade Options', 'booking' )
				: __( 'Upgrade to Pro', 'booking' ),
			'url'   => wpbc_up_link(),
			'attr' => array(
				'class' => 'wpbc_ui_el_upgrade_button wpbc_button_light wpbc_button_green',
				'style' => 'color:#fff;font-weight: 600;',
			),
		);
	}

	wpbc_ui_el__dropdown_menu( $el_arr );
}


/**
 * Show element - "Full Screen"
 *
 * @return void
 */
function wpbc_ui__top_nav__btn_full_screen( $args = array() ) {

	$defaults = array(
		'is_full_screen_user_mode_enabled' => true,
	);
	$params   = wp_parse_args( $args, $defaults );

	$el_arr = array();

	$el_arr['onclick'] = 'wpbc_admin_ui__full_screen__do_on( this, ' . ( $params['is_full_screen_user_mode_enabled'] ? 'true' : 'false' ) . ' );';

	$el_arr['font_icon'] = 'wpbc-bi-arrows-fullscreen';
	$el_arr['hint']      = array(
		'title'    => __( 'Full Screen', 'booking' ),
		'position' => 'top',
	);

	$el_arr['container_class'] = 'wpbc_ui__top_nav__btn_full_screen';

	if ( ( ! wpbc_is_setup_wizard_page() ) && ( $params['is_full_screen_user_mode_enabled'] ) ) {

		// Params for saving user option.
		$user_cust_option = 'is_full_screen';
		$nonce_action     = $user_cust_option . '_nonce_act';

		$el_arr['attr'] = array(
			'data-wpbc-u-save-name'    => $user_cust_option,
			'data-wpbc-u-save-value'   => 'On',
			'data-wpbc-u-save-nonce'   => wp_create_nonce( $nonce_action ), // do not need to  make escaping the values because: wpbc_get_custom_attr() should handle escaping.
			'data-wpbc-u-save-user-id' => wpbc_get_current_user_id(),
			'data-wpbc-u-save-action'  => $nonce_action,
		);
		?><script type="text/javascript"><?php

			$is_full_screen = WPBC_User_Custom_Data_Saver::get_user_data_value( wpbc_get_current_user_id(), $user_cust_option );
			$is_full_screen = ( 'On' === wpbc_ui__get_full_screen_mode_from_cookie( $is_full_screen ) );

			echo wpbc_jq_ready_start();  // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped

			if ( $is_full_screen ) {
				echo " jQuery( '.wpbc_ui__top_nav__btn_full_screen,.wpbc_ui__top_nav__btn_normal_screen' ).toggleClass( 'wpbc_ui__hide' ); ";
			}
			echo ' wpbc_check_full_screen_mode(); ';
			echo wpbc_jq_ready_end();  // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped

		?></script><?php
	}
	wpbc_ui_el__a( $el_arr );
}


/**
 * Show element - "Normal Screen"
 *
 * @return void
 */
function wpbc_ui__top_nav__btn_normal_screen( $args = array() ) {

	$defaults = array(
		'is_full_screen_user_mode_enabled' => true,
	);
	$params   = wp_parse_args( $args, $defaults );

	$el_arr = array();

	$el_arr['onclick'] = 'wpbc_admin_ui__full_screen__do_off( this, ' . ( $params['is_full_screen_user_mode_enabled'] ? 'true' : 'false' ) . ' );';

	$el_arr['title']     = '';
	$el_arr['font_icon'] = 'wpbc-bi-arrows-angle-contract';
	$el_arr['hint']      = array(
		'title'    => __( 'Exit Full Screen', 'booking' ),
		'position' => 'top',
	);
	$el_arr['container_class'] = 'wpbc_ui__top_nav__btn_normal_screen wpbc_ui__hide';

	if ( $params['is_full_screen_user_mode_enabled'] ) {
		// Params for saving user option.
		$user_cust_option = 'is_full_screen';
		$nonce_action     = $user_cust_option . '_nonce_act';
		$el_arr['attr']   = array(
			'data-wpbc-u-save-name'    => $user_cust_option,
			'data-wpbc-u-save-value'   => 'Off',
			'data-wpbc-u-save-nonce'   => wp_create_nonce( $nonce_action ), // do not need to  make escaping the values because: wpbc_get_custom_attr() should handle escaping.
			'data-wpbc-u-save-user-id' => wpbc_get_current_user_id(),
			'data-wpbc-u-save-action'  => $nonce_action,
		);
	}

	wpbc_ui_el__a( $el_arr );
}


/**
 * Build a short-lived browser value for an immediately changed fullscreen preference.
 *
 * The timestamp distinguishes a pending navigation safeguard from legacy
 * year-long cookies, which must not override a successfully stored user value.
 *
 * @param string   $mode             Fullscreen mode, either `On` or `Off`.
 * @param int|null $issued_timestamp Optional Unix timestamp for deterministic tests.
 *
 * @return string Pending cookie value, or an empty string for an invalid mode.
 */
function wpbc_ui__create_full_screen_mode_cookie_value( $mode, $issued_timestamp = null ) {

	if ( ! in_array( $mode, array( 'On', 'Off' ), true ) ) {
		return '';
	}

	$issued_timestamp = null === $issued_timestamp ? time() : absint( $issued_timestamp );

	return $mode . '|' . $issued_timestamp;
}

/**
 * Return every server-side cookie path used by Booking Calendar administration.
 *
 * Multiple paths are updated together to replace legacy cookies created by
 * root, subdirectory, or WordPress administration requests.
 *
 * @return string[] Unique absolute cookie paths.
 */
function wpbc_ui__get_full_screen_mode_cookie_paths() {

	$cookie_paths = array( '/' );

	if ( defined( 'COOKIEPATH' ) && COOKIEPATH ) {
		$cookie_paths[] = COOKIEPATH;
	}

	if ( defined( 'ADMIN_COOKIE_PATH' ) && ADMIN_COOKIE_PATH ) {
		$cookie_paths[] = ADMIN_COOKIE_PATH;
	}

	return array_values( array_unique( array_filter( $cookie_paths ) ) );
}

/**
 * Set the pending fullscreen cookie on every applicable administration path.
 *
 * User metadata remains authoritative. This short-lived cookie only bridges
 * immediate navigation and replaces stale same-name cookies on narrower paths.
 *
 * @param string $mode Fullscreen mode, either `On` or `Off`.
 *
 * @return bool True when the mode was valid; otherwise false.
 */
function wpbc_ui__set_full_screen_mode_cookie( $mode ) {

	$cookie_value = wpbc_ui__create_full_screen_mode_cookie_value( $mode );
	if ( '' === $cookie_value ) {
		return false;
	}

	if ( ! headers_sent() ) {
		$cookie_domain = defined( 'COOKIE_DOMAIN' ) ? COOKIE_DOMAIN : '';

		foreach ( wpbc_ui__get_full_screen_mode_cookie_paths() as $cookie_path ) {
			setcookie(
				'wpbc_admin_full_screen',
				$cookie_value,
				time() + ( 5 * 60 ),
				$cookie_path,
				$cookie_domain,
				is_ssl(),
				false
			);
		}
	}

	$_COOKIE['wpbc_admin_full_screen'] = $cookie_value;

	return true;
}

/**
 * Resolve fullscreen mode from saved user data and an optional pending cookie.
 *
 * A fresh timestamped cookie temporarily wins so immediate navigation remains
 * deterministic if the asynchronous AJAX request is interrupted. A legacy
 * plain `On` or `Off` cookie is accepted only when no valid user preference
 * exists, preventing stale or duplicate-path cookies from overriding storage.
 *
 * @param string   $saved_value      Saved user-meta value.
 * @param string   $cookie_value     Browser cookie value.
 * @param int|null $current_timestamp Optional Unix timestamp for deterministic tests.
 *
 * @return string `On`, `Off`, or an empty string.
 */
function wpbc_ui__resolve_full_screen_mode( $saved_value = '', $cookie_value = '', $current_timestamp = null ) {

	$saved_value = in_array( $saved_value, array( 'On', 'Off' ), true ) ? $saved_value : '';
	$cookie_value = is_scalar( $cookie_value ) ? (string) $cookie_value : '';

	if ( in_array( $cookie_value, array( 'On', 'Off' ), true ) ) {
		return '' === $saved_value ? $cookie_value : $saved_value;
	}

	if ( ! preg_match( '/^(On|Off)\|([0-9]{10,})$/', $cookie_value, $cookie_parts ) ) {
		return $saved_value;
	}

	$current_timestamp       = null === $current_timestamp ? time() : absint( $current_timestamp );
	$issued_timestamp        = absint( $cookie_parts[2] );
	$pending_cookie_lifetime = 5 * 60;
	$allowed_clock_skew      = 60;

	if (
		$issued_timestamp > ( $current_timestamp + $allowed_clock_skew )
		|| $issued_timestamp < ( $current_timestamp - $pending_cookie_lifetime )
	) {
		return $saved_value;
	}

	return $cookie_parts[1];
}

/**
 * Get fullscreen mode from the immediate browser cookie and saved user metadata.
 *
 * @param string $saved_value Saved user-meta value.
 *
 * @return string `On`, `Off`, or an empty string.
 */
function wpbc_ui__get_full_screen_mode_from_cookie( $saved_value = '' ) {

	// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotValidated -- Optional same-origin UI preference.
	$cookie_value = isset( $_COOKIE['wpbc_admin_full_screen'] ) && is_scalar( $_COOKIE['wpbc_admin_full_screen'] )
		? sanitize_text_field( wp_unslash( $_COOKIE['wpbc_admin_full_screen'] ) )
		: '';

	return wpbc_ui__resolve_full_screen_mode( $saved_value, $cookie_value );
}

/**
 * Synchronize the fullscreen navigation cookie after verified user-meta storage.
 *
 * @param int    $user_id       User whose preference was saved.
 * @param string $data_name     Saved Booking Calendar preference name.
 * @param array  $sanitized_data Sanitized value stored in user metadata.
 *
 * @return void
 */
function wpbc_ui__sync_full_screen_cookie_after_user_data_save( $user_id, $data_name, $sanitized_data ) {

	if (
		'is_full_screen' !== $data_name
		|| wpbc_get_current_user_id() !== absint( $user_id )
		|| ! isset( $sanitized_data['value'] )
		|| ! is_scalar( $sanitized_data['value'] )
	) {
		return;
	}

	wpbc_ui__set_full_screen_mode_cookie( (string) $sanitized_data['value'] );
}
add_action( 'wpbc_user_custom_data_saved', 'wpbc_ui__sync_full_screen_cookie_after_user_data_save', 10, 3 );


/**
 * Set the admin full screen class
 *
 * @param bool $classes Body classes.
 *
 * @return array
 */
function wpbc_check_full_screen_mode_on_loading( $classes ) {

	$is_full_screen = WPBC_User_Custom_Data_Saver::get_user_data_value( wpbc_get_current_user_id(), 'is_full_screen' );
	$is_full_screen = wpbc_ui__get_full_screen_mode_from_cookie( $is_full_screen );
	$is_full_screen = ( 'On' === $is_full_screen );

	if ( ( wpbc_is_this_plugin_page() ) && ( $is_full_screen ) && ( ! wpbc_is_setup_wizard_page() ) ) {
		$classes .= ' wpbc_admin_full_screen';
	}

	return $classes;
}
add_filter( 'admin_body_class', 'wpbc_check_full_screen_mode_on_loading' );
