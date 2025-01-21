<?php
/**
 * Page Structure in Admin Panel
 *
 * @version  1.2
 * @package  Any
 * @category Page Structure in Admin Panel
 * @author   wpdevelop
 *
 * @web-site https://wpbookingcalendar.com/
 * @email info@wpbookingcalendar.com
 *
 * @modified 2024-12-23,    2015-11-02
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;                                                                                                               // Exit, if accessed directly.
}

// FixIn: 11.0.0.1.

/**
 * Define Settings Page Structure
 */
abstract class WPBC_Page_Structure {

	/**
	 * Tabs array, same for all objects.
	 *
	 * @var array
	 */
	protected static $nav_tabs;
	/**
	 * Parameters for current page,  if this page selected,  otherwise its = empty array()
	 *
	 * @var array
	 */
	private $current_page_params;
	/**
	 * Is show icons
	 *
	 * @var bool
	 */
	private $is_only_icons                   = false;
	protected $is_use_left_navigation        = false;
	protected $is_use_left_navigation_custom = false;
	protected $is_use_navigation_path        = false;
	/**
	 * Defining Name of parameter in GET request for Navigation TOP and BOTTOM tabs:        - $_GET[ 'tab' ]    == 'payment'        - $_GET[ 'subtab' ] == 'paypal'.
	 *
	 * @var array
	 */
	protected $tags;


	/**
	 * Constructor
	 */
	public function __construct() {

		self::$nav_tabs = array();

		$this->current_page_params = array();

		$this->tags = array();

		// Defining Name of parameter in GET request - $_GET[ 'tab' ]    == 'payment'.
		$this->tags['tab'] = 'tab';

		// Defining Name of parameter in GET request - $_GET[ 'subtab' ] == 'paypal'.
		$this->tags['subtab'] = 'subtab';

		// This Hook fire after creation menu in class WPBC_Admin_Menus.
		add_action( 'wpbc_define_nav_tabs', array( $this, 'wpbc_create_plugin_menu_structure_arr' ) );

		// This Hook fire in the class WPBC_Admin_Menus for showing page content of specific menu.
		add_action( 'wpbc_page_structure_show', array( $this, 'content_structure' ) );
	}

    // -----------------------------------------------------------------------------------------------------------------
    // Abstract Methods
    // -----------------------------------------------------------------------------------------------------------------

    /**
	 * Define slug in what menu to show this page.                             // Parameter relative: $_GET['page'].
     *
     * @return string
     *
     * Example:

        return 'wpbc-settings';

     */
    abstract public function in_page();

