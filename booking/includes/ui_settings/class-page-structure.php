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

/**
 * == All Page Parameters ==
 *
 * TODO Refactorig: Continue work with description of the:   List of all parameters, that possible to use in  public function tabs() { ... }

'is_default_full_screen'                    => false,                                                                   // true | false.     Default: false.
'is_force_full_screen'                      => false,                                                                   // true | false.     Default: false.
'right_vertical_sidebar__is_show'           => false,                                                                   // true | false.     Default: false.
'right_vertical_sidebar__default_view_mode' => 'max',                                                                   // '' | 'min' | 'compact' | 'max' | 'none'.     Default: ''.
'left_navigation__default_view_mode'        => 'max',                                                                   // '' | 'min' | 'compact' | 'max' | 'none'.     Default: ''.
'left_navigation__force_view_mode'          => '',                                                                      // '' | 'min' | 'compact' | 'max' | 'none'.     Default: ''.
'right_vertical_sidebar_compact__is_show'   => false,                                                                   // true | false.     Default: false.

// TODO: recheck functionality  and ability to use:

	'is_show_top_path'                          => true,                                                                    // true | false.  By default value is: true.
	'is_show_top_navigation'                    => false,                                                                   // true | false.  By default value is: false.
	'title'                                     => __( 'Booking Form Builder', 'booking' ),                                 // Title of TAB //FixIn: 9.8.15.2.2.
	'hint'                                      => __( 'Define available days', 'booking' ),                                // Hint.
	'page_title'                                => __( 'Booking Form Builder', 'booking' ),                                 // Title of Page.
	'link'                                      => '',                                                                      // Can be skiped,  then generated link based on Page and Tab tags. Or can  be extenral link.
	'position'                                  => '',                                                                      // 'left'  /  'right'  /  ''.
	'css_classes'                               => '',                                                                      // CSS c l a s s(es).
	'icon'                                      => '',                                                                      // Icon - link to the real PNG img.
	'font_icon'                                 => 'wpbc_icn_flip_x0 wpbc-bi-input-cursor-text',                            // 'wpbc_icn_free_cancellation' // CSS definition  of forn Icon.
	'font_icon_right'                           => 'wpbc-bi-asterisk',
	'default'                                   => false,                                                                   // Is this tab activated by default or not: true || false.
	'disabled'                                  => false,                                                                   // Is this tab disbaled: true || false.
	'hided'                                     => false,                                                                   // Is this tab hided: true || false.
	'subtabs'                                   => array(),
	'folder_style'                              => 'order:11;',

 */


/**
 * Define Settings Page Structure
 */
abstract class WPBC_Page_Structure extends WPBC_Menu_Structure {

	// FixIn: 11.0.0.1.

	/**
	 * Constructor
	 */
	public function __construct() {

		parent::__construct();

		// This Hook fire in the class WPBC_Admin_Menus for showing page content of specific menu.
		add_action( 'wpbc_page_structure_show', array( $this, 'content_structure' ) );

		add_filter( 'admin_body_class', array( $this, 'wpbc_add_admin_body_class' ) );
	}


	/**
	 * Set the  wpbc_admin  class  to  body.
	 *
	 * @param bool $classes Body classes.
	 *
	 * @return array
	 */
	public function wpbc_add_admin_body_class( $classes ) {


		if ( $this->is_page_activated() ) {
			$classes .= ' wpbc_admin';
		}

		return $classes;
	}


	// -----------------------------------------------------------------------------------------------------------------
	// Abstract Methods
	// -----------------------------------------------------------------------------------------------------------------
	// FixIn: 10.11.4.4.  Removed abstarct  classes that exists in the parent class.

	/**
	 * Child classes ovveride it for auto update / save options in main form
	 *
	 * @return void
	 */
	public function maybe_update() {}


	/**
	 * Child classes ovveride  --  show vertical "Right Sidebar Content".
	 *  // FixIn: 10.14.1.3.
	 *
	 * @return void
	 */
	public function right_sidebar_content(){}



