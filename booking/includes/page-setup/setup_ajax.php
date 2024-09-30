<?php /**
 * @version 1.0
 * @description Ajax and Requests Structure  for   WPBC_AJX__Setup__Ajax_Request
 * @category   Setup Class
 * @author wpdevelop
 *
 * @web-site http://oplugins.com/
 * @email info@oplugins.com
 *
 * @modified 2023-06-23
 */

if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly

// =====================================================================================================================
// ==  Get RULES STRUCTURE  ==
// =====================================================================================================================

/**
* Get params names for escaping and/or default value of such  params
*
* @return array        array (  'resource_id'      => array( 'validate' => 'digit_or_csd',  	'default' => array( '1' ) )
*                             , ... )
*/
function wpbc_setup_wizard_page__request_rules_structure() {

	return array(
		'do_action' => array(
			'validate' => array(
								'none',
								'save_and_continue',
								'make_reset', 'skip_wizard',
								'save_and_continue__welcome',
								'save_and_continue__general_info',
								'save_and_continue__bookings_types',
								'save_and_continue__calendar_days_selection',
								'save_and_continue__calendar_skin'
						),
			'default'  => 'none'
		),
		'current_step'          => array( 'validate' => 's', 'default' => '' ),
		'resource_id'           => array( 'validate' => 'd', 'default' => wpbc_get_default_resource() ),
		'ui_clicked_element_id' => array( 'validate' => 's', 'default' => '' )
		// 'calendar__booking_start_day_weeek' => array( 'validate' => array( '0', '1', '2', '3', '4', '5', '6' ), 'default'  => get_bk_option( 'booking_start_day_weeek' ) )
	);
}


	/**
	 * Get default params
	 *
	 * @return array        array (  'ui_wh_modification_date_radio' => 0
	 *                             , ... )
	 */
	function wpbc_setup_wizard_page__get__request_values__default(){

		$request_rules_structure = wpbc_setup_wizard_page__request_rules_structure();

		$default_params_arr = array();

		$structure_type = 'default';

		foreach ( $request_rules_structure as $key => $value ) {
			$default_params_arr[ $key ] = $value[ $structure_type ];
		}

		return $default_params_arr;
	}


// =====================================================================================================================
// ==  Get sanitised Request parameters  for  Ajax  ==
// =====================================================================================================================

/**
 * Get sanitised request parameters. |  01. -> Firstly check if user saved request params in user_meta DB.
 *                                   |  02. -> Otherwise check      $_REQUEST.
 *                                   |  03. -> Otherwise Get        default.
 *
 * @return array|false
 */
function wpbc_setup_wizard_page__get_cleaned_params__saved_request_default(){

	// User Specific Experience with Setup -> saved to user meta_table.
	// E.g. next  time user  open the page with  saved own settings
	$user_request = new WPBC_AJX__REQUEST( array(
											   'db_option_name'          => 'booking_setup_wizard_page_request_params',
											   'user_id'                 => wpbc_get_current_user_id(),
											   'request_rules_structure' => wpbc_setup_wizard_page__request_rules_structure()
											)
					);

	// -----------------------------------------------------------------------------------------------------------------
	// Get saved from DB
	// -----------------------------------------------------------------------------------------------------------------
	$escaped_request_params_arr = $user_request->get_sanitized__saved__user_request_params();


	// -----------------------------------------------------------------------------------------------------------------
	// Get $_REQUEST or Default      ::       This request was not saved before, then get sanitized direct parameters   , such as: 	$_REQUEST['resource_id']
	// -----------------------------------------------------------------------------------------------------------------
	if ( false === $escaped_request_params_arr ) {
		$request_prefix = false;
		$escaped_request_params_arr = $user_request->get_sanitized__in_request__value_or_default( $request_prefix  );
	}

	// -----------------------------------------------------------------------------------------------------------------
	// ==  O V E R R I D E    - DB params  by  the params from  REQUEST!  ==
	// -----------------------------------------------------------------------------------------------------------------
	$request_key = 'current_step';
    if ( isset( $_REQUEST[ $request_key ] ) ) {

		 // Get SANITIZED REQUEST parameters together with default values
		$request_prefix = false;
		$url_request_params_arr = $user_request->get_sanitized__in_request__value_or_default( $request_prefix  );		 		// Direct: 	$_REQUEST['resource_id']

		// Now get only SANITIZED values that exist in REQUEST
		$url_request_params_only_arr = array_intersect_key( $url_request_params_arr, $_REQUEST );

		// And now override our DB  $escaped_request_params_arr  by  SANITIZED $_REQUEST values
		$escaped_request_params_arr  = wp_parse_args( $url_request_params_only_arr, $escaped_request_params_arr );
	}
	// ---------------------------------------------------------------------------------------------------------

	//	//MU
	//	if ( class_exists( 'wpdev_bk_multiuser' ) ) {
	//
	//		// Check if this MU user activated or super-admin,  otherwise show warning
	//		if ( ! wpbc_is_mu_user_can_be_here('activated_user') )
	//			return  false;
	//
	//		// Check if this MU user owner of this resource or super-admin,  otherwise show warning
	//		if ( ! wpbc_is_mu_user_can_be_here( 'resource_owner', $escaped_request_params_arr['resource_id'] ) ) {
	//			$default_values = $user_request->get_request_rules__default();
	//			$escaped_request_params_arr['resource_id'] = $default_values['resource_id'];
	//		}
	//	}

    return $escaped_request_params_arr;
}


