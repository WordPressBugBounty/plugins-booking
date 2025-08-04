
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
}

/**
 * Hide Vertical Left Bar.
 */
function wpbc_admin_ui__sidebar_left__do_min() {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min max compact none' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'min' );
	jQuery( '.wpbc_ui__top_nav__btn_open_left_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_left_vertical_nav' ).addClass( 'wpbc_ui__hide' );
}

/**
 * Colapse Vertical Left Bar.
 */
function wpbc_admin_ui__sidebar_left__do_compact() {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min max compact none' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'compact' );
	jQuery( '.wpbc_ui__top_nav__btn_open_left_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_left_vertical_nav' ).addClass( 'wpbc_ui__hide' );
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVpX2VsZW1lbnRzLmpzIiwidWlfbG9hZGluZ19zcGluLmpzIiwidWlfcmFkaW9fY29udGFpbmVyLmpzIiwidWlfZnVsbF9zY3JlZW5fbW9kZS5qcyIsImdtYWlsX2NoZWNrYm94X3NlbGVjdGlvbi5qcyIsImJvb2tpbmdzX2NoZWNrYm94X3NlbGVjdGlvbi5qcyIsInVpX3NpZGViYXJfbGVmdF9fYWN0aW9ucy5qcyIsImNvcHlfdGV4dF90b19jbGlwYnJkLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNqSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3BEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2pSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJ3cGJjX2FsbF9hZG1pbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIlxyXG4vKipcclxuICogQmxpbmsgc3BlY2lmaWMgSFRNTCBlbGVtZW50IHRvIHNldCBhdHRlbnRpb24gdG8gdGhpcyBlbGVtZW50LlxyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gZWxlbWVudF90b19ibGlua1x0XHQgIC0gY2xhc3Mgb3IgaWQgb2YgZWxlbWVudDogJy53cGJjX3dpZGdldF9hdmFpbGFibGVfdW5hdmFpbGFibGUnXHJcbiAqIEBwYXJhbSB7aW50fSBob3dfbWFueV90aW1lc1x0XHRcdCAgLSA0XHJcbiAqIEBwYXJhbSB7aW50fSBob3dfbG9uZ190b19ibGlua1x0XHQgIC0gMzUwXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2JsaW5rX2VsZW1lbnQoIGVsZW1lbnRfdG9fYmxpbmssIGhvd19tYW55X3RpbWVzID0gNCwgaG93X2xvbmdfdG9fYmxpbmsgPSAzNTAgKXtcclxuXHJcblx0Zm9yICggbGV0IGkgPSAwOyBpIDwgaG93X21hbnlfdGltZXM7IGkrKyApe1xyXG5cdFx0alF1ZXJ5KCBlbGVtZW50X3RvX2JsaW5rICkuZmFkZU91dCggaG93X2xvbmdfdG9fYmxpbmsgKS5mYWRlSW4oIGhvd19sb25nX3RvX2JsaW5rICk7XHJcblx0fVxyXG4gICAgalF1ZXJ5KCBlbGVtZW50X3RvX2JsaW5rICkuYW5pbWF0ZSgge29wYWNpdHk6IDF9LCA1MDAgKTtcclxufVxyXG4iLCIvKipcclxuICogICBTdXBwb3J0IEZ1bmN0aW9ucyAtIFNwaW4gSWNvbiBpbiBCdXR0b25zICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBSZW1vdmUgc3BpbiBpY29uIGZyb20gIGJ1dHRvbiBhbmQgRW5hYmxlIHRoaXMgYnV0dG9uLlxyXG4gKlxyXG4gKiBAcGFyYW0gYnV0dG9uX2NsaWNrZWRfZWxlbWVudF9pZFx0XHQtIEhUTUwgSUQgYXR0cmlidXRlIG9mIHRoaXMgYnV0dG9uXHJcbiAqIEByZXR1cm4gc3RyaW5nXHRcdFx0XHRcdFx0LSBDU1MgY2xhc3NlcyB0aGF0IHdhcyBwcmV2aW91c2x5IGluIGJ1dHRvbiBpY29uXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2J1dHRvbl9fcmVtb3ZlX3NwaW4oYnV0dG9uX2NsaWNrZWRfZWxlbWVudF9pZCkge1xyXG5cclxuXHR2YXIgcHJldmlvc19jbGFzc2VzID0gJyc7XHJcblx0aWYgKFxyXG5cdFx0KHVuZGVmaW5lZCAhPSBidXR0b25fY2xpY2tlZF9lbGVtZW50X2lkKVxyXG5cdFx0JiYgKCcnICE9IGJ1dHRvbl9jbGlja2VkX2VsZW1lbnRfaWQpXHJcblx0KSB7XHJcblx0XHR2YXIgakVsZW1lbnQgPSBqUXVlcnkoICcjJyArIGJ1dHRvbl9jbGlja2VkX2VsZW1lbnRfaWQgKTtcclxuXHRcdGlmICggakVsZW1lbnQubGVuZ3RoICkge1xyXG5cdFx0XHRwcmV2aW9zX2NsYXNzZXMgPSB3cGJjX2J1dHRvbl9kaXNhYmxlX2xvYWRpbmdfaWNvbiggakVsZW1lbnQuZ2V0KCAwICkgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiBwcmV2aW9zX2NsYXNzZXM7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogU2hvdyBMb2FkaW5nIChyb3RhdGluZyBhcnJvdykgaWNvbiBmb3IgYnV0dG9uIHRoYXQgaGFzIGJlZW4gY2xpY2tlZFxyXG4gKlxyXG4gKiBAcGFyYW0gdGhpc19idXR0b25cdFx0LSB0aGlzIG9iamVjdCBvZiBzcGVjaWZpYyBidXR0b25cclxuICogQHJldHVybiBzdHJpbmdcdFx0XHQtIENTUyBjbGFzc2VzIHRoYXQgd2FzIHByZXZpb3VzbHkgaW4gYnV0dG9uIGljb25cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24odGhpc19idXR0b24pIHtcclxuXHJcblx0dmFyIGpCdXR0b24gICAgICAgICA9IGpRdWVyeSggdGhpc19idXR0b24gKTtcclxuXHR2YXIgakljb24gICAgICAgICAgID0gakJ1dHRvbi5maW5kKCAnaScgKTtcclxuXHR2YXIgcHJldmlvc19jbGFzc2VzID0gakljb24uYXR0ciggJ2NsYXNzJyApO1xyXG5cclxuXHRqSWNvbi5yZW1vdmVDbGFzcygpLmFkZENsYXNzKCAnbWVudV9pY29uIGljb24tMXggd3BiY19pY25fcm90YXRlX3JpZ2h0IHdwYmNfc3BpbicgKTtcdC8vIFNldCBSb3RhdGUgaWNvbi5cclxuXHQvLyBqSWNvbi5hZGRDbGFzcyggJ3dwYmNfYW5pbWF0aW9uX3BhdXNlJyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFBhdXNlIGFuaW1hdGlvbi5cclxuXHQvLyBqSWNvbi5hZGRDbGFzcyggJ3dwYmNfdWlfcmVkJyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBTZXQgaWNvbiBjb2xvciByZWQuXHJcblxyXG5cdGpJY29uLmF0dHIoICd3cGJjX3ByZXZpb3VzX2NsYXNzJywgcHJldmlvc19jbGFzc2VzIClcclxuXHJcblx0akJ1dHRvbi5hZGRDbGFzcyggJ2Rpc2FibGVkJyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIERpc2FibGUgYnV0dG9uXHJcblx0Ly8gV2UgbmVlZCB0byAgc2V0ICBoZXJlIGF0dHIgaW5zdGVhZCBvZiBwcm9wLCBiZWNhdXNlIGZvciBBIGVsZW1lbnRzLCAgYXR0cmlidXRlICdkaXNhYmxlZCcgZG8gIG5vdCBhZGRlZCB3aXRoIGpCdXR0b24ucHJvcCggXCJkaXNhYmxlZFwiLCB0cnVlICk7LlxyXG5cclxuXHRqQnV0dG9uLmF0dHIoICd3cGJjX3ByZXZpb3VzX29uY2xpY2snLCBqQnV0dG9uLmF0dHIoICdvbmNsaWNrJyApICk7XHRcdC8vIFNhdmUgdGhpcyB2YWx1ZS5cclxuXHRqQnV0dG9uLmF0dHIoICdvbmNsaWNrJywgJycgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRGlzYWJsZSBhY3Rpb25zIFwib24gY2xpY2tcIi5cclxuXHJcblx0cmV0dXJuIHByZXZpb3NfY2xhc3NlcztcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBIaWRlIExvYWRpbmcgKHJvdGF0aW5nIGFycm93KSBpY29uIGZvciBidXR0b24gdGhhdCB3YXMgY2xpY2tlZCBhbmQgc2hvdyBwcmV2aW91cyBpY29uIGFuZCBlbmFibGUgYnV0dG9uXHJcbiAqXHJcbiAqIEBwYXJhbSB0aGlzX2J1dHRvblx0XHQtIHRoaXMgb2JqZWN0IG9mIHNwZWNpZmljIGJ1dHRvblxyXG4gKiBAcmV0dXJuIHN0cmluZ1x0XHRcdC0gQ1NTIGNsYXNzZXMgdGhhdCB3YXMgcHJldmlvdXNseSBpbiBidXR0b24gaWNvblxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19idXR0b25fZGlzYWJsZV9sb2FkaW5nX2ljb24odGhpc19idXR0b24pIHtcclxuXHJcblx0dmFyIGpCdXR0b24gPSBqUXVlcnkoIHRoaXNfYnV0dG9uICk7XHJcblx0dmFyIGpJY29uICAgPSBqQnV0dG9uLmZpbmQoICdpJyApO1xyXG5cclxuXHR2YXIgcHJldmlvc19jbGFzc2VzID0gakljb24uYXR0ciggJ3dwYmNfcHJldmlvdXNfY2xhc3MnICk7XHJcblx0aWYgKFxyXG5cdFx0KHVuZGVmaW5lZCAhPSBwcmV2aW9zX2NsYXNzZXMpXHJcblx0XHQmJiAoJycgIT0gcHJldmlvc19jbGFzc2VzKVxyXG5cdCkge1xyXG5cdFx0akljb24ucmVtb3ZlQ2xhc3MoKS5hZGRDbGFzcyggcHJldmlvc19jbGFzc2VzICk7XHJcblx0fVxyXG5cclxuXHRqQnV0dG9uLnJlbW92ZUNsYXNzKCAnZGlzYWJsZWQnICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gUmVtb3ZlIERpc2FibGUgYnV0dG9uLlxyXG5cclxuXHR2YXIgcHJldmlvdXNfb25jbGljayA9IGpCdXR0b24uYXR0ciggJ3dwYmNfcHJldmlvdXNfb25jbGljaycgKVxyXG5cdGlmIChcclxuXHRcdCh1bmRlZmluZWQgIT0gcHJldmlvdXNfb25jbGljaylcclxuXHRcdCYmICgnJyAhPSBwcmV2aW91c19vbmNsaWNrKVxyXG5cdCkge1xyXG5cdFx0akJ1dHRvbi5hdHRyKCAnb25jbGljaycsIHByZXZpb3VzX29uY2xpY2sgKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiBwcmV2aW9zX2NsYXNzZXM7XHJcbn1cclxuIiwiLyoqXHJcbiAqIE9uIHNlbGVjdGlvbiAgb2YgcmFkaW8gYnV0dG9uLCBhZGp1c3QgYXR0cmlidXRlcyBvZiByYWRpbyBjb250YWluZXJcclxuICpcclxuICogQHBhcmFtIF90aGlzXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3VpX2VsX19yYWRpb19jb250YWluZXJfc2VsZWN0aW9uKF90aGlzKSB7XHJcblxyXG5cdGlmICggalF1ZXJ5KCBfdGhpcyApLmlzKCAnOmNoZWNrZWQnICkgKSB7XHJcblx0XHRqUXVlcnkoIF90aGlzICkucGFyZW50cyggJy53cGJjX3VpX3JhZGlvX3NlY3Rpb24nICkuZmluZCggJy53cGJjX3VpX3JhZGlvX2NvbnRhaW5lcicgKS5yZW1vdmVBdHRyKCAnZGF0YS1zZWxlY3RlZCcgKTtcclxuXHRcdGpRdWVyeSggX3RoaXMgKS5wYXJlbnRzKCAnLndwYmNfdWlfcmFkaW9fY29udGFpbmVyOm5vdCguZGlzYWJsZWQpJyApLmF0dHIoICdkYXRhLXNlbGVjdGVkJywgdHJ1ZSApO1xyXG5cdH1cclxuXHJcblx0aWYgKCBqUXVlcnkoIF90aGlzICkuaXMoICc6ZGlzYWJsZWQnICkgKSB7XHJcblx0XHRqUXVlcnkoIF90aGlzICkucGFyZW50cyggJy53cGJjX3VpX3JhZGlvX2NvbnRhaW5lcicgKS5hZGRDbGFzcyggJ2Rpc2FibGVkJyApO1xyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIE9uIGNsaWNrIG9uIFJhZGlvIENvbnRhaW5lciwgd2Ugd2lsbCAgc2VsZWN0ICB0aGUgIHJhZGlvIGJ1dHRvbiAgICBhbmQgdGhlbiBhZGp1c3QgYXR0cmlidXRlcyBvZiByYWRpbyBjb250YWluZXJcclxuICpcclxuICogQHBhcmFtIF90aGlzXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3VpX2VsX19yYWRpb19jb250YWluZXJfY2xpY2soX3RoaXMpIHtcclxuXHJcblx0aWYgKCBqUXVlcnkoIF90aGlzICkuaGFzQ2xhc3MoICdkaXNhYmxlZCcgKSApIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdHZhciBqX3JhZGlvID0galF1ZXJ5KCBfdGhpcyApLmZpbmQoICdpbnB1dFt0eXBlPXJhZGlvXTpub3QoLndwYmMtZm9ybS1yYWRpby1pbnRlcm5hbCknICk7XHJcblx0aWYgKCBqX3JhZGlvLmxlbmd0aCApIHtcclxuXHRcdGpfcmFkaW8ucHJvcCggJ2NoZWNrZWQnLCB0cnVlICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHR9XHJcblxyXG59IiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyA9PSBGdWxsIFNjcmVlbiAgLSAgc3VwcG9ydCBmdW5jdGlvbnMgICA9PVxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbi8qKlxyXG4gKiBDaGVjayBGdWxsICBzY3JlZW4gbW9kZSwgIGJ5ICByZW1vdmluZyB0b3AgdGFiXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NoZWNrX2Z1bGxfc2NyZWVuX21vZGUoKXtcclxuXHRpZiAoIGpRdWVyeSggJ2JvZHknICkuaGFzQ2xhc3MoICd3cGJjX2FkbWluX2Z1bGxfc2NyZWVuJyApICkge1xyXG5cdFx0alF1ZXJ5KCAnaHRtbCcgKS5yZW1vdmVDbGFzcyggJ3dwLXRvb2xiYXInICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGpRdWVyeSggJ2h0bWwnICkuYWRkQ2xhc3MoICd3cC10b29sYmFyJyApO1xyXG5cdH1cclxuXHR3cGJjX2NoZWNrX2J1dHRvbnNfbWF4X21pbl9pbl9mdWxsX3NjcmVlbl9tb2RlKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfY2hlY2tfYnV0dG9uc19tYXhfbWluX2luX2Z1bGxfc2NyZWVuX21vZGUoKSB7XHJcblx0aWYgKCBqUXVlcnkoICdib2R5JyApLmhhc0NsYXNzKCAnd3BiY19hZG1pbl9mdWxsX3NjcmVlbicgKSApIHtcclxuXHRcdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fZnVsbF9zY3JlZW4nICAgKS5hZGRDbGFzcyggICAgJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0XHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX25vcm1hbF9zY3JlZW4nICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2Z1bGxfc2NyZWVuJyAgICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdFx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9ub3JtYWxfc2NyZWVuJyApLmFkZENsYXNzKCAgICAnd3BiY191aV9faGlkZScgKTtcclxuXHR9XHJcbn1cclxuXHJcbmpRdWVyeSggZG9jdW1lbnQgKS5yZWFkeSggZnVuY3Rpb24gKCkge1xyXG5cdHdwYmNfY2hlY2tfZnVsbF9zY3JlZW5fbW9kZSgpO1xyXG59ICk7IiwiLyoqXHJcbiAqIENoZWNrYm94IFNlbGVjdGlvbiBmdW5jdGlvbnMgZm9yIExpc3RpbmcuXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIFNlbGVjdGlvbnMgb2Ygc2V2ZXJhbCAgY2hlY2tib3hlcyBsaWtlIGluIGdNYWlsIHdpdGggc2hpZnQgOilcclxuICogTmVlZCB0byAgaGF2ZSB0aGlzIHN0cnVjdHVyZTpcclxuICogLndwYmNfc2VsZWN0YWJsZV90YWJsZVxyXG4gKiAgICAgIC53cGJjX3NlbGVjdGFibGVfaGVhZFxyXG4gKiAgICAgICAgICAgICAgLmNoZWNrLWNvbHVtblxyXG4gKiAgICAgICAgICAgICAgICAgIDpjaGVja2JveFxyXG4gKiAgICAgIC53cGJjX3NlbGVjdGFibGVfYm9keVxyXG4gKiAgICAgICAgICAud3BiY19yb3dcclxuICogICAgICAgICAgICAgIC5jaGVjay1jb2x1bW5cclxuICogICAgICAgICAgICAgICAgICA6Y2hlY2tib3hcclxuICogICAgICAud3BiY19zZWxlY3RhYmxlX2Zvb3RcclxuICogICAgICAgICAgICAgIC5jaGVjay1jb2x1bW5cclxuICogICAgICAgICAgICAgICAgICA6Y2hlY2tib3hcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZGVmaW5lX2dtYWlsX2NoZWNrYm94X3NlbGVjdGlvbiggJCApe1xyXG5cclxuXHR2YXIgY2hlY2tzLCBmaXJzdCwgbGFzdCwgY2hlY2tlZCwgc2xpY2VkLCBsYXN0Q2xpY2tlZCA9IGZhbHNlO1xyXG5cclxuXHQvLyBDaGVjayBhbGwgY2hlY2tib3hlcy5cclxuXHQkKCAnLndwYmNfc2VsZWN0YWJsZV9ib2R5JyApLmZpbmQoICcuY2hlY2stY29sdW1uJyApLmZpbmQoICc6Y2hlY2tib3gnICkub24oXHJcblx0XHQnY2xpY2snLFxyXG5cdFx0ZnVuY3Rpb24gKGUpIHtcclxuXHRcdFx0aWYgKCAndW5kZWZpbmVkJyA9PSBlLnNoaWZ0S2V5ICkge1xyXG5cdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggZS5zaGlmdEtleSApIHtcclxuXHRcdFx0XHRpZiAoICEgbGFzdENsaWNrZWQgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y2hlY2tzICA9ICQoIGxhc3RDbGlja2VkICkuY2xvc2VzdCggJy53cGJjX3NlbGVjdGFibGVfYm9keScgKS5maW5kKCAnOmNoZWNrYm94JyApLmZpbHRlciggJzp2aXNpYmxlOmVuYWJsZWQnICk7XHJcblx0XHRcdFx0Zmlyc3QgICA9IGNoZWNrcy5pbmRleCggbGFzdENsaWNrZWQgKTtcclxuXHRcdFx0XHRsYXN0ICAgID0gY2hlY2tzLmluZGV4KCB0aGlzICk7XHJcblx0XHRcdFx0Y2hlY2tlZCA9ICQoIHRoaXMgKS5wcm9wKCAnY2hlY2tlZCcgKTtcclxuXHRcdFx0XHRpZiAoIDAgPCBmaXJzdCAmJiAwIDwgbGFzdCAmJiBmaXJzdCAhPSBsYXN0ICkge1xyXG5cdFx0XHRcdFx0c2xpY2VkID0gKGxhc3QgPiBmaXJzdCkgPyBjaGVja3Muc2xpY2UoIGZpcnN0LCBsYXN0ICkgOiBjaGVja3Muc2xpY2UoIGxhc3QsIGZpcnN0ICk7XHJcblx0XHRcdFx0XHRzbGljZWQucHJvcChcclxuXHRcdFx0XHRcdFx0J2NoZWNrZWQnLFxyXG5cdFx0XHRcdFx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRcdFx0aWYgKCAkKCB0aGlzICkuY2xvc2VzdCggJy53cGJjX3JvdycgKS5pcyggJzp2aXNpYmxlJyApICkge1xyXG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIGNoZWNrZWQ7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0KS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRsYXN0Q2xpY2tlZCA9IHRoaXM7XHJcblxyXG5cdFx0XHQvLyB0b2dnbGUgXCJjaGVjayBhbGxcIiBjaGVja2JveGVzLlxyXG5cdFx0XHR2YXIgdW5jaGVja2VkID0gJCggdGhpcyApLmNsb3Nlc3QoICcud3BiY19zZWxlY3RhYmxlX2JvZHknICkuZmluZCggJzpjaGVja2JveCcgKS5maWx0ZXIoICc6dmlzaWJsZTplbmFibGVkJyApLm5vdCggJzpjaGVja2VkJyApO1xyXG5cdFx0XHQkKCB0aGlzICkuY2xvc2VzdCggJy53cGJjX3NlbGVjdGFibGVfdGFibGUnICkuY2hpbGRyZW4oICcud3BiY19zZWxlY3RhYmxlX2hlYWQsIC53cGJjX3NlbGVjdGFibGVfZm9vdCcgKS5maW5kKCAnOmNoZWNrYm94JyApLnByb3AoXHJcblx0XHRcdFx0J2NoZWNrZWQnLFxyXG5cdFx0XHRcdGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdHJldHVybiAoMCA9PT0gdW5jaGVja2VkLmxlbmd0aCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHQpLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHQpO1xyXG5cclxuXHQvLyBIZWFkIHx8IEZvb3QgY2xpY2tpbmcgdG8gIHNlbGVjdCAvIGRlc2VsZWN0IEFMTC5cclxuXHQkKCAnLndwYmNfc2VsZWN0YWJsZV9oZWFkLCAud3BiY19zZWxlY3RhYmxlX2Zvb3QnICkuZmluZCggJy5jaGVjay1jb2x1bW4gOmNoZWNrYm94JyApLm9uKFxyXG5cdFx0J2NsaWNrJyxcclxuXHRcdGZ1bmN0aW9uIChldmVudCkge1xyXG5cdFx0XHR2YXIgJHRoaXMgICAgICAgICAgPSAkKCB0aGlzICksXHJcblx0XHRcdFx0JHRhYmxlICAgICAgICAgPSAkdGhpcy5jbG9zZXN0KCAnLndwYmNfc2VsZWN0YWJsZV90YWJsZScgKSxcclxuXHRcdFx0XHRjb250cm9sQ2hlY2tlZCA9ICR0aGlzLnByb3AoICdjaGVja2VkJyApLFxyXG5cdFx0XHRcdHRvZ2dsZSAgICAgICAgID0gZXZlbnQuc2hpZnRLZXkgfHwgJHRoaXMuZGF0YSggJ3dwLXRvZ2dsZScgKTtcclxuXHJcblx0XHRcdCR0YWJsZS5jaGlsZHJlbiggJy53cGJjX3NlbGVjdGFibGVfYm9keScgKS5maWx0ZXIoICc6dmlzaWJsZScgKVxyXG5cdFx0XHRcdC5maW5kKCAnLmNoZWNrLWNvbHVtbicgKS5maW5kKCAnOmNoZWNrYm94JyApXHJcblx0XHRcdFx0LnByb3AoXHJcblx0XHRcdFx0XHQnY2hlY2tlZCcsXHJcblx0XHRcdFx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRcdGlmICggJCggdGhpcyApLmlzKCAnOmhpZGRlbiw6ZGlzYWJsZWQnICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGlmICggdG9nZ2xlICkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiAhICQoIHRoaXMgKS5wcm9wKCAnY2hlY2tlZCcgKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICggY29udHJvbENoZWNrZWQgKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdCkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHJcblx0XHRcdCR0YWJsZS5jaGlsZHJlbiggJy53cGJjX3NlbGVjdGFibGVfaGVhZCwgIC53cGJjX3NlbGVjdGFibGVfZm9vdCcgKS5maWx0ZXIoICc6dmlzaWJsZScgKVxyXG5cdFx0XHRcdC5maW5kKCAnLmNoZWNrLWNvbHVtbicgKS5maW5kKCAnOmNoZWNrYm94JyApXHJcblx0XHRcdFx0LnByb3AoXHJcblx0XHRcdFx0XHQnY2hlY2tlZCcsXHJcblx0XHRcdFx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRcdGlmICggdG9nZ2xlICkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICggY29udHJvbENoZWNrZWQgKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdCk7XHJcblx0XHR9XHJcblx0KTtcclxuXHJcblxyXG5cdC8vIFZpc3VhbGx5ICBzaG93IHNlbGVjdGVkIGJvcmRlci5cclxuXHQkKCAnLndwYmNfc2VsZWN0YWJsZV9ib2R5JyApLmZpbmQoICcuY2hlY2stY29sdW1uIDpjaGVja2JveCcgKS5vbihcclxuXHRcdCdjaGFuZ2UnLFxyXG5cdFx0ZnVuY3Rpb24gKGV2ZW50KSB7XHJcblx0XHRcdGlmICggalF1ZXJ5KCB0aGlzICkuaXMoICc6Y2hlY2tlZCcgKSApIHtcclxuXHRcdFx0XHRqUXVlcnkoIHRoaXMgKS5jbG9zZXN0KCAnLndwYmNfbGlzdF9yb3cnICkuYWRkQ2xhc3MoICdyb3dfc2VsZWN0ZWRfY29sb3InICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0alF1ZXJ5KCB0aGlzICkuY2xvc2VzdCggJy53cGJjX2xpc3Rfcm93JyApLnJlbW92ZUNsYXNzKCAncm93X3NlbGVjdGVkX2NvbG9yJyApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBEaXNhYmxlIHRleHQgc2VsZWN0aW9uIHdoaWxlIHByZXNzaW5nICdzaGlmdCcuXHJcblx0XHRcdGRvY3VtZW50LmdldFNlbGVjdGlvbigpLnJlbW92ZUFsbFJhbmdlcygpO1xyXG5cclxuXHRcdFx0Ly8gU2hvdyBvciBoaWRlIGJ1dHRvbnMgb24gQWN0aW9ucyB0b29sYmFyICBhdCAgQm9va2luZyBMaXN0aW5nICBwYWdlLCAgaWYgd2UgaGF2ZSBzb21lIHNlbGVjdGVkIGJvb2tpbmdzLlxyXG5cdFx0XHR3cGJjX3Nob3dfaGlkZV9hY3Rpb25fYnV0dG9uc19mb3Jfc2VsZWN0ZWRfYm9va2luZ3MoKTtcclxuXHRcdH1cclxuXHQpO1xyXG5cclxuXHR3cGJjX3Nob3dfaGlkZV9hY3Rpb25fYnV0dG9uc19mb3Jfc2VsZWN0ZWRfYm9va2luZ3MoKTtcclxufVxyXG4iLCJcclxuLyoqXHJcbiAqIEdldCBJRCBhcnJheSAgb2Ygc2VsZWN0ZWQgZWxlbWVudHNcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZ2V0X3NlbGVjdGVkX3Jvd19pZCgpIHtcclxuXHJcblx0dmFyICR0YWJsZSAgICAgID0galF1ZXJ5KCAnLndwYmNfX3dyYXBfX2Jvb2tpbmdfbGlzdGluZyAud3BiY19zZWxlY3RhYmxlX3RhYmxlJyApO1xyXG5cdHZhciBjaGVja2JveGVzICA9ICR0YWJsZS5jaGlsZHJlbiggJy53cGJjX3NlbGVjdGFibGVfYm9keScgKS5maWx0ZXIoICc6dmlzaWJsZScgKS5maW5kKCAnLmNoZWNrLWNvbHVtbicgKS5maW5kKCAnOmNoZWNrYm94JyApO1xyXG5cdHZhciBzZWxlY3RlZF9pZCA9IFtdO1xyXG5cclxuXHRqUXVlcnkuZWFjaChcclxuXHRcdGNoZWNrYm94ZXMsXHJcblx0XHRmdW5jdGlvbiAoa2V5LCBjaGVja2JveCkge1xyXG5cdFx0XHRpZiAoIGpRdWVyeSggY2hlY2tib3ggKS5pcyggJzpjaGVja2VkJyApICkge1xyXG5cdFx0XHRcdHZhciBlbGVtZW50X2lkID0gd3BiY19nZXRfcm93X2lkX2Zyb21fZWxlbWVudCggY2hlY2tib3ggKTtcclxuXHRcdFx0XHRzZWxlY3RlZF9pZC5wdXNoKCBlbGVtZW50X2lkICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHQpO1xyXG5cclxuXHRyZXR1cm4gc2VsZWN0ZWRfaWQ7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogR2V0IElEIG9mIHJvdywgIGJhc2VkIG9uIGNsY2lrZWQgZWxlbWVudFxyXG4gKlxyXG4gKiBAcGFyYW0gdGhpc19pbmJvdW5kX2VsZW1lbnQgIC0gdXN1c2xseSAgdGhpc1xyXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19nZXRfcm93X2lkX2Zyb21fZWxlbWVudCh0aGlzX2luYm91bmRfZWxlbWVudCkge1xyXG5cclxuXHR2YXIgZWxlbWVudF9pZCA9IGpRdWVyeSggdGhpc19pbmJvdW5kX2VsZW1lbnQgKS5jbG9zZXN0KCAnLndwYmNfbGlzdGluZ191c3VhbF9yb3cnICkuYXR0ciggJ2lkJyApO1xyXG5cclxuXHRlbGVtZW50X2lkID0gcGFyc2VJbnQoIGVsZW1lbnRfaWQucmVwbGFjZSggJ3Jvd19pZF8nLCAnJyApICk7XHJcblxyXG5cdHJldHVybiBlbGVtZW50X2lkO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqID09IEJvb2tpbmcgTGlzdGluZyA9PSBTaG93IG9yIGhpZGUgYnV0dG9ucyBvbiBBY3Rpb25zIHRvb2xiYXIgIGF0ICAgIHBhZ2UsICBpZiB3ZSBoYXZlIHNvbWUgc2VsZWN0ZWQgYm9va2luZ3MuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3Nob3dfaGlkZV9hY3Rpb25fYnV0dG9uc19mb3Jfc2VsZWN0ZWRfYm9va2luZ3MoKXtcclxuXHJcblx0dmFyIHNlbGVjdGVkX3Jvd3NfYXJyID0gd3BiY19nZXRfc2VsZWN0ZWRfcm93X2lkKCk7XHJcblxyXG5cdGlmICggc2VsZWN0ZWRfcm93c19hcnIubGVuZ3RoID4gMCApIHtcclxuXHRcdGpRdWVyeSggJy5oaWRlX2J1dHRvbl9pZl9ub19zZWxlY3Rpb24nICkuc2hvdygpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRqUXVlcnkoICcuaGlkZV9idXR0b25faWZfbm9fc2VsZWN0aW9uJyApLmhpZGUoKTtcclxuXHR9XHJcbn0iLCJcInVzZSBzdHJpY3RcIjtcclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vID09IExlZnQgQmFyICAtICBleHBhbmQgLyBjb2xhcHNlIGZ1bmN0aW9ucyAgID09XHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuLyoqXHJcbiAqIEV4cGFuZCBWZXJ0aWNhbCBMZWZ0IEJhci5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fZG9fbWF4KCkge1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5yZW1vdmVDbGFzcyggJ21pbiBtYXggY29tcGFjdCBub25lJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5hZGRDbGFzcyggJ21heCcgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fbGVmdF92ZXJ0aWNhbF9uYXYnICkuYWRkQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5faGlkZV9sZWZ0X3ZlcnRpY2FsX25hdicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBIaWRlIFZlcnRpY2FsIExlZnQgQmFyLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19kb19taW4oKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLnJlbW92ZUNsYXNzKCAnbWluIG1heCBjb21wYWN0IG5vbmUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLmFkZENsYXNzKCAnbWluJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fb3Blbl9sZWZ0X3ZlcnRpY2FsX25hdicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9oaWRlX2xlZnRfdmVydGljYWxfbmF2JyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbGFwc2UgVmVydGljYWwgTGVmdCBCYXIuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX2RvX2NvbXBhY3QoKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLnJlbW92ZUNsYXNzKCAnbWluIG1heCBjb21wYWN0IG5vbmUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLmFkZENsYXNzKCAnY29tcGFjdCcgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fbGVmdF92ZXJ0aWNhbF9uYXYnICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5faGlkZV9sZWZ0X3ZlcnRpY2FsX25hdicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb21wbGV0ZWx5IEhpZGUgVmVydGljYWwgTGVmdCBCYXIuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX2RvX2hpZGUoKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLnJlbW92ZUNsYXNzKCAnbWluIG1heCBjb21wYWN0IG5vbmUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLmFkZENsYXNzKCAnbm9uZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fbGVmdF92ZXJ0aWNhbF9uYXYnICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5faGlkZV9sZWZ0X3ZlcnRpY2FsX25hdicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0Ly8gSGlkZSB0b3AgXCJNZW51XCIgYnV0dG9uIHdpdGggZGl2aWRlci5cclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX3Nob3dfbGVmdF92ZXJ0aWNhbF9uYXYsLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9zaG93X2xlZnRfdmVydGljYWxfbmF2X2RpdmlkZXInICkuYWRkQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG59XHJcblxyXG4vKipcclxuICogQWN0aW9uIG9uIGNsaWNrIFwiR28gQmFja1wiIC0gc2hvdyByb290IG1lbnVcclxuICogb3Igc29tZSBvdGhlciBzZWN0aW9uIGluIGxlZnQgc2lkZWJhci5cclxuICpcclxuICogQHBhcmFtIHN0cmluZyBtZW51X3RvX3Nob3cgLSBtZW51IHNsdWcuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX3Nob3dfc2VjdGlvbiggbWVudV90b19zaG93ICkge1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX2VsX192ZXJ0X2xlZnRfYmFyX19zZWN0aW9uJyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKVxyXG5cdGpRdWVyeSggJy53cGJjX3VpX2VsX192ZXJ0X2xlZnRfYmFyX19zZWN0aW9uXycgKyBtZW51X3RvX3Nob3cgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcbn1cclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyA9PSBSaWdodCBTaWRlIEJhciAgLSAgZXhwYW5kIC8gY29sYXBzZSBmdW5jdGlvbnMgICA9PVxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbi8qKlxyXG4gKiBFeHBhbmQgVmVydGljYWwgUmlnaHQgQmFyLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9fbWF4KCkge1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5yZW1vdmVDbGFzcyggJ21pbl9yaWdodCBtYXhfcmlnaHQgY29tcGFjdF9yaWdodCBub25lX3JpZ2h0JyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5hZGRDbGFzcyggJ21heF9yaWdodCcgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fcmlnaHRfdmVydGljYWxfbmF2JyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2hpZGVfcmlnaHRfdmVydGljYWxfbmF2JyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEhpZGUgVmVydGljYWwgUmlnaHQgQmFyLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9fbWluKCkge1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5yZW1vdmVDbGFzcyggJ21pbl9yaWdodCBtYXhfcmlnaHQgY29tcGFjdF9yaWdodCBub25lX3JpZ2h0JyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5hZGRDbGFzcyggJ21pbl9yaWdodCcgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fcmlnaHRfdmVydGljYWxfbmF2JyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2hpZGVfcmlnaHRfdmVydGljYWxfbmF2JyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbGFwc2UgVmVydGljYWwgUmlnaHQgQmFyLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9fY29tcGFjdCgpIHtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkucmVtb3ZlQ2xhc3MoICdtaW5fcmlnaHQgbWF4X3JpZ2h0IGNvbXBhY3RfcmlnaHQgbm9uZV9yaWdodCcgKTtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkuYWRkQ2xhc3MoICdjb21wYWN0X3JpZ2h0JyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fb3Blbl9yaWdodF92ZXJ0aWNhbF9uYXYnICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5faGlkZV9yaWdodF92ZXJ0aWNhbF9uYXYnICkuYWRkQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG59XHJcblxyXG4vKipcclxuICogQ29tcGxldGVseSBIaWRlIFZlcnRpY2FsIFJpZ2h0IEJhci5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX2hpZGUoKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLnJlbW92ZUNsYXNzKCAnbWluX3JpZ2h0IG1heF9yaWdodCBjb21wYWN0X3JpZ2h0IG5vbmVfcmlnaHQnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLmFkZENsYXNzKCAnbm9uZV9yaWdodCcgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fcmlnaHRfdmVydGljYWxfbmF2JyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2hpZGVfcmlnaHRfdmVydGljYWxfbmF2JyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHQvLyBIaWRlIHRvcCBcIk1lbnVcIiBidXR0b24gd2l0aCBkaXZpZGVyLlxyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fc2hvd19yaWdodF92ZXJ0aWNhbF9uYXYsLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9zaG93X3JpZ2h0X3ZlcnRpY2FsX25hdl9kaXZpZGVyJyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFjdGlvbiBvbiBjbGljayBcIkdvIEJhY2tcIiAtIHNob3cgcm9vdCBtZW51XHJcbiAqIG9yIHNvbWUgb3RoZXIgc2VjdGlvbiBpbiByaWdodCBzaWRlYmFyLlxyXG4gKlxyXG4gKiBAcGFyYW0gc3RyaW5nIG1lbnVfdG9fc2hvdyAtIG1lbnUgc2x1Zy5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX3Nob3dfc2VjdGlvbiggbWVudV90b19zaG93ICkge1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX2VsX192ZXJ0X3JpZ2h0X2Jhcl9fc2VjdGlvbicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnIClcclxuXHRqUXVlcnkoICcud3BiY191aV9lbF9fdmVydF9yaWdodF9iYXJfX3NlY3Rpb25fJyArIG1lbnVfdG9fc2hvdyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxufVxyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vID09IEVuZCBSaWdodCBTaWRlIEJhciAgc2VjdGlvbiAgID09XHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuLyoqXHJcbiAqIEdldCBhbmNob3IocykgYXJyYXkgIGZyb20gIFVSTC5cclxuICogRG9jOiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvTG9jYXRpb25cclxuICpcclxuICogQHJldHVybnMgeypbXX1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfdXJsX2dldF9hbmNob3JzX2FycigpIHtcclxuXHR2YXIgaGFzaGVzICAgICAgICAgICAgPSB3aW5kb3cubG9jYXRpb24uaGFzaC5yZXBsYWNlKCAnJTIzJywgJyMnICk7XHJcblx0dmFyIGhhc2hlc19hcnIgICAgICAgID0gaGFzaGVzLnNwbGl0KCAnIycgKTtcclxuXHR2YXIgcmVzdWx0ICAgICAgICAgICAgPSBbXTtcclxuXHR2YXIgaGFzaGVzX2Fycl9sZW5ndGggPSBoYXNoZXNfYXJyLmxlbmd0aDtcclxuXHJcblx0Zm9yICggdmFyIGkgPSAwOyBpIDwgaGFzaGVzX2Fycl9sZW5ndGg7IGkrKyApIHtcclxuXHRcdGlmICggaGFzaGVzX2FycltpXS5sZW5ndGggPiAwICkge1xyXG5cdFx0XHRyZXN1bHQucHVzaCggaGFzaGVzX2FycltpXSApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG4vKipcclxuICogQXV0byBFeHBhbmQgU2V0dGluZ3Mgc2VjdGlvbiBiYXNlZCBvbiBVUkwgYW5jaG9yLCBhZnRlciAgcGFnZSBsb2FkZWQuXHJcbiAqL1xyXG5qUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uICgpIHsgd3BiY19hZG1pbl91aV9fZG9fZXhwYW5kX3NlY3Rpb24oKTsgc2V0VGltZW91dCggJ3dwYmNfYWRtaW5fdWlfX2RvX2V4cGFuZF9zZWN0aW9uJywgMTAgKTsgfSApO1xyXG5qUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uICgpIHsgd3BiY19hZG1pbl91aV9fZG9fZXhwYW5kX3NlY3Rpb24oKTsgc2V0VGltZW91dCggJ3dwYmNfYWRtaW5fdWlfX2RvX2V4cGFuZF9zZWN0aW9uJywgMTUwICk7IH0gKTtcclxuXHJcbi8qKlxyXG4gKiBFeHBhbmQgc2VjdGlvbiBpbiAgR2VuZXJhbCBTZXR0aW5ncyBwYWdlIGFuZCBzZWxlY3QgTWVudSBpdGVtLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fZG9fZXhwYW5kX3NlY3Rpb24oKSB7XHJcblxyXG5cdC8vIHdpbmRvdy5sb2NhdGlvbi5oYXNoICA9ICNzZWN0aW9uX2lkICAvICBkb2M6IGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9Mb2NhdGlvbiAuXHJcblx0dmFyIGFuY2hvcnNfYXJyICAgICAgICA9IHdwYmNfdXJsX2dldF9hbmNob3JzX2FycigpO1xyXG5cdHZhciBhbmNob3JzX2Fycl9sZW5ndGggPSBhbmNob3JzX2Fyci5sZW5ndGg7XHJcblxyXG5cdGlmICggYW5jaG9yc19hcnJfbGVuZ3RoID4gMCApIHtcclxuXHRcdHZhciBvbmVfYW5jaG9yX3Byb3BfdmFsdWUgPSBhbmNob3JzX2FyclswXS5zcGxpdCggJ2RvX2V4cGFuZF9fJyApO1xyXG5cdFx0aWYgKCBvbmVfYW5jaG9yX3Byb3BfdmFsdWUubGVuZ3RoID4gMSApIHtcclxuXHJcblx0XHRcdC8vICd3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FsZW5kYXJfbWV0YWJveCdcclxuXHRcdFx0dmFyIHNlY3Rpb25fdG9fc2hvdyAgICA9IG9uZV9hbmNob3JfcHJvcF92YWx1ZVsxXTtcclxuXHRcdFx0dmFyIHNlY3Rpb25faWRfdG9fc2hvdyA9ICcjJyArIHNlY3Rpb25fdG9fc2hvdztcclxuXHJcblxyXG5cdFx0XHQvLyAtLSBSZW1vdmUgc2VsZWN0ZWQgYmFja2dyb3VuZCBpbiBhbGwgbGVmdCAgbWVudSAgaXRlbXMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdGpRdWVyeSggJy53cGJjX3VpX2VsX192ZXJ0X25hdl9pdGVtICcgKS5yZW1vdmVDbGFzcyggJ2FjdGl2ZScgKTtcclxuXHRcdFx0Ly8gU2V0IGxlZnQgbWVudSBzZWxlY3RlZC5cclxuXHRcdFx0alF1ZXJ5KCAnLmRvX2V4cGFuZF9fJyArIHNlY3Rpb25fdG9fc2hvdyArICdfbGluaycgKS5hZGRDbGFzcyggJ2FjdGl2ZScgKTtcclxuXHRcdFx0dmFyIHNlbGVjdGVkX3RpdGxlID0galF1ZXJ5KCAnLmRvX2V4cGFuZF9fJyArIHNlY3Rpb25fdG9fc2hvdyArICdfbGluayBhIC53cGJjX3VpX2VsX192ZXJ0X25hdl90aXRsZSAnICkudGV4dCgpO1xyXG5cclxuXHRcdFx0Ly8gRXhwYW5kIHNlY3Rpb24sIGlmIGl0IGNvbGFwc2VkLlxyXG5cdFx0XHRpZiAoICEgalF1ZXJ5KCAnLmRvX2V4cGFuZF9fJyArIHNlY3Rpb25fdG9fc2hvdyArICdfbGluaycgKS5wYXJlbnRzKCAnLndwYmNfdWlfZWxfX2xldmVsX19mb2xkZXInICkuaGFzQ2xhc3MoICdleHBhbmRlZCcgKSApIHtcclxuXHRcdFx0XHRqUXVlcnkoICcud3BiY191aV9lbF9fbGV2ZWxfX2ZvbGRlcicgKS5yZW1vdmVDbGFzcyggJ2V4cGFuZGVkJyApO1xyXG5cdFx0XHRcdGpRdWVyeSggJy5kb19leHBhbmRfXycgKyBzZWN0aW9uX3RvX3Nob3cgKyAnX2xpbmsnICkucGFyZW50cyggJy53cGJjX3VpX2VsX19sZXZlbF9fZm9sZGVyJyApLmFkZENsYXNzKCAnZXhwYW5kZWQnICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIC0tIEV4cGFuZCBzZWN0aW9uIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHR2YXIgY29udGFpbmVyX3RvX2hpZGVfY2xhc3MgPSAnLnBvc3Rib3gnO1xyXG5cdFx0XHQvLyBIaWRlIHNlY3Rpb25zICcucG9zdGJveCcgaW4gYWRtaW4gcGFnZSBhbmQgc2hvdyBzcGVjaWZpYyBvbmUuXHJcblx0XHRcdGpRdWVyeSggJy53cGJjX2FkbWluX3BhZ2UgJyArIGNvbnRhaW5lcl90b19oaWRlX2NsYXNzICkuaGlkZSgpO1xyXG5cdFx0XHRqUXVlcnkoICcud3BiY19jb250YWluZXJfYWx3YXlzX2hpZGVfX29uX2xlZnRfbmF2X2NsaWNrJyApLmhpZGUoKTtcclxuXHRcdFx0alF1ZXJ5KCBzZWN0aW9uX2lkX3RvX3Nob3cgKS5zaG93KCk7XHJcblxyXG5cdFx0XHQvLyBTaG93IGFsbCBvdGhlciBzZWN0aW9ucywgIGlmIHByb3ZpZGVkIGluIFVSTDogLi4/cGFnZT13cGJjLXNldHRpbmdzI2RvX2V4cGFuZF9fd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhcGFjaXR5X21ldGFib3gjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhcGFjaXR5X3VwZ3JhZGVfbWV0YWJveCAuXHJcblx0XHRcdGZvciAoIGxldCBpID0gMTsgaSA8IGFuY2hvcnNfYXJyX2xlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRcdGpRdWVyeSggJyMnICsgYW5jaG9yc19hcnJbaV0gKS5zaG93KCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggZmFsc2UgKSB7XHJcblx0XHRcdFx0dmFyIHRhcmdldE9mZnNldCA9IHdwYmNfc2Nyb2xsX3RvKCBzZWN0aW9uX2lkX3RvX3Nob3cgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gLS0gU2V0IFZhbHVlIHRvIElucHV0IGFib3V0IHNlbGVjdGVkIE5hdiBlbGVtZW50ICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gICAgICAgLy8gRml4SW46IDkuOC42LjEuXHJcblx0XHRcdHZhciBzZWN0aW9uX2lkX3RhYiA9IHNlY3Rpb25faWRfdG9fc2hvdy5zdWJzdHJpbmcoIDAsIHNlY3Rpb25faWRfdG9fc2hvdy5sZW5ndGggLSA4ICkgKyAnX3RhYic7XHJcblx0XHRcdGlmICggY29udGFpbmVyX3RvX2hpZGVfY2xhc3MgPT0gc2VjdGlvbl9pZF90b19zaG93ICkge1xyXG5cdFx0XHRcdHNlY3Rpb25faWRfdGFiID0gJyN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfYWxsX3RhYidcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoICcjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhcGFjaXR5X21ldGFib3gsI3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYXBhY2l0eV91cGdyYWRlX21ldGFib3gnID09IHNlY3Rpb25faWRfdG9fc2hvdyApIHtcclxuXHRcdFx0XHRzZWN0aW9uX2lkX3RhYiA9ICcjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhcGFjaXR5X3RhYidcclxuXHRcdFx0fVxyXG5cdFx0XHRqUXVlcnkoICcjZm9ybV92aXNpYmxlX3NlY3Rpb24nICkudmFsKCBzZWN0aW9uX2lkX3RhYiApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIExpa2UgYmxpbmtpbmcgc29tZSBlbGVtZW50cy5cclxuXHRcdHdwYmNfYWRtaW5fdWlfX2RvX19hbmNob3JfX2Fub3RoZXJfYWN0aW9ucygpO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9faXNfaW5fbW9iaWxlX3NjcmVlbl9zaXplKCkge1xyXG5cdHJldHVybiB3cGJjX2FkbWluX3VpX19pc19pbl90aGlzX3NjcmVlbl9zaXplKCA2MDUgKTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9faXNfaW5fdGhpc19zY3JlZW5fc2l6ZShzaXplKSB7XHJcblx0cmV0dXJuICh3aW5kb3cuc2NyZWVuLndpZHRoIDw9IHNpemUpO1xyXG59XHJcblxyXG4vKipcclxuICogT3BlbiBzZXR0aW5ncyBwYWdlICB8ICBFeHBhbmQgc2VjdGlvbiAgfCAgU2VsZWN0IE1lbnUgaXRlbS5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX2RvX19vcGVuX3VybF9fZXhwYW5kX3NlY3Rpb24odXJsLCBzZWN0aW9uX2lkKSB7XHJcblxyXG5cdC8vIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gdXJsICsgJyZkb19leHBhbmQ9JyArIHNlY3Rpb25faWQgKyAnI2RvX2V4cGFuZF9fJyArIHNlY3Rpb25faWQ7IC8vLlxyXG5cdHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gdXJsICsgJyNkb19leHBhbmRfXycgKyBzZWN0aW9uX2lkO1xyXG5cclxuXHRpZiAoIHdwYmNfYWRtaW5fdWlfX2lzX2luX21vYmlsZV9zY3JlZW5fc2l6ZSgpICkge1xyXG5cdFx0d3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19kb19taW4oKTtcclxuXHR9XHJcblxyXG5cdHdwYmNfYWRtaW5fdWlfX2RvX2V4cGFuZF9zZWN0aW9uKCk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogQ2hlY2sgIGZvciBPdGhlciBhY3Rpb25zOiAgTGlrZSBibGlua2luZyBzb21lIGVsZW1lbnRzIGluIHNldHRpbmdzIHBhZ2UuIEUuZy4gRGF5cyBzZWxlY3Rpb24gIG9yICBjaGFuZ2Utb3ZlciBkYXlzLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fZG9fX2FuY2hvcl9fYW5vdGhlcl9hY3Rpb25zKCkge1xyXG5cclxuXHR2YXIgYW5jaG9yc19hcnIgICAgICAgID0gd3BiY191cmxfZ2V0X2FuY2hvcnNfYXJyKCk7XHJcblx0dmFyIGFuY2hvcnNfYXJyX2xlbmd0aCA9IGFuY2hvcnNfYXJyLmxlbmd0aDtcclxuXHJcblx0Ly8gT3RoZXIgYWN0aW9uczogIExpa2UgYmxpbmtpbmcgc29tZSBlbGVtZW50cy5cclxuXHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBhbmNob3JzX2Fycl9sZW5ndGg7IGkrKyApIHtcclxuXHJcblx0XHR2YXIgdGhpc19hbmNob3IgPSBhbmNob3JzX2FycltpXTtcclxuXHJcblx0XHR2YXIgdGhpc19hbmNob3JfcHJvcF92YWx1ZSA9IHRoaXNfYW5jaG9yLnNwbGl0KCAnZG9fb3RoZXJfYWN0aW9uc19fJyApO1xyXG5cclxuXHRcdGlmICggdGhpc19hbmNob3JfcHJvcF92YWx1ZS5sZW5ndGggPiAxICkge1xyXG5cclxuXHRcdFx0dmFyIHNlY3Rpb25fYWN0aW9uID0gdGhpc19hbmNob3JfcHJvcF92YWx1ZVsxXTtcclxuXHJcblx0XHRcdHN3aXRjaCAoIHNlY3Rpb25fYWN0aW9uICkge1xyXG5cclxuXHRcdFx0XHRjYXNlICdibGlua19kYXlfc2VsZWN0aW9ucyc6XHJcblx0XHRcdFx0XHQvLyB3cGJjX3VpX3NldHRpbmdzX19wYW5lbF9fY2xpY2soICcjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhbGVuZGFyX3RhYiBhJywgJyN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FsZW5kYXJfbWV0YWJveCcsICdEYXlzIFNlbGVjdGlvbicgKTsuXHJcblx0XHRcdFx0XHR3cGJjX2JsaW5rX2VsZW1lbnQoICcud3BiY190cl9zZXRfZ2VuX2Jvb2tpbmdfdHlwZV9vZl9kYXlfc2VsZWN0aW9ucycsIDQsIDM1MCApO1xyXG5cdFx0XHRcdFx0XHR3cGJjX3Njcm9sbF90byggJy53cGJjX3RyX3NldF9nZW5fYm9va2luZ190eXBlX29mX2RheV9zZWxlY3Rpb25zJyApO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ2JsaW5rX2NoYW5nZV9vdmVyX2RheXMnOlxyXG5cdFx0XHRcdFx0Ly8gd3BiY191aV9zZXR0aW5nc19fcGFuZWxfX2NsaWNrKCAnI3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYWxlbmRhcl90YWIgYScsICcjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhbGVuZGFyX21ldGFib3gnLCAnQ2hhbmdlb3ZlciBEYXlzJyApOy5cclxuXHRcdFx0XHRcdHdwYmNfYmxpbmtfZWxlbWVudCggJy53cGJjX3RyX3NldF9nZW5fYm9va2luZ19yYW5nZV9zZWxlY3Rpb25fdGltZV9pc19hY3RpdmUnLCA0LCAzNTAgKTtcclxuXHRcdFx0XHRcdFx0d3BiY19zY3JvbGxfdG8oICcud3BiY190cl9zZXRfZ2VuX2Jvb2tpbmdfcmFuZ2Vfc2VsZWN0aW9uX3RpbWVfaXNfYWN0aXZlJyApO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ2JsaW5rX2NhcHRjaGEnOlxyXG5cdFx0XHRcdFx0d3BiY19ibGlua19lbGVtZW50KCAnLndwYmNfdHJfc2V0X2dlbl9ib29raW5nX2lzX3VzZV9jYXB0Y2hhJywgNCwgMzUwICk7XHJcblx0XHRcdFx0XHRcdHdwYmNfc2Nyb2xsX3RvKCAnLndwYmNfdHJfc2V0X2dlbl9ib29raW5nX2lzX3VzZV9jYXB0Y2hhJyApO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcbn0iLCIvKipcclxuICogQ29weSB0eHQgdG8gY2xpcGJyZCBmcm9tIFRleHQgZmllbGRzLlxyXG4gKlxyXG4gKiBAcGFyYW0gaHRtbF9lbGVtZW50X2lkICAtIGUuZy4gJ2RhdGFfZmllbGQnXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jb3B5X3RleHRfdG9fY2xpcGJyZF9mcm9tX2VsZW1lbnQoIGh0bWxfZWxlbWVudF9pZCApIHtcclxuXHQvLyBHZXQgdGhlIHRleHQgZmllbGQuXHJcblx0dmFyIGNvcHlUZXh0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGh0bWxfZWxlbWVudF9pZCApO1xyXG5cclxuXHQvLyBTZWxlY3QgdGhlIHRleHQgZmllbGQuXHJcblx0Y29weVRleHQuc2VsZWN0KCk7XHJcblx0Y29weVRleHQuc2V0U2VsZWN0aW9uUmFuZ2UoIDAsIDk5OTk5ICk7IC8vIEZvciBtb2JpbGUgZGV2aWNlcy5cclxuXHJcblx0Ly8gQ29weSB0aGUgdGV4dCBpbnNpZGUgdGhlIHRleHQgZmllbGQuXHJcblx0dmFyIGlzX2NvcGllZCA9IHdwYmNfY29weV90ZXh0X3RvX2NsaXBicmQoIGNvcHlUZXh0LnZhbHVlICk7XHJcblx0aWYgKCAhIGlzX2NvcGllZCApIHtcclxuXHRcdGNvbnNvbGUuZXJyb3IoICdPb3BzLCB1bmFibGUgdG8gY29weScsIGNvcHlUZXh0LnZhbHVlICk7XHJcblx0fVxyXG5cdHJldHVybiBpc19jb3BpZWQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb3B5IHR4dCB0byBjbGlwYnJkLlxyXG4gKlxyXG4gKiBAcGFyYW0gdGV4dFxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY29weV90ZXh0X3RvX2NsaXBicmQodGV4dCkge1xyXG5cclxuXHRpZiAoICEgbmF2aWdhdG9yLmNsaXBib2FyZCApIHtcclxuXHRcdHJldHVybiB3cGJjX2ZhbGxiYWNrX2NvcHlfdGV4dF90b19jbGlwYnJkKCB0ZXh0ICk7XHJcblx0fVxyXG5cclxuXHRuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCggdGV4dCApLnRoZW4oXHJcblx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdC8vIGNvbnNvbGUubG9nKCAnQXN5bmM6IENvcHlpbmcgdG8gY2xpcGJvYXJkIHdhcyBzdWNjZXNzZnVsIScgKTsuXHJcblx0XHRcdHJldHVybiAgdHJ1ZTtcclxuXHRcdH0sXHJcblx0XHRmdW5jdGlvbiAoZXJyKSB7XHJcblx0XHRcdC8vIGNvbnNvbGUuZXJyb3IoICdBc3luYzogQ291bGQgbm90IGNvcHkgdGV4dDogJywgZXJyICk7LlxyXG5cdFx0XHRyZXR1cm4gIGZhbHNlO1xyXG5cdFx0fVxyXG5cdCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb3B5IHR4dCB0byBjbGlwYnJkIC0gZGVwcmljYXRlZCBtZXRob2QuXHJcbiAqXHJcbiAqIEBwYXJhbSB0ZXh0XHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19mYWxsYmFja19jb3B5X3RleHRfdG9fY2xpcGJyZCggdGV4dCApIHtcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyB2YXIgdGV4dEFyZWEgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoIFwidGV4dGFyZWFcIiApO1xyXG5cdC8vIHRleHRBcmVhLnZhbHVlID0gdGV4dDtcclxuXHQvL1xyXG5cdC8vIC8vIEF2b2lkIHNjcm9sbGluZyB0byBib3R0b20uXHJcblx0Ly8gdGV4dEFyZWEuc3R5bGUudG9wICAgICAgPSBcIjBcIjtcclxuXHQvLyB0ZXh0QXJlYS5zdHlsZS5sZWZ0ICAgICA9IFwiMFwiO1xyXG5cdC8vIHRleHRBcmVhLnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiO1xyXG5cdC8vIHRleHRBcmVhLnN0eWxlLnpJbmRleCAgID0gXCI5OTk5OTk5OTlcIjtcclxuXHQvLyBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCB0ZXh0QXJlYSApO1xyXG5cdC8vIHRleHRBcmVhLmZvY3VzKCk7XHJcblx0Ly8gdGV4dEFyZWEuc2VsZWN0KCk7XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gTm93IGdldCBpdCBhcyBIVE1MICAob3JpZ2luYWwgaGVyZSBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8zNDE5MTc4MC9qYXZhc2NyaXB0LWNvcHktc3RyaW5nLXRvLWNsaXBib2FyZC1hcy10ZXh0LWh0bWwgKS5cclxuXHJcblx0Ly8gWzFdIC0gQ3JlYXRlIGNvbnRhaW5lciBmb3IgdGhlIEhUTUwuXHJcblx0dmFyIGNvbnRhaW5lciAgICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0Y29udGFpbmVyLmlubmVySFRNTCA9IHRleHQ7XHJcblxyXG5cdC8vIFsyXSAtIEhpZGUgZWxlbWVudC5cclxuXHRjb250YWluZXIuc3R5bGUucG9zaXRpb24gICAgICA9ICdmaXhlZCc7XHJcblx0Y29udGFpbmVyLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XHJcblx0Y29udGFpbmVyLnN0eWxlLm9wYWNpdHkgICAgICAgPSAwO1xyXG5cclxuXHQvLyBEZXRlY3QgYWxsIHN0eWxlIHNoZWV0cyBvZiB0aGUgcGFnZS5cclxuXHR2YXIgYWN0aXZlU2hlZXRzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGRvY3VtZW50LnN0eWxlU2hlZXRzICkuZmlsdGVyKFxyXG5cdFx0ZnVuY3Rpb24gKHNoZWV0KSB7XHJcblx0XHRcdHJldHVybiAhIHNoZWV0LmRpc2FibGVkO1xyXG5cdFx0fVxyXG5cdCk7XHJcblxyXG5cdC8vIFszXSAtIE1vdW50IHRoZSBjb250YWluZXIgdG8gdGhlIERPTSB0byBtYWtlIGBjb250ZW50V2luZG93YCBhdmFpbGFibGUuXHJcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggY29udGFpbmVyICk7XHJcblxyXG5cdC8vIFs0XSAtIENvcHkgdG8gY2xpcGJvYXJkLlxyXG5cdHdpbmRvdy5nZXRTZWxlY3Rpb24oKS5yZW1vdmVBbGxSYW5nZXMoKTtcclxuXHJcblx0dmFyIHJhbmdlID0gZG9jdW1lbnQuY3JlYXRlUmFuZ2UoKTtcclxuXHRyYW5nZS5zZWxlY3ROb2RlKCBjb250YWluZXIgKTtcclxuXHR3aW5kb3cuZ2V0U2VsZWN0aW9uKCkuYWRkUmFuZ2UoIHJhbmdlICk7XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0dmFyIHJlc3VsdCA9IGZhbHNlO1xyXG5cclxuXHR0cnkge1xyXG5cdFx0cmVzdWx0ID0gZG9jdW1lbnQuZXhlY0NvbW1hbmQoICdjb3B5JyApO1xyXG5cdFx0Ly8gY29uc29sZS5sb2coICdGYWxsYmFjazogQ29weWluZyB0ZXh0IGNvbW1hbmQgd2FzICcgKyBtc2cgKTsgLy8uXHJcblx0fSBjYXRjaCAoIGVyciApIHtcclxuXHRcdC8vIGNvbnNvbGUuZXJyb3IoICdGYWxsYmFjazogT29wcywgdW5hYmxlIHRvIGNvcHknLCBlcnIgKTsgLy8uXHJcblx0fVxyXG5cdC8vIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoIHRleHRBcmVhICk7IC8vLlxyXG5cclxuXHQvLyBbNS40XSAtIEVuYWJsZSBDU1MuXHJcblx0dmFyIGFjdGl2ZVNoZWV0c19sZW5ndGggPSBhY3RpdmVTaGVldHMubGVuZ3RoO1xyXG5cdGZvciAoIHZhciBpID0gMDsgaSA8IGFjdGl2ZVNoZWV0c19sZW5ndGg7IGkrKyApIHtcclxuXHRcdGFjdGl2ZVNoZWV0c1tpXS5kaXNhYmxlZCA9IGZhbHNlO1xyXG5cdH1cclxuXHJcblx0Ly8gWzZdIC0gUmVtb3ZlIHRoZSBjb250YWluZXJcclxuXHRkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKCBjb250YWluZXIgKTtcclxuXHJcblx0cmV0dXJuICByZXN1bHQ7XHJcbn0iXX0=
