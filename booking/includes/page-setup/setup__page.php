<?php
/*
* @package: AJX_Setup_Wizard Page
* @category: Initial  setup  and plugin  customization
* Author: wpdevelop, oplugins
* Version: 1.0
* @modified 2024-06-28
*/
//FixIn: 10.2.0.1
if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly

require_once( WPBC_PLUGIN_DIR . '/includes/page-setup/setup_templates.php' );
require_once( WPBC_PLUGIN_DIR . '/includes/page-setup/setup_ajax.php' );


/** Show Content
 *  Update Content
 *  Define Slug
 *  Define where to show
 */
class WPBC_Page_AJX_Setup_Wizard extends WPBC_Page_Structure {

   	public function __construct() {

        parent::__construct();

		//add_action( 'wpbc_toolbar_top_tabs_insert', array( $this, 'wpbc_toolbar_toolbar_tabs' ) );
		add_action( 'wpbc_page_show_left_navigation_custom', array( $this, 'left_navigation_custom__settings_all' ) );
    }

    public function in_page() {
        return 'wpbc-setup';
    }

    public function tabs() {

        $tabs = array();
        $tabs[ 'step_01' ] = array(
                              'title'		=> __( 'Setup', 'booking' )						// Title of TAB
                            , 'hint'		=> __( 'Setup', 'booking' ) . ' - '	 . 'Booking Calendar'					// Hint
                            , 'page_title'	=> __( 'Setup', 'booking' ) . ' - '	 . 'Booking Calendar'					// Title of Page
                            , 'link'		=> ''								// Can be skiped,  then generated link based on Page and Tab tags. Or can  be extenral link
                            , 'position'	=> ''                               // 'left'  ||  'right'  ||  ''
                            , 'css_classes' => ''                               // CSS class(es)
                            , 'icon'		=> ''                               // Icon - link to the real PNG img
                            , 'font_icon'	=> 'wpbc_icn_donut_large'	//'wpbc_icn_free_cancellation'		// CSS definition  of forn Icon
                            , 'default'		=> true								// Is this tab activated by default or not: true || false.
                            , 'disabled'	=> false                            // Is this tab disbaled: true || false.
                            , 'hided'		=> false                            // Is this tab hided: true || false.
                            , 'subtabs'		=> array()
        );
        $subtabs = array();
        $subtabs['path_setup'] = array(
                              'type' => 'subtab'                                  // Required| Possible values:  'subtab' | 'separator' | 'button' | 'goto-link' | 'html'
                            , 'title'     => __( 'Setup', 'booking' )						// Title of TAB
                            , 'page_title'=> __( 'Setup', 'booking' ) . ' - '	 . 'Booking Calendar'					// Title of Page
                            , 'hint'      => __( 'Setup', 'booking' ) . ' - '	 . 'Booking Calendar'					// Hint
                            , 'link' => '#path_setup'                                      								// link
                            , 'position' => ''                                  	// 'left'  ||  'right'  ||  ''
                            , 'css_classes' => ''                               	// CSS class(es)
                            //, 'icon' => 'http://.../icon.png'                 	// Icon - link to the real PNG img
                            //, 'font_icon' => 'wpbc_icn_mail_outline'   			// CSS definition of Font Icon
                            , 'header_font_icon' => 'wpbc_icn_donut_large'   		// CSS definition of Font Icon			//FixIn: 9.6.1.4
                            , 'default' 	=> true                                	// Is this sub tab activated by default or not: true || false.
                            , 'disabled' 	=> false                               	// Is this sub tab deactivated: true || false.
                            , 'checkbox'  	=> false                              	// or definition array  for specific checkbox: array( 'checked' => true, 'name' => 'feature1_active_status' )   //, 'checkbox'  => array( 'checked' => $is_checked, 'name' => 'enabled_active_status' )
                            , 'content' 	=> 'content'                            // Function to load as content of this TAB
							, 'is_use_left_navigation' 			=> true
							, 'is_use_left_navigation_custom' 	=> true
							, 'show_checked_icon' 		=> false
							, 'is_use_navigation_path' 	=> array(
										'path' => array(
											'setup' => array(
																'title'  => __('Initial Setup','booking'),
																'hint'   => __('Initial Setup','booking'),
																'icon'   => 'wpbc_icn_donut_large',
																'url'    => wpbc_get_setup_wizard_url() . '&tab=step_01'
															),
											'next_all' => array( 'tag' => '>' ),
											'intro' => array(
																'title'  => __('Step','booking') . ' ' . wpbc_setup_wizard__get_active_step() . ' / ' .wpbc_setup_wizard__get_total_steps(),
																'hint'   => __('General Settings','booking'),
																'icon'   => '',//'wpbc_icn_adjust',
																'url'    => wpbc_get_setup_wizard_url() . '&tab=step_01',
																//'attr'   => array()
																//'tag'    => 'a',
																'class'  => 'nav-tab-active'
															)
										)
									)
                        );
         $tabs[ 'step_01' ][ 'subtabs' ] = $subtabs;

        return $tabs;
    }