// =====================================================================================================================
// ==  A J A X  ==
// =====================================================================================================================

class WPBC_AJX__Setup_Wizard__Ajax_Request {


	/**
	 * Define HOOKs for start  loading Ajax
	 */
	public function define_ajax_hook(){

		// Ajax Handlers.		Note. "locale_for_ajax" rechecked in wpbc-ajax.php
		add_action( 'wp_ajax_'		     . 'WPBC_AJX_SETUP_WIZARD_PAGE', array( $this, 'ajax_' . 'WPBC_AJX_SETUP_WIZARD_PAGE' ) );	    // Admin & Client (logged in usres)

		// Ajax Handlers for actions
		// add_action( 'wp_ajax_nopriv_' . 'WPBC_AJX_BOOKING_LISTING', array( $this, 'ajax_' . 'WPBC_AJX_BOOKING_LISTING' ) );	    // Client         (not logged in)
	}


	/**
	 * Ajax - Get Listing Data and Response to JS script
	 */
	public function ajax_WPBC_AJX_SETUP_WIZARD_PAGE() {

		if ( ! isset( $_POST['all_ajx_params'] ) || empty( $_POST['all_ajx_params'] ) ) { exit; }

		// -------------------------------------------------------------------------------------------------------------
		// ==  Security  ==         ->   in Ajax Post:   'nonce': wpbc_ajx_booking_listing.get_secure_param( 'nonce' )
		// -------------------------------------------------------------------------------------------------------------
		$action_name    = 'wpbc_setup_wizard_page_ajx' . '_wpbcnonce';
		$nonce_post_key = 'nonce';
		$result_check   = check_ajax_referer( $action_name, $nonce_post_key );

		$user_id = ( isset( $_REQUEST['wpbc_ajx_user_id'] ) )  ?  intval( $_REQUEST['wpbc_ajx_user_id'] )  :  wpbc_get_current_user_id();

		// -------------------------------------------------------------------------------------------------------------
		// ==  Request  ==          ->  $_REQUEST['all_ajx_params']['page_num'],   $_REQUEST['all_ajx_params']['page_items_count'], ...
		// -------------------------------------------------------------------------------------------------------------
		$user_request = new WPBC_AJX__REQUEST( array(
												   'db_option_name'          => 'booking_setup_wizard_page_request_params',
												   'user_id'                 => $user_id,
												   'request_rules_structure' => wpbc_setup_wizard_page__request_rules_structure()
												)
						);
		//--------------------------------------------------------------------------------------------------------------
		// If in Ajax:   all_ajx_params: _wpbc_settings.get_all_..()  ->  Use prefix "all_ajx_params"       THEN        Sanitize required REQUEST params
		//--------------------------------------------------------------------------------------------------------------
		$request_prefix = 'all_ajx_params';
		$cleaned_request_params = $user_request->get_sanitized__in_request__value_or_default( $request_prefix  );		// NOT Direct: 	$_REQUEST['all_ajx_params']['resource_id']
		//--------------------------------------------------------------------------------------------------------------

		$data_arr = array();
		$data_arr['ajx_after_action_message'] = '';
		$data_arr['ajx_after_action_result']  = 1;      // Message Type:   ? '1' => 'success' : 'error'


		//--------------------------------------------------------------------------------------------------------------
		// Steps
		//--------------------------------------------------------------------------------------------------------------
		$data_arr ['current_step']  = ( ! empty( $cleaned_request_params['current_step'] )
										? $cleaned_request_params['current_step']
										: wpbc_setup_wizard_page__get_active_step_name() );       // e.g. 'general_info' or 'calendar_days_selection'

		$data_arr ['steps'] = wpbc_setup_wizard_page__get_steps_arr();


		// =============================================================================================================
		// ==  Do Action  ==
		// =============================================================================================================
		switch ( $cleaned_request_params['do_action'] ) {

			// ---------------------------------------------------------------------------------------------------------
			// ==  RESET  ==
			// ---------------------------------------------------------------------------------------------------------
			case 'make_reset':

				$is_reseted = $user_request->user_request_params__db_delete();											// Delete from DB

				$cleaned_request_params['do_action'] = $is_reseted ? 'reset_done' : 'reset_error';

				$cleaned_request_params = wpbc_setup_wizard_page__get__request_values__default();

				$data_arr['ajx_after_action_message'] = __( 'Start Setup from Beginning', 'booking' );

				// Clear here DATES selection in $cleaned_request_params['dates_selection'] to  not save such  selection


				$data_arr ['current_step'] = 'welcome';

				wpbc_setup_wizard_page__db__set_all_steps_as( false );      // Clear All Steps      Mark as Undone
				break;

			case 'skip_wizard':

				$data_arr ['current_step'] = 'welcome';
				$data_arr ['redirect_url'] = wpbc_get_settings_url();

				wpbc_setup_wizard_page__db__set_all_steps_as( true );      // Mark All Steps as Done
				break;

			case 'save_and_continue__welcome':

				wpbc_setup_wizard_page__db__set_step_as_completed( 'welcome' );
				break;

			case 'save_and_continue__bookings_types':

				wpbc_setup_wizard_page__db__set_step_as_completed( 'bookings_types' );
				break;

			case 'save_and_continue__general_info':

				wpbc_setup_wizard_page__db__set_step_as_completed( 'general_info' );
				break;

			case 'save_and_continue__calendar_days_selection':

				wpbc_setup_wizard_page__db__set_step_as_completed( 'calendar_days_selection' );
				break;

			case 'save_and_continue__calendar_skin':


				wpbc_setup_wizard_page__db__set_step_as_completed( 'calendar_skin' );
				break;

			default:
				// Default
		}

		//--------------------------------------------------------------------------------------------------------------
		// Other
		//--------------------------------------------------------------------------------------------------------------
		$data_arr['steps_is_done']   = wpbc_setup_wizard_page__db__get_steps_is_done();
		$data_arr['left_navigation'] = wpbc_setup_wizard_page__get_left_navigation_menu_arr();
		$data_arr['calendar_force_load'] = ( 'calendar_days_selection' === $data_arr ['current_step'] )
											? wpbc_setup_wizard_page__get_shortcode_html( $cleaned_request_params['resource_id'] )
											: '';
		$data_arr['plugin_menu__setup_progress'] = wpbc_get_plugin_menu_title__setup_progress();


if(0){

		$data_arr['customize_steps'] = array();
		$data_arr['customize_steps']['action']    = 'none';

		// Actions =================================================================================================

		if ( 'save_calendar_additional' == $cleaned_request_params['do_action'] ) {

			$is_updated = update_bk_option( 'booking_max_monthes_in_calendar',  $cleaned_request_params['calendar__booking_max_monthes_in_calendar'] );
			$is_updated = update_bk_option( 'booking_start_day_weeek',          $cleaned_request_params['calendar__booking_start_day_weeek'] );
		}

        //----------------------------------------------------------------------------------------------------------

		// Get booking resources (sql)
		$resources_arr = wpbc_ajx_get_all_booking_resources_arr();          /**
																			 * Array (   [0] => Array (     [booking_type_id] => 1
																											[title] => Standard
																											[users] => 1
																											[import] =>
																											[export] =>
																											[cost] => 25
																											[default_form] => standard
																											[prioritet] => 0
																											[parent] => 0
																											[visitors] => 2
																				), ...                  */

		$resources_arr_sorted = wpbc_ajx_get_sorted_booking_resources_arr( $resources_arr );

		$data_arr['ajx_booking_resources'] = $resources_arr_sorted;
}



		// Save Status of Wizard for specific user
		if ( 'make_reset' !== $cleaned_request_params['do_action'] ) {

			$request_params_to_save = $cleaned_request_params;

			// Do not safe such elements
			unset( $request_params_to_save['ui_clicked_element_id'] );
			unset( $request_params_to_save['do_action'] );

			unset( $request_params_to_save['calendar_force_load'] );
			unset( $request_params_to_save['plugin_menu__setup_progress'] );


			//			// Clear here DATES selection in $cleaned_request_params['dates_selection'] to  not save such  selection
			//			unset( $request_params_to_save['dates_selection'] );
			//			// Do not save "Do not change background color for partially booked days" option ! it must reflect from Booking > Settings General page and not from User options
			//			unset( $request_params_to_save['calendar__timeslot_day_bg_as_available'] );                                    //FixIn: 9.5.5.4

			$is_success_update = $user_request->user_request_params__db_save( $request_params_to_save );					// Save to DB		// - $cleaned_request_params - serialized here automatically
		}


		// -------------------------------------------------------------------------------------------------------------
		// Send JSON.   It will make "wp_json_encode" - so pass only array, and This function call wp_die( '', '', array( 'response' => null, ) )		Pass JS OBJ: response_data in "jQuery.post( " function on success.
		// -------------------------------------------------------------------------------------------------------------
		wp_send_json( array(
							'ajx_data'              => $data_arr,
							'ajx_all_ajx_params'    => $_REQUEST[ $request_prefix ],			 					    // $_REQUEST[ 'all_ajx_params' ]
							'ajx_cleaned_params'    => $cleaned_request_params
						) );
	}

}

/**
 * Just for loading CSS and  JavaScript files
 */
if ( true ) {
	$setup_wizard_page_loading = new WPBC_AJX__Setup_Wizard__Ajax_Request;
	$setup_wizard_page_loading->define_ajax_hook();
}