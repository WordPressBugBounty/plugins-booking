<?php /**
 * @version 1.0
 * @package Booking Calendar
 * @category Content of Add New Booking
 * @author wpdevelop
 *
 * @web-site https://wpbookingcalendar.com/
 * @email info@wpbookingcalendar.com
 *
 * @modified 2015-10-31
 */

if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly


/**
	 * Show Content
 *  Update Content
 *  Define Slug
 *  Define where to show
 */
class WPBC_Page_AddNewBooking extends WPBC_Page_Structure {


	public function in_page() {
		return 'wpbc';
	}

	public function tabs() {

		$is_can_add_booking = WPBC_Add_Booking_Component::current_user_can_add_booking();

		$tabs                = array();
		$tabs['add-booking'] = array(
			'is_show_top_path'                   => false,                                 // true | false.  By default value is: false.
			'is_show_top_navigation'             => true,
			'left_navigation__default_view_mode' => 'min',                             // '' | 'min' | 'compact' | 'max' | 'none'.  By default value is: ''.
			'page_title'                         => __( 'Add New Booking', 'booking' ),        // Header - Title.  If false, than hidden.
			'page_description'                   => __( 'Manually add new bookings from the Admin Panel.', 'booking' ), // Header - Title Description.  If false, than hidden.
			'title'                              => __( 'Add booking', 'booking' ),        // Title of TAB.
			'hint'                               => __( 'Add booking', 'booking' ),        // Hint.
			'link'                               => '',                                    // Can be skiped,  then generated link based on Page and Tab tags. Or can  be extenral link.
			'position'                           => '',                                    // Can be: 'left'  |  'right'  |  ''.
			'css_classes'                        => '',                                    // this is CSS class(es).
			'icon'                               => '',                                    // Icon - link to the real PNG img.
			'font_icon'                          => 'wpbc-bi-plus',               // CSS definition  of forn Icon.
			'default'                            => true,                                  // Is this tab activated by default or not: true || false.
			'disabled'                           => ! $is_can_add_booking,                 // Is this tab disbaled: true || false.
			'hided'                              => ! $is_can_add_booking,                 // Is this tab hided: true || false.
			'subtabs'                            => array(),
		);

		return $tabs;
	}


	public function content() {

		do_action( 'wpbc_hook_add_booking_page_header', 'add_booking' );         // Define Notices Section and show some static messages, if needed.

		if ( ! wpbc_is_mu_user_can_be_here( 'activated_user' ) ) {
			return false;  // Check if MU user activated,  otherwise show Warning message.
		}

		if ( ! WPBC_Add_Booking_Component::current_user_can_add_booking() ) {
			return false;
		}

		if ( ! wpbc_set_default_resource_to__get() ) {
			return false;  // Define default booking resources for $_ GET and check if booking resource belong to user.
		}

		WPBC_Add_Booking_Component::render();

		do_action( 'wpbc_hook_add_booking_page_footer', 'add_booking' );
	}


	/**
	 * Get Calendar Options of specific User
	 *
	 * @return array (number of months, options parameter
	 */
	function get_saved_user_calendar_options() {

		return WPBC_Add_Booking_Component::get_saved_user_calendar_options();
	}

}
add_action('wpbc_menu_created', array( new WPBC_Page_AddNewBooking() , '__construct') );    // Executed after creation of Menu

/**
 * Redirect legacy/main-menu Add Booking page to the Add Booking tab under Bookings.
 *
 * @param string $page_tag Current menu page tag.
 *
 * @return void
 */
function wpbc_add_booking_menu_page__redirect_to_add_booking_tab( $page_tag ) {

	if ( 'wpbc-new' !== $page_tag ) {
		return;
	}

	wpbc_redirect( wpbc_get_new_booking_url() );
}
add_action( 'wpbc_page_structure_show', 'wpbc_add_booking_menu_page__redirect_to_add_booking_tab', 0 );
