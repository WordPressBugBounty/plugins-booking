<?php
/*
* @package: AJX_Setup_Wizard Page
* @category: Initial  setup  and plugin  customization
* Author: wpdevelop, oplugins
* Version: 1.0
* @modified 2024-06-28
*/
// FixIn: 10.2.0.1.
if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly

/**
 * The setup wizard renders only the introductory steps on this page. Profile-specific configuration after
 * "Booking Type" is routed to existing WPBC admin pages and controlled by the floating setup bar.
 */


require_once( WPBC_PLUGIN_DIR . '/includes/page-setup/setup_templates.php' );
require_once( WPBC_PLUGIN_DIR . '/includes/page-setup/setup_profiles.php' );
require_once( WPBC_PLUGIN_DIR . '/includes/page-setup/templates/01.welcome__tpl.php' );

require_once( WPBC_PLUGIN_DIR . '/includes/page-setup/templates/02.general_info__tpl.php' );
require_once( WPBC_PLUGIN_DIR . '/includes/page-setup/templates/02.general_info__action.php' );

require_once( WPBC_PLUGIN_DIR . '/includes/page-setup/templates/03.date_time_formats__tpl.php' );
require_once( WPBC_PLUGIN_DIR . '/includes/page-setup/templates/03.date_time_formats__action.php' );

require_once( WPBC_PLUGIN_DIR . '/includes/page-setup/templates/04.bookings_types__tpl.php' );
require_once( WPBC_PLUGIN_DIR . '/includes/page-setup/templates/04.bookings_types__action.php' );

require_once( WPBC_PLUGIN_DIR . '/includes/page-setup/setup_steps.php' );
require_once( WPBC_PLUGIN_DIR . '/includes/page-setup/setup_ajax.php' );
require_once( WPBC_PLUGIN_DIR . '/includes/page-setup/setup_support.php' );

/** Show Content
 *  Update Content
 *  Define Slug
 *  Define where to show
 */
class WPBC_Page_AJX_Setup_Wizard extends WPBC_Page_Structure {

	private $is_full_screen = true;

   	public function __construct() {

	    parent::__construct();

		add_filter( 'admin_body_class', array( $this, 'add_loading_classes' ) );
    }


    public function in_page() {
        return 'wpbc-setup';
    }


