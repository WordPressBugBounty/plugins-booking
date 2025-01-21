<?php
/*
* @package: Settings > General Page
* @category: Settings Page
* Author: wpdevelop, oplugins
* Version: 1.0
* @modified 2024-08-06
*/
// FixIn: 10.4.0.2.
if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly


/** Show Content
 *  Update Content
 *  Define Slug
 *  Define where to show
 */
class WPBC_Page_Settings_All extends WPBC_Page_Structure {


   	public function __construct() {

        parent::__construct();

		//add_action( 'wpbc_toolbar_top_tabs_insert', array( $this, 'wpbc_toolbar_toolbar_tabs' ) );
	    add_action( 'wpbc_page_show_left_navigation_custom', array( $this, 'left_navigation_custom__settings_all' ) );
    }


    public function in_page() {
        return 'wpbc-settings';
    }


    public function tabs() {

        $tabs = array();
        $tabs[ 'all' ] = array(
                              'title'		=> __( 'Settings', 'booking' )						// Title of TAB
                            , 'hint'		=> __( 'General Settings', 'booking' ) //. ' - '	 . 'Booking Calendar'					// Hint
                            , 'page_title'	=> __( 'General Settings', 'booking' ) 					// Title of Page
                            , 'link'		=> ''								// Can be skiped,  then generated link based on Page and Tab tags. Or can  be extenral link
                            , 'position'	=> ''                               // 'left'  ||  'right'  ||  ''
                            , 'css_classes' => ''                               // CSS class(es)
                            , 'icon'		=> ''                               // Icon - link to the real PNG img
                            , 'font_icon'	=> 'wpbc_icn_settings'//'wpbc_icn_free_cancellation'		// CSS definition  of forn Icon
                            , 'default'		=> !true								// Is this tab activated by default or not: true || false.
                            , 'disabled'	=> false                            // Is this tab disbaled: true || false.
                            , 'hided'		=> false                            // Is this tab hided: true || false.
                            , 'subtabs'		=> array()
        );
        $subtabs = array();
        $subtabs['search_form'] = array(
                              'type' => 'subtab'                                  // Required| Possible values:  'subtab' | 'separator' | 'button' | 'goto-link' | 'html'
                            , 'title'     => __( 'Search Form Layout', 'booking')             // Title of TAB
                            , 'page_title'=> __( 'Search Settings', 'booking')      // Title of Page
                            , 'hint'      => __( 'Search Settings', 'booking')               // Hint
                            , 'link' => '#wpbc_settings_search_availability_form_metabox'                                      // link
                            , 'position' => ''                                  // 'left'  ||  'right'  ||  ''
                            , 'css_classes' => ''                               // CSS class(es)
                            //, 'icon' => 'http://.../icon.png'                 // Icon - link to the real PNG img
                            //, 'font_icon' => 'wpbc_icn_mail_outline'   // CSS definition of Font Icon
                            , 'header_font_icon' => 'wpbc_icn_mail_outline'   // CSS definition of Font Icon			// FixIn: 9.6.1.4.
                            , 'default' 	=>  true                                // Is this sub tab activated by default or not: true || false.
                            , 'disabled' 	=> false                               // Is this sub tab deactivated: true || false.
                            , 'checkbox'  	=> false                              // or definition array  for specific checkbox: array( 'checked' => true, 'name' => 'feature1_active_status' )   //, 'checkbox'  => array( 'checked' => $is_checked, 'name' => 'enabled_active_status' )
                            , 'content' 	=> 'content'                            // Function to load as conten of this TAB
							, 'is_use_left_navigation' 	=> true
							, 'is_use_left_navigation_custom' 	=> true
							, 'show_checked_icon' 		=> false
							, 'is_use_navigation_path' 	=> array(
																	'path' => array(
																		'all' => array(
																							'title'  => __('Settings','booking'),
																							'hint'   => __('Settings General','booking'),
																							'icon'   => 'wpbc_icn_tune',
																							'url'    => wpbc_get_settings_url() . '&tab=all'
																						),
																		'next_all' => array( 'tag' => '>' ),
																		'calendar' => array(
																							'title'  => __('Calendar','booking'),
																							'hint'   => __('Calendar Settings','booking'),
																							'icon'   => 'wpbc-bi-calendar2-range',
																							'url'    => wpbc_get_settings_url() . '&tab=calendar',
																						),
																		'next_cal' => array( 'tag' => '>' ),
																		'calendar_look' => array(
																							'title'  => __('Calendar Look','booking'),
																							'hint'   => __('Calendar Settings','booking'),
																							'icon'   => 'wpbc-bi-calendar4-week',
																							'url'    => wpbc_get_settings_url() . '&tab=calendar',
																							//'attr'   => array()
																							//'tag'    => 'a',
																							'class'  => 'nav-tab-active'
																						),
																	)
																)														
							//, 'checked_data' 			=> WPBC_EMAIL_NEW_ADMIN_PREFIX . WPBC_EMAIL_NEW_ADMIN_ID		// This is where we get content
							//, 'hint' => array( 'title' => __('Customization of email template, which is sending to Admin after new booking' ,'booking') , 'position' => 'right' )
                        );
         $tabs[ 'all' ][ 'subtabs' ] = $subtabs;
        return $tabs;
    }