    public function content() {


        do_action( 'wpbc_hook_settings_page_header', 'page_booking_setup_wizard');						// Define Notices Section and show some static messages, if needed.

	    if ( ! wpbc_is_mu_user_can_be_here( 'activated_user' ) ) {  return false;  }  						// Check if MU user activated, otherwise show Warning message.

 		// if ( ! wpbc_set_default_resource_to__get() ) return false;                  						// Define default booking resources for $_GET  and  check if booking resource belong to user.


		// Get and escape request parameters	////////////////////////////////////////////////////////////////////////
       	$escaped_request_params_arr =  $this->get_cleaned_params__saved_requestvalue_default();

		// During initial load of the page,  we need to  reset  'dates_selection' value in our saved parameter
	 	$escaped_request_params_arr['dates_selection'] = '';

        // Submit  /////////////////////////////////////////////////////////////
        $submit_form_name = 'wpbc_ajx_setup_wizard_form';                             	// Define form name

		?><span class="wpdevelop"><?php                                         		// BS UI CSS Class

			wpbc_js_for_bookings_page();                                            	// JavaScript functions

			?><div id="toolbar_booking_setup_wizard" class="wpbc_ajx_toolbar"><?php
					?><div class="wpbc_ajx_setup_wizard_toolbar_container"></div><?php //This Div Required for bottom border radius in container
			?></div><?php

//		    wpbc_ajx_setup_wizard__toolbar( $escaped_request_params_arr );

		?></span><?php

		?><div id="wpbc_log_screen" class="wpbc_log_screen"></div><?php

        // Content  ////////////////////////////////////////////////////////////
        ?>
        <div class="clear" style="margin-bottom:10px;"></div>
        <span class="metabox-holder">
            <form  name="<?php echo $submit_form_name; ?>" id="<?php echo $submit_form_name; ?>" action="" method="post" >
                <?php
                   // N o n c e   field, and key for checking   S u b m i t
                   wp_nonce_field( 'wpbc_settings_page_' . $submit_form_name );
                ?><input type="hidden" name="is_form_sbmitted_<?php echo $submit_form_name; ?>" id="is_form_sbmitted_<?php echo $submit_form_name; ?>" value="1" /><?php

			?></form><?php
				//wpbc_ajx_booking_modify_container_show();					// Container for showing Edit ajx_booking and define Edit and Delete ajx_booking JavaScript vars.

				//wpbc_clear_div();

				$this->ajx_setup_wizard_container__show( $escaped_request_params_arr );

				wpbc_clear_div();

		  ?>
        </span>
        <?php

		//wpbc_show_wpbc_footer();			// Rating

        do_action( 'wpbc_hook_settings_page_footer', 'wpbc-ajx_booking_setup_wizard' );
    }




