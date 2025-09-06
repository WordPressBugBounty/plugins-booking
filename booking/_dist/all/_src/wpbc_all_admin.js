
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
 * Expand Vertical Left Bar.
 */
function wpbc_admin_ui__sidebar_left__do_max() {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min max compact none' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'max' );
	jQuery( '.wpbc_ui__top_nav__btn_open_left_vertical_nav' ).addClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_left_vertical_nav' ).removeClass( 'wpbc_ui__hide' );

	jQuery( '.wp-admin' ).removeClass( 'wpbc_page_wrapper_left_min wpbc_page_wrapper_left_max wpbc_page_wrapper_left_compact wpbc_page_wrapper_left_none' );
	jQuery( '.wp-admin' ).addClass( 'wpbc_page_wrapper_left_max' );
}

/**
 * Hide Vertical Left Bar.
 */
function wpbc_admin_ui__sidebar_left__do_min() {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min max compact none' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'min' );
	jQuery( '.wpbc_ui__top_nav__btn_open_left_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_left_vertical_nav' ).addClass( 'wpbc_ui__hide' );

	jQuery( '.wp-admin' ).removeClass( 'wpbc_page_wrapper_left_min wpbc_page_wrapper_left_max wpbc_page_wrapper_left_compact wpbc_page_wrapper_left_none' );
	jQuery( '.wp-admin' ).addClass( 'wpbc_page_wrapper_left_min' );
}

/**
 * Colapse Vertical Left Bar.
 */