		/**
		 * Show custom tabs for Toolbar at . - . R i g h t . s i d e.
		 *
		 * @param string $menu_in_page_tag - active page
		 */
		public function left_navigation_custom__settings_all( $menu_in_page_tag ) {

			if ( $this->in_page() == $menu_in_page_tag ) {

				wpbc_page_show_left_navigation_custom__settings_all();
			}

		}


		/**
		 * Show custom tabs for Toolbar at . - . R i g h t . s i d e.
		 *
		 * @param string $menu_in_page_tag - active page
		 */
		public function wpbc_toolbar_toolbar_tabs( $menu_in_page_tag ) {

			if ( $this->in_page() == $menu_in_page_tag ) {

				// Just  for get  last  saved default tab
				$escaped_search_request_params = $this->get_cleaned_params__saved_requestvalue_default();

				// Check if by  some reason, user was saved request without this parameter, then get  default value
				if ( ! empty( $escaped_search_request_params['current_step'] ) ) {
					$selected_tab = $escaped_search_request_params['current_step'];
				} else {
					$default_search_request_params = array();//WPBC_AJX__Setup_Plugin__Ajax_Request::request_rules_structure();
					$selected_tab = $default_search_request_params ['current_step']['default'];
				}

				$current_step_page = explode( '_', $selected_tab );		// 'calendar_skin', 'calendar_size', 'calendar_dates_selection', 'calendar_weekdays_availability', 'calendar_additional',   'form_structure', ...

				wpbc_bs_toolbar_tabs_html_container_start();

				wpbc_bs_display_tab(   array(
													  'title'       => '1. '. __( 'Calendar', 'booking' )
													, 'hint' 	    => array( 'title' => __('Setup' ,'booking') , 'position' => 'top' )
													, 'onclick'     =>    "jQuery('.ui_container_toolbar').hide();" . "jQuery('.ui_container_calendar_skin').show();" . "jQuery('.wpbc_setup_plugin_support_tabs').removeClass('nav-tab-active');" . "jQuery(this).addClass('nav-tab-active');" . "jQuery('.nav-tab i.icon-white').removeClass('icon-white');" . "jQuery('.nav-tab-active i').addClass('icon-white');"
																		/**
																		 * It will save such changes, and if we have selected bookings, then deselect them
																		 */
																		   . "wpbc_ajx_setup_plugin__send_request_with_params( { 'current_step': 'calendar_skin' });"
																		/**
																		 * It will save changes with NEXT search request, but not immediately
																		 * it is handy, in case if we have selected bookings,
																		 * we will not lose selection.
																		 */
																		// . "wpbc_ajx_setup_plugin.search_set_param( 'current_step', 'calendar_skin' );"
													, 'font_icon'   => 'wpbc-bi-calendar2-check'
													, 'default'     => ( 'calendar' == $current_step_page[0] ) ? true : false
													//, 'position' 	=> 'right'
													, 'css_classes' => 'wpbc_setup_plugin_support_tabs'
									) );
				wpbc_bs_display_tab(   array(
													  'title'       => '2. '. __('Booking Form', 'booking')
													, 'hint' 	    => array( 'title' => __('Setup' ,'booking') , 'position' => 'top' )
													, 'onclick'     =>    "jQuery('.ui_container_toolbar').hide();" . "jQuery('.ui_container_form_structure').show();" . "jQuery('.wpbc_setup_plugin_support_tabs').removeClass('nav-tab-active');" . "jQuery(this).addClass('nav-tab-active');" . "jQuery('.nav-tab i.icon-white').removeClass('icon-white');" . "jQuery('.nav-tab-active i').addClass('icon-white');"
																		/**
																		 * It will save such changes, and if we have selected bookings, then deselect them
																		 */
																		   . "wpbc_ajx_setup_plugin__send_request_with_params( { 'current_step': 'form_structure' });"
																		/**
																		 * It will save changes with NEXT search request, but not immediately
																		 * it is handy, in case if we have selected bookings,
																		 * we will not lose selection.
																		 */
																		// . "wpbc_ajx_setup_plugin.search_set_param( 'current_step', 'calendar_skin' );"
													, 'font_icon'   => 'wpbc_icn_dashboard _customize dashboard rtt draw'
													, 'default'     => ( 'form' == $current_step_page[0] ) ? true : false
													//, 'position' 	=> 'right'
													, 'css_classes' => 'wpbc_setup_plugin_support_tabs'
									) );
				wpbc_bs_display_tab(   array(
													  'title'       => '3. '. __('Emails', 'booking')
													, 'hint' 	    => array( 'title' => __('Setup' ,'booking') , 'position' => 'top' )
													, 'onclick'     =>    "jQuery('.ui_container_toolbar').hide();" . "jQuery('.ui_container_emails_active').show();" . "jQuery('.wpbc_setup_plugin_support_tabs').removeClass('nav-tab-active');" . "jQuery(this).addClass('nav-tab-active');" . "jQuery('.nav-tab i.icon-white').removeClass('icon-white');" . "jQuery('.nav-tab-active i').addClass('icon-white');"
																		/**
																		 * It will save such changes, and if we have selected bookings, then deselect them
																		 */
																		   . "wpbc_ajx_setup_plugin__send_request_with_params( { 'current_step': 'emails_active' });"
																		/**
																		 * It will save changes with NEXT search request, but not immediately
																		 * it is handy, in case if we have selected bookings,
																		 * we will not lose selection.
																		 */
																		// . "wpbc_ajx_setup_plugin.search_set_param( 'current_step', 'calendar_skin' );"
													, 'font_icon'   => 'wpbc_icn_mail_outline'
													, 'default'     => ( 'emails' == $current_step_page[0] ) ? true : false
													//, 'position' 	=> 'right'
													, 'css_classes' => 'wpbc_setup_plugin_support_tabs'
									) );
				wpbc_bs_display_tab(   array(
													  'title'       => '4. '. __('Payments', 'booking')
													, 'hint' 	    => array( 'title' => __('Setup' ,'booking') , 'position' => 'top' )
													, 'onclick'     =>    "jQuery('.ui_container_toolbar').hide();" . "jQuery('.ui_container_payments_active').show();" . "jQuery('.wpbc_setup_plugin_support_tabs').removeClass('nav-tab-active');" . "jQuery(this).addClass('nav-tab-active');" . "jQuery('.nav-tab i.icon-white').removeClass('icon-white');" . "jQuery('.nav-tab-active i').addClass('icon-white');"
																		/**
																		 * It will save such changes, and if we have selected bookings, then deselect them
																		 */
																		   . "wpbc_ajx_setup_plugin__send_request_with_params( { 'current_step': 'payments_active' });"
																		/**
																		 * It will save changes with NEXT search request, but not immediately
																		 * it is handy, in case if we have selected bookings,
																		 * we will not lose selection.
																		 */
																		// . "wpbc_ajx_setup_plugin.search_set_param( 'current_step', 'calendar_skin' );"
													, 'font_icon'   => 'wpbc_icn_payment'
													, 'default'     => ( 'payments' == $current_step_page[0] ) ? true : false
													//, 'position' 	=> 'right'
													, 'css_classes' => 'wpbc_setup_plugin_support_tabs'
									) );
				wpbc_bs_display_tab(   array(
													  'title'       => '5. '. __('Publish Resources', 'booking')
													, 'hint' 	    => array( 'title' => __('Setup' ,'booking') , 'position' => 'top' )
													, 'onclick'     =>    "jQuery('.ui_container_toolbar').hide();" . "jQuery('.ui_container_publish_resource').show();" . "jQuery('.wpbc_setup_plugin_support_tabs').removeClass('nav-tab-active');" . "jQuery(this).addClass('nav-tab-active');" . "jQuery('.nav-tab i.icon-white').removeClass('icon-white');" . "jQuery('.nav-tab-active i').addClass('icon-white');"
																		/**
																		 * It will save such changes, and if we have selected bookings, then deselect them
																		 */
																		   . "wpbc_ajx_setup_plugin__send_request_with_params( { 'current_step': 'publish_resource' });"

																		/**
																		 * It will save changes with NEXT search request, but not immediately
																		 * it is handy, in case if we have selected bookings,
																		 * we will not lose selection.
																		 */
																		// . "wpbc_ajx_setup_plugin.search_set_param( 'current_step', 'calendar_skin' );"
													, 'font_icon'   => 'wpbc_icn_checklist'
													, 'default'     => ( 'publish' == $current_step_page[0] ) ? true : false
													//, 'position' 	=> 'right'
													, 'css_classes' => 'wpbc_setup_plugin_support_tabs'
									) );

				wpbc_bs_toolbar_tabs_html_container_end();
			}
		}