		private function ajx_setup_wizard_container__show( $escaped_request_params_arr ) {

			$is_show_resource_unavailable_stripes = ( !true ) ? ' wpbc_ajx_availability_container' : '';
			?>
			<div id="ajx_nonce_calendar_section"></div>
			<div class="wpbc_listing_container wpbc_selectable_table wpbc_ajx_setup_wizard_container wpdevelop<?php echo $is_show_resource_unavailable_stripes; ?>" wpbc_loaded="first_time">
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
				<div class="wpbc_calendar_loading"><span class="wpbc_icn_autorenew wpbc_spin"></span>&nbsp;&nbsp;<span><?php _e( 'Loading', 'booking' ); ?>...</span>
				</div>
			</div>
			<script type="text/javascript">
				jQuery( document ).ready( function (){

					// Set Security - Nonce for Ajax  - Listing
					_wpbc_settings.set_param__secure( 'nonce',   '<?php echo wp_create_nonce( 'wpbc_ajx_setup_wizard_ajx' . '_wpbcnonce' ) ?>' );
					_wpbc_settings.set_param__secure( 'user_id', '<?php echo wpbc_get_current_user_id(); ?>' );
					_wpbc_settings.set_param__secure( 'locale',  '<?php echo get_user_locale(); ?>' );

					// Set other parameters
					_wpbc_settings.set_param__other( 'listing_container',    '.wpbc_ajx_setup_wizard_container' );
					_wpbc_settings.set_param__other( 'toolbar_container',    '.wpbc_ajx_setup_wizard_toolbar_container' );

					// Send Ajax request and show listing after this.
					wpbc_setup_page__show_content( <?php echo wp_json_encode( $escaped_request_params_arr ); ?> );
				} );
			</script>
			<?php
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
					$default_search_request_params = array();//WPBC_AJX__Setup_Wizard__Ajax_Request::request_rules_structure();
					$selected_tab = $default_search_request_params ['current_step']['default'];
				}

