<?php /**
 * @version 1.0
 * @description Support functions for the Setup Wizard Page
 * @category    Setup Class
 * @author wpdevelop
 *
 * @web-site http://oplugins.com/
 * @email info@oplugins.com
 *
 * @modified 2024-09-06
 */

if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly


// =====================================================================================================================
// ==  Shortcodes Content  ==
// =====================================================================================================================

/**
 *  Get "Booking Form" Shortcode Content
 *
 * @param $resource_id
 *
 * @return false|string
 */
function wpbc_setup_wizard_page__get_shortcode_html( $resource_id = 1 ) {

	ob_start();
	if ( 0 ) {
		?><div style="width: auto;margin: auto;min-width: 341px;"><?php		//margin-top:-10px;
			echo do_shortcode( '[bookingcalendar resource_id=' . $resource_id . ']' );
		?></div><?php

		// If we use the [bookingcalendar] shortcode,  then  we remove this tag,  for ability to  select  dates in calendar.
		?><script tye="text/javascript">
			jQuery(document).ready(function(){
				jQuery( 'body' ).on( 'wpbc_calendar_ajx__loaded_data', function( event, resource_id ) {
					jQuery( '#calendar_booking_unselectable' + resource_id ).remove();
				} );
			});
		</script><?php

	} else {


		// If we use the [bookingcalendar] shortcode,  then  we remove this tag,  for ability to  select  dates in calendar.
		?><script tye="text/javascript">
			jQuery(document).ready(function(){
				_wpbc.set_other_param( 'calendars__on_this_page', [] );
			});
		</script><?php

		?><div style="width: 100%;max-width: 880px;min-width: 341px;margin: auto;margin-top:calc( -1.7em - calc(0.25em + 8px) );"><?php
			echo do_shortcode( '[booking resource_id=' . $resource_id . ']' );
		?></div><?php
	}

	return  ob_get_clean();
}



//TODO: Left Menu - TEMP . Delete it ?
function wpbc_setup_wizard_page__get_left_navigation_menu_arr(){

   $navigation_menu_arr = array();

	$navigation_menu_arr['general_info'] = array(
												'title'  => __( 'General Info', 'booking' ),
												'icon'   => 'wpbc_icn_check wpbc_icn_dashboard0  wpbc_icn_task_alt0  0wpbc_icn_circle_outline',
												'class'  => '',
												//'style'  => 'cursor:not-allowed;',
												//'a_style'  => 'pointer-events: none;',
												'action' => "wpbc_ajx__setup_wizard_page__send_request_with_params( { 'current_step':'general_info' } );"
											   ,'right_icon'   => array(
														'icon' 	 => '',
														'text' 	 => __('Done', 'booking'),
														'action' => "console.log( this );",
													)

											);
	$navigation_menu_arr['calendar_days_selection'] = array(
												'title'  => __( 'Bookings Type', 'booking' ),
												'icon'   => 'wpbc-bi-calendar2-range 0wpbc_icn_radio_button_checked',
												'class'  => '',
												//'a_style'  => 'color: var(--wpbc_settings__nav_menu_left__active_border_color);',
												'action' => "wpbc_ajx__setup_wizard_page__send_request_with_params( { 'current_step':'calendar_days_selection' } );"
											);
	$navigation_menu_arr['next_step'] = array(
												'title'  => '',//__( 'Bookings Type', 'booking' ),
												'icon'   => 'wpbc-bi-three-dots 0wpbc_icn_radio_button_unchecked',
												'class'  => '',
												'a_style'  => 'pointer-events: none;cursor:not-allowed;',
												'action' => "wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );"
											);
//			$navigation_menu_arr['booking_notification'] = array(
//														'title'  => __( 'Publishing', 'booking' ),
//														'icon'   => 'wpbc-bi-calendar2-range',
//														'class'  => 'wpbc_top_border',
//														'action' => "wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );",
//																		'right_icon'   => array(
//																'icon' 	 => 'wpbc_icn_navigate_next expand_more',
//																'action' => "console.log( this );",
//															)
//													);
//			$navigation_menu_arr['booking_form'] = array(
//														'title'  => __( 'Booking Form', 'booking' ),
//														'icon'   => 'wpbc_icn_dashboard',
//														'class'  => 'wpbc_sub_option',
//														'action' => "wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );"
//													);

	return $navigation_menu_arr;
}