		/**
		 * Get sanitised request parameters.	:: Firstly  check  if user  saved it. :: Otherwise, check $_REQUEST. :: Otherwise get  default.
		 *
		 * @return array|false
		 */
		public function get_cleaned_params__saved_requestvalue_default(){

			$user_request = new WPBC_AJX__REQUEST( array(
													   'db_option_name'          => 'booking_setup_plugin_request_params',
													   'user_id'                 => wpbc_get_current_user_id(),
													   'request_rules_structure' => array()//WPBC_AJX__Setup_Plugin__Ajax_Request::request_rules_structure()
													)
							);
			$escaped_request_params_arr = $user_request->get_sanitized__saved__user_request_params();		// Get Saved

			if ( false === $escaped_request_params_arr ) {			// This request was not saved before, then get sanitized direct parameters, like: 	$_REQUEST['resource_id']

				$request_prefix = false;
				$escaped_request_params_arr = $user_request->get_sanitized__in_request__value_or_default( $request_prefix  );		 		// Direct: 	$_REQUEST['resource_id']
			}


			// Override parameters from DB  by  parameters from  REQUEST! ----------------------------------------------
			$request_key = 'current_step';
		 	// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		 	if ( isset( $_REQUEST[ $request_key ] ) ) {

				 // Get SANITIZED REQUEST parameters together with default values
				$request_prefix = false;
				$url_request_params_arr = $user_request->get_sanitized__in_request__value_or_default( $request_prefix  );		 		// Direct: 	$_REQUEST['resource_id']

				// Now get only SANITIZED values that exist in REQUEST.
				// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
				$url_request_params_only_arr = array_intersect_key( $url_request_params_arr, $_REQUEST );

				// And now override our DB  $escaped_request_params_arr  by  SANITIZED $_REQUEST values
				$escaped_request_params_arr   = wp_parse_args( $url_request_params_only_arr, $escaped_request_params_arr );
			}
			// ---------------------------------------------------------------------------------------------------------