				$current_step_page = explode( '_', $selected_tab );		// 'calendar_skin', 'calendar_size', 'calendar_dates_selection', 'calendar_weekdays_availability', 'calendar_additional',   'form_structure', ...
wpbc_bs_toolbar_tabs_html_container_start();
				wpbc_bs_display_tab(   array(
													  'title'       => '1. '. __( 'Calendar', 'booking' )
													, 'hint' 	    => array( 'title' => __('Setup' ,'booking') , 'position' => 'top' )
													, 'onclick'     =>    "jQuery('.ui_container_toolbar').hide();" . "jQuery('.ui_container_calendar_skin').show();" . "jQuery('.wpbc_setup_wizard_support_tabs').removeClass('nav-tab-active');" . "jQuery(this).addClass('nav-tab-active');" . "jQuery('.nav-tab i.icon-white').removeClass('icon-white');" . "jQuery('.nav-tab-active i').addClass('icon-white');"
																		/**
																		 * It will save such changes, and if we have selected bookings, then deselect them
																		 */
																		   . "wpbc_ajx_setup_wizard__send_request_with_params( { 'current_step': 'calendar_skin' });"
																		/**
																		 * It will save changes with NEXT search request, but not immediately
																		 * it is handy, in case if we have selected bookings,
																		 * we will not lose selection.
																		 */
																		// . "_wpbc_settings.search_set_param( 'current_step', 'calendar_skin' );"
													, 'font_icon'   => 'wpbc-bi-calendar2-check'
													, 'default'     => ( 'calendar' == $current_step_page[0] ) ? true : false
													//, 'position' 	=> 'right'
													, 'css_classes' => 'wpbc_setup_wizard_support_tabs'
									) );
				wpbc_bs_display_tab(   array(
													  'title'       => '2. '. __('Booking Form', 'booking')
													, 'hint' 	    => array( 'title' => __('Setup' ,'booking') , 'position' => 'top' )
													, 'onclick'     =>    "jQuery('.ui_container_toolbar').hide();" . "jQuery('.ui_container_form_structure').show();" . "jQuery('.wpbc_setup_wizard_support_tabs').removeClass('nav-tab-active');" . "jQuery(this).addClass('nav-tab-active');" . "jQuery('.nav-tab i.icon-white').removeClass('icon-white');" . "jQuery('.nav-tab-active i').addClass('icon-white');"
																		/**
																		 * It will save such changes, and if we have selected bookings, then deselect them
																		 */
																		   . "wpbc_ajx_setup_wizard__send_request_with_params( { 'current_step': 'form_structure' });"
																		/**
																		 * It will save changes with NEXT search request, but not immediately
																		 * it is handy, in case if we have selected bookings,
																		 * we will not lose selection.
																		 */
																		// . "_wpbc_settings.search_set_param( 'current_step', 'calendar_skin' );"
													, 'font_icon'   => 'wpbc_icn_dashboard _customize dashboard rtt draw'
													, 'default'     => ( 'form' == $current_step_page[0] ) ? true : false
													//, 'position' 	=> 'right'
													, 'css_classes' => 'wpbc_setup_wizard_support_tabs'
									) );
				wpbc_bs_display_tab(   array(
													  'title'       => '3. '. __('Emails', 'booking')
													, 'hint' 	    => array( 'title' => __('Setup' ,'booking') , 'position' => 'top' )
													, 'onclick'     =>    "jQuery('.ui_container_toolbar').hide();" . "jQuery('.ui_container_emails_active').show();" . "jQuery('.wpbc_setup_wizard_support_tabs').removeClass('nav-tab-active');" . "jQuery(this).addClass('nav-tab-active');" . "jQuery('.nav-tab i.icon-white').removeClass('icon-white');" . "jQuery('.nav-tab-active i').addClass('icon-white');"
																		/**
																		 * It will save such changes, and if we have selected bookings, then deselect them
																		 */
																		   . "wpbc_ajx_setup_wizard__send_request_with_params( { 'current_step': 'emails_active' });"
																		/**
																		 * It will save changes with NEXT search request, but not immediately
																		 * it is handy, in case if we have selected bookings,
																		 * we will not lose selection.
																		 */
																		// . "_wpbc_settings.search_set_param( 'current_step', 'calendar_skin' );"
													, 'font_icon'   => 'wpbc_icn_mail_outline'
													, 'default'     => ( 'emails' == $current_step_page[0] ) ? true : false
													//, 'position' 	=> 'right'
													, 'css_classes' => 'wpbc_setup_wizard_support_tabs'
									) );
				wpbc_bs_display_tab(   array(
													  'title'       => '4. '. __('Payments', 'booking')
													, 'hint' 	    => array( 'title' => __('Setup' ,'booking') , 'position' => 'top' )
													, 'onclick'     =>    "jQuery('.ui_container_toolbar').hide();" . "jQuery('.ui_container_payments_active').show();" . "jQuery('.wpbc_setup_wizard_support_tabs').removeClass('nav-tab-active');" . "jQuery(this).addClass('nav-tab-active');" . "jQuery('.nav-tab i.icon-white').removeClass('icon-white');" . "jQuery('.nav-tab-active i').addClass('icon-white');"
																		/**
																		 * It will save such changes, and if we have selected bookings, then deselect them
																		 */
																		   . "wpbc_ajx_setup_wizard__send_request_with_params( { 'current_step': 'payments_active' });"
																		/**
																		 * It will save changes with NEXT search request, but not immediately
																		 * it is handy, in case if we have selected bookings,
																		 * we will not lose selection.
																		 */
																		// . "_wpbc_settings.search_set_param( 'current_step', 'calendar_skin' );"
													, 'font_icon'   => 'wpbc_icn_payment'
													, 'default'     => ( 'payments' == $current_step_page[0] ) ? true : false
													//, 'position' 	=> 'right'
													, 'css_classes' => 'wpbc_setup_wizard_support_tabs'
									) );
				wpbc_bs_display_tab(   array(
													  'title'       => '5. '. __('Publish Resources', 'booking')
													, 'hint' 	    => array( 'title' => __('Setup' ,'booking') , 'position' => 'top' )
													, 'onclick'     =>    "jQuery('.ui_container_toolbar').hide();" . "jQuery('.ui_container_publish_resource').show();" . "jQuery('.wpbc_setup_wizard_support_tabs').removeClass('nav-tab-active');" . "jQuery(this).addClass('nav-tab-active');" . "jQuery('.nav-tab i.icon-white').removeClass('icon-white');" . "jQuery('.nav-tab-active i').addClass('icon-white');"
																		/**
																		 * It will save such changes, and if we have selected bookings, then deselect them
																		 */
																		   . "wpbc_ajx_setup_wizard__send_request_with_params( { 'current_step': 'publish_resource' });"

																		/**
																		 * It will save changes with NEXT search request, but not immediately
																		 * it is handy, in case if we have selected bookings,
																		 * we will not lose selection.
																		 */
																		// . "_wpbc_settings.search_set_param( 'current_step', 'calendar_skin' );"
													, 'font_icon'   => 'wpbc_icn_checklist'
													, 'default'     => ( 'publish' == $current_step_page[0] ) ? true : false
													//, 'position' 	=> 'right'
													, 'css_classes' => 'wpbc_setup_wizard_support_tabs'
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
													   'db_option_name'          => 'booking_setup_wizard_request_params',
													   'user_id'                 => wpbc_get_current_user_id(),
													   'request_rules_structure' => WPBC_AJX__Setup_Wizard__Ajax_Request::request_rules_structure()
													)
							);
			$escaped_request_params_arr = $user_request->get_sanitized__saved__user_request_params();		// Get Saved

