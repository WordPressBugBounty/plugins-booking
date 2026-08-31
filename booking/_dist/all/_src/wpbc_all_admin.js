
/**
 * Blink specific HTML element to set attention to this element.
 *
 * @param {string} element_to_blink		  - class or id of element: '.wpbc_widget_available_unavailable'
 * @param {int} how_many_times			  - 4
 * @param {int} how_long_to_blink		  - 350
 */
function wpbc_blink_element( element_to_blink, how_many_times = 4, how_long_to_blink = 350 ){

	for ( let i = 0; i < how_many_times; i++ ){
		jQuery( element_to_blink ).fadeOut( how_long_to_blink ).fadeIn( how_long_to_blink );
	}
    jQuery( element_to_blink ).animate( {opacity: 1}, 500 );
}

/**
 *   Support Functions - Spin Icon in Buttons  ------------------------------------------------------------------ */

/**
 * Remove spin icon from  button and Enable this button.
 *
 * @param button_clicked_element_id		- HTML ID attribute of this button
 * @return string						- CSS classes that was previously in button icon
 */
function wpbc_button__remove_spin(button_clicked_element_id) {

	var previos_classes = '';
	if (
		(undefined != button_clicked_element_id)
		&& ('' != button_clicked_element_id)
	) {
		var jElement = jQuery( '#' + button_clicked_element_id );
		if ( jElement.length ) {
			previos_classes = wpbc_button_disable_loading_icon( jElement.get( 0 ) );
		}
	}

	return previos_classes;
}


/**
 * Show Loading (rotating arrow) icon for button that has been clicked
 *
 * @param this_button		- this object of specific button
 * @return string			- CSS classes that was previously in button icon
 */
function wpbc_button_enable_loading_icon(this_button) {

	var jButton         = jQuery( this_button );
	var jIcon           = jButton.find( 'i' );
	var previos_classes = jIcon.attr( 'class' );

	jIcon.removeClass().addClass( 'menu_icon icon-1x wpbc_icn_rotate_right wpbc_spin' );	// Set Rotate icon.
	// jIcon.addClass( 'wpbc_animation_pause' );												// Pause animation.
	// jIcon.addClass( 'wpbc_ui_red' );														// Set icon color red.

	jIcon.attr( 'wpbc_previous_class', previos_classes )

	jButton.addClass( 'disabled' );															// Disable button
	// We need to  set  here attr instead of prop, because for A elements,  attribute 'disabled' do  not added with jButton.prop( "disabled", true );.

	jButton.attr( 'wpbc_previous_onclick', jButton.attr( 'onclick' ) );		// Save this value.
	jButton.attr( 'onclick', '' );											// Disable actions "on click".

	return previos_classes;
}


/**
 * Hide Loading (rotating arrow) icon for button that was clicked and show previous icon and enable button
 *
 * @param this_button		- this object of specific button
 * @return string			- CSS classes that was previously in button icon
 */
function wpbc_button_disable_loading_icon(this_button) {

	var jButton = jQuery( this_button );
	var jIcon   = jButton.find( 'i' );

	var previos_classes = jIcon.attr( 'wpbc_previous_class' );
	if (
		(undefined != previos_classes)
		&& ('' != previos_classes)
	) {
		jIcon.removeClass().addClass( previos_classes );
	}

	jButton.removeClass( 'disabled' );															// Remove Disable button.

	var previous_onclick = jButton.attr( 'wpbc_previous_onclick' )
	if (
		(undefined != previous_onclick)
		&& ('' != previous_onclick)
	) {
		jButton.attr( 'onclick', previous_onclick );
	}

	return previos_classes;
}

/**
 * On selection  of radio button, adjust attributes of radio container
 *
 * @param _this
 */
function wpbc_ui_el__radio_container_selection(_this) {

	if ( jQuery( _this ).is( ':checked' ) ) {
		jQuery( _this ).parents( '.wpbc_ui_radio_section' ).find( '.wpbc_ui_radio_container' ).removeAttr( 'data-selected' );
		jQuery( _this ).parents( '.wpbc_ui_radio_container:not(.disabled)' ).attr( 'data-selected', true );
	}

	if ( jQuery( _this ).is( ':disabled' ) ) {
		jQuery( _this ).parents( '.wpbc_ui_radio_container' ).addClass( 'disabled' );
	}
}

/**
 * On click on Radio Container, we will  select  the  radio button    and then adjust attributes of radio container
 *
 * @param _this
 */
function wpbc_ui_el__radio_container_click(_this) {

	if ( jQuery( _this ).hasClass( 'disabled' ) ) {
		return false;
	}

	var j_radio = jQuery( _this ).find( 'input[type=radio]:not(.wpbc-form-radio-internal)' );
	if ( j_radio.length ) {
		j_radio.prop( 'checked', true ).trigger( 'change' );
	}

}
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

/**
 * Checkbox Selection functions for Listing.
 */

/**
 * Selections of several  checkboxes like in gMail with shift :)
 * Need to  have this structure:
 * .wpbc_selectable_table
 *      .wpbc_selectable_head
 *              .check-column
 *                  :checkbox
 *      .wpbc_selectable_body
 *          .wpbc_row
 *              .check-column
 *                  :checkbox
 *      .wpbc_selectable_foot
 *              .check-column
 *                  :checkbox
 */
function wpbc_define_gmail_checkbox_selection( $ ){

	var checks, first, last, checked, sliced, lastClicked = false;

	// Check all checkboxes.
	$( '.wpbc_selectable_body' ).find( '.check-column' ).find( ':checkbox' ).on(
		'click',
		function (e) {
			if ( 'undefined' == e.shiftKey ) {
				return true;
			}
			if ( e.shiftKey ) {
				if ( ! lastClicked ) {
					return true;
				}
				checks  = $( lastClicked ).closest( '.wpbc_selectable_body' ).find( ':checkbox' ).filter( ':visible:enabled' );
				first   = checks.index( lastClicked );
				last    = checks.index( this );
				checked = $( this ).prop( 'checked' );
				if ( 0 < first && 0 < last && first != last ) {
					sliced = (last > first) ? checks.slice( first, last ) : checks.slice( last, first );
					sliced.prop(
						'checked',
						function () {
							if ( $( this ).closest( '.wpbc_row' ).is( ':visible' ) ) {
								return checked;
							}
							return false;
						}
					).trigger( 'change' );
				}
			}
			lastClicked = this;

			// toggle "check all" checkboxes.
			var unchecked = $( this ).closest( '.wpbc_selectable_body' ).find( ':checkbox' ).filter( ':visible:enabled' ).not( ':checked' );
			$( this ).closest( '.wpbc_selectable_table' ).children( '.wpbc_selectable_head, .wpbc_selectable_foot' ).find( ':checkbox' ).prop(
				'checked',
				function () {
					return (0 === unchecked.length);
				}
			).trigger( 'change' );

			return true;
		}
	);

	// Head || Foot clicking to  select / deselect ALL.
	$( '.wpbc_selectable_head, .wpbc_selectable_foot' ).find( '.check-column :checkbox' ).on(
		'click',
		function (event) {
			var $this          = $( this ),
				$table         = $this.closest( '.wpbc_selectable_table' ),
				controlChecked = $this.prop( 'checked' ),
				toggle         = event.shiftKey || $this.data( 'wp-toggle' );

			$table.children( '.wpbc_selectable_body' ).filter( ':visible' )
				.find( '.check-column' ).find( ':checkbox' )
				.prop(
					'checked',
					function () {
						if ( $( this ).is( ':hidden,:disabled' ) ) {
							return false;
						}
						if ( toggle ) {
							return ! $( this ).prop( 'checked' );
						} else if ( controlChecked ) {
							return true;
						}
						return false;
					}
				).trigger( 'change' );

			$table.children( '.wpbc_selectable_head,  .wpbc_selectable_foot' ).filter( ':visible' )
				.find( '.check-column' ).find( ':checkbox' )
				.prop(
					'checked',
					function () {
						if ( toggle ) {
							return false;
						} else if ( controlChecked ) {
							return true;
						}
						return false;
					}
				);
		}
	);


	// Visually  show selected border.
	$( '.wpbc_selectable_body' ).find( '.check-column :checkbox' ).on(
		'change',
		function (event) {
			if ( jQuery( this ).is( ':checked' ) ) {
				jQuery( this ).closest( '.wpbc_list_row' ).addClass( 'row_selected_color' );
			} else {
				jQuery( this ).closest( '.wpbc_list_row' ).removeClass( 'row_selected_color' );
			}

			// Disable text selection while pressing 'shift'.
			document.getSelection().removeAllRanges();

			// Show or hide buttons on Actions toolbar  at  Booking Listing  page,  if we have some selected bookings.
			wpbc_show_hide_action_buttons_for_selected_bookings();
		}
	);

	wpbc_show_hide_action_buttons_for_selected_bookings();
}


/**
 * Get ID array  of selected elements
 */
function wpbc_get_selected_row_id() {

	var $table      = jQuery( '.wpbc__wrap__booking_listing .wpbc_selectable_table' );
	var checkboxes  = $table.children( '.wpbc_selectable_body' ).filter( ':visible' ).find( '.check-column' ).find( ':checkbox' );
	var selected_id = [];

	jQuery.each(
		checkboxes,
		function (key, checkbox) {
			if ( jQuery( checkbox ).is( ':checked' ) ) {
				var element_id = wpbc_get_row_id_from_element( checkbox );
				selected_id.push( element_id );
			}
		}
	);

	return selected_id;
}


/**
 * Get ID of row,  based on clciked element
 *
 * @param this_inbound_element  - ususlly  this
 * @returns {number}
 */
function wpbc_get_row_id_from_element(this_inbound_element) {

	var element_id = jQuery( this_inbound_element ).closest( '.wpbc_listing_usual_row' ).attr( 'id' );

	element_id = parseInt( element_id.replace( 'row_id_', '' ) );

	return element_id;
}


/**
 * == Booking Listing == Show or hide buttons on Actions toolbar  at    page,  if we have some selected bookings.
 */
function wpbc_show_hide_action_buttons_for_selected_bookings(){

	var selected_rows_arr = wpbc_get_selected_row_id();

	if ( selected_rows_arr.length > 0 ) {
		jQuery( '.hide_button_if_no_selection' ).show();
	} else {
		jQuery( '.hide_button_if_no_selection' ).hide();
	}
}
"use strict";
// =====================================================================================================================
// == Left Bar  -  expand / colapse functions   ==
// =====================================================================================================================

/**
 * Save user's preferred left sidebar mode.
 *
 * @param string mode
 */
function wpbc_admin_ui__sidebar_left__save_mode( mode ) {
	var allowed_modes = [ 'min', 'compact', 'max' ];

	if ( allowed_modes.indexOf( mode ) === -1 ) {
		return;
	}

	var $saver = jQuery( '#wpbc_left_sidebar_view_mode_saver' );

	if ( ! $saver.length ) {
		return;
	}

	if ( 'function' !== typeof wpbc_save_custom_user_data_from_element ) {
		return;
	}

	$saver.data( 'wpbc-u-save-value', mode );
	$saver.attr( 'data-wpbc-u-save-value', mode );

	wpbc_save_custom_user_data_from_element( $saver.get( 0 ) );
}

/**
 * Reveal the active item inside the scrollable left navigation.
 *
 * The active item itself is aligned with a small leading offset, regardless of
 * its position inside a root section. Scrolling is applied only to SimpleBar's
 * internal scroll element so the WordPress administration document does not
 * move.
 *
 * @param {Object|null|undefined} simplebar_instance Optional initialized SimpleBar instance.
 * @return {void}
 */
function wpbc_admin_ui__sidebar_left__scroll_to_active_item( simplebar_instance ) {
	var left_navigation_element = document.querySelector( '.wpbc_ui_el__vert_left_bar__content' );

	if (
		! simplebar_instance
		&& 'undefined' !== typeof SimpleBar
		&& SimpleBar.instances
		&& left_navigation_element
	) {
		simplebar_instance = SimpleBar.instances.get( left_navigation_element );
	}

	if (
		! simplebar_instance
		|| 'function' !== typeof simplebar_instance.getScrollElement
		|| 'function' !== typeof simplebar_instance.getContentElement
	) {
		return;
	}

	window.requestAnimationFrame( function () {
		var scroll_element  = simplebar_instance.getScrollElement();
		var content_element = simplebar_instance.getContentElement();

		if (
			! scroll_element
			|| ! content_element
			|| ! content_element.closest( '.wpbc_ui_el__vert_left_bar__content' )
		) {
			return;
		}

		simplebar_instance.recalculate();

		var active_item = content_element.querySelector( '.wpbc_ui_el__vert_nav_item.active' );

		if ( ! active_item || null === active_item.offsetParent || 0 >= scroll_element.clientHeight ) {
			return;
		}

		var scroll_rect    = scroll_element.getBoundingClientRect();
		var active_rect    = active_item.getBoundingClientRect();
		var current_top    = scroll_element.scrollTop;
		var leading_offset = 85;
		var active_top     = current_top + active_rect.top - scroll_rect.top;
		var target_top     = active_top - leading_offset;

		var maximum_top = Math.max( 0, scroll_element.scrollHeight - scroll_element.clientHeight );

		scroll_element.scrollTop = Math.max( 0, Math.min( Math.round( target_top ), maximum_top ) );
	} );
}

/**
 * Expand Vertical Left Bar.
 *
 * @param bool is_save_user_state Save this mode as user's preference.
 */
function wpbc_admin_ui__sidebar_left__do_max( is_save_user_state ) {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min max compact none' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'max' );
	jQuery( '.wpbc_ui__top_nav__btn_open_left_vertical_nav' ).addClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_left_vertical_nav' ).removeClass( 'wpbc_ui__hide' );

	jQuery( '.wp-admin' ).removeClass( 'wpbc_page_wrapper_left_min wpbc_page_wrapper_left_max wpbc_page_wrapper_left_compact wpbc_page_wrapper_left_none' );
	jQuery( '.wp-admin' ).addClass( 'wpbc_page_wrapper_left_max' );
	wpbc_admin_ui__sidebar_left__scroll_to_active_item();

	if ( is_save_user_state ) {
		wpbc_admin_ui__sidebar_left__save_mode( 'max' );
	}
}

/**
 * Hide Vertical Left Bar.
 *
 * @param bool is_save_user_state Save this mode as user's preference.
 */
function wpbc_admin_ui__sidebar_left__do_min( is_save_user_state ) {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min max compact none' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'min' );
	jQuery( '.wpbc_ui__top_nav__btn_open_left_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_left_vertical_nav' ).addClass( 'wpbc_ui__hide' );

	jQuery( '.wp-admin' ).removeClass( 'wpbc_page_wrapper_left_min wpbc_page_wrapper_left_max wpbc_page_wrapper_left_compact wpbc_page_wrapper_left_none' );
	jQuery( '.wp-admin' ).addClass( 'wpbc_page_wrapper_left_min' );

	if ( is_save_user_state ) {
		wpbc_admin_ui__sidebar_left__save_mode( 'min' );
	}
}

/**
 * Colapse Vertical Left Bar.
 *
 * @param bool is_save_user_state Save this mode as user's preference.
 */
function wpbc_admin_ui__sidebar_left__do_compact( is_save_user_state ) {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min max compact none' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'compact' );
	jQuery( '.wpbc_ui__top_nav__btn_open_left_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_left_vertical_nav' ).addClass( 'wpbc_ui__hide' );

	jQuery( '.wp-admin' ).removeClass( 'wpbc_page_wrapper_left_min wpbc_page_wrapper_left_max wpbc_page_wrapper_left_compact wpbc_page_wrapper_left_none' );
	jQuery( '.wp-admin' ).addClass( 'wpbc_page_wrapper_left_compact' );
	wpbc_admin_ui__sidebar_left__scroll_to_active_item();

	if ( is_save_user_state ) {
		wpbc_admin_ui__sidebar_left__save_mode( 'compact' );
	}
}

/**
 * Completely Hide Vertical Left Bar.
 */
function wpbc_admin_ui__sidebar_left__do_hide() {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min max compact none' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'none' );
	jQuery( '.wpbc_ui__top_nav__btn_open_left_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_left_vertical_nav' ).addClass( 'wpbc_ui__hide' );
	// Hide top "Menu" button with divider.
	jQuery( '.wpbc_ui__top_nav__btn_show_left_vertical_nav,.wpbc_ui__top_nav__btn_show_left_vertical_nav_divider' ).addClass( 'wpbc_ui__hide' );

	jQuery( '.wp-admin' ).removeClass( 'wpbc_page_wrapper_left_min wpbc_page_wrapper_left_max wpbc_page_wrapper_left_compact wpbc_page_wrapper_left_none' );
	jQuery( '.wp-admin' ).addClass( 'wpbc_page_wrapper_left_none' );
}

/**
 * Action on click "Go Back" - show root menu
 * or some other section in left sidebar.
 *
 * @param string menu_to_show - menu slug.
 */
function wpbc_admin_ui__sidebar_left__show_section( menu_to_show ) {
	jQuery( '.wpbc_ui_el__vert_left_bar__section' ).addClass( 'wpbc_ui__hide' )
	jQuery( '.wpbc_ui_el__vert_left_bar__section_' + menu_to_show ).removeClass( 'wpbc_ui__hide' );
}

// =====================================================================================================================
// == Right Side Bar  -  expand / colapse functions   ==
// =====================================================================================================================

/**
 * Synchronize the document body marker for the expanded right sidebar.
 *
 * The marker is domain-neutral so individual administration pages can adjust
 * their presentation without duplicating right-sidebar state handling.
 *
 * @param {boolean} is_open Whether the right sidebar is fully expanded.
 * @return {void}
 */
function wpbc_admin_ui__sidebar_right__set_body_open_state( is_open ) {
	jQuery( 'body' ).toggleClass( 'wpbc_ui_el__vert_right_bar__wrapper_opened', !! is_open );
}

/**
 * Expand Vertical Right Bar.
 */
function wpbc_admin_ui__sidebar_right__do_max() {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min_right max_right compact_right none_right' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'max_right' );
	jQuery( '.wpbc_ui__top_nav__btn_open_right_vertical_nav' ).addClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_right_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	wpbc_admin_ui__sidebar_right__set_body_open_state( true );
}

/**
 * Hide Vertical Right Bar.
 */
function wpbc_admin_ui__sidebar_right__do_min() {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min_right max_right compact_right none_right' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'min_right' );
	jQuery( '.wpbc_ui__top_nav__btn_open_right_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_right_vertical_nav' ).addClass( 'wpbc_ui__hide' );
	wpbc_admin_ui__sidebar_right__set_body_open_state( false );
}

/**
 * Colapse Vertical Right Bar.
 */
function wpbc_admin_ui__sidebar_right__do_compact() {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min_right max_right compact_right none_right' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'compact_right' );
	jQuery( '.wpbc_ui__top_nav__btn_open_right_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_right_vertical_nav' ).addClass( 'wpbc_ui__hide' );
	wpbc_admin_ui__sidebar_right__set_body_open_state( false );
}

/**
 * Completely Hide Vertical Right Bar.
 */
function wpbc_admin_ui__sidebar_right__do_hide() {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min_right max_right compact_right none_right' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'none_right' );
	jQuery( '.wpbc_ui__top_nav__btn_open_right_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_right_vertical_nav' ).addClass( 'wpbc_ui__hide' );
	// Hide top "Menu" button with divider.
	jQuery( '.wpbc_ui__top_nav__btn_show_right_vertical_nav,.wpbc_ui__top_nav__btn_show_right_vertical_nav_divider' ).addClass( 'wpbc_ui__hide' );
	wpbc_admin_ui__sidebar_right__set_body_open_state( false );
}

/**
 * Restore the body marker when a page renders with the right sidebar open.
 */
jQuery( document ).ready( function () {
	wpbc_admin_ui__sidebar_right__set_body_open_state( 0 < jQuery( '.wpbc_settings_page_wrapper.max_right' ).length );
} );

/**
 * Collapse an expanded right sidebar after an opted-in page-content click.
 *
 * Pages enable this behavior through the page-structure
 * right_vertical_sidebar__content_click_collapse_mode option. Interactive
 * controls that open or retain sidebar content can opt out by placing the
 * data-wpbc-right-sidebar-keep-open attribute on themselves or an ancestor.
 *
 * @param {MouseEvent} event Content click event captured before catalog rows.
 * @return {void}
 */
function wpbc_admin_ui__sidebar_right__collapse_from_content_click( event ) {
	var event_target = event.target && 1 === event.target.nodeType ? event.target : null;
	var content_element = event_target && 'function' === typeof event_target.closest
		? event_target.closest( '.wpbc_settings_page_wrapper[data-wpbc-right-sidebar-content-click-collapse-mode] > .wpbc_settings_page_content' )
		: null;
	var $content;
	var $wrapper;
	var collapse_mode;
	var before_collapse_event;

	if ( ! content_element ) {
		return;
	}

	$content = jQuery( content_element );
	$wrapper = $content.closest( '.wpbc_settings_page_wrapper' );
	collapse_mode = String( $wrapper.attr( 'data-wpbc-right-sidebar-content-click-collapse-mode' ) || '' );

	if ( ! $wrapper.hasClass( 'max_right' ) || [ 'min', 'compact', 'none' ].indexOf( collapse_mode ) === -1 ) {
		return;
	}
	if ( jQuery( event.target ).closest( '[data-wpbc-right-sidebar-keep-open]' ).length ) {
		return;
	}

	/*
	 * This click belongs to the open-sidebar dismissal layer. Consume it before
	 * domain row handlers run so the same pointer action cannot close one
	 * inspector and immediately open another one underneath it.
	 */
	event.preventDefault();
	event.stopImmediatePropagation();

	before_collapse_event = jQuery.Event( 'wpbc:right-sidebar-before-content-collapse' );
	$wrapper.trigger( before_collapse_event, [ event ] );
	if ( before_collapse_event.isDefaultPrevented() ) {
		return;
	}

	if ( 'compact' === collapse_mode ) {
		wpbc_admin_ui__sidebar_right__do_compact();
	} else if ( 'none' === collapse_mode ) {
		wpbc_admin_ui__sidebar_right__do_hide();
	} else {
		wpbc_admin_ui__sidebar_right__do_min();
	}

	jQuery( document ).trigger( 'wpbc_setup_wizard_layout_changed' );
}

document.addEventListener( 'click', wpbc_admin_ui__sidebar_right__collapse_from_content_click, true );


/**
 * Action on click "Go Back" - show root menu
 * or some other section in right sidebar.
 *
 * @param string menu_to_show - menu slug.
 */
function wpbc_admin_ui__sidebar_right__show_section( menu_to_show ) {
	jQuery( '.wpbc_ui_el__vert_right_bar__section' ).addClass( 'wpbc_ui__hide' )
	jQuery( '.wpbc_ui_el__vert_right_bar__section_' + menu_to_show ).removeClass( 'wpbc_ui__hide' );
}

// =====================================================================================================================
// == End Right Side Bar  section   ==
// =====================================================================================================================

/**
 * Get anchor(s) array  from  URL.
 * Doc: https://developer.mozilla.org/en-US/docs/Web/API/Location
 *
 * @returns {*[]}
 */
function wpbc_url_get_anchors_arr() {
	var hashes            = window.location.hash.replace( '%23', '#' );
	var hashes_arr        = hashes.split( '#' );
	var result            = [];
	var hashes_arr_length = hashes_arr.length;

	for ( var i = 0; i < hashes_arr_length; i++ ) {
		if ( hashes_arr[i].length > 0 ) {
			result.push( hashes_arr[i] );
		}
	}
	return result;
}

/**
 * Auto Expand Settings section based on URL anchor, after  page loaded.
 */
jQuery( document ).ready( function () { wpbc_admin_ui__redirect_legacy_general_availability_url(); } );
jQuery( document ).ready( function () { wpbc_admin_ui__do_expand_section(); setTimeout( 'wpbc_admin_ui__do_expand_section', 10 ); } );
jQuery( document ).ready( function () { wpbc_admin_ui__do_expand_section(); setTimeout( 'wpbc_admin_ui__do_expand_section', 150 ); } );

/**
 * Redirect old Settings > Availability anchors to the dedicated General Availability page.
 */
function wpbc_admin_ui__redirect_legacy_general_availability_url() {

	if (
		   ( window.location.href.indexOf( 'page=wpbc-settings' ) > -1 )
		&& (
			   ( window.location.hash.indexOf( 'wpbc_general_settings_availability_metabox' ) > -1 )
			|| ( window.location.hash.indexOf( 'wpbc_general_settings_availability_tab' ) > -1 )
		)
	) {
		window.location.replace( window.location.href.split( '?' )[0] + '?page=wpbc-availability&tab=general_availability' );
	}
}

/**
 * Expand section in  General Settings page and select Menu item.
 */
function wpbc_admin_ui__do_expand_section() {

	// window.location.hash  = #section_id  /  doc: https://developer.mozilla.org/en-US/docs/Web/API/Location .
	var anchors_arr        = wpbc_url_get_anchors_arr();
	var anchors_arr_length = anchors_arr.length;

	if ( anchors_arr_length > 0 ) {
		var one_anchor_prop_value = anchors_arr[0].split( 'do_expand__' );
		if ( one_anchor_prop_value.length > 1 ) {

			// 'wpbc_general_settings_calendar_metabox'
			var section_to_show    = one_anchor_prop_value[1];
			var section_id_to_show = '#' + section_to_show;


			// -- Remove selected background in all left  menu  items ---------------------------------------------------
			jQuery( '.wpbc_ui_el__vert_nav_item ' ).removeClass( 'active' );
			// Set left menu selected.
			jQuery( '.do_expand__' + section_to_show + '_link' ).addClass( 'active' );
			var selected_title = jQuery( '.do_expand__' + section_to_show + '_link a .wpbc_ui_el__vert_nav_title ' ).text();

			// Expand section, if it colapsed.
			if ( ! jQuery( '.do_expand__' + section_to_show + '_link' ).parents( '.wpbc_ui_el__level__folder' ).hasClass( 'expanded' ) ) {
				jQuery( '.wpbc_ui_el__level__folder' ).removeClass( 'expanded' );
				jQuery( '.do_expand__' + section_to_show + '_link' ).parents( '.wpbc_ui_el__level__folder' ).addClass( 'expanded' );
			}

			// -- Expand section ---------------------------------------------------------------------------------------
			var container_to_hide_class = '.postbox';
			// Hide sections '.postbox' in admin page and show specific one.
			jQuery( '.wpbc_admin_page ' + container_to_hide_class ).hide();
			jQuery( '.wpbc_container_always_hide__on_left_nav_click' ).hide();
			jQuery( section_id_to_show ).show();

			// Show all other sections,  if provided in URL: ..?page=wpbc-settings#do_expand__wpbc_general_settings_capacity_metabox#wpbc_general_settings_capacity_upgrade_metabox .
			for ( let i = 1; i < anchors_arr_length; i++ ) {
				jQuery( '#' + anchors_arr[i] ).show();
			}

			if ( false ) {
				var targetOffset = wpbc_scroll_to( section_id_to_show );
			}

			// -- Set Value to Input about selected Nav element  ---------------------------------------------------------------       // FixIn: 9.8.6.1.
			var section_id_tab = section_id_to_show.substring( 0, section_id_to_show.length - 8 ) + '_tab';
			if ( container_to_hide_class == section_id_to_show ) {
				section_id_tab = '#wpbc_general_settings_all_tab'
			}
			if ( '#wpbc_general_settings_capacity_metabox,#wpbc_general_settings_capacity_upgrade_metabox' == section_id_to_show ) {
				section_id_tab = '#wpbc_general_settings_capacity_tab'
			}
			jQuery( '#form_visible_section' ).val( section_id_tab );
		}

		// Like blinking some elements.
		wpbc_admin_ui__do__anchor__another_actions();
	}
}

function wpbc_admin_ui__is_in_mobile_screen_size() {
	return wpbc_admin_ui__is_in_this_screen_size( 605 );
}

function wpbc_admin_ui__is_in_this_screen_size(size) {
	return (window.screen.width <= size);
}

/**
 * Open settings page  |  Expand section  |  Select Menu item.
 */
function wpbc_admin_ui__do__open_url__expand_section(url, section_id) {

	// window.location.href = url + '&do_expand=' + section_id + '#do_expand__' + section_id; //.
	window.location.href = url + '#do_expand__' + section_id;

	if ( wpbc_admin_ui__is_in_mobile_screen_size() ) {
		wpbc_admin_ui__sidebar_left__do_min();
	}

	wpbc_admin_ui__do_expand_section();
}


/**
 * Check  for Other actions:  Like blinking some elements in settings page. E.g. Days selection  or  change-over days.
 */
function wpbc_admin_ui__do__anchor__another_actions() {

	var anchors_arr        = wpbc_url_get_anchors_arr();
	var anchors_arr_length = anchors_arr.length;

	// Other actions:  Like blinking some elements.
	for ( var i = 0; i < anchors_arr_length; i++ ) {

		var this_anchor = anchors_arr[i];

		var this_anchor_prop_value = this_anchor.split( 'do_other_actions__' );

		if ( this_anchor_prop_value.length > 1 ) {

			var section_action = this_anchor_prop_value[1];

			switch ( section_action ) {

				case 'blink_day_selections':
					// wpbc_ui_settings__panel__click( '#wpbc_general_settings_calendar_tab a', '#wpbc_general_settings_calendar_metabox', 'Days Selection' );.
					wpbc_blink_element( '.wpbc_tr_set_gen_booking_type_of_day_selections', 4, 350 );
						wpbc_scroll_to( '.wpbc_tr_set_gen_booking_type_of_day_selections' );
					break;

				case 'blink_change_over_days':
					// wpbc_ui_settings__panel__click( '#wpbc_general_settings_calendar_tab a', '#wpbc_general_settings_calendar_metabox', 'Changeover Days' );.
					wpbc_blink_element( '.wpbc_tr_set_gen_booking_range_selection_time_is_active', 4, 350 );
						wpbc_scroll_to( '.wpbc_tr_set_gen_booking_range_selection_time_is_active' );
					break;

				case 'blink_captcha':
					wpbc_blink_element( '.wpbc_tr_set_gen_booking_is_use_captcha', 4, 350 );
						wpbc_scroll_to( '.wpbc_tr_set_gen_booking_is_use_captcha' );
					break;

				default:
			}
		}
	}
}

/**
 * Copy txt to clipbrd from Text fields.
 *
 * @param html_element_id  - e.g. 'data_field'
 * @returns {boolean}
 */
function wpbc_copy_text_to_clipbrd_from_element( html_element_id ) {
	// Get the text field.
	var copyText = document.getElementById( html_element_id );

	// Select the text field.
	copyText.select();
	copyText.setSelectionRange( 0, 99999 ); // For mobile devices.

	// Copy the text inside the text field.
	var is_copied = wpbc_copy_text_to_clipbrd( copyText.value );
	if ( ! is_copied ) {
		console.error( 'Oops, unable to copy', copyText.value );
	}
	return is_copied;
}

/**
 * Copy txt to clipbrd.
 *
 * @param text
 * @returns {boolean}
 */
function wpbc_copy_text_to_clipbrd(text) {

	if ( ! navigator.clipboard ) {
		return wpbc_fallback_copy_text_to_clipbrd( text );
	}

	navigator.clipboard.writeText( text ).then(
		function () {
			// console.log( 'Async: Copying to clipboard was successful!' );.
			return  true;
		},
		function (err) {
			// console.error( 'Async: Could not copy text: ', err );.
			return  false;
		}
	);
}

/**
 * Copy txt to clipbrd - depricated method.
 *
 * @param text
 * @returns {boolean}
 */
function wpbc_fallback_copy_text_to_clipbrd( text ) {

	// -----------------------------------------------------------------------------------------------------------------
	// var textArea   = document.createElement( "textarea" );
	// textArea.value = text;
	//
	// // Avoid scrolling to bottom.
	// textArea.style.top      = "0";
	// textArea.style.left     = "0";
	// textArea.style.position = "fixed";
	// textArea.style.zIndex   = "999999999";
	// document.body.appendChild( textArea );
	// textArea.focus();
	// textArea.select();

	// -----------------------------------------------------------------------------------------------------------------
	// Now get it as HTML  (original here https://stackoverflow.com/questions/34191780/javascript-copy-string-to-clipboard-as-text-html ).

	// [1] - Create container for the HTML.
	var container       = document.createElement( 'div' );
	container.innerHTML = text;

	// [2] - Hide element.
	container.style.position      = 'fixed';
	container.style.pointerEvents = 'none';
	container.style.opacity       = 0;

	// Detect all style sheets of the page.
	var activeSheets = Array.prototype.slice.call( document.styleSheets ).filter(
		function (sheet) {
			return ! sheet.disabled;
		}
	);

	// [3] - Mount the container to the DOM to make `contentWindow` available.
	document.body.appendChild( container );

	// [4] - Copy to clipboard.
	window.getSelection().removeAllRanges();

	var range = document.createRange();
	range.selectNode( container );
	window.getSelection().addRange( range );
	// -----------------------------------------------------------------------------------------------------------------

	var result = false;

	try {
		result = document.execCommand( 'copy' );
		// console.log( 'Fallback: Copying text command was ' + msg ); //.
	} catch ( err ) {
		// console.error( 'Fallback: Oops, unable to copy', err ); //.
	}
	// document.body.removeChild( textArea ); //.

	// [5.4] - Enable CSS.
	var activeSheets_length = activeSheets.length;
	for ( var i = 0; i < activeSheets_length; i++ ) {
		activeSheets[i].disabled = false;
	}

	// [6] - Remove the container
	document.body.removeChild( container );

	return  result;
}
/**
 * WPBC Collapsible Groups
 *
 * Universal, dependency-free controller for expanding/collapsing grouped sections in right-side panels (Inspector/Library/Form Settings, or any other WPBC page).
 *
 * 		=== How to use it (quick) ? ===
 *
 *		-- 1. Markup (independent mode: multiple open allowed) --
 *			<div class="wpbc_collapsible">
 *			  <section class="wpbc_ui__collapsible_group is-open">
 *				<button type="button" class="group__header"><h3>General</h3></button>
 *				<div class="group__fields">…</div>
 *			  </section>
 *			  <section class="wpbc_ui__collapsible_group">
 *				<button type="button" class="group__header"><h3>Advanced</h3></button>
 *				<div class="group__fields">…</div>
 *			  </section>
 *			</div>
 *
 *		-- 2. Exclusive/accordion mode (one open at a time) --
 *			<div class="wpbc_collapsible wpbc_collapsible--exclusive">…</div>
 *
 *		-- 3. Auto-init --
 *			The script auto-initializes on DOMContentLoaded. No extra code needed.
 *
 *		-- 4. Programmatic control (optional)
 *			const root = document.querySelector('#wpbc_bfb__inspector');
 *			const api  = root.__wpbc_collapsible_instance; // set by auto-init
 *
 *			api.open_by_heading('Validation'); // open by heading text
 *			api.open_by_index(0);              // open the first group
 *
 *		-- 5.Listen to events (e.g., to persist “open group” state) --
 *			root.addEventListener('wpbc:collapsible:open',  (e) => { console.log(  e.detail.group ); });
 *			root.addEventListener('wpbc:collapsible:close', (e) => { console.log(  e.detail.group ); });
 *
 *
 *
 * Markup expectations (minimal):
 *  <div class="wpbc_collapsible [wpbc_collapsible--exclusive]">
 *    <section class="wpbc_ui__collapsible_group [is-open]">
 *      <button type="button" class="group__header"> ... </button>
 *      <div class="group__fields"> ... </div>
 *    </section>
 *    ... more <section> ...
 *  </div>
 *
 * Notes:
 *  - Add `is-open` to any section you want initially expanded.
 *  - Add `wpbc_collapsible--exclusive` to the container for "open one at a time" behavior.
 *  - Works with your existing BFB markup (classes used there are the defaults).
 *
 * Accessibility:
 *  - Sets aria-expanded on .group__header
 *  - Sets aria-hidden + [hidden] on .group__fields
 *  - ArrowUp/ArrowDown move focus between headers; Enter/Space toggles
 *
 * Events (bubbles from the <section>):
 *  - 'wpbc:collapsible:open'  (detail: { group, root, instance })
 *  - 'wpbc:collapsible:close' (detail: { group, root, instance })
 *
 * Public API (instance methods):
 *  - init(), destroy(), refresh()
 *  - expand(group, [exclusive]), collapse(group), toggle(group)
 *  - open_by_index(index), open_by_heading(text)
 *  - is_exclusive(), is_open(group)
 *
 * @version 2025-08-26
 * @since 2025-08-26
 */