    /**
	 * Define Tabs and Subtabs of this Admin Page
     *
     * @return array();

     * Example:

        $tabs = array();
        $tabs[ 'form' ] = array(
                              'title' => __('Form','booking')                   // Title of TAB
                            , 'hint' => __('Customization of Form Fields', 'booking')            // Hint
                            , 'page_title' =>ucwords( __('Form fields', 'booking') )     // Title of Page
                            //, 'link' => ''                                    // Can be skiped,  then generated link based on Page and Tab tags. Or can  be extenral link
                            //, 'position' => ''                                // 'left'  ||  'right'  ||  ''
                            //, 'css_classes' => ''                             // CSS class(es)
                            //, 'icon' => ''                                    // Icon - link to the real PNG img
                            , 'font_icon' => 'wpbc_icn_draw'         // CSS definition  of forn Icon
                            , 'default' => false                                // Is this tab activated by default or not: true || false.
                            , 'disabled' => false                               // Is this tab disbaled: true || false.
                            , 'hided'   => false                                // Is this tab hided: true || false.
                            , 'subtabs' => array()

        );
        $tabs[ 'upgrade' ] = array(
                              'title' => __('Upgrade','booking')                // Title of TAB
                            , 'hint' => __('Upgrade to higher version', 'booking')              // Hint
                            //, 'page_title' => __('Upgrade', 'booking')        // Title of Page
                            , 'link' => 'http://server.com/'                    // Can be skiped,  then generated link based on Page and Tab tags. Or can  be extenral link
                            , 'position' => 'right'                             // 'left'  ||  'right'  ||  ''
                            //, 'css_classes' => ''                             // CSS class(es)
                            //, 'icon' => ''                                    // Icon - link to the real PNG img
                            , 'font_icon' => 'wpbc_icn_auto_graph'// CSS definition  of forn Icon
                            //, 'default' => false                              // Is this tab activated by default or not: true || false.
                            //, 'subtabs' => array()

        );

        $subtabs = array();

        $subtabs['fields'] = array(
                            'type' => 'subtab'                                  // Required| Possible values:  'subtab' | 'separator' | 'button' | 'goto-link' | 'html'
                            , 'title' => __('Form','booking')                   // Title of TAB
                            , 'page_title' => __('Form Settings', 'booking')                            // Title of Page
                            , 'hint' => __('Customization of Form Settings', 'booking')                // Hint
                            , 'link' => ''                                      // link
                            , 'position' => ''                                  // 'left'  ||  'right'  ||  ''
                            , 'css_classes' => ''                               // CSS class(es)
                            //, 'icon' => 'https://www.paypalobjects.com/webstatic/icon/pp258.png'      // Icon - link to the real PNG img
                            //, 'font_icon' => 'wpbc_icn_payment'                        // CSS definition of Font Icon
                            , 'default' =>  true                                // Is this sub tab activated by default or not: true || false.
                            , 'disabled' => false                               // Is this sub tab deactivated: true || false.
                            , 'checkbox'  =>  false                             // or definition array  for specific checkbox: array( 'checked' => true, 'name' => 'feature1_active_status' )
                            , 'content' => 'content'                            // Function to load as conten of this TAB
                        );

        $subtabs['form-separator'] = array(
                            'type' => 'separator'                               // Required| Possible values:  'subtab' | 'separator' | 'button' | 'goto-link' | 'html'
                        );
        $subtabs['form-goto'] = array(
                            'type' => 'goto-link'                               // Required| Possible values:  'subtab' | 'separator' | 'button' | 'goto-link' | 'html'
                            , 'title' =>ucwords( __('Form fields', 'booking') )   // Title of TAB
                            , 'hint' => ''                                      // Hint
                            , 'show_section' => 'id_of_show_section'            // ID of HTML element, for scroll to.
                        );

        ob_start();
        ...
        $html_element_data = ob_get_clean();

        $subtabs['form-selection'] = array(
                            'type' => 'html'                                    // Required| Possible values:  'subtab' | 'separator' | 'button' | 'goto-link' | 'html'
                            , 'html' => $html_element_data
                        );

        $subtabs['form-save'] = array(
                            'type' => 'button'                                  // Required| Possible values:  'subtab' | 'separator' | 'button' | 'goto-link' | 'html'
                            , 'title' => __('Save Changes','booking')           // Title of TAB
                            , 'form' => 'wpbc_form'                             // Required for 'button'!  Name of Form  to submit
                        );

        $tabs[ 'form' ][ 'subtabs' ] = $subtabs;

        return $tabs;
    */
    abstract public function tabs();

    /**
	 * Show Content of this page - Main function.
     *
     *  In top  of this function  have to be checking ubout Update (saving POST request).
     *
     *   Exmaple:

        //  S u b m i t  ///////////////////////////////////////////////////////

        $this_submit_form  = 'wpbc_emails_toolbar';                             // Define form name

        // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
        if ( isset( $_POST['is_form_sbmitted_'. $this_submit_form ] ) ) {

            // Check   N o n c e
            check_admin_referer( 'wpbc_settings_page_' . $this_submit_form  );  // Its stop show anything on submiting, if its not refear to the original page

            // Make Update of settings
            $edit_field_data = $this->update_wpbc_emails_toolbar( $menu_slug );
        }
        ////////////////////////////////////////////////////////////////////////
     */
    abstract public function content();

	/**
	 * This function  can  be overridden  by  child classes for auto  update / save options in main form
	 *
	 * @return void
	 */
	public function maybe_update() {

	}


	// -----------------------------------------------------------------------------------------------------------------
	// C O N T E N T
	// -----------------------------------------------------------------------------------------------------------------

