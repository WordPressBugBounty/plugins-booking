<?php /**
 * @version 1.0
 * @package Booking Calendar
 * @category Simple Booking Form Setup
 * @author wpdevelop
 *
 * @web-site https://wpbookingcalendar.com/
 * @email info@wpbookingcalendar.com
 *
 * @modified 2024-08-16
 */

if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly


/**
 * Get  'Blank Visual Structure'    of booking form
 *
 * It can be imported from very old Free version,  if such options exist in plugin DB,  otherwise it is blank template
 *
 * @return array
 */
function wpbc_simple_form__visual__get_default_form() {

    $visual_form_structure = array();

    // calendar
	$visual_form_structure[] = array(
										'type'              => 'calendar',
										'name'              => 'calendar',
										'obligatory'        => 'On',
										'if_exist_required' => 'On',
										'label'             => ''               //__('Select date', 'booking')
									);

    $visual_form_structure[] = array(
									'type'              => 'selectbox',
									'name'              => 'rangetime',
									'obligatory'        => 'Off',
									'active'            => 'On',
									'required'          => 'On',
									'if_exist_required' => 'On',
									'label'             => __( 'Time Slots', 'booking' ),
									'value' =>     '9:00 AM - 10:00 AM@@09:00 - 10:00' . "\r\n"
												. '10:00 AM - 11:00 AM@@10:00 - 11:00' . "\r\n"
								         . '11:00 AM - 12:00 PM (Noon)@@11:00 - 12:00' . "\r\n"
						                  . '12:00 PM (Noon) - 1:00 PM@@12:00 - 13:00' . "\r\n"
										          . '1:00 PM - 2:00 PM@@13:00 - 14:00' . "\r\n"
												  . '2:00 PM - 3:00 PM@@14:00 - 15:00' . "\r\n"
												  . '3:00 PM - 4:00 PM@@15:00 - 16:00' . "\r\n"
												  . '4:00 PM - 5:00 PM@@16:00 - 17:00' . "\r\n"
												  . '5:00 PM - 6:00 PM@@17:00 - 18:00' . "\r\n"
												  . '6:00 PM - 7:00 PM@@18:00 - 19:00' . "\r\n"
												           . 'Full Day@@00:00 - 24:00'
								);
    // First Name
	$visual_form_structure[] = array(
										'type'       => 'text',
										'name'       => 'name',
										'obligatory' => 'Off',
										'active'     => empty( get_bk_option( 'booking_form_field_active1' ) )   ? 'On' : get_bk_option( 'booking_form_field_active1' ),
										'required'   => empty( get_bk_option( 'booking_form_field_required1' ) ) ? 'On' : get_bk_option( 'booking_form_field_required1' ),
										'label'      => empty( get_bk_option( 'booking_form_field_label1' ) )    ? __( 'First Name', 'booking' ) : get_bk_option( 'booking_form_field_label1' )
									);
    // Second Name
	$visual_form_structure[] = array(
										'type'       => 'text',
										'name'       => 'secondname',
										'obligatory' => 'Off',
										'active'     => empty( get_bk_option( 'booking_form_field_active2' ) )   ? 'On' : get_bk_option( 'booking_form_field_active2' ),
										'required'   => empty( get_bk_option( 'booking_form_field_required2' ) ) ? 'On' : get_bk_option( 'booking_form_field_required2' ),
										'label'      => empty( get_bk_option( 'booking_form_field_label2' ) )    ? __( 'Second Name', 'booking' ) : get_bk_option( 'booking_form_field_label2' )
									);
    // Email
	$visual_form_structure[] = array(
										'type'       => 'email',
										'name'       => 'email',
										'obligatory' => 'On',
										'active'     => 'On',
										'required'   => 'On',
										'label'      => empty( get_bk_option( 'booking_form_field_label3' ) )    ? __( 'Email', 'booking' ) : get_bk_option( 'booking_form_field_label3' )
									);
	
    // Visitors
	$visual_form_structure[] = array(
										'type'       => 'selectbox',
										'name'       => 'visitors',
										'obligatory' => 'Off',
										'active'     => empty( get_bk_option( 'booking_form_field_active6' ) )   ? 'On' : get_bk_option( 'booking_form_field_active6' ),
										'required'   => empty( get_bk_option( 'booking_form_field_required6' ) ) ? 'Off' : get_bk_option( 'booking_form_field_required6' ),
										'label'      => empty( get_bk_option( 'booking_form_field_label6' ) )    ? __( 'Visitors', 'booking' ) : get_bk_option( 'booking_form_field_label6' ),
										'value'      => (empty( get_bk_option( 'booking_form_field_values6' ) )
															? ( '1' . "\r\n" . '2' . "\r\n" . '3' . "\r\n" . '4' )
															: get_bk_option( 'booking_form_field_values6' ) )
									);
    // Phone
	$visual_form_structure[] = array(
										'type'       => 'text',
										'name'       => 'phone',
										'obligatory' => 'Off',
										'active'     => empty( get_bk_option( 'booking_form_field_active4' ) )   ? 'On' : get_bk_option( 'booking_form_field_active4' ),
										'required'   => empty( get_bk_option( 'booking_form_field_required4' ) ) ? 'Off' : get_bk_option( 'booking_form_field_required4' ),
										'label'      => empty( get_bk_option( 'booking_form_field_label4' ) )    ? __( 'Phone', 'booking' ) : get_bk_option( 'booking_form_field_label4' )
									);
    // Details  -  textarea
	$visual_form_structure[] = array(
										'type'       => 'textarea',
										'name'       => 'details',
										'obligatory' => 'Off',
										'active'     => empty( get_bk_option( 'booking_form_field_active5' ) )   ? 'On' : get_bk_option( 'booking_form_field_active5' ),
										'required'   => empty( get_bk_option( 'booking_form_field_required5' ) ) ? 'Off' : get_bk_option( 'booking_form_field_required5' ),
										'label'      => empty( get_bk_option( 'booking_form_field_label5' ) )    ? __( 'Details', 'booking' ) : get_bk_option( 'booking_form_field_label5' )
									);
	// CAPTCHA
	$visual_form_structure[] = array(
										'type'              => 'captcha',
										'name'              => 'captcha',
										'obligatory'        => 'Off',
										'active'            => ( get_bk_option( 'booking_is_use_captcha' ) == 'On' ) ? 'On' : 'Off',
										'required'          => 'On',
										'if_exist_required' => 'On',
										'label'             => ''
									);


	// Submit
	$visual_form_structure[] = array(
										'type'              => 'submit',
										'name'              => 'submit',
										'obligatory'        => 'On',
										'active'            => 'On',
										'required'          => 'On',
										'if_exist_required' => 'On',
										'label'             => empty( get_bk_option( 'booking_send_button_title' ) ) ? __( 'Send', 'booking' ) : get_bk_option( 'booking_send_button_title' )
									);
	
    return $visual_form_structure;
}