	/**
	 * Child classes ovveride  --  show vertical "Right Sidebar Content - Compact".
	 *  // FixIn: 10.14.1.3.
	 *
	 * @return void
	 */
	public function right_sidebar_compact_content(){}


	// -----------------------------------------------------------------------------------------------------------------
	// C O N T E N T
	// -----------------------------------------------------------------------------------------------------------------

	/**
	 * General Page Structure
	 *
	 * @param string $page_tag - its the same that  return $this->in_page ().
	 */
	public function content_structure( $page_tag ) {

		// -------------------------------------------------------------------------------------------------------------
		// Checking if this page  -  A C T I V E
		// -------------------------------------------------------------------------------------------------------------
		if ( ! $this->is_page_activated() ) {
			return false;
		}

		$active_page_tab    = $this->get_active__tab__tag();
		$active_page_subtab = $this->get_active__subtab__tag();

		// Fires Before showing settings Content page. Used in MultiUser version for blocking access to some pages.
		$is_show_this_page = apply_filters( 'wpbc_before_showing_settings_page_is_show_page', true, $page_tag, $active_page_tab, $active_page_subtab );
		if ( false === $is_show_this_page ) {
			return false;
		}

		$this->update_nav_tabs_structure( $page_tag, $active_page_tab, $active_page_subtab );

		// -------------------------------------------------------------------------------------------------------------
		// --  U p d a t e  --
		// -------------------------------------------------------------------------------------------------------------
		$this->maybe_update();

		// -------------------------------------------------------------------------------------------------------------
		// --  T e m p l a t e  --
		// -------------------------------------------------------------------------------------------------------------

		// Hook: Fires Before showing settings Content page.
		do_action( 'wpbc_before_settings_content', $page_tag, $active_page_tab, $active_page_subtab );


		$template_params_arr = array(
			'active_page'        => $page_tag,
			'active_tab'         => $active_page_tab,
			'active_subtab'      => $active_page_subtab,
			'page_structure_obj' => $this,
		);
		$settings_templates  = new WPBC_Settings_Page_Parts( $template_params_arr );

		// ---------------------------------------------------------------------------------------------------------
		// Template Header
		// ---------------------------------------------------------------------------------------------------------
		$settings_templates->template_header();

		wp_nonce_field( 'wpbc_ajax_admin_nonce', 'wpbc_admin_panel_nonce', true, true );                                // Nonce.

		// ---------------------------------------------------------------------------------------------------------
		// Content.
		// ---------------------------------------------------------------------------------------------------------
		if ( ( isset( $this->current_page_params['subtab'] ) ) && ( isset( $this->current_page_params['subtab']['content'] ) ) ) {
			call_user_func( array( $this, $this->current_page_params['subtab']['content'] ) );
		} elseif ( ( isset( $this->current_page_params['tab'] ) ) && ( isset( $this->current_page_params['tab']['content'] ) ) ) {
			call_user_func( array( $this, $this->current_page_params['tab']['content'] ) );
		} else {
			$this->content();
		}

		do_action( 'wpbc_show_settings_content', $page_tag, $active_page_tab, $active_page_subtab );                    // Hook.

		// ---------------------------------------------------------------------------------------------------------
		// Template Footer
		// ---------------------------------------------------------------------------------------------------------
		$settings_templates->template_footer();

		do_action( 'wpbc_after_settings_content', $page_tag, $active_page_tab, $active_page_subtab );                   // Hook: Fires After showing settings Content page.
	}


	// -----------------------------------------------------------------------------------------------------------------
	// ==  Support  ==
	// -----------------------------------------------------------------------------------------------------------------