    /**
	 * General Page Structure
     *
     * @param string $page_tag - its the same that  return $this->in_page ()
     */
    public function content_structure( $page_tag ) {

		if ( ! $this->is_page_activated() ) {
			return false;
		}

		$this->maybe_update();

        $active_page_tab = $active_page_subtab = '';

	    if ( ( isset( $this->current_page_params['tab'] ) ) && ( ! empty( $this->current_page_params['tab']['tag'] ) ) ) {
		    $active_page_tab = $this->current_page_params['tab']['tag'];
	    }
	    if ( ( isset( $this->current_page_params['subtab'] ) ) && ( ! empty( $this->current_page_params['subtab']['tag'] ) ) ) {
		    $active_page_subtab = $this->current_page_params['subtab']['tag'];
	    }

		// Fires Before showing settings Content page
        $is_show_this_page = apply_filters( 'wpbc_before_showing_settings_page_is_show_page', true, $page_tag, $active_page_tab, $active_page_subtab  );

	    if ( $is_show_this_page === false ) {
		    return false;
	    }

		// Fires Before showing settings Content page
        do_action( 'wpbc_before_settings_content', $page_tag, $active_page_tab, $active_page_subtab  );


		?><div class="wpbc_page_top__header_tabs"><?php
			?><div    id="<?php echo esc_attr( $page_tag ); ?>-admin-page-top"
				   class="wrap wpbc_page_top <?php
							echo ' wpbc_page_tab__' . esc_attr( $active_page_tab );
							echo ' wpbc_page_subtab__' . esc_attr( $active_page_subtab );
					  ?>"
			><?php
				?><h1 class="wpbc_header wpdvlp-top-tabs"><?php
					?><div class="wpbc_header_menu_tabs"><?php
						if ( ! empty( $this->is_use_navigation_path ) ) {
							$this->show_top_path( $page_tag );                     	// Show Top Path		// FixIn: 10.4.0.2.
						} else {
							$this->show_tabs_line( $page_tag );                     // T O P    T A B S    in  Header
						}
					?></div><?php
	 				make_bk_action( 'wpbc_h1_header_content_end', $page_tag, $active_page_tab, $active_page_subtab );	// FixIn: 9.9.0.10.
				?></h1><?php
			?></div><?php
	  	?></div><?php

		do_action( 'wpbc_after_wpbc_page_top__header_tabs', $page_tag, $active_page_tab, $active_page_subtab );                    // Fires Before showing settings Content page.

	  ?><div id="<?php echo esc_attr( $page_tag ); ?>-admin-page"
			   class="wrap wpbc_page wpbc_page_tab__<?php echo esc_attr( $active_page_tab ); ?> wpbc_page_subtab__<?php echo esc_attr( $active_page_subtab ); ?>" >
            <div class="wpbc_admin_message"></div>
            <div class="wpbc_admin_page">
                <div id="ajax_working"></div>
                <div class="clear wpbc_header_margin"></div>
                <div id="ajax_respond" class="ajax_respond" style="display:none;"></div><?php

				if ( $this->is_use_left_navigation ) {

					?><div class="clear" style="margin-bottom:10px;"></div>
					<div class="wpbc_settings_flex_container">
						<div class="wpbc_settings_flex_container_left">
							<div class="wpbc_settings_navigation_column">
								<?php

								$this->show_tabs_structure( $page_tag );

								?>
							</div>
						</div>
						<div class="wpbc_settings_flex_container_right">
					<?php
				} else {
					$this->show_tabs_structure( $page_tag );                                                            // T A B S.
				}

				wp_nonce_field( 'wpbc_ajax_admin_nonce', 'wpbc_admin_panel_nonce', true, true );

                // C o n t e n t
                if (  ( isset( $this->current_page_params['subtab'] ) ) && ( isset( $this->current_page_params['subtab']['content'] ) )  ) {

                    call_user_func( array( $this, $this->current_page_params['subtab']['content'] ) );

                } else if (  ( isset( $this->current_page_params['tab'] ) ) && ( isset( $this->current_page_params['tab']['content'] ) )  ) {
                    call_user_func( array( $this, $this->current_page_params['tab']['content'] ) );

                } else {
	                $this->content();
                }

                do_action('wpbc_show_settings_content' , $page_tag, $active_page_tab, $active_page_subtab );

				if ( $this->is_use_left_navigation ) { ?>
						</div><!-- wpbc_settings_flex_container_right -->
					</div><!-- wpbc_settings_flex_container --><?php
				}

            ?></div><!-- wpbc_admin_page -->
        </div><!-- ...-admin-page --><?php

        do_action( 'wpbc_after_settings_content', $page_tag, $active_page_tab, $active_page_subtab );                  // Fires After showing settings Content page
    }



    // -----------------------------------------------------------------------------------------------------------------
    // Active Page Parameters
    // -----------------------------------------------------------------------------------------------------------------

