<?php /**
 * @version 1.0
 * @package Booking Calendar  -   JavaScript
 * @category Define JavaScript variables
 * @author wpdevelop
 *
 * @web-site https://wpbookingcalendar.com/
 * @email info@wpbookingcalendar.com
 *
 * @modified 19.10.2015
 */

if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly


/**
 * Get script string for localised variables.
 *
 * @return string
 */
function wpbc_get_localized_js_vars() {

	// $script  = 'var1 = '. wp_json_encode('var1') .'; ';      // JSON.parse(wpbc_global_var);  //.

	$script  = '';
	$script .= "_wpbc.set_other_param( 'locale_active', '" . esc_js( wpbc_get_maybe_reloaded_booking_locale() ) . "' ); ";

	// FixIn: 10.8.1.4.
	$gmt_time = gmdate( 'Y-m-d H:i:s', strtotime( 'now' ) );

	$script .= "_wpbc.set_other_param( 'time_gmt_arr', [" . wpbc_datetime_localized__no_wp_timezone( $gmt_time, 'Y,m,d,H,i' ) . ']  ); ';
	$script .= "_wpbc.set_other_param( 'time_local_arr', [" . wpbc_datetime_localized__use_wp_timezone( $gmt_time, 'Y,m,d,H,i' ) . ']  ); ';

	$unavailable_time_from_today = get_bk_option( 'booking_unavailable_days_num_from_today' );

	if ( ! empty( $unavailable_time_from_today ) ) {
		if ( 'm' === substr( $unavailable_time_from_today, - 1 ) ) {

			$gmt_time = gmdate( 'Y-m-d H:i:s', strtotime( '+' . ( intval( $unavailable_time_from_today ) - 1 ) . ' minutes' ) );

			// Local timezone unavailable time.                                                                         // FixIn: 10.9.6.3.
			$local_unavailable_datetime_ymdhis = wpbc_datetime_localized__use_wp_timezone( $gmt_time, 'Y-m-d H:i:s' );             // Local unavailable.
			// Local timezone Now time.
			$local_now_datetime_ymdhis = wpbc_datetime_localized__use_wp_timezone( strtotime( 'now' ), 'Y-m-d H:i:s' );            // Local Now.
			// Local timezone Today midnight time.
			$local_now_datetime_ymd000 = wpbc_datetime_localized__use_wp_timezone( strtotime( 'now' ), 'Y-m-d 00:00:00' );         // Local Midnight.

			// Check time from local MIDNIGHT to Unavailable.
			$days_number_shift           = intval( ( strtotime( $local_unavailable_datetime_ymdhis ) - strtotime( $local_now_datetime_ymd000 ) ) / 86400 );
			$unavailable_time_from_today = $days_number_shift;
			// $unavailable_time_from_today = '0'; // FixIn: 10.9.2.6.
		}
	} else {
		$unavailable_time_from_today = '0';
	}

	$today_local = wpbc_datetime_localized__use_wp_timezone( $gmt_time, 'Y,m,d,H,i' );

	$script .= "_wpbc.set_other_param( 'today_arr', [" . $today_local . "]  ); ";

	$script .= "_wpbc.set_other_param( 'url_plugin', '" . esc_url( plugins_url( '', WPBC_FILE ) ) . "' ); ";

	$get_booking_hash = ( ( isset( $_GET['booking_hash'] ) ) ? sanitize_text_field( wp_unslash( $_GET['booking_hash'] ) ) : '' );  /* phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing */ /* FixIn: sanitize_unslash */

	$script .= "_wpbc.set_other_param( 'this_page_booking_hash', '" . esc_js( $get_booking_hash ) . "'  ); ";


	$script .= "_wpbc.set_other_param( 'calendars__on_this_page', [] ); ";

	$script .= "_wpbc.set_other_param( 'calendars__first_day', '"   . intval( get_bk_option( 'booking_start_day_weeek' ) )   . "' ); ";                             //."\n";
	$script .= "_wpbc.set_other_param( 'calendars__max_monthes_in_calendar', '"   . esc_js( get_bk_option( 'booking_max_monthes_in_calendar' ) )   . "' ); ";
	// FixIn: 10.8.1.4.
	$script .= "_wpbc.set_other_param( 'availability__unavailable_from_today', '" . esc_js( $unavailable_time_from_today ) . "' ); ";    //Default: 0 '           Old JS: block_some_dates_from_today'		_wpbc.get_other_param( 'availability__unavailable_from_today' )
	if ( class_exists( 'wpdev_bk_biz_m' ) ) {
		$script .= "_wpbc.set_other_param( 'availability__available_from_today', '" . esc_js( get_bk_option( 'booking_available_days_num_from_today' ) ) . "' ); ";    //Default '' - all days. Old JS: 'wpbc_available_days_num_from_today'
	}
    $script .= "_wpbc.set_other_param( 'availability__week_days_unavailable', ["
                                                                    . ( ( get_bk_option( 'booking_unavailable_day0') == 'On' ) ? '0,' : '' )
				                                                    . ( ( get_bk_option( 'booking_unavailable_day1') == 'On' ) ? '1,' : '' )
				                                                    . ( ( get_bk_option( 'booking_unavailable_day2') == 'On' ) ? '2,' : '' )
				                                                    . ( ( get_bk_option( 'booking_unavailable_day3') == 'On' ) ? '3,' : '' )
				                                                    . ( ( get_bk_option( 'booking_unavailable_day4') == 'On' ) ? '4,' : '' )
				                                                    . ( ( get_bk_option( 'booking_unavailable_day5') == 'On' ) ? '5,' : '' )
				                                                    . ( ( get_bk_option( 'booking_unavailable_day6') == 'On' ) ? '6,' : '' )
				                                                    . "999] ); ";                                            // 999 - blank day, which will not impact  to the checking of the week days. Required for correct creation of this array.
	// General  days selection.
	$days_selection_arr = wpbc__calendar__js_params__get_days_selection_arr();

	$script .= "_wpbc.set_other_param( 'calendars__days_select_mode', '" . $days_selection_arr['days_select_mode'] . "' ); ";
	$script .= "_wpbc.set_other_param( 'calendars__fixed__days_num', " . $days_selection_arr['fixed__days_num'] . " ); ";
	$script .= "_wpbc.set_other_param( 'calendars__fixed__week_days__start',   [" . $days_selection_arr['fixed__week_days__start'] . "] ); ";
	$script .= "_wpbc.set_other_param( 'calendars__dynamic__days_min', " . $days_selection_arr['dynamic__days_min'] . " ); ";
	$script .= "_wpbc.set_other_param( 'calendars__dynamic__days_max', " . $days_selection_arr['dynamic__days_max'] . " ); ";
	$script .= "_wpbc.set_other_param( 'calendars__dynamic__days_specific',    [" . $days_selection_arr['dynamic__days_specific'] . "] ); ";
	$script .= "_wpbc.set_other_param( 'calendars__dynamic__week_days__start', [" . $days_selection_arr['dynamic__week_days__start'] . "] ); ";

	// FixIn: 10.3.0.9.
	if ( false !== strpos( get_bk_option( 'booking_skin' ), 'light__24_8' ) ) {
		$script .= "_wpbc.set_other_param( 'calendars__days_selection__middle_days_opacity', '0.5' ); ";
	} else {
		$script .= "_wpbc.set_other_param( 'calendars__days_selection__middle_days_opacity', '0.75' ); ";
	}


	// Defined in  BS.
	$script .= "_wpbc.set_other_param( 'is_enabled_booking_recurrent_time',  " . ( ( get_bk_option( 'booking_recurrent_time' ) !== 'On' ) ? 'false' : 'true' ) . " ); ";
	$script .= "_wpbc.set_other_param( 'is_allow_several_months_on_mobile',  " . ( ( get_bk_option( 'booking_calendar_allow_several_months_on_mobile' ) !== 'On' ) ? 'false' : 'true' ) . " ); ";
	$script .= "_wpbc.set_other_param( 'is_enabled_change_over',  "            . (
																						(
																							( function_exists( 'wpbc_is_booking_used_check_in_out_time' ) )
																					     && ( wpbc_is_booking_used_check_in_out_time() )
																						) ? 'true' : 'false'
																				  ) . " ); ";
	if ( class_exists( 'wpdev_bk_biz_l' ) ) {
		$script .= "_wpbc.set_other_param( 'is_enabled_booking_search_results_days_select', '" . esc_js( get_bk_option( 'booking_search_results_days_select' ) ) . "' ); ";
	}

	$script .= "_wpbc.set_other_param( 'update', '" . esc_attr( WP_BK_VERSION_NUM ) . "' ); ";
	$script .= "_wpbc.set_other_param( 'version', '" . wpbc_get_version_type__and_mu() . "' ); ";

	// Warning Messages.
	$script .= "_wpbc.set_message( 'message_dates_times_unavailable', "        . wp_json_encode( __( 'These dates and times in this calendar are already booked or unavailable.', 'booking' ) ) . " ); ";
	$script .= "_wpbc.set_message( 'message_choose_alternative_dates', "       . wp_json_encode( __( 'Please choose alternative date(s), times, or adjust the number of slots booked.', 'booking' ) ) . " ); ";
	$script .= "_wpbc.set_message( 'message_cannot_save_in_one_resource', "    . wp_json_encode( __( 'It is not possible to store this sequence of the dates into the one same resource.', 'booking' ) ) . " ); ";
	$script .= "_wpbc.set_message( 'message_check_required', "                 . wp_json_encode( __( 'This field is required', 'booking' ) ) . " ); ";
	$script .= "_wpbc.set_message( 'message_check_required_for_check_box', "   . wp_json_encode( __( 'This checkbox must be checked', 'booking' ) ) . " ); ";
	$script .= "_wpbc.set_message( 'message_check_required_for_radio_box', "   . wp_json_encode( __( 'At least one option must be selected', 'booking' ) ) . " ); ";
	$script .= "_wpbc.set_message( 'message_check_email', "                    . wp_json_encode( __( 'Incorrect email address', 'booking' ) ) . " ); ";
	$script .= "_wpbc.set_message( 'message_check_same_email', "               . wp_json_encode( __( 'Your emails do not match', 'booking' ) ) . " ); ";
	$script .= "_wpbc.set_message( 'message_check_no_selected_dates', "        . wp_json_encode( __( 'Please, select booking date(s) at Calendar.', 'booking' ) ) . " ); ";
	$script .= "_wpbc.set_message( 'message_processing', "                     . wp_json_encode( __( 'Processing', 'booking' ) ) . " ); ";
	$script .= "_wpbc.set_message( 'message_deleting', "                       . wp_json_encode( __( 'Deleting', 'booking' ) ) . " ); ";
	$script .= "_wpbc.set_message( 'message_updating', "                       . wp_json_encode( __( 'Updating', 'booking' ) ) . " ); ";
	$script .= "_wpbc.set_message( 'message_saving', "                         . wp_json_encode( __( 'Saving', 'booking' ) ) . " ); ";
	$script .= "_wpbc.set_message( 'message_error_check_in_out_time', "        . wp_json_encode( __( 'Error! Please reset your check-in/check-out dates above.', 'booking' ) ) . " ); ";
	$script .= "_wpbc.set_message( 'message_error_start_time', "               . wp_json_encode( __( 'Start Time is invalid. The date or time may be booked, or already in the past! Please choose another date or time.', 'booking' ) ) . " ); ";
	$script .= "_wpbc.set_message( 'message_error_end_time', "                 . wp_json_encode( __( 'End Time is invalid. The date or time may be booked, or already in the past. The End Time may also be earlier that the start time, if only 1 day was selected! Please choose another date or time.', 'booking' ) ) . " ); ";
	$script .= "_wpbc.set_message( 'message_error_range_time', "               . wp_json_encode( __( 'The time(s) may be booked, or already in the past!', 'booking' ) ) . " ); ";
	$script .= "_wpbc.set_message( 'message_error_duration_time', "            . wp_json_encode( __( 'The time(s) may be booked, or already in the past!', 'booking' ) ) . " ); ";

	$script .= "console.log( '== WPBC VARS " . esc_attr( WP_BK_VERSION_NUM ) . ' [' . wpbc_get_version_type__and_mu() . "] LOADED ==' );";
	return $script;
}