			if ( false === $escaped_request_params_arr ) {			// This request was not saved before, then get sanitized direct parameters, like: 	$_REQUEST['resource_id']

				$request_prefix = false;
				$escaped_request_params_arr = $user_request->get_sanitized__in_request__value_or_default( $request_prefix  );		 		// Direct: 	$_REQUEST['resource_id']
			}


			// Override parameters from DB  by  parameters from  REQUEST! ----------------------------------------------
			$request_key = 'current_step';
		 	if ( isset( $_REQUEST[ $request_key ] ) ) {

				 // Get SANITIZED REQUEST parameters together with default values
				$request_prefix = false;
				$url_request_params_arr = $user_request->get_sanitized__in_request__value_or_default( $request_prefix  );		 		// Direct: 	$_REQUEST['resource_id']

				// Now get only SANITIZED values that exist in REQUEST
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

			ob_start();
			echo do_shortcode( '[booking resource_id=' . $escaped_request_params_arr['resource_id'] . ']' );
			$escaped_request_params_arr['calendar_force_load'] = ob_get_clean();


		    return $escaped_request_params_arr;
		}



}
add_action('wpbc_menu_created', array( new WPBC_Page_AJX_Setup_Wizard() , '__construct') );    // Executed after creation of Menu




function wpbc_setup_wizard__get_total_steps(){
    return 12;
}


function wpbc_setup_wizard__get_active_step(){
    return 1;
}


function wpbc_setup_wizard__get_progess_value() {

	$progess_value = ( wpbc_setup_wizard__get_active_step() * 100 ) / wpbc_setup_wizard__get_total_steps();
	$progess_value = intval( $progess_value );

	return $progess_value;
}


/**
 * Black Button at  Top Right Side in plugin menu
 *
 * Show Continue Setup Wizard Button
 * @return void
 */