			//MU
			if ( class_exists( 'wpdev_bk_multiuser' ) ) {

				// Check if this MU user activated or superadmin,  otherwise show warning
				if ( ! wpbc_is_mu_user_can_be_here('activated_user') )
					return  false;

				// Check if this MU user owner of this resource or superadmin,  otherwise show warning
				if ( ! wpbc_is_mu_user_can_be_here( 'resource_owner', $escaped_request_params_arr['resource_id'] ) ) {
					$default_values = $user_request->get_request_rules__default();
					$escaped_request_params_arr['resource_id'] = $default_values['resource_id'];
				}

			}



		    return $escaped_request_params_arr;
		}


    public function content() {


        do_action( 'wpbc_hook_settings_page_header', 'page_booking_setup_plugin');						// Define Notices Section and show some static messages, if needed.

	    if ( ! wpbc_is_mu_user_can_be_here( 'activated_user' ) ) {  return false;  }  						// Check if MU user activated, otherwise show Warning message.

 		// if ( ! wpbc_set_default_resource_to__get() ) return false;                  						// Define default booking resources for $_GET  and  check if booking resource belong to user.


		// Get and escape request parameters	////////////////////////////////////////////////////////////////////////
       	$escaped_request_params_arr = array();//$this->get_cleaned_params__saved_requestvalue_default();

		// During initial load of the page,  we need to  reset  'dates_selection' value in our saved parameter
	 	$escaped_request_params_arr['dates_selection'] = '';

        // Submit  /////////////////////////////////////////////////////////////
        $submit_form_name = 'wpbc_ajx_setup_plugin_form';                             	// Define form name

		?><span class="wpdevelop"><?php                                         		// BS UI CSS Class

			wpbc_js_for_bookings_page();                                            	// JavaScript functions
			/*
			?><div id="toolbar_booking_setup_plugin" class="wpbc_ajx_toolbar"><?php
					?><div class="wpbc_ajx_setup_plugin_toolbar_container"></div><?php //This Div Required for bottom border radius in container
			?></div><?php
			*/
//		    wpbc_ajx_setup_plugin__toolbar( $escaped_request_params_arr );

		?></span><?php

		?><div id="wpbc_log_screen" class="wpbc_log_screen"></div><?php

        // Content  ////////////////////////////////////////////////////////////
		wpbc_clear_div();
        ?>
        <span class="metabox-holder">
            <form  name="<?php echo esc_attr( $submit_form_name ); ?>" id="<?php echo esc_attr( $submit_form_name ); ?>" action="" method="post" >
                <?php
                   // N o n c e   field, and key for checking   S u b m i t
                   wp_nonce_field( 'wpbc_settings_page_' . $submit_form_name );
                ?><input type="hidden" name="is_form_sbmitted_<?php echo esc_attr( $submit_form_name ); ?>" id="is_form_sbmitted_<?php echo esc_attr( $submit_form_name ); ?>" value="1" /><?php

				//wpbc_ajx_booking_modify_container_show();					// Container for showing Edit ajx_booking and define Edit and Delete ajx_booking JavaScript vars.

				wpbc_ui_settings__panel__statistic();

				?><div class="clear" style="margin-bottom:10px;"></div><?php



				wpbc_settings_all__content_html();



				//$this->ajx_setup_plugin_container__show( $escaped_request_params_arr );

				wpbc_clear_div();

		  ?></form>
        </span>
        <?php

		//wpbc_show_wpbc_footer();			// Rating

        do_action( 'wpbc_hook_settings_page_footer', 'wpbc-ajx_booking_setup_plugin' );
    }

		private function ajx_setup_plugin_container__show( $escaped_request_params_arr ) {

			$is_show_resource_unavailable_stripes = ( !true ) ? ' wpbc_ajx_availability_container' : '';
			?>
			<div id="ajx_nonce_calendar_section"></div>
			<div class="wpbc_listing_container wpbc_selectable_table wpbc_ajx_setup_plugin_container wpdevelop<?php echo esc_attr( $is_show_resource_unavailable_stripes ); ?>" wpbc_loaded="first_time">
				<style type="text/css">
					.wpbc_calendar_loading .wpbc_icn_autorenew::before{
						font-size: 1.2em;
					}
					.wpbc_calendar_loading {
						width:95%;
						text-align: center;
						margin:2em 0;
						font-size: 1.2em;
						font-weight: 600;
					}
				</style>
				<div class="wpbc_calendar_loading"><span class="wpbc_icn_autorenew wpbc_spin"></span>&nbsp;&nbsp;<span><?php esc_html_e( 'Loading', 'booking' ); ?>...</span>
				</div>
			</div>
			<script type="text/javascript">
				jQuery( document ).ready( function (){

					// Set Security - Nonce for Ajax  - Listing
					wpbc_ajx_setup_plugin.set_secure_param( 'nonce',   '<?php echo esc_attr( wp_create_nonce( 'wpbc_ajx_setup_plugin_ajx' . '_wpbcnonce' ) ); ?>' );
					wpbc_ajx_setup_plugin.set_secure_param( 'user_id', '<?php echo esc_attr( wpbc_get_current_user_id() ); ?>' );
					wpbc_ajx_setup_plugin.set_secure_param( 'locale',  '<?php echo esc_attr( get_user_locale() ); ?>' );

					// Set other parameters
					wpbc_ajx_setup_plugin.set_other_param( 'listing_container',    '.wpbc_ajx_setup_plugin_container' );
					wpbc_ajx_setup_plugin.set_other_param( 'toolbar_container',    '.wpbc_ajx_setup_plugin_toolbar_container' );

					// Send Ajax request and show listing after this.
					wpbc_ajx_setup_plugin__send_request_with_params( <?php echo wp_json_encode( $escaped_request_params_arr ); ?> );
				} );
			</script>
			<?php
		}



}
add_action('wpbc_menu_created', array( new WPBC_Page_Settings_All() , '__construct') );    // Executed after creation of Menu





