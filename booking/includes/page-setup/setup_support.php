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
function wpbc_setup_wizard_page__get_shortcode_html( $resource_id = 1 , $is_show_only_calendar = false ) {

	ob_start();
	if ( $is_show_only_calendar ) {
		// Center calendar
		?><style type="text/css">
			.wpbc_calendar_wraper {
			  display: flex;
			  flex-flow: column nowrap;
			  align-items: center;
			  justify-content: flex-start;
			}
			.wpbc_calendar_wraper div {
				margin-bottom: 10px;
			}
		</style>
		<div class="wpbc_shortcode_container"><?php
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

		// Help message
		?><div class="wpbc-settings-notice notice-warning notice-helpful-info" style="padding: 8px 20px;font-size: 14px;margin: 0 auto;max-width: Min(50em,100%);">
			<strong><?php _e('Note!','booking'); ?></strong>
			<?php
				_e( 'This is preview of your booking form.', 'booking' ); echo ' ';
				_e( 'You can setup parameters in widgets at right side of the page.', 'booking' );
				//echo '<a href="'. esc_attr( wpbc_get_settings_url() . '&scroll_to_section=wpbc_general_settings_availability_tab' ).'">Settings > Availability</a>';
			?>
		</div><?php

		// If we use the [bookingcalendar] shortcode,  then  we remove this tag,  for ability to  select  dates in calendar.
		?><script type="text/javascript">
			jQuery( document ).ready( function () {
				_wpbc.set_other_param( 'calendars__on_this_page', [] );
				<?php if ( 'On' === get_bk_option( 'booking_timeslot_picker') ) { ?>
				wpbc_hook__init_timeselector();
				<?php } ?>
				wpbc_hook__init_booking_form_wizard_buttons();
			  	// wpbc__calendar__change_skin( '<?php echo WPBC_PLUGIN_URL . get_bk_option( 'booking_skin' ); ?>' );
			  	// wpbc__css__change_skin( '<?php echo WPBC_PLUGIN_URL . get_bk_option( 'booking_timeslot_picker_skin' ); ?>' );
				<?php if ('wpbc_theme_dark_1' === get_bk_option( 'booking_form_theme' ) ){  ?>
				jQuery( '.wpbc_widget_preview_booking_form .wpbc_center_preview,.wpbc_widget_preview_booking_form .wpbc_container.wpbc_container_booking_form,.wpbc_widget_preview_booking_form .wpbc_widget_content' ).addClass( 'wpbc_theme_dark_1' );
				<?php } ?>
				if ( 'function' === typeof( wpbc_update_capacity_hint ) ) {
					jQuery( '.booking_form_div' ).on( 'wpbc_booking_date_or_option_selected', function ( event, resource_id ) {
						wpbc_update_capacity_hint( resource_id );
					} );
				}
				//jQuery( 'body' ).on( 'wpbc_datepick_inline_calendar_loaded', function ( event, resource_id, jCalContainer, inst ) { });
				// jQuery( 'body' ).off( 'wpbc_calendar_ajx__loaded_data' );
				// jQuery( 'body' ).on( 'wpbc_calendar_ajx__loaded_data', function ( event, loaded_resource_id ){
				// 	// wpbc_blink_element( '.wpbc_widget_change_form_structure', 3, 220 );
				//  	wpbc_blink_element( '#ui_btn_cstm__set_booking_form_template_pro', 2, 220 );
				//  	wpbc_blink_element( '#ui_btn_cstm__set_booking_form_template_apply', 4, 220 );
				// });

				// jQuery( 'body' ).on( 'wpbc_calendar_ajx__before_loaded_data', function( event, resource_id ) {
				// 	wpbc_calendar__loading__stop( resource_id );
				// } );
			});
			//if ( 'undefined' !== typeof _wpbc ) {
			//	<?php
    		//	echo "_wpbc.set_other_param( 'availability__week_days_unavailable', ["
            //                                                        . ( ( get_bk_option( 'booking_unavailable_day0') == 'On' ) ? '0,' : '' )
			//	                                                    . ( ( get_bk_option( 'booking_unavailable_day1') == 'On' ) ? '1,' : '' )
			//	                                                    . ( ( get_bk_option( 'booking_unavailable_day2') == 'On' ) ? '2,' : '' )
			//	                                                    . ( ( get_bk_option( 'booking_unavailable_day3') == 'On' ) ? '3,' : '' )
			//	                                                    . ( ( get_bk_option( 'booking_unavailable_day4') == 'On' ) ? '4,' : '' )
			//	                                                    . ( ( get_bk_option( 'booking_unavailable_day5') == 'On' ) ? '5,' : '' )
			//	                                                    . ( ( get_bk_option( 'booking_unavailable_day6') == 'On' ) ? '6,' : '' )
			//	                                                    . "999] ); ";
			//	 ?>
			//}
		</script><?php

		?><div class="wpbc_shortcode_container"><?php
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