function wpbc_after_wpbc_page_top__header_tabs__wizard_button(){

	if (0){
	?><div class="ui_element wpbc_page_top__wizard_button">
		<a class="wpbc_ui_control wpbc_ui_button wpbc_ui_button_primary"
		   href="admin.php?page=wpbc-setup"><i class="menu_icon icon-1x wpbc_icn_check"></i>&nbsp;<span class="in-button-text"><?php
				_e('Continue Setup','booking');
				echo '...  3 / 12';
		?></span></a>
	</div><?php
	}

	if(0) {
	?><style tye="text/css">
		@media screen and (max-width: 782px) {
			.ui_element.wpbc_page_top__wizard_button {
				top: 49px !important;
			}
		}
		.wpbc_page_top__wizard_button {
			width: auto;
			position: fixed;
			z-index: 90000;
			box-shadow: 0 0 10px #c1c1c1;
			border-radius: 9px;
			background: transparent;
			right: 20px;
			top: 40px;
		}
		.ui_element.wpbc_page_top__wizard_button a.wpbc_ui_button.wpbc_ui_button_primary,
		.ui_element.wpbc_page_top__wizard_button a.wpbc_ui_button.wpbc_ui_button_primary:hover {
			border-radius: 5px;
			border: none;
			background: #535353;   /* #6c9e00 #0b9300;*/
			box-shadow: 0 0 10px #dbdbdb;
			text-shadow: none;
			color: #fff;
			font-weight: 600;
			padding: 8px 20px 8px 15px;
		}
	</style><?php
		?><div class="ui_element wpbc_page_top__wizard_button" style="width: 240px;top: 35px;font-size: 15px;">
			<a class="wpbc_ui_control wpbc_ui_button wpbc_ui_button_primary" href="admin.php?page=wpbc-setup"><i
					class="menu_icon icon-1x wpbc_icn_donut_large0 wpbc-bi-gear"></i>&nbsp;<div class="in-button-text" style="width: 100%;margin-left: 10px;display: flex;flex-flow: row nowrap;">
					<div class="setup_wizard_container"
						 style="display: flex;flex-flow: row wrap;justify-content: flex-start;align-items: center;color: #fff;margin: 0 -5px 0 0;overflow: visible;width: 100%;">
						<div class="name_item" style="margin-top: 0;white-space: nowrap;padding: 0 0 0 0;">
							<?php _e('Continue Setup','booking'); ?> ...
						</div>
						<div
							style="margin:3px 0px 0 0;margin-left: auto;font-size: 9px;background: #2271b1;height: 15px;border-radius: 5px;padding: 0px 7px 5px;"
							class="wpbc_badge_count name_item update-plugins">
							<span class="update-count" style="white-space: nowrap;word-wrap: normal;"><?php echo '3 / 12'; ?></span>
						</div>
						<div class="progress_line_container"
							 style="width: 100%;border: 0px solid #757575;height: 3px;border-radius: 4px;margin: 7px 0 -3px -3px;overflow: hidden;background: #202020;">
							<div class="progress_line"
								 style="font-size: 6px;font-weight: 600;word-wrap: normal;white-space: nowrap;background: #8ECE01;width: 50%;height: 3px;"></div>
						</div>
					</div>
				</div>
			</a>
		</div><?php
	}

	if(1) {
		?><style tye="text/css">
		@media screen and (max-width: 782px) {
			.ui_element.wpbc_page_top__wizard_button {
				top: 49px !important;
			}
		}
		.wpbc_page_top__wizard_button {
			width: auto;
			position: fixed;
			z-index: 90000;
			box-shadow: 0 0 10px #c1c1c1;
			border-radius: 9px;
			background: transparent;
			right: 20px;
			top: 40px;
		}
		.ui_element.wpbc_page_top__wizard_button .wpbc_page_top__wizard_button_content,
		.ui_element.wpbc_page_top__wizard_button .wpbc_page_top__wizard_button_content:hover {
			border-radius: 5px;
			border: none;
			background: #535353;   /* #6c9e00 #0b9300;*/
			box-shadow: 0 0 10px #dbdbdb;
			text-shadow: none;
			color: #fff;
			font-weight: 600;
			padding: 8px 10px 8px 15px;
			display:flex;
			flex-flow:row nowrap;
			justify-content: flex-start;
			align-items: center;
		}
	</style>
		<div style="min-width: 240px;top: 35px;font-size: 15px;" class="ui_element wpbc_page_top__wizard_button">
			<div class="wpbc_ui_control wpbc_page_top__wizard_button_content">
				<div class="in-button-text"
					 style="width: 100%;margin: 0;display: flex;flex-flow: row nowrap;justify-content: flex-start;align-items: center;">
					<div class="setup_wizard_container"
						 style="display: flex;flex-flow: row wrap;justify-content: flex-start;align-items: center;color: #fff;overflow: visible;flex: 1 1 auto;">
						<div class="name_item" style="margin-top: 0;white-space: nowrap;padding: 0;margin-right: 20px;">
							<i style="margin-right: 4px;"
							   class="menu_icon icon-1x wpbc_icn_donut_large wpbc_icn_adjust0"></i>
							Finish Setup
						</div>
						<div
							style="margin:2px 0px 0 9px;font-size: 9px;background: #3e3e3e;height: auto;border-radius: 5px;padding: 0px 7px 0px;margin-left: auto;"
							class="wpbc_badge_count name_item update-plugins">
							<span class="update-count" style="white-space: nowrap;word-wrap: normal;"><?php echo wpbc_setup_wizard__get_active_step() . ' / ' .wpbc_setup_wizard__get_total_steps(); ?></span>
						</div>

						<div class="progress_line_container"
							 style="width: 100%;border: 0px solid #757575;height: 3px;border-radius: 6px;margin: 7px 0 0 0;overflow: hidden;background: #202020;">
							<div class="progress_line"
								 style="font-size: 6px;font-weight: 600;border-radius: 6px;word-wrap: normal;white-space: nowrap;background: #8ECE01;width: <?php echo wpbc_setup_wizard__get_progess_value(); ?>%;height: 3px;"></div>
						</div>
					</div>
					<a class="button button-primary" href="admin.php?page=wpbc-setup"
					   style="margin-left: auto;font-size: 11px;min-height: 10px;margin-left: 25px;">Continue</a></div>
			</div>
		</div><?php
	}
}
add_action('wpbc_after_wpbc_page_top__header_tabs','wpbc_after_wpbc_page_top__header_tabs__wizard_button',10,3);