/**
 * Define General inline  JavaScript variables for the Booking Calendar
 * This function  run  after ENQUEUE of WPBC  JavaScript files
 *
 * @param string $where_to_load  - 'both'.
 *
 * @return void
 */
function wpbc_localize_js_vars( $where_to_load = 'both' ) {

	$script_before = 'var wpbc_url_ajax =' . wp_json_encode( admin_url( 'admin-ajax.php' ) ) . ';';
	wp_add_inline_script( 'wpbc_all', $script_before, 'before' );

	$script = wpbc_get_localized_js_vars();

	// Load this _wpbc only  after  loading of all scripts                                                              // FixIn: 10.1.3.4.
	$script  = ' function wpbc_init__head(){ ' . $script . ' } ';
	$script .= "( function() { if ( document.readyState === 'loading' ){ document.addEventListener( 'DOMContentLoaded', wpbc_init__head ); } else { wpbc_init__head(); } }() );";

	wp_add_inline_script( 'wpbc_all', $script );

	/**
	 * Help info. Order of JS events:
	 *
	 *  window.addEventListener("load", (event) => {     log.textContent += "load\n";  });                              -> window.onload (which is implemented even in old browsers), which fires when the entire page loads (images, styles, etc.)
	 *  document.addEventListener("readystatechange", (event) => { log.textContent += `readystate: ${document.readyState}\n`; });
	 *  document.addEventListener("DOMContentLoaded", (event) => { log.textContent += "DOMContentLoaded\n"; });         -> newish event which fires when the document's DOM is loaded (which may be some time before the images, etc. are loaded);
	 * ::
	 *  DOMContentLoaded
	 *  readystate: complete
	 *  load
	 */
}
add_action( 'wpbc_enqueue_js_files', 'wpbc_localize_js_vars', 51 );     // Need to  set  here 51,  because some JS has 50 priority,  for example at  WP Booking Calendar > Availability > Days Availability page       -> This hook fired after ENQUEUE of WPBC JS     -   wp_enqueue_script

