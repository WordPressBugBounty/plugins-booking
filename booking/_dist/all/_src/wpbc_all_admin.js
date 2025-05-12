
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

/**
 * Open settings page  |  Expand section  |  Select Menu item.
 */
function wpbc_admin_ui__do__open_url__expand_section(url, section_id) {

	// window.location.href = url + '&do_expand=' + section_id + '#do_expand__' + section_id; //.
	window.location.href = url + '#do_expand__' + section_id;

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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVpX2VsZW1lbnRzLmpzIiwidWlfbG9hZGluZ19zcGluLmpzIiwidWlfcmFkaW9fY29udGFpbmVyLmpzIiwidWlfZnVsbF9zY3JlZW5fbW9kZS5qcyIsImdtYWlsX2NoZWNrYm94X3NlbGVjdGlvbi5qcyIsImJvb2tpbmdzX2NoZWNrYm94X3NlbGVjdGlvbi5qcyIsInVpX3NpZGViYXJfbGVmdF9fYWN0aW9ucy5qcyIsImNvcHlfdGV4dF90b19jbGlwYnJkLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNqSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3BEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3pNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJ3cGJjX2FsbF9hZG1pbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIlxyXG4vKipcclxuICogQmxpbmsgc3BlY2lmaWMgSFRNTCBlbGVtZW50IHRvIHNldCBhdHRlbnRpb24gdG8gdGhpcyBlbGVtZW50LlxyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gZWxlbWVudF90b19ibGlua1x0XHQgIC0gY2xhc3Mgb3IgaWQgb2YgZWxlbWVudDogJy53cGJjX3dpZGdldF9hdmFpbGFibGVfdW5hdmFpbGFibGUnXHJcbiAqIEBwYXJhbSB7aW50fSBob3dfbWFueV90aW1lc1x0XHRcdCAgLSA0XHJcbiAqIEBwYXJhbSB7aW50fSBob3dfbG9uZ190b19ibGlua1x0XHQgIC0gMzUwXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2JsaW5rX2VsZW1lbnQoIGVsZW1lbnRfdG9fYmxpbmssIGhvd19tYW55X3RpbWVzID0gNCwgaG93X2xvbmdfdG9fYmxpbmsgPSAzNTAgKXtcclxuXHJcblx0Zm9yICggbGV0IGkgPSAwOyBpIDwgaG93X21hbnlfdGltZXM7IGkrKyApe1xyXG5cdFx0alF1ZXJ5KCBlbGVtZW50X3RvX2JsaW5rICkuZmFkZU91dCggaG93X2xvbmdfdG9fYmxpbmsgKS5mYWRlSW4oIGhvd19sb25nX3RvX2JsaW5rICk7XHJcblx0fVxyXG4gICAgalF1ZXJ5KCBlbGVtZW50X3RvX2JsaW5rICkuYW5pbWF0ZSgge29wYWNpdHk6IDF9LCA1MDAgKTtcclxufVxyXG4iLCIvKipcclxuICogICBTdXBwb3J0IEZ1bmN0aW9ucyAtIFNwaW4gSWNvbiBpbiBCdXR0b25zICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBSZW1vdmUgc3BpbiBpY29uIGZyb20gIGJ1dHRvbiBhbmQgRW5hYmxlIHRoaXMgYnV0dG9uLlxyXG4gKlxyXG4gKiBAcGFyYW0gYnV0dG9uX2NsaWNrZWRfZWxlbWVudF9pZFx0XHQtIEhUTUwgSUQgYXR0cmlidXRlIG9mIHRoaXMgYnV0dG9uXHJcbiAqIEByZXR1cm4gc3RyaW5nXHRcdFx0XHRcdFx0LSBDU1MgY2xhc3NlcyB0aGF0IHdhcyBwcmV2aW91c2x5IGluIGJ1dHRvbiBpY29uXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2J1dHRvbl9fcmVtb3ZlX3NwaW4oYnV0dG9uX2NsaWNrZWRfZWxlbWVudF9pZCkge1xyXG5cclxuXHR2YXIgcHJldmlvc19jbGFzc2VzID0gJyc7XHJcblx0aWYgKFxyXG5cdFx0KHVuZGVmaW5lZCAhPSBidXR0b25fY2xpY2tlZF9lbGVtZW50X2lkKVxyXG5cdFx0JiYgKCcnICE9IGJ1dHRvbl9jbGlja2VkX2VsZW1lbnRfaWQpXHJcblx0KSB7XHJcblx0XHR2YXIgakVsZW1lbnQgPSBqUXVlcnkoICcjJyArIGJ1dHRvbl9jbGlja2VkX2VsZW1lbnRfaWQgKTtcclxuXHRcdGlmICggakVsZW1lbnQubGVuZ3RoICkge1xyXG5cdFx0XHRwcmV2aW9zX2NsYXNzZXMgPSB3cGJjX2J1dHRvbl9kaXNhYmxlX2xvYWRpbmdfaWNvbiggakVsZW1lbnQuZ2V0KCAwICkgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiBwcmV2aW9zX2NsYXNzZXM7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogU2hvdyBMb2FkaW5nIChyb3RhdGluZyBhcnJvdykgaWNvbiBmb3IgYnV0dG9uIHRoYXQgaGFzIGJlZW4gY2xpY2tlZFxyXG4gKlxyXG4gKiBAcGFyYW0gdGhpc19idXR0b25cdFx0LSB0aGlzIG9iamVjdCBvZiBzcGVjaWZpYyBidXR0b25cclxuICogQHJldHVybiBzdHJpbmdcdFx0XHQtIENTUyBjbGFzc2VzIHRoYXQgd2FzIHByZXZpb3VzbHkgaW4gYnV0dG9uIGljb25cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24odGhpc19idXR0b24pIHtcclxuXHJcblx0dmFyIGpCdXR0b24gICAgICAgICA9IGpRdWVyeSggdGhpc19idXR0b24gKTtcclxuXHR2YXIgakljb24gICAgICAgICAgID0gakJ1dHRvbi5maW5kKCAnaScgKTtcclxuXHR2YXIgcHJldmlvc19jbGFzc2VzID0gakljb24uYXR0ciggJ2NsYXNzJyApO1xyXG5cclxuXHRqSWNvbi5yZW1vdmVDbGFzcygpLmFkZENsYXNzKCAnbWVudV9pY29uIGljb24tMXggd3BiY19pY25fcm90YXRlX3JpZ2h0IHdwYmNfc3BpbicgKTtcdC8vIFNldCBSb3RhdGUgaWNvbi5cclxuXHQvLyBqSWNvbi5hZGRDbGFzcyggJ3dwYmNfYW5pbWF0aW9uX3BhdXNlJyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFBhdXNlIGFuaW1hdGlvbi5cclxuXHQvLyBqSWNvbi5hZGRDbGFzcyggJ3dwYmNfdWlfcmVkJyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBTZXQgaWNvbiBjb2xvciByZWQuXHJcblxyXG5cdGpJY29uLmF0dHIoICd3cGJjX3ByZXZpb3VzX2NsYXNzJywgcHJldmlvc19jbGFzc2VzIClcclxuXHJcblx0akJ1dHRvbi5hZGRDbGFzcyggJ2Rpc2FibGVkJyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIERpc2FibGUgYnV0dG9uXHJcblx0Ly8gV2UgbmVlZCB0byAgc2V0ICBoZXJlIGF0dHIgaW5zdGVhZCBvZiBwcm9wLCBiZWNhdXNlIGZvciBBIGVsZW1lbnRzLCAgYXR0cmlidXRlICdkaXNhYmxlZCcgZG8gIG5vdCBhZGRlZCB3aXRoIGpCdXR0b24ucHJvcCggXCJkaXNhYmxlZFwiLCB0cnVlICk7LlxyXG5cclxuXHRqQnV0dG9uLmF0dHIoICd3cGJjX3ByZXZpb3VzX29uY2xpY2snLCBqQnV0dG9uLmF0dHIoICdvbmNsaWNrJyApICk7XHRcdC8vIFNhdmUgdGhpcyB2YWx1ZS5cclxuXHRqQnV0dG9uLmF0dHIoICdvbmNsaWNrJywgJycgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRGlzYWJsZSBhY3Rpb25zIFwib24gY2xpY2tcIi5cclxuXHJcblx0cmV0dXJuIHByZXZpb3NfY2xhc3NlcztcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBIaWRlIExvYWRpbmcgKHJvdGF0aW5nIGFycm93KSBpY29uIGZvciBidXR0b24gdGhhdCB3YXMgY2xpY2tlZCBhbmQgc2hvdyBwcmV2aW91cyBpY29uIGFuZCBlbmFibGUgYnV0dG9uXHJcbiAqXHJcbiAqIEBwYXJhbSB0aGlzX2J1dHRvblx0XHQtIHRoaXMgb2JqZWN0IG9mIHNwZWNpZmljIGJ1dHRvblxyXG4gKiBAcmV0dXJuIHN0cmluZ1x0XHRcdC0gQ1NTIGNsYXNzZXMgdGhhdCB3YXMgcHJldmlvdXNseSBpbiBidXR0b24gaWNvblxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19idXR0b25fZGlzYWJsZV9sb2FkaW5nX2ljb24odGhpc19idXR0b24pIHtcclxuXHJcblx0dmFyIGpCdXR0b24gPSBqUXVlcnkoIHRoaXNfYnV0dG9uICk7XHJcblx0dmFyIGpJY29uICAgPSBqQnV0dG9uLmZpbmQoICdpJyApO1xyXG5cclxuXHR2YXIgcHJldmlvc19jbGFzc2VzID0gakljb24uYXR0ciggJ3dwYmNfcHJldmlvdXNfY2xhc3MnICk7XHJcblx0aWYgKFxyXG5cdFx0KHVuZGVmaW5lZCAhPSBwcmV2aW9zX2NsYXNzZXMpXHJcblx0XHQmJiAoJycgIT0gcHJldmlvc19jbGFzc2VzKVxyXG5cdCkge1xyXG5cdFx0akljb24ucmVtb3ZlQ2xhc3MoKS5hZGRDbGFzcyggcHJldmlvc19jbGFzc2VzICk7XHJcblx0fVxyXG5cclxuXHRqQnV0dG9uLnJlbW92ZUNsYXNzKCAnZGlzYWJsZWQnICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gUmVtb3ZlIERpc2FibGUgYnV0dG9uLlxyXG5cclxuXHR2YXIgcHJldmlvdXNfb25jbGljayA9IGpCdXR0b24uYXR0ciggJ3dwYmNfcHJldmlvdXNfb25jbGljaycgKVxyXG5cdGlmIChcclxuXHRcdCh1bmRlZmluZWQgIT0gcHJldmlvdXNfb25jbGljaylcclxuXHRcdCYmICgnJyAhPSBwcmV2aW91c19vbmNsaWNrKVxyXG5cdCkge1xyXG5cdFx0akJ1dHRvbi5hdHRyKCAnb25jbGljaycsIHByZXZpb3VzX29uY2xpY2sgKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiBwcmV2aW9zX2NsYXNzZXM7XHJcbn1cclxuIiwiLyoqXHJcbiAqIE9uIHNlbGVjdGlvbiAgb2YgcmFkaW8gYnV0dG9uLCBhZGp1c3QgYXR0cmlidXRlcyBvZiByYWRpbyBjb250YWluZXJcclxuICpcclxuICogQHBhcmFtIF90aGlzXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3VpX2VsX19yYWRpb19jb250YWluZXJfc2VsZWN0aW9uKF90aGlzKSB7XHJcblxyXG5cdGlmICggalF1ZXJ5KCBfdGhpcyApLmlzKCAnOmNoZWNrZWQnICkgKSB7XHJcblx0XHRqUXVlcnkoIF90aGlzICkucGFyZW50cyggJy53cGJjX3VpX3JhZGlvX3NlY3Rpb24nICkuZmluZCggJy53cGJjX3VpX3JhZGlvX2NvbnRhaW5lcicgKS5yZW1vdmVBdHRyKCAnZGF0YS1zZWxlY3RlZCcgKTtcclxuXHRcdGpRdWVyeSggX3RoaXMgKS5wYXJlbnRzKCAnLndwYmNfdWlfcmFkaW9fY29udGFpbmVyOm5vdCguZGlzYWJsZWQpJyApLmF0dHIoICdkYXRhLXNlbGVjdGVkJywgdHJ1ZSApO1xyXG5cdH1cclxuXHJcblx0aWYgKCBqUXVlcnkoIF90aGlzICkuaXMoICc6ZGlzYWJsZWQnICkgKSB7XHJcblx0XHRqUXVlcnkoIF90aGlzICkucGFyZW50cyggJy53cGJjX3VpX3JhZGlvX2NvbnRhaW5lcicgKS5hZGRDbGFzcyggJ2Rpc2FibGVkJyApO1xyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIE9uIGNsaWNrIG9uIFJhZGlvIENvbnRhaW5lciwgd2Ugd2lsbCAgc2VsZWN0ICB0aGUgIHJhZGlvIGJ1dHRvbiAgICBhbmQgdGhlbiBhZGp1c3QgYXR0cmlidXRlcyBvZiByYWRpbyBjb250YWluZXJcclxuICpcclxuICogQHBhcmFtIF90aGlzXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3VpX2VsX19yYWRpb19jb250YWluZXJfY2xpY2soX3RoaXMpIHtcclxuXHJcblx0aWYgKCBqUXVlcnkoIF90aGlzICkuaGFzQ2xhc3MoICdkaXNhYmxlZCcgKSApIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdHZhciBqX3JhZGlvID0galF1ZXJ5KCBfdGhpcyApLmZpbmQoICdpbnB1dFt0eXBlPXJhZGlvXTpub3QoLndwYmMtZm9ybS1yYWRpby1pbnRlcm5hbCknICk7XHJcblx0aWYgKCBqX3JhZGlvLmxlbmd0aCApIHtcclxuXHRcdGpfcmFkaW8ucHJvcCggJ2NoZWNrZWQnLCB0cnVlICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHR9XHJcblxyXG59IiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyA9PSBGdWxsIFNjcmVlbiAgLSAgc3VwcG9ydCBmdW5jdGlvbnMgICA9PVxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbi8qKlxyXG4gKiBDaGVjayBGdWxsICBzY3JlZW4gbW9kZSwgIGJ5ICByZW1vdmluZyB0b3AgdGFiXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NoZWNrX2Z1bGxfc2NyZWVuX21vZGUoKXtcclxuXHRpZiAoIGpRdWVyeSggJ2JvZHknICkuaGFzQ2xhc3MoICd3cGJjX2FkbWluX2Z1bGxfc2NyZWVuJyApICkge1xyXG5cdFx0alF1ZXJ5KCAnaHRtbCcgKS5yZW1vdmVDbGFzcyggJ3dwLXRvb2xiYXInICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGpRdWVyeSggJ2h0bWwnICkuYWRkQ2xhc3MoICd3cC10b29sYmFyJyApO1xyXG5cdH1cclxufVxyXG5qUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uICgpIHtcclxuXHR3cGJjX2NoZWNrX2Z1bGxfc2NyZWVuX21vZGUoKTtcclxufSApOyIsIi8qKlxyXG4gKiBDaGVja2JveCBTZWxlY3Rpb24gZnVuY3Rpb25zIGZvciBMaXN0aW5nLlxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBTZWxlY3Rpb25zIG9mIHNldmVyYWwgIGNoZWNrYm94ZXMgbGlrZSBpbiBnTWFpbCB3aXRoIHNoaWZ0IDopXHJcbiAqIE5lZWQgdG8gIGhhdmUgdGhpcyBzdHJ1Y3R1cmU6XHJcbiAqIC53cGJjX3NlbGVjdGFibGVfdGFibGVcclxuICogICAgICAud3BiY19zZWxlY3RhYmxlX2hlYWRcclxuICogICAgICAgICAgICAgIC5jaGVjay1jb2x1bW5cclxuICogICAgICAgICAgICAgICAgICA6Y2hlY2tib3hcclxuICogICAgICAud3BiY19zZWxlY3RhYmxlX2JvZHlcclxuICogICAgICAgICAgLndwYmNfcm93XHJcbiAqICAgICAgICAgICAgICAuY2hlY2stY29sdW1uXHJcbiAqICAgICAgICAgICAgICAgICAgOmNoZWNrYm94XHJcbiAqICAgICAgLndwYmNfc2VsZWN0YWJsZV9mb290XHJcbiAqICAgICAgICAgICAgICAuY2hlY2stY29sdW1uXHJcbiAqICAgICAgICAgICAgICAgICAgOmNoZWNrYm94XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2RlZmluZV9nbWFpbF9jaGVja2JveF9zZWxlY3Rpb24oICQgKXtcclxuXHJcblx0dmFyIGNoZWNrcywgZmlyc3QsIGxhc3QsIGNoZWNrZWQsIHNsaWNlZCwgbGFzdENsaWNrZWQgPSBmYWxzZTtcclxuXHJcblx0Ly8gQ2hlY2sgYWxsIGNoZWNrYm94ZXMuXHJcblx0JCggJy53cGJjX3NlbGVjdGFibGVfYm9keScgKS5maW5kKCAnLmNoZWNrLWNvbHVtbicgKS5maW5kKCAnOmNoZWNrYm94JyApLm9uKFxyXG5cdFx0J2NsaWNrJyxcclxuXHRcdGZ1bmN0aW9uIChlKSB7XHJcblx0XHRcdGlmICggJ3VuZGVmaW5lZCcgPT0gZS5zaGlmdEtleSApIHtcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIGUuc2hpZnRLZXkgKSB7XHJcblx0XHRcdFx0aWYgKCAhIGxhc3RDbGlja2VkICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNoZWNrcyAgPSAkKCBsYXN0Q2xpY2tlZCApLmNsb3Nlc3QoICcud3BiY19zZWxlY3RhYmxlX2JvZHknICkuZmluZCggJzpjaGVja2JveCcgKS5maWx0ZXIoICc6dmlzaWJsZTplbmFibGVkJyApO1xyXG5cdFx0XHRcdGZpcnN0ICAgPSBjaGVja3MuaW5kZXgoIGxhc3RDbGlja2VkICk7XHJcblx0XHRcdFx0bGFzdCAgICA9IGNoZWNrcy5pbmRleCggdGhpcyApO1xyXG5cdFx0XHRcdGNoZWNrZWQgPSAkKCB0aGlzICkucHJvcCggJ2NoZWNrZWQnICk7XHJcblx0XHRcdFx0aWYgKCAwIDwgZmlyc3QgJiYgMCA8IGxhc3QgJiYgZmlyc3QgIT0gbGFzdCApIHtcclxuXHRcdFx0XHRcdHNsaWNlZCA9IChsYXN0ID4gZmlyc3QpID8gY2hlY2tzLnNsaWNlKCBmaXJzdCwgbGFzdCApIDogY2hlY2tzLnNsaWNlKCBsYXN0LCBmaXJzdCApO1xyXG5cdFx0XHRcdFx0c2xpY2VkLnByb3AoXHJcblx0XHRcdFx0XHRcdCdjaGVja2VkJyxcclxuXHRcdFx0XHRcdFx0ZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0XHRcdGlmICggJCggdGhpcyApLmNsb3Nlc3QoICcud3BiY19yb3cnICkuaXMoICc6dmlzaWJsZScgKSApIHtcclxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBjaGVja2VkO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdCkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0bGFzdENsaWNrZWQgPSB0aGlzO1xyXG5cclxuXHRcdFx0Ly8gdG9nZ2xlIFwiY2hlY2sgYWxsXCIgY2hlY2tib3hlcy5cclxuXHRcdFx0dmFyIHVuY2hlY2tlZCA9ICQoIHRoaXMgKS5jbG9zZXN0KCAnLndwYmNfc2VsZWN0YWJsZV9ib2R5JyApLmZpbmQoICc6Y2hlY2tib3gnICkuZmlsdGVyKCAnOnZpc2libGU6ZW5hYmxlZCcgKS5ub3QoICc6Y2hlY2tlZCcgKTtcclxuXHRcdFx0JCggdGhpcyApLmNsb3Nlc3QoICcud3BiY19zZWxlY3RhYmxlX3RhYmxlJyApLmNoaWxkcmVuKCAnLndwYmNfc2VsZWN0YWJsZV9oZWFkLCAud3BiY19zZWxlY3RhYmxlX2Zvb3QnICkuZmluZCggJzpjaGVja2JveCcgKS5wcm9wKFxyXG5cdFx0XHRcdCdjaGVja2VkJyxcclxuXHRcdFx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gKDAgPT09IHVuY2hlY2tlZC5sZW5ndGgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0KS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblx0KTtcclxuXHJcblx0Ly8gSGVhZCB8fCBGb290IGNsaWNraW5nIHRvICBzZWxlY3QgLyBkZXNlbGVjdCBBTEwuXHJcblx0JCggJy53cGJjX3NlbGVjdGFibGVfaGVhZCwgLndwYmNfc2VsZWN0YWJsZV9mb290JyApLmZpbmQoICcuY2hlY2stY29sdW1uIDpjaGVja2JveCcgKS5vbihcclxuXHRcdCdjbGljaycsXHJcblx0XHRmdW5jdGlvbiAoZXZlbnQpIHtcclxuXHRcdFx0dmFyICR0aGlzICAgICAgICAgID0gJCggdGhpcyApLFxyXG5cdFx0XHRcdCR0YWJsZSAgICAgICAgID0gJHRoaXMuY2xvc2VzdCggJy53cGJjX3NlbGVjdGFibGVfdGFibGUnICksXHJcblx0XHRcdFx0Y29udHJvbENoZWNrZWQgPSAkdGhpcy5wcm9wKCAnY2hlY2tlZCcgKSxcclxuXHRcdFx0XHR0b2dnbGUgICAgICAgICA9IGV2ZW50LnNoaWZ0S2V5IHx8ICR0aGlzLmRhdGEoICd3cC10b2dnbGUnICk7XHJcblxyXG5cdFx0XHQkdGFibGUuY2hpbGRyZW4oICcud3BiY19zZWxlY3RhYmxlX2JvZHknICkuZmlsdGVyKCAnOnZpc2libGUnIClcclxuXHRcdFx0XHQuZmluZCggJy5jaGVjay1jb2x1bW4nICkuZmluZCggJzpjaGVja2JveCcgKVxyXG5cdFx0XHRcdC5wcm9wKFxyXG5cdFx0XHRcdFx0J2NoZWNrZWQnLFxyXG5cdFx0XHRcdFx0ZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0XHRpZiAoICQoIHRoaXMgKS5pcyggJzpoaWRkZW4sOmRpc2FibGVkJyApICkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRpZiAoIHRvZ2dsZSApIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gISAkKCB0aGlzICkucHJvcCggJ2NoZWNrZWQnICk7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoIGNvbnRyb2xDaGVja2VkICkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHQpLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblxyXG5cdFx0XHQkdGFibGUuY2hpbGRyZW4oICcud3BiY19zZWxlY3RhYmxlX2hlYWQsICAud3BiY19zZWxlY3RhYmxlX2Zvb3QnICkuZmlsdGVyKCAnOnZpc2libGUnIClcclxuXHRcdFx0XHQuZmluZCggJy5jaGVjay1jb2x1bW4nICkuZmluZCggJzpjaGVja2JveCcgKVxyXG5cdFx0XHRcdC5wcm9wKFxyXG5cdFx0XHRcdFx0J2NoZWNrZWQnLFxyXG5cdFx0XHRcdFx0ZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0XHRpZiAoIHRvZ2dsZSApIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoIGNvbnRyb2xDaGVja2VkICkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHQpO1xyXG5cdFx0fVxyXG5cdCk7XHJcblxyXG5cclxuXHQvLyBWaXN1YWxseSAgc2hvdyBzZWxlY3RlZCBib3JkZXIuXHJcblx0JCggJy53cGJjX3NlbGVjdGFibGVfYm9keScgKS5maW5kKCAnLmNoZWNrLWNvbHVtbiA6Y2hlY2tib3gnICkub24oXHJcblx0XHQnY2hhbmdlJyxcclxuXHRcdGZ1bmN0aW9uIChldmVudCkge1xyXG5cdFx0XHRpZiAoIGpRdWVyeSggdGhpcyApLmlzKCAnOmNoZWNrZWQnICkgKSB7XHJcblx0XHRcdFx0alF1ZXJ5KCB0aGlzICkuY2xvc2VzdCggJy53cGJjX2xpc3Rfcm93JyApLmFkZENsYXNzKCAncm93X3NlbGVjdGVkX2NvbG9yJyApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGpRdWVyeSggdGhpcyApLmNsb3Nlc3QoICcud3BiY19saXN0X3JvdycgKS5yZW1vdmVDbGFzcyggJ3Jvd19zZWxlY3RlZF9jb2xvcicgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRGlzYWJsZSB0ZXh0IHNlbGVjdGlvbiB3aGlsZSBwcmVzc2luZyAnc2hpZnQnLlxyXG5cdFx0XHRkb2N1bWVudC5nZXRTZWxlY3Rpb24oKS5yZW1vdmVBbGxSYW5nZXMoKTtcclxuXHJcblx0XHRcdC8vIFNob3cgb3IgaGlkZSBidXR0b25zIG9uIEFjdGlvbnMgdG9vbGJhciAgYXQgIEJvb2tpbmcgTGlzdGluZyAgcGFnZSwgIGlmIHdlIGhhdmUgc29tZSBzZWxlY3RlZCBib29raW5ncy5cclxuXHRcdFx0d3BiY19zaG93X2hpZGVfYWN0aW9uX2J1dHRvbnNfZm9yX3NlbGVjdGVkX2Jvb2tpbmdzKCk7XHJcblx0XHR9XHJcblx0KTtcclxuXHJcblx0d3BiY19zaG93X2hpZGVfYWN0aW9uX2J1dHRvbnNfZm9yX3NlbGVjdGVkX2Jvb2tpbmdzKCk7XHJcbn1cclxuIiwiXHJcbi8qKlxyXG4gKiBHZXQgSUQgYXJyYXkgIG9mIHNlbGVjdGVkIGVsZW1lbnRzXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2dldF9zZWxlY3RlZF9yb3dfaWQoKSB7XHJcblxyXG5cdHZhciAkdGFibGUgICAgICA9IGpRdWVyeSggJy53cGJjX193cmFwX19ib29raW5nX2xpc3RpbmcgLndwYmNfc2VsZWN0YWJsZV90YWJsZScgKTtcclxuXHR2YXIgY2hlY2tib3hlcyAgPSAkdGFibGUuY2hpbGRyZW4oICcud3BiY19zZWxlY3RhYmxlX2JvZHknICkuZmlsdGVyKCAnOnZpc2libGUnICkuZmluZCggJy5jaGVjay1jb2x1bW4nICkuZmluZCggJzpjaGVja2JveCcgKTtcclxuXHR2YXIgc2VsZWN0ZWRfaWQgPSBbXTtcclxuXHJcblx0alF1ZXJ5LmVhY2goXHJcblx0XHRjaGVja2JveGVzLFxyXG5cdFx0ZnVuY3Rpb24gKGtleSwgY2hlY2tib3gpIHtcclxuXHRcdFx0aWYgKCBqUXVlcnkoIGNoZWNrYm94ICkuaXMoICc6Y2hlY2tlZCcgKSApIHtcclxuXHRcdFx0XHR2YXIgZWxlbWVudF9pZCA9IHdwYmNfZ2V0X3Jvd19pZF9mcm9tX2VsZW1lbnQoIGNoZWNrYm94ICk7XHJcblx0XHRcdFx0c2VsZWN0ZWRfaWQucHVzaCggZWxlbWVudF9pZCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0KTtcclxuXHJcblx0cmV0dXJuIHNlbGVjdGVkX2lkO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIEdldCBJRCBvZiByb3csICBiYXNlZCBvbiBjbGNpa2VkIGVsZW1lbnRcclxuICpcclxuICogQHBhcmFtIHRoaXNfaW5ib3VuZF9lbGVtZW50ICAtIHVzdXNsbHkgIHRoaXNcclxuICogQHJldHVybnMge251bWJlcn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZ2V0X3Jvd19pZF9mcm9tX2VsZW1lbnQodGhpc19pbmJvdW5kX2VsZW1lbnQpIHtcclxuXHJcblx0dmFyIGVsZW1lbnRfaWQgPSBqUXVlcnkoIHRoaXNfaW5ib3VuZF9lbGVtZW50ICkuY2xvc2VzdCggJy53cGJjX2xpc3RpbmdfdXN1YWxfcm93JyApLmF0dHIoICdpZCcgKTtcclxuXHJcblx0ZWxlbWVudF9pZCA9IHBhcnNlSW50KCBlbGVtZW50X2lkLnJlcGxhY2UoICdyb3dfaWRfJywgJycgKSApO1xyXG5cclxuXHRyZXR1cm4gZWxlbWVudF9pZDtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiA9PSBCb29raW5nIExpc3RpbmcgPT0gU2hvdyBvciBoaWRlIGJ1dHRvbnMgb24gQWN0aW9ucyB0b29sYmFyICBhdCAgICBwYWdlLCAgaWYgd2UgaGF2ZSBzb21lIHNlbGVjdGVkIGJvb2tpbmdzLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19zaG93X2hpZGVfYWN0aW9uX2J1dHRvbnNfZm9yX3NlbGVjdGVkX2Jvb2tpbmdzKCl7XHJcblxyXG5cdHZhciBzZWxlY3RlZF9yb3dzX2FyciA9IHdwYmNfZ2V0X3NlbGVjdGVkX3Jvd19pZCgpO1xyXG5cclxuXHRpZiAoIHNlbGVjdGVkX3Jvd3NfYXJyLmxlbmd0aCA+IDAgKSB7XHJcblx0XHRqUXVlcnkoICcuaGlkZV9idXR0b25faWZfbm9fc2VsZWN0aW9uJyApLnNob3coKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0alF1ZXJ5KCAnLmhpZGVfYnV0dG9uX2lmX25vX3NlbGVjdGlvbicgKS5oaWRlKCk7XHJcblx0fVxyXG59IiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyA9PSBMZWZ0IEJhciAgLSAgZXhwYW5kIC8gY29sYXBzZSBmdW5jdGlvbnMgICA9PVxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbi8qKlxyXG4gKiBFeHBhbmQgVmVydGljYWwgTGVmdCBCYXIuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX2RvX21heCgpIHtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkucmVtb3ZlQ2xhc3MoICdtaW4gbWF4IGNvbXBhY3Qgbm9uZScgKTtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkuYWRkQ2xhc3MoICdtYXgnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9vcGVuX2xlZnRfdmVydGljYWxfbmF2JyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2hpZGVfbGVmdF92ZXJ0aWNhbF9uYXYnICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG59XHJcblxyXG4vKipcclxuICogSGlkZSBWZXJ0aWNhbCBMZWZ0IEJhci5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fZG9fbWluKCkge1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5yZW1vdmVDbGFzcyggJ21pbiBtYXggY29tcGFjdCBub25lJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5hZGRDbGFzcyggJ21pbicgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fbGVmdF92ZXJ0aWNhbF9uYXYnICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5faGlkZV9sZWZ0X3ZlcnRpY2FsX25hdicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb2xhcHNlIFZlcnRpY2FsIExlZnQgQmFyLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19kb19jb21wYWN0KCkge1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5yZW1vdmVDbGFzcyggJ21pbiBtYXggY29tcGFjdCBub25lJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5hZGRDbGFzcyggJ2NvbXBhY3QnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9vcGVuX2xlZnRfdmVydGljYWxfbmF2JyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2hpZGVfbGVmdF92ZXJ0aWNhbF9uYXYnICkuYWRkQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG59XHJcblxyXG4vKipcclxuICogQ29tcGxldGVseSBIaWRlIFZlcnRpY2FsIExlZnQgQmFyLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19kb19oaWRlKCkge1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5yZW1vdmVDbGFzcyggJ21pbiBtYXggY29tcGFjdCBub25lJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5hZGRDbGFzcyggJ25vbmUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9vcGVuX2xlZnRfdmVydGljYWxfbmF2JyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2hpZGVfbGVmdF92ZXJ0aWNhbF9uYXYnICkuYWRkQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdC8vIEhpZGUgdG9wIFwiTWVudVwiIGJ1dHRvbiB3aXRoIGRpdmlkZXIuXHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9zaG93X2xlZnRfdmVydGljYWxfbmF2LC53cGJjX3VpX190b3BfbmF2X19idG5fc2hvd19sZWZ0X3ZlcnRpY2FsX25hdl9kaXZpZGVyJyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFjdGlvbiBvbiBjbGljayBcIkdvIEJhY2tcIiAtIHNob3cgcm9vdCBtZW51XHJcbiAqIG9yIHNvbWUgb3RoZXIgc2VjdGlvbiBpbiBsZWZ0IHNpZGViYXIuXHJcbiAqXHJcbiAqIEBwYXJhbSBzdHJpbmcgbWVudV90b19zaG93IC0gbWVudSBzbHVnLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19zaG93X3NlY3Rpb24oIG1lbnVfdG9fc2hvdyApIHtcclxuXHRqUXVlcnkoICcud3BiY191aV9lbF9fdmVydF9sZWZ0X2Jhcl9fc2VjdGlvbicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnIClcclxuXHRqUXVlcnkoICcud3BiY191aV9lbF9fdmVydF9sZWZ0X2Jhcl9fc2VjdGlvbl8nICsgbWVudV90b19zaG93ICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIEdldCBhbmNob3IocykgYXJyYXkgIGZyb20gIFVSTC5cclxuICogRG9jOiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvTG9jYXRpb25cclxuICpcclxuICogQHJldHVybnMgeypbXX1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfdXJsX2dldF9hbmNob3JzX2FycigpIHtcclxuXHR2YXIgaGFzaGVzICAgICAgICAgICAgPSB3aW5kb3cubG9jYXRpb24uaGFzaC5yZXBsYWNlKCAnJTIzJywgJyMnICk7XHJcblx0dmFyIGhhc2hlc19hcnIgICAgICAgID0gaGFzaGVzLnNwbGl0KCAnIycgKTtcclxuXHR2YXIgcmVzdWx0ICAgICAgICAgICAgPSBbXTtcclxuXHR2YXIgaGFzaGVzX2Fycl9sZW5ndGggPSBoYXNoZXNfYXJyLmxlbmd0aDtcclxuXHJcblx0Zm9yICggdmFyIGkgPSAwOyBpIDwgaGFzaGVzX2Fycl9sZW5ndGg7IGkrKyApIHtcclxuXHRcdGlmICggaGFzaGVzX2FycltpXS5sZW5ndGggPiAwICkge1xyXG5cdFx0XHRyZXN1bHQucHVzaCggaGFzaGVzX2FycltpXSApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG4vKipcclxuICogQXV0byBFeHBhbmQgU2V0dGluZ3Mgc2VjdGlvbiBiYXNlZCBvbiBVUkwgYW5jaG9yLCBhZnRlciAgcGFnZSBsb2FkZWQuXHJcbiAqL1xyXG5qUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uICgpIHsgd3BiY19hZG1pbl91aV9fZG9fZXhwYW5kX3NlY3Rpb24oKTsgc2V0VGltZW91dCggJ3dwYmNfYWRtaW5fdWlfX2RvX2V4cGFuZF9zZWN0aW9uJywgMTAgKTsgfSApO1xyXG5qUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uICgpIHsgd3BiY19hZG1pbl91aV9fZG9fZXhwYW5kX3NlY3Rpb24oKTsgc2V0VGltZW91dCggJ3dwYmNfYWRtaW5fdWlfX2RvX2V4cGFuZF9zZWN0aW9uJywgMTUwICk7IH0gKTtcclxuXHJcbi8qKlxyXG4gKiBFeHBhbmQgc2VjdGlvbiBpbiAgR2VuZXJhbCBTZXR0aW5ncyBwYWdlIGFuZCBzZWxlY3QgTWVudSBpdGVtLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fZG9fZXhwYW5kX3NlY3Rpb24oKSB7XHJcblxyXG5cdC8vIHdpbmRvdy5sb2NhdGlvbi5oYXNoICA9ICNzZWN0aW9uX2lkICAvICBkb2M6IGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9Mb2NhdGlvbiAuXHJcblx0dmFyIGFuY2hvcnNfYXJyICAgICAgICA9IHdwYmNfdXJsX2dldF9hbmNob3JzX2FycigpO1xyXG5cdHZhciBhbmNob3JzX2Fycl9sZW5ndGggPSBhbmNob3JzX2Fyci5sZW5ndGg7XHJcblxyXG5cdGlmICggYW5jaG9yc19hcnJfbGVuZ3RoID4gMCApIHtcclxuXHRcdHZhciBvbmVfYW5jaG9yX3Byb3BfdmFsdWUgPSBhbmNob3JzX2FyclswXS5zcGxpdCggJ2RvX2V4cGFuZF9fJyApO1xyXG5cdFx0aWYgKCBvbmVfYW5jaG9yX3Byb3BfdmFsdWUubGVuZ3RoID4gMSApIHtcclxuXHJcblx0XHRcdC8vICd3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FsZW5kYXJfbWV0YWJveCdcclxuXHRcdFx0dmFyIHNlY3Rpb25fdG9fc2hvdyAgICA9IG9uZV9hbmNob3JfcHJvcF92YWx1ZVsxXTtcclxuXHRcdFx0dmFyIHNlY3Rpb25faWRfdG9fc2hvdyA9ICcjJyArIHNlY3Rpb25fdG9fc2hvdztcclxuXHJcblxyXG5cdFx0XHQvLyAtLSBSZW1vdmUgc2VsZWN0ZWQgYmFja2dyb3VuZCBpbiBhbGwgbGVmdCAgbWVudSAgaXRlbXMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdGpRdWVyeSggJy53cGJjX3VpX2VsX192ZXJ0X25hdl9pdGVtICcgKS5yZW1vdmVDbGFzcyggJ2FjdGl2ZScgKTtcclxuXHRcdFx0Ly8gU2V0IGxlZnQgbWVudSBzZWxlY3RlZC5cclxuXHRcdFx0alF1ZXJ5KCAnLmRvX2V4cGFuZF9fJyArIHNlY3Rpb25fdG9fc2hvdyArICdfbGluaycgKS5hZGRDbGFzcyggJ2FjdGl2ZScgKTtcclxuXHRcdFx0dmFyIHNlbGVjdGVkX3RpdGxlID0galF1ZXJ5KCAnLmRvX2V4cGFuZF9fJyArIHNlY3Rpb25fdG9fc2hvdyArICdfbGluayBhIC53cGJjX3VpX2VsX192ZXJ0X25hdl90aXRsZSAnICkudGV4dCgpO1xyXG5cclxuXHRcdFx0Ly8gRXhwYW5kIHNlY3Rpb24sIGlmIGl0IGNvbGFwc2VkLlxyXG5cdFx0XHRpZiAoICEgalF1ZXJ5KCAnLmRvX2V4cGFuZF9fJyArIHNlY3Rpb25fdG9fc2hvdyArICdfbGluaycgKS5wYXJlbnRzKCAnLndwYmNfdWlfZWxfX2xldmVsX19mb2xkZXInICkuaGFzQ2xhc3MoICdleHBhbmRlZCcgKSApIHtcclxuXHRcdFx0XHRqUXVlcnkoICcud3BiY191aV9lbF9fbGV2ZWxfX2ZvbGRlcicgKS5yZW1vdmVDbGFzcyggJ2V4cGFuZGVkJyApO1xyXG5cdFx0XHRcdGpRdWVyeSggJy5kb19leHBhbmRfXycgKyBzZWN0aW9uX3RvX3Nob3cgKyAnX2xpbmsnICkucGFyZW50cyggJy53cGJjX3VpX2VsX19sZXZlbF9fZm9sZGVyJyApLmFkZENsYXNzKCAnZXhwYW5kZWQnICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIC0tIEV4cGFuZCBzZWN0aW9uIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHR2YXIgY29udGFpbmVyX3RvX2hpZGVfY2xhc3MgPSAnLnBvc3Rib3gnO1xyXG5cdFx0XHQvLyBIaWRlIHNlY3Rpb25zICcucG9zdGJveCcgaW4gYWRtaW4gcGFnZSBhbmQgc2hvdyBzcGVjaWZpYyBvbmUuXHJcblx0XHRcdGpRdWVyeSggJy53cGJjX2FkbWluX3BhZ2UgJyArIGNvbnRhaW5lcl90b19oaWRlX2NsYXNzICkuaGlkZSgpO1xyXG5cdFx0XHRqUXVlcnkoICcud3BiY19jb250YWluZXJfYWx3YXlzX2hpZGVfX29uX2xlZnRfbmF2X2NsaWNrJyApLmhpZGUoKTtcclxuXHRcdFx0alF1ZXJ5KCBzZWN0aW9uX2lkX3RvX3Nob3cgKS5zaG93KCk7XHJcblxyXG5cdFx0XHQvLyBTaG93IGFsbCBvdGhlciBzZWN0aW9ucywgIGlmIHByb3ZpZGVkIGluIFVSTDogLi4/cGFnZT13cGJjLXNldHRpbmdzI2RvX2V4cGFuZF9fd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhcGFjaXR5X21ldGFib3gjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhcGFjaXR5X3VwZ3JhZGVfbWV0YWJveCAuXHJcblx0XHRcdGZvciAoIGxldCBpID0gMTsgaSA8IGFuY2hvcnNfYXJyX2xlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRcdGpRdWVyeSggJyMnICsgYW5jaG9yc19hcnJbaV0gKS5zaG93KCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggZmFsc2UgKSB7XHJcblx0XHRcdFx0dmFyIHRhcmdldE9mZnNldCA9IHdwYmNfc2Nyb2xsX3RvKCBzZWN0aW9uX2lkX3RvX3Nob3cgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gLS0gU2V0IFZhbHVlIHRvIElucHV0IGFib3V0IHNlbGVjdGVkIE5hdiBlbGVtZW50ICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gICAgICAgLy8gRml4SW46IDkuOC42LjEuXHJcblx0XHRcdHZhciBzZWN0aW9uX2lkX3RhYiA9IHNlY3Rpb25faWRfdG9fc2hvdy5zdWJzdHJpbmcoIDAsIHNlY3Rpb25faWRfdG9fc2hvdy5sZW5ndGggLSA4ICkgKyAnX3RhYic7XHJcblx0XHRcdGlmICggY29udGFpbmVyX3RvX2hpZGVfY2xhc3MgPT0gc2VjdGlvbl9pZF90b19zaG93ICkge1xyXG5cdFx0XHRcdHNlY3Rpb25faWRfdGFiID0gJyN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfYWxsX3RhYidcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoICcjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhcGFjaXR5X21ldGFib3gsI3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYXBhY2l0eV91cGdyYWRlX21ldGFib3gnID09IHNlY3Rpb25faWRfdG9fc2hvdyApIHtcclxuXHRcdFx0XHRzZWN0aW9uX2lkX3RhYiA9ICcjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhcGFjaXR5X3RhYidcclxuXHRcdFx0fVxyXG5cdFx0XHRqUXVlcnkoICcjZm9ybV92aXNpYmxlX3NlY3Rpb24nICkudmFsKCBzZWN0aW9uX2lkX3RhYiApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIExpa2UgYmxpbmtpbmcgc29tZSBlbGVtZW50cy5cclxuXHRcdHdwYmNfYWRtaW5fdWlfX2RvX19hbmNob3JfX2Fub3RoZXJfYWN0aW9ucygpO1xyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIE9wZW4gc2V0dGluZ3MgcGFnZSAgfCAgRXhwYW5kIHNlY3Rpb24gIHwgIFNlbGVjdCBNZW51IGl0ZW0uXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19kb19fb3Blbl91cmxfX2V4cGFuZF9zZWN0aW9uKHVybCwgc2VjdGlvbl9pZCkge1xyXG5cclxuXHQvLyB3aW5kb3cubG9jYXRpb24uaHJlZiA9IHVybCArICcmZG9fZXhwYW5kPScgKyBzZWN0aW9uX2lkICsgJyNkb19leHBhbmRfXycgKyBzZWN0aW9uX2lkOyAvLy5cclxuXHR3aW5kb3cubG9jYXRpb24uaHJlZiA9IHVybCArICcjZG9fZXhwYW5kX18nICsgc2VjdGlvbl9pZDtcclxuXHJcblx0d3BiY19hZG1pbl91aV9fZG9fZXhwYW5kX3NlY3Rpb24oKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBDaGVjayAgZm9yIE90aGVyIGFjdGlvbnM6ICBMaWtlIGJsaW5raW5nIHNvbWUgZWxlbWVudHMgaW4gc2V0dGluZ3MgcGFnZS4gRS5nLiBEYXlzIHNlbGVjdGlvbiAgb3IgIGNoYW5nZS1vdmVyIGRheXMuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19kb19fYW5jaG9yX19hbm90aGVyX2FjdGlvbnMoKSB7XHJcblxyXG5cdHZhciBhbmNob3JzX2FyciAgICAgICAgPSB3cGJjX3VybF9nZXRfYW5jaG9yc19hcnIoKTtcclxuXHR2YXIgYW5jaG9yc19hcnJfbGVuZ3RoID0gYW5jaG9yc19hcnIubGVuZ3RoO1xyXG5cclxuXHQvLyBPdGhlciBhY3Rpb25zOiAgTGlrZSBibGlua2luZyBzb21lIGVsZW1lbnRzLlxyXG5cdGZvciAoIHZhciBpID0gMDsgaSA8IGFuY2hvcnNfYXJyX2xlbmd0aDsgaSsrICkge1xyXG5cclxuXHRcdHZhciB0aGlzX2FuY2hvciA9IGFuY2hvcnNfYXJyW2ldO1xyXG5cclxuXHRcdHZhciB0aGlzX2FuY2hvcl9wcm9wX3ZhbHVlID0gdGhpc19hbmNob3Iuc3BsaXQoICdkb19vdGhlcl9hY3Rpb25zX18nICk7XHJcblxyXG5cdFx0aWYgKCB0aGlzX2FuY2hvcl9wcm9wX3ZhbHVlLmxlbmd0aCA+IDEgKSB7XHJcblxyXG5cdFx0XHR2YXIgc2VjdGlvbl9hY3Rpb24gPSB0aGlzX2FuY2hvcl9wcm9wX3ZhbHVlWzFdO1xyXG5cclxuXHRcdFx0c3dpdGNoICggc2VjdGlvbl9hY3Rpb24gKSB7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ2JsaW5rX2RheV9zZWxlY3Rpb25zJzpcclxuXHRcdFx0XHRcdC8vIHdwYmNfdWlfc2V0dGluZ3NfX3BhbmVsX19jbGljayggJyN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FsZW5kYXJfdGFiIGEnLCAnI3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYWxlbmRhcl9tZXRhYm94JywgJ0RheXMgU2VsZWN0aW9uJyApOy5cclxuXHRcdFx0XHRcdHdwYmNfYmxpbmtfZWxlbWVudCggJy53cGJjX3RyX3NldF9nZW5fYm9va2luZ190eXBlX29mX2RheV9zZWxlY3Rpb25zJywgNCwgMzUwICk7XHJcblx0XHRcdFx0XHRcdHdwYmNfc2Nyb2xsX3RvKCAnLndwYmNfdHJfc2V0X2dlbl9ib29raW5nX3R5cGVfb2ZfZGF5X3NlbGVjdGlvbnMnICk7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0Y2FzZSAnYmxpbmtfY2hhbmdlX292ZXJfZGF5cyc6XHJcblx0XHRcdFx0XHQvLyB3cGJjX3VpX3NldHRpbmdzX19wYW5lbF9fY2xpY2soICcjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhbGVuZGFyX3RhYiBhJywgJyN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FsZW5kYXJfbWV0YWJveCcsICdDaGFuZ2VvdmVyIERheXMnICk7LlxyXG5cdFx0XHRcdFx0d3BiY19ibGlua19lbGVtZW50KCAnLndwYmNfdHJfc2V0X2dlbl9ib29raW5nX3JhbmdlX3NlbGVjdGlvbl90aW1lX2lzX2FjdGl2ZScsIDQsIDM1MCApO1xyXG5cdFx0XHRcdFx0XHR3cGJjX3Njcm9sbF90byggJy53cGJjX3RyX3NldF9nZW5fYm9va2luZ19yYW5nZV9zZWxlY3Rpb25fdGltZV9pc19hY3RpdmUnICk7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0Y2FzZSAnYmxpbmtfY2FwdGNoYSc6XHJcblx0XHRcdFx0XHR3cGJjX2JsaW5rX2VsZW1lbnQoICcud3BiY190cl9zZXRfZ2VuX2Jvb2tpbmdfaXNfdXNlX2NhcHRjaGEnLCA0LCAzNTAgKTtcclxuXHRcdFx0XHRcdFx0d3BiY19zY3JvbGxfdG8oICcud3BiY190cl9zZXRfZ2VuX2Jvb2tpbmdfaXNfdXNlX2NhcHRjaGEnICk7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxufSIsIi8qKlxyXG4gKiBDb3B5IHR4dCB0byBjbGlwYnJkIGZyb20gVGV4dCBmaWVsZHMuXHJcbiAqXHJcbiAqIEBwYXJhbSBodG1sX2VsZW1lbnRfaWQgIC0gZS5nLiAnZGF0YV9maWVsZCdcclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NvcHlfdGV4dF90b19jbGlwYnJkX2Zyb21fZWxlbWVudCggaHRtbF9lbGVtZW50X2lkICkge1xyXG5cdC8vIEdldCB0aGUgdGV4dCBmaWVsZC5cclxuXHR2YXIgY29weVRleHQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggaHRtbF9lbGVtZW50X2lkICk7XHJcblxyXG5cdC8vIFNlbGVjdCB0aGUgdGV4dCBmaWVsZC5cclxuXHRjb3B5VGV4dC5zZWxlY3QoKTtcclxuXHRjb3B5VGV4dC5zZXRTZWxlY3Rpb25SYW5nZSggMCwgOTk5OTkgKTsgLy8gRm9yIG1vYmlsZSBkZXZpY2VzLlxyXG5cclxuXHQvLyBDb3B5IHRoZSB0ZXh0IGluc2lkZSB0aGUgdGV4dCBmaWVsZC5cclxuXHR2YXIgaXNfY29waWVkID0gd3BiY19jb3B5X3RleHRfdG9fY2xpcGJyZCggY29weVRleHQudmFsdWUgKTtcclxuXHRpZiAoICEgaXNfY29waWVkICkge1xyXG5cdFx0Y29uc29sZS5lcnJvciggJ09vcHMsIHVuYWJsZSB0byBjb3B5JywgY29weVRleHQudmFsdWUgKTtcclxuXHR9XHJcblx0cmV0dXJuIGlzX2NvcGllZDtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvcHkgdHh0IHRvIGNsaXBicmQuXHJcbiAqXHJcbiAqIEBwYXJhbSB0ZXh0XHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jb3B5X3RleHRfdG9fY2xpcGJyZCh0ZXh0KSB7XHJcblxyXG5cdGlmICggISBuYXZpZ2F0b3IuY2xpcGJvYXJkICkge1xyXG5cdFx0cmV0dXJuIHdwYmNfZmFsbGJhY2tfY29weV90ZXh0X3RvX2NsaXBicmQoIHRleHQgKTtcclxuXHR9XHJcblxyXG5cdG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KCB0ZXh0ICkudGhlbihcclxuXHRcdGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0Ly8gY29uc29sZS5sb2coICdBc3luYzogQ29weWluZyB0byBjbGlwYm9hcmQgd2FzIHN1Y2Nlc3NmdWwhJyApOy5cclxuXHRcdFx0cmV0dXJuICB0cnVlO1xyXG5cdFx0fSxcclxuXHRcdGZ1bmN0aW9uIChlcnIpIHtcclxuXHRcdFx0Ly8gY29uc29sZS5lcnJvciggJ0FzeW5jOiBDb3VsZCBub3QgY29weSB0ZXh0OiAnLCBlcnIgKTsuXHJcblx0XHRcdHJldHVybiAgZmFsc2U7XHJcblx0XHR9XHJcblx0KTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvcHkgdHh0IHRvIGNsaXBicmQgLSBkZXByaWNhdGVkIG1ldGhvZC5cclxuICpcclxuICogQHBhcmFtIHRleHRcclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2ZhbGxiYWNrX2NvcHlfdGV4dF90b19jbGlwYnJkKCB0ZXh0ICkge1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIHZhciB0ZXh0QXJlYSAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggXCJ0ZXh0YXJlYVwiICk7XHJcblx0Ly8gdGV4dEFyZWEudmFsdWUgPSB0ZXh0O1xyXG5cdC8vXHJcblx0Ly8gLy8gQXZvaWQgc2Nyb2xsaW5nIHRvIGJvdHRvbS5cclxuXHQvLyB0ZXh0QXJlYS5zdHlsZS50b3AgICAgICA9IFwiMFwiO1xyXG5cdC8vIHRleHRBcmVhLnN0eWxlLmxlZnQgICAgID0gXCIwXCI7XHJcblx0Ly8gdGV4dEFyZWEuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCI7XHJcblx0Ly8gdGV4dEFyZWEuc3R5bGUuekluZGV4ICAgPSBcIjk5OTk5OTk5OVwiO1xyXG5cdC8vIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIHRleHRBcmVhICk7XHJcblx0Ly8gdGV4dEFyZWEuZm9jdXMoKTtcclxuXHQvLyB0ZXh0QXJlYS5zZWxlY3QoKTtcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBOb3cgZ2V0IGl0IGFzIEhUTUwgIChvcmlnaW5hbCBoZXJlIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzM0MTkxNzgwL2phdmFzY3JpcHQtY29weS1zdHJpbmctdG8tY2xpcGJvYXJkLWFzLXRleHQtaHRtbCApLlxyXG5cclxuXHQvLyBbMV0gLSBDcmVhdGUgY29udGFpbmVyIGZvciB0aGUgSFRNTC5cclxuXHR2YXIgY29udGFpbmVyICAgICAgID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcclxuXHRjb250YWluZXIuaW5uZXJIVE1MID0gdGV4dDtcclxuXHJcblx0Ly8gWzJdIC0gSGlkZSBlbGVtZW50LlxyXG5cdGNvbnRhaW5lci5zdHlsZS5wb3NpdGlvbiAgICAgID0gJ2ZpeGVkJztcclxuXHRjb250YWluZXIuc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcclxuXHRjb250YWluZXIuc3R5bGUub3BhY2l0eSAgICAgICA9IDA7XHJcblxyXG5cdC8vIERldGVjdCBhbGwgc3R5bGUgc2hlZXRzIG9mIHRoZSBwYWdlLlxyXG5cdHZhciBhY3RpdmVTaGVldHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggZG9jdW1lbnQuc3R5bGVTaGVldHMgKS5maWx0ZXIoXHJcblx0XHRmdW5jdGlvbiAoc2hlZXQpIHtcclxuXHRcdFx0cmV0dXJuICEgc2hlZXQuZGlzYWJsZWQ7XHJcblx0XHR9XHJcblx0KTtcclxuXHJcblx0Ly8gWzNdIC0gTW91bnQgdGhlIGNvbnRhaW5lciB0byB0aGUgRE9NIHRvIG1ha2UgYGNvbnRlbnRXaW5kb3dgIGF2YWlsYWJsZS5cclxuXHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCBjb250YWluZXIgKTtcclxuXHJcblx0Ly8gWzRdIC0gQ29weSB0byBjbGlwYm9hcmQuXHJcblx0d2luZG93LmdldFNlbGVjdGlvbigpLnJlbW92ZUFsbFJhbmdlcygpO1xyXG5cclxuXHR2YXIgcmFuZ2UgPSBkb2N1bWVudC5jcmVhdGVSYW5nZSgpO1xyXG5cdHJhbmdlLnNlbGVjdE5vZGUoIGNvbnRhaW5lciApO1xyXG5cdHdpbmRvdy5nZXRTZWxlY3Rpb24oKS5hZGRSYW5nZSggcmFuZ2UgKTtcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHR2YXIgcmVzdWx0ID0gZmFsc2U7XHJcblxyXG5cdHRyeSB7XHJcblx0XHRyZXN1bHQgPSBkb2N1bWVudC5leGVjQ29tbWFuZCggJ2NvcHknICk7XHJcblx0XHQvLyBjb25zb2xlLmxvZyggJ0ZhbGxiYWNrOiBDb3B5aW5nIHRleHQgY29tbWFuZCB3YXMgJyArIG1zZyApOyAvLy5cclxuXHR9IGNhdGNoICggZXJyICkge1xyXG5cdFx0Ly8gY29uc29sZS5lcnJvciggJ0ZhbGxiYWNrOiBPb3BzLCB1bmFibGUgdG8gY29weScsIGVyciApOyAvLy5cclxuXHR9XHJcblx0Ly8gZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCggdGV4dEFyZWEgKTsgLy8uXHJcblxyXG5cdC8vIFs1LjRdIC0gRW5hYmxlIENTUy5cclxuXHR2YXIgYWN0aXZlU2hlZXRzX2xlbmd0aCA9IGFjdGl2ZVNoZWV0cy5sZW5ndGg7XHJcblx0Zm9yICggdmFyIGkgPSAwOyBpIDwgYWN0aXZlU2hlZXRzX2xlbmd0aDsgaSsrICkge1xyXG5cdFx0YWN0aXZlU2hlZXRzW2ldLmRpc2FibGVkID0gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvLyBbNl0gLSBSZW1vdmUgdGhlIGNvbnRhaW5lclxyXG5cdGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoIGNvbnRhaW5lciApO1xyXG5cclxuXHRyZXR1cm4gIHJlc3VsdDtcclxufSJdfQ==