    public function tabs() {

        $tabs = array();
        $tabs[ 'step_01' ] = array(
			'is_force_full_screen'              => true,                                  // true | false. Force full screen independently from user preference.
			'left_navigation__default_view_mode' => 'none',                               // '' | 'min' | 'compact' | 'max' | 'none'.  By default value is: ''.
			'left_navigation__force_view_mode'   => 'none',                               // '' | 'min' | 'compact' | 'max' | 'none'. Force sidebar mode independently from user preference.
                              'title'		=> __( 'Setup', 'booking' )						// Title of TAB
                            , 'hint'		=> false//__( 'Setup', 'booking' ) . ' - '	 . 'Booking Calendar'					// Hint
                            , 'page_title'	=> false//__( 'Setup', 'booking' ) . ' - '	 . 'Booking Calendar'					// Title of Page
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
                            , 'page_title'=> false//__( 'Setup', 'booking' ) . ' - '	 . 'Booking Calendar'					// Title of Page
                            , 'hint'      => false//__( 'Setup', 'booking' ) . ' - '	 . 'Booking Calendar'					// Hint
                            , 'link' => '#path_setup'                                      								// link
                            , 'position' => ''                                  	// 'left'  ||  'right'  ||  ''
                            , 'css_classes' => ''                               	// CSS class(es)
                            //, 'icon' => 'http://.../icon.png'                 	// Icon - link to the real PNG img
                            //, 'font_icon' => 'wpbc_icn_mail_outline'   			// CSS definition of Font Icon
                                                        , 'default' 	=> true                                	// Is this sub tab activated by default or not: true || false.
                            , 'disabled' 	=> false                               	// Is this sub tab deactivated: true || false.
                            , 'checkbox'  	=> false                              	// or definition array  for specific checkbox: array( 'checked' => true, 'name' => 'feature1_active_status' )   //, 'checkbox'  => array( 'checked' => $is_checked, 'name' => 'enabled_active_status' )
                            , 'content' 	=> 'content'                            // Function to load as content of this TAB
							, 'is_use_navigation_path' 	=> array(
										'path' => array(
											'go_back_to_dashboard' => array(
																'title'  => __('Go to Dashboard','booking'),
																'hint'   => __('Go back to the Dashboard','booking'),
																'icon'   => 'wpbc_icn_navigate_before',
																'url'    => wpbc_get_bookings_url(),	//wpbc_get_settings_url(),
																'attr'   => array( 'style' => 'border-right: 1px solid #0000001a; margin-right: 10px;padding-right: 25px;' .
																							  ( !$this->is_full_screen ? 'display:none;' : '' ) ),
																'class'  => 'wpbc_full_screen_mode_buttons'
															),
											// 'go_back_separtor' => array( 'tag' => '|' ),   //array( 'tag' => '>' ),
											'setup' => array(
																'title'  => __('Setup','booking'),
																'hint'   => __('Initial Setup','booking'),
																'icon'   => 'wpbc_icn_donut_large wpbc_spin wpbc_animation_pause',		// -> wpbc_setup_wizard_page_reload_button__spin_start( ... )
																'attr'   => array( 'style' => 'pointer-events: none;', 'id' => 'wpbc_initial_setup_top_menu_item' ),
																'url'    => '',
																'tag' => 'div',
																'class'  => 'nav-tab-active'
															),
											//		'next_all' => array( 'tag' => '>' ),
											//		'intro' => array(
											//							'title'  => __('Step','booking') . ' ' . wpbc_setup_wizard_page__get_active_step() . ' / ' .wpbc_setup_wizard_page__get_total_steps(),
											//							'hint'   => __('General Settings','booking'),
											//							'icon'   => 'wpbc_icn_layers outlined_flag',//'wpbc_icn_adjust',
											//							'url'    => wpbc_get_setup_wizard_page_url() . '&tab=step_01',
											//							//'attr'   => array()
											//							//'tag'    => 'a',
											//							'class'  => 'nav-tab-active'
											//						),
											'wpbc__container_place__steps_for_timeline' => array(
																'title'  => '',
																'hint'   => '',
																'icon'   => '',
																'action' => '',
																'attr'   => array( 'style' => '' ),
																'tag'    => 'div',
																'class'  => 'wpbc__container_place__steps_for_timeline'
															),
											'full_screen' => array(
																'title'  => '',//__('Full Screen','booking'),
																'hint'   => __('Full Screen','booking'),
																'icon'   => 'wpbc-bi-arrows-fullscreen 0wpbc_icn_zoom_out_map  0wpbc_icn_open_in_full',
																'action' => "jQuery('body').toggleClass('wpbc_admin_full_screen');wpbc_check_full_screen_mode();jQuery('.wpbc_full_screen_mode_buttons').toggle();",
																'attr'   => array( 'style' => 'margin-left:auto;' . ( $this->is_full_screen ? 'display:none;' : '' ) ),
																//'tag'    => 'a',
																'class'  => 'wpbc_full_screen_mode_buttons'
															),
											'full_screen_exit' => array(
																'title'  => '',
																'hint'   => __('Exit Full Screen','booking'),
																'icon'   => 'wpbc-bi-arrows-angle-contract 0wpbc_icn_zoom_in_map  0wpbc_icn_close_fullscreen',
																'action' => "jQuery('body').toggleClass('wpbc_admin_full_screen');wpbc_check_full_screen_mode();jQuery('.wpbc_full_screen_mode_buttons').toggle();",
																'attr' => array( 'style' => 'margin-left:auto;' . ( !$this->is_full_screen ? 'display:none;' : '' ) ),
																//'tag'    => 'a',
																'class'  => 'wpbc_full_screen_mode_buttons'
															)
										)
									)
                        );
         $tabs[ 'step_01' ][ 'subtabs' ] = $subtabs;

        return $tabs;
    }