	/**
	 * Update structure of self::$nav_tabs with  'is_active' and 'url' parameters.
	 * We can  do  this here,  because this function executed at  step  of showing content,  and we know about all  the structure of the menus, already.
	 *
	 * Based on  URL: /admin.php?page=wpbc-settings&tab=email&subtab=new-visitor
	 *
	 * @param string $page_tag           - 'wpbc-settings'.
	 * @param string $active_page_tab    - 'email'.
	 * @param string $active_page_subtab - 'new-visitor'.
	 *
	 * @return bool
	 */
	private function update_nav_tabs_structure( $page_tag, $active_page_tab, $active_page_subtab ) {

		if ( empty( self::$nav_tabs ) ) {
			return false;
		}

		// Menu Pages [Bookings, Resources, Prices, Settings  ].
		foreach ( self::$nav_tabs as $nav_page_tag => $nav_page_arr ) {

			// Tabs [ General, Emails, ... ].
			foreach ( self::$nav_tabs[ $nav_page_tag ] as $nav_tab_tag => $nav_tab_arr ) {

				self::$nav_tabs[ $nav_page_tag ][ $nav_tab_tag ]['is_active'] = false;
				self::$nav_tabs[ $nav_page_tag ][ $nav_tab_tag ]['url']       = ( ! empty( self::$nav_tabs[ $nav_page_tag ][ $nav_tab_tag ]['link'] ) )
																					? self::$nav_tabs[ $nav_page_tag ][ $nav_tab_tag ]['link']
																					: $this->get_tab_url( $nav_page_tag, $nav_tab_tag );
				// Inside of this page 'wpbc-settings' ?
				if ( $nav_page_tag === $page_tag ) {

					// Tab not selected -> clicked on Left menu only,  but this is 'DEFAULT' TAB,  so true.
					if ( ( empty( $active_page_tab ) ) && ( ! empty( self::$nav_tabs[ $nav_page_tag ][ $nav_tab_tag ]['default'] ) ) ) {
						self::$nav_tabs[ $nav_page_tag ][ $nav_tab_tag ]['is_active'] = true;
					}

					// Page and Tab clicked !
					if ( ( $nav_page_tag === $page_tag ) && ( $active_page_tab === $nav_tab_tag ) ) {
						self::$nav_tabs[ $nav_page_tag ][ $nav_tab_tag ]['is_active'] = true;
					}
				}

				if ( ! empty( self::$nav_tabs[ $nav_page_tag ][ $nav_tab_tag ]['subtabs'] ) ) {
					// SubTabs e.g.: [ "New booking", "Approved", ... ].
					foreach ( self::$nav_tabs[ $nav_page_tag ][ $nav_tab_tag ]['subtabs'] as $nav_subtab_tag => $nav_subtab_arr ) {

						self::$nav_tabs[ $nav_page_tag ][ $nav_tab_tag ]['subtabs'][ $nav_subtab_tag ]['is_active'] = false;

						self::$nav_tabs[ $nav_page_tag ][ $nav_tab_tag ]['subtabs'][ $nav_subtab_tag ]['url'] = ( ! empty( self::$nav_tabs[ $nav_page_tag ][ $nav_tab_tag ]['subtabs'][ $nav_subtab_tag ]['link'] ) )
																										? self::$nav_tabs[ $nav_page_tag ][ $nav_tab_tag ]['subtabs'][ $nav_subtab_tag ]['link']
																										: $this->get_tab_url( $nav_page_tag, $nav_tab_tag, $nav_subtab_tag );
						// We know that this TAB is active.
						if ( ! empty( self::$nav_tabs[ $nav_page_tag ][ $nav_tab_tag ]['is_active'] ) ) {

							// SubTab not selected -> clicked on Left menu and Tab only,  but not clicked on submenu (e.g. Stripe or "approved email")  and if we have this is 'DEFAULT' TAB,  so true.
							if ( ( empty( $active_page_subtab ) ) && ( ! empty( self::$nav_tabs[ $nav_page_tag ][ $nav_tab_tag ]['subtabs'][ $nav_subtab_tag ]['default'] ) ) ) {
								self::$nav_tabs[ $nav_page_tag ][ $nav_tab_tag ]['subtabs'][ $nav_subtab_tag ]['is_active'] = true;
							}

							// Page and SubTab clicked !
							if ( $active_page_subtab === $nav_subtab_tag ) {
								self::$nav_tabs[ $nav_page_tag ][ $nav_tab_tag ]['subtabs'][ $nav_subtab_tag ]['is_active'] = true;
							}
						}
					}
				}
			}
		}
		return true;
	}

