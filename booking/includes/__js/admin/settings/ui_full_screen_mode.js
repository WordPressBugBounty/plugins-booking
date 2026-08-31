"use strict";
// =====================================================================================================================
// == Full Screen  -  support functions   ==
// =====================================================================================================================

/**
 * Return every cookie path that can apply to the current WordPress admin URL.
 *
 * WordPress may run from a subdirectory. Updating the root, site, and admin
 * paths prevents an older, more-specific cookie from overriding the new mode.
 *
 * @return {string[]} Unique absolute cookie paths.
 */
function wpbc_admin_ui__full_screen__get_cookie_paths() {
	var cookie_paths = [ '/' ];
	var admin_marker = '/wp-admin/';
	var current_path = window.location && window.location.pathname ? window.location.pathname : '';
	var admin_index  = current_path.indexOf( admin_marker );

	if ( admin_index >= 0 ) {
		cookie_paths.push( current_path.substring( 0, admin_index + 1 ) );
		cookie_paths.push( current_path.substring( 0, admin_index + admin_marker.length ) );
	}

	return cookie_paths.filter( function ( path, index ) {
		return path && cookie_paths.indexOf( path ) === index;
	} );
}

/**
 * Save Full Screen preference in a short-lived browser cookie.
 *
 * This makes the next admin page load deterministic even if the asynchronous
 * user-meta request is interrupted. The timestamp lets PHP distinguish this
 * pending value from a stale legacy cookie.
 *
 * @param {string} value Fullscreen mode, either `On` or `Off`.
 *
 * @return {void}
 */
function wpbc_admin_ui__full_screen__set_cookie( value ) {
	var max_age      = 5 * 60;
	var issued_at    = Math.floor( Date.now() / 1000 );
	var cookie_value = encodeURIComponent( value + '|' + issued_at );

	wpbc_admin_ui__full_screen__get_cookie_paths().forEach( function ( cookie_path ) {
		document.cookie = 'wpbc_admin_full_screen=' + cookie_value + '; path=' + cookie_path + '; max-age=' + max_age + '; SameSite=Lax';
	} );
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