    /**
	 * Check if this page selected (active), depend from the GET parameter
     *  If selected, then  define Current Page Parameters.
     *
     * @return boolean
     */
    private function is_page_activated() {

        $is_page_selected = false;

        $this_page = $this->in_page();
	    $this_page_arr = ( is_array( $this_page ) ) ? $this_page : array( $this_page );

		foreach ( $this_page_arr as $this_page ) {

			foreach ( $this->tabs() as $this_tab_tag => $this_tab ) {               // Get First Tab Element,  which  MUST be subtab element, all other tabs, can  be links,  not really  showing content!!!
				break;
			}

			if ( empty( $this_tab ) ) {
				return $this_page;      // this page empty - tabs is empty  array,  probabaly  its was redefined in child CLASS to $tabs = array(); for not ability to open this page.
			}

			$this_subtab_tag = 0;
			$this_subtab     = array( 'default' => false );

			if ( isset( $this_tab['subtabs'] ) )
				foreach ( $this_tab['subtabs'] as $temp_this_subtab_tag => $temp_this_subtab  ) {

					if ( $temp_this_subtab['type'] == 'subtab' ) {                  // Get First Subtab element from  subtabs array
						$this_subtab_tag = $temp_this_subtab_tag;
						$this_subtab     = $temp_this_subtab;
						break;
					}
				}

			// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
			if ( ( isset( $_REQUEST['page'] ) ) && ( $this_page == $_REQUEST['page'] ) ) {                        // We are inside of this page. Menu item selected.

				// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
				if ( ( ! isset( $_REQUEST[ $this->tags['tab'] ] ) )                                                     // TAB      NOT     selected    &&  Default.
					// && ( ! isset( $_REQUEST[ $this->tags['subtab'] ] ) )                                             // SubTab   NOT     selected.
					&& ( isset( $this_tab['default'] ) ) && ( $this_tab['default'] )
				) {
					$is_page_selected = true;
				}
				// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
				if ( ( isset( $_REQUEST[ $this->tags['tab'] ] ) )                                                       // TAB Selected.
					   // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
					&& ( ! isset( $_REQUEST[ $this->tags['subtab'] ] ) )                                                // SubTab   NOT     selected    &&      ! exist     ||  Default.
					   // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
					&& ( $_REQUEST[ $this->tags['tab'] ] === $this_tab_tag )
					&& ( ( 0 === $this_subtab_tag ) || ( $this_subtab['default'] ) )
				) {
					$is_page_selected = true;
				}
				// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
				if ( ( isset( $_REQUEST[ $this->tags['tab'] ] ) )                                                       // TAB      Selected.
				    // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
					&& ( isset( $_REQUEST[ $this->tags['subtab'] ] ) )                                                  // SubTab   Selected.
				    // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
					&& ( $_REQUEST[ $this->tags['tab'] ] === $this_tab_tag )
				    // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
					&& ( $_REQUEST[ $this->tags['subtab'] ] === $this_subtab_tag )
				) {
					$is_page_selected = true;
				}
			}

			// If this page activated,  then define Current Page parameters.
			if ( $is_page_selected ) {
				$this->define_current_page_parameters( $this_tab_tag, $this_tab, $this_subtab_tag, $this_subtab );
			}

			if ( $is_page_selected ) {
				break;
			}
		}

			return $is_page_selected;
    }


    /**
	 * Define parameters for current selected page
     *
     * @param type $paramas
     */
    private function define_current_page_parameters(  $this_tab_tag,  $this_tab, $this_subtab_tag, $this_subtab ) {

		$this->current_page_params = array(
			'tab'  => array_merge( $this_tab, array( 'tag' => $this_tab_tag ) )
		, 'subtab' => array_merge( $this_subtab, array( 'tag' => $this_subtab_tag ) )
		);

	    if ( ( ! empty( $this_subtab ) ) && ( ! empty( $this_subtab['is_use_left_navigation'] ) ) && ( true === $this_subtab['is_use_left_navigation'] ) ) {
		    $this->is_use_left_navigation = true;
	    }

	    if ( ( ! empty( $this_subtab ) ) && ( ! empty( $this_subtab['is_use_left_navigation_custom'] ) ) && ( true === $this_subtab['is_use_left_navigation_custom'] ) ) {
		    $this->is_use_left_navigation_custom = true;
	    }

		// Use Top line as Path and nt the menu		// FixIn: 10.4.0.2.
	    if ( ( ! empty( $this_subtab ) ) && ( ! empty( $this_subtab['is_use_navigation_path'] ) ) ) {
		    $this->is_use_navigation_path = $this_subtab['is_use_navigation_path'];
	    }
    }



    /**
	 * Get all SubTabs of current opened page Tab
     *
     * @param string $menu_in_page_tag - Optional. Menu Tag, the same as $this->in_page ();
     * @return array
     */
    private function get_all_sub_tabs_of_selected_tab( $menu_in_page_tag = false ) {

	    if ( $menu_in_page_tag === false ) {

			//FixIn: 9.8.15.2.3
			$this_page = $this->in_page();
		    $this_page_arr = ( is_array( $this_page ) ) ? $this_page : array( $this_page );

		    $menu_in_page_tag = $this_page_arr[0];
	    }

        $all_sub_tabs_of_selected_tab = self::$nav_tabs[ $menu_in_page_tag ][ $this->current_page_params['tab']['tag'] ]['subtabs'];

        return $all_sub_tabs_of_selected_tab;
    }



    // -----------------------------------------------------------------------------------------------------------------
    // T A B s
    // -----------------------------------------------------------------------------------------------------------------

    // Define ------------------------------------------------------------------