	/**
	 * Get current active TAB 'Tag'
	 *
	 * @return mixed|string
	 */
	protected function get_active__tab__tag() {

		$active_page_tab = '';

		if ( ( isset( $this->current_page_params['tab'] ) ) && ( ! empty( $this->current_page_params['tab']['tag'] ) ) ) {
			$active_page_tab = $this->current_page_params['tab']['tag'];
		}

		return $active_page_tab;
	}

	/**
	 * Get current active SubTAB 'Tag'
	 *
	 * @return mixed|string
	 */
	protected function get_active__subtab__tag() {

		$active_page_subtab = '';

		if ( ( isset( $this->current_page_params['subtab'] ) ) && ( ! empty( $this->current_page_params['subtab']['tag'] ) ) ) {
			$active_page_subtab = $this->current_page_params['subtab']['tag'];
		}

		return $active_page_subtab;
	}

	/**
	 * Get Option. Check if this defined in Tabs or Subtabs array Otherwise return false.
	 *
	 * @param string $option_name  - name of the option,  like 'is_use_new_settings_skin'.
	 *
	 * @return false|mixed
	 *
	 * Example:             $is_use_new_settings_skin = $this->is_use_option__in_subtabs( 'is_use_new_settings_skin' );
	 */
	public function is_use_option__in_subtabs_or_tabs( $option_name ) {

		// Check if this otion defined in tabs or 'subtabs' ?
		$is_use_option = $this->is_use_option__in_subtabs( $option_name );

		// If this option  not defined in 'subtabs', then we check it in 'tab'.
		if ( false === $is_use_option ) {
			$is_use_option = ( $this->is_use_option__in_tabs( $option_name ) );
		}

		return $is_use_option;
	}

	/**
	 * Get Option. Check if this defined in subtabs array Otherwise return false.
	 *
	 * @param string $option_name  - name of the option,  like 'is_use_new_settings_skin'.
	 *
	 * @return false|mixed
	 *
	 * Example:             $is_use_new_settings_skin = $this->is_use_option__in_subtabs( 'is_use_new_settings_skin' );
	 */
	public function is_use_option__in_subtabs( $option_name ) {

		// Check if this otion defined in subtabs ?
		$is_use_option = ( ( isset( $this->current_page_params['subtab'] ) ) && ( ! empty( $this->current_page_params['subtab'][ $option_name ] ) ) )
								? $this->current_page_params['subtab'][ $option_name ]
								: false;

		return $is_use_option;
	}

	/**
	 * Get Option. Check if this defined in btabs array Otherwise return false.
	 *
	 * @param string $option_name  - name of the option,  like 'is_use_new_settings_skin'.
	 *
	 * @return false|mixed
	 *
	 * Example:             $is_use_new_settings_skin = $this->is_use_option__in_subtabs( 'is_use_new_settings_skin' );
	 */
	public function is_use_option__in_tabs( $option_name ) {

		// Check if this otion defined in subtabs ?
		$is_use_option = ( ( isset( $this->current_page_params['tab'] ) ) && ( ! empty( $this->current_page_params['tab'][ $option_name ] ) ) )
								? $this->current_page_params['tab'][ $option_name ]
								: false;

		return $is_use_option;
	}

	/**
	 * Get allowed left sidebar mode.
	 *
	 * @param string $mode Sidebar mode.
	 *
	 * @return string
	 */
	private function get_valid_left_navigation_mode( $mode ) {

		$mode          = strval( $mode );
		$allowed_modes = array( '', 'min', 'compact', 'max', 'none' );

		return in_array( $mode, $allowed_modes, true ) ? $mode : '';
	}