/**
 * Main Left Menu Title - "Setup" with Progress Bar
 *
 * @return false|string
 */
function wpbc_get_plugin_menu_title__setup(){
	ob_start();

	?>
	<div class="setup_wizard_container" style="display: flex;flex-flow: row wrap;justify-content: flex-start;align-items: center;color: #fff;margin: 0 -5px 0 0;overflow: visible;">
		<div class="name_item" style="margin-top: 0;white-space: nowrap;padding: 0 0 0 0;"><?php
			_e('Setup','booking');
		?></div>
		<div style="margin:3px 0px 0 0;margin-left: auto;font-size: 9px;background: #2271b1;height: 15px;" class="wpbc_badge_count name_item update-plugins">
			<span class="update-count" style="white-space: nowrap;word-wrap: normal;"><?php echo wpbc_setup_wizard__get_active_step() . ' / ' .wpbc_setup_wizard__get_total_steps(); ?></span>
		</div>
		<div class="progress_line_container" style="width: 100%;border: 0px solid #757575;height: 3px;border-radius: 6px;margin: 7px 0 -3px -3px;overflow: hidden;background: #555;">
			<div class="progress_line" style="font-size: 6px;font-weight: 600;word-wrap: normal;border-radius: 6px;white-space: nowrap;background: #8ECE01;width: <?php echo wpbc_setup_wizard__get_progess_value(); ?>%;height: 3px;" ></div>
		</div>
	</div><?php

	return ob_get_clean();
}