function wpbc_settings_all__content_html(){
    ?>
	<style type="text/css">

.wpbc_flex_settings_containers h4 {
  font-size: 12px;
  font-weight: 600;
  margin: 8px 0 0.5em;
  text-transform: uppercase !important;
  letter-spacing: 0px;
  text-shadow: none;
  color: #9e9e9e;
}

.wpbc_flex_settings_containers .wpbc_settings_navigation_item {
  flex: 0 1 auto;
  flex: 1 1 20em;
  padding: 0;
  background: #fff;
  border: 1px solid #d9d9d9;
  /*! min-width: 200px; */
  margin: 5px 5px;
  border-radius: 2px;
  /*! box-shadow: 0 1px 4px #eee; */
}
.wpbc_flex_settings_containers .wpbc_settings_navigation_item a:hover{
  border-left: 4px solid #1E7BC7 !important;
}
.wpbc_flex_settings_containers .wpbc_settings_navigation_item a {
  flex: 1 1 100%;
  margin: 0;
  padding: 10px 1em 10px 0;
    padding-left: 1em;
  border: none;
    border-left-width: medium;
    border-left-style: none;
    border-left-color: currentcolor;
  border-left: 4px solid transparent;
  text-shadow: none;
  color: #555;
  font-size: 16px;
  font-weight: 600;
  /*! text-transform: capitalize; */
  text-decoration: none;
  outline: none;
display: flex;
  flex-flow: row ;
  align-items: flex-start;
  justify-content: flex-start;
  flex: 0 1 auto;
}
.wpbc_flex_settings_containers .wpbc_settings_navigation_item a .menu_icon:before {
     font-size:22px !important;;
}
.wpbc_text_inside {
  display: flex;
  flex-flow: column;
  align-items: stretch;
  justify-content: center;
  margin: 0 0 0 1em;
  flex: 1 1 100%;
}
.wpbc_flex_settings_containers .wpbc_settings_navigation_item a .wpbc_text_inside .wpbc_flex_settings_title{
  flex: 1 1 100%;
  display: flex;
  flex-flow: row nowrap;
  color: #2271b1;
}
.wpbc_flex_settings_containers .wpbc_settings_navigation_item a .wpbc_text_inside .wpbc_flex_settings_title div:last-child{
  margin-left:auto;
  font-size:0.8em;
  color: #717171;
}
.wpbc_flex_settings_containers .wpbc_settings_navigation_item a .wpbc_text_inside .wpbc_flex_settings_description {
  font-weight:400 !important;;
  margin:10px 0 0;
  font-size: 12px;
  line-height: 2;
  color: #555;
}
	</style>
	<div class="wpbc_flex_settings_containers" style="display: flex;flex-flow: row wrap;justify-content: flex-start;align-items: stretch;margin: 0;/*! background: #fff; *//*! border: 1px solid #cecece; */border-radius: 5px;padding: 0 1em;margin-top: -10px;">

					<div style="flex: 1 1 100%;/*! border-top: 1px solid #e3e3e3; */margin: -10px 20px 0 0;"><h4>Calendar Settings</h4></div><div id="wpbc_general_settings_calendar_tab" class="wpbc_settings_navigation_item wpbc_settings_navigation_item_active" style="">

<a class="" original-title="" onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );" href="javascript:void(0);">

							<i class="menu_icon icon-1x wpbc-bi-calendar2-range"></i>
	<div class="wpbc_text_inside">
	<div class="wpbc_flex_settings_title"><div>Calendar Look</div><div>01</div></div><div class="wpbc_flex_settings_description">Set Calendar Skin, Max Months to Scroll, Calendar Legend</div></div>
						</a>
					</div><div id="wpbc_general_settings_calendar_tab" class="wpbc_settings_navigation_item wpbc_settings_navigation_item_active" style="">