    /**
	 * Define TABS structure.
     *  General structure of tabs for every plugin menu page.
     */
    public function wpbc_create_plugin_menu_structure_arr() {                                    // Function executed after creation menu in class WPBC_Admin_Menus
		/*
		  Array (
            [wpbc-resources] => Array ()
            [wpbc-settings] => Array
                (
                    [general] => Array
                        (
                            [title] => General
                            [page_title] => General Settings
                            ...
                            [subtabs] => Array ()
                        )
                    [help] => Array
                        (
                            [title] => Help
                            [page_title] =>
                            ...
                            [subtabs] => Array ()
                        )
                    [form] => Array
                        (
                            [title] => Form
                            [hint] => Customization of Form Fields
                            [page_title] => Form Fields
                            ...
                            [subtabs] => Array
                                (
                                    [goto-form] => Array
                                        (
                                            [type] => goto-link
                                            [title] => Booking Form Fields
                                            ...
                                            [content] => content
                                            [update] => update
                                        )

                                    [goto-content-data] => Array
                                        (
                                            [type] => button
                                            [title] => Save Changes
                                            [form] => wpbc_form
                                            ...
                                        )

                                )

                        )
                    [payment] => Array
                        (
                            [title] => Payments
                            [hint] => Customization of Payment
                            [page_title] => Payment Gateways
                            ...
                            [subtabs] => Array
                                (
                                    [paypal] => Array
                                        (
                                            [type] => subtab
                                            [title] => PayPal
                                            ...
                                        )

                                    [sage] => Array
                                        (
                                            [type] => subtab
                                            [title] => Sage
                                            ...
                                        )

                                )

                        )

                )

			)
		 */

	    /**
		 * self::$nav_tabs =
		 *
		 *     WP Left Menu			|	Top Horiz Menu		|		Vert Left Menu 		or top submenu
		 * ? page =wpbc-settings 	& 	tab=email 			& 		subtab=new-admin
		 *
		 *  [
	     * 	wpbc-settings = [
	     * 					 		general = [...]
	     * 					 		form    = [...]
	     *                   		email   = [...,
	     * 											subtabs = [
	 	 *													 	new-admin = [
	     *                                          		                    type = "subtab"
	     * 																		, ...
	     */

		$this_page = $this->in_page();															// e.g. 'wpbc-settings'
	    $this_page_arr = ( is_array( $this_page ) ) ? $this_page : array( $this_page );			// [ 'wpbc-settings' ]

		// Menu Structure
		foreach ( $this_page_arr as $this_page ) {

			// WP Left Menu
			if ( ! isset( self::$nav_tabs[ $this_page ] ) ) {
				self::$nav_tabs[ $this_page ] = array();
			}

			// Top Horiz Menu - e.g. [  'calendar_appearance' ] =>  [ ... ] ]
			$local_top_main_menu_arr  = $this->tabs();

			// Vert Left Menu - or top submenu
			$local_vert_left_menu_arr = array();

			foreach ( $local_top_main_menu_arr as $tab_tag => $tab_array ) {

				if ( isset( $tab_array[ 'subtabs' ] ) ) {
					$local_vert_left_menu_arr[ $tab_tag ] = $tab_array[ 'subtabs' ];         // Create new Subtabs array

					unset( $local_top_main_menu_arr[ $tab_tag ][ 'subtabs' ] );                 // Detach Subtabs array from Tab array. It's required for do not overwrite subtabs with  already  exist subtabs in previlosly defined tab.
				} else {
					$local_vert_left_menu_arr[ $tab_tag ] = array();
				}
			}


			foreach ( $local_top_main_menu_arr as $tab_tag => $tab_array ) {

				if ( ! isset( self::$nav_tabs[ $this_page ][ $tab_tag ] ) ) {                 // If this tab  ( for exmaple "payment") declared previously,  then  does not do  anything

					self::$nav_tabs[ $this_page ][ $tab_tag ] = $local_top_main_menu_arr[ $tab_tag ];
					self::$nav_tabs[ $this_page ][ $tab_tag ][ 'subtabs' ] = array();
				}

				if ( isset(self::$nav_tabs[ $this_page ] ) ) {
																										// Merge subtabs (Ex: PayPal and Sage) and attach to current tab: (Ex: payment)
					self::$nav_tabs[ $this_page ][ $tab_tag ][ 'subtabs' ] = array_merge(
																						self::$nav_tabs[ $this_page ][ $tab_tag ][ 'subtabs' ]
																						, $local_vert_left_menu_arr[ $tab_tag ]
																					);
				}
			}

		}
    }


    /**
	 * Get array  of visible TABs
     * Tabs that  do not hided or disbaled
     *
     * @param string $menu_in_page_tag - Menu Tag, the same as $this->in_page ();
     * @return type
     */
    private function get_visible_tabs( $menu_in_page_tag ) {

        $visible_tabs = array();

        foreach ( self::$nav_tabs[ $menu_in_page_tag ] as $tab_tag => $tab ) {

            if (       empty( $tab['disabled']  )
                    && empty( $tab['hided']  )
                ) {
                    $visible_tabs[$tab_tag] = $tab;
                }
        }

        return $visible_tabs;
    }