	/**
	 * Get page-defined left sidebar mode before user preferences.
	 *
	 * @return string
	 */
	private function get_page_left_navigation_default_mode() {

		return $this->get_valid_left_navigation_mode( $this->is_use_option__in_subtabs_or_tabs( 'left_navigation__default_view_mode' ) );
	}

	/**
	 * Get forced left sidebar mode, if the current page must not use the user preference.
	 *
	 * @return string
	 */
	private function get_forced_left_navigation_mode() {

		return $this->get_valid_left_navigation_mode( $this->is_use_option__in_subtabs_or_tabs( 'left_navigation__force_view_mode' ) );
	}

	/**
	 * Check whether the current page should save and restore the user left sidebar preference.
	 *
	 * @return bool
	 */
	public function is_left_navigation_user_mode_enabled() {

		$forced_mode = $this->get_forced_left_navigation_mode();

		if ( ! empty( $forced_mode ) ) {
			return false;
		}

		if ( 'none' === $this->get_page_left_navigation_default_mode() ) {
			return false;
		}

		return true;
	}

	/**
	 * Resolve the initial left sidebar mode.
	 *
	 * Forced page mode wins, then the saved user preference, then the page default.
	 *
	 * @return string
	 */
	public function get_left_navigation_default_view_mode() {

		$forced_mode = $this->get_forced_left_navigation_mode();

		if ( ! empty( $forced_mode ) ) {
			return $forced_mode;
		}

		$page_default_mode = $this->get_page_left_navigation_default_mode();

		if ( 'none' === $page_default_mode ) {
			return 'none';
		}

		$saved_user_mode = '';
		if ( class_exists( 'WPBC_User_Custom_Data_Saver' ) ) {
			$saved_user_mode = WPBC_User_Custom_Data_Saver::get_user_data_value( wpbc_get_current_user_id(), 'left_sidebar_view_mode' );
			$saved_user_mode = $this->get_valid_left_navigation_mode( $saved_user_mode );
		}

		if ( ! empty( $saved_user_mode ) && ( 'none' !== $saved_user_mode ) ) {
			return $saved_user_mode;
		}

		return $page_default_mode;
	}

	/**
	 * Check whether the current page should open in fullscreen.
	 *
	 * Forced page mode wins, then the saved user preference, then the page default.
	 *
	 * @return bool
	 */
	public function is_full_screen_mode_enabled() {

		if ( $this->is_use_option__in_subtabs_or_tabs( 'is_force_full_screen' ) ) {
			return true;
		}

		if ( class_exists( 'WPBC_User_Custom_Data_Saver' ) ) {
			$saved_full_screen = WPBC_User_Custom_Data_Saver::get_user_data_value( wpbc_get_current_user_id(), 'is_full_screen' );
			$saved_full_screen = function_exists( 'wpbc_ui__get_full_screen_mode_from_cookie' )
				? wpbc_ui__get_full_screen_mode_from_cookie( $saved_full_screen )
				: $saved_full_screen;

			if ( 'On' === $saved_full_screen ) {
				return true;
			}

			if ( 'Off' === $saved_full_screen ) {
				return false;
			}
		}

		return (bool) $this->is_use_option__in_subtabs_or_tabs( 'is_default_full_screen' );
	}