<a class="" original-title="" onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );" href="javascript:void(0);">

							<i class="menu_icon icon-1x wpbc-bi-calendar3-week"></i>
	<div class="wpbc_text_inside">
	<div class="wpbc_flex_settings_title"><div>Days Selection</div><div>02</div></div><div class="wpbc_flex_settings_description">Single Day, Multi Days or Range Days Selection (Min/Max days )</div></div>
						</a>
					</div><div id="wpbc_general_settings_calendar_tab" class="wpbc_settings_navigation_item wpbc_settings_navigation_item_active" style="">

<a class="" original-title="" onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );" href="javascript:void(0);">

							<i class="menu_icon icon-1x wpbc_icn_flip"></i>
	<div class="wpbc_text_inside">
	<div class="wpbc_flex_settings_title"><div>Change Over Days</div><div><span class="wpbc_pro_label">Pro</span></div></div><div class="wpbc_flex_settings_description">Manage Split Days</div></div>
						</a>
					</div><div id="wpbc_general_settings_calendar_tab" class="wpbc_settings_navigation_item wpbc_settings_navigation_item_active" style="">

<a class="" original-title="" onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );" href="javascript:void(0);">

							<i class="menu_icon icon-1x wpbc_icn_textsms mode_comment"></i>
	<div class="wpbc_text_inside">
	<div class="wpbc_flex_settings_title"><div>Tooltips in Days</div><div>03</div></div><div class="wpbc_flex_settings_description">Configure Tooltips</div></div>
						</a>
					</div><div id="wpbc_general_settings_calendar_tab" class="wpbc_settings_navigation_item wpbc_settings_navigation_item_active" style="">

<a class="" original-title="" onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );" href="javascript:void(0);">

							<i class="menu_icon icon-1x wpbc-bi-calendar-check bi-calendar2-day"></i>
	<div class="wpbc_text_inside">
	<div class="wpbc_flex_settings_title"><div>General Availability</div><div>04</div></div><div class="wpbc_flex_settings_description">Set Unavailable Weekdays, Buffers for Bookings, Unavailable Days Options</div></div>
						</a>
					</div><div id="wpbc_general_settings_calendar_tab" class="wpbc_settings_navigation_item wpbc_settings_navigation_item_active" style="">

<a class="" original-title="" onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );" href="javascript:void(0);">

							<i class="menu_icon icon-1x wpbc_icn_filter_none"></i>
	<div class="wpbc_text_inside">
	<div class="wpbc_flex_settings_title"><div>Capacity</div><div>05</div></div><div class="wpbc_flex_settings_description">Manage Receiving several bookings per same Date or Timeslot</div></div>
						</a>
					</div><div style="flex: 1 1 100%;/*! border-top: 1px solid #e3e3e3; */margin: 10px 0 0;"><h4>Booking Form</h4></div>
<div id="wpbc_general_settings_calendar_tab" class="wpbc_settings_navigation_item wpbc_settings_navigation_item_active" style="">

<a class="" original-title="" onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );" href="javascript:void(0);">

							<i class="menu_icon icon-1x wpbc_icn_dashboard "></i>
	<div class="wpbc_text_inside">
	<div class="wpbc_flex_settings_title"><div>Form Fields</div><div>06</div></div><div class="wpbc_flex_settings_description">Configure Tooltips</div></div>
						</a>
					</div><div id="wpbc_general_settings_calendar_tab" class="wpbc_settings_navigation_item wpbc_settings_navigation_item_active" style="">