    // Showing -----------------------------------------------------------------

    /**
     *
     * @param string $menu_in_page_tag - Menu Tag, the same as $this->in_page ();
     * @return boolean - true if nav tabs exist  and false if does not exist
     */
    public function show_tabs_structure( $menu_in_page_tag ) {

        // Exit if no Tabs in this page.
	    if ( empty( self::$nav_tabs[ $menu_in_page_tag ] ) ) {
		    return false;
	    }


		// If custom Left Nav.
	    if ( $this->is_use_left_navigation_custom ) {

			do_action( 'wpbc_page_show_left_navigation_custom', $menu_in_page_tag );

			return false;
	    }


        // Exit if tabs hided or disabled
        $visible_tabs = $this->get_visible_tabs( $menu_in_page_tag );
	    if ( empty( $visible_tabs ) ) {
		    return false;
	    }

	    if ( ! $this->is_use_left_navigation ) {
		    ?><span class="wpdevelop wpdvlp-nav-tabs-container wpbc_top_tabs_sub_menu">
			<div class="clear"></div><?php
	    }

	    // FixIn: 9.8.15.2.
		do_action( 'wpbc_toolbar_top_tabs_insert', $menu_in_page_tag );

        $bottom_tabs = $this->get_all_sub_tabs_of_selected_tab( $menu_in_page_tag );

        if ( ! empty( $bottom_tabs ) ) {                                        // S U B    T A B S
            if ( ! $this->is_use_left_navigation ) {
	            wpbc_bs_toolbar_sub_html_container_start();

	            $this->show_subtabs_line( $bottom_tabs, $menu_in_page_tag );

	            wpbc_bs_toolbar_sub_html_container_end();
            } else {
				$this->show_subtabs_line( $bottom_tabs, $menu_in_page_tag );
            }

        } // Bottom Tabs

	    if ( ! $this->is_use_left_navigation ) {
		    ?></span><?php
	    }

        return true;
    }


	// FixIn: 10.4.0.2.
	/**
	 * Show Top Path
	 *
	 * @param $menu_in_page_tag
	 *
	 * @param string $menu_in_page_tag - Menu Tag, the same as $this->in_page ();
	 */
	function show_top_path( $menu_in_page_tag ) {

		$navigation_path_arr = $this->is_use_navigation_path;

		if (! empty( $navigation_path_arr ) ) {
			if ( ! empty( $navigation_path_arr['path'] ) ) {
				foreach ( $navigation_path_arr['path'] as $el_id => $el_arr ) {

					$defaults = array(
						'tag'   => 'a',
						'title' => '',
						'hint'  => '',
						'class' => '',
						'icon'  => false,
						'url'   => '',
						'attr'  => array(),
						'html'  => '',
					);
					$el_arr   = wp_parse_args( $el_arr, $defaults );

					$tag = 'span';
					if (  in_array( $el_arr['tag'], array( 'a', 'span', 'div', '>', '|' ) ) ) {
						$tag = $el_arr['tag'];
					}

					// Shortcut for 'Next'  breadcrumb
					if ( '>' === $tag ) {
							$tag  = 'span';
							$el_arr['html'] = '<i class="menu_icon icon-1x wpbc_icn_navigate_next"></i>';
							$el_arr['attr'] = array( 'style' => 'padding-left: 0;padding-right: 0;' );
					}
					if ( '|' === $tag ) {
							$tag  = 'div';
							$el_arr['html'] = '<div style="border-left: 2px solid #00000012;width: 0;height: 100%;margin: 0 10px;">&nbsp;</div>';
							$el_arr['attr'] = array( 'style' => 'padding-left: 0;padding-right: 0;' );
					}


					echo '<' . esc_attr( $tag );

					if ( ! empty( $el_arr['action'] ) ) {
						// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
						echo ' onclick="javascript:' . $el_arr['action'] . '" ';

						// URL .
						echo ' href="javascript:void(0);" ';

					} elseif ( ! empty( $el_arr['url'] ) ) {
						// URL .
						echo ' href="' . esc_url( $el_arr['url'] ) . '" ';
					}

					// Hints .
					if ( ! empty( $el_arr['hint'] ) ) {
						echo ' data-original-title="' . esc_attr( $el_arr['hint'] ) . '" ';
					}

					// CSS Class .
					echo ' class="nav-tab ' .
						 ( ( ! empty( $el_arr['class'] ) ) ? esc_attr( $el_arr['class'] ) : '' ) .
						 ( ( ! empty( $el_arr['hint'] ) ) ? ' tooltip_top ' : '' ) .
						 '" ';


					// Other attr .
					if ( ! empty( $el_arr['attr'] ) ) {
						// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
						echo ' ' . WPBC_Settings_API::get_custom_attr_static( array( 'attr' => $el_arr['attr'] ) ) . ' ';
					}

					echo '>';

					// In case if we insert  ANY html .
					if ( ! empty( $el_arr['html'] ) ) {
						// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
						echo $el_arr['html'];
					}
					// Icon .
					if ( ! empty( $el_arr['icon'] ) ) {
						echo '<i class="menu_icon icon-1x ' . esc_attr( $el_arr['icon'] ) . '"></i>';
					}

					// Title .
					if ( ! empty( $el_arr['title'] ) ) {
						// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
						echo '<span class="nav-tab-text">' . ( ( ! empty( $el_arr['icon'] ) ) ? '&nbsp;&nbsp;' : '' ) . $el_arr['title'] . '</span>';
					}
					echo '</' . esc_attr( $tag ) . '>';
				}
			}
		}
	}