    public function content() {

        do_action( 'wpbc_hook_settings_page_header', 'page_booking_setup_wizard');										// Define Notices Section and show some static messages, if needed.

		// -------------------------------------------------------------------------------------------------------------
		// Check MultiUser params
		// -------------------------------------------------------------------------------------------------------------
	    if ( ! wpbc_is_mu_user_can_be_here( 'activated_user' ) ) {  return false;  }  									// Check if MU user activated, otherwise show Warning message.
 		// if ( ! wpbc_set_default_resource_to__get() ) return false;                  									// Define default booking resources for $_GET  and  check if booking resource belong to user.


		// -------------------------------------------------------------------------------------------------------------
		// Get and escape request parameters
		// -------------------------------------------------------------------------------------------------------------
       	$escaped_request_params_arr =  wpbc_setup_wizard_page__get_cleaned_params__saved_request_default();


		// -------------------------------------------------------------------------------------------------------------
		// Main Submit Form  (if needed ?)
		// -------------------------------------------------------------------------------------------------------------
		$submit_form_name = 'wpbc_setup_wizard_page_form';                             									// Define form name
		?><form  name="<?php echo esc_attr( $submit_form_name ); ?>" id="<?php echo esc_attr( $submit_form_name ); ?>" action="" method="post" >
			<?php
			   // N o n c e   field, and key for checking   S u b m i t
			   wp_nonce_field( 'wpbc_settings_page_' . $submit_form_name );
			?><input type="hidden" name="is_form_sbmitted_<?php echo esc_attr( $submit_form_name ); ?>" id="is_form_sbmitted_<?php echo esc_attr( $submit_form_name ); ?>" value="1" /><?php

		?></form><?php

		// -------------------------------------------------------------------------------------------------------------
		// JS :: Tooltips, Popover, Datepicker
		// -------------------------------------------------------------------------------------------------------------
		wpbc_js_for_bookings_page();

		?><div id="wpbc_log_screen" class="wpbc_log_screen"></div><?php

		?><div class="wpbc_page_publish_notice_section"><?php
			// This is required for submit of Embed shortcodes into  New or Existing pages !
			do_action( 'wpbc_hook_settings_page_before_content_table', 'resources' );      									// Define Notices Section and show some static messages, if needed
		?></div><?php
		// -------------------------------------------------------------------------------------------------------------
        // ==  Content  ==
		// -------------------------------------------------------------------------------------------------------------
		$this->show__main_container( $escaped_request_params_arr );

		//wpbc_show_wpbc_footer();																						// Rating

        do_action( 'wpbc_hook_settings_page_footer', 'wpbc-ajx_booking_setup_wizard' );
    }


	private function show__main_container( $escaped_request_params_arr ) {

		wpbc_clear_div();
		?>
		<span class="metabox-holder">
			<div id="ajx_nonce_calendar_section"></div>
			<div class="wpbc_setup_wizard_page_container" wpbc_loaded="first_time">
				<div class="wpbc_calendar_loading"><span class="wpbc_icn_autorenew wpbc_spin"></span>&nbsp;&nbsp;<span><?php esc_html_e( 'Loading', 'booking' ); ?>...</span></div>
			</div>
		</span>
		<?php

		wpbc_clear_div();

		?><script type="text/javascript"><?php
			// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			echo wpbc_jq_ready_start();
			if( $this->is_full_screen ) {
			?>
				jQuery( '.wpbc_ui__top_nav__btn_full_screen,.wpbc_ui__top_nav__btn_normal_screen' ).toggleClass( 'wpbc_ui__hide' );
				wpbc_check_full_screen_mode();
			<?php
			}
			?>

			// Set Security - Nonce for Ajax  - Listing
			_wpbc_settings.set_param__secure( 'nonce',   '<?php echo esc_js( wp_create_nonce( 'wpbc_setup_wizard_page_ajx' . '_wpbcnonce' ) ); ?>' );
			_wpbc_settings.set_param__secure( 'user_id', '<?php echo esc_js( wpbc_get_current_user_id() ); ?>' );
			_wpbc_settings.set_param__secure( 'locale',  '<?php echo esc_js( get_user_locale() ); ?>' );

			// Set other parameters
			_wpbc_settings.set_param__other( 'container__main_content', '.wpbc_setup_wizard_page_container' );

			// Send Ajax and then show content
			wpbc_ajx__setup_wizard_page__send_request_with_params( <?php echo wp_json_encode( $escaped_request_params_arr ); ?> );
			<?php
			// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			echo wpbc_jq_ready_end();
		?></script><?php

		/**
		 *   JS Examples of showing specific Step:
		 * 												wpbc_ajx__setup_wizard_page__send_request_with_params( { 'current_step':'date_availability' } );
		 *
		 * 												wpbc_ajx__setup_wizard_page__send_request_with_params( { 'current_step':'general_info' } );
		 */
	}