<a class="" original-title="" onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );" href="javascript:void(0);">

							<i class="menu_icon icon-1x wpbc_icn_schedule"></i>
	<div class="wpbc_text_inside">
	<div class="wpbc_flex_settings_title"><div>Time Slots</div><div>07</div></div><div class="wpbc_flex_settings_description">Configure Tooltips</div></div>
						</a>
					</div><div id="wpbc_general_settings_calendar_tab" class="wpbc_settings_navigation_item wpbc_settings_navigation_item_active" style="">

<a class="" original-title="" onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );" href="javascript:void(0);">

							<i class="menu_icon icon-1x wpbc-bi-toggle2-off"></i>
	<div class="wpbc_text_inside">
	<div class="wpbc_flex_settings_title"><div>Booking Form Options</div><div>08</div></div><div class="wpbc_flex_settings_description">Configure Tooltips</div></div>
						</a>
					</div><div style="flex: 1 1 100%;/*! border-top: 1px solid #e3e3e3; */margin: 10px 20px 0 0;"><h4>Notifications</h4></div><div id="wpbc_general_settings_calendar_tab" class="wpbc_settings_navigation_item wpbc_settings_navigation_item_active" style="">

<a class="" original-title="" onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );" href="javascript:void(0);">

							<i class="menu_icon icon-1x wpbc_icn_mail_outline"></i>
	<div class="wpbc_text_inside">
	<div class="wpbc_flex_settings_title"><div>Emails</div><div>09</div></div><div class="wpbc_flex_settings_description">Configure Tooltips</div></div>
						</a>
					</div><div style="flex: 1 1 100%;/*! border-top: 1px solid #e3e3e3; */margin: 10px 20px 0 0;"><h4>Sync</h4></div><div id="wpbc_general_settings_calendar_tab" class="wpbc_settings_navigation_item wpbc_settings_navigation_item_active" style="">

<a class="" original-title="" onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );" href="javascript:void(0);">

							<i class="menu_icon icon-1x wpbc_icn_sync_alt"></i>
	<div class="wpbc_text_inside">
	<div class="wpbc_flex_settings_title"><div>Import / Export Bookings</div><div>09</div></div><div class="wpbc_flex_settings_description">Configure Import events via .ics feeds, Set Export .ics feeds, Google Calendar API Import</div></div>
						</a>
					</div><div style="flex: 1 1 100%;/*! border-top: 1px solid #e3e3e3; */margin: 10px 20px 0 0;"><h4>Payments Setup</h4></div><div id="wpbc_general_settings_calendar_tab" class="wpbc_settings_navigation_item wpbc_settings_navigation_item_active" style="">

<a class="" original-title="" onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );" href="javascript:void(0);">

							<i class="menu_icon icon-1x wpbc_icn_payment"></i>
	<div class="wpbc_text_inside">
	<div class="wpbc_flex_settings_title"><div>Payment Gateways</div><div>09</div></div><div class="wpbc_flex_settings_description">Stripe, PayPal, Authorize.net, iDeal, ...</div></div>
						</a>
					</div><div id="wpbc_general_settings_calendar_tab" class="wpbc_settings_navigation_item wpbc_settings_navigation_item_active" style="">

<a class="" original-title="" onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );" href="javascript:void(0);">

							<i class="menu_icon icon-1x wpbc_icn_attach_money"></i>
	<div class="wpbc_text_inside">
	<div class="wpbc_flex_settings_title"><div>Currency</div><div>09</div></div><div class="wpbc_flex_settings_description">Configure Tooltips</div></div>
						</a>
					</div><div id="wpbc_general_settings_calendar_tab" class="wpbc_settings_navigation_item wpbc_settings_navigation_item_active" style="">

<a class="" original-title="" onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );" href="javascript:void(0);">

							<i class="menu_icon icon-1x wpbc_icn_tune"></i>
	<div class="wpbc_text_inside">
	<div class="wpbc_flex_settings_title"><div>Payment Options</div><div>09</div></div><div class="wpbc_flex_settings_description">Configure Tooltips</div></div>
						</a>
					</div><div style="flex: 1 1 100%;/*! border-top: 1px solid #e3e3e3; */margin: 10px 20px 0 0;"><h4>Search</h4></div><div id="wpbc_general_settings_calendar_tab" class="wpbc_settings_navigation_item wpbc_settings_navigation_item_active" style="">