    /**
	 * Show Top nav TABs line
     *
     * @param string $menu_in_page_tag - Menu Tag, the same as $this->in_page ();
     */
	public function show_tabs_line( $menu_in_page_tag ) {

		foreach ( self::$nav_tabs[ $menu_in_page_tag ] as $tab_tag => $tab ) {

			$css_classes = ( ( isset( $tab['css_classes'] ) ) ? $tab['css_classes'] : '' );

			if ( ( isset( $this->current_page_params['tab'] ) ) && ( $this->current_page_params['tab']['tag'] === $tab_tag ) ) {
				$css_classes .= ' nav-tab-active';
			}
			if ( ! empty( $tab['position'] ) ) {
				$css_classes .= ' nav-tab-position-' . $tab['position'];
			}
			if ( ! empty( $tab['hided'] ) ) {
				$css_classes .= ' hide';
			}
			if ( ( isset( $tab['disabled'] ) ) && ( $tab['disabled'] ) ) {
				$css_classes .= ' wpdevelop-tab-disabled';
			}
			$tab['css_classes'] = $css_classes;

			$tab['link'] = ( ! empty( $tab['link'] ) ? $tab['link'] : $this->get_tab_url( $menu_in_page_tag, $tab_tag ) );

			// Recheck active status of default TAB.
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
			if ( ( isset( $_REQUEST[ $this->tags['tab'] ] ) )                                                           // Some Tab  selected.
				// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
				&& ( $_REQUEST[ $this->tags['tab'] ] !== $tab_tag )                                                     // This tag  not in URL.
				// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
				&& ( isset( $tab['default'] ) && ( $tab['default'] ) )                                                  // This tab default,  need to  set  it as not defaultm  for not showing it selected.
			) {
				$tab['default'] = false;
			}

			wpbc_bs_display_tab( $tab );

		}
	}