	/**
	 * Check whether the current page should save and restore the user fullscreen preference.
	 *
	 * @return bool
	 */
	public function is_full_screen_user_mode_enabled() {

		if ( $this->is_use_option__in_subtabs_or_tabs( 'is_force_full_screen' ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Get breadcrumb/status-line items for the top path.
	 *
	 * Pages usually only need 'is_show_top_path' => true. Optional 'top_path'
	 * settings in tabs/subtabs can override root title, root URL, version
	 * visibility, or provide custom items.
	 *
	 * @return array
	 */
	public function get_top_path_items() {

		$page_tag        = $this->get_top_path_page_tag();
		$top_path_config = $this->is_use_option__in_subtabs_or_tabs( 'top_path' );
		$top_path_config = is_array( $top_path_config ) ? $top_path_config : array();

		if ( ! empty( $top_path_config['items'] ) && is_array( $top_path_config['items'] ) ) {
			$items = $this->normalize_top_path_items( $top_path_config['items'] );
			return apply_filters( 'wpbc_ui_settings_top_path_items', $items, $this, $top_path_config );
		}

		$items = array();

		if ( ! isset( $top_path_config['product_title'] ) || false !== $top_path_config['product_title'] ) {
			$items[] = array(
				'title'  => isset( $top_path_config['product_title'] ) ? $top_path_config['product_title'] : __( 'WP Booking Calendar', 'booking' ),
				'url'    => isset( $top_path_config['product_url'] ) ? $top_path_config['product_url'] : $this->get_top_path_product_url(),
				'active' => false,
			);
		}

		if ( ! isset( $top_path_config['root_title'] ) || false !== $top_path_config['root_title'] ) {
			$items[] = array(
				'title'  => isset( $top_path_config['root_title'] ) ? $top_path_config['root_title'] : $this->get_top_path_default_root_title( $page_tag ),
				'url'    => isset( $top_path_config['root_url'] ) ? $top_path_config['root_url'] : $this->get_top_path_default_root_url( $page_tag ),
				'active' => false,
			);
		}

		$tab_item = $this->get_top_path_tab_item( $page_tag );
		if ( ! empty( $tab_item ) ) {
			$items = $this->append_top_path_item( $items, $tab_item );
		}

		$subtab_item = $this->get_top_path_subtab_item( $page_tag );
		if ( ! empty( $subtab_item ) ) {
			$items = $this->append_top_path_item( $items, $subtab_item );
		}

		if ( ! empty( $items ) ) {
			$last_item_index = count( $items ) - 1;
			foreach ( $items as $item_index => $item ) {
				$items[ $item_index ]['active'] = ( $item_index === $last_item_index );
			}
		}

		$items = $this->normalize_top_path_items( $items );

		return apply_filters( 'wpbc_ui_settings_top_path_items', $items, $this, $top_path_config );
	}

	/**
	 * Check whether the top path should be visible.
	 *
	 * The status line is visible by default. Pages can disable it explicitly
	 * with 'is_show_top_path' => false in tab or subtab definition.
	 *
	 * @return bool
	 */
	public function is_top_path_enabled() {

		if ( isset( $this->current_page_params['subtab'] ) && array_key_exists( 'is_show_top_path', $this->current_page_params['subtab'] ) ) {
			return ( false !== $this->current_page_params['subtab']['is_show_top_path'] );
		}

		if ( isset( $this->current_page_params['tab'] ) && array_key_exists( 'is_show_top_path', $this->current_page_params['tab'] ) ) {
			return ( false !== $this->current_page_params['tab']['is_show_top_path'] );
		}

		return true;
	}

	/**
	 * Check whether the top path should include the version/status block.
	 *
	 * @return bool
	 */
	public function is_top_path_show_version() {

		$top_path_config = $this->is_use_option__in_subtabs_or_tabs( 'top_path' );

		if ( is_array( $top_path_config ) && array_key_exists( 'show_version', $top_path_config ) ) {
			return (bool) $top_path_config['show_version'];
		}

		return true;
	}

	/**
	 * Get active page tag for top path generation.
	 *
	 * @return string
	 */
	private function get_top_path_page_tag() {

		$this_page     = $this->in_page();
		$this_page_arr = is_array( $this_page ) ? $this_page : array( $this_page );
		$request_page  = isset( $_REQUEST['page'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['page'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing

		if ( in_array( $request_page, $this_page_arr, true ) ) {
			return $request_page;
		}

		return (string) reset( $this_page_arr );
	}

	/**
	 * Get default root title.
	 *
	 * @param string $page_tag Page tag.
	 *
	 * @return string
	 */
	private function get_top_path_default_root_title( $page_tag ) {

		$root_titles = array(
			'wpbc'              => __( 'Bookings', 'booking' ),
			'wpbc-availability' => __( 'Availability', 'booking' ),
			'wpbc-prices'       => __( 'Prices', 'booking' ),
			'wpbc-resources'    => __( 'Resources', 'booking' ),
			'wpbc-settings'     => __( 'Settings', 'booking' ),
			'wpbc-setup'        => __( 'Setup', 'booking' ),
		);

		return isset( $root_titles[ $page_tag ] ) ? $root_titles[ $page_tag ] : __( 'Booking Calendar', 'booking' );
	}

	/**
	 * Get product root URL.
	 *
	 * @return string
	 */
	private function get_top_path_product_url() {

		if ( function_exists( 'wpbc_get_bookings_url' ) ) {
			return wpbc_get_bookings_url();
		}

		return admin_url( 'admin.php?page=wpbc' );
	}

	/**
	 * Get default root URL.
	 *
	 * @param string $page_tag Page tag.
	 *
	 * @return string
	 */
	private function get_top_path_default_root_url( $page_tag ) {

		if ( 'wpbc' === $page_tag && function_exists( 'wpbc_get_bookings_url' ) ) {
			return wpbc_get_bookings_url();
		}

		if ( 'wpbc-availability' === $page_tag && function_exists( 'wpbc_get_availability_url' ) ) {
			return wpbc_get_availability_url();
		}

		if ( 'wpbc-prices' === $page_tag && function_exists( 'wpbc_get_price_url' ) ) {
			return wpbc_get_price_url();
		}

		if ( 'wpbc-settings' === $page_tag && function_exists( 'wpbc_get_settings_url' ) ) {
			return wpbc_get_settings_url();
		}

		if ( 'wpbc-resources' === $page_tag && function_exists( 'wpbc_get_resources_url' ) ) {
			return wpbc_get_resources_url();
		}

		if ( 'wpbc-setup' === $page_tag && function_exists( 'wpbc_get_setup_wizard_page_url' ) ) {
			return wpbc_get_setup_wizard_page_url();
		}

		return admin_url( add_query_arg( array( 'page' => $page_tag ), 'admin.php' ) );
	}

	/**
	 * Get top path item for the active tab.
	 *
	 * @param string $page_tag Page tag.
	 *
	 * @return array
	 */
	private function get_top_path_tab_item( $page_tag ) {

		$active_tab_tag = $this->get_active__tab__tag();
		$nav_tabs       = $this->get_nav_tabs();
		$tab_arr        = isset( $nav_tabs[ $page_tag ][ $active_tab_tag ] ) ? $nav_tabs[ $page_tag ][ $active_tab_tag ] : array();

		if ( empty( $tab_arr ) && ! empty( $this->current_page_params['tab'] ) ) {
			$tab_arr = $this->current_page_params['tab'];
		}

		if ( empty( $active_tab_tag ) || empty( $tab_arr ) ) {
			return array();
		}

		return array(
			'title'   => isset( $tab_arr['top_path_title'] ) ? $tab_arr['top_path_title'] : ( isset( $tab_arr['title'] ) ? $tab_arr['title'] : '' ),
			'url'     => ! empty( $tab_arr['url'] ) ? $tab_arr['url'] : $this->get_tab_url( $page_tag, $active_tab_tag ),
			'onclick' => ! empty( $tab_arr['onclick'] ) ? $tab_arr['onclick'] : '',
			'active'  => true,
		);
	}

	/**
	 * Get top path item for the active subtab.
	 *
	 * @param string $page_tag Page tag.
	 *
	 * @return array
	 */
	private function get_top_path_subtab_item( $page_tag ) {

		$active_tab_tag    = $this->get_active__tab__tag();
		$active_subtab_tag = $this->get_active__subtab__tag();
		$nav_tabs          = $this->get_nav_tabs();
		$subtab_arr        = isset( $nav_tabs[ $page_tag ][ $active_tab_tag ]['subtabs'][ $active_subtab_tag ] ) ? $nav_tabs[ $page_tag ][ $active_tab_tag ]['subtabs'][ $active_subtab_tag ] : array();

		if ( empty( $subtab_arr ) && ! empty( $this->current_page_params['subtab'] ) ) {
			$subtab_arr = $this->current_page_params['subtab'];
		}

		if ( empty( $active_tab_tag ) || empty( $active_subtab_tag ) || empty( $subtab_arr ) || empty( $subtab_arr['type'] ) || 'subtab' !== $subtab_arr['type'] ) {
			return array();
		}

		return array(
			'title'   => isset( $subtab_arr['top_path_title'] ) ? $subtab_arr['top_path_title'] : ( isset( $subtab_arr['title'] ) ? $subtab_arr['title'] : '' ),
			'url'     => ! empty( $subtab_arr['url'] ) ? $subtab_arr['url'] : $this->get_tab_url( $page_tag, $active_tab_tag, $active_subtab_tag ),
			'onclick' => ! empty( $subtab_arr['onclick'] ) ? $subtab_arr['onclick'] : '',
			'active'  => true,
		);
	}

	/**
	 * Normalize top path item values.
	 *
	 * @param array $items Top path items.
	 *
	 * @return array
	 */
	private function normalize_top_path_items( $items ) {

		$normalized_items = array();

		foreach ( $items as $item ) {
			if ( empty( $item['title'] ) ) {
				continue;
			}

			$normalized_items[] = array(
				'title'   => wp_strip_all_tags( $item['title'] ),
				'url'     => isset( $item['url'] ) ? $item['url'] : '',
				'onclick' => isset( $item['onclick'] ) ? $item['onclick'] : '',
				'active'  => ! empty( $item['active'] ),
			);
		}

		return $normalized_items;
	}

	/**
	 * Append top path item, avoiding consecutive duplicate labels.
	 *
	 * @param array $items Top path items.
	 * @param array $item  New top path item.
	 *
	 * @return array
	 */
	private function append_top_path_item( $items, $item ) {

		if ( empty( $items ) || empty( $item['title'] ) ) {
			$items[] = $item;
			return $items;
		}

		$last_item_index = count( $items ) - 1;
		$last_title      = isset( $items[ $last_item_index ]['title'] ) ? wp_strip_all_tags( $items[ $last_item_index ]['title'] ) : '';
		$item_title      = wp_strip_all_tags( $item['title'] );

		if ( $last_title === $item_title ) {
			if ( ! empty( $item['url'] ) ) {
				$items[ $last_item_index ]['url'] = $item['url'];
			}
			if ( ! empty( $item['onclick'] ) ) {
				$items[ $last_item_index ]['onclick'] = $item['onclick'];
			}
			return $items;
		}

		$items[] = $item;

		return $items;
	}

	/**
	 * Get Navigation path for header, if applicable.
	 * Used in Setup Wizard page.
	 *
	 * @return false|array
	 */
	protected function is_use_navigation_path_arr() {

		// Use Top line as Path in Setup Wizard page  // FixIn: 10.4.0.2.
		$is_use_navigation_path_arr = $this->is_use_option__in_subtabs( 'is_use_navigation_path' );

		return $is_use_navigation_path_arr;
	}

	/**
	 * Get URL of settings page, based on Page Slug and Tab Slug    e.g. page=wpbc-settings&tab=email&subtab=approved
	 *
	 * @param string $page_tag   - e.g. 'wpbc-settings'.
	 * @param string $tab_name   - e.g. 'email'.
	 * @param string $subtab_name ( Optional )   - e.g. 'approved'.
	 *
	 * @return string - Escaped URL to plugin  page.
	 */
	private function get_tab_url( $page_tag, $tab_name, $subtab_name = false ) {
		if ( false === $subtab_name ) {
			return esc_url( admin_url( add_query_arg( array( 'page' => $page_tag, $this->tags['tab'] => $tab_name ), 'admin.php' ) ) );
		} else {
			return esc_url( admin_url( add_query_arg( array( 'page' => $page_tag, $this->tags['tab'] => $tab_name, $this->tags['subtab'] => $subtab_name ), 'admin.php' ) ) );
		}
	}
}