<a class="" original-title="" onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );" href="javascript:void(0);">

							<i class="menu_icon icon-1x wpbc_icn_search"></i>
	<div class="wpbc_text_inside">
	<div class="wpbc_flex_settings_title"><div>Search Availability</div><div>09</div></div><div class="wpbc_flex_settings_description">Configure Search Availability Form, Search Results form</div></div>
						</a>
					</div><div style="flex: 1 1 100%;/*! border-top: 1px solid #e3e3e3; */margin: 10px 20px 0 0;"><h4>MultiUser</h4></div><div id="wpbc_general_settings_calendar_tab" class="wpbc_settings_navigation_item wpbc_settings_navigation_item_active" style="">

<a class="" original-title="" onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );" href="javascript:void(0);">

							<i class="menu_icon icon-1x wpbc_icn_people_alt"></i>
	<div class="wpbc_text_inside">
	<div class="wpbc_flex_settings_title"><div>Booking Admin Panels</div><div>09</div></div><div class="wpbc_flex_settings_description">Activate Booking Admin Panels for Regular Users, Set Super Booking Admin Users...</div></div>
						</a>
					</div>
	</div>
	<?php
}


function wpbc_page_show_left_navigation_custom__settings_all() {
	?>
	<div id="wpbc_general_settings_calendar_tab"
		 class="wpbc_settings_navigation_item wpbc_settings_navigation_item_active">
		<a class="" original-title=""
		   onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_calendar_metabox' );"
		   href="javascript:void(0);">
			<span>Calendar Settings</span>
			<i class="wpbc_set_nav__right_icon menu_icon icon-1x wpbc-bi-calendar2-range"></i>
		</a>
	</div>


	<div id="wpbc_settings__form_layout_tab" class="wpbc_settings_navigation_item">
		<a onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_settings__form_layout_metabox', '.wpbc_container_hide__on_left_nav_click' );"
		   href="javascript:void(0);">
			<span>Booking Form</span>
			<i class="wpbc_set_nav__right_icon menu_icon icon-1x wpbc_icn_dashboard"></i>
		</a>
	</div>

	<div id="wpbc_general_settings_time_slots_tab" class="wpbc_settings_navigation_item wpbc_navigation_sub_item">

	</div>
	<div id="wpbc_general_settings_booking_confirmation_tab" class="wpbc_settings_navigation_item">
		<a class="" original-title=""
		   onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_booking_confirmation_metabox,#wpbc_general_settings_booking_confirmation_left_metabox,#wpbc_general_settings_booking_confirmation_right_metabox,#wpbc_general_settings_booking_confirmation_help_metabox' );"
		   href="javascript:void(0);">
			<span>Booking Confirmation</span>
		</a>
	</div>

	<div id="wpbc_general_settings_booking_timeline_tab"
		 class="wpbc_settings_navigation_item wpbc_navigation_top_border0">
		<a class="" original-title=""
		   onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_booking_timeline_metabox' );"
		   href="javascript:void(0);">
			<span>Notifications</span><i class="wpbc_set_nav__right_icon menu_icon icon-1x wpbc_icn_mail_outline"></i>
		</a>
	</div>
	<div id="wpbc_general_settings_bookings_options_tab"
		 class="wpbc_settings_navigation_item wpbc_navigation_top_border">
		<a class="" original-title=""
		   onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_bookings_options_metabox' );"
		   href="javascript:void(0);">
			<span>Sync</span><i class="wpbc_set_nav__right_icon menu_icon icon-1x wpbc_icn_sync_alt"></i>
		</a>
	</div>


	<div id="wpbc_general_settings_multiuser_tab" class="wpbc_settings_navigation_item">
		<a class="" original-title=""
		   onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_multiuser_metabox' );"
		   href="javascript:void(0);">
			<span>Payment Setup</span><i class="wpbc_set_nav__right_icon menu_icon icon-1x wpbc_icn_payment"></i>
		</a>
	</div>

	<div id="wpbc_general_settings_booking_listing_tab"
		 class="wpbc_settings_navigation_item wpbc_navigation_top_border0">
		<a class="" original-title=""
		   onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_booking_listing_metabox' );"
		   href="javascript:void(0);">
			<span>Search Availability</span><i class="wpbc_set_nav__right_icon menu_icon icon-1x wpbc_icn_search"></i>
		</a>
	</div>


	<div id="wpbc_general_settings_advanced_tab" class="wpbc_settings_navigation_item">
		<a class="" original-title=""
		   onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_advanced_metabox' );"
		   href="javascript:void(0);">
			<span>MultiUser Accounts</span><i
				class="wpbc_set_nav__right_icon menu_icon icon-1x wpbc_icn_people_alt"></i>
		</a>
	</div>


	<div id="wpbc_general_settings_help_tab" class="wpbc_settings_navigation_item wpbc_navigation_sub_item"
		 style="display: none;">
		<a class="" original-title=""
		   onclick="javascript:wpbc_navigation_click_show_section(this,'#wpbc_general_settings_help_metabox' );"
		   href="javascript:void(0);">
			<span>Tools</span>
		</a>
	</div>
	<?php
}