    /**
	 * Show Sub Menu Lines at the Settings page for Active Tab
     *
     * @param array $bottom_tabs
     * @param string $menu_in_page_tag - Menu Tag, the same as $this->in_page ();
     */
    public function show_subtabs_line( $bottom_tabs, $menu_in_page_tag ) {

        if ( ! empty( $bottom_tabs ) )
        foreach ( $bottom_tabs as $tab_tag => $tab ) {

            switch ( $tab['type'] ) {
                case 'separator':                           // Separator
                    ?><span class="wpdevelop-submenu-tab-separator-vertical"></span><?php
                break;

                case 'button':                              // Button
                   ?><div class="clear-for-mobile"></div><input
                            type="button"
                            class="button button-primary wpbc_submit_button"
                            value="<?php
							// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
							echo $tab['title']; ?>"
                            onclick="if (typeof document.forms['<?php echo esc_attr( $tab['form'] ); ?>'] !== 'undefined'){ document.forms['<?php echo esc_attr( $tab['form'] ); ?>'].submit(); } else { wpbc_admin_show_message( '<?php echo ' <strong>Error!</strong> Form <strong>' , esc_attr($tab['form']) , '</strong> does not exist.'; ?>', 'error', 10000 ); }"     <?php  //FixIn: 7.0.1.56 ?>
                            /><?php
                break;

				case 'html':                                                    // HTML.
					// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					echo $tab['html'];
					break;

				case 'goto-link':
					?><a    class="nav-tab wpdevelop-submenu-tab go-to-link"
							original-title="<?php
							echo( empty( $tab['hint'] ) ? '' : esc_attr( $tab['hint'] ) ); ?>"
							onclick="javascript:wpbc_scroll_to('#<?php
							echo esc_js( $tab['show_section'] ); ?>' );"
							href="javascript:void(0);"><span><?php
						echo esc_html( $tab['title'] ); ?></span></a><?php
					break;

                default:                                    // Link

					$css_classes = ( ( isset( $tab['css_classes'] ) ) ? $tab['css_classes'] : '' );
					$tab['link'] = ( ! empty( $tab['link'] ) ? $tab['link'] : $this->get_tab_url( $menu_in_page_tag, $this->current_page_params['tab']['tag'], $tab_tag ) );

	                if ( $this->is_use_left_navigation ) {

						if ( $tab_tag == $this->current_page_params['subtab']['tag'] ) {
		                    $css_classes .= ' wpbc_settings_navigation_item_active';
	                    }

						$hint_title = '';
						$hint_css_classes = '';
		                if ( ( ! empty( $tab['hint'] ) ) && ( is_array( $tab['hint'] ) ) ) {
			                if ( ! empty( $tab['hint']['title'] ) ) {
								$hint_title = $tab['hint']['title'];
			                }
							if ( ! empty( $tab['hint']['position'] ) ){
								$hint_css_classes .= ' tooltip_' . $tab['hint']['position'];
							}
		                }
						$html_tag = 'a';

						if ( $tab['disabled'] ) {
							$tab['link'] = 'javascript:void(0)';
							$html_tag = 'span';
						}

		                ?><div id="wpbc_settings_left_nav_tab_<?php echo esc_attr( $tab_tag ); ?>"
							   class="wpbc_settings_navigation_item <?php echo esc_attr( $css_classes ); ?>">
						    <<?php echo esc_attr( $html_tag ); ?> class="<?php echo esc_attr( $hint_css_classes ); ?>"
							   title="<?php echo esc_attr( $hint_title ); ?>"
								<?php
								if ( $html_tag == 'a' ) {                                                            // Parameters for A tag
									// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
									echo ' href="', $tab['link'], '" ';

									if ( ! empty( $tab['onclick'] ) ) {
										// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
										echo ' onclick="javascript:', $tab['onclick'], '" ';
									}
								}

	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo wpbc_get_custom_attr( $tab );
								?>
							>
								<?php echo wp_kses_post( $tab['title'] ); ?>
								<?php if ( ( ! empty( $tab['show_checked_icon'] ) ) && ( ! empty( $tab['checked_data'] ) ) ) {
									$is_checked_data = get_bk_option( $tab['checked_data'] );
									if (
										(  ( ! empty( $is_checked_data ) ) && ( isset( $is_checked_data['enabled'] ) ) && ( $is_checked_data['enabled'] == 'On' )  )
									 || (  ( ! empty( $is_checked_data ) ) && ( $is_checked_data === 'On' )  )
									){
										echo '<i class="menu_icon icon-1x wpbc-bi-toggle2-on wpbc_icn_radio_button_checked0" style="margin-left: auto;margin-top: 3px;color: #036aab;"></i>';
									} else{
										echo '<i class="menu_icon icon-1x wpbc-bi-toggle2-off wpbc_icn_radio_button_unchecked0" style="margin-left: auto;margin-top: 3px;"></i>';
									}

								}?>
							</<?php echo esc_attr( $html_tag ); ?>>
						</div><?php

                    } else {


	                    if ( ! empty( $tab['position'] ) ) {
		                    $css_classes .= ' nav-tab-position-' . $tab['position'];
	                    }
	                    if ( $tab_tag == $this->current_page_params['subtab']['tag'] ) {
		                    $css_classes .= ' wpdevelop-submenu-tab-selected';
	                    }
	                    if ( $tab['disabled'] ) {
		                    $css_classes .= ' wpdevelop-submenu-tab-disabled';
	                    }

	                    $tab['css_classes'] = $css_classes;



	                    $tab['top'] = false;
	                    wpbc_bs_display_tab( $tab );
                    }

                break;

            }   // End Switch
        } // End Bottom Tabs Loop

    }


    // -----------------------------------------------------------------------------------------------------------------
    // Support
    // -----------------------------------------------------------------------------------------------------------------

    /**
	 * Get URL of settings page, based on Page Slug and Tab Slug
     *
     * @param string $page_tag
     * @param string $tab_name
     * @param string $subtab_name  ( Optional )
     * @return string - Escaped URL to plugin  page.
     */
    private function get_tab_url( $page_tag, $tab_name, $subtab_name = false ){
        if ( $subtab_name === false )
            return esc_url( admin_url( add_query_arg( array( 'page' => $page_tag, $this->tags['tab'] => $tab_name ), 'admin.php' ) ) );
        else
            return esc_url( admin_url( add_query_arg( array( 'page' => $page_tag, $this->tags['tab'] => $tab_name, $this->tags['subtab'] => $subtab_name ), 'admin.php' ) ) );
    }

}