// ---------------------------------------------------------------------------------------------------------------------
// == File  /collapsible_groups.js == Time point: 2025-08-26 14:13
// ---------------------------------------------------------------------------------------------------------------------
(function (w, d) {
	'use strict';

	class WPBC_Collapsible_Groups {

		/**
		 * Create a collapsible controller for a container.
		 *
		 * @param {HTMLElement|string} root_el
		 *        The container element (or CSS selector) that wraps collapsible groups.
		 *        The container usually has the class `.wpbc_collapsible`.
		 * @param {Object} [opts={}]
		 * @param {string}  [opts.group_selector='.wpbc_ui__collapsible_group']
		 *        Selector for each collapsible group inside the container.
		 * @param {string}  [opts.header_selector='.group__header']
		 *        Selector for the clickable header inside a group.
		 * @param {string}  [opts.fields_selector='.group__fields']
		 *        Selector for the content/panel element inside a group.
		 * @param {string}  [opts.open_class='is-open']
		 *        Class name that indicates the group is open.
		 * @param {boolean} [opts.exclusive=false]
		 *        If true, only one group can be open at a time in this container.
		 *
		 * @constructor
		 * @since 2025-08-26
		 */
		constructor(root_el, opts = {}) {
			this.root = (typeof root_el === 'string') ? d.querySelector( root_el ) : root_el;
			this.opts = Object.assign( {
				group_selector : '.wpbc_ui__collapsible_group',
				header_selector: '.group__header',
				fields_selector: '.group__fields,.group__content',
				open_class     : 'is-open',
				exclusive      : false
			}, opts );

			// Bound handlers (for add/removeEventListener symmetry).
			/** @private */
			this._on_click = this._on_click.bind( this );
			/** @private */
			this._on_keydown = this._on_keydown.bind( this );

			/** @type {HTMLElement[]} @private */
			this._groups = [];
			/** @type {MutationObserver|null} @private */
			this._observer = null;
		}

		/**
		 * Initialize the controller: cache groups, attach listeners, set ARIA,
		 * and start observing DOM changes inside the container.
		 *
		 * @returns {WPBC_Collapsible_Groups} The instance (chainable).
		 * @listens click
		 * @listens keydown
		 * @since 2025-08-26
		 */
		init() {
			if ( !this.root ) {
				return this;
			}
			this._groups = Array.prototype.slice.call(
				this.root.querySelectorAll( this.opts.group_selector )
			);
			this.root.addEventListener( 'click', this._on_click, false );
			this.root.addEventListener( 'keydown', this._on_keydown, false );

			// Observe dynamic inserts/removals (Inspector re-renders).
			this._observer = new MutationObserver( () => {
				this.refresh();
			} );
			this._observer.observe( this.root, { childList: true, subtree: true } );

			this._sync_all_aria();
			return this;
		}

		/**
		 * Tear down the controller: detach listeners, stop the observer,
		 * and drop internal references.
		 *
		 * @returns {void}
		 * @since 2025-08-26
		 */
		destroy() {
			if ( !this.root ) {
				return;
			}
			this.root.removeEventListener( 'click', this._on_click, false );
			this.root.removeEventListener( 'keydown', this._on_keydown, false );
			if ( this._observer ) {
				this._observer.disconnect();
				this._observer = null;
			}
			this._groups = [];
		}

		/**
		 * Re-scan the DOM for current groups and re-apply ARIA to all of them.
		 * Useful after dynamic (re)renders.
		 *
		 * @returns {void}
		 * @since 2025-08-26
		 */
		refresh() {
			if ( !this.root ) {
				return;
			}
			this._groups = Array.prototype.slice.call(
				this.root.querySelectorAll( this.opts.group_selector )
			);
			this._sync_all_aria();
		}

		/**
		 * Check whether the container is in exclusive (accordion) mode.
		 *
		 * Order of precedence:
		 *  1) Explicit option `opts.exclusive`
		 *  2) Container has class `.wpbc_collapsible--exclusive`
		 *  3) Container matches `[data-wpbc-accordion="exclusive"]`
		 *
		 * @returns {boolean} True if exclusive mode is active.
		 * @since 2025-08-26
		 */
		is_exclusive() {
			return !!(
				this.opts.exclusive ||
				this.root.classList.contains( 'wpbc_collapsible--exclusive' ) ||
				this.root.matches( '[data-wpbc-accordion="exclusive"]' )
			);
		}

		/**
		 * Determine whether a specific group is open.
		 *
		 * @param {HTMLElement} group The group element to test.
		 * @returns {boolean} True if the group is currently open.
		 * @since 2025-08-26
		 */
		is_open(group) {
			return group.classList.contains( this.opts.open_class );
		}

		/**
		 * Open a group. Honors exclusive mode by collapsing all sibling groups
		 * (queried from the live DOM at call-time).
		 *
		 * @param {HTMLElement} group The group element to open.
		 * @param {boolean} [exclusive]
		 *        If provided, overrides container mode for this action only.
		 * @returns {void}
		 * @fires CustomEvent#wpbc:collapsible:open
		 * @since 2025-08-26
		 */
		expand(group, exclusive) {
			if ( !group ) {
				return;
			}
			const do_exclusive = (typeof exclusive === 'boolean') ? exclusive : this.is_exclusive();
			if ( do_exclusive ) {
				// Always use the live DOM, not the cached list.
				Array.prototype.forEach.call(
					this.root.querySelectorAll( this.opts.group_selector ),
					(g) => {
						if ( g !== group ) {
							this._set_open( g, false );
						}
					}
				);
			}
			this._set_open( group, true );
		}

		/**
		 * Close a group.
		 *
		 * @param {HTMLElement} group The group element to close.
		 * @returns {void}
		 * @fires CustomEvent#wpbc:collapsible:close
		 * @since 2025-08-26
		 */
		collapse(group) {
			if ( !group ) {
				return;
			}
			this._set_open( group, false );
		}

		/**
		 * Toggle a group's open/closed state.
		 *
		 * @param {HTMLElement} group The group element to toggle.
		 * @returns {void}
		 * @since 2025-08-26
		 */
		toggle(group) {
			if ( !group ) {
				return;
			}
			this[this.is_open( group ) ? 'collapse' : 'expand']( group );
		}

		/**
		 * Open a group by its index within the container (0-based).
		 *
		 * @param {number} index Zero-based index of the group.
		 * @returns {void}
		 * @since 2025-08-26
		 */
		open_by_index(index) {
			const group = this._groups[index];
			if ( group ) {
				this.expand( group );
			}
		}

		/**
		 * Open a group by matching text contained within the <h3> inside the header.
		 * The comparison is case-insensitive and substring-based.
		 *
		 * @param {string} text Text to match against the heading contents.
		 * @returns {void}
		 * @since 2025-08-26
		 */
		open_by_heading(text) {
			if ( !text ) {
				return;
			}
			const t     = String( text ).toLowerCase();
			const match = this._groups.find( (g) => {
				const h = g.querySelector( this.opts.header_selector + ' h3' );
				return h && h.textContent.toLowerCase().indexOf( t ) !== -1;
			} );
			if ( match ) {
				this.expand( match );
			}
		}

		// -------------------------------------------------------------------------------------------------------------
		// Internal
		// -------------------------------------------------------------------------------------------------------------

		/**
		 * Delegated click handler for headers.
		 *
		 * @private
		 * @param {MouseEvent} ev The click event.
		 * @returns {void}
		 * @since 2025-08-26
		 */
		_on_click(ev) {
			const btn = ev.target.closest( this.opts.header_selector );
			if ( !btn || !this.root.contains( btn ) ) {
				return;
			}
			ev.preventDefault();
			ev.stopPropagation();
			const group = btn.closest( this.opts.group_selector );
			if ( group ) {
				this.toggle( group );
			}
		}

		/**
		 * Keyboard handler for header interactions and roving focus:
		 *  - Enter/Space toggles the active group.
		 *  - ArrowUp/ArrowDown moves focus between group headers.
		 *
		 * @private
		 * @param {KeyboardEvent} ev The keyboard event.
		 * @returns {void}
		 * @since 2025-08-26
		 */
		_on_keydown(ev) {
			const btn = ev.target.closest( this.opts.header_selector );
			if ( !btn ) {
				return;
			}

			const key = ev.key;

			// Toggle on Enter / Space.
			if ( key === 'Enter' || key === ' ' ) {
				ev.preventDefault();
				const group = btn.closest( this.opts.group_selector );
				if ( group ) {
					this.toggle( group );
				}
				return;
			}

			// Move focus with ArrowUp/ArrowDown between headers in this container.
			if ( key === 'ArrowUp' || key === 'ArrowDown' ) {
				ev.preventDefault();
				const headers = Array.prototype.map.call(
					this.root.querySelectorAll( this.opts.group_selector ),
					(g) => g.querySelector( this.opts.header_selector )
				).filter( Boolean );
				const idx     = headers.indexOf( btn );
				if ( idx !== -1 ) {
					const next_idx = (key === 'ArrowDown')
						? Math.min( headers.length - 1, idx + 1 )
						: Math.max( 0, idx - 1 );
					headers[next_idx].focus();
				}
			}
		}

		/**
		 * Apply ARIA synchronization to all known groups based on their open state.
		 *
		 * @private
		 * @returns {void}
		 * @since 2025-08-26
		 */
		_sync_all_aria() {
			this._groups.forEach( (g) => this._sync_group_aria( g ) );
		}

		/**
		 * Sync ARIA attributes and visibility on a single group.
		 *
		 * @private
		 * @param {HTMLElement} group The group element to sync.
		 * @returns {void}
		 * @since 2025-08-26
		 */
		_sync_group_aria(group) {
			const is_open = this.is_open( group );
			const header  = group.querySelector( this.opts.header_selector );
			// Only direct children that match.
			const panels = Array.prototype.filter.call( group.children, (el) => el.matches( this.opts.fields_selector ) );

			// Header ARIA.
			if ( header ) {
				header.setAttribute( 'role', 'button' );
				header.setAttribute( 'aria-expanded', is_open ? 'true' : 'false' );

				if ( panels.length ) {
					// Ensure each panel has an id; then wire aria-controls with space-separated ids.
					const ids = panels.map( (p) => {
						if ( !p.id ) p.id = this._generate_id( 'wpbc_collapsible_panel' );
						return p.id;
					} );
					header.setAttribute( 'aria-controls', ids.join( ' ' ) );
				}
			}

			// (3) Panels ARIA + visibility.
			panels.forEach( (p) => {
				p.hidden = !is_open;                            // actual visibility.
				p.setAttribute( 'aria-hidden', is_open ? 'false' : 'true' ); // ARIA.
			} );
		}

		/**
		 * Internal state change: set a group's open/closed state, sync ARIA,
		 * manage focus on collapse, and emit a custom event.
		 *
		 * @private
		 * @param {HTMLElement} group The group element to mutate.
		 * @param {boolean} open Whether the group should be open.
		 * @returns {void}
		 * @fires CustomEvent#wpbc:collapsible:open
		 * @fires CustomEvent#wpbc:collapsible:close
		 * @since 2025-08-26
		 */
		_set_open(group, open) {
			if ( !open && group.contains( document.activeElement ) ) {
				const header = group.querySelector( this.opts.header_selector );
				header && header.focus();
			}
			group.classList.toggle( this.opts.open_class, open );
			this._sync_group_aria( group );
			const ev_name = open ? 'wpbc:collapsible:open' : 'wpbc:collapsible:close';
			group.dispatchEvent( new CustomEvent( ev_name, {
				bubbles: true,
				detail : { group, root: this.root, instance: this }
			} ) );
		}

		/**
		 * Generate a unique DOM id with the specified prefix.
		 *
		 * @private
		 * @param {string} prefix The id prefix to use.
		 * @returns {string} A unique element id not present in the document.
		 * @since 2025-08-26
		 */
		_generate_id(prefix) {
			let i = 1;
			let id;
			do {
				id = prefix + '_' + (i++);
			}
			while ( d.getElementById( id ) );
			return id;
		}
	}

	/**
	 * Auto-initialize collapsible controllers on the page.
	 * Finds top-level `.wpbc_collapsible` containers (ignoring nested ones),
	 * and instantiates {@link WPBC_Collapsible_Groups} on each.
	 *
	 * @function WPBC_Collapsible_AutoInit
	 * @returns {void}
	 * @since 2025-08-26
	 * @example
	 * // Runs automatically on DOMContentLoaded; can also be called manually:
	 * WPBC_Collapsible_AutoInit();
	 */
	function wpbc_collapsible__auto_init() {
		var ROOT  = '.wpbc_collapsible';
		var nodes = Array.prototype.slice.call( d.querySelectorAll( ROOT ) )
			.filter( function (n) {
				return !n.parentElement || !n.parentElement.closest( ROOT );
			} );

		nodes.forEach( function (node) {
			if ( node.__wpbc_collapsible_instance ) {
				return;
			}
			var exclusive = node.classList.contains( 'wpbc_collapsible--exclusive' ) || node.matches( '[data-wpbc-accordion="exclusive"]' );

			node.__wpbc_collapsible_instance = new WPBC_Collapsible_Groups( node, { exclusive } ).init();
		} );
	}

	// Export to global for manual control if needed.
	w.WPBC_Collapsible_Groups   = WPBC_Collapsible_Groups;
	w.WPBC_Collapsible_AutoInit = wpbc_collapsible__auto_init;

	// DOM-ready auto init.
	if ( d.readyState === 'loading' ) {
		d.addEventListener( 'DOMContentLoaded', wpbc_collapsible__auto_init, { once: true } );
	} else {
		wpbc_collapsible__auto_init();
	}
})( window, document );

/* globals window, document */
/**
 * WPBC Slider Length Groups
 *
 * Universal, dependency-free controller that keeps a "length" control in sync:
 *  - number input  (data-wpbc_slider_len_value)
 *  - unit select   (data-wpbc_slider_len_unit)
 *  - range slider  (data-wpbc_slider_len_range)
 *  - writer input  (data-wpbc_slider_len_writer)  [optional but recommended]
 *
 * The "writer" stores the combined value like: "100%", "420px", "12.5rem".
 * When number/unit/slider change -> writer updates and emits 'input' (bubbles).
 * When writer is changed externally (apply-from-JSON, etc) -> UI updates.
 *
 * Markup expectations (minimal):
 *  <div class="wpbc_slider_len_group"
 *       data-wpbc_slider_len_bounds_map='{"%":{"min":30,"max":100,"step":1},"px":{"min":300,"max":2000,"step":10}}'
 *       data-wpbc_slider_len_default_unit="%">
 *    <input type="number" data-wpbc_slider_len_value>
 *    <select data-wpbc_slider_len_unit>...</select>
 *    <input type="range" data-wpbc_slider_len_range>
 *    <input type="text" data-wpbc_slider_len_writer style="display:none;">
 *  </div>
 *
 * Performance notes:
 * - MutationObserver is DISABLED by default (prevents performance issues).
 * - If your UI re-renders and inserts new groups dynamically, call:
 *     WPBC_Slider_Len_AutoInit();  OR instance.refresh();
 *   Or enable observer via: new WPBC_Slider_Len_Groups(root, { enable_observer:true }).init();
 *
 * Public API (instance methods):
 *  - init(), destroy(), refresh()
 *
 * @version 2026-01-25
 * @since   2026-01-25
 * @file    ../includes/__js/admin/slider_groups/wpbc_len_groups.js
 */
(function (w, d) {
	'use strict';

	// -------------------------------------------------------------------------------------------------
	// Helpers
	// -------------------------------------------------------------------------------------------------
	function clamp_num(v, min, max) {
		if (typeof min === 'number' && !isNaN(min)) v = Math.max(min, v);
		if (typeof max === 'number' && !isNaN(max)) v = Math.min(max, v);
		return v;
	}

	function parse_float(v) {
		var n = parseFloat(v);
		return isNaN(n) ? null : n;
	}

	function safe_json_parse(str) {
		try {
			return JSON.parse(str);
		} catch (e) {
			return null;
		}
	}

	function parse_len_combined(raw, default_unit) {
		var s = (raw == null) ? '' : String(raw).trim();
		if (!s) return { num: '', unit: default_unit || '%' };

		var m = s.match(/^\s*([\-]?\d+(?:\.\d+)?)\s*([a-z%]*)\s*$/i);
		if (!m) {
			// If it's not parseable, treat as number and keep default unit.
			return { num: s, unit: default_unit || '%' };
		}

		var num  = m[1] ? String(m[1]) : '';
		var unit = m[2] ? String(m[2]) : '';
		if (!unit) unit = default_unit || '%';

		return { num: num, unit: unit };
	}

	function build_combined(num, unit) {
		if (num == null || String(num).trim() === '') return '';
		return String(num) + String(unit || '');
	}

	function emit_input(el) {
		if (!el) return;
		el.dispatchEvent(new Event('input', { bubbles: true }));
	}

	// -------------------------------------------------------------------------------------------------
	// Controller
	// -------------------------------------------------------------------------------------------------
	class WPBC_Slider_Len_Groups {

		/**
		 * @param {HTMLElement|string} root_el Container (or selector). If omitted, uses document.
		 * @param {Object} [opts={}]
		 */
		constructor(root_el, opts) {
			this.root = root_el
				? ((typeof root_el === 'string') ? d.querySelector(root_el) : root_el)
				: d;

			this.opts = Object.assign({
				// Strict selectors (NO backward compatibility).
				group_selector  : '.wpbc_slider_len_group',
				value_selector  : '[data-wpbc_slider_len_value]',
				unit_selector   : '[data-wpbc_slider_len_unit]',
				range_selector  : '[data-wpbc_slider_len_range]',
				writer_selector : '[data-wpbc_slider_len_writer]',

				default_unit    : '%',

				fallback_bounds : {
					'px' : { min: 0,   max: 512,  step: 1   },
					'%'  : { min: 0,   max: 100,  step: 1   },
					'rem': { min: 0,   max: 10,   step: 0.1 },
					'em' : { min: 0,   max: 10,   step: 0.1 }
				},

				// Disabled by default for performance.
				enable_observer     : false,
				observer_debounce_ms: 150
			}, opts || {});

			this._on_input  = this._on_input.bind(this);
			this._on_change = this._on_change.bind(this);

			this._bounds_cache = new WeakMap(); // group -> bounds_map_object
			this._observer     = null;
			this._refresh_tmr  = null;
		}

		init() {
			if (!this.root) return this;

			this.root.addEventListener('input',  this._on_input,  true);
			this.root.addEventListener('change', this._on_change, true);

			if (this.opts.enable_observer && w.MutationObserver) {
				this._observer = new MutationObserver(() => { this._debounced_refresh(); });
				this._observer.observe(this.root === d ? d.documentElement : this.root, { childList: true, subtree: true });
			}

			this.refresh();
			return this;
		}

		destroy() {
			if (!this.root) return;

			this.root.removeEventListener('input',  this._on_input,  true);
			this.root.removeEventListener('change', this._on_change, true);

			if (this._observer) {
				this._observer.disconnect();
				this._observer = null;
			}

			if (this._refresh_tmr) {
				clearTimeout(this._refresh_tmr);
				this._refresh_tmr = null;
			}
		}

		refresh() {
			if (!this.root) return;

			var scope  = (this.root === d ? d : this.root);
			var groups = Array.prototype.slice.call(scope.querySelectorAll(this.opts.group_selector));

			for (var i = 0; i < groups.length; i++) {
				this._sync_group_from_writer(groups[i]);
				this._apply_bounds_for_current_unit(groups[i]);
			}
		}

		// -------------------------------------------------------------------------------------------------
		// Internal
		// -------------------------------------------------------------------------------------------------
		_debounced_refresh() {
			if (this._refresh_tmr) clearTimeout(this._refresh_tmr);
			this._refresh_tmr = setTimeout(() => {
				this._refresh_tmr = null;
				this.refresh();
			}, Number(this.opts.observer_debounce_ms) || 0);
		}

		_find_group(el) {
			return (el && el.closest) ? el.closest(this.opts.group_selector) : null;
		}

		_get_parts(group) {
			if (!group) return null;
			return {
				group : group,
				num   : group.querySelector(this.opts.value_selector),
				unit  : group.querySelector(this.opts.unit_selector),
				range : group.querySelector(this.opts.range_selector),
				writer: group.querySelector(this.opts.writer_selector)
			};
		}

		_get_default_unit(group) {
			var du = (group && group.getAttribute)
				? group.getAttribute('data-wpbc_slider_len_default_unit')
				: '';
			return du ? String(du) : this.opts.default_unit;
		}

		_get_bounds_map(group) {
			if (!group) return null;
			if (this._bounds_cache.has(group)) {
				return this._bounds_cache.get(group);
			}

			var raw = group.getAttribute('data-wpbc_slider_len_bounds_map');
			var map = raw ? safe_json_parse(raw) : null;
			if (!map || typeof map !== 'object') map = null;

			this._bounds_cache.set(group, map);
			return map;
		}

		_get_bounds_for_unit(group, unit) {
			var map = this._get_bounds_map(group);
			if (map && unit && map[unit]) {
				return map[unit];
			}
			return this.opts.fallback_bounds[unit] || this.opts.fallback_bounds['px'];
		}

		_apply_bounds(parts, bounds) {
			if (!parts || !bounds) return;

			var min  = (bounds.min  != null) ? Number(bounds.min)  : null;
			var max  = (bounds.max  != null) ? Number(bounds.max)  : null;
			var step = (bounds.step != null) ? Number(bounds.step) : null;

			if (parts.range) {
				if (!isNaN(min))  parts.range.min  = String(min);
				if (!isNaN(max))  parts.range.max  = String(max);
				if (!isNaN(step)) parts.range.step = String(step);
			}
			if (parts.num) {
				if (!isNaN(min))  parts.num.min  = String(min);
				if (!isNaN(max))  parts.num.max  = String(max);
				if (!isNaN(step)) parts.num.step = String(step);
			}
		}

		_apply_bounds_for_current_unit(group) {
			var parts = this._get_parts(group);
			if (!parts || !parts.unit) return;

			var unit = parts.unit.value || this._get_default_unit(group);
			var b    = this._get_bounds_for_unit(group, unit);

			this._apply_bounds(parts, b);

			// Clamp current value to new bounds.
			var v = parse_float(parts.num && parts.num.value ? parts.num.value : (parts.range ? parts.range.value : ''));
			if (v == null) return;

			var min = (b && b.min != null) ? Number(b.min) : null;
			var max = (b && b.max != null) ? Number(b.max) : null;
			v = clamp_num(v, isNaN(min) ? null : min, isNaN(max) ? null : max);

			if (parts.num)   parts.num.value   = String(v);
			if (parts.range) parts.range.value = String(v);

			this._write_combined(parts, String(v), unit, /*emit*/ false);
		}

		_write_combined(parts, num, unit, emit) {
			if (!parts) return;

			var combined = build_combined(num, unit);

			if (parts.writer) {
				// Avoid recursion: mark as internal write.
				parts.writer.__wpbc_slider_len_internal = true;
				parts.writer.value = combined;
				if (emit) emit_input(parts.writer);
				parts.writer.__wpbc_slider_len_internal = false;
			} else if (parts.num) {
				// If writer is missing, at least notify via number input.
				if (emit) emit_input(parts.num);
			}
		}

		_sync_group_from_writer(group) {
			var parts = this._get_parts(group);
			if (!parts || !parts.writer) return;

			var raw = String(parts.writer.value || '').trim();
			if (!raw) return;

			var du = this._get_default_unit(group);
			var p  = parse_len_combined(raw, du);

			if (parts.unit)  parts.unit.value  = p.unit;
			if (parts.num)   parts.num.value   = p.num;
			if (parts.range) parts.range.value = p.num;
		}

		_on_input(ev) {
			var t = ev.target;
			if (!t) return;

			var group = this._find_group(t);
			if (!group) return;

			var parts = this._get_parts(group);
			if (!parts) return;

			// Writer changed externally -> update UI.
			if (parts.writer && t === parts.writer) {
				if (t.__wpbc_slider_len_internal) return;
				this._sync_group_from_writer(group);
				this._apply_bounds_for_current_unit(group);
				return;
			}

			// Slider moved -> update number + writer.
			if (t.matches && t.matches(this.opts.range_selector)) {
				if (parts.num) parts.num.value = t.value;

				var unit = (parts.unit && parts.unit.value) ? parts.unit.value : this._get_default_unit(group);
				this._write_combined(parts, t.value, unit, /*emit*/ true);
				return;
			}

			// Number typed -> update slider + writer (clamp if slider has bounds).
			if (t.matches && t.matches(this.opts.value_selector)) {
				var v = parse_float(t.value);

				if (v != null && parts.range) {
					var rmin = Number(parts.range.min);
					var rmax = Number(parts.range.max);
					v = clamp_num(v, isNaN(rmin) ? null : rmin, isNaN(rmax) ? null : rmax);

					parts.range.value = String(v);
					if (String(v) !== t.value) t.value = String(v);
				}

				var unit2 = (parts.unit && parts.unit.value) ? parts.unit.value : this._get_default_unit(group);
				this._write_combined(parts, t.value, unit2, /*emit*/ true);
			}
		}

		_on_change(ev) {
			var t = ev.target;
			if (!t) return;

			var group = this._find_group(t);
			if (!group) return;

			var parts = this._get_parts(group);
			if (!parts) return;

			// Unit changed -> update bounds + writer.
			if (t.matches && t.matches(this.opts.unit_selector)) {
				this._apply_bounds_for_current_unit(group);

				var num  = parts.num ? parts.num.value : (parts.range ? parts.range.value : '');
				var unit = t.value || this._get_default_unit(group);
				this._write_combined(parts, num, unit, /*emit*/ true);
			}
		}
	}

	// -------------------------------------------------------------------------------------------------
	// Auto-init
	// -------------------------------------------------------------------------------------------------
	function wpbc_slider_len_groups__auto_init() {
		var ROOT  = '.wpbc_slider_len_groups';
		var nodes = Array.prototype.slice.call(d.querySelectorAll(ROOT))
			.filter(function (n) { return !n.parentElement || !n.parentElement.closest(ROOT); });

		// If no explicit containers, install a single document-root instance.
		if (!nodes.length) {
			if (!d.__wpbc_slider_len_groups_global_instance) {
				d.__wpbc_slider_len_groups_global_instance = new WPBC_Slider_Len_Groups(d).init();
			}
			return;
		}

		nodes.forEach(function (node) {
			if (node.__wpbc_slider_len_groups_instance) return;
			node.__wpbc_slider_len_groups_instance = new WPBC_Slider_Len_Groups(node).init();
		});
	}

	// Export globals (manual control if needed).
	w.WPBC_Slider_Len_Groups   = WPBC_Slider_Len_Groups;
	w.WPBC_Slider_Len_AutoInit = wpbc_slider_len_groups__auto_init;

	// DOM-ready auto init.
	if (d.readyState === 'loading') {
		d.addEventListener('DOMContentLoaded', wpbc_slider_len_groups__auto_init, { once: true });
	} else {
		wpbc_slider_len_groups__auto_init();
	}

})(window, document);

/* globals window, document */
/**
 * WPBC Slider Range Groups
 *
 * Universal, dependency-free controller that keeps a "range + number" pair in sync:
 *  - number input  (data-wpbc_slider_range_value)
 *  - range slider  (data-wpbc_slider_range_range)
 *  - writer input  (data-wpbc_slider_range_writer) [optional]
 *
 * If writer exists: number/slider update writer and emit 'input' on writer (bubbles).
 * If writer is missing: emits 'input' on the number input.
 * If writer changes externally: updates number/slider.
 *
 * Markup expectations (minimal):
 *  <div class="wpbc_slider_range_group">
 *    <input type="number" data-wpbc_slider_range_value>
 *    <input type="range"  data-wpbc_slider_range_range>
 *    <!-- optional -->
 *    <input type="text" data-wpbc_slider_range_writer style="display:none;">
 *  </div>
 *
 * Performance notes:
 * - MutationObserver is DISABLED by default.
 * - If your UI re-renders and inserts new groups dynamically, call:
 *     WPBC_Slider_Range_AutoInit(); OR instance.refresh();
 *   Or enable observer via: new WPBC_Slider_Range_Groups(root, { enable_observer:true }).init();
 *
 * Public API (instance methods):
 *  - init(), destroy(), refresh()
 *
 * @version 2026-01-25
 * @since   2026-01-25
 * @file    ../includes/__js/admin/slider_groups/wpbc_range_groups.js
 */
(function (w, d) {
	'use strict';

	// -------------------------------------------------------------------------------------------------
	// Helpers
	// -------------------------------------------------------------------------------------------------
	function clamp_num(v, min, max) {
		if (typeof min === 'number' && !isNaN(min)) v = Math.max(min, v);
		if (typeof max === 'number' && !isNaN(max)) v = Math.min(max, v);
		return v;
	}

	function parse_float(v) {
		var n = parseFloat(v);
		return isNaN(n) ? null : n;
	}

	function emit_input(el) {
		if (!el) return;
		el.dispatchEvent(new Event('input', { bubbles: true }));
	}

	// -------------------------------------------------------------------------------------------------
	// Controller
	// -------------------------------------------------------------------------------------------------
	class WPBC_Slider_Range_Groups {

		/**
		 * @param {HTMLElement|string} root_el Container (or selector). If omitted, uses document.
		 * @param {Object} [opts={}]
		 */
		constructor(root_el, opts) {
			this.root = root_el
				? ((typeof root_el === 'string') ? d.querySelector(root_el) : root_el)
				: d;

			this.opts = Object.assign({
				// Strict selectors (NO backward compatibility).
				group_selector  : '.wpbc_slider_range_group',
				value_selector  : '[data-wpbc_slider_range_value]',
				range_selector  : '[data-wpbc_slider_range_range]',
				writer_selector : '[data-wpbc_slider_range_writer]',

				// Disabled by default for performance.
				enable_observer     : false,
				observer_debounce_ms: 150
			}, opts || {});

			this._on_input  = this._on_input.bind(this);
			this._on_change = this._on_change.bind(this);

			this._observer    = null;
			this._refresh_tmr = null;
		}

		init() {
			if (!this.root) return this;

			this.root.addEventListener('input',  this._on_input,  true);
			this.root.addEventListener('change', this._on_change, true);

			if (this.opts.enable_observer && w.MutationObserver) {
				this._observer = new MutationObserver(() => { this._debounced_refresh(); });
				this._observer.observe(this.root === d ? d.documentElement : this.root, { childList: true, subtree: true });
			}

			this.refresh();
			return this;
		}

		destroy() {
			if (!this.root) return;

			this.root.removeEventListener('input',  this._on_input,  true);
			this.root.removeEventListener('change', this._on_change, true);

			if (this._observer) {
				this._observer.disconnect();
				this._observer = null;
			}

			if (this._refresh_tmr) {
				clearTimeout(this._refresh_tmr);
				this._refresh_tmr = null;
			}
		}

		refresh() {
			if (!this.root) return;

			var scope  = (this.root === d ? d : this.root);
			var groups = Array.prototype.slice.call(scope.querySelectorAll(this.opts.group_selector));

			for (var i = 0; i < groups.length; i++) {
				this._sync_from_writer(groups[i]);
				this._clamp_to_range(groups[i]);
			}
		}

		// -------------------------------------------------------------------------------------------------
		// Internal
		// -------------------------------------------------------------------------------------------------
		_debounced_refresh() {
			if (this._refresh_tmr) clearTimeout(this._refresh_tmr);
			this._refresh_tmr = setTimeout(() => {
				this._refresh_tmr = null;
				this.refresh();
			}, Number(this.opts.observer_debounce_ms) || 0);
		}

		_find_group(el) {
			return (el && el.closest) ? el.closest(this.opts.group_selector) : null;
		}

		_get_parts(group) {
			if (!group) return null;
			return {
				group : group,
				num   : group.querySelector(this.opts.value_selector),
				range : group.querySelector(this.opts.range_selector),
				writer: group.querySelector(this.opts.writer_selector)
			};
		}

		_write(parts, value, emit) {
			if (!parts) return;

			if (parts.writer) {
				parts.writer.__wpbc_slider_range_internal = true;
				parts.writer.value = String(value);
				if (emit) emit_input(parts.writer);
				parts.writer.__wpbc_slider_range_internal = false;
			} else if (parts.num) {
				// If writer is missing, at least notify via number input.
				if (emit) emit_input(parts.num);
			}
		}

		_sync_from_writer(group) {
			var parts = this._get_parts(group);
			if (!parts || !parts.writer) return;

			var raw = String(parts.writer.value || '').trim();
			if (!raw) return;

			if (parts.num)   parts.num.value   = raw;
			if (parts.range) parts.range.value = raw;
		}

		_clamp_to_range(group) {
			var parts = this._get_parts(group);
			if (!parts || !parts.range || !parts.num) return;

			var v = parse_float(parts.num.value);
			if (v == null) return;

			var min = Number(parts.range.min);
			var max = Number(parts.range.max);
			var vv  = clamp_num(v, isNaN(min) ? null : min, isNaN(max) ? null : max);

			if (String(vv) !== parts.num.value) parts.num.value = String(vv);
			parts.range.value = String(vv);
		}

		_on_input(ev) {
			var t = ev.target;
			if (!t) return;

			var group = this._find_group(t);
			if (!group) return;

			var parts = this._get_parts(group);
			if (!parts) return;

			// Writer changed externally -> update UI.
			if (parts.writer && t === parts.writer) {
				if (t.__wpbc_slider_range_internal) return;
				this._sync_from_writer(group);
				this._clamp_to_range(group);
				return;
			}

			// Range moved -> update number + writer.
			if (t.matches && t.matches(this.opts.range_selector)) {
				if (parts.num) parts.num.value = t.value;
				this._write(parts, t.value, /*emit*/ true);
				return;
			}

			// Number typed -> update range + writer (clamp by slider bounds).
			if (t.matches && t.matches(this.opts.value_selector)) {
				if (parts.range) {
					var v = parse_float(t.value);
					if (v != null) {
						var min = Number(parts.range.min);
						var max = Number(parts.range.max);
						v = clamp_num(v, isNaN(min) ? null : min, isNaN(max) ? null : max);

						parts.range.value = String(v);
						if (String(v) !== t.value) t.value = String(v);
					}
				}
				this._write(parts, t.value, /*emit*/ true);
			}
		}

		_on_change(ev) {
			// No special "change" handling needed currently; kept for symmetry/future.
		}
	}

	// -------------------------------------------------------------------------------------------------
	// Auto-init
	// -------------------------------------------------------------------------------------------------
	function wpbc_slider_range_groups__auto_init() {
		var ROOT  = '.wpbc_slider_range_groups';
		var nodes = Array.prototype.slice.call(d.querySelectorAll(ROOT))
			.filter(function (n) { return !n.parentElement || !n.parentElement.closest(ROOT); });

		if (!nodes.length) {
			if (!d.__wpbc_slider_range_groups_global_instance) {
				d.__wpbc_slider_range_groups_global_instance = new WPBC_Slider_Range_Groups(d).init();
			}
			return;
		}

		nodes.forEach(function (node) {
			if (node.__wpbc_slider_range_groups_instance) return;
			node.__wpbc_slider_range_groups_instance = new WPBC_Slider_Range_Groups(node).init();
		});
	}

	// Export globals.
	w.WPBC_Slider_Range_Groups   = WPBC_Slider_Range_Groups;
	w.WPBC_Slider_Range_AutoInit = wpbc_slider_range_groups__auto_init;

	if (d.readyState === 'loading') {
		d.addEventListener('DOMContentLoaded', wpbc_slider_range_groups__auto_init, { once: true });
	} else {
		wpbc_slider_range_groups__auto_init();
	}

})(window, document);

/**
 * Booking Calendar — Generic UI Tabs Utility (JS)
 *
 * Purpose: Lightweight, dependency-free tabs controller for any small tab group in admin UIs.
 * - Auto-initializes groups marked with data-wpbc-tabs.
 * - Assigns ARIA roles and toggles aria-selected/aria-hidden/tabindex.
 * - Supports keyboard navigation (Left/Right/Home/End).
 * - Public API: window.wpbc_ui_tabs.{init_on, init_group, set_active}
 * - Emits 'wpbc:tabs:change' on the group root when the active tab changes.
 *
 * Markup contract:
 * - Root:   [data-wpbc-tabs]
 * - Tabs:   [data-wpbc-tab-key="K"]
 * - Panels: [data-wpbc-tab-panel="K"]
 *
 * @package   Booking Calendar
 * @subpackage Admin\UI
 * @since     11.0.0
 * @version   1.0.0
 * @see       /includes/__js/admin/ui_tabs/ui_tabs.js
 *
 *
 * How it works:
 * - Root node must have [data-wpbc-tabs] attribute (any value).
 * - Tab buttons must carry [data-wpbc-tab-key="..."] (unique per group).
 * - Panels must carry [data-wpbc-tab-panel="..."] with matching keys.
 * - Adds WAI-ARIA roles and aria-selected/hidden wiring.
 *
 * <div data-wpbc-tabs="column-styles" data-wpbc-tab-active="1"    class="wpbc_ui_tabs_root" >
 *    <!-- Top Tabs -->
 *    <div data-wpbc-tablist="" role="tablist"                    class=" wpbc_ui_el__horis_top_bar__wrapper" >
 *        <div class="wpbc_ui_el__horis_top_bar__content">
 *            <h2 class="wpbc_ui_el__horis_nav_label">Column:</h2>
 *
 *            <div class="wpbc_ui_el__horis_nav_item wpbc_ui_el__horis_nav_item__1">
 *                <a
 *                    data-wpbc-tab-key="1"
 *                    aria-selected="true" role="tab" tabindex="0" aria-controls="wpbc_tab_panel_col_1"
 *
 *                        href="javascript:void(0);"
 *                        class="wpbc_ui_el__horis_nav_item__a wpbc_ui_el__horis_nav_item__single"
 *                        id="wpbc_tab_col_1"
 *                        title="Column 1"
 *                ><span class="wpbc_ui_el__horis_nav_title">Title 1</span></a>
 *            </div>
 *            ...
 *        </div>
 *    </div>
 *    <!-- Tabs Content -->
 *    <div class="wpbc_tab__panel group__fields" data-wpbc-tab-panel="1" id="wpbc_tab_panel_col_1" role="tabpanel" aria-labelledby="wpbc_tab_col_1">
 *        ...
 *    </div>
 *    ...
 * </div>
 *
 * Public API:
 *   - wpbc_ui_tabs.init_on(root_or_selector)   // find and init groups within a container
 *   - wpbc_ui_tabs.init_group(root_el)         // init a single group root
 *   - wpbc_ui_tabs.set_active(root_el, key)    // programmatically change active tab
 *
 * Events:
 *   - Dispatches CustomEvent 'wpbc:tabs:change' on root when tab changes:
 *       detail: { active_key: '2', prev_key: '1' }
 *
 * Switch a local (generic) tabs group to tab 3:     var group = document.querySelector('[data-wpbc-tabs="column-styles"]'); if ( group ) { wpbc_ui_tabs.set_active(group, '3'); }
 */
