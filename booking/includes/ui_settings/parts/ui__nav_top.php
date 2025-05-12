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
		'attr' => array(),
	);
	$params   = wp_parse_args( $args, $defaults );

	echo '<div class="wpbc_ui_el wpbc_ui_el__top_nav">';

	wpbc_ui__vert_left_bar__do_toggle();
	wpbc_ui_el__divider_vertical( array( 'class' => 'wpbc_ui_el__vertical_line wpbc_ui__top_nav__btn_show_left_vertical_nav_divider' ) );

	wpbc_ui__top_nav__dropdown__wpbc();


	// Load Top News Message and "Search by ID" fields.
	echo '<style type="text/css"> .wpbc_message_wrapper  { margin-left: 0px !important; } </style>';
	make_bk_action( 'wpbc_h1_header_content_end', $params['page_tag'], $params['active_page_tab'], $params['active_page_subtab'] );

	wpbc_ui_el__divider_vertical( array( 'container_class' => 'wpbc_ui_el__flex_right' ) );

	// Full Screen Buttons.
	wpbc_ui__top_nav__btn_full_screen();

	wpbc_ui__top_nav__btn_normal_screen();

	echo '</div>';
}



/**
 * Show element - "WPBC - Main Dropdown"
 *
 * @return void
 */
function wpbc_ui__top_nav__dropdown__wpbc() {

	$svg_size       = '22px';
	$svg_icon_style = '';// 'margin:0 5px 0 0;';//'background-position: 0 0;background-size: ' . $svg_size . ' ' . $svg_size . ';width: ' . $svg_size . ';height: ' . $svg_size . ';';
	$svg_icon       = wpbc_get_svg_logo_for_background( '#555', '#e5e5e5', '1.0' );

	$el_arr = array(
		// 'title'        => 'Booking Calendar',
		// 'font_icon'    => 'wpbc-bi-calendar2-range',
		'title_html'	 => '<span class="nav-tab-text" style="margin: -11px 0 0 5px;font-size: 16px;padding: 0;"><span style="position: absolute;font-size: 7px;margin-top: 13px;margin-left: 1px;">WP</span>Booking Calendar</span>',
				'svg_icon'       => $svg_icon,
				'svg_icon_style' => $svg_icon_style,
				'style' 		 => 'display: flex;flex-flow:row nowrap;align-items: center;justify-content: flex-start;',
				'container_style' => 'padding: 0 5px 0 10px;',
		'position'       => 'left',
		'has_down_arrow' => true,
		'items'          => array(
			array(
				'type'  => 'header',
				'title' => __( 'Help', 'booking' ),
			),
			array(
				'type'  => 'link',
				'title' => __( 'FAQ', 'booking' ),
				'url'   => 'https://wpbookingcalendar.com/faq/',
			),
			array(
				'type'  => 'header',
				'title' => __( 'Support', 'booking' ),
			),
			array(
				'type'  => 'link',
				'title' => __( 'Support Forum', 'booking' ),
				'url'   => 'https://wpbookingcalendar.com/support/',
			),
			array(
				'type'  => 'link',
				'title' => __( 'Contact Support', 'booking' ),
				'url'   => 'mailto:support@wpbookingcalendar.com',
				'attr'  => array( 'style' => 'font-weight: 600;' ),
			),
			array( 'type' => 'divider' ),
			array(
				'type'  => 'link',
				'title' => __( 'What\'s New', 'booking' ),
				'url'   => 'https://wpbookingcalendar.com/wn/',
			),
			array(
				'type'  => 'link',
				'title' => __( 'About', 'booking' ),
				'url'   => 'https://wpbookingcalendar.com/',
			),
		),
	);

	wpbc_ui_el__dropdown_menu( $el_arr );
}


/**
 * Show element - "Full Screen"
 *
 * @return void
 */
function wpbc_ui__top_nav__btn_full_screen() {

	$el_arr = array();

	$el_arr['onclick']  = "jQuery( '.wpbc_ui__top_nav__btn_full_screen,.wpbc_ui__top_nav__btn_normal_screen' ).toggleClass( 'wpbc_ui__hide' );";
	$el_arr['onclick'] .= "jQuery('body').toggleClass('wpbc_admin_full_screen');wpbc_check_full_screen_mode();";

	$el_arr['font_icon'] = 'wpbc-bi-arrows-fullscreen';
	$el_arr['hint']      = array(
		'title'    => __( 'Full Screen', 'booking' ),
		'position' => 'top',
	);
	$el_arr['container_class'] = 'wpbc_ui__top_nav__btn_full_screen';
	wpbc_ui_el__a( $el_arr );
}


/**
 * Show element - "Normal Screen"
 *
 * @return void
 */
function wpbc_ui__top_nav__btn_normal_screen() {

	$el_arr = array();

	$el_arr['onclick']  = "jQuery( '.wpbc_ui__top_nav__btn_full_screen,.wpbc_ui__top_nav__btn_normal_screen' ).toggleClass( 'wpbc_ui__hide' );";
	$el_arr['onclick'] .= "jQuery('body').toggleClass('wpbc_admin_full_screen');wpbc_check_full_screen_mode();";

	$el_arr['title']     = '';
	$el_arr['font_icon'] = 'wpbc-bi-arrows-angle-contract';
	$el_arr['hint']      = array(
		'title'    => __( 'Exit Full Screen', 'booking' ),
		'position' => 'top',
	);
	$el_arr['container_class'] = 'wpbc_ui__top_nav__btn_normal_screen wpbc_ui__hide';
	wpbc_ui_el__a( $el_arr );
}