function wpbc_admin_ui__sidebar_left__do_compact() {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min max compact none' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'compact' );
	jQuery( '.wpbc_ui__top_nav__btn_open_left_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_left_vertical_nav' ).addClass( 'wpbc_ui__hide' );

	jQuery( '.wp-admin' ).removeClass( 'wpbc_page_wrapper_left_min wpbc_page_wrapper_left_max wpbc_page_wrapper_left_compact wpbc_page_wrapper_left_none' );
	jQuery( '.wp-admin' ).addClass( 'wpbc_page_wrapper_left_compact' );
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
 * Expand Vertical Right Bar.
 */
function wpbc_admin_ui__sidebar_right__do_max() {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min_right max_right compact_right none_right' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'max_right' );
	jQuery( '.wpbc_ui__top_nav__btn_open_right_vertical_nav' ).addClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_right_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
}

/**
 * Hide Vertical Right Bar.
 */
function wpbc_admin_ui__sidebar_right__do_min() {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min_right max_right compact_right none_right' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'min_right' );
	jQuery( '.wpbc_ui__top_nav__btn_open_right_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_right_vertical_nav' ).addClass( 'wpbc_ui__hide' );
}

/**
 * Colapse Vertical Right Bar.
 */
function wpbc_admin_ui__sidebar_right__do_compact() {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min_right max_right compact_right none_right' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'compact_right' );
	jQuery( '.wpbc_ui__top_nav__btn_open_right_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_right_vertical_nav' ).addClass( 'wpbc_ui__hide' );
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
}

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
jQuery( document ).ready( function () { wpbc_admin_ui__do_expand_section(); setTimeout( 'wpbc_admin_ui__do_expand_section', 10 ); } );
jQuery( document ).ready( function () { wpbc_admin_ui__do_expand_section(); setTimeout( 'wpbc_admin_ui__do_expand_section', 150 ); } );

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
				fields_selector: '.group__fields',
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
			const panel   = group.querySelector( this.opts.fields_selector );

			if ( header ) {
				// Header is a real <button>, role is harmless here.
				header.setAttribute( 'role', 'button' );
				header.setAttribute( 'aria-expanded', is_open ? 'true' : 'false' );

				// Link header to panel by id if available.
				if ( panel ) {
					if ( !panel.id ) {
						panel.id = this._generate_id( 'wpbc_collapsible_panel' );
					}
					if ( !header.hasAttribute( 'aria-controls' ) ) {
						header.setAttribute( 'aria-controls', panel.id );
					}
				}
			}
			if ( panel ) {
				panel.hidden = !is_open;
				panel.setAttribute( 'aria-hidden', is_open ? 'false' : 'true' );
				// Optional landmark:
				// panel.setAttribute('role', 'region');
				// panel.setAttribute('aria-labelledby', header.id || (header.id = this._generate_id('wpbc_collapsible_header')));
			}
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVpX2VsZW1lbnRzLmpzIiwidWlfbG9hZGluZ19zcGluLmpzIiwidWlfcmFkaW9fY29udGFpbmVyLmpzIiwidWlfZnVsbF9zY3JlZW5fbW9kZS5qcyIsImdtYWlsX2NoZWNrYm94X3NlbGVjdGlvbi5qcyIsImJvb2tpbmdzX2NoZWNrYm94X3NlbGVjdGlvbi5qcyIsInVpX3NpZGViYXJfbGVmdF9fYWN0aW9ucy5qcyIsImNvcHlfdGV4dF90b19jbGlwYnJkLmpzIiwiY29sbGFwc2libGVfZ3JvdXBzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNqSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3BEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzdSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3JIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoid3BiY19hbGxfYWRtaW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyJcclxuLyoqXHJcbiAqIEJsaW5rIHNwZWNpZmljIEhUTUwgZWxlbWVudCB0byBzZXQgYXR0ZW50aW9uIHRvIHRoaXMgZWxlbWVudC5cclxuICpcclxuICogQHBhcmFtIHtzdHJpbmd9IGVsZW1lbnRfdG9fYmxpbmtcdFx0ICAtIGNsYXNzIG9yIGlkIG9mIGVsZW1lbnQ6ICcud3BiY193aWRnZXRfYXZhaWxhYmxlX3VuYXZhaWxhYmxlJ1xyXG4gKiBAcGFyYW0ge2ludH0gaG93X21hbnlfdGltZXNcdFx0XHQgIC0gNFxyXG4gKiBAcGFyYW0ge2ludH0gaG93X2xvbmdfdG9fYmxpbmtcdFx0ICAtIDM1MFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ibGlua19lbGVtZW50KCBlbGVtZW50X3RvX2JsaW5rLCBob3dfbWFueV90aW1lcyA9IDQsIGhvd19sb25nX3RvX2JsaW5rID0gMzUwICl7XHJcblxyXG5cdGZvciAoIGxldCBpID0gMDsgaSA8IGhvd19tYW55X3RpbWVzOyBpKysgKXtcclxuXHRcdGpRdWVyeSggZWxlbWVudF90b19ibGluayApLmZhZGVPdXQoIGhvd19sb25nX3RvX2JsaW5rICkuZmFkZUluKCBob3dfbG9uZ190b19ibGluayApO1xyXG5cdH1cclxuICAgIGpRdWVyeSggZWxlbWVudF90b19ibGluayApLmFuaW1hdGUoIHtvcGFjaXR5OiAxfSwgNTAwICk7XHJcbn1cclxuIiwiLyoqXHJcbiAqICAgU3VwcG9ydCBGdW5jdGlvbnMgLSBTcGluIEljb24gaW4gQnV0dG9ucyAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogUmVtb3ZlIHNwaW4gaWNvbiBmcm9tICBidXR0b24gYW5kIEVuYWJsZSB0aGlzIGJ1dHRvbi5cclxuICpcclxuICogQHBhcmFtIGJ1dHRvbl9jbGlja2VkX2VsZW1lbnRfaWRcdFx0LSBIVE1MIElEIGF0dHJpYnV0ZSBvZiB0aGlzIGJ1dHRvblxyXG4gKiBAcmV0dXJuIHN0cmluZ1x0XHRcdFx0XHRcdC0gQ1NTIGNsYXNzZXMgdGhhdCB3YXMgcHJldmlvdXNseSBpbiBidXR0b24gaWNvblxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19idXR0b25fX3JlbW92ZV9zcGluKGJ1dHRvbl9jbGlja2VkX2VsZW1lbnRfaWQpIHtcclxuXHJcblx0dmFyIHByZXZpb3NfY2xhc3NlcyA9ICcnO1xyXG5cdGlmIChcclxuXHRcdCh1bmRlZmluZWQgIT0gYnV0dG9uX2NsaWNrZWRfZWxlbWVudF9pZClcclxuXHRcdCYmICgnJyAhPSBidXR0b25fY2xpY2tlZF9lbGVtZW50X2lkKVxyXG5cdCkge1xyXG5cdFx0dmFyIGpFbGVtZW50ID0galF1ZXJ5KCAnIycgKyBidXR0b25fY2xpY2tlZF9lbGVtZW50X2lkICk7XHJcblx0XHRpZiAoIGpFbGVtZW50Lmxlbmd0aCApIHtcclxuXHRcdFx0cHJldmlvc19jbGFzc2VzID0gd3BiY19idXR0b25fZGlzYWJsZV9sb2FkaW5nX2ljb24oIGpFbGVtZW50LmdldCggMCApICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gcHJldmlvc19jbGFzc2VzO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFNob3cgTG9hZGluZyAocm90YXRpbmcgYXJyb3cpIGljb24gZm9yIGJ1dHRvbiB0aGF0IGhhcyBiZWVuIGNsaWNrZWRcclxuICpcclxuICogQHBhcmFtIHRoaXNfYnV0dG9uXHRcdC0gdGhpcyBvYmplY3Qgb2Ygc3BlY2lmaWMgYnV0dG9uXHJcbiAqIEByZXR1cm4gc3RyaW5nXHRcdFx0LSBDU1MgY2xhc3NlcyB0aGF0IHdhcyBwcmV2aW91c2x5IGluIGJ1dHRvbiBpY29uXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2J1dHRvbl9lbmFibGVfbG9hZGluZ19pY29uKHRoaXNfYnV0dG9uKSB7XHJcblxyXG5cdHZhciBqQnV0dG9uICAgICAgICAgPSBqUXVlcnkoIHRoaXNfYnV0dG9uICk7XHJcblx0dmFyIGpJY29uICAgICAgICAgICA9IGpCdXR0b24uZmluZCggJ2knICk7XHJcblx0dmFyIHByZXZpb3NfY2xhc3NlcyA9IGpJY29uLmF0dHIoICdjbGFzcycgKTtcclxuXHJcblx0akljb24ucmVtb3ZlQ2xhc3MoKS5hZGRDbGFzcyggJ21lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX3JvdGF0ZV9yaWdodCB3cGJjX3NwaW4nICk7XHQvLyBTZXQgUm90YXRlIGljb24uXHJcblx0Ly8gakljb24uYWRkQ2xhc3MoICd3cGJjX2FuaW1hdGlvbl9wYXVzZScgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBQYXVzZSBhbmltYXRpb24uXHJcblx0Ly8gakljb24uYWRkQ2xhc3MoICd3cGJjX3VpX3JlZCcgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gU2V0IGljb24gY29sb3IgcmVkLlxyXG5cclxuXHRqSWNvbi5hdHRyKCAnd3BiY19wcmV2aW91c19jbGFzcycsIHByZXZpb3NfY2xhc3NlcyApXHJcblxyXG5cdGpCdXR0b24uYWRkQ2xhc3MoICdkaXNhYmxlZCcgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBEaXNhYmxlIGJ1dHRvblxyXG5cdC8vIFdlIG5lZWQgdG8gIHNldCAgaGVyZSBhdHRyIGluc3RlYWQgb2YgcHJvcCwgYmVjYXVzZSBmb3IgQSBlbGVtZW50cywgIGF0dHJpYnV0ZSAnZGlzYWJsZWQnIGRvICBub3QgYWRkZWQgd2l0aCBqQnV0dG9uLnByb3AoIFwiZGlzYWJsZWRcIiwgdHJ1ZSApOy5cclxuXHJcblx0akJ1dHRvbi5hdHRyKCAnd3BiY19wcmV2aW91c19vbmNsaWNrJywgakJ1dHRvbi5hdHRyKCAnb25jbGljaycgKSApO1x0XHQvLyBTYXZlIHRoaXMgdmFsdWUuXHJcblx0akJ1dHRvbi5hdHRyKCAnb25jbGljaycsICcnICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIERpc2FibGUgYWN0aW9ucyBcIm9uIGNsaWNrXCIuXHJcblxyXG5cdHJldHVybiBwcmV2aW9zX2NsYXNzZXM7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogSGlkZSBMb2FkaW5nIChyb3RhdGluZyBhcnJvdykgaWNvbiBmb3IgYnV0dG9uIHRoYXQgd2FzIGNsaWNrZWQgYW5kIHNob3cgcHJldmlvdXMgaWNvbiBhbmQgZW5hYmxlIGJ1dHRvblxyXG4gKlxyXG4gKiBAcGFyYW0gdGhpc19idXR0b25cdFx0LSB0aGlzIG9iamVjdCBvZiBzcGVjaWZpYyBidXR0b25cclxuICogQHJldHVybiBzdHJpbmdcdFx0XHQtIENTUyBjbGFzc2VzIHRoYXQgd2FzIHByZXZpb3VzbHkgaW4gYnV0dG9uIGljb25cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYnV0dG9uX2Rpc2FibGVfbG9hZGluZ19pY29uKHRoaXNfYnV0dG9uKSB7XHJcblxyXG5cdHZhciBqQnV0dG9uID0galF1ZXJ5KCB0aGlzX2J1dHRvbiApO1xyXG5cdHZhciBqSWNvbiAgID0gakJ1dHRvbi5maW5kKCAnaScgKTtcclxuXHJcblx0dmFyIHByZXZpb3NfY2xhc3NlcyA9IGpJY29uLmF0dHIoICd3cGJjX3ByZXZpb3VzX2NsYXNzJyApO1xyXG5cdGlmIChcclxuXHRcdCh1bmRlZmluZWQgIT0gcHJldmlvc19jbGFzc2VzKVxyXG5cdFx0JiYgKCcnICE9IHByZXZpb3NfY2xhc3NlcylcclxuXHQpIHtcclxuXHRcdGpJY29uLnJlbW92ZUNsYXNzKCkuYWRkQ2xhc3MoIHByZXZpb3NfY2xhc3NlcyApO1xyXG5cdH1cclxuXHJcblx0akJ1dHRvbi5yZW1vdmVDbGFzcyggJ2Rpc2FibGVkJyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFJlbW92ZSBEaXNhYmxlIGJ1dHRvbi5cclxuXHJcblx0dmFyIHByZXZpb3VzX29uY2xpY2sgPSBqQnV0dG9uLmF0dHIoICd3cGJjX3ByZXZpb3VzX29uY2xpY2snIClcclxuXHRpZiAoXHJcblx0XHQodW5kZWZpbmVkICE9IHByZXZpb3VzX29uY2xpY2spXHJcblx0XHQmJiAoJycgIT0gcHJldmlvdXNfb25jbGljaylcclxuXHQpIHtcclxuXHRcdGpCdXR0b24uYXR0ciggJ29uY2xpY2snLCBwcmV2aW91c19vbmNsaWNrICk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gcHJldmlvc19jbGFzc2VzO1xyXG59XHJcbiIsIi8qKlxyXG4gKiBPbiBzZWxlY3Rpb24gIG9mIHJhZGlvIGJ1dHRvbiwgYWRqdXN0IGF0dHJpYnV0ZXMgb2YgcmFkaW8gY29udGFpbmVyXHJcbiAqXHJcbiAqIEBwYXJhbSBfdGhpc1xyXG4gKi9cclxuZnVuY3Rpb24gd3BiY191aV9lbF9fcmFkaW9fY29udGFpbmVyX3NlbGVjdGlvbihfdGhpcykge1xyXG5cclxuXHRpZiAoIGpRdWVyeSggX3RoaXMgKS5pcyggJzpjaGVja2VkJyApICkge1xyXG5cdFx0alF1ZXJ5KCBfdGhpcyApLnBhcmVudHMoICcud3BiY191aV9yYWRpb19zZWN0aW9uJyApLmZpbmQoICcud3BiY191aV9yYWRpb19jb250YWluZXInICkucmVtb3ZlQXR0ciggJ2RhdGEtc2VsZWN0ZWQnICk7XHJcblx0XHRqUXVlcnkoIF90aGlzICkucGFyZW50cyggJy53cGJjX3VpX3JhZGlvX2NvbnRhaW5lcjpub3QoLmRpc2FibGVkKScgKS5hdHRyKCAnZGF0YS1zZWxlY3RlZCcsIHRydWUgKTtcclxuXHR9XHJcblxyXG5cdGlmICggalF1ZXJ5KCBfdGhpcyApLmlzKCAnOmRpc2FibGVkJyApICkge1xyXG5cdFx0alF1ZXJ5KCBfdGhpcyApLnBhcmVudHMoICcud3BiY191aV9yYWRpb19jb250YWluZXInICkuYWRkQ2xhc3MoICdkaXNhYmxlZCcgKTtcclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBPbiBjbGljayBvbiBSYWRpbyBDb250YWluZXIsIHdlIHdpbGwgIHNlbGVjdCAgdGhlICByYWRpbyBidXR0b24gICAgYW5kIHRoZW4gYWRqdXN0IGF0dHJpYnV0ZXMgb2YgcmFkaW8gY29udGFpbmVyXHJcbiAqXHJcbiAqIEBwYXJhbSBfdGhpc1xyXG4gKi9cclxuZnVuY3Rpb24gd3BiY191aV9lbF9fcmFkaW9fY29udGFpbmVyX2NsaWNrKF90aGlzKSB7XHJcblxyXG5cdGlmICggalF1ZXJ5KCBfdGhpcyApLmhhc0NsYXNzKCAnZGlzYWJsZWQnICkgKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHR2YXIgal9yYWRpbyA9IGpRdWVyeSggX3RoaXMgKS5maW5kKCAnaW5wdXRbdHlwZT1yYWRpb106bm90KC53cGJjLWZvcm0tcmFkaW8taW50ZXJuYWwpJyApO1xyXG5cdGlmICggal9yYWRpby5sZW5ndGggKSB7XHJcblx0XHRqX3JhZGlvLnByb3AoICdjaGVja2VkJywgdHJ1ZSApLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblx0fVxyXG5cclxufSIsIlwidXNlIHN0cmljdFwiO1xyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gPT0gRnVsbCBTY3JlZW4gIC0gIHN1cHBvcnQgZnVuY3Rpb25zICAgPT1cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4vKipcclxuICogQ2hlY2sgRnVsbCAgc2NyZWVuIG1vZGUsICBieSAgcmVtb3ZpbmcgdG9wIHRhYlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jaGVja19mdWxsX3NjcmVlbl9tb2RlKCl7XHJcblx0aWYgKCBqUXVlcnkoICdib2R5JyApLmhhc0NsYXNzKCAnd3BiY19hZG1pbl9mdWxsX3NjcmVlbicgKSApIHtcclxuXHRcdGpRdWVyeSggJ2h0bWwnICkucmVtb3ZlQ2xhc3MoICd3cC10b29sYmFyJyApO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRqUXVlcnkoICdodG1sJyApLmFkZENsYXNzKCAnd3AtdG9vbGJhcicgKTtcclxuXHR9XHJcblx0d3BiY19jaGVja19idXR0b25zX21heF9taW5faW5fZnVsbF9zY3JlZW5fbW9kZSgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2NoZWNrX2J1dHRvbnNfbWF4X21pbl9pbl9mdWxsX3NjcmVlbl9tb2RlKCkge1xyXG5cdGlmICggalF1ZXJ5KCAnYm9keScgKS5oYXNDbGFzcyggJ3dwYmNfYWRtaW5fZnVsbF9zY3JlZW4nICkgKSB7XHJcblx0XHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2Z1bGxfc2NyZWVuJyAgICkuYWRkQ2xhc3MoICAgICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdFx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9ub3JtYWxfc2NyZWVuJyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9mdWxsX3NjcmVlbicgICApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHRcdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fbm9ybWFsX3NjcmVlbicgKS5hZGRDbGFzcyggICAgJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0fVxyXG59XHJcblxyXG5qUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uICgpIHtcclxuXHR3cGJjX2NoZWNrX2Z1bGxfc2NyZWVuX21vZGUoKTtcclxufSApOyIsIi8qKlxyXG4gKiBDaGVja2JveCBTZWxlY3Rpb24gZnVuY3Rpb25zIGZvciBMaXN0aW5nLlxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBTZWxlY3Rpb25zIG9mIHNldmVyYWwgIGNoZWNrYm94ZXMgbGlrZSBpbiBnTWFpbCB3aXRoIHNoaWZ0IDopXHJcbiAqIE5lZWQgdG8gIGhhdmUgdGhpcyBzdHJ1Y3R1cmU6XHJcbiAqIC53cGJjX3NlbGVjdGFibGVfdGFibGVcclxuICogICAgICAud3BiY19zZWxlY3RhYmxlX2hlYWRcclxuICogICAgICAgICAgICAgIC5jaGVjay1jb2x1bW5cclxuICogICAgICAgICAgICAgICAgICA6Y2hlY2tib3hcclxuICogICAgICAud3BiY19zZWxlY3RhYmxlX2JvZHlcclxuICogICAgICAgICAgLndwYmNfcm93XHJcbiAqICAgICAgICAgICAgICAuY2hlY2stY29sdW1uXHJcbiAqICAgICAgICAgICAgICAgICAgOmNoZWNrYm94XHJcbiAqICAgICAgLndwYmNfc2VsZWN0YWJsZV9mb290XHJcbiAqICAgICAgICAgICAgICAuY2hlY2stY29sdW1uXHJcbiAqICAgICAgICAgICAgICAgICAgOmNoZWNrYm94XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2RlZmluZV9nbWFpbF9jaGVja2JveF9zZWxlY3Rpb24oICQgKXtcclxuXHJcblx0dmFyIGNoZWNrcywgZmlyc3QsIGxhc3QsIGNoZWNrZWQsIHNsaWNlZCwgbGFzdENsaWNrZWQgPSBmYWxzZTtcclxuXHJcblx0Ly8gQ2hlY2sgYWxsIGNoZWNrYm94ZXMuXHJcblx0JCggJy53cGJjX3NlbGVjdGFibGVfYm9keScgKS5maW5kKCAnLmNoZWNrLWNvbHVtbicgKS5maW5kKCAnOmNoZWNrYm94JyApLm9uKFxyXG5cdFx0J2NsaWNrJyxcclxuXHRcdGZ1bmN0aW9uIChlKSB7XHJcblx0XHRcdGlmICggJ3VuZGVmaW5lZCcgPT0gZS5zaGlmdEtleSApIHtcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIGUuc2hpZnRLZXkgKSB7XHJcblx0XHRcdFx0aWYgKCAhIGxhc3RDbGlja2VkICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNoZWNrcyAgPSAkKCBsYXN0Q2xpY2tlZCApLmNsb3Nlc3QoICcud3BiY19zZWxlY3RhYmxlX2JvZHknICkuZmluZCggJzpjaGVja2JveCcgKS5maWx0ZXIoICc6dmlzaWJsZTplbmFibGVkJyApO1xyXG5cdFx0XHRcdGZpcnN0ICAgPSBjaGVja3MuaW5kZXgoIGxhc3RDbGlja2VkICk7XHJcblx0XHRcdFx0bGFzdCAgICA9IGNoZWNrcy5pbmRleCggdGhpcyApO1xyXG5cdFx0XHRcdGNoZWNrZWQgPSAkKCB0aGlzICkucHJvcCggJ2NoZWNrZWQnICk7XHJcblx0XHRcdFx0aWYgKCAwIDwgZmlyc3QgJiYgMCA8IGxhc3QgJiYgZmlyc3QgIT0gbGFzdCApIHtcclxuXHRcdFx0XHRcdHNsaWNlZCA9IChsYXN0ID4gZmlyc3QpID8gY2hlY2tzLnNsaWNlKCBmaXJzdCwgbGFzdCApIDogY2hlY2tzLnNsaWNlKCBsYXN0LCBmaXJzdCApO1xyXG5cdFx0XHRcdFx0c2xpY2VkLnByb3AoXHJcblx0XHRcdFx0XHRcdCdjaGVja2VkJyxcclxuXHRcdFx0XHRcdFx0ZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0XHRcdGlmICggJCggdGhpcyApLmNsb3Nlc3QoICcud3BiY19yb3cnICkuaXMoICc6dmlzaWJsZScgKSApIHtcclxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBjaGVja2VkO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdCkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0bGFzdENsaWNrZWQgPSB0aGlzO1xyXG5cclxuXHRcdFx0Ly8gdG9nZ2xlIFwiY2hlY2sgYWxsXCIgY2hlY2tib3hlcy5cclxuXHRcdFx0dmFyIHVuY2hlY2tlZCA9ICQoIHRoaXMgKS5jbG9zZXN0KCAnLndwYmNfc2VsZWN0YWJsZV9ib2R5JyApLmZpbmQoICc6Y2hlY2tib3gnICkuZmlsdGVyKCAnOnZpc2libGU6ZW5hYmxlZCcgKS5ub3QoICc6Y2hlY2tlZCcgKTtcclxuXHRcdFx0JCggdGhpcyApLmNsb3Nlc3QoICcud3BiY19zZWxlY3RhYmxlX3RhYmxlJyApLmNoaWxkcmVuKCAnLndwYmNfc2VsZWN0YWJsZV9oZWFkLCAud3BiY19zZWxlY3RhYmxlX2Zvb3QnICkuZmluZCggJzpjaGVja2JveCcgKS5wcm9wKFxyXG5cdFx0XHRcdCdjaGVja2VkJyxcclxuXHRcdFx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gKDAgPT09IHVuY2hlY2tlZC5sZW5ndGgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0KS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblx0KTtcclxuXHJcblx0Ly8gSGVhZCB8fCBGb290IGNsaWNraW5nIHRvICBzZWxlY3QgLyBkZXNlbGVjdCBBTEwuXHJcblx0JCggJy53cGJjX3NlbGVjdGFibGVfaGVhZCwgLndwYmNfc2VsZWN0YWJsZV9mb290JyApLmZpbmQoICcuY2hlY2stY29sdW1uIDpjaGVja2JveCcgKS5vbihcclxuXHRcdCdjbGljaycsXHJcblx0XHRmdW5jdGlvbiAoZXZlbnQpIHtcclxuXHRcdFx0dmFyICR0aGlzICAgICAgICAgID0gJCggdGhpcyApLFxyXG5cdFx0XHRcdCR0YWJsZSAgICAgICAgID0gJHRoaXMuY2xvc2VzdCggJy53cGJjX3NlbGVjdGFibGVfdGFibGUnICksXHJcblx0XHRcdFx0Y29udHJvbENoZWNrZWQgPSAkdGhpcy5wcm9wKCAnY2hlY2tlZCcgKSxcclxuXHRcdFx0XHR0b2dnbGUgICAgICAgICA9IGV2ZW50LnNoaWZ0S2V5IHx8ICR0aGlzLmRhdGEoICd3cC10b2dnbGUnICk7XHJcblxyXG5cdFx0XHQkdGFibGUuY2hpbGRyZW4oICcud3BiY19zZWxlY3RhYmxlX2JvZHknICkuZmlsdGVyKCAnOnZpc2libGUnIClcclxuXHRcdFx0XHQuZmluZCggJy5jaGVjay1jb2x1bW4nICkuZmluZCggJzpjaGVja2JveCcgKVxyXG5cdFx0XHRcdC5wcm9wKFxyXG5cdFx0XHRcdFx0J2NoZWNrZWQnLFxyXG5cdFx0XHRcdFx0ZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0XHRpZiAoICQoIHRoaXMgKS5pcyggJzpoaWRkZW4sOmRpc2FibGVkJyApICkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRpZiAoIHRvZ2dsZSApIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gISAkKCB0aGlzICkucHJvcCggJ2NoZWNrZWQnICk7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoIGNvbnRyb2xDaGVja2VkICkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHQpLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblxyXG5cdFx0XHQkdGFibGUuY2hpbGRyZW4oICcud3BiY19zZWxlY3RhYmxlX2hlYWQsICAud3BiY19zZWxlY3RhYmxlX2Zvb3QnICkuZmlsdGVyKCAnOnZpc2libGUnIClcclxuXHRcdFx0XHQuZmluZCggJy5jaGVjay1jb2x1bW4nICkuZmluZCggJzpjaGVja2JveCcgKVxyXG5cdFx0XHRcdC5wcm9wKFxyXG5cdFx0XHRcdFx0J2NoZWNrZWQnLFxyXG5cdFx0XHRcdFx0ZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0XHRpZiAoIHRvZ2dsZSApIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoIGNvbnRyb2xDaGVja2VkICkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHQpO1xyXG5cdFx0fVxyXG5cdCk7XHJcblxyXG5cclxuXHQvLyBWaXN1YWxseSAgc2hvdyBzZWxlY3RlZCBib3JkZXIuXHJcblx0JCggJy53cGJjX3NlbGVjdGFibGVfYm9keScgKS5maW5kKCAnLmNoZWNrLWNvbHVtbiA6Y2hlY2tib3gnICkub24oXHJcblx0XHQnY2hhbmdlJyxcclxuXHRcdGZ1bmN0aW9uIChldmVudCkge1xyXG5cdFx0XHRpZiAoIGpRdWVyeSggdGhpcyApLmlzKCAnOmNoZWNrZWQnICkgKSB7XHJcblx0XHRcdFx0alF1ZXJ5KCB0aGlzICkuY2xvc2VzdCggJy53cGJjX2xpc3Rfcm93JyApLmFkZENsYXNzKCAncm93X3NlbGVjdGVkX2NvbG9yJyApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGpRdWVyeSggdGhpcyApLmNsb3Nlc3QoICcud3BiY19saXN0X3JvdycgKS5yZW1vdmVDbGFzcyggJ3Jvd19zZWxlY3RlZF9jb2xvcicgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRGlzYWJsZSB0ZXh0IHNlbGVjdGlvbiB3aGlsZSBwcmVzc2luZyAnc2hpZnQnLlxyXG5cdFx0XHRkb2N1bWVudC5nZXRTZWxlY3Rpb24oKS5yZW1vdmVBbGxSYW5nZXMoKTtcclxuXHJcblx0XHRcdC8vIFNob3cgb3IgaGlkZSBidXR0b25zIG9uIEFjdGlvbnMgdG9vbGJhciAgYXQgIEJvb2tpbmcgTGlzdGluZyAgcGFnZSwgIGlmIHdlIGhhdmUgc29tZSBzZWxlY3RlZCBib29raW5ncy5cclxuXHRcdFx0d3BiY19zaG93X2hpZGVfYWN0aW9uX2J1dHRvbnNfZm9yX3NlbGVjdGVkX2Jvb2tpbmdzKCk7XHJcblx0XHR9XHJcblx0KTtcclxuXHJcblx0d3BiY19zaG93X2hpZGVfYWN0aW9uX2J1dHRvbnNfZm9yX3NlbGVjdGVkX2Jvb2tpbmdzKCk7XHJcbn1cclxuIiwiXHJcbi8qKlxyXG4gKiBHZXQgSUQgYXJyYXkgIG9mIHNlbGVjdGVkIGVsZW1lbnRzXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2dldF9zZWxlY3RlZF9yb3dfaWQoKSB7XHJcblxyXG5cdHZhciAkdGFibGUgICAgICA9IGpRdWVyeSggJy53cGJjX193cmFwX19ib29raW5nX2xpc3RpbmcgLndwYmNfc2VsZWN0YWJsZV90YWJsZScgKTtcclxuXHR2YXIgY2hlY2tib3hlcyAgPSAkdGFibGUuY2hpbGRyZW4oICcud3BiY19zZWxlY3RhYmxlX2JvZHknICkuZmlsdGVyKCAnOnZpc2libGUnICkuZmluZCggJy5jaGVjay1jb2x1bW4nICkuZmluZCggJzpjaGVja2JveCcgKTtcclxuXHR2YXIgc2VsZWN0ZWRfaWQgPSBbXTtcclxuXHJcblx0alF1ZXJ5LmVhY2goXHJcblx0XHRjaGVja2JveGVzLFxyXG5cdFx0ZnVuY3Rpb24gKGtleSwgY2hlY2tib3gpIHtcclxuXHRcdFx0aWYgKCBqUXVlcnkoIGNoZWNrYm94ICkuaXMoICc6Y2hlY2tlZCcgKSApIHtcclxuXHRcdFx0XHR2YXIgZWxlbWVudF9pZCA9IHdwYmNfZ2V0X3Jvd19pZF9mcm9tX2VsZW1lbnQoIGNoZWNrYm94ICk7XHJcblx0XHRcdFx0c2VsZWN0ZWRfaWQucHVzaCggZWxlbWVudF9pZCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0KTtcclxuXHJcblx0cmV0dXJuIHNlbGVjdGVkX2lkO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIEdldCBJRCBvZiByb3csICBiYXNlZCBvbiBjbGNpa2VkIGVsZW1lbnRcclxuICpcclxuICogQHBhcmFtIHRoaXNfaW5ib3VuZF9lbGVtZW50ICAtIHVzdXNsbHkgIHRoaXNcclxuICogQHJldHVybnMge251bWJlcn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZ2V0X3Jvd19pZF9mcm9tX2VsZW1lbnQodGhpc19pbmJvdW5kX2VsZW1lbnQpIHtcclxuXHJcblx0dmFyIGVsZW1lbnRfaWQgPSBqUXVlcnkoIHRoaXNfaW5ib3VuZF9lbGVtZW50ICkuY2xvc2VzdCggJy53cGJjX2xpc3RpbmdfdXN1YWxfcm93JyApLmF0dHIoICdpZCcgKTtcclxuXHJcblx0ZWxlbWVudF9pZCA9IHBhcnNlSW50KCBlbGVtZW50X2lkLnJlcGxhY2UoICdyb3dfaWRfJywgJycgKSApO1xyXG5cclxuXHRyZXR1cm4gZWxlbWVudF9pZDtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiA9PSBCb29raW5nIExpc3RpbmcgPT0gU2hvdyBvciBoaWRlIGJ1dHRvbnMgb24gQWN0aW9ucyB0b29sYmFyICBhdCAgICBwYWdlLCAgaWYgd2UgaGF2ZSBzb21lIHNlbGVjdGVkIGJvb2tpbmdzLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19zaG93X2hpZGVfYWN0aW9uX2J1dHRvbnNfZm9yX3NlbGVjdGVkX2Jvb2tpbmdzKCl7XHJcblxyXG5cdHZhciBzZWxlY3RlZF9yb3dzX2FyciA9IHdwYmNfZ2V0X3NlbGVjdGVkX3Jvd19pZCgpO1xyXG5cclxuXHRpZiAoIHNlbGVjdGVkX3Jvd3NfYXJyLmxlbmd0aCA+IDAgKSB7XHJcblx0XHRqUXVlcnkoICcuaGlkZV9idXR0b25faWZfbm9fc2VsZWN0aW9uJyApLnNob3coKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0alF1ZXJ5KCAnLmhpZGVfYnV0dG9uX2lmX25vX3NlbGVjdGlvbicgKS5oaWRlKCk7XHJcblx0fVxyXG59IiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyA9PSBMZWZ0IEJhciAgLSAgZXhwYW5kIC8gY29sYXBzZSBmdW5jdGlvbnMgICA9PVxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbi8qKlxyXG4gKiBFeHBhbmQgVmVydGljYWwgTGVmdCBCYXIuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX2RvX21heCgpIHtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkucmVtb3ZlQ2xhc3MoICdtaW4gbWF4IGNvbXBhY3Qgbm9uZScgKTtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkuYWRkQ2xhc3MoICdtYXgnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9vcGVuX2xlZnRfdmVydGljYWxfbmF2JyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2hpZGVfbGVmdF92ZXJ0aWNhbF9uYXYnICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cclxuXHRqUXVlcnkoICcud3AtYWRtaW4nICkucmVtb3ZlQ2xhc3MoICd3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X21pbiB3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X21heCB3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X2NvbXBhY3Qgd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9ub25lJyApO1xyXG5cdGpRdWVyeSggJy53cC1hZG1pbicgKS5hZGRDbGFzcyggJ3dwYmNfcGFnZV93cmFwcGVyX2xlZnRfbWF4JyApO1xyXG59XHJcblxyXG4vKipcclxuICogSGlkZSBWZXJ0aWNhbCBMZWZ0IEJhci5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fZG9fbWluKCkge1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5yZW1vdmVDbGFzcyggJ21pbiBtYXggY29tcGFjdCBub25lJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5hZGRDbGFzcyggJ21pbicgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fbGVmdF92ZXJ0aWNhbF9uYXYnICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5faGlkZV9sZWZ0X3ZlcnRpY2FsX25hdicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblxyXG5cdGpRdWVyeSggJy53cC1hZG1pbicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfcGFnZV93cmFwcGVyX2xlZnRfbWluIHdwYmNfcGFnZV93cmFwcGVyX2xlZnRfbWF4IHdwYmNfcGFnZV93cmFwcGVyX2xlZnRfY29tcGFjdCB3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X25vbmUnICk7XHJcblx0alF1ZXJ5KCAnLndwLWFkbWluJyApLmFkZENsYXNzKCAnd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9taW4nICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb2xhcHNlIFZlcnRpY2FsIExlZnQgQmFyLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19kb19jb21wYWN0KCkge1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5yZW1vdmVDbGFzcyggJ21pbiBtYXggY29tcGFjdCBub25lJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5hZGRDbGFzcyggJ2NvbXBhY3QnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9vcGVuX2xlZnRfdmVydGljYWxfbmF2JyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2hpZGVfbGVmdF92ZXJ0aWNhbF9uYXYnICkuYWRkQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cclxuXHRqUXVlcnkoICcud3AtYWRtaW4nICkucmVtb3ZlQ2xhc3MoICd3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X21pbiB3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X21heCB3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X2NvbXBhY3Qgd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9ub25lJyApO1xyXG5cdGpRdWVyeSggJy53cC1hZG1pbicgKS5hZGRDbGFzcyggJ3dwYmNfcGFnZV93cmFwcGVyX2xlZnRfY29tcGFjdCcgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbXBsZXRlbHkgSGlkZSBWZXJ0aWNhbCBMZWZ0IEJhci5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fZG9faGlkZSgpIHtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkucmVtb3ZlQ2xhc3MoICdtaW4gbWF4IGNvbXBhY3Qgbm9uZScgKTtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkuYWRkQ2xhc3MoICdub25lJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fb3Blbl9sZWZ0X3ZlcnRpY2FsX25hdicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9oaWRlX2xlZnRfdmVydGljYWxfbmF2JyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHQvLyBIaWRlIHRvcCBcIk1lbnVcIiBidXR0b24gd2l0aCBkaXZpZGVyLlxyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fc2hvd19sZWZ0X3ZlcnRpY2FsX25hdiwud3BiY191aV9fdG9wX25hdl9fYnRuX3Nob3dfbGVmdF92ZXJ0aWNhbF9uYXZfZGl2aWRlcicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblxyXG5cdGpRdWVyeSggJy53cC1hZG1pbicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfcGFnZV93cmFwcGVyX2xlZnRfbWluIHdwYmNfcGFnZV93cmFwcGVyX2xlZnRfbWF4IHdwYmNfcGFnZV93cmFwcGVyX2xlZnRfY29tcGFjdCB3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X25vbmUnICk7XHJcblx0alF1ZXJ5KCAnLndwLWFkbWluJyApLmFkZENsYXNzKCAnd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9ub25lJyApO1xyXG59XHJcblxyXG4vKipcclxuICogQWN0aW9uIG9uIGNsaWNrIFwiR28gQmFja1wiIC0gc2hvdyByb290IG1lbnVcclxuICogb3Igc29tZSBvdGhlciBzZWN0aW9uIGluIGxlZnQgc2lkZWJhci5cclxuICpcclxuICogQHBhcmFtIHN0cmluZyBtZW51X3RvX3Nob3cgLSBtZW51IHNsdWcuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX3Nob3dfc2VjdGlvbiggbWVudV90b19zaG93ICkge1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX2VsX192ZXJ0X2xlZnRfYmFyX19zZWN0aW9uJyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKVxyXG5cdGpRdWVyeSggJy53cGJjX3VpX2VsX192ZXJ0X2xlZnRfYmFyX19zZWN0aW9uXycgKyBtZW51X3RvX3Nob3cgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcbn1cclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyA9PSBSaWdodCBTaWRlIEJhciAgLSAgZXhwYW5kIC8gY29sYXBzZSBmdW5jdGlvbnMgICA9PVxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbi8qKlxyXG4gKiBFeHBhbmQgVmVydGljYWwgUmlnaHQgQmFyLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9fbWF4KCkge1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5yZW1vdmVDbGFzcyggJ21pbl9yaWdodCBtYXhfcmlnaHQgY29tcGFjdF9yaWdodCBub25lX3JpZ2h0JyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5hZGRDbGFzcyggJ21heF9yaWdodCcgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fcmlnaHRfdmVydGljYWxfbmF2JyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2hpZGVfcmlnaHRfdmVydGljYWxfbmF2JyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEhpZGUgVmVydGljYWwgUmlnaHQgQmFyLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9fbWluKCkge1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5yZW1vdmVDbGFzcyggJ21pbl9yaWdodCBtYXhfcmlnaHQgY29tcGFjdF9yaWdodCBub25lX3JpZ2h0JyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5hZGRDbGFzcyggJ21pbl9yaWdodCcgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fcmlnaHRfdmVydGljYWxfbmF2JyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2hpZGVfcmlnaHRfdmVydGljYWxfbmF2JyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbGFwc2UgVmVydGljYWwgUmlnaHQgQmFyLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9fY29tcGFjdCgpIHtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkucmVtb3ZlQ2xhc3MoICdtaW5fcmlnaHQgbWF4X3JpZ2h0IGNvbXBhY3RfcmlnaHQgbm9uZV9yaWdodCcgKTtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkuYWRkQ2xhc3MoICdjb21wYWN0X3JpZ2h0JyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fb3Blbl9yaWdodF92ZXJ0aWNhbF9uYXYnICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5faGlkZV9yaWdodF92ZXJ0aWNhbF9uYXYnICkuYWRkQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG59XHJcblxyXG4vKipcclxuICogQ29tcGxldGVseSBIaWRlIFZlcnRpY2FsIFJpZ2h0IEJhci5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX2hpZGUoKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLnJlbW92ZUNsYXNzKCAnbWluX3JpZ2h0IG1heF9yaWdodCBjb21wYWN0X3JpZ2h0IG5vbmVfcmlnaHQnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLmFkZENsYXNzKCAnbm9uZV9yaWdodCcgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fcmlnaHRfdmVydGljYWxfbmF2JyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2hpZGVfcmlnaHRfdmVydGljYWxfbmF2JyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHQvLyBIaWRlIHRvcCBcIk1lbnVcIiBidXR0b24gd2l0aCBkaXZpZGVyLlxyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fc2hvd19yaWdodF92ZXJ0aWNhbF9uYXYsLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9zaG93X3JpZ2h0X3ZlcnRpY2FsX25hdl9kaXZpZGVyJyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFjdGlvbiBvbiBjbGljayBcIkdvIEJhY2tcIiAtIHNob3cgcm9vdCBtZW51XHJcbiAqIG9yIHNvbWUgb3RoZXIgc2VjdGlvbiBpbiByaWdodCBzaWRlYmFyLlxyXG4gKlxyXG4gKiBAcGFyYW0gc3RyaW5nIG1lbnVfdG9fc2hvdyAtIG1lbnUgc2x1Zy5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX3Nob3dfc2VjdGlvbiggbWVudV90b19zaG93ICkge1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX2VsX192ZXJ0X3JpZ2h0X2Jhcl9fc2VjdGlvbicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnIClcclxuXHRqUXVlcnkoICcud3BiY191aV9lbF9fdmVydF9yaWdodF9iYXJfX3NlY3Rpb25fJyArIG1lbnVfdG9fc2hvdyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxufVxyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vID09IEVuZCBSaWdodCBTaWRlIEJhciAgc2VjdGlvbiAgID09XHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuLyoqXHJcbiAqIEdldCBhbmNob3IocykgYXJyYXkgIGZyb20gIFVSTC5cclxuICogRG9jOiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvTG9jYXRpb25cclxuICpcclxuICogQHJldHVybnMgeypbXX1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfdXJsX2dldF9hbmNob3JzX2FycigpIHtcclxuXHR2YXIgaGFzaGVzICAgICAgICAgICAgPSB3aW5kb3cubG9jYXRpb24uaGFzaC5yZXBsYWNlKCAnJTIzJywgJyMnICk7XHJcblx0dmFyIGhhc2hlc19hcnIgICAgICAgID0gaGFzaGVzLnNwbGl0KCAnIycgKTtcclxuXHR2YXIgcmVzdWx0ICAgICAgICAgICAgPSBbXTtcclxuXHR2YXIgaGFzaGVzX2Fycl9sZW5ndGggPSBoYXNoZXNfYXJyLmxlbmd0aDtcclxuXHJcblx0Zm9yICggdmFyIGkgPSAwOyBpIDwgaGFzaGVzX2Fycl9sZW5ndGg7IGkrKyApIHtcclxuXHRcdGlmICggaGFzaGVzX2FycltpXS5sZW5ndGggPiAwICkge1xyXG5cdFx0XHRyZXN1bHQucHVzaCggaGFzaGVzX2FycltpXSApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG4vKipcclxuICogQXV0byBFeHBhbmQgU2V0dGluZ3Mgc2VjdGlvbiBiYXNlZCBvbiBVUkwgYW5jaG9yLCBhZnRlciAgcGFnZSBsb2FkZWQuXHJcbiAqL1xyXG5qUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uICgpIHsgd3BiY19hZG1pbl91aV9fZG9fZXhwYW5kX3NlY3Rpb24oKTsgc2V0VGltZW91dCggJ3dwYmNfYWRtaW5fdWlfX2RvX2V4cGFuZF9zZWN0aW9uJywgMTAgKTsgfSApO1xyXG5qUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uICgpIHsgd3BiY19hZG1pbl91aV9fZG9fZXhwYW5kX3NlY3Rpb24oKTsgc2V0VGltZW91dCggJ3dwYmNfYWRtaW5fdWlfX2RvX2V4cGFuZF9zZWN0aW9uJywgMTUwICk7IH0gKTtcclxuXHJcbi8qKlxyXG4gKiBFeHBhbmQgc2VjdGlvbiBpbiAgR2VuZXJhbCBTZXR0aW5ncyBwYWdlIGFuZCBzZWxlY3QgTWVudSBpdGVtLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fZG9fZXhwYW5kX3NlY3Rpb24oKSB7XHJcblxyXG5cdC8vIHdpbmRvdy5sb2NhdGlvbi5oYXNoICA9ICNzZWN0aW9uX2lkICAvICBkb2M6IGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9Mb2NhdGlvbiAuXHJcblx0dmFyIGFuY2hvcnNfYXJyICAgICAgICA9IHdwYmNfdXJsX2dldF9hbmNob3JzX2FycigpO1xyXG5cdHZhciBhbmNob3JzX2Fycl9sZW5ndGggPSBhbmNob3JzX2Fyci5sZW5ndGg7XHJcblxyXG5cdGlmICggYW5jaG9yc19hcnJfbGVuZ3RoID4gMCApIHtcclxuXHRcdHZhciBvbmVfYW5jaG9yX3Byb3BfdmFsdWUgPSBhbmNob3JzX2FyclswXS5zcGxpdCggJ2RvX2V4cGFuZF9fJyApO1xyXG5cdFx0aWYgKCBvbmVfYW5jaG9yX3Byb3BfdmFsdWUubGVuZ3RoID4gMSApIHtcclxuXHJcblx0XHRcdC8vICd3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FsZW5kYXJfbWV0YWJveCdcclxuXHRcdFx0dmFyIHNlY3Rpb25fdG9fc2hvdyAgICA9IG9uZV9hbmNob3JfcHJvcF92YWx1ZVsxXTtcclxuXHRcdFx0dmFyIHNlY3Rpb25faWRfdG9fc2hvdyA9ICcjJyArIHNlY3Rpb25fdG9fc2hvdztcclxuXHJcblxyXG5cdFx0XHQvLyAtLSBSZW1vdmUgc2VsZWN0ZWQgYmFja2dyb3VuZCBpbiBhbGwgbGVmdCAgbWVudSAgaXRlbXMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdGpRdWVyeSggJy53cGJjX3VpX2VsX192ZXJ0X25hdl9pdGVtICcgKS5yZW1vdmVDbGFzcyggJ2FjdGl2ZScgKTtcclxuXHRcdFx0Ly8gU2V0IGxlZnQgbWVudSBzZWxlY3RlZC5cclxuXHRcdFx0alF1ZXJ5KCAnLmRvX2V4cGFuZF9fJyArIHNlY3Rpb25fdG9fc2hvdyArICdfbGluaycgKS5hZGRDbGFzcyggJ2FjdGl2ZScgKTtcclxuXHRcdFx0dmFyIHNlbGVjdGVkX3RpdGxlID0galF1ZXJ5KCAnLmRvX2V4cGFuZF9fJyArIHNlY3Rpb25fdG9fc2hvdyArICdfbGluayBhIC53cGJjX3VpX2VsX192ZXJ0X25hdl90aXRsZSAnICkudGV4dCgpO1xyXG5cclxuXHRcdFx0Ly8gRXhwYW5kIHNlY3Rpb24sIGlmIGl0IGNvbGFwc2VkLlxyXG5cdFx0XHRpZiAoICEgalF1ZXJ5KCAnLmRvX2V4cGFuZF9fJyArIHNlY3Rpb25fdG9fc2hvdyArICdfbGluaycgKS5wYXJlbnRzKCAnLndwYmNfdWlfZWxfX2xldmVsX19mb2xkZXInICkuaGFzQ2xhc3MoICdleHBhbmRlZCcgKSApIHtcclxuXHRcdFx0XHRqUXVlcnkoICcud3BiY191aV9lbF9fbGV2ZWxfX2ZvbGRlcicgKS5yZW1vdmVDbGFzcyggJ2V4cGFuZGVkJyApO1xyXG5cdFx0XHRcdGpRdWVyeSggJy5kb19leHBhbmRfXycgKyBzZWN0aW9uX3RvX3Nob3cgKyAnX2xpbmsnICkucGFyZW50cyggJy53cGJjX3VpX2VsX19sZXZlbF9fZm9sZGVyJyApLmFkZENsYXNzKCAnZXhwYW5kZWQnICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIC0tIEV4cGFuZCBzZWN0aW9uIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHR2YXIgY29udGFpbmVyX3RvX2hpZGVfY2xhc3MgPSAnLnBvc3Rib3gnO1xyXG5cdFx0XHQvLyBIaWRlIHNlY3Rpb25zICcucG9zdGJveCcgaW4gYWRtaW4gcGFnZSBhbmQgc2hvdyBzcGVjaWZpYyBvbmUuXHJcblx0XHRcdGpRdWVyeSggJy53cGJjX2FkbWluX3BhZ2UgJyArIGNvbnRhaW5lcl90b19oaWRlX2NsYXNzICkuaGlkZSgpO1xyXG5cdFx0XHRqUXVlcnkoICcud3BiY19jb250YWluZXJfYWx3YXlzX2hpZGVfX29uX2xlZnRfbmF2X2NsaWNrJyApLmhpZGUoKTtcclxuXHRcdFx0alF1ZXJ5KCBzZWN0aW9uX2lkX3RvX3Nob3cgKS5zaG93KCk7XHJcblxyXG5cdFx0XHQvLyBTaG93IGFsbCBvdGhlciBzZWN0aW9ucywgIGlmIHByb3ZpZGVkIGluIFVSTDogLi4/cGFnZT13cGJjLXNldHRpbmdzI2RvX2V4cGFuZF9fd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhcGFjaXR5X21ldGFib3gjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhcGFjaXR5X3VwZ3JhZGVfbWV0YWJveCAuXHJcblx0XHRcdGZvciAoIGxldCBpID0gMTsgaSA8IGFuY2hvcnNfYXJyX2xlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRcdGpRdWVyeSggJyMnICsgYW5jaG9yc19hcnJbaV0gKS5zaG93KCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggZmFsc2UgKSB7XHJcblx0XHRcdFx0dmFyIHRhcmdldE9mZnNldCA9IHdwYmNfc2Nyb2xsX3RvKCBzZWN0aW9uX2lkX3RvX3Nob3cgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gLS0gU2V0IFZhbHVlIHRvIElucHV0IGFib3V0IHNlbGVjdGVkIE5hdiBlbGVtZW50ICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gICAgICAgLy8gRml4SW46IDkuOC42LjEuXHJcblx0XHRcdHZhciBzZWN0aW9uX2lkX3RhYiA9IHNlY3Rpb25faWRfdG9fc2hvdy5zdWJzdHJpbmcoIDAsIHNlY3Rpb25faWRfdG9fc2hvdy5sZW5ndGggLSA4ICkgKyAnX3RhYic7XHJcblx0XHRcdGlmICggY29udGFpbmVyX3RvX2hpZGVfY2xhc3MgPT0gc2VjdGlvbl9pZF90b19zaG93ICkge1xyXG5cdFx0XHRcdHNlY3Rpb25faWRfdGFiID0gJyN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfYWxsX3RhYidcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoICcjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhcGFjaXR5X21ldGFib3gsI3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYXBhY2l0eV91cGdyYWRlX21ldGFib3gnID09IHNlY3Rpb25faWRfdG9fc2hvdyApIHtcclxuXHRcdFx0XHRzZWN0aW9uX2lkX3RhYiA9ICcjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhcGFjaXR5X3RhYidcclxuXHRcdFx0fVxyXG5cdFx0XHRqUXVlcnkoICcjZm9ybV92aXNpYmxlX3NlY3Rpb24nICkudmFsKCBzZWN0aW9uX2lkX3RhYiApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIExpa2UgYmxpbmtpbmcgc29tZSBlbGVtZW50cy5cclxuXHRcdHdwYmNfYWRtaW5fdWlfX2RvX19hbmNob3JfX2Fub3RoZXJfYWN0aW9ucygpO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9faXNfaW5fbW9iaWxlX3NjcmVlbl9zaXplKCkge1xyXG5cdHJldHVybiB3cGJjX2FkbWluX3VpX19pc19pbl90aGlzX3NjcmVlbl9zaXplKCA2MDUgKTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9faXNfaW5fdGhpc19zY3JlZW5fc2l6ZShzaXplKSB7XHJcblx0cmV0dXJuICh3aW5kb3cuc2NyZWVuLndpZHRoIDw9IHNpemUpO1xyXG59XHJcblxyXG4vKipcclxuICogT3BlbiBzZXR0aW5ncyBwYWdlICB8ICBFeHBhbmQgc2VjdGlvbiAgfCAgU2VsZWN0IE1lbnUgaXRlbS5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX2RvX19vcGVuX3VybF9fZXhwYW5kX3NlY3Rpb24odXJsLCBzZWN0aW9uX2lkKSB7XHJcblxyXG5cdC8vIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gdXJsICsgJyZkb19leHBhbmQ9JyArIHNlY3Rpb25faWQgKyAnI2RvX2V4cGFuZF9fJyArIHNlY3Rpb25faWQ7IC8vLlxyXG5cdHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gdXJsICsgJyNkb19leHBhbmRfXycgKyBzZWN0aW9uX2lkO1xyXG5cclxuXHRpZiAoIHdwYmNfYWRtaW5fdWlfX2lzX2luX21vYmlsZV9zY3JlZW5fc2l6ZSgpICkge1xyXG5cdFx0d3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19kb19taW4oKTtcclxuXHR9XHJcblxyXG5cdHdwYmNfYWRtaW5fdWlfX2RvX2V4cGFuZF9zZWN0aW9uKCk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogQ2hlY2sgIGZvciBPdGhlciBhY3Rpb25zOiAgTGlrZSBibGlua2luZyBzb21lIGVsZW1lbnRzIGluIHNldHRpbmdzIHBhZ2UuIEUuZy4gRGF5cyBzZWxlY3Rpb24gIG9yICBjaGFuZ2Utb3ZlciBkYXlzLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fZG9fX2FuY2hvcl9fYW5vdGhlcl9hY3Rpb25zKCkge1xyXG5cclxuXHR2YXIgYW5jaG9yc19hcnIgICAgICAgID0gd3BiY191cmxfZ2V0X2FuY2hvcnNfYXJyKCk7XHJcblx0dmFyIGFuY2hvcnNfYXJyX2xlbmd0aCA9IGFuY2hvcnNfYXJyLmxlbmd0aDtcclxuXHJcblx0Ly8gT3RoZXIgYWN0aW9uczogIExpa2UgYmxpbmtpbmcgc29tZSBlbGVtZW50cy5cclxuXHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBhbmNob3JzX2Fycl9sZW5ndGg7IGkrKyApIHtcclxuXHJcblx0XHR2YXIgdGhpc19hbmNob3IgPSBhbmNob3JzX2FycltpXTtcclxuXHJcblx0XHR2YXIgdGhpc19hbmNob3JfcHJvcF92YWx1ZSA9IHRoaXNfYW5jaG9yLnNwbGl0KCAnZG9fb3RoZXJfYWN0aW9uc19fJyApO1xyXG5cclxuXHRcdGlmICggdGhpc19hbmNob3JfcHJvcF92YWx1ZS5sZW5ndGggPiAxICkge1xyXG5cclxuXHRcdFx0dmFyIHNlY3Rpb25fYWN0aW9uID0gdGhpc19hbmNob3JfcHJvcF92YWx1ZVsxXTtcclxuXHJcblx0XHRcdHN3aXRjaCAoIHNlY3Rpb25fYWN0aW9uICkge1xyXG5cclxuXHRcdFx0XHRjYXNlICdibGlua19kYXlfc2VsZWN0aW9ucyc6XHJcblx0XHRcdFx0XHQvLyB3cGJjX3VpX3NldHRpbmdzX19wYW5lbF9fY2xpY2soICcjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhbGVuZGFyX3RhYiBhJywgJyN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FsZW5kYXJfbWV0YWJveCcsICdEYXlzIFNlbGVjdGlvbicgKTsuXHJcblx0XHRcdFx0XHR3cGJjX2JsaW5rX2VsZW1lbnQoICcud3BiY190cl9zZXRfZ2VuX2Jvb2tpbmdfdHlwZV9vZl9kYXlfc2VsZWN0aW9ucycsIDQsIDM1MCApO1xyXG5cdFx0XHRcdFx0XHR3cGJjX3Njcm9sbF90byggJy53cGJjX3RyX3NldF9nZW5fYm9va2luZ190eXBlX29mX2RheV9zZWxlY3Rpb25zJyApO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ2JsaW5rX2NoYW5nZV9vdmVyX2RheXMnOlxyXG5cdFx0XHRcdFx0Ly8gd3BiY191aV9zZXR0aW5nc19fcGFuZWxfX2NsaWNrKCAnI3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYWxlbmRhcl90YWIgYScsICcjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhbGVuZGFyX21ldGFib3gnLCAnQ2hhbmdlb3ZlciBEYXlzJyApOy5cclxuXHRcdFx0XHRcdHdwYmNfYmxpbmtfZWxlbWVudCggJy53cGJjX3RyX3NldF9nZW5fYm9va2luZ19yYW5nZV9zZWxlY3Rpb25fdGltZV9pc19hY3RpdmUnLCA0LCAzNTAgKTtcclxuXHRcdFx0XHRcdFx0d3BiY19zY3JvbGxfdG8oICcud3BiY190cl9zZXRfZ2VuX2Jvb2tpbmdfcmFuZ2Vfc2VsZWN0aW9uX3RpbWVfaXNfYWN0aXZlJyApO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ2JsaW5rX2NhcHRjaGEnOlxyXG5cdFx0XHRcdFx0d3BiY19ibGlua19lbGVtZW50KCAnLndwYmNfdHJfc2V0X2dlbl9ib29raW5nX2lzX3VzZV9jYXB0Y2hhJywgNCwgMzUwICk7XHJcblx0XHRcdFx0XHRcdHdwYmNfc2Nyb2xsX3RvKCAnLndwYmNfdHJfc2V0X2dlbl9ib29raW5nX2lzX3VzZV9jYXB0Y2hhJyApO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcbn0iLCIvKipcclxuICogQ29weSB0eHQgdG8gY2xpcGJyZCBmcm9tIFRleHQgZmllbGRzLlxyXG4gKlxyXG4gKiBAcGFyYW0gaHRtbF9lbGVtZW50X2lkICAtIGUuZy4gJ2RhdGFfZmllbGQnXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jb3B5X3RleHRfdG9fY2xpcGJyZF9mcm9tX2VsZW1lbnQoIGh0bWxfZWxlbWVudF9pZCApIHtcclxuXHQvLyBHZXQgdGhlIHRleHQgZmllbGQuXHJcblx0dmFyIGNvcHlUZXh0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGh0bWxfZWxlbWVudF9pZCApO1xyXG5cclxuXHQvLyBTZWxlY3QgdGhlIHRleHQgZmllbGQuXHJcblx0Y29weVRleHQuc2VsZWN0KCk7XHJcblx0Y29weVRleHQuc2V0U2VsZWN0aW9uUmFuZ2UoIDAsIDk5OTk5ICk7IC8vIEZvciBtb2JpbGUgZGV2aWNlcy5cclxuXHJcblx0Ly8gQ29weSB0aGUgdGV4dCBpbnNpZGUgdGhlIHRleHQgZmllbGQuXHJcblx0dmFyIGlzX2NvcGllZCA9IHdwYmNfY29weV90ZXh0X3RvX2NsaXBicmQoIGNvcHlUZXh0LnZhbHVlICk7XHJcblx0aWYgKCAhIGlzX2NvcGllZCApIHtcclxuXHRcdGNvbnNvbGUuZXJyb3IoICdPb3BzLCB1bmFibGUgdG8gY29weScsIGNvcHlUZXh0LnZhbHVlICk7XHJcblx0fVxyXG5cdHJldHVybiBpc19jb3BpZWQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb3B5IHR4dCB0byBjbGlwYnJkLlxyXG4gKlxyXG4gKiBAcGFyYW0gdGV4dFxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY29weV90ZXh0X3RvX2NsaXBicmQodGV4dCkge1xyXG5cclxuXHRpZiAoICEgbmF2aWdhdG9yLmNsaXBib2FyZCApIHtcclxuXHRcdHJldHVybiB3cGJjX2ZhbGxiYWNrX2NvcHlfdGV4dF90b19jbGlwYnJkKCB0ZXh0ICk7XHJcblx0fVxyXG5cclxuXHRuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCggdGV4dCApLnRoZW4oXHJcblx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdC8vIGNvbnNvbGUubG9nKCAnQXN5bmM6IENvcHlpbmcgdG8gY2xpcGJvYXJkIHdhcyBzdWNjZXNzZnVsIScgKTsuXHJcblx0XHRcdHJldHVybiAgdHJ1ZTtcclxuXHRcdH0sXHJcblx0XHRmdW5jdGlvbiAoZXJyKSB7XHJcblx0XHRcdC8vIGNvbnNvbGUuZXJyb3IoICdBc3luYzogQ291bGQgbm90IGNvcHkgdGV4dDogJywgZXJyICk7LlxyXG5cdFx0XHRyZXR1cm4gIGZhbHNlO1xyXG5cdFx0fVxyXG5cdCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb3B5IHR4dCB0byBjbGlwYnJkIC0gZGVwcmljYXRlZCBtZXRob2QuXHJcbiAqXHJcbiAqIEBwYXJhbSB0ZXh0XHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19mYWxsYmFja19jb3B5X3RleHRfdG9fY2xpcGJyZCggdGV4dCApIHtcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyB2YXIgdGV4dEFyZWEgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoIFwidGV4dGFyZWFcIiApO1xyXG5cdC8vIHRleHRBcmVhLnZhbHVlID0gdGV4dDtcclxuXHQvL1xyXG5cdC8vIC8vIEF2b2lkIHNjcm9sbGluZyB0byBib3R0b20uXHJcblx0Ly8gdGV4dEFyZWEuc3R5bGUudG9wICAgICAgPSBcIjBcIjtcclxuXHQvLyB0ZXh0QXJlYS5zdHlsZS5sZWZ0ICAgICA9IFwiMFwiO1xyXG5cdC8vIHRleHRBcmVhLnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiO1xyXG5cdC8vIHRleHRBcmVhLnN0eWxlLnpJbmRleCAgID0gXCI5OTk5OTk5OTlcIjtcclxuXHQvLyBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCB0ZXh0QXJlYSApO1xyXG5cdC8vIHRleHRBcmVhLmZvY3VzKCk7XHJcblx0Ly8gdGV4dEFyZWEuc2VsZWN0KCk7XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gTm93IGdldCBpdCBhcyBIVE1MICAob3JpZ2luYWwgaGVyZSBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8zNDE5MTc4MC9qYXZhc2NyaXB0LWNvcHktc3RyaW5nLXRvLWNsaXBib2FyZC1hcy10ZXh0LWh0bWwgKS5cclxuXHJcblx0Ly8gWzFdIC0gQ3JlYXRlIGNvbnRhaW5lciBmb3IgdGhlIEhUTUwuXHJcblx0dmFyIGNvbnRhaW5lciAgICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0Y29udGFpbmVyLmlubmVySFRNTCA9IHRleHQ7XHJcblxyXG5cdC8vIFsyXSAtIEhpZGUgZWxlbWVudC5cclxuXHRjb250YWluZXIuc3R5bGUucG9zaXRpb24gICAgICA9ICdmaXhlZCc7XHJcblx0Y29udGFpbmVyLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XHJcblx0Y29udGFpbmVyLnN0eWxlLm9wYWNpdHkgICAgICAgPSAwO1xyXG5cclxuXHQvLyBEZXRlY3QgYWxsIHN0eWxlIHNoZWV0cyBvZiB0aGUgcGFnZS5cclxuXHR2YXIgYWN0aXZlU2hlZXRzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGRvY3VtZW50LnN0eWxlU2hlZXRzICkuZmlsdGVyKFxyXG5cdFx0ZnVuY3Rpb24gKHNoZWV0KSB7XHJcblx0XHRcdHJldHVybiAhIHNoZWV0LmRpc2FibGVkO1xyXG5cdFx0fVxyXG5cdCk7XHJcblxyXG5cdC8vIFszXSAtIE1vdW50IHRoZSBjb250YWluZXIgdG8gdGhlIERPTSB0byBtYWtlIGBjb250ZW50V2luZG93YCBhdmFpbGFibGUuXHJcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggY29udGFpbmVyICk7XHJcblxyXG5cdC8vIFs0XSAtIENvcHkgdG8gY2xpcGJvYXJkLlxyXG5cdHdpbmRvdy5nZXRTZWxlY3Rpb24oKS5yZW1vdmVBbGxSYW5nZXMoKTtcclxuXHJcblx0dmFyIHJhbmdlID0gZG9jdW1lbnQuY3JlYXRlUmFuZ2UoKTtcclxuXHRyYW5nZS5zZWxlY3ROb2RlKCBjb250YWluZXIgKTtcclxuXHR3aW5kb3cuZ2V0U2VsZWN0aW9uKCkuYWRkUmFuZ2UoIHJhbmdlICk7XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0dmFyIHJlc3VsdCA9IGZhbHNlO1xyXG5cclxuXHR0cnkge1xyXG5cdFx0cmVzdWx0ID0gZG9jdW1lbnQuZXhlY0NvbW1hbmQoICdjb3B5JyApO1xyXG5cdFx0Ly8gY29uc29sZS5sb2coICdGYWxsYmFjazogQ29weWluZyB0ZXh0IGNvbW1hbmQgd2FzICcgKyBtc2cgKTsgLy8uXHJcblx0fSBjYXRjaCAoIGVyciApIHtcclxuXHRcdC8vIGNvbnNvbGUuZXJyb3IoICdGYWxsYmFjazogT29wcywgdW5hYmxlIHRvIGNvcHknLCBlcnIgKTsgLy8uXHJcblx0fVxyXG5cdC8vIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoIHRleHRBcmVhICk7IC8vLlxyXG5cclxuXHQvLyBbNS40XSAtIEVuYWJsZSBDU1MuXHJcblx0dmFyIGFjdGl2ZVNoZWV0c19sZW5ndGggPSBhY3RpdmVTaGVldHMubGVuZ3RoO1xyXG5cdGZvciAoIHZhciBpID0gMDsgaSA8IGFjdGl2ZVNoZWV0c19sZW5ndGg7IGkrKyApIHtcclxuXHRcdGFjdGl2ZVNoZWV0c1tpXS5kaXNhYmxlZCA9IGZhbHNlO1xyXG5cdH1cclxuXHJcblx0Ly8gWzZdIC0gUmVtb3ZlIHRoZSBjb250YWluZXJcclxuXHRkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKCBjb250YWluZXIgKTtcclxuXHJcblx0cmV0dXJuICByZXN1bHQ7XHJcbn0iLCIvKipcclxuICogV1BCQyBDb2xsYXBzaWJsZSBHcm91cHNcclxuICpcclxuICogVW5pdmVyc2FsLCBkZXBlbmRlbmN5LWZyZWUgY29udHJvbGxlciBmb3IgZXhwYW5kaW5nL2NvbGxhcHNpbmcgZ3JvdXBlZCBzZWN0aW9ucyBpbiByaWdodC1zaWRlIHBhbmVscyAoSW5zcGVjdG9yL0xpYnJhcnkvRm9ybSBTZXR0aW5ncywgb3IgYW55IG90aGVyIFdQQkMgcGFnZSkuXHJcbiAqXHJcbiAqIFx0XHQ9PT0gSG93IHRvIHVzZSBpdCAocXVpY2spID8gPT09XHJcbiAqXHJcbiAqXHRcdC0tIDEuIE1hcmt1cCAoaW5kZXBlbmRlbnQgbW9kZTogbXVsdGlwbGUgb3BlbiBhbGxvd2VkKSAtLVxyXG4gKlx0XHRcdDxkaXYgY2xhc3M9XCJ3cGJjX2NvbGxhcHNpYmxlXCI+XHJcbiAqXHRcdFx0ICA8c2VjdGlvbiBjbGFzcz1cIndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwIGlzLW9wZW5cIj5cclxuICpcdFx0XHRcdDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiZ3JvdXBfX2hlYWRlclwiPjxoMz5HZW5lcmFsPC9oMz48L2J1dHRvbj5cclxuICpcdFx0XHRcdDxkaXYgY2xhc3M9XCJncm91cF9fZmllbGRzXCI+4oCmPC9kaXY+XHJcbiAqXHRcdFx0ICA8L3NlY3Rpb24+XHJcbiAqXHRcdFx0ICA8c2VjdGlvbiBjbGFzcz1cIndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwXCI+XHJcbiAqXHRcdFx0XHQ8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImdyb3VwX19oZWFkZXJcIj48aDM+QWR2YW5jZWQ8L2gzPjwvYnV0dG9uPlxyXG4gKlx0XHRcdFx0PGRpdiBjbGFzcz1cImdyb3VwX19maWVsZHNcIj7igKY8L2Rpdj5cclxuICpcdFx0XHQgIDwvc2VjdGlvbj5cclxuICpcdFx0XHQ8L2Rpdj5cclxuICpcclxuICpcdFx0LS0gMi4gRXhjbHVzaXZlL2FjY29yZGlvbiBtb2RlIChvbmUgb3BlbiBhdCBhIHRpbWUpIC0tXHJcbiAqXHRcdFx0PGRpdiBjbGFzcz1cIndwYmNfY29sbGFwc2libGUgd3BiY19jb2xsYXBzaWJsZS0tZXhjbHVzaXZlXCI+4oCmPC9kaXY+XHJcbiAqXHJcbiAqXHRcdC0tIDMuIEF1dG8taW5pdCAtLVxyXG4gKlx0XHRcdFRoZSBzY3JpcHQgYXV0by1pbml0aWFsaXplcyBvbiBET01Db250ZW50TG9hZGVkLiBObyBleHRyYSBjb2RlIG5lZWRlZC5cclxuICpcclxuICpcdFx0LS0gNC4gUHJvZ3JhbW1hdGljIGNvbnRyb2wgKG9wdGlvbmFsKVxyXG4gKlx0XHRcdGNvbnN0IHJvb3QgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjd3BiY19iZmJfX2luc3BlY3RvcicpO1xyXG4gKlx0XHRcdGNvbnN0IGFwaSAgPSByb290Ll9fd3BiY19jb2xsYXBzaWJsZV9pbnN0YW5jZTsgLy8gc2V0IGJ5IGF1dG8taW5pdFxyXG4gKlxyXG4gKlx0XHRcdGFwaS5vcGVuX2J5X2hlYWRpbmcoJ1ZhbGlkYXRpb24nKTsgLy8gb3BlbiBieSBoZWFkaW5nIHRleHRcclxuICpcdFx0XHRhcGkub3Blbl9ieV9pbmRleCgwKTsgICAgICAgICAgICAgIC8vIG9wZW4gdGhlIGZpcnN0IGdyb3VwXHJcbiAqXHJcbiAqXHRcdC0tIDUuTGlzdGVuIHRvIGV2ZW50cyAoZS5nLiwgdG8gcGVyc2lzdCDigJxvcGVuIGdyb3Vw4oCdIHN0YXRlKSAtLVxyXG4gKlx0XHRcdHJvb3QuYWRkRXZlbnRMaXN0ZW5lcignd3BiYzpjb2xsYXBzaWJsZTpvcGVuJywgIChlKSA9PiB7IGNvbnNvbGUubG9nKCAgZS5kZXRhaWwuZ3JvdXAgKTsgfSk7XHJcbiAqXHRcdFx0cm9vdC5hZGRFdmVudExpc3RlbmVyKCd3cGJjOmNvbGxhcHNpYmxlOmNsb3NlJywgKGUpID0+IHsgY29uc29sZS5sb2coICBlLmRldGFpbC5ncm91cCApOyB9KTtcclxuICpcclxuICpcclxuICpcclxuICogTWFya3VwIGV4cGVjdGF0aW9ucyAobWluaW1hbCk6XHJcbiAqICA8ZGl2IGNsYXNzPVwid3BiY19jb2xsYXBzaWJsZSBbd3BiY19jb2xsYXBzaWJsZS0tZXhjbHVzaXZlXVwiPlxyXG4gKiAgICA8c2VjdGlvbiBjbGFzcz1cIndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwIFtpcy1vcGVuXVwiPlxyXG4gKiAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiZ3JvdXBfX2hlYWRlclwiPiAuLi4gPC9idXR0b24+XHJcbiAqICAgICAgPGRpdiBjbGFzcz1cImdyb3VwX19maWVsZHNcIj4gLi4uIDwvZGl2PlxyXG4gKiAgICA8L3NlY3Rpb24+XHJcbiAqICAgIC4uLiBtb3JlIDxzZWN0aW9uPiAuLi5cclxuICogIDwvZGl2PlxyXG4gKlxyXG4gKiBOb3RlczpcclxuICogIC0gQWRkIGBpcy1vcGVuYCB0byBhbnkgc2VjdGlvbiB5b3Ugd2FudCBpbml0aWFsbHkgZXhwYW5kZWQuXHJcbiAqICAtIEFkZCBgd3BiY19jb2xsYXBzaWJsZS0tZXhjbHVzaXZlYCB0byB0aGUgY29udGFpbmVyIGZvciBcIm9wZW4gb25lIGF0IGEgdGltZVwiIGJlaGF2aW9yLlxyXG4gKiAgLSBXb3JrcyB3aXRoIHlvdXIgZXhpc3RpbmcgQkZCIG1hcmt1cCAoY2xhc3NlcyB1c2VkIHRoZXJlIGFyZSB0aGUgZGVmYXVsdHMpLlxyXG4gKlxyXG4gKiBBY2Nlc3NpYmlsaXR5OlxyXG4gKiAgLSBTZXRzIGFyaWEtZXhwYW5kZWQgb24gLmdyb3VwX19oZWFkZXJcclxuICogIC0gU2V0cyBhcmlhLWhpZGRlbiArIFtoaWRkZW5dIG9uIC5ncm91cF9fZmllbGRzXHJcbiAqICAtIEFycm93VXAvQXJyb3dEb3duIG1vdmUgZm9jdXMgYmV0d2VlbiBoZWFkZXJzOyBFbnRlci9TcGFjZSB0b2dnbGVzXHJcbiAqXHJcbiAqIEV2ZW50cyAoYnViYmxlcyBmcm9tIHRoZSA8c2VjdGlvbj4pOlxyXG4gKiAgLSAnd3BiYzpjb2xsYXBzaWJsZTpvcGVuJyAgKGRldGFpbDogeyBncm91cCwgcm9vdCwgaW5zdGFuY2UgfSlcclxuICogIC0gJ3dwYmM6Y29sbGFwc2libGU6Y2xvc2UnIChkZXRhaWw6IHsgZ3JvdXAsIHJvb3QsIGluc3RhbmNlIH0pXHJcbiAqXHJcbiAqIFB1YmxpYyBBUEkgKGluc3RhbmNlIG1ldGhvZHMpOlxyXG4gKiAgLSBpbml0KCksIGRlc3Ryb3koKSwgcmVmcmVzaCgpXHJcbiAqICAtIGV4cGFuZChncm91cCwgW2V4Y2x1c2l2ZV0pLCBjb2xsYXBzZShncm91cCksIHRvZ2dsZShncm91cClcclxuICogIC0gb3Blbl9ieV9pbmRleChpbmRleCksIG9wZW5fYnlfaGVhZGluZyh0ZXh0KVxyXG4gKiAgLSBpc19leGNsdXNpdmUoKSwgaXNfb3Blbihncm91cClcclxuICpcclxuICogQHZlcnNpb24gMjAyNS0wOC0yNlxyXG4gKiBAc2luY2UgMjAyNS0wOC0yNlxyXG4gKi9cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09IEZpbGUgIC9jb2xsYXBzaWJsZV9ncm91cHMuanMgPT0gVGltZSBwb2ludDogMjAyNS0wOC0yNiAxNDoxM1xyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuKGZ1bmN0aW9uICh3LCBkKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHRjbGFzcyBXUEJDX0NvbGxhcHNpYmxlX0dyb3VwcyB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDcmVhdGUgYSBjb2xsYXBzaWJsZSBjb250cm9sbGVyIGZvciBhIGNvbnRhaW5lci5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fHN0cmluZ30gcm9vdF9lbFxyXG5cdFx0ICogICAgICAgIFRoZSBjb250YWluZXIgZWxlbWVudCAob3IgQ1NTIHNlbGVjdG9yKSB0aGF0IHdyYXBzIGNvbGxhcHNpYmxlIGdyb3Vwcy5cclxuXHRcdCAqICAgICAgICBUaGUgY29udGFpbmVyIHVzdWFsbHkgaGFzIHRoZSBjbGFzcyBgLndwYmNfY29sbGFwc2libGVgLlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IFtvcHRzPXt9XVxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICBbb3B0cy5ncm91cF9zZWxlY3Rvcj0nLndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwJ11cclxuXHRcdCAqICAgICAgICBTZWxlY3RvciBmb3IgZWFjaCBjb2xsYXBzaWJsZSBncm91cCBpbnNpZGUgdGhlIGNvbnRhaW5lci5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgW29wdHMuaGVhZGVyX3NlbGVjdG9yPScuZ3JvdXBfX2hlYWRlciddXHJcblx0XHQgKiAgICAgICAgU2VsZWN0b3IgZm9yIHRoZSBjbGlja2FibGUgaGVhZGVyIGluc2lkZSBhIGdyb3VwLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICBbb3B0cy5maWVsZHNfc2VsZWN0b3I9Jy5ncm91cF9fZmllbGRzJ11cclxuXHRcdCAqICAgICAgICBTZWxlY3RvciBmb3IgdGhlIGNvbnRlbnQvcGFuZWwgZWxlbWVudCBpbnNpZGUgYSBncm91cC5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgW29wdHMub3Blbl9jbGFzcz0naXMtb3BlbiddXHJcblx0XHQgKiAgICAgICAgQ2xhc3MgbmFtZSB0aGF0IGluZGljYXRlcyB0aGUgZ3JvdXAgaXMgb3Blbi5cclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuZXhjbHVzaXZlPWZhbHNlXVxyXG5cdFx0ICogICAgICAgIElmIHRydWUsIG9ubHkgb25lIGdyb3VwIGNhbiBiZSBvcGVuIGF0IGEgdGltZSBpbiB0aGlzIGNvbnRhaW5lci5cclxuXHRcdCAqXHJcblx0XHQgKiBAY29uc3RydWN0b3JcclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdGNvbnN0cnVjdG9yKHJvb3RfZWwsIG9wdHMgPSB7fSkge1xyXG5cdFx0XHR0aGlzLnJvb3QgPSAodHlwZW9mIHJvb3RfZWwgPT09ICdzdHJpbmcnKSA/IGQucXVlcnlTZWxlY3Rvciggcm9vdF9lbCApIDogcm9vdF9lbDtcclxuXHRcdFx0dGhpcy5vcHRzID0gT2JqZWN0LmFzc2lnbigge1xyXG5cdFx0XHRcdGdyb3VwX3NlbGVjdG9yIDogJy53cGJjX3VpX19jb2xsYXBzaWJsZV9ncm91cCcsXHJcblx0XHRcdFx0aGVhZGVyX3NlbGVjdG9yOiAnLmdyb3VwX19oZWFkZXInLFxyXG5cdFx0XHRcdGZpZWxkc19zZWxlY3RvcjogJy5ncm91cF9fZmllbGRzJyxcclxuXHRcdFx0XHRvcGVuX2NsYXNzICAgICA6ICdpcy1vcGVuJyxcclxuXHRcdFx0XHRleGNsdXNpdmUgICAgICA6IGZhbHNlXHJcblx0XHRcdH0sIG9wdHMgKTtcclxuXHJcblx0XHRcdC8vIEJvdW5kIGhhbmRsZXJzIChmb3IgYWRkL3JlbW92ZUV2ZW50TGlzdGVuZXIgc3ltbWV0cnkpLlxyXG5cdFx0XHQvKiogQHByaXZhdGUgKi9cclxuXHRcdFx0dGhpcy5fb25fY2xpY2sgPSB0aGlzLl9vbl9jbGljay5iaW5kKCB0aGlzICk7XHJcblx0XHRcdC8qKiBAcHJpdmF0ZSAqL1xyXG5cdFx0XHR0aGlzLl9vbl9rZXlkb3duID0gdGhpcy5fb25fa2V5ZG93bi5iaW5kKCB0aGlzICk7XHJcblxyXG5cdFx0XHQvKiogQHR5cGUge0hUTUxFbGVtZW50W119IEBwcml2YXRlICovXHJcblx0XHRcdHRoaXMuX2dyb3VwcyA9IFtdO1xyXG5cdFx0XHQvKiogQHR5cGUge011dGF0aW9uT2JzZXJ2ZXJ8bnVsbH0gQHByaXZhdGUgKi9cclxuXHRcdFx0dGhpcy5fb2JzZXJ2ZXIgPSBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSW5pdGlhbGl6ZSB0aGUgY29udHJvbGxlcjogY2FjaGUgZ3JvdXBzLCBhdHRhY2ggbGlzdGVuZXJzLCBzZXQgQVJJQSxcclxuXHRcdCAqIGFuZCBzdGFydCBvYnNlcnZpbmcgRE9NIGNoYW5nZXMgaW5zaWRlIHRoZSBjb250YWluZXIuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge1dQQkNfQ29sbGFwc2libGVfR3JvdXBzfSBUaGUgaW5zdGFuY2UgKGNoYWluYWJsZSkuXHJcblx0XHQgKiBAbGlzdGVucyBjbGlja1xyXG5cdFx0ICogQGxpc3RlbnMga2V5ZG93blxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0aW5pdCgpIHtcclxuXHRcdFx0aWYgKCAhdGhpcy5yb290ICkge1xyXG5cdFx0XHRcdHJldHVybiB0aGlzO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMuX2dyb3VwcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKFxyXG5cdFx0XHRcdHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yQWxsKCB0aGlzLm9wdHMuZ3JvdXBfc2VsZWN0b3IgKVxyXG5cdFx0XHQpO1xyXG5cdFx0XHR0aGlzLnJvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgdGhpcy5fb25fY2xpY2ssIGZhbHNlICk7XHJcblx0XHRcdHRoaXMucm9vdC5hZGRFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIHRoaXMuX29uX2tleWRvd24sIGZhbHNlICk7XHJcblxyXG5cdFx0XHQvLyBPYnNlcnZlIGR5bmFtaWMgaW5zZXJ0cy9yZW1vdmFscyAoSW5zcGVjdG9yIHJlLXJlbmRlcnMpLlxyXG5cdFx0XHR0aGlzLl9vYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCAoKSA9PiB7XHJcblx0XHRcdFx0dGhpcy5yZWZyZXNoKCk7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0dGhpcy5fb2JzZXJ2ZXIub2JzZXJ2ZSggdGhpcy5yb290LCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9ICk7XHJcblxyXG5cdFx0XHR0aGlzLl9zeW5jX2FsbF9hcmlhKCk7XHJcblx0XHRcdHJldHVybiB0aGlzO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogVGVhciBkb3duIHRoZSBjb250cm9sbGVyOiBkZXRhY2ggbGlzdGVuZXJzLCBzdG9wIHRoZSBvYnNlcnZlcixcclxuXHRcdCAqIGFuZCBkcm9wIGludGVybmFsIHJlZmVyZW5jZXMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKiBAc2luY2UgMjAyNS0wOC0yNlxyXG5cdFx0ICovXHJcblx0XHRkZXN0cm95KCkge1xyXG5cdFx0XHRpZiAoICF0aGlzLnJvb3QgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMucm9vdC5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2xpY2snLCB0aGlzLl9vbl9jbGljaywgZmFsc2UgKTtcclxuXHRcdFx0dGhpcy5yb290LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgdGhpcy5fb25fa2V5ZG93biwgZmFsc2UgKTtcclxuXHRcdFx0aWYgKCB0aGlzLl9vYnNlcnZlciApIHtcclxuXHRcdFx0XHR0aGlzLl9vYnNlcnZlci5kaXNjb25uZWN0KCk7XHJcblx0XHRcdFx0dGhpcy5fb2JzZXJ2ZXIgPSBudWxsO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMuX2dyb3VwcyA9IFtdO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmUtc2NhbiB0aGUgRE9NIGZvciBjdXJyZW50IGdyb3VwcyBhbmQgcmUtYXBwbHkgQVJJQSB0byBhbGwgb2YgdGhlbS5cclxuXHRcdCAqIFVzZWZ1bCBhZnRlciBkeW5hbWljIChyZSlyZW5kZXJzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0cmVmcmVzaCgpIHtcclxuXHRcdFx0aWYgKCAhdGhpcy5yb290ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLl9ncm91cHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChcclxuXHRcdFx0XHR0aGlzLnJvb3QucXVlcnlTZWxlY3RvckFsbCggdGhpcy5vcHRzLmdyb3VwX3NlbGVjdG9yIClcclxuXHRcdFx0KTtcclxuXHRcdFx0dGhpcy5fc3luY19hbGxfYXJpYSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2hlY2sgd2hldGhlciB0aGUgY29udGFpbmVyIGlzIGluIGV4Y2x1c2l2ZSAoYWNjb3JkaW9uKSBtb2RlLlxyXG5cdFx0ICpcclxuXHRcdCAqIE9yZGVyIG9mIHByZWNlZGVuY2U6XHJcblx0XHQgKiAgMSkgRXhwbGljaXQgb3B0aW9uIGBvcHRzLmV4Y2x1c2l2ZWBcclxuXHRcdCAqICAyKSBDb250YWluZXIgaGFzIGNsYXNzIGAud3BiY19jb2xsYXBzaWJsZS0tZXhjbHVzaXZlYFxyXG5cdFx0ICogIDMpIENvbnRhaW5lciBtYXRjaGVzIGBbZGF0YS13cGJjLWFjY29yZGlvbj1cImV4Y2x1c2l2ZVwiXWBcclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBleGNsdXNpdmUgbW9kZSBpcyBhY3RpdmUuXHJcblx0XHQgKiBAc2luY2UgMjAyNS0wOC0yNlxyXG5cdFx0ICovXHJcblx0XHRpc19leGNsdXNpdmUoKSB7XHJcblx0XHRcdHJldHVybiAhIShcclxuXHRcdFx0XHR0aGlzLm9wdHMuZXhjbHVzaXZlIHx8XHJcblx0XHRcdFx0dGhpcy5yb290LmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfY29sbGFwc2libGUtLWV4Y2x1c2l2ZScgKSB8fFxyXG5cdFx0XHRcdHRoaXMucm9vdC5tYXRjaGVzKCAnW2RhdGEtd3BiYy1hY2NvcmRpb249XCJleGNsdXNpdmVcIl0nIClcclxuXHRcdFx0KTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIERldGVybWluZSB3aGV0aGVyIGEgc3BlY2lmaWMgZ3JvdXAgaXMgb3Blbi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBncm91cCBUaGUgZ3JvdXAgZWxlbWVudCB0byB0ZXN0LlxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGdyb3VwIGlzIGN1cnJlbnRseSBvcGVuLlxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0aXNfb3Blbihncm91cCkge1xyXG5cdFx0XHRyZXR1cm4gZ3JvdXAuY2xhc3NMaXN0LmNvbnRhaW5zKCB0aGlzLm9wdHMub3Blbl9jbGFzcyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogT3BlbiBhIGdyb3VwLiBIb25vcnMgZXhjbHVzaXZlIG1vZGUgYnkgY29sbGFwc2luZyBhbGwgc2libGluZyBncm91cHNcclxuXHRcdCAqIChxdWVyaWVkIGZyb20gdGhlIGxpdmUgRE9NIGF0IGNhbGwtdGltZSkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZ3JvdXAgVGhlIGdyb3VwIGVsZW1lbnQgdG8gb3Blbi5cclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gW2V4Y2x1c2l2ZV1cclxuXHRcdCAqICAgICAgICBJZiBwcm92aWRlZCwgb3ZlcnJpZGVzIGNvbnRhaW5lciBtb2RlIGZvciB0aGlzIGFjdGlvbiBvbmx5LlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKiBAZmlyZXMgQ3VzdG9tRXZlbnQjd3BiYzpjb2xsYXBzaWJsZTpvcGVuXHJcblx0XHQgKiBAc2luY2UgMjAyNS0wOC0yNlxyXG5cdFx0ICovXHJcblx0XHRleHBhbmQoZ3JvdXAsIGV4Y2x1c2l2ZSkge1xyXG5cdFx0XHRpZiAoICFncm91cCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgZG9fZXhjbHVzaXZlID0gKHR5cGVvZiBleGNsdXNpdmUgPT09ICdib29sZWFuJykgPyBleGNsdXNpdmUgOiB0aGlzLmlzX2V4Y2x1c2l2ZSgpO1xyXG5cdFx0XHRpZiAoIGRvX2V4Y2x1c2l2ZSApIHtcclxuXHRcdFx0XHQvLyBBbHdheXMgdXNlIHRoZSBsaXZlIERPTSwgbm90IHRoZSBjYWNoZWQgbGlzdC5cclxuXHRcdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKFxyXG5cdFx0XHRcdFx0dGhpcy5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoIHRoaXMub3B0cy5ncm91cF9zZWxlY3RvciApLFxyXG5cdFx0XHRcdFx0KGcpID0+IHtcclxuXHRcdFx0XHRcdFx0aWYgKCBnICE9PSBncm91cCApIHtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLl9zZXRfb3BlbiggZywgZmFsc2UgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdCk7XHJcblx0XHRcdH1cclxuXHRcdFx0dGhpcy5fc2V0X29wZW4oIGdyb3VwLCB0cnVlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDbG9zZSBhIGdyb3VwLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGdyb3VwIFRoZSBncm91cCBlbGVtZW50IHRvIGNsb3NlLlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKiBAZmlyZXMgQ3VzdG9tRXZlbnQjd3BiYzpjb2xsYXBzaWJsZTpjbG9zZVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0Y29sbGFwc2UoZ3JvdXApIHtcclxuXHRcdFx0aWYgKCAhZ3JvdXAgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMuX3NldF9vcGVuKCBncm91cCwgZmFsc2UgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFRvZ2dsZSBhIGdyb3VwJ3Mgb3Blbi9jbG9zZWQgc3RhdGUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZ3JvdXAgVGhlIGdyb3VwIGVsZW1lbnQgdG8gdG9nZ2xlLlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKiBAc2luY2UgMjAyNS0wOC0yNlxyXG5cdFx0ICovXHJcblx0XHR0b2dnbGUoZ3JvdXApIHtcclxuXHRcdFx0aWYgKCAhZ3JvdXAgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXNbdGhpcy5pc19vcGVuKCBncm91cCApID8gJ2NvbGxhcHNlJyA6ICdleHBhbmQnXSggZ3JvdXAgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE9wZW4gYSBncm91cCBieSBpdHMgaW5kZXggd2l0aGluIHRoZSBjb250YWluZXIgKDAtYmFzZWQpLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCBaZXJvLWJhc2VkIGluZGV4IG9mIHRoZSBncm91cC5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0b3Blbl9ieV9pbmRleChpbmRleCkge1xyXG5cdFx0XHRjb25zdCBncm91cCA9IHRoaXMuX2dyb3Vwc1tpbmRleF07XHJcblx0XHRcdGlmICggZ3JvdXAgKSB7XHJcblx0XHRcdFx0dGhpcy5leHBhbmQoIGdyb3VwICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE9wZW4gYSBncm91cCBieSBtYXRjaGluZyB0ZXh0IGNvbnRhaW5lZCB3aXRoaW4gdGhlIDxoMz4gaW5zaWRlIHRoZSBoZWFkZXIuXHJcblx0XHQgKiBUaGUgY29tcGFyaXNvbiBpcyBjYXNlLWluc2Vuc2l0aXZlIGFuZCBzdWJzdHJpbmctYmFzZWQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHRleHQgVGV4dCB0byBtYXRjaCBhZ2FpbnN0IHRoZSBoZWFkaW5nIGNvbnRlbnRzLlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKiBAc2luY2UgMjAyNS0wOC0yNlxyXG5cdFx0ICovXHJcblx0XHRvcGVuX2J5X2hlYWRpbmcodGV4dCkge1xyXG5cdFx0XHRpZiAoICF0ZXh0ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCB0ICAgICA9IFN0cmluZyggdGV4dCApLnRvTG93ZXJDYXNlKCk7XHJcblx0XHRcdGNvbnN0IG1hdGNoID0gdGhpcy5fZ3JvdXBzLmZpbmQoIChnKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgaCA9IGcucXVlcnlTZWxlY3RvciggdGhpcy5vcHRzLmhlYWRlcl9zZWxlY3RvciArICcgaDMnICk7XHJcblx0XHRcdFx0cmV0dXJuIGggJiYgaC50ZXh0Q29udGVudC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoIHQgKSAhPT0gLTE7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0aWYgKCBtYXRjaCApIHtcclxuXHRcdFx0XHR0aGlzLmV4cGFuZCggbWF0Y2ggKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIEludGVybmFsXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEZWxlZ2F0ZWQgY2xpY2sgaGFuZGxlciBmb3IgaGVhZGVycy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHBhcmFtIHtNb3VzZUV2ZW50fSBldiBUaGUgY2xpY2sgZXZlbnQuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdF9vbl9jbGljayhldikge1xyXG5cdFx0XHRjb25zdCBidG4gPSBldi50YXJnZXQuY2xvc2VzdCggdGhpcy5vcHRzLmhlYWRlcl9zZWxlY3RvciApO1xyXG5cdFx0XHRpZiAoICFidG4gfHwgIXRoaXMucm9vdC5jb250YWlucyggYnRuICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGV2LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdGV2LnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cdFx0XHRjb25zdCBncm91cCA9IGJ0bi5jbG9zZXN0KCB0aGlzLm9wdHMuZ3JvdXBfc2VsZWN0b3IgKTtcclxuXHRcdFx0aWYgKCBncm91cCApIHtcclxuXHRcdFx0XHR0aGlzLnRvZ2dsZSggZ3JvdXAgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogS2V5Ym9hcmQgaGFuZGxlciBmb3IgaGVhZGVyIGludGVyYWN0aW9ucyBhbmQgcm92aW5nIGZvY3VzOlxyXG5cdFx0ICogIC0gRW50ZXIvU3BhY2UgdG9nZ2xlcyB0aGUgYWN0aXZlIGdyb3VwLlxyXG5cdFx0ICogIC0gQXJyb3dVcC9BcnJvd0Rvd24gbW92ZXMgZm9jdXMgYmV0d2VlbiBncm91cCBoZWFkZXJzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKiBAcGFyYW0ge0tleWJvYXJkRXZlbnR9IGV2IFRoZSBrZXlib2FyZCBldmVudC5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0X29uX2tleWRvd24oZXYpIHtcclxuXHRcdFx0Y29uc3QgYnRuID0gZXYudGFyZ2V0LmNsb3Nlc3QoIHRoaXMub3B0cy5oZWFkZXJfc2VsZWN0b3IgKTtcclxuXHRcdFx0aWYgKCAhYnRuICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3Qga2V5ID0gZXYua2V5O1xyXG5cclxuXHRcdFx0Ly8gVG9nZ2xlIG9uIEVudGVyIC8gU3BhY2UuXHJcblx0XHRcdGlmICgga2V5ID09PSAnRW50ZXInIHx8IGtleSA9PT0gJyAnICkge1xyXG5cdFx0XHRcdGV2LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0Y29uc3QgZ3JvdXAgPSBidG4uY2xvc2VzdCggdGhpcy5vcHRzLmdyb3VwX3NlbGVjdG9yICk7XHJcblx0XHRcdFx0aWYgKCBncm91cCApIHtcclxuXHRcdFx0XHRcdHRoaXMudG9nZ2xlKCBncm91cCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIE1vdmUgZm9jdXMgd2l0aCBBcnJvd1VwL0Fycm93RG93biBiZXR3ZWVuIGhlYWRlcnMgaW4gdGhpcyBjb250YWluZXIuXHJcblx0XHRcdGlmICgga2V5ID09PSAnQXJyb3dVcCcgfHwga2V5ID09PSAnQXJyb3dEb3duJyApIHtcclxuXHRcdFx0XHRldi5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdGNvbnN0IGhlYWRlcnMgPSBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwoXHJcblx0XHRcdFx0XHR0aGlzLnJvb3QucXVlcnlTZWxlY3RvckFsbCggdGhpcy5vcHRzLmdyb3VwX3NlbGVjdG9yICksXHJcblx0XHRcdFx0XHQoZykgPT4gZy5xdWVyeVNlbGVjdG9yKCB0aGlzLm9wdHMuaGVhZGVyX3NlbGVjdG9yIClcclxuXHRcdFx0XHQpLmZpbHRlciggQm9vbGVhbiApO1xyXG5cdFx0XHRcdGNvbnN0IGlkeCAgICAgPSBoZWFkZXJzLmluZGV4T2YoIGJ0biApO1xyXG5cdFx0XHRcdGlmICggaWR4ICE9PSAtMSApIHtcclxuXHRcdFx0XHRcdGNvbnN0IG5leHRfaWR4ID0gKGtleSA9PT0gJ0Fycm93RG93bicpXHJcblx0XHRcdFx0XHRcdD8gTWF0aC5taW4oIGhlYWRlcnMubGVuZ3RoIC0gMSwgaWR4ICsgMSApXHJcblx0XHRcdFx0XHRcdDogTWF0aC5tYXgoIDAsIGlkeCAtIDEgKTtcclxuXHRcdFx0XHRcdGhlYWRlcnNbbmV4dF9pZHhdLmZvY3VzKCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBcHBseSBBUklBIHN5bmNocm9uaXphdGlvbiB0byBhbGwga25vd24gZ3JvdXBzIGJhc2VkIG9uIHRoZWlyIG9wZW4gc3RhdGUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0X3N5bmNfYWxsX2FyaWEoKSB7XHJcblx0XHRcdHRoaXMuX2dyb3Vwcy5mb3JFYWNoKCAoZykgPT4gdGhpcy5fc3luY19ncm91cF9hcmlhKCBnICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFN5bmMgQVJJQSBhdHRyaWJ1dGVzIGFuZCB2aXNpYmlsaXR5IG9uIGEgc2luZ2xlIGdyb3VwLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBncm91cCBUaGUgZ3JvdXAgZWxlbWVudCB0byBzeW5jLlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKiBAc2luY2UgMjAyNS0wOC0yNlxyXG5cdFx0ICovXHJcblx0XHRfc3luY19ncm91cF9hcmlhKGdyb3VwKSB7XHJcblx0XHRcdGNvbnN0IGlzX29wZW4gPSB0aGlzLmlzX29wZW4oIGdyb3VwICk7XHJcblx0XHRcdGNvbnN0IGhlYWRlciAgPSBncm91cC5xdWVyeVNlbGVjdG9yKCB0aGlzLm9wdHMuaGVhZGVyX3NlbGVjdG9yICk7XHJcblx0XHRcdGNvbnN0IHBhbmVsICAgPSBncm91cC5xdWVyeVNlbGVjdG9yKCB0aGlzLm9wdHMuZmllbGRzX3NlbGVjdG9yICk7XHJcblxyXG5cdFx0XHRpZiAoIGhlYWRlciApIHtcclxuXHRcdFx0XHQvLyBIZWFkZXIgaXMgYSByZWFsIDxidXR0b24+LCByb2xlIGlzIGhhcm1sZXNzIGhlcmUuXHJcblx0XHRcdFx0aGVhZGVyLnNldEF0dHJpYnV0ZSggJ3JvbGUnLCAnYnV0dG9uJyApO1xyXG5cdFx0XHRcdGhlYWRlci5zZXRBdHRyaWJ1dGUoICdhcmlhLWV4cGFuZGVkJywgaXNfb3BlbiA/ICd0cnVlJyA6ICdmYWxzZScgKTtcclxuXHJcblx0XHRcdFx0Ly8gTGluayBoZWFkZXIgdG8gcGFuZWwgYnkgaWQgaWYgYXZhaWxhYmxlLlxyXG5cdFx0XHRcdGlmICggcGFuZWwgKSB7XHJcblx0XHRcdFx0XHRpZiAoICFwYW5lbC5pZCApIHtcclxuXHRcdFx0XHRcdFx0cGFuZWwuaWQgPSB0aGlzLl9nZW5lcmF0ZV9pZCggJ3dwYmNfY29sbGFwc2libGVfcGFuZWwnICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoICFoZWFkZXIuaGFzQXR0cmlidXRlKCAnYXJpYS1jb250cm9scycgKSApIHtcclxuXHRcdFx0XHRcdFx0aGVhZGVyLnNldEF0dHJpYnV0ZSggJ2FyaWEtY29udHJvbHMnLCBwYW5lbC5pZCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIHBhbmVsICkge1xyXG5cdFx0XHRcdHBhbmVsLmhpZGRlbiA9ICFpc19vcGVuO1xyXG5cdFx0XHRcdHBhbmVsLnNldEF0dHJpYnV0ZSggJ2FyaWEtaGlkZGVuJywgaXNfb3BlbiA/ICdmYWxzZScgOiAndHJ1ZScgKTtcclxuXHRcdFx0XHQvLyBPcHRpb25hbCBsYW5kbWFyazpcclxuXHRcdFx0XHQvLyBwYW5lbC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAncmVnaW9uJyk7XHJcblx0XHRcdFx0Ly8gcGFuZWwuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsbGVkYnknLCBoZWFkZXIuaWQgfHwgKGhlYWRlci5pZCA9IHRoaXMuX2dlbmVyYXRlX2lkKCd3cGJjX2NvbGxhcHNpYmxlX2hlYWRlcicpKSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEludGVybmFsIHN0YXRlIGNoYW5nZTogc2V0IGEgZ3JvdXAncyBvcGVuL2Nsb3NlZCBzdGF0ZSwgc3luYyBBUklBLFxyXG5cdFx0ICogbWFuYWdlIGZvY3VzIG9uIGNvbGxhcHNlLCBhbmQgZW1pdCBhIGN1c3RvbSBldmVudC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZ3JvdXAgVGhlIGdyb3VwIGVsZW1lbnQgdG8gbXV0YXRlLlxyXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBvcGVuIFdoZXRoZXIgdGhlIGdyb3VwIHNob3VsZCBiZSBvcGVuLlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKiBAZmlyZXMgQ3VzdG9tRXZlbnQjd3BiYzpjb2xsYXBzaWJsZTpvcGVuXHJcblx0XHQgKiBAZmlyZXMgQ3VzdG9tRXZlbnQjd3BiYzpjb2xsYXBzaWJsZTpjbG9zZVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0X3NldF9vcGVuKGdyb3VwLCBvcGVuKSB7XHJcblx0XHRcdGlmICggIW9wZW4gJiYgZ3JvdXAuY29udGFpbnMoIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgKSApIHtcclxuXHRcdFx0XHRjb25zdCBoZWFkZXIgPSBncm91cC5xdWVyeVNlbGVjdG9yKCB0aGlzLm9wdHMuaGVhZGVyX3NlbGVjdG9yICk7XHJcblx0XHRcdFx0aGVhZGVyICYmIGhlYWRlci5mb2N1cygpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGdyb3VwLmNsYXNzTGlzdC50b2dnbGUoIHRoaXMub3B0cy5vcGVuX2NsYXNzLCBvcGVuICk7XHJcblx0XHRcdHRoaXMuX3N5bmNfZ3JvdXBfYXJpYSggZ3JvdXAgKTtcclxuXHRcdFx0Y29uc3QgZXZfbmFtZSA9IG9wZW4gPyAnd3BiYzpjb2xsYXBzaWJsZTpvcGVuJyA6ICd3cGJjOmNvbGxhcHNpYmxlOmNsb3NlJztcclxuXHRcdFx0Z3JvdXAuZGlzcGF0Y2hFdmVudCggbmV3IEN1c3RvbUV2ZW50KCBldl9uYW1lLCB7XHJcblx0XHRcdFx0YnViYmxlczogdHJ1ZSxcclxuXHRcdFx0XHRkZXRhaWwgOiB7IGdyb3VwLCByb290OiB0aGlzLnJvb3QsIGluc3RhbmNlOiB0aGlzIH1cclxuXHRcdFx0fSApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBHZW5lcmF0ZSBhIHVuaXF1ZSBET00gaWQgd2l0aCB0aGUgc3BlY2lmaWVkIHByZWZpeC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHByZWZpeCBUaGUgaWQgcHJlZml4IHRvIHVzZS5cclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9IEEgdW5pcXVlIGVsZW1lbnQgaWQgbm90IHByZXNlbnQgaW4gdGhlIGRvY3VtZW50LlxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0X2dlbmVyYXRlX2lkKHByZWZpeCkge1xyXG5cdFx0XHRsZXQgaSA9IDE7XHJcblx0XHRcdGxldCBpZDtcclxuXHRcdFx0ZG8ge1xyXG5cdFx0XHRcdGlkID0gcHJlZml4ICsgJ18nICsgKGkrKyk7XHJcblx0XHRcdH1cclxuXHRcdFx0d2hpbGUgKCBkLmdldEVsZW1lbnRCeUlkKCBpZCApICk7XHJcblx0XHRcdHJldHVybiBpZDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEF1dG8taW5pdGlhbGl6ZSBjb2xsYXBzaWJsZSBjb250cm9sbGVycyBvbiB0aGUgcGFnZS5cclxuXHQgKiBGaW5kcyB0b3AtbGV2ZWwgYC53cGJjX2NvbGxhcHNpYmxlYCBjb250YWluZXJzIChpZ25vcmluZyBuZXN0ZWQgb25lcyksXHJcblx0ICogYW5kIGluc3RhbnRpYXRlcyB7QGxpbmsgV1BCQ19Db2xsYXBzaWJsZV9Hcm91cHN9IG9uIGVhY2guXHJcblx0ICpcclxuXHQgKiBAZnVuY3Rpb24gV1BCQ19Db2xsYXBzaWJsZV9BdXRvSW5pdFxyXG5cdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0ICogQGV4YW1wbGVcclxuXHQgKiAvLyBSdW5zIGF1dG9tYXRpY2FsbHkgb24gRE9NQ29udGVudExvYWRlZDsgY2FuIGFsc28gYmUgY2FsbGVkIG1hbnVhbGx5OlxyXG5cdCAqIFdQQkNfQ29sbGFwc2libGVfQXV0b0luaXQoKTtcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NvbGxhcHNpYmxlX19hdXRvX2luaXQoKSB7XHJcblx0XHR2YXIgUk9PVCAgPSAnLndwYmNfY29sbGFwc2libGUnO1xyXG5cdFx0dmFyIG5vZGVzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGQucXVlcnlTZWxlY3RvckFsbCggUk9PVCApIClcclxuXHRcdFx0LmZpbHRlciggZnVuY3Rpb24gKG4pIHtcclxuXHRcdFx0XHRyZXR1cm4gIW4ucGFyZW50RWxlbWVudCB8fCAhbi5wYXJlbnRFbGVtZW50LmNsb3Nlc3QoIFJPT1QgKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdG5vZGVzLmZvckVhY2goIGZ1bmN0aW9uIChub2RlKSB7XHJcblx0XHRcdGlmICggbm9kZS5fX3dwYmNfY29sbGFwc2libGVfaW5zdGFuY2UgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdHZhciBleGNsdXNpdmUgPSBub2RlLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfY29sbGFwc2libGUtLWV4Y2x1c2l2ZScgKSB8fCBub2RlLm1hdGNoZXMoICdbZGF0YS13cGJjLWFjY29yZGlvbj1cImV4Y2x1c2l2ZVwiXScgKTtcclxuXHJcblx0XHRcdG5vZGUuX193cGJjX2NvbGxhcHNpYmxlX2luc3RhbmNlID0gbmV3IFdQQkNfQ29sbGFwc2libGVfR3JvdXBzKCBub2RlLCB7IGV4Y2x1c2l2ZSB9ICkuaW5pdCgpO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0Ly8gRXhwb3J0IHRvIGdsb2JhbCBmb3IgbWFudWFsIGNvbnRyb2wgaWYgbmVlZGVkLlxyXG5cdHcuV1BCQ19Db2xsYXBzaWJsZV9Hcm91cHMgICA9IFdQQkNfQ29sbGFwc2libGVfR3JvdXBzO1xyXG5cdHcuV1BCQ19Db2xsYXBzaWJsZV9BdXRvSW5pdCA9IHdwYmNfY29sbGFwc2libGVfX2F1dG9faW5pdDtcclxuXHJcblx0Ly8gRE9NLXJlYWR5IGF1dG8gaW5pdC5cclxuXHRpZiAoIGQucmVhZHlTdGF0ZSA9PT0gJ2xvYWRpbmcnICkge1xyXG5cdFx0ZC5hZGRFdmVudExpc3RlbmVyKCAnRE9NQ29udGVudExvYWRlZCcsIHdwYmNfY29sbGFwc2libGVfX2F1dG9faW5pdCwgeyBvbmNlOiB0cnVlIH0gKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0d3BiY19jb2xsYXBzaWJsZV9fYXV0b19pbml0KCk7XHJcblx0fVxyXG59KSggd2luZG93LCBkb2N1bWVudCApO1xyXG4iXX0=