(function ( w ) {
	'use strict';

	if ( w.wpbc_ui_tabs ) {
		return;
	}

	/**
	 * Internal: toggle active state.
	 *
	 * @param {HTMLElement} root_el
	 * @param {string}      key
	 * @param {boolean}     should_emit
	 */
	function set_active_internal( root_el, key, should_emit ) {
		var tab_btns = root_el.querySelectorAll( '[data-wpbc-tab-key]' );
		var panels   = root_el.querySelectorAll( '[data-wpbc-tab-panel]' );

		var prev_key = root_el.getAttribute( 'data-wpbc-tab-active' ) || null;
		if ( String( prev_key ) === String( key ) ) {
			return;
		}

		// Buttons: aria + class
		for ( var i = 0; i < tab_btns.length; i++ ) {
			var btn   = tab_btns[i];
			var b_key = btn.getAttribute( 'data-wpbc-tab-key' );
			var is_on = String( b_key ) === String( key );

			btn.setAttribute( 'role', 'tab' );
			btn.setAttribute( 'aria-selected', is_on ? 'true' : 'false' );
			btn.setAttribute( 'tabindex', is_on ? '0' : '-1' );

			if ( is_on ) {
				btn.classList.add( 'active' );
			} else {
				btn.classList.remove( 'active' );
			}
		}

		// Panels: aria + visibility
		for ( var j = 0; j < panels.length; j++ ) {
			var pn   = panels[j];
			var pkey = pn.getAttribute( 'data-wpbc-tab-panel' );
			var show = String( pkey ) === String( key );

			pn.setAttribute( 'role', 'tabpanel' );
			pn.setAttribute( 'aria-hidden', show ? 'false' : 'true' );
			if ( show ) {
				pn.removeAttribute( 'hidden' );
			} else {
				pn.setAttribute( 'hidden', '' );
			}
		}

		root_el.setAttribute( 'data-wpbc-tab-active', String( key ) );

		if ( should_emit ) {
			try {
				var ev = new w.CustomEvent( 'wpbc:tabs:change', {
					bubbles : true,
					detail  : { active_key : String( key ), prev_key : prev_key }
				} );
				root_el.dispatchEvent( ev );
			} catch ( _e ) {}
		}
	}

	/**
	 * Internal: get ordered keys from buttons.
	 *
	 * @param {HTMLElement} root_el
	 * @returns {string[]}
	 */
	function get_keys( root_el ) {
		var list = [];
		var btns = root_el.querySelectorAll( '[data-wpbc-tab-key]' );
		for ( var i = 0; i < btns.length; i++ ) {
			var k = btns[i].getAttribute( 'data-wpbc-tab-key' );
			if ( k != null && k !== '' ) {
				list.push( String( k ) );
			}
		}
		return list;
	}

	/**
	 * Internal: move focus between tabs using keyboard.
	 *
	 * @param {HTMLElement} root_el
	 * @param {number}      dir  +1 (next) / -1 (prev)
	 */
	function focus_relative( root_el, dir ) {
		var keys    = get_keys( root_el );
		var current = root_el.getAttribute( 'data-wpbc-tab-active' ) || keys[0] || null;
		var idx     = Math.max( 0, keys.indexOf( String( current ) ) );
		var next    = keys[ ( idx + ( dir > 0 ? 1 : keys.length - 1 ) ) % keys.length ];

		var next_btn = root_el.querySelector( '[data-wpbc-tab-key="' + next + '"]' );
		if ( next_btn ) {
			next_btn.focus();
			set_active_internal( root_el, next, true );
		}
	}

	/**
	 * Initialize a single tabs group root.
	 *
	 * @param {HTMLElement} root_el
	 */
	function init_group( root_el ) {
		if ( ! root_el || root_el.__wpbc_tabs_inited ) {
			return;
		}
		root_el.__wpbc_tabs_inited = true;

		// Roles
		var tablist = root_el.querySelector( '[data-wpbc-tablist]' ) || root_el;
		tablist.setAttribute( 'role', 'tablist' );

		// Default active: from attribute or first button
		var keys = get_keys( root_el );
		var def  = root_el.getAttribute( 'data-wpbc-tab-active' ) || ( keys[0] || '1' );
		set_active_internal( root_el, def, false );

		// Clicks
		root_el.addEventListener( 'click', function ( e ) {
			var btn = e.target.closest ? e.target.closest( '[data-wpbc-tab-key]' ) : null;
			if ( ! btn || ! root_el.contains( btn ) ) {
				return;
			}
			e.preventDefault();
			var key = btn.getAttribute( 'data-wpbc-tab-key' );
			if ( key != null ) {
				set_active_internal( root_el, key, true );
			}
		}, true );

		// Keyboard (Left/Right/Home/End)
		root_el.addEventListener( 'keydown', function ( e ) {
			var tgt = e.target;
			if ( ! tgt || ! tgt.hasAttribute || ! tgt.hasAttribute( 'data-wpbc-tab-key' ) ) {
				return;
			}
			switch ( e.key ) {
			case 'ArrowLeft':
				e.preventDefault(); focus_relative( root_el, -1 ); break;
			case 'ArrowRight':
				e.preventDefault(); focus_relative( root_el, +1 ); break;
			case 'Home':
				e.preventDefault(); set_active_internal( root_el, ( get_keys( root_el )[0] || '1' ), true ); break;
			case 'End':
				e.preventDefault(); var ks = get_keys( root_el ); set_active_internal( root_el, ( ks[ ks.length - 1 ] || '1' ), true ); break;
			}
		}, true );
	}

	/**
	 * Initialize all groups within a container (or document).
	 *
	 * @param {HTMLElement|string|null} container
	 */
	function init_on( container ) {
		var ctx = container ? ( typeof container === 'string' ? document.querySelector( container ) : container ) : document;
		if ( ! ctx ) {
			return;
		}
		var groups = ctx.querySelectorAll( '[data-wpbc-tabs]' );
		for ( var i = 0; i < groups.length; i++ ) {
			init_group( groups[i] );
		}
	}

	/**
	 * Programmatically set active tab by key.
	 *
	 * @param {HTMLElement} root_el
	 * @param {string|number} key
	 */
	function set_active( root_el, key ) {
		if ( root_el && root_el.hasAttribute && root_el.hasAttribute( 'data-wpbc-tabs' ) ) {
			set_active_internal( root_el, String( key ), true );
		}
	}

	// Public API (snake_case)
	w.wpbc_ui_tabs = {
		init_on    : init_on,
		init_group : init_group,
		set_active : set_active
	};

	// Auto-init on DOM ready
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', function () { init_on( document ); } );
	} else {
		init_on( document );
	}

})( window );

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVpX2VsZW1lbnRzLmpzIiwidWlfbG9hZGluZ19zcGluLmpzIiwidWlfcmFkaW9fY29udGFpbmVyLmpzIiwidWlfZnVsbF9zY3JlZW5fbW9kZS5qcyIsImdtYWlsX2NoZWNrYm94X3NlbGVjdGlvbi5qcyIsImJvb2tpbmdzX2NoZWNrYm94X3NlbGVjdGlvbi5qcyIsInVpX3NpZGViYXJfbGVmdF9fYWN0aW9ucy5qcyIsImNvcHlfdGV4dF90b19jbGlwYnJkLmpzIiwiY29sbGFwc2libGVfZ3JvdXBzLmpzIiwid3BiY19sZW5fZ3JvdXBzLmpzIiwid3BiY19yYW5nZV9ncm91cHMuanMiLCJ1aV90YWJzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNqSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNqSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3BEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN2ZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNySEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2xnQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3RaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDclJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJ3cGJjX2FsbF9hZG1pbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIlxyXG4vKipcclxuICogQmxpbmsgc3BlY2lmaWMgSFRNTCBlbGVtZW50IHRvIHNldCBhdHRlbnRpb24gdG8gdGhpcyBlbGVtZW50LlxyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gZWxlbWVudF90b19ibGlua1x0XHQgIC0gY2xhc3Mgb3IgaWQgb2YgZWxlbWVudDogJy53cGJjX3dpZGdldF9hdmFpbGFibGVfdW5hdmFpbGFibGUnXHJcbiAqIEBwYXJhbSB7aW50fSBob3dfbWFueV90aW1lc1x0XHRcdCAgLSA0XHJcbiAqIEBwYXJhbSB7aW50fSBob3dfbG9uZ190b19ibGlua1x0XHQgIC0gMzUwXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2JsaW5rX2VsZW1lbnQoIGVsZW1lbnRfdG9fYmxpbmssIGhvd19tYW55X3RpbWVzID0gNCwgaG93X2xvbmdfdG9fYmxpbmsgPSAzNTAgKXtcclxuXHJcblx0Zm9yICggbGV0IGkgPSAwOyBpIDwgaG93X21hbnlfdGltZXM7IGkrKyApe1xyXG5cdFx0alF1ZXJ5KCBlbGVtZW50X3RvX2JsaW5rICkuZmFkZU91dCggaG93X2xvbmdfdG9fYmxpbmsgKS5mYWRlSW4oIGhvd19sb25nX3RvX2JsaW5rICk7XHJcblx0fVxyXG4gICAgalF1ZXJ5KCBlbGVtZW50X3RvX2JsaW5rICkuYW5pbWF0ZSgge29wYWNpdHk6IDF9LCA1MDAgKTtcclxufVxyXG4iLCIvKipcclxuICogICBTdXBwb3J0IEZ1bmN0aW9ucyAtIFNwaW4gSWNvbiBpbiBCdXR0b25zICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBSZW1vdmUgc3BpbiBpY29uIGZyb20gIGJ1dHRvbiBhbmQgRW5hYmxlIHRoaXMgYnV0dG9uLlxyXG4gKlxyXG4gKiBAcGFyYW0gYnV0dG9uX2NsaWNrZWRfZWxlbWVudF9pZFx0XHQtIEhUTUwgSUQgYXR0cmlidXRlIG9mIHRoaXMgYnV0dG9uXHJcbiAqIEByZXR1cm4gc3RyaW5nXHRcdFx0XHRcdFx0LSBDU1MgY2xhc3NlcyB0aGF0IHdhcyBwcmV2aW91c2x5IGluIGJ1dHRvbiBpY29uXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2J1dHRvbl9fcmVtb3ZlX3NwaW4oYnV0dG9uX2NsaWNrZWRfZWxlbWVudF9pZCkge1xyXG5cclxuXHR2YXIgcHJldmlvc19jbGFzc2VzID0gJyc7XHJcblx0aWYgKFxyXG5cdFx0KHVuZGVmaW5lZCAhPSBidXR0b25fY2xpY2tlZF9lbGVtZW50X2lkKVxyXG5cdFx0JiYgKCcnICE9IGJ1dHRvbl9jbGlja2VkX2VsZW1lbnRfaWQpXHJcblx0KSB7XHJcblx0XHR2YXIgakVsZW1lbnQgPSBqUXVlcnkoICcjJyArIGJ1dHRvbl9jbGlja2VkX2VsZW1lbnRfaWQgKTtcclxuXHRcdGlmICggakVsZW1lbnQubGVuZ3RoICkge1xyXG5cdFx0XHRwcmV2aW9zX2NsYXNzZXMgPSB3cGJjX2J1dHRvbl9kaXNhYmxlX2xvYWRpbmdfaWNvbiggakVsZW1lbnQuZ2V0KCAwICkgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiBwcmV2aW9zX2NsYXNzZXM7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogU2hvdyBMb2FkaW5nIChyb3RhdGluZyBhcnJvdykgaWNvbiBmb3IgYnV0dG9uIHRoYXQgaGFzIGJlZW4gY2xpY2tlZFxyXG4gKlxyXG4gKiBAcGFyYW0gdGhpc19idXR0b25cdFx0LSB0aGlzIG9iamVjdCBvZiBzcGVjaWZpYyBidXR0b25cclxuICogQHJldHVybiBzdHJpbmdcdFx0XHQtIENTUyBjbGFzc2VzIHRoYXQgd2FzIHByZXZpb3VzbHkgaW4gYnV0dG9uIGljb25cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24odGhpc19idXR0b24pIHtcclxuXHJcblx0dmFyIGpCdXR0b24gICAgICAgICA9IGpRdWVyeSggdGhpc19idXR0b24gKTtcclxuXHR2YXIgakljb24gICAgICAgICAgID0gakJ1dHRvbi5maW5kKCAnaScgKTtcclxuXHR2YXIgcHJldmlvc19jbGFzc2VzID0gakljb24uYXR0ciggJ2NsYXNzJyApO1xyXG5cclxuXHRqSWNvbi5yZW1vdmVDbGFzcygpLmFkZENsYXNzKCAnbWVudV9pY29uIGljb24tMXggd3BiY19pY25fcm90YXRlX3JpZ2h0IHdwYmNfc3BpbicgKTtcdC8vIFNldCBSb3RhdGUgaWNvbi5cclxuXHQvLyBqSWNvbi5hZGRDbGFzcyggJ3dwYmNfYW5pbWF0aW9uX3BhdXNlJyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFBhdXNlIGFuaW1hdGlvbi5cclxuXHQvLyBqSWNvbi5hZGRDbGFzcyggJ3dwYmNfdWlfcmVkJyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBTZXQgaWNvbiBjb2xvciByZWQuXHJcblxyXG5cdGpJY29uLmF0dHIoICd3cGJjX3ByZXZpb3VzX2NsYXNzJywgcHJldmlvc19jbGFzc2VzIClcclxuXHJcblx0akJ1dHRvbi5hZGRDbGFzcyggJ2Rpc2FibGVkJyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIERpc2FibGUgYnV0dG9uXHJcblx0Ly8gV2UgbmVlZCB0byAgc2V0ICBoZXJlIGF0dHIgaW5zdGVhZCBvZiBwcm9wLCBiZWNhdXNlIGZvciBBIGVsZW1lbnRzLCAgYXR0cmlidXRlICdkaXNhYmxlZCcgZG8gIG5vdCBhZGRlZCB3aXRoIGpCdXR0b24ucHJvcCggXCJkaXNhYmxlZFwiLCB0cnVlICk7LlxyXG5cclxuXHRqQnV0dG9uLmF0dHIoICd3cGJjX3ByZXZpb3VzX29uY2xpY2snLCBqQnV0dG9uLmF0dHIoICdvbmNsaWNrJyApICk7XHRcdC8vIFNhdmUgdGhpcyB2YWx1ZS5cclxuXHRqQnV0dG9uLmF0dHIoICdvbmNsaWNrJywgJycgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRGlzYWJsZSBhY3Rpb25zIFwib24gY2xpY2tcIi5cclxuXHJcblx0cmV0dXJuIHByZXZpb3NfY2xhc3NlcztcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBIaWRlIExvYWRpbmcgKHJvdGF0aW5nIGFycm93KSBpY29uIGZvciBidXR0b24gdGhhdCB3YXMgY2xpY2tlZCBhbmQgc2hvdyBwcmV2aW91cyBpY29uIGFuZCBlbmFibGUgYnV0dG9uXHJcbiAqXHJcbiAqIEBwYXJhbSB0aGlzX2J1dHRvblx0XHQtIHRoaXMgb2JqZWN0IG9mIHNwZWNpZmljIGJ1dHRvblxyXG4gKiBAcmV0dXJuIHN0cmluZ1x0XHRcdC0gQ1NTIGNsYXNzZXMgdGhhdCB3YXMgcHJldmlvdXNseSBpbiBidXR0b24gaWNvblxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19idXR0b25fZGlzYWJsZV9sb2FkaW5nX2ljb24odGhpc19idXR0b24pIHtcclxuXHJcblx0dmFyIGpCdXR0b24gPSBqUXVlcnkoIHRoaXNfYnV0dG9uICk7XHJcblx0dmFyIGpJY29uICAgPSBqQnV0dG9uLmZpbmQoICdpJyApO1xyXG5cclxuXHR2YXIgcHJldmlvc19jbGFzc2VzID0gakljb24uYXR0ciggJ3dwYmNfcHJldmlvdXNfY2xhc3MnICk7XHJcblx0aWYgKFxyXG5cdFx0KHVuZGVmaW5lZCAhPSBwcmV2aW9zX2NsYXNzZXMpXHJcblx0XHQmJiAoJycgIT0gcHJldmlvc19jbGFzc2VzKVxyXG5cdCkge1xyXG5cdFx0akljb24ucmVtb3ZlQ2xhc3MoKS5hZGRDbGFzcyggcHJldmlvc19jbGFzc2VzICk7XHJcblx0fVxyXG5cclxuXHRqQnV0dG9uLnJlbW92ZUNsYXNzKCAnZGlzYWJsZWQnICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gUmVtb3ZlIERpc2FibGUgYnV0dG9uLlxyXG5cclxuXHR2YXIgcHJldmlvdXNfb25jbGljayA9IGpCdXR0b24uYXR0ciggJ3dwYmNfcHJldmlvdXNfb25jbGljaycgKVxyXG5cdGlmIChcclxuXHRcdCh1bmRlZmluZWQgIT0gcHJldmlvdXNfb25jbGljaylcclxuXHRcdCYmICgnJyAhPSBwcmV2aW91c19vbmNsaWNrKVxyXG5cdCkge1xyXG5cdFx0akJ1dHRvbi5hdHRyKCAnb25jbGljaycsIHByZXZpb3VzX29uY2xpY2sgKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiBwcmV2aW9zX2NsYXNzZXM7XHJcbn1cclxuIiwiLyoqXHJcbiAqIE9uIHNlbGVjdGlvbiAgb2YgcmFkaW8gYnV0dG9uLCBhZGp1c3QgYXR0cmlidXRlcyBvZiByYWRpbyBjb250YWluZXJcclxuICpcclxuICogQHBhcmFtIF90aGlzXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3VpX2VsX19yYWRpb19jb250YWluZXJfc2VsZWN0aW9uKF90aGlzKSB7XHJcblxyXG5cdGlmICggalF1ZXJ5KCBfdGhpcyApLmlzKCAnOmNoZWNrZWQnICkgKSB7XHJcblx0XHRqUXVlcnkoIF90aGlzICkucGFyZW50cyggJy53cGJjX3VpX3JhZGlvX3NlY3Rpb24nICkuZmluZCggJy53cGJjX3VpX3JhZGlvX2NvbnRhaW5lcicgKS5yZW1vdmVBdHRyKCAnZGF0YS1zZWxlY3RlZCcgKTtcclxuXHRcdGpRdWVyeSggX3RoaXMgKS5wYXJlbnRzKCAnLndwYmNfdWlfcmFkaW9fY29udGFpbmVyOm5vdCguZGlzYWJsZWQpJyApLmF0dHIoICdkYXRhLXNlbGVjdGVkJywgdHJ1ZSApO1xyXG5cdH1cclxuXHJcblx0aWYgKCBqUXVlcnkoIF90aGlzICkuaXMoICc6ZGlzYWJsZWQnICkgKSB7XHJcblx0XHRqUXVlcnkoIF90aGlzICkucGFyZW50cyggJy53cGJjX3VpX3JhZGlvX2NvbnRhaW5lcicgKS5hZGRDbGFzcyggJ2Rpc2FibGVkJyApO1xyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIE9uIGNsaWNrIG9uIFJhZGlvIENvbnRhaW5lciwgd2Ugd2lsbCAgc2VsZWN0ICB0aGUgIHJhZGlvIGJ1dHRvbiAgICBhbmQgdGhlbiBhZGp1c3QgYXR0cmlidXRlcyBvZiByYWRpbyBjb250YWluZXJcclxuICpcclxuICogQHBhcmFtIF90aGlzXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3VpX2VsX19yYWRpb19jb250YWluZXJfY2xpY2soX3RoaXMpIHtcclxuXHJcblx0aWYgKCBqUXVlcnkoIF90aGlzICkuaGFzQ2xhc3MoICdkaXNhYmxlZCcgKSApIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdHZhciBqX3JhZGlvID0galF1ZXJ5KCBfdGhpcyApLmZpbmQoICdpbnB1dFt0eXBlPXJhZGlvXTpub3QoLndwYmMtZm9ybS1yYWRpby1pbnRlcm5hbCknICk7XHJcblx0aWYgKCBqX3JhZGlvLmxlbmd0aCApIHtcclxuXHRcdGpfcmFkaW8ucHJvcCggJ2NoZWNrZWQnLCB0cnVlICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHR9XHJcblxyXG59IiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyA9PSBGdWxsIFNjcmVlbiAgLSAgc3VwcG9ydCBmdW5jdGlvbnMgICA9PVxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbi8qKlxuICogUmV0dXJuIGV2ZXJ5IGNvb2tpZSBwYXRoIHRoYXQgY2FuIGFwcGx5IHRvIHRoZSBjdXJyZW50IFdvcmRQcmVzcyBhZG1pbiBVUkwuXG4gKlxuICogV29yZFByZXNzIG1heSBydW4gZnJvbSBhIHN1YmRpcmVjdG9yeS4gVXBkYXRpbmcgdGhlIHJvb3QsIHNpdGUsIGFuZCBhZG1pblxuICogcGF0aHMgcHJldmVudHMgYW4gb2xkZXIsIG1vcmUtc3BlY2lmaWMgY29va2llIGZyb20gb3ZlcnJpZGluZyB0aGUgbmV3IG1vZGUuXG4gKlxuICogQHJldHVybiB7c3RyaW5nW119IFVuaXF1ZSBhYnNvbHV0ZSBjb29raWUgcGF0aHMuXG4gKi9cbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX2Z1bGxfc2NyZWVuX19nZXRfY29va2llX3BhdGhzKCkge1xuXHR2YXIgY29va2llX3BhdGhzID0gWyAnLycgXTtcblx0dmFyIGFkbWluX21hcmtlciA9ICcvd3AtYWRtaW4vJztcblx0dmFyIGN1cnJlbnRfcGF0aCA9IHdpbmRvdy5sb2NhdGlvbiAmJiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgPyB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgOiAnJztcblx0dmFyIGFkbWluX2luZGV4ICA9IGN1cnJlbnRfcGF0aC5pbmRleE9mKCBhZG1pbl9tYXJrZXIgKTtcblxuXHRpZiAoIGFkbWluX2luZGV4ID49IDAgKSB7XG5cdFx0Y29va2llX3BhdGhzLnB1c2goIGN1cnJlbnRfcGF0aC5zdWJzdHJpbmcoIDAsIGFkbWluX2luZGV4ICsgMSApICk7XG5cdFx0Y29va2llX3BhdGhzLnB1c2goIGN1cnJlbnRfcGF0aC5zdWJzdHJpbmcoIDAsIGFkbWluX2luZGV4ICsgYWRtaW5fbWFya2VyLmxlbmd0aCApICk7XG5cdH1cblxuXHRyZXR1cm4gY29va2llX3BhdGhzLmZpbHRlciggZnVuY3Rpb24gKCBwYXRoLCBpbmRleCApIHtcblx0XHRyZXR1cm4gcGF0aCAmJiBjb29raWVfcGF0aHMuaW5kZXhPZiggcGF0aCApID09PSBpbmRleDtcblx0fSApO1xufVxuXG4vKipcbiAqIFNhdmUgRnVsbCBTY3JlZW4gcHJlZmVyZW5jZSBpbiBhIHNob3J0LWxpdmVkIGJyb3dzZXIgY29va2llLlxuICpcbiAqIFRoaXMgbWFrZXMgdGhlIG5leHQgYWRtaW4gcGFnZSBsb2FkIGRldGVybWluaXN0aWMgZXZlbiBpZiB0aGUgYXN5bmNocm9ub3VzXG4gKiB1c2VyLW1ldGEgcmVxdWVzdCBpcyBpbnRlcnJ1cHRlZC4gVGhlIHRpbWVzdGFtcCBsZXRzIFBIUCBkaXN0aW5ndWlzaCB0aGlzXG4gKiBwZW5kaW5nIHZhbHVlIGZyb20gYSBzdGFsZSBsZWdhY3kgY29va2llLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB2YWx1ZSBGdWxsc2NyZWVuIG1vZGUsIGVpdGhlciBgT25gIG9yIGBPZmZgLlxuICpcbiAqIEByZXR1cm4ge3ZvaWR9XG4gKi9cbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX2Z1bGxfc2NyZWVuX19zZXRfY29va2llKCB2YWx1ZSApIHtcblx0dmFyIG1heF9hZ2UgICAgICA9IDUgKiA2MDtcblx0dmFyIGlzc3VlZF9hdCAgICA9IE1hdGguZmxvb3IoIERhdGUubm93KCkgLyAxMDAwICk7XG5cdHZhciBjb29raWVfdmFsdWUgPSBlbmNvZGVVUklDb21wb25lbnQoIHZhbHVlICsgJ3wnICsgaXNzdWVkX2F0ICk7XG5cblx0d3BiY19hZG1pbl91aV9fZnVsbF9zY3JlZW5fX2dldF9jb29raWVfcGF0aHMoKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvb2tpZV9wYXRoICkge1xuXHRcdGRvY3VtZW50LmNvb2tpZSA9ICd3cGJjX2FkbWluX2Z1bGxfc2NyZWVuPScgKyBjb29raWVfdmFsdWUgKyAnOyBwYXRoPScgKyBjb29raWVfcGF0aCArICc7IG1heC1hZ2U9JyArIG1heF9hZ2UgKyAnOyBTYW1lU2l0ZT1MYXgnO1xuXHR9ICk7XG59XG5cclxuLyoqXHJcbiAqIEFwcGx5IEZ1bGwgU2NyZWVuIG1vZGUgZnJvbSBhIHVzZXIgY2xpY2suXHJcbiAqXHJcbiAqIEBwYXJhbSBIVE1MRWxlbWVudCBlbCAgICAgICAgICAgICAgICAgQ2xpY2tlZCBjb250cm9sLlxyXG4gKiBAcGFyYW0gYm9vbCAgICAgICAgaXNfc2F2ZV91c2VyX3N0YXRlIFdoZXRoZXIgdG8gc2F2ZSB1c2VyIHByZWZlcmVuY2UuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19mdWxsX3NjcmVlbl9fZG9fb24oIGVsLCBpc19zYXZlX3VzZXJfc3RhdGUgKSB7XHJcblx0alF1ZXJ5KCAnYm9keScgKS5hZGRDbGFzcyggJ3dwYmNfYWRtaW5fZnVsbF9zY3JlZW4nICk7XHJcblx0d3BiY19jaGVja19mdWxsX3NjcmVlbl9tb2RlKCk7XHJcblxyXG5cdGlmICggaXNfc2F2ZV91c2VyX3N0YXRlICkge1xyXG5cdFx0d3BiY19hZG1pbl91aV9fZnVsbF9zY3JlZW5fX3NldF9jb29raWUoICdPbicgKTtcclxuXHJcblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3cGJjX3NhdmVfY3VzdG9tX3VzZXJfZGF0YV9mcm9tX2VsZW1lbnQgKSB7XHJcblx0XHRcdHdwYmNfc2F2ZV9jdXN0b21fdXNlcl9kYXRhX2Zyb21fZWxlbWVudCggZWwgKTtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBFeGl0IEZ1bGwgU2NyZWVuIG1vZGUgZnJvbSBhIHVzZXIgY2xpY2suXHJcbiAqXHJcbiAqIEBwYXJhbSBIVE1MRWxlbWVudCBlbCAgICAgICAgICAgICAgICAgQ2xpY2tlZCBjb250cm9sLlxyXG4gKiBAcGFyYW0gYm9vbCAgICAgICAgaXNfc2F2ZV91c2VyX3N0YXRlIFdoZXRoZXIgdG8gc2F2ZSB1c2VyIHByZWZlcmVuY2UuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19mdWxsX3NjcmVlbl9fZG9fb2ZmKCBlbCwgaXNfc2F2ZV91c2VyX3N0YXRlICkge1xyXG5cdGpRdWVyeSggJ2JvZHknICkucmVtb3ZlQ2xhc3MoICd3cGJjX2FkbWluX2Z1bGxfc2NyZWVuJyApO1xyXG5cdHdwYmNfY2hlY2tfZnVsbF9zY3JlZW5fbW9kZSgpO1xyXG5cclxuXHRpZiAoIGlzX3NhdmVfdXNlcl9zdGF0ZSApIHtcclxuXHRcdHdwYmNfYWRtaW5fdWlfX2Z1bGxfc2NyZWVuX19zZXRfY29va2llKCAnT2ZmJyApO1xyXG5cclxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdwYmNfc2F2ZV9jdXN0b21fdXNlcl9kYXRhX2Zyb21fZWxlbWVudCApIHtcclxuXHRcdFx0d3BiY19zYXZlX2N1c3RvbV91c2VyX2RhdGFfZnJvbV9lbGVtZW50KCBlbCApO1xyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENoZWNrIEZ1bGwgIHNjcmVlbiBtb2RlLCAgYnkgIHJlbW92aW5nIHRvcCB0YWJcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2hlY2tfZnVsbF9zY3JlZW5fbW9kZSgpe1xyXG5cdGlmICggalF1ZXJ5KCAnYm9keScgKS5oYXNDbGFzcyggJ3dwYmNfYWRtaW5fZnVsbF9zY3JlZW4nICkgKSB7XHJcblx0XHRqUXVlcnkoICdodG1sJyApLnJlbW92ZUNsYXNzKCAnd3AtdG9vbGJhcicgKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0alF1ZXJ5KCAnaHRtbCcgKS5hZGRDbGFzcyggJ3dwLXRvb2xiYXInICk7XHJcblx0fVxyXG5cdHdwYmNfY2hlY2tfYnV0dG9uc19tYXhfbWluX2luX2Z1bGxfc2NyZWVuX21vZGUoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19jaGVja19idXR0b25zX21heF9taW5faW5fZnVsbF9zY3JlZW5fbW9kZSgpIHtcclxuXHRpZiAoIGpRdWVyeSggJ2JvZHknICkuaGFzQ2xhc3MoICd3cGJjX2FkbWluX2Z1bGxfc2NyZWVuJyApICkge1xyXG5cdFx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9mdWxsX3NjcmVlbicgICApLmFkZENsYXNzKCAgICAnd3BiY191aV9faGlkZScgKTtcclxuXHRcdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fbm9ybWFsX3NjcmVlbicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fZnVsbF9zY3JlZW4nICAgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0XHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX25vcm1hbF9zY3JlZW4nICkuYWRkQ2xhc3MoICAgICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdH1cclxufVxyXG5cclxualF1ZXJ5KCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKSB7XHJcblx0d3BiY19jaGVja19mdWxsX3NjcmVlbl9tb2RlKCk7XHJcbn0gKTtcclxuIiwiLyoqXHJcbiAqIENoZWNrYm94IFNlbGVjdGlvbiBmdW5jdGlvbnMgZm9yIExpc3RpbmcuXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIFNlbGVjdGlvbnMgb2Ygc2V2ZXJhbCAgY2hlY2tib3hlcyBsaWtlIGluIGdNYWlsIHdpdGggc2hpZnQgOilcclxuICogTmVlZCB0byAgaGF2ZSB0aGlzIHN0cnVjdHVyZTpcclxuICogLndwYmNfc2VsZWN0YWJsZV90YWJsZVxyXG4gKiAgICAgIC53cGJjX3NlbGVjdGFibGVfaGVhZFxyXG4gKiAgICAgICAgICAgICAgLmNoZWNrLWNvbHVtblxyXG4gKiAgICAgICAgICAgICAgICAgIDpjaGVja2JveFxyXG4gKiAgICAgIC53cGJjX3NlbGVjdGFibGVfYm9keVxyXG4gKiAgICAgICAgICAud3BiY19yb3dcclxuICogICAgICAgICAgICAgIC5jaGVjay1jb2x1bW5cclxuICogICAgICAgICAgICAgICAgICA6Y2hlY2tib3hcclxuICogICAgICAud3BiY19zZWxlY3RhYmxlX2Zvb3RcclxuICogICAgICAgICAgICAgIC5jaGVjay1jb2x1bW5cclxuICogICAgICAgICAgICAgICAgICA6Y2hlY2tib3hcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZGVmaW5lX2dtYWlsX2NoZWNrYm94X3NlbGVjdGlvbiggJCApe1xyXG5cclxuXHR2YXIgY2hlY2tzLCBmaXJzdCwgbGFzdCwgY2hlY2tlZCwgc2xpY2VkLCBsYXN0Q2xpY2tlZCA9IGZhbHNlO1xyXG5cclxuXHQvLyBDaGVjayBhbGwgY2hlY2tib3hlcy5cclxuXHQkKCAnLndwYmNfc2VsZWN0YWJsZV9ib2R5JyApLmZpbmQoICcuY2hlY2stY29sdW1uJyApLmZpbmQoICc6Y2hlY2tib3gnICkub24oXHJcblx0XHQnY2xpY2snLFxyXG5cdFx0ZnVuY3Rpb24gKGUpIHtcclxuXHRcdFx0aWYgKCAndW5kZWZpbmVkJyA9PSBlLnNoaWZ0S2V5ICkge1xyXG5cdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggZS5zaGlmdEtleSApIHtcclxuXHRcdFx0XHRpZiAoICEgbGFzdENsaWNrZWQgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y2hlY2tzICA9ICQoIGxhc3RDbGlja2VkICkuY2xvc2VzdCggJy53cGJjX3NlbGVjdGFibGVfYm9keScgKS5maW5kKCAnOmNoZWNrYm94JyApLmZpbHRlciggJzp2aXNpYmxlOmVuYWJsZWQnICk7XHJcblx0XHRcdFx0Zmlyc3QgICA9IGNoZWNrcy5pbmRleCggbGFzdENsaWNrZWQgKTtcclxuXHRcdFx0XHRsYXN0ICAgID0gY2hlY2tzLmluZGV4KCB0aGlzICk7XHJcblx0XHRcdFx0Y2hlY2tlZCA9ICQoIHRoaXMgKS5wcm9wKCAnY2hlY2tlZCcgKTtcclxuXHRcdFx0XHRpZiAoIDAgPCBmaXJzdCAmJiAwIDwgbGFzdCAmJiBmaXJzdCAhPSBsYXN0ICkge1xyXG5cdFx0XHRcdFx0c2xpY2VkID0gKGxhc3QgPiBmaXJzdCkgPyBjaGVja3Muc2xpY2UoIGZpcnN0LCBsYXN0ICkgOiBjaGVja3Muc2xpY2UoIGxhc3QsIGZpcnN0ICk7XHJcblx0XHRcdFx0XHRzbGljZWQucHJvcChcclxuXHRcdFx0XHRcdFx0J2NoZWNrZWQnLFxyXG5cdFx0XHRcdFx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRcdFx0aWYgKCAkKCB0aGlzICkuY2xvc2VzdCggJy53cGJjX3JvdycgKS5pcyggJzp2aXNpYmxlJyApICkge1xyXG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIGNoZWNrZWQ7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0KS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRsYXN0Q2xpY2tlZCA9IHRoaXM7XHJcblxyXG5cdFx0XHQvLyB0b2dnbGUgXCJjaGVjayBhbGxcIiBjaGVja2JveGVzLlxyXG5cdFx0XHR2YXIgdW5jaGVja2VkID0gJCggdGhpcyApLmNsb3Nlc3QoICcud3BiY19zZWxlY3RhYmxlX2JvZHknICkuZmluZCggJzpjaGVja2JveCcgKS5maWx0ZXIoICc6dmlzaWJsZTplbmFibGVkJyApLm5vdCggJzpjaGVja2VkJyApO1xyXG5cdFx0XHQkKCB0aGlzICkuY2xvc2VzdCggJy53cGJjX3NlbGVjdGFibGVfdGFibGUnICkuY2hpbGRyZW4oICcud3BiY19zZWxlY3RhYmxlX2hlYWQsIC53cGJjX3NlbGVjdGFibGVfZm9vdCcgKS5maW5kKCAnOmNoZWNrYm94JyApLnByb3AoXHJcblx0XHRcdFx0J2NoZWNrZWQnLFxyXG5cdFx0XHRcdGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdHJldHVybiAoMCA9PT0gdW5jaGVja2VkLmxlbmd0aCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHQpLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHQpO1xyXG5cclxuXHQvLyBIZWFkIHx8IEZvb3QgY2xpY2tpbmcgdG8gIHNlbGVjdCAvIGRlc2VsZWN0IEFMTC5cclxuXHQkKCAnLndwYmNfc2VsZWN0YWJsZV9oZWFkLCAud3BiY19zZWxlY3RhYmxlX2Zvb3QnICkuZmluZCggJy5jaGVjay1jb2x1bW4gOmNoZWNrYm94JyApLm9uKFxyXG5cdFx0J2NsaWNrJyxcclxuXHRcdGZ1bmN0aW9uIChldmVudCkge1xyXG5cdFx0XHR2YXIgJHRoaXMgICAgICAgICAgPSAkKCB0aGlzICksXHJcblx0XHRcdFx0JHRhYmxlICAgICAgICAgPSAkdGhpcy5jbG9zZXN0KCAnLndwYmNfc2VsZWN0YWJsZV90YWJsZScgKSxcclxuXHRcdFx0XHRjb250cm9sQ2hlY2tlZCA9ICR0aGlzLnByb3AoICdjaGVja2VkJyApLFxyXG5cdFx0XHRcdHRvZ2dsZSAgICAgICAgID0gZXZlbnQuc2hpZnRLZXkgfHwgJHRoaXMuZGF0YSggJ3dwLXRvZ2dsZScgKTtcclxuXHJcblx0XHRcdCR0YWJsZS5jaGlsZHJlbiggJy53cGJjX3NlbGVjdGFibGVfYm9keScgKS5maWx0ZXIoICc6dmlzaWJsZScgKVxyXG5cdFx0XHRcdC5maW5kKCAnLmNoZWNrLWNvbHVtbicgKS5maW5kKCAnOmNoZWNrYm94JyApXHJcblx0XHRcdFx0LnByb3AoXHJcblx0XHRcdFx0XHQnY2hlY2tlZCcsXHJcblx0XHRcdFx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRcdGlmICggJCggdGhpcyApLmlzKCAnOmhpZGRlbiw6ZGlzYWJsZWQnICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGlmICggdG9nZ2xlICkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiAhICQoIHRoaXMgKS5wcm9wKCAnY2hlY2tlZCcgKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICggY29udHJvbENoZWNrZWQgKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdCkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHJcblx0XHRcdCR0YWJsZS5jaGlsZHJlbiggJy53cGJjX3NlbGVjdGFibGVfaGVhZCwgIC53cGJjX3NlbGVjdGFibGVfZm9vdCcgKS5maWx0ZXIoICc6dmlzaWJsZScgKVxyXG5cdFx0XHRcdC5maW5kKCAnLmNoZWNrLWNvbHVtbicgKS5maW5kKCAnOmNoZWNrYm94JyApXHJcblx0XHRcdFx0LnByb3AoXHJcblx0XHRcdFx0XHQnY2hlY2tlZCcsXHJcblx0XHRcdFx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRcdGlmICggdG9nZ2xlICkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICggY29udHJvbENoZWNrZWQgKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdCk7XHJcblx0XHR9XHJcblx0KTtcclxuXHJcblxyXG5cdC8vIFZpc3VhbGx5ICBzaG93IHNlbGVjdGVkIGJvcmRlci5cclxuXHQkKCAnLndwYmNfc2VsZWN0YWJsZV9ib2R5JyApLmZpbmQoICcuY2hlY2stY29sdW1uIDpjaGVja2JveCcgKS5vbihcclxuXHRcdCdjaGFuZ2UnLFxyXG5cdFx0ZnVuY3Rpb24gKGV2ZW50KSB7XHJcblx0XHRcdGlmICggalF1ZXJ5KCB0aGlzICkuaXMoICc6Y2hlY2tlZCcgKSApIHtcclxuXHRcdFx0XHRqUXVlcnkoIHRoaXMgKS5jbG9zZXN0KCAnLndwYmNfbGlzdF9yb3cnICkuYWRkQ2xhc3MoICdyb3dfc2VsZWN0ZWRfY29sb3InICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0alF1ZXJ5KCB0aGlzICkuY2xvc2VzdCggJy53cGJjX2xpc3Rfcm93JyApLnJlbW92ZUNsYXNzKCAncm93X3NlbGVjdGVkX2NvbG9yJyApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBEaXNhYmxlIHRleHQgc2VsZWN0aW9uIHdoaWxlIHByZXNzaW5nICdzaGlmdCcuXHJcblx0XHRcdGRvY3VtZW50LmdldFNlbGVjdGlvbigpLnJlbW92ZUFsbFJhbmdlcygpO1xyXG5cclxuXHRcdFx0Ly8gU2hvdyBvciBoaWRlIGJ1dHRvbnMgb24gQWN0aW9ucyB0b29sYmFyICBhdCAgQm9va2luZyBMaXN0aW5nICBwYWdlLCAgaWYgd2UgaGF2ZSBzb21lIHNlbGVjdGVkIGJvb2tpbmdzLlxyXG5cdFx0XHR3cGJjX3Nob3dfaGlkZV9hY3Rpb25fYnV0dG9uc19mb3Jfc2VsZWN0ZWRfYm9va2luZ3MoKTtcclxuXHRcdH1cclxuXHQpO1xyXG5cclxuXHR3cGJjX3Nob3dfaGlkZV9hY3Rpb25fYnV0dG9uc19mb3Jfc2VsZWN0ZWRfYm9va2luZ3MoKTtcclxufVxyXG4iLCJcclxuLyoqXHJcbiAqIEdldCBJRCBhcnJheSAgb2Ygc2VsZWN0ZWQgZWxlbWVudHNcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZ2V0X3NlbGVjdGVkX3Jvd19pZCgpIHtcclxuXHJcblx0dmFyICR0YWJsZSAgICAgID0galF1ZXJ5KCAnLndwYmNfX3dyYXBfX2Jvb2tpbmdfbGlzdGluZyAud3BiY19zZWxlY3RhYmxlX3RhYmxlJyApO1xyXG5cdHZhciBjaGVja2JveGVzICA9ICR0YWJsZS5jaGlsZHJlbiggJy53cGJjX3NlbGVjdGFibGVfYm9keScgKS5maWx0ZXIoICc6dmlzaWJsZScgKS5maW5kKCAnLmNoZWNrLWNvbHVtbicgKS5maW5kKCAnOmNoZWNrYm94JyApO1xyXG5cdHZhciBzZWxlY3RlZF9pZCA9IFtdO1xyXG5cclxuXHRqUXVlcnkuZWFjaChcclxuXHRcdGNoZWNrYm94ZXMsXHJcblx0XHRmdW5jdGlvbiAoa2V5LCBjaGVja2JveCkge1xyXG5cdFx0XHRpZiAoIGpRdWVyeSggY2hlY2tib3ggKS5pcyggJzpjaGVja2VkJyApICkge1xyXG5cdFx0XHRcdHZhciBlbGVtZW50X2lkID0gd3BiY19nZXRfcm93X2lkX2Zyb21fZWxlbWVudCggY2hlY2tib3ggKTtcclxuXHRcdFx0XHRzZWxlY3RlZF9pZC5wdXNoKCBlbGVtZW50X2lkICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHQpO1xyXG5cclxuXHRyZXR1cm4gc2VsZWN0ZWRfaWQ7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogR2V0IElEIG9mIHJvdywgIGJhc2VkIG9uIGNsY2lrZWQgZWxlbWVudFxyXG4gKlxyXG4gKiBAcGFyYW0gdGhpc19pbmJvdW5kX2VsZW1lbnQgIC0gdXN1c2xseSAgdGhpc1xyXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19nZXRfcm93X2lkX2Zyb21fZWxlbWVudCh0aGlzX2luYm91bmRfZWxlbWVudCkge1xyXG5cclxuXHR2YXIgZWxlbWVudF9pZCA9IGpRdWVyeSggdGhpc19pbmJvdW5kX2VsZW1lbnQgKS5jbG9zZXN0KCAnLndwYmNfbGlzdGluZ191c3VhbF9yb3cnICkuYXR0ciggJ2lkJyApO1xyXG5cclxuXHRlbGVtZW50X2lkID0gcGFyc2VJbnQoIGVsZW1lbnRfaWQucmVwbGFjZSggJ3Jvd19pZF8nLCAnJyApICk7XHJcblxyXG5cdHJldHVybiBlbGVtZW50X2lkO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqID09IEJvb2tpbmcgTGlzdGluZyA9PSBTaG93IG9yIGhpZGUgYnV0dG9ucyBvbiBBY3Rpb25zIHRvb2xiYXIgIGF0ICAgIHBhZ2UsICBpZiB3ZSBoYXZlIHNvbWUgc2VsZWN0ZWQgYm9va2luZ3MuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3Nob3dfaGlkZV9hY3Rpb25fYnV0dG9uc19mb3Jfc2VsZWN0ZWRfYm9va2luZ3MoKXtcclxuXHJcblx0dmFyIHNlbGVjdGVkX3Jvd3NfYXJyID0gd3BiY19nZXRfc2VsZWN0ZWRfcm93X2lkKCk7XHJcblxyXG5cdGlmICggc2VsZWN0ZWRfcm93c19hcnIubGVuZ3RoID4gMCApIHtcclxuXHRcdGpRdWVyeSggJy5oaWRlX2J1dHRvbl9pZl9ub19zZWxlY3Rpb24nICkuc2hvdygpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRqUXVlcnkoICcuaGlkZV9idXR0b25faWZfbm9fc2VsZWN0aW9uJyApLmhpZGUoKTtcclxuXHR9XHJcbn0iLCJcInVzZSBzdHJpY3RcIjtcclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vID09IExlZnQgQmFyICAtICBleHBhbmQgLyBjb2xhcHNlIGZ1bmN0aW9ucyAgID09XHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuLyoqXHJcbiAqIFNhdmUgdXNlcidzIHByZWZlcnJlZCBsZWZ0IHNpZGViYXIgbW9kZS5cclxuICpcclxuICogQHBhcmFtIHN0cmluZyBtb2RlXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX3NhdmVfbW9kZSggbW9kZSApIHtcclxuXHR2YXIgYWxsb3dlZF9tb2RlcyA9IFsgJ21pbicsICdjb21wYWN0JywgJ21heCcgXTtcclxuXHJcblx0aWYgKCBhbGxvd2VkX21vZGVzLmluZGV4T2YoIG1vZGUgKSA9PT0gLTEgKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHR2YXIgJHNhdmVyID0galF1ZXJ5KCAnI3dwYmNfbGVmdF9zaWRlYmFyX3ZpZXdfbW9kZV9zYXZlcicgKTtcclxuXHJcblx0aWYgKCAhICRzYXZlci5sZW5ndGggKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHRpZiAoICdmdW5jdGlvbicgIT09IHR5cGVvZiB3cGJjX3NhdmVfY3VzdG9tX3VzZXJfZGF0YV9mcm9tX2VsZW1lbnQgKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHQkc2F2ZXIuZGF0YSggJ3dwYmMtdS1zYXZlLXZhbHVlJywgbW9kZSApO1xyXG5cdCRzYXZlci5hdHRyKCAnZGF0YS13cGJjLXUtc2F2ZS12YWx1ZScsIG1vZGUgKTtcclxuXHJcblx0d3BiY19zYXZlX2N1c3RvbV91c2VyX2RhdGFfZnJvbV9lbGVtZW50KCAkc2F2ZXIuZ2V0KCAwICkgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJldmVhbCB0aGUgYWN0aXZlIGl0ZW0gaW5zaWRlIHRoZSBzY3JvbGxhYmxlIGxlZnQgbmF2aWdhdGlvbi5cclxuICpcclxuICogVGhlIGFjdGl2ZSBpdGVtIGl0c2VsZiBpcyBhbGlnbmVkIHdpdGggYSBzbWFsbCBsZWFkaW5nIG9mZnNldCwgcmVnYXJkbGVzcyBvZlxyXG4gKiBpdHMgcG9zaXRpb24gaW5zaWRlIGEgcm9vdCBzZWN0aW9uLiBTY3JvbGxpbmcgaXMgYXBwbGllZCBvbmx5IHRvIFNpbXBsZUJhcidzXHJcbiAqIGludGVybmFsIHNjcm9sbCBlbGVtZW50IHNvIHRoZSBXb3JkUHJlc3MgYWRtaW5pc3RyYXRpb24gZG9jdW1lbnQgZG9lcyBub3RcclxuICogbW92ZS5cclxuICpcclxuICogQHBhcmFtIHtPYmplY3R8bnVsbHx1bmRlZmluZWR9IHNpbXBsZWJhcl9pbnN0YW5jZSBPcHRpb25hbCBpbml0aWFsaXplZCBTaW1wbGVCYXIgaW5zdGFuY2UuXHJcbiAqIEByZXR1cm4ge3ZvaWR9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX3Njcm9sbF90b19hY3RpdmVfaXRlbSggc2ltcGxlYmFyX2luc3RhbmNlICkge1xyXG5cdHZhciBsZWZ0X25hdmlnYXRpb25fZWxlbWVudCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICcud3BiY191aV9lbF9fdmVydF9sZWZ0X2Jhcl9fY29udGVudCcgKTtcclxuXHJcblx0aWYgKFxyXG5cdFx0ISBzaW1wbGViYXJfaW5zdGFuY2VcclxuXHRcdCYmICd1bmRlZmluZWQnICE9PSB0eXBlb2YgU2ltcGxlQmFyXHJcblx0XHQmJiBTaW1wbGVCYXIuaW5zdGFuY2VzXHJcblx0XHQmJiBsZWZ0X25hdmlnYXRpb25fZWxlbWVudFxyXG5cdCkge1xyXG5cdFx0c2ltcGxlYmFyX2luc3RhbmNlID0gU2ltcGxlQmFyLmluc3RhbmNlcy5nZXQoIGxlZnRfbmF2aWdhdGlvbl9lbGVtZW50ICk7XHJcblx0fVxyXG5cclxuXHRpZiAoXHJcblx0XHQhIHNpbXBsZWJhcl9pbnN0YW5jZVxyXG5cdFx0fHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHNpbXBsZWJhcl9pbnN0YW5jZS5nZXRTY3JvbGxFbGVtZW50XHJcblx0XHR8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygc2ltcGxlYmFyX2luc3RhbmNlLmdldENvbnRlbnRFbGVtZW50XHJcblx0KSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmdW5jdGlvbiAoKSB7XHJcblx0XHR2YXIgc2Nyb2xsX2VsZW1lbnQgID0gc2ltcGxlYmFyX2luc3RhbmNlLmdldFNjcm9sbEVsZW1lbnQoKTtcclxuXHRcdHZhciBjb250ZW50X2VsZW1lbnQgPSBzaW1wbGViYXJfaW5zdGFuY2UuZ2V0Q29udGVudEVsZW1lbnQoKTtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCEgc2Nyb2xsX2VsZW1lbnRcclxuXHRcdFx0fHwgISBjb250ZW50X2VsZW1lbnRcclxuXHRcdFx0fHwgISBjb250ZW50X2VsZW1lbnQuY2xvc2VzdCggJy53cGJjX3VpX2VsX192ZXJ0X2xlZnRfYmFyX19jb250ZW50JyApXHJcblx0XHQpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHNpbXBsZWJhcl9pbnN0YW5jZS5yZWNhbGN1bGF0ZSgpO1xyXG5cclxuXHRcdHZhciBhY3RpdmVfaXRlbSA9IGNvbnRlbnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfdWlfZWxfX3ZlcnRfbmF2X2l0ZW0uYWN0aXZlJyApO1xyXG5cclxuXHRcdGlmICggISBhY3RpdmVfaXRlbSB8fCBudWxsID09PSBhY3RpdmVfaXRlbS5vZmZzZXRQYXJlbnQgfHwgMCA+PSBzY3JvbGxfZWxlbWVudC5jbGllbnRIZWlnaHQgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgc2Nyb2xsX3JlY3QgICAgPSBzY3JvbGxfZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuXHRcdHZhciBhY3RpdmVfcmVjdCAgICA9IGFjdGl2ZV9pdGVtLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG5cdFx0dmFyIGN1cnJlbnRfdG9wICAgID0gc2Nyb2xsX2VsZW1lbnQuc2Nyb2xsVG9wO1xyXG5cdFx0dmFyIGxlYWRpbmdfb2Zmc2V0ID0gODU7XHJcblx0XHR2YXIgYWN0aXZlX3RvcCAgICAgPSBjdXJyZW50X3RvcCArIGFjdGl2ZV9yZWN0LnRvcCAtIHNjcm9sbF9yZWN0LnRvcDtcclxuXHRcdHZhciB0YXJnZXRfdG9wICAgICA9IGFjdGl2ZV90b3AgLSBsZWFkaW5nX29mZnNldDtcclxuXHJcblx0XHR2YXIgbWF4aW11bV90b3AgPSBNYXRoLm1heCggMCwgc2Nyb2xsX2VsZW1lbnQuc2Nyb2xsSGVpZ2h0IC0gc2Nyb2xsX2VsZW1lbnQuY2xpZW50SGVpZ2h0ICk7XHJcblxyXG5cdFx0c2Nyb2xsX2VsZW1lbnQuc2Nyb2xsVG9wID0gTWF0aC5tYXgoIDAsIE1hdGgubWluKCBNYXRoLnJvdW5kKCB0YXJnZXRfdG9wICksIG1heGltdW1fdG9wICkgKTtcclxuXHR9ICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBFeHBhbmQgVmVydGljYWwgTGVmdCBCYXIuXHJcbiAqXHJcbiAqIEBwYXJhbSBib29sIGlzX3NhdmVfdXNlcl9zdGF0ZSBTYXZlIHRoaXMgbW9kZSBhcyB1c2VyJ3MgcHJlZmVyZW5jZS5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fZG9fbWF4KCBpc19zYXZlX3VzZXJfc3RhdGUgKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLnJlbW92ZUNsYXNzKCAnbWluIG1heCBjb21wYWN0IG5vbmUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLmFkZENsYXNzKCAnbWF4JyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fb3Blbl9sZWZ0X3ZlcnRpY2FsX25hdicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9oaWRlX2xlZnRfdmVydGljYWxfbmF2JyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHJcblx0alF1ZXJ5KCAnLndwLWFkbWluJyApLnJlbW92ZUNsYXNzKCAnd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9taW4gd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9tYXggd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9jb21wYWN0IHdwYmNfcGFnZV93cmFwcGVyX2xlZnRfbm9uZScgKTtcclxuXHRqUXVlcnkoICcud3AtYWRtaW4nICkuYWRkQ2xhc3MoICd3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X21heCcgKTtcclxuXHR3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX3Njcm9sbF90b19hY3RpdmVfaXRlbSgpO1xyXG5cclxuXHRpZiAoIGlzX3NhdmVfdXNlcl9zdGF0ZSApIHtcclxuXHRcdHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fc2F2ZV9tb2RlKCAnbWF4JyApO1xyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEhpZGUgVmVydGljYWwgTGVmdCBCYXIuXHJcbiAqXHJcbiAqIEBwYXJhbSBib29sIGlzX3NhdmVfdXNlcl9zdGF0ZSBTYXZlIHRoaXMgbW9kZSBhcyB1c2VyJ3MgcHJlZmVyZW5jZS5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fZG9fbWluKCBpc19zYXZlX3VzZXJfc3RhdGUgKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLnJlbW92ZUNsYXNzKCAnbWluIG1heCBjb21wYWN0IG5vbmUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLmFkZENsYXNzKCAnbWluJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fb3Blbl9sZWZ0X3ZlcnRpY2FsX25hdicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9oaWRlX2xlZnRfdmVydGljYWxfbmF2JyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHJcblx0alF1ZXJ5KCAnLndwLWFkbWluJyApLnJlbW92ZUNsYXNzKCAnd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9taW4gd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9tYXggd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9jb21wYWN0IHdwYmNfcGFnZV93cmFwcGVyX2xlZnRfbm9uZScgKTtcclxuXHRqUXVlcnkoICcud3AtYWRtaW4nICkuYWRkQ2xhc3MoICd3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X21pbicgKTtcclxuXHJcblx0aWYgKCBpc19zYXZlX3VzZXJfc3RhdGUgKSB7XHJcblx0XHR3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX3NhdmVfbW9kZSggJ21pbicgKTtcclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb2xhcHNlIFZlcnRpY2FsIExlZnQgQmFyLlxyXG4gKlxyXG4gKiBAcGFyYW0gYm9vbCBpc19zYXZlX3VzZXJfc3RhdGUgU2F2ZSB0aGlzIG1vZGUgYXMgdXNlcidzIHByZWZlcmVuY2UuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX2RvX2NvbXBhY3QoIGlzX3NhdmVfdXNlcl9zdGF0ZSApIHtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkucmVtb3ZlQ2xhc3MoICdtaW4gbWF4IGNvbXBhY3Qgbm9uZScgKTtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkuYWRkQ2xhc3MoICdjb21wYWN0JyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fb3Blbl9sZWZ0X3ZlcnRpY2FsX25hdicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9oaWRlX2xlZnRfdmVydGljYWxfbmF2JyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHJcblx0alF1ZXJ5KCAnLndwLWFkbWluJyApLnJlbW92ZUNsYXNzKCAnd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9taW4gd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9tYXggd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9jb21wYWN0IHdwYmNfcGFnZV93cmFwcGVyX2xlZnRfbm9uZScgKTtcclxuXHRqUXVlcnkoICcud3AtYWRtaW4nICkuYWRkQ2xhc3MoICd3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X2NvbXBhY3QnICk7XHJcblx0d3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19zY3JvbGxfdG9fYWN0aXZlX2l0ZW0oKTtcclxuXHJcblx0aWYgKCBpc19zYXZlX3VzZXJfc3RhdGUgKSB7XHJcblx0XHR3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX3NhdmVfbW9kZSggJ2NvbXBhY3QnICk7XHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogQ29tcGxldGVseSBIaWRlIFZlcnRpY2FsIExlZnQgQmFyLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19kb19oaWRlKCkge1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5yZW1vdmVDbGFzcyggJ21pbiBtYXggY29tcGFjdCBub25lJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5hZGRDbGFzcyggJ25vbmUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9vcGVuX2xlZnRfdmVydGljYWxfbmF2JyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2hpZGVfbGVmdF92ZXJ0aWNhbF9uYXYnICkuYWRkQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdC8vIEhpZGUgdG9wIFwiTWVudVwiIGJ1dHRvbiB3aXRoIGRpdmlkZXIuXHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9zaG93X2xlZnRfdmVydGljYWxfbmF2LC53cGJjX3VpX190b3BfbmF2X19idG5fc2hvd19sZWZ0X3ZlcnRpY2FsX25hdl9kaXZpZGVyJyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHJcblx0alF1ZXJ5KCAnLndwLWFkbWluJyApLnJlbW92ZUNsYXNzKCAnd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9taW4gd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9tYXggd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9jb21wYWN0IHdwYmNfcGFnZV93cmFwcGVyX2xlZnRfbm9uZScgKTtcclxuXHRqUXVlcnkoICcud3AtYWRtaW4nICkuYWRkQ2xhc3MoICd3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X25vbmUnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBY3Rpb24gb24gY2xpY2sgXCJHbyBCYWNrXCIgLSBzaG93IHJvb3QgbWVudVxyXG4gKiBvciBzb21lIG90aGVyIHNlY3Rpb24gaW4gbGVmdCBzaWRlYmFyLlxyXG4gKlxyXG4gKiBAcGFyYW0gc3RyaW5nIG1lbnVfdG9fc2hvdyAtIG1lbnUgc2x1Zy5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fc2hvd19zZWN0aW9uKCBtZW51X3RvX3Nob3cgKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfZWxfX3ZlcnRfbGVmdF9iYXJfX3NlY3Rpb24nICkuYWRkQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApXHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfZWxfX3ZlcnRfbGVmdF9iYXJfX3NlY3Rpb25fJyArIG1lbnVfdG9fc2hvdyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxufVxyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vID09IFJpZ2h0IFNpZGUgQmFyICAtICBleHBhbmQgLyBjb2xhcHNlIGZ1bmN0aW9ucyAgID09XHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuLyoqXHJcbiAqIFN5bmNocm9uaXplIHRoZSBkb2N1bWVudCBib2R5IG1hcmtlciBmb3IgdGhlIGV4cGFuZGVkIHJpZ2h0IHNpZGViYXIuXHJcbiAqXHJcbiAqIFRoZSBtYXJrZXIgaXMgZG9tYWluLW5ldXRyYWwgc28gaW5kaXZpZHVhbCBhZG1pbmlzdHJhdGlvbiBwYWdlcyBjYW4gYWRqdXN0XHJcbiAqIHRoZWlyIHByZXNlbnRhdGlvbiB3aXRob3V0IGR1cGxpY2F0aW5nIHJpZ2h0LXNpZGViYXIgc3RhdGUgaGFuZGxpbmcuXHJcbiAqXHJcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfb3BlbiBXaGV0aGVyIHRoZSByaWdodCBzaWRlYmFyIGlzIGZ1bGx5IGV4cGFuZGVkLlxyXG4gKiBAcmV0dXJuIHt2b2lkfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fc2V0X2JvZHlfb3Blbl9zdGF0ZSggaXNfb3BlbiApIHtcclxuXHRqUXVlcnkoICdib2R5JyApLnRvZ2dsZUNsYXNzKCAnd3BiY191aV9lbF9fdmVydF9yaWdodF9iYXJfX3dyYXBwZXJfb3BlbmVkJywgISEgaXNfb3BlbiApO1xyXG59XHJcblxyXG4vKipcclxuICogRXhwYW5kIFZlcnRpY2FsIFJpZ2h0IEJhci5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX21heCgpIHtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkucmVtb3ZlQ2xhc3MoICdtaW5fcmlnaHQgbWF4X3JpZ2h0IGNvbXBhY3RfcmlnaHQgbm9uZV9yaWdodCcgKTtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkuYWRkQ2xhc3MoICdtYXhfcmlnaHQnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9vcGVuX3JpZ2h0X3ZlcnRpY2FsX25hdicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9oaWRlX3JpZ2h0X3ZlcnRpY2FsX25hdicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0d3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fc2V0X2JvZHlfb3Blbl9zdGF0ZSggdHJ1ZSApO1xyXG59XHJcblxyXG4vKipcclxuICogSGlkZSBWZXJ0aWNhbCBSaWdodCBCYXIuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX3JpZ2h0X19kb19taW4oKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLnJlbW92ZUNsYXNzKCAnbWluX3JpZ2h0IG1heF9yaWdodCBjb21wYWN0X3JpZ2h0IG5vbmVfcmlnaHQnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLmFkZENsYXNzKCAnbWluX3JpZ2h0JyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fb3Blbl9yaWdodF92ZXJ0aWNhbF9uYXYnICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5faGlkZV9yaWdodF92ZXJ0aWNhbF9uYXYnICkuYWRkQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX3NldF9ib2R5X29wZW5fc3RhdGUoIGZhbHNlICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb2xhcHNlIFZlcnRpY2FsIFJpZ2h0IEJhci5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX2NvbXBhY3QoKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLnJlbW92ZUNsYXNzKCAnbWluX3JpZ2h0IG1heF9yaWdodCBjb21wYWN0X3JpZ2h0IG5vbmVfcmlnaHQnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLmFkZENsYXNzKCAnY29tcGFjdF9yaWdodCcgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fcmlnaHRfdmVydGljYWxfbmF2JyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2hpZGVfcmlnaHRfdmVydGljYWxfbmF2JyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHR3cGJjX2FkbWluX3VpX19zaWRlYmFyX3JpZ2h0X19zZXRfYm9keV9vcGVuX3N0YXRlKCBmYWxzZSApO1xyXG59XHJcblxyXG4vKipcclxuICogQ29tcGxldGVseSBIaWRlIFZlcnRpY2FsIFJpZ2h0IEJhci5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX2hpZGUoKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLnJlbW92ZUNsYXNzKCAnbWluX3JpZ2h0IG1heF9yaWdodCBjb21wYWN0X3JpZ2h0IG5vbmVfcmlnaHQnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLmFkZENsYXNzKCAnbm9uZV9yaWdodCcgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fcmlnaHRfdmVydGljYWxfbmF2JyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2hpZGVfcmlnaHRfdmVydGljYWxfbmF2JyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHQvLyBIaWRlIHRvcCBcIk1lbnVcIiBidXR0b24gd2l0aCBkaXZpZGVyLlxyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fc2hvd19yaWdodF92ZXJ0aWNhbF9uYXYsLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9zaG93X3JpZ2h0X3ZlcnRpY2FsX25hdl9kaXZpZGVyJyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHR3cGJjX2FkbWluX3VpX19zaWRlYmFyX3JpZ2h0X19zZXRfYm9keV9vcGVuX3N0YXRlKCBmYWxzZSApO1xyXG59XHJcblxyXG4vKipcclxuICogUmVzdG9yZSB0aGUgYm9keSBtYXJrZXIgd2hlbiBhIHBhZ2UgcmVuZGVycyB3aXRoIHRoZSByaWdodCBzaWRlYmFyIG9wZW4uXHJcbiAqL1xyXG5qUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uICgpIHtcclxuXHR3cGJjX2FkbWluX3VpX19zaWRlYmFyX3JpZ2h0X19zZXRfYm9keV9vcGVuX3N0YXRlKCAwIDwgalF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyLm1heF9yaWdodCcgKS5sZW5ndGggKTtcclxufSApO1xyXG5cclxuLyoqXHJcbiAqIENvbGxhcHNlIGFuIGV4cGFuZGVkIHJpZ2h0IHNpZGViYXIgYWZ0ZXIgYW4gb3B0ZWQtaW4gcGFnZS1jb250ZW50IGNsaWNrLlxyXG4gKlxyXG4gKiBQYWdlcyBlbmFibGUgdGhpcyBiZWhhdmlvciB0aHJvdWdoIHRoZSBwYWdlLXN0cnVjdHVyZVxyXG4gKiByaWdodF92ZXJ0aWNhbF9zaWRlYmFyX19jb250ZW50X2NsaWNrX2NvbGxhcHNlX21vZGUgb3B0aW9uLiBJbnRlcmFjdGl2ZVxyXG4gKiBjb250cm9scyB0aGF0IG9wZW4gb3IgcmV0YWluIHNpZGViYXIgY29udGVudCBjYW4gb3B0IG91dCBieSBwbGFjaW5nIHRoZVxyXG4gKiBkYXRhLXdwYmMtcmlnaHQtc2lkZWJhci1rZWVwLW9wZW4gYXR0cmlidXRlIG9uIHRoZW1zZWx2ZXMgb3IgYW4gYW5jZXN0b3IuXHJcbiAqXHJcbiAqIEBwYXJhbSB7TW91c2VFdmVudH0gZXZlbnQgQ29udGVudCBjbGljayBldmVudCBjYXB0dXJlZCBiZWZvcmUgY2F0YWxvZyByb3dzLlxyXG4gKiBAcmV0dXJuIHt2b2lkfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fY29sbGFwc2VfZnJvbV9jb250ZW50X2NsaWNrKCBldmVudCApIHtcclxuXHR2YXIgZXZlbnRfdGFyZ2V0ID0gZXZlbnQudGFyZ2V0ICYmIDEgPT09IGV2ZW50LnRhcmdldC5ub2RlVHlwZSA/IGV2ZW50LnRhcmdldCA6IG51bGw7XHJcblx0dmFyIGNvbnRlbnRfZWxlbWVudCA9IGV2ZW50X3RhcmdldCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgZXZlbnRfdGFyZ2V0LmNsb3Nlc3RcclxuXHRcdD8gZXZlbnRfdGFyZ2V0LmNsb3Nlc3QoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXJbZGF0YS13cGJjLXJpZ2h0LXNpZGViYXItY29udGVudC1jbGljay1jb2xsYXBzZS1tb2RlXSA+IC53cGJjX3NldHRpbmdzX3BhZ2VfY29udGVudCcgKVxyXG5cdFx0OiBudWxsO1xyXG5cdHZhciAkY29udGVudDtcclxuXHR2YXIgJHdyYXBwZXI7XHJcblx0dmFyIGNvbGxhcHNlX21vZGU7XHJcblx0dmFyIGJlZm9yZV9jb2xsYXBzZV9ldmVudDtcclxuXHJcblx0aWYgKCAhIGNvbnRlbnRfZWxlbWVudCApIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdCRjb250ZW50ID0galF1ZXJ5KCBjb250ZW50X2VsZW1lbnQgKTtcclxuXHQkd3JhcHBlciA9ICRjb250ZW50LmNsb3Nlc3QoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICk7XHJcblx0Y29sbGFwc2VfbW9kZSA9IFN0cmluZyggJHdyYXBwZXIuYXR0ciggJ2RhdGEtd3BiYy1yaWdodC1zaWRlYmFyLWNvbnRlbnQtY2xpY2stY29sbGFwc2UtbW9kZScgKSB8fCAnJyApO1xyXG5cclxuXHRpZiAoICEgJHdyYXBwZXIuaGFzQ2xhc3MoICdtYXhfcmlnaHQnICkgfHwgWyAnbWluJywgJ2NvbXBhY3QnLCAnbm9uZScgXS5pbmRleE9mKCBjb2xsYXBzZV9tb2RlICkgPT09IC0xICkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHRpZiAoIGpRdWVyeSggZXZlbnQudGFyZ2V0ICkuY2xvc2VzdCggJ1tkYXRhLXdwYmMtcmlnaHQtc2lkZWJhci1rZWVwLW9wZW5dJyApLmxlbmd0aCApIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdC8qXHJcblx0ICogVGhpcyBjbGljayBiZWxvbmdzIHRvIHRoZSBvcGVuLXNpZGViYXIgZGlzbWlzc2FsIGxheWVyLiBDb25zdW1lIGl0IGJlZm9yZVxyXG5cdCAqIGRvbWFpbiByb3cgaGFuZGxlcnMgcnVuIHNvIHRoZSBzYW1lIHBvaW50ZXIgYWN0aW9uIGNhbm5vdCBjbG9zZSBvbmVcclxuXHQgKiBpbnNwZWN0b3IgYW5kIGltbWVkaWF0ZWx5IG9wZW4gYW5vdGhlciBvbmUgdW5kZXJuZWF0aCBpdC5cclxuXHQgKi9cclxuXHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xyXG5cclxuXHRiZWZvcmVfY29sbGFwc2VfZXZlbnQgPSBqUXVlcnkuRXZlbnQoICd3cGJjOnJpZ2h0LXNpZGViYXItYmVmb3JlLWNvbnRlbnQtY29sbGFwc2UnICk7XHJcblx0JHdyYXBwZXIudHJpZ2dlciggYmVmb3JlX2NvbGxhcHNlX2V2ZW50LCBbIGV2ZW50IF0gKTtcclxuXHRpZiAoIGJlZm9yZV9jb2xsYXBzZV9ldmVudC5pc0RlZmF1bHRQcmV2ZW50ZWQoKSApIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdGlmICggJ2NvbXBhY3QnID09PSBjb2xsYXBzZV9tb2RlICkge1xyXG5cdFx0d3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9fY29tcGFjdCgpO1xyXG5cdH0gZWxzZSBpZiAoICdub25lJyA9PT0gY29sbGFwc2VfbW9kZSApIHtcclxuXHRcdHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX2hpZGUoKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0d3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9fbWluKCk7XHJcblx0fVxyXG5cclxuXHRqUXVlcnkoIGRvY3VtZW50ICkudHJpZ2dlciggJ3dwYmNfc2V0dXBfd2l6YXJkX2xheW91dF9jaGFuZ2VkJyApO1xyXG59XHJcblxyXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCB3cGJjX2FkbWluX3VpX19zaWRlYmFyX3JpZ2h0X19jb2xsYXBzZV9mcm9tX2NvbnRlbnRfY2xpY2ssIHRydWUgKTtcclxuXHJcblxyXG4vKipcclxuICogQWN0aW9uIG9uIGNsaWNrIFwiR28gQmFja1wiIC0gc2hvdyByb290IG1lbnVcclxuICogb3Igc29tZSBvdGhlciBzZWN0aW9uIGluIHJpZ2h0IHNpZGViYXIuXHJcbiAqXHJcbiAqIEBwYXJhbSBzdHJpbmcgbWVudV90b19zaG93IC0gbWVudSBzbHVnLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fc2hvd19zZWN0aW9uKCBtZW51X3RvX3Nob3cgKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfZWxfX3ZlcnRfcmlnaHRfYmFyX19zZWN0aW9uJyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKVxyXG5cdGpRdWVyeSggJy53cGJjX3VpX2VsX192ZXJ0X3JpZ2h0X2Jhcl9fc2VjdGlvbl8nICsgbWVudV90b19zaG93ICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG59XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gPT0gRW5kIFJpZ2h0IFNpZGUgQmFyICBzZWN0aW9uICAgPT1cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4vKipcclxuICogR2V0IGFuY2hvcihzKSBhcnJheSAgZnJvbSAgVVJMLlxyXG4gKiBEb2M6IGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9Mb2NhdGlvblxyXG4gKlxyXG4gKiBAcmV0dXJucyB7KltdfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY191cmxfZ2V0X2FuY2hvcnNfYXJyKCkge1xyXG5cdHZhciBoYXNoZXMgICAgICAgICAgICA9IHdpbmRvdy5sb2NhdGlvbi5oYXNoLnJlcGxhY2UoICclMjMnLCAnIycgKTtcclxuXHR2YXIgaGFzaGVzX2FyciAgICAgICAgPSBoYXNoZXMuc3BsaXQoICcjJyApO1xyXG5cdHZhciByZXN1bHQgICAgICAgICAgICA9IFtdO1xyXG5cdHZhciBoYXNoZXNfYXJyX2xlbmd0aCA9IGhhc2hlc19hcnIubGVuZ3RoO1xyXG5cclxuXHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBoYXNoZXNfYXJyX2xlbmd0aDsgaSsrICkge1xyXG5cdFx0aWYgKCBoYXNoZXNfYXJyW2ldLmxlbmd0aCA+IDAgKSB7XHJcblx0XHRcdHJlc3VsdC5wdXNoKCBoYXNoZXNfYXJyW2ldICk7XHJcblx0XHR9XHJcblx0fVxyXG5cdHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBdXRvIEV4cGFuZCBTZXR0aW5ncyBzZWN0aW9uIGJhc2VkIG9uIFVSTCBhbmNob3IsIGFmdGVyICBwYWdlIGxvYWRlZC5cclxuICovXHJcbmpRdWVyeSggZG9jdW1lbnQgKS5yZWFkeSggZnVuY3Rpb24gKCkgeyB3cGJjX2FkbWluX3VpX19yZWRpcmVjdF9sZWdhY3lfZ2VuZXJhbF9hdmFpbGFiaWxpdHlfdXJsKCk7IH0gKTtcclxualF1ZXJ5KCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKSB7IHdwYmNfYWRtaW5fdWlfX2RvX2V4cGFuZF9zZWN0aW9uKCk7IHNldFRpbWVvdXQoICd3cGJjX2FkbWluX3VpX19kb19leHBhbmRfc2VjdGlvbicsIDEwICk7IH0gKTtcclxualF1ZXJ5KCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKSB7IHdwYmNfYWRtaW5fdWlfX2RvX2V4cGFuZF9zZWN0aW9uKCk7IHNldFRpbWVvdXQoICd3cGJjX2FkbWluX3VpX19kb19leHBhbmRfc2VjdGlvbicsIDE1MCApOyB9ICk7XHJcblxyXG4vKipcclxuICogUmVkaXJlY3Qgb2xkIFNldHRpbmdzID4gQXZhaWxhYmlsaXR5IGFuY2hvcnMgdG8gdGhlIGRlZGljYXRlZCBHZW5lcmFsIEF2YWlsYWJpbGl0eSBwYWdlLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fcmVkaXJlY3RfbGVnYWN5X2dlbmVyYWxfYXZhaWxhYmlsaXR5X3VybCgpIHtcclxuXHJcblx0aWYgKFxyXG5cdFx0ICAgKCB3aW5kb3cubG9jYXRpb24uaHJlZi5pbmRleE9mKCAncGFnZT13cGJjLXNldHRpbmdzJyApID4gLTEgKVxyXG5cdFx0JiYgKFxyXG5cdFx0XHQgICAoIHdpbmRvdy5sb2NhdGlvbi5oYXNoLmluZGV4T2YoICd3cGJjX2dlbmVyYWxfc2V0dGluZ3NfYXZhaWxhYmlsaXR5X21ldGFib3gnICkgPiAtMSApXHJcblx0XHRcdHx8ICggd2luZG93LmxvY2F0aW9uLmhhc2guaW5kZXhPZiggJ3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19hdmFpbGFiaWxpdHlfdGFiJyApID4gLTEgKVxyXG5cdFx0KVxyXG5cdCkge1xyXG5cdFx0d2luZG93LmxvY2F0aW9uLnJlcGxhY2UoIHdpbmRvdy5sb2NhdGlvbi5ocmVmLnNwbGl0KCAnPycgKVswXSArICc/cGFnZT13cGJjLWF2YWlsYWJpbGl0eSZ0YWI9Z2VuZXJhbF9hdmFpbGFiaWxpdHknICk7XHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogRXhwYW5kIHNlY3Rpb24gaW4gIEdlbmVyYWwgU2V0dGluZ3MgcGFnZSBhbmQgc2VsZWN0IE1lbnUgaXRlbS5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX2RvX2V4cGFuZF9zZWN0aW9uKCkge1xyXG5cclxuXHQvLyB3aW5kb3cubG9jYXRpb24uaGFzaCAgPSAjc2VjdGlvbl9pZCAgLyAgZG9jOiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvTG9jYXRpb24gLlxyXG5cdHZhciBhbmNob3JzX2FyciAgICAgICAgPSB3cGJjX3VybF9nZXRfYW5jaG9yc19hcnIoKTtcclxuXHR2YXIgYW5jaG9yc19hcnJfbGVuZ3RoID0gYW5jaG9yc19hcnIubGVuZ3RoO1xyXG5cclxuXHRpZiAoIGFuY2hvcnNfYXJyX2xlbmd0aCA+IDAgKSB7XHJcblx0XHR2YXIgb25lX2FuY2hvcl9wcm9wX3ZhbHVlID0gYW5jaG9yc19hcnJbMF0uc3BsaXQoICdkb19leHBhbmRfXycgKTtcclxuXHRcdGlmICggb25lX2FuY2hvcl9wcm9wX3ZhbHVlLmxlbmd0aCA+IDEgKSB7XHJcblxyXG5cdFx0XHQvLyAnd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhbGVuZGFyX21ldGFib3gnXHJcblx0XHRcdHZhciBzZWN0aW9uX3RvX3Nob3cgICAgPSBvbmVfYW5jaG9yX3Byb3BfdmFsdWVbMV07XHJcblx0XHRcdHZhciBzZWN0aW9uX2lkX3RvX3Nob3cgPSAnIycgKyBzZWN0aW9uX3RvX3Nob3c7XHJcblxyXG5cclxuXHRcdFx0Ly8gLS0gUmVtb3ZlIHNlbGVjdGVkIGJhY2tncm91bmQgaW4gYWxsIGxlZnQgIG1lbnUgIGl0ZW1zIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRqUXVlcnkoICcud3BiY191aV9lbF9fdmVydF9uYXZfaXRlbSAnICkucmVtb3ZlQ2xhc3MoICdhY3RpdmUnICk7XHJcblx0XHRcdC8vIFNldCBsZWZ0IG1lbnUgc2VsZWN0ZWQuXHJcblx0XHRcdGpRdWVyeSggJy5kb19leHBhbmRfXycgKyBzZWN0aW9uX3RvX3Nob3cgKyAnX2xpbmsnICkuYWRkQ2xhc3MoICdhY3RpdmUnICk7XHJcblx0XHRcdHZhciBzZWxlY3RlZF90aXRsZSA9IGpRdWVyeSggJy5kb19leHBhbmRfXycgKyBzZWN0aW9uX3RvX3Nob3cgKyAnX2xpbmsgYSAud3BiY191aV9lbF9fdmVydF9uYXZfdGl0bGUgJyApLnRleHQoKTtcclxuXHJcblx0XHRcdC8vIEV4cGFuZCBzZWN0aW9uLCBpZiBpdCBjb2xhcHNlZC5cclxuXHRcdFx0aWYgKCAhIGpRdWVyeSggJy5kb19leHBhbmRfXycgKyBzZWN0aW9uX3RvX3Nob3cgKyAnX2xpbmsnICkucGFyZW50cyggJy53cGJjX3VpX2VsX19sZXZlbF9fZm9sZGVyJyApLmhhc0NsYXNzKCAnZXhwYW5kZWQnICkgKSB7XHJcblx0XHRcdFx0alF1ZXJ5KCAnLndwYmNfdWlfZWxfX2xldmVsX19mb2xkZXInICkucmVtb3ZlQ2xhc3MoICdleHBhbmRlZCcgKTtcclxuXHRcdFx0XHRqUXVlcnkoICcuZG9fZXhwYW5kX18nICsgc2VjdGlvbl90b19zaG93ICsgJ19saW5rJyApLnBhcmVudHMoICcud3BiY191aV9lbF9fbGV2ZWxfX2ZvbGRlcicgKS5hZGRDbGFzcyggJ2V4cGFuZGVkJyApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyAtLSBFeHBhbmQgc2VjdGlvbiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0dmFyIGNvbnRhaW5lcl90b19oaWRlX2NsYXNzID0gJy5wb3N0Ym94JztcclxuXHRcdFx0Ly8gSGlkZSBzZWN0aW9ucyAnLnBvc3Rib3gnIGluIGFkbWluIHBhZ2UgYW5kIHNob3cgc3BlY2lmaWMgb25lLlxyXG5cdFx0XHRqUXVlcnkoICcud3BiY19hZG1pbl9wYWdlICcgKyBjb250YWluZXJfdG9faGlkZV9jbGFzcyApLmhpZGUoKTtcclxuXHRcdFx0alF1ZXJ5KCAnLndwYmNfY29udGFpbmVyX2Fsd2F5c19oaWRlX19vbl9sZWZ0X25hdl9jbGljaycgKS5oaWRlKCk7XHJcblx0XHRcdGpRdWVyeSggc2VjdGlvbl9pZF90b19zaG93ICkuc2hvdygpO1xyXG5cclxuXHRcdFx0Ly8gU2hvdyBhbGwgb3RoZXIgc2VjdGlvbnMsICBpZiBwcm92aWRlZCBpbiBVUkw6IC4uP3BhZ2U9d3BiYy1zZXR0aW5ncyNkb19leHBhbmRfX3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYXBhY2l0eV9tZXRhYm94I3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYXBhY2l0eV91cGdyYWRlX21ldGFib3ggLlxyXG5cdFx0XHRmb3IgKCBsZXQgaSA9IDE7IGkgPCBhbmNob3JzX2Fycl9sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHRqUXVlcnkoICcjJyArIGFuY2hvcnNfYXJyW2ldICkuc2hvdygpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIGZhbHNlICkge1xyXG5cdFx0XHRcdHZhciB0YXJnZXRPZmZzZXQgPSB3cGJjX3Njcm9sbF90byggc2VjdGlvbl9pZF90b19zaG93ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIC0tIFNldCBWYWx1ZSB0byBJbnB1dCBhYm91dCBzZWxlY3RlZCBOYXYgZWxlbWVudCAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICAgICAgIC8vIEZpeEluOiA5LjguNi4xLlxyXG5cdFx0XHR2YXIgc2VjdGlvbl9pZF90YWIgPSBzZWN0aW9uX2lkX3RvX3Nob3cuc3Vic3RyaW5nKCAwLCBzZWN0aW9uX2lkX3RvX3Nob3cubGVuZ3RoIC0gOCApICsgJ190YWInO1xyXG5cdFx0XHRpZiAoIGNvbnRhaW5lcl90b19oaWRlX2NsYXNzID09IHNlY3Rpb25faWRfdG9fc2hvdyApIHtcclxuXHRcdFx0XHRzZWN0aW9uX2lkX3RhYiA9ICcjd3BiY19nZW5lcmFsX3NldHRpbmdzX2FsbF90YWInXHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCAnI3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYXBhY2l0eV9tZXRhYm94LCN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FwYWNpdHlfdXBncmFkZV9tZXRhYm94JyA9PSBzZWN0aW9uX2lkX3RvX3Nob3cgKSB7XHJcblx0XHRcdFx0c2VjdGlvbl9pZF90YWIgPSAnI3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYXBhY2l0eV90YWInXHJcblx0XHRcdH1cclxuXHRcdFx0alF1ZXJ5KCAnI2Zvcm1fdmlzaWJsZV9zZWN0aW9uJyApLnZhbCggc2VjdGlvbl9pZF90YWIgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBMaWtlIGJsaW5raW5nIHNvbWUgZWxlbWVudHMuXHJcblx0XHR3cGJjX2FkbWluX3VpX19kb19fYW5jaG9yX19hbm90aGVyX2FjdGlvbnMoKTtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX2lzX2luX21vYmlsZV9zY3JlZW5fc2l6ZSgpIHtcclxuXHRyZXR1cm4gd3BiY19hZG1pbl91aV9faXNfaW5fdGhpc19zY3JlZW5fc2l6ZSggNjA1ICk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX2lzX2luX3RoaXNfc2NyZWVuX3NpemUoc2l6ZSkge1xyXG5cdHJldHVybiAod2luZG93LnNjcmVlbi53aWR0aCA8PSBzaXplKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIE9wZW4gc2V0dGluZ3MgcGFnZSAgfCAgRXhwYW5kIHNlY3Rpb24gIHwgIFNlbGVjdCBNZW51IGl0ZW0uXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19kb19fb3Blbl91cmxfX2V4cGFuZF9zZWN0aW9uKHVybCwgc2VjdGlvbl9pZCkge1xyXG5cclxuXHQvLyB3aW5kb3cubG9jYXRpb24uaHJlZiA9IHVybCArICcmZG9fZXhwYW5kPScgKyBzZWN0aW9uX2lkICsgJyNkb19leHBhbmRfXycgKyBzZWN0aW9uX2lkOyAvLy5cclxuXHR3aW5kb3cubG9jYXRpb24uaHJlZiA9IHVybCArICcjZG9fZXhwYW5kX18nICsgc2VjdGlvbl9pZDtcclxuXHJcblx0aWYgKCB3cGJjX2FkbWluX3VpX19pc19pbl9tb2JpbGVfc2NyZWVuX3NpemUoKSApIHtcclxuXHRcdHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fZG9fbWluKCk7XHJcblx0fVxyXG5cclxuXHR3cGJjX2FkbWluX3VpX19kb19leHBhbmRfc2VjdGlvbigpO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIENoZWNrICBmb3IgT3RoZXIgYWN0aW9uczogIExpa2UgYmxpbmtpbmcgc29tZSBlbGVtZW50cyBpbiBzZXR0aW5ncyBwYWdlLiBFLmcuIERheXMgc2VsZWN0aW9uICBvciAgY2hhbmdlLW92ZXIgZGF5cy5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX2RvX19hbmNob3JfX2Fub3RoZXJfYWN0aW9ucygpIHtcclxuXHJcblx0dmFyIGFuY2hvcnNfYXJyICAgICAgICA9IHdwYmNfdXJsX2dldF9hbmNob3JzX2FycigpO1xyXG5cdHZhciBhbmNob3JzX2Fycl9sZW5ndGggPSBhbmNob3JzX2Fyci5sZW5ndGg7XHJcblxyXG5cdC8vIE90aGVyIGFjdGlvbnM6ICBMaWtlIGJsaW5raW5nIHNvbWUgZWxlbWVudHMuXHJcblx0Zm9yICggdmFyIGkgPSAwOyBpIDwgYW5jaG9yc19hcnJfbGVuZ3RoOyBpKysgKSB7XHJcblxyXG5cdFx0dmFyIHRoaXNfYW5jaG9yID0gYW5jaG9yc19hcnJbaV07XHJcblxyXG5cdFx0dmFyIHRoaXNfYW5jaG9yX3Byb3BfdmFsdWUgPSB0aGlzX2FuY2hvci5zcGxpdCggJ2RvX290aGVyX2FjdGlvbnNfXycgKTtcclxuXHJcblx0XHRpZiAoIHRoaXNfYW5jaG9yX3Byb3BfdmFsdWUubGVuZ3RoID4gMSApIHtcclxuXHJcblx0XHRcdHZhciBzZWN0aW9uX2FjdGlvbiA9IHRoaXNfYW5jaG9yX3Byb3BfdmFsdWVbMV07XHJcblxyXG5cdFx0XHRzd2l0Y2ggKCBzZWN0aW9uX2FjdGlvbiApIHtcclxuXHJcblx0XHRcdFx0Y2FzZSAnYmxpbmtfZGF5X3NlbGVjdGlvbnMnOlxyXG5cdFx0XHRcdFx0Ly8gd3BiY191aV9zZXR0aW5nc19fcGFuZWxfX2NsaWNrKCAnI3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYWxlbmRhcl90YWIgYScsICcjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhbGVuZGFyX21ldGFib3gnLCAnRGF5cyBTZWxlY3Rpb24nICk7LlxyXG5cdFx0XHRcdFx0d3BiY19ibGlua19lbGVtZW50KCAnLndwYmNfdHJfc2V0X2dlbl9ib29raW5nX3R5cGVfb2ZfZGF5X3NlbGVjdGlvbnMnLCA0LCAzNTAgKTtcclxuXHRcdFx0XHRcdFx0d3BiY19zY3JvbGxfdG8oICcud3BiY190cl9zZXRfZ2VuX2Jvb2tpbmdfdHlwZV9vZl9kYXlfc2VsZWN0aW9ucycgKTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRjYXNlICdibGlua19jaGFuZ2Vfb3Zlcl9kYXlzJzpcclxuXHRcdFx0XHRcdC8vIHdwYmNfdWlfc2V0dGluZ3NfX3BhbmVsX19jbGljayggJyN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FsZW5kYXJfdGFiIGEnLCAnI3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYWxlbmRhcl9tZXRhYm94JywgJ0NoYW5nZW92ZXIgRGF5cycgKTsuXHJcblx0XHRcdFx0XHR3cGJjX2JsaW5rX2VsZW1lbnQoICcud3BiY190cl9zZXRfZ2VuX2Jvb2tpbmdfcmFuZ2Vfc2VsZWN0aW9uX3RpbWVfaXNfYWN0aXZlJywgNCwgMzUwICk7XHJcblx0XHRcdFx0XHRcdHdwYmNfc2Nyb2xsX3RvKCAnLndwYmNfdHJfc2V0X2dlbl9ib29raW5nX3JhbmdlX3NlbGVjdGlvbl90aW1lX2lzX2FjdGl2ZScgKTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRjYXNlICdibGlua19jYXB0Y2hhJzpcclxuXHRcdFx0XHRcdHdwYmNfYmxpbmtfZWxlbWVudCggJy53cGJjX3RyX3NldF9nZW5fYm9va2luZ19pc191c2VfY2FwdGNoYScsIDQsIDM1MCApO1xyXG5cdFx0XHRcdFx0XHR3cGJjX3Njcm9sbF90byggJy53cGJjX3RyX3NldF9nZW5fYm9va2luZ19pc191c2VfY2FwdGNoYScgKTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG59XHJcbiIsIi8qKlxyXG4gKiBDb3B5IHR4dCB0byBjbGlwYnJkIGZyb20gVGV4dCBmaWVsZHMuXHJcbiAqXHJcbiAqIEBwYXJhbSBodG1sX2VsZW1lbnRfaWQgIC0gZS5nLiAnZGF0YV9maWVsZCdcclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NvcHlfdGV4dF90b19jbGlwYnJkX2Zyb21fZWxlbWVudCggaHRtbF9lbGVtZW50X2lkICkge1xyXG5cdC8vIEdldCB0aGUgdGV4dCBmaWVsZC5cclxuXHR2YXIgY29weVRleHQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggaHRtbF9lbGVtZW50X2lkICk7XHJcblxyXG5cdC8vIFNlbGVjdCB0aGUgdGV4dCBmaWVsZC5cclxuXHRjb3B5VGV4dC5zZWxlY3QoKTtcclxuXHRjb3B5VGV4dC5zZXRTZWxlY3Rpb25SYW5nZSggMCwgOTk5OTkgKTsgLy8gRm9yIG1vYmlsZSBkZXZpY2VzLlxyXG5cclxuXHQvLyBDb3B5IHRoZSB0ZXh0IGluc2lkZSB0aGUgdGV4dCBmaWVsZC5cclxuXHR2YXIgaXNfY29waWVkID0gd3BiY19jb3B5X3RleHRfdG9fY2xpcGJyZCggY29weVRleHQudmFsdWUgKTtcclxuXHRpZiAoICEgaXNfY29waWVkICkge1xyXG5cdFx0Y29uc29sZS5lcnJvciggJ09vcHMsIHVuYWJsZSB0byBjb3B5JywgY29weVRleHQudmFsdWUgKTtcclxuXHR9XHJcblx0cmV0dXJuIGlzX2NvcGllZDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvcHkgdHh0IHRvIGNsaXBicmQuXHJcbiAqXHJcbiAqIEBwYXJhbSB0ZXh0XHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jb3B5X3RleHRfdG9fY2xpcGJyZCh0ZXh0KSB7XHJcblxyXG5cdGlmICggISBuYXZpZ2F0b3IuY2xpcGJvYXJkICkge1xyXG5cdFx0cmV0dXJuIHdwYmNfZmFsbGJhY2tfY29weV90ZXh0X3RvX2NsaXBicmQoIHRleHQgKTtcclxuXHR9XHJcblxyXG5cdG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KCB0ZXh0ICkudGhlbihcclxuXHRcdGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0Ly8gY29uc29sZS5sb2coICdBc3luYzogQ29weWluZyB0byBjbGlwYm9hcmQgd2FzIHN1Y2Nlc3NmdWwhJyApOy5cclxuXHRcdFx0cmV0dXJuICB0cnVlO1xyXG5cdFx0fSxcclxuXHRcdGZ1bmN0aW9uIChlcnIpIHtcclxuXHRcdFx0Ly8gY29uc29sZS5lcnJvciggJ0FzeW5jOiBDb3VsZCBub3QgY29weSB0ZXh0OiAnLCBlcnIgKTsuXHJcblx0XHRcdHJldHVybiAgZmFsc2U7XHJcblx0XHR9XHJcblx0KTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvcHkgdHh0IHRvIGNsaXBicmQgLSBkZXByaWNhdGVkIG1ldGhvZC5cclxuICpcclxuICogQHBhcmFtIHRleHRcclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2ZhbGxiYWNrX2NvcHlfdGV4dF90b19jbGlwYnJkKCB0ZXh0ICkge1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIHZhciB0ZXh0QXJlYSAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggXCJ0ZXh0YXJlYVwiICk7XHJcblx0Ly8gdGV4dEFyZWEudmFsdWUgPSB0ZXh0O1xyXG5cdC8vXHJcblx0Ly8gLy8gQXZvaWQgc2Nyb2xsaW5nIHRvIGJvdHRvbS5cclxuXHQvLyB0ZXh0QXJlYS5zdHlsZS50b3AgICAgICA9IFwiMFwiO1xyXG5cdC8vIHRleHRBcmVhLnN0eWxlLmxlZnQgICAgID0gXCIwXCI7XHJcblx0Ly8gdGV4dEFyZWEuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCI7XHJcblx0Ly8gdGV4dEFyZWEuc3R5bGUuekluZGV4ICAgPSBcIjk5OTk5OTk5OVwiO1xyXG5cdC8vIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIHRleHRBcmVhICk7XHJcblx0Ly8gdGV4dEFyZWEuZm9jdXMoKTtcclxuXHQvLyB0ZXh0QXJlYS5zZWxlY3QoKTtcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBOb3cgZ2V0IGl0IGFzIEhUTUwgIChvcmlnaW5hbCBoZXJlIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzM0MTkxNzgwL2phdmFzY3JpcHQtY29weS1zdHJpbmctdG8tY2xpcGJvYXJkLWFzLXRleHQtaHRtbCApLlxyXG5cclxuXHQvLyBbMV0gLSBDcmVhdGUgY29udGFpbmVyIGZvciB0aGUgSFRNTC5cclxuXHR2YXIgY29udGFpbmVyICAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRjb250YWluZXIuaW5uZXJIVE1MID0gdGV4dDtcclxuXHJcblx0Ly8gWzJdIC0gSGlkZSBlbGVtZW50LlxyXG5cdGNvbnRhaW5lci5zdHlsZS5wb3NpdGlvbiAgICAgID0gJ2ZpeGVkJztcclxuXHRjb250YWluZXIuc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcclxuXHRjb250YWluZXIuc3R5bGUub3BhY2l0eSAgICAgICA9IDA7XHJcblxyXG5cdC8vIERldGVjdCBhbGwgc3R5bGUgc2hlZXRzIG9mIHRoZSBwYWdlLlxyXG5cdHZhciBhY3RpdmVTaGVldHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggZG9jdW1lbnQuc3R5bGVTaGVldHMgKS5maWx0ZXIoXHJcblx0XHRmdW5jdGlvbiAoc2hlZXQpIHtcclxuXHRcdFx0cmV0dXJuICEgc2hlZXQuZGlzYWJsZWQ7XHJcblx0XHR9XHJcblx0KTtcclxuXHJcblx0Ly8gWzNdIC0gTW91bnQgdGhlIGNvbnRhaW5lciB0byB0aGUgRE9NIHRvIG1ha2UgYGNvbnRlbnRXaW5kb3dgIGF2YWlsYWJsZS5cclxuXHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCBjb250YWluZXIgKTtcclxuXHJcblx0Ly8gWzRdIC0gQ29weSB0byBjbGlwYm9hcmQuXHJcblx0d2luZG93LmdldFNlbGVjdGlvbigpLnJlbW92ZUFsbFJhbmdlcygpO1xyXG5cclxuXHR2YXIgcmFuZ2UgPSBkb2N1bWVudC5jcmVhdGVSYW5nZSgpO1xyXG5cdHJhbmdlLnNlbGVjdE5vZGUoIGNvbnRhaW5lciApO1xyXG5cdHdpbmRvdy5nZXRTZWxlY3Rpb24oKS5hZGRSYW5nZSggcmFuZ2UgKTtcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHR2YXIgcmVzdWx0ID0gZmFsc2U7XHJcblxyXG5cdHRyeSB7XHJcblx0XHRyZXN1bHQgPSBkb2N1bWVudC5leGVjQ29tbWFuZCggJ2NvcHknICk7XHJcblx0XHQvLyBjb25zb2xlLmxvZyggJ0ZhbGxiYWNrOiBDb3B5aW5nIHRleHQgY29tbWFuZCB3YXMgJyArIG1zZyApOyAvLy5cclxuXHR9IGNhdGNoICggZXJyICkge1xyXG5cdFx0Ly8gY29uc29sZS5lcnJvciggJ0ZhbGxiYWNrOiBPb3BzLCB1bmFibGUgdG8gY29weScsIGVyciApOyAvLy5cclxuXHR9XHJcblx0Ly8gZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCggdGV4dEFyZWEgKTsgLy8uXHJcblxyXG5cdC8vIFs1LjRdIC0gRW5hYmxlIENTUy5cclxuXHR2YXIgYWN0aXZlU2hlZXRzX2xlbmd0aCA9IGFjdGl2ZVNoZWV0cy5sZW5ndGg7XHJcblx0Zm9yICggdmFyIGkgPSAwOyBpIDwgYWN0aXZlU2hlZXRzX2xlbmd0aDsgaSsrICkge1xyXG5cdFx0YWN0aXZlU2hlZXRzW2ldLmRpc2FibGVkID0gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvLyBbNl0gLSBSZW1vdmUgdGhlIGNvbnRhaW5lclxyXG5cdGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoIGNvbnRhaW5lciApO1xyXG5cclxuXHRyZXR1cm4gIHJlc3VsdDtcclxufSIsIi8qKlxyXG4gKiBXUEJDIENvbGxhcHNpYmxlIEdyb3Vwc1xyXG4gKlxyXG4gKiBVbml2ZXJzYWwsIGRlcGVuZGVuY3ktZnJlZSBjb250cm9sbGVyIGZvciBleHBhbmRpbmcvY29sbGFwc2luZyBncm91cGVkIHNlY3Rpb25zIGluIHJpZ2h0LXNpZGUgcGFuZWxzIChJbnNwZWN0b3IvTGlicmFyeS9Gb3JtIFNldHRpbmdzLCBvciBhbnkgb3RoZXIgV1BCQyBwYWdlKS5cclxuICpcclxuICogXHRcdD09PSBIb3cgdG8gdXNlIGl0IChxdWljaykgPyA9PT1cclxuICpcclxuICpcdFx0LS0gMS4gTWFya3VwIChpbmRlcGVuZGVudCBtb2RlOiBtdWx0aXBsZSBvcGVuIGFsbG93ZWQpIC0tXHJcbiAqXHRcdFx0PGRpdiBjbGFzcz1cIndwYmNfY29sbGFwc2libGVcIj5cclxuICpcdFx0XHQgIDxzZWN0aW9uIGNsYXNzPVwid3BiY191aV9fY29sbGFwc2libGVfZ3JvdXAgaXMtb3BlblwiPlxyXG4gKlx0XHRcdFx0PGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJncm91cF9faGVhZGVyXCI+PGgzPkdlbmVyYWw8L2gzPjwvYnV0dG9uPlxyXG4gKlx0XHRcdFx0PGRpdiBjbGFzcz1cImdyb3VwX19maWVsZHNcIj7igKY8L2Rpdj5cclxuICpcdFx0XHQgIDwvc2VjdGlvbj5cclxuICpcdFx0XHQgIDxzZWN0aW9uIGNsYXNzPVwid3BiY191aV9fY29sbGFwc2libGVfZ3JvdXBcIj5cclxuICpcdFx0XHRcdDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiZ3JvdXBfX2hlYWRlclwiPjxoMz5BZHZhbmNlZDwvaDM+PC9idXR0b24+XHJcbiAqXHRcdFx0XHQ8ZGl2IGNsYXNzPVwiZ3JvdXBfX2ZpZWxkc1wiPuKApjwvZGl2PlxyXG4gKlx0XHRcdCAgPC9zZWN0aW9uPlxyXG4gKlx0XHRcdDwvZGl2PlxyXG4gKlxyXG4gKlx0XHQtLSAyLiBFeGNsdXNpdmUvYWNjb3JkaW9uIG1vZGUgKG9uZSBvcGVuIGF0IGEgdGltZSkgLS1cclxuICpcdFx0XHQ8ZGl2IGNsYXNzPVwid3BiY19jb2xsYXBzaWJsZSB3cGJjX2NvbGxhcHNpYmxlLS1leGNsdXNpdmVcIj7igKY8L2Rpdj5cclxuICpcclxuICpcdFx0LS0gMy4gQXV0by1pbml0IC0tXHJcbiAqXHRcdFx0VGhlIHNjcmlwdCBhdXRvLWluaXRpYWxpemVzIG9uIERPTUNvbnRlbnRMb2FkZWQuIE5vIGV4dHJhIGNvZGUgbmVlZGVkLlxyXG4gKlxyXG4gKlx0XHQtLSA0LiBQcm9ncmFtbWF0aWMgY29udHJvbCAob3B0aW9uYWwpXHJcbiAqXHRcdFx0Y29uc3Qgcm9vdCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyN3cGJjX2JmYl9faW5zcGVjdG9yJyk7XHJcbiAqXHRcdFx0Y29uc3QgYXBpICA9IHJvb3QuX193cGJjX2NvbGxhcHNpYmxlX2luc3RhbmNlOyAvLyBzZXQgYnkgYXV0by1pbml0XHJcbiAqXHJcbiAqXHRcdFx0YXBpLm9wZW5fYnlfaGVhZGluZygnVmFsaWRhdGlvbicpOyAvLyBvcGVuIGJ5IGhlYWRpbmcgdGV4dFxyXG4gKlx0XHRcdGFwaS5vcGVuX2J5X2luZGV4KDApOyAgICAgICAgICAgICAgLy8gb3BlbiB0aGUgZmlyc3QgZ3JvdXBcclxuICpcclxuICpcdFx0LS0gNS5MaXN0ZW4gdG8gZXZlbnRzIChlLmcuLCB0byBwZXJzaXN0IOKAnG9wZW4gZ3JvdXDigJ0gc3RhdGUpIC0tXHJcbiAqXHRcdFx0cm9vdC5hZGRFdmVudExpc3RlbmVyKCd3cGJjOmNvbGxhcHNpYmxlOm9wZW4nLCAgKGUpID0+IHsgY29uc29sZS5sb2coICBlLmRldGFpbC5ncm91cCApOyB9KTtcclxuICpcdFx0XHRyb290LmFkZEV2ZW50TGlzdGVuZXIoJ3dwYmM6Y29sbGFwc2libGU6Y2xvc2UnLCAoZSkgPT4geyBjb25zb2xlLmxvZyggIGUuZGV0YWlsLmdyb3VwICk7IH0pO1xyXG4gKlxyXG4gKlxyXG4gKlxyXG4gKiBNYXJrdXAgZXhwZWN0YXRpb25zIChtaW5pbWFsKTpcclxuICogIDxkaXYgY2xhc3M9XCJ3cGJjX2NvbGxhcHNpYmxlIFt3cGJjX2NvbGxhcHNpYmxlLS1leGNsdXNpdmVdXCI+XHJcbiAqICAgIDxzZWN0aW9uIGNsYXNzPVwid3BiY191aV9fY29sbGFwc2libGVfZ3JvdXAgW2lzLW9wZW5dXCI+XHJcbiAqICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJncm91cF9faGVhZGVyXCI+IC4uLiA8L2J1dHRvbj5cclxuICogICAgICA8ZGl2IGNsYXNzPVwiZ3JvdXBfX2ZpZWxkc1wiPiAuLi4gPC9kaXY+XHJcbiAqICAgIDwvc2VjdGlvbj5cclxuICogICAgLi4uIG1vcmUgPHNlY3Rpb24+IC4uLlxyXG4gKiAgPC9kaXY+XHJcbiAqXHJcbiAqIE5vdGVzOlxyXG4gKiAgLSBBZGQgYGlzLW9wZW5gIHRvIGFueSBzZWN0aW9uIHlvdSB3YW50IGluaXRpYWxseSBleHBhbmRlZC5cclxuICogIC0gQWRkIGB3cGJjX2NvbGxhcHNpYmxlLS1leGNsdXNpdmVgIHRvIHRoZSBjb250YWluZXIgZm9yIFwib3BlbiBvbmUgYXQgYSB0aW1lXCIgYmVoYXZpb3IuXHJcbiAqICAtIFdvcmtzIHdpdGggeW91ciBleGlzdGluZyBCRkIgbWFya3VwIChjbGFzc2VzIHVzZWQgdGhlcmUgYXJlIHRoZSBkZWZhdWx0cykuXHJcbiAqXHJcbiAqIEFjY2Vzc2liaWxpdHk6XHJcbiAqICAtIFNldHMgYXJpYS1leHBhbmRlZCBvbiAuZ3JvdXBfX2hlYWRlclxyXG4gKiAgLSBTZXRzIGFyaWEtaGlkZGVuICsgW2hpZGRlbl0gb24gLmdyb3VwX19maWVsZHNcclxuICogIC0gQXJyb3dVcC9BcnJvd0Rvd24gbW92ZSBmb2N1cyBiZXR3ZWVuIGhlYWRlcnM7IEVudGVyL1NwYWNlIHRvZ2dsZXNcclxuICpcclxuICogRXZlbnRzIChidWJibGVzIGZyb20gdGhlIDxzZWN0aW9uPik6XHJcbiAqICAtICd3cGJjOmNvbGxhcHNpYmxlOm9wZW4nICAoZGV0YWlsOiB7IGdyb3VwLCByb290LCBpbnN0YW5jZSB9KVxyXG4gKiAgLSAnd3BiYzpjb2xsYXBzaWJsZTpjbG9zZScgKGRldGFpbDogeyBncm91cCwgcm9vdCwgaW5zdGFuY2UgfSlcclxuICpcclxuICogUHVibGljIEFQSSAoaW5zdGFuY2UgbWV0aG9kcyk6XHJcbiAqICAtIGluaXQoKSwgZGVzdHJveSgpLCByZWZyZXNoKClcclxuICogIC0gZXhwYW5kKGdyb3VwLCBbZXhjbHVzaXZlXSksIGNvbGxhcHNlKGdyb3VwKSwgdG9nZ2xlKGdyb3VwKVxyXG4gKiAgLSBvcGVuX2J5X2luZGV4KGluZGV4KSwgb3Blbl9ieV9oZWFkaW5nKHRleHQpXHJcbiAqICAtIGlzX2V4Y2x1c2l2ZSgpLCBpc19vcGVuKGdyb3VwKVxyXG4gKlxyXG4gKiBAdmVyc2lvbiAyMDI1LTA4LTI2XHJcbiAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcbiAqL1xyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gPT0gRmlsZSAgL2NvbGxhcHNpYmxlX2dyb3Vwcy5qcyA9PSBUaW1lIHBvaW50OiAyMDI1LTA4LTI2IDE0OjEzXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4oZnVuY3Rpb24gKHcsIGQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdGNsYXNzIFdQQkNfQ29sbGFwc2libGVfR3JvdXBzIHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENyZWF0ZSBhIGNvbGxhcHNpYmxlIGNvbnRyb2xsZXIgZm9yIGEgY29udGFpbmVyLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8c3RyaW5nfSByb290X2VsXHJcblx0XHQgKiAgICAgICAgVGhlIGNvbnRhaW5lciBlbGVtZW50IChvciBDU1Mgc2VsZWN0b3IpIHRoYXQgd3JhcHMgY29sbGFwc2libGUgZ3JvdXBzLlxyXG5cdFx0ICogICAgICAgIFRoZSBjb250YWluZXIgdXN1YWxseSBoYXMgdGhlIGNsYXNzIGAud3BiY19jb2xsYXBzaWJsZWAuXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gW29wdHM9e31dXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gIFtvcHRzLmdyb3VwX3NlbGVjdG9yPScud3BiY191aV9fY29sbGFwc2libGVfZ3JvdXAnXVxyXG5cdFx0ICogICAgICAgIFNlbGVjdG9yIGZvciBlYWNoIGNvbGxhcHNpYmxlIGdyb3VwIGluc2lkZSB0aGUgY29udGFpbmVyLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICBbb3B0cy5oZWFkZXJfc2VsZWN0b3I9Jy5ncm91cF9faGVhZGVyJ11cclxuXHRcdCAqICAgICAgICBTZWxlY3RvciBmb3IgdGhlIGNsaWNrYWJsZSBoZWFkZXIgaW5zaWRlIGEgZ3JvdXAuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gIFtvcHRzLmZpZWxkc19zZWxlY3Rvcj0nLmdyb3VwX19maWVsZHMnXVxyXG5cdFx0ICogICAgICAgIFNlbGVjdG9yIGZvciB0aGUgY29udGVudC9wYW5lbCBlbGVtZW50IGluc2lkZSBhIGdyb3VwLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICBbb3B0cy5vcGVuX2NsYXNzPSdpcy1vcGVuJ11cclxuXHRcdCAqICAgICAgICBDbGFzcyBuYW1lIHRoYXQgaW5kaWNhdGVzIHRoZSBncm91cCBpcyBvcGVuLlxyXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBbb3B0cy5leGNsdXNpdmU9ZmFsc2VdXHJcblx0XHQgKiAgICAgICAgSWYgdHJ1ZSwgb25seSBvbmUgZ3JvdXAgY2FuIGJlIG9wZW4gYXQgYSB0aW1lIGluIHRoaXMgY29udGFpbmVyLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBjb25zdHJ1Y3RvclxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0Y29uc3RydWN0b3Iocm9vdF9lbCwgb3B0cyA9IHt9KSB7XHJcblx0XHRcdHRoaXMucm9vdCA9ICh0eXBlb2Ygcm9vdF9lbCA9PT0gJ3N0cmluZycpID8gZC5xdWVyeVNlbGVjdG9yKCByb290X2VsICkgOiByb290X2VsO1xyXG5cdFx0XHR0aGlzLm9wdHMgPSBPYmplY3QuYXNzaWduKCB7XHJcblx0XHRcdFx0Z3JvdXBfc2VsZWN0b3IgOiAnLndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwJyxcclxuXHRcdFx0XHRoZWFkZXJfc2VsZWN0b3I6ICcuZ3JvdXBfX2hlYWRlcicsXHJcblx0XHRcdFx0ZmllbGRzX3NlbGVjdG9yOiAnLmdyb3VwX19maWVsZHMsLmdyb3VwX19jb250ZW50JyxcclxuXHRcdFx0XHRvcGVuX2NsYXNzICAgICA6ICdpcy1vcGVuJyxcclxuXHRcdFx0XHRleGNsdXNpdmUgICAgICA6IGZhbHNlXHJcblx0XHRcdH0sIG9wdHMgKTtcclxuXHJcblx0XHRcdC8vIEJvdW5kIGhhbmRsZXJzIChmb3IgYWRkL3JlbW92ZUV2ZW50TGlzdGVuZXIgc3ltbWV0cnkpLlxyXG5cdFx0XHQvKiogQHByaXZhdGUgKi9cclxuXHRcdFx0dGhpcy5fb25fY2xpY2sgPSB0aGlzLl9vbl9jbGljay5iaW5kKCB0aGlzICk7XHJcblx0XHRcdC8qKiBAcHJpdmF0ZSAqL1xyXG5cdFx0XHR0aGlzLl9vbl9rZXlkb3duID0gdGhpcy5fb25fa2V5ZG93bi5iaW5kKCB0aGlzICk7XHJcblxyXG5cdFx0XHQvKiogQHR5cGUge0hUTUxFbGVtZW50W119IEBwcml2YXRlICovXHJcblx0XHRcdHRoaXMuX2dyb3VwcyA9IFtdO1xyXG5cdFx0XHQvKiogQHR5cGUge011dGF0aW9uT2JzZXJ2ZXJ8bnVsbH0gQHByaXZhdGUgKi9cclxuXHRcdFx0dGhpcy5fb2JzZXJ2ZXIgPSBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSW5pdGlhbGl6ZSB0aGUgY29udHJvbGxlcjogY2FjaGUgZ3JvdXBzLCBhdHRhY2ggbGlzdGVuZXJzLCBzZXQgQVJJQSxcclxuXHRcdCAqIGFuZCBzdGFydCBvYnNlcnZpbmcgRE9NIGNoYW5nZXMgaW5zaWRlIHRoZSBjb250YWluZXIuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge1dQQkNfQ29sbGFwc2libGVfR3JvdXBzfSBUaGUgaW5zdGFuY2UgKGNoYWluYWJsZSkuXHJcblx0XHQgKiBAbGlzdGVucyBjbGlja1xyXG5cdFx0ICogQGxpc3RlbnMga2V5ZG93blxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0aW5pdCgpIHtcclxuXHRcdFx0aWYgKCAhdGhpcy5yb290ICkge1xyXG5cdFx0XHRcdHJldHVybiB0aGlzO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMuX2dyb3VwcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKFxyXG5cdFx0XHRcdHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yQWxsKCB0aGlzLm9wdHMuZ3JvdXBfc2VsZWN0b3IgKVxyXG5cdFx0XHQpO1xyXG5cdFx0XHR0aGlzLnJvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgdGhpcy5fb25fY2xpY2ssIGZhbHNlICk7XHJcblx0XHRcdHRoaXMucm9vdC5hZGRFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIHRoaXMuX29uX2tleWRvd24sIGZhbHNlICk7XHJcblxyXG5cdFx0XHQvLyBPYnNlcnZlIGR5bmFtaWMgaW5zZXJ0cy9yZW1vdmFscyAoSW5zcGVjdG9yIHJlLXJlbmRlcnMpLlxyXG5cdFx0XHR0aGlzLl9vYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCAoKSA9PiB7XHJcblx0XHRcdFx0dGhpcy5yZWZyZXNoKCk7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0dGhpcy5fb2JzZXJ2ZXIub2JzZXJ2ZSggdGhpcy5yb290LCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9ICk7XHJcblxyXG5cdFx0XHR0aGlzLl9zeW5jX2FsbF9hcmlhKCk7XHJcblx0XHRcdHJldHVybiB0aGlzO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVGVhciBkb3duIHRoZSBjb250cm9sbGVyOiBkZXRhY2ggbGlzdGVuZXJzLCBzdG9wIHRoZSBvYnNlcnZlcixcclxuXHRcdCAqIGFuZCBkcm9wIGludGVybmFsIHJlZmVyZW5jZXMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKiBAc2luY2UgMjAyNS0wOC0yNlxyXG5cdFx0ICovXHJcblx0XHRkZXN0cm95KCkge1xyXG5cdFx0XHRpZiAoICF0aGlzLnJvb3QgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMucm9vdC5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2xpY2snLCB0aGlzLl9vbl9jbGljaywgZmFsc2UgKTtcclxuXHRcdFx0dGhpcy5yb290LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgdGhpcy5fb25fa2V5ZG93biwgZmFsc2UgKTtcclxuXHRcdFx0aWYgKCB0aGlzLl9vYnNlcnZlciApIHtcclxuXHRcdFx0XHR0aGlzLl9vYnNlcnZlci5kaXNjb25uZWN0KCk7XHJcblx0XHRcdFx0dGhpcy5fb2JzZXJ2ZXIgPSBudWxsO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMuX2dyb3VwcyA9IFtdO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmUtc2NhbiB0aGUgRE9NIGZvciBjdXJyZW50IGdyb3VwcyBhbmQgcmUtYXBwbHkgQVJJQSB0byBhbGwgb2YgdGhlbS5cclxuXHRcdCAqIFVzZWZ1bCBhZnRlciBkeW5hbWljIChyZSlyZW5kZXJzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0cmVmcmVzaCgpIHtcclxuXHRcdFx0aWYgKCAhdGhpcy5yb290ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLl9ncm91cHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChcclxuXHRcdFx0XHR0aGlzLnJvb3QucXVlcnlTZWxlY3RvckFsbCggdGhpcy5vcHRzLmdyb3VwX3NlbGVjdG9yIClcclxuXHRcdFx0KTtcclxuXHRcdFx0dGhpcy5fc3luY19hbGxfYXJpYSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2hlY2sgd2hldGhlciB0aGUgY29udGFpbmVyIGlzIGluIGV4Y2x1c2l2ZSAoYWNjb3JkaW9uKSBtb2RlLlxyXG5cdFx0ICpcclxuXHRcdCAqIE9yZGVyIG9mIHByZWNlZGVuY2U6XHJcblx0XHQgKiAgMSkgRXhwbGljaXQgb3B0aW9uIGBvcHRzLmV4Y2x1c2l2ZWBcclxuXHRcdCAqICAyKSBDb250YWluZXIgaGFzIGNsYXNzIGAud3BiY19jb2xsYXBzaWJsZS0tZXhjbHVzaXZlYFxyXG5cdFx0ICogIDMpIENvbnRhaW5lciBtYXRjaGVzIGBbZGF0YS13cGJjLWFjY29yZGlvbj1cImV4Y2x1c2l2ZVwiXWBcclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBleGNsdXNpdmUgbW9kZSBpcyBhY3RpdmUuXHJcblx0XHQgKiBAc2luY2UgMjAyNS0wOC0yNlxyXG5cdFx0ICovXHJcblx0XHRpc19leGNsdXNpdmUoKSB7XHJcblx0XHRcdHJldHVybiAhIShcclxuXHRcdFx0XHR0aGlzLm9wdHMuZXhjbHVzaXZlIHx8XHJcblx0XHRcdFx0dGhpcy5yb290LmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfY29sbGFwc2libGUtLWV4Y2x1c2l2ZScgKSB8fFxyXG5cdFx0XHRcdHRoaXMucm9vdC5tYXRjaGVzKCAnW2RhdGEtd3BiYy1hY2NvcmRpb249XCJleGNsdXNpdmVcIl0nIClcclxuXHRcdFx0KTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIERldGVybWluZSB3aGV0aGVyIGEgc3BlY2lmaWMgZ3JvdXAgaXMgb3Blbi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBncm91cCBUaGUgZ3JvdXAgZWxlbWVudCB0byB0ZXN0LlxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGdyb3VwIGlzIGN1cnJlbnRseSBvcGVuLlxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0aXNfb3Blbihncm91cCkge1xyXG5cdFx0XHRyZXR1cm4gZ3JvdXAuY2xhc3NMaXN0LmNvbnRhaW5zKCB0aGlzLm9wdHMub3Blbl9jbGFzcyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogT3BlbiBhIGdyb3VwLiBIb25vcnMgZXhjbHVzaXZlIG1vZGUgYnkgY29sbGFwc2luZyBhbGwgc2libGluZyBncm91cHNcclxuXHRcdCAqIChxdWVyaWVkIGZyb20gdGhlIGxpdmUgRE9NIGF0IGNhbGwtdGltZSkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZ3JvdXAgVGhlIGdyb3VwIGVsZW1lbnQgdG8gb3Blbi5cclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gW2V4Y2x1c2l2ZV1cclxuXHRcdCAqICAgICAgICBJZiBwcm92aWRlZCwgb3ZlcnJpZGVzIGNvbnRhaW5lciBtb2RlIGZvciB0aGlzIGFjdGlvbiBvbmx5LlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKiBAZmlyZXMgQ3VzdG9tRXZlbnQjd3BiYzpjb2xsYXBzaWJsZTpvcGVuXHJcblx0XHQgKiBAc2luY2UgMjAyNS0wOC0yNlxyXG5cdFx0ICovXHJcblx0XHRleHBhbmQoZ3JvdXAsIGV4Y2x1c2l2ZSkge1xyXG5cdFx0XHRpZiAoICFncm91cCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgZG9fZXhjbHVzaXZlID0gKHR5cGVvZiBleGNsdXNpdmUgPT09ICdib29sZWFuJykgPyBleGNsdXNpdmUgOiB0aGlzLmlzX2V4Y2x1c2l2ZSgpO1xyXG5cdFx0XHRpZiAoIGRvX2V4Y2x1c2l2ZSApIHtcclxuXHRcdFx0XHQvLyBBbHdheXMgdXNlIHRoZSBsaXZlIERPTSwgbm90IHRoZSBjYWNoZWQgbGlzdC5cclxuXHRcdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKFxyXG5cdFx0XHRcdFx0dGhpcy5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoIHRoaXMub3B0cy5ncm91cF9zZWxlY3RvciApLFxyXG5cdFx0XHRcdFx0KGcpID0+IHtcclxuXHRcdFx0XHRcdFx0aWYgKCBnICE9PSBncm91cCApIHtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLl9zZXRfb3BlbiggZywgZmFsc2UgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdCk7XHJcblx0XHRcdH1cclxuXHRcdFx0dGhpcy5fc2V0X29wZW4oIGdyb3VwLCB0cnVlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDbG9zZSBhIGdyb3VwLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGdyb3VwIFRoZSBncm91cCBlbGVtZW50IHRvIGNsb3NlLlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKiBAZmlyZXMgQ3VzdG9tRXZlbnQjd3BiYzpjb2xsYXBzaWJsZTpjbG9zZVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0Y29sbGFwc2UoZ3JvdXApIHtcclxuXHRcdFx0aWYgKCAhZ3JvdXAgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMuX3NldF9vcGVuKCBncm91cCwgZmFsc2UgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFRvZ2dsZSBhIGdyb3VwJ3Mgb3Blbi9jbG9zZWQgc3RhdGUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZ3JvdXAgVGhlIGdyb3VwIGVsZW1lbnQgdG8gdG9nZ2xlLlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKiBAc2luY2UgMjAyNS0wOC0yNlxyXG5cdFx0ICovXHJcblx0XHR0b2dnbGUoZ3JvdXApIHtcclxuXHRcdFx0aWYgKCAhZ3JvdXAgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXNbdGhpcy5pc19vcGVuKCBncm91cCApID8gJ2NvbGxhcHNlJyA6ICdleHBhbmQnXSggZ3JvdXAgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE9wZW4gYSBncm91cCBieSBpdHMgaW5kZXggd2l0aGluIHRoZSBjb250YWluZXIgKDAtYmFzZWQpLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCBaZXJvLWJhc2VkIGluZGV4IG9mIHRoZSBncm91cC5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0b3Blbl9ieV9pbmRleChpbmRleCkge1xyXG5cdFx0XHRjb25zdCBncm91cCA9IHRoaXMuX2dyb3Vwc1tpbmRleF07XHJcblx0XHRcdGlmICggZ3JvdXAgKSB7XHJcblx0XHRcdFx0dGhpcy5leHBhbmQoIGdyb3VwICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE9wZW4gYSBncm91cCBieSBtYXRjaGluZyB0ZXh0IGNvbnRhaW5lZCB3aXRoaW4gdGhlIDxoMz4gaW5zaWRlIHRoZSBoZWFkZXIuXHJcblx0XHQgKiBUaGUgY29tcGFyaXNvbiBpcyBjYXNlLWluc2Vuc2l0aXZlIGFuZCBzdWJzdHJpbmctYmFzZWQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHRleHQgVGV4dCB0byBtYXRjaCBhZ2FpbnN0IHRoZSBoZWFkaW5nIGNvbnRlbnRzLlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKiBAc2luY2UgMjAyNS0wOC0yNlxyXG5cdFx0ICovXHJcblx0XHRvcGVuX2J5X2hlYWRpbmcodGV4dCkge1xyXG5cdFx0XHRpZiAoICF0ZXh0ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCB0ICAgICA9IFN0cmluZyggdGV4dCApLnRvTG93ZXJDYXNlKCk7XHJcblx0XHRcdGNvbnN0IG1hdGNoID0gdGhpcy5fZ3JvdXBzLmZpbmQoIChnKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgaCA9IGcucXVlcnlTZWxlY3RvciggdGhpcy5vcHRzLmhlYWRlcl9zZWxlY3RvciArICcgaDMnICk7XHJcblx0XHRcdFx0cmV0dXJuIGggJiYgaC50ZXh0Q29udGVudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoIHQgKSAhPT0gLTE7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0aWYgKCBtYXRjaCApIHtcclxuXHRcdFx0XHR0aGlzLmV4cGFuZCggbWF0Y2ggKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIEludGVybmFsXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEZWxlZ2F0ZWQgY2xpY2sgaGFuZGxlciBmb3IgaGVhZGVycy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHBhcmFtIHtNb3VzZUV2ZW50fSBldiBUaGUgY2xpY2sgZXZlbnQuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdF9vbl9jbGljayhldikge1xyXG5cdFx0XHRjb25zdCBidG4gPSBldi50YXJnZXQuY2xvc2VzdCggdGhpcy5vcHRzLmhlYWRlcl9zZWxlY3RvciApO1xyXG5cdFx0XHRpZiAoICFidG4gfHwgIXRoaXMucm9vdC5jb250YWlucyggYnRuICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGV2LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdGV2LnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cdFx0XHRjb25zdCBncm91cCA9IGJ0bi5jbG9zZXN0KCB0aGlzLm9wdHMuZ3JvdXBfc2VsZWN0b3IgKTtcclxuXHRcdFx0aWYgKCBncm91cCApIHtcclxuXHRcdFx0XHR0aGlzLnRvZ2dsZSggZ3JvdXAgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogS2V5Ym9hcmQgaGFuZGxlciBmb3IgaGVhZGVyIGludGVyYWN0aW9ucyBhbmQgcm92aW5nIGZvY3VzOlxyXG5cdFx0ICogIC0gRW50ZXIvU3BhY2UgdG9nZ2xlcyB0aGUgYWN0aXZlIGdyb3VwLlxyXG5cdFx0ICogIC0gQXJyb3dVcC9BcnJvd0Rvd24gbW92ZXMgZm9jdXMgYmV0d2VlbiBncm91cCBoZWFkZXJzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKiBAcGFyYW0ge0tleWJvYXJkRXZlbnR9IGV2IFRoZSBrZXlib2FyZCBldmVudC5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0X29uX2tleWRvd24oZXYpIHtcclxuXHRcdFx0Y29uc3QgYnRuID0gZXYudGFyZ2V0LmNsb3Nlc3QoIHRoaXMub3B0cy5oZWFkZXJfc2VsZWN0b3IgKTtcclxuXHRcdFx0aWYgKCAhYnRuICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3Qga2V5ID0gZXYua2V5O1xyXG5cclxuXHRcdFx0Ly8gVG9nZ2xlIG9uIEVudGVyIC8gU3BhY2UuXHJcblx0XHRcdGlmICgga2V5ID09PSAnRW50ZXInIHx8IGtleSA9PT0gJyAnICkge1xyXG5cdFx0XHRcdGV2LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0Y29uc3QgZ3JvdXAgPSBidG4uY2xvc2VzdCggdGhpcy5vcHRzLmdyb3VwX3NlbGVjdG9yICk7XHJcblx0XHRcdFx0aWYgKCBncm91cCApIHtcclxuXHRcdFx0XHRcdHRoaXMudG9nZ2xlKCBncm91cCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE1vdmUgZm9jdXMgd2l0aCBBcnJvd1VwL0Fycm93RG93biBiZXR3ZWVuIGhlYWRlcnMgaW4gdGhpcyBjb250YWluZXIuXHJcblx0XHRcdGlmICgga2V5ID09PSAnQXJyb3dVcCcgfHwga2V5ID09PSAnQXJyb3dEb3duJyApIHtcclxuXHRcdFx0XHRldi5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdGNvbnN0IGhlYWRlcnMgPSBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwoXHJcblx0XHRcdFx0XHR0aGlzLnJvb3QucXVlcnlTZWxlY3RvckFsbCggdGhpcy5vcHRzLmdyb3VwX3NlbGVjdG9yICksXHJcblx0XHRcdFx0XHQoZykgPT4gZy5xdWVyeVNlbGVjdG9yKCB0aGlzLm9wdHMuaGVhZGVyX3NlbGVjdG9yIClcclxuXHRcdFx0XHQpLmZpbHRlciggQm9vbGVhbiApO1xyXG5cdFx0XHRcdGNvbnN0IGlkeCAgICAgPSBoZWFkZXJzLmluZGV4T2YoIGJ0biApO1xyXG5cdFx0XHRcdGlmICggaWR4ICE9PSAtMSApIHtcclxuXHRcdFx0XHRcdGNvbnN0IG5leHRfaWR4ID0gKGtleSA9PT0gJ0Fycm93RG93bicpXHJcblx0XHRcdFx0XHRcdD8gTWF0aC5taW4oIGhlYWRlcnMubGVuZ3RoIC0gMSwgaWR4ICsgMSApXHJcblx0XHRcdFx0XHRcdDogTWF0aC5tYXgoIDAsIGlkeCAtIDEgKTtcclxuXHRcdFx0XHRcdGhlYWRlcnNbbmV4dF9pZHhdLmZvY3VzKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBcHBseSBBUklBIHN5bmNocm9uaXphdGlvbiB0byBhbGwga25vd24gZ3JvdXBzIGJhc2VkIG9uIHRoZWlyIG9wZW4gc3RhdGUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0X3N5bmNfYWxsX2FyaWEoKSB7XHJcblx0XHRcdHRoaXMuX2dyb3Vwcy5mb3JFYWNoKCAoZykgPT4gdGhpcy5fc3luY19ncm91cF9hcmlhKCBnICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFN5bmMgQVJJQSBhdHRyaWJ1dGVzIGFuZCB2aXNpYmlsaXR5IG9uIGEgc2luZ2xlIGdyb3VwLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBncm91cCBUaGUgZ3JvdXAgZWxlbWVudCB0byBzeW5jLlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKiBAc2luY2UgMjAyNS0wOC0yNlxyXG5cdFx0ICovXHJcblx0XHRfc3luY19ncm91cF9hcmlhKGdyb3VwKSB7XHJcblx0XHRcdGNvbnN0IGlzX29wZW4gPSB0aGlzLmlzX29wZW4oIGdyb3VwICk7XHJcblx0XHRcdGNvbnN0IGhlYWRlciAgPSBncm91cC5xdWVyeVNlbGVjdG9yKCB0aGlzLm9wdHMuaGVhZGVyX3NlbGVjdG9yICk7XHJcblx0XHRcdC8vIE9ubHkgZGlyZWN0IGNoaWxkcmVuIHRoYXQgbWF0Y2guXHJcblx0XHRcdGNvbnN0IHBhbmVscyA9IEFycmF5LnByb3RvdHlwZS5maWx0ZXIuY2FsbCggZ3JvdXAuY2hpbGRyZW4sIChlbCkgPT4gZWwubWF0Y2hlcyggdGhpcy5vcHRzLmZpZWxkc19zZWxlY3RvciApICk7XHJcblxyXG5cdFx0XHQvLyBIZWFkZXIgQVJJQS5cclxuXHRcdFx0aWYgKCBoZWFkZXIgKSB7XHJcblx0XHRcdFx0aGVhZGVyLnNldEF0dHJpYnV0ZSggJ3JvbGUnLCAnYnV0dG9uJyApO1xyXG5cdFx0XHRcdGhlYWRlci5zZXRBdHRyaWJ1dGUoICdhcmlhLWV4cGFuZGVkJywgaXNfb3BlbiA/ICd0cnVlJyA6ICdmYWxzZScgKTtcclxuXHJcblx0XHRcdFx0aWYgKCBwYW5lbHMubGVuZ3RoICkge1xyXG5cdFx0XHRcdFx0Ly8gRW5zdXJlIGVhY2ggcGFuZWwgaGFzIGFuIGlkOyB0aGVuIHdpcmUgYXJpYS1jb250cm9scyB3aXRoIHNwYWNlLXNlcGFyYXRlZCBpZHMuXHJcblx0XHRcdFx0XHRjb25zdCBpZHMgPSBwYW5lbHMubWFwKCAocCkgPT4ge1xyXG5cdFx0XHRcdFx0XHRpZiAoICFwLmlkICkgcC5pZCA9IHRoaXMuX2dlbmVyYXRlX2lkKCAnd3BiY19jb2xsYXBzaWJsZV9wYW5lbCcgKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHAuaWQ7XHJcblx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHRoZWFkZXIuc2V0QXR0cmlidXRlKCAnYXJpYS1jb250cm9scycsIGlkcy5qb2luKCAnICcgKSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gKDMpIFBhbmVscyBBUklBICsgdmlzaWJpbGl0eS5cclxuXHRcdFx0cGFuZWxzLmZvckVhY2goIChwKSA9PiB7XHJcblx0XHRcdFx0cC5oaWRkZW4gPSAhaXNfb3BlbjsgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWN0dWFsIHZpc2liaWxpdHkuXHJcblx0XHRcdFx0cC5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsIGlzX29wZW4gPyAnZmFsc2UnIDogJ3RydWUnICk7IC8vIEFSSUEuXHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEludGVybmFsIHN0YXRlIGNoYW5nZTogc2V0IGEgZ3JvdXAncyBvcGVuL2Nsb3NlZCBzdGF0ZSwgc3luYyBBUklBLFxyXG5cdFx0ICogbWFuYWdlIGZvY3VzIG9uIGNvbGxhcHNlLCBhbmQgZW1pdCBhIGN1c3RvbSBldmVudC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZ3JvdXAgVGhlIGdyb3VwIGVsZW1lbnQgdG8gbXV0YXRlLlxyXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBvcGVuIFdoZXRoZXIgdGhlIGdyb3VwIHNob3VsZCBiZSBvcGVuLlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKiBAZmlyZXMgQ3VzdG9tRXZlbnQjd3BiYzpjb2xsYXBzaWJsZTpvcGVuXHJcblx0XHQgKiBAZmlyZXMgQ3VzdG9tRXZlbnQjd3BiYzpjb2xsYXBzaWJsZTpjbG9zZVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0X3NldF9vcGVuKGdyb3VwLCBvcGVuKSB7XHJcblx0XHRcdGlmICggIW9wZW4gJiYgZ3JvdXAuY29udGFpbnMoIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgKSApIHtcclxuXHRcdFx0XHRjb25zdCBoZWFkZXIgPSBncm91cC5xdWVyeVNlbGVjdG9yKCB0aGlzLm9wdHMuaGVhZGVyX3NlbGVjdG9yICk7XHJcblx0XHRcdFx0aGVhZGVyICYmIGhlYWRlci5mb2N1cygpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGdyb3VwLmNsYXNzTGlzdC50b2dnbGUoIHRoaXMub3B0cy5vcGVuX2NsYXNzLCBvcGVuICk7XHJcblx0XHRcdHRoaXMuX3N5bmNfZ3JvdXBfYXJpYSggZ3JvdXAgKTtcclxuXHRcdFx0Y29uc3QgZXZfbmFtZSA9IG9wZW4gPyAnd3BiYzpjb2xsYXBzaWJsZTpvcGVuJyA6ICd3cGJjOmNvbGxhcHNpYmxlOmNsb3NlJztcclxuXHRcdFx0Z3JvdXAuZGlzcGF0Y2hFdmVudCggbmV3IEN1c3RvbUV2ZW50KCBldl9uYW1lLCB7XHJcblx0XHRcdFx0YnViYmxlczogdHJ1ZSxcclxuXHRcdFx0XHRkZXRhaWwgOiB7IGdyb3VwLCByb290OiB0aGlzLnJvb3QsIGluc3RhbmNlOiB0aGlzIH1cclxuXHRcdFx0fSApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBHZW5lcmF0ZSBhIHVuaXF1ZSBET00gaWQgd2l0aCB0aGUgc3BlY2lmaWVkIHByZWZpeC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHByZWZpeCBUaGUgaWQgcHJlZml4IHRvIHVzZS5cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9IEEgdW5pcXVlIGVsZW1lbnQgaWQgbm90IHByZXNlbnQgaW4gdGhlIGRvY3VtZW50LlxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0X2dlbmVyYXRlX2lkKHByZWZpeCkge1xyXG5cdFx0XHRsZXQgaSA9IDE7XHJcblx0XHRcdGxldCBpZDtcclxuXHRcdFx0ZG8ge1xyXG5cdFx0XHRcdGlkID0gcHJlZml4ICsgJ18nICsgKGkrKyk7XHJcblx0XHRcdH1cclxuXHRcdFx0d2hpbGUgKCBkLmdldEVsZW1lbnRCeUlkKCBpZCApICk7XHJcblx0XHRcdHJldHVybiBpZDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEF1dG8taW5pdGlhbGl6ZSBjb2xsYXBzaWJsZSBjb250cm9sbGVycyBvbiB0aGUgcGFnZS5cclxuXHQgKiBGaW5kcyB0b3AtbGV2ZWwgYC53cGJjX2NvbGxhcHNpYmxlYCBjb250YWluZXJzIChpZ25vcmluZyBuZXN0ZWQgb25lcyksXHJcblx0ICogYW5kIGluc3RhbnRpYXRlcyB7QGxpbmsgV1BCQ19Db2xsYXBzaWJsZV9Hcm91cHN9IG9uIGVhY2guXHJcblx0ICpcclxuXHQgKiBAZnVuY3Rpb24gV1BCQ19Db2xsYXBzaWJsZV9BdXRvSW5pdFxyXG5cdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0ICogQGV4YW1wbGVcclxuXHQgKiAvLyBSdW5zIGF1dG9tYXRpY2FsbHkgb24gRE9NQ29udGVudExvYWRlZDsgY2FuIGFsc28gYmUgY2FsbGVkIG1hbnVhbGx5OlxyXG5cdCAqIFdQQkNfQ29sbGFwc2libGVfQXV0b0luaXQoKTtcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NvbGxhcHNpYmxlX19hdXRvX2luaXQoKSB7XHJcblx0XHR2YXIgUk9PVCAgPSAnLndwYmNfY29sbGFwc2libGUnO1xyXG5cdFx0dmFyIG5vZGVzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGQucXVlcnlTZWxlY3RvckFsbCggUk9PVCApIClcclxuXHRcdFx0LmZpbHRlciggZnVuY3Rpb24gKG4pIHtcclxuXHRcdFx0XHRyZXR1cm4gIW4ucGFyZW50RWxlbWVudCB8fCAhbi5wYXJlbnRFbGVtZW50LmNsb3Nlc3QoIFJPT1QgKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdG5vZGVzLmZvckVhY2goIGZ1bmN0aW9uIChub2RlKSB7XHJcblx0XHRcdGlmICggbm9kZS5fX3dwYmNfY29sbGFwc2libGVfaW5zdGFuY2UgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdHZhciBleGNsdXNpdmUgPSBub2RlLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfY29sbGFwc2libGUtLWV4Y2x1c2l2ZScgKSB8fCBub2RlLm1hdGNoZXMoICdbZGF0YS13cGJjLWFjY29yZGlvbj1cImV4Y2x1c2l2ZVwiXScgKTtcclxuXHJcblx0XHRcdG5vZGUuX193cGJjX2NvbGxhcHNpYmxlX2luc3RhbmNlID0gbmV3IFdQQkNfQ29sbGFwc2libGVfR3JvdXBzKCBub2RlLCB7IGV4Y2x1c2l2ZSB9ICkuaW5pdCgpO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0Ly8gRXhwb3J0IHRvIGdsb2JhbCBmb3IgbWFudWFsIGNvbnRyb2wgaWYgbmVlZGVkLlxyXG5cdHcuV1BCQ19Db2xsYXBzaWJsZV9Hcm91cHMgICA9IFdQQkNfQ29sbGFwc2libGVfR3JvdXBzO1xyXG5cdHcuV1BCQ19Db2xsYXBzaWJsZV9BdXRvSW5pdCA9IHdwYmNfY29sbGFwc2libGVfX2F1dG9faW5pdDtcclxuXHJcblx0Ly8gRE9NLXJlYWR5IGF1dG8gaW5pdC5cclxuXHRpZiAoIGQucmVhZHlTdGF0ZSA9PT0gJ2xvYWRpbmcnICkge1xyXG5cdFx0ZC5hZGRFdmVudExpc3RlbmVyKCAnRE9NQ29udGVudExvYWRlZCcsIHdwYmNfY29sbGFwc2libGVfX2F1dG9faW5pdCwgeyBvbmNlOiB0cnVlIH0gKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0d3BiY19jb2xsYXBzaWJsZV9fYXV0b19pbml0KCk7XHJcblx0fVxyXG59KSggd2luZG93LCBkb2N1bWVudCApO1xyXG4iLCIvKiBnbG9iYWxzIHdpbmRvdywgZG9jdW1lbnQgKi9cclxuLyoqXHJcbiAqIFdQQkMgU2xpZGVyIExlbmd0aCBHcm91cHNcclxuICpcclxuICogVW5pdmVyc2FsLCBkZXBlbmRlbmN5LWZyZWUgY29udHJvbGxlciB0aGF0IGtlZXBzIGEgXCJsZW5ndGhcIiBjb250cm9sIGluIHN5bmM6XHJcbiAqICAtIG51bWJlciBpbnB1dCAgKGRhdGEtd3BiY19zbGlkZXJfbGVuX3ZhbHVlKVxyXG4gKiAgLSB1bml0IHNlbGVjdCAgIChkYXRhLXdwYmNfc2xpZGVyX2xlbl91bml0KVxyXG4gKiAgLSByYW5nZSBzbGlkZXIgIChkYXRhLXdwYmNfc2xpZGVyX2xlbl9yYW5nZSlcclxuICogIC0gd3JpdGVyIGlucHV0ICAoZGF0YS13cGJjX3NsaWRlcl9sZW5fd3JpdGVyKSAgW29wdGlvbmFsIGJ1dCByZWNvbW1lbmRlZF1cclxuICpcclxuICogVGhlIFwid3JpdGVyXCIgc3RvcmVzIHRoZSBjb21iaW5lZCB2YWx1ZSBsaWtlOiBcIjEwMCVcIiwgXCI0MjBweFwiLCBcIjEyLjVyZW1cIi5cclxuICogV2hlbiBudW1iZXIvdW5pdC9zbGlkZXIgY2hhbmdlIC0+IHdyaXRlciB1cGRhdGVzIGFuZCBlbWl0cyAnaW5wdXQnIChidWJibGVzKS5cclxuICogV2hlbiB3cml0ZXIgaXMgY2hhbmdlZCBleHRlcm5hbGx5IChhcHBseS1mcm9tLUpTT04sIGV0YykgLT4gVUkgdXBkYXRlcy5cclxuICpcclxuICogTWFya3VwIGV4cGVjdGF0aW9ucyAobWluaW1hbCk6XHJcbiAqICA8ZGl2IGNsYXNzPVwid3BiY19zbGlkZXJfbGVuX2dyb3VwXCJcclxuICogICAgICAgZGF0YS13cGJjX3NsaWRlcl9sZW5fYm91bmRzX21hcD0ne1wiJVwiOntcIm1pblwiOjMwLFwibWF4XCI6MTAwLFwic3RlcFwiOjF9LFwicHhcIjp7XCJtaW5cIjozMDAsXCJtYXhcIjoyMDAwLFwic3RlcFwiOjEwfX0nXHJcbiAqICAgICAgIGRhdGEtd3BiY19zbGlkZXJfbGVuX2RlZmF1bHRfdW5pdD1cIiVcIj5cclxuICogICAgPGlucHV0IHR5cGU9XCJudW1iZXJcIiBkYXRhLXdwYmNfc2xpZGVyX2xlbl92YWx1ZT5cclxuICogICAgPHNlbGVjdCBkYXRhLXdwYmNfc2xpZGVyX2xlbl91bml0Pi4uLjwvc2VsZWN0PlxyXG4gKiAgICA8aW5wdXQgdHlwZT1cInJhbmdlXCIgZGF0YS13cGJjX3NsaWRlcl9sZW5fcmFuZ2U+XHJcbiAqICAgIDxpbnB1dCB0eXBlPVwidGV4dFwiIGRhdGEtd3BiY19zbGlkZXJfbGVuX3dyaXRlciBzdHlsZT1cImRpc3BsYXk6bm9uZTtcIj5cclxuICogIDwvZGl2PlxyXG4gKlxyXG4gKiBQZXJmb3JtYW5jZSBub3RlczpcclxuICogLSBNdXRhdGlvbk9ic2VydmVyIGlzIERJU0FCTEVEIGJ5IGRlZmF1bHQgKHByZXZlbnRzIHBlcmZvcm1hbmNlIGlzc3VlcykuXHJcbiAqIC0gSWYgeW91ciBVSSByZS1yZW5kZXJzIGFuZCBpbnNlcnRzIG5ldyBncm91cHMgZHluYW1pY2FsbHksIGNhbGw6XHJcbiAqICAgICBXUEJDX1NsaWRlcl9MZW5fQXV0b0luaXQoKTsgIE9SIGluc3RhbmNlLnJlZnJlc2goKTtcclxuICogICBPciBlbmFibGUgb2JzZXJ2ZXIgdmlhOiBuZXcgV1BCQ19TbGlkZXJfTGVuX0dyb3Vwcyhyb290LCB7IGVuYWJsZV9vYnNlcnZlcjp0cnVlIH0pLmluaXQoKTtcclxuICpcclxuICogUHVibGljIEFQSSAoaW5zdGFuY2UgbWV0aG9kcyk6XHJcbiAqICAtIGluaXQoKSwgZGVzdHJveSgpLCByZWZyZXNoKClcclxuICpcclxuICogQHZlcnNpb24gMjAyNi0wMS0yNVxyXG4gKiBAc2luY2UgICAyMDI2LTAxLTI1XHJcbiAqIEBmaWxlICAgIC4uL2luY2x1ZGVzL19fanMvYWRtaW4vc2xpZGVyX2dyb3Vwcy93cGJjX2xlbl9ncm91cHMuanNcclxuICovXHJcbihmdW5jdGlvbiAodywgZCkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEhlbHBlcnNcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0ZnVuY3Rpb24gY2xhbXBfbnVtKHYsIG1pbiwgbWF4KSB7XHJcblx0XHRpZiAodHlwZW9mIG1pbiA9PT0gJ251bWJlcicgJiYgIWlzTmFOKG1pbikpIHYgPSBNYXRoLm1heChtaW4sIHYpO1xyXG5cdFx0aWYgKHR5cGVvZiBtYXggPT09ICdudW1iZXInICYmICFpc05hTihtYXgpKSB2ID0gTWF0aC5taW4obWF4LCB2KTtcclxuXHRcdHJldHVybiB2O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcGFyc2VfZmxvYXQodikge1xyXG5cdFx0dmFyIG4gPSBwYXJzZUZsb2F0KHYpO1xyXG5cdFx0cmV0dXJuIGlzTmFOKG4pID8gbnVsbCA6IG47XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzYWZlX2pzb25fcGFyc2Uoc3RyKSB7XHJcblx0XHR0cnkge1xyXG5cdFx0XHRyZXR1cm4gSlNPTi5wYXJzZShzdHIpO1xyXG5cdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHBhcnNlX2xlbl9jb21iaW5lZChyYXcsIGRlZmF1bHRfdW5pdCkge1xyXG5cdFx0dmFyIHMgPSAocmF3ID09IG51bGwpID8gJycgOiBTdHJpbmcocmF3KS50cmltKCk7XHJcblx0XHRpZiAoIXMpIHJldHVybiB7IG51bTogJycsIHVuaXQ6IGRlZmF1bHRfdW5pdCB8fCAnJScgfTtcclxuXHJcblx0XHR2YXIgbSA9IHMubWF0Y2goL15cXHMqKFtcXC1dP1xcZCsoPzpcXC5cXGQrKT8pXFxzKihbYS16JV0qKVxccyokL2kpO1xyXG5cdFx0aWYgKCFtKSB7XHJcblx0XHRcdC8vIElmIGl0J3Mgbm90IHBhcnNlYWJsZSwgdHJlYXQgYXMgbnVtYmVyIGFuZCBrZWVwIGRlZmF1bHQgdW5pdC5cclxuXHRcdFx0cmV0dXJuIHsgbnVtOiBzLCB1bml0OiBkZWZhdWx0X3VuaXQgfHwgJyUnIH07XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIG51bSAgPSBtWzFdID8gU3RyaW5nKG1bMV0pIDogJyc7XHJcblx0XHR2YXIgdW5pdCA9IG1bMl0gPyBTdHJpbmcobVsyXSkgOiAnJztcclxuXHRcdGlmICghdW5pdCkgdW5pdCA9IGRlZmF1bHRfdW5pdCB8fCAnJSc7XHJcblxyXG5cdFx0cmV0dXJuIHsgbnVtOiBudW0sIHVuaXQ6IHVuaXQgfTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGJ1aWxkX2NvbWJpbmVkKG51bSwgdW5pdCkge1xyXG5cdFx0aWYgKG51bSA9PSBudWxsIHx8IFN0cmluZyhudW0pLnRyaW0oKSA9PT0gJycpIHJldHVybiAnJztcclxuXHRcdHJldHVybiBTdHJpbmcobnVtKSArIFN0cmluZyh1bml0IHx8ICcnKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGVtaXRfaW5wdXQoZWwpIHtcclxuXHRcdGlmICghZWwpIHJldHVybjtcclxuXHRcdGVsLmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQ29udHJvbGxlclxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRjbGFzcyBXUEJDX1NsaWRlcl9MZW5fR3JvdXBzIHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8c3RyaW5nfSByb290X2VsIENvbnRhaW5lciAob3Igc2VsZWN0b3IpLiBJZiBvbWl0dGVkLCB1c2VzIGRvY3VtZW50LlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IFtvcHRzPXt9XVxyXG5cdFx0ICovXHJcblx0XHRjb25zdHJ1Y3Rvcihyb290X2VsLCBvcHRzKSB7XHJcblx0XHRcdHRoaXMucm9vdCA9IHJvb3RfZWxcclxuXHRcdFx0XHQ/ICgodHlwZW9mIHJvb3RfZWwgPT09ICdzdHJpbmcnKSA/IGQucXVlcnlTZWxlY3Rvcihyb290X2VsKSA6IHJvb3RfZWwpXHJcblx0XHRcdFx0OiBkO1xyXG5cclxuXHRcdFx0dGhpcy5vcHRzID0gT2JqZWN0LmFzc2lnbih7XHJcblx0XHRcdFx0Ly8gU3RyaWN0IHNlbGVjdG9ycyAoTk8gYmFja3dhcmQgY29tcGF0aWJpbGl0eSkuXHJcblx0XHRcdFx0Z3JvdXBfc2VsZWN0b3IgIDogJy53cGJjX3NsaWRlcl9sZW5fZ3JvdXAnLFxyXG5cdFx0XHRcdHZhbHVlX3NlbGVjdG9yICA6ICdbZGF0YS13cGJjX3NsaWRlcl9sZW5fdmFsdWVdJyxcclxuXHRcdFx0XHR1bml0X3NlbGVjdG9yICAgOiAnW2RhdGEtd3BiY19zbGlkZXJfbGVuX3VuaXRdJyxcclxuXHRcdFx0XHRyYW5nZV9zZWxlY3RvciAgOiAnW2RhdGEtd3BiY19zbGlkZXJfbGVuX3JhbmdlXScsXHJcblx0XHRcdFx0d3JpdGVyX3NlbGVjdG9yIDogJ1tkYXRhLXdwYmNfc2xpZGVyX2xlbl93cml0ZXJdJyxcclxuXHJcblx0XHRcdFx0ZGVmYXVsdF91bml0ICAgIDogJyUnLFxyXG5cclxuXHRcdFx0XHRmYWxsYmFja19ib3VuZHMgOiB7XHJcblx0XHRcdFx0XHQncHgnIDogeyBtaW46IDAsICAgbWF4OiA1MTIsICBzdGVwOiAxICAgfSxcclxuXHRcdFx0XHRcdCclJyAgOiB7IG1pbjogMCwgICBtYXg6IDEwMCwgIHN0ZXA6IDEgICB9LFxyXG5cdFx0XHRcdFx0J3JlbSc6IHsgbWluOiAwLCAgIG1heDogMTAsICAgc3RlcDogMC4xIH0sXHJcblx0XHRcdFx0XHQnZW0nIDogeyBtaW46IDAsICAgbWF4OiAxMCwgICBzdGVwOiAwLjEgfVxyXG5cdFx0XHRcdH0sXHJcblxyXG5cdFx0XHRcdC8vIERpc2FibGVkIGJ5IGRlZmF1bHQgZm9yIHBlcmZvcm1hbmNlLlxyXG5cdFx0XHRcdGVuYWJsZV9vYnNlcnZlciAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRvYnNlcnZlcl9kZWJvdW5jZV9tczogMTUwXHJcblx0XHRcdH0sIG9wdHMgfHwge30pO1xyXG5cclxuXHRcdFx0dGhpcy5fb25faW5wdXQgID0gdGhpcy5fb25faW5wdXQuYmluZCh0aGlzKTtcclxuXHRcdFx0dGhpcy5fb25fY2hhbmdlID0gdGhpcy5fb25fY2hhbmdlLmJpbmQodGhpcyk7XHJcblxyXG5cdFx0XHR0aGlzLl9ib3VuZHNfY2FjaGUgPSBuZXcgV2Vha01hcCgpOyAvLyBncm91cCAtPiBib3VuZHNfbWFwX29iamVjdFxyXG5cdFx0XHR0aGlzLl9vYnNlcnZlciAgICAgPSBudWxsO1xyXG5cdFx0XHR0aGlzLl9yZWZyZXNoX3RtciAgPSBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdGluaXQoKSB7XHJcblx0XHRcdGlmICghdGhpcy5yb290KSByZXR1cm4gdGhpcztcclxuXHJcblx0XHRcdHRoaXMucm9vdC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICB0aGlzLl9vbl9pbnB1dCwgIHRydWUpO1xyXG5cdFx0XHR0aGlzLnJvb3QuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgdGhpcy5fb25fY2hhbmdlLCB0cnVlKTtcclxuXHJcblx0XHRcdGlmICh0aGlzLm9wdHMuZW5hYmxlX29ic2VydmVyICYmIHcuTXV0YXRpb25PYnNlcnZlcikge1xyXG5cdFx0XHRcdHRoaXMuX29ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKCkgPT4geyB0aGlzLl9kZWJvdW5jZWRfcmVmcmVzaCgpOyB9KTtcclxuXHRcdFx0XHR0aGlzLl9vYnNlcnZlci5vYnNlcnZlKHRoaXMucm9vdCA9PT0gZCA/IGQuZG9jdW1lbnRFbGVtZW50IDogdGhpcy5yb290LCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5yZWZyZXNoKCk7XHJcblx0XHRcdHJldHVybiB0aGlzO1xyXG5cdFx0fVxyXG5cclxuXHRcdGRlc3Ryb3koKSB7XHJcblx0XHRcdGlmICghdGhpcy5yb290KSByZXR1cm47XHJcblxyXG5cdFx0XHR0aGlzLnJvb3QucmVtb3ZlRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAgdGhpcy5fb25faW5wdXQsICB0cnVlKTtcclxuXHRcdFx0dGhpcy5yb290LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIHRoaXMuX29uX2NoYW5nZSwgdHJ1ZSk7XHJcblxyXG5cdFx0XHRpZiAodGhpcy5fb2JzZXJ2ZXIpIHtcclxuXHRcdFx0XHR0aGlzLl9vYnNlcnZlci5kaXNjb25uZWN0KCk7XHJcblx0XHRcdFx0dGhpcy5fb2JzZXJ2ZXIgPSBudWxsO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAodGhpcy5fcmVmcmVzaF90bXIpIHtcclxuXHRcdFx0XHRjbGVhclRpbWVvdXQodGhpcy5fcmVmcmVzaF90bXIpO1xyXG5cdFx0XHRcdHRoaXMuX3JlZnJlc2hfdG1yID0gbnVsbDtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJlZnJlc2goKSB7XHJcblx0XHRcdGlmICghdGhpcy5yb290KSByZXR1cm47XHJcblxyXG5cdFx0XHR2YXIgc2NvcGUgID0gKHRoaXMucm9vdCA9PT0gZCA/IGQgOiB0aGlzLnJvb3QpO1xyXG5cdFx0XHR2YXIgZ3JvdXBzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoc2NvcGUucXVlcnlTZWxlY3RvckFsbCh0aGlzLm9wdHMuZ3JvdXBfc2VsZWN0b3IpKTtcclxuXHJcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZ3JvdXBzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0dGhpcy5fc3luY19ncm91cF9mcm9tX3dyaXRlcihncm91cHNbaV0pO1xyXG5cdFx0XHRcdHRoaXMuX2FwcGx5X2JvdW5kc19mb3JfY3VycmVudF91bml0KGdyb3Vwc1tpXSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyBJbnRlcm5hbFxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0X2RlYm91bmNlZF9yZWZyZXNoKCkge1xyXG5cdFx0XHRpZiAodGhpcy5fcmVmcmVzaF90bXIpIGNsZWFyVGltZW91dCh0aGlzLl9yZWZyZXNoX3Rtcik7XHJcblx0XHRcdHRoaXMuX3JlZnJlc2hfdG1yID0gc2V0VGltZW91dCgoKSA9PiB7XHJcblx0XHRcdFx0dGhpcy5fcmVmcmVzaF90bXIgPSBudWxsO1xyXG5cdFx0XHRcdHRoaXMucmVmcmVzaCgpO1xyXG5cdFx0XHR9LCBOdW1iZXIodGhpcy5vcHRzLm9ic2VydmVyX2RlYm91bmNlX21zKSB8fCAwKTtcclxuXHRcdH1cclxuXHJcblx0XHRfZmluZF9ncm91cChlbCkge1xyXG5cdFx0XHRyZXR1cm4gKGVsICYmIGVsLmNsb3Nlc3QpID8gZWwuY2xvc2VzdCh0aGlzLm9wdHMuZ3JvdXBfc2VsZWN0b3IpIDogbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHRfZ2V0X3BhcnRzKGdyb3VwKSB7XHJcblx0XHRcdGlmICghZ3JvdXApIHJldHVybiBudWxsO1xyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdGdyb3VwIDogZ3JvdXAsXHJcblx0XHRcdFx0bnVtICAgOiBncm91cC5xdWVyeVNlbGVjdG9yKHRoaXMub3B0cy52YWx1ZV9zZWxlY3RvciksXHJcblx0XHRcdFx0dW5pdCAgOiBncm91cC5xdWVyeVNlbGVjdG9yKHRoaXMub3B0cy51bml0X3NlbGVjdG9yKSxcclxuXHRcdFx0XHRyYW5nZSA6IGdyb3VwLnF1ZXJ5U2VsZWN0b3IodGhpcy5vcHRzLnJhbmdlX3NlbGVjdG9yKSxcclxuXHRcdFx0XHR3cml0ZXI6IGdyb3VwLnF1ZXJ5U2VsZWN0b3IodGhpcy5vcHRzLndyaXRlcl9zZWxlY3RvcilcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHRfZ2V0X2RlZmF1bHRfdW5pdChncm91cCkge1xyXG5cdFx0XHR2YXIgZHUgPSAoZ3JvdXAgJiYgZ3JvdXAuZ2V0QXR0cmlidXRlKVxyXG5cdFx0XHRcdD8gZ3JvdXAuZ2V0QXR0cmlidXRlKCdkYXRhLXdwYmNfc2xpZGVyX2xlbl9kZWZhdWx0X3VuaXQnKVxyXG5cdFx0XHRcdDogJyc7XHJcblx0XHRcdHJldHVybiBkdSA/IFN0cmluZyhkdSkgOiB0aGlzLm9wdHMuZGVmYXVsdF91bml0O1xyXG5cdFx0fVxyXG5cclxuXHRcdF9nZXRfYm91bmRzX21hcChncm91cCkge1xyXG5cdFx0XHRpZiAoIWdyb3VwKSByZXR1cm4gbnVsbDtcclxuXHRcdFx0aWYgKHRoaXMuX2JvdW5kc19jYWNoZS5oYXMoZ3JvdXApKSB7XHJcblx0XHRcdFx0cmV0dXJuIHRoaXMuX2JvdW5kc19jYWNoZS5nZXQoZ3JvdXApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgcmF3ID0gZ3JvdXAuZ2V0QXR0cmlidXRlKCdkYXRhLXdwYmNfc2xpZGVyX2xlbl9ib3VuZHNfbWFwJyk7XHJcblx0XHRcdHZhciBtYXAgPSByYXcgPyBzYWZlX2pzb25fcGFyc2UocmF3KSA6IG51bGw7XHJcblx0XHRcdGlmICghbWFwIHx8IHR5cGVvZiBtYXAgIT09ICdvYmplY3QnKSBtYXAgPSBudWxsO1xyXG5cclxuXHRcdFx0dGhpcy5fYm91bmRzX2NhY2hlLnNldChncm91cCwgbWFwKTtcclxuXHRcdFx0cmV0dXJuIG1hcDtcclxuXHRcdH1cclxuXHJcblx0XHRfZ2V0X2JvdW5kc19mb3JfdW5pdChncm91cCwgdW5pdCkge1xyXG5cdFx0XHR2YXIgbWFwID0gdGhpcy5fZ2V0X2JvdW5kc19tYXAoZ3JvdXApO1xyXG5cdFx0XHRpZiAobWFwICYmIHVuaXQgJiYgbWFwW3VuaXRdKSB7XHJcblx0XHRcdFx0cmV0dXJuIG1hcFt1bml0XTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gdGhpcy5vcHRzLmZhbGxiYWNrX2JvdW5kc1t1bml0XSB8fCB0aGlzLm9wdHMuZmFsbGJhY2tfYm91bmRzWydweCddO1xyXG5cdFx0fVxyXG5cclxuXHRcdF9hcHBseV9ib3VuZHMocGFydHMsIGJvdW5kcykge1xyXG5cdFx0XHRpZiAoIXBhcnRzIHx8ICFib3VuZHMpIHJldHVybjtcclxuXHJcblx0XHRcdHZhciBtaW4gID0gKGJvdW5kcy5taW4gICE9IG51bGwpID8gTnVtYmVyKGJvdW5kcy5taW4pICA6IG51bGw7XHJcblx0XHRcdHZhciBtYXggID0gKGJvdW5kcy5tYXggICE9IG51bGwpID8gTnVtYmVyKGJvdW5kcy5tYXgpICA6IG51bGw7XHJcblx0XHRcdHZhciBzdGVwID0gKGJvdW5kcy5zdGVwICE9IG51bGwpID8gTnVtYmVyKGJvdW5kcy5zdGVwKSA6IG51bGw7XHJcblxyXG5cdFx0XHRpZiAocGFydHMucmFuZ2UpIHtcclxuXHRcdFx0XHRpZiAoIWlzTmFOKG1pbikpICBwYXJ0cy5yYW5nZS5taW4gID0gU3RyaW5nKG1pbik7XHJcblx0XHRcdFx0aWYgKCFpc05hTihtYXgpKSAgcGFydHMucmFuZ2UubWF4ICA9IFN0cmluZyhtYXgpO1xyXG5cdFx0XHRcdGlmICghaXNOYU4oc3RlcCkpIHBhcnRzLnJhbmdlLnN0ZXAgPSBTdHJpbmcoc3RlcCk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKHBhcnRzLm51bSkge1xyXG5cdFx0XHRcdGlmICghaXNOYU4obWluKSkgIHBhcnRzLm51bS5taW4gID0gU3RyaW5nKG1pbik7XHJcblx0XHRcdFx0aWYgKCFpc05hTihtYXgpKSAgcGFydHMubnVtLm1heCAgPSBTdHJpbmcobWF4KTtcclxuXHRcdFx0XHRpZiAoIWlzTmFOKHN0ZXApKSBwYXJ0cy5udW0uc3RlcCA9IFN0cmluZyhzdGVwKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdF9hcHBseV9ib3VuZHNfZm9yX2N1cnJlbnRfdW5pdChncm91cCkge1xyXG5cdFx0XHR2YXIgcGFydHMgPSB0aGlzLl9nZXRfcGFydHMoZ3JvdXApO1xyXG5cdFx0XHRpZiAoIXBhcnRzIHx8ICFwYXJ0cy51bml0KSByZXR1cm47XHJcblxyXG5cdFx0XHR2YXIgdW5pdCA9IHBhcnRzLnVuaXQudmFsdWUgfHwgdGhpcy5fZ2V0X2RlZmF1bHRfdW5pdChncm91cCk7XHJcblx0XHRcdHZhciBiICAgID0gdGhpcy5fZ2V0X2JvdW5kc19mb3JfdW5pdChncm91cCwgdW5pdCk7XHJcblxyXG5cdFx0XHR0aGlzLl9hcHBseV9ib3VuZHMocGFydHMsIGIpO1xyXG5cclxuXHRcdFx0Ly8gQ2xhbXAgY3VycmVudCB2YWx1ZSB0byBuZXcgYm91bmRzLlxyXG5cdFx0XHR2YXIgdiA9IHBhcnNlX2Zsb2F0KHBhcnRzLm51bSAmJiBwYXJ0cy5udW0udmFsdWUgPyBwYXJ0cy5udW0udmFsdWUgOiAocGFydHMucmFuZ2UgPyBwYXJ0cy5yYW5nZS52YWx1ZSA6ICcnKSk7XHJcblx0XHRcdGlmICh2ID09IG51bGwpIHJldHVybjtcclxuXHJcblx0XHRcdHZhciBtaW4gPSAoYiAmJiBiLm1pbiAhPSBudWxsKSA/IE51bWJlcihiLm1pbikgOiBudWxsO1xyXG5cdFx0XHR2YXIgbWF4ID0gKGIgJiYgYi5tYXggIT0gbnVsbCkgPyBOdW1iZXIoYi5tYXgpIDogbnVsbDtcclxuXHRcdFx0diA9IGNsYW1wX251bSh2LCBpc05hTihtaW4pID8gbnVsbCA6IG1pbiwgaXNOYU4obWF4KSA/IG51bGwgOiBtYXgpO1xyXG5cclxuXHRcdFx0aWYgKHBhcnRzLm51bSkgICBwYXJ0cy5udW0udmFsdWUgICA9IFN0cmluZyh2KTtcclxuXHRcdFx0aWYgKHBhcnRzLnJhbmdlKSBwYXJ0cy5yYW5nZS52YWx1ZSA9IFN0cmluZyh2KTtcclxuXHJcblx0XHRcdHRoaXMuX3dyaXRlX2NvbWJpbmVkKHBhcnRzLCBTdHJpbmcodiksIHVuaXQsIC8qZW1pdCovIGZhbHNlKTtcclxuXHRcdH1cclxuXHJcblx0XHRfd3JpdGVfY29tYmluZWQocGFydHMsIG51bSwgdW5pdCwgZW1pdCkge1xyXG5cdFx0XHRpZiAoIXBhcnRzKSByZXR1cm47XHJcblxyXG5cdFx0XHR2YXIgY29tYmluZWQgPSBidWlsZF9jb21iaW5lZChudW0sIHVuaXQpO1xyXG5cclxuXHRcdFx0aWYgKHBhcnRzLndyaXRlcikge1xyXG5cdFx0XHRcdC8vIEF2b2lkIHJlY3Vyc2lvbjogbWFyayBhcyBpbnRlcm5hbCB3cml0ZS5cclxuXHRcdFx0XHRwYXJ0cy53cml0ZXIuX193cGJjX3NsaWRlcl9sZW5faW50ZXJuYWwgPSB0cnVlO1xyXG5cdFx0XHRcdHBhcnRzLndyaXRlci52YWx1ZSA9IGNvbWJpbmVkO1xyXG5cdFx0XHRcdGlmIChlbWl0KSBlbWl0X2lucHV0KHBhcnRzLndyaXRlcik7XHJcblx0XHRcdFx0cGFydHMud3JpdGVyLl9fd3BiY19zbGlkZXJfbGVuX2ludGVybmFsID0gZmFsc2U7XHJcblx0XHRcdH0gZWxzZSBpZiAocGFydHMubnVtKSB7XHJcblx0XHRcdFx0Ly8gSWYgd3JpdGVyIGlzIG1pc3NpbmcsIGF0IGxlYXN0IG5vdGlmeSB2aWEgbnVtYmVyIGlucHV0LlxyXG5cdFx0XHRcdGlmIChlbWl0KSBlbWl0X2lucHV0KHBhcnRzLm51bSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRfc3luY19ncm91cF9mcm9tX3dyaXRlcihncm91cCkge1xyXG5cdFx0XHR2YXIgcGFydHMgPSB0aGlzLl9nZXRfcGFydHMoZ3JvdXApO1xyXG5cdFx0XHRpZiAoIXBhcnRzIHx8ICFwYXJ0cy53cml0ZXIpIHJldHVybjtcclxuXHJcblx0XHRcdHZhciByYXcgPSBTdHJpbmcocGFydHMud3JpdGVyLnZhbHVlIHx8ICcnKS50cmltKCk7XHJcblx0XHRcdGlmICghcmF3KSByZXR1cm47XHJcblxyXG5cdFx0XHR2YXIgZHUgPSB0aGlzLl9nZXRfZGVmYXVsdF91bml0KGdyb3VwKTtcclxuXHRcdFx0dmFyIHAgID0gcGFyc2VfbGVuX2NvbWJpbmVkKHJhdywgZHUpO1xyXG5cclxuXHRcdFx0aWYgKHBhcnRzLnVuaXQpICBwYXJ0cy51bml0LnZhbHVlICA9IHAudW5pdDtcclxuXHRcdFx0aWYgKHBhcnRzLm51bSkgICBwYXJ0cy5udW0udmFsdWUgICA9IHAubnVtO1xyXG5cdFx0XHRpZiAocGFydHMucmFuZ2UpIHBhcnRzLnJhbmdlLnZhbHVlID0gcC5udW07XHJcblx0XHR9XHJcblxyXG5cdFx0X29uX2lucHV0KGV2KSB7XHJcblx0XHRcdHZhciB0ID0gZXYudGFyZ2V0O1xyXG5cdFx0XHRpZiAoIXQpIHJldHVybjtcclxuXHJcblx0XHRcdHZhciBncm91cCA9IHRoaXMuX2ZpbmRfZ3JvdXAodCk7XHJcblx0XHRcdGlmICghZ3JvdXApIHJldHVybjtcclxuXHJcblx0XHRcdHZhciBwYXJ0cyA9IHRoaXMuX2dldF9wYXJ0cyhncm91cCk7XHJcblx0XHRcdGlmICghcGFydHMpIHJldHVybjtcclxuXHJcblx0XHRcdC8vIFdyaXRlciBjaGFuZ2VkIGV4dGVybmFsbHkgLT4gdXBkYXRlIFVJLlxyXG5cdFx0XHRpZiAocGFydHMud3JpdGVyICYmIHQgPT09IHBhcnRzLndyaXRlcikge1xyXG5cdFx0XHRcdGlmICh0Ll9fd3BiY19zbGlkZXJfbGVuX2ludGVybmFsKSByZXR1cm47XHJcblx0XHRcdFx0dGhpcy5fc3luY19ncm91cF9mcm9tX3dyaXRlcihncm91cCk7XHJcblx0XHRcdFx0dGhpcy5fYXBwbHlfYm91bmRzX2Zvcl9jdXJyZW50X3VuaXQoZ3JvdXApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gU2xpZGVyIG1vdmVkIC0+IHVwZGF0ZSBudW1iZXIgKyB3cml0ZXIuXHJcblx0XHRcdGlmICh0Lm1hdGNoZXMgJiYgdC5tYXRjaGVzKHRoaXMub3B0cy5yYW5nZV9zZWxlY3RvcikpIHtcclxuXHRcdFx0XHRpZiAocGFydHMubnVtKSBwYXJ0cy5udW0udmFsdWUgPSB0LnZhbHVlO1xyXG5cclxuXHRcdFx0XHR2YXIgdW5pdCA9IChwYXJ0cy51bml0ICYmIHBhcnRzLnVuaXQudmFsdWUpID8gcGFydHMudW5pdC52YWx1ZSA6IHRoaXMuX2dldF9kZWZhdWx0X3VuaXQoZ3JvdXApO1xyXG5cdFx0XHRcdHRoaXMuX3dyaXRlX2NvbWJpbmVkKHBhcnRzLCB0LnZhbHVlLCB1bml0LCAvKmVtaXQqLyB0cnVlKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE51bWJlciB0eXBlZCAtPiB1cGRhdGUgc2xpZGVyICsgd3JpdGVyIChjbGFtcCBpZiBzbGlkZXIgaGFzIGJvdW5kcykuXHJcblx0XHRcdGlmICh0Lm1hdGNoZXMgJiYgdC5tYXRjaGVzKHRoaXMub3B0cy52YWx1ZV9zZWxlY3RvcikpIHtcclxuXHRcdFx0XHR2YXIgdiA9IHBhcnNlX2Zsb2F0KHQudmFsdWUpO1xyXG5cclxuXHRcdFx0XHRpZiAodiAhPSBudWxsICYmIHBhcnRzLnJhbmdlKSB7XHJcblx0XHRcdFx0XHR2YXIgcm1pbiA9IE51bWJlcihwYXJ0cy5yYW5nZS5taW4pO1xyXG5cdFx0XHRcdFx0dmFyIHJtYXggPSBOdW1iZXIocGFydHMucmFuZ2UubWF4KTtcclxuXHRcdFx0XHRcdHYgPSBjbGFtcF9udW0odiwgaXNOYU4ocm1pbikgPyBudWxsIDogcm1pbiwgaXNOYU4ocm1heCkgPyBudWxsIDogcm1heCk7XHJcblxyXG5cdFx0XHRcdFx0cGFydHMucmFuZ2UudmFsdWUgPSBTdHJpbmcodik7XHJcblx0XHRcdFx0XHRpZiAoU3RyaW5nKHYpICE9PSB0LnZhbHVlKSB0LnZhbHVlID0gU3RyaW5nKHYpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dmFyIHVuaXQyID0gKHBhcnRzLnVuaXQgJiYgcGFydHMudW5pdC52YWx1ZSkgPyBwYXJ0cy51bml0LnZhbHVlIDogdGhpcy5fZ2V0X2RlZmF1bHRfdW5pdChncm91cCk7XHJcblx0XHRcdFx0dGhpcy5fd3JpdGVfY29tYmluZWQocGFydHMsIHQudmFsdWUsIHVuaXQyLCAvKmVtaXQqLyB0cnVlKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdF9vbl9jaGFuZ2UoZXYpIHtcclxuXHRcdFx0dmFyIHQgPSBldi50YXJnZXQ7XHJcblx0XHRcdGlmICghdCkgcmV0dXJuO1xyXG5cclxuXHRcdFx0dmFyIGdyb3VwID0gdGhpcy5fZmluZF9ncm91cCh0KTtcclxuXHRcdFx0aWYgKCFncm91cCkgcmV0dXJuO1xyXG5cclxuXHRcdFx0dmFyIHBhcnRzID0gdGhpcy5fZ2V0X3BhcnRzKGdyb3VwKTtcclxuXHRcdFx0aWYgKCFwYXJ0cykgcmV0dXJuO1xyXG5cclxuXHRcdFx0Ly8gVW5pdCBjaGFuZ2VkIC0+IHVwZGF0ZSBib3VuZHMgKyB3cml0ZXIuXHJcblx0XHRcdGlmICh0Lm1hdGNoZXMgJiYgdC5tYXRjaGVzKHRoaXMub3B0cy51bml0X3NlbGVjdG9yKSkge1xyXG5cdFx0XHRcdHRoaXMuX2FwcGx5X2JvdW5kc19mb3JfY3VycmVudF91bml0KGdyb3VwKTtcclxuXHJcblx0XHRcdFx0dmFyIG51bSAgPSBwYXJ0cy5udW0gPyBwYXJ0cy5udW0udmFsdWUgOiAocGFydHMucmFuZ2UgPyBwYXJ0cy5yYW5nZS52YWx1ZSA6ICcnKTtcclxuXHRcdFx0XHR2YXIgdW5pdCA9IHQudmFsdWUgfHwgdGhpcy5fZ2V0X2RlZmF1bHRfdW5pdChncm91cCk7XHJcblx0XHRcdFx0dGhpcy5fd3JpdGVfY29tYmluZWQocGFydHMsIG51bSwgdW5pdCwgLyplbWl0Ki8gdHJ1ZSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBBdXRvLWluaXRcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0ZnVuY3Rpb24gd3BiY19zbGlkZXJfbGVuX2dyb3Vwc19fYXV0b19pbml0KCkge1xyXG5cdFx0dmFyIFJPT1QgID0gJy53cGJjX3NsaWRlcl9sZW5fZ3JvdXBzJztcclxuXHRcdHZhciBub2RlcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGQucXVlcnlTZWxlY3RvckFsbChST09UKSlcclxuXHRcdFx0LmZpbHRlcihmdW5jdGlvbiAobikgeyByZXR1cm4gIW4ucGFyZW50RWxlbWVudCB8fCAhbi5wYXJlbnRFbGVtZW50LmNsb3Nlc3QoUk9PVCk7IH0pO1xyXG5cclxuXHRcdC8vIElmIG5vIGV4cGxpY2l0IGNvbnRhaW5lcnMsIGluc3RhbGwgYSBzaW5nbGUgZG9jdW1lbnQtcm9vdCBpbnN0YW5jZS5cclxuXHRcdGlmICghbm9kZXMubGVuZ3RoKSB7XHJcblx0XHRcdGlmICghZC5fX3dwYmNfc2xpZGVyX2xlbl9ncm91cHNfZ2xvYmFsX2luc3RhbmNlKSB7XHJcblx0XHRcdFx0ZC5fX3dwYmNfc2xpZGVyX2xlbl9ncm91cHNfZ2xvYmFsX2luc3RhbmNlID0gbmV3IFdQQkNfU2xpZGVyX0xlbl9Hcm91cHMoZCkuaW5pdCgpO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChub2RlKSB7XHJcblx0XHRcdGlmIChub2RlLl9fd3BiY19zbGlkZXJfbGVuX2dyb3Vwc19pbnN0YW5jZSkgcmV0dXJuO1xyXG5cdFx0XHRub2RlLl9fd3BiY19zbGlkZXJfbGVuX2dyb3Vwc19pbnN0YW5jZSA9IG5ldyBXUEJDX1NsaWRlcl9MZW5fR3JvdXBzKG5vZGUpLmluaXQoKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0Ly8gRXhwb3J0IGdsb2JhbHMgKG1hbnVhbCBjb250cm9sIGlmIG5lZWRlZCkuXHJcblx0dy5XUEJDX1NsaWRlcl9MZW5fR3JvdXBzICAgPSBXUEJDX1NsaWRlcl9MZW5fR3JvdXBzO1xyXG5cdHcuV1BCQ19TbGlkZXJfTGVuX0F1dG9Jbml0ID0gd3BiY19zbGlkZXJfbGVuX2dyb3Vwc19fYXV0b19pbml0O1xyXG5cclxuXHQvLyBET00tcmVhZHkgYXV0byBpbml0LlxyXG5cdGlmIChkLnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJykge1xyXG5cdFx0ZC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgd3BiY19zbGlkZXJfbGVuX2dyb3Vwc19fYXV0b19pbml0LCB7IG9uY2U6IHRydWUgfSk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHdwYmNfc2xpZGVyX2xlbl9ncm91cHNfX2F1dG9faW5pdCgpO1xyXG5cdH1cclxuXHJcbn0pKHdpbmRvdywgZG9jdW1lbnQpO1xyXG4iLCIvKiBnbG9iYWxzIHdpbmRvdywgZG9jdW1lbnQgKi9cclxuLyoqXHJcbiAqIFdQQkMgU2xpZGVyIFJhbmdlIEdyb3Vwc1xyXG4gKlxyXG4gKiBVbml2ZXJzYWwsIGRlcGVuZGVuY3ktZnJlZSBjb250cm9sbGVyIHRoYXQga2VlcHMgYSBcInJhbmdlICsgbnVtYmVyXCIgcGFpciBpbiBzeW5jOlxyXG4gKiAgLSBudW1iZXIgaW5wdXQgIChkYXRhLXdwYmNfc2xpZGVyX3JhbmdlX3ZhbHVlKVxyXG4gKiAgLSByYW5nZSBzbGlkZXIgIChkYXRhLXdwYmNfc2xpZGVyX3JhbmdlX3JhbmdlKVxyXG4gKiAgLSB3cml0ZXIgaW5wdXQgIChkYXRhLXdwYmNfc2xpZGVyX3JhbmdlX3dyaXRlcikgW29wdGlvbmFsXVxyXG4gKlxyXG4gKiBJZiB3cml0ZXIgZXhpc3RzOiBudW1iZXIvc2xpZGVyIHVwZGF0ZSB3cml0ZXIgYW5kIGVtaXQgJ2lucHV0JyBvbiB3cml0ZXIgKGJ1YmJsZXMpLlxyXG4gKiBJZiB3cml0ZXIgaXMgbWlzc2luZzogZW1pdHMgJ2lucHV0JyBvbiB0aGUgbnVtYmVyIGlucHV0LlxyXG4gKiBJZiB3cml0ZXIgY2hhbmdlcyBleHRlcm5hbGx5OiB1cGRhdGVzIG51bWJlci9zbGlkZXIuXHJcbiAqXHJcbiAqIE1hcmt1cCBleHBlY3RhdGlvbnMgKG1pbmltYWwpOlxyXG4gKiAgPGRpdiBjbGFzcz1cIndwYmNfc2xpZGVyX3JhbmdlX2dyb3VwXCI+XHJcbiAqICAgIDxpbnB1dCB0eXBlPVwibnVtYmVyXCIgZGF0YS13cGJjX3NsaWRlcl9yYW5nZV92YWx1ZT5cclxuICogICAgPGlucHV0IHR5cGU9XCJyYW5nZVwiICBkYXRhLXdwYmNfc2xpZGVyX3JhbmdlX3JhbmdlPlxyXG4gKiAgICA8IS0tIG9wdGlvbmFsIC0tPlxyXG4gKiAgICA8aW5wdXQgdHlwZT1cInRleHRcIiBkYXRhLXdwYmNfc2xpZGVyX3JhbmdlX3dyaXRlciBzdHlsZT1cImRpc3BsYXk6bm9uZTtcIj5cclxuICogIDwvZGl2PlxyXG4gKlxyXG4gKiBQZXJmb3JtYW5jZSBub3RlczpcclxuICogLSBNdXRhdGlvbk9ic2VydmVyIGlzIERJU0FCTEVEIGJ5IGRlZmF1bHQuXHJcbiAqIC0gSWYgeW91ciBVSSByZS1yZW5kZXJzIGFuZCBpbnNlcnRzIG5ldyBncm91cHMgZHluYW1pY2FsbHksIGNhbGw6XHJcbiAqICAgICBXUEJDX1NsaWRlcl9SYW5nZV9BdXRvSW5pdCgpOyBPUiBpbnN0YW5jZS5yZWZyZXNoKCk7XHJcbiAqICAgT3IgZW5hYmxlIG9ic2VydmVyIHZpYTogbmV3IFdQQkNfU2xpZGVyX1JhbmdlX0dyb3Vwcyhyb290LCB7IGVuYWJsZV9vYnNlcnZlcjp0cnVlIH0pLmluaXQoKTtcclxuICpcclxuICogUHVibGljIEFQSSAoaW5zdGFuY2UgbWV0aG9kcyk6XHJcbiAqICAtIGluaXQoKSwgZGVzdHJveSgpLCByZWZyZXNoKClcclxuICpcclxuICogQHZlcnNpb24gMjAyNi0wMS0yNVxyXG4gKiBAc2luY2UgICAyMDI2LTAxLTI1XHJcbiAqIEBmaWxlICAgIC4uL2luY2x1ZGVzL19fanMvYWRtaW4vc2xpZGVyX2dyb3Vwcy93cGJjX3JhbmdlX2dyb3Vwcy5qc1xyXG4gKi9cclxuKGZ1bmN0aW9uICh3LCBkKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gSGVscGVyc1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRmdW5jdGlvbiBjbGFtcF9udW0odiwgbWluLCBtYXgpIHtcclxuXHRcdGlmICh0eXBlb2YgbWluID09PSAnbnVtYmVyJyAmJiAhaXNOYU4obWluKSkgdiA9IE1hdGgubWF4KG1pbiwgdik7XHJcblx0XHRpZiAodHlwZW9mIG1heCA9PT0gJ251bWJlcicgJiYgIWlzTmFOKG1heCkpIHYgPSBNYXRoLm1pbihtYXgsIHYpO1xyXG5cdFx0cmV0dXJuIHY7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBwYXJzZV9mbG9hdCh2KSB7XHJcblx0XHR2YXIgbiA9IHBhcnNlRmxvYXQodik7XHJcblx0XHRyZXR1cm4gaXNOYU4obikgPyBudWxsIDogbjtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGVtaXRfaW5wdXQoZWwpIHtcclxuXHRcdGlmICghZWwpIHJldHVybjtcclxuXHRcdGVsLmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQ29udHJvbGxlclxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRjbGFzcyBXUEJDX1NsaWRlcl9SYW5nZV9Hcm91cHMge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxzdHJpbmd9IHJvb3RfZWwgQ29udGFpbmVyIChvciBzZWxlY3RvcikuIElmIG9taXR0ZWQsIHVzZXMgZG9jdW1lbnQuXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gW29wdHM9e31dXHJcblx0XHQgKi9cclxuXHRcdGNvbnN0cnVjdG9yKHJvb3RfZWwsIG9wdHMpIHtcclxuXHRcdFx0dGhpcy5yb290ID0gcm9vdF9lbFxyXG5cdFx0XHRcdD8gKCh0eXBlb2Ygcm9vdF9lbCA9PT0gJ3N0cmluZycpID8gZC5xdWVyeVNlbGVjdG9yKHJvb3RfZWwpIDogcm9vdF9lbClcclxuXHRcdFx0XHQ6IGQ7XHJcblxyXG5cdFx0XHR0aGlzLm9wdHMgPSBPYmplY3QuYXNzaWduKHtcclxuXHRcdFx0XHQvLyBTdHJpY3Qgc2VsZWN0b3JzIChOTyBiYWNrd2FyZCBjb21wYXRpYmlsaXR5KS5cclxuXHRcdFx0XHRncm91cF9zZWxlY3RvciAgOiAnLndwYmNfc2xpZGVyX3JhbmdlX2dyb3VwJyxcclxuXHRcdFx0XHR2YWx1ZV9zZWxlY3RvciAgOiAnW2RhdGEtd3BiY19zbGlkZXJfcmFuZ2VfdmFsdWVdJyxcclxuXHRcdFx0XHRyYW5nZV9zZWxlY3RvciAgOiAnW2RhdGEtd3BiY19zbGlkZXJfcmFuZ2VfcmFuZ2VdJyxcclxuXHRcdFx0XHR3cml0ZXJfc2VsZWN0b3IgOiAnW2RhdGEtd3BiY19zbGlkZXJfcmFuZ2Vfd3JpdGVyXScsXHJcblxyXG5cdFx0XHRcdC8vIERpc2FibGVkIGJ5IGRlZmF1bHQgZm9yIHBlcmZvcm1hbmNlLlxyXG5cdFx0XHRcdGVuYWJsZV9vYnNlcnZlciAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRvYnNlcnZlcl9kZWJvdW5jZV9tczogMTUwXHJcblx0XHRcdH0sIG9wdHMgfHwge30pO1xyXG5cclxuXHRcdFx0dGhpcy5fb25faW5wdXQgID0gdGhpcy5fb25faW5wdXQuYmluZCh0aGlzKTtcclxuXHRcdFx0dGhpcy5fb25fY2hhbmdlID0gdGhpcy5fb25fY2hhbmdlLmJpbmQodGhpcyk7XHJcblxyXG5cdFx0XHR0aGlzLl9vYnNlcnZlciAgICA9IG51bGw7XHJcblx0XHRcdHRoaXMuX3JlZnJlc2hfdG1yID0gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHRpbml0KCkge1xyXG5cdFx0XHRpZiAoIXRoaXMucm9vdCkgcmV0dXJuIHRoaXM7XHJcblxyXG5cdFx0XHR0aGlzLnJvb3QuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAgdGhpcy5fb25faW5wdXQsICB0cnVlKTtcclxuXHRcdFx0dGhpcy5yb290LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIHRoaXMuX29uX2NoYW5nZSwgdHJ1ZSk7XHJcblxyXG5cdFx0XHRpZiAodGhpcy5vcHRzLmVuYWJsZV9vYnNlcnZlciAmJiB3Lk11dGF0aW9uT2JzZXJ2ZXIpIHtcclxuXHRcdFx0XHR0aGlzLl9vYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHsgdGhpcy5fZGVib3VuY2VkX3JlZnJlc2goKTsgfSk7XHJcblx0XHRcdFx0dGhpcy5fb2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLnJvb3QgPT09IGQgPyBkLmRvY3VtZW50RWxlbWVudCA6IHRoaXMucm9vdCwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMucmVmcmVzaCgpO1xyXG5cdFx0XHRyZXR1cm4gdGhpcztcclxuXHRcdH1cclxuXHJcblx0XHRkZXN0cm95KCkge1xyXG5cdFx0XHRpZiAoIXRoaXMucm9vdCkgcmV0dXJuO1xyXG5cclxuXHRcdFx0dGhpcy5yb290LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2lucHV0JywgIHRoaXMuX29uX2lucHV0LCAgdHJ1ZSk7XHJcblx0XHRcdHRoaXMucm9vdC5yZW1vdmVFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCB0aGlzLl9vbl9jaGFuZ2UsIHRydWUpO1xyXG5cclxuXHRcdFx0aWYgKHRoaXMuX29ic2VydmVyKSB7XHJcblx0XHRcdFx0dGhpcy5fb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xyXG5cdFx0XHRcdHRoaXMuX29ic2VydmVyID0gbnVsbDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKHRoaXMuX3JlZnJlc2hfdG1yKSB7XHJcblx0XHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMuX3JlZnJlc2hfdG1yKTtcclxuXHRcdFx0XHR0aGlzLl9yZWZyZXNoX3RtciA9IG51bGw7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZWZyZXNoKCkge1xyXG5cdFx0XHRpZiAoIXRoaXMucm9vdCkgcmV0dXJuO1xyXG5cclxuXHRcdFx0dmFyIHNjb3BlICA9ICh0aGlzLnJvb3QgPT09IGQgPyBkIDogdGhpcy5yb290KTtcclxuXHRcdFx0dmFyIGdyb3VwcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHNjb3BlLnF1ZXJ5U2VsZWN0b3JBbGwodGhpcy5vcHRzLmdyb3VwX3NlbGVjdG9yKSk7XHJcblxyXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGdyb3Vwcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdHRoaXMuX3N5bmNfZnJvbV93cml0ZXIoZ3JvdXBzW2ldKTtcclxuXHRcdFx0XHR0aGlzLl9jbGFtcF90b19yYW5nZShncm91cHNbaV0pO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gSW50ZXJuYWxcclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdF9kZWJvdW5jZWRfcmVmcmVzaCgpIHtcclxuXHRcdFx0aWYgKHRoaXMuX3JlZnJlc2hfdG1yKSBjbGVhclRpbWVvdXQodGhpcy5fcmVmcmVzaF90bXIpO1xyXG5cdFx0XHR0aGlzLl9yZWZyZXNoX3RtciA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG5cdFx0XHRcdHRoaXMuX3JlZnJlc2hfdG1yID0gbnVsbDtcclxuXHRcdFx0XHR0aGlzLnJlZnJlc2goKTtcclxuXHRcdFx0fSwgTnVtYmVyKHRoaXMub3B0cy5vYnNlcnZlcl9kZWJvdW5jZV9tcykgfHwgMCk7XHJcblx0XHR9XHJcblxyXG5cdFx0X2ZpbmRfZ3JvdXAoZWwpIHtcclxuXHRcdFx0cmV0dXJuIChlbCAmJiBlbC5jbG9zZXN0KSA/IGVsLmNsb3Nlc3QodGhpcy5vcHRzLmdyb3VwX3NlbGVjdG9yKSA6IG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0X2dldF9wYXJ0cyhncm91cCkge1xyXG5cdFx0XHRpZiAoIWdyb3VwKSByZXR1cm4gbnVsbDtcclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHRncm91cCA6IGdyb3VwLFxyXG5cdFx0XHRcdG51bSAgIDogZ3JvdXAucXVlcnlTZWxlY3Rvcih0aGlzLm9wdHMudmFsdWVfc2VsZWN0b3IpLFxyXG5cdFx0XHRcdHJhbmdlIDogZ3JvdXAucXVlcnlTZWxlY3Rvcih0aGlzLm9wdHMucmFuZ2Vfc2VsZWN0b3IpLFxyXG5cdFx0XHRcdHdyaXRlcjogZ3JvdXAucXVlcnlTZWxlY3Rvcih0aGlzLm9wdHMud3JpdGVyX3NlbGVjdG9yKVxyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdF93cml0ZShwYXJ0cywgdmFsdWUsIGVtaXQpIHtcclxuXHRcdFx0aWYgKCFwYXJ0cykgcmV0dXJuO1xyXG5cclxuXHRcdFx0aWYgKHBhcnRzLndyaXRlcikge1xyXG5cdFx0XHRcdHBhcnRzLndyaXRlci5fX3dwYmNfc2xpZGVyX3JhbmdlX2ludGVybmFsID0gdHJ1ZTtcclxuXHRcdFx0XHRwYXJ0cy53cml0ZXIudmFsdWUgPSBTdHJpbmcodmFsdWUpO1xyXG5cdFx0XHRcdGlmIChlbWl0KSBlbWl0X2lucHV0KHBhcnRzLndyaXRlcik7XHJcblx0XHRcdFx0cGFydHMud3JpdGVyLl9fd3BiY19zbGlkZXJfcmFuZ2VfaW50ZXJuYWwgPSBmYWxzZTtcclxuXHRcdFx0fSBlbHNlIGlmIChwYXJ0cy5udW0pIHtcclxuXHRcdFx0XHQvLyBJZiB3cml0ZXIgaXMgbWlzc2luZywgYXQgbGVhc3Qgbm90aWZ5IHZpYSBudW1iZXIgaW5wdXQuXHJcblx0XHRcdFx0aWYgKGVtaXQpIGVtaXRfaW5wdXQocGFydHMubnVtKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdF9zeW5jX2Zyb21fd3JpdGVyKGdyb3VwKSB7XHJcblx0XHRcdHZhciBwYXJ0cyA9IHRoaXMuX2dldF9wYXJ0cyhncm91cCk7XHJcblx0XHRcdGlmICghcGFydHMgfHwgIXBhcnRzLndyaXRlcikgcmV0dXJuO1xyXG5cclxuXHRcdFx0dmFyIHJhdyA9IFN0cmluZyhwYXJ0cy53cml0ZXIudmFsdWUgfHwgJycpLnRyaW0oKTtcclxuXHRcdFx0aWYgKCFyYXcpIHJldHVybjtcclxuXHJcblx0XHRcdGlmIChwYXJ0cy5udW0pICAgcGFydHMubnVtLnZhbHVlICAgPSByYXc7XHJcblx0XHRcdGlmIChwYXJ0cy5yYW5nZSkgcGFydHMucmFuZ2UudmFsdWUgPSByYXc7XHJcblx0XHR9XHJcblxyXG5cdFx0X2NsYW1wX3RvX3JhbmdlKGdyb3VwKSB7XHJcblx0XHRcdHZhciBwYXJ0cyA9IHRoaXMuX2dldF9wYXJ0cyhncm91cCk7XHJcblx0XHRcdGlmICghcGFydHMgfHwgIXBhcnRzLnJhbmdlIHx8ICFwYXJ0cy5udW0pIHJldHVybjtcclxuXHJcblx0XHRcdHZhciB2ID0gcGFyc2VfZmxvYXQocGFydHMubnVtLnZhbHVlKTtcclxuXHRcdFx0aWYgKHYgPT0gbnVsbCkgcmV0dXJuO1xyXG5cclxuXHRcdFx0dmFyIG1pbiA9IE51bWJlcihwYXJ0cy5yYW5nZS5taW4pO1xyXG5cdFx0XHR2YXIgbWF4ID0gTnVtYmVyKHBhcnRzLnJhbmdlLm1heCk7XHJcblx0XHRcdHZhciB2diAgPSBjbGFtcF9udW0odiwgaXNOYU4obWluKSA/IG51bGwgOiBtaW4sIGlzTmFOKG1heCkgPyBudWxsIDogbWF4KTtcclxuXHJcblx0XHRcdGlmIChTdHJpbmcodnYpICE9PSBwYXJ0cy5udW0udmFsdWUpIHBhcnRzLm51bS52YWx1ZSA9IFN0cmluZyh2dik7XHJcblx0XHRcdHBhcnRzLnJhbmdlLnZhbHVlID0gU3RyaW5nKHZ2KTtcclxuXHRcdH1cclxuXHJcblx0XHRfb25faW5wdXQoZXYpIHtcclxuXHRcdFx0dmFyIHQgPSBldi50YXJnZXQ7XHJcblx0XHRcdGlmICghdCkgcmV0dXJuO1xyXG5cclxuXHRcdFx0dmFyIGdyb3VwID0gdGhpcy5fZmluZF9ncm91cCh0KTtcclxuXHRcdFx0aWYgKCFncm91cCkgcmV0dXJuO1xyXG5cclxuXHRcdFx0dmFyIHBhcnRzID0gdGhpcy5fZ2V0X3BhcnRzKGdyb3VwKTtcclxuXHRcdFx0aWYgKCFwYXJ0cykgcmV0dXJuO1xyXG5cclxuXHRcdFx0Ly8gV3JpdGVyIGNoYW5nZWQgZXh0ZXJuYWxseSAtPiB1cGRhdGUgVUkuXHJcblx0XHRcdGlmIChwYXJ0cy53cml0ZXIgJiYgdCA9PT0gcGFydHMud3JpdGVyKSB7XHJcblx0XHRcdFx0aWYgKHQuX193cGJjX3NsaWRlcl9yYW5nZV9pbnRlcm5hbCkgcmV0dXJuO1xyXG5cdFx0XHRcdHRoaXMuX3N5bmNfZnJvbV93cml0ZXIoZ3JvdXApO1xyXG5cdFx0XHRcdHRoaXMuX2NsYW1wX3RvX3JhbmdlKGdyb3VwKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFJhbmdlIG1vdmVkIC0+IHVwZGF0ZSBudW1iZXIgKyB3cml0ZXIuXHJcblx0XHRcdGlmICh0Lm1hdGNoZXMgJiYgdC5tYXRjaGVzKHRoaXMub3B0cy5yYW5nZV9zZWxlY3RvcikpIHtcclxuXHRcdFx0XHRpZiAocGFydHMubnVtKSBwYXJ0cy5udW0udmFsdWUgPSB0LnZhbHVlO1xyXG5cdFx0XHRcdHRoaXMuX3dyaXRlKHBhcnRzLCB0LnZhbHVlLCAvKmVtaXQqLyB0cnVlKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE51bWJlciB0eXBlZCAtPiB1cGRhdGUgcmFuZ2UgKyB3cml0ZXIgKGNsYW1wIGJ5IHNsaWRlciBib3VuZHMpLlxyXG5cdFx0XHRpZiAodC5tYXRjaGVzICYmIHQubWF0Y2hlcyh0aGlzLm9wdHMudmFsdWVfc2VsZWN0b3IpKSB7XHJcblx0XHRcdFx0aWYgKHBhcnRzLnJhbmdlKSB7XHJcblx0XHRcdFx0XHR2YXIgdiA9IHBhcnNlX2Zsb2F0KHQudmFsdWUpO1xyXG5cdFx0XHRcdFx0aWYgKHYgIT0gbnVsbCkge1xyXG5cdFx0XHRcdFx0XHR2YXIgbWluID0gTnVtYmVyKHBhcnRzLnJhbmdlLm1pbik7XHJcblx0XHRcdFx0XHRcdHZhciBtYXggPSBOdW1iZXIocGFydHMucmFuZ2UubWF4KTtcclxuXHRcdFx0XHRcdFx0diA9IGNsYW1wX251bSh2LCBpc05hTihtaW4pID8gbnVsbCA6IG1pbiwgaXNOYU4obWF4KSA/IG51bGwgOiBtYXgpO1xyXG5cclxuXHRcdFx0XHRcdFx0cGFydHMucmFuZ2UudmFsdWUgPSBTdHJpbmcodik7XHJcblx0XHRcdFx0XHRcdGlmIChTdHJpbmcodikgIT09IHQudmFsdWUpIHQudmFsdWUgPSBTdHJpbmcodik7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHRoaXMuX3dyaXRlKHBhcnRzLCB0LnZhbHVlLCAvKmVtaXQqLyB0cnVlKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdF9vbl9jaGFuZ2UoZXYpIHtcclxuXHRcdFx0Ly8gTm8gc3BlY2lhbCBcImNoYW5nZVwiIGhhbmRsaW5nIG5lZWRlZCBjdXJyZW50bHk7IGtlcHQgZm9yIHN5bW1ldHJ5L2Z1dHVyZS5cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBBdXRvLWluaXRcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0ZnVuY3Rpb24gd3BiY19zbGlkZXJfcmFuZ2VfZ3JvdXBzX19hdXRvX2luaXQoKSB7XHJcblx0XHR2YXIgUk9PVCAgPSAnLndwYmNfc2xpZGVyX3JhbmdlX2dyb3Vwcyc7XHJcblx0XHR2YXIgbm9kZXMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChkLnF1ZXJ5U2VsZWN0b3JBbGwoUk9PVCkpXHJcblx0XHRcdC5maWx0ZXIoZnVuY3Rpb24gKG4pIHsgcmV0dXJuICFuLnBhcmVudEVsZW1lbnQgfHwgIW4ucGFyZW50RWxlbWVudC5jbG9zZXN0KFJPT1QpOyB9KTtcclxuXHJcblx0XHRpZiAoIW5vZGVzLmxlbmd0aCkge1xyXG5cdFx0XHRpZiAoIWQuX193cGJjX3NsaWRlcl9yYW5nZV9ncm91cHNfZ2xvYmFsX2luc3RhbmNlKSB7XHJcblx0XHRcdFx0ZC5fX3dwYmNfc2xpZGVyX3JhbmdlX2dyb3Vwc19nbG9iYWxfaW5zdGFuY2UgPSBuZXcgV1BCQ19TbGlkZXJfUmFuZ2VfR3JvdXBzKGQpLmluaXQoKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0bm9kZXMuZm9yRWFjaChmdW5jdGlvbiAobm9kZSkge1xyXG5cdFx0XHRpZiAobm9kZS5fX3dwYmNfc2xpZGVyX3JhbmdlX2dyb3Vwc19pbnN0YW5jZSkgcmV0dXJuO1xyXG5cdFx0XHRub2RlLl9fd3BiY19zbGlkZXJfcmFuZ2VfZ3JvdXBzX2luc3RhbmNlID0gbmV3IFdQQkNfU2xpZGVyX1JhbmdlX0dyb3Vwcyhub2RlKS5pbml0KCk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdC8vIEV4cG9ydCBnbG9iYWxzLlxyXG5cdHcuV1BCQ19TbGlkZXJfUmFuZ2VfR3JvdXBzICAgPSBXUEJDX1NsaWRlcl9SYW5nZV9Hcm91cHM7XHJcblx0dy5XUEJDX1NsaWRlcl9SYW5nZV9BdXRvSW5pdCA9IHdwYmNfc2xpZGVyX3JhbmdlX2dyb3Vwc19fYXV0b19pbml0O1xyXG5cclxuXHRpZiAoZC5yZWFkeVN0YXRlID09PSAnbG9hZGluZycpIHtcclxuXHRcdGQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIHdwYmNfc2xpZGVyX3JhbmdlX2dyb3Vwc19fYXV0b19pbml0LCB7IG9uY2U6IHRydWUgfSk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHdwYmNfc2xpZGVyX3JhbmdlX2dyb3Vwc19fYXV0b19pbml0KCk7XHJcblx0fVxyXG5cclxufSkod2luZG93LCBkb2N1bWVudCk7XHJcbiIsIi8qKlxyXG4gKiBCb29raW5nIENhbGVuZGFyIOKAlCBHZW5lcmljIFVJIFRhYnMgVXRpbGl0eSAoSlMpXHJcbiAqXHJcbiAqIFB1cnBvc2U6IExpZ2h0d2VpZ2h0LCBkZXBlbmRlbmN5LWZyZWUgdGFicyBjb250cm9sbGVyIGZvciBhbnkgc21hbGwgdGFiIGdyb3VwIGluIGFkbWluIFVJcy5cclxuICogLSBBdXRvLWluaXRpYWxpemVzIGdyb3VwcyBtYXJrZWQgd2l0aCBkYXRhLXdwYmMtdGFicy5cclxuICogLSBBc3NpZ25zIEFSSUEgcm9sZXMgYW5kIHRvZ2dsZXMgYXJpYS1zZWxlY3RlZC9hcmlhLWhpZGRlbi90YWJpbmRleC5cclxuICogLSBTdXBwb3J0cyBrZXlib2FyZCBuYXZpZ2F0aW9uIChMZWZ0L1JpZ2h0L0hvbWUvRW5kKS5cclxuICogLSBQdWJsaWMgQVBJOiB3aW5kb3cud3BiY191aV90YWJzLntpbml0X29uLCBpbml0X2dyb3VwLCBzZXRfYWN0aXZlfVxyXG4gKiAtIEVtaXRzICd3cGJjOnRhYnM6Y2hhbmdlJyBvbiB0aGUgZ3JvdXAgcm9vdCB3aGVuIHRoZSBhY3RpdmUgdGFiIGNoYW5nZXMuXHJcbiAqXHJcbiAqIE1hcmt1cCBjb250cmFjdDpcclxuICogLSBSb290OiAgIFtkYXRhLXdwYmMtdGFic11cclxuICogLSBUYWJzOiAgIFtkYXRhLXdwYmMtdGFiLWtleT1cIktcIl1cclxuICogLSBQYW5lbHM6IFtkYXRhLXdwYmMtdGFiLXBhbmVsPVwiS1wiXVxyXG4gKlxyXG4gKiBAcGFja2FnZSAgIEJvb2tpbmcgQ2FsZW5kYXJcclxuICogQHN1YnBhY2thZ2UgQWRtaW5cXFVJXHJcbiAqIEBzaW5jZSAgICAgMTEuMC4wXHJcbiAqIEB2ZXJzaW9uICAgMS4wLjBcclxuICogQHNlZSAgICAgICAvaW5jbHVkZXMvX19qcy9hZG1pbi91aV90YWJzL3VpX3RhYnMuanNcclxuICpcclxuICpcclxuICogSG93IGl0IHdvcmtzOlxyXG4gKiAtIFJvb3Qgbm9kZSBtdXN0IGhhdmUgW2RhdGEtd3BiYy10YWJzXSBhdHRyaWJ1dGUgKGFueSB2YWx1ZSkuXHJcbiAqIC0gVGFiIGJ1dHRvbnMgbXVzdCBjYXJyeSBbZGF0YS13cGJjLXRhYi1rZXk9XCIuLi5cIl0gKHVuaXF1ZSBwZXIgZ3JvdXApLlxyXG4gKiAtIFBhbmVscyBtdXN0IGNhcnJ5IFtkYXRhLXdwYmMtdGFiLXBhbmVsPVwiLi4uXCJdIHdpdGggbWF0Y2hpbmcga2V5cy5cclxuICogLSBBZGRzIFdBSS1BUklBIHJvbGVzIGFuZCBhcmlhLXNlbGVjdGVkL2hpZGRlbiB3aXJpbmcuXHJcbiAqXHJcbiAqIDxkaXYgZGF0YS13cGJjLXRhYnM9XCJjb2x1bW4tc3R5bGVzXCIgZGF0YS13cGJjLXRhYi1hY3RpdmU9XCIxXCIgICAgY2xhc3M9XCJ3cGJjX3VpX3RhYnNfcm9vdFwiID5cclxuICogICAgPCEtLSBUb3AgVGFicyAtLT5cclxuICogICAgPGRpdiBkYXRhLXdwYmMtdGFibGlzdD1cIlwiIHJvbGU9XCJ0YWJsaXN0XCIgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwiIHdwYmNfdWlfZWxfX2hvcmlzX3RvcF9iYXJfX3dyYXBwZXJcIiA+XHJcbiAqICAgICAgICA8ZGl2IGNsYXNzPVwid3BiY191aV9lbF9faG9yaXNfdG9wX2Jhcl9fY29udGVudFwiPlxyXG4gKiAgICAgICAgICAgIDxoMiBjbGFzcz1cIndwYmNfdWlfZWxfX2hvcmlzX25hdl9sYWJlbFwiPkNvbHVtbjo8L2gyPlxyXG4gKlxyXG4gKiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ3cGJjX3VpX2VsX19ob3Jpc19uYXZfaXRlbSB3cGJjX3VpX2VsX19ob3Jpc19uYXZfaXRlbV9fMVwiPlxyXG4gKiAgICAgICAgICAgICAgICA8YVxyXG4gKiAgICAgICAgICAgICAgICAgICAgZGF0YS13cGJjLXRhYi1rZXk9XCIxXCJcclxuICogICAgICAgICAgICAgICAgICAgIGFyaWEtc2VsZWN0ZWQ9XCJ0cnVlXCIgcm9sZT1cInRhYlwiIHRhYmluZGV4PVwiMFwiIGFyaWEtY29udHJvbHM9XCJ3cGJjX3RhYl9wYW5lbF9jb2xfMVwiXHJcbiAqXHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKTtcIlxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzPVwid3BiY191aV9lbF9faG9yaXNfbmF2X2l0ZW1fX2Egd3BiY191aV9lbF9faG9yaXNfbmF2X2l0ZW1fX3NpbmdsZVwiXHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgaWQ9XCJ3cGJjX3RhYl9jb2xfMVwiXHJcbiAqICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJDb2x1bW4gMVwiXHJcbiAqICAgICAgICAgICAgICAgID48c3BhbiBjbGFzcz1cIndwYmNfdWlfZWxfX2hvcmlzX25hdl90aXRsZVwiPlRpdGxlIDE8L3NwYW4+PC9hPlxyXG4gKiAgICAgICAgICAgIDwvZGl2PlxyXG4gKiAgICAgICAgICAgIC4uLlxyXG4gKiAgICAgICAgPC9kaXY+XHJcbiAqICAgIDwvZGl2PlxyXG4gKiAgICA8IS0tIFRhYnMgQ29udGVudCAtLT5cclxuICogICAgPGRpdiBjbGFzcz1cIndwYmNfdGFiX19wYW5lbCBncm91cF9fZmllbGRzXCIgZGF0YS13cGJjLXRhYi1wYW5lbD1cIjFcIiBpZD1cIndwYmNfdGFiX3BhbmVsX2NvbF8xXCIgcm9sZT1cInRhYnBhbmVsXCIgYXJpYS1sYWJlbGxlZGJ5PVwid3BiY190YWJfY29sXzFcIj5cclxuICogICAgICAgIC4uLlxyXG4gKiAgICA8L2Rpdj5cclxuICogICAgLi4uXHJcbiAqIDwvZGl2PlxyXG4gKlxyXG4gKiBQdWJsaWMgQVBJOlxyXG4gKiAgIC0gd3BiY191aV90YWJzLmluaXRfb24ocm9vdF9vcl9zZWxlY3RvcikgICAvLyBmaW5kIGFuZCBpbml0IGdyb3VwcyB3aXRoaW4gYSBjb250YWluZXJcclxuICogICAtIHdwYmNfdWlfdGFicy5pbml0X2dyb3VwKHJvb3RfZWwpICAgICAgICAgLy8gaW5pdCBhIHNpbmdsZSBncm91cCByb290XHJcbiAqICAgLSB3cGJjX3VpX3RhYnMuc2V0X2FjdGl2ZShyb290X2VsLCBrZXkpICAgIC8vIHByb2dyYW1tYXRpY2FsbHkgY2hhbmdlIGFjdGl2ZSB0YWJcclxuICpcclxuICogRXZlbnRzOlxyXG4gKiAgIC0gRGlzcGF0Y2hlcyBDdXN0b21FdmVudCAnd3BiYzp0YWJzOmNoYW5nZScgb24gcm9vdCB3aGVuIHRhYiBjaGFuZ2VzOlxyXG4gKiAgICAgICBkZXRhaWw6IHsgYWN0aXZlX2tleTogJzInLCBwcmV2X2tleTogJzEnIH1cclxuICpcclxuICogU3dpdGNoIGEgbG9jYWwgKGdlbmVyaWMpIHRhYnMgZ3JvdXAgdG8gdGFiIDM6ICAgICB2YXIgZ3JvdXAgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbZGF0YS13cGJjLXRhYnM9XCJjb2x1bW4tc3R5bGVzXCJdJyk7IGlmICggZ3JvdXAgKSB7IHdwYmNfdWlfdGFicy5zZXRfYWN0aXZlKGdyb3VwLCAnMycpOyB9XHJcbiAqL1xyXG4oZnVuY3Rpb24gKCB3ICkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0aWYgKCB3LndwYmNfdWlfdGFicyApIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEludGVybmFsOiB0b2dnbGUgYWN0aXZlIHN0YXRlLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm9vdF9lbFxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgIGtleVxyXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gICAgIHNob3VsZF9lbWl0XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gc2V0X2FjdGl2ZV9pbnRlcm5hbCggcm9vdF9lbCwga2V5LCBzaG91bGRfZW1pdCApIHtcclxuXHRcdHZhciB0YWJfYnRucyA9IHJvb3RfZWwucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdGFiLWtleV0nICk7XHJcblx0XHR2YXIgcGFuZWxzICAgPSByb290X2VsLnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXRhYi1wYW5lbF0nICk7XHJcblxyXG5cdFx0dmFyIHByZXZfa2V5ID0gcm9vdF9lbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGFiLWFjdGl2ZScgKSB8fCBudWxsO1xyXG5cdFx0aWYgKCBTdHJpbmcoIHByZXZfa2V5ICkgPT09IFN0cmluZygga2V5ICkgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBCdXR0b25zOiBhcmlhICsgY2xhc3NcclxuXHRcdGZvciAoIHZhciBpID0gMDsgaSA8IHRhYl9idG5zLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHR2YXIgYnRuICAgPSB0YWJfYnRuc1tpXTtcclxuXHRcdFx0dmFyIGJfa2V5ID0gYnRuLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10YWIta2V5JyApO1xyXG5cdFx0XHR2YXIgaXNfb24gPSBTdHJpbmcoIGJfa2V5ICkgPT09IFN0cmluZygga2V5ICk7XHJcblxyXG5cdFx0XHRidG4uc2V0QXR0cmlidXRlKCAncm9sZScsICd0YWInICk7XHJcblx0XHRcdGJ0bi5zZXRBdHRyaWJ1dGUoICdhcmlhLXNlbGVjdGVkJywgaXNfb24gPyAndHJ1ZScgOiAnZmFsc2UnICk7XHJcblx0XHRcdGJ0bi5zZXRBdHRyaWJ1dGUoICd0YWJpbmRleCcsIGlzX29uID8gJzAnIDogJy0xJyApO1xyXG5cclxuXHRcdFx0aWYgKCBpc19vbiApIHtcclxuXHRcdFx0XHRidG4uY2xhc3NMaXN0LmFkZCggJ2FjdGl2ZScgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRidG4uY2xhc3NMaXN0LnJlbW92ZSggJ2FjdGl2ZScgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFBhbmVsczogYXJpYSArIHZpc2liaWxpdHlcclxuXHRcdGZvciAoIHZhciBqID0gMDsgaiA8IHBhbmVscy5sZW5ndGg7IGorKyApIHtcclxuXHRcdFx0dmFyIHBuICAgPSBwYW5lbHNbal07XHJcblx0XHRcdHZhciBwa2V5ID0gcG4uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRhYi1wYW5lbCcgKTtcclxuXHRcdFx0dmFyIHNob3cgPSBTdHJpbmcoIHBrZXkgKSA9PT0gU3RyaW5nKCBrZXkgKTtcclxuXHJcblx0XHRcdHBuLnNldEF0dHJpYnV0ZSggJ3JvbGUnLCAndGFicGFuZWwnICk7XHJcblx0XHRcdHBuLnNldEF0dHJpYnV0ZSggJ2FyaWEtaGlkZGVuJywgc2hvdyA/ICdmYWxzZScgOiAndHJ1ZScgKTtcclxuXHRcdFx0aWYgKCBzaG93ICkge1xyXG5cdFx0XHRcdHBuLnJlbW92ZUF0dHJpYnV0ZSggJ2hpZGRlbicgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRwbi5zZXRBdHRyaWJ1dGUoICdoaWRkZW4nLCAnJyApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cm9vdF9lbC5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGFiLWFjdGl2ZScsIFN0cmluZygga2V5ICkgKTtcclxuXHJcblx0XHRpZiAoIHNob3VsZF9lbWl0ICkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHZhciBldiA9IG5ldyB3LkN1c3RvbUV2ZW50KCAnd3BiYzp0YWJzOmNoYW5nZScsIHtcclxuXHRcdFx0XHRcdGJ1YmJsZXMgOiB0cnVlLFxyXG5cdFx0XHRcdFx0ZGV0YWlsICA6IHsgYWN0aXZlX2tleSA6IFN0cmluZygga2V5ICksIHByZXZfa2V5IDogcHJldl9rZXkgfVxyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRyb290X2VsLmRpc3BhdGNoRXZlbnQoIGV2ICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBfZSApIHt9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBJbnRlcm5hbDogZ2V0IG9yZGVyZWQga2V5cyBmcm9tIGJ1dHRvbnMuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb290X2VsXHJcblx0ICogQHJldHVybnMge3N0cmluZ1tdfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGdldF9rZXlzKCByb290X2VsICkge1xyXG5cdFx0dmFyIGxpc3QgPSBbXTtcclxuXHRcdHZhciBidG5zID0gcm9vdF9lbC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy10YWIta2V5XScgKTtcclxuXHRcdGZvciAoIHZhciBpID0gMDsgaSA8IGJ0bnMubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdHZhciBrID0gYnRuc1tpXS5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGFiLWtleScgKTtcclxuXHRcdFx0aWYgKCBrICE9IG51bGwgJiYgayAhPT0gJycgKSB7XHJcblx0XHRcdFx0bGlzdC5wdXNoKCBTdHJpbmcoIGsgKSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gbGlzdDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEludGVybmFsOiBtb3ZlIGZvY3VzIGJldHdlZW4gdGFicyB1c2luZyBrZXlib2FyZC5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvb3RfZWxcclxuXHQgKiBAcGFyYW0ge251bWJlcn0gICAgICBkaXIgICsxIChuZXh0KSAvIC0xIChwcmV2KVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGZvY3VzX3JlbGF0aXZlKCByb290X2VsLCBkaXIgKSB7XHJcblx0XHR2YXIga2V5cyAgICA9IGdldF9rZXlzKCByb290X2VsICk7XHJcblx0XHR2YXIgY3VycmVudCA9IHJvb3RfZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRhYi1hY3RpdmUnICkgfHwga2V5c1swXSB8fCBudWxsO1xyXG5cdFx0dmFyIGlkeCAgICAgPSBNYXRoLm1heCggMCwga2V5cy5pbmRleE9mKCBTdHJpbmcoIGN1cnJlbnQgKSApICk7XHJcblx0XHR2YXIgbmV4dCAgICA9IGtleXNbICggaWR4ICsgKCBkaXIgPiAwID8gMSA6IGtleXMubGVuZ3RoIC0gMSApICkgJSBrZXlzLmxlbmd0aCBdO1xyXG5cclxuXHRcdHZhciBuZXh0X2J0biA9IHJvb3RfZWwucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGFiLWtleT1cIicgKyBuZXh0ICsgJ1wiXScgKTtcclxuXHRcdGlmICggbmV4dF9idG4gKSB7XHJcblx0XHRcdG5leHRfYnRuLmZvY3VzKCk7XHJcblx0XHRcdHNldF9hY3RpdmVfaW50ZXJuYWwoIHJvb3RfZWwsIG5leHQsIHRydWUgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEluaXRpYWxpemUgYSBzaW5nbGUgdGFicyBncm91cCByb290LlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm9vdF9lbFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGluaXRfZ3JvdXAoIHJvb3RfZWwgKSB7XHJcblx0XHRpZiAoICEgcm9vdF9lbCB8fCByb290X2VsLl9fd3BiY190YWJzX2luaXRlZCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0cm9vdF9lbC5fX3dwYmNfdGFic19pbml0ZWQgPSB0cnVlO1xyXG5cclxuXHRcdC8vIFJvbGVzXHJcblx0XHR2YXIgdGFibGlzdCA9IHJvb3RfZWwucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGFibGlzdF0nICkgfHwgcm9vdF9lbDtcclxuXHRcdHRhYmxpc3Quc2V0QXR0cmlidXRlKCAncm9sZScsICd0YWJsaXN0JyApO1xyXG5cclxuXHRcdC8vIERlZmF1bHQgYWN0aXZlOiBmcm9tIGF0dHJpYnV0ZSBvciBmaXJzdCBidXR0b25cclxuXHRcdHZhciBrZXlzID0gZ2V0X2tleXMoIHJvb3RfZWwgKTtcclxuXHRcdHZhciBkZWYgID0gcm9vdF9lbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGFiLWFjdGl2ZScgKSB8fCAoIGtleXNbMF0gfHwgJzEnICk7XHJcblx0XHRzZXRfYWN0aXZlX2ludGVybmFsKCByb290X2VsLCBkZWYsIGZhbHNlICk7XHJcblxyXG5cdFx0Ly8gQ2xpY2tzXHJcblx0XHRyb290X2VsLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uICggZSApIHtcclxuXHRcdFx0dmFyIGJ0biA9IGUudGFyZ2V0LmNsb3Nlc3QgPyBlLnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10YWIta2V5XScgKSA6IG51bGw7XHJcblx0XHRcdGlmICggISBidG4gfHwgISByb290X2VsLmNvbnRhaW5zKCBidG4gKSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHR2YXIga2V5ID0gYnRuLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10YWIta2V5JyApO1xyXG5cdFx0XHRpZiAoIGtleSAhPSBudWxsICkge1xyXG5cdFx0XHRcdHNldF9hY3RpdmVfaW50ZXJuYWwoIHJvb3RfZWwsIGtleSwgdHJ1ZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9LCB0cnVlICk7XHJcblxyXG5cdFx0Ly8gS2V5Ym9hcmQgKExlZnQvUmlnaHQvSG9tZS9FbmQpXHJcblx0XHRyb290X2VsLmFkZEV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgZnVuY3Rpb24gKCBlICkge1xyXG5cdFx0XHR2YXIgdGd0ID0gZS50YXJnZXQ7XHJcblx0XHRcdGlmICggISB0Z3QgfHwgISB0Z3QuaGFzQXR0cmlidXRlIHx8ICEgdGd0Lmhhc0F0dHJpYnV0ZSggJ2RhdGEtd3BiYy10YWIta2V5JyApICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRzd2l0Y2ggKCBlLmtleSApIHtcclxuXHRcdFx0Y2FzZSAnQXJyb3dMZWZ0JzpcclxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7IGZvY3VzX3JlbGF0aXZlKCByb290X2VsLCAtMSApOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnQXJyb3dSaWdodCc6XHJcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpOyBmb2N1c19yZWxhdGl2ZSggcm9vdF9lbCwgKzEgKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ0hvbWUnOlxyXG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTsgc2V0X2FjdGl2ZV9pbnRlcm5hbCggcm9vdF9lbCwgKCBnZXRfa2V5cyggcm9vdF9lbCApWzBdIHx8ICcxJyApLCB0cnVlICk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdFbmQnOlxyXG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTsgdmFyIGtzID0gZ2V0X2tleXMoIHJvb3RfZWwgKTsgc2V0X2FjdGl2ZV9pbnRlcm5hbCggcm9vdF9lbCwgKCBrc1sga3MubGVuZ3RoIC0gMSBdIHx8ICcxJyApLCB0cnVlICk7IGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHR9LCB0cnVlICk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBJbml0aWFsaXplIGFsbCBncm91cHMgd2l0aGluIGEgY29udGFpbmVyIChvciBkb2N1bWVudCkuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fHN0cmluZ3xudWxsfSBjb250YWluZXJcclxuXHQgKi9cclxuXHRmdW5jdGlvbiBpbml0X29uKCBjb250YWluZXIgKSB7XHJcblx0XHR2YXIgY3R4ID0gY29udGFpbmVyID8gKCB0eXBlb2YgY29udGFpbmVyID09PSAnc3RyaW5nJyA/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoIGNvbnRhaW5lciApIDogY29udGFpbmVyICkgOiBkb2N1bWVudDtcclxuXHRcdGlmICggISBjdHggKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHZhciBncm91cHMgPSBjdHgucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdGFic10nICk7XHJcblx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBncm91cHMubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdGluaXRfZ3JvdXAoIGdyb3Vwc1tpXSApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUHJvZ3JhbW1hdGljYWxseSBzZXQgYWN0aXZlIHRhYiBieSBrZXkuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb290X2VsXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8bnVtYmVyfSBrZXlcclxuXHQgKi9cclxuXHRmdW5jdGlvbiBzZXRfYWN0aXZlKCByb290X2VsLCBrZXkgKSB7XHJcblx0XHRpZiAoIHJvb3RfZWwgJiYgcm9vdF9lbC5oYXNBdHRyaWJ1dGUgJiYgcm9vdF9lbC5oYXNBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGFicycgKSApIHtcclxuXHRcdFx0c2V0X2FjdGl2ZV9pbnRlcm5hbCggcm9vdF9lbCwgU3RyaW5nKCBrZXkgKSwgdHJ1ZSApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gUHVibGljIEFQSSAoc25ha2VfY2FzZSlcclxuXHR3LndwYmNfdWlfdGFicyA9IHtcclxuXHRcdGluaXRfb24gICAgOiBpbml0X29uLFxyXG5cdFx0aW5pdF9ncm91cCA6IGluaXRfZ3JvdXAsXHJcblx0XHRzZXRfYWN0aXZlIDogc2V0X2FjdGl2ZVxyXG5cdH07XHJcblxyXG5cdC8vIEF1dG8taW5pdCBvbiBET00gcmVhZHlcclxuXHRpZiAoIGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJyApIHtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdET01Db250ZW50TG9hZGVkJywgZnVuY3Rpb24gKCkgeyBpbml0X29uKCBkb2N1bWVudCApOyB9ICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGluaXRfb24oIGRvY3VtZW50ICk7XHJcblx0fVxyXG5cclxufSkoIHdpbmRvdyApO1xyXG4iXX0=