	/**
	 * Set the admin full screen class
	 *
	 * @param bool $classes Body classes.
	 * @return array
	 */
	public function add_loading_classes( $classes ) {

		if ( ( wpbc_is_setup_wizard_page() ) && ( $this->is_full_screen ) ) {
			$classes .= ' wpbc_admin_full_screen';
		}

		return $classes;
	}
}
add_action('wpbc_menu_created', array( new WPBC_Page_AJX_Setup_Wizard() , '__construct') );    // Executed after creation of Menu


/**
 * Make Setup Status Reset or Complete from  URL
 *
 * @return bool
 */
function wpbc_setup_wizard_page__force_in_get() {

	// Se it as DONE
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
	if ( isset( $_REQUEST['wpbc_setup_wizard'] ) && 'completed' === $_REQUEST['wpbc_setup_wizard'] ) {

		$setup_steps = new WPBC_SETUP_WIZARD_STEPS();
		$setup_steps->db__set_all_steps_as( true );
		wpbc_setup_wizard__set_full_screen_mode_for_current_user( false );

		return true;
	}

	// Reset
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
	if ( isset( $_REQUEST['wpbc_setup_wizard'] ) && 'reset' === $_REQUEST['wpbc_setup_wizard'] ) {

		// -------------------------------------------------------------------------------------------------------------
		// ==  Request  ==          ->  $_REQUEST['all_ajx_params']['page_num'],   $_REQUEST['all_ajx_params']['page_items_count'], ...
		// -------------------------------------------------------------------------------------------------------------
		$user_request = new WPBC_AJX__REQUEST( array(
												   'db_option_name'          => 'booking_setup_wizard_page_request_params',
												   'user_id'                 => wpbc_get_current_user_id(),
												   'request_rules_structure' => wpbc_setup_wizard_page__request_rules_structure()
												)
						);
		// Delete from DB
		$is_reseted = $user_request->user_request_params__db_delete();

		// Clear All Steps      Mark as Undone
		$setup_steps = new WPBC_SETUP_WIZARD_STEPS();
		$setup_steps->db__set_all_steps_as( false );
		update_bk_option( 'booking_wizard_data', array() );
		wpbc_setup_wizard__set_full_screen_mode_for_current_user( false );

		return true;
	}

	$setup_steps = new WPBC_SETUP_WIZARD_STEPS();
	$steps_arr   = $setup_steps->get_steps_arr();
	$request_step = '';

	if ( 'On' === get_bk_option( 'booking_setup_wizard_page_is_completed' ) ) {
		wpbc_setup_wizard__set_full_screen_mode_for_current_user( false );
		return true;
	}
	$is_external_setup_flow_started = $setup_steps->db__is_step_completed( 'bookings_types' );

	// Persist the real setup step when the user lands on an external WPBC admin page.
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
	if ( isset( $_REQUEST['wpbc_setup_step'] ) ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		$request_step_from_request = sanitize_key( wp_unslash( $_REQUEST['wpbc_setup_step'] ) );
		if ( isset( $steps_arr[ $request_step_from_request ] ) ) {
			$request_step = $request_step_from_request;
			$setup_steps->db__save_current_step_name( $request_step );
			wpbc_setup_wizard__set_full_screen_mode_for_current_user( ( ! wpbc_setup_wizard__is_internal_step( $request_step ) ) && ( 'get_started' !== $request_step ) );
		}
	}

	if ( $is_external_setup_flow_started && function_exists( 'wpbc_setup_wizard__detect_step_from_admin_request' ) ) {
		$detected_step = wpbc_setup_wizard__detect_step_from_admin_request();
		if ( empty( $request_step ) && ! empty( $detected_step ) && isset( $steps_arr[ $detected_step ] ) ) {
			$setup_steps->db__save_current_step_name( $detected_step );
			wpbc_setup_wizard__set_full_screen_mode_for_current_user( ! wpbc_setup_wizard__is_internal_step( $detected_step ) );
		}
	}

	// Existing settings pages submit their own forms. This flag lets the setup bar remember that save across reloads.
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
	if ( isset( $_REQUEST['wpbc_setup_saved_step'] ) ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		$saved_step = sanitize_key( wp_unslash( $_REQUEST['wpbc_setup_saved_step'] ) );
		if ( isset( $steps_arr[ $saved_step ] ) ) {
			$setup_steps->db__set_step_as_saved( $saved_step, true );
			$setup_steps->db__save_current_step_name( $saved_step );
		}
	}

	// Continue from an existing WPBC settings page to the next setup target.
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
	if ( isset( $_REQUEST['wpbc_setup_wizard'] ) && 'continue' === $_REQUEST['wpbc_setup_wizard'] ) {

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		$nonce = isset( $_REQUEST['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['_wpnonce'] ) ) : '';
		if ( ! wp_verify_nonce( $nonce, 'wpbc_settings_url_nonce' ) ) {
			return false;
		}

		$setup_steps  = new WPBC_SETUP_WIZARD_STEPS();
		$steps_arr    = $setup_steps->get_steps_arr();
		$current_step = $setup_steps->get_saved_current_step_name();
		$has_explicit_step_context = false;

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		if ( isset( $_REQUEST['wpbc_setup_step'] ) ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
			$request_step = sanitize_key( wp_unslash( $_REQUEST['wpbc_setup_step'] ) );
			if ( isset( $steps_arr[ $request_step ] ) ) {
				$current_step = $request_step;
				$has_explicit_step_context = true;
			}
		}

		// Prefer the step detected on the page that rendered the setup bar. This avoids stale saved state taking over.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		if ( isset( $_REQUEST['wpbc_setup_from_page_step'] ) ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
			$from_page_step = sanitize_key( wp_unslash( $_REQUEST['wpbc_setup_from_page_step'] ) );
			if ( isset( $steps_arr[ $from_page_step ] ) ) {
				$current_step = $from_page_step;
				$has_explicit_step_context = true;
				if ( 'form_structure' === $current_step ) {
					$setup_steps->db__set_step_as_saved( $current_step, true );
				}
			}
		}

		if ( ( ! $has_explicit_step_context ) && function_exists( 'wpbc_setup_wizard__detect_step_from_admin_url' ) ) {
			$referer_step = wpbc_setup_wizard__detect_step_from_admin_url( wp_get_referer() );
			if ( ! empty( $referer_step ) && isset( $steps_arr[ $referer_step ] ) ) {
				$current_step = $referer_step;
				if ( 'form_structure' === $current_step ) {
					$setup_steps->db__set_step_as_saved( $current_step, true );
				}
			}
		}

		$setup_steps->db__save_current_step_name( $current_step );

		if (
			isset( $steps_arr[ $current_step ] )
			&& 'manual_save_required' === $setup_steps->get_step_save_behavior( $current_step )
			&& ! $setup_steps->db__is_step_saved( $current_step )
		) {
			wpbc_redirect( add_query_arg( 'wpbc_setup_save_required', '1', $setup_steps->get_step_target_url( $current_step ) ) );
			exit;
		}

		if ( isset( $steps_arr[ $current_step ] ) ) {
			$setup_steps->db__set_step_as_completed( $current_step );
		}

		$next_step = isset( $steps_arr[ $current_step ]['next'] ) ? $steps_arr[ $current_step ]['next'] : '';
		if ( ( empty( $next_step ) || ( 'welcome' === $next_step ) ) && function_exists( 'wpbc_setup_wizard__get_next_step_name' ) ) {
			$route_next_step = wpbc_setup_wizard__get_next_step_name( $current_step );
			if ( ! empty( $route_next_step ) && isset( $steps_arr[ $route_next_step ] ) ) {
				$next_step = $route_next_step;
			}
		}

		if ( empty( $next_step ) || ( 'welcome' === $next_step ) ) {
			if ( 'get_started' === $current_step || 'complete' === $setup_steps->get_step_save_behavior( $current_step ) ) {
				$setup_steps->db__set_all_steps_as( true );
				wpbc_setup_wizard__set_full_screen_mode_for_current_user( false );
				wpbc_redirect( wpbc_get_bookings_url() );
				exit;
			}

			if ( 'get_started' !== $current_step ) {
				$fallback_step = $setup_steps->get_active_step_name();
				if (
					( ! empty( $fallback_step ) )
					&& isset( $steps_arr[ $fallback_step ] )
					&& ( $fallback_step !== $current_step )
					&& ! $setup_steps->db__is_step_completed( $fallback_step )
				) {
					$setup_steps->db__save_current_step_name( $fallback_step );
					wpbc_redirect( $setup_steps->get_step_target_url( $fallback_step ) );
					exit;
				}
			}

			wpbc_setup_wizard__set_full_screen_mode_for_current_user( false );
			wpbc_redirect( wpbc_get_bookings_url() );
			exit;
		}

		$setup_steps->db__reset_steps_from( $next_step );

		$request_params_to_save = wpbc_setup_wizard_page__get_cleaned_params__saved_request_default();
		if ( ! is_array( $request_params_to_save ) ) {
			$request_params_to_save = wpbc_setup_wizard_page__get__request_values__default();
		}
		$request_params_to_save['current_step'] = $next_step;
		if (
			isset( $steps_arr[ $next_step ] )
			&& 'manual_save_required' === $setup_steps->get_step_save_behavior( $next_step )
			&& ! $setup_steps->db__is_step_completed( $next_step )
		) {
			$setup_steps->db__set_step_as_saved( $next_step, false );
		}

		$user_request = new WPBC_AJX__REQUEST( array(
												   'db_option_name'          => 'booking_setup_wizard_page_request_params',
												   'user_id'                 => wpbc_get_current_user_id(),
												   'request_rules_structure' => wpbc_setup_wizard_page__request_rules_structure()
												)
						);
		$user_request->user_request_params__db_save( $request_params_to_save );

		wpbc_redirect( $setup_steps->get_step_target_url( $next_step ) );
		exit;
	}

	// In the guided setup architecture, Step 5+ is configured on existing WPBC admin pages.
	if (
		wpbc_is_setup_wizard_page()
		&& ( ! ( function_exists( 'wp_doing_ajax' ) && wp_doing_ajax() ) )
	) {
		$current_step = $setup_steps->get_saved_current_step_name();

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		if ( isset( $_REQUEST['current_step'] ) ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
			$request_step = sanitize_key( wp_unslash( $_REQUEST['current_step'] ) );
			if ( isset( $steps_arr[ $request_step ] ) ) {
				$current_step = $request_step;
			}
		}

		if (
			isset( $steps_arr[ $current_step ]['is_external'] )
			&& $steps_arr[ $current_step ]['is_external']
		) {
			wpbc_redirect( $setup_steps->get_step_target_url( $current_step ) );
			exit;
		}
	}

	return false;
}
add_action( 'init', 'wpbc_setup_wizard_page__force_in_get' );
