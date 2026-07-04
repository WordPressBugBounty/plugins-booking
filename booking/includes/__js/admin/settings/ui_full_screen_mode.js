"use strict";
// =====================================================================================================================
// == Full Screen  -  support functions   ==
// =====================================================================================================================

/**
 * Save Full Screen preference in a short browser cookie.
 *
 * This makes the next admin page load deterministic even if the async user-meta
 * AJAX request is interrupted by immediate navigation.
 *
 * @param string value 'On' or 'Off'.
 */
function wpbc_admin_ui__full_screen__set_cookie( value ) {
	var max_age = 60 * 60 * 24 * 365;

	document.cookie = 'wpbc_admin_full_screen=' + encodeURIComponent( value ) + '; path=/; max-age=' + max_age + '; SameSite=Lax';
}

/**
 * Apply Full Screen mode from a user click.
 *
 * @param HTMLElement el                 Clicked control.
 * @param bool        is_save_user_state Whether to save user preference.
 */
function wpbc_admin_ui__full_screen__do_on( el, is_save_user_state ) {
	jQuery( 'body' ).addClass( 'wpbc_admin_full_screen' );
	wpbc_check_full_screen_mode();

	if ( is_save_user_state ) {
		wpbc_admin_ui__full_screen__set_cookie( 'On' );

		if ( 'function' === typeof wpbc_save_custom_user_data_from_element ) {
			wpbc_save_custom_user_data_from_element( el );
		}
	}
}

/**
 * Exit Full Screen mode from a user click.
 *
 * @param HTMLElement el                 Clicked control.
 * @param bool        is_save_user_state Whether to save user preference.
 */
function wpbc_admin_ui__full_screen__do_off( el, is_save_user_state ) {
	jQuery( 'body' ).removeClass( 'wpbc_admin_full_screen' );
	wpbc_check_full_screen_mode();

	if ( is_save_user_state ) {
		wpbc_admin_ui__full_screen__set_cookie( 'Off' );

		if ( 'function' === typeof wpbc_save_custom_user_data_from_element ) {
			wpbc_save_custom_user_data_from_element( el );
		}
	}
}

/**
 * Check Full  screen mode,  by  removing top tab
 */
function wpbc_check_full_screen_mode(){
	if ( jQuery( 'body' ).hasClass( 'wpbc_admin_full_screen' ) ) {
		jQuery( 'html' ).removeClass( 'wp-toolbar' );
	} else {
		jQuery( 'html' ).addClass( 'wp-toolbar' );
	}
	wpbc_check_buttons_max_min_in_full_screen_mode();
}

function wpbc_check_buttons_max_min_in_full_screen_mode() {
	if ( jQuery( 'body' ).hasClass( 'wpbc_admin_full_screen' ) ) {
		jQuery( '.wpbc_ui__top_nav__btn_full_screen'   ).addClass(    'wpbc_ui__hide' );
		jQuery( '.wpbc_ui__top_nav__btn_normal_screen' ).removeClass( 'wpbc_ui__hide' );
	} else {
		jQuery( '.wpbc_ui__top_nav__btn_full_screen'   ).removeClass( 'wpbc_ui__hide' );
		jQuery( '.wpbc_ui__top_nav__btn_normal_screen' ).addClass(    'wpbc_ui__hide' );
	}
}

jQuery( document ).ready( function () {
	wpbc_check_full_screen_mode();
} );
